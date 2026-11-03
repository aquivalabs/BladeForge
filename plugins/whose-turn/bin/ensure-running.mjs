/** Starts the monitor when it is down: the launch agent on macOS, the user unit on Linux, else a detached server through app.mjs. Repoints an agent that runs a server.mjs that is gone, one an earlier plugin carried in the plugin cache, or the package at a version other than the pin. Platform, runner and probe are injectable. */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installedVersion, needsInstall, packagePath } from './app.mjs';
import { base } from './lib.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), 'app.mjs');
const LABEL = 'local.whose-turn';

const AGENT_FILES = {
  darwin: (home) => join(home, 'Library', 'LaunchAgents', `${LABEL}.plist`),
  linux: (home) => join(home, '.config', 'systemd', 'user', 'whose-turn.service'),
};

/** True when the agent text runs a server.mjs that is gone, one inside a Claude Code plugin cache, or the package's own server at a version other than the pin. */
export const staleAgent = (text, { exists = existsSync, server = join(packagePath(), 'server.mjs'), outdated = () => needsInstall(installedVersion()) } = {}) => {
  const named = String(text).match(/(?:<string>|")([^"<]*\/server\.mjs)(?:<\/string>|")/)?.[1];
  if (!named) {
    return false;
  }
  if (named === server) {
    return outdated();
  }
  return !exists(named) || named.includes('/.claude/plugins/cache/');
};

const detachedServer = () => [process.execPath, [APP, 'start'], { detached: true }];

// Each platform returns the argv steps to try in order; a step that fails hands over to the next.
const STARTS = {
  darwin: ({ home, uid, exists }) => {
    if (!exists(AGENT_FILES.darwin(home))) {
      return [detachedServer()];
    }
    return [
      ['launchctl', ['kickstart', `gui/${uid}/${LABEL}`]],
      ['launchctl', ['bootstrap', `gui/${uid}`, AGENT_FILES.darwin(home)]],
      detachedServer(),
    ];
  },
  linux: ({ home, exists }) => {
    if (!exists(AGENT_FILES.linux(home))) {
      return [detachedServer()];
    }
    return [['systemctl', ['--user', 'start', 'whose-turn']], detachedServer()];
  },
  win32: () => [detachedServer()],
};

const execute = (file, args, { detached = false } = {}) => {
  if (detached) {
    spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return true;
  }
  return spawnSync(file, args, { stdio: 'ignore' }).status === 0;
};

const reachable = async () => {
  try {
    await fetch(`${base}/api/summary`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
};

const pause = (millis) => new Promise((resolve) => setTimeout(resolve, millis));

/** Returns true when the monitor answers, starting it first if it does not. */
export const ensureRunning = async ({
  platform = process.platform,
  run = execute,
  probe = reachable,
  exists = existsSync,
  home = homedir(),
  uid = process.getuid?.(),
  wait = pause,
  tries = 5,
  read = (path) => readFileSync(path, 'utf8'),
  stale = (text) => staleAgent(text, { exists }),
} = {}) => {
  const agent = AGENT_FILES[platform]?.(home);
  if (agent && exists(agent) && stale(read(agent))) {
    run(process.execPath, [APP, 'install'], { detached: true });
  }
  if (await probe()) {
    return true;
  }
  const steps = STARTS[platform]?.({ home, uid, exists }) || [detachedServer()];
  for (const [file, args, options] of steps) {
    if (!run(file, args, options)) {
      continue;
    }
    for (let attempt = 0; attempt < tries; attempt++) {
      await wait(1000);
      if (await probe()) {
        return true;
      }
    }
    return false;
  }
  return false;
};
