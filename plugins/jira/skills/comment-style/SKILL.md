---
description: Use whenever writing or posting a comment on a Jira issue/ticket — a status update, decision note, handoff, or "what's done / what's left" note, including via the Atlassian MCP addCommentToJiraIssue tool. Keeps comments short, essence-first, and understandable on the first read.
---

# Jira Comment Style

## When to Activate

- About to post or draft a comment on any Jira ticket (any project key).
- Writing a status update, decision, handoff, or "what's done / what's wrong / what's next" note.
- Using the Atlassian MCP `addCommentToJiraIssue` tool.

---

## Rules

1. **Short.** A few lines max. The reader gets it on the first read — no scrolling, no re-reading.
2. **Essence only.** Say what was done / what's wrong / what's next. Cut background and reasoning the reader already has.
3. **Bottom line first.** The opening sentence is the conclusion: done / blocked / one deviation / needs a decision.
4. **Lists are fine — one line per bullet.** If a bullet wraps to a second line, it's too long; trim it.
5. **Precise, not vague.** Name the exact thing (AC #, field, screen, file) instead of "some stuff" / "a few things".
6. **No filler.** Drop "just wanted to update", "as discussed", "please note", hedging, and decorative emoji.
7. **English** — tickets are English.

---

## Shape

Single point → one line:

> Done. Only deviation: KPI config sits under Settings for now; will split out when needed.

A few points → short list, one line each:

> Done — notes:
> - Nav: config lives under Settings for now (Settings still empty).
> - Dashboard read: ships with the charts ticket.
> - Tests: 64/64 green.

---

## Anti-pattern

A wall of text narrating the journey. The reader wants the result, not the process.
