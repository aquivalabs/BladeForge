---
description: Use when about to add, hand-roll, rename, move, or remove a custom React `use*` hook.
---

# React Hooks Registry & Reuse

## When to Activate

- About to create, scaffold, or hand-roll any custom hook (a `use*` function).
- Renaming, moving, or deleting an existing hook.
- Reviewing a diff that adds/changes hooks (reviewer agents read the registry to
  catch duplicates and mis-placed hooks).

The registry is `docs/hooks-registry.md` — the authoritative list of every custom
hook in the app.

---

## Instructions

### Before creating a hook — reuse first

1. **Read `docs/hooks-registry.md`.** If a hook already does this (or nearly does),
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

In the **same change**, edit `docs/hooks-registry.md`:

- **Added** → add a row (Hook · File · one-line Purpose) in the right section.
- **Renamed / moved** → update the name/file in its row.
- **Removed** → delete its row.
- **Promoted local → global** → move its row from "Local hooks" to "Global hooks".

A new `use*` file in a diff with no matching registry update is a review finding.

---

## Checklist

- [ ] Read `docs/hooks-registry.md` before writing a new hook
- [ ] Reused/extended an existing hook if one fit
- [ ] Placed the hook by scope (global / capability / library / local)
- [ ] Promoted + generalized any local hook that gained a second consumer
- [ ] Updated `docs/hooks-registry.md` in the same change
