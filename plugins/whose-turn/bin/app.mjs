#!/usr/bin/env node
/**
 * The one place that knows the monitor's npm package. The first start, with nothing in `<dataDir>/app` yet, installs
 * `whose-turn@latest` there; after that a newer version installs only on the user's yes (`POST /api/update`). It runs the package's own scripts from there.
 *   node app.mjs path               prints the package folder
 *   node app.mjs install            registers the launch agent / user unit (the package's install.sh)
 *   node app.mjs open [--browser]   opens the window (the package's open.sh)
 *   node app.mjs start              starts a detached server
 * WHOSE_TURN_APP_VERSION names the version that first install takes, for trying a specific one; while it is set, the hook offers no update.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDir, port } from './lib.mjs';

export const wantedVersion = (env = process.env) => env.WHOSE_TURN_APP_VERSION || 'latest';

export const appDir = (data = dataDir()) => join(data, 'app');

export const packagePath = (data = dataDir()) => join(appDir(data), 'node_modules', 'whose-turn');

/** The version in the installed package.json, or null when there is none. */
export const installedVersion = (data = dataDir(), read = (path) => readFileSync(path, 'utf8')) => {
  try {
    return JSON.parse(read(join(packagePath(data), 'package.json'))).version || null;
  } catch {
    return null;
  }
};

/** Only a missing package is installed here; a newer version is the running server's job. */
export const needsInstall = (installed) => !installed;

/** `--ignore-scripts`: the package declares no install scripts, so a release that gained one would run nothing on the user's machine. */
export const npmInstallArgs = (data, version) => ['install', '--prefix', appDir(data), '--no-audit', '--no-fund', '--no-save', '--ignore-scripts', `whose-turn@${version}`];

const execute = (file, args, options = {}) => {
  const result = spawnSync(file, args, { stdio: ['ignore', 2, 2], ...options });
  return { status: result.status, missing: result.error?.code === 'ENOENT' };
};

/** Installs the package when there is none; returns its folder, or null after printing why it could not. */
export const ensurePackage = ({ data = dataDir(), version = wantedVersion(), run = execute, read, log = console.error } = {}) => {
  if (!needsInstall(installedVersion(data, read))) {
    return packagePath(data);
  }
  const { status, missing } = run('npm', npmInstallArgs(data, version));
  if (missing) {
    log('Whose Turn needs npm on PATH to install its monitor; npm comes with Node 22.');
    return null;
  }
  if (status !== 0) {
    log(`Whose Turn could not install whose-turn@${version} into ${appDir(data)} (npm exited with ${status}).`);
    return null;
  }
  return packagePath(data);
};

/** The argv the command runs once the package is in place; null for `path`, which needs no install. */
export const commandFor = (command, args, path) => ({
  install: ['bash', [join(path, 'install.sh')]],
  open: ['bash', [join(path, 'open.sh'), ...args.filter((arg) => arg === '--browser')], { env: { ...process.env, WHOSE_TURN_PORT: String(port) } }],
  start: [process.execPath, [join(path, 'server.mjs')], { detached: true, cwd: path }],
})[command] || null;

export const main = (argv = process.argv.slice(2), { run = execute, start = (file, args, options) => spawn(file, args, { stdio: 'ignore', windowsHide: true, ...options }).unref(), out = console.log, log = console.error, data = dataDir() } = {}) => {
  const [command, ...args] = argv;
  if (command === 'path') {
    out(packagePath(data));
    return 0;
  }
  if (!['install', 'open', 'start'].includes(command)) {
    log('usage: node app.mjs path | install | open [--browser] | start');
    return 2;
  }
  const path = ensurePackage({ data, run, log });
  if (!path) {
    return 1;
  }
  const [file, fileArgs, options = {}] = commandFor(command, args, path);
  if (options.detached) {
    start(file, fileArgs, options);
    return 0;
  }
  return run(file, fileArgs, { ...options, stdio: 'inherit' }).status ?? 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
