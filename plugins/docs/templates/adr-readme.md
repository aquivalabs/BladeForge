# Architecture decision records

## Boundary

An ADR records a decision about how this project's architecture works, and why it was made that way. It is
not a mechanism — how something already works belongs in a live doc under `docs/mechanisms/` — and it is not
a rule this project enforces on itself, which belongs in a skill.

## Shape

Every ADR carries exactly four sections, in this order:

- **Status** — proposed, accepted, superseded, or deprecated.
- **Context** — what forced the decision, and the options that were on the table.
- **Decision** — what was decided, stated plainly.
- **Consequences** — what this decision makes easier, harder, or impossible.

## Update trigger

A new ADR is added when a real architectural decision is made, not for every code change. An existing ADR's
`Status` changes when a later decision supersedes it. The body of an accepted ADR is not rewritten after
acceptance — a decision that no longer holds gets a new record whose `Status` says so, and the old record's
`Status` moves to `superseded`.

## Exclusions

- How a mechanism behaves day to day → a live doc under `docs/mechanisms/`, not an ADR.
- A rule this project enforces on itself → a skill, not an ADR.
- A record that is correct as of a date and never revisited → the frozen layer, if this project has one.

## Acceptance criteria

An ADR is finished when all four sections carry real content in place of this template's starting answers,
its `Status` is set, and it has a row in the index below.

## Filenames

`NNNN-kebab-case-title.md` — a four-digit, zero-padded, sequential number, then a short kebab-case title.
Example shape: `0001-choose-the-message-queue.md`.

## Index

<!-- Add one row per ADR, in number order, linking to the file relatively. -->

| # | Title | Status |
|---|-------|--------|

## Referencing an ADR from code

At the seam a decision governs, leave a one-line comment pointing at the record it comes from, in whatever
comment syntax the language uses:

```
// See docs/adr/0001-choose-the-message-queue.md
```

Records the code never references go unread.
