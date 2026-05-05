// Verify FND-DT-1 fix on foundation-quote-analyzer.html.
const { runVerifier } = require("./lib/dt1-verifier");

runVerifier({
  analyzerPath: "/foundation-quote-analyzer.html",
  detailClass: "found-detail",
  pricingLabelKey: "pricing",
  leakTokens: ["pier", "helical", "steel", "concrete", "slab", "leveling", "wall.?repair", "encapsulation", "minor", "moderate", "major", "extensive"],
  manualPrice: "10000",
  fixtures: [
    { label: "messy foundation high (OCR-stripped form labels)",
      file: "test-quotes/foundation-images/messy-comparison-pier-high.jpg" },
    { label: "messy foundation mid (sub-type leak risk)",
      file: "test-quotes/foundation-images/messy-comparison-pier-mid.jpg" }
  ]
});
