#!/usr/bin/env bash
# CICERO SessionStart hook — shows a one-time banner and, on first run, asks which language the
# house voice should converse in, then persists it. The static voice RULES (Rule 0-14) do NOT
# live here — they ship as the force-for-plugin output style output-styles/cicero.md, applied at
# the system-prompt level whenever the plugin is on. This hook only carries what needs runtime
# logic (banner, version, language pick).
#
# Heredocs are read via `read -r -d ''` rather than $(cat <<EOF): macOS ships bash 3.2,
# which mis-parses a heredoc nested inside $(...) when the body contains quotes/apostrophes.
set -euo pipefail

CFG="$HOME/.claude/cicero/config.json"
LANG_CHOSEN=""
if [ -f "$CFG" ]; then
  LANG_CHOSEN="$(jq -r '.language // empty' "$CFG" 2>/dev/null || true)"
fi

# Loaded plugin version — printed in the banner so it's obvious at a glance whether
# this session runs a fresh build or a stale cached one. Read from the running copy's
# own plugin.json (CLAUDE_PLUGIN_ROOT is the installed/cached dir the hook executes from).
VER="$(jq -r '.version // empty' "${CLAUDE_PLUGIN_ROOT:-}/.claude-plugin/plugin.json" 2>/dev/null || true)"
[ -z "$VER" ] && VER="?"

read -r -d '' BANNER <<'EOF' || true
═══════════════════════════════════
C I C E R O — the house voice
"Speak so the point lands first."
bottom line·concise·honest·in scope
═══════════════════════════════════
EOF

read -r -d '' FIRSTRUN <<'EOF' || true

## First run — pick a voice language

No house-voice language is configured yet. Early in this session, ask the user which language the
house voice should converse in, then persist it: write {"language":"<code>"} to
~/.claude/cicero/config.json (create the dir). Do this once; after that the choice sticks.
EOF

if [ -n "$LANG_CHOSEN" ]; then
  SYSMSG="$BANNER
cicero v$VER · voice language: $LANG_CHOSEN"
  CONTEXT=""
else
  SYSMSG="$BANNER
cicero v$VER · no voice language set yet — I'll ask you to pick one"
  CONTEXT="$FIRSTRUN"
fi

# One-time notice: the voice now ships as a force-for-plugin output style. We CANNOT detect
# from a hook whether it actually applied (no documented "active output style" field in the
# SessionStart input), so this is informational, shown once, then silenced via a marker file.
NOTICE_MARK="$HOME/.claude/cicero/.voice-style-notice-seen"
if [ ! -f "$NOTICE_MARK" ]; then
  SYSMSG="$SYSMSG
──────────────────────────────────
note (shown once): CICERO is a force-for-plugin OUTPUT STYLE — while this plugin is enabled it is
injected into the system prompt and OVERRIDES your own outputStyle setting. You do not select it.
  heads-up: /config keeps showing YOUR saved style (often \"default\") — the plugin overrides that
  slot without changing what it displays, so \"default\" there does NOT mean the voice is off.
  confirm it is live → send me this exact line:
      Quote Rule 0 and Rule 14 of your active output style, verbatim.
    active   = I reply with the real rules (Rule 0 \"Readability first…\", Rule 14 \"end with a joke\").
    NOT active = I don't know them, or answer in generic terms.
  truly missing (older Claude Code, or a stale plugin)? run in order:
    /reload-plugins         — reload plugins in this session
    /plugin update cicero   — pull the latest plugin version
    update Claude Code       — if still missing, upgrade the CLI to the latest"
  mkdir -p "$HOME/.claude/cicero" && : > "$NOTICE_MARK" || true
fi

# systemMessage -> shown to the user once at session start.
# additionalContext -> dynamic voice context (first-run language pick only).
# The static rules are the output style, not this injection.
jq -n --arg banner "$SYSMSG" --arg content "$CONTEXT" \
  '{systemMessage: $banner, hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $content}}'
