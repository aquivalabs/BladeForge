#!/usr/bin/env node
// Build one feature film from a work folder into Claude Motion store documents and a local preview.
//
// usage: node build.mjs <work_dir>
//
// <work_dir>/film.json:
//   { "title": "Price stack", "background": "#FAF7F2", "palette": ["#FAF7F2", "#1B2A4A", "#3A78C9", "#EE8130"],
//     "fonts": { "sans": { "family": "Inter", "or": "inter", "weights": [400, 600, 800] } },
//     "scenes": [ { "id": "stakes", "name": "How it goes today", "dur": 26, "file": "scenes/stakes.js" } ],
//     "helpers": ["lib.js"],                    // optional: shared helpers, inlined after kit.js in every scene
//     "score": "score.js" }                      // optional
// <work_dir>/base.css                            // palette tokens; copy scripts/base.css and edit
//
// Writes <work_dir>/out/: scene-<id>.js (kit + scene), base.css, preview.html (?s=<id>&t=<sec>),
// docs/*.json and docs/writes.json — the ready `writes` array for ONE ArtifactData batch, film/meta first, film/script last.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_SECONDS = 300;
const fail = (msg) => { console.error('build: ' + msg); process.exit(1); };
const dir = resolve(process.argv[2] ?? fail('usage: node build.mjs <work_dir>'));
const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8'));
for (const k of ['title', 'scenes']) if (!(k in film)) fail('film.json misses ' + k);
const KIT = readFileSync(join(HERE, 'kit.js'), 'utf8') + (film.helpers || []).map((h) => '\n' + readFileSync(join(dir, h), 'utf8')).join('');
const out = join(dir, 'out'), docsDir = join(out, 'docs');
mkdirSync(docsDir, { recursive: true });

let total = 0;
const sceneText = {};
for (const s of film.scenes) {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(s.id)) fail('bad scene id ' + JSON.stringify(s.id));
  if (!(s.dur >= 1)) fail('scene ' + s.id + ' needs dur >= 1');
  const src = join(dir, s.file || ('scenes/' + s.id + '.js'));
  if (!existsSync(src)) fail('missing ' + src);
  const body = readFileSync(src, 'utf8');
  if (!body.includes("kit.scene('" + s.id + "'")) fail(src + " does not register kit.scene('" + s.id + "', ...)");
  sceneText[s.id] = KIT + '\n' + body;
  writeFileSync(join(out, 'scene-' + s.id + '.js'), sceneText[s.id]);
  total += s.dur;
}
if (total > MAX_SECONDS) fail(total + 's is over the ' + MAX_SECONDS + 's a Claude Motion film can load; cut by story or split into a series');

const css = readFileSync(existsSync(join(dir, 'base.css')) ? join(dir, 'base.css') : join(HERE, 'base.css'), 'utf8');
writeFileSync(join(out, 'base.css'), css);
const fonts = film.fonts || {};
const sans = fonts.sans || { family: 'Inter', or: 'inter', weights: [400, 600, 800] };
const mono = fonts.mono || { family: 'JetBrains Mono', or: 'dm-mono', weights: [500, 700] };
const gf = (f) => 'family=' + f.family.replace(/ /g, '+') + ':wght@' + f.weights.join(';');
writeFileSync(join(out, 'preview.html'), readFileSync(join(HERE, 'preview.html'), 'utf8')
  .replace('__FONTS__', gf(sans) + '&' + gf(mono)).replace('__SANS__', sans.family).replace('__MONO__', mono.family));

const scenes = {
  v: 1, stage: 'final', look: film.look || 'Feature briefing film built by film:feature.',
  palettes: [film.palette || ['#FAF7F2', '#1B2A4A', '#3A78C9', '#EE8130']], theirs: 1,
  width: 1920, height: 1080, fps: 60, background: film.background || '#FAF7F2', fonts: { sans, mono },
  scenes: film.scenes.map(({ id, name, dur, desc }) => ({ id, name, dur, desc: desc || name })),
};
const docs = [
  ['film', 'meta', { v: 1, title: film.title, updatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z') }],
  ['modules', 'scenes.json', { kind: 'json', text: JSON.stringify(scenes) }],
  ['modules', 'base.css', { kind: 'css', text: css }],
  ...film.scenes.map((s) => ['modules', 'scene-' + s.id + '.js', { kind: 'js', text: sceneText[s.id] }]),
  ...(film.score ? [['modules', 'score.js', { kind: 'js', text: readFileSync(join(dir, film.score), 'utf8') }]] : []),
  ['film', 'script', { code: 'window.CUT = kit.scenes();' }],
];
const writes = docs.map(([collection, docId, data]) => {
  const fp = join(docsDir, collection + '__' + docId + '.json');
  writeFileSync(fp, JSON.stringify(data));
  return { op: 'set', collection, doc_id: docId, file_path: fp };
});
writeFileSync(join(docsDir, 'writes.json'), JSON.stringify(writes));
console.log('ok: ' + film.scenes.length + ' scene(s), ' + total + 's -> ' + join(docsDir, 'writes.json'));
