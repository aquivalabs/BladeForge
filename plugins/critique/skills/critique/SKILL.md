---
description: "Use when someone wants an existing design, spec, or plan ATTACKED for soundness before it is built from — \"tear this apart\", \"assume it is wrong and show me where\", \"find what breaks\", \"critique this hard\", \"red-team it\", \"poke holes in it\" — whether they want one hard pass or several independent critics each from a different angle. It sets HOW the attack runs so it catches real defects instead of agreeing with the author. It attacks an idea on paper that already exists — NOT writing or drawing one, NOT polishing a document\'s wording (`meta:wittgenstein`), NOT already-written code. A pipeline with a critique phase — speccy, a Sprut critic role — invokes this method."
---

# Adversarial Critique — the method

## Contract

**In:** an artifact to critique — a design, spec, plan, or document — that can be split into
layers or sections · the ability to spawn independent critic agents (not the author) · one rubric
per critic. Read the evidence behind each rule in `references/evidence.md` when you need the why.

**Out:** a single synthesized findings list — deduped, each finding grounded in an exact location
with its failure mode, and weighted up where independent lenses converged — handed to a human to
dispose. The critique FINDS; the human DECIDES what to fix.

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
6. The output ends at findings for a human to dispose; nothing was auto-fixed.
7. Any line failing? Fix it and start again from 1.
