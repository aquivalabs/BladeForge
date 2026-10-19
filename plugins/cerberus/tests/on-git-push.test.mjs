// node --test plugins/cerberus/tests/on-git-push.test.mjs
//
// The push guard decides whether a leak ships, so a regression in it must be loud. This suite
// drives the real hooks as processes against throwaway repositories. A fake `claude` on PATH
// stands for the judge: it answers a leak, a clean verdict, nonsense, or fails if it is called
// when the guard should not have needed it.
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const HOOK = resolve(import.meta.dirname, '..', 'hooks', 'on-git-push.sh');
const VERSION_HOOK = resolve(import.meta.dirname, '..', 'hooks', 'check-version.sh');

function fakeClaude(script) {
  const bin = mkdtempSync(join(tmpdir(), 'cerberus-bin-'));
  writeFileSync(join(bin, 'claude'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  return bin;
}
const JUDGE = {
  leak: fakeClaude(`cat >/dev/null; echo '{"leaks":[{"where":"a1b2c3d","what":"Halvorsen"}]}'`),
  clean: fakeClaude(`cat >/dev/null; echo '{"leaks":[]}'`),
  nonsense: fakeClaude(`cat >/dev/null; echo 'I could not decide.'`),
  never: fakeClaude(`echo called >&2; exit 9`),
};

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'cerberus-push-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  const commit = (m) => git('-c', 'user.name=Demo', '-c', 'user.email=d@example.com', 'commit', '-q', '--allow-empty', '-m', m);
  commit('base');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  commit('fix: something to push');
  return { dir, git, commit };
}

function decide(dir, toolInput, judge) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: toolInput, cwd: dir });
  const run = spawnSync('bash', [HOOK], { input, encoding: 'utf8', env: { ...process.env, PATH: `${judge}:${process.env.PATH}` } });
  assert.equal(run.status, 0, 'the hook always exits 0');
  const m = /"permissionDecision": "deny", "permissionDecisionReason": "([^"]*)"/.exec(run.stdout);
  return m ? { decision: 'deny', reason: m[1] } : { decision: 'allow' };
}
const push = (c = 'git push') => ({ command: c });

test('a push whose commits the judge finds leaking is denied, naming the leak', () => {
  const { dir } = repo();
  const r = decide(dir, push('git push origin main'), JUDGE.leak);
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /Halvorsen/);
});

test('every shape of push is judged', () => {
  const { dir } = repo();
  for (const c of ['git push', 'git push --force origin main', 'cd sub && git -C . push', 'git -c core.x=1 push origin'])
    assert.equal(decide(dir, push(c), JUDGE.leak).decision, 'deny', c);
});

test('a clean verdict lets the push through and is cached; the same push is not judged again', () => {
  const { dir } = repo();
  assert.equal(decide(dir, push(), JUDGE.clean).decision, 'allow');
  assert.equal(decide(dir, push(), JUDGE.never).decision, 'allow', 'cached: the judge is not called');
});

test('a new commit after a clean verdict is judged afresh', () => {
  const { dir, commit } = repo();
  assert.equal(decide(dir, push(), JUDGE.clean).decision, 'allow');
  commit('fix: Halvorsen retry');
  assert.equal(decide(dir, push(), JUDGE.leak).decision, 'deny');
});

test('a judge that cannot answer blocks the push: the guard fails closed', () => {
  const { dir } = repo();
  assert.equal(decide(dir, push(), JUDGE.nonsense).decision, 'deny');
  assert.equal(decide(dir, push(), JUDGE.never).decision, 'deny');
  const verdicts = join(execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: dir, encoding: 'utf8' }).trim(), 'cerberus-verdicts');
  assert.ok(!existsSync(verdicts) || readdirSync(verdicts).length === 0, 'nothing is cached without a clean verdict');
});

test('a tool call aimed at the verdict cache is refused', () => {
  const { dir } = repo();
  assert.equal(decide(dir, { command: 'touch .git/cerberus-verdicts/abc' }, JUDGE.never).decision, 'deny');
  assert.equal(decide(dir, { file_path: `${dir}/.git/cerberus-verdicts/abc`, content: 'clean' }, JUDGE.never).decision, 'deny');
});

test('commands that are not a push, and pushes with nothing new, pass without a judge', () => {
  const { dir, git } = repo();
  for (const c of ['git status', 'git log --oneline', 'git pushx', 'npm run push'])
    assert.equal(decide(dir, push(c), JUDGE.never).decision, 'allow', c);
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  assert.equal(decide(dir, push(), JUDGE.never).decision, 'allow', 'nothing past origin/main');
});

test('outside a repository, or on unparsable input, the hook stays out of the way', () => {
  const outside = mkdtempSync(join(tmpdir(), 'cerberus-none-'));
  assert.equal(decide(outside, push(), JUDGE.never).decision, 'allow');
  const run = spawnSync('bash', [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '');
});

function sessionStartWith(version) {
  const bin = fakeClaude(`echo "${version} (Claude Code)"`);
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
