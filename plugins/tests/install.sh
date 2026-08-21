#!/usr/bin/env bash
set -euo pipefail

# Self-locating installer for the test standard. Run from a target repo, or pass the repo path.
#   bash install.sh [TARGET_REPO]    (TARGET_REPO defaults to $PWD)
#
# Seeds .claude/tests.config.json and its schema, and merges this marketplace + the tests plugin
# into the target's committed .claude/settings.json. Self-aware: the marketplace name is derived
# from THIS plugin's own location, so the script works unchanged from any mirror.
#
# It wires NO git hook and vendors NO check, and that is deliberate. The deterministic layer for
# tests already exists in a repository that has tests at all — the linter, the type check, the
# runner's own project split, the coverage thresholds. A fourth gate on top of those is a tax, not
# a guard. What this plugin adds is the standard, an audit agent, and the config above.
#
# Every write is staged into a temp directory first; only a fully-succeeded stage is moved into
# place, so a failed run leaves the target exactly as it started.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKET_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET="${1:-$PWD}"
mkdir -p "$TARGET"

MARKET_NAME="$(
  python3 - "$MARKET_ROOT" <<'PY' 2>/dev/null || echo ""
import json, sys, pathlib
p = pathlib.Path(sys.argv[1]) / ".claude-plugin" / "marketplace.json"
print(json.loads(p.read_text()).get("name", "") if p.exists() else "")
PY
)"
if [ -z "$MARKET_NAME" ]; then
  echo "ERROR: could not read the marketplace name from $MARKET_ROOT/.claude-plugin/marketplace.json"
  echo "       Run this script from inside a checked-out marketplace, not from a copy of one file."
  exit 1
fi

command -v python3 >/dev/null 2>&1 || {
  echo "ERROR: python3 is required to merge .claude/settings.json without clobbering it."
  exit 1
}

STAGE="$(mktemp -d)"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

mkdir -p "$STAGE/.claude"

# ── the config, seeded once ─────────────────────────────────────────────────
# Seed, never overwrite. A repository's numbers are measured, and a second run must not reset a
# ratchet somebody spent a release lowering.
if [ -f "$TARGET/.claude/tests.config.json" ]; then
  echo "keep   .claude/tests.config.json (already present)"
else
  cp "$SCRIPT_DIR/templates/starter.tests.config.json" "$STAGE/.claude/tests.config.json"
  echo "seed   .claude/tests.config.json"
fi
cp "$SCRIPT_DIR/tests.config.schema.json" "$STAGE/.claude/tests.config.schema.json"
echo "write  .claude/tests.config.schema.json"

# ── settings.json, merged ──────────────────────────────────────────────────
python3 - "$TARGET" "$STAGE" "$MARKET_NAME" <<'PY'
import json, pathlib, sys
target, stage, market = (pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3])
f = target / ".claude" / "settings.json"
d = json.loads(f.read_text()) if f.exists() else {}

markets = d.setdefault("extraKnownMarketplaces", {})
if market not in markets:
    markets[market] = {"source": {"source": "github", "repo": f"<owner>/{market}"}}
    print(f"NOTE: extraKnownMarketplaces.{market}.source.repo is a placeholder — set the real owner.")

enabled = d.setdefault("enabledPlugins", [])
entry = f"tests@{market}"
if entry not in enabled:
    enabled.append(entry)
    enabled.sort()
    print(f"enable {entry}")
else:
    print(f"keep   {entry} (already enabled)")

(stage / ".claude" / "settings.json").write_text(json.dumps(d, indent=2) + "\n")
PY

# ── move the stage into place, only now that everything above succeeded ─────
mkdir -p "$TARGET/.claude"
for f in "$STAGE"/.claude/*; do
  [ -e "$f" ] || continue
  mv "$f" "$TARGET/.claude/$(basename "$f")"
done

cat <<EOF

Installed. Two things the standard asks you to do rather than inherit:

  1. Measure your own numbers. .claude/tests.config.json ships coverage.uncoveredLineCap at 0 and
     an empty mutation.target on purpose — a ratchet's first value has to come from a real run, and
     a number copied from a template is a number nobody derived.

  2. Read what the standard declares blocked for you. A rule whose mechanism does not exist yet
     belongs in blockedRules with what it waits on, so the audit reports the block once instead of
     the same violation in forty files.

  Audit the tree with the test-auditor agent. It runs nothing expensive and writes nothing.
EOF
