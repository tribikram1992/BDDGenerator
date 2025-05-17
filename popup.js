const urlInput = document.getElementById('url-input');
const loadUrlButton = document.getElementById('load-url-button');
const actionsListEl = document.getElementById('actionsList');
const clearBtn = document.getElementById('clearBtn');
const generateBtn = document.getElementById('generateBtn');
const codeOutput = document.getElementById('codeOutput');

let currentData = null;

function renderActions(actions) {
  actionsListEl.innerHTML = '';
  if (!actions.length) {
    const li = document.createElement('li');
    li.textContent = '(No actions recorded)';
    actionsListEl.appendChild(li);
    clearBtn.disabled = true;
    generateBtn.disabled = true;
    codeOutput.style.display = 'none';
    return;
  }
  actions.forEach((action, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. Type: ${action.type}, XPath: ${action.xpath}${action.value ? `, Value: "${action.value}"` : ''}`;
    actionsListEl.appendChild(li);
  });
  clearBtn.disabled = false;
  generateBtn.disabled = false;
  codeOutput.style.display = 'none';
}

function loadActions() {
  chrome.runtime.sendMessage({ type: 'get-actions' }, (data) => {
    if (!data) data = { url: '', actions: [] };
    currentData = data;
    renderActions(data.actions);
    urlInput.value = data.url || '';
  });
}

clearBtn.addEventListener('click', () => {
  if (confirm('Clear all recorded data?')) {
    chrome.runtime.sendMessage({ type: 'clear-actions' });
    currentData = { url: '', actions: [] };
    renderActions([]);
    urlInput.value = '';
    codeOutput.style.display = 'none';
  }
});

loadUrlButton.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (!url) {
    alert('Please enter a URL to load');
    return;
  }
  chrome.runtime.sendMessage({ type: 'set-url', url: url });
  chrome.tabs.create({ url: url });
  currentData = { url: url, actions: [] };
  renderActions([]);
  codeOutput.style.display = 'none';
});

function downloadJSON(data) {
  const jsonStr = JSON.stringify(data, null, 2);
  codeOutput.textContent = jsonStr;
  codeOutput.style.display = 'block';

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'recorded_actions.json';
  a.click();
  URL.revokeObjectURL(url);
}

generateBtn.addEventListener('click', () => {
  if (!currentData || !currentData.actions || currentData.actions.length === 0) {
    alert('No recorded actions to generate JSON.');
    return;
  }
  downloadJSON(currentData);
});

window.onload = loadActions;