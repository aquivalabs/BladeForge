#!/usr/bin/env bash
set -euo pipefail

# Self-locating installer for the docs standard. Run from a target repo, or pass the repo path.
#   bash install.sh [TARGET_REPO]    (TARGET_REPO defaults to $PWD)
# Vendors the deterministic pre-push check + its config schema, seeds the starter config, the doc-layer
# READMEs and the worked live-doc example, wires a git pre-push hook (via core.hooksPath) and a CI
# workflow, and merges the marketplace + docs plugin into the target's committed .claude/settings.json.
# Every write is staged into a temp directory first; only a fully-succeeded stage is moved into place,
# so a failed run (missing jq, mid-way error) leaves the target exactly as it started. Self-aware: the
# marketplace name + source repo are derived from THIS plugin's own marketplace, so the same script
# works unchanged from either marketplace.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKET_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET="${1:-$PWD}"
mkdir -p "$TARGET"

# ---------------------------------------------------------------------------
# python3 gate — checked first. Without it the check cannot run anywhere, so we
# never vendor it, never wire a hook that would just fail, and never install a
# CI workflow that would only ever go red. Everything else (doc seeds, config,
# schema, the settings.json wiring) still installs.
# ---------------------------------------------------------------------------
HAVE_PYTHON3=true
if ! command -v python3 >/dev/null 2>&1; then
  HAVE_PYTHON3=false
  echo "NOTE: python3 was not found on PATH."
  echo "      Skipping scripts/docs-check.py, the pre-push hook wiring, and the CI workflow."
  echo "      Everything else (doc seeds, config, schema, .claude/settings.json) still installs."
  echo "      Put python3 3.9+ on PATH in this project and re-run this installer to finish the gate."
fi

# ---------------------------------------------------------------------------
# core.hooksPath — read the existing value BEFORE writing anything, and decide
# which of the four branches applies. The actual git-config write and the two
# hook-file appends only happen at the very end, after every jq-dependent step
# below has already succeeded (see "unstageable side effects").
# ---------------------------------------------------------------------------
HOOK_BRANCH=""
CURRENT_HOOKS_PATH=""
if $HAVE_PYTHON3; then
  if ! git -C "$TARGET" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "ERROR: $TARGET is not a git repository." >&2
    echo "       core.hooksPath cannot be wired here — nothing was installed." >&2
    echo "       Initialize git, or wire the check by hand: point core.hooksPath at a hook" >&2
    echo "       directory and add 'python3 scripts/docs-check.py' to its pre-push script." >&2
    exit 1
  fi
  CURRENT_HOOKS_PATH="$(git -C "$TARGET" config --get core.hooksPath 2>/dev/null || true)"
  case "$CURRENT_HOOKS_PATH" in
    "") HOOK_BRANCH="unset" ;;
    .githooks | .githooks/) HOOK_BRANCH="own" ;;
    *) HOOK_BRANCH="elsewhere" ;;
  esac
fi

# ---------------------------------------------------------------------------
# Stage every write. Every jq-dependent step below runs against files in this
# staging directory, never against the target directly.
# ---------------------------------------------------------------------------
STAGE="$(mktemp -d)"
cleanup_stage() { rm -rf "$STAGE"; }
trap cleanup_stage EXIT

# plugin-owned — always refreshed, no existence check.
mkdir -p "$STAGE/.claude"
cp "$SCRIPT_DIR/docs.config.schema.json" "$STAGE/.claude/docs.config.schema.json"
if $HAVE_PYTHON3; then
  mkdir -p "$STAGE/scripts"
  cp "$SCRIPT_DIR/docs-check.py" "$STAGE/scripts/docs-check.py"
fi

# .claude/docs.config.json — seeded once, with schemaVersion copied in from the schema's own version.
if [ ! -f "$TARGET/.claude/docs.config.json" ]; then
  SCHEMA_VERSION="$(jq -r 'if (.version | type) == "object" then .version.const else .version end' \
    "$SCRIPT_DIR/docs.config.schema.json")"
  jq --arg v "$SCHEMA_VERSION" '.schemaVersion = $v' "$SCRIPT_DIR/templates/starter.docs.config.json" \
    > "$STAGE/.claude/docs.config.json"
fi

# Doc-layer READMEs and the worked live-doc example — seeded once each, never overwritten.
seed_once() {
  local target_rel="$1" template="$2"
  if [ ! -f "$TARGET/$target_rel" ]; then
    mkdir -p "$STAGE/$(dirname "$target_rel")"
    cp "$SCRIPT_DIR/templates/$template" "$STAGE/$target_rel"
  fi
}
seed_once "docs/README.md" "docs-readme.md"
seed_once "docs/adr/README.md" "adr-readme.md"
seed_once "docs/mechanisms/README.md" "live-doc-readme.md"
seed_once "docs/mechanisms/price-rounding.md" "live-doc-example.md"

# The pre-push hook file itself is only a plain new-file creation on the "unset" branch (core.hooksPath
# was never set). The "own" and "elsewhere" branches extend an EXISTING file outside this stage, which
# cannot be staged — those happen later, in the unstageable section.
if [ "$HOOK_BRANCH" = "unset" ]; then
  mkdir -p "$STAGE/.githooks"
  cp "$SCRIPT_DIR/templates/pre-push-hook" "$STAGE/.githooks/pre-push"
  chmod +x "$STAGE/.githooks/pre-push"
fi

# CI workflow — created only if absent, and only when the check can actually run.
if $HAVE_PYTHON3 && [ ! -f "$TARGET/.github/workflows/docs-check.yml" ]; then
  mkdir -p "$STAGE/.github/workflows"
  cp "$SCRIPT_DIR/templates/docs-check.yml" "$STAGE/.github/workflows/docs-check.yml"
fi

# .claude/settings.json — jq merge, run against the staged copy (seeded from the target's existing
# file, or a fresh {} when none exists).
mkdir -p "$STAGE/.claude"
if [ -f "$TARGET/.claude/settings.json" ]; then
  cp "$TARGET/.claude/settings.json" "$STAGE/.claude/settings.json"
else
  echo '{}' > "$STAGE/.claude/settings.json"
fi
MARKET_NAME="$(jq -r '.name' "$MARKET_ROOT/.claude-plugin/marketplace.json")"
REPO="$(git -C "$MARKET_ROOT" remote get-url origin 2>/dev/null | sed -E 's#\.git$##; s#^.*[:/]([^/]+/[^/]+)$#\1#')"
tmp="$(mktemp)"
jq --arg m "$MARKET_NAME" --arg r "$REPO" \
  '.extraKnownMarketplaces[$m] = {source:{source:"github", repo:$r}}
   | .enabledPlugins["docs@" + $m] = true' \
  "$STAGE/.claude/settings.json" > "$tmp" && mv "$tmp" "$STAGE/.claude/settings.json"

# ---------------------------------------------------------------------------
# Move: every jq-dependent step above has already succeeded, so the stage is
# complete. Commit it into the target now — this is the one point where a
# partial install could otherwise happen, and it can't, because everything
# above only ever touched $STAGE.
# ---------------------------------------------------------------------------
while IFS= read -r -d '' f; do
  rel="${f#"$STAGE"/}"
  mkdir -p "$TARGET/$(dirname "$rel")"
  cp -p "$f" "$TARGET/$rel"
done < <(find "$STAGE" -type f -print0)

# ---------------------------------------------------------------------------
# The three side effects that cannot be staged. They happen LAST, only now that
# every file above is already safely in place:
#   1. the git config core.hooksPath write
#   2. the append to a hook this installer already owns from a prior run
#   3. the append to a third party's hook
# ---------------------------------------------------------------------------
if [ "$HOOK_BRANCH" = "unset" ]; then
  git -C "$TARGET" config core.hooksPath .githooks/
  echo "set core.hooksPath to .githooks/ and installed the pre-push gate"
elif [ "$HOOK_BRANCH" = "own" ]; then
  HOOK_FILE="$TARGET/.githooks/pre-push"
  if grep -q 'docs-check.py' "$HOOK_FILE" 2>/dev/null; then
    echo "kept .githooks/pre-push (already invokes the docs check)"
  else
    {
      echo ""
      echo "# Docs gate (added by the docs plugin installer)."
      echo "python3 scripts/docs-check.py"
    } >> "$HOOK_FILE"
    chmod +x "$HOOK_FILE"
    echo "extended .githooks/pre-push with the docs check"
  fi
elif [ "$HOOK_BRANCH" = "elsewhere" ]; then
  case "$CURRENT_HOOKS_PATH" in
    /*) HOOK_DIR="$CURRENT_HOOKS_PATH" ;;
    *) HOOK_DIR="$TARGET/$CURRENT_HOOKS_PATH" ;;
  esac
  HOOK_FILE="$HOOK_DIR/pre-push"
  if [ -f "$HOOK_FILE" ] && grep -q 'docs-check.py' "$HOOK_FILE" 2>/dev/null; then
    echo "kept $CURRENT_HOOKS_PATH/pre-push (already invokes the docs check)"
  else
    if [ ! -f "$HOOK_FILE" ]; then
      mkdir -p "$HOOK_DIR"
      { echo "#!/usr/bin/env bash"; echo "set -e"; } > "$HOOK_FILE"
    fi
    {
      echo ""
      echo "# Docs gate (added by the docs plugin installer) — kept your existing pre-push hook firing."
      echo "python3 scripts/docs-check.py"
    } >> "$HOOK_FILE"
    chmod +x "$HOOK_FILE"
    echo "extended $CURRENT_HOOKS_PATH/pre-push with the docs check (core.hooksPath left as-is)"
  fi
fi

echo ""
echo "------------------------------------------------------------------"
echo " OK  Docs standard files are now in: $TARGET"
echo "------------------------------------------------------------------"
if ! $HAVE_PYTHON3; then
  echo " python3 was not found, so the check, the hook wiring, and the CI workflow were skipped."
  echo " Install python3 3.9+ in this project, then re-run this installer to finish the gate."
  echo ""
fi
echo " The judgement is still left, on purpose. The seeded .claude/docs.config.json is a template,"
echo " not an answer: it declares NO mechanisms, so 'python3 scripts/docs-check.py' exits non-zero"
echo " right now printing 'no mechanisms declared', and its other defaults are guesses about this"
echo " project that may be wrong. That is not a bug — a human has to look at this repository."
echo " Open it in Claude Code and follow the ADOPTION section of the docs:standard skill: seven"
echo " ordered steps, of which the mechanism derivation is the last. The first four are detection"
echo " and take minutes — they catch an instruction file this installer guessed wrong, a layer the"
echo " repo already has and the config does not declare, and a layer split across two directories."
echo ""
echo " Host preconditions this installer and the check rely on: jq (for this installer's merge"
echo " step), python3 3.9+ in the target project (to run the check itself), and gh (only for the"
echo " bootstrap one-liner, not for this script)."
echo "------------------------------------------------------------------"
