/**
 * knowledge.js
 * All graph + vector operations for the AI agent.
 *
 * Graph engine  → relationships between tasks, reasoning, code
 * Vector engine → semantic search across past code and tasks
 */

const { getEngines } = require('./agent-db');

// ─────────────────────────────────────────────
// WRITE: Store a completed agent turn to the graph
// ─────────────────────────────────────────────

async function storeAgentTurn({ taskDesc, model, reasoningChain, codeOutput, embedding }) {
  const { graphDb, vectorDb, diskDb } = getEngines();

  try {
    // 1. Task node
    const taskId = graphDb.createNode('Task', {
      description: taskDesc,
      status: 'completed',
      model,
      created_at: Date.now(),
    });

    // 2. Reasoning node — only store the SUMMARY, not full chain
    const reasoningId = graphDb.createNode('Reasoning', {
      chain: reasoningChain,
      summary: summarizeChain(reasoningChain),
      model,
      tokens_used: estimateTokens(reasoningChain),
    });

    // 3. Code node — store signature only (not full body)
    const codeId = graphDb.createNode('CodeBlock', {
      signature: extractSignature(codeOutput),
      language: detectLanguage(codeOutput),
      file: codeOutput.file || null,
      quality_score: 1.0,
    });

    // 4. Connect them
    graphDb.createEdge('SOLVED_BY', taskId, reasoningId);
    graphDb.createEdge('PRODUCED',  reasoningId, codeId);

    // 5. Store code embedding in Vector engine
    if (embedding) {
      vectorDb.insertVector('code_embeddings', codeId, embedding);
    }

    // 6. Archive to Disk for long-term persistence
    diskDb.insert('solutions', {
      task_id: taskId,
      task: taskDesc,
      model,
      code_signature: extractSignature(codeOutput),
      created_at: Date.now(),
    });

    return { taskId, reasoningId, codeId };
  } catch (err) {
    console.error('[storeAgentTurn] Error:', err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────
// READ: Load compressed context for a new model
// This is the TOKEN REDUCTION core.
// Instead of 10,000 tokens of chat history →
// returns ~400-600 tokens of structured context.
// ─────────────────────────────────────────────

async function loadCompressedContext(taskDesc, topK = 5) {
  const { graphDb, vectorDb, diskDb } = getEngines();

  // 1. Semantic search — find similar past tasks (Vector engine)
  //    Pass the embedding of the current task description
  const taskEmbedding = await embedText(taskDesc); // your embedding fn
  const similarTasks = vectorDb.vectorSearch('task_embeddings', taskEmbedding, topK);

  // 2. For each similar task, pull the reasoning SUMMARY from graph
  //    (not the full chain — that's the whole point)
  const priorContext = similarTasks.map(match => {
    const reasoningNodes = graphDb.graphTraverse(match.id, 1)
      .filter(n => n.type === 'Reasoning');
    return reasoningNodes.map(r => r.props.summary).join(' | ');
  });

  // 3. Pull last 3 code signatures from graph (not full code bodies)
  const recentSolutions = diskDb.query(
    'SELECT task, code_signature, model FROM solutions ORDER BY created_at DESC LIMIT 3'
  );

  // 4. Assemble compressed context
  return {
    task: taskDesc,
    priorReasoning: priorContext.slice(0, 3),          // ~150 tokens
    recentSignatures: recentSolutions.map(s => s.code_signature), // ~100 tokens
    relatedPatterns: await findPatterns(taskDesc),     // ~100 tokens
  };
  // Total: ~350-500 tokens regardless of how long the session has been
}

// ─────────────────────────────────────────────
// READ: Get full reasoning history for a task
// (used only for debugging, not sent to models)
// ─────────────────────────────────────────────

function getTaskHistory(taskId) {
  const { graphDb } = getEngines();
  // Graph traverse depth=2 gives: Task → Reasoning → CodeBlock
  return graphDb.graphTraverse(taskId, 2);
}

// ─────────────────────────────────────────────
// READ: Find related code via vector similarity
// ─────────────────────────────────────────────

async function findSimilarCode(embedding, topK = 10) {
  const { vectorDb } = getEngines();
  return vectorDb.vectorSearch('code_embeddings', embedding, topK);
}

// ─────────────────────────────────────────────
// READ: Load known patterns from Disk engine
// ─────────────────────────────────────────────

async function findPatterns(taskDesc) {
  const { diskDb } = getEngines();
  const keyword = extractKeyword(taskDesc);
  return diskDb.search('patterns', keyword).slice(0, 3).map(p => p.signature);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function summarizeChain(chain) {
  // Extract just the decision points from the reasoning chain
  // "I need to check X because Y, so I'll do Z" → "checked X → did Z"
  const steps = chain.split('\n').filter(l => l.trim().length > 0);
  return steps.slice(-3).join(' → ').slice(0, 200); // last 3 steps, max 200 chars
}

function extractSignature(codeOutput) {
  // Extract function/class signatures only — not full bodies
  // e.g. "async function fetchUser(id: string): Promise<User>" not the full function
  const lines = (codeOutput.code || '').split('\n');
  return lines
    .filter(l => /^(export\s+)?(async\s+)?function|^const\s+\w+\s*=|^class\s+/.test(l.trim()))
    .slice(0, 5)
    .join('\n');
}

function detectLanguage(codeOutput) {
  return codeOutput.language || 'javascript';
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4); // rough 4-chars-per-token estimate
}

function extractKeyword(taskDesc) {
  return taskDesc.split(' ').slice(0, 3).join(' ');
}

// Replace with your actual embedding function (e.g. Anthropic, OpenAI, local)
async function embedText(text) {
  // Returns a Float32Array of length 384
  // e.g. from @xenova/transformers or OpenAI text-embedding-3-small
  return new Array(384).fill(0).map(() => Math.random()); // placeholder
}

module.exports = {
  storeAgentTurn,
  loadCompressedContext,
  getTaskHistory,
  findSimilarCode,
  findPatterns,
  extractKeyword,
  embedText,
  estimateTokens,
};
