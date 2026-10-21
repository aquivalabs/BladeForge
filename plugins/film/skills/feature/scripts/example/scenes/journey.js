// journey — one camera ride over six stations. A world element is translated between stations; the step rail,
// the counter "rules applied N/6" and the running total stay fixed on top. Each station: one object, one event.
// Every amount is invented for the example and adds up: 116.13 -> 115.63 -> 108.43 -> 84.53 -> 79.43 -> 84.20.
const STARTS = [0, 15, 30, 45, 60, 75];
const W = 1920;
const eur = (v) => '€' + v.toFixed(2);
const K = (t, a, d) => eo(seg(t, a, a + (d || 0.5)));
const shakeX = (t, a, amp, d) => { const k = seg(t, a, a + (d || 0.5)); return k > 0 && k < 1 ? Math.sin(k * Math.PI * 7) * amp * (1 - k) : 0; };
const popS = (t, a) => lerp(0.5, 1, eob(seg(t, a, a + 0.35), 2.2));
const place = (s, x, y, o, sc) => { s.opacity = String(o); s.transform = 'translate(' + x + 'px,' + y + 'px)' + (sc != null && sc !== 1 ? ' scale(' + sc + ')' : ''); };
// The running total and the rule counter, as keyframes on the film clock: [at, value, seconds].
const TOTAL = [[3.2, 116.13, 0.8], [21.0, 115.63, 0.8], [32.8, 114.98, 0.6], [35.4, 108.43, 1.6], [46.6, 84.53, 0.8], [52.6, 79.43, 0.8], [63.6, 84.20, 1.0]];
const RULES = [21.6, 33.0, 36.8, 47.0, 53.0, 64.0];
const totalAt = (t) => { let v = 90.23; for (const [a, x, d] of TOTAL) { if (t >= a) v = lerp(v, x, eio(seg(t, a, a + d))); } return v; };
const rulesAt = (t) => RULES.filter((a) => t >= a).length;
const bag = (w) => '<svg width="' + w + '" height="' + Math.round(w * 1.15) + '" viewBox="0 0 100 115"><path d="M18 14 L82 14 L90 108 L10 108 Z" style="fill:var(--accent-wash);stroke:var(--accent-2);stroke-width:3;stroke-linejoin:round"/><path d="M18 14 L30 4 L70 4 L82 14" style="fill:var(--accent-soft);stroke:var(--accent-2);stroke-width:3;stroke-linejoin:round"/><rect x="26" y="46" width="48" height="30" rx="5" style="fill:var(--card);stroke:var(--accent-2);stroke-width:2.5"/><path d="M40 61 C44 53 56 53 60 61 C56 69 44 69 40 61 Z M50 55 L50 67" style="fill:none;stroke:var(--accent-2);stroke-width:2.5"/></svg>';
const card = (w, h, inner, extra) => '<div class="abs card" style="width:' + w + 'px;height:' + h + 'px;' + (extra || '') + '">' + inner + '</div>';
const head = (title, chip) => '<div class="row" style="height:80px;padding:0 30px;border-bottom:2px solid var(--line)"><span style="font-size:28px;font-weight:700">' + title + '</span>' + (chip || '') + '</div>';
const ITEMS = ['Coffee beans · Colombia', 'Coffee beans · Kenya', 'Coffee beans · Brazil', 'Olive oil 1 l', 'Laundry pods ×40', 'Dish soap 1 l'];

kit.scene('journey', {
  init(kit) {
    const stage = kit.stage;
    const g = kit.h('<div class="ground"><div class="glow2"></div><div class="glow"></div></div>'); stage.append(g);
    const world = kit.h('<div class="abs" style="width:' + (W * 6) + 'px;height:1080px"></div>'); g.append(world); this.world = world.style;
    const el = (html, x0) => { const n = kit.h(html); world.append(n); n._x0 = x0 || 0; return n; };
    const inner = (n, sel) => n.querySelector(sel);

    // The road under all six stations, with a marker at each.
    el('<div class="abs" style="width:' + (W * 6) + 'px;height:0;border-top:4px dashed var(--line-2);transform:translate(0px,872px)"></div>');
    for (let i = 0; i < 6; i++) el('<div class="abs" style="width:22px;height:22px;border-radius:50%;background:var(--card);border:4px solid var(--primary);box-sizing:border-box;transform:translate(' + (i * W + 949) + 'px,863px)"></div>');

    // ---------- Station 1: the cart. Maya adds the third coffee; the 3-for-2 badge snaps on. ----------
    const s1 = this.s1 = {};
    s1.tile = el(card(460, 560, '<div style="height:300px;display:flex;align-items:center;justify-content:center;background:var(--bg1);border-radius:14px 14px 0 0">' + bag(190) + '</div><div style="padding:22px 28px"><div style="font-size:26px;font-weight:700;white-space:nowrap">Coffee beans · Brazil</div><div style="font-size:20px;color:var(--soft);margin-top:4px">1 kg, whole beans</div><div class="row" style="margin-top:18px"><span class="num" style="font-size:30px;font-weight:800">€25.90</span><span class="btn nw" style="font-size:22px;font-weight:700;padding:12px 22px;border-radius:12px;background:var(--ink);color:var(--on)">Add to cart</span></div></div>'));
    s1.btn = inner(s1.tile, '.btn');
    s1.cart = el(card(1040, 600, head('Your cart', '<span class="pill" style="font-size:19px;padding:6px 14px;color:var(--soft);border:2px solid var(--line-2)">Price list: Standard</span>') + '<div class="rows" style="position:relative;height:420px"></div><div class="row" style="position:absolute;left:30px;right:30px;bottom:24px;font-size:30px;font-weight:800"><span>Subtotal</span><span class="num sub"></span></div>'));
    s1.sub = inner(s1.cart, '.sub');
    const rows1 = inner(s1.cart, '.rows');
    const P1 = ['26.99', '27.49', '25.90', '13.90', '15.90', '5.95'];
    s1.rows = ITEMS.map((n, i) => { const r = kit.h('<div class="abs row" style="width:980px;height:64px;padding:0 0 0 30px;box-sizing:border-box;font-size:26px;border-bottom:1px solid var(--line)"><span style="flex:1">' + n + '</span><span class="bd" style="width:130px"></span><span style="width:60px;color:var(--dim);text-align:right">×1</span><span class="num" style="width:130px;text-align:right;font-weight:600">€' + P1[i] + '</span></div>'); rows1.append(r); return r; });
    s1.badges = s1.rows.slice(0, 3).map((r) => { const b = kit.h('<span class="pill" style="font-size:18px;padding:5px 12px;background:var(--accent);color:var(--on)">3 for 2</span>'); inner(r, '.bd').append(b); return b.style; });
    s1.brace = kit.h('<div class="abs" style="width:6px;height:180px;border-radius:3px;background:var(--accent)"></div>'); rows1.append(s1.brace);
    s1.fly = el('<div class="abs pill" style="font-size:22px;padding:10px 18px;background:var(--card);border:2px solid var(--accent);box-shadow:0 10px 24px var(--shadow)">+ Coffee beans · Brazil</div>');

    // ---------- Station 2: the region. The price list switches to Northshire; two prices change. ----------
    const s2 = this.s2 = {}, X2 = W;
    s2.region = el(card(560, 330, '<div style="padding:30px"><div style="display:flex;align-items:center;gap:16px"><div style="width:60px;height:60px;border-radius:50%;background:var(--accent-wash);display:flex;align-items:center;justify-content:center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke-width="2" style="stroke:var(--accent-2)"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg></div><div><div style="font-size:28px;font-weight:700">Delivery region</div><div style="font-size:21px;color:var(--soft);margin-top:4px">Maya lives in Northshire</div></div></div><div style="position:relative;margin-top:44px;width:500px;height:72px;border-radius:16px;background:var(--bg1);border:2px solid var(--line)"><div class="knob abs" style="width:246px;height:60px;border-radius:12px;background:var(--accent);top:4px;left:4px"></div><div class="abs" style="width:250px;height:72px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700"><span class="a">Standard</span></div><div class="abs" style="left:250px;width:250px;height:72px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700"><span class="b">Northshire</span></div></div><div class="hint" style="margin-top:34px;font-size:21px;color:var(--soft);white-space:nowrap">Rule 1 · regional price list</div></div>'), X2);
    s2.knob = inner(s2.region, '.knob').style; s2.a = inner(s2.region, '.a').style; s2.b = inner(s2.region, '.b').style;
    s2.list = el(card(960, 600, head('Price list', '<span class="pill ch" style="font-size:19px;padding:6px 14px;border:2px solid var(--line-2)"></span>') + '<div class="row" style="height:56px;padding:0 30px;font-size:19px;font-weight:700;letter-spacing:.08em;color:var(--dim)"><span style="flex:1">ITEM</span><span style="width:170px;text-align:right">STANDARD</span><span style="width:190px;text-align:right">NORTHSHIRE</span><span style="width:120px;text-align:right">CHANGE</span></div><div class="rows"></div><div class="row" style="position:absolute;left:30px;right:30px;bottom:24px;font-size:30px;font-weight:800"><span>Cart total</span><span class="num tot"></span></div>'), X2);
    s2.chip = inner(s2.list, '.ch'); s2.tot = inner(s2.list, '.tot');
    const N2 = ['26.99', '27.49', '25.90', '12.90', '16.40', '5.95'], D2 = ['', '', '', '−€1.00', '+€0.50', ''];
    s2.rows = ITEMS.map((n, i) => { const r = kit.h('<div class="row" style="height:58px;padding:0 30px;margin:0 10px;border-radius:10px;font-size:25px"><span style="flex:1">' + n + '</span><span class="num st" style="width:170px;text-align:right;color:var(--soft)">€' + P1[i] + '</span><span class="num nv" style="width:190px;text-align:right;font-weight:700">€' + N2[i] + '</span><span class="num dv" style="width:120px;text-align:right;font-weight:700">' + (D2[i] || '—') + '</span></div>'); inner(s2.list, '.rows').append(r); return r; });

    // ---------- Station 3: resident and membership. The subscription is checked; member prices drop in. ----------
    const s3 = this.s3 = {}, X3 = W * 2;
    s3.res = el(card(560, 150, '<div style="display:flex;align-items:center;gap:18px;padding:28px 30px"><div style="width:64px;height:64px;border-radius:16px;background:var(--primary-wash);display:flex;align-items:center;justify-content:center"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke-width="2" style="stroke:var(--primary-2)"><path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/></svg></div><div style="flex:1"><div style="font-size:27px;font-weight:700;white-space:nowrap">Northshire resident</div><div style="font-size:20px;color:var(--soft);margin-top:4px;white-space:nowrap">Resident benefit on local produce</div></div><div class="ok" style="width:50px;height:50px;border-radius:50%;background:var(--ok);color:var(--on);font-size:28px;font-weight:800;display:flex;align-items:center;justify-content:center">✓</div></div>'), X3);
    s3.resOk = inner(s3.res, '.ok').style;
    s3.mem = el('<div class="abs" style="width:560px;height:340px;border-radius:22px;background:linear-gradient(135deg, var(--primary-2), var(--primary));color:var(--on);box-shadow:0 18px 40px var(--shadow);overflow:hidden"><div style="position:absolute;right:-80px;top:-80px;width:280px;height:280px;border-radius:50%;background:var(--on);opacity:.08"></div><div style="position:absolute;left:36px;top:32px;font-size:34px;font-weight:800;letter-spacing:.06em">ACME <span style="color:var(--accent-soft)">PLUS</span></div><div style="position:absolute;left:36px;top:104px;width:64px;height:48px;border-radius:9px;background:var(--accent-soft);opacity:.9"></div><div style="position:absolute;left:36px;top:178px;font-size:26px;font-weight:600;letter-spacing:.12em">MAYA</div><div class="stat" style="position:absolute;left:24px;right:24px;bottom:24px;height:64px;border-radius:14px;background:var(--veil);color:var(--ink);display:flex;align-items:center;gap:14px;padding:0 18px;font-size:24px;font-weight:700;white-space:nowrap"><span class="spin" style="flex:none;width:28px;height:28px;border-radius:50%;border:4px solid var(--line-2);border-top-color:var(--primary);box-sizing:border-box"></span><span class="tick" style="flex:none;width:34px;height:34px;border-radius:50%;background:var(--ok);color:var(--on);display:flex;align-items:center;justify-content:center;font-size:22px">✓</span><span class="msg"></span></div></div>', X3);
    s3.spin = inner(s3.mem, '.spin').style; s3.tick = inner(s3.mem, '.tick').style; s3.msg = inner(s3.mem, '.msg');
    s3.ring = el('<div class="abs" style="width:560px;height:340px;border-radius:22px;border:5px solid var(--accent);box-sizing:border-box"></div>', X3).style;
    s3.list = el(card(960, 600, head('Prices for Maya', '<span class="pill" style="font-size:19px;padding:6px 14px;color:var(--soft);border:2px solid var(--line-2)">after Northshire list</span>') + '<div class="rows" style="padding-top:12px"></div><div class="row" style="position:absolute;left:30px;right:30px;bottom:24px;font-size:30px;font-weight:800"><span>Cart total</span><span class="num tot"></span></div>'), X3);
    s3.tot = inner(s3.list, '.tot');
    const O3 = ['26.99', '27.49', '25.90', '12.90', '16.40', '5.95'], N3 = ['24.99', '25.54', '23.90', '12.25', '15.80', '5.95'], G3 = ['Acme Plus', 'Acme Plus', 'Acme Plus', 'Resident', 'Acme Plus', 'list price'];
    s3.rows = ITEMS.map((n, i) => { const r = kit.h('<div class="row" style="height:62px;padding:0 30px;font-size:25px;border-bottom:1px solid var(--line)"><span style="flex:1">' + n + '</span><span class="num old" style="width:120px;text-align:right;color:var(--dim)">€' + O3[i] + '</span><span class="num nw2" style="width:130px;text-align:right;font-weight:700">€' + N3[i] + '</span><span style="width:170px;text-align:right"><span class="pill tg" style="font-size:17px;padding:4px 12px">' + G3[i] + '</span></span></div>'); inner(s3.list, '.rows').append(r); return r; });

    // ---------- Station 4: bundle and coupon. SPRING15 is refused on the bundled coffee, accepted on the rest. ----------
    const s4 = this.s4 = {}, X4 = W * 3;
    s4.bundle = el(card(620, 280, '<div class="row" style="height:64px;padding:0 26px;border-bottom:2px solid var(--line)"><span style="font-size:26px;font-weight:700">3 for 2 · coffee beans</span><span class="num off" style="font-size:26px;font-weight:800;color:var(--accent-2)">−€23.90</span></div><div style="display:flex;justify-content:space-around;padding-top:16px">' + ['24.99', '25.54', '23.90'].map((p, i) => '<div style="position:relative;text-align:center;width:150px">' + bag(92) + '<div class="num pr' + i + '" style="font-size:22px;font-weight:700;margin-top:4px">€' + p + '</div></div>').join('') + '</div>'), X4);
    s4.off = inner(s4.bundle, '.off').style; s4.pr2 = inner(s4.bundle, '.pr2').style;
    s4.free = el('<div class="abs stamp" style="font-size:30px;color:var(--accent-2);background:var(--veil)">FREE</div>', X4).style;
    s4.coupon = el(card(620, 250, '<div style="padding:26px"><div style="font-size:21px;font-weight:700;letter-spacing:.1em;color:var(--dim)">COUPON CODE</div><div style="display:flex;gap:14px;margin-top:14px"><div class="inp mono" style="flex:1;height:72px;border-radius:12px;border:3px solid var(--line-2);display:flex;align-items:center;padding:0 20px;font-size:32px;font-weight:700;letter-spacing:.06em;box-sizing:border-box"><span class="typ"></span><span class="car" style="width:3px;height:36px;background:var(--primary);margin-left:4px"></span></div><div class="ap nw" style="flex:none;width:150px;height:72px;border-radius:12px;background:var(--ink);color:var(--on);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700">Apply</div></div><div class="m1 nw" style="margin-top:26px;font-size:22px;font-weight:700;color:var(--alert)">× Not on bundled items: one discount per item</div><div class="m2 nw" style="margin-top:-30px;font-size:22px;font-weight:700;color:var(--ok)">✓ Applied to the 3 other lines: −€5.10</div></div>'), X4);
    s4.inp = inner(s4.coupon, '.inp'); s4.typ = inner(s4.coupon, '.typ'); s4.car = inner(s4.coupon, '.car').style; s4.ap = inner(s4.coupon, '.ap').style; s4.m1 = inner(s4.coupon, '.m1').style; s4.m2 = inner(s4.coupon, '.m2').style;
    s4.list = el(card(940, 600, head('Your cart', '<span class="pill" style="font-size:19px;padding:6px 14px;color:var(--soft);border:2px solid var(--line-2)">Acme Plus prices</span>') + '<div class="rows" style="padding-top:12px"></div><div class="row" style="position:absolute;left:30px;right:30px;bottom:24px;font-size:30px;font-weight:800"><span>Cart total</span><span class="num tot"></span></div>'), X4);
    s4.tot = inner(s4.list, '.tot');
    const P4 = ['24.99', '25.54', '23.90', '12.25', '15.80', '5.95'], C4 = ['', '', '', '−1.84', '−2.37', '−0.89'];
    s4.rows = ITEMS.map((n, i) => { const r = kit.h('<div class="row" style="height:62px;padding:0 30px;font-size:25px;border-bottom:1px solid var(--line)"><span style="flex:1">' + n + '</span><span style="width:250px;text-align:right"><span class="pill mk" style="font-size:17px;padding:4px 12px"></span></span><span class="num pr" style="width:130px;text-align:right;font-weight:700">€' + P4[i] + '</span></div>'); inner(s4.list, '.rows').append(r); return r; });
    s4.mk = s4.rows.map((r) => inner(r, '.mk')); s4.pr = s4.rows.map((r) => inner(r, '.pr')); s4.C = C4;

    // ---------- Station 5: tax, last, on the discounted amount. ----------
    const s5 = this.s5 = {}, X5 = W * 4;
    const RULE = ['Regional price list', 'Resident benefit', 'Acme Plus prices', 'Bundles', 'One coupon', 'Regional tax'];
    s5.bars = RULE.map((r, i) => el('<div class="abs" style="width:520px;height:70px;border-radius:14px;box-sizing:border-box;border:2px solid ' + (i === 5 ? 'var(--accent)' : 'var(--line-2)') + ';background:' + (i === 5 ? 'var(--accent)' : (i % 2 ? 'var(--primary-wash)' : 'var(--card)')) + ';color:' + (i === 5 ? 'var(--on)' : 'var(--ink)') + ';display:flex;align-items:center;gap:16px;padding:0 22px;font-size:25px;font-weight:700;white-space:nowrap"><span style="opacity:.6">' + (i + 1) + '</span><span style="flex:1">' + r + '</span><span>' + (i === 5 ? 'last' : '✓') + '</span></div>', X5));
    s5.calc = el(card(1000, 440, '<div style="padding:34px 44px"><div class="row" style="font-size:28px;height:64px"><span>Amount after discounts</span><span class="num" style="font-weight:700">€79.43</span></div><div class="row gh" style="font-size:22px;height:40px;color:var(--dim)"><span style="text-decoration:line-through">Not on the list price, €116.13</span><span></span></div><div class="row tx" style="font-size:28px;height:72px;margin-top:10px;color:var(--accent-2)"><span>Northshire tax · 6%</span><span class="num tv" style="font-weight:700"></span></div><div style="height:3px;background:var(--ink);margin:24px 0"></div><div class="row" style="font-size:44px;font-weight:800"><span>Total</span><span class="num fv" style="font-size:72px"></span></div></div>'), X5);
    s5.gh = inner(s5.calc, '.gh').style; s5.tx = inner(s5.calc, '.tx').style; s5.tv = inner(s5.calc, '.tv'); s5.fv = inner(s5.calc, '.fv');
    s5.ring = el('<div class="abs" style="width:1000px;height:440px;border-radius:16px;border:5px solid var(--accent);box-sizing:border-box"></div>', X5).style;

    // ---------- Station 6: the receipt, every euro with its "why"; support opens the same lines. ----------
    const s6 = this.s6 = {}, X6 = W * 5;
    const R = [['Coffee beans · Colombia', '24.99', 'Acme Plus price'], ['Coffee beans · Kenya', '25.54', 'Acme Plus price'], ['Coffee beans · Brazil', '23.90', 'Acme Plus price'], ['Olive oil 1 l', '12.25', 'Northshire list, resident −€0.65'], ['Laundry pods ×40', '15.80', 'Acme Plus price'], ['Dish soap 1 l', '5.95', 'Northshire list']];
    const ADJ = [['3 for 2', '−€23.90', 'cheapest coffee free'], ['SPRING15', '−€5.10', 'not on bundled items'], ['Tax 6%', '+€4.77', 'Northshire, after discounts']];
    const rline = (a, b, c, cls) => '<div class="' + (cls || '') + '" style="padding:2px 10px;margin:0 -10px;border-radius:8px"><div class="row" style="font-size:21px;height:27px"><span>' + a + '</span><span class="num">' + b + '</span></div><div style="font-size:17px;color:var(--primary-2);height:21px;white-space:nowrap">why: ' + c + '</div></div>';
    s6.rc = el('<div class="abs" style="width:680px;height:690px;background:var(--paper);box-shadow:0 14px 38px var(--shadow);border-radius:6px;overflow:hidden"><div class="mono" style="padding:18px 40px"><div style="text-align:center;font-size:22px;font-weight:700;letter-spacing:.12em">ACME MARKET</div><div style="text-align:center;font-size:16px;color:var(--dim);margin:4px 0 12px">receipt · Northshire · example</div><div style="border-top:2px dashed var(--line-2);padding-top:8px">' + R.map((r) => rline(r[0], r[1], r[2])).join('') + '</div><div style="border-top:2px dashed var(--line-2);margin-top:6px;padding-top:6px">' + ADJ.map((r) => rline(r[0], r[1], r[2], 'adj')).join('') + '</div><div class="row" style="border-top:3px solid var(--ink);margin-top:8px;padding-top:10px;font-size:30px;font-weight:700"><span>TOTAL</span><span class="num">€84.20</span></div></div></div>', X6);
    s6.adj = [...s6.rc.querySelectorAll('.adj')].map((n) => n.style);
    s6.desk = el('<div class="abs card" style="width:820px;height:560px;overflow:hidden"><div style="height:44px;display:flex;align-items:center;gap:8px;padding:0 16px;background:var(--bg1);border-bottom:2px solid var(--line)"><i style="width:12px;height:12px;border-radius:50%;background:var(--alert)"></i><i style="width:12px;height:12px;border-radius:50%;background:var(--accent)"></i><i style="width:12px;height:12px;border-radius:50%;background:var(--ok)"></i><span style="margin-left:12px;font-size:18px;font-weight:600;color:var(--soft)">Support desk · order A-20417</span></div><div style="padding:24px 34px"><div style="display:flex;align-items:center;gap:14px"><div style="width:52px;height:52px;border-radius:50%;background:var(--accent-wash);color:var(--accent-2);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px">M</div><div style="font-size:24px;font-weight:700">Maya · Acme Plus member</div></div><div style="font-size:19px;font-weight:700;letter-spacing:.1em;color:var(--dim);margin:24px 0 8px">WHY THIS TOTAL</div><div class="ls"></div><div class="row" style="border-top:3px solid var(--ink);margin-top:12px;padding-top:12px;font-size:30px;font-weight:800"><span>Total</span><span class="num">€84.20</span></div></div></div>', X6);
    s6.dl = ADJ.map((r) => { const n = kit.h('<div class="row" style="height:58px;padding:0 14px;margin:0 -14px;border-radius:10px;font-size:23px"><span style="font-weight:700;width:150px">' + r[0] + '</span><span style="flex:1;color:var(--primary-2)">' + r[2] + '</span><span class="num" style="font-weight:700">' + r[1] + '</span></div>'); inner(s6.desk, '.ls').append(n); return n.style; });
    s6.same = el('<div class="abs pill" style="font-size:24px;padding:12px 22px;background:var(--ok);color:var(--on);box-shadow:0 10px 24px var(--shadow)">✓ Same lines as Maya’s receipt</div>', X6).style;

    // ---------- Fixed on top: the step rail, the counter, the running total, the cart on the road. ----------
    this.rail = kit.h('<div class="abs" style="display:flex;gap:12px;transform:translate(120px,52px)"></div>'); g.append(this.rail);
    this.pills = ['1 Cart', '2 Region', '3 Resident & member', '4 Bundle & coupon', '5 Tax', '6 Receipt'].map((s) => { const p = kit.h('<div class="pill" style="font-size:20px;padding:9px 18px;border:2px solid var(--line-2)"></div>'); p.textContent = s; this.rail.append(p); return p.style; });
    this.ctr = kit.h('<div class="abs card" style="width:480px;height:112px;display:flex;align-items:center;padding:0 26px;gap:26px;transform:translate(1320px,28px)"><div><div class="label" style="font-size:16px">RULES APPLIED</div><div class="num" style="font-size:44px;font-weight:800;line-height:1.1"><span class="rn"></span><span style="color:var(--dim)">/6</span></div></div><div style="width:2px;height:64px;background:var(--line)"></div><div><div class="label" style="font-size:16px">TOTAL</div><div class="num tt" style="font-size:44px;font-weight:800;line-height:1.1"></div></div></div>');
    g.append(this.ctr); this.rn = this.ctr.querySelector('.rn'); this.tt = this.ctr.querySelector('.tt');
    this.cring = kit.h('<div class="abs" style="width:480px;height:112px;border-radius:16px;border:4px solid var(--accent);box-sizing:border-box"></div>'); g.append(this.cring);
    this.token = kit.h('<div class="abs" style="width:64px;height:64px;border-radius:50%;background:var(--accent);color:var(--on);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px var(--shadow)"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/></svg></div>'); g.append(this.token);
    this.cap = buildCaps(kit, g);
    this.foot = buildFoot(kit, g, { note: 'Example cart; amounts and labels invented.' });
  },

  render(t) {
    // Camera: rests on a station, glides to the next at each start.
    let cam = 0, moving = 0;
    for (let i = 1; i < 6; i++) { const k = seg(t, STARTS[i] - 0.3, STARTS[i] + 1.1); cam = lerp(cam, i * W, eio(k)); if (k > 0 && k < 1) moving = Math.sin(Math.PI * k); }
    this.world.transform = 'translate(' + (-cam) + 'px,0px)';
    const st = Math.max(0, STARTS.filter((a) => t >= a - 0.3).length - 1);
    const L = (i) => t - STARTS[i];
    const W2 = (n, x, y, o, sc) => place(n.style, n._x0 + x, y, o, sc);

    // Rail, counter, total.
    this.pills.forEach((s, i) => {
      if (i < st) { s.background = 'var(--card)'; s.color = 'var(--primary-2)'; s.borderColor = 'var(--primary)'; }
      else if (i === st) { s.background = 'var(--accent)'; s.color = 'var(--on)'; s.borderColor = 'var(--accent)'; }
      else { s.background = 'transparent'; s.color = 'var(--dim)'; s.borderColor = 'var(--line-2)'; }
    });
    this.rail.style.opacity = String(K(t, 0, 0.5));
    const tot = totalAt(t);
    this.rn.textContent = String(rulesAt(t)); this.tt.textContent = eur(tot);
    const ticking = TOTAL.some(([a, , d]) => t >= a && t < a + d);
    this.tt.style.color = ticking ? 'var(--accent-2)' : 'var(--ink)';
    this.ctr.style.opacity = String(K(t, 0.2, 0.5));
    const lastRule = RULES.filter((a) => t >= a).pop();
    const rp = lastRule != null ? seg(t, lastRule, lastRule + 0.7) : 0;
    this.cring.style.opacity = String(rp > 0 && rp < 1 ? 0.8 * (1 - rp) : 0);
    this.cring.style.transform = 'translate(1320px,28px) scale(' + lerp(1, 1.12, eo(rp)) + ')';
    this.token.style.opacity = String(K(t, 0.4, 0.5));
    this.token.style.transform = 'translate(928px,' + (842 - 14 * moving) + 'px) rotate(' + (-8 * moving) + 'deg)';

    // ---------- Station 1 ----------
    { const tt = L(0), s = this.s1;
      W2(s.tile, 140, 230 + 20 * (1 - K(tt, 0.3, 0.6)), K(tt, 0.3, 0.6));
      W2(s.cart, 720, 200 + 20 * (1 - K(tt, 0.6, 0.6)), K(tt, 0.6, 0.6));
      const press = seg(tt, 2.3, 2.6);
      s.btn.textContent = tt >= 2.45 ? 'Added ✓' : 'Add to cart';
      s.btn.style.background = tt >= 2.45 ? 'var(--ok)' : 'var(--ink)';
      s.btn.style.transform = 'scale(' + (press > 0 && press < 1 ? 1 - 0.08 * Math.sin(Math.PI * press) : 1) + ')';
      const ins = eio(seg(tt, 2.9, 3.4));
      s.rows.forEach((r, i) => {
        let y = i * 64; if (i > 2) y -= 64 * (1 - ins);
        const o = (i === 2 ? K(tt, 3.2, 0.4) : 1) * K(tt, 0.9 + i * 0.1, 0.4);
        r.style.opacity = String(o); r.style.transform = 'translate(30px,' + y + 'px)';
        r.style.background = i === 2 && tt > 3.2 && tt < 4.4 ? 'var(--accent-wash)' : 'transparent';
      });
      s.badges.forEach((b, i) => { const a = 4.6 + i * 0.15; b.opacity = String(tt >= a ? 1 : 0); b.transform = 'scale(' + popS(tt, a) + ')'; b.display = 'inline-flex'; });
      s.brace.style.opacity = String(K(tt, 4.6, 0.4)); s.brace.style.transform = 'translate(12px,6px) scaleY(' + K(tt, 4.6, 0.5) + ')'; s.brace.style.transformOrigin = '50% 0';
      s.sub.textContent = eur(totalAt(t));
      const fk = seg(tt, 2.6, 3.3);
      place(s.fly.style, lerp(250, 760, eio(fk)), lerp(700, 420, eio(fk)) - 80 * Math.sin(Math.PI * fk), fk > 0 && fk < 1 ? 1 : 0);
    }
    // ---------- Station 2 ----------
    { const tt = L(1), s = this.s2;
      W2(s.region, 140, 230 + 20 * (1 - K(tt, 0.8, 0.6)), K(tt, 0.8, 0.6));
      W2(s.list, 800, 200 + 20 * (1 - K(tt, 1.0, 0.6)), K(tt, 1.0, 0.6));
      const sw = eio(seg(tt, 3.0, 3.5));
      s.knob.transform = 'translateX(' + (250 * sw) + 'px)';
      s.a.color = sw < 0.5 ? 'var(--on)' : 'var(--soft)'; s.b.color = sw >= 0.5 ? 'var(--on)' : 'var(--soft)';
      s.chip.textContent = sw >= 0.5 ? 'Northshire' : 'Standard';
      s.chip.style.color = sw >= 0.5 ? 'var(--accent-2)' : 'var(--soft)'; s.chip.style.borderColor = sw >= 0.5 ? 'var(--accent)' : 'var(--line-2)';
      s.rows.forEach((r, i) => {
        const nv = r.querySelector('.nv').style, dv = r.querySelector('.dv').style, stv = r.querySelector('.st').style;
        nv.opacity = String(K(tt, 3.7 + i * 0.12, 0.3));
        const hit = i === 3 ? 4.6 : (i === 4 ? 5.6 : -1);
        const on = hit > 0 && tt >= hit;
        dv.opacity = String(hit > 0 ? K(tt, hit, 0.3) : K(tt, 3.7 + i * 0.12, 0.3) * 0.5);
        dv.color = i === 3 ? 'var(--ok)' : (i === 4 ? 'var(--accent-2)' : 'var(--dim)');
        nv.color = on ? (i === 3 ? 'var(--ok)' : 'var(--accent-2)') : 'var(--ink)';
        stv.textDecoration = on ? 'line-through' : 'none';
        r.style.background = on ? (i === 3 ? 'var(--ok-wash)' : 'var(--accent-wash)') : 'transparent';
        r.style.transform = 'translateX(' + (hit > 0 ? shakeX(tt, hit, 6, 0.4) : 0) + 'px)';
      });
      s.tot.textContent = eur(Math.min(116.13, totalAt(Math.max(t, 15))));
    }
    // ---------- Station 3 ----------
    { const tt = L(2), s = this.s3;
      W2(s.res, 140, 210 + 20 * (1 - K(tt, 0.8, 0.6)), K(tt, 0.8, 0.6));
      s.resOk.opacity = String(tt >= 2.4 ? 1 : 0); s.resOk.transform = 'scale(' + popS(tt, 2.4) + ')';
      W2(s.mem, 140, 400 + 20 * (1 - K(tt, 1.1, 0.6)), K(tt, 1.1, 0.6));
      const checking = tt >= 3.2 && tt < 5.0, done = tt >= 5.0;
      s.spin.display = done ? 'none' : 'block'; s.spin.transform = 'rotate(' + (tt * 400) + 'deg)';
      s.tick.display = done ? 'flex' : 'none'; s.tick.transform = 'scale(' + popS(tt, 5.0) + ')';
      s.msg.textContent = done ? 'Active until 30 June' : (checking ? 'Checking subscription…' : 'Acme Plus member');
      const rr = seg(tt, 5.0, 5.8);
      place(s.ring, s.mem._x0 + 140 - 280 * (lerp(1, 1.08, eo(rr)) - 1), 400 - 170 * (lerp(1, 1.08, eo(rr)) - 1), rr > 0 && rr < 1 ? 0.9 * (1 - rr) : 0, lerp(1, 1.08, eo(rr)));
      s.ring.transformOrigin = '0 0';
      W2(s.list, 800, 200 + 20 * (1 - K(tt, 1.3, 0.6)), K(tt, 1.3, 0.6));
      s.rows.forEach((r, i) => {
        const at = i === 3 ? 2.8 : (i === 5 ? -1 : 5.4 + [0, 0.3, 0.6, 0, 0.9][i]);
        const on = at > 0 && tt >= at, k = at > 0 ? K(tt, at, 0.4) : 0;
        const old = r.querySelector('.old').style, nw = r.querySelector('.nw2').style, tg = r.querySelector('.tg').style;
        old.textDecoration = on ? 'line-through' : 'none'; old.color = on ? 'var(--dim)' : 'var(--ink)';
        const kk = i === 5 ? 1 : k; nw.opacity = String(kk); nw.transform = 'translateY(' + (-14 * (1 - kk)) + 'px)';
        nw.color = i === 5 ? 'var(--soft)' : 'var(--ink)';
        if (i === 5) { old.opacity = '0'; tg.opacity = '1'; tg.color = 'var(--dim)'; tg.border = '2px solid var(--line-2)'; tg.background = 'transparent'; }
        else { old.opacity = '1'; tg.opacity = String(k); tg.transform = 'scale(' + (on ? popS(tt, at) : 0.5) + ')'; tg.color = 'var(--on)'; tg.background = i === 3 ? 'var(--ok)' : 'var(--primary)'; tg.border = 'none'; }
      });
      s.tot.textContent = eur(Math.max(108.43, Math.min(115.63, totalAt(Math.max(t, 30)))));
    }
    // ---------- Station 4 ----------
    { const tt = L(3), s = this.s4;
      W2(s.bundle, 140, 190 + 20 * (1 - K(tt, 0.8, 0.6)), K(tt, 0.8, 0.6));
      const fr = seg(tt, 1.6, 1.9);
      place(s.free, s.bundle._x0 + 140 + 455, 190 + 100, Math.min(1, fr * 3) * (tt >= 1.6 ? 1 : 0), lerp(2.2, 1, eo(fr)));
      s.free.transform += ' rotate(-10deg)';
      s.pr2.textDecoration = tt >= 1.7 ? 'line-through' : 'none'; s.pr2.color = tt >= 1.7 ? 'var(--dim)' : 'var(--ink)';
      s.off.opacity = String(K(tt, 1.9, 0.4));
      const cx = shakeX(tt, 5.2, 16, 0.6);
      W2(s.coupon, 140 + cx, 510 + 20 * (1 - K(tt, 1.1, 0.6)), K(tt, 1.1, 0.6));
      const code = 'SPRING15', n = Math.max(0, Math.min(code.length, Math.floor((tt - 3.0) * 8)));
      s.typ.textContent = code.slice(0, n);
      s.car.opacity = (tt < 4.4 && (n < code.length || Math.floor(tt / 0.5) % 2)) ? '1' : '0';
      const pr = seg(tt, 4.4, 4.7); s.ap.transform = 'scale(' + (pr > 0 && pr < 1 ? 1 - 0.08 * Math.sin(Math.PI * pr) : 1) + ')';
      s.inp.style.borderColor = tt >= 5.2 && tt < 7.4 ? 'var(--alert)' : (tt >= 7.4 ? 'var(--ok)' : 'var(--line-2)');
      s.m1.opacity = String(K(tt, 5.2, 0.3) * (1 - K(tt, 7.2, 0.3)));
      s.m2.opacity = String(K(tt, 7.4, 0.3));
      W2(s.list, 820, 200 + 20 * (1 - K(tt, 1.3, 0.6)), K(tt, 1.3, 0.6));
      s.rows.forEach((r, i) => {
        const mk = s.mk[i], ms = mk.style, bundled = i < 3;
        let x = 0;
        if (bundled) {
          if (tt >= 5.2 + i * 0.15) { mk.textContent = '× one discount per item'; ms.background = 'var(--alert)'; ms.color = 'var(--on)'; ms.transform = 'scale(' + popS(tt, 5.2 + i * 0.15) + ')'; x = shakeX(tt, 5.2 + i * 0.15, 8, 0.5); }
          else { mk.textContent = '3 for 2'; ms.background = 'var(--accent)'; ms.color = 'var(--on)'; ms.transform = 'scale(1)'; }
          ms.opacity = '1';
          r.style.background = tt >= 5.2 && tt < 7.0 ? 'var(--alert-wash)' : 'transparent';
        } else {
          const a = 7.4 + (i - 3) * 0.2;
          mk.textContent = '✓ SPRING15 ' + s.C[i]; ms.background = 'var(--ok)'; ms.color = 'var(--on)';
          ms.opacity = String(tt >= a ? 1 : 0); ms.transform = 'scale(' + popS(tt, a) + ')';
          r.style.background = tt >= a && tt < 9.0 ? 'var(--ok-wash)' : 'transparent';
        }
        r.style.transform = 'translateX(' + x + 'px)';
        if (i === 2) { s.pr[i].textContent = tt >= 1.7 ? 'free' : '€23.90'; s.pr[i].style.color = tt >= 1.7 ? 'var(--accent-2)' : 'var(--ink)'; }
      });
      s.tot.textContent = eur(Math.max(79.43, Math.min(108.43, totalAt(Math.max(t, 45)))));
    }
    // ---------- Station 5 ----------
    { const tt = L(4), s = this.s5;
      s.bars.forEach((b, i) => {
        const yy = 800 - (i + 1) * 82;
        if (i < 5) { const k = K(tt, 0.8 + i * 0.12, 0.4); W2(b, 140, yy + 20 * (1 - k) + (tt > 2.6 && tt < 3.0 ? 3 * Math.sin((tt - 2.6) * 60) * (1 - (tt - 2.6) / 0.4) : 0), k); }
        else { const k = eob(seg(tt, 2.0, 2.6), 1.6); W2(b, 140, lerp(-120, yy, Math.min(1.2, k)), tt >= 2.0 ? 1 : 0); }
      });
      W2(s.calc, 760, 230 + 20 * (1 - K(tt, 1.0, 0.6)), K(tt, 1.0, 0.6));
      s.gh.opacity = String(K(tt, 1.8, 0.4)); s.tx.opacity = String(K(tt, 3.0, 0.4));
      s.tv.textContent = '+' + eur(lerp(0, 4.77, eio(seg(tt, 3.0, 3.8))));
      s.fv.textContent = eur(totalAt(Math.max(t, 60)));
      const rr = seg(tt, 4.6, 5.4);
      place(s.ring, s.calc._x0 + 760, 230, rr > 0 && rr < 1 ? 0.9 * (1 - rr) : 0, 1);
      s.ring.transform += ' scale(' + lerp(1, 1.05, eo(rr)) + ')'; s.ring.transformOrigin = '50% 50%';
    }
    // ---------- Station 6 ----------
    { const tt = L(5), s = this.s6;
      const rv = eio(seg(tt, 0.8, 3.4));
      W2(s.rc, 160, 160, K(tt, 0.6, 0.3));
      s.rc.style.clipPath = 'inset(0 0 ' + (100 * (1 - rv)) + '% 0)';
      W2(s.desk, 940, 190 + 20 * (1 - K(tt, 6.4, 0.6)), K(tt, 6.4, 0.6));
      s.dl.forEach((d, i) => { const a = 7.4 + i * 0.6; d.opacity = String(K(tt, a, 0.3)); d.background = tt >= a && tt < a + 1.2 ? 'var(--accent-wash)' : 'transparent'; s.adj[i].background = tt >= a && tt < a + 1.2 ? 'var(--accent-wash)' : 'transparent'; });
      const sp = seg(tt, 10.0, 10.35);
      place(s.same, s.desk._x0 + 1350, 150, tt >= 10.0 ? 1 : 0, lerp(0.5, 1, eob(sp, 2)));
    }

    renderCaps(this.cap, [
      [1.0, 'Maya adds a third coffee, and the 3-for-2 bundle snaps on.'], [7.5, 'Six rules will now price this cart, one after another.'],
      [16.0, 'Maya lives in Northshire, so the Northshire price list applies.'], [22.5, 'Two prices change, and the total follows.'],
      [31.0, 'Her Northshire residency is checked first, then her Acme Plus membership.'], [38.5, 'The membership is active, so member prices replace list prices.'],
      [46.0, 'Bundles come first: the cheapest coffee in the 3 for 2 is free.'], [49.6, 'SPRING15 is refused on bundled coffee, then accepted on the other lines.'],
      [61.0, 'Tax comes last, on the amount after every discount.'], [67.5, 'The same order runs in the cart, at checkout and on the receipt.'],
      [76.0, 'Every euro on the receipt has a line saying why.'], [82.0, 'Support opens the same receipt: the same lines, the same €84.20.'],
    ], t, 930);
    enter(this.foot, t, 0.5, 120, 1016, 4);
  },
});
