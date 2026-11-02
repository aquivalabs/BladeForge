---
description: "Use when writing, fixing or reviewing tests for a Vue project — a unit test for a composable or a lib function, a component test with Vue Test Utils or Testing Library for Vue, a Pinia store test, a Nuxt test with @nuxt/test-utils, an end-to-end flow with Playwright — or when deciding what to test at which level, what to mock, how to run the suite before a merge, or why a test is flaky. NOT for the toolchain configs themselves (frontend-vue:tooling) and NOT for Apex or React tests."
---

# Testing a Vue project

## Contract

**In:** a Vue 3 project with Vitest, and code that changed.

**Out:** the logic is tested where it lives: pure functions and composables as units, components
through their rendered output and emitted events, stores through their actions, the few flows that
matter end to end; the suite runs in one command before a merge and is green. The checkable
expectations are in `evals/rubric.json`.

---

## What to test where

| Code | Test | Tool |
|---|---|---|
| `src/lib/*` pure functions | input → output, the edge cases named in the issue | Vitest |
| composables | behaviour through a tiny host component or `withSetup` helper; VueUse itself is not retested | Vitest + `@vue/test-utils` |
| components | what the user sees and does: render with props, find by role or text, click, assert emitted events and DOM; never internal refs | `@testing-library/vue` (preferred for user-facing) or `@vue/test-utils` |
| Pinia stores | actions and their effect on state, with `createTestingPinia` or a fresh `setActivePinia(createPinia())` per test | Vitest + Pinia |
| Nuxt pages and server routes | `@nuxt/test-utils` with `mountSuspended`, `registerEndpoint`, `$fetch` | Vitest |
| the three to five flows the product cannot lose | the browser, against a running build | Playwright |

## Rules

- **Test behaviour, not implementation.** Query by role, label and text; assert on emitted events
  and rendered output; no `wrapper.vm.internalRef`.
- **One concept per test, named as a sentence** (`'a handled row sinks to the bottom and comes back on undo'`).
- **Mock at the boundary only:** the HTTP client or the API module, never a composable of ours in
  the middle. `vi.mock('@/api/workspace')` with a typed fake; `msw` when many tests share a server.
- **Pinia in component tests:** `createTestingPinia({ stubActions: false })` when the action matters,
  stubbed otherwise; pass `initialState` rather than calling actions in setup.
- **Time and randomness are controlled:** `vi.useFakeTimers()`, `vi.setSystemTime`, seeded randoms;
  a test that depends on the wall clock is a flaky test.
- **No snapshot tests of whole components;** a snapshot of a small, stable fragment is acceptable
  when the shape is the point.
- **Coverage is a guide, not a gate:** cover the branches the issue names; do not write a test to
  move a number.
- **Before a merge:** one command (`npm run check`, see `frontend-vue:tooling`) runs types, lint,
  style lint and `vitest run`; the pre-push hook or CI runs it, and red is red.

```ts
// features/feed/FeedItem.test.ts
import { render, screen, fireEvent } from '@testing-library/vue';
import FeedItem from './FeedItem.vue';

const item = { id: 'c1', ref: 'PROJ-7', kind: 'comment', who: 'Pat', at: '2026-11-02T10:00:00Z', body: 'please look', url: 'https://tracker.example/PROJ-7' };

test('a fresh comment is marked seen when clicked', async () => {
  const { emitted } = render(FeedItem, { props: { item, fresh: true, source: { id: 'tracker', type: 'tracker', label: 'Tracker' } } });
  await fireEvent.click(screen.getByText('PROJ-7').closest('li')!);
  expect(emitted().seen).toEqual([[ 'c1' ]]);
});
```

---

## Before you finish

1. `vitest run` → green; the new test fails when the change is reverted (run it once against the
   old code, or against a deliberately broken line).
2. `grep -rn "wrapper.vm\.\|\.vm\.\$" src --include=*.test.ts` → nothing.
3. `grep -rn "toMatchSnapshot" src --include=*.test.ts` → only small fragments, each with a reason.
4. The one check command of the project is green.
