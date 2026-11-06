#!/usr/bin/env bash
# machine-health SessionStart hook. It never downloads: with no binary installed it prints one line
# and exits; otherwise the binary scans and prints the "You should know" block (plan § Language and
# distribution).
root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../bin/paths.sh
source "$root/bin/paths.sh"

if [[ ! -x "$MH_BIN" ]]; then
  # Claude tells the user, in their language; the plugin prints nothing to the user itself.
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"machine-health is installed as a plugin but its binary is not. Tell the user in their language, in one sentence, to run /machine-health:install."}}\n'
  exit 0
fi
MACHINE_HEALTH_EXPECTED_VERSION="$(mh_lock_version)" exec "$MH_BIN" hook
