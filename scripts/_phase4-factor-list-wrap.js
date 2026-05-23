#!/usr/bin/env node
/**
 * Phase 4 follow-up: wrap factor-list `<section class="section">` blocks
 * in `<aside>` so the audit + Google de-weight them. These sections are:
 *
 *   <section class="section">
 *   <h2>What affects X cost in {{CITY}}</h2>  OR
 *   <h2>What Should a X Quote Include?</h2>
 *   <ul class="factor-list">…</ul>
 *   </section>
 *
 * They're identical across all ~740 cities per vertical (factor list
 * content is per-vertical but city-stable). Semantically auxiliary —
 * the cost data is main content; these are tangentially related
 * factor catalogs. <aside> is the correct tag.
 *
 * Idempotent across the 15 per-vertical templates. roof's
 * city-page-template.html and the scope-checklist section there are
 * handled separately (different structure, has CTA).
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const TEMPLATES = [
  "hvac-city-page-template.html",
  "plumbing-city-page-template.html",
  "electrical-city-page-template.html",
  "solar-city-page-template.html",
  "kitchen-city-page-template.html",
  "window-city-page-template.html",
  "siding-city-page-template.html",
  "painting-city-page-template.html",
  "garage-door-city-page-template.html",
  "fencing-city-page-template.html",
  "concrete-city-page-template.html",
  "landscaping-city-page-template.html",
  "foundation-city-page-template.html",
  "insulation-city-page-template.html",
  "gutters-city-page-template.html",
];

// Match any <section class="section">…</section> block whose body contains
// a <ul class="factor-list">. Non-greedy, single block at a time.
const re = /<section class="section">\s*\n(\s*<h2>[^<]*<\/h2>\s*\n\s*<ul class="factor-list">[\s\S]*?<\/ul>\s*)\n<\/section>/g;

function patchTemplate(file) {
  const full = path.join(ROOT, "templates", file);
  let src = fs.readFileSync(full, "utf8");
  const before = src;
  let count = 0;
  src = src.replace(re, (whole, body) => {
    count++;
    // Pull the h2 title for the aria-label
    const h2Match = body.match(/<h2>([^<]+)<\/h2>/);
    const aria = h2Match
      ? h2Match[1].replace(/\{\{[A-Z_]+\}\}/g, "").trim()
      : "Factors";
    return `<aside class="factor-list-aside" aria-label="${aria}">\n${body}\n</aside>`;
  });
  if (src === before) return { skipped: true };
  fs.writeFileSync(full, src);
  return { patched: true, count };
}

function main() {
  console.log("Phase 4 follow-up: wrap factor-list sections in <aside>");
  console.log("-".repeat(72));
  for (const f of TEMPLATES) {
    const r = patchTemplate(f);
    if (r.skipped) console.log("SKIP  " + f + " (no factor-list sections, or already wrapped)");
    else console.log("OK    " + f + "  wrapped: " + r.count);
  }
}
main();
