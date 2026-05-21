#!/usr/bin/env node
// One-time: strip three pieces of broken template debt from *-roof-cost.html
// pages where the original generator failed to substitute these tokens:
//
//   1. {{CITY_RATE_CEDAR|FLAT|SLATE|CONCRETE}} — visible literal text in
//      hero-meta-item rows. The 4 working materials (Asphalt/Architectural/
//      Metal/Tile) populated correctly and stay.
//   2. {{MATERIAL_COMPARISON_CARDS}} — visible literal text inside a
//      <section> with h2 "Roofing Materials Compared". Whole section is
//      removed.
//   3. var CITY_PRICES = {{CITY_PRICES_JSON}}; — a JS SyntaxError that
//      breaks the inline calc <script>. Whole <script> block removed.
//      The slider/dropdown UI above becomes inert (no JS to drive them)
//      but the static default $-figure stays visible.
//
// Wires through _handwritten-guard.js — any roof page with the
// HANDWRITTEN-PROTECTED marker is auto-skipped via the monkey-patched
// fs.writeFileSync. Chattanooga painting flagship is protected by that
// marker (different vertical anyway, but the guard runs regardless).

require('./_handwritten-guard.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// (1) Cedar/Flat/Slate/Concrete hero-meta-item rows with placeholder values.
const HERO_META_RE = /<div class="hero-meta-item">\s*<span class="hero-meta-label">[^<]+<\/span>\s*<span class="hero-meta-value">\{\{CITY_RATE_[A-Z]+\}\}\/sq<\/span>\s*<\/div>\s*/g;

// (2) The <section> containing {{MATERIAL_COMPARISON_CARDS}}. Capture the
//     "<!-- 4b. Material Comparison -->" comment line above too if present.
const MATERIAL_CARDS_RE = /(?:<!--\s*4b\.\s*Material Comparison\s*-->\s*)?<section class="section">\s*<h2>Roofing Materials Compared<\/h2>[\s\S]*?\{\{MATERIAL_COMPARISON_CARDS\}\}[\s\S]*?<\/section>\s*/g;

// (3) The inline <script> containing `var CITY_PRICES = {{CITY_PRICES_JSON}};`.
const CITY_PRICES_SCRIPT_RE = /<script>\s*var CITY_PRICES = \{\{CITY_PRICES_JSON\}\};[\s\S]*?<\/script>\s*/g;

const files = fs.readdirSync(ROOT).filter((f) => /-roof-cost\.html$/.test(f));

let touched = 0;
let skippedProtected = 0;
let skippedNoPlaceholder = 0;
let totalRemovals = { hero: 0, cards: 0, script: 0 };

for (const f of files) {
  const filePath = path.join(ROOT, f);
  const orig = fs.readFileSync(filePath, 'utf8');

  // Cheap pre-check: any placeholder at all?
  if (!orig.includes('{{')) {
    skippedNoPlaceholder++;
    continue;
  }

  let updated = orig;
  const heroCount = (updated.match(HERO_META_RE) || []).length;
  updated = updated.replace(HERO_META_RE, '');
  const cardsCount = (updated.match(MATERIAL_CARDS_RE) || []).length;
  updated = updated.replace(MATERIAL_CARDS_RE, '');
  const scriptCount = (updated.match(CITY_PRICES_SCRIPT_RE) || []).length;
  updated = updated.replace(CITY_PRICES_SCRIPT_RE, '');

  if (updated === orig) {
    skippedNoPlaceholder++;
    continue;
  }

  // The handwritten-guard monkey-patches writeFileSync to refuse writes to
  // protected files. So this call is a silent no-op for flagship pages.
  // Detect whether the write actually happened by re-reading length.
  const beforeLen = fs.statSync(filePath).size;
  fs.writeFileSync(filePath, updated, 'utf8');
  const afterLen = fs.statSync(filePath).size;
  if (beforeLen === afterLen) {
    skippedProtected++;
    continue;
  }
  touched++;
  totalRemovals.hero += heroCount;
  totalRemovals.cards += cardsCount;
  totalRemovals.script += scriptCount;
}

console.log(`\nRoof placeholder strip — summary`);
console.log(`  files scanned:          ${files.length}`);
console.log(`  files modified:         ${touched}`);
console.log(`  files skipped (protected):  ${skippedProtected}`);
console.log(`  files skipped (no placeholder): ${skippedNoPlaceholder}`);
console.log(`  hero-meta rows removed:     ${totalRemovals.hero}`);
console.log(`  material-cards sections removed: ${totalRemovals.cards}`);
console.log(`  CITY_PRICES scripts removed:     ${totalRemovals.script}`);

// Post-check: confirm zero {{ in the corpus afterwards.
let residual = 0;
for (const f of files) {
  const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (txt.includes('{{')) residual++;
}
console.log(`  files still containing '{{' after strip: ${residual}`);
