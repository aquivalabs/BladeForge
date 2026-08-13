---
description: Run the configured pre-push reviewer lenses + secret scan over the cumulative diff via the review-workflow script, always print a results table, and on all-pass write the review attestation.
---

Run the mandatory pre-push review. The harness is the published `bladeforge-review-harness` package, invoked via `npx` — nothing is vendored in the repo. Lens dispatch, scoring, and the eight-criterion gate live in a separate Workflow script, `review-workflow/workflow.js`; this command resolves everything that script needs, invokes it, and persists whatever it returns. The script itself reads nothing and writes nothing.

First gather inputs with ONE call: `npx -y -p bladeforge-review-harness@latest review-info` → JSON `{ base, hash, config }` (the base ref, the current diff hash over `base..HEAD`, and the merged review config).

## Step 0 — short-circuit on an unchanged diff

Read the branch's attestation FIRST, so an unchanged diff never pays for a full re-run. Using `hash` from review-info, read the content-addressed `.review/attestations/<hash>.json` (committed on the branch by a prior PASS):

- **Already green** — attestation exists, `overall` is `PASS`, and its `diffHash` equals the current hash → this exact change set is already reviewed. Run only the secret scan (step 2); if clean, print the results table from the stored `perAgent`, state the gate is green, and STOP — do not invoke the Workflow script.
- **Anything else** — no attestation, `overall` was `FAIL` last time, or the hash differs → this is a full run. Proceed to step 1.

A full run means every enabled lens the config names is dispatched. There is no delta dispatch and no carrying an unmatched lens forward at a fixed score — that mechanic is gone; the script decides who runs from `config.agents` alone.

## Step 1 — resolve the base and the change set

Base = `base` from review-info. Then:

- `git diff <base>..HEAD` — the full diff. If it is empty, tell the user there is nothing to review and stop.
- `git diff --numstat <base>..HEAD` — reshape each line into `{ path, added, removed }`. This list becomes `changedFiles`.
- Write the full diff text to a file and keep its path — a diff is too large to pass as an inline argument, and this path becomes `diffPath`.

## Step 2 — secret scan

Run the deterministic secret scan over the SAME change set: `npx -y -p bladeforge-review-harness@latest review-gate --secrets-only --base <base>`. Capture any secret findings — they BLOCK regardless of the lens scores, on every round.

## Step 3 — build the args and invoke the Workflow script

Build the following object and hand it to the `Workflow` tool as `args`. This is the whole contract: exactly seven keys, flat, no nested quoted keys — the shapes belong in the table beside it, not in the block itself.

```json
{
  "base": "<base ref>",
  "hash": "<diff hash>",
  "round": 1,
  "changedFiles": "<see table below>",
  "diffPath": "<see table below>",
  "config": "<see table below>",
  "priorPerAgent": null
}
```

| key | how `/review` resolves it |
|---|---|
| `base` | the base ref the run is measured against (step 1) |
| `hash` | the diff hash, from `review-info` |
| `round` | the round counter — 1 for a diff hash `/review` has not attempted before; incremented by one each time `/review` re-invokes the script against the SAME hash after a FAIL; reset to 1 the moment the hash changes |
| `changedFiles` | `git diff --numstat <base>..HEAD`, reshaped to `[{path, added, removed}]` (step 1) |
| `diffPath` | the file `/review` wrote in step 1 holding `git diff <base>..HEAD`; the lens prompts the script builds name this path, and each lens reads it itself |
| `config` | the loaded config from `review-info` |
| `priorPerAgent` | the `perAgent` array this same command received on the previous round against this hash; `null` on round 1 |

Resolve `workflow.js` before calling anything. Two layouts hold it, and a single relative hop from `${CLAUDE_PLUGIN_ROOT}` reaches neither — that path points at the versioned install cache, `…/cache/<marketplace>/review/<version>/`, whose sibling directory is another version of `review`, not another plugin. Try these in order and use the first that exists:

1. `~/.claude/plugins/marketplaces/<marketplace>/plugins/review-workflow/workflow.js` — the marketplace clone. It holds the whole repository, so the two plugins really do sit side by side here, and `/plugin marketplace update` keeps it current. Take `<marketplace>` from the plugin id in the project's `.claude/settings.json` — the part after `@` in `review@<marketplace>`.
2. `${CLAUDE_PLUGIN_ROOT}/../../review-workflow/<version>/workflow.js` — the install cache, two hops up and a version segment down. Take the highest version present.

**Not-installed fallback.** If neither resolves, the `review-workflow` plugin is not available. Say so plainly, name both paths you tried, and stop — do not fall back to dispatching lenses by hand. A hand dispatch cannot force the response schema the way the script does, and an unforced dispatch is exactly the failure this script exists to close off.

## Step 4 — wait for the run

The `Workflow` tool runs in the background and notifies `/review` on completion; it does not return synchronously. `/review` waits for that notification before reading any result.

**A run that never returns is a failed review.** No attestation gets written, nothing beyond what had already printed is shown as a results table, and `/review` states which lenses, if any, had already reported before the run stopped — the failure is named, not left silent.

## Step 5 — consume the return

The script hands back exactly `{ attest, refusedCriterion, failedLenses, perAgent, report }` and nothing else.

- Print `report` verbatim. It already carries the per-lens lines, the disputed pairs, the deferred Majors and Minors, the untouched-set section, and — when the run earned one — the below-floor notice. `/review` builds no notice of its own: the one line inside `report` is the only one printed, because two authors reading the same config would print it twice.
- Build the results table (below) from `perAgent`.
- `attest` is `true` only when **both** gates opened: no lens failed its threshold, and all eight criteria passed. The two answer different questions — the lens verdicts decide whether the change passes review, the criteria decide whether the run's own output is honest and well formed. A blocker reported in the correct shape violates no criterion, which is exactly why the verdicts have to be checked separately.
- When `attest` is `false`, say which gate refused and go to step 6. `failedLenses` is non-empty when a lens did — name each one as `<lens> <score>/<threshold>`, with its blocker count when it has one. `refusedCriterion` is the number, 1 through 8, when a criterion did. Both can be set; report both. Never read a `null` `refusedCriterion` as a pass — check `attest` itself.

**The script decides; `/review` persists.** `attest`, `refusedCriterion`, `failedLenses`, `perAgent`, and `report` are a verdict, not a write — the script touches no disk anywhere in its run. Step 7 below is the only step in this whole system that writes and commits an attestation.

## Rules the run must satisfy

**The round rule.** Rounds 1 and 2 score normally and open on any Blocker, Major, or Minor. From round 3, a Minor is still reported, still recorded in `report`, and still filed, but it deducts nothing and re-opens nothing — only a Blocker or a Major still moves a score or forces another round, and at most three Majors carry into the fix round (the rest are listed as deferred-this-round, never dropped). The scoring formula, applied once per lens inside the script: `10 − 20×blocker − 3×major − 1×countedMinor`, where `countedMinor` is every Minor in rounds 1 and 2 and zero from round 3 onward.

**The full-run rule.** A full run of all five lenses precedes every attestation, and it is that run — never a mix of runs against different diffs — that gets attested. No lens's verdict is carried forward from an earlier round once the diff has changed.

**The reconcile duty.** `/review` groups the findings in `report` by `where` and treats a location where two lenses reached opposite conclusions as disputed rather than silently picking one. A lens proposes no remedy for its own finding — deciding what to do about it is `/review`'s job.

## Results table

Print this FIRST, whatever the outcome — one row per lens the script dispatched, `craft` first, then the rest in the order the config lists them, then a secret-scan row, then a bold OVERALL row:

| # | Lens | Score | Threshold | Verdict |
|---|------|:-----:|:---------:|:-------:|
| 1 | craft | 9 | 7 | PASS |
| 2 | architecture | 8 | 8 | PASS |
| 3 | tests | 7 | 7 | PASS |
| 4 | docs | 8 | 8 | PASS |
| 5 | security | 9 | 9 | PASS |
| 6 | *(any further lens the config names)* | ... | ... | PASS / FAIL |
| - | secret-scan | - | - | CLEAN / N found |
| - | **OVERALL** | - | - | **PASS / FAIL** |

On a migrated config that is the five built-ins and nothing else, dispatched as `review:review-<name>` — `review:review-craft` for the merged lens. A config naming a further agent gets a further row scored the same way as the rest; if no `plugins/review/agents/review-<name>.md` file backs that name, the dispatch itself fails and the row reads FAIL, never PASS.

Then a **Recommendations** section: for each lens with any findings, list each as `severity  where - problem` with its `scenario`, grouped by lens. Then **Disputed**, **Deferred Majors**, **Deferred Minors**, and **Advisories** sections — all pulled straight out of `report`, never re-derived, since the script's own gate criterion 8 already checked `report` for completeness.

## Step 6 — on FAIL

State plainly that the gate is RED, then stop. Do not write an attestation and do not edit code — the lenses and the script both report only. The next `/review` invocation against the same diff is the next round: rebuild `args` with `round` incremented by one and `priorPerAgent` set to this run's `perAgent`, then invoke the Workflow script again from step 3. A change to the diff itself resets `round` to 1 and `priorPerAgent` to `null`.

## Step 7 — on PASS, attest immediately

Writing and committing the attestation is the IMMEDIATE next action once `attest` is `true` — do it FIRST, before ANY other edit. **Never touch code between a green verdict and the committed attestation.** Any edit — even fixing a reported finding — changes the diff hash and VOIDS the review, forcing a re-run; address findings only AFTER the attestation is committed, as a separate change that gets its own `/review`. ALWAYS write and commit the attestation — automatically, without asking. This is not optional: the committed `.review/attestations/<diffHash>.json` is the branch anchor that lets the NEXT `/review` short-circuit (step 0) instead of re-running the whole cycle. Build the per-lens JSON `{ "<lens>": {"score":N,"verdict":"PASS"}, ... }` from `perAgent` and write it:
`npx -y -p bladeforge-review-harness@latest review-attest '<perAgentJson>'`
This stamps the current `diffHash` AND the `commitSha` (HEAD SHA the review covers) into the content-addressed `.review/attestations/<diffHash>.json`, pruning any stale sibling attestation. Then commit the store to the branch — stage additions AND the pruned deletions:
`git add -A .review/ && git commit -m "chore: review attestation"`
Tell the user the gate is green and they can push.
