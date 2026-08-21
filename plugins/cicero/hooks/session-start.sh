#!/usr/bin/env bash
# CICERO SessionStart hook — shows a banner with the notation legend and, on first run, asks which
# language the house voice should converse in, then persists it. The static voice RULES (Rule 0 and
# the numbered rules) do NOT live here — they ship as the force-for-plugin output style
# output-styles/cicero.md, applied at the system-prompt level whenever the plugin is on. This hook
# only carries what needs runtime logic (banner, version, legend, language pick).
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

# A hook systemMessage reaches the terminal as PLAIN TEXT: markdown is never processed there, so
# **stars** and `backticks` would show up literally — that is what the legend used to do. Real ANSI
# escapes DO survive, so banner and legend style themselves with escapes instead. The palette below
# mirrors what the markdown renderer does to an assistant message, which is the whole point of the
# legend: bold heading, cyan locator, italic aside, dim annotation.
#
# Inverse video (INV) is the one device with no markdown counterpart. It is spent on the two things
# that must survive a skimming eye — the voice's four keywords, and nothing else. It paints a filled
# bar, so the rule above it is cut to the bar's padded width and the two read as one unit.
E=$'\033'
BOLD="${E}[1m"; DIM="${E}[2m"; ITAL="${E}[3m"; CYAN="${E}[36m"; INV="${E}[7m"; OFF="${E}[0m"
MARK="${CYAN}${BOLD}"

if [ -n "$LANG_CHOSEN" ]; then
  META="v$VER · $LANG_CHOSEN"
else
  META="v$VER · no voice language set yet"
fi

# The wordmark is drawn with half-block glyphs (two rows, not five): the terminal renders a hook
# message with generous line spacing, so a five-row figlet would eat half the screen. No right-hand
# border anywhere in this file — a frame that has to line up is a frame that breaks the first time
# the window is narrower than it is.
#
# TWO RULES KEEP THE TWO ROWS UNDER ONE LEFT EDGE, and breaking either one sprays the letters across
# the screen. The terminal prints the first line of a hook message AFTER the "SessionStart:… says:"
# label and indents every following line to that label's column — so:
#   1. The art NEVER occupies the first line. Line one is the meta text, which reads naturally right
#      after the label; the two art rows are lines two and three, sharing one left edge.
#   2. NOTHING sits to the right of an art row. A tail there wraps on a narrow window and shifts one
#      half of the letters out from under the other.
# The rows still do not quite touch — the terminal sets its lines with a gap and the font insets its
# block glyphs — so the letters carry a hairline seam. That is a font trait, not a bug to redraw
# around, and the wordmark is kept because it is the wordmark.
read -r -d '' BANNER <<EOF || true
${DIM}the house voice · ${META}${OFF}
${MARK}▄▀▀ █ ▄▀▀ ██▀ █▀▄ ▄▀▄${OFF}
${MARK}▀▄▄ █ ▀▄▄ █▄▄ █▀▄ ▀▄▀${OFF}
${DIM}───────────────────────────────────────────${OFF}
${INV} bottom line · concise · honest · in scope ${OFF}
EOF

# The notation legend, shown every session. The output style holds the RULE — the six-axis table in
# Rule 16, written for the model. This holds one worked EXAMPLE of it, written for the human, who
# never sees that file. Deliberately an example and not a copy of the table: a second copy of the
# rows would drift, an example only has to stay true to them. Each line is styled as the axis it
# describes, so the legend demonstrates rather than asserts.
read -r -d '' LEGEND <<EOF || true
${DIM}── how a list of findings is drawn ──${OFF}
${BOLD}BLOCKERS${OFF} ${DIM}— upper case: this group stops the work${OFF}
│
└─ the finding itself, in plain text
   ${CYAN}path/to/file.ts:42${OFF} ${DIM}— a code span: where to look${OFF}
   ${ITAL}an aside you may skip${OFF} ${DIM}— italic: quieter, never the point${OFF}

${BOLD}majors${OFF} ${DIM}— lower case: does not stop the work${OFF}
├─ one-line entries run flush, no blank line between them
└─ an entry with detail gets a blank line, and │ carries down
EOF

read -r -d '' FIRSTRUN <<'EOF' || true

## First run — pick a voice language

No house-voice language is configured yet. Early in this session, ask the user which language the
house voice should converse in, then persist it: write {"language":"<code>"} to
~/.claude/cicero/config.json (create the dir). Do this once; after that the choice sticks.
EOF

SYSMSG="$BANNER

$LEGEND"
if [ -n "$LANG_CHOSEN" ]; then
  CONTEXT=""
else
  CONTEXT="$FIRSTRUN"
fi

# One-time notice: the voice now ships as a force-for-plugin output style. We CANNOT detect
# from a hook whether it actually applied (no documented "active output style" field in the
# SessionStart input), so this is informational, shown once, then silenced via a marker file.
NOTICE_MARK="$HOME/.claude/cicero/.voice-style-notice-seen"
if [ ! -f "$NOTICE_MARK" ]; then
  SYSMSG="$SYSMSG

${BOLD}note, shown once${OFF} ${DIM}— CICERO is a force-for-plugin OUTPUT STYLE. While this plugin is enabled it is
injected into the system prompt and OVERRIDES your own outputStyle setting. You do not select it.${OFF}
  ${DIM}/config keeps showing YOUR saved style (often \"default\") — the plugin overrides that slot
  without changing what it displays, so \"default\" there does NOT mean the voice is off.${OFF}
  confirm it is live → send me this exact line:
      ${CYAN}Quote Rule 0 and Rule 13 of your active output style, verbatim.${OFF}
    ${DIM}active     = I reply with the real rules (Rule 0 \"Readability first…\", Rule 13 \"a joke is optional, final message only\").
    NOT active = I don't know them, or answer in generic terms.${OFF}
  truly missing (older Claude Code, or a stale plugin)? run in order:
    ${CYAN}/reload-plugins${OFF}         ${DIM}reload plugins in this session${OFF}
    ${CYAN}/plugin update cicero${OFF}   ${DIM}pull the latest plugin version${OFF}
    ${DIM}then upgrade the Claude Code CLI itself if it is still missing${OFF}"
  mkdir -p "$HOME/.claude/cicero" && : > "$NOTICE_MARK" || true
fi

# One-time colour-capability notice. CICERO's terminal channel — this very message, and the
# statusline — styles itself with real ANSI escapes, and the harness syntax-highlights code and
# diffs. Both degrade when the emulator does not advertise 24-bit colour, and most emulators that
# SUPPORT it do not set COLORTERM themselves: tools then fall back to 256 colours or to none, with
# nothing on screen saying why. Measured on JetBrains JediTerm — TERM=xterm-256color, COLORTERM
# unset, and code stopped being coloured.
#
# NO marker file here, deliberately — unlike the output-style notice above, which needs one because
# nothing about it self-clears. This condition does: the moment COLORTERM is set the check fails and
# the block stops appearing, so the fix silences it and nothing else has to. A marker would instead
# mean that a user who scrolled past it once never sees it again while the problem persists — which
# is the opposite of what a one-line, still-broken, still-fixable condition wants. The hook fires
# once per session by construction, so once per session is what this is.
#
# Gated on an emulator we can name: an unknown terminal may genuinely lack truecolor, and telling its
# user to claim otherwise would be worse than silence.
if [ -z "${COLORTERM:-}" ]; then
  KNOWN=""
  case "${TERMINAL_EMULATOR:-}${TERM_PROGRAM:-}" in
    *JediTerm*|*iTerm*|*Apple_Terminal*|*vscode*|*WezTerm*|*ghostty*|*kitty*|*Alacritty*|*Hyper*)
      KNOWN="${TERMINAL_EMULATOR:-${TERM_PROGRAM:-}}" ;;
  esac
  if [ -n "$KNOWN" ]; then
    SYSMSG="$SYSMSG

${BOLD}colour is degraded in this terminal${OFF} ${DIM}— shown once${OFF}
  ${DIM}\$COLORTERM is unset, so tools fall back to 256 colours or none. Code and diffs stop being
  syntax-highlighted, and this banner loses its palette. Your emulator (${KNOWN}) supports 24-bit
  colour — it just does not advertise it.${OFF}
  fix, one line in your shell profile:
      ${CYAN}export COLORTERM=truecolor${OFF}
    ${DIM}then open a NEW terminal tab and check: echo \$COLORTERM${OFF}"
  fi
fi

# systemMessage -> shown to the user once at session start.
# additionalContext -> dynamic voice context (first-run language pick only).
# The static rules are the output style, not this injection.
jq -n --arg banner "$SYSMSG" --arg content "$CONTEXT" \
  '{systemMessage: $banner, hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $content}}'
