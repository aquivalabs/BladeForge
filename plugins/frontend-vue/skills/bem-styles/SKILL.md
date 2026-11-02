---
description: "Use when writing or reviewing the styles of a Vue component — the <style scoped> block, BEM class names for its block, elements and modifiers, state classes bound from the template, design tokens as CSS variables, SCSS inside the component, Stylelint complaints about selector patterns, or moving rules from a global stylesheet into a component. Also when two components share a class name by accident. NOT for the SCSS token system itself or rem sizing (frontend-css:scss-modules, frontend-css:rem), nor for React components (frontend-react:component-structure)."
---

# BEM in scoped styles

## Contract

**In:** a Vue component's `<style scoped>` block being written or reviewed, in a project with a
global tokens stylesheet.

**Out:** the component's styles live in its own scoped block, every class follows BEM for exactly
one block named after the component, colours, spacing and radii come from tokens, and the global
stylesheet holds only tokens, resets and layout primitives. The checkable expectations are in
`evals/rubric.json`.

---

## Rules

- **One block per component, named after it in kebab-case:** `FeedItem.vue` owns `.feed-item`.
  Elements are `.feed-item__title`, modifiers `.feed-item--unread`, `.feed-item__title--long`.
  Never nest deeper than block, element, modifier.
- **`<style scoped>` (or `lang="scss"` scoped) for every component.** Scoping prevents the clash;
  BEM keeps the names readable and greppable, and a scoped block may still be overridden by a parent
  through `:deep()`, which is the only acceptable way to reach into a child.
- **State from the template, not from JavaScript style changes:** `:class="{ 'feed-item--unread': fresh }"`.
  A modifier is a class the template toggles, never an inline `style` with a colour.
- **Tokens, never literals:** `color: var(--md-primary)`, `padding: var(--space-3)`,
  `border-radius: var(--radius-card)`. A new value becomes a token first (`frontend-css:scss-modules`
  for the SCSS variable system, `frontend-css:rem` for sizes).
- **The global stylesheet shrinks to:** tokens (`:root`, dark scheme), resets, typography, and
  layout primitives shared by many components (`.island`, `.pill`, `.btn`, `.input`). Everything
  that belongs to one component moves into that component. A class used in two components either
  becomes a primitive or a shared component.
- **Stylelint enforces the names:** `selector-class-pattern` with the BEM pattern
  `^[a-z]([a-z0-9-]+)?(__([a-z0-9]+-?)+)?(--([a-z0-9]+-?)+){0,2}$`, `stylelint-config-standard-scss`
  when SCSS is used. The config template is in `frontend-vue:tooling` (RMA-130).
- **No element selectors for structure** (`.card h2`), no ids, no `!important`; specificity stays
  flat so the cascade never fights the modifier.

## Moving rules out of a global stylesheet

1. Pick one component; list the global rules its template uses.
2. Rename them to the component's block in the template and in a new scoped block.
3. Delete the global rules; grep the tree for the old class names to be sure nothing else used them.
4. Screenshot before and after at two widths; the look must not change.

---

## Before you finish

1. `grep -n "class=" <file>` → every class is `<block>`, `<block>__<element>` or a modifier of
   those, with `<block>` the component's kebab-case name; primitives from the global sheet are the
   only exceptions.
2. `grep -nE "#[0-9a-fA-F]{3,6}\b|[0-9]+px" <file>` inside `<style>` → nothing but tokens and rem.
3. `npx stylelint "<file>"` → clean.
