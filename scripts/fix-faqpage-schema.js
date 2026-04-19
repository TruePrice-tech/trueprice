#!/usr/bin/env node
/**
 * fix-faqpage-schema.js
 *
 * Fixes corrupted FAQPage JSON-LD schema blocks caused by $1 regex bug.
 * - Extracts all valid Question/Answer pairs from the corrupted block
 * - Deduplicates by question name
 * - Rebuilds a clean FAQPage JSON-LD block
 *
 * Usage:
 *   node scripts/fix-faqpage-schema.js <file>           # fix single file
 *   node scripts/fix-faqpage-schema.js <file> --dry      # preview without writing
 *   node scripts/fix-faqpage-schema.js --vertical concrete        # fix all concrete pages
 *   node scripts/fix-faqpage-schema.js --vertical concrete --dry  # preview
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const verticalIdx = args.indexOf("--vertical");

function extractFAQs(corruptedText) {
  // First try: minified format (most common)
  const faqs = [];
  const re = /\{"@type":"Question","name":"((?:[^"\\]|\\.)*)","acceptedAnswer":\{"@type":"Answer","text":"((?:[^"\\]|\\.)*)"\}\}/g;
  let match;
  while ((match = re.exec(corruptedText)) !== null) {
    faqs.push({ q: match[1], a: match[2] });
  }

  // Second try: pretty-printed format (whitespace between keys)
  if (faqs.length === 0) {
    const re2 = /"@type":\s*"Question",\s*"name":\s*"((?:[^"\\]|\\.)*)"\s*,\s*"acceptedAnswer":\s*\{\s*"@type":\s*"Answer"\s*,\s*"text":\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
    while ((match = re2.exec(corruptedText)) !== null) {
      faqs.push({ q: match[1], a: match[2] });
    }
  }

  return faqs;
}

function deduplicateFAQs(faqs) {
  const seen = new Set();
  const unique = [];
  for (const faq of faqs) {
    if (!seen.has(faq.q)) {
      seen.add(faq.q);
      unique.push(faq);
    }
  }
  return unique;
}

function buildCleanFAQSchema(faqs) {
  const entries = faqs.map(f =>
    JSON.stringify({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    })
  );
  return '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[' + entries.join(",") + "]}";
}

function fixFile(filepath) {
  let content = fs.readFileSync(filepath, "utf8");

  // Find ALL JSON-LD script blocks, then filter to ones containing FAQPage
  const allBlockRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = allBlockRe.exec(content)) !== null) {
    if (m[1].includes("FAQPage")) {
      matches.push({ full: m[0], body: m[1], index: m.index });
    }
  }

  if (matches.length === 0) {
    return { status: "no-faq-block", file: path.basename(filepath) };
  }

  // Check if any block is corrupted or has duplicates
  let anyCorrupted = false;
  let anyDuplicates = false;
  for (const block of matches) {
    try {
      const parsed = JSON.parse(block.body.trim());
      if (parsed.mainEntity) {
        const names = parsed.mainEntity.map(e => e.name);
        if (new Set(names).size < names.length) anyDuplicates = true;
      }
    } catch (e) {
      anyCorrupted = true;
    }
  }

  // Also check: multiple FAQPage blocks = duplicates
  if (matches.length > 1) anyDuplicates = true;

  if (!anyCorrupted && !anyDuplicates) {
    return { status: "clean", file: path.basename(filepath) };
  }

  // Extract all valid Q&A pairs from ALL FAQPage blocks
  const allText = matches.map(b => b.body).join("\n");
  const allFAQs = extractFAQs(allText);
  if (allFAQs.length === 0) {
    return { status: "no-faqs-found", file: path.basename(filepath) };
  }

  // Deduplicate
  const uniqueFAQs = deduplicateFAQs(allFAQs);

  // Build clean schema
  const cleanSchema = buildCleanFAQSchema(uniqueFAQs);

  // Verify the clean schema is valid JSON
  try {
    JSON.parse(cleanSchema);
  } catch (e) {
    return { status: "rebuild-invalid", file: path.basename(filepath), error: e.message };
  }

  // Remove ALL FAQPage script blocks, then insert one clean block at the position of the first
  let newContent = content;
  // Remove from last to first to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const block = matches[i];
    newContent = newContent.slice(0, block.index) + newContent.slice(block.index + block.full.length);
  }

  // Insert clean block at position of first original block
  const cleanBlock = '<script type="application/ld+json">\n' + cleanSchema + '\n</script>';
  newContent = newContent.slice(0, matches[0].index) + cleanBlock + newContent.slice(matches[0].index);

  if (!DRY) {
    fs.writeFileSync(filepath, newContent, "utf8");
  }

  return {
    status: "fixed",
    file: path.basename(filepath),
    wasCorrupted: anyCorrupted,
    hadDuplicates: anyDuplicates,
    faqBlocks: matches.length,
    originalFAQs: allFAQs.length,
    uniqueFAQs: uniqueFAQs.length
  };
}

// Main
if (verticalIdx >= 0) {
  const vertical = args[verticalIdx + 1];
  if (!vertical) {
    console.error("Usage: --vertical <name>");
    process.exit(1);
  }

  const suffix = `-${vertical}-cost.html`;
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith(suffix));
  console.log(`\nFixing FAQPage schema for ${vertical}: ${files.length} pages`);

  let fixed = 0, clean = 0, noBlock = 0, errors = 0;
  for (const f of files) {
    const result = fixFile(path.join(ROOT, f));
    if (result.status === "fixed") {
      fixed++;
      if (fixed <= 5) {
        console.log(`  FIXED: ${result.file} (${result.originalFAQs} -> ${result.uniqueFAQs} FAQs, corrupted=${result.wasCorrupted}, dupes=${result.hadDuplicates})`);
      }
    } else if (result.status === "clean") {
      clean++;
    } else if (result.status === "no-faq-block") {
      noBlock++;
    } else {
      errors++;
      console.log(`  ERROR: ${result.file} - ${result.status} ${result.error || ""}`);
    }
  }

  console.log(`\n  ${fixed} fixed, ${clean} already clean, ${noBlock} no FAQ block, ${errors} errors`);
  if (DRY) console.log("  [DRY RUN: no files written]");
} else {
  // Single file mode
  const file = args.find(a => a !== "--dry" && !a.startsWith("--"));
  if (!file) {
    console.error("Usage: node scripts/fix-faqpage-schema.js <file> [--dry]");
    console.error("       node scripts/fix-faqpage-schema.js --vertical <name> [--dry]");
    process.exit(1);
  }

  const filepath = path.resolve(ROOT, file);
  const result = fixFile(filepath);
  console.log(JSON.stringify(result, null, 2));
}
