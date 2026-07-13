# AGENTS.md — contributor contract for the bladeforge marketplace

Rules for any AI agent (or human) changing this repo. Read before editing.

## What this repo is
The `bladeforge` Claude Code plugin marketplace, owned by the `aquivalabs` GitHub org and published
publicly. Each `plugins/<domain>/` holds skills (`skills/<name>/SKILL.md`), and optionally
hooks/commands/agents. It is a standalone marketplace — the single source of truth for these skills.
Install any plugin as `<plugin>@bladeforge`.

## Hard rules
- **One problem per change.** A focused edit, not a grab-bag.
- **Prove the problem first.** Don't restructure tested skill content without evidence it improves behavior.
- **English only** in all artifacts (skills, docs, commit messages). Conversation language is the author's choice.
- **No `Co-Authored-By: Claude` / Anthropic attribution** trailers in commits or PR bodies.
- **Changes land via PR — no direct pushes to `main`.** The `scout-gate` and `eval-gate` checks must
  pass on the PR. On merge, the `scout-publish` workflow regenerates `catalog.json`, PATCH-bumps the
  affected plugin version(s), and pushes the result to `main` — no manual catalog or version step.
  See [docs/publishing.md](docs/publishing.md) for how auto-publish pushes to a protected `main`
  (a write deploy key allowed to bypass the `main-protection` ruleset).
- **`README.md` is hand-maintained** — update its "Skills" section by hand when you add/rename a skill.
- **Every `plugin.json` carries `name`, `description`, `version` (semver), `keywords`, `author`.**
- **Every skill carries `metadata.yaml` and `evals/trigger-eval.json`.** `gen_catalog` fails on a skill
  with no `metadata.yaml`, and `eval-gate` demands a `trigger-eval.json` for any skill the PR touches.

## SKILL.md authoring
- `description:` = **when to use only** (triggering conditions, ideally opening "Use when…"). Do NOT summarize
  the workflow in the description — agents that read the description skip the body (tested anti-pattern).
- **No `name:` frontmatter field** — the folder name is authoritative and the callable id is `<domain>:<folder>`
  (colon form is invalid in the field anyway). Frontmatter is just `description:`.
- Keep the body short; push deep tables/examples into a `references/` subfolder (progressive disclosure).
- **Examples are fictional & generic.** Class/object/field/org/ticket/repo/component names in the body,
  references, and eval fixtures must be invented for a neutral demo product — never real identifiers from a
  work codebase. This marketplace is PUBLIC; a real name is a leak, not a better example.
