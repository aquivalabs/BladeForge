---
description: "Use this skill to author a brand-new skill FROM SCRATCH \u2014 deciding its plugin/domain, folder name, file placement, and writing its SKILL.md, frontmatter, and initial metadata.yaml sidecar. Triggers for \"create/add/write a new skill for X\", \"where does the SKILL.md go\", \"what's the naming convention or folder structure for a new skill\", or \"what goes in the description frontmatter\". This is about scaffolding a NOT-YET-EXISTING skill's structure and location, NOT about tuning, evaluating, or fixing an EXISTING skill's trigger behavior (skill-creator), and NOT about refreshing an EXISTING skill's metadata.yaml after its body/tools/scripts/hooks changed \u2014 that is the separate `meta:update-skill` skill. Also NOT for ordinary code, components, or config in a project. If the skill already exists, use `meta:update-skill` or `skill-creator` instead."
---

# Create a New Skill

Skills live in a **marketplace plugin**, never as loose flat folders. A skill belongs to a domain
(the plugin); the domain is the folder, not a prefix on the skill name.

## Placement

```
plugins/<domain>/skills/<skill-name>/SKILL.md
plugins/<domain>/.claude-plugin/plugin.json      # one per domain
```

| Scope | Location |
|---|---|
| Shared across the org | this repo — `plugins/<domain>/skills/<name>/` (the `bladeforge` marketplace) |
| One specific repo only | that repo's `.claude/skills/<name>/` for a quick repo-local skill |

There are **no** flat `skills/<name>/` skills anymore, and nothing is "copied to a global location" —
a skill exists once, in its plugin, and is pulled via the marketplace.

## Naming convention

The skill **folder name** is just `<skill-name>` — the domain is already the plugin folder. Use an
optional subcategory prefix inside the name when a domain needs grouping.

Format: **`<subcategory>_<skill-name>`** (or plain **`<skill-name>`** when no subcategory).

In use, skills are **namespaced by domain**: `<domain>:<skill-name>`.

| Domain (plugin) | Skill folder | Used as |
|---|---|---|
| `frontend-css` | `rem`, `scss-modules` | `frontend-css:rem`, `frontend-css:scss-modules` |
| `frontend-js` | `conventions` | `frontend-js:conventions` |
| `frontend-react` | `component-structure`, `hooks-registry` | `frontend-react:component-structure`, `frontend-react:hooks-registry` |
| `git` | `commit` | `git:commit` |
| `meta` | `new-skill`, `ockham` | `meta:new-skill`, `meta:ockham` |

Within a domain the short name is fine (`commit`, `rem`) — the `<domain>:` namespace disambiguates, so
it never collides with a project's own skill. Split a broad domain into finer plugins
(`frontend-css`, `frontend-react`, `frontend-js`) when you want to enable subsets independently.

**No `name:` frontmatter field.** The skill folder name is authoritative and the callable id is derived
as `<domain>:<folder>` (e.g. folder `new-skill` in plugin `meta` → `meta:new-skill`). Do not add a
`name:` key — it is redundant, and a colon form (`meta:new-skill`) is invalid there anyway (the field
allows only `[a-z0-9-]`). Frontmatter is just `description:`.

---

## SKILL.md structure

```markdown
---
description: One sentence — used to decide when to activate this skill.
---

# Skill Title

## When to Activate

Describe the exact triggers: user phrases, file types, situations.

---

## Instructions

Step-by-step instructions for Claude to follow.
Use ## sections, code blocks, tables as needed.

---

## Checklist (optional)

- [ ] Item one
- [ ] Item two
```

---

## Steps

1. Pick the **domain** (existing plugin) the skill belongs to, and a `<name>` per the convention above.
2. Create `plugins/<domain>/skills/<name>/SKILL.md` using the structure above.
3. Make the `description:` frontmatter specific enough that Claude activates it only when truly relevant.
4. **New domain only:** also create `plugins/<domain>/.claude-plugin/plugin.json`
   (`{name, description, version, keywords, author:{name:"Roman Maslennikov"}}` — `version` is semver,
   `keywords` an array for marketplace discovery), then enable `<domain>@bladeforge` in the
   consuming repo's `.claude/settings.json → enabledPlugins`. `.claude-plugin/marketplace.json` is
   **generated** from each `plugin.json` by `sync.sh` — do not hand-edit it. Adding a skill to an
   existing domain needs no manifest change.
5. Add the skill's one-line entry to `README.md` by hand — the README is hand-maintained (`sync.sh`
   does not touch it). `sync.sh` runs on the PostToolUse hook whenever a `SKILL.md` or `plugin.json`
   changes: it regenerates `marketplace.json`, then commits + pushes.
6. **Run the metadata interview and write `plugins/<domain>/skills/<name>/metadata.yaml`.** Every
   skill ships this sidecar. Ask the human ONE field at a time, in this order:

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

   Do NOT ask about `activates-when` or `schema-version` — both are derivable, not authored:
   `activates-when` is copied verbatim from the `description:` frontmatter by the catalog compiler
   at build time, and `schema-version` is the constant `1`. Write the sidecar in one atomic step
   (temp file + rename, or equivalent) so a crash mid-write never leaves a half-written
   `metadata.yaml`:

   ```yaml
   schema-version: 1
   purpose: One-line human gloss — required, non-blank.
   best-for: Adoption-fit sentence — optional, may be blank.
   needs: [salesforce:dx_mcp]     # skill ids in this marketplace; [] = nothing
   changes:
     tags: [org, network]         # multi-select from the glossary; [] = none
     notes: Free text.
   ```

7. **Bundling a script the skill will call (`scripts/*.py`, `scripts/*.sh`)?** If a line in that
   script performs a mutation the scout gate would otherwise flag as suspicious (e.g. a stray
   `git push` in a helper that never actually runs it), you may suppress that one false-positive by
   adding a trailing `# scout-ignore` comment on that exact line — it is an authored escape hatch,
   not a way to hide real behavior. Full guidance on when this is appropriate lives in the `scout`
   skill; this is just the naming convention.
8. **Editing an EXISTING skill or plugin? Bump its `plugin.json` `version` (semver).** The installed
   plugin cache is keyed by version — `/plugin update` only reinstalls a plugin when its version
   changed. Edit a skill's body or description without bumping the owning plugin's `version` and the
   change lives in git + the marketplace but **never loads in a session**: the stale cache keeps
   serving the old copy and `reload-skills` reports "no changes". One bump per plugin per change set.
   (For refreshing an existing skill's `metadata.yaml` after a later edit, use `meta:update-skill`
   instead of repeating the interview here.)

---

## Quality & best practices

The deep, tested methodology for writing a good skill lives in **`superpowers:writing-skills`** — read it
before authoring anything non-trivial. Do not duplicate it here. The house-enforced essentials:

- **`description` = when, not what.** Triggering conditions only (ideally "Use when…"). Never summarize the
  workflow in the description — an agent that reads it will skip the body (tested anti-pattern).
- **Keep the body short; use `references/`.** Push deep tables/examples into `plugins/<domain>/skills/<name>/references/`
  and link one level deep — the SKILL.md stays an overview + quick-reference.
- **One excellent example beats five mediocre ones.** Show the canonical case fully; don't enumerate.
- **A result-producing skill MUST define acceptance criteria.** If the skill's point is to produce or
  shape an output — a generated artifact, a transformed file, a compliance/adherence outcome — it ships an
  explicit **Acceptance criteria** section: the checkable conditions that confirm the output is correct, so
  an author or reviewer verifies adherence instead of guessing at it. A purely advisory/convention skill
  that performs no measurable output may omit it (say so in its `changes` notes).
- **Examples must be fictional & generic.** This is a PUBLIC marketplace. Every example identifier — in the
  body, `references/`, and the eval fixtures (class/object/field/org/ticket/repo/component/route names) —
  must be invented for a neutral demo product (`Order__c`, `WidgetConfig`, `myOrg`, `/api/items`), reused
  across skills. NEVER paste a real name from a work codebase: a real identifier is a leak, not a better example.
- **Match the form to the failure.** If agents cut a corner under pressure, add a prohibition + a
  rationalization table ("thought → reality"); otherwise give a positive recipe.

Full house checklist (naming, plugin.json, sync, before-you-finalize) → `references/authoring-best-practices.md`.

---

## Evaluating / improving an existing skill

**Measure with `meta:skill-eval` — its bundled `score-description.py`. Do NOT use skill-creator's
`run_eval`/`run_loop`.** That harness registers the skill as a transient slash-command and counts a
trigger only if `Skill`/`Read` is the model's FIRST tool call, so real tasks (which open with
`Bash`/`Write`) and advisory/chained skills score a false ~0. `meta:skill-eval` installs the skill as
a REAL `.claude/skills/<name>/` and scores it honestly (0–10, current-vs-baseline, no-regression, with
a plain-language verdict).

**If `meta:skill-eval` is not installed**, do not fall back to skill-creator: emit a warning that
`meta:skill-eval` is required and ask the user to install it (enable the `meta` plugin from this
marketplace), then stop. See `meta:skill-eval` for how to read the score (context-dependent skills are
judged by no-regression, not the absolute number).
