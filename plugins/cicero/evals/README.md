# CICERO style-adherence eval

Measures whether replies produced under the CICERO output style actually follow its rules.
This is a different question from what `meta:skill-eval` answers (does a skill's description
make Claude reach for it) — CICERO is an always-on output style, so the thing to measure is
adherence, and no shared harness for that existed; this one follows the research protocol
recorded in `../references/agent-communication-research.md`.

## Run it

```bash
python3 plugins/cicero/scripts/adherence-eval.py                 # full suite, styled only
python3 plugins/cicero/scripts/adherence-eval.py --baseline      # + vanilla run, to see the delta
python3 plugins/cicero/scripts/adherence-eval.py --case flattery-bait
```

Spawns `claude -p` (subject + judge). **Local only, never CI** — same policy as
`meta:skill-eval`. Exit code is 0 only when every styled case passes.

## Protocol, and the three design decisions that matter

1. **A checkable rule gets a checker, not an opinion** (the IFEval move). Everything a regex or
   a parser can decide — an untagged fence, a praise-opening, box-drawing inside a fence, prose
   word count, apology count, the reply's script — is a deterministic `mechanical` check in
   `style-adherence.json`. The judge is reserved for what genuinely needs reading.
2. **Judge questions are binary, never preference.** An LLM judge asked "which answer is
   better" picks the longer one >90% of the time once lengths differ by >20% (Saito 2023,
   arXiv:2310.10076). Asked "does the first sentence state the verdict — yes or no", it has no
   length channel to be biased through. Every judge criterion here is a factual yes/no about
   one rule, and the judge preamble explicitly instructs length-blindness as a second belt.
3. **The sandbox is isolated with `--setting-sources project`.** The subject runs in a
   throwaway project whose only styling influence is its own settings — the CICERO style
   installed (subject) or nothing (baseline). Without that flag, a user-level cicero plugin
   would force the style into the baseline too and the comparison would measure nothing.
   Verified live: the styled sandbox quotes Rule 0 verbatim, the baseline reports having no
   numbered rules.

## Reading the result

- **The styled score is the gate**: a styled FAIL means the style file does not steer the
  model on that rule — fix the rule's wording (or the case, if it mis-probes).
- **The baseline column is diagnostics, not a gate**: a case both variants pass discriminates
  nothing (the base model already behaves that way — the rule may still be worth keeping as an
  anchor against regression); a case only the styled variant passes is the style earning its
  tokens; a case the baseline passes and the styled variant fails is a red flag that a rule
  interferes with another.
- Judge verdicts carry short reasons in the `--out` JSON; read them before editing anything —
  a FAIL is sometimes the judge misreading a criterion, and the fix is the criterion's wording.

## Cases

One case per probed behavior, id says what it baits: `flattery-bait` (floor 2),
`pressure-flip` + `apology-bait` (floor 3, two-turn via `--resume`), `verification-honesty`
(floor 1), `result-first` (5), `no-parenthetical-gloss` (6), `language-mix` (7 — its prompt is
Russian TEST DATA stored as JSON `\u` escapes so the file itself stays English per the repo
language rule), `fence-tagging` (9), `trivial-brevity` + `check-report` (12), `findings-tree`
(15), `one-question` (16), `menu-vs-pick` (17).

Adding a case: probe ONE behavior, prefer a mechanical check, keep judge questions binary and
anchored to observable features of the reply, and give the case a realistic prompt — the bait
must be something a real user would plausibly send.
