#!/usr/bin/env node
/**
 * Remove misleading "provider":{...Woogoro...} from Service schema across all
 * city pages. Woogoro analyzes quotes rather than providing services, so
 * claiming it as the service provider risks a manual action on structured-data
 * spam. Schema.org Service works without a provider — the page then represents
 * cost data for that service category without claiming an actual provider.
 *
 * The match is intentionally strict: exact JSON fragment as used in the
 * codebase. We also run a parse check on every modified Service block to make
 * sure we didn't leave invalid JSON.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

// The exact fragment used by all existing Service schemas on the site.
// Trailing comma is always present because "provider" is followed by
// "areaServed" in every current instance.
const PROVIDER_FRAGMENT = '"provider":{"@type":"Organization","name":"Woogoro","url":"https://woogoro.com"},';

let changed = 0, totalRemovals = 0, parseErrors = 0;
const errorFiles = [];

for (const file of files) {
  const filePath = path.join(ROOT, file);
  const html = fs.readFileSync(filePath, 'utf8');

  if (!html.includes(PROVIDER_FRAGMENT)) continue;

  const count = (html.split(PROVIDER_FRAGMENT).length - 1);
  const updated = html.split(PROVIDER_FRAGMENT).join('');

  // Validate: every remaining Service block should still parse as JSON.
  const serviceBlocks = updated.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || [];
  let fileOk = true;
  for (const block of serviceBlocks) {
    const inner = block.replace(/<\/?script[^>]*>/g, '').trim();
    if (!inner.includes('"@type":"Service"') && !inner.includes('"@type": "Service"')) continue;
    try { JSON.parse(inner); }
    catch (e) { fileOk = false; errorFiles.push(file + ': ' + e.message); break; }
  }

  if (!fileOk) { parseErrors++; continue; }

  fs.writeFileSync(filePath, updated, 'utf8');
  changed++;
  totalRemovals += count;
}

console.log('Modified files:', changed);
console.log('Total provider fragments removed:', totalRemovals);
console.log('Files skipped due to parse errors:', parseErrors);
if (errorFiles.length) {
  console.log('\nParse errors:');
  errorFiles.slice(0, 5).forEach(e => console.log(' -', e));
}
