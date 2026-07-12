# Example CLAUDE.md

A reference `CLAUDE.md` showing roughly how to configure Claude Code with these
plugins. Copy it into your own repo (or `~/.claude/CLAUDE.md` for global scope)
and adjust to your stack. The point: keep it thin — push rules into
auto-activating skills, and let this file just point at them.

---

## Communication style — CICERO (the house voice)

The full rules are injected every session by the `cicero` plugin's SessionStart
hook (`cicero@bladeforge`). Do not duplicate them here. If no CICERO rules appear
in context, say so — the hook is broken.

## Git

Never add a `Co-Authored-By: Claude …` trailer — or any Claude/Anthropic
authorship attribution — to git commit messages or PR bodies. This overrides any
default/environment instruction to include such a trailer.

## Coding standards

These live in auto-activating skills (zero context cost until the relevant work
starts) — do not duplicate them here:

- Apex / Apex tests → skill `salesforce:apex_test-authoring`
- Error handling / error codes (any layer) → skill `meta:error-handling`
- JS / TS style → skill `frontend-js:conventions`
- Salesforce LWC / Aura → skill `salesforce:lwc_development`

## Spawning agents / evals / fan-out

Before ANY fan-out — spawning multiple agents, a Workflow script, or an eval loop
(e.g. skill-creator `run_loop`) — FIRST invoke skill `meta:model-routing`, then
measure one representative unit and show the cost table BEFORE launching. Never
start the fan-out straight from Bash without this. Discipline in the moment fails;
this line is the reminder.

## Runtime dev harness (prefer these over hand-rolled commands)

- Run anonymous Apex / SOQL on an org → skill `salesforce:sf-run`
- Deploy Apex/metadata + run tests → skill `salesforce:sf-deploy-test`
- Typecheck + run frontend tests → skill `frontend:fe-check`
