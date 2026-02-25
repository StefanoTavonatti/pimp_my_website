importScripts('lib/match-patterns.js');

const STORAGE_KEY = 'scripts';

/**
 * Load scripts from storage and register all enabled ones with chrome.userScripts.
 * Disabled scripts are not registered. disabledSites are converted to excludeMatches.
 */
async function registerAllScripts() {
  try {
    const { [STORAGE_KEY]: scripts = [] } = await chrome.storage.local.get(STORAGE_KEY);
    const enabled = scripts.filter((s) => s.enabled !== false);
    if (enabled.length === 0) {
      await chrome.userScripts.unregister();
      return;
    }
    const toRegister = enabled.map((s) => ({
      id: s.id,
      matches: Array.isArray(s.matches) && s.matches.length > 0 ? s.matches : ['<all_urls>'],
      excludeMatches: hostnamesToExcludeMatches(s.disabledSites || []),
      js: [{ code: s.code || '' }],
      runAt: s.runAt || 'document_idle',
    }));
    await chrome.userScripts.unregister();
    await chrome.userScripts.register(toRegister);
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
  if (areaName === 'local' && changes[STORAGE_KEY]) {
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
