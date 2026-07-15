#!/usr/bin/env bash
# SessionStart hook — keep a repo's VENDORED review harness (scripts/review/*) in lockstep with the
# installed review plugin. Runs only where the harness is already vendored; re-copies the *.ts +
# package.json whenever the plugin version differs from the repo's stamp, refreshes the stamp, STAGES
# the result, and nudges the user to commit. It never commits on its own (a SessionStart auto-commit
# would land on an arbitrary branch mid-work) — staging + a nudge is enough that a re-vendor is not
# silently lost or rolled back. Self-healing: on the next session a reverted stamp just re-triggers.
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
[ -n "$PLUGIN_ROOT" ] || exit 0

VENDOR_DIR="$PROJECT_DIR/scripts/review"
SRC_DIR="$PLUGIN_ROOT/scripts/review"
# Act only where the framework is already vendored — never create it in an unrelated repo.
[ -d "$VENDOR_DIR" ] || exit 0
[ -d "$SRC_DIR" ] || exit 0

PLUGIN_VERSION="$(jq -r '.version // empty' "$PLUGIN_ROOT/.claude-plugin/plugin.json" 2>/dev/null || true)"
[ -n "$PLUGIN_VERSION" ] || exit 0

STAMP="$VENDOR_DIR/.plugin-version"
CURRENT="$(cat "$STAMP" 2>/dev/null || true)"
[ "$CURRENT" = "$PLUGIN_VERSION" ] && exit 0

# Version differs (or stamp missing) — re-vendor the harness sources + package.json and refresh the stamp.
for f in "$SRC_DIR"/*.ts; do
  [ -e "$f" ] && cp "$f" "$VENDOR_DIR/"
done
[ -f "$SRC_DIR/package.json" ] && cp "$SRC_DIR/package.json" "$VENDOR_DIR/package.json"
printf '%s\n' "$PLUGIN_VERSION" > "$STAMP"
git -C "$PROJECT_DIR" add scripts/review >/dev/null 2>&1 || true

MSG="[review-sync] Re-vendored review harness scripts/review/* to plugin v${PLUGIN_VERSION} (was ${CURRENT:-none}). They are STAGED — commit so the gate stays in sync: git commit -m \"chore(review): re-vendor harness to v${PLUGIN_VERSION}\""
jq -n --arg ctx "$MSG" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx}}'
