---
description: House rules for developing Salesforce Lightning Web Components (LWC) and Aura — the .js controller, .html template, .js-meta.xml, and CSS of a bundle, plus every LWC authoring idiom. Use whenever creating or editing an LWC/Aura bundle or writing any Salesforce-side frontend JS — including adding an @api or @track property, wiring an @wire to an Apex class, emitting or handling a custom event, a lifecycle hook, DOM access (querySelector), styling a component (CSS custom properties, scss→css conversion), or writing the js-meta.xml targets / isExposed config.
---

# Salesforce LWC Development

House standard for working with Lightning Web Components and Aura.

General JS/TS style applies here too (arrow functions, single quotes, full
variable names, braces for all control structures, small readable functions) —
see `frontend-js:conventions`. This skill adds the LWC-specific rules.

**LWC exception to that JS style:** a controller / event-handler / lifecycle method is a standard
ES class method, NOT an arrow-bound class field — arrow functions apply to callbacks and helpers,
never to the component class's own methods.

## Contract

**In:** an LWC or Aura bundle being created or edited — the `.js` controller, `.html` template,
`.js-meta.xml`, or CSS — or any Salesforce-side frontend JS.

**Out:** the DOM is touched only through `this.template` (never the global `document`/`window`),
styling goes through the component's own CSS with CSS custom properties (no SCSS), and the house
JS/TS conventions hold. The checkable expectations are in `evals/rubric.json`.

---

## DOM access

- Never touch the global DOM (`document`, `document.body`, global `window` DOM
  queries, etc.).
- Query and mutate the DOM only through `this.template`
  (e.g. `this.template.querySelector(...)`) and the component's own public APIs.

## Styling

- Do **not** use SCSS in LWC. Style through the component's own CSS file and use
  CSS custom properties (`var(--token)`) for shared values.
- Plain-web / React styling (SCSS, modules) lives in `frontend-css:scss-modules`.


---

## Before you finish

1. `grep -nE "\bdocument\.|window\.[a-z]" <the bundle>` → no global DOM access; every query/mutation
   goes through `this.template` and the component's own public APIs.
2. No SCSS in the LWC — styling is the component's own CSS file, shared values via `var(--token)`.
3. The house JS/TS conventions hold (arrow functions, single quotes, full names, braces, small
   functions) — see `frontend-js:conventions`.
4. A rule broken? Fix it and re-check. Full expectations → `evals/rubric.json`.
