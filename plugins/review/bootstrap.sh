#!/usr/bin/env bash
# One-command adoption of the review gate. Run from the root of the repo you want to protect:
#   bash <(gh api repos/Xaaalera/claude-skills/contents/plugins/review/bootstrap.sh -H "Accept: application/vnd.github.raw")
# Clones this marketplace shallowly to a temp dir, runs install.sh against your repo, cleans up.
set -euo pipefail

REPO="Xaaalera/claude-skills"
TARGET="${1:-$PWD}"

command -v gh >/dev/null || { echo "needs the GitHub CLI (gh) — install it and 'gh auth login' first" >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
gh repo clone "$REPO" "$tmp" -- --depth 1 -q
bash "$tmp/plugins/review/install.sh" "$TARGET"
