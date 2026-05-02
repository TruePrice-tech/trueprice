#!/usr/bin/env node
/**
 * audit-state-hub-uniqueness.js
 *
 * Phase A.2 pairwise prose-uniqueness audit for state-vertical hub pages
 * (e.g., [state]-roof-cost.html for the roof vertical).
 *
 * State-vertical hub pages share an identical scaffold by design (header,
 * footer, summary cards, related-state list). Differentiation lives in:
 *   - the hero intro paragraph (climate concern + state-specific data)
 *   - the climate/code-drivers section (IECC zone, hurricane/hail/snow,
 *     dominant material)
 *   - the licensing/permits section (state license board, distinctive law)
 *   - the "How costs vary" section (climate concern + distinctive law)
 *   - the "Cities in [State]" section (data-driven, varies per state)
 *
 * Hard gate per Lane's locked guardrail (memory: feedback_phase_a2_pilot_first):
 *   - Plan threshold: <35% pairwise similarity within vertical
 *   - Lane's tighter floor: ≤25% pairwise (≥75% Jaccard-distinct)
 *   - Warn at >20%
 *
 * Audit scope: extract <main>...</main> body content (excludes shared header,
 * shared footer, "More state guides" section, related links). Tokenize, drop
 * stop words, compute pairwise Jaccard.
 *
 * Usage:
 *   node scripts/audit-state-hub-uniqueness.js <vertical>
 *
 * Example:
 *   node scripts/audit-state-hub-uniqueness.js roof
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

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
  "because", "since", "due", "so", "yet"
]);

const VERTICAL_CONFIG = {
  roof: {
    fileSuffix: "-roof-cost.html",
    statePrefixOnly: true,
    skipCityPattern: /^[a-z][a-z0-9-]*-[a-z]{2}-roof-cost\.html$/,
  },
};

function loadStateData(vertical) {
  const file = path.join(ROOT, "data", `state-${vertical}-data.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isStateHubFile(filename, vConf, stateSlugs) {
  if (!filename.endsWith(vConf.fileSuffix)) return false;
  if (vConf.skipCityPattern && vConf.skipCityPattern.test(filename)) return false;
  const stem = filename.replace(new RegExp(vConf.fileSuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "");
  return stateSlugs.has(stem);
}

function extractContent(html) {
  // Take main body content only; exclude header, footer, related-state nav,
  // tools block, and the "More state guides" boilerplate which is identical
  // across all pages by design.
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  let text = mainMatch ? mainMatch[1] : html;
  // Strip the "More state guides" related-links section (identical structure).
  text = text.replace(/<section[^>]*>\s*<h2>More state guides<\/h2>[\s\S]*?<\/section>/gi, " ");
  // Strip the tp-tools-block (identical across pages).
  text = text.replace(/<!-- TP-INTERNAL-TOOLS-BLOCK -->[\s\S]*?<!-- \/TP-INTERNAL-TOOLS-BLOCK -->/gi, " ");
  // Strip CTA box (identical text except state name in last sentence).
  // Strip script and style tags.
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  // Strip HTML tags.
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&[a-z]+;/g, " ");
  text = text.replace(/&#\d+;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function tokenize(text, stateName, stateAbbr) {
  // Lowercase. Strip the state name itself (don't let "California California
  // California" pad the token set with one matchable word).
  let normalized = text.toLowerCase();
  if (stateName) normalized = normalized.split(stateName.toLowerCase()).join(" ");
  if (stateAbbr) {
    // Match standalone state abbr only (avoid hitting things like "alaska" via "ak")
    normalized = normalized.replace(new RegExp(`\\b${stateAbbr.toLowerCase()}\\b`, "g"), " ");
  }
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  return new Set(words.filter((w) => w.length >= 3 && !STOP.has(w)));
}

function jaccard(a, b) {
  const aArr = [...a];
  const inter = aArr.filter((x) => b.has(x)).length;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function main() {
  const vertical = process.argv[2];
  if (!vertical) {
    console.error("Usage: node scripts/audit-state-hub-uniqueness.js <vertical>");
    process.exit(2);
  }
  const vConf = VERTICAL_CONFIG[vertical];
  if (!vConf) {
    console.error(`No config for vertical "${vertical}".`);
    process.exit(2);
  }

  const stateData = loadStateData(vertical);
  const stateKeys = Object.keys(stateData).filter((k) => !k.startsWith("_"));
  const stateSlugs = new Set(stateKeys.map((k) => stateData[k].slug));

  const allFiles = fs.readdirSync(ROOT).filter((f) => isStateHubFile(f, vConf, stateSlugs));

  const data = {};
  for (const f of allFiles) {
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    const stem = f.replace(new RegExp(vConf.fileSuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "");
    const stateAbbr = Object.keys(stateData).find(
      (k) => !k.startsWith("_") && stateData[k].slug === stem
    );
    if (!stateAbbr) continue;
    const stateName = stateData[stateAbbr].name;
    const text = extractContent(html);
    data[f] = {
      text,
      tokens: tokenize(text, stateName, stateAbbr),
      tokenCount: 0,
    };
    data[f].tokenCount = data[f].tokens.size;
  }

  const names = Object.keys(data).sort();
  if (names.length === 0) {
    console.error("No state-hub files found.");
    process.exit(1);
  }
  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const sim = jaccard(data[names[i]].tokens, data[names[j]].tokens);
      pairs.push({ a: names[i], b: names[j], sim });
    }
  }
  pairs.sort((x, y) => y.sim - x.sim);

  const tokenCounts = names.map((n) => data[n].tokenCount);
  const avgTokens = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
  const minTokens = Math.min(...tokenCounts);
  const maxTokens = Math.max(...tokenCounts);

  console.log("=".repeat(75));
  console.log(`Phase A.2 state-hub pairwise audit — vertical: ${vertical}`);
  console.log("=".repeat(75));
  console.log(`Pages audited: ${names.length}`);
  console.log(`Pairs computed: ${pairs.length}`);
  console.log(`Token-set size: avg ${avgTokens.toFixed(0)}, min ${minTokens}, max ${maxTokens}`);
  console.log("");
  console.log("Top 15 most-similar pairs:");
  for (const p of pairs.slice(0, 15)) {
    const pct = (p.sim * 100).toFixed(1);
    console.log(`  ${pct.padStart(5)}%  ${p.a}  ↔  ${p.b}`);
  }
  console.log("");

  const max = pairs[0]?.sim || 0;
  const warns = pairs.filter((p) => p.sim > 0.20);
  const fails = pairs.filter((p) => p.sim > 0.25);

  console.log(`Max pairwise similarity: ${(max * 100).toFixed(1)}%`);
  console.log(`Pairs > 20% (warn):   ${warns.length}`);
  console.log(`Pairs > 25% (FAIL):   ${fails.length}`);
  console.log("");

  if (fails.length > 0) {
    console.log(`❌ FAIL: pairwise similarity exceeds 25% on ${fails.length} pair(s).`);
    console.log("   Lane's hard floor: ≤25% pairwise. Per-state data dictionary needs more differentiation on:");
    fails.slice(0, 8).forEach((p) => {
      console.log(`     - ${p.a} ↔ ${p.b} (${(p.sim * 100).toFixed(1)}%)`);
    });
    process.exit(1);
  }
  if (warns.length > 0) {
    console.log(`⚠️  WARN: ${warns.length} pair(s) above 20% but below 25%.`);
    process.exit(0);
  }
  console.log(`✅ PASS: all pairs ≤20% similarity (well above 75% Jaccard-distinct floor).`);
  process.exit(0);
}

main();
