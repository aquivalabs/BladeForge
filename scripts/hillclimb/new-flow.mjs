#!/usr/bin/env node
// Create a trigger-runner flow dir for one skill: `_state.json` with a seeded,
// stratified train/test split over the skill's rubric trigger cases.
//   node scripts/hillclimb/new-flow.mjs <skill-dir> [--crowded] [--flow <dir>]
// Default flow dir: .claude/hillclimb/<plugin>-<skill>-trigger (or -crowded).
// The split is random by a fixed seed and stratified by polarity, never chosen
// by score, and it is written once: an existing _state.json is never overwritten.
//
// Harness approval is reused, never granted: when another flow already holds a
// human-recorded harness_sha for byte-identical harness code, the new flow copies
// it. Otherwise the runner refuses until the maintainer runs --approve-harness.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { approvedSha, harnessSha } from './harness-sha.mjs';

const SEED = 20261016;
const argv = process.argv.slice(2);
const skillArg = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--flow');
const crowded = argv.includes('--crowded');
if (!skillArg) {
  console.error('usage: node new-flow.mjs <skill-dir> [--crowded] [--flow <dir>]');
  process.exit(2);
}
const skill = resolve(skillArg);
const parts = skill.split('/');
const name = `${parts.at(-3)}-${parts.at(-1)}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
const fi = argv.indexOf('--flow');
const flow = fi >= 0 ? argv[fi + 1] : join('.claude', 'hillclimb', `${name}-${crowded ? 'crowded' : 'trigger'}`);
const statePath = join(flow, '_state.json');
if (existsSync(statePath)) {
  console.error(`${statePath} already exists - a split is fixed once and never re-drawn`);
  process.exit(1);
}

const trigger = JSON.parse(readFileSync(join(skill, 'evals', 'rubric.json'), 'utf8')).trigger;
const cases = trigger.map(q => ({
  id: `q-${createHash('sha256').update(q.query).digest('hex').slice(0, 10)}`,
  pos: Boolean(q.should_trigger),
}));
let s = SEED;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const train = [], test = [];
for (const pos of [true, false]) {
  const ids = cases.filter(c => c.pos === pos).map(c => c.id).sort()
    .map(id => [rnd(), id]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const k = Math.round(ids.length * 2 / 3);
  train.push(...ids.slice(0, k));
  test.push(...ids.slice(k));
}

const HARNESS = ['scripts/hillclimb/trigger-runner.mjs', 'scripts/hillclimb/skill-description.mjs'];
const sha = harnessSha(HARNESS);
const approvedIn = approvedSha(sha);

mkdirSync(flow, { recursive: true });
writeFileSync(statePath, JSON.stringify({
  skill_path: relative(process.cwd(), skill),
  environment: crowded ? 'crowded' : 'isolated',
  split_seed: SEED,
  goal: { target: 'pass', direction: 'higher', hold: [] },
  approve_each_round: false,
  train_ids: train,
  test_ids: test,
  harness_paths: HARNESS,
  ...(approvedIn ? { harness_sha: sha } : {}),
  metrics: [{ id: 'pass', kind: 'binary', label: 'Pass' }, { id: 'fired', kind: 'binary', label: 'Fired' }],
}, null, 2) + '\n');
console.log(`${flow}: ${cases.length} cases (${cases.filter(c => c.pos).length} should-trigger), `
  + `train ${train.length} / test ${test.length}, ${crowded ? 'crowded' : 'isolated'}`);
console.log(approvedIn
  ? `harness approval reused from ${approvedIn} (same code, sha ${sha.slice(0, 12)})`
  : `harness not yet approved for this code (sha ${sha.slice(0, 12)}): the maintainer runs the first runner command with --approve-harness`);
