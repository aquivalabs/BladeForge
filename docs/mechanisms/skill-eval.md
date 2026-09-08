# skill-eval — the measurement mechanism

The **Skill Evaluation & Quality-Gate Mechanism**, `meta:skill-eval`. It is this marketplace's own,
built to replace a dependency on the upstream skill-creator harness, which registered a tested skill
as a slash-command stub and produced systematic false negatives.

It answers **two** questions about a skill, and they are separate on purpose: a skill that fires
reliably while changing nothing looks healthy under one metric and fails the other. Merging them is
the mistake the design exists to prevent.

| metric | question | status |
|---|---|---|
| triggering | is the skill reached for when it should be? | **built** — `score-description.py` |
| acceptance | does the result come out as promised? | the structural requirement (file + Contract) is on the gate; the LLM grader is `skillcraft:skillaxe` — see below |

The parts:

```text
plugins/meta/skills/skill-eval/       the skill: how to run it, how to read a score
  scripts/score-description.py        the triggering measurer, self-contained
scripts/validate_eval.py              rubric.json trigger shape + its canonical hash
scripts/validate_acceptance.py        rubric.json acceptance shape (array or {not-applicable})
scripts/validate_security.py          result.json security-section shape + a skill's material hash
scripts/eval-gate.sh                  what blocks, what only warns
hooks/pre-push                        runs it locally before a push, then the review gate
.github/workflows/eval-gate.yml       runs it again on a PR, deterministic, no LLM
<skill>/evals/                        the two files below
```

Every skill ships an `evals/` directory. Two files — but still the three different questions, because
confusing them is what lets a skill look healthy while doing nothing. `rubric.json` holds what the
skill is measured AGAINST, in two halves; `result.json` holds what the last run MEASURED, in the same
two halves. One file, two metrics — the halves are never merged, only stored together.

```text
evals/
  rubric.json    { "trigger": [ did it FIRE?  labelled queries ],
                   "acceptance": [ did it WORK?  expectations about the result ] }
  result.json    { "trigger": { the recorded trigger run },
                   "acceptance": { the recorded skillaxe run, or null },
                   "security": { the recorded eight-point safety walk } }
```

`result.json` grew a third key, `security` — the consumer-safety confirmation written by
`cerberus:security-scan`, not by `meta:skill-eval`. It is a different mechanism (does this skill harm
whoever installs it?) that the SAME gate enforces, so it is stored in the same per-skill file rather
than a fourth one. See "result.json `security`" below.

## rubric.json `trigger` — did it fire

A JSON array of `{"query": str, "should_trigger": bool}`. At least 6 cases, at least one of each
polarity. Written by the author from questions 1b/1c (the positive cases) and 3c (the negatives) of
the authoring method.

`scripts/validate_eval.py` enforces the `trigger` shape and prints its CANONICAL hash — over the
trigger array alone, so editing the acceptance half never marks a trigger measurement stale. That
hash is how `result.json`'s `trigger.queryset_hash` knows whether it still describes the current queries.

## rubric.json `acceptance` — did it work

A JSON array of short claims about the RESULT, straight from the author's answer to "what checks
that". A sibling key of `trigger` in the same file, never folded INTO the trigger cases: firing and
working are two different metrics, measured by two different runs, and a skill that fires reliably
while changing nothing must not be able to borrow the trigger score. Sharing a file is not merging
the metrics — the gate reads and scores the two halves separately.

```json
[
  "no px remains in sizes or spacing in the changed styles",
  "every size is expressed in rem against a 16px base"
]
```

A skill with nothing to check — one that only explains how a system is built — states why instead:

```json
{ "not-applicable": "explains the data-router; produces nothing to check" }
```

## result.json — what was measured

Written by `plugins/meta/skills/skill-eval/scripts/score-description.py` at the end of a run, unless
`--no-save` is passed. Its two keys mirror `rubric.json`: `trigger` carries the queryset hash, the
score, the model and runs used, the date, the method, and the per-query rows; `acceptance` carries
the skillaxe run, or `null` until one has been taken.

The record's shape, and the reason for it:

```json
{
  "trigger": {
    "skill": "new-skill",
    "measured_at": "2026-08-31T18:40:12",
    "model": "sonnet",
    "runs_per_query": 2,
    "best_score": "16/18",
    "accuracy": 0.889,
    "baseline_accuracy": null,
    "description_hash": "…",
    "queryset_hash": "…",
    "eval_type": "description-triggering",
    "method": "…how the measurement was taken…",
    "results": [ … per-query rows … ]
  },
  "acceptance": null
}
```

**Two hashes, and both matter.** They key the record to the exact queryset AND description that were
measured, so editing either marks the record stale. Dropping `description_hash` would let a rewritten
description keep an old score — and the description is precisely what this eval measures. That
docstring rationale comes from the original implementation and is the reason the field exists.

The `acceptance` half stays `null` until `skillcraft:skillaxe` runs; a run fills it with the
diagnostic score:

```json
{
  "runner": "skillcraft:skillaxe",
  "measured_at": "2026-09-07",
  "model": "sonnet",
  "method": "diagnostic (generate with-guide vs isolated baseline, LLM judge vs rubric acceptance)",
  "quality_impact": 0.75,
  "skillscore": 0.92,
  "guide_faults": ["a fixable weak spot the guide itself owns, or none"],
  "verdict": "one-line summary of whether the guide earned its keep"
}
```

Fields belonging to the optimisation loop the old script ran — `holdout`, `best_train_score`,
`exit_reason`, `applied` — are not carried. This scorer measures one description; it does not search
for a better one.

**This is a repaired regression, and worth knowing about.** The saving originally lived in
`scripts/optimize_description.py` — commit `4c183a9`, "optimize_description writes evals/result.json".
That script was deleted in `7987042` when `meta:skill-eval` replaced the skill-creator harness, and
its scoring moved to `score-description.py` while the saving did not. Nothing wrote the file for
months. Three skills carry a `result.json` from that era, each hand-written in its own shape, which is
why their fields do not match.

The measurement matters because runs otherwise land in `*-workspace/` directories that `.gitignore`
excludes as scratch, and evaporate. Without a saved result there is nothing to compare a later run
against, and no evidence a skill was ever measured at all.

## result.json `security` — is it safe to install

Written by `cerberus:security-scan` when it walks a skill, not by the trigger scorer. It is the
eight-point consumer-safety confirmation — one row per point, each with a `verdict` of `pass`, `flag`,
or `n/a` — plus `scanned_hash`, the skill's MATERIAL hash. The top `verdict` is `pass` only when no
point is `flag`.

```json
"security": {
  "verdict": "pass",
  "scanned_at": "2026-09-08T00:00:00",
  "scanned_by": "cerberus:security-scan",
  "scanned_hash": "<sha256 of SKILL.md + references/ + scripts/>",
  "checklist": [ { "n": 1, "point": "prompt-injection", "verdict": "pass", "note": "…" }, … 8 points … ]
}
```

`scanned_hash` is the freshness key, and it is deliberately BROADER than the trigger hashes: it covers
the skill's installer-facing material — `SKILL.md`, `references/`, and `scripts/` — because a script
or reference edit changes what reaches a consumer even when the description is untouched. It excludes
sidecars and eval files, which a consumer never runs. `scripts/validate_security.py` both checks the
section's shape and, with `--print-material-hash <skill-dir>`, computes the hash — one implementation,
shared by the head that writes and the gate that checks, so the two can never disagree.

## Who reads what

| reader | reads | does |
|---|---|---|
| `hooks/pre-push` (every local push) | — | runs `eval-gate.sh`, then the review gate; `core.hooksPath` points at `hooks/`, so this file IS the pre-push hook — there is no `.husky/` here |
| `scripts/eval-gate.sh` (that hook, and every PR) | `rubric.json` (trigger) | **blocks** a touched skill whose eval is missing or invalid |
| | `result.json` | **blocks** a skill whose own `SKILL.md` is in the diff when the file is absent or stale — stale meaning either its `queryset_hash` or its `description_hash` no longer matches; **warns** (does not block) when only a bundled script or generated file beside the skill changed. There is no skip flag: a missing or stale measurement on a touched skill always blocks — no live clone to measure from means the skill is not shippable yet |
| | `rubric.json` (acceptance) + `## Contract` | **blocks** a skill whose own `SKILL.md` is in the diff when the `acceptance` half of `evals/rubric.json` is missing or invalid (`scripts/validate_acceptance.py`) or the body has no `## Contract` heading — the step-5 structural requirement, switched on once ten skills carried the file. A map declares `{"not-applicable": "<reason>"}` and passes. `SKILL_EVAL_SKIP=1` downgrades it to a warning offline. An untouched skill is not checked |
| | `result.json` (security) | **blocks** a skill whose installer-facing MATERIAL is in the diff (`SKILL.md`, `references/`, or `scripts/`) when the `security` section is absent, invalid (`scripts/validate_security.py`), stale (its `scanned_hash` no longer matches the skill's material hash), **or its top `verdict` is not `pass`** — a recorded `flag` blocks the push, so an honestly-recorded but unresolved hit cannot ship. Broader trigger than the trigger measurement (any material edit, not only the description) and stronger: consumer safety has **no** skip flag. An untouched skill, or a sidecar/eval-only edit, is not checked |
| `scripts/scout_validate.py` (every PR) | `metadata.yaml` | blocks on an invalid sidecar or a tool/tag contradiction |
| `score-description.py` (local only) | `rubric.json` (trigger) | runs each query as a nested `claude -p`, scores triggering, writes `result.json` |

**No LLM runs in CI.** The gate is deterministic and agent-free; anything that spawns `claude -p` is
run locally by the author, on demand. The gate checks that the `acceptance` half of `rubric.json` and a `## Contract` heading are PRESENT on a touched skill (deterministic, step 5); it does not GRADE the result against them on a PR — that
needs an agent to perform the task and a grader to judge the output.

## The acceptance metric — built as `skillcraft:skillaxe`

The LLM grader that reads the `acceptance` half of `rubric.json` and judges whether the guidance actually improved the
result is `skillcraft:skillaxe` — an embedding-optional adaptation of SkillAxe (arXiv 2606.10546). It
generates with and without the guide (isolated baseline), scores Quality Impact and Instruction
Compliance against the skill's `rubric.json` acceptance, and attributes each weak spot to the guide or the
agent. It is run locally and selectively (a high-traffic guide, a large rewrite), never on a PR — the
design below records why the trigger scorer could not be extended to cover it.

**Why the existing runner cannot be extended to cover it.** `score-description.py` sends a query and
watches whether the Skill tool fires. It never performs the task, so there is no result for it to
judge. Triggering and acceptance need different runs, not different flags.

**The shape of the run:**

```text
1  give an agent a real task, of the kind the skill exists for
2  it works, with the skill available
3  a grader checks the result against each acceptance line of rubric.json — one yes/no per line
4  the SAME task runs again with the skill disabled
5  the grader compares the two outputs BLIND, not told which had the skill
```

Step 4 is what makes it honest. Without it, a passing result cannot be separated from a model that
would have done the same thing unaided — the difference between "the skill was read" and "the skill
changed something".

**Constraints that shape it**, from the research behind this programme:

- **One yes/no per criterion, never one holistic score.** Decomposed checks are measurably more
  reliable than a 1–10 judgment, and a single number hides which part failed.
- **The grader gets a rubric and reasons before scoring.** A bare score correlates poorly with human
  judgment; a chain-of-thought walk over stated criteria correlates far better.
- **Judge bias is real and has known mitigations**: swap the order of the two outputs and require
  agreement, watch for length being rewarded on its own, and avoid a judge from the same family as
  the actor where possible.
- **Sample size is the honest limit.** A paired design — same task, skill on and off — is the right
  one, and roughly ten paired tasks is the floor for a large effect. A difference visible only across
  hundreds of runs is a difference not worth the document.
- **Never in CI.** It spawns agents; the gate stays deterministic.

**When to reach for it:** now that the skills carry a `rubric.json`, the criteria have settled
into a shape worth grading against. Run it locally and selectively — a high-traffic guide, a large
rewrite — never on a PR.

## Running one

```bash
python3 plugins/meta/skills/skill-eval/scripts/score-description.py \
    --skill-path plugins/<domain>/skills/<name> \
    [--runs 2] [--model sonnet] [--type self-contained|context-dependent] [--suggest] [--no-why]
```

Read the score by skill type. A self-contained skill is judged against the absolute bar and against
its own previous score. A context-dependent one — advisory, or only firing with the real repo — is
judged by no-regression alone; a low absolute number there is expected and is not a failure. A
negative case that fires IS a real failure whatever the type: the description is too broad.

When a positive case misses, the scorer prints a **WHY IT MISSED** diagnosis by default — one nested
`claude -p` that names the missing CONDITION — rather than recommending that the failed query's own
wording be pasted into the description, which patches the test set instead of the skill. `--no-why`
skips it. `--print-description-hash` prints the hash and exits with no LLM call; the gate uses it so
the frontmatter is parsed in exactly one place.

## The lesson this mechanism taught

**A mechanism whose breakage is reported as a warning breaks silently.**

The gate said `⚠ eval present but never measured (push allowed — refresh when you can)` on every
affected skill, every time. It was honest and it was ignored — because a warning that appears on
everything distinguishes nothing. Fourty-two skills carried it and it read as background.

The practical consequence, taken in two stages. The warning is now a **blocker for any skill whose
own `SKILL.md` is in the diff** — the case where a stale measurement is a live lie, and where the
author is already in that skill and can fix it. It stays a **warning** for the untouched skills, so
the ones not yet measured do not block an unrelated push. The full promotion — a blocker for every
skill regardless of the diff — still waits on all 45 carrying a `result.json`; that condition is
written down so it does not depend on anyone remembering.
