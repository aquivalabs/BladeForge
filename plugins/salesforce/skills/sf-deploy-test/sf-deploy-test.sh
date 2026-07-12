#!/usr/bin/env bash
# sf-deploy-test — deploy metadata and (optionally) run Apex tests against an org, terse result.
#
# Usage:
#   sf-deploy-test.sh [--org <alias>] [--project-dir <path>] \
#       (--source-dir <path> ... | --metadata <Type:Name> ...) [--tests <ClassA,ClassB>]
#
# Defaults: --org myOrg, --project-dir current dir, --ignore-conflicts always on.
# Notes: source-tracking may reject a shared object with a "../SharedPkg … unsafe" path —
#        pass --metadata "ApexClass:Name" instead when that bites. Needs the `sf` CLI + python3.
set -euo pipefail

ORG="myOrg"
PROJECT_DIR="$PWD"
TESTS=""
declare -a SOURCE=() META=()

usage() { echo "usage: sf-deploy-test.sh [--org <alias>] [--project-dir <path>] (--source-dir <path>... | --metadata <Type:Name>...) [--tests <ClassA,ClassB>]"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --org) ORG="$2"; shift 2;;
    --project-dir) PROJECT_DIR="$2"; shift 2;;
    --source-dir) SOURCE+=("$2"); shift 2;;
    --metadata) META+=("$2"); shift 2;;
    --tests) TESTS="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "unknown arg: $1"; usage; exit 2;;
  esac
done

if [[ ${#SOURCE[@]} -eq 0 && ${#META[@]} -eq 0 ]]; then usage; exit 2; fi
cd "$PROJECT_DIR"

declare -a ARGS=(project deploy start -o "$ORG" --ignore-conflicts --json)
for s in ${SOURCE[@]+"${SOURCE[@]}"}; do ARGS+=(--source-dir "$s"); done
for m in ${META[@]+"${META[@]}"}; do ARGS+=(--metadata "$m"); done

DEPLOY="$(sf "${ARGS[@]}" 2>/dev/null || true)"
printf '%s' "$DEPLOY" | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    top = json.loads(raw)
except Exception:
    print("deploy: ERROR (unparseable sf output)"); print(raw[:400]); sys.exit(1)
# Error-shaped JSON: top-level status != 0, a message, and no populated result.
if top.get("status", 0) != 0 or not top.get("result"):
    print("deploy: ERROR — {}".format(top.get("message", "unknown error"))); sys.exit(1)
d = top["result"]
status = d.get("status", "Unknown")
fails = [f.get("problem") for f in d.get("details", {}).get("componentFailures", []) if f.get("problem")]
print("deploy: {}{}".format(status, "" if not fails else " — " + " | ".join(fails[:5])))
sys.exit(0 if status == "Succeeded" else 1)
'
DEPLOY_RC=$?
if [[ $DEPLOY_RC -ne 0 ]]; then exit $DEPLOY_RC; fi

if [[ -n "$TESTS" ]]; then
  declare -a TARGS=(apex run test -o "$ORG" -w 10 --result-format json)
  IFS=',' read -ra TS <<< "$TESTS"
  for t in "${TS[@]}"; do TARGS+=(-t "$t"); done
  TEST_OUT="$(sf "${TARGS[@]}" 2>/dev/null || true)"
  printf '%s' "$TEST_OUT" | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    r = json.loads(raw).get("result", {})
except Exception:
    print("tests: ERROR (could not parse)"); print(raw[:400]); sys.exit(1)
s = r.get("summary", {})
passing = s.get("passing", 0); total = s.get("testsRan", 0)
fails = [t.get("FullName") or t.get("MethodName") for t in r.get("tests", []) if t.get("Outcome") == "Fail"]
print("tests: {}/{} passed{}".format(passing, total, "" if not fails else " — FAIL: " + ", ".join(fails)))
sys.exit(0 if fails == [] and total > 0 else 1)
'
fi
