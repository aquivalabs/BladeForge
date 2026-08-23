---
description: "Use when writing, reviewing, moving, or speeding up a unit test — deciding which execution tier a test file belongs to, what a test must satisfy to be accepted, or how coverage and mutation-score gates apply. Also when a test is slow, flaky, or green while the code under it is wrong."
---

# Test Architecture

## Find it fast

| the question | where the answer is |
|---|---|
| Which tier does this file belong to? What do I name it? | §1 · `references/execution-tiers.md` |
| What must every test satisfy? | §2 — the contract's clauses |
| Which cases do I write? Am I done enumerating? | §3 · `references/case-space.md` |
| Which of these rules apply *today*, and who checks them? | §5 — one row per rule |
| What is in force, and in what order do the gaps close? | §8 |
| What blocks a push? | §9 |
| How do I build the data? | `references/factories.md` |
| How do I write an assertion that reads as a rule? | `references/readable-tests.md` |
| One rule, many inputs — table or separate cases? | `references/readable-tests.md` — named rows with `why` |
| How do I handle translated labels? | `references/copy-and-i18n.md` — assert the key; the double is per file until §8's sweep |
| How do I test a component or a hook? | `references/component-tests.md` |
| What must a failing message say? | `references/failure-envelope.md` |
| How do I substitute a dependency? | §2 clauses 4–6 — at the boundary's own seam, not by mocking the module |
| Which boundaries does this repository have? | its own `docs/test-boundaries.md` — not this skill, and not yet written → §2 |
| Where is the coverage gate set? | §6 · `references/coverage-gate.md` |
| Why is mutation testing not in pre-push? | §7 · `references/mutation-gate.md` |
| Which packages does this standard need, and why? | `references/environment.md` |
| Should this even have a test? | `references/what-not-to-test.md` |
| A test is flaky — now what? | the restraint section, below |

---

## 1. Three tiers, and the filename declares the tier

**A file either needs a DOM or it does not.** The tiers exist so that the environment, the pool
and the setup file follow that one requirement, and nothing else decides them.

**What the split buys, and what it does not.** It takes jsdom and the DOM-tier setup file off the
files that need neither, so aggregate `environment` and `setup` fall by roughly half. It buys
nothing at all on the files that do need a DOM — and those then become the entire remaining cost.
So do not read the split as having made the suite fast: the dom tier's residual is the whole of
what is left, and it needs a named owner rather than a mention. Nor is jsdom established as the
cause — a large share of that residual is module collection, which no environment story explains.
Measure both columns, before and after, on one machine minutes apart
→ `references/execution-tiers.md`.

None of that is why the tiers are drawn where they are. That is the requirement axis — does this file
need a DOM — and it stands whatever the wall clock does.

| filename | tier | environment | pool | setup file |
|---|---|---|---|---|
| `*.test.ts` | **node** | `node` | `threads` | none → `vitest.setup.node.ts` when matchers land |
| `*.dom.test.ts` | **dom** | `jsdom` | `forks` | `vitest.setup.ts` |
| `*.test.tsx` | **dom** | `jsdom` | `forks` | `vitest.setup.ts` |

The fork cap and the slow-test threshold are **root** options in Vitest, not project ones — only
`pool` moves into a project. A `poolOptions` block written inside a project is silently ignored
→ `references/execution-tiers.md`.

**The marker goes before `test`, never after.** Vitest's default include is
`**/*.{test,spec}.?(c|m)[jt]s?(x)`. A file named `foo.test.dom.ts` does not match it and
silently stops being a test. `foo.dom.test.ts` matches.

**Only the exception is marked.** `node` is the default and carries no marker. A two-sided
scheme (`.dom.` plus a marker for the default) creates a third state — a file with no marker
at all — which belongs to no project and never runs while the suite stays green. One-sided
marking has no such state.

**The rule teaches itself, and that is demonstrated rather than asserted.** A `.test.ts` that reaches
for a DOM fails with `ReferenceError: window is not defined`, and the fix is named by the error:
rename the file. Prove it on the shipped config by planting
`expect(window.location.href).toBeDefined()` in a node-tier file — exit 1, with the caret under
`window`. It has to be a bare property read: `typeof window` never throws and demonstrates nothing.

**This is also the tier's only detector, and it fires at test time rather than at commit time.**
`tsconfig.json` declares `lib: ["ES2022", "DOM", "DOM.Iterable"]` for all of `src`, so `document` and
`window` type-check cleanly in a `.test.ts`. Expect the pairing: a green `npm run typecheck` and a red
`npx vitest run` on a file someone just wrote.

**Do not call the node tier "functional".** In testing vocabulary a functional test is one
that exercises behavior through a public interface — a different axis entirely. The axis here
is a requirement: does this file need a DOM.

### The fourth category, and the two rules it is exempt from

Some test files need a live database or live cloud credentials. They are not an awkward member of the
node tier; they are a different kind of test. **Every rule of this standard still applies to them,
with two named exemptions.** What makes them a category is the gate below plus a flake policy that
has to be adapted — not a licence to skip the axis walk, the factory or the title.

- **The marker is `*.integration.test.ts`**. It ends in `.test.ts`, so the node project collects it:
  the marker carries a property the tier scheme does not, and the two do not compete. **A file that
  mixes gated and ungated cases cannot be renamed, and the reason is a boundary rather than a
  shortfall.** Where one gated `describe` sits beside a dozen pure ones, marking the file would
  misdescribe it, and a file that imports the gate's helpers without a gated block at all is not an
  integration file. Splitting a mixed file is not a rename, and it is a separate task.
- **The gate is one module — `server/db/testGate.ts`.** It hands back `describe` or `describe.skip`
  from `DATABASE_URL`, and with `REQUIRE_DB_TESTS=1` a missing database fails collection instead of
  skipping — so CI cannot skip while a contributor without a local database still can. A `describeIf`
  skip is that gate working, not a rule-20 violation.
- **Two exemptions, both named:** clause 9, because the live dependency is the point; and rule 24,
  the node tier's time budget, which a real database blows by orders of magnitude.
- **The flake policy cannot be executed against a suite that only runs where you cannot reproduce
  it.** So: a CI-only failure is reproduced by starting the gate's dependency locally, and one that
  cannot be reproduced locally at all is filed — never rerun until it passes.

Detail, measurements and the config → `references/execution-tiers.md`

---

## 2. The contract of a unit test

This section is the shared contract, and it is runtime-neutral. A runtime page states only what that
runtime does differently (§9); where a clause exists on more than one runtime it is worded the same
on purpose. The two places a runtime without test titles must diverge are named at the end of this
section.

A test that breaks a clause is not "less good" — it is reporting something other
than what its name claims. Each clause's check and its state today are one row of §5.

1. **The title states an observable outcome**, not an implementation step. If renaming a
   private function invalidates the title, the title was describing the wrong thing.
2. **One reason to fail.** A case asserting several unrelated facts reports the first and
   hides the rest.
3. **Assert the outcome, not that code ran.** `expect(spy).toHaveBeenCalled()` on its own
   asserts a property of your own mock. It is legitimate only where the call *is* the whole
   observable effect and nothing is left behind — an emitted event, a `postMessage` to a worker.
   A seam that holds state is not such a place, and clause 5 governs it.
4. **Substitute only at a boundary whose contract you do not own.** Network, clock, randomness, the
   data transport, the file system. Choosing the boundary is this clause; installing the
   substitute at that boundary's own seam is clause 6. The seam is whatever the code offers there — a
   setter, a constructor argument, a factory — and it differs per runtime. Reaching
   below the seam, at the network layer or at `global.fetch`, drags serialisation, headers and
   retries into a case that is not about them — sanctioned only where there is no seam to reach
   above, which today is `server/http/` and is an interim of §8, not a licence.
   Mocking a sibling module in the same folder buys a
   test that stays green after that module's contract changes. Every substitution names the
   boundary it crosses in a comment; one that names none is this clause unmet.
5. **Prefer a fake over a stub, and assert on state rather than on calls.** A fake is a working
   in-memory implementation of the seam; a test written against one asserts what the system
   *holds* afterwards, so a refactor inside the unit does not break it while the contract stays
   pinned. `toHaveBeenCalledWith` is legitimate only where there is no observable state to assert
   — fire-and-forget: analytics, logging, navigation, and a callback prop whose call is the whole
   effect, `onSave` or `onSelect` → `references/component-tests.md`.
   How to build one, and the four ways the layer goes wrong → `references/fakes.md`.

   Two requirements ride along with any substitute, and both were learned from a green suite that was
   testing nothing. **A double whose return value is fed to the code under test must be TYPED**
   (`vi.fn<() => Result>()`, or the framework's equivalent): a bare double returns `unknown`, so the
   type checker verifies none of the fixtures handed through it. Measured on one suite: 249 untyped
   doubles against 7 typed, and the first two annotations added found two fixtures the system could
   never produce — one missing five of seven required fields. **And a substitute must reproduce the
   real MECHANISM, not a convenient one.** A widget that attaches a native listener cannot be stood in
   for by a framework-level handler: the framework may delegate its events elsewhere, so a
   `stopPropagation` in a child runs after the native parent listener has already fired. A stub that
   uses the convenient path inverts that — and makes the production guard against it unreachable by
   every case in the file, while all of them pass.
6. **Install the substitute through the seam the architecture already has, not by mocking the
   module.** Where a dependency exposes no seam at all — a third-party widget, a browser API —
   module substitution is the sanctioned form, and the comment clause 4 requires names why no seam
   exists.

   ```ts
   // src/test/fakes/installFakeDataClient.ts — imported by the files that install a fake
   import { setDataClient, HttpDataClient } from '@/lib/data/client';

   // A fake typed `implements DataClient` — a Pick<> stub with a cast drifts the moment the
   // interface grows a method, and `tsc` cannot tell you. See `references/fakes.md`.
   export const installFakeDataClient = (): FakeDataClient => {
     const fake = new FakeDataClient();
     beforeEach(() => setDataClient(fake));
     afterEach(() => setDataClient(new HttpDataClient()));   // the helper owns its own reset
     return fake;
   };
   ```

   ```ts
   // a test file
   const client = installFakeDataClient();     // suite scope, never inside a case

   it('stores the order the caller passed', async () => {
     const saved = await saveOrder(new OrderFactory().build());

     expect(client.records).toContainEqual(saved);   // state, not a call — clause 5
   });
   ```

   **The reset lives in the helper, never in a shared setup file.** A setup file that imports the
   data-client module defeats every test file's `vi.mock` and takes files down that never opted in —
   the mechanism and the cost are in `references/execution-tiers.md`. Call the helper at
   suite scope: Vitest refuses a hook registered inside a running case.
7. **Never assert on user-visible copy — assert on its stable key, and substitute the translation
   layer once per tier, in that tier's setup file.** Copy changes without behaviour changing, and
   the translation store itself can move outside the repository; a key survives both. Do not import
   translation resources into a test either — that binds the test to where copy is stored.
   → `references/copy-and-i18n.md`
8. **No state shared between cases.** Each case builds what it needs and leaves nothing. No
   `it.concurrent`: concurrent cases inside a file share the module's state, and this clause is
   what would have to be true for them to be safe — the standard does not spend that safety on a
   speedup nobody has measured. A module-level client store is the one thing this clause cannot be
   met by building fresh, so its reset is named → `references/component-tests.md`.
9. **Deterministic.** No real timers, no real network, no real database, no dependence on
   execution order or on wall-clock time. The one exemption is the integration category of §1.
10. **Seen red once.** A test that has never failed proves nothing about the code — only that it
   can pass. Write the test first and watch it fail, or break the line deliberately and watch the
   test catch it. The full discipline is `superpowers:test-driven-development`; it is not restated
   here.
11. **A custom matcher's failure message is a JSON envelope, mirroring `google.rpc.Status`.**
   The scope is a matcher written with `expect.extend`, and nothing wider. A built-in matcher owes
   nothing: `expect(total).toBe(EXPECTED_TOTAL)` is a legitimate assertion, and rule 16 decides
   when an assertion has earned a matcher at all. Eight fields:
   `subject`, `expectation`, `actual`, `deciding`, optional `hint`, `matcher`, `reproduce` (filled
   in from Vitest's own state, never by hand), and `locator` — the module, the function when the
   rule has one, and the doc anchor. A product that already took one uniform envelope for errors
   knows it pays; a red line has the same reader problem.
   **What the envelope does not reach, say so:** the failures built-in matchers produce keep
   Vitest's own wording, `expected 90 to be 100` included. What makes those readable is clause 12 —
   Vitest prints the failing source line, so `EXPECTED_TOTAL` and its comment land in the output
   even though the message cannot carry them. → `references/failure-envelope.md`
12. **Every literal the case's outcome depends on is named, and the name carries a comment saying
   WHY that value.** `0`, `1` and `''` are exempt, and so is any identifier of an element or a
   message — a translation key, an ARIA role, a test id. Those name what the case talks to, not the
   value it turns on, and a component test is written almost entirely out of them
   → `references/component-tests.md`. The comment explains the choice, not the value —
   `// 50, half` is useless; `// exactly half: a second payment of this size closes the order with
   no remainder` is the reason the case exists. A named constant with its reason documents which
   axis the case defends before the reader reaches the assertion. **One exemption, and it is a
   rule rather than an inconsistency:** a named-row `it.each` table carries its `why` per row, so
   that row's input and expected value need no separate constants — the reason is already beside
   the value and in the generated title → `references/readable-tests.md`.
13. **`// Setup` / `// Exercise` / `// Verify` markers in every case.** They cost one line each and
   they make the shape of a case readable at a glance — and a case with no clear Exercise is usually
   asserting on its own setup. Two forms are the
   rule rather than an exception to it: **`// Exercise + Verify` is one marker where the assertion
   *is* the exercise** — `expect(() => format(record)).toThrow()` has nothing to split — and a
   named-row `it.each` whose body is a single assertion needs no markers, because the table is the
   setup and the row is the case. The table form itself is `references/readable-tests.md`.

**The seam is per runtime, and one runtime has none.** On the client, data is installed
through `setDataClient()` — a module-level singleton setter that exists for the application's own
lifecycle, not for tests. `vi.mock` of that module replaces it wholesale, so the setter and the
client factory beside it vanish unless re-listed, and the hoisted factory cannot see a variable from
the case. The server's outbound transports offer no equivalent: `server/http/requester.ts` calls
`fetch` directly, with nothing to hand an implementation to. **Clauses 5 and 6 therefore have no
reachable form on those files, and that is a defect in the code rather than a gap in this
standard.** The fakes task of §8 step 4 covers `server/http/` in its area; the injection point is
the deliverable it owes. Until it lands, stubbing the global is the
**sanctioned interim** for those files and nowhere else — §8's interim table carries the form and the
comment it owes. A developer who has no legal move stops reading a standard; an interim written down
is a decision, and the same code with no interim is a violation nobody authorised.

**The boundary catalogue is not in this skill.** Clauses 4 to 6 govern any boundary in any
repository: substitute only where you do not own the contract, prefer a fake, install it through the
seam the architecture already has. *Which* boundaries a repository has describes its current
architecture, so it is a live document of that repository, and its home is `docs/test-boundaries.md`.
Listed here it would go stale the day a seam moved. That page does not exist yet, and the order is
deliberate: a page describing a mechanism may describe only code that exists, so it lands with the
build that creates `src/test/`, registered wherever the repository lists its documentation by that
same change.

**A runtime delta carries what that runtime does differently, and nothing these rules already
say.** One exists today: `tests:apex`. Reaching it does not replace this page — it loads this one
first, because the shared rules are here.

**Two deliberate divergences, and both belong to a runtime with no test-title string.** A framework
whose only name for a case is a method name puts the situation there —
`saveOrder_deletesLinesNotInPayload` — while here the title is a sentence and the method name does
not exist, so the situation goes in the title (§4). And such a page once counted an adversarial suite
in break vectors against a floor; that count is **retired** in favour of the axis list of §3, which
is the same idea with a fixed, auditable list rather than a number. A delta that still counted would
be answering §3 with a worse instrument.

---

## 3. Cover the case space, not the function

**The suite is measured against the situations the contract can be in, never against the shape
of the code.** "This function is covered" is not a claim about correctness — a dozen inputs, two
consecutive calls and an out-of-order resolution all execute the same lines.

Derive cases by walking a fixed list of axes against the contract, and for each axis either
write a case or write down why it does not apply. A fixed list is auditable; an intuition is not.

**The axes:** 1 cardinality · 2 boundary · 3 absence · 4 idempotence · 5 order ·
6 dependency failure · 7 interleaving · 8 time and locale · 9 input immutability · 10 invariant ·
11 error shape · 12 scale · 13 permission and visibility.

The question each axis asks, the defect it catches, and a worked case for the ones that almost never
get written are in `references/case-space.md`. Three to six axes usually apply to one function.

**Discharge the list in one line, not eight.** One comment at the top of the file names the axes
that do not apply and the reason they share:

```ts
// axes 4,5,7,9 n/a: pure formatter, one sync call, no argument retained.
```

A reason per axis is required only where the reasons differ. The cheap form is the required form —
an eight-line justification block per file is the form that stops being written by Tuesday
afternoon, and §3 does not survive being skipped: without the walk it degrades to "write good
cases", which is what it exists to replace.

**Axis 13 is the one a permissioned product walks into daily.** On the client, a field the caller may
not read arrives *absent* — indistinguishable from a field nobody queried — so the contract must say
what it does with an unknown value, and the case must prove it does not print a number it never
received. Catalog, period and currency scope are axis 2 in domain form: rows from the wrong catalog
and a closed period are boundaries, not axes of their own.

**Axis 10 is unreachable until a generator is installed.** An invariant is discharged with one, and
`fast-check` is not a dependency → `references/environment.md`. Discharge it with the one-line note
until it is.

---

## 4. A test reads as an open book

**A test states the rule it defends, not the encoding of that rule.**

```ts
expect(user.roles).toContain('manager');    // encodes the rule
expect(user).toBeAllowedToDelete();         // states the rule
```

Both pass today. They part when the rule changes: the first has that rule copied into every test
that touched it. A rule spread across forty assertions cannot be changed — only broken.

Three tools, in order of preference: a **custom matcher** (`expect.extend`, reused and must fail
well), a **named assertion helper** (thin, two or three uses), a **data builder** (so the fixture
shows only what the case is about). Titles name a situation, not a value. Non-obvious literals get
names.

One config consequence: matchers live in a setup file, and setup files are per project, so a shared
matcher directory needs a node-tier setup file that does not exist yet (§8). A matcher registered
with `expect.extend` in the file that uses it needs none — that is the form available today.

**Test data comes from a factory, never from a literal.** One factory per entity. A field the case
needs *missing* comes out through the factory's omission form, not through a literal.

Tools, failure-message rules, forbidden patterns → `references/readable-tests.md`
The eight fields a failing **matcher** must carry → `references/failure-envelope.md`
Factory shape, the omission form, the lint rule → `references/factories.md`

---

## 5. The rules, their checks, and what is in force

**One row per rule. There is no second list.** Rows 1 to 13 are the clauses of §2, in order; rows
14 to 24 are the rules this standard states outside that section, each naming its home. Every rule
stated in *this file* is here with its state, its check and whether that check runs unattended — so a
rule cannot drift from its own criterion, which is what three earlier review rounds spent
themselves on.

**The rule set has two levels, and this is the upper one.** A reference page carries the criteria
particular to its tier or its mechanism, and §5 does not repeat them: `component-tests.md` carries
its own, and no row here covers `container.querySelector` or an unawaited `userEvent`. A page-local
criterion is cited with the page name — "`component-tests.md` criterion 2" — and never as a bare
"criterion N". A number in *this* table is always a rule.

**A page-local criterion carries a state the same way a row does.** Where its mechanism does not
exist, the page says so beside the criterion, names the row or the task that owns it, and §8's
interim table carries the move its author has meanwhile. The device is the same one at both levels,
and the file boundary does not end it — §8's exit condition covers those criteria too.

The column words, used precisely:

- **state** — whether the rule reaches the test you are writing today. §8 defines the values,
  and this is the column to read first.
- **check** — the command or the reviewer's question that answers the rule. A command in this
  column has been run.
- **runs unattended** — whether anything executes that check without being asked. `no` means a
  human types it. A check that exists is not a check that runs.

| # | state | rule | check | runs unattended |
|---|---|---|---|---|
| 1 | in force | the title states an observable outcome | review: a title naming a value or a private identifier | no |
| 2 | in force | one reason to fail | review: unrelated facts asserted in one case | no |
| 3 | in force | assert the outcome, not that code ran | review gate pattern `test-limp-assertion` | yes — the gate, on the diff |
| 4 | new tests only | substitute only at a boundary you do not own, and name it | review: a substitution with no boundary comment | no |
| 5 | in force → `references/fakes.md` | prefer a fake; assert on state, not on calls; type any double whose return reaches the code under test | review: `toHaveBeenCalledWith` outside the fire-and-forget list, and `grep -rn "mockReturnValue({\|mockResolvedValue({"` against a bare `vi.fn()` | no |
| 6 | in force where a seam exists (§2) | install the substitute through the architecture's own seam | `grep -rl "vi\.mock(['\"][^'\"]*data/client" --include='*.test.ts*' src` for the data seam; gate pattern `test-mocks-own-component` for a module we own | partly — the gate runs the own-module pattern; the seam grep is hand-run |
| 7 | in force for the key; the per-tier double is not in a setup file yet, so §8's interim governs where it lives | assert the key, not the copy, EXCEPT where the copy is what is under test — then opt out to the real catalogue with a stated reason, never a hand-copied map (`references/copy-and-i18n.md`); substitute the translation layer once per tier | `grep -rl "vi\.mock('react-i18next'" --include='*.test.ts*' src server shared scripts` | partly — gate pattern `test-i18n-mocked-locally` runs on the diff; this grep is hand-run |
| 8 | in force | no state shared between cases, and no `it.concurrent` | review: a case that depends on its neighbour | no |
| 9 | in force | deterministic — no real timer, network or database | review: a case that reaches a real clock, a real socket or a real database | no |
| 10 | in force by hand; mechanised by rule 22 inside the mutation gate's target module, and by hand everywhere else | seen red once | review: the PR says the line was broken and the test went red | no |
| 11 | blocked → §8 step 3; `src/test/matchers/` does not exist, and a matcher written today still owes every field (§8) | a custom matcher's message is the eight-field JSON envelope, in both branches | review: `JSON.parse` the message from each branch, and read it with the test file closed | no |
| 12 | new tests only; an existing tuple table is a filed defect, not a licence | every literal the outcome depends on is a named constant, and its comment says why; an identifier of an element or a message is exempt | review: the constant block. `grep -rn "it\.each(\[\s*\[" --include='*.test.ts*' src server shared scripts` for the table form that destroys the reason | partly — gate pattern `test-bare-tuple-each`; the constants are reviewed |
| 13 | new tests only | `// Setup` / `// Exercise` / `// Verify` in every case | review | no |
| 14 | **in force** — `vite.config.ts` declares both projects | the filename declares the tier (§1) | the file passes in its own project — `npx vitest run --project node <file>`, or `--project dom` — and both partition guards in `references/execution-tiers.md` report nothing | partly — every push runs both projects, so a misnamed file that reaches a DOM goes red unattended; a file that runs in *neither* project is caught only by the guards, which are hand-run |
| 15 | in force; axis 10 unreachable — `fast-check` is not installed | the axis walk of §3 is discharged, skipped axes named in one comment line | review: that comment, read against the axis list | no |
| 16 | in force — as a named helper, or `expect.extend` in the file that uses it | a rule asserted in more than two places is expressed once (§4) | review: the same encoding repeated in a third file | no |
| 17 | blocked → §8 step 2 | test data comes from a factory, and every entity used by more than one file has one (§4 · `factories.md`) | `npm run lint` — the `no-restricted-syntax` block on `Pkg__` keys in a test literal, which is one third of the rule | no — the block is not in `eslint.config.js` |
| 18 | in force for the reason; the matcher that owns the shape is blocked with rule 11 | an error assertion pins a reason from `shared/errors/reasons.ts`, and the envelope's shape stays in the matcher (`failure-envelope.md`) | `grep -rn -e 'error\.details' -e "reason: '" --include='*.test.ts*' src server shared` | no — hand-run |
| 19 | in force | not everything gets a test, and no `toMatchSnapshot` (`what-not-to-test.md`) | `grep -rn "toMatchSnapshot" src server shared scripts`; review for the rest | partly — gate pattern `test-snapshot`; the exemptions are reviewed |
| 20 | in force | a flake is handled the same day: a quarantine names a filed task, and no retry count anywhere (the flake policy, below) | `grep -rnE "\.skip\b" src server shared scripts`; `grep -rnE "^\s*retry" vite.config.ts` | partly — gate pattern `test-skipped-silently`; both greps are hand-run |
| 21 | **in force on CI, and only there** | repo-wide uncovered lines do not increase, and line coverage never falls below 70 % (§6) | the coverage ratchet — `npx vitest run --coverage`, thresholds in `vite.config.ts`, on the CI full run | **yes** — on CI. Never locally: the pre-push hook passes no coverage flag, so a change can be green all the way to the push and meet this threshold for the first time in the pipeline |
| 22 | blocked → §8 step 1 | covered lines are actually asserted on — fewer than 10 % of mutants survive (§7) | the mutation run | no |
| 23 | blocked on the seams it would describe → §8 step 5 | the boundary catalogue is a live document of the repository, not this skill (§2) | the page exists and is registered wherever the repository lists its documentation | no |
| 24 | **in force** | a node-tier case runs in tens of milliseconds, not seconds (§1 · `execution-tiers.md`) | `npx vitest run --project node --slowTestThreshold=50` — the flag reports a slow case and never fails a run | no — hand-run |

**A check matching two patterns repeats `-e`; it never alternates with a pipe.** A pipe cannot
survive a markdown table cell and a regular expression at the same time: escaped for the table it
becomes `\|`, a literal pipe in an ERE and alternation in a BRE, so the same cell matches nothing
under one `grep` and everything under another. Repeated `-e` needs no escape and behaves identically
everywhere. Do not tidy it back — this is the only place that sentence appears.

Rules 6, 17 and 20's checks need a word about what they do not mean.

- **Rule 6's grep finds the data seam only.** A dependency substituted at some other seam has
  no grep signature, and that half is reviewed.
- **Rule 17's lint block sees a namespaced object key, and nothing else.** It is narrow on purpose,
  so a plain view-model literal in a test stays legal → `factories.md`. A factory for an entity with
  no `Pkg__` field, and the "every entity used by more than one file" half, are both reviewed.
- **Rule 20's retry grep is anchored to the line start.** An unanchored one matches the word "retry"
  in a comment and reports a defect that is not there.
- **Rule 20's `.skip` grep is wider than the armed pattern, deliberately.** The gate matches
  `\b(it|test|describe)\.skip\(` — a call — so it never sees `describe.skip` passed as a *value*,
  which is exactly the shape §1's environment gate uses. The hand-run grep does see those lines, and
  every one of them is the gate working rather than a violation. A wider check can raise a false
  alarm; it cannot give a false clear.

Rules 21 and 22 answer different questions. Coverage answers "was the line executed". Mutation
answers "would any test notice if the line were wrong". A file can hold 100 % coverage and a
mutation score of zero — `render(<Card />)` with no assertion does exactly that. Neither answers
"is *this diff* covered": the ratchet is a repo-wide aggregate by design, so rule 21 claims no more
than the ratchet can prove → §6.

---

## 6. Coverage gate

Coverage is a root-level concern in Vitest — it cannot be set per project. It is configured once, as a
**ratchet** rather than an absolute floor: a negative threshold caps the number of uncovered lines
instead of demanding a percentage, so the number can only go down. **Never raise one to make a red
build green** — that is the ratchet's only rule, and the sanctioned escape from a blocked pipeline is
to disarm measurement visibly, not to loosen the number.

**Armed: a ratchet on uncovered lines repo-wide, and a tighter one under `src/lib/pricing/**`**, each
set from a measured baseline plus a stated headroom. Both numbers are the repository's own —
`npx vitest run --coverage` prints them, and a number copied from another repository is a fiction.
A locally measured baseline is **provisional** until the first CI coverage run confirms it.

**The gate's home is the CI full run, and it can have no other.** `--coverage` rides the existing
unit-test step; the pre-push hook passes no coverage flag and should not. Read that as a real
asymmetry rather than a detail: this is the one rule of this standard that a local run cannot tell you
about. Baseline, headroom derivation, the demonstration that the gate refuses, and the rollback
→ `references/coverage-gate.md`.

---

## 7. Mutation gate

Mutation testing changes the source, re-runs the tests, and asks whether anything noticed.
It is the only mechanical check for rule 22.

**It runs on the node tier only, and never in the pre-push hook** — a periodic audit of a narrow,
pure module, not a gate on every push. The Stryker runner's own properties force that, each with
its evidence, and restricting Stryker to the node tier is an explicit config step rather than a
consequence of the split. Config, the threshold ratchet, the TypeScript checker, and how to read a
surviving mutant → `references/mutation-gate.md`

---

## 8. The transition, and what ends it

**A rule whose mechanism does not exist is not yet a rule.** Most of this standard is a rule a
developer can honour in the next test they write. Some of it names a factory, a matcher or a fake
that nobody has built, and a standard that pretends otherwise gets ignored whole. So §5's state
column carries one of these values.

- **In force** — applies to every case you write or change, now.
- **New tests only** — applies to what you write; existing files migrate when they are touched for
  another reason, never in a dedicated sweep.
- **Blocked** — the mechanism is missing. The named step builds it; until then the rule is guidance
  and cannot be broken.
- ~~**In force with this run's own deliverable**~~ — retired. This value existed for rows 14 and 24
  while they waited on the `--project` flag having two projects to name. The tier split landed, so
  both rows now read `in force` and no row carries this state. It is recorded as retired rather than
  deleted because a state that vanishes silently reads as a row having been dropped.

**The obligation is scoped to the case you edited, not to the file you opened.** A case you change
owes every rule in force. A 400-line legacy file you opened for a one-line change owes nothing else.
That scope is deliberate: the review lens reads a diff, so a diff-scoped obligation is the only one
it can check, and "the clauses the file can satisfy" was not reviewable by anyone.

**The progress measure is the whole-tree auditor's score.** A migration with no number is a mood.
The auditor does not exist yet; until it does, the only measure is §5's state column, and the states
are what move.

**The transition ends when no row of §5 reads `blocked` and the interim table below is empty.** That
is the exit condition — not a date, and not a judgement. The second half is what keeps a page-local
criterion inside the device: a criterion whose mechanism is missing has a row in that table, so the
transition cannot end while its author still has no sanctioned move.

**Retiring this section is that change's deliverable.** Whichever change satisfies the exit condition
deletes it. A transition marker left behind sends every later reader here for a transition that
finished.

**The order the blocked mechanisms land in.** The rows of §5 that read `blocked` are 11, 17 and 22 —
21 left with the coverage ratchet, and 5 and 23 left with steps 4 and 5 below — the state column is
authoritative and this list is today's reading of it — and each step
below clears at least one of them. Finishing the list empties the interim table with it, save for one
row: rule 7's translation double retires with the sweep that moves it into the DOM tier's setup file,
which is not a step here because rule 7 is not blocked — the exit waits on it all the same.
**Each step is one task, and the repository names its own owner for it.**

**The tier split is not a step in this list, and it is done.** It preceded the list as this run's own
deliverable: `vite.config.ts` declares the node and dom projects, the files that needed renaming were
renamed, every `@vitest-environment` docblock is gone, and rows 14 and 24 are in force. **Its
re-measurement obligation is discharged** — `execution-tiers.md` carries how to take the
before-and-after wall clock on one machine, and §1 quotes the framing that survived it: the split
halved environment and setup cost on the files that needed neither, jsdom is not established as the
cause of what remains, and the residual is filed. What the split did **not** do is
anything on the list below; it unblocks steps 1 and 3 by giving them a node project to run in.

1. the mutation gate, after the snapshot assertions inside its target are cleared — a snapshot kills
   mutants without pinning a rule, so it inflates the first score every later threshold is set
   against. Unblocks rule 22, and mechanises rule 10 inside that target;
2. `src/test/factories/` with a barrel and one factory — unblocks rule 17 and lets the lint block be
   armed. It also lands one compliant node-tier file in the tree, run by the suite, as the exemplar
   this standard's fragments do not add up to. This step
   creates `src/test/`, so the query-client helper `src/test/renderWithProviders.tsx` lands beside
   the factories and clears `component-tests.md` criterion 10;
3. the matcher layer, then `vitest.setup.node.ts`, then its `setupFiles` line — unblocks rule 11;
4. ~~the fakes framework, both the client seam and the server injection point~~ — **landed.** Rule 5
   is in force, the two transport interims are retired, and the mechanism — including the four
   failures the first build hit — is `references/fakes.md`;
5. ~~a test-boundaries page describing the seams steps 2 to 4 built~~ — **landed.** Rule 23 is in
   force. The page names each seam, what it substitutes, and the migration order; the repository
   chooses its own path for it.

**The list was six steps and is five.** The sixth was the coverage ratchet, and it landed with the
tier split rather than waiting its turn — which is exactly what the note below predicted, since it
was the one step that depended on nothing. Its task is closed; what it built is in
`vite.config.ts` and `references/coverage-gate.md`.

**Some of this order is a real dependency; the rest is a priority, stated as one.** The mutation
gate and the node setup file both need the node project, which the tier split provided. The
mutation gate also follows the snapshot cleanup named in step 1, or its baseline is poisoned and the
ratchet never lowers it. Arming the lint block needs step 2, or a developer's only legal move is a
suppression. And step 5 can describe only seams that exist, so it follows steps 2 to 4. **Nothing
else waits on anything**, and the coverage step proved that by going first. **The mutation gate leads
what is left because it is available now and needs nothing**: no factory, no fake, no matcher, and a
target of pure calculation code. Inside that target it also mechanises rule 10, whose only artifact
anywhere else is a sentence in a PR body that nothing reads → `references/mutation-gate.md`.

**The sanctioned interims, and nothing else is sanctioned.** A row is a rule of §5 or a criterion of
a reference page — one home for both levels, because a missing mechanism reads the same from either.

| rule or criterion | what a test author does until the mechanism lands |
|---|---|
| 11 · the envelope | all eight fields are required today too. A matcher registered with `expect.extend` in the file that uses it needs no setup file, so it inlines the `JSON.stringify` the shared writer would have done — nine lines. Copy `failure()`'s body rather than writing those lines fresh: two of its replacements are load-bearing and easy to leave out. The describe chain's `' > '` has to become a space, or `-t` matches nothing and Vitest exits 0 on "1 skipped"; a quote has to become a dot, or a title with an apostrophe breaks the pattern → `references/failure-envelope.md`. What is blocked is the shared writer and the directory it lives in, not any field, and the inline copy comes out with step 3 |
| 7 · the translation double | `vitest.setup.ts` carries no `react-i18next` mock today, so the double is per file: a new DOM test writes its own copy, in the shape `copy-and-i18n.md` gives. Moving it into the DOM tier's setup file and removing the copies is one task. The gate pattern `test-i18n-mocked-locally` reports every copy as a minor, this one included — the `// INTERIM rule 7` marker is what tells a reviewer which it is |
| 17 · the factory | until `src/test/factories/` lands, a record literal in the test file is the legal form — that is what `blocked` means. It is what step 2 sweeps, so keep it in one place per file rather than one per case |

**Three rows have retired.** Both rule-5 interims — the `Pick<DataClient, …>` stub and the
`global.fetch` substitution on the server transports — came out with step 4, and
`component-tests.md` criterion 10's hand-built query client came out with step 2's helper. They are
recorded as retired rather than deleted because a row that vanishes silently reads as a row that was
dropped. The mechanism that replaced the first two is `references/fakes.md`.

**Every interim carries a marker where it is used, naming what it is interim to: `// INTERIM rule 5`,
or `// INTERIM component-tests.md criterion 10`** — inside the comment clause 4 already demands where
there is one, and in a comment of its own otherwise. `grep -rn 'INTERIM ' src server shared` is then
the retirement's work list. It prints nothing until the first interim is written, and the first one
written is the first line it prints.

---

## 9. What enforces this, and where it lives

**What blocks a push today is the review gate, not the tooling.** That is the opposite of what
this section said for three rounds, and it matters: a developer who trusts the tooling row is
trusting a row of gates, none of them armed for this standard.

| enforcer | scope | runs | blocks |
|---|---|---|---|
| the tooling already in place — eslint, `tsc`, Vitest's project split, the coverage ratchet, the mutation gate | whatever each tool is pointed at | commit, pre-push, CI | yes, where armed → §5. Today: **the tier split only** — every push runs both projects, so a `.test.ts` reaching for a DOM goes red without anyone asking |
| the review gate's deterministic patterns — the test lens's rules in the repository's review config | the diff | pre-push, through the attestation gate | **yes** |
| the review lens's judgement — the test lens, at the threshold the repository sets | the diff | on request; the pre-push hook then demands a fresh passing attestation for that diff | **yes**, through the attestation |
| a whole-tree auditor | every test file in the repository | on demand | no — and it does not exist yet |

**On the push, the tooling row enforces exactly one rule of this standard: row 14, the tier.** The
project split has landed, and Vitest is the only unattended enforcer there — a misnamed file fails on
a browser global on the next push, with nobody asked. Everything else in that row is dark or
elsewhere: the lint block is written and is not in `eslint.config.js`, the coverage ratchet runs on
CI and never on the push (row 21), the mutation gate reports and never fails, and `tsc` checks nothing
this document asks for.

**The gate's patterns are derived from §5's rows, not a second source.** `test-limp-assertion` is
rule 3, `test-mocks-own-component` is rule 6 and `component-tests.md` criterion 3,
`test-i18n-mocked-locally` is rule 7, `test-bare-tuple-each` is rule 12, `test-snapshot` is rule 19,
`test-skipped-silently` is rule 20. A pattern changes when its row changes, and a row that gains a
pattern names it.

The auditor's contract, its scoring scale and its acceptance criteria belong in the agent's own file.
Repeating them here would create the second copy this standard spent a round removing.

**Everything above is the shared standard. A runtime page carries only what that runtime does
differently.** Reaching a delta pulls the shared standard in rather than replacing it: arriving from a
runtime page, you still owe every clause of §2, and the delta states only that runtime's own rules on
top.

---

## The DOM tier

Component tests are the DOM tier's bulk, and everything above applies to them unchanged. What the
DOM adds — which query to use, `userEvent` versus `fireEvent`, what may be substituted, the query
client, async discipline, hook tests, and that page's own criteria — is one page:
`references/component-tests.md`.

These rules from it are the ones broken most often:

- Query by role and accessible name. `container.querySelector` is never acceptable in a test.
- `userEvent` models a person, `fireEvent` models the environment. Both are awaited where async.
- Import `userEvent` from `@testing-library/user-event` — **never** from `storybook/test`, which is
  not wired to React's `act` under Vitest and is the diagnosed cause of `act(...)` noise
  → `references/component-tests.md`.
- Substitute third-party widgets, never a component we own. Need a provider? Render it in the case.
- A hook test belongs to this tier: `renderHook` needs a DOM. Its return value **is** its public
  interface, which is the one carve-out from "never assert on internals".

---

## Which check runs where

**The whole suite locally, and the whole suite again on CI with a database.** The pre-push hook runs
`npx vitest run` today — every file, the same command CI runs. Nothing here passes `--changed`, and a
delta run is not proposed by this standard.

| | pre-push | CI |
|---|---|---|
| type check | every tsconfig project the repository declares | the same, in its own workflow; a bare `tsc --noEmit` in any other job reads one project only, which is a gap worth filing |
| tests | the whole suite — `npx vitest run` | the whole suite, with a database |
| coverage | never — the hook passes no coverage flag, deliberately | **yes** — `npx vitest run --coverage` on the unit-test step, with the ratchet's thresholds |
| lint | staged files on commit; the whole repo on pre-push | whole repo |
| mutation | never | never on every push; a periodic run |

Check the tests row rather than trusting it:
`grep -rn 'vitest run' .husky/ .github/workflows/` prints what each really runs.
It is kept because this section is the only part of the standard that can be wrong without anyone
noticing — and it was, for three rounds.

`npm test` is `vitest` — watch mode, which never exits. Every command in this standard says
`npx vitest run` for that reason.

---

## Restraint, and the flake policy

Two rules that stop everything above from turning into bulk. Their state is rules 19 and 20 of §5.

**Not everything gets a test.** A test that cannot fail for a reason you care about costs run time
on every push and must be updated by every refactor, while proving nothing. Barrels, constants,
types, a library's own behaviour, purely presentational markup — no test. Snapshots are forbidden
as a substitute for an assertion. A deliberate exemption is recorded where it can be seen, never
silent. → `references/what-not-to-test.md`

**A flaky test is a broken test, and it is handled the same day.** The moves, in order.

Finding one comes first, and without a mechanism this policy governs only what somebody happened to
notice. A flake is visible only by comparing runs, so the repository owes a detector: run the suite N
times and report every case whose answer changed, with its rate. **The unit is a case** — a run that
fails says the suite is red, while a case that passes once and fails once is the only thing that
identifies a flake. A case missing from a run counts as disagreement, because a file that fails to
collect takes its cases with it. It exits non-zero when anything is unstable. Ten runs is ten
minutes, so it belongs on a schedule and never in the pre-push hook. The rate it prints is the point
— a frequency nobody measured is a guess.

1. **Quarantine it visibly.** `it.fails` or a skip **with a filed task id in the comment** — never a
   bare `.skip`, which the review gate flags as a major for exactly this reason.
2. **Diagnose the cause, not the symptom.** The causes are a short list: a real timer, an
   uncontrolled promise, a leaked global from a missing reset, an unawaited `userEvent`. Widening a
   timeout is not a diagnosis.
3. **Delete it if it cannot be made deterministic** — and while rule 21 is unarmed on the push,
   record the deletion and its reason in the PR. A test that passes on a rerun is not evidence; it is
   noise that trains everyone to rerun. But deletion is this standard's only fully in-force
   permission, and every mechanism that would catch it being abused — the ratchet, the mutation gate,
   the auditor — is one of the unarmed ones. The record is what stands in until they land.

What is not allowed: a retry count. Automatic retries convert a real intermittent defect into a
green build, which is the single most expensive thing a test suite can do.
