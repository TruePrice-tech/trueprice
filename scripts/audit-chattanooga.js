#!/usr/bin/env node
/**
 * audit-chattanooga.js
 *
 * Per-page uniqueness check: for each Chattanooga page, compare its sentences
 * against ALL other pages in its vertical and report the % of sentences that
 * are unique (appear nowhere else in the vertical).
 *
 * Usage: node scripts/audit-chattanooga.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");

const VERTICALS = [
  { name: "auto-repair", pattern: "-auto-repair-cost.html" },
  { name: "medical",     pattern: "-medical-cost.html" },
  { name: "legal",       pattern: "-legal-cost.html" },
  { name: "moving",      pattern: "-moving-cost.html" },
];

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

function extractVisibleText(html) {
  let text = extractBody(html);
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&\w+;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractSentences(text) {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 20);
}

function normalizeSentence(sentence, cityName, stateCode) {
  let s = sentence.toLowerCase();
  const cityLower = cityName.toLowerCase();
  s = s.replace(new RegExp(cityLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "CITY");
  s = s.replace(new RegExp("\\b" + stateCode.toLowerCase() + "\\b", "g"), "ST");
  s = s.replace(/\$[\d,.]+[km]?/gi, "DOLLAR");
  s = s.replace(/\d+(\.\d+)?%/g, "PCT");
  s = s.replace(/\b\d[\d,.]*\b/g, "NUM");
  return s.trim();
}

function sentenceHash(s) {
  return crypto.createHash("md5").update(s).digest("hex").slice(0, 12);
}

function parseCityState(filename, pattern) {
  const prefix = filename.replace(pattern, "");
  const parts = prefix.split("-");
  const stateCode = parts.pop().toUpperCase();
  const cityName = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { cityName, stateCode };
}

console.log("=".repeat(80));
console.log("CHATTANOOGA PAGE UNIQUENESS vs ALL PEERS IN VERTICAL");
console.log("Each Chattanooga page's % of sentences unique to that page");
console.log("=".repeat(80));

for (const v of VERTICALS) {
  const allFiles = fs.readdirSync(ROOT).filter(f => f.endsWith(v.pattern));
  const chattFile = allFiles.find(f => f.startsWith("chattanooga-tn"));
  if (!chattFile) {
    console.log(`\n${v.name.padEnd(14)} : no Chattanooga file found`);
    continue;
  }

  // Build set of all hashes from ALL OTHER pages in the vertical
  const otherHashes = new Set();
  let totalOtherPages = 0;
  for (const f of allFiles) {
    if (f === chattFile) continue;
    const html = fs.readFileSync(path.join(ROOT, f), "utf8");
    const { cityName, stateCode } = parseCityState(f, v.pattern);
    const sentences = extractSentences(extractVisibleText(html));
    for (const s of sentences) {
      otherHashes.add(sentenceHash(normalizeSentence(s, cityName, stateCode)));
    }
    totalOtherPages++;
  }

  // Now check Chattanooga page
  const chattHtml = fs.readFileSync(path.join(ROOT, chattFile), "utf8");
  const { cityName, stateCode } = parseCityState(chattFile, v.pattern);
  const chattSentences = extractSentences(extractVisibleText(chattHtml));
  const chattHashes = chattSentences.map(s => sentenceHash(normalizeSentence(s, cityName, stateCode)));

  const totalSentences = chattHashes.length;
  const sharedSentences = chattHashes.filter(h => otherHashes.has(h)).length;
  const uniqueSentences = totalSentences - sharedSentences;
  const pctUnique = totalSentences > 0 ? Math.round((uniqueSentences / totalSentences) * 100) : 0;

  console.log(`\n${v.name.padEnd(14)} : ${pctUnique}% unique`);
  console.log(`  ${totalSentences} total sentences in Chattanooga page`);
  console.log(`  ${uniqueSentences} unique to Chattanooga (not in any of ${totalOtherPages} peer pages)`);
  console.log(`  ${sharedSentences} shared with at least one peer page`);
}

console.log("");
console.log("=".repeat(80));
console.log("Note: sentences are normalized (city/state/numbers/$ replaced) before comparison.");
console.log("So shared sentences are templatey ones like \"Most homeowners pay between $X-$Y...\"");
console.log("=".repeat(80));
