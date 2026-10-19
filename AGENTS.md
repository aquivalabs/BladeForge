# AGENTS.md — contributor contract for the bladeforge marketplace

Rules for any AI agent (or human) changing this repo. Read before editing.

## What this repo is
The `bladeforge` Claude Code plugin marketplace, owned by the `aquivalabs` GitHub org and published
publicly. Each `plugins/<domain>/` holds skills (`skills/<name>/SKILL.md`), and optionally
hooks/commands/agents. It is a standalone marketplace — the single source of truth for these skills.
Install any plugin as `<plugin>@bladeforge`.

## Hard rules
- **One problem per change.** A focused edit, not a grab-bag.
- **Prove the problem first.** Don't restructure tested skill content without evidence it improves behavior.
- **English only** in all artifacts (skills, docs, commit messages). Conversation language is the author's choice.
- **New scripts are Node.** Any new script or tool is an ESM `.mjs` file on Node's built-in `node:` modules, with no npm dependencies unless the task needs one. The Python and shell scripts already in `scripts/` stay as they are; port one only as its own change.
- **No `Co-Authored-By: Claude` / Anthropic attribution** trailers in commits or PR bodies.
- **Changes land via PR — no direct pushes to `main`.** The `scout-gate` and `eval-gate` checks must
  pass on the PR. On merge, the `scout-publish` workflow PATCH-bumps the affected plugin version(s),
  regenerates `catalog.json`, and pushes the result to `main` — no manual catalog or version step.
  See [docs/publishing.md](docs/publishing.md) for how auto-publish pushes to a protected `main`
  (a write deploy key allowed to bypass the `main-protection` ruleset).
- **`README.md` is hand-maintained** — update its "Skills" section by hand when you add/rename a skill.
- **Every `plugin.json` carries `name`, `description`, `version` (semver), `keywords`, `author`.**
- **Every skill carries `metadata.yaml` and `evals/trigger-eval.json`.** `gen_catalog` fails on a skill
  with no `metadata.yaml`, and `eval-gate` demands a `trigger-eval.json` for any skill the PR touches.

## SKILL.md authoring
- `description:` = **when to use only** (triggering conditions, ideally opening "Use when…"). Do NOT summarize
  the workflow in the description — agents that read the description skip the body (tested anti-pattern).
- **No `name:` frontmatter field** — the folder name is authoritative and the callable id is `<domain>:<folder>`
  (colon form is invalid in the field anyway). Frontmatter is just `description:`.
- Keep the body short; push deep tables/examples into a `references/` subfolder (progressive disclosure).
- **Examples are fictional & generic.** Class/object/field/org/ticket/repo/component names in the body,
  references, and eval fixtures must be invented for a neutral demo product — never real identifiers from a
  work codebase. This marketplace is PUBLIC; a real name is a leak, not a better example.

## Measuring a skill — the pipeline
Every skill passes two separately measured stages. Each has its own cases, score and climb.

| stage | question | cases | what a climb may change |
|---|---|---|---|
| 1. Trigger | does it fire when it should, and stay quiet otherwise? | `evals/rubric.json` `trigger` | the `description:` line |
| 2. Quality | once it fired, does the agent do the job better than without it? | 15+ tasks from `/claude-api build-eval` | the body and `references/` |

The move onto Claude Code's `/claude-api build-eval` and `/claude-api hillclimb` is in progress. The
plan, its phases, and every finding so far are in
[docs/plans/eval-hillclimb-migration.md](docs/plans/eval-hillclimb-migration.md). How the measurement
works today — scripts, record shape, gate rules — is
[docs/mechanisms/skill-eval.md](docs/mechanisms/skill-eval.md); the procedure is the `meta:skill-eval`
skill.

Rules in force now:
- **Measure triggers with `scripts/hillclimb/trigger-runner.mjs`,** on `claude-opus-5-5`, in an
  isolated nested run: no user settings, plugins, hooks or MCP. Set `environment: "crowded"` in the
  flow's `_state.json` to install every marketplace skill beside the one under test.
- **Do not read scores saved by the deleted `score-description.py` as skill quality.** It re-emitted
  descriptions unquoted, which broke the probe's YAML for 12 skills, and it counted any `Skill` call
  as a hit. Remeasured with the new runner, the lowest saved scores came out at 94–100%.
- **Do not read `skillcraft:skillaxe` results as evidence either.** Each one rests on a single task
  run once, and that cannot tell a real effect from zero.
- **Never measure with skill-creator's `run_eval` or `run_loop`.** They register the skill as a slash
  command, which does not auto-trigger, so a good skill scores near zero.
- **`--approve-harness` is the maintainer's to run, never an agent's.** The runner refuses to start
  after its own code changes until a human approves the new version.
- **Price a run before you start it.** Measure one case, then show the cost table from
  `meta:model-routing`. A 90-run trigger pass costs about 8% of a 5-hour window isolated, and about
  10% crowded.
- **Trigger cases only grow; they are never bent.** An existing case is never edited or deleted. A
  new case is only added, it gets its train or test slot at random by seed when it is added, and it
  is retired only when its skill is. The per-skill cases saturate on `claude-opus-5-5` (94–100%), so
  new cases should be HARD ones: queries on the boundary between two skills, taken from real
  requests wherever they exist. A shared routing set across all skills, `evals/routing.json`, is
  planned as phase 2b; it does not exist yet.
- **A number without its noise is not a result.** With 6–7 test cases at 5 reps the noise is about
  ±18 points. Report the test-split score with its interval, recomputed from `results.jsonl` by
  `scripts/hillclimb/split-scores.mjs`.
