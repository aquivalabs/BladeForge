---
description: Use this skill whenever the user asks to commit, create a commit, or push changes — e.g. "commit this", "let's commit", "make a commit". First syncs docs/skills owned by the changed area, then splits into atomic logical commits.
---

## Current git state

!`git status`

!`git diff --stat HEAD`

!`git diff HEAD`

## Step 0 — Sync docs & skills first

Before splitting commits, make the docs and skills match the change:
- Honor any `[*-sync]` reminder a PostToolUse hook surfaced this session (e.g. `config-sync`,
  `spec-sync`, `design-sync`, `env-sync`).
- If the change touches an area owned by a doc or skill, update that doc/skill in the SAME set of
  commits. Which doc/skill owns which area is repo-specific — the repo's `CLAUDE.md` names the mapping
  (e.g. a design-system doc, a project-spec doc, an owning skill). When unsure, check `CLAUDE.md`.

Do not split commits until docs and skills are up to date.

## Instructions

Analyze the changes above and split them into atomic logical commits. Rules:

1. **One logical concern per commit** — a single feature, a single refactor, a single fix. Never mix unrelated concerns in one commit.
2. **Commit message describes at most 2-3 actions** — if you need more words to describe it, the commit is too big.
3. **Use conventional commit prefixes:** `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`
4. **Order matters** — foundational changes (new files, new utilities, constants) go in earlier commits; consumers of those foundations go in later commits.
5. **Each commit must build** — never commit a state where an import references something not yet introduced in a prior commit.

### Steps to execute:

1. Unstage everything first: `git restore --staged .`
2. For each planned commit: stage exactly the right files with `git add <file1> <file2> ...`, then commit.
3. After all commits, run `git log --oneline -10` to confirm the result.
4. Show the final commit list to the user.

Do not ask for confirmation — analyze and execute the split directly.
