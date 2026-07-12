---
description: House JavaScript/TypeScript coding style — arrow functions, single quotes, full variable names (not sel/fn/e), braces on all control structures, small readable functions, and imports (a registered path alias always beats a ../../../ relative import; register one @alias per top-level dir in vite + tsconfig). Use whenever writing, editing, or reviewing JS/TS (React, Node, any JS/TS) — including renaming a variable to a full name, breaking up a long function, converting quotes or adding braces, replacing a deep relative import with an alias, registering a new @alias, or a pre-push style review. NOT for SCSS/styling (frontend-css:scss-modules), scaffolding a component's folder (frontend-react:component-structure), i18n strings, or Apex.
---

# JS / TS Conventions

House style for all JavaScript and TypeScript. Apply on every JS/TS edit.

- Prefer **arrow functions** wherever possible.
- Use **single quotes** for strings.
- Use **full, descriptive variable names** — no abbreviations
  (`errorMessage` not `errMsg`, `selectedRecord` not `selRec`).
- Always use braces `{}` for **all** control structures (`if`, `else`, `for`,
  `while`, ...), even for a single-line body.
- Write functions a stranger to the code can understand:
  - one function = one clear responsibility;
  - extract helper functions with descriptive names instead of long inline logic;
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
