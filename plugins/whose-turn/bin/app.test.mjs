import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { WHOSE_TURN_VERSION, commandFor, ensurePackage, installedVersion, main, needsInstall, npmInstallArgs, packagePath, wantedVersion } from './app.mjs';
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

test('the pin is the one published version the plugin runs, overridable only by WHOSE_TURN_APP_VERSION', () => {
  assert.equal(WHOSE_TURN_VERSION, '1.0.0-alpha.2');
  assert.equal(wantedVersion({}), WHOSE_TURN_VERSION);
  assert.equal(wantedVersion({ WHOSE_TURN_APP_VERSION: '1.0.0-alpha.1' }), '1.0.0-alpha.1');
});

test('the package lives under <dataDir>/app/node_modules/whose-turn', () => {
  assert.equal(packagePath(DATA), PACKAGE);
});

test('npm installs the pinned version into <dataDir>/app without touching a package.json', () => {
  assert.deepEqual(npmInstallArgs(DATA, '1.0.0-alpha.2'), ['install', '--prefix', join(DATA, 'app'), '--no-audit', '--no-fund', '--no-save', 'whose-turn@1.0.0-alpha.2']);
});

test('reinstall decision: missing or another version installs, the same version does not', () => {
  assert.equal(needsInstall(null, '1.0.0-alpha.2'), true);
  assert.equal(needsInstall('1.0.0-alpha.1', '1.0.0-alpha.2'), true);
  assert.equal(needsInstall('1.0.0-alpha.2', '1.0.0-alpha.2'), false);
  assert.equal(installedVersion(DATA, installed('1.0.0-alpha.1')), '1.0.0-alpha.1');
  assert.equal(installedVersion(DATA, installed(null)), null);
});

test('an installed package at the pin runs npm not at all', () => {
  const { calls, run } = recorder();
  assert.equal(ensurePackage({ data: DATA, version: '1.0.0-alpha.2', run, read: installed('1.0.0-alpha.2') }), PACKAGE);
  assert.deepEqual(calls, []);
});

test('an older installed package is replaced by the pinned one', () => {
  const { calls, run } = recorder();
  assert.equal(ensurePackage({ data: DATA, version: '1.0.0-alpha.2', run, read: installed('1.0.0-alpha.1') }), PACKAGE);
  assert.deepEqual(calls.map(([file, args]) => [file, args.at(-1)]), [['npm', 'whose-turn@1.0.0-alpha.2']]);
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
  assert.equal(staleAgent(plistFor('/gone/server.mjs'), { exists: () => false, server: SERVER }), true);
  assert.equal(staleAgent(plistFor(old), { exists: () => true, server: SERVER }), true);
  assert.equal(staleAgent(plistFor('/home/u/src/whose-turn/server.mjs'), { exists: () => true, server: SERVER }), false);
});

test('stale agent: the package\'s own server is stale only when its installed version is not the pin', () => {
  assert.equal(staleAgent(plistFor(SERVER), { server: SERVER, outdated: () => false }), false);
  assert.equal(staleAgent(plistFor(SERVER), { server: SERVER, outdated: () => true }), true);
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
