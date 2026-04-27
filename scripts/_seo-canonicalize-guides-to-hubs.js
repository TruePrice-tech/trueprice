#!/usr/bin/env node
// Consolidate keyword cannibalization: -cost-guide.html canonicals point to the matching -cost.html hub.
// Idempotent: rewrites the canonical line + the og:url + alternate hreflang lines.
// Discovered 2026-04-27 audit: 15 guide pages were self-canonical and competing with hubs.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PAIRS = [
  ['fencing-cost-guide.html', 'fence-cost.html'],
  ['concrete-cost-guide.html', 'concrete-cost.html'],
  ['plumbing-cost-guide.html', 'plumbing-cost.html'],
  ['electrical-cost-guide.html', 'electrical-cost.html'],
  ['hvac-replacement-cost-guide.html', 'hvac-cost.html'],
  ['siding-cost-guide.html', 'siding-cost.html'],
  ['painting-cost-guide.html', 'painting-cost.html'],
  ['solar-installation-cost-guide.html', 'solar-cost.html'],
  ['garage-door-cost-guide.html', 'garage-door-cost.html'],
  ['kitchen-remodel-cost-guide.html', 'kitchen-remodel-cost.html'],
  ['insulation-cost-guide.html', 'insulation-cost.html'],
  ['landscaping-cost-guide.html', 'landscaping-cost.html'],
  ['foundation-repair-cost-guide.html', 'foundation-repair-cost.html'],
  ['window-replacement-cost-guide.html', 'window-replacement-cost.html'],
  ['gutter-installation-cost-guide.html', 'gutters-cost.html'],
];

let touched = 0;
for (const [guide, hub] of PAIRS) {
  const p = path.join(ROOT, guide);
  if (!fs.existsSync(p)) {
    console.warn(`SKIP missing: ${guide}`);
    continue;
  }
  let html = fs.readFileSync(p, 'utf8');
  const before = html;
  const guideUrl = `https://woogoro.com/${guide}`;
  const hubUrl = `https://woogoro.com/${hub}`;

  // Canonical link (any href shape, with or without trailing slash)
  html = html.replace(
    /<link rel="canonical" href="https:\/\/woogoro\.com\/[a-z0-9-]+\.html"\s*\/?>/g,
    `<link rel="canonical" href="${hubUrl}">`
  );

  // og:url (point at hub so social shares attribute to hub)
  html = html.replace(
    /<meta property="og:url" content="https:\/\/woogoro\.com\/[a-z0-9-]+\.html">/g,
    `<meta property="og:url" content="${hubUrl}">`
  );

  // Alternate hreflang en-US + x-default
  html = html.replace(
    /<link rel="alternate" hreflang="en-US" href="https:\/\/woogoro\.com\/[a-z0-9-]+\.html"\s*\/?>/g,
    `<link rel="alternate" hreflang="en-US" href="${hubUrl}" />`
  );
  html = html.replace(
    /<link rel="alternate" hreflang="x-default" href="https:\/\/woogoro\.com\/[a-z0-9-]+\.html"\s*\/?>/g,
    `<link rel="alternate" hreflang="x-default" href="${hubUrl}" />`
  );

  if (html !== before) {
    fs.writeFileSync(p, html);
    touched++;
    console.log(`OK ${guide} -> ${hub}`);
  } else {
    console.log(`UNCHANGED ${guide}`);
  }
}
console.log(`\nDone. ${touched}/${PAIRS.length} files updated.`);
