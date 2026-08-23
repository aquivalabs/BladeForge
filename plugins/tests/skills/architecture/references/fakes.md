# Fakes: building the seam, and the four ways the layer goes wrong

A **stub** returns a canned answer. A **spy** records that it was called. A **fake** is a working
in-memory implementation of a boundary — it holds state, answers reads from what it was given, and can
be asked to fail. Only the third lets a test assert what the system *holds* afterwards, which is why
clause 5 prefers it: a refactor inside the unit does not break a state assertion while the contract
stays pinned.

This page is the mechanism. It assumes you are building the layer, not using one that exists.

## The shape of a seam

A seam is a module-level setter plus a reset, and the fake is typed against the real interface:

```ts
// src/lib/gateway/index.ts — production
let gateway: Gateway = new HttpGateway();
export const getGateway = () => gateway;
export const setGateway = (next: Gateway) => { gateway = next; };
export const resetGateway = () => { gateway = new HttpGateway(); };
```

```ts
// src/test/fakes/fakeGateway.ts
export class FakeGateway implements Gateway { … }
```

**`implements` is the load-bearing word.** A fake typed as `Partial<Gateway>` or `as unknown as
Gateway` is a stub wearing a fake's name, and it drifts the moment the interface grows a method. Typed
properly, `tsc` holds it to the full surface — on one real build that caught three methods the first
draft had simply not implemented.

**A setter without a reset is a leak.** If the seam exposes `set` and no `reset`, every suite that
installs a fake leaves it installed for whatever runs next in the same worker.

## Four failures, each measured

### 1. An install helper called from inside a test leaks into every later test

```ts
it('does the thing', () => {
  installFakeGateway();   // registers its own afterEach — which never runs for THIS test
  …
});
```

An `afterEach` registered from inside a test body does **not** run for that test. So the cleanup never
fires, and the fake survives into every subsequent case in the file. Make the helper refuse:

```ts
export function installFakeGateway(): FakeGateway {
  if (expect.getState().currentTestName) {
    throw new Error(
      'installFakeGateway() must be called from a describe body, not inside a test — an afterEach ' +
      'registered here does not run for the current test, so the fake leaks into every case after it.',
    );
  }
  …
}
```

A thrown error at the wrong call site costs one minute. The leak costs an afternoon, because the
failure appears in a *different* test from the one that caused it.

### 2. A method the fake does not implement must throw, naming itself

The tempting shortcut is to answer a plausible shape for a method you have not implemented:

```ts
composite() { return { results: [] }; }   // WRONG
```

A test then passes against an empty answer the real boundary would never give, and the next reader has
no way to tell the emulated methods from the decorative ones. Throw instead:

```ts
composite(): never {
  throw new Error('FakeGateway: composite() is not emulated — add it or keep a narrower double here.');
}
```

Named in the message, so the failure reads as a gap in the fake rather than a bug in the code.

### 3. A fake that cannot fail only tests the happy path

Every fake needs failure injection, and the failure must be shaped like the real one. Where the
project has an error envelope, build the failure through the same constructor production uses:

```ts
failWith(operation: string, reason: string) {
  this.failures.set(operation, buildError(reason));
}
```

Hand-rolling `new Error('boom')` here means the test never exercises the code that reads a `code`, a
`reason`, or a `details` array — which is most of the error path. → `references/failure-envelope.md`.

### 4. The fixture is the untyped part, and nothing checks it

A fake fixes the boundary's shape. It does nothing about the DATA a test feeds through it, and that is
where the silent defect lives:

```ts
const queryMock = vi.fn();                    // returns `unknown`
queryMock.mockReturnValue({ value: 1 });      // the real type has seven required fields
```

`tsc` sees `unknown` and checks nothing. On one real suite this pattern held a fixture missing five of
seven required fields — a shape the server cannot produce — green for months, because the mapper that
would have crashed on it was itself mocked out. The fix is one annotation:

```ts
const queryMock = vi.fn<() => MetricResult>();
```

Count them before assuming the layer is done: a bare `vi.fn()` whose return value is fed to the code
under test is an unchecked fixture. On the suite above there were 256 of them.

## Substituting a module, when there is genuinely no seam

Clause 6 sanctions module substitution where the dependency exposes no seam — a third-party widget, a
browser API. The hazard there is a **rename**: `vi.mock` replaces the module wholesale, so a test keeps
passing after the real export has been renamed or deleted. Fail loudly instead:

```ts
export function standIn(moduleId: string, exportName: string, actual: unknown, stub: unknown) {
  const real = actual as Record<string, unknown>;
  if (!(exportName in real)) {
    throw new Error(
      `${moduleId} no longer exports ${exportName} — the stand-in is describing a module shape ` +
      `that does not exist.`,
    );
  }
  return { ...real, [exportName]: stub };
}
```

```ts
vi.mock('third-party/widget', async (importOriginal) =>
  standIn('third-party/widget', 'Widget', await importOriginal(), FakeWidget));
```

**A hoisting trap comes with this.** `vi.mock`'s factory is hoisted above the file's imports, so a
factory referencing an imported binding reads it before initialisation
(`Cannot access '__vi_import_N__' before initialization`). `vi.hoisted` fixes a value you construct in
the file; for a function you *import*, the working form is an async factory with the import inside it:

```ts
vi.mock('third-party/widget', async () => {
  const { createFakeWidget } = await import('@/test/fakes/fakeWidget');
  return { Widget: createFakeWidget() };
});
```

**A substitute must reproduce the real mechanism, not a convenient one.** A widget that attaches a
NATIVE listener cannot be stubbed with a React `onClick` handler: React delegates its events to the
app root, so a `stopPropagation()` inside a child runs *after* a native parent listener has already
fired. A stub using the React path inverts that — propagation stops in the test and does not in the
browser — which makes any guard against it unreachable by every case in the file, while they all pass.

## Migrating an existing file, and what does not need migrating

Order the work by what the fake can actually serve today, not by file:

1. Files using only the read path — the fake answers from what it was seeded with.
2. Files using writes — a round-trip means a case can assert what the fake *holds* instead of which
   method was called.
3. Files using a method the fake does not emulate — either the fake grows it, or the file keeps its
   narrower double **with a comment naming which method**.

**A call assertion that survives migration is not a failure to migrate.** Clause 5's own exemption is
the fire-and-forget effect, and some contracts genuinely *are* about calls: "chunks more than 25
records into two batched requests" is a claim about calls because the chunking is the contract. Assert
it and say why in a comment.

## Acceptance criteria

- Every fake declares `implements <RealInterface>`, and `tsc` passes.
- Every seam exposes a setter AND a reset.
- Every fake can be made to fail an operation, through the project's own error constructor.
- Every unemulated method throws, naming itself.
- Every install helper refuses to run from inside a test body.
- Every module substitution either goes through a rename-guard or carries a comment naming the absent
  seam.
- No double whose return value reaches the code under test is left as a bare `vi.fn()`.
