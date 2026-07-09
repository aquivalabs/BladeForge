---
description: "CLI fallback that deploys Salesforce Apex/metadata to an org and returns a compact TWO-LINE pass/fail summary (deploy: Succeeded / tests: X/Y passed) via a bash wrapper over `sf project deploy` + `sf apex run test` — no MCP dependency.\n\nPREFER the salesforce-dx MCP (`mcp__salesforce-dx__deploy_metadata` + `mcp__salesforce-dx__run_apex_test`, per the `dx_mcp` skill) for programmatic deploy/test when the project has it — structured, resumable results, no shell/path friction. Reach for THIS skill instead when: you want a terse one-line pass/fail without parsing MCP JSON; the salesforce-dx MCP is unavailable (headless / cron / MCP server not connected); or you need combined deploy-then-test in a single call. If the project's CLAUDE.md names the dx MCP as the default deploy+test harness, follow that and treat this as the fallback.\n\nStill covers interpreting a failed deploy (source-tracking, unsafe-path, cross-repo shared-object errors). Don't use for anonymous Apex snippets, ad-hoc SOQL, listing orgs, code review, or UI work with no deploy."
---

# sf-deploy-test — deploy + run tests (CLI fallback, terse summary)

A colocated script (`sf-deploy-test.sh`, in this skill's directory) wraps
`sf project deploy start` (+ optional `sf apex run test`) and prints a two-line summary.

## Prefer the salesforce-dx MCP when available

This skill is the **CLI fallback**, not the default. When the project provides the salesforce-dx
MCP — and especially when its CLAUDE.md names it as the deploy+test harness — use
`mcp__salesforce-dx__deploy_metadata` + `mcp__salesforce-dx__run_apex_test` instead: structured
results, resumable long operations, no shell/path-resolution friction. Reach for this skill for a
terse one-line pass/fail, a single combined deploy+test call, or when the MCP is unavailable
(headless / cron, MCP not connected).

## Use it

```bash
bash "<this-skill-dir>/sf-deploy-test.sh" --project-dir /path/to/repo \
     --source-dir force-app/main/default/classes/Foo.cls --tests FooTest
bash "<this-skill-dir>/sf-deploy-test.sh" --metadata "ApexClass:Foo" --tests "FooTest,BarTest"
```

- `--org <alias>` — default `saas-customization`.
- `--project-dir <path>` — where to run `sf` from (default: current dir).
- `--source-dir <path>` (repeatable) OR `--metadata <Type:Name>` (repeatable).
- `--tests <ClassA,ClassB>` — optional; comma-separated test classes/methods.
- Always deploys with `--ignore-conflicts`.

## Output

- `deploy: Succeeded` / `deploy: Failed — <problems>` / `deploy: ERROR — <message>`.
- `tests: X/Y passed` / `tests: X/Y passed — FAIL: <names>` (only when `--tests` given).

## Gotcha

If a deploy fails with `The filepath "../<other-repo>/…" contains unsafe character sequences`,
the CLI is resolving a shared object across sibling repos. This is an environment/source-tracking
issue, not a code problem — it will show up as `deploy: ERROR — …`. Deploy that shared object
from its owning repo, or resolve the cross-repo source-tracking state before retrying.
