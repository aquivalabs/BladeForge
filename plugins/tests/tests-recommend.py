#!/usr/bin/env python3
"""Report what the recommended test environment is missing, and install only what is named.

Nothing here is a rule. A repository that declines every recommendation still meets the standard —
it just pays for the decline, and the point of this script is to say what it is paying rather than
to say "install this".

Report is the default mode and there is no --apply-all on the documented path. A recommendation that
installs itself is not a recommendation.

Reads files and runs nothing. A skill invocation that costs seconds is one people learn to avoid.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

# The recommended environment, grouped by role. Each entry: the package, what it buys, and what its
# absence costs — the third field is the one that earns the format, because nobody reconstructs a
# cost from memory six months later.
GROUPS: list[tuple[str, str | None, list[tuple[str, str, str]]]] = [
    ("the runner", "always required", [
        ("vitest", "the runner itself", "nothing runs"),
        ("jsdom", "the DOM tier's environment", "no component test can run"),
    ]),
    ("assertions and interaction", "the DOM tier cannot be written without them", [
        ("@testing-library/react", "rendering and queries", "component tests poke nodes by hand"),
        ("@testing-library/jest-dom", "DOM matchers", "assertions fall back to reading properties"),
        ("@testing-library/user-event", "interactions that model a person",
         "tests reach for whatever import resolves, and a synthetic single event is not a click"),
    ]),
    ("the gates", None, [
        ("@vitest/coverage-v8", "the coverage ratchet and floor", "nothing measures the suite"),
        ("eslint-plugin-testing-library", "query and async rules as a gate",
         "several of the standard's checks stay review notes instead of gates"),
        ("eslint-plugin-jest-dom", "assertion-strength rules", "weaker assertions pass review"),
    ]),
    ("the mutation gate", "the only mechanical check that a covered line is asserted on", [
        ("@stryker-mutator/core", "the mutation runner", "the coverage floor means less"),
        ("@stryker-mutator/vitest-runner", "drives the runner", "the gate cannot run"),
        ("@stryker-mutator/typescript-checker", "rejects a mutant that cannot compile",
         "every uncompilable mutant costs a full test run"),
    ]),
    ("optional, where a real invariant exists", None, [
        ("fast-check", "property tests over generated input",
         "the invariant axis has no mechanism; adopt it with the module that needs it, never up front"),
    ]),
]

# Weighed and refused, with the reason. Without this section somebody installs one of these in six
# months not knowing it was already considered.
REFUSED = [
    ("msw", "intercepts at the network layer, below the seam this standard substitutes at"),
    ("happy-dom", "faster than jsdom and a narrower DOM; every component test would need re-verifying"),
    ("a coverage comment bot", "the threshold already gates; a number nobody can act on is noise"),
]

CONFIG_ARTIFACTS = [
    ("the tier split", "vite.config.ts", "projects",
     "one environment is built for every file, including the ones that never read a DOM"),
    ("coverage thresholds", "vite.config.ts", "thresholds",
     "coverage is measurable and unmeasured"),
    ("the test lint block", "eslint.config.js", "testing-library",
     "the two plugins above are installed and enforce nothing"),
    ("the config", ".claude/tests.config.json", None,
     "the standard is audited against defaults rather than this repository's numbers"),
]


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def installed(root: Path) -> dict[str, str]:
    pkg = read_json(root / "package.json")
    return {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}


def file_mentions(root: Path, name: str, token: str | None) -> bool:
    p = root / name
    if not p.exists():
        return False
    if token is None:
        return True
    try:
        return token in p.read_text()
    except Exception:
        return False


def state_of(pkg: str, deps: dict[str, str], root: Path) -> str:
    """present · installed-not-wired · absent. The middle one is the obituary nobody writes."""
    if pkg not in deps:
        return "absent"
    if pkg.startswith("eslint-plugin-") and not file_mentions(root, "eslint.config.js", "testing-library"):
        return "installed, not wired"
    return "present"


def full_tree(root: Path, deps: dict[str, str]) -> list[str]:
    out = ["**Recommended environment**", "│"]
    for gi, (group, note, items) in enumerate(GROUPS):
        last_group = gi == len(GROUPS) - 1 and not CONFIG_ARTIFACTS
        stem = "└─" if last_group else "├─"
        head = f"{stem} **{group}**" + (f" — {note}" if note else "")
        out.append(head)
        pipe = "  " if last_group else "│ "
        for ii, (pkg, buys, _cost) in enumerate(items):
            leaf = "└─" if ii == len(items) - 1 else "├─"
            out.append(f"{pipe} {leaf} `{pkg}` · {state_of(pkg, deps, root)} · {buys}")
        out.append("│")
    out.append("└─ **config artifacts**")
    for ii, (label, where, token, _cost) in enumerate(CONFIG_ARTIFACTS):
        leaf = "└─" if ii == len(CONFIG_ARTIFACTS) - 1 else "├─"
        st = "present" if file_mentions(root, where, token) else "absent"
        out.append(f"   {leaf} {label} · {st} · `{where}`")
    out += ["", "**Considered and not taken**"]
    for ii, (name, why) in enumerate(REFUSED):
        leaf = "└─" if ii == len(REFUSED) - 1 else "├─"
        out.append(f"{leaf} `{name}` — {why}")
    return out


def gaps(root: Path, deps: dict[str, str]) -> list[str]:
    rows: list[tuple[str, str, str]] = []
    for _g, _n, items in GROUPS:
        for pkg, _buys, cost in items:
            st = state_of(pkg, deps, root)
            if st != "present":
                rows.append((f"`{pkg}` is {st}", cost, pkg))
    for label, where, token, cost in CONFIG_ARTIFACTS:
        if not file_mentions(root, where, token):
            rows.append((f"{label} is absent from `{where}`", cost, label))
    if not rows:
        return []
    out = ["**Missing, and what it costs**", "│"]
    for i, (what, cost, _key) in enumerate(rows):
        leaf = "└─" if i == len(rows) - 1 else "├─"
        out.append(f"{leaf} {what}")
        out.append(f"{'   ' if i == len(rows) - 1 else '│  '}*{cost}*")
        if i != len(rows) - 1:
            out.append("│")
    return out


def session_marker() -> Path:
    """Once per session. A block that prints every time becomes wallpaper, and wallpaper beside a
    signal kills the signal. The fallback keys off the temp dir: in a cron or CI run there is no
    human to read this, so printing once is right."""
    sid = os.environ.get("CLAUDE_CODE_SESSION_ID", "nosession")
    return Path(tempfile.gettempdir()) / f".tests-recommend.{sid}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--report", action="store_true", help="print everything, ignore the session marker")
    ap.add_argument("--apply", nargs="+", metavar="NAME", help="install only the packages named")
    ap.add_argument("--root", type=Path, default=Path.cwd())
    args = ap.parse_args()

    root = args.root
    deps = installed(root)

    if args.apply:
        known = {p for _g, _n, items in GROUPS for p, _b, _c in items}
        unknown = [n for n in args.apply if n not in known]
        if unknown:
            print(f"not recommended by this standard, so not installed: {', '.join(unknown)}",
                  file=sys.stderr)
            return 2
        cmd = ["npm", "install", "--save-dev", *args.apply]
        print(f"$ {' '.join(cmd)}")
        return subprocess.run(cmd, cwd=root, check=False).returncode

    if args.report:
        print("\n".join(full_tree(root, deps)))
        g = gaps(root, deps)
        if g:
            print()
            print("\n".join(g))
        return 0

    marker = session_marker()
    if marker.exists():
        return 0
    try:
        marker.touch()
    except OSError:
        pass

    print("\n".join(full_tree(root, deps)))
    g = gaps(root, deps)
    if g:
        print()
        print("\n".join(g))
        print()
        print("Install only what you name: `tests-recommend --apply <package>`")
    return 0


if __name__ == "__main__":
    sys.exit(main())
