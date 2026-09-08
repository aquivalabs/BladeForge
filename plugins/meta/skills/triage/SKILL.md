---
description: "Use when you're about to attack a LARGE batch of items the same expensive way \u2014 a repo-wide sweep for dead code, unused exports, or bugs; a big multi-file diff to review; dozens of call sites to migrate; a fleet of skills, files, or docs to audit or read; every TODO to classify; hundreds of failing tests to work through. Any \"do X across the whole repo / all of them / everything\" request where the set is too big to give each item full attention. Instead of paying deep cost on every item, first run one CHEAP shallow pass over ALL of them to sort into skip vs. worth-it, then spend the expensive deep pass only on the shortlist. Invoke at planning time, before touching the first item. NOT for a single file or function (just do it), NOT for picking a model tier (meta:model-routing), NOT for a plain parallel spawn with no sorting step."
---

# Triage — shallow first, deep only where it hurts

Napoleonic field surgeons invented it: sort the incoming by severity in minutes, so the
surgeons' hours go only to those who need them. The engineering translation: **never run the
expensive pass over items a cheap pass could have cleared.**

## Contract

**In:** a LARGE batch of items you are about to attack the same expensive way — a repo-wide sweep, a
big multi-file review, dozens of call sites to migrate, a fleet of files/skills/docs to audit, at
planning time before the first item.

**Out:** a cheap shallow pass ran over ALL of them first, sorting skip vs worth-it, and the expensive
deep pass touched only the shortlist — no item paid deep cost that a cheap pass could have cleared,
and whatever was dropped was announced. The checkable expectations are in `evals/rubric.json`.

---

## The pattern

```
ALL items ──cheap full-coverage pass──▶ HEALTHY (done, cost ≈ ε)
                                     ─▶ NEEDS DEPTH (shortlist)
                                     ─▶ UNMEASURABLE (flag, re-examine)
SHORTLIST ──expensive deep pass──────▶ fixed / understood
```

Two invariants make it work:

1. **The cheap pass covers EVERYTHING.** Triage that samples is not triage — untouched items
   are unsorted, not healthy.
2. **The cheap pass only SORTS, never treats.** The moment the shallow pass starts fixing
   things, it inherits the deep pass's cost and you have two expensive passes.

## Calibrating the two passes

| Dial | Shallow pass | Deep pass |
|---|---|---|
| Scope | every item | shortlist only |
| Cost per item | aim for ≤ half the deep cost, ideally ~1/5 | whatever correctness needs |
| Model tier (see meta:model-routing) | sweep/work tier | work/head tier |
| Verdicts | healthy / needs-depth / unmeasurable | fixed / root-caused |
| Error handling | an unmeasurable item is FLAGGED, never silently passed | — |

## Where it applies (non-exhaustive)

- **Skill evals**: cheap scoring triage over the fleet → optimization loop only for failures.
- **Diff review**: a fast "where is it hot" scan → deep reviewers on the hot files only.
- **Migrations**: count/classify all call sites first → transform by group, hardest last.
- **Bug/dead-code sweeps**: broad grep-tier finders → judgment-tier verification of hits only.
- **Document sets**: skim indexes/headings across all docs → full read of the relevant few.
- **Tests**: targeted tests for the touched area → full suite once, at the end.

## Rationalizations — thought → reality

| Thought | Reality |
|---|---|
| "It's faster to just do the deep pass on everything" | On a fleet of N, depth-everywhere costs N × deep. Triage costs N × cheap + k × deep, and k is usually a third of N. |
| "The shallow pass might miss something subtle" | The deep pass still runs — on the shortlist. Subtlety hides in items the cheap pass FLAGS, which is why unmeasurable ≠ healthy. |
| "This item is obviously sick, skip its triage" | Fine — but say so out loud and count it into the shortlist. Skipping triage silently is how coverage claims rot. |
| "The shallow results look uniform, ship it" | Too-even numbers are the signature of a broken instrument, not a healthy fleet. Hand-check one item before trusting the sort. |


---

## Before you finish

1. The cheap pass covered ALL items — full coverage, not a sample — and sorted them into skip
   vs worth-it.
2. The expensive deep pass ran ONLY on the shortlist the cheap pass surfaced, never on every item.
3. The two passes are calibrated apart: the cheap one's per-item cost is genuinely low against the
   deep one.
4. Whatever triage dropped or skipped was announced — a silent cap reads as full coverage.
5. Any line fails? Re-run the cheap full-coverage pass first. Full expectations → `evals/rubric.json`.
