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
      'no-restricted-syntax': ['error',
        { selector: "ObjectExpression > Property[key.name=/^Pkg__/]",
          message: 'Build upstream records through a factory in src/test/factories/, not as a literal.' },
        { selector: "ObjectExpression > Property[key.value=/^Pkg__/]",
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

**The block is not in `eslint.config.js` yet.** Arm it when the test-rewrite work starts, so
violations are fixed as part of that work rather than as a retroactive sweep.

`npm run lint` is already on the pre-push path, so adding this block is what converts the criteria
into a gate. Turning it on will surface existing violations in bulk — count them per rule first, then
land the block and the cleanups together, or land the block with those rules as `warn` and a filed
task to clear them; do not land it with the rules deleted, which is how a gate quietly becomes
decoration.
