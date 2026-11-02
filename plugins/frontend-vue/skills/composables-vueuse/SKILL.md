---
description: "Use when a Vue component needs behaviour that is not display — reading or writing local storage, the colour scheme or a media query, the clock, window size, an event source or websocket, a debounce or throttle, the clipboard, focus, keyboard shortcuts, intersection, drag position, fetch with abort — or when about to write a use* composable, review one, or decide whether a piece of logic belongs in a composable, a store or a component. VueUse is checked first. NOT for app-wide state (frontend-vue:state-pinia) and NOT for React hooks (frontend-react:hooks-registry)."
---

# Composables, VueUse first

## Contract

**In:** a Vue 3 project with VueUse available or installable, and behaviour a component needs that is
not rendering.

**Out:** the behaviour comes from VueUse when VueUse has it, from a composable of ours when it is
business logic or a composition of several, and from the component only when it is one line; our
composables follow the `use*` contract below. The checkable expectations are in `evals/rubric.json`.

---

## Order of lookup

1. **VueUse.** Before writing `use*`, open the VueUse function list and search for the concept.
   The common wins: `useLocalStorage`, `useSessionStorage`, `usePreferredDark`, `useMediaQuery`,
   `useDark`, `useNow`, `useTimeAgo`, `useIntervalFn`, `useEventSource`, `useWebSocket`, `useFetch`,
   `useDebounceFn`, `useThrottleFn`, `refDebounced`, `useClipboard`, `useFocusTrap` (integrations),
   `onKeyStroke`, `useMagicKeys`, `useIntersectionObserver`, `useResizeObserver`, `useElementSize`,
   `useDraggable`, `useSortable` (integrations), `useEventListener`, `onClickOutside`, `useTitle`,
   `useScroll`, `useVirtualList`, `watchDebounced`, `computedAsync`, `createSharedComposable`.
2. **Our own composable** when the logic is ours: the shape of the feed, a hand-off to an agent,
   a business rule. Compose VueUse inside it rather than reimplement its parts.
3. **Inline in the component** when it is a single `computed` or one event handler. Do not create a
   composable for one line, and do not wrap a VueUse call in `useOurLocalStorage` that adds nothing.

The ladder above VueUse (platform, libraries, comparison) is `meta:reuse-first`; this skill is its
Vue rung.

## Writing a composable of ours

```ts
// src/composables/useFeedSearch.ts — the feed filtered by words, with the query remembered per workspace.
import { computed, type Ref } from 'vue';
import { useLocalStorage, refDebounced } from '@vueuse/core';
import { matchesQuery, type FeedItem } from '@/lib/feed';

export const useFeedSearch = (items: Ref<FeedItem[]>, workspaceId: Ref<string>) => {
  const query = useLocalStorage(computed(() => `feed-query:${workspaceId.value}`), '');
  const debounced = refDebounced(query, 150);
  const rows = computed(() => items.value.filter((item) => matchesQuery(item, debounced.value)));
  return { query, rows };
};
```

- **Name `use<Thing>`**, one file per composable in `src/composables/` (or beside its feature),
  the pure part in `src/lib/` under a unit test.
- **Arguments are refs or getters** (`MaybeRefOrGetter`) when they can change; use `toValue` inside.
- **Return an object of refs and functions**, never a reactive object the caller might destructure
  into dead values.
- **Clean up** with `onScopeDispose` (or let VueUse do it); a composable that adds a listener
  removes it.
- **One instance per concept** when the state must be shared across components:
  `createSharedComposable`, or a store when the state is the app's (`frontend-vue:state-pinia`).
- **No DOM in the setup path**: touch elements in `onMounted` or through a template ref.

## Composable, store or component

| It is | Then |
|---|---|
| local to one component and one line | inline |
| reusable behaviour with its own lifecycle | a composable |
| the app's state that several features read and write | a Pinia store |
| derived from props only | a `computed` in the component |

---

## Before you finish

1. For each new `use*`: name the VueUse function that was checked and why it did not fit, in the
   PR or a one-line comment at the top of the file.
2. `grep -rn "addEventListener\|setInterval\|localStorage" src/components` → nothing; those live
   in composables, and in VueUse first.
3. The pure part of the composable has a unit test in `src/lib/`, and the composable's return value
   is an object of refs and functions.
