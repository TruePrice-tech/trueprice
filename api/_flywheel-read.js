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
export async function readCalibration(redis, { city, state, service, repair }) {
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
 * Pick blend weight + confidence label from sample count.
 * Single source of truth for the model<->calibration weighting curve.
 *
 * - <3 quotes: don't touch the model (low_data)
 * - 3-9 quotes: 25% cal / 75% model (low)
 * - 10-24 quotes: 50/50 (medium)
 * - 25+ quotes: 70% cal / 30% model (high)
 */
export function calBlendWeight(quotes) {
  if (!quotes || quotes < 3) return { calWeight: 0, confidence: quotes ? "low_data" : "model_only" };
  if (quotes >= 25) return { calWeight: 0.70, confidence: "high" };
  if (quotes >= 10) return { calWeight: 0.50, confidence: "medium" };
  return { calWeight: 0.25, confidence: "low" };
}

/**
 * Blend a single model midpoint (e.g. frontend benchmark total) with the
 * flywheel-calibrated avg. Mirrors `blendEstimate` weighting but returns just
 * the blended scalar — so any analyzer page can swap its locally-computed
 * benchmark for a flywheel-aware one without touching range math.
 *
 * Returns { mid, confidence, applied }.
 */
export function blendMid(modelMid, calData) {
  if (!Number.isFinite(modelMid) || !calData || !Number.isFinite(calData.avgPrice)) {
    return { mid: modelMid, confidence: "model_only", applied: false };
  }
  const { calWeight, confidence } = calBlendWeight(calData.quotes || 0);
  if (calWeight === 0) return { mid: modelMid, confidence, applied: false };
  const blended = modelMid * (1 - calWeight) + calData.avgPrice * calWeight;
  return { mid: blended, confidence, applied: true };
}

/**
 * Blend a static model range with calibration data.
 *
 * Uses `calBlendWeight` for the weighting curve so the API range path and
 * the frontend `blendMid` path stay synchronized.
 *
 * Returns { adjustedRange, calibration, confidence }
 */
export function blendEstimate(modelRange, calData) {
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

  const { calWeight, confidence } = calBlendWeight(quotes);

  // Not enough data, or no model range to blend into
  if (calWeight === 0 || !modelRange || !modelRange.low || !modelRange.high) {
    return {
      adjustedRange: modelRange,
      calibration,
      confidence
    };
  }

  const modelMid = (modelRange.low + modelRange.high) / 2;
  const modelSpread = (modelRange.high - modelRange.low) / 2;

  const blendedMid = modelMid * (1 - calWeight) + calAvg * calWeight;

  // If real-world data diverges >30% from model, widen the range slightly.
  const divergence = Math.abs(calAvg - modelMid) / modelMid;
  const spreadMult = divergence > 0.30 ? 1.15 : 1.0;
  const blendedSpread = modelSpread * spreadMult;

  const adjustedRange = {
    low: Math.round(blendedMid - blendedSpread),
    high: Math.round(blendedMid + blendedSpread)
  };

  if (modelRange.seasonalMultiplier) adjustedRange.seasonalMultiplier = modelRange.seasonalMultiplier;
  if (modelRange.seasonNote) adjustedRange.seasonNote = modelRange.seasonNote;

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
