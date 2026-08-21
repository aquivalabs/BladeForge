# Execution tiers — measurements and config

## Measure the split, before and after — and quote no number twice

Take both columns on **one machine, minutes apart, with the same lockfile**: the before number
immediately preceding the first commit of the split, the after number immediately following the last.
Record, for each column, the wall clock of the full suite, the time in the tests themselves, and the
aggregate `environment` and `setup`. Then record each tier run alone.

A number belongs on one page and nowhere else. **A figure repeated in four pages is a figure that
goes stale in three of them**, which is why no wall clock appears anywhere else in this standard.

**What the numbers are for is the framing, and the framing is the durable part.**

- **Environment and setup cost roughly halve.** That is the files needing neither no longer paying
  for both. Expect nothing else to move: the full split run lands within a second of the dom tier run
  alone, so the node tier is effectively free and the dom tier is the entire remaining cost.
- **Read the share, not the ratio.** Most of the wall clock survives the split, now concentrated in
  one tier rather than spread across the suite. Do not read the split as having addressed the suite's
  speed; it addressed the part of it that was paying for an environment it never used → that residual
  needs an owner, at the end of this page.
- **Do not write "jsdom was the cost."** The dom tier's residual is aggregate `environment` *and* a
  large `collect` share, so module collection is a cost no jsdom-only story explains. Write what is
  measured: the split removed environment and setup cost from the files that needed neither, and the
  dom tier's own cost is unchanged.
- **One caution about any single wall clock.** The same suite on the same machine can measure nearly
  twice the same figure a day apart, from machine conditions rather than from the code. A wall clock
  is comparable only against another taken minutes from it — which is why both columns are taken back
  to back, and why an older figure is never carried into the comparison.

Do not quote another repository's table as a current fact. Run the probe below and read your own
number.

## Classify by running, never by grepping

**Run the node tier. Whatever fails on a missing browser global is a DOM-tier file.** A grep for
`render(`, `document.`, `window.` produces both kinds of error at once: it matches a local variable
named `document`, a comment, and a string under test, and it misses every file that reaches a DOM
through production code — a module that reads `window.location` puts its test in the dom tier even
though the test never names a browser global.

**Delete the `@vitest-environment` docblocks before the probe, not after.** Vitest honours a docblock
over the project's `environment`, so a file carrying `// @vitest-environment jsdom` silently receives
a DOM during the probe and is classified node-tier by mistake. This is not hypothetical: it is how
the first classification of a real tree came out wrong. The probe measures whatever the docblocks
leave visible.

### What the probe returns, and why step 1 is load-bearing

Expect every DOM-needing file to fail on a browser global and on nothing else — `document is not
defined`, then `window`, `self`, `Storage`. Anything failing for another reason is a different
defect, not a tier finding.

**The docblocks are not the DOM set, in either direction.** Both errors occur together:

- files carrying a jsdom docblock that need **no** DOM at all — the docblock was copied, not derived;
- DOM-needing files carrying **no** docblock, reaching a DOM through production code instead.

Run the probe with the docblocks in place and every file in the first group *and* every file that its
own docblock hands a DOM to passes, and gets filed node-tier. That is the misclassification the
deletion prevents.

**Read the exit code of `--project node`, not the probe log, as the completeness check.** The rename
list is only as good as one run of a probe; the config landing green over the whole node project is
what proves nothing was missed, because a missed file fails there on a browser global.

The rename list itself does not belong on this page — it belongs to the task that does the renames. A
list written here is wrong by the next commit.

## The docblocks: gone, and they are not coming back

**All of them are out of the tree** — every `jsdom` one and every `node` one — removed with the
split. Nothing replaced them, and nothing should: the filename decides the tier now, and a docblock
beside it would be a second mechanism stating the same fact. That is not a theoretical drift. Some of
them already disagreed with what they claimed when they were deleted.

A docblock switches `environment` and nothing else. `pool` and `setupFiles` stay whatever the
collecting project declares, so a jsdom-by-docblock file sitting in the node project would get a DOM
and none of what `vitest.setup.ts` establishes on top of one — a third state neither tier describes.

**Their removal takes two commits, and the order is measured rather than chosen.** Under a
single-project jsdom config, deleting a `jsdom` docblock is inert — the file was getting a DOM anyway
— and a full suite run with all of them gone confirms it, exit 0. Deleting a `node` docblock in that
same state would move those files *to* jsdom, an outcome nothing has measured. So the jsdom ones come
out first, and the node ones come out in the commit that gives them a node project.

**What was kept: the prose, where there was any.** Where a node-docblock file carried a comment
underneath explaining *why* Node — a dependency needing the platform `URL` rather than jsdom's, a
cross-realm `Uint8Array` defeating an `instanceof` check — those comments stayed. A docblock is a
mechanism and drifts; a reason is a reason, and it is now the thing that stops someone renaming
either file `*.dom.test.ts`.

## The config — this is the shape that ships

`test.projects` is the supported mechanism in Vitest 3.2. `workspace` and `environmentMatchGlobs`
are deprecated.

**Four options are root-only and cannot be set per project: `coverage`, `reporters`,
`poolOptions` and `slowTestThreshold`.** A project-level `poolOptions` or `slowTestThreshold` is not
an error — Vitest loads the config, ignores the key and runs. That silence is the trap: the fork cap
that keeps a jsdom run out of swap would be gone with nothing to show for it. Both are type errors
inside a project, but a `vite.config.ts` that no tsconfig includes never raises them either — which
is worth checking before relying on the type system here.

**The root-only claim is measured, not inferred, and the authority is `NonProjectOptions` in the
installed Vitest's own type declarations:**

| option | per project? | how it was established |
|---|---|---|
| `name`, `environment`, `globals`, `pool`, `setupFiles`, `include`, `exclude`, `testTimeout` | **yes** | absent from `NonProjectOptions`; `pool` is read as `project.config.pool` |
| `slowTestThreshold` | **no** | set it to `1` inside the node project and a subset reports no slow cases at all; the same value at the root reports them. No warning either way. Confirmed at the source: `this.project.globalConfig.slowTestThreshold` always reads the root instance |
| `poolOptions.forks.maxForks` | **no** | read as `vitest.config.poolOptions?.forks`. Capping it at the root changes a dom subset's wall clock; the same cap inside the project changes nothing |
| `poolOptions.forks.singleFork` / `.isolate`, `poolOptions.threads.singleThread` / `.isolate` | **yes** | narrowed but present in `ProjectConfig`, and read off `spec.project.config` |
| `coverage`, `reporters` | **no** | in `NonProjectOptions` |

**The root fork cap does not reach the node tier, and that is intended.** Even with the root cap at
`1` the node project runs at full speed, because it uses `threads`, whose limit is
`poolOptions.threads.maxThreads ?? maxWorkers ?? cpus-1`. Two pools can therefore hold workers in the
same run — fine on a developer machine, unmeasured on a CI runner, and no cap is added on a guess.

```ts
// vite.config.ts
test: {
  // Root, not per project. Root poolOptions is keyed by pool, so a `forks` cap throttles the dom
  // project only and leaves the node project's `threads` pool alone.
  poolOptions: { forks: { maxForks: 4 } },
  slowTestThreshold: 1000,
  projects: [
    {
      extends: true,                       // inherit plugins and resolve.alias
      test: {
        name: 'node',
        environment: 'node',
        globals: true,
        pool: 'threads',
        // Declared, not inherited. The larger value moved into the dom project below, where its
        // reason lives, so a node tier that declared nothing would fall back to Vitest's own
        // default — see the note under this snippet before you change this number.
        testTimeout: 10_000,
        // No setupFiles, deliberately and measured — see "The node tier is not setup-free", below.
        // `vitest.setup.node.ts` lands with the matcher layer: `@/test/matchers` does not exist,
        // and naming a file that imports it takes the whole tier down at config load → §8.
        include: ['**/*.{test,spec}.?(c|m)[jt]s'],
        exclude: [
          ...configDefaults.exclude,
          '.claude/**',
          '**/*.dom.{test,spec}.?(c|m)[jt]s',
        ],
      },
    },
    {
      extends: true,
      test: {
        name: 'dom',
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        pool: 'forks',
        testTimeout: 20_000,
        include: [
          '**/*.{test,spec}.?(c|m)[jt]sx',
          '**/*.dom.{test,spec}.?(c|m)[jt]s',
        ],
        exclude: [...configDefaults.exclude, '.claude/**'],
      },
    },
  ],
},
```

**The split narrows the node tier's per-test budget, and the number is declared rather than
inherited.** `testTimeout` used to sit at the root, so every file got the same generous value. The
split moves that value into the dom project, where its reason lives — a case must outlast the
`findBy*` retry window. A node project that declared nothing would inherit nothing and fall back to
Vitest's own default, which is a silent change, not a decision. So the node tier declares its own:
well under the dom tier's, well over the slow-test report threshold, and not a cliff an existing
test is already standing on. **Measure the slowest node-tier case before you lower it** — typically
one that runs against a real database on CI rather than the local skip, and the flake policy sanctions
no retry when it goes red.

**The two include globs partition Vitest's default include; they do not narrow it.** The default is
`**/*.{test,spec}.?(c|m)[jt]s?(x)`. The node project takes the extensions without `x`, the dom
project takes the ones with `x` plus the `.dom.` marker — so every file the default would collect
lands in exactly one project, whatever directory it is in. Both guards below print nothing on a
correct config.

A directory allow-list would have been shorter and wrong. `{src,server,shared,scripts}/**`
reintroduces the third state §1 rejects: a test file in a new top-level directory belongs to no
project, never runs, and the suite stays green. The only files outside both projects are the ones
both projects exclude by name, and `.claude/**` — nested tooling worktrees, whose stale copies of
the repository must not be collected twice.

**Guard it anyway**, because a glob is an argument and a check is a fact:

```bash
# Every file Vitest's default include would collect is collected by one of the two projects.
comm -23 \
  <(git ls-files | grep -E '\.(test|spec)\.[cm]?[jt]sx?$' | sort) \
  <(npx vitest list --filesOnly | sed -E 's/^\[[^]]+\] //' | sort)
```

Empty output is the pass. Anything printed is a test file that runs nowhere.

`comm -23` cannot see a file collected **twice**, so the other direction needs its own line:

```bash
# No file is collected by both projects.
npx vitest list --filesOnly | sed -E 's/^\[[^]]+\] //' | sort | uniq -d
```

Run both whenever `vite.config.ts` changes. They are the only check that catches a file falling out
of both projects without the suite going red, and they cost one `vitest list` each.

**The `sed` is load-bearing, and it is not tidying.** Once `projects` is declared,
`vitest list --filesOnly` prefixes every path with its project name — `[node] src/lib/utils.test.ts`
— so a `comm` against the raw output finds no line in common and reports the whole suite as running
nowhere. Strip any bracketed prefix rather than the two project names: the format is Vitest's, not
ours, and it can change with a minor.

## The node tier is not setup-free, and the data-client reset is not what goes in it

What wants a node-tier setup file, and only one of them may have it:

- **domain matchers** live in a setup file, and setup files are per project → `readable-tests.md`;
- **the data-client reset** that keeps a fake from leaking between files → main skill, clause 6.

```ts
// vitest.setup.node.ts — matchers, and nothing that builds an object graph at load
import '@/test/matchers';
```

**Neither the file nor its `setupFiles` line exists yet, and the order between them is one way
round.** `@/test/matchers` does not exist, so a config that names this setup file today fails to
load the entire tier — every file in it errors before collection. The matcher layer lands first, then
the file, then the `setupFiles` line. Anything that references it before then is a config that cannot
start → main skill, §8.

**The node project therefore declares no `setupFiles` at all, and the cost of getting that wrong is
measured.** A probe file whose only statement was the import below took files from green to red —
files that pass without the setup file and never opted in — and added real setup time to a tier that
was chosen for being cheap.

```ts
// NOT this. Probed: a node-tier setup file whose only statement was
// `import '@/lib/data/client'` broke files that pass without it, and put real setup time on
// every file in the tier chosen for being cheap. The mechanism
// below is the reason, not the magnitude.
import { setDataClient, HttpDataClient } from '@/lib/data/client';
afterEach(() => setDataClient(new HttpDataClient()));
```

**The mechanism, not the cost, is the reason.** That module instantiates its clients at load.
Importing it from a setup file resolves and caches the real environment module before any test file's
`vi.mock` is registered, so the mock is defeated, the real runtime probe runs, and it reads `window`
in an environment that has none. The files that broke are files that never opted in — they pass
without the setup file and fail with it.

So the reset lives in a helper the test file imports, which loads after that file's hoisted mocks
and costs the rest of the tier nothing → main skill, clause 6. The helper registers its own
`beforeEach`/`afterEach`, so a leaked fake is still impossible, and it is called at suite scope
because Vitest refuses a hook registered inside a running case.

*One unknown, stated rather than guessed:* the probe proves that a value import of the data-client
module defeats the mock. Whether a type-only or genuinely side-effect-free import would be safe was
not traced. Treat the safe-import boundary as unknown, and keep production modules out of setup files
until someone measures it.

What must NOT go in the node setup file either: `jest-dom` matchers, a grid library's module
registration, `asyncUtilTimeout`. All three are DOM-tier concerns, and each one costs the node tier
the time the split was built to save.

## A time budget the machine checks

Rule 24 of the main skill asks a node-tier case to run in tens of milliseconds, not seconds. It is
its own rule and not a corollary of rule 9: a case that grew to two seconds can be perfectly
deterministic, pass rule 9, and still erode the split the budget exists to defend.
`slowTestThreshold` marks any case slower than the limit in the output, so a test that quietly grew
into a second is visible instead of merely suspected.

**One value, at the root — the option is not per project.** Set it to `1000`, tuned for the dom
tier, where a render plus an interaction genuinely costs hundreds of milliseconds and anything past
a second is a wait that should be a `findBy*`.

That value is blind to the node tier's budget, which is twenty times tighter. Check the node budget
on demand, where the tightness is the point:

```bash
npx vitest run --project node --slowTestThreshold=50
```

**The whole-project form is valid once the renames have landed.** Before that, a `.test.ts` still
reaching a browser global fails under `environment: node` and exits 1 for a reason unrelated to
slowness. After, the command exits 0 and prints a list. Read that first list as the budget's starting
picture, not a defect list — read it against the four causes below before acting on any row of it.

A node case above the threshold is usually doing something it should not — real I/O, a real timer, a
huge fixture. There is one legitimate fourth cause: a property run over a couple of hundred generated
inputs costs real time and is meant to → `case-space.md`. Read the report rather than dismissing it,
and read it rather than obeying it: the flag reports and never fails, which is right for a budget
that moves with the machine. A threshold that failed a build would be tuned into uselessness on the
first slow CI runner.

The integration category of §1 is exempt from this budget outright: a real database is orders of
magnitude past it, and that is what those files are for.

## Where each run happens: the whole suite locally, everything again on CI

**The pre-push hook runs `npx vitest run` — the whole suite, on every push.** CI runs the same suite
again, with a database, migrations and a restricted role that the local run cannot reproduce. Which
check runs where is the main skill's table.

**Nothing here passes `--changed`, and this standard proposes no delta run.** A delta pre-push is a
real decision with a real trap — a change no test imports selects nothing, and the push passes with
nothing run — so it belongs to the task that takes it, with the mechanics current at that moment. The
limits are recorded there, not here.

**Do not add a retry flag.** A retry converts an intermittent defect into a green build →
the flake policy in the main skill.

## The residual, and who owns it

**After the split, the dom tier is most of the suite's wall clock and the node tier is a rounding
error.** That is not a leftover to be noticed later; it is the whole remaining cost, and it now sits
behind one project name. `isolate: false` and `happy-dom` are the two further levers, and neither is
a config flip — one trades away per-file isolation, the other trades DOM fidelity. Both are measured
and decided in one filed task, with `environment.md` for `happy-dom`'s trade.

**Name the owner, and check the pointer resolves.** This sentence used to claim both levers were
"filed rather than described here" while nothing anywhere mentioned either. A pointer to nothing is
worse than no pointer: it reads as due diligence already done.
