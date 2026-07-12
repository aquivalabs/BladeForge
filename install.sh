#!/usr/bin/env bash
# One-shot per clone: route git hooks to the versioned hooks/ dir and make the
# gate scripts executable. Safe to re-run.
set -e
ROOT="$(git rev-parse --show-toplevel)"
git -C "$ROOT" config core.hooksPath hooks
chmod +x "$ROOT/hooks/pre-push" "$ROOT/scripts/eval-gate.sh" "$ROOT/scripts/validate_eval.py"
echo "eval-gate installed: core.hooksPath -> hooks"
