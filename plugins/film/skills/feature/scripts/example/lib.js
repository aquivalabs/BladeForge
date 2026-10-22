// Helpers shared by the example scenes; build.mjs inlines this after kit.js (film.json "helpers").
const eur = (v) => '€' + v.toFixed(2);
const K = (t, a, d) => eo(seg(t, a, a + (d || 0.5)));
const shakeX = (t, a, amp, d) => { const k = seg(t, a, a + (d || 0.5)); return k > 0 && k < 1 ? Math.sin(k * Math.PI * 7) * amp * (1 - k) : 0; };
const popS = (t, a) => lerp(0.5, 1, eob(seg(t, a, a + 0.35), 2.2));
const place = (s, x, y, o, sc) => { s.opacity = String(o); s.transform = 'translate(' + x + 'px,' + y + 'px)' + (sc != null && sc !== 1 ? ' scale(' + sc + ')' : ''); };

// A scene is written on its own clock; `cut(windows)` plays only those windows of it, one after another.
// A hold with nothing new on screen is cut out this way without moving any event inside a window.
// `dur` is the scene's length in film.json; `at(t)` turns film time into the scene's own clock.
const cut = (windows) => {
  const dur = Math.round(windows.reduce((s, [a, b]) => s + b - a, 0) * 100) / 100;
  return { dur, at(t) { let acc = 0; for (const [a, b] of windows) { if (t < acc + (b - a)) return a + (t - acc); acc += b - a; } return windows[windows.length - 1][1]; } };
};
