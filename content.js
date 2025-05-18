(function() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      var oldAlert = window.alert;
      window.alert = function(msg) {
        window.postMessage({ type: "BDDGEN_ALERT", mode: "alert", value: msg }, "*");
        return oldAlert.apply(window, arguments);
      };
      var oldConfirm = window.confirm;
      window.confirm = function(msg) {
        var res = oldConfirm.apply(window, arguments);
        window.postMessage({ type: "BDDGEN_ALERT", mode: "confirm", value: msg, result: res }, "*");
        return res;
      };
      var oldPrompt = window.prompt;
      window.prompt = function(msg, defaultTxt) {
        var res = oldPrompt.apply(window, arguments);
        window.postMessage({ type: "BDDGEN_ALERT", mode: "prompt", value: msg, result: res }, "*");
        return res;
      };
    })();
  `;
  document.documentElement.appendChild(script);
})();

window.addEventListener("message", function(event) {
  if (event.data && event.data.type === "BDDGEN_ALERT") {
    sendActionToBackground({
      type: event.data.mode,
      locator: "",
      locatorType: "alert",
      elementType: "alert",
      suggestedName: "alert_" + (event.data.value || "Alert"),
      allLocators: [],
      alertText: event.data.value,
      alertResult: typeof event.data.result !== "undefined" ? event.data.result : null,
      windowNumber: window.name || '',
      frame: getFramePath(),
      value: typeof event.data.result !== "undefined" ? event.data.result : null,
      target: "",
      options: [],
      time: Date.now()
    });
  }
});

function isActionable(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (["button", "a", "input", "select", "textarea", "label", "option"].includes(tag)) return true;
  if (el.type && ["button", "checkbox", "radio", "submit", "reset", "date"].includes(el.type)) return true;
  if (el.type && /date|time/.test(el.type)) return true;
  return false;
}

function isDynamicValue(val) {
  if (!val) return false;
  if (typeof val !== "string") return false;
  if (/^\d{5,}$/.test(val)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return true;
  if (/(ember|react|ng-|auto_|auto-|generated|random|tmp|temp|test|item|row|col|cell)[\-_]?\d+/i.test(val)) return true;
  if (/^[a-f0-9]{8,}$/.test(val) && !/^[a-z]+$/.test(val)) return true;
  if (val.length > 18) return true;
  return false;
}

function getRelativeXPath(el) {
  if (el.id && !isDynamicValue(el.id)) return `.//*[@id='${el.id}']`;
  if (el.name && !isDynamicValue(el.name)) return `.//*[@name='${el.name}']`;
  if (el.textContent && el.textContent.trim().length > 2) {
    let text = el.textContent.trim();
    let found = document.evaluate(`.//*[normalize-space(text())='${text}']`, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (found.snapshotLength === 1 && found.snapshotItem(0) === el) {
      return `.//*[normalize-space(text())='${text}']`;
    }
  }
  if (el.classList && el.classList.length) {
    let className = el.classList[0];
    let found = document.getElementsByClassName(className);
    if (found.length === 1 && found[0] === el) {
      return `.//*[contains(@class, '${className}')]`;
    }
  }
  let path = [];
  while (el && el.nodeType === 1 && el !== document.body) {
    let index = 1, sib = el.previousElementSibling;
    while (sib) {
      if (sib.nodeName === el.nodeName) index++;
      sib = sib.previousElementSibling;
    }
    path.unshift(el.nodeName.toLowerCase() + (index > 1 ? `[${index}]` : ''));
    el = el.parentElement;
  }
  return `.//${path.join('/')}`;
}

function getElementType(element) {
  const tag = element.tagName ? element.tagName.toLowerCase() : '';
  if (["table", "tr", "td", "th", "tbody", "thead", "tfoot"].includes(tag)) return "table";
  if (tag === 'select') return 'dropdown';
  if (tag === 'input') {
    const type = element.getAttribute('type');
    if (type === 'checkbox') return 'checkBox';
    if (type === 'radio') return 'radioButton';
    if (type === 'password') return 'password';
    if (type === 'file') return 'file';
    if (type === 'submit') return 'button';
    if (type === 'button') return 'button';
    return 'input';
  }
  if (tag === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'textarea') return 'textArea';
  return tag;
}

function getSuggestedName(element) {
  let type = getElementType(element);
  let label = element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('name') || element.id || element.textContent || "";
  label = label.replace(/\s+/g, '_').replace(/[^\w]/g, '').slice(0, 20) || 'elem';
  return `${type}_${label}`;
}

function getDropdownOptions(element) {
  if (element.tagName && element.tagName.toLowerCase() === "select") {
    return Array.from(element.options).map(o => o.value || o.textContent);
  }
  return [];
}

function getUniqueLocators(element) {
  const locs = [];
  if (element.id && !isDynamicValue(element.id)) {
    locs.push({ type: 'id', value: `.//*[@id='${element.id}']` });
  }
  if (element.name && !isDynamicValue(element.name)) {
    locs.push({ type: 'name', value: `.//*[@name='${element.name}']` });
  }
  if (element.tagName && element.tagName.toLowerCase() === 'a' && element.textContent) {
    const anchors = Array.from(document.getElementsByTagName("a")).filter(a => a.textContent.trim() === element.textContent.trim());
    if (anchors.length === 1 && anchors[0] === element) {
      locs.push({ type: 'linkText', value: element.textContent.trim() });
    }
  }
  const xpath = getRelativeXPath(element);
  if (xpath) {
    let res = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (res.snapshotLength === 1 && res.snapshotItem(0) === element && !locs.some(l=>l.value===xpath)) {
      locs.push({ type: 'xpath', value: xpath });
    }
  }
  if (element.className) {
    let sel = element.tagName.toLowerCase() + '.' + element.className.trim().split(/\s+/).join('.');
    try {
      let found = document.querySelectorAll(sel);
      if (found.length === 1 && found[0] === element) {
        locs.push({ type: 'css', value: sel });
      }
    } catch {}
  }
  if (element.className && typeof element.className === 'string') {
    const className = element.className.trim().split(/\s+/)[0];
    if (className) {
      const found = document.getElementsByClassName(className);
      if (found.length === 1 && found[0] === element) {
        locs.push({ type: 'className', value: className });
      }
    }
  }
  if (element.tagName) {
    const found = document.getElementsByTagName(element.tagName.toLowerCase());
    if (found.length === 1 && found[0] === element) {
      locs.push({ type: 'tagName', value: element.tagName.toLowerCase() });
    }
  }
  locs.push({ type: 'jsPath', value: getJsPathString(element) });
  return locs;
}

function getJsPath(element) {
  if (element === document.body)
    return ['body'];
  let ix = 0;
  const siblings = element.parentNode ? element.parentNode.childNodes : [];
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element)
      return getJsPath(element.parentNode).concat([`${element.tagName.toLowerCase()}[${ix}]`]);
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName)
      ix++;
  }
  return [];
}
function getJsPathString(element) {
  return getJsPath(element).join(' > ');
}

function getFramePath() {
  try {
    let path = [];
    let win = window;
    while (win.self !== win.top) {
      let frame = win.frameElement;
      if (!frame) break;
      path.unshift(getRelativeXPath(frame));
      win = win.parent;
    }
    return path.join('||');
  } catch { return ''; }
}

function getTargetElement(e) {
  let el = e.target;
  if (el.tagName && el.tagName.toLowerCase() === "option" && el.parentElement && el.parentElement.tagName.toLowerCase() === "select") {
    el = el.parentElement;
  }
  return el;
}

function sendActionToBackground(action) {
  chrome.storage.local.get('activeSessionId', (result) => {
    if (result && result.activeSessionId) {
      chrome.runtime.sendMessage({
        type: 'record-action',
        action: action,
        sessionId: result.activeSessionId
      });
    }
  });
}

document.addEventListener('click', function (e) {
  const el = getTargetElement(e);
  if (!isActionable(el)) return;
  recordAction('click', el, undefined, undefined);
}, true);

document.addEventListener('change', function(e) {
  const el = getTargetElement(e);
  if (!isActionable(el)) return;
  let value = el.value;
  if (el.type && /date|time/.test(el.type)) {
    value = el.value;
  }
  recordAction('input', el, value, undefined);
}, true);

function recordAction(type, element, value, iFrame) {
  const locators = getUniqueLocators(element);
  const priority = ["id","name","linkText","xpath","css","className","tagName"];
  let defaultIdx = locators.findIndex(l => priority.includes(l.type));
  if (defaultIdx === -1) defaultIdx = 0;
  let framePath = getFramePath();
  let options = getDropdownOptions(element);
  let target = '';
  try { target = element.outerHTML; } catch { target = ''; }
  const action = {
    type,
    locator: locators[defaultIdx]?.value || "",
    locatorType: locators[defaultIdx]?.type || "",
    elementType: getElementType(element),
    suggestedName: getSuggestedName(element),
    allLocators: locators,
    windowNumber: window.name || '',
    frame: framePath,
    value,
    iFrame,
    target,
    options,
    time: Date.now()
  };
  sendActionToBackground(action);
}