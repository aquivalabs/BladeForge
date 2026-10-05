---
description: Use when an ALREADY-CONFIGURED pre-push gate is about to be run against a branch, or its result attested — "run the review", "review before I push", "run the gate", "re-review after the fixes", "review this branch and attest it", "the gate is green, write the attestation", or any attempt to reach that gate through the Skill tool. The gate is a slash COMMAND, not a skill, and reaching for it as a skill silently runs a different reviewer that scores against no threshold and can attest nothing. Do NOT use for an ad-hoc read of a diff where no gate or attestation is wanted (that is the built-in `/code-review`), nor to create a gate that does not exist yet (`review:setup`).
---

# The review gate is a COMMAND — this page exists so you do not run the wrong one

## Contract

**In:** a repository holding `.claude/review.config.json` · the `review` plugin installed · an
intent to run the pre-push gate.

**Out:** the gate ran from `commands/review.md`, and `.review/lens-stats/<diffHash>.jsonl` exists
for the judged hash — the mechanical proof the configured lenses were the ones that judged.

---

## Read this before anything else

**`/review` is a slash COMMAND** (`commands/review.md` in this plugin). This plugin ships exactly two
skills — this page and `setup` — and NEITHER is the gate.

Calling the gate as a skill **does not fail**. It resolves to a different, built-in reviewer, which
returns real-looking findings and **cannot attest anything**. Measured on one branch: three full
rounds came back with no thresholds, no per-lens scores, no `attest` flag and no judged hash, and the
branch could not merge on any of them.

| | the gate (`commands/review.md`) | what you get by reaching for a skill |
|---|---|---|
| lenses | the ones `.claude/review.config.json` names, each with its own contract and skills | ad-hoc, unconfigured |
| scoring | per-lens score against a per-lens threshold | none |
| verdict | `attest` true/false, keyed to a diff hash | none |
| record | `.review/lens-stats/<hash>.jsonl`, `.review/attestations/<hash>.json` | nothing written |

## What to do

**Read `commands/review.md` in this plugin and execute it.** It is the single source of truth for the
run — the inputs, the round shape, the deterministic gates, the attestation. Do not improvise a
dispatch from this page, and do not copy its steps here: a second copy drifts, and a drifted gate is
worse than none.

The command resolves `${CLAUDE_PLUGIN_ROOT}` to this plugin; its own Step 3 names where
`workflow.js` and the lens contracts live and in what order to try them.

## The tell, and check it every time

After any run that claims to be the gate:

```bash
ls .review/lens-stats/<diffHash>.jsonl
```

**No file means the configured lenses did not run.** Whatever findings came back, nothing is
attestable and nothing may merge on them. This check costs one command and is the only mechanical
way to tell the two apart after the fact — the wrong reviewer's output looks like review output.

## One trap the command cannot see for you

A lens runs in the session's own working directory, which is **not** necessarily the repository under
review. When they differ, a lens's bare `git` call judges the wrong checkout and the round is void.
Measure it rather than assuming — run `pwd` and `git rev-parse --abbrev-ref HEAD` inside a lens-shaped
dispatch — and when they differ, hand every lens the repository root as a `machineFacts` entry, which
is what that channel is for.

---

## Before you finish

1. The run came from `commands/review.md`, not from a skill, a hand-rolled dispatch, or memory.
2. `ls .review/lens-stats/<diffHash>.jsonl` → the file exists for the hash just judged.
3. The result carries a per-lens score against each lens's threshold, and an `attest` flag.
4. Any line failing? You ran something else. Start again from `commands/review.md`.
