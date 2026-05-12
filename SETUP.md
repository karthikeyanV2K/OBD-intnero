# OverDrive AI Agent - Complete Setup Guide

## Overview
This is a multi-model AI agent using OverdriveDB for persistent knowledge storage. It features:
- **Model-agnostic**: Switch between Claude, GPT-4, Gemini mid-session
- **60-80% token reduction**: Compressed context via knowledge graph
- **Persistent context**: No context loss on model switches
- **VS Code Extension**: Ctrl+Shift+A to ask the agent
- **Chrome Extension**: Use in browser on GitHub, GitLab
- **Express API**: REST endpoints for custom integrations

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Keys
Copy `.env.example` to `.env` and add your API keys:
```bash
cp .env.example .env
# Edit .env with your keys:
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
```

### 3. Start the Agent
```bash
npm start
```
This starts the API server on `http://localhost:3001`

### 4. Run Async Worker (optional)
In another terminal:
```bash
npm run worker
```

### 5. Run Both
```bash
npm run dev
```

## API Endpoints

### POST /task
Execute a task synchronously
```bash
curl -X POST http://localhost:3001/task \
  -H "Content-Type: application/json" \
  -d '{"task":"Explain this code","model":"claude-sonnet-4-6"}'
```

### POST /task/async
Queue a task asynchronously
```bash
curl -X POST http://localhost:3001/task/async \
  -H "Content-Type: application/json" \
  -d '{"task":"Fix this bug","model":"gpt-4o"}'
```

### POST /switch-model
Switch model mid-session with context preservation
```bash
curl -X POST http://localhost:3001/switch-model \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","taskId":"task_123"}'
```

### GET /metrics/:model
Get performance metrics for a model
```bash
curl http://localhost:3001/metrics/claude-sonnet-4-6
```

### GET /health
Health check
```bash
curl http://localhost:3001/health
```

## Database Engines

| Engine | Purpose | File | Storage |
|--------|---------|------|---------|
| Graph | Task nodes, reasoning, code deps | knowledge.js | agent-graph.odb |
| Vector | Code embeddings (384-dim) | knowledge.js | agent-vectors.odb |
| TimeSeries | Token usage, latency, quality | model-router.js | agent-metrics.odb |
| Streaming | Async queue, event bus | task-worker.js | agent-stream.odb |
| RAM | Session context (snapshot/restore) | model-router.js | agent-session.odb |
| Disk | Persistent patterns & solutions | knowledge.js | agent-knowledge.odb |

## Architecture

```
User Input
    ↓
[Reference Resolution] (prompt-builder.js)
    ↓
[Load Compressed Context] (knowledge.js)
    ↓
[Route to Model] (model-router.js)
    ↓
[Track Metrics] (TimeSeries)
    ↓
[Store Result] (Graph + Vector + Disk)
    ↓
Response
```

## VS Code Extension

### Setup
```bash
cd vscode-extension
npm install
npm run compile
```

### Test
Press `F5` to open Extension Development Host

### Build & Package
```bash
npm run package  # Creates .vsix file
npm run publish  # Publishes to marketplace (requires PAT)
```

### Keybinding
- **Windows/Linux**: `Ctrl+Shift+A`
- **Mac**: `Cmd+Shift+A`

## Chrome Extension

### Setup
```bash
cd chrome-extension
npm install
```

### Load Unpacked
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `chrome-extension/` folder

### Build for Production
```bash
zip -r agent-chrome.zip chrome-extension/
# Upload at https://chrome.google.com/webstore/devconsole
```

## Token Reduction Example

**Without graph (raw history):**
```
[message 1] [message 2] ... [message 50] 
= 15,000+ tokens per call
```

**With OverdriveDB graph:**
```
priorReasoning (last 3 summaries)    ≈ 150 tokens
recentSignatures (3 fn signatures)   ≈ 100 tokens
relatedPatterns (3 patterns)         ≈ 100 tokens
current task                         ≈ 50  tokens
─────────────────────────────────────────────
Total context sent to model          ≈ 400–600 tokens ← 60–80% reduction
```

## Model Switch Without Context Loss

```
User: "Switch to GPT-4o"
  ↓
1. RAM.snapshot()          → captures current state
2. Graph: createNode()     → logs model switch
3. loadCompressedContext() → loads graph summary
4. RAM: update             → new model + compressed context
5. new model gets ~500 token handoff, not 15,000 tokens
```

If new model fails: `ramDb.restore(snapshot)` brings you back exactly.

## Reference Resolution

When user says "that", "fix it", "the bug", the system:

1. **Detects the reference** via patterns
2. **Searches RAM** for recent context (highest confidence)
3. **Searches Graph** for task nodes
4. **Searches Disk** for past solutions
5. **Injects resolved data** into system prompt

The model gets full context without user repeating themselves.

## Troubleshooting

### Imports failing?
```bash
node test-imports.js
```

### Database locked?
Remove `.odb` files and restart:
```bash
rm *.odb
npm start
```

### API not responding?
```bash
curl http://localhost:3001/health
```

### Worker not processing tasks?
Check logs: `npm run worker`

## Development

### File Structure
```
.
├── agent-db.js           # All 6 database engines init
├── knowledge.js          # Graph + Vector operations
├── model-router.js       # Model routing + metrics
├── task-worker.js        # Streaming queue consumer
├── prompt-builder.js     # Reference resolution + system prompts
├── extension-config.js   # VS Code extension config
├── server.js             # Express API
├── extension.ts          # VS Code extension code
├── package.json          # Dependencies
├── .env.example          # Configuration template
└── test-imports.js       # Import validation
```

### Testing
```bash
npm test          # Runs test suite
npm run dev       # Starts server + worker
node test-imports.js  # Validates all imports
```

## Production Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --production
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables
Set in `.env` or Docker:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `PORT` (default: 3001)
- `NODE_ENV` (development/production)

### Performance Tips
- Use `claude-opus-4-6` for complex reasoning
- Use `gpt-4o-mini` for fast, cost-effective tasks
- Enable worker for async queuing in production
- Monitor `/metrics/:model` for cost analysis

## License
MIT

## Support
For issues, check the README in the root directory or open an issue on GitHub.
