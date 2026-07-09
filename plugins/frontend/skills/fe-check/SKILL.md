---
description: Typecheck and run (targeted) unit tests for a frontend repo, returning a terse one-block summary. Use after editing TypeScript/React to quickly confirm types are clean and the relevant tests pass — instead of running tsc and vitest separately and reading full output.
---

# fe-check — types + tests

A colocated script (`fe-check.sh`, in this skill's directory) runs `tsc --noEmit` then
`vitest run`, and prints a compact summary.

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
