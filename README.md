# BladeForge

Blade Runner Skills — the aquivalabs Claude Code marketplace. Curated,
company-approved skills, synced from the shared source and reviewed before release.

## Install

```
/plugin marketplace add aquivalabs/BladeForge
/plugin install review@bladeforge
```

## Plugins

| Plugin | What it does | Install |
|---|---|---|
| cicero | House voice — injects the always-on communication style and enforces it on replies. | `cicero@bladeforge` |
| frontend-css | CSS conventions — rem units, SCSS modules. | `frontend-css@bladeforge` |
| frontend-js | JavaScript/TypeScript style conventions. | `frontend-js@bladeforge` |
| frontend-react | React conventions — component structure, hooks registry, skeleton components, Storybook stories. | `frontend-react@bladeforge` |
| frontend | Frontend dev-harness skills — types + tests runner. | `frontend@bladeforge` |
| git | Git workflow skills — atomic commit splitting. | `git@bladeforge` |
| i18n | i18n skills. | `i18n@bladeforge` |
| jira | Jira skills. | `jira@bladeforge` |
| meta | Meta skills — authoring new skills. | `meta@bladeforge` |
| review | Stack-agnostic pre-push review framework — reviewer agents, the `/review` orchestrator, secret-scan + attestation gate. | `review@bladeforge` |
| salesforce | Salesforce skills — Apex test authoring standard and salesforce-dx MCP usage. | `salesforce@bladeforge` |

## Contributing

Skills are authored in the public source repo (`Xaaalera/claude-skills`). A push
there opens a **sync PR** here; a maintainer reviews it, the **eval-gate** check
must pass, then it merges. `main` is protected — no direct pushes.
