import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemWith, atCeiling } from './validate-trigger-record.mjs';
import { ENVIRONMENTS, MODEL, RUNNER } from './flow-lib.mjs';

const record = (test, extra = {}) => ({ trigger: { runner: RUNNER, environment: ENVIRONMENTS[0], model: MODEL, cases: 15, runs_per_query: 5, test, ...extra } });

test('a new skill at the ceiling needs no hillclimb record; one with headroom still does', () => {
  assert.equal(atCeiling({ mean: 1, ci_half_width: 0.2 }), true);
  assert.equal(atCeiling({ mean: 0.84, ci_half_width: 0.2 }), true);
  assert.equal(atCeiling({ mean: 0.7, ci_half_width: 0.2 }), false);
  assert.equal(problemWith(record({ mean: 1, ci_half_width: 0.2 }), { isNew: true }), null);
  assert.match(problemWith(record({ mean: 0.6, ci_half_width: 0.2 }), { isNew: true }), /needs a hillclimb record/);
  assert.equal(problemWith(record({ mean: 0.6, ci_half_width: 0.2 }, { hillclimb: { verdict: 'improved' } }), { isNew: true }), null);
  assert.match(problemWith(record({ mean: 1, ci_half_width: 0.2 }, { hillclimb: { verdict: 'nonsense' } }), { isNew: true }), /verdict is nonsense/);
  assert.equal(problemWith(record({ mean: 0.6, ci_half_width: 0.2 })), null);
});
