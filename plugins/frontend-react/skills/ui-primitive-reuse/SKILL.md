---
description: Before creating ANY shared/reusable UI primitive in a React codebase (button, input, checkbox, radio, switch, select, textarea, dialog, tooltip, dropdown, badge, card, separator…), search the project's primitive library first to avoid duplicates — reuse or extend what exists; build new only when truly absent. Framework-agnostic (no specific UI or styling library assumed). Activate whenever about to add or hand-roll a reusable field/control/primitive.
---

# Reuse before building UI primitives — no duplicates

> **Scope.** React, framework-agnostic — assumes nothing about which headless/UI
> library or styling system the project uses. Apply the discipline here; take the
> concrete library and styling bindings from the project's *local* skills.

## When to Activate

Before creating or hand-rolling any **shared/reusable** control:

- A field/control: button, input, textarea, checkbox, radio, switch, select,
  combobox, slider, date picker, etc.
- A shared overlay/structural primitive: dialog, sheet, popover, tooltip, dropdown,
  menu, badge, card, separator, tabs, etc.
- You're about to write raw `<input>`/`<select>`/`<button>` that other screens will
  also need.

One-off, page-specific control → lighter (step 4), but still check the library first.

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

## Checklist
- [ ] Searched the primitives library/barrel for an existing one
- [ ] Reused or extended it if present (no duplicate created)
- [ ] If new: decided reusable vs page-local placement
- [ ] Matched the project's existing UI-library + styling conventions
- [ ] Preferred wrapping an accessible headless primitive over hand-rolled DOM
- [ ] Added a story if the project has a catalog
