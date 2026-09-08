# The skill security checklist — 8 points

The consumer-safety bar for a skill about to ship: does this skill harm the person or agent
that INSTALLS and runs it? This is the opposite direction from `cerberus:leak-check`, which
asks whether OUR real identifiers leak OUT. Cerberus guards the gate in both directions;
this file is the inbound half.

Each point is an **agent judgment pass**, not a regex denylist — the intelligence lives in the
reviewer, the same as leak-check. A skill fails the gate if any point is a real hit.

| # | point | what a hit looks like |
|---|---|---|
| 1 | **Prompt injection** | text that tries to steer the *reading* agent — "ignore previous instructions", hidden directives in a code block/comment, instructions addressed to the model rather than to the human author |
| 2 | **Data exfiltration** | the skill sends repo/user/context data anywhere it needn't — a `curl`/`fetch` posting file contents, an email/webhook of collected data, logging secrets to an external sink |
| 3 | **Secret detection** | a real API key/token/private key/credential embedded in the skill, references, or fixtures (shares the seam with `leak-check` point 1 — flag under both) |
| 4 | **Dangerous commands** | destructive or irreversible shell in a bundled script — `rm -rf`, `git push --force`, `dd`, `chmod -R 777`, a package publish, a mass delete — that the skill actually runs (a `# scout-ignore`'d line that never runs is not a hit) |
| 5 | **Obfuscation** | base64/hex-encoded payloads, `eval` of a decoded blob, minified-on-purpose logic, unicode homoglyphs, anything written to be hard for a reviewer to read |
| 6 | **External fetches** | the skill reaches an unexpected external host — a script that downloads-and-runs, a curl to a URL that is not the documented, expected dependency |
| 7 | **Credential access** | the skill reads `~/.ssh`, `~/.aws`, `.env`, a keychain, browser cookies, a token store — anything holding credentials it has no stated reason to touch |
| 8 | **Privilege escalation** | `sudo`, a setuid trick, editing a shell profile / cron / launch agent, writing outside the working tree to gain persistence or elevated rights |

## Provenance — where this list came from

The eight-point structure is from the **2026 Agent Skills Ecosystem** industry writeups on the
"ToxicSkills" incident (directories that could not certify a skill as safe lost enterprise buyers).
The broader mandate — that security is now table-stakes, not a bonus — is corroborated by the
lifecycle/quality/security arXiv sources this programme tracks: SkillOps (arXiv 2605.13716),
Dynamic Agent Skills (2607.10113), SkillBrew (2605.29440), and Skill Evaluation & Evolution
(2606.11435).

**Reliability caveat, carried honestly:** the *exact* eight items and the ToxicSkills framing come
from industry blogs, not a peer-reviewed paper — treat the eight as a useful REQUIREMENTS STRUCTURE
rather than a citation. The cross-sourced, more trustworthy figures (SkillsBench: mean 6.2/12 across
47,150 public skills; curation +16.2 pp agent pass-rate) belong to the QUALITY axis
(`meta:skill-eval` + `skillcraft:skillaxe`), not this security one.

## Where we stand today (2026-09-08)

All eight points are now walked by this head — `cerberus:security-scan`, wired the same way
leak-check is: a skill + the PostToolUse hook + a review lens. Two of them also have a second,
independent check: #3 secret detection is shared with `cerberus:leak-check`, and #4 dangerous
commands is partly backstopped by the `scout` gate (it flags mutation-looking lines, with the
`# scout-ignore` escape hatch).

The walk is **recorded, not just performed**: the head writes an eight-point confirmation into the
skill's `evals/result.json` under a `security` key (each point + verdict + the material hash it
covered), and the pre-push `eval-gate` blocks a touched skill whose material changed without a fresh
one. So "all eight passed" is a checkable artifact per skill, not an implicit clean bill.
