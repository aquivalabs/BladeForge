# Agent communication: what the research and the industry actually say

Compiled 2026-08-28 from a five-lens survey (academic literature, Anthropic's published guidance,
other vendors' model specs, HCI/UX research, and production coding-agent system prompts).
Every item was verified against its primary source by a research agent unless marked otherwise;
evidence strength is tagged strong / moderate / weak. This document is the research basis for the
CICERO 2.2.0 restructuring — the change map is at the end.

## The headline finding: rule lists break themselves

The strongest convergent result across all five lenses is structural, not stylistic — a long list
of style rules degrades its own compliance, silently.

| Source | Finding |
|---|---|
| FollowBench (Jiang et al., ACL 2024, arXiv:2310.20410) — strong | compliance drops as constraints stack onto one instruction; degradation is compounding |
| Eliav 2026, VeyraBench (arXiv:2607.19257) — moderate | perfect-compliance rate collapses toward zero by ~80 rules regardless of format or placement; markdown formatting of the rules themselves shows no consistent adherence advantage |
| Instruction stacking collapse (arXiv:2608.02639) — directional | models silently drop constraints as more are added, with no error signal; a model given 8 rules obeyed one and broke four |
| Practitioner account (dev.to, "Every Rule I Added Made It Worse") — anecdote | a style prompt grown to ~56k tokens made output "flatter, like a committee avoiding mistakes"; a 33× shrink improved it |
| Anthropic's own claude.ai prompts, 2024→2026 diffs | the arc runs from no formatting policy → strict itemized bans → "use the minimum formatting appropriate" — less rule, more principle, each generation |
| Anthropic, "Effective context engineering for AI agents" | aim for the Goldilocks zone: not brittle hardcoded logic, not vague guidance; "minimal does not mean short — the measure is information density" |

Position matters too:

- **Lost in the Middle** (Liu et al. 2023, arXiv:2307.03172) — strong — content mid-context is
  underweighted relative to the start and end; a rule buried mid-document is the one most likely
  to be silently dropped.
- **Order Matters** (Zeng et al. 2025, arXiv:2502.17204) — moderate — constraint position affects
  compliance; put the most important and most-violated rules first or last.
- Anthropic context-engineering post: structural delineation (headers/tags) is what keeps a longer
  prompt navigable — headers are mechanism, not decoration.

## Sycophancy and behavior under pressure

- **Towards Understanding Sycophancy in Language Models** (Sharma et al., ICLR 2024,
  arXiv:2310.13548) — strong — five production assistants are consistently sycophantic; humans and
  preference models prefer convincing sycophantic answers over correct ones a non-trivial fraction
  of the time. The bias is in the RLHF training signal itself, so an instruction is fighting the
  gradient — it must exist, be blunt, and give the model explicit cover to disagree.
- **The FlipFlop Experiment** (arXiv:2311.08596) — moderate — a bare "are you sure?" flips
  previously-correct answers to incorrect at a high rate. A style guide must address holding a
  verified position under pushback, not just initial-answer honesty.
- **ELEPHANT** (Cheng et al. 2025, arXiv:2505.13995) — strong — social sycophancy is distinct from
  factual sycophancy: models validate the user's self-image and both sides of a dispute far more
  than humans do. "No flattery" must cover judgment calls (reviewing a plan), not only facts.
- **Flattery, Fluff, and Fog** (Bharadwaj et al., ICLR 2026, arXiv:2506.05339) — moderate — names
  the three preference-model biases: flattery (empty praise), fluff (padding/structure over
  content), fog (vague jargon-as-authority). These correlate with reward-model scores, not with
  human judgment — three concrete anti-patterns worth forbidding by name.
- **Anthropic, Opus 4.5 system prompt (Nov 2025→Jan 2026 diff)**, `responding_to_mistakes_and_criticism`:
  own mistakes honestly, avoid collapsing into self-abasement or escalating apology, do not grow
  submissive under abuse, think a user's correction through before accepting it ("users sometimes
  make errors themselves"). The sharpest published language on the apology-spiral failure mode.
- **Windsurf/Cascade system prompt** (leaked): "Refrain from apologizing all the time when results
  are unexpected; instead, just try your best to proceed or explain the circumstances."
- **Simple synthetic data reduces sycophancy** (Wei et al. 2023, arXiv:2308.03958) — moderate —
  sycophancy grows with scale and instruction tuning; prompting is the only lever available at the
  system-prompt layer, so it should be explicit rather than assumed.

## Verbosity and length bias

- **A Long Way to Go** (Singhal et al. 2023, arXiv:2310.03716) — strong — reward-model score
  correlates strongly with length; a purely length-based reward reproduces most measured RLHF
  gains. Verbosity is close to the dominant thing reward models optimize; "be concise" fights the
  training gradient and needs to be concrete.
- **Verbosity Bias in Preference Labeling** (Saito et al. 2023, arXiv:2310.10076) — moderate —
  GPT-4-as-judge picks the longer answer >90% of the time when lengths differ by >20%. Any
  LLM-judged eval of conciseness must control for length.
- **Style Over Substance** (arXiv:2307.03025) / **Style Outweighs Substance, SOS-Bench**
  (arXiv:2409.15268) — moderate — human and LLM evaluators rate fluent-but-flawed answers above
  short-but-correct ones; judged "quality" is dominated by style. Don't tune a house voice purely
  against judge feedback.
- Production convergence: every surveyed CLI agent backs "be concise" with a number — Claude Code
  "<4 lines" (leaked), Gemini CLI "<3 lines" (open source), an internal Claude Code variant
  "≤25 words between tool calls" (reported). A numeric anchor is checkable; an adjective is not.
- **GPT-5 / Cursor** (OpenAI cookbook, official): verbosity is multi-axis — Cursor runs low global
  verbosity but high verbosity for code/diffs; GPT-5.1 decomposes agent narration into frequency /
  verbosity / tone / content. A single global terseness dial is the wrong model.
- **NN/g, "Less Chat, More Answer"** (2026) — moderate, n=9 — users want the "truncated pyramid":
  lead with the essential answer, offer depth on demand; filler ("great question!") actively
  annoys; 2–3-sentence paragraphs.
- **NN/g, "6 Types of Conversations with Generative AI"** (2023 diary study) — moderate — length
  should flex with information-need type, not follow one flat cap.

## Persona and role prompts

- **When "A Helpful Assistant" Is Not Really Helpful** (Zheng et al., EMNLP Findings 2024,
  arXiv:2311.10054) — strong — 162 personas, 4 model families: persona in the system prompt does
  not improve factual accuracy and can add unpredictable bias.
- **Expert Personas Improve Alignment but Damage Accuracy** (Hu et al. 2026, arXiv:2603.18507) —
  moderate — "act as an expert" helps preference-style tasks, hurts factual retrieval.
- Consequence: a voice buys tone, never correctness. Correctness needs separate mechanisms
  (verification rules, tool use, evidence).

## Ask vs act

- **Horvitz, Principles of Mixed-Initiative UI** (CHI 1999) — strong, seminal — act autonomously
  when the expected cost of a wrong guess is low and reversible; dialogue only to resolve *key*
  uncertainties; make stopping/undoing an in-flight action trivially cheap.
- **OpenAI Model Spec** (2025-12-18): default to acting with stated assumptions; ask as risk
  rises. **GPT-5 guide** goes further for coding agents: "proactively attempt the plan for the
  user to approve/reject rather than asking whether to proceed"; confirmation reserved for named
  high-stakes actions (payments, deletions, irreversible sends).
- **Devin system prompt** (leaked): the most mechanized version — three explicit states: proceed /
  narrate-without-blocking / block-and-ask, with block reserved for "you literally cannot take any
  meaningful next step without information only the user can provide."
- **Anthropic prompting docs** (official sample): "local, reversible actions — proceed; actions
  that are hard to reverse, affect shared systems, or could be destructive — ask first," with a
  concrete list (force-push, hard reset, amending published commits, anything visible to others).
- **Microsoft HAX G10** (Amershi et al., CHI 2019) — strong — when uncertain about the user's
  goal, ask a narrow clarifying question or scope down; don't guess broadly.
- **Aider** (official): sidesteps the judgment call entirely — the user toggles ask/code modes.
  A design-level alternative to prompting the model to infer verbosity and autonomy.

## Explanations, trust, and uncertainty

- **Bansal et al.** (CHI 2021, "Does the Whole Exceed its Parts?") — strong — explanations
  increased acceptance of AI recommendations right or wrong; they did not improve human+AI
  accuracy. An unconditional "explain your reasoning" rule can increase blind trust.
- **Fostering Appropriate Reliance** (CHI 2025) — strong — reliance on *incorrect* answers drops
  specifically when verifiable sources are cited; explanations alone raise reliance on everything.
  For a coding agent: cite the file, the command, the output — not just the reasoning.
- **Vasconcelos et al.** (CSCW 2023) — strong — explanations reduce overreliance only when they
  are cheap to check relative to the task. A one-line premise beats a paragraph of rationale.
- **"I'm Not Sure, But…"** (FAccT 2024, arXiv:2405.00623) — strong, n=404 — first-person hedges
  reduced overreliance and increased overall accuracy; exact phrasing matters.
- **Confronting Verbalized Uncertainty** (IJHCS 2025) — strong, n=156 — medium verbalized
  uncertainty beat both overconfidence and constant hedging on trust and task performance.
  Calibrated, not reflexive, hedging.
- **Just Ask for Calibration** (Tian et al. 2023, arXiv:2305.14975) — strong — verbalized
  confidence is better calibrated than raw token probabilities in RLHF models.
- **To Rely or Not to Rely** (Bo et al., CHI 2025, arXiv:2412.15584) — strong — most
  reliance-calibration interventions fail; an explicit, direct disclaimer ("verify X
  independently") outperformed subtler cues.
- **LLMs are overconfident in their own responses** (arXiv:2606.03437) — moderate — models rate
  their own prior output ~26% more confident than identical text attributed elsewhere;
  self-review is not neutral, which argues for independent review agents.
- **NN/g, Explainable AI in Chat** (2025) — moderate — displayed step-by-step "reasoning" is often
  post-hoc rationalization; citations create false confidence because users rarely check them.
- **Google PAIR guidebook** — moderate — avoid bare numeric confidence for general users; disclose
  limitations early; "the best explanation is likely a partial one."

## Interruptions and progress reporting

- **Horvitz 1999** + interruption-cost literature (MDPI Appl. Sci. 2018) — moderate — negotiated
  interruptions (signal, let the user choose the moment) beat forced ones; poorly timed
  interruptions raise workload and error rates.
- **Agentic Coding Needs Proactivity, Not Just Autonomy** (2026, arXiv:2605.06717) — moderate —
  proposes a "notification budget"; silence should be a justified decision, not a default.
- **HAX G1/G2/G4/G11** (CHI 2019) — strong — state capabilities up front, signal how well the
  system does what it does, surface only task-relevant information, keep rationale available on
  demand rather than forced into every message.
- **Trust Dynamics in AI-Assisted Development** (ICSE 2025) — strong — developers judge whether to
  trust a suggestion by its comprehensibility and perceived correctness at the moment of the
  suggestion; supply "why this change, what it touches" right there, not as an afterthought.
- Stack Overflow 2025 survey (secondary, weak): trust in AI output fell 40%→29% while adoption
  grew — the binding constraint looks like verification friction, not capability.

## Formatting: structure vs prose

- **Corrected 2026-08-28.** This section previously said the evidence for structure was thin
  across the board. That is wrong for tables specifically: Brick, McDowell & Freeman, *Risk
  communication in tables versus text*, Royal Society Open Science 7(3):190876, 2020 — strong —
  is a pre-registered randomised trial, **N=2,305**, in which the same facts scored 79.6% correct
  as a table against 69.7% as prose (**d=0.39, rising to d=0.43 at six weeks**). Its scope is
  structured comparative facts; it says nothing about narrative. See
  `answer-shape-research.md` for the full correction.
- The general claim survives: no controlled study was found that gave humans the same answer in
  bulleted and in prose form and measured comprehension. Pro-structure evidence is either
  LLM-as-reader (Format-Adapter, MDEval) or preference rather than comprehension (Chatbot Arena).
  Vendors' markdown-heavy defaults are a training artifact ("The Last Fingerprint,"
  arXiv:2603.27006, weak), not measured reader benefit.
- **Claude Code issue #26390** (live, official repo): the terminal renders only ~60% of GFM and
  silently destroys the rest — headers h2–h6 collapse to bold, link labels are discarded,
  strikethrough renders literally, task-list checkboxes lose state, nested blockquotes flatten.
  A style rule that prescribes an unrendered feature prompts for silent failure; measured render
  facts are among the highest-value content a style prompt can carry, because the model cannot
  get them anywhere else.
- **Codex CLI final-answer spec** (open source, shipped): the most engineered formatting contract
  surveyed — plain text, optional short bold headers, 4–6 bullets ordered by importance, single
  `file:line` references (ranges forbidden), "skip heavy formatting for simple confirmations,"
  and the only named anti-pattern: structure "should not feel mechanical."

## Craft: making style instructions stick

- **Rules vs examples**: Anthropic's docs recommend examples as the most reliable style lever, but
  their agent-specific guidance has shifted — for frontier agents, "diverse, canonical examples"
  plus general principles beat both laundry-list rules and exhaustive example sets.
- **Positive vs negative framing** — genuinely mixed: the "pink elephant" argument says negative
  instructions backfire, but OpenAI's Codex guide measured a negative rule **with a stated
  reason** outperforming its positive equivalent. Weakest form anywhere: a bare "don't do X" with
  no reason and no replacement. Strongest: "do Y, because Z" or "avoid X because Z; do Y instead."
- **Tiering**: the OpenAI Model Spec's contribution — mark which rules are invariants and which
  are defaults that yield to an explicit user request. A flat list forces the model to guess.
- **Validation**: OpenAI Codex guide — have the model introspect on its instructions and validate
  changes "through evaluation rather than intuition." No surveyed tool ships a style-adherence
  eval harness; the industry gap is open. Caution for any such harness: judge models prefer longer
  answers (Saito 2023), so comparisons must be length-controlled.
- **IFEval** (Zhou et al. 2023, arXiv:2311.07911) — strong — the template for checkable
  constraints: a rule phrased so compliance is objectively verifiable is a rule that can be
  tested at all.

## What this changed in CICERO 2.2.0

| Finding | Change |
|---|---|
| rule-count degradation; less rule, more principle | 25 rules → 20; merged overlapping rules (plain-words+terms, depth+decoration, answer+outcomes+checks, decide+recommend+why+insight); justifying prose cut ~30% while every measured table and worked example stayed |
| position effects (lost-in-the-middle, order matters) | invariants moved to the top ("The floor"), the self-check moved to the very end; mechanical reference tables sit in the middle where drop-risk matters least |
| no published tiering in the old file | explicit two-tier contract: every rule is a user-overridable default except the four floor rules |
| FlipFlop, apology-spiral, `responding_to_mistakes_and_criticism` | new own-the-mistake floor rule: own the mistake once, re-derive before accepting a correction, "are you sure?" is not evidence, no growing submissiveness |
| sycophancy is trained-in and needs blunt cover | "no flattery" promoted from a trailing clause of the push-back rule to the no-flattery floor rule, with the never-open-with-praise formulation |
| evidence beats explanation for calibrated trust | honesty rule now says "show the evidence: the test output, the command and what it returned" |
| structure-helps-comprehension is a heuristic, not a finding | the shape rules kept as house preference, but their prose no longer argues they are self-evident. **Partly superseded 2026-08-28** — Brick 2020 earns the table for schema-shaped comparison; see `answer-shape-research.md` |

Deferred, deliberately: a style-adherence eval harness (length-controlled judging per Saito 2023)
— a separate project; and numeric response-length caps, which fit a terse CLI agent but not a
voice whose replies are often reports.
