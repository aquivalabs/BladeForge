// stakes — the title card (4 s), then Maya's cart failing without the feature (invented for the demo, footnoted).
// Local time t = t0 - T0. Three real-looking objects side by side: the cart, the checkout, the support ticket.
const T0 = 4;
const moneyRow = (label, amount, extra) => '<div class="row" style="height:40px;font-size:22px;' + (extra || '') + '"><span>' + label + '</span><span class="num" style="font-weight:600">' + amount + '</span></div>';

kit.scene('stakes', {
  init(kit) {
    const g = kit.h('<div class="ground"><div class="glow2"></div><div class="glow"></div></div>'); kit.stage.append(g);

    // Title: one line of what it does, and a stack of six layers that builds itself.
    this.ttl = kit.h('<div class="abs" style="width:1100px"><div class="label" style="font-size:26px;letter-spacing:.16em;color:var(--accent)">FEATURE BRIEFING · ACME MARKET</div><div style="font-size:132px;font-weight:800;line-height:1.05;margin-top:14px;letter-spacing:-.02em">Price stack</div><div style="font-size:44px;color:var(--soft);margin-top:22px">One total for every cart, every euro explained</div><div style="font-size:22px;color:var(--dim);margin-top:40px">An example film about a fictional product.</div></div>');
    g.append(this.ttl);
    this.layers = [];
    for (let i = 0; i < 6; i++) {
      const top = i === 5;
      const b = kit.h('<div class="abs" style="width:420px;height:58px;border-radius:14px;border:2px solid var(--line-2)"></div>');
      b.style.background = top ? 'var(--accent)' : (i % 2 ? 'var(--primary-wash)' : 'var(--card)');
      if (top) b.style.borderColor = 'var(--accent)';
      g.append(b); this.layers.push(b.style);
    }

    this.h = buildHeader(kit, g, { label: 'How it goes today', title: 'The cart and the checkout disagree' });

    // 1. The cart, as Maya sees it.
    this.cart = kit.h('<div class="abs card" style="width:520px;height:530px;padding:26px 30px"><div class="row" style="font-size:26px;font-weight:700"><span>Your cart</span><span style="font-size:20px;color:var(--dim);font-weight:600">6 items</span></div><div style="height:2px;background:var(--line);margin:14px 0 6px"></div><div class="lines"></div><div style="height:2px;background:var(--line);margin:8px 0"></div><div class="row" style="font-size:30px;font-weight:800;margin-top:6px"><span>Total</span><span class="num tot"></span></div></div>');
    const L = [['Coffee beans · Colombia', '24.99'], ['Coffee beans · Kenya', '25.54'], ['Coffee beans · Brazil', '23.90'], ['Olive oil 1 l', '12.25'], ['Laundry pods ×40', '15.80'], ['Dish soap 1 l', '5.95']];
    const lines = this.cart.querySelector('.lines');
    this.cartRows = L.map(([n, p]) => { const r = kit.h(moneyRow(n, '€' + p, 'color:var(--soft)')); lines.append(r); return r.style; });
    [['3 for 2', '−€23.90'], ['Coupon SPRING15', '−€5.10'], ['Tax', '+€4.77']].forEach(([n, p]) => { const r = kit.h(moneyRow(n, p, 'color:var(--primary-2)')); lines.append(r); this.cartRows.push(r.style); });
    this.cartTot = this.cart.querySelector('.tot');
    g.append(this.cart);

    // 2. The checkout, same cart, another total.
    this.pay = kit.h('<div class="abs card" style="width:520px;height:530px;padding:26px 30px"><div class="row" style="font-size:26px;font-weight:700"><span>Checkout</span><span style="font-size:20px;color:var(--dim);font-weight:600">step 3 of 3</span></div><div style="height:2px;background:var(--line);margin:14px 0 6px"></div><div class="lines"></div><div style="height:2px;background:var(--line);margin:8px 0"></div><div class="row" style="font-size:30px;font-weight:800;margin-top:6px"><span>Total</span><span class="num tot" style="color:var(--alert)"></span></div><div class="nw" style="margin-top:22px;height:60px;border-radius:12px;background:var(--ink);color:var(--on);font-size:24px;font-weight:700;display:flex;align-items:center;justify-content:center">Pay now</div></div>');
    const pl = this.pay.querySelector('.lines');
    this.payRows = [['6 items', '€108.43', 'color:var(--soft)'], ['3 for 2', '−€23.90', 'color:var(--primary-2)'], ['Coupon SPRING15', '−€5.10', 'color:var(--primary-2)'], ['Coupon SPRING15', '−€5.10', 'color:var(--alert);background:var(--alert-wash);border-radius:8px;padding:0 10px;margin:0 -10px'], ['Tax', '+€4.77', 'color:var(--primary-2)']]
      .map(([n, p, st]) => { const r = kit.h(moneyRow(n, p, st)); pl.append(r); return r.style; });
    this.payTot = this.pay.querySelector('.tot');
    g.append(this.pay);

    // 3. The support ticket a week later.
    this.tk = kit.h('<div class="abs card" style="width:520px;height:530px;padding:26px 30px"><div class="row" style="font-size:26px;font-weight:700"><span>Ticket #4127</span><span class="pill st" style="font-size:18px;padding:5px 14px;color:var(--on);background:var(--accent)"></span></div><div style="height:2px;background:var(--line);margin:14px 0 18px"></div><div style="display:flex;gap:14px;align-items:flex-start"><div style="flex:none;width:52px;height:52px;border-radius:50%;background:var(--accent-wash);color:var(--accent-2);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px">M</div><div><div style="font-size:19px;color:var(--dim)">Maya · Acme Plus member</div><div class="msg" style="margin-top:6px;font-size:22px;line-height:1.35;background:var(--bg1);border:2px solid var(--line);border-radius:4px 16px 16px 16px;padding:12px 16px;width:360px;box-sizing:border-box">You billed me €5.10 more. Why?</div></div></div><div class="wait row" style="margin-top:26px;font-size:21px;color:var(--soft)"><span>A week after the order</span><span class="num days" style="font-weight:700"></span></div><div class="bar" style="margin-top:10px;height:10px;border-radius:5px;background:var(--line);overflow:hidden"><div style="height:100%;width:0;background:var(--accent)"></div></div><div class="ref row" style="margin-top:30px;font-size:22px;font-weight:600;color:var(--alert)"><span>Extra charge</span><span class="num">€5.10</span></div></div>');
    this.tkStatus = this.tk.querySelector('.st'); this.tkDays = this.tk.querySelector('.days'); this.tkBar = this.tk.querySelector('.bar').firstChild.style; this.tkRef = this.tk.querySelector('.ref').style; this.tkMsg = this.tk.querySelector('.msg').parentNode.parentNode.style;
    this.stamp = kit.h('<div class="abs stamp" style="font-size:44px;color:var(--alert);background:var(--veil)">BILLED AGAIN</div>');
    this.tk.append(this.stamp);
    g.append(this.tk);

    // 4. The close: the two totals, and what it costs.
    this.neq = kit.h('<div class="abs" style="width:1920px;display:flex;justify-content:center;align-items:flex-end;gap:56px;font-weight:800"><div style="text-align:center"><div class="label" style="color:var(--dim)">CART</div><div class="num" style="font-size:150px;line-height:1.1">€84.20</div></div><div class="sym" style="font-size:150px;line-height:1.1;color:var(--alert)">≠</div><div style="text-align:center"><div class="label" style="color:var(--dim)">CHECKOUT</div><div class="num" style="font-size:150px;line-height:1.1;color:var(--alert)">€79.10</div></div></div>');
    g.append(this.neq);

    this.cap = buildCaps(kit, g);
    this.foot = buildFoot(kit, g, { note: 'The situation is invented for the example.' });
  },
  render(t0) {
    // Title, then the layers fly up and away.
    const tin = eo(seg(t0, 0.1, 0.9)), tout = eo(seg(t0, 3.4, 4.0));
    this.ttl.style.opacity = String(tin * (1 - tout)); this.ttl.style.transform = 'translate(120px,' + (330 + 20 * (1 - tin) - 40 * tout) + 'px)';
    this.layers.forEach((s, i) => {
      const p = eob(seg(t0, 0.4 + i * 0.22, 0.9 + i * 0.22), 1.4);
      s.opacity = String(Math.min(1, p) * (1 - tout));
      s.transform = 'translate(' + (1360 + (i === 5 ? 0 : 0)) + 'px,' + (780 - i * 72 - 60 * (1 - Math.min(1, p)) - 60 * tout) + 'px)';
    });

    const t = t0 - T0;
    renderHeader(this.h, t);
    const close = eo(seg(t, 17.2, 18.0));
    const dim = 1 - close;

    // Cart: enters, its lines tick in, the total counts up.
    const pc = enter(this.cart.style, t, 0.6, 120, 290, 18); this.cart.style.opacity = String(pc * dim);
    this.cartRows.forEach((s, i) => { s.opacity = String(eo(seg(t, 1.0 + i * 0.22, 1.4 + i * 0.22))); });
    const ct = lerp(0, 84.20, eo(seg(t, 1.2, 3.4))); this.cartTot.textContent = eur(ct);

    // Checkout: enters, the second coupon line drops in and shakes, the total turns red.
    const pp = enter(this.pay.style, t, 4.6, 700, 290, 18);
    const sx = shakeX(t, 7.2, 14, 0.6);
    this.pay.style.opacity = String(pp * dim); this.pay.style.transform = 'translate(' + (700 + sx) + 'px,' + (290 + 18 * (1 - pp)) + 'px)';
    this.payRows.forEach((s, i) => {
      const a = i === 3 ? 6.6 : 5.0 + i * 0.25; const k = eo(seg(t, a, a + 0.45));
      s.opacity = String(k); s.transform = i === 3 ? 'translateY(' + (-30 * (1 - k)) + 'px)' : '';
    });
    const pt = t < 7.0 ? lerp(0, 84.20, eo(seg(t, 5.2, 6.4))) : lerp(84.20, 79.10, eo(seg(t, 7.0, 8.0)));
    this.payTot.textContent = eur(pt);
    this.payTot.style.color = t < 7.0 ? 'var(--ink)' : 'var(--alert)';

    // Ticket: enters, a week counts up, the extra charge lands, the stamp lands.
    const land = 15.4;
    const pk = enter(this.tk.style, t, 10.6, 1280, 290, 18);
    const kx = shakeX(t, land + 0.15, 10, 0.5);
    this.tk.style.opacity = String(pk * dim); this.tk.style.transform = 'translate(' + (1280 + kx) + 'px,' + (290 + 18 * (1 - pk)) + 'px)';
    const day = Math.max(1, Math.min(7, 1 + Math.floor(seg(t, 11.8, 14.6) * 6.999)));
    this.tkDays.textContent = 'day ' + day; this.tkBar.width = (100 * seg(t, 11.6, 14.6)) + '%';
    const refunded = t >= land;
    this.tkStatus.textContent = refunded ? 'Closed' : 'Open'; this.tkStatus.style.background = refunded ? 'var(--dim)' : 'var(--accent)';
    this.tkRef.opacity = String(eo(seg(t, 14.8, 15.3)));
    const sp = seg(t, land - 0.25, land + 0.05);
    this.stamp.style.opacity = String(Math.min(1, sp * 2) * 0.95);
    this.stamp.style.transform = 'translate(110px,405px) rotate(-9deg) scale(' + lerp(2.4, 1, eo(sp)) + ')';

    // Close: veil over the three cards, the two totals that never matched.
    const pn = eo(seg(t, 17.6, 18.4));
    this.neq.style.opacity = String(pn); this.neq.style.transform = 'translate(0px,' + (360 + 20 * (1 - pn)) + 'px) scale(' + lerp(0.94, 1, pn) + ')';

    renderCaps(this.cap, [[1.0, 'Maya fills a cart with a bundle and the coupon SPRING15.'], [5.6, 'At checkout, the same coupon counts twice.'], [11.2, 'A week later, the shop bills her the missing €5.10.'], [17.4, 'After that, Maya stops trusting the totals.']], t, 880);
    enter(this.foot, t, 1.2, 120, 1000, 6);
  },
});
