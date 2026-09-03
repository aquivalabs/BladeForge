# Adversarial critique — the evidence

The rules in `SKILL.md` are distilled from the 2026 literature on LLM critics. This file is the
why behind each, kept out of the body because it is not needed on every firing.

## The core finding — detection is the bottleneck

An author critiquing its own work barely helps: a model endorses its own reasoning, so it cannot
see its own error. Self-correction of reasoning lands at **0–23 %**; an **independent** critic on
the same artifact reaches roughly **70 %**. This is why rule 1 (independent, never self) and rule 6
(parallel-then-synthesize) are load-bearing rather than stylistic.

## Diversity is the top success factor

Multiple critics help only when they carry DISTINCT angles. Identical critics agree and reproduce
the same blind spot; varying the lens — and where possible the seed, tier, or model family — is what
removes it. This is rule 2.

## Step-level beats outcome-level

Critiquing one component at a time, in its own lane, outperforms a single whole-artifact verdict by
a large margin. Scoped attention keeps findings focused and undiluted. This is rule 3.

## Adversarial framing counters sycophancy

Neutral, impersonal, refute-first framing counters the model's pull toward praise. Leading or
personal wording breeds sycophancy; an explicit red-team instruction is the countermeasure. This is
rule 4, paired with rule 5 (a rubric per lens — Constitutional-AI-style principled critique).

## Debate degrades, it does not improve

Letting critics debate to consensus collapses into stance homogenization and factual attrition — the
"deliberative illusion". Keeping the critics apart and having one synthesizer merge them preserves
the diversity. This is rule 6.

## Known biases (LLM-as-judge)

- **Self-preference:** a critic of its own model family inflates. Best fix is a cross-family critic;
  otherwise compensate and state the caveat.
- **Verbosity / position / format:** these bite pairwise A/B judging more than design critique. Keep
  rubrics length-neutral, randomize order in comparisons.

## Sources

- Constitutional AI (Anthropic) — https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback
- LLMs Cannot Self-Correct Reasoning Yet (ICLR 2024) — https://proceedings.iclr.cc/paper_files/paper/2024/file/8b4add8b0aa8749d80a34ca5d941c355-Paper-Conference.pdf
- The Self-Correction Illusion (correct others, not themselves) — https://arxiv.org/html/2606.05976v1
- LLM Critics Help Catch LLM Bugs (OpenAI / CriticGPT) — https://cdn.openai.com/llm-critics-help-catch-llm-bugs-paper.pdf
- Multiagent Debate Improves Factuality — https://www.emergentmind.com/papers/2305.14325
- The Deliberative Illusion (debate degradation) — https://arxiv.org/pdf/2606.03032
- LLM-as-Judge bias mitigation (2026) — https://futureagi.com/blog/evaluating-llm-judge-bias-mitigation-2026/
- Self-Preference Bias in LLM-as-a-Judge — https://arxiv.org/pdf/2410.21819

## Stopping — why convergence must be imposed

A design critique has no external oracle: no tests to run, no execution to fail. A critic asked to
"find problems" therefore never runs dry — an LLM produces plausible findings even on correct text —
and an iterating loop can settle on a **false fixed point**, a confidently-wrong stable state. So the
exit condition is imposed, not awaited: a fixed round cap (some 2025 methods make it literal —
"identify exactly N flaws, then revise" — to keep the exit checkable), stopping on severity (a round
with no new structural finding) rather than on the critic falling silent, and a human as the
oracle-substitute. The real oracle of a design is building it: after two or three rounds the return
drops, and a round that still surfaces structural holes is a signal to prototype, not to run another
round.
