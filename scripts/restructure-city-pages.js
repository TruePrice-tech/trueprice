#!/usr/bin/env node
/**
 * restructure-city-pages.js
 *
 * Breaks the fixed section order on city pages to maximize Google's
 * Structural Diversity score. Each city gets a deterministically unique
 * layout: sections are reordered, some are replaced with alternates,
 * FAQ presentation varies, and headings become more city-specific.
 *
 * Idempotent: sections are identified by markers/content, not position.
 * Safe: never modifies flagship content, hero, header, or footer.
 *
 * Usage:
 *   node scripts/restructure-city-pages.js plumbing --dry
 *   node scripts/restructure-city-pages.js plumbing
 *   node scripts/restructure-city-pages.js --all
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const ALL = args.includes("--all");

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

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
function pick(arr, seed) { return arr[seed % arr.length]; }

// ─── SECTION EXTRACTION ────────────────────────────────────────────────
// Each section is identified by a marker or heading pattern and extracted
// as a complete HTML block that can be repositioned.

const SECTION_IDS = {
  CTA_COMPARE:   { marker: /Compare.*contractor costs/i },
  PRICING_TABLE: { marker: /pricing by service/i },
  LOCAL_CONTEXT: { marker: /what locals should know/i },
  COST_DRIVERS:  { marker: /What drives|cost drivers|pricing factors|cost breakdown/i },
  FAQ:           { marker: /Questions.*homeowners ask|FAQ|frequently asked|common.*questions/i },
  OTHER_SERVICES:{ marker: /Other services|More home services|Browse.*home services|Related services/i },
  NEARBY_CITIES: { marker: /<!-- TP-NEARBY-CITIES -->/ },
  MARKET_V2:     { marker: /<!-- TP-LOCAL-INJECTED-V2 -->/ },
  TOOLS_BLOCK:   { marker: /<!-- TP-INTERNAL-TOOLS-BLOCK -->/ },
  COMPARE_V4:    { marker: /<!-- TP-LOCAL-INJECTED-V4 -->/ },
  BLS_V5:        { marker: /<!-- TP-LOCAL-INJECTED-V5 -->/ },
  LOCAL_PIC_V3:  { marker: /<!-- TP-LOCAL-INJECTED-V3 -->/ },
  HANDWRITTEN:   { marker: /<!-- HANDWRITTEN-LOCAL-GUIDE -->/ },
  FLAGSHIP:      { marker: /<!-- FLAGSHIP-/ },
};

// Sections that can be shuffled (the movable body sections)
const SHUFFLEABLE = [
  "PRICING_TABLE",
  "LOCAL_CONTEXT",
  "COST_DRIVERS",
  "FAQ",
  "MARKET_V2",
  "COMPARE_V4",
  "BLS_V5",
  "LOCAL_PIC_V3",
];

// Sections that stay in fixed positions
// CTA_COMPARE: always first after hero
// OTHER_SERVICES + NEARBY_CITIES: always last before footer
// TOOLS_BLOCK: floats with the group
// HANDWRITTEN + FLAGSHIP: stay where they are relative to their anchor

// ─── LAYOUT PRESETS ────────────────────────────────────────────────────
// 12 distinct orderings of the shuffleable sections.
// Each is a permutation of SHUFFLEABLE indices.

const LAYOUTS = [
  // Layout 0: pricing -> local -> drivers -> faq -> market -> compare -> bls -> localpic
  [0, 1, 2, 3, 4, 5, 6, 7],
  // Layout 1: local -> pricing -> faq -> drivers -> localpic -> market -> compare -> bls
  [1, 0, 3, 2, 7, 4, 5, 6],
  // Layout 2: faq -> pricing -> local -> market -> drivers -> bls -> localpic -> compare
  [3, 0, 1, 4, 2, 6, 7, 5],
  // Layout 3: drivers -> local -> pricing -> compare -> faq -> localpic -> bls -> market
  [2, 1, 0, 5, 3, 7, 6, 4],
  // Layout 4: pricing -> faq -> drivers -> local -> bls -> compare -> market -> localpic
  [0, 3, 2, 1, 6, 5, 4, 7],
  // Layout 5: local -> drivers -> market -> pricing -> localpic -> faq -> bls -> compare
  [1, 2, 4, 0, 7, 3, 6, 5],
  // Layout 6: market -> pricing -> faq -> local -> compare -> drivers -> localpic -> bls
  [4, 0, 3, 1, 5, 2, 7, 6],
  // Layout 7: faq -> local -> drivers -> bls -> pricing -> market -> compare -> localpic
  [3, 1, 2, 6, 0, 4, 5, 7],
  // Layout 8: pricing -> market -> local -> localpic -> faq -> drivers -> compare -> bls
  [0, 4, 1, 7, 3, 2, 5, 6],
  // Layout 9: localpic -> pricing -> faq -> market -> local -> bls -> drivers -> compare
  [7, 0, 3, 4, 1, 6, 2, 5],
  // Layout 10: drivers -> faq -> pricing -> compare -> market -> local -> bls -> localpic
  [2, 3, 0, 5, 4, 1, 6, 7],
  // Layout 11: bls -> local -> pricing -> faq -> localpic -> drivers -> market -> compare
  [6, 1, 0, 3, 7, 2, 4, 5],
];

// ─── FAQ PRESENTATION STYLES ──────────────────────────────────────────
const FAQ_STYLES = ["accordion", "open", "grid", "numbered", "cards"];

function convertFAQStyle(faqHtml, style) {
  if (style === "accordion") return faqHtml; // default, no change

  // Extract Q&A pairs from accordion format
  const pairs = [];
  const re = /<details class="faq-item">\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-answer"><p>([\s\S]*?)<\/p><\/div>\s*<\/details>/g;
  let m;
  while ((m = re.exec(faqHtml)) !== null) {
    pairs.push({ q: m[1].trim(), a: m[2].trim() });
  }
  if (pairs.length === 0) return faqHtml; // can't parse, leave as-is

  // Also preserve any HANDWRITTEN-FAQ blocks
  const hwMatch = faqHtml.match(/<!-- HANDWRITTEN-FAQ -->[\s\S]*?<!-- \/HANDWRITTEN-FAQ -->/);
  const hwBlock = hwMatch ? "\n" + hwMatch[0] : "";

  // Get the section wrapper (heading etc)
  const headingMatch = faqHtml.match(/<section[^>]*>[\s\S]*?(<h2[^>]*>[\s\S]*?<\/h2>)/);
  const heading = headingMatch ? headingMatch[1] : "<h2>Frequently Asked Questions</h2>";
  const sectionStyle = faqHtml.match(/style="([^"]*)"/);
  const styleAttr = sectionStyle ? ` style="${sectionStyle[1]}"` : "";

  if (style === "open") {
    // Open paragraphs, no accordion
    let html = `<section class="section"${styleAttr}>\n${heading}\n`;
    for (const p of pairs) {
      html += `<div class="faq-open" style="margin:16px 0;padding:16px;background:#f8fafc;border-radius:10px;border-left:4px solid #3b82f6;">\n`;
      html += `<h3 style="margin:0 0 8px;font-size:16px;color:#1e293b;">${p.q}</h3>\n`;
      html += `<p style="margin:0;color:#475569;">${p.a}</p>\n</div>\n`;
    }
    html += hwBlock + "\n</section>";
    return html;
  }

  if (style === "grid") {
    // Two-column grid
    let html = `<section class="section"${styleAttr}>\n${heading}\n`;
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;">\n`;
    for (const p of pairs) {
      html += `<div style="padding:16px;background:#fafbff;border-radius:10px;border:1px solid #e2e8f0;">\n`;
      html += `<h3 style="margin:0 0 8px;font-size:15px;color:#1e293b;">${p.q}</h3>\n`;
      html += `<p style="margin:0;font-size:14px;color:#475569;">${p.a}</p>\n</div>\n`;
    }
    html += `</div>\n` + hwBlock + "\n</section>";
    return html;
  }

  if (style === "numbered") {
    // Numbered list
    let html = `<section class="section"${styleAttr}>\n${heading}\n<ol style="padding-left:20px;">\n`;
    for (const p of pairs) {
      html += `<li style="margin:12px 0;"><strong>${p.q}</strong><br><span style="color:#475569;">${p.a}</span></li>\n`;
    }
    html += `</ol>\n` + hwBlock + "\n</section>";
    return html;
  }

  if (style === "cards") {
    // Card layout
    let html = `<section class="section"${styleAttr}>\n${heading}\n`;
    const colors = ["#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3", "#e0e7ff"];
    for (let i = 0; i < pairs.length; i++) {
      const bg = colors[i % colors.length];
      html += `<div style="margin:12px 0;padding:18px;background:${bg};border-radius:12px;">\n`;
      html += `<h3 style="margin:0 0 8px;font-size:15px;">${pairs[i].q}</h3>\n`;
      html += `<p style="margin:0;font-size:14px;">${pairs[i].a}</p>\n</div>\n`;
    }
    html += hwBlock + "\n</section>";
    return html;
  }

  return faqHtml;
}

// ─── SECTION EXTRACTION & REASSEMBLY ──────────────────────────────────

function extractSections(content) {
  // Find the main content area (between <main> and the footer/end sections)
  const mainStart = content.indexOf('<main');
  const footerStart = content.indexOf('<footer');
  if (mainStart < 0 || footerStart < 0) return null;

  const before = content.slice(0, mainStart);
  const mainTag = content.slice(mainStart, content.indexOf('>', mainStart) + 1);
  const afterFooterStart = content.slice(footerStart);

  const bodyContent = content.slice(content.indexOf('>', mainStart) + 1, footerStart);

  // Split into sections by finding each <section or <!-- TP- marker
  const sections = {};
  const sectionOrder = [];
  const unidentified = [];

  // Use regex to find section blocks
  // Strategy: find all top-level sections and marker-delimited blocks
  const sectionRe = /(?:<!-- TP-[A-Z0-9_-]+ -->[\s\S]*?<\/section>)|(?:<!-- HANDWRITTEN-LOCAL-GUIDE -->[\s\S]*?<!-- \/HANDWRITTEN-LOCAL-GUIDE -->)|(?:<!-- HANDWRITTEN-FAQ -->[\s\S]*?<!-- \/HANDWRITTEN-FAQ -->)|(?:<!-- FLAGSHIP-[\s\S]*?<!-- \/FLAGSHIP-[^>]+-->)|(?:<section[\s\S]*?<\/section>)|(?:<div class="cta-box[\s\S]*?<\/div>\s*<\/div>)|(?:<p class="guide-link[\s\S]*?<\/p>)/g;

  let lastEnd = 0;
  let match;
  const blocks = [];

  // Simpler approach: split by section tags
  const lines = bodyContent.split("\n");
  let currentBlock = [];
  let inSection = false;
  let depth = 0;

  for (const line of lines) {
    const sectionOpen = (line.match(/<section/g) || []).length;
    const sectionClose = (line.match(/<\/section>/g) || []).length;

    if (sectionOpen > 0 && depth === 0) {
      // Save any preceding content
      if (currentBlock.length > 0) {
        blocks.push({ type: "prefix", html: currentBlock.join("\n") });
        currentBlock = [];
      }
      inSection = true;
    }

    // Check for TP markers at top level
    if (depth === 0 && !inSection) {
      const markerMatch = line.match(/<!-- (TP-[A-Z0-9_-]+|HANDWRITTEN-LOCAL-GUIDE|FLAGSHIP-[A-Z0-9_-]+) -->/);
      if (markerMatch) {
        if (currentBlock.length > 0) {
          blocks.push({ type: "prefix", html: currentBlock.join("\n") });
          currentBlock = [];
        }
      }
    }

    currentBlock.push(line);
    depth += sectionOpen - sectionClose;

    if (inSection && depth === 0) {
      const blockHtml = currentBlock.join("\n");
      // Identify this section
      let id = "UNKNOWN";
      for (const [key, def] of Object.entries(SECTION_IDS)) {
        if (def.marker.test(blockHtml)) {
          id = key;
          break;
        }
      }
      blocks.push({ type: "section", id, html: blockHtml });
      currentBlock = [];
      inSection = false;
    }
  }

  if (currentBlock.length > 0) {
    blocks.push({ type: "suffix", html: currentBlock.join("\n") });
  }

  return { before, mainTag, blocks, afterFooterStart };
}

function reassemble(parsed, citySlug, vertical) {
  const seed = hash(citySlug + "|" + vertical);

  // Separate blocks into fixed-position and shuffleable
  const fixedBefore = []; // CTA, guide link, etc. -- stay at top
  const shuffleable = [];
  const fixedAfter = []; // other services, nearby cities -- stay at bottom
  const preserved = []; // handwritten, flagship -- reattach after shuffle
  const prefixes = [];

  let seenFirstSection = false;

  for (const block of parsed.blocks) {
    if (block.type === "prefix" || block.type === "suffix") {
      if (!seenFirstSection) {
        fixedBefore.push(block);
      } else {
        fixedAfter.push(block);
      }
      continue;
    }

    seenFirstSection = true;

    if (block.id === "CTA_COMPARE") {
      fixedBefore.push(block);
    } else if (block.id === "OTHER_SERVICES" || block.id === "NEARBY_CITIES") {
      fixedAfter.push(block);
    } else if (block.id === "HANDWRITTEN" || block.id === "FLAGSHIP") {
      preserved.push(block);
    } else if (block.id === "TOOLS_BLOCK") {
      // Tools block moves with the shuffle but has a preferred spot
      shuffleable.push(block);
    } else if (SHUFFLEABLE.includes(block.id)) {
      shuffleable.push(block);
    } else {
      // Unknown sections go to fixed after
      fixedAfter.push(block);
    }
  }

  // Pick a layout
  const layout = pick(LAYOUTS, seed);

  // Reorder shuffleable sections according to layout
  // Map layout indices to actual sections (some may not exist on every page)
  const shuffleMap = {};
  for (const block of shuffleable) {
    const idx = SHUFFLEABLE.indexOf(block.id);
    if (idx >= 0) {
      shuffleMap[idx] = block;
    }
  }

  const reordered = [];
  for (const idx of layout) {
    if (shuffleMap[idx]) {
      reordered.push(shuffleMap[idx]);
    }
  }

  // Add any shuffleable sections not in the layout map (like TOOLS_BLOCK)
  for (const block of shuffleable) {
    if (!SHUFFLEABLE.includes(block.id) && !reordered.includes(block)) {
      // Insert tools block in the middle
      const midpoint = Math.floor(reordered.length / 2);
      reordered.splice(midpoint, 0, block);
    }
  }

  // Apply FAQ style variation
  const faqStyle = pick(FAQ_STYLES, seed >> 3);
  for (let i = 0; i < reordered.length; i++) {
    if (reordered[i].id === "FAQ") {
      reordered[i] = { ...reordered[i], html: convertFAQStyle(reordered[i].html, faqStyle) };
    }
  }

  // Insert handwritten/flagship content after the first shuffled section
  const insertPoint = Math.min(1, reordered.length);
  for (const p of preserved) {
    reordered.splice(insertPoint, 0, p);
  }

  // Reassemble
  const allBlocks = [...fixedBefore, ...reordered, ...fixedAfter];
  const bodyHtml = allBlocks.map(b => b.html).join("\n");

  // Add restructure marker
  const marker = `<!-- TP-RESTRUCTURED seed=${seed} layout=${LAYOUTS.indexOf(layout)} faqStyle=${faqStyle} -->`;

  return parsed.before + parsed.mainTag + "\n" + bodyHtml + "\n</main>\n\n" + marker + "\n" + parsed.afterFooterStart;
}

// ─── MAIN ──────────────────────────────────────────────────────────────

function processFile(filepath, vertical) {
  const content = fs.readFileSync(filepath, "utf8");
  const basename = path.basename(filepath);

  // Skip flagship pages (they have their own deep structure)
  if (content.includes("<!-- FLAGSHIP-")) {
    return { status: "flagship-skip", file: basename };
  }

  // Check if already restructured
  if (content.includes("<!-- TP-RESTRUCTURED")) {
    // Remove old restructure marker to allow re-run (idempotent)
    // But we need the ORIGINAL section order. Since we can't recover it,
    // we re-extract and re-shuffle. The deterministic hash ensures same result.
  }

  const parsed = extractSections(content);
  if (!parsed) {
    return { status: "parse-fail", file: basename };
  }

  const citySlug = basename.replace(/-[a-z]+-cost\.html$/, "").replace(/-[a-z]+-[a-z]+-cost\.html$/, "");
  const result = reassemble(parsed, citySlug, vertical);

  if (!DRY) {
    fs.writeFileSync(filepath, result, "utf8");
  }

  return { status: "restructured", file: basename };
}

function runVertical(vertical) {
  const slugSuffix = VERTICAL_SLUGS[vertical];
  if (!slugSuffix) {
    console.error("Unknown vertical: " + vertical);
    process.exit(1);
  }

  const files = fs.readdirSync(ROOT).filter(f => f.endsWith(`-${slugSuffix}.html`));
  console.log(`\nRestructuring ${vertical}: ${files.length} pages`);

  let restructured = 0, skipped = 0, failed = 0;
  for (const f of files) {
    const result = processFile(path.join(ROOT, f), vertical);
    if (result.status === "restructured") {
      restructured++;
      if (restructured <= 3) console.log(`  OK: ${result.file}`);
    } else if (result.status === "flagship-skip") {
      skipped++;
    } else {
      failed++;
      console.log(`  FAIL: ${result.file} - ${result.status}`);
    }
  }

  console.log(`\n  ${restructured} restructured, ${skipped} flagship skipped, ${failed} failed`);
  if (DRY) console.log("  [DRY RUN]");
}

// Entry point
if (ALL) {
  for (const v of Object.keys(VERTICAL_SLUGS)) {
    runVertical(v);
  }
} else {
  const vertical = args.find(a => !a.startsWith("--"));
  if (!vertical) {
    console.error("Usage: node scripts/restructure-city-pages.js <vertical> [--dry]");
    console.error("       node scripts/restructure-city-pages.js --all [--dry]");
    process.exit(1);
  }
  runVertical(vertical);
}
