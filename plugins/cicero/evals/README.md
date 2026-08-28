# CICERO style-adherence eval

Measures whether replies produced under the CICERO output style actually follow its rules.
This is a different question from what `meta:skill-eval` answers (does a skill's description
make Claude reach for it) — CICERO is an always-on output style, so the thing to measure is
adherence, and no shared harness for that existed; this one follows the research protocol
recorded in `../references/agent-communication-research.md`.

## Run it

```bash
python3 plugins/cicero/scripts/adherence-eval.py                    # cheap smoke, one run per case
python3 plugins/cicero/scripts/adherence-eval.py --repeat 4         # the honest measurement
python3 plugins/cicero/scripts/adherence-eval.py --baseline         # + vanilla run, to see the delta
python3 plugins/cicero/scripts/adherence-eval.py --case flattery-bait --repeat 4
```

**One run per case is a noisy sample.** Borderline cases genuinely flicker between runs — measured
at roughly one failure in three or four on `one-question` and `trivial-brevity`. `--repeat N`
scores each case by its pass RATE over N runs and calls it passing at `--bar` — default 0.6, a
clear majority, so 2/3 and 3/4 pass while 1/3 and 2/4 do not. Mind the interaction: a bar of 0.75
at `--repeat 3` would demand a perfect 3/3, which is stricter than a single run rather than more
forgiving. Judge a style change with `--repeat 4`; `--repeat 1` is only a smoke test, and a single
red there is not yet evidence of anything.

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

- **The styled score is the gate**: a styled FAIL at `--repeat 4` means the style file does not
  steer the model on that rule — fix the rule's wording, or the case, if it mis-probes.
- **Stop tuning before you overfit.** Sharpening a rule the eval flagged is the point; rewriting
  the voice until one borderline judge criterion goes green is how a rule list grows past the
  count where any of it is honored (see `../references/agent-communication-research.md`). If a
  case sits at 3/4 and its failure reads as a judgment call rather than a violation, that is the
  measurement's floor, not a defect to engineer away.
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

## An errored run is not a failed run

`claude -p` occasionally fails outright — throttling after a heavy session, a dropped connection.
The harness retries a turn three times with backoff, and a run that still cannot complete is
dropped from the denominator and reported as `ERROR` with the count of lost runs, never scored as
a style violation. This is not hypothetical: an earlier build counted such failures as failures,
and two green cases appeared to regress to 0/3 immediately after an unrelated edit. Both were
throttling, and both returned 3/3 once the run completed. **A red that appears right after an
edit which cannot explain it deserves a look at the raw replies before it is believed.**

## Measured, 2026-08-28 (sonnet, `--repeat 3 --baseline`)

Styled **13/13**, baseline **7/13**. The six cases the style flips from red to green —
`result-first`, `fence-tagging`, `findings-tree`, `no-parenthetical-gloss`, `check-report`,
`one-question` — are the voice earning its tokens; each was 0/3 without it.

Four rules were sharpened because a case measured red, and each edit was kept only because the
case then went green: rule 5 names the verdict, not the mechanism, as the first sentence; rule 6
turns the no-parentheses ban into a bright line covering glosses, examples and asides; rule 9 says
to tag a fence `text` when no language fits; rule 16 gained a one-decision-per-turn line, then a
shared-prerequisite exception.

That last one is the instructive failure. The bright line alone drove `one-question` to 0/4,
because rule 16 then contradicted rule 17: three decisions resting on one shared prerequisite were
being asked about three times over. The fix was to let a shared prerequisite be gathered in one
turn while recommendations still come one at a time — and the eval case, written against the older
wording, had to be corrected with it. **When a rule and a case disagree, decide which one is
wrong before changing either.**
