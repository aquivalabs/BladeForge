#!/usr/bin/env bash
# scripts/eval-gate.test.sh — fixture-repo scenarios for the eval-gate.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
GATE="$HERE/eval-gate.sh"
VALIDATE="$HERE/validate_eval.py"
pass=0; fail=0
check() { # desc expected_code actual_code
  if [ "$2" = "$3" ]; then echo "  ok: $1"; pass=$((pass+1));
  else echo "  FAIL: $1 (want exit $2, got $3)"; fail=$((fail+1)); fi
}

VALID_EVAL='[{"query":"a","should_trigger":true},{"query":"b","should_trigger":true},{"query":"c","should_trigger":true},{"query":"d","should_trigger":false},{"query":"e","should_trigger":false},{"query":"f","should_trigger":false}]'

setup_repo() { # -> echoes repo path
  local r; r="$(mktemp -d)"
  git -C "$r" init -q
  git -C "$r" config user.email t@t; git -C "$r" config user.name t
  cp "$GATE" "$r/eval-gate.sh"; cp "$VALIDATE" "$r/validate_eval.py"
  mkdir -p "$r/scripts"; cp "$GATE" "$r/scripts/eval-gate.sh"; cp "$VALIDATE" "$r/scripts/validate_eval.py"
  echo "$r"
}
add_skill() { # repo dir_rel  [eval_json]  -> creates SKILL.md and optional eval
  mkdir -p "$1/$2"; echo "---\nname: x\ndescription: y\n---\n# x" > "$1/$2/SKILL.md"
  if [ -n "${3:-}" ]; then mkdir -p "$1/$2/evals"; printf '%s' "$3" > "$1/$2/evals/trigger-eval.json"; fi
}
# push-range stdin for "everything from empty tree to HEAD"
stdin_all() { local sha; sha="$(git -C "$1" rev-parse HEAD)"; echo "refs/heads/main $sha refs/heads/main 0000000000000000000000000000000000000000"; }
run_gate() { ( cd "$1" && bash scripts/eval-gate.sh ) ; }

# Scenario A: new skill with NO eval -> BLOCK (exit 1)
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/noeval"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "new skill without eval blocks" 1 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# Scenario B: new skill WITH valid eval, no result.json -> WARN (exit 0)
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/warn" "$VALID_EVAL"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "valid eval, no result warns but passes" 0 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# Scenario C: valid eval + FRESH result.json -> PASS (exit 0)
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/ok" "$VALID_EVAL"
h="$(cd "$r" && python3 scripts/validate_eval.py plugins/p/skills/ok/evals/trigger-eval.json)"
printf '{"queryset_hash":"%s","best_score":"5/6"}' "$h" > "$r/plugins/p/skills/ok/evals/result.json"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "valid eval + fresh result passes" 0 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# Scenario D: valid eval + STALE result.json -> WARN (exit 0)
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/stale" "$VALID_EVAL"
printf '{"queryset_hash":"deadbeef","best_score":"5/6"}' > "$r/plugins/p/skills/stale/evals/result.json"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm c
check "valid eval + stale result warns but passes" 0 "$(stdin_all "$r" | run_gate "$r" >/dev/null 2>&1; echo $?)"

# Scenario E: two skills, only ONE touched; the untouched one has no eval -> PASS
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/legacy"      # no eval, will be committed in base
add_skill "$r" "plugins/p/skills/touched" "$VALID_EVAL"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm base
base="$(git -C "$r" rev-parse HEAD)"
echo "touched" >> "$r/plugins/p/skills/touched/SKILL.md"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm edit
head="$(git -C "$r" rev-parse HEAD)"
code="$(cd "$r" && echo "refs/heads/main $head refs/heads/main $base" | bash scripts/eval-gate.sh >/dev/null 2>&1; echo $?)"
check "untouched eval-less skill is ignored" 0 "$code"

# Scenario F: touched EXISTING skill loses/lacks eval -> BLOCK
r="$(setup_repo)"; add_skill "$r" "plugins/p/skills/legacy2"     # committed without eval
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm base
base="$(git -C "$r" rev-parse HEAD)"
echo "touched" >> "$r/plugins/p/skills/legacy2/SKILL.md"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm edit
head="$(git -C "$r" rev-parse HEAD)"
code="$(cd "$r" && echo "refs/heads/main $head refs/heads/main $base" | bash scripts/eval-gate.sh >/dev/null 2>&1; echo $?)"
check "touched existing eval-less skill blocks" 1 "$code"

echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
