# Pimp my Website

A Chrome extension that lets you run your own JavaScript on specific websites—similar to Tampermonkey—with per-site enable/disable.

**Requirements:** Chrome 120 or newer.

---

## How to load the extension in Chrome (Developer mode)

1. Open Chrome and go to the Extensions page: type `chrome://extensions` in the address bar and press Enter.
2. Turn **Developer mode** on (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Choose the folder that contains the extension (the folder where `manifest.json` is).
5. The extension **Pimp my Website** will appear in your extensions list.

---

## Enable User Scripts (required for scripts to run)

For your custom scripts to run on websites, you must allow the extension to use the User Scripts API:

1. Go to `chrome://extensions`.
2. Find **Pimp my Website** and click **Details**.
3. Turn on **Allow User Scripts** (or, on older Chrome versions, make sure **Developer mode** is on at the top of the Extensions page).

Without this, scripts you add will be saved but will not execute on pages.

---

## How to use

### Popup (click the extension icon)

- **Script list** – See all your scripts with their match patterns.
- **Add script** – Opens the options page to create a new script.
- **Options** – Opens the options page (same as the Add script editor).
- For each script:
  - **Disable on this site** / **Enable on this site** – Turn the script off or on for the current tab’s site only.
  - **Edit** – Open the options page with that script loaded for editing.
  - **Delete** – Remove the script (you’ll be asked to confirm).

### Options page (full editor)

Open it from the popup (**Add script** or **Options**) or via right‑click on the extension icon → **Options**.

- **Script name** – Name used in the list.
- **Match patterns** – One pattern per line. These define which URLs the script runs on. Examples:
  - `*://*.example.com/*` – all pages on example.com and its subdomains
  - `*://*.google.com/*` – all Google pages
  - `https://example.com/page/*` – only URLs under that path
- **JavaScript code** – The code that runs on matching pages (same kind of code you’d use in Tampermonkey).
- **Script enabled** – Uncheck to disable the script everywhere without deleting it.

Click **Save script** to create or update the script. Use **Edit** in the popup or in the “Your scripts” list on the options page to change an existing script.

---

## Example: Hello World overlay

Here's a minimal script that shows a "Hello World" overlay on the target site. Add it as a new script and set a match pattern (e.g. `*://example.com/*` or `*://*/*` to try it on any page).

**JavaScript code:**

```javascript
(function () {
  const overlay = document.createElement('div');
  overlay.id = 'pimp-my-website-hello';
  overlay.textContent = 'Hello World';
  overlay.style.cssText = [
    'position: fixed',
    'top: 20px',
    'right: 20px',
    'z-index: 2147483647',
    'padding: 12px 20px',
    'background: #238636',
    'color: #fff',
    'font-family: system-ui, sans-serif',
    'font-size: 16px',
    'font-weight: 600',
    'border-radius: 8px',
    'box-shadow: 0 4px 12px rgba(0,0,0,0.2)',
  ].join(';');
  document.body.appendChild(overlay);
})();
```

**Match pattern (one per line):** e.g. `*://*/*` to run on all sites, or `*://example.com/*` for a single domain.

---

## Example: Find and edit an element by XPath

This script finds a DOM node with an XPath expression, reads its value, then edits that node. Adjust the XPath to match your target page (e.g. a heading, input, or span).

**JavaScript code:**

```javascript
(function () {
  // XPath to locate the element (example: first h1 on the page)
  var xpath = "//h1[1]";

  var result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  var node = result.singleNodeValue;

  if (!node) {
    console.warn("Pimp my Website: No element found for XPath:", xpath);
    return;
  }

  // Get the current value (text for elements, value for inputs)
  var currentValue = node.value !== undefined ? node.value : node.textContent;
  console.log("Pimp my Website: Current value:", currentValue);

  // Edit the object: set new text or value
  var newText = currentValue + " (modified by Pimp my Website)";
  if (node.value !== undefined) {
    node.value = newText;
  } else {
    node.textContent = newText;
  }
})();
```

**Notes:**

- Change `xpath` to your target (e.g. `"//input[@name='q']"` for a search box, `"//span[@class='price']"` for a price).
- `document.evaluate()` returns an `XPathResult`; `FIRST_ORDERED_NODE_TYPE` gives the first matching node.
- For inputs/textarea use `node.value`; for other elements use `node.textContent` or `node.innerHTML`.

**Match pattern (one per line):** e.g. `*://example.com/*` for the site where you want to run it.

---

## Match pattern format

Use Chrome’s standard [match pattern](https://developer.chrome.com/docs/extensions/mv2/match_patterns/) syntax:

- `*` in the scheme means `http` and `https`.
- Host can be `*`, `*.example.com`, or `example.com`.
- Path must start with `/` and can use `*` as a wildcard.

Examples:

- `*://*/*` – all pages (use with care)
- `*://*.example.com/*` – example.com and all subdomains
- `https://example.com/foo*` – HTTPS pages on example.com whose path starts with `/foo`

---

## Summary

- **Load:** `chrome://extensions` → Developer mode → Load unpacked → select this folder.
- **Allow scripts:** Extension details → Allow User Scripts (or Developer mode on older Chrome).
- **Manage scripts:** Popup for list and per-site toggles; Options page for adding and editing scripts and match patterns.
