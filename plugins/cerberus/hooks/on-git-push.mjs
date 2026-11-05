#!/usr/bin/env node
// CERBERUS push guard, classic layer — the work behind on-git-push.sh, which runs this only when a
// tool call mentions a push or the guard's own state. A `git push` sends commits out, and a commit
// carries a message, an author, a committer and a branch name that no file-edit check reads. Before
// an agent's push runs, this hands those commits to a nested `claude -p` judge with the prompt in
// push-judge-prompt.txt. A finding on the repository's whitelist passes; a new one is put to the
// person as a permission question, and their yes lets the push run and, once it has, adds the finding
// to the whitelist (PostToolUse). A judge that cannot answer still denies the push.
//
// The judge is not the agent's to skip: this hook runs it. Its one weak point is the verdict cache,
// which a shell can still forge on purpose; a tool call aimed at the cache or at the per-repository
// off switch is refused, best effort. A push typed by a person in their own terminal is never seen.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addAllowed, judgePrompt, pendingPath, pushRange, recordClean, unaccepted } from './push-range.mjs';

export const PUSH = /(^|[;&|(\s])git(\s+-[Cc]\s+\S+)*\s+push(\s|$)/;

const decide = (permissionDecision) => (reason) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason: reason } }) + '\n');
  process.exit(0);
};
const deny = decide('deny');
const ask = decide('ask');

let input;
try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
const tool = input.tool_input ?? {};
const command = String(tool.command ?? '');

// After a push the person approved: the findings they were asked about join the whitelist.
if (input.hook_event_name === 'PostToolUse') {
  if (PUSH.test(command)) {
    const range = await pushRange(input.cwd || process.cwd(), command);
    try {
      const pending = JSON.parse(readFileSync(pendingPath(range.commonDir), 'utf8'));
      if (pending.command === command) addAllowed(range.commonDir, pending.whats);
      rmSync(pendingPath(range.commonDir), { force: true });
    } catch { /* nothing was asked */ }
  }
  process.exit(0);
}

if (/cerberus-verdicts|cerberus-allow|cerberus\.pushguard/.test(`${command} ${tool.file_path ?? ''}`))
  deny('CERBERUS: the push guard\'s verdicts, whitelist and on/off switch belong to the person, not to an agent. ' +
    'Push, and the guard judges the outgoing commits itself. To turn it off for this repository, the person ' +
    'runs `git config cerberus.pushguard off` in their own terminal.');
if (!PUSH.test(command)) process.exit(0);

const range = await pushRange(input.cwd || process.cwd(), command);
if (!range || range.off || !range.log || range.cached) process.exit(0);

const prompt = `${judgePrompt(import.meta.dirname, range.scope, range.allow)}\n` +
  `<branch>${range.branch}</branch>\n<commits>\n${range.log}\n</commits>`;
const judgeDir = mkdtempSync(join(tmpdir(), 'cerberus-judge-'));
let answer = '';
try {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  answer = execFileSync('claude', ['-p', '--model', 'sonnet', '--setting-sources', 'project', '--strict-mcp-config',
    '--output-format', 'text'], { cwd: judgeDir, env, input: prompt, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 110_000 });
} catch { /* no answer: handled below as "cannot judge" */ }
rmSync(judgeDir, { recursive: true, force: true });

let leaks = null;
try { leaks = JSON.parse(answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1)).leaks; } catch { /* unsure */ }
if (!Array.isArray(leaks))
  deny('CERBERUS: the push guard could not judge the outgoing commits (no answer from claude -p). The push stays ' +
    'blocked until it can: check that claude is on PATH and signed in, then push again.');
const fresh = unaccepted(leaks, range.allow);
if (fresh.length) {
  writeFileSync(pendingPath(range.commonDir), JSON.stringify({ command, whats: fresh.map(l => l.what) }));
  ask(`CERBERUS: this push would publish ${range.scope === 'secrets' ? 'a secret' : 'work fingerprints'} not on this repository's whitelist — ${fresh.map(l => `${l.where}: ${l.what}`).join('; ')}. ` +
    'Allow it to push and add them to the whitelist. Deny it, and fix them with cerberus:leak-check (amend or reword the commits, reset a work author, rename the branch).');
}
recordClean(range.gitDir, range.key);
