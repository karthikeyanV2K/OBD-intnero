/**
 * mcp-server.js  —  Overdrive AI Agent MCP Server
 *
 * Works in: Antigravity · Kiro · VS Code Copilot · GitHub Copilot · Claude Code
 *
 * Every prompt is tagged with the source IDE via OVERDRIVE_IDE env var.
 * ask_agent auto-stores every task to the graph — no manual saving needed.
 * All logs → stderr. stdout = MCP JSON-RPC only.
 */

const { Server }               = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { spawn }                = require('child_process');
const path                     = require('path');

try { require('dotenv').config(); } catch (_) {}

// ─────────────────────────────────────────────
// Dashboard lifecycle — starts with IDE, dies with IDE
// ─────────────────────────────────────────────

let _dashProc = null;

function startDashboard() {
  if (_dashProc) return; // already running
  const script = path.join(__dirname, 'server.js');
  _dashProc = spawn(process.execPath, [script], {
    stdio: ['ignore', 'ignore', 'pipe'], // stderr only so MCP stdout stays clean
    detached: false, // tied to this process — dies when MCP dies
  });
  _dashProc.stderr.on('data', d => console.error('[dashboard]', d.toString().trim()));
  _dashProc.on('exit', () => { _dashProc = null; });
  console.error(`[mcp] Dashboard started (pid ${_dashProc.pid})`);
}

function stopDashboard() {
  if (_dashProc) {
    _dashProc.kill('SIGTERM');
    _dashProc = null;
    console.error('[mcp] Dashboard stopped');
  }
}

// Start dashboard immediately when MCP server loads
startDashboard();

// Stop dashboard when IDE closes this process
process.on('exit',    stopDashboard);
process.on('SIGINT',  () => { stopDashboard(); process.exit(0); });
process.on('SIGTERM', () => { stopDashboard(); process.exit(0); });

const { initAllEngines, getEngines, categorizeTask } = require('./agent-db');
const { switchModel, getModelStats }                = require('./model-router');
const { submitTask, getTaskStatus }                 = require('./task-worker');
const {
  storeCodeStyle, storeSecurityRule, storeFeature,
  getFeatures, getConfirmedStyles, getSecurityAudit,
  getModelHeatmap, explainDecision, getCrossSessionSummary,
} = require('./knowledge');

// ─────────────────────────────────────────────
// IDE source — stamped on every graph node
// ─────────────────────────────────────────────

const IDE_SOURCE = process.env.OVERDRIVE_IDE    || 'Unknown';
let   ACTIVE_MODEL = process.env.OVERDRIVE_MODEL || 'claude-sonnet-4-6';

// ─────────────────────────────────────────────
// Auto model-switch tracker
// Every time the active model changes, a ModelSwitch node is written
// ─────────────────────────────────────────────
function trackModelSwitch(newModel, reason) {
  if (!newModel || newModel === ACTIVE_MODEL) return;
  const prev = ACTIVE_MODEL;
  ACTIVE_MODEL = newModel;
  try {
    const { graphDb } = getEngines();
    if (graphDb) {
      graphDb.createNode('ModelSwitch', {
        from_model: prev,
        to_model:   newModel,
        reason:     reason || 'auto-detected change',
        ide:        IDE_SOURCE,
        timestamp:  Date.now(),
        ts:         Date.now(),
      });
    }
    console.error(`[mcp] Model switch: ${prev} → ${newModel}`);
  } catch (e) { console.error('[mcp] trackModelSwitch error:', e.message); }
}

// ─────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────

const server = new Server(
  { name: 'OverdriveDB AI Agent', version: '1.0.12' },
  { capabilities: { tools: {} } }
);

let _engineReady = false;

async function ensureEnginesReady() {
  if (!_engineReady) {
    await initAllEngines();
    _engineReady = true;
  }
  // Re-init if idle-timer closed handles
  const { graphDb } = getEngines();
  if (!graphDb) {
    await initAllEngines();
  }
}

// ─────────────────────────────────────────────
// Tool definitions
// ─────────────────────────────────────────────

const tools = [
  {
    name: 'ask_agent',
    description: 'Submit a coding task to the AI agent. Model and task auto-detected from IDE context if not provided. Returns code, reasoning, and updates knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        task:    { type: 'string', description: 'The coding task or question. Optional — if omitted, uses last session context. Supports "that/this/it" references.' },
        model:   { type: 'string', enum: ['claude-sonnet-4-6', 'claude-opus-4-6', 'gpt-4o', 'gpt-4o-mini'], description: 'Model to use. Auto-detected from OVERDRIVE_MODEL env if not set.' },
        task_id: { type: 'string', description: 'Optional: link to a prior task node in the graph (for context chaining)' },
      },
      required: [],
    },
  },
  {
    name: 'auto_log',
    description: 'Auto-capture any IDE action to the graph. Called automatically by IDE hooks — no manual input needed. Saves what model did, what changed, what file was edited.',
    inputSchema: {
      type: 'object',
      properties: {
        action:      { type: 'string', description: 'What happened: edit, run, debug, search, switch_model, error, fix' },
        description: { type: 'string', description: 'What the action was about' },
        model:       { type: 'string', description: 'Current model (auto-detected if omitted)' },
        file:        { type: 'string', description: 'File being worked on (optional)' },
        detail:      { type: 'string', description: 'Extra context: error message, code snippet, result' },
      },
      required: ['action'],
    },
  },
  {
    name: 'store_task_result',
    description: 'Store a completed task result to the graph. Called automatically after ask_agent responses.',
    inputSchema: {
      type: 'object',
      properties: {
        task_description: { type: 'string', description: 'What the task was' },
        result_code:      { type: 'string', description: 'The code produced (signatures only for large outputs)' },
        reasoning:        { type: 'string', description: 'Why this approach (≤200 chars)' },
        model:            { type: 'string', description: 'Which model solved this' },
        status:           { type: 'string', enum: ['completed', 'error', 'review', 'blocked'], description: 'Status of the task' },
      },
      required: ['task_description', 'result_code', 'status'],
    },
  },
  {
    name: 'switch_model',
    description: 'Mid-session model switch. Takes a RAM snapshot first, writes ModelSwitch node to graph, then resumes with new model. No context loss.',
    inputSchema: {
      type: 'object',
      properties: {
        new_model:        { type: 'string', enum: ['claude-sonnet-4-6', 'claude-opus-4-6', 'gpt-4o', 'gpt-4o-mini'], description: 'New model to switch to' },
        current_task_id:  { type: 'string', description: 'The task currently in progress' },
        reason:           { type: 'string', description: 'Why switch?' },
      },
      required: ['new_model', 'current_task_id'],
    },
  },
  {
    name: 'query_graph',
    description: 'Search the knowledge graph. Find tasks, code blocks, reasoning chains. Supports filtering by status, model, file, type.',
    inputSchema: {
      type: 'object',
      properties: {
        node_type: { type: 'string', enum: ['Task', 'Reasoning', 'CodeBlock', 'ModelSwitch'], description: 'What to search for' },
        filter:    { type: 'object', description: 'Optional filters: {status: "error"}, {model: "claude-sonnet-4-6"}, {ide: "Kiro"}' },
        limit:     { type: 'number', description: 'Max results to return. Default: 10' },
      },
      required: ['node_type'],
    },
  },
  {
    name: 'get_session_context',
    description: 'Get current session state: active task, recent work, which model is active, unresolved references.',
    inputSchema: {
      type: 'object',
      properties: {
        include_recent_tasks: { type: 'boolean', description: 'Include last 5 tasks? Default: true' },
      },
    },
  },
  {
    name: 'get_model_stats',
    description: 'Performance metrics for all models over time. Token usage, latency, quality scores (last 30 tasks per model).',
    inputSchema: {
      type: 'object',
      properties: {
        model:             { type: 'string', description: 'Filter to single model. If null, returns all.' },
        time_window_hours: { type: 'number', description: 'Look back N hours. Default: 24' },
      },
    },
  },
  {
    name: 'submit_async_task',
    description: 'Submit a long-running task to the queue. Returns immediately with task_id, processes asynchronously. Check status with get_task_status.',
    inputSchema: {
      type: 'object',
      properties: {
        task:     { type: 'string',  description: 'The task to queue' },
        model:    { type: 'string',  description: 'Model to route through' },
        priority: { type: 'string',  enum: ['high', 'normal', 'low'], description: 'Task priority in queue' },
      },
      required: ['task'],
    },
  },
  {
    name: 'get_task_status',
    description: 'Check status of a queued task. Returns state, progress, or result if complete.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'The task ID returned from submit_async_task' },
      },
      required: ['task_id'],
    },
  },
];

// ─────────────────────────────────────────────
// Tool handlers
// ─────────────────────────────────────────────

async function handleToolCall(name, args) {
  try {
    await ensureEnginesReady();
    const { graphDb, ramDb, tsDb } = getEngines();

    switch (name) {

      // ── ask_agent ────────────────────────────────────────────────────────────
      // 1. Resolve "that/this/it" references from graph
      // 2. Assemble compressed context (~410 tokens)
      // 3. Auto-create a pending Task node (closed loop — no manual saving needed)
      // 4. Return context to the IDE AI for answering
      case 'ask_agent': {
        // Auto-detect model: args > OVERDRIVE_MODEL env > last known active model
        const task  = args.task  || '(no task provided — using session context)';
        const model = args.model || process.env.OVERDRIVE_MODEL || ACTIVE_MODEL;
        const { task_id } = args;

        // Track model switch if model changed
        trackModelSwitch(model, 'ask_agent call');

        const { assemblePrompt } = require('./prompt-builder');
        const { system, user, meta } = await assemblePrompt(task, { model });

        if (meta.referenceResolved) {
          console.error(`[agent] Reference resolved: "${meta.referenceResolved}"`);
        }

        // Auto-store pending Task node
        const taskId   = `task_${Date.now()}`;
        const category = categorizeTask(task);
        try {
          graphDb.createNode('Task', {
            id: taskId, description: task, model,
            ide: IDE_SOURCE, category, status: 'pending', ts: Date.now(),
          });
          ramDb.insert('session', { task, task_id: taskId, model, ide: IDE_SOURCE, ts: Date.now() });
          if (tsDb) tsDb.insertMeasurement('token_usage', Date.now() / 1000, meta.systemTokens || 0, { model, ide: IDE_SOURCE });
        } catch (e) { console.error('[agent] Auto-store error:', e.message); }

        return {
          content: [{
            type: 'text',
            text: [
              `## Task\n${user}`,
              `## Knowledge Graph Context (~${meta.systemTokens} tokens)\n${system}`,
              `## IDE Source\nThis task was submitted from: **${IDE_SOURCE}** | Model: **${model}**`,
              `## Instructions for IDE AI\n` +
              `Task ID: ${taskId}\n` +
              `After answering, call \`store_task_result\` with:\n` +
              `- task_description: the task above\n` +
              `- result_code: your code (signatures only for large outputs)\n` +
              `- reasoning: why you chose this approach (≤200 chars)\n` +
              `- status: "completed" or "error"\n` +
              `- model: "${model}"`,
            ].join('\n\n---\n\n'),
          }],
        };
      }

      // ── store_task_result ─────────────────────────────────────────────────────
      // Full auto-graph: builds edges, extracts style, persists session, links features
      case 'store_task_result': {
        const { task_description, result_code, status, reasoning } = args;
        const model    = args.model || process.env.OVERDRIVE_MODEL || ACTIVE_MODEL;
        const category = categorizeTask(task_description);
        trackModelSwitch(model, 'store_task_result');

        const reasoningSummary = (reasoning || '').substring(0, 200);
        const codeSignature    = extractSignature(result_code || '');

        // 1. Create completed Task node
        let taskNodeId;
        try {
          taskNodeId = graphDb.createNode('Task', {
            description: task_description,
            code:        codeSignature,
            status,
            model,
            ide:         IDE_SOURCE,
            category,
            reasoning:   reasoningSummary,
            ts:          Date.now(),
          });
        } catch (e) {
          taskNodeId = `fallback_${Date.now()}`;
          console.error('[store] createNode error:', e.message);
        }

        // 2. Create Reasoning node and link it
        let reasoningNodeId;
        if (reasoningSummary) {
          try {
            reasoningNodeId = graphDb.createNode('Reasoning', {
              summary:    reasoningSummary,
              model,
              ide:        IDE_SOURCE,
              ts:         Date.now(),
            });
            graphDb.createEdge('SOLVED_BY', taskNodeId, reasoningNodeId);
          } catch (_) {}
        }

        // 3. Create CodeBlock node and link it
        if (codeSignature) {
          try {
            const codeNodeId = graphDb.createNode('CodeBlock', {
              signature: codeSignature,
              language:  detectLang(result_code || ''),
              ide:       IDE_SOURCE,
              ts:        Date.now(),
            });
            if (reasoningNodeId) graphDb.createEdge('PRODUCED', reasoningNodeId, codeNodeId);
          } catch (_) {}
        }

        // 4. Auto-extract code style patterns from result_code
        const code = result_code || '';
        const { storeCodeStyle } = require('./knowledge');
        const stylePatterns = [
          { test: /\basync\b.*\bawait\b|\bawait\b/,       pattern: 'Uses async/await (not .then chains)',     language: 'javascript' },
          { test: /\btry\s*\{/,                            pattern: 'Wraps async calls in try/catch',          language: 'javascript' },
          { test: /console\.error/,                        pattern: 'Routes logs to stderr (console.error)',   language: 'javascript' },
          { test: /require\(['"]/,                         pattern: 'Uses CommonJS require (not ES imports)',  language: 'javascript' },
          { test: /const\s+\w+\s*=\s*require/,            pattern: 'Destructures requires at top of file',   language: 'javascript' },
          { test: /\.substring\(0,\s*\d+\)/,              pattern: 'Truncates strings with .substring()',    language: 'javascript' },
          { test: /process\.env\.\w+\s*\|\|/,             pattern: 'Uses env vars with || fallback defaults', language: 'javascript' },
          { test: /Date\.now\(\)/,                         pattern: 'Uses Date.now() for timestamps',          language: 'javascript' },
        ];
        stylePatterns.forEach(({ test, pattern, language }) => {
          if (test.test(code)) {
            try { storeCodeStyle({ pattern, language, ide: IDE_SOURCE }); } catch (_) {}
          }
        });

        // 5. Auto-link to matching Feature nodes (PART_OF edge)
        try {
          const { getFeatures } = require('./knowledge');
          const features = getFeatures();
          const desc = (task_description || '').toLowerCase();
          features.forEach(f => {
            const ftitle = (f.title || '').toLowerCase();
            // Simple keyword overlap check
            const words = ftitle.split(/\s+/).filter(w => w.length > 4);
            const match = words.some(w => desc.includes(w));
            if (match && f.id) {
              try { graphDb.createEdge('PART_OF', taskNodeId, f.id); } catch (_) {}
            }
          });
        } catch (_) {}

        // 6. Persist session to Disk DB (survives IDE restart)
        try {
          const { diskDb } = getEngines();
          diskDb.insert('solutions', {
            task_id:     taskNodeId,
            task:        task_description,
            model,
            ide:         IDE_SOURCE,
            category,
            status,
            code_signature: codeSignature,
            created_at:  Date.now(),
          });
          // Also seed RAM session so context is fresh
          ramDb.insert('session', {
            task:    task_description,
            task_id: taskNodeId,
            model,
            ide:     IDE_SOURCE,
            ts:      Date.now(),
          });
        } catch (_) {}

        const styleCount = stylePatterns.filter(({ test }) => test.test(code)).length;
        return { content: [{ type: 'text', text: `✅ Stored. Node: ${taskNodeId} | IDE: ${IDE_SOURCE} | Model: ${model} | Category: ${category} | Style patterns detected: ${styleCount} | Edges built: Task→Reasoning→Code` }] };
      }


      // ── switch_model ──────────────────────────────────────────────────────────
      case 'switch_model': {
        const { new_model, current_task_id, reason } = args;
        trackModelSwitch(new_model, reason || 'manual switch');
        await switchModel(current_task_id, new_model, reason);
        return { content: [{ type: 'text', text: `Switched to ${new_model}. IDE: ${IDE_SOURCE}. Reason: ${reason}. ModelSwitch node saved to graph.` }] };
      }

      // ── auto_log ──────────────────────────────────────────────────────────
      // Passive logger — IDE hooks call this for any action (edit, run, error, etc)
      case 'auto_log': {
        const { action, description = '', file = null, detail = '' } = args;
        const model    = args.model || process.env.OVERDRIVE_MODEL || ACTIVE_MODEL;
        const category = categorizeTask(description || action);

        // Detect model switches from auto_log
        if (action === 'switch_model' && args.detail) {
          trackModelSwitch(args.detail, 'auto_log switch_model action');
        } else {
          trackModelSwitch(model, `auto_log:${action}`);
        }

        let nodeId;
        try {
          nodeId = graphDb.createNode('Task', {
            description: `[${action}] ${description}`.substring(0, 200),
            action,
            file,
            detail:   detail.substring(0, 200),
            model,
            ide:      IDE_SOURCE,
            category,
            status:   action === 'error' ? 'error' : 'completed',
            ts:       Date.now(),
          });
        } catch (e) {
          nodeId = `autolog_${Date.now()}`;
          console.error('[auto_log] error:', e.message);
        }
        return { content: [{ type: 'text', text: `Auto-logged: [${action}] ${description.substring(0,60)} | Node: ${nodeId} | Model: ${model}` }] };
      }

      // ── query_graph ───────────────────────────────────────────────────────────
      case 'query_graph': {
        const { node_type, filter = {}, limit = 10 } = args;
        let results = [];
        try {
          results = graphDb.listNodes(node_type).slice(0, limit);
          // Apply filter
          if (Object.keys(filter).length > 0) {
            results = results.filter(n => {
              const props = n.properties || n.props || n;
              return Object.entries(filter).every(([k, v]) => props[k] === v);
            });
          }
        } catch (e) {
          console.error('[query] error:', e.message);
        }
        return { content: [{ type: 'text', text: `Graph query results (${results.length} of ${limit}):\n\n${JSON.stringify(results, null, 2)}` }] };
      }

      // ── get_session_context ───────────────────────────────────────────────────
      case 'get_session_context': {
        const { include_recent_tasks = true } = args;
        let session = {}, recentTasks = [];
        try {
          const rows = ramDb.query('SELECT * FROM session ORDER BY ts DESC LIMIT 1');
          session = rows[0] || {};
        } catch (_) {}
        if (include_recent_tasks) {
          try { recentTasks = graphDb.listNodes('Task').slice(-5); } catch (_) {}
        }
        return { content: [{ type: 'text', text: `Current session (IDE: ${IDE_SOURCE}):\n${JSON.stringify({ session, recentTasks }, null, 2)}` }] };
      }

      // ── get_model_stats ───────────────────────────────────────────────────────
      case 'get_model_stats': {
        const { model, time_window_hours = 24 } = args;
        const stats = getModelStats(model, time_window_hours);
        return { content: [{ type: 'text', text: `Model stats (last ${time_window_hours}h):\n${JSON.stringify(stats, null, 2)}` }] };
      }

      // ── submit_async_task ─────────────────────────────────────────────────────
      case 'submit_async_task': {
        const { task, model = 'claude-sonnet-4-6', priority = 'normal' } = args;
        const taskId = await submitTask(task, { model, priority });
        return { content: [{ type: 'text', text: `Task submitted. ID: ${taskId}\nPriority: ${priority}\nModel: ${model}` }] };
      }

      // ── store_code_style ─────────────────────────────────────────────────────
      case 'store_code_style': {
        const { pattern, language, example } = args;
        const result = storeCodeStyle({ pattern, language, example, ide: IDE_SOURCE });
        return { content: [{ type: 'text', text: `Style stored. Confidence: ${Math.round((result.confidence||0)*100)}% (${result.observations || 1} observations). ${result.confidence >= 0.8 ? '✅ Will be auto-injected into all future prompts.' : '⏳ Needs more observations to confirm.'}` }] };
      }

      // ── store_security_rule ───────────────────────────────────────────────────
      case 'store_security_rule': {
        const { rule, severity, category, example } = args;
        storeSecurityRule({ rule, severity, category, example });
        return { content: [{ type: 'text', text: `Security rule stored: [${(severity||'medium').toUpperCase()}] ${rule} — will be injected into all future prompts.` }] };
      }

      // ── store_feature ─────────────────────────────────────────────────────────
      case 'store_feature': {
        const { title, description, priority } = args;
        storeFeature({ title, description, priority, ide: IDE_SOURCE, model: args.model });
        return { content: [{ type: 'text', text: `Feature saved to roadmap: [${(priority||'medium').toUpperCase()}] ${title}` }] };
      }

      // ── explain_decision ──────────────────────────────────────────────────────
      case 'explain_decision': {
        const { task_id } = args;
        const explanation = explainDecision(task_id);
        if (explanation.error) return { content: [{ type: 'text', text: `Error: ${explanation.error}` }] };
        const text = [
          `**Task:** ${explanation.task}`,
          `**IDE:** ${explanation.ide}  |  **Model:** ${explanation.model}  |  **Category:** ${explanation.category}`,
          `**When:** ${explanation.timestamp}`,
          `**Reasoning:** ${explanation.reasoning}`,
          explanation.modelSwitch ? `**Model Switch:** ${explanation.modelSwitch}` : null,
        ].filter(Boolean).join('\n');
        return { content: [{ type: 'text', text }] };
      }

      // ── get_project_context ───────────────────────────────────────────────────
      case 'get_project_context': {
        const styles   = getConfirmedStyles(0.5);
        const audit    = getSecurityAudit();
        const features = getFeatures();
        const heatmap  = getModelHeatmap().slice(0, 5);
        const cont     = getCrossSessionSummary();
        const text = [
          cont ? `**Last session:** ${cont.hoursSince}h ago (${cont.lastIde} + ${cont.lastModel})\nLast task: ${cont.lastTask}\n${cont.ghostCount > 0 ? `⚠️ ${cont.ghostCount} unfinished tasks` : ''}` : '**Session:** First session or < 1h ago',
          `**Learned style (${styles.length} rules):**\n${styles.map(s => `  ✅ ${s.pattern} [${Math.round((s.confidence||0)*100)}%]`).join('\n') || '  None yet — add code to learn style'}`,
          `**Security:** ${audit.applied.length} rules applied, ${audit.missing.length} missing. Score: ${audit.score}%`,
          `**Roadmap:** ${features.length} features (${features.filter(f=>f.dead).length} dead)\n${features.slice(0,5).map(f => `  ${f.dead?'💀':'📌'} [${f.priority?.toUpperCase()}] ${f.title}`).join('\n')}`,
          `**Model heatmap:**\n${heatmap.map(h => `  ${h.ide}+${h.model} → ${h.category}: ${h.successRate}%`).join('\n') || '  Not enough data yet'}`,
        ].join('\n\n---\n\n');
        return { content: [{ type: 'text', text }] };
      }

      // ── get_task_status ───────────────────────────────────────────────────────
      case 'get_task_status': {
        const { task_id } = args;
        const status = await getTaskStatus(task_id);
        return { content: [{ type: 'text', text: `Task ${task_id} status: ${JSON.stringify(status, null, 2)}` }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    console.error(`[MCP] Tool error in ${name}:`, err);
    return { content: [{ type: 'text', text: `Error executing ${name}: ${err.message}` }], isError: true };
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Extract just the function/class signatures from code output.
 * Stores structure only — never full bodies.
 */
function extractSignature(code) {
  if (!code || code.length < 100) return code;
  const lines = code.split('\n');
  const sigLines = lines.filter(l => {
    const t = l.trim();
    return (
      t.startsWith('function ') ||
      t.startsWith('async function ') ||
      t.startsWith('class ') ||
      t.startsWith('const ') ||
      t.startsWith('export ') ||
      t.startsWith('module.exports')
    );
  });
  return sigLines.length > 0 ? sigLines.join('\n').substring(0, 400) : code.substring(0, 400);
}

function detectLang(code) {
  if (/^\s*(import|export|from)\s/m.test(code)) return 'javascript';
  if (/def \w+\(/.test(code)) return 'python';
  if (/fn \w+/.test(code)) return 'rust';
  return 'javascript';
}

// ─────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`[MCP] ${IDE_SOURCE} → ${name}`);
  return await handleToolCall(name, args);
});

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[MCP] Server ready. IDE: ${IDE_SOURCE}`);
}

main().catch(err => {
  console.error('[MCP] Fatal:', err);
  process.exit(1);
});
