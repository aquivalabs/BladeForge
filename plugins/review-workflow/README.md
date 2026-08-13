# review-workflow

A skill-less plugin holding one Workflow script: `workflow.js`. It dispatches the `review` plugin's
five lenses in parallel against a forced response schema, reconciles their findings, computes the
untouched set, recomputes each lens's score with the round-aware formula, and checks the eight gate
criteria before the `/review` command may attest.

There is no skill here, no metadata sidecar, and no agent of its own — nothing the marketplace
catalog reads, so this plugin does not appear in it. `plugins/plan-gate/` is the existing example of
that shape: a plugin with no skill is simply absent from the catalog.

## Invocation

`/review` (in the `review` plugin) calls this workflow with a relative sibling path, because a
marketplace install clones the whole repository and both plugins land side by side:

```
scriptPath: ${CLAUDE_PLUGIN_ROOT}/../review-workflow/workflow.js
```

## Contract

The script performs no I/O. Everything it needs arrives in `args` — `base`, `hash`, `round`,
`changedFiles`, `diffPath`, `config`, `priorPerAgent` — and everything it produces leaves through its
return value:

```
{ attest: boolean, refusedCriterion: number | null, perAgent: [...], report: string }
```

It never attests, never commits, and never writes a file. `/review` is the only step in the system
that persists anything.
