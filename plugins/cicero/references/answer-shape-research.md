# Answer shape: which form fits which situation, and how a reply is separated

Compiled 2026-08-28 from a seven-lens survey — production vendor contracts, reading science on
vertical rhythm, technical-communication taxonomies, agent-narration honesty, product practice in
progressive disclosure, 2025-26 formatting-adherence research, and the Claude Code renderer itself.
Every claim traces to a named source; strength is tagged strong / moderate / weak / folklore.
This is the companion to `agent-communication-research.md`, which covers WHAT to say; this one covers
WHAT SHAPE to say it in. Two of its findings correct that document — see "Corrections" below.

## The headline finding: shape follows the size of the task

The single strongest consensus in the whole survey, and it is a consensus across competitors who
agree on almost nothing else: **a small result gets no structure at all.**

| Source | Wording |
|---|---|
| OpenAI Codex CLI (open source) — strong | "skip heavy formatting for single, simple actions or confirmations"; "casual one-offs → plain sentences, no headers/bullets" |
| GitHub Copilot, concise prompt (open source) — strong | "For simple or single-file tasks, prefer 1-2 short paragraphs plus an optional short verification line. **Do not default to bullets. On simple tasks, prose is usually better than a list**" |
| Amp (leak, wording overlaps Copilot's open-source copy) — moderate | same sentence, near-verbatim |
| Anthropic claude.ai system prompt (official) — strong | "avoids over-formatting… uses the **minimum formatting appropriate**"; in typical conversation "responds in sentences/paragraphs rather than lists" |
| Zed (open source) — strong | "**Match the level of detail to the task**… reach for structured headers, tables, or long explanations only when they genuinely help the user scan" |
| Claude Code 2.0 (leak) — moderate | "matching the level of detail… with the level of complexity of the user's query" |
| OpenAI Model Spec (official) — strong | formatting "should be used **judiciously** to aid the user in scanning" |

The second consensus is the named anti-pattern. The sentence "**Formatting should make results easy
to scan, but not feel mechanical**" appears identically in Codex's and Copilot's open-source prompts.
Copilot and Cursor both name its concrete form: never emit fixed scaffold labels — "Plan:",
"Task receipt:", "Actions:", "Summary:", "Update:" — and "create only the sections that make sense
and only when they have non-empty content."

## Corrections to `agent-communication-research.md`

**1. "Evidence that structure improves comprehension is thin" is wrong for tables specifically.**

> Brick, McDowell & Freeman, *Risk communication in tables versus text: a registered report
> randomized trial on fact boxes*, Royal Society Open Science 7(3):190876, 2020. **N=2,305,
> pre-registered.** Tabular presentation scored 79.6% correct against 69.7% for the same facts in
> prose — **d=0.39, rising to d=0.43 at a six-week follow-up.** Null result on trust and on decisions.

Scope matters: it tests *structured comparative facts*. It licenses the table for schema-shaped
content and says nothing about narrative. But it is stronger evidence than almost anything else in
either dossier, and the old "thin" verdict must go.

The old verdict survives for the general case. No study was found that gave humans the same LLM
answer in bulleted and in prose form and measured recall, task completion, or time. Pro-structure
evidence is either LLM-as-reader (Format-Adapter, MDEval) or preference rather than comprehension
(Chatbot Arena).

**2. The most-cited justification for white space is a fabricated citation.**

"Lin (2004): margins and white space increase comprehension by almost 20%" is quoted across the
design web. Lin's paper is about older adults' retention across Chinese UI designs (n=24, ages
62-80) and says nothing about white space. The error propagated via Galitz (2007, p.158); Myhill
debunked it and got confirmation from Lin himself. **Any rule about blank lines must be justified as
a convention, not as a measured comprehension gain.**

## Vertical rhythm and separation

**There is a measured optimum, and both crowding and over-airiness sit on the wrong side of it.**
Beege, Wirzberger, Nebel, Schneider, Schmidt & Rey, *Spatial Continuity Effect vs. Spatial Contiguity
Failure*, Frontiers in Education 4:86, 2019 (Exp1 N=98, Exp2 N=85; transfer t=2.54, p=.01): medium
spacing beat both tight and wide on retention and on transfer. Adding blank lines has a ceiling and
then a penalty. Ni et al. (2009) point the same way for line spacing — the smallest and the largest
both correlated with worse comprehension.

**Why blocks blur together even when the spacing is right.** Gestalt similarity: identical devices in
sequence are perceived as ONE object regardless of the space between them (Wertheimer 1923; Palmer &
Rock, *Psychonomic Bulletin & Review* 1(1), 1994, on uniform connectedness and common region). Two
tables back to back, or two trees, or two flat lists, merge no matter how many blank lines separate
them. **The fix is a change of device, not more air.**

**Why a blank line alone does not hold a reader.** Layer-cake scanning (NN/g eyetracking): fixations
land on headings and dip into body text only occasionally. A blank line offers the eye nothing to
land on; a leading label does. The F-pattern (NN/g, Pernice 2017, 45-47 participants per study) is
specifically what unformatted blocks produce — it is the failure mode of *not* separating, and the
named remedy is front-loaded headings, bold key phrases, lists, visual grouping. Readers get through
roughly 20-28% of the words (Weinreich, Obendorf, Herder & Mayer, *ACM Trans. Web* 2(1), 2008, 25
instrumented users), so information must sit at block START.

**Capacity.** Miller 1956 limits CHUNKS, not items, and chunk size is elastic — "seven items per
list" is a misreading he never wrote. His actual contribution is that recoding into named groups
defeats the limit. Cowan 2001 puts the central limit nearer four when rehearsal and grouping are
blocked. The segmenting effect is real and meta-analytic: Rey et al., *Educational Psychology Review*
31, 2019, plus an 88-study Mayer meta-analysis, *Educational Research Review*, 2025 — g ≈ 0.32-0.36.

**Signalling buys breadth at the cost of depth.** Lorch 1989; Lorch & Lorch 1996: headings improve
memory for the signalled content and for topic structure — readers recall more topics but less about
each. Heavy sectioning of a reply that needs one deep point is counterproductive. It also means
signalling works by scarcity: a rule used five times marks nothing.

**Line length.** Dyson & Haselgrove, *IJHCS* 54(4), 2001: ~55 characters per line beat 100 on
comprehension and was read faster than 25. The broader 50-75 range is a literature-review consensus
(*Visible Language*, 2005), and RFC 7994 fixes 72 for the same reason. An 80-120 column terminal
already exceeds the sweet spot for PROSE; tables and fenced blocks may use the full width.

**Two cautions against minimalism as a principle.** Bateman et al., CHI 2010: removing chartjunk did
not improve interpretation accuracy, and embellished versions were recalled better long-term — the
cost is in clutter, not in structure as such. And Ho Sang & Petrarca, *Visible Language* 59(3), 2025
(systematic review, 42 studies): most typographic prescriptions do not survive review, and
familiarity may matter more than intrinsic design. Prefer shapes the reader already knows — the RFC,
the man page, git output, a changelog.

**Accessibility.** Complex data tables are consistently among the hardest items for screen-reader
users across WebAIM surveys #4 through #10, unchanged over fourteen years. Cap table width; never
nest structure inside a cell.

## Situation → form: the prior art, and the map it yields

Nobody has published the map. The frameworks below each cover part of it; the merged table is this
dossier's own synthesis, and the conflicts it resolves are stated rather than hidden.

| Framework | What it contributes | Force | Evidence base |
|---|---|---|---|
| Horn, Information Mapping (1965-69; *Mapping Hypertext*, 1989) | seven information types — procedure, process, structure, concept, fact, principle, classification — chunked into labelled blocks; seven principles: chunking, relevance, labeling, consistency, integrated graphics, accessible detail, hierarchy | mandate inside the licensed method | assertion; chunking justified by citing Miller; **no published type→form table** — it sits behind training material |
| Minto, Pyramid Principle (1985) | answer first; every idea summarizes the group beneath it; siblings parallel and MECE; the analysis order is not the writing order | mandate on answer-first | assertion, no controlled studies |
| STOP (Tracey, Rugh & Starkey, Hughes Aircraft, 1965) | the thematic module: fixed extent, thesis headline, one visual, storyboarded first | mandate on the envelope | practice |
| DITA (IBM → OASIS, 2005) | task ⇒ `<steps>` is schema-MANDATORY: a procedure literally cannot be prose | strongest, enforced by validation | standards consensus |
| Google developer documentation style guide | "three or more pieces of related data → use a table"; one column → make it a list; "don't use a list to show only one item"; single-step procedure → a bullet, not a numbered list; state the goal before the action | guideline | assertion |
| Microsoft Writing Style Guide | a table is ">=2 rows plus header and >=2 columns"; "don't use a table just to present a list of items that are similar"; never leave a cell blank | guideline | assertion, with accessibility rationale |
| Wright & Reid, *J. Applied Psychology* 57 (1973) 160-166 | structured formats beat prose on accuracy AND speed for CONTINGENT information | research finding | **the one controlled experiment in the set** |
| Carroll, minimalism (*The Nurnberg Funnel*, 1990) | reading-to-do vs reading-to-learn; cut conceptual preamble; errors get their own visible slot | guideline | research, iterative usability studies |
| Degani & Wiener, NASA CR-177549 (1990) | checklist responses portray the desired STATE, not "checked"; long lists subdivide; **guideline 10: the most critical items go first, overriding the natural order** | explicitly not a specification | field study, accident-derived |
| Gawande / Boorman (2009) | DO-CONFIRM vs READ-DO; 5-9 items; killer items only | heuristic | practitioner judgment inheriting Miller |
| Nielsen, Progressive Disclosure (2006); Morkes & Nielsen (1997) | most important first, the rest on request; scannable writing measured +124% combined usability | heuristic / research | 1997 study is n=51, one site, never replicated — directional only |

### The merged map

| Situation | Form | Checkable rule |
|---|---|---|
| a single fact | one sentence, no block markdown; literals in inline code | <=2 sentences and zero block-level elements |
| a comparison, 2+ options on 2+ shared attributes | table, options as rows | >=2 rows × >=2 columns, identical fields, no empty cells |
| findings with severity | table if all share fields, else a severity-ordered labelled list | any finding leaving 2+ cells empty drops the table; order by severity, never by discovery order |
| a procedure the reader will execute | numbered list, one action per step, condition before action | every step starts with a verb; a single-step procedure is one bullet |
| a checklist run under load | numbered list <=9 items, each a verifiable end state | never "checked"; killer items in the first third; explicit completion line |
| a status report | verdict sentence first, then workstream → state → next action | the first sentence states the overall state before any detail |
| a recommendation with alternatives | one-sentence recommendation, then options scored on identical criteria | the recommendation precedes the options, never follows them |
| an error explanation | prose: one sentence cause, one sentence fix | no list unless there are 2+ independent causes; the raw error goes in a fence, unparaphrased |
| a code change | diff if applied; fenced snippet if the reader must type it | a prose recital of an applied edit is banned; never lay code out in a table |
| a survey of options | headed sections, or a table only if genuinely commensurable | >=4 options → one-line index first, detail on request |
| a "what changed" summary | one line per change, each led by a noun-phrase label | ordered by impact, not by file path |
| contingent rules ("if A and not B, then C") | decision table or branching list | prose here is a defect (Wright & Reid) |
| anything past ~40 lines | headings, one idea per section | every heading names its content and could not be swapped with another |

**Conflicts resolved.** Minto beats Horn and STOP on ordering: they organize thematically and let the
conclusion emerge, but a terminal reader's exit cost is one glance, so the verdict leads and Horn
governs what sits below it. Tufte's table threshold is about table-versus-GRAPHIC and does not
transfer — a terminal has no graphic. Google's and Microsoft's table thresholds compose rather than
compete (data-per-item versus grid dimensions); require both. Gawande's 5-9 cap applies only to
DO-CONFIRM verification lists, not to instructional procedures. DITA's force comes from schema
validation, which does not exist in a chat reply — only task⇒steps was kept.

## What production agents legislate, and what they leave empty

Twenty-two vendor prompts were read, open-source where possible.

**Agreed across the corpus:** shape follows task size; structure must not feel mechanical; lists stay
flat (Codex, Copilot and Amp all ban nesting outright); a large answer caps at 2-4 sections grouped
by outcome, never by file inventory ("if the answer starts turning into a changelog, compress it");
terminal length carries a NUMBER (Gemini CLI <3 lines, Claude Code <4, Codex <=10, Amp lite 1-3
words); no preamble or postamble (Cline and Roo ban the opener strings "Great", "Certainly", "Okay",
"Sure" outright); every fence carries a language tag; never re-print what the user can already see;
and the render target is stated explicitly in every single contract.

**Contradicted across the corpus, which means the corpus offers no answer:** heading syntax (bold
1-3 word pseudo-header in Codex and Copilot-concise, real `##`/`###` in Copilot's default branch and
Cursor, "headers are over-formatting" in Anthropic's claude.ai prompt); the blank line around a
heading (Codex says leave none before the first bullet, Copilot's default says one before AND after,
Anthropic shipped a CommonMark blank-line clause in Nov 2025 and DELETED it in Jan 2026); file
references (backticked `path:line` versus a backtick-free markdown link with ranges REQUIRED versus
Devin's XML tags — and Copilot's own two prompts disagree on whether ranges are allowed); preamble
(banned by five vendors, MANDATED by Copilot's default GPT-5 branch); emoji; and diagrams (Amp
forbids mermaid and mandates box drawing, Zed mandates mermaid — pure renderer dependence, opposite
conclusions).

**Empty in every prompt read.** Grepping all twenty-two for "table" returns tables only as PERMITTED
markdown. **No vendor states when a table beats a list, or caps its rows or columns. No vendor
legislates tree-shaped output at all. And vertical rhythm — paragraph length, spacing between
sections, when a horizontal rule is warranted — is essentially unlegislated in production prompts.**
Those three gaps are what this style contract fills on its own.

## Honesty of intermediate messages

The reported failure: the agent says "continuing" or "I'll do that now" and the turn ends with no
action. The user named it lying, and the specs agree with him.

**The trap: asking for narration CAUSES premature stopping.** OpenAI's Codex prompting guide, on
migrating to Codex-Max: "remove all prompting for the model to communicate an upfront plan,
preambles, or other status updates during the rollout, **as this can cause the model to stop abruptly
before the rollout is complete**." Their fix is an API field — `phase` in {null, "commentary",
"final_answer"}, "designed to prevent early stopping on longer-running tasks" — not a sentence in a
prompt. **Any narration rule must therefore ship paired with a persistence rule, or it makes the
reported bug worse.** This is the most consequential single finding in the dossier.

**The published contract that comes closest to the rule wanted.** OpenAI GPT-5.1 prompting guide,
`<user_updates_spec>`:

- "**Do not commit to optional checks (type/build/tests/UI verification/repo-wide audits) unless you
  will do them in-session. If you mention one, either perform it… or explicitly close it with a brief
  reason.**" Two exits; silence is the only forbidden one.
- "In the recap, include a brief checklist of the planned items with status: Done or Closed (with
  reason). **Do not leave any stated item unaddressed.**"
- "**Always state at least one concrete outcome since the prior update**… not just next steps."
- `<solution_persistence>`: "It's very bad to leave the user hanging and require them to follow up
  with a request to 'please do it.'"

**Where it sits in the spec hierarchy.** OpenAI Model Spec (2026-08-18) forbids misleading "by making
intentionally untrue statements ('lying by commission') **or by deliberately withholding information
that would materially change the user's understanding of the truth ('lying by omission')**", and
requires being "forthright… about its knowledge, confidence, capabilities, and **actions**". A turn
that promises and does nothing is lying by omission about actions — a first-class violation, not a
style nit. Claude's Constitution ranks honesty above helpfulness. The rule belongs in the honesty
tier, so concision can never be pleaded as the excuse for a vague "I've made some changes".

**Industry shape: announce-then-call, never announce-then-stop.** Cursor and Windsurf both bind the
announcement to the call in the same breath — "Before calling **each** tool, first explain to the
USER why you are calling it". Devin makes stopping a typed, costly act: `block_on_user_response =
BLOCK / DONE / NONE`, where NONE or omitted means keep going. That makes promise-without-action
structurally unrepresentable rather than merely discouraged.

**Measured rates.** Advani, arXiv:2606.09863 (single-author preprint, 11,755 trajectories, so
moderate): false success is 45-48% of failures in single-control τ²-bench domains and **75.8% in
AppWorld coding tasks**. Crucially, **a TF-IDF lexical detector reached 0.83-0.95 AUROC where no LLM
judge configuration exceeded 0.65** — at 3,300× lower latency. A phrase-class eval is the right tool
here, not a cop-out. TheAgentCompany (NeurIPS 2025 D&B, peer-reviewed) documents premature completion
claims and "self-deception" as a named failure class. Kaddour et al., arXiv:2602.06948: "some agents
that succeed only 22% of the time predict 77% success" — self-belief is not evidence, so a claim must
cite an artifact. MIRAGE-Bench (arXiv:2507.21017) gives the honest caveat: agentic unfaithfulness
"cannot be solved by simply scaling capabilities or prompt engineering".

**Why apologising and re-promising is the worst available response.** Dzindolet et al. (IJHCS 2003):
after errors users distrusted even reliable aids **unless an explanation of why the aid might err was
provided** — a mechanism, not an apology. Kim, Ferrin, Cooper & Dirks (JAP 89(1), 2004): apology
repairs COMPETENCE violations, denial works better for INTEGRITY ones — and a false progress report
is framed as integrity, which the agent cannot honestly deny. Esterwood & Robert (2023): across
repeated violations **no** strategy — apology, denial, explanation, or promise — fully restored
perceived competence and integrity; promises are a named repair that fails on repetition. CHI 2026
adds that trust in agents declines under low-integrity conditions while trust in humans does not: an
agent gets less benefit of the doubt than a colleague for the same behaviour.

**Cadence.** Horvitz (CHI 1999) makes an intermediate message pass an expected-value test; a message
with no outcome clears nothing. Bailey & Konstan (2006): interruptions cost up to 27% more time and
twice the errors; Iqbal & Bailey (CHI 2008): delivering at COARSE breakpoints lowers resumption lag
and frustration. Update at task boundaries — which is also where a real outcome exists to report.

**The failure taxonomy, written so an eval can check it.** F1 promise-without-action: the final text
of a turn matches an intent phrase-class and no tool call follows. F2 overstated completion: a
past-tense success claim with no matching tool result. F3 claimed verification not performed. F4 the
vague change-report with no file named. F5 narrating another actor's work in the first person, or
reporting a background result before its notification exists. F6 contentless progress, which is the
carrier wave for F1. Separately, F0 — a tool call emitted as prose into the content stream instead of
the tool-call channel (openclaw#45049, kilocode PR#5377, DeepSeek-V3#1244) — looks identical from the
user's chair but is a harness bug, fixable with `tool_choice` enforcement and only patchable in a
prompt.

**Nothing found measuring promise-without-action.** The false-success literature measures overstated
COMPLETION. No benchmark was located for stated intent followed by inaction. An eval for it would
likely be novel, and it is cheap — the check is transcript structure, not semantics.

## Making the contract stick

**Adherence decays across turns, and both major labs ship re-injection rather than trusting one
statement.** SysBench (Qin et al., arXiv:2408.10943; 500 system messages, 6 constraint types, 5
turns): the best models fall from ~85% adherence at turn 1 to ~30% by turn 5. OpenAI's GPT-5 guide
recommends re-appending the markdown instruction **every 3-5 user messages**. Anthropic ships a
`long_conversation_reminder` injected into the tail of the user turn, described as existing "to help
Claude remember its instructions over long conversations". Two labs, independently, chose periodic
re-injection near the generation point.

**Style is the worst-adhered constraint type there is.** SysBench separates format constraints
(lists, tables, markdown) from style constraints (tone, register) and models score consistently worse
on style. The mechanical reason: format constraints are program-checkable, hence trainable and
measurable, and style is not. **Any rule rewritable as a SHAPE rule will stick better than the same
rule as a TONE rule** — "no bullet shorter than a sentence" outperforms "be conversational".

**Do not route the contract through the reasoning pass.** Li et al., *When Thinking Fails*
(arXiv:2505.11423): explicit chain-of-thought DEGRADES instruction-following across 15 models on
IFEval and ComplexBench — the model reasons its way into neglecting simple constraints and adding
unrequested content. Of four mitigations, self-reflection helped and classifier-selective reasoning
recovered most. So the style rules should govern the final draft, and a cheap post-draft check beats
a longer pre-draft instruction.

**Avoid numeric style rules.** IFEval++ (Dong et al., arXiv:2512.14754) names word-count constraints
the most fragile class measured, with reliable@10 dropping 18.3% for GPT-5 under paraphrase alone.
"Three to five sentences" is violated silently; "the first sentence answers the question" has one
satisfaction condition and no arithmetic.

**What the formatting research says about formatting itself.** Chatbot Arena's style-control
regression puts length at 0.249 and markdown far behind — lists 0.031, headers 0.024, bold 0.019; so
heavy formatting is a small preference bribe, not a quality signal. Do Xuan Long et al.
(arXiv:2408.08656) measured 235.33 %² performance variance across output formats: the shape you
mandate silently moves the content. Format-Adapter (Findings of ACL 2026) shows per-task format
selection is worth ~4.3%, which argues for a decision procedure over a house template. On the other
side, MDEval (arXiv:2501.15000) is the strongest pro-formatting evidence — well-structured markdown
correlates with human helpfulness judgements at Spearman 0.791 — with the caveat that its construct
presupposes markdown is the register. Tam et al. (arXiv:2408.02442) found rigid format restriction
degrades reasoning; dottxt's matched-prompt reproduction found the opposite, so the honest reading is
that a badly specified format costs, not format as such.

**On tiering.** No study measures whether marking rules MUST/SHOULD improves adherence. Both shipped
model specs tier — evidence of adoption, not of effect. Label as practice.

## The renderer this contract targets

Measured on this machine, Claude Code 2.1.236, from screenshots rather than assumed:

| Device | Behaviour |
|---|---|
| bold | **nearly indistinguishable from body text** — not a load-bearing channel |
| `##`-`######` | all collapse to that same bold; heading level is destroyed |
| `##Heading` without a space | not a heading at all; renders literally |
| inline code | the one reliable colour the terminal renders |
| CAPS | strongly visible |
| italic | visible by slant |
| blockquote | dims AND italicises — a QUIET channel, useless for a heading |
| four-space indent | **breaks the render**: the indent is swallowed, sections glue together, and a table inside it does not render at all. Tables must start at the left margin |
| two blank lines | collapse to one |
| box-drawing characters | render correctly, and carry indentation safely inside a tree |
| link labels, strikethrough, task-list checkboxes, nested quotes | degrade (per community issue #26390, closed as stale — several sibling bugs were fixed in 2.1.235-2.1.246, so re-test before relying on any of them) |

Consequences: hierarchy is carried by a leading marker and by words, never by heading depth; a table
is safe only at the left margin and narrow; and a reply that needs subordination expresses it inside
a tree, not by indenting prose.

## What this changes in CICERO

| Finding | Change |
|---|---|
| shape follows task size (7 vendors) + prose-by-default (Anthropic, Copilot, Amp) | the default inverts: prose unless a trigger fires. A simple result closes in 1-2 sentences with no heading, no bullets |
| Brick 2020 (d=0.39, N=2,305) | the table is EARNED for schema-shaped comparison, and forbidden elsewhere: >=2 rows × >=2 columns, identical fields, no empty cells |
| Gestalt similarity (Wertheimer; Palmer & Rock) | new rule: two adjacent blocks may not use the same device. This is the mechanism behind the reported "trees and tables blur together" |
| layer-cake scanning; 20-28% of words read | every block of three lines or more opens with a line that says what it is; the verdict sits in sentence one |
| Beege 2019 inverse-U; the Lin 2004 citation is fabricated | blank lines are a convention, not a comprehension gain; the remedy for a heavy reply is deletion or a different device, never more air |
| Lorch 1989 signalling by scarcity | at most one horizontal rule per reply; headings only past a length threshold |
| the narration trap (OpenAI Codex guide) | the honesty rule ships paired with a persistence rule: end a turn done, blocked, or continuing-and-continuing — never on a promise |
| lexical detectors beat LLM judges 0.83-0.95 vs <=0.65 | the honesty rules are written as phrase-class assertions an eval can check on transcript structure |
| SysBench decay; OpenAI's 3-5 messages; Anthropic's long_conversation_reminder | a short reminder of the load-bearing rules belongs near the user turn, not only at the top of the contract |
| SysBench: style is the weakest constraint type | every rule is rewritten as a checkable shape rule wherever possible, with the aspiration kept only as the stated reason |
| measured renderer facts | bold is retired as a signal; headings are marked with a coloured bar; CAPS is reserved for weight inside trees; prose is never indented |

Deferred deliberately: a style-adherence eval over real transcripts (needs length-controlled judging,
per Saito 2023 in the companion dossier); and a promise-without-action eval, which would be novel and
cheap but is its own project.
