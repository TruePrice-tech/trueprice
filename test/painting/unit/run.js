#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const parser = require("../load-parser");

const SNIP_DIR = path.join(__dirname, "snippets");
const EXPECTED = JSON.parse(fs.readFileSync(path.join(__dirname, "expected.json"), "utf8"));
const CONF_RANK = { low: 0, medium: 1, high: 2 };

function pricesMatch(exp, act) {
  if (exp == null && act == null) return true;
  if (exp == null || act == null) return false;
  const tol = Math.max(50, exp * 0.05);
  return Math.abs(exp - act) <= tol;
}

const snippets = fs.readdirSync(SNIP_DIR).filter(n => n.endsWith(".txt")).sort();
const rows = [];
const t0 = Date.now();
for (const name of snippets) {
  const text = fs.readFileSync(path.join(SNIP_DIR, name), "utf8");
  const exp = EXPECTED[name];
  let status, actual, conf, agreed;
  try {
    const r = parser.parseExtractedTextMultiStrategy(text, "painting");
    actual = r.finalPrice; conf = r.priceConfidence; agreed = r.strategiesAgreed;
    if (!exp) status = "UNLABELED";
    else {
      const priceOk = pricesMatch(exp.price, actual);
      const confOk = CONF_RANK[conf] >= CONF_RANK[exp.minConfidence];
      status = priceOk && confOk ? "PASS" : "FAIL";
    }
  } catch (e) { status = "ERROR"; actual = e.message.slice(0, 80); }
  rows.push({ status, name, expected: exp ? exp.price : null, actual, conf, agreed });
}
const elapsed = Date.now() - t0;
console.log("── Layer 1 — painting Parser Unit Tests ──");
const W = { s: 8, n: 38, e: 10, a: 10, c: 10 };
console.log(`${"STATUS".padEnd(W.s)} ${"SNIPPET".padEnd(W.n)} ${"EXPECT".padEnd(W.e)} ${"GOT".padEnd(W.a)} ${"CONF".padEnd(W.c)} AGR`);
console.log("-".repeat(86));
for (const r of rows) {
  const e = r.expected == null ? "—" : `$${r.expected}`;
  const a = r.actual == null ? "(null)" : (typeof r.actual === "number" ? `$${r.actual}` : r.actual);
  console.log(`${r.status.padEnd(W.s)} ${r.name.padEnd(W.n)} ${e.padEnd(W.e)} ${String(a).padEnd(W.a)} ${(r.conf||"—").padEnd(W.c)} ${r.agreed ?? "—"}`);
}
const pass = rows.filter(r => r.status === "PASS").length;
const fail = rows.filter(r => r.status === "FAIL").length;
const err  = rows.filter(r => r.status === "ERROR").length;
const labeled = rows.filter(r => r.status !== "UNLABELED").length;
console.log("");
console.log(`${pass}/${labeled} PASS   ${fail} FAIL   ${err} ERROR   (${elapsed}ms)`);
process.exit(fail + err > 0 ? 1 : 0);
