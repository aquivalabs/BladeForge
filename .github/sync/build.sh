#!/usr/bin/env bash
# Build BladeForge content from a source-repo checkout.
# Usage: .github/sync/build.sh <path-to-source-checkout>
set -euo pipefail
SRC="${1:?usage: build.sh <source-checkout>}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
EXCLUDE="$ROOT/.github/sync/exclude.txt"

# 1. reset synced trees
rm -rf plugins scripts
mkdir -p plugins

# 2. copy non-excluded plugins
for dir in "$SRC"/plugins/*/; do
  name="$(basename "$dir")"
  if grep -qxF "$name" "$EXCLUDE"; then
    echo "skip (excluded): $name"; continue
  fi
  cp -R "$dir" "plugins/$name"
  echo "sync: $name"
done

# 3. copy scripts/ (needed by the eval gate)
cp -R "$SRC/scripts" scripts

# 4. regenerate marketplace.json
mkdir -p .claude-plugin
plugins_json="$(
  for dir in plugins/*/; do
    name="$(basename "$dir")"
    desc="$(jq -r '.description // ""' "$dir/.claude-plugin/plugin.json" 2>/dev/null || echo "")"
    jq -n --arg n "$name" --arg d "$desc" \
      '{name:$n, description:$d, author:{name:"aquivalabs"}, source:("./plugins/"+$n)}'
  done | jq -s '.'
)"
jq -n --argjson plugins "$plugins_json" \
  '{name:"bladeforge",
    owner:{name:"aquivalabs"},
    metadata:{description:"BladeForge — aquivalabs Claude Code skills marketplace.", version:"1.0.0"},
    plugins:$plugins}' > .claude-plugin/marketplace.json
echo "wrote .claude-plugin/marketplace.json ($(echo "$plugins_json" | jq length) plugins)"
