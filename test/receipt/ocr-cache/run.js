#!/usr/bin/env node
// Layer 2 run — load cached Tesseract OCR text per fixture, run through
// verifyReceipt() with each fixture's declared vertical + amount, assert
// the bucket (PASS / REVIEW / FAIL) and key extracted fields match the
// recorded expectations.
//
// Why this exists: the unit tests in ../unit/ feed clean hand-curated text
// to verifyReceipt; this layer feeds REAL Tesseract output. Catches
// regressions in the regex extraction patterns when OCR output drifts
// (e.g., "Total job price $610" the regex doesn't match — caught here,
// not in unit/).
//
// Run:
//   node test/receipt/ocr-cache/run.js
//
// Refresh OCR cache first if fixtures changed:
//   node test/receipt/ocr-cache/refresh.js

import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(ROOT, "cache");
const EXPECTED = JSON.parse(fs.readFileSync(path.join(ROOT, "expected.json"), "utf8"));

const verifierPath = pathToFileURL(
  path.resolve(ROOT, "..", "..", "..", "api", "_woogoros-verifier.js")
).href;
const { verifyReceipt } = await import(verifierPath);

const FAKE_HASH = "a".repeat(64);

function bucket(r) {
  if (r.pass) return "pass";
  if (r.requiresReview) return "review";
  return "fail";
}

const cached = fs.readdirSync(CACHE).filter((n) => n.endsWith(".txt")).sort();
if (!cached.length) {
  console.log("No cached OCR. Run: node test/receipt/ocr-cache/refresh.js");
  process.exit(0);
}

const t0 = Date.now();
let passed = 0;
let failed = 0;
const issues = [];

for (const txtName of cached) {
  const fixture = txtName.replace(/\.txt$/, "");
  const text = fs.readFileSync(path.join(CACHE, txtName), "utf8");
  const exp = EXPECTED[fixture];
  if (!exp) {
    issues.push(`${fixture}: no entry in expected.json`);
    failed++;
    continue;
  }

  const result = await verifyReceipt({
    text,
    declaredVertical: exp.declaredVertical,
    declaredAmount: exp.declaredAmount,
    imageHash: FAKE_HASH,
    hasImage: true,
  });

  const got = bucket(result);
  const want = exp.expectedBucket;
  let mismatch = [];
  if (got !== want) {
    mismatch.push(`bucket: want=${want} got=${got} trust=${result.trustScore} reasons=${(result.reasons || []).join(",")}`);
  }
  if (exp.minTrust != null && result.trustScore < exp.minTrust) {
    mismatch.push(`trust=${result.trustScore} below minTrust=${exp.minTrust}`);
  }
  if (exp.maxTrust != null && result.trustScore > exp.maxTrust) {
    mismatch.push(`trust=${result.trustScore} above maxTrust=${exp.maxTrust}`);
  }
  if (exp.expectExtractedTotal != null) {
    const want = exp.expectExtractedTotal;
    const got = result.fields && result.fields.total;
    const ok = (want === null && got == null) || (want != null && got != null && Math.abs(got - want) < 0.5);
    if (!ok) mismatch.push(`extractedTotal: want=${want} got=${got}`);
  }

  if (mismatch.length === 0) {
    passed++;
    console.log(`  PASS  ${fixture}  bucket=${got} trust=${result.trustScore}`);
  } else {
    failed++;
    issues.push(`${fixture}:\n    ${mismatch.join("\n    ")}`);
    console.log(`  FAIL  ${fixture}  bucket=${got} trust=${result.trustScore}`);
  }
}

const ms = Date.now() - t0;
console.log(`\n${passed} passed, ${failed} failed (${ms}ms across ${cached.length} fixtures)`);
if (failed > 0) {
  console.log("\nFailure detail:");
  for (const x of issues) console.log("  - " + x);
  process.exit(1);
}
process.exit(0);
