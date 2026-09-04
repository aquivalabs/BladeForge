# The authoring method

> Digest for the agent. The full text, with how each conclusion was reached,
> lives in the marketplace repo at `docs/skill-quality/authoring-method.md` — that copy
> is the source of truth and this one is derived from it.

The document this whole programme exists to produce. It is being written as decisions are settled, so
that nothing is re-litigated and nothing is lost. Part 1 covers the shape of a skill: what it
declares, and where each declaration lives.

Every rule here is traceable to evidence in `research/`. Where the evidence is thin or absent, this
page says so.

## The questions a skill must answer

The same set for every skill, whatever it does — a bespoke question per skill defeats the point,
because the answers stop being comparable. They fall into three separate conversations, and mixing
them into one flat list is what made an earlier draft unusable.

### Conversation 1 — why it exists

Answered once, when the skill is born, and rarely changed after. It is a filter, not paperwork: a
skill that cannot answer it should be deleted rather than improved.

```text
1a.  Name ONE live occasion where it should fire.
     Not "when writing styles" — what are you actually doing at that moment.

1b.  What comes out in that case WITHOUT it? Show it, don't describe it.

1c.  And WITH it? Show that too.
```

Two devices do the work. "ONE live occasion" blocks an answer that lists categories. "Show it, don't
describe it" blocks "the code gets better" — it demands the line, the phrase, the action.

Worked, on three skills of different species:

| | `frontend-css:rem` | `git:commit` | `meta:ockham` |
|---|---|---|---|
| **occasion** | changing a heading size in `typography.scss` | finished a feature, say "commit this" | about to create `utils2.ts` |
| **without** | `font-size: 20px` | one commit "add feature" for everything | the file gets created |
| **with** | `font-size: 1.25rem` | three commits — test, code, docs — each with its own message | no file; the function joins an existing one |

The table is already the test. Take the occasion, run it without the skill, compare against the
"without" row. Nothing extra needs inventing — which is exactly what both Anthropic's guidance and
`superpowers:writing-skills` demand as the FIRST step of authoring: run the task with no skill and
watch what happens. Their hard consequence applies too — if the "without" row shows no problem, the
skill should not exist. (research 01)

### Conversation 2 — how it is used

This is the contract. It changes whenever the skill changes.

```text
2a.  What has to be in place for it to work at all?
     List the things without which it stalls.

2b.  What exists at the end? Show it literally — a line, a file, a property of the code.

2c.  What checks that? Name a command — or, if there is no command,
     say where to look.
```

Worked, again on three species:

| | `sf-run` | `frontend-css:rem` | `git:commit` |
|---|---|---|---|
| **needs** | an Apex snippet or SOQL · an org alias · `sf` already authorised · `sf-run.sh` colocated | nothing special, an open `.scss` | changes in the working tree · a human's permission to commit |
| **produces** | the line `OK`, or `FAIL(compile): … @ line N` | no `px` left in sizes or spacing in the changed styles | several commits, each about one thing |
| **checked by** | the first word of the reply | `grep -nE ':\s*[0-9.]+px'` → empty, borders and shadows aside | `git log --oneline`, read it |

2c deliberately asks for a command FIRST. Research 05 draws the line: presence of a pattern, a schema
parse, a count, an absent forbidden action, whether a tool was called — all script-checkable. Whether
the root cause was right, whether prose is clear to a non-technical reader, whether a judgment call
under ambiguity was the RIGHT call — these need a reader. Mixing the two collapses everything into
"look at it and decide", which checks nothing. The table shows both: `rem` is machine-checkable,
"each commit is about one thing" is not.

### Conversation 3 — this one, or the neighbour

Needed only where a real competitor exists. Do not guess at the answer to 3a — measure it.

```text
3a.  Take one query your skill must fire on.
     Who else answers it? Name them.

3b.  If someone did — which of you wins, and under what condition?
     One sentence.

3c.  What work looks like yours but isn't? Name it, and say whose it is.
```

| | `sf-run` | `frontend-css:rem` | `git:commit` |
|---|---|---|---|
| **who else** | `dx_mcp`, on "run a SOQL query against the org" | `scss-modules`, on "fix this font size" | nobody |
| **who wins** | `dx_mcp` on SOQL, tests, deploy. Anonymous Apex is `sf-run`'s alone — the MCP has no tool for it | `rem` owns units; `scss-modules` owns file structure and variables | — |
| **looks like mine, isn't** | "deploy these classes" → `sf-deploy-test` | "make this button responsive" → `responsive-layout` | "explain what git rebase does" → not about committing at all |

**3a is measured, not remembered.** Pool every skill's positive eval queries, run each against all
descriptions, and see who answers. That measurement found 11 overlapping pairs out of 990 — the
author reads the list rather than recalling it. (research 07)

**3b asks for a CONDITION, not territory.** Three Salesforce skills share one territory — touching an
org — so "I own X" settles nothing there. What separates them is the condition: what the MCP cannot
do, what shape of output is wanted.

**3c writes the eval.** "Looks like mine, isn't" is exactly the negative case `trigger-eval.json`
requires. Answer the question, get the test.

For most skills 3a is "nobody", and that is a correct answer, not a dodge — 979 pairs of 990 have no
competitor at all.

## The four species of skill

A skill is not one kind of document, and the difference decides what its contract can even say.
Counts are of the 45 marketplace skills as of 2026-08-31.

| species | what it does | example | contract shape |
|---|---|---|---|
| **tool** | runs something, returns a result | `sf-run`, `fe-check`, `sf-deploy-test` | literal — arguments in, printed result out |
| **procedure** | a multi-step workflow ending in an artefact | `git:commit`, `speccy`, `diagram`, `meta:new-skill` | what it needs to start, what exists when it ends |
| **rule** | a standard applied while writing something else | `frontend-css:rem`, `error:format`, `tests:architecture` | the property the result must hold — this IS acceptance criteria |
| **map** | explains how a system is built | `data-router`, `ui_config-architecture`, `kpi-metric-engine` | none. It answers questions; it produces nothing |

The species is not a label to argue about. It is decided by one question: **what exists after the
skill was used that did not exist before?** A file or a printed result means tool or procedure. A
property of something you were writing anyway means rule. Nothing means map.

## The contract

**What it is:** what the skill needs, and what it guarantees to produce. Preconditions and
postconditions, in the Design-by-Contract sense.

**Where it lives:** at the TOP of the skill body, short. Two fields.

```markdown
## Contract

**In:** an Apex snippet (inline or a file) OR a SOQL query · an org alias, already
authorised in the `sf` CLI (defaults to `myOrg`) · `sf-run.sh` colocated here.

**Out:** Apex → `OK`, or `FAIL(compile): <problem> @ line N`, or
`FAIL: <exceptionMessage> @ <first stack frame>`.
SOQL → `<N> rows` then up to 5 records as compact JSON, `attributes` stripped.
```

**Why not extracted.** A skill loads in three stages: the `description` always, the body once the
skill fires, and `references/` only if the agent chooses to open the file — and Anthropic warns a
nested reference may be read with `head -100`, so even an opened file is not necessarily read whole.
The contract is needed before the work starts, every time. Extracting it makes it optional to read,
which destroys its function. (research 01)

**Why not in the sidecar or a shared file.** `metadata.yaml` is read by the gate and the catalogue,
never by the working agent. A shared file is not fetched mid-task. Both hide the contract from its
reader. (research 01, 06)

**Why co-location keeps it honest.** A declaration nobody re-reads rots — measured on CODEOWNERS,
where the declared owner drifts from the actual reviewers and "maintenance cost falls on the person
with the least information". Backstage survives the same pressure because its ownership metadata sits
in the same repo and lands in the same PR as the code. A contract at the top of the body is the
Backstage arrangement. (research 06)

**The one legitimate extraction:** a long worked EXAMPLE of a data format goes to `references/`; the
contract stays a short line in the body. Extract the illustration, never the obligation.

**For a rule-species skill** the contract collapses into the property the result must hold — which is
the same thing as its acceptance criteria, written once rather than twice. `error:format`,
`error:architecture` and `frontend-css:responsive-layout` already do this.

**A map-species skill has no contract.** It produces nothing. Do not invent one; an empty ritual is
worse than an honest absence.

## The boundary — a different thing, deliberately not called a contract

Calling both "the contract" cost this programme five exchanges of confusion. They are separate.

| | contract | boundary |
|---|---|---|
| says | what I need, what I produce | who wins when a neighbouring skill also applies |
| reader | the agent, starting work | the model choosing a skill; the author editing a neighbour |
| lives in | top of the body | the `description` |
| needed by | every tool, procedure and rule | only skills with a real competitor |

**Where it lives and why:** the `description` is the only field read BEFORE the skill is chosen. A
boundary in the body arrives one step too late — after the choice it was meant to inform.
Research 02 found the practice already in the wild: of 20 published skills, 10 state a boundary and
almost all state it in the description. One marketplace does it 5/5 on a fixed template:
`Use when X. Do NOT use for Y (use Z instead).`

**State precedence, not territory.** Where two skills genuinely share territory — three Salesforce
skills all touching an org — declaring "I own X" is useless because nobody owns it alone. The useful
form is the legal one: *notwithstanding any other provision, in THIS case I control*. Say who yields
to whom, and under what condition.

```text
sf-run: Anonymous Apex is this skill's alone — the dx MCP has no tool for it.
        For SOQL, tests, deploy or retrieve, dx_mcp comes first.
```

**Only where a competitor exists.** Measured across all 387 positive eval queries, 11 skill pairs out
of 990 show real trigger overlap. A boundary sentence on the other 979 pairs is noise.

**The evidence, honestly.** Perspective-Based Reading (Basili 1996) found distinct perspectives
produce little overlap and about 35 % better detection. The replication found two of three
perspectives collapsing into each other on one document. The benefit is conditional on the
perspectives being genuinely different, not on their having different names — so a boundary is worth
writing only when it is then CHECKED. (research 06)

## The three places, and what each holds

This took several wrong turns before settling. The confusion was always the same one: treating
"what is expected" and "how it gets checked" as one thing. They are not, and they do not live together.

| where | what it holds | who reads it |
|---|---|---|
| `## Contract`, top of the body | WHAT is promised — In and Out | the agent, starting work |
| `## Before you finish`, bottom of the body | HOW to check — steps: run this, look at that | the agent, finishing work |
| `evals/acceptance.json` | the LIST of expectations about the result | the grader, and the gate |

The body is a procedure throughout, the closing section included. It says take this, run that, and
what counts as clean:

```markdown
## Before you finish

1. Run `grep -rn ':\s*[0-9.]+px' <the files you changed>`
2. Empty? Done. Not empty — replace each hit with rem and return to step 1.
```

The list of expectations is NOT repeated there. It lives once, in its own file:

```json
[
  "no px remains in sizes or spacing in the changed styles",
  "every size is expressed in rem against a 16px base"
]
```

**Why its own file rather than a field inside the trigger eval.** They answer different questions, and
research 05 is explicit that the two must be measured apart: `trigger-eval.json` answers *did the skill
fire*, acceptance answers *did the result come out right*. A skill can fire reliably and change
nothing — and with one merged file, that looks green. A separate file also reads on its own: its name
says what it is, and a person opening it needs no explanation.

## The `evals/` directory

Three files, three questions, one per file.

```text
evals/
  trigger-eval.json    did it fire?          queries, positive and negative
  acceptance.json      did it work?          expectations about the result
  result.json          what did we measure?  the recorded run
```

`result.json` is what keeps a measurement from evaporating. Runs used to go into `*-workspace/`
directories that `.gitignore` excludes as scratch, so nothing survived to compare against — three
skills of 45 carry a result today. Beside the skill, it survives, and the gate can see whether the
queryset has changed since it was taken.

## Before you finish

Expected:
1. No `px` left in sizes or spacing in the changed styles.
2. Every size expressed in rem against a 16px base.

Check each line. Not clean? Fix it and check again.
You are done only when every line holds.
```

The list is the content; the closing three lines are the mechanism. A list at the end of a file with no
instruction to act on it is what agents skip past.
Research 02 found 14 of 20 published skills carry verification, and in the strongest ones it is a
step rather than a section. Research 04 supplies the only measured number in the entire survey:
OpenAI reports that "Only terminate your turn when you are sure that the problem is solved" lifted
their internal SWE-bench Verified by roughly 20 %.

**The loop checks the contract.** This is why the contract is load-bearing: a loop with no declared
output has nothing to compare against and degenerates into invented busywork.

**Write each line so it can be settled.** From research 05: decompose a fuzzy judgment into atomic
claims first, then decide which are script-checkable and which need a judge.

| vague | checkable |
|---|---|
| "follows the style guide" | `grep` the diff for the specific enforced rules → violation count 0 |
| "uses the right error format" | parse returned errors: has `code`, has `message`, matches the taxonomy |
| "the output is well organised" | required headers present; the decision stated before the detail |

Script-checkable: presence of a keyword, section or pattern · output parses against a schema · word
and line counts · a forbidden action absent from the transcript · whether a tool was called.
Needs a judge: was the root cause correct · is this clear to a non-technical reader · does the tone
match the house voice · was a judgment call under ambiguity the RIGHT call.

## What the `description` may and may not say

Two sources appear to contradict each other here, and a future author will otherwise "fix" one of them
back. They do not contradict — they speak about different levels.

Anthropic's checklist asks a description to carry "both what the Skill does and when to use it".
`superpowers:writing-skills` says never summarise the skill's process or workflow, and cites a measured
failure: a description reading *"dispatches subagent per task with code review between tasks"* caused an
agent to run ONE review and never open the body, where the flowchart showed TWO. Rewritten to
*"use when executing implementation plans with independent tasks"*, the agent read the body and did both.

Look at what failed. "Dispatches subagent per task with code review between tasks" is not what the skill
IS — it is how it WORKS. A purpose is one phrase: "runs anonymous Apex against a Salesforce org". A
procedure is the failure: "resolves the token, then hits the endpoint, then formats the result".

**The line is purpose versus procedure.** A procedure in the description acts as a shortcut — the agent
concludes it already knows enough and never opens the body.

```text
ALLOWED    one phrase of purpose — what this thing is
           when it applies — the triggering conditions
           the boundary — who it yields to, and under what condition

FORBIDDEN  steps, ordering, "first… then…"
           anything that lets an agent decide the body can be skipped
```

## Section order — and the section that goes away

`## When to Activate` appears in 23 of 45 skills, and it is a duplicate of the `description`. Measured
on four of them: `frontend-css:rem`'s description names gap, padding, margin, width, height and
font-size while its section says only "a passive rule that applies whenever writing or reviewing CSS";
`dx_mcp` lists SOQL, tests, deploy, retrieve and aliases in both places.

It is structurally useless for the same reason a boundary in the body is: **the body is read after the
skill has been chosen.** By the time an agent reaches "when to activate", activation already happened.

And it is actively harmful twice over — it costs context on every firing, and it creates a second home
for one fact. The two homes drift, and `rem` has already drifted: the description is precise, the
section is vague.

**So the section is removed, and the contract takes first position.** Nothing is lost in the removal:
anything in the section that is genuinely about triggering moves into the `description`; anything else
— `hooks-registry` noting that reviewers read the registry, `i18n`'s "Do NOT" list — stays in the body
as ordinary prose.

Resulting order:

```markdown
---
description: when to use · and the boundary sentence, if a competitor exists
---

# Skill Title

## Contract          ← In / Out
…the body…
## Before you finish ← the loop
```

## Length

Both Anthropic and Cursor name 500 lines as the ceiling, and both give it as a prescription with no
measurement behind it — research 04 found no controlled study varying length at all. Cutting to hit
the number would be cargo cult.

What IS real is the mechanics: the body loads whole on every firing, so the cost is not length but how
much of it is needed EVERY time.

```text
500 lines is not a limit. It is a prompt to ask one question:
  "Is there anything in the body that is not needed on every firing?"

  Yes → move it to references/, leaving the core
  No  → the length is earned; record in one line why
```

Two skills here exceed it and both pass: `tests:architecture` (682 lines) already carries twelve
reference files and opens with a navigator table, and `speccy` (727) is a pipeline whose phases are
not separable. Neither is cut.

When something IS extracted: one level deep only, and each extracted file must stand alone — an agent
may read only its first hundred lines, so a file that continues a thought from the body will be read
as a fragment. (research 01)

## A skill that supersedes another

ESLint carries a `replacedBy` metadata field for a retired rule. It is worth naming why this
marketplace does NOT adopt one.

It has happened once: `salesforce:apex_test-authoring` became `tests:apex`. It was handled in prose,
at the top of the new skill's body — *"Legacy id: `salesforce:apex_test-authoring`. This page was that
skill."* — and that line does the whole job: `grep` finds it, and a human reading the skill sees it.

A metadata field earns its place when something reads it. Nothing would. One occurrence, already
solved, does not justify a field in 45 sidecars.

**The rule instead:** a skill that replaces another states its old id in the first lines of its body,
so a search for the old name lands on the new page.

