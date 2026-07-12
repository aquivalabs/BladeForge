#!/usr/bin/env bash
# Pre-push eval-gate. Blocks pushing a touched/new skill whose trigger eval is
# missing/invalid; warns (non-blocking) when the eval exists but its measured
# result.json is absent or stale. Reads pre-push stdin; falls back to
# origin/main..HEAD when run by hand with no stdin. Bash 3.2 compatible.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
VALIDATE="$ROOT/scripts/validate_eval.py"
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
  if [ ! -f "$resfile" ]; then
    warns="$warns
     • $sd :: eval present but never measured"
    continue
  fi
  rhash="$(json_field "$resfile" queryset_hash)"
  if [ "$rhash" != "$qhash" ]; then
    warns="$warns
     • $sd :: result.json is stale (queryset changed since last measure)"
  else
    passes="$passes
  ✓ $sd :: best_score=$(json_field "$resfile" best_score)"
  fi
done <<EOF
$skills
EOF

# --- 4. report ---------------------------------------------------------------
[ -n "$passes" ] && printf '%s\n' "$passes"
if [ -n "$warns" ]; then
  echo ""
  echo "  ⚠  deprecated/unmeasured evals (push allowed — refresh when you can):"
  printf '%s\n' "$warns"
  echo "     → run:  python3 scripts/optimize_description.py --skill-path <dir> --apply"
fi
if [ -n "$blocks" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ✖  eval-gate FAILED"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  These skills have no valid trigger eval:"
  printf '%s\n' "$blocks"
  echo ""
  echo "  HOW TO FIX: add a trigger eval next to the skill, then commit + push again:"
  echo "    <skill-dir>/evals/trigger-eval.json"
  echo "    — a JSON array of >= 6 cases: {\"query\": \"...\", \"should_trigger\": true|false}"
  echo "    — at least 1 positive (true) and 1 negative (false)."
  echo ""
  exit 1
fi
echo "eval-gate: $nskills skill(s) checked, no blockers."
exit 0
