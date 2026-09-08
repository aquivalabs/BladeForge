# Encoding a heterogeneous, runtime-discovered set of node types — the research

**Question.** A diagram discovers at render time an arbitrary, mixed set of node categories (React
components + stores + functions, next to Apex classes, next to a Lambda…). We can't hardcode them.
The proposed plan was: *collect every category, then give each a distinct colour.* Is that right, and
how do we do the visual encoding so it reads well, stays comfortable, and doesn't turn into a rainbow?

Seven independent research lenses (≈525k tokens, ~90 sources). One lens was tasked to **challenge**
the framing. Findings that several lenses landed on independently are the load-bearing ones.

---

## Verdict on the framing

- **"Collect all, then assign" — right.** Because there's no streaming constraint, a batch decision
  over the full known set beats greedy per-category assignment (Colorgorical, Glasbey both assume N
  known up front). ✓
- **"One distinct colour per type" — wrong past ~8 types.** Categorical colour capacity is ~8
  (colour-blind-safe) to ~12 (absolute); past that, added hues stop being distinct pop-out classes and
  become a legend-lookup blur that *raises* clutter and slows the trace-a-path task. The challenger
  lens (Munzner/Moody/C4/Rosenholtz) is explicit: this framing conflates two jobs — "which subsystem"
  vs "which precise type" — that want **different channels**. ✗

So the corrected strategy is not "generate N distinct colours." It is: **classify into a coarse axis
and a fine axis, spend the scarce colour channel on few high-value values, and carry the rest on
other channels.**

---

## The corrected design (where the lenses converge)

### 1. Two axes, not one flat list
- **domain** — the subsystem a node belongs to (React app / Apex app / Lambda). Coarse, few values.
- **kind** — what the node is (component / store / class / lambda-handler). Finer, open-ended.

Encode them on **different perceptual channels** so they never fight (Ware integral/separable;
Munzner channel-interference):
- **domain → a translucent background ZONE** (Gestalt common-region — the strongest grouping cue,
  beats colour-similarity). Low-saturation, near-neutral wash as GROUND; label the zone with text.
  Cluster same-domain nodes in layout (Group-in-a-Box) so the hull stays compact.
- **kind → the node itself** (colour + shape + badge), as FIGURE.

**Never put two saturated colour systems in one layer** — a green domain tint under a blue node reads
as a spurious teal "third category." Domain zones stay achromatic-leaning; colour expressiveness is
spent on the node.

### 2. Colour is capped and stable, not maximal
- **Cap distinct hues at ~8** (CVD-safe), ~12 absolute. Past that, do NOT add hues.
- **Generate in a perceptually-uniform space** (HSLuv or CIELCh), fixing L* and chroma to a
  **comfortable mid band** and spreading hue evenly — this is what stops "some neon, some muddy."
- **Stable assignment:** hash the category *name* into a precomputed, prefix-stable (Glasbey-style),
  CVD-safe palette. Same name → same colour across every render/filter/zoom (mental-map stability).
  **Do NOT globally re-optimize per render** — colours would shift when the set changes and break
  learned associations.
- **Small curated override** for the handful of names with a real colour prior (`error`→red,
  `warning`→amber). Semantic colour otherwise does NOT help for technical tokens (`apex-class`,
  `lambda` have no association — mining returns noise); stable-hash-for-consistency is the honest
  default, not semantic-resonance-for-meaning.

### 3. When kinds exceed the colour cap → a SECOND, redundant channel
- Add **shape** (≤5–7 reliable), redundant with colour (every "apex-class" is always the same hue AND
  shape) — this also rescues colour-blind viewers and greyscale.
- Colour picks a GROUP, shape distinguishes WITHIN the group → colour×shape gives 40+ combos while
  staying glance-findable. Never let two kinds share BOTH colour and shape (conjunction-search trap).
- Skip texture/pattern fills — weakest channel, clutters on dark, useless at node size.

### 4. Always-on type badge (dual coding) — the safety net
- Dual coding (icon/badge + text label + colour) beats any single channel and is the best-corroborated
  finding. **Never icon-alone.**
- Open-ended types have no bespoke icon. Follow **ArchiMate's** precedent: shape + colour + a short
  **letter/monogram badge** (`λ`, `DB`, `fn`, `cmp`), not a per-type pictogram.
- A **curated** icon map only for a few genuinely transparent, well-known kinds (database→cylinder,
  queue→stack, error). For anything else, a **monospace badge** derived from the type string.
- **Never auto-pick a pictorial icon by keyword match** — risks a "perverse" icon (suggests the wrong
  meaning), which is strictly worse than none. Under-commit (badge) over over-commit (guessed icon).

### 5. Colour is also partly RESERVED for interaction (the biggest reframe)
- "Find all of a type" is a **filter/highlight** task, not a static-rainbow task. The single most
  salient channel is often better spent on **selection / focus / highlight-on-hover** than exhausted
  on static type. (Our engine already does select→highlight+dim — so the focus signal must not be a
  hue that collides with type hues: use a **luminance bump / ring**, not a new hue, for selection.)

### 6. Comfort on a dark canvas (so it doesn't hurt to look at)
- Canvas near-black L*≈8–12 (never `#000`); text near-white but not pure `#fff`.
- **No full-saturation fills** — pure hues on dark vibrate/halate (chromostereopsis). Keep fills at
  mid saturation/lightness.
- Verify **pairwise ΔE00 ≥ ~15–20** (glance-distinct, not just JND); verify **WCAG**: fill vs canvas
  ≥3:1, text vs fill ≥4.5:1 — per hue (blues need higher L* than yellows for the same ratio).
- Leave a **luminance budget**: normal fill L*≈30–55, so there's room for a lighter *selected* state
  and a darker *dimmed* state without hitting the canvas or blowing out.

---

## The numbers

| Guidance | Value | Source |
|---|---|---|
| Distinct categorical colours — CVD-safe / absolute ceiling | ~8 / ~12 | Okabe-Ito; ColorBrewer; Healey; Ware |
| Reliable shapes / border styles / textures | ~5–7 / ~3–4 / ~2–3 | Bertin; Healey & Enns; MacEachren |
| colour×shape combinatorial capacity | ~40–70 | Wilke; Healey |
| Colour space to generate in | HSLuv / CIELCh (perceptually uniform) | HSLuv docs; iWantHue |
| Min pairwise distance (glance-distinct) | ΔE00 ≥ ~15–20 (JND is ~2.3) | Colorgorical; Szafir; Sharma |
| Fill lightness band (dark canvas) | L* ≈ 30–55, mid chroma | Material dark; Ware; WCAG |
| Contrast: fill/canvas · text/fill | ≥3:1 · ≥4.5:1 | WCAG 1.4.11 / 1.4.3 |
| Canvas background | near-black ~#121212, not #000 | Material dark theme |
| Assignment | stable hash of NAME → prefix-stable palette; curated overrides | Glasbey; Qu & Hullman |
| When to add the 2nd channel (shape/badge) | kinds > ~8 (or > ~8 with CVD required) | Ware; Healey; Okabe-Ito |

---

## Recommended pipeline for the engine

1. **Discover** the full node set → count distinct `kind`s and `domain`s.
2. **domain** → translucent neutral background zones; cluster same-domain nodes in layout.
3. **kind → colour**: if ≤8, one comfortable CVD-safe hue each (HSLuv, fixed L*/chroma band, even
   hue), assigned by stable name-hash + curated overrides; verify ΔE + WCAG.
4. **kind → + shape** (redundant) when kinds > ~8; colour groups, shape within group.
5. **kind → + always-on badge** (letter/monogram; curated icon only for known-transparent kinds).
6. **Reserve** the selection/highlight signal as a luminance/ring change, not a hue (so it never
   collides with type hues).
7. **Legend** generated from the kinds/domains actually present (colour+shape+badge → name).
8. Everything **stable across renders** (hash-based), never globally re-optimized.

---

## Sources (deduped across the 7 lenses)

**Colour capacity & palette generation.** Miller 1956 (7±2); Healey 1996 "Choosing Effective Colours"
(IEEE Vis); Ware, *Information Visualization: Perception for Design*; Green-Armytage 2010 "A Colour
Alphabet" (26-ceiling); Gramazio, Laidlaw & Schloss 2017 "Colorgorical" (IEEE TVCG); Glasbey et al.
2007 "Colour Displays for Categorical Images"; Jacomy "I Want Hue"; distinctipy; Okabe & Ito "Color
Universal Design" (8-colour CVD-safe); Sharma, Wu & Dalal 2005 (CIEDE2000); Luo, Cui & Li 2006
(CAM02-UCS); ColorBrewer (Brewer & Harrower); CARTOColors; Chroma.js; d3-scale-chromatic; Szafir 2018
"Modeling Color Difference for Visualization Design" (size-dependent ΔE).

**Channels & redundant coding.** Bertin *Semiology of Graphics* (selective vs associative); Munzner
*Visualization Analysis & Design* (identity-channel ranking); Ware (preattentive); Treisman & Gelade
1980 (Feature Integration Theory); Nakayama & Silverman 1986 (separable-dimension conjunction);
Healey & Enns 2012 (TVCG); Wilke *Fundamentals of Data Visualization* ch.20 (redundant coding);
MacEachren *How Maps Work*; Wolfe "Guided Search 6.0" 2021; Cleveland & McGill 1984.

**Semantic colour.** Lin, Fortuna, Kulkarni, Stone & Heer 2013 "Selecting Semantically-Resonant
Colors" (EuroVis/CGF); Gramazio et al. 2017 (Name Difference / Name Uniqueness); Rathore, Leggon,
Lessard & Schloss 2019 (image-mined associations); Mukherjee et al. 2021/2022 "Context Matters"
(semantic discriminability); Mukherjee, Rogers & Schloss 2024 (LLM color-concept); Setlur & Stone
2016 (linguistic categorical colour).

**Two-axis / grouping.** Palmer 1992 "Common Region"; Ware (integral/separable, Garner 1974); Munzner
(containment); Tufte *Envisioning Information* (layering & separation); Collins, Penn & Carpendale
2009 "Bubble Sets"; Alper et al. 2011 "LineSets"; Dinkla et al. 2012 "Kelp Diagrams"; Meulemans et
al. 2013 "KelpFusion"; Rodrigues et al. 2011 "Group-in-a-Box"; Gansner, Hu & North 2010 "GMap".

**Icons / notations.** Moody 2009 "The Physics of Notations" (IEEE TSE — semantic transparency, dual
coding, discriminability, graphic economy); Paivio dual-coding theory; C4 model (notation-independent);
AWS / Azure architecture icon sets; UML stereotype icons; ArchiMate (shape+colour+letter-badge);
Nielsen Norman Group "Icon Usability"; ISO 9186.

**Framing / strategy.** Munzner (reduce idioms — filter/aggregate/embed; eyes-beat-memory; Mackinlay
1986 expressiveness/effectiveness); Moody 2009 (graphic economy, complexity management); C4; von
Landesberger et al. 2011 (large-graph survey); Rosenholtz, Li & Nakano 2007 "Measuring Visual
Clutter"; Qu & Hullman 2016 "Keeping Multiple Views Consistent".

**Comfort / dark theme.** HSLuv; Cohen-Or et al. 2006 "Color Harmonization" (SIGGRAPH); Itten *The Art
of Color*; Albers *Interaction of Color*; WCAG 2.1 §1.4.3 & §1.4.11; APCA (Myndex); Material Design
Dark Theme; chromostereopsis (chromatic aberration).
