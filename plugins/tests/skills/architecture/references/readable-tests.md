# A test reads as an open book

## The rule

**A test states the rule it defends, not the encoding of that rule.** A reader who does not know
the implementation must be able to read the case and say what the system promises.

The difference is one line:

```ts
// encodes the rule
expect(user.roles).toContain('manager');
expect(user.permissions & 0b0100).toBeTruthy();

// states the rule
expect(user).toBeAllowedToDelete();
```

Both pass today. They part company the moment the rule changes — a manager loses delete rights,
a permission flag is added, roles move behind an API. The first form has that rule copied into
every test that touched it; the second has it in one place.

This is not about elegance. **A rule spread across forty assertions cannot be changed; it can
only be broken.**

---

## The tools, in order of preference

### 1. A custom matcher — when the assertion is reused and must fail well

```ts
// src/test/matchers/access.ts
import { failure } from './envelope';

expect.extend({
  toBeAllowedToDelete(received: User) {
    const pass = canDelete(received);
    return {
      pass,
      message: failure({
        subject: received.name,
        // Both branches: `.not.toBeAllowedToDelete()` fails through the negated wording.
        expectation: pass ? 'the user is NOT allowed to delete' : 'the user is allowed to delete',
        actual: pass ? 'allowed' : 'not allowed',
        deciding: { roles: received.roles },
        matcher: 'toBeAllowedToDelete',
        // A locator names a module that exists — check yours resolves
        // → `failure-envelope.md` rule 3.
        locator: { rule: 'src/lib/access/canDelete.ts', function: 'canDelete' },
      }),
    };
  },
});
```

**The message goes through `failure()`, and there is no prose alternative.** Main skill rule 11
requires the eight-field envelope of every custom matcher, today included — the shared writer is
blocked, the fields are not. A prose `message()` here would be the version that gets copied
→ `failure-envelope.md`.

```ts
declare module 'vitest' {
  interface Matchers<T = unknown> {
    toBeAllowedToDelete(): T;
  }
}
```

Why a matcher and not a plain function: the `message()` callback. It produces a failure that
names the situation *and* dumps the state that caused it, so the red line is readable without
opening the test. A bare helper function loses that — and it also swallows the assertion's line
number, which is the second reason to prefer a matcher.

**Register it per project.** Matchers live in a setup file, and setup files are per project. The
`node` tier therefore needs its own small setup file for domain matchers — it is not
setup-free once this pattern is adopted. The `dom` tier's `vitest.setup.ts` already uses exactly
this shape for `jest-dom`, including the `declare module 'vitest'` augmentation.

### 2. A named assertion helper — when it is used two or three times and failure detail is cheap

```ts
const expectNetsToZero = (moves: StockMove[]) => {
  const outbound = sum(moves, (m) => m.Pkg__Outbound__c ?? 0);
  const inbound = sum(moves, (m) => m.Pkg__Inbound__c ?? 0);
  expect(outbound).toBeCloseTo(inbound, 2);
};
```

Keep it **thin** — one or two assertions. A helper wrapping eight assertions turns eight
distinct failures into one, which breaks the "one reason to fail" clause of the contract.

### 3. A data builder — so the case shows only what matters

```ts
const order = anOrder().withTotal(100).paid(50).build();
```

versus

```ts
const order = {
  Id: 'ord-0001', Name: 'ORD-0001', Pkg__Total__c: 100,
  Pkg__Paid__c: 50, Pkg__Status__c: 'Open', Pkg__Catalog__c: 'cat-1',
  Pkg__Period__c: 'per-1', /* … eleven more fields … */
};
```

The second form buries the two numbers the case is about under fifteen that it is not. The
builder carries sensible defaults, and **what the test overrides is exactly what the test is
about** — the reader can see the situation without filtering.

This is the same pattern as the per-entity fluent factories of `factories.md`. Reuse that
vocabulary rather than inventing a second one.

---

## Naming the case

The title is the sentence a reader gets for free. Compress given/when/then into one line and put
the *situation* in it:

| weak | states |
|---|---|
| `it('works')` | nothing |
| `it('returns true')` | a value |
| `it('closes the order when the final payment lands')` | a situation and its outcome |
| `it('leaves the order open when the payment is one cent short')` | the boundary it defends |

A title that mentions a private function name is describing the implementation and will lie
after the next rename.

---

## Named constants — and the comment says WHY

**Every literal the case's outcome depends on is a named constant. The name says what it is; the
comment says why that value was chosen.**

A number nobody can explain is a hole in the story, and the hole is usually where the case's
whole point was hiding:

```ts
// useless — restates the value
const HALF = 50;                 // 50, half of the total

// useful — states why this value and not another
// Exactly half: a second payment of the same size must close the order with no remainder.
const HALF_OF_TOTAL = 50;

// The largest payment that must still leave the order open. One cent below the total —
// if the comparison is `>` instead of `>=`, or rounds up, this is the value that shows it.
const ONE_CENT_SHORT = 99.99;

// Three instalments that reach the total only because the last carries the trailing cent.
// The classic float-accumulation trap: 33.33 * 3 = 99.99, never 100.
const UNEVEN_THIRDS = [33.33, 33.33, 33.34];

// Money is compared to the cent — two decimals, never a bare toBe on a float sum.
const CENT_PRECISION = 2;
```

The side effect is the reason this is a rule rather than a preference: **the constants become the
index of which axis each case defends.** `ONE_CENT_SHORT` explains the `>` versus `>=` boundary
before the reader reaches an assertion, and a reviewer can see from the constant block alone
whether the case space was walked or a single happy path was written five times.

`0`, `1` and `''` are exempt because naming them adds noise, not meaning. **So is any identifier of
an element or a message** — a translation key, an ARIA role, a test id. Those name what the case
talks to, not the value it turns on, and a component test is written almost entirely out of them
→ `component-tests.md` and `copy-and-i18n.md`. A magic value the outcome depends on is not exempt: a
status, an enumerated value, a route or an error code all get names.

**A named-row `it.each` table is the other exemption, and it is a rule rather than an
inconsistency.** The `why` column does the comment's job for every value in the row — the reason sits
beside the value and lands in the generated title — so the row's input and expected value need no
separate constants. The table below is the model, and its inline `1234.5` is deliberate.

## Many inputs, one rule — the table form

When one rule is exercised across several inputs, use `it.each` with **named rows carrying a `why`
column**. Never a table of bare tuples.

```ts
it.each([
  { input: 0,      expected: '0.00',     why: 'a real zero is data the user must see, not a blank' },
  { input: null,   expected: '—',        why: 'null means the person entering it left the field empty' },
  { input: 1234.5, expected: '1,234.50', why: 'one decimal in, two out — padding must not lose the grouping' },
])('renders $expected when the amount is $input — $why', ({ input, expected }) => {
  expect(formatAmount(input)).toBe(expected);
});
```

The `why` column is what makes a table legal here. A tuple table
(`[[0, '0.00'], [null, '—']]`) is shorter and destroys the rule that every value carries its
reason — the reason has nowhere to live, and the generated title describes the input instead of the
situation. With named rows the reason survives as data and lands in the case title, where the
reader sees it in the run output.

**One mechanical limit, not a competing option.** A row can only share the table's assertion shape.
An input whose outcome is a different *kind* — a throw instead of a value — cannot be a row, and
gets its own `it`:

```ts
it('throws when the amount field was never retrieved', () => {
  // Absent is not null and not zero: printing anything here would invent data.
  expect(() => formatAmount(undefined)).toThrow(/was not retrieved/);
});
```

## What this rule forbids

| pattern | why |
|---|---|
| the assertion that copies the rule's encoding | the rule cannot be changed in one place |
| a fat helper with many assertions | one red line for many different failures |
| a helper with no failure message | the reader must open the helper to learn what broke |
| a fixture object with twenty irrelevant fields | the situation is invisible |
| `it.each` over bare tuples | every value loses its reason, and the title describes the input instead of the situation |
| a title naming a private function | it lies after the next rename |

---

## Acceptance criteria

**Most of this page is a rule of the main skill, and its state and its check live there, not here.**
The title is rule 1, the economy of expression is rule 16, the envelope is rule 11, and the named
constant, its `why` comment and the named-row `it.each` table are all rule 12 — one rule, one row,
including the check that greps for the tuple form. This page owns the shape those rules take; §5 owns
whether they are in force.

These criteria are this page's own:

1. A reader who has not seen the implementation can state, from the test alone, what the system
   promises.
2. A fixture shows only the fields the case is about; the rest come from a builder's defaults.
