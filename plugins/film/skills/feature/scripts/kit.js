// Shared scene vocabulary for film:feature — inlined in front of every scene module by build.mjs.
// Everything is a pure function of t: build DOM once in init(kit), position it in render(t).
const { seg, eo, eio, eob, lerp } = kit;
const ICON = {
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  menu: '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  chef: '<path d="M7 11a4 4 0 1 1 3-6.5A4 4 0 1 1 17 11v6H7z"/><path d="M7 20h10"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
  comment: '<path d="M4 5h16v11H9l-5 4z"/>',
  gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/>',
  branch: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 8v8M18 11c0 4-6 3-11 6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
  pr: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v8M18 16V9a3 3 0 0 0-3-3h-4M13 4l-2 2 2 2"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M15.5 15c2.5 0 4.5 1.5 5.5 4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
};
const svg = (name, size, col) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + (col || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICON[name] || '') + '</svg>';
const enter = (s, t, a, x, y, dy = 14) => { const p = eo(seg(t, a, a + 0.6)); s.opacity = String(p); s.transform = 'translate(' + x + 'px,' + (y + dy * (1 - p)) + 'px)'; return p; };
const buildHeader = (kit, g, H) => {
  const out = {};
  if (H.badge) { out.badge = kit.h('<div class="abs" style="font-size:22px;font-weight:600;letter-spacing:.04em;padding:8px 18px;border-radius:999px;border:1.5px solid var(--line);color:var(--primary-2)"></div>'); out.badge.textContent = H.badge; g.append(out.badge); }
  if (H.label) { out.label = kit.h('<div class="abs" style="font-size:24px;font-weight:600;letter-spacing:.14em;color:var(--primary)"></div>'); out.label.textContent = H.label.toUpperCase(); g.append(out.label); }
  if (H.title) {
    out.title = kit.h('<div class="abs" style="display:flex;align-items:center;gap:26px;width:1680px"><h2 style="margin:0;font-size:56px;font-weight:700;line-height:1.15"></h2></div>');
    out.title.firstChild.textContent = H.title;
    if (H.status) { const c = kit.h('<span style="flex:none;font-size:22px;font-weight:600;padding:6px 16px;border-radius:999px;border:2px solid currentColor"></span>'); c.textContent = H.status; c.style.color = H.tone === 'ok' ? 'var(--ok)' : (H.tone === 'partial' ? 'var(--accent)' : 'var(--dim)'); out.title.append(c); }
    g.append(out.title);
  }
  return out;
};
const renderHeader = (h, t) => {
  if (h.badge) enter(h.badge.style, t, -0.6, 120, 64, 0);
  if (h.label) enter(h.label.style, t, -0.4, 120, 132, 0);
  if (h.title) enter(h.title.style, t, -0.2, 120, 174, 10);
};
const buildEl = (kit, g, e) => {
  let n;
  if (e.type === 'actor') {
    n = kit.h('<div class="abs" style="display:flex;flex-direction:column;align-items:center;gap:12px;width:200px;color:var(--accent)"><div style="width:112px;height:112px;border-radius:50%;background:var(--accent-wash);border:2.5px solid var(--accent);display:flex;align-items:center;justify-content:center"></div><div style="font-size:24px;color:var(--soft);text-align:center"></div></div>');
    n.firstChild.innerHTML = svg(e.icon || 'person', 54); n.lastChild.textContent = e.text || '';
  } else if (e.type === 'typed') {
    n = kit.h('<div class="abs card" style="display:flex;align-items:center;padding:0 40px;font-size:44px;font-weight:600"><span></span><span style="width:3px;height:48px;background:var(--primary);margin-left:6px"></span></div>');
    n.style.width = (e.w || 1100) + 'px'; n.style.height = (e.h || 140) + 'px'; e._txt = n.firstChild; e._caret = n.lastChild.style;
  } else if (e.type === 'dot') {
    n = kit.h('<div class="abs" style="display:flex;flex-direction:column;align-items:center;gap:10px;width:160px"><div style="width:34px;height:34px;border-radius:50%;background:var(--card);border:6px solid var(--primary);box-sizing:border-box"></div><div style="font-size:20px;color:var(--primary-2);text-align:center"></div></div>');
    n.lastChild.textContent = e.text || '';
  } else if (e.type === 'cross') {
    n = kit.h('<div class="abs" style="width:62px;height:62px;border-radius:50%;background:var(--alert);display:flex;align-items:center;justify-content:center"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 6l12 12M18 6L6 18"/></svg></div>');
  } else if (e.type === 'check' || e.type === 'stop') {
    const ok = e.type === 'check';
    n = kit.h('<div class="abs" style="width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center"></div>');
    n.innerHTML = ok ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>' : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 12h12"/></svg>';
    n.style.color = 'var(--on)'; n.style.background = ok ? 'var(--primary)' : 'var(--alert)'; if (ok) { const ring = kit.h('<div style="position:absolute;inset:0;border-radius:50%;border:4px solid var(--accent)"></div>'); n.append(ring); e._ring = ring.style; }
  } else if (e.type === 'note') {
    n = kit.h('<div class="abs" style="font-size:26px;font-weight:600;padding:12px 20px;border-radius:12px;white-space:nowrap"></div>');
    n.textContent = e.text; n.style.color = 'var(--on)'; n.style.background = (e.tone === 'primary' || e.tone === 'blue') ? 'var(--primary)' : ((e.tone === 'accent' || e.tone === 'orange') ? 'var(--accent)' : 'var(--alert)');
  } else if (e.type === 'text') {
    n = kit.h('<div class="abs" style="font-size:30px;line-height:1.3"></div>'); n.textContent = e.text; if (e.w) n.style.width = e.w + 'px'; if (e.tone) n.style.color = 'var(--' + e.tone + ')'; if (e.size) n.style.fontSize = e.size + 'px'; if (e.bold) n.style.fontWeight = '700';
  } else if (e.style === 'frame') {
    n = kit.h('<div class="abs" style="border:2.5px dashed var(--line);border-radius:20px"></div>'); n.style.width = e.w + 'px'; n.style.height = e.h + 'px';
  } else {
    n = kit.h('<div class="abs card" style="display:flex;align-items:center;gap:18px;padding:0 26px"><span style="flex:none;display:flex"></span><div><div style="font-size:30px;font-weight:600;line-height:1.2"></div><div style="font-size:22px;color:var(--soft);margin-top:6px;line-height:1.25"></div></div></div>');
    n.style.width = (e.w || 420) + 'px'; n.style.height = (e.h || 110) + 'px';
    if (e.icon) n.firstChild.innerHTML = svg(e.icon, 40); else n.firstChild.innerHTML = '<span style="width:14px;height:14px;border-radius:4px;background:var(--primary)"></span>';
    n.children[1].children[0].textContent = e.text || ''; n.children[1].children[1].textContent = e.sub || '';
    if (!e.sub) n.children[1].children[1].remove();
    if (e.style === 'dashed') n.style.borderStyle = 'dashed';
    if (e.style === 'hi') n.style.borderColor = 'var(--alert)';
    if (e.style === 'ok') n.style.borderColor = 'var(--primary)';
    if (e.style === 'warn') n.style.borderColor = 'var(--accent)';
  }
  n.style.transformOrigin = '0 50%';
  g.append(n);
  return n.style;
};
const renderEl = (s, e, t) => {
  const a = e.at || 0, p = seg(t, a, a + 0.6), out = e.out ? eo(seg(t, e.out, e.out + 0.5)) : 0;
  let x = e.x, y = e.y;
  for (const m of e.move || []) { const k = eio(seg(t, m.at, m.at + (m.dur || 1.4))); x = lerp(x, m.x, k); y = lerp(y, m.y, k); }
  if (e.type === 'check' && e._ring) { const r = seg(t, a, a + 0.7); e._ring.opacity = String((1 - r) * (r > 0 ? 0.6 : 0)); e._ring.transform = 'scale(' + lerp(0.6, 2.2, eo(r)) + ')'; }
  const pop = ['check', 'stop', 'note', 'cross', 'dot'].includes(e.type);
  if (e.type === 'typed') { const n = Math.max(0, Math.min(e.text.length, Math.floor((t - a - 0.5) * (e.cps || 16)))); e._txt.textContent = e.text.slice(0, n); e._caret.opacity = (n < e.text.length || Math.floor(t / 0.53) % 2) ? '1' : '0'; }
  const sc = pop ? lerp(0.6, 1, eob(p, 1.8)) : 1;
  const base = e.style === 'muted' ? 0.55 : 1;
  s.opacity = String(eo(p) * (1 - out) * base);
  s.transform = 'translate(' + x + 'px,' + (y + (pop ? 0 : 12 * (1 - eo(p)))) + 'px) scale(' + sc + ')';
};
const buildEdges = (kit, g, edges) => {
  if (!edges || !edges.length) return [];
  const box = kit.h('<svg class="abs" width="1920" height="1080" viewBox="0 0 1920 1080" style="fill:none;stroke-width:3"></svg>');
  g.append(box);
  return edges.map((e) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const [x1, y1] = e.from, [x2, y2] = e.to;
    const d = e.curve ? 'M' + x1 + ',' + y1 + ' C' + ((x1 + x2) / 2) + ',' + y1 + ' ' + ((x1 + x2) / 2) + ',' + y2 + ' ' + x2 + ',' + y2 : 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2;
    p.setAttribute('d', d); p.setAttribute('pathLength', '1');
    p.style.stroke = e.tone === 'pink' ? 'var(--alert)' : (e.tone === 'dim' ? 'var(--dim)' : 'var(--primary)');
    if (e.dash) p.setAttribute('stroke-dasharray', '0.02 0.02');
    box.append(p);
    let lab = null;
    if (e.label) { lab = kit.h('<div class="abs" style="font-size:20px;color:var(--primary-2);text-align:center;width:180px;line-height:1.25"></div>'); lab.textContent = e.label; g.append(lab); }
    return { p, e, lab };
  });
};
const renderEdges = (E, t) => E.forEach(({ p, e, lab }) => {
  const a = e.at || 0, k = eo(seg(t, a, a + 0.8)), out = e.out ? eo(seg(t, e.out, e.out + 0.5)) : 0;
  if (!e.dash) { p.style.strokeDasharray = '1'; p.style.strokeDashoffset = String(1 - k); }
  p.style.opacity = String((e.dash ? k : 1) * (1 - out));
  if (lab) { lab.style.opacity = String(eo(seg(t, a + 0.4, a + 0.9)) * (1 - out)); const lx = (e.from[0] + e.to[0]) / 2 - 90 + (e.lx || 0), ly = (e.from[1] + e.to[1]) / 2 - 38 + (e.ly || 0); lab.style.transform = 'translate(' + lx + 'px,' + ly + 'px)'; }
});
const buildCaps = (kit, g) => { const c = kit.h('<p class="abs" style="margin:0;width:1680px;font-size:34px;line-height:1.35;color:var(--soft)"></p>'); g.append(c); return c; };
const renderCaps = (c, caps, t, y) => {
  if (!caps || !caps.length) return;
  let cur = -1; caps.forEach((x, i) => { if (t >= x[0]) cur = i; });
  if (cur < 0) { c.style.opacity = '0'; return; }
  const since = t - caps[cur][0], next = caps[cur + 1] ? caps[cur + 1][0] - t : 99;
  c.textContent = caps[cur][1];
  c.style.opacity = String(Math.min(eo(Math.min(since / 0.5, 1)), Math.min(next / 0.4, 1)));
  c.style.transform = 'translate(120px,' + (y || 820) + 'px)';
};
const buildFoot = (kit, g, F) => {
  if (!F) return null;
  const f = kit.h('<div class="abs" style="width:1680px"></div>');
  if (F.proof) { const p = kit.h('<div class="mono" style="font-size:20px;color:var(--primary-2);opacity:.8"></div>'); p.textContent = '$ ' + F.proof; f.append(p); }
  if (F.note) { const n = kit.h('<div style="font-size:20px;color:var(--dim);margin-top:6px"></div>'); n.textContent = F.note; f.append(n); }
  g.append(f); return f.style;
};

// A terminal window: dark panel, three dots, a title, and a mono body (the last child) to fill with lines.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const termHTML = (title, w, h) => '<div class="abs" style="width:' + w + 'px;height:' + h + 'px;border-radius:14px;background:var(--term-bg);box-shadow:0 14px 38px rgba(0,0,0,.22);overflow:hidden"><div style="height:36px;display:flex;align-items:center;gap:8px;padding:0 14px;background:var(--term-bar)"><i style="width:11px;height:11px;border-radius:50%;background:var(--alert)"></i><i style="width:11px;height:11px;border-radius:50%;background:var(--accent)"></i><i style="width:11px;height:11px;border-radius:50%;background:var(--primary)"></i><span style="margin-left:10px;font-size:16px;font-weight:600;color:var(--term-dim)">' + esc(title) + '</span></div><div class="mono" style="padding:14px 20px;font-size:20px;line-height:34px;color:var(--term-ink);white-space:pre"></div></div>';
