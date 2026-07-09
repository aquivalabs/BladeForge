---
description: "Interact with a Salesforce org through the salesforce-dx MCP tools instead of the raw `sf` CLI. Use for any org-touching task: running SOQL or Tooling queries against an org, running or resuming Apex tests, deploying/pushing or retrieving/pulling metadata and Apex classes to/from an org (scratch, sandbox, or prod), resuming a long-running deploy or test job by id, and resolving which org alias or username to target. Triggers on requests like \"query the org\", \"push/deploy these classes to the org\", \"run the Apex tests on <org>\", \"resume the deploy job\", or \"which org alias should I use\". If the action reaches out to a live org \u2014 data, tests, metadata, or org/alias selection \u2014 reach for this first."
---

# Salesforce DX MCP — Use It For Org Interactions

## When to Activate

Activate before ANY action that touches a Salesforce org, in any project:

- Running a SOQL or Tooling API query (objects, fields, `ApexClass`, `*__mdt`, etc.)
- Running Apex tests (a `classes/*.cls` test, a single method, a suite, or org-wide)
- Deploying metadata to an org / retrieving metadata from an org
- Resolving which org/username to use, or listing orgs
- Resuming a long-running deploy/test/scratch-org job

This OVERRIDES any `sf` CLI examples in project docs/CLAUDE.md (`sf data query`,
`sf apex run test`, `sf project retrieve start`, etc.). Reach for the MCP first;
fall back to `sf` via Bash only when an MCP tool genuinely can't do the job
(e.g. `sf org login`, scratch-org creation, an interactive flag).

---

## Why MCP over `sf` Bash

- **Structured results** — no fragile parsing of CLI text/JSON in shell.
- **No raw-shell permission prompts**, consistent behavior across sessions.
- **Right tool semantics** — e.g. `run_apex_test` returns a `testRunId` you can
  resume; `run_soql_query` toggles Tooling API with one flag.

---

## Gotcha #1 — Tools are DEFERRED, load them first

The `mcp__salesforce-dx__*` tools are not loaded by default. Before the first
call in a session, fetch the schemas you need:

```
ToolSearch  query: "select:mcp__salesforce-dx__run_apex_test,mcp__salesforce-dx__run_soql_query,mcp__salesforce-dx__deploy_metadata,mcp__salesforce-dx__retrieve_metadata,mcp__salesforce-dx__get_username"
```

After they appear in a `<functions>` block they are callable like any other tool.

## Gotcha #2 — `directory` is required and must be a FULL path

Every tool takes a `directory` param. Use the absolute path of the repo whose
org/config you're working against. Keep using the same directory across calls
unless the task moves to another repo.

## Gotcha #3 — Resolve the org, don't guess the alias

Run `get_username` (with `defaultTargetOrg: true`) once to confirm the target
org, then pass its value as `usernameOrAlias` on every later call. NEVER invent
an alias.

## Gotcha #4 — Tooling API for metadata queries

For `ApexClass`, `CustomMetadata` / `*__mdt`, `ApexTestResult`, and similar
metadata objects, set `useToolingApi: true` on `run_soql_query`.

---

## Tool quick reference

| Tool | Use for |
|---|---|
| `run_apex_test` | Run Apex tests. `testLevel: "RunSpecifiedTests"` + `classNames` (and/or `methodNames`) for specific classes; `RunLocalTests` to skip managed pkgs; `RunAllTestsInOrg` for everything. Add `codeCoverage: true` for coverage, `verbose: true` for passing/failure detail, `async: true` to get a `testRunId` and read results later. |
| `run_soql_query` | SOQL against the org. `useToolingApi: true` for metadata objects. |
| `deploy_metadata` | Push local metadata. Leave `sourceDir`/`manifest` empty for "deploy my changes". Can run tests inline via `apexTests` or `apexTestLevel`. |
| `retrieve_metadata` | Pull metadata to local. Same vague-input rule as deploy. |
| `resume_tool_operation` | Resume a long-running deploy/test/scratch job by `jobId`. |
| `get_username` / `list_all_orgs` | Resolve the target org / list configured orgs. |
| `run_agent_test` | Agentforce tests only — not for Apex. |

---

## Typical Apex-test loop

1. Write / edit the test class locally.
2. `deploy_metadata` the changed classes (or deploy with `apexTests` to test in one shot).
3. `run_apex_test` — `testLevel: "RunSpecifiedTests"`, `classNames: [...]`,
   `codeCoverage: true`.
4. On failure, re-run with `verbose: true` to read the failing assertion/stack.

For discovery (existing test patterns, custom metadata rows), use
`run_soql_query` with `useToolingApi: true`.

---

## Checklist

- [ ] Loaded the needed `mcp__salesforce-dx__*` schemas via ToolSearch
- [ ] Resolved the org with `get_username`; passed its value as `usernameOrAlias`
- [ ] Passed an absolute `directory`
- [ ] Used `useToolingApi: true` for metadata/Apex/`*__mdt` queries
- [ ] Reached for MCP, not `sf` Bash, unless the MCP can't do it
