/**
 * test-imports.js
 * Validates that all modules can be imported without errors
 */

console.log('Testing OverDrive AI Agent imports...\n');

const tests = [
  { name: 'agent-db', fn: () => require('./agent-db') },
  { name: 'knowledge', fn: () => require('./knowledge') },
  { name: 'model-router', fn: () => require('./model-router') },
  { name: 'task-worker', fn: () => require('./task-worker') },
  { name: 'prompt-builder', fn: () => require('./prompt-builder') },
  { name: 'extension-config', fn: () => require('./extension-config') },
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
  try {
    const module = test.fn();
    console.log(`✓ ${test.name} - OK`);
    if (module) {
      const exports = Object.keys(module);
      console.log(`  Exports: ${exports.slice(0, 3).join(', ')}${exports.length > 3 ? '...' : ''}`);
    }
    passed++;
  } catch (err) {
    console.log(`✗ ${test.name} - FAILED`);
    console.log(`  Error: ${err.message}`);
    failed++;
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✓ All imports validated successfully!');
  process.exit(0);
} else {
  console.log('✗ Some imports failed. Please check the errors above.');
  process.exit(1);
}
