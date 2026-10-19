// node --test scripts/hillclimb/routing.test.mjs
//
// The routing set and its report decide which skill "steals" from which, so the seeding rules and
// the scoring are pinned here: ownership from the rubrics, a query two rubrics claim left out, a
// slot that never moves, and a score that counts cases with a majority of passing reps.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { seed, splitOf } from './build-routing.mjs';
import { routingReport } from './routing-report.mjs';

test('seed: a should-trigger query is owned; a should-not query becomes none with not', () => {
  const { cases, contested } = seed([
    { owner: 'p:a', query: 'do a', should_trigger: true },
    { owner: 'p:a', query: 'do b', should_trigger: false },
    { owner: 'p:b', query: 'do b', should_trigger: true },
    { owner: 'p:a', query: 'nobody', should_trigger: false },
  ]);
  assert.equal(contested.length, 0);
  const by = Object.fromEntries(cases.map(c => [c.query, c]));
  assert.equal(by['do a'].owner, 'p:a');
  assert.equal(by['do b'].owner, 'p:b', 'a sibling claim wins over a should-not');
  assert.deepEqual([by.nobody.owner, by.nobody.not], ['none', 'p:a']);
});

test('seed: a query two rubrics both claim is left out and reported', () => {
  const { cases, contested } = seed([
    { owner: 'p:a', query: 'same', should_trigger: true },
    { owner: 'p:b', query: 'same', should_trigger: true },
  ]);
  assert.equal(cases.length, 0);
  assert.deepEqual(contested[0].owners, ['p:a', 'p:b']);
});

test('split: the slot comes from the id alone, so it never moves', () => {
  assert.equal(splitOf('q-0123456789'), splitOf('q-0123456789'));
  const slots = new Set(Array.from({ length: 200 }, (_, i) => splitOf(`q-${i}`)));
  assert.deepEqual([...slots].sort(), ['test', 'train']);
});

test('report: a case passes on a majority of its reps, and steals are counted per run', () => {
  const cases = [{ id: 'x', owner: 'p:a' }, { id: 'y', owner: 'p:a' }];
  const rows = [
    { prompt_id: 'x', grade: { pass: 1 }, routed: 'p-a' }, { prompt_id: 'x', grade: { pass: 1 }, routed: 'p-a' }, { prompt_id: 'x', grade: { pass: 0 }, routed: 'p-b' },
    { prompt_id: 'y', grade: { pass: 0 }, routed: 'p-b' }, { prompt_id: 'y', grade: { pass: 0 }, routed: null }, { prompt_id: 'y', grade: { pass: 1 }, routed: 'p-a' },
  ];
  const { score, confusion } = routingReport(rows, cases);
  assert.deepEqual(score, [{ owner: 'p:a', cases: 2, mean: 0.5, ci_half_width: 0.707 }]);
  assert.deepEqual(confusion, [{ pair: 'p:a -> p-b', runs: 2 }, { pair: 'p:a -> nothing', runs: 1 }]);
});
