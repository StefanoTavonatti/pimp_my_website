# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pimp my Website** is a Chrome Manifest V3 extension (minimum Chrome 120) that lets users run custom JavaScript on specific websites, similar to Tampermonkey. It uses the `chrome.userScripts` API, which requires "Allow User Scripts" to be enabled in extension details.

## Loading / Testing

There is no build step. Load the extension directly in Chrome:

1. Go to `chrome://extensions`, enable Developer mode
2. Click "Load unpacked" and select this folder
3. In extension Details, enable "Allow User Scripts"

After any code change, reload the extension from `chrome://extensions`.

## Architecture

All scripts are stored in `chrome.storage.local` under the key `scripts` as a JSON array. Each script object has:
- `id` (UUID), `name`, `code`, `matches` (array of Chrome match patterns), `disabledSites` (array of hostnames), `enabled` (bool), `createdAt`, `updatedAt`

**Data flow:**
- `background.js` (service worker) — listens for storage changes and re-registers all enabled scripts via `chrome.userScripts.register()`. Also handles `REGISTER_SCRIPTS` messages from popup/options.
- `popup.js` — reads scripts from storage, renders the list, handles per-site enable/disable (adds/removes hostname from `disabledSites`), then sends `REGISTER_SCRIPTS` message to background.
- `options.js` — full editor for creating/editing scripts; writes directly to storage and sends `REGISTER_SCRIPTS`.
- `lib/match-patterns.js` — utility (`hostnamesToExcludeMatches`) shared by background; exposed on `globalThis` since extensions don't use ES modules in service workers by default.

**Per-site disabling** is implemented via `chrome.userScripts` `excludeMatches`: `disabledSites` hostnames are converted to `*://hostname/*` and `*://*.hostname/*` patterns.

Scripts run at `document_idle` by default.
