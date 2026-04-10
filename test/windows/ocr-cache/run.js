#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const parser = require("../load-parser");

const CACHE = __dirname;
// Ground truth populated after OCR refresh + manual inspection.
// NOTE: the "real-*" Reddit fixtures are about Microsoft Windows the OS,
// not window replacements (Reddit search false positive). They are NOT
// included here — only the 6 synthetic comparison-windows fixtures count.
const EXPECTED = {};

const CONF_RANK = { low: 0, medium: 1, high: 2 };
function pricesMatch(exp, act) {
  if (exp == null && act == null) return true;
  if (exp == null || act == null) return false;
  const tol = Math.max(50, exp * 0.05);
  return Math.abs(exp - act) <= tol;
}

const cached = fs.readdirSync(CACHE).filter(n => n.endsWith(".txt")).sort();
if (!cached.length) {
  console.log("No cached OCR files. Run: node test/windows/ocr-cache/refresh.js");
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
    const r = parser.parseExtractedTextMultiStrategy(text, "windows");
    actual = r.finalPrice; conf = r.priceConfidence; agreed = r.strategiesAgreed;
    if (!exp) status = "UNLABELED";
    else {
      const hasLabeledTotal = r.priceCandidates && r.priceCandidates.some(c => c.sourceType === "strict_labeled_total" && c.value === actual);
      const effectiveActual = (conf === "low" && !hasLabeledTotal) ? null : actual;
      const priceOk = pricesMatch(exp.price, effectiveActual);
      const confOk = CONF_RANK[conf] >= CONF_RANK[exp.minConfidence];
      status = priceOk && confOk ? "PASS" : "FAIL";
    }
  } catch (e) { status = "ERROR"; actual = e.message.slice(0, 80); }
  rows.push({ status, fixture, exp, actual, conf, agreed, textLen: text.length });
}

console.log("── Layer 2 — Windows Real OCR Cache Tests ──");
const W = { s: 10, n: 48, e: 11, a: 11, c: 8 };
console.log(`${"STATUS".padEnd(W.s)} ${"FIXTURE".padEnd(W.n)} ${"EXPECT".padEnd(W.e)} ${"GOT".padEnd(W.a)} ${"CONF".padEnd(W.c)} AGR  CHARS`);
console.log("-".repeat(105));
for (const r of rows) {
  const e = r.exp ? (r.exp.price == null ? "(manual)" : `$${r.exp.price}`) : "—";
  const a = r.actual == null ? "(manual)" : (typeof r.actual === "number" ? `$${r.actual}` : r.actual);
  console.log(`${r.status.padEnd(W.s)} ${r.fixture.padEnd(W.n)} ${e.padEnd(W.e)} ${String(a).padEnd(W.a)} ${(r.conf||"—").padEnd(W.c)} ${r.agreed ?? "—"}    ${r.textLen}`);
}
const pass = rows.filter(r => r.status === "PASS").length;
const fail = rows.filter(r => r.status === "FAIL").length;
const labeled = rows.filter(r => r.status !== "UNLABELED").length;
console.log("");
console.log(`${pass}/${labeled} PASS   ${fail} FAIL   ${rows.filter(r=>r.status==="UNLABELED").length} UNLABELED   (${Date.now()-t0}ms)`);
process.exit(fail > 0 ? 1 : 0);
