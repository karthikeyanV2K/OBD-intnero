# 🖥️ How to Run: 3 Separate Servers Explained

## The 3 Servers You Run

Your system has **3 separate processes** that all connect to the same OverdriveDB agent:

```
┌─────────────────────────────────────────────┐
│            YOUR 3 SERVERS                    │
├─────────────────────────────────────────────┤
│                                              │
│  SERVER 1: MCP Server                       │
│  ├─ File: mcp-server.js                     │
│  ├─ Port: stdin/stdout (not a port)         │
│  ├─ Command: npm run mcp                    │
│  ├─ What it does:                           │
│  │  • Connects Claude, VS Code, Kiro        │
│  │  • Exposes 8 tools                       │
│  │  • Routes to the agent                   │
│  └─ Who uses it: Claude, VS Code, Kiro      │
│                                              │
│  SERVER 2: HTTP Server                      │
│  ├─ File: server.js                         │
│  ├─ Port: 3001                              │
│  ├─ Command: npm run server                 │
│  ├─ What it does:                           │
│  │  • REST API for manual testing           │
│  │  • Accepts JSON requests                 │
│  │  • Returns code + results                │
│  └─ Who uses it: You (curl, Postman)        │
│                                              │
│  SERVER 3: Task Worker                      │
│  ├─ File: task-worker.js                    │
│  ├─ Port: none (connects to DB)             │
│  ├─ Command: npm run worker                 │
│  ├─ What it does:                           │
│  │  • Processes queued tasks                │
│  │  • Runs in background                    │
│  │  • Handles async jobs                    │
│  └─ Who uses it: Automated queue            │
│                                              │
└─────────────────────────────────────────────┘
                    ↓
            OverdriveDB Agent
            (shared backend)
```

---

## How to Run Them

### Option A: Run All Three (Recommended)

```bash
# Terminal 1: Start MCP Server
npm run mcp

# Terminal 2: Start HTTP Server  
npm run server

# Terminal 3: Start Task Worker
npm run worker
```

Each terminal stays running. You'll see:

**Terminal 1 (MCP):**
```
[MCP] OverdriveDB engines initialized
[MCP] Server started. Ready for connections...
```

**Terminal 2 (HTTP):**
```
Server listening on http://localhost:3001
[init] All engines initialized
```

**Terminal 3 (Worker):**
```
Worker started on partition 0
Listening for tasks...
```

---

### Option B: Run All at Once (Easier)

```bash
npm run dev
```

This runs all 3 servers in one command using `concurrently`.

You'll see all three running in the same terminal:
```
[mcp-server.js] [MCP] Server started...
[server.js] Server listening on port 3001
[task-worker.js] Worker started on partition 0
```

All three will show output in the same terminal.

---

### Option C: Run Just MCP (Minimal)

```bash
npm run mcp
```

Only the MCP server runs. Claude, VS Code, Kiro can connect, but:
- ❌ Manual HTTP testing won't work
- ❌ Async tasks won't be processed
- ⚠️ Only use this if you're just testing MCP connection

---

## What Each Server Does (Detailed)

### 🔵 Server 1: MCP Server (`npm run mcp`)

**Purpose:** Connect Claude, VS Code, Kiro to your agent

**How it works:**
1. Starts listening on stdin/stdout (standard MCP protocol)
2. Claude/VS Code/Kiro connects to it
3. Receives tool calls (ask_agent, switch_model, etc.)
4. Routes them to the shared agent backend
5. Returns results

**When to use:** Always needed (unless you only use HTTP API)

**Example:**
```
Claude says: "Write a function"
    ↓
MCP receives: ask_agent tool call
    ↓
Calls shared agent backend
    ↓
Returns result to Claude
```

---

### 🟢 Server 2: HTTP Server (`npm run server`)

**Purpose:** REST API for manual testing and automation

**How it works:**
1. Starts Express server on `http://localhost:3001`
2. Accepts POST requests to `/task`
3. Calls the same agent backend
4. Returns JSON response

**When to use:** Manual testing, external APIs, webhooks

**Example:**
```bash
curl -X POST http://localhost:3001/task \
  -H "Content-Type: application/json" \
  -d '{"task": "hello world", "model": "claude-sonnet-4-6"}'

# Response:
{
  "result": {
    "code": "function helloWorld() { return 'Hello, World!'; }",
    "model": "claude-sonnet-4-6"
  }
}
```

---

### 🟡 Server 3: Task Worker (`npm run worker`)

**Purpose:** Process queued tasks asynchronously

**How it works:**
1. Connects to the Streaming DB
2. Polls the `task_queue` topic
3. Picks up tasks submitted with `submit_async_task`
4. Processes them in the background
5. Stores results to graph

**When to use:** Always running (handles background jobs)

**Example workflow:**
```
Client says: "submit_async_task 'build auth module'"
    ↓
Returns task_id immediately (doesn't wait)
    ↓
Worker picks it up from queue
    ↓
Processes in background
    ↓
Client checks: "get_task_status task_id=..."
    ↓
Returns: COMPLETE with results
```

---

## Typical Usage Scenarios

### Scenario 1: Using Claude
```bash
Terminal 1: npm run mcp          ← Claude connects here
Terminal 2: npm run server       ← (optional, not used by Claude)
Terminal 3: npm run worker       ← Processes async tasks
```

In Claude: `@overdrive-agent ask_agent 'task'` ✓ Works

---

### Scenario 2: Using VS Code Copilot
```bash
Terminal 1: npm run mcp          ← VS Code connects here
Terminal 2: npm run server       ← (optional)
Terminal 3: npm run worker       ← Processes async tasks
```

In Copilot: `@overdrive-agent ask_agent 'task'` ✓ Works

---

### Scenario 3: Manual Testing with curl
```bash
Terminal 1: npm run mcp          ← (optional if not using Claude/VS Code)
Terminal 2: npm run server       ← You'll call this on port 3001
Terminal 3: npm run worker       ← Processes async tasks
```

In terminal 4: `curl http://localhost:3001/task -d '{"task":"..."}'` ✓ Works

---

### Scenario 4: Everything (Recommended)
```bash
npm run dev          ← All 3 servers in one terminal
```

Claude + VS Code + Kiro + HTTP API + Async tasks all working ✓

---

## What Gets Shared

All 3 servers talk to the **same backend**:

```
Terminal 1 (MCP)        ┐
Terminal 2 (HTTP) ─────→ Shared OverdriveDB Agent
Terminal 3 (Worker)    ┘

When you:
1. Ask Claude (via MCP) something
2. It stores to the graph
3. VS Code (via MCP) can see it
4. HTTP API can query it
5. Worker processes queued tasks from it
```

**Result:** No duplication. One agent, three ways to access it.

---

## Stopping Servers

### If running separately (3 terminals):
```bash
# In each terminal:
Ctrl+C
```

### If running together (npm run dev):
```bash
# In the one terminal:
Ctrl+C    # Stops all 3 at once
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Port 3001 already in use" | Another process using it. Change PORT in .env |
| "MCP server not listening" | Check Terminal 1 — npm run mcp status |
| "Tasks not being processed" | Check Terminal 3 — worker running? |
| "Claude can't connect" | Ensure Terminal 1 (MCP) is running |
| "curl gets connection refused" | Ensure Terminal 2 (server) is running |

---

## Quick Decision Tree

**Q: How should I run servers?**

- Using Claude? → `npm run mcp` + `npm run worker`
- Using VS Code Copilot? → `npm run mcp` + `npm run worker`
- Using Kiro? → `npm run mcp` + `npm run worker`
- Manual testing (curl)? → `npm run server` + `npm run worker`
- Everything? → `npm run dev`

**Q: Do I always need all three?**

- MCP server: YES (unless only using HTTP API)
- HTTP server: NO (unless doing curl/external testing)
- Task worker: YES (unless you never use async tasks)

**Q: Can I run just one?**

Yes, but:
- MCP alone: Claude/VS Code work, no HTTP testing
- HTTP alone: curl works, Claude/VS Code don't
- Worker alone: Nothing happens (needs MCP or HTTP to send tasks)

**Recommendation:** Always run all three with `npm run dev`

---

## Example: Start Fresh

### Step 1: Open 3 terminals

**Terminal 1:**
```bash
cd x:\OBD-intnero
npm run mcp
```

**Terminal 2:**
```bash
cd x:\OBD-intnero
npm run server
```

**Terminal 3:**
```bash
cd x:\OBD-intnero
npm run worker
```

### Step 2: Each shows "ready"

Terminal 1: `[MCP] Server started. Ready for connections...`
Terminal 2: `Server listening on http://localhost:3001`
Terminal 3: `Listening for tasks...`

### Step 3: Use your agent

**In Claude (connects via MCP in Terminal 1):**
```
"Write a hello world function"
↓
Result appears instantly
```

**Manual test (calls HTTP server in Terminal 2):**
```bash
curl -X POST http://localhost:3001/task \
  -H "Content-Type: application/json" \
  -d '{"task":"hello world"}'
```

**Async task (processed by Terminal 3):**
```
Claude: "@overdrive-agent submit_async_task 'big task'"
↓
Returns task_id immediately
↓
Terminal 3 picks it up
↓
Processes in background
↓
Claude: "@overdrive-agent get_task_status task_id=..."
↓
Shows result when ready
```

---

## Summary

**You have 3 servers. Run them separately or together:**

```bash
# Option 1: Separate (see 3 terminals)
Terminal 1: npm run mcp
Terminal 2: npm run server
Terminal 3: npm run worker

# Option 2: Together (1 terminal)
npm run dev

# Pick one. Both work. dev is easier.
```

All three talk to the same agent. Same knowledge graph. Same model router.

**Start:** `npm run dev` then open Claude/VS Code/Kiro

**That's it!** 🚀
