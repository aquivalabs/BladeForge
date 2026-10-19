// The one frontmatter reader for a skill's `description:`. The trigger runner,
// the result writer and eval-gate all import it, so the description that is
// measured, the one that is hashed, and the one the gate checks cannot disagree.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The `description:` entry as written: its line plus every following line that is
 * blank or indented, up to the next top-level key. Both readers below start here,
 * so they agree on where the entry ends.
 */
function descriptionEntry(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  const lines = (m ? m[1] : text).split('\n');
  const idx = lines.findIndex(l => /^description:(\s|$)/.test(l));
  if (idx < 0) return null;
  const entry = [lines[idx]];
  for (const l of lines.slice(idx + 1)) {
    if (l.trim() && !/^[ \t]/.test(l)) break;
    entry.push(l);
  }
  return entry;
}

/**
 * The parsed `description:` value, or null. A YAML block scalar
 * (`description: >` / `|`) is folded or kept literal; a quoted inline value has
 * its surrounding quotes stripped and nothing else, escapes included. This is
 * byte-for-byte what score-description.py read, so saved description hashes
 * stay valid across the switch.
 */
export function descriptionFrom(text) {
  const entry = descriptionEntry(text);
  if (!entry) return null;
  const inline = entry[0].replace(/^description:\s*/, '').trim();
  if (['>', '|', '>-', '|-', '>+', '|+'].includes(inline)) {
    return entry.slice(1).map(l => l.trim()).join(inline.startsWith('>') ? ' ' : '\n').trim();
  }
  return inline.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
}

/**
 * The `description:` entry exactly as written. A probe skill gets this verbatim,
 * so its YAML parses to the same string production does.
 */
export function rawDescription(text) {
  const entry = descriptionEntry(text);
  if (!entry) return null;
  while (entry.length > 1 && !entry.at(-1).trim()) entry.pop();
  return entry.join('\n');
}

/** sha256 hex of a parsed description. */
export function hashDescription(description) {
  return createHash('sha256').update(description).digest('hex');
}

/** sha256 hex of a skill dir's parsed description, or null when it has none. */
export function descriptionHash(skillDir) {
  const d = descriptionFrom(readFileSync(join(skillDir, 'SKILL.md'), 'utf8'));
  return d == null ? null : hashDescription(d);
}
