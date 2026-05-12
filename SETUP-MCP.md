# Full Setup Guide: MCP Integration with OverdriveDB Agent

## 📋 What You'll Have After Setup

```
One OverdriveDB AI Agent
         ↓
    MCP Server (one instance)
    ↙      ↓        ↘
Claude    VS Code   Kiro
(claude.app) (Copilot) (IDE)
```

All three tools use **the same MCP server** to access your knowledge graph, run tasks, and switch models mid-session.

---

## 🚀 Installation (5 minutes)

### Step 1: Install dependencies

```bash
cd x:\OBD-intnero
npm install
npm install @modelcontextprotocol/sdk
```

### Step 2: Set up environment

```bash
cp .env.example .env
```

Edit `.env`:
```
ANTHROPIC_API_KEY=sk-ant-YOUR_ACTUAL_KEY
OPENAI_API_KEY=sk-YOUR_ACTUAL_KEY
PORT=3001
DEFAULT_MODEL=claude-sonnet-4-6
```

### Step 3: Test that it works

```bash
# Terminal 1: Start MCP server
npm run mcp

# Terminal 2 (new): Test HTTP endpoint
curl -X POST http://localhost:3001/task \
  -H "Content-Type: application/json" \
  -d '{"task": "write a hello world function", "model": "claude-sonnet-4-6"}'
```

You should see a response like:
```json
{
  "result": {
    "code": "function helloWorld() { return 'Hello, World!'; }",
    "model": "claude-sonnet-4-6",
    "tokensUsed": 124
  }
}
```

✅ **MCP server is working!**

---

## 📱 Option 1: Connect Claude (claude.app)

### MacOS / Linux

```bash
# Find your Claude config file location
open ~/.claude/
# or
nano ~/.claude/claude.json
```

### Windows

```
C:\Users\<YourUsername>\AppData\Roaming\Claude\claude.json
```

Paste this (update path):
```json
{
  "mcpServers": {
    "overdrive-agent": {
      "command": "node",
      "args": ["C:\\Users\\<YourUsername>\\path\\to\\OBD-intnero\\mcp-server.js"],
      "disabled": false,
      "autoApprove": ["ask_agent", "query_graph", "get_session_context"]
    }
  }
}
```

**Then:**
1. Restart Claude desktop
2. Type in Claude: `I need your help with a coding task`
3. Claude will show you the tools available from MCP
4. Use it: `@overdrive-agent ask_agent "create a login function"`

---

## 💻 Option 2: Connect VS Code Copilot

### Step 1: Enable MCP in VS Code settings

Open VS Code **Settings** (Ctrl+,) and search for "MCP"

Add to your `settings.json`:
```json
{
  "copilot.enable": true,
  "[copilot.advanced]": {
    "mcpServers": {
      "overdrive-agent": {
        "command": "node",
        "args": ["C:\\Users\\<YourUsername>\\path\\to\\OBD-intnero\\mcp-server.js"]
      }
    }
  }
}
```

### Step 2: Use it

1. Open Copilot panel (Ctrl+Shift+P → "Copilot: Focus on Chat")
2. Type: `@overdrive-agent ask_agent 'fix the bug in fetchUser'`
3. Copilot calls your agent with graph context automatically

---

## 🔧 Option 3: Connect Kiro IDE

### Step 1: Locate Kiro config

Find Kiro's settings file (usually one of these):
- `~/.kiro/settings.json`
- `%APPDATA%\Kiro\config.json`
- Kiro's built-in settings UI

### Step 2: Add MCP section

```json
{
  "mcp": {
    "servers": {
      "overdrive-agent": {
        "command": "node",
        "args": ["/absolute/path/to/OBD-intnero/mcp-server.js"]
      }
    }
  }
}
```

### Step 3: Use it

In Kiro, use the AI assistant:
- `@overdrive-agent ask_agent 'task here'`
- `@overdrive-agent switch_model new_model=gpt-4o current_task_id=task_123`
- `@overdrive-agent query_graph node_type=CodeBlock`

---

## ⚙️ Architecture: How it Works

```
┌─────────────────────────────────────────────┐
│  Claude + VS Code Copilot + Kiro IDE        │
│  (MCP Clients)                              │
└──────────────┬──────────────────────────────┘
               │
               │ (MCP Protocol)
               │ (stdio-based)
               ▼
┌─────────────────────────────────────────────┐
│  mcp-server.js                              │
│  - Exposes 8 tools                          │
│  - Routes requests to agent                 │
└──────────────┬──────────────────────────────┘
               │
      ┌────────┼────────┐
      ▼        ▼        ▼
   model-  agent-db knowledge
  router.js (6 engines) .js
      
    ↓ ↓ ↓
Graph Vector TimeSeries Streaming RAM Disk
DB    DB     DB         DB        DB  DB
```

**Key insight:** When Claude says "switch to GPT-4":
1. MCP server calls `switch_model('gpt-4o')`
2. Model router takes a RAM snapshot
3. Writes a ModelSwitch node to graph
4. Loads compressed context (400-600 tokens)
5. GPT-4 resumes with full context, no chat history bloat
6. All three tools see the same state

---

## 🛠️ Advanced: Custom Workflows

### Example 1: Code review across models

```
Claude: "review this code"
└─ @overdrive-agent ask_agent 'code review' (uses claude-sonnet-4-6)

User: "now use GPT-4 for a second opinion"
└─ Claude: @overdrive-agent switch_model new_model=gpt-4o
└─ GPT-4 resumes, sees claude's review in graph
└─ Provides different perspective based on the context

User: "which model was faster?"
└─ Claude: @overdrive-agent get_model_stats
└─ Returns latency + token cost for both
```

### Example 2: Persistent knowledge across sessions

```
Session 1 (Today):
- User asks about "fetchUser function"
- Agent stores task → code → reasoning in graph

Session 2 (Tomorrow):
- New Claude conversation
- User: "fix that thing"
- Agent resolves "that thing" to yesterday's task ✅
- Full context maintained across sessions
```

### Example 3: Async task processing

```
User: "build a full module (this takes time)"
└─ @overdrive-agent submit_async_task priority=high
└─ Returns task_id immediately

... user keeps working ...

User: "check on that task"
└─ @overdrive-agent get_task_status task_id=...
└─ Returns: COMPLETE, code, metrics
```

---

## 🧪 Testing Your Setup

### Test 1: MCP server is running

```bash
ps aux | grep "node mcp-server"
# or on Windows:
tasklist | findstr node
```

Should show running `mcp-server.js`

### Test 2: Check logs

```bash
# Terminal where MCP started should show:
# [MCP] Server started. Ready for connections...
```

### Test 3: Test from Claude

In claude.app, say:
```
Ask the overdrive agent to write a function that returns the square of a number
```

Claude should call `ask_agent` tool automatically.

### Test 4: Check graph persistence

```bash
# Files should exist in OBD-intnero/
ls -la agent-*.odb
# Should show:
# agent-graph.odb (tasks, reasoning, code)
# agent-vectors.odb (embeddings)
# agent-metrics.odb (performance data)
# etc.
```

---

## 📊 Monitoring & Debugging

### View recent agent calls

```bash
# In a terminal:
curl http://localhost:3001/stats
# Returns token usage, model performance, queue status
```

### Clear old data (careful!)

```bash
# Remove graph to reset
rm agent-graph.odb agent-*.odb

# Restart:
npm run mcp
```

### Check task queue status

```bash
curl http://localhost:3001/queue/status
```

### Enable verbose logging

```bash
NODE_DEBUG=* npm run mcp
# or just MCP:
DEBUG=mcp:* npm run mcp
```

---

## 🔐 Security Best Practices

1. **Never commit `.env`**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Use separate API keys per environment**
   ```
   .env (dev)
   .env.prod (production)
   .env.staging (testing)
   ```

3. **Limit MCP server exposure**
   - Only enable MCP on localhost (`NODE_ENV=development`)
   - In production, use firewall rules + authentication

4. **Audit token usage**
   ```bash
   curl http://localhost:3001/stats/tokens?hours=24
   # See which models, tasks cost most
   ```

---

## 🎯 What to do next

1. **Get it running:**
   ```bash
   npm run mcp      # Terminal 1: MCP server
   npm run server   # Terminal 2: HTTP API
   npm run worker   # Terminal 3: Task queue
   ```

2. **Connect one tool** (start with Claude or VS Code)

3. **Test a task:**
   - Ask: `"write a fibonacci function"`
   - Ask: `"what was that about?"`
   - Ask: `"use gpt-4 instead"`
   - Ask: `"show me all tasks from today"`

4. **Expand:**
   - Connect the other two tools
   - Create custom MCP tools (add to `mcp-server.js`)
   - Build an IDE extension for deeper integration

---

## ❓ Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| "Tool not found" | Restart the MCP server (`npm run mcp`) |
| "Connection refused" | Ensure server is running on port 3001 |
| "Invalid API key" | Check `.env`, verify keys are correct |
| "Model not supported" | Add to `ADAPTERS` in `model-router.js` |
| "Graph empty" | Submit a task first, wait 1-2 seconds |
| "High token usage" | Check `knowledge.js` compression is working |

---

## 📞 Support

- Check logs: `tail -f /var/log/mcp-server.log`
- Test endpoint: `curl http://localhost:3001/health`
- Verify tools: `curl http://localhost:3001/tools`

You're now ready to use your OverdriveDB agent from Claude, VS Code, and Kiro! 🎉
