const assert = require('assert');

const results = [];

function test(name, fn) {
  try {
    const maybe = fn();
    if (maybe && typeof maybe.then === 'function') {
      return maybe.then(() => results.push({ name, ok: true }))
        .catch(e => { results.push({ name, ok: false, msg: e.message }); console.log(`  ✗ ${name} — ${e.message}`); });
    }
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, msg: e.message });
    console.log(`  ✗ ${name} — ${e.message}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ───────────────────────
// agent-db: categorizeTask
// ───────────────────────

section('agent-db — categorizeTask');
const { categorizeTask } = require('../agent-db');

test('debug tasks',        () => assert.strictEqual(categorizeTask('fix the login bug'),           'debug'));
test('feature tasks',      () => assert.strictEqual(categorizeTask('add a new user dashboard'),    'feature'));
test('refactor tasks',     () => assert.strictEqual(categorizeTask('refactor the auth module'),    'refactor'));
test('architecture tasks', () => assert.strictEqual(categorizeTask('design the database schema'),  'architecture'));
test('deployment tasks',   () => assert.strictEqual(categorizeTask('deploy to production'),        'deployment'));
test('UI tasks',           () => assert.strictEqual(categorizeTask('style the navbar'),             'ui'));
test('testing tasks',      () => assert.strictEqual(categorizeTask('write unit tests for api'),    'testing'));
test('security tasks',     () => assert.strictEqual(categorizeTask('validate login form'),         'security'));
test('general fallback',   () => assert.strictEqual(categorizeTask('hello world'),                 'general'));
test('empty string',       () => assert.strictEqual(categorizeTask(''),                            'general'));

// ───────────────────────
// knowledge: pure helpers
// ───────────────────────

section('knowledge — pure helpers');
const { estimateTokens, extractKeyword, embedText, getSecurityAudit } = require('../knowledge');

test('estimateTokens — empty',    () => assert.strictEqual(estimateTokens(''), 0));
test('estimateTokens — short',    () => assert.strictEqual(estimateTokens('hello world'), 3));
test('estimateTokens — longer',   () => assert.strictEqual(estimateTokens('a'.repeat(100)), 25));

test('extractKeyword — returns first 3 words', () => assert.strictEqual(extractKeyword('fix the login bug handler'), 'fix the login'));
test('extractKeyword — short text',            () => assert.strictEqual(extractKeyword('hello'), 'hello'));
test('extractKeyword — empty',                 () => assert.strictEqual(extractKeyword(''), ''));

test('embedText — deterministic (same input = same output)', async () => {
  const a = await embedText('hello world');
  const b = await embedText('hello world');
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.length, 384);
});

test('embedText — different inputs differ', async () => {
  const a = await embedText('hello world');
  const b = await embedText('goodbye world');
  const same = a.every((v, i) => v === b[i]);
  assert.ok(!same, 'different inputs should produce different embeddings');
});

test('getSecurityAudit — shape', () => {
  const audit = getSecurityAudit();
  assert.ok(Array.isArray(audit.applied));
  assert.ok(Array.isArray(audit.missing));
  assert.strictEqual(typeof audit.score, 'number');
  assert.strictEqual(audit.applied.length + audit.missing.length, 10);
});

test('getSecurityAudit — score range', () => {
  const audit = getSecurityAudit();
  assert.ok(audit.score >= 0 && audit.score <= 100);
});

// ───────────────────────
// prompt-builder
// ───────────────────────

section('prompt-builder — hasReference');
const { hasReference } = require('../prompt-builder');

test('hasReference — "fix that bug"',          () => assert.ok(hasReference('fix that bug')));
test('hasReference — "hello world"',           () => assert.ok(!hasReference('hello world')));
test('hasReference — "refactor this"',         () => assert.ok(hasReference('refactor this')));
test('hasReference — "explain the function"',  () => assert.ok(hasReference('explain the function')));
test('hasReference — empty string',            () => assert.ok(!hasReference('')));

// ───────────────────────
// model-router: ADAPTERS
// ───────────────────────

section('model-router — ADAPTERS');
const { ADAPTERS } = require('../model-router');

test('ADAPTERS has 4 entries',          () => assert.strictEqual(Object.keys(ADAPTERS).length, 4));
test('ADAPTERS has claude-sonnet-4-6',  () => assert.ok('claude-sonnet-4-6' in ADAPTERS));
test('ADAPTERS has claude-opus-4-6',    () => assert.ok('claude-opus-4-6' in ADAPTERS));
test('ADAPTERS has gpt-4o',            () => assert.ok('gpt-4o' in ADAPTERS));
test('ADAPTERS has gpt-4o-mini',       () => assert.ok('gpt-4o-mini' in ADAPTERS));

// ───────────────────────
// task-worker: getTaskStatus
// ───────────────────────

section('task-worker — getTaskStatus');
const { getTaskStatus } = require('../task-worker');

test('getTaskStatus — unknown task returns unknown status', () => {
  const status = getTaskStatus('nonexistent_task_123');
  assert.strictEqual(status.status, 'unknown');
  assert.strictEqual(status.task_id, 'nonexistent_task_123');
});

// ───────────────────────

(async () => {
  // Wait for any remaining async tests
  await new Promise(r => setImmediate(r));
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
