const STORAGE_KEY = 'scripts';
const GROUPS_KEY = 'groups';

async function getScripts() {
  const { [STORAGE_KEY]: scripts = [] } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(scripts) ? scripts : [];
}

async function getGroups() {
  const { [GROUPS_KEY]: groups = [] } = await chrome.storage.local.get(GROUPS_KEY);
  return Array.isArray(groups) ? groups : [];
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

function isDisabledOnSite(item, hostname) {
  if (!hostname) return false;
  const disabled = item.disabledSites || [];
  return disabled.some((h) => hostname === h || hostname.endsWith('.' + h));
}

function matchesSummary(item) {
  const m = item.matches || [];
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

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderGroupItem(group, scripts, hostname) {
  const memberCount = scripts.filter((s) => s.groupId === group.id).length;
  const li = document.createElement('li');
  li.className = 'script-item' + (group.enabled === false ? ' disabled' : '');
  li.dataset.id = group.id;

  const disabledOnSite = isDisabledOnSite(group, hostname);
  const toggleLabel = hostname
    ? (disabledOnSite ? 'Enable on this site' : 'Disable on this site')
    : '—';

  const info = document.createElement('div');
  info.className = 'script-info';
  info.innerHTML = `
    <div class="script-name">${escapeHtml(group.name || 'Unnamed group')} <span style="font-size:0.8em;opacity:0.7">(group, ${memberCount} script${memberCount !== 1 ? 's' : ''})</span></div>
    <div class="script-matches">${escapeHtml(matchesSummary(group))}</div>
  `;

  const actions = document.createElement('div');
  actions.className = 'script-actions';
  actions.innerHTML = `
    <button type="button" class="toggle-site" data-id="${escapeHtml(group.id)}" data-action="toggle-group-site" ${!hostname ? 'disabled' : ''}>${escapeHtml(toggleLabel)}</button>
    <button type="button" data-id="${escapeHtml(group.id)}" data-action="edit-group">Edit</button>
  `;

  li.appendChild(info);
  li.appendChild(actions);
  return li;
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

  const disabledOnSite = isDisabledOnSite(script, currentHostname);
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

async function renderList() {
  const listEl = document.getElementById('script-list');
  const [scripts, groups] = await Promise.all([getScripts(), getGroups()]);
  const tab = await getCurrentTab();
  const hostname = tab ? getHostname(tab.url) : null;

  listEl.innerHTML = '';

  // Render groups first
  for (const group of groups) {
    listEl.appendChild(renderGroupItem(group, scripts, hostname));
  }

  // Render only ungrouped scripts
  const standaloneScripts = scripts.filter((s) => !s.groupId);
  for (const script of standaloneScripts) {
    listEl.appendChild(renderScriptItem(script, hostname));
  }

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id][data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'toggle-site') toggleScriptOnSite(id);
    else if (action === 'toggle-group-site') toggleGroupOnSite(id);
    else if (action === 'edit') openOptions(id);
    else if (action === 'edit-group') openOptionsForGroup(id);
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

async function toggleGroupOnSite(groupId) {
  const tab = await getCurrentTab();
  const hostname = tab ? getHostname(tab.url) : null;
  if (!hostname) return;

  const groups = await getGroups();
  const group = groups.find((g) => g.id === groupId);
  if (!group) return;

  const disabled = group.disabledSites || [];
  const isDisabled = disabled.includes(hostname);
  const next = isDisabled ? disabled.filter((h) => h !== hostname) : [...disabled, hostname];
  await chrome.storage.local.set({
    [GROUPS_KEY]: groups.map((g) =>
      g.id === groupId ? { ...g, disabledSites: next } : g
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

function openOptionsForGroup(_groupId) {
  // Open options page (group management is in the group-section)
  const url = chrome.runtime.getURL('options.html');
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
