# Chapters — from material to storyboard

The film aligns understanding of ONE feature between its author and the people who have a stake in it.
It is a story the viewer follows, not a technical walkthrough and not a promo.

## Done when the viewer can say

- "Now I see why you built this."
- "Yes, that is the problem I wanted solved."
- "This part works the way I pictured it."
- "Here I expected something else — let's change it."
- "Now I know which parts of the solution can still move."

The viewer says these on their own: as a comment pinned to a moment in Claude Motion, or to the author
through the invitation at the end. The screen never asks them.

## Terms (one meaning each)

| term | means |
|---|---|
| component | a part of the feature itself |
| storyboard | the list of screens the scenes are built from (`storyboard.json`) |
| running example | one request, understandable to any viewer, carried through the whole film |
| Director | the one agent that writes the storyboard and the scenes |
| Braintrust | the read-only reviewers (`braintrust.md`) |

## 1. Material

Take everything there is: spec, plan, code, ticket, handoff, commit history. Every fact that reaches the
screen has a source.

- **The author** owns the ticket or spec. A chapter question the sources do not answer goes to the author.
- **An author's answer is a source.** On screen it becomes a quiet footnote in plain words — "from an
  interview with the author" — never a raw tag.
- **Threshold.** Build only when chapters 1–4 are answered and at least one chapter-7 item has a source.
  A scene with nothing to show and no described scenario does not count as an answer.
- **The author is silent.** Put the deadline in the request itself. Past it, no film: the author gets the
  list of questions, and the film is built once they are answered.
- **The product cannot be run.** Take the real look from the project's Storybook: serve the built
  `storybook-static` locally, shoot the stories you need, and recreate those components in the scene from
  the shots, so numbers can count up and charts can draw. Footnote: "look taken from the project Storybook".
- **Demo or brainstorm.** When the user says the film is a demo, the Director may invent a plausible
  case, and every invented detail carries a footnote ("the situation is invented for the example").

## 2. Chapters

| # | Chapter | Question it answers | How it is shown |
|---|---|---|---|
| 0 | Title | What is this film about | 3–4 s: "FEATURE BRIEFING · <product>", the feature's name, one line of what it does |
| 1 | How it goes today | What goes wrong without the feature, on the running example | A failure scene: the example without the feature runs into a clear loss. Then one definition line with an everyday analogy |
| 2 | Problem → solution | What changes | The same situation before and after — usually folded into chapters 1 and 6 |
| 3 | Who and when | Who uses it, in which situation | Roles with their situation, one screen |
| 4 | One request, start to finish | The running example goes through the feature. Each component appears exactly once, as a step of this story | One scene, one camera ride between stations (`screen.md`). Real-looking objects, one event per step |
| 5 | How it is built | One picture of the whole feature, 3–5 main components, and one "we chose X over Y because Z" if the source has it | Often the station rail of chapter 4 already is this picture. A separate screen only if it adds something chapter 4 did not show |
| 6 | What already works | What works and what proves it | Proof in motion: a real command and its real output typed out, a number counting up, and right under it one honest line on what is not proven yet |
| 7 | What we know and what to discuss | At most three known problems, at most two topics, an invitation to write to the author | Short cards; the invitation is the last frame and holds for a few seconds |

Chapters 6 and 7 are ONE finale scene in three beats: (1) the running example with both outcomes side
by side, without and with the feature — this closes the stakes; (2) the proof; (3) problems, topics,
invitation.

### The rules that make it land

- **Stakes come first.** The film opens with the pain, not with a definition: the running example without
  the feature, taken to a clear failure — a change nobody can review, a rollback, a week of waiting.
  The end of chapter 4 returns to it in one line. A cold film is usually cold because it has no stakes,
  not because of its colour or the lack of a character.
- **Where the pain comes from.** First ask the author for one real case. In a demo the Director invents a
  plausible one and footnotes it. Never name a competitor's or a predecessor's product: the pain is shown
  on the running example, not as a comparison with a named tool.
- **The running example.** One request any viewer understands, carried from the first scene to the last.
  If it is not from a real run, the screen says "example". The author picks it, or approves the Director's
  pick.
- **Real material.** In two or three key moments the screen shows a real object, not a box: diff lines,
  a run's output, a commit line, a PR card, a piece of the spec. Drawn boxes explain; real objects convince.
- **A showcase step.** Each station of chapter 4 shows its own object the way it looks in life — a terminal,
  a form with questions, a document, a dashboard, a PR page — and has ONE small event with an outcome:
  something is caught, blocked, breaks and gets fixed. One progress counter runs through the whole story
  (budget spent, parts done, minutes since the request) and answers the stakes. A step where nothing
  happens is boring even if everything on it is correct.
- **Balance.** More answers than questions: chapter 6 comes before chapter 7 and is longer. If the source
  lists more than three problems, the screen gets the three that matter most.
- **Chapter-7 items have sources.** Topics are decisions the source or the author call open. Known problems
  are holes and risks from the source. The Director assigns nothing. Risks are shown when the source has
  them or they follow from it directly — never hunted for to look balanced.

## 3. Scale

- **One film** by default. A Claude Motion film holds at most 300 s.
- **Estimate length from the storyboard**, before any scene code: about 10 s per plain screen, 14–18 s
  per showcase step.
- **A series only when the story truly runs past 300 s.** Never split by component for structure's sake:
  five short films of one story are tiring to watch.
- **If a series is needed**, cut by the course of the story. Each film carries "Title · 2 of 4"; the last
  one holds chapters 5–7; each ends on a working card that links the next one.

## Worked example (fictional)

Acme Market, feature "Price stack": one engine that prices a cart in a fixed order — regional price
list, resident benefit, Acme Plus membership, bundles, one coupon, regional tax last. The full storyboard
is in `storyboard.md`.

- **Stakes.** Maya, an Acme Plus member living in Northshire, fills a cart of six items with a
  3-for-2 bundle and the coupon SPRING15. The cart says €84.20, checkout charges €79.10 because the coupon
  counted twice, a week later the shop bills her the missing €5.10, and Maya stops trusting the totals.
- **Analogy.** A recipe: the steps have a fixed order — you cannot frost a cake before you bake it.
- **Showcase stations.** Cart → region (the price list switches to Northshire) → resident and membership
  (the subscription is checked: active until 30 June) → bundle and coupon (the event: SPRING15 is refused on
  the bundled item, with the reason shown) → tax (Northshire rate) → receipt (every euro has a line saying
  why). Counter: "rules applied 0/6" and the running total.
- **Finale beat 1.** "Cart €84.20, checkout €79.10, billed again" against "one total everywhere, every euro
  explained".
