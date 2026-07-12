---
description: Run anonymous Apex or a SOQL query against a Salesforce org and get a terse pass/fail result. Use whenever you need to execute anonymous Apex, reproduce an org-side error, or run a quick SOQL check against a dev/scratch org — instead of hand-rolling `sf org display` + curl to the Tooling API.
---

# sf-run — org anonymous-Apex / SOQL runner

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
