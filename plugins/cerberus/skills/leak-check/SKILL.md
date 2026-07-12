---
description: Use before committing a NEW or EDITED skill, its references, or its eval fixtures to this PUBLIC marketplace — review the change for anything that points to a real work codebase (real class/object/namespace/org/ticket names, secrets, real people/emails/paths, an employer or client brand, or the aggregate "this is one specific company's product" flavor) and rewrite it to a neutral fictional demo before it ships. Also runs when the CERBERUS hook flags a skill/eval edit.
---

# cerberus:leak-check — nothing that points to real work leaves the gate

This is a PUBLIC marketplace; every example is read by strangers. A real identifier
lifted from a work codebase is a **leak**, not a better example. There is no denylist
here on purpose — a list of the real names to catch would itself be the leak. This is
an **agent judgment pass**: you (the model) already know what real, copied-from-work
code looks like versus an invented demo. Read the change against the checklist and
rewrite every hit.

## What to hunt (ranked by how much it burns)

1. **Secrets** — API keys/tokens, private keys, any `key = "<real value>"`. Remove AND
   rotate it (a committed secret is compromised even after deletion).
2. **Identity** — real names, emails, a work email domain, org/scratch-org aliases,
   local paths (`/Users/<name>/…`), or a commit author that is a work account.
3. **Brand** — the employer's or a client's name, in any spelling or variant.
4. **Namespace & schema** — a real managed-package namespace prefix, or real custom
   object/field API names, even **lightly renamed** (a real name with one token swapped
   still reads as real).
5. **Real identifiers** — actual class / component / hook / file / route / permission-set
   names. **Recurrence is the tell:** the same invented-looking name appearing across 3+
   independent files usually means it was copied from a real codebase, not invented.
6. **Architecture shape** — a specific real system described concretely: a backend/proxy
   layer, an embedding bridge, a repo-pair, a deployment/org topology, a multi-package split.
7. **Domain flavor** — the *aggregate*. Individually-generic words that, clustered, name
   one specific product. No single word leaks; the cluster does. This is the one a regex
   can never catch — it needs your read of the whole.
8. **Tickets** — real issue keys (`ABC-1234`).

## The rule

Public examples must be **fictional and generic** — invent ONE neutral demo product and
reuse it across skills. Never paste a real name from a work codebase.

## How to fix

Rewrite each hit to the house demo vocabulary, kept consistent everywhere:
`Widget_Config__c`, `Widget_Card__c`, `Order__c`, `Pkg__` namespace, `myOrg`,
`RangeHandler` / `RangeResolver`, `/api/items`, `TICK-000`, `<sf-repo>` / `<ui-repo>`.
For flavor (#7) don't whack single words — **re-theme the example off the real domain**
onto a neutral one, and **vary** recurring identifiers so no name repeats verbatim.

## When to escalate

Unsure, or before a public release / the first push of a mirror repo → run a deeper
**multi-agent audit**: several read-only passes with distinct lenses (identifiers,
architecture, domain, history + secrets) plus an adversarial "recognize your own code"
pass — that catches the aggregate a single pass misses. Then scrub the working tree AND
git history (`git filter-repo`) and force-push.
