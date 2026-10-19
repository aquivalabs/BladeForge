#!/usr/bin/env node
// Recompute a variant's train and test pass rates from its raw results.jsonl,
// so a reported number never comes from an aggregate field.
//   node scripts/hillclimb/split-scores.mjs .claude/hillclimb/<flow> <variant>
// Prints JSON: per-split mean of grade.pass over (case, rep) rows, row and case
// counts, the binary-CI half-width 1/sqrt(n_rows), and the error-row count.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [flow, variant] = process.argv.slice(2);
if (!flow || !variant) {
  console.error('usage: node split-scores.mjs <flow-dir> <variant>');
  process.exit(2);
}
const st = JSON.parse(readFileSync(join(flow, '_state.json'), 'utf8'));
const readRows = (file) => existsSync(file)
  ? readFileSync(file, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
  : [];
const rows = readRows(join(flow, variant, 'results.jsonl'));
const errors = readRows(join(flow, variant, 'errors.jsonl'));

function split(ids) {
  const set = new Set(ids.map(String));
  const mine = rows.filter(r => set.has(String(r.prompt_id)));
  const n = mine.length;
  const mean = n ? mine.reduce((s, r) => s + Number(r.grade?.pass ?? 0), 0) / n : null;
  return {
    mean: mean == null ? null : Number(mean.toFixed(3)),
    rows: n,
    cases: new Set(mine.map(r => r.prompt_id)).size,
    ci_half_width: n ? Number((1 / Math.sqrt(n)).toFixed(3)) : null,
  };
}

console.log(JSON.stringify({
  variant,
  train: split(st.train_ids ?? []),
  test: split(st.test_ids ?? []),
  total_rows: rows.length,
  error_rows: errors.length,
  fired_other_rows: rows.filter(r => r.fired_other).length,
}, null, 2));
