/**
 * Command: projects
 * List all projects and their modes
 */

const fs = require('fs');
const path = require('path');

function getProjectMode(projectDir) {
  const configPath = path.join(projectDir, '.agent-config.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config;
  } catch (e) {
    return null;
  }
}

async function execute(args, ui) {
  ui.section('Projects Overview');

  // Check for core-agent
  const coreExists = fs.existsSync(path.join(__dirname, '../../'));
  if (!coreExists) {
    ui.warning('Core agent not found. Run: overdrive setup');
    return;
  }

  // List projects
  const projectDirs = {
    'project-a': '../project-a',
    'project-b': '../project-b',
    'project-c': '../project-c',
    'project-d': '../project-d',
  };

  const rows = [];
  let sharedCount = 0;
  let independentCount = 0;

  Object.entries(projectDirs).forEach(([name, dir]) => {
    const config = getProjectMode(path.join(__dirname, dir));
    if (config) {
      const mode = config.mode || 'unknown';
      const port = config.agent_port || config.agent_url || '-';
      rows.push([
        name,
        mode,
        port,
        config.project_name || name,
      ]);

      if (mode === 'shared') sharedCount++;
      if (mode === 'independent') independentCount++;
    }
  });

  if (rows.length === 0) {
    ui.warning('No projects configured. Run: overdrive setup');
    ui.divider();
    return;
  }

  // Show table
  ui.table(['Project', 'Mode', 'Port/URL', 'Name'], rows);

  // Show summary
  ui.divider();
  ui.section('Summary');
  ui.status('Total Projects', rows.length);
  ui.status('Shared Mode', sharedCount);
  ui.status('Independent Mode', independentCount);

  // Show instructions
  ui.divider();
  ui.section('Next Steps');
  console.log(`  Start servers:  ${ui.colors?.cyan || ''}overdrive run all${ui.colors?.reset || ''}`);
  console.log(`  Check status:   ${ui.colors?.cyan || ''}overdrive status${ui.colors?.reset || ''}`);
  console.log(`  View config:    ${ui.colors?.cyan || ''}overdrive config${ui.colors?.reset || ''}`);

  ui.divider();
}

module.exports = { execute };
