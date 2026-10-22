// score — one short sound on each event, nothing under the captions. Times from T.<scene id>.
// The ride and the finale are written on their own clocks and play only some windows of them (the cut()
// windows in the scene files). `on(windows)` turns a time on a scene's clock into seconds from its start
// in the film, and drops a sound whose moment was cut out.
const on = (windows) => (x) => { let acc = 0; for (const [a, b] of windows) { if (x >= a && x <= b) return acc + x - a; acc += b - a; } return null; };
const JW = on([[0, 9.2], [14.7, 24.2], [29.7, 40.2], [44.7, 55], [59.7, 69.2], [74.7, 78.5], [80.5, 87]]);
const FW = on([[0, 17.6], [20.3, 25.3], [27.7, 32.5]]);
kit.score(function (S, T) {
  const st = T.stakes + 4;
  // A sound at a moment that was cut is dropped; NaN would be an event at no time.
  const at = (base, m) => (x) => { const y = m(x); return y == null ? null : base + y; };
  const J = at(T.journey, JW), F = at(T.finale, FW);
  const fx = (name, t, o) => { if (t != null) S.fx(name, t, o); };
  fx('whoosh', T.stakes + 3.6);
  fx('pop', st + 6.6); fx('thud', st + 15.4);
  fx('thud', T.what + 2.7); fx('ding', T.what + 5.0); fx('whoosh', T.what + 6.0);
  fx('pop', T.who + 0.4);
  // journey: one sound per station event, a soft whoosh for each camera glide
  [15, 30, 45, 60, 75].forEach((s) => fx('whoosh', J(s - 0.3), { gain: 0.5 }));
  fx('click', J(2.4)); fx('pop', J(4.6));
  fx('click', J(18.0)); fx('ding', J(21.6));
  fx('chime', J(35.0));
  fx('pop', J(46.6)); fx('thud', J(50.2)); fx('ding', J(52.4));
  fx('thud', J(62.0)); fx('chime', J(64.0));
  fx('ding', J(85.0));
  // finale: the stamp, the checks, the count landing, the invitation
  fx('thud', F(3.2)); fx('ding', F(4.0)); fx('chime', F(6.0));
  fx('chime', F(10.5 + 5.4));
  fx('chime', F(28.0));
});
