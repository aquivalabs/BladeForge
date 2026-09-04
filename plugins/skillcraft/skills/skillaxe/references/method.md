# SkillAxe-lite — measuring whether a guide skill actually helps

A trimmed, embedding-optional adaptation of SkillAxe (arXiv 2606.10546) for auditing **guide skills**
in this marketplace — the skills that tell an agent how to produce something (`meta:new-skill`,
`git:commit`, a review lens). Use it when you suspect a guide is not pulling its weight, before a big
rewrite, or as a periodic audit of a high-traffic guide. Not for every one-line edit — it costs a
fan-out of agents.

## Contract

**In:** a guide skill under test · a task the guide is supposed to help with · its own
`evals/acceptance.json` (the expectations that define "done right").

**Out:** a per-axis score with numbers, a fault-attributed list of the guide's own weak spots
(fixable) separated from agent mistakes (not the guide's problem), and — if you apply fixes — a
before/after verdict that proves the fixes helped and caught any regression.

## What to keep, what to drop

The paper carries heavy ML the marketplace does not need. Drop it; keep the judgment.

| Original SkillAxe | In this method |
|---|---|
| Trigger Precision via embedding zones / UMAP | keep the axis, compute cosine on the skill's own `trigger-eval.json` positives/negatives; skip if no embedding model is reachable |
| Solution-Path Coverage via embeddings | same — mean-max cosine of plausible solution paths against skill chunks; optional |
| Quality Impact (LLM judge, `d·m`) | keep — LLM judge, no embeddings needed |
| Instruction Compliance + fault attribution | **keep — this is the core.** It turns "came out bad" into a concrete guide edit |
| A no-skill baseline agent | keep, but **isolate it hard** (no repo access) — an un-isolated baseline copies sibling skills and contaminates the coverage delta |

Embeddings are optional and were the two axes safe to cut when unavailable. The judge + fault
attribution + an anti-regression anchor are **not** optional.

## The pipeline

1. **Generate with and without the guide.** Same task, two agents: one reads the guide, one is
   isolated from the whole repo and works from general knowledge. Both write to a scratch dir.
2. **Judge (LLM).** Quality Impact (`d·m` ∈ [−1,1], with vs baseline) and an Instruction-Compliance
   rubric extracted from the guide — per rule: weight `w`, adherence `a`, rule-quality `g`, and
   **skill-fault `f`** (is a low score the guide's fault or the agent's).
3. **Embeddings (optional).** Trigger Precision + Solution-Path Coverage in code, ~0 tokens.
4. **Attribute.** Rules with `f > 0` are the guide's own weak spots — the fixable list. Everything
   else is agent behaviour, not a guide defect.
5. **Fix + re-judge with the anchor (below).** Never trust a rewrite unseen.

## The anti-regression anchor — mandatory

This is the part that stops the method hurting you. The danger is never the diagnosis; it is the
**rewrite step**, where an agent trimming a guide silently drops the good parts.

- **Before editing, freeze a must-survive list**: the boundary clauses, the correctness checks, the
  examples the current guide already has. These may not disappear in a rewrite.
- **A before/after judge is not optional.** It compares old-guide output to new-guide output and
  checks every must-survive item is still present. Without it you see "4 of 5 fixed" and miss that
  three good things were quietly lost.
- **Shortening is not licence to drop correctness.** Length may fall; boundary sentences, correctness
  checks, and at least one example must survive.

## When to run it, when not

| Run it | Don't |
|---|---|
| periodic audit of a high-traffic guide | a one-line wording fix |
| a guide that seems not to help | a rarely-touched skill |
| a large rewrite before merge | ordinary day-to-day edits |

## What a real run showed (`meta:new-skill`, 3 tasks, isolated baseline)

- **The guide's win is coverage, not cleverness** — matching the paper. Artifact coverage went from
  1/6 files (baseline) to 6/6 (with-guide), identically across all three tasks. Quality Impact
  averaged `+0.68` on the −1..+1 scale; SkillScore `0.88`.
- **The guide also makes skills thinner.** All three judges found the baseline richer in domain
  content, and Solution-Path Coverage favoured the baseline on 2 of 3 tasks. Structural completeness
  is bought partly with substance — worth watching, hence anchor rule three.
- **Fault attribution reproduced the same fixable gaps** across tasks (`f≈0.3`): trigger-eval schema
  not shown, measurement/`result.json` fallback missing. Those became the guide edits landed in
  `meta` v2.3.0.
