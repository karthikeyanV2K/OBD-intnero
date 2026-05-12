# 🎛️ Dual Mode: Shared + Independent Knowledge

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
  "project_name": "project-a"
}
```

**Project-B (Shared Mode):**
```json
{
  "mode": "shared",
  "agent_url": "http://localhost:3001",
  "project_name": "project-b"
}
```

**Project-C (Independent Mode):**
```json
{
  "mode": "independent",
  "agent_port": 3002,
  "project_name": "project-c"
}
```

**Project-D (Independent Mode):**
```json
{
  "mode": "independent",
  "agent_port": 3003,
  "project_name": "project-d"
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
│   ├── .agent-config.json
│   ├── ask-agent.js
│   └── src/
│
├── project-b/                     ← Shared Mode
│   ├── package.json
│   ├── .agent-config.json
│   ├── ask-agent.js
│   └── src/
│
├── project-c/                     ← Independent Mode
│   ├── agent/
│   │   ├── mcp-server.js
│   │   ├── server.js
│   │   ├── agent-db.js
│   │   └── agent-graph.odb
│   ├── package.json
│   ├── .agent-config.json
│   ├── ask-agent.js
│   └── src/
│
└── project-d/                     ← Independent Mode
    ├── agent/
    │   ├── mcp-server.js
    │   ├── server.js
    │   ├── agent-db.js
    │   └── agent-graph.odb
    ├── package.json
    ├── .agent-config.json
    ├── ask-agent.js
    └── src/
```

---

## Step 1: Create Core Agent (Shared)

```bash
# Rename your current OBD-intnero to core-agent
mv x:\OBD-intnero x:\core-agent
cd x:\core-agent

npm install
cp .env.example .env
# Edit .env with your API keys

npm run dev
# Starts on localhost:3001
```

---

## Step 2: Create Shared Mode Projects (Project-A & B)

**Create Project-A:**

```bash
mkdir x:\project-a
cd x:\project-a

cat > .agent-config.json << 'EOF'
{
  "mode": "shared",
  "agent_url": "http://localhost:3001",
  "project_name": "project-a"
}
EOF

cat > ask-agent.js << 'EOF'
const http = require('http');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('.agent-config.json', 'utf-8'));
const task = process.argv[2] || 'hello world';
const model = process.argv[3] || 'claude-sonnet-4-6';

function callSharedAgent(task, model) {
  const url = new URL(config.agent_url + '/task');
  const options = {
    hostname: url.hostname,
    port: url.port || 3001,
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
    req.write(JSON.stringify({ 
      task, 
      model, 
      project: config.project_name 
    }));
    req.end();
  });
}

callSharedAgent(task, model).then(result => {
  console.log('\n✅ Agent Response:');
  console.log(JSON.stringify(result, null, 2));
}).catch(err => {
  console.error('❌ Error:', err.message);
});
EOF

npm init -y
```

Use it:
```bash
cd x:\project-a
node ask-agent.js "write a button component"
```

**Create Project-B:** (Same as Project-A, just change port/name)

---

## Step 3: Create Independent Mode Projects (Project-C & D)

**Create Project-C:**

```bash
mkdir x:\project-c
cd x:\project-c

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

npm install

# Edit server.js: change PORT from 3001 to 3002
# Edit .env: customize as needed

cd ..

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

Use it:
```bash
cd x:\project-c
node ask-agent.js "write a CLI parser"
```

**Create Project-D:** (Same as Project-C, use port 3003)

---

## Running Both Modes

### Terminal 1: Shared Core
```bash
cd x:\core-agent
npm run dev
# Listens on http://localhost:3001
# Used by: Project-A, Project-B
```

### Terminal 2: Project-C Independent
```bash
cd x:\project-c\agent
npm run dev
# Listens on http://localhost:3002
# Used by: Project-C only
```

### Terminal 3: Project-D Independent
```bash
cd x:\project-d\agent
npm run dev
# Listens on http://localhost:3003
# Used by: Project-D only
```

### Use from projects:

**Project-A (Shared):**
```bash
cd x:\project-a
node ask-agent.js "write login form"
# Uses shared core at localhost:3001
```

**Project-B (Shared):**
```bash
cd x:\project-b
node ask-agent.js "write API endpoints"
# Uses same shared core at localhost:3001
```

**Project-C (Independent):**
```bash
cd x:\project-c
node ask-agent.js "write backend service"
# Uses own isolated agent at localhost:3002
```

**Project-D (Independent):**
```bash
cd x:\project-d
node ask-agent.js "write CLI tool"
# Uses own isolated agent at localhost:3003
```

---

## Comparison: Shared vs Independent

| Feature | Shared | Independent |
|---------|--------|-------------|
| Knowledge Graph | One shared | Separate per project |
| Cross-project learning | ✅ Yes | ❌ No |
| Storage | 1× databases | Multiple copies |
| Cost (API calls) | Lower | Higher |
| Startup time | 1 core | Multiple agents |
| Memory | Lower | Higher |
| Isolation | ❌ No | ✅ Yes |
| Privacy | Projects see each other | Private per project |
| Collaboration | ✅ Full | ❌ None |

---

## Switching Modes: Migrate Projects

### From Shared → Independent

**Step 1: Create independent instance**
```bash
cd x:\project-a
mkdir agent
cd agent
cp x:\core-agent\* .
npm install
```

**Step 2: Update config**
```json
{
  "mode": "independent",
  "agent_port": 3004,
  "project_name": "project-a"
}
```

**Step 3: Export knowledge (optional)**
```bash
# Copy graph from core to project-a
cp x:\core-agent\agent-graph.odb x:\project-a\agent\agent-graph.odb
# Project-A now has all prior history
```

**Step 4: Start independent**
```bash
cd x:\project-a\agent
npm run dev   # Now runs on port 3004
```

### From Independent → Shared

**Step 1: Export knowledge**
```bash
cp x:\project-c\agent\agent-graph.odb x:\core-agent\agent-graph-project-c.odb
```

**Step 2: Update config**
```json
{
  "mode": "shared",
  "agent_url": "http://localhost:3001",
  "project_name": "project-c"
}
```

**Step 3: Start using shared**
```bash
cd x:\project-c
node ask-agent.js "task"
# Now uses core-agent at localhost:3001
```

---

## Advanced: Hybrid Mode (Shared + Local)

Want shared knowledge BUT also private project notes?

```json
{
  "mode": "hybrid",
  "agent_url": "http://localhost:3001",
  "project_name": "project-a",
  "local_knowledge": {
    "enabled": true,
    "db_path": "./local-graph.odb"
  }
}
```

This project gets:
- ✅ Access to shared knowledge (from core)
- ✅ Own private knowledge (local database)
- ✅ Best of both worlds

---

## Summary: Which Mode to Use?

**Use SHARED MODE if:**
- ✅ Projects work together
- ✅ Want cross-project learning
- ✅ Save resources
- ✅ Teams collaborate

**Use INDEPENDENT MODE if:**
- ✅ Projects are separate
- ✅ Need privacy/isolation
- ✅ Don't want shared knowledge
- ✅ Different teams

**Use HYBRID if:**
- ✅ Most realistic scenario
- ✅ Mix shared + private knowledge

---

## Commands Quick Reference

```bash
# SHARED MODE

# Start shared core (once)
cd core-agent && npm run dev

# Use from project-a
cd project-a && node ask-agent.js "task"

# Use from project-b
cd project-b && node ask-agent.js "task"


# INDEPENDENT MODE

# Start project-c agent
cd project-c/agent && npm run dev

# Use from project-c
cd project-c && node ask-agent.js "task"

# Start project-d agent
cd project-d/agent && npm run dev

# Use from project-d
cd project-d && node ask-agent.js "task"


# HYBRID MODE

# Start shared core
cd core-agent && npm run dev

# Use from project-a (gets shared + local)
cd project-a && node ask-agent.js "task"
```

---

## What You Get

✅ **Flexibility** — Choose mode per project  
✅ **Scalability** — Mix shared and isolated  
✅ **Collaboration** — Teams share when needed  
✅ **Privacy** — Projects isolated when needed  
✅ **Migration** — Switch modes anytime  
✅ **No Lock-in** — Choose your approach  

---

**Ready? Start with Step 1 (Create Core Agent) then pick which projects go Shared vs Independent!** 🚀
