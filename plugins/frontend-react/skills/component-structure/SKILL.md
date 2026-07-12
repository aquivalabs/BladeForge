---
description: "Use when creating, editing, restructuring, or reviewing a React frontend component \u2014 including its folder layout and file organization (tsx/scss/index), where a component or sub-component should live, BEM class naming, SCSS styling, rem sizing, i18n of user-visible strings, barrel exports, and replacing inline JS style/hover handlers (e.g. onMouseEnter toggling classes) with CSS. Covers \"this component file is in the wrong place \u2014 fix the structure\", moving a flat .tsx into its own folder, and any question about how a component's files, styles, or markup should be organized."
---

# Component Structure — BEM + SCSS + rem + i18n

## When to Activate

Any time a new React component is created, or an existing component is edited or its structure is reviewed.

---

## Step 0 — Activate supporting skills first

Before writing any component code or styles, activate both of these skills and apply their rules throughout:

1. **Activate `frontend-css:scss-modules` skill** — governs colors, spacing, file extension, variables
2. **Activate `frontend-css:rem` skill** — governs all dimensional values

Everything in this skill assumes those two are already in effect.

---

## Folder structure

**Every component — including sub-components — gets its own kebab-case folder** with its own `.tsx`, `.scss`, and `index.ts`. No exceptions.

```
component-name/
  ComponentName.tsx      ← React component (PascalCase file)
  component-name.scss    ← BEM styles for this component only
  index.ts               ← barrel export
```

Sub-components nest as sibling folders inside the parent folder:

```
sidebar/
  Sidebar.tsx
  sidebar.scss
  index.ts
  sidebar-nav-item/
    SidebarNavItem.tsx
    sidebar-nav-item.scss
    index.ts
  sidebar-sub-nav-item/
    SidebarSubNavItem.tsx
    sidebar-sub-nav-item.scss
    index.ts
```

The parent `index.ts` re-exports everything public from all sub-component folders:

```ts
// sidebar/index.ts
export { Sidebar } from './Sidebar';
export { SidebarNavItem } from './sidebar-nav-item';
export { SidebarSubNavItem } from './sidebar-sub-nav-item';
export type { NavItemData, NavSelectionEvent } from './Sidebar';
```

**No flat sub-components.** A component that has its own styles, state, or props is always a folder — never a bare `.tsx` file sitting alongside the parent.

---

## BEM naming

Block = component root class (matches the folder name).
Element = `block__element`.
Modifier = `block--modifier` or `block__element--modifier`.

```scss
.card-item {              // Block
  &__title  { ... }      // Element
  &__body   { ... }      // Element
  &--active { ... }      // Modifier
}
```

Rules:
- Block name matches the folder name (kebab-case)
- Never nest blocks inside each other's BEM — use a new block
- Modifiers only change what's different; don't repeat base styles inside a modifier
- State classes (`:hover`, `:focus`, `:disabled`) go inside the element or block rule via SCSS `&`

---

## SCSS file structure

```scss
@use '@/styles/variables' as *;

// 1. Optional component-level variables at the top
$item-height: 2.5rem;

// 2. Block
.block-name {
  // base styles

  // 3. Elements
  &__element { ... }

  // 4. Modifiers
  &--modifier {
    // overrides only
    .block-name__element { ... }
  }

  // 5. State
  &:hover { ... }
}
```

Follow `frontend-css:scss-modules` skill for: colors (`$color-*` / `var(--color-*)`),
spacing (`$space-*`, `$radius-*`), and file extension (`.scss` only).

Follow `frontend-css:rem` skill for: all dimensional values in rem except
border-width, box-shadow offsets, and SVG attributes.

---

## No inline hover handlers

Never use `onMouseEnter`/`onMouseLeave` to toggle styles in JS.
All hover/focus/active states must be CSS-only via `&:hover` etc.

```tsx
// Wrong
onMouseEnter={(e) => (e.currentTarget.style.background = '#eee')}

// Correct — handled in SCSS
&:hover { background: $color-surface-hover; }
```

---

## i18n — all user-visible strings must use translations

**Never hardcode user-visible text** in JSX or component logic — route every string through
`react-i18next` (`const { t } = useTranslation('pages/<page>' | 'common')`). Page components use the
`pages/<page-name>` namespace, shared ones use `common`; add keys to the matching JSON under
`src/i18n/locales/en/` (register a new page namespace in `src/i18n/index.ts`). User-visible = labels,
titles, buttons, placeholders, `aria-label`, error/empty/loading messages. NOT translated = internal
constants, enum values, log/dev messages, and dynamic API data.

Namespace table, usage + nested-key examples, and the full "counts / doesn't count" lists →
`references/i18n.md`. See also the `i18n:ui-strings` skill.

---

## Error boundaries — wrap every fallible component

Any component that fetches data or can otherwise throw at render (a data hook that re-throws its
query error, a parse, a lazy import) MUST be isolated by an error boundary, so one failing block
never blanks the whole page. Wrap it at its mount site, or export it wrapped:

```tsx
import { ErrorBoundary, withErrorBoundary } from '@/components/feedback/error-boundary';

// At the mount site:
<ErrorBoundary>
  <DataGrid />
</ErrorBoundary>

// …or as the component's own default export (the HOC "decorator"):
export default withErrorBoundary(DataGrid);
```

The boundary's default fallback reads the app's **unified error envelope** (`shared/errors/codes.ts`)
and renders the matching user-friendly tile — `AccessDenied` for a permission denial, `ErrorState`
for everything else, with copy resolved by error reason/status. So you never hand-roll error copy per
component. A data hook surfaces its failure by re-throwing the query error into the wrapping boundary
(`if (error) throw error`).

### Storybook: prove the error state, drive it with a control

Every component with an error/fallback (or any multi-state) path gets a Storybook story that
exercises it — but do NOT write one hardcoded export per state. Author **one controllable story** and
expose the state-driving prop as an `argTypes` **`select`** (options list), so a reviewer flips every
state from the Controls dropdown. That is the whole point of prop-/BEM-state-driven components: one
component, every state reachable through a prop.

```tsx
// argTypes turns the state prop into a dropdown of every value.
argTypes: { reason: { control: 'select', options: Object.values(REASONS) } },
args: { reason: REASONS.INSUFFICIENT_ACCESS },
render: ({ reason }) => (
  <ErrorBoundary>
    <ThrowApiError reason={reason} />
  </ErrorBoundary>
),
```

Model props as lists and prefer `select` / `radio` / `boolean` controls over duplicated story
exports. Story mechanics + the yes/no-stories decision live in the `frontend-react:storybook-stories`
skill.

---

## Barrel exports (index.ts)

Always export:
- The main component(s)
- All public TypeScript types/interfaces

```ts
export { FeatureBlock } from './FeatureBlock';
export { FeatureBlockItem } from './FeatureBlockItem';
export type { FeatureBlockItemData } from './FeatureBlockItem';
```

---

## Checklist — creating a new component

- [ ] Folder is kebab-case
- [ ] Component file is PascalCase `.tsx`
- [ ] Style file is kebab-case `.scss`
- [ ] `index.ts` barrel exports the component and its public types
- [ ] BEM: block matches folder name, elements use `&__`, modifiers use `&--`
- [ ] No inline `onMouseEnter`/`onMouseLeave` — hover states are in SCSS
- [ ] Colors from `$color-*` or `var(--color-*)` (see `frontend-css:scss-modules`)
- [ ] Spacing from `$space-*` / `$radius-*` (see `frontend-css:scss-modules`)
- [ ] All sizes in rem (see `frontend-css:rem`)
- [ ] All user-visible strings use `useTranslation` — no hardcoded text in JSX
- [ ] Translation keys added to the correct JSON file in `src/i18n/locales/en/`
- [ ] New page namespace registered in `src/i18n/index.ts` (if applicable)
- [ ] Data/fallible component isolated by `<ErrorBoundary>` (or `withErrorBoundary`)
- [ ] Storybook exercises the error/fallback (and other) states via a `select`-control arg — one controllable story, not per-state exports

## Checklist — editing an existing component

- [ ] Any new user-visible strings added via `useTranslation`, not hardcoded
- [ ] New translation keys added to the existing JSON namespace file
- [ ] No existing hardcoded strings left as-is if they were missed — fix them too
- [ ] BEM structure preserved: new elements follow `&__element` pattern
- [ ] No new inline hover handlers introduced
- [ ] No new hardcoded color or spacing values — use tokens
- [ ] Any new fetch/throw path sits inside an `ErrorBoundary`
