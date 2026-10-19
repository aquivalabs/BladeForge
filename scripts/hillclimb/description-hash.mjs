#!/usr/bin/env node
// Print the sha256 of a skill's parsed `description:`. eval-gate compares it with
// `evals/result.json` `trigger.description_hash` to tell a fresh measurement from a stale one.
//   node scripts/hillclimb/description-hash.mjs <skill-dir>
// Exit 1 with a one-line reason when the skill has no description.
import { descriptionHash } from './skill-description.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node description-hash.mjs <skill-dir>');
  process.exit(2);
}
let hash;
try {
  hash = descriptionHash(dir);
} catch (e) {
  console.error(`${dir}: cannot read SKILL.md (${e.code || e.message})`);
  process.exit(1);
}
if (!hash) {
  console.error(`${dir}/SKILL.md: no description: in frontmatter`);
  process.exit(1);
}
console.log(hash);
