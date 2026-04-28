// Legal is the "different beast" per project_deep_dive_status.md -- fee-
// structure-driven, not range-based, no compare path in the standard sense.
// Onboarding requires a full deep-dive first to figure out what the eyes-on
// pass should even check. Until then, register the vertical so the rotation
// reports it as needing onboarding rather than silently skipping.
const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "legal",
  resultSelector: "main",
  estimatePermutations: [],
});
