#!/usr/bin/env bash
# Pre-push eval-gate. Blocks pushing a touched/new skill whose trigger eval is
# missing/invalid, OR whose measurement is missing or stale — stale meaning either
# the queryset or the DESCRIPTION changed since result.json was written. A skill
# nobody touched in this push is never inspected, so the 41 not-yet-measured skills
# stay out of the way while anything you edited must be measured. The measurement
# block applies only when the diff contains the skill's own SKILL.md: the eval scores
# the DESCRIPTION, so editing a bundled script or a generated catalog beside a skill
# leaves an existing measurement perfectly valid, and demanding a re-run there would
# be pointless churn.
# There is NO skip flag: a touched skill whose measurement is missing or stale always
# blocks. No live clone to measure from means the skill is not shippable yet — get one.
# Reads pre-push stdin; falls back to origin/main..HEAD when run by hand with no
# stdin. Bash 3.2 compatible.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
VALIDATE="$ROOT/scripts/validate_eval.py"
SCORER="$ROOT/plugins/meta/skills/skill-eval/scripts/score-description.py"
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

if [ -z "$skills" ]; then
  echo "eval-gate: no skills touched — nothing to check."
  exit 0
fi

# --- 3. grade each touched skill ---------------------------------------------
json_field() { python3 -c 'import json,sys
try: print(json.load(open(sys.argv[1])).get(sys.argv[2],""))
except Exception: print("")' "$1" "$2"; }

eg_err="$(mktemp)"; trap 'rm -f "$eg_err"' EXIT
blocks=""; warns=""; passes=""; nskills=0
while IFS= read -r sd; do
  [ -z "$sd" ] && continue
  nskills=$((nskills + 1))
  evalfile="$sd/evals/trigger-eval.json"
  if ! qhash="$(python3 "$VALIDATE" "$evalfile" 2>"$eg_err")"; then
    blocks="$blocks
     • $sd :: $(cat "$eg_err")"
    continue
  fi
  resfile="$sd/evals/result.json"
  problem=""
  if [ ! -f "$resfile" ]; then
    problem="never measured — no evals/result.json"
  elif [ "$(json_field "$resfile" queryset_hash)" != "$qhash" ]; then
    problem="stale: the queryset changed since it was measured"
  else
    # The description is the thing the eval actually scores, so a rewritten one
    # invalidates the result even when every query stayed put. The hash comes from
    # the scorer itself — one frontmatter parser, not two that can disagree.
    dnow="$(python3 "$SCORER" --skill-path "$sd" --print-description-hash 2>/dev/null)"
    dwas="$(json_field "$resfile" description_hash)"
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
  passes="$passes
  ✓ $sd :: best_score=$(json_field "$resfile" best_score)"
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
  echo "    <skill-dir>/evals/trigger-eval.json"
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
  exit 1
fi
echo "eval-gate: $nskills skill(s) checked, no blockers."
exit 0
