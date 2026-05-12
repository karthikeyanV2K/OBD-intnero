/**
 * Overdrive CLI - Main CLI Router
 */

const fs = require('fs');
const path = require('path');
const UI = require('./ui');
const commands = {
  status: require('./commands/status'),
  projects: require('./commands/projects'),
  setup: require('./commands/setup'),
  run: require('./commands/run'),
  test: require('./commands/test'),
  config: require('./commands/config'),
  info: require('./commands/info'),
};

class CLI {
  constructor() {
    this.ui = new UI();
    this.version = this.getVersion();
  }

  getVersion() {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8')
      );
      return pkg.version;
    } catch (e) {
      return '1.0.0';
    }
  }

  async execute(command, args) {
    // Show logo on first run
    if (command !== 'help' && command !== '-h' && command !== '--help') {
      this.ui.showLogo();
    }

    const cmd = commands[command];

    if (!cmd) {
      if (command === 'help' || command === '-h' || command === '--help' || !command) {
        this.showHelp();
        return;
      }
      if (command === '-v' || command === '--version') {
        console.log(`Overdrive CLI v${this.version}`);
        return;
      }
      throw new Error(`Unknown command: ${command}`);
    }

    await cmd.execute(args, this.ui);
  }

  showHelp() {
    const help = `
╔══════════════════════════════════════════════════════════════╗
║           🎛️  OVERDRIVE AI AGENT CLI v${this.version}             ║
║       Unified MCP for Claude, VS Code, Kiro IDE             ║
╚══════════════════════════════════════════════════════════════╝

USAGE: overdrive [COMMAND] [OPTIONS]

COMMANDS:

  status              Show system status (running servers, DBs)
  projects            List all projects (shared + independent)
  setup               Interactive guided setup
  run [mode]          Start servers (shared/independent/all)
  test                Test API connectivity
  config              View/edit configuration
  info                Show system info & architecture
  help, -h            Show this help
  -v, --version       Show version

EXAMPLES:

  # See what's running
  $ overdrive status

  # List all projects and modes
  $ overdrive projects

  # Setup new project
  $ overdrive setup

  # Start shared core + all independent agents
  $ overdrive run all

  # Start only shared core
  $ overdrive run shared

  # Test connectivity to agents
  $ overdrive test

  # View current config
  $ overdrive config

QUICK START:

  1. overdrive setup        # Interactive setup wizard
  2. overdrive run all      # Start all servers
  3. overdrive status       # Verify running
  4. Your IDE → connect to MCP

For detailed docs: https://github.com/your-org/overdrive-ai-agent
    `;
    console.log(help);
  }
}

module.exports = CLI;
