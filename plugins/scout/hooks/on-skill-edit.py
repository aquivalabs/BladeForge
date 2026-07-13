#!/usr/bin/env python3
"""SCOUT sync-nudge — after a skill's SKILL.md or a bundled script is edited, remind
the author to refresh its `metadata.yaml` sidecar via the `update-skill` skill.

Pure path-only trigger by design: it inspects ONLY the single `tool_input.file_path`
this hook invocation received — it CANNOT see the diff, the staging area, or any other
file that may or may not have changed alongside it. So its scope is deliberately
PATH-ONLY. It has no way to detect the real cross-file condition ("SKILL.md changed
WITHOUT a matching metadata.yaml change") from a single-file payload — that staleness
check requires comparing multiple files across a diff, which is the scout GATE's job
(CI-side, operating on `origin/main..HEAD`), not this hook's. Do not attempt diff
reasoning here. Fail-open: any error exits 0.
"""
import json
import sys
from pathlib import Path

SKILL_SCRIPT_SUFFIXES = (".py", ".sh")


def _in_scope(path: str) -> bool:
    p = path.replace("\\", "/")
    if not p:
        return False
    if Path(p).name == "SKILL.md":
        return True
    if "/skills/" in p and Path(p).suffix in SKILL_SCRIPT_SUFFIXES:
        return True
    return False


def main():
    try:
        path = (json.load(sys.stdin).get("tool_input") or {}).get("file_path", "")
    except Exception:
        sys.exit(0)
    if not _in_scope(path):
        sys.exit(0)
    note = (
        "SCOUT: you edited a skill's SKILL.md / script — refresh its `metadata.yaml` "
        "via the `update-skill` skill before committing."
    )
    print(json.dumps(
        {"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": note}},
        ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
