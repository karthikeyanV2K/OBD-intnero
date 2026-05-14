/**
 * server.js
 * Lightweight Express API — bridges Chrome extension to the OverdriveDB agent.
 * Run: node server.js   (on localhost:3001)
 *
 * The VS Code extension calls the agent directly in Node.js (same process).
 * The Chrome extension needs this HTTP bridge since it can't run native Node.
 */

const express = require('express');
const cors    = require('cors');
const { initAllEngines } = require('./agent-db');
const { routeTask, switchModel, getModelStats } = require('./model-router');
const { submitTask } = require('./task-worker');
const { exportFullGraph } = require('./knowledge');

const app = express();
app.use(express.json());
app.use(cors({ origin: ['chrome-extension://*', 'http://localhost:*'] }));
app.use(express.static('public'));

let initialized = false;

// ─────────────────────────────────────────────
// Lazy init — engines start on first request
// ─────────────────────────────────────────────

async function ensureInit() {
  if (!initialized) {
    await initAllEngines();
    initialized = true;
  }
}

// ─────────────────────────────────────────────
// POST /task — run a task through the agent
// ─────────────────────────────────────────────

app.post('/task', async (req, res) => {
  await ensureInit();
  const { task, model = 'claude-sonnet-4-6' } = req.body;
  if (!task) return res.status(400).json({ error: 'task required' });

  try {
    const result = await routeTask(task, model);
    res.json({ result, model, ts: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /task/async — push to Streaming queue
// Returns immediately, result comes via WebSocket
// ─────────────────────────────────────────────

app.post('/task/async', async (req, res) => {
  await ensureInit();
  const { task, model = 'claude-sonnet-4-6' } = req.body;
  if (!task) return res.status(400).json({ error: 'task required' });

  const taskId = `task_${Date.now()}`;
  submitTask(task, model);
  res.json({ taskId, queued: true });
});

// ─────────────────────────────────────────────
// POST /switch-model — swap model, graph handoff
// ─────────────────────────────────────────────

app.post('/switch-model', async (req, res) => {
  await ensureInit();
  const { model, taskId } = req.body;
  if (!model) return res.status(400).json({ error: 'model required' });

  try {
    await switchModel(taskId || null, model);
    res.json({ switched: true, model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /metrics — TimeSeries stats for a model
// ─────────────────────────────────────────────

app.get('/metrics/:model', async (req, res) => {
  await ensureInit();
  const stats = getModelStats(req.params.model, 24);
  res.json(stats);
});

// ─────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, initialized, ts: Date.now() });
});

// ─────────────────────────────────────────────
// GET /api/graph — Export graph for UI
// ─────────────────────────────────────────────
app.get('/api/graph', async (req, res) => {
  await ensureInit();
  const graphData = exportFullGraph();
  res.json(graphData);
});

// ─────────────────────────────────────────────
// GET & POST /api/session — UI settings
// ─────────────────────────────────────────────
let uiSession = { username: 'karthikeyanV2K', model: 'claude-sonnet-4-6', memoryLimit: 64 };
app.get('/api/session', (req, res) => {
  res.json(uiSession);
});
app.post('/api/session', (req, res) => {
  uiSession = { ...uiSession, ...req.body };
  res.json({ success: true, session: uiSession });
});

app.listen(3001, () => {
  console.log('[server] Agent API running on http://localhost:3001');
});

module.exports = app;
