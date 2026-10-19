#!/usr/bin/env bash
# CERBERUS push guard, classic layer — the PreToolUse entry point. It runs on every Bash, Write and
# Edit call, so it decides "not a push" with bash builtins alone and starts no process for that
# common case. Anything that mentions a push or the guard's own state goes to on-git-push.mjs,
# which parses the call properly and judges the outgoing commits (see its header).
# `read` from fd 0, never `$(</dev/stdin)`: a hook's stdin is a socket when Node spawns it, and on
# Linux opening /dev/stdin on a socket fails, which left the input empty and let every push through.
IFS= read -r -d '' input || true
[[ $input == *push* || $input == *cerberus* ]] || exit 0
exec node "$(dirname "$0")/on-git-push.mjs" <<<"$input"
