#!/usr/bin/env node
// What a `git push` from <cwd> would send out, and the cache key of that text: the one place the
// push guard's range, log format and verdict key are defined. on-git-push.mjs imports it; the
// push-guard mod, which cannot import outside its engine sandbox, runs it as a process:
//   node push-range.mjs <cwd> [<command>]   ->   JSON { off, gitDir, log, branch, scope, key, cached }
// `off` is the person's per-repository switch (`git config cerberus.pushguard off`). `scope` is
// `secrets` when every destination is a private GitHub repository: a work email or a client name
// is normal there, but a committed secret still outlives the repository going public, so only
// secrets are hunted. It is `all` for a public repository and for any destination it cannot prove
// private (another host, no network, a rate limit). `log` is empty when nothing new would leave.
// `cached` is true when that exact text was judged clean under that scope.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const FMT = '%h author: %an <%ae> committer: %cn <%ce>%n%B%n---';

function git(cwd, args, input) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'ignore'] })
      .replace(/\n+$/, '');
  } catch {
    return null;
  }
}

const GITHUB = /^(?:https:\/\/(?:[^@/]+@)?github\.com\/|(?:ssh:\/\/)?git@github\.com[:/])([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

// The push's destination URLs: the remote or URL the command names, else the branch's push remote.
function destinations(cwd, command) {
  const words = (command.match(/(?:^|[;&|(\s])git(?:\s+-[Cc]\s+\S+)*\s+push((?:\s+[^;&|()\s]+)*)/)?.[1] ?? '')
    .trim().split(/\s+/).filter(Boolean);
  const named = words.find(w => !w.startsWith('-'));
  if (named && (named.includes(':') || named.includes('/'))) return [named];
  const branch = git(cwd, ['branch', '--show-current']);
  const remote = named ?? (branch && (git(cwd, ['config', '--get', `branch.${branch}.pushRemote`]) ??
    git(cwd, ['config', '--get', 'remote.pushDefault']) ?? git(cwd, ['config', '--get', `branch.${branch}.remote`]))) ?? 'origin';
  return git(cwd, ['remote', 'get-url', '--push', '--all', remote])?.split('\n') ?? [];
}

async function isPrivate(url) {
  const m = GITHUB.exec(url);
  if (!m) return false;
  const api = process.env.CERBERUS_GITHUB_API ?? 'https://api.github.com';
  try {
    const r = await fetch(`${api}/repos/${m[1]}/${m[2]}`, {
      headers: { 'user-agent': 'cerberus-push-guard', accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(5000) });
    return r.status === 404;
  } catch {
    return false;
  }
}

export async function pushRange(cwd, command = '') {
  const gitDir = git(cwd, ['rev-parse', '--absolute-git-dir']);
  if (!gitDir) return null;
  if (git(cwd, ['config', '--get', 'cerberus.pushguard']) === 'off') return { off: true, gitDir };
  const urls = destinations(cwd, command);
  const scope = urls.length && (await Promise.all(urls.map(isPrivate))).every(Boolean) ? 'secrets' : 'all';
  // The commits past the upstream, or past origin's default branch for a branch never pushed.
  const base = [['@{upstream}', ['rev-parse', '--abbrev-ref', '@{upstream}']],
    ['origin/HEAD', ['rev-parse', '--verify', '-q', 'origin/HEAD']],
    ['origin/main', ['rev-parse', '--verify', '-q', 'origin/main']]]
    .find(([, probe]) => git(cwd, probe) !== null)?.[0];
  const log = git(cwd, ['log', `--format=${FMT}`, base ? `${base}..HEAD` : 'HEAD']) ?? '';
  const branch = git(cwd, ['branch', '--show-current']) ?? '';
  const key = log ? git(cwd, ['hash-object', '--stdin'], `${scope}\n${log}\n${branch}`) : null;
  const commonDir = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']) ?? gitDir;
  return { off: false, gitDir, commonDir, log, branch, scope, key, allow: allowed(commonDir),
    cached: Boolean(key) && existsSync(verdictPath(gitDir, key)) };
}

// The person's whitelist for this repository, one accepted fingerprint per line, shared by every
// worktree. A push whose only findings are on it goes out; a new finding is asked about, and the
// person's yes adds it here (on-git-push.mjs). Like the off switch, it is the person's: a tool call
// aimed at it is refused.
export const allowPath = (commonDir) => join(commonDir, 'cerberus-allow');
export const pendingPath = (commonDir) => join(commonDir, 'cerberus-allow.pending');

export function allowed(commonDir) {
  try {
    return readFileSync(allowPath(commonDir), 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// An entry is an exact value (an email, a name) or a tracker key such as `RMA`, which accepts any
// `RMA-<n>` id and any `rma-<n>-<slug>` branch. push-guard.ts repeats `covers`; it cannot import.
const TRACKER = /\b([A-Za-z][A-Za-z0-9]*)-\d+[\w./-]*/g;

/** The tracker key a finding consists of, or null when it holds anything besides tracker ids. */
const trackerKey = (text) => {
  const keys = [...text.matchAll(TRACKER)].map(m => m[1].toUpperCase());
  const rest = text.replace(TRACKER, '').replace(/[\s,;:]+/g, '');
  return keys.length && !rest && keys.every(k => k === keys[0]) ? keys[0] : null;
};

/** What the whitelist keeps for a finding the person accepted: its tracker key, else the value. */
export const entryFor = (what) => {
  const text = String(what).trim();
  return trackerKey(text) ?? text;
};

export const covers = (entry, what) => {
  const text = String(what).trim();
  return text.toLowerCase() === entry.toLowerCase() || trackerKey(text) === entry.toUpperCase();
};

/** The findings the whitelist does not cover. */
export const unaccepted = (leaks, allow) => leaks.filter(l => !allow.some(entry => covers(entry, l.what)));

export function addAllowed(commonDir, whats) {
  const next = [...new Set([...allowed(commonDir), ...whats.map(entryFor).filter(Boolean)])];
  writeFileSync(allowPath(commonDir), `${next.join('\n')}\n`);
}

export const verdictPath = (gitDir, key) => join(gitDir, 'cerberus-verdicts', key);

export function recordClean(gitDir, key) {
  mkdirSync(join(gitDir, 'cerberus-verdicts'), { recursive: true });
  writeFileSync(verdictPath(gitDir, key), 'clean\n');
}

// The mod layer's verdict on findings off the whitelist, handed to the classic hook so it asks the
// person about exactly these instead of judging again (RMA-411): two judges of one push disagreed,
// and the second's clean verdict let through a push the first had promised to ask about.
export function recordFlagged(commonDir, key, whats) {
  writeFileSync(pendingPath(commonDir), JSON.stringify({ key, whats }));
}

/** The findings the mod layer flagged for this exact push text, or null when it flagged none. */
export function flagged(commonDir, key) {
  try {
    const pending = JSON.parse(readFileSync(pendingPath(commonDir), 'utf8'));
    return pending.key === key && Array.isArray(pending.whats) && pending.whats.length ? pending.whats : null;
  } catch {
    return null;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const [cmd, cwd, key, whats] = process.argv.slice(2);
  if (cmd === 'record' && cwd && key) {
    recordClean(cwd, key);
  } else if (cmd === 'flag' && cwd && key && whats) {
    recordFlagged(cwd, key, JSON.parse(whats));
  } else {
    console.log(JSON.stringify(await pushRange(cmd ?? process.cwd(), cwd)));
  }
}

export const judgePrompt = (root, scope, allow = []) =>
  readFileSync(join(root, scope === 'secrets' ? 'push-judge-secrets-prompt.txt' : 'push-judge-prompt.txt'), 'utf8') +
  (allow.length ? `\nThe person has accepted these fingerprints for this repository; do not report them: ${JSON.stringify(allow)}` : '');
