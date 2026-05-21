#!/usr/bin/env node
// One-time: inject state-level cost pages into per-vertical sitemaps.
// Audit 2026-05-20 found state pages for 14 verticals (painting, hvac, etc.)
// existed on disk with index,follow meta but were absent from any sitemap.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const today = new Date().toISOString().split('T')[0];

const STATES = [
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada',
  'new-hampshire','new-jersey','new-mexico','new-york','north-carolina',
  'north-dakota','ohio','oklahoma','oregon','pennsylvania','rhode-island',
  'south-carolina','south-dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west-virginia','wisconsin','wyoming',
  'district-of-columbia'
];

// vertical-slug => sitemap filename
const VERTICALS = {
  'painting': 'sitemap-painting.xml',
  'hvac': 'sitemap-hvac.xml',
  'electrical': 'sitemap-electrical.xml',
  'plumbing': 'sitemap-plumbing.xml',
  'concrete': 'sitemap-concrete.xml',
  'foundation': 'sitemap-foundation.xml',
  'siding': 'sitemap-siding.xml',
  'window': 'sitemap-window.xml',
  'insulation': 'sitemap-insulation.xml',
  'gutter': 'sitemap-gutters.xml',
  'landscaping': 'sitemap-landscaping.xml',
  'kitchen-remodel': 'sitemap-kitchen.xml',
  'garage-door': 'sitemap-garage-door.xml',
  'solar': 'sitemap-solar.xml',
};

let grandTotal = 0;
for (const [vSlug, sitemapFile] of Object.entries(VERTICALS)) {
  const sitemapPath = path.join(ROOT, sitemapFile);
  if (!fs.existsSync(sitemapPath)) {
    console.log(`  skip ${sitemapFile}: not found`);
    continue;
  }
  const xml = fs.readFileSync(sitemapPath, 'utf8');

  const newEntries = [];
  for (const state of STATES) {
    const file = `${state}-${vSlug}-cost.html`;
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    // already in sitemap?
    if (xml.includes(`/${file}<`)) continue;
    newEntries.push(`  <url><loc>https://woogoro.com/${file}</loc><lastmod>${today}</lastmod></url>`);
  }
  if (newEntries.length === 0) {
    console.log(`  ${sitemapFile}: nothing to add (${vSlug})`);
    continue;
  }
  // Insert before closing </urlset>
  const updated = xml.replace(/<\/urlset>\s*$/, newEntries.join('\n') + '\n</urlset>\n');
  fs.writeFileSync(sitemapPath, updated, 'utf8');
  console.log(`  ${sitemapFile}: added ${newEntries.length} state-page entries`);
  grandTotal += newEntries.length;
}
console.log(`\nTotal state-page entries added: ${grandTotal}`);
