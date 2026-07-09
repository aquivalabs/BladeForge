#!/usr/bin/env python3
"""Validate a skill trigger-eval queryset and emit its content hash.

Exit 0 and print the sha256 of the file bytes when the queryset is a JSON array
of >= MIN_CASES {query:str, should_trigger:bool} items with at least one positive
and one negative. Exit non-zero with a one-line reason otherwise. The eval-gate
reads the printed hash to compare against evals/result.json's queryset_hash.
"""
import hashlib
import json
import sys
from pathlib import Path

MIN_CASES = 6


def validate(path: Path) -> str:
    if not path.is_file():
        raise SystemExit(f"{path}: missing — create evals/trigger-eval.json")
    raw = path.read_bytes()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise SystemExit(f"{path}: not valid JSON ({e})")
    if not isinstance(data, list):
        raise SystemExit(f"{path}: top level must be a JSON array of cases")
    if len(data) < MIN_CASES:
        raise SystemExit(f"{path}: only {len(data)} cases — need >= {MIN_CASES}")
    pos = neg = 0
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            raise SystemExit(f"{path}: item {i} is not an object")
        q, st = item.get("query"), item.get("should_trigger")
        if not isinstance(q, str) or not q.strip():
            raise SystemExit(f"{path}: item {i} needs a non-empty string 'query'")
        if not isinstance(st, bool):
            raise SystemExit(f"{path}: item {i} 'should_trigger' must be true/false")
        pos += st
        neg += not st
    if pos == 0 or neg == 0:
        raise SystemExit(
            f"{path}: need >=1 should_trigger:true AND >=1 false "
            f"(got {pos} positive / {neg} negative)")
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: validate_eval.py <path-to-trigger-eval.json>")
    print(validate(Path(sys.argv[1])))


if __name__ == "__main__":
    main()
