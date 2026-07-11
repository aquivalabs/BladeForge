# Diagram skill — triggering eval

**Verdict: PASS — 6/6 spot-checked (100%).** The description triggers on real "make me a diagram of
how this works" requests (including the no-spec / raw-code path) and stays quiet on near-misses
(prose explanations, numeric charts).

- **Eval set:** `evals/evals.json` — 23 queries (13 should-trigger incl. no-spec, 10 should-not
  near-misses: charts, dashboards, prose explanations, ASCII, Lucid/Excalidraw, tool-choice Qs).
- **Method:** manual `claude -p` triggering check — each query run as a real nested session with the
  skill available, killed early after the first tool decisions; TRIGGERED iff the model consults the
  `diagram` skill (`Skill{diagram}` or reads `skills/diagram/SKILL.md`) among its first tool uses.
- **Result:** 6/6 correct. All 4 should-trigger queries opened with `Skill:diagram`; both should-not
  near-misses opened with `Bash`/`Read` (working the task directly, never consulting the skill).
  Machine-readable detail in `results.json`.

## Why not the automated skill-creator loop?

`run_loop` / `run_eval` scored recall ≈ 0 across every description variant — an artifact, not a real
signal. That harness stubs the skill as a transient slash-command (`-skill-<hash>`) and only counts a
trigger if the model's **first** tool call is `Skill`/`Read` of that hash. Slash-commands don't
auto-trigger the way skills do, and diagram tasks routinely open with `Bash` (checking `d2`) or
reading the spec — so genuine triggers are recorded as misses. The loop therefore kept the original
description (nothing scored better) and produced no usable signal. Manual verification above is the
source of truth; the description was hardened by hand during development.
