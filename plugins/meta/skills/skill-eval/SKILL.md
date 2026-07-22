---
description: "Use to MEASURE whether an existing skill's description actually triggers, score it, and decide if it is fit to ship. Triggers for \"evaluate/measure/score this skill\", \"does my skill trigger\", \"why does my skill score 0\", \"is this description good enough to publish\", \"check the trigger eval\", or when a skill's description changed and you need honest before-vs-after numbers. This is the CANONICAL skill measurer for this marketplace — use its bundled score-description.py, NOT skill-creator's run_eval/run_loop (which produce systematic false-negatives). NOT for scaffolding a new skill (meta:new-skill), refreshing metadata.yaml (meta:update-skill), or the deterministic pre-push gate (scripts/eval-gate.sh)."
---

# Skill Eval — Faithful Trigger Scoring

Measure whether a skill's `description` actually causes Claude to **reach for it**, score it 0–10,
compare against the previous description, and get a plain-language verdict on what to fix. The
bundled `scripts/score-description.py` is the canonical measurer. It is self-contained (stdlib +
`claude -p`; no skill-creator import), so it travels with the `meta` plugin.

## When to Activate

- Measuring/scoring an existing skill's trigger accuracy before shipping or after editing its
  `description`.
- Someone reports a skill "scores 0 / never triggers" — diagnose it here.
- Deciding whether a description is good enough to publish.

## If this skill (or its script) is missing — STOP and get it

The bundled `score-description.py` is **required** to measure a skill. If it is not present (this
plugin/skill isn't installed in the current repo), do NOT fall back to skill-creator's `run_eval`:
**emit a warning that `meta:skill-eval` is required and ask the user to install it** (enable the
`meta` plugin from this marketplace), then stop. Measuring with the wrong tool is what produces the
false zeros this skill exists to prevent.

---

## The one rule that matters most

**Measure with `score-description.py` (bundled here) — NOT skill-creator's `run_eval`/`run_loop`.**

skill-creator registers the tested skill as a transient **slash-command**
(`.claude/commands/<name>-skill-<hash>`) and counts a trigger only if `Skill`/`Read` is the model's
**first** tool call. Real tasks open with `Bash`/`Write`/`TodoWrite`, so it reports **systematic
false-negatives** — a good skill scores ~0. `score-description.py` instead installs the skill as a
**real** `.claude/skills/<name>/` (how it reaches Claude in production) and scores by whether the
`Skill` tool actually fires across real `claude -p` runs.

---

## Run it

```bash
python3 <this-skill>/scripts/score-description.py --skill-path plugins/<domain>/skills/<name> \
  [--runs 5] [--model opus] [--bar 7] [--type self-contained|context-dependent] [--suggest]
```

- Reads `<skill-path>/evals/trigger-eval.json` (≥6 cases `{"query","should_trigger"}`, ≥1 positive +
  ≥1 negative; realistic queries, genuine near-miss negatives).
- Prints a 0–10 score, a one-glance verdict, current-vs-baseline (git HEAD) with a **no-regression
  gate**, plain-language WHY, concrete recommendations, and the exact MISSED / wrongly-fired queries.
- `--suggest` adds ONE `claude -p` call proposing a rewritten description (no skill-creator).
- `--from-result <json>` re-renders a saved result with zero new eval spend.

**This spawns `claude -p` (an LLM agent). Run it LOCALLY, on demand — NEVER in CI.** CI runs only the
deterministic `scripts/eval-gate.sh` (schema + `queryset_hash` consistency), which needs no agent.

---

## Reading the result — the score is advisory, judged by skill type

- **`--type self-contained`** (the description alone should pull Claude to the skill): apply the
  absolute bar (`>= 7/10`) AND no-regression.
- **`--type context-dependent`** (only fires with the real repo / a file it reads / CLAUDE.md
  routing — e.g. an advisory or chained skill): the absolute score is **informational, NOT a
  fail** — judge it by **no-regression only**. A ~0 here is expected and does not mean the skill is
  bad; confirm by reading one real transcript to see whether it shaped the output.

A should-NOT-trigger query that fires **is** a real failure (the description is too broad — narrow
it). Anthropic's guidance: a ~0 usually indicts the eval/harness or is a context-dependent skill,
not the artifact.

---

## Checklist

- [ ] `evals/trigger-eval.json` exists, ≥6 cases, ≥1 positive + ≥1 negative, realistic queries
- [ ] Ran `score-description.py` locally (never CI); read the verdict
- [ ] No wrongly-fired negatives (any is a real failure — narrow the description)
- [ ] For a context-dependent skill: judged by no-regression + a manual transcript spot-check, not the raw score
- [ ] Deterministic gate (`scripts/eval-gate.sh`) still green for the skill
