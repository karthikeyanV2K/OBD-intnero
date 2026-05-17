const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name} — ${e.message}`); }
}

console.log('\n📦 Module imports');
test('agent-db loads',        () => { const m = require('../agent-db');      assert.ok(m.initAllEngines); assert.ok(m.getEngines); assert.ok(m.categorizeTask); });
test('knowledge loads',       () => { const m = require('../knowledge');     assert.ok(m.exportFullGraph); assert.ok(m.getFeatures); });
test('model-router loads',    () => { const m = require('../model-router');  assert.ok(m.routeTask); assert.ok(m.switchModel); assert.ok(m.getModelStats); });
test('task-worker loads',     () => { const m = require('../task-worker');   assert.ok(m.startWorker); });
test('prompt-builder loads',  () => { const m = require('../prompt-builder'); assert.ok(m.buildSystemPrompt); });
// extension-config.js is a reference template (JSON-in-JS-comments), not a real module

console.log('\n🌐 Server');
test('server.js parses',      () => { const m = require('../server'); });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
