/**
 * task-worker.js
 * Streaming engine consumer — processes queued tasks asynchronously.
 *
 * Streaming engine gives us:
 *   - Durable task queue (survives crashes)
 *   - Partitioned processing (4 partitions = 4 parallel workers)
 *   - Offset commit = exactly-once processing guarantee
 *   - Back-pressure: workers slow naturally when graph writes are slow
 */

const { getEngines } = require('./agent-db');
const { routeTask }  = require('./model-router');

let workerSub = null;
let isRunning = false;

// ─────────────────────────────────────────────
// In-memory task status tracker
// Used by getTaskStatus to report async task progress
// ─────────────────────────────────────────────

const _taskStatus = new Map();
let _statusListenerStarted = false;

function _ensureStatusListener() {
  if (_statusListenerStarted) return;
  _statusListenerStarted = true;
  try {
    listenForResults((result) => {
      if (result.task_id) {
        _taskStatus.set(result.task_id, { status: 'completed', result, completed_at: Date.now() });
      }
    });
  } catch (_) { /* engines not ready yet — will pick up status from graph later */ }
}

// ─────────────────────────────────────────────
// SUBMIT: Push a task onto the queue
// Called by VS Code extension or Chrome extension
// ─────────────────────────────────────────────

function submitTask(taskDesc, model = 'claude-sonnet-4-6', priority = 'normal') {
  const { streamDb } = getEngines();
  const taskId = `task_${Date.now()}`;
  streamDb.publish('task_queue', {
    id: taskId,
    description: taskDesc,
    model,
    priority,
    submitted_at: Date.now(),
  });
  _taskStatus.set(taskId, { status: 'queued', submitted_at: Date.now() });
  _ensureStatusListener();
  console.error(`[worker] Task queued: "${taskDesc.slice(0, 60)}..."`);
  return taskId;
}

// ─────────────────────────────────────────────
// GET STATUS: Check async task progress
// Falls back to graph DB scan if not in memory
// ─────────────────────────────────────────────

function getTaskStatus(taskId) {
  const mem = _taskStatus.get(taskId);
  if (mem) return { task_id: taskId, ...mem };
  try {
    const { graphDb } = getEngines();
    const tasks = graphDb.listNodes('Task') || [];
    const match = tasks.find(t => String(t.id) === taskId || String(t._id) === taskId);
    if (match) {
      return { task_id: taskId, status: 'completed', data: match.properties || match.props || match };
    }
  } catch (_) {}
  return { task_id: taskId, status: 'unknown' };
}

// ─────────────────────────────────────────────
// WORKER: Poll and process tasks
// Run this in a background process / extension host
// ─────────────────────────────────────────────

async function startWorker(partition = 0) {
  const { streamDb } = getEngines();
  isRunning = true;

  // Subscribe to the task queue on our partition
  workerSub = streamDb.subscribe('task_queue', {
    group: 'agent-workers',
    partition,
  });

  console.error(`[worker] Started on partition ${partition}`);

  while (isRunning) {
    const messages = streamDb.poll(workerSub, { maxMessages: 5 });

    if (messages.length === 0) {
      await sleep(500); // back off if queue is empty
      continue;
    }

    for (const msg of messages) {
      const task = JSON.parse(msg.payload);
      console.error(`[worker] Processing: ${task.description.slice(0, 60)}`);

      try {
        const result = await routeTask(task.description, task.model);

        // Publish result for consumers (e.g. VS Code webview)
        streamDb.publish('model_results', {
          task_id: task.id,
          result,
          completed_at: Date.now(),
        });

        // Emit agent event for monitoring
        streamDb.publish('agent_events', {
          type: 'task_completed',
          task_id: task.id,
          model: task.model,
          ts: Date.now(),
        });
      } catch (err) {
        console.error(`[worker] Task failed: ${err.message}`);
        streamDb.publish('agent_events', {
          type: 'task_failed',
          task_id: task.id,
          error: err.message,
          ts: Date.now(),
        });
      }
    }

    // Commit offset after processing batch
    // This means if we crash mid-batch, only the processed ones are acknowledged
    streamDb.commitOffset(workerSub);
  }
}

// ─────────────────────────────────────────────
// CONSUMER: Listen for results (e.g. VS Code panel)
// ─────────────────────────────────────────────

function listenForResults(onResult, partition = 0) {
  const { streamDb } = getEngines();

  const sub = streamDb.subscribe('model_results', {
    group: 'result-consumers',
    partition,
  });

  const poll = setInterval(() => {
    const messages = streamDb.poll(sub, { maxMessages: 10 });
    messages.forEach(msg => {
      onResult(JSON.parse(msg.payload));
    });
    if (messages.length > 0) streamDb.commitOffset(sub);
  }, 300);

  return () => {
    clearInterval(poll);
    streamDb.unsubscribe(sub);
  };
}

function stopWorker() {
  isRunning = false;
  if (workerSub) {
    const { streamDb } = getEngines();
    streamDb.unsubscribe(workerSub);
  }
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

module.exports = { submitTask, startWorker, stopWorker, listenForResults, getTaskStatus };
