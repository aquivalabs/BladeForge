---
description: "Use when setting up, changing or running the toolchain of a Vue project — ESLint with eslint-plugin-vue and typescript-eslint, Prettier, Stylelint with the BEM selector pattern, vue-tsc type checking, the one `npm run check` that runs all of them with the tests, the pre-push hook or CI job that gates a merge on it, or when lint, format and type errors conflict or a rule needs turning on or off. NOT for writing the tests themselves (frontend-vue:testing) nor for the style rules' content (frontend-vue:bem-styles, frontend-js:conventions)."
---

# Vue toolchain and the merge gate

## Contract

**In:** a Vue 3 project with Vite (or Nuxt) and TypeScript.

**Out:** ESLint, Prettier, Stylelint and `vue-tsc` are configured from the templates in
`references/`, never from scratch; `npm run check` runs types, lint, style lint and tests in one
command and exits non-zero on any failure; the pre-push hook or the CI job runs it before a merge.
The checkable expectations are in `evals/rubric.json`.

---

## Install once

```bash
npm i -D eslint @eslint/js typescript-eslint eslint-plugin-vue eslint-config-prettier vue-eslint-parser \
  prettier stylelint stylelint-config-standard stylelint-config-standard-scss stylelint-config-html \
  vue-tsc typescript vitest @vue/test-utils @testing-library/vue jsdom
```

Add only what the project uses: drop the SCSS config for plain CSS, `@nuxt/eslint` replaces the
ESLint parts in a Nuxt project.

## The four configs

Copy from `references/` and adjust the paths; each file carries the house rules already:

| File | What it holds |
|---|---|
| `references/eslint.config.js` | flat config: `eslint-plugin-vue` recommended, `typescript-eslint` recommended, the `frontend-js:conventions` rules that have an ESLint form (arrow functions, single quotes, braces, no abbreviations through `id-length` with exceptions), Prettier last to switch off formatting rules |
| `references/.prettierrc.json` | single quotes, trailing commas, 100 columns, no semicolons removed (semicolons stay) |
| `references/stylelint.config.js` | `standard` (and `standard-scss`), `stylelint-config-html` for `.vue`, `selector-class-pattern` with the BEM pattern from `frontend-vue:bem-styles`, no `!important`, no id selectors |
| `references/package-scripts.md` | the `scripts` block: `check`, `lint`, `lint:style`, `typecheck`, `test`, `format` |

Rules: ESLint and Prettier never overlap (Prettier owns formatting, `eslint-config-prettier` is
last); `vue-tsc --noEmit` is the type check for `.vue` files (`tsc` alone skips them); Stylelint
runs on `.vue`, `.css` and `.scss`.

## The one command

```json
"check": "vue-tsc --noEmit && eslint . && stylelint \"src/**/*.{vue,css,scss}\" && vitest run"
```

`frontend:fe-check` runs `vue-tsc` instead of `tsc` when it finds it, so its one-block summary works
here too; `npm run check` is the merge gate, wired in `.githooks/pre-push` (with
`git config core.hooksPath .githooks` from `npm run prepare`) and in CI on pull requests.

## When a rule fights the code

1. Decide whether the code or the rule is wrong; the house rules win over habit.
2. Turn a rule off only with a comment that says why, in the config, never with a file-wide
   `eslint-disable`.
3. Formatting conflicts are always a Prettier setting, never an ESLint rule.

---

## Before you finish

1. `npm run check` → exit 0, four stages printed.
2. `cat .githooks/pre-push` (or the CI workflow) → it runs `npm run check`.
3. `npx eslint --print-config src/App.vue | grep -c prettier` → Prettier is in the resolved config
   (formatting rules are off).
