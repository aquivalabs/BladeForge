---
description: "Use when someone wants an existing design, spec, or plan ATTACKED for soundness before it is built from — \"tear this apart\", \"assume it is wrong and show me where\", \"find what breaks\", \"critique this hard\", \"red-team it\", \"poke holes in it\" — whether they want one hard pass or several independent critics each from a different angle. It sets HOW the attack runs so it catches real defects instead of agreeing with the author. It attacks an idea on paper that already exists — NOT writing or drawing one, NOT polishing a document\'s wording (`meta:wittgenstein`), NOT already-written code. A pipeline with a critique phase — speccy, a Sprut critic role — invokes this method."
---

# Adversarial Critique — the method

## Contract

**In:** an artifact to critique — a design, spec, plan, or document — that can be split into
layers or sections · the ability to spawn independent critic agents (not the author) · one rubric
per critic. Read the evidence behind each rule in `references/evidence.md` when you need the why.

**Out:** a single synthesized findings object as JSON — deduped, each finding grounded in an exact
location with its failure mode and severity, weighted up where independent lenses converged (the shape
is in *The answer — a JSON of findings*). Prose in the session's voice is rendered from it for the
reader; the JSON is the source of truth. The critique FINDS; the human DECIDES what to fix.

**Not in scope:** fixing the artifact (the human disposes), judging one document's clarity
(`meta:wittgenstein`), and reviewing a code diff (`review`). This skill is the method; a pipeline
that has a critique phase calls it.

---

## Why the default fails

The reflex — one generalist critic told to "find any problems", or the author grading its own work
and being trusted — is the failure this skill exists to prevent. Self-critique corrects 0–23 % of
errors because the bottleneck is *detecting* the error, and a model endorses its own reasoning; an
independent critic catches roughly 70 %. So the shape is not optional decoration. It is the
difference between a critique that works and one that launders a green stamp.

---

## The method

Ten rules. The first six shape the run; the last four keep the findings honest.

1. **Independent, never self.** Each critic is a SEPARATE agent from the author, on the artifact.
   The orchestrator re-runs the checks itself — it never trusts the author's or a builder's own
   "green".

2. **Diverse lenses — the single biggest factor.** Run 3–4 critics, each a DISTINCT angle
   (coherence · Ockham/minimalism · completeness/under-spec · breaks-under-real-cases). Vary the
   framing, and where you can the seed, tier, or model family. Identical critics just agree; the
   diversity is what removes the shared blind spot.

3. **Per-layer, not whole-artifact.** Scope each critic to ONE component, in its own lane — "only
   layer X, do not stray". Step-level attention beats one outcome-level verdict by a wide margin and
   keeps findings undiluted.

4. **Adversarial framing, default to fault.** Prime each critic to REFUTE — assume a defect until
   shown otherwise, and do not praise. Keep the framing neutral, professional, impersonal: leading
   or personal wording breeds sycophancy; an explicit red-team instruction counters it.

5. **A rubric per lens.** Give each critic explicit criteria to judge against, not "find problems"
   in the abstract. Principled critique beats vibes.

6. **Parallel-then-synthesize, never debate-to-consensus.** Run the critics independently and have
   ONE synthesizer merge them. Letting critics debate collapses into stance homogenization and
   factual attrition — the deliberative illusion. Keeping them apart preserves the diversity the
   whole method rests on.

7. **Ground every finding in a location.** Each finding cites the exact field, section, or line and
   states the failure mode — why it bites. An ungrounded finding is noise; a grounded one is
   checkable.

8. **Dedup by location, weight convergence.** When several lenses land on the same spot, that is a
   high-confidence signal — weight it up, do not collapse it to a single line.

9. **Human disposes.** The synthesis goes to a human, who decides what to fix. Critic finds, human
   decides — the skill never auto-applies a fix.

10. **Rounds: critique → revise → re-critique.** Fix between rounds; the next round attacks the
    FIXED artifact, so it finds the defects the fixes introduced rather than the ones already closed.

---

## Stopping — imposed, never awaited

A critique over a design has no oracle — no tests, no execution — so a critic asked to "find problems"
NEVER runs dry: it will invent plausible ones on correct text, and an iterating loop can lock onto a
false fixed point, confidently wrong and stable. Convergence is imposed, not awaited. Severity drives
it: **S1** structural (the idea is wrong or breaks), **S2** significant, **S3** cosmetic.

- **A fixed cap, not "until clean".** At most 3 rounds per layer, then stop whatever remains. Make the
  exit checkable — some methods go as far as "find exactly N flaws, then revise".
- **Stop by severity, not silence.** Convergence is a round that surfaces no new S1. A round returning
  only S2/S3 is DONE — park the cosmetics. Waiting for the critic to fall quiet chases a false fixed
  point; it never falls quiet on its own.
- **Freeze the target within a round.** Do not edit mid-round: synthesize, batch the round's fixes,
  then run the next round against the frozen new text. Each fix opens new surface — bounded only by
  the cap.
- **The human is the oracle-substitute.** With no machine ground truth, a human calls "real hole vs
  nitpick" and calls done. Not optional — it is what replaces the missing oracle.
- **Building is the real oracle.** After 2–3 rounds the return drops; if round 3 still finds S1, that
  says PROTOTYPE, not run round 4. A spike is the test a design lacks.
- **Right-size effort.** Three rounds on a high-risk layer where a structural error is expensive, one
  on a low-risk one. Not every layer earns three.
- **Entanglement is a stop signal.** When a round's new findings belong to an ADJACENT layer, this one
  cannot fully close in isolation: fix the self-contained items, PARK the entangled ones to their own
  layer (they re-test there as natives), and move on. Past that, isolation-critique is diminishing
  returns dressed as diligence.
- **Log the precondition, not just the decision.** A decision entry that stores the choice and the why
  but omits the assumption it rests on ("sound only if the guarantees are complete") lets the next
  round re-discover that limit and re-litigate a settled call. Write the precondition into the entry —
  an unstated assumption is re-found every round, wasting a whole pass.

---

## Biases to name, not pretend away

- **Self-preference.** A critic of its own model family inflates its judgment. The real fix is a
  cross-family critic. When only one family is available, compensate with adversarial framing +
  diverse lenses + independent-not-self, and STATE the caveat — do not claim it is gone.
- **Verbosity / position / format.** These bite pairwise A/B judging more than design critique. Keep
  every rubric length-neutral, and randomize order in any comparison.

---

## Anti-patterns

- One generalist critic instead of diverse lenses.
- The author — or its model family, un-caveated — grading itself and being trusted.
- Critics debating their way into agreement.
- "Find any problems" with no rubric and no lane.
- Trusting a critic's or builder's self-reported "pass" without an independent re-run.

---

## How the findings read — the voice

Two rules for how a finding reaches the reader, on top of everything above.

**Inherit the voice from above; impose none.** The critic speaks in the SAME language and register as
the behavioural model governing the session — its output style, its language. If the session runs in
Russian under the house voice, the findings come back in Russian at that register. The critic never
sets a tone of its own on top of the one already in force.

**Unpack every substantial finding through a grounded, deliberately absurd example.** An abstract "this
couples X to Y" slides off the reader; a concrete, hyperbolic, slightly cringe example makes the same
fault obvious and sticky. This is a deliberate exception to the house voice's "no decorative
metaphors", authorised for critique output — so the analogy must EXPLAIN the technical cause, never be
a random joke. Four parts:

1. **What is wrong** — short, technically exact.
2. **Why it is a problem** — the ordinary engineering reason.
3. **Example** — a concrete illustration, pushed to the point of comedy, keeping the SAME
   cause-and-effect. Deliberately absurd, but it must EXPLAIN the fault, not decorate it.
4. **How it should be** — the corrected shape.

Worked example — the finding *"the orchestrator knows too much about how its workers do the job"*:

> **Wrong:** the orchestrator hard-codes each worker's internal steps.
> **Why it is a problem:** change one worker's insides and you must change the orchestrator too — so
> they were never really independent.
> **Example:** a restaurant director who will not just say "make the pasta" but stands over the cook
> screaming "GRAB THE 28cm PAN. NO, NOT THAT ONE. THREE DROPS OF OIL. TURN NOODLE #17 TWELVE
> DEGREES." Hire a new cook and the director has to rewrite his own job description.
> **Better:** the orchestrator states the contract and the expected result; the worker decides how to
> reach it.

The harder or more abstract the point, the more the example carries it. Scale it to weight: an S1
finding earns the full four-part unpack; a trivial S3 nitpick does not need a comedy sketch.

---

---

## The answer — a JSON of findings

Each critic returns its findings as JSON; the synthesizer merges them into ONE object. A structured
answer is what lets a check read a run instead of a human eyeballing prose. The JSON is the source of
truth; the prose a developer reads is rendered from it, in the session's voice.

**One critic returns `{ lens, findings: [...] }`.** A single finding:

```json
{
  "location": "§3, orchestrator ↔ worker",
  "severity": "S1",
  "what": "the orchestrator spells out each worker's internal steps",
  "why": "change a worker and you have to change the orchestrator too",
  "rationale": "flagged §3 because it lists the worker's own steps — that is the worker's job, not the orchestrator's",
  "evidence": "hide the part that can change inside the module, don't expose it (Information Hiding, Parnas 1972)",
  "example": "a director screaming 'TURN NOODLE #17 TWELVE DEGREES' at the cook; a new cook means a new rulebook",
  "fix": "the orchestrator says what result it wants; the worker decides how",
  "fix_rationale": "removes the cause; a flag in the orchestrator just keeps the tie and breeds more flags",
  "confidence": "high",
  "falsifier": "wrong if the workers never change independently"
}
```

The evidence base is the point — but write every field as **one short sentence in plain words**, so a
developer reading hundreds of these grasps each in a single pass. No stacked clauses, no jargon walls.

- **Required on every finding:** `location`, `severity`, `what`, `why`, `rationale`, `evidence`,
  `fix`, `fix_rationale`.
- `severity` is `S1` | `S2` | `S3`. `example` (the deliberately absurd scene that teaches the cause) is
  required for `S1`/`S2`, and may be dropped for a trivial `S3`.
- **`evidence` — what you lean on, not a vibe.** A plain sentence stating the rule the finding rests
  on. If a named law, pattern, or documented case backs it, name it in parentheses so it can be looked
  up — `(SRP)`, `(Information Hiding, Parnas 1972)`, `(the 2021 retry-storm post-mortem)`. If nothing
  external backs it, DON'T invent a source: just state the reasoning plainly. A fabricated citation is
  worse than an honest "this is judgement".
- `confidence` (`high`/`medium`/`low`) and `falsifier` (what evidence would overturn the finding) are
  optional — add them when the call is not obvious. They keep the critic honest, not dogmatic.
- **No `convergence` here** — a lone critic cannot know how many others agree; the synthesizer adds it.

**The synthesizer merges all the critics into the whole output:**

```json
{
  "lenses": ["coherence", "ockham", "completeness", "breaks-real"],
  "rounds": 2,
  "stopped_because": "no new S1",
  "self_preference_caveat": null,
  "findings": []
}
```

- `findings` holds the merged, deduped findings, each in the shape above PLUS a `convergence` field —
  how many independent lenses landed on that location (rule 8). `convergence` is the real approval: one
  lens is an argument, three lenses agreeing is corroboration.
- `stopped_because` is `"no new S1"` | `"cap reached"` | `"entangled — parked to <layer>"` — never
  "the critic went quiet".
- `self_preference_caveat` is a string when every critic shares the artifact's model family, else
  `null`.

**How a developer reads it — one line per finding, worst-first.** The default view is a flat list,
sorted by `severity` then `convergence`; each finding is ONE line — `severity · location · what → fix ·
×convergence`. The full card (why, rationale, evidence, example, fix_rationale) opens on demand or for
the top S1s only. A hundred findings is a hundred scannable lines, not a hundred essays. If a single
round throws many S1, the headline says so — "the design is unsound, prototype before continuing" —
instead of enumerating every one.

## Before you finish

1. Count the critics that actually ran: `>= 3`, and name the DISTINCT lens each carried. Two lenses
   that are the same angle count as one — fix it and recount.
2. Every critic was a separate agent from the author, and no critic debated another. Not true? The
   run is invalid; re-run parallel-then-synthesize.
3. Open every finding: each cites an exact location AND a failure mode. Strip or fix any that does
   not — an ungrounded finding is noise.
4. Findings on the same location are merged into one weighted entry, not scattered.
5. If every critic shares the artifact's model family, the self-preference caveat is stated in the
   output — not omitted.
6. A per-layer round cap (<= 3) was set and the run stopped on it or on a round with no new S1 —
   never on the critic falling silent — and the target was frozen within each round.
7. Every finding is written in the session's governing language and register, not a tone this skill
   imposed; each S1/S2 finding carries the four-part unpack whose example explains the technical
   cause rather than decorating it.
8. The answer is valid JSON in the shape above: every finding carries `location`, `severity`, `what`,
   `why`, `rationale`, `evidence`, `fix`, `fix_rationale`; every S1/S2 has an `example`; the
   synthesizer added `convergence`; the top level names `lenses`, `rounds` and `stopped_because`.
9. Every field is one short sentence in plain words — a developer grasps the finding in one pass.
   `evidence` names its law/pattern/case in parentheses when one backs it, and states plain reasoning
   when none does — never a fabricated source.
10. The output ends at findings for a human to dispose; nothing was auto-fixed.
11. Any line failing? Fix it and start again from 1.
