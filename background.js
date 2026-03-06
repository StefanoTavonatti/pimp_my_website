importScripts('lib/match-patterns.js');

const STORAGE_KEY = 'scripts';
const GROUPS_KEY = 'groups';

function buildGroupWrapperCode(members) {
  const fns = members.map((m, i) => `function _s${i}(){${m.code || ''}}`);
  return `(function(){` +
    `${fns.join(';')};` +
    `var _fns=[${members.map((_, i) => `_s${i}`).join(',')}];` +
    `_fns[Math.floor(Math.random()*_fns.length)]();` +
  `})();`;
}

/**
 * Load scripts and groups from storage and register all enabled ones with chrome.userScripts.
 * Standalone scripts register individually. Grouped scripts register as one wrapper per group
 * that randomly selects one member to run.
 */
async function registerAllScripts() {
  try {
    const { [STORAGE_KEY]: scripts = [], [GROUPS_KEY]: groups = [] } =
      await chrome.storage.local.get([STORAGE_KEY, GROUPS_KEY]);

    const enabledScripts = scripts.filter((s) => s.enabled !== false);
    const enabledGroups = groups.filter((g) => g.enabled !== false);

    const standaloneScripts = enabledScripts.filter((s) => !s.groupId);
    const groupedScripts = enabledScripts.filter((s) => s.groupId);

    const standaloneEntries = standaloneScripts.map((s) => ({
      id: s.id,
      matches: Array.isArray(s.matches) && s.matches.length > 0 ? s.matches : ['<all_urls>'],
      excludeMatches: hostnamesToExcludeMatches(s.disabledSites || []),
      js: [{ code: s.code || '' }],
      runAt: s.runAt || 'document_idle',
    }));

    const groupEntries = enabledGroups.flatMap((g) => {
      const members = groupedScripts.filter((s) => s.groupId === g.id);
      if (members.length === 0) return [];
      return [{
        id: g.id,
        matches: Array.isArray(g.matches) && g.matches.length > 0 ? g.matches : ['<all_urls>'],
        excludeMatches: hostnamesToExcludeMatches(g.disabledSites || []),
        js: [{ code: buildGroupWrapperCode(members) }],
        runAt: 'document_idle',
      }];
    });

    const toRegister = [...standaloneEntries, ...groupEntries];

    await chrome.userScripts.unregister();
    if (toRegister.length > 0) {
      await chrome.userScripts.register(toRegister);
    }
  } catch (e) {
    console.error('Pimp my Website: failed to register scripts', e);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    registerAllScripts();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes[STORAGE_KEY] || changes[GROUPS_KEY])) {
    registerAllScripts();
  }
});

// Allow popup/options to request a re-sync
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'REGISTER_SCRIPTS') {
    registerAllScripts().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
  }
  return true;
});
