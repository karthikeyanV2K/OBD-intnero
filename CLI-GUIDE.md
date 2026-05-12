# 🎛️ Overdrive CLI - Complete Visual Guide

Use `overdrive` command globally after `npm install -g overdrive-ai-agent`

---

## Installation

### Option 1: Global npm package (Recommended)

```bash
npm install -g overdrive-ai-agent
```

Then use from anywhere:
```bash
overdrive status
overdrive help
```

### Option 2: Local development

```bash
cd x:\OBD-intnero
npm install
npm run cli status
```

### Option 3: Clone & build

```bash
git clone https://github.com/yourusername/overdrive-ai-agent.git
cd overdrive-ai-agent
npm install
npm link  # Creates global link
overdrive status
```

---

## Quick Start - 3 Commands

```bash
# 1. See what's available
overdrive info

# 2. Setup your projects
overdrive setup

# 3. Start everything
overdrive run all
```

---

## Command Reference

### `overdrive help` or `overdrive -h`

**Shows all commands and usage**

```bash
$ overdrive help

╔══════════════════════════════════════════════════════════════╗
║           🎛️  OVERDRIVE AI AGENT CLI v1.0.0               ║
║       Unified MCP for Claude, VS Code, Kiro IDE             ║
╚══════════════════════════════════════════════════════════════╝

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
```

---

### `overdrive status`

**See all running servers and databases**

```bash
$ overdrive status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  System Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Core Agent (localhost:3001): Running
✅ Independent Agent (localhost:3002): Running
✅ Independent Agent (localhost:3003): Running

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Databases
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Main Graph DB: 2.45 MB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Projects Found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ project-a: shared mode
✅ project-b: shared mode
✅ project-c: independent mode
✅ project-d: independent mode
```

---

### `overdrive projects`

**List all projects and their configuration**

```bash
$ overdrive projects

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Projects Overview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project       │Mode          │Port/URL               │Name
──────────────┼───────────────┼──────────────────────┼──────────────
project-a     │shared         │http://localhost:3001 │project-a
project-b     │shared         │http://localhost:3001 │project-b
project-c     │independent    │3002                  │project-c
project-d     │independent    │3003                  │project-d

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Total Projects: 4
ℹ️  Shared Mode: 2
ℹ️  Independent Mode: 2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Next Steps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Start servers:  overdrive run all
Check status:   overdrive status
View config:    overdrive config
```

---

### `overdrive setup`

**Interactive guided configuration**

```bash
$ overdrive setup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Overdrive Setup Wizard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  This wizard will help you set up Overdrive for your projects.

Choose setup type:
  1) Shared Mode Only (all projects share one core)
  2) Independent Mode (each project has own agent)
  3) Hybrid Mode (mix of shared and independent)
  4) Skip (already configured)

Select (1-4): 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Checking Dependencies
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Dependencies installed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Creating Project Configurations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Created project-a (shared mode)
✅ Created project-b (shared mode)
✅ Created project-c (independent mode, port 3002)
✅ Created project-d (independent mode, port 3003)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Setup Complete! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next steps:
  1. Run all servers:
     overdrive run all

  2. Check status:
     overdrive status

  3. Connect your IDE to MCP server
```

---

### `overdrive run all` | `shared` | `independent`

**Start servers (opens visual guide for terminal commands)**

```bash
$ overdrive run all

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Starting Servers (ALL mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Starting 3 server(s)...

ℹ️  Core Agent (Shared): port 3001
ℹ️  project-c Agent: port 3002
ℹ️  project-d Agent: port 3003

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Opening terminals... (requires manual window setup)
⚠️  Commands to run in separate terminals:

Core Agent (Shared):
  cd x:\core-agent
  npm run dev

project-c Agent:
  cd x:\project-c\agent
  npm run dev

project-d Agent:
  cd x:\project-d\agent
  npm run dev

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  After starting all servers, verify with:
  overdrive status
```

---

### `overdrive test`

**Test connectivity to all agents**

```bash
$ overdrive test

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  API Connectivity Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Port 3001 (Connection): Responding
✅ Port 3001 (Task): Working
✅ Port 3002 (Connection): Responding
✅ Port 3002 (Task): Working
✅ Port 3003 (Connection): Responding
✅ Port 3003 (Task): Working

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Connection test complete. Use "overdrive status" for detailed info.
```

---

### `overdrive config view` | `edit` | `validate`

**Manage configuration files**

```bash
$ overdrive config view

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Configurations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  .env (Core Configuration)
  ANTHROPIC_API_KEY=sk-ant-...
  OPENAI_API_KEY=sk-...
  MODEL_DEFAULT=claude-sonnet-4
  ... (truncated)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  project-a (.agent-config.json)
  {
    "mode": "shared",
    "agent_url": "http://localhost:3001",
    "project_name": "project-a"
  }

... (similar for other projects)
```

Validate configuration:
```bash
$ overdrive config validate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Configuration Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ .env has API keys
✅ project-a config valid
✅ project-b config valid
✅ project-c config valid
✅ project-d config valid

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All configurations valid!
```

---

### `overdrive info`

**Show complete system architecture**

```bash
$ overdrive info

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  System Information
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Environment
  Node: v18.16.0
  OS: win32 x64
  CWD: x:\OBD-intnero

ℹ️  Package Info
  Name: overdrive-ai-agent
  Version: 1.0.0
  Description: Unified AI coding agent with MCP integration...
  License: MIT

ℹ️  Key Dependencies
  OverdriveDB: ^2.3.0
  Anthropic SDK: ^0.39.0
  OpenAI SDK: ^4.0.0
  Express: ^4.18.0
  MCP SDK: ^0.5.0

ℹ️  Features
  ✅ Graph Database (OverdriveDB)
  ✅ Vector Search (384-dim embeddings)
  ✅ Time Series Analytics
  ✅ Streaming Task Queue
  ✅ Model Context Protocol (MCP)
  ✅ Multi-model Support (Claude + GPT-4)
  ✅ Token Compression (60-80% reduction)
  ✅ Reference Resolution
  ✅ Shared + Independent Modes
  ✅ REST API
  ✅ CLI Tools

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OverdriveDB Engines
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  • Graph DB: Task/reasoning/code nodes & edges
  • Vector DB: 384-dim semantic search
  • Time Series DB: Token/latency/quality metrics
  • Streaming DB: Task queue + event bus
  • RAM DB: Session state snapshots
  • Disk DB: Persistent knowledge base

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Architecture
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ┌─── Unified MCP Server ───┐
  │  • stdio-based protocol
  │  • Claude.app
  │  • VS Code Copilot
  │  • Kiro IDE
  └───────────────────────────┘
          ↓
  ┌─── OverdriveDB (6 Engines) ───┐
  │  Graph | Vector | TimeSeries
  │  Streaming | RAM | Disk
  └──────────────────────────────────┘
          ↓
  ┌─── Model Router ───┐
  │  • Claude Sonnet
  │  • Claude Opus
  │  • GPT-4
  │  • GPT-4 Turbo
  └─────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Default Ports
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  3001  →  Core Agent (Shared)              (HTTP)
  3002  →  Project-C Agent                  (HTTP)
  3003  →  Project-D Agent                  (HTTP)
  3004  →  Available                        (HTTP)
  3005  →  Available                        (HTTP)

... (full detailed output)
```

---

## Advanced Usage

### Check specific project config:

```bash
$ overdrive config view project-a

Shows only project-a configuration
```

### Start only shared mode:

```bash
$ overdrive run shared

# Only core agent starts on localhost:3001
# Use for all projects using shared mode
```

### Start only independent:

```bash
$ overdrive run independent

# Only independent agents start on 3002, 3003, etc
# Use for projects with their own databases
```

### Reset configuration:

```bash
$ overdrive setup
# Select "Skip" if already configured, or restart from beginning
```

---

## Shell Aliases (Optional)

Add to `.bashrc` or `.zshrc` or Windows `PATH`:

```bash
# Linux/Mac - add to ~/.bashrc or ~/.zshrc
alias overdrive-status='overdrive status'
alias overdrive-projects='overdrive projects'
alias overdrive-start='overdrive run all'
alias overdrive-test='overdrive test'

# Then use:
overdrive-status
overdrive-projects
overdrive-start
```

---

## Integration with IDEs

### Claude.app

1. Start servers: `overdrive run all`
2. Check MCP config: `overdrive config view`
3. Connect: Settings → MCP → Add Server
4. Use: `@overdrive-agent ask_agent 'write button component'`

### VS Code

1. Start servers: `overdrive run all`
2. Check config: `overdrive config view`
3. Connect: Copilot Chat → MCP Settings
4. Use: `@overdrive-agent ask_agent 'fix this bug'`

### Kiro IDE

1. Start servers: `overdrive run all`
2. Check config: `overdrive config view`
3. Connect: Tools → MCP Configuration
4. Use: `overdrive ask_agent 'generate API endpoint'`

---

## Troubleshooting

### "command not found: overdrive"

```bash
# Install globally
npm install -g overdrive-ai-agent

# Or create alias
alias overdrive="node /path/to/bin/overdrive"
```

### "Port already in use"

```bash
# Check what's running on port 3001
lsof -i :3001    # Mac/Linux
netstat -ano | findstr :3001  # Windows

# Kill process and restart
overdrive run all
```

### "Cannot find module"

```bash
# Reinstall dependencies
npm install

# Or if global:
npm install -g overdrive-ai-agent --force
```

---

## Version Info

```bash
$ overdrive --version
Overdrive CLI v1.0.0

# Or check what's installed
npm view overdrive-ai-agent version
npm list -g overdrive-ai-agent
```

---

**Ready to use? Start with:**

```bash
overdrive info        # See everything
overdrive setup       # Setup projects
overdrive run all     # Start servers
overdrive status      # Verify running
```
