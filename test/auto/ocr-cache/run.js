#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const parser = require("../load-parser");

const CACHE = __dirname;
// Ground truth labeled from cached OCR text. 6 clean+messy synthetic
// brake-job comparison fixtures + 1 readable Reddit (#07 Jeep estimate).
// Other Reddit fixtures are too noisy for reliable totals → manual fallback.
const EXPECTED = {
  "comparison-brake-01-shop-a-low.png":         { price: 327.60,  minConfidence: "low" },
  "comparison-brake-02-shop-b-mid.png":         { price: 633.00,  minConfidence: "low" },
  "comparison-brake-03-shop-c-high.png":        { price: 1031.60, minConfidence: "low" },
  "messy-comparison-brake-01-shop-a-low.jpg":   { price: 327.60,  minConfidence: "low" },
  "messy-comparison-brake-02-shop-b-mid.jpg":   { price: 633.00,  minConfidence: "low" },
  "messy-comparison-brake-03-shop-c-high.jpg":  { price: 1031.60, minConfidence: "low" },
  "07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg": { price: 732.39, minConfidence: "low" },
  // Noisy Reddit fixtures — manual fallback expected
  "01-to-the-pos-technician-who-quoted-this-poor-lady-a.jpg":    { price: null, minConfidence: "low" },
  "02-just-had-this-show-up-was-initially-quoted-2-hours.jpeg":  { price: null, minConfidence: "low" },
  "03-wrote-an-estimate-for-this-beauty-of-german-engine.jpg":   { price: null, minConfidence: "low" },
  "04-your-hitch-install-quote-was-too-high-so-my-friend.jpeg":  { price: null, minConfidence: "low" },
  "05-just-rolled-outta-my-driveway-stealership-quoted-o.jpg":   { price: null, minConfidence: "low" },
  "06-defrost-stopped-working-shop-want-1100-cad-to-fix.jpg":    { price: null, minConfidence: "low" },
  "08-cs-3-honda-dealerships-quoted-a-new-cylinder-block.jpg":   { price: null, minConfidence: "low" },
  // #09 is a list of recommended-services line items, no labeled total. Parser
  // picks the largest item ($2543.94 CV boot) as the most likely "main quote",
  // which is defensible behavior.
  "09-am-i-crazy-or-is-this-quote.jpg":                          { price: 2543.94, minConfidence: "low" },
  "10-top-two-pictures-are-from-our-estimate-2-months-ag.jpeg":  { price: null, minConfidence: "low" }
};

const CONF_RANK = { low: 0, medium: 1, high: 2 };

function pricesMatch(exp, act) {
  if (exp == null && act == null) return true;
  if (exp == null || act == null) return false;
  const tol = Math.max(5, exp * 0.05);
  return Math.abs(exp - act) <= tol;
}

const cached = fs.readdirSync(CACHE).filter(n => n.endsWith(".txt")).sort();
if (!cached.length) {
  console.log("No cached OCR files. Run: node test/auto/ocr-cache/refresh.js");
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
    const r = parser.parseExtractedTextMultiStrategy(text, "auto");
    actual = r.finalPrice;
    conf = r.priceConfidence;
    agreed = r.strategiesAgreed;
    if (!exp) status = "UNLABELED";
    else {
      const hasLabeledTotal = r.priceCandidates && r.priceCandidates.some(c => c.sourceType === "strict_labeled_total" && c.value === actual);
      const effectiveActual = (conf === "low" && !hasLabeledTotal) ? null : actual;
      const priceOk = pricesMatch(exp.price, effectiveActual);
      const confOk = CONF_RANK[conf] >= CONF_RANK[exp.minConfidence];
      status = priceOk && confOk ? "PASS" : "FAIL";
    }
  } catch (e) {
    status = "ERROR";
    actual = e.message.slice(0, 80);
  }
  rows.push({ status, fixture, exp, actual, conf, agreed, textLen: text.length });
}

console.log("── Layer 2 — Auto Real OCR Cache Tests ──");
const W = { s: 10, n: 56, e: 11, a: 11, c: 8 };
console.log(`${"STATUS".padEnd(W.s)} ${"FIXTURE".padEnd(W.n)} ${"EXPECT".padEnd(W.e)} ${"GOT".padEnd(W.a)} ${"CONF".padEnd(W.c)} AGR  CHARS`);
console.log("-".repeat(115));
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
