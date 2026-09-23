#!/usr/bin/env node
// SessionStart hook: warn when a plugin the project ENABLES is not INSTALLED for this project.
//
// A project's `.claude/settings.json` can set `enabledPlugins: {"foo@acme-tools": true}` while the
// user-level registry `~/.claude/plugins/installed_plugins.json` holds no install record covering
// this project path. The plugin then silently never loads: its skills are absent from the session
// and nothing says so. This prints one line per such plugin with the command that fixes it.
//
// Fail-open and non-blocking by construction: every read is guarded, the exit code is always 0, and
// a clean project prints nothing at all. A session must never be harder to start because a warning
// could not be computed.
//
// Node, not bash: this reads JSON on stdin and parses three JSON documents. That is the deliberate node
// exception in the hooks-are-shell-first ADR (`docs/adr/0002-hooks-are-shell-first.md` where this repo
// carries its ADR layer) — bash would need `jq`, a dependency this marketplace avoids.

const fs = require('fs');
const os = require('os');
const path = require('path');

// The registry records one entry per install, each naming the scope it covers:
//   user             — covers every project on the machine
//   project | local  — covers exactly the one `projectPath` it names
const PROJECT_SCOPES = ['project', 'local'];

// A plugin id is `<plugin>@<marketplace>`, both of them plain identifiers. Anything else cannot
// name an installable plugin, so it is never reported — and this is what keeps the warning safe:
// `.claude/settings.json` is a file a REPOSITORY can ship, its keys reach a systemMessage the model
// reads, and an unconstrained key there would be attacker-authored text arriving as trusted context.
const PLUGIN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9][A-Za-z0-9._-]*$/;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    // Missing or malformed: there is nothing to compare against, so there is nothing to warn about.
    return null;
  }
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (error) {
    return '';
  }
}

function parseHookPayload(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    // A hook invoked by hand with no stdin still has a usable process cwd.
    return {};
  }
}

function enabledPluginIds(projectDir) {
  // settings.local.json is read second so a `false` there switches off what settings.json enabled.
  const merged = {};
  for (const fileName of ['settings.json', 'settings.local.json']) {
    const settings = readJson(path.join(projectDir, '.claude', fileName));
    if (settings && typeof settings.enabledPlugins === 'object' && settings.enabledPlugins !== null) {
      Object.assign(merged, settings.enabledPlugins);
    }
  }
  return Object.keys(merged)
    .filter((pluginId) => merged[pluginId] === true && PLUGIN_ID.test(pluginId))
    .sort();
}

function installRecords(registry) {
  if (!registry || typeof registry !== 'object') {
    return {};
  }
  // Current shape nests the map under `plugins`; a bare map is accepted as the older shape.
  const plugins = registry.plugins;
  if (plugins && typeof plugins === 'object') {
    return plugins;
  }
  return registry;
}

function isInstalledFor(records, pluginId, projectDir) {
  const entries = records[pluginId];
  if (!Array.isArray(entries)) {
    return false;
  }
  return entries.some((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    if (entry.scope === 'user') {
      return true;
    }
    if (!PROJECT_SCOPES.includes(entry.scope) || typeof entry.projectPath !== 'string') {
      return false;
    }
    return path.resolve(entry.projectPath) === projectDir;
  });
}

function buildMessage(missing) {
  const lines = [
    '[plugin-sync] enabled in .claude/settings.json but NOT installed for this project — their skills will not load:',
  ];
  for (const pluginId of missing) {
    lines.push(`  ${pluginId}  →  claude plugin install ${pluginId} --scope project   (then restart the session)`);
  }
  lines.push('  Diagnosis and the other two fixes: the scout:plugin-sync skill.');
  return lines.join('\n');
}

function main() {
  const payload = parseHookPayload(readStdin());
  const projectDir = path.resolve(
    typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd()
  );

  const wanted = enabledPluginIds(projectDir);
  if (wanted.length === 0) {
    return;
  }

  const registryPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
  const records = installRecords(readJson(registryPath));
  const missing = wanted.filter((pluginId) => !isInstalledFor(records, pluginId, projectDir));
  if (missing.length === 0) {
    return;
  }

  process.stdout.write(JSON.stringify({ systemMessage: buildMessage(missing) }));
}

try {
  main();
} catch (error) {
  // Fail-open: a warning that cannot be computed is never worth a failed session start.
}
process.exit(0);
