# review-workflow

A skill-less plugin holding one Workflow script: `workflow.js`. It dispatches the `review` plugin's
configured lenses in parallel against a forced response schema, reconciles their findings, computes the
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
`attempt`, `changedFiles`, `diffPath`, `config`, `agentsDir`, `machineFacts`, `gateResults`,
`priorPerAgent` — and everything it produces leaves through its return value:

```
{ attest: boolean, capReached: boolean, refusedCriterion: number | null, failedLenses: [...], failedGates: [...], perAgent: [...], report: string }
```

`gateResults` is the results of the caller's deterministic gates — `[{name, command, exitCode, output}]`,
the repo's own oracle (eval-gate, a typecheck, the suite) run over the change set. A gate with a
non-zero `exitCode` lands in `failedGates` and REFUSES the attestation outright, like the secret scan,
whatever the lens verdicts — so a caller wiring against this script directly must pass `gateResults`
or it silently reproduces the review↔pre-push divergence this exists to close. Omit it (`null`) only
when the repo declares no gates.

`attempt` is the cumulative re-review count for the branch (it does NOT reset when a fix changes the
hash, unlike `round`); past a hard cap the script returns `capReached: true` so the caller stops
looping and hands the remainder to a human. `failedLenses` names every lens below its threshold. A
caller wiring against this script directly (not through `/review`) MUST pass `attempt` and honour
`capReached`, or the convergence cap silently degrades to the per-hash `round` clock.

A run can refuse with all three refusal signals empty — `failedLenses: []`, `refusedCriterion: null`,
`failedGates: []` — yet `attest: false`. That is the zero-lens case: `config.agents` was empty or
every lens was disabled, so nothing judged the diff and the script will not attest an unreviewed
change. `report` names it (`NO ENABLED LENS`); a caller reading only the structured fields must treat
`attest: false` itself as the verdict, never infer a pass from the empty signals.

It never attests, never commits, and never writes a file. `/review` is the only step in the system
that persists anything.
