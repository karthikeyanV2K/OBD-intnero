/**
 * agent-db.js
 * Lazy-init, low-resource OverdriveDB engine manager.
 *
 * Design rules (zero resource drain):
 *   1. Engines open ONLY on first access
 *   2. Graph + TimeSeries + Stream close after 30s idle (releases overdrive.dll lock)
 *   3. Vector DB OFF by default — enable with OVERDRIVE_VECTOR=1
 *   4. RAM + Disk stay open (cheap, no lock contention)
 *   5. All logs → stderr. stdout = MCP JSON-RPC only.
 */

const { OverdriveDb } = require('overdrive-db');

let graphDb = null, vectorDb = null, tsDb = null;
let streamDb = null, ramDb = null, diskDb = null;

let _initialized = false;
let _idleTimer    = null;

const IDLE_CLOSE_MS  = 30_000;
const VECTOR_ENABLED = process.env.OVERDRIVE_VECTOR === '1';

// ─────────────────────────────────────────────
// Idle timer — closes expensive handles after inactivity
// ─────────────────────────────────────────────

function resetIdleTimer() {
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => {
    try {
      if (graphDb)  { graphDb.close?.();  graphDb  = null; }
      if (tsDb)     { tsDb.close?.();     tsDb     = null; }
      if (streamDb) { streamDb.close?.(); streamDb = null; }
      if (vectorDb) { vectorDb.close?.(); vectorDb = null; }
      _initialized = false;
      console.error('[db] Idle 30s: handles closed. RAM+Disk stay open.');
    } catch (e) { console.error('[db] Idle close error:', e.message); }
  }, IDLE_CLOSE_MS);
}

// ─────────────────────────────────────────────
// Init — opens only what we need
// ─────────────────────────────────────────────

async function initAllEngines() {
  if (_initialized && graphDb) { resetIdleTimer(); return; }

  // 1. GRAPH — all intelligence nodes live here
  graphDb = OverdriveDb.open('agent-graph.odb', { engine: 'Graph' });
  try {
    // Core nodes
    graphDb.createNodeType('Task');        // { description, model, ide, status, category, ts }
    graphDb.createNodeType('Reasoning');   // { summary≤200chars, model, ide, ts }
    graphDb.createNodeType('CodeBlock');   // { signature, language, file, ide, ts }
    graphDb.createNodeType('ModelSwitch'); // { from_model, to_model, reason, ide, ts }

    // Intelligence nodes (v1.0.13)
    graphDb.createNodeType('CodeStyle');   // { pattern, language, example, confidence, observations, ide, ts }
    graphDb.createNodeType('Security');    // { rule, severity, category, example, applied_count, ts }
    graphDb.createNodeType('Feature');     // { title, description, priority, status, ide, model, ts }
    graphDb.createNodeType('Project');     // { name, stack, phase, description, ide, model, ts }

    // Edges
    graphDb.createEdgeType('SOLVED_BY');
    graphDb.createEdgeType('PRODUCED');
    graphDb.createEdgeType('SWITCHED_TO');
    graphDb.createEdgeType('DEPENDS_ON');
    graphDb.createEdgeType('USES_STYLE');
    graphDb.createEdgeType('FOLLOWS_RULE');
    graphDb.createEdgeType('PLANS_FEATURE');
    graphDb.createEdgeType('PART_OF');
  } catch (_) { /* types already exist on re-open */ }

  // 2. TIMESERIES — metrics + heatmap data
  tsDb = OverdriveDb.open('agent-metrics.odb', { engine: 'TimeSeries' });
  try {
    tsDb.createTimeseries('token_usage', 90 * 24 * 3600);
    tsDb.createTimeseries('latency_ms',  90 * 24 * 3600);
    tsDb.createTimeseries('task_success', 90 * 24 * 3600);
  } catch (_) {}

  // 3. STREAMING — async queue
  streamDb = OverdriveDb.open('agent-stream.odb', { engine: 'Streaming' });
  try {
    streamDb.createTopic('task_queue',    4);
    streamDb.createTopic('model_results', 4);
  } catch (_) {}

  // 4. RAM — session (volatile, fast)
  if (!ramDb) {
    ramDb = OverdriveDb.open('agent-session.odb', { engine: 'RAM' });
    try {
      ramDb.createTable('session');
      ramDb.createTable('context_cache');
    } catch (_) {}
  }

  // 5. DISK — long-term knowledge
  if (!diskDb) {
    diskDb = OverdriveDb.open('agent-knowledge.odb', { engine: 'Disk' });
    try {
      diskDb.createTable('patterns');
      diskDb.createTable('solutions');
    } catch (_) {}
  }

  // 6. VECTOR — off by default
  if (VECTOR_ENABLED && !vectorDb) {
    vectorDb = OverdriveDb.open('agent-vectors.odb', { engine: 'Vector' });
    try { vectorDb.createVectorIndex('code_embeddings', 384); } catch (_) {}
    console.error('[db] Vector DB ON (OVERDRIVE_VECTOR=1)');
  }

  _initialized = true;
  resetIdleTimer();
  console.error(`[db] Ready. Vector: ${VECTOR_ENABLED ? 'ON' : 'OFF'}`);
}

function getEngines() {
  resetIdleTimer();
  return { graphDb, vectorDb, tsDb, streamDb, ramDb, diskDb };
}

// ─────────────────────────────────────────────
// Task auto-categorization
// ─────────────────────────────────────────────

function categorizeTask(description) {
  const d = (description || '').toLowerCase();
  if (/\b(fix|bug|error|crash|null|undefined|exception|fail|broken|wrong)\b/.test(d)) return 'debug';
  if (/\b(add|build|create|new|implement|feature|support)\b/.test(d))                 return 'feature';
  if (/\b(refactor|clean|improve|optimize|restructure|simplify)\b/.test(d))           return 'refactor';
  if (/\b(plan|design|architect|structure|system|overview)\b/.test(d))                return 'architecture';
  if (/\b(publish|deploy|release|npm|package|version|ship)\b/.test(d))               return 'deployment';
  if (/\b(style|css|ui|layout|design|theme|color|font)\b/.test(d))                   return 'ui';
  if (/\b(test|spec|unit|integration|coverage)\b/.test(d))                           return 'testing';
  if (/\b(security|auth|validate|sanitize|inject|csrf|xss)\b/.test(d))               return 'security';
  return 'general';
}

module.exports = { initAllEngines, getEngines, categorizeTask };
