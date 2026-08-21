# The thirteen axes, in Apex

`tests:architecture` §3 is the derivation: walk a fixed list of axes against the contract, and for
each one either write a case or write down why it does not apply. The list is fixed so a reviewer can
check that it was discharged. Discharge the inapplicable ones in one comment at the top of the class.

**This page replaced a break-vector catalogue with a count in it.** The old page asked for roughly
seven to ten break scenarios as a floor. Every vector it named survives below, filed under the axis it
is the Apex form of — the number is what came out, because a floor of seven becomes a ceiling and an
axis list can be audited.

## The table

| # | axis | the Apex form | what it catches | old vector it absorbs |
|---|---|---|---|---|
| 1 | cardinality | 0, 1, 2 and many records. A `[SELECT … LIMIT 1]` against no rows, a list method handed one element | code written for "some rows" that indexes `[0]`, or a `QueryException` on an empty result | — |
| 2 | boundary | a value one step either side of the allowed range, a string one character past the field length, a duplicate external Id on an upsert | a validation rule that never fires, and an unhandled `STRING_TOO_LONG` reaching the caller | boundary / overflow |
| 3 | absence | `null` body, blank required field, empty list, an Id that does not exist, a URI missing its segment | four states collapsed into one `String.isBlank` check. Distinguish "empty list means delete all", which is defined behaviour, from "`null` is an error" | null / blank / empty · missing target · wrong protocol shape |
| 4 | idempotence | run the destructive operation twice — delete an already-deleted record, save the same external Id again | a second save that duplicates instead of upserting, and a second delete that throws instead of no-op | idempotency / double-op |
| 5 | order | the same records in a different order, and a trigger's batch arriving in an order you did not choose | an aggregate that silently depends on row order | — |
| 6 | dependency failure | the callout 500s or times out — `Test.setMock(HttpCalloutMock.class, …)`; the collaborator throws | an upstream failure that reaches the user as a null field | — |
| 7 | interleaving | two users saving the same record, a `FOR UPDATE` lock, an async job landing after the caller returned | `UNABLE_TO_LOCK_ROW` in production only, and a Queueable whose result nobody waited for | — |
| 8 | time and locale | a period boundary, the running user's timezone, `Date.today()` at midnight, a translated Custom Label | a date that shifts a day for half the org | — |
| 9 | input immutability | pass a `List<SObject>` and assert the caller's records came back unchanged | a method that mutates its argument and a trigger that then re-fires | — |
| 10 | invariant | **unreachable — Apex has no property-based generator.** Discharge it with the one-line note | — | — |
| 11 | error shape | the unregistered type or enum value, malformed JSON, valid JSON of the wrong shape. Assert the *specific* exception, and that its message names the offending value | a bare `Exception` catch that swallows the real cause, and half-parsed data that got persisted anyway | unknown key · malformed input |
| 12 | scale | 200 records through anything that queries or writes in a loop | SOQL-in-a-loop, and a partial commit that reports success | bulk / governor limits |
| 13 | permission and visibility | run as a user **without** the permission set on both a read and a write path; and user A creates a record, user B may not read or mutate it | a `WITH USER_MODE` query nobody exercised, and broken `with sharing` or owner scoping | permission denied / FLS · cross-user / sharing |

Three to six axes usually apply to one class. Axes 2, 3, 11, 12 and 13 apply to almost every Apex
class that is reachable from outside.

## Every layer, not only the innermost one

A feature is only as safe as its least-tested entry point. Axis 13 caught at the handler still needs
covering at the REST resource, and axis 11 caught at the parser still needs covering at the caller
that hands it a body. Spread the walk across the classes of a feature so each layer is probed where
it matters — permission and malformed-body at the resource, unknown type and sharing at the handler.

## Assert a specific, safe failure

The failure a case pins is a typed exception or a defined empty result — never a swallowed error and
never corrupted data. **Never catch bare `Exception`**: it passes whether the code threw what you
meant or a `NullPointerException` from a line you did not think about.

```apex
// Exercise + Verify
Test.startTest();
try {
    WidgetConfigHandlerFactory.getHandler(UNREGISTERED_TYPE);
    Assert.fail('getHandler should reject a type nothing is registered for');
} catch (WidgetConfigHandlerFactory.WidgetConfigException e) {
    Assert.isTrue(e.getMessage().contains(UNREGISTERED_TYPE), 'the message names the rejected type');
}
Test.stopTest();
```

The `Assert.fail` is what makes a *missing* throw fail the case. Without it a class that quietly
stopped throwing goes green.

**One case per situation, named for it** — that is §2 clauses 1 and 2, and it is not restated here.
`saveConfig_throwsWhenUserLacksObjectAccess`, `getConfig_uriWithoutTypeSegmentThrows`,
`saveConfig_rejectsMalformedJson`, `getConfig_otherUsersConfigIsNotVisible`.
