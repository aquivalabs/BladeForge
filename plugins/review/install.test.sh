#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

bash "$HERE/install.sh" "$T"

for p in scripts/review/gate.ts scripts/review/config.ts scripts/review/docPairing.ts \
         scripts/review/package.json .husky/pre-push .github/workflows/review-gate.yml \
         .claude/review.config.schema.json .claude/review.config.json; do
  [ -f "$T/$p" ] || { echo "MISSING: $p"; exit 1; }
done

[ -x "$T/.husky/pre-push" ] || { echo "pre-push not executable"; exit 1; }
[ -d "$T/scripts/review/node_modules" ] && { echo "node_modules leaked"; exit 1; }

# Idempotency: a custom config must survive a re-run.
echo '{"custom":true}' > "$T/.claude/review.config.json"
bash "$HERE/install.sh" "$T" >/dev/null
grep -q '"custom":true' "$T/.claude/review.config.json" || { echo "config clobbered"; exit 1; }

# A non-SFDX target must NOT get a .mcp.json from the review install.
[ -f "$T/.mcp.json" ] && { echo "unexpected .mcp.json in non-SFDX target"; exit 1; }

# An SFDX target (has sfdx-project.json) gets a .mcp.json with the salesforce-dx MCP, idempotently.
SF="$(mktemp -d)"
touch "$SF/sfdx-project.json"
bash "$HERE/install.sh" "$SF" >/dev/null
jq -e '.mcpServers["salesforce-dx"].args | index("@salesforce/mcp")' "$SF/.mcp.json" >/dev/null \
  || { echo "MISSING: salesforce-dx MCP not provisioned for SFDX project"; exit 1; }
bash "$HERE/install.sh" "$SF" >/dev/null  # re-run must not duplicate or clobber
[ "$(jq '.mcpServers | keys | length' "$SF/.mcp.json")" = "1" ] || { echo "MCP provisioning not idempotent"; exit 1; }
rm -rf "$SF"

echo "INSTALL TEST PASS"
