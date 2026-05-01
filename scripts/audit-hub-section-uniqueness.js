#!/usr/bin/env node
/**
 * audit-hub-section-uniqueness.js
 *
 * Pairwise similarity audit for hub-page city-link sections. Guards against
 * the "21 hub guides all sound identical" failure mode that would crater
 * uniqueness scores and trigger Google's templated-content penalty.
 *
 * How it works:
 * 1. Find every *-cost-guide.html (+ roof-cost-calculator.html, guides.html)
 *    in repo root that contains the city-link section markers.
 * 2. Extract the text between <!-- HUB-CITY-LINKS:START --> and
 *    <!-- HUB-CITY-LINKS:END -->.
 * 3. Strip HTML tags, US city names, state codes, dollar amounts, integers,
 *    and a few vertical-specific words. What remains is templated prose.
 * 4. Build 5-character shingles from that residue, compute Jaccard similarity
 *    for every hub pair, and report.
 *
 * Exit code 1 if any pair exceeds the threshold (default 35%). Threshold is
 * deliberately strict: city-prefixed prose with shared boilerplate hits
 * ~50-70%; genuinely-varied prose hits 10-25%.
 *
 * Usage:
 *   node scripts/audit-hub-section-uniqueness.js              # 35% threshold
 *   node scripts/audit-hub-section-uniqueness.js --max 30     # custom
 *   node scripts/audit-hub-section-uniqueness.js --verbose    # show top pairs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const START_MARK = "<!-- HUB-CITY-LINKS:START -->";
const END_MARK = "<!-- HUB-CITY-LINKS:END -->";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const maxIdx = args.indexOf("--max");
const THRESHOLD = maxIdx >= 0 ? parseFloat(args[maxIdx + 1]) / 100 : 0.35;
const SHINGLE_SIZE = 5;

const HUB_PATTERNS = [
  /-cost-guide\.html$/,
  /^roof-cost-calculator\.html$/,
  /^guides\.html$/,
];

function findHubs() {
  return fs.readdirSync(ROOT).filter(f => HUB_PATTERNS.some(p => p.test(f)));
}

function extractSection(html) {
  const start = html.indexOf(START_MARK);
  const end = html.indexOf(END_MARK);
  if (start < 0 || end < 0 || end < start) return null;
  return html.slice(start + START_MARK.length, end);
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");
}

const STATE_CODES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY";

function normalize(text) {
  let t = text.toLowerCase();
  t = t.replace(/\$[\d,]+(?:[\-–—]\$?[\d,]+)?/g, "PRICE");
  t = t.replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\b/g, "NUM");
  t = t.replace(new RegExp(`\\b(${STATE_CODES})\\b`, "gi"), "STATE");
  // Strip common multi-word city names + any "city, st" pattern remnant.
  t = t.replace(/\b(new york|los angeles|san francisco|san diego|las vegas|san antonio|san jose|fort worth|el paso|oklahoma city|colorado springs|washington dc|salt lake city|kansas city|virginia beach|long beach|new orleans|st\.? louis|st\.? paul|st\.? petersburg|saint louis|saint paul|jersey city)\b/g, "CITY");
  // Strip single-token capitalized place-words (anything left looking like a proper noun won't survive lowercasing — handled above).
  // Collapse whitespace.
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function shingles(text, n = SHINGLE_SIZE) {
  const set = new Set();
  if (text.length < n) {
    set.add(text);
    return set;
  }
  for (let i = 0; i <= text.length - n; i++) set.add(text.slice(i, i + n));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function main() {
  const hubs = findHubs();
  const sections = {};

  for (const hub of hubs) {
    const html = fs.readFileSync(path.join(ROOT, hub), "utf8");
    const raw = extractSection(html);
    if (!raw) continue;
    const stripped = stripHtml(raw);
    const norm = normalize(stripped);
    sections[hub] = { norm, sh: shingles(norm) };
  }

  const names = Object.keys(sections);
  if (names.length === 0) {
    console.log("No hub city-link sections found (no markers present yet). Nothing to compare.");
    process.exit(0);
  }
  if (names.length === 1) {
    console.log(`Only 1 hub has a city-link section (${names[0]}). Nothing to compare yet.`);
    process.exit(0);
  }

  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const sim = jaccard(sections[names[i]].sh, sections[names[j]].sh);
      pairs.push({ a: names[i], b: names[j], sim });
    }
  }
  pairs.sort((p, q) => q.sim - p.sim);

  const failing = pairs.filter(p => p.sim > THRESHOLD);
  const showCount = verbose ? pairs.length : Math.min(10, pairs.length);

  console.log("=".repeat(80));
  console.log(`HUB CITY-LINK SECTION SIMILARITY AUDIT`);
  console.log(`Threshold: ${(THRESHOLD * 100).toFixed(0)}% | Hubs with sections: ${names.length} | Pairs: ${pairs.length}`);
  console.log("=".repeat(80));

  if (pairs.length > 0) {
    console.log(`\nTop ${showCount} most-similar pairs:`);
    for (let i = 0; i < showCount; i++) {
      const p = pairs[i];
      const flag = p.sim > THRESHOLD ? " ❌ FAIL" : (p.sim > THRESHOLD * 0.8 ? " ⚠️  near threshold" : "");
      console.log(`  ${(p.sim * 100).toFixed(1).padStart(5)}%  ${p.a}  vs  ${p.b}${flag}`);
    }
  }

  if (failing.length > 0) {
    console.log(`\n❌ ${failing.length} hub pair(s) exceed ${(THRESHOLD * 100).toFixed(0)}% similarity. Hand-edit varied prose required.`);
    process.exit(1);
  }
  console.log(`\n✅ All ${pairs.length} pair(s) below ${(THRESHOLD * 100).toFixed(0)}% similarity.`);
  process.exit(0);
}

main();
