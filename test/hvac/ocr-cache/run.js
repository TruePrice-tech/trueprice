#!/usr/bin/env node
// Layer 2 — HVAC parser vs cached real-image OCR. ~30ms.

const fs = require("fs");
const path = require("path");
const parser = require("../load-parser");

const CACHE = __dirname;
// Ground truth — populate as fixtures get OCR'd. Use minConfidence:"low"
// because real OCR rarely cleanly agrees across all 3 strategies.
const EXPECTED = {
  "comparison-ac-01-low.png":         { price: 5800,  minConfidence: "low" },
  "comparison-ac-02-mid.png":         { price: 9450,  minConfidence: "low" },
  "comparison-ac-03-high.png":        { price: 16200, minConfidence: "low" },
  "messy-comparison-ac-01-low.jpg":   { price: 5800,  minConfidence: "low" },
  "messy-comparison-ac-02-mid.jpg":   { price: 9450,  minConfidence: "low" },
  "messy-comparison-ac-03-high.jpg":  { price: 16200, minConfidence: "low" }
};

const CONF_RANK = { low: 0, medium: 1, high: 2 };

function pricesMatch(exp, act) {
  if (exp == null && act == null) return true;
  if (exp == null || act == null) return false;
  const tol = Math.max(50, exp * 0.05);
  return Math.abs(exp - act) <= tol;
}

const cached = fs.readdirSync(CACHE).filter(n => n.endsWith(".txt")).sort();
if (!cached.length) {
  console.log("No cached OCR files. Run: node test/hvac/ocr-cache/refresh.js");
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
    const r = parser.parseExtractedTextMultiStrategy(text, "hvac");
    actual = r.finalPrice;
    conf = r.priceConfidence;
    agreed = r.strategiesAgreed;
    if (!exp) status = "UNLABELED";
    else {
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

console.log("── Layer 2 — HVAC Real OCR Cache Tests ──");
const W = { s: 8, n: 42, e: 10, a: 10, c: 8 };
console.log(`${"STATUS".padEnd(W.s)} ${"FIXTURE".padEnd(W.n)} ${"EXPECT".padEnd(W.e)} ${"GOT".padEnd(W.a)} ${"CONF".padEnd(W.c)} AGR  CHARS`);
console.log("-".repeat(95));
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
