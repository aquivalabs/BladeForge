#!/usr/bin/env bash
# CERBERUS push guard — a `git push` sends commits out, and a commit carries a message, an author,
# a committer and a branch name that no file-edit check ever reads. This hook stops a push until
# cerberus:leak-check has read those outgoing commits, then lets the same push through.
#
# The proof is a marker, not a denylist: after a clean read the agent writes the HEAD it checked to
# `$(git rev-parse --git-dir)/cerberus-leak-checked`. A push of exactly that HEAD passes; any new
# commit changes HEAD and asks again. The cerberus push-guard mod, where the engine loads mods,
# does the read itself and writes the same marker, so this hook then passes on its own.
#
# Fail-open on anything it cannot parse: a guard that breaks every Bash call is worse than none.
input="$(cat 2>/dev/null)"
command="$(printf '%s' "$input" | sed -nE 's/.*"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/p' | head -1)"
[ -n "$command" ] || exit 0
printf '%s' "$command" | grep -Eq '(^|[;&|(]|[[:space:]])git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+push([[:space:]]|$)' || exit 0

cwd="$(printf '%s' "$input" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$cwd" ] || cwd="$PWD"
gitdir="$(git -C "$cwd" rev-parse --absolute-git-dir 2>/dev/null)" || exit 0
head="$(git -C "$cwd" rev-parse HEAD 2>/dev/null)" || exit 0

# Nothing new to send: a push of an up-to-date branch carries no commit to check.
if git -C "$cwd" rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then
  [ -n "$(git -C "$cwd" rev-list '@{upstream}..HEAD' 2>/dev/null)" ] || exit 0
fi

[ "$(cat "$gitdir/cerberus-leak-checked" 2>/dev/null)" = "$head" ] && exit 0

reason="CERBERUS: this push sends commits whose messages, authors and branch name no file check has read. Run cerberus:leak-check on the outgoing commits first (git log @{upstream}..HEAD, or origin/main..HEAD for a new branch). When they are clean, record it with: git rev-parse HEAD > \\\"\$(git rev-parse --git-dir)/cerberus-leak-checked\\\" — then push again."
printf '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "%s"}}\n' "$reason"
exit 0
