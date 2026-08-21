# Skeleton — a full test class

Every shared clause is visible in this file: the axis discharge comment (§3), named constants with
their reason (clause 12), the markers (clause 13), one behaviour per method (clauses 1 and 2), and a
message on every assertion.

```apex
// axes 5,7,9,10 n/a: one synchronous call per case, no argument retained, no generator in Apex.
@IsTest(SeeAllData=false)
private class WidgetCardConfigHandlerTest {

    // The seeded type is the one the default set is registered under; a case that varies it is
    // asserting on the fallback rather than on the type.
    private static final String WIDGET_TYPE_SAMPLE = 'alpha';
    // Four is the size of the shipped default set. A fifth means somebody added a default without
    // updating the contract this case defends.
    private static final Integer DEFAULT_CARD_COUNT = 4;
    private static final String EDITOR_PERMISSION_SET = 'Widget_Config_Edit';

    @TestSetup
    static void setup() {
        new UserFactory().withPermissionSet(EDITOR_PERMISSION_SET).insertRecord();
    }

    @IsTest
    static void getConfig_returnsDefaultsWhenNothingSaved() {
        // Setup — re-SELECT: an Id captured at setup time does not survive the rollback.
        User editor = [SELECT Id FROM User
                       WHERE Id IN (SELECT AssigneeId FROM PermissionSetAssignment
                                    WHERE PermissionSet.Name = :EDITOR_PERMISSION_SET)
                       LIMIT 1];

        // Exercise
        List<Object> cards;
        System.runAs(editor) {
            Test.startTest();
            cards = new WidgetCardConfigHandler().getConfig();
            Test.stopTest();
        }

        // Verify
        Assert.areEqual(DEFAULT_CARD_COUNT, cards.size(), 'an empty config falls back to the shipped default set');
    }

    @IsTest
    static void getConfig_throwsWhenUserLacksObjectAccess() {
        // Setup — axis 13: the same call, by a user with no permission set.
        User outsider = new UserFactory().insertRecord();

        // Exercise + Verify
        System.runAs(outsider) {
            Test.startTest();
            try {
                new WidgetCardConfigHandler().getConfig();
                Assert.fail('getConfig should refuse a user without ' + EDITOR_PERMISSION_SET);
            } catch (System.QueryException e) {
                Assert.isTrue(e.getMessage().contains('Widget_Card__c'), 'the failure names the object it refused');
            }
            Test.stopTest();
        }
    }
}
```
