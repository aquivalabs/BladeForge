#!/usr/bin/env bash
# CERBERUS push guard — a `git push` sends commits out, and a commit carries a message, an author,
# a committer and a branch name that no file-edit check ever reads. This hook judges those outgoing
# commits ITSELF before an agent's push runs: it hands them to a nested `claude -p` with the prompt
# in push-judge-prompt.txt and denies the push when the judge names a leak.
#
# The judge is not the agent's to skip: the hook runs it, not a marker the agent writes. Its one
# weak point is the verdict cache below, which a shell can still forge on purpose. The verdict is cached by
# the hash of what is judged (the outgoing log plus the branch name), so a reworded commit, a new
# commit or a renamed branch is judged afresh, and an unchanged push is not judged twice. The
# cerberus push-guard mod, where the engine loads mods, judges first and fills the same cache.
#
# Fail-closed once a push is recognised: a judge that cannot answer denies the push. Fail-open
# only before that, on input this hook cannot parse — a guard that breaks every Bash call is worse
# than none.
HERE="$(cd "$(dirname "$0")" && pwd)"
input="$(cat 2>/dev/null)"

command="$(printf '%s' "$input" | sed -nE 's/.*"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/p' | head -1)"
path="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"

# The verdict cache is the guard's own record. A tool call that writes into it would be skipping
# the judge, so a command or a file path aimed at it is refused — best effort: a determined forger
# with a shell can still reach it, but no one reaches it by accident or by one obvious command.
case "$command $path" in
  *cerberus-verdicts*)
    printf '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "CERBERUS: only the push guard writes its verdicts. Push, and it judges the outgoing commits itself."}}\n'
    exit 0 ;;
esac
[ -n "$command" ] || exit 0
printf '%s' "$command" | grep -Eq '(^|[;&|(]|[[:space:]])git([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+)*[[:space:]]+push([[:space:]]|$)' || exit 0

cwd="$(printf '%s' "$input" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$cwd" ] || cwd="$PWD"
g() { git -C "$cwd" "$@" 2>/dev/null; }
gitdir="$(g rev-parse --absolute-git-dir)" || exit 0

deny() {
  printf '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "%s"}}\n' \
    "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')"
  exit 0
}

# What would leave: the commits past the upstream, or past origin's default branch for a new one.
if g rev-parse --abbrev-ref '@{upstream}' >/dev/null; then base='@{upstream}'
elif g rev-parse --verify -q origin/HEAD >/dev/null; then base='origin/HEAD'
elif g rev-parse --verify -q origin/main >/dev/null; then base='origin/main'
else base=''
fi
FMT='%h author: %an <%ae> committer: %cn <%ce>%n%B%n---'
if [ -n "$base" ]; then log="$(g log --format="$FMT" "$base..HEAD")"; else log="$(g log --format="$FMT" HEAD)"; fi
[ -n "$log" ] || exit 0
branch="$(g branch --show-current)"

key="$(printf '%s\n%s' "$log" "$branch" | git hash-object --stdin)"
verdicts="$gitdir/cerberus-verdicts"
[ -f "$verdicts/$key" ] && exit 0

prompt="$(cat "$HERE/push-judge-prompt.txt")

<branch>$branch</branch>
<commits>
$log
</commits>"
judgedir="$(mktemp -d)"
answer="$(cd "$judgedir" && printf '%s' "$prompt" | env -u CLAUDECODE claude -p --model sonnet \
  --setting-sources project --strict-mcp-config --output-format text 2>/dev/null)"
rm -rf "$judgedir"
verdict="$(printf '%s' "$answer" | node -e '
let d = ""; process.stdin.on("data", c => d += c).on("end", () => {
  try {
    const o = JSON.parse(d.slice(d.indexOf("{"), d.lastIndexOf("}") + 1));
    if (!Array.isArray(o.leaks)) throw 0;
    console.log(o.leaks.length ? "LEAK " + o.leaks.map(l => `${l.where}: ${l.what}`).join("; ") : "CLEAN");
  } catch { console.log("UNSURE"); }
});' 2>/dev/null)"

case "$verdict" in
  CLEAN)
    mkdir -p "$verdicts" && printf 'clean\n' > "$verdicts/$key"
    exit 0 ;;
  LEAK*)
    deny "CERBERUS: this push would publish work fingerprints in its commits — ${verdict#LEAK }. Fix them with cerberus:leak-check (amend or reword the commits, reset a work author, rename the branch), then push again." ;;
  *)
    deny "CERBERUS: the push guard could not judge the outgoing commits (no answer from claude -p). The push stays blocked until it can: check that claude is on PATH and signed in, then push again." ;;
esac
