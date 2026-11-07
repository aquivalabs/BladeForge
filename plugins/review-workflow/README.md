# review-workflow

A skill-less plugin holding one Workflow script: `workflow.js`. It dispatches the `review` plugin's
configured lenses in parallel against a forced response schema, reconciles their findings, computes the
untouched set, recomputes each lens's score with the attempt-aware formula — a Minor stops deducting from
the third attempt on a branch, and `attempt` does not reset when a fix changes the hash — and checks the
eight gate criteria before the `/review` command may attest.

There is no skill here, no metadata sidecar, and no agent of its own — nothing the marketplace
catalog reads, so this plugin does not appear in it. `plugins/plan-gate/` is the existing example of
that shape: a plugin with no skill is simply absent from the catalog.

## Invocation

`/review` (in the `review` plugin) does not pass `args` to this script. It writes them to a file
without `skillTexts` and runs `run-copy.mjs`, which reads every lens's skills, adds them, and writes
a copy of `workflow.js` with the whole object in place of the line that reads `args`. The Workflow
tool then runs that copy by `scriptPath`. The skills are about 110 KB here; pasted into the call they
cost about 28k output tokens a round (RMA-418). `run-copy.mjs` refuses a `workflow.js` that does not
hold that line exactly once, so a change to it cannot quietly produce a copy that ignores its args.

## Skill texts

A lens applies the house rules its config names only if they are in its context, and the Skill tool
finds a plugin's skills only when that plugin is both enabled and installed for the session's
project: a session started elsewhere, and every agent it spawns, gets none of them ("Unknown skill").
`skill-texts.mjs` (called by `run-copy.mjs`, which `/review` runs) reads each configured skill's `SKILL.md` whole, and the script
puts that text into the lens prompt. A skill whose file was not given, or is empty, fails its lens
(`skillsMissing` in `perAgent`), so the gate cannot attest a round judged without its rules.

Why the file goes in whole (RMA-395): before it, a lens read its skills itself and quoted one line
back as proof, from a window of the file the script then checked. Lenses that had read the file
quoted real lines from outside the window and failed, round after round, while the window moved from
one exact line to the last fifth to the second half. A lens with the rules in its prompt has nothing
to prove. The tokens are the ones it spent reading the files anyway: 102 KB for the nine skills of
this repository's four lenses. Measured before any of this existed: from mid-October 2026 most rounds
ran from a session with no skills, scored without them and attested anyway. RMA-345.

## Contract

The script performs no I/O. Everything it needs arrives in `args` — `base`, `hash`, `round`,
`attempt`, `changedFiles`, `diffPath`, `config`, `agentsDir`, `machineFacts`, `gateResults`,
`priorPerAgent`, `skillTexts` — and everything it produces leaves through its return value:

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

## Tests

Two offline suites, with no agents, no git and no network: `node tests/workflow-rules.test.mjs`
drives `workflow.js` with literal `args` and stubbed lenses, and `node --test tests/skill-texts.test.mjs`
covers how `/review` reads each lens's skills. The `review-workflow-tests` workflow runs both on
every pull request that touches this plugin (RMA-348).
