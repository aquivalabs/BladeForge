# Authoring — add or change a plugin, skill, metadata, and evals

The guided path is the `meta:new-skill` skill (new skill) and `meta:update-skill` skill
(refresh an existing skill's metadata). This page is the manual reference for when you
author by hand or Claude did not offer.

## Skill layout

Every skill lives at `plugins/<domain>/skills/<name>/` and carries three things:

```
plugins/<domain>/skills/<name>/
  SKILL.md                  # the skill itself
  metadata.yaml             # catalog sidecar (required)
  evals/trigger-eval.json   # trigger tests (required)
  references/               # optional: deep tables/examples (progressive disclosure)
```

The callable id is `<domain>:<name>` (the folder name is authoritative).

## SKILL.md

- Frontmatter is just `description:` — **no `name:` field**.
- `description:` states **when to use only** (triggering conditions, ideally opening
  "Use when…"). Do NOT summarize the workflow there — agents that read the description
  skip the body.
- Keep the body short; push deep tables/examples into `references/`.
- Examples are **fictional and generic** — never real class/object/org/ticket/repo names.
  This marketplace is public.

## metadata.yaml (how to create it)

The catalog is built from these sidecars; `gen_catalog` fails on a skill that has none.
Copy the shape from any existing skill and fill it in:

```yaml
schema-version: 1
purpose: One line — what the skill makes the agent do.
best-for: One line — the situations where reaching for it pays off.
needs: []          # other skills it depends on, as ["domain:name"], or [] if none
changes:
  tags: []         # side-effect tags; [] means read-only. e.g. writes-files, network, money, org
  notes: Plain-language description of any side effect, or "Read-only — …".
```

`changes.tags` / `changes.notes` are the honesty fields — `scout` surfaces them before it
recommends or installs a skill, so describe side effects accurately. When in doubt, run the
`meta:new-skill` interview; it fills these deliberately.

After editing metadata, regenerate the catalog locally to check it compiles:

```bash
python3 scripts/gen_catalog.py
```

## evals/trigger-eval.json (how to run them)

A trigger-eval is a list of natural-language queries, each labeled whether the skill's
`description` should fire. Cover both sides — real triggers and near-miss non-triggers:

```json
[
  {"query": "a request that SHOULD activate the skill", "should_trigger": true},
  {"query": "a plausible request that should NOT", "should_trigger": false}
]
```

Validate one file's shape locally:

```bash
python3 scripts/validate_eval.py plugins/<domain>/skills/<name>/evals/trigger-eval.json
```

On every PR, the **eval-gate** check validates the trigger-evals of the skills the PR
touched, and **scout-gate** checks the catalog is self-consistent. Both must pass to merge.

## Adding a whole new plugin (new domain)

1. Create `plugins/<domain>/.claude-plugin/plugin.json` with `name`, `description`,
   `version` (3-part semver), `keywords` (array), and `author`.
2. Add the skill folder(s) as above.
3. Enable it in the consuming repo's `.claude/settings.json → enabledPlugins`
   as `<domain>@bladeforge`.
4. Do not hand-edit `.claude-plugin/marketplace.json` or `catalog.json` — both are generated.

## Before you commit

- Every touched skill has an up-to-date `metadata.yaml` and a valid `trigger-eval.json`.
- `python3 scripts/gen_catalog.py` runs clean.
- Update `README.md`'s Skills section by hand if you added or renamed a skill.
- `cerberus:leak-check` runs automatically on skill edits — clear any real-identifier flag
  before shipping.
