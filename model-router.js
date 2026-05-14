/**
 * model-router.js
 * Model-agnostic routing layer.
 *
 * Key features:
 *   1. Uses compressed graph context — not raw chat history
 *   2. Mid-session model switch via RAM snapshot + graph handoff node
 *   3. Tracks every call to TimeSeries engine
 *   4. Publishes results to Streaming engine for async consumers
 */

const Anthropic = require('@anthropic-ai/sdk');
const OpenAI    = require('openai');
const { getEngines } = require('./agent-db');
const { loadCompressedContext, storeAgentTurn } = require('./knowledge');
const { assemblePrompt } = require('./prompt-builder');

// ─────────────────────────────────────────────
// Model adapters — swap these for any new model
// ─────────────────────────────────────────────

const ADAPTERS = {
  'claude-sonnet-4-6': callClaude,
  'claude-opus-4-6':   callClaude,
  'gpt-4o':            callOpenAI,
  'gpt-4o-mini':       callOpenAI,
  // Add any new model here — the router stays the same
  // 'gemini-2.5-pro': callGemini,
  // 'llama-3':        callLlama,
};

// ─────────────────────────────────────────────
// MAIN: Route a task through the agent
// ─────────────────────────────────────────────

async function routeTask(taskDesc, modelName) {
  const { tsDb, streamDb, ramDb } = getEngines();
  const startTime = Date.now();
  const adapter = ADAPTERS[modelName];

  if (!adapter) throw new Error(`No adapter for model: ${modelName}`);

  // 1. Build prompt — resolves "that/this/it" + injects DB knowledge
  const { system, user, meta } = await assemblePrompt(taskDesc, { model: modelName });

  // 2. Log what reference was resolved (visible in server logs / VS Code Output panel)
  if (meta.referenceResolved) {
    console.error(`[router] Reference resolved: "${meta.referenceResolved}"`);
  }
  console.error(`[router] System prompt: ~${meta.systemTokens} tokens  |  model: ${modelName}`);

  // 3. Call the selected model with structured { system, user } prompt
  const result = await adapter(system, user, modelName);

  const latency = Date.now() - startTime;

  // 4. Track metrics
  tsDb.insertMeasurement('token_usage', Date.now() / 1000, result.tokensUsed, { 
    model: modelName,
    task_type: classifyTask(taskDesc),
  });
  tsDb.insertMeasurement('latency_ms',  Date.now() / 1000, latency, { model: modelName });

  // 5. Stream result to consumers
  streamDb.publish('model_results', {
    task: taskDesc,
    model: modelName,
    result: result.text,
    tokens: result.tokensUsed,
    latency,
    referenceResolved: meta.referenceResolved,
    ts: Date.now(),
  });

  // 6. Store to knowledge graph (async)
  storeAgentTurn({
    taskDesc,
    model: modelName,
    reasoningChain: result.reasoning || result.text,
    codeOutput: { code: result.text, language: 'javascript' },
  }).catch(err => console.warn('[knowledge] store failed:', err.message));

  // 7. Update RAM session so NEXT call can resolve "that" to THIS result
  ramDb.insert('session', {
    task: taskDesc,
    task_id: `task_${startTime}`,
    model: modelName,
    result_preview: result.text.slice(0, 200),
    ts: Date.now(),
  });

  return result.text;
}

// ─────────────────────────────────────────────
// MODEL SWITCH mid-session
// The key: new model gets graph context, not chat dump
// ─────────────────────────────────────────────

async function switchModel(currentTaskId, newModel) {
  const { graphDb, ramDb } = getEngines();

  // 1. Snapshot current RAM session before switching
  //    This lets us restore exactly if the new model fails
  const snapshot = ramDb.snapshot();

  // 2. Write a ModelSwitch node to the graph
  //    New model can see: what was being worked on + why we switched
  const session = ramDb.query('SELECT * FROM session ORDER BY ts DESC LIMIT 1')[0];
  graphDb.createNode('ModelSwitch', {
    from_model: session?.model || 'unknown',
    to_model: newModel,
    reason: 'user-requested',
    task_context: session?.task || null,
    timestamp: Date.now(),
  });

  // 3. Load compressed context for handoff
  const ctx = await loadCompressedContext(session?.task || '');

  // 4. Update RAM session with new model
  ramDb.insert('session', {
    model: newModel,
    task: session?.task || null,
    context: JSON.stringify(ctx),
    snapshot_ref: Date.now(), // reference to snapshot if rollback needed
    ts: Date.now(),
  });

  console.error(`[router] Switched to ${newModel}. Context compressed to ~${JSON.stringify(ctx).length} chars`);

  // Return snapshot handle so caller can restore if needed
  return { snapshot, compressedContext: ctx };
}

// ─────────────────────────────────────────────
// Build minimal prompt from compressed context
// This is where token savings happen:
// instead of dumping history, we inject structured summaries
// ─────────────────────────────────────────────

function buildPrompt(taskDesc, ctx) {
  const parts = [];

  if (ctx.priorReasoning?.length) {
    parts.push(`Prior reasoning on similar tasks:\n${ctx.priorReasoning.join('\n')}`);
  }
  if (ctx.recentSignatures?.length) {
    parts.push(`Relevant code signatures from codebase:\n${ctx.recentSignatures.join('\n')}`);
  }
  if (ctx.relatedPatterns?.length) {
    parts.push(`Known patterns:\n${ctx.relatedPatterns.join('\n')}`);
  }

  parts.push(`Current task: ${taskDesc}`);

  return parts.join('\n\n---\n\n');
  // Typical output: 400-600 tokens vs 5,000-15,000 for raw history
}

// ─────────────────────────────────────────────
// Model adapters — add new models here ONLY
// ─────────────────────────────────────────────

async function callClaude(system, user, modelName) {
  const client = new Anthropic();
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
  const client = new OpenAI();
  const response = await client.chat.completions.create({
    model: modelName,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return {
    text: response.choices[0]?.message?.content || '',
    tokensUsed: response.usage?.total_tokens || 0,
    reasoning: null,
  };
}

// ─────────────────────────────────────────────
// Analytics: query TimeSeries for model comparison
// ─────────────────────────────────────────────

function getModelStats(modelName, hours = 24) {
  const { tsDb } = getEngines();
  const since = Math.floor(Date.now() / 1000) - (hours * 3600);
  const now   = Math.floor(Date.now() / 1000);

  return {
    avgTokens:  tsDb.aggregateTimeseries('token_usage', { func: 'avg', start: since, end: now }),
    avgLatency: tsDb.aggregateTimeseries('latency_ms',  { func: 'avg', start: since, end: now }),
    totalCalls: tsDb.queryTimeseries('token_usage', { start: since, end: now }).length,
  };
}

function classifyTask(taskDesc) {
  const d = taskDesc.toLowerCase();
  if (d.includes('fix') || d.includes('bug')) return 'debug';
  if (d.includes('test'))  return 'testing';
  if (d.includes('refact')) return 'refactor';
  if (d.includes('explain') || d.includes('what')) return 'explain';
  return 'generate';
}

module.exports = { routeTask, switchModel, getModelStats, buildPrompt, ADAPTERS };
