// Review Workflow
//
// Dispatch → Reconcile → Untouched set → Score → Round rules → Gate →
// Below-floor notice.
//
// This script performs no I/O of any kind. Everything it needs arrives in
// `args`; everything it produces leaves through the returned value. The
// command that calls this workflow resolves the base, the diff hash, the
// per-file line counts and the loaded config, hands them in, and is the
// only step in the system that writes anything to disk or attests a run.

export const meta = {
  name: "review-workflow",
  description:
    "Dispatch the review lenses with a forced schema, reconcile findings, score rounds, and check the gate",
  phases: [
    {
      title: "Dispatch",
      detail: "Run every enabled lens in parallel against the forced schema"
    },
    {
      title: "Reconcile",
      detail: "Group findings by location and mark disputes"
    },
    {
      title: "Untouched set",
      detail: "Report the changed files no lens claimed"
    },
    { title: "Score", detail: "Recompute each lens's score from its findings" },
    {
      title: "Round rules",
      detail: "Apply the Minor floor and the three-Major ceiling from round 3"
    },
    {
      title: "Gate",
      detail: "Check the eight acceptance criteria against this run's own output"
    },
    {
      title: "Below-floor notice",
      detail: "Flag a config still carrying a retired shape"
    }
  ]
};

const parsedArgs = typeof args === "string" ? JSON.parse(args) : args;
const { base, hash, round, changedFiles, diffPath, config, agentsDir, priorPerAgent } =
  parsedArgs;

const changedFileList = Array.isArray(changedFiles) ? changedFiles : [];
const configAgents = Array.isArray(config?.agents) ? config.agents : [];
const persona = config?.persona || "";

// ── The forced response schema ──────────────────────────────────────
// One object, passed to every dispatched lens unchanged. `evidence` is
// spelled the same for all five so the forced schema stays a single
// JSON-Schema literal rather than one shape per lens.
const LENS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["blocker", "major", "minor", "advisory"]
          },
          why_this_severity: { type: "string" },
          where: { type: "string" },
          occurrences: { type: "number" },
          problem: { type: "string" },
          scenario: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["high", "low"] },
          evidence: { type: "string" }
        },
        required: [
          "severity",
          "why_this_severity",
          "where",
          "problem",
          "scenario",
          "confidence",
          "evidence"
        ]
      }
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          disposition: { type: "string", enum: ["judged", "declined"] },
          reason: { type: "string" }
        },
        required: ["path", "disposition"],
        if: { properties: { disposition: { const: "declined" } } },
        then: { required: ["path", "disposition", "reason"] }
      }
    },
    summary: {
      type: "object",
      properties: {
        agent: { type: "string" },
        verdict: { type: "string", enum: ["PASS", "FAIL"] },
        score: { type: "number" },
        counts: {
          type: "object",
          properties: {
            blocker: { type: "number" },
            major: { type: "number" },
            minor: { type: "number" },
            advisory: { type: "number" }
          },
          required: ["blocker", "major", "minor", "advisory"]
        },
        one_line: { type: "string" }
      },
      required: ["agent", "verdict", "score", "counts", "one_line"]
    }
  },
  required: ["findings", "claims", "summary"]
};

// A response is well-formed enough to score once its three top-level arrays
// and its summary object are present. Anything narrower than that is left
// for the eight gate criteria, which read the raw findings themselves.
function missingLensFields(result) {
  if (result === null || result === undefined) {
    return ["findings", "claims", "summary"];
  }
  const missing = [];
  if (!Array.isArray(result.findings)) missing.push("findings");
  if (!Array.isArray(result.claims)) missing.push("claims");
  if (!result.summary || typeof result.summary !== "object")
    missing.push("summary");
  return missing;
}

// The house withRetry shape retries on a thrown error. That alone lets a
// quietly skipped structured call through untouched: an unstubbed lens
// settles to null and never throws. So this version inspects the settled
// value itself and throws on null or a missing required key, which is what
// puts a raised exception and a silently absent result on the same retried
// path, and the reason a second consecutive failure still reaches the catch
// below rather than sailing through as an empty pass.
async function withRetry(label, fn) {
  async function callAndValidate() {
    const result = await fn();
    const missing = missingLensFields(result);
    if (missing.length > 0) {
      throw new Error(
        `${label}: missing or malformed ${missing.join(", ") || "structured result"}`
      );
    }
    return result;
  }
  try {
    const result = await callAndValidate();
    return { result, retried: false };
  } catch (firstFailure) {
    log(
      `${label}: ${String(firstFailure).slice(0, 100)} — retrying once, naming the broken field`
    );
    try {
      const result = await callAndValidate();
      return { result, retried: true };
    } catch (secondFailure) {
      log(`${label}: retry also failed — this lens FAILs with no response`);
      return { result: null, retried: true };
    }
  }
}

// Every dispatched lens reads its own agent file for its Subject, Duty and
// severity questionnaire — the same pass-a-path idiom used for the diff
// below, so this script never carries five lenses' worth of prose. The
// forced schema is what actually holds the lens to contract; the file only
// tells it what to judge.
// The ABSOLUTE path to a lens's contract, from the `agentsDir` /review resolved. The fallback is the
// old relative form, kept only so an older /review still dispatches — but it is the defect this key
// closes, so it is named as one in the prompt rather than passed off as fine.
//
// Why the script cannot resolve this itself: it reads nothing, by design, and a directory probe is a
// read. Only the caller knows which of the two plugin layouts won.
function lensAgentFilePath(entry) {
  // Trimmed BEFORE the trailing-slash strip, and by the same test `contractPathIsAGuess` uses — a
  // whitespace-only value once produced "   /review-docs.md" here while the flag correctly called it
  // a guess, so the prompt and the path disagreed about the same input.
  const dir = typeof agentsDir === "string" ? agentsDir.trim().replace(/\/+$/, "") : "";
  return dir
    ? `${dir}/review-${entry.name}.md`
    : `plugins/review/agents/review-${entry.name}.md`;
}

// True when the caller gave us nothing to build an absolute path from. The lens is told, in that case,
// that its path is a guess — because a lens that silently fails to find its contract judges anyway,
// and a judgment with no contract behind it came back as PASS 10 in a measured round.
const contractPathIsAGuess = !(typeof agentsDir === "string" && agentsDir.trim());

function lensPrompt(entry) {
  const changedList =
    changedFileList
      .map((file) => `- ${file.path} (+${file.added || 0}/-${file.removed || 0})`)
      .join("\n") || "(none reported)";
  return `You are the ${entry.name} review lens.

Read your full instructions from \`${lensAgentFilePath(entry)}\` first — its Subject, Duty and severity questionnaire are what govern your judgment here. That path is absolute and exact${contractPathIsAGuess ? ", EXCEPT that this caller passed no `agentsDir`, so it is a guess relative to a working directory that is the project repository — expect it to be wrong" : ""}.

**If you cannot read that file, stop and return a FAIL.** Put one blocker in \`findings\` whose \`problem\` is that your contract was unreadable, with the path you tried as \`evidence\`, and set \`summary.verdict\` to "FAIL". Do NOT go looking for it elsewhere, and do NOT judge the diff without it: a copy you find by searching may be a different edition of the rules, and a verdict reached with no contract at all is indistinguishable from a real pass. Both have happened — three lenses in one round hunted for their own contract and landed in three different places, one of which did not exist. This call is what forces your response onto the schema; follow the file's Subject and Duty exactly, and claim or decline every changed file you looked at. A file you say nothing about is read as pass.

## Diff
The full diff is at: \`${diffPath}\`
Base: \`${base}\`
Round: ${round}

## Changed files
${changedList}

## Your config
- threshold: ${entry.threshold}
- skills: ${JSON.stringify(entry.skills || [])}
- rules: ${JSON.stringify(entry.rules || [])}
- pairedDocs: ${JSON.stringify(entry.pairedDocs || {})}
- extensionSkill: ${entry.extensionSkill || "(none)"}
- persona: ${persona || "(none)"}

Return your verdict against the forced response schema.`;
}

// ── Phase 1: Dispatch ────────────────────────────────────────────────
phase("Dispatch");

// Enabled means `enabled !== false`, not `enabled === true` — an agent with
// no `enabled` field at all is dispatched, because that is exactly the
// shape of a freshly appended, not-yet-wired agent.
const enabledSet = configAgents.filter((entry) => entry?.enabled !== false);

// ── DELTA DISPATCH ────────────────────────────────────────────────────
// When `priorPerAgent` names verdicts from an earlier round, dispatch ONLY the
// lenses that failed it. The ones that passed are carried forward PROVISIONALLY
// and the gate below refuses to attest while any of them is — so this buys cheap
// iteration without ever attesting a mix of runs.
//
// Measured, which is why it exists: a five-lens round costs ~820k subagent
// tokens. Three rounds where one lens failed each time spent 2.4M re-judging
// four lenses that had already passed. Driving one lens to green at a time and
// then paying for ONE full round is the same guarantee at a fifth of the price.
//
// A lens absent from `priorPerAgent` is dispatched — a config that gained a lens
// between rounds must not have it carried as passing.
const priorByName = new Map(
  (Array.isArray(priorPerAgent) ? priorPerAgent : [])
    .filter((entry) => entry && typeof entry.name === "string")
    .map((entry) => [entry.name, entry])
);
const isDelta = priorByName.size > 0;

const dispatchSet = isDelta
  ? enabledSet.filter((entry) => (priorByName.get(entry.name)?.verdict ?? "FAIL") !== "PASS")
  : enabledSet;
const carrySet = isDelta
  ? enabledSet.filter((entry) => (priorByName.get(entry.name)?.verdict ?? "FAIL") === "PASS")
  : [];

log(
  dispatchSet.length > 0
    ? `Dispatching ${dispatchSet.length} lens(es): ${dispatchSet.map((entry) => entry.name).join(", ")}` +
        (carrySet.length > 0
          ? ` — carrying ${carrySet.length} provisionally: ${carrySet.map((entry) => entry.name).join(", ")}`
          : "")
    : "No enabled lens in config — nothing to dispatch"
);
if (carrySet.length > 0) {
  log("A carried verdict CANNOT be attested — one full round is still owed before the gate can open.");
}

async function dispatchLens(entry) {
  const label = `lens:${entry.name}`;
  const { result, retried } = await withRetry(label, () =>
    agent(lensPrompt(entry), {
      label,
      phase: "Dispatch",
      schema: LENS_RESPONSE_SCHEMA,
      // Work tier, and stated rather than inherited. A lens reads a diff and judges it, which is
      // squarely mid-tier work — no lens synthesises across the others, so none earns the head tier.
      // Leaving this out is not a neutral default: an omitted model inherits the session model, and
      // one review multiplies that by the lens count. A PreToolUse guard rejects the omission outright.
      model: "sonnet"
    })
  );
  return {
    name: entry.name,
    entry,
    response: result,
    dispatched: result !== null,
    retried
  };
}

const dispatchResults = await parallel(
  dispatchSet.map((entry) => () => dispatchLens(entry))
);

// A carried lens produces the same shape as a dispatched one, flagged so the gate
// and the report can tell them apart. Its findings are NOT carried: they belong to
// the diff that produced them, and that diff has moved.
const carriedResults = carrySet.map((entry) => {
  const prior = priorByName.get(entry.name);
  return {
    name: entry.name,
    entry,
    response: { findings: [], claims: [], summary: "" },
    dispatched: false,
    carried: true,
    carriedScore: Number(prior?.score ?? 0),
    retried: false
  };
});

// ── Phase 2: Reconcile ───────────────────────────────────────────────
// Group every finding by `where`, across every dispatched lens. Nothing is
// discarded. A location two lenses reach opposite conclusions on is marked
// disputed on every finding at that location.
phase("Reconcile");

function whereKey(finding) {
  return finding?.where || "(unspecified)";
}

const findingsByWhere = new Map();
for (const entry of dispatchResults) {
  const findings = Array.isArray(entry.response?.findings)
    ? entry.response.findings
    : [];
  for (const finding of findings) {
    const key = whereKey(finding);
    if (!findingsByWhere.has(key)) findingsByWhere.set(key, []);
    findingsByWhere.get(key).push({ lens: entry.name, finding });
  }
}

const disputedWhere = new Set();
for (const [key, group] of findingsByWhere) {
  const severities = new Set(group.map((item) => item.finding.severity));
  if (group.length > 1 && severities.size > 1) disputedWhere.add(key);
}

function isDisputed(finding) {
  return disputedWhere.has(whereKey(finding));
}

// ── Phase 3: Untouched set ───────────────────────────────────────────
// The changed files no lens claimed, subtracted from `changedFiles`. Line
// counts come straight off the args the caller already resolved — this
// script computes no line count of its own. Never a gate criterion: it is
// an offer, not a block.
phase("Untouched set");

const claimedPaths = new Set();
for (const entry of dispatchResults) {
  const claims = Array.isArray(entry.response?.claims)
    ? entry.response.claims
    : [];
  for (const claim of claims) {
    if (claim?.path) claimedPaths.add(claim.path);
  }
}

function lineCount(file) {
  return (Number(file?.added) || 0) + (Number(file?.removed) || 0);
}

const totalLines = changedFileList.reduce(
  (sum, file) => sum + lineCount(file),
  0
);
const untouchedFiles = changedFileList.filter(
  (file) => !claimedPaths.has(file.path)
);
const untouchedLines = untouchedFiles.reduce(
  (sum, file) => sum + lineCount(file),
  0
);

function directoryOf(path) {
  const parts = String(path).split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "(repository root)";
}

// Ranked by share of the diff in lines, folded to one row per directory.
const untouchedByDirectory = new Map();
for (const file of untouchedFiles) {
  const directory = directoryOf(file.path);
  if (!untouchedByDirectory.has(directory)) {
    untouchedByDirectory.set(directory, { files: 0, lines: 0 });
  }
  const bucket = untouchedByDirectory.get(directory);
  bucket.files += 1;
  bucket.lines += lineCount(file);
}
const rankedUntouched = Array.from(untouchedByDirectory.entries())
  .map(([directory, bucket]) => ({
    directory,
    files: bucket.files,
    lines: bucket.lines
  }))
  .sort((a, b) => b.lines - a.lines);

// By name, at the repository root or under `.claude/`, however few lines
// they hold — a two-line config file never rises to the top of a list
// ranked by weight, so it gets a section of its own.
function isSurfacePath(path) {
  const value = String(path);
  return !value.includes("/") || value.startsWith(".claude/");
}
const surfaceUntouched = untouchedFiles
  .filter((file) => isSurfacePath(file.path))
  .map((file) => file.path);

function renderUntouchedReport() {
  if (changedFileList.length === 0) {
    return "untouched: (no changed files reported)";
  }
  const percent =
    totalLines > 0 ? Math.round((untouchedLines / totalLines) * 100) : 0;
  const header = `untouched: ${percent}% of the diff (${untouchedFiles.length} files, ${untouchedLines} of ${totalLines} lines)`;
  const ranked =
    rankedUntouched.length > 0
      ? rankedUntouched
          .map((row) => `  ${row.directory}   ${row.lines} lines   ${row.files} files`)
          .join("\n")
      : "  (nothing untouched)";
  const surface =
    surfaceUntouched.length > 0
      ? `at the repository root or under .claude/:\n${surfaceUntouched.map((path) => `  ${path}`).join("\n")}`
      : "at the repository root or under .claude/: (none)";
  return `${header}\n${ranked}\nuntouched ${surface}`;
}

// ── Phase 4: Score ───────────────────────────────────────────────────
// Every lens score is recomputed from its findings, never taken from what
// it wrote into its own summary. `countedMinor` is every minor in rounds 1
// and 2 and zero from round 3 on — the term phase 5 and the gate both
// reference, stated once here.
phase("Score");

function fileOf(where) {
  const value = String(where || "");
  return value.split(":")[0].trim();
}

// Criterion 4's mechanical form of severity question 6: a scenario naming
// no path other than the one it was found in describes a consequence that
// stays inside that file, which the questionnaire scores as minor, not
// major, however the lens labelled it.
const OTHER_PATH_PATTERN = /[\w./-]+\.[A-Za-z0-9]+/g;
function scenarioNamesAnotherFile(finding) {
  const home = fileOf(finding.where);
  const scenario = String(finding.scenario || "");
  const mentioned = scenario.match(OTHER_PATH_PATTERN) || [];
  return mentioned.some(
    (path) => path !== home && !home.endsWith(path) && !path.endsWith(home)
  );
}

function countedMinorFor(minorCount) {
  return round < 3 ? minorCount : 0;
}

function scoreFromCounts(counts) {
  const countedMinor = countedMinorFor(counts.minor);
  return 10 - 20 * counts.blocker - 3 * counts.major - 1 * countedMinor;
}

function countBySeverity(findings) {
  const counts = { blocker: 0, major: 0, minor: 0, advisory: 0 };
  for (const finding of findings) {
    if (Object.prototype.hasOwnProperty.call(counts, finding.severity)) {
      counts[finding.severity] += 1;
    }
  }
  return counts;
}

function scoreLens(entry) {
  // Carried: not re-judged this round, so it keeps its prior score and its prior
  // PASS. It is NOT evidence for an attestation — the gate checks `carried` itself.
  if (entry.carried) {
    return {
      name: entry.name,
      dispatched: false,
      carried: true,
      retried: false,
      threshold: Number(entry.entry?.threshold ?? 0),
      findings: [],
      claims: [],
      demotions: [],
      counts: { blocker: 0, major: 0, minor: 0, advisory: 0 },
      score: entry.carriedScore,
      reportedScore: entry.carriedScore,
      verdict: "PASS",
      oneLine: "carried from the previous round — not re-judged, and not attestable"
    };
  }
  if (!entry.dispatched) {
    return {
      name: entry.name,
      dispatched: false,
      retried: entry.retried,
      threshold: Number(entry.entry?.threshold ?? 0),
      findings: [],
      claims: [],
      demotions: [],
      counts: { blocker: 0, major: 0, minor: 0, advisory: 0 },
      score: null,
      reportedScore: null,
      verdict: "FAIL",
      oneLine: "not dispatched — no response from this run"
    };
  }
  const rawFindings = Array.isArray(entry.response.findings)
    ? entry.response.findings
    : [];
  const demotions = [];
  const findings = rawFindings.map((finding) => {
    const decorated = { ...finding, disputed: isDisputed(finding) };
    if (decorated.severity === "major" && !scenarioNamesAnotherFile(decorated)) {
      demotions.push({ where: decorated.where, from: "major", to: "minor" });
      decorated.severity = "minor";
    }
    return decorated;
  });
  const claims = Array.isArray(entry.response.claims) ? entry.response.claims : [];
  const counts = countBySeverity(findings);
  const score = scoreFromCounts(counts);
  // The lens's own claimed score, kept alongside the recomputed one. Criterion
  // 5 checks this raw value: `score` above is always exactly consistent with
  // `counts` by construction (it is derived from the same findings), so a
  // check against it could never independently fail. `reportedScore` is what
  // makes "a lens scoring below 10 with no findings" a checkable claim at all.
  const reportedScore =
    typeof entry.response.summary?.score === "number" ? entry.response.summary.score : null;
  const threshold = Number(entry.entry?.threshold ?? 0);
  const verdict = score >= threshold ? "PASS" : "FAIL";
  return {
    name: entry.name,
    dispatched: true,
    retried: entry.retried,
    threshold,
    findings,
    claims,
    demotions,
    counts,
    score,
    reportedScore,
    verdict,
    oneLine: entry.response.summary?.one_line || ""
  };
}

// Carried entries join the scored set in config order, so the results table reads
// the same whether a round was full or delta.
const allResults = [...dispatchResults, ...carriedResults].sort(
  (a, b) =>
    enabledSet.findIndex((e) => e.name === a.name) - enabledSet.findIndex((e) => e.name === b.name)
);
const scoredAgents = allResults.map((entry) => scoreLens(entry));

// ── Phase 5: Round rules ─────────────────────────────────────────────
// Rounds 1 and 2 open on a Blocker, a Major, or a Minor. From round 3 a
// Minor deducts nothing (already folded into `countedMinorFor` above) and
// re-opens nothing; only a Blocker or a Major still does, and at most three
// Majors carry into the fix round — the rest are reported and filed as
// deferred-this-round, never dropped.
phase("Round rules");

function reachScore(finding) {
  const home = fileOf(finding.where);
  const scenario = String(finding.scenario || "");
  const mentioned = new Set(
    (scenario.match(OTHER_PATH_PATTERN) || []).filter((path) => path !== home)
  );
  return mentioned.size;
}

function applyRoundRules(scored) {
  const majors = scored.findings.filter((finding) => finding.severity === "major");
  const minors = scored.findings.filter((finding) => finding.severity === "minor");
  let carriedMajors = majors;
  let deferredMajors = [];
  if (round >= 3 && majors.length > 3) {
    const ranked = [...majors].sort((a, b) => reachScore(b) - reachScore(a));
    carriedMajors = ranked.slice(0, 3);
    deferredMajors = ranked.slice(3);
  }
  const deferredMinors = round >= 3 ? minors : [];
  const reopensRound =
    round < 3
      ? scored.counts.blocker > 0 || scored.counts.major > 0 || scored.counts.minor > 0
      : scored.counts.blocker > 0 || majors.length > 0;
  return { ...scored, carriedMajors, deferredMajors, deferredMinors, reopensRound };
}

const roundAdjustedAgents = scoredAgents.map((scored) => applyRoundRules(scored));

// ── Report assembly ──────────────────────────────────────────────────
// Built ahead of the gate because criterion 8 checks that this text is what
// carries the disputed pairs and the deferred Minors forward, not a claim
// made about the text.

function priorEntryFor(name) {
  if (Array.isArray(priorPerAgent)) {
    return priorPerAgent.find((entry) => entry?.name === name) || null;
  }
  if (priorPerAgent && typeof priorPerAgent === "object") {
    return priorPerAgent[name] || null;
  }
  return null;
}

function movementNote(entry) {
  const prior = priorEntryFor(entry.name);
  if (!prior || typeof prior.score !== "number" || entry.score === null) {
    return null;
  }
  const delta = entry.score - prior.score;
  if (delta === 0) return `unchanged since round ${round - 1} (score ${prior.score})`;
  return `${delta > 0 ? "up" : "down"} from ${prior.score} in round ${round - 1}`;
}

function renderReport(agents) {
  const lines = [];
  lines.push(`Round ${round} — base ${base} — diff ${hash}`);
  for (const entry of agents) {
    if (!entry.dispatched) {
      lines.push(`- ${entry.name}: NOT DISPATCHED — no response from this run (FAIL)`);
      continue;
    }
    lines.push(
      `- ${entry.name}: score ${entry.score} (threshold ${entry.threshold}) — ${entry.verdict}`
    );
    if (entry.oneLine) lines.push(`  ${entry.oneLine}`);
    const movement = movementNote(entry);
    if (movement) lines.push(`  ${movement}`);
    for (const demotion of entry.demotions) {
      lines.push(
        `  demoted ${demotion.from} to ${demotion.to} at ${demotion.where} — its scenario names no consequence leaving the file`
      );
    }
    for (const finding of entry.deferredMajors) {
      lines.push(`  deferred-this-round major at ${finding.where}: ${finding.problem}`);
    }
    for (const finding of entry.deferredMinors) {
      lines.push(`  deferred-this-round minor at ${finding.where}: ${finding.problem}`);
    }
  }
  if (disputedWhere.size > 0) {
    lines.push("Disputed:");
    for (const key of disputedWhere) {
      const group = findingsByWhere.get(key) || [];
      const byLens = group.map((item) => `${item.lens}=${item.finding.severity}`).join(", ");
      lines.push(`  ${key}: ${byLens}`);
    }
  } else {
    lines.push("Disputed: (none)");
  }
  lines.push(renderUntouchedReport());
  return lines.join("\n");
}

const preliminaryReport = renderReport(roundAdjustedAgents);

// ── Phase 6: Gate ─────────────────────────────────────────────────────
// The eight acceptance criteria, checked in order over this run's own
// output. The first refusal wins, with one exception: criterion 1 looks
// only at a lens that returned a response this run, so a lens with none is
// left for criterion 7 alone.
phase("Gate");

// Criterion 1 — every response parsed against the forced schema without a
// retry. Scoped to dispatched lenses: an undispatched lens is criterion 7's
// alone, never criterion 1's.
function checkCriterion1(agents) {
  const violator = agents.find((entry) => entry.dispatched && entry.retried);
  return violator
    ? `criterion 1: ${violator.name} needed a retry before it parsed against the forced schema`
    : null;
}

// Criterion 2 — every severity and confidence value is from its enum; no
// free text in either.
const SEVERITY_ENUM = new Set(["blocker", "major", "minor", "advisory"]);
const CONFIDENCE_ENUM = new Set(["high", "low"]);
function checkCriterion2(agents) {
  for (const entry of agents) {
    for (const finding of entry.findings) {
      if (!SEVERITY_ENUM.has(finding.severity)) {
        return `criterion 2: ${entry.name} reported severity "${finding.severity}" outside its enum`;
      }
      if (!CONFIDENCE_ENUM.has(finding.confidence)) {
        return `criterion 2: ${entry.name} reported confidence "${finding.confidence}" outside its enum`;
      }
    }
  }
  return null;
}

// Criterion 3 — every major and every minor carries a non-empty scenario.
function checkCriterion3(agents) {
  for (const entry of agents) {
    for (const finding of entry.findings) {
      const needsScenario = finding.severity === "major" || finding.severity === "minor";
      const emptyScenario =
        finding.scenario === null ||
        finding.scenario === undefined ||
        String(finding.scenario).trim() === "";
      if (needsScenario && emptyScenario) {
        return `criterion 3: ${entry.name} reported a ${finding.severity} at ${finding.where} with no scenario`;
      }
    }
  }
  return null;
}

// Criterion 4 — no major whose scenario names a consequence that never
// leaves the file it was found in. Phase 4 already demoted every such
// finding to minor, so this is a defensive re-check of that invariant
// rather than a first pass over it.
function checkCriterion4(agents) {
  for (const entry of agents) {
    for (const finding of entry.findings) {
      if (finding.severity === "major" && !scenarioNamesAnotherFile(finding)) {
        return `criterion 4: ${entry.name} left a major at ${finding.where} whose scenario never leaves its file`;
      }
    }
  }
  return null;
}

// Criterion 5 — every deducted point has a matching finding; a lens scoring
// below 10 with no findings is rejected. This reads the lens's own reported
// score (`reportedScore`), not the score this script recomputes: the
// recomputed score is derived from the same findings list this check counts,
// so it is always exactly 10 when that list is empty — a check against it
// could never fire. `reportedScore` is the one value that can disagree with
// an empty findings list, which is the disagreement this criterion exists to
// catch.
function checkCriterion5(agents) {
  for (const entry of agents) {
    if (
      entry.dispatched &&
      entry.reportedScore !== null &&
      entry.reportedScore < 10 &&
      entry.findings.length === 0
    ) {
      return `criterion 5: ${entry.name} reported score ${entry.reportedScore} with no findings to support it`;
    }
  }
  return null;
}

// Criterion 6 — every score equals the round-aware formula, recomputed
// here rather than trusted from the lens: 10 minus 20 times blocker minus
// 3 times major minus 1 times countedMinor, where countedMinor is every
// minor in rounds 1 and 2 and zero from round 3 on.
function checkCriterion6(agents) {
  for (const entry of agents) {
    if (!entry.dispatched) continue;
    const expected = scoreFromCounts(entry.counts);
    if (entry.score !== expected) {
      return `criterion 6: ${entry.name} scored ${entry.score}, expected ${expected} from its findings`;
    }
  }
  return null;
}

// Criterion 7 — a lens that was ASKED and did not answer. That is an output-honesty
// failure: perAgent would carry a verdict no agent produced.
//
// A CARRIED entry is not that, and must not be reported as it. It was deliberately not
// dispatched, the delta round says so in its own log and report, and the separate
// `carried` check on the gate is what refuses the attestation — with a message that
// tells the reader to run one full round, rather than one that reads as a malfunction.
// Conflating the two made every delta round refuse as "has no response from this run",
// which is the wrong diagnosis of a working feature.
function checkCriterion7(agents) {
  const missing = agents.find((entry) => !entry.dispatched && entry.carried !== true);
  return missing ? `criterion 7: ${missing.name} has no response from this run` : null;
}

// Criterion 8 — every disputed pair and every Minor deferred after round 2
// appears in the report, never dropped.
function checkCriterion8(agents, reportText) {
  for (const entry of agents) {
    for (const finding of entry.deferredMinors) {
      if (!reportText.includes(whereKey(finding))) {
        return `criterion 8: ${entry.name}'s deferred minor at ${finding.where} is missing from the report`;
      }
    }
  }
  for (const key of disputedWhere) {
    if (!reportText.includes(key)) {
      return `criterion 8: the disputed location ${key} is missing from the report`;
    }
  }
  return null;
}

const GATE_CHECKS = [
  { number: 1, check: () => checkCriterion1(roundAdjustedAgents) },
  { number: 2, check: () => checkCriterion2(roundAdjustedAgents) },
  { number: 3, check: () => checkCriterion3(roundAdjustedAgents) },
  { number: 4, check: () => checkCriterion4(roundAdjustedAgents) },
  { number: 5, check: () => checkCriterion5(roundAdjustedAgents) },
  { number: 6, check: () => checkCriterion6(roundAdjustedAgents) },
  { number: 7, check: () => checkCriterion7(roundAdjustedAgents) },
  { number: 8, check: () => checkCriterion8(roundAdjustedAgents, preliminaryReport) }
];

let refusedCriterion = null;
let refusalReason = null;
for (const gateCheck of GATE_CHECKS) {
  const reason = gateCheck.check();
  if (reason) {
    refusedCriterion = gateCheck.number;
    refusalReason = reason;
    break;
  }
}

// The eight criteria ask whether the run's own output is honest and well
// formed. Whether the CHANGE passes review is the prior question, and it is
// answered by the lens verdicts alone. Conflating the two is how a run with a
// failing lens attested: every criterion held, because a blocker reported in
// the correct shape violates none of them. Both gates must open.
const failedLenses = roundAdjustedAgents
  .filter((entry) => entry.verdict !== "PASS")
  .map((entry) => ({
    name: entry.name,
    score: entry.score,
    threshold: entry.threshold,
    blockers: entry.counts?.blocker || 0
  }));

// A carried lens was not judged against THIS diff, so a round holding one is not a
// full run and cannot be attested however green it looks. This is the other half of
// the delta dispatch: cheap rounds are allowed, cheap attestations are not.
const carriedNames = roundAdjustedAgents.filter((entry) => entry.carried).map((entry) => entry.name);
const attest =
  failedLenses.length === 0 && refusedCriterion === null && carriedNames.length === 0;
if (carriedNames.length > 0 && failedLenses.length === 0 && refusedCriterion === null) {
  log(
    `Gate: every dispatched lens passed, but ${carriedNames.length} verdict(s) were CARRIED ` +
      `(${carriedNames.join(", ")}). Run once more with priorPerAgent omitted — a full round is ` +
      `what an attestation rests on.`
  );
}
if (failedLenses.length > 0) {
  const named = failedLenses
    .map((lens) => `${lens.name} ${lens.score}/${lens.threshold}${lens.blockers > 0 ? ` with ${lens.blockers} blocker(s)` : ""}`)
    .join(", ");
  log(`Gate: refused — lens verdict: ${named}`);
} else {
  log(refusedCriterion === null ? "Gate: all eight criteria satisfied" : `Gate: refused — ${refusalReason}`);
}

// ── Phase 7: Below-floor notice ──────────────────────────────────────
// A config still naming a retired lens, or still carrying the field this
// contract deletes, gets one line naming the stale entries and the
// migration. This is the only place in the file that names that field — a
// check for a key cannot avoid spelling the key.
phase("Below-floor notice");

const belowFloorEdits = "rename conventions to craft, delete the scavenger entry, delete every zones array, add review-workflow to enabledPlugins";
const belowFloorStale = configAgents.filter((agentConfig) => agentConfig?.name === "conventions" || agentConfig?.name === "scavenger" || "zones" in (agentConfig || {}));

function belowFloorNotice() {
  if (belowFloorStale.length === 0) return null;
  const staleNames = belowFloorStale
    .map((agentConfig) => agentConfig?.name || "(unnamed)")
    .join(", ");
  return `below-floor config: ${staleNames} still carries a retired shape — ${belowFloorEdits}.`;
}

const notice = belowFloorNotice();
if (notice) log(notice);

// A carried round says so IN the report, not only in the log — the report is what
// `/review` prints verbatim, and a reader who cannot see that four lenses were not
// re-judged would read a delta round as a full one.
const carriedNotice =
  carriedNames.length > 0
    ? `\n**CARRIED, NOT RE-JUDGED:** ${carriedNames.join(", ")}. This round dispatched only the ` +
      `lens(es) that failed the previous one. The carried verdicts are provisional and the gate ` +
      `refuses to attest while any of them is — run once more with \`priorPerAgent\` omitted, and ` +
      `that full round is the one an attestation can rest on.`
    : "";
const report =
  (notice ? `${preliminaryReport}\n${notice}` : preliminaryReport) + carriedNotice;

// ── Result ───────────────────────────────────────────────────────────

const perAgent = roundAdjustedAgents.map((entry) => ({
  name: entry.name,
  dispatched: entry.dispatched,
  // Travels back to `/review`, which hands it to the next round as `priorPerAgent`.
  // A carried entry must stay marked, or the next round would carry a carry and no
  // full run would ever happen.
  carried: entry.carried === true,
  retried: entry.retried,
  threshold: entry.threshold,
  score: entry.score,
  verdict: entry.verdict,
  counts: entry.counts,
  findings: entry.findings,
  claims: entry.claims,
  demotions: entry.demotions,
  deferredMajors: entry.deferredMajors,
  deferredMinors: entry.deferredMinors,
  reopensRound: entry.reopensRound,
  oneLine: entry.oneLine
}));

return {
  attest,
  refusedCriterion,
  failedLenses,
  perAgent,
  report
};
