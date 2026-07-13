#!/usr/bin/env bash
# scripts/scout-gate.test.sh — fixture-repo scenarios for the scout-gate.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
GATE="$HERE/scout-gate.sh"
VALIDATE="$HERE/scout_validate.py"
pass=0; fail=0
check() { # desc expected_code actual_code
  if [ "$2" = "$3" ]; then echo "  ok: $1"; pass=$((pass+1));
  else echo "  FAIL: $1 (want exit $2, got $3)"; fail=$((fail+1)); fi
}
check_output_contains() { # desc needle actual_output
  case "$3" in
    *"$2"*) echo "  ok: $1"; pass=$((pass+1)) ;;
    *) echo "  FAIL: $1 (expected output to contain: $2)"; fail=$((fail+1)) ;;
  esac
}

setup_repo() { # -> echoes repo path; sets up an "origin/main" ref the fallback resolves against
  local r; r="$(mktemp -d)"
  git -C "$r" init -q
  git -C "$r" config user.email t@t; git -C "$r" config user.name t
  mkdir -p "$r/scripts"
  cp "$GATE" "$r/scripts/scout-gate.sh"
  cp "$VALIDATE" "$r/scripts/scout_validate.py"
  echo "$r"
}

# add_skill repo dir_rel [tags] [notes] [allowed_tools_csv] [with_meta=1]
#   Creates plugins/.../skills/<name>/SKILL.md (+ metadata.yaml unless with_meta=0).
add_skill() {
  local r="$1" dir="$2" tags="${3:-}" notes="${4:-}" tools="${5:-}" with_meta="${6:-1}"
  mkdir -p "$r/$dir"
  {
    echo "---"
    echo "description: A test skill."
    if [ -n "$tools" ]; then echo "allowed-tools: [$tools]"; fi
    echo "---"
    echo ""
    echo "# Test Skill"
  } > "$r/$dir/SKILL.md"
  if [ "$with_meta" = "1" ]; then
    {
      echo "schema-version: 1"
      echo "purpose: Does a thing that helps."
      echo "best-for: When you need the thing."
      echo "needs: []"
      echo "changes:"
      echo "  tags: [$tags]"
      echo "  notes: \"$notes\""
    } > "$r/$dir/metadata.yaml"
  fi
}

# freeze_as_origin_main repo: commits current state, points refs/remotes/origin/main at it
freeze_as_origin_main() {
  local r="$1"
  git -C "$r" add -A >/dev/null
  git -C "$r" commit -qm base
  git -C "$r" update-ref refs/remotes/origin/main HEAD
}

run_gate() { ( cd "$1" && bash scripts/scout-gate.sh ) 2>&1; }

# ---------------------------------------------------------------------------
# Scenario A: diff touches one skill with a VALID sidecar -> gate PASSES.
# ---------------------------------------------------------------------------
r="$(setup_repo)"
add_skill "$r" "plugins/p/skills/base" "files" "" ""
freeze_as_origin_main "$r"
add_skill "$r" "plugins/p/skills/valid" "files" "" ""
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm "add valid skill"
out="$(run_gate "$r")"; code=$?
check "valid sidecar passes" 0 "$code"

# ---------------------------------------------------------------------------
# Scenario B: diff ADDS a skill with NO sidecar -> gate BLOCKS, naming it.
# ---------------------------------------------------------------------------
r="$(setup_repo)"
add_skill "$r" "plugins/p/skills/base" "files" "" ""
freeze_as_origin_main "$r"
add_skill "$r" "plugins/p/skills/nosidecar" "" "" "" 0
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm "add skill without sidecar"
out="$(run_gate "$r")"; code=$?
check "no-sidecar skill blocks" 1 "$code"
check_output_contains "no-sidecar block names the skill" "plugins/p/skills/nosidecar" "$out"

# ---------------------------------------------------------------------------
# Scenario C: allowed-tools frontmatter self-contradiction (mutating tool
# grant + changes.tags:[]) -> the ONE hard-FAIL arm. Gate BLOCKS, naming
# the offending skill.
# ---------------------------------------------------------------------------
r="$(setup_repo)"
add_skill "$r" "plugins/p/skills/base" "files" "" ""
freeze_as_origin_main "$r"
add_skill "$r" "plugins/p/skills/badgrant" "" "" "Write"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm "add skill with allowed-tools self-contradiction"
out="$(run_gate "$r")"; code=$?
check "allowed-tools self-contradiction blocks" 1 "$code"
check_output_contains "self-contradiction block names the skill" "plugins/p/skills/badgrant" "$out"

# ---------------------------------------------------------------------------
# Scenario D: bundled mutating script + changes.tags:[] -> author-asserted
# ambiguity, not a frontmatter grant -> gate PASSES (exit 0) but RECORDS
# self-asserted for the offending skill.
# ---------------------------------------------------------------------------
r="$(setup_repo)"
add_skill "$r" "plugins/p/skills/base" "files" "" ""
freeze_as_origin_main "$r"
add_skill "$r" "plugins/p/skills/contradiction" "" "" ""
cat > "$r/plugins/p/skills/contradiction/run.sh" <<'SCRIPT'
#!/usr/bin/env bash
rm -rf /tmp/whatever
SCRIPT
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm "add contradiction skill"
out="$(run_gate "$r")"; code=$?
check "bundled mutating script + empty tags passes" 0 "$code"
check_output_contains "mutating-script ambiguity recorded as self-asserted" "self-asserted" "$out"

# ---------------------------------------------------------------------------
# Scenario E: broad-grant ambiguity (allowed-tools: Bash, changes.tags:[])
# -> gate PASSES (exit 0) but RECORDS self-asserted in output.
# ---------------------------------------------------------------------------
r="$(setup_repo)"
add_skill "$r" "plugins/p/skills/base" "files" "" ""
freeze_as_origin_main "$r"
add_skill "$r" "plugins/p/skills/broad" "" "" "Bash"
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm "add broad-grant skill"
out="$(run_gate "$r")"; code=$?
check "broad-grant ambiguity passes" 0 "$code"
check_output_contains "broad-grant ambiguity recorded as self-asserted" "self-asserted" "$out"

# ---------------------------------------------------------------------------
# Scenario F: the origin/main..HEAD diff path is LIVE — a bad skill added on
# top of a clean base is still caught (proves the gate doesn't vacuously pass
# because the base/origin ref failed to resolve).
# ---------------------------------------------------------------------------
r="$(setup_repo)"
add_skill "$r" "plugins/p/skills/clean" "files" "" ""
freeze_as_origin_main "$r"
add_skill "$r" "plugins/p/skills/bad" "" "" "" 0
git -C "$r" add -A >/dev/null; git -C "$r" commit -qm "add bad skill on top of clean base"
out="$(run_gate "$r")"; code=$?
check "diff path is live: bad skill on clean base still caught" 1 "$code"
check_output_contains "live-diff block names the bad skill" "plugins/p/skills/bad" "$out"
if echo "$out" | grep -q "plugins/p/skills/clean"; then
  echo "  FAIL: untouched clean skill should not appear in output"; fail=$((fail+1))
else
  echo "  ok: untouched clean skill not flagged"; pass=$((pass+1))
fi

echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
