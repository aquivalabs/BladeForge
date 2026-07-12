---
description: House rules for developing Salesforce Lightning Web Components (LWC) and Aura — the .js controller, .html template, .js-meta.xml, and CSS of a bundle, plus every LWC authoring idiom. Use whenever creating or editing an LWC/Aura bundle or writing any Salesforce-side frontend JS — including adding an @api or @track property, wiring an @wire to an Apex class, emitting or handling a custom event, a lifecycle hook, DOM access (querySelector), styling a component (CSS custom properties, scss→css conversion), or writing the js-meta.xml targets / isExposed config.
---

# Salesforce LWC Development

House standard for working with Lightning Web Components and Aura.

General JS/TS style applies here too (arrow functions, single quotes, full
variable names, braces for all control structures, small readable functions) —
see `frontend-js:conventions`. This skill adds the LWC-specific rules.

## DOM access

- Never touch the global DOM (`document`, `document.body`, global `window` DOM
  queries, etc.).
- Query and mutate the DOM only through `this.template`
  (e.g. `this.template.querySelector(...)`) and the component's own public APIs.

## Styling

- Do **not** use SCSS in LWC. Style through the component's own CSS file and use
  CSS custom properties (`var(--token)`) for shared values.
- Plain-web / React styling (SCSS, modules) lives in `frontend-css:scss-modules`.
