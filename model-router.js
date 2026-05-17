/**
 * model-router.js
 * Model-agnostic routing layer.
 *
 * Key design:
 *   - SDK requires are LAZY (inside adapter functions) — no crash if no API key set
 *   - ask_agent bypasses adapters entirely (context-provider mode)
 *   - Adding a new model = 1 function + 1 line in ADAPTERS map
 *   - All logs → stderr only
 */

const { getEngines } = require('./agent-db');
const { loadCompressedContext, storeAgentTurn } = require('./knowledge');
const { assemblePrompt } = require('./prompt-builder');

// ─────────────────────────────────────────────
// Model adapters — add new models here ONLY
// ─────────────────────────────────────────────

const ADAPTERS = {
  'claude-sonnet-4-6': callClaude,
  'claude-opus-4-6':   callClaude,
  'gpt-4o':            callOpenAI,
  'gpt-4o-mini':       callOpenAI,
  // Add any new model here — the router stays the same:
  // 'gemini-2.5-pro':  callGemini,
  // 'llama-3':         callLlama,
};

// ─────────────────────────────────────────────
// MAIN: Route a task (used by submit_async_task)
// ask_agent does NOT call this — it uses context-provider mode
// ─────────────────────────────────────────────

async function routeTask(taskDesc, modelName) {
  const { tsDb, streamDb, ramDb } = getEngines();
  const startTime = Date.now();
  const adapter = ADAPTERS[modelName];

  if (!adapter) throw new Error(`No adapter for model: ${modelName}`);

  const { system, user, meta } = await assemblePrompt(taskDesc, { model: modelName });

  if (meta.referenceResolved) {
    console.error(`[router] Reference resolved: "${meta.referenceResolved}"`);
  }
  console.error(`[router] ~${meta.systemTokens} tokens | model: ${modelName}`);

  const result = await adapter(system, user, modelName);
  const latency = Date.now() - startTime;

  // Track metrics
  try {
    tsDb.insertMeasurement('token_usage', Date.now() / 1000, result.tokensUsed, { model: modelName });
    tsDb.insertMeasurement('latency_ms',  Date.now() / 1000, latency,           { model: modelName });
  } catch (e) { console.error('[router] metrics error:', e.message); }

  // Store result to knowledge graph
  storeAgentTurn({
    taskDesc,
    model: modelName,
    reasoningChain: result.reasoning || result.text,
    codeOutput: { code: result.text, language: 'javascript' },
  }).catch(err => console.error('[knowledge] store failed:', err.message));

  // Update RAM session
  try {
    ramDb.insert('session', {
      task: taskDesc,
      task_id: `task_${startTime}`,
      model: modelName,
      result_preview: result.text.slice(0, 200),
      ts: Date.now(),
    });
  } catch (e) { console.error('[router] RAM insert error:', e.message); }

  return result.text;
}

// ─────────────────────────────────────────────
// MODEL SWITCH mid-session
// ─────────────────────────────────────────────

async function switchModel(currentTaskId, newModel, reason = 'user-requested') {
  const { graphDb, ramDb } = getEngines();

  // 1. Snapshot RAM before switching (rollback point)
  let snapshot = null;
  try { snapshot = ramDb.snapshot(); } catch (_) {}

  // 2. Write ModelSwitch node to graph
  let session = {};
  try {
    const rows = ramDb.query('SELECT * FROM session ORDER BY ts DESC LIMIT 1');
    session = rows[0] || {};
  } catch (_) {}

  try {
    graphDb.createNode('ModelSwitch', {
      from_model:   session.model || 'unknown',
      to_model:     newModel,
      reason,
      ide:          process.env.OVERDRIVE_IDE || 'Unknown',
      task_context: session.task || null,
      timestamp:    Date.now(),
    });
  } catch (e) { console.error('[router] ModelSwitch node error:', e.message); }

  // 3. Compressed context for handoff (~410 tokens)
  const ctx = await loadCompressedContext(session.task || '');

  // 4. Update RAM with new model
  try {
    ramDb.insert('session', {
      model:        newModel,
      task:         session.task || null,
      context:      JSON.stringify(ctx),
      snapshot_ref: Date.now(),
      ts:           Date.now(),
    });
  } catch (_) {}

  console.error(`[router] Switched ${session.model || '?'} → ${newModel}. ~${JSON.stringify(ctx).length} chars context.`);
  return { snapshot, compressedContext: ctx };
}

// ─────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────

function getModelStats(modelName, hours = 24) {
  const { tsDb } = getEngines();
  const since = Math.floor(Date.now() / 1000) - (hours * 3600);
  const now   = Math.floor(Date.now() / 1000);
  try {
    return {
      avgTokens:  tsDb.aggregateTimeseries('token_usage', { func: 'avg', start: since, end: now }),
      avgLatency: tsDb.aggregateTimeseries('latency_ms',  { func: 'avg', start: since, end: now }),
      totalCalls: tsDb.queryTimeseries('token_usage',     { start: since, end: now }).length,
    };
  } catch (_) {
    return { avgTokens: 0, avgLatency: 0, totalCalls: 0 };
  }
}

// ─────────────────────────────────────────────
// Model adapters — LAZY require (no crash without API keys)
// ─────────────────────────────────────────────

async function callClaude(system, user, modelName) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set. Add it to your .env file.');
  }
  // eslint-disable-next-line import/no-extraneous-dependencies
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: modelName,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return {
    text: response.content[0]?.text || '',
    tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    reasoning: null,
  };
}

async function callOpenAI(system, user, modelName) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set. Add it to your .env file.');
  }
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: modelName,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user   },
    ],
  });
  return {
    text: response.choices[0]?.message?.content || '',
    tokensUsed: response.usage?.total_tokens || 0,
    reasoning: null,
  };
}

// Example — adding Gemini takes exactly 2 lines:
// async function callGemini(system, user, modelName) { ... }
// ADAPTERS['gemini-2.5-pro'] = callGemini;

module.exports = { routeTask, switchModel, getModelStats, ADAPTERS };
