---
description: "Use when a Vue component renders data that loads asynchronously and you must decide whether it needs a loading skeleton, or how to build one — a panel that shows a blank gap or a \"Loading…\" line while a Pinia store, useFetch, useAsyncState or a TanStack Query for Vue query is pending, a request to add a loading state, a Suspense fallback, a question whether to install a skeleton library, or a review of async-data UI. NOT for the shimmer animation itself or its reduced-motion rule (frontend-vue:motion), and NOT for React (frontend-react:skeleton-components)."
---

# Skeleton components — decide first, then build one beside the component

The Vue counterpart of `frontend-react:skeleton-components`. A skeleton is not a default: it earns
its place only where a component has a real loading window. When it does, it is a separate
component next to the real one, built from the shared `Skeleton` primitive.

## Contract

**In:** a Vue component that renders asynchronously-loaded data, a request for a loading state, or a
review of async-data UI.

**Out:** the decision made first, so a skeleton exists only where a real loading window exists.
Where it does, `<Component>Skeleton.vue` sits in the same folder as the real component, is built
from the shared `Skeleton.vue` primitive, has the real component's shape, and is chosen by the
consumer while data loads. The checkable expectations are in `evals/rubric.json`.

---

## Step 0 — Decide: does this component need a skeleton?

**The default is no.** A skeleton is warranted only when the first paint waits for data: a
`status === 'pending'` or `isLoading` in a store, `isFetching` from `useFetch`, `isLoading` from
`useAsyncState`, a `pending` from Nuxt `useFetch`, or an `async setup()` under `<Suspense>`.

| Situation | Skeleton? |
|---|---|
| The component, or the store it reads, loads data and the user sees a gap first | **Yes** |
| A presentational component that gets its data through props | **No** |
| The data is synchronous, or already in the store when the component mounts | **No** |
| A parent already renders a skeleton for this whole region | **No**, do not double up |

No loading window → stop here, and build nothing.

## Step 1 — Reuse the shared `Skeleton` primitive

Never install a skeleton library, and never write a pulsing `<div>` inline. Use the project's
`Skeleton.vue` in `src/components/ui/` and compose several to match the shape of what loads. If the
project has none, create it once as a ui primitive (`frontend-vue:component-architecture`). Its
shimmer is a CSS keyframe on a token background, and its reduced-motion rule belongs to
`frontend-vue:motion`.

## Step 2 — Build a separate skeleton component beside the real one

Name it `<Component>Skeleton.vue` and put it in the same folder as the component it stands in for.
Export it wherever the real component is exported; a folder with an `index.ts` exports both.

```text
features/feed/
  FeedPanel.vue
  FeedPanelSkeleton.vue   ← built from <Skeleton />
  index.ts                ← exports both
```

- **It has the real component's shape:** the same outer box, the same number of rows, the same rough
  sizes, so the content drops in without the page jumping. Scoped styles cannot share classes
  between the two files. Put the shared sizes in CSS custom properties or tokens that both read,
  instead of copying numbers.
- **The real component gets no loading branch.** No `v-if="loading"` inside `FeedPanel.vue`; the
  skeleton is a sibling that the consumer picks.

## Step 3 — Wire the loading branch at the consumer

```vue
<FeedPanelSkeleton v-if="feed.status === 'pending'" />
<FeedPanel v-else :items="feed.items" />
```

With `<Suspense>`, the skeleton is the `#fallback` slot. If the store does not expose its loading
state, add it there (`frontend-vue:state-pinia`); do not guess it from empty data.

## Step 4 — In Storybook, stack it under the real component

If the project writes stories (`frontend-vue:storybook-stories`), the skeleton gets no story file of
its own. It is a state of the real component: render it directly below the real one in each story,
the real one on top. Stack them; never place them side by side.

---

## Before you finish

1. Name the loading signal the skeleton answers to (the store field, `isFetching`, `pending`). If
   there is none, no skeleton was built.
2. `grep -rn "skeleton" package.json` → no skeleton library.
3. `ls <component folder>` → `<Component>Skeleton.vue` beside `<Component>.vue`, and
   `grep -n "Skeleton" <Component>Skeleton.vue` shows it is built from the shared primitive.
4. `grep -n "v-if" <Component>.vue` → no loading branch inside the real component; the consumer
   holds the `v-if`/`v-else` or the `#fallback`.
5. Load the page with a throttled network → the skeleton shows, then the content replaces it with no
   layout jump.
6. A line fails? Fix it and start again from 1.
