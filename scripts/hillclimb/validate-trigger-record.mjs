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
// The contract itself lives in flow-lib.mjs, shared with the writer.
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { CLIMB_VERDICTS, ENVIRONMENTS, MODEL, RUNNER, readJson } from './flow-lib.mjs';

export function problemWith(record, { isNew = false } = {}) {
  const t = record?.trigger;
  if (!t || typeof t !== 'object') return 'no trigger record';
  if (t.runner !== RUNNER)
    return `measured by ${t.runner ?? 'an older scorer'}, not ${RUNNER} — remeasure with meta:skill-eval`;
  if (!ENVIRONMENTS.includes(t.environment)) return `environment is ${t.environment ?? 'missing'}, not isolated or crowded`;
  if (t.model !== MODEL) return `measured on ${t.model ?? 'an unrecorded model'}, not ${MODEL}`;
  if (!Number.isInteger(t.cases) || !Number.isInteger(t.runs_per_query)) return 'record lacks its case count or reps';
  if (typeof t.test?.ci_half_width !== 'number' || typeof t.test?.mean !== 'number')
    return 'record lacks the test-split score with its interval';
  if (isNew) {
    const h = t.hillclimb;
    if (!h) return 'a new skill needs a hillclimb record — run /claude-api hillclimb, then save-result.mjs --climb';
    if (!CLIMB_VERDICTS.includes(h.verdict)) return `hillclimb verdict is ${h.verdict ?? 'missing'}`;
  }
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { new: { type: 'boolean', default: false } } });
  if (positionals.length !== 1) {
    console.error('usage: node validate-trigger-record.mjs <result.json> [--new]');
    process.exit(2);
  }
  let record;
  try { record = readJson(positionals[0]); } catch (e) {
    console.log(e.code === 'ENOENT' ? 'no evals/result.json' : 'result.json is not valid JSON');
    process.exit(1);
  }
  const p = problemWith(record, { isNew: values.new });
  if (p) { console.log(p); process.exit(1); }
}
