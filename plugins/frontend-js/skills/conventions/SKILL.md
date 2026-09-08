---
description: House JavaScript/TypeScript coding style — arrow functions, single quotes, full variable names (not sel/fn/e), braces on all control structures, small readable functions, and imports (a registered path alias always beats a ../../../ relative import; register one @alias per top-level dir in vite + tsconfig). Use whenever writing, editing, or reviewing JS/TS (React, Node, any JS/TS) — including renaming a variable to a full name, breaking up a long function, converting quotes or adding braces, replacing a deep relative import with an alias, registering a new @alias, or a pre-push style review. NOT for SCSS/styling (frontend-css:scss-modules), scaffolding a component's folder (frontend-react:component-structure), i18n strings, or Apex.
---

# JS / TS Conventions

House style for all JavaScript and TypeScript. Apply on every JS/TS edit.

## Contract

**In:** a JavaScript or TypeScript file being written, edited, or reviewed — React, Node, any JS/TS.

**Out:** the code holds the house style — arrow functions, single quotes, full descriptive names,
braces on every control structure, small single-responsibility functions, and every import that a
registered alias covers goes through the alias, never `../../../`. This IS the acceptance criteria:
the property the changed code must hold.

---

- Prefer **arrow functions** wherever possible.
- Use **single quotes** for strings.
- Use **full, descriptive variable names** — no abbreviations
  (`errorMessage` not `errMsg`, `selectedRecord` not `selRec`).
- Always use braces `{}` for **all** control structures (`if`, `else`, `for`,
  `while`, ...), even for a single-line body.
- Write functions a stranger to the code can understand:
  - one function = one clear responsibility;
  - extract helper functions with descriptive names instead of long inline logic — but NOT a
    trivial one-liner (a single regex/match/format): extraction is for genuine reuse or a named
    concept, not for its own sake, and a near-duplicate helper name is a smell, not a win;
  - avoid clever one-liners when a readable multi-line form is clearer.

## Imports — prefer aliases over relative paths

- **A registered path alias always beats a relative import.** Never climb with
  `../../../` when an alias exists — use it. Absolute (alias) > relative, always.
- **Register a central alias for every shared / top-level directory**, then import
  through it. Wire each alias in BOTH the bundler (e.g. Vite `resolve.alias`) AND the
  tsconfig `paths` (with `baseUrl`) — for EVERY tsconfig, client and server, so
  type-check and runtime agree.
- Register one alias per top-level dir (e.g. `@` = src root, `@shared`, `@components`, `@lib`,
  `@stores`, `@config`, `@i18n`, `@hooks`, `@pages`, `@api`, `@utils`) — add it the moment
  you create the directory. **Avoid `@types`**: it collides with TypeScript's built-in `@types/`
  (DefinitelyTyped) resolution — alias the types dir through the base `@/types` instead.

For Salesforce LWC / Aura-specific rules (DOM access, styling) see
`salesforce-lwc_development`.


---

## Before you finish

1. In the files you changed, check the mechanical rules by eye or grep:
   - `grep -nE "\"[^\"]*\"" <files>` → strings are single-quoted (allow a double quote only to
     avoid escaping an inner `'`).
   - `grep -nE "\.\./\.\./" <files>` → no `../../` climb where a registered alias covers the path.
   - every `if`/`else`/`for`/`while` has braces, even a one-line body.
2. Read the changed functions: names are full words (`errorMessage`, not `errMsg`); each function is
   one responsibility; long inline logic is pulled into a named helper.
3. A rule broken? Fix it and return to step 1. You are done only when every line holds.
