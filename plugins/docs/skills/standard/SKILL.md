---
description: Use when deciding where a piece of documentation belongs — a decision, a mechanism, a rule, or a frozen record — when project docs are drifting from the code they describe, when writing or updating AGENTS.md, or when adopting or installing this documentation standard in a repo.
---

# Documentation standard

Documentation decays for two reasons. Nothing says which kind of text a given document is, so every text drifts into every role — a system description ends up living inside a skill file. And nothing ties a document to the change that invalidates it. This skill names four kinds of document, says where each belongs, and states the one rule that keeps a mechanism doc attached to its code.

## The four layers

Each layer has one duty and one update discipline. Merging any two forces one of them to lie.

- **ADR** (`docs/adr/` by default) — a decision. Never updated, only superseded.
- **Live doc** (`docs/mechanisms/` by default) — a mechanism. Must change with the code it describes.
- **Skill** — a rule this standard itself states. Changes when the rule changes.
- **Frozen record** — a spec or a plan, correct as of its date. Never edited, whatever it later turns out to be wrong about.

The organizing axis for the live-doc layer is *mechanism*, not feature: a feature gets rewritten and its page rots with it, and most feature pages have no mechanism distinct from the code itself. This is arc42's own chapter-8 unit, and practitioners report it as one of the chapters teams abandon first — see [arc42 after the 12 chapters](references/sources.md#arc42-after-the-12-chapters) — which is why the cap below exists.

A backlog is not a fifth layer and not documentation at all: every layer describes something that exists, and a backlog describes work that does not. It belongs in the ungoverned bucket below, next to an issue tracker.

## Placement

Decision → ADR. Mechanism → live doc. A rule this standard states → a skill. A frozen record stays frozen. Beyond the four layers sits an **ungoverned bucket**: root READMEs, runbooks, generated API references, onboarding, changelogs, migration notes, troubleshooting guides, glossaries, a file-based backlog. The check ignores any path no layer declares. A text that fits no layer is a prompt to re-check the layer choice, not a reason to invent one.

**"Ungoverned" answers which layer, not whether the file sits somewhere sane.** Those are two questions and the bucket only answers the first. A reader who takes "no layer governs this" as "nothing to do" leaves the sprawl the standard was adopted to end — untouched, and now with a green gate over it. So judge placement separately: a directory holding one document is not a section, it is a filing accident, and a docs tree with a thematic folder per file has no structure to speak of however clean each file is. Consolidation there is not this standard's rule to enforce, and it is the work an adopter came for.

A layer must be one directory before it can be declared — one root per layer, never a list of roots. A repo whose mechanism docs are scattered across several thematic folders collects them under one root first; nothing installs this move for you.

That collecting pass is worth running over the whole docs tree rather than only over the layer being declared, because the two problems are one. A thematic single-file directory is exactly where a mechanism-shaped document hides: it was filed by subject when it was written, nobody has read it since, and its subject is the mechanism. Flattening the tree and deriving the mechanism list feed each other, and doing them apart means reading the same files twice.

Every declared layer root carries a `README.md` stating that section's own documentation standard. The standard fixes the questions; the section writes the answers. Five questions, one heading each, identical in every project: `Boundary`, `Shape`, `Update trigger`, `Exclusions`, `Acceptance criteria` — the last keeps its full name because the audit agent looks for it by that name. The check verifies the file and the five headings exist, never the content of an answer.

The **frozen layer is exempt** from the README requirement and from every structure rule, because a frozen record is never edited and acceptance criteria are for documents still being accepted. The **live-doc layer carries no index**: the mechanism list in config already enumerates every mechanism, so a README index beside it would be a second list that can disagree with the first.

Diagrams are a section's own decision, not this standard's requirement — name a tool and a frame and stop. The `diagram` skill in this marketplace renders a diagram through a layout engine into one self-contained page, and C4 levels 1–2 usually carry most of the value at low upkeep — see [diagrams as code and C4 levels](references/sources.md#diagrams-as-code-and-c4-levels).

## The cap

Pick a few mechanisms; do not try to cover all of them. The mechanism list is a hard cap, reviewed rather than appended to freely — the same section that empties out in practice once a project stops enforcing one (see [arc42 after the 12 chapters](references/sources.md#arc42-after-the-12-chapters)).

## The update rule

A change touching a declared mechanism updates that mechanism's doc in the same pull request. An exemption is declared in config where a reviewer sees it, never granted silently. The structure rules — index agreement, required fields, internal links — have no such exemption: an exemption from being correct would not be an exemption, it would be a hole.

**Two traps in writing that config, both of which have shipped.** The `exempt` field releases the *whole* mechanism, every path it declares — so using it to note that one path was deliberately left uncovered releases the covered ones too, and the doc a reader trusts most becomes the one nothing enforces. A deliberately-uncovered path belongs in the doc's own update-trigger prose, which disables nothing. And `paths` are matched with `fnmatch`, where `**` is a plain wildcard with no zero-segment meaning: `src/**/hooks/**` requires a directory between the two and silently covers none of `src/hooks/`. Declare both shapes when you mean both, and check a `!` exclusion actually excludes something — one whose include never reached the file is dead config advertising coverage the matcher does not deliver. Both traps read as working config, which is why they need naming rather than discovering.

## Reporting model

One deterministic check blocks, and it holds no judgement — it tests paths, index agreement, and declared pairs, and nothing about quality. The `docs-auditor` agent advises instead: read-only, whole-tree, reporting severity-tagged findings — Major or Minor — against each section's own stated acceptance criteria rather than taste of its own. Documentation is in bad shape when a Major finding exists; that single sentence is the whole of what the agent's report means.

## The AGENTS.md content rules

`AGENTS.md` is the preferred home for agent-facing instructions — see [the agent instructions open specification](references/sources.md#the-agent-instructions-open-specification). It carries no architecture overview; that belongs one link away, in a live doc. It is never auto-generated: generated instruction files measurably underperform authored ones, per [the auto-generation penalty](references/sources.md#the-auto-generation-penalty). It stays roughly 150–200 lines, per [the agent instructions authoring guide](references/sources.md#the-agent-instructions-authoring-guide). Only the line cap is machine-checked; the other two rules are read by a person.

## The derivation procedure

A fresh install declares zero mechanisms, and the mechanism list is the one artifact deciding what the standard actually covers. Derive a first list this way, as prose a reader executes — nothing here is inferred by a tool:

1. Find every relative import path and every literal route or pattern string that repeats across three or more otherwise-unrelated files.
2. Drop any candidate that is already the sole subject of an existing ADR.
3. Rank what survives by repeat count, keep only as many as the cap allows, and write each as a `{id, paths, doc}` entry with a placeholder `doc` path under the live-doc layer root.

## Install

Fetch and run the installer directly. It is the entry point, not a path inside a clone that may not exist yet:

```bash
bash <(gh api repos/<org>/<marketplace-repo>/contents/plugins/docs/bootstrap.sh -H "Accept: application/vnd.github.raw")
```

Replace `<org>/<marketplace-repo>` with the marketplace that carries this plugin. Three host preconditions, all load-bearing: `gh` authenticated with access to that org, `jq` for merging plugin settings, and `python3` 3.9 or newer in the target project, for the check itself.

The installer seeds the config, the layer READMEs, one worked live-doc example, and the pre-push hook once and never touches them again — your mechanism list and your answers to the five questions are yours to keep. It refreshes the check script and its config schema on every run, so those two always match the plugin version you installed. Upgrades arrive by re-running the same one-liner; there is no separate upgrade command.

## Adoption, after the installer exits

The installer stops where the judgement starts, and the seeded config is a template rather than an answer. Run these nine steps in order before the first push. Every one of them was a real defect in a real adoption that skipped it, and the first four are detection rather than judgement — do them without asking.

1. **Point the line cap at the file that exists.** The seeded `surfaceRules.paths` names `AGENTS.md`. A project may carry `CLAUDE.md` instead, or both, or a differently-named instruction file. Look, then set it to what is there. A cap pointed at an absent path checks nothing and reports nothing, so the failure is silent.
2. **Declare the layers the project already has, not just the two the installer seeded.** Almost every repo already keeps specs or plans somewhere, and that is the frozen layer: declare it under the reserved `frozen` key so the standard covers the repo's real doc set. An undeclared layer is not a clean slate, it is coverage the config claims and does not have.
3. **Stop on a split layer.** One kind of document living in two places — specs in a root directory and under a docs tree, mechanism pages across several thematic folders — cannot be declared, because a layer is one root. Consolidate first, keeping the git history of each file, then declare. Finding the split is the point of this step: a project that had one usually does not know it.
4. **Reconcile `requiredFields` with the shape the existing docs actually use.** The check tests headings only. A project whose ADRs carry `Status` as a bold field line beside `Date` and `Source` will produce one finding per ADR, which reads as N broken documents and is in fact one decision about config. Decide which required fields are headings in this project, and drop the rest from `requiredFields` — the project's own README still mandates them.
5. **Rename an existing layer README's sections rather than replacing the file.** A README that already answers the five questions under its own names — "What belongs here" for `Boundary`, "What does not" for `Exclusions` — keeps its content and takes the standard's headings. Add only the questions it genuinely never answered. Replacing it loses project knowledge to satisfy a heading list.
6. **Walk the whole docs tree, not only the declared roots, and flatten what is a directory per file.** Count the documents in every docs directory. One is a filing accident, and several such directories are the sprawl the project adopted this standard to end — a green gate over an unchanged tree is the failure mode here, because it reads as done. Two rules settle most of it: a document that is the only thing in its directory joins a sibling directory or moves up, and a directory that survives has a reason a reader can state. Do this **before** step 7, because a thematic single-file directory is where a mechanism-shaped document hides, and this pass is what surfaces the candidates that one ranks.
7. **Then run the derivation procedure above**, and only then, because the mechanism list is the one step that needs a reading of the code rather than a look at the tree. Two things it routinely turns up, both worth acting on rather than filing: a document already doing a live doc's job outside the declared root — fold it in and delete the original rather than writing a second description of the same mechanism — and a page-worth of behaviour with no single directory to glob, which the standard already says to consolidate before documenting.
8. **Delete the seeded worked example once a real mechanism exists.** The installer leaves one, deliberately, as a shape to copy. Left in place beside real pages it is a document describing something the project does not have, in the one layer whose whole promise is that its pages match the code.
9. **If `acknowledgedEmptyMechanisms` goes in, file the task to take it out.** The flag is an interim state a reader can see, not a resting place. An adoption that sets it and records nothing has installed a gate that passes because it covers nothing, which is worse than no gate: the next reader believes the coverage is real.

## Acceptance criteria

A project that adopted this standard is done when:

- Every layer declared in config has a directory that exists, and every one of those directories, except the frozen layer's, holds a `README.md`.
- The mechanism list is non-empty, or `acknowledgedEmptyMechanisms` is set on purpose.
- Every mechanism in the list names a doc that exists.
- `scripts/docs-check.py` exits zero on the project.
- The hook is wired, and a push that violates a declared pair is actually rejected — installed is not the same as working.
- No document sits under two declared layer roots.
- The project's agent-instruction file follows the content rules above; only the line cap is machine-checked, the rest is a human read.
- `surfaceRules.paths` names an instruction file that exists, and the seeded worked example is gone.
- Every layer the project actually has is declared, the frozen one included, and none of them is split across two directories.
- No docs directory holds a single document, and every directory that survives has a reason a reader can state. This is the one criterion about the ungoverned bucket, and it is here because a project can satisfy every other item with its sprawl untouched — which is the shape of a green gate over an unchanged tree.

The first four items are what the check tests. The last three it cannot see, and each was missed by a real adoption: a line cap pointed at an absent path reports nothing, an undeclared layer is coverage the config claims and lacks, and the worked example is a page describing something the project does not have. Read them by eye before calling an adoption done.
