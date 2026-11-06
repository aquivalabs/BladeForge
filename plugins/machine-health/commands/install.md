---
description: Install the machine-health binary pinned in bin.lock.json, checking its SHA-256
---

Run `bash "${CLAUDE_PLUGIN_ROOT}/bin/install.sh"` with the Bash tool and report its output to the
user in one or two sentences.

If it says no release binary exists yet and `go` is installed, offer to build from source with
`bash "${CLAUDE_PLUGIN_ROOT}/bin/install.sh" --from-source`, and run it only on the user's yes.
