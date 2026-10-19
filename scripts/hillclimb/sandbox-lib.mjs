// What every BladeForge eval runner shares around a nested `claude -p`: a sandbox at a stable path
// per concurrency slot, and one streamed run with its transcript, served model and usage. The
// trigger runner and the leak-check quality runner both import it, so it is listed in their
// `_state.json.harness_paths` and the harness gate covers it.
import { spawn } from 'node:child_process';
import { mkdirSync, realpathSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

// The isolation every nested run gets: no user settings (so no user plugins, hooks or CLAUDE.md
// imports from settings) and no MCP servers. A score then does not depend on whose machine took
// it, and the prompt prefix stays stable enough to cache.
export const ISOLATION = ['--setting-sources', 'project', '--strict-mcp-config'];

// Each concurrent run gets a sandbox at a FIXED path, one per slot. The cwd lands in the nested
// claude's system prompt, so a fresh path per run missed the prompt cache every time; a stable
// path lets runs after the first read it.
const slots = [];

/** A sandbox for one run, emptied first; `release()` frees its slot and removes it. */
export function sandbox(prefix) {
  let k = slots.indexOf(false);
  if (k < 0) k = slots.length;
  slots[k] = true;
  const dir = join(tmpdir(), `${prefix}-slot${k}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // A stable cwd also means a stable per-project state dir under ~/.claude/projects. Auto-memory
  // written there by one run would be read by the next, so it is removed before every run.
  const slug = realpathSync(dir).replace(/[^a-zA-Z0-9]/g, '-');
  rmSync(join(homedir(), '.claude', 'projects', slug, 'memory'), { recursive: true, force: true });
  return { dir, release: () => { rmSync(dir, { recursive: true, force: true }); slots[k] = false; } };
}

/**
 * One nested `claude -p` run, streamed. `onBlock(block, stop)` sees every assistant content
 * block after it is recorded; calling `stop(reason)` ends the run early with that stop reason.
 * Resolves `{ transcript, model, usage, stop_reason, status }`; the model is the served one.
 */
export function streamClaude({ cwd, prompt, model, args = [], env = {}, timeoutS, timeoutReason, onBlock = () => {} }) {
  const argv = ['-p', prompt, '--output-format', 'stream-json', '--verbose', ...ISOLATION, ...args];
  if (model) argv.push('--model', model);
  const childEnv = { ...process.env, ...env };
  delete childEnv.CLAUDECODE;
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn('claude', argv, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'ignore'] });
    const transcript = [{ role: 'user', content: prompt }];
    const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    const seen = new Set();
    let served = null, stopReason = 'end_turn', buf = '', settled = false;
    const settle = (fn) => { if (settled) return; settled = true; clearTimeout(timer); child.kill(); fn(); };
    const finish = () => settle(() => resolveRun({ transcript, model: served, usage, stop_reason: stopReason, status: 'ok' }));
    const stop = (reason) => { stopReason = reason; finish(); };
    const timer = setTimeout(() => stop(timeoutReason), timeoutS * 1000);
    const onEvent = (ev) => {
      if (ev.type === 'user' && Array.isArray(ev.message?.content)) {
        for (const b of ev.message.content) if (b.type === 'tool_result')
          transcript.push({ role: 'tool_result', content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) });
        return;
      }
      if (ev.type !== 'assistant' || !ev.message) return;
      const msg = ev.message;
      if (msg.model) served = msg.model;
      if (msg.id && !seen.has(msg.id) && msg.usage) {
        seen.add(msg.id);
        for (const k of Object.keys(usage)) usage[k] += msg.usage[k] ?? 0;
      }
      for (const block of msg.content ?? []) {
        if (block.type === 'text' && block.text) transcript.push({ role: 'assistant', content: block.text });
        if (block.type === 'tool_use') transcript.push({ role: 'tool_call', name: block.name, content: JSON.stringify(block.input ?? {}, null, 2) });
        onBlock(block, stop);
        if (settled) return;
      }
    };
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let nl;
      while (!settled && (nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (line.trim()) try { onEvent(JSON.parse(line)); } catch { /* a non-JSON line is noise, not a verdict */ }
      }
    });
    child.on('error', (e) => settle(() => rejectRun(e)));
    child.on('close', finish);
  });
}
