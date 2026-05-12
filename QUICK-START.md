# Quick Reference: Using Your MCP Agent

**TL;DR:** One agent, three tools. All use the same MCP server.

---

## Starting Everything

```bash
# Terminal 1: MCP server (connects all three tools)
npm run mcp

# Terminal 2: HTTP API (for manual testing)
npm run server

# Terminal 3: Task queue (processes background jobs)
npm run worker

# Or all together:
npm run dev
```

---

## 🤖 Claude (claude.app)

### Setup
1. Edit `~/.claude/claude.json` (Mac/Linux) or `%APPDATA%\Claude\claude.json` (Windows)
2. Copy config from `claude-config.json`
3. Replace path with your actual folder path
4. Restart Claude

### Use

```
You: Fix that function, make it async

Claude: I'll use the OverDrive agent for this.
→ [calls ask_agent tool]
→ Agent resolves "that function" from prior tasks
→ Returns fixed code + updates graph

---

You: Actually, use GPT-4 this time

Claude: Switching to GPT-4...
→ [calls switch_model tool]
→ Takes RAM snapshot, writes to graph
→ GPT-4 resumes with full context

---

You: Show me all errors from today

Claude: Let me check the graph...
→ [calls query_graph tool]
→ Returns all CodeBlock nodes with status=error
```

**Keyboard tip:** Command+Shift+A to focus Claude chat

---

## 💻 VS Code Copilot

### Setup
1. Open VS Code → Settings (Ctrl+,)
2. Search "MCP"
3. Add to `settings.json`:
```json
{
  "[copilot.advanced.mcpServers]": {
    "overdrive-agent": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server.js"]
    }
  }
}
```
4. Reload VS Code

### Use

In Copilot chat (Ctrl+Shift+P → "Copilot: Focus on Chat"):

```
User: @overdrive-agent ask_agent 'create a middleware'

Copilot: I'll use the agent...
↓
Agent handles it, stores to graph
↓
Copilot shows result + code

---

User: @overdrive-agent switch_model new_model=gpt-4o current_task_id=task_xyz

Copilot: Switching...
↓
Agent switches, snapshot taken
↓
Ready for next task with GPT-4

---

User: @overdrive-agent query_graph node_type=Task filter={'status':'error'}

Copilot: Found errors...
↓
Shows recent error tasks with context
```

**Keyboard tip:** Ctrl+Shift+A to open Copilot

---

## 🔧 Kiro IDE

### Setup
1. Open Kiro settings
2. Add MCP section from `kiro-mcp-config.json`
3. Update path to absolute
4. Restart Kiro

### Use

```
You type in Kiro AI:

"@overdrive-agent ask_agent 'write a REST endpoint'"

↓ Kiro calls MCP server ↓

Agent returns code + stores to graph

---

"@overdrive-agent switch_model new_model=gpt-4o current_task_id=task_123"

↓ Mid-session switch with context preservation ↓

"@overdrive-agent get_session_context"

↓ Shows what you're working on + recent tasks ↓

"@overdrive-agent query_graph node_type=CodeBlock limit=5"

↓ Latest 5 code blocks you worked on ↓
```

---

## 🛠️ All Available Tools

Call any of these from Claude, VS Code, or Kiro:

### `ask_agent`
```json
{
  "task": "write a login function",
  "model": "claude-sonnet-4-6",
  "task_id": "previous_task_id"  // optional, for context
}
```

### `switch_model`
```json
{
  "new_model": "gpt-4o",
  "current_task_id": "task_123",
  "reason": "need faster response"
}
```

### `query_graph`
```json
{
  "node_type": "Task|Reasoning|CodeBlock|ModelSwitch",
  "filter": {"status": "error", "model": "claude-sonnet-4-6"},
  "limit": 10
}
```

### `get_session_context`
```json
{
  "include_recent_tasks": true
}
```

### `get_model_stats`
```json
{
  "model": "claude-sonnet-4-6",  // null for all
  "time_window_hours": 24
}
```

### `store_task_result`
```json
{
  "task_description": "wrote auth middleware",
  "result_code": "export function auth() { ... }",
  "reasoning": "JWT validation",
  "model": "claude-sonnet-4-6",
  "status": "completed"
}
```

### `submit_async_task`
```json
{
  "task": "refactor entire service layer",
  "model": "gpt-4o",
  "priority": "high"
}
```
Returns `task_id` to check later with `get_task_status`

### `get_task_status`
```json
{
  "task_id": "async_task_xyz"
}
```

---

## 💡 Example Workflows

### Workflow 1: Code Review Across Models

```
Claude session:
1. User: "review this code"
   → Claude uses claude-sonnet-4-6 (fast, cheap)
   → Stores review to graph

2. User: "now check with GPT-4"
   → @overdrive-agent switch_model gpt-4o
   → GPT-4 sees claude's review in graph ✓
   → Provides different perspective

3. User: "which was faster?"
   → @overdrive-agent get_model_stats
   → Shows: claude=200ms, gpt-4=450ms
```

### Workflow 2: Reference Resolution

```
Claude session:
1. Task 1: "write fetchUser function"
   → Stored with ID task_001

2. Days later, new Claude session:
   User: "fix that function"
   → Prompt resolver finds task_001 from history
   → Resolves "that" → fetchUser
   → Claude: "I know exactly which function. Here's the fix..."
```

### Workflow 3: Async Batch Processing

```
VS Code Copilot:
1. @overdrive-agent submit_async_task 'build full auth module'
   ← Returns: task_id = async_task_999

2. User keeps coding...

3. Later: @overdrive-agent get_task_status task_id=async_task_999
   ← Returns: status=complete, code=..., metrics=...
```

### Workflow 4: Model Cost Optimization

```
Kiro IDE:
1. Work for a day with claude-sonnet-4-6 (cheap)

2. End of day: @overdrive-agent get_model_stats
   ← Shows: tokens used, cost, latency for each model

3. Plan next day: "GPT-4 was 3x slower, not worth the extra $"
```

---

## 🔍 Testing Your Setup

### Test 1: MCP server is running
```bash
ps aux | grep "node mcp-server"
# Should show running process
```

### Test 2: HTTP endpoint works
```bash
curl -X POST http://localhost:3001/task \
  -H "Content-Type: application/json" \
  -d '{"task": "hello world function", "model": "claude-sonnet-4-6"}'
```

### Test 3: Tool availability
```bash
curl http://localhost:3001/tools
# Should list all 8 MCP tools
```

### Test 4: Graph has data
```bash
# File should exist and grow
ls -lh agent-graph.odb
```

---

## ⚡ Pro Tips

1. **Use pronouns:** Agent resolves "that", "this", "it", "the one before"
2. **Check stats before switching:** `get_model_stats` shows what's best for your task
3. **Long tasks async:** `submit_async_task` for big refactors, don't block chat
4. **Query by language:** `query_graph node_type=CodeBlock filter={'language':'typescript'}`
5. **Backup your data:** `agent-*.odb` files are your knowledge base. Version control them.

---

## 🆘 If something breaks

| Issue | Fix |
|-------|-----|
| "Tool not found" | Restart: `npm run mcp` |
| "Connection refused" | Ensure `npm run server` is running too |
| "ANTHROPIC_API_KEY missing" | Check `.env` file exists + has your key |
| "Graph empty" | Submit a task first, wait 2 seconds |
| "Model not supported" | Add to `ADAPTERS` in `model-router.js`, restart |

---

## 🚀 Next: Publishing Your Extension

Once stable, publish this to:
- VS Code Marketplace (for Copilot integration)
- Chrome Web Store (for Claude integration)
- IDE marketplaces (for Kiro, other IDEs)

See `SETUP.md` and `extension-config.js` for publishing steps.

---

**You're all set!** Start with: `npm run mcp` then ask Claude/Copilot/Kiro to help with code. 🎉
