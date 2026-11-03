---
description: "Use when writing, editing or reviewing a Vue single-file component — the <script setup lang=\"ts\"> block, props and emits and their types, defineModel, slots, template syntax, refs and computeds, watchers, lifecycle, the order of blocks in the .vue file, component and file naming. Also for converting an Options API or a JavaScript component to Composition API with TypeScript. NOT for where a component lives (frontend-vue:component-architecture), its styles (frontend-vue:bem-styles), a Pinia store (frontend-vue:state-pinia), or a reusable composable (frontend-vue:composables-vueuse)."
---

# Single-file component conventions

## Contract

**In:** a `.vue` file being written, edited or reviewed, in a Vue 3.4+ project with TypeScript.

**Out:** the component holds the house shape: `<script setup lang="ts">` with Composition API only,
typed props and emits, `defineModel` for two-way state, a template that reads top to bottom with no
logic beyond a condition or a loop, scoped styles, and the house JS/TS style from
`frontend-js:conventions`. The checkable expectations are in `evals/rubric.json`.

---

## Shape of the file

```vue
<script setup lang="ts">
// One sentence: what this component is for, and the one decision a reader would ask about.
import { computed, ref } from 'vue';
import type { Ticket } from '@/types/ticket';

const props = defineProps<{ ticket: Ticket; dense?: boolean }>();
const emit = defineEmits<{ open: [ticket: Ticket]; mark: [id: string, handled: boolean] }>();
const query = defineModel<string>('query', { default: '' });

const title = computed(() => `${props.ticket.key} · ${props.ticket.summary}`);
const expanded = ref(false);
</script>

<template>
  <article class="ticket-card" :class="{ 'ticket-card--dense': props.dense }">
    <h3 class="ticket-card__title">{{ title }}</h3>
    <button type="button" class="ticket-card__open" @click="emit('open', props.ticket)">Open</button>
  </article>
</template>

<style scoped lang="scss">
.ticket-card { /* see frontend-vue:bem-styles */ }
</style>
```

Blocks in this order: `script setup`, `template`, `style scoped`. One component per file; the file
and the component are PascalCase (`TicketCard.vue`), used in templates as `<TicketCard>`.

## Rules

- **Composition API only, `<script setup lang="ts">` only.** No Options API, no `defineComponent`
  except at a boundary that needs it (a library expecting an options object). No `export default`.
- **Props and emits are typed with the generic form**, never with runtime object literals:
  `defineProps<{ … }>()` with `withDefaults` when defaults are needed, `defineEmits<{ event: [payload] }>()`.
  A prop is read through `props.x` in the script; in the template `x` alone is fine.
- **`defineModel` for two-way state** (`v-model`, named models), never a manual `update:value` emit pair.
- **Reactive state:** `ref` for a value, `computed` for anything derivable, `shallowRef` for a large
  snapshot replaced wholesale, `reactive` only for a small bag of related fields. Derive, do not
  store twice.
- **Watchers are the last resort.** A `watch` is for side effects (a request, a scroll, a save), not
  for keeping one piece of state equal to another; that is a `computed`. `watchEffect` only for
  effects whose dependencies are read inside.
- **Templates stay declarative:** `v-if`/`v-for` with a `:key`, no inline arrow functions with logic,
  no method calls that do work in a binding; move it to a `computed` or a named function.
  `v-for` and `v-if` never on the same element.
- **Slots over render props**: named slots with typed slot props through `defineSlots` when a
  consumer needs them.
- **Lifecycle:** `onMounted`/`onUnmounted` for DOM and subscriptions only; anything with a cleanup
  is a composable (`frontend-vue:composables-vueuse`), and VueUse already has most of them.
- **Events:** `@click.stop`, `@keydown.enter.prevent` modifiers over code in the handler; a
  `<button type="button">` over a `<span role="button">` so Enter and Space come for free.
- **Async:** `<Suspense>` with an `async setup` only when the project already uses it; otherwise a
  loading state in the component.
- **Names:** full words (`selectedTicket`, not `selT`), `is`/`has` for booleans, `on` for handlers,
  `use` only for composables.

Reuse before writing: a component that needs a well-known behaviour (positioning, focus trap,
virtual list, drag) walks `meta:reuse-first` before any of it is coded here.

---

## Before you finish

1. `grep -n "export default\|defineComponent\|data()\|methods:" <file>` → nothing, unless at a
   documented library boundary.
2. `grep -n "defineProps(\|defineEmits(" <file>` → every call uses the generic form (`<{`).
3. Read the template: each `v-for` has a `:key`, no `v-if` shares an element with `v-for`, no binding
   calls a function that does work.
4. `vue-tsc --noEmit` is clean for the file.
