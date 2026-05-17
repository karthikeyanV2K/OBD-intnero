const assert = require('assert');
const http   = require('http');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.log(`  ✗ ${name} — ${e.message}`); }
}

function section(title) {
  console.log(`\n${title}`);
}

// ───────────────────────
// Start server
// ───────────────────────

let baseUrl;
let server;

section('Setup — start server');
const { startServer } = require('../server');

test('server starts on a free port', async () => {
  const port = await startServer();
  baseUrl = `http://127.0.0.1:${port}`;
  assert.ok(port > 0);
});

// ───────────────────────
// Helper: fetch wrapper
// ───────────────────────

function fetch(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: new URL(baseUrl).port,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      timeout: 5000,
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ───────────────────────
// API: GET endpoints
// ───────────────────────

section('GET /api/tasks');
test('returns 200 with tasks array', async () => {
  const res = await fetch('GET', '/api/tasks');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.tasks));
});

section('GET /api/graph');
test('returns 200 with nodes and edges', async () => {
  const res = await fetch('GET', '/api/graph');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.nodes));
  assert.ok(Array.isArray(res.body.edges));
});

section('GET /api/session');
test('returns 200 with session object', async () => {
  const res = await fetch('GET', '/api/session');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(typeof res.body, 'object');
});

section('POST /api/session');
test('returns 200 and creates session', async () => {
  const res = await fetch('POST', '/api/session', { username: 'testuser', model: 'claude-sonnet-4-6', memoryLimit: 64 });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.ok);
});

section('GET /api/features');
test('returns 200 with features array', async () => {
  const res = await fetch('GET', '/api/features');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.features));
});

section('GET /api/styles');
test('returns 200 with styles array', async () => {
  const res = await fetch('GET', '/api/styles');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.styles));
});

section('GET /api/heatmap');
test('returns 200 with heatmap array', async () => {
  const res = await fetch('GET', '/api/heatmap');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.heatmap));
});

section('GET /api/security-audit');
test('returns 200 with audit object', async () => {
  const res = await fetch('GET', '/api/security-audit');
  assert.strictEqual(res.status, 200);
  assert.ok('applied' in res.body);
  assert.ok('missing' in res.body);
  assert.ok('score' in res.body);
});

section('GET /api/ghosts');
test('returns 200 with ghosts array', async () => {
  const res = await fetch('GET', '/api/ghosts');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.ghosts));
});

section('POST /api/external/task');
test('returns 200 and creates task node', async () => {
  const res = await fetch('POST', '/api/external/task', {
    task: 'test api task',
    model: 'claude-sonnet-4-6',
    status: 'completed',
    code: 'console.log("test")',
    reasoning: 'test reasoning',
  });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.ok);
  assert.ok(res.body.node_id);
});

section('GET /events (SSE)');
test('returns 200 with text/event-stream content type', async () => {
  const res = await fetch('GET', '/events');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers['content-type'], 'text/event-stream');
});

// ───────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
