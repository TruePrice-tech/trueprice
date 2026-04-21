/**
 * Flywheel Guard: validates prices before they enter calibration aggregates.
 *
 * Rejects prices outside realistic residential ranges to prevent:
 * - Commercial quotes contaminating residential data
 * - Bot/competitor manipulation
 * - Data entry errors (e.g. $136,375 for a simple roof)
 * - Accidental test data
 *
 * Each vertical has a min/max range. Prices outside the range are
 * silently dropped (logged but not written to cal:* keys).
 */

const PRICE_GUARDS = {
  roofing:     { min: 2000,  max: 35000,  label: "Roofing" },
  hvac:        { min: 1500,  max: 25000,  label: "HVAC" },
  plumbing:    { min: 150,   max: 20000,  label: "Plumbing" },
  electrical:  { min: 100,   max: 25000,  label: "Electrical" },
  solar:       { min: 5000,  max: 80000,  label: "Solar" },
  windows:     { min: 1000,  max: 60000,  label: "Windows" },
  painting:    { min: 500,   max: 30000,  label: "Painting" },
  landscaping: { min: 500,   max: 80000,  label: "Landscaping" },
  fencing:     { min: 500,   max: 30000,  label: "Fencing" },
  concrete:    { min: 500,   max: 30000,  label: "Concrete" },
  foundation:  { min: 1000,  max: 50000,  label: "Foundation" },
  gutters:     { min: 500,   max: 15000,  label: "Gutters" },
  insulation:  { min: 500,   max: 20000,  label: "Insulation" },
  kitchen:     { min: 3000,  max: 100000, label: "Kitchen" },
  siding:      { min: 2000,  max: 40000,  label: "Siding" },
  "garage-door": { min: 300, max: 10000,  label: "Garage Door" },
  moving:      { min: 200,   max: 25000,  label: "Moving" },
  auto:        { min: 50,    max: 15000,  label: "Auto Repair" },
  medical:     { min: 50,    max: 500000, label: "Medical" },
  legal:       { min: 100,   max: 100000, label: "Legal" },
};

/**
 * Check if a price is within the realistic residential range for a service.
 * @param {number} price - The total price to validate
 * @param {string} service - The service vertical key (e.g. "roofing", "hvac")
 * @returns {{ ok: boolean, reason?: string }}
 */
function validateFlywheelPrice(price, service) {
  const p = Number(price);
  if (!p || p <= 0) return { ok: false, reason: "non-positive price" };

  const guard = PRICE_GUARDS[service];
  if (!guard) return { ok: true }; // unknown service, allow

  if (p < guard.min) {
    return { ok: false, reason: `${guard.label} price $${p} below minimum $${guard.min}` };
  }
  if (p > guard.max) {
    return { ok: false, reason: `${guard.label} price $${p} above maximum $${guard.max}` };
  }

  return { ok: true };
}

/**
 * Guarded flywheel bump: writes to cal:* keys only if price passes validation.
 * Drop-in replacement for the inline bump() functions in estimate APIs.
 *
 * Can also INCR the public quote counter (tp:total_quotes) when the caller
 * indicates the request represents a REAL user quote (image upload or user-
 * submitted price), per project_counter_real_only policy. Synthetic "Get an
 * estimate" flows must pass incRealQuote: false (the default) so the counter
 * only reflects real activity.
 *
 * @param {object} redis - Upstash Redis client
 * @param {string} service - Vertical key (e.g. "roofing")
 * @param {number} totalPrice - The quote total
 * @param {string} city - City name (lowercase, underscored)
 * @param {string} state - 2-letter state code (uppercase)
 * @param {object|number} optsOrWeight - Either a weight (legacy) or an options
 *   object: { weight?: number, incRealQuote?: boolean }.
 * @returns {boolean} true if cal:* was bumped (price passed guard + state set).
 */
async function guardedFlywheelBump(redis, service, totalPrice, city, state, optsOrWeight = {}) {
  const opts = (typeof optsOrWeight === "number")
    ? { weight: optsOrWeight }
    : (optsOrWeight || {});
  const weight = typeof opts.weight === "number" ? opts.weight : 0.3;
  const incRealQuote = !!opts.incRealQuote;

  const check = validateFlywheelPrice(totalPrice, service);
  if (!check.ok) {
    console.log(`[flywheel-guard] REJECTED: ${check.reason}`);
    return false;
  }

  const cityLc = String(city || "")
    .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
  const st = String(state || "").toUpperCase();
  if (!st) return false;

  const bump = async (k) => {
    try {
      const ex = await redis.get(k) || { quotes: 0, weightedSum: 0, totalWeight: 0, avgPrice: 0, lastUpdated: 0 };
      const e = typeof ex === "string" ? JSON.parse(ex) : ex;
      e.quotes += 1;
      e.weightedSum += totalPrice * weight;
      e.totalWeight += weight;
      e.avgPrice = Math.round(e.weightedSum / e.totalWeight);
      e.lastUpdated = Date.now();
      await redis.set(k, JSON.stringify(e));
    } catch (err) { /* aggregates are best-effort */ }
  };

  if (cityLc) await bump(`cal:${cityLc}:${st}:${service}`);
  await bump(`cal:metro:${st}:${service}`);

  if (incRealQuote) {
    try {
      await redis.incr("tp:total_quotes");
    } catch (err) { /* counter is best-effort */ }
  }

  return true;
}

export { validateFlywheelPrice, guardedFlywheelBump, PRICE_GUARDS };
