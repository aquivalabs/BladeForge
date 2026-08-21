# Coverage gate

## State today

**Armed.** `@vitest/coverage-v8` is installed, `vite.config.ts` carries the coverage block and the
thresholds, and `--coverage` rides the CI unit-test step. The baseline is whatever this repository
measures, and a locally measured one is provisional until the first CI run confirms it.

## What coverage does and does not answer

Coverage answers one question: **was this line executed while the suite ran.** It says nothing
about whether anything was asserted. The canonical failure is a component test with no
assertion:

```tsx
it('renders', () => {
  render(<Card total={100} />);   // full coverage of Card, zero assertions
});
```

The line is covered, the behaviour is unverified, and the metric reports success. This is why
a coverage percentage makes a poor gate on its own: it is easy to raise without improving
anything, so a target invites gaming rather than testing. Pair it with the mutation gate,
which answers the second question — would any test notice if the line were wrong.

Coverage is still worth having. It is cheap, it runs on every push, and it reliably finds the
*absence* of a test. Treat it as a floor detector, not as a quality score.

## Setup

Coverage is root-only in Vitest — it cannot be declared per project. One block in
`vite.config.ts`, outside `projects`:

```ts
test: {
  coverage: {
    provider: 'v8',
    include: ['src/**/*.{ts,tsx}', 'server/**/*.ts', 'shared/**/*.ts'],
    exclude: ['**/*.test.*', '**/*.stories.*', '**/index.ts', 'src/test/**'],
    reporter: ['text-summary', 'html'],
    thresholds: {
      // The ratchet: a cap on uncovered lines, so the number can only be lowered. The number is
      // this repository's own measured baseline plus the headroom below — never one copied from
      // somewhere else. `npx vitest run --coverage` prints it.
      // Deliberately -1, which fails on the first run. A template that shipped a plausible
      // number would be a number nobody derived, and that is the one thing a ratchet forbids.
      lines: -1,
      // The absolute floor, paired with the mutation bar. Not a target: it exists so a collapse
      // cannot pass unnoticed.
      statements: 70,
      // The pure calculation core, held tighter than the repo-wide number.
      'src/lib/pricing/**': { lines: -1 },
    },
  },
  projects: [ /* … */ ],
}
```

`index.ts` barrel files are excluded because they contain only re-exports; counting them
inflates the number without covering any behaviour. `scripts/**` is outside `include` deliberately.

**`src/test/**` is excluded before the directory exists, and that is not premature.** Test
infrastructure is not product code. The factory task creates `src/test/` with factories, a barrel and
`renderWithProviders.tsx` → main skill §8 step 2; those files match `src/**/*.{ts,tsx}` and do **not**
match `**/*.test.*`, so without this line they would land in the denominator and a partly-exercised
helper would turn the factory branch red for a reason with nothing to do with it. A glob matching no
file is inert, so nothing waits on that task.

## Two mechanisms, not one: a ratchet and an absolute floor

They answer different questions and each is blind to the other's case.

| mechanism | catches |
|---|---|
| the ratchet, in uncovered lines | slow erosion — a change that adds code and no test |
| the absolute floor, **70 % of lines** | a collapse the ratchet would tolerate if it were ever loosened |

The floor is not a target. It is the number below which the suite stops meaning anything, and it
should already be met with room the day it lands. So the floor is not there to be reached, it is there
so a bad day cannot go unnoticed.

**And the floor is meaningless on its own** — that is the reason it comes paired. A 70 % floor is
satisfiable by tests that execute code and assert nothing, which is the failure this whole standard
exists to prevent. What makes the number mean something is the mutation bar it is paired with: the
target is **fewer than 10 % of mutants surviving**. Coverage says the line ran; the mutation score says
a test would have noticed it being wrong. Either number alone is decoration.

## Use a ratchet, not a percentage floor

A percentage floor has two failure modes: it blocks a large honest change that happens to add
uncovered lines, and it stays satisfied while coverage quietly erodes elsewhere. A negative
threshold caps the **number of uncovered lines** instead, so the number can only be lowered.

Per-glob thresholds do not inherit the global ones. A glob entry declares its own set in full.

**Both halves must be seen to fire, and that is a step rather than an assumption.** Tighten `lines`
temporarily, one below the measured figure, and run: the run exits 1 with
`ERROR: Uncovered lines (N) exceed global threshold (M)`. The message names the metric the ratchet is
about. Do the same for the per-glob half. A gate nobody has seen refuse is not a gate.

### Taking the baseline

`npx vitest run --coverage`, with every environment variable the suite's own gates read, so the
database-backed files run rather than skip. Record, per scope: lines covered, lines total, uncovered,
and the percentage. Record the repo-wide scope and each scope that gets its own glob threshold.

Record what coverage cost the suite too — the provider is not free, and the difference between a run
with `--coverage` and one without is the number that decides whether it can ever ride the pre-push
hook. It cannot.

**Key the ratchet on lines, and check that choice rather than inheriting it.** Run the full coverage
twice, unchanged, and compare all four metrics. `Lines` and `Statements` should return identical
totals; `Branches` and `Functions` can move between otherwise identical runs, and a branch-keyed
ratchet built on that flakes locally before it ever reaches CI.

### The headroom, and what it is actually covering

Headroom is **1 % of the instrumented line total, rounded up to the next fifty**, added to the
measured uncovered count.

It is **not** sized to observed variance, and saying so matters: local variance in lines is normally
zero, so there is nothing to size against. It is sized to an **unquantified cross-runner
difference** — CI runs a different Node, a different OS image and services this machine cannot
reproduce, and v8 line attribution is a property of the whole run. Nobody has measured what that does
to the total, and headroom presented as covering a measured swing would be a fiction.

**The cost, stated plainly.** Until the first CI run tightens it, the gate tolerates new uncovered
lines up to the headroom. That is the price of not blocking the pipeline on a number nobody has
measured where it will be enforced, and it is a one-way trade only if the tightening never happens.

### Provenance: a local baseline is provisional

A local run is a legitimate baseline only if it runs the same files CI does. Check that before
trusting it: if the suite's database gate reads a live connection string from the environment, those
files ran, and the residual difference is the runner rather than the file set. A file gated on
credentials nobody has locally is skipped in both places and changes nothing.

A CI-first baseline can be structurally unavailable: a workflow that triggers on pull requests only
produces no number until a PR exists, and the push that opens the PR may itself need the review
attestation. Inverting a branch's own order for one figure is not worth it.

**So: the local threshold lands with the stated headroom, and the first CI coverage run is the
confirmation.**

| what CI reports | the move |
|---|---|
| **fewer** uncovered than the local baseline | lower both thresholds to CI's number plus the same 1 %, on this branch |
| **more**, but still inside the threshold | the gate passes. Tighten to CI's number plus headroom anyway, before merge |
| **more than the threshold** | the threshold may be corrected upward **once**, before the first merge, and the commit message says what CI measured. After merge the only-lower rule binds absolutely |

### Rollback — the one change here git cannot undo

Every other change is content: revert it and the tree is as it was. A threshold fails as a **blocked
pipeline**, and a pipeline is policy. So the undo is written down before the gate is trusted.

| symptom | the move | whose call |
|---|---|---|
| CI coverage red before merge, not a real regression | correct upward once, per the table above | the builder, on this branch |
| CI coverage red after merge, and it is a real regression | cover the lines. Raise nothing | the author of the regressing change |
| CI coverage red after merge, cause unknown, the default branch blocked | remove `--coverage` from the unit-test step in a one-line commit, and file the re-arm the same day | **a person** — this disarms a gate |
| the threshold is wrong in principle | revert the threshold lines only, leaving the coverage block and the CI flag, so measurement continues without enforcement | **a person** — same reason |

**Raising a merged threshold is not on that list.** It is the one move the ratchet forbids. The escape
that does not weaken the gate is disarming measurement visibly rather than loosening the number
quietly.

## Where the gate lives

**On CI, on the full run, and nowhere else.**

| where | coverage | why |
|---|---|---|
| pre-push | never | the hook passes no coverage flag, and it should not: the provider costs minutes, and the ratchet's number would be measured on a run with no database |
| CI, after the suite | yes | the only run that executes everything, so the only run whose number means anything |

**The step is `--coverage` on the existing unit-test step**, not a job of its own: a second job
would run the whole suite twice for one number. It lands in the same change that sets the thresholds —
a threshold with no run and a run with no threshold are each half a gate.

**The pre-push hook does not change, and its scope is not this page's to decide.** It runs
`npx vitest run` — the whole suite, no coverage flag — and keeps doing exactly that. Whether it
should run a delta is a separate question, filed separately.

**What this gate cannot answer: "is this diff covered".** A repo-wide total stays green while a
wholly uncovered new file lands, provided something unrelated improved by as much. That is why
rule 21 of the main skill claims what the ratchet proves — repo-wide uncovered lines did not increase —
and nothing more. Diff-scoped coverage would need a per-diff reporter this standard does not choose.

## Ignoring a line honestly

`/* v8 ignore start -- @preserve */` … `/* v8 ignore stop -- @preserve */` excludes a block.
Legitimate for a branch that cannot be reached from a test (a platform guard, a defensive
`throw` on an impossible enum value). Not legitimate for a branch that is merely inconvenient
to reach — that is the branch most likely to be broken.

## Sources

- [Vitest coverage guide](https://vitest.dev/guide/coverage)
- [Vitest coverage config](https://vitest.dev/config/coverage)
- [Code Coverage vs Mutation Testing — Optivem Journal](https://journal.optivem.com/p/code-coverage-vs-mutation-testing)
- [Why "100% Test Coverage" Is a Vanity Metric](https://www.bestblogs.dev/en/article/c16a0051)
- [Making your code base better will make your code coverage worse — Stack Overflow blog](https://stackoverflow.blog/2025/12/22/making-your-code-base-better-will-make-your-code-coverage-worse/)
