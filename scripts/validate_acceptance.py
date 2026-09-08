#!/usr/bin/env python3
"""Validate a skill's rubric acceptance half.

Reads `evals/rubric.json` — `{ "trigger": ..., "acceptance": ... }`. The `acceptance`
value is EITHER a non-empty JSON array of non-empty strings (the expectations the result
must satisfy), OR the object `{"not-applicable": "<reason>"}` for a skill that produces
nothing to check (a map / pure convention). Exit 0 on a valid shape, non-zero with a
one-line reason otherwise.
"""
import json
import sys
from pathlib import Path


def validate(path: Path) -> str:
    if not path.is_file():
        raise SystemExit(f"{path}: missing — create evals/rubric.json")
    try:
        doc = json.loads(path.read_bytes())
    except json.JSONDecodeError as e:
        raise SystemExit(f"{path}: not valid JSON ({e})")
    if not isinstance(doc, dict) or "acceptance" not in doc:
        raise SystemExit(f"{path}: must be an object with an 'acceptance' key")
    data = doc["acceptance"]
    if isinstance(data, dict):
        if set(data) != {"not-applicable"} or not isinstance(data["not-applicable"], str) \
                or not data["not-applicable"].strip():
            raise SystemExit(f"{path}: acceptance map must be {{\"not-applicable\": \"<reason>\"}}")
        return "not-applicable"
    if not isinstance(data, list) or not data:
        raise SystemExit(f"{path}: 'acceptance' must be a non-empty array, or {{not-applicable}}")
    for i, item in enumerate(data):
        if not isinstance(item, str) or not item.strip():
            raise SystemExit(f"{path}: acceptance item {i} must be a non-empty string")
    return f"{len(data)} expectations"


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: validate_acceptance.py <path-to-rubric.json>")
    print(validate(Path(sys.argv[1])))


if __name__ == "__main__":
    main()
