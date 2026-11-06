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

Where a rule about code is usually enforced, for the checks ladder in the skill. These are
directions, not a required toolset: use what the project already runs first (rung 1). Which rules
to turn on, and with which exceptions, belongs to the stack's tooling or conventions skill.

**By language.** Lint covers naming, braces, dead code and forbidden calls; the type checker covers
contracts; the formatter ends every argument about layout; the rule engine holds a project rule no
stock linter has.

| Language / stack | Lint | Types | Format | Own rules |
|---|---|---|---|---|
| JavaScript, TypeScript, Node | ESLint, `typescript-eslint` | `tsc` | Prettier, Biome | ESLint `no-restricted-syntax`, a local ESLint rule, Semgrep |
| Vue | `eslint-plugin-vue` | `vue-tsc` | Prettier | `vue/no-restricted-*` rules, Semgrep |
| React | `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | `tsc` | Prettier | `no-restricted-imports`, Semgrep |
| CSS, SCSS, Less | Stylelint, `stylelint-config-standard-scss` | none | Prettier | `selector-class-pattern`, `stylelint-selector-bem-pattern`, `unit-disallowed-list` |
| Python | Ruff, Pylint | mypy, Pyright | Ruff format, Black | Ruff `flake8-tidy-imports`, Semgrep, import-linter for layers |
| Go | `go vet`, staticcheck, golangci-lint | the compiler | `gofmt`, `goimports` | `depguard`, `forbidigo`, Semgrep |
| Java | Checkstyle, PMD, SpotBugs, Error Prone | the compiler | google-java-format, Spotless | ArchUnit for layers, Semgrep |
| Kotlin | detekt, ktlint | the compiler | ktlint, ktfmt | detekt custom rules, Konsist for layers |
| C#, .NET | Roslyn analyzers, StyleCop.Analyzers | the compiler, nullable reference types | `dotnet format` | `.editorconfig` severities, NetArchTest |
| Ruby | RuboCop | Sorbet, Steep | RuboCop | a custom cop, Packwerk for boundaries |
| PHP | PHPStan, Psalm, PHP_CodeSniffer | PHPStan, Psalm | PHP-CS-Fixer | Deptrac for layers |
| Rust | Clippy | the compiler | `rustfmt` | `clippy.toml` disallowed methods, cargo-deny |
| Swift | SwiftLint | the compiler | swift-format | SwiftLint custom rules |
| Apex, Salesforce | PMD for Apex, Salesforce Code Analyzer | the Apex compiler | Prettier with `prettier-plugin-apex` | a PMD XPath rule |
| LWC, Aura | `@salesforce/eslint-config-lwc` | none | Prettier | ESLint rules for LWC |
| Shell | ShellCheck | none | shfmt | ShellCheck directives, a bats test |
| SQL | SQLFluff | the database's own `EXPLAIN` and schema | SQLFluff | SQLFluff rules |

**Across languages.** Some rules belong to no single language.

| Concern | Tool |
|---|---|
| Secrets in the tree | gitleaks, trufflehog, the repo's own secret scan |
| Dependencies with known vulnerabilities | `npm audit`, `pip-audit`, `govulncheck`, OSV-Scanner, Dependabot |
| A project rule in any language | Semgrep, ast-grep |
| Layers and import direction | `eslint-plugin-boundaries`, dependency-cruiser, import-linter, ArchUnit, Deptrac |
| Dead code and unused exports | knip, ts-prune, vulture for Python, `deadcode` for Go |
| Infrastructure as code | tflint, Checkov, tfsec, kube-linter |
| Containers | hadolint |
| CI config | actionlint |
| YAML, JSON, TOML | yamllint, a JSON Schema check, taplo |
| Markdown and docs | markdownlint, Vale, a link checker, the repo's docs check |
| Commit messages | commitlint |
| Test quality | coverage thresholds, mutation testing (Stryker, mutmut, PIT, cargo-mutants) |

## How to compare two candidates in five minutes

- Last release and the age of the oldest open bug with a maintainer reply.
- Peer dependencies against the versions in our `package.json`.
- The size that reaches the browser for the part we use; tree-shaking claims verified in a build.
- Types: shipped, accurate, and not `any` at the API you will call.
- Accessibility: keyboard and screen reader behaviour for anything interactive.
- The one limitation that would bite our case; read the issues for it.
