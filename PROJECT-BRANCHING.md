# �️ Dual Mode: Shared + Independent Knowledge

You can run **BOTH modes simultaneously**:
- **Shared Mode** — All projects use ONE core agent (cross-project learning)
- **Independent Mode** — Each project has ITS OWN agent (isolated knowledge)

Projects can switch modes anytime.

---

## Architecture: Hybrid System

```
┌──────────────────────────────────────┐
│      SHARED MODE (Optional)          │
│                                      │
│   Core Agent (localhost:3001)        │
│   • Shared Knowledge Graph           │
│   • Cross-project learning           │
│                                      │
│   Used by: Project-A, Project-B      │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│   INDEPENDENT MODE (Optional)        │
│                                      │
│   Project-C Agent (localhost:3002)   │
│   • Separate Knowledge Graph         │
│   • Isolated learning                │
│                                      │
│   Used by: Project-C only            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│   Project-D Agent (localhost:3003)   │
│   • Separate Knowledge Graph         │
│   • Isolated learning                │
│                                      │
│   Used by: Project-D only            │
└──────────────────────────────────────┘
```

---

## Setup: Pick Your Mode Per Project

### Configuration File: `.agent-config.json`

Each project has a config file that picks the mode:

**Project-A (Shared Mode):**
```json
{
  "mode": "shared",
  "agent_url": "http://localhost:3001",
  "project_name": "project-a",
  "description": "Web frontend"
}
```

**Project-B (Shared Mode):**
```json
{
  "mode": "shared",
  "agent_url": "http://localhost:3001",
  "project_name": "project-b",
  "description": "Mobile app"
}
```

**Project-C (Independent Mode):**
```json
{
  "mode": "independent",
  "agent_port": 3002,
  "project_name": "project-c",
  "description": "Backend (isolated)",
  "isolated": true
}
```

**Project-D (Independent Mode):**
```json
{
  "mode": "independent",
  "agent_port": 3003,
  "project_name": "project-d",
  "description": "CLI tool (isolated)",
  "isolated": true
}
```

---

## Folder Structure: Both Modes

```
my-workspace/
│
├── core-agent/                    ← Shared (used by A, B)
│   ├── mcp-server.js
│   ├── server.js
│   ├── agent-db.js
│   ├── package.json
│   ├── .env
│   ├── agent-graph.odb             ← SHARED knowledge
│   └── ...
│
├── project-a/                     ← Shared Mode
│   ├── package.json
│   ├── .agent-config.json → mode: "shared"
│   ├── ask-agent.js
│   └── src/
│
├── project-b/                     ← Shared Mode
│   ├── package.json
│   ├── .agent-config.json → mode: "shared"
│   ├── ask-agent.js
│   └── src/
│
├── project-c/                     ← Independent Mode
│   ├── agent/                      ← Own agent instance
│   │   ├── mcp-server.js
│   │   ├── server.js
│   │   ├── agent-db.js
│   │   ├── package.json
│   │   ├── .env
│   │   └── agent-graph.odb ← ISOLATED knowledge
│   ├── package.json
│   ├── .agent-config.json → mode: "independent"
│   ├── ask-agent.js
│   └── src/
│
└── project-d/                     ← Independent Mode
    ├── agent/                      ← Own agent instance
    │   └── ... (same as project-c)
    ├── package.json
    ├── .agent-config.json → mode: "independent"
    ├── ask-agent.js
    └── src/
```

---

## Step 1: Create Core Agent (Shared)

```bash
# Folder: /core-agent/
# (Use your current OBD-intnero, just rename)
mv x:\OBD-intnero x:\core-agent
cd x:\core-agent

npm install
cp .env.example .env
# Edit .env with API keys

npm run dev
# Starts on localhost:3001
```

---

## Step 2: Create Shared Mode Projects

**Project-A:**

```bash
mkdir x:\project-c
cd x:\project-c

# Create config
cat > .agent-config.json << 'EOF'
{
  "mode": "independent",
  "agent_port": 3002,
  "project_name": "project-c"
}
EOF

# Create own agent inside project
mkdir agent
cd agent

# Copy agent files from core
cp x:\core-agent\mcp-server.js .
cp x:\core-agent\server.js .
cp x:\core-agent\agent-db.js .
cp x:\core-agent\knowledge.js .
cp x:\core-agent\prompt-builder.js .
cp x:\core-agent\model-router.js .
cp x:\core-agent\task-worker.js .
cp x:\core-agent\package.json .
cp x:\core-agent\.env.example .env

# Edit package.json to use port 3002
# Edit server.js to use PORT=3002

npm install

# Back to project root
cd ..

# Create ask-agent for independent mode
cat > ask-agent.js << 'EOF'
const http = require('http');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('.agent-config.json', 'utf-8'));
const task = process.argv[2] || 'hello world';
const model = process.argv[3] || 'claude-sonnet-4-6';
const port = config.agent_port || 3002;

function callIndependentAgent(task, model) {
  const options = {
    hostname: 'localhost',
    port: port,
    path: '/task',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ task, model }));
    req.end();
  });
}

callIndependentAgent(task, model).then(result => {
  console.log('\n✅ Agent Response:');
  console.log(JSON.stringify(result, null, 2));
}).catch(err => {
  console.error('❌ Error:', err.message);
});
EOF

npm init -y
```

---

## How It Works: Shared Knowledge

### Day 1: Project-Web
```
Web dev asks: "write a button component"
    ↓
Agent stores to graph:
  • Task: "button component"
  • Code: <Button />
  • Model: claude-sonnet-4-6
  • Project: web
    ↓
Graph file: /core-agent/agent-graph.odb
```

### Day 2: Project-Backend
```
Backend dev asks: "how did we do buttons?"
    ↓
Agent queries graph:
  • Finds: button component from Day 1
  • Returns: <Button /> code + reasoning
  • Project: web (but Backend can see it!)
    ↓
Backend learns from Web's work ✓
```

### Day 3: Project-CLI
```
CLI dev asks: "fix that button issue"
    ↓
Agent resolves "that" to Web's button
    ↓
Shows: Web's button + issue + fix
    ↓
All projects in sync ✓
```

**Result:** Knowledge flows between projects automatically.

---

## Starting Everything

### Terminal 1: Start Core Agent (Once)
```bash
cd x:\core-agent
npm run dev
# This serves all three projects

Output:
[mcp-server.js] [MCP] Server started...
[server.js] Server listening on port 3001
[task-worker.js] Worker started...
```

### Terminal 2-4: Use From Each Project

**Terminal 2 (Project-Web):**
```bash
cd x:\project-web
node ask-agent.js "create a login form"
```

**Terminal 3 (Project-CLI):**
```bash
cd x:\project-cli
node ask-agent.js "write CLI arg parser"
```

**Terminal 4 (Project-Backend):**
```bash
cd x:\project-backend
node ask-agent.js "write authentication middleware"
```

All three use the same agent. Same knowledge graph. No duplication.

---

## Benefits: Why This Works

✅ **One Knowledge Graph**
- Web learns from backend code
- Backend learns from CLI patterns
- CLI learns from web components
- Full context across all projects

✅ **One Agent Instance**
- Uses less resources
- No duplicate databases
- Cheaper (fewer API calls)

✅ **Shared History**
- "Fix that from project-web" works in project-backend
- References resolve across projects
- Full project history in one place

✅ **Model Switching**
- Switch from Claude to GPT-4 mid-task
- Works for all projects
- Tracking applies globally

✅ **Easy to Scale**
- Add project 4, 5, 6... (just point to same URL)
- No reconfiguration needed

---

## Advanced: Project Contexts

If you want projects to have separate "contexts" but shared knowledge:

**core-agent/project-namespace.js** (NEW FILE):
```javascript
// Namespace tasks by project
const projectDB = new Map();

function storeByProject(projectName, task) {
  if (!projectDB.has(projectName)) {
    projectDB.set(projectName, []);
  }
  projectDB.get(projectName).push(task);
}

function getProjectContext(projectName) {
  return projectDB.get(projectName) || [];
}

module.exports = { storeByProject, getProjectContext };
```

Update **core-agent/model-router.js**:
```javascript
// Before routing, tag with project
async function routeTask(taskDesc, modelName, projectName) {
  const { storeByProject } = require('./project-namespace');
  
  const result = await ADAPTERS[modelName](taskDesc, ...);
  
  storeByProject(projectName, {
    task: taskDesc,
    result: result,
    project: projectName,
    timestamp: Date.now()
  });
  
  return result;
}
```

Now graph can show: "which project did this? web or backend?"

---

## Database: One vs Multiple

### Option A: One Shared Database (Recommended)
```
core-agent/agent-graph.odb        ← All projects use this
core-agent/agent-vectors.odb
core-agent/agent-metrics.odb
```

**Pros:**
- Shared knowledge
- Cross-project learning
- Smaller storage
- Easier to backup

**Cons:**
- Projects can see each other's work

### Option B: Separate Databases
```
core-agent/agent-graph.odb        ← Project-Web
core-agent/agent-graph-cli.odb    ← Project-CLI
core-agent/agent-graph-backend.odb ← Project-Backend
```

**Pros:**
- Project isolation
- Privacy/security

**Cons:**
- No cross-project learning
- Duplicated knowledge
- More storage

**Recommendation:** Start with Option A (shared). Switch to B if you need isolation.

---

## Installer/Package: All in One

Want to distribute this as a package?

**Create npm package:**

```json
{
  "name": "@your-company/ai-agent-hub",
  "version": "1.0.0",
  "description": "Shared AI agent for multiple projects",
  "bin": {
    "ai-agent": "bin/start.js"
  },
  "scripts": {
    "start": "npm run dev",
    "install-core": "npm install && cp .env.example .env"
  }
}
```

**bin/start.js:**
```bash
#!/usr/bin/env node
const { spawn } = require('child_process');

console.log('Starting Core AI Agent...');
console.log('Server: http://localhost:3001');
console.log('MCP: Ready for Claude/VS Code/Kiro');

spawn('npm', ['run', 'dev'], { stdio: 'inherit' });
```

**Usage for each project:**
```bash
npm install @your-company/ai-agent-hub
ai-agent start
# Now available at http://localhost:3001
```

---

## Summary: One Agent, Many Projects

```
├── Core Agent (runs once)
│   npm run dev
│   → localhost:3001
│   → Shared knowledge graph
│
├── Project A → calls localhost:3001
├── Project B → calls localhost:3001
└── Project C → calls localhost:3001

All share:
✅ Same agent
✅ Same knowledge
✅ Same history
✅ One database
```

**Start:**
1. Move current agent to `/core-agent`
2. Create `/project-a`, `/project-b`, etc
3. Each project uses `ask-agent.js` to call core
4. Run `npm run dev` in core once
5. Run projects in parallel

---

## Is This What You Wanted?

- ✅ One core point (core-agent)
- ✅ Multiple projects branch from it
- ✅ Shared knowledge graph
- ✅ Easy to install/package
- ✅ Scalable to 10+ projects

If you want something different, let me know:
- "Should each project have its own agent?" → Separate instances per project
- "How do we deploy this?" → Docker containers, cloud setup
- "Can projects be on different machines?" → Network setup needed
- "How do we manage permissions?" → Authentication layer

What would help most?
