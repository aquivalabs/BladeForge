---
description: Use when asked to draw, sketch, map, diagram, visualize, or make a picture/schema/architecture of how software works — the architecture or how-it-works view of a feature, the relationships between classes or interfaces (with their methods and fields), data or record flow, an object model with its fields and permission sets, or a dependency graph — for a package, a feature, a handful of files, or a whole undocumented source directory, built from a spec, a plan or ticket, or read straight from the code, and output as one shareable HTML page you can commit. Also use to clean up an existing generated diagram that is hard to read (overlapping nodes, tiny text). Do NOT use to plot a data or metrics chart from a dataset, to paste a mermaid or ascii snippet into a PR or README, to draw in an external editor like Lucidchart or Excalidraw, to convert a whiteboard photo, to re-render an existing page for a screenshot, or to explain how something works in words with no picture.
---

# Diagram (model JSON → React Flow + ELK → one HTML file)

Iterative, user-refined skill. A diagram is **DATA** — a plain JSON model — rendered by a reusable
engine. You author the model; you never hand-write the HTML/CSS/JS. Treat the conventions as the
current house style, not frozen.

## Contract

**In:** a request to draw or diagram a feature, object model, data flow, or architecture as a readable
page — or to refine an existing diagram — with a scope (a spec/plan, named files/classes/folder, or a
description).

**Out:** a `<name>.diagram.json` model, hardened by the Sextants until clean, rendered into ONE
`docs/diagrams/<name>/<name>.html` — self-contained in the sense of **no sibling files** (model baked
in), but the three libraries load from a CDN (esm.sh), so the first open needs network. VISUALLY
inspected in a browser, not trusted from source. Acceptance: `evals/rubric.json`.

## The non-negotiable: LOOK at the render, don't trust the source

A diagram is only done when it *looks* right. After every change: build → **capture the pixels** with
`node references/shot.mjs <name>.html <name>.png` (headless Chrome; it also reports node/zone counts
and any page error, and exits non-zero on a blank/errored render) → **Read the PNG and judge it**
(empty/blended nodes, label overlaps, crossing wires, unreadable text, crowding, a garish palette) →
fix the MODEL → rebuild. Never publish a diagram you have not visually inspected.

**Failure modes to handle, not ignore.** Malformed model JSON fails the build with a JSON parse error
(a position, not an id); a dangling edge, a duplicate id, a `parent` that isn't a node id, or a
`parent` cycle → `build-spec-diagram.mjs` rejects the build LOUD naming the offending id; fix the model
and rebuild (it will not emit a broken file). A `shot.mjs` non-zero exit / zero nodes / page error →
the render is broken, not a picture to trust — read the error, fix, rebuild. A huge/slow graph (ELK
degrades past ~100 nodes) → narrow scope per Step 1's roster rule, or split into per-domain diagrams.

## Step 1 — build the diagram MODEL (the single source of truth)

The **model** is one JSON file, `docs/diagrams/<name>/<name>.diagram.json`, and it is the ONLY thing
the render is generated from — never from memory, never straight from a fresh code read. Format:

```
{ "diagram": { "title", "subtitle" },
  "domains": [ { "id", "name", "sub" } ],                 // optional — subsystems, drawn as background zones
  "nodes":   [ { "id", "parent"?, "domain"?, "name", "kind", "summary", "role"?,
                 "description"?, "rows"?:[{group,text,means}], "refs"?:[{kind,label,url}] } ],
  "edges":   [ { "from", "to", "kind"?, "label"? } ] }
```

- **`parent` and `domain` are two axes** — `parent` (another node id) = nesting/ownership, shown by a
  box inside a box; `domain` (a domain id) = subsystem membership, shown as a translucent background
  zone. A node may have both (nested inside an owner AND tagged to a domain). Ownership is nesting,
  **never an edge**.
- `kind` = an OPEN vocabulary label (`react-component`, `apex-class`, `sobject`, `lambda`…) → a stable
  hash of the NAME drives its colour + a letter badge; past ~8 kinds a shape channel is added. **How to
  break a subject into nodes, and how to choose `kind` words → the default decomposition in Owner
  refinements below** (one node for the whole subject → a few containers → the parts + shared nodes wired
  by edges).
- `edge.kind` (optional, open) = the relation type (`calls`, `reads`, `extends`…) → its line style.
- `role` (optional) = a node's STRUCTURAL layer, ORTHOGONAL to `kind` — `shared` / `external` /
  `entrypoint`… → a bright coloured LEFT STRIPE (reads on any fill) + a legend row. Type stays on the
  fill, role on the stripe, so a node reads as BOTH — a `shared` `cache` vs a `shared` `database`. Leave
  it off for ordinary nodes (nesting already shows owner-vs-leaf); use it to mark the non-obvious layer.
- **Scope boundary:** this format is for architecture / dependency / containment diagrams. It has no
  cardinality (ER) and no time/order axis (sequence) — for those, say so and don't force them into
  this JSON.
- Full field reference: the header of `references/build-spec-diagram.mjs`; the encoding + the research
  behind it: `references/readability-rules.md` and `references/color-encoding-research.md`.

### Acceptance criterion — a node's DETAIL PANEL must be worth opening, not a one-liner
Every node carries: `name`+`kind` (what it is); a declarative one-line `summary` (shape/fact, never the
algorithm); a fuller `description` (2-4 sentences — how it fits, what it holds/returns); `rows`
enumerating its members per its kind (methods for an executable, fields for an object, props for a
component — a DTO gets both, each with a plain-language `means`); a `refs` link to its real source; and
an `edge` for every real dependency/relation. A node with ONLY a `summary` (no `description`, no `rows`)
is **THIN** — its panel opens near-empty, which is a defect, not a terse choice. `build-spec-diagram.mjs`
reports thin nodes on every build and `--strict` fails on them; a blank is a gap to fill, not a guess.

### Roles — the Shaper writes, the Sextants hunt
- **The Shaper** — YOU, this skill's main loop — is the SOLE writer of the model: drafts nodes/edges,
  applies what the Sextants return, resolves conflicts, saves the JSON.
- **The Sextants** — 3 read-only hunter subagents (`references/sextant.md`) — gather facts from code +
  spec and RETURN **findings as JSON** (`{lens, findings:[{op,target,current,proposed,evidence,severity,why}]}`).
  They never touch a file. One writer applying many read-only reports = no write conflicts.

### How it's built
1. **Roster from the given scope.** From a spec/plan (richest), the code directly, or a description.
   Vague scope ("diagram the codebase") → **ASK to narrow** it; never auto-scope a whole repo.
2. **Resolve each entity into a node** (name · kind · summary · rows · edges). Code is the authority
   for facts (signatures, fields); a spec adds design intent and not-yet-built pieces.
3. **Recurse over STRUCTURE, not types — until 0 new nodes.** Expanding a node's rows/edges may
   surface another in-scope entity (a factory a dispatcher routes through, an extends target). Add it.
   A row's parameter/return type is a leaf — never a new node. An EXTERNAL relation is a named leaf.
4. **Harden with the Sextants — loop, at most 3 rounds.** Spawn **3 in parallel** (Agent tool), each
   with `references/sextant.md` as its prompt and a DIFFERENT lens (A roster&scope · B wiring&detail ·
   C clarity&standard), read-only, explicit **`model: sonnet`** (per `meta:model-routing` — measure
   one, show the cost table before launching). Each returns a `{lens, findings:[…]}` object. Then, each
   round, apply them:
   - **Merge** the three `findings` arrays into one list (keep each item's source lens).
   - **Dedup** by `(target.nodeKey, target.field)`. On a CONFLICT (two lenses propose different values
     for the same key): keep the **higher-severity** finding; if tied, re-read the cited `evidence`
     `file:line` and keep the one the source actually supports.
   - **Verify then apply.** For every S1/S2 finding, spot-check its `evidence` at the cited line before
     writing the change in; drop any whose evidence doesn't hold. Apply node-`add`s by their proposed
     full node object (dedup new nodes by source-derived id), field-`fix`es by their stable path. A
     `gap` (an unanswered required field) is applied like a `fix` when the field exists-but-empty, or
     like an `add` when it's a missing member — same stable path either way; a `remove` deletes at its
     path. Re-validate against the JSON shape (`build-spec-diagram.mjs` re-validates references at build).
   - **Stop condition — ONE rule:** a round that surfaces **no new S1** is done; leftover S2/S3 do not
     block stopping (park them). Node-`add`s (still discovering structure) get PRIORITY inside a round —
     apply them first, before fixes — so the roster keeps growing while rounds remain; they do not earn
     extra rounds.
   - **Hard cap: 3 rounds, for everything.** The cap binds node-`add`s too. If S1 or new nodes still
     appear at round 3, that says PROTOTYPE — ship it flagged, LOG what was left unadded/unfixed, and
     surface it to the user; don't loop a 4th time.
5. **Save** the model as `docs/diagrams/<name>/<name>.diagram.json`. On every regenerate, reconcile the
   MODEL first (diff vs current code + spec, edit the JSON), THEN rebuild.

## Step 2 — render (ONE self-contained file, never hand-built)

The renderer is a finished, reusable asset — do NOT write HTML per diagram:
```bash
node <skill>/references/build-spec-diagram.mjs <name>.diagram.json <name>.html \
     <skill>/references/diagram-viewer.template.html
```
It inlines the model into a copy of the engine and strips the fetch loader → **one HTML file, no
sibling files** (model baked in; the three libraries load from a CDN, so opening it needs network).
Then **open it and LOOK** (browser or headless). Iterate the MODEL, never the HTML.

- Engine: `references/diagram-viewer.template.html` (React Flow + elkjs). It stays put; the model is
  the only thing that changes.
- Encoding (all automatic from the model): **kind → colour** (OKLCH, stable per-name, capped, CVD-safe,
  comfortable band) **+ a letter badge** (header for a container, corner chip for a leaf); **domain →
  translucent zone**; **edges** coloured by source; select-to-highlight+dim; a detail panel
  (description · references+lightbox · rows with `means` tooltips · depends-on/used-by); a legend
  generated from the kinds+domains present. The rules + the research behind them:
  `references/readability-rules.md`, `references/color-encoding-research.md`.

### Placement
`docs/diagrams/<name>/` by default (the `<name>.diagram.json` + the built `<name>.html`), unless the
repo dictates otherwise.

```
docs/diagrams/<name>/
├── <name>.diagram.json   the model — the Sextant-hardened source of truth
└── <name>.html           THE diagram — one self-contained file; open / share / commit this
```

## Before you finish
1. The MODEL was hardened by 3 diverse-lens Sextants returning JSON findings, applied deterministically,
   until a round found no new S1 — not trusted from a single pass.
2. Built into ONE self-contained `docs/diagrams/<name>/<name>.html` via `build-spec-diagram.mjs`; opened
   in a browser and the actual pixels judged — legible nodes, distinct non-garish colours, no overlaps,
   minimal crossings, a generated legend, working select/panel.
3. **The build reported ZERO thin nodes** (or `--strict` passed) — a node with only a one-line summary
   is a defect. And you OPENED at least one detail panel and confirmed it is worth opening: a fuller
   `description`, real `rows` with `means`, and a source `ref` — not a one-liner. Enrich every thin node
   the build lists before shipping.
4. Scoped to the agreed scope (no stray nodes); every node answers name·kind·summary·rows; ownership is
   nesting, not edges.
5. A line fails? Fix the MODEL and rebuild. Full expectations → `evals/rubric.json`.

## Owner refinements

<!-- The owner appends house refinements here as we perfect the process. Keep them above the
     conventions if they override a default. -->

- **Default decomposition — how a subject becomes nodes (do this unless the subject fights it).** The
  shape that reads best, whatever the subject is:
  1. ONE node for the WHOLE subject (the feature / page / module) — everything nests under it, so the
     render packs into one box instead of scattering across the canvas.
  2. Group the parts into a few CONTAINER nodes (a box that owns related sub-parts) — not a flat list of
     every part at the top level, and not far-apart `domain` zones with nothing tying them together.
  3. The individual parts are the nodes INSIDE those containers.
  4. Pull anything cross-cutting — shared state, data, a result set, a shared service — into its OWN node
     and point every consumer at it with a dependency **edge**, instead of copying the shared concern into
     each user. These shared nodes are the graph's spine and are what make it read as *wired*, not sparse.
  Ownership is nesting; shared use is an edge. A flat graph, or one split into far-apart zones with no
  shared spine, is the exact anti-pattern this replaces.
- **`kind` words follow the subject — pick a handful, not one per part.** `kind` is OPEN and differs per
  diagram; name each node for WHAT IT IS. A UI page reads well as `page` / `region` / `component` / `data`;
  a backend feature as `service` / `module` / `queue` / `store`; an object model as `sobject` /
  `field-set` / `permission-set`; mix concrete kinds freely (`react-component`, `apex-class`, `lambda`).
  Keep it to a FEW meaningful kinds — one colour per type that matters — rather than a distinct kind for
  every single part, which makes a garish, singleton-heavy legend.
- **Readability + encoding standard** → `references/readability-rules.md` (the evidence-backed rules:
  crossing-minimization, ownership-as-nesting, kind→colour + domain→zone two-axis encoding, stable
  OKLCH palette, badges, select-to-highlight, the numeric thresholds). The full literature behind the
  colour/encoding half → `references/color-encoding-research.md`. Rules are defaults to bend
  deliberately, not laws.
- **The engine is reusable — never regenerate it.** A diagram is DATA (`<name>.diagram.json`); the
  engine (`diagram-viewer.template.html`) is the tool. Author the model, run the bundler, get one file.
