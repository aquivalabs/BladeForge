#!/usr/bin/env python3
"""Validate a skill's metadata.yaml sidecar AND run a tool->tag contradiction
check against its actual side effects (declared hooks, bundled scripts,
allowed-tools frontmatter).

This is the CONTRACT every other scout component binds to. It is a cheap,
deterministic CONTRADICTION FLAG + honest labeling, NOT a soundness proof:
self-attestation (metadata.yaml's `changes`) is the primary source of truth,
and a `Bash` grant can't be told read-only from mutating just by its name.

Per skill this emits ONE verdict:
  - ok             -- valid metadata.yaml + no contradiction.
  - fail(reason)   -- a validity error, OR the ONE CLEAR contradiction: the
                      author's own `allowed-tools` frontmatter grants an
                      unambiguously mutating tool while `changes.tags` is
                      empty. Blocks. Nonzero exit,
                      `SystemExit("<skill-dir> :: <reason>")`.
  - self-asserted(reason) -- an ambiguity the author asserts is safe (a
                      declared plugin hook, a bundled script matching a
                      mutating pattern, broad Bash grant, semantic money/org
                      tags, unrecognized tool). NOT blocked: exit 0, with a
                      stdout marker line.

CLI:
    python3 scripts/scout_validate.py <path-to-skill-dir>

Also importable: `validate_skill(skill_dir, known_skill_ids=None) -> Verdict`.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import yaml

# --------------------------------------------------------------------------
# Data tables (the CONTRACT — keep these as literal, documented data).
# --------------------------------------------------------------------------

# The ONLY allowed values for changes.tags in metadata.yaml.
ALLOWED_TAGS = {"git", "files", "network", "org", "money", "other"}

# Tool -> (tags implied, mutation class).
#   "mutating"  == unambiguously a side-effecting grant -> a clear contradiction
#                  if the skill declares no matching tag.
#   "broad"     == ambiguous grant (could be read-only or mutating) -> never a
#                  clear fail on its own; flags self-asserted instead.
# Semantic tags (money, org) intentionally map to NO tool/grant: they are
# inherently author-declared and unverifiable from tooling alone.
TOOL_TAG_MAP = {
    "Write":     {"tags": {"files"},   "class": "mutating"},
    "Edit":      {"tags": {"files"},   "class": "mutating"},
    "MultiEdit": {"tags": {"files"},   "class": "mutating"},
    "WebFetch":  {"tags": {"network"}, "class": "mutating"},
    "WebSearch": {"tags": {"network"}, "class": "mutating"},
    "Bash":      {"tags": set(),       "class": "broad"},
}

# Mutating shell/script patterns (checked with word-boundary matching, after
# stripping `#`-comments). Small, representative set -- not exhaustive. A line
# containing the literal `# scout-ignore` suppresses a match on that line.
# ADVISORY ONLY: a match never blocks -- it can only add a self-asserted mark.
MUTATING_PATTERNS = [
    r"\bgit\s+push\b",
    r"\bgit\s+commit\b",
    r"\bgit\s+rebase\b",
    r"\brm\s",
    r"\bmv\s",
    r"\bcp\s",
    r"\bcurl\b",
    r"\bwget\b",
    r">>?\s*[^&\s]",       # shell redirect to a file (not >&2 etc.)
    r"\bsf\s+project\s+deploy\b",
    r"\bsf\s+apex\s+run\b",
    r"\.write_text\(",
    r"\.write\(",
    r"\bopen\([^)]*['\"]w",  # open(..., "w"/"wb"/...)
]
_MUTATING_RE = [re.compile(p) for p in MUTATING_PATTERNS]

SCOUT_IGNORE_MARKER = "# scout-ignore"

SCRIPT_SUFFIXES = {".py", ".sh"}

REQUIRED_SCHEMA_VERSION = 1

SELF_ASSERTED_PREFIX = "self-asserted:"


# --------------------------------------------------------------------------
# Verdict
# --------------------------------------------------------------------------

@dataclass
class Verdict:
    status: str          # "ok" | "fail" | "self-asserted"
    reason: str = ""

    @property
    def blocks(self) -> bool:
        return self.status == "fail"


# --------------------------------------------------------------------------
# metadata.yaml validity checks
# --------------------------------------------------------------------------

def _load_metadata(skill_dir: Path) -> dict:
    meta_path = skill_dir / "metadata.yaml"
    if not meta_path.is_file():
        raise SystemExit(f"{skill_dir} :: missing metadata.yaml")
    try:
        raw = meta_path.read_text()
    except OSError as e:
        raise SystemExit(f"{skill_dir} :: cannot read metadata.yaml ({e})")
    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as e:
        raise SystemExit(f"{skill_dir} :: metadata.yaml is not valid YAML ({e})")
    if not isinstance(data, dict):
        raise SystemExit(f"{skill_dir} :: metadata.yaml top level must be a mapping")
    return data


def _validate_metadata_fields(
    skill_dir: Path, data: dict, known_skill_ids: Optional[Iterable[str]]
) -> tuple:
    """Returns (tags:set, notes:str). Raises SystemExit on any validity failure."""
    name = str(skill_dir)

    schema_version = data.get("schema-version")
    if schema_version != REQUIRED_SCHEMA_VERSION:
        raise SystemExit(
            f"{name} :: schema-version must be {REQUIRED_SCHEMA_VERSION} "
            f"(got {schema_version!r})"
        )

    purpose = data.get("purpose")
    if not isinstance(purpose, str) or not purpose.strip():
        raise SystemExit(f"{name} :: purpose must be present and non-blank")

    best_for = data.get("best-for", "")
    if best_for is not None and not isinstance(best_for, str):
        raise SystemExit(f"{name} :: best-for must be a string if present")

    needs = data.get("needs", [])
    if not isinstance(needs, list) or not all(isinstance(n, str) for n in needs):
        raise SystemExit(f"{name} :: needs must be a list of skill-id strings")
    if known_skill_ids is not None:
        unknown = [n for n in needs if n not in known_skill_ids]
        if unknown:
            raise SystemExit(f"{name} :: needs references unknown skill id(s) {unknown}")

    changes = data.get("changes")
    if not isinstance(changes, dict):
        raise SystemExit(f"{name} :: changes must be a mapping with 'tags' and 'notes'")

    tags = changes.get("tags", [])
    if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
        raise SystemExit(f"{name} :: changes.tags must be a list of strings")
    unknown_tags = sorted(set(tags) - ALLOWED_TAGS)
    if unknown_tags:
        raise SystemExit(f"{name} :: changes.tags has unknown tag(s) {unknown_tags}")

    notes = changes.get("notes", "") or ""
    if not isinstance(notes, str):
        raise SystemExit(f"{name} :: changes.notes must be a string")
    if "other" in tags and not notes.strip():
        raise SystemExit(f"{name} :: changes.notes is required when 'other' is in changes.tags")

    return set(tags), notes


# --------------------------------------------------------------------------
# Side-effect detection
# --------------------------------------------------------------------------

def _plugin_root_for(skill_dir: Path) -> Optional[Path]:
    """Walk up from <plugin>/skills/<name> to find the plugin root."""
    parts = skill_dir.resolve()
    for parent in [parts, *parts.parents]:
        if parent.name == "skills" and parent.parent is not None:
            return parent.parent
    return None


def _plugin_has_declared_hook(skill_dir: Path) -> bool:
    plugin_root = _plugin_root_for(skill_dir)
    if plugin_root is None:
        return False
    hooks_path = plugin_root / "hooks" / "hooks.json"
    if not hooks_path.is_file():
        return False
    try:
        import json
        data = json.loads(hooks_path.read_text())
    except (OSError, ValueError):
        # Present-but-unparseable hooks.json is still a declared hook: fail safe.
        return True
    hooks = data.get("hooks") if isinstance(data, dict) else None
    if not isinstance(hooks, dict):
        return bool(data)
    return any(bool(v) for v in hooks.values())


def _strip_comments(text: str, suffix: str) -> str:
    """Strip `#`-comments per line for .py/.sh scripts."""
    if suffix not in {".py", ".sh"}:
        return text
    out_lines = []
    for line in text.splitlines():
        # Naive but adequate: cut at first unquoted '#'. Good enough for the
        # shell/python scripts this repo actually ships.
        idx = line.find("#")
        out_lines.append(line if idx == -1 else line[:idx])
    return "\n".join(out_lines)


def _iter_candidate_scripts(skill_dir: Path):
    """Recursively scan the WHOLE skill dir (root + references/ + any scripts/),
    NOT a scripts/-only glob -- real skill scripts live at skill root or
    references/ in this repo."""
    for path in skill_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix in SCRIPT_SUFFIXES:
            yield path
            continue
        try:
            executable = path.stat().st_mode & 0o111 != 0
        except OSError:
            executable = False
        if executable:
            yield path


def _script_has_unsuppressed_mutation(path: Path) -> bool:
    try:
        text = path.read_text(errors="ignore")
    except OSError:
        return False
    for line in text.splitlines():
        if SCOUT_IGNORE_MARKER in line:
            continue
        stripped = _strip_comments(line, path.suffix)
        if SCOUT_IGNORE_MARKER in stripped:
            continue
        for pattern in _MUTATING_RE:
            if pattern.search(stripped):
                return True
    return False


def _skill_has_mutating_script(skill_dir: Path) -> bool:
    for path in _iter_candidate_scripts(skill_dir):
        if _script_has_unsuppressed_mutation(path):
            return True
    return False


_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n", re.DOTALL)


def _parse_allowed_tools(skill_dir: Path) -> list:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        return []
    text = skill_md.read_text(errors="ignore")
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return []
    try:
        front = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return []
    if not isinstance(front, dict):
        return []
    raw = front.get("allowed-tools")
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(t).strip() for t in raw if str(t).strip()]
    if isinstance(raw, str):
        return [t.strip() for t in raw.split(",") if t.strip()]
    return []


# --------------------------------------------------------------------------
# Contradiction verdict
# --------------------------------------------------------------------------

def _contradiction_verdict(skill_dir: Path, tags: set) -> Verdict:
    name = str(skill_dir)
    declares_none = len(tags) == 0

    has_hook = _plugin_has_declared_hook(skill_dir)
    has_mutating_script = _skill_has_mutating_script(skill_dir)
    allowed_tools = _parse_allowed_tools(skill_dir)

    unknown_tools = [t for t in allowed_tools if t not in TOOL_TAG_MAP]
    mutating_grant_tools = [
        t for t in allowed_tools
        if t in TOOL_TAG_MAP and TOOL_TAG_MAP[t]["class"] == "mutating"
    ]
    broad_grant_tools = [
        t for t in allowed_tools
        if t in TOOL_TAG_MAP and TOOL_TAG_MAP[t]["class"] == "broad"
    ]

    # --- CLEAR contradiction: claims "none" while the author's OWN
    #     allowed-tools frontmatter grants an unambiguously mutating tool.
    #     This is the ONLY hard-FAIL arm -- a live hook or a mutating script
    #     match are self-asserted ambiguities, not blocks (see below).
    if declares_none:
        if mutating_grant_tools:
            return Verdict(
                "fail",
                f"{name} :: changes.tags is empty but allowed-tools grants "
                f"mutating tool(s) {mutating_grant_tools}",
            )

    # --- self-asserted ambiguities (never block):
    reasons = []
    if declares_none and has_hook:
        reasons.append("plugin declares a live hook")
    if declares_none and has_mutating_script:
        reasons.append("a bundled script matches a mutating pattern")
    if unknown_tools:
        reasons.append(f"unrecognized allowed-tools entr(y/ies) {unknown_tools}")
    if broad_grant_tools and declares_none:
        reasons.append(f"broad grant {broad_grant_tools} with changes.tags: []")
    if tags & {"money", "org"}:
        reasons.append(f"semantic tag(s) {sorted(tags & {'money', 'org'})} declared (author-asserted, unverifiable)")

    if reasons:
        return Verdict("self-asserted", f"{name} :: " + "; ".join(reasons))

    return Verdict("ok", f"{name} :: ok")


# --------------------------------------------------------------------------
# Public entrypoint
# --------------------------------------------------------------------------

def validate_skill(skill_dir: Path, known_skill_ids: Optional[Iterable[str]] = None) -> Verdict:
    """Validate metadata.yaml + run the contradiction check for one skill dir.

    Raises SystemExit on any metadata VALIDITY failure or clear contradiction
    (mirrors validate_eval.py's style). Returns a Verdict on ok/self-asserted.
    """
    skill_dir = Path(skill_dir)
    data = _load_metadata(skill_dir)
    tags, _notes = _validate_metadata_fields(skill_dir, data, known_skill_ids)

    verdict = _contradiction_verdict(skill_dir, tags)
    if verdict.status == "fail":
        raise SystemExit(verdict.reason)
    return verdict


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: scout_validate.py <path-to-skill-dir>")
    skill_dir = Path(sys.argv[1])
    verdict = validate_skill(skill_dir)
    if verdict.status == "self-asserted":
        print(f"{SELF_ASSERTED_PREFIX} {verdict.reason}")
    else:
        print(verdict.reason)


if __name__ == "__main__":
    main()
