# Mechanisms — the live layer

One page per mechanism, each tracking the code it describes. A mechanism doc is not a guide and not a
decision record: it states how a working part of this repository actually behaves right now, and it is
wrong the moment the code moves without it.

## Boundary

A page belongs here when it describes a MECHANISM — a working arrangement of scripts, files, hooks and
gates that a contributor has to understand before touching it, and that no single file explains on its
own. The organising axis is the mechanism, never the feature.

Adjacent layers, so the line is visible: a durable choice and its reasoning is an ADR in
[../adr/](../adr/) · a rule this marketplace enforces is a skill in `plugins/` · a spec or plan is a
frozen record in [../superpowers/](../superpowers/) and is never edited after its date · a
contributor how-to with no mechanism behind it is a plain guide in [../](../).

## Shape

Markdown, one file per mechanism, named for the mechanism itself. It opens by naming the parts and
what each is for, then says who reads and who writes each part, then what blocks and what merely
warns. Where a past failure explains a design choice, the failure is recorded with its commit — a
rule whose reason is missing gets "cleaned up" by the next author.

## Update trigger

A change to any script, file or gate the page names updates the page in the SAME pull request. If a
mechanism's parts move and its page does not, the page is no longer describing this repository.

## Exclusions

Not here: rationale for a decision already taken (ADR) · rules an author must follow (a skill) ·
anything frozen at a date (spec, plan) · one-off runbooks and onboarding text, which have no mechanism
underneath them and sit in the docs root.

## Acceptance criteria

1. Every file this page names exists at the path given.
2. Every script this page says writes a file actually writes it — the check is to read the code, not
   the intention, because this layer has already been wrong about exactly that.
3. What blocks and what warns is stated per check, never left implied.
4. A design choice explained by a past failure names the commit that caused it.
5. The page contains no instruction an author is expected to follow — that belongs in a skill.
