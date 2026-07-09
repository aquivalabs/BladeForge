---
description: SOLID is the design law for all code — SRP/OCP/LSP/ISP/DIP plus DRY, KISS, YAGNI. Activate at DESIGN time and whenever writing, editing, or reviewing code in ANY language or stack — ESPECIALLY when a class, function, hook, route, or method does several things (fetches + formats + writes, or auth + validation + DB in one method) and you're weighing whether to split it; a switch or if-chain keeps growing with new cases; you're deciding how one module should depend on or import another; or designing an interface or extension point. Pairs with meta:ockham (whether an entity should exist at all) — SOLID governs how the entities that DO exist are structured.
---

# SOLID — the design law for all code

## When to Activate

The moment you write, edit, or review any code — **before** you commit to a structure, not after.
This is a process skill: it sets the approach; style/implementation skills carry it out. If you are
shaping functions, classes, modules, components, or their dependencies, SOLID speaks first.

Pairs with `meta:ockham` (the Razor): **Ockham decides WHETHER an entity should exist** (don't
multiply entities — YAGNI/KISS); **SOLID decides HOW the entities that do exist are structured.**
Consult Ockham before creating; apply SOLID once it lives.

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

## Checklist

- [ ] Each unit has ONE responsibility (SRP)
- [ ] New cases extend (add an entry), not modify a growing conditional (OCP)
- [ ] Subtypes honor their base contract (LSP)
- [ ] Interfaces are small and consumer-focused (ISP)
- [ ] Depend on abstractions; inject concretions (DIP)
- [ ] No duplicated knowledge (DRY); simplest form (KISS); no speculative entities (YAGNI + `meta:ockham`)
