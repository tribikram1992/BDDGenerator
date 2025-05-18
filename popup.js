const urlInput = document.getElementById('url-input');
const loadUrlButton = document.getElementById('load-url-button');
const actionsListEl = document.getElementById('actionsList');
const clearBtn = document.getElementById('clearBtn');
const generateBtn = document.getElementById('generateBtn');
const codeOutput = document.getElementById('codeOutput');
const scenarioInput = document.getElementById('scenarioNameInput');
const scenarioBtn = document.getElementById('scenarioNameBtn');

let currentData = null;

// --- State/Session Management ---
function generateSessionId() {
  return Date.now().toString() + "_" + Math.random().toString(36).slice(2, 10);
}

function saveState() {
  chrome.storage.local.set({ bddgen_actions: currentData });
}

function renderActions(actions) {
  actionsListEl.innerHTML = '';
  if (!actions.length) {
    const li = document.createElement('li');
    li.textContent = '(No actions recorded)';
    actionsListEl.appendChild(li);
    clearBtn.disabled = true;
    generateBtn.disabled = true;
    document.getElementById('genBddBtn').disabled = true;
    codeOutput.style.display = 'none';
    return;
  }
  actions.forEach((action, i) => {
    const li = document.createElement('li');
    const header = document.createElement('div');
    header.className = "action-header";
    header.innerHTML = `<span class="elType">${action.elementType}</span> <span>${action.type.toUpperCase()}</span>`;
    li.appendChild(header);

    if (action.windowNumber) {
      const winDiv = document.createElement('div');
      winDiv.style.fontSize = "0.88em";
      winDiv.style.color = "#7a3";
      winDiv.textContent = `Window: ${action.windowNumber}`;
      li.appendChild(winDiv);
    }
    if (action.frame) {
      const frameDiv = document.createElement('div');
      frameDiv.style.fontSize = "0.88em";
      frameDiv.style.color = "#39a";
      frameDiv.textContent = `Frame: ${action.frame}`;
      li.appendChild(frameDiv);
    }

    const locRow = document.createElement('div');
    locRow.className = "locator-row";
    let nonJsLocators = action.allLocators ? action.allLocators.filter(l => l.type !== "jsPath") : [];
    let jsPath = action.allLocators ? action.allLocators.find(l => l.type === "jsPath") : null;
    let defaultIdx = nonJsLocators.findIndex(l => l.type === action.locatorType);
    if (defaultIdx === -1) defaultIdx = 0;

    if (nonJsLocators.length > 0) {
      const dropdown = document.createElement('select');
      dropdown.className = "locator-dropdown";
      nonJsLocators.forEach((loc, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `[${loc.type}]`;
        if (loc.type === action.locatorType && loc.value === action.locator) opt.selected = true;
        dropdown.appendChild(opt);
      });
      dropdown.selectedIndex = defaultIdx;
      locRow.appendChild(dropdown);

      const input = document.createElement('input');
      input.className = "locator-input";
      input.type = "text";
      input.value = nonJsLocators[dropdown.selectedIndex]?.value || "";
      locRow.appendChild(input);

      dropdown.onchange = () => {
        const idx = dropdown.selectedIndex;
        input.value = nonJsLocators[idx].value;
        action.locator = nonJsLocators[idx].value;
        action.locatorType = nonJsLocators[idx].type;
        currentData.actions[i].locator = action.locator;
        currentData.actions[i].locatorType = action.locatorType;
        saveState();
      };
      input.oninput = () => {
        action.locator = input.value;
        currentData.actions[i].locator = input.value;
        saveState();
      };
    }

    li.appendChild(locRow);

    if (jsPath) {
      const jsDiv = document.createElement('div');
      jsDiv.style.fontSize = "0.85em";
      jsDiv.style.color = "#777";
      jsDiv.style.overflowWrap = "anywhere";
      jsDiv.textContent = `JS Path: ${jsPath.value}`;
      li.appendChild(jsDiv);
    }

    if (action.value) {
      const v = document.createElement('div');
      v.style.color = "#007b63";
      v.style.fontSize = "0.98em";
      v.style.marginTop = "3px";
      v.textContent = `Value: "${action.value}"`;
      li.appendChild(v);
    }
    if (action.iFrame) {
      const v = document.createElement('div');
      v.style.color = "#8a2997";
      v.style.fontSize = "0.94em";
      v.textContent = `iFrame: ${action.iFrame}`;
      li.appendChild(v);
    }
    actionsListEl.appendChild(li);
  });
  clearBtn.disabled = false;
  // Enable buttons only if scenario name is present
  const scenarioFilled = !!(currentData && currentData.scenarioName && currentData.scenarioName.trim());
  generateBtn.disabled = !scenarioFilled;
  document.getElementById('genBddBtn').disabled = !scenarioFilled;
  codeOutput.style.display = 'none';
}

function loadActions() {
  chrome.storage.local.get(['bddgen_actions'], (result) => {
    let data = result && result.bddgen_actions ? result.bddgen_actions : { url: '', actions: [], scenarioName: '' };
    currentData = data;
    renderActions(data.actions || []);
    urlInput.value = data.url || '';
    scenarioInput.value = data.scenarioName || '';
    scenarioBtn.disabled = false;
    generateBtn.disabled = !data.scenarioName;
    document.getElementById('genBddBtn').disabled = !data.scenarioName;
  });
}

window.onload = function() {
  loadActions();
  if (!document.getElementById('genBddBtn')) {
    const genBtn = document.createElement('button');
    genBtn.id = 'genBddBtn';
    genBtn.textContent = 'Generate Feature/Step';
    genBtn.style.marginTop = '8px';
    genBtn.disabled = true;
    genBtn.onclick = generateFeatureAndStepFiles;
    document.getElementById('buttons').appendChild(genBtn);
  }
};

scenarioInput.addEventListener('input', () => {
  // If scenario name entered, enable buttons
  const value = scenarioInput.value.trim();
  const enable = !!value;
  generateBtn.disabled = !enable;
  document.getElementById('genBddBtn').disabled = !enable;
});

scenarioBtn.addEventListener('click', () => {
  const name = scenarioInput.value.trim();
  if (!name) {
    alert('Please enter a scenario name!');
    return;
  }
  chrome.runtime.sendMessage({ type: 'set-scenario-name', name });
  if (!currentData) currentData = { url: '', actions: [], scenarioName: '' };
  currentData.scenarioName = name;
  saveState();
  alert('Scenario name set to: ' + name);
  generateBtn.disabled = false;
  document.getElementById('genBddBtn').disabled = false;
});

loadUrlButton.addEventListener('click', () => {
  let url = urlInput.value.trim();
  if (!url) {
    alert('Please enter a URL to load');
    return;
  }
  // Add https if missing
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  const sessionId = generateSessionId();
  chrome.storage.local.set({ activeSessionId: sessionId }, () => {
    chrome.windows.create({ url: url, focused: true, type: "normal" }, function(win) {
      chrome.storage.local.set({ ["sessionWindow_" + sessionId]: win.id });
    });
    chrome.runtime.sendMessage({ type: 'set-url', url: url });
    currentData = { url: url, actions: [], scenarioName: '' };
    renderActions([]);
    codeOutput.style.display = 'none';
    saveState();
    // After loading, scenario name must be re-entered
    scenarioInput.value = '';
    currentData.scenarioName = '';
    generateBtn.disabled = true;
    document.getElementById('genBddBtn').disabled = true;
  });
});

clearBtn.addEventListener('click', () => {
  if (confirm('Clear all recorded data?')) {
    chrome.storage.local.remove('activeSessionId', () => {
      chrome.runtime.sendMessage({ type: 'clear-actions' });
      currentData = { url: '', actions: [], scenarioName: '' };
      renderActions([]);
      urlInput.value = '';
      codeOutput.style.display = 'none';
      scenarioInput.value = '';
      saveState();
      generateBtn.disabled = true;
      document.getElementById('genBddBtn').disabled = true;
    });
  }
});

function getTimestamp() {
  const now = new Date();
  return (
    String(now.getDate()).padStart(2, '0') +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getFullYear()) +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')
  );
}

function toStepText(action, mapping) {
  const suggested = action.suggestedName || action.elementType || action.type || "step";
  const actualValue = mapping && mapping[suggested] && mapping[suggested].actualValue
    ? mapping[suggested].actualValue
    : "<actualValue>";
  if (action.elementType === "link" || action.elementType === "button" || action.elementType === "radioButton" || action.elementType === "checkBox") {
    return `When I clicked on the ${action.elementType} "${suggested}"`;
  } else if (action.elementType === "dropdown") {
    return `When I selected "${actualValue}" from dropdown "${suggested}"`;
  } else if (action.elementType === "input") {
    return `When I entered ${actualValue} into the input "${suggested}"`;
  } else if (action.elementType === "textArea") {
    return `When I entered "${actualValue}" into the textArea "${suggested}"`;
  } else if (action.elementType === "alert") {
    return `When I clicked on ${actualValue} of the Alert "${suggested}"`;
  }
  return `When I interacted with the ${action.elementType} "${suggested}"`;
}

function toJavaStepDef(action, idx) {
  let annotation = "", methodName = "", methodBody = "";
  const sn = action.suggestedName;
  if (action.elementType === "link" || action.elementType === "button" || action.elementType === "radioButton" || action.elementType === "checkBox") {
    annotation = `@When("^I clicked on the ${action.elementType} \\"${sn}\\"$\")`;
    methodName = `public void click${capitalize(action.elementType)}${capitalize(sn)}()`;
    methodBody = `    // TODO: click using objectRepository.get("${sn}")\n`;
  } else if (action.elementType === "dropdown") {
    annotation = `@When("^I selected \\"([^\\"]*)\\" from dropdown \\"${sn}\\"$\")`;
    methodName = `public void select${capitalize(action.elementType)}${capitalize(sn)}(String value)`;
    methodBody = `    // TODO: select value from dropdown using objectRepository.get("${sn}")\n`;
  } else if (action.elementType === "input") {
    annotation = `@When("^I entered ([^\\s]+) into the input \\"${sn}\\"$\")`;
    methodName = `public void enter${capitalize(action.elementType)}${capitalize(sn)}(String value)`;
    methodBody = `    // TODO: input value using objectRepository.get("${sn}")\n`;
  } else if (action.elementType === "textArea") {
    annotation = `@When("^I entered \\"([^\\"]*)\\" into the textArea \\"${sn}\\"$\")`;
    methodName = `public void enter${capitalize(action.elementType)}${capitalize(sn)}(String value)`;
    methodBody = `    // TODO: input value into text area using objectRepository.get("${sn}")\n`;
  } else if (action.elementType === "alert") {
    annotation = `@When("^I clicked on ([^\\s]+) of the Alert \\"${sn}\\"$\")`;
    methodName = `public void alertClick${capitalize(sn)}(String value)`;
    methodBody = `    // TODO: handle alert click for "${sn}"\n`;
  } else {
    annotation = `@When("^I interacted with the ${action.elementType} \\"${sn}\\"$\")`;
    methodName = `public void interact${capitalize(action.elementType)}${capitalize(sn)}()`;
    methodBody = `    // TODO: implement for objectRepository.get("${sn}")\n`;
  }
  return `    ${annotation}\n    ${methodName} {\n${methodBody}    }\n`;
}
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

generateBtn.addEventListener('click', () => {
  if (!currentData || !currentData.actions || currentData.actions.length === 0) {
    alert('No recorded actions to generate JSON.');
    return;
  }
  downloadJSON(currentData);
});

async function generateFeatureAndStepFiles() {
  if (!currentData || !currentData.actions || currentData.actions.length === 0) {
    alert('No actions to export.');
    return;
  }
  if (!currentData.scenarioName || !currentData.scenarioName.trim()) {
    alert('Please enter a scenario name before generating files.');
    return;
  }
  let baseName = prompt("Enter the base name for the feature (e.g. Sample):");
  if (!baseName) {
    alert("Name is required.");
    return;
  }
  baseName = baseName.replace(/\W/g, "");
  const ts = getTimestamp();

  const featureFileName = `${baseName}Feature${ts}.feature`;
  const stepDefFileName = `${baseName}StepDefinition${ts}.java`;
  const objectRepoFileName = `${baseName}ObjectRepository${ts}.json`;
  const mappingFileName = `${baseName}DataMapping${ts}.json`;
  const actionsFileName = `recordedActions${ts}.json`;
  const featureName = `${baseName}Feature${ts}`;
  const stepClassName = `${baseName}StepDefinition${ts}`;
  const scenarioName = currentData.scenarioName || "Recorded Scenario";

  const mapping = {};
  currentData.actions.forEach((a, i) => {
    mapping[a.suggestedName] = {
      actualValue: a.value,
      expectedValue: a.options || []
    };
  });

  const steps = currentData.actions.map(a => toStepText(a, mapping));
  const featureContent =
`Feature: ${featureName}

  Scenario: ${scenarioName}
${steps.map(s => "    " + s).join('\n')}
`;

  const stepDefs =
`import io.cucumber.java.en.*;
import org.junit.Assert;
import java.util.Map;

public class ${stepClassName} {
    private Map<String, Object> objectRepository;
    public ${stepClassName}() {
        // TODO: load object repository
    }
${currentData.actions.map((a, i) => toJavaStepDef(a, i)).join('\n')}
}
`;

  const objectRepo = {};
  currentData.actions.forEach((a, i) => {
    let locatorObj = {};
    let l = a.allLocators ? a.allLocators.find(x => x.type === a.locatorType && (x.type === "xpath" || x.type === "css")) : null;
    if (!l) l = a.allLocators ? a.allLocators.find(x => x.type === "xpath" || x.type === "css") : null;
    locatorObj.locator = l ? l.value : a.locator;
    locatorObj.locatorType = l ? l.type : a.locatorType;
    locatorObj.elementType = a.elementType;
    locatorObj.windowNumber = a.windowNumber;
    locatorObj.frame = a.frame;
    locatorObj.suggestedName = a.suggestedName;
    locatorObj.target = a.target;
    objectRepo[a.suggestedName] = locatorObj;
  });

  downloadFile(featureFileName, featureContent);
  downloadFile(stepDefFileName, stepDefs);
  downloadFile(objectRepoFileName, JSON.stringify(objectRepo, null, 2));
  downloadFile(mappingFileName, JSON.stringify(mapping, null, 2));
  downloadFile(actionsFileName, JSON.stringify(currentData, null, 2));

  alert(`Files generated:\n${featureFileName}\n${stepDefFileName}\n${objectRepoFileName}\n${mappingFileName}\n${actionsFileName}`);
}

function downloadJSON(data) {
  let exportData = Object.assign({}, data);
  exportData.actions = (data.actions || []).map(action => ({
    type: action.type,
    locator: action.locator,
    locatorType: action.locatorType,
    elementType: action.elementType,
    suggestedName: action.suggestedName,
    value: action.value,
    windowNumber: action.windowNumber,
    frame: action.frame,
    iFrame: action.iFrame
  }));
  const jsonStr = JSON.stringify(exportData, null, 2);
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

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}