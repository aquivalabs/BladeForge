#!/usr/bin/env node
// Prints `skillProofs` for /review to pass to workflow.js: for every skill an enabled lens names, the
// SKILL.md path and its second half, from which the lens must quote one line back, proving it read the
// whole file (RMA-345).
// Usage: node skill-proofs.mjs --agents-dir <abs dir of review-<lens>.md> --config <review.config.json>
// Exits 1, naming the ids, when a configured skill has no readable SKILL.md: a lens never judges without it.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

/** Every skill id an enabled lens names: its `skills` and its `extensionSkill`. */
export const configuredSkills = (config) => {
  const lenses = (config?.agents || []).filter((lens) => lens?.enabled !== false);
  const ids = lenses.flatMap((lens) => [...(lens.skills || []), ...(lens.extensionSkill ? [lens.extensionSkill] : [])]);
  return [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()))];
};

const newestVersion = (dir) => {
  try {
    return readdirSync(dir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] || null;
  } catch {
    return null;
  }
};

/** The SKILL.md path for `plugin:skill`, in the same layout that holds agentsDir (review.md § Step 3). */
export const skillPath = (agentsDir, id) => {
  const [plugin, skill] = id.includes(':') ? id.split(':') : [id, id];
  const dir = agentsDir.replace(/\/+$/, '');
  const clone = dir.match(/^(.*)\/plugins\/review\/agents$/);
  if (clone) {
    return join(clone[1], 'plugins', plugin, 'skills', skill, 'SKILL.md');
  }
  const cache = dir.match(/^(.*)\/review\/[^/]+\/agents$/);
  if (cache) {
    const version = newestVersion(join(cache[1], plugin));
    return version ? join(cache[1], plugin, version, 'skills', skill, 'SKILL.md') : null;
  }
  return null;
};

/** The shortest quote a proof accepts: a heading such as `## Rules` is guessable without reading. */
export const MIN_QUOTE = 20;

/** The second half of `text`: its 1-based first line and the text from there to the end. */
export const proofTail = (text) => {
  const lines = text.split('\n');
  const start = Math.floor(lines.length * 0.5);
  const tail = lines.slice(start);
  return tail.some((line) => line.trim().length >= MIN_QUOTE) ? { line: start + 1, text: tail.join('\n') } : null;
};

/** `{ proofs, missing }`: a proof per configured skill, and the ids with no readable file. */
export const readSkillProofs = (agentsDir, config, read = (path) => readFileSync(path, 'utf8')) => {
  const proofs = {};
  const missing = [];
  for (const id of configuredSkills(config)) {
    const path = skillPath(agentsDir, id);
    try {
      const proof = path ? proofTail(read(path)) : null;
      if (proof) {
        proofs[id] = { path, ...proof };
      } else {
        missing.push(id);
      }
    } catch {
      missing.push(id);
    }
  }
  return { proofs, missing };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { 'agents-dir': { type: 'string' }, config: { type: 'string' } }, strict: true });
  if (!values['agents-dir'] || !values.config) {
    console.error('usage: skill-proofs.mjs --agents-dir <dir> --config <review.config.json>');
    process.exit(2);
  }
  const { proofs, missing } = readSkillProofs(values['agents-dir'], JSON.parse(readFileSync(values.config, 'utf8')));
  if (missing.length) {
    console.error(`skill-proofs: no readable SKILL.md for ${missing.join(', ')}`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(proofs));
}
