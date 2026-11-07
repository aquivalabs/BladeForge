#!/usr/bin/env node
// Writes a run copy of workflow.js with its args embedded, for /review to invoke by path (RMA-418).
// Since RMA-395 the args carry every lens's SKILL.md whole, about 110 KB here, and pasting them into
// the Workflow call cost about 28k output tokens a round. /review writes the small args (no
// skillTexts) to a file; this script reads the skills itself, as skill-texts.mjs does, and embeds both.
// Usage: node run-copy.mjs --args <args.json> --agents-dir <abs dir> --config <review.config.json> --out <copy.js>
// Exits 1, naming the ids, when a configured skill has no readable SKILL.md: a lens never judges without it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { readSkillTexts } from './skill-texts.mjs';

/** The one line of workflow.js that reads the Workflow tool's `args`; the copy replaces it. */
export const ARGS_LINE = 'const parsedArgs = typeof args === "string" ? JSON.parse(args) : args;';

/** workflow.js source with `args` embedded in place of the line that reads them. */
export function embed(source, args) {
  const at = source.indexOf(ARGS_LINE);
  if (at < 0 || source.indexOf(ARGS_LINE, at + 1) >= 0) {
    throw new Error('run-copy: workflow.js no longer has exactly one args line to replace');
  }
  return `${source.slice(0, at)}const parsedArgs = ${JSON.stringify(args)};${source.slice(at + ARGS_LINE.length)}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: { args: { type: 'string' }, 'agents-dir': { type: 'string' }, config: { type: 'string' }, out: { type: 'string' } },
    strict: true,
  });
  if (!values.args || !values['agents-dir'] || !values.config || !values.out) {
    console.error('usage: run-copy.mjs --args <args.json> --agents-dir <dir> --config <review.config.json> --out <copy.js>');
    process.exit(2);
  }
  const { texts, missing } = readSkillTexts(values['agents-dir'], JSON.parse(readFileSync(values.config, 'utf8')));
  if (missing.length) {
    console.error(`run-copy: no readable SKILL.md for ${missing.join(', ')}`);
    process.exit(1);
  }
  const args = { ...JSON.parse(readFileSync(values.args, 'utf8')), skillTexts: texts };
  const source = readFileSync(join(import.meta.dirname, 'workflow.js'), 'utf8');
  writeFileSync(values.out, embed(source, args));
  process.stdout.write(`${values.out}\n`);
}
