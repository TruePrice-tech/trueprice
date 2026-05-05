// Verify GD-DT-1 fix on garage-door-quote-analyzer.html.
const { runVerifier } = require("./lib/dt1-verifier");

runVerifier({
  analyzerPath: "/garage-door-quote-analyzer.html",
  detailClass: "gd-detail",
  pricingLabelKey: "pricing",
  leakTokens: ["single.?car", "double.?car", "carriage", "opener", "spring", "steel", "wood", "aluminum"],
  manualPrice: "1500",
  fixtures: [
    { label: "messy garage door high (OCR-stripped form labels)",
      file: "test-quotes/garage-door-images/messy-comparison-garage-high.jpg" },
    { label: "messy garage door mid (sub-type leak risk)",
      file: "test-quotes/garage-door-images/messy-comparison-garage-mid.jpg" }
  ]
});
