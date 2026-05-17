// OverDrive AI Agent — Chrome Extension Background Worker
// Probes local ports to find the running server, then relays requests.

const KNOWN_PORTS = [3742, 3743, 3744, 3745, 3746, 3747, 3748, 3749, 3750, 3001, 3000];
let AGENT_API = null;

async function discoverServer() {
  if (AGENT_API) return AGENT_API;
  for (const port of KNOWN_PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/api/tasks`, { signal: AbortSignal.timeout(500) });
      if (res.ok) {
        AGENT_API = `http://localhost:${port}`;
        console.log(`[OverDrive] Agent found at ${AGENT_API}`);
        chrome.storage.local.set({ agentPort: port });
        return AGENT_API;
      }
    } catch (_) {}
  }
  const stored = await chrome.storage.local.get('agentPort');
  if (stored.agentPort) {
    AGENT_API = `http://localhost:${stored.agentPort}`;
    return AGENT_API;
  }
  return null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ASK_AGENT') {
    discoverServer().then(api => {
      if (!api) { sendResponse({ ok: false, error: 'Agent server not found. Start with: npm run mcp' }); return; }
      fetch(`${api}/api/external/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: msg.task, model: msg.model || 'claude-sonnet-4-6' }),
      })
        .then(r => r.json())
        .then(data => sendResponse({ ok: true, result: data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    });
    return true;
  }

  if (msg.type === 'QUERY_GRAPH') {
    discoverServer().then(api => {
      if (!api) { sendResponse({ ok: false, error: 'Agent server not found.' }); return; }
      fetch(`${api}/api/graph`)
        .then(r => r.json())
        .then(data => sendResponse({ ok: true, data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    });
    return true;
  }

  if (msg.type === 'CHECK_STATUS') {
    discoverServer().then(api => {
      if (!api) { sendResponse({ status: 'disconnected' }); return; }
      fetch(`${api}/api/tasks`)
        .then(r => r.json())
        .then(data => sendResponse({ status: 'connected', taskCount: data.total || 0 }))
        .catch(() => sendResponse({ status: 'disconnected' }));
    });
    return true;
  }
});

chrome.contextMenus.create({
  id: 'ask-agent',
  title: '⚡ Ask OverDrive Agent',
  contexts: ['selection'],
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ask-agent') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_RESULT_PANEL',
      selectedText: info.selectionText,
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  discoverServer();
});
