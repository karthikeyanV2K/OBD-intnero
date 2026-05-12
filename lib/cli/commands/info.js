/**
 * Command: info
 * Show system info and architecture
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

async function execute(args, ui) {
  ui.section('System Information');

  // System
  ui.info('Environment');
  console.log(`  Node: ${process.version}`);
  console.log(`  OS: ${os.platform()} ${os.arch()}`);
  console.log(`  CWD: ${process.cwd()}`);

  // Package
  ui.divider();
  ui.info('Package Info');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
  console.log(`  Name: ${pkg.name}`);
  console.log(`  Version: ${pkg.version}`);
  console.log(`  Description: ${pkg.description}`);
  console.log(`  License: ${pkg.license}`);

  // Dependencies
  ui.divider();
  ui.info('Key Dependencies');
  const deps = {
    'OverdriveDB': pkg.dependencies['overdrive-db'],
    'Anthropic SDK': pkg.dependencies['@anthropic-ai/sdk'],
    'OpenAI SDK': pkg.dependencies['openai'],
    'Express': pkg.dependencies['express'],
    'MCP SDK': pkg.dependencies['@modelcontextprotocol/sdk'],
  };
  Object.entries(deps).forEach(([name, version]) => {
    console.log(`  ${name}: ${version}`);
  });

  // Features
  ui.divider();
  ui.info('Features');
  const features = [
    '✅ Graph Database (OverdriveDB)',
    '✅ Vector Search (384-dim embeddings)',
    '✅ Time Series Analytics',
    '✅ Streaming Task Queue',
    '✅ Model Context Protocol (MCP)',
    '✅ Multi-model Support (Claude + GPT-4)',
    '✅ Token Compression (60-80% reduction)',
    '✅ Reference Resolution',
    '✅ Shared + Independent Modes',
    '✅ REST API',
    '✅ CLI Tools',
  ];
  features.forEach(f => console.log(`  ${f}`));

  // Databases
  ui.divider();
  ui.info('OverdriveDB Engines');
  const engines = [
    { name: 'Graph DB', desc: 'Task/reasoning/code nodes & edges' },
    { name: 'Vector DB', desc: '384-dim semantic search' },
    { name: 'Time Series DB', desc: 'Token/latency/quality metrics' },
    { name: 'Streaming DB', desc: 'Task queue + event bus' },
    { name: 'RAM DB', desc: 'Session state snapshots' },
    { name: 'Disk DB', desc: 'Persistent knowledge base' },
  ];
  engines.forEach(e => console.log(`  • ${e.name}: ${e.desc}`));

  // Architecture
  ui.divider();
  ui.section('Architecture');

  console.log(`
  ${colors.cyan}┌─── Unified MCP Server ───┐${colors.reset}
  ${colors.cyan}│${colors.reset}  • stdio-based protocol
  ${colors.cyan}│${colors.reset}  • Claude.app
  ${colors.cyan}│${colors.reset}  • VS Code Copilot
  ${colors.cyan}│${colors.reset}  • Kiro IDE
  ${colors.cyan}└───────────────────────────┘${colors.reset}
          ↓
  ${colors.cyan}┌─── OverdriveDB (6 Engines) ───┐${colors.reset}
  ${colors.cyan}│${colors.reset}  Graph | Vector | TimeSeries
  ${colors.cyan}│${colors.reset}  Streaming | RAM | Disk
  ${colors.cyan}└──────────────────────────────────┘${colors.reset}
          ↓
  ${colors.cyan}┌─── Model Router ───┐${colors.reset}
  ${colors.cyan}│${colors.reset}  • Claude Sonnet
  ${colors.cyan}│${colors.reset}  • Claude Opus
  ${colors.cyan}│${colors.reset}  • GPT-4
  ${colors.cyan}│${colors.reset}  • GPT-4 Turbo
  ${colors.cyan}└─────────────────────┘${colors.reset}
  `);

  // Token compression
  ui.divider();
  ui.section('Token Compression');
  console.log(`
  Normal chat history:    ~10,000 tokens
  Compressed context:     ~500-800 tokens
  ${colors.green}Reduction: 60-80%${colors.reset}

  How it works:
  • Extract task summaries
  • Keep last 3 reasoning steps
  • Store function signatures (not bodies)
  • Track current model only
  `);

  // Mode comparison
  ui.divider();
  ui.section('Deployment Modes');
  console.log(`
  SHARED MODE
  • One core agent (localhost:3001)
  • Multiple projects share knowledge
  • Cross-project learning enabled
  • Lower cost & memory
  • Example: Project-A, Project-B

  INDEPENDENT MODE
  • Separate agents per project
  • Isolated knowledge graphs
  • No cross-project learning
  • Higher cost, more memory
  • Example: Project-C, Project-D

  HYBRID MODE
  • Shared core + local databases
  • Best of both worlds
  • Shared knowledge + private notes
  • Recommended for teams
  `);

  // URLs and ports
  ui.divider();
  ui.section('Default Ports');
  const ports = [
    { port: 3001, service: 'Core Agent (Shared)', type: 'HTTP' },
    { port: 3002, service: 'Project-C Agent', type: 'HTTP' },
    { port: 3003, service: 'Project-D Agent', type: 'HTTP' },
    { port: 3004, service: 'Available', type: 'HTTP' },
    { port: 3005, service: 'Available', type: 'HTTP' },
  ];
  ports.forEach(p => {
    console.log(`  ${p.port}  →  ${p.service.padEnd(30)} (${p.type})`);
  });

  // MCP tools
  ui.divider();
  ui.section('MCP Tools Available');
  const tools = [
    { name: 'ask_agent', desc: 'Submit task to model, get code + reasoning' },
    { name: 'switch_model', desc: 'Mid-session model switching with context preservation' },
    { name: 'query_graph', desc: 'Search knowledge graph by node type/filters' },
    { name: 'get_session_context', desc: 'Get compressed context for current session' },
    { name: 'get_model_stats', desc: 'View token usage, latency, quality metrics' },
    { name: 'store_task_result', desc: 'Save task results to graph' },
    { name: 'submit_async_task', desc: 'Queue task for async processing' },
    { name: 'get_task_status', desc: 'Check async task status' },
  ];
  tools.forEach(t => {
    console.log(`  • ${t.name.padEnd(20)} ${t.desc}`);
  });

  ui.divider();
  ui.section('Quick Commands');
  console.log(`
  overdrive status        Show running servers & DBs
  overdrive projects      List projects & modes
  overdrive setup         Interactive setup wizard
  overdrive run all       Start all servers
  overdrive test          Test API connectivity
  overdrive config view   Show configurations
  overdrive info          This information

  For more help:
  overdrive --help
  `);

  ui.divider();
}

const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  reset: '\x1b[0m',
};

module.exports = { execute };
