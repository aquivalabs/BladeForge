# skill-eval — the measurement mechanism

The **Skill Evaluation & Quality-Gate Mechanism**, `meta:skill-eval`. It is this marketplace's own,
built to replace a dependency on the upstream skill-creator harness, which registered a tested skill
as a slash-command stub and produced systematic false negatives.

It answers **two** questions about a skill, and they are separate on purpose: a skill that fires
reliably while changing nothing looks healthy under one metric and fails the other. Merging them is
the mistake the design exists to prevent.

| metric | question | status |
|---|---|---|
| triggering | is the skill reached for when it should be? | **built** — `scripts/hillclimb/trigger-runner.mjs` |
| acceptance | does the result come out as promised? | the structural requirement (file + Contract) is on the gate; the quality stage is **built for one skill** — `scripts/hillclimb/leak-check-runner.mjs`, see below |

The parts:

```text
plugins/meta/skills/skill-eval/       the skill: how to run it, how to read a score
scripts/hillclimb/
  trigger-runner.mjs                  the triggering measurer: the claude-api hillclimb scaffold, filled in
  skill-description.mjs               the one description reader: runner, writer and gate all import it
  flow-lib.mjs                        the shared facts: case ids, skill slugs, row scoring, the record contract
  sandbox-lib.mjs                     the per-slot sandbox and the streamed nested claude run, shared by both runners
  leak-check-runner.mjs               the quality runner for cerberus:leak-check, the same scaffold filled in for commits
  new-flow.mjs                        creates a flow dir with a fixed, seeded train/test split
  save-result.mjs                     writes result.json `trigger` from a variant's raw rows
  split-scores.mjs                    recomputes train/test scores from raw rows
  description-hash.mjs                prints the description hash for the gate
  validate-trigger-record.mjs         the gate's check that a record came from the runner, with its noise
  harness-sha.mjs                     the runner's harness digest, so new-flow can reuse an approval;
                                      harness-sha.test.mjs pins it to the runner
.claude/hillclimb/<flow>/             raw rows and traces per run, gitignored
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
                   "acceptance": { the recorded quality run, or null },
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

Written by `scripts/hillclimb/save-result.mjs` from a runner variant's raw `results.jsonl`. It
refuses a variant that is incomplete, mixes models, or measured a description other than the one
`SKILL.md` holds now — every row records the description hash it measured. `trigger` carries the
queryset hash, the score over (case, rep) rows, the model and reps used, the environment, the train
and test scores each with its noise interval, the date, the method, and the per-query rows; `acceptance` carries the quality run, written by
`save-result.mjs --quality`, or `null` until one has been taken; `security` carries the eight-point walk, written by a different mechanism entirely.

**A run replaces `trigger` and carries every other key forward untouched.** It used to carry only
`acceptance`, by name — so re-scoring a description silently deleted the `security` walk beside it
and un-shipped the skill, which `eval-gate` then refused with a staleness message naming neither the
cause nor the re-measurement that caused it. `scripts/hillclimb/save-result.test.mjs` pins the
carry-forward, and the CI job `hillclimb-tests` runs it. A record with no `trigger` key is not one of
these records, and nothing in it is carried.

The record's shape, and the reason for it:

```json
{
  "trigger": {
    "skill": "triage",
    "measured_at": "2026-10-16T18:40:12",
    "model": "claude-opus-5-5",
    "runs_per_query": 5,
    "best_score": "85/90",
    "accuracy": 0.944,
    "baseline_accuracy": null,
    "description_hash": "…",
    "queryset_hash": "…",
    "eval_type": "description-triggering",
    "runner": "scripts/hillclimb/trigger-runner.mjs",
    "environment": "isolated",
    "cases": 18,
    "train": { "cases": 12, "rows": 60, "mean": 0.917, "ci_half_width": 0.129 },
    "test":  { "cases": 6,  "rows": 30, "mean": 1.0,   "ci_half_width": 0.183 },
    "method": "…how the measurement was taken…",
    "results": [ … per-query rows … ],
    "hillclimb": { "baseline_test": 1.0, "final_test": 1.0, "final_variant": "baseline",
                   "rounds": 0, "noise": 0.183, "verdict": "no-headroom" }
  },
  "acceptance": null
}
```

**Two hashes, and both matter.** They key the record to the exact queryset AND description that were
measured, so editing either marks the record stale. Dropping `description_hash` would let a rewritten
description keep an old score — and the description is precisely what this eval measures. That
docstring rationale comes from the original implementation and is the reason the field exists.

The `acceptance` half stays `null` until a quality run is saved with
`save-result.mjs --quality <with-flow> <variant> <without-flow> [<variant>]`. It refuses unless both
arms cover every case in the suite at the same reps on one model, and unless every row of the with
arm installed the skill as it is now — each row records the `skill_hash` of what it installed. A
saved record:

```json
{
  "measured_at": "2026-10-19T18:00:00",
  "model": "claude-opus-5-5",
  "runner": "scripts/hillclimb/leak-check-runner.mjs",
  "eval_type": "quality-with-vs-without",
  "cases": 16,
  "reps": 3,
  "with_skill": { "cases": 16, "rows": 48, "mean": 0.833, "ci_half_width": 0.144 },
  "without_skill": { "cases": 16, "rows": 48, "mean": 0.188, "ci_half_width": 0.144 },
  "effect": 0.646,
  "noise": 0.204,
  "verdict": "helps",
  "test": { "with_skill": { "...": "..." }, "without_skill": { "...": "..." } },
  "skill_hash": "every skill file except evals/, by path and content",
  "cases_hash": "the cases file",
  "flows": { "with": "v1", "without": "baseline" },
  "method": "..."
}
```

`effect` is the with-arm pass rate minus the without-arm pass rate. `noise` is the half-width of that
difference, `sqrt(1/n_with + 1/n_without)` over rows. The verdict follows from those two numbers
alone: `helps` when the effect is above the noise, `hurts` when it is below minus the noise, and
`within-noise` otherwise. The 28 records the earlier single-task grader wrote were removed in phase 4
of the migration plan: one task run once cannot tell a real effect from zero, so a skill without a
quality record reads as not measured.

`hillclimb` appears only after a climb. Its verdict is computed from the numbers alone —
`improved`, `within-noise`, `regressed` or `no-headroom`, with the baseline test interval as the
noise — and the winner is the variant hillclimb itself recorded in `_state.json.best`.

The record measures one description; it does not search for a better one. Improving a description
is `/claude-api hillclimb` run on the same flow dir, which keeps the split and reverts any change that
does not lift the test score.

**This is a repaired regression, and worth knowing about.** The saving originally lived in
`scripts/optimize_description.py` — commit `4c183a9`, "optimize_description writes evals/result.json".
That script was deleted in `7987042` when `meta:skill-eval` replaced the skill-creator harness, and
its scoring moved to `score-description.py` while the saving did not. Nothing wrote the file for
months. Three skills carry a `result.json` from that era, each hand-written in its own shape, which is
why their fields do not match.

**The second repaired defect: the scorer itself.** `score-description.py` re-emitted the parsed
description into the probe skill unquoted. For any description holding `: ` that made the probe's
YAML invalid, which affected 12 skills, and `\u2014` escapes reached the model as literal text. It
also counted any `Skill` call as a hit, not only a call for the probe. Remeasured on 2026-10-16 with
the runner, which copies the `description:` line verbatim, the five lowest saved scores, 50–65%,
came out at 94–100%. Records written by `score-description.py` are not evidence; the script was
deleted when the runner replaced it.

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

**It also excludes build artefacts** — a `__pycache__`, a `.pyc`, a `node_modules` — because an
installer never reads one. The walk is over the FILESYSTEM, not over git, so an ignored artefact
used to fold into the hash: running any bundled script left a `__pycache__` beside it, the machine
that wrote the scan hashed it, and a clean CI checkout did not. The gate then called a freshly
written walk stale, on that skill only, with no way to reproduce it locally.
`scripts/validate_security.test.py` pins the exclusion.

## Who reads what

| reader | reads | does |
|---|---|---|
| `hooks/pre-push` (every local push) | — | runs `eval-gate.sh`, then the review gate; `core.hooksPath` points at `hooks/`, so this file IS the pre-push hook — there is no `.husky/` here |
| `scripts/eval-gate.sh` (that hook, and every PR) | `rubric.json` (trigger) | **blocks** a touched skill whose eval is missing or invalid |
| | `result.json` | **blocks** a skill whose own `SKILL.md` is in the diff when the file is absent or stale — stale meaning either its `queryset_hash` or its `description_hash` no longer matches — or when the record did not come from `trigger-runner.mjs` on `claude-opus-5-5`, in the isolated or crowded environment, with its case count, reps and test interval (`validate-trigger-record.mjs`). A skill whose `SKILL.md` the diff ADDS must also carry `trigger.hillclimb`, the outcome of `/claude-api hillclimb` written by `save-result.mjs --climb`; **warns** (does not block) when only a bundled script or generated file beside the skill changed. There is no skip flag: a missing or stale measurement on a touched skill always blocks — no live clone to measure from means the skill is not shippable yet |
| | `rubric.json` (acceptance) + `## Contract` | **blocks** a skill whose own `SKILL.md` is in the diff when the `acceptance` half of `evals/rubric.json` is missing or invalid (`scripts/validate_acceptance.py`) or the body has no `## Contract` heading — the step-5 structural requirement, switched on once ten skills carried the file. A map declares `{"not-applicable": "<reason>"}` and passes. `SKILL_EVAL_SKIP=1` downgrades it to a warning offline. An untouched skill is not checked |
| | `result.json` (security) | **blocks** a skill whose installer-facing MATERIAL is in the diff (`SKILL.md`, `references/`, or `scripts/`) when the `security` section is absent, invalid (`scripts/validate_security.py`), stale (its `scanned_hash` no longer matches the skill's material hash), **or its top `verdict` is not `pass`** — a recorded `flag` blocks the push, so an honestly-recorded but unresolved hit cannot ship. Broader trigger than the trigger measurement (any material edit, not only the description) and stronger: consumer safety has **no** skip flag. An untouched skill, or a sidecar/eval-only edit, is not checked |
| `scripts/scout_validate.py` (every PR) | `metadata.yaml` | blocks on an invalid sidecar or a tool/tag contradiction |
| `trigger-runner.mjs` + `save-result.mjs` (local only) | `rubric.json` (trigger) | runs each query as an isolated nested `claude -p`, scores triggering, writes `result.json` |

**No LLM runs in CI.** The gate is deterministic and agent-free; anything that spawns `claude -p` is
run locally by the author, on demand. The gate checks that the `acceptance` half of `rubric.json` and a `## Contract` heading are PRESENT on a touched skill (deterministic, step 5); it does not GRADE the result against them on a PR — that
needs an agent to perform the task and a grader to judge the output.

## The quality stage

The quality stage answers the second question: once the skill fired, does the agent do the job better
than without it? A quality eval is 15 or more real tasks, built with `/claude-api build-eval`, with a
programmatic grader where the outcome can be read off the result.

**Why the trigger runner cannot be extended to cover it.** `trigger-runner.mjs` sends a query and
watches whether the Skill tool fires. It never performs the task, so there is no result for it to
judge. Triggering and acceptance need different runs, not different flags.

**The shape of the run**, as `scripts/hillclimb/leak-check-runner.mjs` does it for
`cerberus:leak-check`:

```text
1  build a fixture repository for the case — the task's starting state
2  run the agent there on the case's plain request, as a nested claude -p
3  the "with" arm installs the skill first; the "without" arm does not
4  a grader reads what the agent left — files, commits, authors — against the case's ground truth
5  save-result.mjs --quality compares the two arms over the same cases and reps
```

Step 3 is what makes it honest. Without the second arm, a passing result cannot be separated from a
model that would have done the same thing unaided. The requests stay plain — "commit this", "push
this branch" — because a prompt that names the check hands the without arm the answer.

**What stays on the gate.** `scripts/validate_acceptance.py` and gate step 5 still require the
`acceptance` list in `rubric.json` and a `## Contract` heading on a touched skill. The list stays the
input a quality grader reads; the gate checks only that it is present, never grades against it.

**Never in CI.** It spawns agents; the gate stays deterministic.

## Running one

```bash
node scripts/hillclimb/new-flow.mjs plugins/<domain>/skills/<name>   # once; add --crowded for siblings
node scripts/hillclimb/trigger-runner.mjs --flow .claude/hillclimb/<flow> --variant baseline \
    --model claude-opus-5-5 --reps 5 --concurrency 8
node scripts/hillclimb/save-result.mjs .claude/hillclimb/<flow> baseline
```

A quality run uses two flows over one cases file, one per arm, and the runner written for that skill:

```bash
node scripts/hillclimb/leak-check-runner.mjs --flow .claude/hillclimb/leak-check-with --variant v2 \
    --model claude-opus-5-5 --reps 3 --concurrency 4
node scripts/hillclimb/leak-check-runner.mjs --flow .claude/hillclimb/leak-check-without --variant v2 \
    --model claude-opus-5-5 --reps 3 --concurrency 4
node scripts/hillclimb/save-result.mjs --quality .claude/hillclimb/leak-check-with v2 \
    .claude/hillclimb/leak-check-without v2
```

The runner refuses to start until its current code is approved with `--approve-harness`. An agent
passes that flag only when the harness changes are committed and covered by a passing `/review`
attestation; otherwise the maintainer does. Both runners enforce it before the scaffold records
anything: `gateApproval` in `flow-lib.mjs` approves when every harness file is committed and a PASS
attestation in `.review/attestations/` names a commit on the branch whose harness files are
byte-identical to HEAD's. Otherwise it asks for the word `approve` on a terminal, and a shell with
no terminal, the way an agent runs, is refused. `approval-gate.test.mjs` walks those cases. The nested run is isolated — `--setting-sources project
--strict-mcp-config` — so no user settings, plugins, hooks or MCP servers reach it, and the score does
not depend on whose machine took it. `environment: "crowded"` in the flow's `_state.json` installs
every marketplace skill beside the one under test, and a query a sibling takes shows in
`fired_other`.

Read the test split with its interval first. With 6–7 test cases at 5 reps the noise is about ±18
points. A negative case that fires IS a real failure: the description is too broad.

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
