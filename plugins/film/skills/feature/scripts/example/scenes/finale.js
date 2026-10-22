// finale — chapters 6 and 7 in three beats: (1) the same cart without and with the feature, (2) the proof typed in
// a terminal with a counting number and its "not proven yet" line, (3) three problems, two topics, the invitation.
const B2 = 10.5, B3 = 21.0;
// The holds after the proof and after the topics are cut; the invitation still holds at the end.
const CUT_FINALE = cut([[0, 17.6], [20.3, 25.3], [27.7, 32.5]]);
const beat = (t, a, b) => K(t, a, 0.5) * (b == null ? 1 : 1 - K(t, b - 0.5, 0.5));
const line = (label, value, cls, extra) => '<div class="row ' + (cls || '') + '" style="height:76px;padding:0 30px;border-bottom:1px solid var(--line);font-size:28px;' + (extra || '') + '"><span>' + label + '</span><span style="display:flex;align-items:center;gap:16px"><span class="num" style="font-weight:800">' + value + '</span><span class="mk" style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--on);font-weight:800;font-size:24px"></span></span></div>';
const OUT = [['price-list', 18], ['resident', 12], ['membership', 21], ['bundle', 26], ['coupon', 34], ['tax', 17]];
const TOTAL = OUT.reduce((s, [, c]) => s + c, 0);

kit.scene('finale', {
  init(kit) {
    const g = kit.h('<div class="ground"><div class="glow2"></div><div class="glow"></div></div>'); kit.stage.append(g);
    const add = (html, parent) => { const n = kit.h(html); (parent || g).append(n); return n; };
    const hdr = (label, title) => add('<div class="abs" style="width:1680px"><div class="label">' + label + '</div><h2 style="margin:10px 0 0;font-size:56px;font-weight:700;line-height:1.15">' + title + '</h2></div>');
    const foot = (text) => add('<div class="abs" style="width:1680px;font-size:20px;color:var(--dim)">' + text + '</div>');

    // Beat 1: both outcomes side by side.
    this.h1 = hdr('WHAT CHANGES', 'The same cart, before and after');
    this.L = add('<div class="abs card" style="width:820px;height:440px;overflow:hidden"><div class="row" style="height:84px;padding:0 30px;background:var(--alert-wash)"><span style="font-size:28px;font-weight:700">Without Price stack</span><span class="pill" style="font-size:18px;padding:6px 14px;background:var(--alert);color:var(--on)">today</span></div>' + line('Cart', '€84.20') + line('Checkout', '€79.10', 'bad', 'color:var(--alert)') + line('A week later', 'extra charge') + '</div>');
    this.Lst = add('<div class="abs stamp" style="font-size:40px;color:var(--alert);background:var(--veil)">TWO TOTALS</div>', this.L).style;
    this.R = add('<div class="abs card" style="width:820px;height:440px;overflow:hidden;border-color:var(--accent)"><div class="row" style="height:84px;padding:0 30px;background:var(--accent-wash)"><span style="font-size:28px;font-weight:700">With Price stack</span><span class="pill" style="font-size:18px;padding:6px 14px;background:var(--accent);color:var(--on)">this feature</span></div>' + line('Cart', '€84.20') + line('Checkout', '€84.20') + line('Receipt', '€84.20') + '<div class="row wy" style="height:76px;padding:0 30px;font-size:24px;color:var(--primary-2)"><span>every euro with a line saying why</span><span></span></div></div>');
    this.Rmk = [...this.R.querySelectorAll('.mk')].map((n) => n.style); this.Lmk = [...this.L.querySelectorAll('.mk')]; this.Rwy = this.R.querySelector('.wy').style;
    this.Rring = add('<div class="abs" style="width:820px;height:440px;border-radius:16px;border:5px solid var(--accent);box-sizing:border-box"></div>').style;
    this.f1 = foot('The situation is invented for the example.');

    // Beat 2: the proof, typed.
    this.h2 = hdr('WHAT ALREADY WORKS', 'Each rule has its own test file');
    this.term = add(termHTML('price-stack · zsh', 1000, 340));
    this.tbody = this.term.lastChild;
    this.big = add('<div class="abs" style="width:600px"><div class="num" style="font-size:180px;font-weight:800;line-height:1;color:var(--accent)">0</div><div style="font-size:34px;font-weight:700;margin-top:8px">test cases counted</div><div style="font-size:24px;color:var(--soft);margin-top:6px">in six test files, one per rule</div><div class="np" style="margin-top:40px;padding:18px 24px;border-radius:14px;background:var(--accent-wash);border:2px solid var(--accent-soft);font-size:22px;line-height:1.35;white-space:nowrap"><b>Not proven yet:</b> the cases were counted, not run.</div></div>');
    this.bigN = this.big.firstChild; this.np = this.big.querySelector('.np').style;
    this.bring = add('<div class="abs" style="width:220px;height:220px;border-radius:50%;border:6px solid var(--accent);box-sizing:border-box"></div>').style;
    this.f2 = foot('Example output; the count is invented. Counted in the test files, not run for this film.');

    // Beat 3: problems, topics, invitation.
    this.h3 = hdr('WHAT IS STILL OPEN', 'Three known problems, two topics to decide');
    this.probs = [['Coupon and bundle on one item', 'A rule was chosen; product has not signed it off.'], ['A membership that lapses during checkout', ''], ['Tax for delivery to another region', '']].map(([a, b]) => add('<div class="abs card" style="width:900px;height:112px;display:flex;align-items:center;gap:22px;padding:0 28px"><div style="flex:none;width:52px;height:52px;border-radius:50%;background:var(--alert-wash);color:var(--alert);display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800">!</div><div><div style="font-size:28px;font-weight:700;white-space:nowrap">' + a + '</div>' + (b ? '<div style="font-size:21px;color:var(--soft);margin-top:4px;white-space:nowrap">' + b + '</div>' : '') + '</div></div>'));
    this.tlab = add('<div class="abs label" style="font-size:20px;color:var(--primary-2)">TOPICS TO DECIDE</div>');
    this.topics = ['Resident benefit with member prices: stack or not', 'The breakdown: for shoppers, or only for support'].map((x) => add('<div class="abs pill" style="font-size:23px;font-weight:600;padding:16px 24px;background:var(--primary-wash);color:var(--primary-2);border:2px solid var(--primary)">' + x + '</div>'));
    this.inv = add('<div class="abs" style="width:1680px;display:flex;align-items:center;gap:26px"><div style="flex:none;width:84px;height:84px;border-radius:50%;background:var(--accent);color:var(--on);display:flex;align-items:center;justify-content:center">' + svg('comment', 44) + '</div><div style="font-size:50px;font-weight:800;line-height:1.15">Send ideas, questions and decisions to the <span style="color:var(--accent-2)">feature’s author.</span></div></div>');
    this.f3 = foot('From the design doc’s open questions.');
    this.cap = buildCaps(kit, g);
  },
  render(tFilm) {
    const t = CUT_FINALE.at(tFilm);
    // ---------- Beat 1 ----------
    const o1 = beat(t, 0, B2);
    place(this.h1.style, 120, 64 + 10 * (1 - K(t, 0, 0.6)), o1);
    const pl = K(t, 0.4, 0.6), pr = K(t, 1.0, 0.6);
    place(this.L.style, 120 + shakeX(t, 2.6, 12, 0.5), 250 + 20 * (1 - pl), pl * o1);
    place(this.R.style, 980, 250 + 20 * (1 - pr), pr * o1);
    this.Lmk.forEach((m, i) => { const bad = i > 0; m.textContent = bad ? '×' : ''; m.style.background = bad ? 'var(--alert)' : 'transparent'; m.style.opacity = String(bad ? (t >= 2.4 + (i - 1) * 0.4 ? 1 : 0) : 0); m.style.transform = 'scale(' + popS(t, 2.4 + (i - 1) * 0.4) + ')'; });
    const sp = seg(t, 3.2, 3.5);
    this.Lst.opacity = String(t >= 3.2 ? Math.min(1, sp * 3) * 0.95 : 0); this.Lst.transform = 'translate(420px,330px) rotate(-8deg) scale(' + lerp(2.2, 1, eo(sp)) + ')';
    this.Rmk.forEach((m, i) => { const a = 4.0 + i * 0.6; m.background = 'var(--ok)'; m.opacity = String(t >= a ? 1 : 0); m.transform = 'scale(' + popS(t, a) + ')'; });
    this.Rmk.forEach((m) => { m.display = 'flex'; });
    this.R.querySelectorAll('.mk').forEach((n) => { n.textContent = '✓'; });
    this.Rwy.opacity = String(K(t, 6.0, 0.4));
    const rr = seg(t, 6.0, 6.8);
    place(this.Rring, 980, 250, rr > 0 && rr < 1 ? 0.9 * (1 - rr) * o1 : 0, 1); this.Rring.transform += ' scale(' + lerp(1, 1.04, eo(rr)) + ')'; this.Rring.transformOrigin = '50% 50%';
    place(this.f1.style, 120, 1000, K(t, 0.8, 0.5) * o1);

    // ---------- Beat 2 ----------
    const t2 = t - B2, o2 = beat(t, B2, B3);
    place(this.h2.style, 120, 64 + 10 * (1 - K(t2, 0, 0.6)), o2);
    place(this.term.style, 120, 330 + 20 * (1 - K(t2, 0.3, 0.6)), K(t2, 0.3, 0.6) * o2);
    const cmd = 'grep -c "it(" tests/price-stack/*.test.ts';
    const n = Math.max(0, Math.min(cmd.length, Math.floor((t2 - 0.9) * 26)));
    let txt = '$ ' + cmd.slice(0, n) + (n < cmd.length || t2 < 3.0 ? (Math.floor(t2 / 0.5) % 2 ? '█' : ' ') : '');
    const done = 0.9 + cmd.length / 26 + 0.3;
    OUT.forEach(([f, c], i) => { if (t2 >= done + i * 0.32) txt += '\ntests/price-stack/' + f + '.test.ts:' + c; });
    this.tbody.textContent = txt;
    const lastLine = done + 5 * 0.32;
    const sum = OUT.reduce((s, [, c], i) => s + (t2 >= done + i * 0.32 ? c : 0), 0);
    const shown = Math.round(lerp(0, TOTAL, eio(seg(t2, done, lastLine + 0.6))));
    this.bigN.textContent = String(Math.min(sum, Math.max(shown, 0)));
    place(this.big.style, 1180, 310 + 20 * (1 - K(t2, done, 0.6)), K(t2, done, 0.6) * o2);
    const land = lastLine + 0.6, br = seg(t2, land, land + 0.8);
    place(this.bring, 1180 + 140 - 110, 310 + 90 - 110, br > 0 && br < 1 ? 0.8 * (1 - br) * o2 : 0, lerp(1, 1.6, eo(br)));
    this.bring.transformOrigin = '50% 50%';
    this.np.opacity = String(K(t2, land + 1.0, 0.5)); this.np.transform = 'translateY(' + (12 * (1 - K(t2, land + 1.0, 0.5))) + 'px)';
    place(this.f2.style, 120, 1000, K(t2, 0.8, 0.5) * o2);

    // ---------- Beat 3 ----------
    const t3 = t - B3, o3 = K(t3, 0, 0.5);
    place(this.h3.style, 120, 64 + 10 * (1 - K(t3, 0, 0.6)), o3);
    const focus = 1 - 0.25 * K(t3, 7.0, 0.6);
    this.probs.forEach((p, i) => { const k = K(t3, 0.6 + i * 0.5, 0.5); place(p.style, 120 + 30 * (1 - k), 250 + i * 132, k * focus); });
    place(this.tlab.style, 1100, 256, K(t3, 2.6, 0.5) * focus);
    this.topics.forEach((p, i) => { const a = 3.0 + i * 0.6, k = eob(seg(t3, a, a + 0.4), 1.6); place(p.style, 1100, 300 + i * 96, Math.min(1, k * 1.5) * focus, lerp(0.8, 1, Math.min(1, k))); p.style.transformOrigin = '0 50%'; });
    const ki = K(t3, 7.0, 0.7);
    place(this.inv.style, 120, 720 + 24 * (1 - ki), ki);
    place(this.f3.style, 120, 1000, K(t3, 1.0, 0.5) * o3);

    renderCaps(this.cap, [[6.4, 'One total everywhere, every euro explained.'], [B2 - 0.6, '']], t, 860);
  },
});
