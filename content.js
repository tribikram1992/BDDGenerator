(function () {
  function getXPathWithFrames(element) {
    function getElementIdx(el) {
      let index = 1;
      let sibling = el.previousSibling;
      while (sibling) {
        if (sibling.nodeType === 1 && sibling.nodeName === el.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      return index;
    }

    function getXPath(el) {
      if (el.id) {
        const elemsWithId = el.ownerDocument.querySelectorAll(`#${CSS.escape(el.id)}`);
        if (elemsWithId.length === 1) {
          return `//*[@id="${el.id}"]`;
        }
      }

      let paths = [];
      let currentElem = el;

      while (currentElem && currentElem.nodeType === 1) {
        const tagName = currentElem.nodeName.toLowerCase();
        const idx = getElementIdx(currentElem);
        const part = idx > 1 ? `${tagName}[${idx}]` : tagName;
        paths.unshift(part);
        currentElem = currentElem.parentNode;
      }

      return '/' + paths.join('/');
    }

    function getFrameChain(win) {
      let chain = [];
      let currentWindow = win;
      // Traverse up until reaching the top window, collecting all containing frames
      while (currentWindow !== window.top) {
        const parentWindow = currentWindow.parent;
        let found = false;
        // Find which frame in parentWindow contains currentWindow
        for (let i = 0; i < parentWindow.frames.length; i++) {
          if (parentWindow.frames[i] === currentWindow) {
            const frameElements = parentWindow.document.querySelectorAll('iframe, frame');
            const frameElement = frameElements[i];
            if (frameElement) {
              // Prefer ID for stability, otherwise build XPath
              if (frameElement.id) {
                chain.unshift(`//*[@id="${frameElement.id}"]`);
              } else {
                chain.unshift(getXPath(frameElement));
              }
            }
            found = true;
            break;
          }
        }
        if (!found) break; // Safety check
        currentWindow = parentWindow;
      }
      return chain.join('||');
    }

    const xpath = getXPath(element);
    const framePath = getFrameChain(window);

    return { xpath, iFrame: framePath }; // Split for JSON output
  }

  function sendAction(action) {
    chrome.runtime.sendMessage({ type: 'record-action', action });
  }

  function onClick(e) {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

    const { xpath, iFrame } = getXPathWithFrames(e.target);
    let actionType = 'click';
    const elementName = e.target.name || e.target.id || e.target.className || '';
    if (e.target.tagName.toLowerCase() === 'button') {
      actionType = 'button';
    }
    const action = {
      type: actionType,
      xpath: xpath,
      iFrame: iFrame,
      name: elementName,
      timestamp: Date.now()
    };
    sendAction(action);
  }

  const inputTimers = new Map();
  const inputValues = new Map();

  function sendInputAction(el, xpath, iFrame) {
    const value = inputValues.get(el) || '';
    const elementName = el.name || el.id || el.className || '';
    const action = {
      type: 'input',
      xpath: xpath,
      iFrame: iFrame,
      value: value,
      name: elementName,
      timestamp: Date.now()
    };
    chrome.runtime.sendMessage({ type: 'record-action', action });
    inputValues.delete(el);
    inputTimers.delete(el);
  }

  function onInput(e) {
    const el = e.target;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !el.isContentEditable) return;

    const { xpath, iFrame } = getXPathWithFrames(el);
    inputValues.set(el, el.value || el.textContent || '');
    el._lastXpath = xpath;
    el._lastIFrame = iFrame;
  }

  function onBlur(e) {
    const el = e.target;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !el.isContentEditable) return;

    const xpath = el._lastXpath;
    const iFrame = el._lastIFrame;
    if (!xpath) return;

    if (inputTimers.has(el)) {
      clearTimeout(inputTimers.get(el));
      sendInputAction(el, xpath, iFrame);
    } else if (inputValues.has(el)) {
      sendInputAction(el, xpath, iFrame);
    }
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('blur', onBlur, true);
})();
