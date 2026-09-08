#!/usr/bin/env python3
"""Validate a skill's rubric trigger half and emit its content hash.

Reads `evals/rubric.json` — `{ "trigger": [...cases...], "acceptance": ... }`. Exit 0
and print the sha256 of the CANONICAL `trigger` array (sorted keys, no whitespace) when
it is a JSON array of >= MIN_CASES {query:str, should_trigger:bool} items with at least
one positive and one negative. Exit non-zero with a one-line reason otherwise.

The hash is over the trigger array alone — NOT the whole file — so editing the acceptance
half never marks a trigger measurement stale. The eval-gate reads the printed hash to
compare against `evals/result.json`'s `trigger.queryset_hash`.
"""
import hashlib
import json
import sys
from pathlib import Path

MIN_CASES = 6


def canonical_trigger_hash(trigger) -> str:
    return hashlib.sha256(
        json.dumps(trigger, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def validate(path: Path) -> str:
    if not path.is_file():
        raise SystemExit(f"{path}: missing — create evals/rubric.json")
    try:
        doc = json.loads(path.read_bytes())
    except json.JSONDecodeError as e:
        raise SystemExit(f"{path}: not valid JSON ({e})")
    if not isinstance(doc, dict) or "trigger" not in doc:
        raise SystemExit(f"{path}: must be an object with a 'trigger' array")
    data = doc["trigger"]
    if not isinstance(data, list):
        raise SystemExit(f"{path}: 'trigger' must be a JSON array of cases")
    if len(data) < MIN_CASES:
        raise SystemExit(f"{path}: only {len(data)} trigger cases — need >= {MIN_CASES}")
    pos = neg = 0
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            raise SystemExit(f"{path}: trigger item {i} is not an object")
        q, st = item.get("query"), item.get("should_trigger")
        if not isinstance(q, str) or not q.strip():
            raise SystemExit(f"{path}: trigger item {i} needs a non-empty string 'query'")
        if not isinstance(st, bool):
            raise SystemExit(f"{path}: trigger item {i} 'should_trigger' must be true/false")
        pos += st
        neg += not st
    if pos == 0 or neg == 0:
        raise SystemExit(
            f"{path}: need >=1 should_trigger:true AND >=1 false "
            f"(got {pos} positive / {neg} negative)")
    return canonical_trigger_hash(data)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: validate_eval.py <path-to-rubric.json>")
    print(validate(Path(sys.argv[1])))


if __name__ == "__main__":
    main()
