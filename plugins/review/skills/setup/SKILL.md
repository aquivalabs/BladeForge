---
description: Install and target the pre-push review framework in a repo. Use when a repo has the review plugin but no .claude/review.config.json, when the user asks to set up the review gate / pre-push review / secret-scan CI, or when adopting the 5-agent /review system in a new project.
---

# Review framework setup

Installs the stack-agnostic review gate (5 reviewer agents + `/review` + secret-scan + attestation)
into the current repo and tailors it to the project.

## When to offer

If the current repo has NO `.claude/review.config.json` and the user is starting review/quality work,
offer to set it up: *"This repo has no review config — want me to install the pre-push review gate
(local husky + CI secret scan) and target it to this project?"* Only proceed on a yes.

## Install (one command)

From the root of the target repo, with no prior setup (needs the GitHub CLI, `gh auth login`):

```bash
bash <(gh api repos/AccountingSeedDev/claude-skills/contents/plugins/review/bootstrap.sh -H "Accept: application/vnd.github.raw")
```

`bootstrap.sh` shallow-clones this marketplace and runs `install.sh` against the repo. If the plugin is
already installed, you can run its installer directly instead: `bash "${CLAUDE_PLUGIN_ROOT}/install.sh"`.

This installs ONLY thin wiring — NO vendored harness. It writes `.husky/pre-push`,
`.github/workflows/review-gate.yml`, `.claude/review.config.schema.json`, and a seeded
`.claude/review.config.json` (only if absent — an existing one is never clobbered). It also **merges**
the marketplace + `review@<marketplace>` into the repo's committed `.claude/settings.json`, so teammates
get the plugin on a one-time trust/approve prompt. The gate itself is the published
`bladeforge-review-harness` npm package, fetched + run via `npx …@latest` (no `scripts/review/` in the
repo; upgrades arrive from npm automatically).

## Finish the setup

1. **Enable husky** (once per repo): `npm i -D husky && npx husky init` — then ensure `.husky/pre-push`
   is the one the installer wrote (re-copy if `husky init` overwrote it).
2. **CI base branch:** the workflow uses `origin/main`; if the repo's default branch differs, edit
   `--base` in `.github/workflows/review-gate.yml`.

## Tailor the config

**Fastest path — ask the stack, then wire skills.** Before hand-editing, ASK the adopter what the repo
uses (a multi-select question is ideal): JS/TS, SCSS, CSS (plain), Tailwind, React, Salesforce/Apex,
i18n, Node/BFF. Then fill each agent's `skills` from this map — MARKETPLACE skills only (every repo
with the org plugins enabled has them; a project-local hyphen-id skill is NOT safe to auto-wire):

| Answer | skills → dimension |
|---|---|
| JS/TS | `frontend-js:conventions` → craft · `frontend:fe-check` → tests |
| SCSS | `frontend-css:scss-modules`, `frontend-css:rem` → craft |
| CSS (plain) | `frontend-css:rem` → craft |
| Tailwind | `frontend-css:rem` → craft |
| React | `frontend-react:component-structure`, `frontend-react:hooks-registry`, `frontend-react:storybook-stories` → craft |
| Salesforce / Apex | `tests:apex` → tests · `salesforce:security_review-rules` → security |
| i18n | `i18n:ui-strings` → craft |
| always | `meta:solid` → craft · `meta:ockham` → craft |

After wiring from the answers, REMIND the adopter to add their PROJECT-LOCAL skills (their own
`.claude/skills/`, hyphen ids) on top — those encode repo-specific rules a generic map can't know.

For anything the questionnaire doesn't cover, hand-edit `.claude/review.config.json`
(schema: `./review.config.schema.json`). For each of the 5 agents (`craft`, `architecture`,
`tests`, `docs`, `security`), fill in what is project-specific — anything omitted falls back to sane
defaults:

- **checks** — deterministic commands `/review` runs once per round and hands to the lens as
  machine-verified facts, e.g. `{"name": "docs-check", "command": "python3 scripts/docs-check.py"}`
  on the docs lens. Wire the repo's own gate scripts here rather than letting the lens re-derive
  their verdicts by reading — measured: a docs lens spent 25 tool calls re-proving what the repo's
  paired-doc script decides in seconds. A failing check is evidence the lens weighs, never a gate.
- **skills** — project skill ids that encode its rules; the agent loads each. Discover from the repo's
  CLAUDE.md / available skills.
- **rules** — deterministic `{id, pattern, severity}` greps (forbidden patterns, required namespaces).
- **pairedDocs** (docs agent) — `{code, doc, severity}` map: when code matching `code` changes, `doc`
  must change too. Derive from the repo's doc/skill-sync conventions.
- **extensionSkill** — only when a rule is too complex for the fields above: point at a prose skill that
  spells it out (the escape hatch).

Keep thresholds at defaults (craft 7, architecture 8, tests 7, docs 8, security 9) unless the
project wants a different bar. After editing, run `/review` to confirm the gate runs end-to-end.

## Compatibility with older installs

The floor for this setup is `review@1.6.0`.

**Update the plugin first, then edit the config — never the other way round.** Below the floor, a
zoneless config does not fail loudly. It fails silently and green, which is the worst shape a gate
can fail in. The pre-1.6 command dispatches a lens only when a changed file matches one of its
`zones` globs, so a config with no `zones` on any agent matches nothing, ever: every lens is skipped,
each is carried at PASS 10, the secret scan is the only check that really runs, the overall verdict
comes back PASS, and the command writes and commits an attestation over a diff nobody reviewed.
Measured on a real repository, not reasoned about.

**Plugin pins are per project.** `/plugin update review` updates the project the session is open in
and no other. A second repository sharing the same marketplace keeps its old pin until someone opens
a session there and updates it. So the order above is per repository, not per marketplace: check the
pin in the repository you are about to migrate. `~/.claude/plugins/installed_plugins.json` records
one entry per project path, with its version.

A config naming `conventions`, `scavenger`, or carrying a `zones` array is deprecated once the
plugin is at or above the floor: the plugin dispatches whatever the config names, and a name with no
agent file behind it fails that lens's dispatch and reports a FAIL for it. That is the graceful case,
and it only holds above the floor.

The migration is four edits: rename `conventions` to `craft`; delete the `scavenger` entry; delete
every `zones` array; and — in a different file, `.claude/settings.json` — add
`review-workflow@<marketplace>` to `enabledPlugins` beside `review`. Enabling does not fetch, so the
plugin update is still a separate step and still comes first.
