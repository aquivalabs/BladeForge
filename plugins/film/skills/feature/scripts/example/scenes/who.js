// who — three groups who read the same total: shoppers, support agents, finance. Hub and spokes, each role
// with a small object from its day: a checkout total, a receipt line with its reason, a discount chart.
const CARD_Y = 540, CARD_W = 520, XS = [120, 700, 1280];
const roleHTML = (icon, role, sit, body) => '<div class="abs card" style="width:' + CARD_W + 'px;height:290px;padding:28px 30px"><div style="display:flex;align-items:center;gap:18px"><div style="flex:none;width:68px;height:68px;border-radius:50%;background:var(--accent-wash);color:var(--accent-2);display:flex;align-items:center;justify-content:center">' + svg(icon, 36) + '</div><div><div style="font-size:30px;font-weight:700;white-space:nowrap">' + role + '</div><div style="font-size:22px;color:var(--soft);margin-top:4px;white-space:nowrap">' + sit + '</div></div></div><div class="obj" style="margin-top:28px">' + body + '</div></div>';

kit.scene('who', {
  init(kit) {
    const g = kit.h('<div class="ground"><div class="glow2"></div><div class="glow"></div></div>'); kit.stage.append(g);
    this.h = buildHeader(kit, g, { label: 'Who uses it', title: 'Three groups read the same total' });

    this.hub = kit.h('<div class="abs pill" style="font-size:40px;padding:16px 34px;background:var(--accent);color:var(--on);box-shadow:0 14px 38px var(--shadow)"><span style="font-size:22px;font-weight:600;opacity:.85">One total</span><span class="num">€84.20</span></div>');
    this.edges = buildEdges(kit, g, XS.map((x, i) => ({ from: [960, 400], to: [x + CARD_W / 2, CARD_Y], curve: false, at: 0.9 + i * 0.15 })));
    this.dots = XS.map(() => { const d = kit.h('<div class="abs" style="width:16px;height:16px;border-radius:50%;background:var(--accent)"></div>'); g.append(d); return d.style; });
    g.append(this.hub);

    const shopper = '<div style="border:2px solid var(--line);border-radius:12px;padding:12px 18px"><div class="row" style="font-size:22px;height:38px"><span style="color:var(--soft)">Cart</span><span class="num" style="font-weight:700">€84.20</span></div><div class="row" style="font-size:22px;height:38px"><span style="color:var(--soft)">Checkout</span><span class="num" style="font-weight:700">€84.20</span></div></div>';
    const support = '<div style="border:2px dashed var(--line-2);border-radius:12px;padding:12px 18px;background:var(--paper)"><div class="row" style="font-size:22px;height:38px"><span>Coupon SPRING15</span><span class="num" style="font-weight:700">−€5.10</span></div><div style="font-size:19px;color:var(--primary-2);height:38px;line-height:38px;white-space:nowrap">why: not on bundled items</div></div>';
    const finance = '<div style="display:flex;align-items:flex-end;gap:14px;height:90px;padding:0 6px;border-bottom:2px solid var(--line-2)">' + [46, 70, 38, 82, 58, 64].map((h, i) => '<div class="bar" data-h="' + h + '" style="flex:1;border-radius:6px 6px 0 0;background:' + (i === 3 ? 'var(--accent)' : 'var(--primary-wash)') + '"></div>').join('') + '</div><div style="font-size:19px;color:var(--soft);margin-top:8px;white-space:nowrap">Discounts given, by rule</div>';
    this.cards = [
      roleHTML('person', 'Shoppers', 'see one total, cart to receipt', shopper),
      roleHTML('chat', 'Support agents', 'explain a total line by line', support),
      roleHTML('chart', 'Finance', 'audits every discount given', finance),
    ].map((html) => { const n = kit.h(html); g.append(n); return n; });
    this.bars = [...this.cards[2].querySelectorAll('.bar')];
    this.foot = buildFoot(kit, g, { note: 'Roles from the design doc; amounts from the example cart, invented.' });
  },
  render(t) {
    renderHeader(this.h, t);
    const ph = eob(seg(t, 0.4, 1.0), 1.6);
    this.hub.style.opacity = String(Math.min(1, ph * 1.5));
    const hw = 330;
    this.hub.style.transform = 'translate(' + (960 - hw / 2) + 'px,312px) scale(' + lerp(0.7, 1, ph) + ')';
    renderEdges(this.edges, t);
    this.cards.forEach((n, i) => {
      const a = 1.3 + i * 0.45, k = eo(seg(t, a, a + 0.6));
      n.style.opacity = String(k); n.style.transform = 'translate(' + XS[i] + 'px,' + (CARD_Y + 24 * (1 - k)) + 'px)';
      const o = n.querySelector('.obj').style; o.opacity = String(eo(seg(t, a + 0.5, a + 1.0)));
    });
    this.bars.forEach((b, i) => { b.style.height = (+b.dataset.h * eo(seg(t, 3.0 + i * 0.12, 3.6 + i * 0.12))) + 'px'; });
    // A pulse travels from the total down each spoke, again and again.
    this.dots.forEach((s, i) => {
      const x2 = XS[i] + CARD_W / 2, live = seg(t, 2.0 + i * 0.3, 2.4 + i * 0.3);
      const p = ((t - i * 0.33) * 0.55) % 1;
      s.opacity = String(live * Math.sin(Math.PI * p));
      s.transform = 'translate(' + (lerp(960, x2, p) - 8) + 'px,' + (lerp(400, CARD_Y, p) - 8) + 'px)';
    });
    enter(this.foot, t, 2.0, 120, 1000, 6);
  },
});
