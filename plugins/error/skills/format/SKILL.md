---
description: Use when adding or handling any error path on any layer — throwing from a service/route/controller, mapping an upstream failure, or reading an error on the client (backend or frontend).
---

# error:format — one error format everywhere

Errors follow the **Google AIP-193 / `google.rpc.Status`** standard (RFC 9457 lineage) on every
layer — backend and frontend use the SAME envelope, so an error is handled identically regardless
of where it came from.

## The envelope

```json
{ "error": { "code": 403, "status": "PERMISSION_DENIED", "message": "…",
    "details": [
      { "@type": "ErrorInfo", "reason": "INSUFFICIENT_ACCESS",
        "domain": "…", "metadata": { } },
      { "@type": "DebugInfo", "detail": "…", "stackEntries": ["…"] }
    ] } }
```

- `code` HTTP int · `status` canonical enum (branch on this) · `message` human text.
- **App-specific code = `details[].ErrorInfo.reason`** — not a bespoke `name`/`codeNumber`.
- `DebugInfo` (raw message + stack) is **gated** (sandbox / dev only), never sent to a prod client.

## Rules

1. **One registry + dictionary per side.** If none exists, create it. A central module owns the
   catalog (`reason → status + http code`) and the message dictionary (`reason → text`, extracted so
   text isn't hardcoded / is i18n-ready). Each source maps its own failure to a `reason` via it.
2. **Normalize at the boundary.** Turn any raw/upstream failure into the envelope; a masked platform
   or framework error (raw driver text, a stack trace, internal identifiers) must never leak.
3. **Register every new reason** in the registry doc in the SAME change.
4. **Frontend consumes by `status` / `reason`** (never a magic number); `message` is display text.

## Acceptance criteria

A reviewer confirms an app follows THIS skill (the envelope + reason vocabulary) when every check
below holds. Each is objective and applies to any layer/stack.

1. **Envelope at every boundary.** Every error crossing a layer boundary (service/route/controller →
   transport → client) is the `google.rpc.Status` envelope `{ error: { code, status, message,
   details } }`. No boundary emits an ad-hoc shape such as `{ error: "some string" }` or a bare
   text/HTTP body — e.g. a failed `POST /api/items` returns the envelope, not a raw string.
2. **Branchable status + code.** `status` is one of the canonical enum values and `code` is its
   matching HTTP integer; a consumer can branch on `status` without parsing `message`.
3. **Exactly one reason registry.** One enumerable `reason` registry exists per side, and every
   app-specific failure resolves its `reason` there. Each `reason` maps to a `status` + an HTTP code
   in that one place — no call site mints a bespoke numeric/string code inline.
4. **reason lives in ErrorInfo.** App-specific codes appear only as `details[].ErrorInfo.reason`,
   never as a bespoke top-level `name` / `codeNumber` / sibling field.
5. **Normalized at the boundary.** Every raw/upstream failure is converted to the envelope where it
   crosses in; no raw driver text, stack trace, or internal identifier (e.g. a `Pkg__` platform
   error) leaks past it. `DebugInfo` appears only in sandbox/dev, never in a prod client response.
6. **Message text is dictionary-sourced.** Human `message` text comes from the `reason → text`
   dictionary (extracted, i18n-ready), not hardcoded string literals at throw sites.
7. **Client reads structurally.** The client branches on `status` / `reason` only; no code path keys
   off a `message` substring or a magic number to decide UX.
8. **One place to extend.** Adding a new failure (e.g. an `Order__c` lock on `myOrg`, or a rejected
   `WidgetConfig`) adds exactly one `reason` entry — registry + dictionary — in a single change; the
   reason is not duplicated across call sites or re-declared per layer.
