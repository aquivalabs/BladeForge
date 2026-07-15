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
bash <(gh api repos/aquivalabs/BladeForge/contents/plugins/review/bootstrap.sh -H "Accept: application/vnd.github.raw")
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
| JS/TS | `frontend-js:conventions` → conventions · `frontend:fe-check` → tests |
| SCSS | `frontend-css:scss-modules`, `frontend-css:rem` → conventions |
| CSS (plain) | `frontend-css:rem` → conventions |
| Tailwind | `frontend-css:rem` → conventions |
| React | `frontend-react:component-structure`, `frontend-react:hooks-registry`, `frontend-react:storybook-stories` → conventions |
| Salesforce / Apex | `salesforce:apex_test-authoring` → tests · `salesforce:security_review-rules` → security |
| i18n | `i18n:ui-strings` → conventions |
| always | `meta:solid` → conventions · `meta:ockham` → scavenger |

After wiring from the answers, REMIND the adopter to add their PROJECT-LOCAL skills (their own
`.claude/skills/`, hyphen ids) on top — those encode repo-specific rules a generic map can't know.

For anything the questionnaire doesn't cover, hand-edit `.claude/review.config.json`
(schema: `./review.config.schema.json`). For each of the 5 agents (`conventions`, `architecture`,
`tests`, `docs`, `security`), fill in what is project-specific — anything omitted falls back to sane
defaults:

- **zones** — globs each agent reviews. Scan the repo's source layout (e.g. `src/**`, `server/**`).
- **skills** — project skill ids that encode its rules; the agent loads each. Discover from the repo's
  CLAUDE.md / available skills.
- **rules** — deterministic `{id, pattern, severity}` greps (forbidden patterns, required namespaces).
- **pairedDocs** (docs agent) — `{code, doc, severity}` map: when code matching `code` changes, `doc`
  must change too. Derive from the repo's doc/skill-sync conventions.
- **extensionSkill** — only when a rule is too complex for the fields above: point at a prose skill that
  spells it out (the escape hatch).

Keep thresholds at defaults (conventions 7, architecture 8, tests 7, docs 8, security 9) unless the
project wants a different bar. After editing, run `/review` to confirm the gate runs end-to-end.
