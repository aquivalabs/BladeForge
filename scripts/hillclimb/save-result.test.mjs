// node --test scripts/hillclimb/save-result.test.mjs
//
// save-result.mjs writes the record eval-gate reads, so a defect here un-ships a
// skill without touching the skill. The axes walked: absence (no result.json yet;
// one with no `trigger` key), persistence (every sibling key survives, only
// `trigger` is replaced), and refusal (an incomplete variant or a description that
// moved since the run writes nothing).
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { saveResult } from './save-result.mjs';
import { descriptionHash } from './skill-description.mjs';

const REPO = resolve(new URL('.', import.meta.url).pathname, '..', '..');
const QUERIES = ['a', 'b', 'c', 'd', 'e', 'f'].map((q, i) => ({ query: q, should_trigger: i < 3 }));
const idOf = (q) => `q-${createHash('sha256').update(q).digest('hex').slice(0, 10)}`;

function fixture({ reps = 2, description = 'Use when testing.', prev } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'bf-save-'));
  mkdirSync(join(root, 'scripts'));
  cpSync(join(REPO, 'scripts', 'validate_eval.py'), join(root, 'scripts', 'validate_eval.py'));
  const skill = join(root, 'plugins', 'p', 'skills', 's');
  mkdirSync(join(skill, 'evals'), { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), `---\ndescription: "${description}"\n---\n# s\n`);
  writeFileSync(join(skill, 'evals', 'rubric.json'), JSON.stringify({ trigger: QUERIES, acceptance: ['x'] }));
  if (prev !== undefined) writeFileSync(join(skill, 'evals', 'result.json'), JSON.stringify(prev));
  const flow = join(root, 'flow');
  mkdirSync(join(flow, 'baseline'), { recursive: true });
  const ids = QUERIES.map(q => idOf(q.query));
  writeFileSync(join(flow, '_state.json'), JSON.stringify({
    skill_path: 'plugins/p/skills/s', environment: 'isolated',
    train_ids: ids.slice(0, 4), test_ids: ids.slice(4),
  }));
  const dh = descriptionHash(skill);
  const rows = [];
  for (const q of QUERIES) for (let rep = 0; rep < reps; rep++) {
    const fired = q.should_trigger ? 1 : 0;
    rows.push({
      prompt_id: idOf(q.query), rep, prompt: q.query,
      tags: [q.should_trigger ? 'should-trigger' : 'should-not-trigger'],
      model: 'claude-opus-5-5', grade: { pass: 1, fired }, fired_other: 0, description_hash: dh,
    });
  }
  writeFileSync(join(flow, 'baseline', 'results.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  return { root, skill, flow, rows };
}

const resultOf = (skill) => JSON.parse(readFileSync(join(skill, 'evals', 'result.json'), 'utf8'));

test('absence: writes a fresh record when no result.json exists', () => {
  const f = fixture();
  saveResult(f.flow, 'baseline', { repoRoot: f.root });
  const r = resultOf(f.skill);
  assert.equal(r.trigger.best_score, '12/12');
  assert.equal(r.trigger.cases, 6);
  assert.equal(r.trigger.reps, 2);
  assert.equal(r.trigger.environment, 'isolated');
  assert.equal(r.trigger.test.rows, 4);
  assert.equal(r.acceptance, null);
});

test('absence: a previous record with no trigger key keeps its keys', () => {
  const f = fixture({ prev: { security: { verdict: 'pass' } } });
  saveResult(f.flow, 'baseline', { repoRoot: f.root });
  assert.deepEqual(resultOf(f.skill).security, { verdict: 'pass' });
});

test('persistence: every sibling survives, only trigger is replaced', () => {
  const prev = { trigger: { best_score: 'old' }, security: { verdict: 'pass', scanned_hash: 'h' },
    acceptance: { runner: 'x' }, extra: [1, 2] };
  const f = fixture({ prev });
  saveResult(f.flow, 'baseline', { repoRoot: f.root });
  const r = resultOf(f.skill);
  assert.equal(r.trigger.best_score, '12/12');
  assert.deepEqual(r.security, prev.security);
  assert.deepEqual(r.acceptance, prev.acceptance);
  assert.deepEqual(r.extra, prev.extra);
});

test('hashes: queryset hash matches validate_eval.py, description hash matches the reader', () => {
  const f = fixture();
  saveResult(f.flow, 'baseline', { repoRoot: f.root });
  const r = resultOf(f.skill);
  assert.equal(r.trigger.description_hash, descriptionHash(f.skill));
  assert.match(r.trigger.queryset_hash, /^[0-9a-f]{64}$/);
});

test('refusal: an incomplete variant writes nothing', () => {
  const f = fixture({ reps: 2 });
  writeFileSync(join(f.flow, 'baseline', 'results.jsonl'),
    f.rows.slice(0, -1).map(r => JSON.stringify(r)).join('\n') + '\n');
  assert.throws(() => saveResult(f.flow, 'baseline', { repoRoot: f.root }), /incomplete/);
  assert.equal(existsSync(join(f.skill, 'evals', 'result.json')), false);
});

test('refusal: a description edited after the run writes nothing', () => {
  const f = fixture();
  writeFileSync(join(f.skill, 'SKILL.md'), '---\ndescription: "Use when something else."\n---\n# s\n');
  assert.throws(() => saveResult(f.flow, 'baseline', { repoRoot: f.root }), /Re-measure/);
  assert.equal(existsSync(join(f.skill, 'evals', 'result.json')), false);
});

test('climb: records hillclimb outcome from its own best, verdict from the numbers', () => {
  const f = fixture();
  mkdirSync(join(f.flow, 'v1'));
  writeFileSync(join(f.flow, 'v1', 'results.jsonl'), readFileSync(join(f.flow, 'baseline', 'results.jsonl')));
  const st = JSON.parse(readFileSync(join(f.flow, '_state.json'), 'utf8'));
  writeFileSync(join(f.flow, '_state.json'), JSON.stringify({ ...st, best: { round: 1, test_score: 1 } }));
  saveResult(f.flow, 'v1', { repoRoot: f.root, climb: true });
  const h = resultOf(f.skill).trigger.hillclimb;
  assert.equal(h.final_variant, 'v1');
  assert.equal(h.rounds, 1);
  assert.equal(h.verdict, 'no-headroom');
});

test('climb: refuses a variant hillclimb did not pick, and a flow it never ran', () => {
  const f = fixture();
  assert.throws(() => saveResult(f.flow, 'baseline', { repoRoot: f.root, climb: true }), /hillclimb first/);
  const st = JSON.parse(readFileSync(join(f.flow, '_state.json'), 'utf8'));
  writeFileSync(join(f.flow, '_state.json'), JSON.stringify({ ...st, best: { round: 2 } }));
  assert.throws(() => saveResult(f.flow, 'baseline', { repoRoot: f.root, climb: true }), /recorded v2/);
});
