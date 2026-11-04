import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
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
