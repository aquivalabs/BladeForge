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

## Contract

**In:** creating or editing any UI component, page, or layout style — or a project with no breakpoint
system yet.

**Out:** it renders validly at every defined breakpoint and the awkward widths between — no overflow,
readable text, discernible images, reflow rather than shrink, restrained chrome, usable targets, full-
area states, and breakpoints via the token system. The checkable expectations are in
`evals/rubric.json`.

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

## Before you finish

1. Resize through EACH defined breakpoint boundary and the in-between widths — not just one — and
   always spot-check the two extremes (smallest phone ~320px and a wide monitor); most breakage hides
   there.
2. At each width the eleven properties hold: fits its container, no page-level horizontal scroll,
   readable text, discernible images, reflow-not-shrink, restrained chrome, nothing hidden (no content
   trapped behind a sticky/fixed/overlay element at any width — check it or mark it N/A, never skip it
   silently), usable targets, sane density, full-area states pass, breakpoints via the token system.
   Walk EVERY axis explicitly; an axis that does not apply is declared N/A, not omitted.
3. A width fails? Fix it and re-resize. Full expectations → `evals/rubric.json`.

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
