---
description: "Use when you need to know whether a skill's `description` actually makes Claude reach for it — scoring an existing skill's trigger accuracy before shipping it, after editing its description, or when someone reports that a skill \"never triggers\" and you need to find out why. Also use to read a score you already have: what a miss means, and what a should-not-trigger query that fired means. Do NOT use to REWRITE a skill's description or body (use `meta:update-skill` — measuring is this skill's job, rewriting is that one's), and never measure with skill-creator's `run_eval`/`run_loop`, which produces systematic false zeros."
---

# Skill Eval — Faithful Trigger Scoring

## Contract

**In:** an existing skill directory holding `SKILL.md` and `evals/trigger-eval.json` (≥6 cases, at
least one of each polarity) · a working `claude` binary — this spends tokens, it is not a static
check.

**Out:** a 0–10 score with a plain-language verdict, current-vs-baseline with a no-regression gate,
the exact queries that missed or wrongly fired · `evals/result.json` written beside the skill,
carrying both hashes so the gate can tell a fresh measurement from a stale one.

**Not in scope:** whether the skill does its job WELL once it fires. That is the second metric, it
needs `evals/acceptance.json` and a runner that does not exist yet. A trigger score of 10 says the
model reached for the skill, nothing more.

---

## The one rule that matters most

**Measure with `score-description.py` (bundled here) — NOT skill-creator's `run_eval`/`run_loop`.**

skill-creator registers the tested skill as a transient **slash-command**
(`.claude/commands/<name>-skill-<hash>`) and counts a trigger only if `Skill`/`Read` is the model's
**first** tool call. Real tasks open with `Bash`/`Write`/`TodoWrite`, so it reports **systematic
false-negatives** — a good skill scores ~0. `score-description.py` instead installs the skill as a
**real** `.claude/skills/<name>/` (how it reaches Claude in production) and scores by whether the
`Skill` tool actually fires across real `claude -p` runs.

## If this skill (or its script) is missing — STOP and get it

If `score-description.py` is not present, do NOT fall back to skill-creator: say that
`meta:skill-eval` is required, ask for the `meta` plugin to be enabled, and stop. Measuring with the
wrong tool is what produces the false zeros this skill exists to prevent, and a false zero is worse
than no number.

**Run the script from the repository, not from the installed plugin cache.** The cache is keyed by
plugin version and lags behind; a cached copy predating the `result.json` repair prints a score and
saves nothing at all.

---

## Run it

```bash
python3 plugins/meta/skills/skill-eval/scripts/score-description.py --skill-path <skill-dir> \
  [--runs 5] [--model sonnet] [--bar 7] [--type self-contained|context-dependent] [--suggest]
```

- Reads `<skill-path>/evals/trigger-eval.json` (≥6 cases `{"query","should_trigger"}`, ≥1 positive +
  ≥1 negative; realistic queries, genuine near-miss negatives).
- Prints the score, a one-glance verdict, current-vs-baseline (git HEAD) with a **no-regression
  gate**, plain-language WHY, and the exact MISSED / wrongly-fired queries.
- `--suggest` adds ONE `claude -p` call proposing a rewritten description.
- `--from-result <json>` re-renders a saved result with zero new eval spend.
- `--print-description-hash` prints the hash and exits, no LLM call — this is what `eval-gate.sh`
  calls, so the frontmatter parser lives in one place instead of two that drift.

**This spawns `claude -p` (an LLM agent). Run it LOCALLY, on demand — NEVER in CI.** CI runs only the
deterministic `scripts/eval-gate.sh`, which needs no agent.

---

## Reading the result — the score is advisory, judged by skill type

- **`--type self-contained`** (the description alone should pull Claude to the skill): apply the
  absolute bar (`>= 7/10`) AND no-regression.
- **`--type context-dependent`** (only fires with the real repo / a file it reads / routing in a
  project's own instructions): the absolute score is **informational, NOT a fail** — judge by
  no-regression only. A ~0 here is expected; confirm by reading one real transcript to see whether
  the skill shaped the output.

A should-NOT-trigger query that fires **is** a real failure: the description is too broad, narrow it.

**Read the per-query rows, not just the headline.** A case that fired 1 of 2 runs is counted as a
pass, so a skill can score 9/10 while more than half its positives are coin flips. The rows are in
`evals/result.json`.

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
honest: **the queryset freezes at the first measurement.** Before it, write and rewrite the cases
freely — they are the specification of what the skill must catch. After it, they are the instrument,
and an instrument bent to the reading measures nothing. Every later miss is fixed in the DESCRIPTION,
including one you privately think is an unfair query. Only a change in what the skill DOES reopens
the set: a new capability earns a case, a dropped one loses its case. Editing the queryset in the
same change as a score is the signature of a bent instrument — `queryset_hash` moves and the diff
shows it, so justify it in the change description or do not make it.

**Before diagnosing a case that fires "half the time", re-measure with more runs.** At `--runs 2` a
1-of-2 is not a measurement — telling 50 % from 90 % apart takes roughly 17 runs per arm. A coin flip
and a real weakness look identical until then.

---

## Before you finish

1. `evals/trigger-eval.json` exists: ≥6 cases, ≥1 positive, ≥1 negative, realistic queries and
   genuine near-miss negatives.
2. The script was run from the repository → `evals/result.json` exists and its `description_hash`
   matches the description you are shipping.
3. No should-NOT-trigger query fired. One that did is a real defect — narrow the description and
   return to 1.
4. Every positive case was read individually, not just the headline score. For each miss, the WHY was
   answered from the three questions above and the fix addresses that cause — not the wording of the
   failed query.
5. `git diff` touches no `trigger-eval.json` unless what the skill DOES changed in the same change.
   A queryset edited alongside a score is an instrument bent to its reading.
6. `bash scripts/eval-gate.sh` → green for this skill.
7. Any line failing? Fix it and start again from 1.
