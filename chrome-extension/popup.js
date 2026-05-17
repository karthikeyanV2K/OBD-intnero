// OverDrive AI Agent — Popup Script

const taskInput = document.getElementById('taskInput');
const modelSelect = document.getElementById('modelSelect');
const askBtn = document.getElementById('askBtn');
const graphBtn = document.getElementById('graphBtn');
const statusBtn = document.getElementById('statusBtn');
const resultArea = document.getElementById('resultArea');
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');

function setStatus(connected) {
  statusDot.className = 'status-dot ' + (connected ? 'connected' : 'disconnected');
  statusLabel.textContent = connected ? 'Connected' : 'Disconnected';
}

function showResult(text, isError) {
  resultArea.textContent = text;
  resultArea.className = 'result show' + (isError ? ' error' : '');
}

function hideResult() {
  resultArea.className = 'result';
}

askBtn.addEventListener('click', () => {
  const task = taskInput.value.trim();
  if (!task) { showResult('Please enter a task', true); return; }
  hideResult();
  askBtn.disabled = true;
  askBtn.textContent = '⏳ Thinking...';
  chrome.runtime.sendMessage({ type: 'ASK_AGENT', task, model: modelSelect.value }, (res) => {
    askBtn.disabled = false;
    askBtn.textContent = '⚡ Ask Agent';
    if (res?.ok) showResult(JSON.stringify(res.result, null, 2));
    else showResult(res?.error || 'No response from agent', true);
  });
});

graphBtn.addEventListener('click', () => {
  graphBtn.disabled = true;
  graphBtn.textContent = '⏳ Loading...';
  chrome.runtime.sendMessage({ type: 'QUERY_GRAPH' }, (res) => {
    graphBtn.disabled = false;
    graphBtn.textContent = '📊 Graph';
    if (res?.ok) {
      const { nodes, edges } = res.data;
      showResult(`📊 Knowledge Graph\nNodes: ${nodes.length}\nEdges: ${edges.length}\n\nTypes found:\n${
        [...new Set(nodes.map(n => n.label?.split('\n')[0] || 'Unknown'))].join('\n')
      }`);
    } else showResult(res?.error || 'Could not load graph', true);
  });
});

statusBtn.addEventListener('click', () => {
  statusBtn.disabled = true;
  chrome.runtime.sendMessage({ type: 'CHECK_STATUS' }, (res) => {
    statusBtn.disabled = false;
    if (res?.status === 'connected') {
      setStatus(true);
      showResult(`✅ Connected to agent\nTotal tasks in graph: ${res.taskCount}`);
    } else {
      setStatus(false);
      showResult('❌ Agent not running. Start with:\nnpm run mcp', true);
    }
  });
});

// Auto-check status on open
chrome.runtime.sendMessage({ type: 'CHECK_STATUS' }, (res) => {
  setStatus(res?.status === 'connected');
});
