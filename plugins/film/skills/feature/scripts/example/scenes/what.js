// what — the definition through an everyday analogy: a recipe has a fixed order. The "Frost" step tries to jump
// before "Bake", slides back, and the card flips into the six steps Price stack runs on every cart.
const ROW = 76;
const stepHTML = (n, text) => '<div class="abs" style="width:620px;height:62px;box-sizing:border-box;display:flex;align-items:center;gap:18px;padding:0 18px;border-radius:12px;border:2px solid var(--line);background:var(--card);font-size:28px;font-weight:600;white-space:nowrap"><span class="n" style="flex:none;width:38px;height:38px;border-radius:50%;background:var(--primary-wash);color:var(--primary-2);font-size:20px;font-weight:800;display:flex;align-items:center;justify-content:center">' + n + '</span><span style="flex:1">' + text + '</span><span class="mk" style="flex:none;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--on);font-size:22px;font-weight:800"></span></div>';

// The hold after the recipe card settles is cut.
const CUT_WHAT = cut([[0, 10.4]]);

kit.scene('what', {
  init(kit) {
    const g = kit.h('<div class="ground"><div class="glow2"></div><div class="glow"></div></div>'); kit.stage.append(g);
    this.h = buildHeader(kit, g, { label: 'What it is', title: 'A fixed order, like a recipe' });

    // The recipe card: paper, a red margin line, a title, the steps.
    this.card = kit.h('<div class="abs card" style="width:700px;height:620px;background:var(--paper);transform-origin:50% 50%"><div style="position:absolute;left:0;right:0;top:92px;height:2px;background:var(--accent-soft)"></div><div class="ta" style="position:absolute;left:40px;top:28px;font-size:20px;font-weight:700;letter-spacing:.14em;color:var(--accent-2)">RECIPE · SPONGE CAKE</div><div class="tb" style="position:absolute;left:40px;top:28px;font-size:20px;font-weight:700;letter-spacing:.14em;color:var(--accent-2)">RECIPE · EVERY CART</div></div>');
    g.append(this.card);
    this.ta = this.card.querySelector('.ta').style; this.tb = this.card.querySelector('.tb').style;
    this.cake = ['Mix the batter', 'Bake for 30 minutes', 'Frost'].map((x, i) => { const n = kit.h(stepHTML(i + 1, x)); this.card.append(n); return n; });
    this.price = ['Regional price list', 'Resident benefit', 'Acme Plus member prices', 'Bundles', 'One coupon', 'Regional tax, last'].map((x, i) => { const n = kit.h(stepHTML(i + 1, x)); this.card.append(n); return n; });
    this.price[5].style.borderColor = 'var(--accent)';

    // The cake, drawn: raw batter (dashed) until it is baked, then the frosting may land.
    this.art = kit.h('<svg class="abs" width="640" height="460" viewBox="0 0 640 460" style="overflow:visible"><ellipse cx="320" cy="380" rx="250" ry="26" style="fill:var(--line)"/><rect class="sp" x="140" y="210" width="360" height="160" rx="18" style="stroke-width:4"/><g class="fr"><path d="M128 214 C128 180 512 180 512 214 L512 236 C496 236 492 270 474 270 C456 270 456 236 440 236 L360 236 C344 236 342 284 322 284 C302 284 300 236 284 236 L208 236 C192 236 190 262 172 262 C154 262 150 236 128 236 Z" style="stroke-width:4"/></g><text class="lb" x="320" y="440" text-anchor="middle" style="font-size:24px;font-weight:600"></text></svg>');
    g.append(this.art);
    this.sp = this.art.querySelector('.sp'); this.fr = this.art.querySelector('.fr'); this.frp = this.fr.firstChild; this.lb = this.art.querySelector('.lb');

    // The definition, once the card has flipped.
    this.def = kit.h('<div class="abs" style="width:800px;font-size:54px;font-weight:700;line-height:1.22">Price stack prices every cart in the <span style="color:var(--accent)">same six steps</span>, always in the same order.</div>');
    g.append(this.def);
    this.cap = buildCaps(kit, g);
    this.foot = buildFoot(kit, g, { note: 'From the design doc.' });
  },
  render(tFilm) {
    const t = CUT_WHAT.at(tFilm);
    renderHeader(this.h, t);
    const FLIP = 6.0;
    // Card enters, then flips around its vertical axis at FLIP.
    const pin = eo(seg(t, 0.2, 0.8));
    const f1 = seg(t, FLIP, FLIP + 0.3), f2 = seg(t, FLIP + 0.3, FLIP + 0.6);
    const sx = t < FLIP + 0.3 ? 1 - eio(f1) : eio(f2);
    const sideB = t >= FLIP + 0.3;
    this.card.style.opacity = String(pin);
    this.card.style.transform = 'translate(160px,' + (280 + 20 * (1 - pin)) + 'px) scaleX(' + Math.max(0.001, sx) + ')';
    this.ta.opacity = sideB ? '0' : '1'; this.tb.opacity = sideB ? '1' : '0';

    // Side A: the cake. "Frost" jumps up into slot 2, is refused, slides back; then Bake and Frost are checked.
    const up = eio(seg(t, 2.0, 2.6)), back = eio(seg(t, 3.3, 3.9));
    const jump = up * (1 - back);
    this.cake.forEach((n, i) => {
      const a = 0.8 + i * 0.25, k = eo(seg(t, a, a + 0.4));
      let y = 128 + i * ROW, x = 40;
      if (i === 2) { y -= jump * ROW; x += 40 * jump + shakeX(t, 2.7, 12, 0.5); }
      if (i === 1) { y += jump * ROW; }
      n.style.opacity = String(sideB ? 0 : k);
      n.style.transform = 'translate(' + x + 'px,' + (y + 10 * (1 - k)) + 'px)';
      n.style.zIndex = i === 2 ? '2' : '1';
      const refused = i === 2 && t >= 2.6 && t < 3.9;
      n.style.borderColor = refused ? 'var(--alert)' : (i === 2 && jump > 0 ? 'var(--accent)' : 'var(--line)');
      n.style.boxShadow = i === 2 && jump > 0.05 ? '0 12px 28px var(--shadow)' : 'none';
      const mk = n.querySelector('.mk');
      const doneAt = [1.4, 4.2, 5.0][i];
      if (refused) { mk.textContent = '×'; mk.style.background = 'var(--alert)'; mk.style.opacity = '1'; mk.style.transform = 'scale(' + lerp(0.5, 1, eob(seg(t, 2.6, 2.9))) + ')'; }
      else if (t >= doneAt) { mk.textContent = '✓'; mk.style.background = 'var(--ok)'; mk.style.opacity = '1'; mk.style.transform = 'scale(' + lerp(0.5, 1, eob(seg(t, doneAt, doneAt + 0.3))) + ')'; }
      else { mk.style.opacity = '0'; }
    });

    // Side B: the six price steps tick in one by one.
    this.price.forEach((n, i) => {
      const a = FLIP + 0.7 + i * 0.32, k = eo(seg(t, a, a + 0.4));
      n.style.opacity = String(sideB ? k : 0);
      n.style.transform = 'translate(40px,' + (128 + i * ROW + 10 * (1 - k)) + 'px)';
      const mk = n.querySelector('.mk'); mk.style.opacity = '0';
    });

    // The cake drawing, only on side A.
    const artOn = eo(seg(t, 0.6, 1.2)) * (1 - eo(seg(t, FLIP - 0.4, FLIP)));
    this.art.style.opacity = String(artOn); this.art.style.transform = 'translate(1040px,' + 300 + 'px)';
    const baked = eo(seg(t, 4.2, 4.8));
    this.sp.style.fill = baked > 0 ? 'var(--accent-soft)' : 'none';
    this.sp.style.fillOpacity = String(baked);
    this.sp.style.stroke = baked > 0.5 ? 'var(--accent-2)' : 'var(--dim)';
    this.sp.setAttribute('stroke-dasharray', baked > 0.5 ? '' : '14 10');
    this.sp.setAttribute('y', String(lerp(250, 210, baked))); this.sp.setAttribute('height', String(lerp(120, 160, baked)));
    // Frosting: falls at 2.3 onto raw batter, slides off at 2.7; falls again at 5.0 and stays.
    let fy = -260, fr = 0, fo = 0, bad = false;
    if (t >= 2.1 && t < 3.6) { const d = eo(seg(t, 2.1, 2.6)), off = seg(t, 2.8, 3.5); fy = lerp(-260, 40, d) + 220 * off * off; fr = 26 * eo(off); fo = 1 - off; bad = true; }
    else if (t >= 4.9) { const d = eob(seg(t, 4.9, 5.4), 1.2); fy = lerp(-260, 0, d); fo = Math.min(1, seg(t, 4.9, 5.1) * 3); }
    this.fr.setAttribute('transform', 'translate(0,' + fy + ') rotate(' + fr + ' 320 230)');
    this.fr.style.opacity = String(fo);
    this.frp.style.fill = bad ? 'var(--alert-wash)' : 'var(--card)';
    this.frp.style.stroke = bad ? 'var(--alert)' : 'var(--primary)';
    this.lb.textContent = t < 4.2 ? 'raw batter' : 'baked';
    this.lb.style.fill = t >= 2.6 && t < 3.9 ? 'var(--alert)' : 'var(--soft)';

    const pd = eo(seg(t, FLIP + 1.0, FLIP + 1.7));
    this.def.style.opacity = String(pd); this.def.style.transform = 'translate(1000px,' + (400 + 16 * (1 - pd)) + 'px)';

    renderCaps(this.cap, [[1.0, 'Like a recipe: no frosting before baking.'], [FLIP - 0.3, '']], t, 940);
    enter(this.foot, t, 7.0, 120, 1000, 6);
  },
});
