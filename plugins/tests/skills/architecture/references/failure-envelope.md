# The failure envelope — a standard for what a red line must say

## Why this is a standard and not a style note

A product that already took one uniform error envelope — `google.rpc.Status`, filled the same way by
every producer from the upstream through the server to the client (`docs/errors/envelope.md`) — knows
what it bought: an error is classifiable, displayable and diagnosable wherever it came from.

A test failure is the same problem with a different reader. The reader is a developer at 18:40 who
did not write the test, looking at a red line in a wall of output. If every failure carries the
same fields, that reader diagnoses without opening the test file. If each matcher improvises, the
red line says `expected true to be false` and the reader is on their own.

So: **a custom matcher's failure carries a fixed set of fields, the way a failing request does.**

**The scope is a matcher, and it is narrower than "every assertion".** A built-in matcher cannot
produce this envelope, and requiring one per assertion would contradict the standard's own economy
rule — an assertion earns a matcher when the rule it states is asserted in more than two places
(main skill, rule 16). So `expect(total).toBe(EXPECTED_TOTAL)` owes nothing here, and the promise
this page makes is bounded: **the failures a matcher produces diagnose themselves; the rest keep
Vitest's own wording.** What carries those is the named constant — Vitest prints the failing source
line, so the name and its comment reach the reader even though the message cannot.

## The eight fields

| field | what it answers | why it must be there |
|---|---|---|
| **subject** | *which* thing failed — the entity's name or id | three orders in a case, one red line; without the subject you guess |
| **expectation** | the rule, in words | a comparison operator is not a rule; the reader needs the promise that was broken |
| **actual** | what was observed, in the same terms | `false` is not an observation; `status=Open` is |
| **deciding state** | the fields the verdict was computed from | turns "it is not closed" into "paid 50 of 100" — the diagnosis, not the verdict |
| **hint** | optional: what usually causes this | only where a failure has a known common cause; never a guess |
| **matcher** | which matcher produced the failure | groups failures by the rule that broke, not by the file that noticed |
| **reproduce** | the command that re-runs exactly this case | the reader copies one line instead of composing it from the file and the title, every time |
| **locator** | where to look — the module, the **function** when the rule has one, and the doc anchor | Vitest prints the *test's* file:line; it cannot know where the RULE lives. Without this the reader has the verdict and no address |

Nothing else. A dump of the whole object is not another field — a forty-row diff is noise wearing
the costume of information.

## The shape — a JSON envelope

The message is a JSON document, deliberately mirroring `google.rpc.Status`: the same reasoning that
made one error envelope pay off applies to a red line. **The case is the human reader, and only the
human reader.** JSON is also parseable, but no reporter, script or agent consumes it here and none is
scheduled to — so the machine-readability argument is not a benefit this standard counts, and if it
ever is, it will be because something was built to collect it. The fields earn their place
on the reader alone.

One shared writer; matchers only fill it in.

```ts
// src/test/matchers/envelope.ts
import { relative } from 'node:path';

export interface FailureEnvelope {
  subject: string;                       // which thing — a name, an id, a call
  expectation: string;                   // the rule, in words
  actual: string;                        // what was observed, same terms
  deciding: Record<string, unknown>;     // the fields the verdict was computed from
  hint?: string;                         // only where the cause is genuinely known
  matcher: string;                       // which matcher failed, for grouping by rule
  locator: {
    rule: string;                        // the module that owns the rule
    function?: string;                   // the function or symbol, when the rule has one
    docs?: string;                       // the doc or skill anchor that explains it
  };
}

// `reproduce` is filled in here, not by the caller: Vitest already knows the file and the title,
// so a hand-written command would only be a copy that drifts. Two translations stand between the
// state and a command that runs, and the writer owes both:
//
//   1. `-t` matches the SPACE-joined title. `currentTestName` joins the describe chain with ' > '.
//      Passed through unchanged, `-t` matches no case at all: Vitest reports "1 skipped" and exits
//      0, which a reader takes for a test that now passes. Silently green is worse than an error.
//   2. `-t` is a regular expression, so a quote in the title becomes `.` — one wildcard character
//      instead of a broken shell string. Titles here are sentences, and sentences contain "doesn't".
export const failure = (envelope: FailureEnvelope) => () => {
  const { testPath, currentTestName } = expect.getState();
  const filter = (currentTestName ?? '').replace(/ > /g, ' ').replace(/['"]/g, '.');
  const file = relative(process.cwd(), testPath ?? '');   // absolute from getState(); pastes shorter
  return JSON.stringify({ ...envelope, reproduce: `npx vitest run ${file} -t '${filter}'` }, null, 2);
};
```

A matcher fills the envelope in and returns it as `message`. The worked example is `toFailWith`
below, and it must be written against real code in the repository that adopts it rather than an
invented module.

Compare that with what a built-in matcher prints:

```
AssertionError: expected 'Open' to be 'Closed'
AssertionError: expected [Function] to throw an error
AssertionError: expected 90 to be 100
```

**Those lines stay exactly as they are unless the rule behind them earns a matcher.** That is the
bound of this page, stated rather than implied: the envelope buys a self-diagnosing failure for the
rules that have a matcher, and a repeated assertion is what promotes a rule into one (rule 16). The
cost is honest too — eight lines instead of one, and a run with fifty matcher failures is long. The
trade is deliberate for the rules worth it, which is why it is not demanded of every assertion.

## For an error assertion

The same eight fields, applied to the error envelope. The matcher owns the knowledge of where
`reason` lives, so no test file walks `details[]`:

**The matcher reads the envelope through the reader that already exists.** One module in the client
walks the `google.rpc.Status` shape — normalising every producer's error into
`{ status, reason, message }` — and the matcher must not re-implement that walk, nor name a function
that does not exist:

```ts
import { readApiError } from '@/lib/errors/readApiError';
import type { Reason } from '@shared/errors/reasons';

expect.extend({
  toFailWith(received: unknown, expectedReason: Reason) {
    const error = readApiError(received);         // the one walker of the envelope shape
    const pass = error?.reason === expectedReason;
    return {
      pass,
      message: failure({
        // The envelope names the operation in its message when it carries one; a bare rejection
        // does not, and `reproduce` identifies the case either way.
        subject: error?.message ?? 'the awaited call',
        // Both branches: `.not.toFailWith()` fails through the negated wording.
        expectation: pass ? `reason is NOT ${expectedReason}` : `reason=${expectedReason}`,
        actual: `reason=${error?.reason ?? 'none at all'}`,
        deciding: { status: error?.status ?? 'not an error envelope' },
        matcher: 'toFailWith',
        locator: {
          rule: 'src/lib/errors/readApiError.ts',
          function: 'readApiError',
          docs: 'docs/errors/envelope.md',
        },
      }),
    };
  },
});
```

Run it as written, under `environment: node`, against an enveloped rejection **and** against a bare
`Error`: both branches must produce a parseable message, and the bare `Error` must report
`reason=none at all` with `status: 'not an error envelope'` rather than throwing inside the matcher.

`toFailWith` goes through `failure()` like every other matcher — no prose alternative. It is the
matcher this standard will be asked to produce most often: rule 18 routes every error assertion
through it, and the permission axis in `case-space.md` depends on it. A prose version here would be
the version that gets copied.

What it prints:

```json
{
  "subject": "fetchCatalog('cat-9999')",
  "expectation": "reason=UNKNOWN_FIELD",
  "actual": "reason=SESSION_EXPIRED",
  "deciding": { "status": "UNAUTHENTICATED" },
  "matcher": "toFailWith",
  "locator": { "rule": "src/lib/errors/readApiError.ts", "function": "readApiError", "docs": "docs/errors/envelope.md" },
  "reproduce": "npx vitest run src/lib/catalog/fetchCatalog.test.ts -t 'fetchCatalog reports the field as unresolved'"
}
```

**Both reasons in that output must be real keys of the reason registry, and that is not decoration.**
The `reason` argument comes from `shared/errors/reasons.ts`, never as a string literal — a typo in a
literal makes the test pass against the wrong code, which is the exact failure the shared registry
exists to prevent. An example naming a reason the registry does not carry teaches the habit it is
warning against.

**The title in `reproduce` is not the title Vitest prints in its own `FAIL` header, and that is
correct.** The header renders ` > ` between the describe and the case; the filter is the space-joined
form `-t` actually matches. Paste the line and the one case re-runs — that is the check criterion 4
of this page asks for, and it is checked by running it.

Vitest still prints the failing *test's* file and line. What it cannot know is where the **rule**
lives — that is what `locator` carries, down to the function when the rule has one.

## Rules

1. **Every custom matcher supplies `message()`, and it carries the eight fields.** A matcher without
   a message is a matcher that will be debugged by reading its source. A built-in matcher is outside
   this rule entirely.
2. **Both branches are written.** `pass: true` still needs a message — `.not.toBe…()` fails
   through it, and a missing negated message produces a red line saying nothing.
3. **Carry a locator on any matcher that encodes a domain rule.** `rule` is required; `function` is
   required whenever the rule lives in a named function or symbol; `docs` points at the anchor that
   explains it. A matcher stating a generic condition may skip the doc anchor; a matcher enforcing a
   pricing or eligibility rule may not. **`locator.rule` is hand-typed and goes stale the first time
   the module moves.** Nothing verifies it, so read it as a pointer and never as evidence — if it does
   not resolve, the rule moved and the matcher is the next thing to fix.
4. **Name the subject by something a human recognises** — a `Name`, an external id, a slug. Not an
   internal array index.
5. **Print the deciding state, not the whole object.** The fields the verdict was computed from,
   and no more.
6. **The envelope's structure lives in the matcher, never in a test file.** No test walks
   `error.details[]`; no test compares a status string directly where a matcher exists.
7. **No hint you cannot justify.** A wrong hint costs more than no hint: it sends the reader down a
   path the failure did not come from.
8. **Nest `describe` two levels deep at most.** This one is about the file rather than the matcher,
   and it holds whether or not the file has one: `reproduce`'s filter is built from the describe
   chain, so a four-level chain produces a line too long to paste and a `-t` pattern with four
   chances to contain a character the regex reads differently. A file with no matcher still owes it,
   because the chain is what anyone re-running one case has to type.

## Acceptance criteria

1. Every custom matcher supplies `message()` for both branches, wherever it is registered — the
   shared directory when it exists, and `expect.extend` in the test file until then. Assertions made
   with a built-in matcher are out of scope.
2. Each message names the subject, the expectation, the actual, and the deciding state.
3. A matcher encoding a domain rule prints a locator: the module, the function where one exists, and
   a doc anchor.
4. Every message names its matcher and carries a `reproduce` command that actually runs. Check it by
   running it: it must re-run the one case. `1 skipped` and exit 0 is a failed check, not a pass.
5. The message is valid JSON — `JSON.parse` of it succeeds. One shape, read the same way every
   time, is the point; no consumer of it is claimed.
6. Read on its own, with no access to the test file, a failure message is enough to say what broke
   and where to look. This is checkable: paste the message alone and see whether it stands up.
7. No test file contains a path into the error envelope (`error.details`, an error-info type) — that
   knowledge is in `toFailWith` only.
8. **Reasons** come from `shared/errors/reasons.ts`, never a string literal.
