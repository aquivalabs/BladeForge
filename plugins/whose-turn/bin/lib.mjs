/** Shared by the plugin's scripts: where the monitor keeps its data and listens, a safe one-line text, and a short-timeout JSON fetch. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
export const flat = (text, limit = 200) => String(text || '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u{E0000}-\u{E007F}]+/gu, ' ').slice(0, limit);

/** The text when it matches `pattern` after flattening, else ''. */
const checked = (pattern) => (text) => {
  const value = flat(text, 40).trim();
  return pattern.test(value) ? value : '';
};

/** A version string, or '' when the text is not one. */
export const semver = checked(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/);

/** An ISO-like timestamp, or '' when the text is not one. */
export const timestamp = checked(/^[\d:.TZ+-]+$/);

/** Text reduced to word characters, dots and dashes, safe inside a quoted attribute or an id. */
export const slug = (text, limit = 40) => String(text || '').replace(/[^\w.-]+/g, '_').slice(0, limit);

/** Records `current` as the version this plugin saw and returns the one seen before it, or '' on a first run or a failed write. */
export const seenVersion = (current) => {
  const file = join(dataDir(), 'plugin-seen-version');
  let previous = '';
  try {
    previous = semver(readFileSync(file, 'utf8'));
  } catch {
    writeSeen(file, current);
    return '';
  }
  return previous === current || writeSeen(file, current) ? previous : '';
};

const writeSeen = (file, current) => {
  try {
    writeFileSync(file, `${current}\n`);
    return true;
  } catch {
    return false;
  }
};

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
