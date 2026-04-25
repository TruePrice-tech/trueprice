#!/usr/bin/env node
/**
 * Add author bylines + Person schema across high-value content pages.
 *
 * E-E-A-T improvement — Google explicitly requires authored content for YMYL
 * topics (medical, legal, financial, home improvement). Currently every
 * Article schema on the site lists Woogoro as both author and publisher;
 * Google can't tell who actually wrote anything.
 *
 * After this pass:
 *   - Visible byline below H1: "By Geoff Lane, founder of Woogoro · Updated April 2026"
 *   - Article schema author flipped from Organization to Person
 *   - Homepage Organization schema gains a `founder` Person
 *
 * Scope: 20 vertical guides + 4 comparison guides + 6 vs-competitor pages +
 * 2 published long-tail pages + 1 blog post + methodology + about. ~34 pages.
 *
 * NOT touched:
 *   - 12,000+ city pages — they're auto-generated and tweaking shared chrome
 *     would risk uniqueness regression.
 *   - The 8 staged long-tail pages (noindex'd) — will get bylines when
 *     they're flipped to live.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Real founder identity — already on homepage and about.html.
const PERSON = {
  name: 'Geoff Lane',
  url: 'https://woogoro.com/about.html',
  image: 'https://woogoro.com/images/geoff-lane.jpg',
  jobTitle: 'Founder',
  homeLocation: { city: 'Charlotte', state: 'NC' },
};

const PAGES = [
  // Vertical guides
  'hvac-cost.html',
  'roof-cost-by-house-size.html',
  'roof-cost-by-material.html',
  'plumbing-cost.html',
  'plumbing-cost-guide.html',
  'electrical-cost.html',
  'electrical-cost-guide.html',
  'solar-cost.html',
  'solar-installation-cost-guide.html',
  'concrete-cost.html',
  'concrete-cost-guide.html',
  'painting-cost.html',
  'fence-cost.html',
  'foundation-repair-cost.html',
  'foundation-repair-cost-guide.html',
  'siding-cost.html',
  'window-replacement-cost.html',
  'insulation-cost.html',
  'gutters-cost.html',
  'landscaping-cost.html',
  'landscaping-cost-guide.html',
  'kitchen-remodel-cost.html',
  'garage-door-cost.html',
  'garage-door-cost-guide.html',
  'auto-repair-cost-guide.html',
  'legal-cost-guide.html',
  'medical-cost-guide.html',
  'moving-cost-guide.html',
  'hvac-replacement-cost-guide.html',

  // Comparison pages
  'metal-vs-shingle-roof-cost.html',
  'central-ac-vs-heat-pump-cost.html',
  'copper-vs-pex-plumbing-cost.html',
  'rooftop-vs-ground-mount-solar-cost.html',

  // vs-competitor pages
  'woogoro-vs-angi.html',
  'alternative-to-angi.html',
  'how-to-stop-angi-spam-calls.html',
  'woogoro-vs-thumbtack.html',
  'woogoro-vs-homeadvisor.html',
  'quote-checker-without-email.html',

  // Long-tail pages currently live (the 8 noindex'd ones get bylines on flip)
  'how-much-does-heat-pump-cost.html',
  'how-much-new-roof-cost.html',

  // Blog + meta
  'blog-plumbing-cost-atlanta-2026.html',
  'methodology.html',
];

const BYLINE_HTML = `<div class="tp-byline" style="margin:8px 0 20px; font-size:13px; color:var(--text-muted); line-height:1.5;">By <a href="/about.html" style="color:inherit; text-decoration:underline;">Geoff Lane</a>, founder of Woogoro · Updated April 2026</div>`;

const PERSON_SCHEMA_INLINE =
  `{"@type":"Person","name":"${PERSON.name}","url":"${PERSON.url}","image":"${PERSON.image}","jobTitle":"${PERSON.jobTitle}","worksFor":{"@type":"Organization","name":"Woogoro","url":"https://woogoro.com/"}}`;

let bylineAdded = 0;
let bylineSkipped = 0;
let schemaArticleUpdated = 0;
let schemaArticleSkipped = 0;
let missing = 0;

for (const file of PAGES) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) {
    console.log('  MISSING:', file);
    missing++;
    continue;
  }

  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1) Insert visible byline AFTER the first <h1>...</h1> (if not already present).
  if (!html.includes('class="tp-byline"')) {
    const h1Re = /(<h1[^>]*>[\s\S]*?<\/h1>)/;
    if (h1Re.test(html)) {
      html = html.replace(h1Re, (h1) => `${h1}\n${BYLINE_HTML}`);
      bylineAdded++;
      changed = true;
    } else {
      bylineSkipped++;
    }
  } else {
    bylineSkipped++;
  }

  // 2a) Update existing "author":Organization → Person. (Older pages have it.)
  const updateVariants = [
    [/"author":\{"@type":"Organization","name":"Woogoro"\}/g, `"author":${PERSON_SCHEMA_INLINE}`],
    [/"author":\s*\{\s*"@type":\s*"Organization",\s*"name":\s*"Woogoro"\s*\}/g, `"author":${PERSON_SCHEMA_INLINE}`],
  ];
  let articleUpdated = false;
  for (const [pattern, replacement] of updateVariants) {
    if (pattern.test(html)) {
      html = html.replace(pattern, replacement);
      articleUpdated = true;
    }
  }

  // 2b) For Article schemas that have NO author field, insert one.
  // Newer pages (comparison, vs-competitor, long-tail) only have publisher.
  // Pattern: find `"@type":"Article","headline":...` and inject author right
  // after the headline so the resulting JSON stays well-ordered.
  if (!articleUpdated) {
    // Match Article schema headline in either compact OR expanded format.
    // Group 1 captures everything from "@type":"Article" through the close
    // of the headline value, plus the comma that follows.
    const insertRe = /("@type":\s*"Article",\s*"headline":\s*"[^"]+",)/g;
    if (insertRe.test(html)) {
      let injected = false;
      html = html.replace(insertRe, (match) => {
        // Skip if Article schema already has author within next 400 chars.
        const idx = html.indexOf(match);
        const tail = html.slice(idx + match.length, idx + match.length + 400);
        if (tail.includes('"author":')) return match;
        injected = true;
        return `${match}"author":${PERSON_SCHEMA_INLINE},`;
      });
      if (injected) articleUpdated = true;
    }
  }

  if (articleUpdated) {
    schemaArticleUpdated++;
    changed = true;
  } else {
    schemaArticleSkipped++;
  }

  if (changed) fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  ${file.padEnd(45)} byline:${changed ? 'added' : 'skip'} schema:${articleUpdated ? 'updated' : 'skip'}`);
}

// 3) Update homepage Organization schema to include `founder`.
const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  let h = fs.readFileSync(indexPath, 'utf8');
  if (!h.includes('"founder":')) {
    // Find the Organization block (compact form) and inject founder right after `name`.
    const orgRe = /("@type":"Organization","name":"Woogoro","alternateName":"Woogoro Quote Analyzer","url":"https:\/\/woogoro\.com")/;
    if (orgRe.test(h)) {
      h = h.replace(orgRe, `$1,"founder":{"@type":"Person","name":"${PERSON.name}","url":"${PERSON.url}"}`);
      fs.writeFileSync(indexPath, h, 'utf8');
      console.log('\nhomepage Organization schema: founder added');
    } else {
      console.log('\nhomepage Organization schema: pattern not found, skipped');
    }
  } else {
    console.log('\nhomepage Organization schema: founder already present');
  }
}

console.log(`\nByline: added on ${bylineAdded}, skipped ${bylineSkipped}`);
console.log(`Article schema author: updated ${schemaArticleUpdated}, skipped ${schemaArticleSkipped}`);
console.log(`Missing files: ${missing}`);
