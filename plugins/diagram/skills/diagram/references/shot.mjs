#!/usr/bin/env node
// Headless screenshot of a built diagram, so the "LOOK at the render" gate is actually runnable by a
// non-interactive agent (Read the PNG, judge the pixels).
//
//   node shot.mjs <diagram.html> [out.png]
//
// Needs puppeteer-core + a local Chrome/Chromium. It also reports node/zone counts and any page error,
// so a broken render (blank canvas, ELK throw, console error) is caught before you trust the picture.

import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const [inPath, outArg] = process.argv.slice(2);
if (!inPath) { console.error('usage: node shot.mjs <diagram.html> [out.png]'); process.exit(1); }
// ensure the output ends in an image extension puppeteer accepts (an explicit arg like `out` with no
// extension would make page.screenshot throw after Chrome already launched); default derives from the input.
const out = resolve(outArg ? (/\.(png|jpe?g|webp)$/i.test(outArg) ? outArg : outArg + '.png')
                            : inPath.replace(/\.html?$/, '') + '.png');
mkdirSync(dirname(out), { recursive: true });   // so screenshot doesn't ENOENT on a fresh out dir
const url = 'file://' + resolve(inPath);

// find puppeteer-core or the full puppeteer (which ships its own Chromium)
let puppeteer, isFull = false;
for (const p of ['puppeteer-core', 'puppeteer']) { try { puppeteer = (await import(p)).default; isFull = (p === 'puppeteer'); break; } catch {} }
if (!puppeteer) { console.error('need puppeteer-core: `npm i -D puppeteer-core`'); process.exit(2); }
const chromes = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(existsSync);
// full `puppeteer` can launch its bundled Chromium with no executablePath; puppeteer-core needs a path.
if (!chromes.length && !isFull) { console.error('no Chrome/Chromium found — install `puppeteer`, or set a path in shot.mjs'); process.exit(2); }
const launchOpts = { headless: true, args: ['--no-sandbox', '--window-size=1600,1050'] };
if (chromes.length) launchOpts.executablePath = chromes[0];

const browser = await puppeteer.launch(launchOpts);
let nodes = 0, zones = 0; const pageErrs = [], noise = [];
// a real render break is an uncaught page EXCEPTION (pageerror). A console.error is often third-party
// CDN noise (a source-map 404, a library warning logged at error level) — reported, but not fatal, so a
// good render isn't failed by esm.sh/font chatter.
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1050 });
  page.on('pageerror', e => pageErrs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') noise.push('console: ' + m.text().slice(0, 120)); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });   // not networkidle0 — a slow CDN never idling shouldn't fail a good render; readiness is the node-wait below
  // wait for an actually-RENDERED node; 25s covers a slow ELK layout on a big graph (a 12s cap
  // mis-reported those as blank). A timeout here means genuinely nothing drew.
  try { await page.waitForSelector('.react-flow__node', { timeout: 25000 }); } catch {}
  await new Promise(r => setTimeout(r, 400));
  nodes = await page.$$eval('.node, .cont', ns => ns.length).catch(() => 0);
  zones = await page.$$eval('.zone', ns => ns.length).catch(() => 0);
  await page.screenshot({ path: out });
} catch (e) {
  pageErrs.push('shot failed: ' + e.message);   // goto/networkidle/screenshot throw → the tool's own report, not a raw unhandled rejection
} finally {
  await browser.close();   // always close, even if goto/screenshot threw — no orphaned Chrome
}
const status = pageErrs.length ? 'PAGE ERRORS: ' + pageErrs.join(' | ')
  : noise.length ? `no page errors (${noise.length} console msg ignored)` : 'no page errors';
console.log(`shot: ${out}  |  nodes:${nodes} zones:${zones}  |  ${status}`);
if (!nodes || pageErrs.length) process.exit(3);   // fail only on a blank render or a real page exception, not CDN console noise
