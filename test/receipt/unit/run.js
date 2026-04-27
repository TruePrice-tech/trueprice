#!/usr/bin/env node
// Layer 1 — receipt verifier unit tests. <1 second. No browser, no network.
//
// Loads fixture OCR text from snippets/, runs verifyReceipt() and
// extractReceiptFields() with the declared vertical/amount from
// expected.json, and asserts the verification bucket (PASS / REVIEW /
// FAIL) plus extracted fields match expectations.
//
// Why fixtures + buckets, not exact trust scores: the trust score
// formula is internal and tunable. The bucket boundary (auto-grant
// vs admin review vs reject) IS the user-visible contract. Tests
// should assert THAT, not the exact number that produced it.
//
// Run: node test/receipt/unit/run.js

import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SNIP_DIR = path.join(ROOT, "snippets");
const EXPECTED = JSON.parse(fs.readFileSync(path.join(ROOT, "expected.json"), "utf8"));

const verifierPath = pathToFileURL(
  path.resolve(ROOT, "..", "..", "..", "api", "_woogoros-verifier.js")
).href;
const { verifyReceipt, extractReceiptFields } = await import(verifierPath);

const FAKE_HASH = "a".repeat(64);

function bucket(result) {
  if (result.pass) return "pass";
  if (result.requiresReview) return "review";
  return "fail";
}

const snippets = fs.readdirSync(SNIP_DIR).filter((n) => n.endsWith(".txt")).sort();
const t0 = Date.now();
let passed = 0;
let failed = 0;
const issues = [];

for (const name of snippets) {
  const text = fs.readFileSync(path.join(SNIP_DIR, name), "utf8");
  const exp = EXPECTED[name];
  if (!exp) {
    issues.push(`${name}: NO ENTRY in expected.json`);
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
  if (exp.expectReason && !(result.reasons || []).includes(exp.expectReason)) {
    mismatch.push(`expected reason "${exp.expectReason}" missing; reasons=${(result.reasons || []).join(",")}`);
  }
  if (exp.minTrust != null && result.trustScore < exp.minTrust) {
    mismatch.push(`trust=${result.trustScore} below minTrust=${exp.minTrust}`);
  }
  if (exp.maxTrust != null && result.trustScore > exp.maxTrust) {
    mismatch.push(`trust=${result.trustScore} above maxTrust=${exp.maxTrust}`);
  }
  if (exp.expectFields) {
    const f = result.fields || {};
    for (const [k, v] of Object.entries(exp.expectFields)) {
      const actual = f[k];
      const ok = (typeof v === "number" && typeof actual === "number")
        ? Math.abs(actual - v) < 0.01
        : actual === v;
      if (!ok) mismatch.push(`field.${k}: want=${v} got=${actual}`);
    }
  }

  if (mismatch.length === 0) {
    passed++;
    console.log(`  PASS  ${name}  bucket=${got}  trust=${result.trustScore}`);
  } else {
    failed++;
    issues.push(`${name}:\n    ${mismatch.join("\n    ")}`);
    console.log(`  FAIL  ${name}  bucket=${got}  trust=${result.trustScore}`);
  }
}

const ms = Date.now() - t0;
console.log(`\n${passed} passed, ${failed} failed (${ms}ms across ${snippets.length} fixtures)`);

if (failed > 0) {
  console.log("\nFailure detail:");
  for (const x of issues) console.log("  - " + x);
  process.exit(1);
}
process.exit(0);
