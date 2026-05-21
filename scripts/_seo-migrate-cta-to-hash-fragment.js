#!/usr/bin/env node
// GSC 2026-05-21: 311 parameterized URLs of analyze-my-quote.html +
// auto-repair.html were flagged as "Alternate page with proper canonical
// tag" — canonicals are correct (all consolidate to bare URL) but the
// trend was climbing as more city pages got the ?city=X&state=Y CTA
// hoist, wasting crawl budget. Fix: switch the internal CTA hrefs from
// query-string form to hash-fragment form. Hash fragments never reach
// the server, so Google won't crawl them; the page JS reads from
// location.hash with location.search as back-compat fallback.
//
// Scope: only convert hrefs pointing at the two index,follow analyzer
// pages that GSC flagged. Per-vertical analyzers are already
// noindex,follow so their parameterized variants aren't reported in
// GSC and don't need migration.
//
// Idempotent: a hash-form href is left alone on subsequent runs.

require('./_handwritten-guard.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Only these two page targets need migration. Other analyzers are
// noindex'd and don't appear in GSC's dupe-canonical report.
const TARGET_PATHS = ['/analyze-my-quote.html', '/auto-repair.html'];

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

let scanned = 0;
let touched = 0;
let skippedProtected = 0;
let totalHrefsMigrated = 0;

for (const f of files) {
  scanned++;
  const filePath = path.join(ROOT, f);
  const orig = fs.readFileSync(filePath, 'utf8');

  let updated = orig;
  let countThisFile = 0;
  for (const target of TARGET_PATHS) {
    // Match: href="<target>?<params>" with no existing hash. We replace
    // the FIRST '?' with '#'. The rest of the URL (params + closing
    // quote) is untouched.
    const escaped = target.replace(/[/.]/g, (c) => '\\' + c);
    const re = new RegExp(`href="(${escaped})\\?([^"#]*)"`, 'g');
    updated = updated.replace(re, (full, p, qs) => {
      countThisFile++;
      return `href="${p}#${qs}"`;
    });
  }
  if (countThisFile === 0) continue;

  // ? → # is a same-byte-count swap so we can't use file size to detect
  // whether the handwritten-guard refused the write. Re-read instead and
  // compare contents.
  fs.writeFileSync(filePath, updated, 'utf8');
  const after = fs.readFileSync(filePath, 'utf8');
  if (after === orig) { skippedProtected++; continue; }
  touched++;
  totalHrefsMigrated += countThisFile;
}

console.log('\nCTA ? → # hash-fragment migration — summary');
console.log(`  files scanned (.html):  ${scanned}`);
console.log(`  files modified:         ${touched}`);
console.log(`  files skipped (protected, had matches): ${skippedProtected}`);
console.log(`  total hrefs migrated:   ${totalHrefsMigrated}`);

// Post-check: residual ?-form hrefs to the two targets.
let residual = 0;
for (const f of files) {
  const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const target of TARGET_PATHS) {
    const escaped = target.replace(/[/.]/g, (c) => '\\' + c);
    const re = new RegExp(`href="${escaped}\\?`, 'g');
    const m = txt.match(re);
    if (m) residual += m.length;
  }
}
console.log(`  residual ?-form hrefs after migration: ${residual}`);
