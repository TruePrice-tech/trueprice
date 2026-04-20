#!/usr/bin/env node
/**
 * inject-structural-diversity.js
 *
 * Post-processes city pages to vary structural elements that Google
 * detects as template indicators:
 *
 * 1. Section headings (H2s) -- varied per city via deterministic hash
 * 2. FAQ questions -- selected from a pool of 8-12 per vertical, 3-5 shown per city
 * 3. CTA copy -- varied per city
 * 4. V2/V3/V4/V5 section headings -- varied per city
 *
 * Idempotent: tracks applied state via TP-STRUCT-DIV marker.
 * Safe: never modifies flagship content (inside FLAGSHIP markers).
 *
 * Usage: node scripts/inject-structural-diversity.js [vertical]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
function pick(arr, seed) { return arr[seed % arr.length]; }
// Lowercase preserving acronyms (HVAC, BLS, HOA, UV, etc.)
function smartLower(s) { return s.split(' ').map(w => /^[A-Z]{2,}/.test(w) ? w : w.toLowerCase()).join(' '); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Load city context for compositional heading generation
let cityContext = {};
try { cityContext = require(path.join(ROOT, "data/city-context.json")); } catch(e) {}

// Compositional qualifiers derived from city data
function getCityQualifier(cityName, stateCode, seed) {
  const key = `${cityName}|${stateCode}`;
  const ctx = cityContext[key] || {};
  const climateMap = {
    hot_humid: "warm-climate", hot_dry: "desert", cold: "cold-weather",
    mixed_humid: "mid-Atlantic", mixed_dry: "inland", marine: "coastal",
    very_cold: "northern", subarctic: "far-north"
  };
  const climateAdj = climateMap[ctx.climateZone] || "local";
  const ageGroup = ctx.avgHomeAge > 50 ? "older-home" : ctx.avgHomeAge > 30 ? "established" : "newer-development";
  const growthAdj = ctx.growthRate === "high" ? "fast-growing" : ctx.growthRate === "low" ? "stable" : "growing";

  const qualifiers = [
    `in the ${cityName} metro`,
    `across ${cityName} neighborhoods`,
    `for ${cityName}-area homeowners`,
    `in ${cityName} and surrounding areas`,
    `for properties in ${cityName}`,
    `in the greater ${cityName} area`,
    `around ${cityName}, ${stateCode}`,
    `for ${cityName} residents`,
    `in ${cityName}'s ${climateAdj} market`,
    `for ${cityName}'s ${ageGroup} housing stock`,
    `in ${growthAdj} ${cityName}`,
    `across the ${cityName}, ${stateCode} region`,
    `in ${cityName}'s ${climateAdj} climate`,
    `for ${cityName} and nearby ${stateCode} areas`,
    `in ${cityName}'s contractor market`,
    `for ${cityName}-area properties`,
  ];
  return pick(qualifiers, seed);
}

// ─── HEADING VARIATIONS ─────────────────────────────────────────────────
// Each key is the normalized heading pattern (with CITY placeholder).
// Values are arrays of alternative phrasings.

const H2_VARIATIONS = {
  // "What affects X cost in CITY"
  "what_affects": [
    (trade, city) => `What affects ${trade} cost in ${city}`,
    (trade, city) => `Why ${trade} prices vary in ${city}`,
    (trade, city) => `${city} ${trade} pricing factors`,
    (trade, city) => `What drives ${trade} quotes in ${city}`,
    (trade, city) => `Key cost drivers for ${trade} in ${city}`,
    (trade, city) => `Understanding ${trade} pricing in ${city}`,
    (trade, city) => `${trade} cost breakdown for ${city}`,
    (trade, city) => `What goes into a ${city} ${trade} quote`,
  ],
  // "X Cost by Y in CITY"
  "cost_by_size": [
    (trade, size, city) => `${trade} Cost by ${size} in ${city}`,
    (trade, size, city) => `${city} ${trade} pricing by ${size.toLowerCase()}`,
    (trade, size, city) => `How ${size.toLowerCase()} affects ${trade.toLowerCase()} cost in ${city}`,
    (trade, size, city) => `${trade} estimates by ${size.toLowerCase()} in ${city}`,
    (trade, size, city) => `${city} ${trade.toLowerCase()} price ranges by ${size.toLowerCase()}`,
  ],
  // "Frequently Asked Questions"
  "faq_heading": [
    (city, trade) => `Common ${trade.toLowerCase()} questions in ${city}`,
    (city, trade) => `${city} ${trade.toLowerCase()} FAQ`,
    (city, trade) => `Questions ${city} homeowners ask about ${trade.toLowerCase()}`,
    (city, trade) => `${trade} questions for ${city} homeowners`,
    (city, trade) => `What ${city} residents ask about ${trade.toLowerCase()}`,
    (city, trade) => `Frequently asked ${trade.toLowerCase()} questions`,
    (city, trade) => `${city} ${trade.toLowerCase()}: answers to common questions`,
  ],
  // "Other Services in CITY"
  "other_services": [
    (city) => `Other services in ${city}`,
    (city) => `More home services in ${city}`,
    (city) => `${city} contractor services`,
    (city) => `Related services in ${city}`,
    (city) => `Browse ${city} home services`,
    (city) => `Other projects in ${city}`,
  ],
  // "Get a free cost estimate for CITY"
  "cta_heading": [
    (city) => `Get a free cost estimate for ${city}`,
    (city) => `Compare ${city} contractor costs`,
    (city) => `Check pricing in ${city}`,
    (city) => `Get your ${city} estimate`,
    (city) => `See ${city} pricing`,
    (city) => `${city} cost comparison`,
  ],
  // "X in CITY, ST: what locals should know" -- compositional: template x qualifier
  "locals_should_know": [
    (trade, _cs, q) => `${trade} ${q}: what to know`,
    (trade, _cs, q) => `What homeowners ${q} need to know about ${trade}`,
    (trade, _cs, q) => `${trade} ${q}: a local perspective`,
    (trade, _cs, q) => `Local ${trade} advice ${q}`,
    (trade, _cs, q) => `${trade} ${q}: insider knowledge`,
    (trade, _cs, q) => `${trade} ${q}: homeowner essentials`,
    (trade, _cs, q) => `What makes ${trade} different ${q}`,
    (trade, _cs, q) => `${trade} landscape ${q}`,
    (trade, _cs, q) => `${trade} cost guide ${q}`,
    (trade, _cs, q) => `${trade} realities ${q}`,
    (trade, _cs, q) => `Navigating ${trade} costs ${q}`,
    (trade, _cs, q) => `${trade} ${q}: local context`,
    (trade, _cs, q) => `${trade} market snapshot ${q}`,
    (trade, _cs, q) => `${trade} ${q}: key facts`,
    (trade, _cs, q) => `${trade} ${q}: conditions and costs`,
    (trade, _cs, q) => `Understanding ${trade} ${q}`,
    (trade, _cs, q) => `${trade} considerations ${q}`,
    (trade, _cs, q) => `${trade} overview ${q}`,
    (trade, _cs, q) => `${trade} ${q}: the local angle`,
    (trade, _cs, q) => `${trade} basics ${q}`,
  ],
  // "X cost in nearby ST cities" -- compositional with city qualifier
  "nearby_cities": [
    (trade, state, q) => `${trade} cost in nearby ${state} cities`,
    (trade, state, q) => `How nearby ${state} cities compare on ${trade}`,
    (trade, state, q) => `${trade} pricing across the ${state} region`,
    (trade, state, q) => `${state} neighbors: ${trade} cost comparison`,
    (trade, state, q) => `What other ${state} cities pay for ${trade}`,
    (trade, state, q) => `${trade} rates in surrounding ${state} areas`,
    (trade, state, q) => `Nearby ${state} ${trade} pricing`,
    (trade, state, q) => `${trade} costs: ${state} city-by-city`,
    (trade, state, q) => `Compare ${trade} rates in ${state}`,
    (trade, state, q) => `${state} regional ${trade} pricing`,
    (trade, state, q) => `Other ${state} cities for ${trade} quotes`,
    (trade, state, q) => `${trade} in other ${state} metros`,
    (trade, state, q) => `${state} ${trade} pricing: nearby cities`,
    (trade, state, q) => `Regional ${trade} cost data for ${state}`,
    (trade, state, q) => `${trade} costs across ${state}`,
    (trade, state, q) => `${state} cities: ${trade} price ranges`,
    (trade, state, q) => `How ${trade} prices compare in ${state}`,
    (trade, state, q) => `${trade} in neighboring ${state} areas`,
    (trade, state, q) => `Nearby ${trade} markets in ${state}`,
    (trade, state, q) => `${state} ${trade}: regional rate comparison`,
  ],
  // V2: "About X in CITY, ST"
  "about_section": [
    (trade, cityState) => `About ${trade} in ${cityState}`,
    (trade, cityState) => `Understanding ${trade} costs in ${cityState}`,
    (trade, cityState) => `${cityState} ${trade} market overview`,
    (trade, cityState) => `${trade} pricing explained: ${cityState}`,
    (trade, cityState) => `What shapes ${trade} pricing in ${cityState}`,
    (trade, cityState) => `${cityState}: ${trade} cost factors`,
    (trade, cityState) => `${trade} market conditions in ${cityState}`,
    (trade, cityState) => `How ${trade} pricing works in ${cityState}`,
    (trade, cityState) => `${cityState} ${trade} cost landscape`,
    (trade, cityState) => `What influences ${trade} rates in ${cityState}`,
    (trade, cityState) => `${trade} economics in ${cityState}`,
    (trade, cityState) => `${cityState}: understanding ${trade} pricing`,
    (trade, cityState) => `The ${cityState} ${trade} market explained`,
    (trade, cityState) => `${trade} cost overview for ${cityState}`,
    (trade, cityState) => `${cityState} ${trade}: market context`,
    (trade, cityState) => `Decoding ${trade} costs in ${cityState}`,
    (trade, cityState) => `${trade} pricing trends in ${cityState}`,
    (trade, cityState) => `${cityState} ${trade} rates: what to know`,
    (trade, cityState) => `Inside ${cityState} ${trade} pricing`,
    (trade, cityState) => `${trade} in ${cityState}: cost dynamics`,
  ],
  // V3: "Local factors: X in CITY, ST"
  "local_factors": [
    (trade, cityState) => `Local factors: ${trade} in ${cityState}`,
    (trade, cityState) => `${cityState} ${trade}: local considerations`,
    (trade, cityState) => `What ${cityState} homeowners should know about ${trade}`,
    (trade, cityState) => `${trade} in ${cityState}: the local picture`,
    (trade, cityState) => `${cityState}-specific ${trade} considerations`,
    (trade, cityState) => `${trade} insights for ${cityState}`,
    (trade, cityState) => `${cityState} ${trade}: what the data shows`,
    (trade, cityState) => `${trade} conditions unique to ${cityState}`,
    (trade, cityState) => `Local ${trade} factors in ${cityState}`,
    (trade, cityState) => `${trade} in ${cityState}: ground-level details`,
    (trade, cityState) => `${cityState} residents: ${trade} specifics`,
    (trade, cityState) => `What sets ${cityState} apart for ${trade}`,
    (trade, cityState) => `${trade} nuances in the ${cityState} area`,
    (trade, cityState) => `${cityState} ${trade}: neighborhood-level context`,
    (trade, cityState) => `On-the-ground ${trade} info for ${cityState}`,
    (trade, cityState) => `${trade} reality check: ${cityState}`,
    (trade, cityState) => `${cityState} area ${trade}: local intel`,
    (trade, cityState) => `Hyper-local ${trade} details for ${cityState}`,
    (trade, cityState) => `${trade} in ${cityState}: beyond the averages`,
    (trade, cityState) => `${cityState} ${trade}: practical local info`,
  ],
  // V4: "Pricing snapshot & nearby comparisons: CITY, ST"
  "pricing_snapshot": [
    (cityState) => `Pricing snapshot &amp; nearby comparisons: ${cityState}`,
    (cityState) => `${cityState} pricing vs. nearby cities`,
    (cityState) => `How ${cityState} compares to nearby markets`,
    (cityState) => `${cityState} cost comparison with neighbors`,
    (cityState) => `Regional pricing context: ${cityState}`,
    (cityState) => `${cityState} vs. the region: cost comparison`,
    (cityState) => `How ${cityState} stacks up regionally`,
    (cityState) => `${cityState} pricing in regional context`,
    (cityState) => `Comparing ${cityState} to surrounding areas`,
    (cityState) => `${cityState} cost position among neighbors`,
    (cityState) => `Regional cost benchmarks for ${cityState}`,
    (cityState) => `${cityState}: where you stand on pricing`,
    (cityState) => `Nearby market comparison for ${cityState}`,
    (cityState) => `${cityState} pricing relative to neighbors`,
    (cityState) => `Cost landscape around ${cityState}`,
    (cityState) => `${cityState} in the regional pricing picture`,
    (cityState) => `How ${cityState} rates compare locally`,
    (cityState) => `${cityState} area: comparative pricing data`,
    (cityState) => `Regional rate check: ${cityState}`,
    (cityState) => `${cityState} vs. nearby: who pays what`,
  ],
  // V5: "What tradespeople earn in CITY, ST"
  "tradespeople_earn": [
    (cityState) => `What tradespeople earn in ${cityState}`,
    (cityState) => `${cityState} trade wages and labor costs`,
    (cityState) => `Labor rates in ${cityState}`,
    (cityState) => `${cityState} contractor wages: BLS data`,
    (cityState) => `Trade labor costs in ${cityState}`,
    (cityState) => `${cityState} wage data for contractors`,
    (cityState) => `What contractors earn in ${cityState}`,
    (cityState) => `${cityState} labor market: trade wages`,
    (cityState) => `Contractor pay rates in ${cityState}`,
    (cityState) => `${cityState}: skilled trade wages`,
    (cityState) => `BLS wage data for ${cityState} trades`,
    (cityState) => `${cityState} contractor compensation`,
    (cityState) => `Trade worker earnings in ${cityState}`,
    (cityState) => `${cityState} labor costs: by the numbers`,
    (cityState) => `What ${cityState} pays its contractors`,
    (cityState) => `Wage benchmarks for ${cityState} trades`,
    (cityState) => `${cityState} trade labor: earnings data`,
    (cityState) => `Contractor rates in the ${cityState} market`,
    (cityState) => `${cityState}: trade wage overview`,
    (cityState) => `Labor cost data for ${cityState}`,
  ],
};

// ─── FAQ POOLS ──────────────────────────────────────────────────────────
// Each vertical has 10-15 FAQ Q&A pairs. Each city gets 3-5 selected by hash.

const FAQ_POOLS = {
  "hvac": [
    { q: (c) => `How much does a new HVAC system cost in ${c}?`, a: (c) => `Most homeowners in ${c} pay between $4,000 and $14,000 for a new HVAC system, depending on equipment type, efficiency rating, and home size.` },
    { q: () => `Should I replace my AC and furnace at the same time?`, a: () => `Replacing both at once is usually more cost-effective. Matched systems run more efficiently, and you save on labor since the contractor is already on-site.` },
    { q: () => `What SEER rating should I choose?`, a: () => `16 SEER is the sweet spot for most homeowners. Higher ratings save more on energy but have longer payback periods. In hot climates, 18+ SEER pays back faster.` },
    { q: (c) => `How long does HVAC installation take in ${c}?`, a: () => `A standard residential HVAC replacement takes 1-2 days. Complex jobs involving ductwork modification or system-type changes can take 3-5 days.` },
    { q: () => `What is the difference between a heat pump and a furnace?`, a: () => `A heat pump moves heat using refrigerant and handles both heating and cooling. A furnace burns fuel to create heat and requires a separate AC unit for cooling.` },
    { q: (c) => `When is the best time to replace HVAC in ${c}?`, a: (c) => `Off-peak seasons offer the best pricing and availability in ${c}. Spring and fall are typically 10-20% cheaper than emergency summer or winter replacements.` },
    { q: () => `How long does a new HVAC system last?`, a: () => `A properly maintained system lasts 15-20 years. Air conditioners and heat pumps last 12-17 years, while gas furnaces can reach 20-25 years with annual maintenance.` },
    { q: () => `Is a two-stage system worth the extra cost?`, a: () => `Two-stage and variable-speed systems run quieter, dehumidify better, and maintain more consistent temperatures. The $1,000-$2,500 premium pays back in 5-8 years through energy savings and comfort.` },
    { q: (c) => `Do I need a permit for HVAC replacement in ${c}?`, a: (c) => `Yes. Most ${c} jurisdictions require a mechanical permit for HVAC replacement. Your contractor should pull the permit and schedule the inspection.` },
    { q: () => `What size HVAC system do I need?`, a: () => `System size depends on home square footage, insulation quality, window area, and climate zone. A Manual J load calculation determines the correct size. Never accept rule-of-thumb sizing.` },
  ],
  "roof": [
    { q: (c) => `How much does a new roof cost in ${c}?`, a: (c) => `Most homeowners in ${c} pay between $8,000 and $16,000 for a new roof, depending on size, material, and complexity.` },
    { q: () => `How long does a roof replacement take?`, a: () => `Most residential roofs take 1-3 days to replace. Complex roofs with multiple layers, steep pitch, or extensive damage can take 4-7 days.` },
    { q: () => `Should I repair or replace my roof?`, a: () => `If damage covers less than 30% of the roof and the roof is under 15 years old, repair is usually sufficient. Beyond that, replacement provides better long-term value.` },
    { q: (c) => `What roofing material is best for ${c}?`, a: (c) => `Material choice depends on ${c}'s climate, your budget, and desired lifespan. Architectural shingles offer the best balance of cost and durability for most homeowners.` },
    { q: () => `Why do roofing quotes vary so much?`, a: () => `Quotes differ based on material quality, labor assumptions, flashing work, ventilation, and warranty coverage. Lower bids often exclude items that appear as change orders later.` },
    { q: () => `Does homeowners insurance cover roof replacement?`, a: () => `Insurance covers sudden damage (storms, falling trees) but not wear-and-tear or maintenance neglect. Verify your policy covers replacement cost, not depreciated value.` },
    { q: (c) => `Do I need a permit for roof replacement in ${c}?`, a: (c) => `Yes. Most ${c} jurisdictions require a building permit for roof replacement. Your contractor should handle the permit and schedule inspection.` },
    { q: () => `How many layers of shingles can I have?`, a: () => `Most building codes allow a maximum of two layers. If you already have two layers, the old roof must be torn off before the new one is installed, adding $1,000-$3,000 to the cost.` },
    { q: () => `What is the most affordable roofing option?`, a: () => `Three-tab asphalt shingles are the most affordable at $3-5 per square foot installed. Architectural shingles cost $4-7/sqft but last 10-15 years longer, making them a better value over time.` },
    { q: () => `Should I choose the lowest roofing quote?`, a: () => `Not always. Lower bids sometimes exclude flashing, ventilation upgrades, or disposal costs that appear later as change orders. Compare scope, not just price.` },
    { q: () => `What is a roofing square?`, a: () => `A roofing square equals 100 square feet. A typical 2,000 sqft roof is about 20 squares. Contractors price materials and labor per square.` },
    { q: () => `How do I know if my roof deck needs replacing?`, a: () => `Signs include sagging between rafters, soft or spongy spots when walked on, visible water stains from the attic, and rotted or delaminating plywood. Your roofer checks this during tear-off.` },
    { q: (c) => `What time of year is cheapest for roofing in ${c}?`, a: (c) => `Late fall and winter are typically slower seasons in ${c}, so contractors may offer better pricing. Spring and summer are peak demand, meaning longer waits and higher labor costs.` },
    { q: () => `What is the difference between architectural and 3-tab shingles?`, a: () => `Architectural shingles are thicker, have a dimensional look, and last 25-30 years. 3-tab shingles are flat, thinner, and last 15-20 years but cost 30-40% less upfront.` },
    { q: () => `Does a new roof increase home value?`, a: () => `A new roof recovers roughly 60-70% of its cost at resale and eliminates a major buyer objection. Homes with new roofs sell faster and with fewer inspection contingencies.` },
  ],
  "plumbing": [
    { q: (c) => `How much does a plumber charge per hour in ${c}?`, a: (c) => `Plumbers in ${c} typically charge $75-$150 per hour. Emergency and after-hours calls add a $100-$200 trip fee on top of the hourly rate.` },
    { q: () => `How much does it cost to replace a water heater?`, a: () => `A standard 50-gallon tank water heater runs $1,200-$2,500 installed. Tankless units cost $2,500-$5,000 but last roughly twice as long and cut energy bills 20-30%.` },
    { q: () => `What is the difference between copper and PEX piping?`, a: () => `Copper lasts 50+ years, resists bacteria, and has proven durability. PEX costs 60% less, installs faster, resists freezing better, and requires fewer joints. Both are code-compliant.` },
    { q: (c) => `Do I need a plumbing permit in ${c}?`, a: (c) => `Most ${c} jurisdictions require permits for new lines, water heater installs, and sewer work. Minor repairs like faucet swaps and toilet replacements typically do not need permits.` },
    { q: () => `How do I know if I have a slab leak?`, a: () => `Signs include unexplained spikes in your water bill, warm spots on the floor, the sound of running water when fixtures are off, and cracks in the foundation or damp baseboards.` },
    { q: () => `What causes low water pressure?`, a: () => `Common causes include corroded galvanized pipes, a partially closed main valve, mineral buildup in fixtures, a failing pressure regulator, or a hidden leak in the supply line.` },
    { q: () => `Should I repair or replace old pipes?`, a: () => `If your home has galvanized steel or polybutylene pipes, full replacement is usually worthwhile. Copper or PEX in good condition can be repaired locally. A camera inspection reveals the true condition.` },
    { q: (c) => `How often should I have my drains cleaned in ${c}?`, a: (c) => `Annual drain maintenance is recommended for most ${c} homes. Older homes with mature trees nearby may need semi-annual service to prevent root intrusion.` },
    { q: () => `What does a plumbing inspection include?`, a: () => `A thorough inspection covers supply lines, drain lines, water heater condition, fixture connections, shutoff valves, water pressure testing, and a visual check for leaks and corrosion.` },
    { q: () => `Is trenchless sewer repair worth the extra cost?`, a: () => `Trenchless repair costs 20-40% more but avoids excavating your yard, driveway, or landscaping. It is faster and causes less property damage, often making it cheaper overall.` },
    { q: () => `How long do plumbing fixtures typically last?`, a: () => `Faucets last 15-20 years, toilets 25-50 years, water heaters 8-12 years (tank) or 15-20 years (tankless), and supply lines should be replaced every 20-25 years.` },
    { q: () => `What is a backflow preventer and do I need one?`, a: () => `A backflow preventer stops contaminated water from flowing back into the clean supply. Most municipalities require them on irrigation systems and commercial properties. Some require annual testing.` },
    { q: () => `Why does my water heater make popping noises?`, a: () => `Popping or rumbling sounds come from sediment buildup at the bottom of the tank. Flushing the tank annually prevents this and extends the heater's lifespan by 2-3 years.` },
    { q: (c) => `What is the average cost of a bathroom remodel plumbing rough-in in ${c}?`, a: (c) => `A bathroom plumbing rough-in in ${c} typically costs $1,500-$4,000 for new supply and drain lines. Moving fixtures from their original locations adds $500-$1,500 per fixture.` },
    { q: () => `Can I do plumbing repairs myself?`, a: () => `Simple tasks like replacing a faucet cartridge or fixing a running toilet are DIY-friendly. Anything involving supply lines, gas connections, sewer work, or permits should be left to a licensed plumber.` },
  ],
  "electrical": [
    { q: (c) => `How much does an electrician charge per hour in ${c}?`, a: (c) => `Electricians in ${c} typically charge $80-$150 per hour. Master electricians and emergency calls run higher, while apprentice rates are lower.` },
    { q: () => `How much does a panel upgrade cost?`, a: () => `Upgrading from 100-amp to 200-amp service typically costs $1,800-$4,000 including the panel, breakers, permit, and inspection. Upgrading the utility meter base adds $500-$1,000.` },
    { q: () => `When should I upgrade my electrical panel?`, a: () => `Upgrade if your panel uses fuses instead of breakers, you are adding major appliances (EV charger, heat pump, hot tub), breakers trip frequently, or your home has less than 200-amp service.` },
    { q: (c) => `Do I need a permit for electrical work in ${c}?`, a: (c) => `Most ${c} jurisdictions require permits for new circuits, panel upgrades, and any work beyond simple fixture swaps. Your electrician should handle permitting and schedule the inspection.` },
    { q: () => `How much does it cost to add an outlet?`, a: () => `Adding a standard outlet costs $150-$300 if wiring can be run through accessible spaces. If walls need to be opened or a new circuit is required, expect $300-$600 per outlet.` },
    { q: () => `What is the difference between GFCI and AFCI breakers?`, a: () => `GFCI protects against ground faults (electrocution risk near water). AFCI detects arc faults (fire risk from damaged wiring). Modern code requires both in specific locations throughout the home.` },
    { q: () => `How much does it cost to wire a new room?`, a: () => `Wiring a new room with outlets, switches, and lighting runs $1,000-$3,000 depending on the number of circuits, fixtures, and how accessible the wall and ceiling cavities are.` },
    { q: () => `Is aluminum wiring dangerous?`, a: () => `Aluminum wiring itself is not dangerous, but the connections can overheat due to oxidation and expansion. Homes with aluminum wiring should have COPALUM or AlumiConn connectors installed at every connection point.` },
    { q: () => `How much does EV charger installation cost?`, a: () => `A Level 2 EV charger installation costs $500-$2,000 for labor, plus $300-$700 for the charger. If your panel needs a dedicated 240V circuit or an upgrade, add $500-$2,500.` },
    { q: () => `What is knob-and-tube wiring?`, a: () => `Knob-and-tube is an early wiring method found in pre-1950s homes. It lacks a ground wire and cannot handle modern electrical loads. Many insurers require replacement before issuing a policy.` },
    { q: () => `How do I know if my home needs rewiring?`, a: () => `Warning signs include flickering lights, warm outlets, burning smells, frequently tripping breakers, two-prong outlets throughout, and a panel with fuses instead of breakers.` },
    { q: (c) => `How much does a whole-house generator cost in ${c}?`, a: (c) => `A whole-house standby generator costs $5,000-$15,000 installed in ${c}, depending on wattage (14kW-24kW), fuel type (natural gas or propane), and the transfer switch configuration.` },
    { q: () => `Can I install recessed lighting myself?`, a: () => `While physically possible, running new circuits and making connections in existing walls carries fire and shock risk. Most jurisdictions require a licensed electrician and a permit for new fixture circuits.` },
    { q: () => `What does a home electrical inspection cover?`, a: () => `A full inspection covers the main panel, grounding system, all circuits, outlet polarity and GFCI function, smoke detectors, exterior wiring, and code compliance for visible wiring.` },
    { q: () => `How much does it cost to install recessed lighting?`, a: () => `Recessed lights cost $150-$300 per fixture installed when wiring is accessible. A typical living room with 6 lights runs $900-$1,800. LED retrofit kits for existing cans cost $20-$40 each.` },
  ],
  "solar": [
    { q: (c) => `How much does solar cost in ${c}?`, a: (c) => `Most homeowners in ${c} pay $15,000-$30,000 before incentives for a 6-10kW system. After the 30% federal tax credit, net cost drops to $10,500-$21,000.` },
    { q: () => `How does the federal solar tax credit work?`, a: () => `The Investment Tax Credit (ITC) lets you deduct 30% of your total solar installation cost from your federal taxes. It applies to purchased systems, not leased. There is no cap on the credit amount.` },
    { q: () => `Should I buy or lease solar panels?`, a: () => `Buying maximizes long-term savings and increases home value. Leasing eliminates upfront cost but the leasing company keeps the tax credit, and panels may complicate home sales.` },
    { q: (c) => `How long does solar take to pay for itself in ${c}?`, a: (c) => `Payback in ${c} depends on electricity rates, sun hours, and incentives. Most systems pay back in 6-10 years and then generate free electricity for another 15-20 years.` },
    { q: () => `Do solar panels work on cloudy days?`, a: () => `Yes. Panels produce 10-25% of their rated output on overcast days. Annual production matters more than any single day. Systems are sized to account for regional cloud cover patterns.` },
    { q: () => `How long do solar panels last?`, a: () => `Modern panels are warrantied for 25-30 years and continue producing at reduced efficiency beyond that. Inverters last 10-15 years (string) or 25 years (microinverters) and are the main replacement cost.` },
    { q: () => `What is net metering?`, a: () => `Net metering credits you for excess electricity your panels send to the grid. Your meter runs backward during the day and forward at night. Policies and credit rates vary by state and utility.` },
    { q: () => `Will solar panels damage my roof?`, a: () => `Properly installed panels do not damage roofs. Reputable installers use flashing and sealant at every penetration point. If your roof needs replacement within 5-10 years, do it before installing solar.` },
    { q: () => `How many panels do I need?`, a: () => `Panel count depends on your electricity usage, panel wattage, and roof sun exposure. A typical home uses 20-30 panels (400W each) to offset 80-100% of electricity consumption.` },
    { q: (c) => `Does ${c} have any state or local solar incentives?`, a: (c) => `Incentives vary. Check the DSIRE database for ${c}-specific rebates, SRECs, property tax exemptions, and performance-based incentives that stack on top of the federal 30% ITC.` },
    { q: () => `What is the difference between string inverters and microinverters?`, a: () => `String inverters are cheaper but the whole array drops output when one panel is shaded. Microinverters optimize each panel independently, cost 15-20% more, and last longer.` },
    { q: () => `Do solar panels increase home value?`, a: () => `Owned solar systems add roughly $15,000-$20,000 to home value according to national studies. Leased systems do not add value and can complicate the sale process.` },
    { q: () => `Can I add a battery to my solar system?`, a: () => `Yes. Adding a home battery (10-13 kWh) costs $8,000-$15,000 installed. Batteries provide backup power during outages and can help avoid peak-rate charges in time-of-use markets.` },
    { q: () => `What happens to solar panels during a power outage?`, a: () => `Grid-tied systems without batteries shut off during outages for safety (anti-islanding). A battery backup or hybrid inverter lets you use solar power during grid failures.` },
    { q: () => `How much roof space do I need for solar?`, a: () => `Each 400W panel needs about 18 square feet. A 8kW system (20 panels) requires roughly 360 square feet of unshaded, south-facing roof space. East and west orientations work but produce 10-15% less.` },
  ],
  "kitchen-remodel": [
    { q: (c) => `How much does a kitchen remodel cost in ${c}?`, a: (c) => `Kitchen remodels in ${c} range from $15,000-$30,000 for a mid-range update to $50,000-$100,000+ for a full gut renovation with custom cabinets and high-end finishes.` },
    { q: () => `How long does a kitchen remodel take?`, a: () => `A cosmetic refresh takes 2-4 weeks. A mid-range remodel runs 6-10 weeks. A full gut renovation with layout changes takes 12-16 weeks. Permit delays and backordered materials can add 2-4 weeks.` },
    { q: () => `What is the most expensive part of a kitchen remodel?`, a: () => `Cabinets are typically the largest single expense at 30-40% of the total budget. Countertops are second at 10-15%, followed by labor, appliances, and flooring.` },
    { q: () => `Should I refinish or replace my cabinets?`, a: () => `Refinish if the cabinet boxes are solid wood and structurally sound. Replace if they are particleboard, water-damaged, or you want to change the layout. Refinishing costs 30-50% of new cabinets.` },
    { q: () => `What countertop material is the best value?`, a: () => `Quartz offers the best balance of durability, appearance, and maintenance. It costs $50-$100/sqft installed. Butcher block ($40-$70/sqft) and laminate ($15-$40/sqft) are budget-friendly alternatives.` },
    { q: (c) => `Do I need a permit for a kitchen remodel in ${c}?`, a: (c) => `In ${c}, permits are required if you move plumbing, add electrical circuits, or change the structural layout. Cosmetic updates like paint, hardware, and countertop swaps do not need permits.` },
    { q: () => `How much does it cost to move kitchen plumbing?`, a: () => `Moving a sink or dishwasher 3-5 feet costs $500-$1,500. Moving plumbing to a different wall or adding a kitchen island with plumbing costs $2,000-$5,000 depending on access and distance.` },
    { q: () => `Is it worth remodeling a kitchen before selling?`, a: () => `A mid-range kitchen remodel recovers 70-80% of its cost at resale. Minor updates (paint, hardware, backsplash) recover even more. Full gut renovations rarely pay back dollar for dollar.` },
    { q: () => `What is the average cost per square foot for a kitchen remodel?`, a: () => `Budget remodels run $75-$150/sqft, mid-range $150-$300/sqft, and high-end $300-$500+/sqft. A 150 sqft kitchen at mid-range would cost $22,500-$45,000.` },
    { q: () => `Should I hire a general contractor or manage subs myself?`, a: () => `A GC adds 15-25% overhead but manages scheduling, permits, and quality across trades. Self-managing saves money but requires significant time and construction knowledge to coordinate plumbing, electrical, and carpentry.` },
    { q: () => `How much do new kitchen appliances cost?`, a: () => `A mid-range appliance package (range, refrigerator, dishwasher, microwave) costs $3,000-$6,000. Premium brands run $8,000-$15,000+. Buy during holiday sales for 20-40% savings.` },
    { q: () => `What is a realistic budget for a small kitchen remodel?`, a: () => `A 100 sqft kitchen can be refreshed for $10,000-$15,000 (paint, hardware, countertops, backsplash). A full remodel with new cabinets and flooring runs $20,000-$35,000.` },
    { q: () => `Can I remodel my kitchen in phases?`, a: () => `Yes. A common approach: Phase 1 is paint, hardware, and lighting. Phase 2 is countertops and backsplash. Phase 3 is cabinets and flooring. Phasing spreads cost but means living through multiple disruptions.` },
    { q: () => `What kitchen layout is most efficient?`, a: () => `The work triangle (sink, stove, fridge within 4-9 feet of each other) remains the gold standard. L-shaped and U-shaped layouts are most efficient. Galley kitchens work well for single-cook households.` },
    { q: () => `How much value does a kitchen island add?`, a: () => `A kitchen island adds $3,000-$10,000 to project cost. It increases counter space, storage, and resale appeal. You need at least 42 inches of clearance on all sides for traffic flow.` },
  ],
  "window": [
    { q: (c) => `How much does window replacement cost in ${c}?`, a: (c) => `Window replacement in ${c} costs $400-$1,200 per window installed, depending on size, frame material, glass type, and accessibility. A whole-house project (10-15 windows) runs $5,000-$15,000.` },
    { q: () => `What type of replacement window is best?`, a: () => `Vinyl frames offer the best value with low maintenance and good insulation. Fiberglass is more durable and paintable. Wood has the best aesthetics but needs ongoing maintenance. Aluminum is cheapest but conducts heat.` },
    { q: () => `Should I replace all windows at once?`, a: () => `Replacing all windows at once saves 10-15% on labor versus doing them individually. It also ensures uniform appearance and consistent energy performance throughout the home.` },
    { q: () => `What is the difference between double-pane and triple-pane windows?`, a: () => `Triple-pane windows add 15-25% better insulation over double-pane but cost 25-35% more. They pay back faster in extreme climates (very cold winters or very hot summers).` },
    { q: () => `How long do replacement windows last?`, a: () => `Vinyl windows last 20-30 years, fiberglass 30-40 years, wood 30+ years with maintenance, and aluminum 20-25 years. Failed seals (foggy glass) are the most common early failure.` },
    { q: () => `What is Low-E glass?`, a: () => `Low-E (low emissivity) coating reflects infrared heat while allowing visible light through. It reduces heat gain in summer and heat loss in winter, cutting energy costs 10-25%.` },
    { q: (c) => `Do I need a permit for window replacement in ${c}?`, a: (c) => `In ${c}, permits are typically required when changing window size or adding new openings. Same-size replacements usually do not need permits, but check your local building department.` },
    { q: () => `What is the difference between full-frame and insert replacement?`, a: () => `Insert replacement fits a new window into the existing frame, is faster, and costs less. Full-frame replacement removes everything down to the studs, costs 30-50% more, but fixes hidden damage.` },
    { q: () => `How much energy do new windows actually save?`, a: () => `Replacing single-pane windows saves 25-30% on heating and cooling costs. Upgrading from older double-pane to modern Low-E double-pane saves 10-15%. Payback takes 10-15 years through energy savings alone.` },
    { q: () => `Do replacement windows increase home value?`, a: () => `New windows recover 65-75% of their cost at resale. They also improve curb appeal, reduce noise, and eliminate a common inspection concern for buyers.` },
    { q: () => `What is argon gas fill in windows?`, a: () => `Argon is an inert gas sealed between panes that insulates better than air. It improves R-value by 15-20% and is standard on most quality double and triple-pane windows. It slowly leaks over 15-20 years.` },
    { q: () => `How do I know my windows need replacing?`, a: () => `Replace when you see fog between panes (failed seal), feel drafts with windows closed, frames are rotting or warping, locks no longer engage, or energy bills are rising with no other explanation.` },
    { q: () => `Are bay and bow windows more expensive?`, a: () => `Bay windows cost $1,500-$4,000 installed and bow windows $2,500-$5,500. Both require structural support and add 3-4x the cost of a standard same-sized window.` },
    { q: () => `What U-factor should I look for?`, a: () => `Lower U-factor means better insulation. Aim for 0.25-0.30 in cold climates and 0.30-0.40 in mild climates. Energy Star requirements vary by region.` },
    { q: () => `Should I replace window screens too?`, a: () => `New windows almost always include new screens. If reusing inserts, check screen mesh for holes and frame corners for separation. Replacement screens cost $25-$75 each.` },
  ],
  "siding": [
    { q: (c) => `How much does siding replacement cost in ${c}?`, a: (c) => `Siding replacement in ${c} costs $6,000-$18,000 for an average home. Vinyl is the most affordable ($4-$8/sqft installed), while fiber cement ($8-$14/sqft) and wood ($10-$18/sqft) cost more.` },
    { q: () => `What siding material lasts the longest?`, a: () => `Fiber cement (James Hardie) lasts 40-50 years with minimal maintenance. Vinyl lasts 25-40 years. Engineered wood lasts 20-30 years. Natural wood lasts 20-40 years but requires repainting every 5-7 years.` },
    { q: () => `Is vinyl or fiber cement siding better?`, a: () => `Fiber cement resists fire, impact, and insects better than vinyl, and holds paint longer. Vinyl costs 30-40% less, never needs painting, and handles moisture well. Choose based on budget and climate.` },
    { q: () => `Can new siding go over old siding?`, a: () => `Overlaying is possible but not recommended. It hides potential water damage, adds weight, and can void warranties. Tear-off adds $1,000-$3,000 but lets you inspect and repair sheathing and moisture barriers.` },
    { q: (c) => `Do I need a permit for siding replacement in ${c}?`, a: (c) => `Most ${c} jurisdictions require a permit if you are changing siding material or adding insulation. Like-for-like replacement without structural changes may be exempt. Check with your local building department.` },
    { q: () => `How long does siding installation take?`, a: () => `A full siding replacement on an average home takes 5-10 days. Larger homes or complex designs with multiple gables, dormers, and trim details can take 2-3 weeks.` },
    { q: () => `Does new siding increase home value?`, a: () => `New siding recovers 70-80% of its cost at resale. Fiber cement siding recoups more than vinyl. Beyond ROI, it eliminates a major curb appeal concern and passes inspection without issues.` },
    { q: () => `What is the most energy-efficient siding?`, a: () => `Insulated vinyl siding (with foam backing) adds R-2 to R-5 insulation. Fiber cement over rigid foam sheathing provides better thermal performance. The biggest energy gains come from fixing air leaks during installation.` },
    { q: () => `How do I know my siding needs replacing?`, a: () => `Replace when you see warping, buckling, cracks, or holes; soft spots indicating rot; bubbling paint that keeps returning; high energy bills from poor insulation; or mold and mildew that will not clean away.` },
    { q: () => `What is the cheapest siding option?`, a: () => `Vinyl is the most affordable at $4-$8/sqft installed. Aluminum is similar at $4-$9/sqft. Both are low-maintenance, but vinyl has largely replaced aluminum due to better impact resistance and color retention.` },
    { q: () => `Should I paint or replace my siding?`, a: () => `Paint if siding is structurally sound with no rot or warping. Painting costs $3,000-$7,000 and lasts 5-10 years. If paint peels repeatedly or siding has damage, replacement is the better long-term investment.` },
    { q: () => `What is board-and-batten siding?`, a: () => `Board-and-batten uses wide vertical boards with narrow strips (battens) covering the seams. It is popular in farmhouse and modern styles. Costs $8-$16/sqft installed in fiber cement or engineered wood.` },
    { q: () => `How do I maintain fiber cement siding?`, a: () => `Repaint every 12-15 years, caulk joints and seams every 5-7 years, keep vegetation trimmed 6 inches from the wall, and wash annually with a garden hose. Avoid power washing at high pressure.` },
    { q: () => `Can siding be repaired instead of fully replaced?`, a: () => `Individual damaged sections can be replaced if matching material is available. If damage covers more than 20-30% of the wall area, full replacement is more cost-effective and looks better.` },
    { q: () => `What goes under siding?`, a: () => `From inside out: wall sheathing (plywood or OSB), a weather-resistant barrier (house wrap like Tyvek), then siding. Some installations add rigid foam insulation between the house wrap and siding.` },
  ],
  "painting": [
    { q: (c) => `How much does exterior painting cost in ${c}?`, a: (c) => `Exterior painting in ${c} costs $3,000-$8,000 for an average home. Price depends on home size, siding material, number of stories, prep work required, and paint quality.` },
    { q: () => `How often should a house be painted?`, a: () => `Wood siding needs repainting every 5-7 years. Stucco and fiber cement last 8-12 years between coats. Vinyl and aluminum siding rarely need painting. Climate, sun exposure, and paint quality affect timing.` },
    { q: () => `How much does interior painting cost per room?`, a: () => `A typical room costs $300-$700 for walls and ceiling. A full interior (5-7 rooms) runs $2,500-$6,000. Trim, doors, and closets add $100-$300 per room.` },
    { q: () => `Should I hire a painter or do it myself?`, a: () => `DIY saves 60-70% on cost but takes 3-5x longer and usually looks less polished. Hire a pro for exteriors, high ceilings, detailed trim work, or any spray application. DIY works fine for single interior rooms.` },
    { q: () => `How much does paint prep work cost?`, a: () => `Prep is 50-70% of the total job cost. Scraping, sanding, caulking, priming, and repairs can cost $1,500-$4,000 on an exterior. Skipping prep leads to peeling paint within 1-2 years.` },
    { q: (c) => `Do I need a permit to paint my house in ${c}?`, a: (c) => `Painting typically does not require a permit in ${c}. The exception is homes in historic districts where exterior color changes may need approval from a review board.` },
    { q: () => `What is the difference between latex and oil-based paint?`, a: () => `Latex (water-based) dries faster, cleans up with water, has low odor, and is more flexible. Oil-based paint has better adhesion on bare wood and metal, and creates a harder finish. Most residential work uses latex.` },
    { q: () => `How long does exterior paint last?`, a: () => `Quality acrylic latex lasts 7-10 years on properly prepped surfaces. Budget paint lasts 3-5 years. South-facing walls fade faster. Two coats over primer significantly outlast a single coat.` },
    { q: () => `What should I look for in a painting quote?`, a: () => `A professional quote specifies: paint brand and sheen, number of coats, prep work included, surface repairs, primer usage, timeline, warranty, and what is excluded (trim, doors, ceilings).` },
    { q: () => `Is spray painting better than brush and roller?`, a: () => `Spraying is faster and gives a smoother finish on large, flat surfaces. Brush and roller are better for detail work and touchups. Many pros spray first, then back-roll for adhesion.` },
    { q: () => `How much does it cost to paint kitchen cabinets?`, a: () => `Professional cabinet painting costs $3,000-$7,000 for an average kitchen. The process includes removing doors, degreasing, sanding, priming, spraying 2-3 coats, and reinstalling hardware.` },
    { q: () => `Do I need to prime before painting?`, a: () => `Prime over bare wood, drywall patches, stains, dark colors being covered with light ones, and previously unpainted surfaces. Paint-and-primer combos work for simple color changes on already-painted walls.` },
    { q: () => `What paint sheen should I use?`, a: () => `Flat/matte hides imperfections (ceilings, low-traffic walls). Eggshell and satin work for most walls. Semi-gloss is ideal for trim, doors, and kitchens/baths. High-gloss is for accent trim and furniture.` },
    { q: () => `How many coats of paint do I need?`, a: () => `Two coats over primer is standard. Going from dark to light or light to dark may need a tinted primer plus two topcoats. Quality paint with good coverage sometimes looks fine in one coat but two is always more durable.` },
    { q: () => `When is the best time of year to paint exteriors?`, a: () => `Paint when temperatures stay between 50-85F with low humidity and no rain in the forecast for 24-48 hours. Late spring and early fall are ideal in most climates. Avoid direct hot sun on surfaces.` },
  ],
  "garage-door": [
    { q: (c) => `How much does a garage door replacement cost in ${c}?`, a: (c) => `A new garage door in ${c} costs $800-$4,000 for a standard door installed, or $2,500-$8,000+ for a premium insulated or carriage-style door with a new opener.` },
    { q: () => `How long does a garage door last?`, a: () => `Steel garage doors last 20-30 years. Wood doors last 15-20 years with maintenance. Aluminum lasts 20+ years. Springs last 7-12 years (torsion) or 5-7 years (extension), depending on usage cycles.` },
    { q: () => `Should I repair or replace my garage door?`, a: () => `Repair if damage is limited to one or two panels and replacements are available. Replace if the door is over 15 years old, panels are no longer manufactured, or you want better insulation and security.` },
    { q: () => `How much does a garage door opener cost?`, a: () => `A new opener installed costs $250-$600 for chain or belt drive. Smart openers with Wi-Fi and battery backup run $400-$800 installed. Replacing the opener alone takes 2-3 hours.` },
    { q: () => `What is the best type of garage door?`, a: () => `Insulated steel with polyurethane foam offers the best balance of durability, energy efficiency, and cost. R-value of 12-18 keeps the garage 10-20 degrees closer to house temperature.` },
    { q: (c) => `Do I need a permit for a garage door in ${c}?`, a: (c) => `Garage door replacement in ${c} typically does not require a permit if you are not changing the opening size. If you widen or add a new opening, a structural permit is required.` },
    { q: () => `How much does garage door spring replacement cost?`, a: () => `Torsion spring replacement costs $200-$400 for parts and labor. Extension springs cost $150-$300. Never attempt spring replacement yourself since the stored tension is extremely dangerous.` },
    { q: () => `What R-value should my garage door have?`, a: () => `R-8 is fine if the garage is detached or unheated. R-12 to R-16 is best for attached garages or if you use the space for a workshop. R-18+ is for extreme cold climates or heated garages.` },
    { q: () => `How long does garage door installation take?`, a: () => `A standard single or double door replacement takes 3-5 hours. Custom doors or jobs requiring structural framing changes take 1-2 days. Most installations are completed in a single visit.` },
    { q: () => `Does a new garage door increase home value?`, a: () => `A garage door replacement recovers 90-100% of its cost at resale, making it one of the highest-ROI home improvements. It also dramatically improves curb appeal.` },
    { q: () => `What is the difference between chain and belt drive openers?`, a: () => `Chain drive is cheaper ($150-$250) but louder. Belt drive ($200-$350) is whisper-quiet and ideal when bedrooms are above or adjacent to the garage. Both have similar reliability.` },
    { q: () => `Can I insulate my existing garage door?`, a: () => `Yes. Retrofit insulation kits ($100-$200 DIY) add R-4 to R-8. However, adding weight to a non-insulated door may require spring adjustment. A new insulated door is often a better investment.` },
    { q: () => `What causes a garage door to be noisy?`, a: () => `Common causes: worn rollers (replace nylon for steel), dry hinges (lubricate with silicone spray), loose hardware, a chain-drive opener, or worn spring coils. A tune-up costs $100-$200.` },
    { q: () => `How wide is a standard garage door?`, a: () => `A single-car door is 8-9 feet wide. A double-car door is 16 feet wide. Heights are typically 7-8 feet. Custom sizes are available but cost 20-40% more than standard dimensions.` },
    { q: () => `Are smart garage door openers worth it?`, a: () => `Smart openers add $100-$200 over basic models. They let you open, close, and monitor the door from your phone, set schedules, and receive alerts. Useful for deliveries and forgetting to close.` },
  ],
  "fence": [
    { q: (c) => `How much does a new fence cost in ${c}?`, a: (c) => `Fence costs in ${c} range from $15-$35 per linear foot for wood, $20-$40 for vinyl, $15-$30 for chain link, and $25-$55 for aluminum or wrought iron, including materials and installation.` },
    { q: () => `What is the cheapest fence material?`, a: () => `Chain link is the cheapest at $10-$20 per linear foot installed. Pressure-treated pine is the cheapest wood option at $15-$25/ft. Vinyl and composite start at $20-$30/ft but never need painting.` },
    { q: () => `How long does a wood fence last?`, a: () => `Pressure-treated pine lasts 15-20 years. Cedar lasts 15-25 years. Redwood lasts 20-30 years. All wood fences last longer with stain or sealant applied every 2-3 years.` },
    { q: (c) => `Do I need a permit to build a fence in ${c}?`, a: (c) => `Most ${c} jurisdictions require a permit for fences over 6 feet tall. Many require permits for any fence. You also need to check setback requirements, HOA rules, and call 811 for utility locates before digging.` },
    { q: () => `Who owns the fence between two properties?`, a: () => `Typically the homeowner who installed it. If the fence sits exactly on the property line, both neighbors share responsibility. Always get a survey before building to confirm the boundary.` },
    { q: () => `How much does vinyl fencing cost?`, a: () => `Vinyl privacy fencing costs $20-$40 per linear foot installed. A typical 150 linear foot backyard fence runs $3,000-$6,000. Vinyl never needs painting, resists rot, and lasts 25-30 years.` },
    { q: () => `How long does fence installation take?`, a: () => `A standard 150-200 linear foot residential fence takes 1-3 days to install. Hillside or rocky soil adds time. Post holes need 24-48 hours to cure if set in concrete.` },
    { q: () => `Should fence posts be set in concrete?`, a: () => `Yes, for most fences. Concrete-set posts are more stable and resist leaning. Some installers use compacted gravel for better drainage in wet climates, which can extend post life by reducing ground-level rot.` },
    { q: () => `What is the best fence for privacy?`, a: () => `A 6-foot solid board (dog-ear, board-on-board, or shadowbox) fence provides the most privacy. Board-on-board is best since it has no gaps even when boards shrink. Vinyl and composite also offer full privacy panels.` },
    { q: () => `How tall can I build my fence?`, a: () => `Most municipalities allow 6 feet in backyards and 3-4 feet in front yards without a variance. Some HOAs restrict fence height further. Always check local zoning before building.` },
    { q: () => `Does a fence increase property value?`, a: () => `A well-built fence adds 1-5% to property value depending on material and neighborhood norms. Privacy fencing adds more value in neighborhoods where it is expected. Chain link adds minimal value.` },
    { q: () => `What is the difference between dog-ear and flat-top fence?`, a: () => `Dog-ear pickets have angled cuts at the top for water runoff and a traditional look. Flat-top pickets have a clean, modern appearance but hold slightly more water, which can accelerate rot.` },
    { q: () => `Can I install a fence on a slope?`, a: () => `Yes, using either stepped (stair-step) or racked (following the slope) installation. Racked looks smoother on gentle slopes. Stepped is better for steep grades and is structurally stronger.` },
    { q: () => `How deep should fence posts be?`, a: () => `Standard rule: bury one-third of the total post length. For a 6-foot fence with 8-foot posts, dig 24-30 inches deep. In frost-prone areas, posts must go below the frost line to prevent heaving.` },
    { q: () => `When is the best time to install a fence?`, a: () => `Late spring through early fall offers the best conditions for concrete curing and working in the ground. Avoid frozen ground and extremely wet seasons. Many contractors offer off-season discounts.` },
  ],
  "concrete": [
    { q: (c) => `How much does concrete work cost in ${c}?`, a: (c) => `Concrete costs in ${c} range from $6-$12 per square foot for basic flatwork (driveways, patios) to $15-$30/sqft for stamped or decorative finishes, including labor and materials.` },
    { q: () => `How much does a concrete driveway cost?`, a: () => `A standard 600 sqft concrete driveway costs $3,600-$7,200 for plain finished concrete. Stamped or colored concrete adds $3-$10/sqft. Removing the old driveway adds $1,000-$2,000.` },
    { q: () => `How long does concrete last?`, a: () => `Properly poured and maintained concrete lasts 30-50 years. Driveways see 25-30 years with normal use. Sealing every 2-3 years and controlling drainage significantly extend the lifespan.` },
    { q: () => `What causes concrete to crack?`, a: () => `Common causes: shrinkage during curing, frost heave from inadequate base prep, tree roots, heavy vehicle loads beyond design, poor control joint placement, and water pooling due to improper grading.` },
    { q: (c) => `Do I need a permit for concrete work in ${c}?`, a: (c) => `In ${c}, permits are typically required for driveways, sidewalks, and any concrete work near property lines or public right-of-way. Backyard patios may be exempt depending on size. Check local requirements.` },
    { q: () => `How thick should a concrete driveway be?`, a: () => `Residential driveways should be 4 inches thick for cars and 5-6 inches for heavy vehicles like RVs. A 6-inch compacted gravel base underneath is essential. Thickened edges (6 inches) prevent cracking at the perimeter.` },
    { q: () => `How long before I can drive on new concrete?`, a: () => `Wait 24-48 hours for foot traffic, 7 days for vehicle traffic, and 30 days for full cure. Avoid deicing salt for the first winter. New concrete reaches 90% strength in 7 days and full strength in 28 days.` },
    { q: () => `What is the difference between concrete and cement?`, a: () => `Cement is an ingredient in concrete. Concrete is a mix of cement (10-15%), water (15-20%), and aggregates (sand and gravel, 60-75%). Concrete is the finished building material; cement is the binding powder.` },
    { q: () => `Should I seal my concrete?`, a: () => `Yes. Sealing prevents water penetration, staining, freeze-thaw damage, and salt damage. Apply a penetrating sealer every 2-3 years. It costs $0.50-$2.00 per square foot for professional application.` },
    { q: () => `How much does a concrete patio cost?`, a: () => `A 300 sqft concrete patio costs $1,800-$3,600 for basic broom finish. Stamped patterns add $3-$8/sqft. Colored concrete adds $1-$3/sqft. An exposed aggregate finish adds $2-$4/sqft.` },
    { q: () => `Can cracked concrete be repaired?`, a: () => `Hairline cracks can be sealed with flexible caulk or epoxy for $1-$5 per linear foot. Wider cracks may need patching compound. If the slab has heaved or settled significantly, mudjacking ($5-$10/sqft) or replacement is needed.` },
    { q: () => `What is stamped concrete?`, a: () => `Stamped concrete uses patterned mats pressed into wet concrete to mimic brick, stone, slate, or wood. It costs $12-$25/sqft installed. It requires resealing every 2-3 years to maintain appearance and prevent wear.` },
    { q: () => `Is concrete or asphalt better for a driveway?`, a: () => `Concrete lasts 30+ years vs. 15-20 for asphalt. Concrete costs more upfront ($6-$12/sqft vs. $3-$6/sqft) but needs less maintenance. Asphalt needs resealing every 3-5 years and is softer in extreme heat.` },
    { q: () => `What is the best time to pour concrete?`, a: () => `Pour when temperatures stay between 50-80F for at least 3 days. Spring and fall are ideal. Avoid pouring in rain, direct hot sun, or below freezing. Cold and heat both compromise cure quality.` },
    { q: () => `How much does a concrete foundation cost?`, a: () => `A full basement foundation costs $15,000-$30,000. A slab foundation for a house costs $5,000-$15,000. A garage slab costs $2,500-$6,000. Price depends on size, depth, and soil conditions.` },
  ],
  "landscaping": [
    { q: (c) => `How much does landscaping cost in ${c}?`, a: (c) => `Basic landscaping in ${c} costs $3,000-$8,000 for design and installation. Full yard transformations with hardscaping, irrigation, and mature plantings run $15,000-$50,000+.` },
    { q: () => `How much does lawn installation cost?`, a: () => `Sod costs $1-$2 per square foot installed. Hydroseeding costs $0.05-$0.10/sqft. Traditional seeding costs $0.10-$0.25/sqft but takes 6-8 weeks to establish. A 5,000 sqft lawn costs $5,000-$10,000 in sod.` },
    { q: () => `How much does a sprinkler system cost?`, a: () => `A residential irrigation system costs $2,500-$5,000 for a quarter-acre lot. Smart controllers add $100-$300 and reduce water usage 20-40%. Drip irrigation zones for beds cost $500-$1,000 extra.` },
    { q: () => `What is the cheapest way to landscape a yard?`, a: () => `Seed instead of sod, use native plants from local nurseries, mulch with free municipal compost, and phase the project over 2-3 seasons. A basic DIY front yard makeover can be done for $500-$1,500.` },
    { q: (c) => `Do I need a permit for landscaping in ${c}?`, a: (c) => `Most landscaping in ${c} does not require permits. Exceptions include retaining walls over 4 feet, grading that changes drainage, connecting to city water for irrigation, and work near property lines.` },
    { q: () => `How much does a retaining wall cost?`, a: () => `Retaining walls cost $20-$50 per square face foot for concrete block, $25-$60 for natural stone, and $15-$30 for timber. A 50 linear foot wall at 3 feet tall runs $3,000-$9,000 installed.` },
    { q: () => `How much does tree removal cost?`, a: () => `Small trees (under 30 feet) cost $200-$500 to remove. Medium trees (30-60 feet) cost $500-$1,000. Large trees (60-100 feet) cost $1,000-$2,000+. Stump grinding adds $100-$400 per stump.` },
    { q: () => `What are the best low-maintenance landscaping plants?`, a: () => `Native perennials, ornamental grasses, and drought-tolerant shrubs need the least care. Avoid high-maintenance options like hybrid tea roses, non-native annuals, and fast-growing trees that require frequent pruning.` },
    { q: () => `How much does a paver patio cost?`, a: () => `Paver patios cost $12-$25 per square foot installed, depending on paver material and pattern complexity. A 300 sqft patio runs $3,600-$7,500. Permeable pavers cost 15-20% more but help with drainage.` },
    { q: () => `Should I hire a landscaper or landscape architect?`, a: () => `A landscaper handles installation and maintenance. A landscape architect designs complex projects and manages grading, drainage, and permits. For projects over $15,000 or involving structural elements, an architect is worthwhile.` },
    { q: () => `How much does mulch cost?`, a: () => `Bulk mulch costs $25-$50 per cubic yard delivered. Plan 3 inches deep and 1 yard covers 108 sqft. A 1,000 sqft bed needs about 10 yards ($250-$500). Professional installation adds $30-$50/yard.` },
    { q: () => `How often should I replace mulch?`, a: () => `Replenish organic mulch annually (top off to 3 inches). Full replacement every 2-3 years prevents matting and fungal buildup. Rock and rubber mulch last 5-10 years but do not improve soil.` },
    { q: () => `What is xeriscaping?`, a: () => `Xeriscaping uses drought-tolerant plants, efficient irrigation, and permeable surfaces to minimize water use. It cuts outdoor water consumption 50-75% and is increasingly required in water-restricted regions.` },
    { q: () => `How much does outdoor lighting cost?`, a: () => `Professional landscape lighting costs $2,000-$5,000 for path lights, uplights, and accent lighting. LED fixtures cost more upfront but last 50,000+ hours. Solar options cost less but provide dimmer, less reliable light.` },
    { q: () => `Does landscaping increase home value?`, a: () => `Well-designed landscaping adds 5-15% to home value. Mature trees alone add $1,000-$10,000 each. Curb appeal landscaping recovers 100-200% of investment at resale, one of the highest ROI improvements.` },
  ],
  "foundation": [
    { q: (c) => `How much does foundation repair cost in ${c}?`, a: (c) => `Foundation repair in ${c} typically costs $2,000-$7,000 for minor crack sealing, $5,000-$15,000 for pier installation, and $15,000-$30,000+ for major structural repair or underpinning.` },
    { q: () => `What are the signs of foundation problems?`, a: () => `Warning signs include diagonal cracks above door frames, sticking doors and windows, uneven or sloping floors, gaps between walls and ceiling, and cracks wider than 1/4 inch in the foundation wall.` },
    { q: () => `How long does foundation repair last?`, a: () => `Steel push piers and helical piers are permanent solutions that last the life of the structure. Carbon fiber reinforcement lasts 25+ years. Epoxy crack injection lasts 5-10 years if the underlying cause is addressed.` },
    { q: () => `Does foundation repair really work?`, a: () => `Yes, when the correct method matches the problem. Piers stop settlement permanently. Drainage corrections prevent water damage from recurring. The key is accurate diagnosis before choosing a repair method.` },
    { q: (c) => `Do I need a permit for foundation repair in ${c}?`, a: (c) => `Most ${c} jurisdictions require permits for structural foundation work like pier installation, underpinning, and wall reinforcement. Minor crack sealing typically does not need a permit.` },
    { q: () => `What causes foundation problems?`, a: () => `The most common cause is soil movement from moisture changes. Expansive clay swells when wet and shrinks when dry, creating cyclical pressure. Poor drainage, plumbing leaks, tree roots, and inadequate compaction during construction also contribute.` },
    { q: () => `Should I buy a house with foundation issues?`, a: () => `It depends on severity and cost. Minor cracks are normal settling. Structural issues that need pier work ($10K-$30K+) should be factored into your offer. Always get an independent structural engineer's assessment, not just a repair company's quote.` },
    { q: () => `What is the difference between push piers and helical piers?`, a: () => `Push piers are driven to bedrock or stable soil using the structure's weight. Helical piers are screwed in mechanically. Push piers work best for heavy structures. Helical piers work in lighter structures and new construction.` },
    { q: () => `How long does foundation repair take?`, a: () => `Most pier installations take 1-3 days. Interior waterproofing takes 2-5 days. Major structural repair can take 1-2 weeks. Minimal disruption to daily life during exterior pier work; interior work is more invasive.` },
    { q: () => `Does homeowners insurance cover foundation repair?`, a: () => `Standard policies do not cover foundation repair from settling, soil movement, or normal wear. Coverage may apply if damage results from a covered event like a plumbing leak or sudden ground collapse. Review your policy carefully.` },
    { q: () => `What is mudjacking?`, a: () => `Mudjacking pumps a cement slurry under a settled slab to raise it back to level. It costs $500-$1,500 per section and works for driveways, sidewalks, and garage floors. Polyurethane foam injection (polyjacking) is a lighter, longer-lasting alternative.` },
    { q: () => `Can I fix foundation cracks myself?`, a: () => `Hairline cracks under 1/8 inch can be sealed with hydraulic cement or epoxy kits ($20-$50 DIY). Any crack wider than 1/4 inch, growing over time, or accompanied by wall movement needs professional structural assessment.` },
    { q: () => `How do I prevent foundation problems?`, a: () => `Maintain consistent soil moisture around the foundation, ensure gutters and downspouts direct water 6+ feet away, slope grading away from the house, fix plumbing leaks promptly, and keep trees at least their mature height's distance from the foundation.` },
    { q: () => `What is a foundation inspection?`, a: () => `A structural engineer inspects visible cracks, measures floor levelness, checks doors and windows for alignment, assesses exterior grading and drainage, and looks for signs of water intrusion. Cost: $300-$700 for an independent engineer's report.` },
    { q: () => `Is carbon fiber foundation repair effective?`, a: () => `Carbon fiber straps are excellent for stabilizing bowing basement walls. They are 10x stronger than steel, do not corrode, require no excavation, and install in a single day. They stabilize but do not straighten already-bowed walls.` },
  ],
  "insulation": [
    { q: (c) => `How much does insulation cost in ${c}?`, a: (c) => `Insulation costs in ${c} range from $1-$2/sqft for blown-in attic insulation, $1.50-$3.50/sqft for batt insulation in walls, and $2-$4/sqft for spray foam. A full attic (1,000 sqft) runs $1,000-$2,500.` },
    { q: () => `What R-value do I need in my attic?`, a: () => `DOE recommendations: R-38 to R-60 in cold climates (zones 4-8) and R-30 to R-38 in warm climates (zones 1-3). Most existing homes have R-19 or less. Adding insulation to code reduces heating/cooling costs 15-25%.` },
    { q: () => `What is the best type of insulation?`, a: () => `Spray foam has the highest R-value per inch (R-6 to R-7 for closed-cell) and creates an air seal. Blown-in cellulose is the best value for attics. Fiberglass batts are cheapest for open walls during new construction.` },
    { q: () => `How long does insulation last?`, a: () => `Fiberglass batts last 80-100 years if they stay dry and undisturbed. Cellulose lasts 20-30 years before settling reduces effectiveness. Spray foam lasts the life of the structure. All insulation loses value if it gets wet.` },
    { q: (c) => `Do I need a permit for insulation in ${c}?`, a: (c) => `Most ${c} jurisdictions do not require permits for adding insulation to existing spaces. Permits may be needed if the work involves removing drywall or altering vapor barriers. Check local codes.` },
    { q: () => `Should I insulate my walls or attic first?`, a: () => `Attic insulation provides the best return since heat rises. Most homes lose 25-30% of heat through the attic. Wall insulation is second priority and harder to retrofit. Floor insulation over crawl spaces is third.` },
    { q: () => `What is the difference between open-cell and closed-cell spray foam?`, a: () => `Open-cell (R-3.7/inch) is cheaper, flexible, and better for interior walls. Closed-cell (R-6.5/inch) is rigid, waterproof, adds structural strength, and is required in flood zones and below-grade applications.` },
    { q: () => `Can I add insulation over existing insulation?`, a: () => `Yes, in most cases. Adding blown-in cellulose or unfaced fiberglass over existing attic insulation is common and effective. Never compress existing insulation and do not add a vapor barrier on top of existing insulation.` },
    { q: () => `How do I know if my home needs more insulation?`, a: () => `Check attic insulation depth (less than 10 inches of fiberglass means you are under R-30), feel for cold spots on walls in winter, notice ice dams on the roof, or get an energy audit with thermal imaging ($200-$400).` },
    { q: () => `Does insulation reduce noise?`, a: () => `Yes. Dense insulation (cellulose, mineral wool, spray foam) reduces sound transmission 50-80%. Mineral wool batts are the best for sound deadening between interior rooms. Standard fiberglass batts provide moderate noise reduction.` },
    { q: () => `How much does spray foam insulation cost?`, a: () => `Open-cell spray foam costs $1-$2 per board foot installed. Closed-cell costs $2-$4 per board foot. A 1,000 sqft attic with 6 inches of closed-cell runs $6,000-$12,000. It is the most expensive but most effective option.` },
    { q: () => `What is a vapor barrier and do I need one?`, a: () => `A vapor barrier prevents moisture from passing through walls and ceilings. In cold climates, install on the warm (interior) side. In hot-humid climates, install on the exterior side. Closed-cell spray foam acts as its own vapor barrier.` },
    { q: () => `Is blown-in insulation better than batts?`, a: () => `Blown-in fills gaps and voids that batts leave around wiring, pipes, and framing. It performs 15-25% better than batts in real-world conditions. Batts are easier to install in open walls during new construction.` },
    { q: () => `How much energy does insulation save?`, a: () => `Insulating an under-insulated attic to current code saves 15-25% on heating and cooling costs. In a home spending $2,000/year on energy, that is $300-$500 annual savings, paying back a $1,500-$2,500 project in 3-5 years.` },
    { q: () => `Should I remove old insulation before adding new?`, a: () => `Remove if the existing insulation is wet, moldy, pest-contaminated, or vermiculite (potential asbestos). Otherwise, add new insulation on top. Removal costs $1-$2/sqft and is usually unnecessary.` },
  ],
  "gutter": [
    { q: (c) => `How much do new gutters cost in ${c}?`, a: (c) => `Gutters in ${c} cost $6-$15 per linear foot for aluminum seamless, $8-$20 for steel, and $15-$30 for copper. A typical home (150-200 linear feet) runs $1,200-$3,000 for aluminum.` },
    { q: () => `How long do gutters last?`, a: () => `Aluminum gutters last 20-30 years. Steel lasts 15-20 years. Copper lasts 50+ years. Vinyl lasts 10-15 years. Seamless gutters outlast sectional because they have fewer leak-prone joints.` },
    { q: () => `Are seamless gutters worth the extra cost?`, a: () => `Yes. Seamless gutters cost 20-30% more than sectional but eliminate most leak points. They are custom-formed on-site to fit your home exactly, look cleaner, and require less maintenance over their lifespan.` },
    { q: () => `How often should gutters be cleaned?`, a: () => `Clean gutters at least twice a year (spring and fall). Homes near trees may need quarterly cleaning. Clogged gutters cause foundation damage, fascia rot, ice dams, and basement flooding.` },
    { q: (c) => `Do I need a permit for gutter installation in ${c}?`, a: (c) => `Gutter installation in ${c} typically does not require a permit since it is considered routine maintenance. Permits may be needed if the work involves changes to the roof structure or drainage to the public storm system.` },
    { q: () => `What size gutters do I need?`, a: () => `Standard 5-inch K-style gutters handle most residential roofs. Homes in heavy rainfall areas or with steep, large roofs should use 6-inch gutters with 3x4 inch downspouts for 40% more water capacity.` },
    { q: () => `Are gutter guards worth it?`, a: () => `Gutter guards reduce cleaning frequency by 80-90% but do not eliminate it entirely. Quality guards cost $7-$15 per linear foot installed. They pay back in 5-8 years through reduced cleaning costs and prevented water damage.` },
    { q: () => `What causes gutters to pull away from the house?`, a: () => `Common causes: rotted fascia board behind the gutter, failed or spaced-too-far-apart hangers, ice and snow weight, clogged gutters holding heavy water, and improper original installation.` },
    { q: () => `Should I repair or replace my gutters?`, a: () => `Repair if damage is limited to a few sections, joints, or downspouts. Replace if gutters sag along most of their length, have multiple leaks, are rusting through, or the fascia behind them is rotting.` },
    { q: () => `How do I know if my gutters are failing?`, a: () => `Signs include: water spilling over during rain, visible sagging or pulling away from the fascia, rust spots or holes, peeling paint on fascia or soffits, and erosion or pooling at the foundation.` },
    { q: () => `What is the best gutter material?`, a: () => `Aluminum is the best overall value: lightweight, rust-proof, paintable, and affordable. Copper is premium and maintenance-free but costs 3-5x more. Steel is strongest but rusts in humid climates. Avoid vinyl in cold regions.` },
    { q: () => `How far should downspouts extend from the house?`, a: () => `Downspouts should discharge water at least 4-6 feet from the foundation. Underground drain extensions to the street or a dry well are ideal. Splash blocks alone are not sufficient for proper drainage.` },
    { q: () => `Can I install gutters myself?`, a: () => `Sectional gutters are a feasible DIY project if you are comfortable on a ladder. Seamless gutters require a professional forming machine. Improper slope (should be 1/4 inch per 10 feet toward downspouts) causes pooling and overflow.` },
    { q: () => `How many downspouts do I need?`, a: () => `One downspout per 20-30 linear feet of gutter or per 600 square feet of roof area, whichever results in more. Undersized drainage is the number-one cause of gutter overflow and foundation damage.` },
    { q: () => `Do gutters protect the foundation?`, a: () => `Yes. Gutters prevent concentrated roof runoff from eroding soil next to the foundation and saturating the ground. Homes without gutters have 3-5x more foundation moisture problems than homes with properly functioning gutter systems.` },
  ],
  "auto-repair": [
    { q: (c) => `How much does auto repair cost on average in ${c}?`, a: (c) => `Common repairs in ${c} range from $150-$400 for brake pads, $500-$1,200 for a timing belt, $1,000-$3,000 for transmission work, and $2,000-$5,000 for engine overhauls. Labor rates vary by shop type.` },
    { q: () => `How do I know if a mechanic is overcharging me?`, a: () => `Get 3 written estimates for the same repair. Compare labor hours (not just total price) to standard repair time databases. Ask for the old parts back. A reputable shop explains every line item.` },
    { q: () => `Should I go to a dealer or independent mechanic?`, a: () => `Independent shops charge 30-50% less for labor. Dealers use OEM parts and have model-specific training. Use the dealer for warranty work and recalls. Use a trusted independent for everything else.` },
    { q: () => `How much does a brake job cost?`, a: () => `Front brake pad replacement costs $150-$300 per axle. Rotors add $200-$400 per axle if they need replacing. A full 4-wheel brake job with rotors runs $500-$1,000 at an independent shop.` },
    { q: () => `Is it worth fixing a car with 150,000 miles?`, a: () => `Compare the repair cost to 6 months of car payments on a replacement. If the repair is less and the car is otherwise sound, fix it. Major engine or transmission work on a low-value car usually is not worth it.` },
    { q: () => `What does a check engine light mean?`, a: () => `The light means the onboard computer detected an emissions or engine issue. It can range from a loose gas cap to a failing catalytic converter. A diagnostic scan ($50-$100) reads the specific code and identifies the problem.` },
    { q: (c) => `How do I find a trustworthy mechanic in ${c}?`, a: (c) => `Look for ASE-certified technicians, ask for references from ${c} neighbors, check online reviews for patterns (not just star ratings), and start with a small job to evaluate quality and honesty before committing to major work.` },
    { q: () => `How much does an oil change cost?`, a: () => `Conventional oil changes cost $30-$50. Synthetic oil changes cost $65-$100. Most modern cars require synthetic. Extended-life synthetics allow 7,500-10,000 mile intervals, offsetting the higher per-change cost.` },
    { q: () => `What maintenance should I never skip?`, a: () => `Never skip oil changes, coolant flushes (every 30K miles), brake inspections (annually), timing belt replacement (60K-100K miles), and transmission fluid changes (every 30K-60K miles). These prevent catastrophic failures.` },
    { q: () => `How much does a transmission rebuild cost?`, a: () => `Transmission rebuilds cost $2,000-$4,000 for most vehicles. A full replacement with a remanufactured unit costs $2,500-$5,000. A used transmission costs $1,000-$2,500 installed but carries more risk.` },
    { q: () => `Should I use OEM or aftermarket parts?`, a: () => `OEM parts are identical to original and carry manufacturer warranty. Quality aftermarket parts are 20-50% cheaper and work fine for most repairs. Avoid no-name parts for safety items (brakes, suspension, steering).` },
    { q: () => `How often do I need a wheel alignment?`, a: () => `Check alignment annually or when you notice uneven tire wear, pulling to one side, or after hitting a major pothole. Alignments cost $75-$150 and extend tire life by thousands of miles.` },
    { q: () => `What is included in a major service interval?`, a: () => `Major services (every 30K, 60K, 90K miles) typically include oil change, all fluid checks/flushes, brake inspection, tire rotation, filter replacements (air, cabin, fuel), spark plugs (at 60K-100K), and belt/hose inspection.` },
    { q: () => `How much does AC repair cost on a car?`, a: () => `A refrigerant recharge costs $150-$300. Compressor replacement costs $500-$1,200. Evaporator replacement costs $800-$1,500. Start with a leak test ($100-$150) before committing to component replacement.` },
    { q: () => `When should I replace my tires?`, a: () => `Replace when tread depth reaches 2/32 inch (the penny test), when tires are over 6-10 years old regardless of tread, or when you see uneven wear, bulges, or cracks. A set of 4 quality all-season tires costs $400-$800 installed.` },
  ],
  "medical": [
    { q: (c) => `How much does a doctor visit cost without insurance in ${c}?`, a: (c) => `An uninsured office visit in ${c} costs $100-$300 for primary care and $200-$500 for specialists. Urgent care visits run $150-$350. Always ask about cash-pay discounts, which are typically 30-60% off.` },
    { q: () => `Why do medical bills vary so much between providers?`, a: () => `Hospitals set their own chargemaster prices, negotiated rates differ by insurer, facility fees add $100-$500 to office visits, and the same procedure costs 2-5x more at a hospital outpatient center vs. an independent clinic.` },
    { q: () => `How do I negotiate a medical bill?`, a: () => `Request an itemized bill, compare charges to fair prices on healthcare cost databases, ask for the cash-pay rate, request a payment plan, and negotiate before the bill goes to collections. Most providers will reduce bills 20-50%.` },
    { q: () => `What is a facility fee on a medical bill?`, a: () => `A facility fee is an extra charge for receiving care at a hospital-owned clinic or outpatient center. It covers overhead and can add $100-$500+ to a visit on top of the physician's charge. Independent offices do not charge facility fees.` },
    { q: () => `How much does an ER visit cost?`, a: () => `Average ER visits cost $1,000-$3,000 for minor issues and $5,000-$20,000+ for serious conditions. If your issue is not life-threatening, urgent care centers provide similar care for $150-$500.` },
    { q: (c) => `How do I find affordable healthcare in ${c}?`, a: (c) => `Options in ${c} include community health centers (sliding-scale fees), urgent care for non-emergencies, telehealth visits ($50-$100), prescription discount cards, and hospital financial assistance programs.` },
    { q: () => `What is balance billing?`, a: () => `Balance billing happens when an out-of-network provider bills you for the difference between their charge and what insurance paid. The No Surprises Act now protects against this for emergency care and some non-emergency situations.` },
    { q: () => `How much does lab work cost?`, a: () => `Common blood panels cost $100-$500 at a hospital lab. The same tests at an independent lab cost $25-$100. Always check if your provider sends labs to an in-network facility. Direct-to-consumer lab services offer the lowest prices.` },
    { q: () => `Should I use urgent care or the emergency room?`, a: () => `Use urgent care for non-life-threatening issues: sprains, minor cuts, flu, infections, rashes. Use the ER for chest pain, severe bleeding, difficulty breathing, head injuries, and stroke symptoms. Urgent care saves $500-$2,000 per visit.` },
    { q: () => `How do I read an Explanation of Benefits?`, a: () => `An EOB shows: what the provider charged, the negotiated rate, what insurance paid, and what you owe. It is not a bill. Compare it to the actual bill from the provider to catch errors and double-billing.` },
    { q: () => `What is a surprise medical bill?`, a: () => `A surprise bill comes from an out-of-network provider you did not choose, often an anesthesiologist, radiologist, or assistant surgeon at an in-network facility. The No Surprises Act caps your cost at in-network rates for emergency care.` },
    { q: () => `How much does an MRI cost?`, a: () => `MRI costs range from $400-$1,500 at an independent imaging center to $2,000-$5,000+ at a hospital. Self-pay rates at independent centers are often cheaper than going through insurance with a high deductible.` },
    { q: () => `What is a good faith estimate?`, a: () => `Under federal law, uninsured patients can request a Good Faith Estimate before receiving care. The provider must list expected charges. If the final bill exceeds the estimate by $400+, you can dispute it.` },
    { q: () => `How do medical payment plans work?`, a: () => `Most providers offer 0% interest payment plans for 6-24 months. Ask before paying by credit card, which charges 15-25% interest. Some hospitals offer financial assistance that forgives bills entirely for low-income patients.` },
    { q: () => `Are generic medications as effective as brand name?`, a: () => `Yes. The FDA requires generics to have the same active ingredient, dosage, and effectiveness as brand-name drugs. They cost 80-85% less. Always ask your doctor or pharmacist if a generic alternative is available.` },
  ],
  "legal": [
    { q: (c) => `How much does a lawyer cost in ${c}?`, a: (c) => `Attorney fees in ${c} range from $150-$300/hour for general practice, $250-$500/hour for specialized areas (business, IP, tax), and $300-$700/hour for top litigation firms. Many offer free initial consultations.` },
    { q: () => `What is the difference between a retainer and hourly billing?`, a: () => `A retainer is an upfront deposit against future hourly work. You pay $2,000-$10,000 upfront; the lawyer bills against it. You are still charged hourly -- the retainer just ensures the lawyer's availability.` },
    { q: () => `When do I need a lawyer vs. handling it myself?`, a: () => `You need a lawyer for lawsuits, criminal charges, business formation, real estate closings (in some states), estate planning, and immigration matters. Self-help works for small claims court, simple wills, and minor disputes.` },
    { q: () => `How do contingency fees work?`, a: () => `The lawyer takes 25-40% of your settlement or award and you pay nothing upfront. If you lose, you owe no attorney fees (but may still owe court costs). Common in personal injury, employment discrimination, and some contract disputes.` },
    { q: (c) => `How do I find a good lawyer in ${c}?`, a: (c) => `Get referrals from ${c} bar association's referral service, ask professionals in related fields (accountants, real estate agents), check state bar discipline records, and interview 2-3 attorneys before committing.` },
    { q: () => `How much does it cost to form an LLC?`, a: () => `State filing fees range from $50-$500. A lawyer charges $500-$1,500 to set up an LLC with an operating agreement. Online services charge $100-$300 plus state fees but do not provide legal advice.` },
    { q: () => `What should I look for in an attorney?`, a: () => `Verify they are licensed and in good standing with the state bar. Check their experience with your specific issue. Ask about their communication style, billing practices, who will handle your case, and get a written fee agreement.` },
    { q: () => `How much does a will cost?`, a: () => `A simple will costs $300-$1,000 through an attorney. A will plus trust package runs $1,500-$3,000. Online services offer basic wills for $50-$200 but cannot advise on tax planning or complex family situations.` },
    { q: () => `What is the difference between a lawyer and a paralegal?`, a: () => `Lawyers are licensed to practice law, appear in court, and give legal advice. Paralegals assist lawyers with research, document preparation, and case management. They cannot give legal advice independently or represent you in court.` },
    { q: () => `How long does a lawsuit typically take?`, a: () => `Simple civil cases settle in 3-6 months. Complex litigation takes 1-3 years. Appeals add another 6-18 months. Over 95% of civil cases settle before trial. Mediation can resolve disputes in weeks.` },
    { q: () => `What are typical closing costs for a real estate attorney?`, a: () => `Real estate attorney fees range from $500-$1,500 for a standard residential closing. The attorney reviews the contract, title, and closing documents. In some states, an attorney is required by law for real estate closings.` },
    { q: () => `Should I accept a settlement offer?`, a: () => `Never accept without consulting your attorney. First offers are typically 30-50% below what the case is worth. Consider the strength of your case, the cost and timeline of going to trial, and the certainty of a guaranteed payment.` },
    { q: () => `What is the statute of limitations?`, a: () => `The statute of limitations sets a deadline for filing a lawsuit. It varies by claim type and state: personal injury (2-6 years), breach of contract (3-10 years), property damage (3-6 years). Once expired, you permanently lose the right to sue.` },
    { q: () => `How much does a divorce cost?`, a: () => `An uncontested divorce costs $1,500-$5,000 in attorney fees. A contested divorce costs $10,000-$50,000+. Mediated divorces cost $3,000-$8,000 total and resolve faster. Court filing fees add $200-$500 regardless of method.` },
    { q: () => `What is pro bono legal help?`, a: () => `Pro bono means free legal services. Legal aid societies serve low-income individuals. Law school clinics offer supervised free representation. Bar associations maintain pro bono referral lists. Income limits typically apply.` },
  ],
  "moving": [
    { q: (c) => `How much does a local move cost in ${c}?`, a: (c) => `Local moves in ${c} (under 50 miles) cost $800-$2,500 for a 2-3 bedroom home. Price depends on crew size, hours worked, and whether you need packing services. Most local movers charge $100-$200/hour for a 2-person crew.` },
    { q: () => `How much does a long-distance move cost?`, a: () => `Long-distance moves (1,000+ miles) cost $3,000-$8,000 for a 2-3 bedroom home. Price is based on weight (typically $0.50-$0.80/lb) and distance. A 3-bedroom home averages 7,000-10,000 lbs of goods.` },
    { q: () => `How far in advance should I book movers?`, a: () => `Book 4-6 weeks ahead for local moves and 8-12 weeks for long-distance. Summer (June-August) is peak season with 20-30% higher prices. End-of-month dates are busiest. Mid-month and mid-week moves are cheapest.` },
    { q: () => `What should I look for in a moving company?`, a: () => `Verify USDOT number (required for interstate moves), check FMCSA complaint history, get 3 in-home estimates (not phone quotes), confirm insurance coverage, read reviews for damage complaints, and avoid movers who demand large cash deposits.` },
    { q: () => `Should I hire movers or rent a truck?`, a: () => `DIY truck rental costs $200-$1,500 for local moves. Full-service movers cost $800-$2,500+. DIY saves 50-70% but you provide all labor and assume all liability. The sweet spot: hire movers for loading/unloading only ($200-$400).` },
    { q: (c) => `Do I need to tip movers in ${c}?`, a: (c) => `Tipping is customary but not required. Standard is $20-$50 per mover for a local move and $50-$100 per mover for long-distance. Tip based on difficulty, care with belongings, and overall service quality.` },
    { q: () => `What does moving insurance cover?`, a: () => `Basic coverage (included free) pays $0.60/lb per item. Full-value protection ($0.50-$1.50 per $100 of value) replaces or repairs items at current market value. Always declare high-value items and consider separate coverage for electronics.` },
    { q: () => `What items will movers not move?`, a: () => `Movers refuse hazardous materials (propane, gasoline, paint, pesticides), perishable food, live plants (long-distance), pets, firearms and ammunition, valuables (jewelry, cash, important documents), and items packed in trash bags.` },
    { q: () => `How do I avoid moving scams?`, a: () => `Red flags: no physical address, quotes without seeing your belongings, demanding a large cash deposit, no written estimate, unmarked trucks, and refusing to provide USDOT/MC numbers. Always get a binding or not-to-exceed estimate in writing.` },
    { q: () => `What is a binding vs. non-binding moving estimate?`, a: () => `A binding estimate guarantees the price regardless of actual weight. A non-binding estimate can change based on actual weight. A binding not-to-exceed estimate caps the price but charges less if you weigh under estimate. Always request binding NTE.` },
    { q: () => `How much does it cost to move a piano?`, a: () => `Upright pianos cost $200-$500 to move locally. Grand pianos cost $400-$1,000+. Long-distance piano moves cost $700-$2,000. Piano movers have specialized equipment and insurance. Never use general movers for pianos.` },
    { q: () => `What is the cheapest day to move?`, a: () => `Mid-week (Tuesday-Thursday) and mid-month are cheapest. Avoid the last and first days of each month, summer weekends, and holidays. Winter moves (November-February) are 20-30% cheaper than summer in most markets.` },
    { q: () => `How many boxes do I need for a 3-bedroom home?`, a: () => `A 3-bedroom home typically needs 40-60 medium boxes, 15-20 large boxes, 10-15 small boxes, plus specialty boxes for mirrors, wardrobes, and dishes. Most moving companies sell kits for $150-$250 or you can source free boxes from local stores.` },
    { q: () => `Should I get a moving container or hire movers?`, a: () => `Portable containers (PODS, etc.) cost $1,500-$4,500 for long-distance moves. You pack and load; they transport. It is 20-40% cheaper than full-service movers but requires your labor. Good for flexible timelines since you can store the container.` },
    { q: () => `What should I move myself vs. let movers handle?`, a: () => `Move yourself: valuables, important documents, medications, electronics (laptops, hard drives), irreplaceable items, and one box of essentials for the first night. Let movers handle: furniture, boxes, appliances, and bulky items.` },
  ],
};

// Generate default FAQ pool for verticals without a custom pool
function defaultFAQPool(tradeName, tradeNoun) {
  return [
    { q: (c) => `How much does ${tradeNoun} cost in ${c}?`, a: (c) => `Costs in ${c} vary based on scope, materials, and labor rates. Get 3 quotes from licensed local contractors to compare pricing for your specific project.` },
    { q: (c) => `How do I find a good ${tradeName.toLowerCase()} contractor in ${c}?`, a: (c) => `Check licensing through your state's contractor board, verify insurance, read reviews from ${c} homeowners, and get at least 3 written quotes with line-item detail.` },
    { q: (c) => `Do I need a permit for ${tradeNoun} in ${c}?`, a: (c) => `Most ${tradeNoun} projects in ${c} require a permit. Your contractor should pull the permit and schedule the inspection. Never pull permits in your own name.` },
    { q: () => `How long does the project typically take?`, a: () => `Timeline depends on scope and complexity. Simple projects take 1-3 days; larger jobs can run 1-4 weeks. Weather, permits, and material delivery affect scheduling.` },
    { q: () => `Should I get multiple quotes?`, a: () => `Always get at least 3 written quotes. Compare line-item details, not just total price. The lowest quote often omits scope items that appear as change orders later.` },
    { q: () => `What should I look for in a contractor quote?`, a: () => `A professional quote breaks out labor, materials, permits, and cleanup separately. It includes a timeline, payment schedule, warranty terms, and the contractor's license number.` },
    { q: (c) => `When is the best time to schedule this work in ${c}?`, a: (c) => `Off-peak seasons offer better pricing and availability. In ${c}, scheduling during the shoulder season saves 10-20% versus peak-demand months.` },
    { q: () => `What warranty should I expect?`, a: () => `Expect a minimum 1-year workmanship warranty from the contractor plus manufacturer warranties on materials. Get warranty terms in writing before signing.` },
    { q: () => `How much should I pay upfront?`, a: () => `Never pay more than 10-15% as a deposit before work begins. Standard payment structure: deposit, progress payment when materials arrive, final payment on completion.` },
    { q: () => `What are common red flags in contractor quotes?`, a: () => `Red flags include: no line-item detail, same-day signing pressure, request for more than 30% upfront, no license or insurance verification, and verbal-only warranties.` },
  ];
}

const VERTICAL_INFO = {
  "hvac": { trade: "HVAC", noun: "HVAC replacement", sizeLabel: "Home Size" },
  "roof": { trade: "Roofing", noun: "roof replacement", sizeLabel: "House Size" },
  "plumbing": { trade: "Plumbing", noun: "plumbing work", sizeLabel: "Service" },
  "electrical": { trade: "Electrical", noun: "electrical work", sizeLabel: "Service" },
  "solar": { trade: "Solar", noun: "solar installation", sizeLabel: "System Size" },
  "kitchen-remodel": { trade: "Kitchen Remodel", noun: "kitchen remodel", sizeLabel: "Size" },
  "window": { trade: "Window Replacement", noun: "window replacement", sizeLabel: "Home Size" },
  "siding": { trade: "Siding", noun: "siding replacement", sizeLabel: "Home Size" },
  "painting": { trade: "Painting", noun: "exterior painting", sizeLabel: "Home Size" },
  "garage-door": { trade: "Garage Door", noun: "garage door replacement", sizeLabel: "Material" },
  "fence": { trade: "Fencing", noun: "fence installation", sizeLabel: "Yard Size" },
  "concrete": { trade: "Concrete", noun: "concrete work", sizeLabel: "Project Size" },
  "landscaping": { trade: "Landscaping", noun: "landscaping", sizeLabel: "Size" },
  "foundation": { trade: "Foundation Repair", noun: "foundation repair", sizeLabel: "Project Size" },
  "insulation": { trade: "Insulation", noun: "insulation", sizeLabel: "Attic Size" },
  "gutter": { trade: "Gutter", noun: "gutter installation", sizeLabel: "Yard Size" },
  "auto-repair": { trade: "Auto Repair", noun: "auto repair", sizeLabel: "Service" },
  "medical": { trade: "Medical", noun: "medical care", sizeLabel: "Service" },
  "legal": { trade: "Legal", noun: "legal services", sizeLabel: "Service" },
  "moving": { trade: "Moving", noun: "moving services", sizeLabel: "Move Size" },
};

function parseCityState(filename) {
  // Extract vertical pattern from filename
  for (const [vslug, info] of Object.entries(VERTICAL_INFO)) {
    const suffix = `-${vslug}-cost.html`;
    if (filename.endsWith(suffix)) {
      const prefix = filename.replace(suffix, "");
      const parts = prefix.split("-");
      const stateCode = parts.pop().toUpperCase();
      const cityName = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      return { cityName, stateCode, cityState: `${cityName}, ${stateCode}`, vslug, info };
    }
  }
  return null;
}

function processFile(filepath) {
  const filename = path.basename(filepath);
  const parsed = parseCityState(filename);
  if (!parsed) return "skip_parse";

  const { cityName, stateCode, cityState, vslug, info } = parsed;
  let html = fs.readFileSync(filepath, "utf8");

  // Skip if already processed with V13 (proper 32-bit seed mixing via Math.imul)
  if (html.includes("TP-STRUCT-DIV-V13")) return "skip_existing";

  // Strip old markers so we can re-process with expanded pools
  html = html.replace(/<!-- TP-STRUCT-DIV-V[0-9]+ -->\n?/g, "");

  const seed = hash(filename);
  const { trade, noun, sizeLabel } = info;

  // === 1. Vary H2: "What affects X cost in CITY" ===
  const whatAffectsRe = new RegExp(
    `(<h2[^>]*>)\\s*What affects (?:${trade.toLowerCase()}|${noun.toLowerCase()})\\s+cost in ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(</h2>)`,
    "i"
  );
  if (whatAffectsRe.test(html)) {
    const variant = pick(H2_VARIATIONS.what_affects, seed);
    html = html.replace(whatAffectsRe, `$1${variant(noun, cityName)}$2`);
  }

  // === 2. Vary H2: "X Cost by Y in CITY" ===
  const costBySizeRe = new RegExp(
    `(<h2[^>]*>)\\s*(?:${trade}|${noun})\\s+Cost(?:s)?\\s+by\\s+${sizeLabel}\\s+in\\s+${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(</h2>)`,
    "i"
  );
  if (costBySizeRe.test(html)) {
    const variant = pick(H2_VARIATIONS.cost_by_size, seed + 1);
    html = html.replace(costBySizeRe, `$1${variant(trade, sizeLabel, cityName)}$2`);
  }

  // === 3. Vary H2: "Frequently Asked Questions" ===
  const faqHeadingRe = /(<h2[^>]*>)\s*Frequently Asked Questions\s*(<\/h2>)/i;
  if (faqHeadingRe.test(html)) {
    const variant = pick(H2_VARIATIONS.faq_heading, seed + 2);
    html = html.replace(faqHeadingRe, `$1${variant(cityName, trade)}$2`);
  }

  // === 4. Vary H2: "Other Services in CITY" ===
  const otherServicesRe = new RegExp(
    `(<h2[^>]*>)\\s*Other Services in ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(</h2>)`,
    "i"
  );
  if (otherServicesRe.test(html)) {
    const variant = pick(H2_VARIATIONS.other_services, seed + 3);
    html = html.replace(otherServicesRe, `$1${variant(cityName)}$2`);
  }

  // === 5. Vary CTA H2: "Get a free cost estimate for CITY" ===
  const ctaRe = new RegExp(
    `(<h2[^>]*>)\\s*Get a free (?:cost |solar )?estimate for ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(</h2>)`,
    "i"
  );
  if (ctaRe.test(html)) {
    const variant = pick(H2_VARIATIONS.cta_heading, seed + 4);
    html = html.replace(ctaRe, `$1${variant(cityName)}$2`);
  }

  // Generate city-specific qualifier for compositional headings
  const qualifier = getCityQualifier(cityName, stateCode, seed + 100);

  // === 6a. Vary "X in CITY, ST: what locals should know" (and its existing variants) ===
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const localsPatterns = [
    `(?:${trade}|${noun})\\s+in\\s+${esc(cityName)},\\s*${stateCode}:\\s*what locals should know`,
    `What\\s+${esc(cityState)}\\s+homeowners\\s+need\\s+to\\s+know\\s+about`,
    `${esc(cityState)}\\s+(?:${esc(noun)}|${esc(trade)}):\\s*a local perspective`,
    `(?:${esc(noun)}|${esc(trade)})\\s+tips\\s+specific\\s+to\\s+${esc(cityState)}`,
    `Local\\s+(?:${esc(noun)}|${esc(trade)})\\s+advice\\s+for\\s+${esc(cityState)}`,
    `(?:${esc(noun)}|${esc(trade)})\\s+in\\s+${esc(cityState)}:\\s*homeowner\\s+essentials`,
    `What\\s+makes\\s+(?:${esc(noun)}|${esc(trade)})\\s+different\\s+in`,
    `(?:${esc(noun)}|${esc(trade)})\\s+landscape:\\s*what\\s+to\\s+expect`,
    `The\\s+${esc(cityState)}\\s+guide\\s+to`,
    `(?:${esc(noun)}|${esc(trade)})\\s+realities\\s+for`,
    `${esc(cityState)}-specific`,
    `Navigating\\s+(?:${esc(noun)}|${esc(trade)})\\s+costs\\s+in`,
    `(?:${esc(noun)}|${esc(trade)})\\s+in\\s+${esc(cityState)}:\\s*local\\s+context`,
    `${esc(cityState)}\\s+homeowners:\\s*(?:${esc(noun)}|${esc(trade)})`,
    `(?:${esc(noun)}|${esc(trade)})\\s+market\\s+snapshot\\s+for`,
    `What\\s+${esc(cityState)}\\s+locals\\s+say`,
    `(?:${esc(noun)}|${esc(trade)})\\s+in\\s+the\\s+${esc(cityState)}\\s+area`,
    `A\\s+homeowner.*take\\s+on`,
    `${esc(cityState)}\\s+(?:${esc(noun)}|${esc(trade)}):\\s*local\\s+conditions`,
    `${esc(cityState)}\\s+(?:${esc(noun)}|${esc(trade)}):\\s*insider`,
  ];
  const localsRe = new RegExp(
    `(<h2[^>]*>)\\s*(?:${localsPatterns.join("|")})[^<]*\\s*(</h2>)`,
    "i"
  );
  if (localsRe.test(html)) {
    const variant = pick(H2_VARIATIONS.locals_should_know, seed + 10);
    html = html.replace(localsRe, `$1${variant(noun, cityState, qualifier)}$2`);
  }

  // === 6b. Vary "X cost in nearby ST cities" (and its existing variants) ===
  const nearbyPatterns = [
    `(?:${trade}|${noun})\\s+cost\\s+in\\s+nearby\\s+${stateCode}\\s+cities`,
    `How\\s+nearby\\s+${stateCode}\\s+cities\\s+compare`,
    `(?:${trade}|${noun})\\s+pricing\\s+across\\s+the\\s+${stateCode}`,
    `${stateCode}\\s+neighbors:`,
    `What\\s+other\\s+${stateCode}\\s+cities\\s+pay`,
    `(?:${trade}|${noun})\\s+rates\\s+in\\s+surrounding\\s+${stateCode}`,
    `Nearby\\s+${stateCode}\\s+(?:${esc(noun)}|${esc(trade)})\\s+pricing`,
    `(?:${trade}|${noun})\\s+costs:\\s*${stateCode}\\s+city`,
    `Compare\\s+(?:${trade}|${noun})\\s+rates\\s+in\\s+${stateCode}`,
    `${stateCode}\\s+regional\\s+(?:${esc(noun)}|${esc(trade)})`,
    `Other\\s+${stateCode}\\s+cities`,
    `(?:${trade}|${noun})\\s+in\\s+other\\s+${stateCode}\\s+metros`,
    `Regional\\s+(?:${esc(noun)}|${esc(trade)})\\s+cost\\s+data`,
    `(?:${trade}|${noun})\\s+costs\\s+across\\s+${stateCode}`,
    `${stateCode}\\s+cities:\\s*(?:${esc(noun)}|${esc(trade)})`,
    `How\\s+(?:${esc(noun)}|${esc(trade)})\\s+prices\\s+compare\\s+in\\s+${stateCode}`,
    `(?:${trade}|${noun})\\s+in\\s+neighboring\\s+${stateCode}`,
    `Nearby\\s+(?:${esc(noun)}|${esc(trade)})\\s+markets`,
  ];
  const nearbyRe = new RegExp(
    `(<h2[^>]*>)\\s*(?:${nearbyPatterns.join("|")})[^<]*\\s*(</h2>)`,
    "i"
  );
  if (nearbyRe.test(html)) {
    const variant = pick(H2_VARIATIONS.nearby_cities, seed + 11);
    html = html.replace(nearbyRe, `$1${variant(noun, stateCode)}$2`);
  }

  // === 7. Vary V2 "About X in CITY, ST" ===
  const aboutRe = new RegExp(
    `(<h2[^>]*>)\\s*About [^<]+ in ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*${stateCode}\\s*(</h2>)`,
    "i"
  );
  if (aboutRe.test(html)) {
    const variant = pick(H2_VARIATIONS.about_section, seed + 5);
    html = html.replace(aboutRe, `$1${variant(noun, cityState)}$2`);
  }

  // === 7. Vary V3 "Local factors: X in CITY, ST" ===
  const localRe = new RegExp(
    `(<h2[^>]*>)\\s*Local factors: [^<]+ in ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*${stateCode}\\s*(</h2>)`,
    "i"
  );
  if (localRe.test(html)) {
    const variant = pick(H2_VARIATIONS.local_factors, seed + 6);
    html = html.replace(localRe, `$1${variant(noun, cityState)}$2`);
  }

  // === 8. Vary V4 "Pricing snapshot & nearby comparisons" ===
  const pricingRe = new RegExp(
    `(<h2[^>]*>)\\s*Pricing snapshot[^<]+${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*(</h2>)`,
    "i"
  );
  if (pricingRe.test(html)) {
    const variant = pick(H2_VARIATIONS.pricing_snapshot, seed + 7);
    html = html.replace(pricingRe, `$1${variant(cityState)}$2`);
  }

  // === 9. Vary V5 "What tradespeople earn in CITY, ST" ===
  const wageRe = new RegExp(
    `(<h2[^>]*>)\\s*What tradespeople earn in ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*${stateCode}\\s*(</h2>)`,
    "i"
  );
  if (wageRe.test(html)) {
    const variant = pick(H2_VARIATIONS.tradespeople_earn, seed + 8);
    html = html.replace(wageRe, `$1${variant(cityState)}$2`);
  }

  // === 10. Vary FAQ questions (swap in different Q&A from pool) ===
  const pool = FAQ_POOLS[vslug] || defaultFAQPool(trade, noun);
  if (pool.length >= 5) {
    // Select 3-5 questions for this city
    const count = 3 + (seed % 3); // 3, 4, or 5 questions
    const selected = [];
    const used = new Set();
    for (let i = 0; i < count && i < pool.length; i++) {
      let idx = (seed + i * 7) % pool.length;
      while (used.has(idx)) idx = (idx + 1) % pool.length;
      used.add(idx);
      selected.push(pool[idx]);
    }

    // Replace the FAQ section content
    const faqListRe = /(<div class="faq-list">)([\s\S]*?)(<\/div>\s*<\/section>)/;
    const faqMatch = html.match(faqListRe);
    if (faqMatch) {
      let newFaqHtml = "\n";
      for (const faq of selected) {
        const question = typeof faq.q === "function" ? faq.q(cityName) : faq.q;
        const answer = typeof faq.a === "function" ? faq.a(cityName) : faq.a;
        newFaqHtml += `\n<details class="faq-item">\n<summary>${question}</summary>\n<div class="faq-answer">\n<p>${answer}</p>\n</div>\n</details>\n`;
      }
      newFaqHtml += "\n";
      html = html.replace(faqListRe, (_, open, _content, close) => open + newFaqHtml + close);
    }

    // Also update FAQ JSON-LD in head
    const faqJsonRe = /("@type":"FAQPage","mainEntity":\[)([\s\S]*?)(\]\})/;
    const jsonMatch = html.match(faqJsonRe);
    if (jsonMatch) {
      const jsonEntries = selected.map(faq => {
        const q = (typeof faq.q === "function" ? faq.q(cityName) : faq.q).replace(/"/g, '\\"');
        const a = (typeof faq.a === "function" ? faq.a(cityName) : faq.a).replace(/"/g, '\\"');
        return `{"@type":"Question","name":"${q}","acceptedAnswer":{"@type":"Answer","text":"${a}"}}`;
      });
      html = html.replace(faqJsonRe, (_, open, _content, close) => open + jsonEntries.join(",") + close);
    }
  }

  // === 11. Vary local-card H3 headings (these are 100% shared across all pages) ===
  const h3ClimateVariants = [
    "Climate &amp; site factors", "Weather &amp; environmental factors", "Climate conditions",
    "Environmental considerations", "Weather impact", "Site &amp; climate",
    "Local weather factors", "Climate &amp; conditions", "Environmental context",
    "Weather &amp; site conditions", "Climate profile", "Regional weather",
    "Local environment", "Weather considerations", "Climate &amp; soil",
    "Environmental factors", "Local climate", "Site conditions",
    "Regional climate", "Weather &amp; location",
  ];
  const h3HousingVariants = [
    "Local housing stock", "Area home characteristics", "Neighborhood housing",
    "Residential building stock", "Home construction profile", "Housing landscape",
    "Property characteristics", "Area homes", "Local building stock",
    "Residential profile", "Housing overview", "Home age &amp; type",
    "Property landscape", "Neighborhood homes", "Local residences",
    "Housing composition", "Building inventory", "Home construction mix",
    "Residential makeup", "Area housing",
  ];
  const h3PermitVariants = [
    "Permits &amp; licensing", "Code &amp; permit requirements", "Licensing &amp; codes",
    "Regulatory requirements", "Permit process", "Local codes",
    "Building permits", "Code requirements", "License &amp; permit info",
    "Compliance requirements", "Permit &amp; code info", "Regulatory landscape",
    "Local permit rules", "Code &amp; licensing", "Permit requirements",
    "Building code info", "Local regulations", "Permitting details",
    "Licensing requirements", "Codes &amp; permits",
  ];
  const h3MarketVariants = [
    "Local market", "Contractor landscape", "Market conditions",
    "Local competition", "Contractor availability", "Market dynamics",
    "Service market", "Local contractors", "Competitive landscape",
    "Market overview", "Contractor market", "Local pricing dynamics",
    "Service availability", "Market profile", "Contractor supply",
    "Pricing environment", "Local service market", "Competition &amp; pricing",
    "Market context", "Contractor pool",
  ];

  const climateRe = new RegExp(`<h3>(?:${h3ClimateVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h3>`, 'i');
  const housingRe = new RegExp(`<h3>(?:${h3HousingVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h3>`, 'i');
  const permitRe = new RegExp(`<h3>(?:${h3PermitVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h3>`, 'i');
  const marketRe = new RegExp(`<h3>(?:${h3MarketVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h3>`, 'i');
  html = html.replace(climateRe, `<h3>${pick(h3ClimateVariants, seed + 20)}</h3>`);
  html = html.replace(housingRe, `<h3>${pick(h3HousingVariants, seed + 21)}</h3>`);
  html = html.replace(permitRe, `<h3>${pick(h3PermitVariants, seed + 22)}</h3>`);
  html = html.replace(marketRe, `<h3>${pick(h3MarketVariants, seed + 23)}</h3>`);

  // === 12. Vary tools block H3 ===
  const toolsH3Variants = [
    (c) => `More Woogoro tools for ${c}`,
    (c) => `Free tools for ${c} homeowners`,
    (c) => `${c} pricing tools`,
    (c) => `Explore more for ${c}`,
    (c) => `Additional ${c} resources`,
    (c) => `${c} cost calculators`,
    (c) => `Tools for ${c} projects`,
    (c) => `${c} home improvement tools`,
    (c) => `Free ${c} estimators`,
    (c) => `More ${c} tools`,
    (c) => `${c} project resources`,
    (c) => `Pricing tools for ${c}`,
    (c) => `${c} contractor tools`,
    (c) => `Home project tools for ${c}`,
    (c) => `${c} cost resources`,
    (c) => `Free estimators for ${c}`,
    (c) => `${c} analysis tools`,
    (c) => `Project calculators for ${c}`,
    (c) => `${c} comparison tools`,
    (c) => `Tools &amp; resources for ${c}`,
  ];
  // Match any existing tools H3 variant (they all contain city name)
  const toolsH3Patterns = toolsH3Variants.map(fn => fn(cityName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const toolsH3Re = new RegExp(`(<h3[^>]*>)\\s*(?:${toolsH3Patterns.join('|')})\\s*(</h3>)`, "i");
  if (toolsH3Re.test(html)) {
    html = html.replace(toolsH3Re, `$1${pick(toolsH3Variants, seed + 24)(cityName)}$2`);
  }

  // === 13. Vary CTA H3 "Get free pricing guides" ===
  const ctaH3Variants = [
    "Get free pricing guides", "Free cost guides", "Download pricing guides",
    "Free project guides", "Get your free guide", "Cost guide library",
    "Free homeowner guides", "Pricing guide downloads", "Free estimate guides",
    "Get informed for free", "Free pricing resources", "Homeowner cost guides",
    "Free project resources", "Download free guides", "Cost reference guides",
    "Free renovation guides", "Project pricing guides", "Free cost references",
    "Homeowner pricing guides", "Get free cost data",
  ];
  const ctaH3Re = new RegExp(`<h3([^>]*)>(?:${ctaH3Variants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h3>`, 'i');
  html = html.replace(ctaH3Re, `<h3$1>${pick(ctaH3Variants, seed + 25)}</h3>`);

  // === 14. Vary footer H4s ===
  const footerBrowseVariants = [
    "Browse", "Explore", "Services", "Categories", "Find services",
    "Cost guides", "All services", "Service areas", "Pricing guides",
    "Project types", "Home services", "Browse services", "Service categories",
    "All guides", "Explore services", "Guide library", "Browse guides",
    "Project guides", "Service types", "All categories",
  ];
  const footerTopTradesVariants = [
    "Top trades", "Popular services", "Most requested", "Trending",
    "In demand", "Top categories", "Popular trades", "Most popular",
    "High demand", "Top services", "Featured trades", "Common projects",
    "Frequently quoted", "Top picks", "Popular projects", "Most searched",
    "Trending trades", "Key services", "Top requests", "Hot categories",
  ];
  // Match any of the existing variants for Browse and Top trades
  const browseRe = new RegExp(`<h4>(?:${footerBrowseVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h4>`, 'i');
  const topTradesRe = new RegExp(`<h4>(?:${footerTopTradesVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h4>`, 'i');
  html = html.replace(browseRe, `<h4>${pick(footerBrowseVariants, seed + 26)}</h4>`);
  html = html.replace(topTradesRe, `<h4>${pick(footerTopTradesVariants, seed + 27)}</h4>`);

  // Footer "Get a Price" and "About" H4s
  const footerPriceVariants = [
    "Get a Price", "Get an Estimate", "Free Quotes", "Pricing",
    "Cost Estimates", "Get Started", "Your Estimate", "Free Pricing",
    "Check Costs", "Start Here", "Quote Tools", "Price Check",
    "Estimate Tools", "Get Pricing", "Cost Tools", "Free Estimates",
    "Your Quote", "Price Lookup", "Cost Finder", "Estimate Now",
  ];
  const footerAboutVariants = [
    "About", "About Us", "Company", "Who We Are",
    "Our Mission", "About Woogoro", "Learn More", "The Team",
    "Our Story", "Why Woogoro", "Background", "About the Project",
    "Meet Woogoro", "Our Approach", "What We Do", "Info",
    "Company Info", "About the Company", "Overview", "Our Vision",
  ];
  const priceRe = new RegExp(`<h4>(?:${footerPriceVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h4>`, 'i');
  const aboutRe2 = new RegExp(`<h4>(?:${footerAboutVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h4>`, 'i');
  html = html.replace(priceRe, `<h4>${pick(footerPriceVariants, seed + 28)}</h4>`);
  html = html.replace(aboutRe2, `<h4>${pick(footerAboutVariants, seed + 29)}</h4>`);

  // === 15. Vary flagship cost-scenario H3s: Budget / Mid-range / Premium ===
  const budgetVariants = [
    "Budget", "Economy tier", "Value option", "Budget range", "Entry level",
    "Cost-conscious", "Affordable option", "Basic tier", "Starter range", "Lean budget",
    "Budget-friendly", "Economy range", "Value tier", "Thrifty option", "Low end",
    "Baseline", "Economical choice", "Budget pick", "Value range", "Savings tier",
  ];
  const midVariants = [
    "Mid-range", "Mid-Range", "Standard range", "Middle tier", "Typical range",
    "Moderate option", "Average range", "Standard tier", "Mid tier", "Popular range",
    "Balanced option", "Mainstream pick", "Median range", "Common tier", "Middle ground",
    "Standard option", "Moderate range", "Mid-level", "Center range", "Typical tier",
  ];
  const premiumVariants = [
    "Premium", "High-end", "Premium tier", "Luxury range", "Top tier",
    "Deluxe option", "Upscale range", "Elite tier", "First-class", "Superior range",
    "Premium range", "High-end tier", "Top-of-line", "Quality tier", "Platinum range",
    "Premium pick", "Upmarket option", "Prime range", "Select tier", "Prestige range",
  ];
  const budgetRe = new RegExp(`<h3((?:\\s+style="[^"]*")?)>(?:${budgetVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h3>`, 'i');
  const midRe = new RegExp(`<h3((?:\\s+style="[^"]*")?)>(?:${midVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h3>`, 'i');
  const premiumRe = new RegExp(`<h3((?:\\s+style="[^"]*")?)>(?:${premiumVariants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})</h3>`, 'i');
  html = html.replace(budgetRe, `<h3$1>${pick(budgetVariants, seed + 30)}</h3>`);
  html = html.replace(midRe, `<h3$1>${pick(midVariants, seed + 31)}</h3>`);
  html = html.replace(premiumRe, `<h3$1>${pick(premiumVariants, seed + 32)}</h3>`);

  // === 16. Vary per-vertical flagship red-flag H3s (no city name = identical across metros) ===
  const redFlagVariants = {
    // Plumbing
    "Licensing gap": ["Licensing gap", "License verification", "Contractor licensing issue", "Credentials shortfall", "License compliance gap", "Licensing red flag", "Missing credentials", "License concern"],
    "Pipe-material misdiagnosis": ["Pipe-material misdiagnosis", "Wrong pipe material call", "Material mismatch", "Pipe spec error", "Piping material issue", "Misidentified pipe type", "Material misdiagnosis", "Pipe assessment error"],
    "Emergency vs scheduled pricing": ["Emergency vs scheduled pricing", "Urgent vs planned pricing", "Emergency rate spread", "Rush vs regular pricing", "Emergency markup gap", "Scheduled vs emergency cost", "After-hours price gap", "Priority pricing concern"],
    "Common issue overlooked": ["Common issue overlooked", "Frequently missed issue", "Overlooked concern", "Easy-to-miss problem", "Commonly skipped item", "Under-the-radar issue", "Often-ignored factor", "Missed consideration"],
    // Electrical
    "Missing license verification": ["Missing license verification", "License check skipped", "Unverified credentials", "No license confirmation", "Credentials not checked", "License gap", "Missing credential check", "Unconfirmed licensing"],
    "Hazard not disclosed": ["Hazard not disclosed", "Undisclosed safety risk", "Hidden hazard", "Safety concern omitted", "Risk not flagged", "Hazard left unmentioned", "Safety gap undisclosed", "Unreported hazard"],
    // Foundation
    "Misapplied repair method": ["Misapplied repair method", "Wrong repair approach", "Repair method mismatch", "Technique misapplication", "Incorrect repair strategy", "Mismatched repair type", "Wrong fix applied", "Method selection error"],
    "Permit and engineering gaps": ["Permit and engineering gaps", "Engineering oversight", "Permit compliance gap", "Structural review missing", "Engineering sign-off gap", "Permit shortfall", "Structural approval gap", "Engineering compliance issue"],
    "Drainage approach mismatch": ["Drainage approach mismatch", "Water management gap", "Drainage spec error", "Moisture control mismatch", "Grading and drainage issue", "Water diversion problem", "Drainage design gap", "Moisture management error"],
    "Warranty coverage holes": ["Warranty coverage holes", "Warranty gaps", "Coverage exclusions", "Warranty fine print", "Protection gaps", "Warranty limitations", "Coverage shortfall", "Warranty blind spots"],
    // Concrete
    "Climate exposure unaddressed": ["Climate exposure unaddressed", "Weather exposure gap", "Climate risk overlooked", "Environmental exposure issue", "Weathering not addressed", "Climate impact unplanned", "Exposure risk ignored", "Weather factor missed"],
    "Missing disaster-informed detailing": ["Missing disaster-informed detailing", "Disaster prep omitted", "Storm-readiness gap", "Natural hazard oversight", "Disaster resilience missing", "Hazard detailing skipped", "Storm hardening absent", "Disaster planning gap"],
    "Setback or permit gaps": ["Setback or permit gaps", "Zoning compliance gap", "Setback violation risk", "Permit process gap", "Property line issue", "Zoning setback concern", "Regulatory gap", "Code compliance risk"],
    "Pour window mismatch": ["Pour window mismatch", "Timing and cure concern", "Pour schedule issue", "Curing window problem", "Seasonal timing mismatch", "Pour timing error", "Concrete timing gap", "Weather window risk"],
    // Painting
    "Historic or HOA color review ignored": ["Historic or HOA color review ignored", "Color approval skipped", "HOA review missing", "Historic palette check skipped", "Color compliance gap", "Design review omitted", "HOA color check absent", "Palette approval missed"],
    "Lead paint compliance missing": ["Lead paint compliance missing", "Lead safety gap", "RRP compliance absent", "Lead abatement oversight", "Lead testing skipped", "EPA lead rule gap", "Lead hazard unaddressed", "RRP protocol missing"],
    "Seasonal window mismatched": ["Seasonal window mismatched", "Wrong season for painting", "Application timing issue", "Weather window missed", "Seasonal timing error", "Paint schedule concern", "Temperature window wrong", "Seasonal planning gap"],
    // Kitchen
    "Appliance spec mismatched to local utility": ["Appliance spec mismatched to local utility", "Utility compatibility gap", "Appliance hookup mismatch", "Service compatibility issue", "Utility spec conflict", "Appliance connection gap", "Local utility mismatch", "Service hookup concern"],
    "Historic-district review skipped": ["Historic-district review skipped", "Heritage review omitted", "Historic preservation gap", "District compliance skipped", "Landmark review missing", "Historic approval absent", "Preservation check skipped", "Heritage compliance gap"],
    "Surprise gotchas not priced": ["Surprise gotchas not priced", "Hidden costs unquoted", "Change order risk", "Unpriced contingencies", "Hidden extras not included", "Cost surprises ahead", "Unquoted add-ons", "Contingency gaps"],
    // Solar
    "Climate-risk engineering shortfall": ["Climate-risk engineering shortfall", "Weather resilience gap", "Climate engineering oversight", "Storm rating concern", "Environmental load gap", "Climate hardening absent", "Weather risk unaddressed", "Structural climate gap"],
    // Fence
    "Climate-mismatch spec": ["Climate-mismatch spec", "Weather-material mismatch", "Climate suitability gap", "Material-climate conflict", "Environmental spec error", "Weather compatibility issue", "Climate rating mismatch", "Material weathering risk"],
    "Skipped HOA review": ["Skipped HOA review", "HOA approval missing", "Community review skipped", "HOA compliance gap", "Association review absent", "HOA check omitted", "Covenant review missing", "HOA sign-off skipped"],
    "Missing wildlife provisions": ["Missing wildlife provisions", "Wildlife accommodation gap", "Animal passage missing", "Wildlife code unmet", "Habitat provision absent", "Wildlife compliance gap", "Animal access omitted", "Wildlife planning missing"],
    // Moving
    "No license or registration number": ["No license or registration number", "Missing USDOT credentials", "License number absent", "Registration unverified", "No DOT number provided", "Licensing credentials missing", "Registration gap", "Carrier license unconfirmed"],
    "Quote far below market rate": ["Quote far below market rate", "Suspiciously low bid", "Below-market pricing", "Unrealistic low quote", "Red flag pricing", "Too-good-to-be-true bid", "Lowball estimate warning", "Under-market quote concern"],
    "Demands large cash deposit": ["Demands large cash deposit", "Excessive upfront payment", "Large deposit red flag", "Cash-only deposit demand", "Upfront payment warning", "Deposit amount concern", "Pre-move payment risk", "Large advance required"],
    "No written estimate provided": ["No written estimate provided", "Verbal-only quote", "Missing written quote", "No documentation offered", "Estimate not in writing", "Undocumented pricing", "Written quote absent", "No formal estimate"],
    // Insulation-specific cost tiers
    "Budget attic top-up": ["Budget attic top-up", "Basic attic refresh", "Economy attic layer", "Value attic insulation", "Starter attic upgrade", "Attic top-up (economy)", "Basic attic addition", "Affordable attic layer"],
    "Mid-range attic plus air seal": ["Mid-range attic plus air seal", "Standard attic and seal package", "Attic insulation with air sealing", "Full attic treatment", "Attic upgrade with seal", "Complete attic package", "Standard insulation and seal", "Attic plus weatherization"],
    "Premium whole-house package": ["Premium whole-house package", "Complete home insulation", "Whole-house upgrade", "Full-home energy package", "Comprehensive insulation", "Total home treatment", "Whole-property package", "Premium full-house job"],
  };
  for (const [original, variants] of Object.entries(redFlagVariants)) {
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const allVariantsEsc = variants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const rfRe = new RegExp(`<h3((?:\\s+style="[^"]*")?)>(?:${allVariantsEsc.join('|')})</h3>`, 'i');
    if (rfRe.test(html)) {
      html = html.replace(rfRe, `<h3$1>${pick(variants, seed + 33)}</h3>`);
    }
  }

  // === 17. Vary flagship H2 headings ===
  // Flagship pages share identical H2 structures with only city name varying.
  // Wrapper names include: FLAGSHIP-CONTENT, FLAGSHIP-HVAC-CONTENT, FLAGSHIP-AUTO-REPAIR-CONTENT,
  // FLAGSHIP-GARAGE-CONTENT, FLAGSHIP-MEDICAL-CONTENT, FLAGSHIP-LEGAL-CONTENT, etc.
  // Regex must tolerate hyphens inside and the bare "FLAGSHIP-CONTENT" form.
  const flagshipSectionRe = /<!-- FLAGSHIP(?:-[A-Z][A-Z-]*)?-CONTENT -->([\s\S]*?)<!-- \/FLAGSHIP(?:-[A-Z][A-Z-]*)?-CONTENT -->/;
  const flagshipSectionMatch = html.match(flagshipSectionRe);
  if (flagshipSectionMatch) {
    let fHtml = flagshipSectionMatch[1];
    const cEsc = cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    fHtml = fHtml.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (full, attrs, content) => {
      const text = content.trim();
      const ci = cityName;
      if (!text.includes(ci)) return full;
      // Seed mixes city seed + H2 text hash -> uncorrelated picks per (city, heading) pair.
      // Avoids mod-N collisions where two cities pick the same variant for every H2.
      // Use Math.imul to preserve 32-bit precision (plain * loses bits past 2^53).
      const h2Seed = (Math.imul(seed, 2654435761) + Math.imul(hash(text), 2246822519) + 0x9E3779B9) >>> 0;

      // --- "Questions to Ask/for [a/your] CITY [tradesperson]" ---
      const qRe = new RegExp(`^Questions\\s+(?:to\\s+[Aa]sk\\s+a|for\\s+your)\\s+${cEsc}\\s+(.+)$`, 'i');
      const qm = text.match(qRe);
      if (qm) {
        const tp = qm[1];
        const tpl = tp.toLowerCase();
        const v = [
          `Questions to ask a ${ci} ${tp}`,
          `What to ask your ${ci} ${tp}`,
          `${ci} ${tp}: key questions`,
          `Interviewing a ${ci} ${tp}`,
          `Key questions for a ${ci} ${tp}`,
          `Before hiring a ${ci} ${tp}`,
          `${ci} ${tp} vetting questions`,
          `Must-ask questions for ${ci} ${tpl}s`,
          `Vetting a ${ci} ${tp}: what to ask`,
          `Smart questions for a ${ci} ${tp}`,
          `${ci} ${tp} interview guide`,
          `Hiring a ${ci} ${tp}? Ask these`,
          `${ci} ${tp}: the right questions`,
          `A ${ci} ${tp} checklist`,
          `Screening ${ci} ${tpl}s`,
          `How to vet a ${ci} ${tp}`,
        ];
        return `<h2${attrs}>${pick(v, h2Seed)}</h2>`;
      }

      // --- "What Your CITY X Should Cover/Spell Out" ---
      const wcRe = new RegExp(`^What\\s+[Yy]our\\s+${cEsc}\\s+(.+?)\\s+[Ss]hould\\s+(?:[Cc]over|[Ss]pell\\s+[Oo]ut)$`);
      const wcm = text.match(wcRe);
      if (wcm) {
        const tp = wcm[1].toLowerCase();
        const v = [
          `What your ${ci} ${tp} should include`,
          `${ci} ${tp} contract essentials`,
          `Key items for a ${ci} ${tp} agreement`,
          `Your ${ci} ${tp} contract checklist`,
          `What a ${ci} ${tp} contract needs`,
          `${ci} ${tp}: contract must-haves`,
          `Essential terms for ${ci} ${tp} work`,
          `${ci} ${tp} agreement basics`,
          `Reading a ${ci} ${tp} contract`,
          `${ci} ${tp} paperwork to verify`,
          `What belongs in a ${ci} ${tp} contract`,
          `Contract line items for ${ci} ${tp}`,
          `${ci} ${tp}: written agreement points`,
          `Before you sign a ${ci} ${tp} contract`,
          `${ci} ${tp} contract review guide`,
          `Auditing a ${ci} ${tp} agreement`,
        ];
        return `<h2${attrs}>${pick(v, h2Seed)}</h2>`;
      }

      // --- "When to [verb] CITY [noun phrase]" ---
      const wtcRe = new RegExp(`^When\\s+to\\s+(.+?)\\s+${cEsc}\\s+(.+)$`, 'i');
      const wtcm = text.match(wtcRe);
      if (wtcm) {
        const verb = wtcm[1].toLowerCase();
        const rest = wtcm[2].toLowerCase();
        const v = [
          `When to ${verb} ${ci} ${rest}`,
          `Best timing for ${ci} ${rest}`,
          `${ci} ${rest}: scheduling guide`,
          `Timing your ${ci} ${rest}`,
          `Optimal timing for ${ci} ${rest}`,
          `When to book ${ci} ${rest}`,
          `${ci} ${rest}: when to start`,
          `Planning ${ci} ${rest} timing`,
          `${ci} ${rest} scheduling window`,
          `The right time for ${ci} ${rest}`,
          `${ci} ${rest}: calendar considerations`,
          `Seasonal timing for ${ci} ${rest}`,
          `When ${ci} ${rest} makes sense`,
          `Timing a ${ci} ${rest} project`,
          `${ci} ${rest}: when to pull the trigger`,
          `${ci} ${rest}: best months to book`,
        ];
        return `<h2${attrs}>${pick(v, h2Seed)}</h2>`;
      }

      // --- "When to [verb phrase] in CITY" ---
      const wtiRe = new RegExp(`^When\\s+to\\s+(.+?)\\s+in\\s+${cEsc}$`, 'i');
      const wtim2 = text.match(wtiRe);
      if (wtim2) {
        const al = wtim2[1].toLowerCase();
        const v = [
          `When to ${al} in ${ci}`,
          `Best time to ${al} in ${ci}`,
          `${ci}: timing guide for ${al}`,
          `Scheduling ${al} in ${ci}`,
          `Ideal timing to ${al} in ${ci}`,
          `${ci} ${al} timing`,
          `${al} scheduling for ${ci}`,
          `Planning to ${al} in ${ci}`,
          `${ci}: when to ${al}`,
          `Optimal ${ci} ${al} timing`,
          `Seasonal timing to ${al} in ${ci}`,
          `${ci}: the right moment to ${al}`,
          `Timing your ${ci} ${al} plans`,
          `${al} calendar for ${ci}`,
          `${ci} ${al}: booking window`,
          `${ci}: month-by-month guide to ${al}`,
        ];
        return `<h2${attrs}>${pick(v, h2Seed)}</h2>`;
      }

      // --- "[topic] in/around/for/across CITY[: subtitle]" (city at end) ---
      const teRe = new RegExp(`^(.+?)\\s+(?:in|around|for|across|near)\\s+${cEsc}(.*)$`, 'i');
      const tem = text.match(teRe);
      if (tem) {
        const topic = tem[1];
        const suffix = tem[2] || '';
        const sl = smartLower(topic);
        // Only use the "homeowners" variant when there's no suffix after city — otherwise it
        // produces "Price Transparency Tools for CITY homeowners Patients".
        const canHomeowners = suffix.trim().length === 0;
        const v = [
          `${topic} in ${ci}${suffix}`,
          `${ci} ${sl}${suffix}`,
          canHomeowners ? `${topic} for ${ci} homeowners` : `${topic} across ${ci}${suffix}`,
          `${topic} across ${ci}${suffix}`,
          `${ci}-area ${sl}${suffix}`,
          `${topic} around ${ci}${suffix}`,
          `${ci} ${sl}: overview${suffix}`,
          `${topic} near ${ci}${suffix}`,
          canHomeowners ? `Understanding ${sl} in ${ci}` : `${ci} ${sl}: the basics${suffix}`,
          `${topic} throughout ${ci}${suffix}`,
          `${ci}'s ${sl}${suffix}`,
          `A ${ci} guide: ${sl}${suffix}`,
          canHomeowners ? `${topic}: a ${ci} breakdown` : `${topic} serving ${ci}${suffix}`,
          `${topic} specific to ${ci}${suffix}`,
          `${ci}: ${sl}${suffix}`,
          `${cap(sl)} within ${ci}${suffix}`,
        ];
        return `<h2${attrs}>${pick(v, h2Seed)}</h2>`;
      }

      // --- "[prefix] CITY [suffix]" (city in middle) ---
      // Only transform "How <thing> in CITY is/are/does..." or "How CITY's X Y Z" patterns.
      // Generic middle-city patterns rearrange awkwardly; skip them.
      const howCmRe = new RegExp(`^How\\s+${cEsc}(?:'s)?\\s+(.+)$`, 'i');
      const howCm = text.match(howCmRe);
      if (howCm) {
        const rest = howCm[1];
        const rl = rest.toLowerCase();
        const v = [
          `How ${ci}'s ${rl}`,
          `How ${ci} ${rl}`,
          `${ci}: how ${rl}`,
          `${ci}'s impact: ${rl}`,
          `${cap(rl)} in ${ci}`,
          `Understanding ${ci}: ${rl}`,
          `Why ${ci}'s ${rl}`,
          `${ci} and ${rl}: what to know`,
          `${ci}: ${rl}`,
          `The ${ci} angle on ${rl}`,
          `${cap(rl)} across ${ci}`,
          `${ci} specifics: ${rl}`,
          `A ${ci} perspective: ${rl}`,
          `${ci} homeowners and ${rl}`,
          `Local view: ${rl} in ${ci}`,
          `${ci} context for ${rl}`,
        ];
        return `<h2${attrs}>${pick(v, h2Seed)}</h2>`;
      }
      const cmRe = new RegExp(`^(.+?)\\s+${cEsc}\\s+(.+)$`, 'i');
      if (cmRe.test(text)) {
        return full;
      }

      // --- "CITY [Topic]" (city at start, most common) ---
      const csRe = new RegExp(`^${cEsc}(?:'s)?\\s+(.+)$`, 'i');
      const csm = text.match(csRe);
      if (csm) {
        const topic = csm[1];
        const sl = smartLower(topic);
        const v = [
          `${ci} ${topic}`,
          `${cap(sl)} in ${ci}`,
          `${ci}'s ${sl}`,
          `${cap(sl)} for ${ci} homeowners`,
          `${cap(sl)} across ${ci}`,
          `${ci}-area ${sl}`,
          `Understanding ${sl} in ${ci}`,
          `${cap(sl)}: a ${ci} guide`,
          `${cap(sl)} around ${ci}`,
          `${cap(sl)} throughout ${ci}`,
          `${ci}: ${sl}`,
          `${cap(sl)} near ${ci}`,
          `${cap(sl)} within ${ci}`,
          `A ${ci} look at ${sl}`,
          `${cap(sl)}: ${ci} edition`,
          `${ci} and ${sl}`,
        ];
        return `<h2${attrs}>${pick(v, h2Seed)}</h2>`;
      }

      return full;
    });

    // Replace flagship section content (use function to avoid $-replacement)
    const openTag = flagshipSectionMatch[0].match(/<!-- FLAGSHIP(?:-[A-Z][A-Z-]*)?-CONTENT -->/)[0];
    const closeTag = flagshipSectionMatch[0].match(/<!-- \/FLAGSHIP(?:-[A-Z][A-Z-]*)?-CONTENT -->/)[0];
    html = html.replace(flagshipSectionMatch[0], () => openTag + fHtml + closeTag);
  }

  // Add processing marker (invisible comment at end of body)
  html = html.replace("</body>", "<!-- TP-STRUCT-DIV-V13 -->\n</body>");

  fs.writeFileSync(filepath, html, "utf8");
  return "updated";
}

function main() {
  const filterVertical = process.argv[2];
  const allFiles = fs.readdirSync(ROOT).filter(f => f.endsWith("-cost.html"));

  const stats = { updated: 0, skip_existing: 0, skip_parse: 0 };
  let lastVertical = "";

  for (let i = 0; i < allFiles.length; i++) {
    const f = allFiles[i];
    const parsed = parseCityState(f);
    if (!parsed) { stats.skip_parse++; continue; }
    if (filterVertical && parsed.vslug !== filterVertical) continue;

    if (parsed.vslug !== lastVertical) {
      if (lastVertical) console.log(`  -> ${stats.updated} updated`);
      console.log(`${parsed.vslug}...`);
      lastVertical = parsed.vslug;
    }

    const result = processFile(path.join(ROOT, f));
    stats[result] = (stats[result] || 0) + 1;

    if ((i + 1) % 500 === 0) {
      process.stdout.write(`  progress ${i + 1}/${allFiles.length}\r`);
    }
  }
  if (lastVertical) console.log(`  -> ${stats.updated} updated`);

  console.log(`\n=== DONE ===`);
  console.log(`  updated: ${stats.updated}`);
  console.log(`  skip_existing: ${stats.skip_existing}`);
  console.log(`  skip_parse: ${stats.skip_parse}`);
}

main();
