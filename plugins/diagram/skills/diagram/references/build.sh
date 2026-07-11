#!/usr/bin/env bash
# Build a diagram from a per-diagram folder. The output diagram.html LINKS its assets from ./assets/
# (css/js/svg-pan-zoom are copied there, deterministically, each build); only the SVG is inlined
# (the JS drives it, so it must live in the DOM).
#
#   build.sh <dir>        (default dir: .)
#
# Run it FROM the skill (never copy it beside the diagram):
#   bash <skill>/references/build.sh docs/diagrams/<name>
#
# Folder layout it expects / produces (generic names — the FOLDER names the diagram):
#   <dir>/atlas.md                 the entity list (human source of truth)
#   <dir>/assets/graph.d2          the D2 graph source                          (INPUT)
#   <dir>/assets/page.html         page skeleton + Reference notes, with the <!--SVG--> marker and the
#                                  href="diagram.css" / src="svg-pan-zoom.min.js" / src="diagram.js"
#                                  markers this script rewrites to assets/…       (INPUT)
#   <dir>/assets/diagram.css       copied from the skill (deterministic)          (asset)
#   <dir>/assets/diagram.js        copied from the skill                          (asset)
#   <dir>/assets/svg-pan-zoom.min.js  copied from the skill                       (asset)
#   <dir>/assets/diagram.svg       render                                         (artifact)
#   <dir>/assets/diagram.png       rasterized render — Read/inspect it            (artifact)
#   <dir>/diagram.html             the deliverable: open this. Links ./assets/… + inlined SVG.  (OUTPUT)
set -euo pipefail
dir="${1:-.}"
here="$(cd "$(dirname "$0")" && pwd)"    # references/ — holds the shared assets

command -v d2 >/dev/null 2>&1           || { echo "ERROR: 'd2' not found → brew install d2" >&2; exit 1; }
command -v rsvg-convert >/dev/null 2>&1 || { echo "ERROR: 'rsvg-convert' not found → brew install librsvg" >&2; exit 1; }
for a in diagram-theme.css diagram.js svg-pan-zoom.min.js; do
  [ -f "$here/$a" ] || { echo "ERROR: shared asset missing: $here/$a" >&2; exit 1; }
done

cd "$dir"
[ -f assets/graph.d2 ]  || { echo "ERROR: assets/graph.d2 not found in $dir" >&2; exit 1; }
[ -f assets/page.html ] || { echo "ERROR: assets/page.html not found in $dir" >&2; exit 1; }

# copy the shared assets into ./assets (deterministic — same bytes every build)
cp "$here/diagram-theme.css"    assets/diagram.css
cp "$here/diagram.js"           assets/diagram.js
cp "$here/svg-pan-zoom.min.js"  assets/svg-pan-zoom.min.js

d2 --layout elk --dark-theme 200 assets/graph.d2 assets/diagram.svg
rsvg-convert -o assets/diagram.png assets/diagram.svg

python3 - <<'PY'
import re
svg = open("assets/diagram.svg").read()
svg = re.sub(r'^<\?xml[^>]*\?>', '', svg, count=1)
m = re.search(r'd2-svg" width="(\d+)" height="(\d+)"', svg)
w, h = m.group(1), m.group(2)
svg = svg.replace('<svg xmlns="http://www.w3.org/2000/svg"',
                  f'<svg width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg"', 1)
page = open("assets/page.html").read()
assert "<!--SVG-->" in page, "marker <!--SVG--> not found in assets/page.html"
# repoint the asset refs into ./assets/ (the page skeleton uses bare names); inline the SVG
page = page.replace('href="diagram.css"', 'href="assets/diagram.css"', 1)
page = page.replace('src="svg-pan-zoom.min.js"', 'src="assets/svg-pan-zoom.min.js"', 1)
page = page.replace('src="diagram.js"', 'src="assets/diagram.js"', 1)
page = page.replace("<!--SVG-->", svg, 1)
open("diagram.html", "w").write(page)
print(f"built diagram.html  ({w}x{h}) — links ./assets, inlined SVG")
PY
