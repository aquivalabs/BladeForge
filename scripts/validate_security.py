#!/usr/bin/env python3
"""Validate a skill's security-scan result section, and compute a skill's material hash.

Two jobs, one file so the head that WRITES the section and the gate that CHECKS it share a
single implementation of the material hash — two implementations would drift and a drift here
silently marks every skill stale or fresh at the wrong moment.

Default mode — validate `evals/result.json`'s `security` section:

    validate_security.py <path-to-result.json>

The `security` section is the eight-point consumer-safety confirmation written by
`cerberus:security-scan`. It MUST be an object with all eight points, in order, each carrying a
verdict; the top verdict is `pass` only when no point is `flag`. Exit 0 with a one-line summary on
a valid shape, non-zero with a one-line reason otherwise.

Hash mode — print the canonical material hash of a skill directory:

    validate_security.py --print-material-hash <skill-dir>

The material is what an installer actually reads and runs: `SKILL.md`, everything under
`references/`, and everything under `scripts/`. NOT the sidecars or the eval files — a metadata or
fixture edit does not change what reaches a consumer, and folding them in would restale every scan
on unrelated churn. The gate compares this hash against `security.scanned_hash` to decide freshness.
Inside a git work tree the file list is what git tracks or would track (committed `.gitignore`
files only), so ignored local files never reach the hash; outside one it is a filesystem walk.
"""
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

# The eight points, in the fixed order every section must carry them.
POINTS = [
    "prompt-injection",
    "data-exfiltration",
    "secret-detection",
    "dangerous-commands",
    "obfuscation",
    "external-fetches",
    "credential-access",
    "privilege-escalation",
]
VERDICTS = {"pass", "flag", "n/a"}
# Directories whose every file is installer-facing material.
MATERIAL_DIRS = ("references", "scripts")
# An installer never reads a build artefact, and a file list would otherwise fold an unignored
# one into the hash. A stray `__pycache__` then made the same skill hash differently on a
# contributor's machine and in a clean CI checkout, so the gate passed locally and failed there.
ARTEFACT_DIRS = {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", "node_modules"}
ARTEFACT_SUFFIXES = {".pyc", ".pyo"}


def is_material(rel: Path) -> bool:
    """Whether a path under a material directory is something an installer actually reads."""
    return not (
        ARTEFACT_DIRS.intersection(rel.parts) or rel.suffix in ARTEFACT_SUFFIXES
    )


def warn(msg: str) -> None:
    print(f"validate_security: {msg}", file=sys.stderr)


def filesystem_files(skill_dir: Path) -> list:
    """Every material path on disk, skill-relative, artefacts dropped."""
    rels = []
    if (skill_dir / "SKILL.md").is_file():
        rels.append(Path("SKILL.md"))
    for d in MATERIAL_DIRS:
        base = skill_dir / d
        if not base.is_dir():
            continue
        for f in base.rglob("*"):
            rel = f.relative_to(skill_dir)
            if f.is_file() and is_material(rel):
                rels.append(rel)
    return rels


def git_ls(top: Path, pathspecs: list, excludes: list):
    """Skill-candidate paths git tracks or would track, relative to `top`; None when git fails."""
    try:
        out = subprocess.run(
            ["git", "-C", str(top), "ls-files", "-z", "--cached", "--others", *excludes, "--", *pathspecs],
            capture_output=True,
            env={**os.environ, "GIT_LITERAL_PATHSPECS": "1"},
            check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return None
    return {p for p in out.decode("utf-8", "surrogateescape").split("\0") if p}


def git_files(skill_dir: Path):
    """Material paths from git (tracked plus untracked-not-ignored), or None outside a work tree.

    Only committed `.gitignore` files decide what is ignored: machine-local excludes
    (`core.excludesFile`, `.git/info/exclude`) differ between a contributor and CI, so applying
    them would bring back the very drift this hash must not have.
    """
    try:
        top = subprocess.run(
            ["git", "-C", str(skill_dir), "rev-parse", "--show-toplevel"],
            capture_output=True,
            check=True,
        ).stdout.decode("utf-8", "surrogateescape").strip()
    except (OSError, subprocess.CalledProcessError):
        return None
    if not top:
        return None
    top_path = Path(top).resolve()
    try:
        prefix = skill_dir.resolve().relative_to(top_path)
    except ValueError:
        return None
    pathspecs = [(prefix / name).as_posix() for name in ("SKILL.md", *MATERIAL_DIRS)]
    listed = git_ls(top_path, pathspecs, ["--exclude-per-directory=.gitignore"])
    if listed is None:
        return None
    standard = git_ls(top_path, pathspecs, ["--exclude-standard"])
    if standard is None:
        standard = listed
    rels = []
    for p in sorted(listed):
        rel = Path(p).relative_to(prefix) if prefix != Path(".") else Path(p)
        if rel != Path("SKILL.md") and not (len(rel.parts) > 1 and rel.parts[0] in MATERIAL_DIRS):
            continue
        if not is_material(rel):
            continue
        rels.append(rel)
        if p not in standard and (skill_dir / rel).is_file():
            warn(
                f"{rel} is hidden by a local exclude (core.excludesFile or .git/info/exclude); "
                "local excludes are not applied to the material hash, so it is hashed"
            )
    return rels


def material_hash(skill_dir: Path) -> str:
    """sha256 over the skill's installer-facing material, order-independent of the filesystem."""
    if not skill_dir.is_dir():
        raise SystemExit(f"{skill_dir}: not a directory")
    on_disk = filesystem_files(skill_dir)
    rels = git_files(skill_dir)
    if rels is None:
        rels = on_disk
    elif not rels and (skill_dir / "SKILL.md").is_file():
        warn(f"{skill_dir} is ignored by git; the filesystem walk was used for the material hash")
        rels = on_disk
    else:
        rels = [rel for rel in rels if (skill_dir / rel).is_file()]
        kept = set(rels)
        left_out = sorted(str(rel) for rel in on_disk if rel not in kept)
        if left_out:
            shown = ", ".join(left_out[:5]) + (", …" if len(left_out) > 5 else "")
            warn(f"{len(left_out)} file(s) ignored by git left out of the material hash: {shown}")
    entries = [(rel, skill_dir / rel) for rel in rels]
    entries.sort(key=lambda e: str(e[0]))
    h = hashlib.sha256()
    for rel, f in entries:
        h.update(str(rel).encode())
        h.update(b"\0")
        h.update(f.read_bytes())
        h.update(b"\0")
    return h.hexdigest()


def validate(path: Path) -> str:
    if not path.is_file():
        raise SystemExit(f"{path}: missing — run cerberus:security-scan to write it")
    try:
        doc = json.loads(path.read_bytes())
    except json.JSONDecodeError as e:
        raise SystemExit(f"{path}: not valid JSON ({e})")
    if not isinstance(doc, dict) or "security" not in doc:
        raise SystemExit(f"{path}: must be an object with a 'security' key")
    sec = doc["security"]
    if not isinstance(sec, dict):
        raise SystemExit(f"{path}: 'security' must be an object")
    if not isinstance(sec.get("scanned_by"), str) or not sec["scanned_by"].strip():
        raise SystemExit(f"{path}: security.scanned_by must be a non-empty string")
    sh = sec.get("scanned_hash")
    if not isinstance(sh, str) or len(sh) != 64 or any(c not in "0123456789abcdef" for c in sh):
        raise SystemExit(f"{path}: security.scanned_hash must be a 64-char sha256 hex")
    checklist = sec.get("checklist")
    if not isinstance(checklist, list) or len(checklist) != len(POINTS):
        raise SystemExit(f"{path}: security.checklist must list all {len(POINTS)} points")
    any_flag = False
    for i, item in enumerate(checklist):
        if not isinstance(item, dict):
            raise SystemExit(f"{path}: checklist item {i} must be an object")
        if item.get("n") != i + 1:
            raise SystemExit(f"{path}: checklist item {i} must have n={i + 1}")
        if item.get("point") != POINTS[i]:
            raise SystemExit(f"{path}: checklist item {i} must be point '{POINTS[i]}'")
        v = item.get("verdict")
        if v not in VERDICTS:
            raise SystemExit(f"{path}: checklist item {i} verdict must be one of {sorted(VERDICTS)}")
        if not isinstance(item.get("note"), str):
            raise SystemExit(f"{path}: checklist item {i} note must be a string")
        if v == "flag":
            any_flag = True
    top = sec.get("verdict")
    if top not in {"pass", "flag"}:
        raise SystemExit(f"{path}: security.verdict must be 'pass' or 'flag'")
    if any_flag and top != "flag":
        raise SystemExit(f"{path}: a flagged point requires security.verdict 'flag'")
    if not any_flag and top != "pass":
        raise SystemExit(f"{path}: no point flagged but security.verdict is not 'pass'")
    return f"security: {top} ({len(checklist)} points)"


def main() -> None:
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == "--print-material-hash":
        print(material_hash(Path(args[1])))
        return
    if len(args) == 1:
        print(validate(Path(args[0])))
        return
    raise SystemExit(
        "usage: validate_security.py <result.json>\n"
        "   or: validate_security.py --print-material-hash <skill-dir>"
    )


if __name__ == "__main__":
    main()
