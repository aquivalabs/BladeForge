---
description: "Use when you need to know whether a skill's `description` actually makes Claude reach for it — scoring an existing skill's trigger accuracy before shipping it, after editing its description, or when someone reports that a skill \"never triggers\" and you need to find out why. Also use to read a score you already have: what a miss means, and what a should-not-trigger query that fired means. Do NOT use to REWRITE a skill's description or body (use `meta:update-skill` — measuring is this skill's job, rewriting is that one's), and never measure with skill-creator's `run_eval`/`run_loop`, which produces systematic false zeros."
---

# Skill Eval — Faithful Trigger Scoring

## Contract

**In:** an existing skill directory holding `SKILL.md` and `evals/rubric.json` (≥6 cases, at
least one of each polarity) · a checkout of this repository, because the scripts live in
`scripts/hillclimb/` at its root, not in the skill · `node` and a working `claude` binary — this
spends tokens, it is not a static check · a harness approval recorded by the maintainer, which no
agent may give. If `scripts/hillclimb/` is not reachable, say the repository checkout is required
and stop; never fall back to skill-creator's `run_eval`.

**Out:** the trigger score over (case, rep) rows, split into train and test with the noise
interval beside each, plus the exact queries that missed or wrongly fired · `evals/result.json`
written beside the skill, carrying both hashes so the gate can tell a fresh measurement from a stale
one.

**Not in scope:** whether the skill does its job WELL once it fires. That is the second metric — it
is the quality stage, run with the skill and without it and saved with
`save-result.mjs --quality`, not by this skill. A trigger score
of 10 says the model reached for the skill, nothing more.

---

## The one rule that matters most

**Measure with `scripts/hillclimb/trigger-runner.mjs` — NOT skill-creator's `run_eval`/`run_loop`.**

skill-creator registers the tested skill as a transient **slash-command**
(`.claude/commands/<name>-skill-<hash>`) and counts a trigger only if `Skill`/`Read` is the model's
**first** tool call. Real tasks open with `Bash`/`Write`/`TodoWrite`, so it reports **systematic
false-negatives** — a good skill scores ~0. The trigger runner instead installs the skill as a
**real** `.claude/skills/<name>/`, with its `description:` line copied verbatim, and counts a hit only
when the `Skill` tool fires for that skill in a real `claude -p` run.

Its predecessor, `score-description.py`, was deleted for two measurement defects: it re-emitted the
description unquoted, which broke the probe's YAML for any description holding `: `, and it counted
any `Skill` call as a hit. Scores it saved are not evidence; remeasure before reading one.

**Run everything from the repository, not from the installed plugin cache.** The cache is keyed by
plugin version and lags behind.

---

## Run it

1. **Create the flow dir once per skill.** It fixes a seeded train/test split and never re-draws it:
   ```bash
   node scripts/hillclimb/new-flow.mjs <skill-dir>            # isolated: the skill alone
   node scripts/hillclimb/new-flow.mjs <skill-dir> --crowded  # beside every marketplace skill
   ```
2. **Price it before running.** Measure one case first and show the `meta:model-routing` cost table.
   A full pass at `--reps 5` is about 8% of a 5-hour window isolated, about 10% crowded.
3. **Approve the harness only after review.** The runner refuses to start until its hash is
   recorded. Pass `--approve-harness` yourself only when every harness change is committed and
   covered by a passing `/review` attestation; otherwise ask the user to run the first command with it.
   The runner checks this itself and refuses an approval no attestation covers.
4. **Run, then save:**
   ```bash
   node scripts/hillclimb/trigger-runner.mjs --flow <flow> --variant baseline \
     --model claude-opus-5-5 --reps 5 --concurrency 8
   node scripts/hillclimb/save-result.mjs <flow> baseline
   ```
   The runner resumes: re-running the same command finishes any missing rows. `save-result.mjs`
   refuses to write a variant that is incomplete, mixes models, or measured a description other
   than the one `SKILL.md` holds now.
5. **Read the numbers from raw rows:** `node scripts/hillclimb/split-scores.mjs <flow> baseline`.

The nested run is isolated: no user settings, plugins, hooks or MCP servers, so the score does not
depend on whose machine took it. **This spawns `claude -p` agents. Run it LOCALLY, on demand —
NEVER in CI.** CI runs only the deterministic `scripts/eval-gate.sh`, which needs no agent.

To improve a description against these cases, run `/claude-api hillclimb` on the same flow. It
keeps the split, reads only train transcripts, and reverts a change that does not lift test.

---

## Reading the result

- **The headline is the test split, with its interval.** With 6–7 test cases at 5 reps the noise is
  about ±18 points; a difference inside it is not a difference.
- **A should-NOT-trigger query that fires is a real failure:** the description is too broad, narrow it.
- **In crowded mode, read `fired_other` on the rows.** A should-trigger miss where a sibling fired
  is a boundary problem between two skills, not a weak description.
- **Read the per-query rows in `evals/result.json`, not just the headline.** A case that fired 1 of 2
  runs counts as a pass, so a skill can score high while half its positives are coin flips.

---

## A miss is a question, not a patch

When a positive case misses, the reflex is to paste its wording into the `description` and re-score.
That raises the number and fixes nothing: it is a patch shaped like the test set. Anthropic's own
guidance is explicit — *"Fixes should address underlying issues broadly rather than adding narrow
patches."* So ask WHY it missed first, and the answer is usually one of three, each checkable.

**Is the description a list of keywords rather than a condition?** Check which cases are stable: if
the reliable ones are exactly those whose words appear verbatim in the description while paraphrases
sit at 50 %, the description is being pattern-matched, not understood. The cure is to state the
CONDITION under which the skill applies, not to add another phrasing.

**Did the boundary give the topic away?** Grep the missed query's key word across the description. If
it appears only inside a `Do NOT use for …` clause, the boundary claimed more ground than it meant
to — it should hand a neighbour one narrow ACTION, never a whole subject. Narrow the clause.

**Is the query one nobody would type?** Almost never the answer, and here is the rule that keeps it
honest: **after the first measurement, existing cases are frozen and the set only grows.** Before
it, write and rewrite the cases freely — they are the specification of what the skill must catch.
After it, they are the instrument, and an instrument bent to the reading measures nothing. Every
later miss is fixed in the DESCRIPTION, including one you privately think is an unfair query. An
existing case is never edited or deleted; it is retired only when what the skill DOES drops it.
Adding cases is allowed and wanted, because most rubrics saturate on the current model. Add HARD
ones: queries on the boundary with a sibling skill, from real requests where they exist. A new case
gets its train or test slot at random when it is added, never by where it would help. Editing an
existing case in the same change as a score is the signature of a bent instrument — `queryset_hash`
moves and the diff shows it, so justify any queryset change in the change description.

**Before diagnosing a case that fires "half the time", re-measure with more runs.** At `--reps 2` a
1-of-2 is not a measurement — telling 50 % from 90 % apart takes roughly 17 runs per arm. A coin flip
and a real weakness look identical until then.

---

## Before you finish

1. `evals/rubric.json` exists: ≥6 cases, ≥1 positive, ≥1 negative, realistic queries and
   genuine near-miss negatives.
2. The runner and `save-result.mjs` were run from the repository → `evals/result.json` exists and
   its `description_hash` matches the description you are shipping.
3. No should-NOT-trigger query fired. One that did is a real defect — narrow the description and
   return to 1.
4. Every positive case was read individually, not just the headline score. For each miss, the WHY was
   answered from the three questions above and the fix addresses that cause — not the wording of the
   failed query.
5. `git diff` edits or deletes no existing case in the `trigger` half of `rubric.json` unless what
   the skill DOES changed in the same change. Added cases are fine; an existing case edited alongside
   a score is an instrument bent to its reading. (Editing the
   `acceptance` half is fine — it does not move the trigger hash.)
6. `bash scripts/eval-gate.sh` → green for this skill.
7. Any line failing? Fix it and start again from 1.
