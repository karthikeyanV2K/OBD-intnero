# ⚡ Overdrive - Quick Workflows

Common tasks with visual examples

---

## 🚀 First-Time Setup (5 minutes)

### Step 1: Install globally

```bash
npm install -g overdrive-ai-agent
```

### Step 2: Check installation

```bash
$ overdrive --version
Overdrive CLI v1.0.0

$ overdrive --help
# Shows all commands
```

### Step 3: Setup projects

```bash
$ overdrive setup

Choose setup type: 3
# Creates project-a, b, c, d with mixed modes
```

### Step 4: Start everything

Open 3 terminals:

**Terminal 1:**
```bash
cd x:\core-agent
npm run dev
# Listens on http://localhost:3001
```

**Terminal 2:**
```bash
cd x:\project-c\agent
npm run dev
# Listens on http://localhost:3002
```

**Terminal 3:**
```bash
cd x:\project-d\agent
npm run dev
# Listens on http://localhost:3003
```

### Step 5: Verify

```bash
$ overdrive status

✅ Core Agent (localhost:3001): Running
✅ Independent Agent (localhost:3002): Running
✅ Independent Agent (localhost:3003): Running
```

**Done!** ✅ All systems running

---

## 📋 Daily Tasks

### Check Status Anytime

```bash
$ overdrive status

Shows:
- Running servers and ports
- Database sizes
- Configured projects
- Configuration status
```

### View All Projects

```bash
$ overdrive projects

Shows table:
- Project name
- Mode (shared/independent)
- Port or URL
- Configuration name
```

### Test Connectivity

```bash
$ overdrive test

✅ Port 3001 (Connection): Responding
✅ Port 3001 (Task): Working
✅ Port 3002 (Connection): Responding
✅ Port 3002 (Task): Working
```

---

## 🛠️ Configuration Management

### View All Configs

```bash
$ overdrive config view

Shows:
- .env file
- .agent-config.json for each project
- System configuration
```

### Validate Configs

```bash
$ overdrive config validate

✅ .env has API keys
✅ project-a config valid
✅ project-b config valid
✅ project-c config valid
✅ project-d config valid

✅ All configurations valid!
```

### Edit Configuration

```bash
$ overdrive config edit .env

# Manual step: Open in editor and save
```

---

## 🎛️ Server Management

### Start All Servers (Shared + Independent)

```bash
$ overdrive run all

Shows which terminals to open and what commands to run
```

### Start Only Shared Core

```bash
$ overdrive run shared

# For teams that only need one shared agent
# Projects A & B can use it
```

### Start Only Independent

```bash
$ overdrive run independent

# For projects C & D that need isolated agents
```

---

## 🔍 System Information

### Full Architecture Overview

```bash
$ overdrive info

Shows:
- System environment (Node, OS)
- Package information
- Dependencies
- 6 OverdriveDB engines
- Architecture diagram
- Default ports
- MCP tools available
- Quick commands
```

### Quick Reference

```bash
$ overdrive help

Lists all commands with examples
```

---

## 💻 IDE Integration Workflow

### Setup Claude.app

```bash
# 1. Verify servers running
$ overdrive status

# 2. Get MCP config
$ overdrive config view
# Copy config path from output

# 3. In Claude.app
# Settings → MCP → Add Server
# Use MCP config path from above

# 4. Test
# In Claude.app chat:
# @overdrive-agent ask_agent 'write hello world'
```

### Setup VS Code Copilot

```bash
# 1. Verify servers running
$ overdrive status

# 2. View config
$ overdrive config view

# 3. In VS Code
# Extensions → Copilot Chat Settings
# Add MCP configuration

# 4. Test
# Copilot Chat:
# @overdrive-agent ask_agent 'fix bug'
```

### Setup Kiro IDE

```bash
# 1. Verify servers running
$ overdrive status

# 2. Get config
$ overdrive config view

# 3. In Kiro IDE
# Tools → MCP Configuration
# Add server configuration

# 4. Test in Kiro console
```

---

## 📊 Monitoring Workflow

### Monitor Running Services

```bash
# Terminal 4 - Continuous monitoring
watch overdrive status

# Shows updated status every 2 seconds
```

### Check Token Usage

```bash
# From your IDE or API:
# query_graph type:task

# Returns:
# - Tokens used per request
# - Compression ratio
# - Token savings
```

### View Performance Metrics

```bash
# From your IDE or API:
# get_model_stats

# Returns:
# - Average latency per model
# - Quality scores
# - Token efficiency
```

---

## 🚨 Troubleshooting Workflow

### Servers Not Responding

```bash
# 1. Check status
$ overdrive status

# 2. Test connectivity
$ overdrive test

# 3. Validate config
$ overdrive config validate

# 4. Check logs in terminal windows
# Look for errors in Terminal 1, 2, 3
```

### Port Already In Use

```bash
# Check which process uses port 3001
# Then either:
# a) Kill that process, or
# b) Change port in .agent-config.json
```

### Configuration Issues

```bash
# 1. View configs
$ overdrive config view

# 2. Validate
$ overdrive config validate

# 3. If invalid JSON, fix manually
$ overdrive config edit .agent-config.json
```

### API Keys Missing

```bash
# 1. Check .env
$ overdrive config view

# 2. If ANTHROPIC_API_KEY or OPENAI_API_KEY empty:
$ overdrive config edit .env

# 3. Add your keys and save

# 4. Restart servers:
# Kill terminals 1, 2, 3 and run:
$ overdrive run all
```

---

## 🔄 Adding New Projects

### Add to Shared Mode

```bash
$ mkdir x:\project-e

# Create config
$ cat > x:\project-e\.agent-config.json << 'EOF'
{
  "mode": "shared",
  "agent_url": "http://localhost:3001",
  "project_name": "project-e"
}
EOF

# Verify
$ overdrive projects
# Should now show project-e
```

### Add to Independent Mode

```bash
$ mkdir x:\project-f
$ mkdir x:\project-f\agent

# Copy agent files
$ cp x:\core-agent\mcp-server.js x:\project-f\agent\
$ cp x:\core-agent\*.js x:\project-f\agent\
$ cp x:\core-agent\.env.example x:\project-f\agent\.env

# Create config
$ cat > x:\project-f\.agent-config.json << 'EOF'
{
  "mode": "independent",
  "agent_port": 3004,
  "project_name": "project-f"
}
EOF

# Start project-f agent
$ cd x:\project-f\agent
$ npm run dev
# Listens on localhost:3004

# Verify
$ overdrive status
# Should show project-f running
```

---

## 📦 Publishing Your Own CLI Extension

### Create Custom Commands

```bash
# Extend lib/cli/commands/ with your own

# Example: custom-command.js
async function execute(args, ui) {
  ui.section('My Custom Command');
  ui.success('Custom implementation here');
}
module.exports = { execute };

# Then use:
# overdrive my-custom-command
```

### Build CLI Wrapper

```bash
# For your team's specific setup
# Modify package.json with your organization name
# Add custom commands to lib/cli/commands/

# Example:
# "name": "@yourorg/overdrive-ai-agent"
# npm publish --scope=@yourorg
```

---

## 🎓 Example: Complete Session

```bash
# 1. START DAY
$ overdrive status
# ✅ All running

# 2. CHECK PROJECTS
$ overdrive projects
# Shows my 4 projects and their modes

# 3. WORK WITH CLAUDE
# In Claude.app:
# "Write a React component using Overdrive Agent"
# @overdrive-agent ask_agent 'write button.tsx'

# 4. MID-DAY: ADD NEW PROJECT
$ mkdir x:\project-e
$ cat > x:\project-e\.agent-config.json << 'EOF'
{
  "mode": "shared",
  "agent_url": "http://localhost:3001",
  "project_name": "project-e"
}
EOF

$ overdrive projects
# Now shows 5 projects

# 5. AFTERNOON: CHECK METRICS
# In IDE:
# get_model_stats
# Returns token savings, latency, quality

# 6. END OF DAY: VERIFY ALL GOOD
$ overdrive test
# ✅ All ports responding

# 7. SHUTDOWN (when done)
# Kill Terminal 1, 2, 3 windows
```

---

## 🚀 Automation Examples

### Bash Script: Auto-start Everything

```bash
#!/bin/bash
# auto-start.sh

echo "🎛️  Starting Overdrive..."

# Terminal 1
gnome-terminal -- bash -c "cd x:\core-agent; npm run dev" &

# Terminal 2
gnome-terminal -- bash -c "cd x:\project-c\agent; npm run dev" &

# Terminal 3
gnome-terminal -- bash -c "cd x:\project-d\agent; npm run dev" &

sleep 3

# Verify
overdrive status
overdrive test

echo "✅ All systems running!"
```

### PowerShell Script: Windows Version

```powershell
# auto-start.ps1

Write-Host "🎛️  Starting Overdrive..."

# Core agent
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "x:\core-agent" &

# Project-C
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "x:\project-c\agent" &

# Project-D
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "x:\project-d\agent" &

Start-Sleep -Seconds 3

# Verify
& overdrive status
& overdrive test

Write-Host "✅ All systems running!"
```

---

## 📚 Reference

### All Commands

```
overdrive status       → See what's running
overdrive projects     → List projects
overdrive setup        → Interactive setup
overdrive run all      → Start servers
overdrive test         → Test connectivity
overdrive config view  → Show configs
overdrive info         → System info
overdrive help         → Show help
```

### Useful Aliases

```bash
# Add to profile
alias odr-status='overdrive status'
alias odr-projects='overdrive projects'
alias odr-run='overdrive run all'
alias odr-test='overdrive test'
alias odr-info='overdrive info'

# Use as:
odr-status
odr-run
```

---

**Start using Overdrive CLI today!** 🚀

For detailed documentation: See [CLI-GUIDE.md](CLI-GUIDE.md)
