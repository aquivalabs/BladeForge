# Data factories — search first, then create

Test data creation belongs in a reusable factory, not copy-pasted into each test.

**Order of operations:**
1. **Search for an existing factory** before writing data-setup code. Look for `TestDataFactory`, `SharedTestDataFactory`, `*TestData*`, `*Factory*` classes in the repo. (In SharedPkg the canonical one is `SharedTestDataFactory` — a singleton accessed via `SharedTestDataFactory.getInstance(true)` in `@TestSetup`, `getInstance()` inside tests, with fluent `create*()` builders. Reuse it for core objects.)
2. **One factory CLASS per SObject, written as a fluent builder — every factory has the SAME shape.** Each object a test touches gets its OWN factory class named `<Object>Factory` (e.g. `WidgetConfigFactory` for `Widget_Config__c`, `WidgetCardFactory` for `Widget_Card__c`, `UserTestFactory` for `User`). Do NOT lump several objects into one factory class. Because they all share one shape, they read alike and chain naturally:
   - **Constructor** seeds all **required** fields with sensible defaults, so a bare `new <Object>Factory().build()` is already valid.
   - A **`with<FieldName>(value)`** setter for each field a test may vary — it mutates the in-progress record and `return this;` so calls chain.
   - **`build()`** → returns the **in-memory** record (no DML). **`build(Boolean doInsert)`** inserts first when `true`.
   - **`insertRecord()`** → separate terminal that inserts the built record and returns it (Apex reserves `insert`, so the method can't be named `insert`).
   - Optional **bulk** helper (e.g. `static List<SObject> buildAndInsert(Integer count, ...)`) for governor-limit tests.
   - Never hardcode Ids. Extend with more `with*`/helpers over time, but one object's creation logic stays in that one factory.

   Usage reads like a sentence:
   ```apex
   Widget_Card__c card = new WidgetCardFactory()
       .withConfig(cfg.Id)
       .withWidgetType('beta')
       .withSortOrder(1)
       .build(true);   // build() = in-memory; build(true) or insertRecord() = persist
   ```
3. **Where the factory lives — a dedicated factory folder.** Keep test-data factories together, not scattered among production classes:
   - Look for an existing dedicated factory folder (e.g. `.../classes/factories/`).
   - **If none exists, create one** and put new factories there. Every factory we create goes into that folder.
   - **If factories already exist elsewhere in the repo, propose consolidating them** into that folder (ask before relocating shared/managed ones like `SharedTestDataFactory` — don't silently move code others depend on).
   - In SFDX source format, Apex classes may live in subdirectories under `classes/`; they deploy the same. Keep one factory per cohesive area, not one giant method per test.

**Factory shape — one fluent-builder class per object:**
```apex
// File: classes/factories/WidgetCardFactory.cls
@IsTest
public class WidgetCardFactory {
    private final Widget_Card__c record;

    public WidgetCardFactory() {
        // Constructor seeds all REQUIRED fields with valid defaults.
        record = new Widget_Card__c(
            Item_Id__c     = 'test-' + sequence(),  // unique external Id; never hardcoded
            Widget_Type__c   = 'alpha',
            Timeframe__c  = 'CURRENT',
            Sort_Order__c = 0
        );
    }

    // One with<Field>() per varied field — each returns `this` to chain.
    public WidgetCardFactory withConfig(Id configId)   { record.Config__c     = configId; return this; }
    public WidgetCardFactory withWidgetId(String v)       { record.Item_Id__c     = v;        return this; }
    public WidgetCardFactory withWidgetType(String v)     { record.Widget_Type__c   = v;        return this; }
    public WidgetCardFactory withTimeframe(String v)   { record.Timeframe__c  = v;        return this; }
    public WidgetCardFactory withSortOrder(Integer v)  { record.Sort_Order__c = v;        return this; }

    // Terminals: build (optionally insert via the flag), or insert separately.
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
`WidgetConfigFactory`, `UserTestFactory`, etc. follow the EXACT same shape (constructor defaults → `with*` chain → `build()` / `build(true)` / `insertRecord()`), so any factory is used the same way.

## @TestSetup — shared pre-setup data

When several test methods need the same baseline data, create it once in a `@TestSetup` method instead of rebuilding it per method. `@TestSetup` data is rolled back to its post-setup state before each test, so tests stay isolated.

```apex
@TestSetup
static void setup() {
    // Build the baseline every test starts from — via the factory.
    WidgetConfigTestDataFactory.createTestUserWithEditPerm();
}
```

Guidelines:
- Use `@TestSetup` only for data that is genuinely shared and read-only-ish across methods. Data a single test mutates in a method-specific way is better created in that method's `// Setup`.
- `@TestSetup` runs as the test-context user. Create users/permission-set assignments here so methods can `System.runAs` them.
- Re-query records inside the test method (don't rely on Ids captured at setup time across the rollback boundary — re-SELECT them).
