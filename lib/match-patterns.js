/**
 * Build Chrome extension excludeMatches from a list of hostnames.
 * Each hostname becomes *://hostname/* and *://*.hostname/* so both
 * exact host and subdomains are excluded.
 * @param {string[]} hostnames - e.g. ["example.com", "sub.example.com"]
 * @returns {string[]} Chrome match patterns for excludeMatches
 */
function hostnamesToExcludeMatches(hostnames) {
  if (!Array.isArray(hostnames) || hostnames.length === 0) {
    return [];
  }
  const patterns = [];
  for (const host of hostnames) {
    const trimmed = String(host).trim().toLowerCase();
    if (!trimmed) continue;
    patterns.push(`*://${trimmed}/*`);
    if (!trimmed.startsWith('*')) {
      patterns.push(`*://*.${trimmed}/*`);
    }
  }
  return [...new Set(patterns)];
}

// Export for use in background (no module system in extension scripts by default).
if (typeof globalThis !== 'undefined') {
  globalThis.hostnamesToExcludeMatches = hostnamesToExcludeMatches;
}
