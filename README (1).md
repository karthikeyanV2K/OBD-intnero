# OverDrive AI Agent

AI coding agent using all 6 OverdriveDB engines.
Model-agnostic. Switch between Claude, GPT-4, Gemini mid-session — context never lost.
Token reduction: 60–80% vs raw chat history, no quality loss.

---

## Engine → Responsibility Map

| Engine       | File          | Stores                                    | API used                                      |
|--------------|---------------|-------------------------------------------|-----------------------------------------------|
| **Graph**    | knowledge.js  | Task nodes, reasoning chains, code deps   | createNode, createEdge, graphTraverse         |
| **Vector**   | knowledge.js  | Code embeddings (384-dim)                 | createVectorIndex, insertVector, vectorSearch |
| **TimeSeries** | model-router.js | Token usage, latency, quality per call | insertMeasurement, aggregateTimeseries        |
| **Streaming** | task-worker.js | Async task queue, agent event bus        | createTopic, publish, subscribe, poll         |
| **RAM**      | model-router.js | Current session context                  | snapshot, restore, setMemoryLimit             |
| **Disk**     | knowledge.js  | Persistent knowledge base, patterns       | insert, query, search                         |

---

## How Token Reduction Works

**Without graph (raw history):**
```
[message 1] [message 2] ... [message 50] = 15,000+ tokens per call
```

**With OverdriveDB graph:**
```
priorReasoning (last 3 summaries)  ≈ 150 tokens
recentSignatures (3 fn signatures) ≈ 100 tokens
relatedPatterns (3 patterns)       ≈ 100 tokens
current task                       ≈ 50  tokens
─────────────────────────────────────────────
Total context sent to model        ≈ 400–600 tokens   ← 60–80% reduction
```

Key: the graph stores SUMMARIES of reasoning (50 tokens each), not full chains.
The vector DB returns function SIGNATURES only, not full code bodies.
This means a 2-hour session costs the same tokens as a 5-minute one.

---

## How Model Switch Works

```
User: "Switch to GPT-4o"
  ↓
1. RAM.snapshot()          — captures current session state
2. Graph: createNode('ModelSwitch', { from, to, context })
3. loadCompressedContext() — loads graph summary for new model
4. RAM: update session     — new model name + compressed ctx
5. new model gets ~500 token handoff, not 15,000 token history
```

If the new model fails for any reason: `ramDb.restore(snapshot)` brings you back exactly.

---

## Setup

```bash
npm install overdrive-db @anthropic-ai/sdk openai express cors
node server.js          # starts agent API on :3001
```

Set your API keys:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

## VS Code Extension

```bash
cd vscode-extension
npm install
npm run compile
# Press F5 to test in Extension Development Host
npx vsce package        # → overdrive-ai-agent-1.0.0.vsix
npx vsce publish        # needs Azure DevOps PAT
```

Keybinding: `Ctrl+Shift+A` (or `Cmd+Shift+A`) → Ask agent about selected code.

## Chrome Extension

```bash
# 1. Start the agent server first
node server.js

# 2. Load unpacked in Chrome
chrome://extensions → Developer mode → Load unpacked → select chrome-extension/

# 3. Publish
zip -r agent-chrome.zip chrome-extension/
# Upload at https://chrome.google.com/webstore/devconsole ($5 one-time fee)
```

---

## Adding a New AI Model

Only two steps:

**1. Add adapter in model-router.js:**
```js
async function callGemini(prompt, modelName) {
  // call Gemini API
  return { text: ..., tokensUsed: ... };
}
```

**2. Register in ADAPTERS:**
```js
const ADAPTERS = {
  'claude-sonnet-4-6': callClaude,
  'gpt-4o':            callOpenAI,
  'gemini-2.5-pro':    callGemini,  // ← add here only
};
```

Nothing else changes. The graph, vector, timeseries, streaming, RAM, and disk
layers are all model-agnostic by design.

---

## MVCC Transactions

Used around all critical graph writes (Repeatable Read isolation):
```js
const txn = graphDb.beginTransaction(2); // 2 = Repeatable Read
try {
  graphDb.createNode('Task', ...);
  graphDb.createNode('Reasoning', ...);
  graphDb.createEdge('SOLVED_BY', taskId, reasoningId);
  graphDb.commitTransaction(txn);
} catch (err) {
  graphDb.abortTransaction(txn);
}
```

This prevents partial task-reasoning pairs appearing in the graph if a write fails mid-way.

---

## File Structure

```
ai-agent-overdrive/
  agent-db.js          ← engine init (all 6)
  knowledge.js         ← graph + vector read/write
  model-router.js      ← routing + model switch + timeseries
  task-worker.js       ← streaming engine consumer
  server.js            ← HTTP API for Chrome extension
  extension-config.js  ← VS Code package.json + Chrome manifest
  vscode-extension/
    src/extension.ts   ← VS Code extension entry point
```
