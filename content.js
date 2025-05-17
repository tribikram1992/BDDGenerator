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

    function getXPathAndIndex(el) {
      if (el.id) {
        const elemsWithId = el.ownerDocument.querySelectorAll(`#${CSS.escape(el.id)}`);
        if (elemsWithId.length === 1) {
          return { xpath: `//*[@id="${el.id}"]`, index: 0 };
        } else if (elemsWithId.length > 1) {
          // Multiple elements with same ID (invalid HTML but possible)
          for (let i = 0; i < elemsWithId.length; i++) {
            if (elemsWithId[i] === el) {
              return { xpath: `//*[@id="${el.id}"]`, index: i };
            }
          }
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

      const xpath = '/' + paths.join('/');

      // Find index of this element among all matches
      const evaluator = el.ownerDocument;
      const xpathResult = evaluator.evaluate(
        xpath,
        evaluator,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      let idx = 0;
      for (let i = 0; i < xpathResult.snapshotLength; i++) {
        if (xpathResult.snapshotItem(i) === el) {
          idx = i;
          break;
        }
      }

      return { xpath, index: idx };
    }

    // Helper to get the index of a frame element among its sibling frames
    function getFrameElementIndex(frameElement) {
      if (!frameElement) return null;
      const parent = frameElement.parentNode;
      if (!parent) return null;
      const tagName = frameElement.tagName;
      let index = 0;
      for (let i = 0; i < parent.children.length; i++) {
        if (parent.children[i].tagName === tagName) {
          index++;
          if (parent.children[i] === frameElement) {
            return index - 1; // 0-based index for Playwright
          }
        }
      }
      return null;
    }

    function getFrameChain(win) {
      let chain = [];
      let frameIndexes = [];
      let currentWindow = win;
      while (currentWindow !== window.top) {
        const parentWindow = currentWindow.parent;
        let found = false;
        for (let i = 0; i < parentWindow.frames.length; i++) {
          if (parentWindow.frames[i] === currentWindow) {
            const frameElements = parentWindow.document.querySelectorAll('iframe, frame');
            const frameElement = frameElements[i];
            let frameInfo = {};
            if (frameElement) {
              if (frameElement.id) {
                frameInfo.locator = `//*[@id="${frameElement.id}"]`;
              } else if (frameElement.name) {
                frameInfo.locator = `//*[@name="${frameElement.name}"]`;
              } else {
                frameInfo.locator = getXPathAndIndex(frameElement).xpath;
              }
              frameInfo.index = getFrameElementIndex(frameElement);
            } else {
              frameInfo.locator = null;
              frameInfo.index = null;
            }
            chain.unshift(frameInfo.locator || '');
            frameIndexes.unshift(frameInfo.index);
            found = true;
            break;
          }
        }
        if (!found) break;
        currentWindow = parentWindow;
      }
      return { chain: chain.join('||'), frameIndexes };
    }

    const { xpath, index } = getXPathAndIndex(element);
    const framePathInfo = getFrameChain(window);

    return { xpath, xpathIndex: index, iFrame: framePathInfo.chain, frameIndexes: framePathInfo.frameIndexes };
  }

  function sendAction(action) {
    chrome.runtime.sendMessage({ type: 'record-action', action });
  }

  function onClick(e) {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

    const { xpath, xpathIndex, iFrame, frameIndexes } = getXPathWithFrames(e.target);
    let actionType = 'click';
    const elementName = e.target.name || e.target.id || e.target.className || '';
    if (e.target.tagName.toLowerCase() === 'button') {
      actionType = 'button';
    }
    const action = {
      type: actionType,
      xpath: xpath,
      xpathIndex: xpathIndex,
      iFrame: iFrame,
      frameIndexes: frameIndexes,
      name: elementName,
      timestamp: Date.now()
    };
    sendAction(action);
  }

  const inputTimers = new Map();
  const inputValues = new Map();

  function sendInputAction(el, xpath, xpathIndex, iFrame, frameIndexes) {
    const value = inputValues.get(el) || '';
    const elementName = el.name || el.id || el.className || '';
    const action = {
      type: 'input',
      xpath: xpath,
      xpathIndex: xpathIndex,
      iFrame: iFrame,
      frameIndexes: frameIndexes,
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

    const { xpath, xpathIndex, iFrame, frameIndexes } = getXPathWithFrames(el);
    inputValues.set(el, el.value || el.textContent || '');
    el._lastXpath = xpath;
    el._lastXpathIndex = xpathIndex;
    el._lastIFrame = iFrame;
    el._lastFrameIndexes = frameIndexes;
  }

  function onBlur(e) {
    const el = e.target;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !el.isContentEditable) return;

    const xpath = el._lastXpath;
    const xpathIndex = el._lastXpathIndex;
    const iFrame = el._lastIFrame;
    const frameIndexes = el._lastFrameIndexes;
    if (!xpath) return;

    if (inputTimers.has(el)) {
      clearTimeout(inputTimers.get(el));
      sendInputAction(el, xpath, xpathIndex, iFrame, frameIndexes);
    } else if (inputValues.has(el)) {
      sendInputAction(el, xpath, xpathIndex, iFrame, frameIndexes);
    }
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('blur', onBlur, true);
})();
