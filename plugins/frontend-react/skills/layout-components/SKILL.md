---
description: Rules for LAYOUT / app-chrome components in a React codebase — the shell, top bar, sidebar, command palette, and global overlays that frame every page. Activate when editing or adding app chrome. Framework-agnostic. Reached via frontend-react:component-placement.
---

# Layout Components — the frame around every page

**Layout** components are the app chrome: the persistent shell and navigation that
wrap whatever page is showing. They arrange and route; they don't know the business
domain.

> **Scope.** React, framework-agnostic — no assumption about your router, styling,
> or i18n library. Take those bindings from the project's *local* skills.

## Contract

**In:** editing or adding app chrome — the shell, top bar, sidebar, command palette, or global
overlays that frame every page. A component that renders/edits domain data is a feature instead
(`frontend-react:feature-components`).

**Out:** the component is placed in the layout area (app-wide chrome only), holds no domain logic or
data fetching beyond navigation, is composed from primitives, routes route/nav/guard changes through
the routing config, and follows `component-structure` + i18n. The checkable expectations are in
`evals/rubric.json`.

---

## Rules

Produce an integrated design — real layout mechanics (grid/flex, spacing, a11y, responsive
behaviour), not a rule-by-rule "Rule 1… Rule 2…" audit narration that satisfies the checklist while
delivering less than a plain competent design would.


1. **Placement.** The project's layout area — app-wide chrome only.
2. **No domain/business logic.** Layout arranges space and routes the user; it
   delegates domain rendering to pages and features. No business objects, no data
   fetching beyond what navigation itself needs.
3. **Compose primitives.** Build chrome from the project's primitives — don't
   hand-roll controls a primitive provides.
4. **Routing & nav through config.** Any route / nav item / section / guard change
   goes through the project's routing configuration (the source of truth), not ad
   hoc inside a layout component.
5. **Structure + i18n.** Follow `frontend-react:component-structure`; route strings
   through the project's i18n setup.

## Before you finish

1. It is confirmed app chrome, not a domain feature, and placed in the project's layout area (app-wide
   chrome only), with no domain/business logic and no data fetching beyond what navigation itself needs.
2. Chrome is composed from existing primitives, and any route/nav item/section/guard change went through
   the project's routing configuration — not ad hoc inside a layout component.
3. Structure follows `component-structure`, strings route through i18n, and a story was added if the
   repo has a catalog.
4. A line fails? Fix it and re-check. Full expectations → `evals/rubric.json`.
