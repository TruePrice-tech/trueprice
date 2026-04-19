#!/usr/bin/env node
/**
 * audit-uniqueness-google.js
 *
 * Google-aligned uniqueness scoring for city pages. Measures what Google's
 * Helpful Content System and duplicate-content algorithms actually evaluate:
 *
 * 1. TEMPLATE RATIO (30%) - What % of sentences are shared boilerplate vs
 *    genuinely unique to this city? Google detects programmatic pages by
 *    identifying repeated structural patterns across many URLs.
 *
 * 2. SEMANTIC UNIQUENESS (30%) - Sentence-level comparison after removing
 *    city names and numbers. Google uses NLP to detect "same idea, different
 *    words" -- we approximate by comparing normalized sentence hashes.
 *
 * 3. INFORMATION DENSITY (20%) - How many city-specific named entities
 *    (neighborhoods, utility companies, permit authorities, specific codes)
 *    does the page contain? Thin pages have generic advice; rich pages
 *    reference specific local details.
 *
 * 4. STRUCTURAL DIVERSITY (20%) - Do pages share identical section headings,
 *    FAQ questions, and CTA text? Google penalizes identical page skeletons.
 *
 * Output: composite score 0-100 per vertical, with subscores.
 *
 * Usage: node scripts/audit-uniqueness-google.js [vertical-slug]
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");

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

const FLAGSHIP_SLUGS = new Set([
  "new-york-ny","los-angeles-ca","chicago-il","houston-tx","phoenix-az",
  "dallas-tx","atlanta-ga","denver-co","seattle-wa","austin-tx",
  "san-francisco-ca","philadelphia-pa","miami-fl","boston-ma","san-diego-ca",
  "tampa-fl","detroit-mi","minneapolis-mn","charlotte-nc","las-vegas-nv",
  "st-louis-mo","orlando-fl","san-antonio-tx","portland-or","sacramento-ca",
  "pittsburgh-pa","columbus-oh","kansas-city-mo","indianapolis-in","nashville-tn",
  "san-jose-ca","fort-worth-tx","el-paso-tx","baltimore-md","albuquerque-nm",
  "fresno-ca","long-beach-ca","mesa-az","virginia-beach-va","colorado-springs-co",
]);

function extractBody(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let text = bodyMatch ? bodyMatch[1] : html;
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<script[^>]*>[^<]*/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  return text;
}

function extractVisibleText(html) {
  let text = extractBody(html);
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&\w+;/g, " ");
  text = text.replace(/&#\d+;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractSentences(text) {
  // Split on sentence boundaries
  return text.split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // Skip very short fragments
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

function extractFAQQuestions(html) {
  const questions = [];
  const re = /<summary[^>]*>([\s\S]*?)<\/summary>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    questions.push(m[1].replace(/<[^>]*>/g, "").trim());
  }
  return questions;
}

function parseCityState(filename, pattern) {
  const prefix = filename.replace(pattern, "");
  const parts = prefix.split("-");
  const stateCode = parts.pop().toUpperCase();
  const cityName = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const citySlug = parts.join("-") + "-" + stateCode.toLowerCase();
  return { cityName, stateCode, citySlug };
}

function normalizeSentence(sentence, cityName, stateCode) {
  let s = sentence.toLowerCase();
  // Remove city name
  const cityLower = cityName.toLowerCase();
  s = s.replace(new RegExp(cityLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "CITY");
  // Remove state code
  s = s.replace(new RegExp("\\b" + stateCode.toLowerCase() + "\\b", "g"), "ST");
  // Normalize numbers and dollars
  s = s.replace(/\$[\d,.]+[km]?/gi, "DOLLAR");
  s = s.replace(/\d+(\.\d+)?%/g, "PCT");
  s = s.replace(/\b\d[\d,.]*\b/g, "NUM");
  return s.trim();
}

function sentenceHash(s) {
  return crypto.createHash("md5").update(s).digest("hex").slice(0, 12);
}

// Count named entities that are city-specific (not generic trade terms)
function countCitySpecificEntities(text, cityName) {
  let count = 0;
  // Neighborhood names (capitalized multi-word names that aren't the city name)
  const neighborhoodRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;
  const genericTerms = new Set([
    "The", "This", "That", "Most", "Many", "Some", "All", "Any", "Your",
    "Home", "House", "Kitchen", "Roof", "HVAC", "Solar", "Window", "Siding",
    "Cost", "Price", "Quote", "Estimate", "Contractor", "Service",
    "United States", "National", "Bureau", "Labor", "Statistics",
    cityName,
  ]);
  let m;
  const entities = new Set();
  while ((m = neighborhoodRe.exec(text)) !== null) {
    const name = m[1];
    if (!genericTerms.has(name) && name.length > 3) {
      entities.add(name);
    }
  }

  // Utility company names (specific patterns)
  const utilityPatterns = [
    /\b(?:PG&E|BGE|SCE|LADWP|SRP|CSU|Dominion|Duke|Ameren|Spire|Con Edison|Oncor|Atmos|PNM)\b/gi,
    /\b(?:Electric|Energy|Gas|Power|Utilities)\s+(?:Company|Service|Corp|Commission)\b/gi,
  ];
  for (const pat of utilityPatterns) {
    while ((m = pat.exec(text)) !== null) {
      entities.add(m[0]);
    }
  }

  // Specific permit/code references
  const codePatterns = [
    /\b(?:Title\s+24|NEC|IRC|IECC|FEMA|EPA\s+RRP)\b/gi,
    /\b(?:Department\s+of\s+\w+(?:\s+\w+)*)\b/gi,
    /\b(?:CSLB|TDLR|DLLR|DPOR|CID|ROC)\b/g,
  ];
  for (const pat of codePatterns) {
    while ((m = pat.exec(text)) !== null) {
      entities.add(m[0]);
    }
  }

  return entities.size;
}

function analyzeVertical(verticalName, pattern, filterFlagship) {
  const allFiles = fs.readdirSync(ROOT);
  let files = allFiles.filter(f => f.endsWith(pattern));

  if (filterFlagship !== undefined) {
    files = files.filter(f => {
      const { citySlug } = parseCityState(f, pattern);
      return filterFlagship ? FLAGSHIP_SLUGS.has(citySlug) : !FLAGSHIP_SLUGS.has(citySlug);
    });
  }

  if (files.length < 3) return null;

  // Sample up to 10 pages spread across the file list
  const sampleCount = Math.min(10, files.length);
  const step = Math.floor(files.length / sampleCount);
  const sampleFiles = [];
  for (let i = 0; i < sampleCount; i++) {
    sampleFiles.push(files[Math.min(i * step, files.length - 1)]);
  }

  const pages = [];
  for (const f of sampleFiles) {
    try {
      const html = fs.readFileSync(path.join(ROOT, f), "utf8");
      const { cityName, stateCode, citySlug } = parseCityState(f, pattern);
      const visibleText = extractVisibleText(html);
      const sentences = extractSentences(visibleText);
      const normalizedSentences = sentences.map(s => normalizeSentence(s, cityName, stateCode));
      const sentenceHashes = normalizedSentences.map(s => sentenceHash(s));
      const headings = extractHeadings(html);
      const faqs = extractFAQQuestions(html);
      const entityCount = countCitySpecificEntities(visibleText, cityName);
      const wordCount = visibleText.split(/\s+/).length;

      pages.push({
        file: f, cityName, stateCode, citySlug,
        sentences, normalizedSentences, sentenceHashes,
        headings, faqs, entityCount, wordCount,
      });
    } catch (e) {}
  }

  if (pages.length < 2) return null;

  // === SCORE 1: TEMPLATE RATIO (30%) ===
  // Count sentences that appear in 50%+ of sampled pages (boilerplate)
  const hashCounts = {};
  for (const p of pages) {
    const uniqueHashes = new Set(p.sentenceHashes);
    for (const h of uniqueHashes) {
      hashCounts[h] = (hashCounts[h] || 0) + 1;
    }
  }
  const threshold = Math.max(2, Math.floor(pages.length * 0.5));
  const boilerplateHashes = new Set(
    Object.entries(hashCounts).filter(([_, c]) => c >= threshold).map(([h]) => h)
  );

  let totalSentences = 0;
  let boilerplateSentences = 0;
  for (const p of pages) {
    totalSentences += p.sentenceHashes.length;
    boilerplateSentences += p.sentenceHashes.filter(h => boilerplateHashes.has(h)).length;
  }
  const templateRatio = totalSentences > 0 ? boilerplateSentences / totalSentences : 1;
  const templateScore = Math.round((1 - templateRatio) * 100);

  // === SCORE 2: SEMANTIC UNIQUENESS (30%) ===
  // Pairwise sentence-level Jaccard distance
  let totalJaccard = 0;
  let pairCount = 0;
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const setA = new Set(pages[i].sentenceHashes);
      const setB = new Set(pages[j].sentenceHashes);
      const intersection = [...setA].filter(h => setB.has(h)).length;
      const union = new Set([...setA, ...setB]).size;
      const jaccard = union > 0 ? intersection / union : 0;
      totalJaccard += jaccard;
      pairCount++;
    }
  }
  const avgJaccard = pairCount > 0 ? totalJaccard / pairCount : 0;
  const semanticScore = Math.round((1 - avgJaccard) * 100);

  // === SCORE 3: INFORMATION DENSITY (20%) ===
  // Named entities per 1000 words
  const avgEntities = pages.reduce((s, p) => s + p.entityCount, 0) / pages.length;
  const avgWords = pages.reduce((s, p) => s + p.wordCount, 0) / pages.length;
  const entitiesPer1000 = avgWords > 0 ? (avgEntities / avgWords) * 1000 : 0;
  // Scale: 0 entities = 0%, 20+ per 1000 words = 100%
  const infoScore = Math.min(100, Math.round(entitiesPer1000 * 5));

  // === SCORE 4: STRUCTURAL DIVERSITY (20%) ===
  // Check if headings and FAQ questions are identical across pages
  const allHeadingSets = pages.map(p => {
    return p.headings.map(h => {
      let hn = h.toLowerCase();
      hn = hn.replace(new RegExp(p.cityName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "CITY");
      return hn;
    });
  });

  let sharedHeadings = 0;
  let totalHeadings = 0;
  if (allHeadingSets.length >= 2) {
    const baseHeadings = new Set(allHeadingSets[0]);
    totalHeadings = baseHeadings.size;
    for (let i = 1; i < allHeadingSets.length; i++) {
      const otherSet = new Set(allHeadingSets[i]);
      for (const h of baseHeadings) {
        if (otherSet.has(h)) sharedHeadings++;
      }
    }
    sharedHeadings = sharedHeadings / (allHeadingSets.length - 1);
  }
  const headingDiversity = totalHeadings > 0 ? 1 - (sharedHeadings / totalHeadings) : 0;
  const structScore = Math.round(headingDiversity * 100);

  // === COMPOSITE SCORE ===
  const composite = Math.round(
    templateScore * 0.30 +
    semanticScore * 0.30 +
    infoScore * 0.20 +
    structScore * 0.20
  );

  return {
    vertical: verticalName,
    pages: files.length,
    sampled: pages.length,
    avgWords: Math.round(avgWords),
    templateScore,
    semanticScore,
    infoScore,
    structScore,
    composite,
    templateRatio: Math.round(templateRatio * 100),
    boilerplateSentences: Math.round(boilerplateSentences / pages.length),
    totalSentences: Math.round(totalSentences / pages.length),
    avgEntities: Math.round(avgEntities),
  };
}

function main() {
  const filterVertical = process.argv[2];
  const verticals = filterVertical
    ? VERTICALS.filter(v => v.name === filterVertical)
    : VERTICALS;

  console.log("=".repeat(100));
  console.log("GOOGLE-ALIGNED UNIQUENESS AUDIT");
  console.log("Measures: Template Ratio | Semantic Uniqueness | Info Density | Structural Diversity");
  console.log("=".repeat(100));

  // Non-flagship
  console.log("\n--- NON-FLAGSHIP CITY PAGES ---\n");
  console.log(
    "Vertical".padEnd(16) + " | " +
    "Pages".padStart(6) + " | " +
    "Words".padStart(6) + " | " +
    "Template".padStart(8) + " | " +
    "Semantic".padStart(8) + " | " +
    "InfoDen".padStart(7) + " | " +
    "Struct".padStart(6) + " | " +
    "COMPOSITE".padStart(9) + " | " +
    "Grade"
  );
  console.log("-".repeat(100));

  const nfResults = [];
  for (const v of verticals) {
    const result = analyzeVertical(v.name, v.pattern, false);
    if (!result) continue;
    nfResults.push(result);
    const grade = result.composite >= 70 ? "GOOD" :
                  result.composite >= 50 ? "OK" :
                  result.composite >= 35 ? "THIN" : "RISK";
    console.log(
      result.vertical.padEnd(16) + " | " +
      String(result.pages).padStart(6) + " | " +
      String(result.avgWords).padStart(6) + " | " +
      (result.templateScore + "%").padStart(8) + " | " +
      (result.semanticScore + "%").padStart(8) + " | " +
      (result.infoScore + "%").padStart(7) + " | " +
      (result.structScore + "%").padStart(6) + " | " +
      (result.composite + "%").padStart(9) + " | " +
      grade
    );
  }

  // Flagship
  console.log("\n--- FLAGSHIP CITY PAGES ---\n");
  console.log(
    "Vertical".padEnd(16) + " | " +
    "Pages".padStart(6) + " | " +
    "Words".padStart(6) + " | " +
    "Template".padStart(8) + " | " +
    "Semantic".padStart(8) + " | " +
    "InfoDen".padStart(7) + " | " +
    "Struct".padStart(6) + " | " +
    "COMPOSITE".padStart(9) + " | " +
    "Grade"
  );
  console.log("-".repeat(100));

  const fsResults = [];
  for (const v of verticals) {
    const result = analyzeVertical(v.name, v.pattern, true);
    if (!result) continue;
    fsResults.push(result);
    const grade = result.composite >= 70 ? "GOOD" :
                  result.composite >= 50 ? "OK" :
                  result.composite >= 35 ? "THIN" : "RISK";
    console.log(
      result.vertical.padEnd(16) + " | " +
      String(result.pages).padStart(6) + " | " +
      String(result.avgWords).padStart(6) + " | " +
      (result.templateScore + "%").padStart(8) + " | " +
      (result.semanticScore + "%").padStart(8) + " | " +
      (result.infoScore + "%").padStart(7) + " | " +
      (result.structScore + "%").padStart(6) + " | " +
      (result.composite + "%").padStart(9) + " | " +
      grade
    );
  }

  // Summary
  console.log("\n" + "=".repeat(100));
  console.log("SCORING KEY:");
  console.log("  Template (30%): % of sentences unique to this page (not shared across 50%+ of pages)");
  console.log("  Semantic (30%): sentence-level Jaccard distance between page pairs");
  console.log("  InfoDen  (20%): city-specific named entities per 1000 words (neighborhoods, utilities, codes)");
  console.log("  Struct   (20%): heading/section diversity across pages");
  console.log("");
  console.log("GRADES: GOOD (70%+) = Google sees genuine value | OK (50-69%) = borderline");
  console.log("        THIN (35-49%) = doorway page risk | RISK (<35%) = likely penalized");
  console.log("=".repeat(100));

  const nfAvg = nfResults.length > 0 ? Math.round(nfResults.reduce((s, r) => s + r.composite, 0) / nfResults.length) : 0;
  const fsAvg = fsResults.length > 0 ? Math.round(fsResults.reduce((s, r) => s + r.composite, 0) / fsResults.length) : 0;
  console.log(`\nNon-flagship average: ${nfAvg}%`);
  console.log(`Flagship average: ${fsAvg}%`);
  console.log(`Total pages: ${nfResults.reduce((s, r) => s + r.pages, 0) + fsResults.reduce((s, r) => s + r.pages, 0)}`);
}

main();
