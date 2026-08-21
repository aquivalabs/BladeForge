# Documentation map

This project follows the docs standard. A decision goes to an ADR. A mechanism goes to a live doc. A rule
this project states about itself goes to a skill. A frozen record stays frozen. Anything that fits none of
those — a root README, a runbook, an onboarding guide, a changelog, a glossary — is ungoverned and unchecked
on purpose. Forcing it into one of the four layers would only mislabel it.

## Layers in this project

- **Decisions** → [`docs/adr/`](adr/README.md) — architecture decision records.
- **Mechanisms** → [`docs/mechanisms/`](mechanisms/README.md) — one file per live mechanism.

`.claude/docs.config.json` is the authoritative list. A project may add a `skill` layer or a `frozen` layer
later, as more of the standard is adopted; each new layer gets its own directory and its own `README.md`
before it can be declared.

## Placement rule

- Recorded a decision? Write an ADR.
- Described how something the code actually does behaves, in a way more than one place depends on? Write a
  mechanism doc.
- Stated a rule this project enforces on itself? That belongs in a skill, not a doc.
- Snapshotting something correct as of a date, never to be edited again? That is a frozen record.
- Fits none of the above? Leave it ungoverned. A text that fits no layer is a prompt to re-check the layer
  choice, not a reason to invent a layer.

## Update rule

A change touching a declared mechanism updates that mechanism's doc in the same PR. The check enforces this
against the diff; nothing else in the standard is diff-scoped.

## These templates are one-shot seeds

Everything under `docs/` that the installer seeded — this file, the layer READMEs, the worked mechanism
example — is written once and then owned by this project. Re-running the installer never overwrites any of
it again. Only `scripts/docs-check.py` and `.claude/docs.config.schema.json` are refreshed on every re-run;
edit this file and the layer READMEs freely as the project learns what it needs.
