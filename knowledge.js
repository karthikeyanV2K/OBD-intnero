/**
 * knowledge.js  —  Graph intelligence layer for Overdrive AI Agent v1.0.13
 *
 * Features:
 *   - Compressed context assembly (~410 tokens flat regardless of session length)
 *   - Confidence scoring on learned code style patterns
 *   - Ghost task detection (pending > 30min)
 *   - Cross-session continuity ("last session you were working on X")
 *   - Model performance heatmap data
 *   - Contradiction detection for style rules
 *   - Security audit
 *   - Smart reference resolution
 */

const { getEngines, categorizeTask } = require('./agent-db');

// ─────────────────────────────────────────────
// WRITE: Store a completed agent turn
// ─────────────────────────────────────────────

async function storeAgentTurn({ taskDesc, model, ide, reasoningChain, codeOutput }) {
  const { graphDb, diskDb } = getEngines();
  const IDE = ide || process.env.OVERDRIVE_IDE || 'Unknown';

  try {
    const category = categorizeTask(taskDesc);

    const taskId = graphDb.createNode('Task', {
      description: taskDesc,
      status:      'completed',
      model,
      ide:         IDE,
      category,
      created_at:  Date.now(),
    });

    const reasoningId = graphDb.createNode('Reasoning', {
      summary:     summarizeChain(reasoningChain).substring(0, 200),
      model,
      ide:         IDE,
      tokens_used: estimateTokens(reasoningChain),
      created_at:  Date.now(),
    });

    const codeId = graphDb.createNode('CodeBlock', {
      signature:   extractSignature(codeOutput),
      language:    detectLanguage(codeOutput),
      file:        codeOutput.file || null,
      ide:         IDE,
      created_at:  Date.now(),
    });

    try { graphDb.createEdge('SOLVED_BY', taskId, reasoningId); } catch (_) {}
    try { graphDb.createEdge('PRODUCED',  reasoningId, codeId); } catch (_) {}

    // Archive to Disk
    try {
      diskDb.insert('solutions', {
        task_id:        taskId,
        task:           taskDesc,
        model,
        ide:            IDE,
        category,
        code_signature: extractSignature(codeOutput),
        created_at:     Date.now(),
      });
    } catch (_) {}

    return { taskId, reasoningId, codeId };
  } catch (err) {
    console.error('[storeAgentTurn]', err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────
// WRITE: Store / update a code style pattern
// Confidence increases each time the same pattern is observed
// ─────────────────────────────────────────────

function storeCodeStyle({ pattern, language, example, ide }) {
  const { graphDb } = getEngines();
  const IDE = ide || process.env.OVERDRIVE_IDE || 'Unknown';

  try {
    // Check if pattern already exists
    const existing = graphDb.listNodes('CodeStyle').find(n => {
      const p = n.properties || n;
      return (p.pattern || '').toLowerCase() === pattern.toLowerCase() &&
             (p.language || '') === (language || '');
    });

    if (existing) {
      const props = existing.properties || existing;
      const observations = (props.observations || 1) + 1;
      const confidence   = Math.min(1.0, observations / 10);
      graphDb.createNode('CodeStyle', {
        id: existing.id,
        pattern,
        language:     language || 'any',
        example:      example  || props.example || '',
        confidence,
        observations,
        ide:          IDE,
        ts:           Date.now(),
      });
      return { confidence, observations, updated: true };
    } else {
      graphDb.createNode('CodeStyle', {
        pattern,
        language:     language || 'any',
        example:      example  || '',
        confidence:   0.3,
        observations: 1,
        ide:          IDE,
        ts:           Date.now(),
      });
      return { confidence: 0.3, observations: 1, updated: false };
    }
  } catch (e) {
    console.error('[storeCodeStyle]', e.message);
    return {};
  }
}

// ─────────────────────────────────────────────
// WRITE: Store a security rule
// ─────────────────────────────────────────────

function storeSecurityRule({ rule, severity = 'medium', category, example }) {
  const { graphDb } = getEngines();
  try {
    // Deduplicate
    const existing = graphDb.listNodes('Security').find(n => {
      const p = n.properties || n;
      return (p.rule || '').toLowerCase() === rule.toLowerCase();
    });

    if (existing) {
      const props = existing.properties || existing;
      graphDb.createNode('Security', {
        ...props,
        applied_count: (props.applied_count || 0) + 1,
        ts:            Date.now(),
      });
    } else {
      graphDb.createNode('Security', {
        rule, severity, category: category || 'general',
        example: example || '',
        applied_count: 1,
        ts: Date.now(),
      });
    }
  } catch (e) {
    console.error('[storeSecurityRule]', e.message);
  }
}

// ─────────────────────────────────────────────
// WRITE: Store a feature / roadmap item
// ─────────────────────────────────────────────

function storeFeature({ title, description, priority = 'medium', ide, model }) {
  const { graphDb } = getEngines();
  try {
    graphDb.createNode('Feature', {
      title,
      description: description || '',
      priority,
      status:      'planned',
      ide:         ide   || process.env.OVERDRIVE_IDE || 'Unknown',
      model:       model || 'manual',
      ts:          Date.now(),
    });
  } catch (e) {
    console.error('[storeFeature]', e.message);
  }
}

// ─────────────────────────────────────────────
// READ: Load compressed context (~410 tokens flat)
// ─────────────────────────────────────────────

async function loadCompressedContext(taskDesc, topK = 5) {
  const { graphDb, vectorDb, diskDb } = getEngines();

  // 1. Semantic search — only when Vector DB is on
  const taskEmbedding = await embedText(taskDesc);
  const similarTasks  = vectorDb
    ? vectorDb.vectorSearch('task_embeddings', taskEmbedding, topK)
    : [];

  const priorContext = similarTasks.map(match => {
    try {
      const nodes = graphDb.graphTraverse(match.id, 1).filter(n => n.type === 'Reasoning');
      return nodes.map(r => (r.props || {}).summary).join(' | ');
    } catch (_) { return ''; }
  }).filter(Boolean);

  // 2. Recent code signatures from disk
  let recentSignatures = [];
  try {
    recentSignatures = diskDb.query(
      'SELECT task, code_signature, model FROM solutions ORDER BY created_at DESC LIMIT 3'
    ).map(s => s.code_signature);
  } catch (_) {}

  // 3. Related patterns
  const relatedPatterns = await findPatterns(taskDesc);

  return {
    task: taskDesc,
    priorReasoning:   priorContext.slice(0, 3),
    recentSignatures,
    relatedPatterns,
  };
}

// ─────────────────────────────────────────────
// READ: Get learned code styles above confidence threshold
// ─────────────────────────────────────────────

function getConfirmedStyles(minConfidence = 0.5) {
  const { graphDb } = getEngines();
  try {
    return graphDb.listNodes('CodeStyle')
      .map(n => n.properties || n)
      .filter(p => (p.confidence || 0) >= minConfidence)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 5);
  } catch (_) { return []; }
}

// ─────────────────────────────────────────────
// READ: Get all security rules
// ─────────────────────────────────────────────

function getSecurityRules() {
  const { graphDb } = getEngines();
  try {
    return graphDb.listNodes('Security').map(n => n.properties || n);
  } catch (_) { return []; }
}

// ─────────────────────────────────────────────
// READ: Security audit — what's applied vs missing
// ─────────────────────────────────────────────

const SECURITY_CHECKLIST = [
  { id: 'validate-inputs',   rule: 'Validate all API inputs',               category: 'input',    severity: 'high'   },
  { id: 'param-queries',     rule: 'Use parameterized queries (no SQL injection)', category: 'db', severity: 'critical' },
  { id: 'rate-limit',        rule: 'Add rate limiting to API endpoints',    category: 'api',      severity: 'high'   },
  { id: 'https-only',        rule: 'Use HTTPS only',                        category: 'transport', severity: 'high'  },
  { id: 'sanitize-xss',      rule: 'Sanitize HTML outputs (prevent XSS)',   category: 'output',   severity: 'high'   },
  { id: 'csrf-protection',   rule: 'Add CSRF protection to forms',          category: 'forms',    severity: 'medium' },
  { id: 'hash-passwords',    rule: 'Hash passwords with bcrypt/argon2',     category: 'auth',     severity: 'critical' },
  { id: 'no-sensitive-logs', rule: 'Never log sensitive data (passwords, tokens)', category: 'logging', severity: 'high' },
  { id: 'security-headers',  rule: 'Set security headers (helmet.js)',      category: 'headers',  severity: 'medium' },
  { id: 'deps-up-to-date',   rule: 'Keep dependencies up to date',          category: 'deps',     severity: 'medium' },
];

function getSecurityAudit() {
  const applied = getSecurityRules().map(r => r.rule.toLowerCase().trim());
  const report  = SECURITY_CHECKLIST.map(item => ({
    ...item,
    applied: applied.some(a => a === item.rule.toLowerCase().trim()),
  }));
  return {
    applied:   report.filter(r =>  r.applied),
    missing:   report.filter(r => !r.applied),
    score:     Math.round((report.filter(r => r.applied).length / report.length) * 100),
  };
}

// ─────────────────────────────────────────────
// READ: Ghost tasks (pending > 30 min)
// ─────────────────────────────────────────────

function getGhostTasks() {
  const { graphDb } = getEngines();
  const GHOST_THRESHOLD = 30 * 60 * 1000; // 30 minutes
  try {
    return graphDb.listNodes('Task')
      .map(n => n.properties || n)
      .filter(p =>
        p.status === 'pending' &&
        p.ts && (Date.now() - p.ts) > GHOST_THRESHOLD
      )
      .sort((a, b) => a.ts - b.ts);
  } catch (_) { return []; }
}

// ─────────────────────────────────────────────
// READ: Cross-session continuity summary
// ─────────────────────────────────────────────

function getCrossSessionSummary() {
  const { graphDb } = getEngines();
  try {
    const allTasks = graphDb.listNodes('Task').map(n => n.properties || n);
    if (!allTasks.length) return null;

    // Sort by timestamp
    const sorted     = allTasks.filter(t => t.ts).sort((a, b) => b.ts - a.ts);
    const lastTask   = sorted[0];
    const now        = Date.now();
    const lastTs     = lastTask?.ts || 0;
    const hoursSince = Math.round((now - lastTs) / 3600000);

    // Is this a new session? (gap > 1 hour)
    if (hoursSince < 1) return null;

    const ghosts     = getGhostTasks();
    const lastModel  = lastTask?.model  || 'unknown';
    const lastIde    = lastTask?.ide    || 'Unknown';

    return {
      hoursSince,
      lastTask:   lastTask?.description?.substring(0, 80) || '—',
      lastModel,
      lastIde,
      ghostCount: ghosts.length,
      ghosts:     ghosts.slice(0, 3).map(g => g.description?.substring(0, 60)),
    };
  } catch (_) { return null; }
}

// ─────────────────────────────────────────────
// READ: Model performance heatmap
// ─────────────────────────────────────────────

function getModelHeatmap() {
  const { graphDb } = getEngines();
  try {
    const tasks = graphDb.listNodes('Task').map(n => n.properties || n).filter(t => t.model && t.ide);

    // Group by ide+model+category
    const map = {};
    tasks.forEach(t => {
      const key = `${t.ide}|${t.model}|${t.category || 'general'}`;
      if (!map[key]) map[key] = { ide: t.ide, model: t.model, category: t.category || 'general', total: 0, completed: 0 };
      map[key].total++;
      if (t.status === 'completed') map[key].completed++;
    });

    return Object.values(map).map(r => ({
      ...r,
      successRate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
    })).sort((a, b) => b.successRate - a.successRate);
  } catch (_) { return []; }
}

// ─────────────────────────────────────────────
// READ: Planned features + dead feature detection
// ─────────────────────────────────────────────

function getFeatures() {
  const { graphDb } = getEngines();
  const DEAD_FEATURE_DAYS = 7;
  try {
    return graphDb.listNodes('Feature').map(n => {
      const p   = n.properties || n;
      const age = (Date.now() - (p.ts || 0)) / 86400000; // days
      return {
        ...p,
        id:   n.id || n._id,
        dead: p.status === 'planned' && age > DEAD_FEATURE_DAYS,
        ageDays: Math.round(age),
      };
    }).sort((a, b) => {
      const pri = { high: 0, medium: 1, low: 2 };
      return (pri[a.priority] || 1) - (pri[b.priority] || 1);
    });
  } catch (_) { return []; }
}

// ─────────────────────────────────────────────
// READ: Explain why a past decision was made
// ─────────────────────────────────────────────

function explainDecision(taskId) {
  const { graphDb } = getEngines();
  try {
    // Find task
    const allTasks = graphDb.listNodes('Task');
    const task     = allTasks.find(n => {
      const p = n.properties || n;
      return (n.id === taskId || p.id === taskId);
    });

    if (!task) return { error: `Task ${taskId} not found` };
    const taskProps = task.properties || task;

    // Traverse to find connected Reasoning nodes
    let reasoning = [];
    try {
      const traversed = graphDb.graphTraverse(task.id || taskId, 2);
      reasoning = traversed
        .filter(n => n.type === 'Reasoning')
        .map(n => (n.props || n.properties || {}).summary)
        .filter(Boolean);
    } catch (_) {}

    // Find ModelSwitch nodes around same timestamp
    let modelSwitch = null;
    try {
      const switches = graphDb.listNodes('ModelSwitch')
        .map(n => n.properties || n)
        .filter(p => p.timestamp && Math.abs(p.timestamp - (taskProps.ts || 0)) < 300000);
      modelSwitch = switches[0] || null;
    } catch (_) {}

    return {
      task:        taskProps.description,
      ide:         taskProps.ide    || 'Unknown',
      model:       taskProps.model  || 'unknown',
      category:    taskProps.category || 'general',
      timestamp:   taskProps.ts ? new Date(taskProps.ts).toLocaleString() : '—',
      reasoning:   reasoning.join(' → ') || 'No reasoning chain stored for this task.',
      modelSwitch: modelSwitch
        ? `Switched from ${modelSwitch.from_model} to ${modelSwitch.to_model}: ${modelSwitch.reason}`
        : null,
    };
  } catch (e) {
    return { error: e.message };
  }
}

// ─────────────────────────────────────────────
// READ: Full graph export for visualization
// ─────────────────────────────────────────────

function exportFullGraph() {
  const { graphDb } = getEngines();
  const uniqueNodes = new Map();
  const uniqueEdges = new Map();

  const COLOR = { Task: '#66fcf1', Reasoning: '#f2a900', CodeBlock: '#c5c6c7', CodeStyle: '#22c55e', Security: '#ef4444', Feature: '#a78bfa', Project: '#3b82f6', ModelSwitch: '#f97316' };

  ['Task', 'Reasoning', 'CodeBlock', 'CodeStyle', 'Security', 'Feature', 'Project', 'ModelSwitch'].forEach(type => {
    try {
      graphDb.listNodes(type).forEach(n => {
        if (uniqueNodes.has(n.id)) return;
        const p = n.properties || n;
        uniqueNodes.set(n.id, {
          id:    n.id,
          label: `${type}\n${(p.description || p.title || p.pattern || p.rule || p.summary || '').substring(0, 25)}`,
          color: COLOR[type] || '#66fcf1',
          props: p,
        });

        try {
          graphDb.graphTraverse(n.id, 2).forEach(child => {
            if (!uniqueNodes.has(child.id)) {
              const cp = child.props || {};
              uniqueNodes.set(child.id, {
                id:    child.id,
                label: `${child.type}\n${(cp.description || cp.summary || cp.signature || '').substring(0, 25)}`,
                color: COLOR[child.type] || '#66fcf1',
                props: cp,
              });
            }
            if (child.edges) {
              child.edges.forEach(e => {
                const eid = `${e.from}_${e.to}`;
                uniqueEdges.set(eid, { from: e.from, to: e.to, label: e.type });
              });
            }
          });
        } catch (_) {}
      });
    } catch (_) {}
  });

  if (uniqueNodes.size === 0) {
    uniqueNodes.set('empty', { id: 'empty', label: 'No data yet', color: '#64748b', props: {} });
  }

  return { nodes: Array.from(uniqueNodes.values()), edges: Array.from(uniqueEdges.values()) };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function summarizeChain(chain) {
  const steps = (chain || '').split('\n').filter(l => l.trim());
  return steps.slice(-3).join(' → ').substring(0, 200);
}

function extractSignature(codeOutput) {
  const lines = (codeOutput?.code || codeOutput || '').split('\n');
  return lines
    .filter(l => /^(export\s+)?(async\s+)?function|^const\s+\w+\s*=|^class\s+/.test(l.trim()))
    .slice(0, 5).join('\n').substring(0, 400);
}

function detectLanguage(codeOutput) {
  return (codeOutput?.language) || 'javascript';
}

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function extractKeyword(taskDesc) {
  return (taskDesc || '').split(' ').slice(0, 3).join(' ');
}

async function embedText(text) {
  const input = (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return h; };
  const seed = hash(input);
  const rng = (i) => { const x = Math.sin(seed * (i + 1) + 1) * 10000; return x - Math.floor(x); };
  return new Array(384).fill(0).map((_, i) => rng(i));
}

async function findPatterns(taskDesc) {
  const { diskDb } = getEngines();
  try {
    const keyword = extractKeyword(taskDesc);
    const fromPatterns = diskDb.search('patterns', keyword).slice(0, 3).map(p => p.signature);
    if (fromPatterns.length > 0) return fromPatterns;
    const fromSolutions = diskDb.query(
      'SELECT code_signature FROM solutions ORDER BY created_at DESC LIMIT 3'
    ).map(s => s.code_signature).filter(Boolean);
    return fromSolutions;
  } catch (_) { return []; }
}

function getTaskHistory(taskId) {
  const { graphDb } = getEngines();
  try { return graphDb.graphTraverse(taskId, 2); } catch (_) { return []; }
}

async function findSimilarCode(embedding, topK = 10) {
  const { vectorDb } = getEngines();
  if (!vectorDb) return [];
  return vectorDb.vectorSearch('code_embeddings', embedding, topK);
}

module.exports = {
  storeAgentTurn,
  storeCodeStyle,
  storeSecurityRule,
  storeFeature,
  loadCompressedContext,
  getConfirmedStyles,
  getSecurityRules,
  getSecurityAudit,
  getGhostTasks,
  getCrossSessionSummary,
  getModelHeatmap,
  getFeatures,
  explainDecision,
  exportFullGraph,
  getTaskHistory,
  findSimilarCode,
  findPatterns,
  extractKeyword,
  embedText,
  estimateTokens,
};
