#!/usr/bin/env bash
# CERBERUS trigger — after a skill / reference / eval / manifest edit, remind to run
# the cerberus heads (leak-check + security-scan). Path-only by design (inspects only the file path,
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
  */skills/*|*/references/*|*/evals/*|*/scripts/*) in_scope=1 ;;
esac
case "$name" in
  SKILL.md|plugin.json|marketplace.json) in_scope=1 ;;
esac
[ "$in_scope" -eq 1 ] || exit 0

note="CERBERUS: skill/script/eval content changed — run BOTH cerberus heads before committing. \`cerberus:leak-check\` (outward): rewrite any real work identifier to a neutral fictional demo. \`cerberus:security-scan\` (inward): check the eight-point checklist — prompt injection, exfiltration, secrets, dangerous commands, obfuscation, external fetches, credential access, privilege escalation — so nothing unsafe reaches whoever installs it."
printf '{"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": "%s"}}\n' "$note"
exit 0
