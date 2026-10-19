#!/usr/bin/env node
// Print a variant's train and test pass rates, recomputed from its raw results.jsonl
// with the same splitScore save-result.mjs records, so the two never disagree.
//   node scripts/hillclimb/split-scores.mjs .claude/hillclimb/<flow> <variant>
import { join } from 'node:path';
import { readJson, readRows, splitScore } from './flow-lib.mjs';

const [flow, variant] = process.argv.slice(2);
if (!flow || !variant) {
  console.error('usage: node split-scores.mjs <flow-dir> <variant>');
  process.exit(2);
}
const st = readJson(join(flow, '_state.json'));
const rows = readRows(join(flow, variant, 'results.jsonl'));
console.log(JSON.stringify({
  variant,
  train: splitScore(rows, st.train_ids),
  test: splitScore(rows, st.test_ids),
  total_rows: rows.length,
  error_rows: readRows(join(flow, variant, 'errors.jsonl')).length,
  fired_other_rows: rows.filter(r => r.fired_other).length,
}, null, 2));
