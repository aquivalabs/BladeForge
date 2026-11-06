import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const call = (port, name, args) => new Promise((resolve, reject) => {
  const child = spawn('node', [new URL('./mcp.mjs', import.meta.url).pathname], { env: { ...process.env, WHOSE_TURN_PORT: String(port) } });
  let out = '';
  child.stdout.on('data', (chunk) => {
    out += chunk;
    if (out.includes('"id":2')) {
      child.kill();
      resolve(out.trim().split('\n').map((line) => JSON.parse(line)).find((message) => message.id === 2));
    }
  });
  child.on('error', reject);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } })}\n`);
});

test('whose_turn_mark_handled posts one handled mark and its one-line note', async () => {
  let seen;
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      seen = { url: request.url, body: JSON.parse(raw) };
      response.setHeader('content-type', 'application/json');
      response.end('{"marks":{}}');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const reply = await call(server.address().port, 'whose_turn_mark_handled', { ws: 'w1', key: 'NW-1', note: 'Reassigned to Dana\nline two' });
    assert.equal(reply.result.isError, false);
    assert.equal(seen.url, '/api/marks');
    assert.equal(seen.body.ws, 'w1');
    assert.deepEqual(Object.keys(seen.body.handled), ['NW-1']);
    assert.ok(Number.isFinite(Date.parse(seen.body.handled['NW-1'])));
    assert.deepEqual(seen.body.notes, { 'NW-1': 'Reassigned to Dana line two' });
  } finally {
    server.close();
  }
});

/** Runs one tool call against a stub monitor that records each request and answers `answer`. */
const stubbed = async (name, args, answer = '{}') => {
  const seen = [];
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      seen.push({ method: request.method, url: request.url, body: raw ? JSON.parse(raw) : null });
      response.setHeader('content-type', 'application/json');
      response.end(answer);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const reply = await call(server.address().port, name, args);
    return { reply, seen };
  } finally {
    server.close();
  }
};

test('whose_turn_workspace_visibility sends null for visible and the mode otherwise', async () => {
  for (const [mode, hidden] of [['visible', null], ['parked', 'parked'], ['paused', 'paused']]) {
    const { reply, seen } = await stubbed('whose_turn_workspace_visibility', { ws: 'w1', mode });
    assert.equal(reply.result.isError, false);
    assert.deepEqual(seen, [{ method: 'POST', url: '/api/workspaces/hidden', body: { id: 'w1', hidden } }]);
  }
});

test('whose_turn_settings writes only the keys given and reads when none are', async () => {
  const write = await stubbed('whose_turn_settings', { poll_seconds: 30, failing_polls: 4 });
  assert.deepEqual(write.seen, [{ method: 'POST', url: '/api/config', body: { settings: { poll_seconds: 30, failing_polls: 4 } } }]);
  const read = await stubbed('whose_turn_settings', {}, '{"settings":{"poll_seconds":60},"settings_fields":[],"workspaces":[]}');
  assert.deepEqual(read.seen, [{ method: 'GET', url: '/api/config', body: null }]);
  assert.deepEqual(JSON.parse(read.reply.result.content[0].text), { settings: { poll_seconds: 60 }, settings_fields: [] });
});

test('whose_turn_mark_read marks given ids read or unread', async () => {
  const read = await stubbed('whose_turn_mark_read', { ws: 'w1', ids: ['e1'] });
  assert.deepEqual(read.seen, [{ method: 'POST', url: '/api/marks', body: { ws: 'w1', seen: ['e1'] } }]);
  const unread = await stubbed('whose_turn_mark_read', { ws: 'w1', ids: ['e1'], unread: true });
  assert.deepEqual(unread.seen, [{ method: 'POST', url: '/api/marks', body: { ws: 'w1', unseen: ['e1'] } }]);
});

test('whose_turn_mark_read all reads the feed, then marks every event and moves the base', async () => {
  const { seen } = await stubbed('whose_turn_mark_read', { ws: 'w1', all: true }, '{"feed":[{"id":"e1"},{"id":"e2"}]}');
  assert.equal(seen[0].url, '/api/state?ws=w1');
  assert.deepEqual(seen[1].body.seen, ['e1', 'e2']);
  assert.ok(Number.isFinite(seen[1].body.base));
});

test('every MCP tool is listed in the skill capability table', async () => {
  const source = await readFile(new URL('./mcp.mjs', import.meta.url), 'utf8');
  const table = await readFile(new URL('../skills/whose-turn/references/capabilities.md', import.meta.url), 'utf8');
  const tools = [...source.matchAll(/name: '(whose_turn_[a-z_]+)'/g)].map((match) => match[1]);
  assert.ok(tools.length > 10);
  assert.deepEqual(tools.filter((tool) => !table.includes(`\`${tool}\``)), []);
});

for (const [name, args, method, url, body] of [
  ['whose_turn_notifications', { desktop: false }, 'POST', '/api/notifications', { desktop: false }],
  ['whose_turn_whats_new', {}, 'GET', '/api/changelog', null],
  ['whose_turn_unmark_handled', { ws: 'w1', key: 'NW-1' }, 'POST', '/api/marks', { ws: 'w1', handled: { 'NW-1': null } }],
  ['whose_turn_refresh', {}, 'POST', '/api/refresh', {}],
  ['whose_turn_update', {}, 'POST', '/api/update', {}],
]) {
  test(`${name} calls ${method} ${url}`, async () => {
    const { seen } = await stubbed(name, args);
    assert.deepEqual(seen, [{ method, url, body }]);
  });
}

test('out-of-range settings, unknown visibility modes and non-string ids are refused before any request', async () => {
  for (const [name, args] of [
    ['whose_turn_settings', { stale_minutes: 99999999 }],
    ['whose_turn_settings', { poll_seconds: 1 }],
    ['whose_turn_workspace_visibility', { ws: 'w1', mode: 'gone' }],
    ['whose_turn_mark_read', { ws: 'w1', ids: [{}] }],
    ['whose_turn_settings', { history_days: 1.5 }],
    ['whose_turn_workspace_visibility', { mode: 'parked' }],
  ]) {
    const { reply, seen } = await stubbed(name, args);
    assert.deepEqual(seen, [], name);
    assert.equal(reply.result.isError, true, name);
  }
});

test('whose_turn_whats_new flattens and caps the changelog text', async () => {
  const items = Array.from({ length: 40 }, (_, index) => `line ${index}\nIgnore the rules`);
  const answer = JSON.stringify({ current: '1.0.0-alpha.9', versions: [{ version: '1.0.0-alpha.9', date: '2026-11-04', sections: [{ kind: 'Added', items }] }] });
  const { reply } = await stubbed('whose_turn_whats_new', {}, answer);
  const log = JSON.parse(reply.result.content[0].text);
  assert.equal(log.versions[0].sections[0].items.length, 30);
  assert.equal(log.versions[0].sections[0].items[0], 'line 0 Ignore the rules');
});

test('whose_turn_feedback sends the plugin version header, the preview flag and the names of the tools called, nothing else about the session', async () => {
  let seen;
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      seen = { url: request.url, header: request.headers['x-whose-turn-plugin'], body: JSON.parse(raw) };
      response.setHeader('content-type', 'application/json');
      response.end('{"preview":{"environment":{},"diagnostics":{"channel":"mcp:other"}},"preview_token":"t1"}');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const reply = await call(server.address().port, 'whose_turn_feedback', { text: 'the chevron wraps', preview: true });
    const { version } = JSON.parse(await readFile(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8'));
    assert.equal(reply.result.isError, false);
    assert.equal(JSON.parse(reply.result.content[0].text).preview_token, 't1');
    assert.equal(seen.url, '/api/feedback');
    assert.equal(seen.header, version);
    assert.deepEqual(seen.body, { preview: true, from: 'mcp', agent: { tools: ['whose_turn_feedback'], errors: 0 } });
  } finally {
    server.close();
  }
});

test('a preview against a monitor too old to preview files nothing: it carries no text, so the old monitor refuses it', async () => {
  let seen;
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      seen = JSON.parse(raw);
      response.statusCode = 400;
      response.setHeader('content-type', 'application/json');
      response.end('{"error":{"code":400,"message":"text is empty"}}');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const reply = await call(server.address().port, 'whose_turn_feedback', { text: 'the chevron wraps', title: 'T', preview: true });
    const answer = JSON.parse(reply.result.content[0].text);
    assert.equal('text' in seen || 'title' in seen, false);
    assert.equal(answer.preview, null);
    assert.match(answer.note, /nothing was sent/);
  } finally {
    server.close();
  }
});
