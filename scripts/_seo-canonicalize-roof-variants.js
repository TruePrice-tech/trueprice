#!/usr/bin/env node
// Consolidate ALL roof-material-variant pages (~5,920) to canonical at
// /{city}-{state}-roof-cost.html instead of self.
//
// Why: GSC "Discovered - currently not indexed" bucket (2026-05-31) was
// dominated by ~3,440 roof-material-variant pages that Google had found
// via internal links but refused to index because each templated variant
// was self-canonicalizing, competing with the city's main roof page for
// the same intent. Re-pointing canonical at the city page consolidates
// ranking equity onto the page Google already indexes.
//
// Lane 2026-05-31: ship all 8 materials nationwide, no pilot. Accepted
// risk: any currently-indexed variant ranking on long-tail "{material}
// roof cost {city}" queries transfers that signal to the city page; if
// the city page is thin on that material, slight relevance drop.
//
// Safeguards (unchanged from how every mass-edit on this repo runs):
//   - Requires _handwritten-guard.js so fs.writeFileSync skips
//     HANDWRITTEN-PROTECTED files (memory: marker enforcement stack).
//   - Only rewrites SELF-canonicals. Files where canonical already points
//     elsewhere are left alone.
//   - Skips if the target /{city}-{state}-roof-cost.html doesn't exist.
//   - Dry-run by default; pass --apply to write.
//   - Content is untouched — only the href inside <link rel="canonical">
//     changes. Uniqueness audit measures rendered text and is unaffected.

require("./_handwritten-guard.js");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APPLY = process.argv.includes("--apply");

const MATERIALS = ["architectural", "asphalt", "metal", "slate", "tile", "flat", "cedar", "concrete"];
const VARIANT_RE = new RegExp(`^(${MATERIALS.join("|")})-roof-cost-(.+)-([a-z]{2})\\.html$`);
const CANON_RE = /(<link\s+rel=["']canonical["']\s+href=["'])([^"']+)(["'][^>]*>)/i;

function slugFromHref(href) {
  return href.replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "");
}

const files = fs.readdirSync(ROOT).filter(f => VARIANT_RE.test(f));
console.log(`Roof-variant candidates across ${MATERIALS.length} materials: ${files.length}`);

const counters = {
  rewrote: 0,
  skipMissingTarget: 0,
  skipNonSelfCanon: 0,
  skipNoCanon: 0,
  skipProtected: 0,
};
const byMaterial = Object.fromEntries(MATERIALS.map(m => [m, 0]));
const skipLog = [];

for (const f of files) {
  const m = f.match(VARIANT_RE);
  const material = m[1], city = m[2], state = m[3];
  const target = `${city}-${state}-roof-cost.html`;
  const targetPath = path.join(ROOT, target);

  if (!fs.existsSync(targetPath)) {
    counters.skipMissingTarget++;
    if (skipLog.length < 20) skipLog.push(`SKIP-NO-TARGET ${f} (would need ${target})`);
    continue;
  }

  const fp = path.join(ROOT, f);
  const html = fs.readFileSync(fp, "utf8");

  if (html.slice(0, 4096).includes("HANDWRITTEN-PROTECTED")) {
    counters.skipProtected++;
    if (skipLog.length < 20) skipLog.push(`SKIP-PROTECTED ${f}`);
    continue;
  }

  const canon = html.match(CANON_RE);
  if (!canon) {
    counters.skipNoCanon++;
    if (skipLog.length < 20) skipLog.push(`SKIP-NO-CANON ${f}`);
    continue;
  }

  const currentSlug = slugFromHref(canon[2]);
  if (currentSlug !== f) {
    counters.skipNonSelfCanon++;
    if (skipLog.length < 20) skipLog.push(`SKIP-NON-SELF ${f} (canon=${canon[2]})`);
    continue;
  }

  const newHref = `/${target}`;
  const next = html.replace(CANON_RE, `$1${newHref}$3`);
  if (next === html) continue;

  if (APPLY) fs.writeFileSync(fp, next);
  counters.rewrote++;
  byMaterial[material]++;
}

console.log("\n=== Summary ===");
console.log(JSON.stringify(counters, null, 2));
console.log("\nRewrites per material:");
for (const m of MATERIALS) console.log(`  ${m.padEnd(15)} ${byMaterial[m]}`);
console.log(`\nMode: ${APPLY ? "APPLY (changes written)" : "DRY RUN (use --apply to write)"}`);
if (skipLog.length) {
  console.log(`\nFirst ${skipLog.length} skip examples:`);
  skipLog.forEach(l => console.log("  " + l));
}
