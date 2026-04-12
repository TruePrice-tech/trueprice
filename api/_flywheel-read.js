/**
 * Flywheel Read: closes the feedback loop by reading calibration
 * aggregates back into estimate responses.
 *
 * Each estimate endpoint calls `enrichWithCalibration(redis, opts)`
 * after computing the static-model expectedRange. If real-world
 * pricing data exists for that city/state/service, the response
 * gets a `calibration` block and the expectedRange is blended.
 */

/**
 * Read calibration data from Redis with city -> state fallback.
 * Returns null if no data or too few quotes.
 */
async function readCalibration(redis, { city, state, service, repair }) {
  if (!state) return null;
  const cityLc = (city || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
  const st = state.toUpperCase();
  const repairKey = repair ? repair.toLowerCase().replace(/[^a-z0-9_]/g, "_") : null;

  // Try keys from most specific to least
  const keysToTry = [];
  if (repairKey && cityLc) keysToTry.push(`cal:${cityLc}:${st}:${service}:${repairKey}`);
  if (repairKey) keysToTry.push(`cal:metro:${st}:${service}:${repairKey}`);
  if (cityLc) keysToTry.push(`cal:${cityLc}:${st}:${service}`);
  keysToTry.push(`cal:metro:${st}:${service}`);

  for (const key of keysToTry) {
    try {
      const raw = await redis.get(key);
      if (!raw) continue;
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (data && data.quotes > 0 && data.avgPrice > 0) {
        return { ...data, source: key };
      }
    } catch (_) { /* best-effort */ }
  }
  return null;
}

/**
 * Blend a static model range with calibration data.
 *
 * - With < 3 quotes: show calibration as info only, don't touch the range
 * - With 3-9 quotes: blend 25% calibration, 75% model
 * - With 10-24 quotes: blend 50/50
 * - With 25+ quotes: blend 70% calibration, 30% model
 *
 * Returns { adjustedRange, calibration, confidence }
 */
function blendEstimate(modelRange, calData) {
  if (!calData || !calData.avgPrice) {
    return { adjustedRange: modelRange, calibration: null, confidence: "model_only" };
  }

  const quotes = calData.quotes || 0;
  const calAvg = calData.avgPrice;

  // Calibration info block always returned when data exists
  const calibration = {
    avgPrice: calAvg,
    quotes: quotes,
    lastUpdated: calData.lastUpdated || null,
    source: calData.source || "calibration"
  };

  // Not enough data to adjust
  if (quotes < 3 || !modelRange || !modelRange.low || !modelRange.high) {
    return {
      adjustedRange: modelRange,
      calibration,
      confidence: quotes < 3 ? "low_data" : "model_only"
    };
  }

  // Determine blend weight based on sample size
  let calWeight;
  if (quotes >= 25) { calWeight = 0.70; }
  else if (quotes >= 10) { calWeight = 0.50; }
  else { calWeight = 0.25; }

  const modelWeight = 1 - calWeight;
  const modelMid = (modelRange.low + modelRange.high) / 2;
  const modelSpread = (modelRange.high - modelRange.low) / 2;

  // Blended midpoint
  const blendedMid = modelMid * modelWeight + calAvg * calWeight;

  // Keep the spread from the model but scale if cal data diverges significantly
  const divergence = Math.abs(calAvg - modelMid) / modelMid;
  // If real-world data diverges >30% from model, widen the range slightly
  const spreadMult = divergence > 0.30 ? 1.15 : 1.0;
  const blendedSpread = modelSpread * spreadMult;

  const adjustedRange = {
    low: Math.round(blendedMid - blendedSpread),
    high: Math.round(blendedMid + blendedSpread)
  };

  // Preserve any extra fields from the original range (seasonal notes, etc.)
  if (modelRange.seasonalMultiplier) adjustedRange.seasonalMultiplier = modelRange.seasonalMultiplier;
  if (modelRange.seasonNote) adjustedRange.seasonNote = modelRange.seasonNote;

  const confidence = quotes >= 25 ? "high" : quotes >= 10 ? "medium" : "low";

  return { adjustedRange, calibration, confidence };
}

/**
 * Main entry point for estimate endpoints.
 *
 * Call after computing pricingContext.expectedRange. Mutates `parsed`
 * to add calibration data and optionally adjust the range.
 *
 * @param {object} redis - Upstash Redis instance
 * @param {object} parsed - The parsed quote response object
 * @param {object} opts - { city, state, service, repair? }
 */
export async function enrichWithCalibration(redis, parsed, opts) {
  try {
    const calData = await readCalibration(redis, opts);
    if (!calData) return; // no calibration data, nothing to do

    const modelRange = parsed.pricingContext?.expectedRange || null;
    const { adjustedRange, calibration, confidence } = blendEstimate(modelRange, calData);

    // Write calibration block to response
    parsed.calibration = calibration;
    parsed.calibration.confidence = confidence;

    // Adjust the expectedRange if we have enough data
    if (modelRange && adjustedRange && confidence !== "model_only") {
      // Preserve original model range for transparency
      parsed.pricingContext.modelRange = { low: modelRange.low, high: modelRange.high };
      parsed.pricingContext.expectedRange = adjustedRange;
      parsed.pricingContext.calibrationApplied = true;
    }
  } catch (e) {
    // Flywheel read is best-effort, never block the response
    console.log("[flywheel-read] Error:", e.message);
  }
}
