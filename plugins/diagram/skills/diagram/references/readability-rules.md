# Diagram readability — the house rules

The evidence-backed ruleset every diagram this skill produces should follow. Each rule is a default to
**bend deliberately**, not a law — but bend it knowing what it costs. Ranked by how strongly the
research supports it (strongest first). The full literature synthesis + ~70 citations backing every
number lives in the research write-ups (`references/color-encoding-research.md` for the colour/encoding
half); this file is the operational subset.

## The five that matter most (spend effort here)

1. **Minimize edge crossings.** The single largest measured effect on comprehension speed AND accuracy
   — beats bends, symmetry, angle. At diagram scale (dozens of nodes) it holds at full strength. Spend
   layout compute here first.
2. **Cross at a wide angle (≥70°, ideal 90°).** A near-perpendicular crossing is perceptually ignored;
   a shallow one makes the eye saw back and forth. Orthogonal routing gives this for free.
3. **Keep long paths straight (continuity).** Second-biggest path-tracing factor after hop count. A
   multi-hop chain that continues in a straight line reads as one trajectory; a zigzag reads as
   separate objects.
4. **Layout quality ≈ as important as content.** Same diagram, good vs. bad layout → significantly
   better/faster comprehension, and the gap grows with size. Tuning the layout is not polish.
5. **Group by meaning, not just by aesthetics.** Clustering same-role / same-subsystem nodes spatially
   beat a crossing-minimal-but-role-blind layout (p<0.01). Layout must respect the domain structure.

Do **not** spend effort chasing symmetry, angular resolution, or grid-snapping — weak or non-significant
in the controlled studies.

## Structure & encoding

- **Ownership / containment → nesting, not an edge.** A box *inside* a box just *is* "belongs to" — the
  strongest self-explaining symbol, and it removes an entire edge class, freeing the canvas for the
  harder dependency relation. Use a translucent role-tinted container (common-region grouping).
- **One channel, one meaning.** Never encode two categorical dimensions on the same channel. House
  assignment: node **kind → fill hue**; node **role → left-edge stripe** (a bright separate channel,
  deliberately off the fill so the two node axes never collide); **selection focus → luminance/opacity**
  (dim the rest); **edge kind → line style** (solid/dashed/dotted); **edge origin → colour by source**.
- **Every edge-kind distinction on ≥2 visual variables** (style + colour), never colour alone — ~8% of
  men are red-green colourblind and it must survive greyscale.
- **Symbol vocabulary cap ≈7.** Fold a new distinction into an existing dimension (a border modifier)
  rather than adding an 8th colour or a 4th line style.
- **Direction:** animation is a competitive direction cue — keep it, shrink the arrowhead (it piles up
  where wires converge). Provide a static fallback (small arrowhead or edge taper) and honour
  `prefers-reduced-motion`.

## Interaction (for an interactive renderer)

- **Overview → details-on-demand.** Node bodies stay minimal (name + role + one-line intent + i/o);
  full detail opens in a side panel on select. One rich detail surface, not two.
- **Select = highlight neighbourhood + dim the rest.** Close to a prerequisite — connectivity errors are
  high without it *even at 32 nodes*. Dim, don't hide (keeps orientation). Include the selected node's
  wire-neighbours and their container ancestors in the focus set.
- **Edge labels on-demand, not permanent** — show a wire's label only when an endpoint is selected;
  permanent labels collide with boxes and other edges once dense.
- **Focus by elision, not distortion** — dim/filter a crisp subgraph; don't fisheye-warp a discrete
  dependency graph.
- **Skip edge bundling** at this scale; if a graph grows to a hairball, reach for filtering / collapsible
  clusters first (collapse a branch beyond ~8–10 children).
- **Mental map:** don't silently re-layout after a manual drag — pin dragged nodes or make re-arrange
  explicit; animate any layout change (~200–400 ms, staged).

## Labels, legend, typography

- **Name inside the box, top-aligned** (zero ambiguity, no leader line); role tag as a pill under it.
- **Legend is mandatory and the diagram self-describing** (C4): a title naming the frame ("dependency
  graph — root: X"), a persistent legend covering every tint + edge kind + the direction rule, ordered
  by frequency of occurrence.
- **Monospace for identifiers** (ports, slots, types), proportional sans for prose.
- **One abstraction level per frame**; drill-down steps exactly one level and keeps a breadcrumb back.

## The numbers

| Guidance | Value |
|---|---|
| Crossing angle (ideal / penalty-gone) | 90° / ≥70° |
| Max categorical hues (colourblind-safe) | ≤8 |
| Text contrast (normal / large) | ≥4.5:1 / ≥3:1 |
| Graphical-object contrast (line, icon, swatch) | ≥3:1 |
| Reliable line-style/dash categories | ~3–5 |
| Legend / simultaneous categories | ~4–7 |
| Node title min size / secondary-text floor | ≥12px / ≥10px |
| Non-focus dim opacity | ~30–40% |
| Symbol vocabulary cap | ~7 |
| Branch fan-out → collapse-by-default | ~8–10 children |
| Animated transition | ~200–400 ms, staged |

## ELK layered settings that encode these

`elk.algorithm=layered`, `elk.direction=DOWN`, `elk.edgeRouting=ORTHOGONAL`,
`elk.layered.nodePlacement.strategy=NETWORK_SIMPLEX` (short edges) or `BRANDES_KOEPF` (straighten),
`elk.layered.considerModelOrder.strategy=NODES_AND_EDGES` (stable order across edits),
`elk.layered.thoroughness=10` (more crossing-min iterations), `elk.hierarchyHandling=INCLUDE_CHILDREN`
(nested containers). Try `MEDIAN_LAYER_SWEEP` crossing-min when a few hubs cause crossing storms.

## The React-Flow engine — reusable, never regenerated

The renderer is a finished, reusable asset: `references/diagram-viewer.template.html` (React Flow 11 +
elkjs, its three libraries loaded from a CDN at view time). **Do not regenerate it per diagram** — a diagram is DATA
(a model JSON); the engine is the tool. You author the model and run the bundler; never the HTML/CSS/JS.

**Build — always ONE self-contained file:**

```bash
node references/build-spec-diagram.mjs <name>.diagram.json <name>.html references/diagram-viewer.template.html
```

It validates the model (id-uniqueness, resolvable + acyclic `parent`, resolvable edge endpoints —
failing LOUD on a bad one), inlines it, and strips the dev fetch loader → a single HTML file with **no
sibling files**. Then `node references/shot.mjs <name>.html` captures a PNG to Read and judge.

**Where diagrams live:** default to `docs/diagrams/<name>/` unless the repo says otherwise — the model
JSON and the built `<name>.html` both go there.

**Model format** (the engine reads it natively): per node `id`, `name`, `kind`, `summary`, and all
optional: `parent` (nesting), `domain` (subsystem zone), `description` (panel prose),
`rows`[{group,text,means}] (members — with `means` shown inline + on hover), `refs`
(`{kind:doc|code|design|ticket|link|image, label, url}` — links as chips, images as a lightbox); edges
`{from,to,kind?,label?}`. The one authority is SKILL.md Step 1; `build-spec-diagram.mjs`'s header is a
reminder of the same shape.

**What the engine already implements** (the rules above, made concrete):
- **kind → colour** by a STABLE hash of the name (unchanged when the set changes), from a capped
  comfortable OKLCH hue set; **+ a shape channel** once distinct kinds exceed the cap; **+ a letter
  badge** (header for a container, corner chip for a leaf). Fill lightness clears ≥3:1 vs the canvas,
  the kind label ≥4.5:1 vs the fill;
- **domain → a translucent low-chroma zone** (hue band reserved off the kind hues); same-domain nodes
  cluster in the ELK layout;
- ownership by **nesting** (containers, ELK `hierarchyHandling=INCLUDE_CHILDREN`); dependency **edges**
  orthogonal, coloured by source, `edge.kind`→line style, labels **on-demand** (only for the selected
  node), above the container fill; a cyclic `parent` or a dangling edge can't hang or blank the render;
- **tap = open detail, drag = move**; selection via a document-level `pointerup` hit-test (a trackpad
  tap fires no `click`); select → **ring the clicked node** + highlight its neighbourhood + dim the rest;
- **detail panel**: prose description → tagline → references → kind·domain → rows (with `↳ means`) →
  depends-on / used-by, empty sections hidden, purple headers, reference chips a distinct link-blue;
- **tooltips** via one document `mousemove` reading `data-means`; **lightbox** for image refs; a
  self-describing **legend** generated from the kinds + domains actually present.

The full research behind the encoding: `references/color-encoding-research.md`.
