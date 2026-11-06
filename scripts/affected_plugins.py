#!/usr/bin/env python3
"""The plugins whose installed payload changed: changed paths on stdin, one plugin name per line out.

Used by .github/workflows/scout-publish.yml to decide which plugin versions to bump. RMA-415.
"""
import sys
from fnmatch import fnmatch

# Paths under plugins/<name>/ that never reach a user's session: a change here needs no new version.
NOT_PAYLOAD = (
    "plugins/*/.claude-plugin/plugin.json",
    "plugins/scout/skills/scout/catalog.json",
    "*.test.*",
    "*/tests/*",
    "*/test/*",
    "*/evals/*",
    "*/metadata.yaml",
)


def is_payload(path: str) -> bool:
    """True when the path is part of what a user installs and loads."""
    return path.startswith("plugins/") and path.count("/") >= 2 and not any(fnmatch(path, pattern) for pattern in NOT_PAYLOAD)


def affected(paths) -> list:
    """The sorted, distinct plugin names that own a payload path."""
    return sorted({path.split("/")[1] for path in paths if is_payload(path)})


if __name__ == "__main__":
    print("\n".join(affected(line.strip() for line in sys.stdin if line.strip())))
