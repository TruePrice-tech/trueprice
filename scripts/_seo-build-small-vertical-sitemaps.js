#!/usr/bin/env node
/**
 * One-time: build dedicated sitemaps for the 4 small verticals
 * (legal / medical / auto-repair / moving) and register them in
 * sitemap-index.xml.
 *
 * Background: SEO audit 2026-04-27 (Section E) flagged that these 4
 * verticals — 4 pillar guides + ~73 indexable city/state pages each =
 * ~300 indexable URLs — sat entirely outside the sitemap system. The
 * 2026-04-27 doc believed they were at least in the master sitemap.xml;
 * a 2026-05-21 re-check found zero entries for any of the 4 verticals
 * across all sitemaps. So this fixes both: discovery + parity.
 *
 * Rules:
 *  - Scan repo root for *-{vertical}-cost.html, plus a fixed allowlist of
 *    pillar/tool slugs per vertical.
 *  - Only include files whose <meta name="robots"> is index,follow
 *    (state pages: alabama / alaska / arkansas / connecticut / delaware
 *    and ~20 others are deliberately noindex and stay out of the sitemap;
 *    that's correct per Google's sitemap-noindex contradiction rule).
 *  - Use today's date as lastmod; the per-push
 *    _seo-rewrite-sitemap-lastmod-from-git.js will overwrite to true git
 *    mtimes on next CI run.
 *  - Idempotent: regenerates the 4 sitemap files from scratch each run.
 *    Re-running adds nothing new if the indexable set is unchanged.
 *  - Adds the 4 entries to sitemap-index.xml only if missing (idempotent
 *    on re-run).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const today = new Date().toISOString().split('T')[0];
const HOST = 'https://woogoro.com';

// vertical key => { citySlug, sitemap filename, extra pillar/tool slugs }
const VERTICALS = {
  legal: {
    sitemap: 'sitemap-legal.xml',
    extras: [
      'legal-cost-guide.html',
      'legal-cities.html',
      'legal-fee-analyzer.html',
      'legal-billing-calculator.html',
      'legal-rate-lookup.html',
      'legal-estimate.html',
    ],
  },
  medical: {
    sitemap: 'sitemap-medical.xml',
    extras: [
      'medical-cost-guide.html',
      'medical-cities.html',
      'medical-bill-analyzer.html',
      'medical-cost-lookup.html',
      'medical-estimate.html',
    ],
  },
  'auto-repair': {
    sitemap: 'sitemap-auto-repair.xml',
    extras: [
      'auto-repair-cost-guide.html',
      'auto-repair-cities.html',
      'auto-repair-quote-analyzer.html',
      'auto-repair-cost-estimate.html',
    ],
  },
  moving: {
    sitemap: 'sitemap-moving.xml',
    extras: [
      'moving-cost-guide.html',
      'moving-cities.html',
      'moving-quote-analyzer.html',
      'moving-estimate.html',
    ],
  },
};

function isIndexable(file) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) return false;
  const html = fs.readFileSync(filePath, 'utf8');
  const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  if (!m) return true; // no robots meta = indexable by default
  return !/noindex/i.test(m[1]);
}

function buildSitemap(vertical, cfg) {
  const allFiles = fs.readdirSync(ROOT);
  const costPages = allFiles
    .filter((f) => f.endsWith(`-${vertical}-cost.html`))
    .sort();

  const indexable = [];

  for (const slug of cfg.extras) {
    if (isIndexable(slug)) indexable.push(slug);
  }

  let noindexCount = 0;
  for (const f of costPages) {
    if (isIndexable(f)) indexable.push(f);
    else noindexCount++;
  }

  // De-dupe (extras might overlap with cost pages in unusual cases)
  const seen = new Set();
  const unique = indexable.filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const slug of unique) {
    lines.push(
      `  <url><loc>${HOST}/${slug}</loc><lastmod>${today}</lastmod></url>`
    );
  }
  lines.push('</urlset>', '');

  fs.writeFileSync(path.join(ROOT, cfg.sitemap), lines.join('\n'));
  console.log(
    `  ${cfg.sitemap}: ${unique.length} URLs (${cfg.extras.length} pillar/tool + ${unique.length - cfg.extras.length} city/state, skipped ${noindexCount} noindex)`
  );
  return cfg.sitemap;
}

function registerInIndex(sitemapFiles) {
  const indexPath = path.join(ROOT, 'sitemap-index.xml');
  let xml = fs.readFileSync(indexPath, 'utf8');

  let added = 0;
  for (const f of sitemapFiles) {
    const url = `${HOST}/${f}`;
    if (xml.includes(`<loc>${url}</loc>`)) {
      console.log(`  sitemap-index.xml already references ${f}`);
      continue;
    }
    const entry = `  <sitemap>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n`;
    xml = xml.replace('</sitemapindex>', entry + '</sitemapindex>');
    added++;
    console.log(`  registered ${f} in sitemap-index.xml`);
  }
  if (added > 0) fs.writeFileSync(indexPath, xml);
  return added;
}

function main() {
  console.log('Building small-vertical sitemaps...');
  const built = [];
  for (const [v, cfg] of Object.entries(VERTICALS)) {
    built.push(buildSitemap(v, cfg));
  }
  console.log('\nRegistering in sitemap-index.xml...');
  const added = registerInIndex(built);
  console.log(`\nDone. ${built.length} sitemaps built; ${added} new index entries.`);
}

main();
