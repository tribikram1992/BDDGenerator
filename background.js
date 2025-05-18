chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  chrome.storage.local.get(['bddgen_actions', 'activeSessionId'], (result) => {
    let state = result && result.bddgen_actions ? result.bddgen_actions : { url: '', actions: [], scenarioName: '' };
    if (msg.type === 'get-actions') {
      sendResponse(state);
    }
    else if (msg.type === 'record-action') {
      if (!msg.sessionId || msg.sessionId !== result.activeSessionId) return;
      state.actions.push(msg.action);
      chrome.storage.local.set({ bddgen_actions: state });
    }
    else if (msg.type === 'clear-actions') {
      state = { url: '', actions: [], scenarioName: '' };
      chrome.storage.local.set({ bddgen_actions: state });
    }
    else if (msg.type === 'set-url') {
      state.url = msg.url || '';
      chrome.storage.local.set({ bddgen_actions: state });
    }
    else if (msg.type === 'set-scenario-name') {
      state.scenarioName = msg.name || '';
      chrome.storage.local.set({ bddgen_actions: state });
    }
    return true;
  });
  return true;
});