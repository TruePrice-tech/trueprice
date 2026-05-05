// Verify SID-DT-1 fix on siding-quote-analyzer.html.
const { runVerifier } = require("./lib/dt1-verifier");

runVerifier({
  analyzerPath: "/siding-quote-analyzer.html",
  detailClass: "side-detail",
  pricingLabelKey: "pricing source",
  leakTokens: ["vinyl", "fiber.?cement", "wood", "cedar", "stucco", "brick", "stone", "metal", "engineered", "good", "fair", "poor"],
  manualPrice: "12000",
  fixtures: [
    { label: "messy siding high (OCR-stripped form labels)",
      file: "test-quotes/siding-images/messy-comparison-siding-high.jpg" },
    { label: "messy siding mid (sub-type leak risk)",
      file: "test-quotes/siding-images/messy-comparison-siding-mid.jpg" }
  ]
});
