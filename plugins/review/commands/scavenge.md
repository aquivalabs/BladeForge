---
description: The craft lens's on-demand hunt — sweep the repository's source roots for dead code, unused exports/files, duplication, and consolidatable services, then return the findings and print an atmospheric report. Read-only: this sweep never writes; any backlog entry is filed by the orchestrator's own step.
---

Run the craft lens's full-repo hunt. This does NOT block anything — it inventories cruft, returns
findings, and leaves any filing to the orchestrator.

1. Read `persona` from `.claude/review.config.json` (default `twitch` if absent).
2. Sweep the repository's source roots (not just changed files) — every top-level directory that
   holds source code, skipping build output, dependencies, and generated/vendored code. Hunt for:
   - dead files / unused exports (grep for each exported symbol's import sites; zero → suspect),
   - unused dependencies (declared in the package manifest, never imported),
   - duplicated logic / near-identical blocks,
   - services/hooks/components/utils that could be consolidated or reused,
   - shrinkable code (obvious over-abstraction, dead branches).
   Load `meta:ockham` plus whatever skills the config's `craft` agent entry lists under `skills` in
   `.claude/review.config.json`, to judge reuse and placement.
3. Produce findings as `{ file, line?, kind, detail, suggestion }`. Kinds: dead-file, unused-export,
   unused-dep, duplication, consolidate, shrink.
4. **Return the findings. This step writes nothing.** The sweep's job ends here — it hands the
   findings back and files nothing itself; whatever persists is filed by step 5, not by this step.
5. **This step is the orchestrator's, not the sweep's.** Before writing anything, read
   `BACKLOG/README.md` at the repository root and follow the format it declares — its file-naming
   rule, its required fields, its index-table columns, its numbering convention — rather than
   assuming a shape here. If a `BACKLOG/` directory exists: write **one file for this sweep** (not
   one per finding) at the next free number in that convention, carrying whatever fields that
   README requires, and add its row to that README's index table in the same change. If there is
   no backlog at all: skip the write, and hand step 6 a plain note that no backlog was found to
   file against, so the report says so.
6. Print the report, including the outcome of step 5 (filed, or no backlog found). When `persona: twitch`: open with an ASCII rat digging trash, narrate in
   Twitch's gleeful plague-rat voice ("one man's trash is Twitch's treasure…", counts of what he
   "found in the muck"), then a plain findings table. When `persona: plain`: skip the ASCII/voice,
   print only the table + summary. FINDINGS ARE IDENTICAL either way — only the wrapping changes.

ASCII (persona twitch), print at the top:
```
        (\_/)
       ( •.•)   ~ sniff sniff... fresh trash?
       />🗑  Twitch drags another corpse from the pile.
```
