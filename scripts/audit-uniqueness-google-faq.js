#!/usr/bin/env node
/**
 * audit-uniqueness-google-faq.js
 *
 * Google-aligned uniqueness audit covering BOTH:
 *   1. Full city page body (header/nav/footer/form stripped)
 *   2. FAQ accordion section only (<details class="faq-item">)
 *
 * Same 4-axis scoring as audit-uniqueness-google.js:
 *   - Template ratio (30%)  — sentences shared across 50%+ of sampled pages
 *   - Semantic uniqueness (30%) — pairwise sentence-hash Jaccard
 *   - Information density (20%) — city-specific named entities per 1000 words
 *   - Structural diversity (20%) — distinct headings (full) or distinct Q-stems (FAQ)
 *
 * Sample size: 60 pages per vertical (random seeded), pairwise comparison.
 * Outputs console table + JSON to output/audits/uniqueness-google-faq-<date>.json
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const SAMPLE = 60;
const SEED = 20260522;

// Phase 5 regression floors — initial set 2026-05-22 after Phase 3 shipped,
// ratcheted same day twice: once after Phase 4 body-wrap pass, again after
// Phase 4 Q-stem variation. NON-aspirational; they protect the
// data-binding + Q-stem work from regression. Ratchet up when a phase
// ships a meaningful lift; do NOT ratchet from short-term noise.
//
//   Per-vertical FAQ-slice composite >= 70% (ratcheted from 60%).
//     ALL 16 Tier B verticals now GOOD on FAQ slice. Min: roof 74%,
//     garage-door 74% (4pp buffer).
//   Page-weighted FAQ-slice composite >= 78% (ratcheted from 76%).
//     Current: 82% (4pp buffer).
//   Page-weighted FULL-body composite >= 72% (unchanged).
//     Current: 76% (4pp buffer). roof + garage-door still 67%/69% so
//     can't ratchet per-vertical FULL floor without breaking them.
//
// Tier A verticals (auto-repair/medical/legal/moving) are excluded from
// the per-vertical FAQ-floor check — they pre-date this remediation and
// score 86-100%, so any drop is flagged through the page-weighted gate.
const GATE_FLOORS = {
  perVerticalFAQMin: 70,
  pageWeightedFAQMin: 78,
  pageWeightedFullMin: 72,
};
const TIER_A_VERTICALS = new Set(["auto-repair", "medical", "legal", "moving"]);

const VERTICALS = [
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
  { name: "auto-repair", pattern: "-auto-repair-cost.html" },
  { name: "medical", pattern: "-medical-cost.html" },
  { name: "legal", pattern: "-legal-cost.html" },
  { name: "moving", pattern: "-moving-cost.html" },
];

// State-hub files end with "<state>-<vertical>-cost.html" without a city prefix;
// exclude from the city-page corpus to keep the comparison apples-to-apples.
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
  if (STATE_NAMES.has(prefix)) return true;
  for (const s of STATE_NAMES) {
    if (prefix === s) return true;
  }
  return false;
}

// Seeded RNG (mulberry32) for reproducible sampling
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
  text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, " ");
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ");
  text = text.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  return text;
}

function extractFAQBlock(html) {
  // Concatenate all <details class="faq-item">…</details> blocks (one document's FAQ section)
  const re = /<details\b[^>]*class="[^"]*faq-item[^"]*"[^>]*>([\s\S]*?)<\/details>/gi;
  const parts = [];
  let m;
  while ((m = re.exec(html)) !== null) parts.push(m[1]);
  if (!parts.length) {
    // Fallback: <div class="faq-list">…</div>
    const wrap = html.match(/<div\b[^>]*class="[^"]*faq-list[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (wrap) return wrap[1];
    return "";
  }
  return parts.join(" ");
}

function extractFAQQuestionsRaw(html) {
  const out = [];
  const re = /<summary\b[^>]*>([\s\S]*?)<\/summary>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
  }
  return out;
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
    .filter((s) => s.length > 20);
}

function extractHeadings(html) {
  const body = extractBody(html);
  const headings = [];
  const re = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    headings.push(m[1].replace(/<[^>]*>/g, "").trim());
  }
  return headings;
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
  const cityLower = cityName.toLowerCase();
  if (cityLower) {
    s = s.replace(new RegExp(cityLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "CITY");
  }
  s = s.replace(new RegExp("\\b" + stateCode.toLowerCase() + "\\b", "g"), "ST");
  s = s.replace(/\$[\d,.]+[km]?/gi, "DOLLAR");
  s = s.replace(/\d+(\.\d+)?%/g, "PCT");
  s = s.replace(/\b\d[\d,.]*\b/g, "NUM");
  return s.trim();
}

function sentenceHash(s) {
  return crypto.createHash("md5").update(s).digest("hex").slice(0, 12);
}

function countCitySpecificEntities(text, cityName) {
  const neighborhoodRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;
  const genericTerms = new Set([
    "The","This","That","Most","Many","Some","All","Any","Your","Our","Their",
    "Home","House","Kitchen","Roof","HVAC","Solar","Window","Siding","Fence",
    "Cost","Price","Quote","Estimate","Contractor","Service","Job","Project",
    "United States","National","Bureau","Labor","Statistics","Average",
    "Google","Reddit","Yelp","NextDoor","BBB","Angi",
    cityName,
  ]);
  const entities = new Set();
  let m;
  while ((m = neighborhoodRe.exec(text)) !== null) {
    const name = m[1];
    if (!genericTerms.has(name) && name.length > 3) entities.add(name);
  }
  const utilityPatterns = [
    /\b(?:PG&E|BGE|SCE|LADWP|SRP|CSU|Dominion|Duke|Ameren|Spire|Con\s+Edison|Oncor|Atmos|PNM|Xcel|Eversource|NIPSCO|Avangrid|Entergy|Evergy|MidAmerican|TVA|FPL|Centerpoint)\b/gi,
    /\b(?:Electric|Energy|Gas|Power|Utilities)\s+(?:Company|Service|Corp|Commission|Cooperative|Coop)\b/gi,
  ];
  for (const pat of utilityPatterns) {
    while ((m = pat.exec(text)) !== null) entities.add(m[0]);
  }
  const codePatterns = [
    /\b(?:Title\s+24|NEC|IRC|IECC|FEMA|EPA\s+RRP|HUD)\b/gi,
    /\b(?:Department\s+of\s+\w+(?:\s+\w+)*)\b/gi,
    /\b(?:CSLB|TDLR|DLLR|DPOR|CID|ROC|CCB|LARA|RMI|MSCD)\b/g,
  ];
  for (const pat of codePatterns) {
    while ((m = pat.exec(text)) !== null) entities.add(m[0]);
  }
  return entities.size;
}

function scoreCorpus(pages, getText, getStructTokens) {
  // Returns {templateScore, semanticScore, infoScore, structScore, composite, ...}
  const corpus = pages.map((p) => {
    const text = getText(p);
    const sentences = extractSentences(text);
    const normalized = sentences.map((s) => normalizeSentence(s, p.cityName, p.stateCode));
    const hashes = normalized.map((s) => sentenceHash(s));
    return {
      page: p,
      text,
      sentences,
      hashes,
      wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
      entityCount: countCitySpecificEntities(text, p.cityName),
      structTokens: getStructTokens(p),
    };
  }).filter((e) => e.hashes.length > 0);

  if (corpus.length < 2) return null;

  // 1. Template ratio
  const hashCounts = {};
  for (const e of corpus) {
    const uniq = new Set(e.hashes);
    for (const h of uniq) hashCounts[h] = (hashCounts[h] || 0) + 1;
  }
  const threshold = Math.max(2, Math.floor(corpus.length * 0.5));
  const boilerplate = new Set(
    Object.entries(hashCounts).filter(([, c]) => c >= threshold).map(([h]) => h)
  );
  let total = 0;
  let boiler = 0;
  for (const e of corpus) {
    total += e.hashes.length;
    boiler += e.hashes.filter((h) => boilerplate.has(h)).length;
  }
  const templateRatio = total > 0 ? boiler / total : 1;
  const templateScore = Math.round((1 - templateRatio) * 100);

  // 2. Semantic uniqueness (pairwise Jaccard on sentence hashes)
  let jacSum = 0;
  let pairs = 0;
  let jacMax = 0;
  let jacMin = 1;
  for (let i = 0; i < corpus.length; i++) {
    for (let j = i + 1; j < corpus.length; j++) {
      const a = new Set(corpus[i].hashes);
      const b = new Set(corpus[j].hashes);
      let inter = 0;
      for (const h of a) if (b.has(h)) inter++;
      const union = a.size + b.size - inter;
      const jac = union > 0 ? inter / union : 0;
      jacSum += jac;
      pairs++;
      if (jac > jacMax) jacMax = jac;
      if (jac < jacMin) jacMin = jac;
    }
  }
  const avgJac = pairs > 0 ? jacSum / pairs : 0;
  const semanticScore = Math.round((1 - avgJac) * 100);

  // 3. Info density
  const avgEntities = corpus.reduce((s, e) => s + e.entityCount, 0) / corpus.length;
  const avgWords = corpus.reduce((s, e) => s + e.wordCount, 0) / corpus.length;
  const entitiesPer1000 = avgWords > 0 ? (avgEntities / avgWords) * 1000 : 0;
  const infoScore = Math.min(100, Math.round(entitiesPer1000 * 5));

  // 4. Structural diversity (heading/question stems shared across pages)
  let structScore = 100;
  if (corpus.some((e) => e.structTokens.length > 0)) {
    const normSets = corpus.map((e) =>
      e.structTokens.map((s) => {
        let n = s.toLowerCase();
        n = n.replace(new RegExp(
          (e.page.cityName || "").toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g"
        ), "CITY");
        n = n.replace(/\b\d[\d,.]*\b/g, "NUM");
        return n.trim();
      })
    );
    const base = new Set(normSets[0]);
    let shared = 0;
    for (let i = 1; i < normSets.length; i++) {
      const other = new Set(normSets[i]);
      for (const h of base) if (other.has(h)) shared++;
    }
    const sharedPerPair = normSets.length > 1 ? shared / (normSets.length - 1) : 0;
    const diversity = base.size > 0 ? 1 - sharedPerPair / base.size : 0;
    structScore = Math.round(Math.max(0, Math.min(1, diversity)) * 100);
  }

  const composite = Math.round(
    templateScore * 0.30 +
    semanticScore * 0.30 +
    infoScore * 0.20 +
    structScore * 0.20
  );

  // Top boilerplate sentences (sorted by repetition count)
  const topBoilerplate = Object.entries(hashCounts)
    .filter(([, c]) => c >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([h, c]) => {
      // Find a representative sentence
      let example = null;
      for (const e of corpus) {
        for (let i = 0; i < e.hashes.length; i++) {
          if (e.hashes[i] === h) {
            example = e.sentences[i];
            break;
          }
        }
        if (example) break;
      }
      return { count: c, ofPages: corpus.length, example: (example || "").slice(0, 140) };
    });

  return {
    sampled: corpus.length,
    avgWords: Math.round(avgWords),
    templateScore,
    semanticScore,
    infoScore,
    structScore,
    composite,
    avgJaccard: Number(avgJac.toFixed(4)),
    maxJaccard: Number(jacMax.toFixed(4)),
    minJaccard: Number(jacMin.toFixed(4)),
    templateRatio: Math.round(templateRatio * 100),
    avgEntities: Math.round(avgEntities * 10) / 10,
    topBoilerplate,
  };
}

function gradeOf(c) {
  return c >= 70 ? "GOOD" : c >= 50 ? "OK" : c >= 35 ? "THIN" : "RISK";
}

function fmtRow(label, r) {
  if (!r) {
    return label.padEnd(16) + " | " + "  no data".padStart(74);
  }
  return (
    label.padEnd(16) + " | " +
    String(r.sampled).padStart(5) + " | " +
    String(r.avgWords).padStart(5) + " | " +
    (r.templateScore + "%").padStart(8) + " | " +
    (r.semanticScore + "%").padStart(8) + " | " +
    (r.infoScore + "%").padStart(7) + " | " +
    (r.structScore + "%").padStart(6) + " | " +
    (r.composite + "%").padStart(9) + " | " +
    gradeOf(r.composite)
  );
}

function analyzeVertical(v) {
  const all = fs.readdirSync(ROOT).filter(
    (f) => f.endsWith(v.pattern) && !isStateHubFile(f, v.pattern)
  );
  if (all.length < 3) return { name: v.name, total: all.length, full: null, faq: null };

  const picked = sample(all, Math.min(SAMPLE, all.length), SEED ^ v.name.length);

  const pages = [];
  for (const f of picked) {
    try {
      const html = fs.readFileSync(path.join(ROOT, f), "utf8");
      const { cityName, stateCode } = parseCityState(f, v.pattern);
      pages.push({
        file: f,
        cityName,
        stateCode,
        html,
        bodyText: stripToText(extractBody(html)),
        faqHtml: extractFAQBlock(html),
        faqQuestions: extractFAQQuestionsRaw(html),
        headings: extractHeadings(html),
      });
    } catch (e) {}
  }

  const full = scoreCorpus(
    pages,
    (p) => p.bodyText,
    (p) => p.headings
  );
  const faq = scoreCorpus(
    pages.map((p) => ({ ...p, _faqText: stripToText(p.faqHtml) })),
    (p) => p._faqText,
    (p) => p.faqQuestions
  );

  // Exact-FAQ-Q overlap: how many sampled pages share the IDENTICAL question stem?
  let exactQDupePct = null;
  if (pages.length >= 2) {
    const qCounts = {};
    let qTotal = 0;
    for (const p of pages) {
      const seen = new Set();
      for (const q of p.faqQuestions) {
        const norm = q
          .toLowerCase()
          .replace(new RegExp(p.cityName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "CITY")
          .replace(/\b\d[\d,.]*\b/g, "NUM")
          .replace(/\s+/g, " ")
          .trim();
        if (!norm) continue;
        if (seen.has(norm)) continue;
        seen.add(norm);
        qCounts[norm] = (qCounts[norm] || 0) + 1;
        qTotal++;
      }
    }
    const sharedHalf = Object.entries(qCounts).filter(([, c]) => c >= Math.max(2, Math.floor(pages.length * 0.5))).length;
    const distinct = Object.keys(qCounts).length;
    exactQDupePct = distinct > 0 ? Math.round((sharedHalf / distinct) * 100) : 0;
  }

  return {
    name: v.name,
    total: all.length,
    sampled: pages.length,
    full,
    faq,
    exactQDupePct,
  };
}

function main() {
  console.log("=".repeat(110));
  console.log("GOOGLE-STANDARD UNIQUENESS AUDIT  —  CITY PAGES (full body)  +  FAQ SECTIONS  —  n=" + SAMPLE + "/vertical");
  console.log("Scoring: Template(30) | Semantic(30) | InfoDensity(20) | Structural(20)  →  composite 0-100");
  console.log("Grades:  GOOD ≥70  |  OK 50-69  |  THIN 35-49  |  RISK <35");
  console.log("=".repeat(110));

  const results = [];
  for (const v of VERTICALS) {
    process.stderr.write(`scanning ${v.name}…\n`);
    results.push(analyzeVertical(v));
  }

  const header =
    "Vertical".padEnd(16) + " | " +
    "Smpl".padStart(5) + " | " +
    "Words".padStart(5) + " | " +
    "Template".padStart(8) + " | " +
    "Semantic".padStart(8) + " | " +
    "InfoDen".padStart(7) + " | " +
    "Struct".padStart(6) + " | " +
    "COMPOSITE".padStart(9) + " | Grade";

  console.log("\n--- FULL CITY PAGE BODY ---\n");
  console.log(header);
  console.log("-".repeat(110));
  for (const r of results) {
    if (!r.full) {
      console.log(r.name.padEnd(16) + " | " + ("only " + r.total + " files").padStart(80));
      continue;
    }
    console.log(fmtRow(r.name + ` (${r.total})`, r.full));
  }

  console.log("\n--- FAQ SECTIONS ONLY ---\n");
  console.log(header);
  console.log("-".repeat(110));
  for (const r of results) {
    if (!r.faq) {
      console.log(r.name.padEnd(16) + " | " + " no FAQ content / too few pages".padStart(80));
      continue;
    }
    console.log(fmtRow(r.name + ` (${r.total})`, r.faq));
  }

  // Averages weighted by page count
  const wAvg = (results, key) => {
    let num = 0;
    let den = 0;
    for (const r of results) {
      if (!r[key]) continue;
      num += r[key].composite * r.total;
      den += r.total;
    }
    return den > 0 ? Math.round(num / den) : 0;
  };
  const fullAvg = wAvg(results, "full");
  const faqAvg = wAvg(results, "faq");
  const totalPages = results.reduce((s, r) => s + r.total, 0);

  console.log("\n" + "=".repeat(110));
  console.log(`Page-weighted average composite — FULL: ${fullAvg}% | FAQ: ${faqAvg}%  (n=${totalPages} pages across ${results.filter((r) => r.full).length} verticals)`);

  console.log("\n--- TOP BOILERPLATE SENTENCES (sampled corpus, full-body, top per vertical) ---");
  for (const r of results) {
    if (!r.full || !r.full.topBoilerplate || r.full.topBoilerplate.length === 0) continue;
    console.log(`\n[${r.name}]`);
    for (const b of r.full.topBoilerplate) {
      console.log(`  ${b.count}/${b.ofPages}  "${b.example}"`);
    }
  }

  console.log("\n--- FAQ Q-STEM REPEAT RATE  (% of distinct questions appearing on ≥50% of sampled pages) ---");
  console.log("Vertical".padEnd(16) + " | Repeat-rate");
  console.log("-".repeat(40));
  for (const r of results) {
    if (r.exactQDupePct == null) continue;
    console.log(r.name.padEnd(16) + " | " + (r.exactQDupePct + "%").padStart(11));
  }

  // Write JSON
  const outDir = path.join(ROOT, "output", "audits");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `uniqueness-google-faq-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ sampledAt: stamp, sampleSize: SAMPLE, results, fullAvg, faqAvg, totalPages }, null, 2));
  console.log(`\nJSON written: ${path.relative(ROOT, outPath)}`);

  // ----- Phase 5 gate -----
  // Re-runnable as the same audit. When --gate is set, exits non-zero on
  // any floor breach (per-vertical FAQ, page-weighted FAQ, page-weighted
  // full). This is the regression-gate.yml hook.
  if (process.argv.includes("--gate")) {
    const failures = [];
    for (const r of results) {
      if (TIER_A_VERTICALS.has(r.name)) continue; // Tier A has its own ceiling
      if (!r.faq) continue;
      if (r.faq.composite < GATE_FLOORS.perVerticalFAQMin) {
        failures.push(
          `[per-vertical FAQ floor] ${r.name}: ${r.faq.composite}% < ${GATE_FLOORS.perVerticalFAQMin}% (floor)`
        );
      }
    }
    if (faqAvg < GATE_FLOORS.pageWeightedFAQMin) {
      failures.push(
        `[page-weighted FAQ floor] ${faqAvg}% < ${GATE_FLOORS.pageWeightedFAQMin}% (floor)`
      );
    }
    if (fullAvg < GATE_FLOORS.pageWeightedFullMin) {
      failures.push(
        `[page-weighted FULL floor] ${fullAvg}% < ${GATE_FLOORS.pageWeightedFullMin}% (floor)`
      );
    }

    console.log("\n" + "=".repeat(80));
    if (failures.length) {
      console.log("PHASE 5 GATE FAILED — uniqueness regression detected:");
      for (const f of failures) console.log("  " + f);
      console.log("=".repeat(80));
      console.log(
        "These floors protect the Phase 3 FAQ data-binding work (locked 2026-05-22).\n" +
        "If the regression is intentional (e.g. removing a vertical's FAQ block on purpose),\n" +
        "raise the relevant floor in scripts/audit-uniqueness-google-faq.js#GATE_FLOORS in\n" +
        "the same PR, with rationale in the commit message."
      );
      process.exit(1);
    }
    console.log("PHASE 5 GATE PASSED");
    console.log(`  per-vertical FAQ min:    ${GATE_FLOORS.perVerticalFAQMin}% (Tier B verticals checked)`);
    console.log(`  page-weighted FAQ avg:   ${faqAvg}% (floor ${GATE_FLOORS.pageWeightedFAQMin}%)`);
    console.log(`  page-weighted FULL avg:  ${fullAvg}% (floor ${GATE_FLOORS.pageWeightedFullMin}%)`);
    console.log("=".repeat(80));
  }
}

main();
