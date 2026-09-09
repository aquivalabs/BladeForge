#!/usr/bin/env python3
"""plugins/critique/tests/schema-composability.test.py — the guard the schemas shipped without.

`critique:critique` mandates (SKILL.md step 10) that a synthesized run be validated against
`critique-run.schema.json` with a REAL validator. That was unsatisfiable as shipped: the run schema
composes a finding as `allOf: [{$ref: critique/finding}, {required: [convergence], ...}]`, while
`finding.schema.json` sets `additionalProperties: false` WITHOUT declaring `convergence`. In JSON
Schema, `additionalProperties` inside the referenced subschema sees only its OWN `properties` — a
property contributed by a sibling `allOf` branch is "additional" and rejected. So every synthesized
run failed validation, and nothing in the repository checked it.

Two groups, cheapest first:

1. **Structural invariant (stdlib only, no dependency).** Every property the run schema's `allOf`
   adds to a finding MUST be declared in `finding.schema.json.properties`. This catches the whole
   CLASS — the next field the synthesizer adds trips it too, not just `convergence`.
2. **Real validation (needs `jsonschema` + `referencing`).** A synthesized finding — every required
   field plus `convergence` — validates against the run schema; and the same finding WITHOUT
   `convergence` is rejected, so the requirement is proven live rather than assumed. Skipped with a
   loud SKIP line when the libraries are absent, so the file still runs bare.

Run: python3 plugins/critique/tests/schema-composability.test.py
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REFS = HERE.parent / "skills" / "critique" / "references"
FINDING_SCHEMA_PATH = REFS / "finding.schema.json"
RUN_SCHEMA_PATH = REFS / "critique-run.schema.json"

passed = 0
failed = 0


def check(description, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ok: {description}")
        passed += 1
    else:
        print(f"  FAIL: {description}" + (f" — {detail}" if detail else ""))
        failed += 1


finding_schema = json.loads(FINDING_SCHEMA_PATH.read_text())
run_schema = json.loads(RUN_SCHEMA_PATH.read_text())

# A synthesized finding: every field the contract requires, plus the synthesizer's `convergence`.
SYNTHESIZED_FINDING = {
    "location": "§2, the widget pipeline",
    "severity": "S1",
    "what": "the pipeline swallows a failed step",
    "why": "a later step then runs on data that was never produced",
    "rationale": "flagged §2 because the step's error path returns the same shape as its success path",
    "evidence": "a failure must be distinguishable from a success at the boundary (plain reasoning)",
    "example": "a kitchen where a dropped plate is plated anyway, because the tray came back empty either way",
    "fix": "return a distinct failure value the next step must handle",
    "fix_rationale": "it makes the failure impossible to mistake for a result, instead of documenting the trap",
    "convergence": 2,
}

print("\nstructural invariant — every allOf-added property is declared in finding.schema")
{
    # Collect the properties the run schema's findings-item allOf contributes beyond the $ref.
}
findings_item = run_schema["properties"]["findings"]["items"]
all_of = findings_item.get("allOf", [])
added_properties = set()
for branch in all_of:
    if "$ref" in branch:
        continue
    added_properties |= set(branch.get("properties", {}).keys())
    added_properties |= set(branch.get("required", []))

declared = set(finding_schema.get("properties", {}).keys())
strict = finding_schema.get("additionalProperties") is False

check(
    "the run schema's findings-item does compose a finding by $ref",
    any("$ref" in branch for branch in all_of),
    "the allOf lost its $ref to critique/finding",
)
check(
    "finding.schema is strict (additionalProperties: false)",
    strict,
    "strictness was dropped — a stray field would now pass silently",
)
for name in sorted(added_properties):
    check(
        f"'{name}' (added by the run schema) is declared in finding.schema.properties",
        name in declared,
        "additionalProperties:false will reject it, so no synthesized run can ever validate",
    )

print("\nreal validation — a synthesized finding against critique-run.schema.json")
try:
    from jsonschema import Draft202012Validator
    from referencing import Registry, Resource

    registry = Registry().with_resources(
        [
            ("critique/finding", Resource.from_contents(finding_schema)),
            ("critique/run", Resource.from_contents(run_schema)),
        ]
    )
    validator = Draft202012Validator(run_schema, registry=registry)

    run_object = {
        "lenses": ["coherence", "breaks-real", "completeness"],
        "rounds": 1,
        "stopped_because": "no new S1",
        "self_preference_caveat": None,
        "findings": [SYNTHESIZED_FINDING],
    }
    errors = list(validator.iter_errors(run_object))
    check(
        "a synthesized run with convergence validates",
        not errors,
        errors[0].message if errors else "",
    )

    without_convergence = {k: v for k, v in SYNTHESIZED_FINDING.items() if k != "convergence"}
    run_missing = dict(run_object, findings=[without_convergence])
    check(
        "the same run WITHOUT convergence is rejected",
        list(validator.iter_errors(run_missing)),
        "convergence is not actually enforced — rule 8's weighting could go unrecorded",
    )

    lone_critic = {k: v for k, v in SYNTHESIZED_FINDING.items() if k != "convergence"}
    lone_errors = list(Draft202012Validator(finding_schema).iter_errors(lone_critic))
    check(
        "a lone critic's finding (no convergence) validates against finding.schema",
        not lone_errors,
        lone_errors[0].message if lone_errors else "",
    )
except ImportError as missing:
    print(f"  SKIP: real validation needs jsonschema + referencing ({missing}) —")
    print("        the structural invariant above still ran; CI installs both.")

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
