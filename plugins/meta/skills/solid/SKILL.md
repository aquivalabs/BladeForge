---
description: SOLID is the design law for all code — SRP/OCP/LSP/ISP/DIP plus DRY, KISS, YAGNI. Activate at DESIGN time and whenever writing, editing, or reviewing code in ANY language or stack — ESPECIALLY when a class, function, hook, route, or method does several things (fetches + formats + writes, or auth + validation + DB in one method) and you're weighing whether to split it; a switch or if-chain keeps growing with new cases; you're deciding how one module should depend on or import another; or designing an interface or extension point. Pairs with meta:ockham (whether an entity should exist at all) — SOLID governs how the entities that DO exist are structured.
---

# SOLID — the design law for all code

## Contract

**In:** code being designed, written, edited, or reviewed — a class, function, hook, route, module, or
the way one depends on another — in any language or stack.

**Out:** each unit holds one responsibility, a new case extends rather than grows a conditional,
subtypes honour their base, interfaces stay small, dependencies point at abstractions, and there is no
duplicated knowledge, no over-built form, no speculative entity. The checkable expectations are in
`evals/rubric.json`.

Pairs with `meta:ockham`: **Ockham decides WHETHER an entity should exist**; SOLID decides HOW the
entities that do exist are structured. Consult Ockham before creating; apply SOLID once it lives.

---

## The five principles (apply, don't recite)

- **S — Single Responsibility.** One unit = one reason to change. A function/class/module that does
  two unrelated things gets split. The god-function that "does everything" is the smell.
- **O — Open/Closed.** Open to extension, closed to modification. Add a case by adding an entry (a
  strategy, a lookup entry, a new implementation) — not by editing an ever-growing `if`/`switch`.
- **L — Liskov Substitution.** A subtype must work anywhere its base does, without surprises. No
  overrides that throw, weaken a guarantee, or change the contract.
- **I — Interface Segregation.** Many small, focused interfaces beat one fat one. A consumer must not
  depend on methods it never calls.
- **D — Dependency Inversion.** Depend on abstractions, not concretions. High-level policy should not
  import low-level detail directly; inject it behind an interface.

## The supporting trio

- **DRY** — one piece of knowledge, one place. Near-identical blocks → hoist one shared unit.
- **KISS** — the simplest thing that works; no cleverness a stranger can't read at a glance.
- **YAGNI** — build for today's real cases; no speculative params/layers/wrappers for imagined futures.

---

## Balance — SOLID is the head, not a cult

SOLID serves readability and safe change; it is **not** a license to explode entity count. When
"split it" (SOLID) and "don't multiply entities" (Ockham) pull apart, resolve with a **concrete
trigger**: split only on REAL divergence — two genuine reasons to change, duplication in 3+ places, or
a unit too big to hold in your head at once. Never split for one hypothetical. One well-named unit
beats five premature ones. On a case that isn't real yet, **simplicity and "not yet" (KISS/YAGNI/
Ockham) win over structure you don't need today.**

---

## Rationalizations SOLID rejects

The corner-cuts under deadline — both directions (skipping structure AND over-splitting):

| Thought | Reality |
|---|---|
| "Deadline — I'll just add one more branch to this if/switch" | That's the OCP smell. Add the case as an entry (strategy/lookup), not by editing the ladder. |
| "This function does a few things but it's fine" | Two reasons to change = split (SRP). "Fine" now is the god-function later. |
| "I'll split this out to be SOLID-correct" (one hypothetical) | Splitting for an imagined case violates YAGNI. Split only on REAL divergence / 3+ duplication / too-big-to-hold. |
| "Faster to copy the block than refactor" | DRY: one piece of knowledge, one place. Hoist the shared unit. |
| "A clever abstraction handles all future cases" | KISS. The simplest thing a stranger reads at a glance wins. |

---

## Before you finish

1. Each unit has ONE responsibility (SRP) — no method doing fetch + format + write, or auth +
   validation + DB, at once.
2. A new case EXTENDS (add an entry), it does not modify a growing conditional (OCP); subtypes honour
   their base contract (LSP); interfaces are small and consumer-focused (ISP).
3. Code depends on abstractions and injects concretions (DIP), not on a concrete implementation
   directly.
4. No duplicated knowledge (DRY), the simplest form that works (KISS), no speculative entities
   (YAGNI + `meta:ockham`).
5. A principle broken? Restructure and re-check from 1. Full expectations → `evals/rubric.json`.
