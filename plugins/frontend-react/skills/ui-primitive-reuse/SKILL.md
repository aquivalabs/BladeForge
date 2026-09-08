---
description: Before creating ANY shared/reusable UI primitive in a React codebase (button, input, checkbox, radio, switch, select, textarea, dialog, tooltip, dropdown, badge, card, separator…), search the project's primitive library first to avoid duplicates — reuse or extend what exists; build new only when truly absent. Framework-agnostic (no specific UI or styling library assumed). Activate whenever about to add or hand-roll a reusable field/control/primitive.
---

# Reuse before building UI primitives — no duplicates

> **Scope.** React, framework-agnostic — assumes nothing about which headless/UI
> library or styling system the project uses. Apply the discipline here; take the
> concrete library and styling bindings from the project's *local* skills.

## Contract

**In:** about to create or hand-roll any shared/reusable UI primitive in a React codebase — a
field/control (button, input, select, combobox…) or a structural/overlay primitive (dialog, tooltip,
dropdown, badge, card…).

**Out:** the primitives library was searched first, an existing primitive reused or extended where one
fit, a genuinely-new one placed by scope and matching the project's UI-library + styling conventions
(wrapping an accessible headless primitive over hand-rolled DOM), and a story added if the repo has a
catalog. The checkable expectations are in `evals/rubric.json`.

---

## Instructions

1. **Search the shared library first.** Find the project's primitives folder /
   barrel and grep it for the control by name. Don't trust memory — the catalog drifts.
2. **Exists → reuse it.** Import it; don't create a second component that does the
   same thing.
3. **Almost fits → extend it**, don't fork — add a `variant`/`size`/prop the way the
   existing primitives expose options, rather than copying into a new file.
4. **Genuinely absent → decide scope + placement:**
   - **Reusable across screens →** add it to the project's primitives folder,
     following the existing wrapper conventions — whatever headless library and
     styling system the repo already uses. Match the stack; don't introduce a new one.
   - **One-off, page-specific →** keep it in that page's folder per
     `frontend-react:component-structure`.
   - Prefer **wrapping an accessible headless primitive** (if the project uses one)
     over hand-rolling DOM — accessibility comes for free.
5. If the project has a docs-retrieval step for its UI library, follow it before
   coding the wrapper.

## Catalog

If the repo has a component catalog (Storybook…), a primitive isn't done until it has
a story, so it surfaces in `component-placement`'s search step.

## Before you finish

1. The project's primitives library/barrel was searched for the control by name (grep, not memory) —
   an existing one reused, or extended via a `variant`/`size`/prop, rather than forked; no duplicate
   created.
2. A genuinely-new primitive was placed by scope (reusable → primitives folder matching the repo's
   UI-library + styling conventions; one-off → the page's folder) and introduced no new stack; an
   accessible headless primitive was wrapped over hand-rolled DOM where the project uses one.
3. A story was added if the repo has a component catalog.
4. A line fails? Fix it and re-check. Full expectations → `evals/rubric.json`.
