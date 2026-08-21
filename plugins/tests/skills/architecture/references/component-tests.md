# Component tests — the DOM tier

Component and hook tests are the DOM tier. This page is their rules. Everything in the main skill
still applies; these are the additions the DOM brings.

## Finding an element

**Query by what a user — or a screen reader — can perceive.** Role and accessible name first,
label second.

```ts
screen.getByRole('button', { name: 'toolbar.save' });
screen.getByLabelText('catalog.name');
```

A test that can only find its element by class or by a test-only attribute is reporting that the
element is not reachable by anyone using assistive technology. That is a defect in the component,
found for free.

| query | when |
|---|---|
| `ByRole` + `name` | default for anything interactive |
| `ByLabelText` | form controls, where the label is the contract |
| `ByText` | headings, statuses, and other places where the text *is* the behaviour |
| `ByTestId` | only where no accessible handle exists — and with a comment saying why |
| `container.querySelector` | **never.** A CSS class is an implementation detail; styling refactors would break tests that assert nothing about styling |

The name passed to `ByRole` is a translation key, not prose → `copy-and-i18n.md`.

A `ByTestId` query that no production `data-testid` matches is a test asserting against an element
that no longer exists in that shape. `grep -rn "ByTestId" --include='*.test.tsx' src` against
`grep -rn 'data-testid' --include='*.tsx' src` is the check, and it is worth running when a suite
looks greener than the components deserve.

## Driving an interaction

**`userEvent` models a person. `fireEvent` models the environment.** Both stay; each has one area.

```ts
// a person: the full sequence — pointerdown, focus, keydown, click — wrapped in act
await userEvent.click(screen.getByRole('button', { name: 'toolbar.save' }));
await userEvent.type(screen.getByLabelText('catalog.name'), CATALOG_NAME);

// the environment: things a person cannot dispatch
fireEvent.scroll(window, { target: { scrollY: SCROLL_PAST_HEADER } });
fireEvent(window, new Event('resize'));
```

`fireEvent.click` dispatches **one** synthetic event. A component listening for `pointerdown`, or
depending on focus having moved, behaves differently in the test than in a browser — in either
direction, which is worse than failing.

`userEvent` is asynchronous. **A missing `await` leaves a test that passes by accident**, so the
`await` is not optional styling.

*The rule governs the cases you write or change. A file you merely opened owes nothing → main
skill, §8.*

## What gets substituted, and what gets rendered

**The boundary is ownership, not depth.** Our own components render for real, however deep. A heavy
third-party widget is substituted.

```ts
// substituted: not ours, and heavy
vi.mock('ag-grid-react', () => ({ AgGridReact: () => <div role="grid" /> }));

// rendered for real: ours, whatever the depth — real PriceInput, real ConfirmPrompt, real
// everything below. Both props are required, so the case supplies them rather than eliding them.
render(<CatalogToolbar catalog={catalog} gridApi={null} />);
```

A substituted widget keeps the **role** the real one exposes, so queries stay written against the
accessibility tree. Data is neither rendered nor substituted here — it comes from the fake, installed
through the data-client seam → main skill, clause 6.

Which upstreams a repository actually substitutes, and what each stub stands in for, is the boundary
catalogue → its own `docs/test-boundaries.md`, not this page. A list here would be a snapshot of
today's architecture wearing the costume of a rule.

**Never substitute a component we own.** It removes exactly the signal the test is paying render
time for. In every file that mocks its own children, a broken control cannot be seen — and an
`act(...)` cluster around a third-party popover positioner lives in exactly that blind spot, which is
where it was eventually found.

Where a case needs more than the component under test — a provider, a host, a portal target —
render it explicitly in that case rather than reaching for a mock:

```ts
render(
  <>
    <CatalogToolbar catalog={catalog} gridApi={null} />
    <PromptHost />
  </>,
);
```

Render it the way production does. `PromptHost` is a root-mounted sibling driven by
`prompt.store`, not a wrapper — the application root mounts it that way and the toolbar's own
story pairs it the same way, so a case that wraps the component in it is testing a shape the app
does not have.

Explicit extra rendering is cheap and visible. A mock is neither.

## Where `userEvent` comes from

```ts
import userEvent from '@testing-library/user-event';   // the only correct source in a unit test
```

**Never `import { userEvent } from 'storybook/test'` in a test file.** Storybook's `userEvent` is
not wired to the React `act` environment that `@testing-library/react` establishes under Vitest, so
every interaction it drives updates React outside `act`. Diagnosed by swapping that single import in
one file: every `act(...)` warning that file emitted disappeared, with the same tests passing.

`storybook/test` is legitimate inside `*.stories.tsx`. It is a unit-test import that is wrong.

`@testing-library/user-event` is a declared dependency, so this import resolves on purpose
rather than by accident → `environment.md`.

## What to assert

**For a component, the rendered DOM *is* the observable state.** Assert what the user would see.

```ts
expect(screen.getByRole('button', { name: 'toolbar.save' })).toBeDisabled();
expect(await screen.findByRole('status')).toHaveTextContent('toolbar.changes');
```

The exceptions, both narrow:

| case | assert | why |
|---|---|---|
| a callback prop (`onSave`, `onSelect`) | `toHaveBeenCalledWith` | the call *is* the effect — there is no state inside the component to observe. This is the fire-and-forget exemption in the main skill's clause 5 |
| the component fetches or writes on its own | the fake's state | the operation must be shown to have reached the boundary → `setDataClient(new FakeDataClient())` |

Never assert on a component's internals — the hook it happens to call, a state variable, a class
name. Those are how it works, not what it does. If the only way to verify a behaviour is by reading
internals, the behaviour has no user-visible effect, and it is worth asking whether it should exist.

### The hook carve-out

**A hook tested on its own is not an internal — its return value is its public interface.** The
prohibition above is on reaching *through a component* to the hook it uses. A `renderHook` test
addresses the hook directly, and a hook has nothing else to assert.

```ts
// the hook's contract: what it returns, and how that changes when it is acted on
const { result } = renderHook(() => useCatalogFilter(), { wrapper: QueryProvider });

await act(() => result.current.select(CATALOG_ID));

expect(result.current.selectedCatalogId).toBe(CATALOG_ID);
```

These rules are the whole of it:

| rule | why |
|---|---|
| `renderHook` puts the file in the **DOM tier** | it mounts a React tree; the name carries `.test.tsx`, or `.dom.test.ts` when there is no JSX |
| assert the returned value and its transitions, never a ref into React's internals | the return value is the contract; anything else is the library's business |
| a hook needing context gets a **real** provider through `wrapper` | the same ownership boundary as a component: ours renders, third-party is substituted |
| a hook that only wraps a library call gets no test | that is testing TanStack Query → `what-not-to-test.md` |

A hook reached only through the component that uses it needs no separate test — the component test
covers it, and the hook's own file would assert the same behaviour twice.

## The query client

**A test-rendered `QueryClient` disables retries, and it comes from one helper.**

```ts
// src/test/renderWithProviders.tsx — the providers a case needs, and nothing else
const testQueryClient = () =>
  new QueryClient({
    // A retry inside the query client is the same defect as a retry count on the runner: a real
    // failure goes green on the second attempt, and the case pays the wait either way.
    defaultOptions: { queries: { retry: false } },
  });
```

Where TanStack Query is the repository's server-state layer, this is the first decision a developer
makes when they render a real component tree — not an edge. A client constructed inline in each file
is the translation double's twin: the same block copied everywhere, free to drift one file at a time.
A bare `QueryClient` whose failures retry is the shape to look for, and the fix belongs with the
helper.

**The helper does not exist yet, so criterion 10 of this page is not met today and a new test does
not meet it either.** `src/test/renderWithProviders.tsx` lands with `src/test/` itself — main skill
§8 step 2. Until then the case constructs the client in its own file, once per file, marked as the
interim it is:

```ts
// INTERIM component-tests.md criterion 10 — the shared helper lands with src/test/, main skill §8.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
```

## The client store

**A module-level store is reset per case, from its own initial state.** Where Zustand is the
client-state layer, the other half of clause 8 lands here: a store hangs off a module that loads
once, so what one case writes into it is still there for the next.

```ts
beforeEach(() => {
  // The store's own initial state, actions included. Replace, never merge.
  useNoticeStore.setState(useNoticeStore.getInitialState(), true);
});
```

**`getInitialState()` is the seam the store itself offers.** A store that exposes no reset action
leaves nothing else to call there. Probe it once on your own Zustand version: the state comes back to
what `create()` produced, the actions survive the replace, and it typechecks.

**A store may expose a domain `clear()`, and that is not a reset seam.** `useCartStore.clear()` and
`useSessionStore.clearSession()` are written against the fields their store has today, so each drifts
from the initial state the day one field is added. `getInitialState()` cannot drift, which is why it
is the seam this page names even on a store that offers both.

**The replace restores the initial-state object itself, by reference.** Zustand closes over one
object and `getInitialState()` hands that same object back, so this resets a store whose actions
*replace* state and not one that mutates it in place: a case that did `state.pinned.add(id)` mutated
the initial object, and the reset restores the polluted one. Check that every store replaces — a
store like `cart.store.ts` that copies its `Set` on every action is safe here. A
store holding a mutable collection must keep it that way, because the failure is silent and surfaces
in another file.

**A hand-listed reset is a defect waiting to happen.** `useCartStore.setState({ lines: [], pinned:
new Set() })` silently stops resetting on the day a field is added to the store, and nothing reports
that. Replace each one with the initial-state form.

**The `beforeEach` goes in the test file, or in a helper the test file imports — never in a shared
setup file.** A setup file that imports a production module resolves it before any test file's
`vi.mock` is registered, and takes down files that never opted in → `execution-tiers.md`. That is the
same reason the data-client reset lives in a helper → main skill, clause 6. It matters more if
`isolate: false` is ever pulled: module-level state then leaks across files too, and this reset is
all clause 8 would have left.

## Async

**Prefer `findBy*` over `waitFor` + `getBy*`.** They do the same polling; `findBy*` produces a
failure message naming the element that never appeared, while a `waitFor` wrapper reports the
assertion that kept throwing.

```ts
// good
expect(await screen.findByRole('row', { name: /ORD-0007/ })).toBeInTheDocument();

// worse — same wait, poorer failure
await waitFor(() => expect(screen.getByRole('row', { name: /ORD-0007/ })).toBeInTheDocument());
```

Reserve `waitFor` for a condition that is not "an element appeared" — a fake's state settling, a
count stabilising.

Prohibitions:

1. **No arbitrary sleeps.** `await new Promise(r => setTimeout(r, 100))` is a bet on a machine's
   speed, and it is lost on a loaded CI runner.
2. **No side effects inside `waitFor`.** The callback runs many times; a click inside it clicks
   many times.
3. **Do not raise a timeout at a call site.** `asyncUtilTimeout` is already set globally, for a
   documented reason. A case that needs more is waiting on the wrong thing.

With fake timers, `userEvent` must be told about them, or its internal delays never resolve:

```ts
vi.useFakeTimers();
const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
```

## What belongs in a story instead

Where a repository requires a story per component, that is not duplicate work: appearance belongs to
the story, behaviour to the test. A purely presentational component gets a story and **no** test. The
boundary, and everything else that should not be tested → `what-not-to-test.md`.

## Acceptance criteria

### Mechanically checked

The columns are the main skill's: `check` is the command, `runs unattended` is whether anything
executes it without being asked.

| # | criterion | check | runs unattended |
|---|---|---|---|
| 1 | No test file imports from `storybook/test` | `grep -rn "from 'storybook/test'" --include='*.test.ts*' src` | no — hand-run; it becomes `no-restricted-imports` when the lint block is armed |
| 2 | No test reaches the DOM through `container` or `querySelector` | `grep -rn -e 'container\.' -e 'querySelector' --include='*.test.tsx' src` | no — hand-run; it becomes `no-container` / `no-node-access` with the same block |
| 3 | No test substitutes a component we own | `grep -rn -e "vi\.mock('\./" -e "vi\.mock('\.\./" --include='*.test.tsx' src` | yes — review gate pattern `test-mocks-own-component`, on the diff |
| 4 | Every `userEvent` call is awaited | `eslint-plugin-testing-library`, rule `await-async-events` | no — the plugin is installed, the config block is not armed |
| 5 | No `getBy*` inside `waitFor` | same plugin, rule `prefer-find-by` | no — same block |
| 9 | A hook test renders in the DOM tier | it passes under `--project dom` and its name says so | with the tier split |
| 10 | A test-rendered `QueryClient` disables retries and comes from the shared helper. **Not met today, and a new test does not meet it either**: `src/test/renderWithProviders.tsx` does not exist, so the retry half is what a new test owes, marked `// INTERIM component-tests.md criterion 10` → main skill §8 | `grep -rn "new QueryClient(" --include='*.test.tsx' src` — every hit is the helper, or an interim marked as one | no — hand-run |

The repeated `-e` in criteria 2 and 3 of this page is deliberate and must not be tidied into a pipe — the reason
is stated once, in the main skill's §5.

Criteria 4 and 5 of this page are one config block away from being gates: both plugins are installed, and the
block is written out in `environment.md`. Arming it also enforces criterion 2 of this page through
`no-container`, `no-node-access` and `prefer-screen-queries`.

### Reviewed

| # | criterion | what the reviewer looks for |
|---|---|---|
| 6 | Interactive elements are queried by role or label, not by test id | a `ByTestId` needs a comment naming the missing accessible handle |
| 7 | Assertions describe what a user perceives — or, for a hook test, its returned contract | never a class name, never a component's hook read from outside |
| 8 | A substituted third-party widget exposes the role the real one exposes | the stub keeps the accessibility handle |
| 11 | A case that writes to a module-level store resets it from the store's initial state, in the file or in a helper the file imports | a reset that lists fields by hand, and any store reset in a shared setup file |
