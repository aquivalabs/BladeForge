# Directions to look in, by task

Examples of where a mature solution usually lives. Check the candidates against the comparison in
the skill's rung 5; none of these is a required dependency, and a newer, better-kept option replaces
an entry here the day it is found.

| Task | Platform first | Vue ecosystem | React ecosystem | Stack-neutral |
|---|---|---|---|---|
| Drag and drop, sortable lists | HTML drag events for the simplest case | vue-draggable-plus, SortableJS | dnd-kit, SortableJS | SortableJS |
| Tooltips, popovers, positioning | `popover` attribute, CSS anchor positioning where supported | Floating UI, Reka UI | Floating UI, Radix | Floating UI |
| Dialogs, menus, dropdowns, comboboxes | `<dialog>`, `popover` | Reka UI, Headless UI for Vue | Radix, Headless UI, React Aria | none worth it |
| Dates and numbers | `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `Temporal` where available | date-fns, Day.js | date-fns, Day.js | date-fns, Day.js |
| Composables and hooks | `AbortController`, `matchMedia`, `ResizeObserver` | VueUse | usehooks-ts, react-use | none |
| Forms and validation | native constraint validation | vee-validate with Zod or Valibot | React Hook Form with Zod | Zod, Valibot, Yup |
| Schema validation | JSON Schema with a validator | Zod, Valibot | Zod, Valibot | Zod, Valibot, Yup |
| Animation and transitions | CSS transitions, View Transitions API | Vue `Transition`/`TransitionGroup`, Motion for Vue | Motion, react-spring | Motion |
| Virtualised lists | none | TanStack Virtual, vue-virtual-scroller | TanStack Virtual, react-window | TanStack Virtual |
| Server state, caching, retries | `fetch` with an `AbortController` | TanStack Query for Vue | TanStack Query | none |
| Tables with sorting, filtering, grouping | a plain `<table>` for a small static one | TanStack Table | TanStack Table | TanStack Table |
| Debounce, throttle, clipboard, local storage | `setTimeout`, `navigator.clipboard`, `localStorage` | VueUse (`useDebounceFn`, `useClipboard`, `useLocalStorage`) | usehooks-ts | lodash-es for a single function |
| Markdown, sanitising | none | markdown-it plus DOMPurify | react-markdown plus DOMPurify | markdown-it, DOMPurify |
| Charts | none | ECharts, Chart.js | Recharts, ECharts | ECharts, Chart.js |

## Checks: the analyser before the lens

Where a rule about code is usually enforced, for the checks ladder in the skill. Which rules to turn
on, and with which exceptions, belongs to the stack's tooling or conventions skill, not here.

| Rule kind | JS / TS / Node | Vue | React | CSS / SCSS | Apex / LWC |
|---|---|---|---|---|---|
| Style and naming in code | ESLint core, `typescript-eslint` | `eslint-plugin-vue` | `eslint-plugin-react`, `eslint-plugin-react-hooks` | none | PMD, `@salesforce/eslint-config-lwc` |
| Types | `tsc` | `vue-tsc` | `tsc` | none | the Apex compiler |
| Formatting | Prettier | Prettier | Prettier | Prettier | Prettier with `prettier-plugin-apex` |
| Units, colours, selectors | none | Stylelint with `stylelint-config-html` | Stylelint | Stylelint core, `stylelint-config-standard-scss` | Stylelint for LWC CSS |
| BEM block tied to the component file | none | `stylelint-selector-bem-pattern` | `stylelint-selector-bem-pattern` | `stylelint-selector-bem-pattern` | none |
| Import direction and layers | `eslint-plugin-import`, `no-restricted-imports`, `eslint-plugin-boundaries` | the same | the same | none | none |

## How to compare two candidates in five minutes

- Last release and the age of the oldest open bug with a maintainer reply.
- Peer dependencies against the versions in our `package.json`.
- The size that reaches the browser for the part we use; tree-shaking claims verified in a build.
- Types: shipped, accurate, and not `any` at the API you will call.
- Accessibility: keyboard and screen reader behaviour for anything interactive.
- The one limitation that would bite our case; read the issues for it.
