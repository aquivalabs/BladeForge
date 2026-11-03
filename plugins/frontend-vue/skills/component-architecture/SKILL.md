---
description: "Use before creating a Vue component or when deciding where one lives and what it may know — a reusable UI primitive, a feature component bound to the domain, a layout piece of the app chrome, a page or view, a component that only exists for one parent. Also when a component grew into two, when a feature reaches into another feature's component, when a page holds logic, or when asked \"where does X go\" in a Vue project. NOT for the inside of the .vue file (frontend-vue:sfc-conventions), nor for React (frontend-react:component-placement)."
---

# Component architecture

## Contract

**In:** a Vue project with a `src/` tree, and a component about to be created, moved or split.

**Out:** the component sits in the layer its knowledge allows, imports only downward, and an
existing primitive was reused or extended before a new one was built. The checkable expectations
are in `evals/rubric.json`.

---

## Layers, top to bottom

| Layer | Folder | Knows about | Example |
|---|---|---|---|
| pages or views | `src/pages/` (`src/views/` in Vue Router apps, `pages/` in Nuxt) | routes, which features to compose | `DashboardPage.vue` |
| layouts | `src/layouts/` | the app chrome: shell, rail, top bar, overlays | `AppShell.vue`, `SideRail.vue` |
| features | `src/features/<feature>/` | one domain concept, its store, its API | `features/feed/FeedPanel.vue` |
| ui primitives | `src/components/ui/` (or `src/ui/`) | nothing of the domain: props in, events out | `Pill.vue`, `Segmented.vue`, `Sheet.vue` |
| composables and lib | `src/composables/`, `src/lib/` | pure logic, no components | `useColourScheme.ts`, `lib/feed.ts` |

Imports go down only: a page composes features and layouts; a feature uses primitives, its own
store and composables; a primitive imports nothing above itself. A feature never imports another
feature's component; it goes through the page, a shared primitive, or a store.

## Steps

1. **Search before building.** Grep `src/components/ui` (and the barrel if there is one) for the
   control by concept, not by the name you have in mind. Found: reuse it; almost: extend it with a
   prop or a variant; only then build. For behaviour-heavy primitives (dialog, tooltip, combobox,
   drag) walk `meta:reuse-first`: a headless library usually wins over hand-rolled DOM.
2. **Name the layer** from what the component must know. If it needs the ticket type, it is a
   feature component; if it only needs `label` and `tone`, it is a primitive.
3. **One folder per feature**, with its components, its store, its composables and its tests
   together: `features/feed/{FeedPanel.vue,FeedItem.vue,feed.store.ts,useFeedSearch.ts,feed.test.ts}`.
   A primitive is one file, or a folder when it has a story and a test beside it.
4. **A component used by one parent stays beside the parent**, not in `ui/`. Promote it to `ui/`
   on the second use, when its props have stopped changing.
5. **Pages hold no logic.** A page wires route params into feature components and nothing else;
   logic lives in the feature's store or composable.
6. **Split** when a component has two reasons to change, or its template scrolls: the parts become
   children with props and events, never a shared mutable object.

## Boundaries, in one line each

- Props and emits are the contract; a child never reaches into a parent's state or a sibling's DOM.
- `provide`/`inject` only for a true context (theme, the current workspace) and typed with an
  `InjectionKey`; never as a shortcut for passing data two levels down.
- Global state is a store (`frontend-vue:state-pinia`); shared logic is a composable
  (`frontend-vue:composables-vueuse`); a component owns only what is displayed.

---

## Before you finish

1. `grep -rn "from '@/features/" src/features/<feature>/` → no import of another feature's
   component.
2. `grep -rn "from '@/features\|from '@/pages" src/components/ui` → nothing.
3. The new component's folder matches its layer in the table; if it is a primitive, the search in
   step 1 was done and its result named in the PR.
