#!/usr/bin/env python3
# Axis walk (tests:architecture section 3). Applies: 3 absence - a result file that does not exist
# yet, and one holding no `trigger` key; 9 input immutability - the caller's previous record is
# read, never edited in place; 11 persistence - what survives a write and what is replaced.
# Axes 1-2, 4-8, 10 and 12-13 n/a: one function, one call, no clock, dependency, error envelope or
# permission surface.
#
# This file exists because `save_result` carried one sibling key forward by name and dropped the
# rest, so every re-measurement silently deleted the `security` walk and un-shipped the skill.
import importlib.util
import json
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

SCRIPT = Path(__file__).resolve().parents[1] / "skills/skill-eval/scripts/score-description.py"

spec = importlib.util.spec_from_file_location("score_description", SCRIPT)
sd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sd)

failures = []
checks = 0


def check(name, got, want):
    global checks
    checks += 1
    if got != want:
        failures.append(f"{name}: got {got!r}, want {want!r}")


def save(previous):
    """Run one save_result against `previous` and return the record it wrote."""
    tmp = Path(tempfile.mkdtemp())
    evals = tmp / "evals"
    evals.mkdir()
    (evals / "rubric.json").write_text(
        json.dumps({"trigger": [{"query": "q", "should_trigger": True}]})
    )
    if previous is not None:
        (evals / "result.json").write_text(json.dumps(previous))
    sd.save_result(
        str(tmp),
        str(evals / "rubric.json"),
        "a description",
        {"results": []},
        None,
        SimpleNamespace(model="sonnet", runs=2),
    )
    return json.loads((evals / "result.json").read_text())


# Setup - a record carrying every key a skill's result.json is known to hold, plus one it is not.
written = save({"trigger": {"stale": True}, "acceptance": ["a"], "security": {"verdict": "pass"}, "extra": 7})

# Verify - each sibling survives, and only `trigger` is replaced.
check("security survives", written.get("security"), {"verdict": "pass"})
check("acceptance survives", written.get("acceptance"), ["a"])
check("an unknown sibling survives", written.get("extra"), 7)
check("trigger is replaced", "stale" in written["trigger"], False)

# Setup + Verify - no previous record at all: the two known keys are still present, acceptance null.
fresh = save(None)
check("acceptance is present when there was no record", "acceptance" in fresh, True)
check("acceptance is null when there was no record", fresh["acceptance"], None)

# Setup + Verify - a record with no `trigger` key is not a result record, so nothing is carried.
foreign = save({"acceptance": ["a"], "security": {"verdict": "pass"}})
check("a record without trigger carries nothing forward", foreign.get("security"), None)

if failures:
    print("save-result.test.py FAILED")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print(f"save-result.test.py: {checks} checks passed")
