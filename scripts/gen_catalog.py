#!/usr/bin/env python3
"""Generate catalog.json — a DUMB COMPILER, no verification.

Walks plugins/*/skills/*/SKILL.md and, for each skill:
  - derives the owning plugin folder segment (<domain>) from the path
  - reads plugins/<domain>/.claude-plugin/plugin.json and ASSERTS its `name`
    equals <domain> (fail loudly on divergence — guards future drift)
  - derives the callable name as `<domain>:<skill-folder>` (there is no
    `name:` frontmatter field to read this from)
  - reads the skill's metadata.yaml sidecar; MISSING -> fail loudly, nonzero,
    naming the offending skill, and NO catalog is written (not even partial)
  - copies the SKILL.md frontmatter `description` VERBATIM into
    `activates-when` (no paraphrasing)

This script does NOT validate metadata.yaml content or run any contradiction
check — that is scripts/scout_validate.py's job (the gate, task 4). It only
asserts the two structural invariants above and otherwise trusts its inputs.

Field mapping (source -> catalog):
  plugin.json:name    -> skill entry: plugin
  plugin.json:version -> skill entry: plugin-version

Each skill entry also carries a `hooks` field: the list of event names (the
keys under the top-level `hooks` object) declared in the owning plugin's
plugins/<domain>/hooks/hooks.json. No hooks.json -> []. A malformed/
unparseable hooks.json -> a single defensive sentinel entry (never crash,
never silently drop). This is DISCLOSURE-ONLY — it never affects any gate.
This reader is intentionally separate from scout_validate.py's
_plugin_has_declared_hook (two readers by design; do not unify or import).

Output shape:
  {
    "schema-version": 1,
    "marketplace": "<.claude-plugin/marketplace.json:name>",
    "generated": "YYYY-MM-DD",
    "skills": [ {name, plugin, plugin-version, activates-when, purpose,
                 best-for, needs, changes, hooks}, ... ]
  }

CLI:
    python3 scripts/gen_catalog.py [--root DIR] [--out PATH]

--root defaults to the git repo root; --out defaults to the canonical bundle
path plugins/scout/skills/scout/catalog.json (created, parents and all, if
missing).
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import yaml

DEFAULT_OUT = Path("plugins/scout/skills/scout/catalog.json")

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n", re.DOTALL)

SCHEMA_VERSION = 1


def _git_repo_root() -> Path:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        )
    except (OSError, subprocess.CalledProcessError) as e:
        raise SystemExit(f"gen_catalog: could not determine git repo root ({e})")
    return Path(out.stdout.strip())


def _read_marketplace_name(root: Path) -> str:
    path = root / ".claude-plugin" / "marketplace.json"
    if not path.is_file():
        raise SystemExit(f"gen_catalog: missing marketplace manifest {path}")
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        raise SystemExit(f"gen_catalog: cannot read/parse {path} ({e})")
    name = data.get("name") if isinstance(data, dict) else None
    if not isinstance(name, str) or not name.strip():
        raise SystemExit(f"gen_catalog: {path} has no 'name' field")
    return name


def _read_plugin_json(plugin_dir: Path, domain: str) -> dict:
    path = plugin_dir / ".claude-plugin" / "plugin.json"
    if not path.is_file():
        raise SystemExit(f"gen_catalog: {domain} :: missing plugin.json at {path}")
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        raise SystemExit(f"gen_catalog: {domain} :: cannot read/parse plugin.json ({e})")
    if not isinstance(data, dict):
        raise SystemExit(f"gen_catalog: {domain} :: plugin.json top level must be an object")

    name = data.get("name")
    if name != domain:
        raise SystemExit(
            f"gen_catalog: {domain} :: plugin.json name {name!r} != "
            f"plugin folder name {domain!r}"
        )

    version = data.get("version")
    if not isinstance(version, str) or not version.strip():
        raise SystemExit(f"gen_catalog: {domain} :: plugin.json missing 'version'")

    return data


_HOOK_MALFORMED_SENTINEL = ["unknown/unparseable hook present"]


def _read_plugin_hooks(plugin_dir: Path, domain: str) -> list:
    """Enumerate a plugin's declared hook EVENT NAMES for disclosure only.

    Reads plugins/<domain>/hooks/hooks.json. The result is the list of keys
    under the top-level "hooks" object (e.g. ["PostToolUse"]). No hooks.json
    -> []. Malformed/unparseable/wrong-shape -> a single defensive sentinel
    entry; this never raises and never aborts catalog generation.

    Intentionally NOT shared with scout_validate.py's
    _plugin_has_declared_hook — that reader answers a different question
    (is there a live hook, for a self-asserted mark) and lives in the gate,
    not the generator. Two readers by design.
    """
    hooks_path = plugin_dir / "hooks" / "hooks.json"
    if not hooks_path.is_file():
        return []
    try:
        data = json.loads(hooks_path.read_text())
    except (OSError, json.JSONDecodeError):
        return list(_HOOK_MALFORMED_SENTINEL)

    if not isinstance(data, dict):
        return list(_HOOK_MALFORMED_SENTINEL)
    hooks_obj = data.get("hooks")
    if not isinstance(hooks_obj, dict):
        return list(_HOOK_MALFORMED_SENTINEL)

    return list(hooks_obj.keys())


_DESCRIPTION_KEY_RE = re.compile(r"^description:[ \t]?(.*)$")
_TOP_LEVEL_KEY_RE = re.compile(r"^[A-Za-z0-9_-]+:")


def _read_skill_description(skill_dir: Path, skill_id: str) -> str:
    """Extract the SKILL.md frontmatter `description` value tolerantly.

    Per this repo's AGENTS.md, SKILL.md frontmatter is JUST a `description:`
    field. Its value is free text and may itself contain colon-space
    sequences (e.g. "Framework-agnostic: governs ..."), which a strict YAML
    mapping parser rejects ("mapping values are not allowed here"). Claude
    Code's own frontmatter reader is lenient about this, so this generator
    must not be stricter than the platform it catalogs.

    Approach: isolate the frontmatter block between the leading `---`
    fences, take everything after the `description:` key up to the next
    top-level `key:` line or the closing fence, strip surrounding quotes,
    and normalize whitespace. The result is used verbatim (no re-parsing,
    no paraphrasing).
    """
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        raise SystemExit(f"gen_catalog: {skill_id} :: missing SKILL.md at {skill_md}")
    text = skill_md.read_text()
    m = _FRONTMATTER_RE.match(text)
    if not m:
        raise SystemExit(f"gen_catalog: {skill_id} :: SKILL.md has no YAML frontmatter")

    lines = m.group(1).splitlines()
    start_idx = None
    first_line_rest = ""
    for i, line in enumerate(lines):
        key_match = _DESCRIPTION_KEY_RE.match(line)
        if key_match:
            start_idx = i
            first_line_rest = key_match.group(1)
            break

    if start_idx is None:
        raise SystemExit(f"gen_catalog: {skill_id} :: SKILL.md frontmatter missing 'description'")

    value_lines = [first_line_rest]
    for line in lines[start_idx + 1:]:
        if _TOP_LEVEL_KEY_RE.match(line):
            break
        value_lines.append(line)

    raw_value = " ".join(part.strip() for part in value_lines if part.strip())
    raw_value = re.sub(r"\s+", " ", raw_value).strip()

    if len(raw_value) >= 2 and raw_value[0] == raw_value[-1] and raw_value[0] in ("'", '"'):
        raw_value = raw_value[1:-1].strip()

    if not raw_value:
        raise SystemExit(f"gen_catalog: {skill_id} :: SKILL.md frontmatter missing 'description'")
    return raw_value


def _read_metadata(skill_dir: Path, skill_id: str) -> dict:
    meta_path = skill_dir / "metadata.yaml"
    if not meta_path.is_file():
        raise SystemExit(f"gen_catalog: {skill_id} :: missing metadata.yaml — {meta_path}")
    try:
        raw = meta_path.read_text()
    except OSError as e:
        raise SystemExit(f"gen_catalog: {skill_id} :: cannot read metadata.yaml ({e})")
    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as e:
        raise SystemExit(f"gen_catalog: {skill_id} :: metadata.yaml is not valid YAML ({e})")
    if not isinstance(data, dict):
        raise SystemExit(f"gen_catalog: {skill_id} :: metadata.yaml top level must be a mapping")
    return data


def _build_entry(domain: str, skill_dir: Path, plugin_json: dict, hooks: list) -> dict:
    skill_id = f"{domain}:{skill_dir.name}"

    description = _read_skill_description(skill_dir, skill_id)
    metadata = _read_metadata(skill_dir, skill_id)

    changes = metadata.get("changes") or {}
    if not isinstance(changes, dict):
        raise SystemExit(f"gen_catalog: {skill_id} :: metadata.yaml 'changes' must be a mapping")

    return {
        "name": skill_id,
        "plugin": plugin_json.get("name"),
        "plugin-version": plugin_json.get("version"),
        "activates-when": description,
        "purpose": metadata.get("purpose"),
        "best-for": metadata.get("best-for"),
        "needs": metadata.get("needs", []),
        "changes": {
            "tags": changes.get("tags", []),
            "notes": changes.get("notes", ""),
        },
        "hooks": list(hooks),
    }


def generate_catalog(root: Path) -> dict:
    """Walk root/plugins/*/skills/*/SKILL.md and build the catalog dict.

    Raises SystemExit (naming the offending skill) on any missing
    metadata.yaml or plugin-name divergence. Does no partial writes itself —
    callers should only write the returned dict after this returns cleanly.
    """
    root = Path(root)
    plugins_dir = root / "plugins"
    if not plugins_dir.is_dir():
        raise SystemExit(f"gen_catalog: no plugins/ dir under root {root}")

    marketplace_name = _read_marketplace_name(root)

    skill_mds = sorted(plugins_dir.glob("*/skills/*/SKILL.md"))
    if not skill_mds:
        raise SystemExit(f"gen_catalog: no plugins/*/skills/*/SKILL.md found under {root}")

    plugin_json_cache: dict = {}
    plugin_hooks_cache: dict = {}
    entries = []
    for skill_md in skill_mds:
        skill_dir = skill_md.parent
        domain = skill_dir.parent.parent.name  # plugins/<domain>/skills/<name>
        plugin_dir = plugins_dir / domain

        if domain not in plugin_json_cache:
            plugin_json_cache[domain] = _read_plugin_json(plugin_dir, domain)
        plugin_json = plugin_json_cache[domain]

        if domain not in plugin_hooks_cache:
            plugin_hooks_cache[domain] = _read_plugin_hooks(plugin_dir, domain)
        hooks = plugin_hooks_cache[domain]

        entries.append(_build_entry(domain, skill_dir, plugin_json, hooks))

    return {
        "schema-version": SCHEMA_VERSION,
        "marketplace": marketplace_name,
        "generated": date.today().isoformat(),
        "skills": entries,
    }


def write_catalog(catalog: dict, out_path: Path) -> None:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(catalog, indent=2, sort_keys=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate catalog.json from the skill marketplace.")
    parser.add_argument("--root", type=Path, default=None,
                         help="Marketplace root (default: git repo root).")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT,
                         help=f"Output path (default: {DEFAULT_OUT}).")
    args = parser.parse_args()

    root = args.root if args.root is not None else _git_repo_root()

    catalog = generate_catalog(root)
    write_catalog(catalog, args.out)
    print(f"gen_catalog: wrote {len(catalog['skills'])} skill(s) to {args.out}")


if __name__ == "__main__":
    main()
