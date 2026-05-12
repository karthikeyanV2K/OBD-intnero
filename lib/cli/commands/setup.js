/**
 * Command: setup
 * Interactive guided setup
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function execute(args, ui) {
  ui.section('Overdrive Setup Wizard');

  ui.info('This wizard will help you set up Overdrive for your projects.\n');

  // Step 1: Choose setup type
  console.log('Choose setup type:');
  console.log('  1) Shared Mode Only (all projects share one core)');
  console.log('  2) Independent Mode (each project has own agent)');
  console.log('  3) Hybrid Mode (mix of shared and independent)');
  console.log('  4) Skip (already configured)');

  const setupType = await prompt('\nSelect (1-4): ');

  if (setupType === '4') {
    ui.warning('Setup skipped. Your projects are already configured.');
    return;
  }

  // Step 2: Verify dependencies
  ui.section('Checking Dependencies');

  const hasDeps = fs.existsSync(path.join(__dirname, '../../node_modules'));
  if (!hasDeps) {
    ui.warning('Dependencies not installed. Run: npm install');
    return;
  }
  ui.success('Dependencies installed');

  // Step 3: Check .env
  const envPath = path.join(__dirname, '../../.env');
  const envExists = fs.existsSync(envPath);
  if (!envExists) {
    ui.warning('Environment file not found. Creating from .env.example...');
    const examplePath = path.join(__dirname, '../../.env.example');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      ui.success('Created .env. Please edit with your API keys.');
      const key = await prompt('Press Enter when ready...');
    } else {
      ui.error('No .env.example found. Please create .env manually.');
      return;
    }
  } else {
    ui.success('Environment file found');
  }

  // Step 4: Create projects based on setup type
  ui.section('Creating Project Configurations');

  if (setupType === '1' || setupType === '3') {
    // Create shared projects
    const projectsToCreate = [
      { name: 'project-a', mode: 'shared' },
      { name: 'project-b', mode: 'shared' },
    ];

    for (const proj of projectsToCreate) {
      const projPath = path.join(__dirname, `../../${proj.name}`);
      if (!fs.existsSync(projPath)) {
        fs.mkdirSync(projPath, { recursive: true });
      }

      const config = {
        mode: proj.mode,
        agent_url: 'http://localhost:3001',
        project_name: proj.name,
      };

      const configPath = path.join(projPath, '.agent-config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      ui.success(`Created ${proj.name} (shared mode)`);
    }
  }

  if (setupType === '2' || setupType === '3') {
    // Create independent projects
    const projectsToCreate = [
      { name: 'project-c', port: 3002 },
      { name: 'project-d', port: 3003 },
    ];

    for (const proj of projectsToCreate) {
      const projPath = path.join(__dirname, `../../${proj.name}`);
      if (!fs.existsSync(projPath)) {
        fs.mkdirSync(projPath, { recursive: true });
      }

      const config = {
        mode: 'independent',
        agent_port: proj.port,
        project_name: proj.name,
      };

      const configPath = path.join(projPath, '.agent-config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      ui.success(`Created ${proj.name} (independent mode, port ${proj.port})`);
    }
  }

  // Summary
  ui.divider();
  ui.section('Setup Complete! 🎉');

  ui.info('Next steps:');
  console.log('  1. Run all servers:');
  console.log('     overdrive run all');
  console.log('');
  console.log('  2. Check status:');
  console.log('     overdrive status');
  console.log('');
  console.log('  3. Connect your IDE to MCP server');

  ui.divider();
}

module.exports = { execute };
