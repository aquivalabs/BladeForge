// The facts every hillclimb script shares, defined once: how a case is named,
// how a skill is named, how a variant's rows are read and scored, and what a
// gate-trusted trigger record must say about its origin. The runner imports this
// module, so it is listed in `_state.json.harness_paths` and the harness gate
// covers it.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, readSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** The record contract: the writer stamps these, the gate checks them. */
export const RUNNER = 'scripts/hillclimb/trigger-runner.mjs';
export const MODEL = 'claude-opus-5-5';
export const ENVIRONMENTS = ['isolated', 'crowded'];
export const CLIMB_VERDICTS = ['improved', 'within-noise', 'regressed', 'no-headroom'];
/** What a quality record may conclude: the skill's effect against the no-skill arm. */
export const QUALITY_VERDICTS = ['helps', 'within-noise', 'hurts'];
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

/**
 * The hash of what a quality run installs: every file of the skill except `evals/`, by
 * relative path and content. A record keyed by it goes stale when the body or a reference
 * changes.
 */
export function skillHash(skillDir) {
  const root = resolve(skillDir);
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (p !== join(root, 'evals')) walk(p); }
      else files.push(relative(root, p).split(sep).join('/'));
    }
  };
  walk(root);
  const h = createHash('sha256');
  for (const f of files.sort()) h.update(`${f}\0`).update(readFileSync(join(root, f))).update('\0');
  return h.digest('hex');
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

/**
 * The gate in front of `--approve-harness`. An approval goes through when the harness as it is now
 * was read by a passing `/review`: every harness file is committed, and some PASS attestation in
 * `.review/attestations/` names a commit on this branch whose harness files are byte-identical to
 * HEAD's. Anything else needs a person: the run asks for the word `approve` on a terminal, and
 * without a terminal - an agent's shell - it refuses. Returns how the approval was granted;
 * exits the process when it is refused.
 */
export function gateApproval(harnessFiles, { cwd = process.cwd(), ask = askOnTerminal, refuse = () => process.exit(2) } = {}) {
  const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const ok = (...a) => { try { execFileSync('git', a, { cwd, stdio: 'ignore' }); return true; } catch { return false; } };
  const files = [...new Set(harnessFiles.map(f => relative(resolve(cwd), resolve(cwd, f)).split(sep).join('/')))].sort();
  const dirty = git('status', '--porcelain', '--', ...files);
  const why = [];
  if (dirty) why.push(`uncommitted harness changes:\n${dirty}`);
  else {
    const dir = join(cwd, '.review', 'attestations');
    const shas = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')).flatMap(f => {
      try { const a = readJson(join(dir, f)); return a.overall === 'PASS' && a.commitSha ? [a.commitSha] : []; } catch { return []; }
    }) : [];
    const covering = shas.find(sha => ok('merge-base', '--is-ancestor', sha, 'HEAD') && ok('diff', '--quiet', sha, 'HEAD', '--', ...files));
    if (covering) return { by: 'review', commit: covering };
    why.push('no PASS review attestation covers the harness as committed at HEAD');
  }
  console.error(`approval needs a person: ${why.join('; ')}`);
  if (ask()) return { by: 'person' };
  console.error('refused: run --approve-harness from your own terminal and type "approve", or commit the change and pass /review first.');
  return refuse();
}

/**
 * What a runner's fill-in calls at load: when the command line carries `--approve-harness`, the
 * runner's own file and its flow's `_state.json.harness_paths` go through gateApproval before the
 * scaffold below records the new sha.
 */
export function gateApprovalFromArgv(runnerFile, argv = process.argv) {
  if (!argv.includes('--approve-harness')) return null;
  const flow = argv[argv.indexOf('--flow') + 1];
  const st = flow && existsSync(join(flow, '_state.json')) ? readJson(join(flow, '_state.json')) : {};
  const g = gateApproval([runnerFile, ...(Array.isArray(st.harness_paths) ? st.harness_paths : [])]);
  console.error(`approval granted by ${g.by === 'review' ? `review, attested at ${g.commit.slice(0, 12)}` : 'a person at the terminal'}`);
  return g;
}

// A person types the word; a shell with no terminal attached, the way an agent runs, gets false.
function askOnTerminal() {
  if (!process.stdin.isTTY) return false;
  process.stderr.write('Type "approve" to record this harness without a review: ');
  const buf = Buffer.alloc(64);
  const n = readSync(0, buf, 0, buf.length, null);
  return buf.toString('utf8', 0, n).trim() === 'approve';
}
