#!/usr/bin/env node
// Make the animated link preview of every skill film: showcase/assets/video/<slug>.mp4 becomes
//   showcase/assets/preview/<slug>.gif        640 px, 10 fps - the link preview (og:image)
// Frame 0 of every film is its benefit headline, so an app that shows only the first frame of a
// GIF still gets a readable thumbnail. A preview newer than its film is left alone.
//   node scripts/gen-previews.mjs            # needs ffmpeg on PATH
// The GIFs are built in the pages workflow and never committed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const VIDEO = 'showcase/assets/video';
const OUT = 'showcase/assets/preview';
const SIZES = [{ suffix: '', width: 640, fps: 10, colors: 128 }];

const films = readdirSync(VIDEO).filter(f => f.endsWith('.mp4')).sort();

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
