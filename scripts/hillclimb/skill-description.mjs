// The one frontmatter reader for a skill's `description:`. The trigger runner,
// the result writer and eval-gate all import it, so the description that is
// measured, the one that is hashed, and the one the gate checks cannot disagree.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function frontmatterLines(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  return (m ? m[1] : text).split('\n');
}

/**
 * The parsed `description:` value, or null. A YAML block scalar
 * (`description: >` / `|`) is folded or kept literal; a quoted inline value has
 * its surrounding quotes stripped and nothing else, escapes included. This is
 * byte-for-byte what score-description.py read, so saved description hashes
 * stay valid across the switch.
 */
export function descriptionFrom(text) {
  const lines = frontmatterLines(text);
  const idx = lines.findIndex(l => /^description:\s/.test(l) || l === 'description:');
  if (idx < 0) return null;
  const inline = lines[idx].replace(/^description:\s*/, '').trim();
  if (['>', '|', '>-', '|-', '>+', '|+'].includes(inline)) {
    const body = [];
    for (const l of lines.slice(idx + 1)) {
      if (l.trim() && !/^[ \t]/.test(l)) break;
      body.push(l.trim());
    }
    return body.join(inline.startsWith('>') ? ' ' : '\n').trim();
  }
  return inline.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
}

/**
 * The `description:` entry exactly as written: its line plus any indented
 * continuation lines. A probe skill gets this verbatim, so its YAML parses to
 * the same string production does.
 */
export function rawDescription(text) {
  const lines = frontmatterLines(text);
  const idx = lines.findIndex(l => /^description:(\s|$)/.test(l));
  if (idx < 0) return null;
  const out = [lines[idx]];
  for (const l of lines.slice(idx + 1)) {
    if (l.trim() && !/^[ \t]/.test(l)) break;
    out.push(l);
  }
  while (out.length > 1 && !out.at(-1).trim()) out.pop();
  return out.join('\n');
}

/** sha256 hex of a skill dir's parsed description, or null when it has none. */
export function descriptionHash(skillDir) {
  const d = descriptionFrom(readFileSync(join(skillDir, 'SKILL.md'), 'utf8'));
  return d == null ? null : createHash('sha256').update(d).digest('hex');
}
