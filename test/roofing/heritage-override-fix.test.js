// Unit test for the analyzer-engine.js post-processing override.
// Verifies that "TOTAL ESTIMATE $11,895" is NOT overridden by the misread
// "Subtotal $11.750" → 11.75 fallback. Reproduces the compare-path bug.
const fs = require("fs");
const path = require("path");

function applyOverride(ocrText, parserPickedPrice) {
  // Ported subset of analyzer-engine.js post-processing (the lines we just
  // changed). Matches the production logic so we can verify the fix without
  // running the full browser stack.

  var _ocrTextForOverride = ocrText.replace(
    /(\$\s*\d{1,3})\.(\d{3})(?!\d)/g,
    "$1,$2"
  );

  var _totalOverride = _ocrTextForOverride.match(/(?:^|\n)\s*(?:TOTAL|Total|grand\s*total)\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{1,2})?)/m);
  if (!_totalOverride) {
    _totalOverride = _ocrTextForOverride.match(/(?:^|\n)\s*(?:total\s*(?:job|service|repair|project)?\s*(?:price|cost|amount|due)|amount\s*due|balance\s*due)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/im);
  }
  if (!_totalOverride) {
    _totalOverride = _ocrTextForOverride.match(/(?:^|\n)\s*(?:total\s+estimate(?:d\s+cost)?|estimate\s+total|proposal\s+total|contract\s+total|final\s+total)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/im);
  }
  if (!_totalOverride) {
    _totalOverride = _ocrTextForOverride.match(/contract\s*(?:price|total|amount|sum)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/im);
  }
  if (!_totalOverride) {
    _totalOverride = _ocrTextForOverride.match(/\btotal\s*(?:project\s*|job\s*|investment\s*)?(?:cost|price|amount|investment)\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{1,2})?)/i);
  }
  if (!_totalOverride) {
    var _hasLaterTotal =
      /(?:^|\n)\s*(?:TOTAL|Total|grand\s*total)\s*[:\-]?\s*\$/m.test(_ocrTextForOverride) ||
      /(?:^|\n)\s*(?:total\s+estimate|estimate\s+total|proposal\s+total|contract\s+total|final\s+total)/im.test(_ocrTextForOverride);
    if (!_hasLaterTotal) {
      _totalOverride = _ocrTextForOverride.match(/(?:^|\n)\s*sub.?total\s*[:\-]?\s*\$\s*([\d,]+(?:\.\d{1,2})?)/im);
    }
  }

  let resultPrice = parserPickedPrice;
  if (_totalOverride) {
    var _overrideVal = parseFloat(_totalOverride[1].replace(/,/g, ""));
    var _overrideIsSuspect =
      resultPrice &&
      resultPrice >= 500 &&
      _overrideVal < resultPrice * 0.1;
    if (
      _overrideVal >= 10 &&
      _overrideVal <= 500000 &&
      _overrideVal !== resultPrice &&
      !_overrideIsSuspect
    ) {
      resultPrice = _overrideVal;
    }
  }
  return { price: resultPrice, override: _totalOverride ? _totalOverride[0] : null };
}

const cacheDir = path.join(__dirname, "ocr-cache");
const cases = [
  { file: "comparison-roof-02-mid.png.txt", expected: 11895, expectedSubstring: "TOTAL ESTIMATE", parserPick: 11895 },
  { file: "messy-comparison-roof-02-mid.jpg.txt", expected: 11895, expectedSubstring: "TOTAL ESTIMATE", parserPick: 11895 },
  // Sanity: also confirm the other fixtures still resolve correctly
  { file: "comparison-roof-01-low.png.txt", expected: 7565, expectedSubstring: "TOTAL", parserPick: 7565 },
  { file: "comparison-roof-03-high.png.txt", expected: 17500, expectedSubstring: "TOTAL", parserPick: 17500 },
  { file: "07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg.txt", expected: 10500, expectedSubstring: "Total", parserPick: 10500 },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const text = fs.readFileSync(path.join(cacheDir, c.file), "utf8");
  const r = applyOverride(text, c.parserPick);
  const ok = r.price === c.expected;
  console.log((ok ? "PASS" : "FAIL"), c.file, "got", r.price, "(expected", c.expected + ")", "override match:", (r.override || "").substring(0, 80));
  if (ok) pass++; else fail++;
}
console.log(`\n${pass}/${pass + fail} pass`);
process.exit(fail ? 1 : 0);
