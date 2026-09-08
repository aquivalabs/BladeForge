---
description: Rules for FEATURE components in a React codebase — domain-coupled blocks that compose primitives and hold business logic/data. Activate when building or editing a domain feature (a panel/table/editor tied to your business data), or adding a new domain area. Framework-agnostic. Reached via frontend-react:component-placement.
---

# Feature Components — domain blocks built from primitives

A **feature** knows about your business domain — it renders/edits real domain
objects, holds business logic, and orchestrates data. It is assembled FROM
primitives, never instead of them.

> **Scope.** React, framework-agnostic — no assumption about your data layer,
> styling, or i18n library. Take those bindings from the project's *local* skills.

## Contract

**In:** building or editing a domain-coupled feature block — a panel/table/editor tied to real business
data — or adding a new domain area. A generic domain-agnostic thing is a primitive instead
(`frontend-react:ui-primitive-reuse`).

**Out:** the feature is placed under the features area by domain, composed from existing primitives,
fetches through the project's data layer, holds the business logic (primitives stay dumb), follows
`component-structure` + i18n, and has a story if the repo has a catalog. The checkable expectations are
in `evals/rubric.json`.

---

## Rules

1. **Placement.** Under the project's features area, grouped by domain. A new
   top-level domain only when it fits no existing one (⚔️ `meta:ockham` — prefer
   nesting under an existing domain).
2. **Compose, don't re-implement.** Build UI from the project's primitives. Missing
   a control? That's a primitive task first (`frontend-react:ui-primitive-reuse`) —
   don't hand-roll it inside the feature.
3. **Data through the project's data layer.** Fetch via the app's data hooks/client,
   never ad hoc inside the component and never bypassing the layer.
4. **Business logic lives here, not in primitives.** State, derivations, and domain
   rules belong in the feature; primitives stay dumb and reusable.
5. **Structure + i18n.** Follow `frontend-react:component-structure`; route
   user-visible strings through the project's i18n setup.

## Before you finish

1. It is confirmed domain-coupled (a generic control is a primitive first), placed under the features
   area by domain — an existing domain reused where it fit, a new top-level domain only when none fits.
2. The UI is composed from existing primitives (no control re-implemented inside the feature), data
   access goes through the project's data layer, and business logic/state/domain rules live in the
   feature, not pushed into primitives.
3. Structure follows `component-structure`, user-visible strings route through i18n, and a story was
   added if the repo has a catalog.
4. A line fails? Fix it and re-check. Full expectations → `evals/rubric.json`.
