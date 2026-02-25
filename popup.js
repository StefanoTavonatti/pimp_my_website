const STORAGE_KEY = 'scripts';

async function getScripts() {
  const { [STORAGE_KEY]: scripts = [] } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(scripts) ? scripts : [];
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function getHostname(url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isScriptDisabledOnSite(script, hostname) {
  if (!hostname) return false;
  const disabled = script.disabledSites || [];
  return disabled.some((h) => hostname === h || hostname.endsWith('.' + h));
}

function matchesSummary(script) {
  const m = script.matches || [];
  if (m.length === 0) return 'No URLs';
  if (m.length === 1) return m[0];
  return m[0] + ` (+${m.length - 1})`;
}

async function checkUserScriptsAvailable() {
  try {
    await chrome.userScripts.getScripts();
    return true;
  } catch {
    return false;
  }
}

function renderScriptItem(script, currentHostname) {
  const li = document.createElement('li');
  li.className = 'script-item' + (script.enabled === false ? ' disabled' : '');
  li.dataset.id = script.id;

  const info = document.createElement('div');
  info.className = 'script-info';
  info.innerHTML = `
    <div class="script-name">${escapeHtml(script.name || 'Unnamed')}</div>
    <div class="script-matches">${escapeHtml(matchesSummary(script))}</div>
  `;

  const disabledOnSite = isScriptDisabledOnSite(script, currentHostname);
  const toggleLabel = currentHostname
    ? (disabledOnSite ? 'Enable on this site' : 'Disable on this site')
    : '—';

  const actions = document.createElement('div');
  actions.className = 'script-actions';
  actions.innerHTML = `
    <button type="button" class="toggle-site" data-id="${escapeHtml(script.id)}" data-action="toggle-site" ${!currentHostname ? 'disabled' : ''}>${escapeHtml(toggleLabel)}</button>
    <button type="button" data-id="${escapeHtml(script.id)}" data-action="edit">Edit</button>
    <button type="button" class="danger" data-id="${escapeHtml(script.id)}" data-action="delete">Delete</button>
  `;

  li.appendChild(info);
  li.appendChild(actions);
  return li;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function renderList() {
  const listEl = document.getElementById('script-list');
  const scripts = await getScripts();
  const tab = await getCurrentTab();
  const hostname = tab ? getHostname(tab.url) : null;

  listEl.innerHTML = '';
  for (const script of scripts) {
    listEl.appendChild(renderScriptItem(script, hostname));
  }

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id][data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'toggle-site') toggleScriptOnSite(id);
    else if (action === 'edit') openOptions(id);
    else if (action === 'delete') deleteScript(id);
  });
}

async function toggleScriptOnSite(scriptId) {
  const tab = await getCurrentTab();
  const hostname = tab ? getHostname(tab.url) : null;
  if (!hostname) return;

  const scripts = await getScripts();
  const script = scripts.find((s) => s.id === scriptId);
  if (!script) return;

  const disabled = script.disabledSites || [];
  const isDisabled = disabled.includes(hostname);
  const next = isDisabled ? disabled.filter((h) => h !== hostname) : [...disabled, hostname];
  await chrome.storage.local.set({
    [STORAGE_KEY]: scripts.map((s) =>
      s.id === scriptId ? { ...s, disabledSites: next } : s
    ),
  });
  await renderList();
  chrome.runtime.sendMessage({ type: 'REGISTER_SCRIPTS' });
}

function openOptions(scriptId) {
  const path = scriptId ? `options.html?id=${encodeURIComponent(scriptId)}` : 'options.html';
  const url = chrome.runtime.getURL(path);
  chrome.tabs.create({ url });
  window.close();
}

async function deleteScript(scriptId) {
  if (!confirm('Delete this script?')) return;
  const scripts = await getScripts();
  const next = scripts.filter((s) => s.id !== scriptId);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  await renderList();
  chrome.runtime.sendMessage({ type: 'REGISTER_SCRIPTS' });
}

document.getElementById('add-script').addEventListener('click', () => openOptions());
document.getElementById('options-btn').addEventListener('click', () => openOptions());

document.getElementById('extensions-link').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/' });
});

(async () => {
  const ok = await checkUserScriptsAvailable();
  document.getElementById('user-scripts-warning').hidden = ok;
  await renderList();
})();
