# Mechanisms

## Boundary

A mechanism doc describes one thing this project's code actually does, at the seam a config entry names. It
is not a decision — why the mechanism exists in its current form, if that was ever debated, belongs in an
ADR — and it is not a rule this project enforces on itself, which belongs in a skill.

## Shape

State what the mechanism is, where it lives in the code, how it behaves, and what change to it obliges an
update to this file.

## Update trigger

Any change to a file under a mechanism's declared `paths` in `.claude/docs.config.json` updates that
mechanism's doc in the same PR. The check enforces this against the diff.

## Exclusions

- A decision about why the mechanism exists in its current form → an ADR, if one was made.
- A rule this project enforces on itself, checked by a skill → a skill, not a mechanism doc.

## Acceptance criteria

A mechanism doc is finished when a reader who has never touched this code can find every file it names,
understand what would break if the mechanism's behavior changed, and knows what change obliges an update.

## Directory convention

One file per mechanism, named after the mechanism's config `id`: `docs/mechanisms/<mechanism-id>.md`. See
[`price-rounding.md`](price-rounding.md) for a worked example.

## No index, deliberately

This layer carries no index file listing every mechanism. `.claude/docs.config.json`'s `mechanisms` array
already enumerates every one; a second list here could disagree with it, which is a new drift source rather
than a check.
