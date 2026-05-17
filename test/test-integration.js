const assert = require('assert');

const results = [];
let graphDb, ramDb;

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

(async () => {

// ───────────────────────
// Setup: init engines once
// ───────────────────────

section('Setup — init engines');
const { initAllEngines, getEngines } = require('../agent-db');

await test('initAllEngines succeeds', async () => {
  await initAllEngines();
  const engines = getEngines();
  graphDb = engines.graphDb;
  ramDb   = engines.ramDb;
  assert.ok(graphDb, 'graphDb should be defined');
  assert.ok(ramDb, 'ramDb should be defined');

  test('getEngines returns all 6 DBs', () => {
    assert.ok(engines.graphDb);
    assert.ok(engines.tsDb);
    assert.ok(engines.streamDb);
    assert.ok(engines.ramDb);
    assert.ok(engines.diskDb);
    assert.ok(engines.markBusy);
    assert.ok(engines.markIdle);
  });
});

// ───────────────────────
// knowledge.js — graph ops
// ───────────────────────

section('knowledge — graph operations');

// Load after engines are initialized
const {
  exportFullGraph, getFeatures, getGhostTasks, getModelHeatmap,
  getSecurityAudit, storeCodeStyle, storeSecurityRule, storeFeature,
  getConfirmedStyles,
} = require('../knowledge');

test('exportFullGraph — returns correct shape', () => {
  const g = exportFullGraph();
  assert.ok(Array.isArray(g.nodes));
  assert.ok(Array.isArray(g.edges));
});

test('storeCodeStyle — creates and retrieves pattern', () => {
  storeCodeStyle({ pattern: 'test-pattern-useArrowFunctions', language: 'javascript', example: 'const fn = () => {}' });
  const styles = getConfirmedStyles(0);
  const match = styles.find(s => s.pattern === 'test-pattern-useArrowFunctions');
  assert.ok(match, 'pattern should exist in confirmed styles');
  assert.ok(match.confidence >= 0);
});

test('storeCodeStyle — updates existing without error', () => {
  const r1 = storeCodeStyle({ pattern: 'test-pattern-useArrowFunctions', language: 'javascript' });
  const r2 = storeCodeStyle({ pattern: 'test-pattern-useArrowFunctions', language: 'javascript' });
  assert.ok(typeof r2.observations === 'number');
  assert.ok(r2.updated === true);
});

test('storeSecurityRule — stores without error', () => {
  storeSecurityRule({ rule: 'Test: validate all user input', severity: 'high', category: 'input' });
  const audit = getSecurityAudit();
  assert.ok(Array.isArray(audit.applied));
});

test('storeFeature — creates feature node', () => {
  storeFeature({ title: 'Test Feature', description: 'A test feature', priority: 'high' });
  const features = getFeatures();
  const match = features.find(f => f.title === 'Test Feature');
  assert.ok(match, 'feature should exist');
});

test('getGhostTasks — returns array', () => {
  const ghosts = getGhostTasks();
  assert.ok(Array.isArray(ghosts));
});

test('getModelHeatmap — returns array', () => {
  const heatmap = getModelHeatmap();
  assert.ok(Array.isArray(heatmap));
});

test('getSecurityAudit — score is number', () => {
  const audit = getSecurityAudit();
  assert.strictEqual(typeof audit.score, 'number');
});

test('getConfirmedStyles — returns array sorted by confidence desc', () => {
  const styles = getConfirmedStyles();
  assert.ok(Array.isArray(styles));
  for (let i = 1; i < styles.length; i++) {
    assert.ok(styles[i - 1].confidence >= styles[i].confidence,
      `styles[${i-1}].confidence (${styles[i-1].confidence}) >= styles[${i}].confidence (${styles[i].confidence})`);
  }
});

// ───────────────────────
// task-worker.js — submit + status
// ───────────────────────

section('task-worker — submit & getTaskStatus');
const { submitTask, getTaskStatus } = require('../task-worker');

test('submitTask returns a task ID', () => {
  const tid = submitTask('test task for integration', 'claude-sonnet-4-6');
  assert.ok(tid.startsWith('task_'), `expected task_ prefix, got ${tid}`);
});

test('getTaskStatus — queued task shows queued', () => {
  const tid = submitTask('test status tracking', 'claude-sonnet-4-6');
  const status = getTaskStatus(tid);
  assert.strictEqual(status.status, 'queued');
  assert.strictEqual(status.task_id, tid);
});

test('getTaskStatus — unknown task returns unknown', () => {
  const status = getTaskStatus('task_9999999999999');
  assert.strictEqual(status.status, 'unknown');
});

// ───────────────────────
// agent-db.js — markBusy/markIdle
// ───────────────────────

section('agent-db — markBusy/markIdle');
const { markBusy, markIdle } = require('../agent-db');

test('markBusy and markIdle are functions', () => {
  assert.strictEqual(typeof markBusy, 'function');
  assert.strictEqual(typeof markIdle, 'function');
});

test('busy cycle does not crash', () => {
  markBusy();
  markIdle();
  assert.ok(true);
});

// ───────────────────────
// model-router.js — switchModel without API keys
// ───────────────────────

section('model-router — switchModel handles gracefully');
const { switchModel } = require('../model-router');

test('switchModel with unknown model does not crash', async () => {
  const result = await switchModel(null, 'nonexistent-model');
  assert.ok(result, 'should return a result object');
  assert.ok('snapshot' in result || 'compressedContext' in result);
});

// ───────────────────────

// Wait for async results and print summary
await new Promise(r => setImmediate(r));
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

})();
