---
description: "Use whenever the plan is to spawn, fan out, or parallelize agents \u2014 ANY multi-agent work, not just when models are mentioned. Triggers: \"spawn/kick off subagents\", \"a bunch of agents in parallel\", fleets that audit/comb/sweep/hunt across files, verify or skeptic stages, reviewer fan-outs, loop-until-done runs, authoring or editing a Workflow script (agent()/parallel()/pipeline()), or writing agent-definition frontmatter. Every spawned agent must get an EXPLICIT model tier assigned BEFORE it launches: reserve expensive head models for a small bounded set of final judges/synthesizers; mid-tier for judgment (review, verify, hunt); cheap tier for mechanical sweeps (grep, list, count, rename). Activate even when the user says nothing about models or cost \u2014 an omitted model silently inherits the pricey session model, and fan-out multiplies that waste by the agent count."
---

# Model Routing — the right model for every agent

One rule above all: **never leave `model` implicit on a spawned agent.** An omitted model inherits
the session model (usually the most expensive tier), and fan-out multiplies that mistake by the
agent count. This skill exists because a real workflow once spawned 240 verifier agents on the
session's Opus — ~2.5× the cost of the same work on Sonnet — purely from omitted `model:` options.

## The tiers

| Tier | Model | Who runs here | Why |
|---|---|---|---|
| Head | opus / session model | Final judges, synthesis, architecture verdicts. **Bounded set**: fixed reviewer agents (one instance each) and at most ~3 head agents per workflow | High cost of error, low count |
| Work | `sonnet` | Reviewers, verifiers/skeptics, bug hunters, code-reading with judgment, doc/architecture hunters | Reads code and reasons; ~40% of head price |
| Sweep | `haiku` | Greps, file sweeps, renames, counting, format checks, Explore-style searches | No judgment needed; ~20% of head price |

Rule of thumb: if the agent's prompt says *decide / judge / verify / trace / place* → Work tier.
If it says *find / list / count / rename / collect* → Sweep tier. Head tier is never the default —
each head agent needs a one-line justification.

## Hard rules for Workflow scripts

1. **Every `agent(...)` call carries an explicit `model:`** (and `effort: 'low'` on mechanical stages).
2. **Head-tier cap:** at most 3 head-model agents per workflow script. Fixed agent definitions with
   their own `model:` frontmatter (e.g. a reviewer set) are exempt — they are bounded by design.
3. **Hard agent budget:** every loop has a round cap or agent ceiling. "Loop until no new findings"
   does NOT converge with creative models — they always invent something.
4. **Dedup by location, not by title.** Agents rephrase the same finding every round; title-string
   dedup lets the fan-out snowball.
5. **Measure one, then announce scale — as a table, BEFORE launch.** For any multi-instance run
   (workflow fan-out, eval probes, agent fleets): run ONE representative unit capturing real usage
   (`--output-format json` → `usage` + `total_cost_usd`, or the task-notification `total_tokens`),
   never estimate from gut feeling. Then show the user this table and wait for the go-ahead when
   the spend is non-trivial:

   Metrics as ROWS, one row per token class; the share column is the CURRENT 5-hour session
   window (the quota that actually gates right-now work):

   | Metric | Per 1 unit | × N units | ≈ % of 5h session window |
   |---|---|---|---|
   | input | measured | multiplied | price-weighted share |
   | cache-write | measured | multiplied | price-weighted share |
   | cache-read | measured | multiplied | price-weighted share |
   | output | measured | multiplied | price-weighted share |
   | **Total** | sum | sum | **the headline number** |

   NO raw dollar figures in the user-facing table — window percentages only (dollars stay an
   internal conversion step). Calibrate window capacity from the user's `/usage` panel
   (approximate and machine-local — mark shares with ≈; refresh the calibration pair in memory
   whenever the user shows a fresh panel). If the window is already saturated, say so and
   propose waiting for the reset instead of launching into throttling.

6. **Progress beacon — always.** Every multi-item background queue writes its position to
   `~/.claude/progress/current.json` after EACH item:
   `{"task", "step", "total", "item", "eta", "updated_epoch"}`. The user's status line renders it
   live (`⚙ task 7/15 · item · ETA hh:mm`); stale beacons (>15 min) auto-hide. A queue without a
   beacon leaves the user staring at a silent shell — that is a defect, not a style choice.

## Eval spend protocol (skill-description evals)

- **New skill** → full rich loop right away (e.g. runs 3 × 3 iterations, ≈25% of a window) —
  a skill ships good from day one; the spend is a one-off.
- **Bulk eval of the existing fleet** → cheap triage first (runs 2, 1 iteration, ≈5.5%/skill),
  then the optimization loop ONLY for skills that failed triage (runs 2, 2 iterations,
  ≈11%/skill). Never run the full loop across the whole fleet.

## Agent definitions (`.claude/agents/*.md`)

Persistent agents get their tier pinned in frontmatter (`model: sonnet` / `model: haiku`) so every
launch is cheap by construction. Only head-tier agents may omit it (inherit).

## Rationalizations — thought → reality

| Thought | Reality |
|---|---|
| "It's just a few agents, the default model is fine" | Fan-out multiplies. 5 finders × rounds × 2 verifiers = hundreds. Set the model. |
| "This verify task is subtle, it needs the big model" | Refuting a claim by reading code is Work tier. If the *synthesis* is subtle, put ONE head agent at the end. |
| "Haiku everywhere, cheapest wins" | Judgment tasks on Sweep tier return confident garbage — you pay twice: once for the run, once for the rework. |
| "The loop will stop when findings dry up" | It won't. Creative models never run dry. Cap rounds or budget. |
| "I'll remember to set models next time" | Memory is advisory. The PreToolUse guard hook blocks what discipline forgets. |
