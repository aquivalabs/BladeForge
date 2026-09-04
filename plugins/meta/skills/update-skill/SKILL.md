---
description: "Use when a skill ALREADY EXISTS and something about it needs changing: its body, its `description` or boundary wording, a missing `## Contract` or acceptance criteria, or a `metadata.yaml` sidecar that no longer matches what the skill does after its allowed-tools, bundled scripts or hooks changed. Noticing that something no longer matches belongs here too \u2014 checking whether a sidecar still agrees with reality, auditing a skill against the house standard, judging that a description reads like a workflow summary \u2014 and so does the rewrite that follows. Do NOT use to author a skill that does not exist yet (use `meta:new-skill`). `meta:skill-eval` owns exactly one action, RUNNING a trigger evaluation and scoring it; a review lens only REPORTS a defect. Deciding what is wrong and changing the files is this skill."
---

# Update an Existing Skill

## Contract

**In:** a skill that already exists — a marketplace one at `plugins/<domain>/skills/<name>/`, or a
repo-local one at `.claude/skills/<name>/` · a reason it is being touched · a person to answer the
questions the change reopens.

**Out:** the skill conforms to the standard — `## Contract` at the top of the body, the boundary in
the `description`, `## Before you finish` at the bottom, no `## When to Activate` anywhere ·
`evals/acceptance.json` present · for a marketplace skill, a `metadata.yaml` that matches what the
skill now does, and the owning `plugin.json` version bumped.

---

## Two paths, and the skill picks — not the author

Run this first. It decides which path you are on, and it overrides what the request asked for:

```bash
D=plugins/<domain>/skills/<name>          # or .claude/skills/<name>
grep -c '^## Contract' $D/SKILL.md
grep -c '^## Before you finish' $D/SKILL.md
grep -c '^## When to Activate' $D/SKILL.md
ls $D/evals/acceptance.json
```

| what the probe found | path |
|---|---|
| any of the four is wrong — no Contract, no closing check, a When-to-Activate present, no acceptance file | **A — bring it to standard.** Mandatory, whatever the request said |
| all four are right, and only tools / scripts / hooks / wiring changed | **B — sidecar only** |

A request to "just refresh the metadata" on a skill that fails the probe is a request to leave it
non-conforming. Do path A, and say that is what you are doing.

---

## Path A — bring it to standard

### Which questions reopen, and which do not

The nine questions belong to `meta:new-skill`; this skill re-asks only the ones the change touched.
Full text and worked examples → `meta:new-skill`, `references/authoring-method.md`.

| conversation | on an update |
|---|---|
| 1 — why it exists (1a–1c) | **Not re-asked.** Answered once, at birth. READ it out of the existing body and state it back in one line so the human can object |
| 2 — how it is used (2a–2c) | **Always re-asked.** This IS the contract, and it changes with the skill |
| 3 — this one, or the neighbour (3a–3c) | Only where a real competitor exists — 11 pairs of 990 measured in this marketplace |

**If conversation 1 cannot be read out of the body**, stop and say so. A skill whose without-it case
shows no problem should be deleted, not improved. That is a finding, not a blocker to work around.

### What to write, and where each thing goes

Three places, and nothing appears in two of them:

```text
## Contract, top of the body        WHAT is promised — In and Out, from 2a and 2b
## Before you finish, bottom        HOW to check — steps: run this, look at that, from 2c
evals/acceptance.json               the LIST of expectations about the result, also from 2c
```

`## Before you finish` is a procedure that loops, never a list of claims:

```markdown
## Before you finish

1. Run `<the check>` → expect `<result>`.
2. Not clean? Fix it and repeat from 1.
3. You are done only when every line holds.
```

`evals/acceptance.json` is an array of expectations about the RESULT — not about the skill firing.
A skill that produces nothing to check declares that, and the gate lets it through:

```json
{ "not-applicable": "explains how the widget cache is built; produces nothing to check" }
```

### Delete `## When to Activate`

It duplicates the `description` and is read only AFTER the skill was chosen — after the moment it
describes. Measured across this marketplace: present in 23 of 45 skills, and in `frontend-css:rem`
the two copies had already drifted apart.

Anything in it that is genuinely about triggering moves into the `description`. Everything else is
ordinary body prose or goes.

### Fix the `description` while you are here

- **Purpose is allowed, procedure is not.** "Runs anonymous Apex" is fine; "resolves the token, then
  hits the endpoint, then formats" is the failure. A description that summarised a workflow made an
  agent run ONE review and never open the body, where the flowchart showed two.
- **The boundary lives here, not in the body**, and only if a real competitor exists:
  `Use when X. Do NOT use for Y (use Z instead).` State a CONDITION, not territory — where two skills
  share ground, "I own X" settles nothing, but "anonymous Apex is mine, the MCP has no tool for it"
  does.
- Changing the description changes what the trigger eval measures. Add or fix cases in
  `evals/trigger-eval.json` in the same edit, including a negative case for whatever 3c named.

### A repo-local skill has no sidecar

`.claude/skills/<name>/` skills live outside the marketplace: no `metadata.yaml`, no catalog, no
`plugin.json` to bump. They still get the body work and `evals/acceptance.json` — the file is where
the skill's "done" is written down, and it costs nothing to keep it beside a local skill. Skip path B
entirely for them.

---

## Path B — the sidecar interview

Two fields are derived, never asked:

| field | how it is handled |
|---|---|
| `schema-version` | the constant `1` |
| `activates-when` | NOT stored here at all — the catalog compiler copies it verbatim from the `description:` frontmatter at build time |

The rest is human judgment. Read the current `metadata.yaml` first and offer each existing value as a
default the human accepts or overrides — do not assume it is still true. Ask ONE field at a time, in
this order:

| field | rule |
|---|---|
| `purpose` | One-line human gloss. REQUIRED, non-blank. |
| `best-for` | Adoption-fit sentence. Optional — may be blank. |
| `needs` | Other skill ids (`<domain>:<name>`) this one depends on. `[]` if none. |
| `changes.tags` | MULTI-SELECT from the fixed glossary below. `[]` if the skill changes nothing. |
| `changes.notes` | Free text. REQUIRED non-blank if `other` is among `changes.tags`. |

`changes.tags` glossary — present these plain-language meanings when asking:

| tag | means |
|---|---|
| `git` | touches git — commits, pushes, branches, rewrites history |
| `files` | writes or edits files on disk |
| `network` | goes to the network — HTTP calls, downloads, external APIs |
| `org` | changes a Salesforce org — deploys, DML, writes records/metadata |
| `money` | moves money — payments, billing, real financial operations |
| `other` | none of the above — MUST be described in `changes.notes` |

Write the file in one atomic step (temp file + rename, or equivalent) so a crash mid-write never
leaves a half-written sidecar:

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

## Bump the version, or the edit never loads

The installed plugin cache is keyed by version: `/plugin update` reinstalls a plugin only when its
`version` changed. Edit a skill without bumping the owning `plugin.json` and the change lives in git
and in the marketplace but **never reaches a session** — the stale cache keeps serving the old copy
and `reload-skills` reports "no changes". One bump per plugin per change set, semver.

`README.md` is hand-maintained and so is `.claude-plugin/marketplace.json`; nothing generates either.
If the skill's one-line README entry no longer describes what it does, fix it in the same change. The
`marketplace-sync` CI check only verifies that an entry exists — it never compares the text, so drift
there is silent.

---

## `# scout-ignore`

A bundled script may contain a mutation-looking line the scout gate flags as a false positive — a
`git push` string in a helper that never runs it. A trailing `# scout-ignore` on that exact line
suppresses the flag. It is an authored escape hatch for a known false positive, never a way to hide
real behaviour. Full guidance → the `scout` skill.

---

## Fix the class, not the finding

When a review or an audit returns a defect in a skill, grep the same claim across every skill before
fixing the one you were shown. Measured here: four review rounds chased a stale lens count through
nine files one at a time; a single grep after the FIRST finding surfaced eleven places at once,
including a shared block copied verbatim into every lens.

---

## Neighbours

- **`meta:new-skill`** — the skill does not exist yet. It owns the nine questions and the folder
  scaffold; this skill re-asks only what an update reopens.
- **`meta:skill-eval`** — whether the description still fires. Orthogonal to whether the body and the
  sidecar are honest, so a change set usually needs both. How to run it → the next section.
- **`skillcraft:skillaxe`** — whether the guidance, once it fires, actually improves the output.
  Orthogonal to both trigger and honesty; run it after reworking a skill whose job is to shape a
  result, to confirm the rewrite helped and dropped nothing that worked.

---

## Measuring — a step, not a suggestion

**Invoke `meta:skill-eval` and follow it.** Do not just run a command you remember: that skill
decides `--type` (a context-dependent skill is judged by no-regression, not by its absolute score),
forbids skill-creator's `run_eval`/`run_loop` (it counts a trigger only when `Skill`/`Read` is the
first tool call, so real tasks score a false ~0), and states what counts as a failure — a
should-NOT-trigger query that fires is a real defect, not a rounding error.

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

**The measurement is not optional and has no escape hatch.** If there is no live clone to run the
script from (a sandbox or detached worktree with no `scripts/` reachable), the update is **not
finished** — get a working clone and run the measurement before you call it done. Do not skip it, do
not defer it, do not write a placeholder `result.json`. Shipping an unmeasured description change is
the failure this section exists to prevent.

---

## Before you finish

1. `grep -c '^## Contract' <skill>/SKILL.md` → `1`. `grep -c '^## When to Activate'` → `0`.
   A skill that quotes markdown in an example over-counts — read the hits, do not trust the number.
2. `ls <skill>/evals/acceptance.json` → present. A marketplace skill also has `metadata.yaml` and
   `evals/trigger-eval.json`.
3. `python3 scripts/validate_eval.py <skill>/evals/trigger-eval.json` → prints a hash, not an error.
   Marketplace skills only.
4. `python3 scripts/gen_catalog.py` → exits clean. Marketplace skills only.
5. The owning `plugin.json` version is bumped, and the `README.md` line still describes the skill.
6. `meta:skill-eval` was invoked and its script run from the repo → `evals/result.json` exists and is
   current, no should-NOT-trigger query fired. Measurement is mandatory — no clone reachable means not
   done, not skipped. Changing a `description` without re-measuring leaves a result that describes text
   nobody ships any more.
7. Any line failing? Fix it and start again from 1.
