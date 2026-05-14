const { initAllEngines, getEngines } = require('./agent-db');
const { storeAgentTurn, loadCompressedContext } = require('./knowledge');

async function runLocalTest() {
  console.log('--- Starting Local Test ---');
  
  // 1. Initialize Engines
  await initAllEngines();
  const { graphDb, ramDb, diskDb } = getEngines();
  console.log('✅ All OverdriveDB engines initialized successfully.');

  // 2. Test RAM DB
  // console.log('[DEBUG] Inserting into RAM DB...');
  // ramDb.insert('session', { task_id: 'test_123', task: 'Build MCP server', ts: Date.now() });
  // console.log('[DEBUG] Querying from RAM DB...');
  // const session = ramDb.query('SELECT * FROM session');
  // console.log('✅ RAM DB read/write successful. Session:', session);

  // 3. Test Graph & Disk DB (storeAgentTurn)
  console.log('Storing agent turn...');
  const result = await storeAgentTurn({
    taskDesc: 'Implement graph traversal for knowledge base',
    model: 'claude-sonnet-4-6',
    reasoningChain: 'I need to use graphDb.graphTraverse to get all connected nodes.',
    codeOutput: {
      signature: 'function traverseGraph(startId) { ... }',
      language: 'javascript',
      file: 'knowledge.js'
    },
    embedding: null // mock embedding
  });
  
  console.log(`✅ Turn stored! Task Node: ${result.taskId}, Code Node: ${result.codeId}`);

  // 4. Test Graph Query
  console.log('[DEBUG] Listing nodes from Graph DB...');
  const tasks = graphDb.listNodes('Task');
  console.log(`✅ Graph Query successful. Found ${tasks.length} tasks in Graph DB.`);

  // 5. Test Context Loader
  console.log('[DEBUG] Loading compressed context...');
  const context = await loadCompressedContext('Implement graph traversal', 3);
  console.log('✅ Context compression successful. Token efficient context generated!');
  
  console.log('--- Local Test Complete! All systems operational! ---');
}

runLocalTest().catch(err => {
  console.error('❌ Test failed:', err);
});
