/**
 * Command: run
 * Start servers
 */

const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');

async function execute(args, ui) {
  const mode = args[0] || 'all';

  if (!['shared', 'independent', 'all'].includes(mode)) {
    ui.error(`Invalid mode: ${mode}. Use: shared, independent, or all`);
    return;
  }

  ui.section(`Starting Servers (${mode.toUpperCase()} mode)`);

  const scripts = [];

  if (mode === 'shared' || mode === 'all') {
    scripts.push({
      name: 'Core Agent (Shared)',
      port: 3001,
      command: 'npm',
      args: ['run', 'dev'],
      cwd: path.join(__dirname, '../../'),
    });
  }

  if (mode === 'independent' || mode === 'all') {
    // Find all independent projects
    const dirs = ['project-c', 'project-d'];
    for (const dir of dirs) {
      const projPath = path.join(__dirname, '../../', dir);
      const configPath = path.join(projPath, '.agent-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.mode === 'independent') {
          scripts.push({
            name: `${dir} Agent`,
            port: config.agent_port,
            command: 'npm',
            args: ['run', 'dev'],
            cwd: path.join(projPath, 'agent'),
          });
        }
      }
    }
  }

  if (scripts.length === 0) {
    ui.warning('No servers to start. Run: overdrive setup');
    return;
  }

  ui.info(`Starting ${scripts.length} server(s)...\n`);

  // Show what's starting
  scripts.forEach(script => {
    ui.status(script.name, `port ${script.port}`, 'info');
  });

  ui.divider();
  ui.info('Opening terminals... (requires manual window setup)');
  ui.warning('Commands to run in separate terminals:');

  scripts.forEach(script => {
    console.log(`\n${script.name}:`);
    console.log(`  cd ${script.cwd}`);
    console.log(`  npm run dev`);
  });

  ui.divider();
  ui.info('After starting all servers, verify with:');
  console.log('  overdrive status');

  ui.divider();
}

module.exports = { execute };
