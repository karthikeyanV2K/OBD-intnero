// ═══════════════════════════════════════════════════════
// vscode-extension/package.json
// ═══════════════════════════════════════════════════════
// Save as: vscode-extension/package.json

{
  "name": "overdrive-ai-agent",
  "displayName": "OverDrive AI Agent",
  "description": "AI coding agent with persistent knowledge graph via OverdriveDB",
  "version": "1.0.0",
  "publisher": "your-publisher-id",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["AI", "Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      { "command": "agent.ask",         "title": "Ask AI Agent",         "icon": "$(robot)" },
      { "command": "agent.switchModel", "title": "Agent: Switch Model",  "icon": "$(sync)"  },
      { "command": "agent.showMetrics", "title": "Agent: Show Metrics",  "icon": "$(graph)" }
    ],
    "keybindings": [
      { "command": "agent.ask", "key": "ctrl+shift+a", "mac": "cmd+shift+a" }
    ],
    "views": {
      "explorer": [{ "id": "agentPanel", "name": "AI Agent", "icon": "$(robot)" }]
    },
    "menus": {
      "editor/context": [
        { "command": "agent.ask", "group": "navigation", "when": "editorHasSelection" }
      ]
    }
  },
  "scripts": {
    "compile": "tsc -p ./",
    "watch":   "tsc -watch -p ./",
    "package": "npx vsce package",
    "publish": "npx vsce publish"
  },
  "dependencies": {
    "overdrive-db":       "^2.3.0",
    "@anthropic-ai/sdk":  "^0.39.0",
    "openai":             "^4.0.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@vscode/vsce":  "^2.24.0",
    "typescript":    "^5.0.0"
  }
}


// ═══════════════════════════════════════════════════════
// HOW TO PUBLISH THE VS CODE EXTENSION
// ═══════════════════════════════════════════════════════

/*
Step 1: Create publisher at https://marketplace.visualstudio.com/manage
         (sign in with Microsoft account)

Step 2: Create a PAT token
         Azure DevOps → User Settings → Personal Access Tokens
         Scope: Marketplace → Manage

Step 3: Login and publish
         npx vsce login your-publisher-id
         npx vsce publish

Step 4: Or publish to Open VSX (for open source / Gitpod / Codium)
         npx ovsx publish --pat YOUR_OPEN_VSX_TOKEN
*/


// ═══════════════════════════════════════════════════════
// chrome-extension/manifest.json
// ═══════════════════════════════════════════════════════
// Save as: chrome-extension/manifest.json

{
  "manifest_version": 3,
  "name": "OverDrive AI Agent",
  "version": "1.0.0",
  "description": "AI coding agent in the browser — works on GitHub, GitLab, localhost",
  "permissions": ["activeTab", "storage", "scripting", "contextMenus"],
  "host_permissions": [
    "https://github.com/*",
    "https://gitlab.com/*",
    "http://localhost/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["https://github.com/*", "https://gitlab.com/*", "http://localhost/*"],
    "js": ["content.js"],
    "css": ["content.css"]
  }],
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "48": "icons/icon48.png" }
  },
  "icons": { "48": "icons/icon48.png", "128": "icons/icon128.png" }
}


// ═══════════════════════════════════════════════════════
// chrome-extension/background.js
// ═══════════════════════════════════════════════════════

// The background service worker calls your agent API endpoint.
// OverdriveDB runs server-side (e.g. Node.js on localhost:3001)
// since Chrome extensions can't run native binaries directly.

const AGENT_API = 'http://localhost:3001';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ASK_AGENT') {
    fetch(`${AGENT_API}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: msg.task, model: msg.model || 'claude-sonnet-4-6' }),
    })
      .then(r => r.json())
      .then(data => sendResponse({ ok: true, result: data.result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // keep message channel open for async response
  }

  if (msg.type === 'SWITCH_MODEL') {
    fetch(`${AGENT_API}/switch-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: msg.model }),
    })
      .then(r => r.json())
      .then(data => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

// Context menu: right-click selected text → "Ask Agent"
chrome.contextMenus.create({
  id: 'ask-agent',
  title: 'Ask AI Agent',
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


// ═══════════════════════════════════════════════════════
// chrome-extension/content.js
// ═══════════════════════════════════════════════════════

// Injected into GitHub/GitLab pages
// Adds floating "Ask Agent" button near code blocks

document.addEventListener('mouseup', () => {
  const sel = window.getSelection()?.toString().trim();
  if (sel && sel.length > 20) {
    showFloatingButton(sel);
  }
});

function showFloatingButton(selectedText) {
  removeFloatingButton();
  const btn = document.createElement('button');
  btn.id = 'overdrive-agent-btn';
  btn.textContent = '⚡ Ask Agent';
  btn.style.cssText = `
    position:fixed; bottom:20px; right:20px; z-index:999999;
    background:#2563eb; color:#fff; border:none; border-radius:8px;
    padding:8px 16px; cursor:pointer; font-size:14px; font-weight:500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  btn.onclick = () => askAgent(selectedText);
  document.body.appendChild(btn);
  setTimeout(removeFloatingButton, 8000);
}

function removeFloatingButton() {
  document.getElementById('overdrive-agent-btn')?.remove();
}

function askAgent(task) {
  removeFloatingButton();
  chrome.runtime.sendMessage({ type: 'ASK_AGENT', task }, (res) => {
    if (res?.ok) showResultPanel(res.result);
    else alert('Agent error: ' + (res?.error || 'unknown'));
  });
}

function showResultPanel(result) {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position:fixed; right:20px; top:60px; width:420px; max-height:70vh;
    overflow-y:auto; background:#1e1e2e; color:#cdd6f4; border-radius:12px;
    padding:16px; z-index:999998; font-size:13px; font-family:monospace;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  `;
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:12px">
      <b style="color:#89b4fa">⚡ Agent Result</b>
      <button onclick="this.parentElement.parentElement.remove()"
              style="background:none;border:none;color:#cdd6f4;cursor:pointer;font-size:16px">✕</button>
    </div>
    <pre style="margin:0;white-space:pre-wrap;word-break:break-word">${escapeHtml(result)}</pre>
  `;
  document.body.appendChild(panel);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_RESULT_PANEL') askAgent(msg.selectedText);
});


// ═══════════════════════════════════════════════════════
// HOW TO PUBLISH THE CHROME EXTENSION
// ═══════════════════════════════════════════════════════

/*
Step 1: Go to https://chrome.google.com/webstore/devconsole
         Pay one-time $5 developer fee

Step 2: Zip the chrome-extension/ folder (NOT the parent folder):
         cd chrome-extension && zip -r ../agent-chrome.zip .

Step 3: Upload on the dashboard:
         New Item → Upload → agent-chrome.zip

Step 4: Fill in store listing (name, description, screenshots)
         Screenshots: 1280x800 or 640x400, at least 1 required

Step 5: Submit for review (usually 1-3 business days)

For Firefox: submit to https://addons.mozilla.org (manifest v2 or v3)
For Edge:    submit to https://partner.microsoft.com/dashboard
*/
