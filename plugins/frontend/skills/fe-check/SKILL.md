---
description: Typecheck and run (targeted) unit tests for a frontend repo, returning a terse one-block summary. Use after editing TypeScript/React to quickly confirm types are clean and the relevant tests pass — instead of running tsc and vitest separately and reading full output. Do NOT use for reviewing a diff, nor for any Apex or Salesforce-org check — this runs the frontend tsc + vitest and nothing else.
---

# fe-check — types + tests

A colocated script (`fe-check.sh`, in this skill's directory) runs `tsc --noEmit` then
`vitest run`, and prints a compact summary.

## Contract

**In:** a frontend repo just edited (default: current dir) · optionally one or more `--test` paths to
narrow to · the colocated `fe-check.sh`.

**Out:** a compact two-line summary — a `tsc` line (clean, or N errors with the first 10 lines) and a
`tests` line (passed count, or the failing names) — with a non-zero exit code on any type or test
failure, so it is safe to gate on. The checkable expectations are in `evals/rubric.json`.


## Use it

```bash
bash "<this-skill-dir>/fe-check.sh" --dir /path/to/repo --test src/lib/foo.test.ts
bash "<this-skill-dir>/fe-check.sh"        # current dir, full test suite
```

- `--dir <repo>` — default: current dir.
- `--test <glob-or-path>` (repeatable) — narrow to specific tests; omit for the full suite.

## Output

```
tsc:   clean            | tsc:   N error(s)   (+ first 10 lines)
tests: Tests  4 passed (4)   (+ failing names when any fail)
```

Exit code is non-zero if types fail or any test fails — safe to gate on.


---

## Before you finish

1. The run printed the compact summary: a `tsc` line (clean or N errors + first 10 lines) and a
   `tests` line (passed count, or the failing test names when any fail).
2. The exit code is non-zero when types fail or any test fails, and zero when both pass — the caller
   can gate on it.
3. `--test` narrowed to the named test(s) when given; omitted, the full suite ran; `--dir` targeted the
   intended repo.
4. Any line off? Fix the invocation and re-run. Full expectations → `evals/rubric.json`.
