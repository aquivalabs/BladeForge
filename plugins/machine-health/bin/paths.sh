#!/usr/bin/env bash
# Shared paths for the machine-health hook and install script. The binary lives at a fixed path, not
# in the versioned plugin cache, so a user's status-line script can call it across plugin updates.
MH_ROOT="${MH_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
MH_LOCK="$MH_ROOT/bin.lock.json"
case "$(uname -s)" in
  Darwin) MH_OS=darwin; MH_DIR="${MACHINE_HEALTH_DIR:-$HOME/Library/Caches/machine-health}" ;;
  Linux) MH_OS=linux; MH_DIR="${MACHINE_HEALTH_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/machine-health}" ;;
  MINGW* | MSYS* | CYGWIN*) MH_OS=windows; MH_DIR="${MACHINE_HEALTH_DIR:-${LOCALAPPDATA:-$HOME/AppData/Local}/machine-health}" ;;
  *) MH_OS=unknown; MH_DIR="${MACHINE_HEALTH_DIR:-$HOME/.cache/machine-health}" ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) MH_ARCH=arm64 ;;
  x86_64 | amd64) MH_ARCH=amd64 ;;
  *) MH_ARCH=unknown ;;
esac
MH_EXE=""
[[ $MH_OS == windows ]] && MH_EXE=".exe"
MH_BIN="$MH_DIR/bin/machine-health$MH_EXE"

# mh_lock_field <key>: a top-level string value from bin.lock.json, read without jq.
mh_lock_field() { sed -n "s/^ *\"$1\": *\"\([^\"]*\)\".*/\1/p" "$MH_LOCK" | head -n 1; }
mh_lock_version() { mh_lock_field version; }
