/**
 * Command: status
 * Show current system status
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

async function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, { timeout: 1000 }, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000);
  });
}

async function execute(args, ui) {
  ui.section('System Status');

  // Check core agent
  const coreRunning = await checkPort(3001);
  ui.status('Core Agent (localhost:3001)', coreRunning ? 'Running' : 'Stopped', coreRunning ? 'success' : 'error');

  // Check independent agents
  for (let port = 3002; port <= 3005; port++) {
    const running = await checkPort(port);
    if (running) {
      ui.status(`Independent Agent (localhost:${port})`, 'Running', 'success');
    }
  }

  // Check databases
  ui.divider();
  ui.section('Databases');

  const dbPath = path.join(__dirname, '../../agent-graph.odb');
  if (fs.existsSync(dbPath)) {
    const size = fs.statSync(dbPath).size;
    ui.status('Main Graph DB', `${(size / 1024 / 1024).toFixed(2)} MB`, 'success');
  } else {
    ui.warning('Main graph database not found');
  }

  // Check config
  ui.divider();
  ui.section('Configuration');

  const envPath = path.join(__dirname, '../../.env');
  const envExists = fs.existsSync(envPath);
  ui.status('Environment config', envExists ? 'Found' : 'Missing', envExists ? 'success' : 'error');

  // Check project configs
  const projectDirs = ['../project-a', '../project-b', '../project-c', '../project-d'];
  ui.divider();
  ui.section('Projects Found');

  let projectCount = 0;
  projectDirs.forEach(dir => {
    const configPath = path.join(__dirname, dir, '.agent-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      ui.status(dir.replace('../', ''), `${config.mode} mode`, 'success');
      projectCount++;
    }
  });

  if (projectCount === 0) {
    ui.warning('No projects configured yet. Run: overdrive setup');
  }

  ui.divider();
}

module.exports = { execute };
