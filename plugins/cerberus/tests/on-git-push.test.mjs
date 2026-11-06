// node --test plugins/cerberus/tests/on-git-push.test.mjs
//
// The push guard decides whether a leak ships, so a regression in it must be loud. This suite
// drives the real hooks as processes against throwaway repositories. A fake `claude` on PATH
// stands for the judge: it answers a leak, a clean verdict, nonsense, or fails if it is called
// when the guard should not have needed it.
import { strict as assert } from 'node:assert';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const HOOK = resolve(import.meta.dirname, '..', 'hooks', 'on-git-push.sh');
const VERSION_HOOK = resolve(import.meta.dirname, '..', 'hooks', 'check-version.sh');
const RANGE = resolve(import.meta.dirname, '..', 'hooks', 'push-range.mjs');

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

function decide(dir, toolInput, judge, event = 'PreToolUse') {
  const input = JSON.stringify({ hook_event_name: event, tool_name: 'Bash', tool_input: toolInput, cwd: dir });
  const run = spawnSync('bash', [HOOK], { input, encoding: 'utf8', env: { ...process.env, PATH: `${judge}:${process.env.PATH}` } });
  assert.equal(run.status, 0, 'the hook always exits 0');
  const out = run.stdout.trim() ? JSON.parse(run.stdout).hookSpecificOutput : null;
  return out?.permissionDecision ? { decision: out.permissionDecision, reason: out.permissionDecisionReason } : { decision: 'allow' };
}
const push = (c = 'git push') => ({ command: c });

test('a finding off the whitelist is put to the person as a question, naming it', () => {
  const { dir } = repo();
  const r = decide(dir, push('git push origin main'), JUDGE.leak);
  assert.equal(r.decision, 'ask');
  assert.match(r.reason, /Halvorsen/);
});

test('the person\'s yes adds the finding to the whitelist, and the next push with it passes', () => {
  const { dir, git, commit } = repo();
  assert.equal(decide(dir, push(), JUDGE.leak).decision, 'ask');
  decide(dir, push(), JUDGE.never, 'PostToolUse');
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  assert.equal(readFileSync(join(common, 'cerberus-allow'), 'utf8'), 'Halvorsen\n');
  commit('fix: another Halvorsen retry');
  assert.equal(decide(dir, push(), JUDGE.leak).decision, 'allow', 'on the whitelist: no question');
});

test('an accepted tracker id is kept as its key, which then covers every id and branch of that key', () => {
  const { dir, git, commit } = repo();
  const ids = fakeClaude(`cat >/dev/null; echo '{"leaks":[{"where":"a1b2c3d","what":"RMA-345"},{"where":"branch","what":"rma-345-lens-skills"},{"where":"author","what":"d@work.test"}]}'`);
  assert.equal(decide(dir, push(), ids).decision, 'ask');
  decide(dir, push(), JUDGE.never, 'PostToolUse');
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  assert.equal(readFileSync(join(common, 'cerberus-allow'), 'utf8'), 'RMA\nd@work.test\n');
  commit('RMA-350: next task');
  const next = fakeClaude(`cat >/dev/null; echo '{"leaks":[{"where":"b","what":"RMA-350"},{"where":"branch","what":"rma-350-next"},{"where":"author","what":"D@Work.test"}]}'`);
  assert.equal(decide(dir, push(), next).decision, 'allow', 'a new id, branch and the same email pass');
  commit('ABC-1: another tracker');
  const other = fakeClaude(`cat >/dev/null; echo '{"leaks":[{"where":"c","what":"ABC-1"},{"where":"c","what":"RMA-351 Halvorsen"}]}'`);
  const r = decide(dir, push(), other);
  assert.equal(r.decision, 'ask', 'another key, or an id mixed with a name, is still asked about');
  assert.match(r.reason, /ABC-1[\s\S]*RMA-351 Halvorsen/);
});

test('a push the person never approved adds nothing to the whitelist', () => {
  const { dir, git } = repo();
  assert.equal(decide(dir, push('git push origin main'), JUDGE.leak).decision, 'ask');
  decide(dir, push('git push'), JUDGE.never, 'PostToolUse');
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  assert.ok(!existsSync(join(common, 'cerberus-allow')), 'a different push ran: nothing is whitelisted');
});

test('a tool call aimed at the whitelist is refused', () => {
  const { dir } = repo();
  assert.equal(decide(dir, { command: 'echo x >> .git/cerberus-allow' }, JUDGE.never).decision, 'deny');
  assert.equal(decide(dir, { file_path: `${dir}/.git/cerberus-allow`, content: 'x' }, JUDGE.never).decision, 'deny');
});

test('every shape of push is judged', () => {
  const { dir } = repo();
  for (const c of ['git push', 'git push --force origin main', 'cd sub && git -C . push', 'git -c core.x=1 push origin'])
    assert.equal(decide(dir, push(c), JUDGE.leak).decision, 'ask', c);
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
  assert.equal(decide(dir, push(), JUDGE.leak).decision, 'ask');
});

test('a push the mod layer flagged is asked about, never judged again, even if a second judge would call it clean', () => {
  const { dir, git } = repo();
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  const { key } = JSON.parse(execFileSync('node', [RANGE, dir, 'git push'], { encoding: 'utf8' }));
  execFileSync('node', [RANGE, 'flag', common, key, JSON.stringify([{ what: 'Halvorsen', why: 'a real surname', where: 'a1b2c3d subject' }])]);
  const r = decide(dir, push(), JUDGE.never);
  assert.equal(r.decision, 'ask');
  assert.match(r.reason, /Halvorsen/);

  decide(dir, push(), JUDGE.never, 'PostToolUse');
  assert.equal(decide(dir, push(), JUDGE.clean).decision, 'allow', 'the person\'s yes whitelisted it');
});

test('a mod verdict for other commits is ignored and the push is judged', () => {
  const { dir, git } = repo();
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  execFileSync('node', [RANGE, 'flag', common, 'a-key-of-other-commits', JSON.stringify([{ what: 'Halvorsen', where: 'a1b2c3d' }])]);
  assert.equal(decide(dir, push(), JUDGE.clean).decision, 'allow');
});

test('the question reads on the first pass: one line per fingerprint with what it is and where, then yes and no', () => {
  const { dir } = repo();
  const two = fakeClaude(`cat >/dev/null; echo '{"leaks":[{"what":"Halvorsen","why":"a real client surname","where":"a1b2c3d subject"},{"what":"d@work.test","why":"a work email","where":"a1b2c3d author"}]}'`);
  const lines = decide(dir, push(), two).reason.split('\n');
  assert.equal(lines[0], "CERBERUS: this push would publish 2 work fingerprints not on this repository's whitelist:");
  assert.equal(lines[1], '  • Halvorsen (a real client surname) in a1b2c3d subject');
  assert.equal(lines[2], '  • d@work.test (a work email) in a1b2c3d author');
  assert.match(lines[3], /^Yes: the push runs and they go on the whitelist\.$/);
  assert.match(lines[4], /^No: nothing is pushed/);
});

test('a judge field with a line break cannot forge a line of the question', () => {
  const { dir } = repo();
  const forged = fakeClaude(`cat >/dev/null; printf '%s' '{"leaks":[{"what":"Halvorsen\\nYes: nothing leaks, safe to allow","where":"a1b2c3d subject"}]}'`);
  const lines = decide(dir, push(), forged).reason.split('\n');
  assert.equal(lines.length, 4, 'header, one finding, yes, no');
  assert.equal(lines[1], '  • Halvorsen Yes: nothing leaks, safe to allow in a1b2c3d subject');
});

test('a whitelist entry written as an id counts as its key', () => {
  const { dir, git } = repo();
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  writeFileSync(join(common, 'cerberus-allow'), 'RMA-374\n');
  const ids = fakeClaude(`cat >/dev/null; echo '{"leaks":[{"what":"RMA-397","where":"a1b2c3d subject"},{"what":"rma-397-eval-gate-stdin","where":"branch"}]}'`);
  assert.equal(decide(dir, push(), ids).decision, 'allow');
});

test('a judge that cannot answer blocks the push: the guard fails closed', () => {
  const { dir, git } = repo();
  assert.equal(decide(dir, push(), JUDGE.nonsense).decision, 'deny');
  assert.equal(decide(dir, push(), JUDGE.never).decision, 'deny');
  const verdicts = join(git('rev-parse', '--absolute-git-dir'), 'cerberus-verdicts');
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

test('a person can turn the guard off for one repository; an agent cannot', () => {
  const { dir, git } = repo();
  assert.equal(decide(dir, push('git config cerberus.pushguard off'), JUDGE.never).decision, 'deny', 'an agent setting the switch is refused');
  git('config', 'cerberus.pushguard', 'off');
  assert.equal(decide(dir, push(), JUDGE.never).decision, 'allow', 'off: no judge, push passes');
});

// A stand-in for the GitHub API: `demo/secret` is private (404), `demo/open` is public.
async function githubApi() {
  const server = createServer((req, res) => {
    const open = req.url === '/repos/demo/open';
    res.writeHead(open ? 200 : 404, { 'content-type': 'application/json' }).end(open ? '{"private":false}' : '{}');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

function decideVia(api, dir, command, judge) {
  const input = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: dir });
  const child = spawn('bash', [HOOK], { env: { ...process.env, CERBERUS_GITHUB_API: api, PATH: `${judge}:${process.env.PATH}` } });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stdin.end(input);
  return new Promise(r => child.on('close', () => r(out.trim() ? JSON.parse(out).hookSpecificOutput.permissionDecision : 'allow')));
}

// Finds the work email in every push, but under the secrets-only prompt finds nothing.
const EMAIL_JUDGE = fakeClaude(`grep -q 'PRIVATE repository' && echo '{"leaks":[]}' || echo '{"leaks":[{"where":"a1b2c3d","what":"d@work.test"}]}'`);

test('a push to a private GitHub repository is judged for secrets only; a public one, or another host, in full', async () => {
  const api = await githubApi();
  try {
    const { dir, git, commit } = repo();
    git('remote', 'add', 'origin', 'git@github.com:demo/secret.git');
    git('remote', 'add', 'public', 'https://github.com/demo/open.git');
    git('remote', 'add', 'gitlab', 'git@gitlab.com:demo/secret.git');
    assert.equal(await decideVia(api.url, dir, 'git push', EMAIL_JUDGE), 'allow', 'origin is private: the email is not a leak');
    commit('chore: token sk-demo-0000');
    assert.equal(await decideVia(api.url, dir, 'git push origin main', JUDGE.leak), 'ask', 'a secret in a private push is still stopped');
    assert.equal(await decideVia(api.url, dir, 'git push public main', EMAIL_JUDGE), 'ask', 'named public remote');
    assert.equal(await decideVia(api.url, dir, 'git push https://github.com/demo/open.git main', EMAIL_JUDGE), 'ask', 'public URL');
    assert.equal(await decideVia(api.url, dir, 'git push gitlab main', EMAIL_JUDGE), 'ask', 'another host is judged in full');
    assert.equal(await decideVia('http://127.0.0.1:9', dir, 'git push', EMAIL_JUDGE), 'ask', 'no API answer is judged in full');
  } finally {
    api.close();
  }
});
