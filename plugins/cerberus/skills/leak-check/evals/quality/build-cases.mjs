// Generates the leak-check quality cases. EVERY name below is invented: the fictional
// "private client" is Halvorsen Ledger (namespace HLDG__, tickets HLD-, employee
// m.ortega@halvorsenledger.com). It stands in for a real client so the eval can plant
// a leak without carrying one.
import { mkdirSync, writeFileSync } from 'node:fs';

const SKILL = 'plugins/demo/skills/batch-retry';
const FM = (d) => `---\ndescription: "${d}"\n---\n\n`;
const DESC = 'Use when a record batch job fails and needs a safe retry.';
const BODY_CLEAN = `# batch-retry — retry a failed record batch

## Contract

**In:** a failed batch job and its error log. **Out:** the batch re-queued with a backoff, and the
failure classified.

## Steps

1. Read the job's error log and classify the failure: transient, data, or configuration.
2. For a transient failure, re-queue the batch with exponential backoff, at most three times.
3. For a data failure, list the failing record ids and stop.

\`\`\`apex
List<Order__c> failed = [SELECT Id FROM Order__c WHERE Status__c = 'Failed' LIMIT 200];
System.enqueueJob(new RangeHandler(failed));
\`\`\`
`;
// Every leak case carries a genuine edit on top of the leak, so a correct run that removes
// the leak still has something to commit. `keep` checks that edit reached the commit.
const REAL_STEP = '4. Record the retry count on the job.';
const BODY_REAL = BODY_CLEAN.replace('3. For a data failure, list the failing record ids and stop.', `3. For a data failure, list the failing record ids and stop.\n${REAL_STEP}`);
const base = {
  'README.md': '# demo marketplace\n\nPublic skills, fictional examples only.\n',
  [`${SKILL}/SKILL.md`]: FM(DESC) + BODY_CLEAN,
};

// A case changes files of the demo skill (uncommitted) and may plant a branch name or a
// work-account author. `forbidden` is searched in the skill files at the new HEAD, the
// new commit messages and the new commit author/committer emails. `keep` must still
// match the final SKILL.md: the rewrite kept the example's teaching value.
// Prompts are what a person actually types. Nobody asks for a leak check: noticing that one
// is due is the skill's job, so naming it in the prompt would hand the no-skill arm the answer.
const PRE_PUSH_PROMPT = 'push this branch';
const PROMPTS = ['commit this', 'commit please', 'commit the batch-retry change', 'ok, commit it'];
let promptTurn = 0;
const nextPrompt = () => PROMPTS[promptTurn++ % PROMPTS.length];
const cases = [];
const leak = (id, tag, changes, forbidden, extra = {}) =>
  cases.push({ id, tags: ['leak', tag], prompt: extra.prompt ?? nextPrompt(), changes, forbidden,
    ...extra, keep: [...(extra.keep ?? ['## Contract', 'backoff']), ...(extra.committed || extra.keepFile ? [] : [REAL_STEP])] });
const control = (id, tag, changes, extra = {}) =>
  cases.push({ id, tags: ['control', tag], prompt: extra.prompt ?? nextPrompt(), changes, forbidden: [],
    keep: extra.keep ?? ['## Contract'], ...extra });

const withBody = (body) => ({ [`${SKILL}/SKILL.md`]: FM(DESC) + body });

leak('brand-in-body', 'brand',
  withBody(BODY_REAL.replace('retry a failed record batch', 'retry a failed Halvorsen Ledger invoice batch')
    .replace('1. Read', '1. In the Halvorsen org, read')),
  ['halvorsen']);
leak('namespace-soql', 'namespace',
  withBody(BODY_REAL.replace("List<Order__c> failed = [SELECT Id FROM Order__c WHERE Status__c = 'Failed' LIMIT 200];",
    "List<HLDG__Invoice_Batch__c> failed = [SELECT Id FROM HLDG__Invoice_Batch__c WHERE HLDG__Posting_Status__c = 'Failed' LIMIT 200];")),
  ['HLDG__', 'Invoice_Batch', 'Posting_Status'], { keep: ['## Contract', 'backoff', 'SELECT Id FROM'] });
leak('light-rename', 'namespace',
  withBody(BODY_REAL.replace(/Order__c/g, 'HLDG_Invoice_Batch__c').replace('Status__c', 'Posting_Status__c')),
  ['HLDG', 'Invoice_Batch', 'Posting_Status'], { keep: ['## Contract', 'backoff', 'SELECT Id FROM'] });
leak('recurring-class', 'identifier',
  { ...withBody(BODY_REAL.replace('new RangeHandler(failed)', 'new LedgerPostingRetryQueueable(failed)')),
    [`${SKILL}/references/example.md`]: '# Example\n\n`LedgerPostingRetryQueueable` re-queues itself with a doubled delay.\n',
    [`${SKILL}/evals/rubric.json`]: JSON.stringify({ trigger: [{ query: 'my LedgerPostingRetryQueueable keeps failing', should_trigger: true }], acceptance: ['the batch is re-queued'] }, null, 2) + '\n' },
  ['LedgerPostingRetryQueueable']);
leak('email-and-path', 'identity',
  withBody(BODY_REAL + '\nQuestions: m.ortega@halvorsenledger.com. The UI lives in `/Users/mortega/work/halvorsen-ui`.\n'),
  ['halvorsen', 'mortega', 'm\\.ortega', '/Users/']);
leak('ticket-key', 'ticket',
  withBody(BODY_REAL.replace('## Steps', '## Steps\n\nAdded for HLD-4412 after the month-end posting outage.')),
  ['HLD-\\d+']);
leak('secret', 'secret',
  withBody(BODY_REAL + '\n```js\nconst client = new LedgerClient({ apiKey: "hk_live_7Qm2vX9pL4sR8tW1yZ3n" });\n```\n'),
  ['hk_live_7Qm2vX9pL4sR8tW1yZ3n']);
leak('architecture', 'architecture',
  withBody(BODY_REAL + '\n## Where retries run\n\nCalls go LWC → the Halvorsen BFF (Node on Heroku, one dyno per org) → the Ledger Core SOAP API. The org-to-dyno map lives in Platform Cache partition `hldgRouting`.\n'),
  ['halvorsen', 'one dyno per org', 'Ledger Core', 'hldgRouting',
    // the SHAPE of the client's system is the leak too, not just its names
    '\\bBFF\\b', 'backend-for-frontend', 'Platform Cache', '\\bdyno']);
leak('eval-fixture', 'fixture',
  { [`${SKILL}/evals/rubric.json`]: JSON.stringify({ trigger: [
    { query: 'why does HLDG__Invoice_Batch__c fail to post at month end', should_trigger: true },
    { query: 'retry the Halvorsen nightly batch', should_trigger: true },
    { query: 'write a unit test for a trigger', should_trigger: false }], acceptance: ['the batch is re-queued'] }, null, 2) + '\n' },
  ['HLDG__', 'halvorsen', 'Invoice_Batch'], { keep: ['should_trigger'], keepFile: `${SKILL}/evals/rubric.json` });
// Already committed: the leak sits in the commit itself, so only a pre-push check sees it.
leak('committed-message', 'message',
  withBody(BODY_REAL.replace('at most three times', 'at most five times')),
  ['halvorsen', 'HLD-\\d+'],
  { prompt: PRE_PUSH_PROMPT, committed: { message: 'fix: Halvorsen batch retry for HLD-4412, up to five attempts' } });
leak('committed-branch-message', 'message',
  withBody(BODY_REAL.replace('list the failing record ids and stop', 'list the failing record ids, attach them to the job, and stop')),
  ['halvorsen', 'HLD-\\d+'],
  { prompt: PRE_PUSH_PROMPT, branch: 'hld-4412-halvorsen-batch-retry', committed: { message: 'feat: attach failing ids (hld-4412-halvorsen-batch-retry)' } });
leak('committed-work-author', 'author',
  withBody(BODY_REAL.replace('at most three times', 'at most four times')),
  ['halvorsenledger\\.com', 'ortega'],
  { prompt: PRE_PUSH_PROMPT, committed: { message: 'fix: allow four retry attempts', authorName: 'Marta Ortega', authorEmail: 'm.ortega@halvorsenledger.com' } });
leak('mixed', 'mixed',
  withBody(BODY_REAL.replace('retry a failed record batch', 'retry a failed Halvorsen posting batch')
    .replace(/Order__c/g, 'HLDG__Invoice_Batch__c') + '\nPing m.ortega@halvorsenledger.com before re-queuing (HLD-5120).\n'),
  ['halvorsen', 'HLDG__', 'Invoice_Batch', 'HLD-\\d+', 'mortega', 'm\\.ortega'], { keep: ['## Contract', 'backoff', 'SELECT Id FROM'] });
control('house-vocabulary', 'clean',
  withBody(BODY_CLEAN.replace('## Steps', '## Steps\n\nExample config lives in `Widget_Config__c` on `myOrg`; the UI calls `/api/items`. Tracked as TICK-000.')));
control('public-products', 'clean',
  withBody(BODY_CLEAN + '\nWorks the same on Salesforce, on Heroku, and from a GitHub Action.\n'));
control('generic-prose', 'clean',
  withBody(BODY_CLEAN.replace('at most three times', 'at most three times, doubling the delay each time')));

// Run from the repo root: node plugins/cerberus/skills/leak-check/evals/quality/build-cases.mjs <out-dir>
const out = process.argv[2];
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/cases.json`, JSON.stringify({ skill: SKILL, base, cases }, null, 2) + '\n');

console.log(`${cases.length} cases (${cases.filter(c => c.tags[0] === 'leak').length} leak, ${cases.filter(c => c.tags[0] === 'control').length} control)`);
