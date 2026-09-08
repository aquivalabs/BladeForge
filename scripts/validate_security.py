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
"""
import hashlib
import json
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


def material_hash(skill_dir: Path) -> str:
    """sha256 over the skill's installer-facing material, order-independent of the filesystem."""
    if not skill_dir.is_dir():
        raise SystemExit(f"{skill_dir}: not a directory")
    entries = []
    skill_md = skill_dir / "SKILL.md"
    if skill_md.is_file():
        entries.append((Path("SKILL.md"), skill_md))
    for d in MATERIAL_DIRS:
        base = skill_dir / d
        if not base.is_dir():
            continue
        for f in base.rglob("*"):
            if f.is_file():
                entries.append((f.relative_to(skill_dir), f))
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
