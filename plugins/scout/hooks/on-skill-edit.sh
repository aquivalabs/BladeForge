#!/usr/bin/env bash
# SCOUT sync-nudge — after a skill's SKILL.md or a bundled script is edited, remind the
# author to refresh its `metadata.yaml` sidecar via the `update-skill` skill. Path-only
# by design: it sees ONLY this one file_path, never a diff — the cross-file staleness
# check ("SKILL.md changed WITHOUT metadata.yaml") is the scout GATE's job, not this
# hook's. Do not add diff reasoning here. Fail-open: any error exits 0.
#
# Shell rewrite of the former on-skill-edit.py. Hooks are shell-first here — rationale
# in docs/adr/0002.
input="$(cat 2>/dev/null)"
path="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$path" ] || exit 0

p="$(printf '%s' "$path" | tr '\\' '/')"
name="${p##*/}"

in_scope=0
if [ "$name" = "SKILL.md" ]; then
  in_scope=1
else
  case "$p" in
    */skills/*)
      case "$name" in
        *.py|*.sh) in_scope=1 ;;
      esac
      ;;
  esac
fi
[ "$in_scope" -eq 1 ] || exit 0

note="SCOUT: you edited a skill's SKILL.md / script — refresh its \`metadata.yaml\` via the \`update-skill\` skill before committing."
printf '{"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": "%s"}}\n' "$note"
exit 0
