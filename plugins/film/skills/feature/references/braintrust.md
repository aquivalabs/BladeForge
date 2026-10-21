# Director and Braintrust

Named after Pixar's Braintrust: a group watches a rough cut and gives candid notes, but only the
director decides.

- **The storyboard is the only model** the scenes are built from: `storyboard.json`, one entry per screen
  with its chapter, scene kind, on-screen text, the facts it states with their sources, and its seconds.
  Scenes are never written around it.
- **The Director** is the only writer of the storyboard and the scenes. It applies findings, resolves
  conflicts between them, and saves the result.
- **The Braintrust** reads and never edits. Each reviewer returns `{ "lens": "...", "findings": [ ... ] }`,
  each finding `{ "screen", "severity": "S1|S2|S3", "problem", "evidence", "proposal" }`.

| lens | who | looks for |
|---|---|---|
| `fresh-eyes` | a newcomer with no context | what is unclear: jargon, field names, too much text, a screen without a picture, a term used before it was explained |
| `editor` | an editor | register and wording per `voice.md`: blunt questions, raw tags, bureaucratic verbs, internal process words, repeats, draft-like phrasing |
| `fact-check` | a fact-checker | every claim against its source and the honesty rules in `screen.md`: an invented detail without a footnote, a number without a source, a chapter-7 item without a source. Any breach is S1 |
| `verdict` | a judge | the five "done when" sentences in `chapters.md`, one by one, plus the line "what is proven, what is not" and any "only strengths" framing |

## When and how many

- **Review the storyboard before any scene exists** — fixing it there is cheap. Once the film is made,
  `fresh-eyes` looks once more at what the user scrubbed or at the stills the user asked for.
- **One film:** two reviewers, one round — `fresh-eyes` with `editor`, `fact-check` with `verdict`.
- **A series:** four reviewers, at most three rounds; a round with no new S1 is the last.
- **Spawn reviewers with an explicit model tier.** A reviewer reads and reports, so the mid tier is
  enough. Show the cost before launching more than one round.

## Applying findings

1. Merge all findings by screen. Two lenses on one screen that agree raise confidence; a conflict keeps the
   higher severity, and if tied, the one the source supports.
2. Check the evidence of every S1 and S2 against the source before changing anything.
3. Apply, then save the storyboard. Parked S2/S3 go into the report, not into the film.
