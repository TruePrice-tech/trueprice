#!/usr/bin/env node
/**
 * Add Methodology nav link to the site-wide header nav. The methodology
 * page documents the BLS/BEA data sources used for cost estimates.
 * Prominent nav link helps E-E-A-T scoring and AI-Overview citation
 * eligibility (cited sources favor data pages with documented methodology).
 *
 * Strategy: find "<a href=\"/guides.html\">Guides</a>" (the exact anchor used
 * in the nav on every page) and append a Methodology link on the next line.
 * The footer uses "<a href=\"/guides.html\">Cost guides</a>" (different link
 * text) so we won't double up the methodology link in the footer.
 *
 * Idempotent — skips pages that already have /methodology.html in their <nav>.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const GUIDES_LINK = '<a href="/guides.html">Guides</a>';
const METHOD_LINK = '<a href="/methodology.html">Methodology</a>';

let changed = 0, skippedHasInNav = 0, skippedNoAnchor = 0;

for (const file of files) {
  const filePath = path.join(ROOT, file);
  const html = fs.readFileSync(filePath, 'utf8');

  // Skip if <nav> already contains a methodology link
  const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
  if (navMatch && navMatch[1].includes('/methodology.html')) {
    skippedHasInNav++; continue;
  }

  if (!html.includes(GUIDES_LINK)) { skippedNoAnchor++; continue; }

  // Replace the FIRST occurrence only (the nav one). Footer uses "Cost guides"
  // text so it won't match. Header nav is always the first occurrence.
  const idx = html.indexOf(GUIDES_LINK);
  const updated = html.slice(0, idx + GUIDES_LINK.length)
    + '\n' + METHOD_LINK
    + html.slice(idx + GUIDES_LINK.length);

  fs.writeFileSync(filePath, updated, 'utf8');
  changed++;
}

console.log('Added Methodology nav link to:', changed);
console.log('Skipped (already had in nav):', skippedHasInNav);
console.log('Skipped (no Guides anchor in nav format):', skippedNoAnchor);
