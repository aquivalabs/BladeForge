---
description: Run anonymous Apex or a SOQL query against a Salesforce org and get a terse pass/fail result. Use whenever you need to execute anonymous Apex, reproduce an org-side error, or run a quick SOQL check against a dev/scratch org — instead of hand-rolling `sf org display` + curl to the Tooling API. Do NOT use to deploy or retrieve metadata (use `sf-deploy-test`), to describe an object schema or field names (use `dx_mcp`/`as_mcp`), or to build UI — this only runs anon Apex and SOQL.
---

# sf-run — org anonymous-Apex / SOQL runner

## Contract

**In:** an org alias reachable via `sf` CLI auth (default `myOrg`) · exactly one of `--apex '<code>'`
· `--apex-file <path>` · `--soql '<query>'` · the colocated `sf-run.sh`.

**Out:** one terse line instead of raw Tooling-API JSON — Apex → `OK`, `FAIL(compile): <problem> @
line N`, or `FAIL: <message> @ <first stack frame>`; SOQL → `<N> rows` then up to 5 compact records
with `attributes` stripped. `--debug` additionally prints the raw JSON.

---

A colocated script (`sf-run.sh`, in this skill's directory) resolves the org access token via the
`sf` CLI and hits the Tooling `executeAnonymous` endpoint (or the query endpoint), returning a
terse result instead of raw JSON. Prefer it over hand-writing the token+curl recipe.

## Use it

```bash
bash "<this-skill-dir>/sf-run.sh" --apex 'System.debug(1+1);'
bash "<this-skill-dir>/sf-run.sh" --org myScratch --soql 'SELECT Id FROM Account LIMIT 5'
bash "<this-skill-dir>/sf-run.sh" --apex-file /tmp/snippet.apex --debug
```

- `--org <alias>` — default `myOrg`.
- one of `--apex '<code>'` · `--apex-file <path>` · `--soql '<query>'`.
- `--debug` — also print the full raw JSON response.

## Output

- Apex → `OK`, or `FAIL(compile): <problem> @ line N`, or `FAIL: <exceptionMessage> @ <first stack frame>`.
- SOQL → `<N> rows` then up to 5 records (compact JSON, `attributes` stripped).

Anonymous Apex can run DML — that is intentional; treat it like any org-mutating action.

---

## Before you finish

1. The result came from `sf-run.sh`, not a hand-rolled `sf org display` + curl recipe.
2. Apex → the line is `OK` or a `FAIL…` with a location; SOQL → `<N> rows` then the records. If you
   got raw JSON, you forgot the script or you asked for `--debug` on purpose.
3. Anything off? Re-run with `--debug` to see the raw payload, fix the call, and repeat from 1.
