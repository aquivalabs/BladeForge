#!/usr/bin/env bash
set -euo pipefail

# Self-locating installer for the review framework. Run from a target repo, or pass the repo path.
#   bash install.sh [TARGET_REPO]    (TARGET_REPO defaults to $PWD)
# Vendors the harness + git hook + CI workflow + config schema, seeds a config, and wires the
# marketplace + review plugin into the target repo's committed .claude/settings.json. Self-aware:
# the marketplace name + source repo are derived from THIS plugin's own marketplace, so the same
# script works unchanged from whatever marketplace it is vendored into.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKET_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET="${1:-$PWD}"

mkdir -p "$TARGET/scripts/review" "$TARGET/.husky" "$TARGET/.github/workflows" "$TARGET/.claude"

# Harness (vendored) — *.ts + package.json, never node_modules.
for f in "$SCRIPT_DIR"/scripts/review/*.ts; do
  cp "$f" "$TARGET/scripts/review/"
done
cp "$SCRIPT_DIR/scripts/review/package.json" "$TARGET/scripts/review/package.json"

# Config schema is plugin-owned — always refresh it.
cp "$SCRIPT_DIR/review.config.schema.json" "$TARGET/.claude/review.config.schema.json"

# Git pre-push hook — EXTEND, never clobber. The project may have its own checks
# (lint, type-check, tests, route compliance) in this hook; only ADD the review gate.
HOOK="$TARGET/.husky/pre-push"
if [ -f "$HOOK" ]; then
  if grep -q 'scripts/review/gate.ts' "$HOOK"; then
    echo "kept .husky/pre-push (already invokes the review gate)"
  else
    {
      echo ""
      echo "# Review gate (added by review plugin install) — passing /review attestation + secret scan."
      echo 'npx tsx "$(git rev-parse --show-toplevel)/scripts/review/gate.ts"'
    } >> "$HOOK"
    chmod +x "$HOOK"
    echo "extended .husky/pre-push with the review gate (kept your existing checks)"
  fi
else
  cp "$SCRIPT_DIR/templates/husky-pre-push" "$HOOK"
  chmod +x "$HOOK"
  echo "created .husky/pre-push"
fi

# CI workflow — CREATE only if absent, never clobber. A project that folded the review
# gate into its own workflow keeps it; we don't overwrite its other CI steps.
WF="$TARGET/.github/workflows/review-gate.yml"
if [ -f "$WF" ]; then
  grep -q 'scripts/review/gate.ts' "$WF" \
    && echo "kept .github/workflows/review-gate.yml (already runs the review gate)" \
    || echo "kept .github/workflows/review-gate.yml (exists — NOT overwritten; add 'npx tsx scripts/review/gate.ts --secrets-only' yourself if missing)"
else
  cp "$SCRIPT_DIR/templates/review-gate.yml" "$WF"
  echo "created .github/workflows/review-gate.yml"
fi

# Seed config only if absent (idempotent — never clobber the project's own config).
if [ ! -f "$TARGET/.claude/review.config.json" ]; then
  cp "$SCRIPT_DIR/templates/starter.review.config.json" "$TARGET/.claude/review.config.json"
  echo "seeded .claude/review.config.json"
else
  echo "kept existing .claude/review.config.json"
fi

# Stack tooling MCP — on first adoption, provision the MCP server this repo's stack needs so the
# matching skill has something to talk to (salesforce:dx_mcp drives the salesforce-dx MCP). Idempotent;
# never clobbers. Salesforce/Apex repo = has sfdx-project.json → seed/merge the salesforce-dx MCP.
if [ -f "$TARGET/sfdx-project.json" ]; then
  MCP="$TARGET/.mcp.json"
  SFDX_MCP='{command:"npx", args:["-y","@salesforce/mcp","--orgs","DEFAULT_TARGET_ORG","--toolsets","orgs,metadata,data,testing"]}'
  if [ ! -f "$MCP" ]; then
    jq -n "{ mcpServers: { \"salesforce-dx\": $SFDX_MCP } }" > "$MCP"
    echo "seeded .mcp.json with the salesforce-dx MCP (SFDX project detected)"
  elif ! jq -e '.mcpServers["salesforce-dx"]' "$MCP" >/dev/null 2>&1; then
    tmp="$(mktemp)"
    jq ".mcpServers[\"salesforce-dx\"] = $SFDX_MCP" "$MCP" > "$tmp" && mv "$tmp" "$MCP"
    echo "added salesforce-dx MCP to existing .mcp.json"
  else
    echo "kept .mcp.json (already has salesforce-dx)"
  fi
fi

# Wire the marketplace + review plugin into the target's committed settings.json (merge, never clobber).
MARKET_NAME="$(jq -r '.name' "$MARKET_ROOT/.claude-plugin/marketplace.json")"
REPO="$(git -C "$MARKET_ROOT" remote get-url origin 2>/dev/null | sed -E 's#\.git$##; s#^.*[:/]([^/]+/[^/]+)$#\1#')"
SETTINGS="$TARGET/.claude/settings.json"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
tmp="$(mktemp)"
jq --arg m "$MARKET_NAME" --arg r "$REPO" \
  '.extraKnownMarketplaces[$m] = {source:{source:"github", repo:$r}}
   | .enabledPlugins["review@" + $m] = true' \
  "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
echo "wired $MARKET_NAME ($REPO) + review@$MARKET_NAME into .claude/settings.json"

echo ""
echo "------------------------------------------------------------------"
echo " OK  Review framework files are now in: $TARGET"
echo "------------------------------------------------------------------"
echo ""
echo " >>> ONE MORE STEP to finish — do it INSIDE Claude Code, not here."
echo ""
echo "     Open this project in Claude Code and simply say:"
echo ""
echo "         set up the review gate"
echo ""
echo "     (or run the skill directly:   review:setup )"
echo ""
echo " The skill finishes everything for you and explains each step in"
echo " plain language — turning on the git hook, installing the helper"
echo " packages, and tailoring the review rules to this project."
echo " You do not need to know any code; just follow along."
echo ""
echo " Last thing, on GitHub: ask your repo admin to make the"
echo " 'review-gate' check REQUIRED in branch protection (one time)."
echo "------------------------------------------------------------------"
