# The environment this standard needs

Every dependency the standard relies on, why it is there, and what breaks without it. A rule with no
mechanism behind it is a suggestion, so this page is part of the standard rather than a footnote.

## Installed

| package | why | without it |
|---|---|---|
| `vitest` | the runner | — |
| `jsdom` | the DOM-tier environment | component tests cannot run |
| `@testing-library/react` | rendering and queries | — |
| `@testing-library/jest-dom` | DOM matchers (`toBeDisabled`, `toHaveTextContent`) | assertions fall back to node poking |
| **`@testing-library/user-event`** | interactions that model a person | tests reach for `storybook/test`, which is not wired to React's `act` under Vitest → the `act(...)` noise diagnosed in `component-tests.md` |
| **`@vitest/coverage-v8`** | the coverage gate | nothing measures the suite |
| **`eslint-plugin-testing-library`** | `await-async-events`, `prefer-find-by`, `no-container`, `no-node-access`, `prefer-screen-queries` | the component-test criteria stay review notes instead of gates |
| **`eslint-plugin-jest-dom`** | `prefer-to-have-text-content` and friends | weaker assertions pass review |

The packages in bold were added by this standard. Installed is not the same as armed: the eslint
plugins do nothing until the config block below is in `eslint.config.js`, and coverage does nothing
until thresholds exist → `coverage-gate.md`.

## One version trap, and one that is closed

**`@vitest/coverage-v8` must match the `vitest` minor.** A bare `npm i -D @vitest/coverage-v8`
installs the newest line, which peer-requires the matching major of Vitest and fails to resolve
against an older one. Keep both on the same major — `^3.2.x` of the coverage package against `^3.2.x`
of the runner — so neither caret can cross the major that breaks. Do not "fix" either range to an
exact pin, and do not widen it.

**`@testing-library/user-event` is declared, and the trap it was is closed.** It used to resolve
only as a transitive dependency, which is how test files ended up importing `userEvent` from
`storybook/test` — an import that works by accident breaks on the next lockfile update. It belongs in
`devDependencies`. The rule that survives is the general one: an import in a test file
resolves through a declared dependency or it is a defect waiting for a lockfile.

## Required when the mutation gate lands

Not installed yet — the gate is specified, not running → `mutation-gate.md`.

| package | why |
|---|---|
| `@stryker-mutator/core` | the mutation runner |
| `@stryker-mutator/vitest-runner` | drives Vitest; supports `threads: true` only, which is why the gate runs on the node tier |
| `@stryker-mutator/typescript-checker` | rejects mutants that do not compile, before a test run is spent on them |

## Recommended, not required: what reports the run

Nothing here is a rule. These are recommendations, and a repository that declines them still meets
every rule in this standard — it just pays for the decline in a way worth naming.

**Two run reporters, and neither is the coverage reporter.** The coverage reporter is configured
already and reports on lines. These report on the *run*: which cases executed, which failed, how long
each took. Both are built into Vitest, so neither is a dependency.

| reporter | what it buys | what its absence costs |
|---|---|---|
| `github-actions` | annotates the failing assertion on its own line in the pull request's diff | a red step names no test, so a reader opens the log — which on a large suite runs to tens of thousands of lines |
| `json` + `--outputFile` | the run in a shape a machine reads | the flake detector has nothing to compare, so the flake policy has no mechanism |

```yaml
run: >-
  npx vitest run --coverage
  --reporter=github-actions
  --reporter=json --outputFile=test-run.json
```

**Keep the JSON artifact even when the step failed.** A red run is the one whose report is worth
reading, and a conditional that drops it on failure discards exactly the case it was for.

**The report file is gitignored.** It is written by a local run as readily as by CI, and a committed
run report is a census of one moment.

## Considered and not taken

| package | why not |
|---|---|
| `msw` | intercepts at the network layer, below the seam this standard substitutes at. It drags serialisation, headers and retries into cases that are not about them. The seam is the data client |
| `happy-dom` | faster than jsdom, but a less complete DOM. Every DOM-tier file would need re-verifying — a separate experiment with its own measurement, not a dependency decision |
| `fast-check` | wanted only where a genuine invariant exists (the `src/lib/pricing` calculation core), so it is adopted with that work rather than up front → `case-space.md` §5 |
| a coverage comment bot | the threshold already gates; a number nobody can act on is noise |
| an end-to-end runner | a `test:e2e` script naming a runner that is not installed, has no config and no spec files is a lie; the fix is deleting the script or building e2e deliberately. Out of scope for unit testing |

## The eslint block

```js
// eslint.config.js
import testingLibrary from 'eslint-plugin-testing-library';
import jestDom from 'eslint-plugin-jest-dom';

export default [
  // … existing blocks …
  {
    // `**/*.test.ts` already matches `foo.dom.test.ts` — no glob for the marker.
    files: ['**/*.test.ts', '**/*.test.tsx'],
    plugins: { 'testing-library': testingLibrary, 'jest-dom': jestDom },
    rules: {
      ...testingLibrary.configs['flat/react'].rules,
      ...jestDom.configs['flat/recommended'].rules,
      // Upstream records are built by a factory, never written as a literal. Two selectors,
      // because `key.name` misses a quoted or computed key → factories.md
      //
      // NARROWED, and the narrowing is the whole point. Requiring only a namespaced KEY matched 339
      // sites on one real repo and most were not records at all: the namespace also appears as a
      // filter-model key, a query column name and a pivot-field alias, none of which a factory can
      // build. Requiring an `Id`/`attributes` SIBLING is what separates an entity literal from those,
      // and on the same repo it matched ZERO — the broad form's four remaining hits were all a typed
      // list-view record shape, correctly ignored. Armed at zero, it catches the next hand-rolled
      // literal instead of a backlog of correct code.
      'no-restricted-syntax': ['error',
        { selector: "ObjectExpression:has(Property[key.value=/^Pkg__/]):has(Property[key.name=/^(Id|attributes)$/])",
          message: 'Build upstream records through a factory in src/test/factories/, not as a literal.' },
        { selector: "ObjectExpression:has(Property[key.value=/^Pkg__/]):has(Property[key.value=/^(Id|attributes)$/])",
          message: 'Build upstream records through a factory in src/test/factories/, not as a literal.' },
      ],
      // storybook/test is legitimate in a story and wrong in a unit test → component-tests.md
      'no-restricted-imports': ['error', { paths: [{
        name: 'storybook/test',
        message: "Import userEvent from '@testing-library/user-event'; storybook/test is not wired to React's act under Vitest.",
      }] }],
    },
  },
];
```

`npm run lint` is already on the pre-push path, so adding this block is what converts the criteria
into a gate. Arm it when the test-rewrite work starts, so violations are fixed as part of that work
rather than as a retroactive sweep. Count them per rule first, then land the block and the cleanups
together — never land it with the rules deleted, which is how a gate quietly becomes decoration.

### What arming it actually costs, measured

On one repo, the whole of `flat/react` plus `flat/recommended`: **503 violations, taken to zero, and
FIXED rather than suppressed.** The families that were genuinely clean once fixed —
`prefer-find-by`, `prefer-screen-queries`, `render-result-naming-convention`, `no-manual-cleanup`,
`await-async-queries` and the whole `jest-dom` set — went in one pass. Two of the fixes were worth
having on their own merits: a case that rendered twice with a manual `cleanup()` between became two
cases, and so did one that rendered twice to compare two class-queried lists.

**Two rules need their own pass and should start `off` with a stated count.** `no-container` (31 sites)
and `no-node-access` (67) are a different population: not every hit is a defect. A skeleton is
`aria-hidden` by design, a grid library's internals expose no roles, a hidden `input[name]` is
deliberately outside the accessibility tree. Each needs a judgement, and the honest fix for a
legitimate one is a per-site disable naming why the tree cannot reach it. Worked through, 59 of the 98
were rewritten to an accessible query, a handful of components gained a `data-testid`, and one gained a
real `aria-label` — an icon-only button that had no accessible name at all, which is a genuine
accessibility fix the rule surfaced as a side effect. Both then armed at zero.

**Do not run a bulk `--fix` on a test suite.** `prefer-find-by` and `await-async-queries` match by
NAME, not by type: a local helper called `findByPath` looks like an async query to them. Measured — a
single `eslint --fix` inserted TEN `await`s into a synchronous test file, producing `await await` in
places. The file had to be reverted and the helper renamed. Read the fixes, or rename anything that
collides with the plugins' naming conventions first.

**A suppression that outnumbers the rule is the failure mode**, not the violations. That is why the two
hard rules stay `off` with a real count beside them rather than `error` with 98 disables: the count is
honest and it shrinks, where a disable list teaches the next reader that disabling is the convention.
