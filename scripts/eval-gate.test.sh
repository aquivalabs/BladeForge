#!/usr/bin/env bash
# scripts/eval-gate.test.sh — fixture-repo scenarios for the eval-gate (rubric scheme).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
GATE="$HERE/eval-gate.sh"
VALIDATE="$HERE/validate_eval.py"
VALIDATE_ACC="$HERE/validate_acceptance.py"
VALIDATE_SEC="$HERE/validate_security.py"
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "  ok: $1"; pass=$((pass+1));
  else echo "  FAIL: $1 (want exit $2, got $3)"; fail=$((fail+1)); fi }

TRIGGER='[{"query":"a","should_trigger":true},{"query":"b","should_trigger":true},{"query":"c","should_trigger":true},{"query":"d","should_trigger":false},{"query":"e","should_trigger":false},{"query":"f","should_trigger":false}]'
RUBRIC="{\"trigger\":$TRIGGER,\"acceptance\":[\"it works\"]}"

setup_repo() {
  local r; r="$(mktemp -d)"
  git -C "$r" init -q
  git -C "$r" config user.email t@t; git -C "$r" config user.name t
  mkdir -p "$r/scripts/hillclimb"
  cp "$GATE" "$r/scripts/eval-gate.sh"; cp "$VALIDATE" "$r/scripts/validate_eval.py"
  cp "$VALIDATE_ACC" "$r/scripts/validate_acceptance.py"
  cp "$HERE"/hillclimb/{description-hash,skill-description,validate-trigger-record,flow-lib}.mjs "$r/scripts/hillclimb/"
  cp "$VALIDATE_SEC" "$r/scripts/validate_security.py"
  echo "$r"
}

# print a result.json with a fresh trigger-runner measurement AND a fresh, passing security section.
# args: repo skill_rel qhash dhash [shape] — shape: full (default: runner record + hillclimb block),
# noclimb (runner record, no hillclimb block), legacy (the old score-description shape), nosec
result_json() {
  local mh; mh="$(cd "$1" && python3 scripts/validate_security.py --print-material-hash "$2")"
  python3 - "$3" "$4" "$mh" "${5:-full}" <<'PY'
import json, sys
qh, dh, mh, shape = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
pts = ["prompt-injection","data-exfiltration","secret-detection","dangerous-commands",
       "obfuscation","external-fetches","credential-access","privilege-escalation"]
trigger = {"queryset_hash": qh, "description_hash": dh, "best_score": "5/6"}
if shape != "legacy":
    trigger.update({"runner": "scripts/hillclimb/trigger-runner.mjs", "environment": "isolated",
                    "model": "claude-opus-5-5", "cases": 6, "runs_per_query": 1,
                    "test": {"cases": 2, "rows": 2, "mean": 1.0, "ci_half_width": 0.707}})
if shape in ("full", "nosec"):
    trigger["hillclimb"] = {"baseline_test": 1.0, "final_test": 1.0, "final_variant": "baseline",
                            "rounds": 0, "noise": 0.707, "verdict": "no-headroom"}
out = {"trigger": trigger, "acceptance": None}
if shape != "nosec":
    out["security"] = {"verdict": "pass", "scanned_by": "cerberus:security-scan", "scanned_hash": mh,
        "checklist": [{"n": i+1, "point": pts[i], "verdict": "pass", "note": "ok"} for i in range(8)]}
print(json.dumps(out))
PY
}
# write_result repo skill_rel [shape] -> a result.json fresh against the skill's current rubric and description
write_result() {
  local h d
  h="$(cd "$1" && python3 scripts/validate_eval.py "$2/evals/rubric.json")"
  d="$(cd "$1" && node scripts/hillclimb/description-hash.mjs "$2")"
  result_json "$1" "$2" "$h" "$d" "${3:-full}" > "$1/$2/evals/result.json"
}
add_skill() { # repo dir_rel [rubric_json] -> SKILL.md (with ## Contract) + optional rubric
  mkdir -p "$1/$2"
  printf -- '---\ndescription: y\n---\n# x\n\n## Contract\n\nIn: a thing. Out: a thing.\n' > "$1/$2/SKILL.md"
  if [ -n "${3:-}" ]; then mkdir -p "$1/$2/evals"; printf '%s' "$3" > "$1/$2/evals/rubric.json"; fi
}
stdin_all() { local sha; sha="$(git -C "$1" rev-parse HEAD)"; echo "refs/heads/main $sha refs/heads/main 0000000000000000000000000000000000000000"; }
run_gate() { ( cd "$1" && bash scripts/eval-gate.sh ) ; }

# A: new skill, NO rubric -> BLOCK
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/noeval"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "new skill without rubric blocks" 1 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# B: touched skill, valid rubric, NO result -> BLOCK (a touched skill owes a measurement)
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/warn" "$RUBRIC"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "touched skill, valid rubric, no result blocks" 1 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# C: valid rubric + FRESH nested result (trigger + security) -> PASS
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/ok" "$RUBRIC"
write_result "$r" plugins/p/skills/ok
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "valid rubric + fresh result passes" 0 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# D: touched skill, STALE result -> BLOCK
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/stale" "$RUBRIC"
printf '{"trigger":{"queryset_hash":"deadbeef","best_score":"5/6"},"acceptance":null}' > "$r/plugins/p/skills/stale/evals/result.json"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "touched skill, stale result blocks" 1 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# E: untouched eval-less skill ignored (the touched skill carries a fresh result so it passes)
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/legacy"
add_skill "$r" "plugins/p/skills/touched" "$RUBRIC"
h="$(cd "$r" && python3 scripts/validate_eval.py plugins/p/skills/touched/evals/rubric.json)"
d="$(cd "$r" && node scripts/hillclimb/description-hash.mjs plugins/p/skills/touched)"
printf '{"trigger":{"queryset_hash":"%s","description_hash":"%s","best_score":"5/6"},"acceptance":null}' "$h" "$d" > "$r/plugins/p/skills/touched/evals/result.json"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm base
base="$(git -C "$r" rev-parse HEAD)"
echo "notes" > "$r/plugins/p/skills/touched/README.md"   # touch a non-SKILL file: in the diff, but description unchanged, result stays fresh
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm edit
head="$(git -C "$r" rev-parse HEAD)"
check "untouched eval-less skill is ignored" 0 "$(cd "$r" && echo "refs/heads/main $head refs/heads/main $base" | bash scripts/eval-gate.sh >/dev/null 2>&1; echo $?)"

# F: touched existing eval-less skill blocks
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/legacy2"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm base
base="$(git -C "$r" rev-parse HEAD)"
echo "touched" >> "$r/plugins/p/skills/legacy2/SKILL.md"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm edit
head="$(git -C "$r" rev-parse HEAD)"
check "touched existing eval-less skill blocks" 1 "$(cd "$r" && echo "refs/heads/main $head refs/heads/main $base" | bash scripts/eval-gate.sh >/dev/null 2>&1; echo $?)"

# G: touched skill, fresh trigger result but NO security section -> BLOCK
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/nosec" "$RUBRIC"
write_result "$r" plugins/p/skills/nosec nosec
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "touched skill without security section blocks" 1 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# H: touched skill, fresh trigger + fresh security -> PASS (covered by C; explicit here with a script)
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/sec" "$RUBRIC"
mkdir -p "$r/plugins/p/skills/sec/scripts"; echo 'echo hello' > "$r/plugins/p/skills/sec/scripts/run.sh"
write_result "$r" plugins/p/skills/sec
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "fresh trigger + fresh security passes" 0 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# I: material (a script) changed after the scan -> security hash stale -> BLOCK
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/drift" "$RUBRIC"
mkdir -p "$r/plugins/p/skills/drift/scripts"; echo 'echo v1' > "$r/plugins/p/skills/drift/scripts/run.sh"
write_result "$r" plugins/p/skills/drift
echo 'echo v2' > "$r/plugins/p/skills/drift/scripts/run.sh"   # material changes AFTER the scan hash was taken
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "material changed after scan -> stale security blocks" 1 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# J: only metadata.yaml changed (non-material) -> security not owed -> PASS
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/meta" "$RUBRIC"
h="$(cd "$r" && python3 scripts/validate_eval.py plugins/p/skills/meta/evals/rubric.json)"
d="$(cd "$r" && node scripts/hillclimb/description-hash.mjs plugins/p/skills/meta)"
# fresh trigger, but deliberately NO security section — proving a metadata-only edit never asks for one
printf '{"trigger":{"queryset_hash":"%s","description_hash":"%s","best_score":"5/6"},"acceptance":null}' "$h" "$d" > "$r/plugins/p/skills/meta/evals/result.json"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm base
base="$(git -C "$r" rev-parse HEAD)"
echo "purpose: x" > "$r/plugins/p/skills/meta/metadata.yaml"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm edit
head="$(git -C "$r" rev-parse HEAD)"
check "metadata-only edit never owes a security scan" 0 "$(cd "$r" && echo "refs/heads/main $head refs/heads/main $base" | bash scripts/eval-gate.sh >/dev/null 2>&1; echo $?)"

# K: touched skill whose fresh record came from the deleted score-description.py -> BLOCK
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/old" "$RUBRIC"
write_result "$r" plugins/p/skills/old legacy
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "record from the old scorer blocks a touched skill" 1 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# L: NEW skill with a runner record but no hillclimb block -> BLOCK
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/fresh" "$RUBRIC"
write_result "$r" plugins/p/skills/fresh noclimb
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "new skill without a hillclimb record blocks" 1 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# M: EXISTING skill whose SKILL.md is edited, runner record without hillclimb -> PASS (only new skills owe a climb)
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/edit" "$RUBRIC"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm base
base="$(git -C "$r" rev-parse HEAD)"
printf -- '---\ndescription: z\n---\n# x\n\n## Contract\n\nIn: a thing. Out: a thing.\n' > "$r/plugins/p/skills/edit/SKILL.md"
write_result "$r" plugins/p/skills/edit noclimb
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm edit
head="$(git -C "$r" rev-parse HEAD)"
check "edited existing skill needs no hillclimb record" 0 "$(cd "$r" && echo "refs/heads/main $head refs/heads/main $base" | bash scripts/eval-gate.sh >/dev/null 2>&1; echo $?)"

echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
