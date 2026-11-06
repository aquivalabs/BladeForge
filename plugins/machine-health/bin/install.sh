#!/usr/bin/env bash
# Installs or updates the machine-health binary named in bin.lock.json. These are the plugin's only
# network calls; they send no user data. The hash in bin.lock.json is the trust root: it passed review
# in the PR, so a binary that does not match it is never put in place.
#
#   install.sh                 download the pinned release binary and check its SHA-256
#   install.sh --from-source   build from the plugin's Go source (needs go), for development
set -euo pipefail
# shellcheck source=paths.sh
source "$(dirname "$0")/paths.sh"

version="$(mh_lock_version)"
target="$MH_OS-$MH_ARCH"
mkdir -p "$MH_DIR/bin"
tmp="$(mktemp "$MH_DIR/bin/.download.XXXXXX")"
trap 'rm -f "$tmp"' EXIT

if [[ "${1:-}" == "--from-source" ]]; then
  command -v go >/dev/null || { echo "machine-health: --from-source needs go on PATH" >&2; exit 1; }
  (cd "$MH_ROOT/scanner" && CGO_ENABLED=0 go build -trimpath -ldflags "-X main.version=$version" -o "$tmp" .)
else
  want="$(mh_lock_field "$target")"
  if [[ -z "$want" ]]; then
    echo "machine-health: no release binary for $target in version $version yet" >&2
    exit 1
  fi
  url="$(mh_lock_field url_base)/$(mh_lock_field release)/machine-health-$target$MH_EXE"
  curl -fsSL --proto '=https' --tlsv1.2 -o "$tmp" "$url"
  if command -v shasum >/dev/null; then got="$(shasum -a 256 "$tmp" | cut -d' ' -f1)"; else got="$(sha256sum "$tmp" | cut -d' ' -f1)"; fi
  if [[ "$got" != "$want" ]]; then
    echo "machine-health: checksum mismatch for $target; nothing was installed" >&2
    exit 1
  fi
fi

chmod +x "$tmp"
mv -f "$tmp" "$MH_BIN"
trap - EXIT
echo "machine-health $("$MH_BIN" version) installed at $MH_BIN"
echo "status line: add \"$MH_BIN\" status to your status-line script"
