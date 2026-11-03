/** Shared by the plugin's scripts: where the monitor keeps its data and listens, a safe one-line text, and a short-timeout JSON fetch. */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The monitor's data directory when WHOSE_TURN_DATA is not set, the same rule as the server's `defaultDataDir`. */
export const defaultDataDir = (platform = process.platform, env = process.env, home = homedir()) => {
  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'whose-turn');
  }
  if (platform === 'win32') {
    return join(env.APPDATA || home, 'whose-turn');
  }
  return join(env.XDG_CONFIG_HOME || join(home, '.config'), 'whose-turn');
};

export const dataDir = () => process.env.WHOSE_TURN_DATA || defaultDataDir();

/** The monitor's port: WHOSE_TURN_PORT, then `port` in the config file, then 8765, the same rule as the server's `resolvePort`. */
export const resolvePort = (directory, env = process.env) => {
  if (env.WHOSE_TURN_PORT) {
    return Number(env.WHOSE_TURN_PORT);
  }
  try {
    return Number(JSON.parse(readFileSync(env.WHOSE_TURN_CONFIG || join(directory, 'config.json'), 'utf8')).port || 8765);
  } catch {
    return 8765;
  }
};

export const port = resolvePort(dataDir());
export const base = `http://127.0.0.1:${port}`;

export const inboxHasItems = () => existsSync(join(dataDir(), 'inbox.pending'));

// eslint-disable-next-line no-control-regex
export const flat = (text, limit = 200) => String(text || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, limit);

/** The endpoint body, JSON of any shape. @returns {Promise<any>} */
export const getJson = async (path, timeoutMs = 3000) => {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  return response.json();
};

/** The endpoint body, JSON of any shape. @returns {Promise<any>} */
export const postJson = async (path, body, timeoutMs = 10000) => {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  return response.json();
};
