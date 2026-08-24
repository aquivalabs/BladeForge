#!/usr/bin/env node
// plugins/review-workflow/tests/workflow-rules.test.mjs — the review-workflow
// script's own logic, driven offline with no agents, no git and no repository.
//
// The technique is copied from plugins/speccy/tests/script-rules.test.mjs (its
// "source driver" section): workflow.js carries both `export const meta` and a
// top-level `return`, so it cannot be imported as a module. The shim below
// strips the one `export` keyword, wraps what remains in an async IIFE inside
// `new Function("args", "agent", "parallel", "phase", "log", …)`, and stubs
// `agent` by `opts.label`. Nothing inside workflow.js is re-implemented here —
// every assertion is against what the real script returns for a literal `args`
// object.
//
// Every test is a pure function of `args`: no test touches git, writes a file,
// or needs a checkout. An unstubbed agent resolves to `null`, which is what the
// real harness returns when an agent settles without its structured-output
// call — that is what makes the "backstop" and "dispatch" groups reachable
// without a real reviewer ever running.
//
// Groups, in the order the task's table lists them:
//   score, countedMinor, criterion 6 accepts the round rule, round rule,
//   Major ceiling, gate criteria (1-8), never writes, reconcile, untouched,
//   dispatch, backstop.
//
// Run: node plugins/review-workflow/tests/workflow-rules.test.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = join(HERE, "..", "workflow.js");

let pass = 0;
let fail = 0;

function check(desc, ok, detail = "") {
  if (ok) {
    console.log(`  ok: ${desc}`);
    pass += 1;
  } else {
    console.log(`  FAIL: ${desc}${detail ? ` — ${detail}` : ""}`);
    fail += 1;
  }
}

function checkIncludes(desc, haystack, needle) {
  const ok = typeof haystack === "string" && haystack.includes(needle);
  check(desc, ok, `want ${JSON.stringify(needle)} in ${JSON.stringify(haystack)}`);
}

function checkEqual(desc, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(desc, ok, `want ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ── The source driver ────────────────────────────────────────────────
// Copied from script-rules.test.mjs's driver shape — the technique, not the
// fixtures. workflow.js has exactly one top-level `export`.

const source = readFileSync(WORKFLOW, "utf8");
const exportCount = (source.match(/^export /gm) || []).length;
if (exportCount !== 1) {
  console.error(
    `driver: workflow.js has ${exportCount} top-level \`export \` statements, expected exactly 1 — the shim strips one`
  );
  process.exit(1);
}

const driverBody = `return (async () => {\n${source.replace(/^export const meta/m, "const meta")}\n})();`;
const driver = new Function("args", "agent", "parallel", "phase", "log", driverBody);

// Drive one run. `agents` maps a stub onto an agent by exact `opts.label`, then
// by the label's kind (the part before `:`), then by `*`. A stub may be a value
// or a function of the call. An unstubbed agent returns null, which is what the
// real harness does when an agent settles without its structured-output call.
async function runWorkflow({ args, agents = {} } = {}) {
  const calls = [];
  const logs = [];
  const phases = [];

  const agentStub = async (prompt, opts = {}) => {
    const label = opts.label ?? "(unlabelled)";
    calls.push({ label, prompt, opts });
    const kind = label.includes(":") ? label.slice(0, label.indexOf(":")) : label;
    const stub =
      agents[label] !== undefined
        ? agents[label]
        : agents[kind] !== undefined
          ? agents[kind]
          : agents["*"];
    if (typeof stub === "function") return stub({ prompt, opts, label });
    return stub === undefined ? null : stub;
  };

  const parallelStub = async (thunks) => Promise.all(thunks.map((thunk) => thunk()));

  let result = null;
  let error = null;
  try {
    result = await driver(
      args,
      agentStub,
      parallelStub,
      (name) => phases.push(name),
      (line) => logs.push(String(line))
    );
  } catch (thrown) {
    error = thrown;
  }

  return {
    result,
    error,
    calls,
    logs,
    phases,
    labels: calls.map((call) => call.label)
  };
}

// A stub that returns a different value on each successive call, holding the
// last value once the list runs out. Used to simulate an off-schema response
// that parses correctly on retry.
function sequence(...values) {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────

const lensEntry = (name, overrides = {}) => ({
  name,
  threshold: -100,
  skills: [],
  rules: [],
  pairedDocs: {},
  ...overrides
});

const baseArgs = (overrides = {}) => ({
  base: "main",
  hash: "deadbeef",
  round: 1,
  changedFiles: [],
  diffPath: "/tmp/review.diff",
  config: { agents: [] },
  priorPerAgent: null,
  ...overrides
});

const finding = (overrides = {}) => ({
  severity: "minor",
  why_this_severity: "why this severity",
  where: "src/foo.ts:1",
  occurrences: 1,
  problem: "a problem",
  scenario: "a concrete scenario",
  confidence: "high",
  evidence: "the evidence",
  ...overrides
});

const lensResponse = ({ agentName = "lens", findings = [], claims = [], score = 10, verdict = "PASS", oneLine = "" } = {}) => ({
  findings,
  claims,
  summary: {
    agent: agentName,
    verdict,
    score,
    counts: { blocker: 0, major: 0, minor: 0, advisory: 0 },
    one_line: oneLine
  }
});

// ── Group: score ───────────────────────────────────────────────────────
// 10 − 20×blocker − 3×major − 1×countedMinor; advisory is zero; a blocker
// lands below zero.

console.log("\nscore");
{
  const args = baseArgs({
    round: 1,
    config: { agents: [lensEntry("solo")] }
  });
  const response = lensResponse({
    agentName: "solo",
    findings: [
      finding({ severity: "blocker", where: "src/a.ts:1" }),
      finding({ severity: "major", where: "src/b.ts:1", scenario: "breaks src/other.ts too" }),
      finding({ severity: "minor", where: "src/c.ts:1" }),
      finding({ severity: "advisory", where: "src/d.ts:1" }),
      finding({ severity: "advisory", where: "src/e.ts:1" })
    ]
  });
  const run = await runWorkflow({ args, agents: { "lens:solo": response } });
  check("no exception escapes the run", run.error === null, String(run.error));
  const entry = run.result?.perAgent?.[0];
  checkEqual(
    "the formula: 10 − 20×blocker − 3×major − 1×countedMinor, two advisories included and ignored",
    entry?.score,
    10 - 20 * 1 - 3 * 1 - 1 * 1
  );
  check("a blocker lands the score below zero", entry?.score < 0, JSON.stringify(entry));
}
{
  const args = baseArgs({
    round: 1,
    config: { agents: [lensEntry("advisoryOnly")] }
  });
  const response = lensResponse({
    agentName: "advisoryOnly",
    findings: [
      finding({ severity: "advisory", where: "src/a.ts:1" }),
      finding({ severity: "advisory", where: "src/b.ts:1" })
    ]
  });
  const run = await runWorkflow({ args, agents: { "lens:advisoryOnly": response } });
  checkEqual("advisories alone never deduct anything", run.result?.perAgent?.[0]?.score, 10);
}

// ── Group: countedMinor ─────────────────────────────────────────────────
// In rounds 1 and 2 each minor costs 1; from round 3 each costs 0 — the same
// fixture at round 2 and round 3 scores 8 and 10.

console.log("\ncountedMinor");
{
  const minorPair = () => [
    finding({ severity: "minor", where: "src/a.ts:1" }),
    finding({ severity: "minor", where: "src/b.ts:1" })
  ];
  const argsRound2 = baseArgs({ round: 2, config: { agents: [lensEntry("solo")] } });
  const runRound2 = await runWorkflow({
    args: argsRound2,
    agents: { "lens:solo": lensResponse({ agentName: "solo", findings: minorPair(), score: 8 }) }
  });
  checkEqual("round 2: two minors cost 1 each, scoring 8", runRound2.result?.perAgent?.[0]?.score, 8);

  const argsRound3 = baseArgs({ round: 3, config: { agents: [lensEntry("solo")] } });
  const runRound3 = await runWorkflow({
    args: argsRound3,
    agents: { "lens:solo": lensResponse({ agentName: "solo", findings: minorPair(), score: 10 }) }
  });
  checkEqual("round 3: the same two minors cost nothing, scoring 10", runRound3.result?.perAgent?.[0]?.score, 10);
}

// ── Group: criterion 6 accepts the round rule ───────────────────────────
// A round-3 lens returning two Minors and scoring 10 passes criterion 6;
// attest is not refused and refusedCriterion is null.

console.log("\ncriterion 6 accepts the round rule");
{
  const args = baseArgs({ round: 3, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:solo": lensResponse({
        agentName: "solo",
        findings: [
          finding({ severity: "minor", where: "src/a.ts:1" }),
          finding({ severity: "minor", where: "src/b.ts:1" })
        ],
        score: 10
      })
    }
  });
  checkEqual("a round-3 lens scoring 10 on two minors passes criterion 6 unrefused", run.result?.attest, true);
  checkEqual("refusedCriterion is null", run.result?.refusedCriterion, null);
}

// ── Group: round rule ───────────────────────────────────────────────────
// A round-3 run of only Minors scores every lens 10, refuses nothing, and
// still lists those Minors in the report and the returned payload.

console.log("\nround rule");
{
  const args = baseArgs({
    round: 3,
    config: { agents: [lensEntry("alpha"), lensEntry("beta")] }
  });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:alpha": lensResponse({
        agentName: "alpha",
        findings: [finding({ severity: "minor", where: "src/alpha.ts:1", problem: "alpha's minor problem" })],
        score: 10
      }),
      "lens:beta": lensResponse({
        agentName: "beta",
        findings: [finding({ severity: "minor", where: "src/beta.ts:1", problem: "beta's minor problem" })],
        score: 10
      })
    }
  });
  check("attest is true, refusing nothing", run.result?.attest === true && run.result?.refusedCriterion === null);
  checkEqual("every lens scores 10", run.result?.perAgent?.map((entry) => entry.score), [10, 10]);
  checkIncludes("the report lists alpha's deferred minor by location", run.result?.report, "src/alpha.ts:1");
  checkIncludes("the report lists beta's deferred minor by location", run.result?.report, "src/beta.ts:1");
  checkEqual(
    "the returned payload still carries those minors, not just the report",
    run.result?.perAgent?.map((entry) => entry.deferredMinors.length),
    [1, 1]
  );
}

// ── Group: Major ceiling ─────────────────────────────────────────────────
// From round 3, four Majors → three carried, one listed as deferred, none
// rewritten to `minor` on the wire.

console.log("\nMajor ceiling");
{
  const majors = [
    finding({
      severity: "major",
      where: "src/mod.ts:1",
      problem: "major A",
      scenario: "reaches src/other1.ts and src/other2.ts and src/other3.ts and src/other4.ts"
    }),
    finding({
      severity: "major",
      where: "src/mod.ts:2",
      problem: "major B",
      scenario: "reaches src/other5.ts and src/other6.ts and src/other7.ts"
    }),
    finding({
      severity: "major",
      where: "src/mod.ts:3",
      problem: "major C",
      scenario: "reaches src/other8.ts and src/other9.ts"
    }),
    finding({
      severity: "major",
      where: "src/mod.ts:4",
      problem: "major D",
      scenario: "reaches src/other10.ts only"
    })
  ];
  const args = baseArgs({ round: 3, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: { "lens:solo": lensResponse({ agentName: "solo", findings: majors, score: 10 - 3 * 4 }) }
  });
  const entry = run.result?.perAgent?.[0];
  checkEqual("all four majors are still on the wire, none demoted", entry?.findings?.map((f) => f.severity), [
    "major",
    "major",
    "major",
    "major"
  ]);
  check("three Majors are carried into the fix round", entry?.reopensRound === true);
  checkEqual("exactly one deferred major is listed", entry?.deferredMajors?.length, 1);
  checkEqual("the deferred one is major D, the lowest-reach", entry?.deferredMajors?.[0]?.problem, "major D");
  checkIncludes("the report lists major D as deferred-this-round", run.result?.report, "deferred-this-round major at src/mod.ts:4");
}

// ── Group: gate criteria ─────────────────────────────────────────────────
// Each of criteria 1, 2, 3, 5, 7 and 8 fails independently, setting
// attest:false with refusedCriterion equal to its own number. Criterion 4
// demotes a file-local major and says so, rather than ever failing (the
// demotion happens in the Score phase, before the Gate phase runs, so a
// major-with-local-scenario can never reach the gate at all — this is
// asserted directly). Criterion 6 has its own passing fixture above, since
// the score it re-checks is always internally consistent by construction and
// can never independently fail.

console.log("\ngate criteria");

// Criterion 1 — needs a retry before it parses; its own fixture per the task,
// distinct from criterion 7's unstubbed lens.
{
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")] } });
  const firstBad = { findings: [], summary: { agent: "solo", verdict: "PASS", score: 10, counts: { blocker: 0, major: 0, minor: 0, advisory: 0 }, one_line: "" } }; // missing claims
  const secondGood = lensResponse({ agentName: "solo", findings: [], score: 10 });
  const run = await runWorkflow({
    args,
    agents: { "lens:solo": sequence(firstBad, secondGood) }
  });
  checkEqual("criterion 1: a lens that needed a retry refuses the gate at 1", run.result?.refusedCriterion, 1);
  checkEqual("criterion 1: attest is false", run.result?.attest, false);
}

// Criterion 2 — severity outside its enum.
{
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:solo": lensResponse({
        agentName: "solo",
        findings: [finding({ severity: "critical", confidence: "high" })],
        score: 10
      })
    }
  });
  checkEqual("criterion 2: an out-of-enum severity refuses the gate at 2", run.result?.refusedCriterion, 2);
  checkEqual("criterion 2: attest is false", run.result?.attest, false);
}

// Criterion 3 — a major or minor with no scenario.
{
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:solo": lensResponse({
        agentName: "solo",
        findings: [finding({ severity: "minor", scenario: "" })],
        score: 9
      })
    }
  });
  checkEqual("criterion 3: an empty scenario on a minor refuses the gate at 3", run.result?.refusedCriterion, 3);
  checkEqual("criterion 3: attest is false", run.result?.attest, false);
}

// Criterion 4 — a file-local major is demoted before the gate runs, so it
// never reaches criterion 4 as a violation; it reaches the report as a
// demotion instead.
{
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:solo": lensResponse({
        agentName: "solo",
        findings: [
          finding({
            severity: "major",
            where: "src/local.ts:1",
            scenario: "stays inside src/local.ts and nowhere else"
          })
        ],
        score: 10
      })
    }
  });
  const entry = run.result?.perAgent?.[0];
  checkEqual("criterion 4: a file-local major is demoted to minor, not left as a major", entry?.findings?.[0]?.severity, "minor");
  checkEqual("criterion 4: the demotion is recorded", entry?.demotions?.[0], { where: "src/local.ts:1", from: "major", to: "minor" });
  checkIncludes("criterion 4: the report says so", run.result?.report, "demoted major to minor at src/local.ts:1");
  checkEqual("criterion 4: a demoted major never reaches criterion 4 as a violation", run.result?.attest, true);
}

// Criterion 5 — every deducted point has a matching finding; a lens
// self-reporting a score below 10 with no findings at all is rejected. This
// checks the lens's own reported score, not the script's recomputed one:
// the recomputed score is always exactly 10 when findings is empty, so a
// check against it could never fire. See "Deviations" / the friction log for
// the one-line fix this exposed in workflow.js.
{
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: { "lens:solo": lensResponse({ agentName: "solo", findings: [], score: 3 }) }
  });
  checkEqual("criterion 5: a self-reported score below 10 with no findings refuses the gate at 5", run.result?.refusedCriterion, 5);
  checkEqual("criterion 5: attest is false", run.result?.attest, false);
}
{
  // Contrast: an honestly-reported 10 with no findings passes.
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: { "lens:solo": lensResponse({ agentName: "solo", findings: [], score: 10 }) }
  });
  checkEqual("criterion 5: a self-reported 10 with no findings is not refused", run.result?.attest, true);
}

// Criterion 7 — a lens left unstubbed never dispatches; refused at 7, never
// at 1, which is what pins the script's precedence rule.
{
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("ghost")] } });
  const run = await runWorkflow({ args, agents: {} });
  checkEqual("criterion 7: an undispatched lens refuses the gate at 7, not 1", run.result?.refusedCriterion, 7);
  checkEqual("criterion 7: attest is false", run.result?.attest, false);
  checkEqual("criterion 7: the undispatched lens still shows the retry withRetry attempted", run.result?.perAgent?.[0]?.retried, true);
}

// Criterion 8 — a deferred Minor whose `where` is empty is reported with the
// literal (empty) value, not the whereKey fallback the check searches for —
// the mismatch this criterion exists to catch.
{
  const args = baseArgs({ round: 3, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:solo": lensResponse({
        agentName: "solo",
        findings: [finding({ severity: "minor", where: "", scenario: "stays wherever it stays" })],
        score: 10
      })
    }
  });
  checkEqual("criterion 8: a deferred minor with a blank `where` refuses the gate at 8", run.result?.refusedCriterion, 8);
  checkEqual("criterion 8: attest is false", run.result?.attest, false);
}

// ── Group: never writes ───────────────────────────────────────────────
// Across every fixture the return value is the only output. The driver
// injects the five names the shim injects and nothing more — this asserts a
// rule, not a boundary: it proves the script does not reach for I/O, not that
// it could not.

console.log("\nnever writes");
{
  check("the shim injects exactly the five names workflow.js expects", driver.length === 5, String(driver.length));
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: { "lens:solo": lensResponse({ agentName: "solo", findings: [], score: 10 }) }
  });
  checkEqual("the result object carries exactly its five documented keys and no more", Object.keys(run.result ?? {}).sort(), [
    "attest",
    "failedLenses",
    "perAgent",
    "refusedCriterion",
    "report"
  ]);
  checkEqual("the eight phases run, in order, for an ordinary pass", run.phases, [
    "Dispatch",
    "Evidence critic",
    "Reconcile",
    "Untouched set",
    "Score",
    "Round rules",
    "Gate",
    "Below-floor notice"
  ]);
}

// ── Group: reconcile ───────────────────────────────────────────────────
// Two lenses with opposite conclusions on one `where` produce a disputed
// pair, and neither is discarded.

console.log("\nreconcile");
{
  const args = baseArgs({
    round: 1,
    config: { agents: [lensEntry("alpha"), lensEntry("beta")] }
  });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:alpha": lensResponse({
        agentName: "alpha",
        findings: [
          finding({
            severity: "major",
            where: "src/foo.ts:10",
            scenario: "breaks src/bar.ts loudly",
            problem: "alpha thinks this is a major problem"
          })
        ],
        score: 7
      }),
      "lens:beta": lensResponse({
        agentName: "beta",
        findings: [
          finding({
            severity: "minor",
            where: "src/foo.ts:10",
            scenario: "stays local and quiet",
            problem: "beta thinks this is a minor problem"
          })
        ],
        score: 9
      })
    }
  });
  checkEqual("neither lens's finding is discarded — each keeps its one finding", run.result?.perAgent?.map((entry) => entry.findings.length), [1, 1]);
  check("alpha's finding at the shared location is marked disputed", run.result?.perAgent?.[0]?.findings?.[0]?.disputed === true);
  check("beta's finding at the shared location is marked disputed too", run.result?.perAgent?.[1]?.findings?.[0]?.disputed === true);
  checkIncludes("the report carries a Disputed section naming the shared location", run.result?.report, "Disputed:");
  checkIncludes("the disputed line names both lenses' conclusions", run.result?.report, "src/foo.ts:10: alpha=major, beta=minor");
}

// ── Group: untouched ───────────────────────────────────────────────────
// A diff no lens names produces a directory-folded section ranked by line
// share, plus the by-name root/`.claude/` section; it does not block and
// never sets attest:false.

console.log("\nuntouched");
{
  const args = baseArgs({
    round: 1,
    changedFiles: [
      { path: "src/components/Foo.tsx", added: 50, removed: 10 },
      { path: "src/components/Bar.tsx", added: 5, removed: 0 },
      { path: ".claude/settings.json", added: 2, removed: 0 },
      { path: "README.md", added: 1, removed: 0 }
    ],
    config: { agents: [lensEntry("solo")] }
  });
  const run = await runWorkflow({
    args,
    agents: { "lens:solo": lensResponse({ agentName: "solo", findings: [], claims: [], score: 10 }) }
  });
  checkIncludes("the header states the whole diff went untouched", run.result?.report, "untouched: 100% of the diff (4 files, 68 of 68 lines)");
  checkIncludes(
    "the heaviest directory is ranked first, folded to one row",
    run.result?.report,
    "src/components   65 lines   2 files"
  );
  checkIncludes("the .claude/ directory gets its own row", run.result?.report, ".claude   2 lines   1 files");
  checkIncludes("the repository root gets its own row", run.result?.report, "(repository root)   1 lines   1 files");
  checkIncludes("the by-name surface section lists .claude/settings.json", run.result?.report, ".claude/settings.json");
  checkIncludes("the by-name surface section lists README.md", run.result?.report, "README.md");
  checkEqual("an entirely untouched diff never blocks the gate", run.result?.attest, true);
}

// ── Group: dispatch ─────────────────────────────────────────────────────
// A config naming an agent with no file produces a FAIL for that lens, not a
// PASS 10. The fixture is a six-agent config — the five built-ins plus one
// name the driver leaves unstubbed, carrying no `enabled` field.

console.log("\ndispatch");
{
  const builtins = ["craft", "architecture", "tests", "docs", "security"];
  const args = baseArgs({
    round: 1,
    config: { agents: [...builtins.map((name) => lensEntry(name)), lensEntry("ghost")] }
  });
  const agents = Object.fromEntries(
    builtins.map((name) => [`lens:${name}`, lensResponse({ agentName: name, findings: [], score: 10 })])
  );
  const run = await runWorkflow({ args, agents });
  checkEqual("perAgent has six entries, one per configured lens", run.result?.perAgent?.length, 6);
  const ghost = run.result?.perAgent?.[5];
  checkEqual("the unstubbed sixth lens is not dispatched", ghost?.dispatched, false);
  checkEqual("it FAILs rather than passing at a phantom 10", ghost?.verdict, "FAIL");
  check("its score is null, not a fabricated 10", ghost?.score === null, JSON.stringify(ghost));
}

// ── Group: backstop ──────────────────────────────────────────────────────
// An off-schema response retries once and FAILs on a second violation. Two
// distinct failure shapes: agent() returning null (the agent stopped without
// its structured call) and agent() returning a parsed object with a bad
// field. The null fixture only exercises the retry because the script's
// wrapper throws on null — this group is also the test that the wrapper
// checks its result.

console.log("\nbackstop");
{
  // Shape 1: the agent never calls back with a structured result at all.
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("silent")] } });
  const run = await runWorkflow({ args, agents: {} });
  const entry = run.result?.perAgent?.[0];
  checkEqual("a null-returning agent FAILs after a retry, not a first-try pass", entry?.dispatched, false);
  check("the retry was attempted", entry?.retried === true);
  check(
    "the first failure is logged, naming the retry",
    run.logs.some((line) => line.includes("silent") && line.includes("retrying once")),
    run.logs.join(" | ")
  );
  check(
    "the second failure is logged as a FAIL with no response",
    run.logs.some((line) => line.includes("silent") && line.includes("retry also failed")),
    run.logs.join(" | ")
  );
}
{
  // Shape 2: the agent calls back every time with a parsed object missing a
  // required top-level field (here, `summary`).
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("malformed")] } });
  const badEveryTime = { findings: [], claims: [] };
  const run = await runWorkflow({ args, agents: { "lens:malformed": badEveryTime } });
  const entry = run.result?.perAgent?.[0];
  checkEqual("a persistently malformed response FAILs after a retry", entry?.dispatched, false);
  check("the retry was attempted for the malformed shape too", entry?.retried === true);
  check(
    "the malformed-field failure names the missing field",
    run.logs.some((line) => line.includes("malformed") && line.includes("summary")),
    run.logs.join(" | ")
  );
  check(
    "the second violation is logged as a FAIL with no response",
    run.logs.some((line) => line.includes("malformed") && line.includes("retry also failed")),
    run.logs.join(" | ")
  );
}

// ── Group: machine facts ───────────────────────────────────────────────
console.log("\nmachine facts");

{
  // A lens with facts gets them rendered into its prompt; a lens without gets no block. The whole
  // point is per-lens: a fact is the deterministic half of ONE lens's subject, not round furniture.
  const args = baseArgs({
    round: 1,
    config: { agents: [lensEntry("docs"), lensEntry("craft")] },
    machineFacts: {
      docs: [
        { name: "docs-check", command: "python3 scripts/docs-check.py", exitCode: 1, output: "mechanism data-router changed without its doc" }
      ]
    }
  });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:docs": lensResponse({ agentName: "docs" }),
      "lens:craft": lensResponse({ agentName: "craft" })
    }
  });
  const docsPrompt = run.calls.find((c) => c.label === "lens:docs")?.prompt || "";
  const craftPrompt = run.calls.find((c) => c.label === "lens:craft")?.prompt || "";
  check("the docs lens sees its machine facts", docsPrompt.includes("Machine-verified facts"));
  check("the fact carries its command", docsPrompt.includes("python3 scripts/docs-check.py"));
  check("a non-zero exit renders as FAIL with the code", docsPrompt.includes("FAIL (exit 1)"));
  check("the fact's output is in the prompt", docsPrompt.includes("mechanism data-router changed without its doc"));
  check("the prompt forbids re-running the command", docsPrompt.includes("do not re-run these commands"));
  check("a lens with no facts gets no block", !craftPrompt.includes("Machine-verified facts"));
}

{
  // Backwards compatibility: an older /review passes no machineFacts at all. No block, no crash.
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({ args, agents: { "lens:solo": lensResponse({ agentName: "solo" }) } });
  check("no machineFacts key → no exception", run.error === null, String(run.error));
  const prompt = run.calls.find((c) => c.label === "lens:solo")?.prompt || "";
  check("no machineFacts key → no facts block", !prompt.includes("Machine-verified facts"));
}

{
  // A zero exit renders as PASS — the lens cites it instead of re-proving it.
  const args = baseArgs({
    round: 1,
    config: { agents: [lensEntry("docs")] },
    machineFacts: { docs: [{ name: "docs-check", command: "python3 scripts/docs-check.py", exitCode: 0, output: "" }] }
  });
  const run = await runWorkflow({ args, agents: { "lens:docs": lensResponse({ agentName: "docs" }) } });
  const prompt = run.calls.find((c) => c.label === "lens:docs")?.prompt || "";
  check("a zero exit renders as PASS", prompt.includes("docs-check — PASS"));
  check("empty output says so rather than fencing nothing", prompt.includes("(no output)"));
}

// ── Group: uniqueness ─────────────────────────────────────────────────
console.log("\nuniqueness");

{
  // Two lenses at the same location → neither is unique there; a lens alone at its location is.
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("alpha"), lensEntry("beta")], evidenceCritic: false } });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:alpha": lensResponse({ agentName: "alpha", findings: [
        finding({ where: "src/shared.ts:5" }),
        finding({ where: "src/only-alpha.ts:9" })
      ], score: 8, verdict: "PASS" }),
      "lens:beta": lensResponse({ agentName: "beta", findings: [
        finding({ where: "src/shared.ts:5" })
      ], score: 9, verdict: "PASS" })
    }
  });
  const alpha = run.result?.perAgent?.find((e) => e.name === "alpha");
  const beta = run.result?.perAgent?.find((e) => e.name === "beta");
  checkEqual("alpha: one of two findings is unique", alpha?.findingsUnique, 1);
  checkEqual("alpha: total is two", alpha?.findingsTotal, 2);
  checkEqual("beta: its only finding is shared, zero unique", beta?.findingsUnique, 0);
  check("the report carries the uniqueness line", (run.result?.report || "").includes("uniqueness: alpha 1/2 unique"));
}

// ── Group: evidence critic ───────────────────────────────────────────
console.log("\nevidence critic");

{
  // A refuted finding is demoted to advisory with the reason attached; the score recovers.
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:solo": lensResponse({ agentName: "solo", findings: [finding({ severity: "major", where: "src/x.ts:1", scenario: "the wrong value reaches src/consumer.ts and renders there" })], score: 7, verdict: "PASS" }),
      "critic:solo:0": { verdict: "refuted", reason: "the cited function does not exist in the diff" }
    }
  });
  const entry = run.result?.perAgent?.[0];
  const f = entry?.findings?.[0];
  checkEqual("the refuted finding is now advisory", f?.severity, "advisory");
  check("the critic's reason rides on the finding", f?.refuted?.reason?.includes("does not exist"));
  checkEqual("the demoted finding no longer moves the score", entry?.score, 10);
  check("the report counts the refutation", (run.result?.report || "").includes("refuted by the evidence critic: 1"));
}

{
  // A confirmed finding is untouched, and an advisory is never sent to the critic.
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")] } });
  const run = await runWorkflow({
    args,
    agents: {
      "lens:solo": lensResponse({ agentName: "solo", findings: [
        finding({ severity: "major", where: "src/x.ts:1", scenario: "the wrong value reaches src/consumer.ts and renders there" }),
        finding({ severity: "advisory", where: "src/y.ts:2" })
      ], score: 7, verdict: "PASS" }),
      "critic:solo:0": { verdict: "confirmed", reason: "holds against the diff" }
    }
  });
  const entry = run.result?.perAgent?.[0];
  checkEqual("a confirmed major stays a major", entry?.findings?.[0]?.severity, "major");
  const criticCalls = run.calls.filter((c) => c.label.startsWith("critic:"));
  checkEqual("only the score-moving finding got a critic, not the advisory", criticCalls.length, 1);
}

{
  // The kill-switch: evidenceCritic false → no critic wave at all.
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")], evidenceCritic: false } });
  const run = await runWorkflow({
    args,
    agents: { "lens:solo": lensResponse({ agentName: "solo", findings: [finding({ severity: "major", scenario: "the wrong value reaches src/consumer.ts and renders there" })], score: 7, verdict: "PASS" }) }
  });
  const criticCalls = run.calls.filter((c) => c.label.startsWith("critic:"));
  checkEqual("evidenceCritic:false sends nothing to the critic", criticCalls.length, 0);
  checkEqual("the finding stands as reported", run.result?.perAgent?.[0]?.findings?.[0]?.severity, "major");
}

// ── Group: fix verification ──────────────────────────────────────────
console.log("\nfix verification");

{
  // A re-dispatched failed lens gets its own prior findings and the narrowing instruction;
  // a full round gets neither.
  const priorFinding = finding({ severity: "major", where: "src/prior.ts:7", problem: "the prior problem" });
  const args = baseArgs({
    round: 2,
    config: { agents: [lensEntry("solo")], evidenceCritic: false },
    priorPerAgent: [{ name: "solo", verdict: "FAIL", score: 7, findings: [priorFinding] }]
  });
  const run = await runWorkflow({ args, agents: { "lens:solo": lensResponse({ agentName: "solo" }) } });
  const prompt = run.calls.find((c) => c.label === "lens:solo")?.prompt || "";
  check("the delta prompt says this is fix verification", prompt.includes("Fix verification"));
  check("the lens sees its own prior finding", prompt.includes("src/prior.ts:7"));
  check("the narrowing instruction is present", prompt.includes("needs NEW evidence to fail now"));
}

{
  const args = baseArgs({ round: 1, config: { agents: [lensEntry("solo")], evidenceCritic: false }, priorPerAgent: null });
  const run = await runWorkflow({ args, agents: { "lens:solo": lensResponse({ agentName: "solo" }) } });
  const prompt = run.calls.find((c) => c.label === "lens:solo")?.prompt || "";
  check("a full round carries no fix-verification block", !prompt.includes("Fix verification"));
}

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
