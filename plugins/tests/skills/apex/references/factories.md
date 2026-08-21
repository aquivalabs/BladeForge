# Factories, `@TestSetup`, and the rollback — the Apex delta

The factory rule is `tests:architecture` §4 and its `factories.md`: one class per entity, the
constructor seeds valid defaults, a method per varied field returning `this`, ids from a counter,
never an assertion inside. Search for an existing factory before writing any data setup, and extend
it rather than starting a second one for the same object. None of that is repeated here.

Four things the platform changes, and one Apex-only mechanism.

## 1. `@IsTest` on the factory class itself

```apex
@IsTest
public class WidgetCardFactory { … }
```

Without it the factory is production code: it counts against the org's coverage number and it ships
to production. This has no equivalent in a runtime where test files are simply not built.

## 2. The terminals, because the test context has a database

| terminal | what it does |
|---|---|
| `build()` | returns the in-memory record, no DML |
| `build(true)` | inserts first, then returns the record |
| `insertRecord()` | inserts and returns — Apex reserves `insert`, so the method cannot be named that |
| `static buildAndInsert(count, …)` | the bulk helper, for the scale axis |

## 3. `build()` returns the record itself — the opposite of shared rule 5

Shared rule 5 says `build()` hands out a copy. On Apex it must not: after `build(true)` the caller
wants the instance carrying the Id the insert assigned, and a copy has none.

The clause the copy was protecting is clause 8, no state shared between cases, and here it is met by
scope instead. **One factory instance builds one record.** A second record is a second
`new …Factory()`, never a second `build()` on the same instance.

## 4. No omission form

`without()` and `hiddenByFls()` have nothing to describe in Apex. A field the running user may not
read raises an exception rather than arriving absent, so the absence axis reaches Apex as a thrown
`QueryException` — `references/fls-and-rest.md`.

## 5. Ids and usernames

- **Never a record-Id literal.** An Id is not merely unstable between runs; it is invalid in another
  org. Derive it from an inserted record or `UserInfo.getUserId()`.
- **A unique external key per built record**, from a static counter — `'item-' + sequence()`.
- **A derived username on every `User` the factory creates.** A literal collides on
  `DUPLICATE_USERNAME` the moment two test runs overlap.

## The shape, once

```apex
// File: classes/factories/WidgetCardFactory.cls
@IsTest
public class WidgetCardFactory {
    private final Widget_Card__c record;

    // Constructor seeds every required field, so a bare build() is already valid.
    public WidgetCardFactory() {
        record = new Widget_Card__c(
            Item_Id__c   = 'item-' + sequence(),   // unique, never a literal
            Widget_Type__c = 'alpha',
            Range__c     = 'DEFAULT',
            Sort_Order__c  = 0
        );
    }

    // One method per varied field or state, each returning this.
    public WidgetCardFactory withConfig(Id configId)  { record.Widget_Config__c = configId; return this; }
    public WidgetCardFactory withWidgetType(String v) { record.Widget_Type__c = v;       return this; }
    public WidgetCardFactory withRange(String v)      { record.Range__c      = v;        return this; }
    public WidgetCardFactory withSortOrder(Integer v) { record.Sort_Order__c  = v;       return this; }

    public Widget_Card__c build() { return build(false); }
    public Widget_Card__c build(Boolean doInsert) {
        if (doInsert) { insert record; }
        return record;
    }
    public Widget_Card__c insertRecord() { insert record; return record; }

    private static Integer counter = 0;
    private static Integer sequence() { return counter++; }
}
```

At a call site:

```apex
Widget_Card__c card = new WidgetCardFactory()
    .withConfig(config.Id)
    .withWidgetType(WIDGET_TYPE_SAMPLE)
    .build(true);
```

Prefer a method that names a *state* over one that names a column, exactly as the shared page says:
`.withEditAccess()` on a user factory beats two `with…()` calls setting the permission-set rows
behind it. A field setter is still right when the field is what the case is about.

## Where a factory lives

- A dedicated folder — `classes/factories/`. Create it if the repository has none.
- In SFDX source format, Apex classes may sit in subdirectories under `classes/`; they deploy the
  same.
- If factories already exist elsewhere, **propose** consolidating them there. **A factory you do not
  own is not moved without asking** — one that ships inside a managed package, or one several teams
  import, has callers you cannot see from the diff.

## `@TestSetup` — the Apex-only mechanism

Baseline data several methods share is built **once** in a `@TestSetup` method, and the platform rolls
it back to its post-setup state before each test. That is what keeps the methods isolated without
rebuilding the world per method.

```apex
@TestSetup
static void setup() {
    new UserFactory().withPermissionSet('Widget_Config_Edit').insertRecord();
}
```

- Put in it only what is genuinely shared. Data one method mutates in its own way belongs in that
  method's `// Setup`.
- `@TestSetup` runs as the test-context user. Create users and permission-set assignments here so a
  method can `System.runAs` them.
- **Re-SELECT inside the test method.** An Id captured at setup time does not survive the rollback
  boundary, so never hold one in a static and never pass one across methods.
