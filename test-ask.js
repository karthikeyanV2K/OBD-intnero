const { initAllEngines } = require('./agent-db');
const { routeTask } = require('./model-router');

async function run() {
  await initAllEngines();
  try {
    const res = await routeTask("Write a small JavaScript function that uses the Node.js 'fs' module to read the package.json file asynchronously.", 'claude-sonnet-4-6');
    console.log("RESULT:", res);
  } catch (e) {
    console.error("ERROR:", e);
  }
}
run();
