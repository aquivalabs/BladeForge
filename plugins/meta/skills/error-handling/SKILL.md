---
description: Use when adding or handling any error path on any layer — throwing from a service/route/controller, mapping an upstream failure, or reading an error on the client (backend or frontend).
---

# error-handling — one error format everywhere

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
