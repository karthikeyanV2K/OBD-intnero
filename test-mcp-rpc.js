const { spawn } = require('child_process');

const server = spawn('node', ['C:/Users/karth/AppData/Roaming/npm/node_modules/odb-echograph/mcp-server.js']);

server.stdout.on('data', data => {
  console.log(`STDOUT: ${data.toString()}`);
});

server.stderr.on('data', data => {
  console.log(`STDERR: ${data.toString()}`);
});

server.on('close', code => {
  console.log(`Child process exited with code ${code}`);
});

const req = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'ask_agent',
    arguments: {
      task: 'Write a small JavaScript function',
      model: 'claude-sonnet-4-6'
    }
  }
};

setTimeout(() => {
  server.stdin.write(JSON.stringify(req) + '\n');
}, 1000);
