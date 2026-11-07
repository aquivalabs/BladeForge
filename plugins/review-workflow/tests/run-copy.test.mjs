import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ARGS_LINE, embed } from '../run-copy.mjs';

const SCRIPT = resolve(import.meta.dirname, '..', 'run-copy.mjs');
const WORKFLOW = readFileSync(resolve(import.meta.dirname, '..', 'workflow.js'), 'utf8');
const embedded = (copy) => JSON.parse(copy.slice(copy.indexOf('const parsedArgs = ') + 19, copy.indexOf(';\nconst { base,')));

test('the real workflow.js has exactly one args line, and the copy carries the args in its place', () => {
  const copy = embed(WORKFLOW, { base: 'origin/main', hash: 'abc' });
  assert.ok(!copy.includes(ARGS_LINE));
  assert.deepEqual(embedded(copy), { base: 'origin/main', hash: 'abc' });
  assert.equal(copy.length - WORKFLOW.length, JSON.stringify({ base: 'origin/main', hash: 'abc' }).length - ARGS_LINE.length + 'const parsedArgs = ;'.length);
});

test('a workflow.js without the args line, or with two, is refused rather than copied wrong', () => {
  assert.throws(() => embed('return 1;', {}), /exactly one args line/);
  assert.throws(() => embed(`${ARGS_LINE}\n${ARGS_LINE}`, {}), /exactly one args line/);
});

function clone() {
  const root = mkdtempSync(join(tmpdir(), 'run-copy-'));
  mkdirSync(join(root, 'plugins', 'review', 'agents'), { recursive: true });
  mkdirSync(join(root, 'plugins', 'meta', 'skills', 'ockham'), { recursive: true });
  writeFileSync(join(root, 'plugins', 'meta', 'skills', 'ockham', 'SKILL.md'), '# Ockham\nMake the simplest change.\n');
  writeFileSync(join(root, 'args.json'), JSON.stringify({ base: 'origin/main', hash: 'h1', round: 1 }));
  return root;
}

test('the command embeds the args and every configured skill, read whole', () => {
  const root = clone();
  writeFileSync(join(root, 'config.json'), JSON.stringify({ agents: [{ name: 'craft', skills: ['meta:ockham'] }] }));
  const out = join(root, 'copy.js');
  execFileSync('node', [SCRIPT, '--args', join(root, 'args.json'), '--agents-dir', join(root, 'plugins', 'review', 'agents'),
    '--config', join(root, 'config.json'), '--out', out]);
  const args = embedded(readFileSync(out, 'utf8'));
  assert.equal(args.hash, 'h1');
  assert.equal(args.skillTexts['meta:ockham'].text, '# Ockham\nMake the simplest change.\n');
});

test('a configured skill with no readable SKILL.md stops the command and writes no copy', () => {
  const root = clone();
  writeFileSync(join(root, 'config.json'), JSON.stringify({ agents: [{ name: 'craft', skills: ['meta:missing'] }] }));
  const run = spawnSync('node', [SCRIPT, '--args', join(root, 'args.json'), '--agents-dir', join(root, 'plugins', 'review', 'agents'),
    '--config', join(root, 'config.json'), '--out', join(root, 'copy.js')], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /meta:missing/);
  assert.throws(() => readFileSync(join(root, 'copy.js')));
});
