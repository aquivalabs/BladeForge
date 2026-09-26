---
description: The rule for what may live inside a comment in source code, and what must move out of the file into a document. Use whenever a change touches a comment in a code file — writing one, deleting one, shortening or cleaning up existing ones, adding a doc block or docstring, or deciding whether an explanation belongs in the code at all — in any language: TypeScript, JavaScript, Apex, Python, shell, scripts and tests included. Also use when reviewing a diff and judging whether its comments are a pointer, a directive, a short doc block, or a comment another house standard requires — or prose that should not be there. Do NOT use for writing the document itself once the decision to move an explanation out of the code is made — an ADR, a decision-log entry, a mechanism page, a README, a PR description or a commit message is written by the skill that owns that document, not this one.
---

# No code prose

A comment is a pointer, never an essay. Apply on every edit to a source file, in any language.

## Contract

**In:** a source file being written, edited or reviewed, in any language.

**Out:** every comment in the changed code is one of the four forms below, within its limit, and
no explanation of *why* the code is the way it is lives in the file — it lives in a document the
code points at. This IS the acceptance criteria.

---

## The four forms

| Form | Recognised by | Limit |
|---|---|---|
| **Pointer** | a path — `docs/mechanisms/x.md`, `BACKLOG/gap_x.md` — an ADR number, or a ticket key | one line |
| **Directive** | a tool prefix — `eslint-disable-next-line`, `@ts-expect-error`, `prettier-ignore`, `TODO(<pointer>)` | one line |
| **Doc block on an export, one of its members, or the module itself** | the line after the block begins the language's export keyword, or declares a member of an exported type — an interface field, an enum case, a class property — or the block opens the file, with nothing but blank lines above it | three lines of eighty characters, delimiters and leading `*` excluded; an `@example` or other tag block below the prose is carried through and does not count |
| **A comment another house standard REQUIRES** | that standard names the comment and a review or gate checks for it | whatever that standard sets |

A doc block says **what** the export does and **how** it is called. Two sentences. Not why.

**A module's own header is a doc block on the module, and the module is what the file exports.** The
block at the top of a file — nothing but blank lines above it — states what this file IS, under the
same three-line limit as any other. A script's usage block is the same form and the same limit: name
the flags, and put the reasoning behind them in the document the script serves. Without this clause
the rule reads every module header as prose and deletes the one line a reader arriving at a file
needs first.

**A comment another standard requires is not this rule's to delete, and the conflict is real.** A
test standard that mandates `// Setup` / `// Exercise` / `// Verify` in every case, an axis walk
naming which axes a file applies and which it declares n/a, a named constant whose comment says why
that value, or a note naming the boundary a substitution crosses — each of those is a declaration a
reviewer checks for, not prose a reader skims past. Applying this rule over the top of one deletes
something a gate then asks for. So: before cutting a comment in a file some other standard governs,
read that standard and keep what it names. The rule that mandates a comment wins, and this rule is
what governs everything it does not mention.

A member of an exported type is part of that contract — a consumer reads an interface's fields, not
only its name — so a field doc is the same form under the same limit. A local variable inside a
function body is not: nobody outside reads it, and a comment there is prose.

Anything else is prose: delete it, or move it to the document that owns it and leave a pointer.

## A "why" has no place in code

A reason worth writing down is worth a line in an ADR, a decision log or a mechanism page, and
the code points at that line. A reason not worth that is not written.

`// because …` is not a short form of this rule; it is the sign a decision was never recorded
where decisions live. `// measured <date>: …` is the same sign for evidence — the spec or the
decision log holds it, dated.

## Tests are not exempt

A test that needs a paragraph to say what it pins has a bad name. The situation goes in the
title; the reason the case exists goes in the spec the suite implements.

## Per-language syntax

One rule; only the delimiters differ. A new language is a new row.

| Language | Files | Comment syntax | Export keyword |
|---|---|---|---|
| JavaScript / TypeScript | `.js .jsx .ts .tsx .mjs .cjs` | `//`, `/* */`, `/** */` | `export` |
| Apex | `.cls .trigger` | `//`, `/* */`, `/** */` | `global`, `public` |
| Python | `.py` | `#`, `"""…"""` | a top-level `def` or `class` |
| Shell | `.sh .bash .zsh` | `#` | none — shell has no doc-block form |

## What it looks like

```diff
-// The invoice's externalRef is the ledger's key, never the row id — the two were confused
-// once and the wrong ledger loaded silently. Match on externalRef, then take the latest
-// revision. Verified on the staging tenant 2026-09-24.
+// docs/mechanisms/ledger-lookup.md § revision
 const revision = revisions.find((entry) => entry.externalRef === invoice.externalRef);
```

```ts
/**
 * Resolve the latest revision of an invoice's ledger entry, or null when it has none.
 * Pass the invoice and its candidate revisions; matching is by external reference.
 */
export function resolveLedgerRevision(invoice, revisions) { … }
```

Add a third line saying *why* it matches by reference and the block is over the limit: that
line is a decision, and it goes in the mechanism page.

## Before you finish

1. Every comment in the changed code is one of the four forms; no fifth kind.
2. Every doc block — on an export, on a member of one, or at the head of the file — is at most
   three lines of eighty characters and says what, not why. A listing below the prose (an
   `@example`, a usage block, a flag table) is carried through and counts against nothing.
3. Every "why" you wanted to write is in a document the code points at, or not written.
4. Every pointer resolves: the path exists, the ADR number is real, the ticket key is the
   project's.
