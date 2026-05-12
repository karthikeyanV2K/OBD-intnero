/**
 * vscode-extension/src/extension.ts
 *
 * Build:  cd vscode-extension && npm run compile
 * Test:   F5 in VS Code (opens Extension Development Host)
 * Package: npx vsce package
 * Publish: npx vsce publish  (needs Azure DevOps PAT)
 *
 * package.json contributes needed:
 *   "commands": [
 *     { "command": "agent.ask",         "title": "Ask AI Agent" },
 *     { "command": "agent.switchModel", "title": "Agent: Switch Model" },
 *     { "command": "agent.showMetrics", "title": "Agent: Show Metrics" }
 *   ],
 *   "views": {
 *     "explorer": [{ "id": "agentPanel", "name": "AI Agent" }]
 *   },
 *   "keybindings": [
 *     { "command": "agent.ask", "key": "ctrl+shift+a", "mac": "cmd+shift+a" }
 *   ]
 */

import * as vscode from 'vscode';
// These run in the extension host (Node.js) — not in the webview
const { initAllEngines } = require('../../agent-db');
const { routeTask, switchModel, getModelStats } = require('../../model-router');
const { submitTask, listenForResults } = require('../../task-worker');

let currentModel = 'claude-sonnet-4-6';
let statusBar: vscode.StatusBarItem;
let stopListening: (() => void) | null = null;

// ─────────────────────────────────────────────
// ACTIVATE — called once when extension loads
// ─────────────────────────────────────────────

export async function activate(ctx: vscode.ExtensionContext) {
  // Initialize all 6 OverdriveDB engines on startup
  await initAllEngines();

  // Status bar shows current model
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'agent.switchModel';
  updateStatusBar();
  statusBar.show();
  ctx.subscriptions.push(statusBar);

  // ── Command: Ask AI Agent (Ctrl+Shift+A) ──
  ctx.subscriptions.push(
    vscode.commands.registerCommand('agent.ask', async () => {
      const editor = vscode.window.activeTextEditor;
      const selection = editor?.document.getText(editor.selection) || '';
      const fileName  = editor?.document.fileName || '';
      const language  = editor?.document.languageId || 'code';

      const userInput = await vscode.window.showInputBox({
        prompt: 'What should the agent do?',
        value: selection ? `Explain this ${language}: ${selection.slice(0, 100)}` : '',
      });
      if (!userInput) return;

      // Show progress while agent runs
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Agent (${currentModel})`, cancellable: false },
        async (progress) => {
          progress.report({ message: 'Loading context from graph...' });

          // Submit to Streaming queue (async, non-blocking)
          submitTask(userInput, currentModel);

          // For immediate results, also call directly
          progress.report({ message: 'Calling model...' });
          const result = await routeTask(userInput, currentModel);

          // Open result in a new editor tab
          const doc = await vscode.workspace.openTextDocument({
            content: result,
            language: 'markdown',
          });
          await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
        }
      );
    })
  );

  // ── Command: Switch Model ──
  ctx.subscriptions.push(
    vscode.commands.registerCommand('agent.switchModel', async () => {
      const models = [
        { label: '$(sparkle) Claude Sonnet 4.6',  description: 'Fast, efficient', id: 'claude-sonnet-4-6' },
        { label: '$(star) Claude Opus 4.6',        description: 'Most capable',   id: 'claude-opus-4-6'   },
        { label: '$(zap) GPT-4o',                 description: 'OpenAI',         id: 'gpt-4o'            },
        { label: '$(zap) GPT-4o mini',            description: 'OpenAI fast',    id: 'gpt-4o-mini'       },
      ];

      const picked = await vscode.window.showQuickPick(models, {
        placeHolder: `Current: ${currentModel}`,
        title: 'Switch AI Model — context preserved via OverdriveDB graph',
      });
      if (!picked) return;

      // The switchModel call: snapshots RAM, writes graph handoff node
      await switchModel(null, picked.id);

      currentModel = picked.id;
      updateStatusBar();
      vscode.window.showInformationMessage(
        `Switched to ${picked.id}. Context preserved from graph — no context loss.`
      );
    })
  );

  // ── Command: Show Metrics ──
  ctx.subscriptions.push(
    vscode.commands.registerCommand('agent.showMetrics', async () => {
      const stats = getModelStats(currentModel, 24);
      const panel = vscode.window.createWebviewPanel(
        'agentMetrics', `Agent Metrics — ${currentModel}`,
        vscode.ViewColumn.Beside, {}
      );
      panel.webview.html = buildMetricsHtml(stats, currentModel);
    })
  );

  // ── Listen for async results from Streaming engine ──
  stopListening = listenForResults((result: any) => {
    vscode.window.showInformationMessage(
      `Agent task completed (${result.completed_at ? 'done' : 'processing'})`,
      'View Result'
    ).then(choice => {
      if (choice === 'View Result') {
        vscode.workspace.openTextDocument({ content: result.result || '', language: 'markdown' })
          .then(doc => vscode.window.showTextDocument(doc));
      }
    });
  });
}

export function deactivate() {
  if (stopListening) stopListening();
  statusBar?.dispose();
}

function updateStatusBar() {
  const short = currentModel.replace('claude-', '').replace('-4-6', '').replace('gpt-', 'GPT-');
  statusBar.text = `$(robot) ${short}`;
  statusBar.tooltip = `AI Agent: ${currentModel} (click to switch)`;
}

function buildMetricsHtml(stats: any, model: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px">
    <h2>Agent Metrics — ${model} (last 24h)</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td>Avg tokens/call</td><td><b>${Math.round(stats.avgTokens || 0)}</b></td></tr>
      <tr><td>Avg latency</td><td><b>${Math.round(stats.avgLatency || 0)}ms</b></td></tr>
      <tr><td>Total calls</td><td><b>${stats.totalCalls || 0}</b></td></tr>
    </table>
  </body></html>`;
}

