#!/usr/bin/env node
// `npm run test:harness` — run Layer 1 + Layer 2 across every bootstrapped
// vertical. Fast read-only check (~250ms total). Does NOT refresh OCR cache.
//
// Usage:
//   npm run test:harness                  # all verticals
//   node test/harness.js plumbing         # just plumbing
//   node test/harness.js plumbing hvac    # subset

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname);
const allVerticals = fs.readdirSync(ROOT).filter(n => {
  const p = path.join(ROOT, n);
  return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, "unit", "run.js"));
});

const requested = process.argv.slice(2);
const verticals = requested.length ? requested.filter(v => allVerticals.includes(v)) : allVerticals;

if (!verticals.length) {
  console.error("No verticals to test. Available:", allVerticals.join(", "));
  process.exit(1);
}

let totalPass = 0;
let totalFail = 0;
let anyFailed = false;
const t0 = Date.now();

for (const v of verticals) {
  console.log(`\n━━━ ${v.toUpperCase()} ━━━`);
  for (const layer of ["unit", "ocr-cache"]) {
    const runFile = path.join(ROOT, v, layer, "run.js");
    if (!fs.existsSync(runFile)) continue;
    try {
      const out = execSync(`node ${JSON.stringify(runFile)}`, { encoding: "utf8", stdio: "pipe" });
      const tail = out.trim().split("\n").slice(-1)[0];
      const m = tail.match(/(\d+)\/(\d+)\s+PASS\s+(\d+)\s+FAIL/);
      if (m) {
        totalPass += Number(m[1]);
        totalFail += Number(m[3]);
        const label = layer === "unit" ? "L1" : "L2";
        console.log(`  ${label}  ${tail}`);
      } else {
        console.log(`  ${layer}: ${tail}`);
      }
    } catch (e) {
      anyFailed = true;
      const out = (e.stdout || "") + (e.stderr || "");
      const tail = out.trim().split("\n").slice(-1)[0];
      console.log(`  ${layer}: FAIL — ${tail}`);
      // Print last 6 lines on failure for context
      console.log(out.trim().split("\n").slice(-6).map(l => "    " + l).join("\n"));
    }
  }
}

const elapsed = Date.now() - t0;
console.log(`\n━━━ TOTAL ━━━`);
console.log(`${totalPass} PASS  ${totalFail} FAIL  across ${verticals.length} verticals  in ${elapsed}ms`);
process.exit(anyFailed || totalFail > 0 ? 1 : 0);
