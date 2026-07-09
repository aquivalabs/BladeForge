---
description: Rules for FEATURE components in a React codebase — domain-coupled blocks that compose primitives and hold business logic/data. Activate when building or editing a domain feature (a panel/table/editor tied to your business data), or adding a new domain area. Framework-agnostic. Reached via frontend-react:component-placement.
---

# Feature Components — domain blocks built from primitives

A **feature** knows about your business domain — it renders/edits real domain
objects, holds business logic, and orchestrates data. It is assembled FROM
primitives, never instead of them.

> **Scope.** React, framework-agnostic — no assumption about your data layer,
> styling, or i18n library. Take those bindings from the project's *local* skills.

## When to Activate

Building or editing a domain-coupled block, or adding a new domain area. If the
thing is generic and domain-agnostic, stop — it's a primitive
(`frontend-react:ui-primitive-reuse`).

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

## Checklist
- [ ] Confirmed it's domain-coupled (not a generic primitive)
- [ ] Placed under the features area (reused an existing domain if it fit)
- [ ] UI composed from existing primitives — no re-implemented controls
- [ ] Data access via the project's data layer
- [ ] Logic in the feature, not pushed into primitives
- [ ] Structure + i18n per project conventions
- [ ] Added a story if the project has a catalog
