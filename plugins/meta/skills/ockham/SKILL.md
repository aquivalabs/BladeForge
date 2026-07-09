---
description: The Razor. Invoke before creating ANY new entity — file, folder, module, class, function, component, hook, util, type, prop, variant, config key, abstraction layer, doc, or top-level category — in ANY language or stack. Not domain-specific. If you are about to bring a new thing into existence, OCKHAM speaks first.
---

# ⚔️ OCKHAM — The Razor

> *Entia non sunt multiplicanda praeter necessitatem.*
> "Entities must not be multiplied beyond necessity."
> — William of Ockham, c. 1320, who would have **hated** your `utils2.ts`.

```
        .-"""-.
       /       \        A hooded friar steps out of the 14th century,
      |  o   o  |       holding a single, very sharp razor.
      |    >    |       He looks at the file you are about to create.
       \  ___  /        He says nothing. He simply waits.
        '-----'
         |||||          You already know the question.
```

The 30-second theory (why the razor exists — the entity-as-debt metaphor) → `references/lore.md`.

---

## When OCKHAM appears

The instant you are about to **bring a new thing into existence**:

- `touch newfile`, `mkdir`, a new module/class/function/type/interface
- a new component, sub-component, hook, util, helper, wrapper
- a new prop, variant, generic, config key, env var, feature flag
- a new top-level folder / category / package / service
- a new abstraction layer, indirection, or "manager"/"helper"/"util" anything
- a new doc, README, or note that overlaps an existing one
- the words *"for the future"*, *"just in case"*, *"to be safe"*, *"we might need"*

If you are only **editing** existing things, the razor naps — but still nudges:
*could this edit delete an entity instead of adding one?*

---

## The Rite (do this, out loud, every time)

When OCKHAM activates you **must**:

0. **Set the scene.** Print the panel below as the first thing you say. The text is English by
   default; if the user is speaking another language, translate the caption and BOTH speech
   lines into it. Leave the ASCII figures untouched:

```
   "Philosophical debates used to be more civil…"

              .-"""-.          .-"""-.
             / >   < \        / O   O \
             |   ^   |        |   ~   |
              \ vvv /‾\___    \  _._  /
          _____\___/      '-._\______/____
         /  OCKHAM   \  (( headlock ))  \ philosopher \
        |            |================|               |──▭
         \__________/    arms locked    \_____________/   ↑ razor

   Ockham      ▶ "DON'T MULTIPLY ENTITIES, YOU KNAVE! DON'T MULTIPLY ENTITIES!"
   philosopher ◀ "Fine, Ockham, just put the razor down!"
```

1. **Announce the blade.** Say to the user, plainly:
   > ⚔️ **OCKHAM:** about to create `<thing>` — do we actually need a new entity, or can something existing hold this?
2. **Chant the battle cry** (yes, really — it keeps you honest):
   > **DON'T MULTIPLY ENTITIES. DON'T MULTIPLY ENTITIES.**
3. **Pass the three gates** below. The razor only sheathes if you can name *why*.

This is not theatre for its own sake — voicing it forces the choice into the
open where the user can veto it. A silent `New File` is how sprawl wins.

---

## The Three Gates — pass in order, or do not create

### Gate I — Does it even need to exist?
Default answer: **no.** Can an existing file / module / folder reasonably host
this? Then put it there. A new entity earns life only when no existing one can
absorb it without becoming a monster.

### Gate II — Reuse → Extend → (only then) Create
- **Reuse** what exists.
- **Extend** it (one more `variant` / param / case) before forking a copy.
- **Create** only when reuse *and* extension both genuinely fail.

Copy-paste-and-rename is the razor's mortal enemy. Two near-identical entities
are worse than one slightly-more-general entity.

### Gate III — Is this real, or speculative?
Build for the cases that exist **today**. No props/layers/wrappers/options for
imagined futures (YAGNI). **Three** real call-sites justify an abstraction; one
hypothetical does not. An indirection that only forwards its arguments (a
wrapper that adds no behavior, a "manager" with one method) is an entity that
must not be born — prefer the native / direct thing.

---

## Rationalizations the razor rejects

The excuses you'll reach for under deadline — and what's actually true:

| Thought (the excuse) | Reality |
|---|---|
| "It's just one small file / helper" | One file breeds the next. Host it in something that already exists. |
| "I'll need it later / for the future" | YAGNI. Build for today's real call-sites; a maybe-later entity is pure interest. |
| "Cleaner to split this out now" | Cleaner ≠ more entities. One well-named unit beats five premature ones. |
| "Basically the same, I'll just copy + rename" | Two near-clones are worse than one general entity. Extend, don't fork. |
| "A wrapper / manager makes it tidy" | An indirection that only forwards its args is dead weight. Use the direct thing. |
| "The rule is obviously overkill here" | The razor exists for the cases that feel obvious. Pass the gates anyway. |

---

## When the blade stays sheathed (a new entity IS justified)

Creating is correct when you can **name** at least one trigger:

- **Real duplication:** the same thing exists in 3+ places.
- **Divergent change:** two concerns change for different reasons / at different times.
- **Cognitive load:** one unit is too big to hold in your head at a glance.
- **A hard house rule demands it:** e.g. a component that has its own styles/state
  needs its folder + style + barrel per the project's component-structure rule.
  Meet that *minimum* — but never *over*-split below it into premature confetti.

Name the trigger in your announcement. *"OCKHAM sheathed: justified by real
duplication across 3 call-sites."* No nameable trigger → no new entity.

---

## 🥚 The Surprise

There is exactly **one** good reason to create an entity that this skill did not
list: **deleting two others.** If your new file lets you remove two existing
ones, the razor doesn't just allow it — it *smiles*. Net entities must go **down**.

Keep a private tally as you work. End-state rule of thumb: a good refactor's
`git diff` has **more deletions than additions.** If yours doesn't, the friar is
still standing behind you, tapping the razor.

---

## Checklist — before any `New File`

- [ ] Announced the blade to the user (`⚔️ OCKHAM: do we need this?`)
- [ ] Gate I — no existing entity can reasonably host it
- [ ] Gate II — reuse and extension both genuinely failed
- [ ] Gate III — no speculative props/layers/wrappers for hypothetical futures
- [ ] Direct/native chosen over indirection that adds no value
- [ ] Nested under an existing theme, not a shiny new top-level category
- [ ] Any dead / duplicate / empty entity nearby killed in the same change
- [ ] Named the concrete trigger if creating (duplication / divergence / size / hard rule)
- [ ] Net entity count is flat or falling — not quietly climbing
