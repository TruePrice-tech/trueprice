// Run Tesseract OCR on the f3 fixture locally to see the raw text
// Tesseract produces. If the text is clean (has $475/$550/$450), then
// $9,035 came from a regex bug. If the text is garbled into "9035",
// then it's an OCR-bound issue and stays in baseline.
const Tesseract = require("tesseract.js");
const path = require("path");

(async () => {
  const fpath = path.resolve(__dirname, "..", "test-quotes/painting-test-images/08-quote-feedback--primer-only-job.png");
  console.log("OCR'ing", fpath);
  const { data: { text } } = await Tesseract.recognize(fpath, "eng", {
    logger: m => { if (m.status === "recognizing text") process.stdout.write("."); }
  });
  console.log("\n=== OCR TEXT ===");
  console.log(text);
  console.log("=== /OCR TEXT ===");
  // Search for any token that looks like 9035
  const m = text.match(/9[, ]*0[, ]*3[, ]*5/);
  if (m) console.log("FOUND 9035-like token:", m[0]);
  const dollarMatches = text.match(/\$[\s\d,]+/g) || [];
  console.log("All $-prefixed numbers:", dollarMatches);
  process.exit(0);
})();
