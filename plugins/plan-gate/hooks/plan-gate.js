#!/usr/bin/env node
// PreToolUse gate: enforce the spec -> plan -> branch -> code workflow.
//
// Fires on Edit/Write/MultiEdit. Blocks writing CODE unless the current work is on a
// branch (not the base branch) and a plan exists for it. The spec/plan itself lives
// under docs/, which is always writable, so the gate never blocks writing the plan.
//
// Enforcement is OPT-IN per repo: a repo participates only if it has a
// `.claude/plan-gate.config.json`. Any repo without that file is never gated.
//
// Bypass: set AS_SKIP_PLAN_GATE=1 for a single conscious hotfix.
// Fail-open: any unexpected error allows the edit — a workflow gate must never brick
// the ability to work.
//
// Node rewrite of the former plan-gate.py: this hook parses JSON in and out, shells to
// git, and runs a regex — node does all three natively and starts ~10ms vs ~60ms in
// python. Hooks are shell-first here, but heavy JSON+git logic is the deliberate node
// exception, not bash — rationale in docs/adr/0002.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULTS = {
  baseBranch: 'main',
  plansDir: 'docs/superpowers/plans',
  allowedPrefixes: ['docs/'],
  taskIdPattern: '[A-Z][A-Z0-9]+-\\d+',
};

function allow() {
  // No output + exit 0 == let the tool call through.
  process.exit(0);
}

function deny(reason) {
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

function git(repo, ...args) {
  // Throws on non-zero exit, mirroring the python helper.
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    timeout: 5000,
  }).trim();
}

function findRepoRoot(filePath) {
  const anchors = [path.dirname(filePath) || '.', process.cwd()];
  for (const anchor of anchors) {
    try {
      return git(anchor, 'rev-parse', '--show-toplevel');
    } catch (error) {
      continue;
    }
  }
  return null;
}

function loadConfig(repoRoot) {
  const configPath = path.join(repoRoot, '.claude', 'plan-gate.config.json');
  if (!fs.existsSync(configPath) || !fs.statSync(configPath).isFile()) {
    return null; // repo not opted in
  }
  const config = { ...DEFAULTS };
  try {
    Object.assign(config, JSON.parse(fs.readFileSync(configPath, 'utf8')));
  } catch (error) {
    // malformed config -> use defaults but still enforce
  }
  return config;
}

function planExistsForTask(repoRoot, plansDir, taskId) {
  const absPlans = path.join(repoRoot, plansDir);
  let names;
  try {
    if (!fs.statSync(absPlans).isDirectory()) {
      return false;
    }
    names = fs.readdirSync(absPlans);
  } catch (error) {
    return false;
  }
  const needle = taskId.toLowerCase();
  return names.some(
    (name) => name.endsWith('.md') && name.toLowerCase().includes(needle),
  );
}

function planAddedOnBranch(repoRoot, plansDir, baseBranch) {
  try {
    const added = git(
      repoRoot, 'diff', '--name-only', '--diff-filter=A',
      `${baseBranch}...HEAD`, '--', plansDir,
    );
    if (added.split('\n').some((line) => line.endsWith('.md'))) {
      return true;
    }
  } catch (error) {
    // fall through
  }
  try {
    const dirty = git(
      repoRoot, 'status', '--porcelain', '--untracked-files=all', '--', plansDir,
    );
    for (const line of dirty.split('\n')) {
      if (line.trim().endsWith('.md')) {
        return true;
      }
    }
  } catch (error) {
    // fall through
  }
  return false;
}

function main() {
  if (process.env.AS_SKIP_PLAN_GATE === '1') {
    allow();
  }

  let data;
  try {
    data = JSON.parse(rawStdin);
  } catch (error) {
    allow();
  }

  const toolInput = data.tool_input || {};
  let filePath = toolInput.file_path || toolInput.notebook_path;
  if (!filePath) {
    allow();
  }

  filePath = path.resolve(filePath);
  const repoRoot = findRepoRoot(filePath);
  if (!repoRoot) {
    allow(); // not a git repo -> nothing to gate
  }

  const config = loadConfig(repoRoot);
  if (config === null) {
    allow(); // repo not opted in
  }

  const relPath = path.relative(repoRoot, filePath);

  // 1. Always-writable prefixes (docs/ by default) -> the spec/plan is never blocked.
  for (const prefix of config.allowedPrefixes) {
    if (relPath === prefix.replace(/\/+$/, '') || relPath.startsWith(prefix)) {
      allow();
    }
  }

  // Current branch.
  let branch;
  try {
    branch = git(repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD');
  } catch (error) {
    allow(); // detached / no HEAD -> don't brick
  }

  // 2. Never code on the base branch.
  if (branch === config.baseBranch) {
    deny(
      `[plan-gate] \`${relPath}\` — no code on \`${config.baseBranch}\` ` +
      `(the deploy branch). Create a feature branch first, then edit.\n` +
      `Bypass a genuine hotfix with AS_SKIP_PLAN_GATE=1.`,
    );
  }

  // 3. A plan must exist for this work.
  const plansDir = config.plansDir;
  const match = new RegExp(config.taskIdPattern).exec(branch);
  if (match) {
    const taskId = match[0];
    if (!planExistsForTask(repoRoot, plansDir, taskId)) {
      deny(
        `[plan-gate] \`${relPath}\` — branch \`${branch}\` carries task ` +
        `\`${taskId}\` but no plan \`${plansDir}/*${taskId}*.md\` exists. ` +
        `Write the plan first (brainstorming -> writing-plans).\n` +
        `Bypass with AS_SKIP_PLAN_GATE=1.`,
      );
    }
  } else if (!planAddedOnBranch(repoRoot, plansDir, config.baseBranch)) {
    deny(
      `[plan-gate] \`${relPath}\` — branch \`${branch}\` has no plan in ` +
      `\`${plansDir}\` (nothing new vs \`${config.baseBranch}\`, nothing ` +
      `in the working tree). Write the plan first ` +
      `(brainstorming -> writing-plans).\nBypass with AS_SKIP_PLAN_GATE=1.`,
    );
  }

  // 4. Off the base branch, plan present -> allowed.
  allow();
}

let rawStdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  rawStdin += chunk;
});
process.stdin.on('end', () => {
  try {
    main();
  } catch (error) {
    allow(); // unexpected error -> never brick
  }
});
