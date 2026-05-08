#!/usr/bin/env node
// Three-task follow-up cleanup after the GSC indexability audit:
//   1. Drop 19 noindex'd quote-analyzer URLs from sitemaps (sitemap.xml + 16 per-vertical)
//   2. Add explicit <meta name="robots" content="index,follow" /> to 25 pages
//      (skip the Google-verification stub; saint-paul will be deleted, not patched)
//   3. saint-paul-mn-roof-cost.html cleanup:
//      - update the 4 referrers to point at st-paul-mn-roof-cost.html
//      - drop saint-paul's entry from sitemap-roof.xml
//      - delete the orphan file
// Run from repo root. --dry to preview.

'use strict';
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const ROOT = process.cwd();
const log = (...args) => console.log(...args);

// ---------------- Task 1: sitemap cleanup ----------------
const ANALYZER_TO_SITEMAP = {
  'sitemap.xml': ['legal-fee-analyzer.html', 'medical-bill-analyzer.html', 'moving-quote-analyzer.html'],
  'sitemap-concrete.xml':    ['concrete-quote-analyzer.html'],
  'sitemap-electrical.xml':  ['electrical-quote-analyzer.html'],
  'sitemap-fence.xml':       ['fencing-quote-analyzer.html'],
  'sitemap-foundation.xml':  ['foundation-quote-analyzer.html'],
  'sitemap-garage-door.xml': ['garage-door-quote-analyzer.html'],
  'sitemap-gutters.xml':     ['gutters-quote-analyzer.html'],
  'sitemap-hvac.xml':        ['hvac-quote-analyzer.html'],
  'sitemap-insulation.xml':  ['insulation-quote-analyzer.html'],
  'sitemap-kitchen.xml':     ['kitchen-quote-analyzer.html'],
  'sitemap-landscaping.xml': ['landscaping-quote-analyzer.html'],
  'sitemap-painting.xml':    ['painting-quote-analyzer.html'],
  'sitemap-plumbing.xml':    ['plumbing-quote-analyzer.html'],
  'sitemap-roof.xml':        ['roofing-quote-analyzer.html', 'saint-paul-mn-roof-cost.html'], // task 3 piggybacks here
  'sitemap-siding.xml':      ['siding-quote-analyzer.html'],
  'sitemap-solar.xml':       ['solar-quote-analyzer.html'],
  'sitemap-window.xml':      ['window-quote-analyzer.html'],
};

let smRemoved = 0;
for (const [sm, urls] of Object.entries(ANALYZER_TO_SITEMAP)) {
  const fp = path.join(ROOT, sm);
  if (!fs.existsSync(fp)) { log('  skip (missing):', sm); continue; }
  const before = fs.readFileSync(fp, 'utf8');
  const lines = before.split(/\r?\n/);
  const slugSet = new Set(urls);
  const kept = lines.filter(line => {
    const m = line.match(/<loc>https:\/\/woogoro\.com\/([^<]+)<\/loc>/);
    if (!m) return true;
    return !slugSet.has(m[1]);
  });
  const removed = lines.length - kept.length;
  smRemoved += removed;
  if (removed > 0 && !DRY) fs.writeFileSync(fp, kept.join('\n'));
  log(`  ${sm}: -${removed} entr${removed === 1 ? 'y' : 'ies'}`);
}
log(`Task 1: ${smRemoved} sitemap entries removed`);

// ---------------- Task 2: add robots meta ----------------
const ROBOTS_TARGETS = [
  'auto-repair-cost-guide.html',
  'concrete-cost-guide.html',
  'electrical-cost-guide.html',
  'fencing-cost-guide.html',
  'foundation-repair-cost-guide.html',
  'garage-door-cost-guide.html',
  'gutter-installation-cost-guide.html',
  'how-to-compare-roofing-quotes.html',
  'hvac-replacement-cost-guide.html',
  'insulation-cost-guide.html',
  'kitchen-remodel-cost-guide.html',
  'landscaping-cost-guide.html',
  'legal-cost-guide.html',
  'medical-cost-guide.html',
  'painting-cost-guide.html',
  'plumbing-cost-guide.html',
  'roof-cost-by-house-size.html',
  'roof-quote-example-charlotte-2100.html',
  'roof-replacement-vs-roof-repair.html',
  'roofing-quote-examples.html',
  'siding-cost-guide.html',
  'solar-installation-cost-guide.html',
  'what-should-a-roofing-quote-include.html',
  'window-replacement-cost-guide.html',
  // saint-paul-mn-roof-cost.html intentionally omitted — it gets deleted in task 3
  // googlef1f12025490e6d42.html intentionally omitted — Google site-verification stub
];

let robotsAdded = 0, robotsSkip = 0;
for (const f of ROBOTS_TARGETS) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) { log('  skip (missing):', f); robotsSkip++; continue; }
  const before = fs.readFileSync(fp, 'utf8');
  if (/<meta\s+name=["']robots["']/i.test(before)) {
    log('  skip (already has robots):', f);
    robotsSkip++;
    continue;
  }
  const re = /(\r?\n)([ \t]*)<\/head>/i;
  const m = before.match(re);
  if (!m) { log('  skip (no </head>):', f); robotsSkip++; continue; }
  const nl = m[1];
  const indent = m[2] || '';
  const insert = `${indent}<meta name="robots" content="index,follow" />${nl}`;
  const after = before.replace(re, () => `${nl}${insert}${indent}</head>`);
  if (!DRY) fs.writeFileSync(fp, after);
  robotsAdded++;
}
log(`Task 2: ${robotsAdded} pages got robots meta (skipped ${robotsSkip})`);

// ---------------- Task 3: saint-paul cleanup ----------------
const SAINT = 'saint-paul-mn-roof-cost.html';
const ST = 'st-paul-mn-roof-cost.html';
const REFERRERS = ['eau-claire-wi-roof-cost.html', 'eden-prairie-mn-roof-cost.html', 'minnesota-roof-cost.html', 'roof-cities.html'];
let refsUpdated = 0;
for (const f of REFERRERS) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) { log('  saint-paul referrer missing:', f); continue; }
  const before = fs.readFileSync(fp, 'utf8');
  // Replace href occurrences only — leave display text alone (might say "Saint Paul" or "St. Paul").
  const after = before.replace(/href="\/saint-paul-mn-roof-cost\.html"/g, 'href="/st-paul-mn-roof-cost.html"');
  if (after === before) { log('  saint-paul ref not found in:', f); continue; }
  if (!DRY) fs.writeFileSync(fp, after);
  refsUpdated++;
  log('  updated saint->st in:', f);
}

// Delete the orphan file (sitemap entry already removed in task 1).
if (fs.existsSync(path.join(ROOT, SAINT))) {
  if (!DRY) fs.unlinkSync(path.join(ROOT, SAINT));
  log('  deleted orphan:', SAINT, DRY ? '(dry)' : '');
}
log(`Task 3: saint-paul ${refsUpdated} referrers updated + 1 orphan ${DRY ? 'would be' : ''} deleted`);

log(DRY ? '\n[DRY RUN — nothing written]' : '\n[changes applied]');
