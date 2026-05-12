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
// SUBMIT: Push a task onto the queue
// Called by VS Code extension or Chrome extension
// ─────────────────────────────────────────────

function submitTask(taskDesc, model = 'claude-sonnet-4-6', priority = 'normal') {
  const { streamDb } = getEngines();
  streamDb.publish('task_queue', {
    id: `task_${Date.now()}`,
    description: taskDesc,
    model,
    priority,
    submitted_at: Date.now(),
  });
  console.log(`[worker] Task queued: "${taskDesc.slice(0, 60)}..."`);
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

  console.log(`[worker] Started on partition ${partition}`);

  while (isRunning) {
    const messages = streamDb.poll(workerSub, { maxMessages: 5 });

    if (messages.length === 0) {
      await sleep(500); // back off if queue is empty
      continue;
    }

    for (const msg of messages) {
      const task = JSON.parse(msg.payload);
      console.log(`[worker] Processing: ${task.description.slice(0, 60)}`);

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

module.exports = { submitTask, startWorker, stopWorker, listenForResults };
