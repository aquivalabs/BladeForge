#!/usr/bin/env bash
# CERBERUS version check — the push-guard mod (push-guard.ts) judges outgoing commits before a
# push, but only an engine that loads function-hooks mods runs it. An older Claude Code skips the
# module silently and keeps only the basic push check (on-git-push.sh), so the person is told,
# loudly, at the start of the session. The minimum is the version the mod was tested on.
# Fail-open: no claude on PATH, or a version it cannot parse, prints nothing.
MIN="2.1.292"
have="$(claude --version 2>/dev/null | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
[ -n "$have" ] || exit 0
lowest="$(printf '%s\n%s\n' "$MIN" "$have" | sort -t. -k1,1n -k2,2n -k3,3n | head -1)"
[ "$lowest" = "$MIN" ] && exit 0

# The first line of a hook message prints after its label, so the banner starts on line two.
esc=$'\033'
msg="\n${esc}[1;41;97m  CERBERUS: UPDATE CLAUDE CODE  ${esc}[0m\n${esc}[1;31mClaude Code ${have} cannot load the cerberus push-guard mod (needs ${MIN} or newer). Only the basic push check runs: a leak in a commit message is caught only if someone runs cerberus:leak-check.${esc}[0m\n${esc}[1;31mUpdate now: claude update${esc}[0m"
# msg holds only JSON-safe "\n" escapes and ESC bytes: quote the quotes, spell ESC as \u001b.
json="$(printf '%s' "$msg" | sed 's/"/\\"/g' | sed "s/${esc}/\\\\u001b/g")"
printf '{"systemMessage": "%s"}\n' "$json"
exit 0
