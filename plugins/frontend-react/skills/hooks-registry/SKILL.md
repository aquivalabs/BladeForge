---
description: Use when about to add, hand-roll, rename, move, or remove a custom React `use*` hook.
---

# React Hooks Registry & Reuse

## Contract

**In:** about to add, hand-roll, rename, move, or remove a custom React `use*` hook. The registry is
`docs/mechanisms/hooks-registry.md` — the authoritative list of every custom hook in the app.

**Out:** the registry was read and an existing hook reused/extended where one fit; a genuinely-new hook
placed by scope; a local hook that gained a second consumer promoted and generalized; and the registry
updated in the SAME change. The checkable expectations are in `evals/rubric.json`.

---

## Instructions

### Before creating a hook — reuse first

1. **Read `docs/mechanisms/hooks-registry.md`.** If a hook already does this (or nearly does),
   reuse it or extend it (one more param / option) instead of writing a new one.
   Duplicate/overlapping hooks are the thing this registry exists to prevent.
2. Only create a new hook when reuse and extension both genuinely fail.

### Placement (where the new hook lives)

- **Global** → `src/hooks/` — used (or reusable) across more than one feature/page.
- **Capability flag** → `src/hooks/capabilities/` — boolean org/user capability.
- **Library** → `src/lib/<area>/` — internal to one lib module.
- **Local** → next to the feature/page — ONLY while it has a single consumer. The
  moment a second page/feature uses it, **promote it to `src/hooks/` and generalize**
  (strip page-specific assumptions). This mirrors `frontend-react:component-placement`.

> Stores live in `src/stores/` and are NOT hooks — do not add them to the registry.

### After adding / renaming / moving / removing a hook — update the registry

In the **same change**, edit `docs/mechanisms/hooks-registry.md`:

- **Added** → add a row (Hook · File · one-line Purpose) in the right section.
- **Renamed / moved** → update the name/file in its row.
- **Removed** → delete its row.
- **Promoted local → global** → move its row from "Local hooks" to "Global hooks".

A new `use*` file in a diff with no matching registry update is a review finding.

---

## Before you finish

1. `docs/mechanisms/hooks-registry.md` was read before writing a new hook, and an existing hook was reused or
   extended where one fit — no duplicate or overlapping hook was created.
2. The hook is placed by scope: global `src/hooks/`, capability `src/hooks/capabilities/`, library
   `src/lib/<area>/`, or local next to the feature — and a local hook that gained a second consumer was
   promoted to `src/hooks/` and generalized.
3. `docs/mechanisms/hooks-registry.md` was updated in the SAME change — a row added / renamed / moved / removed to
   match.
4. A line fails? Fix it and re-check. Full expectations → `evals/rubric.json`.
