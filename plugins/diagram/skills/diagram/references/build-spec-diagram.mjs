#!/usr/bin/env node
// Build ONE self-contained diagram file from a diagram-model JSON + the React-Flow engine template.
//
//   node build-spec-diagram.mjs <name>.diagram.json <name>.html [engine.template.html]
//
// The engine (diagram-viewer.template.html) is the reusable renderer — never regenerate it; it stays
// put and every diagram just swaps the model. This script VALIDATES the model, inlines it into a copy
// of the engine, and strips the dev fetch loader, so the OUTPUT is a single HTML file with no sibling
// files: open it or send it and it just works (libraries load from CDN; the model is baked in).
//
// The diagram-model format (the ONE authority is SKILL.md Step 1 — this is a reminder, not a fork):
//   { "diagram": { "title", "subtitle" },
//     "domains": [ { "id", "name", "sub" } ],                 // optional — subsystems, drawn as zones
//     "nodes":   [ {
//       "id":       "unique-id",
//       "parent":   "a node id | null",                       // nesting = containment/ownership
//       "domain":   "a domain id | null",                     // subsystem membership (drawn as a zone)
//       "name", "kind", "summary",                            // kind = open vocabulary → colour + badge
//       "role"?,                                               // optional structural layer → coloured edge stripe
//       "description"?, "rows"?:[{group,text,means}], "refs"?:[{kind,label,url}]
//     } ],
//     "edges":   [ { "from", "to", "kind"?, "label"? } ] }    // dependency / relation edges
// Everything past name/kind/summary is optional. `id`s are one global namespace (domains + nodes) and
// must be unique; `parent` must be acyclic; `edge.from`/`to` must resolve to node ids.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
// positional args only — flags (--strict) are read separately, so `<in> <out> --strict` works without
// the optional engine path being present (otherwise '--strict' was parsed AS the engine path → ENOENT).
const [specPath, outPath, engineArg] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!specPath || !outPath) {
  console.error('usage: node build-spec-diagram.mjs <name>.diagram.json <name>.html [engine.template.html]');
  process.exit(1);
}
const enginePath = engineArg ? resolve(engineArg) : resolve(HERE, 'diagram-viewer.template.html');

const engine = readFileSync(enginePath, 'utf8');
const specText = readFileSync(resolve(specPath), 'utf8').trim();
let model;
try { model = JSON.parse(specText); }
catch (e) { console.error('malformed JSON:', e.message); process.exit(1); }

// --- validate the model referentially, so a bad edit fails LOUD at build time, not as a blank/hung render ---
const errs = [];
const domains = model.domains || [], nodes = model.nodes || [];
if (!model.diagram || typeof model.diagram !== 'object') errs.push('missing a top-level "diagram" object (needs at least a title)');
if (!nodes.length) errs.push('model has no nodes — an empty diagram is not shippable');
const nodeIds = new Set(), domIds = new Set();
for (const d of domains) { if (domIds.has(d.id)) errs.push(`duplicate domain id: ${d.id}`); domIds.add(d.id); }
for (const n of nodes) {
  if (nodeIds.has(n.id)) errs.push(`duplicate node id: ${n.id}`);
  if (domIds.has(n.id)) errs.push(`id collides with a domain id: ${n.id} (domains + nodes share one namespace)`);
  nodeIds.add(n.id);
}
const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
// parent must resolve to another NODE (the nesting axis; use `domain` to place a node in a zone), acyclic.
// A self-parent (parent === id) is IGNORED, exactly as the engine's containerOf does — not a cycle error —
// so the validator and the runtime agree on what is shippable.
for (const n of nodes) {
  const par = (n.parent === n.id) ? null : n.parent;   // self-parent → treated as no parent, like the engine
  if (par != null && !byId[par]) errs.push(`node ${n.id}: parent '${par}' is not a node id (use "domain" to put a node in a subsystem zone)`);
  let p = par, seen = new Set([n.id]);
  while (p != null && byId[p]) { if (seen.has(p)) { errs.push(`parent cycle through node ${n.id}`); break; } seen.add(p); p = (byId[p].parent === p) ? null : byId[p].parent; }
  if (n.domain != null && !domIds.has(n.domain)) errs.push(`node ${n.id}: domain '${n.domain}' is not a declared domain`);
}
// every edge endpoint must be a real node id
for (const e of (model.edges || [])) {
  if (!byId[e.from]) errs.push(`edge ${e.from}→${e.to}: 'from' is not a node id`);
  if (!byId[e.to])   errs.push(`edge ${e.from}→${e.to}: 'to' is not a node id`);
}
if (errs.length) { console.error('model is invalid:\n  - ' + errs.join('\n  - ')); process.exit(1); }

// --- completeness gate: a node whose panel would be a one-liner (only `summary`, no `description` and
// no `rows`) is a THIN node. The contract is every node answers name·kind·summary·rows — so thin nodes
// are reported LOUD, and `--strict` makes them fail the build, so a sparse diagram can't ship silently.
const strict = process.argv.includes('--strict');
// THIN = only a one-line summary, no description and no rows. Applies to EVERY node, containers included:
// the detail panel does not enumerate a container's children, so a summary-only owner (even the root
// subject node) still opens near-empty. A grouping node is cheap to describe — so describe it.
const thin = nodes.filter(n => !(n.description && n.description.trim()) && !(n.rows && n.rows.length));
if (thin.length) {
  const list = thin.map(n => `    · ${n.id} (${n.kind || 'no kind'})`).join('\n');
  const msg = `${thin.length}/${nodes.length} node(s) are THIN — only a one-line summary, no description and no rows; their detail panel will be near-empty:\n${list}\n  → give each a fuller \`description\` and \`rows\` (members), per the node contract.`;
  if (strict) { console.error('completeness gate FAILED (--strict): ' + msg); process.exit(1); }
  console.warn('⚠ completeness: ' + msg);
} else {
  console.log(`completeness: all ${nodes.length} nodes carry a description or rows.`);
}

// --- inline the model, replacing the dev fetch loader between the dedicated build markers (NOT prose
// comments — so re-wording the template can't silently change or break what gets stripped) ---
const START = '/*BUILD:REPLACE-START*/';
const END = '/*BUILD:REPLACE-END*/';
const s = engine.indexOf(START), e = engine.indexOf(END);
if (s < 0 || e < 0) { console.error(`build markers (${START} … ${END}) not found in ${enginePath} — is the template intact?`); process.exit(1); }
// escape `</` so a string value containing `</script>` (or `</style>`) can't terminate the inline
// <script> and blank the render — `<\/` is a valid JSON escape for `/` AND valid JS, so the data is
// byte-identical after parse, only the HTML tokenizer is defused.
const safeSpec = specText.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');   // defuse both </script> and <!-- script-data breakouts
const html = engine.slice(0, s) + 'const DATA = ' + safeSpec + ';\n' + engine.slice(e + END.length);
mkdirSync(dirname(resolve(outPath)), { recursive: true });   // create the output dir (parity with shot.mjs) — no raw ENOENT
writeFileSync(resolve(outPath), html);
console.log(`wrote ${outPath} (${html.length} bytes, model ${specText.length} bytes, ${nodes.length} nodes) — one self-contained file`);
