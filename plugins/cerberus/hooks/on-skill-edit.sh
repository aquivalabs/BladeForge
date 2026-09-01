#!/usr/bin/env bash
# CERBERUS trigger — after a skill / reference / eval / manifest edit, remind to run
# the `cerberus:leak-check` skill. Path-only by design (inspects only the file path,
# never content — a denylist here would itself be the leak). Fail-open: any error exits 0.
#
# Shell rewrite of the former on-skill-edit.py. Hooks are shell-first here — startup
# ~5ms vs ~40ms for python on the same work; rationale in docs/adr/0002.
input="$(cat 2>/dev/null)"
path="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$path" ] || exit 0

p="$(printf '%s' "$path" | tr '\\' '/')"
name="${p##*/}"

in_scope=0
case "$p" in
  */skills/*|*/references/*|*/evals/*) in_scope=1 ;;
esac
case "$name" in
  SKILL.md|plugin.json|marketplace.json) in_scope=1 ;;
esac
[ "$in_scope" -eq 1 ] || exit 0

note="CERBERUS: skill/eval content changed — run the \`cerberus:leak-check\` skill on this change before committing. This is a PUBLIC marketplace: rewrite any real work identifier (class/object/namespace/org/ticket/name/email/secret) to a neutral fictional demo first."
printf '{"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": "%s"}}\n' "$note"
exit 0
