# What not to test

## Why this page exists

Everything else in this standard pushes toward more: an axis list, a case per axis, a factory per
entity, a matcher per rule. Read literally and without a counterweight, it licenses a suite that
doubles in size and slows every push while proving nothing new.

**A test that cannot fail for a reason you care about is a liability, not coverage.** It costs run
time on every push, it has to be updated by every refactor, and it dilutes the signal of the tests
that do earn their place. Deleting one is a gain.

## The test that should not exist

| do not test | why | what to do instead |
|---|---|---|
| a barrel / `index.ts` re-export | it has no behaviour; the compiler already checks it resolves | nothing |
| a trivial getter or a one-line pass-through | it cannot be wrong in a way a caller would notice | nothing |
| a type or an interface | `tsc` is the test, and it runs on every push | nothing |
| a library's own behaviour | react-i18next, a grid library and TanStack Query have their own suites; asserting them tests someone else's code and breaks on their upgrades | test *your* usage: the props you pass, the state you keep |
| a constant | asserting `TAX_RATE === 0.2` restates the source file | nothing |
| markup with no logic — a purely presentational component | there is no behaviour to pin; a render test asserts that JSX is JSX | a Storybook story, which is where appearance belongs |
| a private function reached only through the module | it is an implementation detail; testing it freezes the shape of the code | test through the public entry point |
| framework wiring — that a provider provides, that a route routes | it fails loudly the first time anything runs | nothing |
| an error path that cannot be produced — a guard on an impossible enum value | it cannot be reached, so the case cannot be written honestly | `/* v8 ignore */` with the reason |

## Snapshots

**Forbidden as a substitute for an assertion.** The rule is absolute and takes no exception from
what a tree currently contains: existing snapshots are a repo defect to file and clear. Check with
`grep -rn "toMatchSnapshot" src server shared scripts`.

A file snapshot answers "did the output change" — never "is the output right". It goes green on
first run, whatever the output was, and every legitimate change produces a diff nobody reads before
accepting. It is coverage with the assertion removed, which is the exact failure this standard exists
to prevent.

The narrow exception: `toMatchInlineSnapshot` for a **small serialized contract** — a generated
query string, a formatted envelope — where the value is short enough to read in the diff and the
assertion genuinely is "this exact text". Inline, so a reviewer sees it in the PR; never a
`__snapshots__` file.

## Storybook and component tests do different jobs

A repository that requires a story for every component is not doing duplicate work, because the two
answer different questions — but only if the boundary is kept.

| | Storybook story | component test |
|---|---|---|
| answers | what does it **look like**, in each state | what does it **do**, when acted on |
| covers | variants, sizes, empty / loading / error appearance, responsive behaviour, a11y addon | interaction, the callback contract, conditional rendering that depends on logic |
| the reader | a human eye, and the a11y addon | CI |

So: **appearance goes in the story, behaviour goes in the test.** A purely presentational component
gets a story and no test. A component with logic gets both, and its test does not re-assert what the
story already shows.

Do not import `storybook/test` into a unit test → `component-tests.md`.

## The honest exemption

When you decide a unit does not need a test, **say so where it can be seen** — the review lens
requires the same thing of itself. A one-line comment at the top of the module, or a note in the PR:

```ts
// No test: pure re-export. Behaviour lives in ./applyPayment, which is tested.
```

A silent exemption and a forgotten test look identical six months later. One line makes them
distinguishable.

## Acceptance criteria

1. No test file exists for a barrel, a constants module, or a type-only module.
2. No test asserts a third-party library's own behaviour rather than our usage of it.
3. No `toMatchSnapshot`. Any `toMatchInlineSnapshot` covers a short serialized contract and is
   readable in the diff.
4. A purely presentational component has a story and no test.
5. Every deliberate exemption is recorded in a comment or the PR, naming the reason.
6. A test deleted for being unfalsifiable does not need a replacement — but the reason is recorded
   in the PR, and stays recorded while the coverage ratchet, the mutation gate and the auditor are
   unarmed. Deletion is this standard's one fully in-force permission, and the checks on it are the
   parts that do not run yet → main skill, the flake policy.
