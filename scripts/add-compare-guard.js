// Batch script: add wrong-vertical guard + analyzer-core to compare-X-quotes.html.
// Pure additive fix. Each file processed individually with verification.
// Run: node scripts/add-compare-guard.js [vertical]
//
// Note: not a "mass inject" of city-page CONTENT (which is forbidden);
// this is the same patch for one functional page per vertical, applied
// per file. After running, the file should be reviewed before committing.

const fs = require("fs");
const path = require("path");

// Maps vertical key (matches detectVerticalFromText) to:
//   compareFile, cardClass (matches the page's existing card wrapper class)
const VERTICALS = {
  plumbing:    { file: "compare-plumbing-quotes.html",    cardClass: "cmp-card" },
  electrical:  { file: "compare-electrical-quotes.html",  cardClass: "cmp-card" },
  solar:       { file: "compare-solar-quotes.html",       cardClass: "cmp-card" },
  windows:     { file: "compare-windows-quotes.html",     cardClass: "cmp-card" },
  painting:    { file: "compare-painting-quotes.html",    cardClass: "cmp-card" },
  siding:      { file: "compare-siding-quotes.html",      cardClass: "cmp-card" },
  fencing:     { file: "compare-fencing-quotes.html",     cardClass: "cmp-card" },
  concrete:    { file: "compare-concrete-quotes.html",    cardClass: "cmp-card" },
  landscaping: { file: "compare-landscaping-quotes.html", cardClass: "cmp-card" },
  "garage-door": { file: "compare-garage-door-quotes.html", cardClass: "cmp-card" },
  foundation:  { file: "compare-foundation-quotes.html",  cardClass: "cmp-card" },
  kitchen:     { file: "compare-kitchen-quotes.html",     cardClass: "cmp-card" },
  insulation:  { file: "compare-insulation-quotes.html",  cardClass: "cmp-card" },
  gutters:     { file: "compare-gutters-quotes.html",     cardClass: "cmp-card" },
  moving:      { file: "compare-moving-quotes.html",      cardClass: "cmp-card" },
  medical:     { file: "compare-medical-quotes.html",     cardClass: "cmp-card" },
  legal:       { file: "compare-legal-quotes.html",       cardClass: "cmp-card" },
};

const ROOT = path.resolve(__dirname, "..");
const v = process.argv[2];

function patchOne(key, conf) {
  const fp = path.resolve(ROOT, conf.file);
  if (!fs.existsSync(fp)) {
    console.log(`SKIP ${conf.file} — not found`);
    return false;
  }
  let html = fs.readFileSync(fp, "utf8");
  let changed = false;

  // 1. Replace the script block. Look for the existing analyzer-engine + analyzer-parser.
  // Inject analyzer-core (if missing) + vertical-detect + wrong-vertical-guard.
  const oldScripts =
    `<script src="/js/analyzer-parser.min.js" defer></script>\n  <script src="/js/analyzer-engine.min.js" defer></script>`;
  const newScripts =
    `<script src="/js/analyzer-core.min.js?v=20260429a" defer></script>\n` +
    `  <script src="/js/analyzer-parser.min.js?v=20260429a" defer></script>\n` +
    `  <script src="/js/analyzer-engine.min.js?v=20260429a" defer></script>`;

  if (html.includes(oldScripts) && !html.includes("/js/wrong-vertical-guard.min.js")) {
    html = html.replace(oldScripts, newScripts);
    // Append vertical-detect + wrong-vertical-guard after analyzer-engine line
    const afterEngine = `<script src="/js/analyzer-engine.min.js?v=20260429a" defer></script>`;
    const guardLines =
      `${afterEngine}\n` +
      `  <script src="/js/vertical-detect.min.js?v=20260429a"></script>\n` +
      `  <script src="/js/wrong-vertical-guard.min.js?v=20260429a"></script>`;
    html = html.replace(afterEngine, guardLines);
    changed = true;
  }

  // 2. Add the guard call inside the analyzeQuote handler.
  // Find the line matching: TP_Engine.analyzeQuote(file, { vertical: "X", ...
  const analyzeMatch = html.match(/TP_Engine\.analyzeQuote\(file,\s*\{\s*vertical:\s*"([^"]+)"[^)]*\)\.then\(function\(engineResult\)\s*\{\s*var\s+_engOcrText\s*=\s*engineResult\.ocrText\s*\|\|\s*""\s*;\s*var\s+regexPrice\s*=\s*engineResult\.price\s*\|\|\s*0\s*;/);
  if (analyzeMatch && !html.includes("wrong_vertical_reject")) {
    const guardCallBlock =
      analyzeMatch[0] +
      `\n\n        if (_engOcrText && _engOcrText.length > 50 &&\n` +
      `            typeof window.tpEnforceVerticalMatch === "function") {\n` +
      `          var rootEl = document.querySelector(".${conf.cardClass}");\n` +
      `          if (rootEl && window.tpEnforceVerticalMatch("${analyzeMatch[1]}", _engOcrText, rootEl)) {\n` +
      `            return Promise.reject(new Error("wrong_vertical_reject"));\n` +
      `          }\n` +
      `        }\n`;
    html = html.replace(analyzeMatch[0], guardCallBlock);
    changed = true;

    // 3. Add early-return in the catch handler so reject doesn't trigger fallback.
    const catchMatch = html.match(/\}\)\.catch\(function\(err\)\s*\{\s*\n?\s*console\.error\(/);
    if (catchMatch) {
      html = html.replace(
        catchMatch[0],
        `}).catch(function(err) {\n        if (err && err.message === "wrong_vertical_reject") return;\n        console.error(`
      );
    }
  }

  if (changed) {
    fs.writeFileSync(fp, html, "utf8");
    console.log(`PATCHED ${conf.file}`);
    return true;
  } else {
    console.log(`SKIP ${conf.file} — already patched or pattern not found`);
    return false;
  }
}

if (v) {
  if (VERTICALS[v]) patchOne(v, VERTICALS[v]);
  else console.log(`Unknown vertical: ${v}. Options: ${Object.keys(VERTICALS).join(", ")}`);
} else {
  console.log("Usage: node scripts/add-compare-guard.js <vertical>");
  console.log("Or: node scripts/add-compare-guard.js all");
  if (process.argv[2] === "all") {
    Object.entries(VERTICALS).forEach(([k, c]) => patchOne(k, c));
  }
}
