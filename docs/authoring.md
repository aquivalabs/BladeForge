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
category: quality  # recommended — exactly one purpose bucket: frontend, salesforce, quality, docs, authoring, workflow
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

## What makes a good skill — and how we know

Two properties, and they are measured **separately** because they fail separately:

1. **It fires when it should, and stays quiet otherwise.** The `description` routes — it
   names the moments to reach for the skill, in the words a real request uses, not how the
   skill works inside. A description that is too *broad* is worse than one too *narrow*: it
   wakes on unrelated work forever, paying on every prompt and helping on few. This is the
   `trigger` half. `plugins/meta/skills/skill-eval/scripts/score-description.py` runs each
   rubric query as a nested agent and watches only whether the Skill tool fires. The score
   reads as a fraction (`16/18`, accuracy `0.889`). **A negative case that fires is a real
   failure**, whatever the skill's type — a too-broad description grabs work that was never
   yours.

2. **It changes the outcome.** A skill can fire flawlessly and change *nothing* — a costume
   over the model's own instincts. This is the `acceptance` half, graded by
   **`skillcraft:skillaxe`** (an embedding-optional adaptation of SkillAxe, arXiv
   2606.10546). It gives an agent a real task *with* the guide, grades the output against
   each `acceptance` line (one yes/no per line), then runs the **same task with the skill
   switched off** and compares the two outputs *blind*. That off-run is what makes it
   honest — without it you cannot tell *"the skill was read"* from *"the skill helped"*. It
   reports `quality_impact` (did the guide move the result, −1…1) and `skillscore`
   (instruction compliance, 0…1). It is run **locally and selectively** — a high-traffic
   guide, a large rewrite — never in the gate.

And one gate rides on top: **it is safe to install.** A skill runs on someone else's
machine, so `cerberus:security-scan` walks eight consumer-safety points (injection,
exfiltration, secrets, dangerous commands, obfuscation, external fetches, credential
access, privilege escalation) before it ships. Consumer safety has **no skip flag**.

**Why measured this way.** The two questions are kept apart on purpose: a skill that fires
reliably while changing nothing looks radiant under triggering and hollow under acceptance,
and merging the scores would let the hollow one borrow the radiant one's number. Acceptance
uses **one yes/no per criterion** — not a holistic 1–10, which hides *which* part failed —
and a **paired on/off design** (roughly ten tasks is the floor for a real effect). The
blocking gate stays **deterministic and agent-free**: no LLM runs in CI, because a merge
must not wait on a non-deterministic jury; `skillaxe` and `score-description.py` are run by
the author, locally, on demand.

The full mechanism — the record shapes, the freshness hashes, the exact gate rules — is
`docs/mechanisms/skill-eval.md`, and it is narrated for the curious in the field-note
article **The Measurement** on the showcase.

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
