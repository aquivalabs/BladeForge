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

## Contract

**In:** before creating ANY React component — about to add, scaffold, or hand-roll a component, panel,
card, widget, or control.

**Out:** Ockham invoked, the component tree and catalog searched (the tree-grep alone when no live catalog is reachable), an existing component reused/extended
where it fit; otherwise the new one placed via the decision tree (primitive / feature / layout /
page-local), routed to the matching per-type skill, structured per the project's conventions, and
catalogued. The checkable expectations are in `evals/rubric.json`.

---

## Step 0 — OCKHAM
Invoke `meta:ockham`. The cheapest component is the one that already exists.

## Step 1 — SEARCH before you build (do NOT skip)
1. Grep the component tree for something similar by role/name — the project's
   `components/` areas (primitives, features, layout) and page-local folders.
2. If the project has a component catalog (Storybook or similar), search it — it's
   (if no live catalog search is reachable in-session, the tree-grep in step 1 IS the search — do
   not report the catalog leg as unmet)
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

## Before you finish

1. `meta:ockham` was invoked, and the component tree (primitives/features/layout/page-local) plus the
   catalog (Storybook) were searched for an equivalent by role/name — or, if no live catalog
   search is reachable in-session, the tree-grep alone satisfies the search (the catalog leg is not reported unmet).
2. An existing component was reused or extended where one fit and the search STOPPED there; otherwise
   "nothing reusable found" was stated, and the new one placed via the decision tree and routed to the
   matching per-type skill.
3. The project's structure + styling + i18n conventions were followed, and a story was added if the
   repo has a catalog.
4. A line fails? Fix it and re-check. Full expectations → `evals/rubric.json`.
