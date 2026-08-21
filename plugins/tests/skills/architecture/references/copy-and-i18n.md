# User-visible copy in tests

## The rule

**A test never asserts on translated copy. It asserts on the stable identifier of the string, and
the translation layer is substituted once, at the framework seam.**

The reasons are separate, and the second is the one that decides it:

1. Copy changes without behaviour changing. A test that asserts `'Save catalog'` goes red when
   someone shortens the label to `'Save'` — a red line reporting no defect.
2. **The translation store moves.** Local JSON today, platform-managed labels tomorrow — a
   translation store that lives outside the repository is a live possibility for any product. A test
   bound to *where* a string is stored has to be rewritten by that migration; a test bound to the key
   does not.

The second reason also rules out the tempting middle option: importing the key from the resource
file to get compile-time safety. It buys a `tsc` error on a renamed key and pays for it with a
hard dependency on the resource layout — the exact thing the migration changes.

## The mechanism

One substitution, in the tier setup file. Never copied into individual test files. That is the
rule, and it is not what a tree without that setup file does today.

**The double is per file today, and that is the interim.** `vitest.setup.ts` is the DOM tier's setup
file and it carries no `react-i18next` mock at all — read it before you rely on one. So a new DOM
test writes the block below into its own file. Moving the block into the setup file and deleting the
copies is one task, and main skill §8 carries it as a sanctioned interim until then.

```ts
// INTERIM rule 7 — today this block sits at the top of the test file that needs it; after the
// sweep it is in the DOM-tier setup file, once. The marker is what tells a reviewer this copy is
// the sanctioned interim rather than the violation the gate reports → main skill, §8.
vi.mock('react-i18next', () => ({
  // The mock returns the key. A key is the string's stable identity: it survives a copy edit and
  // it survives the translation store moving outside the repository.
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));
```

A case then reads:

```ts
screen.getByRole('button', { name: 'toolbar.save' });
```

The key appears as a literal, and that is accepted deliberately: a literal key is portable, and the
cost — a renamed key fails at run time rather than at compile time — is smaller than the cost of
binding every test to the resource file layout.

**Interpolated strings** come back as `key {"count":3}` from the mock above. Assert on the key part
with a matcher or a regex; never rebuild the interpolated sentence in the test, which is asserting
on copy again by another route.

## Why the setup file and not each test file

Where most component test files carry their own copy of the same four-line mock — count them with
`grep -rl "vi\.mock('react-i18next'" --include='*.test.ts*' src server shared scripts` — every copy
is a place the mock can drift, and every one has to be edited the day the i18n library changes. A
substitution that belongs to the environment belongs to the environment's setup.

## Which tier's setup file

**The DOM tier's, because a file needing this double needs React.** `useTranslation` and `Trans`
only run inside a render — through a component or through `renderHook` — and both put the file in the
DOM tier by the tier rule. A node-tier file reaching for the i18n double is usually a file in the
wrong tier; rename it.

If a genuine node-tier need ever appears, the double goes in the node tier's setup file, never into
the test file. The rule is one substitution per tier, not one per author.

## The defect this rule exposes

Once tests assert keys, any test asserting real prose is evidence that the component **bypassed the
translation layer** — the copy is hardcoded in the component, not in the catalogue. That shows up
immediately: files asserting `'Widget Catalog'`, `'Delete'`, `'Edit'`.

The test is not at fault there and must not be "fixed" by moving the string into the catalogue's
test double. The component is at fault. File it as a component defect.

## Rules

1. No test asserts on translated prose. The key is the identity.
2. The translation layer is substituted once, in the tier setup file — never per test file.
3. Tests do not import translation resources, and do not depend on where copy is stored.
4. Interpolation is asserted through the key, never by rebuilding the sentence.
5. A test that can only be written by asserting prose is reporting a component that bypassed the
   translation layer. Fix the component.

## Acceptance criteria

1. No test file contains `vi.mock` of the i18n library — `grep` returns nothing. **Not met while the
   setup file carries no double**: a new DOM test then adds its own copy. The move into the setup
   file and the sweep of the existing copies are one task → main skill §8.
2. No test file imports a translation resource file.
3. Every query for an interactive element uses its accessible role or label, with the key as the
   name; prose appears in no assertion.
4. Any assertion on real prose is filed as a component defect, not accommodated in the test.
