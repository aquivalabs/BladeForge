# Adversarial / negative testing — exhaust the failure modes

Happy-path tests tell you the code works when everything is right. They tell you nothing about what happens when a caller sends garbage, a user lacks rights, or a record is missing — which is exactly where real defects and security holes live. So **every test class must include an adversarial suite that genuinely tries to break the class under test, across as many distinct failure modes as actually apply to it.**

**Don't limit yourself to a number, and don't stop at 1–2 scenarios.** Walk the break-vector list below, ask for each "can this class fail this way?", and if yes, write a test for it. The goal is to exhaust the *distinct* ways this specific class can break — not to hit a quota. Seven near-identical variations of one idea (e.g. seven malformed strings) is worse than seven tests across seven different vectors: diversity is the whole point. Treat ~7–10 as a floor that signals "you've probably only just started"; a rich class (a handler with seven public methods, a REST resource with four verbs) warrants many more.

**One scenario = one test method.** Each adversarial test breaks the class in exactly one way and asserts exactly one safe failure — never a single test that throws five kinds of bad input. Many small, sharply-named break tests are far more useful than one big one: when it goes red you know instantly *which* abuse the code stopped handling.

For each scenario, assert the code fails *safely and specifically*: it throws the **expected** typed exception (not a bare `Exception` you forgot to scope), or returns a defined empty/`null`/zero result — never silently corrupts data or swallows the error. Prefer `try { ...; Assert.fail('why this should have thrown'); } catch (TheSpecificException e) { Assert.isTrue(e.getMessage().contains(...), ...); }` so a *missing* throw also fails the test.

**Break vectors — cover every one that applies to the class (these are categories, not a checklist to stop at):**

1. **Unknown / unsupported key** — an unregistered type, enum value, or lookup key (e.g. `getHandler('Nope')`). Assert the specific exception names the bad value.
2. **Malformed input** — invalid JSON, or valid JSON of the wrong shape (an object where a list is expected, a string where a number is). Assert it throws rather than persisting half-parsed data.
3. **Null / blank / empty input** — `null` body, empty string, empty list, blank required field. Distinguish "empty list = delete all" (defined behavior) from "null = error".
4. **Missing / not-found target** — read, update, delete, or reorder an Id that doesn't exist. Assert the defined result (`null`, `count = 0`) and that nothing else is touched.
5. **Permission denied / FLS** — run as a user WITHOUT the permission set, on BOTH a read and a write path (not just one method). Assert `QueryException` / `DmlException` / `NoAccessException`. A feature is only as safe as its least-tested entry point — cover every layer (handler, controller, REST resource), not just the innermost one.
6. **Cross-user / sharing isolation** — user A creates a record; assert user B cannot read or mutate it. Catches broken `with sharing` / OwnerId scoping that happy-path tests never reach.
7. **Boundary / overflow** — value out of allowed range, oversized string past field length, negative/huge numbers, duplicate external-Id collision. Assert the validation fires (or the upsert dedupes) rather than throwing an unhandled DML error to the user.
8. **Idempotency / double-op** — run the same destructive op twice (delete already-deleted, save same external Id twice). Assert the second call is a safe no-op / clean upsert, not a duplicate or crash.
9. **Bulk / governor limits** — feed ≥200 records to any method that does DML or queries in a loop. Assert it completes within limits and processes every record (catches SOQL-in-loop and partial-commit bugs).
10. **Wrong protocol shape (REST/Aura)** — for `@RestResource`: a URI missing the expected segment, extra trailing segments, or a method with no body. Assert the parser resolves correctly or fails cleanly.

Spread these across the test classes for a feature so each layer is probed where it matters (e.g. permission + malformed-body at the REST resource, unknown-type + sharing at the handler) — a vector caught at one layer still needs covering at the others it can reach. One break per method, named for the abuse: `saveConfig_throwsWhenUserLacksObjectAccess`, `getConfig_uriWithoutConfigSegmentResolvesNoTypeAndThrows`, `saveConfig_rejectsMalformedJson`, `getConfig_otherUsersConfigIsNotVisible`.

**Asserting an expected exception:**
```apex
// Exercise + Verify
Test.startTest();
try {
    WidgetConfigHandlerFactory.getHandler('Nope');
    Assert.fail('Expected WidgetConfigException for unknown config type');
} catch (WidgetConfigHandlerFactory.WidgetConfigException e) {
    Assert.isTrue(e.getMessage().contains('Unknown config type'), 'message names the bad type');
}
Test.stopTest();
```
