# FLS, user mode, and REST resources

Both halves of this page are the Apex form of an axis from `tests:architecture` §3: user mode is
axis 13, and a REST resource's URI parsing is axes 3 and 11.

## FLS and user mode (`WITH USER_MODE`, `as user`)

Code using `WITH USER_MODE` queries or `… as user` DML enforces the running user's object and field
permissions. **A test running in the system context does not exercise that enforcement at all** — it
passes whether the permission model is right or missing.

- **A minimal-profile user with the permission set the feature ships.** Never a System Administrator:
  an admin user makes the case green and proves nothing. Build the user in the factory or
  `@TestSetup`.
- **Run the exercise inside `System.runAs(user)`.**
- **A negative-permission case is mandatory** — the same call as a user with no permission set,
  asserting the specific `QueryException`, `DmlException` or `NoAccessException`. One case on a read
  path and one on a write path; they fail differently.
- **Cross-user visibility is the other half of axis 13.** User A creates a record; assert user B can
  neither read nor mutate it. This is what catches broken `with sharing` and broken owner scoping,
  and no happy-path case reaches it.

```apex
User editor = new UserFactory().withPermissionSet('Widget_Config_Edit').insertRecord();
System.runAs(editor) {
    // Exercise
    Test.startTest();
    new WidgetCardConfigHandler().saveConfig(payloadJson);
    Test.stopTest();
}
```

**Universally-required fields have no separate FLS.** Salesforce always grants access to a required
custom field and refuses a `fieldPermissions` entry for it, so a permission set covering only such
fields legitimately carries `objectPermissions` and nothing else. If every field the code touches is
required, object-level access is all the running user needs. Field FLS is a question about *optional*
fields only — do not go looking for a missing `fieldPermissions` row that cannot exist.

Every `User` a test creates gets a derived username. A literal collides on `DUPLICATE_USERNAME` as
soon as two runs overlap.

---

## REST resources (`@RestResource`)

There is no request to send. Build the context by hand, call the method directly, and assert on
`RestContext.response`.

```apex
// Setup
RestRequest request = new RestRequest();
RestResponse response = new RestResponse();
request.requestURI = '/services/apexrest/Pkg/widget/config/Cards';  // namespaced where the org has a namespace
request.httpMethod = 'GET';
RestContext.request = request;
RestContext.response = response;

// Exercise
Test.startTest();
WidgetConfigResource.getConfig();
Test.stopTest();

// Verify
Assert.areEqual(HTTP_OK, RestContext.response.statusCode, 'a readable config returns 200');
Object body = JSON.deserializeUntyped(RestContext.response.responseBody.toString());
Assert.isNotNull(body, 'the response carries a JSON body');
```

For `POST` and `PATCH`, set `request.requestBody = Blob.valueOf(payloadJson)`.

**Cover each URI-parsing branch as its own case.** Type-only (`/config/Cards`), type plus item
(`/config/Cards/<id>`), the segment missing altogether, and a trailing segment nothing expects. The
parser is the one place in an Apex feature where a caller controls the shape of the input directly, so
axis 3 and axis 11 both land here.

`HTTP_OK` above is a named constant, per §2 clause 12.
