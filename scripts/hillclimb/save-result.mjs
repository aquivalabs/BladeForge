#!/usr/bin/env node
// Write a trigger-runner variant's measurement into the skill's evals/result.json
// `trigger` block - the record eval-gate and the showcase read.
//   node scripts/hillclimb/save-result.mjs .claude/hillclimb/<flow> <variant> [--climb]
//
// --climb also records how a `/claude-api hillclimb` run went, as `trigger.hillclimb`:
// the baseline and final test scores, the rounds run, the noise, and a verdict computed
// from those numbers. The loop itself is Anthropic's; this only translates its outcome
// into the record the gate reads. <variant> must be the winner hillclimb recorded in
// `_state.json.best`. eval-gate demands the block for a skill that is new in the PR.
//
// Every number is recomputed from the variant's raw results.jsonl. The record is
// keyed by two hashes: the queryset hash from scripts/validate_eval.py (the same
// program eval-gate asks) and the description hash from skill-description.mjs (the
// same reader the runner measured with). Editing either input marks the record stale.
//
// Refuses, writing nothing, when the variant is incomplete, mixes models, or was
// measured against a description other than the one SKILL.md holds now.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { descriptionHash } from './skill-description.mjs';

const HERE = new URL('.', import.meta.url).pathname;

export function saveResult(flow, variant, { now = new Date(), repoRoot = resolve(HERE, '..', '..'), climb = false } = {}) {
  const st = JSON.parse(readFileSync(join(flow, '_state.json'), 'utf8'));
  if (!st.skill_path) throw new Error(`${flow}/_state.json has no skill_path`);
  const skillDir = resolve(repoRoot, st.skill_path);
  const readRows = (f) => existsSync(f)
    ? readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
    : [];
  const rows = readRows(join(flow, variant, 'results.jsonl'));
  const errors = readRows(join(flow, variant, 'errors.jsonl'));
  if (!rows.length) throw new Error(`${flow}/${variant}: no results.jsonl rows`);

  const rubricPath = join(skillDir, 'evals', 'rubric.json');
  const rubric = JSON.parse(readFileSync(rubricPath, 'utf8')).trigger;
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.prompt_id)) byId.set(r.prompt_id, []);
    byId.get(r.prompt_id).push(r);
  }
  const reps = Math.max(...[...byId.values()].map(v => v.length));
  const short = [...byId.entries()].filter(([, v]) => v.length !== reps).map(([k]) => k);
  if (byId.size !== rubric.length || short.length)
    throw new Error(`${flow}/${variant}: incomplete - ${byId.size}/${rubric.length} cases, `
      + `${short.length} with fewer than ${reps} reps, ${errors.length} error rows. Re-run the runner to resume.`);

  const models = [...new Set(rows.map(r => r.model))];
  if (models.length !== 1) throw new Error(`${flow}/${variant}: rows were served by ${models.join(', ')}`);

  const dnow = descriptionHash(skillDir);
  const dseen = [...new Set(rows.map(r => r.description_hash))];
  if (dseen.length !== 1 || dseen[0] !== dnow)
    throw new Error(`${flow}/${variant}: rows measured description ${dseen.join(', ') || '(none recorded)'}, `
      + `but ${st.skill_path}/SKILL.md now hashes to ${dnow}. Re-measure the current description.`);

  const qhash = execFileSync('python3', [join(repoRoot, 'scripts', 'validate_eval.py'), rubricPath],
    { encoding: 'utf8' }).trim();

  const split = (ids) => {
    const set = new Set((ids ?? []).map(String));
    const mine = rows.filter(r => set.has(String(r.prompt_id)));
    const n = mine.length;
    return {
      cases: new Set(mine.map(r => r.prompt_id)).size, rows: n,
      mean: n ? round(mine.reduce((s, r) => s + Number(r.grade.pass), 0) / n) : null,
      ci_half_width: n ? round(1 / Math.sqrt(n)) : null,
    };
  };
  const passed = rows.reduce((s, r) => s + Number(r.grade.pass), 0);
  const results = [...byId.values()].map(v => {
    const triggers = v.reduce((s, r) => s + Number(r.grade.fired), 0);
    const should = v[0].tags?.[0] === 'should-trigger';
    return {
      query: v[0].prompt, should_trigger: should, triggers, runs: v.length,
      trigger_rate: round(triggers / v.length),
      pass: (triggers / v.length >= 0.5) === should,
      fired_other: v.reduce((s, r) => s + Number(r.fired_other ?? 0), 0),
    };
  });

  const trigger = {
    skill: basename(skillDir),
    measured_at: now.toISOString().slice(0, 19),
    model: models[0],
    runs_per_query: reps,
    best_score: `${passed}/${rows.length}`,
    accuracy: round(passed / rows.length),
    baseline_accuracy: null,
    description_hash: dnow,
    queryset_hash: qhash,
    eval_type: 'description-triggering',
    runner: 'scripts/hillclimb/trigger-runner.mjs',
    environment: st.environment ?? 'isolated',
    flow_variant: variant,
    cases: byId.size,
    reps,
    train: split(st.train_ids),
    test: split(st.test_ids),
    method: 'trigger-runner.mjs: the description is copied verbatim into a probe skill in a fresh project, '
      + 'and each query runs as a nested `claude -p` with no user settings, plugins, hooks or MCP. A run '
      + 'counts as TRIGGERED only when the Skill tool fires for that probe. best_score and accuracy are '
      + 'over (case, rep) rows.',
    results,
  };
  if (climb) trigger.hillclimb = climbSummary(flow, variant, st, readRows, split);

  // Every sibling key survives a re-measurement - only `trigger` is replaced.
  // A writer that carried one sibling forward by name once deleted the cerberus
  // `security` walk on every re-measure and silently un-shipped the skill.
  const dest = join(skillDir, 'evals', 'result.json');
  let prev = {};
  if (existsSync(dest)) {
    try {
      const loaded = JSON.parse(readFileSync(dest, 'utf8'));
      if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) prev = loaded;
    } catch { prev = {}; }
  }
  const out = { ...prev, trigger };
  if (!('acceptance' in out)) out.acceptance = null;
  const tmp = `${dest}.tmp`;
  writeFileSync(tmp, JSON.stringify(out, null, 2) + '\n');
  renameSync(tmp, dest);
  return { dest, trigger };
}

function round(x) { return Number(x.toFixed(3)); }

// The verdict follows from the numbers alone, so no one can talk a result up.
// noise is the baseline test interval; a gain or loss inside it is not one.
export const CLIMB_VERDICTS = ['improved', 'within-noise', 'regressed', 'no-headroom'];
function climbSummary(flow, variant, st, readRows, split) {
  // The winner is hillclimb's call, recorded in _state.json.best; never pick it here.
  if (st.best?.round == null) throw new Error(`${flow}/_state.json has no best.round - run /claude-api hillclimb first`);
  const winner = st.best.round === 0 ? 'baseline' : `v${st.best.round}`;
  if (winner !== variant) throw new Error(`hillclimb recorded ${winner} as best, not ${variant}`);
  const testOf = (v) => {
    const rows = readRows(join(flow, v, 'results.jsonl'));
    const set = new Set((st.test_ids ?? []).map(String));
    const mine = rows.filter(r => set.has(String(r.prompt_id)));
    if (!mine.length) throw new Error(`${flow}/${v}: no test rows`);
    return { mean: mine.reduce((a, r) => a + Number(r.grade.pass), 0) / mine.length, n: mine.length };
  };
  const base = testOf('baseline');
  const fin = testOf(variant);
  const noise = 1 / Math.sqrt(base.n);
  const rounds = readdirSync(flow).filter(d => /^v[1-9]\d*$/.test(d)
    && existsSync(join(flow, d, 'results.jsonl'))).length;
  const delta = fin.mean - base.mean;
  const verdict = 1 - base.mean < noise ? 'no-headroom'
    : delta > noise ? 'improved'
    : delta < -noise ? 'regressed'
    : 'within-noise';
  return {
    baseline_test: round(base.mean), final_test: round(fin.mean), final_variant: variant,
    rounds, noise: round(noise), verdict,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const climb = args.includes('--climb');
  const [flow, variant] = args.filter(a => a !== '--climb');
  if (!flow || !variant) {
    console.error('usage: node save-result.mjs <flow-dir> <variant> [--climb]');
    process.exit(2);
  }
  try {
    const { dest, trigger } = saveResult(flow, variant, { climb });
    console.log(`saved ${dest}: ${trigger.best_score} (test ${trigger.test.mean} ±${trigger.test.ci_half_width})`
      + (trigger.hillclimb ? `, climb ${trigger.hillclimb.verdict}: ${trigger.hillclimb.baseline_test} -> ${trigger.hillclimb.final_test} in ${trigger.hillclimb.rounds} round(s)` : ''));
  } catch (e) {
    console.error(`refusing to save: ${e.message}`);
    process.exit(1);
  }
}
