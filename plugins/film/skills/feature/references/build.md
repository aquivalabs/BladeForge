# Build, check, publish

## Work folder

```text
<work_dir>/
├── storyboard.json      the model (storyboard.md)
├── film.json            title, palette, fonts, scenes with their files and seconds, optional score
├── base.css             a copy of scripts/base.css with this film's tokens
├── lib.js               optional: helpers shared by the scenes; list it in film.json "helpers"
├── score.js             optional: kit.score(function (S, T) { ... }) on Claude Motion's sound API
└── scenes/<id>.js       one file per screen: kit.scene('<id>', { init(kit) {...}, render(t) {...} })
```

`node scripts/build.mjs <work_dir>` writes `out/`: each scene with `kit.js` in front, `preview.html`,
and `out/docs/writes.json`. `node scripts/shoot.mjs <work_dir>` shoots every scene at 40 % of its length
and just before its end (plus each scene's `shots`), writes one sheet per scene, `out/shots/sheet-<id>.png`,
and exits 1 when a scene threw an error in the console.

## Writing a scene

- Everything on screen is a pure function of `t`: build the DOM once in `init`, only position, fade and
  fill it in `render`. Never keep state between frames.
- The kit (`scripts/kit.js`) gives `buildHeader/renderHeader`, `buildEl/renderEl` (actor, card, check,
  cross, note, text, typed, frame), `buildEdges/renderEdges`, `buildCaps/renderCaps` (one caption at a
  time), `buildFoot` (a proof line and a footnote), `enter`, `svg` icons and `termHTML`.
- Colours only through the tokens in `base.css`; never a raw hex in a scene.
- The showcase ride is one scene: a world element translated by the camera between stations, the rail
  and the counter fixed on top. Station times as constants (`STARTS`), every event timed from its
  station's start.
- Recreate the product's UI from screenshots or Storybook shots as plain markup, so values can count
  up and charts can draw.

## The score

The score runs only in Claude Motion: the local preview has no `kit.score`, so a broken score is not caught
by `shoot.mjs`. Read the type's own page first — the `Artifact` tool, `action: "read"` on the Motion type with
`path: "artifact-type/reference/sound.md"` — and use only the calls it documents. Keep the score small: a
pad under the opening, a light groove under the showcase, one short sound on each station's event.

## Reading the frames

Look at every frame of the sheet, then open the full-size frame of anything doubtful. Fix:

- a chip, pill or stamp that wraps — `white-space:nowrap`, or a shorter label;
- a card whose text runs to two lines — widen it or shorten the text;
- two elements in the same place at the same time — move one, or fade the first out (`out` time);
- a black frame — the scene threw: the console line `shoot.mjs` printed names it.

## Publishing

1. Create the film: the `Artifact` tool with the Motion type link, a `title`, and
   `auto_open: "after_first_write"`. Keep the returned film url.
2. Write `out/docs/writes.json` as ONE `ArtifactData` `batch` (film/meta first, film/script last).
3. A later fix: rebuild, then `set` only the changed documents, each with the `if_version` from the last
   write; `delete` a removed scene's module.
4. Open the film in the browser. It is private until the user shares it from the Share menu.

## Pitfalls already paid for

- In a JavaScript `String.replace`, a `$` in the replacement string is a pattern (`$'` inserts the rest of
  the text). Pass a function, or split and join.
- In zsh, `rm dir/*.png` with no match aborts the whole `&&` chain; remove the folder instead.
- A font must cover the viewer's language; check Cyrillic before picking a brand font.
- Scaling a station's duration means scaling every `at`, `out` and caption time inside it, and the
  score's offsets for that station.
