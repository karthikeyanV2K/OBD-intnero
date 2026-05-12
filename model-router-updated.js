/**
 * model-router.js  (updated routeTask only — replace the old routeTask function)
 *
 * Change: routeTask now calls assemblePrompt() first.
 * assemblePrompt() detects references ("that", "it", "the bug") and resolves them
 * from OverdriveDB before building the prompt. The rest is unchanged.
 */

const { assemblePrompt } = require('./prompt-builder');
const { getEngines }     = require('./agent-db');
const { storeAgentTurn } = require('./knowledge');

// ─────────────────────────────────────────────
// UPDATED routeTask — drop-in replacement
// ─────────────────────────────────────────────

async function routeTask(taskDesc, modelName) {
  const { tsDb, streamDb, ramDb } = getEngines();
  const startTime = Date.now();
  const adapter   = ADAPTERS[modelName];

  if (!adapter) throw new Error(`No adapter for model: ${modelName}`);

  // 1. Build prompt — resolves "that/this/it" + injects DB knowledge
  const { system, user, meta } = await assemblePrompt(taskDesc, { model: modelName });

  // 2. Log what reference was resolved (visible in server logs / VS Code Output panel)
  if (meta.referenceResolved) {
    console.log(`[router] Reference resolved: "${meta.referenceResolved}"`);
  }
  console.log(`[router] System prompt: ~${meta.systemTokens} tokens  |  model: ${modelName}`);

  // 3. Call the selected model with structured { system, user } prompt
  const result = await adapter(system, user, modelName);

  const latency = Date.now() - startTime;

  // 4. Track metrics
  tsDb.insertMeasurement('token_usage', Date.now() / 1000, result.tokensUsed, { model: modelName });
  tsDb.insertMeasurement('latency_ms',  Date.now() / 1000, latency,           { model: modelName });

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
// Updated model adapters — now accept { system, user }
// ─────────────────────────────────────────────

const Anthropic = require('@anthropic-ai/sdk');
const OpenAI    = require('openai');

const ADAPTERS = {
  'claude-sonnet-4-6': callClaude,
  'claude-opus-4-6':   callClaude,
  'gpt-4o':            callOpenAI,
  'gpt-4o-mini':       callOpenAI,
};

async function callClaude(system, user, modelName) {
  const client   = new Anthropic();
  const response = await client.messages.create({
    model:      modelName,
    max_tokens: 4096,
    system,                                         // ← system prompt with DB knowledge
    messages: [{ role: 'user', content: user }],   // ← user message with resolved ref
  });
  return {
    text:       response.content[0].text,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}

async function callOpenAI(system, user, modelName) {
  const client   = new OpenAI();
  const response = await client.chat.completions.create({
    model:      modelName,
    max_tokens: 4096,
    messages: [
      { role: 'system',  content: system },
      { role: 'user',    content: user   },
    ],
  });
  return {
    text:       response.choices[0].message.content,
    tokensUsed: response.usage.total_tokens,
  };
}

module.exports = { routeTask };
// switchModel and getModelStats remain in the original model-router.js
