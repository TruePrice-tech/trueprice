#!/usr/bin/env node
/**
 * One-shot: standardize favicon references from /favicon.svg -> /favicon-trudy.svg
 * Runs across all *.html files in repo root. Skips node_modules.
 *
 * The replacement is scoped to the favicon link tag only — we match the exact
 * href pattern so we don't accidentally touch other references to "favicon.svg".
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

// Match either href="/favicon.svg" or href='/favicon.svg' in the icon link tag
// We use a narrow pattern (link rel="icon" ... href="/favicon.svg") to avoid
// stray matches elsewhere in the page.
const pattern = /(<link\s+[^>]*rel=["']icon["'][^>]*href=["'])\/favicon\.svg(["'])/g;

let totalFiles = 0;
let totalReplacements = 0;

for (const file of files) {
  const filePath = path.join(ROOT, file);
  const original = fs.readFileSync(filePath, 'utf8');
  let replaced = 0;
  const updated = original.replace(pattern, (_, pre, post) => {
    replaced++;
    return `${pre}/favicon-trudy.svg${post}`;
  });
  if (replaced > 0) {
    fs.writeFileSync(filePath, updated, 'utf8');
    totalFiles++;
    totalReplacements += replaced;
    console.log(`  ${file}: ${replaced} replacement(s)`);
  }
}

console.log(`\nDone. ${totalReplacements} replacements across ${totalFiles} files.`);
