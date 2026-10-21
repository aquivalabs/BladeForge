---
description: Use when someone asks for a presentation film, video briefing or animated walkthrough of one specific feature or change, built from its spec, plan, code or ticket, to show a team, stakeholders or a client why it exists, how it works and what is still open, and made in Claude Motion. Do NOT use for a promo or marketing video, a generic animation or a skill's showcase hover film (plain Claude Motion), for a slide deck (the Slides type), for a clickable code-architecture diagram (diagram:diagram), or for a how-to tutorial.
---

# Feature film

An honest briefing on one feature, made in Claude Motion: the viewer feels the problem, follows one
request through the feature, sees what is proven and what is open, and knows whom to write to.

## Contract

**In:** material on one feature (spec, plan, code, ticket, commits) · its author to answer what the
material does not · the Claude Motion artifact type and the `Artifact` and `ArtifactData` tools · Node and Chrome for the
local build and frame check.

**Out:** one published Claude Motion film of at most 300 s, built from a storyboard the user saw first ·
a short report: the film's link, which facts on screen are sourced and which are invented and footnoted,
and that the film is private until the user shares it.

---

## Roles

The **Director** (you) is the only writer of the storyboard. The **Braintrust** reviews it and never
edits (`references/braintrust.md`). **Claude Motion** is the film's home: its store holds the scenes,
its player plays and scrubs them and composes the score, viewers pin comments to a moment, and it exports
MP4. The scenes are written on Claude Motion's scene API and checked locally first (step 7), because a
frame you have looked at is the only proof that nothing overlaps.

## Steps

1. **Gather the material.** Read every source on the feature. Write down each fact you may show with its
   source. Ask the author what the chapters need and the material lacks — above all one real case of the
   pain. Rules for a silent author, a product that cannot be run, and a demo where you may invent:
   `references/chapters.md` §1.
2. **Pick the running example and the stakes.** One request any viewer understands, carried through the
   whole film; the first scene shows it failing without the feature. `references/chapters.md` §2.
3. **Write the storyboard** — title, stakes, definition with an analogy, who, one showcase ride (one
   object and one event per station, a progress counter), finale in three beats. Shape and a full worked
   example: `references/storyboard.md`. Screen rules: `references/screen.md`. Estimate the length from it;
   over 300 s, cut by story before you think of a series.
4. **Edit the copy with `references/voice.md`**, in the viewer's language.
5. **Run the Braintrust on the storyboard** and apply its findings (`references/braintrust.md`).
6. **Show the storyboard in chat** as a table of screens and wait for the user's go-ahead or changes.
7. **Build the scenes locally.** One scene file per storyboard screen, written on `scripts/kit.js`,
   palette tokens in a copy of `scripts/base.css` (company design system, else the project's UI tokens,
   else ask; one warm accent), an optional `score.js` on Claude Motion's sound API. `node scripts/build.mjs
   <work_dir>` packs them; `node scripts/shoot.mjs <work_dir>` shoots every scene and a contact sheet.
   Read every frame: nothing overlaps, wraps where it should not, or is cut off. Fix and shoot again.
   Details and pitfalls: `references/build.md`.
8. **Publish to Claude Motion.** Create the film from the Motion type (title only, opens after the first
   write), then write `out/docs/writes.json` as ONE `ArtifactData` batch. A later fix rewrites only the
   changed documents, each with its `if_version`. Open the film in the browser.
9. **Report.** The link; one line on what is sourced and what is invented; that the film is private until
   shared from its Share menu.

## Honesty floor

Every number, quote, status and result on screen comes from a source or carries a footnote saying it is
an example. A count you did not run is labelled as counted, not passed. Competitors and predecessor tools
are never named. Known problems come from the material, never hunted for to look balanced, and never
hidden. Full rules: `references/screen.md` § Honesty.

---

## Before you finish

1. Open the storyboard: every screen has `secs`, the total is at most 300, every `fact` has a `source`,
   and every `invented` fact has a footnote on its screen.
2. Read the captions against `references/voice.md` and the limits in `references/screen.md`: at most 15 words a
   caption, at most two captions per showcase step, no blunt question, no fact said twice.
3. The first screen after the title is the stakes scene; the finale holds both outcomes, the proof with
   its "not proven yet" line, at most three problems, at most two topics, and the invitation.
4. `node scripts/shoot.mjs <work_dir>` exits 0, you read the contact sheet, and the film is published to
   Claude Motion.
5. The report names the link, the sourced-versus-invented line, and the sharing note.
6. Any line fails? Fix the storyboard or the scene, and check again from 1.
