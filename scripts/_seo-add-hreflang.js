#!/usr/bin/env node
/**
 * Add hreflang="en-US" and hreflang="x-default" alternate link tags to every
 * page that has a canonical link but no hreflang yet. Inserted immediately
 * after the canonical tag so related linking rels stay together.
 *
 * en-US pins the site to US English for Google's international index;
 * x-default is the fallback for other locales. Cheap future-proofing against
 * accidental i18n bugs.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

// Capture the canonical URL and the whole tag (with any trailing whitespace
// before the newline). Groups: 1=leading indent, 2=the tag, 3=canonical URL.
const canonicalRe = /^([ \t]*)(<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*\/?>)\s*$/m;

let changed = 0, skipped = 0;

for (const file of files) {
  const filePath = path.join(ROOT, file);
  const html = fs.readFileSync(filePath, 'utf8');

  if (html.includes('hreflang')) { skipped++; continue; }

  const m = html.match(canonicalRe);
  if (!m) { skipped++; continue; }

  const [whole, indent, canonTag, canonUrl] = m;
  const alt1 = `${indent}<link rel="alternate" hreflang="en-US" href="${canonUrl}" />`;
  const alt2 = `${indent}<link rel="alternate" hreflang="x-default" href="${canonUrl}" />`;
  const replacement = `${whole}\n${alt1}\n${alt2}`;
  const updated = html.replace(canonicalRe, replacement);

  if (updated === html) { skipped++; continue; }

  fs.writeFileSync(filePath, updated, 'utf8');
  changed++;
}

console.log('Added hreflang to', changed, 'files');
console.log('Skipped:', skipped);
