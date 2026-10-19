#!/usr/bin/env node
// Check that a skill's evals/result.json `trigger` record is one the gate can trust.
//   node scripts/hillclimb/validate-trigger-record.mjs <result.json> [--new]
// Exit 0 when it is, exit 1 with a one-line reason when it is not.
//
// Freshness (the two hashes) is eval-gate's own check; this one asks where the
// numbers came from and whether they carry their noise:
//   - the record was written by save-result.mjs from trigger-runner.mjs, in the
//     isolated or crowded environment, on the model the team measures on;
//   - it carries the case count, the reps and the test-split interval;
//   - with --new (a skill added in this change), it also carries a `hillclimb`
//     block with one of the verdicts save-result.mjs computes.
// A record from the deleted score-description.py fails the first check by design.
import { existsSync, readFileSync } from 'node:fs';

export const MODEL = 'claude-opus-5-5';
export const RUNNER = 'scripts/hillclimb/trigger-runner.mjs';
const ENVIRONMENTS = ['isolated', 'crowded'];
const VERDICTS = ['improved', 'within-noise', 'regressed', 'no-headroom'];

export function problemWith(record, { isNew = false } = {}) {
  const t = record?.trigger;
  if (!t || typeof t !== 'object') return 'no trigger record';
  if (t.runner !== RUNNER)
    return `measured by ${t.runner ?? 'an older scorer'}, not ${RUNNER} — remeasure with meta:skill-eval`;
  if (!ENVIRONMENTS.includes(t.environment)) return `environment is ${t.environment ?? 'missing'}, not isolated or crowded`;
  if (t.model !== MODEL) return `measured on ${t.model ?? 'an unrecorded model'}, not ${MODEL}`;
  if (!Number.isInteger(t.cases) || !Number.isInteger(t.reps)) return 'record lacks its case count or reps';
  if (typeof t.test?.ci_half_width !== 'number' || typeof t.test?.mean !== 'number')
    return 'record lacks the test-split score with its interval';
  if (isNew) {
    const h = t.hillclimb;
    if (!h) return 'a new skill needs a hillclimb record — run /claude-api hillclimb, then save-result.mjs --climb';
    if (!VERDICTS.includes(h.verdict)) return `hillclimb verdict is ${h.verdict ?? 'missing'}`;
  }
  return null;
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2);
  const file = args.find(a => a !== '--new');
  if (!file) {
    console.error('usage: node validate-trigger-record.mjs <result.json> [--new]');
    process.exit(2);
  }
  if (!existsSync(file)) { console.log('no evals/result.json'); process.exit(1); }
  let record;
  try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { console.log('result.json is not valid JSON'); process.exit(1); }
  const p = problemWith(record, { isNew: args.includes('--new') });
  if (p) { console.log(p); process.exit(1); }
}
