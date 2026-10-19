// The harness digest exactly as trigger-runner.mjs's checkHarness computes it:
// sha256 over the runner, any lockfile beside it or in the cwd, and every path in
// `harness_paths`, each as `<path relative to cwd>\0<bytes>\0`, in sorted order.
// new-flow.mjs uses it to reuse a human approval for byte-identical harness code;
// it never approves anything itself. harness-sha.test.mjs pins it to the runner.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { RUNNER, readJson } from './flow-lib.mjs';

const LOCKFILES = ['package-lock.json', 'bun.lock', 'bun.lockb', 'yarn.lock', 'pnpm-lock.yaml'];
const FLOWS = '.claude/hillclimb';

export function harnessSha(harnessPaths) {
  const cwd = process.cwd();
  const runner = resolve(cwd, RUNNER);
  const lockfiles = [...new Set([dirname(runner), cwd].flatMap(d => LOCKFILES.map(f => join(d, f))))]
    .filter(f => existsSync(f));
  const paths = [...new Set([runner, ...lockfiles, ...harnessPaths.map(p => resolve(cwd, p))])].sort();
  const h = createHash('sha256');
  for (const p of paths) {
    let buf;
    try { buf = readFileSync(p); } catch { if (p === runner) throw new Error(`cannot read ${p}`); continue; }
    h.update(relative(cwd, p)).update('\0').update(buf).update('\0');
  }
  return h.digest('hex');
}

/** The `_state.json` of a flow that already holds this exact digest as its approval, or null. */
export function approvedSha(sha) {
  if (!existsSync(FLOWS)) return null;
  for (const d of readdirSync(FLOWS)) {
    const f = join(FLOWS, d, '_state.json');
    if (!existsSync(f)) continue;
    try { if (readJson(f).harness_sha === sha) return f; } catch { /* a broken state file approves nothing */ }
  }
  return null;
}
