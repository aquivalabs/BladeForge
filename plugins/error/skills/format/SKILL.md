---
description: "Use when adding or handling any error path on any layer — throwing from a service/route/controller, mapping an upstream failure, or reading an error on the client (backend or frontend). Do NOT use to design the whole app's error-handling architecture — the single code-to-UX policy table (error:architecture) — or to wrap one component in a boundary or style one error tile (your framework's component skill); this skill owns the wire envelope and the reason vocabulary."
---

# error:format — one error format everywhere

Errors follow the **Google AIP-193 / `google.rpc.Status`** standard (RFC 9457 lineage) on every
layer — backend and frontend use the SAME envelope, so an error is handled identically regardless
of where it came from.

## Contract

**In:** an error path being added or handled on any layer — a throw from a service/route/controller,
a mapping of an upstream failure, or reading an error on the client.

**Out:** the error travels as the `google.rpc.Status` envelope with a registry-resolved `reason`, raw
and upstream failures normalized at the boundary, and the client branching on `status`/`reason` — the
checkable expectations are in `evals/rubric.json`.

---

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

---

## Before you finish

1. Walk each error path you changed: does it emit the `google.rpc.Status` envelope at the boundary, or
   an ad-hoc `{ error: "string" }` / bare body? Every boundary must be the envelope.
2. Its app-specific code is a `details[].ErrorInfo.reason` resolved through the ONE registry — not a
   bespoke top-level field and not an inline magic number.
3. Raw/upstream text, stacks, and internal identifiers are normalized away at the boundary; `DebugInfo`
   is dev-only. The client branches on `status`/`reason`, never a `message` substring.
4. A new failure added exactly one `reason` entry (registry + dictionary) in this change.
5. Any check fails? Fix it and return to step 1. Full expectations → `evals/rubric.json`.
