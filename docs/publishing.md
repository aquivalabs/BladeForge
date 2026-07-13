# Publishing — how the catalog stays current

`scout` reads `plugins/scout/skills/scout/catalog.json`. That file is generated, never
hand-edited. The `scout-publish` workflow keeps it current automatically.

## What happens on merge

On every push to `main` (i.e. every PR merge), `scout-publish`:

1. Regenerates `catalog.json` (`scripts/gen_catalog.py`).
2. PATCH-bumps the `version` of each plugin whose skills changed in that push.
3. Commits and pushes the result back to `main` (commit marked `[skip ci]` so it does not
   re-trigger itself).

You never edit `catalog.json` or bump versions by hand.

## One-time setup (repo admin)

The push in step 3 goes to a protected `main`, so it needs an identity allowed to bypass
the branch rules. The clean built-in `github-actions[bot]` bypass requires an **org owner**
(org-level ruleset + `admin:org`); this repo's admins are org **members**, so we use a
personal access token instead.

Do this once:

1. **Create a fine-grained PAT.** GitHub → Settings → Developer settings → Fine-grained
   tokens. Scope it to `aquivalabs/BladeForge` only, permission **Contents: Read and write**.
   Set a calendar reminder to rotate it before it expires.
2. **Add it as a repo secret.** Repo → Settings → Secrets and variables → Actions → New
   repository secret, name **`PUBLISH_TOKEN`**, value = the PAT.
3. **Let the token bypass required checks.** Turn off `enforce_admins` on `main` so the PAT
   owner (a repo admin) can push directly:

   ```bash
   gh api --method DELETE repos/aquivalabs/BladeForge/branches/main/protection/enforce_admins
   ```

   Re-enable any time with the `PUT` form of the same endpoint.

## Verifying it works

Merge any PR that touches a skill, then check the Actions tab: `scout-publish` should run,
and `main` should gain a `chore(scout): regenerate catalog ...` commit by `scout-publish-bot`.
If the push step fails with a 403/permission error, the PAT lacks `Contents: write` or the
secret is empty; if it fails on branch protection, `enforce_admins` is still on.

## Migrating to the built-in bot later

If an org owner grants the `github-actions` ruleset bypass on `main`, switch `scout-publish.yml`
back to the default `GITHUB_TOKEN` (`permissions: contents: write`, drop the `token:` line and
the `[skip ci]` guard) and delete the `PUBLISH_TOKEN` secret. That removes the PAT and its
rotation burden.
