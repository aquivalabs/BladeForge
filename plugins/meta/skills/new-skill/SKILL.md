---
description: "Use this skill to author a brand-new skill from scratch \u2014 deciding its plugin/domain, folder name, file placement, and writing its SKILL.md and frontmatter. Triggers for \"create/add/write a skill for X\", \"where does the SKILL.md go\", \"what's the naming convention or folder structure for a new skill\", or \"what goes in the description frontmatter\". This is about scaffolding a new skill's structure and location, NOT about tuning, evaluating, or fixing an existing skill's trigger behavior, and NOT about ordinary code, components, or config in a project. If the task is improving, optimizing, or running evals on a skill that already exists, do not use this skill."
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
   (`{name, description, version, keywords, author:{name:"Aquiva"}}` — `version` is semver,
   `keywords` an array for marketplace discovery), then enable `<domain>@bladeforge` in the
   consuming repo's `.claude/settings.json → enabledPlugins`. `.claude-plugin/marketplace.json` is
   **generated** from each `plugin.json` by `sync.sh` — do not hand-edit it. Adding a skill to an
   existing domain needs no manifest change.
5. Add the skill's one-line entry to `README.md` by hand — the README is hand-maintained (`sync.sh`
   does not touch it). `sync.sh` runs on the PostToolUse hook whenever a `SKILL.md` or `plugin.json`
   changes: it regenerates `marketplace.json`, then commits + pushes.
6. **Editing an EXISTING skill or plugin? Bump its `plugin.json` `version` (semver).** The installed
   plugin cache is keyed by version — `/plugin update` only reinstalls a plugin when its version
   changed. Edit a skill's body or description without bumping the owning plugin's `version` and the
   change lives in git + the marketplace but **never loads in a session**: the stale cache keeps
   serving the old copy and `reload-skills` reports "no changes". One bump per plugin per change set.

---

## Quality & best practices

The deep, tested methodology for writing a good skill lives in **`superpowers:writing-skills`** — read it
before authoring anything non-trivial. Do not duplicate it here. The house-enforced essentials:

- **`description` = when, not what.** Triggering conditions only (ideally "Use when…"). Never summarize the
  workflow in the description — an agent that reads it will skip the body (tested anti-pattern).
- **Keep the body short; use `references/`.** Push deep tables/examples into `plugins/<domain>/skills/<name>/references/`
  and link one level deep — the SKILL.md stays an overview + quick-reference.
- **One excellent example beats five mediocre ones.** Show the canonical case fully; don't enumerate.
- **Examples must be fictional & generic.** This is a PUBLIC marketplace. Every example identifier — in the
  body, `references/`, and the eval fixtures (class/object/field/org/ticket/repo/component/route names) —
  must be invented for a neutral demo product (`Order__c`, `WidgetConfig`, `myOrg`, `/api/items`), reused
  across skills. NEVER paste a real name from a work codebase: a real identifier is a leak, not a better example.
- **Match the form to the failure.** If agents cut a corner under pressure, add a prohibition + a
  rationalization table ("thought → reality"); otherwise give a positive recipe.

Full house checklist (naming, plugin.json, sync, before-you-finalize) → `references/authoring-best-practices.md`.

---

## Improving an existing skill

Use the **`skill-creator` plugin** for iterative improvement with test cases, evals, benchmarks, and
description optimization. Invoke it via `/skill-creator` or let it trigger when you say "improve this
skill", "optimize skill description", or "run evals on this skill".
