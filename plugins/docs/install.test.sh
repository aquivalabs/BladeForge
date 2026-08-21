#!/usr/bin/env bash
set -euo pipefail

# Installer test suite. Uses REAL git repos (fresh `git init` targets, a real `git init --bare`
# remote for the push-rejection block) rather than fixtures, because the thing under test — staging,
# core.hooksPath, a real push getting rejected — only exists once git is actually driving it. Offline
# throughout: no `gh`, no network.

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL="$HERE/install.sh"
MARKET_ROOT="$(cd "$HERE/../.." && pwd)"
MARKET_NAME="$(jq -r '.name' "$MARKET_ROOT/.claude-plugin/marketplace.json")"

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

init_repo() {
  local d="$1"
  mkdir -p "$d"
  git init -q "$d"
  git -C "$d" config user.name "docs-install-test"
  git -C "$d" config user.email "docs-install-test@example.com"
  git -C "$d" config commit.gpgsign false
}

# Build a PATH directory that has every executable on this machine's usual bin dirs EXCEPT the one
# named $2 — used to simulate "jq is not installed" / "python3 is not installed" without touching the
# real PATH or any other test's environment.
build_path_excluding() {
  local dir="$1" exclude="$2" srcdir f name
  mkdir -p "$dir"
  for srcdir in /usr/bin /bin /usr/sbin /sbin /usr/local/bin /opt/homebrew/bin; do
    [ -d "$srcdir" ] || continue
    for f in "$srcdir"/*; do
      [ -f "$f" ] && [ -x "$f" ] || continue
      name="$(basename "$f")"
      [ "$name" = "$exclude" ] && continue
      [ -e "$dir/$name" ] && continue
      ln -sf "$f" "$dir/$name" 2>/dev/null || true
    done
  done
}

fail() { echo "FAIL: $1"; exit 1; }

# ===========================================================================
# Block 1 — fresh install into a `git init` target produces the whole layout,
# and .claude/settings.json carries the marketplace + docs@<market> entries.
# ===========================================================================
echo "=== block 1: fresh install ==="
T1="$ROOT/t1"
init_repo "$T1"
bash "$INSTALL" "$T1" >/dev/null

for p in scripts/docs-check.py .claude/docs.config.schema.json .claude/docs.config.json \
         docs/README.md docs/adr/README.md docs/mechanisms/README.md docs/mechanisms/price-rounding.md \
         .githooks/pre-push .github/workflows/docs-check.yml .claude/settings.json; do
  [ -f "$T1/$p" ] || fail "MISSING: $p (block 1)"
done
[ -x "$T1/.githooks/pre-push" ] || fail ".githooks/pre-push not executable (block 1)"

jq -e --arg m "$MARKET_NAME" '.extraKnownMarketplaces[$m] != null' "$T1/.claude/settings.json" >/dev/null \
  || fail "extraKnownMarketplaces entry missing (block 1)"
jq -e --arg m "$MARKET_NAME" '.enabledPlugins["docs@" + $m] == true' "$T1/.claude/settings.json" >/dev/null \
  || fail "enabledPlugins docs@<market> entry missing (block 1)"
echo "block 1: OK"

# ===========================================================================
# Block 2 — idempotence: running the installer twice against the same fresh
# target leaves the hook file containing the invocation exactly once.
# ===========================================================================
echo "=== block 2: idempotence ==="
bash "$INSTALL" "$T1" >/dev/null
COUNT="$(grep -c 'docs-check.py' "$T1/.githooks/pre-push")"
[ "$COUNT" = "1" ] || fail "expected exactly 1 docs-check.py invocation, got $COUNT (block 2)"
echo "block 2: OK"

# ===========================================================================
# Block 3 — re-run policy in both directions: the check and the schema are
# refreshed even from junk; the config, the doc seeds, and the hook survive a
# re-run byte-identical to whatever the project mutated them into.
# ===========================================================================
echo "=== block 3: re-run policy ==="
echo '{"mutated":true}' > "$T1/.claude/docs.config.json"
echo "mutated readme" > "$T1/docs/README.md"
echo "mutated adr readme" > "$T1/docs/adr/README.md"
echo "mutated live doc" > "$T1/docs/mechanisms/price-rounding.md"
{ echo ""; echo "# mutated marker — a project-added line"; } >> "$T1/.githooks/pre-push"

HOOK_SUM_BEFORE="$(shasum "$T1/.githooks/pre-push")"
CONFIG_SUM_BEFORE="$(shasum "$T1/.claude/docs.config.json")"
README_SUM_BEFORE="$(shasum "$T1/docs/README.md")"
ADR_README_SUM_BEFORE="$(shasum "$T1/docs/adr/README.md")"
LIVE_DOC_SUM_BEFORE="$(shasum "$T1/docs/mechanisms/price-rounding.md")"

echo "junk" > "$T1/scripts/docs-check.py"
echo "junk" > "$T1/.claude/docs.config.schema.json"

bash "$INSTALL" "$T1" >/dev/null

diff -q "$HERE/docs-check.py" "$T1/scripts/docs-check.py" >/dev/null \
  || fail "scripts/docs-check.py not refreshed on re-run (block 3)"
diff -q "$HERE/docs.config.schema.json" "$T1/.claude/docs.config.schema.json" >/dev/null \
  || fail "schema not refreshed on re-run (block 3)"

[ "$(shasum "$T1/.githooks/pre-push")" = "$HOOK_SUM_BEFORE" ] || fail "hook clobbered on re-run (block 3)"
[ "$(shasum "$T1/.claude/docs.config.json")" = "$CONFIG_SUM_BEFORE" ] || fail "config clobbered on re-run (block 3)"
[ "$(shasum "$T1/docs/README.md")" = "$README_SUM_BEFORE" ] || fail "docs/README.md clobbered on re-run (block 3)"
[ "$(shasum "$T1/docs/adr/README.md")" = "$ADR_README_SUM_BEFORE" ] || fail "adr README clobbered on re-run (block 3)"
[ "$(shasum "$T1/docs/mechanisms/price-rounding.md")" = "$LIVE_DOC_SUM_BEFORE" ] \
  || fail "live-doc example clobbered on re-run (block 3)"
echo "block 3: OK"

# ===========================================================================
# Block 4 — core.hooksPath already elsewhere: the project's own hook keeps
# firing, core.hooksPath is left alone, and the appended invocation runs too.
# ===========================================================================
echo "=== block 4: core.hooksPath already elsewhere ==="
T4="$ROOT/t4"
init_repo "$T4"
mkdir -p "$T4/tools/hooks"
printf '#!/usr/bin/env bash\nset -e\ntouch "$(git rev-parse --show-toplevel)/marker.txt"\n' \
  > "$T4/tools/hooks/pre-push"
chmod +x "$T4/tools/hooks/pre-push"
git -C "$T4" config core.hooksPath tools/hooks
git -C "$T4" add -A
git -C "$T4" commit -q -m "external hook"

bash "$INSTALL" "$T4" >/dev/null

HOOKS_PATH_AFTER="$(git -C "$T4" config --get core.hooksPath)"
[ "$HOOKS_PATH_AFTER" = "tools/hooks" ] || fail "core.hooksPath changed to '$HOOKS_PATH_AFTER' (block 4)"
grep -q 'docs-check.py' "$T4/tools/hooks/pre-push" || fail "external hook not extended (block 4)"

HOOK_OUTPUT="$( (cd "$T4" && bash tools/hooks/pre-push) 2>&1 || true )"
[ -f "$T4/marker.txt" ] || fail "the project's own hook effect (the marker) did not fire (block 4)"
echo "$HOOK_OUTPUT" | grep -q 'no mechanisms declared' \
  || fail "the appended docs-check.py invocation did not run (block 4)"
echo "block 4: OK"

# ===========================================================================
# Block 5 — a REAL git push, rejected for an unpaired mechanism change and
# accepted once the doc is touched in the same range. The spec's central
# commitment, and the only place it is tested.
# ===========================================================================
echo "=== block 5: real push rejection ==="
T5="$ROOT/t5"
REMOTE5="$ROOT/t5-remote.git"
init_repo "$T5"
git init -q --bare "$REMOTE5"
git -C "$T5" remote add origin "$REMOTE5"

mkdir -p "$T5/src/pricing"
printf 'def round_price(x):\n    return round(x, 2)\n' > "$T5/src/pricing/round.py"
git -C "$T5" add -A
git -C "$T5" commit -q -m "seed pricing"

bash "$INSTALL" "$T5" >/dev/null

jq '.mechanisms = [{"id":"price-rounding","paths":["src/pricing/**"],"doc":"docs/mechanisms/price-rounding.md"}]' \
  "$T5/.claude/docs.config.json" > "$T5/.claude/docs.config.json.new"
mv "$T5/.claude/docs.config.json.new" "$T5/.claude/docs.config.json"

git -C "$T5" add -A
git -C "$T5" commit -q -m "install docs standard + declare the price-rounding mechanism"
# Seed the PR base out of band, bypassing the local hook for just this one push — establishing
# "the state main was already at" is test-harness setup, not part of what this block tests. The two
# pushes that follow (the violation, and the fix) both go through the real, installed hook.
git -C "$T5" push --no-verify -q origin HEAD:refs/heads/main
git -C "$T5" fetch -q origin

# Violate: touch the mechanism's path, leave its doc untouched.
printf 'def round_price(x):\n    return round(x, 3)\n' > "$T5/src/pricing/round.py"
git -C "$T5" add -A
git -C "$T5" commit -q -m "change rounding, forget the doc"

set +e
PUSH1_OUT="$(git -C "$T5" push origin HEAD:refs/heads/main 2>&1)"
PUSH1_RC=$?
set -e
[ "$PUSH1_RC" -ne 0 ] || fail "push with an unpaired mechanism change was accepted (block 5)"
echo "$PUSH1_OUT" | grep -q 'paired-docs' \
  || { echo "$PUSH1_OUT"; fail "rejected push did not cite paired-docs (block 5)"; }
echo "block 5a: unpaired change correctly rejected"

# Fix: touch the doc, same range.
{ echo ""; echo "Rounding now keeps three decimals for this demo."; } >> "$T5/docs/mechanisms/price-rounding.md"
git -C "$T5" add -A
git -C "$T5" commit -q -m "update the price-rounding doc"

set +e
PUSH2_OUT="$(git -C "$T5" push origin HEAD:refs/heads/main 2>&1)"
PUSH2_RC=$?
set -e
if [ "$PUSH2_RC" -eq 0 ]; then
  echo "block 5b: push accepted once the doc was touched"
else
  echo "$PUSH2_OUT" | grep -q 'paired-docs' \
    && { echo "$PUSH2_OUT"; fail "paired-docs still objects after the doc was fixed (block 5)"; }
  echo "$PUSH2_OUT"
  fail "push rejected for an unexpected reason after the doc was fixed (block 5)"
fi
echo "block 5: OK"

# ===========================================================================
# Block 6 — jq unavailable, twice: once with core.hooksPath already pointed
# elsewhere, once already pointed at .githooks/ with the invocation missing.
# Both must fail cleanly: the pre-existing hook untouched, core.hooksPath
# unchanged, no partial install.
# ===========================================================================
echo "=== block 6: jq unavailable ==="
NOJQ_PATH="$ROOT/path-no-jq"
build_path_excluding "$NOJQ_PATH" jq
PATH="$NOJQ_PATH" bash -c 'command -v jq' >/dev/null 2>&1 && fail "curated PATH still resolves jq (block 6 setup)"
PATH="$NOJQ_PATH" bash -c 'command -v python3' >/dev/null 2>&1 || fail "curated PATH lost python3 (block 6 setup)"

# 6a: core.hooksPath already elsewhere.
T6A="$ROOT/t6a"
init_repo "$T6A"
mkdir -p "$T6A/tools/hooks"
printf '#!/usr/bin/env bash\nset -e\ntouch "$(git rev-parse --show-toplevel)/marker.txt"\n' \
  > "$T6A/tools/hooks/pre-push"
chmod +x "$T6A/tools/hooks/pre-push"
git -C "$T6A" config core.hooksPath tools/hooks
git -C "$T6A" add -A
git -C "$T6A" commit -q -m "external hook"

HOOK_SUM_BEFORE_6A="$(shasum "$T6A/tools/hooks/pre-push")"
HOOKS_PATH_BEFORE_6A="$(git -C "$T6A" config --get core.hooksPath)"

set +e
PATH="$NOJQ_PATH" bash "$INSTALL" "$T6A" >"$ROOT/t6a.out" 2>&1
RC6A=$?
set -e
[ "$RC6A" -ne 0 ] || { cat "$ROOT/t6a.out"; fail "install succeeded with jq missing (block 6a)"; }
[ "$(shasum "$T6A/tools/hooks/pre-push")" = "$HOOK_SUM_BEFORE_6A" ] \
  || fail "external hook mutated despite jq failure (block 6a)"
[ "$(git -C "$T6A" config --get core.hooksPath)" = "$HOOKS_PATH_BEFORE_6A" ] \
  || fail "core.hooksPath changed despite jq failure (block 6a)"
[ -f "$T6A/.claude/docs.config.json" ] && fail "partial install left a config behind (block 6a)"
[ -f "$T6A/scripts/docs-check.py" ] && fail "partial install left the check behind (block 6a)"
echo "block 6a: OK"

# 6b: core.hooksPath already .githooks/, invocation missing.
T6B="$ROOT/t6b"
init_repo "$T6B"
mkdir -p "$T6B/.githooks"
printf '#!/usr/bin/env bash\nset -e\necho custom project hook\n' > "$T6B/.githooks/pre-push"
chmod +x "$T6B/.githooks/pre-push"
git -C "$T6B" config core.hooksPath .githooks/
git -C "$T6B" add -A
git -C "$T6B" commit -q -m "pre-existing own-path hook, no invocation yet"

HOOK_SUM_BEFORE_6B="$(shasum "$T6B/.githooks/pre-push")"
HOOKS_PATH_BEFORE_6B="$(git -C "$T6B" config --get core.hooksPath)"

set +e
PATH="$NOJQ_PATH" bash "$INSTALL" "$T6B" >"$ROOT/t6b.out" 2>&1
RC6B=$?
set -e
[ "$RC6B" -ne 0 ] || { cat "$ROOT/t6b.out"; fail "install succeeded with jq missing (block 6b)"; }
[ "$(shasum "$T6B/.githooks/pre-push")" = "$HOOK_SUM_BEFORE_6B" ] \
  || fail "own-path hook mutated despite jq failure (block 6b)"
[ "$(git -C "$T6B" config --get core.hooksPath)" = "$HOOKS_PATH_BEFORE_6B" ] \
  || fail "core.hooksPath changed despite jq failure (block 6b)"
[ -f "$T6B/.claude/docs.config.json" ] && fail "partial install left a config behind (block 6b)"
echo "block 6b: OK"
echo "block 6: OK"

# ===========================================================================
# Block 7 — python3 absent: the installer reports it, skips the check, the
# hook, and the CI workflow, and still installs everything else.
# ===========================================================================
echo "=== block 7: python3 absent ==="
NOPY_PATH="$ROOT/path-no-python3"
build_path_excluding "$NOPY_PATH" python3
PATH="$NOPY_PATH" bash -c 'command -v python3' >/dev/null 2>&1 && fail "curated PATH still resolves python3 (block 7 setup)"
PATH="$NOPY_PATH" bash -c 'command -v jq' >/dev/null 2>&1 || fail "curated PATH lost jq (block 7 setup)"

T7="$ROOT/t7"
init_repo "$T7"
set +e
PATH="$NOPY_PATH" bash "$INSTALL" "$T7" >"$ROOT/t7.out" 2>&1
RC7=$?
set -e
[ "$RC7" -eq 0 ] || { cat "$ROOT/t7.out"; fail "installer exited non-zero without python3 (block 7)"; }
grep -qi 'python3' "$ROOT/t7.out" || fail "installer did not report python3's absence (block 7)"

[ -f "$T7/scripts/docs-check.py" ] && fail "docs-check.py vendored despite no python3 (block 7)"
[ -f "$T7/.githooks/pre-push" ] && fail "hook seeded despite no python3 (block 7)"
[ -f "$T7/.github/workflows/docs-check.yml" ] && fail "CI workflow seeded despite no python3 (block 7)"
for p in .claude/docs.config.schema.json .claude/docs.config.json docs/README.md docs/adr/README.md \
         docs/mechanisms/README.md docs/mechanisms/price-rounding.md .claude/settings.json; do
  [ -f "$T7/$p" ] || fail "MISSING: $p should still install without python3 (block 7)"
done
echo "block 7: OK"

# ===========================================================================
# Block 8 — schema-version skew via a re-run: bump the schema's version in a
# COPY of plugins/docs (never the repo's own schema), re-run that copy's
# installer, and the vendored check reports the mismatch with both numbers.
# ===========================================================================
echo "=== block 8: schema-version skew ==="
T8="$ROOT/t8"
init_repo "$T8"
bash "$INSTALL" "$T8" >/dev/null

mkdir -p "$T8/src/pricing"
printf 'def round_price(x):\n    return round(x, 2)\n' > "$T8/src/pricing/round.py"
jq '.mechanisms = [{"id":"price-rounding","paths":["src/pricing/**"],"doc":"docs/mechanisms/price-rounding.md"}]' \
  "$T8/.claude/docs.config.json" > "$T8/.claude/docs.config.json.new"
mv "$T8/.claude/docs.config.json.new" "$T8/.claude/docs.config.json"
CONFIG_SCHEMA_VERSION_BEFORE="$(jq -r '.schemaVersion' "$T8/.claude/docs.config.json")"
git -C "$T8" add -A
git -C "$T8" commit -q -m "declare mechanism"

# A full copy of the marketplace shape (not just plugins/docs/) so the copy's install.sh resolves its
# own MARKET_ROOT correctly; the schema is bumped in THIS COPY ONLY.
MARKETCOPY="$ROOT/marketcopy"
mkdir -p "$MARKETCOPY/plugins" "$MARKETCOPY/.claude-plugin"
cp -R "$HERE" "$MARKETCOPY/plugins/docs"
cp "$MARKET_ROOT/.claude-plugin/marketplace.json" "$MARKETCOPY/.claude-plugin/marketplace.json"
git init -q "$MARKETCOPY"
git -C "$MARKETCOPY" remote add origin "$(git -C "$MARKET_ROOT" remote get-url origin 2>/dev/null || echo "https://example.invalid/copy.git")"

jq '.version = "999"' "$MARKETCOPY/plugins/docs/docs.config.schema.json" \
  > "$MARKETCOPY/plugins/docs/docs.config.schema.json.new"
mv "$MARKETCOPY/plugins/docs/docs.config.schema.json.new" "$MARKETCOPY/plugins/docs/docs.config.schema.json"

bash "$MARKETCOPY/plugins/docs/install.sh" "$T8" >/dev/null

MECH_BEFORE="$(jq -c '.mechanisms' "$T8/.claude/docs.config.json")"
CHECK_OUT="$( (cd "$T8" && python3 scripts/docs-check.py) 2>&1 || true )"
echo "$CHECK_OUT" | grep -q 'config schema version mismatch' \
  || { echo "$CHECK_OUT"; fail "schema-skew mismatch not reported (block 8)"; }
echo "$CHECK_OUT" | grep -q "$CONFIG_SCHEMA_VERSION_BEFORE" \
  || { echo "$CHECK_OUT"; fail "mismatch message missing the config's own schemaVersion (block 8)"; }
echo "$CHECK_OUT" | grep -q '999' \
  || { echo "$CHECK_OUT"; fail "mismatch message missing the bumped schema version (block 8)"; }
MECH_AFTER="$(jq -c '.mechanisms' "$T8/.claude/docs.config.json")"
[ "$MECH_BEFORE" = "$MECH_AFTER" ] || fail "config's mechanism list mutated by a re-run (block 8)"
echo "block 8: OK"
# NOTE: because of the same known schema-shape defect flagged in block 5, config-sanity already
# reports a version mismatch on a freshly seeded, never-bumped config — this block proves the message
# names both numbers correctly, but does not by itself prove the bump specifically caused the finding.

# ===========================================================================
# Block 9 — a target with no review.config.json and no prior marketplace
# wiring still ends up correctly wired.
# ===========================================================================
echo "=== block 9: no prior wiring ==="
T9="$ROOT/t9"
init_repo "$T9"
[ -f "$T9/review.config.json" ] && fail "review.config.json unexpectedly pre-exists (block 9 setup)"
[ -f "$T9/.claude/settings.json" ] && fail "settings.json unexpectedly pre-exists (block 9 setup)"

bash "$INSTALL" "$T9" >/dev/null

jq -e --arg m "$MARKET_NAME" '.extraKnownMarketplaces[$m] != null and (.enabledPlugins["docs@" + $m] == true)' \
  "$T9/.claude/settings.json" >/dev/null || fail "marketplace/plugin not wired from a cold start (block 9)"
echo "block 9: OK"

echo ""
echo "INSTALL TEST PASS"
