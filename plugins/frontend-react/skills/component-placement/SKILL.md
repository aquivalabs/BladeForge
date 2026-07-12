---
description: Entry point BEFORE creating ANY React component, in any React codebase — search for an existing one first, decide placement (primitive / feature / layout / page-local), then route to the matching per-type skill. Framework-agnostic: governs component ARCHITECTURE, not any specific UI or styling library. Activate whenever about to add, scaffold, or hand-roll a component, panel, card, widget, or control.
---

# Component Placement — search first, then decide where

The component you're about to create may already exist, and where it lives is a
decision, not a default. This is the **single entry point** before any new
component: search → place → route. It doesn't hold the detailed rules itself — it
sends you to the right per-type skill.

> **Scope.** React (component / JSX model) for now. This skill is deliberately
> **framework-agnostic**: it does NOT assume a particular UI-primitive library
> (Base UI / Radix / MUI / Headless UI…), styling system (CSS Modules / SCSS /
> Tailwind / CSS-in-JS), data layer, or i18n setup. Those bindings belong in a
> project's own *local* skills, which extend this one. Adapt the example paths to
> the repo's actual structure.

## When to Activate

Before creating ANY React component — "add a button/card/panel/section", "build an
X", or you're about to scaffold a `.tsx`/`.jsx` for a component.

## Step 0 — OCKHAM
Invoke `meta:ockham`. The cheapest component is the one that already exists.

## Step 1 — SEARCH before you build (do NOT skip)
1. Grep the component tree for something similar by role/name — the project's
   `components/` areas (primitives, features, layout) and page-local folders.
2. If the project has a component catalog (Storybook or similar), search it — it's
   the live index of what's already built.
3. **If something fits → reuse or extend it and STOP**, and say what you found.
   Only continue if nothing suitable exists — then say so explicitly.

## Step 2 — Decide placement (decision tree)
| The component is… | → conceptually a | → follow skill |
|---|---|---|
| Generic, reusable, **no** domain knowledge / business logic (button, input, badge, dialog…) | **primitive** | `frontend-react:ui-primitive-reuse` |
| **Domain-coupled** (knows your business objects/flows), composes primitives, holds data/logic | **feature** | `frontend-react:feature-components` |
| App chrome — shell, navigation, top bar, sidebar, global overlays | **layout** | `frontend-react:layout-components` |
| Used by **one** page only, not reused | **page-local** | `frontend-react:component-structure` |

Unsure primitive vs feature? Does it import anything domain-specific (a business
model, a data hook, another feature)? Yes → feature. No → primitive.

## Step 3 — Structure
Once placed, `frontend-react:component-structure` governs the folder shape. Match
the project's existing styling and i18n approach — don't introduce a new one.

## Step 4 — Catalog it (if the project has one)
If the repo uses Storybook (or any component catalog), add the matching story so the
next person finds it in Step 1 instead of rebuilding it.

## Checklist
- [ ] Invoked `meta:ockham`
- [ ] Searched the component tree (+ catalog/Storybook if present) for an equivalent
- [ ] Reused/extended if found; else stated "nothing reusable found"
- [ ] Placed via the decision tree (primitive / feature / layout / page-local)
- [ ] Routed to the matching per-type skill
- [ ] Followed the project's structure + styling conventions
- [ ] Added a story if the project has a catalog
