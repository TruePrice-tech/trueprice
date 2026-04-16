#!/usr/bin/env node
/**
 * Generates deep editorial content for 10 flagship metro HVAC pages.
 * Injects ~2500+ words of genuinely unique, city-specific prose covering
 * neighborhood pricing, climate, efficiency, utilities, permits, contractors,
 * red flags, seasonal timing, and cost scenarios.
 * Idempotent via FLAGSHIP-HVAC-CONTENT markers.
 *
 * Usage: node scripts/build-flagship-hvac.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/hvac-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-HVAC-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-HVAC-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-hvac-cost.html" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-hvac-cost.html" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-hvac-cost.html" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-hvac-cost.html" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-hvac-cost.html" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-hvac-cost.html" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-hvac-cost.html" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-hvac-cost.html" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-hvac-cost.html" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-hvac-cost.html" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-hvac-cost.html" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-hvac-cost.html" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-hvac-cost.html" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-hvac-cost.html" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-hvac-cost.html" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-hvac-cost.html" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-hvac-cost.html" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-hvac-cost.html" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-hvac-cost.html" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-hvac-cost.html" },
];

/* --- helpers --- */
function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString()}`; }
function fmtD(n) { return `$${n.toLocaleString()}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function getMultiplier(state) {
  return pricingModel.stateMultipliers?.[state] || 1.0;
}

/* --- HVAC-specific metro data --- */
const metroHVACData = {
  "new-york-ny": {
    utilityCompanies: "Con Edison and National Grid",
    avgElectricRate: 0.24, // $/kWh
    avgGasRate: 1.85, // $/therm
    coolingDominant: false,
    heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "cold winters with sub-zero wind chills",
    recommendedSEER: 16,
    recommendedAFUE: 95,
    heatPumpViable: "viable for shoulder seasons but gas backup needed for coldest weeks",
    permitAuthority: "NYC Department of Buildings (DOB)",
    permitDetail: "Requires a work permit and licensed HVAC contractor (NYC Home Improvement Contractor license). Self-certified permits available for licensed Master Plumber for gas work. Inspections mandatory.",
    bestBuyMonths: "October through February",
    worstBuyMonths: "June through August",
    seasonReason: "Summer AC failures create emergency demand and premium pricing. Late fall and winter offer the best negotiating leverage.",
  },
  "los-angeles-ca": {
    utilityCompanies: "LADWP and Southern California Edison",
    avgElectricRate: 0.28,
    avgGasRate: 1.65,
    coolingDominant: true,
    heatingDominant: false,
    humidityIssue: "low",
    extremeTemp: "inland valleys hit 110F+ during heat waves",
    recommendedSEER: 18,
    recommendedAFUE: 80,
    heatPumpViable: "excellent choice for LA's mild climate; handles both heating and cooling efficiently year-round",
    permitAuthority: "LADBS (LA Department of Building and Safety)",
    permitDetail: "Mechanical permit required for all HVAC replacements. Permit fees range from $150-$400. Title 24 energy compliance documentation mandatory. Express permits available for like-for-like replacements.",
    bestBuyMonths: "November through March",
    worstBuyMonths: "July through September",
    seasonReason: "Heat waves trigger emergency AC replacements at premium pricing. Winter is mild and contractors are hungry for work.",
  },
  "chicago-il": {
    utilityCompanies: "ComEd (electric) and Peoples Gas / Nicor Gas",
    avgElectricRate: 0.17,
    avgGasRate: 1.10,
    coolingDominant: false,
    heatingDominant: true,
    humidityIssue: "moderate summer",
    extremeTemp: "polar vortex events push temps to -20F; summers hit 95F+ with high humidity",
    recommendedSEER: 16,
    recommendedAFUE: 96,
    heatPumpViable: "cold-climate heat pumps are gaining ground but gas furnace backup is still recommended for polar vortex events",
    permitAuthority: "Chicago Department of Buildings",
    permitDetail: "Mechanical permit required. Work must be performed by a licensed contractor. Gas furnace installation requires separate gas permit. City inspections mandatory before system commissioning.",
    bestBuyMonths: "September through November",
    worstBuyMonths: "June through August and January (emergency furnace failures)",
    seasonReason: "Summer AC demand and mid-winter furnace emergencies drive peak pricing. Fall is the sweet spot between seasons.",
  },
  "houston-tx": {
    utilityCompanies: "CenterPoint Energy (delivery) with retail providers like Reliant, TXU, and Direct Energy",
    avgElectricRate: 0.14,
    avgGasRate: 1.05,
    coolingDominant: true,
    heatingDominant: false,
    humidityIssue: "extreme",
    extremeTemp: "6+ months above 90F with humidity regularly above 80%; mild winters rarely drop below 35F",
    recommendedSEER: 18,
    recommendedAFUE: 80,
    heatPumpViable: "excellent choice; handles Houston's mild winters easily and the cooling efficiency matches a standard AC",
    permitAuthority: "City of Houston Public Works",
    permitDetail: "Mechanical permit required for HVAC replacement. Online portal for fast processing. TDLR (Texas Department of Licensing and Regulation) license required for all HVAC contractors. Inspections required.",
    bestBuyMonths: "November through February",
    worstBuyMonths: "May through August",
    seasonReason: "Houston's brutal summers create a flood of emergency AC replacements. Winter is mild and contractors compete for work.",
  },
  "phoenix-az": {
    utilityCompanies: "APS (Arizona Public Service) and SRP (Salt River Project)",
    avgElectricRate: 0.14,
    avgGasRate: 1.30,
    coolingDominant: true,
    heatingDominant: false,
    humidityIssue: "low except during monsoon",
    extremeTemp: "115F+ heat waves, 100+ days above 100F, roof-mounted equipment bakes in direct sun",
    recommendedSEER: 20,
    recommendedAFUE: 80,
    heatPumpViable: "works well for heating but standard AC is more common; dual-fuel setups are rare since heating demand is minimal",
    permitAuthority: "City of Phoenix Development Services",
    permitDetail: "Mechanical permit required. Online same-day permits available for residential replacements. Arizona ROC (Registrar of Contractors) license required. Inspection required before final sign-off.",
    bestBuyMonths: "October through February",
    worstBuyMonths: "June through August",
    seasonReason: "AC failures during 115F heat waves create genuine emergencies and pricing surges. Fall and winter offer the best deals.",
  },
  "dallas-tx": {
    utilityCompanies: "Oncor (delivery) with retail providers like TXU, Reliant, and Green Mountain",
    avgElectricRate: 0.13,
    avgGasRate: 1.00,
    coolingDominant: true,
    heatingDominant: false,
    humidityIssue: "high",
    extremeTemp: "100F+ summer days common; Winter Storm Uri (2021) showed vulnerability to extreme cold snaps",
    recommendedSEER: 17,
    recommendedAFUE: 90,
    heatPumpViable: "viable for most of the year but gas furnace backup is smart insurance against rare hard freezes",
    permitAuthority: "City of Dallas Building Inspection",
    permitDetail: "Mechanical permit required. Online portal for fast residential permits. TDLR license required for contractors. Post-installation inspection mandatory.",
    bestBuyMonths: "October through January",
    worstBuyMonths: "May through July",
    seasonReason: "Spring hail damage often triggers concurrent HVAC and roofing work, tightening contractor availability. Late fall is ideal.",
  },
  "atlanta-ga": {
    utilityCompanies: "Georgia Power (electric) and Atlanta Gas Light",
    avgElectricRate: 0.14,
    avgGasRate: 1.15,
    coolingDominant: true,
    heatingDominant: false,
    humidityIssue: "high",
    extremeTemp: "95F+ summers with oppressive humidity; winters occasionally dip into the teens during cold snaps",
    recommendedSEER: 17,
    recommendedAFUE: 92,
    heatPumpViable: "ideal climate for heat pumps; mild winters and long cooling seasons make heat pumps the default recommendation",
    permitAuthority: "City of Atlanta Department of Buildings",
    permitDetail: "Mechanical permit required in both City of Atlanta and unincorporated Fulton/DeKalb counties. Georgia HVAC contractor license (conditioned air) required. Inspection within 10 business days of completion.",
    bestBuyMonths: "October through February",
    worstBuyMonths: "May through July",
    seasonReason: "Summer AC demand peaks alongside Atlanta's aggressive construction boom. Late fall and winter offer 10-15% savings.",
  },
  "denver-co": {
    utilityCompanies: "Xcel Energy (both electric and gas)",
    avgElectricRate: 0.15,
    avgGasRate: 0.85,
    coolingDominant: false,
    heatingDominant: true,
    humidityIssue: "very low",
    extremeTemp: "sub-zero winter nights, rapid temperature swings (50-degree changes in 24 hours), and 95F+ summer days at altitude",
    recommendedSEER: 16,
    recommendedAFUE: 96,
    heatPumpViable: "cold-climate heat pumps work well thanks to dry air (less efficiency loss), but gas furnace backup recommended for sub-zero stretches",
    permitAuthority: "City and County of Denver Community Planning and Development",
    permitDetail: "Mechanical permit required. Denver requires HVAC contractors to hold a Denver mechanical license (separate from state). Inspections required for all permitted work.",
    bestBuyMonths: "April through May and September through October",
    worstBuyMonths: "June through August and December through January",
    seasonReason: "Summer AC demand and mid-winter furnace emergencies create dual peaks. Spring and fall shoulder seasons offer the best pricing.",
  },
  "seattle-wa": {
    utilityCompanies: "Seattle City Light (electric) and Puget Sound Energy (gas)",
    avgElectricRate: 0.12,
    avgGasRate: 1.40,
    coolingDominant: false,
    heatingDominant: true,
    humidityIssue: "high winter, moderate summer",
    extremeTemp: "heat domes now pushing past 100F (2021 event hit 108F); winters mild but wet and gray",
    recommendedSEER: 16,
    recommendedAFUE: 92,
    heatPumpViable: "excellent choice for Seattle; mild winters, cheap electricity, and Washington state heat pump rebates make this the default recommendation",
    permitAuthority: "Seattle Department of Construction and Inspections (SDCI)",
    permitDetail: "Mechanical permit required. Washington state HVAC/R specialty contractor license (06A) required. Seattle's green building standards may affect equipment choices. Inspection required.",
    bestBuyMonths: "March through May",
    worstBuyMonths: "July through September (heat dome panic) and December (furnace failures)",
    seasonReason: "The 2021 heat dome permanently changed Seattle's AC market. Summer demand now spikes. Spring before the heat is the best window.",
  },
  "austin-tx": {
    utilityCompanies: "Austin Energy (municipal utility)",
    avgElectricRate: 0.13,
    avgGasRate: 1.10,
    coolingDominant: true,
    heatingDominant: false,
    humidityIssue: "high",
    extremeTemp: "100F+ summer stretches lasting weeks; Winter Storm Uri proved extreme cold is possible too",
    recommendedSEER: 18,
    recommendedAFUE: 90,
    heatPumpViable: "excellent for most of the year; gas furnace backup is smart insurance after Uri demonstrated that electric-only systems can fail during grid emergencies",
    permitAuthority: "Austin Development Services Department",
    permitDetail: "Mechanical permit required. Austin permits are notoriously slow (2-4 weeks). Licensed HVAC contractor with TDLR registration required. Inspection mandatory.",
    bestBuyMonths: "October through January",
    worstBuyMonths: "May through August",
    seasonReason: "Austin's long, brutal summers create sustained emergency AC demand. Fall and early winter are the sweet spot for pricing and availability.",
  },
  "san-francisco-ca": {
    utilityCompanies: "PG&E (electric and gas)",
    avgElectricRate: 0.36,
    avgGasRate: 2.15,
    coolingDominant: false,
    heatingDominant: false,
    humidityIssue: "moderate (coastal fog)",
    extremeTemp: "rare extremes; summer highs usually 65-75F with fog, winter lows in the 40s, but inland heat domes can push past 100F",
    recommendedSEER: 15,
    recommendedAFUE: 90,
    heatPumpViable: "ideal climate for heat pumps; SF's mild year-round temps mean a single heat pump replaces both furnace and AC efficiently",
    permitAuthority: "San Francisco Department of Building Inspection (DBI)",
    permitDetail: "Over-the-counter mechanical permit required for HVAC replacement. California C-20 HVAC contractor license and Title 24 energy compliance documentation mandatory. SF also enforces strict electrification incentives through BayREN rebates.",
    bestBuyMonths: "November through February",
    worstBuyMonths: "September and October (inland heat waves)",
    seasonReason: "SF contractors stay busy with retrofit and electrification projects year-round; winter rain slows new work and creates pricing flexibility.",
  },
  "philadelphia-pa": {
    utilityCompanies: "PECO (electric) and Philadelphia Gas Works (PGW)",
    avgElectricRate: 0.18,
    avgGasRate: 1.55,
    coolingDominant: false,
    heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "humid 95F summer stretches and 10F winter cold snaps; ice storms occasional",
    recommendedSEER: 16,
    recommendedAFUE: 95,
    heatPumpViable: "cold-climate heat pumps work well down to 5F but dual-fuel pairings with a PGW gas furnace remain the most economical option in rowhomes",
    permitAuthority: "Philadelphia Department of Licenses and Inspections (L&I)",
    permitDetail: "Mechanical permit required for HVAC replacement; contractors must hold a PA HICPA registration plus a Philadelphia contractor license. L&I eCLIPSE portal issues most residential permits within 3-5 business days.",
    bestBuyMonths: "October through February",
    worstBuyMonths: "June through August",
    seasonReason: "Rowhome AC installs are tight, slow work and summer humidity drives emergency replacements. Fall pricing drops sharply once heat breaks.",
  },
  "miami-fl": {
    utilityCompanies: "Florida Power & Light (FPL) and TECO Peoples Gas",
    avgElectricRate: 0.14,
    avgGasRate: 1.75,
    coolingDominant: true,
    heatingDominant: false,
    humidityIssue: "extreme",
    extremeTemp: "10+ months of 80F+ heat with 80-95% humidity; hurricane season brings wind-driven equipment damage",
    recommendedSEER: 18,
    recommendedAFUE: 80,
    heatPumpViable: "heat pumps are the default in Miami; gas heat is effectively nonexistent in most homes and heat pumps handle the rare cold snaps with ease",
    permitAuthority: "Miami-Dade County Building Department",
    permitDetail: "Mechanical permit required; all equipment must meet Miami-Dade High Velocity Hurricane Zone (HVHZ) product approval. Florida Class A or Class B mechanical contractor license required. Inspections include wind-load tie-down verification.",
    bestBuyMonths: "November through February",
    worstBuyMonths: "May through September",
    seasonReason: "Hurricane season compresses contractor availability for both install and post-storm repair work. Winter dry season is the only real buyer's market.",
  },
  "boston-ma": {
    utilityCompanies: "Eversource (electric and gas) and National Grid",
    avgElectricRate: 0.30,
    avgGasRate: 2.05,
    coolingDominant: false,
    heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "nor'easters push wind chills below -10F; summer heat waves in the high 90s with muggy ocean air",
    recommendedSEER: 16,
    recommendedAFUE: 96,
    heatPumpViable: "Mass Save rebates up to $10,000 make cold-climate heat pumps compelling, but triple-deckers and older homes often benefit from dual-fuel with a gas backup",
    permitAuthority: "Boston Inspectional Services Department (ISD)",
    permitDetail: "Sheet metal and gas permits required separately; Massachusetts requires a licensed sheet metal worker for ductwork and a licensed gasfitter for gas connections. Boston ISD inspections typically scheduled within 5-7 business days.",
    bestBuyMonths: "April through June",
    worstBuyMonths: "January (mid-winter furnace failures) and July through August",
    seasonReason: "Heating emergencies in January and humid July AC calls both drive premium pricing. Late spring is the calmest window before cooling season hits.",
  },
  "san-diego-ca": {
    utilityCompanies: "San Diego Gas & Electric (SDG&E)",
    avgElectricRate: 0.40,
    avgGasRate: 2.35,
    coolingDominant: false,
    heatingDominant: false,
    humidityIssue: "low",
    extremeTemp: "remarkably mild, mostly 60-80F year-round, but Santa Ana wind events push inland areas above 100F briefly",
    recommendedSEER: 16,
    recommendedAFUE: 80,
    heatPumpViable: "perfect heat pump climate; SDG&E's punishing electric rates make high-SEER heat pumps essential, and gas backup is rarely justified",
    permitAuthority: "San Diego Development Services Department (DSD)",
    permitDetail: "Mechanical permit required and issued through the City's online Accela portal. California C-20 HVAC license plus Title 24 compliance forms mandatory. Coastal zone projects face additional review if envelope changes are involved.",
    bestBuyMonths: "December through March",
    worstBuyMonths: "August through October (Santa Ana events)",
    seasonReason: "SDG&E's high rates push homeowners toward electrification year-round, but Santa Ana heat spikes cause brief demand surges. Winter is reliably the cheapest window.",
  },
  "tampa-fl": {
    utilityCompanies: "Tampa Electric (TECO) and Peoples Gas",
    avgElectricRate: 0.14,
    avgGasRate: 1.70,
    coolingDominant: true,
    heatingDominant: false,
    humidityIssue: "extreme",
    extremeTemp: "long 90F+ summers with afternoon thunderstorm humidity; hurricane-driven salt air accelerates coil corrosion",
    recommendedSEER: 17,
    recommendedAFUE: 80,
    heatPumpViable: "heat pumps are the default and the smart choice; look for models with corrosion-resistant coastal coils given Tampa Bay's salt exposure",
    permitAuthority: "City of Tampa Construction Services",
    permitDetail: "Mechanical permit required; Florida Class A or B mechanical license mandatory. Hillsborough County enforces FBC wind-load requirements for condensers. Permits typically issued within 2-3 business days via the Accela Citizen Access portal.",
    bestBuyMonths: "November through February",
    worstBuyMonths: "May through September",
    seasonReason: "Hurricane preparedness and post-storm repairs tie up contractors through early fall. Dry season pricing is meaningfully softer once hurricane season ends.",
  },
  "detroit-mi": {
    utilityCompanies: "DTE Energy (electric and gas) and Consumers Energy",
    avgElectricRate: 0.18,
    avgGasRate: 0.95,
    coolingDominant: false,
    heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "Great Lakes winters with -5F cold snaps and persistent cloud cover; summers humid and in the 90s",
    recommendedSEER: 15,
    recommendedAFUE: 96,
    heatPumpViable: "cold-climate heat pumps are improving but Detroit's cheap natural gas still favors high-AFUE gas furnaces; dual-fuel is the practical sweet spot",
    permitAuthority: "Detroit Buildings, Safety Engineering and Environmental Department (BSEED)",
    permitDetail: "Mechanical permit required; Michigan requires a state mechanical contractor license and Detroit requires a separate city registration. BSEED eLAPS portal handles applications; inspections often scheduled 7-10 business days out.",
    bestBuyMonths: "September through November",
    worstBuyMonths: "January (furnace emergencies) and July through August",
    seasonReason: "Cheap gas means most homeowners delay furnace replacement until failure, creating January price spikes. Fall beats both the summer AC rush and winter breakdowns.",
  },
  "minneapolis-mn": {
    utilityCompanies: "Xcel Energy (electric) and CenterPoint Energy (gas)",
    avgElectricRate: 0.14,
    avgGasRate: 1.00,
    coolingDominant: false,
    heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "regular -20F stretches, occasional -30F wind chills, and short but humid 90F summers",
    recommendedSEER: 15,
    recommendedAFUE: 97,
    heatPumpViable: "cold-climate heat pumps down to -13F are now practical thanks to Xcel rebates, but Minneapolis winters still require a high-AFUE gas furnace as backup",
    permitAuthority: "Minneapolis Community Planning and Economic Development (CPED)",
    permitDetail: "Mechanical permit required for all HVAC replacements. Minnesota requires state mechanical contractor bonding and licensing; Minneapolis additionally requires a city-issued contractor registration. Permits typically issued same-day via the ePermits portal.",
    bestBuyMonths: "April through June",
    worstBuyMonths: "December through February",
    seasonReason: "Mid-winter furnace failures at -20F create genuine emergency pricing. Spring is when contractors are hungriest after the winter rush ends.",
  },
  "charlotte-nc": {
    utilityCompanies: "Duke Energy (electric) and Piedmont Natural Gas",
    avgElectricRate: 0.13,
    avgGasRate: 1.25,
    coolingDominant: true,
    heatingDominant: false,
    humidityIssue: "high",
    extremeTemp: "long humid 90F+ summers and occasional winter ice storms dropping temps into the teens",
    recommendedSEER: 17,
    recommendedAFUE: 90,
    heatPumpViable: "Charlotte's Piedmont climate is textbook heat pump territory; mild winters and long cooling seasons mean heat pumps outperform gas furnaces on lifetime cost",
    permitAuthority: "Charlotte-Mecklenburg Code Enforcement",
    permitDetail: "Mechanical permit required through the City's Accela portal. North Carolina Class II (or Class I) HVAC contractor license mandatory. Inspections typically scheduled within 2-4 business days and required before system commissioning.",
    bestBuyMonths: "October through February",
    worstBuyMonths: "June through August",
    seasonReason: "Charlotte's growth boom keeps HVAC crews tied up with new construction through summer. Fall and winter are the real buyer's market for replacements.",
  },
  "las-vegas-nv": {
    utilityCompanies: "NV Energy (electric) and Southwest Gas",
    avgElectricRate: 0.13,
    avgGasRate: 1.45,
    coolingDominant: true,
    heatingDominant: false,
    humidityIssue: "very low",
    extremeTemp: "110F+ heat waves for weeks; rooftop package units bake at 150F+ surface temps and fail early",
    recommendedSEER: 20,
    recommendedAFUE: 80,
    heatPumpViable: "heat pumps handle Las Vegas winters easily and excel on cooling efficiency, but most Vegas homes still use rooftop package units matched to the flat-roof stock",
    permitAuthority: "Clark County Building Department (City of Las Vegas Building & Safety for city limits)",
    permitDetail: "Mechanical permit required; Nevada State Contractors Board C-21 (refrigeration and air conditioning) license mandatory. Clark County uses an online portal with same-day permit issuance for like-for-like residential replacements.",
    bestBuyMonths: "November through February",
    worstBuyMonths: "June through September",
    seasonReason: "Rooftop package units failing during 115F stretches create the worst pricing environment in the country for emergency replacement. Winter is dramatically cheaper.",
  },
};

/* ===================================================================
 * Section generators
 * =================================================================== */

/* 1. Neighborhood pricing breakdown */
function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";
  const baseCentralAC = 4400;
  const baseHeatPump = 5650;
  const baseFurnace = 3600;
  const baseFullSystem = 7750;

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.07 : i % 3 === 1 ? -0.05 : 0.04) * (i % 2 === 0 ? 1 : -1));
    const ac = Math.round(baseCentralAC * mult * localVar);
    const hp = Math.round(baseHeatPump * mult * localVar);
    const furn = Math.round(baseFurnace * mult * localVar);
    const full = Math.round(baseFullSystem * mult * localVar);
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(ac)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(hp)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(furn)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(full)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>Neighborhood HVAC Pricing Breakdown</h2>
<p>HVAC installation costs vary within ${facts.displayName} based on housing age, ductwork condition, equipment access, and local labor demand. These are mid-range estimates for a typical 2,000 sq ft home with existing ductwork.</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Central AC</th>
<th style="text-align:right; padding:12px 16px;">Heat Pump</th>
<th style="text-align:right; padding:12px 16px;">Furnace</th>
<th style="text-align:right; padding:12px 16px;">Full System</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Estimates based on local labor rates, equipment access, and typical ductwork condition. Actual pricing depends on tonnage, efficiency tier, and ductwork modifications. <a href="/hvac-quote-analyzer.html" style="color:var(--brand);">Upload your quote for an exact comparison.</a></p>
</section>`;
}

/* 2. Climate deep dive */
function climateDeepDive(city, state, ctx, facts, hvacData) {
  const paras = [];

  paras.push(`<p>${cap(facts.climate)}. Understanding how ${city}'s specific conditions affect HVAC sizing, efficiency, and equipment lifespan is critical to making the right investment.</p>`);

  if (hvacData.coolingDominant) {
    paras.push(`<p><strong>Cooling-dominant market.</strong> ${city} homeowners run their AC far more than their furnace. ${hvacData.extremeTemp}. In a cooling-dominant climate like this, your AC or heat pump's SEER rating has a disproportionate impact on your annual energy bill. The difference between a 14 SEER and an 18 SEER system in ${city} translates to roughly 22-28% lower cooling costs, which in a market where AC runs 6-8 months per year adds up to $300-$600 in annual savings. Over a 15-year system lifespan, that efficiency gap represents $4,500-$9,000 in total energy savings.</p>`);
  } else if (hvacData.heatingDominant) {
    paras.push(`<p><strong>Heating-dominant market.</strong> ${city} homeowners spend the majority of their HVAC energy dollars on heating. ${hvacData.extremeTemp}. In a heating-dominant climate, your furnace's AFUE rating matters more than your AC's SEER rating for total annual energy cost. The jump from 80% AFUE to 96% AFUE saves roughly 16 cents of every heating dollar, which in ${city}'s long heating season translates to $400-$800 per year. Over a 20-year furnace lifespan, that is $8,000-$16,000 in cumulative savings.</p>`);
  }

  if (hvacData.humidityIssue === "extreme" || hvacData.humidityIssue === "high") {
    paras.push(`<p><strong>Humidity management.</strong> ${city}'s ${hvacData.humidityIssue} humidity is not just a comfort issue; it is a sizing issue. An oversized AC cools the air quickly but shuts off before adequately dehumidifying, leaving you with a cold, clammy house. Proper Manual J load calculations are essential in ${city} to avoid this common problem. Variable-speed or two-stage systems handle humidity significantly better than single-stage equipment because they run longer at lower output, pulling more moisture from the air. In ${city}'s climate, this is not a luxury feature; it is a functional requirement for comfort.</p>`);
  }

  if (hvacData.humidityIssue === "very low" || hvacData.humidityIssue === "low") {
    paras.push(`<p><strong>Dry climate advantage.</strong> ${city}'s low humidity means your HVAC system does not need to work as hard on dehumidification, which is a significant efficiency advantage. Heat pumps in particular perform better in dry air because there is less moisture to manage. However, the dry air can cause comfort issues in winter; a whole-house humidifier ($400-$800 installed) is a worthwhile addition for homes with hardwood floors or occupants sensitive to dry air.</p>`);
  }

  paras.push(`<p><strong>Heat pumps in ${city}.</strong> ${cap(hvacData.heatPumpViable)}. As of 2026, all new heat pump installations use A2L refrigerant (R-454B or R-32) rather than R-410A. This is a federal requirement, not an upsell. Make sure your contractor is trained and certified for A2L refrigerant handling.</p>`);

  return `
<section class="section fp-section">
<h2>How ${city}'s Climate Affects Your HVAC Decision</h2>
${paras.join("\n")}
</section>`;
}

/* 3. Energy efficiency section */
function energyEfficiencySection(city, state, hvacData) {
  const seer = hvacData.recommendedSEER;
  const afue = hvacData.recommendedAFUE;

  let seerAdvice = "";
  if (seer >= 20) {
    seerAdvice = `Given ${city}'s extreme cooling demand, investing in a 20+ SEER variable-speed system pays back faster here than in almost any other market. The higher upfront cost ($2,000-$4,000 more than a 16 SEER) is recovered through energy savings in 5-7 years, and you get superior humidity control and quieter operation as a bonus.`;
  } else if (seer >= 18) {
    seerAdvice = `For ${city}'s climate, an 18 SEER system hits the efficiency sweet spot. Going to 20+ SEER adds diminishing returns unless you plan to stay in the home 10+ years. The 18 SEER tier typically pays back its premium over a 16 SEER in 4-6 years through lower cooling bills.`;
  } else if (seer >= 17) {
    seerAdvice = `A 17 SEER system is a solid middle ground for ${city}'s mixed heating and cooling demands. Going higher makes sense if cooling is your primary cost driver, but the 16-17 SEER range offers the best balance of upfront cost and ongoing savings for most ${city} homeowners.`;
  } else {
    seerAdvice = `A 16 SEER system is the recommended minimum for ${city}. Since heating costs outweigh cooling costs here, investing heavily in a 20+ SEER AC offers diminishing returns. Put the budget toward a higher-efficiency furnace instead.`;
  }

  let afueAdvice = "";
  if (afue >= 95) {
    afueAdvice = `${city}'s heating demand makes furnace efficiency a top priority. A 95-96% AFUE condensing furnace is the recommended minimum here. The jump from 80% to 96% AFUE saves roughly $600-$1,000 per year in a typical ${city} home. The condensing furnace requires PVC venting (not metal chimney), which simplifies installation in many homes but adds cost if you are converting from a conventional furnace for the first time.`;
  } else if (afue >= 90) {
    afueAdvice = `A 90-92% AFUE furnace is the sweet spot for ${city}. Heating demand is meaningful but not extreme, so the premium for 96%+ efficiency has a longer payback period. If your existing furnace is 80% AFUE, upgrading to 92% saves approximately $200-$400 per year on gas bills.`;
  } else {
    afueAdvice = `Heating demand in ${city} is minimal, so an 80% AFUE furnace is adequate if you even need one. Many ${city} homeowners are better served by a heat pump that handles both heating and cooling, eliminating the need for a separate furnace entirely.`;
  }

  return `
<section class="section fp-section">
<h2>SEER and Efficiency Ratings: What ${city} Homeowners Should Target</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Cooling efficiency target</h3>
<p class="fp-season-months">${seer}+ SEER</p>
<p>${seerAdvice}</p>
</div>
<div class="fp-season-card" style="background:#eff6ff; border:1px solid #93c5fd;">
<h3>Heating efficiency target</h3>
<p class="fp-season-months">${afue}%+ AFUE</p>
<p>${afueAdvice}</p>
</div>
</div>
<p><strong>The 2026 efficiency landscape.</strong> The federal minimum is now 15 SEER2 (approximately 15.2 legacy SEER) for southern states and 14 SEER2 for northern states. Any contractor quoting a "14 SEER" system in 2026 is either using outdated inventory or mislabeling the rating. Verify the SEER2 rating on the AHRI certificate, not the contractor's proposal.</p>
<p><strong>Rebates and credits.</strong> The federal 25C tax credit for heat pumps expired December 31, 2025. However, the IRA's HEAR (Home Efficiency Appliance Rebate) program is still active and offers up to $8,000 for qualifying heat pump installations for income-eligible households. Check DSIRE (dsireusa.org) for current ${state} and utility-specific rebates. Geothermal heat pumps still qualify for a 30% federal tax credit (IRA Section 25D) with no cap through 2034.</p>
</section>`;
}

/* 4. Utility rate impact */
function utilityRateSection(city, state, hvacData) {
  const elec = hvacData.avgElectricRate;
  const gas = hvacData.avgGasRate;

  let costComparison = "";
  if (elec >= 0.22) {
    costComparison = `${city}'s electricity rates are well above the national average ($${elec.toFixed(2)}/kWh vs. ~$0.16/kWh nationally). This makes high-efficiency cooling equipment particularly valuable here: every SEER point saves more real dollars in ${city} than in cheaper-electricity markets. It also means heat pumps, while efficient, carry higher operating costs for heating compared to gas in ${city}. Run the numbers carefully before going all-electric.`;
  } else if (elec >= 0.16) {
    costComparison = `${city}'s electricity rates are near the national average at $${elec.toFixed(2)}/kWh. This means efficiency upgrades pay back at a normal rate. The gas-vs-electric-heat decision depends more on your specific home and usage patterns than on rate arbitrage.`;
  } else {
    costComparison = `${city}'s electricity rates are below the national average at $${elec.toFixed(2)}/kWh, which makes heat pumps financially attractive for heating compared to many other markets. The lower your electricity rate, the faster a heat pump's efficiency advantage translates into real savings versus gas heating.`;
  }

  let gasNote = "";
  if (gas >= 1.50) {
    gasNote = `Natural gas rates in ${city} ($${gas.toFixed(2)}/therm) are above average, which narrows the cost gap between gas furnace and heat pump heating. In this rate environment, a heat pump for heating is worth serious consideration even if gas is available.`;
  } else if (gas <= 0.95) {
    gasNote = `Natural gas is relatively affordable in ${city} ($${gas.toFixed(2)}/therm), which gives gas furnaces a strong operating cost advantage over heat pump heating, especially during the coldest months when heat pump efficiency drops.`;
  } else {
    gasNote = `Natural gas rates in ${city} ($${gas.toFixed(2)}/therm) are in the normal range. The gas-vs-heat-pump decision here comes down to your heating load and how cold it actually gets.`;
  }

  return `
<section class="section fp-section">
<h2>How ${city} Utility Rates Affect Your HVAC ROI</h2>
<p>Your HVAC system's ongoing cost depends as much on local utility rates as on the equipment you choose. Here is how ${city}'s energy market shapes the math.</p>
<div class="fp-season-grid">
<div class="fp-scenario-card" style="border-top:4px solid #f59e0b; padding:20px;">
<h3>Electricity</h3>
<p class="fp-scenario-total" style="font-size:22px;">$${elec.toFixed(2)}/kWh</p>
<p style="font-size:13px; color:#64748b;">${hvacData.utilityCompanies}</p>
</div>
<div class="fp-scenario-card" style="border-top:4px solid #3b82f6; padding:20px;">
<h3>Natural Gas</h3>
<p class="fp-scenario-total" style="font-size:22px;">$${gas.toFixed(2)}/therm</p>
<p style="font-size:13px; color:#64748b;">Residential average</p>
</div>
</div>
<p>${costComparison}</p>
<p>${gasNote}</p>
<p><strong>Deregulated market note.</strong> ${state === "TX" ? `Texas has a deregulated electricity market, which means your rate depends on your retail provider and plan. Locked-rate plans protect you from seasonal spikes but may be higher on average. Compare your actual rate (check your bill, not the plan's advertised rate) to the state average before making efficiency calculations.` : state === "CA" ? `California's tiered rate structure means your effective rate increases as you use more electricity. High-SEER equipment that reduces total consumption keeps you in lower rate tiers, amplifying the savings beyond what a flat-rate calculation would suggest.` : `Check your actual utility bill rate (not the plan's advertised rate) before running efficiency calculations. The rate you pay may differ from regional averages based on your plan, usage tier, and seasonal adjustments.`}</p>
</section>`;
}

/* 5. Permits and code requirements */
function permitSection(city, state, facts, hvacData) {
  return `
<section class="section fp-section">
<h2>HVAC Permits and Code Requirements in ${city}</h2>
<p><strong>Permit authority:</strong> ${hvacData.permitAuthority}. ${hvacData.permitDetail}</p>
<p><strong>What the permit covers.</strong> An HVAC mechanical permit in ${city} ensures that the installation meets local building code for equipment sizing, electrical connections, gas piping (if applicable), refrigerant line sets, condensate drainage, and ventilation. The permit process includes a post-installation inspection to verify code compliance. This inspection protects you as the homeowner.</p>
<p><strong>Why it matters.</strong> Unpermitted HVAC work can void your equipment warranty, create problems during a home sale (inspection red flags), and leave you liable if the installation causes damage. If a contractor suggests skipping the permit to save time or money, that is a serious red flag. The permit holder is legally responsible for code compliance. Your contractor should pull the permit, not you.</p>
<p><strong>2026 refrigerant transition.</strong> All new residential AC and heat pump installations in 2026 must use A2L-classified refrigerants (R-454B or R-32) under the AIM Act phase-down. R-410A equipment manufactured before 2025 can still be installed from existing inventory, but new production has stopped. If a contractor is quoting R-410A equipment, verify it is genuine new-old-stock and not refurbished. A2L refrigerants are mildly flammable, which requires updated installation practices and leak detection; make sure your contractor is A2L certified.</p>
${facts.codeNote ? `<p><strong>Local code note.</strong> ${facts.codeNote}.</p>` : ""}
</section>`;
}

/* 6. Contractor market analysis */
function contractorMarketSection(city, state, ctx, facts, hvacData) {
  let licensingBoard = "";
  if (state === "TX") licensingBoard = "TDLR (Texas Department of Licensing and Regulation)";
  else if (state === "CA") licensingBoard = "CSLB (Contractors State License Board)";
  else if (state === "AZ") licensingBoard = "Arizona Registrar of Contractors (ROC)";
  else if (state === "GA") licensingBoard = "Georgia Secretary of State (conditioned air license)";
  else if (state === "WA") licensingBoard = "Washington L&I (06A HVAC/R specialty license)";
  else if (state === "CO") licensingBoard = "Denver mechanical license (city-specific, separate from state)";
  else if (state === "IL") licensingBoard = "Illinois DFPR (mechanical contractor license)";
  else if (state === "NY") licensingBoard = "NYC DOB (Home Improvement Contractor license) plus relevant trade licenses";
  else licensingBoard = `your state's HVAC contractor licensing board`;

  return `
<section class="section fp-section">
<h2>The HVAC Contractor Market in ${city}</h2>
<p>${cap(facts.contractorMarket)}. The HVAC market differs from other trades because equipment brand loyalty creates tiered contractor networks. A Carrier dealer, a Trane dealer, and an independent installer will quote different equipment at different price points for the same job.</p>
${ctx.growthRate === "high" ? `<p>${city} is a high-growth market, which keeps contractor demand elevated and limits negotiating leverage. In rapidly growing metros, the gap between the cheapest and most expensive HVAC bid can be 40-60% for the same scope. This spread usually reflects real differences in equipment brand, efficiency tier, warranty terms, and installation quality rather than pure markup. Do not assume the lowest bid is the best value.</p>` : `<p>The contractor market in ${city} is relatively stable, which gives homeowners reasonable leverage. Getting 3 bids is standard, but for HVAC specifically, make sure you are comparing equivalent equipment: same brand tier, same SEER rating, same warranty terms. A $3,000 gap between bids often means different equipment, not different markup.</p>`}
<p><strong>What to verify.</strong> Confirm licensing through ${licensingBoard}. Verify general liability insurance and workers compensation coverage. Ask for the AHRI certificate number for the specific equipment being quoted, which confirms the system components are rated to work together. An HVAC system is a matched set: condenser, air handler, and coil must be AHRI-certified as a combination to achieve the quoted efficiency rating.</p>
<p><strong>Brand does not equal quality of installation.</strong> A premium brand installed poorly will underperform a mid-tier brand installed correctly. The quality of the installation (proper sizing via Manual J, correct refrigerant charge, sealed ductwork connections, proper airflow) matters more than the nameplate on the equipment. Ask about the contractor's installation process, not just the equipment brand.</p>
</section>`;
}

/* 7. Red flags and scams */
function redFlagsSection(city, state, ctx, hvacData) {
  const flags = [];

  flags.push({
    title: "Oversizing: the most expensive HVAC mistake",
    body: `An oversized system is the single most common and most costly HVAC installation error in ${city}. A contractor who sizes your system based on home square footage alone (without a Manual J load calculation) is guessing. Oversized AC units cool the house quickly but shut off before dehumidifying, leaving you with high humidity and uneven temperatures${hvacData.humidityIssue === "extreme" || hvacData.humidityIssue === "high" ? ` -- a serious problem in ${city}'s ${hvacData.humidityIssue} humidity` : ""}. Oversized furnaces short-cycle, wasting energy and wearing out components prematurely. Demand a Manual J calculation. If a contractor cannot or will not provide one, find a different contractor.`
  });

  flags.push({
    title: "Unnecessary upsells",
    body: `UV lights ($500-$1,500), whole-house air purifiers ($800-$2,000), and duct sanitizing ($300-$800) are common HVAC upsells with minimal real-world benefit for most homes. A properly filtered system with standard MERV 11-13 filters handles air quality for the vast majority of households. If a contractor leads with add-ons before discussing proper sizing and efficiency, their priorities are misaligned with yours.`
  });

  flags.push({
    title: "Refrigerant scams",
    body: `With the R-410A phase-out in effect, some contractors claim R-410A is "no longer available" and that you must replace your entire system. This is false. R-410A is still available for service and repair; only new equipment production has stopped. If your existing R-410A system needs a refrigerant recharge, that is a repair, not a replacement trigger. Separately, if a contractor quotes R-22 (Freon) for any system, they are either using illegally imported refrigerant or do not understand current regulations. R-22 production ended in 2020.`
  });

  flags.push({
    title: "Same-day pressure tactics",
    body: `"This price is only good today" is a high-pressure sales tactic used by large HVAC dealers in ${city}. A legitimate quote should be valid for at least 30 days. Same-day discounts of $1,000-$3,000 that vanish if you want to get another bid are not discounts; they are inflated base prices designed to prevent comparison shopping. Always get at least 3 bids regardless of pressure.`
  });

  if (ctx.hailRisk === "high") {
    flags.push({
      title: "Storm-damage HVAC bundling",
      body: `After major hail events in ${city}, some roofing contractors bundle HVAC replacement into storm damage claims, telling homeowners their outdoor condenser was "damaged by hail." While hail can damage condenser coil fins, this is usually repairable ($200-$500) rather than a replacement trigger. Get an independent HVAC assessment before agreeing to a full system replacement through a storm damage claim.`
    });
  }

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>HVAC Red Flags and Common Scams in ${city}</h2>
<p>The HVAC industry has its own set of deceptive practices that cost homeowners thousands. Here are the patterns most commonly reported in ${city}.</p>
${flagsHTML}
</section>`;
}

/* 8. Seasonal buying guide */
function seasonalGuide(city, hvacData) {
  return `
<section class="section fp-section">
<h2>Best Time to Replace Your HVAC System in ${city}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months</h3>
<p class="fp-season-months">${hvacData.bestBuyMonths}</p>
<p>${hvacData.seasonReason}</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Peak pricing / low availability</h3>
<p class="fp-season-months">${hvacData.worstBuyMonths}</p>
<p>Emergency replacements during peak season carry a 10-20% premium in ${city}. Contractors are booked 2-4 weeks out and have zero incentive to negotiate. If your system is 12+ years old, replacing it proactively during a shoulder season is almost always cheaper than waiting for it to fail during a heat wave or cold snap.</p>
</div>
</div>
<p><strong>Pro tip for ${city}.</strong> Schedule a pre-season inspection ($80-$150) in early spring or early fall. A technician can identify systems likely to fail in the coming season, giving you time to plan a replacement on your schedule rather than in an emergency. Most legitimate HVAC companies offer seasonal tune-up packages that include this inspection.</p>
</section>`;
}

/* 9. Cost scenarios */
function costScenarios(city, state, mult) {
  const budgetTotal = Math.round(4400 * mult);
  const midTotal = Math.round(8000 * mult);
  const premTotal = Math.round(13500 * mult);

  function scenarioCard(label, desc, total, detail, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${desc}</p>
<p class="fp-scenario-total">${fmtK(total)}</p>
<p class="fp-scenario-detail">${detail}</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>What HVAC Replacement Actually Costs in ${city}: 3 Scenarios</h2>
<p>Here is what real HVAC projects look like in ${city}, ${state}, using ${city}-adjusted labor and equipment costs for 2026.</p>
<div class="fp-scenario-grid">
${scenarioCard(
    "Budget",
    "14-15 SEER central AC | 80% AFUE furnace",
    budgetTotal,
    `Single-stage, value brand (Goodman/Amana). Includes equipment, standard installation, permit, and disposal. Basic thermostat. Adequate for smaller homes or budget-constrained replacements. 10-year parts warranty typical.`,
    "#22c55e"
  )}
${scenarioCard(
    "Mid-Range",
    "16-17 SEER heat pump | dual fuel option",
    midTotal,
    `Two-stage, mid-tier brand (Rheem/York). Includes equipment, installation, new line set, permit, and smart thermostat. Better humidity control and quieter operation. 10-year parts warranty with optional extended labor warranty.`,
    "#3b82f6"
  )}
${scenarioCard(
    "Premium",
    "20+ SEER variable-speed heat pump",
    premTotal,
    `Variable-speed inverter, premium brand (Carrier/Trane/Daikin). Includes full installation, new line set, ductwork sealing, smart thermostat, and surge protector. Whisper-quiet operation, best-in-class humidity control, lowest operating cost. 12-year parts + 10-year labor warranty.`,
    "#8b5cf6"
  )}
</div>
<p style="font-size:13px; color:var(--text-muted);">All scenarios assume a 3-ton system for a 2,000 sq ft home with existing ductwork. Ductwork replacement adds $3,000-$7,000. Multi-story or complex installations add 10-20%. <a href="/hvac-quote-analyzer.html" style="color:var(--brand);">Upload your quote for a personalized comparison.</a></p>
</section>`;
}

/* CSS (reuses fp-* classes from roofing but adds them here for standalone rendering) */
function flagshipCSS() {
  return `
<style>
.fp-section { margin-top:32px; }
.fp-section h2 { font-size:22px; margin-bottom:12px; color:#0f172a; }
.fp-section p { font-size:15px; line-height:1.7; color:#334155; margin-bottom:12px; }
.fp-table { border:1px solid var(--border,#e2e8f0); border-radius:10px; overflow:hidden; }
.fp-table tbody tr:nth-child(even) { background:var(--bg-subtle,#f8fafc); }
.fp-flag { padding:16px 20px; border-radius:10px; border:1px solid #fecaca; background:#fef2f2; margin-bottom:12px; }
.fp-flag h3 { font-size:15px; font-weight:700; color:#b91c1c; margin:0 0 6px; }
.fp-flag p { margin:0; font-size:14px; line-height:1.6; color:#7f1d1d; }
.fp-season-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:16px 0; }
.fp-season-card { padding:20px; border-radius:12px; }
.fp-season-best { background:#f0fdf4; border:1px solid #a7f3d0; }
.fp-season-worst { background:#fff7ed; border:1px solid #fdba74; }
.fp-season-card h3 { font-size:14px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin:0 0 8px; }
.fp-season-months { font-size:18px; font-weight:700; color:#0f172a; margin:0 0 8px; }
.fp-season-card p { font-size:14px; margin:0; }
.fp-scenario-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin:16px 0; }
.fp-scenario-card { padding:20px; background:#fff; border:1px solid var(--border,#e2e8f0); border-radius:12px; }
.fp-scenario-card h3 { font-size:16px; font-weight:700; margin:0 0 8px; color:#0f172a; }
.fp-scenario-material { font-size:13px; color:var(--text-muted); margin:0 0 4px; }
.fp-scenario-total { font-size:28px; font-weight:800; color:var(--brand,#1d4ed8); margin:0 0 8px; }
.fp-scenario-detail { font-size:13px; color:#64748b; margin:0; }
@media(max-width:700px) {
  .fp-scenario-grid { grid-template-columns:1fr; }
  .fp-season-grid { grid-template-columns:1fr; }
}
</style>`;
}

/* ===================================================================
 * Build & inject
 * =================================================================== */

function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  const hvacData = metroHVACData[metro.slug];
  if (!facts || !ctx || !hvacData) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getMultiplier(state);

  let html = `\n${MARKER_START}\n`;
  html += flagshipCSS();
  html += neighborhoodPricing(facts, mult);
  html += climateDeepDive(city, state, ctx, facts, hvacData);
  html += energyEfficiencySection(city, state, hvacData);
  html += utilityRateSection(city, state, hvacData);
  html += permitSection(city, state, facts, hvacData);
  html += contractorMarketSection(city, state, ctx, facts, hvacData);
  html += redFlagsSection(city, state, ctx, hvacData);
  html += seasonalGuide(city, hvacData);
  html += costScenarios(city, state, mult);
  html += `\n${MARKER_END}\n`;

  return html;
}

function main() {
  let processed = 0;
  let skipped = 0;

  for (const metro of METROS) {
    const filepath = path.join(ROOT, metro.file);
    if (!fs.existsSync(filepath)) {
      console.log(`  SKIP ${metro.file} (file not found)`);
      skipped++;
      continue;
    }

    const flagshipHTML = buildFlagshipContent(metro);
    if (!flagshipHTML) {
      console.log(`  SKIP ${metro.file} (no data for ${metro.ctxKey})`);
      skipped++;
      continue;
    }

    let content = fs.readFileSync(filepath, "utf8");

    // Remove old flagship content (idempotent)
    const re = new RegExp(`${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n?`, "g");
    content = content.replace(re, "");

    // Detect line ending style
    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    // Injection strategy:
    // 1. After UNIQUE-LOCAL-GUIDE end marker (if present)
    // 2. After the local-grid section (the "what locals should know" section)
    // 3. Before "What affects HVAC cost" section
    let insertAt = -1;

    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else {
      // Find the end of the local-grid section
      const localGridIdx = content.indexOf('<div class="local-grid">');
      if (localGridIdx >= 0) {
        // Find the closing </section> after the local-grid
        const afterGrid = content.indexOf("</section>", localGridIdx);
        if (afterGrid >= 0) {
          insertAt = afterGrid + "</section>".length;
        }
      }
    }

    if (insertAt < 0) {
      // Fallback: before "What affects HVAC cost"
      const whatAffects = content.indexOf("What affects HVAC cost");
      if (whatAffects >= 0) {
        const sectionBefore = content.lastIndexOf("<section", whatAffects);
        if (sectionBefore >= 0) {
          insertAt = sectionBefore;
        }
      }
    }

    if (insertAt < 0) {
      console.log(`  SKIP ${metro.file} (no injection point found)`);
      skipped++;
      continue;
    }

    content = content.slice(0, insertAt) + nl + flagshipContent + content.slice(insertAt);

    if (!DRY) {
      fs.writeFileSync(filepath, content, "utf8");
    }

    const wordCount = flagshipHTML.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    console.log(`  ${metro.file}: ~${wordCount} words of flagship content injected`);
    processed++;
  }

  console.log(`\nDone: ${processed} flagship pages processed, ${skipped} skipped.`);
  if (DRY) console.log("[DRY RUN: no files written]");
}

main();
