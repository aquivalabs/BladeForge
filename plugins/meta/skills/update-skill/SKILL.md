---
description: "Use this skill to REFRESH the metadata.yaml sidecar of an ALREADY-EXISTING skill after its body, allowed-tools, bundled scripts, or hooks changed. Triggers for \"I edited skill X, refresh its metadata\", \"update the metadata.yaml after changing this skill\", \"this skill's behavior changed — does its metadata still match\", or noticing a scout sync-nudge after editing a SKILL.md/script. This is about RE-RUNNING the non-derivable-fields interview on a skill that already has a metadata.yaml, NOT about scaffolding a brand-new skill from scratch (that is `meta:new-skill`), and NOT about tuning an existing skill's trigger description or running skill-creator evals (that is the `skill-creator` plugin)."
---

# Update a Skill's metadata.yaml

A skill's `metadata.yaml` sidecar goes stale the moment its body, `allowed-tools`, bundled
`scripts/`, or `hooks/` change in a way that could affect what it does, needs, or touches. This
skill re-runs the authoring interview for the fields that cannot be derived automatically, without
re-scaffolding the skill itself.

## When to Activate

- The user says they changed an existing skill's behavior/tools/scripts/hooks and asks to refresh
  its metadata.
- The scout sync-nudge hook (`plugins/scout/hooks/on-skill-edit.py`) flags a just-edited
  `SKILL.md` or bundled script and the author is about to commit.
- NOT for creating a new skill (`meta:new-skill`) and NOT for tuning trigger wording or running
  eval benchmarks on an existing skill (`skill-creator`).

---

## Derivable vs non-derivable fields

Do **not** ask about these — re-copy or regenerate them silently:

| field | how it's handled |
|---|---|
| `schema-version` | Constant `1`. Always write `1`. |
| `activates-when` | NOT stored in `metadata.yaml` at all — the catalog compiler copies it verbatim from the `description:` frontmatter at build time. Never ask, never write it here. |

Everything else is human judgment and must be re-interviewed:

| field | rule |
|---|---|
| `purpose` | One-line human gloss. REQUIRED, non-blank. |
| `best-for` | Adoption-fit sentence. Optional — may be blank. |
| `needs` | Other skill ids (`<domain>:<name>`) this one depends on. `[]` if none. |
| `changes.tags` | MULTI-SELECT from the fixed glossary below. `[]` if the skill changes nothing. |
| `changes.notes` | Free text. REQUIRED non-blank if `other` is among `changes.tags`. |

`changes.tags` glossary (present these plain-language meanings when asking):

| tag | means |
|---|---|
| `git` | touches git — commits, pushes, branches, rewrites history |
| `files` | writes or edits files on disk |
| `network` | goes to the network — HTTP calls, downloads, external APIs |
| `org` | changes a Salesforce org — deploys, DML, writes records/metadata |
| `money` | moves money — payments, billing, real financial operations |
| `other` | none of the above — MUST be described in `changes.notes` |

---

## Steps

1. Read the skill's current `plugins/<domain>/skills/<name>/metadata.yaml` (if present) as the
   starting point for defaults — do not assume the old values are still true, just offer them.
2. Ask ONE field at a time, in the order above (`purpose` → `best-for` → `needs` →
   `changes.tags` → `changes.notes`), reusing the current value as a suggested default the human
   can accept or override.
3. Enforce the rules while asking: `purpose` non-blank; `changes.tags` is a multi-select from the
   fixed glossary (`[]` allowed); if `other` is selected, `changes.notes` must be non-blank.
4. Leave `schema-version: 1` and never touch/ask about `activates-when` — those are derived, not
   interviewed.
5. Write the sidecar **atomically** (temp file + rename, or equivalent) so a crash mid-write never
   leaves a half-written `metadata.yaml`.

```yaml
schema-version: 1
purpose: One-line human gloss — required, non-blank.
best-for: Adoption-fit sentence — optional, may be blank.
needs: [salesforce:dx_mcp]     # skill ids in this marketplace; [] = nothing
changes:
  tags: [org, network]         # multi-select from the glossary; [] = none
  notes: Free text.
```

---

## `# scout-ignore` convention

If a bundled script (`scripts/*.py`, `scripts/*.sh`) contains a mutation-looking line that the
scout gate would otherwise flag as a false positive (e.g. a `git push` string that never actually
runs), a trailing `# scout-ignore` comment on that exact line suppresses the flag. It is an
authored escape hatch for known false positives, not a way to hide real behavior — see the `scout`
skill for full guidance.

---

## Relationship to other skills

- **`meta:new-skill`** scaffolds a brand-new skill and runs this same interview once, at creation
  time. This skill (`meta:update-skill`) re-runs it later, after the skill already exists and has
  changed.
- **Trigger quality** (description wording / does it still fire) is orthogonal to whether
  `metadata.yaml` is stale — a change set may need both. Measure it with **`meta:skill-eval`** (its
  bundled `score-description.py`), NOT skill-creator's `run_eval`/`run_loop` (slash-command stub +
  first-tool-only → systematic false-negatives). If `meta:skill-eval` isn't installed, warn that it
  is required and ask the user to install it rather than falling back to the stub harness.
