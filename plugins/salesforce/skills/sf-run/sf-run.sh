#!/usr/bin/env bash
# sf-run — run anonymous Apex or a SOQL query against a Salesforce org and print a terse result.
#
# Usage:
#   sf-run.sh [--org <alias>] --apex '<code>'
#   sf-run.sh [--org <alias>] --apex-file <path>
#   sf-run.sh [--org <alias>] --soql '<query>'
#   sf-run.sh ... --debug        # print the full raw JSON response too
#
# Defaults: --org myOrg, API v66.0. Needs the `sf` CLI + curl + python3.
set -euo pipefail

ORG="myOrg"
API="v66.0"
MODE=""
PAYLOAD=""
DEBUG="false"

usage() { echo "usage: sf-run.sh [--org <alias>] (--apex '<code>' | --apex-file <path> | --soql '<query>') [--debug]"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --org) ORG="$2"; shift 2;;
    --apex) MODE="apex"; PAYLOAD="$2"; shift 2;;
    --apex-file) MODE="apex"; PAYLOAD="$(cat "$2")"; shift 2;;
    --soql) MODE="soql"; PAYLOAD="$2"; shift 2;;
    --debug) DEBUG="true"; shift;;
    -h|--help) usage; exit 0;;
    *) echo "unknown arg: $1"; usage; exit 2;;
  esac
done

if [[ -z "$MODE" || -z "$PAYLOAD" ]]; then usage; exit 2; fi

AUTH="$(SF_TEMP_SHOW_SECRETS=true sf org display -o "$ORG" --json 2>/dev/null)"
TOKEN="$(printf '%s' "$AUTH" | grep -o '"accessToken": "[^"]*"' | head -1 | cut -d'"' -f4)"
URL="$(printf '%s' "$AUTH" | grep -o '"instanceUrl": "[^"]*"' | head -1 | cut -d'"' -f4)"
if [[ -z "$TOKEN" || -z "$URL" ]]; then
  echo "FAIL: could not resolve org token/instanceUrl for '$ORG' (authenticated? sf org login web -a $ORG)"; exit 1
fi

enc() { python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$1"; }

if [[ "$MODE" == "apex" ]]; then
  RESP="$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$URL/services/data/$API/tooling/executeAnonymous/?anonymousBody=$(enc "$PAYLOAD")")"
  [[ "$DEBUG" == "true" ]] && printf '%s\n' "$RESP"
  printf '%s' "$RESP" | python3 -c '
import json, sys
d = json.load(sys.stdin)
if not d.get("compiled", False):
    print("FAIL(compile): {} @ line {}".format(d.get("compileProblem"), d.get("line"))); sys.exit(1)
if not d.get("success", False):
    stack = (d.get("exceptionStackTrace") or "").splitlines()
    print("FAIL: {} @ {}".format(d.get("exceptionMessage"), stack[0] if stack else "")); sys.exit(1)
print("OK")
'
else
  RESP="$(curl -s -H "Authorization: Bearer $TOKEN" "$URL/services/data/$API/query/?q=$(enc "$PAYLOAD")")"
  [[ "$DEBUG" == "true" ]] && printf '%s\n' "$RESP"
  printf '%s' "$RESP" | python3 -c '
import json, sys
d = json.load(sys.stdin)
if isinstance(d, list) or (isinstance(d, dict) and "errorCode" in d):
    print("FAIL:", json.dumps(d)[:300]); sys.exit(1)
print("{} rows".format(d.get("totalSize", 0)))
for r in d.get("records", [])[:5]:
    r.pop("attributes", None)
    print(" ", json.dumps(r, ensure_ascii=False))
'
fi
