#!/usr/bin/env python3
"""CERBERUS trigger — after a skill / reference / eval / manifest edit, remind to run
the `cerberus:leak-check` skill.

Pure trigger by design: it inspects ONLY the file path, never the content — so this
file holds no denylist and names nothing real (a list of the secrets/brands to catch
would itself be the leak). All judgment lives in the cerberus:leak-check skill, at the
agent level. Fail-open: any error exits 0.
"""
import json
import sys
from pathlib import Path

IN_SCOPE = ("/skills/", "/references/", "/evals/")
IN_SCOPE_NAMES = ("SKILL.md", "plugin.json", "marketplace.json")


def main():
    try:
        path = (json.load(sys.stdin).get("tool_input") or {}).get("file_path", "")
    except Exception:
        sys.exit(0)
    p = path.replace("\\", "/")
    if not path or not (any(s in p for s in IN_SCOPE) or Path(p).name in IN_SCOPE_NAMES):
        sys.exit(0)
    note = (
        "CERBERUS: skill/eval content changed — run the `cerberus:leak-check` skill on "
        "this change before committing. This is a PUBLIC marketplace: rewrite any real "
        "work identifier (class/object/namespace/org/ticket/name/email/secret) to a "
        "neutral fictional demo first."
    )
    print(json.dumps(
        {"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": note}},
        ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
