const { defineRunner } = require("../lib/runner");

// Medical is bill-check only: no estimate flow, no compare-medical-quotes page
// is on the standard sweep (per project_medical_dive_followups.md compare path
// is low-risk). We walk analyzer + the synthetic CT comparison fixtures via
// the standard compare URL convention.
//   analyzer URL: /medical-bill-analyzer.html
//   file input: #fileInput
//   result selector: #mbApp
module.exports = defineRunner({
  vertical: "medical",
  resultSelector: "#mbApp, main",
  analyzerUrl: "/medical-bill-analyzer.html",
  compareUrl: "/compare-medical-quotes.html",
  fileInputSelector: "#fileInput",
  estimatePermutations: [],
});
