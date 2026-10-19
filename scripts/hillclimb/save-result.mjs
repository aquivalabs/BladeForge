#!/usr/bin/env node
// Write a measurement into the skill's evals/result.json - the record eval-gate and the
// showcase read.
//   node scripts/hillclimb/save-result.mjs .claude/hillclimb/<flow> <variant> [--climb]
//   node scripts/hillclimb/save-result.mjs --quality <with-flow> <variant> <without-flow> [<variant>]
//
// The first form writes the `trigger` block from a trigger-runner variant. --quality writes
// the `acceptance` block from a quality runner's two arms: the same cases run with the
// skill installed and without it. See saveQuality below.
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
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { CLIMB_VERDICTS, RUNNER, diffScore, readJson, readRows, round, skillHash, splitScore } from './flow-lib.mjs';
import { descriptionHash } from './skill-description.mjs';

export function saveResult(flow, variant, { now = new Date(), repoRoot = resolve(import.meta.dirname, '..', '..'), climb = false } = {}) {
  const st = readJson(join(flow, '_state.json'));
  if (!st.skill_path) throw new Error(`${flow}/_state.json has no skill_path`);
  const skillDir = resolve(repoRoot, st.skill_path);
  const rows = readRows(join(flow, variant, 'results.jsonl'));
  const errors = readRows(join(flow, variant, 'errors.jsonl'));
  if (!rows.length) throw new Error(`${flow}/${variant}: no results.jsonl rows`);

  const rubricPath = join(skillDir, 'evals', 'rubric.json');
  const caseCount = readJson(rubricPath).trigger.length;
  const byId = new Map();
  for (const r of rows) byId.set(r.prompt_id, [...(byId.get(r.prompt_id) ?? []), r]);
  const reps = Math.max(...[...byId.values()].map(v => v.length));
  const short = [...byId.values()].filter(v => v.length !== reps).length;
  if (byId.size !== caseCount || short)
    throw new Error(`${flow}/${variant}: incomplete - ${byId.size}/${caseCount} cases, `
      + `${short} with fewer than ${reps} reps, ${errors.length} error rows. Re-run the runner to resume.`);

  const models = [...new Set(rows.map(r => r.model))];
  if (models.length !== 1) throw new Error(`${flow}/${variant}: rows were served by ${models.join(', ')}`);

  const dnow = descriptionHash(skillDir);
  const dseen = [...new Set(rows.map(r => r.description_hash))];
  if (dseen.length !== 1 || dseen[0] !== dnow)
    throw new Error(`${flow}/${variant}: rows measured description ${dseen.join(', ') || '(none recorded)'}, `
      + `but ${st.skill_path}/SKILL.md now hashes to ${dnow}. Re-measure the current description.`);

  const qhash = execFileSync('python3', [join(repoRoot, 'scripts', 'validate_eval.py'), rubricPath],
    { encoding: 'utf8' }).trim();

  const passed = rows.reduce((s, r) => s + r.grade.pass, 0);
  const results = [...byId.values()].map(v => {
    const triggers = v.reduce((s, r) => s + r.grade.fired, 0);
    const should = v[0].tags?.[0] === 'should-trigger';
    return {
      query: v[0].prompt, should_trigger: should, triggers, runs: v.length,
      trigger_rate: round(triggers / v.length),
      pass: (triggers / v.length >= 0.5) === should,
      fired_other: v.reduce((s, r) => s + (r.fired_other ?? 0), 0),
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
    runner: RUNNER,
    environment: st.environment ?? 'isolated',
    flow_variant: variant,
    cases: byId.size,
    train: splitScore(rows, st.train_ids),
    test: splitScore(rows, st.test_ids),
    method: 'trigger-runner.mjs: the description is copied verbatim into a probe skill in a fresh project, '
      + 'and each query runs as a nested `claude -p` with no user settings, plugins, hooks or MCP. A run '
      + 'counts as TRIGGERED only when the Skill tool fires for that probe. best_score and accuracy are '
      + 'over (case, rep) rows.',
    results,
  };
  if (climb) trigger.hillclimb = climbSummary(flow, variant, st, rows);

  return { dest: writeBlock(skillDir, 'trigger', trigger), trigger };
}

// Every sibling key survives a re-measurement - only the named block is replaced.
// A writer that carried one sibling forward by name once deleted the cerberus
// `security` walk on every re-measure and silently un-shipped the skill.
function writeBlock(skillDir, key, block) {
  const dest = join(skillDir, 'evals', 'result.json');
  let prev = {};
  try {
    const loaded = readJson(dest);
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) prev = loaded;
  } catch { /* absent or unreadable: nothing to carry */ }
  const tmp = `${dest}.tmp`;
  writeFileSync(tmp, JSON.stringify({ acceptance: null, ...prev, [key]: block }, null, 2) + '\n');
  renameSync(tmp, dest);
  return dest;
}

/**
 * The quality record: the same cases run with the skill and without it. Both arms must
 * cover every case in the suite at the same reps on one model, and every row of the with
 * arm must have installed the skill as it is now. The effect, its noise and the verdict come
 * from diffScore in flow-lib.mjs.
 */
export function saveQuality(withFlow, withVariant, withoutFlow, withoutVariant = 'baseline',
  { now = new Date(), repoRoot = resolve(import.meta.dirname, '..', '..') } = {}) {
  const stW = readJson(join(withFlow, '_state.json'));
  const stO = readJson(join(withoutFlow, '_state.json'));
  if (stW.arm !== 'with' || stO.arm !== 'without')
    throw new Error(`arms are ${stW.arm} and ${stO.arm}; pass the "with" flow first, then the "without" flow`);
  for (const k of ['skill_path', 'cases_path'])
    if (!stW[k] || stW[k] !== stO[k]) throw new Error(`the two flows differ in ${k}: ${stW[k]} vs ${stO[k]}`);
  const skillDir = resolve(repoRoot, stW.skill_path);
  const casesFile = resolve(repoRoot, stW.cases_path);
  const ids = readJson(casesFile).cases.map(c => String(c.id));

  const arm = (flow, variant) => {
    const rows = readRows(join(flow, variant, 'results.jsonl'));
    const byId = new Map();
    for (const r of rows) byId.set(r.prompt_id, (byId.get(r.prompt_id) ?? 0) + 1);
    const reps = Math.max(0, ...byId.values());
    const missing = ids.filter(id => byId.get(id) !== reps);
    if (!rows.length || missing.length || byId.size !== ids.length)
      throw new Error(`${flow}/${variant}: incomplete - ${byId.size}/${ids.length} cases, `
        + `${missing.length} without ${reps} reps. Re-run the runner to resume.`);
    return { rows, reps, all: splitScore(rows, ids) };
  };
  const w = arm(withFlow, withVariant);
  const o = arm(withoutFlow, withoutVariant);
  if (w.reps !== o.reps) throw new Error(`reps differ: ${w.reps} with the skill, ${o.reps} without`);
  const models = [...new Set([...w.rows, ...o.rows].map(r => r.model))];
  if (models.length !== 1) throw new Error(`rows were served by ${models.join(', ')}`);

  const current = skillHash(skillDir);
  const seen = [...new Set(w.rows.map(r => r.skill_hash))];
  if (seen.length !== 1 || seen[0] !== current)
    throw new Error(`${withFlow}/${withVariant}: rows installed skill ${seen.join(', ') || '(none recorded)'}, `
      + `but ${stW.skill_path} now hashes to ${current}. Re-measure the current skill.`);

  const { effect, noise, verdict } = diffScore(w.all, o.all);

  const acceptance = {
    measured_at: now.toISOString().slice(0, 19),
    model: models[0],
    runner: stW.harness_paths?.[0] ?? null,
    eval_type: 'quality-with-vs-without',
    cases: ids.length,
    reps: w.reps,
    with_skill: w.all,
    without_skill: o.all,
    effect,
    noise,
    verdict,
    test: { with_skill: splitScore(w.rows, stW.test_ids), without_skill: splitScore(o.rows, stO.test_ids) },
    skill_hash: current,
    cases_hash: createHash('sha256').update(readFileSync(casesFile)).digest('hex'),
    flows: { with: withVariant, without: withoutVariant },
    method: 'The same cases run as nested `claude -p` sessions in a fixture repository, once with the skill '
      + 'installed and once without; a programmatic grader reads what the agent left. effect is the '
      + 'difference of the two pass rates over (case, rep) rows; noise is the half-width of that difference.',
  };
  return { dest: writeBlock(skillDir, 'acceptance', acceptance), acceptance };
}

// The verdict follows from the numbers alone, so no one can talk a result up.
// noise is the baseline test interval; a gain or loss inside it is not one.
// The winner and the round count are hillclimb's own records, never re-derived here.
function climbSummary(flow, variant, st, finalRows) {
  if (st.best?.round == null) throw new Error(`${flow}/_state.json has no best.round - run /claude-api hillclimb first`);
  const winner = st.best.round === 0 ? 'baseline' : `v${st.best.round}`;
  if (winner !== variant) throw new Error(`hillclimb recorded ${winner} as best, not ${variant}`);
  const baseRows = variant === 'baseline' ? finalRows : readRows(join(flow, 'baseline', 'results.jsonl'));
  const base = splitScore(baseRows, st.test_ids);
  const fin = splitScore(finalRows, st.test_ids);
  if (!base.rows || !fin.rows) throw new Error(`${flow}: no test rows for baseline or ${variant}`);
  const noise = base.ci_half_width;
  const delta = fin.mean - base.mean;
  const verdict = 1 - base.mean < noise ? 'no-headroom'
    : delta > noise ? 'improved'
    : delta < -noise ? 'regressed'
    : 'within-noise';
  if (!CLIMB_VERDICTS.includes(verdict)) throw new Error(`unknown verdict ${verdict}`);
  // hillclimb records its own round counter; the v<N> dirs are the fallback for a
  // state file that predates it.
  const rounds = st.current_round ?? readdirSync(flow).filter(d => /^v[1-9]\d*$/.test(d)).length;
  return { baseline_test: base.mean, final_test: fin.mean, final_variant: variant, rounds, noise, verdict };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    climb: { type: 'boolean', default: false }, quality: { type: 'boolean', default: false } } });
  const [flow, variant] = positionals;
  if (!flow || !variant || (values.quality && !positionals[2])) {
    console.error('usage: node save-result.mjs <flow-dir> <variant> [--climb]\n'
      + '       node save-result.mjs --quality <with-flow> <variant> <without-flow> [<variant>]');
    process.exit(2);
  }
  try {
    if (values.quality) {
      const { dest, acceptance: a } = saveQuality(flow, variant, positionals[2], positionals[3]);
      console.log(`saved ${dest}: with ${a.with_skill.mean} ±${a.with_skill.ci_half_width}, `
        + `without ${a.without_skill.mean} ±${a.without_skill.ci_half_width}, effect ${a.effect} ±${a.noise} (${a.verdict})`);
      process.exit(0);
    }
    const { dest, trigger } = saveResult(flow, variant, { climb: values.climb });
    console.log(`saved ${dest}: ${trigger.best_score} (test ${trigger.test.mean} ±${trigger.test.ci_half_width})`
      + (trigger.hillclimb ? `, climb ${trigger.hillclimb.verdict}: ${trigger.hillclimb.baseline_test} -> ${trigger.hillclimb.final_test} in ${trigger.hillclimb.rounds} round(s)` : ''));
  } catch (e) {
    console.error(`refusing to save: ${e.message}`);
    process.exit(1);
  }
}
