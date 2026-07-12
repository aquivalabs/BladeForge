#!/usr/bin/env bash
# CICERO SessionStart hook — shows a one-time banner to the user and injects the
# always-on house voice (cicero.md) into the model's context for the session.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTENT="$ROOT/cicero.md"

BANNER=$(cat <<'EOF'
═══════════════════════════════════
C I C E R O — the house voice
"Speak so the point lands first."
bottom line·concise·honest·in scope
═══════════════════════════════════
EOF
)

# systemMessage -> shown to the user once at session start.
# additionalContext -> the house-voice rules, injected into model context.
jq -n --arg banner "$BANNER" --rawfile content "$CONTENT" \
  '{systemMessage: $banner, hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $content}}'
