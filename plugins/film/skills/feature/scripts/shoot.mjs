#!/usr/bin/env node
// Shoot frames of a built film with headless Chrome and lay them out on one contact sheet.
//
// usage: node shoot.mjs <work_dir> [scene:t ...]
//
// With no frame list it shoots every scene at 40 % of its length and 0.3 s before its end; a scene in
// film.json may add its own "shots": [seconds, ...]. Writes <work_dir>/out/shots/<scene>-<t>.png and one
// readable sheet per scene, <work_dir>/out/shots/sheet-<scene>.png (4 columns of 480x270), prints each
// file, and exits 1 if any scene threw in the console.
// Chrome: $CHROME, else the macOS app path, else `google-chrome` on PATH.
//
// usage: node shoot.mjs <work_dir> --pace [seconds]
// Steps every scene through its whole length in 0.25 s steps and lists each stretch where nothing on
// screen changes for `seconds` or more (default 3). A film where the picture stands still for that long
// reads as a slide show. Only new information counts as a change: an element appearing or leaving, a text
// or a number changing; a camera drift does not. The film's closing invitation may hold up to 6 s. Exits 1
// when any stretch is found.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const dir = resolve(process.argv[2] ?? (console.error('usage: node shoot.mjs <work_dir> [scene:t ...]'), process.exit(1)));
const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8'));
const out = join(dir, 'out'), shots = join(out, 'shots');
if (!existsSync(join(out, 'preview.html'))) { console.error('shoot: run build.mjs first'); process.exit(1); }
const MAC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = process.env.CHROME || (existsSync(MAC) ? MAC : 'google-chrome');

const durOf = Object.fromEntries(film.scenes.map((s) => [s.id, s.dur]));
if (process.argv[3] === '--pace') {
  const limit = process.argv[4] === undefined ? 3 : +process.argv[4];
  if (!Number.isFinite(limit) || limit <= 0) { console.error('shoot: --pace takes a positive number of seconds'); process.exit(1); }
  let still = 0;
  for (const s of film.scenes) {
    const url = pathToFileURL(join(out, 'preview.html')).href + '?s=' + s.id + '&pace=' + s.dur;
    const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--enable-logging=stderr', '--log-level=0', '--v=0', '--window-size=1920,1080', '--virtual-time-budget=20000', '--dump-dom', url], { encoding: 'utf8', maxBuffer: 64 << 20 });
    if (r.error || r.status !== 0) { console.error('shoot: Chrome did not run (' + chrome + ')'); process.exit(1); }
    const line = (r.stderr || '').split('\n').find((l) => l.includes('PACE '));
    if (!line) { console.error('shoot: no pace report for ' + s.id + ' (did the scene throw?)'); process.exit(1); }
    const runs = JSON.parse(line.slice(line.indexOf('PACE ') + 5).replace(/", source:.*$/, '').replace(/"$/, ''));
    // The invitation is the last frame and holds on purpose: the film's final stretch may stand still up to 6 s.
    const last = s === film.scenes[film.scenes.length - 1];
    const long = runs.filter(([, b, d]) => d >= limit && !(last && b >= s.dur - 1e-9 && d <= 6));
    still += long.length;
    console.log(s.id.padEnd(12) + (long.length ? long.map(([a, b, d]) => a + '–' + b + ' s still (' + d + ' s)').join(', ') : 'no stretch of ' + limit + ' s or more without a change'));
  }
  if (still) { console.error('pace: ' + still + ' stretch(es) where the picture stands still for ' + limit + ' s or more'); process.exit(1); }
  process.exit(0);
}
const asked = process.argv.slice(3).map((a) => { const [s, t] = a.split(':'); if (!(s in durOf) || t === undefined || !Number.isFinite(+t) || +t < 0 || +t > durOf[s]) { console.error('shoot: frame ' + JSON.stringify(a) + ' must be <scene>:<seconds> for a scene in film.json, within its length'); process.exit(1); } return [s, +t]; });
for (const s of film.scenes) for (const x of s.shots || []) if (!Number.isFinite(x)) { console.error('shoot: scene ' + s.id + ' has a non-numeric shot ' + JSON.stringify(x)); process.exit(1); }
const r1 = (x) => Math.round(x * 10) / 10;
const frames = asked.length ? asked : film.scenes.flatMap((s) => [...new Set([r1(s.dur * 0.4), ...(s.shots || []).map(r1), r1(Math.max(1, s.dur - 0.3))])].sort((a, b) => a - b).map((t) => [s.id, t]));
const mark = join(out, '.film-build'), built = existsSync(mark) ? statSync(mark).mtimeMs : 0;
const inputs = [join(dir, 'film.json'), ...film.scenes.map((s) => join(dir, s.file || ('scenes/' + s.id + '.js'))), ...(film.helpers || []).map((h) => join(dir, h))];
if (inputs.some((f) => existsSync(f) && statSync(f).mtimeMs > built)) { console.error('shoot: an input changed after the last build; run build.mjs first'); process.exit(1); }
rmSync(shots, { recursive: true, force: true }); mkdirSync(shots, { recursive: true });
const errors = [];
const run = (url, png, w, h) => spawnSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--enable-logging=stderr', '--log-level=0', '--v=0',
  '--window-size=' + w + ',' + h, '--virtual-time-budget=5000', '--screenshot=' + png, url], { encoding: 'utf8' });
const files = [];
for (const [id, t] of frames) {
  const png = join(shots, id + '-' + t + '.png');
  const r = run(pathToFileURL(join(out, 'preview.html')).href + '?s=' + id + '&t=' + t, png, 1920, 1080);
  if (r.error || r.status !== 0) { console.error('shoot: Chrome did not run (' + chrome + '): ' + (r.error ? r.error.message : 'exit ' + r.status) + '. Set $CHROME to the browser binary.'); process.exit(1); }
  if (!existsSync(png)) { console.error('shoot: no frame written for ' + id + ' @ ' + t); process.exit(1); }
  for (const line of (r.stderr || '').split('\n')) if (/CONSOLE.*(Uncaught|Error)/.test(line)) errors.push(id + '@' + t + ': ' + line.replace(/^.*CONSOLE[:(]\d+[)\]]*\]? ?/, ''));
  files.push([id + '-' + t + '.png', id + ' @ ' + t + 's']); console.log(png);
}
const cols = 4, byScene = {};
for (const f of files) (byScene[f[1].split(' @ ')[0]] ||= []).push(f);
for (const [id, list] of Object.entries(byScene)) {
  const rows = Math.ceil(list.length / cols), page = join(shots, 'sheet-' + id + '.html');
  writeFileSync(page, '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(' + cols + ',480px)}figure{margin:0;position:relative}img{width:480px;height:270px;display:block}figcaption{position:absolute;left:6px;top:4px;color:#f0bd55;font:13px monospace}</style>' + list.map(([f, c]) => '<figure><img src="' + f + '"><figcaption>' + c + '</figcaption></figure>').join(''));
  const sheet = join(shots, 'sheet-' + id + '.png'), sr = run(pathToFileURL(page).href, sheet, cols * 480, rows * 270);
  if (sr.error || sr.status !== 0 || !existsSync(sheet)) { console.error('shoot: the contact sheet for ' + id + ' was not written'); process.exit(1); }
  console.log(join(shots, 'sheet-' + id + '.png'));
}
if (errors.length) { console.error('scene errors:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
