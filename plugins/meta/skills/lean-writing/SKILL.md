---
description: Use this skill to WRITE terse technical documents. Trigger when asked to write, draft, summarize, present, or update a spec, design doc, RFC, brainstorming/exploration summary, or a decision log of options considered — e.g. "write the spec for…", "draft a design doc…", "write up the options we considered…", "present the brainstorming results…", "summarize the exploration we did…" — even if the user never says "concise". Produce short plain sentences, bullets over prose, no filler; caveman-simple but technically precise. NOT for normal conversation, code, or commit/jira messages, and NOT for reviewing or auditing an already-written doc for clarity or bloat (that's meta:wittgenstein).
---

# Lean Writing — specs & brainstorming results

## Contract

**In:** a terse technical document to write or update — a spec, design doc, RFC, brainstorming or
exploration summary, or a decision log of options considered.

**Out:** the document leads with the answer, prefers bullets and tables to prose, uses plain words,
one idea per line, exact names and numbers, and no filler — caveman-simple but technically precise.
The checkable expectations are in `evals/rubric.json`.

---

## Rules

- Lead with the answer or decision. One line. Then support it.
- Bullets and tables over paragraphs. Max ~2 sentences per bullet.
- Plain words. Cut filler ("in order to" → "to"; drop "basically", "essentially", "it's worth noting").
- One idea per line. Never say the same thing twice.
- Terse ≠ vague — keep names, numbers, field names exact.
- Cut: intros that clear the throat, hedging, recaps of what the user just said, victory laps.
- Caveman but smarter: short. direct. correct.

## Before you finish

1. The smell test, sentence by sentence: can this line be deleted without losing a fact or a decision?
   If yes, delete it.
2. The first line is the answer/decision; bullets beat paragraphs; no throat-clearing intro, hedging,
   recap of what the user just said, or victory lap.
3. Names, numbers, and field names are exact — terse never slid into vague.
4. Anything fails? Cut or fix and re-read from 1. Full expectations → `evals/rubric.json`.
