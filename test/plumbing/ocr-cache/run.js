#!/usr/bin/env node
// Layer 2 — parse cached OCR text from real images. ~seconds, no browser.
// Catches: "parser works on clean text but fails on real Tesseract output".

const fs = require("fs");
const path = require("path");
const parser = require("../load-parser");

const CACHE = __dirname;
const EXPECTED = {
  "comparison-wh-01-low.png":         { price: 1380, minConfidence: "low" },
  "comparison-wh-02-mid.png":         { price: 2553, minConfidence: "low" },
  "comparison-wh-03-high.png":        { price: 7571, minConfidence: "low" },
  "messy-comparison-wh-01-low.jpg":   { price: 1380, minConfidence: "low" },
  "messy-comparison-wh-02-mid.jpg":   { price: 2553, minConfidence: "low" },
  "messy-comparison-wh-03-high.jpg":  { price: 7571, minConfidence: "low" },
  "02-contractor-says-1800-to-move-water-supply-into-the.jpeg": { price: 1800, minConfidence: "low" }
};

const CONF_RANK = { low: 0, medium: 1, high: 2 };

function pricesMatch(exp, act) {
  if (exp == null || act == null) return false;
  const tol = Math.max(50, exp * 0.05);
  return Math.abs(exp - act) <= tol;
}

const cached = fs.readdirSync(CACHE).filter(n => n.endsWith(".txt")).sort();
if (!cached.length) {
  console.log("No cached OCR files. Run: node test/plumbing/ocr-cache/refresh.js");
  process.exit(0);
}

const rows = [];
const t0 = Date.now();
for (const txt of cached) {
  const fixture = txt.replace(/\.txt$/, "");
  const text = fs.readFileSync(path.join(CACHE, txt), "utf8");
  const exp = EXPECTED[fixture];
  let status, actual, conf, agreed;
  try {
    const r = parser.parseExtractedTextMultiStrategy(text, "plumbing");
    actual = r.finalPrice;
    conf = r.priceConfidence;
    agreed = r.strategiesAgreed;
    if (!exp) {
      status = "UNLABELED";
    } else {
      const priceOk = pricesMatch(exp.price, actual);
      const confOk = CONF_RANK[conf] >= CONF_RANK[exp.minConfidence];
      status = priceOk && confOk ? "PASS" : "FAIL";
    }
  } catch (e) {
    status = "ERROR";
    actual = e.message.slice(0, 80);
  }
  rows.push({ status, fixture, exp, actual, conf, agreed, textLen: text.length });
}

console.log("── Layer 2 — Real OCR Cache Tests ──");
const W = { s: 8, n: 56, e: 10, a: 10, c: 8 };
console.log(`${"STATUS".padEnd(W.s)} ${"FIXTURE".padEnd(W.n)} ${"EXPECT".padEnd(W.e)} ${"GOT".padEnd(W.a)} ${"CONF".padEnd(W.c)} AGR  OCRCHARS`);
console.log("-".repeat(110));
for (const r of rows) {
  const e = r.exp ? `$${r.exp.price}` : "—";
  const a = r.actual == null ? "(null)" : (typeof r.actual === "number" ? `$${r.actual}` : r.actual);
  console.log(`${r.status.padEnd(W.s)} ${r.fixture.padEnd(W.n)} ${e.padEnd(W.e)} ${String(a).padEnd(W.a)} ${(r.conf||"—").padEnd(W.c)} ${r.agreed ?? "—"}    ${r.textLen}`);
}
const pass = rows.filter(r => r.status === "PASS").length;
const fail = rows.filter(r => r.status === "FAIL").length;
const labeled = rows.filter(r => r.status !== "UNLABELED").length;
console.log("");
console.log(`${pass}/${labeled} PASS   ${fail} FAIL   (${Date.now()-t0}ms)`);
process.exit(fail > 0 ? 1 : 0);
