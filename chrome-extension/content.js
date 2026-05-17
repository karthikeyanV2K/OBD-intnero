// OverDrive AI Agent — Content Script
// Injects floating "Ask Agent" button near code selections on GitHub/GitLab

let floatingBtn = null;
let resultPanel = null;

document.addEventListener('mouseup', () => {
  const sel = window.getSelection()?.toString().trim();
  if (sel && sel.length > 20 && isCodePage()) {
    showFloatingButton(sel);
  }
});

function isCodePage() {
  const url = location.href;
  return url.includes('github.com') || url.includes('gitlab.com') || url.includes('localhost');
}

function showFloatingButton(selectedText) {
  removeFloatingButton();
  floatingBtn = document.createElement('button');
  floatingBtn.id = 'overdrive-agent-btn';
  floatingBtn.textContent = '⚡ Ask Agent';
  floatingBtn.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:999999;
    background:linear-gradient(135deg,#22d3ee,#a78bfa);
    color:#fff; border:none; border-radius:10px;
    padding:10px 20px; cursor:pointer; font-size:14px; font-weight:600;
    box-shadow:0 4px 16px rgba(34,211,238,0.3);
    transition:transform 0.15s, box-shadow 0.15s;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
  `;
  floatingBtn.onmouseenter = () => { floatingBtn.style.transform = 'scale(1.05)'; floatingBtn.style.boxShadow = '0 6px 24px rgba(34,211,238,0.4)'; };
  floatingBtn.onmouseleave = () => { floatingBtn.style.transform = 'scale(1)'; floatingBtn.style.boxShadow = '0 4px 16px rgba(34,211,238,0.3)'; };
  floatingBtn.onclick = () => askAgent(selectedText);
  document.body.appendChild(floatingBtn);
  setTimeout(removeFloatingButton, 10000);
}

function removeFloatingButton() {
  document.getElementById('overdrive-agent-btn')?.remove();
  floatingBtn = null;
}

function askAgent(task) {
  removeFloatingButton();
  showLoading();
  chrome.runtime.sendMessage({ type: 'ASK_AGENT', task }, (res) => {
    removeLoading();
    if (res?.ok) showResultPanel(res.result);
    else showResultPanel({ error: res?.error || 'No response from agent' });
  });
}

function showLoading() {
  resultPanel = document.createElement('div');
  resultPanel.id = 'overdrive-result-panel';
  resultPanel.style.cssText = `
    position:fixed; right:20px; top:60px; width:440px; max-height:70vh;
    overflow-y:auto; background:#111827; color:#e2e8f0; border-radius:12px;
    padding:20px; z-index:999998; font-size:13px; font-family:'Inter',system-ui,sans-serif;
    box-shadow:0 8px 32px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.07);
  `;
  resultPanel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <b style="color:#22d3ee;font-size:14px">⚡ OverDrive Agent</b>
      <button onclick="document.getElementById('overdrive-result-panel')?.remove()"
              style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px">✕</button>
    </div>
    <div style="text-align:center;padding:40px 0;color:#64748b">
      <div style="animation:spin 1s linear infinite;display:inline-block;font-size:24px;margin-bottom:12px">⟳</div>
      <div>Thinking...</div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(resultPanel);
}

function removeLoading() {
  // panel stays, content gets replaced
}

function showResultPanel(data) {
  const panel = document.getElementById('overdrive-result-panel');
  if (!panel) return;
  const error = data?.error;
  const content = error ? error : (data?.node_id ? `✅ Task stored. ID: ${data.node_id}` : JSON.stringify(data, null, 2));
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <b style="color:${error ? '#ef4444' : '#22d3ee'};font-size:14px">${error ? '❌ Error' : '⚡ Agent Result'}</b>
      <button onclick="document.getElementById('overdrive-result-panel')?.remove()"
              style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px">✕</button>
    </div>
    <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.6;background:#0a0e1a;padding:12px;border-radius:8px;color:#c5c6c7">${escHtml(content)}</pre>
  `;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_RESULT_PANEL') askAgent(msg.selectedText);
});
