#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

bash "$HERE/install.sh" "$T"

for p in .husky/pre-push .github/workflows/review-gate.yml \
         .claude/review.config.schema.json .claude/review.config.json; do
  [ -f "$T/$p" ] || { echo "MISSING: $p"; exit 1; }
done

[ -x "$T/.husky/pre-push" ] || { echo "pre-push not executable"; exit 1; }
# No vendoring — the harness is the npm package invoked via npx; the target gets NO scripts/review/.
[ -d "$T/scripts/review" ] && { echo "scripts/review should not be vendored"; exit 1; }
grep -q 'review-gate' "$T/.husky/pre-push" || { echo "pre-push does not invoke review-gate"; exit 1; }
grep -q 'bladeforge-review-harness' "$T/.github/workflows/review-gate.yml" || { echo "CI does not invoke the harness package"; exit 1; }

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
