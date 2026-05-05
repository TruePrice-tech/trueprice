// Verify PNT-DT-1 fix on painting-quote-analyzer.html.
const { runVerifier } = require("./lib/dt1-verifier");

runVerifier({
  analyzerPath: "/painting-quote-analyzer.html",
  detailClass: "paint-detail",
  pricingLabelKey: "pricing source",
  leakTokens: ["interior", "exterior", "cabinets", "trim", "fence", "deck", "good", "fair", "poor"],
  manualPrice: "3500",
  fixtures: [
    { label: "messy painting high (OCR-stripped form labels)",
      file: "test-quotes/painting-images/messy-comparison-paint-high.jpg" },
    { label: "messy painting mid (sub-type leak risk)",
      file: "test-quotes/painting-images/messy-comparison-paint-mid.jpg" }
  ]
});
