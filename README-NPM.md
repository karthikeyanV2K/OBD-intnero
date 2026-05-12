# 🎛️ Overdrive AI Agent

**Unified MCP (Model Context Protocol) server** for AI coding with persistent knowledge graph, 60-80% token compression, and multi-model support across Claude, VS Code Copilot, and Kiro IDE.

[![npm version](https://img.shields.io/npm/v/overdrive-ai-agent.svg)](https://www.npmjs.com/package/overdrive-ai-agent)
[![Node.js version](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

- 🧠 **Graph-Based Knowledge** — OverdriveDB with 6 optimized engines
- 🤖 **Multi-Model Support** — Claude (Sonnet/Opus) + GPT-4 with mid-session switching
- 📉 **Token Compression** — 60-80% reduction via semantic graph compression
- 🔗 **Reference Resolution** — Understands "that bug" → actual prior task
- 🔀 **Flexible Modes** — Shared (cross-project learning) or Independent (isolated)
- 🎯 **MCP Protocol** — Connect Claude.app, VS Code, Kiro IDE simultaneously
- ⚡ **CLI Tools** — Visual commands for status, setup, monitoring
- 🌐 **REST API** — HTTP endpoints for programmatic access

---

## 🚀 Quick Start

### 1. Install globally

```bash
npm install -g overdrive-ai-agent
```

### 2. Setup

```bash
overdrive setup
# Interactive wizard creates project configs
```

### 3. Run servers

```bash
overdrive run all
# Opens guide for terminal commands
```

### 4. Verify

```bash
overdrive status
# Shows running servers, databases, projects
```

### 5. Connect IDE

- **Claude.app**: Settings → MCP → Add Server → point to MCP config
- **VS Code**: Copilot Chat → MCP Settings → Add configuration
- **Kiro IDE**: Tools → MCP Configuration → Add server

---

## 🎯 CLI Commands

All commands are available globally after installation:

```bash
overdrive status          # Show running servers & DBs
overdrive projects        # List all projects & modes
overdrive setup           # Interactive setup wizard
overdrive run all         # Start all servers
overdrive run shared      # Start shared core only
overdrive run independent # Start independent agents only
overdrive test            # Test API connectivity
overdrive config view     # Show all configurations
overdrive config validate # Validate configs
overdrive info            # Show system architecture
overdrive help            # Show help
overdrive -v              # Show version
```

---

## 📦 Two Deployment Modes

### 🔄 Shared Mode (Recommended for Teams)

One core agent, multiple projects share knowledge:

```bash
$ overdrive projects

project-a  │shared  │http://localhost:3001  │project-a
project-b  │shared  │http://localhost:3001  │project-b
```

- ✅ Cross-project learning
- ✅ Lower cost & memory
- ✅ Single database

### 🔐 Independent Mode (Isolated Knowledge)

Each project has own agent:

```bash
$ overdrive projects

project-c  │independent  │3002  │project-c
project-d  │independent  │3003  │project-d
```

- ✅ Project isolation
- ✅ Private knowledge
- ❌ Higher cost

### 🎨 Hybrid Mode (Best of Both)

Mix shared + local databases per project.

---

## 📋 What Gets Compressed?

### Normal Chat: ~10,000 tokens
```
Full message history, all code bodies, all context
```

### Compressed: ~500-800 tokens
```
✓ Task summaries
✓ Last 3 reasoning steps
✓ Function signatures (not bodies)
✓ Current model
```

**Result: 60-80% token reduction**

---

## 🛠️ System Architecture

```
┌─ Unified MCP Server ─┐
│  Claude, VS Code     │
│  Kiro IDE            │
└──────────┬───────────┘
           ↓
┌─ OverdriveDB (6 Engines) ─┐
│ Graph  Vector  TimeSeries  │
│ Stream  RAM  Disk          │
└──────────┬─────────────────┘
           ↓
┌─ Model Router ─┐
│ Claude, GPT-4  │
│ Switch mid-    │
│ session        │
└────────────────┘
```

### 6 Database Engines

| Engine | Purpose | Capacity |
|--------|---------|----------|
| **Graph** | Tasks, reasoning, code as nodes | Unlimited |
| **Vector** | Semantic search (384-dim) | Unlimited |
| **TimeSeries** | Token/latency metrics (90 days) | Rolling window |
| **Streaming** | Task queue (4 partitions) | 1GB |
| **RAM** | Session snapshots | 64MB |
| **Disk** | Persistent storage | Disk limit |

---

## 🎛️ Visual Command Examples

### Check Status

```bash
$ overdrive status

✅ Core Agent (localhost:3001): Running
✅ Independent Agent (localhost:3002): Running
✅ Main Graph DB: 2.45 MB
✅ 4 projects configured
```

### List Projects

```bash
$ overdrive projects

Project    │Mode          │Port/URL                │Name
───────────┼───────────────┼───────────────────────┼─────────
project-a  │shared         │http://localhost:3001  │project-a
project-b  │shared         │http://localhost:3001  │project-b
project-c  │independent    │3002                   │project-c
project-d  │independent    │3003                   │project-d
```

### View Architecture

```bash
$ overdrive info

Environment:   Node v18.16.0, win32
Package:       overdrive-ai-agent v1.0.0
Dependencies:  OverdriveDB, Claude SDK, OpenAI, MCP SDK
Features:      Graph DB, Vector Search, MCP Protocol
```

---

## 📁 Project Structure

After setup, you have:

```
x:\core-agent\                 ← Shared (used by projects)
  ├── mcp-server.js
  ├── server.js
  ├── agent-db.js
  ├── package.json
  └── agent-graph.odb

x:\project-a\                  ← Uses shared core
  ├── .agent-config.json
  └── ask-agent.js

x:\project-c\                  ← Independent
  ├── agent/
  │   ├── mcp-server.js
  │   ├── server.js
  │   ├── agent-db.js
  │   └── agent-graph.odb
  ├── .agent-config.json
  └── ask-agent.js
```

---

## 🔗 Integration Examples

### Use in Claude.app

```
User: @overdrive-agent write a React button component
Agent: [Queries knowledge graph] [Routes to Claude] [Returns code + reasoning]
```

### Use in VS Code

```
User: @overdrive-agent fix the TypeScript error
Agent: [Searches prior tasks] [References context] [Provides solution]
```

### Use in Kiro IDE

```
User: overdrive ask_agent 'generate API endpoint'
Agent: [Looks up similar endpoints] [Uses graph context] [Returns code]
```

---

## ⚙️ Configuration

### .env (Core Agent)

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
MODEL_DEFAULT=claude-sonnet-4
LOG_LEVEL=info
```

### .agent-config.json (Each Project)

**Shared Mode:**
```json
{
  "mode": "shared",
  "agent_url": "http://localhost:3001",
  "project_name": "project-a"
}
```

**Independent Mode:**
```json
{
  "mode": "independent",
  "agent_port": 3002,
  "project_name": "project-c"
}
```

---

## 🔌 MCP Tools Available

Access these tools from any connected IDE:

- `ask_agent` — Submit task, get code + reasoning
- `switch_model` — Change models mid-session (Claude → GPT-4)
- `query_graph` — Search knowledge graph by type
- `get_session_context` — Get compressed context
- `get_model_stats` — Token usage, latency, quality
- `store_task_result` — Save task to graph
- `submit_async_task` — Queue async processing
- `get_task_status` — Check async task status

---

## 📚 Documentation

- **[CLI-GUIDE.md](CLI-GUIDE.md)** — Complete CLI reference with examples
- **[WORKFLOWS.md](WORKFLOWS.md)** — Common tasks and workflows
- **[NPM-PUBLISH.md](NPM-PUBLISH.md)** — Publishing to npm registry
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — System design diagrams
- **[MCP_INTEGRATION.md](MCP_INTEGRATION.md)** — Detailed MCP protocol docs
- **[PROJECT-BRANCHING-DUAL.md](PROJECT-BRANCHING-DUAL.md)** — Shared/Independent setup
- **[SETUP-MCP.md](SETUP-MCP.md)** — Step-by-step MCP configuration

---

## 🛠️ Development

### Clone and setup

```bash
git clone https://github.com/yourusername/overdrive-ai-agent.git
cd overdrive-ai-agent
npm install
npm run dev     # Start all servers
npm run cli     # Run CLI
```

### Running locally without global install

```bash
npm run cli status    # Instead of: overdrive status
npm run cli setup     # Instead of: overdrive setup
npm run cli run all   # Instead of: overdrive run all
```

### Add custom commands

Create new file: `lib/cli/commands/my-command.js`

```javascript
async function execute(args, ui) {
  ui.section('My Command');
  ui.success('Implementation here');
}
module.exports = { execute };
```

Use it:
```bash
overdrive my-command
```

---

## 🚀 Scaling

### Single Team (Shared)

```bash
overdrive run shared
# One agent on localhost:3001
# All projects use it
```

### Multiple Teams (Independent)

```bash
overdrive run independent
# Each project has own agent
# Isolated knowledge bases
```

### Enterprise (Hybrid)

```bash
# Some projects shared, some independent
# Mix modes as needed
# Migrate anytime
```

---

## 🔍 Monitoring

### Real-time status

```bash
watch overdrive status
# Updates every 2 seconds
```

### Check metrics

```bash
# From IDE:
get_model_stats

# Returns:
# - Average tokens per request
# - Latency per model
# - Quality scores
# - Compression ratio
```

### View logs

```bash
# Terminal 1: MCP server logs
# Terminal 2: HTTP API logs
# Terminal 3: Task worker logs
```

---

## 🐛 Troubleshooting

### Servers not starting?

```bash
$ overdrive status          # Check what's running
$ overdrive test            # Test connectivity
$ overdrive config validate # Validate configs
```

### Port already in use?

```bash
# Windows
netstat -ano | findstr :3001

# Linux/Mac
lsof -i :3001

# Then kill or change port in .agent-config.json
```

### API keys missing?

```bash
$ overdrive config edit .env
# Add ANTHROPIC_API_KEY and OPENAI_API_KEY
# Restart: overdrive run all
```

---

## 📊 Performance

| Metric | Value | Notes |
|--------|-------|-------|
| Token Compression | 60-80% | Via semantic graph |
| API Latency | ~500ms | Including model call |
| Search Speed | <100ms | Vector DB query |
| Connection Startup | <2s | Per agent |
| Memory per Agent | ~50MB | Minimum |

---

## 🛡️ Security

- ✅ Local-first storage (no cloud upload without permission)
- ✅ API keys stored in .env (not in code)
- ✅ Graph DB encrypted at rest (optional)
- ✅ MCP stdio protocol (no port exposure)
- ✅ Project isolation in independent mode

---

## 📝 License

MIT © 2024 Your Name

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'Add my-feature'`
4. Push: `git push origin feature/my-feature`
5. Open Pull Request

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/overdrive-ai-agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/overdrive-ai-agent/discussions)
- **Email**: your.email@example.com

---

## 🎉 Getting Started

```bash
# 1. Install
npm install -g overdrive-ai-agent

# 2. Setup
overdrive setup

# 3. Run
overdrive run all

# 4. Verify
overdrive status

# 5. Connect IDE
# Follow instructions for Claude/VS Code/Kiro

# 6. Use
# In IDE: @overdrive-agent ask_agent 'your task'
```

---

**Ready? Start with:** `npm install -g overdrive-ai-agent` 🚀

For detailed docs, see [CLI-GUIDE.md](CLI-GUIDE.md) and [WORKFLOWS.md](WORKFLOWS.md)
