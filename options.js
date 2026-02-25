const STORAGE_KEY = 'scripts';

function parseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function getScripts() {
  const { [STORAGE_KEY]: scripts = [] } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(scripts) ? scripts : [];
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

const form = document.getElementById('script-form');
const scriptIdEl = document.getElementById('script-id');
const nameEl = document.getElementById('script-name');
const matchesEl = document.getElementById('script-matches');
const codeEl = document.getElementById('script-code');
const enabledEl = document.getElementById('script-enabled');
const scriptListEl = document.getElementById('script-list');
const scriptListSection = document.getElementById('script-list-section');

document.getElementById('back-link').addEventListener('click', (e) => {
  e.preventDefault();
  const url = chrome.runtime.getURL('popup.html');
  chrome.tabs.create({ url });
  window.close();
});

document.getElementById('cancel-btn').addEventListener('click', () => {
  scriptIdEl.value = '';
  form.reset();
  scriptIdEl.value = '';
  nameEl.value = '';
  matchesEl.value = '';
  codeEl.value = '';
  enabledEl.checked = true;
  renderScriptList();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = scriptIdEl.value || crypto.randomUUID();
  const name = nameEl.value.trim();
  const matches = textToMatches(matchesEl.value);
  const code = codeEl.value;
  const enabled = enabledEl.checked;

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
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  const next = existing
    ? scripts.map((s) => (s.id === id ? script : s))
    : [...scripts, script];
  await chrome.storage.local.set({ [STORAGE_KEY]: next });

  chrome.runtime.sendMessage({ type: 'REGISTER_SCRIPTS' });

  scriptIdEl.value = '';
  form.reset();
  scriptIdEl.value = '';
  nameEl.value = '';
  matchesEl.value = '';
  codeEl.value = '';
  enabledEl.checked = true;
  renderScriptList();
});

function renderScriptList() {
  getScripts().then((scripts) => {
    if (scripts.length === 0) {
      scriptListSection.style.display = 'none';
      return;
    }
    scriptListSection.style.display = 'block';
    scriptListEl.innerHTML = scripts
      .map(
        (s) => `
      <li>
        <div>
          <span class="name">${escapeHtml(s.name || 'Unnamed')}</span>
          <div class="matches">${escapeHtml((s.matches || []).slice(0, 2).join(', '))}</div>
        </div>
        <a href="#" data-id="${escapeHtml(s.id)}">Edit</a>
      </li>
    `
      )
      .join('');

    scriptListEl.querySelectorAll('a[data-id]').forEach((a) => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = a.dataset.id;
        const script = await getScriptById(id);
        if (!script) return;
        scriptIdEl.value = script.id;
        nameEl.value = script.name || '';
        matchesEl.value = matchesToText(script.matches);
        codeEl.value = script.code || '';
        enabledEl.checked = script.enabled !== false;
        form.scrollIntoView();
      });
    });
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

(async () => {
  const editId = parseIdFromUrl();
  if (editId) {
    const script = await getScriptById(editId);
    if (script) {
      scriptIdEl.value = script.id;
      nameEl.value = script.name || '';
      matchesEl.value = matchesToText(script.matches);
      codeEl.value = script.code || '';
      enabledEl.checked = script.enabled !== false;
    }
  }
  renderScriptList();
})();
