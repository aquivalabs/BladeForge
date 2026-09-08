#!/usr/bin/env bash
# Pre-push eval-gate. Blocks pushing a touched/new skill whose trigger eval is
# missing/invalid, OR whose measurement is missing or stale — stale meaning either
# the queryset or the DESCRIPTION changed since result.json was written. A skill
# nobody touched in this push is never inspected, so any not-yet-measured skill
# stays out of the way while anything you edited must be measured. The measurement
# block applies only when the diff contains the skill's own SKILL.md: the eval scores
# the DESCRIPTION, so editing a bundled script or a generated catalog beside a skill
# leaves an existing measurement perfectly valid, and demanding a re-run there would
# be pointless churn.
# It ALSO blocks a touched skill whose installer-facing MATERIAL (SKILL.md, references/,
# scripts/) changed but carries no fresh result.json `security` section — the eight-point
# consumer-safety confirmation written by cerberus:security-scan. That gate is broader than
# the trigger one (any material edit, not just the description) because a script or reference
# change alters what reaches a consumer, and stronger (no skip flag) because it is safety.
# There is NO skip flag: a touched skill whose measurement is missing or stale always
# blocks. No live clone to measure from means the skill is not shippable yet — get one.
# Reads pre-push stdin; falls back to origin/main..HEAD when run by hand with no
# stdin. Bash 3.2 compatible.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
VALIDATE="$ROOT/scripts/validate_eval.py"
SCORER="$ROOT/plugins/meta/skills/skill-eval/scripts/score-description.py"
VALIDATE_ACC="$ROOT/scripts/validate_acceptance.py"
VALIDATE_SEC="$ROOT/scripts/validate_security.py"
ZERO="0000000000000000000000000000000000000000"
EMPTY_TREE="$(git hash-object -t tree /dev/null)"

# --- 1. collect changed files across all pushed refs (newline-joined) --------
changed=""
have_stdin=0
if [ ! -t 0 ]; then
  while read -r _localref localsha _remoteref remotesha; do
    [ -z "${localsha:-}" ] && continue
    have_stdin=1
    [ "$localsha" = "$ZERO" ] && continue           # branch deletion
    if [ "$remotesha" = "$ZERO" ]; then
      base="$(git merge-base origin/main "$localsha" 2>/dev/null || echo "$EMPTY_TREE")"
    else
      base="$remotesha"
    fi
    changed="$changed
$(git diff --name-only "$base" "$localsha" 2>/dev/null)"
  done
fi
if [ "$have_stdin" -eq 0 ]; then
  base="$(git merge-base origin/main HEAD 2>/dev/null || echo "$EMPTY_TREE")"
  changed="$(git diff --name-only "$base" HEAD 2>/dev/null)"
fi

# --- 2. map changed files -> unique skill dirs -------------------------------
skilldir_of() {
  local d; d="$(dirname "$1")"
  while [ "$d" != "." ] && [ "$d" != "/" ]; do
    [ -f "$d/SKILL.md" ] && { echo "$d"; return 0; }
    d="$(dirname "$d")"
  done
  return 1
}
skills=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  sd="$(skilldir_of "$f")" || continue
  [ -f "$sd/SKILL.md" ] || continue     # skill fully deleted: not a gate concern
  skills="$skills
$sd"
done <<EOF
$changed
EOF
skills="$(printf '%s\n' "$skills" | sed '/^$/d' | sort -u)"

# Skills whose own SKILL.md is in the diff — only these owe a fresh measurement.
descskills="$(printf '%s\n' "$changed" | sed -n 's#/SKILL\.md$##p' | sed '/^$/d' | sort -u)"
owes_measurement() {
  printf '%s\n' "$descskills" | grep -qx "$1"
}

# A skill owes a fresh security scan when its installer-facing MATERIAL changed — its own
# SKILL.md, anything under references/, or anything under scripts/. Broader than the trigger
# measurement (description only): a script or reference edit changes what reaches a consumer,
# so consumer safety must be re-verified even when the description stayed put.
owes_security() {
  printf '%s\n' "$changed" | grep -qE "^$1/(SKILL\.md|references/|scripts/)"
}

if [ -z "$skills" ]; then
  echo "eval-gate: no skills touched — nothing to check."
  exit 0
fi

# --- 3. grade each touched skill ---------------------------------------------
json_field() { python3 -c 'import json,sys
try:
    o=json.load(open(sys.argv[1]))
    for k in sys.argv[2].split("."): o=o[k]
    print(o)
except Exception: print("")' "$1" "$2"; }

eg_err="$(mktemp)"; trap 'rm -f "$eg_err"' EXIT
blocks=""; warns=""; passes=""; nskills=0
while IFS= read -r sd; do
  [ -z "$sd" ] && continue
  nskills=$((nskills + 1))
  evalfile="$sd/evals/rubric.json"
  if ! qhash="$(python3 "$VALIDATE" "$evalfile" 2>"$eg_err")"; then
    blocks="$blocks
     • $sd :: $(cat "$eg_err")"
    continue
  fi
  # --- step 5: a touched skill must carry rubric.json acceptance + a ## Contract heading ---
  if owes_measurement "$sd"; then
    struct=""
    if ! python3 "$VALIDATE_ACC" "$sd/evals/rubric.json" >/dev/null 2>"$eg_err"; then
      struct="rubric.json acceptance missing or invalid: $(cat "$eg_err")"
    elif [ "$(grep -c '^## Contract' "$sd/SKILL.md")" -eq 0 ]; then
      struct="no ## Contract heading in SKILL.md"
    fi
    if [ -n "$struct" ]; then
      if [ "${SKILL_EVAL_SKIP:-0}" = "1" ]; then
        warns="$warns
     • $sd :: $struct  (allowed through by SKILL_EVAL_SKIP=1)"
      else
        blocks="$blocks
     • $sd :: $struct"
      fi
      continue
    fi
  fi

  resfile="$sd/evals/result.json"
  problem=""
  if [ ! -f "$resfile" ]; then
    problem="never measured — no evals/result.json"
  elif [ "$(json_field "$resfile" trigger.queryset_hash)" != "$qhash" ]; then
    problem="stale: the queryset changed since it was measured"
  else
    # The description is the thing the eval actually scores, so a rewritten one
    # invalidates the result even when every query stayed put. The hash comes from
    # the scorer itself — one frontmatter parser, not two that can disagree.
    dnow="$(python3 "$SCORER" --skill-path "$sd" --print-description-hash 2>/dev/null)"
    dwas="$(json_field "$resfile" trigger.description_hash)"
    if [ -n "$dnow" ] && [ -n "$dwas" ] && [ "$dnow" != "$dwas" ]; then
      problem="stale: the description was rewritten since it was measured"
    fi
  fi
  if [ -n "$problem" ]; then
    if ! owes_measurement "$sd"; then
      warns="$warns
     • $sd :: $problem  (SKILL.md unchanged in this push — not blocking)"
      continue
    fi
    blocks="$blocks
     • $sd :: $problem"
    continue
  fi

  # --- step 6: a touched skill whose MATERIAL changed owes a fresh result.json.security ---
  # Consumer safety is the strongest gate — no skip flag, same as the trigger measurement.
  if owes_security "$sd"; then
    secproblem=""
    if [ ! -f "$resfile" ]; then
      secproblem="never security-scanned — no evals/result.json"
    elif ! python3 "$VALIDATE_SEC" "$resfile" >/dev/null 2>"$eg_err"; then
      secproblem="security section missing/invalid: $(cat "$eg_err")"
    else
      mnow="$(python3 "$VALIDATE_SEC" --print-material-hash "$sd" 2>/dev/null)"
      mwas="$(json_field "$resfile" security.scanned_hash)"
      if [ -n "$mnow" ] && [ "$mnow" != "$mwas" ]; then
        secproblem="stale: the skill's material changed since it was security-scanned"
      else
        sverdict="$(json_field "$resfile" security.verdict)"
        if [ "$sverdict" != "pass" ]; then
          secproblem="security scan verdict is '$sverdict', not 'pass' — resolve the flagged point before shipping"
        fi
      fi
    fi
    if [ -n "$secproblem" ]; then
      blocks="$blocks
     • $sd :: $secproblem"
      continue
    fi
  fi

  passes="$passes
  ✓ $sd :: best_score=$(json_field "$resfile" trigger.best_score)"
done <<EOF
$skills
EOF

# --- 4. report ---------------------------------------------------------------
[ -n "$passes" ] && printf '%s\n' "$passes"
if [ -n "$warns" ]; then
  echo ""
  echo "  ⚠  deprecated/unmeasured evals (push allowed — refresh when you can):"
  printf '%s\n' "$warns"
  echo "     → run:  python3 plugins/meta/skills/skill-eval/scripts/score-description.py --skill-path <dir> --suggest"
fi
if [ -n "$blocks" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ✖  eval-gate FAILED"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  These touched skills are not shippable:"
  printf '%s\n' "$blocks"
  echo ""
  echo "  HOW TO FIX — no valid trigger eval: add one next to the skill,"
  echo "    <skill-dir>/evals/rubric.json (its trigger array)"
  echo "    — a JSON array of >= 6 cases: {\"query\": \"...\", \"should_trigger\": true|false}"
  echo "    — at least 1 positive (true) and 1 negative (false)."
  echo ""
  echo "  HOW TO FIX — never measured / stale: invoke the meta:skill-eval SKILL and follow it,"
  echo "    then run its script FROM THIS REPO (the installed plugin cache lags and a stale"
  echo "    copy saves no result at all):"
  echo "      python3 plugins/meta/skills/skill-eval/scripts/score-description.py \\"
  echo "        --skill-path <skill-dir> --type self-contained"
  echo ""
  echo "  No live clone to measure from? The skill is not shippable yet — measurement"
  echo "    is mandatory and has no skip flag. Get a working clone and measure."
  echo ""
  echo "  HOW TO FIX — never/stale security-scanned: invoke the cerberus:security-scan SKILL,"
  echo "    walk the eight points against the change, and write the confirmation into"
  echo "    <skill-dir>/evals/result.json under the \"security\" key (all eight points, verdicts,"
  echo "    and security.scanned_hash = validate_security.py --print-material-hash <skill-dir>)."
  echo "    Consumer safety is mandatory and has no skip flag."
  echo ""
  exit 1
fi
echo "eval-gate: $nskills skill(s) checked, no blockers."
exit 0
