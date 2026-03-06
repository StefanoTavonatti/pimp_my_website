const STORAGE_KEY = 'scripts';
const GROUPS_KEY = 'groups';

function parseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function getScripts() {
  const { [STORAGE_KEY]: scripts = [] } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(scripts) ? scripts : [];
}

async function getGroups() {
  const { [GROUPS_KEY]: groups = [] } = await chrome.storage.local.get(GROUPS_KEY);
  return Array.isArray(groups) ? groups : [];
}

async function getScriptById(id) {
  const scripts = await getScripts();
  return scripts.find((s) => s.id === id) || null;
}

function matchesToText(matches) {
  return Array.isArray(matches) ? (matches.join('\n') || '') : '';
}

function textToMatches(text) {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ── Script form elements ──────────────────────────────────────────────────────

const form = document.getElementById('script-form');
const scriptIdEl = document.getElementById('script-id');
const scriptGroupIdEl = document.getElementById('script-group-id');
const nameEl = document.getElementById('script-name');
const matchesEl = document.getElementById('script-matches');
const codeEl = document.getElementById('script-code');
const enabledEl = document.getElementById('script-enabled');
const groupSelectEl = document.getElementById('script-group');
const scriptListEl = document.getElementById('script-list');
const scriptListSection = document.getElementById('script-list-section');

// ── Group form elements ───────────────────────────────────────────────────────

const groupForm = document.getElementById('group-form');
const groupIdEl = document.getElementById('group-id');
const groupNameEl = document.getElementById('group-name');
const groupMatchesEl = document.getElementById('group-matches');
const groupEnabledEl = document.getElementById('group-enabled');
const groupListEl = document.getElementById('group-list');

// ── Navigation ────────────────────────────────────────────────────────────────

document.getElementById('back-link').addEventListener('click', (e) => {
  e.preventDefault();
  const url = chrome.runtime.getURL('popup.html');
  chrome.tabs.create({ url });
  window.close();
});

// ── Script form ───────────────────────────────────────────────────────────────

function resetScriptForm() {
  scriptIdEl.value = '';
  scriptGroupIdEl.value = '';
  form.reset();
  scriptIdEl.value = '';
  nameEl.value = '';
  matchesEl.value = '';
  codeEl.value = '';
  enabledEl.checked = true;
  groupSelectEl.value = '';
}

document.getElementById('cancel-btn').addEventListener('click', () => {
  resetScriptForm();
  renderScriptList();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = scriptIdEl.value || crypto.randomUUID();
  const name = nameEl.value.trim();
  const matches = textToMatches(matchesEl.value);
  const code = codeEl.value;
  const enabled = enabledEl.checked;
  const groupId = groupSelectEl.value || null;

  const scripts = await getScripts();
  const existing = scripts.find((s) => s.id === id);
  const now = new Date().toISOString();
  const script = {
    id,
    name: name || 'Unnamed',
    code,
    matches: matches.length > 0 ? matches : ['<all_urls>'],
    disabledSites: existing ? (existing.disabledSites || []) : [],
    enabled,
    groupId: groupId || null,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  const next = existing
    ? scripts.map((s) => (s.id === id ? script : s))
    : [...scripts, script];
  await chrome.storage.local.set({ [STORAGE_KEY]: next });

  chrome.runtime.sendMessage({ type: 'REGISTER_SCRIPTS' });

  resetScriptForm();
  renderScriptList();
});

async function populateGroupDropdown(selectedGroupId) {
  const groups = await getGroups();
  // Remove all options except the first "— None —"
  while (groupSelectEl.options.length > 1) {
    groupSelectEl.remove(1);
  }
  for (const g of groups) {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name || 'Unnamed group';
    groupSelectEl.appendChild(opt);
  }
  groupSelectEl.value = selectedGroupId || '';
}

function renderScriptList() {
  Promise.all([getScripts(), getGroups()]).then(([scripts, groups]) => {
    if (scripts.length === 0) {
      scriptListSection.style.display = 'none';
      return;
    }
    scriptListSection.style.display = 'block';
    const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.name]));
    scriptListEl.innerHTML = scripts
      .map((s) => {
        const groupLabel = s.groupId && groupMap[s.groupId]
          ? `<span class="hint"> (group: ${escapeHtml(groupMap[s.groupId])})</span>`
          : '';
        return `
        <li>
          <div>
            <span class="name">${escapeHtml(s.name || 'Unnamed')}</span>${groupLabel}
            <div class="matches">${escapeHtml((s.matches || []).slice(0, 2).join(', '))}</div>
          </div>
          <a href="#" data-id="${escapeHtml(s.id)}" data-action="edit">Edit</a>
          <a href="#" class="danger" data-id="${escapeHtml(s.id)}" data-action="delete">Delete</a>
        </li>
      `;
      })
      .join('');

    scriptListEl.querySelectorAll('a[data-id]').forEach((a) => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = a.dataset.id;
        const action = a.dataset.action;
        if (action === 'delete') {
          await deleteScript(id);
        } else {
          const script = await getScriptById(id);
          if (!script) return;
          scriptIdEl.value = script.id;
          nameEl.value = script.name || '';
          matchesEl.value = matchesToText(script.matches);
          codeEl.value = script.code || '';
          enabledEl.checked = script.enabled !== false;
          await populateGroupDropdown(script.groupId || '');
          form.scrollIntoView();
        }
      });
    });
  });
}

async function deleteScript(id) {
  if (!confirm('Delete this script?')) return;
  const scripts = await getScripts();
  await chrome.storage.local.set({ [STORAGE_KEY]: scripts.filter((s) => s.id !== id) });
  chrome.runtime.sendMessage({ type: 'REGISTER_SCRIPTS' });
  renderScriptList();
}

// ── Group form ────────────────────────────────────────────────────────────────

function resetGroupForm() {
  groupIdEl.value = '';
  groupForm.reset();
  groupIdEl.value = '';
  groupNameEl.value = '';
  groupMatchesEl.value = '';
  groupEnabledEl.checked = true;
}

document.getElementById('cancel-group-btn').addEventListener('click', () => {
  resetGroupForm();
});

groupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = groupIdEl.value || crypto.randomUUID();
  const name = groupNameEl.value.trim();
  const matches = textToMatches(groupMatchesEl.value);
  const enabled = groupEnabledEl.checked;

  const groups = await getGroups();
  const existing = groups.find((g) => g.id === id);
  const now = new Date().toISOString();
  const group = {
    id,
    name: name || 'Unnamed group',
    matches: matches.length > 0 ? matches : ['<all_urls>'],
    disabledSites: existing ? (existing.disabledSites || []) : [],
    enabled,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  const next = existing
    ? groups.map((g) => (g.id === id ? group : g))
    : [...groups, group];
  await chrome.storage.local.set({ [GROUPS_KEY]: next });

  chrome.runtime.sendMessage({ type: 'REGISTER_SCRIPTS' });

  resetGroupForm();
  renderGroupList();
  populateGroupDropdown('');
});

async function deleteGroup(groupId) {
  if (!confirm('Delete this group? Scripts in this group will become standalone.')) return;

  // Clear groupId from all scripts in this group
  const scripts = await getScripts();
  const updatedScripts = scripts.map((s) =>
    s.groupId === groupId ? { ...s, groupId: null } : s
  );
  await chrome.storage.local.set({ [STORAGE_KEY]: updatedScripts });

  const groups = await getGroups();
  await chrome.storage.local.set({ [GROUPS_KEY]: groups.filter((g) => g.id !== groupId) });

  chrome.runtime.sendMessage({ type: 'REGISTER_SCRIPTS' });
  renderGroupList();
  renderScriptList();
  populateGroupDropdown('');
}

function renderGroupList() {
  Promise.all([getGroups(), getScripts()]).then(([groups, scripts]) => {
    if (groups.length === 0) {
      groupListEl.innerHTML = '<li class="hint">No groups yet.</li>';
      return;
    }
    groupListEl.innerHTML = groups
      .map((g) => {
        const memberCount = scripts.filter((s) => s.groupId === g.id).length;
        const matchSummary = (g.matches || []).slice(0, 2).join(', ');
        return `
        <li>
          <div>
            <span class="name">${escapeHtml(g.name || 'Unnamed group')}</span>
            <span class="hint"> — ${memberCount} script${memberCount !== 1 ? 's' : ''}</span>
            <div class="matches">${escapeHtml(matchSummary)}</div>
          </div>
          <a href="#" data-id="${escapeHtml(g.id)}" data-action="edit">Edit</a>
          <a href="#" class="danger" data-id="${escapeHtml(g.id)}" data-action="delete">Delete</a>
        </li>
      `;
      })
      .join('');

    groupListEl.querySelectorAll('a[data-id]').forEach((a) => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = a.dataset.id;
        const action = a.dataset.action;
        if (action === 'delete') {
          await deleteGroup(id);
        } else {
          const groups = await getGroups();
          const group = groups.find((g) => g.id === id);
          if (!group) return;
          groupIdEl.value = group.id;
          groupNameEl.value = group.name || '';
          groupMatchesEl.value = matchesToText(group.matches);
          groupEnabledEl.checked = group.enabled !== false;
          groupForm.scrollIntoView();
        }
      });
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  await populateGroupDropdown('');
  const editId = parseIdFromUrl();
  if (editId) {
    const script = await getScriptById(editId);
    if (script) {
      scriptIdEl.value = script.id;
      nameEl.value = script.name || '';
      matchesEl.value = matchesToText(script.matches);
      codeEl.value = script.code || '';
      enabledEl.checked = script.enabled !== false;
      await populateGroupDropdown(script.groupId || '');
    }
  }
  renderScriptList();
  renderGroupList();
})();
