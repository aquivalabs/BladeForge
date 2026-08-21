# Sources

One heading per source. The `docs:standard` skill body links here by anchor rather than citing a
URL inline; this file is the only place a URL appears.

## arc42 after the 12 chapters

[blog.hompus.nl — arc42 after the 12 chapters](https://blog.hompus.nl/2026/02/25/arc42-after-the-12-chapters/)

Supports the mechanism-not-feature axis and the cap: which arc42 chapters teams keep maintaining
and which they abandon, chapter 8 among the abandoned.

## arc42 chapter 9 architectural decisions

[blog.hompus.nl — arc42 chapter 9, architectural decisions](https://blog.hompus.nl/2026/02/18/arc42-chapter-9-architectural-decisions/)

Supports the ADR layer: the practitioner workflow is a timeline of decisions linking out to full
ADR records rather than restating them.

## ADR discoverability

[adr.github.io](https://adr.github.io/)

Supports linking code back to the ADR that governs it: an ADR the code never references tends to
go unread.

## the agent instructions open specification

[github.com/agentsmd/agents.md](https://github.com/agentsmd/agents.md)

Supports treating `AGENTS.md` as the preferred home for agent-facing instructions — an open,
donated specification with wide adoption, not a house convention.

## the agent instructions authoring guide

[augmentcode.com — how to build AGENTS.md](https://www.augmentcode.com/guides/how-to-build-agents-md)

Supports the content rules for `AGENTS.md`: no architecture overview, roughly a 150–200 line cap.

## the auto-generation penalty

[arxiv.org/pdf/2601.20404](https://arxiv.org/pdf/2601.20404)

Supports the never-auto-generate rule: a measured performance penalty for generated instruction
files versus authored ones.

## vendored copies drift silently

[arxiv.org/pdf/2606.14616](https://arxiv.org/pdf/2606.14616)

Supports naming the cost of vendoring plainly: a vendored copy drifts from its source with no
signal, which is the trade the one-shot-seed distribution model accepts.

## the copier three-way merge

[copier.readthedocs.io — updating](https://copier.readthedocs.io/en/stable/updating/)

Supports naming the one distribution pattern with a real update path, which this standard does not
adopt, so the trade above is a choice rather than an oversight.

## why continuous documentation is still unsolved

[dev.to/nilzkool — why CI/CD still doesn't include continuous documentation](https://dev.to/nilzkool/why-cicd-still-doesnt-include-continuous-documentation-m09)

Supports why the deterministic check stays binary: detecting "this doc is still correct after the
change" is unsolved, so the check tests presence and pairing, never correctness.

## explicit declaration precedents

[backstage.spotify.com — Soundcheck filters](https://backstage.spotify.com/docs/plugins/soundcheck/core-concepts/filters)
· [monorepo.tools](https://monorepo.tools/)

Supports declaring the mechanism list by hand rather than inferring it from imports or directory
structure: both working precedents for this kind of rule are explicit, not inferred.

## declared skip routes

[github.com/scientific-python — action-towncrier-changelog](https://github.com/scientific-python/action-towncrier-changelog)
· [astronomer.io — tracking innovation with Towncrier](https://www.astronomer.io/blog/tracking-innovation-how-astronomer-streamlined-release-notes-with-towncrier/)

Supports the shape of the update-rule exemption: every changelog-style gate that survives in
practice pairs its check with a visible, reviewer-seen skip label rather than a silent bypass.

## external link checking as a false-blocking source

[github.com/arduino — tooling-project-assets pull 645](https://github.com/arduino/tooling-project-assets/pull/645)

Supports checking internal links only: one project raised its external-link failure tolerance to
12 a day just to keep the gate usable, which is why external links are not checked at all here.

## diagrams as code and C4 levels

[dev.to/simonbrown — diagrams as code 2.0](https://dev.to/simonbrown/diagrams-as-code-2-0-82k)

Supports naming a diagram tool and a frame without requiring either: C4 levels 1–2 carry most of
the value at low upkeep cost, per the frame's own author.
