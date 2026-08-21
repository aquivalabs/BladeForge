# Mutation gate

## What it measures

Stryker changes the source — one small break at a time — re-runs the tests, and records
whether anything failed. A mutant that makes no test fail **survived**, which means the line
is executed but not verified.

| original | one mutant |
|---|---|
| `a > b` | `a >= b` |
| `x && y` | `x \|\| y` |
| `return total` | `return 0` |
| `'Pkg__Catalog__c'` | `''` |
| a statement | the statement removed |

Mutation score = killed / total. It is the only mechanical answer to "would a test notice if
this code were wrong", which is the question coverage cannot reach — rule 22 of the main skill.

## Where it may run, and where it may not

The constraints, all measured or documented rather than assumed:

1. **The Stryker vitest runner supports `threads: true` only.** The dom tier runs on `forks`,
   deliberately capped because each fork is a full jsdom heap. Mutation cannot run there
   without changing that. **After the split, restricting Stryker to the node tier is an explicit
   config step, not a consequence of the split** — a Vitest config that declares both projects runs
   both, `forks` pool included.
2. **Stryker's default `timeoutMS` is 5000, and the DOM tier's setup sets `asyncUtilTimeout` to
   the same.** A dom-tier mutant would hit the timeout instead of being judged, and a timeout is
   reported as killed — a false positive that quietly inflates the score.
3. **Stryker's default `concurrency` is cores − 1**, each worker spawning its own Vitest. The
   Stryker troubleshooting page documents that default as the standard route to a
   heap-out-of-memory crash.

**Conclusion: the mutation gate runs on the node tier, on a narrow module, and never inside the
pre-push hook.** It is a periodic audit, not a gate on every push. A pre-push mutation run
would add minutes to every push and its score would move on refactors that change nothing.

## First target: `src/lib/pricing`

Pure calculation, no React, no network, almost nothing mocked, and the fastest tests in the repo. A
surviving mutant there means a real hole in a computed price, which is the most valuable place to
look first. Component tests under jsdom are both the slowest and the least informative target.

Exclude the calculation core's worker code from the run — it needs a worker context and belongs
to the dom tier.

Clear the snapshot assertions inside this target first. A snapshot kills mutants without pinning
any rule, so it inflates the first score this gate ever reports — the one number every later
threshold is set against. The main skill's §8 step 1 carries that as a prerequisite of the step, not
as advice.

## Config

```bash
npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner @stryker-mutator/typescript-checker
```

**Stryker gets its own Vitest config, and the reason is constraint 1.** `vite.config.ts` declares
both projects, so pointing Stryker at it drives a run that includes the dom tier on `forks` — the
configuration constraint 1 rules out. Nothing in the Stryker config selects a project, so the
selection has to be the config file itself:

```ts
// vitest.mutation.config.ts — the node tier alone, because the mutation runner supports threads only
import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: './vite.config.ts',        // plugins and resolve.alias, from the one real config
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          pool: 'threads',
          include: ['**/*.{test,spec}.?(c|m)[jt]s'],
          exclude: [...configDefaults.exclude, '.claude/**', '**/*.dom.{test,spec}.?(c|m)[jt]s'],
        },
      },
    ],
  },
});
```

Load and run it before trusting it: it must collect the node tier only, no `.tsx` and no `.dom.` file
may reach it, the aliases must resolve, and a real node-tier test file must pass through it green.

The node project's options are duplicated here and in `vite.config.ts`, and a drifted copy would run
the wrong tier and report a score for it. The fix is one exported object both configs spread — but
only a change that edits both files can make it, so this snippet stays copy-pasteable and the
extraction belongs to the change that lands the gate.

**This snippet names no `setupFiles`, and it still loads one wherever the root declares one — so the
gate lands after the tier split.** `extends: './vite.config.ts'` inherits the root `test` block. If
that block still carries `setupFiles: ['./vitest.setup.ts']`, a node-environment mutation run gets
`jest-dom` matchers and executes the grid library's registration — two of the three things
`execution-tiers.md` bans from the node setup file by name — and pays that setup once per worker in
the tier chosen for being cheap.

**It cannot be switched off from here, which is why the ordering is not a preference.** Vitest merges
a project's `extends` arrays with the parent's instead of replacing them. Verify both ways:
`setupFiles: []` leaves the parent's file running, and `setupFiles: ['./noop.ts']` runs the noop
*alongside* it. The split is the fix — once `setupFiles` moves into the dom project, this same
snippet extends a root that declares none and no setup file runs at all. Dropping `extends`
and copying the alias map into this file would work too, and trades one drifting copy for a worse
one.

**`vitest.setup.node.ts` is a separate point and still stands.** It contains one statement,
`import '@/test/matchers'`, and the matcher layer is blocked (main skill, rule 11). Naming that file makes
every mutation run fail to load before a single mutant is judged — verified:
`Cannot find module …/vitest.setup.node.ts`, `Test Files 1 failed`.

**The change that builds the matcher layer adds that `setupFiles` line to both configs** —
`vite.config.ts`'s node project and this file. This one `extends` the root `test` block rather than a
sibling project, so a line added only to `vite.config.ts` leaves the mutation run without the
matchers its tests use. The gate itself never waits on the matcher layer: mutants are judged by the
assertions the tests already carry.

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "vitest",
  "plugins": ["@stryker-mutator/vitest-runner", "@stryker-mutator/typescript-checker"],
  "vitest": { "configFile": "vitest.mutation.config.ts", "related": true },
  "mutate": ["src/lib/pricing/**/*.ts", "!src/lib/pricing/**/*.test.ts", "!src/lib/pricing/worker/**"],
  "checkers": ["typescript"],
  "tsconfigFile": "tsconfig.json",
  "coverageAnalysis": "perTest",
  "ignoreStatic": true,
  "incremental": true,
  "concurrency": 4,
  "thresholds": { "high": 80, "low": 60, "break": null },
  "reporters": ["clear-text", "progress", "html"]
}
```

Why each non-default line is there:

| option | reason |
|---|---|
| `checkers: ["typescript"]` | a mutant that does not compile is noise; the checker rejects it before a test run is spent on it |
| `coverageAnalysis: "perTest"` | the default, and required by `ignoreStatic` — only tests that touch the mutated line are run |
| `ignoreStatic: true` | skips mutants only reachable during module load, which no test can kill |
| `incremental: true` | the second run touches only what changed; the first is the expensive one |
| `concurrency: 4` | matches the fork cap already chosen for this machine; the default is the documented OOM |
| `break: null` | the gate measures and reports; it does not fail a build until a real number exists |

**Two claims here are unverified until the packages are installed.** The runner's option names —
`vitest.configFile`, `vitest.related` — come from its documentation and not from a load against a real
tree. Confirm both when the packages land.

## Reading the result

Not every surviving mutant is a missing test. Sort survivors into the piles below before writing
anything:

| pile | what it means | action |
|---|---|---|
| **real hole** | the mutant changes behaviour a user would notice, and nothing failed | this is the finding — the reason to run the tool |
| **equivalent mutant** | the mutant produces identical behaviour (`a < b ? b : a` with `<=`) | annotate with `// Stryker disable next-line <Mutator>: reason` — the reason appears in the report |
| **worthless code** | the mutated line has no observable effect at all | delete the line, do not test it |

The third pile is why mutation testing pays for itself even when the score is bad: it finds
code that does nothing.

## A survived mutant is a missing case, not a missing assertion

This is the link that makes the whole standard measurable, and it is the first thing to do with a
survivor — before deciding it is equivalent, before deleting anything.

Stryker changed one line and no test noticed. **Take the mutant back to the axis table in
`case-space.md` and ask which axis would have caught it.** The mutant names the axis almost every
time:

| the mutant that survived | the axis nobody wrote |
|---|---|
| `>` became `>=` | boundary — the exact edge and one step either side |
| `&&` became `\|\|` | cardinality or absence — a combination never fed in |
| a statement was removed and nothing changed | idempotence, or the statement is dead code |
| a string became `''` | absence — empty was never distinguished from missing |
| `+` became `-` on an accumulator | order, or an invariant over the whole input |

So the output of a mutation run is not "write more assertions". It is a list of **situations the
suite never put the code in**. That is a different and much more useful instruction.

## Using it while writing, not only as a gate

The gate is periodic. The more valuable use is local and immediate: run it on the one file you are
working on, and it tells you which cases you have not written yet.

```bash
npx stryker run --mutate 'src/lib/pricing/orderTotal.ts' --incremental
```

The calculation core's own tests run in a fraction of a second, so a single file's mutants finish in
seconds rather than minutes.
No threshold, no report to read, no gate involved — just the list of lines your new test does not
defend. This is the cheapest feedback in the whole standard and it needs no ceremony.

## Turning it into a gate

1. Run once. Record the score. **Do not set `break` yet.**
2. Sort the survivors into the piles above and act on the first two.
3. Set `break` a few points below the measured score, then raise it only when the number rises.
   The same ratchet discipline as the coverage gate: the threshold follows reality, reality is
   never adjusted to satisfy the threshold.
4. Keep it out of pre-push. A scheduled run, or a manual run on a module under active work, is
   where this belongs. A mutation script in `package.json` is added by the change that arms the
   gate, alongside the config above.

## The target: fewer than 10 % of mutants survive

**The bar is a mutation score above 90 %**, and it is deliberately higher than the published
orientation — `high: 80, low: 60`, with teams that gate typically breaking around 50–60.

The reason is the pairing. The coverage floor is 70 %, and a 70 % floor is satisfiable by tests that
execute code and assert nothing. A high mutation bar is what stops the coverage number from being
decoration, so setting it at the industry's comfortable middle would defeat the point of having both.

**Two things make 90 % harder than it sounds, and both are work rather than tuning.**

An **equivalent mutant cannot be killed by any test.** `a < b ? b : a` with `<=` behaves identically,
so it survives forever and counts against the score until it is annotated with
`// Stryker disable next-line <Mutator>: reason`. Reaching a high score therefore requires finding and
signing every equivalent mutant, one at a time. A perfect score is not available at all.

And **an uncovered line produces a surviving mutant automatically.** Whatever share of the target
module is uncovered generates survivors before any assertion is considered, so the score cannot
approach the target until those lines are covered — which is coverage work, discovered by the
mutation run rather than done by it.

So the target is a target. **`break` is still not set until a real score exists**, and the first score
is a measurement rather than a verdict. If it comes back well short, the distance to the bar is work;
it is never a reason to lower the bar.

## Sources

- [Vitest runner](https://github.com/stryker-mutator/stryker-js/blob/master/docs/vitest-runner.md) · [configuration](https://github.com/stryker-mutator/stryker-js/blob/master/docs/configuration.md) · [disabling mutants](https://github.com/stryker-mutator/stryker-js/blob/master/docs/disable-mutants.md) · [incremental mode](https://github.com/stryker-mutator/stryker-js/blob/master/docs/incremental.md) · [parallel workers](https://github.com/stryker-mutator/stryker-js/blob/master/docs/parallel-workers.md) · [troubleshooting](https://github.com/stryker-mutator/stryker-js/blob/master/docs/troubleshooting.md)
- [Stryker introduction](https://stryker-mutator.io/docs/stryker-js/introduction/)
- [Mutation Testing With Stryker: Complete Guide](https://qaskills.sh/blog/mutation-testing-stryker-guide-2026)
- [Boost Your TypeScript Tests with Mutation Testing](https://typescript.tv/testing/boost-your-typescript-tests-with-mutation-testing/)
- [An intro to Mutation Testing — or why coverage sucks](https://pedrorijo.com/blog/intro-mutation/)
