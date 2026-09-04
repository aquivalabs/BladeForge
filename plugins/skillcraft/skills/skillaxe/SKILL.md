---
description: "Use to diagnose, audit, or improve a GUIDE skill — one that tells an agent how to produce something (an authoring guide, a review lens, a house-convention skill). Fires when you ask: does this skill actually help or is it decorative; diagnose where a guide skill falls short and propose fixes; audit a skill and measure its real effect on the output; the guide skill doesn't seem to change what the agent produces, prove it either way; improve a guide skill without dropping what already worked; run a with-and-without comparison on a skill. It holds the comparison protocol itself — invoke it whenever someone is about to run such a diagnosis by hand, and whenever a prior edit made a skill worse and you need regression protection. Do NOT use to measure whether a skill's DESCRIPTION triggers (meta:skill-eval scores activation; this scores the produced result); to scaffold a brand-new skill (meta:new-skill); or to refresh a skill's metadata.yaml (meta:update-skill)."
---

# SkillAxe — measure and improve a guide skill

An embedding-optional adaptation of SkillAxe (arXiv 2606.10546) for auditing **guide skills** — the
skills that tell an agent how to produce something. It answers a question no trigger-eval can: once the
skill has fired, does its guidance make the output better, and where does it fall short?

## Contract

**In:** a guide skill under test · a task it is meant to help with · the skill's own
`evals/acceptance.json` (the expectations that define "done right") · optionally an embedding model
for the two geometric axes.

**Out:** a per-axis score with numbers (Quality Impact `d·m`, Instruction Compliance SkillScore, and —
when embeddings are available — Trigger Precision and Solution-Path Coverage) · a fault-attributed list
separating the guide's own fixable weak spots from agent mistakes · and, if fixes are applied, a
before/after verdict proving they helped and caught any regression.

---

## Instructions

Run the pipeline. Full worked detail, formulas, and the measured evidence → `references/method.md`.

1. **Generate with and without the guide.** Same task, two agents (Sonnet tier). One reads the guide;
   one is **isolated from the whole repo** and works from general knowledge. Both write to a scratch
   dir. Isolation is load-bearing — an un-isolated baseline copies sibling skills and inflates the
   coverage delta.
2. **Judge (LLM, Sonnet tier).** Quality Impact (`d·m` ∈ [−1,1], with vs baseline) and an
   Instruction-Compliance rubric extracted from the guide — per rule: weight `w`, adherence `a`,
   rule-quality `g`, and **skill-fault `f`** (is a low score the guide's fault or the agent's).
3. **Embeddings (optional, ~0 tokens).** Trigger Precision (cosine geometry over the produced
   `trigger-eval.json`) and Solution-Path Coverage (mean-max cosine of plausible paths vs skill
   chunks). Skip cleanly and say so if no embedding model is reachable.
4. **Attribute.** Rules with `f > 0` are the guide's own fixable weak spots. Everything else is agent
   behaviour, not a guide defect.
5. **Fix + re-judge behind the anchor.** Never trust a rewrite unseen — see the anchor below.

## The anti-regression anchor — mandatory

The danger is never the diagnosis; it is the rewrite step, where an agent trimming a guide silently
drops the good parts.

- **Before editing, freeze a must-survive list**: the boundary clauses, correctness checks, and
  examples the guide already has. They may not disappear in a rewrite.
- **A before/after judge is not optional.** Without it you see "4 of 5 fixed" and miss three good
  things quietly lost.
- **Shortening is not licence to drop correctness.** Length may fall; boundary sentences, correctness
  checks, and at least one example must survive.

## When to run it, when not

| Run it | Don't |
|---|---|
| periodic audit of a high-traffic guide skill | a one-line wording fix |
| a guide that seems not to help | a rarely-touched skill |
| a large rewrite before merge | ordinary day-to-day edits |

It costs a fan-out of agents — measure one unit and price the run before scaling (see `meta:model-routing`).

---

## Before you finish

1. Every dispatched axis has a number, or an explicit `not-run` reason (embeddings unavailable) —
   never a silent skip.
2. Findings are split: guide-fault (`f>0`, fixable here) vs agent-fault (not a guide defect).
3. If a fix was applied, a before/after judge ran and every must-survive item is confirmed present.
4. Any line failing? Fix it and start again from 1.
