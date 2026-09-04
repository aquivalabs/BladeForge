---
description: "Use this skill to author a brand-new skill FROM SCRATCH \u2014 deciding its plugin/domain, folder name, file placement, and writing its SKILL.md, frontmatter, and initial metadata.yaml sidecar. Triggers for \"create/add/write a new skill for X\", \"where does the SKILL.md go\", \"what's the naming convention or folder structure for a new skill\", or \"what goes in the description frontmatter\" \u2014 including standing up a NEW domain plugin with its plugin.json, and choosing between a marketplace skill and one local to a single repo. This is about scaffolding a NOT-YET-EXISTING skill's structure and location, NOT about tuning, evaluating, or fixing an EXISTING skill's trigger behavior (skill-creator), and NOT about refreshing an EXISTING skill's metadata.yaml after its body/tools/scripts/hooks changed \u2014 that is the separate `meta:update-skill` skill. Also NOT for ordinary code, components, or config in a project. If the skill already exists, use `meta:update-skill` or `skill-creator` instead."
---

# Create a New Skill

## Contract

**In:** a skill that does not exist yet · the marketplace repo · a person to answer the
authoring questions · a domain, existing or about to be created.

**Out:** `plugins/<domain>/skills/<name>/` holding `SKILL.md`, `metadata.yaml`,
`evals/trigger-eval.json` and `evals/acceptance.json` (plus `evals/result.json` once measured) ·
a one-line entry in `README.md` · for a new domain, its `plugin.json` · the owning plugin's version bumped.

---

Skills live in a **marketplace plugin**, never as loose flat folders. A skill belongs to a domain
(the plugin); the domain is the folder, not a prefix on the skill name.

## Placement

```
plugins/<domain>/skills/<skill-name>/SKILL.md
plugins/<domain>/.claude-plugin/plugin.json      # one per domain
```

| Scope | Location |
|---|---|
| Shared across the org | this repo — `plugins/<domain>/skills/<name>/` (the `accountingseed` marketplace) |
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
description: Use when <triggering conditions>. <One phrase of purpose.>
             <Do NOT use for Y (use Z instead) — only if a competing skill exists.>
---

# Skill Title

## Contract

**In:** what must be in place before this can be used.
**Out:** what exists afterwards — a printed line, a file, a property of the code.

---

## Instructions

Step-by-step instructions for Claude to follow.
Use ## sections, code blocks, tables as needed.

---

## Before you finish

1. Run <the check> → expect <result>.
2. Not clean? Fix it and repeat from 1.
3. You are done only when every line holds.
```

**There is no `## When to Activate` section.** It duplicates the `description`, and the body is read
only AFTER the skill has been chosen — by which point activation already happened. Anything genuinely
about triggering belongs in the `description`; anything else is ordinary body prose.

`## Before you finish` is a PROCEDURE — take this, run that, what counts as clean. The list of
expectations is not repeated there; it lives once, in `evals/acceptance.json`.

---

## Steps

1. **Answer the nine questions first, with the human — before writing any body.** The answers ARE the
   contract, the boundary and the acceptance criteria; written afterwards they get invented to fit
   whatever was already typed. Full worked examples → `references/authoring-method.md`.

   ```text
   WHY IT EXISTS
     1a  Name ONE live occasion where it should fire. Not a category — what are you
         actually doing at that moment.
     1b  What comes out in that case WITHOUT it? Show it, don't describe it.
     1c  And WITH it? Show that too.

   HOW IT IS USED
     2a  What has to be in place for it to work at all?
     2b  What exists at the end? Show it literally.
     2c  What checks that? Name a command — or, if there is none, say where to look.

   THIS ONE, OR THE NEIGHBOUR
     3a  Take one query it must fire on. Who else answers it? Name them.
     3b  If someone did — which of you wins, and under what condition?
     3c  What work looks like yours but isn't? Name it, and whose it is.
   ```

   If 1b shows no problem, **the skill should not exist** — say so and stop. That is the whole point
   of asking 1b first, and it is what both Anthropic's guidance and `superpowers:writing-skills`
   demand before a line is written.

   Where the answers land: 1b/1c → the eval queries · 2a/2b → `## Contract` · 2c →
   `## Before you finish` and `evals/acceptance.json` · 3b → the boundary sentence in the
   `description` · 3c → the negative eval cases.

2. Pick the **domain** (existing plugin) the skill belongs to, and a `<name>` per the convention above.
3. Create `plugins/<domain>/skills/<name>/SKILL.md` using the structure above.
4. Make the `description:` frontmatter specific enough that Claude activates it only when truly relevant.
5. **New domain only:** also create `plugins/<domain>/.claude-plugin/plugin.json`
   (`{name, description, version, keywords, author:{name:"AccountingSeed"}}` — `version` is semver,
   `keywords` an array for marketplace discovery), then enable `<domain>@accountingseed` in the
   consuming repo's `.claude/settings.json → enabledPlugins`. `.claude-plugin/marketplace.json` is
   **hand-maintained** — add the entry yourself. There is no generator: `sync.sh` was deleted in
   `c4f210e` and nothing replaced it. The `marketplace-sync` CI check only verifies that every
   `plugins/<name>/` has an entry and vice versa; it never compares the description text, so drift
   there is silent. Adding a skill to an existing domain needs no manifest change.
6. Add the skill's one-line entry to `README.md` by hand. Nothing generates it, and nothing
   generates `marketplace.json` either. What IS generated is `catalog.json`, rebuilt by
   `scripts/gen_catalog.py` and pushed by the `scout-publish` workflow after a merge — run it
   locally to check your `metadata.yaml` compiles.
7. **Run the metadata interview and write `plugins/<domain>/skills/<name>/metadata.yaml`.** Every
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

   **Tag by what the skill CAN do when fully used, not just its default path.** A skill that only reads
   by default but conditionally shells out to git / `gh` / an API when the user asks still carries that
   tag — say the default is read-only in `changes.notes`. Under-tagging a latent mutation is the failure
   here, not over-tagging.

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

8. **Write `evals/trigger-eval.json`** — the queries that test *whether the skill fires*. An array of
   `{query, should_trigger}`: the positives come from answer 1b/1c, the negatives from 3c (the work that
   looks like yours but isn't). A handful each — enough to pin both edges of the boundary.

   ```json
   [
     { "query": "convert the px in this stylesheet to rem", "should_trigger": true },
     { "query": "make these sizes scale with the base font", "should_trigger": true },
     { "query": "fix the border-width on this chart svg", "should_trigger": false }
   ]
   ```

9. **Write `evals/acceptance.json`** — the list of expectations about the RESULT, straight from
   answer 2c. Its own file, not a field in the trigger eval: that one answers *did the skill fire*,
   this one answers *did the result come out right*, and merging them lets a skill that fires
   reliably while changing nothing read as green.

   ```json
   [
     "no px remains in sizes or spacing in the changed styles",
     "every size is expressed in rem against a 16px base"
   ]
   ```

   A skill that produces nothing to check — one that only explains how a system is built — writes the
   reason instead, and the gate lets it through:

   ```json
   { "not-applicable": "explains the data-router; produces nothing to check" }
   ```

10. **Bundling a script the skill will call (`scripts/*.py`, `scripts/*.sh`)?** If a line in that
   script performs a mutation the scout gate would otherwise flag as suspicious (e.g. a stray
   `git push` in a helper that never actually runs it), you may suppress that one false-positive by
   adding a trailing `# scout-ignore` comment on that exact line — it is an authored escape hatch,
   not a way to hide real behavior. Full guidance on when this is appropriate lives in the `scout`
   skill; this is just the naming convention.
11. **Editing an EXISTING skill or plugin? Bump its `plugin.json` `version` (semver).** The installed
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

- **`description`: purpose is allowed, procedure is not.** Triggering conditions plus ONE phrase of
  what the thing is. Never the steps — a description reading *"dispatches subagent per task with code
  review between tasks"* made an agent run ONE review and never open the body, where the flowchart
  showed two. Rewritten without the workflow, the same agent read the body and did both. A procedure
  in the description is a shortcut agents take.
- **The boundary goes in the `description` too, if a competitor exists.** `Use when X. Do NOT use for
  Y (use Z instead).` It belongs there because the description is the only text read BEFORE the skill
  is chosen — a boundary in the body arrives after the decision it was meant to inform. State a
  CONDITION, not territory: where two skills share ground, "I own X" settles nothing, but "anonymous
  Apex is mine, the MCP has no tool for it" does.
- **Keep the body short; use `references/`.** Push deep tables/examples into `plugins/<domain>/skills/<name>/references/`
  and link one level deep — the SKILL.md stays an overview + quick-reference.
- **One excellent example beats five mediocre ones.** Show the canonical case fully; don't enumerate.
- **Three places, no duplication between them.** `## Contract` says WHAT is promised.
  `## Before you finish` says HOW to check it — steps, not claims. `evals/acceptance.json` holds the
  LIST of expectations, once. Every skill carries all three; one that produces nothing to check writes
  `not-applicable` with a reason in the acceptance file rather than skipping it.
- **500 lines is not a limit, it is a question.** Both Anthropic and Cursor name the number, neither
  measured it. Ask instead: is there anything here that is NOT needed on every firing? If yes, move it
  to `references/`. If no, the length is earned — record in one line why. Extract one level deep only,
  and each extracted file must stand alone: an agent may read only its first hundred lines.
- **A skill replacing another states the old id in its first lines**, so a search for the old name
  lands on the new page. No metadata field for this — one occurrence in this repo's history, and prose
  did the job.
- **Examples must be fictional & generic.** This is a PUBLIC marketplace. Every example identifier — in the
  body, `references/`, and the eval fixtures (class/object/field/org/ticket/repo/component/route names) —
  must be invented for a neutral demo product (`Order__c`, `WidgetConfig`, `myOrg`, `/api/items`), reused
  across skills. NEVER paste a real name from a work codebase: a real identifier is a leak, not a better example.
- **Match the form to the failure.** If agents cut a corner under pressure, add a prohibition + a
  rationalization table ("thought → reality"); otherwise give a positive recipe.
- **The scaffold enforces shape, not completeness — check the content too, by name.** Contract /
  Instructions / Before-you-finish guarantee the page is well-formed, not that it says everything it
  should. A vague "add what a practitioner would" gets read narrowly and changes nothing — so name the
  categories to check for explicitly: (a) a secrets/PII guard if the skill ever handles a diff, log, or
  user data; (b) an anti-fabrication line if it produces prose from evidence ("every claim maps to a
  real change, nothing invented"); (c) a scope/edge-case judgment call the happy path hides. A
  guide-compliant skill can still be thinner than one written freehand — this is where that gap closes.
- **Shortening is not licence to drop correctness.** When you trim a body to satisfy "keep it short",
  the first things to go are usually the ones that matter most — a boundary clause naming a competitor
  skill, a correctness check, a second worked example. Length may fall; the boundary sentence, the
  correctness checks, and at least one example must survive. If a cut removes one of those, it is the
  wrong cut.

Full house checklist (naming, plugin.json, sync, before-you-finalize) → `references/authoring-best-practices.md`.
The nine questions with worked examples, and the evidence behind every rule above →
`references/authoring-method.md`.

---

## Measuring — a step, not a suggestion

**Invoke `meta:skill-eval` and follow it.** Do not just run a command you remember: that skill
decides `--type` (a context-dependent skill is judged by no-regression, not by its absolute score),
forbids skill-creator's `run_eval`/`run_loop` (it counts a trigger only when `Skill`/`Read` is the
first tool call, so real tasks score a false ~0), and states what counts as a failure — a
should-NOT-trigger query that fires is a real defect, not a rounding error.

**A guide skill also needs its EFFECT measured, not just its trigger.** `meta:skill-eval` scores
whether the description fires; it says nothing about whether the guidance improves the output once it
does. If this skill's job is to shape what an agent produces — an authoring guide, a review lens, a
house-convention skill — also invoke **`skillcraft:skillaxe`**: a with/without run that scores the
guide's real effect and attributes each shortfall to the guide or the agent. Skip it only for a skill
that produces nothing to shape.

**Run its script from the repository, not from the installed plugin cache.** The cache is keyed by
version and lags behind: a cached copy predating the `result.json` repair prints a score and saves
nothing, which is the exact regression this marketplace already suffered once.

```bash
python3 plugins/meta/skills/skill-eval/scripts/score-description.py \
  --skill-path <skill-dir> --type self-contained
```

**If `meta:skill-eval` is not installed at all**, say it is required, ask for the `meta` plugin to be
enabled, and stop. Do not measure with skill-creator instead — a wrong harness produces the false
zeros the skill exists to prevent, and a false zero is worse than no number.

**If there is no live clone to run the script from** (drafting in a sandbox or detached worktree, no
`scripts/` reachable), do not silently drop the file: say so in the handoff and leave
`evals/result.json` marked pending, so the measurement is visibly owed rather than quietly skipped.
Silently omitting it is the failure this section exists to prevent.

---

## Before you finish

1. `ls plugins/<domain>/skills/<name>/` → `SKILL.md`, `metadata.yaml`, `evals/trigger-eval.json`,
   `evals/acceptance.json`, and `evals/result.json` once measurement has run (or a pending note per the
   Measuring section if no clone was reachable). The four authored files must all be present;
   `result.json` is produced by the measurement step, not authored. Missing an authored file means you are not done.
2. The body has exactly one `## Contract` heading and no `## When to Activate` heading. A plain
   `grep` over-counts on any skill that quotes markdown in an example — read the hits rather than
   trusting the number.
3. `python3 scripts/gen_catalog.py` → exits clean.
4. `python3 scripts/validate_eval.py plugins/<domain>/skills/<name>/evals/trigger-eval.json` → prints
   a hash rather than an error.
5. The owning `plugin.json` version is bumped — without it the skill never loads in a session.
6. `meta:skill-eval` was invoked and its script run from the repo → `evals/result.json` exists, no
   should-NOT-trigger query fired, and the verdict was read rather than glanced at.
7. Any line failing? Fix it and start again from 1.
