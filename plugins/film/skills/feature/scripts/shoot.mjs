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
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const dir = resolve(process.argv[2] ?? (console.error('usage: node shoot.mjs <work_dir> [scene:t ...]'), process.exit(1)));
const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8'));
const out = join(dir, 'out'), shots = join(out, 'shots');
if (!existsSync(join(out, 'preview.html'))) { console.error('shoot: run build.mjs first'); process.exit(1); }
rmSync(shots, { recursive: true, force: true }); mkdirSync(shots, { recursive: true });
const MAC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = process.env.CHROME || (existsSync(MAC) ? MAC : 'google-chrome');

const asked = process.argv.slice(3).map((a) => { const [s, t] = a.split(':'); if (!s || t === undefined || !Number.isFinite(+t)) { console.error('shoot: frame ' + JSON.stringify(a) + ' must be <scene>:<seconds>'); process.exit(1); } return [s, +t]; });
const frames = asked.length ? asked : film.scenes.flatMap((s) => [...new Set([+(s.dur * 0.4).toFixed(1), ...(s.shots || []), Math.max(1, s.dur - 0.3)])].sort((a, b) => a - b).map((t) => [s.id, t]));
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
  run(pathToFileURL(page).href, join(shots, 'sheet-' + id + '.png'), cols * 480, rows * 270);
  console.log(join(shots, 'sheet-' + id + '.png'));
}
if (errors.length) { console.error('scene errors:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
