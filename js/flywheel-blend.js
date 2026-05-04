// Flywheel-aware benchmark blend (frontend).
//
// Mirrors api/_flywheel-read.js -> calBlendWeight + blendMid so an analyzer
// page's locally-computed midpoint can absorb real-world calibration without
// an extra round-trip. The /api/city-multiplier response is the carrier:
// when called with `?service=<vertical>`, it now returns a `serviceCalibration`
// block ({ avgPrice, quotes, lastUpdated, source }) sourced from the same
// `cal:*` keys the API estimate path already blends against.
//
// Single source of truth for the weighting curve lives in api/_flywheel-read.js.
// Keep the thresholds below in sync. test/flywheel/blend-parity.test.js
// guards against drift.
(function (root) {
  function calBlendWeight(quotes) {
    if (!quotes || quotes < 3) return { calWeight: 0, confidence: quotes ? "low_data" : "model_only" };
    if (quotes >= 25) return { calWeight: 0.70, confidence: "high" };
    if (quotes >= 10) return { calWeight: 0.50, confidence: "medium" };
    return { calWeight: 0.25, confidence: "low" };
  }

  // Blend a single model midpoint with the flywheel-calibrated avg.
  // Returns { mid, confidence, applied, calData }.
  function blendMid(modelMid, calData) {
    if (!isFinite(modelMid) || !calData || !isFinite(calData.avgPrice)) {
      return { mid: modelMid, confidence: "model_only", applied: false, calData: null };
    }
    var w = calBlendWeight(calData.quotes || 0);
    if (w.calWeight === 0) return { mid: modelMid, confidence: w.confidence, applied: false, calData: calData };
    var blended = modelMid * (1 - w.calWeight) + calData.avgPrice * w.calWeight;
    return { mid: blended, confidence: w.confidence, applied: true, calData: calData };
  }

  // Convenience: drop-in for `roundTo50(modelTotal)` callers.
  // Returns just the (rounded) blended total. Pass the analyzer's existing
  // rounder so vertical-specific rounding (50 / 100 / 250) is preserved.
  function blendedBenchmark(modelTotal, calData, rounder) {
    var out = blendMid(modelTotal, calData);
    var fn = typeof rounder === "function" ? rounder : function (x) { return Math.round(x); };
    return { total: fn(out.mid), confidence: out.confidence, applied: out.applied, calData: out.calData };
  }

  root.FlywheelBlend = { calBlendWeight: calBlendWeight, blendMid: blendMid, blendedBenchmark: blendedBenchmark };
})(typeof window !== "undefined" ? window : globalThis);
