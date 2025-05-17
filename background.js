const STORAGE_KEY = 'recordedData';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'record-action' && message.action) {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      let data = result[STORAGE_KEY] || { url: '', actions: [] };
      data.actions.push(message.action);
      chrome.storage.local.set({ [STORAGE_KEY]: data });
    });
  } else if (message.type === 'clear-actions') {
    chrome.storage.local.set({ [STORAGE_KEY]: { url: '', actions: [] } });
  } else if (message.type === 'get-actions') {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      sendResponse(result[STORAGE_KEY] || { url: '', actions: [] });
    });
    return true;
  } else if (message.type === 'set-url' && message.url) {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      let data = result[STORAGE_KEY] || { url: '', actions: [] };
      data.url = message.url;
      data.actions = [];
      chrome.storage.local.set({ [STORAGE_KEY]: data });
    });
  }
});