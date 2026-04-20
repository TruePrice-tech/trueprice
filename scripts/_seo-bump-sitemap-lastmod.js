#!/usr/bin/env node
/**
 * Bump every <lastmod> in every sitemap file to today's date. Signals to
 * Google/Bing that the entire site was refreshed today — which is accurate
 * after the bulk SEO edits (city-nav widget, hreflang, schema changes,
 * title trims all touched the majority of city pages).
 *
 * Applies to: sitemap-index.xml, sitemap.xml, and every sitemap-<vertical>.xml.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const today = new Date().toISOString().split('T')[0];

const files = fs.readdirSync(ROOT).filter(f => /^sitemap(-[a-z-]+)?\.xml$/.test(f));

let totalBumped = 0;
for (const f of files) {
  const filePath = path.join(ROOT, f);
  const xml = fs.readFileSync(filePath, 'utf8');
  let count = 0;
  const updated = xml.replace(/<lastmod>[^<]+<\/lastmod>/g, () => {
    count++;
    return `<lastmod>${today}</lastmod>`;
  });
  if (count > 0 && updated !== xml) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`  ${f}: bumped ${count} lastmod entries`);
    totalBumped += count;
  }
}

console.log(`\nDone. ${totalBumped} lastmod entries bumped to ${today} across ${files.length} sitemap files.`);
