# Test factories — one per entity

## The rule

**A test never writes an entity literal. It calls that entity's factory.**

The fluent per-entity factory is the same pattern a server runtime's test factories use, so a
developer crossing between runtimes recognises the shape instead of learning a second one. Keep the
vocabulary identical on both sides on purpose.

## What a per-entity factory owes, and the two properties that are runtime-specific

| property | required here? |
|---|---|
| one factory class per entity | yes |
| constructor seeds valid defaults; `build()` alone is usable | yes |
| a `with…()` per varied field, returning `this` | yes |
| ids from a counter, never hardcoded | yes |
| a static bulk helper for scale cases | yes |
| `build(doInsert)` / an insert helper | no — there is no database on the client, so nothing to insert into |
| an omission form — a field *removed*, not nulled | new here. A runtime that owns its own storage never receives a record with a key missing; the client does, on every permission-restricted read |

## The factory

```ts
// src/test/factories/OrderFactory.ts
let counter = 0;
const nextSequence = () => ++counter;

export class OrderFactory {
  private readonly record: Order;

  // Defaults are all valid on their own — new OrderFactory().build() is a usable record.
  // The counter keeps ids unique inside one run; no hardcoded upstream ids.
  constructor() {
    const sequence = nextSequence();
    this.record = {
      Id: `ord-${sequence}`,
      Name: `ORD-${String(sequence).padStart(4, '0')}`,
      Pkg__Total__c: 100,
      Pkg__Paid__c: 0,
      Pkg__Status__c: 'Open',
      Pkg__Catalog__c: 'cat-1',
      Pkg__Period__c: 'per-1',
    };
  }

  withTotal(value: number): this { this.record.Pkg__Total__c = value; return this; }
  paid(value: number): this { this.record.Pkg__Paid__c = value; return this; }

  // A semantic method, not a field setter — it says what the record IS, and it may touch
  // several fields.
  fullyPaid(): this {
    this.record.Pkg__Paid__c = this.record.Pkg__Total__c;
    this.record.Pkg__Status__c = 'Closed';
    return this;
  }

  // The key comes OUT, and that is the whole point: absent is not null. Axes 3 and 13 both need a
  // record where a field is not there, and a `null` answers a different question. The cast is
  // deliberate — the type says every field is present and the upstream boundary disagrees, which
  // is why axis 3 exists at all.
  without(field: keyof Order): this {
    delete (this.record as Partial<Order>)[field];
    return this;
  }

  // A withheld field arrives with the key stripped, exactly as `without` does. The name is the
  // difference: it says the field exists and this caller may not read it, which is what the case
  // is about.
  hiddenByPermission(field: keyof Order): this {
    return this.without(field);
  }

  // build() returns a COPY. A factory handing out the same object twice lets one case mutate
  // another's data — breaking the very clause the helper exists to uphold.
  build(): Order {
    return { ...this.record };
  }

  // Bulk helper for the scale axis.
  static many(count: number, shape: (f: OrderFactory, index: number) => OrderFactory = (f) => f): Order[] {
    return Array.from({ length: count }, (_, index) => shape(new OrderFactory(), index).build());
  }
}
```

At a call site:

```ts
// The status values the outcome turns on, in the vocabulary the factory seeds.
const OPEN = 'Open';
const CLOSED = 'Closed';
// A total in whole units, so half of it is exact and no rounding enters the case.
const TOTAL = 100;
// Exactly half: the largest payment that must still leave the order open. A `>` written as `>=`
// is what this value catches.
const HALF_OF_TOTAL = 50;

it('leaves the order open when half is paid', () => {
  const order = new OrderFactory().withTotal(TOTAL).paid(HALF_OF_TOTAL).build();

  expect(order.Pkg__Status__c).toBe(OPEN);
});

it('closes the order when the final payment lands', () => {
  const order = new OrderFactory().withTotal(TOTAL).fullyPaid().build();

  expect(order.Pkg__Status__c).toBe(CLOSED);
});

it('refuses to print an amount the query never returned', () => {
  const order = new OrderFactory().without('Pkg__Total__c').build();

  expect(() => formatAmount(order)).toThrow(/not retrieved/);
});
```

**The assertions are built-in on purpose.** The status is asserted twice, and rule 16 promotes a rule
into a matcher only past that; a built-in matcher owes the failure envelope nothing (rule 11), and
the named constant is what carries the reason into the output instead. Run these as written before
shipping a factory: the three cases must pass against it, and `tsc` must be clean.

**The omission form is what makes the absence axis writable.** Without it the two highest-yield axes
of `case-space.md` — absence and a withheld field — can only be reached with a bare literal, which is
exactly what the lint rule below blocks. A string argument is not an object key, so
`without('Pkg__Total__c')` passes that rule: probe it against the block, and both literal forms flag
while both factory calls stay clean.

## Prefer a semantic method over a field setter

A semantic method names a *state of the world*, not a column, and it is allowed to set several fields
to get there.

| weaker | stronger |
|---|---|
| `.paid(100).status('Closed')` | `.fullyPaid()` |
| `.status('Closed').closeDate(d)` | `.closed(d)` |
| `.roles(['manager'])` | `.asManager()` |

A field setter is still fine when the field *is* the point of the case — a boundary case about
`Pkg__Total__c` should say `.withTotal(0)`. The test that reads best names the situation
where a situation exists, and the field where the field is the situation.

## Order of operations — search first, then create

1. **Search for an existing factory** before writing any data-setup code: `src/test/factories/`,
   then `*Factory*` anywhere in `src/`, `server/`, `shared/`. Reuse it; extend it with another
   `with…()` rather than starting a second factory for the same entity.
2. **One factory class per entity, all with the same shape** — so they read alike and chain
   naturally. Never lump two entities into one factory class.
3. **A dedicated folder.** `src/test/factories/`, one file per entity, a barrel `index.ts`.
   If factories already exist elsewhere, propose consolidating them there rather than moving
   them silently.
4. **Every entity the code under test touches gets a factory** — not only the one the assertions
   look at. A collaborator built as a literal is the same defect one level down.

## Rules

1. **One factory class per entity**, named `<Entity>Factory`, in `src/test/factories/`, exported
   through a barrel.
2. **Defaults valid on their own.** `new XFactory().build()` must be usable with no chaining.
   A field with no sensible default means the entity is the wrong unit — split it. The one way to
   leave a field unset is rule 8's omission form, which states absence deliberately instead of
   failing to seed it.
3. **A method per varied field or state, returning `this`.** No options-bag constructor: an
   options bag returns to a fifteen-key literal at the call site, which is the problem being
   solved.
4. **Ids from a module-level counter.** Two records built in one case must not collide.
5. **`build()` copies.** Never hand out the internal record.
6. **No assertions, no test logic inside a factory.** It builds data. A factory that checks
   things is a second, invisible test.
7. **A static bulk helper** where scale cases need one.
8. **An omission form: `without(field)`, and `hiddenByPermission(field)` for the case that means a
   withheld field.** Both **delete** the key rather than setting it to `null` — the distinction
   between absent and null is the axis, so a factory that nulled the field would hand the case the
   wrong input. Two names for one operation is deliberate: the second says why the key is missing,
   and a reader of the case should not have to infer it.

## Making it stick

The levers, and exactly one of them blocks.

**1. Lint — the only enforcement.** A namespaced field key inside an object literal in a test
file is precisely the thing to catch, and ESLint sees it:

```js
// eslint.config.js — an extra block for test files
{
  // `**/*.test.ts` already matches `foo.dom.test.ts`; the marker needs no glob of its own.
  files: ['**/*.test.ts', '**/*.test.tsx'],
  rules: {
    'no-restricted-syntax': ['error',
      // TWO selectors, not one. `key.name` exists on identifier keys only, so a single selector
      // misses `{ 'Pkg__Total__c': 1 }` and `{ ['Pkg__Total__c']: 1 }` — and a record
      // literal in a test usually arrives as a paste of an upstream JSON response, where every
      // key is quoted. `key.value` catches both of those. Probe all three forms; all three flag.
      { selector: "ObjectExpression > Property[key.name=/^Pkg__/]",
        message: 'Build upstream records through a factory in src/test/factories/, not as a literal.' },
      { selector: "ObjectExpression > Property[key.value=/^Pkg__/]",
        message: 'Build upstream records through a factory in src/test/factories/, not as a literal.' },
    ],
  },
}
```

`npm run lint` is already on the pre-push path. The rule is narrow on purpose: it fires on
namespaced upstream fields only, so plain view-model objects in tests stay legal. Factory files
themselves are exempted — they are not `*.test.ts`.

**The block is not in `eslint.config.js` yet.** Until it is, lever 1 does not exist and this page is
levers 2 and 3 — which is exactly the state the last paragraph says does not survive a deadline.

**`src/test/factories/` does not exist, and no test is charged with building it.** The layer is step
2 of the main skill's §8, and the lint block is not armed before it lands, so no developer writing a
test is billed for an infrastructure build. Rule 17 there carries the state.

**A suppression names its reason.** `// eslint-disable-next-line no-restricted-syntax` with no
stated reason is a review finding, because a gate with an undocumented escape is the decoration this
page warns about. With rule 8 above there is almost never a reason to reach for one: the shapes that
used to need a literal — a missing key, a withheld field — are now factory calls.

**2. This skill.** Advisory. It shapes what gets written; it does not stop what got written anyway.

**3. Review.** The criteria below, checked by a human or the review lens.

Levers 2 and 3 alone do not survive a deadline. Lever 1 does.

## Acceptance criteria

**Criteria 1, 2, 3 and 7 are not met while `src/test/factories/` does not exist, and a new test does
not meet them either.** Rule 17 is blocked and its interim governs: a record literal in the test
file, one place per file, marked `// INTERIM rule 17` → main skill §8 step 2. They become checkable
the day that step lands and the lint block is armed.

1. No test file contains an object literal with a `Pkg__`-prefixed key — checked by lint.
2. Every entity used by more than one test file has a factory in `src/test/factories/`.
3. `new XFactory().build()` with no chaining produces a valid record.
4. Every chained call at a call site corresponds to something the case asserts on. A chained
   field the assertions never touch is noise and comes out.
5. `build()` returns a fresh object; two calls never share a reference.
6. Where a state has a name, the factory exposes the state, not the columns behind it.
7. A case about a missing or withheld field builds it with `without()` or `hiddenByPermission()`,
   never with a literal and never by nulling the field.
8. Any `eslint-disable` in a test file names its reason on the same line.
