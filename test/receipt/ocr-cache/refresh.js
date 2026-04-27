#!/usr/bin/env node
// Layer 2 refresh — runs Tesseract.js (Node, eng dataset) on each fixture
// image and writes the OCR'd text to cache/<fixture>.txt.
//
// This is the "what does the OCR layer actually produce on real receipts"
// step. The cached text feeds into run.js, which asserts that
// verifyReceipt() correctly buckets each fixture given the current
// extraction + verifier rules.
//
// Direct-Tesseract approach (vs the puppeteer parallel-refresh used by
// quote analyzers) because /beta/submit-receipt.html is auth-gated and
// the OCR engine is identical (tesseract.js, eng).
//
// Run:
//   node test/receipt/ocr-cache/refresh.js               # all fixtures
//   node test/receipt/ocr-cache/refresh.js NAME.jpg      # single fixture

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createWorker } from "tesseract.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(ROOT, "fixtures");
const CACHE = path.join(ROOT, "cache");

if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });

const onlyArg = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;

let files = fs.readdirSync(FIXTURES).filter((n) => /\.(jpe?g|png|webp)$/i.test(n)).sort();
if (onlyArg) files = files.filter((n) => n === onlyArg);
if (!files.length) {
  console.log("No fixtures matched.");
  process.exit(0);
}

console.log(`Tesseract refresh: ${files.length} fixtures`);
const worker = await createWorker("eng", 1, { logger: () => {} });
const t0 = Date.now();

for (const f of files) {
  const fStart = Date.now();
  const fp = path.join(FIXTURES, f);
  const { data } = await worker.recognize(fp);
  const text = data.text || "";
  fs.writeFileSync(path.join(CACHE, f + ".txt"), text, "utf8");
  console.log(`  ${f}  ${(Date.now() - fStart)}ms  ${text.length} chars`);
}

await worker.terminate();
console.log(`Done in ${Math.round((Date.now() - t0) / 1000)}s`);
