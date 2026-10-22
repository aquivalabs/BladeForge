#!/usr/bin/env node
// Make the animated previews of every skill film: showcase/assets/video/<slug>.mp4 becomes
//   showcase/assets/preview/<slug>.gif        640 px, 10 fps - the link preview (og:image)
//   showcase/assets/preview/<slug>-small.gif  360 px,  8 fps - the README list
// Frame 0 of every film is its benefit headline, so an app that shows only the first frame of a
// GIF still gets a readable thumbnail. A preview newer than its film is left alone.
//   node scripts/gen-previews.mjs            # needs ffmpeg on PATH
//   node scripts/gen-previews.mjs --readme   # rewrite only the README gallery, no ffmpeg
// The README gallery sits between `<!-- previews:start -->` and `<!-- previews:end -->` and links each
// small GIF on GitHub Pages to the skill's showcase page; the GIFs themselves are never committed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VIDEO = 'showcase/assets/video';
const OUT = 'showcase/assets/preview';
const SIZES = [{ suffix: '', width: 640, fps: 10, colors: 128 }, { suffix: '-small', width: 360, fps: 8, colors: 64 }];

const SITE = 'https://aquivalabs.github.io/BladeForge/';
const PER_ROW = 3;
const films = readdirSync(VIDEO).filter(f => f.endsWith('.mp4')).sort();

/** The README gallery: every film, PER_ROW to a row, each linked to its showcase page. */
function gallery() {
  const cells = films.map(f => {
    const slug = f.replace(/\.mp4$/, '');
    const id = slug.replace('__', ':');
    return `<td align="center"><a href="${SITE}skill/${slug}.html"><img src="${SITE}assets/preview/${slug}-small.gif" width="240" alt="${id}"></a><br><code>${id}</code></td>`;
  });
  const rows = [];
  for (let i = 0; i < cells.length; i += PER_ROW) rows.push(`<tr>${cells.slice(i, i + PER_ROW).join('')}</tr>`);
  return `<table>\n${rows.join('\n')}\n</table>`;
}

if (process.argv.includes('--readme')) {
  const readme = readFileSync('README.md', 'utf8');
  const re = /(<!-- previews:start -->)[\s\S]*?(<!-- previews:end -->)/;
  if (!re.test(readme)) { console.error('README.md has no <!-- previews:start --> ... <!-- previews:end --> block'); process.exit(1); }
  writeFileSync('README.md', readme.replace(re, `$1\n${gallery()}\n$2`));
  console.log(`gen-previews: README gallery, ${films.length} films`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
let made = 0, kept = 0;
for (const f of films) {
  const src = join(VIDEO, f);
  for (const { suffix, width, fps, colors } of SIZES) {
    const dest = join(OUT, f.replace(/\.mp4$/, `${suffix}.gif`));
    if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs) { kept++; continue; }
    // One palette per film, rebuilt only where frames change, keeps a typical 10 s film well under 1 MB.
    const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];`
      + `[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', filter, '-loop', '0', dest]);
    made++;
  }
}
console.log(`gen-previews: ${made} made, ${kept} up to date -> ${OUT}/`);
