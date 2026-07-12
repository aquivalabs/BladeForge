/* Diagram interactions — pan/zoom via the vendored svg-pan-zoom library (SVG-native: it transforms
   an internal viewport <g>, so a large SVG stays cheap — no giant CSS layer, no blank tiles, no lag).
   Click-to-jump (both directions) is layered on top. GENERIC & reusable across diagrams.
   Requires svg-pan-zoom.min.js loaded before this file. Source of truth: keep edits here.

   Click-to-jump convention: each Reference note has id="c-<KEY>" where <KEY> is the node's id in the
   .d2 (D2 emits its SVG group as class=btoa(<KEY>)). Titles → the note; method/field rows → the
   matching <dt> (by identifier). Reverse: note heading/<dt> → focus the node (zoom+pan + glow). */
(function () {
  var vp = document.getElementById('vp');
  var svg = vp && vp.querySelector('svg');
  if (!svg) return;
  if (typeof svgPanZoom === 'undefined') { console.error('svg-pan-zoom not loaded'); return; }

  var spz = svgPanZoom(svg, {
    zoomEnabled: true, panEnabled: true, controlIconsEnabled: false,
    dblClickZoomEnabled: false, mouseWheelZoomEnabled: true,
    fit: true, center: true, contain: false,
    minZoom: 1, maxZoom: 25, zoomScaleSensitivity: 0.3
  });
  window.addEventListener('resize', function () { spz.resize(); spz.fit(); spz.center(); });

  var zin = document.getElementById('zin'), zout = document.getElementById('zout'), zfit = document.getElementById('zfit');
  if (zin) zin.onclick = function () { spz.zoomIn(); };
  if (zout) zout.onclick = function () { spz.zoomOut(); };
  if (zfit) zfit.onclick = function () { spz.reset(); };

  /* ---------- click-to-jump ---------- */
  function ident(s) { return s.replace(/^[+\-#\s]+/, '').split(/[\s(:·\/]/)[0].trim(); }
  function hot(el, ms) { if (!el) return; el.classList.add('hot'); setTimeout(function () { el.classList.remove('hot'); }, ms || 1700); }

  // diagram row/title -> Reference
  function jump(box, id) {
    var hit = id ? [].slice.call(box.querySelectorAll('dt')).filter(function (d) { return ident(d.textContent) === id; })[0] : null;
    (hit || box).scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (hit) { hot(hit); hot(hit.nextElementSibling); } else hot(box.querySelector('h3'));
  }

  // Reference heading/dt -> focus the node (zoom + pan to centre it, via svg-pan-zoom coords) + glow
  function focusNode(g, textEl) {
    (document.querySelector('figure') || vp).scrollIntoView({ behavior: 'smooth', block: 'center' });
    var b = g.getBBox();                          // node bbox in SVG user coords
    var s = spz.getSizes();
    var base = s.realZoom / spz.getZoom();        // px per user-unit at zoom=1
    var target = Math.min(s.width * 0.45 / b.width, s.height * 0.45 / b.height); // desired px per user-unit
    spz.zoom(Math.max(1, Math.min(25, target / base)));
    var s2 = spz.getSizes(), rz = s2.realZoom;
    spz.pan({ x: s2.width / 2 - (b.x + b.width / 2) * rz, y: s2.height / 2 - (b.y + b.height / 2) * rz });
    g.classList.add('node-hot'); setTimeout(function () { g.classList.remove('node-hot'); }, 1800);
    if (textEl) { textEl.classList.add('m-hot'); setTimeout(function () { textEl.classList.remove('m-hot'); }, 1800); }
  }

  [].slice.call(document.querySelectorAll('.refB[id^="c-"]')).forEach(function (box) {
    var key = box.id.slice(2), g;
    try { g = svg.querySelector('g.' + CSS.escape(btoa(key))); } catch (e) { g = null; }
    if (!g) return;
    var dtIds = {}, rows = {};
    [].slice.call(box.querySelectorAll('dt')).forEach(function (d) { dtIds[ident(d.textContent)] = 1; });
    [].slice.call(g.querySelectorAll('text.text-mono')).forEach(function (t) {
      var st = t.getAttribute('style') || '';
      if (st.indexOf('text-anchor:middle') >= 0) {          // title -> block
        t.classList.add('t-link');
        t.addEventListener('click', function (e) { e.stopPropagation(); jump(box, ''); });
      } else if (st.indexOf('text-anchor:start') >= 0) {    // method/field -> matching dt
        var id = ident(t.textContent); rows[id] = t;
        if (id && dtIds[id]) {
          t.classList.add('m-link');
          t.addEventListener('click', function (e) { e.stopPropagation(); jump(box, id); });
        }
      }
    });
    // reverse: heading focuses the node; each dt focuses the node + flashes its row
    var h = box.querySelector('h3');
    if (h) { h.classList.add('ref-link'); h.addEventListener('click', function () { focusNode(g, null); }); }
    [].slice.call(box.querySelectorAll('dt')).forEach(function (d) {
      d.classList.add('ref-link');
      d.addEventListener('click', function () { focusNode(g, rows[ident(d.textContent)] || null); });
    });
  });
})();
