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
import { readdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { CLIMB_VERDICTS, RUNNER, readJson, readRows, round, splitScore } from './flow-lib.mjs';
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

  // Every sibling key survives a re-measurement - only `trigger` is replaced.
  // A writer that carried one sibling forward by name once deleted the cerberus
  // `security` walk on every re-measure and silently un-shipped the skill.
  const dest = join(skillDir, 'evals', 'result.json');
  let prev = {};
  try {
    const loaded = readJson(dest);
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) prev = loaded;
  } catch { /* absent or unreadable: nothing to carry */ }
  const tmp = `${dest}.tmp`;
  writeFileSync(tmp, JSON.stringify({ acceptance: null, ...prev, trigger }, null, 2) + '\n');
  renameSync(tmp, dest);
  return { dest, trigger };
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
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { climb: { type: 'boolean', default: false } } });
  const [flow, variant] = positionals;
  if (!flow || !variant) {
    console.error('usage: node save-result.mjs <flow-dir> <variant> [--climb]');
    process.exit(2);
  }
  try {
    const { dest, trigger } = saveResult(flow, variant, { climb: values.climb });
    console.log(`saved ${dest}: ${trigger.best_score} (test ${trigger.test.mean} ±${trigger.test.ci_half_width})`
      + (trigger.hillclimb ? `, climb ${trigger.hillclimb.verdict}: ${trigger.hillclimb.baseline_test} -> ${trigger.hillclimb.final_test} in ${trigger.hillclimb.rounds} round(s)` : ''));
  } catch (e) {
    console.error(`refusing to save: ${e.message}`);
    process.exit(1);
  }
}
