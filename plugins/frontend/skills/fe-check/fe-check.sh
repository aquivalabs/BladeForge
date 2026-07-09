#!/usr/bin/env bash
# fe-check — typecheck + (targeted) unit tests for a frontend repo, terse one-block summary.
#
# Usage:
#   fe-check.sh [--dir <repo>] [--test <vitest-glob-or-path> ...]
#
# Defaults: --dir current dir. With no --test, runs the full vitest suite. Needs npx (tsc + vitest).
set -euo pipefail

DIR="$PWD"
declare -a TESTS=()

usage() { echo "usage: fe-check.sh [--dir <repo>] [--test <glob> ...]"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) DIR="$2"; shift 2;;
    --test) TESTS+=("$2"); shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "unknown arg: $1"; usage; exit 2;;
  esac
done

cd "$DIR"
RC=0

# ── Types ────────────────────────────────────────────────────────────────────
TSC_OUT="$(npx tsc --noEmit 2>&1 || true)"
TSC_ERRORS="$(printf '%s\n' "$TSC_OUT" | grep -c 'error TS' || true)"
if [[ "$TSC_ERRORS" -eq 0 ]]; then
  echo "tsc:   clean"
else
  echo "tsc:   $TSC_ERRORS error(s)"
  printf '%s\n' "$TSC_OUT" | grep 'error TS' | head -10 | sed 's/^/       /'
  RC=1
fi

# ── Tests ────────────────────────────────────────────────────────────────────
declare -a VARGS=(vitest run --reporter=dot)
for t in ${TESTS[@]+"${TESTS[@]}"}; do VARGS+=("$t"); done
VITEST_OUT="$(npx "${VARGS[@]}" 2>&1 || true)"
# vitest prints e.g. "Tests  4 passed (4)" / "Tests  1 failed | 3 passed (4)"
SUMMARY="$(printf '%s\n' "$VITEST_OUT" | grep -E '^\s*Tests\s' | tail -1 | sed 's/^[[:space:]]*//')"
if [[ -z "$SUMMARY" ]]; then
  echo "tests: no result — vitest output tail:"; printf '%s\n' "$VITEST_OUT" | tail -8 | sed 's/^/       /'; RC=1
else
  echo "tests: $SUMMARY"
  if printf '%s' "$SUMMARY" | grep -q 'failed'; then
    printf '%s\n' "$VITEST_OUT" | grep -E 'FAIL|×' | head -10 | sed 's/^/       /'; RC=1
  fi
fi

exit $RC
