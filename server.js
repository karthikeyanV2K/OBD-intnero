/**
 * server.js
 * Lightweight Express API + static dashboard server.
 *
 * Run: node server.js   OR   odb-dashboard
 *
 * Auto-picks a free port starting at 3742.
 * Binds to 127.0.0.1 only (local machine, not exposed to network).
 * External REST endpoints for any IDE/script/extension to push tasks.
 */

const express = require('express');
const cors    = require('cors');
const http    = require('http');
const path    = require('path');
const { initAllEngines, getEngines, categorizeTask } = require('./agent-db');
const {
  exportFullGraph, getFeatures, getConfirmedStyles,
  getSecurityAudit, getModelHeatmap, getGhostTasks,
  storeFeature, storeCodeStyle, storeSecurityRule,
} = require('./knowledge');

const IDE_SOURCE = process.env.OVERDRIVE_IDE || 'Antigravity'; // default to Antigravity for dashboard

const app = express();
app.use(express.json());
app.use(cors({ origin: ['chrome-extension://*', 'http://localhost:*', 'http://127.0.0.1:*'] }));
// Absolute path so server works regardless of cwd
app.use(express.static(path.join(__dirname, 'public')));

let initialized = false;

async function ensureInit() {
  // Re-open if idle-timer closed the handles
  const { graphDb } = getEngines();
  if (!initialized || !graphDb) {
    await initAllEngines();
    initialized = true;
  }
}

// ─────────────────────────────────────────────
// /api/graph — read all graph nodes (for dashboard)
// ─────────────────────────────────────────────

app.get('/api/graph', async (req, res) => {
  await ensureInit();
  try {
    const data = exportFullGraph();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// /api/tasks — all Task nodes as flat list (for dashboard table)
// ─────────────────────────────────────────────

app.get('/api/tasks', async (req, res) => {
  await ensureInit();
  const { graphDb } = getEngines();
  try {
    const tasks = graphDb.listNodes('Task').map(n => {
      const p = n.properties || n.props || n;
      return {
        id:          n.id || n._id,
        description: p.description || p.task || '—',
        model:       p.model       || '—',
        ide:         p.ide         || 'Unknown',
        status:      p.status      || 'unknown',
        reasoning:   p.reasoning   || '',
        ts:          p.ts          || p.created_at || 0,
      };
    }).sort((a, b) => b.ts - a.ts); // newest first

    res.json({ tasks, total: tasks.length });
  } catch (err) {
    res.status(500).json({ error: err.message, tasks: [] });
  }
});

// ─────────────────────────────────────────────
// /api/external/task — POST from any external source
// Stamps ide: "External API" automatically
// ─────────────────────────────────────────────

app.post('/api/external/task', async (req, res) => {
  await ensureInit();
  const { graphDb } = getEngines();
  const { task, model, reasoning, status, code } = req.body;

  if (!task) return res.status(400).json({ error: 'task field required' });

  try {
    const nodeId = graphDb.createNode('Task', {
      description: task,
      model:       model || 'external',
      ide:         'External API',
      status:      status || 'completed',
      reasoning:   (reasoning || '').substring(0, 200),
      code:        (code || '').substring(0, 400),
      ts:          Date.now(),
    });
    broadcastSSE('task_created', { nodeId, task, model, status: status || 'completed' });
    res.json({ ok: true, node_id: nodeId, ide: 'External API' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// /api/external/graph — read all nodes (external consumers)
// ─────────────────────────────────────────────

app.get('/api/external/graph', async (req, res) => {
  await ensureInit();
  try {
    const data = exportFullGraph();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// /api/external/search — keyword search across CodeBlocks
// ─────────────────────────────────────────────

app.get('/api/external/search', async (req, res) => {
  await ensureInit();
  const { graphDb } = getEngines();
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.status(400).json({ error: 'q param required' });

  try {
    const all = graphDb.listNodes('Task');
    const results = all.filter(n => {
      const p = n.properties || n.props || n;
      return (p.description || '').toLowerCase().includes(q) ||
             (p.reasoning   || '').toLowerCase().includes(q) ||
             (p.code        || '').toLowerCase().includes(q);
    }).slice(0, 20);
    res.json({ results, query: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// /api/session — GET current session, POST to update
// ─────────────────────────────────────────────

app.get('/api/session', async (req, res) => {
  await ensureInit();
  const { ramDb } = getEngines();
  try {
    const rows = ramDb.query('SELECT * FROM session ORDER BY ts DESC LIMIT 1');
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session', async (req, res) => {
  await ensureInit();
  const { ramDb } = getEngines();
  try {
    const { username, model, memoryLimit } = req.body;
    ramDb.insert('session', {
      username: username || 'default',
      model: model || process.env.OVERDRIVE_MODEL || 'claude-sonnet-4-6',
      memoryLimit: memoryLimit || 64,
      ts: Date.now(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/features — roadmap items with dead-feature detection
app.get('/api/features', async (req, res) => {
  await ensureInit();
  try { res.json({ features: getFeatures() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// /api/styles — learned code style patterns by confidence
app.get('/api/styles', async (req, res) => {
  await ensureInit();
  try { res.json({ styles: getConfirmedStyles(0) }); }  // return all
  catch (err) { res.status(500).json({ error: err.message }); }
});

// /api/heatmap — IDE+model performance heatmap
app.get('/api/heatmap', async (req, res) => {
  await ensureInit();
  try { res.json({ heatmap: getModelHeatmap() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// /api/security-audit — applied vs missing security rules
app.get('/api/security-audit', async (req, res) => {
  await ensureInit();
  try { res.json(getSecurityAudit()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// /api/ghosts — unfinished tasks (pending > 30min)
app.get('/api/ghosts', async (req, res) => {
  await ensureInit();
  try { res.json({ ghosts: getGhostTasks() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────
// /events — SSE endpoint for live browser updates
// Chrome extension and dashboard listen here for real-time events
// ─────────────────────────────────────────────

const sseClients = new Set();

app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch (_) { sseClients.delete(client); }
  }
}

// ─────────────────────────────────────────────
// Auto-port scan — no more EADDRINUSE crashes
// ─────────────────────────────────────────────

function findFreePort(startPort) {
  return new Promise((resolve) => {
    const probe = http.createServer();
    probe.listen(startPort, '127.0.0.1', () => {
      probe.close(() => resolve(startPort));
    });
    probe.on('error', () => resolve(findFreePort(startPort + 1)));
  });
}

async function startServer() {
  const port = await findFreePort(3742);
  app.listen(port, '127.0.0.1', () => {
    console.log(`[server] Dashboard: http://localhost:${port}`);
    console.log(`[server] External API: POST http://localhost:${port}/api/external/task`);
  });
  return port;
}

// Start when run directly
if (require.main === module) {
  startServer().catch(err => {
    console.error('[server] Fatal:', err);
    process.exit(1);
  });
}

module.exports = { startServer, app };
