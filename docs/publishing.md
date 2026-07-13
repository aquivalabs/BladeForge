# Publishing — how the marketplace updates itself

`scout` reads `plugins/scout/skills/scout/catalog.json` to discover and install skills.
That file is **generated, never hand-edited**. The `scout-publish` workflow keeps it current
automatically — this is the marketplace's self-update mechanism.

## What happens on every merge (the scout bot)

`main` is protected: changes land only through a PR that passes `eval-gate` + `scout-gate`.
On merge (a push to `main`), the `scout-publish` workflow runs and:

1. Regenerates `catalog.json` from every plugin's skills + `metadata.yaml` (`scripts/gen_catalog.py`).
2. PATCH-bumps the `version` of each plugin whose skills changed in that push (so `/plugin update`
   actually reinstalls them — an un-bumped skill edit never reaches users).
3. Commits as `scout-publish-bot` and pushes the result straight back to `main`, marked `[skip ci]`
   so the bot's own push does not re-trigger the workflow.

So the catalog and versions are correct "by construction" after every merge. You never edit
`catalog.json` or bump a version by hand.

## How the bot pushes to a protected `main` (deploy key)

`main` is protected by the `main-protection` **ruleset** (required checks `eval-gate` + `scout-gate`,
PR required). The ruleset lists **Deploy keys** as a bypass actor, so a push authenticated by the
repo's write **deploy key** bypasses those rules. `scout-publish` checks out with that key
(secret `DEPLOY_KEY`) and pushes over SSH.

Why a deploy key and not the built-in `github-actions[bot]`: the bot bypass is an org-owner action
(org-level ruleset + `admin:org`); this repo's admins are org members. A deploy key is repo-owned,
needs only repo-admin, does not expire, and does not require weakening `enforce_admins`.

**This is already configured** — no setup needed. For reference, the pieces are:

- A write deploy key on the repo (Settings → Deploy keys, "scout-publish").
- Its private half in the repo secret `DEPLOY_KEY`.
- The `main-protection` ruleset with the Deploy keys bypass.

## Maintenance

- **Rotate the key:** generate a new `ed25519` keypair, replace the deploy key (public half) and
  the `DEPLOY_KEY` secret (private half). No ruleset change — the bypass is "any write deploy key."
- **Revoke:** delete the deploy key; `scout-publish` pushes then fail until a new key is set. Human
  PRs are unaffected.
- **Verify:** merge any PR that touches a skill, then check the Actions tab — `scout-publish` runs
  and `main` gains a `chore(scout): regenerate catalog ...` commit by `scout-publish-bot`.

## Migrating to the built-in bot later

If an org owner grants the `github-actions` ruleset bypass on `main`, switch `scout-publish.yml`
to the default `GITHUB_TOKEN` (`permissions: contents: write`, drop the `ssh-key:` line and the
`[skip ci]` guard — default-token pushes don't re-trigger), delete the deploy key and the
`DEPLOY_KEY` secret. That removes the key entirely.
