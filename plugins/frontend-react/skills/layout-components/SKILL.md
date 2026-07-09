---
description: Rules for LAYOUT / app-chrome components in a React codebase — the shell, top bar, sidebar, command palette, and global overlays that frame every page. Activate when editing or adding app chrome. Framework-agnostic. Reached via frontend-react:component-placement.
---

# Layout Components — the frame around every page

**Layout** components are the app chrome: the persistent shell and navigation that
wrap whatever page is showing. They arrange and route; they don't know the business
domain.

> **Scope.** React, framework-agnostic — no assumption about your router, styling,
> or i18n library. Take those bindings from the project's *local* skills.

## When to Activate

Editing or adding app chrome (shell, top bar, sidebar, command palette, global
overlays). If the component renders/edits domain data, it's a feature, not layout
(`frontend-react:feature-components`).

## Rules

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

## Checklist
- [ ] Confirmed it's app chrome, not a domain feature
- [ ] Placed in the layout area
- [ ] No domain logic or direct data fetching
- [ ] Chrome composed from existing primitives
- [ ] Route/nav/guard changes went through the routing config
- [ ] Structure + i18n per project conventions
- [ ] Added a story if the project has a catalog
