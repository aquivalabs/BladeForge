---
description: "Use when adding or reviewing motion in a Vue app — a sheet or dialog that fades in, a list whose rows enter and leave, a highlight that pulses on new items, a route transition, a drawer that slides, a counter that animates, a skeleton shimmer — or when choosing between CSS transitions, Vue Transition and TransitionGroup, the View Transitions API, and a motion library. Also when motion must respect prefers-reduced-motion. NOT for the dot-animal or canvas drawing of a specific app, and NOT for React (Motion for React is its own choice)."
---

# Motion

## Contract

**In:** a Vue 3 component or route whose change of state should be visible as movement.

**Out:** the motion uses the cheapest tool that does the job, in this order: CSS transitions on a
class, Vue `Transition`/`TransitionGroup`, the View Transitions API, a motion library; every
animation has a reduced-motion fallback and animates only `transform` and `opacity` unless there is
a reason. The checkable expectations are in `evals/rubric.json`.

---

## Pick the tool

| Change | Tool |
|---|---|
| a state toggled by a class (hover, selected, unread) | a CSS `transition` on the modifier class; no JavaScript |
| an element entering or leaving (`v-if`, `v-show`) | `<Transition name="…">` with `.…-enter-active`/`.…-leave-active` rules |
| rows added, removed or reordered in a list | `<TransitionGroup tag="ul">` with `move` class; keys are stable ids |
| a route change | `<Transition>` around `<RouterView>`, or Nuxt `pageTransition` |
| a layout change across the page (a panel folding, a card expanding into a sheet) | the View Transitions API through `document.startViewTransition` where supported, with the plain change as the fallback |
| spring physics, gestures, shared-element choreography | Motion for Vue (`motion-v`) or a similar library, chosen through `meta:reuse-first` |

## Rules

- **Animate `transform` and `opacity`.** Height, width, top and left cause layout; use
  `grid-template-rows: 0fr → 1fr` for a fold, `transform: translateY` for a slide.
- **Durations from tokens:** `--motion-fast: 120ms`, `--motion-base: 200ms`, `--motion-slow: 320ms`,
  easing `--motion-ease: cubic-bezier(.2, 0, 0, 1)`; nothing over 400 ms for a UI state.
- **Reduced motion is not optional:**
  ```css
  @media (prefers-reduced-motion: reduce) { .sheet-enter-active, .sheet-leave-active { transition: none; } }
  ```
  or `usePreferredReducedMotion` from VueUse when JavaScript decides.
- **`Transition` classes belong to the component's block** (`frontend-vue:bem-styles`):
  `<Transition name="sheet">` and `.sheet-enter-from` in the same scoped block.
- **Lists need stable keys**; a `TransitionGroup` keyed by index animates the wrong rows.
- **No animation on first paint** of a page unless it is the point: `appear` only on purpose.
- **Measure once:** a motion that drops frames on a mid-range laptop is cut, not tuned.

---

## Before you finish

1. `grep -n "transition:" <file>` → every property listed is `transform`, `opacity`, or a
   `grid-template-rows` fold.
2. A `prefers-reduced-motion` rule or `usePreferredReducedMotion` covers each animation.
3. Every `TransitionGroup` child has a `:key` that is an id, not an index.
