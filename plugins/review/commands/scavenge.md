---
description: The Scavenger's on-demand hunt — sweep the whole app (src + server) for dead code, unused exports/files, duplication, and consolidatable services; print an atmospheric report and append findings to the backlog. Read-only except the backlog.
---

Run the Scavenger's full-app hunt. This does NOT block anything — it inventories cruft and files it.

1. Read `persona` from `.claude/review.config.json` (default `twitch` if absent).
2. Sweep BOTH `src/` and `server/` (not just changed files). Hunt for:
   - dead files / unused exports (grep for each exported symbol's import sites; zero → suspect),
   - unused dependencies (declared in package.json, never imported),
   - duplicated logic / near-identical blocks,
   - services/hooks/components/utils that could be consolidated or reused,
   - shrinkable code (obvious over-abstraction, dead branches).
   Load `meta:ockham`, `frontend-react_component-placement`, `frontend-react_ui-primitive-reuse`,
   `frontend-react:hooks-registry`, `backend-api-transport` to judge reuse/placement.
3. Produce findings as `{ file, line?, kind, detail, suggestion }`. Kinds: dead-file, unused-export,
   unused-dep, duplication, consolidate, shrink.
4. **Append to `docs/superpowers/BACKLOG.md`** under a `## 🐀 Scavenger` section (create it if
   absent). DEDUPE: skip a finding whose `file`+`kind`+`detail` already appears in that section.
   One terse bullet per finding: `- ⏳ [kind] file:line — detail → suggestion`.
5. Print the report. When `persona: twitch`: open with an ASCII rat digging trash, narrate in
   Twitch's gleeful plague-rat voice ("one man's trash is Twitch's treasure…", counts of what he
   "found in the muck"), then a plain findings table. When `persona: plain`: skip the ASCII/voice,
   print only the table + summary. FINDINGS ARE IDENTICAL either way — only the wrapping changes.

ASCII (persona twitch), print at the top:
```
        (\_/)
       ( •.•)   ~ sniff sniff... fresh trash?
       />🗑  Twitch drags another corpse from the pile.
```
