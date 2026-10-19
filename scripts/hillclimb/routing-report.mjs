#!/usr/bin/env node
// Read a routing-runner variant: a score per owner skill, and the pairs of skills that take each
// other's queries.
//   node scripts/hillclimb/routing-report.mjs .claude/hillclimb/<flow> <variant> [--split test]
//
// Every row is graded again from its saved `routed` with routingPass, so an `accept` a person adds
// later applies to rows measured before it.
// A score counts CASES: a case passes when most of its reps passed, and the interval is 1/sqrt(n)
// over those cases, because the reps of one query are not independent draws. The confusion lines
// list, for queries an owner should have taken, which skill got them instead.
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { readJson, readRows, round, routingPass } from './flow-lib.mjs';

export function routingReport(rows, cases) {
  const byId = new Map(cases.map(c => [c.id, c]));
  const perCase = new Map();
  for (const r of rows) perCase.set(r.prompt_id, [...(perCase.get(r.prompt_id) ?? []), r]);
  const owners = new Map(), steals = new Map();
  for (const [id, rs] of perCase) {
    const c = byId.get(id);
    if (!c) continue;
    const key = c.owner === 'none' ? `none (not ${c.not})` : c.owner;
    const ok = (r) => routingPass(c, r.routed ?? null);
    const pass = rs.filter(ok).length * 2 > rs.length;
    const o = owners.get(key) ?? { cases: 0, passed: 0 };
    o.cases++; o.passed += pass ? 1 : 0;
    owners.set(key, o);
    if (c.owner !== 'none') for (const r of rs) if (!ok(r)) {
      const k = `${c.owner} -> ${r.routed ?? 'nothing'}`;
      steals.set(k, (steals.get(k) ?? 0) + 1);
    }
  }
  const score = [...owners].map(([owner, o]) => ({ owner, cases: o.cases, mean: round(o.passed / o.cases), ci_half_width: round(1 / Math.sqrt(o.cases)) }))
    .sort((a, b) => a.mean - b.mean || b.cases - a.cases);
  return { score, confusion: [...steals].sort((a, b) => b[1] - a[1]).map(([pair, runs]) => ({ pair, runs })) };
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { split: { type: 'string' } } });
  const [flow, variant] = positionals;
  if (!flow || !variant) { console.error('usage: node routing-report.mjs <flow-dir> <variant> [--split train|test]'); process.exit(2); }
  const cases = readJson('evals/routing.json').cases.filter(c => !values.split || c.split === values.split);
  const { score, confusion } = routingReport(readRows(join(flow, variant, 'results.jsonl')), cases);
  for (const s of score) console.log(`${s.mean.toFixed(2)} ±${s.ci_half_width.toFixed(2)}  ${String(s.cases).padStart(3)} cases  ${s.owner}`);
  if (confusion.length) console.log('\nqueries taken by the wrong skill (runs):');
  for (const c of confusion) console.log(`${String(c.runs).padStart(4)}  ${c.pair}`);
}
