# FLS / user-mode and REST resource testing

## FLS / user mode (`WITH USER_MODE`, `as user`)

Code that uses `WITH USER_MODE` queries or `... as user` DML enforces the running user's FLS and object permissions. A test running as the system context won't exercise that enforcement. So:

- Create a **test user** with a minimal profile and assign the **permission set** the feature ships with (e.g. `Feature_Config_Edit`). Do this in the factory / `@TestSetup`. A minimal profile + the shipped permission set is enough — do NOT reach for a System Administrator user to dodge FLS.
- **Universally-required fields have no separate FLS.** Salesforce always grants access to a required custom field and you cannot assign `fieldPermissions` to it — so a permission set covering such fields legitimately has only `objectPermissions`. If every field the code touches is required, object-level access is all the running user needs for `WITH USER_MODE` / `as user`. Only worry about field FLS for *optional* fields.
- Run the exercised code inside `System.runAs(testUser) { ... }`.
- Add at least one **negative permission test**: run as a user WITHOUT the permission set and assert the expected `System.QueryException` / `DmlException` / `NoAccessException` is thrown.

```apex
User u = WidgetConfigTestDataFactory.createUserWithPermSet('Feature_Config_Edit');
System.runAs(u) {
    Test.startTest();
    new WidgetCardConfigHandler().saveConfig(payloadJson);
    Test.stopTest();
}
```

Create users with a unique username (append a UUID/timestamp) to avoid `DUPLICATE_USERNAME` across parallel test runs — and never hardcode the username.

---

## REST resource tests (`@RestResource`)

Mock the REST context by hand, then call the method directly and assert on `RestContext.response`.

```apex
// Setup
RestRequest req = new RestRequest();
RestResponse res = new RestResponse();
req.requestURI = '/services/apexrest/Pkg/ui/config/Cards'; // namespaced path when the org has a namespace
req.httpMethod = 'GET';
RestContext.request = req;
RestContext.response = res;

// Exercise
Test.startTest();
WidgetConfigResource.getConfig();
Test.stopTest();

// Verify
Assert.areEqual(200, RestContext.response.statusCode, 'GET should succeed');
Object body = JSON.deserializeUntyped(RestContext.response.responseBody.toString());
Assert.isNotNull(body, 'response body should be JSON');
```

For POST/PATCH set `req.requestBody = Blob.valueOf(jsonString)`. Cover URI-parsing branches explicitly: type-only URI (`/config/Cards`) vs type+itemId (`/config/Cards/<id>`), and the namespace-prefixed variant.
