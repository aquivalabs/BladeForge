#!/usr/bin/env node
// Prints `skillTexts` for /review to pass to workflow.js: for every skill an enabled lens names, the
// SKILL.md path and its whole text, which the script puts into the lens prompt (RMA-395).
// Usage: node skill-texts.mjs --agents-dir <abs dir of review-<lens>.md> --config <review.config.json>
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

/** `{ texts, missing }`: the SKILL.md text per configured skill, and the ids with no readable file. */
export const readSkillTexts = (agentsDir, config, read = (path) => readFileSync(path, 'utf8')) => {
  const texts = {};
  const missing = [];
  for (const id of configuredSkills(config)) {
    const path = skillPath(agentsDir, id);
    try {
      const text = path ? read(path) : '';
      if (text.trim()) {
        texts[id] = { path, text };
      } else {
        missing.push(id);
      }
    } catch {
      missing.push(id);
    }
  }
  return { texts, missing };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { 'agents-dir': { type: 'string' }, config: { type: 'string' } }, strict: true });
  if (!values['agents-dir'] || !values.config) {
    console.error('usage: skill-texts.mjs --agents-dir <dir> --config <review.config.json>');
    process.exit(2);
  }
  const { texts, missing } = readSkillTexts(values['agents-dir'], JSON.parse(readFileSync(values.config, 'utf8')));
  if (missing.length) {
    console.error(`skill-texts: no readable SKILL.md for ${missing.join(', ')}`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(texts));
}
