# MCP Integration Guide

## One Server, Three Tools

Your OverdriveDB agent is now accessible via **MCP (Model Context Protocol)** from:
- **Anthropic Claude** (claude.app)
- **VS Code Copilot**
- **Kiro IDE**

---

## 1. Setup: Update package.json

First, install MCP SDK:

```bash
npm install @modelcontextprotocol/sdk
npm install
```

Then update `package.json` scripts:

```json
"scripts": {
  "mcp": "node mcp-server.js",
  "mcp-dev": "node mcp-server.js",
  "start": "node server.js",
  "dev": "concurrently \"npm run mcp\" \"npm run server\" \"npm run worker\""
}
```

Start MCP server:
```bash
npm run mcp
```

---

## 2. Anthropic Claude (via claude.app)

### Configure for Claude

Create/edit `~/.claude/claude.json` (MacOS/Linux) or `%APPDATA%\Claude\claude.json` (Windows):

```json
{
  "mcpServers": {
    "overdrive-agent": {
      "command": "node",
      "args": ["/path/to/OBD-intnero/mcp-server.js"],
      "disabled": false,
      "autoApprove": ["ask_agent", "query_graph", "get_session_context"]
    }
  }
}
```

**Replace `/path/to/` with your actual folder path.**

### Use in Claude

Once configured, Claude will have access to these tools:

```
User: Fix that bug in fetchUser
Claude: [calls ask_agent tool with graph context]
→ Agent resolves "that bug" from prior tasks → submits to claude-sonnet-4-6
→ Returns fixed code + stores in graph

User: But use GPT-4 instead
Claude: [calls switch_model tool]
→ Model switches, takes RAM snapshot, resumes with gpt-4o
```

---

## 3. VS Code Copilot

### Configure for Copilot

Update your VS Code `settings.json`:

```json
{
  "copilot.enable": true,
  "[mcp-servers]": {
    "overdrive-agent": {
      "command": "node",
      "args": ["/path/to/OBD-intnero/mcp-server.js"]
    }
  }
}
```

**OR** install via extension (if you create one):

In your `extension.ts` or `package.json` `contributes`:

```json
"contributes": {
  "mcpServers": {
    "overdrive-agent": {
      "command": "node",
      "args": ["mcp-server.js"]
    }
  }
}
```

### Use in VS Code

```
Copilot: @agent ask_agent 'fix that error'
→ Tool calls your MCP server
→ Agent responds with code fix + updates graph

Copilot: @agent query_graph node_type=CodeBlock
→ Returns recent code blocks from graph
```

---

## 4. Kiro IDE

Similar to VS Code. Configure in Kiro's settings:

```json
{
  "mcp": {
    "servers": {
      "overdrive-agent": {
        "command": "node",
        "args": ["/path/to/mcp-server.js"]
      }
    }
  }
}
```

---

## 5. Available MCP Tools

Once connected, all clients can call:

| Tool | What it does | Use case |
|------|-------------|----------|
| `ask_agent` | Submit task, get code + reasoning | "Write a function that..." |
| `switch_model` | Switch models mid-session | "Now use GPT-4" |
| `query_graph` | Search knowledge graph | "Show me all errors from today" |
| `get_session_context` | Get current session state | "What was I working on?" |
| `get_model_stats` | Model performance metrics | "Which model is fastest?" |
| `store_task_result` | Manually store work to graph | Log external work |
| `submit_async_task` | Queue long task | Big refactors, batch ops |
| `get_task_status` | Check queued task progress | Poll async work |

---

## 6. Environment Setup

Make sure `.env` is set (copy from `.env.example`):

```bash
cp .env.example .env
# Fill in your API keys
export ANTHROPIC_API_KEY=sk-ant-xxx
export OPENAI_API_KEY=sk-xxx
export PORT=3001
export DEFAULT_MODEL=claude-sonnet-4-6
```

---

## 7. Test the connection

Once MCP server is running:

```bash
# Terminal 1 — start MCP server
npm run mcp

# Terminal 2 — test via cURL (for HTTP server)
curl -X POST http://localhost:3001/task \
  -H "Content-Type: application/json" \
  -d '{"task": "create a hello world function", "model": "claude-sonnet-4-6"}'

# Or test MCP directly via Claude
# In claude.app, type: @overdrive-agent ask_agent 'hello world'
```

Expected output:
```json
{
  "result": {
    "code": "function helloWorld() { return 'Hello, World!'; }",
    "reasoning": "Simple function that returns greeting",
    "tokensUsed": 124,
    "model": "claude-sonnet-4-6"
  }
}
```

---

## 8. Architecture: How MCP connects the three tools

```
Claude (claude.app)
    ↓ (MCP client)
    ├─→ MCP Server (mcp-server.js)
    │      ├─→ model-router.js
    │      ├─→ agent-db.js (6 engines)
    │      └─→ knowledge.js (token compression)
    │
VS Code Copilot
    ↓ (MCP client)
    └─→ [same MCP server]

Kiro IDE
    ↓ (MCP client)
    └─→ [same MCP server]
```

**One server, infinite clients.**

---

## 9. Advanced: Custom tool expansion

To add a new MCP tool:

1. Add to `tools` array in `mcp-server.js`:
```js
{
  name: 'my_new_tool',
  description: 'What it does',
  inputSchema: { /* ... */ }
}
```

2. Add handler in `handleToolCall()`:
```js
case 'my_new_tool':
  // your code
  return { content: [{ type: 'text', text: result }] };
```

3. Restart MCP server
4. All three tools now have access immediately

---

## 10. Troubleshooting

| Issue | Fix |
|-------|-----|
| "MCP server not found" | Check config path is absolute (not relative) |
| Timeout calling agent | Ensure `npm run mcp` is running + `node_modules/@modelcontextprotocol` exists |
| "No adapter for model" | Add model to `ADAPTERS` in `model-router.js` |
| Graph queries empty | Seed with `submit_task`, or check `.odb` files exist |
| Token usage too high | Check `knowledge.js` compression is running (`storeAgentTurn` called) |

---

## Quick reference: Start everything

```bash
# Terminal 1 — MCP server (for Claude, VS Code, Kiro)
npm run mcp

# Terminal 2 — HTTP server (for Chrome extension, manual API)
npm run server

# Terminal 3 — Task worker (processes queued tasks)
npm run worker

# Or all at once:
npm run dev
```

That's it. Your agent is now accessible from three tools via one MCP server.
