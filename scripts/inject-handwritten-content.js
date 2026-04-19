#!/usr/bin/env node
/**
 * inject-handwritten-content.js
 *
 * Injects hand-written, per-city unique content into city cost pages.
 * Reads from data/handwritten-{vertical}-content.json files.
 * Idempotent: re-running replaces previously injected content.
 *
 * Usage:
 *   node scripts/inject-handwritten-content.js plumbing
 *   node scripts/inject-handwritten-content.js plumbing --dry
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const vertical = args.find((a) => a !== "--dry");

if (!vertical) {
  console.error("Usage: node scripts/inject-handwritten-content.js <vertical> [--dry]");
  process.exit(1);
}

const VERTICAL_SLUGS = {
  plumbing: "plumbing-cost",
  "garage-door": "garage-door-cost",
  fence: "fence-cost",
  solar: "solar-cost",
  roof: "roof-cost",
  electrical: "electrical-cost",
  hvac: "hvac-cost",
  window: "window-cost",
  siding: "siding-cost",
  painting: "painting-cost",
  concrete: "concrete-cost",
  landscaping: "landscaping-cost",
  foundation: "foundation-cost",
  insulation: "insulation-cost",
  gutter: "gutter-cost",
  "kitchen-remodel": "kitchen-remodel-cost",
  "auto-repair": "auto-repair-cost",
  medical: "medical-cost",
  legal: "legal-cost",
  moving: "moving-cost",
};

const slugSuffix = VERTICAL_SLUGS[vertical];
if (!slugSuffix) {
  console.error(`Unknown vertical: ${vertical}`);
  process.exit(1);
}

const dataFile = path.join(ROOT, `data/handwritten-${vertical}-content.json`);
if (!fs.existsSync(dataFile)) {
  console.error(`No data file: ${dataFile}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));

const MARKER_START = "<!-- HANDWRITTEN-LOCAL-GUIDE -->";
const MARKER_END = "<!-- /HANDWRITTEN-LOCAL-GUIDE -->";
const FAQ_MARKER_START = "<!-- HANDWRITTEN-FAQ -->";
const FAQ_MARKER_END = "<!-- /HANDWRITTEN-FAQ -->";

function parseCityFromFilename(filename) {
  const base = path.basename(filename, ".html");
  const suffix = `-${slugSuffix}`;
  if (!base.endsWith(suffix)) return null;
  const slug = base.slice(0, -suffix.length);
  const parts = slug.split("-");
  if (parts.length < 2) return null;
  const stateCode = parts.pop().toUpperCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  const cityName = parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { city: cityName, state: stateCode, key: `${cityName}|${stateCode}` };
}

function buildSectionHTML(paragraphs, city, vertical) {
  const tradeName = vertical.charAt(0).toUpperCase() + vertical.slice(1);
  let html = `\n${MARKER_START}\n`;
  html += `<section class="section" style="background:#f0fdf4;padding:24px;border-radius:14px;border:1px solid #bbf7d0;margin:32px 0;">\n`;
  html += `<h2>${city} ${tradeName} Guide</h2>\n`;
  for (const p of paragraphs) {
    html += `<p>${p}</p>\n`;
  }
  html += `</section>\n`;
  html += `${MARKER_END}\n`;
  return html;
}

function buildFAQHTML(faqs) {
  if (!faqs || faqs.length === 0) return "";
  let html = `${FAQ_MARKER_START}\n`;
  for (const { q, a } of faqs) {
    html += `<details class="faq-item">\n`;
    html += `<summary>${q}</summary>\n`;
    html += `<div class="faq-answer"><p>${a}</p></div>\n`;
    html += `</details>\n`;
  }
  html += `${FAQ_MARKER_END}\n`;
  return html;
}

function injectIntoFile(filepath, cityData) {
  let content = fs.readFileSync(filepath, "utf8");
  const nl = content.includes("\r\n") ? "\r\n" : "\n";

  // Remove old injected content if present (idempotent)
  content = content.replace(new RegExp(`\\n?${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, "g"), "");
  content = content.replace(new RegExp(`\\n?${FAQ_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${FAQ_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, "g"), "");

  const parsed = parseCityFromFilename(filepath);
  if (!parsed) return null;

  // Build section HTML
  const sectionHTML = buildSectionHTML(cityData.paragraphs, `${parsed.city}, ${parsed.state}`, vertical).replace(/\n/g, nl);
  const faqHTML = buildFAQHTML(cityData.faqs).replace(/\n/g, nl);

  // Insert section before TP-INTERNAL-TOOLS-BLOCK or TP-LOCAL-INJECTED-V4 or footer
  let inserted = false;
  const insertPoints = [
    "<!-- TP-INTERNAL-TOOLS-BLOCK -->",
    "<!-- TP-LOCAL-INJECTED-V4 -->",
    "<!-- TP-LOCAL-INJECTED-V3 -->",
    "<footer",
  ];
  for (const marker of insertPoints) {
    const idx = content.indexOf(marker);
    if (idx >= 0) {
      content = content.slice(0, idx) + sectionHTML + nl + content.slice(idx);
      inserted = true;
      break;
    }
  }

  // Insert FAQs into existing FAQ section
  if (faqHTML) {
    const faqListRe = /(<div class="faq-list">[\s\S]*?)(<\/div>\s*<\/section>)/;
    const faqMatch = content.match(faqListRe);
    if (faqMatch) {
      const insertAt = content.indexOf(faqMatch[0]) + faqMatch[1].length;
      content = content.slice(0, insertAt) + nl + faqHTML + content.slice(insertAt);
    }
  }

  // Update FAQPage schema
  if (cityData.faqs && cityData.faqs.length > 0) {
    const faqSchemaRe = /"@type":"FAQPage","mainEntity":\[/;
    if (faqSchemaRe.test(content)) {
      const newEntries = cityData.faqs
        .map((f) => JSON.stringify({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
        .join(",");
      content = content.replace(faqSchemaRe, (match) => match + newEntries + ",");
    }
  }

  if (!DRY) {
    fs.writeFileSync(filepath, content, "utf8");
  }

  const wordCount = cityData.paragraphs.join(" ").split(/\s+/).length;
  return { inserted, wordCount, faqCount: cityData.faqs ? cityData.faqs.length : 0 };
}

// Main
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(`-${slugSuffix}.html`));
console.log(`\n${vertical}: ${files.length} city pages, ${Object.keys(data).filter(k => k !== "_meta").length} hand-written entries`);

let injected = 0;
let skipped = 0;
let totalWords = 0;

for (const f of files) {
  const parsed = parseCityFromFilename(f);
  if (!parsed) continue;

  const cityData = data[parsed.key];
  if (!cityData || !cityData.paragraphs) {
    skipped++;
    continue;
  }

  const result = injectIntoFile(path.join(ROOT, f), cityData);
  if (result && result.inserted) {
    injected++;
    totalWords += result.wordCount;
    if (injected <= 5) {
      console.log(`  ${parsed.key}: ${result.wordCount} words, ${result.faqCount} FAQs`);
    }
  } else {
    console.log(`  WARN: ${parsed.key} - could not find insertion point`);
  }
}

console.log(`\n  ${injected} injected (${totalWords} total words), ${skipped} skipped (no hand-written content)`);
if (DRY) console.log("  [DRY RUN: no files written]");
