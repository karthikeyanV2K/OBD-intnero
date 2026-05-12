/**
 * test-mcp-setup.js
 * Validates that your MCP setup is working correctly
 * Run: node test-mcp-setup.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function log(type, msg) {
  const icons = { ✅: '✅', ❌: '❌', ℹ️: 'ℹ️', ⚠️: '⚠️' };
  console.log(`${icons[type] || type} ${msg}`);
  if (type === '✅') passed++;
  if (type === '❌') failed++;
}

async function test(name, fn) {
  try {
    await fn();
    log('✅', name);
  } catch (err) {
    log('❌', `${name}: ${err.message}`);
  }
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        } else {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 OverdriveDB MCP Setup Validation\n');
  console.log('Test Suite:', process.env.NODE_ENV || 'development');
  console.log('');

  // 1. Environment checks
  console.log('📋 Environment Checks');
  console.log('─'.repeat(40));

  await test('Node.js is available', async () => {
    if (!process.version) throw new Error('Node not detected');
  });

  await test('.env file exists', async () => {
    if (!fs.existsSync('.env')) throw new Error('.env file not found');
  });

  await test('API keys configured', async () => {
    const env = fs.readFileSync('.env', 'utf-8');
    if (!env.includes('ANTHROPIC_API_KEY') && !env.includes('OPENAI_API_KEY')) {
      throw new Error('No API keys in .env');
    }
  });

  // 2. Dependency checks
  console.log('\n📦 Dependencies');
  console.log('─'.repeat(40));

  await test('@modelcontextprotocol/sdk installed', async () => {
    require('@modelcontextprotocol/sdk/server/index.js');
  });

  await test('overdrive-db installed', async () => {
    require('overdrive-db');
  });

  await test('@anthropic-ai/sdk installed', async () => {
    require('@anthropic-ai/sdk');
  });

  await test('openai installed', async () => {
    require('openai');
  });

  // 3. File checks
  console.log('\n📁 Required Files');
  console.log('─'.repeat(40));

  const files = [
    'mcp-server.js',
    'model-router.js',
    'agent-db.js',
    'knowledge.js',
    'prompt-builder.js',
    'server.js',
    'task-worker.js',
  ];

  for (const file of files) {
    await test(`${file} exists`, async () => {
      if (!fs.existsSync(file)) throw new Error(`Missing: ${file}`);
    });
  }

  // 4. Configuration checks
  console.log('\n⚙️  Configuration Files');
  console.log('─'.repeat(40));

  await test('claude-config.json exists', async () => {
    if (!fs.existsSync('claude-config.json')) throw new Error('Not found');
  });

  await test('vscode-mcp-config.json exists', async () => {
    if (!fs.existsSync('vscode-mcp-config.json')) throw new Error('Not found');
  });

  await test('kiro-mcp-config.json exists', async () => {
    if (!fs.existsSync('kiro-mcp-config.json')) throw new Error('Not found');
  });

  // 5. HTTP Server checks (if running)
  console.log('\n🌐 HTTP Server (requires: npm run server)');
  console.log('─'.repeat(40));

  const serverOptions = {
    hostname: 'localhost',
    port: 3001,
    path: '/task',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };

  await test('Server is listening on port 3001', async () => {
    const data = { task: 'test', model: 'claude-sonnet-4-6' };
    const response = await makeRequest(serverOptions, data);
    if (!response) throw new Error('No response');
  });

  await test('Can submit a task', async () => {
    const data = { task: 'hello world', model: 'claude-sonnet-4-6' };
    const response = await makeRequest(serverOptions, data);
    if (!response.result) throw new Error('No result in response');
  });

  // 6. Database checks
  console.log('\n💾 Database Files');
  console.log('─'.repeat(40));

  const dbFiles = [
    'agent-graph.odb',
    'agent-vectors.odb',
    'agent-metrics.odb',
    'agent-stream.odb',
    'agent-session.odb',
    'agent-knowledge.odb',
  ];

  for (const file of dbFiles) {
    const exists = fs.existsSync(file);
    const status = exists ? `✅ exists (${fs.statSync(file).size} bytes)` : 'ℹ️  will be created on first run';
    console.log(`${status}: ${file}`);
  }

  // 7. Summary
  console.log('\n' + '='.repeat(40));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('='.repeat(40));

  if (failed === 0) {
    console.log('\n🎉 All checks passed! Your setup is ready.\n');
    console.log('Next steps:');
    console.log('1. npm run mcp          (Terminal 1)');
    console.log('2. npm run server       (Terminal 2)');
    console.log('3. npm run worker       (Terminal 3)');
    console.log('4. Connect Claude / VS Code / Kiro');
    console.log('5. Follow QUICK-START.md for examples\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some checks failed. See above for details.\n');
    console.log('Common fixes:');
    console.log('• npm install                      (missing dependencies)');
    console.log('• cp .env.example .env             (missing config)');
    console.log('• npm run server                   (HTTP server not running)');
    console.log('• Check your API keys in .env      (auth issues)\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
