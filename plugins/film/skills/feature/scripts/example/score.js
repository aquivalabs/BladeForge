// score — one short sound on each event, nothing under the captions. Times from T.<scene id>.
kit.score(function (S, T) {
  const st = T.stakes + 4, j = T.journey, f = T.finale;
  S.fx('whoosh', T.stakes + 3.6);
  S.fx('pop', st + 6.6); S.fx('thud', st + 15.4);
  S.fx('thud', T.what + 2.7); S.fx('ding', T.what + 5.0); S.fx('whoosh', T.what + 6.0);
  S.fx('pop', T.who + 0.4);
  // journey: one sound per station event, a soft whoosh for each camera glide
  [15, 30, 45, 60, 75].forEach((s) => S.fx('whoosh', j + s - 0.3, { gain: 0.5 }));
  S.fx('click', j + 2.4); S.fx('pop', j + 4.6);
  S.fx('click', j + 18.0); S.fx('ding', j + 21.6);
  S.fx('chime', j + 35.0);
  S.fx('pop', j + 46.6); S.fx('thud', j + 50.2); S.fx('ding', j + 52.4);
  S.fx('thud', j + 62.0); S.fx('chime', j + 64.0);
  S.fx('ding', j + 85.0);
  // finale: the stamp, the checks, the count landing, the invitation
  S.fx('thud', f + 3.2); S.fx('ding', f + 4.0); S.fx('chime', f + 6.0);
  S.fx('chime', f + 10.5 + 5.4);
  S.fx('chime', f + 28.0);
});
