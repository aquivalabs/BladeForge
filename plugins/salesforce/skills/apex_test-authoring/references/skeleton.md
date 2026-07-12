# Skeleton — full test class

```apex
@IsTest(SeeAllData=false)
private class WidgetCardConfigHandlerTest {

    private static final String WIDGET_TYPE_SAMPLE = 'alpha';
    private static final String TIMEFRAME_PERIOD = 'CURRENT';

    @TestSetup
    static void setup() {
        WidgetConfigTestDataFactory.createUserWithPermSet('Feature_Config_Edit');
    }

    @IsTest
    static void getConfig_returnsDefaultsWhenNoSavedCards() {
        // Setup
        User u = [SELECT Id FROM User WHERE Alias = 'widgetcfg01' LIMIT 1];
        // Exercise
        Object result;
        System.runAs(u) {
            Test.startTest();
            result = new WidgetCardConfigHandler().getConfig();
            Test.stopTest();
        }
        // Verify
        List<Object> cards = (List<Object>) result;
        Assert.areEqual(4, cards.size(), 'should fall back to the default CMDT cards');
    }
}
```
