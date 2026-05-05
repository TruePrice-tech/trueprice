// Verify LND-DT-1 fix on landscaping-quote-analyzer.html.
const { runVerifier } = require("./lib/dt1-verifier");

runVerifier({
  analyzerPath: "/landscaping-quote-analyzer.html",
  detailClass: "land-detail",
  pricingLabelKey: "pricing",
  leakTokens: ["sod", "mulch", "tree.?install", "tree.?removal", "patio", "retaining.?wall", "irrigation", "design", "basic", "moderate", "complex"],
  manualPrice: "5000",
  fixtures: [
    { label: "messy landscaping high (OCR-stripped form labels)",
      file: "test-quotes/landscaping-images/messy-comparison-land-high.jpg" },
    { label: "messy landscaping mid (sub-type leak risk)",
      file: "test-quotes/landscaping-images/messy-comparison-land-mid.jpg" }
  ]
});
