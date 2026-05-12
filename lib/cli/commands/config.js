/**
 * Command: config
 * View/edit configuration
 */

const fs = require('fs');
const path = require('path');

async function execute(args, ui) {
  const subcommand = args[0] || 'view';

  if (subcommand === 'view') {
    ui.section('Configurations');

    // Core config
    const corePath = path.join(__dirname, '../../.env');
    if (fs.existsSync(corePath)) {
      ui.info('.env (Core Configuration)');
      const content = fs.readFileSync(corePath, 'utf-8');
      const lines = content.split('\n').slice(0, 10);
      console.log('  ' + lines.join('\n  '));
      if (lines.length < content.split('\n').length) {
        console.log('  ... (truncated)');
      }
      ui.divider();
    }

    // Project configs
    const projectDirs = ['project-a', 'project-b', 'project-c', 'project-d'];
    projectDirs.forEach(dir => {
      const configPath = path.join(__dirname, `../../${dir}/.agent-config.json`);
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        ui.info(`${dir} (.agent-config.json)`);
        console.log('  ' + JSON.stringify(config, null, 2).split('\n').join('\n  '));
        ui.divider();
      }
    });

    // System config
    ui.info('System Configuration');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
    console.log(`  Version: ${pkg.version}`);
    console.log(`  Node engine: ${pkg.engines.node}`);
    console.log(`  Main entry: ${pkg.main}`);
    ui.divider();

  } else if (subcommand === 'edit') {
    const file = args[1];
    if (!file) {
      ui.error('Usage: overdrive config edit <file>');
      console.log('  Example: overdrive config edit .env');
      return;
    }

    const filePath = path.join(__dirname, `../../${file}`);
    if (!fs.existsSync(filePath)) {
      ui.error(`File not found: ${file}`);
      return;
    }

    ui.info(`Open in editor: ${filePath}`);
    // Note: Actual editor opening would require platform-specific code
    console.log(`  Manual edit: ${filePath}`);

  } else if (subcommand === 'validate') {
    ui.section('Configuration Validation');

    let valid = true;

    // Check .env
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      if (content.includes('ANTHROPIC_API_KEY=') && content.includes('OPENAI_API_KEY=')) {
        ui.success('.env has API keys');
      } else {
        ui.warning('.env missing API keys');
        valid = false;
      }
    } else {
      ui.error('.env not found');
      valid = false;
    }

    // Check project configs
    const projectDirs = ['project-a', 'project-b', 'project-c', 'project-d'];
    projectDirs.forEach(dir => {
      const configPath = path.join(__dirname, `../../${dir}/.agent-config.json`);
      if (fs.existsSync(configPath)) {
        try {
          JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          ui.success(`${dir} config valid`);
        } catch (e) {
          ui.error(`${dir} config invalid JSON`);
          valid = false;
        }
      }
    });

    ui.divider();
    if (valid) {
      ui.success('All configurations valid!');
    } else {
      ui.warning('Some configurations need attention');
    }

  } else {
    ui.error(`Unknown subcommand: ${subcommand}`);
    console.log('\nUsage:');
    console.log('  overdrive config view       - Show all configs');
    console.log('  overdrive config edit       - Edit config file');
    console.log('  overdrive config validate   - Validate configurations');
  }
}

module.exports = { execute };
