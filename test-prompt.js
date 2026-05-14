const { initAllEngines } = require('./agent-db');
const { assemblePrompt } = require('./prompt-builder');

async function test() {
  await initAllEngines();
  try {
    const prompt = await assemblePrompt('Implement graph traversal for knowledge base', { model: 'claude-sonnet-4-6' });
    console.log('Prompt built successfully:', prompt.system.substring(0, 100));
  } catch (e) {
    console.error('PROMPT BUILD ERROR:', e);
  }
}

test();
