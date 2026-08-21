# Cover the case space, not the function

## The rule

**A test suite is measured against the space of situations the code can be in, never against
the code's shape.** "This function is covered" is not a claim about correctness. The claim
that matters is: *every situation this contract can be put in has a case that pins what
happens.*

The two goals look similar and produce opposite suites.

| goal | what the author writes | what survives a real defect |
|---|---|---|
| cover the function | one call per branch, asserting the happy value | nothing — the defect lives in a situation nobody enumerated |
| cover the case space | one case per situation the contract admits | the case fails and names the situation |

A suite built for the first goal reaches high coverage and finds nothing. It is the mechanical
consequence of asking "which lines have I not executed" instead of "what can happen here".

## Why the function is the wrong unit

A function's text has a fixed, small number of paths. Its **contract** has many more states,
because the contract spans things the text does not mention:

- the shapes an input can arrive in that the type does not forbid;
- what the dependencies do when they misbehave;
- what must stay true across two calls, not within one;
- what must stay true regardless of ordering, timing, or locale.

Line coverage cannot see any of these. Two calls, twelve inputs and an out-of-order resolution
all execute the same lines.

**The unit of coverage is a situation, and the unit of proof is a case that fails when that
situation is mishandled.**

---

## The derivation method

Do not invent cases by intuition. Derive them by walking a fixed list of axes against the
contract, and for each axis either write a case or write down why the axis does not apply.

Applied to a function, walk: **every input · every output · every effect · every dependency ·
every invariant.** For each, ask the axis questions below.

The list is fixed on purpose. A fixed list is auditable — a reviewer can check that it was
discharged. An intuition cannot be reviewed.

### The axis table

| # | axis | the question | typical defect it catches |
|---|---|---|---|
| 1 | **Cardinality** | 0, 1, 2, many? | code written for "some rows" that divides by length |
| 2 | **Boundary** | the exact edge, and one step either side | off-by-one at a period end; a rounding cliff |
| 3 | **Absence** | absent vs empty vs zero vs null vs `NaN` | four states conflated into one falsy check |
| 4 | **Idempotence** | twice = once? | a second save that doubles a total |
| 5 | **Order** | does input order change the output? | an aggregation that silently depends on row order |
| 6 | **Dependency failure** | the collaborator throws, 403s, times out | a rejection that reaches the user as a blank screen |
| 7 | **Interleaving** | two in flight, resolving out of order | a stale response overwriting a fresh one |
| 8 | **Time and locale** | month end, DST, another timezone, another locale | a date that shifts a day for half the users |
| 9 | **Input immutability** | is the argument mutated? | a shared array reordered under a caller |
| 10 | **Invariant** | what must hold for *all* inputs? | a total that stops equalling the sum of its parts |
| 11 | **Error shape** | does a failure carry the project's envelope? | an error that cannot be displayed or classified |
| 12 | **Scale** | the size the real system produces | a chunk boundary at the upstream's batch limit |
| 13 | **Permission and visibility** | a field the caller may not read, a collection the caller cannot list, a missing grant | a hidden amount rendered as a real zero |

The axes will not all apply to one function. **Three to six usually do**, and stating which do not
is part of the work.

Catalog, period and currency scope are axis 2 in domain form. Rows from the wrong catalog, a closed
period and an amount in the wrong currency are all boundary cases, and they get boundary cases —
not an axis of their own.

---

## The non-standard case classes, worked out

These are the classes that almost never appear in a suite written to cover functions, and they
are where the defects actually are.

### 1. Idempotence — twice must equal once

Any operation that writes, caches, accumulates or toggles has this obligation, and almost none
of them are tested for it. The shape of the case is: apply once, snapshot, apply again, assert
equality with the snapshot.

```ts
it('applying the same delivery twice leaves one set of stock moves, not two', () => {
  const stock = emptyStock();
  applyDelivery(stock, delivery);
  const afterFirst = snapshot(stock);

  applyDelivery(stock, delivery);      // the same delivery, again

  expect(snapshot(stock)).toEqual(afterFirst);
});
```

What it catches that a happy-path test cannot: a retry, a double-click, a re-render, a
re-delivered message. Every one of those is a second call, and the system has no way to tell
it apart from a first call unless the code was written for it.

The negative form matters just as much. If an operation is *deliberately* not idempotent —
appending a line, incrementing a counter — the test says so explicitly, so that a later
"optimisation" that dedupes it breaks a case instead of changing behaviour silently.

### 2. Order independence — shuffle the input, expect the same answer

Aggregations, filters, sorts, reducers and anything that walks a collection carry an implicit
claim: the answer does not depend on the order rows arrived in. The claim is almost never
written down, and floating-point accumulation plus early `break`s and `find`s break it
regularly.

```ts
it('the catalog total is independent of row order', () => {
  const rows = fixtureRows();                    // mixed inbound and outbound rows
  const forward = catalogTotal(rows);
  const reversed = catalogTotal([...rows].reverse());
  const shuffled = catalogTotal(deterministicShuffle(rows));

  expect(reversed).toBe(forward);
  expect(shuffled).toBe(forward);
});
```

Use a **deterministic** shuffle — a fixed permutation, or a seeded generator. A random shuffle
turns a real failure into a flake and gets deleted by the next person.

This case class also catches the opposite bug: a function that *should* respect order — a
running total, a FIFO stock layer — and whose test never proved that it does.

### 3. Absent vs empty vs zero vs null — four states, one careless check

This is the highest-yield axis wherever an upstream answers with sparse records, because such a
boundary produces all four and a single `if (!value)` collapses them.

| state | how it arrives | what it means |
|---|---|---|
| **absent** | the key is not in the response at all | the field was not queried, or permission withheld it — class 6 |
| **null** | the key is present with value `null` | the field exists and is empty |
| **empty** | `''` or `[]` | a real value that happens to be empty |
| **zero** | `0` | a real amount that happens to be nothing |

The four demand different behaviour. An absent `Pkg__Amount__c` means *we do not know* and
the UI must not print a number. A `null` means the person entering it left the field blank. A `0`
is a real zero and must render as `0.00`, not as a dash. Collapsing them produces the two worst
outcomes available: a fabricated zero shown as fact, and a real zero shown as missing data.

```ts
describe('order line amount rendering', () => {
  it('renders 0.00 for a real zero', () => {
    expect(formatAmount(new OrderLineFactory().withAmount(0).build())).toBe('0.00');
  });

  it('renders an em dash for an explicit null', () => {
    expect(formatAmount(new OrderLineFactory().withAmount(null).build())).toBe('—');
  });

  it('throws rather than guessing when the field was never queried', () => {
    // Absent means "not retrieved" — printing anything here invents data. `without()` deletes the
    // key; a null would be the case above, which is a different situation → factories.md rule 8.
    const record = new OrderLineFactory().without('Pkg__Amount__c').build();

    expect(() => formatAmount(record)).toThrow(/not retrieved/);
  });
});
```

The third case is the one that never gets written, and it is the one that stops the UI from
inventing numbers. It is also the case a record literal stops being able to express the day the lint
block is armed: the factory's omission form is what makes the axis writable after that
→ `factories.md`.

### 4. Interleaving — two in flight, the wrong one wins

Any async read that can be triggered twice before the first resolves has an ordering
obligation. The situation is not exotic: a user changes the catalog filter twice quickly, and
the first request — slower, because it asked for more — lands last.

```ts
it('a slow earlier response never overwrites a newer one', async () => {
  const slow = deferred<Rows>();
  const fast = deferred<Rows>();
  client.fetchRows
    .mockReturnValueOnce(slow.promise)     // catalog A, requested first
    .mockReturnValueOnce(fast.promise);    // catalog B, requested second

  const view = new CatalogRowsView(client);
  view.load('catalog-a');
  view.load('catalog-b');

  fast.resolve(rowsFor('catalog-b'));
  await flush();
  slow.resolve(rowsFor('catalog-a'));      // arrives late
  await flush();

  expect(view.rows).toEqual(rowsFor('catalog-b'));
  expect(view.catalogId).toBe('catalog-b');
});
```

Two details make this case real rather than decorative. The promises are **controlled**, not
timed — a test that resolves order with `setTimeout` is a flake. And the assertion is on the
*final* state after the stale arrival, because the bug only shows after the late resolution.

### 5. Invariants over generated input — the property, not the example

Some obligations are not one situation but all of them: a total equals the sum of its parts;
an outbound and an inbound stock row net to zero; formatting then parsing returns the original; a
filter never returns a row the predicate rejects. Enumerating examples for these is endless and
arbitrary. State the property and let a generator attack it: a report total always equals the sum of
its section subtotals, whatever rows it was built from.

What travels with a property is the whole of what this standard says about one. **Pin the seed** —
a floating seed finds a bug on Tuesday, passes on Wednesday and gets deleted on Thursday. And **a
property run is the one legitimate reason a node case exceeds the tier's time budget** (main skill,
rule 24): a couple of hundred runs of a real calculation cost more than tens of milliseconds and
are meant to, so tune the run count down before you assume the slow-test report is wrong →
`execution-tiers.md`.

`fast-check` is not currently a dependency, so no example here would run. Adding it is a decision to
make deliberately, on the modules where an invariant genuinely exists — the `src/lib/pricing`
calculation core — and not across the codebase.

### 6. Permission and visibility — a hidden field is not a value

**On the client, a field the caller may not read arrives as nothing at all.** The upstream strips the
key from the response; a collection the caller cannot list returns an error instead of rows; a
missing grant removes an entry point. None of the three announces itself. The defect class is
therefore the same one every time: the UI treats *withheld* as *empty* and prints a number, a dash or
an empty grid as though it were fact.

That is the highest-yield axis in a permissioned product, and it is invisible unless a
case asks for it.

```ts
import { REASONS } from '@shared/errors/reasons';

describe('order summary under a withheld field', () => {
  it('reports the amount as withheld when permission stripped the field', () => {
    // Setup — the response permission produces: the record is readable, the amount key is gone.
    // `hiddenByPermission` deletes the key and says why → factories.md rule 8.
    const record = new OrderLineFactory().hiddenByPermission('Pkg__Amount__c').build();

    // Exercise + Verify — withheld is its own outcome, distinct from null and from 0.
    expect(summarise(record).amount).toEqual({ status: 'withheld' });
  });

  it('surfaces the failure instead of an empty list when the collection is unreadable', async () => {
    // Setup — a query against a collection the caller cannot list answers with an unresolved-name
    // error, which the transport's `errorReason` maps to UNKNOWN_FIELD, not to a denial.
    const client = installFakeDataClient();
    client.failQueryWith(REASONS.UNKNOWN_FIELD);

    // Exercise + Verify — an empty grid would tell the user there are no rows.
    await expect(loadOrderLines()).rejects.toFailWith(REASONS.UNKNOWN_FIELD);
  });
});
```

**Pin the reason the envelope really carries, not the one the situation suggests.** Neither of the
two cases above is a denial, and both look like one. **Some upstreams refuse to distinguish a field
hidden by permission from a field that does not exist, and answer both with the same
unresolved-name error** — saying which it was would itself leak the schema. An unreadable collection
comes back the same way. Both match the same unresolved-name branch of the transport's
`errorReason` and both map to an invalid-argument reason on purpose. A case asserting
`PERMISSION_DENIED` for either would be wrong about the product, not just about the code.

A denial reason means the upstream stated the denial outright — an insufficient-access code, or a
field mask that names what it withheld. Read `errorReason` and assert what it returns for the path
your case actually drives.

The rules that come out of this axis are worth stating separately from the cases:

| the situation | what must never happen |
|---|---|
| a field stripped by permission | rendered as `0`, as blank, or as an em dash — all three read as data |
| a collection the caller cannot list | an empty result presented as "no records" |
| a missing grant on an entry point | a silent no-op; the failure carries the project's error envelope, axis 11 |

A runtime that has a user context tests this axis by running as a restricted user. On the client
there is no user context to run as — the boundary is what the transport returns — so the case is
written at the seam instead, with a fake that answers the way a restricted upstream does.

---

## The rest, stated briefly

**Dependency failure with a specified shape.** Asserting `await expect(fn()).rejects.toThrow()`
proves only that something went wrong. The contract is *which* failure a caller sees: this
project's error envelope, with a code a caller can branch on. A test that does not pin the code
lets the envelope change without notice.

**Input immutability.** One extra assertion, almost never present: after the call, the argument
is unchanged. `expect(rows).toEqual(rowsBefore)`. Catches an in-place `sort()` on an array the
caller still owns — a defect that surfaces three components away from its cause.

**Scale at the real boundary.** Not "a big array", but the size the real system produces: the
chunk size a bulk operation splits on, the row count at which a grid switches strategy, the batch
limit the upstream imposes on a composite request. Test *at* the boundary and one past it.

---

## Anti-patterns this rule exists to kill

| pattern | why it is worthless |
|---|---|
| **one happy path per function** | the suite's shape mirrors the source tree; every defect lives in the space between the paths |
| **the mirror test** | the test restates the implementation, so it changes whenever the implementation changes and never when the behaviour breaks |
| **the tautology** | `expect(mock).toHaveBeenCalled()` after arranging for the mock to be called — the test asserts a property of the test |
| **coverage-driven case selection** | cases are chosen to turn lines green, so the situations that share a line with an already-covered one are never written |
| **the smoke test as the only test** | `render(<Card />)` with no assertion: full coverage, zero behaviour pinned |

---

## Acceptance criteria

Checkable, and this is the point — a reviewer verifies discharge of a fixed list rather than
forming an opinion.

1. **The axis list is discharged, in one comment line.** For each public function or contract
   changed, the test file covers the applicable axes from the table above, and **one** comment at
   the top of the file names the skipped ones with the reason they share —
   `// axes 4,5,7,9 n/a: pure formatter, one sync call, no argument retained`. A reason per axis is
   required only where the reasons differ. An undischarged axis with no note is an incomplete test,
   reviewable as such; an eight-line justification block is the form that stops being written.
2. **At least one case is not a happy path.** A suite for a non-trivial contract whose every
   case is a success path has not looked at the case space.
3. **Every case names its situation in the title.** "returns the total" is a value; "sums to
   the same total when rows arrive in reverse order" is a situation. The title is where the
   case space becomes readable.
4. **Absence, null, empty and zero are distinguished** wherever the contract can receive more
   than one of them — and a field withheld by permission is distinguished from all four.
5. **Non-determinism is pinned.** Seeds fixed, promises controlled, clocks faked. A case that
   can flake will be deleted, so it does not count as coverage.
6. **A surviving mutant is treated as a missing case, not as a missing assertion.** This is the
   mechanical check on this whole rule: the mutation run changes a line, and if nothing fails,
   some situation was never enumerated. Go back to the axis table and find which one.
7. **A case about a field that is absent or withheld builds its record with the factory's omission
   form**, never with a literal → `factories.md`. **Once the factory exists.** `src/test/factories/`
   does not, so rule 17's interim governs until it does: the case deletes the key from a record
   literal, in one place per file, marked `// INTERIM rule 17` → main skill, §8.

Criterion 6 of this page is what connects it to the mutation gate — rule 22 of the main skill. Mutation score is not a separate
quality metric bolted on the side — **it is the only automated measurement of whether the case
space was covered.** Coverage measures the function. Mutation measures the situations.
