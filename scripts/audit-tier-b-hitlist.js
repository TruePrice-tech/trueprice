#!/usr/bin/env node
/**
 * audit-tier-b-hitlist.js
 *
 * Tier B = the 16 trade verticals whose city pages failed the Google-standard
 * uniqueness audit (composite <60%). Produces an actionable hit-list:
 *
 *   1. Per-vertical: top N boilerplate sentences (rank by % of sampled pages)
 *   2. Per-vertical: top FAQ questions appearing on ≥50% of sampled pages
 *   3. Cross-vertical: sentences appearing as boilerplate in ≥3 verticals
 *      (these are global widget/CTA leaks that pollute every Tier B vertical)
 *
 * Sample: n=100 per vertical, random seeded.
 * Output: console + output/audits/tier-b-hitlist-<date>.json
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const SAMPLE = 100;
const SEED = 20260522;

const TIER_B = [
  { name: "hvac", pattern: "-hvac-cost.html" },
  { name: "roof", pattern: "-roof-cost.html" },
  { name: "plumbing", pattern: "-plumbing-cost.html" },
  { name: "electrical", pattern: "-electrical-cost.html" },
  { name: "solar", pattern: "-solar-cost.html" },
  { name: "kitchen", pattern: "-kitchen-remodel-cost.html" },
  { name: "window", pattern: "-window-cost.html" },
  { name: "siding", pattern: "-siding-cost.html" },
  { name: "painting", pattern: "-painting-cost.html" },
  { name: "garage-door", pattern: "-garage-door-cost.html" },
  { name: "fence", pattern: "-fence-cost.html" },
  { name: "concrete", pattern: "-concrete-cost.html" },
  { name: "landscaping", pattern: "-landscaping-cost.html" },
  { name: "foundation", pattern: "-foundation-cost.html" },
  { name: "insulation", pattern: "-insulation-cost.html" },
  { name: "gutter", pattern: "-gutter-cost.html" },
];

const STATE_NAMES = new Set([
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut",
  "delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa",
  "kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan",
  "minnesota","mississippi","missouri","montana","nebraska","nevada","new-hampshire",
  "new-jersey","new-mexico","new-york","north-carolina","north-dakota","ohio",
  "oklahoma","oregon","pennsylvania","rhode-island","south-carolina","south-dakota",
  "tennessee","texas","utah","vermont","virginia","washington","west-virginia",
  "wisconsin","wyoming",
]);

function isStateHubFile(filename, pattern) {
  const prefix = filename.replace(pattern, "");
  return STATE_NAMES.has(prefix);
}

function rng(seed) {
  let a = seed >>> 0;
  return function() {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(arr, n, seed) {
  const r = rng(seed);
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function extractBody(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let text = bodyMatch ? bodyMatch[1] : html;
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ");
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ");
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ");
  text = text.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  return text;
}

function extractFAQItems(html) {
  // Return [{ q, a }] arrays per page
  const items = [];
  const re = /<details\b[^>]*class="[^"]*faq-item[^"]*"[^>]*>([\s\S]*?)<\/details>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1];
    const qm = inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    const am = inner.match(/<div\b[^>]*class="[^"]*faq-answer[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const q = qm ? stripToText(qm[1]) : "";
    const a = am ? stripToText(am[1]) : "";
    if (q) items.push({ q, a });
  }
  return items;
}

function stripToText(htmlFragment) {
  return htmlFragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&\w+;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 400);
}

function parseCityState(filename, pattern) {
  const prefix = filename.replace(pattern, "");
  const parts = prefix.split("-");
  const stateCode = parts.pop().toUpperCase();
  const cityName = parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { cityName, stateCode };
}

function normalizeSentence(sentence, cityName, stateCode) {
  let s = sentence.toLowerCase();
  if (cityName) {
    s = s.replace(new RegExp(cityName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "CITY");
  }
  s = s.replace(new RegExp("\\b" + stateCode.toLowerCase() + "\\b", "g"), "ST");
  s = s.replace(/\$[\d,.]+[km]?/gi, "DOLLAR");
  s = s.replace(/\d+(\.\d+)?%/g, "PCT");
  s = s.replace(/\b\d[\d,.]*\b/g, "NUM");
  return s.trim();
}

function shortHash(s) {
  return crypto.createHash("md5").update(s).digest("hex").slice(0, 12);
}

function analyzeVertical(v) {
  const all = fs.readdirSync(ROOT).filter(
    (f) => f.endsWith(v.pattern) && !isStateHubFile(f, v.pattern)
  );
  const picked = sample(all, Math.min(SAMPLE, all.length), SEED ^ v.name.length);

  const pages = [];
  for (const f of picked) {
    try {
      const html = fs.readFileSync(path.join(ROOT, f), "utf8");
      const { cityName, stateCode } = parseCityState(f, v.pattern);
      const bodyText = stripToText(extractBody(html));
      const sents = extractSentences(bodyText);
      const normMap = new Map(); // normalized -> first raw example
      for (const s of sents) {
        const n = normalizeSentence(s, cityName, stateCode);
        if (!normMap.has(n)) normMap.set(n, s);
      }
      const faq = extractFAQItems(html);
      pages.push({ file: f, cityName, stateCode, normSet: normMap, faq });
    } catch (e) {}
  }

  // Count distinct normalized sentence appearances across pages
  const sentCount = new Map(); // norm -> count
  const sentExample = new Map(); // norm -> example raw
  for (const p of pages) {
    for (const [n, raw] of p.normSet) {
      sentCount.set(n, (sentCount.get(n) || 0) + 1);
      if (!sentExample.has(n)) sentExample.set(n, raw);
    }
  }

  // Top 15 boilerplate (appearing on ≥50% pages, sorted by count)
  const half = Math.max(2, Math.floor(pages.length * 0.5));
  const boilerplate = Array.from(sentCount.entries())
    .filter(([, c]) => c >= half)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([n, c]) => ({
      pct: Math.round((c / pages.length) * 100),
      count: c,
      example: sentExample.get(n),
      normHash: shortHash(n),
    }));

  // FAQ Q hit-list: normalize Qs, count appearances on ≥50% pages
  const qCount = new Map(); // normQ -> count
  const qExample = new Map(); // normQ -> { q, a }
  for (const p of pages) {
    const seen = new Set();
    for (const item of p.faq) {
      const n = item.q
        .toLowerCase()
        .replace(new RegExp(p.cityName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "CITY")
        .replace(/\b\d[\d,.]*\b/g, "NUM")
        .replace(/\s+/g, " ")
        .trim();
      if (!n) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      qCount.set(n, (qCount.get(n) || 0) + 1);
      if (!qExample.has(n)) qExample.set(n, item);
    }
  }
  const faqHits = Array.from(qCount.entries())
    .filter(([, c]) => c >= half)
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => ({
      pct: Math.round((c / pages.length) * 100),
      count: c,
      question: qExample.get(n).q,
      answerPreview: (qExample.get(n).a || "").slice(0, 180),
    }));

  return {
    vertical: v.name,
    totalFiles: all.length,
    sampled: pages.length,
    boilerplate,
    faqHits,
    boilerplateHashes: boilerplate.map((b) => b.normHash),
  };
}

function main() {
  console.log("=".repeat(110));
  console.log("TIER B CHECK  —  16 trade verticals, n=" + SAMPLE + "/vertical");
  console.log("=".repeat(110));

  const results = [];
  for (const v of TIER_B) {
    process.stderr.write(`scanning ${v.name}…\n`);
    results.push(analyzeVertical(v));
  }

  // Cross-vertical boilerplate: same normalized sentence hash appearing as boilerplate in ≥3 verticals
  const crossCounts = new Map(); // hash -> { count, examples: [vertical] }
  const hashToExample = new Map();
  for (const r of results) {
    for (const b of r.boilerplate) {
      const cur = crossCounts.get(b.normHash) || { verticals: [] };
      cur.verticals.push({ v: r.vertical, pct: b.pct });
      crossCounts.set(b.normHash, cur);
      if (!hashToExample.has(b.normHash)) hashToExample.set(b.normHash, b.example);
    }
  }
  const crossHits = Array.from(crossCounts.entries())
    .filter(([, v]) => v.verticals.length >= 3)
    .sort((a, b) => b[1].verticals.length - a[1].verticals.length)
    .map(([h, v]) => ({
      verticalCount: v.verticals.length,
      verticals: v.verticals.map((x) => `${x.v}(${x.pct}%)`).join(", "),
      example: hashToExample.get(h),
    }));

  console.log("\n--- CROSS-VERTICAL BOILERPLATE ---");
  console.log("Strings appearing as boilerplate (≥50% of pages) in ≥3 verticals.");
  console.log("These are global widget/CTA leaks — fixing them lifts every Tier B vertical at once.\n");
  console.log(`Found ${crossHits.length} cross-vertical boilerplate strings.\n`);
  for (let i = 0; i < Math.min(20, crossHits.length); i++) {
    const h = crossHits[i];
    console.log(`[${h.verticalCount} verticals]  "${h.example.slice(0, 130)}"`);
    console.log(`    seen in: ${h.verticals}\n`);
  }

  console.log("\n--- PER-VERTICAL BOILERPLATE HIT-LIST (full body, top 15 sentences) ---\n");
  for (const r of results) {
    console.log(`\n### ${r.vertical.toUpperCase()}  (${r.totalFiles} pages, sampled ${r.sampled})`);
    if (r.boilerplate.length === 0) {
      console.log("  (no sentences hit the ≥50% threshold)");
      continue;
    }
    for (const b of r.boilerplate) {
      console.log(`  ${String(b.pct + "%").padStart(4)}  "${b.example.slice(0, 140)}"`);
    }
  }

  console.log("\n\n--- PER-VERTICAL FAQ QUESTION HIT-LIST  (Qs appearing on ≥50% of pages) ---\n");
  for (const r of results) {
    console.log(`\n### ${r.vertical.toUpperCase()}`);
    if (r.faqHits.length === 0) {
      console.log("  (no FAQ questions hit the ≥50% threshold)");
      continue;
    }
    for (const f of r.faqHits) {
      console.log(`  ${String(f.pct + "%").padStart(4)}  Q: "${f.question}"`);
      if (f.answerPreview) {
        console.log(`         A: "${f.answerPreview}${f.answerPreview.length >= 180 ? "…" : ""}"`);
      }
    }
  }

  // Priority ranking: verticals where killing cross-vertical+local boilerplate gives biggest lift
  const ranking = results.map((r) => {
    const localBoilerCount = r.boilerplate.length;
    const faqHitCount = r.faqHits.length;
    return { vertical: r.vertical, totalFiles: r.totalFiles, localBoilerCount, faqHitCount };
  }).sort((a, b) => (b.localBoilerCount + b.faqHitCount) - (a.localBoilerCount + a.faqHitCount));

  console.log("\n\n--- FIX-PRIORITY RANKING (highest = most boilerplate to remove) ---\n");
  console.log("Vertical".padEnd(14) + " | " + "Files".padStart(5) + " | " + "BoilerSents".padStart(11) + " | " + "FAQ-Qs".padStart(6));
  console.log("-".repeat(50));
  for (const r of ranking) {
    console.log(
      r.vertical.padEnd(14) + " | " +
      String(r.totalFiles).padStart(5) + " | " +
      String(r.localBoilerCount).padStart(11) + " | " +
      String(r.faqHitCount).padStart(6)
    );
  }

  const outDir = path.join(ROOT, "output", "audits");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `tier-b-hitlist-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    sampledAt: stamp,
    sampleSize: SAMPLE,
    crossHits,
    results,
    ranking,
  }, null, 2));
  console.log(`\nJSON written: ${path.relative(ROOT, outPath)}`);
}

main();
