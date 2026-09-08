---
description: "Use when defining, adopting, or reviewing a client/UI app's WHOLE error-handling architecture — where every failure surfaces and how adherence is checked — across any framework (React, Vue, Angular, Svelte). Triggers on \"design our app-wide error handling\", \"is our error handling consistent / does this codebase follow one pattern\", \"audit how errors are shown\", \"we map error codes to UX in a dozen places\", \"one place to decide retry vs redirect vs toast\", or reviewing a diff for error-surfacing consistency. Foreground: the single code→UX policy table that classifies every error once. NOT for wrapping one component in a boundary or styling one error tile (that is your framework's component/primitive skill), and NOT for the wire envelope or reason-code vocabulary (that is error:format)."
---

# Client error architecture — one classifier, many channels

How a client app **surfaces** an error, stated in role names and bound to each framework. The
counterpart to `error:format`: that skill says what an error *is* on the wire; this one says how the
UI *shows* it. The whole pattern is framework-independent except one primitive (catching a render
throw), which a binding table maps onto each framework.

## Contract

**In:** defining, adopting, or reviewing a client/UI app's WHOLE error-handling architecture — where
every failure surfaces and how adherence is checked, across any framework.

**Out:** exactly one code-to-UX classifier table, every error surfaced through the state-dispatcher and
the one shared renderer, every fallible subtree bounded, and adding a new code touching only the table
and its i18n keys. The checkable expectations are in `evals/rubric.json`.

---

## Prerequisite (hard): `error:format`

Apply `error:format` FIRST. It owns the `status` (canonical enum) + `reason` (app code) vocabulary
this skill's policy table keys off, and the central registry that makes the reason set **enumerable**
(the enumeration is what makes "add a new code" a table-only edit — see criterion 11). `needs:
[error:format]`. No vocabulary yet? See **Bootstrap** below — this skill does not dead-end.

## The two-axis model

Every error has an **arrival channel** (how it reaches the UI) and a **placement** (where the user
sees it). Placement is fixed per channel — a component never chooses:

| Arrival channel | Prescribed placement | Role that catches it |
|---|---|---|
| Render throw | **block** — tile inside the nearest boundary | boundary at that tier |
| Read / query error | **block** — tile in the view's own region | state-dispatcher |
| Write / mutation error | **toast** — transient, non-blocking | mutation channel → toast |
| Router loader/action error *(if a router)* | **page** — route error element | route error element |
| Uncaught async (rejection / global) | **page** — the floor | global handler → outer floor |

Placements: **page** (whole view) · **block** (one region, siblings survive) · **toast** (transient) ·
**redirect** (session/auth escalation — see the renderer role).

## The single classifier — one code→UX policy table

Exactly ONE table maps `reason`/`status` → UX. It is the SOLE place that decides copy, retry-ness,
placement, and escalation. No component maps a code on its own. Shape (one row per reason):

| `reason` | `status` | placement | copy key (i18n) | retryable | escalate |
|---|---|---|---|---|---|
| `Pkg__RATE_LIMITED` | `UNAVAILABLE` | block | `err.transient` | yes | no |
| `Pkg__INSUFFICIENT_ACCESS` | `PERMISSION_DENIED` | block | `err.forbidden` | no | no |
| `Pkg__SESSION_EXPIRED` | `UNAUTHENTICATED` | redirect | `err.session` | no | yes |
| `*` (fallback) | any | block | `err.generic` | no | no |

Copy is a **key**, never literal text — resolved through the i18n layer (see cross-references).

## The four consumer roles

1. **State-dispatcher** — the one component every data-fetching view renders through. It walks
   `loading → error → empty → data` and hands any error to the error-tile renderer. **Empty is not an
   error**: a 200 with no rows renders the empty branch, never an error tile.
2. **Error-tile renderer** — the ONE shared component that draws a classified error (looks up the row,
   resolves the copy key, offers retry only when the row says retryable). **It owns escalation**: the
   session-end/redirect side effect fires from an effect *inside this renderer*, exactly once, no matter
   which channel produced the error — no call site invokes it. *(Conditional: only if the app has a
   session/auth concept. An auth-less app carries no escalation effect and satisfies this vacuously.)*
3. **Boundary tiers** — every fallible subtree sits inside a boundary at its tier (page, section,
   block). The nearest enclosing boundary handles a throw; nesting gives precedence to the inner one.
   "Fallible" = any subtree that calls a data hook or uses lazy/deferred loading.
4. **Outer floor** — exactly one outermost boundary catches what tier boundaries cannot, including
   throws in the app shell itself. *(If a router: it sits above the router. Router-less: one top-level
   boundary is the floor.)*

## Framework binding — the ONLY framework-specific primitive

The pattern is role-named above. Only "catch a render throw" differs per framework; bind it:

| Role | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| Catch a render throw | Error Boundary component (`getDerivedStateFromError`) | `onErrorCaptured` hook | global `ErrorHandler` provider | `<svelte:boundary>` |

Dispatcher, renderer, policy table, floor, toast channel, and the escalation effect are plain
framework-agnostic modules — write them once in your stack's idioms.

## No raw I/O in render

A render path never issues a fetch/DML directly. *(If the app uses a query lib: reads go through the
query layer, writes through the mutation channel.)* **Query-less escape hatch:** an app without a query
lib routes all reads/writes through ONE designated data-access seam — still never raw I/O in render.

## Bootstrap — no error vocabulary yet?

If the app has no reason-code system, do not stall. Propose a **minimal seed**: four reasons — a
retryable-transient, a permission-denial, a session/auth-expiry, and a generic fallback — enough to fill
the policy table's rows and stand the pattern up. Then defer the FULL scheme (registry, message
dictionary, normalization) to `error:format` — the seed is a starting point, not a replacement for that
authority.

## Cross-references

- **`error:format`** — the wire envelope + reason/`status` vocabulary + enumerable registry (prerequisite).
- **`i18n:ui-strings`** — every copy key in the policy table resolves through the localization layer;
  criteria 2 and 11 turn on copy being i18n keys, so own copy there, not here.
- **Your framework's component/primitive skill** (e.g. `frontend-react:ui-primitive-reuse`) — the concrete
  visual tiles/presets the renderer draws. This skill owns only the code→preset MAPPING, not the components.

## Before you finish

1. Exactly one code-to-UX policy table owns classification; no component maps a code to copy, retry, or
   escalation itself, and no raw `error.message`/status is rendered — strings resolve from the table via
   an i18n key.
2. Every data view renders through the state-dispatcher (loading -> error -> empty -> data), the shared
   renderer alone owns escalation, every fallible subtree is bounded with correct nesting/floor, and
   channel -> placement is fixed for the channels the app uses.
3. The architecture test passes: adding a new error code touches ONLY the policy table and its i18n
   keys — zero component changes.
4. A criterion fails? Fix it and re-check. Full expectations → `evals/rubric.json`.

## Worked example (framework-neutral pseudocode; render-throw bound to Vue)

Demo app `myOrg` lists `Order__c` records from `/api/items`. This shows criteria **1, 2, 4, 11**.

**One classifier (criterion 1)** — the sole table, keyed off `error:format`'s reason vocabulary:

```
// policy.ts — the ONE classifier. No view imports anything else to decide UX.
const POLICY = {
  Pkg__RATE_LIMITED:       { placement: 'block',    copyKey: 'err.transient', retryable: true,  escalate: false },
  Pkg__INSUFFICIENT_ACCESS:{ placement: 'block',    copyKey: 'err.forbidden', retryable: false, escalate: false },
  Pkg__SESSION_EXPIRED:    { placement: 'redirect', copyKey: 'err.session',   retryable: false, escalate: true  },
};
const FALLBACK = { placement: 'block', copyKey: 'err.generic', retryable: false, escalate: false };
export const classify = (err) => POLICY[err.reason] ?? FALLBACK;
```

**Shared renderer owns escalation (criteria 2 + 4)** — copy is an i18n key, never `err.message`; the
session-end call lives ONLY here:

```
// FaultTile — the one renderer. render-throw catch is bound to Vue's onErrorCaptured upstream.
function FaultTile({ err, onRetry }) {
  const rule = classify(err);
  useEffect(() => { if (rule.escalate) endSession(); }, [rule.escalate]); // <- only call site of endSession
  return Tile({
    text: t(rule.copyKey),                                  // i18n key, not err.message
    action: rule.retryable ? RetryButton(onRetry) : null,
  });
}
```

**Dispatcher + Vue boundary binding** — reads flow through the dispatcher; a render throw is caught by
`onErrorCaptured`, which routes the caught error to the same `FaultTile`:

```
// WidgetConfig-driven order list. No raw fetch in render; empty ≠ error.
const OrderList = defineComponent({
  setup() {
    onErrorCaptured((thrown) => { state.boundaryError = normalize(thrown); return false; }); // Vue render-throw binding
    const { status, data, error, refetch } = useOrders('/api/items');   // query layer, not raw I/O
    return () =>
      state.boundaryError ? FaultTile({ err: state.boundaryError })
      : status === 'loading' ? Spinner()
      : status === 'error'   ? FaultTile({ err: error, onRetry: refetch })
      : data.length === 0    ? EmptyState()                              // 200 + no rows: empty, NOT an error
      : OrderTable({ rows: data });
  },
});
```

**The architecture test (criterion 11).** Product adds `Pkg__PAYMENT_REQUIRED`. The whole change:

```
// policy.ts — one row added:
Pkg__PAYMENT_REQUIRED: { placement: 'block', copyKey: 'err.payment', retryable: false, escalate: false },
// en.json — one i18n key added:
"err.payment": "This action needs an active plan."
```

`OrderList`, `FaultTile`, and every other component are untouched. New codes are pure table + i18n
edits — the pattern holds.
