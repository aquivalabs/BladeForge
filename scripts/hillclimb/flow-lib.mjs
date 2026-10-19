// The facts every hillclimb script shares, defined once: how a case is named,
// how a skill is named, how a variant's rows are read and scored, and what a
// gate-trusted trigger record must say about its origin. The runner imports this
// module, so it is listed in `_state.json.harness_paths` and the harness gate
// covers it.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** The record contract: the writer stamps these, the gate checks them. */
export const RUNNER = 'scripts/hillclimb/trigger-runner.mjs';
export const MODEL = 'claude-opus-5-5';
export const ENVIRONMENTS = ['isolated', 'crowded'];
export const CLIMB_VERDICTS = ['improved', 'within-noise', 'regressed', 'no-headroom'];
export const HARNESS_PATHS = [RUNNER, 'scripts/hillclimb/skill-description.mjs', 'scripts/hillclimb/flow-lib.mjs',
  'scripts/hillclimb/sandbox-lib.mjs'];

/** A case id: stable across rubric reordering, path-safe. Split ids and result rows both use it. */
export function caseId(query) {
  return `q-${createHash('sha256').update(query).digest('hex').slice(0, 10)}`;
}

/** `plugins/<plugin>/skills/<skill>` -> `<plugin>-<skill>`, unique across the marketplace. */
export function skillSlug(dir) {
  const parts = resolve(dir).split('/');
  return `${parts.at(-3)}-${parts.at(-1)}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/** A skill's rubric trigger cases, each with its case id. */
export function triggerCases(skillDir) {
  const trigger = readJson(join(skillDir, 'evals', 'rubric.json')).trigger;
  return trigger.map(q => ({ ...q, id: caseId(q.query) }));
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** The rows of a jsonl file, or [] when it does not exist. */
export function readRows(file) {
  return existsSync(file)
    ? readFileSync(file, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
    : [];
}

export function round(x) { return Number(x.toFixed(3)); }

/**
 * Pass rate over the rows whose case is in `ids`, with the binary-CI half-width
 * 1/sqrt(n). Every reported train or test number comes from here.
 */
export function splitScore(rows, ids) {
  const set = new Set((ids ?? []).map(String));
  const mine = rows.filter(r => set.has(String(r.prompt_id)));
  const n = mine.length;
  return {
    cases: new Set(mine.map(r => r.prompt_id)).size,
    rows: n,
    mean: n ? round(mine.reduce((s, r) => s + Number(r.grade?.pass ?? 0), 0) / n) : null,
    ci_half_width: n ? round(1 / Math.sqrt(n)) : null,
  };
}
