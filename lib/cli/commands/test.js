/**
 * Command: test
 * Test API connectivity
 */

const http = require('http');

async function testPort(port) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET',
      timeout: 2000,
    };

    const req = http.request(options, (res) => {
      resolve({ success: true, status: res.statusCode });
    });

    req.on('error', () => {
      resolve({ success: false, error: 'Connection failed' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

async function testTask(port) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      task: 'test',
      model: 'claude-sonnet-4',
    });

    const options = {
      hostname: 'localhost',
      port: port,
      path: '/task',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ success: true, status: res.statusCode, result });
        } catch (e) {
          resolve({ success: false, error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', () => {
      resolve({ success: false, error: 'Request failed' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.write(postData);
    req.end();
  });
}

async function execute(args, ui) {
  ui.section('API Connectivity Tests');

  const ports = [3001, 3002, 3003, 3004, 3005];

  for (const port of ports) {
    // Test connection
    const connResult = await testPort(port);
    if (connResult.success) {
      ui.status(`Port ${port} (Connection)`, 'Responding', 'success');

      // Test task endpoint
      const taskResult = await testTask(port);
      if (taskResult.success) {
        ui.status(`Port ${port} (Task)`, 'Working', 'success');
      } else {
        ui.status(`Port ${port} (Task)`, taskResult.error, 'error');
      }
    }
  }

  ui.divider();
  ui.section('Summary');

  ui.info('Connection test complete. Use "overdrive status" for detailed info.');

  ui.divider();
}

module.exports = { execute };
