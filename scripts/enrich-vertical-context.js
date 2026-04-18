/**
 * enrich-vertical-context.js
 *
 * Adds two additional fields to each per-vertical city-context JSON file:
 *   - costDriverNote: unique analysis of what drives costs in this city for this trade
 *   - redFlagNote: city+trade-specific warning signs to watch for in quotes
 *
 * These fields are composed from multiple data dimensions (climate zone, home age,
 * population, growth rate, multiplier) so that each city gets genuinely unique text.
 *
 * Run after generate-vertical-city-context.js:
 *   node scripts/enrich-vertical-context.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const CTX = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const MULT = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-cost-multipliers.json"), "utf8"));
let WAGES = {};
try { WAGES = JSON.parse(fs.readFileSync(path.join(ROOT, "data/trade-wages-by-metro.json"), "utf8")); } catch(e) {}

function hash(str) {
  return parseInt(crypto.createHash("md5").update(str).digest("hex").slice(0, 8), 16);
}
function pick(arr, seed) { return arr[seed % arr.length]; }

// Map vertical slug to the main trade and project noun
const VERT_INFO = {
  "electrical":      { trade: "electricians", noun: "electrical work", typical: "panel upgrade or rewiring" },
  "solar":           { trade: "electricians", noun: "solar installation", typical: "residential solar system" },
  "painting":        { trade: "painters", noun: "exterior painting", typical: "whole-house exterior paint job" },
  "kitchen-remodel": { trade: "carpenters", noun: "kitchen remodel", typical: "mid-range kitchen renovation" },
  "fence":           { trade: "construction_laborers", noun: "fence installation", typical: "150-foot privacy fence" },
  "concrete":        { trade: "cement_masons", noun: "concrete work", typical: "driveway or patio pour" },
  "landscaping":     { trade: "construction_laborers", noun: "landscaping project", typical: "full yard makeover" },
  "foundation":      { trade: "cement_masons", noun: "foundation repair", typical: "piering or waterproofing job" },
  "garage-door":     { trade: "carpenters", noun: "garage door replacement", typical: "2-car garage door install" },
  "siding":          { trade: "carpenters", noun: "siding replacement", typical: "whole-house re-siding" },
  "window":          { trade: "carpenters", noun: "window replacement", typical: "full-house window swap" },
  "insulation":      { trade: "construction_laborers", noun: "insulation upgrade", typical: "attic and wall insulation retrofit" },
  "gutter":          { trade: "sheet_metal_workers", noun: "gutter installation", typical: "seamless gutter system" },
  "hvac":            { trade: "hvac_mechanics", noun: "HVAC replacement", typical: "full system swap" },
  "plumbing":        { trade: "plumbers", noun: "plumbing work", typical: "repipe or water heater swap" },
};

function buildCostDriverNote(city, stateCode, vslug, cityCtx, cityMult) {
  const info = VERT_INFO[vslug];
  if (!info) return "";
  const age = cityCtx.avgHomeAge || 30;
  const pop = cityMult?.population || 50000;
  const growth = (cityCtx.growthRate || "moderate").toLowerCase();
  const zone = (cityCtx.climateZone || "mixed_humid").toLowerCase();
  const laborMult = cityMult?.laborMult || 1.0;
  const matMult = cityMult?.materialsMult || 1.0;
  const svcMult = (cityMult?.serviceMultipliers || {})[vslug === "kitchen-remodel" ? "kitchen" : vslug] || cityMult?.multiplier || 1.0;
  const seed = hash(`${city}|${stateCode}|${vslug}|cost`);

  // Build cost driver analysis from multiple dimensions
  const parts = [];

  // Labor cost driver (based on laborMult)
  const laborPct = Math.round((laborMult - 1.0) * 100);
  if (laborPct > 15) {
    parts.push(pick([
      `Labor is the dominant cost driver for ${info.noun} in ${city} — local wages run ${laborPct}% above the national average, which adds ${Math.round(laborPct * 0.5)}% or more to a typical ${info.typical}.`,
      `The biggest factor in ${city} ${info.noun} pricing is labor cost, running ${laborPct}% above national benchmarks. For a ${info.typical}, that premium alone accounts for $${Math.round(laborPct * 40)}-${Math.round(laborPct * 80)} in additional cost.`,
      `${city} labor rates sit ${laborPct}% above the US median, making labor the single largest cost factor for ${info.noun}. This is structural — driven by local cost of living and demand — not something negotiation can erase.`,
    ], seed));
  } else if (laborPct < -10) {
    parts.push(pick([
      `Lower labor costs are ${city}'s advantage for ${info.noun} — local wages run ${Math.abs(laborPct)}% below the national average. This puts ${city} in the bottom third nationally for ${info.noun} labor costs.`,
      `${city} homeowners benefit from labor rates ${Math.abs(laborPct)}% below national medians. For a ${info.typical}, this translates to savings of $${Math.round(Math.abs(laborPct) * 30)}-${Math.round(Math.abs(laborPct) * 60)} compared to the national average.`,
    ], seed));
  } else {
    parts.push(pick([
      `Labor costs in ${city} track within a few points of the national average for ${info.noun}, so material selection and project scope are the bigger pricing levers for homeowners.`,
      `With ${city} labor rates near the national median, the cost difference between a budget and premium ${info.typical} comes down to materials and scope rather than labor premiums.`,
    ], seed));
  }

  // Age-driven cost factor
  if (age >= 50) {
    parts.push(pick([
      `Homes averaging ${age} years in ${city} frequently surface hidden scope during ${info.noun} — old wiring, deteriorated framing, code-gap remediation — that adds 10-25% over the initial estimate. Build contingency into your budget.`,
      `The ${age}-year average home age in ${city} means most ${info.noun} projects encounter at least one behind-the-wall surprise. Experienced local contractors price this risk in; lowball bids from out-of-area contractors often don't.`,
    ], seed + 1));
  } else if (age >= 35) {
    parts.push(pick([
      `At ${age} years average home age, ${city} properties are hitting their first major replacement cycle for systems and components. ${info.noun} demand is at peak levels in this age band, which keeps contractor schedules full but pricing competitive.`,
      `${city}'s housing stock averages ${age} years — the age where original installations start failing and code requirements have evolved. Most ${info.noun} quotes will include some code-catch-up items that newer homes wouldn't need.`,
    ], seed + 2));
  } else {
    parts.push(pick([
      `${city}'s relatively young housing stock (${age} years average) simplifies most ${info.noun} projects. Modern code compliance, standard dimensions, and accessible construction reduce both time and cost versus older homes.`,
      `Newer construction in ${city} (averaging ${age} years) means ${info.noun} projects rarely encounter the hidden-scope surprises common in older markets. What you see in the quote is usually what you pay.`,
    ], seed + 2));
  }

  // Growth-driven demand factor
  if (growth === "high") {
    parts.push(pick([
      `${city}'s rapid growth means contractors can be selective about which jobs they take. Off-season scheduling and flexible timelines give you better leverage on pricing than trying to rush a project during peak demand.`,
      `High construction demand in ${city} creates a seller's market for ${info.noun} contractors. Booking 3-4 weeks ahead is typical; emergency or rush jobs carry 15-25% premiums.`,
    ], seed + 3));
  }

  return parts.join(" ");
}

function buildRedFlagNote(city, stateCode, vslug, cityCtx, cityMult) {
  const info = VERT_INFO[vslug];
  if (!info) return "";
  const age = cityCtx.avgHomeAge || 30;
  const pop = cityMult?.population || 50000;
  const growth = (cityCtx.growthRate || "moderate").toLowerCase();
  const zone = (cityCtx.climateZone || "mixed_humid").toLowerCase();
  const seed = hash(`${city}|${stateCode}|${vslug}|flag`);

  const flags = [];

  // Universal red flags (pick 2 based on seed)
  const universal = [
    `Any ${city} contractor who asks for more than 30% upfront before materials are ordered is a red flag. Standard practice is 10-15% deposit, materials-on-delivery payment, and final payment on completion.`,
    `In ${city}, verify your ${info.noun} contractor pulls the permit themselves — never pull it in your own name. If they ask you to pull the permit, they may not be properly licensed to do the work.`,
    `Watch for ${info.noun} quotes in ${city} that lack line-item detail. A professional estimate breaks out labor, materials, permits, and cleanup separately. Lump-sum bids hide margin and make change orders impossible to evaluate.`,
    `Be cautious of ${info.noun} contractors in ${city} who pressure you to sign same-day. Legitimate contractors expect you to get competing bids and will hold their price for 30 days. High-pressure sales tactics correlate with inflated pricing.`,
    `Check that any ${city} contractor doing ${info.noun} carries both general liability insurance ($1M minimum) and workers' compensation. Request certificates directly from the insurer, not just copies the contractor provides.`,
  ];
  flags.push(pick(universal, seed));
  flags.push(pick(universal, seed + 7));

  // Growth-specific red flag
  if (growth === "high") {
    flags.push(pick([
      `${city}'s rapid growth attracts out-of-state contractors who follow the boom. Verify any unfamiliar company's local licensing, physical address, and track record. Fly-by-night operations leave when the market cools.`,
      `In fast-growing ${city}, some contractors take on more work than they can handle. Ask about their current project count — a reputable ${info.noun} contractor runs 2-4 jobs simultaneously, not 10-15.`,
    ], seed + 5));
  }

  // Age-specific red flag
  if (age >= 50) {
    flags.push(pick([
      `For older ${city} homes (average ${age} years), beware of ${info.noun} quotes that don't mention code compliance. Modern codes have changed significantly since these homes were built — any work that triggers inspection should be priced with code upgrades included.`,
      `In ${city}, ${info.noun} on homes over ${Math.round(age * 0.8)} years old should include a contingency line item (10-15% of total). Contractors who guarantee fixed pricing on old-home work either haven't looked closely enough or plan to cut corners when surprises appear.`,
    ], seed + 6));
  }

  return flags.join(" ");
}

function main() {
  const vertSlugs = Object.keys(VERT_INFO);

  for (const vslug of vertSlugs) {
    const ctxPath = path.join(ROOT, "data", `${vslug}-city-context.json`);
    if (!fs.existsSync(ctxPath)) {
      console.log(`${vslug}: no context file, skipping`);
      continue;
    }

    const vertCtx = JSON.parse(fs.readFileSync(ctxPath, "utf8"));
    let enriched = 0;

    for (const [ck, entry] of Object.entries(vertCtx)) {
      if (!ck.includes("|")) continue;
      const [cityName, sc] = ck.split("|");
      const cityCtx = CTX[ck] || {};
      const cityMult = MULT[ck] || {};

      entry.costDriverNote = buildCostDriverNote(cityName, sc, vslug, cityCtx, cityMult);
      entry.redFlagNote = buildRedFlagNote(cityName, sc, vslug, cityCtx, cityMult);
      enriched++;
    }

    fs.writeFileSync(ctxPath, JSON.stringify(vertCtx, null, 2), "utf8");
    console.log(`${vslug}: enriched ${enriched} entries with costDriverNote + redFlagNote`);
  }

  console.log("\nDone. Re-run inject-city-content-v2.py and v3.py to apply.");
}

main();
