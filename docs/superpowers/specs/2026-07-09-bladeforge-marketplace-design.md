# BladeForge — company Claude Code skills marketplace

**Status:** design approved, pre-implementation
**Date:** 2026-07-09

## Goal

Give the aquivalabs team a curated, installable Claude Code marketplace, kept in
sync from the public personal marketplace `Xaaalera/claude-skills` — without
exposing personal-voice plugins, and without letting unreviewed changes land in
the company copy.

## Source of truth & direction

- **`Xaaalera/claude-skills` (public) = source of truth.** All authoring happens
  there. It gains only a tiny trigger workflow (below); plugin content is never
  edited for BladeForge's sake.
- **`aquivalabs/BladeForge` = downstream company mirror** and owns the heavy sync
  logic. Plugin content is never hand-edited here; it only arrives via sync.
- **Direction is one-way:** a push in the source triggers BladeForge to pull,
  filter, and open a PR into its own `main`. The PR is the review gate — a
  company maintainer approves before a change lands.

## Naming

| Thing | Value |
|---|---|
| Repository | `aquivalabs/BladeForge` |
| Marketplace identifier (`plugin@<id>`) | `bladeforge` (lowercase — typed by users) |
| Display name | BladeForge |
| Tagline | "Blade Runner Skills" theme, used in README/description copy |

Install references become `review@bladeforge`, `cicero@bladeforge`, etc.

## Plugin selection (exclude-list)

Sync **every** plugin in the source **except** an explicit exclude-list. Default
is include — new plugins added to the source flow to BladeForge automatically,
without editing the sync config.

```
exclude: lovecraft, diogenes
```

The exclude-list grows by request (Roman names anything that should not ship).

**Why exclude, not allow:** the source keeps gaining plugins; an allow-list would
need editing on every addition. Trade-off — a brand-new personal plugin would
auto-sync unless excluded. Backstop: the sync PR is human-approved, so nothing
lands in `main` unseen; an unwanted plugin shows in the PR and is simply not
merged (then added to the exclude-list).

## Sync mechanism (instant, push-triggered)

Two halves:

### A. Trigger — in the source repo (`Xaaalera/claude-skills`)

- Un-ignore `.github/` in the source `.gitignore` (add `!/.github/`) so a
  workflow file can be tracked and pushed.
- A tiny workflow: **on** push to `main` touching `plugins/**`,
  `.claude-plugin/**`, or `scripts/**`, it fires a `repository_dispatch` to
  `aquivalabs/BladeForge`.
- Auth for the dispatch: a **fine-grained token** (PAT or GitHub App
  installation) with permission to trigger `repository_dispatch` on BladeForge,
  stored as an Actions secret in the source repo. This is the one cross-repo
  credential.

### B. Sync — in BladeForge

On `repository_dispatch` (plus a manual-dispatch button as a fallback):

1. Check out the public source repo — read needs no auth.
2. Copy every `plugins/<name>/` dir **except** the exclude-list, plus `scripts/`
   (scripts are required by the eval gate), into the BladeForge tree, replacing
   prior content for those paths.
3. Regenerate `marketplace.json` with `owner = aquivalabs`, `name = bladeforge`,
   listing every synced (non-excluded) plugin.
4. Recreate the branch `sync/from-personal` from the latest `main`, commit the
   changes onto it (force-updated each run — always fresh from `main`).
5. Open a PR from `sync/from-personal` into `main` if none is open; otherwise the
   existing PR updates automatically.

- **Branch/PR model:** one rolling branch, one rolling PR. The branch is
  recreated from `main` each run (no drift); there is never a pile-up of stale
  sync PRs.
- **Write auth:** BladeForge's own `GITHUB_TOKEN` (`contents: write` +
  `pull-requests: write`) — the write target is the same repo.

## Eval gate (CI)

- Port the existing pre-push logic (`scripts/eval-gate.sh` + `validate_eval.py`)
  into a **CI workflow inside BladeForge**, running on every PR.
- Marked as a **required status check** on `main` — a PR cannot merge unless the
  eval gate passes.
- The local pre-push hook stays in the source repo for fast local feedback; CI is
  the hard enforcement point.

## Protected `main` (BladeForge)

- No direct pushes.
- Merge only via PR.
- Required status check: the eval gate.
- Require ≥1 approving review.

## README rework

Rewrite BladeForge's README for a teammate installing plugins, not for the
author. Target structure:

1. **What this is / why** — one paragraph.
2. **Install** — two commands (add marketplace, install a plugin).
3. **Plugin catalog** — a table: plugin · what it does · install ref.
4. **Contributing** — changes flow through the public source repo; the sync PR;
   the eval gate.

Drop the personal framing and any `lovecraft`/`diogenes` references.

## Non-goals

- No hand-editing of plugin content directly in BladeForge.
- No two-way sync (BladeForge never pushes back to the source).
- No migration of `lovecraft`/`diogenes`.
- No editing of source plugin content for BladeForge (only the trigger workflow
  + one `.gitignore` line are added there).

## Dependencies (need org-admin rights on `aquivalabs`)

May require someone with `aquivalabs` org-admin, if Roman lacks them:

- Create the `BladeForge` repo under the org.
- Configure branch protection on `main`.
- Provision the cross-repo dispatch token (fine-grained PAT or GitHub App) and
  store it as an Actions secret in the source repo.

Everything else (both workflows, marketplace.json generator, eval CI, README) is
authored in the repos with the built-in token — no special org rights.

**Initial seed:** the first run (manual dispatch, or the first qualifying push)
produces the seeding PR; there is no separate one-off import script.

## Acceptance criteria

1. `aquivalabs/BladeForge` exists; a sync run seeds it with every source plugin
   except the exclude-list, plus `scripts/`, and a regenerated `marketplace.json`
   (`owner=aquivalabs`, `name=bladeforge`).
2. A teammate can add the marketplace and install a plugin per the README.
3. A push to the source `main` touching a non-excluded plugin results, within
   seconds, in an updated `sync/from-personal` PR in BladeForge (verified once,
   end to end).
4. `lovecraft`/`diogenes` never appear in BladeForge.
5. BladeForge `main` rejects a direct push and a PR whose eval gate fails.
6. README follows the structure above; no personal framing.
