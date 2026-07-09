# Skeleton — full test class

```apex
@IsTest(SeeAllData=false)
private class UIKpiCardConfigHandlerTest {

    private static final String KPI_TYPE_REVENUE = 'revenue';
    private static final String TIMEFRAME_PERIOD = 'CURRENT_PERIOD';

    @TestSetup
    static void setup() {
        UIConfigTestDataFactory.createUserWithPermSet('UI_KpiCardConfig_Edit');
    }

    @IsTest
    static void getConfig_returnsDefaultsWhenNoSavedCards() {
        // Setup
        User u = [SELECT Id FROM User WHERE Alias = 'uicfg01' LIMIT 1];
        // Exercise
        Object result;
        System.runAs(u) {
            Test.startTest();
            result = new UIKpiCardConfigHandler().getConfig();
            Test.stopTest();
        }
        // Verify
        List<Object> cards = (List<Object>) result;
        Assert.areEqual(4, cards.size(), 'should fall back to the 4 default CMDT cards');
    }
}
```
