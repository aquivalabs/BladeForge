import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandFor, ensurePackage, installedVersion, main, needsInstall, npmInstallArgs, packagePath, wantedVersion } from './app.mjs';
import { ensureRunning, staleAgent } from './ensure-running.mjs';

const DATA = '/home/u/data dir';
const PACKAGE = join(DATA, 'app', 'node_modules', 'whose-turn');
const installed = (version) => (path) => {
  assert.equal(path, join(PACKAGE, 'package.json'));
  if (!version) {
    throw Object.assign(new Error('missing'), { code: 'ENOENT' });
  }
  return JSON.stringify({ name: 'whose-turn', version });
};
const recorder = (status = 0, missing = false) => {
  const calls = [];
  return { calls, run: (file, args, options) => (calls.push([file, args, options]), { status, missing }) };
};

test('the first install takes latest, or the version WHOSE_TURN_APP_VERSION names', () => {
  assert.equal(wantedVersion({}), 'latest');
  assert.equal(wantedVersion({ WHOSE_TURN_APP_VERSION: '1.0.0-alpha.1' }), '1.0.0-alpha.1');
});

test('the package lives under <dataDir>/app/node_modules/whose-turn', () => {
  assert.equal(packagePath(DATA), PACKAGE);
});

test('npm installs the wanted version into <dataDir>/app without touching a package.json', () => {
  assert.deepEqual(npmInstallArgs(DATA, '1.0.0-alpha.2'), ['install', '--prefix', join(DATA, 'app'), '--no-audit', '--no-fund', '--no-save', '--ignore-scripts', 'whose-turn@1.0.0-alpha.2']);
});

test('install decision: only a missing package installs; any installed version is left to the server to update', () => {
  assert.equal(needsInstall(null), true);
  assert.equal(needsInstall('1.0.0-alpha.1'), false);
  assert.equal(installedVersion(DATA, installed('1.0.0-alpha.1')), '1.0.0-alpha.1');
  assert.equal(installedVersion(DATA, installed(null)), null);
});

test('the first install, with no package yet, takes whose-turn@latest', () => {
  const { calls, run } = recorder();
  assert.equal(ensurePackage({ data: DATA, version: wantedVersion({}), run, read: installed(null) }), PACKAGE);
  assert.deepEqual(calls.map(([file, args]) => [file, args.at(-1)]), [['npm', 'whose-turn@latest']]);
});

test('an installed package, whatever its version, runs npm not at all', () => {
  const { calls, run } = recorder();
  assert.equal(ensurePackage({ data: DATA, version: 'latest', run, read: installed('1.0.0-alpha.1') }), PACKAGE);
  assert.deepEqual(calls, []);
});

test('no npm on PATH: one line saying so, and no package', () => {
  const lines = [];
  const { run } = recorder(null, true);
  assert.equal(ensurePackage({ data: DATA, version: '1.0.0-alpha.2', run, read: installed(null), log: (line) => lines.push(line) }), null);
  assert.deepEqual(lines, ['Whose Turn needs npm on PATH to install its monitor; npm comes with Node 22.']);
});

test('a failing npm install is reported and stops the command', () => {
  const lines = [];
  const { run } = recorder(1);
  assert.equal(main(['start'], { data: '/nowhere', run, log: (line) => lines.push(line), start: () => assert.fail('must not start') }), 1);
  assert.match(lines[0], /could not install whose-turn@.* \(npm exited with 1\)/);
});

test('install, open and start run the package\'s own scripts from its folder', () => {
  assert.deepEqual(commandFor('install', [], PACKAGE).slice(0, 2), ['bash', [join(PACKAGE, 'install.sh')]]);
  assert.deepEqual(commandFor('open', ['--browser', '--other'], PACKAGE).slice(0, 2), ['bash', [join(PACKAGE, 'open.sh'), '--browser']]);
  const [file, args, options] = commandFor('start', [], PACKAGE);
  assert.equal(file, process.execPath);
  assert.deepEqual(args, [join(PACKAGE, 'server.mjs')]);
  assert.equal(options.detached, true);
  assert.equal(options.cwd, PACKAGE);
});

test('path prints the package folder and installs nothing', () => {
  const out = [];
  const { calls, run } = recorder();
  assert.equal(main(['path'], { data: DATA, run, out: (line) => out.push(line) }), 0);
  assert.deepEqual(out, [PACKAGE]);
  assert.deepEqual(calls, []);
});

const SERVER = join(PACKAGE, 'server.mjs');
const plistFor = (server) => `<array><string>/usr/bin/node</string><string>${server}</string></array>`;

test('stale agent: a server.mjs that is gone, or one an earlier plugin kept in the plugin cache', () => {
  const old = '/home/u/.claude/plugins/cache/whose-turn/whose-turn/0.3.0/server.mjs';
  assert.equal(staleAgent(plistFor('/gone/server.mjs'), { exists: () => false }), true);
  assert.equal(staleAgent(plistFor(old), { exists: () => true }), true);
  assert.equal(staleAgent(plistFor('/home/u/src/whose-turn/server.mjs'), { exists: () => true }), false);
});

test('stale agent: the package\'s own server is never stale while it is there, whatever its version', () => {
  assert.equal(staleAgent(plistFor(SERVER), { exists: () => true }), false);
});

const attempt = async ({ platform, present = [], stale = false }) => {
  const calls = [];
  let started = false;
  await ensureRunning({
    platform,
    home: '/home/u',
    uid: 501,
    exists: (path) => present.includes(path),
    read: () => '',
    stale: () => stale,
    wait: async () => {},
    probe: async () => started,
    run: (file, args, options) => {
      calls.push([file, args, options]);
      started ||= args.includes('start') || args[0] === 'kickstart';
      return true;
    },
  });
  return calls;
};

test('no agent: the detached start goes through app.mjs start', async () => {
  const calls = await attempt({ platform: 'darwin' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], process.execPath);
  assert.match(calls[0][1][0], /bin\/app\.mjs$/);
  assert.equal(calls[0][1][1], 'start');
  assert.deepEqual(calls[0][2], { detached: true });
});

test('a stale agent is repointed through app.mjs install, detached, before the start', async () => {
  const plist = '/home/u/Library/LaunchAgents/local.whose-turn.plist';
  const calls = await attempt({ platform: 'darwin', present: [plist], stale: true });
  assert.match(calls[0][1][0], /bin\/app\.mjs$/);
  assert.equal(calls[0][1][1], 'install');
  assert.deepEqual(calls[0][2], { detached: true });
  assert.deepEqual(calls[1], ['launchctl', ['kickstart', 'gui/501/local.whose-turn'], undefined]);
});

const SUMMARY = join(dirname(fileURLToPath(import.meta.url)), 'summary.mjs');

/** Runs the SessionStart hook against a stub monitor in a scratch HOME and data dir; returns its output and the POSTs it sent. */
const hookWith = async (update, answer = { status: 200, body: { update: { ...update, state: 'installing' } } }, extraEnv = {}) => {
  const posts = [];
  const server = createServer((request, response) => {
    if (request.method === 'POST') {
      posts.push({ path: request.url, type: request.headers['content-type'] });
      response.writeHead(answer.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(answer.body));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ workspaces: [{ connectors: [{ label: 'GitHub' }] }], update }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const scratch = mkdtempSync(join(tmpdir(), 'whose-turn-hook-'));
  try {
    const env = { ...process.env, HOME: scratch, WHOSE_TURN_DATA: scratch, WHOSE_TURN_PORT: String(server.address().port), ...extraEnv };
    const stdout = await new Promise((resolve, reject) => execFile(process.execPath, [SUMMARY, 'hook'], { env, timeout: 10000 }, (error, out) => (error ? reject(error) : resolve(out))));
    return { output: JSON.parse(stdout), posts };
  } finally {
    server.close();
    rmSync(scratch, { recursive: true, force: true });
  }
};

test('the hook posts /api/update when the summary offers one, and says so in its line', async () => {
  const { output, posts } = await hookWith({ current: '1.0.0-alpha.3', latest: '1.0.0-alpha.9', available: true, state: 'idle' });
  assert.deepEqual(posts, [{ path: '/api/update', type: 'application/json' }]);
  assert.match(output.systemMessage, / · Whose Turn is updating to 1\.0\.0-alpha\.9$/);
  assert.match(output.hookSpecificOutput.additionalContext, /Whose Turn is updating to 1\.0\.0-alpha\.9/);
});

test('an update already running (409 UPDATE_IN_PROGRESS) is still announced as updating', async () => {
  const { output, posts } = await hookWith({ current: '1.0.0-alpha.3', latest: '1.0.0-alpha.9', available: true, state: 'installing' }, { status: 409, body: { error: { code: 409, details: [{ reason: 'UPDATE_IN_PROGRESS' }] } } });
  assert.equal(posts.length, 1);
  assert.match(output.systemMessage, /Whose Turn is updating to 1\.0\.0-alpha\.9/);
});

test('a version named in WHOSE_TURN_APP_VERSION is kept: the hook posts no update even when one is offered', async () => {
  const { output, posts } = await hookWith({ current: '1.0.0-alpha.3', latest: '1.0.0-alpha.9', available: true, state: 'idle' }, undefined, { WHOSE_TURN_APP_VERSION: '1.0.0-alpha.3' });
  assert.deepEqual(posts, []);
  assert.ok(!JSON.stringify(output).includes('updating'));
});

test('no update available: no POST and no update phrase', async () => {
  const { output, posts } = await hookWith({ current: '1.0.0-alpha.3', latest: '1.0.0-alpha.3', available: false, state: 'idle' });
  assert.deepEqual(posts, []);
  assert.doesNotMatch(JSON.stringify(output), /updating/);
});
