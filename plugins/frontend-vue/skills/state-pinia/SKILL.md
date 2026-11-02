---
description: "Use when a Vue app needs state that more than one component reads or writes — the current user or workspace, lists from the server, selections, filters, marks — or when creating, editing, reviewing or splitting a Pinia store, deciding whether something belongs in a store at all, loading server data into one, or wiring server state through TanStack Query for Vue. NOT for behaviour composables (frontend-vue:composables-vueuse), not for component-local state (frontend-vue:sfc-conventions)."
---

# State with Pinia

## Contract

**In:** a Vue 3 project with Pinia installed, and state that crosses component boundaries.

**Out:** one setup-syntax store per domain concept, holding only the app's state and the actions that
change it; server data either lives in the store with explicit loading and error state or goes through
TanStack Query for Vue; components read through the store's refs and computeds and never mutate
foreign state directly. The checkable expectations are in `evals/rubric.json`.

---

## When it is a store

| State | Home |
|---|---|
| read or written by several features, or must survive navigation | a Pinia store |
| the server's answer to a query, cached, refetched, invalidated | TanStack Query for Vue; a store only when the project does not use it |
| behaviour with a lifecycle (listeners, timers) | a composable (`frontend-vue:composables-vueuse`) |
| derived from props, or local to one component | the component |

## Shape of a store

```ts
// src/features/workspace/workspace.store.ts — the open workspace and what the server computed for it.
import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import { getState, postMarks, type WorkspaceState, type Marks } from '@/api/workspace';
import { openCount } from '@/lib/moves';

export const useWorkspaceStore = defineStore('workspace', () => {
  const id = ref('');
  const snapshot = shallowRef<WorkspaceState | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const moves = computed(() => (snapshot.value ? openCount(snapshot.value.turn, snapshot.value.marks) : 0));

  const load = async (workspaceId: string) => {
    loading.value = true;
    error.value = null;
    try {
      snapshot.value = await getState(workspaceId);
      id.value = workspaceId;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading.value = false;
    }
  };
  const mark = async (marks: Partial<Marks>) => {
    if (!snapshot.value) {
      return;
    }
    snapshot.value = { ...snapshot.value, marks: await postMarks(id.value, marks) };
  };

  return { id, snapshot, loading, error, moves, load, mark };
});
```

- **Setup syntax only** (`defineStore(id, () => { … })`), never the options object.
- **One store per concept**, named after it, in its feature folder (`<feature>.store.ts`).
- **State is refs; derived values are computeds; changes are actions.** A component calls an action;
  it never assigns `store.snapshot = …` from outside.
- **A large server snapshot is a `shallowRef`** replaced wholesale, not a deep reactive tree.
- **Loading and error are explicit refs** on the store, not thrown at the component.
- **Reading in a component:** `const store = useWorkspaceStore()` then `store.moves`, or
  `storeToRefs(store)` when destructuring. Never destructure the store itself.
- **Persistence** through `useLocalStorage` from VueUse inside the store, or a Pinia persistence
  plugin the project already has; no hand-written `localStorage` calls.
- **Cross-store use** by calling the other store inside an action, not by importing its state at
  module top level.
- **Server state with TanStack Query for Vue** when the project uses it: `useQuery` with a key that
  includes the identifiers, `useMutation` with invalidation; the store then holds selections and
  preferences only. Choosing between the two is a `meta:reuse-first` decision written once per
  project in its ADR.

---

## Before you finish

1. `grep -rn "defineStore(" src` → every store is the setup form and one concept.
2. `grep -rn "store\.[a-z]* = " src/components src/features --include=*.vue` → nothing: components
   go through actions.
3. `grep -rn "localStorage" src/features/*/*.store.ts` → nothing hand-written.
4. The store exposes `loading` and `error` for every async action, and the component shows them.
