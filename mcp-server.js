/**
 * mcp-server.js
 * MCP (Model Context Protocol) server for unified tool access.
 * 
 * Exposes agent capabilities to:
 *   • Anthropic Claude (via claude.app MCP config)
 *   • VS Code Copilot (via VS Code extension)
 *   • Kiro IDE (via IDE extension)
 * 
 * One server, all three tools. Run: node mcp-server.js
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const { initAllEngines, getEngines } = require('./agent-db');
const { routeTask, switchModel, getModelStats } = require('./model-router');
const { submitTask, getTaskStatus } = require('./task-worker');

// ─────────────────────────────────────────────
// MCP Server setup
// ─────────────────────────────────────────────

const server = new Server(
  {
    name: 'OverdriveDB AI Agent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

let engineInitialized = false;

// Lazy init on first tool call
async function ensureEnginesReady() {
  if (!engineInitialized) {
    await initAllEngines();
    engineInitialized = true;
    console.error('[MCP] OverdriveDB engines initialized');
  }
}

// ─────────────────────────────────────────────
// MCP Tools — what Claude/Copilot/Kiro can call
// ─────────────────────────────────────────────

const tools = [
  {
    name: 'ask_agent',
    description: 'Submit a coding task to the AI agent. Uses compressed graph context for token efficiency. Returns code, reasoning, and updates knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The coding task or question. Can use pronouns like "that/this/it" — the agent will resolve them from prior context.',
        },
        model: {
          type: 'string',
          enum: ['claude-sonnet-4-6', 'claude-opus-4-6', 'gpt-4o', 'gpt-4o-mini'],
          description: 'Which model to route through. Default: claude-sonnet-4-6',
        },
        task_id: {
          type: 'string',
          description: 'Optional: link to a prior task node in the graph (for context chaining)',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'switch_model',
    description: 'Mid-session model switch. Takes a RAM snapshot first, writes ModelSwitch node to graph, then resumes with new model. No context loss.',
    inputSchema: {
      type: 'object',
      properties: {
        new_model: {
          type: 'string',
          enum: ['claude-sonnet-4-6', 'claude-opus-4-6', 'gpt-4o', 'gpt-4o-mini'],
          description: 'New model to switch to',
        },
        current_task_id: {
          type: 'string',
          description: 'The task currently in progress',
        },
        reason: {
          type: 'string',
          description: 'Why switch? (e.g., "use gpt-4o for code generation, then claude for review")',
        },
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
        node_type: {
          type: 'string',
          enum: ['Task', 'Reasoning', 'CodeBlock', 'ModelSwitch'],
          description: 'What to search for',
        },
        filter: {
          type: 'object',
          description: 'Optional filters: {status: "error"}, {model: "claude-sonnet-4-6"}, {language: "typescript"}',
        },
        limit: {
          type: 'number',
          description: 'Max results to return. Default: 10',
        },
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
        include_recent_tasks: {
          type: 'boolean',
          description: 'Include last 5 tasks? Default: true',
        },
      },
    },
  },
  {
    name: 'get_model_stats',
    description: 'Performance metrics for all models over time. Token usage, latency, quality scores (last 30 tasks per model).',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Filter to single model. If null, returns all.',
        },
        time_window_hours: {
          type: 'number',
          description: 'Look back N hours. Default: 24',
        },
      },
    },
  },
  {
    name: 'store_task_result',
    description: 'Manually store a task result to graph. Useful for tracking work done outside the agent.',
    inputSchema: {
      type: 'object',
      properties: {
        task_description: {
          type: 'string',
          description: 'What the task was',
        },
        result_code: {
          type: 'string',
          description: 'The code produced',
        },
        reasoning: {
          type: 'string',
          description: 'Why this approach',
        },
        model: {
          type: 'string',
          description: 'Which model "solved" this (can be null if external work)',
        },
        status: {
          type: 'string',
          enum: ['completed', 'error', 'review', 'blocked'],
          description: 'Status of the task',
        },
      },
      required: ['task_description', 'result_code', 'status'],
    },
  },
  {
    name: 'submit_async_task',
    description: 'Submit a long-running task to the queue. Returns immediately with task_id, processes asynchronously. Check status with get_task_status.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The task to queue',
        },
        model: {
          type: 'string',
          description: 'Model to route through',
        },
        priority: {
          type: 'string',
          enum: ['high', 'normal', 'low'],
          description: 'Task priority in queue',
        },
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
        task_id: {
          type: 'string',
          description: 'The task ID returned from submit_async_task',
        },
      },
      required: ['task_id'],
    },
  },
];

// ─────────────────────────────────────────────
// Tool handlers
// ─────────────────────────────────────────────

async function handleToolCall(name, args) {
  await ensureEnginesReady();
  const { graphDb, vectorDb, ramDb } = getEngines();

  switch (name) {
    // ─ ask_agent ─
    case 'ask_agent': {
      const { task, model = 'claude-sonnet-4-6', task_id } = args;
      const result = await routeTask(task, model);
      return {
        content: [
          {
            type: 'text',
            text: `Agent result (${model}):\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    }

    // ─ switch_model ─
    case 'switch_model': {
      const { new_model, current_task_id, reason } = args;
      const result = await switchModel(new_model, current_task_id, reason);
      return {
        content: [
          {
            type: 'text',
            text: `Switched to ${new_model}. Reason: ${reason}\n\nSnapshot saved. Ready to resume.`,
          },
        ],
      };
    }

    // ─ query_graph ─
    case 'query_graph': {
      const { node_type, filter = {}, limit = 10 } = args;
      try {
        const query = {
          type: node_type,
          ...filter,
          limit,
        };
        const results = graphDb.query(query);
        return {
          content: [
            {
              type: 'text',
              text: `Graph query results (${results.length} of ${limit}):\n\n${JSON.stringify(results, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Graph query error: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    // ─ get_session_context ─
    case 'get_session_context': {
      const { include_recent_tasks = true } = args;
      try {
        const sessionRes = ramDb.query('SELECT * FROM session ORDER BY ts DESC LIMIT 1');
        const session = sessionRes.length > 0 ? sessionRes[0] : {};
        const recentTasks = include_recent_tasks ? graphDb.listNodes('Task').slice(-5) : [];
        return {
          content: [
            {
              type: 'text',
              text: `Current session:\n${JSON.stringify(
                { session, recentTasks },
                null,
                2
              )}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }

    // ─ get_model_stats ─
    case 'get_model_stats': {
      const { model, time_window_hours = 24 } = args;
      try {
        const stats = await getModelStats(model, time_window_hours);
        return {
          content: [
            {
              type: 'text',
              text: `Model stats (last ${time_window_hours}h):\n${JSON.stringify(stats, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }

    // ─ store_task_result ─
    case 'store_task_result': {
      const { task_description, result_code, reasoning, model, status } = args;
      try {
        const taskNode = {
          id: `task_${Date.now()}`,
          description: task_description,
          status,
          model,
          created_at: new Date().toISOString(),
        };
        const reasoningNode = {
          id: `reasoning_${Date.now()}`,
          chain: reasoning || 'Manually stored',
          model,
          tokens_used: 0,
        };
        const codeNode = {
          id: `code_${Date.now()}`,
          signature: result_code.split('\n')[0],
          language: 'unknown',
          file: null,
        };

        graphDb.insertNode('Task', taskNode);
        graphDb.insertNode('Reasoning', reasoningNode);
        graphDb.insertNode('CodeBlock', codeNode);
        graphDb.insertEdge('SOLVED_BY', taskNode.id, reasoningNode.id);
        graphDb.insertEdge('PRODUCED', reasoningNode.id, codeNode.id);

        return {
          content: [
            {
              type: 'text',
              text: `Task stored. Graph IDs: task=${taskNode.id}, code=${codeNode.id}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }

    // ─ submit_async_task ─
    case 'submit_async_task': {
      const { task, model = 'claude-sonnet-4-6', priority = 'normal' } = args;
      try {
        const taskId = await submitTask(task, { model, priority });
        return {
          content: [
            {
              type: 'text',
              text: `Task queued. task_id: ${taskId}\nCheck status with: get_task_status(task_id="${taskId}")`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }

    // ─ get_task_status ─
    case 'get_task_status': {
      const { task_id } = args;
      try {
        const status = await getTaskStatus(task_id);
        return {
          content: [
            {
              type: 'text',
              text: `Task ${task_id} status:\n${JSON.stringify(status, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

// ─────────────────────────────────────────────
// MCP Protocol handlers
// ─────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`[MCP] Calling tool: ${name}`, args);
  return await handleToolCall(name, args);
});

// ─────────────────────────────────────────────
// Start server on stdin/stdout (for IDE integration)
// ─────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Server started. Ready for connections from Claude, VS Code, Kiro...');
}

main().catch((err) => {
  console.error('[MCP] Fatal error:', err);
  process.exit(1);
});
