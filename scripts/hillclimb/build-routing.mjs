#!/usr/bin/env node
// Seed or grow evals/routing.json, the shared routing set: one query, one owner, across the whole
// marketplace. A crowded run installs every skill, so one pass over this set measures which skill
// each query reaches - phase 2b of docs/plans/eval-hillclimb-migration.md.
//   node scripts/hillclimb/build-routing.mjs            # add what the rubrics hold and the set lacks
//   node scripts/hillclimb/build-routing.mjs --check    # exit 1 if a rubric holds a query the set lacks
//
// A case is { id, query, owner, split, source }, plus `not` on a case owned by "none". `owner` is
// `<plugin>:<skill>`. Seeding: a rubric's should-trigger query is owned by that skill. Its
// should-not-trigger query is owned by "none" with `not` naming that skill, unless another rubric
// claims it: the case then passes when that skill does not take it, whoever else does. A query two rubrics both
// claim is left out and reported - a person decides its owner.
//
// The freeze rule: an existing case is never edited or deleted, only added to. A new case gets its
// train or test slot from a hash of the seed and its id, so the slot is random but never moves.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { caseId, readJson } from './flow-lib.mjs';

export const ROUTING = 'evals/routing.json';
const SEED = 20261019;
const TEST_SHARE = 0.3;

/** Every skill's rubric trigger queries, as { owner, query, should_trigger }. */
function rubricQueries(root) {
  const out = [];
  for (const p of readdirSync(join(root, 'plugins')).sort()) {
    const sk = join(root, 'plugins', p, 'skills');
    if (!existsSync(sk)) continue;
    for (const s of readdirSync(sk).sort()) {
      const rubric = join(sk, s, 'evals', 'rubric.json');
      if (!existsSync(rubric)) continue;
      for (const q of readJson(rubric).trigger ?? []) out.push({ owner: `${p}:${s}`, query: q.query, should_trigger: Boolean(q.should_trigger) });
    }
  }
  return out;
}

export function splitOf(id) {
  const x = parseInt(createHash('sha256').update(`${SEED}:${id}`).digest('hex').slice(0, 8), 16) / 0xffffffff;
  return x < TEST_SHARE ? 'test' : 'train';
}

/** The cases the rubrics imply, and the queries two rubrics both claim. */
export function seed(queries) {
  const claims = new Map();
  for (const q of queries) if (q.should_trigger) claims.set(q.query, [...(claims.get(q.query) ?? []), q.owner]);
  const cases = new Map(), contested = [];
  for (const [query, owners] of claims) {
    const uniq = [...new Set(owners)];
    if (uniq.length > 1) { contested.push({ query, owners: uniq }); continue; }
    cases.set(query, { owner: uniq[0], source: uniq[0] });
  }
  for (const q of queries) if (!q.should_trigger && !claims.has(q.query) && !cases.has(q.query))
    cases.set(q.query, { owner: 'none', source: q.owner });
  return {
    cases: [...cases].map(([query, c]) => {
      const id = caseId(query);
      return { id, query, owner: c.owner, ...(c.owner === 'none' ? { not: c.source } : {}), split: splitOf(id), source: `rubric:${c.source}` };
    }),
    contested,
  };
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
  const root = process.cwd();
  const file = join(root, ROUTING);
  const prev = existsSync(file) ? readJson(file) : { seed: SEED, test_share: TEST_SHARE, cases: [] };
  const have = new Set(prev.cases.map(c => c.id));
  const { cases, contested } = seed(rubricQueries(root));
  const added = cases.filter(c => !have.has(c.id));
  for (const c of contested) console.error(`contested, left out: "${c.query}" claimed by ${c.owners.join(', ')}`);
  if (values.check) {
    if (added.length) { console.error(`${added.length} rubric quer(ies) missing from ${ROUTING}; run build-routing.mjs`); process.exit(1); }
    console.log(`${ROUTING}: ${prev.cases.length} cases, nothing missing`);
  } else {
    const next = { ...prev, cases: [...prev.cases, ...added] };
    writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    const by = (k) => next.cases.reduce((m, c) => (m[c[k]] = (m[c[k]] ?? 0) + 1, m), {});
    console.log(`${ROUTING}: +${added.length}, ${next.cases.length} cases (${JSON.stringify(by('split'))}); none-owned ${by('owner').none ?? 0}`);
  }
}
