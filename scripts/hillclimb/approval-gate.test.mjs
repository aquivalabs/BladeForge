// node --test scripts/hillclimb/approval-gate.test.mjs
//
// gateApproval stands in front of --approve-harness, so a defect here either lets an unreviewed
// runner run or locks the maintainer out. The axes walked: coverage (an attested commit holds the
// harness as it is now, or the harness moved after it; every runner calls the gate), state
// (committed or not), verdict (PASS or not), and who asks (a person at a terminal, or a shell with
// none).
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { gateApproval } from './flow-lib.mjs';

const FILES = ['runner.mjs', 'lib.mjs'];

function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'bf-gate-'));
  const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Demo'); git('config', 'user.email', 'demo@example.com');
  for (const f of FILES) writeFileSync(join(cwd, f), `// ${f} v1\n`);
  git('add', '-A'); git('commit', '-qm', 'harness');
  const attest = (verdict = 'PASS', sha = git('rev-parse', 'HEAD')) => {
    mkdirSync(join(cwd, '.review', 'attestations'), { recursive: true });
    writeFileSync(join(cwd, '.review', 'attestations', `${sha.slice(0, 8)}.json`), JSON.stringify({ commitSha: sha, overall: verdict }));
    git('add', '-A'); git('commit', '-qm', 'chore: review attestation');
  };
  return { cwd, git, attest };
}

const gate = (cwd, { ask = () => false } = {}) => gateApproval(FILES, { cwd, ask });

test('coverage: a PASS attestation on a commit holding the same harness approves by review', () => {
  const r = repo();
  r.attest();
  assert.equal(gate(r.cwd).by, 'review');
});

test('coverage: a harness changed after the attested commit is refused', () => {
  const r = repo();
  r.attest();
  writeFileSync(join(r.cwd, 'lib.mjs'), '// lib.mjs v2\n');
  r.git('commit', '-qam', 'change the harness');
  assert.equal(gate(r.cwd), null);
});

test('state: an uncommitted harness change is refused even with an attestation', () => {
  const r = repo();
  r.attest();
  writeFileSync(join(r.cwd, 'runner.mjs'), '// runner.mjs v2\n');
  assert.equal(gate(r.cwd), null);
});

test('verdict: a FAIL attestation covers nothing', () => {
  const r = repo();
  r.attest('FAIL');
  assert.equal(gate(r.cwd), null);
});

test('who asks: a person who types approve may approve an unreviewed harness', () => {
  const r = repo();
  assert.equal(gate(r.cwd, { ask: () => true }).by, 'person');
});

test('who asks: with no attestation and no terminal, the approval is refused', () => {
  const r = repo();
  assert.equal(gate(r.cwd), null);
});

test('coverage: every runner calls the gate at load, so a new runner cannot skip it', () => {
  const dir = resolve(import.meta.dirname);
  const runners = readdirSync(dir).filter(f => f.endsWith('-runner.mjs'));
  assert.ok(runners.length >= 2);
  for (const f of runners)
    assert.match(readFileSync(join(dir, f), 'utf8'), /^gateApprovalFromArgv\(fileURLToPath\(import\.meta\.url\)\);$/m, f);
});
