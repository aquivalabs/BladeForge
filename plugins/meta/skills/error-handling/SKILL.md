---
description: Use when adding or handling any error path on any layer — throwing from a service/route/controller, mapping an upstream failure, or reading an error on the client (Apex, Node/BFF, or frontend).
---

# error-handling — one error format everywhere

Errors follow the **Google AIP-193 / `google.rpc.Status`** standard (RFC 9457 lineage) on every
layer — Apex, the BFF, and the client all use the SAME envelope, so an error is handled identically
regardless of where it came from.

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
   error (e.g. Salesforce `Variable does not exist: tmpVar1`) must never leak.
3. **Register every new reason** in the registry doc in the SAME change.
4. **Frontend consumes by `status` / `reason`** (never a magic number); `message` is display text.

## Reference implementation (this org)

- Apex: `AcctSeedUI-SF/force-app/main/default/classes/ApiErrors.cls` + `AcctSeedUI-SF/docs/ERROR_CODES.md`.
- BFF: `Accounting-Seed-UI/server/lib/errors/` + `Accounting-Seed-UI/docs/backend/error-format.md`.
- Client reader: `Accounting-Seed-UI/src/lib/errors/apiError.ts` (`getApiError`).
