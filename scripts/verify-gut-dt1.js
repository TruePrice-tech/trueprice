// Verify GUT-DT-1 fix on gutters-quote-analyzer.html.
const { runVerifier } = require("./lib/dt1-verifier");

runVerifier({
  analyzerPath: "/gutters-quote-analyzer.html",
  detailClass: "gut-detail",
  pricingLabelKey: "pricing source",
  leakTokens: ["aluminum", "copper", "steel", "vinyl", "k.?style", "half.?round", "seamless"],
  manualPrice: "2500",
  fixtures: [
    { label: "messy gutters high (OCR-stripped form labels)",
      file: "test-quotes/gutters-images/messy-comparison-gutters-high.jpg" },
    { label: "messy gutters mid (sub-type leak risk)",
      file: "test-quotes/gutters-images/messy-comparison-gutters-mid.jpg" }
  ]
});
