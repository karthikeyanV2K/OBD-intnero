/**
 * prompt-builder.js
 *
 * Two jobs:
 *
 *  1. REFERENCE RESOLUTION
 *     User says "fix that", "use the function from before", "that bug again"
 *     We detect the reference → look it up from graph/RAM/disk → inject real data
 *
 *  2. SYSTEM PROMPT BUILDER
 *     Assembles a full system prompt from:
 *       - What the AI knows about the codebase (graph nodes)
 *       - What was done in this session (RAM)
 *       - Relevant past solutions (vector similarity)
 *       - The resolved reference (what "that" actually means)
 *
 *  Token budget: system prompt stays under 800 tokens always.
 *  Quality is NOT compromised — we pick the most relevant data, not just recent.
 */

const { getEngines } = require('./agent-db');
const {
  loadCompressedContext, findPatterns, extractKeyword, estimateTokens,
  getConfirmedStyles, getSecurityRules, getCrossSessionSummary,
  getModelHeatmap, getGhostTasks,
} = require('./knowledge');

function queryNodes(graphDb, type, options = {}) {
  let nodes = graphDb.listNodes(type).map(n => {
    // OverdriveDB returns { id, node_type, properties: {...} }
    // Unwrap so t.props.model works instead of t.props.properties.model
    const props = n.properties || n;
    const id    = n.id || n._id || props.id || props.taskId || 'unknown';
    return { id, props };
  });
  if (options.filter) nodes = nodes.filter(options.filter);
  if (options.orderBy) nodes = nodes.sort((a, b) => {
    let va = a.props[options.orderBy] || 0;
    let vb = b.props[options.orderBy] || 0;
    return options.desc ? vb - va : va - vb;
  });
  if (options.limit) nodes = nodes.slice(0, options.limit);
  return nodes;
}

// ─────────────────────────────────────────────
// Reference signal words
// When user says any of these → reference resolution kicks in
// ─────────────────────────────────────────────

const REFERENCE_PATTERNS = [
  // pronouns pointing to prior context
  /\b(that|this|it|those|these)\b/i,
  // temporal references
  /\b(before|previous|last|earlier|above|prior|yesterday|last session)\b/i,
  // implicit references
  /\b(the (bug|error|function|class|file|code|issue|fix|problem|task|one|feature|style|rule))\b/i,
  // fix/continue references
  /\b(fix it|do it|continue|same (thing|task|one)|what we planned|what we did)\b/i,
  // "that X" pattern
  /that (bug|error|function|class|method|component|issue|feature|task|style|security|rule)/i,
  // model/ide references
  /\b(what (kiro|claude|gpt|copilot|antigravity|vscode) did)\b/i,
];

function hasReference(userInput) {
  return REFERENCE_PATTERNS.some(p => p.test(userInput));
}

// ─────────────────────────────────────────────
// REFERENCE RESOLVER
// Looks up what "that/this/it" refers to from:
//   1. RAM  — current session (most recent = highest priority)
//   2. Graph — last N nodes traversed this session
//   3. Disk  — past solutions matching keywords
// ─────────────────────────────────────────────

async function resolveReference(userInput) {
  const { ramDb, graphDb, diskDb } = getEngines();

  const resolved = {
    type: null,        // 'task' | 'code' | 'error' | 'reasoning'
    id: null,
    data: null,
    confidence: 0,     // 0-1, how sure we are about the match
    label: null,       // human-readable: "the fetchUser() bug from task-12"
  };

  // ── 1. RAM: most recent session item ──
  // Highest confidence — if user just talked about something, it's still in RAM
  const lastSession = ramDb.query(
    'SELECT * FROM session ORDER BY ts DESC LIMIT 5'
  );
  const lastCtx = ramDb.query(
    'SELECT * FROM context_cache ORDER BY ts DESC LIMIT 5'
  );

  if (lastSession.length > 0) {
    const s = lastSession[0];
    resolved.type       = 'task';
    resolved.id         = s.task_id;
    resolved.data       = s;
    resolved.confidence = 0.9;
    resolved.label      = `"${s.task?.slice(0, 60) || 'last task'}"`;
  }

  // ── 2. Narrow by reference type keywords ──
  // "that bug" → look for error/fix nodes specifically
  // "that function" → look for CodeBlock nodes with matching type
  const lower = userInput.toLowerCase();

  if (/\b(bug|error|issue|problem|exception|crash)\b/.test(lower)) {
    const errorNodes = queryNodes(graphDb, 'Task', {
      filter: n => n.props.status === 'error' || n.props.description?.toLowerCase().includes('error'),
      limit: 3,
      orderBy: 'created_at',
      desc: true,
    });
    if (errorNodes.length > 0) {
      resolved.type       = 'error';
      resolved.id         = errorNodes[0].id;
      resolved.data       = errorNodes[0].props;
      resolved.confidence = 0.95;
      resolved.label      = `error in "${errorNodes[0].props.description?.slice(0, 60)}"`;
    }
  }

  if (/\b(function|method|fn|func)\b/.test(lower)) {
    const codeNodes = queryNodes(graphDb, 'CodeBlock', {
      limit: 3,
      orderBy: 'created_at',
      desc: true,
    });
    if (codeNodes.length > 0) {
      resolved.type       = 'code';
      resolved.id         = codeNodes[0].id;
      resolved.data       = codeNodes[0].props;
      resolved.confidence = 0.9;
      resolved.label      = `function ${codeNodes[0].props.signature?.split('\n')[0]?.slice(0, 60)}`;
    }
  }

  if (/\b(file|module|component|class)\b/.test(lower)) {
    const codeNodes = queryNodes(graphDb, 'CodeBlock', {
      filter: n => n.props.file != null,
      limit: 3,
      orderBy: 'created_at',
      desc: true,
    });
    if (codeNodes.length > 0) {
      resolved.type       = 'code';
      resolved.id         = codeNodes[0].id;
      resolved.data       = codeNodes[0].props;
      resolved.confidence = 0.88;
      resolved.label      = `file "${codeNodes[0].props.file}"`;
    }
  }

  // ── 3. Temporal: "the previous one", "before that" ──
  // Walk graph backwards from current session task
  if (/\b(previous|before|earlier|last one)\b/.test(lower) && lastSession.length > 1) {
    const s = lastSession[1]; // [1] = second most recent = "the previous"
    resolved.type       = 'task';
    resolved.id         = s.task_id;
    resolved.data       = s;
    resolved.confidence = 0.85;
    resolved.label      = `previous task: "${s.task?.slice(0, 60)}"`;
  }

  return resolved;
}

// ─────────────────────────────────────────────
// SYSTEM PROMPT BUILDER
// Assembles the full system prompt the AI receives.
// This is what makes the AI "know" everything already.
// ─────────────────────────────────────────────

async function buildSystemPrompt(userInput, options = {}) {
  const {
    model       = 'claude-sonnet-4-6',
    maxTokens   = 800,     // hard budget for system prompt
    sessionId   = null,
  } = options;

  const { ramDb, graphDb, diskDb } = getEngines();

  const sections = [];

  // ── Section 1: Identity + capabilities (fixed, ~60 tokens) ──
  sections.push({
    name: 'identity',
    weight: 100, // always included
    tokens: 60,
    text: `You are an AI coding agent with persistent memory via OverdriveDB.
You have full context of this session, past tasks, and the codebase knowledge graph.
When the user refers to "that", "this", "it", or "the previous", you know exactly what they mean from context below.`,
  });

  // ── Section 2: Reference resolution (conditional, ~80 tokens) ──
  let resolvedRef = null;
  if (hasReference(userInput)) {
    resolvedRef = await resolveReference(userInput);
    if (resolvedRef.confidence > 0.7) {
      const refText = buildReferenceText(resolvedRef);
      sections.push({
        name: 'reference',
        weight: 95, // near-always included when ref detected
        tokens: estimateTokens(refText),
        text: refText,
      });
    }
  }

  // ── Section 3: Current session state (RAM, ~40 tokens) ──
  let session = null;
  try {
    const rows = ramDb.query('SELECT * FROM session ORDER BY ts DESC LIMIT 1');
    session = rows[0] || null;
  } catch (_) {}
  if (session) {
    const sessionText = buildSessionText(session);
    sections.push({ name: 'session', weight: 90, tokens: estimateTokens(sessionText), text: sessionText });
  }

  // ── Section 3b: Cross-session continuity (~40 tokens) ──
  try {
    const cont = getCrossSessionSummary();
    if (cont) {
      const contText = [
        `[Last session — ${cont.hoursSince}h ago | ${cont.lastIde} + ${cont.lastModel}]`,
        `Last task: ${cont.lastTask}`,
        cont.ghostCount > 0 ? `⚠️ ${cont.ghostCount} unfinished task(s) from last session: ${cont.ghosts.join(', ')}` : null,
      ].filter(Boolean).join('\n');
      sections.push({ name: 'continuity', weight: 95, tokens: estimateTokens(contText), text: contText });
    }
  } catch (_) {}

  // ── Section 3c: Learned code style rules (~60 tokens) ──
  try {
    const styles = getConfirmedStyles(0.5);
    if (styles.length > 0) {
      const styleText = [
        '[Your confirmed coding style — follow these always]',
        ...styles.map(s => `✅ ${s.pattern}${s.example ? ` (e.g. ${s.example.substring(0,40)})` : ''} [confidence: ${Math.round((s.confidence||0)*100)}%]`),
      ].join('\n');
      sections.push({ name: 'style', weight: 88, tokens: estimateTokens(styleText), text: styleText });
    }
  } catch (_) {}

  // ── Section 3d: Security rules (~40 tokens) ──
  try {
    const rules = getSecurityRules().slice(0, 4);
    if (rules.length > 0) {
      const secText = [
        '[Security rules — always apply]',
        ...rules.map(r => `🔒 [${r.severity?.toUpperCase() || 'MED'}] ${r.rule}`),
      ].join('\n');
      sections.push({ name: 'security', weight: 85, tokens: estimateTokens(secText), text: secText });
    }
  } catch (_) {}

  // ── Section 3e: Best model suggestion (~30 tokens) ──
  try {
    const { categorizeTask } = require('./agent-db');
    const category = categorizeTask(userInput);
    const heatmap  = getModelHeatmap();
    const best     = heatmap.filter(h => h.category === category).sort((a,b) => b.successRate - a.successRate)[0];
    if (best && best.successRate > 0) {
      const hText = `[Best performer for ${category} tasks: ${best.ide} + ${best.model} (${best.successRate}% success rate)]`;
      sections.push({ name: 'heatmap', weight: 70, tokens: estimateTokens(hText), text: hText });
    }
  } catch (_) {}

  // ── Section 4: Recent graph history — last 4 tasks (~150 tokens) ──
  const recentTasks = queryNodes(graphDb, 'Task', {
    limit: 3,
    orderBy: 'created_at',
    desc: true,
  });
  if (recentTasks.length > 0) {
    const histText = buildHistoryText(recentTasks);
    sections.push({
      name: 'history',
      weight: 80,
      tokens: estimateTokens(histText),
      text: histText,
    });
  }

  // ── Section 5: Compressed context from graph+vector (~200 tokens) ──
  const ctx = await loadCompressedContext(userInput, 3);
  if (ctx.priorReasoning?.length || ctx.recentSignatures?.length) {
    const ctxText = buildKnowledgeText(ctx);
    sections.push({
      name: 'knowledge',
      weight: 75,
      tokens: estimateTokens(ctxText),
      text: ctxText,
    });
  }

  // ── Section 6: Known patterns from Disk (~80 tokens) ──
  const patterns = diskDb.search('patterns', extractKeyword(userInput)).slice(0, 3);
  if (patterns.length > 0) {
    const pText = `Known patterns:\n${patterns.map(p => `• ${p.signature}`).join('\n')}`;
    sections.push({
      name: 'patterns',
      weight: 60,
      tokens: estimateTokens(pText),
      text: pText,
    });
  }

  // ── Fit within token budget ──
  // Sort by weight (importance), include until we hit maxTokens
  sections.sort((a, b) => b.weight - a.weight);
  const included = [];
  let usedTokens = 0;
  for (const s of sections) {
    if (usedTokens + s.tokens <= maxTokens) {
      included.push(s.text);
      usedTokens += s.tokens;
    }
  }

  const systemPrompt = included.join('\n\n---\n\n');

  return {
    systemPrompt,
    resolvedRef,        // caller can use this to show the user what "that" resolved to
    estimatedTokens: usedTokens,
    sectionsIncluded: included.length,
  };
}

// ─────────────────────────────────────────────
// Section text builders
// ─────────────────────────────────────────────

function buildReferenceText(ref) {
  if (!ref?.data) return '';

  const lines = [`[Reference resolved: user said "that/this/it" → ${ref.label} (confidence: ${Math.round(ref.confidence * 100)}%)]`];

  if (ref.type === 'task') {
    lines.push(`Task: ${ref.data.task || ref.data.description || 'unknown'}`);
    lines.push(`Model used: ${ref.data.model || 'unknown'}`);
    lines.push(`Status: ${ref.data.status || 'unknown'}`);
    if (ref.data.context) {
      try {
        const ctx = JSON.parse(ref.data.context);
        if (ctx.lastTask) lines.push(`Last action: ${ctx.lastTask.slice(0, 100)}`);
      } catch (_) {}
    }
  }

  if (ref.type === 'code') {
    lines.push(`Code: ${ref.data.signature || 'no signature'}`);
    lines.push(`Language: ${ref.data.language || 'unknown'}`);
    if (ref.data.file) lines.push(`File: ${ref.data.file}`);
    if (ref.data.quality_score) lines.push(`Quality score: ${ref.data.quality_score}`);
  }

  if (ref.type === 'error') {
    lines.push(`Error task: ${ref.data.description || 'unknown'}`);
    lines.push(`Status: ${ref.data.status}`);
    lines.push(`Model: ${ref.data.model}`);
  }

  return lines.join('\n');
}

function buildSessionText(session) {
  const lines = ['[Current session]'];
  if (session.task)  lines.push(`Active task: ${session.task.slice(0, 120)}`);
  if (session.model) lines.push(`Current model: ${session.model}`);
  if (session.context) {
    try {
      const ctx = JSON.parse(session.context);
      if (ctx.priorReasoning?.length) {
        lines.push(`Recent reasoning: ${ctx.priorReasoning[0]?.slice(0, 80)}`);
      }
    } catch (_) {}
  }
  return lines.join('\n');
}

function buildHistoryText(tasks) {
  const lines = ['[Recent tasks in this session]'];
  tasks.forEach((t, i) => {
    lines.push(`${i + 1}. [${t.props.model || '?'}] ${t.props.description?.slice(0, 80)} — ${t.props.status}`);
  });
  return lines.join('\n');
}

function buildKnowledgeText(ctx) {
  const lines = ['[Codebase knowledge]'];
  if (ctx.recentSignatures?.length) {
    lines.push('Code signatures:');
    ctx.recentSignatures.forEach(s => lines.push(`  ${s}`));
  }
  if (ctx.priorReasoning?.length) {
    lines.push('Prior reasoning on similar tasks:');
    ctx.priorReasoning.forEach(r => lines.push(`  • ${r?.slice(0, 80)}`));
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────
// FULL PROMPT ASSEMBLER
// Returns: { system, user } ready to send to any model adapter
// ─────────────────────────────────────────────

async function assemblePrompt(userInput, options = {}) {
  const { systemPrompt, resolvedRef, estimatedTokens } = await buildSystemPrompt(userInput, options);

  // If a reference was resolved, add a transparent note to the user message
  // so the model knows what "that" refers to without the user having to re-explain
  let finalUserMessage = userInput;
  if (resolvedRef?.confidence > 0.7) {
    finalUserMessage = `${userInput}\n\n[Context: "${resolvedRef.label}" — data already in system prompt above]`;
  }

  return {
    system: systemPrompt,
    user:   finalUserMessage,
    meta: {
      referenceResolved: resolvedRef?.label || null,
      systemTokens: estimatedTokens,
      totalEstimatedTokens: estimatedTokens + estimateTokens(finalUserMessage),
    },
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

module.exports = { assemblePrompt, buildSystemPrompt, resolveReference, hasReference };
