// node --test scripts/hillclimb/harness-sha.test.mjs   (from the repository root)
//
// harness-sha.mjs re-implements the vendored runner's checkHarness digest so that
// new-flow.mjs can reuse an approval. If the two ever drift, new-flow copies a sha
// the runner no longer computes and every new flow silently asks for approval
// again. This pins them: the runner, refusing an unapproved flow, prints the digest
// it computed, and it must equal harnessSha. The runner exits before any case runs,
// so the test spends nothing.
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { HARNESS_PATHS, RUNNER } from './flow-lib.mjs';
import { harnessSha } from './harness-sha.mjs';

test('harnessSha equals the digest the runner computes', () => {
  const flow = join(mkdtempSync(join(tmpdir(), 'bf-harness-')), 'flow');
  mkdirSync(flow);
  writeFileSync(join(flow, '_state.json'), JSON.stringify({
    skill_path: 'plugins/meta/skills/skill-eval', harness_paths: HARNESS_PATHS,
  }));
  const run = spawnSync('node', [RUNNER, '--flow', flow, '--variant', 'baseline'], { encoding: 'utf8' });
  assert.equal(run.status, 2, 'an unapproved flow must be refused');
  const printed = /computed ([0-9a-f]{12})/.exec(run.stderr)?.[1];
  assert.ok(printed, `runner printed no digest: ${run.stderr}`);
  assert.equal(harnessSha(HARNESS_PATHS).slice(0, 12), printed);
});
