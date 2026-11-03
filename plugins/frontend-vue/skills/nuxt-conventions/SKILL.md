---
description: "Use when the project is Nuxt 3 or 4 — creating pages, layouts, server routes or middleware, fetching data with useFetch or useAsyncData, relying on auto-imports, choosing rendering (SSR, SSG, SPA, hybrid routes), configuring modules in nuxt.config, handling runtime config and environment, or reviewing a Nuxt file placement. NOT for a plain Vite + Vue Router app (frontend-vue:component-architecture) and NOT for the inside of a component (frontend-vue:sfc-conventions)."
---

# Nuxt conventions

## Contract

**In:** a Nuxt 3 or 4 project (`nuxt.config.ts` present).

**Out:** files sit in the directories Nuxt reads by convention, data comes through `useFetch`/
`useAsyncData` with keys, server code lives under `server/`, secrets are runtime config, and the
rendering mode is chosen per route on purpose. The checkable expectations are in `evals/rubric.json`.

---

## Directories

| Folder | Holds | Rule |
|---|---|---|
| `app/pages/` (Nuxt 4; `pages/` in 3) | routes; file name is the route | a page composes components and calls data fetching; no business logic |
| `app/layouts/` | app chrome per layout name | `default.vue` plus named layouts; pages pick with `definePageMeta({ layout })` |
| `app/components/` | auto-imported components; nested folders prefix the name | `components/ui/Pill.vue` is `<UiPill>`; keep the structure of `frontend-vue:component-architecture` |
| `app/composables/` | auto-imported `use*` | the same contract as `frontend-vue:composables-vueuse`; VueUse through `@vueuse/nuxt` |
| `app/stores/` | Pinia stores through `@pinia/nuxt` | `frontend-vue:state-pinia` applies unchanged |
| `app/middleware/` | route middleware | `defineNuxtRouteMiddleware`; global ones end in `.global.ts` |
| `app/plugins/` | app plugins | `defineNuxtPlugin`; one concern per file |
| `server/api/`, `server/routes/`, `server/middleware/` | Nitro handlers | `defineEventHandler`, input validated with a schema (`meta:reuse-first`: Zod or Valibot), errors with `createError` |
| `shared/` (Nuxt 4) | types and utils used by both app and server | nothing framework-specific |

## Rules

- **Auto-imports are the convention**, so no explicit import of `ref`, `computed`, `useFetch`,
  components or composables from those folders; an explicit import of something auto-imported is a
  review finding. Outside those folders, import explicitly.
- **Data fetching:** `useFetch('/api/x', { key })` for a URL, `useAsyncData(key, () => …)` for
  anything else; never a bare `fetch` or `$fetch` in a page's setup (it runs twice and hydrates
  nothing). `$fetch` is for event handlers and server code. Keys are stable and include the
  identifiers, so navigation and refresh dedupe.
- **Rendering per route** with `routeRules` in `nuxt.config.ts`: `prerender` for static pages,
  `ssr: false` for the dashboard-like ones, `swr`/`isr` where a cache is wanted. State the reason in
  the config comment.
- **Runtime config, never `process.env` in app code:** `runtimeConfig` with `public` for what the
  browser may see; secrets stay server-side and come from `NUXT_*` environment variables.
- **Error handling:** `createError({ statusCode, statusMessage })` on the server, `error.vue` at the
  root for the page, `<NuxtErrorBoundary>` around a widget that may fail alone.
- **SEO and head** through `useHead`/`useSeoMeta` in the page, not in a layout.
- **Modules before code:** `@pinia/nuxt`, `@vueuse/nuxt`, `@nuxt/image`, `@nuxt/fonts`, `@nuxt/test-utils`
  cover most needs; adding one is a `meta:reuse-first` decision.

---

## Before you finish

1. `grep -rn "process\.env" app server --include=*.ts --include=*.vue` → nothing outside
   `nuxt.config.ts`.
2. `grep -rn "await \$fetch\|await fetch(" app/pages` → nothing in setup; data goes through
   `useFetch`/`useAsyncData` with a key.
3. `grep -rn "^import { ref\|^import { computed\|^import { useFetch" app` → nothing: those are
   auto-imported.
4. `npx nuxi typecheck` is clean.
