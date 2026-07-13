# CICERO — before / after on one real question

The same coding question, answered twice: once by vanilla Claude, once with the
CICERO output style active. Both answers are **real transcripts**, not mock-ups.

The point of the example is honest: CICERO does **not** make the model *more correct*
— both answers reach the same architecture (idempotency table + OCC + transactional
outbox). CICERO changes the *delivery*: verdict first, jargon glossed, far shorter,
readable in one pass. The visible height difference between the two columns below is
the whole pitch.

## The question

> In a high-throughput Node.js service with horizontal autoscaling and at-least-once
> webhook delivery, should I use a Redis-backed distributed lock (Redlock) or optimistic
> concurrency control with a version column to make idempotent event processing safe
> against double-processing? Assume the handler is not referentially transparent.

## Side by side

<table>
<tr>
<th width="50%">Vanilla Claude</th>
<th width="50%">With CICERO</th>
</tr>
<tr valign="top">
<td>

**Short answer:** neither — at least not as the only mechanism. The right defence
against double-processing here is an idempotency table (dedup) keyed by event ID + OCC
on the state transitions. Of the two you named, Redlock is the worse choice. Here's why.

**Why this isn't "lock vs OCC"**

You framed this as a choice of mutual-exclusion mechanism, but the real problem isn't
concurrency — it's deduplication of at-least-once delivery. Those are different jobs:

- Mutual exclusion guards against *simultaneous* processing.
- Deduplication guards against *repeat* processing (including minutes later, when no
  lock exists anymore).

At-least-once gives you both, but the second is dominant, and a lock cannot close it: a
duplicate can arrive after the lock is released.

**Against Redlock (the deciding argument)**

Redlock is not a safety mechanism. This is Kleppmann's critique and it's exactly your case:

1. The lock can expire mid-processing — a GC pause, stop-the-world, network delay — the
   TTL lapses, a second instance takes the lock while the first is still "inside". Double
   processing under a formally valid lock.
2. The only cure is fencing tokens (a monotonic counter the protected resource checks and
   rejects when stale). But for the resource to check a fencing token it needs… a version
   column and a conditional write. So you arrive at OCC anyway — just with an extra
   external dependency (Redis), an extra failure mode, and a false sense of safety.

Plus the operational cost: another stateful component in the hot path, its own timeouts,
clock drift between nodes, degradation under network partitions.

**Why OCC + version column is the right base**

OCC pushes the atomicity guarantee into the datastore — the single source of truth. Two
instances read version = N, both write `UPDATE ... SET version = N+1 WHERE id = ? AND
version = N` — exactly one commits, the other gets 0 rows and rolls back. A real safety
guarantee at commit time, no external moving parts, no expired-TTL problem.

**But OCC alone isn't enough — the handler isn't referentially transparent**

Your side-effect caveat is critical here. OCC only protects the DB row. If the handler
calls an external API / sends mail first and then hits an OCC conflict at commit, the
effect already leaked. So you need three layers:

1. Idempotency table: `INSERT event_id` with a unique constraint as the first step. A
   duplicate → constraint violation → exit quietly. This is the main line of defence
   against at-least-once, and it works regardless of the gap between duplicates.
2. OCC on the state transition — atomicity and protection against lost updates on a race.
3. Make side effects idempotent or transactional:
   - external calls — pass your own idempotency key downstream (Stripe-style
     `Idempotency-Key`) so a duplicate collapses on their side;
   - what can't be made idempotent — via a transactional outbox: write the intent in the
     same transaction as the state transition, and a dispatcher sends the effect off the
     committed state, marking the send in the dedup table.

In practice: split the handler into decide (reads state, pure) and act (effects). Then an
OCC conflict rolls back decide without a leak, and act is guarded by an idempotency key
downstream.

**Recommendation**

- Base: idempotency table (event ID, unique) + OCC version column. Enough for
  "effectively-once" correctness at the DB-state level.
- Redlock — only to cut wasted work (an expensive handler you don't want two instances to
  run, knowing one rolls back on OCC). Then the lock is a throughput optimization over
  OCC, not a replacement, and its incorrectness doesn't affect safety.
- External effects are closed by an idempotency key downstream or an outbox — the piece
  that neither Redlock nor OCC solves, and which in your setup (non-referentially-
  transparent handler) is the real risk.

If you'd like, I can sketch the table schema (dedup + outbox) and handler pseudocode with
these three layers.

</td>
<td>

**Neither Redlock nor the version column alone. The root is idempotency-key dedup**
*(a table of processed `event_id`s with a unique constraint; the repeat insert fails →
the effect applies once)*.

- **Redlock** *(a distributed lock over Redis)* — not for correctness. On a GC pause
  *(process stalled by the garbage collector)* the lock's TTL lapses, a second instance
  enters — double processing under a formally live lock. Only fencing tokens
  *(a monotonic counter; the resource rejects stale ones)* fix it, and checking those
  needs a version column anyway. So Redlock is at most an optimization "don't run the
  expensive handler twice", never a guarantee.
- **OCC** *(optimistic concurrency control — don't lock the row; at write time check
  `WHERE version = N`; exactly one commits)* — a real DB-level guarantee, no external
  moving parts.
- **at-least-once** *(deliver "at least once" → duplicates are inevitable)* hits repeat
  processing minutes later, when no lock exists — a lock can't close that. The dedup
  table can.
- **The handler is not referentially transparent** *(it has side effects — mail, an
  external call)* — this decides it. OCC guards only the row; a side effect outside the
  transaction repeats on retry. You need a **transactional outbox** *(write the intent in
  the same transaction as the state transition; a separate worker emits it off the
  committed state)*.

**Verdict:** idempotency table + OCC + an outbox for side effects. The Redis lock is
optional — only against wasted work, never as the safety guarantee.

</td>
</tr>
</table>

## What CICERO changed (delivery, not substance)

| Rule | Vanilla | With CICERO |
|------|---------|-------------|
| **1 · Answer first** | verdict lives in a "Recommendation" section at the very bottom | verdict is the first sentence |
| **2 · Size to ask** | ~600 words, six headed sections | ~200 words, one list |
| **3 · Gloss** | Redlock, OCC, fencing tokens, at-least-once used raw | each glossed in-line on first use |
| **4 · Recommend, don't survey** | lays out the full analysis, then recommends | leads with the pick, detail follows |
| **0 · Readable first** | nested sub-lists and cross-references | flat points, one idea each |

Same conclusion, a third of the length, and you know the answer from line one.

---

# A second, everyday question

The first example is a hard architecture question. But the same effect shows up on the
small, ordinary questions you ask a dozen times a day — where a long answer is the more
expensive kind, because it taxes you every single time.

## The question

> Is it bad practice to use `any` in TypeScript?

## Side by side

<table>
<tr>
<th width="50%">Vanilla Claude</th>
<th width="50%">With CICERO</th>
</tr>
<tr valign="top">
<td>

**Short answer:** yes, `any` is generally bad practice — but it's a tool with a few
legitimate uses. The problem is what it does, not that it exists.

**Why it's discouraged**

`any` doesn't mean "any type" — it means "turn off type checking here." It's contagious
and silent:

```ts
const data: any = JSON.parse(input);
data.foo.bar.baz;        // no error, even if it explodes at runtime
const n: number = data;  // no error — `any` flows into a typed slot silently
data.toUpperCase() * 2;  // no error
```

Once a value is `any`, everything it touches loses type safety too. You lose autocomplete,
refactoring safety, and the compiler's ability to catch real bugs — which is the whole
reason to use TypeScript.

**What to use instead**

- `unknown` — the safe counterpart to `any`. Accepts anything, but forces you to narrow
  before use:

```ts
const data: unknown = JSON.parse(input);
if (typeof data === "object" && data && "foo" in data) { /* now safe */ }
```

- Generics — when a function works over many types but should preserve them:

```ts
function first<T>(arr: T[]): T | undefined { return arr[0]; }
```

- Proper types / interfaces — model the shape instead of opting out.
- Union types (`string | number`), `Record<string, T>`, etc.

**When `any` is actually OK**

- Migrating a large JS codebase to TS incrementally.
- Genuinely dynamic boundaries where typing is impractical, and you narrow immediately after.
- Quick prototypes / tests where safety doesn't matter yet.
- Escaping a wrong or overly strict third-party type, as a localized, commented escape hatch.

**Practical guardrails**

- Turn on `noImplicitAny` (part of `strict`) so `any` must be written, never silently inferred.
- Prefer `unknown` as your default "I don't know the type yet."
- Consider the ESLint rule `@typescript-eslint/no-explicit-any` to force each use to be justified.

Rule of thumb: reach for `unknown`, and if you type `any`, treat it as a deliberate,
commented exception — not the default.

</td>
<td>

Yes — `any` disables type-checking on that value, so it silently defeats the reason you're
using TypeScript. Every property access and call on an `any` becomes unchecked.

**Use instead:**

- `unknown` *(the safe counterpart — accepts anything, but forces a check before use)* when
  you truly don't know the type.
- A real type or generic when you do.

**When `any` is fine:** quick migration of old JS, or a genuinely dynamic boundary you'll
validate at runtime anyway. Turn on `noImplicitAny` so it's always a deliberate choice,
never an accident.

</td>
</tr>
</table>

## The overall feel

This isn't a claim that CICERO is "smarter" — on both questions the two answers agree.
It's about what the answer is like to *live with*:

- **The verdict comes first.** You learn the decision on line one, then read further only
  if you want the reasoning — instead of scrolling to the bottom to find out what to do.
- **There's less to hold in your head.** One idea per point, no nested cross-references. The
  shorter answer isn't missing anything here; it just doesn't make you carry what you
  didn't ask for.
- **Terms are explained as they arrive.** `unknown`, `noImplicitAny` — glossed in passing,
  so you're never quietly assumed to already know.
- **It's gentler with your attention and your codebase.** It sizes the reply to the size of
  the question, and on a risky request it pushes back before acting rather than racing
  ahead.

The pitch is quiet on purpose: not dramatically better, just easier — lower cognitive load,
and more considerate of the person on the other side of the screen.
