#!/usr/bin/env node
/**
 * audit-vertical-cities-uniqueness.js
 *
 * Pairwise prose-uniqueness audit for the 18 Phase A.1 vertical-cities
 * directory pages. They share an identical state-grouped structure by
 * design — differentiation lives in the intro paragraph + metadata.
 *
 * The check: extract the intro (first <p> after the H1) from each page,
 * tokenize, compute pairwise Jaccard similarity. The plan's hard gate
 * is "<40% pairwise similarity on intro prose" (= ≥60% unique). Lane's
 * tighter requirement is ≥80% unique, i.e. pairwise similarity must be
 * ≤20%.
 *
 * Hard fail: any pair > 20%.
 * Warn:      any pair > 15%.
 *
 * Usage: node scripts/audit-vertical-cities-uniqueness.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Stop words that don't differentiate technical writing.
const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "of", "for", "to", "in", "on",
  "at", "by", "with", "is", "are", "was", "were", "be", "been", "being",
  "as", "that", "this", "these", "those", "it", "its", "their", "they",
  "from", "than", "which", "what", "when", "where", "while", "also",
  "more", "most", "less", "least", "some", "any", "all", "every", "each",
  "into", "onto", "over", "under", "between", "across", "through", "per",
  "vs", "you", "your", "us", "we", "our", "below", "above", "before",
  "after", "during", "without", "within", "around", "up", "down", "out",
  "off", "do", "does", "did", "have", "has", "had", "can", "could",
  "would", "should", "will", "shall", "may", "might", "must", "not",
  "no", "yes", "only", "even", "still", "just", "such", "very", "much",
  "many", "few", "if", "then", "otherwise", "however", "though",
  "because", "since", "due", "but", "so", "yet"
]);

function extractIntro(html) {
  // Find the first <p> element AFTER the <h1>. Skip any subtitle paragraph
  // with style=font-size:14px (the "X cities across Y states" line).
  const h1Idx = html.indexOf("<h1>");
  if (h1Idx < 0) return "";
  const after = html.slice(h1Idx);

  const pRe = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g;
  const candidates = [];
  let m;
  while ((m = pRe.exec(after)) !== null) {
    const open = m[0].slice(0, m[0].indexOf(">") + 1);
    const text = m[1];
    if (open.includes("font-size:14px")) continue; // subtitle
    if (text.includes("<strong>Related:")) continue;
    if (text.length < 80) continue; // too short, probably not an intro
    candidates.push(text);
    if (candidates.length >= 1) break;
  }
  return candidates[0] || "";
}

function tokenize(text) {
  // Strip tags + entities, lowercase, split on non-alphanumeric.
  const stripped = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/&#\d+;/g, " ")
    .toLowerCase();
  const words = stripped.split(/[^a-z0-9]+/).filter(Boolean);
  return new Set(
    words.filter((w) => w.length >= 3 && !STOP.has(w))
  );
}

function jaccard(a, b) {
  const aArr = [...a];
  const bArr = [...b];
  const inter = aArr.filter((x) => b.has(x)).length;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function main() {
  const all = fs.readdirSync(ROOT).filter((f) => f.endsWith("-cities.html"));
  if (all.length === 0) {
    console.error("No *-cities.html files found.");
    process.exit(1);
  }
  // Filter to phase-A vertical directories (exclude all-cities.html).
  const verticals = all.filter((f) => f !== "all-cities.html");

  const intros = {};
  for (const f of verticals) {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    const intro = extractIntro(html);
    if (!intro) {
      console.warn(`⚠️  No intro extracted from ${f}`);
      continue;
    }
    intros[f] = { text: intro, tokens: tokenize(intro) };
  }

  const names = Object.keys(intros).sort();
  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const sim = jaccard(intros[names[i]].tokens, intros[names[j]].tokens);
      pairs.push({ a: names[i], b: names[j], sim });
    }
  }
  pairs.sort((x, y) => y.sim - x.sim);

  console.log("=".repeat(75));
  console.log("Pairwise Jaccard similarity — Phase A.1 directory intros");
  console.log("=".repeat(75));
  console.log(`Pages audited: ${names.length}`);
  console.log(`Pairs computed: ${pairs.length}`);
  console.log("");
  console.log("Top 15 most-similar pairs:");
  console.log("");
  for (const p of pairs.slice(0, 15)) {
    const pct = (p.sim * 100).toFixed(1);
    console.log(`  ${pct.padStart(5)}%  ${p.a}  ↔  ${p.b}`);
  }

  const max = pairs[0]?.sim || 0;
  const warns = pairs.filter((p) => p.sim > 0.15);
  const fails = pairs.filter((p) => p.sim > 0.20);

  console.log("");
  console.log(`Max pairwise similarity: ${(max * 100).toFixed(1)}%`);
  console.log(`Pairs > 15% (warn):   ${warns.length}`);
  console.log(`Pairs > 20% (FAIL):   ${fails.length}`);
  console.log("");

  if (fails.length > 0) {
    console.log("❌ FAIL: pairwise similarity exceeds 20% on " + fails.length + " pair(s).");
    console.log("   Hard requirement: ≥80% unique = ≤20% pairwise. Rewrite intros on:");
    fails.slice(0, 5).forEach((p) => {
      console.log(`     - ${p.a} ↔ ${p.b} (${(p.sim * 100).toFixed(1)}%)`);
    });
    process.exit(1);
  }
  if (warns.length > 0) {
    console.log("⚠️  WARN: " + warns.length + " pair(s) above 15% but below 20%.");
    process.exit(0);
  }
  console.log("✅ PASS: all pairs ≤15% similarity (well above 80% unique floor).");
  process.exit(0);
}

main();
