# ✅ MCP Setup Checklist

Complete this checklist to ensure your setup is ready to use.

---

## Phase 1: Installation ⚙️

- [ ] Node.js 16+ installed (`node --version` shows v16 or higher)
- [ ] npm installed (`npm --version` shows 8+)
- [ ] `cd x:\OBD-intnero`
- [ ] `npm install` completed without errors
- [ ] `npm install @modelcontextprotocol/sdk` completed
- [ ] All files listed below exist:

### Required Files
- [ ] `mcp-server.js` (new - MCP server)
- [ ] `model-router.js` (existing - model routing)
- [ ] `agent-db.js` (existing - database init)
- [ ] `knowledge.js` (existing - token compression)
- [ ] `prompt-builder.js` (existing - reference resolution)
- [ ] `server.js` (existing - HTTP API)
- [ ] `task-worker.js` (existing - queue processor)
- [ ] `package.json` (updated - new scripts + dependencies)

### Configuration Files
- [ ] `claude-config.json` (new)
- [ ] `vscode-mcp-config.json` (new)
- [ ] `kiro-mcp-config.json` (new)

### Documentation Files
- [ ] `SETUP-MCP.md` (comprehensive guide)
- [ ] `QUICK-START.md` (examples)
- [ ] `MCP_INTEGRATION.md` (detailed architecture)
- [ ] `ARCHITECTURE.md` (visual diagrams)
- [ ] `MCP-SETUP-COMPLETE.md` (overview)

### Test/Setup Scripts
- [ ] `test-mcp-setup.js` (validation)
- [ ] `mcp-setup.sh` (Mac/Linux auto-setup)
- [ ] `mcp-setup.bat` (Windows auto-setup)

---

## Phase 2: Environment Setup 🔑

- [ ] `.env` file exists (not just `.env.example`)
  ```bash
  cp .env.example .env  # if not done yet
  ```

- [ ] `.env` has been edited with YOUR API keys:
  ```
  ANTHROPIC_API_KEY=sk-ant-YOUR_ACTUAL_KEY_HERE
  OPENAI_API_KEY=sk-YOUR_ACTUAL_KEY_HERE
  PORT=3001
  DEFAULT_MODEL=claude-sonnet-4-6
  ```

- [ ] `.env` is NOT committed to git:
  ```bash
  cat .gitignore | grep ".env"  # Should show .env
  ```

- [ ] API keys are valid by testing:
  ```bash
  curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
    https://api.anthropic.com/v1/models
  ```

---

## Phase 3: Dependency Verification ✅

Run validation script:
```bash
node test-mcp-setup.js
```

Check for:
- [ ] ✅ Node.js is available
- [ ] ✅ .env file exists
- [ ] ✅ API keys configured
- [ ] ✅ @modelcontextprotocol/sdk installed
- [ ] ✅ overdrive-db installed
- [ ] ✅ @anthropic-ai/sdk installed
- [ ] ✅ openai installed
- [ ] ✅ All required files exist
- [ ] ✅ Configuration files exist
- [ ] ✅ Server is listening on port 3001 (if running)

All green? → Continue to Phase 4

---

## Phase 4: Start the Servers ▶️

### Terminal 1: MCP Server
```bash
npm run mcp
```

Expected output:
```
[MCP] OverdriveDB engines initialized
[MCP] Server started. Ready for connections...
```

- [ ] MCP server started without errors
- [ ] No port conflicts (should use stdio, not a port)

### Terminal 2: HTTP Server
```bash
npm run server
```

Expected output:
```
Server listening on port 3001
[init] All engines initialized
```

- [ ] HTTP server started on port 3001
- [ ] No "Address already in use" errors

### Terminal 3: Task Worker
```bash
npm run worker
```

Expected output:
```
Worker started on partition 0
Listening for tasks...
```

- [ ] Worker started without errors
- [ ] Ready to process queued tasks

**All three running?** → Continue to Phase 5

---

## Phase 5: Test HTTP API 🧪

In a new terminal, test the HTTP endpoint:

```bash
curl -X POST http://localhost:3001/task \
  -H "Content-Type: application/json" \
  -d '{"task": "write a hello world function in javascript", "model": "claude-sonnet-4-6"}'
```

- [ ] Request succeeds (HTTP 200)
- [ ] Response contains:
  - [ ] `result.code` (actual code)
  - [ ] `result.reasoning` (why this approach)
  - [ ] `result.model` (which model)
  - [ ] `result.tokensUsed` (token count)

Example response:
```json
{
  "result": {
    "code": "function helloWorld() { return 'Hello, World!'; }",
    "reasoning": "Simple function that returns greeting string",
    "tokensUsed": 124,
    "model": "claude-sonnet-4-6"
  },
  "model": "claude-sonnet-4-6",
  "ts": 1715234567890
}
```

- [ ] Response looks correct
- [ ] No errors in Terminal 2

---

## Phase 6: Database Verification 💾

Check that OverdriveDB files were created:

```bash
ls -lh agent-*.odb    # Mac/Linux
dir agent-*.odb       # Windows
```

Should see 6 files created:
- [ ] `agent-graph.odb` (stores tasks, reasoning, code)
- [ ] `agent-vectors.odb` (code embeddings)
- [ ] `agent-metrics.odb` (performance metrics)
- [ ] `agent-stream.odb` (task queue)
- [ ] `agent-session.odb` (session state)
- [ ] `agent-knowledge.odb` (knowledge base)

If files don't exist yet:
- [ ] Run the HTTP test again (Phase 5)
- [ ] Check again

---

## Phase 7: Connect Claude 🤖

### Step 1: Prepare config
- [ ] Edit `claude-config.json` and note your exact path to OBD-intnero
- [ ] Update the path in the config (make it absolute, not relative)

### Step 2: Locate Claude config location
- [ ] Mac/Linux: `~/.claude/claude.json`
- [ ] Windows: `%APPDATA%\Claude\claude.json`

### Step 3: Update Claude config
- [ ] Copy the content from `claude-config.json`
- [ ] Paste into Claude's `claude.json`
- [ ] Update path to your actual folder

### Step 4: Restart Claude
- [ ] Close Claude app completely
- [ ] Reopen Claude

### Step 5: Test
- [ ] In Claude, say: `What AI tools do you have access to?`
- [ ] Claude should mention: "I have access to the OverDrive Agent via MCP"
- [ ] Say: `@overdrive-agent ask_agent 'write a function'`
- [ ] Claude should return code from the agent

- [ ] Claude is working ✅

---

## Phase 8: Connect VS Code Copilot 💻

### Step 1: Open VS Code settings
- [ ] Open VS Code
- [ ] Ctrl+, (or Cmd+, on Mac) to open Settings
- [ ] Click "Edit in settings.json" (top right)

### Step 2: Add MCP config
- [ ] Copy config from `vscode-mcp-config.json`
- [ ] Paste into `settings.json` inside the main `{}` object
- [ ] Update path to your actual OBD-intnero folder

Example in `settings.json`:
```json
{
  "editor.fontSize": 13,
  "[copilot.advanced.mcpServers]": {
    "overdrive-agent": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\path\\to\\OBD-intnero\\mcp-server.js"]
    }
  }
}
```

### Step 3: Reload VS Code
- [ ] Save `settings.json`
- [ ] Reload VS Code (Ctrl+Shift+P → "Developer: Reload Window")

### Step 4: Test
- [ ] Open Copilot (Ctrl+Shift+A)
- [ ] Type: `@overdrive-agent ask_agent 'create a timer function'`
- [ ] Copilot should execute the tool
- [ ] See code in response

- [ ] VS Code Copilot is working ✅

---

## Phase 9: Connect Kiro IDE 🔧

### Step 1: Locate Kiro settings
- [ ] Open Kiro IDE
- [ ] Find settings file (usually `~/.kiro/settings.json` or `%APPDATA%\Kiro\config.json`)
- [ ] Or use Kiro's settings UI

### Step 2: Add MCP config
- [ ] Copy config from `kiro-mcp-config.json`
- [ ] Add to Kiro's settings under `mcp.servers`
- [ ] Update path to your actual OBD-intnero folder

### Step 3: Restart Kiro
- [ ] Close and reopen Kiro IDE

### Step 4: Test
- [ ] In Kiro's AI assistant, type: `@overdrive-agent ask_agent 'write a utility'`
- [ ] Agent should respond with code

- [ ] Kiro IDE is working ✅

---

## Phase 10: Advanced Features 🚀

### Test model switching
In Claude:
```
1. Ask: "write a function"
2. Ask: "@overdrive-agent switch_model new_model=gpt-4o current_task_id=task_1"
3. Ask: "write the same thing again"
4. Compare both versions
```

- [ ] Model switching works
- [ ] GPT-4 version is different from Claude version

### Test graph queries
In Claude:
```
Ask: "@overdrive-agent query_graph node_type=CodeBlock limit=5"
```

- [ ] Returns recent code blocks you worked on
- [ ] Shows graph is storing data

### Test async tasks
```
Ask: "@overdrive-agent submit_async_task 'build a full auth system'"
→ Returns task_id

Later:
Ask: "@overdrive-agent get_task_status task_id=YOUR_TASK_ID"
→ Shows completion status
```

- [ ] Async task queuing works
- [ ] Can check task status

### Test performance stats
```
Ask: "@overdrive-agent get_model_stats model=claude-sonnet-4-6 time_window_hours=24"
```

- [ ] Returns token usage and latency
- [ ] Shows which model is most efficient

- [ ] All advanced features working ✅

---

## Final Verification 🎉

- [ ] All 3 terminals running (MCP, server, worker)
- [ ] All 3 tools connected (Claude, VS Code, Kiro)
- [ ] HTTP API working
- [ ] Database files created
- [ ] MCP tools callable
- [ ] Model switching works
- [ ] Graph queries work
- [ ] Async tasks work

**All checked?** You're ready to go! 🚀

---

## Quick Restart

If something stops working:

```bash
# Kill all (Ctrl+C in each terminal)

# Terminal 1 restart
npm run mcp

# Terminal 2 restart
npm run server

# Terminal 3 restart
npm run worker

# Test
curl http://localhost:3001/task -X POST -d '{"task":"test"}'
```

---

## Next Steps

1. **Check docs:**
   - [`QUICK-START.md`](QUICK-START.md) for examples
   - [`SETUP-MCP.md`](SETUP-MCP.md) for detailed setup
   - [`ARCHITECTURE.md`](ARCHITECTURE.md) for how it works

2. **Build on it:**
   - Add custom MCP tools in `mcp-server.js`
   - Create VS Code extension
   - Publish to marketplaces

3. **Customize:**
   - Adjust token compression in `knowledge.js`
   - Add more AI models to `model-router.js`
   - Tune database parameters in `agent-db.js`

---

**Version:** 1.0.0  
**Built with:** OverdriveDB + MCP + Node.js  
**Status:** Production Ready ✅
