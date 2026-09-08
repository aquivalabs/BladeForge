---
description: "Route every user-facing UI string through the project's localization system instead of hardcoding it. Activate whenever writing or editing display text a user will see — labels, buttons, messages, errors, toasts, placeholders, empty states, flavor copy — in any project and any stack. Do NOT use for text a user never reads: log lines, internal error codes, test fixtures, code identifiers, enum keys, slugs, or proper-noun/canonical identifiers (those stay as plain data)."
---

# i18n / UI-string localization

## Contract

**In:** a human-readable string a user will see, about to be introduced or edited in a component,
page, or template.

**Out:** the string lives in the project's localization mechanism — an existing i18n catalog/namespace,
a Salesforce Custom Label, or a proposed constants module — and is referenced through that API, never
hardcoded; identifiers and proper nouns stay as plain data. This IS the acceptance criteria for the
change.

---

## Instructions

Before hardcoding a string literal, find where strings belong and put it there.

### 1. Detect the localization mechanism (in this order)

1. **Salesforce project** (`sfdx-project.json`, `.cls`, LWC bundles, `force-app/`) → this is the EXCEPTION: do **not** add a JS i18n library. Use **Custom Labels** — `System.Label.MyLabel` (Apex) / `import LABEL from '@salesforce/label/c.MyLabel'` (LWC). Follow the org's existing label convention.

2. **Existing i18n in the repo** — detect via dependencies, config, and locale folders:
   - JS/TS: `i18next`/`react-i18next`, `vue-i18n`, `next-intl`/`next-i18next`, `react-intl`/FormatJS, `@angular/localize`, `svelte-i18n`, `lingui`
   - Locale dirs/files: `locales/`, `i18n/`, `*.json` message catalogs, `*.po`/`.pot` (gettext), `*.arb` (Flutter), `*.strings`/`.xcstrings` (iOS), `strings.xml` (Android), `config/locales/*.yml` (Rails)
   - If found → **add the string to the matching catalog/namespace and reference it through the existing API.** Match the project's namespacing pattern (per-feature / per-page). Reuse an existing key if one already covers it; never duplicate.

3. **Known framework, no i18n wired yet** → follow that framework's idiomatic i18n approach. Add the minimal setup and mention it to the user rather than scattering literals.

4. **Can't tell / ambiguous** → **ask the user**: "Does this project have localization, and where are UI strings stored?" Don't guess and hardcode.

5. **Nothing exists and none is wanted** → propose, don't silently hardcode:
   - a single **constants/strings module** (an exported object of strings), or
   - adding a **lightweight i18n** (e.g. `i18next` for plain JS/TS).
   Pick the lighter option for prototypes; centralize either way.

### 2. Identifiers vs prose

Translate **prose** (sentences, labels, descriptions). Keep as plain **data**:
- proper nouns / brand / canonical names (e.g. character names, product names)
- enum keys, slugs, ids, config keys, machine values

Resolve prose by id from the catalog (e.g. `t('characters.' + id + '.role')`) while the id/name stay in code/data.

### 3. After adding strings

- Register any new namespace/catalog with the i18n init if required.
- Verify the key resolves (build/typecheck) — a missing key usually renders the raw key, which is a visible bug.

---

## Before you finish

1. Grep the files you changed for a hardcoded user-facing literal in markup —
   `grep -nE ">[A-Z][a-z].*<|=\"[A-Z][a-z][^\"]+\"" <files>` — and read each hit: prose a user
   reads must go through the i18n API, not sit as a literal.
2. Confirm each new string: added to the catalog/namespace (or a Custom Label on Salesforce),
   referenced through the API, an existing key reused where one covered it, and identifiers/proper
   nouns left as data.
3. The new namespace is registered and the key resolves at build/typecheck — a missing key renders
   the raw key, a visible bug.
4. Anything hardcoded or unresolved? Fix it and return to step 1.
