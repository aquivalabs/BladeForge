#!/usr/bin/env bash
# CERBERUS version check — the push-guard mod (push-guard.ts) judges outgoing commits in-process,
# but only an engine that loads function-hooks mods runs it. An older Claude Code skips the module
# silently and keeps only the classic push guard, so the person is told, loudly, at the start of
# the session. The minimum is the version the mod was tested on.
# Fail-open: no claude on PATH, or a version it cannot parse, prints nothing.
MIN="2.1.292"
have="$(claude --version 2>/dev/null | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
[ -n "$have" ] || exit 0
lowest="$(printf '%s\n%s\n' "$MIN" "$have" | sort -t. -k1,1n -k2,2n -k3,3n | head -1)"
[ "$lowest" = "$MIN" ] && exit 0

# Written as JSON already: \n and \u001b are the JSON escapes for a newline and ESC. The first line
# of a hook message prints after its label, so the banner starts on line two.
R='\u001b[1;31m' BAR='\u001b[1;41;97m' OFF='\u001b[0m'
printf '{"systemMessage": "\\n%s  CERBERUS: UPDATE CLAUDE CODE  %s\\n%sClaude Code %s cannot load the cerberus push-guard mod (needs %s or newer). The classic push guard still judges every push.%s\\n%sUpdate now: claude update%s"}\n' \
  "$BAR" "$OFF" "$R" "$have" "$MIN" "$OFF" "$R" "$OFF"
