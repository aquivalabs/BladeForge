---
description: Security rules for reviewing changes or writing security-sensitive code — secret/API-key leakage, BFF route auth, client token boundary, SOQL injection, XSS in Aura/LWC output, WITH USER_MODE / FLS enforcement, and the Salesforce Security Review bar for Apex. Activate when auditing a diff for security (hardcoded secrets, injection, missing auth, token leaks, unescaped output) or writing a BFF route, Apex REST resource, or any auth/SOQL-touching code.
---

# Security Review Rules

## When to Activate

- Reviewing a diff for security (e.g. a pre-push Security reviewer agent).
- Writing/editing BFF routes, Apex REST, auth flows, SOQL/SOSL, or anything touching
  tokens, secrets, or user-supplied input.

## Mindset

**Be the most paranoid reviewer on the team.** Assume an attacker is actively trying
to breach the app. For every change ask: *how would I abuse this?* See threats
everywhere, verify more than once, and prefer a false alarm (Advisory) over a missed
hole. Default suspicion: guilty until proven safe.

---

## 1. Secret leakage

Scan the diff for hardcoded secrets (regex candidates, then triage):

- Salesforce access tokens (`00D...!...`), `Bearer <token>`, session ids
- `private_key`, `client_secret`, `api[_-]?key`, passwords
- AWS keys (`AKIA...`), long base64/hex blobs that look like keys

Then **triage**: is the candidate a real secret, or a fake/test/example/placeholder?
Real secret in code or committed config → finding. Secrets belong in env / secret
store, never in the repo.

## 2. Client token boundary

- The client must **never** receive raw Salesforce tokens — all SF traffic goes
  through the BFF proxy.
- Tokens / secrets must not be logged (no `console.log(token)`, no token in error
  responses sent to the client).

## 3. BFF route auth

- Every new server route must enforce authentication / session verification (the
  shared auth middleware), unless it is deliberately public.
- A new route with no auth guard is a finding until proven intentionally public.

## 4. Injection & input handling

- SOQL/SOSL: never concatenate user input into a query — use bind variables; if a
  dynamic query is unavoidable, `String.escapeSingleQuotes()`.
- Validate / sanitize any user-supplied input that reaches a query, file path, or
  shell. Watch for SSRF in server-side calls built from user input.
- Reflected/stored user data rendered in the UI must be escaped (XSS).

## 5. Apex — must pass the Salesforce Security Review

Review every Apex change against the **AppExchange Security Review** bar, because a
managed package must pass it:

- **CRUD/FLS enforced:** custom Apex REST and DML use `WITH USER_MODE` or
  `Security.stripInaccessible()`; reads/writes check object + field accessibility.
  No SOQL/DML that silently ignores the user's permissions.
- **Sharing:** classes that run in user context declare `with sharing` (or
  `inherited sharing` with intent); no unintended `without sharing` widening access.
- **No injection:** bind variables / `escapeSingleQuotes` as in §4.
- **No hardcoded secrets / endpoints** (§1); named credentials for callouts.
- **No data exposure** beyond the running user's permissions; respect record-level
  access.

A change that would fail Salesforce Security Review is a finding — treat it as if the
package submission is on the line.

---

## Checklist

- [ ] No hardcoded secrets/tokens (triaged, real ones flagged)
- [ ] Client never sees raw SF tokens; nothing secret logged
- [ ] New server routes enforce auth/session
- [ ] No SOQL/SOSL/shell/path injection from user input; output escaped
- [ ] Apex enforces CRUD/FLS (`WITH USER_MODE` / `stripInaccessible`) and `with sharing`
- [ ] Asked "how would an attacker abuse this?" for each change — twice
