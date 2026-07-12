# Example CLAUDE.md

A reference `CLAUDE.md` showing roughly how to configure Claude Code with these
plugins. Copy it into your own repo (or `~/.claude/CLAUDE.md` for global scope)
and adjust to your stack. The point: keep it thin — push rules into
auto-activating skills, and let this file just point at them. The list below is
not exhaustive; it names the skills you reach for most as the marketplace grows.

---

## Communication style — CICERO (the house voice)

The full rules are injected every session by the `cicero` plugin's SessionStart
hook (`cicero@bladeforge`). Do not duplicate them here. If no CICERO rules appear
in context, say so — the hook is broken.

## Git

Never add a `Co-Authored-By: Claude …` trailer — or any Claude/Anthropic
authorship attribution — to git commit messages or PR bodies. This overrides any
default/environment instruction to include such a trailer.

- Splitting work into atomic, conventional commits → skill `git:commit`

## Coding standards

These live in auto-activating skills (zero context cost until the relevant work
starts) — do not duplicate them here:

- Apex / Apex tests → skill `salesforce:apex_test-authoring`
- Salesforce LWC / Aura → skill `salesforce:lwc_development`
- JS / TS style → skill `frontend-js:conventions`
- React components (placement, structure, hooks, primitives) → skill `frontend-react:component-placement`
- CSS / SCSS — rem units, modules, tokens → skills `frontend-css:rem`, `frontend-css:scss-modules`
- Error handling / error codes (any layer) → skill `meta:error-handling`
- User-facing strings (i18n) → skill `i18n:ui-strings`
- Design law before creating an entity → skills `meta:ockham`, `meta:solid`

## Docs, diagrams & tickets

- Terse specs / design docs → skill `meta:lean-writing`; clarity audit → skill `meta:wittgenstein`
- Architecture / flow diagrams → skill `diagram:diagram`
- Jira comments → skill `jira:comment-style`
- Authoring a brand-new skill → skill `meta:new-skill`

## Spawning agents / evals / fan-out

Before ANY fan-out — spawning multiple agents, a Workflow script, or an eval loop
(e.g. skill-creator `run_loop`) — FIRST invoke skill `meta:model-routing`, then
measure one representative unit and show the cost table BEFORE launching. Never
start the fan-out straight from Bash without this. Discipline in the moment fails;
this line is the reminder. For a big repo-wide sweep, sort cheaply first → skill `meta:triage`.

## Review gate & leak guard

- Pre-push review (security, architecture, conventions, tests, docs) → skill `review:setup` / the `/review` command
- Skill / reference / eval edits get scrubbed of real client identifiers before they ship → skill
  `cerberus:leak-check` (fires automatically via the `cerberus` PostToolUse hook — nothing to invoke)

## Runtime dev harness (prefer these over hand-rolled commands)

- Any org interaction — SOQL, tests, deploy/retrieve → skill `salesforce:dx_mcp`
- Run anonymous Apex / SOQL on an org → skill `salesforce:sf-run`
- Deploy Apex/metadata + run tests (CLI fallback) → skill `salesforce:sf-deploy-test`
- Typecheck + run frontend tests → skill `frontend:fe-check`
