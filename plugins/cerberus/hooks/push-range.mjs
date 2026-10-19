#!/usr/bin/env node
// What a `git push` from <cwd> would send out, and the cache key of that text: the one place the
// push guard's range, log format and verdict key are defined. on-git-push.mjs imports it; the
// push-guard mod, which cannot import outside its engine sandbox, runs it as a process:
//   node push-range.mjs <cwd>   ->   JSON { off, gitDir, log, branch, key, cached }
// `off` is the person's per-repository switch (`git config cerberus.pushguard off`). `log` is
// empty when nothing new would leave. `cached` is true when that exact text was judged clean.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

export function pushRange(cwd) {
  const gitDir = git(cwd, ['rev-parse', '--absolute-git-dir']);
  if (!gitDir) return null;
  if (git(cwd, ['config', '--get', 'cerberus.pushguard']) === 'off') return { off: true, gitDir };
  // The commits past the upstream, or past origin's default branch for a branch never pushed.
  const base = [['@{upstream}', ['rev-parse', '--abbrev-ref', '@{upstream}']],
    ['origin/HEAD', ['rev-parse', '--verify', '-q', 'origin/HEAD']],
    ['origin/main', ['rev-parse', '--verify', '-q', 'origin/main']]]
    .find(([, probe]) => git(cwd, probe) !== null)?.[0];
  const log = git(cwd, ['log', `--format=${FMT}`, base ? `${base}..HEAD` : 'HEAD']) ?? '';
  const branch = git(cwd, ['branch', '--show-current']) ?? '';
  const key = log ? git(cwd, ['hash-object', '--stdin'], `${log}\n${branch}`) : null;
  return { off: false, gitDir, log, branch, key, cached: Boolean(key) && existsSync(verdictPath(gitDir, key)) };
}

export const verdictPath = (gitDir, key) => join(gitDir, 'cerberus-verdicts', key);

export function recordClean(gitDir, key) {
  mkdirSync(join(gitDir, 'cerberus-verdicts'), { recursive: true });
  writeFileSync(verdictPath(gitDir, key), 'clean\n');
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const [cmd, cwd, key] = process.argv.slice(2);
  if (cmd === 'record' && cwd && key) {
    recordClean(cwd, key);
  } else {
    console.log(JSON.stringify(pushRange(cmd ?? process.cwd())));
  }
}
