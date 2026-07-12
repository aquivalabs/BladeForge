---
description: Use when creating or refining an architecture / flow diagram (a feature "schema", data flow, or how-it-works picture) that should end up readable and user-friendly — renders a D2 source with the ELK layout engine and inlines it into a self-contained, committable HTML page. Also use when iterating on an existing diagram to improve readability.
---

# Diagram (D2 → ELK → HTML artifact)

Iterative, user-refined skill. Seed comes from a sample feature diagram. The
owner adds refinements on top over time — treat the conventions below as the current house style,
not frozen.

## When to Activate

- The user asks to draw / diagram a feature, object model, data flow, or architecture — especially
  when they want it **readable and user-friendly**, viewable as an HTML page in a separate window.
- Refining or fixing an existing diagram's layout/readability.

## The non-negotiable: LOOK at the render, don't trust the source

A diagram is only done when it *looks* right. After every change: render → rasterize → **Read the
PNG** → judge (empty nodes? label overlaps? long crossing wires? invisible text? crowding?) →
edit the `.d2` → repeat. Never publish a diagram you have not visually inspected.

## Step 1 — the Atlas (the SINGLE source of truth; build it FIRST, before any `.d2`)

The **Atlas** is the canonical list of every entity the diagram covers. It is authored once, hardened
by review until it stops changing, saved as `docs/diagrams/<name>/atlas.md`, and is the ONLY thing
the `.d2` nodes and the Reference notes are generated from — never from memory, never straight from a
fresh read of the code. The most important step in this skill; it replaces the old "content from
source" + "visual verify" rules.

### Acceptance criterion — every Atlas entry answers four questions

Any entity, code or not (class, interface, object, permission set, CMDT, config, flow, …), is
"accepted" into the Atlas only when it answers all four. Keep every answer **declarative — the shape
and the facts, NOT the algorithm / control-flow** (what it *is*, not step-by-step what it *does*):

1. **What** — its kind (class / interface / object / permset / …) and name.
2. **Why** — one line of purpose.
3. **Made of** — its members, and WHAT you enumerate depends on the entity's KIND (from Q1): an
   **executable** class/interface/factory/trigger → its methods with FULL signatures (visibility,
   typed params, return type, `static`/`abstract`/`virtual`/`override`); a **descriptive** object →
   its fields (name + type + key attributes); a **permission set** → the object grant **and every
   field with its right** (Read/Edit), per field — never a count like "×7"; a CMDT → fields/values.
   **Hybrid — a DTO / facade** (an Apex class whose purpose is a data shape, e.g. a `fromRecord` mapper)
   enumerates BOTH its method(s) AND the shape it emits (every output key). The Sextants own this
   classification (`references/sextant.md`); the tell is "does the reader care what it DOES or what it
   HOLDS/EMITS?" — for a DTO, both.
4. **Relations** — the edges to other entities: `implements …`, `extends …`, `creates …`, `calls …`,
   `reads …`. This is what makes the Atlas produce the diagram's wiring, not just its boxes.

A blank on any of the four = a gap to resolve, not a thing to guess.

### Roles — the Shaper writes, the Sextants hunt

- **The Shaper** — YOU, this skill's main loop — is the SOLE writer and owner of the Atlas: it drafts
  entries, applies what the Sextants return, resolves conflicts, and commits `atlas.md`. It
  shapes the Atlas; nothing else writes it. (Named for the maker of the Atlas of Worlds.)
  **The Shaper's generation rule (duplicated from rule 10 so it can't be forgotten here):** when the
  Shaper turns the Atlas into the page, it emits a `<dt>` for EVERY member the node draws — every
  method (incl. private helpers) and every object field, one `<dt>` each, full typed signature, never
  combined or curated. Count the node's rows, count the note's `<dt>`s — they MUST be equal, or that
  member renders unclickable and unexplained.
- **The Sextants** — 3 read-only hunter subagents (`references/sextant.md`) — gather facts from
  code + spec and RETURN proposed entries / corrections. They never touch a file. One writer (the
  Shaper) applying many read-only reports = no parallel-write conflicts, cheap heavy reading on the
  Work tier.

### How it's built — recursive, until the Atlas stops growing

1. **Roster from the given scope — a spec/plan is ONE source, not a requirement.** Build the seed
   roster from whatever the user gave as scope:
   - **a spec/plan** — the richest source (scope + design intent + not-yet-built pieces); the common
     case, but not mandatory;
   - **code directly** — "diagram these classes / this folder / this module": take the roster from the
     code itself (no spec needed);
   - **a description in the conversation** — the user named what to draw in words.
   If the scope is vague ("diagram the codebase"), **ASK the user to narrow it** — never auto-scope a
   whole repo (the recursion/boundary would explode). List every entity in the agreed scope; miss nothing.
2. **Resolve each entity into a full Atlas entry** (the four questions). Code is the authority for the
   facts (signatures, fields, grants); a spec/plan/description adds design intent and any not-yet-built
   pieces. With no spec, code alone is enough.
3. **Recurse over STRUCTURE, not types — until 0 new entities.** Expanding an entity's "made of" /
   "relations" may surface another entity (e.g. a dispatcher method routes through a factory the roster
   missed). Add any genuinely-needed, in-scope entity so discovered. Termination is structural and
   shallow, so it converges fast:
   - Class/interface/object → expand into members.
   - A method/field is a **leaf** — do NOT descend into its parameter/return *types* as new entities;
     just record them. The one exception: a dispatcher (e.g. `call`) that enumerates sibling methods —
     record that method list (already members) and stop; don't go inside them.
   - A relation to an **external** entity (platform, `Pkg` core, third-party, anything out of
     scope) is recorded by name as a leaf — named, never expanded.
   - Stop when a full pass adds no new entity.
4. **Harden with the Sextants — loop until zero edits.** The **Sextant** is the entity hunter; its
   full subagent prompt lives INSIDE this skill at `references/sextant.md` (not a project-level agent —
   it travels with the skill). Spawn **3 in parallel** via the Agent tool, each with that file as its
   prompt (fill in the Atlas + spec paths), read-only tools, explicit **`model: sonnet`** (Work tier,
   per `meta:model-routing`; measure one and show the cost table before launching). Each independently
   re-checks the Atlas — missing entities, missing/extra/mis-signed members, wrong types, wrong
   relations, unanswered questions — and returns a correction list (or `0 edits`). Apply every
   correction; run **2 rounds**; repeat the whole review until a round returns **0 edits** across all
   three. Only a clean round ends it. Cap total agents/rounds and log anything cut — no unbounded loop.
5. **Commit the Atlas** as `docs/diagrams/<name>/atlas.md`. One block per entity: what · why ·
   made-of · relations · source path · scope flag (in-scope / boundary-leaf). THIS FILE is what the
   `.d2` and the Reference notes are generated from.
6. **On every regenerate, reconcile the Atlas FIRST.** Before touching the diagram, re-read the Atlas,
   diff it against current code + spec, edit the ATLAS first (add / remove / amend), THEN regenerate the
   `.d2` + Reference notes from it. The Atlas leads; the diagram follows. After rendering, diff the
   visible page against the Atlas (per the LOOK-at-the-render rule) — every entity/member present,
   nothing clipped.

## Tooling pipeline

- **D2** (`brew install d2`) — diagram-as-code; source lives in git, AI-friendly.
- **ELK layout** (`d2 --layout elk`) — free engine, best auto-layout for architecture (beats
  Mermaid's dagre; TALA is nicer but paid). Layout is engine-computed → geometry is never crooked.
- **rsvg-convert** (`brew install librsvg`) — rasterize SVG → PNG so you can Read/inspect it.
  (d2's own PNG export needs Playwright, which may fail to install — use rsvg-convert instead.)
- **Plain HTML page (committed)** — inline the SVG into a self-contained styled `.html` file saved
  in the repo (next to the spec/plan, or under docs/). **Prefer this over a claude.ai Artifact:** a
  committed page is cheaper (no publish round-trip / hosting), versioned, diffable, and offline; an
  Artifact can't be committed to git. Use an Artifact ONLY for a throwaway hosted preview the user
  explicitly asks to share via a claude.ai link. Either way the SVG is inlined — no external CDN.

## Commands

One folder per diagram, `docs/diagrams/<name>/`, with generic file names (the FOLDER names the
diagram). Open the folder and it's obvious what's what: `atlas.md` + `diagram.html` at the top,
everything else tucked into `assets/`. `build.sh` copies the shared assets (css/js/svg-pan-zoom) into
`assets/` deterministically and points `diagram.html` at them (the SVG is inlined — the JS drives it).

```bash
mkdir -p docs/diagrams/flow/assets && cd docs/diagrams/flow
cp <skill>/references/page-template.html assets/page.html   # fill {{placeholders}} + Reference notes,
                                                            # keep the <!--SVG--> + <link>/<script> markers
# author assets/graph.d2 (the D2 graph) and atlas.md (the entity list); then build FROM the skill:
bash <skill>/references/build.sh .              # -> assets/{css,js,lib,svg,png} + diagram.html
# iterate assets/graph.d2 / assets/page.html and re-run until assets/diagram.png is genuinely readable.
```

Resulting folder — top level is just the two things you care about:
```
docs/diagrams/flow/
├── atlas.md            the entity list (Sextant-hardened source of truth)
├── diagram.html        THE diagram — open / share / commit this (links ./assets, inlined SVG)
└── assets/
    ├── graph.d2        the D2 graph source
    ├── page.html       page skeleton + Reference notes (prose/notes source)
    ├── diagram.css · diagram.js · svg-pan-zoom.min.js   (copied from the skill each build)
    ├── diagram.svg     render          (artifact)
    └── diagram.png     rasterized render — the LOOK-at-it check   (artifact)
```

## Conventions

Two kinds of rule below: **authoring** (how you write the `.d2` and the page content — this is your
job each time) and **reusable assets** (styling + interaction + scaffold, already built — you copy
them, never re-derive). Everything that used to describe deriving colours/fonts/pan-zoom/clickability
now lives in the assets (rules 13–14); it was deleted here so a fresh read is fast and can't mislead.

### Authoring — the `.d2` source

1. **Plain-text labels, never D2 markdown (`|md ... |`).** Markdown labels render via SVG
   `<foreignObject>`, which rsvg-convert can't rasterize (nodes come out empty) and which blurs/clips
   under the pan-zoom CSS transform. Use quoted plain text; method rows come from `shape: class`
   (rule 6), not markdown.
2. **Flat graph — no container frames.** ELK routes edges *through* a container's border and collides
   the frame title with passing wires. Encode grouping by node role/fill, not by boxes.
3. **No back-edges.** An arrow that points "backwards" (e.g. `store -> handler` labelled *return*)
   makes ELK draw a long ugly loop across the whole diagram. Keep the flow one-directional —
   attribute an output straight to its destination node instead of looping an arrow back to the source.
4. **Short labels; choose the layout direction by the graph's shape.** `direction: right` for a wide
   left-to-right pipeline (nodes spread across the page width, the page scrolls vertically);
   `direction: down` for a tall tree. Big empty side gutters mean the direction is wrong for the shape.
5. **Scope to the agreed scope (Step 1) — no more.** Draw only the entities and real connections in
   the roster the user gave (a spec's deliverables, or the named files/classes/folder, or the described
   feature) — drop the full runtime path (clients, third-party internals, audit objects) unless the
   user asks for them.
6. **Every code node is `shape: class` and lists its REAL methods as native rows**, one per line:
   `+load(criteria): Object` / `-hash(criteria): String` / `#getCriteria(input): Map` — visibility
   `+` public `−` private `#` protected, then the return type, with `· abstract|virtual|override`
   appended where it applies. `shape: class` is the confirmed choice: crisp native text at any zoom,
   correctly sized (no clip/overlap/blur), and rsvg-renderable so the rule-10 visual check works.
   Interface/factory → list the FULL method surface (it *is* the contract); a large class → the
   load-bearing methods that carry the story (say which you dropped and why).
7. **Annotate only the genuinely non-obvious** — a short note node or a `key: value` edge label so the
   reader doesn't have to infer. Over-annotating is its own noise.
8. **Render at native size — automated by `build.sh`.** d2's outer `<svg>` tag has only a `viewBox`
   (no width/height), so CSS would collapse it small; `build.sh` reads the native W/H from the viewBox
   and injects them onto the tag. You don't do this by hand — just run the build.
9. **When it's built, open the `.html` in the browser** for the user (`open <file>.html` on macOS).

Content accuracy is NOT a rule here any more — it is Step 1 (the Atlas, above). Both the `.d2` nodes
and the Reference notes are generated FROM the hardened Atlas; after rendering, diff the visible page
against the Atlas (per the LOOK-at-the-render rule) so nothing is missing or clipped.

### Authoring — the page content

10. **One Reference note per entity, grouped by class — with a `<dt>` for EVERY drawn member (no
   curation).** Every class / interface / factory / object drawn gets its own note (no bare box the
   reader can't explain): a one-line *what + why*, then a SEPARATE `<dt>`+`<dd>` for **every single
   method and every single field the node shows** — each `<dt>` the full typed signature, each `<dd>`
   a one-line what — all taken verbatim from the Atlas (Step 1). Do NOT combine members into one
   `<dt>` and do NOT drop the "minor" ones (private helpers, every object field): the click-wiring
   matches a diagram row to a `<dt>` by identifier, so a member with no `<dt>` of its own is
   unclickable AND unexplained (the exact defect to avoid). The rule of thumb: **count the node's rows,
   count the note's `<dt>`s — they must be equal.** Group the notes by the same blocks the diagram uses
   (one heading per class), never a flat undivided list. Give each note `id="c-<d2-node-key>"` so the
   shared JS auto-wires its clickable links (rule 12).

### Reusable assets — copy and fill, NEVER regenerate

11. **ALL styling is in `references/diagram-theme.css`.** The complete look — dark-ocean page, grey
   diagram backing, per-type dark body tints, uniform dark block headers, white entity titles, amber
   italic method/field names, muted return types, bigger+lighter edge labels, single-column borderless
   Reference notes, the two `.ov` overlays, clickable-link cues + landing highlights — is defined once
   there. `build.sh` copies it to `assets/diagram.css` each build and the page `<link>`s it — never
   hand-write a `<style>` block. To restyle, edit the one file in `references/`. Its header comments document the palette + the SVG selectors + the
   class-presence gotcha (`.text-mono[…]`, never exact `[class="text-mono"]`). The ONLY visual thing
   set outside the CSS is in the `.d2`: per-type body fill (`class: <role>` + a `classes:{...}` block)
   and the render flag `d2 --layout elk --dark-theme 200`.
12. **ALL interaction is in `references/diagram.js` + the shared scaffold.** Pan/zoom is delegated to
   the **vendored `svg-pan-zoom.min.js`** (local file, no CDN — CSP/offline safe), NOT a hand-rolled
   CSS transform. This matters: svg-pan-zoom is SVG-native (it transforms an internal viewport `<g>`),
   so a large diagram stays cheap — no giant CSS layer, no blank/disappearing tiles, no lag (the trap
   the hand-rolled version kept hitting). `diagram.js` inits it (`minZoom:1` = can't zoom out past
   fit; `controlIconsEnabled:false` — the page's own `#zin`/`#zout`/`#zfit` buttons drive it) and
   layers BIDIRECTIONAL click-to-jump on top: diagram title/method → scrolls to the Reference
   heading/`<dt>` (amber flash); Reference heading/`<dt>` → zooms+pans to that node (~45% of the
   viewport, amber glow) via the svg-pan-zoom API + flashes the row. The only per-diagram wiring is the
   `id="c-<node-key>"` convention (rule 10) — D2 emits the node's group as `class=btoa(<key>)`.
   A new diagram reuses FIVE assets that STAY in `references/` (never copied beside the diagram):
   `diagram-theme.css`, `diagram.js`, `svg-pan-zoom.min.js`, `page-template.html` (skeleton with the
   `<link>`/`<script src>` markers `build.sh` swaps for inline blocks + the `<!--SVG-->` marker), and
   `build.sh` (renders `assets/graph.d2`, copies css/js/lib into `assets/`, and writes the top-level
   `diagram.html` that `<link>`s/`<script src>`s them + inlines the SVG). Run it from the skill:
   `bash <skill>/references/build.sh <dir>`. You author ONLY the graph, the page prose, and the
   Reference notes — never the CSS, JS, or assembly.

## Reusable prompt (paste-and-fill for a new feature diagram)

> Produce a D2 diagram of <FEATURE> limited to what <SPEC> delivers/changes. Flat graph (no
> container frames), every code node `shape: class` listing its real methods (read from committed
> source — verify, don't guess), role encoded by a per-type body fill via `class: <role>` +
> `classes:{ <role>.style.fill }`, linear flow with no back-edges. Render with
> `d2 --layout elk --dark-theme 200`, iterate against the rendered PNG until genuinely readable. Give
> every code entity a borderless Reference note with `id="c-<d2-node-key>"` so the shared script
> auto-wires clickable title/method jumps. Keep the whole diagram in `docs/diagrams/<name>/` (`atlas.md`
> + `diagram.html` at top, `graph.d2`/`page.html`/render in `assets/`). Run
> `bash <skill>/references/build.sh docs/diagrams/<name>` — it copies the shared CSS/JS/svg-pan-zoom
> into `assets/`, inlines the SVG, and writes `diagram.html` linking them. Commit `atlas.md` +
> `diagram.html` + the `assets/` folder.

## Checklist

- [ ] D2 source uses plain labels, flat graph, `shape: class` nodes with per-type fills, direction chosen by shape
- [ ] Rendered with ELK and rasterized; PNG **visually inspected** (Read)
- [ ] No empty nodes, no label/title overlaps, minimal edge crossings, all text legible
- [ ] Scoped to the intended content (no stray full-runtime-path nodes)
- [ ] Built with `build.sh` into `docs/diagrams/<name>/` — `diagram.html` + `atlas.md` at top, and
      `assets/` holding the copied css/js/svg-pan-zoom + sources (`graph.d2`, `page.html`) + render
      (`diagram.svg/.png`); `diagram.html` links `./assets` and inlines the SVG; committed (not an Artifact)
- [ ] Every code entity has a Reference note `id="c-<d2-node-key>"`; clickable title/method jumps
      verified working in the browser (not just present in source)

## Owner refinements

<!-- The owner appends house refinements here as we perfect the process. Keep them above the
     conventions if they override a default. -->
