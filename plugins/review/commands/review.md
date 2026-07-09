---
description: Run the configured pre-push reviewer agents + secret scan over the cumulative diff, always print a results table, and on all-pass write the review attestation.
---

Run the mandatory pre-push review.

1. Resolve the base and the change set. Base: `npx tsx -e "import('./scripts/review/diffHash.ts').then((m) => process.stdout.write(m.resolveBase()))"`. Then run `git diff <base>..HEAD` and `git diff --name-only <base>..HEAD`. If the diff is empty, tell the user there is nothing to review and stop.

2. Run the deterministic secret scan over the SAME change set: `npx tsx scripts/review/gate.ts --secrets-only --base <base>`. Capture any secret findings — they BLOCK regardless of the agent scores.

3. Load the active reviewer set: `npx tsx -e "import('./scripts/review/config.ts').then((m) => process.stdout.write(JSON.stringify(m.loadConfig())))"`. Then SELECT which reviewers to dispatch by zone: for each ENABLED agent, dispatch it ONLY if at least one changed file matches one of its `zones` globs. An enabled agent whose zones match NONE of the changed files is NOT dispatched — carry it forward as `{ "score": 10, "verdict": "PASS", "hasBlocker": false, "findings": [], "advisories": [] }` (nothing in its zone to review). Zone globs use standard `**`/`*` semantics; when unsure whether a path matches, DISPATCH the agent — never skip on doubt. If NO agent's zones match any changed file, skip agent dispatch entirely and proceed to scoring with every agent carried at PASS 10.

   Dispatch the SELECTED reviewers IN PARALLEL (a single message with one Agent tool call each). Give each agent: the cumulative diff, the changed-file list, and its config block (`zones`, `skills`, `rules`, `pairedDocs`, `threshold`, `extensionSkill`, and the top-level `persona` from the loaded config). Each returns its JSON verdict object `{ agent, score, verdict, hasBlocker, findings[], advisories[] }`.

4. Compute the OVERALL verdict: PASS only if EVERY agent has `verdict: "PASS"` (its `score >= threshold` AND `hasBlocker: false`, using each agent's configured threshold) AND the secret scan found ZERO secrets. Otherwise FAIL. A failing check is FAIL, never PASS — do not report PASS when any agent failed or any secret was found.

5. ALWAYS print, regardless of outcome, a results table FIRST — one row per agent, then a secret-scan row, then a bold OVERALL row:

   | # | Agent | Score | Threshold | Verdict |
   |---|-------|:-----:|:---------:|:-------:|
   | 1 | conventions | 10 | 7 | PASS |
   | 2 | architecture | 9 | 8 | PASS |
   | ... | ... | ... | ... | ... |
   | - | secret-scan | - | - | CLEAN  /  N found |
   | - | **OVERALL** | - | - | **PASS  /  FAIL** |

   Agents not dispatched (no changed file in their zone) still get a row with Verdict `PASS` and the note `— not run (no files in zone)` in place of a score.

   Then a **Recommendations** section: for each agent that has any, list its `findings` as `severity  file:line - problem -> fix` and its `advisories`. List each secret finding as `pattern  file:line`. Omit agents that returned nothing.

6. On OVERALL FAIL: do NOT write an attestation and do NOT edit code (reviewers report only). State plainly that the gate is RED, then stop (the table + recommendations are already printed).

7. On OVERALL PASS: build the per-agent JSON `{ "<agent>": {"score":N,"verdict":"PASS"}, ... }` and write the attestation:
   `npx tsx scripts/review/writeAttestation.ts '<perAgentJson>'`
   This writes `.review/attestation.json`. Then commit it:
   `git add .review/attestation.json && git commit -m "chore: review attestation"`
   Tell the user the gate is green and they can push.

8. Re-running after a FAIL (fixes applied). Do NOT re-dispatch the full set. Re-run ONLY the reviewers that FAILED last time AND whose zone the fixes actually touched — over the current diff, with the same per-agent config; carry the earlier PASS verdicts forward for every reviewer not re-run. Always re-run the secret scan (step 2 — cheap and deterministic). Repeat this targeted loop until every previously-failed reviewer passes. ONLY THEN, and ONLY IF the fixes spilled outside the failed reviewers' zones (touched files owned by reviewers that had already passed), run the FULL set once more before scoring; otherwise the carried-forward passes plus the fresh passes stand. Write the attestation only after a full ALL-PASS.
