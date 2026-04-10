#!/usr/bin/env node
// Scaffolds test/<vertical>/ with loader + run.js + refresh.js + ocr-cache run.
// Does NOT create snippets or expected.json — those are per-vertical manual.
//
// Usage: node test/lib/scaffold.js <vertical> <analyzerPath> <fixturesFolder>
// Example: node test/lib/scaffold.js siding /siding-quote-analyzer.html?path=quote siding-images

const fs = require("fs");
const path = require("path");

const [, , vertical, analyzerPath, fixturesFolder] = process.argv;
if (!vertical || !analyzerPath || !fixturesFolder) {
  console.error("Usage: scaffold.js <vertical> <analyzerPath> <fixturesFolder>");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const vDir = path.join(ROOT, vertical);
fs.mkdirSync(path.join(vDir, "unit", "snippets"), { recursive: true });
fs.mkdirSync(path.join(vDir, "ocr-cache"), { recursive: true });

const loader = `const fs = require("fs");
const path = require("path");
const vm = require("vm");
const SRC = path.resolve(__dirname, "..", "..", "js", "analyzer-parser.js");
const code = fs.readFileSync(SRC, "utf8");
const sandbox = { window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "analyzer-parser.js" });
module.exports = sandbox.window;
`;

const unitRun = `#!/usr/bin/env node
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
    const r = parser.parseExtractedTextMultiStrategy(text, ${JSON.stringify(vertical)});
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
console.log("── Layer 1 — ${vertical} Parser Unit Tests ──");
const W = { s: 8, n: 38, e: 10, a: 10, c: 10 };
console.log(\`\${"STATUS".padEnd(W.s)} \${"SNIPPET".padEnd(W.n)} \${"EXPECT".padEnd(W.e)} \${"GOT".padEnd(W.a)} \${"CONF".padEnd(W.c)} AGR\`);
console.log("-".repeat(86));
for (const r of rows) {
  const e = r.expected == null ? "—" : \`\$\${r.expected}\`;
  const a = r.actual == null ? "(null)" : (typeof r.actual === "number" ? \`\$\${r.actual}\` : r.actual);
  console.log(\`\${r.status.padEnd(W.s)} \${r.name.padEnd(W.n)} \${e.padEnd(W.e)} \${String(a).padEnd(W.a)} \${(r.conf||"—").padEnd(W.c)} \${r.agreed ?? "—"}\`);
}
const pass = rows.filter(r => r.status === "PASS").length;
const fail = rows.filter(r => r.status === "FAIL").length;
const err  = rows.filter(r => r.status === "ERROR").length;
const labeled = rows.filter(r => r.status !== "UNLABELED").length;
console.log("");
console.log(\`\${pass}/\${labeled} PASS   \${fail} FAIL   \${err} ERROR   (\${elapsed}ms)\`);
process.exit(fail + err > 0 ? 1 : 0);
`;

const refresh = `#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", ${JSON.stringify(fixturesFolder)}),
  cacheDir: __dirname,
  analyzerPath: ${JSON.stringify(analyzerPath)}
});
`;

const cacheRun = `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const parser = require("../load-parser");

const CACHE = __dirname;
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
  console.log("No cached OCR files. Run: node test/${vertical}/ocr-cache/refresh.js");
  process.exit(0);
}

const rows = [];
const t0 = Date.now();
for (const txt of cached) {
  const fixture = txt.replace(/\\.txt$/, "");
  const text = fs.readFileSync(path.join(CACHE, txt), "utf8");
  const exp = EXPECTED[fixture];
  let status, actual, conf, agreed;
  try {
    const r = parser.parseExtractedTextMultiStrategy(text, ${JSON.stringify(vertical)});
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

console.log("── Layer 2 — ${vertical} Real OCR Cache Tests ──");
const W = { s: 10, n: 56, e: 11, a: 11, c: 8 };
console.log(\`\${"STATUS".padEnd(W.s)} \${"FIXTURE".padEnd(W.n)} \${"EXPECT".padEnd(W.e)} \${"GOT".padEnd(W.a)} \${"CONF".padEnd(W.c)} AGR  CHARS\`);
console.log("-".repeat(115));
for (const r of rows) {
  const e = r.exp ? (r.exp.price == null ? "(manual)" : \`\$\${r.exp.price}\`) : "—";
  const a = r.actual == null ? "(manual)" : (typeof r.actual === "number" ? \`\$\${r.actual}\` : r.actual);
  console.log(\`\${r.status.padEnd(W.s)} \${r.fixture.padEnd(W.n)} \${e.padEnd(W.e)} \${String(a).padEnd(W.a)} \${(r.conf||"—").padEnd(W.c)} \${r.agreed ?? "—"}    \${r.textLen}\`);
}
const pass = rows.filter(r => r.status === "PASS").length;
const fail = rows.filter(r => r.status === "FAIL").length;
const labeled = rows.filter(r => r.status !== "UNLABELED").length;
console.log("");
console.log(\`\${pass}/\${labeled} PASS   \${fail} FAIL   \${rows.filter(r=>r.status==="UNLABELED").length} UNLABELED   (\${Date.now()-t0}ms)\`);
process.exit(fail > 0 ? 1 : 0);
`;

fs.writeFileSync(path.join(vDir, "load-parser.js"), loader);
fs.writeFileSync(path.join(vDir, "unit", "run.js"), unitRun);
fs.writeFileSync(path.join(vDir, "unit", "expected.json"), "{}\n");
fs.writeFileSync(path.join(vDir, "ocr-cache", "refresh.js"), refresh);
fs.writeFileSync(path.join(vDir, "ocr-cache", "run.js"), cacheRun);

console.log(`Scaffolded test/${vertical}/`);
