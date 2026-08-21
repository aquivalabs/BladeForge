---
description: "Use when writing, fixing, or extending an Apex test — a test class for a new or changed Apex class, a negative or bulk path, a `@TestSetup` factory, swapping `System.assertEquals` for `Assert.*`, removing a hardcoded record Id, mocking a `RestRequest` for a `@RestResource`, covering a `WITH USER_MODE` or `System.runAs` path, or updating a test after changing the class under test. Also whenever you create or edit any Apex `.cls`, and when reviewing an Apex test somebody else wrote. Apex only — a test in any other runtime needs `tests:architecture` and not this page."
---

# Apex tests — the Apex delta

**Load `tests:architecture` first, with the Skill tool.** That is the standard. This page carries
only what Apex does differently, so read on its own it is not a test standard and will leave you
writing a test that meets none of the shared clauses.

**Legacy id: `salesforce:apex_test-authoring`.** This page was that skill. Frozen specs and plans in
other repositories cite the old id and are never edited, so the name is kept here to stay greppable.

## Contract

**What this page decides:** the Apex form of every shared rule whose form the platform changes, and
the rules that exist only because Apex runs its tests inside a database with governor limits and a
running user.

**What it does not decide:** anything the shared standard already states. Where a rule appears in
both, the shared wording governs and this page adds only the platform consequence.

**Acceptance criteria** are at the bottom, and every one of them is Apex-only.

**How citations read.** A `§` or a bare clause number is `tests:architecture`. A page called *the
shared* something is one of that skill's `references/`; an unqualified `references/…` is this page's
own.

---

## What is not on this page

Each of these was stated here before the shared standard existed. It is cited, not dropped — the rule
still binds, in the wording `tests:architecture` gives it.

| the rule | where it lives now |
|---|---|
| one behaviour per test method, and no kitchen-sink test | §2 clauses 1 and 2 · §5 rows 1 and 2 |
| `// Setup` / `// Exercise` / `// Verify` in every case | §2 clause 13 · §5 row 13 |
| test data comes from a factory — one per entity, constructor seeds valid defaults, a method per varied field, ids from a counter, no assertions inside | §4 · §5 row 17 · the shared `factories.md` |
| insert only the fields the case's outcome depends on | the shared `factories.md` criterion 4 |
| test values are named constants | §2 clause 12 — stricter there than it was here: the name also carries a comment saying WHY that value |
| enumerate the situations, not the function's branches — and the positive / negative / bulk / boundary checklist this page used to print | §3 · the shared `case-space.md`, the thirteen axes |
| the adversarial suite counted in break vectors, with seven to ten as a floor | §3's axis walk replaces the count. See below |
| a failure message that locates the defect | §2 clause 11 · the shared `failure-envelope.md` |
| never weaken an assertion to reach green; no commented-out and no trivially-true assertion | §2 clause 3 · §5 row 3, gate pattern `test-limp-assertion` |
| a flaky test is handled the same day, and no retry count anywhere | the flake policy |

**The count is gone and no vector is.** §2 sanctions a runtime page counting break vectors, and this
page does not take that option: a fixed axis list is auditable and a floor of seven is not. Every
vector the old catalogue named is a row of `references/axes-in-apex.md`, filed under the axis it is
the Apex form of. Nothing was cut in the conversion — the list is longer and the number is gone.

---

## The three shared clauses whose Apex form nobody can guess

§2 states the clause and leaves the form to the runtime. These are the ones it explicitly defers.

| shared clause | the Apex form |
|---|---|
| 4–6 · substitute at a seam you do not own, prefer a fake, install it through the architecture's own seam | Callouts have a platform seam: `Test.setMock(HttpCalloutMock.class, new FakeThing())`, or `WebServiceMock` for SOAP. Everything else needs the class to offer one — an interface passed to the constructor, or a `@TestVisible` static holding the collaborator. **Apex has no module substitution**, so a class with no injection point has no seam at all, and the fix is in the class rather than in the test. `Test.isRunningTest()` in production code is not a seam; it is the branch that makes the test lie. |
| 7 · assert the stable key, never user-visible copy | Copy lives in a Custom Label. Assert against `System.Label.Widget_Saved`, never against a string literal holding the English text — the literal breaks on translation while the label does not. |
| 9 · deterministic | `@IsTest(SeeAllData=false)`, always, and never `true`. Org data is the non-determinism Apex offers, and `SeeAllData=true` is a test that passes on the developer's sandbox. `System.now()` and `Date.today()` are the other two — pin what the outcome turns on. |

---

## The rules that exist only in Apex

1. **One test class per class, named `{ClassName}Test`.** No underscore. `WidgetConfigResource` →
   `WidgetConfigResourceTest`. §1's tier scheme does not apply — Apex has no environments to split,
   and `@IsTest` is the only file-level declaration there is.
2. **`Assert.*`, never `System.assert*`.** `Assert.areEqual(expected, actual, message)`,
   `Assert.isTrue`, `Assert.isFalse`, `Assert.isNull`, `Assert.isNotNull`, `Assert.fail(message)`.
   Follow this even in a repository where the surrounding tests still use `System.assertEquals`.
3. **Every assertion carries a message, and the message is where §2 clause 11 lands.** Apex has no
   `expect.extend`, so there is no matcher to hold an envelope — the message argument is the only
   place a failure can say what rule broke. Write the rule, not the values: Apex already prints the
   values.
4. **`Test.startTest()` / `Test.stopTest()` around the exercise, inside the `// Exercise` marker.**
   That is what resets governor limits to a fresh set and flushes async work, so the limits the
   assertions talk about are the ones the code under test spent.
5. **No hardcoded record Id.** Never type a `001…` or `a0X…` literal. Ids come from an inserted
   record or from `UserInfo.getUserId()`. This is the platform consequence of the shared
   `factories.md` rule 4: an Id is not merely unstable across runs, it is invalid in another org.
6. **A user created by a test gets a unique username.** Derive it — a timestamp or a UUID — or
   parallel runs collide on `DUPLICATE_USERNAME`.
7. **A trivial class still gets a test class.** This is the one place Apex removes a shared
   exemption rather than adding a rule: §5 row 19 says not everything gets a test, and on Apex the
   platform refuses a production deployment below 75 % org-wide coverage, measured per class. An
   untested class is therefore not a local judgement about value — it is a deploy blocker for
   everything else in the org. The shared restraint still governs what you assert; it does not
   license skipping the class.

---

## Factories — the Apex delta

The rule is `tests:architecture` §4 and its `factories.md`. Three things change on the platform,
and one of them changes a shared rule.

- **The terminals exist because the test context has a database.** `build()` returns the in-memory
  record, `build(true)` inserts first, `insertRecord()` inserts and returns. Apex reserves `insert`,
  which is why the third one is not called that.
- **`build()` returns the record itself, not a copy — and that is the opposite of shared rule 5.**
  A copy would hand back a record with no Id after `build(true)` inserted the original, which is the
  whole reason a caller asked. The shared clause the copy was protecting — clause 8, no state shared
  between cases — is met here by scope instead: one factory instance builds one record, and a second
  record means a second `new …Factory()`.
- **There is no omission form**, and the shared `factories.md` says why: Apex never receives a
  record with a key missing, so `without()` and `hiddenByFls()` have nothing to describe. A field
  this user may not read raises an exception in Apex rather than arriving absent.

Folder, `@IsTest` on the factory itself, `@TestSetup` and the re-query the rollback forces
→ `references/factories.md`.

---

## FLS and user mode

Code using `WITH USER_MODE` or `… as user` enforces the running user's permissions, and a test in the
system context does not exercise that at all. Create a minimal-profile user, assign the **shipped
permission set** rather than System Administrator, run the exercise inside `System.runAs(user)`, and
add a **negative-permission case** with no permission set that asserts the `QueryException`,
`DmlException` or `NoAccessException`.

This is axis 13 in Apex form, and it is the axis a permissioned package walks into daily.

Setup patterns, the universally-required-field nuance, and cross-user sharing
→ `references/fls-and-rest.md`.

---

## REST resources

Mock `RestContext` by hand: build a `RestRequest` and `RestResponse`, set `requestURI` and
`httpMethod`, call the method directly, and assert on `RestContext.response`. Use the namespaced URI
and cover each URI-parsing branch — type-only against type-plus-item.

Full example → `references/fls-and-rest.md`.

---

## Bulk and governor limits

**Feed 200 records to anything that queries or writes inside a loop.** 200 is not a round number
chosen for effect: it is the batch size a trigger receives, so a load larger than one batch is where
a partial-commit defect and a per-batch limit reset first appear — and a SOQL-in-a-loop surfaces well
before it. Assert that every record was processed, not just that nothing threw.

Where the domain genuinely works in small fixed sets, match the domain — but still loop over a
collection rather than asserting on one record. This is axes 1 and 12 in Apex form
→ `references/axes-in-apex.md`.

---

## Deploying, and the fix loop

Deploy and run through the `salesforce-dx` MCP — `deploy_metadata`, then `run_apex_test` with
`RunSpecifiedTests` and `codeCoverage: true` — where the project has it (`salesforce:dx_mcp`, with
`salesforce:sf-deploy-test` as the CLI fallback). Those are separate plugins and this page does not
require either.

**The fix loop diverges from the shared standard, and the reason is the org.** "Which check runs
where" says the whole suite, every time; an org run costs minutes, so on each iteration re-run **only
the classes or methods that failed**. Once every previously-failing test passes in isolation, run the
whole affected set **once** as the final gate. The full run is the gate, never the per-iteration
step.

On a failure, re-run with `verbose: true` and read the real assertion and stack. §5 row 3 governs
what you may do next, and it is not "relax the assertion".

---

## The axis walk, in Apex

§3's thirteen axes are the derivation. This page's `references/axes-in-apex.md` gives each one's
Apex form, the platform defect it catches, and the `try { …; Assert.fail(…); } catch (SpecificException e) { … }`
pattern that makes a *missing* throw fail the test.

Discharge the axes that do not apply in one comment at the top of the class, exactly as §3 requires.

---

## Skeleton

A complete `@IsTest` class showing every shared clause in Apex form — the axis discharge comment,
named constants with their reason, the markers, a `System.runAs` case and a negative-permission case
→ `references/skeleton.md`.

---

## Rationalizations this page rejects

Only the ones the platform produces. The shared standard's own list covers the rest.

| thought | reality |
|---|---|
| "`System.assert` works and the repo uses it" | `Assert.*` only, and every call carries a message — it is the only place a failure can name the rule. |
| "Trivial class, skip the test" | 75 % org-wide, measured per class. An untested class blocks everyone's deploy. |
| "I'll hardcode this Id, it's just a test" | An Id literal is invalid in the next org. Derive it from an inserted record or `UserInfo`. |
| "`SeeAllData=true` is easier than building the data" | It is a test that passes on your sandbox and on no other org. |
| "The class has no injection point, so I'll branch on `Test.isRunningTest()`" | That ships a second code path to production and tests the wrong one. Add the seam to the class. |
| "One `@TestSetup` record, and I'll keep its Id in a static" | The rollback takes the Id with it. Re-SELECT inside the method. |
| "It passed on the re-run" | The flake policy, and a re-run is not evidence. |

---

## Acceptance criteria

Apex-only, and each one is checkable. Shared rules are checked by §5's table, not here. A path
placeholder `<apex-root>` is the repository's Apex source root.

1. Every `.cls` added or changed in the diff has a `{ClassName}Test` in the same change.
2. No `System.assert*` in a changed file — `grep -rn 'System\.assert' <apex-root>`.
3. No `SeeAllData=true` anywhere — `grep -rnE 'SeeAllData\s*=\s*true' <apex-root>`.
4. Every `Assert.*` call passes a message. `grep -rnE 'Assert\.(isTrue|isFalse|isNull|isNotNull)\([^,)]*\)' <apex-root>`
   finds the single-argument forms; `Assert.areEqual` with two arguments has no reliable grep
   because a nested comma defeats it, so that half is reviewed.
5. No record-Id literal — `grep -rnE "'[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?'" <apex-root>`. It reports
   any 15- or 18-character quoted token, so read the hits; it can raise a false alarm and cannot
   give a false clear.
6. Every exercise sits between `Test.startTest()` and `Test.stopTest()` — reviewed.
7. A class whose SOQL or DML runs in user mode has both a `System.runAs` case with the shipped
   permission set and a case without it that asserts the failure — reviewed.
8. A `@RestResource` class's test sets `RestContext.request` and covers each URI-parsing branch —
   reviewed.
9. Every factory in the change is one `@IsTest` class per SObject, in the factory folder, with the
   terminals this page's `references/factories.md` gives — reviewed.
10. Every `User` a test creates has a derived username, never a literal —
    `grep -rn 'Username =' <apex-root>` and read each one.
11. Baseline data shared by more than one method is built in `@TestSetup`, and no Id crosses the
    rollback boundary — no record Id held in a static, and a re-SELECT inside each method. Reviewed.
