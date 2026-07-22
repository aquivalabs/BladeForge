---
description: Use when creating or editing ANY UI component, page, or layout style — the acceptance bar that it must render validly at every defined viewport breakpoint (no overflow, readable text, discernible images, restrained borders, sane density). Also use when a project has no breakpoint/grid system yet: propose one before verifying. NOT for choosing px→rem (frontend-css:rem), SCSS tokens/BEM structure (frontend-css:scss-modules), or component folder placement (frontend-react:component-structure).
---

# Responsive Layout — Breakpoint Validity

Every component and page must render **validly at every viewport width**, not just the one on your
screen. This skill is the acceptance bar you apply while authoring, and the setup step for a project
that hasn't defined its breakpoints yet.

**Stack-agnostic.** This applies to any UI architecture — React, Vue, Angular, Svelte, Salesforce
LWC/Aura, Web Components, or plain HTML/CSS. Wherever the examples say "SCSS", read it as "your
stack's styling mechanism" (SCSS, CSS Modules, CSS custom properties, Tailwind, CSS-in-JS, a
framework theme). The acceptance bar below does not depend on the framework.

## When to Activate

- Creating a new component, page, view, or template.
- Editing an existing component's markup or styles in a way that affects layout, size, or wrapping.
- Writing any styles with widths, columns, flex/grid, or media/container queries.
- A project has no defined breakpoint scale / grid system (see step 0).

---

## 0. No breakpoint system? Establish one first

You cannot verify "valid at every breakpoint" against an undefined set. If the project has **no**
named breakpoint scale — no SCSS `$bp-*` map / mixin, no CSS custom properties, no Tailwind
`screens`, no framework theme tokens:

→ **Stop and propose one before writing responsive styles.** Offer the user two starting points:

- **A standard scale as the default** (widely-understood, min-width steps):

  | name | min-width | target |
  |---|---|---|
  | `sm` | 40rem (640px) | large phones / landscape |
  | `md` | 48rem (768px) | tablets portrait |
  | `lg` | 64rem (1024px) | tablets landscape / small laptops |
  | `xl` | 80rem (1280px) | desktops |
  | `2xl` | 96rem (1536px) | wide monitors |

  (Bootstrap's 576/768/992/1200/1400 is an equally fine alternative — offer it if the user leans that way.)

- **Or the user's own values** — if they already have a design grid, adopt those exact numbers.

At minimum, if the user won't commit to a full scale, **name the breakpoints actually in use** and
record them in one place (a tokens file) so "all breakpoints" has a concrete meaning. Emit media
queries through that system (a `respond-to(name)` mixin or the framework tokens), never inline
magic-number widths.

---

## Acceptance criteria

A component or page is **responsive-valid** only when, at **every defined breakpoint** — and the
awkward widths *between* them — all of the following hold. Check the smallest width (≈320px) and a
wide one explicitly; most breakage hides at the extremes.

1. **Fits its container.** No element clips or overflows its box; no element-level horizontal scrollbar.
2. **No horizontal page scroll.** Wide content (tables, code blocks, diagrams, wide media) scrolls
   inside its own `overflow-x: auto` container — the page body never scrolls sideways.
3. **Text stays readable.** Not truncated to nonsense, never below a legible size, no overlap or
   collision between text runs.
4. **Images/illustrations stay discernible.** Scaled so the user can still make out what they show —
   not shrunk to an unreadable thumbnail. Use `max-width: 100%` + intrinsic sizing, not fixed tiny
   dimensions.
5. **Reflow, don't just shrink.** Multi-column layouts collapse to stacked rows rather than scaling
   type or media below legibility to keep columns side-by-side.
6. **Borders/frames don't dominate.** Chrome — borders, padding, decorative frame — is never the
   majority of a block's visual mass, especially at the narrowest widths.
7. **Nothing hidden or covered.** No content pushed off-edge or trapped behind sticky/fixed/overlay
   elements at any width.
8. **Interactive targets stay usable.** Adequate hit area (≈44px) at touch widths; controls don't
   overlap, stack into each other, or become unclickable.
9. **Density/spacing scales sanely.** Spacing comes from the scale/tokens; no cavernous dead space
   when wide, no cramped collisions when narrow.
10. **Full-area states pass too.** Empty / loading / error / placeholder states fill their area
    without overflow at every breakpoint (they are easy to forget — they render full-width).
11. **Media queries via the system.** Every breakpoint rule uses the project's breakpoint tokens /
    mixin — never a hardcoded magic-number width.

---

## How to verify

- Resize through **each** defined breakpoint boundary and the in-between widths, not just one.
- Use the tooling the project has: browser devtools responsive mode, or the Storybook viewport addon
  (`@storybook/addon-viewport`) with the project's breakpoints registered.
- Always spot-check the two extremes — the smallest phone width and a wide monitor. If it holds there,
  the middle usually follows.

---

## Enforcing it on every component change (per-repo)

A skill description alone triggers unreliably for routine "build/fix a component" work — the model
often treats that as something it handles directly and doesn't stop to consult a checklist. To make
this bar actually apply on **every** component edit, wire it into the consuming repo (not the skill —
enforcement is per-project because file patterns differ by stack):

- **A `PostToolUse` hook** on `Write|Edit` matching that repo's component/style files, injecting a
  short reminder that points here. Match your stack's patterns, e.g.:
  - React/Vue/Svelte: `src/**/*.{tsx,jsx,vue,svelte,scss,css}`
  - Angular: `**/*.component.{ts,html,scss}`
  - Salesforce LWC: `**/lwc/**/*.{html,css,js}` · Aura: `**/aura/**/*.{cmp,css}`
- **And/or a review-gate dimension** that checks the acceptance criteria against the diff at review time.
- **And** a one-line pointer in the repo's agent instructions (`CLAUDE.md`/`AGENTS.md`), which is
  always in context and names the project's breakpoint tokens.

The skill is the shared *content*; the hook/review/instruction is the per-repo *trigger*.

---

## Rationalizations — thought → reality

| Thought | Reality |
|---|---|
| "Looks fine on my screen." | You tested one width. The bar is *every* breakpoint. |
| "It's just a small component." | Small components nest into the tightest columns, where overflow bites first. |
| "The text just truncates, that's fine." | Truncated-to-nonsense fails criterion 3 — the user must still be able to read it. |
| "I'll shrink it to keep the columns." | Shrinking below legibility fails 4/5 — reflow to a stack instead. |
| "No grid defined, I'll just eyeball widths." | Undefined breakpoints make "responsive" unverifiable. Pin the scale first (step 0). |
