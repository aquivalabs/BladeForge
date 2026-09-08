# Diagram skill — triggering eval

**Measured 2026-09-08 (sonnet, 3 runs): best 9/23 (0.391).** All 9 should-NOT queries passed; the 14
should-trigger queries fired ~0/3. Read that number with the caveat below — it is the harness
under-measuring a read-first skill, not the description failing in practice.

**Why the low positive recall is the methodology, not the skill.** `score-description.py` counts a trigger
only when the model invokes the `Skill` tool (or reads SKILL.md) among its FIRST tool uses. A "draw me a
diagram of how these classes connect" request makes the model open with `Bash`/`Read` to look at the
scope FIRST, then draw — so a genuine intent-to-diagram is recorded as a miss. The scorer's own docstring
warns that an isolated eval under-measures a context-dependent / repo-reading skill and that only the
no-regression check is meaningful there. The eval-gate blocks on a MISSING or STALE measurement, not on
the score, so this result satisfies the gate; the number is a known floor, not the skill's real hit rate
(manual use triggers it reliably). A dedicated description-triggering pass (`--suggest`) is a worthwhile
follow-up, tracked separately — it is not a ship blocker.

- **What changed since the last measurement:** the retired run scored the D2-era description against a
  DIFFERENT 23-query set (different example entities, e.g. a `saved-view` feature; one extra
  should-not query about "D2 vs Mermaid"; and it lacked today's heterogeneous react+apex+lambda
  should-trigger case). The current `rubric.json` has 14 should-trigger + 9 should-not queries with
  neutral demo entities. Neither the description hash nor the query-set hash from that run matches what
  ships now — a full fresh run is required, not an incremental delta.

- **Expectation set:** `rubric.json` defines what a correct trigger decision looks like (23 queries:
  charts, dashboards, prose explanations, ASCII, Lucid/Excalidraw, tool-choice Qs stay quiet; "draw me
  a readable diagram of how X works" — spec-based, raw-code, and heterogeneous — should fire).

- **To measure:** run the description-triggering harness (`score-description.py`, nested `claude -p`
  per query) with the skill installed as a real `.claude/skills/diagram/`. This is a fan-out
  (23 queries × N runs of nested sessions) — cost it with `meta:model-routing` and get a go-ahead
  before launching; it is not something to run silently.

## Known harness artifact — read before trusting a low recall number

The skill-creator `run_loop` / `run_eval` path scores recall ≈ 0 for a spurious reason, not because the
description is bad. That harness stubs the skill as a transient slash-command (`-skill-<hash>`) and only
counts a trigger when the model's **first** tool call is `Skill`/`Read` of that hash. Slash-commands
don't auto-trigger the way installed skills do, and diagram tasks routinely open with `Bash` (checking
a tool) or reading the scope first — so genuine triggers are recorded as misses. Prefer the installed
`.claude/skills/` triggering check over the transient-hash loop, and read any near-zero recall from the
loop as suspect until confirmed against a real install.
