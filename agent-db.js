/**
 * agent-db.js
 * Initializes all 6 OverdriveDB engines.
 * Each engine has one specific job — no overlap.
 *
 * Engine → Responsibility mapping:
 *   Graph      → task nodes, reasoning chains, model-decision edges
 *   Vector     → code embeddings (384-dim), semantic similarity search
 *   TimeSeries → token usage, latency, model performance per call
 *   Streaming  → async task queue, agent event bus
 *   RAM        → current session context, snapshot on model switch
 *   Disk       → persistent knowledge base (long-term storage)
 */

const { OverdriveDb } = require('overdrive-db');

let graphDb, vectorDb, tsDb, streamDb, ramDb, diskDb;

async function initAllEngines() {
  // 1. GRAPH — stores task/reasoning/code as connected nodes
  graphDb = OverdriveDb.open('agent-graph.odb', { engine: 'Graph' });
  graphDb.createNodeType('Task');        // { id, description, status, model, created_at }
  graphDb.createNodeType('Reasoning');   // { id, chain, summary, model, tokens_used }
  graphDb.createNodeType('CodeBlock');   // { id, signature, language, file, quality_score }
  graphDb.createNodeType('ModelSwitch'); // { id, from_model, to_model, reason, timestamp }
  graphDb.createEdgeType('SOLVED_BY');   // Task → Reasoning
  graphDb.createEdgeType('PRODUCED');    // Reasoning → CodeBlock
  graphDb.createEdgeType('SWITCHED_TO'); // Task → ModelSwitch
  graphDb.createEdgeType('DEPENDS_ON'); // CodeBlock → CodeBlock

  // 2. VECTOR — code embeddings for semantic search
  vectorDb = OverdriveDb.open('agent-vectors.odb', { engine: 'Vector' });
  vectorDb.createVectorIndex('code_embeddings', 384);
  vectorDb.createVectorIndex('task_embeddings', 384);

  // 3. TIMESERIES — token usage + model performance metrics
  tsDb = OverdriveDb.open('agent-metrics.odb', { engine: 'TimeSeries' });
  tsDb.createTimeseries('token_usage',   90 * 24 * 3600); // 90 days in seconds
  tsDb.createTimeseries('latency_ms',    90 * 24 * 3600);
  tsDb.createTimeseries('quality_score', 90 * 24 * 3600);

  // 4. STREAMING — task queue and agent event bus
  streamDb = OverdriveDb.open('agent-stream.odb', { engine: 'Streaming' });
  streamDb.createTopic('task_queue',    4); // 4 partitions
  streamDb.createTopic('agent_events',  2); // 2 partitions
  streamDb.createTopic('model_results', 4); // 4 partitions

  // 5. RAM — current session (fast reads, snapshot/restore on model switch)
  ramDb = OverdriveDb.open('agent-session.odb', { engine: 'RAM' });
  ramDb.createTable('session');
  ramDb.createTable('context_cache');

  // 6. DISK — persistent knowledge base
  diskDb = OverdriveDb.open('agent-knowledge.odb', { engine: 'Disk' });
  diskDb.createTable('patterns');   // known code patterns
  diskDb.createTable('solutions');  // successful solutions archive
  diskDb.createTable('models');     // model config + capabilities
}

function getEngines() {
  return { graphDb, vectorDb, tsDb, streamDb, ramDb, diskDb };
}

module.exports = { initAllEngines, getEngines };
