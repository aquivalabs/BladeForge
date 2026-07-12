# BladeForge

Blade Runner Skills — the aquivalabs Claude Code marketplace. Curated,
company-approved skills, synced from the shared source and reviewed before release.

## Install

```
/plugin marketplace add aquivalabs/BladeForge
/plugin install review@bladeforge
```

## Guard the gate — [`cerberus`](#leak-check)

**Keep this on — it is what stops a client's private information from leaking out of the marketplace.**
These skills are authored right next to private client codebases, and anything that leaves the fence — a
public mirror, a shared repo, a pasted example — can quietly carry a fingerprint of that work: a client's
brand, real object or class names, ticket keys, even a secret or a work email baked into commit
*authorship*. Scrubbing it after the fact is slow and nerve-wracking; catching it at edit time is not.
`cerberus` is that nudge — the moment you touch a skill, it checks the change and flags anything that
reads as real client or work data before it ships.

**Why it's an agent, not a regex:** a denylist scanner that *lists the private names to catch* is itself
a leak — it writes down the very thing you are hiding. So `cerberus` keeps **zero denylist by design** —
a path-only **PostToolUse hook** fires on any edit under `skills/`, `references/`, or `evals/` (or to a
`SKILL.md` / `plugin.json` / `marketplace.json`); it reads the file path, never the content, so it names
nothing — and the **[`leak-check`](#leak-check) skill** reads the change in context and rewrites anything
client-specific onto one neutral fictional demo before it ships.

It ships in this marketplace and is enabled by default (`cerberus@bladeforge` in `.claude/settings.json`).

## Plugins

| Plugin | What it does | Skills | Install |
|---|---|---|---|
| cerberus | Leak guard at the gate — a PostToolUse hook reminds on any skill/eval edit; the agent skill reviews the change for work-codebase fingerprints (real class/object/namespace names, secrets, employer/client brand, domain flavor) and rewrites them to a fictional demo before they ship. No denylist by design. | [leak-check](#leak-check) | `cerberus@bladeforge` |
| cicero | House voice — injects the always-on communication style and enforces it on replies. | — (hook only) | `cicero@bladeforge` |
| diagram | Architecture/flow diagram authoring — spec or raw code → a readable, clickable D2→ELK page (classes+methods, objects, permission sets, relations); contents from an Atlas hardened by Sextant reviewers. | [diagram](#diagram) | `diagram@bladeforge` |
| frontend-css | CSS conventions — rem units, SCSS modules. | [rem](#rem), [scss-modules](#scss-modules) | `frontend-css@bladeforge` |
| frontend-js | JavaScript/TypeScript style conventions. | [conventions](#conventions) | `frontend-js@bladeforge` |
| frontend-react | React conventions — placement, structure, hooks, primitives, layout, stories. | [component-placement](#component-placement), [component-structure](#component-structure), [feature-components](#feature-components), [hooks-registry](#hooks-registry), [layout-components](#layout-components), [skeleton-components](#skeleton-components), [storybook-stories](#storybook-stories), [ui-primitive-reuse](#ui-primitive-reuse) | `frontend-react@bladeforge` |
| frontend | Frontend dev-harness — types + tests runner. | [fe-check](#fe-check) | `frontend@bladeforge` |
| git | Git workflow — atomic commit splitting. | [commit](#commit) | `git@bladeforge` |
| i18n | i18n — route user-facing strings through localization. | [ui-strings](#ui-strings) | `i18n@bladeforge` |
| jira | Jira — comment style. | [comment-style](#comment-style) | `jira@bladeforge` |
| meta | Meta — design law, error handling, doc writing, skill authoring. | [error-handling](#error-handling), [lean-writing](#lean-writing), [model-routing](#model-routing), [new-skill](#new-skill), [ockham](#ockham), [solid](#solid), [triage](#triage), [wittgenstein](#wittgenstein) | `meta@bladeforge` |
| review | Stack-agnostic pre-push review framework — reviewer agents, the `/review` orchestrator, secret-scan + attestation gate. | [setup](#setup) | `review@bladeforge` |
| salesforce | Salesforce — Apex tests, LWC, security, deploy/run harness. | [apex_test-authoring](#apex_test-authoring), [dx_mcp](#dx_mcp), [lwc_development](#lwc_development), [security_review-rules](#security_review-rules), [sf-deploy-test](#sf-deploy-test), [sf-run](#sf-run) | `salesforce@bladeforge` |

## Skills

Grouped by plugin. Each group links back to [Plugins](#plugins).

### cerberus &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="leak-check"></a>**leak-check** — the leak guard's agent pass. Before a new or edited skill,
  reference, or eval fixture ships to this marketplace, review the change for anything that points to a
  real work codebase (real class/object/namespace/org/ticket names, secrets, real people/emails, an
  employer/client brand, or the aggregate domain flavor) and rewrite it to a neutral fictional demo. A
  **PostToolUse** hook nudges it on every skill/eval edit; there is no denylist by design.

### cicero &nbsp;·&nbsp; [↑ Plugins](#plugins)
Not a skill — a house communication style enforced by two hooks. A **SessionStart**
hook injects a list of **14 rules** (answer first, size to the ask, gloss jargon,
recommend don't survey, push back with reasons, calibrated honesty, … end with a
one-line joke) plus a start banner; a **Stop** hook (`plain-language-guard`) runs
after each reply and blocks house-voice violations. Net effect: the bot talks
plainly and cuts the fluff. Full ruleset: [cicero.md](plugins/cicero/cicero.md).

### diagram &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="diagram"></a>**diagram** — Turn a spec or raw code into a readable, clickable architecture/flow diagram: a D2 graph laid out by ELK, each class showing its real methods, objects with fields, and permission sets, rendered as a browsable HTML page under `docs/diagrams/<name>/`. Node contents come from an **Atlas** entity list that parallel **Sextant** reviewer agents harden to zero edits; bidirectional click-to-jump between diagram and its notes, pan/zoom via svg-pan-zoom.

### frontend-css &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="rem"></a>**rem** — Enforce rem units over hardcoded px in CSS/SCSS/Tailwind.
- <a id="scss-modules"></a>**scss-modules** — Component SCSS conventions: `.scss` over `.css`, the color/spacing/radius token system, BEM structure.

### frontend-js &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="conventions"></a>**conventions** — JS/TS style: arrow functions, single quotes, full variable names, braces everywhere, path aliases over deep relative imports.

### frontend-react &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="component-placement"></a>**component-placement** — Entry point before creating any component: search for an existing one, then decide placement and route to the matching skill.
- <a id="component-structure"></a>**component-structure** — Component folder/file layout (tsx/scss/index), BEM naming, styling, barrel exports.
- <a id="feature-components"></a>**feature-components** — Rules for domain-coupled feature components that compose primitives and hold business logic.
- <a id="hooks-registry"></a>**hooks-registry** — Governs adding, renaming, moving, or removing a custom `use*` hook.
- <a id="layout-components"></a>**layout-components** — Rules for app-chrome/layout components: shell, top bar, sidebar, command palette, overlays.
- <a id="skeleton-components"></a>**skeleton-components** — Build a colocated loading-skeleton component for async-loaded data.
- <a id="storybook-stories"></a>**storybook-stories** — When and how to write a Storybook story and which states it should cover.
- <a id="ui-primitive-reuse"></a>**ui-primitive-reuse** — Search the primitive library before building a new shared UI primitive; reuse or extend first.

### frontend &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="fe-check"></a>**fe-check** — Typecheck and run targeted unit tests for a frontend repo, returning a terse one-block summary.

### git &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="commit"></a>**commit** — Commit workflow: sync docs owned by the changed area, then split into atomic logical commits.

### i18n &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="ui-strings"></a>**ui-strings** — Route every user-facing UI string through the localization system instead of hardcoding it.

### jira &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="comment-style"></a>**comment-style** — Keep Jira comments short, essence-first, and clear on the first read.

### meta &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="error-handling"></a>**error-handling** — Uniform error paths across layers: throwing from a service/route/controller and reading errors on the client.
- <a id="lean-writing"></a>**lean-writing** — Write terse technical documents: specs, design docs, RFCs, decision logs.
- <a id="model-routing"></a>**model-routing** — Assign an explicit model tier to every spawned agent before any fan-out.
- <a id="new-skill"></a>**new-skill** — Author a brand-new skill: plugin/domain, folder placement, SKILL.md and frontmatter.
- <a id="ockham"></a>**ockham** — The Razor: justify before creating any new entity — file, module, class, abstraction.
- <a id="solid"></a>**solid** — The design law: SRP/OCP/LSP/ISP/DIP plus DRY, KISS, YAGNI.
- <a id="triage"></a>**triage** — Cheap shallow pass over a large batch first, then spend the expensive pass only on the shortlist.
- <a id="wittgenstein"></a>**wittgenstein** — Clarity gate for an already-written spec, plan, or RFC — a reviewer persona.

### review &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="setup"></a>**setup** — Install and target the pre-push review framework in a repo (`.claude/review.config.json`).

Plus the `/review` orchestrator, the reviewer agents, and the secret-scan + attestation gate.

### salesforce &nbsp;·&nbsp; [↑ Plugins](#plugins)
- <a id="apex_test-authoring"></a>**apex_test-authoring** — Apex test standards: `Assert.*`, `@TestSetup` data factories, FLS/user-mode, bulk/positive/negative coverage.
- <a id="dx_mcp"></a>**dx_mcp** — Use the salesforce-dx MCP (not the raw `sf` CLI) for org ops: SOQL, deploy/retrieve, run tests.
- <a id="lwc_development"></a>**lwc_development** — House rules for building Salesforce LWC/Aura bundles and Salesforce-side frontend JS.
- <a id="security_review-rules"></a>**security_review-rules** — Security rules: secret leakage, route auth, SOQL injection, XSS, WITH USER_MODE/FLS.
- <a id="sf-deploy-test"></a>**sf-deploy-test** — CLI fallback that deploys Apex/metadata and returns a compact pass/fail + test summary.
- <a id="sf-run"></a>**sf-run** — Run anonymous Apex or a SOQL query against an org and get a terse result.

## Example config

See [CLAUDE.example.md](CLAUDE.example.md) for a reference `CLAUDE.md` — how to
wire these plugins into a repo and keep the config thin (rules live in skills).

## Contributing

Skills are curated internally and published here after review. The **eval-gate**
check validates every change before it lands.
