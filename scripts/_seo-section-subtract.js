#!/usr/bin/env node
/**
 * Section-subtraction diagnostic. Strips each templated section in isolation
 * and re-measures uniqueness to identify which sections cost the most
 * uniqueness vs which are pulling their weight.
 *
 * Usage:
 *   node _seo-section-subtract.js <glob> [sample]
 *
 * Example:
 *   node _seo-section-subtract.js '*-insulation-cost.html' 200
 *
 * Output: ranked table of section -> uniqueness delta when stripped.
 * Higher delta = more shared boilerplate. Drop the worst offenders.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

// Each entry: { name, strip(html) -> html-without-section }
// Order doesn't matter; each strip is applied to a fresh copy of the page.
const SECTIONS = [
  {
    name: "TP-LOCAL-INJECTED-V2 (homeowner's guide prose)",
    re: /<!-- TP-LOCAL-INJECTED-V2 -->[\s\S]*?<\/section>/g,
  },
  {
    name: "TP-LOCAL-INJECTED-V3 (local factors prose)",
    re: /<!-- TP-LOCAL-INJECTED-V3 -->[\s\S]*?<\/section>/g,
  },
  {
    name: "TP-LOCAL-INJECTED-V4 (regional pricing context)",
    re: /<!-- TP-LOCAL-INJECTED-V4 -->[\s\S]*?<\/section>/g,
  },
  {
    name: "TP-LOCAL-INJECTED-V5 (BLS wages)",
    re: /<!-- TP-LOCAL-INJECTED-V5 -->[\s\S]*?<\/section>/g,
  },
  {
    name: "TP-NEARBY-CITIES",
    re: /<!-- TP-NEARBY-CITIES -->[\s\S]*?<\/section>/g,
  },
  {
    name: "TP-INTERNAL-TOOLS-BLOCK",
    re: /<!-- TP-INTERNAL-TOOLS-BLOCK -->[\s\S]*?<!-- \/TP-INTERNAL-TOOLS-BLOCK -->/g,
  },
  {
    name: "tp-city-nav (footer link grid)",
    re: /<(section|nav) class="tp-city-nav"[\s\S]*?<\/\1>/g,
  },
  {
    name: "What affects ... cost (factor-list section)",
    re: /<section class="section">\s*<h2>What (affects|drives) [^<]+<\/h2>\s*<ul class="factor-list">[\s\S]*?<\/section>/g,
  },
  {
    name: "What Should a ... Quote Include (factor-list)",
    re: /<section class="section">\s*<h2>What Should a [^<]+ Quote Include\?<\/h2>\s*<ul class="factor-list">[\s\S]*?<\/section>/g,
  },
  {
    name: "Other projects / Related services / More home services",
    re: /<section class="section">\s*<h2>(Other projects|Related services|More home services) in [^<]+<\/h2>[\s\S]*?<\/section>/g,
  },
  {
    name: "More questions about X (post-fix FAQ section)",
    re: /<section class="section">\s*<h2>More questions about [^<]+<\/h2>[\s\S]*?<\/section>/g,
  },
  {
    name: "Original FAQ section (Questions ... ask about / X FAQ)",
    re: /<section class="section">\s*<h2>(Questions [^<]+ ask about|[^<]+ FAQ|[^<]+ residents ask about|[^<]+ homeowners ask about|[^<]+ answers to common questions)[^<]*<\/h2>[\s\S]*?<\/section>/g,
  },
  {
    name: "TP-NEARBY pricing card section (style margin:32px 0;)",
    re: /<section class="section" style="margin:32px 0;">[\s\S]*?<\/section>/g,
  },
];

function listGlob(pattern) {
  const out = execSync(`git ls-files -- ${JSON.stringify(pattern)}`, { cwd: ROOT, encoding: "utf8" });
  return out.split("\n").filter(Boolean).filter(p => !p.includes("/"));
}

function extractText(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function bigrams(text) {
  const words = text.split(" ").filter(w => w.length > 1);
  const out = new Set();
  for (let i = 0; i < words.length - 1; i++) out.add(words[i] + " " + words[i + 1]);
  return out;
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function avgJac(grams) {
  let sum = 0, pairs = 0;
  for (let i = 0; i < grams.length; i++)
    for (let j = i + 1; j < grams.length; j++) { sum += jaccard(grams[i], grams[j]); pairs++; }
  return pairs === 0 ? 0 : sum / pairs;
}

function uniqPct(htmls) {
  const grams = htmls.map(h => bigrams(extractText(h)));
  return 100 * (1 - avgJac(grams));
}

function sample(arr, n) {
  const out = [], used = new Set();
  while (out.length < n && used.size < arr.length) {
    const i = Math.floor(Math.random() * arr.length);
    if (!used.has(i)) { used.add(i); out.push(arr[i]); }
  }
  return out;
}

function main() {
  const pattern = process.argv[2];
  const N = parseInt(process.argv[3] || "100", 10);
  if (!pattern) { console.error("Usage: node _seo-section-subtract.js <glob> [sample]"); process.exit(1); }

  const files = listGlob(pattern);
  if (files.length < 2) { console.error(`Only ${files.length} files match`); process.exit(1); }
  const picked = sample(files, Math.min(N, files.length));
  const htmls = picked.map(f => fs.readFileSync(path.join(ROOT, f), "utf8"));

  console.log(`Pattern: ${pattern}  total=${files.length}  sample=${picked.length}`);
  const baseline = uniqPct(htmls);
  console.log(`Baseline uniqueness: ${baseline.toFixed(2)}%\n`);

  // For each section, strip from all sampled pages and remeasure.
  const results = [];
  for (const sec of SECTIONS) {
    let strippedCount = 0, totalChars = 0;
    const stripped = htmls.map(h => {
      const matches = h.match(sec.re);
      if (matches) { strippedCount++; totalChars += matches.reduce((a, m) => a + m.length, 0); }
      return h.replace(sec.re, "");
    });
    if (strippedCount === 0) {
      results.push({ name: sec.name, delta: 0, hits: 0, avgChars: 0, note: "(no matches)" });
      continue;
    }
    const u = uniqPct(stripped);
    const delta = u - baseline;
    results.push({
      name: sec.name,
      delta: delta,
      uniq: u,
      hits: strippedCount,
      avgChars: Math.round(totalChars / strippedCount),
    });
  }

  // Cumulative: strip ALL sections together for upper bound.
  const allStripped = htmls.map(h => {
    let out = h;
    for (const sec of SECTIONS) out = out.replace(sec.re, "");
    return out;
  });
  const allU = uniqPct(allStripped);

  results.sort((a, b) => (b.delta || 0) - (a.delta || 0));

  const fmt = (n, w = 6) => (n >= 0 ? "+" : "") + n.toFixed(2).padStart(w);
  const padR = (s, n) => s + " ".repeat(Math.max(0, n - s.length));
  console.log(padR("section", 56) + padR("delta(pp)", 12) + padR("post-strip", 12) + padR("hits/N", 10) + "avg-chars");
  console.log("-".repeat(100));
  for (const r of results) {
    const dStr = r.note ? r.note : fmt(r.delta);
    const uStr = r.note ? "" : r.uniq.toFixed(2) + "%";
    const hStr = r.note ? "" : `${r.hits}/${picked.length}`;
    const cStr = r.note ? "" : String(r.avgChars);
    console.log(padR(r.name, 56) + padR(dStr, 12) + padR(uStr, 12) + padR(hStr, 10) + cStr);
  }
  console.log("-".repeat(100));
  console.log(padR("ALL templated sections stripped (upper bound)", 56) + padR(fmt(allU - baseline), 12) + padR(allU.toFixed(2) + "%", 12));
  console.log(`\n80% gate: ${baseline >= 80 ? "PASS" : "FAIL"} at baseline; ${allU >= 80 ? "PASS" : "FAIL"} at full-strip ceiling.`);
}

main();
