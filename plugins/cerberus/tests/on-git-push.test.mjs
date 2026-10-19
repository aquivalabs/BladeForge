// node --test plugins/cerberus/tests/on-git-push.test.mjs
//
// The push guard is fail-open by construction, so a regression in it is silent: it would
// simply stop denying, and a leak would ship. This suite drives the real hook as a process
// against throwaway repositories.
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const HOOK = resolve(import.meta.dirname, '..', 'hooks', 'on-git-push.sh');

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'cerberus-push-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=a', '-c', 'user.email=a@example.com', 'commit', '-q', '--allow-empty', '-m', 'base');
  return { dir, git };
}

function decide(dir, command) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: dir });
  const run = spawnSync('bash', [HOOK], { input, encoding: 'utf8' });
  assert.equal(run.status, 0, 'the hook always exits 0');
  return run.stdout.includes('"permissionDecision": "deny"') ? 'deny' : 'allow';
}

test('a push without a clean leak check is denied, in every shape', () => {
  const { dir } = repo();
  for (const c of ['git push', 'git push --force origin main', 'cd sub && git -C . push', 'git -c core.x=1 push origin'])
    assert.equal(decide(dir, c), 'deny', c);
});

test('commands that are not a push pass', () => {
  const { dir } = repo();
  for (const c of ['git status', 'git log --oneline', 'git pushx', 'npm run push', 'echo later'])
    assert.equal(decide(dir, c), 'allow', c);
});

test('the marker for exactly this HEAD lets the push through; a new commit asks again', () => {
  const { dir, git } = repo();
  writeFileSync(join(dir, '.git', 'cerberus-leak-checked'), git('rev-parse', 'HEAD') + '\n');
  assert.equal(decide(dir, 'git push'), 'allow');
  git('-c', 'user.name=a', '-c', 'user.email=a@example.com', 'commit', '-q', '--allow-empty', '-m', 'next');
  assert.equal(decide(dir, 'git push'), 'deny');
});

test('outside a repository, or on unparsable input, the hook stays out of the way', () => {
  const outside = mkdtempSync(join(tmpdir(), 'cerberus-none-'));
  assert.equal(decide(outside, 'git push'), 'allow');
  const run = spawnSync('bash', [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '');
});

const VERSION_HOOK = resolve(import.meta.dirname, '..', 'hooks', 'check-version.sh');

function sessionStartWith(version) {
  const bin = mkdtempSync(join(tmpdir(), 'cerberus-bin-'));
  writeFileSync(join(bin, 'claude'), `#!/bin/sh\necho "${version} (Claude Code)"\n`, { mode: 0o755 });
  const run = spawnSync('bash', [VERSION_HOOK], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  assert.equal(run.status, 0);
  return run.stdout ? JSON.parse(run.stdout).systemMessage : null;
}

test('an engine too old for the push-guard mod gets a red update notice', () => {
  const msg = sessionStartWith('2.1.100');
  assert.match(msg, /UPDATE CLAUDE CODE/);
  assert.match(msg, /\u001b\[1;41;97m/, 'the banner is red');
  assert.match(msg, /^\n/, 'the banner starts on line two, below the hook label');
});

test('a supported engine starts the session silently', () => {
  assert.equal(sessionStartWith('2.1.292'), null);
  assert.equal(sessionStartWith('2.10.0'), null);
});
