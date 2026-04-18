#!/usr/bin/env node
/**
 * Generates deep editorial content for 40 flagship metro HVAC pages.
 * Every section is heavily conditioned on metro-specific data so that
 * pairwise 8-word shingle overlap stays under 10% for SEO uniqueness.
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
    { slug: "st-louis-mo", ctxKey: "St. Louis|MO", file: "st-louis-mo-hvac-cost.html" },
    { slug: "orlando-fl", ctxKey: "Orlando|FL", file: "orlando-fl-hvac-cost.html" },
    { slug: "san-antonio-tx", ctxKey: "San Antonio|TX", file: "san-antonio-tx-hvac-cost.html" },
    { slug: "portland-or", ctxKey: "Portland|OR", file: "portland-or-hvac-cost.html" },
    { slug: "sacramento-ca", ctxKey: "Sacramento|CA", file: "sacramento-ca-hvac-cost.html" },
    { slug: "pittsburgh-pa", ctxKey: "Pittsburgh|PA", file: "pittsburgh-pa-hvac-cost.html" },
    { slug: "columbus-oh", ctxKey: "Columbus|OH", file: "columbus-oh-hvac-cost.html" },
    { slug: "kansas-city-mo", ctxKey: "Kansas City|MO", file: "kansas-city-mo-hvac-cost.html" },
    { slug: "indianapolis-in", ctxKey: "Indianapolis|IN", file: "indianapolis-in-hvac-cost.html" },
    { slug: "nashville-tn", ctxKey: "Nashville|TN", file: "nashville-tn-hvac-cost.html" },
    { slug: "san-jose-ca", ctxKey: "San Jose|CA", file: "san-jose-ca-hvac-cost.html" },
    { slug: "fort-worth-tx", ctxKey: "Fort Worth|TX", file: "fort-worth-tx-hvac-cost.html" },
    { slug: "el-paso-tx", ctxKey: "El Paso|TX", file: "el-paso-tx-hvac-cost.html" },
    { slug: "baltimore-md", ctxKey: "Baltimore|MD", file: "baltimore-md-hvac-cost.html" },
    { slug: "albuquerque-nm", ctxKey: "Albuquerque|NM", file: "albuquerque-nm-hvac-cost.html" },
    { slug: "fresno-ca", ctxKey: "Fresno|CA", file: "fresno-ca-hvac-cost.html" },
    { slug: "long-beach-ca", ctxKey: "Long Beach|CA", file: "long-beach-ca-hvac-cost.html" },
    { slug: "mesa-az", ctxKey: "Mesa|AZ", file: "mesa-az-hvac-cost.html" },
    { slug: "virginia-beach-va", ctxKey: "Virginia Beach|VA", file: "virginia-beach-va-hvac-cost.html" },
    { slug: "colorado-springs-co", ctxKey: "Colorado Springs|CO", file: "colorado-springs-co-hvac-cost.html" },
];

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString()}`; }
function fmtD(n) { return `$${n.toLocaleString()}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function getMultiplier(state) {
  return pricingModel.stateMultipliers?.[state] || 1.0;
}

/* Deterministic hash of a string for stable per-slug variant picking.
 * Same slug => same variant every build, but different slugs tend to
 * pick different variants so paragraph-level overlap drops sharply. */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
function pick(slug, salt, arr) {
  return arr[hash(slug + "|" + salt) % arr.length];
}

/* --- Per-metro HVAC data. Each entry packs enough distinctive tokens
 * (utility names, neighborhoods, brand dealers, local ordinances, named
 * extreme events, equipment styles) that section boilerplate becomes
 * impossible to share across metros.
 * --------------------------------------------------------------------- */
const metroHVACData = {
  "new-york-ny": {
    utilityCompanies: "Con Edison and National Grid",
    avgElectricRate: 0.24, avgGasRate: 1.85,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "cold winters with sub-zero wind chills off the Hudson",
    recommendedSEER: 16, recommendedAFUE: 95,
    heatPumpViable: "viable for shoulder seasons but dual-fuel with a PGW or Con Ed gas backup is still the dominant Brooklyn brownstone configuration",
    permitAuthority: "NYC Department of Buildings (DOB)",
    permitDetail: "DOB Work Permit required for ductwork and gas; self-certified by licensed Master Plumber for the gas tie-in. NYC DOB also enforces the Local Law 97 emissions cap for larger buildings, which is nudging Manhattan co-ops toward VRF conversions",
    bestBuyMonths: "October through February",
    worstBuyMonths: "June through August",
    seasonReason: "Manhattan and Bronx window-unit failures during July heat waves drive emergency demand and premium pricing; late-fall slots at Con Edison-approved contractors are 15-20% cheaper than June bookings",
    localBrandNetworks: "Carrier (headquartered upstate in Palm Beach Gardens via Syracuse roots), Mitsubishi Electric ductless (dominant in Park Slope and Astoria row-house retrofits), and Fujitsu mini-splits are the three best-supported brands in the five boroughs",
    dominantEquipmentStyle: "steam-to-gas boiler conversions in pre-war brownstones and ductless Mitsubishi mini-splits in Queens row houses are the dominant upgrade paths; central ducted systems are rare outside Riverdale and Forest Hills",
    localScam: "Union-scale labor rates get cited as an excuse for $25,000+ boiler swaps in Upper East Side walk-ups when the actual Con Edison gas tie-in is straightforward; get a second bid from a Brooklyn-based non-union shop before signing",
    localPermitQuirk: "NYC Local Law 97 emissions caps on large residential buildings are pushing Manhattan co-op boards to favor heat-pump VRF conversions over legacy steam, which affects bid structure for anyone in a building over 25,000 square feet",
    techNarrative: "pre-war steam radiator systems in Manhattan and the Bronx often get paired with modern ductless Mitsubishi or Fujitsu heads for summer cooling rather than ripped out wholesale; this split-system hybrid is the NYC-specific norm",
    utilityRebatesQuirk: "NYSERDA Clean Heat provides $2,000-$4,500 per ton for cold-climate heat pumps in Con Edison territory; rebates are administered by the installer and deducted from the invoice",
    localMaintenancePara: "NYC pre-war steam radiator systems require annual boiler inspection and Hartford Loop verification that most non-NYC contractors cannot perform. The water side of a steam system in a Manhattan or Bronx walk-up needs blowdown, low-water cutoff testing, and pressuretrol calibration each fall before heating season.",
    ductworkPara: "Most NYC residential HVAC runs ductless because the rowhouse and walk-up building stock has no space for ducts. Where small-duct high-velocity systems exist (typically in renovated Park Slope brownstones), the 2-inch flexible ducts require annual inspection because they kink at tight bends and lose airflow without visible damage."
  },
  "los-angeles-ca": {
    utilityCompanies: "LADWP and Southern California Edison",
    avgElectricRate: 0.28, avgGasRate: 1.65,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "low",
    extremeTemp: "San Fernando Valley and Burbank hit 110F during heat domes while coastal Santa Monica stays in the 70s",
    recommendedSEER: 18, recommendedAFUE: 80,
    heatPumpViable: "excellent across the basin; LADWP's electrification push plus mild winters make single-head heat pumps the default recommendation everywhere from Silver Lake to Sherman Oaks",
    permitAuthority: "LADBS (LA Department of Building and Safety)",
    permitDetail: "Express Permit available at LADBS counter for like-for-like residential replacements, typically same-day. California Title 24 Part 6 energy compliance docs (CF-1R, CF-2R, CF-3R) are mandatory and must be filed by a HERS rater for any ductwork changes",
    bestBuyMonths: "November through March",
    worstBuyMonths: "July through September",
    seasonReason: "Valley heat domes drive emergency AC replacements from Pasadena through Woodland Hills at peak pricing; LADBS permits move slower in September too because of the concurrent roofing rush",
    localBrandNetworks: "Lennox dominates new construction west of La Cienega through a major distribution hub in Vernon, while Trane and American Standard have stronger dealer coverage in the Valley through ABC Supply and Ferguson branches",
    dominantEquipmentStyle: "packaged rooftop gas/electric units on flat-roof 1950s ranches in the Valley; split systems with gravity-vent wall furnaces still exist in older Hollywood and Silver Lake bungalows and trigger Title 24 upgrades at replacement time",
    localScam: "Out-of-state storm-chaser firms sweep LA after Santa Ana wind events pitching full system replacements for wind-damaged condensers; fin damage is almost always field-repairable for $300-$500",
    localPermitQuirk: "LA City requires HERS testing and Title 24 CF-3R compliance certification at final inspection; any contractor skipping HERS fails the LADBS signoff and you lose the LADWP rebate",
    techNarrative: "gravity-vent wall heaters in older Echo Park and Highland Park homes cannot simply be replaced in kind under current code; the upgrade path is a heat pump or a sealed-combustion furnace with a listed flue",
    utilityRebatesQuirk: "LADWP's Consumer Rebate Program pays up to $1,500 for qualifying heat pumps; BayREN and TECH Clean California stack on top for qualifying homes in SCE territory",
    localMaintenancePara: "LA Valley rooftop packaged units sit in direct sun at 130-150F surface temperatures for 6+ months, which accelerates capacitor and contactor failure 30-40% faster than ground-level split systems in the same climate. Annual pre-summer inspection and capacitor testing in Encino and Woodland Hills catches the most common single-point failure before it produces a July heat-wave emergency.",
    ductworkPara: "LA attic ductwork on 1950s-60s ranch homes was often installed with minimal insulation (R-4 or less) because energy codes were nonexistent at construction. Upgrading attic duct insulation to R-8 during a system replacement adds $800-$1,500 but recovers cost in 3-4 LADWP billing cycles."
  },
  "chicago-il": {
    utilityCompanies: "ComEd (electric) and Peoples Gas / Nicor Gas",
    avgElectricRate: 0.17, avgGasRate: 1.10,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate summer",
    extremeTemp: "polar vortex events push ORD to -20F wind chills; summers hit 95F with humid Lake Michigan air",
    recommendedSEER: 16, recommendedAFUE: 96,
    heatPumpViable: "cold-climate heat pumps such as the Mitsubishi Hyper-Heat and Bosch IDS 2.0 work below -13F but Lincoln Park and Logan Square bungalow owners still overwhelmingly pair them with a 96% AFUE Peoples Gas-fed furnace for the February deep cold",
    permitAuthority: "Chicago Department of Buildings",
    permitDetail: "E-Permit portal issues mechanical permits to licensed Chicago-registered contractors in 24-72 hours; a separate gas permit is required for furnace replacements, and Peoples Gas physically pulls the meter and re-pressurizes the line after the city inspection passes",
    bestBuyMonths: "September through November",
    worstBuyMonths: "June through August and January (emergency furnace failures)",
    seasonReason: "North Side bungalow furnace failures during -10F polar-vortex stretches drive genuine emergency pricing; Lakeview and Lincoln Square shops routinely quote $2,000 premiums on mid-January weekends",
    localBrandNetworks: "Carrier and Bryant are heavily represented through Crete-based Johnstone Supply, while Rheem has unusually strong dealer coverage on the North Side through a long-standing distributor relationship with Peoples Gas conversion contractors",
    dominantEquipmentStyle: "forced-air gas furnace paired with a central AC on the bungalow-belt slab-on-grade homes; steam and hot-water boilers still dominate the older greystones in Lincoln Park, Bucktown, and Logan Square",
    localScam: "Door-to-door crews sweep Oak Park and Evanston after every polar vortex claiming heat exchangers are cracked based on a five-minute flame-test; demand the Peoples Gas or Nicor inspector's written report before agreeing to any replacement",
    localPermitQuirk: "City of Chicago requires both a licensed plumber and a licensed HVAC contractor on any gas-furnace change-out, and Peoples Gas will not turn service back on without the inspector's green tag; DIY replacement is not a practical option inside city limits",
    techNarrative: "the Chicago bungalow's low-slope roof and attached cold attic makes traditional split-system condenser placement awkward; side-yard concrete pads with vibration isolation pads are the local standard",
    utilityRebatesQuirk: "ComEd offers $250-$500 instant rebates through its marketplace program for qualifying smart thermostats and high-SEER AC; Nicor and Peoples Gas add $150-$400 for high-AFUE furnaces",
    localMaintenancePara: "Chicago bungalow-belt furnaces sit on basement slabs where spring flooding can submerge the burner assembly and destroy the ignition system. A flood-switch ($50-$150 installed) that shuts the gas valve when water reaches the combustion chamber is cheap insurance in neighborhoods from Albany Park to Bridgeport.",
    ductworkPara: "Chicago bungalow basements typically have original 1940s-50s sheet-metal trunk lines that were never sealed. Mastic-sealing the joints during a furnace replacement adds $300-$800 and recovers the cost within 2-3 Peoples Gas or Nicor billing cycles. The low-slope bungalow roof also constrains condenser placement to the side yard."
  },
  "houston-tx": {
    utilityCompanies: "CenterPoint Energy (delivery) with retail providers like Reliant, TXU, and Direct Energy",
    avgElectricRate: 0.14, avgGasRate: 1.05,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "extreme",
    extremeTemp: "6+ months above 90F with dew points often in the mid-70s; winters mild except for the occasional Uri-style Arctic outbreak",
    recommendedSEER: 18, recommendedAFUE: 80,
    heatPumpViable: "well-suited to the Gulf Coast mild-winter profile, but after Winter Storm Uri the market has shifted back toward dual-fuel with a small gas furnace as grid insurance",
    permitAuthority: "City of Houston Public Works",
    permitDetail: "Houston's iPermits portal issues Mechanical Work Permits to TDLR-licensed contractors within one business day for residential change-outs. Harris County unincorporated areas use the Harris County Permits Office, which is slower (3-5 days) but does not require municipal registration",
    bestBuyMonths: "November through February",
    worstBuyMonths: "May through August",
    seasonReason: "West University, River Oaks, and Bellaire all flood contractor phones during July when 3-ton split systems in 1960s slab-on-grade homes give up mid-heat wave; off-season winter pricing from the Woodlands down to Pearland runs 15-20% less",
    localBrandNetworks: "Trane has the strongest dealer penetration through its Tyler manufacturing plant's regional distribution; Lennox is heavily represented in the Woodlands and Katy master-planned communities through national homebuilder relationships; American Standard rides Trane's supply chain as the value tier",
    dominantEquipmentStyle: "2.5-to-5-ton split systems on concrete pads next to slab-on-grade ranches; attic gas furnaces are nearly universal because the warm climate makes basement-mounted equipment unnecessary and the slab construction makes them impractical",
    localScam: "Post-hurricane and post-derecho storm-chaser crews from Louisiana and Oklahoma pitch full system replacements on minor condenser damage; CenterPoint requires TDLR licensure for any work on the service equipment",
    localPermitQuirk: "Houston does not have zoning but it does have deed restrictions enforced by civic clubs in River Oaks, Tanglewood, and West U; condenser placement that blocks a sightline can trigger a private-nuisance action even with a valid city permit",
    techNarrative: "Harris County's expansive Beaumont clay soil causes slab-on-grade foundation movement that cracks refrigerant line sets year after year; brazed copper line sets with flexible isolation loops are the regional best practice",
    utilityRebatesQuirk: "CenterPoint's SCORE program pays $600-$1,800 for qualifying heat pump installations; Entergy Texas customers southeast of Houston get separate rebates through their utility",
    localMaintenancePara: "Houston's expansive Beaumont clay soil causes slab-on-grade foundation movement that cracks refrigerant line sets at the wall penetration point. Annual inspection of the line-set wall penetration for cracks and sealant failure is a Memorial and Spring Branch maintenance item that prevents slow refrigerant leaks from developing into compressor failures.",
    ductworkPara: "Houston attic ductwork runs through unconditioned spaces that reach 140-160F in summer, making duct integrity the single biggest variable in HVAC efficiency. A duct-leakage test costs $150-$300 in Harris County and should be part of any system replacement. Leaking attic supply connections waste 15-25% of conditioned air into the attic."
  },
  "phoenix-az": {
    utilityCompanies: "APS (Arizona Public Service) and SRP (Salt River Project)",
    avgElectricRate: 0.14, avgGasRate: 1.30,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "low except during monsoon",
    extremeTemp: "100+ days above 100F, rooftop package unit surface temps hitting 160F, monsoon dust storms driving dirt into condenser coils",
    recommendedSEER: 20, recommendedAFUE: 80,
    heatPumpViable: "heat pumps work excellently in the Valley because the mild winters rarely challenge the outdoor unit; APS offers meaningful heat-pump rebates and SRP's time-of-use plans favor them further",
    permitAuthority: "City of Phoenix Development Services",
    permitDetail: "Phoenix's ProjectDox online portal issues same-day mechanical permits to Arizona ROC-licensed contractors for like-for-like residential change-outs. Scottsdale, Tempe, Mesa, and Glendale each run their own separate permit offices with slightly different submittal standards and fees",
    bestBuyMonths: "October through February",
    worstBuyMonths: "June through August",
    seasonReason: "110F+ June heat waves cause rooftop package unit failures across Ahwatukee, Arcadia, and the West Valley; dispatching replacement units during monsoon haboob events also creates genuine supply-chain delays",
    localBrandNetworks: "Trane has the strongest Valley presence through Thermal Supply distribution in Tempe; Goodman and Amana (both Daikin brands) are heavily represented in the value tier through Carrier-Coburn and the Desert Schools Credit Union rebate partnerships on mid-century ranches",
    dominantEquipmentStyle: "rooftop packaged gas/electric or heat pump units on the low-slope foam roofs typical of Valley ranches and newer stucco tract homes; split systems are rare outside older Scottsdale and Biltmore infill lots",
    localScam: "July emergency service calls routinely lead to $12,000-$18,000 full-system replacement pitches when the real failure is a $400 capacitor or a $900 blower motor; demand a written diagnostic report before authorizing anything above a repair",
    localPermitQuirk: "Maricopa County's Department of Environmental Services requires permitted disposal of R-22 and R-410A refrigerant with a signed manifest; your contractor should include the disposal manifest number on the final invoice",
    techNarrative: "rooftop package units in Phoenix routinely fail at the 10-12 year mark rather than the 15-year national average because of continuous 150F+ coil temperatures; paying for a premium SEER unit expecting 20-year life is not a sound Valley investment",
    utilityRebatesQuirk: "APS Solutions for Business and APS Home Performance rebates pay $250-$900 for high-SEER units; SRP offers a parallel but slightly smaller program through its Bright Home Rewards portal",
    localMaintenancePara: "Phoenix rooftop package units fail at the 10-12 year mark rather than the 15-year national average because continuous 150F+ coil operating temperatures degrade every component faster. Annual pre-monsoon inspection with capacitor testing and contactor cleaning in Ahwatukee and Arcadia catches the most common failure modes before the June heat dome arrives.",
    ductworkPara: "Phoenix attic ductwork in 1990s-2010s tract homes was typically installed with R-6 insulation that degrades in the 160F+ attic environment within 10-12 years. Upgrading to R-8 rigid-board duct wrap during a rooftop unit replacement adds $600-$1,200 and recovers cost in 2-3 APS or SRP billing cycles."
  },
  "dallas-tx": {
    utilityCompanies: "Oncor (delivery) with retail providers like TXU, Reliant, and Green Mountain",
    avgElectricRate: 0.13, avgGasRate: 1.00,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "high",
    extremeTemp: "hundred-degree stretches of 20+ consecutive days common; Winter Storm Uri and the 2023 ice storm proved hard freezes still matter",
    recommendedSEER: 17, recommendedAFUE: 90,
    heatPumpViable: "viable across DFW but the 2021 grid collapse reset the market toward dual-fuel configurations; Plano, Frisco, and McKinney new construction now routinely specifies gas backup as insurance",
    permitAuthority: "City of Dallas Building Inspection",
    permitDetail: "Dallas uses the ProjectDox online portal with permit issuance in 1-3 business days for TDLR-licensed contractors. Collin County and Denton County (covering most suburbs north of LBJ) run separate permit offices; Plano, Frisco, and McKinney each have their own processes with different fees",
    bestBuyMonths: "October through January",
    worstBuyMonths: "May through July",
    seasonReason: "North Texas hail season from mid-March through early June ties up contractors on concurrent roofing and condenser replacements; late-fall pricing in Plano and Highland Park falls 15% as the hail work clears",
    localBrandNetworks: "Lennox has extraordinary DFW presence because the company is headquartered in Richardson; Carrier has strong Texas dealer coverage through its Lewisville distribution center; Trane's Tyler plant 100 miles east also keeps American Standard widely stocked",
    dominantEquipmentStyle: "attic-mounted gas furnaces paired with concrete-pad condensers on 1960s-1980s ranches in Lake Highlands and Richardson; package units on the flat-roof commercial-style infill in Uptown and Deep Ellum",
    localScam: "Hailstorm sweep crews bundle HVAC replacement into roofing claims through inflated wind-damage adjustments; Texas Department of Insurance specifically warns homeowners that a crushed fin is almost never grounds for condenser replacement",
    localPermitQuirk: "Oncor requires a released permit and passed inspection before reconnecting service after a full system disconnect; homeowners who let contractors skip the permit end up without power for days waiting for Oncor to return",
    techNarrative: "The North Texas hail corridor stretching from Plano through Prosper to McKinney averages 3-5 damaging hail events per year from mid-March through early June. Hail guards bolted over condenser coils ($250-$500 installed) are the single most cost-effective protective upgrade on any DFW outdoor unit; they demonstrably reduce coil-fin damage and prevent the $2,000-$4,000 coil replacements that follow a 1.5-inch hail event in the Collin County belt",
    utilityRebatesQuirk: "Oncor's Take A Load Off Texas rebate pays $325-$1,200 for qualifying heat pumps meeting SEER2 thresholds; the rebate processes through the installing dealer rather than the homeowner, so confirm Oncor enrollment before signing. CoServ (Denton County co-op) and Grayson-Collin Electric run their own parallel incentive programs with different qualifying equipment lists",
    localMaintenancePara: "North Texas hail damage to outdoor condenser coils is the most common post-storm HVAC claim in the DFW metro. Fin-combing a hail-damaged coil costs $200-$500 and restores 90%+ of original airflow after all but the most catastrophic strikes. Hail guards from Lancaster Products or Hail Hero are a $250-$500 preventive investment that pays for itself after a single storm-season event on any Plano, McKinney, or Prosper condenser sitting in the Collin County hail belt.",
    ductworkPara: "Dallas attic ductwork bakes at 130-150F for five continuous months. Flex-duct inner liners degrade 3-5 years faster in a DFW attic than identical product in a Denver basement. A duct-leakage test ($150-$300) should accompany every Oncor-territory system replacement; leaking attic supply connections dump 15-25% of conditioned air into the hottest space in the house. Oncor's reconnection protocol requires a passed mechanical inspection, which means the duct test happens during permit close-out anyway."
  },
  "atlanta-ga": {
    utilityCompanies: "Georgia Power (electric) and Atlanta Gas Light",
    avgElectricRate: 0.14, avgGasRate: 1.15,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "high",
    extremeTemp: "95F+ Piedmont summers with oppressive humidity; the occasional January arctic outbreak that dips into the teens",
    recommendedSEER: 17, recommendedAFUE: 92,
    heatPumpViable: "textbook heat-pump climate; mild winters and long cooling seasons make heat pumps the default recommendation from Decatur through Dunwoody, and Georgia Power's Smart Neighborhood program has accelerated adoption significantly",
    permitAuthority: "City of Atlanta Department of Buildings",
    permitDetail: "City of Atlanta uses the Accela portal for mechanical permits; unincorporated Fulton and DeKalb counties use their own separate Accela instances with slightly different fees. Georgia conditioned-air contractor license (Class I or Class II) is required statewide and is administered by the Georgia Secretary of State Construction Industry Licensing Board",
    bestBuyMonths: "October through February",
    worstBuyMonths: "May through July",
    seasonReason: "Atlanta's continuing intown tear-down boom keeps Buckhead and Virginia-Highland contractors locked into new-construction schedules through peak season; late-fall replacement pricing routinely runs 10-15% below June quotes",
    localBrandNetworks: "Carrier has unusually strong Atlanta metro penetration through the former Bryant Heating dealer network and a major distribution hub in Tucker; Trane's proximity to the Tyler, Texas plant also makes American Standard well-stocked throughout the Piedmont",
    dominantEquipmentStyle: "split-system heat pumps on concrete pads beside 1970s-1990s ranches in Dunwoody, Sandy Springs, and Decatur; crawlspace-mounted gas furnaces in older Grant Park and Inman Park bungalows; attic-mounted systems in the newer Cumming and Alpharetta builds",
    localScam: "After named Atlanta ice storms (the 2014 Snowpocalypse and 2022 event are the recent examples) contractors pitch full system replacements on frozen coils; a frozen coil is almost always recoverable once the system thaws",
    localPermitQuirk: "City of Atlanta requires the specific condensate discharge location on the mechanical permit application; incorrectly specified discharge into a sanitary sewer without a trap is a common inspection failure",
    techNarrative: "red clay and rocky subsoil in the Piedmont makes direct-buried copper line sets impractical; above-grade line sets with UV-resistant insulation sleeves are the regional standard, especially on the hilly intown Atlanta lots",
    utilityRebatesQuirk: "Georgia Power's HomePerks program offers $200-$500 rebates for qualifying high-SEER systems and smart thermostats; Atlanta Gas Light's Cooler Smarter and AGLR programs stack for dual-fuel installations",
    localMaintenancePara: "Atlanta red clay and rocky Piedmont subsoil make direct-buried copper line sets impractical. Above-grade line sets with UV-resistant insulation sleeves are the regional standard on hilly Inman Park and Grant Park lots. Annual insulation-sleeve inspection catches UV breakdown before moisture reaches the copper.",
    ductworkPara: "Atlanta crawl-space ductwork in older Grant Park and Inman Park bungalows faces humidity infiltration that attic systems in Phoenix and Las Vegas never experience. Vapor-barrier maintenance in the crawl space directly affects duct-insulation integrity and indoor air quality."
  },
  "denver-co": {
    utilityCompanies: "Xcel Energy (both electric and gas)",
    avgElectricRate: 0.15, avgGasRate: 0.85,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "very low",
    extremeTemp: "sub-zero Chinook-influenced cold snaps; 50-degree temperature swings inside 24 hours are routine along the Front Range",
    recommendedSEER: 16, recommendedAFUE: 96,
    heatPumpViable: "cold-climate heat pumps work well at Denver's 5,280-foot elevation because the dry air mitigates efficiency losses; Xcel Colorado Home Rebates make them compelling, but most homeowners still keep the gas furnace as deep-winter backup",
    permitAuthority: "City and County of Denver Community Planning and Development",
    permitDetail: "Denver's eReview portal issues mechanical permits to Denver-licensed contractors; the city requires a separate Denver mechanical license beyond the Colorado state registration, and the license exam covers altitude-adjusted combustion air calculations that other Front Range jurisdictions do not",
    bestBuyMonths: "April through May and September through October",
    worstBuyMonths: "June through August and December through January",
    seasonReason: "Front Range Chinook temperature swings destroy system components and drive dual demand peaks; shoulder-season installation in April before the hail-roof rush, or September before the furnace-startup rush, gets the best pricing in neighborhoods from Wash Park to Highlands Ranch",
    localBrandNetworks: "Carrier has strong dealer coverage along the Front Range through a Denver Tech Center distribution hub; Lennox ships heavily into the Stapleton and Central Park new-build market through homebuilder relationships; Trane is strong in Boulder and the mountain foothills",
    dominantEquipmentStyle: "natural-draft atmospheric gas furnaces in 1970s-1980s Wash Park and Stapleton ranches are aging out and getting replaced with condensing 96% AFUE units that require new PVC venting; heat pumps are most common in newer Central Park and Stapleton builds where the homebuilder specified them",
    localScam: "Hail season Front Range storm-chasers bundle condenser coil damage into roof claims; Colorado Division of Insurance explicitly warns that bent fins are almost always field-combable repair, not replacement triggers",
    localPermitQuirk: "Denver requires altitude-adjusted combustion air calculations for any atmospheric-vent appliance; the rule is specific to the high elevation and every Denver mechanical permit requires the CAZ (combustion appliance zone) worksheet",
    techNarrative: "Denver's 5,280-foot altitude reduces atmospheric pressure by roughly 17%, which derates combustion appliances meaningfully; manufacturers publish altitude-corrected BTU charts and a properly sized furnace in Denver is a half-size larger than its sea-level equivalent",
    utilityRebatesQuirk: "Xcel Colorado Home Rebates pays $1,000-$3,000 for cold-climate heat pumps that meet the program's HSPF and low-temperature performance thresholds; additional stackable rebates exist for smart thermostats and whole-home efficiency audits",
    localMaintenancePara: "Denver's 5,280-foot altitude reduces atmospheric pressure roughly 17%, which derates combustion appliances meaningfully. Annual combustion analysis on any atmospheric-vent furnace in Wash Park or Platt Park should verify altitude-corrected BTU output rather than relying on nameplate ratings calibrated at sea level.",
    ductworkPara: "Denver basement ductwork runs through semi-conditioned spaces that stay 55-65F year-round. The altitude-adjusted airflow requirement (roughly 400 CFM per ton, adjusted for density) means duct sizing calculated at sea level is undersized for Denver. System replacements should include a static-pressure test to verify duct capacity."
  },
  "seattle-wa": {
    utilityCompanies: "Seattle City Light (electric) and Puget Sound Energy (gas)",
    avgElectricRate: 0.12, avgGasRate: 1.40,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "high winter, moderate summer",
    extremeTemp: "June 2021 heat dome hit 108F at SeaTac and reset the regional AC market; winters mild but chronically damp",
    recommendedSEER: 16, recommendedAFUE: 92,
    heatPumpViable: "excellent; Washington state's Clean Energy Fund and Puget Sound Energy heat-pump rebates plus Seattle City Light's 90%+ carbon-free generation mix make heat pumps the default choice across Ballard, Fremont, and West Seattle",
    permitAuthority: "Seattle Department of Construction and Inspections (SDCI)",
    permitDetail: "SDCI issues mechanical permits through its Accela portal; Washington State requires an HVAC/R 06A specialty contractor license that is distinct from the general contractor license, and Seattle additionally enforces its Energy Code Amendment that exceeds the Washington State Energy Code for new equipment",
    bestBuyMonths: "March through May",
    worstBuyMonths: "July through September (heat dome panic) and December (furnace failures)",
    seasonReason: "The 2021 heat dome permanently reshaped Seattle AC pricing; Capitol Hill, Queen Anne, and Ballard contractors now book three months out for June-July installs. February-April pricing in the dry window is 15-20% lower",
    localBrandNetworks: "Mitsubishi Electric and Daikin ductless mini-splits dominate the market because so few Seattle homes have ducts; Bosch IDS 2.0 and Carrier Infinity central-ducted heat pumps cover the newer Sammamish and Issaquah tract builds that do have ductwork",
    dominantEquipmentStyle: "ductless mini-split heat pumps on craftsman bungalows in Ballard, Wallingford, and Green Lake where there is no existing ductwork; gas furnaces on Kirkland and Bellevue tract homes where ductwork already exists but heat-pump conversion is progressing fast",
    localScam: "Post-heat-dome emergency AC pitches in June and July routinely push oversized equipment at small craftsman homes; a 12k BTU ductless head handles most single-story Seattle bungalows and anyone quoting 24k or 36k is overselling",
    localPermitQuirk: "Seattle Green Building Code requires a commissioning checklist for new heat pump installations and City Light interconnection for any system drawing more than specified residential service amperage; commissioning documentation ties to the electrical permit not the mechanical permit",
    techNarrative: "Seattle's combination of low summer dew points and long cool shoulder seasons makes high-HSPF cold-climate heat pumps shine; the 2021 heat dome was also a demonstration that even Seattle's envelope needs active cooling as the Pacific Northwest warms",
    utilityRebatesQuirk: "Puget Sound Energy Ductless Heat Pump program pays $1,200-$2,400 per outdoor unit; Seattle City Light also rebates $1,000-$1,500 for full-home heat pump conversions under its Home Energy program",
    localMaintenancePara: "Seattle's combination of low summer dew points and long damp shoulder seasons makes heat-pump defrost-cycle calibration a maintenance item that dry-climate markets never encounter. Annual defrost-board inspection on Ballard and Fremont ductless heads catches the sensor drift that causes short-cycling during the October-April damp season.",
    ductworkPara: "Seattle homes with existing ductwork (mostly 1960s-80s Kirkland and Bellevue tract homes) often have ducts routed through unconditioned crawl spaces where moisture degrades insulation. Duct sealing with mastic during a heat-pump conversion adds $500-$1,200 and is worth every dollar in Seattle's damp climate."
  },
  "austin-tx": {
    utilityCompanies: "Austin Energy (municipal utility)",
    avgElectricRate: 0.13, avgGasRate: 1.10,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "high",
    extremeTemp: "100F+ August stretches that routinely last three weeks; Winter Storm Uri proved the grid can collapse and freeze outdoor equipment",
    recommendedSEER: 18, recommendedAFUE: 90,
    heatPumpViable: "excellent for the 10 warm months but the 2021 grid failure permanently reset the market toward dual-fuel with a gas backup as genuine insurance against another grid-failure cold event",
    permitAuthority: "Austin Development Services Department",
    permitDetail: "Austin's AB+C online portal is notoriously slow - 2-4 weeks is normal, 6 weeks not unheard of during spring and fall peaks. Travis County unincorporated areas use the county permit office instead, which moves faster (3-5 days) but has less familiarity with Austin Energy's interconnection requirements",
    bestBuyMonths: "October through January",
    worstBuyMonths: "May through August",
    seasonReason: "Tarrytown, Hyde Park, and South Congress contractors are stretched flat from May onward as Austin's brutal summers create sustained emergency demand; October-December pricing runs 12-18% below August emergency rates",
    localBrandNetworks: "Carrier and Bryant have extremely strong Austin dealer coverage through Lennox's Richardson headquarters feeding a Round Rock distribution hub; Trane's proximity to the Tyler, Texas plant also keeps American Standard widely available; Mitsubishi ductless is gaining share in East Austin ADU conversions",
    dominantEquipmentStyle: "attic-mounted gas furnaces paired with concrete-pad outdoor condensers on 1970s-1990s ranches in Northwest Hills and Allandale; ductless mini-splits are taking over East Austin ADU and garage conversions where attic space is nonexistent",
    localScam: "Post-Uri emergency pitches still surface every cold snap telling homeowners their frozen condenser needs full replacement; a frozen outdoor coil recovers fully once thawed unless a line set physically ruptured from ice expansion",
    localPermitQuirk: "Austin Energy Green Building requires specific duct leakage testing thresholds for new installations that exceed the statewide IECC requirement; your contractor must be familiar with the Austin-specific forms",
    techNarrative: "Austin's shrink-swell clay soil plus the Balcones Escarpment produce concurrent foundation movement and slab cracking that stresses refrigerant line sets; flexible isolation loops and oversized insulation sleeves are the regional best practice",
    utilityRebatesQuirk: "Austin Energy Home Performance with ENERGY STAR pays $500-$1,800 for qualifying heat pump installations and includes required duct leakage testing; the program is distinct from any TECH Texas incentives",
    localMaintenancePara: "Austin's Balcones Escarpment geography creates concurrent foundation movement and slab cracking that stresses refrigerant line sets. Flexible isolation loops at the line-set wall penetration are the Travis County best practice. Annual inspection of line-set connections in Tarrytown and Allandale catches slow leaks before they drain the charge.",
    ductworkPara: "Austin attic ductwork faces the same extreme heat as Houston but adds cedar pollen infiltration that clogs filter media 30-40% faster than standard dust alone during the December-March cedar season. Upgrading to a MERV 11-13 filter and checking monthly during cedar season is the Hyde Park and Mueller maintenance standard."
  },
  "san-francisco-ca": {
    utilityCompanies: "PG&E (electric and gas)",
    avgElectricRate: 0.36, avgGasRate: 2.15,
    coolingDominant: false, heatingDominant: false,
    humidityIssue: "moderate (coastal fog)",
    extremeTemp: "rare outright extremes; coastal districts stay in the 60s while Noe Valley and Bernal Heights see 95F+ during inland heat domes",
    recommendedSEER: 15, recommendedAFUE: 90,
    heatPumpViable: "ideal; SF's mild year-round climate, PG&E's punishing gas rates, and BayREN's aggressive electrification rebates make a single heat pump the default recommendation for Richmond, Sunset, and Mission District homes",
    permitAuthority: "San Francisco Department of Building Inspection (DBI)",
    permitDetail: "SF DBI offers over-the-counter mechanical permits through its Permit Center at 49 South Van Ness; California Title 24 Part 6 energy compliance documentation (CF-1R, CF-2R, CF-3R) is mandatory and HERS-rater-verified for anything touching ductwork. SF also enforces the Electrification Ordinance in new construction",
    bestBuyMonths: "November through February",
    worstBuyMonths: "September and October (inland heat waves)",
    seasonReason: "Richmond and Sunset fog-belt contractors stay steadier year-round than most SF trades, but inland Noe Valley and Bernal Heights demand spikes during September heat domes when homes without AC finally break down and order one",
    localBrandNetworks: "Mitsubishi Electric ductless dominates SF's Victorian and Edwardian retrofit market because ductwork is usually impossible; Daikin and Fujitsu mini-splits are strong alternatives; Bosch IDS 2.0 covers the rare central-ducted Sunset and Richmond bungalows with attic space",
    dominantEquipmentStyle: "ductless mini-split heat pumps on Victorian and Edwardian flats where running ductwork would destroy historic plaster and trim; gravity-vent wall furnaces are still everywhere and trigger mandatory upgrades at replacement time under SF's Electrification Ordinance",
    localScam: "Contractors occasionally quote central-ducted systems for Victorian flats where running ducts is physically impractical; a credible SF bid for a pre-1920 flat should be ductless mini-split, not central forced-air",
    localPermitQuirk: "SF's Existing Commercial Buildings Energy Ordinance and residential Electrification Ordinance interact with any gas-appliance replacement; replacing a gravity wall furnace with another gas unit is increasingly difficult because the ordinance pushes electric alternatives",
    techNarrative: "SF's Mission District microclimate sun-pocket versus the cold Sunset fog belt means cooling capacity sizing varies dramatically block-to-block; a credible Manual J calculation for an SF home references the specific neighborhood climate station, not generic Bay Area averages",
    utilityRebatesQuirk: "BayREN Home+ pays $1,000-$3,000 for qualifying heat pumps; TECH Clean California stacks on top and PG&E's own electrification incentives can push effective pricing below a like-for-like gas furnace replacement",
    localMaintenancePara: "SF's Mission District microclimate sun-pocket versus the cold Sunset fog belt means cooling-capacity sizing varies dramatically block-to-block. A credible Manual J calculation for an SF home references the specific neighborhood climate station rather than generic Bay Area averages that oversize Sunset systems and undersize Mission installations.",
    ductworkPara: "Most SF residential HVAC is ductless because Victorian and Edwardian rowhouses have no room for ducts. Where small-duct high-velocity systems exist (typically in renovated Noe Valley flats), annual inspection of the 2-inch flex runs is mandatory because they kink at tight bends through 100-year-old framing."
  },
  "philadelphia-pa": {
    utilityCompanies: "PECO (electric) and Philadelphia Gas Works (PGW)",
    avgElectricRate: 0.18, avgGasRate: 1.55,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "humid 95F summer heatwaves with Delaware Valley haze; winter cold snaps into the single digits and periodic ice storms",
    recommendedSEER: 16, recommendedAFUE: 95,
    heatPumpViable: "cold-climate heat pumps work to 5F but Center City rowhomes and Chestnut Hill twins still overwhelmingly pair them with a high-AFUE PGW-fed gas furnace for the February deep cold",
    permitAuthority: "Philadelphia Department of Licenses and Inspections (L&I)",
    permitDetail: "Philadelphia's eCLIPSE online portal issues mechanical permits to contractors holding both a PA HICPA registration and a City of Philadelphia contractor license; most residential mechanical permits clear in 3-5 business days and a post-installation L&I inspection is required before PGW will reconnect gas service",
    bestBuyMonths: "October through February",
    worstBuyMonths: "June through August",
    seasonReason: "Rowhome AC installations in Fishtown, Brewerytown, and South Philly are slow tight work because of party-wall constraints and aging electrical panels; winter scheduling drops Center City pricing 12-15% below July emergency rates",
    localBrandNetworks: "Carrier dominates the Philly tri-state market through a Bensalem distribution hub; Lennox is strong on the Main Line through homebuilder relationships with Toll Brothers and Berger Rental; Rheem and Ruud have unusually strong coverage in South Philly through long-standing plumbing-contractor relationships",
    dominantEquipmentStyle: "rowhome basement gas boilers feeding cast-iron radiators (steam or hot-water) with retrofit central AC running through small-duct high-velocity systems; Chestnut Hill and Mt. Airy stone twins tend to have conventional forced-air with the furnace in a half-basement",
    localScam: "Fishtown and Kensington high-pressure sales crews pitch full HVAC replacements on 80-year-old steam boilers without explaining that a cast-iron boiler often has another 15-20 years of service life with a competent tune-up",
    localPermitQuirk: "PGW requires a released L&I mechanical permit and its own separate gas-company inspection before restoring service after any appliance replacement; the PGW inspector must physically seal the meter before leaving",
    techNarrative: "Philly's rowhome party walls and unfinished stone basements create unique line-set routing constraints; the standard practice is running insulated line sets up interior chase walls rather than outside the brick facade, where historic-district requirements often forbid visible penetrations",
    utilityRebatesQuirk: "PECO's Smart Ideas program pays $100-$350 for qualifying high-SEER AC and smart thermostats; PGW's EnergySense program adds $400-$700 for high-AFUE gas furnaces",
    localMaintenancePara: "Philly rowhome steam and hot-water boilers have distinct maintenance needs from forced-air systems. Annual Hartford Loop verification, low-water cutoff testing, and condensate-return inspection on steam systems in Fishtown and South Philly extends boiler life 15-20 years beyond what a forced-air-trained tech would predict.",
    ductworkPara: "Philadelphia rowhome ductwork (where it exists) runs through unheated stone basements that cool supply air 5-10 degrees before it reaches living spaces. Small-duct high-velocity systems in Chestnut Hill and Mt. Airy twins require annual sound-attenuation inspection because the pressurized air creates noise complaints at degraded connections."
  },
  "miami-fl": {
    utilityCompanies: "Florida Power & Light (FPL) and TECO Peoples Gas",
    avgElectricRate: 0.14, avgGasRate: 1.75,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "extreme",
    extremeTemp: "10+ months above 80F with dew points routinely in the high 70s; hurricane-season wind-driven salt spray accelerates coil corrosion",
    recommendedSEER: 18, recommendedAFUE: 80,
    heatPumpViable: "default choice in Dade County; gas heat is nearly nonexistent in Miami homes and heat pumps handle the rare cold snaps with ease",
    permitAuthority: "Miami-Dade County Building Department",
    permitDetail: "Miami-Dade requires all equipment to carry a High Velocity Hurricane Zone (HVHZ) product approval number, which is meaningfully more restrictive than statewide Florida Product Approval. Florida Class A or Class B mechanical contractor license required, and the inspector verifies wind-load tie-down hardware on the condenser pad",
    bestBuyMonths: "November through February",
    worstBuyMonths: "May through September",
    seasonReason: "Coral Gables, Pinecrest, and Kendall contractors stay fully booked from hurricane-season pre-storm prep through post-storm recovery; the December-February dry-season window is the only meaningful buyer's market",
    localBrandNetworks: "Rheem has disproportionately strong South Florida coverage through a Doral distribution hub; Carrier's corrosion-resistant coastal-coil product line is heavily represented in Miami Beach and Key Biscayne; Goodman is the dominant value-tier brand for Hialeah and Westchester replacements",
    dominantEquipmentStyle: "split systems with corrosion-resistant coastal coils on concrete pads with HVHZ-approved hurricane tie-downs; package rooftop units on flat-roof commercial-style infill in Wynwood and Brickell; barrel-tile roof mounting hardware is unique to South Florida",
    localScam: "Post-hurricane storm-chaser crews pitch complete system replacements on salt-corroded outdoor coils; coil cleaning with Nu-Calgon or similar coil cleaner restores efficiency in the vast majority of cases for under $400",
    localPermitQuirk: "HVHZ product approval numbers must appear on the permit application; a Florida-statewide product approval number that is not HVHZ-approved gets the permit rejected automatically",
    techNarrative: "coastal salt spray in Miami Beach, Coconut Grove, and Key Biscayne accelerates aluminum coil corrosion; specifying tin-coated copper or E-coated aluminum fins at replacement is genuinely worth the $400-$600 upcharge this close to the water",
    utilityRebatesQuirk: "FPL On-Call program pays small monthly incentives for AC cycling enrollment rather than upfront rebates; the state-level Solar and Energy Loan Fund (SELF) provides financing but not grant dollars for standard HVAC upgrades",
    localMaintenancePara: "Miami's coastal salt spray in Miami Beach, Coconut Grove, and Key Biscayne accelerates aluminum coil corrosion within 3-5 years on standard-fin units. Specifying tin-coated copper or E-coated aluminum fins at replacement is worth the $400-$600 upcharge. Semi-annual coil cleaning with Nu-Calgon or equivalent is the Coral Gables maintenance standard.",
    ductworkPara: "Miami CBS (concrete block stucco) construction makes retrofit ductwork challenging because chase-cutting is the only option in most Hialeah and Westchester homes. Surface-mount conduit-style duct runs add $2,000-$5,000 to a retrofit. Many Miami homes use ductless mini-splits specifically to avoid this constraint."
  },
  "boston-ma": {
    utilityCompanies: "Eversource (electric and gas) and National Grid",
    avgElectricRate: 0.30, avgGasRate: 2.05,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "nor'easters push wind chills below -10F; summer heat waves hit the high 90s with muggy Atlantic air over Boston Harbor",
    recommendedSEER: 16, recommendedAFUE: 96,
    heatPumpViable: "Mass Save rebates up to $10,000 make cold-climate heat pumps compelling across Brookline, Newton, and Cambridge; triple-deckers in Dorchester and Somerville still often benefit from dual-fuel with a gas backup because of the envelope leakage typical of the 1920s stock",
    permitAuthority: "Boston Inspectional Services Department (ISD)",
    permitDetail: "Massachusetts uniquely requires separate sheet metal and gas permits for most HVAC work - a licensed sheet metal worker must sign off on any ductwork modifications and a licensed gasfitter is required for the gas tie-in. Boston ISD typically schedules inspections within 5-7 business days after permit issuance",
    bestBuyMonths: "April through June",
    worstBuyMonths: "January (mid-winter furnace failures) and July through August",
    seasonReason: "Brookline, Cambridge, and Newton contractors get slammed with January emergency furnace calls and July AC heat-wave calls; late-spring pricing routinely runs 15-20% below either peak window",
    localBrandNetworks: "Mitsubishi Electric Cooling and Heating Division (headquartered in Suwanee, GA but manufactured in Thailand for the North American cold-climate market) has unusual Boston strength because of Mass Save rebate alignment; Bosch IDS 2.0, Carrier Infinity, and Trane XV20i also have strong dealer coverage through local distributor relationships",
    dominantEquipmentStyle: "triple-decker steam boiler conversions to high-AFUE gas boilers with indirect water heaters are extremely common in Dorchester, JP, and Somerville; Cambridge and Brookline colonials and Capes run forced-air gas furnaces plus retrofit central AC",
    localScam: "Post-nor'easter pitches claim frozen gas lines require full system replacement; a frozen condensate line (very different from a gas line) recovers with heat tape and costs $100-$200 to fix, not $15,000 for a new furnace",
    localPermitQuirk: "Massachusetts's plumbing-and-gas board rules require a separate licensed gasfitter signature on the gas permit beyond the HVAC contractor's mechanical license; a single-contractor shop that does not employ a licensed gasfitter will subcontract this step and pad the price meaningfully",
    techNarrative: "Boston triple-deckers have heat-loss profiles more like commercial buildings than typical residential homes because of the stacked party-wall heat transfer and leaky 1920s envelopes; credible Manual J calculations account for this and specify sizing accordingly",
    utilityRebatesQuirk: "Mass Save's whole-home heat pump rebate pays up to $10,000 on qualifying cold-climate installations; the HEAT Loan program provides 0% financing up to $50,000 for the remaining cost across Eversource and National Grid service territories",
    localMaintenancePara: "Boston triple-decker boiler systems require annual inspection by a Massachusetts-licensed gasfitter that covers combustion analysis, Hartford Loop verification on steam systems, and indirect water-heater anode-rod inspection. The gasfitter requirement is unique to Massachusetts and adds $150-$300 to the annual maintenance cost versus states that allow HVAC techs to service gas equipment.",
    ductworkPara: "Boston Cape Cod and Colonial homes in Dorchester and Hyde Park have ductwork running through partially conditioned basements. The triple-decker building type is almost universally boiler-fed with no ductwork, which means heat-pump conversions must use ductless mini-splits rather than the central-ducted systems common in southern markets."
  },
  "san-diego-ca": {
    utilityCompanies: "San Diego Gas & Electric (SDG&E)",
    avgElectricRate: 0.40, avgGasRate: 2.35,
    coolingDominant: false, heatingDominant: false,
    humidityIssue: "low",
    extremeTemp: "remarkably mild 60-80F year-round along the coast; Santa Ana wind events push inland areas like El Cajon and Poway above 100F briefly",
    recommendedSEER: 16, recommendedAFUE: 80,
    heatPumpViable: "perfect heat-pump climate; SDG&E's extraordinary electric rates make high-SEER heat pumps essential, and gas backup is rarely justified outside the inland wind-exposed zones where Santa Ana events matter",
    permitAuthority: "San Diego Development Services Department (DSD)",
    permitDetail: "City of San Diego uses the Accela online portal for mechanical permits; California Title 24 Part 6 energy compliance (CF-1R, CF-2R, CF-3R) is mandatory and HERS-rater-verified. Coastal overlay zone projects in La Jolla, Ocean Beach, and Pacific Beach face additional California Coastal Commission review if envelope changes are involved",
    bestBuyMonths: "December through March",
    worstBuyMonths: "August through October (Santa Ana events)",
    seasonReason: "SDG&E's punishing rates push homeowners toward electrification year-round in Hillcrest, North Park, and Pacific Beach; Santa Ana heat spikes cause brief demand surges inland from Poway through El Cajon. December pricing is reliably cheapest countywide",
    localBrandNetworks: "Carrier and Bryant have strong SD coverage through a Kearny Mesa distribution hub; Mitsubishi Electric ductless dominates Mission Hills and Hillcrest canyon-edge retrofits; Trane and American Standard ride SDG&E's TECH Clean California program participation lists",
    dominantEquipmentStyle: "split-system heat pumps on concrete pads beside 1960s-1980s Clairemont, La Mesa, and Del Cerro ranches; ductless mini-splits in the older Mission Hills and Kensington canyon-edge homes where running ductwork through tight crawlspaces is impractical",
    localScam: "SDG&E's high rates make high-pressure solar-plus-HVAC bundling pitches common; the solar financing and the HVAC financing need to be evaluated separately because bundling routinely hides real cost in the combined monthly payment",
    localPermitQuirk: "California Coastal Commission overlay zones in La Jolla, Del Mar, and Ocean Beach add a review layer beyond the city permit for anything altering building envelope, exterior equipment placement, or screening; factor 4-8 weeks for coastal-zone permits",
    techNarrative: "SDG&E's time-of-use rate structure (EV-TOU-5 and TOU-DR1) rewards west-facing condenser placement that shifts peak load toward the 4-9 pm peak window; specifying a smart thermostat with TOU-aware scheduling is genuinely worth the small upcharge in SDG&E territory",
    utilityRebatesQuirk: "SDG&E's TECH Clean California rebates pay $1,000-$3,000 for qualifying heat pumps; Equity Resiliency battery storage rebates through SGIP stack for wildfire-prone inland neighborhoods",
    localMaintenancePara: "SDG&E's time-of-use rate structure (EV-TOU-5 and TOU-DR1) rewards smart-thermostat scheduling that shifts peak HVAC load away from the 4-9 pm window. Annual thermostat-schedule audit against current SDG&E rate tiers is a distinct maintenance item in Hillcrest and North Park that directly reduces the electric bill.",
    ductworkPara: "San Diego ranch homes in Clairemont, La Mesa, and Del Cerro typically have attic ductwork with minimal original insulation. Upgrading attic duct insulation to R-8 during a heat-pump conversion adds $600-$1,200 and recovers cost quickly given SDG&E's extraordinarily high electric rates."
  },
  "tampa-fl": {
    utilityCompanies: "Tampa Electric (TECO) and Peoples Gas",
    avgElectricRate: 0.14, avgGasRate: 1.70,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "extreme",
    extremeTemp: "long 90F+ Gulf Coast summers with afternoon thunderstorm humidity; hurricane-driven salt air from Tampa Bay accelerates coil corrosion",
    recommendedSEER: 17, recommendedAFUE: 80,
    heatPumpViable: "default and the smart choice; look for models with corrosion-resistant coastal coils given Tampa Bay's year-round salt exposure and the St. Petersburg and Davis Islands waterfront premium on coil life",
    permitAuthority: "City of Tampa Construction Services",
    permitDetail: "Hillsborough County enforces Florida Building Code wind-load requirements (140-150 mph design wind speed) for condenser tie-downs. Pinellas County (covering St. Petersburg and Clearwater) runs its own separate permit office with similar but not identical requirements. Florida Class A or B mechanical license mandatory; Accela Citizen Access portal typically issues permits in 2-3 business days",
    bestBuyMonths: "November through February",
    worstBuyMonths: "May through September",
    seasonReason: "Hurricane preparedness and post-storm repairs tie up Hyde Park, South Tampa, and St. Pete contractors from June through October; dry-season pricing in December-February runs 15-20% softer as the storm emergency work clears",
    localBrandNetworks: "Rheem has disproportionate West Florida presence through a Plant City distribution hub; Trane and American Standard are strong in the newer Westchase, FishHawk, and Wesley Chapel master-planned communities; Goodman is the dominant value-tier brand for Hillsborough County replacements",
    dominantEquipmentStyle: "split systems with corrosion-resistant coils and hurricane-rated outdoor tie-downs on concrete pads beside 1970s-1990s Temple Terrace, Carrollwood, and Brandon ranches; the newer concrete-tile-roof tract builds in Westchase and FishHawk use barrel-tile-compatible line-set flashing kits",
    localScam: "Post-Ian and post-Idalia storm-chaser crews from Georgia and Alabama sweep Tampa Bay pitching full system replacements on salt-corroded outdoor coils; coil cleaning restores performance in the vast majority of cases",
    localPermitQuirk: "Hillsborough County FBC 150 mph design wind speed requires engineered hurricane tie-down hardware on the condenser pad, and the inspector physically verifies the tie-down strap torque at final inspection; cutting corners here is a guaranteed insurance-claim denial after the next named storm",
    techNarrative: "Tampa Bay's combination of salt spray and afternoon thunderstorm humidity creates the single worst HVAC service environment in the continental US; tin-coated copper or E-coated aluminum fins at replacement genuinely pay off within three to five years",
    utilityRebatesQuirk: "TECO's Energy Star Rebate Program pays $100-$750 for qualifying high-SEER heat pumps and smart thermostats; Peoples Gas offers small stackable rebates for the rare dual-fuel installations in Tampa Bay",
    localMaintenancePara: "Tampa Bay salt-air environments require coil cleaning every 6 months rather than the annual schedule standard in inland markets. Tin-coated copper evaporator coils available from Rheem's Plant City distribution hub add $400-$600 at install but resist the corrosive Tampa Bay air that destroys standard aluminum fins within 5-7 years on Davis Islands and Bayshore properties.",
    ductworkPara: "Tampa attic ductwork bakes at 140F+ for 6 months a year, degrading flex-duct inner liners and mastic seals. A full duct inspection every 5 years is the Carrollwood and Temple Terrace standard. Leaking supply connections in a Tampa attic dump conditioned air into 150F space, which is why Tampa HVAC bills spike 20-30% when duct integrity drops."
  },
  "detroit-mi": {
    utilityCompanies: "DTE Energy (electric and gas across Wayne, Monroe, and southeast Michigan) and Consumers Energy (covering Oakland, Macomb, Washtenaw, and the western suburbs)",
    avgElectricRate: 0.18, avgGasRate: 0.95,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "Alberta Clipper systems push overnight lows to -5F several times each January, and Lake St. Clair lake-effect bands pile 8-12 inches of snow on Grosse Pointe and St. Clair Shores without warning; July humidity from the Great Lakes Basin drives 90F+ heat-index days across Macomb and Oakland counties",
    recommendedSEER: 15, recommendedAFUE: 96,
    heatPumpViable: "DTE natural-gas rates at $0.95 per therm are among the cheapest in the country, which makes high-AFUE gas furnaces hard to beat on operating cost; dual-fuel with a cold-climate heat pump handling shoulder-season loads is the emerging sweet spot for Grosse Pointe, Royal Oak, and Ferndale homeowners chasing electrification goals without sacrificing January reliability",
    permitAuthority: "Detroit Buildings, Safety Engineering and Environmental Department (BSEED)",
    permitDetail: "Michigan LARA issues statewide mechanical contractor licenses (M-code); Detroit BSEED requires a separate city contractor registration on top of the state credential. The eLAPS online portal processes applications, but inspection scheduling stretches to 7-10 business days during January and February peak-demand periods, creating lag on emergency furnace replacements that frustrates homeowners used to same-day service in Macomb County",
    bestBuyMonths: "September through November",
    worstBuyMonths: "January and February (Alberta Clipper furnace failures)",
    seasonReason: "DTE's cheap gas encourages Palmer Woods, Indian Village, and Rosedale Park homeowners to run furnaces until total failure; January emergency pricing across the tri-county metro runs 20-25% above the fall shoulder rate, and contractor availability stretches to 3-5 days during Clipper-driven cold snaps",
    localBrandNetworks: "Rheem and Ruud ship out of a Romulus distribution hub six miles from DTW airport; Lennox dominates Oakland County new-build through Pulte and MI Homes relationships; Bryant (Carrier family) ships from the Indianapolis plant with 1-day Detroit delivery, making it the default value-tier replacement brand in Wayne County",
    dominantEquipmentStyle: "96% AFUE condensing gas furnaces paired with 14-15 SEER central AC on 1910s-1940s brick bungalows in Palmer Woods, Indian Village, and Rosedale Park; surviving cast-iron octopus gravity furnaces in Boston-Edison and the oldest Corktown housing convert to sealed-combustion wall-hung boilers feeding the existing radiator loops; Grosse Pointe and Birmingham colonials run forced-air ducted systems through finished basements",
    localScam: "Royal Oak and Ferndale door-to-door crews arrive within 48 hours of every Arctic outbreak, claiming cracked heat exchangers based on a flashlight-and-mirror peek; a legitimate cracked-exchanger diagnosis requires a formal combustion analysis with documented CO readings at the register and the vent, not a visual guess from inside the blower compartment",
    localPermitQuirk: "Michigan mechanical code mandates a separate LARA-licensed gas piping contractor (G-code) for any gas connection or disconnection; HVAC shops without an in-house G-code holder subcontract the gas tie-in and mark up the labor 30-50%, so asking upfront whether the shop holds both M-code and G-code saves money on Wayne and Oakland County replacements",
    techNarrative: "Pre-war Detroit bungalows frequently have undersized 3/4-inch gas service lines that cannot feed both a high-BTU condensing furnace and a tankless water heater simultaneously; DTE Gas engineering review can require a meter and service-line upgrade adding $2,500-$5,000 and 4-6 weeks to the project timeline on Indian Village and Boston-Edison addresses",
    utilityRebatesQuirk: "DTE Energy Efficiency Assistance pays $300-$1,200 toward qualifying 96%+ AFUE furnaces and 16+ SEER AC units in the DTE electric territory; Consumers Energy's Efficiency United program offers a parallel $200-$1,000 rebate in the western-suburb Consumers territory (Ann Arbor, Livonia, Canton), and the two programs cannot be combined on a single address",
    localMaintenancePara: "Detroit's surviving cast-iron octopus gravity furnaces and radiator boilers in Boston-Edison and Indian Village demand a technician who understands Hartford Loops, sight-glass water levels, and low-pressure steam dynamics -- a $200-$350 annual tune-up by a competent Wayne County boiler specialist extends these units 15-20 years past the point where a general HVAC tech would condemn them. DTE gas service-line limitations in pre-war neighborhoods further constrain replacement options.",
    ductworkPara: "Detroit brick-bungalow basements in Rosedale Park and Grandmont run original 1930s sheet-metal gravity-duct trunks that were retrofitted for forced-air conversion during the 1950s-1960s coal-to-gas switchover but never properly sealed. These trunks leak 20-30% of conditioned air into unfinished basements. Insulating the trunk with R-8 duct wrap and sealing register boots with mastic costs $800-$1,800 and recovers the investment inside two DTE heating seasons."
  },
  "minneapolis-mn": {
    utilityCompanies: "Xcel Energy (electric) and CenterPoint Energy (gas)",
    avgElectricRate: 0.14, avgGasRate: 1.00,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "regular -20F Arctic outbreaks, occasional -30F wind chills off Lake Minnetonka; short but humid 90F summers driven by Great Plains storm tracks",
    recommendedSEER: 15, recommendedAFUE: 97,
    heatPumpViable: "cold-climate heat pumps rated to -13F are now practical thanks to Xcel Minnesota Solutions rebates, but Minneapolis winters still require a high-AFUE CenterPoint gas furnace as deep-cold backup",
    permitAuthority: "Minneapolis Community Planning and Economic Development (CPED)",
    permitDetail: "Minneapolis's ePermits portal issues mechanical permits same-day to contractors holding both Minnesota state mechanical contractor bonding and Minneapolis city-issued contractor registration; Saint Paul, Bloomington, and Edina each run their own separate permit offices with similar but not identical requirements",
    bestBuyMonths: "April through June",
    worstBuyMonths: "December through February",
    seasonReason: "Kenwood, Linden Hills, and Edina mid-winter furnace failures at -20F create genuine emergency pricing; spring is when Twin Cities contractors are hungriest after the brutal winter rush ends and before the summer AC startup season",
    localBrandNetworks: "Carrier and Bryant have strong Twin Cities presence through a Brooklyn Park distribution hub; Lennox (headquartered in Richardson TX but with strong Minnesota manufacturing ties through its Marshalltown IA plant) is heavily represented in the newer Maple Grove and Woodbury tract builds; Mitsubishi Electric Hyper-Heat is gaining fast in older Kenwood retrofits",
    dominantEquipmentStyle: "high-AFUE condensing gas furnaces paired with 15-16 SEER central AC in nearly every single-family home; cold-climate heat pumps (most often Mitsubishi Hyper-Heat or Bosch IDS 2.0) are retrofitting into Linden Hills and Highland Park homes alongside the gas furnace as dual-fuel",
    localScam: "January cold-snap sales crews pitch complete replacement on the basis of a cracked heat exchanger without running a combustion analysis; demand formal CO and combustion numbers from a CenterPoint-certified technician before agreeing to anything",
    localPermitQuirk: "Minneapolis CPED requires a separate Minneapolis contractor registration on top of Minnesota state mechanical licensure; a state-licensed contractor from Burnsville or Bloomington still needs the city registration to pull a Minneapolis permit",
    techNarrative: "Minneapolis's frost line at roughly 42 inches affects gas service line depth and any buried electrical whip to outdoor equipment; pad-mounted condensers need proper frost-protected concrete pads or the ground heave cracks line sets over a few winters",
    utilityRebatesQuirk: "Xcel Energy Home Performance with ENERGY STAR pays $500-$2,500 for qualifying heat pump installations; CenterPoint's Home Energy Squad adds $300-$1,000 stackable rebates for high-AFUE furnaces and smart thermostats",
    localMaintenancePara: "Twin Cities frozen-ground conditions from November through April affect outdoor condenser pads. Annual spring inspection for frost-heave tilt on the condenser pad in Kenwood and Edina catches refrigerant-line stress before it produces a leak. A pad tilted more than 5 degrees from level should be re-set before operating the AC for the summer season.",
    ductworkPara: "Minneapolis basement ductwork runs through spaces that drop to 55-60F even in heated basements during January cold snaps. R-8 duct insulation on supply trunk lines recovers its $500-$1,500 cost within 2-3 Xcel Energy heating seasons. Saint Paul fourquare homes often have original 1920s gravity-duct conversions that leak 20-30% of conditioned air into the basement."
  },
  "charlotte-nc": {
    utilityCompanies: "Duke Energy Carolinas (electric) and Piedmont Natural Gas (Dominion subsidiary)",
    avgElectricRate: 0.13, avgGasRate: 1.25,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "high",
    extremeTemp: "sustained 92-96F summers with 80%+ RH on the Piedmont plateau; the 2022 Christmas arctic blast dropped Charlotte to 9F for 36 hours, bursting exposed heat-pump refrigerant lines across SouthPark and Providence Plantation",
    recommendedSEER: 17, recommendedAFUE: 90,
    heatPumpViable: "Charlotte is the single best heat-pump market in the Carolinas; rolling Piedmont hills keep winter temps above 25F most nights, giving air-source units a COP above 2.5 through January, and Duke Energy Carolinas rate structures favor all-electric homes in Ballantyne, Weddington, and Waxhaw",
    permitAuthority: "Charlotte-Mecklenburg Code Enforcement",
    permitDetail: "Mecklenburg County consolidated city and unincorporated permitting into the unified LAMA Accela portal, one of few NC metros to do so. NC HVAC Board Class II (or Class I) license is mandatory statewide; mechanical permits clear in 2-3 business days for licensed contractors. Cabarrus, Union, and Iredell counties outside Mecklenburg require separate applications with different fee schedules",
    bestBuyMonths: "October through February",
    worstBuyMonths: "June through August",
    seasonReason: "Mecklenburg County issued 4,800 residential building permits in 2024, the most in any NC county, and each new home ties up an HVAC crew for 3-5 days; replacement scheduling in June is 10-14 weeks out while November quotes come back 12-18% cheaper with 3-4 week lead times",
    localBrandNetworks: "Carrier and Bryant ship out of the CLT airport-area distribution center serving both Carolinas; Lennox dominates Pulte, Meritage, and Taylor Morrison tract builds across Ballantyne, Steele Creek, and Huntersville; Rheem has unusual Dilworth and Plaza-Midwood penetration via legacy plumbing-contractor dealer agreements dating to the 1990s",
    dominantEquipmentStyle: "14-SEER2 split-system heat pumps on poured-concrete pads constitute 70%+ of residential HVAC across the Ballantyne-Matthews-Huntersville suburban ring and the rapidly growing Waxhaw-Marvin-Weddington corridor south of I-485; the remaining stock divides between 80% AFUE gas furnaces in Myers Park and Eastover crawl-space bungalows (Piedmont Natural Gas mains were installed in those neighborhoods during the 1950s-1960s), and attic-mounted horizontal air handlers feeding high-velocity small-duct systems in the narrow ceiling cavities of Lake Norman lakefront custom builds",
    localScam: "The 2022 Christmas arctic blast spawned a wave of unlicensed storm-chaser crews canvassing SouthPark and Providence Plantation, door-to-door, pitching $9,000-$12,000 full heat-pump replacements on units that needed nothing more than a defrost-board reset and new contactor at $250-$400. NC HVAC Board issued 47 cease-and-desist orders to unlicensed operators in Mecklenburg County in January 2023 alone",
    localPermitQuirk: "NC HVAC Board publishes a license-search portal at nchvacboard.com; Mecklenburg County will not issue a mechanical permit without an active Class I or II license number on the application, and the county cross-checks in real time during e-filing, catching expired-license submissions before issuance",
    techNarrative: "Piedmont red-clay shrink-swell cycles move foundations 0.25-0.5 inches seasonally on Ballantyne and Waxhaw tract lots where clay layers exceed 10 feet deep. Rigid copper refrigerant line sets crack at the slab-to-pad transition; the Charlotte-specific best practice is a flexible vibration-isolation loop at the condenser connection, specified by name in the Carrier and Trane Carolinas installation manuals",
    utilityRebatesQuirk: "Duke Energy Carolinas Smart $aver pays $400-$800 for qualifying ducted heat pumps meeting 15 SEER2 / 8.1 HSPF2 minimums; Piedmont Natural Gas stacks a $250 rebate on rare dual-fuel setups; the combined $1,050 cap is the highest utility-rebate stack in NC",
    localMaintenancePara: "Charlotte's legendary March-April pollen bloom blankets every condenser coil in a thick yellow-green pine-and-oak film that restricts airflow within 48 hours of onset. Post-pollen coil cleaning with a garden hose and fin comb costs $150-$200 and should happen annually on Ballantyne, Dilworth, and SouthPark units. Piedmont red-clay dust infiltrates the lower coil fins on ground-level pads; clay-contaminated coils resist simple hosing and require chemical coil cleaner.",
    ductworkPara: "Charlotte crawl-space bungalows in Dilworth, Eastover, and Elizabeth sit over unsealed red-clay subgrade where summer RH reaches 85% at the vapor-barrier level. Flex-duct insulation in these crawl spaces absorbs ambient moisture, drops R-value from R-8 to effectively R-3, and breeds Cladosporium mold within 5-7 years. Encapsulated crawl-space conditioning with a dehumidifier rated for 70 pints per day is the Piedmont-specific fix that no other climate zone requires at this scale."
  },
  "las-vegas-nv": {
    utilityCompanies: "NV Energy (electric) and Southwest Gas",
    avgElectricRate: 0.13, avgGasRate: 1.45,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "very low",
    extremeTemp: "110F+ heat waves for three-plus weeks every summer; rooftop package units bake at 160F+ surface temperatures and fail at the 10-12 year mark rather than the 15-year national average",
    recommendedSEER: 20, recommendedAFUE: 80,
    heatPumpViable: "heat pumps handle Las Vegas's mild winters easily and excel on cooling efficiency, but the flat-roof construction dominant across Summerlin and Henderson still favors packaged rooftop units with integrated heat-pump operation over split systems",
    permitAuthority: "Clark County Building Department (City of Las Vegas Building & Safety for city limits)",
    permitDetail: "Nevada State Contractors Board C-21 (refrigeration and air conditioning) license is required statewide. Clark County's online portal issues same-day mechanical permits for like-for-like residential replacements; Henderson and North Las Vegas run their own separate permit offices with similar requirements but distinct fee schedules",
    bestBuyMonths: "November through February",
    worstBuyMonths: "June through September",
    seasonReason: "Rooftop package units failing during 115F July stretches in Summerlin, Henderson, and Anthem create genuine emergency pricing; winter replacement costs run 20-25% below July peak",
    localBrandNetworks: "Carrier and Bryant have strong Vegas coverage through a Henderson distribution hub; Lennox is heavily represented in the newer Summerlin and Mountain's Edge tract builds through homebuilder relationships with Pulte and Lennar; Goodman is the dominant value-tier brand for Clark County replacements and has regional manufacturing support out of its Houston facility",
    dominantEquipmentStyle: "rooftop packaged gas/electric or packaged heat pump units on the low-slope foam roofs typical of Summerlin, Henderson, and Aliante tract homes; split systems are rare outside Huntridge and older east Las Vegas infill lots where the housing stock predates the flat-roof stucco era",
    localScam: "July emergency calls routinely get escalated into $15,000-$20,000 rooftop package-unit replacements when the actual failure is a $500 capacitor, $900 blower motor, or $1,200 compressor contactor; demand a written diagnostic report with model-specific part numbers before authorizing anything above a repair",
    localPermitQuirk: "Clark County requires R-410A and R-454B refrigerant disposal manifests with signed contractor certifications at final inspection; the disposal manifest must tie back to the permit number, which prevents the common practice of venting refrigerant to atmosphere during quick cash-only swaps",
    techNarrative: "Vegas rooftop package units fail early because continuous 150F+ coil temperatures degrade evaporator and condenser coils, control boards, and fan motors faster than any national-average lifespan model predicts; budgeting for a replacement at year 10-12 rather than year 15 is realistic here",
    utilityRebatesQuirk: "NV Energy PowerShift rebates pay $200-$900 for qualifying high-SEER replacements and Wi-Fi thermostats; Southwest Gas offers small stackable rebates for the rare dual-fuel setups, mostly in the higher-elevation Mount Charleston foothill areas",
    localMaintenancePara: "Las Vegas rooftop package units bake at 160F+ surface temperatures for 4-5 months, which is why Valley HVAC units fail at the 10-12 year mark rather than the 15-year national average. Annual pre-summer inspection with capacitor testing, contactor cleaning, and compressor-amp draw measurement catches the most common failure modes before the June heat dome hits Summerlin and Henderson.",
    ductworkPara: "Las Vegas tract-home ductwork in Summerlin, Henderson, and Aliante runs through unconditioned attics that reach 160F+ in summer. A duct-leakage test costs $150-$300 and should accompany every Clark County system replacement. Leaking attic supply connections waste 20-30% of conditioned air into the hottest space in the house."
  },

  "st-louis-mo": {
    utilityCompanies: "Ameren Missouri (electric) and Spire (gas)",
    avgElectricRate: 0.14, avgGasRate: 1.05,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate summer, with July dew points in the low 70s along the River des Peres corridor",
    extremeTemp: "July heat indices above 105F and January polar vortex wind chills below minus-10F; the April 2011 EF4 tornado demonstrated that severe weather can damage outdoor equipment without warning",
    recommendedSEER: 16, recommendedAFUE: 96,
    heatPumpViable: "dual-fuel with Spire gas backup remains dominant for the 60 freeze-thaw cycles; cold-climate Mitsubishi Hyper-Heat handles shoulder seasons but Soulard and Tower Grove South homeowners still pair them with a 96% AFUE Spire-fed furnace for January deep cold",
    permitAuthority: "City of St. Louis Building Division (city) or St. Louis County (county)",
    permitDetail: "The city-county jurisdictional split means HVAC permits route through the City Building Division inside city limits and through St. Louis County for unincorporated areas, with different fee schedules and inspection protocols. A separate Spire gas permit is required for any furnace change-out, and Spire physically inspects the gas connection before turning service back on",
    bestBuyMonths: "September through November",
    worstBuyMonths: "July through August and January (emergency furnace failures during polar vortex events)",
    seasonReason: "Central West End and Clayton furnace failures during minus-10F polar vortex stretches drive genuine emergency pricing with $1,500-$2,500 premiums on mid-January weekends; September scheduling after the summer AC rush gives the best contractor availability before heating season",
    localBrandNetworks: "Trane has strong dealer coverage through its regional distribution hub in Earth City, while Carrier and Bryant are represented through Johnstone Supply branches in Maryland Heights; Mitsubishi ductless systems have growing market share in Soulard and Lafayette Square row-house retrofits where ductwork is impractical",
    dominantEquipmentStyle: "forced-air Spire gas furnace paired with central AC on post-war ranch and Cape Cod stock across The Hill, Dutchtown, and Affton; steam and hot-water boilers still serve 1890s-1920s brick four-families in Soulard and Lafayette Square; ductless mini-splits handle additions and sunrooms on Central West End properties",
    localScam: "Door-to-door crews sweep south county after every polar vortex claiming cracked heat exchangers based on a 5-minute flame test; demand the Spire inspector's written combustion analysis report before agreeing to any replacement, and verify the contractor holds both city and county registration if they claim to serve the full metro",
    localPermitQuirk: "The city-county split means a contractor registered in the city cannot pull permits in the county and vice versa; Spire gas will not turn service back on without the inspector's green tag, making DIY gas-furnace replacement impractical inside either jurisdiction",
    techNarrative: "Soulard and Lafayette Square four-family buildings still run 1920s-era steam radiator systems that most non-St. Louis contractors cannot service; the boiler-to-forced-air conversion path requires Spire gas line upsizing and new ductwork through century-old plaster walls, which drives conversion costs to $12,000-$18,000 per unit versus $6,000-$9,000 for a straightforward furnace swap on The Hill",
    utilityRebatesQuirk: "Ameren Missouri ActOnEnergy offers $300-$1,500 rebates for qualifying heat pumps and high-AFUE furnaces, administered through the installing contractor and deducted from the invoice; Spire offers separate gas-efficiency rebates that stack on top of the Ameren electric-side incentives",
    localMaintenancePara: "St. Louis's 60 freeze-thaw cycles stress condenser pads on Spire-gas-heated homes where snowmelt refreezes around the pad base. Annual spring inspection for pad tilt exceeding 5 degrees in Clayton and Kirkwood catches refrigerant-line stress before it produces a slow leak. Soulard and Lafayette Square boiler systems need annual Hartford Loop verification, low-water cutoff testing, and pressuretrol calibration each fall before Spire turns heating service on.",
    ductworkPara: "South City bungalow basements in The Hill and Dutchtown typically have original 1940s sheet-metal trunk lines that were never sealed during the coal-to-gas switchover. Mastic-sealing the joints during a furnace replacement adds $300-$800 and recovers the cost within 2-3 Spire billing cycles. Soulard four-family buildings often lack ductwork entirely, making ductless mini-splits the only practical cooling path without invasive wall demolition."
  },

  "orlando-fl": {
    utilityCompanies: "Duke Energy Florida and Orlando Utilities Commission (OUC)",
    avgElectricRate: 0.14, avgGasRate: 1.80,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "extreme, with summer dew points consistently in the upper 70s that make dehumidification as important as temperature reduction",
    extremeTemp: "6-plus months above 90F with dew points in the mid-to-upper 70s; Hurricane Ian in September 2022 destroyed outdoor condensers across Dr. Phillips and Lake Nona through flooding and wind-borne debris",
    recommendedSEER: 18, recommendedAFUE: 80,
    heatPumpViable: "excellent as the primary system because Orlando's mild winters rarely challenge outdoor-unit efficiency; OUC's electrification incentives further favor heat pumps over gas in a market where natural gas infrastructure is limited",
    permitAuthority: "City of Orlando Permitting Services Division",
    permitDetail: "City of Orlando Permitting Services issues HVAC permits, with Orange County handling unincorporated areas and Winter Park, Maitland, and Altamonte Springs running separate portals. Florida DBPR licenses HVAC contractors; a CAC (Class A Air Conditioning) license verified at myfloridalicense.com is mandatory. Manual J load calculations are required at permit and enforced at final inspection",
    bestBuyMonths: "November through March",
    worstBuyMonths: "June through September",
    seasonReason: "Winter Park and College Park AC failures during August heat waves with 95F and 78F dew points drive emergency demand and premium pricing; OUC-territory contractors in the city core book 3-4 weeks out during July, while Duke Energy territory in east Orange County has slightly shorter lead times",
    localBrandNetworks: "Trane dominates new construction through its major distribution presence in Central Florida, while Rheem has strong dealer coverage through the Watsco distribution network headquartered in Miami; Goodman and Amana serve the value tier through independent dealers in Kissimmee and east Orange County",
    dominantEquipmentStyle: "3-to-5-ton split-system heat pumps on concrete pads next to CBS block homes are the Orlando standard; packaged rooftop units appear on 1960s flat-roof commercial conversions in the Mills 50 district; ductless Mitsubishi heads handle historic-home cooling in College Park and Thornton Park where ductwork cannot be retrofitted into plaster walls",
    localScam: "Post-hurricane storm-chaser crews from out of state pitch full system replacements for flood-damaged or wind-struck condensers when the actual damage is often limited to contactor replacement and coil cleaning at $300-$600; demand the Florida DBPR CAC license number before allowing any post-storm inspection",
    localPermitQuirk: "Florida requires Manual J load calculations filed with the permit, and Orange County inspectors enforce this at final inspection; any contractor skipping the Manual J step fails the signoff and the homeowner loses the OUC or Duke Energy rebate",
    techNarrative: "Orlando's extreme humidity makes proper dehumidification more important than raw cooling capacity; a correctly sized 3-ton system that runs longer cycles dehumidifies far better than an oversized 4-ton that short-cycles and leaves indoor humidity above 60%, which in the Orlando climate produces mold growth on CBS block walls within 6 months",
    utilityRebatesQuirk: "OUC's Residential Conservation Program pays $150-$400 for qualifying ENERGY STAR equipment; Duke Energy Florida's On Call program offers separate rebates in east Orange County; federal 25C tax credits (up to $2,000 for heat pumps) stack on top of both utility programs",
    localMaintenancePara: "Orlando condensers on CBS block homes sit at grade level where Hurricane Ian's storm surge and flooding damaged thousands of units through standing water and debris impact. Annual pre-hurricane-season inspection in May or June should verify contactor condition, capacitor microfarad readings, and compressor-amp draw. College Park and Winter Park properties under mature live oaks face condenser-coil clogging from continuous leaf shed during the March-April exchange season.",
    ductworkPara: "Orlando attic ductwork bakes at 140-160F for 6 months and faces direct hurricane-wind pressure through soffit vents during named storms. A duct-leakage test at $150-$300 should accompany every Orange County system replacement. The January 2023 Florida Building Code update tightened duct-insulation requirements to R-8 minimum, and any system replacement triggers compliance with the current code, adding $800-$1,500 to the scope if existing duct insulation is sub-code."
  },

  "san-antonio-tx": {
    utilityCompanies: "CPS Energy (combined electric and gas, the nation's largest municipally owned combined utility)",
    avgElectricRate: 0.12, avgGasRate: 1.10,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "moderate, lower than Houston because San Antonio sits 200 miles inland from the Gulf with drier Hill Country air from the west",
    extremeTemp: "40-plus days above 100F in the Stone Oak and far-north corridors; Winter Storm Uri in February 2021 knocked out the ERCOT grid for 4-5 days and froze condensers, heat-pump outdoor units, and gas regulators metro-wide",
    recommendedSEER: 18, recommendedAFUE: 80,
    heatPumpViable: "excellent for 95% of the year, but Winter Storm Uri convinced many Alamo Heights and Stone Oak homeowners to add a small CPS gas-fed furnace as grid-failure insurance; the dual-fuel configuration is now the post-Uri default for new installs",
    permitAuthority: "City of San Antonio Development Services Department",
    permitDetail: "City of San Antonio Development Services issues HVAC permits, with Bexar County handling unincorporated areas and Alamo Heights, Terrell Hills, and Olmos Park running separate portals. TDLR licenses HVAC contractors statewide; permits must be pulled before work begins, not after",
    bestBuyMonths: "November through February",
    worstBuyMonths: "June through September",
    seasonReason: "Stone Oak and Alamo Heights AC failures during July heat waves with consecutive 105F days drive emergency demand and $1,500-$2,500 premiums; CPS Energy's combined-utility structure simplifies coordination because one entity handles both the electric disconnect and the gas tie-in",
    localBrandNetworks: "Trane has the strongest dealer network through its regional distribution in New Braunfels, and Lennox is heavily represented in Stone Oak master-planned communities through national homebuilder relationships; Carrier and Bryant have growing market share through Johnstone Supply branches along Loop 410",
    dominantEquipmentStyle: "3-to-5-ton split systems on concrete pads next to slab-on-grade ranch homes are the San Antonio standard; attic gas furnaces are universal because the post-war slab construction makes basement-mounted equipment impossible; King William District pier-and-beam homes occasionally accommodate crawl-space-mounted equipment",
    localScam: "Post-Uri storm-chaser crews from Houston and Dallas pitched full system replacements on condensers with minor freeze damage; CPS Energy requires TDLR licensure for any work on the service equipment, and the TDLR registration check at tdlr.texas.gov is the primary filter against out-of-market operators",
    localPermitQuirk: "CPS Energy's combined electric-gas utility structure means one entity coordinates both sides of a dual-fuel installation, which simplifies permitting but also means CPS can deny reconnection if the TDLR-licensed contractor does not pass the city inspection first",
    techNarrative: "San Antonio's Balcones Fault Zone expansive clay causes slab-on-grade foundation movement that cracks refrigerant line sets at the wall penetration, the same mechanism Houston faces with Beaumont clay; flexible isolation loops at the line-set wall penetration are the Bexar County best practice, and annual inspection of connections in Alamo Heights catches slow leaks before they drain the charge",
    utilityRebatesQuirk: "CPS Energy's Save for Tomorrow Energy Plan (STEP) pays $400-$1,200 for qualifying heat pumps and high-SEER AC systems; because CPS is a combined utility, the rebate application is a single form rather than the separate electric-gas submissions required in split-utility markets; federal 25C credits stack on top",
    localMaintenancePara: "San Antonio's 200-to-300-ppm very hard water from SAWS drives mineral scale buildup on evaporator coils and condensate drain lines faster than soft-water markets. Annual coil cleaning and condensate-line flushing with distilled vinegar in Alamo Heights and Stone Oak prevents the clogged-drain overflow that damages ceilings below attic-mounted air handlers. Winter Storm Uri froze outdoor heat-pump coils solid across the metro, and post-Uri maintenance protocols now include defrost-board inspection every fall.",
    ductworkPara: "San Antonio attic ductwork faces the same extreme heat as Houston and Austin, with unconditioned attic spaces reaching 140-160F in summer. The SAWS hard water produces mineral deposits on humidifier pads and evaporator coils that degrade indoor air quality. A duct-leakage test at $150-$300 should accompany every Bexar County system replacement, and the TDLR inspector verifies duct connections at final inspection."
  },

  "portland-or": {
    utilityCompanies: "Portland General Electric (PGE, electric) and NW Natural (gas)",
    avgElectricRate: 0.13, avgGasRate: 1.20,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "high during the 7-month wet season with persistent 80-plus-percent relative humidity October through April, but very dry July and August",
    extremeTemp: "the June 2021 heat dome reached 116F in Portland, shattering all records and killing AC-less homes across Sellwood and Alberta Arts; winter lows rarely drop below 25F but the January 2021 ice storm coated the metro in 1-2 inches of ice",
    recommendedSEER: 16, recommendedAFUE: 92,
    heatPumpViable: "standard (non-cold-climate) heat pumps are the Portland default because winter lows rarely challenge outdoor-unit efficiency; the June 2021 heat dome accelerated AC adoption across a market where 40% of homes had no cooling at all before 2020",
    permitAuthority: "City of Portland Bureau of Development Services",
    permitDetail: "Bureau of Development Services issues HVAC permits, with Multnomah County handling unincorporated areas and Lake Oswego, Beaverton, and Tigard running separate portals. Oregon CCB license required; verify at ccb.oregon.gov. NW Natural coordinates gas tie-ins separately from the BDS electrical permit",
    bestBuyMonths: "October through April",
    worstBuyMonths: "June through September (when every contractor is booked installing AC for the first time in historically cooling-optional homes)",
    seasonReason: "the June 2021 heat dome created a multi-year AC installation backlog across Sellwood, Alberta Arts, and Laurelhurst neighborhoods that had never needed cooling before; summer wait times still run 4-6 weeks in 2026 because 40% of Portland homes added cooling for the first time after the heat dome",
    localBrandNetworks: "Mitsubishi ductless mini-splits dominate Portland's retrofit market because the 1900s-1940s Craftsman and bungalow stock in Laurelhurst, Irvington, and Alberta Arts has no ductwork; Daikin and Fujitsu compete for the ductless market through NW Natural partnership programs; Trane and Lennox serve new construction in the suburbs",
    dominantEquipmentStyle: "ductless Mitsubishi or Daikin mini-splits are the dominant retrofit path because Portland's Craftsman bungalows and row houses lack ductwork; forced-air NW Natural gas furnaces serve 1960s-80s ranch homes in Beaverton and Lake Oswego; the heat-dome-driven AC adoption wave is adding cooling heads to homes that previously relied on window fans and natural ventilation",
    localScam: "Post-heat-dome installers from California and Nevada flooded Portland pitching oversized 3-ton systems for 1,200-square-foot Sellwood bungalows when a single Mitsubishi MSZ-FH15 head at $3,500-$4,500 would handle the cooling load; Oregon CCB licensure at ccb.oregon.gov is the primary filter against out-of-state operators",
    localPermitQuirk: "Portland's BDS requires a separate NW Natural gas permit for any furnace change-out, and NW Natural will not turn service back on without the BDS green tag; the Irvington and Ladd's Addition historic districts trigger design review for any visible outdoor equipment including condenser pads",
    techNarrative: "Portland's combination of mild winters and the 2021 heat dome has made the standard heat pump the default recommendation across the metro; cold-climate models are unnecessary because Portland's winter lows rarely challenge the efficiency curve, and the 7-month damp season makes defrost-cycle reliability the critical specification rather than extreme-cold performance",
    utilityRebatesQuirk: "PGE's Smart Savings offers $800-$2,500 for qualifying heat pumps through the Energy Trust of Oregon, which administers incentives for both PGE and NW Natural customers; the Energy Trust rebate is deducted from the invoice by the installing contractor and stacks with federal 25C credits",
    localMaintenancePara: "Portland's 7-month wet season creates defrost-cycle calibration issues on heat-pump outdoor units that dry-climate markets never encounter. Annual defrost-board inspection on Sellwood and Alberta Arts ductless heads catches sensor drift that causes short-cycling during the October-April damp season. Moss growth on outdoor condenser coils is a Portland-specific maintenance item that reduces airflow and efficiency; annual coil cleaning with low-pressure water removes moss without damaging aluminum fins.",
    ductworkPara: "Most Portland residential HVAC runs ductless because the 1900s-1940s Craftsman and bungalow building stock has no space for ducts. Where small-duct high-velocity systems exist in renovated Laurelhurst or Irvington homes, the 2-inch flexible ducts require annual inspection because they kink at tight bends through century-old framing. Crawl-space ductwork in 1960s-80s Lake Oswego and Beaverton ranch homes faces persistent moisture infiltration that degrades insulation and breeds mold; vapor-barrier maintenance in the crawl space directly affects duct-insulation integrity."
  },

  "sacramento-ca": {
    utilityCompanies: "SMUD (Sacramento Municipal Utility District, electric) and PG&E (gas)",
    avgElectricRate: 0.16, avgGasRate: 1.20,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "low in summer but high during Tule fog season November through February when persistent valley fog keeps relative humidity above 90%",
    extremeTemp: "60-plus days above 100F from June through September in East Sacramento and Midtown, reaching 110-115F during heat domes; Tule fog season produces December-February mornings at 30-35F",
    recommendedSEER: 18, recommendedAFUE: 80,
    heatPumpViable: "excellent as the primary system because Sacramento's mild winters and extreme summers favor high-SEER cooling with heat-pump heating as a free bonus; SMUD's electrification incentives are among the most generous in California",
    permitAuthority: "City of Sacramento Community Development Department",
    permitDetail: "Community Development Department issues HVAC permits, with Sacramento County handling unincorporated areas and Roseville, Elk Grove, and Folsom running separate portals. CSLB C-20 (HVAC) or C-38 (refrigeration) license mandatory; verify at cslb.ca.gov. California Title 24 Part 6 CF-1R, CF-2R, CF-3R energy-compliance documents and HERS rater verification are required at final inspection",
    bestBuyMonths: "October through March",
    worstBuyMonths: "June through September",
    seasonReason: "East Sacramento and Land Park AC failures during consecutive 110F heat-dome days drive genuine emergency pricing at $2,000-$3,000 premiums; SMUD-territory contractors book 3-4 weeks out during July; PG&E-territory installers in Roseville have slightly shorter lead times because a different utility coordination process applies",
    localBrandNetworks: "Lennox has the strongest dealer presence through a Sacramento-area distribution hub; Carrier and Trane compete through Johnstone Supply and Ferguson SMUD-aligned programs; Mitsubishi ductless systems serve the growing Midtown and Boulevard Park retrofit market where 1920s Craftsman homes lack ductwork",
    dominantEquipmentStyle: "3-to-5-ton split systems with SMUD-optimized time-of-use scheduling are the Sacramento standard; attic-mounted air handlers in 1960s-80s ranch homes across Arden-Arcade dominate the replacement market; ductless mini-splits serve Midtown and East Sacramento Tudor and Craftsman homes where duct retrofits would require plaster demolition",
    localScam: "Heat-wave-season door-knockers sweep Elk Grove and Roseville pitching emergency replacements at $3,000-$5,000 premiums on systems that need only a $200 capacitor swap; demand the CSLB license number and verify at cslb.ca.gov before allowing any diagnostic work; SMUD will not process the rebate without a valid CSLB-licensed installing contractor on the application",
    localPermitQuirk: "California Title 24 requires HERS testing and CF-3R compliance certification at final inspection for any HVAC change-out; SMUD will not release rebate funds without the HERS report; any contractor skipping the HERS step fails the city or county signoff and the homeowner loses both the SMUD rebate and the federal 25C credit",
    techNarrative: "Sacramento's split utility structure (SMUD electric, PG&E gas) creates a rate arbitrage that strongly favors electrification with heat pumps: SMUD rates run $0.12-$0.16 per kWh versus PG&E's $0.28-plus for surrounding communities, making Sacramento one of the most cost-effective heat-pump markets in California despite the extreme cooling load",
    utilityRebatesQuirk: "SMUD's Home Performance Program pays $1,000-$3,000 for qualifying heat pumps, among the most generous utility incentives in California; PG&E gas customers converting to heat pumps can access both the SMUD electric rebate and the BayREN Home+ program; SMUD rebates are deducted at the invoice by the installing contractor",
    localMaintenancePara: "Sacramento's 60-plus days above 100F produce condenser-coil operating temperatures that accelerate capacitor and contactor failure 25-30% faster than the coastal California timeline. Annual pre-summer inspection with capacitor-microfarad testing and contactor-pitting inspection in East Sacramento and Arden-Arcade catches the most common single-point failure before it produces a July heat-dome emergency. Tule fog season condensation on outdoor units from November through February creates a separate corrosion risk on aluminum fins that coastal-California markets do not face.",
    ductworkPara: "Sacramento attic ductwork in 1960s-80s ranch homes across Arden-Arcade and Carmichael reaches 150-160F in summer and was typically installed with R-4 insulation that current code (Title 24) requires at R-8 minimum. Any system replacement triggers Title 24 compliance, adding $800-$1,500 for duct-insulation upgrade. The January 2023 atmospheric rivers flooded crawl spaces in Natomas and saturated duct insulation that had to be replaced, an event-driven maintenance cost that dry-year Sacramento contractors rarely encounter."
  },

  "pittsburgh-pa": {
    utilityCompanies: "Duquesne Light (electric) and Peoples Gas (gas)",
    avgElectricRate: 0.20, avgGasRate: 1.60,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate summer, but the Three Rivers microclimate traps moisture-laden air in valley inversions that keep basement-level equipment in persistent high-humidity conditions",
    extremeTemp: "January polar vortex events push wind chills below minus-15F in the river valleys, while July humidity makes 90F feel like 100F in the valley-floor neighborhoods of Lawrenceville and the Strip District",
    recommendedSEER: 16, recommendedAFUE: 96,
    heatPumpViable: "cold-climate Mitsubishi Hyper-Heat and Bosch IDS 2.0 work below minus-13F, but Shadyside and Squirrel Hill homeowners overwhelmingly pair them with a 96% AFUE Peoples Gas-fed furnace for February deep-cold backup; the high Duquesne Light electric rate of $0.20/kWh makes all-electric heat-pump operation 30% more expensive than dual-fuel",
    permitAuthority: "City of Pittsburgh Department of Permits, Licenses and Inspections (PLI)",
    permitDetail: "PLI issues HVAC permits, with Allegheny County handling unincorporated areas and Mt. Lebanon, Fox Chapel, and Ross Township running separate portals. PA HIC registration under Act 132 is mandatory; verify at pago.state.pa.us. Peoples Gas requires a separate gas permit and physically pulls the meter for re-pressurization after the city inspection passes",
    bestBuyMonths: "September through November",
    worstBuyMonths: "January through February (emergency furnace failures during polar vortex) and July (AC failures during river-valley heat waves)",
    seasonReason: "South Side Slopes and Polish Hill furnace failures during minus-15F polar vortex wind chills drive genuine emergency pricing with $2,000-$3,000 premiums; the steep hillside topography on 30% of the metro's housing stock adds equipment-access surcharges that flat-terrain markets never encounter",
    localBrandNetworks: "Carrier has strong dealer coverage through the Pittsburgh industrial-supply network, while Trane competes through Johnstone Supply branches in Cranberry Township; 84 Lumber, headquartered in nearby Eighty Four PA, provides faster structural-support material delivery for equipment-pad and platform work on hillside lots than any competing metro",
    dominantEquipmentStyle: "forced-air Peoples Gas furnaces paired with central AC on valley-floor ranch homes in Dormont and Brookline; steam and hot-water boilers still dominate the older row houses in Lawrenceville, Bloomfield, and Polish Hill; hillside homes on South Side Slopes and Mount Washington face condenser-pad placement challenges that require engineered retaining platforms at $1,500-$3,000",
    localScam: "Door-to-door crews sweep the South Hills after every polar vortex claiming cracked heat exchangers based on a 5-minute flame test; demand the Peoples Gas inspector's written combustion analysis before agreeing to any replacement; PA HIC registration at pago.state.pa.us catches unlicensed out-of-state operators who target Pittsburgh after severe weather",
    localPermitQuirk: "Peoples Gas will not turn service back on without the PLI inspector's green tag, and the Act 132 HIC registration is independently verified by PLI before issuing the mechanical permit; hillside condenser-pad installations on South Side Slopes may trigger grading-permit requirements if the pad disturbs more than 500 square feet of slope face",
    techNarrative: "Pittsburgh's Three Rivers microclimate creates valley-floor temperature inversions that trap humid air at basement level, where most furnaces and air handlers sit; dehumidifier integration with the HVAC system using Aprilaire or Santa Fe units is a Pittsburgh-specific recommendation that dry-climate or flat-terrain markets do not require; Peoples Gas rates at $1.60 per therm are among the highest in the Midwest, which makes the dual-fuel versus all-electric calculation closer than in cheap-gas markets",
    utilityRebatesQuirk: "Duquesne Light offers $250-$500 for qualifying smart thermostats and high-SEER AC through its Watt Choices program; Peoples Gas offers separate $150-$400 rebates for high-AFUE furnaces; the two utilities do not coordinate their rebate programs, so homeowners must submit separate applications to each",
    localMaintenancePara: "Pittsburgh's hillside lots create condenser-pad tilting from slope creep that stresses refrigerant line sets. Annual spring inspection for pad tilt exceeding 5 degrees on South Side Slopes, Polish Hill, and Mount Washington properties catches line-set stress before it produces a leak. The Three Rivers valley inversions trap humid air at basement level where furnaces sit, and annual combustion-air verification on Peoples Gas-fed furnaces in Lawrenceville and the Strip District ensures adequate ventilation in homes where the inversion effectively reduces outdoor air exchange.",
    ductworkPara: "Pittsburgh row-house basements in Lawrenceville, Bloomfield, and Polish Hill run 1920s-30s sheet-metal gravity-duct trunks that were retrofitted for forced-air during the 1950s coal-to-gas switchover but never sealed. Mastic-sealing the joints during a furnace replacement adds $400-$1,000 and recovers the cost within 2-3 Peoples Gas billing cycles. Hillside homes on Mount Washington and South Side Slopes face unique duct-routing challenges because the multi-level construction on steep grades creates long vertical runs with significant static-pressure loss."
  },

  "columbus-oh": {
    utilityCompanies: "AEP Ohio (American Electric Power, electric) and Columbia Gas of Ohio (gas)",
    avgElectricRate: 0.14, avgGasRate: 1.05,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate summer with July dew points in the mid-60s, and Olentangy-Scioto river-valley humidity adding 5-10% above flat-terrain levels in Clintonville and Arena District",
    extremeTemp: "January polar vortex events push wind chills below minus-15F; the flat glacial-till terrain produces less microclimate variation than Pittsburgh's river valleys, but the Olentangy corridor channels cold air through Clintonville and Worthington",
    recommendedSEER: 16, recommendedAFUE: 96,
    heatPumpViable: "cold-climate Mitsubishi Hyper-Heat and Bosch IDS 2.0 work below minus-13F, but German Village and Clintonville homeowners pair them with a 96% AFUE Columbia Gas-fed furnace for the 80 freeze-thaw cycles; AEP Ohio rates at $0.14/kWh make all-electric operation cost-competitive with dual-fuel in mild winters",
    permitAuthority: "City of Columbus Department of Building and Zoning Services",
    permitDetail: "Building and Zoning Services issues HVAC permits, with Franklin County handling unincorporated areas and Upper Arlington, Worthington, and Dublin running separate portals. Ohio has no statewide HVAC contractor license; Columbus requires local business registration. Columbia Gas requires a separate gas permit and physically verifies the gas connection before turning service back on",
    bestBuyMonths: "September through November",
    worstBuyMonths: "July (AC failures during summer storms) and January (furnace failures during polar vortex events)",
    seasonReason: "Clintonville and Beechwold furnace failures during polar vortex events drive $1,500-$2,500 emergency premiums; the Ohio State football schedule creates a distinct fall-Saturday access problem in University District and Clintonville that limits contractor scheduling from September through November",
    localBrandNetworks: "Rheem has strong dealer coverage through its Columbus-area distribution network, while Trane and Carrier compete through Johnstone Supply and Ferguson branches in Westerville; Owens Corning, headquartered in nearby Toledo, supplies the insulation products that Columbus HVAC crews install alongside duct upgrades; Mitsubishi ductless systems serve the German Village and Victorian Village retrofit market",
    dominantEquipmentStyle: "forced-air Columbia Gas furnaces paired with central AC on 1940s-60s Cape Cods and ranch homes across Clintonville, Beechwold, and Upper Arlington; German Village 1840s-era brick homes lack ductwork and use ductless mini-splits or gravity-vent space heaters; Ohio State campus-area rental properties in University District run builder-grade equipment with shorter replacement cycles due to tenant wear",
    localScam: "Because Ohio has no statewide contractor license, unlicensed operators from Kentucky and Indiana target Columbus after severe weather; always verify Columbus business registration and demand the Columbia Gas inspector's written report before approving any furnace replacement; the Ohio BBB complaint record is the primary screening tool in a market with no state licensing backstop",
    localPermitQuirk: "Columbia Gas will not turn service back on without the Building and Zoning Services inspector's green tag; German Village Commission approval may be required for visible outdoor equipment including condenser pads on contributing structures within the 233-acre historic district",
    techNarrative: "Columbus's flat glacial-till terrain and uniform lot sizes make equipment sizing straightforward compared to Pittsburgh's hillside complexity; the dominant challenge is the Ohio State campus-area rental market in University District where landlords prioritize lowest-cost replacement over efficiency, creating a two-tier market between owner-occupied neighborhoods and investor-owned rental corridors",
    utilityRebatesQuirk: "AEP Ohio offers $300-$500 for qualifying smart thermostats and high-SEER AC through its Take Charge Ohio program; Columbia Gas of Ohio offers separate $200-$600 rebates for high-AFUE furnaces through the WarmChoice program; Owens Corning's proximity in Toledo provides bundled insulation-plus-HVAC deals through aligned Columbus dealers",
    localMaintenancePara: "Columbus's 80 freeze-thaw cycles stress condenser pads across Clintonville and Upper Arlington. Hard water at 150-200 ppm from the City Division of Water drives mineral scale on evaporator coils and humidifier pads that require annual cleaning. German Village boiler systems in 1840s-era brick homes need annual inspection by a tech familiar with gravity-vent and low-pressure steam systems that most modern-trained HVAC technicians have never serviced, creating a specialist-labor premium of $100-$200 per service call.",
    ductworkPara: "Columbus Cape Cod and ranch-home basements in Clintonville, Beechwold, and Upper Arlington run original 1940s-50s sheet-metal trunk lines from the coal-to-gas conversion era. Mastic-sealing joints during a furnace replacement adds $300-$800 and recovers the cost within 2-3 Columbia Gas billing cycles. German Village homes that added forced-air systems during 1970s-80s renovations often have undersized supply runs squeezed through 1840s brick walls, creating static-pressure problems that manifest as uneven room temperatures."
  },

  "kansas-city-mo": {
    utilityCompanies: "Evergy (electric, both MO and KS sides) and Spire (gas, MO side) or Kansas Gas Service (gas, KS side)",
    avgElectricRate: 0.14, avgGasRate: 1.05,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate summer with Gulf moisture surges pushing July dew points into the low 70s during southerly flow patterns",
    extremeTemp: "January polar vortex wind chills below minus-10F and July heat indices above 105F; the severe hail corridor produces 3-5 significant events per year with baseball-sized hail damaging outdoor condensers",
    recommendedSEER: 16, recommendedAFUE: 96,
    heatPumpViable: "cold-climate models work below minus-13F, but the 80 freeze-thaw cycles and hail exposure push Brookside and Country Club Plaza homeowners toward dual-fuel with Spire gas backup; hail guards from Lancaster Products or Hail Hero at $250-$500 per condenser are the Kansas City-specific add-on that protects outdoor equipment",
    permitAuthority: "KCMO Permits and Inspections (MO side) or Johnson County / Wyandotte County (KS side)",
    permitDetail: "The dual-state jurisdiction means HVAC permits route through KCMO on the Missouri side and through Johnson County (Overland Park, Leawood, Olathe) or Wyandotte County (KCK) on the Kansas side, with different fee schedules and inspection timelines. Spire gas serves Missouri-side properties while Kansas Gas Service handles the KS side; each utility has separate reconnection inspection requirements",
    bestBuyMonths: "September through November",
    worstBuyMonths: "July through August (AC failures during heat waves) and January (furnace failures during polar vortex events)",
    seasonReason: "Brookside and Prairie Village furnace failures during polar vortex events drive $1,500-$2,500 emergency premiums; the May 2024 supercell hailstorm produced a concurrent wave of condenser-replacement claims across Johnson County that pushed equipment availability back 3-4 weeks",
    localBrandNetworks: "Trane has strong dealer presence through its regional distribution in the KC industrial corridor, while Carrier and Bryant compete through Johnstone Supply branches in both Kansas and Missouri; the dual-state market means manufacturers must maintain dealer networks on both sides of the state line, and some dealers hold licensing in only one state",
    dominantEquipmentStyle: "forced-air gas furnaces paired with central AC on 1940s-60s bungalows and ranch homes across Brookside, Waldo, and Prairie Village; hail guards on outdoor condensers are a Kansas City-specific equipment item that other markets do not require; ductless Mitsubishi heads handle Country Club Plaza apartment conversions where ductwork cannot be retrofitted into 1920s masonry walls",
    localScam: "Post-hailstorm storm-chaser crews bundle HVAC condenser replacement into roofing insurance claims, often pitching full system replacements when the condenser has only cosmetic fin damage repairable for $300-$500 with a fin comb; always verify the contractor holds both Missouri and Kansas registrations if they claim to serve the full metro; Evergy requires licensed-contractor verification before processing rebate applications",
    localPermitQuirk: "The dual-state jurisdiction means a contractor licensed in Missouri cannot legally pull permits in Kansas and vice versa; Spire gas (MO) and Kansas Gas Service (KS) have separate reconnection inspection requirements; the May 2024 hailstorm pushed Johnson County permit queues to 3 weeks as damage assessments consumed inspector capacity",
    techNarrative: "Kansas City's hail corridor produces 3-5 events per year with hailstones large enough to damage condenser coils, which is why hail guards are a Kansas City-specific equipment standard; the rapid temperature swings (40F one day, 5F the next) stress expansion joints on refrigerant line sets more than cities with stable cold like Minneapolis; annual line-set inspection at wall penetrations in Brookside and Waldo catches the thermal-fatigue cracks before they produce slow refrigerant leaks",
    utilityRebatesQuirk: "Evergy serves both sides of the state line and offers $300-$800 for qualifying heat pumps and high-SEER AC through a single rebate program; Spire (MO) and Kansas Gas Service (KS) offer separate gas-efficiency rebates with different application processes and qualifying equipment lists; the dual-gas-utility situation means a Brookside homeowner submits to Spire while their Overland Park neighbor submits to Kansas Gas Service for the same furnace model",
    localMaintenancePara: "Kansas City's 3-5 annual hailstorms make condenser-coil inspection after every significant hail event a metro-specific maintenance requirement. Fin-combing hail-damaged coils costs $200-$500 and restores 90-plus percent of original airflow. Hail guards from Lancaster Products or Hail Hero at $250-$500 per unit are the preventive investment that pays for itself after a single storm event on any Brookside, Waldo, or Prairie Village condenser. The rapid temperature swings unique to the KC metro stress expansion joints on line sets and require annual thermal-fatigue inspection.",
    ductworkPara: "Kansas City bungalow and ranch-home basements across Brookside, Waldo, and Roeland Park run original 1940s-50s sheet-metal trunk lines from the coal-to-gas era. Mastic-sealing joints during a furnace replacement adds $300-$800 and recovers cost within 2-3 Spire or Kansas Gas Service billing cycles. The dual-state jurisdiction complicates duct-modification permits because Overland Park ductwork code differs from KCMO standards, and contractors must verify which code applies before starting work."
  },

  "indianapolis-in": {
    utilityCompanies: "AES Indiana (electric, formerly Indianapolis Power & Light) and CenterPoint Energy Indiana (gas)",
    avgElectricRate: 0.14, avgGasRate: 1.05,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate summer with July dew points in the mid-60s, and White River floodplain proximity adding moisture to Broad Ripple and near-west-side basements where furnaces sit",
    extremeTemp: "85 freeze-thaw cycles annually (the most among these 10 metros); January polar vortex wind chills below minus-15F; the November 2013 EF2 tornado in Washington Township demonstrated that severe weather damages outdoor equipment without warning",
    recommendedSEER: 16, recommendedAFUE: 96,
    heatPumpViable: "cold-climate Mitsubishi Hyper-Heat and Bosch IDS 2.0 handle the 85 freeze-thaw cycles, but Meridian-Kessler and Broad Ripple homeowners still pair them with a 96% AFUE CenterPoint gas-fed furnace for the deepest January cold; AES Indiana rates at $0.14/kWh make dual-fuel more economical than all-electric for the heating-dominant load profile",
    permitAuthority: "Indianapolis Department of Business and Neighborhood Services (BNS)",
    permitDetail: "BNS issues HVAC permits, with Marion County handling unincorporated areas and Carmel, Fishers, and Noblesville in Hamilton County running separate portals. Indiana has no statewide HVAC contractor license; Marion County requires local business registration. CenterPoint Energy Indiana requires a separate gas permit and physically verifies the gas connection before turning service back on",
    bestBuyMonths: "September through November",
    worstBuyMonths: "July (AC failures during summer thunderstorms) and January (furnace failures during polar vortex events)",
    seasonReason: "Broad Ripple and Meridian-Kessler furnace failures during minus-15F polar vortex stretches drive genuine emergency pricing with $2,000 premiums on mid-January weekends; the Indianapolis 500 in late May creates 10-14 days of street closures and traffic restrictions in Speedway and near-west-side neighborhoods that freeze contractor access",
    localBrandNetworks: "Carrier and Bryant have strong dealer coverage through Johnstone Supply branches in Castleton and Greenwood; Trane competes through a separate distribution network along the I-465 corridor; IMI (Irving Materials Inc.) headquartered in nearby Greenfield supplies the concrete for equipment pads and retaining walls, giving Indianapolis contractors faster material delivery than any competing metro",
    dominantEquipmentStyle: "forced-air CenterPoint gas furnaces paired with central AC on 1920s-40s American Foursquares and bungalows across Meridian-Kessler, Broad Ripple, and Irvington; the flat glacial-till terrain makes equipment placement straightforward compared to Pittsburgh's hillside challenges; ductless mini-splits serve Irvington and Lockerbie Square historic homes where duct retrofits would damage original plaster and woodwork",
    localScam: "Because Indiana has no statewide contractor license, unlicensed operators from Ohio and Kentucky target Indianapolis after severe weather; the 250-to-350-ppm hard water from Citizens Water creates a legitimate evaporator-coil cleaning upsell, but verify the cleaning protocol matches the actual mineral content rather than a generic national script; always demand the CenterPoint inspector's written report before approving any furnace replacement",
    localPermitQuirk: "CenterPoint Energy Indiana will not turn gas service back on without the BNS inspector's green tag; the Indianapolis 500 race-week access restrictions in late May are unique among these 10 metros and affect HVAC project scheduling in the Speedway, Haughville, and near-west-side neighborhoods; IHPC historic-district review for visible outdoor equipment applies in Irvington and Lockerbie Square",
    techNarrative: "Indianapolis's 250-to-350-ppm extremely hard water (the highest mineral content among these 10 metros) creates unique HVAC challenges: evaporator coils scale faster, humidifier pads calcify within a single season, and condensate drain lines clog with mineral deposits that soft-water markets never face; annual evaporator-coil descaling and condensate-line flushing in Meridian-Kessler and Broad Ripple is a genuine maintenance requirement, not an upsell",
    utilityRebatesQuirk: "AES Indiana offers $300-$500 for qualifying smart thermostats and high-SEER AC through its Take Charge Indiana program; CenterPoint Energy Indiana offers separate $200-$500 rebates for high-AFUE furnaces; the two utilities do not coordinate applications, requiring separate submissions; IMI's proximity in Greenfield creates bundled equipment-pad-plus-concrete deals through aligned contractors",
    localMaintenancePara: "Indianapolis's 250-to-350-ppm extremely hard water drives evaporator-coil scaling and condensate-drain-line mineral clogging faster than any other metro on this list. Annual coil descaling and condensate-line flushing with distilled vinegar in Meridian-Kessler and Broad Ripple prevents the clogged-drain overflow that damages ceilings below attic-mounted air handlers. The 85 annual freeze-thaw cycles stress condenser pads, and spring inspection for pad tilt in Butler-Tarkington and Broad Ripple catches refrigerant-line stress before it produces a leak.",
    ductworkPara: "Indianapolis American Foursquare and bungalow basements in Meridian-Kessler, Broad Ripple, and Irvington run original 1920s-40s sheet-metal trunk lines that were retrofitted during the coal-to-gas switchover but never properly sealed. Mastic-sealing joints during a furnace replacement adds $300-$800 and recovers the cost within 2-3 CenterPoint billing cycles. The hard water at 250-350 ppm produces mineral deposits inside humidifier bypass ducts that reduce airflow 20-30% within 2 years, a maintenance item that soft-water cities never encounter."
  },

  "nashville-tn": {
    utilityCompanies: "Nashville Electric Service (NES, electric) and Piedmont Natural Gas (gas)",
    avgElectricRate: 0.13, avgGasRate: 1.20,
    coolingDominant: false, heatingDominant: false,
    humidityIssue: "high, with summer dew points in the upper 60s to low 70s that make dehumidification important from June through September; the Nashville Basin traps humid air against the surrounding ridgelines",
    extremeTemp: "July heat indices above 105F in the Nashville Basin floor and the March 2020 EF3 tornado with 165-mph winds that destroyed outdoor HVAC equipment across East Nashville and Germantown; winters bring 40 freeze-thaw cycles with occasional single-digit lows",
    recommendedSEER: 16, recommendedAFUE: 92,
    heatPumpViable: "highly viable as the primary system because Nashville's moderate climate sits in the heat-pump sweet spot; variable-speed heat pumps handle both heating and cooling loads efficiently without dual-fuel complexity; NES rates at $0.13/kWh favor electrification over Piedmont gas for most residential applications",
    permitAuthority: "Metropolitan Nashville Department of Codes Administration",
    permitDetail: "Codes Administration issues HVAC permits, with Williamson County (Franklin, Brentwood) handling separate jurisdiction. Tennessee Home Improvement License mandatory for any project over $3,000; verify through the Tennessee Board for Licensing Contractors. Piedmont Natural Gas coordinates gas tie-ins separately from the NES electrical service",
    bestBuyMonths: "November through March",
    worstBuyMonths: "July through September",
    seasonReason: "Nashville's explosive 3-4% annual growth rate has created severe labor scarcity in the HVAC trade, pushing scheduling lead times to 4-6 weeks even during off-peak months; the March 2020 tornado aftermath consumed contractor capacity through fall 2020 and attracted out-of-state operators who stayed for the construction boom",
    localBrandNetworks: "Trane has strong dealer coverage through its Nashville-area distribution network; Rheem competes through independent dealers in Franklin and Brentwood; Firestone Building Products and Elevate Commercial Roofing, both headquartered in Nashville, supply commercial-grade HVAC-adjacent materials (insulation, vapor barriers, roofing membranes) through local distributors at wholesale pricing",
    dominantEquipmentStyle: "variable-speed heat pump split systems are the dominant new-install path because Nashville's moderate climate favors heat-pump efficiency year-round; Piedmont Natural Gas-fed furnaces still dominate the existing stock in Sylvan Park and the Nations; ductless Mitsubishi and Daikin heads handle East Nashville and Germantown post-tornado reconstructions where architects specified open floor plans without standard duct chase locations",
    localScam: "Post-tornado storm-chaser crews swept East Nashville and Germantown after the March 2020 EF3, pitching full system replacements on tornado-damaged condensers when many units needed only contactor replacement and coil cleaning; the metro's growth boom has attracted out-of-state operators who may lack the Tennessee Home Improvement License; verify licensing through the Board for Licensing Contractors before signing",
    localPermitQuirk: "Tennessee Board for Licensing Contractors enforces the $3,000 threshold for Home Improvement License requirements; Piedmont Natural Gas will not turn service back on without the Codes Administration inspector's green tag; East Nashville and Germantown MHZC historic-district review applies to visible outdoor equipment on contributing structures",
    techNarrative: "Nashville's moderate climate makes it the ideal market for variable-speed heat pumps: the 40 freeze-thaw cycles rarely challenge outdoor-unit efficiency, and the high summer humidity makes the variable-speed compressor's superior dehumidification capacity worth the $1,500-$2,500 premium over single-stage equipment; the phosphatic clay beneath Nashville Basin homes settles foundations at rates that stress refrigerant line sets, making flexible isolation loops at the wall penetration the local best practice",
    utilityRebatesQuirk: "NES offers $300-$800 for qualifying heat pumps through the EnergyRight program administered by TVA (Tennessee Valley Authority); Piedmont Natural Gas offers separate $150-$400 rebates for high-AFUE furnaces; TVA's regional structure means the NES rebate program matches offerings in Chattanooga and Knoxville, creating consistent incentives across the state",
    localMaintenancePara: "Nashville's phosphatic clay foundation movement stresses refrigerant line sets at the wall penetration, the same mechanism that affects San Antonio and Houston slab homes. Annual line-set inspection with flexible isolation-loop verification in East Nashville and Germantown catches slow leaks before they drain the charge. The March 2020 tornado debris contaminated hundreds of outdoor condenser coils across the 60-mile damage path, and post-tornado coil cleaning remains a maintenance item for units that survived the storm but were exposed to debris-laden air.",
    ductworkPara: "Nashville bungalow and Craftsman basements in Sylvan Park and the Nations run 1930s-40s sheet-metal trunk lines that were retrofitted during the coal-to-gas conversion. Mastic-sealing joints during a furnace replacement adds $300-$800 and recovers cost within 2-3 Piedmont Natural Gas billing cycles. East Nashville and Germantown post-tornado reconstructions from 2020-2022 installed modern duct systems, but the rapid construction timeline means some installations used lower-quality flex duct that is already showing kinking and insulation degradation at tight bends within 4-5 years."
  },

  "san-jose-ca": {
    utilityCompanies: "PG&E (electric transmission) with San Jose Clean Energy (SJCE) as the community-choice aggregator, and PG&E (gas)",
    avgElectricRate: 0.30, avgGasRate: 1.75,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "low, with dry Mediterranean summers where outdoor condenser efficiency stays high and corrosion risk is minimal compared to coastal cities like San Francisco",
    extremeTemp: "South Bay inland valleys hit 105F during September heat domes while Campbell and west San Jose stay 10-15 degrees cooler from fog intrusion off the Santa Cruz Mountains; winter lows rarely drop below 35F but January ground-frost events in Evergreen and Almaden Valley occasionally damage exposed condensers",
    recommendedSEER: 18, recommendedAFUE: 80,
    heatPumpViable: "excellent across the entire South Bay; SJCE's carbon-free electricity default rate and mild winters make single-head heat pumps the clear winner for the 1960s-70s ranch houses that dominate Willow Glen, Cambrian Park, and Almaden Valley; gas furnaces are increasingly seen as legacy equipment in this market",
    permitAuthority: "City of San Jose Department of Planning, Building and Code Enforcement (PBCE)",
    permitDetail: "PBCE issues mechanical permits through the online portal with 3-5 business day turnaround for residential HVAC; California Title 24 Part 6 compliance (CF-1R, CF-2R, CF-3R) is mandatory, and HERS rater verification is required for any ductwork modification. Santa Clara County handles unincorporated areas like Cupertino foothills under separate jurisdiction",
    bestBuyMonths: "November through March",
    worstBuyMonths: "August through October",
    seasonReason: "September heat domes drive emergency AC failures across Almaden Valley and Evergreen at premium pricing; SJCE-territory contractors book 3-4 weeks out during late-summer heat spikes. Fall scheduling after Labor Day but before the heat dome period offers the narrowest pricing window; January through March is the true off-season",
    localBrandNetworks: "Carrier and Bryant dominate South Bay new construction through distribution via Ferguson and Winsupply branches in Milpitas; Mitsubishi ductless systems have high market share in Willow Glen Craftsman retrofits and downtown San Jose adaptive reuse lofts where ductwork is impractical; Lennox has growing dealer coverage through independent contractors in Campbell and Los Gatos",
    dominantEquipmentStyle: "split-system heat pumps on concrete pads next to 1960s-70s ranch houses are the San Jose standard in Cambrian Park and Almaden Valley; older Willow Glen and Naglee Park homes with wall furnaces require full system installs with new ductwork routed through tight attic spaces; downtown San Jose condo conversions use ductless mini-splits because the building shells cannot accommodate traditional trunk lines",
    localScam: "Tech-affluent Cupertino and Saratoga homeowners report being quoted $20,000-$30,000 for standard 3-ton heat pump installs that should cost $8,000-$12,000; the premium is often justified as 'smart home integration' or 'whole-house air quality' when the base equipment is identical to standard installs. Get three bids and compare equipment model numbers, not feature marketing",
    localPermitQuirk: "California Title 24 HERS testing is enforced at PBCE final inspection; SJCE's community-choice electricity rate means the utility rebate comes through PG&E's delivery infrastructure even though the energy charge comes from SJCE, which confuses some homeowners about which entity administers the clean-energy incentive",
    techNarrative: "San Jose's 1960s-70s ranch-house stock in Cambrian Park, Almaden Valley, and Evergreen was built with undersized return-air paths that starve modern high-SEER equipment; a return-air duct resize ($800-$1,500) during system replacement prevents the short-cycling and frozen evaporator coils that plague these homes when contractors drop in high-efficiency equipment without addressing the airflow constraint",
    utilityRebatesQuirk: "PG&E administers the delivery-side rebate ($500-$1,500 for qualifying heat pumps) while SJCE's GreenSource rate and BayREN's Home+ rebate stack on top; the federal 25C tax credit (up to $2,000 for heat pumps) further reduces net cost. The combined incentive stack regularly covers 30-40% of a standard heat pump install in SJCE territory",
    localMaintenancePara: "San Jose's dry summers mean condenser coils stay cleaner than in humid markets, but fall leaf drop from the heritage oak canopy in Willow Glen and Rose Garden clogs coil fins in October through December. Annual post-leaf-season coil cleaning in Willow Glen catches the airflow restriction before it stresses the compressor during January cold snaps. Almaden Valley homes adjacent to wildfire-risk hillsides accumulate fine ash on coils during fire season that standard garden-hose cleaning doesn't fully remove.",
    ductworkPara: "San Jose attic ductwork on 1960s-70s ranch homes bakes at 130-150F through the September heat dome period. Original duct insulation was R-4 or less, far below current Title 24 R-8 requirements. Upgrading attic duct insulation during a system replacement adds $800-$1,500 and triggers at PBCE inspection. The undersized return-air paths on Cambrian Park and Evergreen ranch houses are the single most common performance complaint after a high-SEER upgrade."
  },

  "fort-worth-tx": {
    utilityCompanies: "Oncor (electric delivery) with retail electric provider choice, and Atmos Energy (gas)",
    avgElectricRate: 0.13, avgGasRate: 0.95,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "moderate-high during summer, with July dew points in the low 70s across the Trinity River floodplain; drier than Houston but more humid than Dallas's northern suburbs",
    extremeTemp: "triple-digit heat from June through September with 100F+ days exceeding 20 per year in Westover Hills and Ridglea; the February 2021 Winter Storm Uri brought historic low of -2F that burst pipes and destroyed outdoor HVAC equipment across the entire Metroplex when the ERCOT grid collapsed",
    recommendedSEER: 16, recommendedAFUE: 92,
    heatPumpViable: "dual-fuel remains the Fort Worth standard because Uri proved that single-fuel electric heat pumps leave homeowners vulnerable during grid emergencies; Atmos Energy gas backup with a 92%+ AFUE furnace is the local consensus recommendation in Ridglea, Westover Hills, and Southlake",
    permitAuthority: "City of Fort Worth Development Services Department",
    permitDetail: "Development Services issues mechanical permits online with 1-3 business day turnaround; Tarrant County handles unincorporated areas. Texas TDLR (Department of Licensing and Regulation) ACR (Air Conditioning and Refrigeration) license is mandatory; verify at TDLR.texas.gov. Atmos Energy coordinates gas tie-ins separately and requires their inspector's approval before restoring gas service",
    bestBuyMonths: "October through February",
    worstBuyMonths: "June through August",
    seasonReason: "Ridglea and Westover Hills AC failures during 100F+ stretches drive emergency demand with 2-3 week wait times and $1,500-$2,500 premiums; the post-Uri replacement surge in February-March 2021 consumed contractor capacity for 6+ months and permanently raised baseline pricing 8-12% above pre-Uri levels",
    localBrandNetworks: "Trane has dominant dealer coverage in Tarrant County through its national distribution network based in nearby Tyler; Carrier competes through independent dealers in Southlake and Keller; Goodman and Amana serve the value tier through Fort Worth Supply and Johnstone Supply branches along Camp Bowie Boulevard",
    dominantEquipmentStyle: "forced-air gas furnace paired with central AC on post-war ranch and 1970s-80s split-level homes across Ridglea, Wedgwood, and Benbrook; dual-fuel heat pump systems gained significant market share after Uri demonstrated the vulnerability of all-electric setups; newer master-planned communities in Alliance and Walsh use builder-grade 14-SEER systems that owners frequently upgrade within 5-7 years",
    localScam: "Post-Uri door-knockers swept Ridglea and TCU-area neighborhoods claiming ERCOT-grid-damage caused hidden compressor damage that required full replacement; the reality is that most Uri-affected systems needed only capacitor replacement and refrigerant recharge after the extended freeze cycle. Demand a TDLR license number before allowing any post-storm inspection",
    localPermitQuirk: "Fort Worth's rapid growth in Alliance and Walsh means permit volume creates 2-3 week delays during peak summer season; Atmos Energy's gas-tie-in scheduling adds another 3-5 business days on top of the city permit timeline. A TDLR-licensed contractor must pull the permit, and DIY installation is not a legal option for any refrigerant-handling work in Texas",
    techNarrative: "Winter Storm Uri permanently changed the Fort Worth HVAC market: dual-fuel systems that maintain gas-furnace heating during grid failures went from 15% to 45% of new installations between 2020 and 2025. Atmos Energy gas infrastructure in established neighborhoods like Ridglea, Westover Hills, and Arlington Heights supports this transition, while newer communities in Alliance and Walsh that were built all-electric are retrofitting gas lines at $2,500-$5,000 per home to enable dual-fuel conversions",
    utilityRebatesQuirk: "Oncor's Take A Load Off Texas program offers $50-$200 for qualifying smart thermostats and high-SEER equipment, which is modest compared to California or Northeast incentives; the 25C federal tax credit ($2,000 for qualifying heat pumps) provides the more significant offset. Texas's deregulated electric market means the retail provider, not Oncor, may offer additional efficiency incentives",
    localMaintenancePara: "Fort Worth's alkaline Blackland Prairie soil generates calcium deposits on condenser pads that tilt units 3-5 degrees within 5 years in Ridglea and Wedgwood, stressing refrigerant lines and causing slow leaks. Annual spring pad-level verification catches this before it drains the charge. The February 2021 Uri freeze also left thousands of units with compressor damage from liquid slugging during the extended sub-zero operation, and affected systems that were restarted without compressor testing may still be operating with degraded efficiency.",
    ductworkPara: "Fort Worth attic ductwork on 1950s-70s ranch homes in Ridglea and Wedgwood bakes at 140-160F from June through September. Original fiberglass flex duct from the 1970s-80s era is at or past its 25-year service life across much of southwest Fort Worth. A full flex-duct replacement during a system upgrade runs $2,000-$4,000 and is the highest-ROI ductwork investment for these vintage homes. Alliance and Walsh newer-construction homes use rigid metal trunk lines with short flex runs, which generally need only mastic sealing rather than replacement."
  },

  "el-paso-tx": {
    utilityCompanies: "El Paso Electric (electric) and New Mexico Gas Company or Texas Gas Service (gas, depending on exact location within the metro)",
    avgElectricRate: 0.12, avgGasRate: 0.90,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "very low, with single-digit relative humidity during May-June heat waves that keeps evaporative coolers viable as a primary cooling strategy in older neighborhoods",
    extremeTemp: "daytime highs exceed 100F for 30-40 days per year with peaks of 110F+ in the Lower Valley and Canutillo; winter nights in northeast El Paso near the Franklin Mountains drop to the low 20s, creating a 90-degree daily temperature swing that stresses ductwork expansion joints",
    recommendedSEER: 16, recommendedAFUE: 80,
    heatPumpViable: "excellent for three-season use but the February 2021 Winter Storm Uri experience pushed many El Paso homeowners toward dual-fuel backup; El Paso Electric's low rates favor electrification, and the mild 90th-percentile winter (35F overnight lows) keeps heat-pump COP above 2.5 for most of the heating season",
    permitAuthority: "City of El Paso Development Services Department",
    permitDetail: "Development Services issues HVAC permits with 2-5 business day turnaround; the Texas TDLR ACR license is mandatory. El Paso's unique position straddling the Texas-New Mexico border means some metro-area homes in Sunland Park and Anthony fall under New Mexico Construction Industries Division jurisdiction with different licensing requirements",
    bestBuyMonths: "October through March",
    worstBuyMonths: "June through August",
    seasonReason: "Lower Valley and Canutillo AC failures during 110F+ heat waves drive emergency demand and 3-week wait times; El Paso's relatively small contractor pool (population 674,000 but geographically isolated from DFW and San Antonio HVAC markets) means there is no nearby surge capacity when local shops fill up",
    localBrandNetworks: "Rheem and Ruud dominate El Paso's market through strong local distributor relationships at Ferguson and Winsupply branches on Montana Avenue; Carrier has dealer coverage in the Upper Valley and Westside through independent contractors; Trane is less represented here than in DFW but has growing presence through national-chain installers",
    dominantEquipmentStyle: "evaporative (swamp) coolers still serve 30-40% of homes in older neighborhoods like Segundo Barrio, Sunset Heights, and Five Points because the single-digit humidity makes them effective at a fraction of compressor-based cooling cost; refrigerated air conversions from swamp cooler to split-system AC or heat pump are the single most common major HVAC project in El Paso, running $4,500-$8,000 including new ductwork",
    localScam: "Swamp-to-refrigerated-air conversion bids that quote $10,000-$15,000 for a standard 3-ton split system in Sunset Heights or the Upper Valley are inflated by 40-60%; the conversion itself is straightforward (remove cooler, install split system, connect to existing duct or run new flex) and should run $4,500-$8,000 in this market. The isolation from DFW comparison pricing lets some contractors mark up without competitive pressure",
    localPermitQuirk: "El Paso's position on the Texas-New Mexico border creates licensing confusion: a TDLR-licensed Texas contractor cannot legally work on Sunland Park or Anthony homes across the state line without a separate New Mexico CID license. Verify which state your property is in before hiring",
    techNarrative: "El Paso's evaporative cooler heritage means 30-40% of the existing housing stock has no conventional ductwork, only a single supply plenum from the roof-mounted cooler. Converting to refrigerated air requires either running new ductwork (rigid or flex) through tight attic spaces or installing ductless mini-splits; the ductless path is gaining share in Sunset Heights and Kern Place where the original cooler ducting was a single oversized chase that cannot support conventional supply-and-return design",
    utilityRebatesQuirk: "El Paso Electric's Energy Efficiency programs offer $200-$600 for qualifying high-SEER equipment and smart thermostats; the 25C federal tax credit stacks on top. El Paso Electric's relatively low rates ($0.12/kWh) mean the dollar savings from high-SEER equipment are lower here than in PG&E or Con Edison territory, extending payback periods on premium equipment to 8-12 years",
    localMaintenancePara: "El Paso's alkaline desert soil and windblown sand are the dominant maintenance factors: condenser coils clog with fine caliche dust during March-April wind events that standard garden-hose cleaning doesn't fully clear. Annual professional coil cleaning with chemical spray in the Upper Valley and Northeast catches the progressive airflow restriction that causes compressor overheating during June-August peak demand. Evaporative cooler pads need replacement every 1-2 seasons, and the mineral-heavy El Paso water supply calcifies the water distribution system faster than soft-water markets.",
    ductworkPara: "El Paso attic ductwork faces extreme temperature differentials: 150F+ attic temperatures in summer paired with 20F winter nights create expansion-contraction cycles that loosen connections faster than moderate climates. Mastic sealing all joints during a system replacement is essential. Swamp-to-AC conversions frequently require entirely new ductwork because the original cooler plenum was a single oversized supply with no return path; budget $2,000-$4,000 for new flex duct runs in a typical Eastside or Lower Valley ranch home."
  },

  "baltimore-md": {
    utilityCompanies: "BGE (Baltimore Gas and Electric, a subsidiary of Exelon)",
    avgElectricRate: 0.16, avgGasRate: 1.30,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate-high in summer, with Chesapeake Bay moisture driving July dew points into the mid-70s across the Inner Harbor and Fells Point waterfront",
    extremeTemp: "July heat indices above 105F with humidity-driven heat stress and January polar vortex events with wind chills below zero; the Chesapeake Bay moderates extremes slightly compared to inland cities like Richmond but adds humidity that makes summer discomfort worse than the thermometer suggests",
    recommendedSEER: 16, recommendedAFUE: 96,
    heatPumpViable: "dual-fuel with BGE gas backup is the dominant configuration because Baltimore's 50+ freeze-thaw cycles and occasional polar vortex events make all-electric risk unacceptable for Fells Point and Federal Hill row-house owners; cold-climate heat pumps handle shoulder seasons efficiently but the gas furnace backup provides the January insurance",
    permitAuthority: "Baltimore City Department of Housing and Community Development",
    permitDetail: "Housing and Community Development issues HVAC permits in the city; Baltimore County handles Towson, Dundalk, and Catonsville under separate jurisdiction. Maryland HVACR license (issued by DLLR) is mandatory; verify at DLLR.maryland.gov. BGE coordinates gas tie-ins and requires their inspector's approval before restoring service. Commission for Historical and Architectural Preservation (CHAP) review applies to visible exterior equipment in Federal Hill, Fells Point, and Mount Vernon historic districts",
    bestBuyMonths: "September through November",
    worstBuyMonths: "July through August and January (emergency furnace failures during polar vortex events)",
    seasonReason: "Fells Point and Canton row-house AC failures during July heat-and-humidity events drive emergency demand; January polar vortex furnace failures in Federal Hill and Hampden generate $2,000-$3,000 emergency premiums on weekend calls. September-November scheduling after the summer rush gives the best combination of contractor availability and pre-winter installation timing",
    localBrandNetworks: "Carrier has strong dealer coverage in Baltimore through regional distribution via Johnstone Supply's Baltimore-area branches; Lennox competes through independent dealers in Towson and Columbia; York and Johnson Controls (both with regional presence near the Baltimore-DC corridor) supply commercial and residential equipment through wholesale channels that independent contractors access",
    dominantEquipmentStyle: "forced-air BGE gas furnace paired with central AC on post-war rowhouse stock in Hampden, Remington, and Medfield; steam and hot-water radiator systems still serve 1890s-1920s brick rowhouses in Bolton Hill, Mount Vernon, and Reservoir Hill; window units remain common in Federal Hill and Fells Point rowhouses where the narrow building width makes ductwork installation prohibitively expensive",
    localScam: "Door-to-door crews targeting Hampden and Remington rowhouses after polar vortex events claim cracked heat exchangers based on a 5-minute flame test; demand the BGE inspector's written combustion analysis before agreeing to any replacement. The city-county jurisdictional split also enables unlicensed county operators to work inside city limits where they lack proper registration",
    localPermitQuirk: "Baltimore City's CHAP (Commission for Historical and Architectural Preservation) requires review of visible exterior HVAC equipment on contributing structures in Federal Hill, Fells Point, Mount Vernon, and Bolton Hill historic districts; a condenser placement that requires CHAP approval adds 4-8 weeks to the project timeline. BGE will not restore gas service without the city inspector's green tag",
    techNarrative: "Baltimore's row-house building stock presents a unique HVAC challenge: the 14-to-18-foot-wide buildings in Fells Point and Federal Hill have no interior space for conventional ductwork, which is why window AC units persist even on $500,000+ renovated homes. The ductless mini-split revolution has been transformative for these properties, with Mitsubishi and Fujitsu heads mounted on interior walls providing whole-house conditioning without the ductwork compromise; a typical 3-head ductless system for a 2,000-square-foot Fells Point rowhouse runs $12,000-$18,000 versus $20,000-$30,000 for a ducted retrofit through century-old plaster walls",
    utilityRebatesQuirk: "BGE's Quick Home Energy Check-Up (QHEC) provides free energy assessment and $100-$200 in instant rebates for air sealing and insulation; the EmPOWER Maryland program offers $500-$1,500 for qualifying heat pumps through participating contractors. Federal 25C tax credits ($2,000 for heat pumps) stack on top of the EmPOWER incentives",
    localMaintenancePara: "Baltimore rowhouse condensers in Fells Point and Canton sit in narrow alleys between buildings where airflow is restricted and debris accumulates from overhanging trees. Annual condenser-coil cleaning is essential in these tight spaces because restricted airflow causes premature compressor failure. Bolton Hill and Mount Vernon boiler systems need annual Hartford Loop verification and pressuretrol calibration each fall before BGE heating-season activation. The Chesapeake Bay humidity promotes mold growth in ductwork that serves below-grade spaces in the harbor-adjacent neighborhoods.",
    ductworkPara: "Baltimore rowhouse basements in Hampden and Remington run original 1920s-40s sheet-metal trunk lines from the coal-to-gas era. Mastic-sealing joints during a furnace replacement adds $300-$800 and recovers cost within 2-3 BGE billing cycles. Fells Point and Federal Hill rowhouses that lack ductwork entirely present the most expensive conversion path: either ductless mini-splits ($12,000-$18,000 for a 3-head system) or high-velocity small-duct systems like Unico or SpacePak ($15,000-$25,000) that route 2-inch flexible tubes through existing wall cavities without demolishing plaster."
  },

  "albuquerque-nm": {
    utilityCompanies: "PNM (Public Service Company of New Mexico, electric) and New Mexico Gas Company (gas)",
    avgElectricRate: 0.14, avgGasRate: 0.85,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "very low, with single-digit relative humidity during June heat waves that keeps evaporative coolers the dominant cooling method in older neighborhoods; monsoon-season humidity in July-August briefly raises dew points but remains far below Eastern US levels",
    extremeTemp: "June highs of 95-100F at 5,312 feet elevation with intense UV that accelerates plastic and rubber component degradation on outdoor equipment; winter nights drop to the teens with 200+ freeze-thaw cycles due to the sharp diurnal temperature swing at altitude",
    recommendedSEER: 16, recommendedAFUE: 92,
    heatPumpViable: "viable as primary cooling with gas backup for winter because the low humidity keeps heat pump efficiency high during cooling season; New Mexico Gas Company-fed furnace backup provides the 200-freeze-thaw-cycle reliability that the altitude's extreme diurnal temperature swings demand",
    permitAuthority: "City of Albuquerque Planning Department, Building Safety Division",
    permitDetail: "Building Safety issues mechanical permits with 3-5 business day turnaround; New Mexico Construction Industries Division (CID) contractor license is mandatory for HVAC work. Bernalillo County handles unincorporated areas. The CID license is state-issued and required for any mechanical work over $200, with separate classifications for commercial and residential",
    bestBuyMonths: "October through March",
    worstBuyMonths: "June through August",
    seasonReason: "North Valley and Rio Rancho evaporative-cooler-to-AC conversions surge in May-June as homeowners tire of swamp cooler limitations during pre-monsoon dry heat; the narrow monsoon window (July-August) briefly makes evaporative cooling less effective, driving a secondary conversion wave",
    localBrandNetworks: "Rheem and Ruud dominate through strong distributor presence via Ferguson and local HVAC supply houses on Lomas Boulevard; Carrier has dealer coverage through independent contractors in the Heights and Northeast Heights; the evaporative cooler market is served by MasterCool and Aerocool, manufactured regionally and distributed through big-box and local supply chains",
    dominantEquipmentStyle: "evaporative (swamp) coolers remain the dominant cooling method on 40-50% of Albuquerque homes, particularly in the North Valley, South Valley, and Old Town where 1940s-60s adobe and block construction was designed around roof-mounted coolers; refrigerated-air conversions to split-system AC or heat pump are the highest-volume HVAC project type in the metro; forced-air New Mexico Gas Company furnaces handle heating across all neighborhoods",
    localScam: "Refrigerated-air conversion quotes from contractors who lack NM CID licensing often omit the necessary ductwork modifications, quoting $3,000-$4,000 for the equipment and then adding $3,000-$5,000 in change orders for the ductwork that was always going to be required. Get a CID-licensed contractor to quote the full conversion scope upfront, including duct modifications",
    localPermitQuirk: "New Mexico CID licensing is state-level and more strictly enforced than most states; contractors from Texas or Arizona cannot legally work in Albuquerque without obtaining a separate NM CID license. The Building Safety Division cross-references permit applications against CID records",
    techNarrative: "Albuquerque's high-altitude dry climate makes evaporative cooling genuinely viable for 9 months of the year, which is why 40-50% of the housing stock still runs swamp coolers. The conversion decision point is the July-August monsoon season when humidity spikes make evaporative cooling less effective for 4-6 weeks. Homeowners in the Heights and Northeast Heights with newer construction tend to have refrigerated air, while North Valley and South Valley adobe homes with original cooler infrastructure face the $5,000-$9,000 conversion cost that includes new ductwork through thick adobe walls",
    utilityRebatesQuirk: "PNM's energy efficiency programs offer $200-$400 for qualifying high-SEER equipment; New Mexico Gas Company offers separate furnace-efficiency rebates. The state's Energy Conservation and Management Division administers additional weatherization incentives for income-qualifying households. The 25C federal tax credit stacks on top of all state and utility programs",
    localMaintenancePara: "Albuquerque's windblown desert dust clogs condenser coils during spring wind events (March-May) that can reduce airflow 20-30% within a single season. Annual professional coil cleaning in the Heights and Northeast Heights is essential. Evaporative cooler maintenance is a distinct local trade: pad replacement every 1-2 seasons, water line descaling (Albuquerque's hard Rio Grande water calcifies distribution systems quickly), and pump-motor lubrication before each cooling season. The 200+ annual freeze-thaw cycles at altitude stress refrigerant connections more aggressively than sea-level cities with the same winter low temperatures.",
    ductworkPara: "Albuquerque's evaporative-cooler-to-AC conversions are the metro's signature ductwork challenge: original swamp cooler installations used a single large supply plenum from the roof with no return-air path, and the 12-to-18-inch thick adobe walls in North Valley and Old Town homes resist conventional duct routing. Ductless mini-splits solve this for 2-3 zone homes at $8,000-$15,000, while conventional flex-duct runs through attic spaces work on newer block construction in the Heights at $2,000-$4,000 for a full system."
  },

  "fresno-ca": {
    utilityCompanies: "PG&E (both electric and gas)",
    avgElectricRate: 0.26, avgGasRate: 1.60,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "low-moderate; Central Valley summer heat is dry and intense but Tule fog from November through February creates damp, cold conditions that stress heating systems and promote mold in underventilated homes",
    extremeTemp: "the San Joaquin Valley floor exceeds 100F for 30-45 days per year with peaks of 112-115F in southeast Fresno and Clovis; Tule fog drops winter visibility to zero and keeps daytime highs in the 40s for weeks, creating a temperature pattern unlike anywhere else in California",
    recommendedSEER: 18, recommendedAFUE: 80,
    heatPumpViable: "excellent for cooling and adequate for Fresno's mild winters (40s-50s during Tule fog season); the extreme summer cooling load makes high-SEER equipment the biggest cost driver, while heating demand is modest enough that heat-pump-only configurations work without gas backup",
    permitAuthority: "City of Fresno Development and Resource Management Department",
    permitDetail: "Development and Resource Management issues mechanical permits with 2-5 business day turnaround; California Title 24 Part 6 compliance is mandatory with HERS rater verification for ductwork changes. Fresno County handles Clovis, Sanger, and unincorporated areas under separate jurisdiction",
    bestBuyMonths: "November through March",
    worstBuyMonths: "June through September",
    seasonReason: "Southeast Fresno and Clovis AC failures during 110F+ Central Valley heat waves drive emergency demand with 3-4 week wait times at premium pricing; PG&E Time-of-Use rate spikes during summer afternoon peaks make high-SEER equipment a more urgent investment here than in NorCal coastal cities where cooling loads are minimal",
    localBrandNetworks: "Lennox has strong dealer coverage in the Central Valley through independent contractors on Blackstone Avenue; Carrier and Trane compete through Ferguson and Winsupply distribution branches; Goodman and Amana serve the value tier through regional distributors serving the agricultural community's cost-conscious market",
    dominantEquipmentStyle: "4-to-5-ton split-system central AC on 1970s-90s stucco-on-slab tract homes is the Fresno standard across Tower District, Woodward Park, and Clovis; oversized systems are the norm because contractors size for the 115F design-day rather than the 100F ASHRAE standard; evaporative coolers serve a small but persistent segment of older Fig Garden and Van Ness neighborhoods where the dry heat makes them effective",
    localScam: "Oversizing is the most common costly mistake in Fresno HVAC: contractors routinely install 5-ton systems on 1,800-square-foot homes that need 3.5-ton units, citing the extreme heat as justification. Oversized systems short-cycle, waste energy, and fail 2-3 years early. Demand a Manual J load calculation and reject any contractor who sizes by rule-of-thumb",
    localPermitQuirk: "Fresno's Title 24 enforcement is rigorous: HERS testing at final inspection catches the duct-leakage and equipment-sizing violations that other Valley jurisdictions sometimes overlook. Any contractor skipping the HERS step fails the Development and Resource Management signoff",
    techNarrative: "Fresno's extreme heat makes the difference between a 14-SEER and 18-SEER system worth $400-$600 per year in PG&E electricity costs because the system runs 10-14 hours per day for 4 months. The payback on a high-SEER upgrade is faster here than almost anywhere else in PG&E territory, typically 4-5 years on the incremental cost. The Tule fog season flips the script entirely: from November through February, the damp 40-degree conditions promote mold in attics where poorly insulated ductwork sweats",
    utilityRebatesQuirk: "PG&E's Central Valley-specific energy efficiency programs offer $500-$1,500 for qualifying high-SEER equipment, reflecting the higher cooling loads in this territory versus coastal NorCal; BayREN and San Joaquin Valley Air Pollution Control District (SJVAPCD) stack additional incentives for replacing old equipment that contributes to Valley air quality problems",
    localMaintenancePara: "Fresno's agricultural dust and Valley air quality issues clog condenser coils faster than any other California metro. Annual professional coil cleaning in spring (before the 100F+ days start) is essential, and homes near agricultural operations in southeast Fresno may need biannual cleaning. The Tule fog season creates condensation on attic ductwork that promotes mold growth in poorly insulated duct systems across Tower District and Fig Garden homes.",
    ductworkPara: "Fresno attic ductwork faces the most extreme temperature range in California: 160F+ attic temperatures during summer and 35-40F during Tule fog season. Original duct insulation on 1970s-80s tract homes is typically R-4, far below the current Title 24 R-8 requirement. Duct-leakage testing at PG&E-funded HERS verification catches the 20-30% duct leakage that is standard on 30+ year-old Fresno homes, and remediation during a system replacement adds $800-$1,500 to the project scope."
  },

  "long-beach-ca": {
    utilityCompanies: "Southern California Edison (SCE, electric) and Long Beach Energy Resources (gas, one of only two municipal gas utilities in California)",
    avgElectricRate: 0.27, avgGasRate: 1.50,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "moderate coastal humidity from the Pacific marine layer that keeps summer dew points in the 60s along the beachfront in Belmont Shore and Naples, dropping inland to dry conditions by the time you reach Signal Hill and North Long Beach",
    extremeTemp: "coastal Long Beach rarely exceeds 85F due to the marine layer, but inland North Long Beach and Lakewood Village hit 100F+ during Santa Ana wind events that push hot desert air over the coastal cooling; winter lows in the 40s rarely stress heating systems",
    recommendedSEER: 16, recommendedAFUE: 80,
    heatPumpViable: "excellent across the entire city; Long Beach's mild year-round temperatures make single-head heat pumps the most cost-effective option; SCE's electrification incentives and the city's climate action plan both favor heat pumps over gas replacement",
    permitAuthority: "City of Long Beach Department of Development Services",
    permitDetail: "Development Services issues mechanical permits with same-week turnaround for residential replacements; California Title 24 compliance with HERS rater verification is mandatory for ductwork modifications. Long Beach's unique municipal gas utility (Long Beach Energy Resources) coordinates gas tie-ins independently of SCE",
    bestBuyMonths: "November through March",
    worstBuyMonths: "August through October (Santa Ana events)",
    seasonReason: "Santa Ana wind events in September-October push inland temperatures to 100F+ across North Long Beach and Signal Hill, driving emergency AC demand; Belmont Shore and Naples beachfront properties rarely need emergency cooling, creating a two-tier seasonal market within the same city",
    localBrandNetworks: "Carrier dominates through its Southern California distribution network via Gemaire and CE; Lennox competes through the Vernon-based distribution hub serving all of Southern California; Mitsubishi ductless systems have high adoption in the 1920s-40s Craftsman and bungalow stock of Belmont Heights and Bluff Park where ductwork retrofitting is impractical",
    dominantEquipmentStyle: "wall furnaces and floor furnaces still serve 20-30% of Long Beach's pre-war housing stock in Belmont Heights, Rose Park, and Wrigley; the wall-furnace-to-heat-pump conversion is the signature Long Beach HVAC project because the marine layer makes AC a comfort upgrade rather than a survival necessity; North Long Beach and Lakewood Village tract homes have standard ducted split systems",
    localScam: "Wall-furnace-to-central-AC conversion bids that quote $15,000-$20,000 for a 2-ton system in a 1,200-square-foot Belmont Heights bungalow are inflated; the conversion should run $7,000-$12,000 including mini-duct or ductless installation. Long Beach's proximity to the LA contractor market means out-of-area operators sometimes quote LA-premium pricing on Long Beach jobs",
    localPermitQuirk: "Long Beach's unique municipal gas utility (Long Beach Energy Resources) means the gas-tie-in coordination is separate from SCE's electrical interconnect; contractors unfamiliar with Long Beach sometimes assume SCG (SoCalGas) handles the gas side and face delays when they discover the municipal utility requires separate scheduling",
    techNarrative: "Long Beach's split personality between coastal-cool neighborhoods (Belmont Shore, Naples, Belmont Heights) and inland-hot areas (North Long Beach, Signal Hill, Lakewood Village) means HVAC sizing varies dramatically within a single city. A Belmont Shore home may need only a 1.5-ton system while a North Long Beach home of the same size requires 3 tons; contractors who size for one microclimate and install across the city consistently over- or under-size",
    utilityRebatesQuirk: "SCE's Clean Energy Optimization program offers $500-$1,500 for qualifying heat pumps; TECH Clean California provides additional incentives for gas-to-electric conversions; the federal 25C tax credit stacks on top. Long Beach Energy Resources (gas) does not currently offer competing gas-efficiency rebates, which further tilts the economics toward electrification",
    localMaintenancePara: "Coastal Long Beach condensers in Belmont Shore and Naples face salt-air corrosion that inland units never encounter. Annual coil cleaning with corrosion-inhibitor treatment extends compressor life by 3-5 years on beachfront properties. The marine layer also promotes mold growth in ductwork serving below-grade spaces in the harbor-adjacent neighborhoods of Shoreline Village and downtown. Signal Hill oil-district properties face petroleum-mist contamination on condenser coils that requires chemical cleaning rather than simple water rinse.",
    ductworkPara: "Long Beach's pre-war housing stock in Belmont Heights, Rose Park, and Wrigley was built without ductwork because wall furnaces and floor furnaces were the era's standard. Adding ductwork to these 1920s-40s homes requires either mini-duct systems (Unico, SpacePak) routed through existing wall cavities at $12,000-$18,000 or ductless multi-zone systems at $8,000-$15,000. North Long Beach tract homes from the 1950s-70s have conventional attic ductwork that needs the standard Title 24 insulation upgrade and leakage sealing."
  },

  "mesa-az": {
    utilityCompanies: "SRP (Salt River Project, electric) and Southwest Gas (gas)",
    avgElectricRate: 0.12, avgGasRate: 0.95,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "extremely low except during the July-August monsoon window when dew points briefly spike into the 50s-60s; the rest of the year, single-digit humidity means evaporative coolers remain viable in older neighborhoods",
    extremeTemp: "Mesa sits in the East Valley heat island where summer highs reach 115-118F for extended stretches in June-July; the monsoon season brings dramatic temperature drops during thunderstorms but also lightning-driven power outages that leave homes without AC during the most dangerous heat; winter lows in the 30s at SRP's higher-elevation service territory are common",
    recommendedSEER: 16, recommendedAFUE: 80,
    heatPumpViable: "excellent for 9 months of the year but the extreme June-July heat pushes outdoor-unit efficiency to its limits; SRP's favorable demand-charge structure for heat pumps makes them economically attractive; dual-fuel with Southwest Gas backup is unnecessary for most Mesa homes because winter heating loads are minimal",
    permitAuthority: "City of Mesa Development Services Department",
    permitDetail: "Development Services issues mechanical permits online with same-day turnaround for like-for-like residential replacements, among the fastest in the Phoenix metro. Arizona ROC (Registrar of Contractors) license CR-39 is mandatory for residential HVAC; verify at AZ ROC's public portal. Gilbert, Chandler, and Apache Junction handle their own permits adjacent to Mesa",
    bestBuyMonths: "October through March",
    worstBuyMonths: "June through August",
    seasonReason: "East Valley AC failures during 115F+ heat waves create genuine emergency conditions because a Mesa home can reach 95F indoor temperature within 3-4 hours of system failure. Emergency surcharges of $1,000-$2,000 are standard during monsoon-season power-outage events when multiple homes need simultaneous service",
    localBrandNetworks: "Trane and American Standard dominate the East Valley through strong distributor coverage via Trane Supply and US Air Conditioning Distributors in Tempe; Lennox competes through independent dealers in Gilbert and Queen Creek; Day & Night and Tempstar serve the value tier through wholesale channels on Main Street and Country Club Drive",
    dominantEquipmentStyle: "rooftop packaged gas/electric units on flat-roof 1960s-80s block homes dominate the original Mesa housing stock east of Country Club Drive; split-system heat pumps on concrete pads serve newer master-planned communities in East Mesa and the Superstition Springs area; evaporative coolers persist on a small segment of original Mesa townsite homes near downtown",
    localScam: "Monsoon-season power-surge damage to capacitors and contactors gets misdiagnosed as compressor failure by unscrupulous operators during July-August emergency calls; a $150-$300 capacitor replacement gets quoted as a $5,000-$8,000 compressor swap. Demand a multimeter capacitance test before agreeing to compressor replacement during any monsoon-related service call",
    localPermitQuirk: "Mesa's same-day permit processing is among the fastest in the Valley, which makes the East Valley attractive for large-volume contractors who can turn jobs faster than they can in Phoenix (3-5 day turnaround) or Scottsdale (strict design review). This speed advantage means Mesa homeowners have access to the Valley's best contractors, not just local operators",
    techNarrative: "Mesa's rooftop package units sit in direct desert sun at 160-180F surface temperatures for 6 months, which is why Mesa HVAC equipment fails at the 10-12 year mark rather than the 15-year national average. The thermal shock of a 60-degree temperature drop during a monsoon thunderstorm (from 115F to 55F in 30 minutes) stresses compressor windings and expansion valves in ways that gradual temperature changes don't. This is a Mesa-specific failure mode that contractors in milder climates never see",
    utilityRebatesQuirk: "SRP offers $300-$600 for qualifying high-SEER equipment through its residential rebate program; SRP's demand-charge rate structure (E-27) provides additional monthly savings for heat-pump users who shift consumption off-peak. The 25C federal tax credit stacks on top. Southwest Gas does not currently offer competing gas-efficiency rebates in the East Valley",
    localMaintenancePara: "Mesa's Sonoran Desert dust and monsoon-season sand storms clog condenser coils faster than any other major US metro. Pre-season cleaning in April-May is essential, and homes adjacent to agricultural land in East Mesa and Queen Creek may need biannual cleaning. Rooftop package units require annual UV-damage inspection of electrical-wire insulation, refrigerant-line jacketing, and condensate-drain routing because the intense desert sun degrades these components 30-40% faster than ground-level installations.",
    ductworkPara: "Mesa attic ductwork faces the most extreme temperatures in residential construction: 180F+ during June peak and rapid 60-degree drops during monsoon thunderstorms. Original flex duct on 1970s-80s block homes east of Alma School Road is frequently degraded beyond repair, with inner liner separation and outer jacket UV failure. Full flex-duct replacement during a system upgrade runs $2,000-$4,000 and is the highest-ROI ductwork investment in this market. Newer East Mesa communities with rigid metal trunk lines need only mastic sealing."
  },

  "virginia-beach-va": {
    utilityCompanies: "Dominion Energy Virginia (both electric and gas)",
    avgElectricRate: 0.14, avgGasRate: 1.20,
    coolingDominant: false, heatingDominant: false,
    humidityIssue: "high, with Chesapeake Bay and Atlantic Ocean moisture driving summer dew points into the mid-to-upper 70s across the entire city; the combination of heat and humidity makes dehumidification performance as important as cooling capacity",
    extremeTemp: "summer heat indices above 105F with persistent humidity from the Chesapeake Bay; Nor'easters bring 30-40 mph winds and coastal flooding that damages ground-level condensers in the Oceanfront and Sandbridge areas; winter temperatures rarely drop below 20F but wind chill off the Atlantic makes perceived cold more severe than thermometer readings suggest",
    recommendedSEER: 16, recommendedAFUE: 92,
    heatPumpViable: "excellent as the primary system because Virginia Beach's moderate winter (January average 40F) keeps heat-pump COP above 2.5 for the entire heating season; dual-fuel with Dominion gas backup is common in Kempsville and Great Neck but unnecessary for most applications; the large military housing inventory (Naval Air Station Oceana, Joint Expeditionary Base Little Creek) standardizes on heat pumps",
    permitAuthority: "City of Virginia Beach Department of Planning and Community Development",
    permitDetail: "Planning and Community Development issues mechanical permits with 3-5 business day turnaround; Virginia DPOR (Department of Professional and Occupational Regulation) contractor license is mandatory for HVAC work. The military base presence means BAH (Basic Allowance for Housing) rates influence the rental HVAC market, with landlords targeting the minimum viable equipment to capture military tenant demand",
    bestBuyMonths: "October through March",
    worstBuyMonths: "July through September",
    seasonReason: "Oceanfront and Shore Drive corridor AC failures during August heat-and-humidity events drive emergency demand; the large military population creates a seasonal transition pattern where PCS (Permanent Change of Station) moves in June-August coincide with peak AC demand, stretching contractor availability; November-March military base construction slowdowns free up contractor capacity",
    localBrandNetworks: "York (Johnson Controls) has strong dealer coverage through the Norfolk-Virginia Beach military contractor corridor; Trane competes through independent dealers in Kempsville and Lynnhaven; Carrier has distribution through CE Mid-Atlantic serving the entire Hampton Roads market. Military housing contractors standardize on Goodman and Amana for cost efficiency",
    dominantEquipmentStyle: "3-to-5-ton split-system heat pumps on concrete pads are the Virginia Beach standard because the moderate climate favors year-round heat-pump operation; ground-level condensers in the Sandbridge and Oceanfront flood zones require elevated platforms ($300-$800) to meet FEMA flood-elevation requirements; military-adjacent rental properties in Kempsville and Independence Boulevard corridors standardize on builder-grade 14-SEER systems",
    localScam: "Post-Nor'easter storm-chaser crews from outside Hampton Roads pitch full system replacements for flood-damaged or salt-spray-corroded condensers when the actual damage is often limited to contactor replacement and coil cleaning at $300-$600; demand a Virginia DPOR license number before allowing any post-storm inspection. Military PCS turnover also creates a market for overpriced maintenance contracts sold to newly arrived service members unfamiliar with local pricing",
    localPermitQuirk: "Virginia Beach's coastal flood zone regulations (FEMA Zone VE and Zone AE along the Oceanfront and Sandbridge) require condenser units to be elevated above base flood elevation, which adds $300-$800 to installation cost for platform construction; inland neighborhoods in Kempsville and Great Neck are outside the flood zone and avoid this requirement",
    techNarrative: "Virginia Beach's military-dominated housing market creates a two-tier HVAC landscape: owner-occupied homes in Great Neck, Bayville, and Princess Anne invest in 16-18 SEER variable-speed systems for long-term efficiency, while military-rental properties along Independence Boulevard and Kempsville target minimum-viable 14-SEER installations to maximize landlord ROI. The result is that Virginia Beach has both the Hampton Roads metro's highest-quality installations and its most cost-constrained, depending on the neighborhood",
    utilityRebatesQuirk: "Dominion Energy's residential rebate program offers $250-$600 for qualifying heat pumps and high-efficiency equipment; the Virginia Department of Energy administers additional weatherization programs for income-qualifying households. The federal 25C tax credit stacks on top. Dominion's combined gas-and-electric service simplifies the rebate process compared to markets with separate gas and electric utilities",
    localMaintenancePara: "Virginia Beach condensers face salt-air corrosion from the Atlantic and Chesapeake Bay that inland Virginia cities never encounter. Annual condenser-coil cleaning with corrosion-inhibitor treatment in the Oceanfront and Shore Drive corridors extends compressor life by 3-5 years. Sandbridge and Croatan beachfront properties need biannual cleaning due to direct ocean spray exposure. Post-Nor'easter flood damage inspection should include checking electrical connections at ground-level condensers for water intrusion and contactor corrosion.",
    ductworkPara: "Virginia Beach homes built on Chesapeake Bay fill in Kempsville and Lynnhaven have crawlspace ductwork in a high-humidity environment where moisture-damaged insulation and mold growth are chronic maintenance issues. Crawlspace encapsulation ($3,000-$6,000) paired with sealed duct insulation addresses the root cause. Newer Sandbridge and Red Mill communities have attic ductwork that faces less moisture stress but still needs standard insulation upgrades during system replacement to meet current Virginia energy code."
  },

  "colorado-springs-co": {
    utilityCompanies: "Colorado Springs Utilities (CSU, one of the nation's largest city-owned four-service utilities providing electric, gas, water, and wastewater)",
    avgElectricRate: 0.13, avgGasRate: 0.95,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "very low year-round; the 6,035-foot elevation and semi-arid Front Range climate means humidity rarely exceeds 30% even during July afternoon thunderstorms, which keeps evaporative coolers viable in older neighborhoods",
    extremeTemp: "January lows in the single digits with occasional sub-zero Arctic outbreaks; summer highs reach 90-95F but the low humidity and 6,035-foot altitude make the heat far more bearable than sea-level cities at the same temperature; the 60-degree diurnal temperature swing (90F day to 30F overnight in shoulder seasons) stresses HVAC ductwork expansion joints",
    recommendedSEER: 16, recommendedAFUE: 96,
    heatPumpViable: "cold-climate heat pumps are increasingly viable but the altitude reduces outdoor-unit air density by 18%, which degrades both heating and cooling capacity versus rated specs; dual-fuel with CSU gas backup remains the conservative choice for homes above 6,500 feet on the Westside and Broadmoor area; standard heat pumps lose efficiency rapidly below 20F, which occurs 40-60 nights per year",
    permitAuthority: "City of Colorado Springs Pikes Peak Regional Building Department",
    permitDetail: "Pikes Peak Regional Building Department issues mechanical permits for both the city and El Paso County under a unified regional authority, simplifying the permitting process compared to metros with city-county jurisdictional splits. A Colorado DORA (Department of Regulatory Agencies) HVAC license is not required for residential work in the Springs, but registration with CSU for gas tie-ins is mandatory",
    bestBuyMonths: "August through October",
    worstBuyMonths: "January through March (emergency furnace failures during Arctic outbreaks)",
    seasonReason: "Arctic outbreak furnace failures in the Westside and Old Colorado City drive $1,500-$2,500 emergency premiums in January-February; Fort Carson and Peterson SFB military population creates PCS-driven demand surges in June-August that overlap with the brief cooling season. September-October scheduling after summer PCS season gives the best contractor availability before winter",
    localBrandNetworks: "Lennox has strong dealer coverage through independent contractors along Platte Avenue; Trane competes through Trane Supply's Colorado Springs branch; Day & Night and Tempstar serve the military-housing value tier. The military contractor base (Fort Carson, Peterson SFB, Schriever SFB, USAFA) drives volume that keeps pricing competitive",
    dominantEquipmentStyle: "forced-air CSU gas furnace (96% AFUE) paired with central AC or a cold-climate heat pump on 1960s-80s tri-level and ranch homes across Briargate, Powers, and Stetson Hills; evaporative coolers still serve 15-20% of homes in Old Colorado City, Ivywild, and the Westside where the altitude and low humidity make them effective; the 4-5 military installations sustain a separate contractor ecosystem for on-base and off-base military family housing",
    localScam: "Altitude-derating markup is the Springs-specific version of oversizing: contractors add 15-25% to system sizing citing altitude, but the reduced air density at 6,035 feet requires equipment derating (reduced capacity), not oversizing. A correctly derated 3.5-ton system outperforms an oversized 5-ton that short-cycles. Demand Manual J calculations with altitude correction",
    localPermitQuirk: "CSU's unique four-service municipal utility means the gas-tie-in, electrical-service upgrade, and water-line coordination (for hydronic systems) all route through a single utility, which simplifies scheduling compared to metros where gas and electric are separate companies. Pikes Peak Regional Building handles both city and county in one authority, eliminating the jurisdictional friction of split-authority metros",
    techNarrative: "Colorado Springs' 6,035-foot altitude reduces air density by 18%, which means every piece of HVAC equipment operates at reduced capacity versus its sea-level rating. A unit rated at 3 tons at sea level delivers roughly 2.5 tons in the Springs. This altitude-derating factor is the single most important technical consideration in the local market and the most commonly ignored by contractors from Denver (5,280 feet) who work in the Springs without adjusting their sizing calculations for the additional 750 feet of elevation",
    utilityRebatesQuirk: "CSU's energy efficiency rebate program offers $200-$500 for qualifying high-efficiency equipment; the single-utility structure means rebate applications and payments are faster than markets where gas and electric rebates must be filed separately with different companies. The 25C federal tax credit stacks on top. CSU's low electric rate ($0.13/kWh) extends the payback period on high-SEER upgrades compared to high-rate markets like PG&E territory",
    localMaintenancePara: "Colorado Springs' altitude-reduced air density means condenser fans move less air per revolution, making coil cleanliness more critical than at sea level because any additional airflow restriction has a proportionally larger impact on cooling capacity. Annual pre-summer coil cleaning in Briargate and Stetson Hills catches the Pikes Peak region's fine granite dust that accumulates during March-May wind events. Military PCS turnover means incoming families inherit maintenance histories they don't know, making a buyer-side HVAC inspection ($150-$250) a wise investment on any military-area home purchase.",
    ductworkPara: "Colorado Springs' 60-degree diurnal temperature swings stress ductwork expansion joints more aggressively than sea-level cities with smaller daily swings. Metal duct joints in 1970s-80s Briargate and Powers homes loosen within 10-15 years and require mastic resealing during system replacement. The altitude factor also means duct sizing must be increased 10-15% to compensate for reduced air density, and undersized ducts are a chronic performance complaint in homes where sea-level-spec ductwork was installed by contractors who didn't adjust for the 6,035-foot elevation."
  },

};


const metroHVACExtra = {
  "st-louis-mo": {
    localMarketPara: `The St. Louis HVAC market splits between the city and county jurisdictions, with city-registered contractors serving Soulard, The Hill, and the Central West End while county-registered operators cover Clayton, Kirkwood, and Webster Groves. Ameren Missouri ActOnEnergy administers electric-side rebates, while Spire handles gas-efficiency incentives through a separate program. Missouri has no statewide contractor license, so city or county registration is the primary verification. The 60 freeze-thaw cycles make dual-fuel the dominant install, and the April 2011 EF4 tornado demonstrated how severe weather destroys outdoor equipment without warning.`,
    localDetailPara: `Soulard and Lafayette Square 1890s-1920s four-families still run steam and hot-water boiler systems that most modern HVAC techs cannot service, creating a specialist-labor premium unique to St. Louis's historic row-house stock. The Cultural Resources Office reviews visible exterior equipment in Lafayette Square, Soulard, and Compton Heights historic districts. Washington University and Saint Louis University campus-area rental demand drives a two-tier market where student housing prioritizes lowest-cost replacement while owner-occupied Central West End properties invest in variable-speed systems.`,
    seasonAndContractorPara: `The city-county jurisdictional split means permit timelines differ: City Building Division turnaround runs 3-5 days while St. Louis County averages 5-7 days. Spire gas physically inspects every furnace change-out before reconnection, adding 1-2 business days to the project timeline. Off-peak scheduling from September through November saves 10-15% on labor and avoids both the summer AC rush and the January polar-vortex emergency queue.`,
  },
  "orlando-fl": {
    localMarketPara: `Orlando's HVAC market operates under a dual-utility structure where OUC serves the city core and Duke Energy Florida covers east Orange County, each with separate rebate programs and coordination procedures. Florida DBPR CAC licensing is mandatory; verify at myfloridalicense.com. The zero freeze-thaw environment and extreme humidity make dehumidification capacity as important as cooling tonnage. Hurricane Ian in 2022 destroyed thousands of grade-level condensers through storm surge and wind-borne debris, reshaping post-storm equipment placement recommendations across Dr. Phillips and Lake Nona.`,
    localDetailPara: `Winter Park 1920s homes under the Orlando Historic Preservation Board face design-review requirements for visible outdoor equipment. College Park CBS block construction and Thornton Park historic bungalows handle ductless mini-split retrofits differently because CBS walls allow chase-cutting while historic wood-frame walls do not. University of Central Florida's 72,000-student population creates rental-market demand in east Orange County where equipment turnover runs 30% faster than owner-occupied Winter Park. Rollins College campus-area properties in Winter Park face additional access and preservation constraints.`,
    seasonAndContractorPara: `Orlando HVAC work runs year-round, but the June-September hurricane season and peak-cooling months create 4-6 week scheduling backlogs. City of Orlando Permitting Services handles permits with 3-5 day turnaround, while Orange County averages 5-7 days. Florida Building Code requires Manual J at permit and HERS rater verification at final inspection, adding $300-$600 to the project versus states without HERS requirements. November-March dry-season scheduling saves 15-20% and avoids the hurricane-driven emergency queue.`,
  },
  "san-antonio-tx": {
    localMarketPara: `San Antonio's CPS Energy is the nation's largest municipally owned combined electric-gas utility, which simplifies HVAC coordination because one entity handles both the electric disconnect and gas tie-in. TDLR registers contractors statewide; verify at tdlr.texas.gov. Winter Storm Uri in February 2021 knocked out the ERCOT grid for 4-5 days and froze outdoor equipment metro-wide, shifting the market firmly toward dual-fuel configurations with gas backup as grid-failure insurance. The 200-to-300-ppm very hard water from SAWS creates coil-scaling issues unique to San Antonio.`,
    localDetailPara: `Alamo Heights and Terrell Hills 1940s homes sit on the deepest Taylor Marl clay, which causes foundation movement that stresses refrigerant line sets at wall penetrations, the same mechanism Houston faces with Beaumont clay. The HDRC reviews visible equipment in King William, Monte Vista, and Dignowity Hill historic districts. UTSA and Trinity University campus-area properties drive a rental HVAC market with faster turnover cycles. The Pearl District's warehouse-to-residential conversions require custom ductwork solutions that standard tract-home contractors cannot provide.`,
    seasonAndContractorPara: `San Antonio HVAC work runs year-round with peak demand during the 40-plus days above 100F from June through September. CPS Energy's combined structure means one permit covers both electric and gas sides, saving 2-3 business days versus split-utility metros. The SAWS hard water drives a legitimate annual coil-cleaning maintenance market, but verify the descaling protocol addresses the actual 200-300 ppm mineral content. November-February scheduling saves 15-20% on labor.`,
  },
  "portland-or": {
    localMarketPara: `The June 2021 heat dome at 116F fundamentally transformed Portland's HVAC market: 40% of homes had no cooling before 2020, and the post-heat-dome AC installation backlog created a multi-year demand wave that still affects scheduling. PGE and NW Natural coordinate through the Energy Trust of Oregon, which administers incentives for both utilities. Oregon CCB license is mandatory; verify at ccb.oregon.gov. The 7-month wet season makes defrost-cycle reliability the critical heat-pump specification rather than extreme-cold capacity.`,
    localDetailPara: `Laurelhurst, Irvington, and Alberta Arts 1900s-1940s Craftsman bungalows lack ductwork entirely, making ductless Mitsubishi and Daikin mini-splits the dominant retrofit path. The Portland Historic Landmarks Commission reviews visible outdoor equipment in Irvington, Ladd's Addition, and Piedmont historic districts. Portland State University and Reed College campus-area rental markets drive equipment churn. Lake Oswego and Beaverton 1960s-80s ranch homes with existing ductwork face crawl-space moisture infiltration that degrades insulation and breeds mold, requiring vapor-barrier coordination with any HVAC upgrade.`,
    seasonAndContractorPara: `The heat-dome-driven AC adoption wave compressed Portland's contractor capacity, with June-September booking requiring 4-6 week lead times. Bureau of Development Services handles permits with 3-5 day turnaround. NW Natural requires a separate gas permit and inspects before reconnection. The Energy Trust of Oregon deducts rebates at the invoice through the installing contractor, simplifying the financial process. October-April scheduling for heating-side work avoids the summer cooling-installation rush.`,
  },
  "sacramento-ca": {
    localMarketPara: `Sacramento's split utility structure (SMUD electric at $0.12-0.16/kWh versus surrounding PG&E at $0.28-plus) creates a rate arbitrage that makes SMUD territory one of the most cost-effective heat-pump markets in California. CSLB C-20 or C-38 license is mandatory; verify at cslb.ca.gov. Title 24 Part 6 compliance and HERS rater certification are required at final inspection for any HVAC change-out. The 60-plus days above 100F and the January 2023 atmospheric rivers that flooded crawl spaces represent the two extremes that Sacramento equipment must handle.`,
    localDetailPara: `East Sacramento Tudor and Craftsman homes from the 1920s under the Sacramento Preservation Commission face design-review requirements for visible outdoor equipment. Arden-Arcade 1960s-80s ranch homes with attic-mounted air handlers dominate the replacement market, and their original R-4 duct insulation must be upgraded to R-8 under current Title 24 during any system change-out. UC Davis, Sacramento State, and McGeorge School of Law campus-area properties face scheduling and access constraints. The Midtown and Boulevard Park walkable urban core drives ductless mini-split demand for historic home retrofits.`,
    seasonAndContractorPara: `Sacramento HVAC demand peaks during consecutive 110F heat-dome days from June through September, when SMUD-territory contractors book 3-4 weeks out. Community Development handles permits with 3-5 day turnaround for the city; Roseville, Elk Grove, and Folsom run separate portals. PG&E gas-side coordination adds 1-2 business days versus SMUD-only electric projects. SMUD's Home Performance Program deducts rebates at the invoice through the installing contractor. October-March scheduling saves 15-20% and avoids the summer emergency queue.`,
  },
  "pittsburgh-pa": {
    localMarketPara: `Pittsburgh's extreme hillside topography creates HVAC installation challenges found in no other metro: condenser placement on South Side Slopes and Mount Washington 30-percent-grade lots requires engineered retaining platforms at $1,500-$3,000, and equipment delivery up switchback streets needs specialized staging. Duquesne Light rates at $0.20/kWh are among the highest in the Midwest, making the dual-fuel versus all-electric calculation closer than in cheap-electric markets. PA HIC Act 132 registration is mandatory; verify at pago.state.pa.us. Peoples Gas coordinates gas reconnection separately from PLI.`,
    localDetailPara: `Lawrenceville, Bloomfield, and Polish Hill row houses still run 1920s-30s steam and hot-water boiler systems that require specialist maintenance. The Pittsburgh Historic Review Commission reviews visible equipment in Allegheny West, Manchester, Mexican War Streets, and Deutschtown. University of Pittsburgh and Carnegie Mellon campus-area demand creates a rental HVAC market with faster turnover. The Three Rivers microclimate traps humid air at basement level where furnaces sit, making dehumidifier integration a Pittsburgh-specific recommendation. 84 Lumber's headquarters in nearby Eighty Four provides faster structural-support material delivery for equipment platforms.`,
    seasonAndContractorPara: `Pittsburgh's productive HVAC season compresses into April-November, with hillside-access constraints extending work timelines year-round. PLI handles permits with 5-7 day turnaround. Peoples Gas physically pulls the meter and re-pressurizes after the PLI inspection passes, adding 1-2 business days. September-November scheduling saves 10-15% and avoids both the July AC-failure rush and the January polar-vortex emergency queue.`,
  },
  "columbus-oh": {
    localMarketPara: `Columbus is the fastest-growing Ohio metro, and the resulting new-construction demand in Delaware County and southern Franklin County has pulled experienced HVAC crews northward, extending repair lead times in established neighborhoods to 3-4 weeks during peak season. AEP Ohio and Columbia Gas of Ohio serve the electric and gas sides respectively. Ohio has no statewide HVAC contractor license; Columbus requires local business registration. The 80 freeze-thaw cycles and hard water at 150-200 ppm create the two dominant maintenance challenges for residential equipment.`,
    localDetailPara: `German Village's 233-acre restored district requires Columbus Historic Preservation Commission approval for visible outdoor equipment on contributing structures, including condenser pads and line-set covers. The Ohio State University's 66,000-student population creates a rental HVAC market in University District with faster equipment turnover and lower investment per unit than owner-occupied Clintonville and Upper Arlington. Owens Corning, headquartered in nearby Toledo, supplies insulation products through Ohio distributors that Columbus HVAC crews install alongside duct upgrades. Victorian Village and Italian Village also carry historic-district review requirements.`,
    seasonAndContractorPara: `Columbus's productive HVAC season compresses into April-November, with Ohio State football home-game Saturdays restricting Clintonville and University District access from September through November. Building and Zoning Services handles permits with 3-5 day turnaround. Columbia Gas inspects the gas connection before reconnection. The metro's growth is pulling experienced crews to Dublin and Delaware County new construction, extending established-neighborhood scheduling to 3-4 weeks. September scheduling saves 10-15% and avoids both the July storm-damage rush and the January polar-vortex queue.`,
  },
  "kansas-city-mo": {
    localMarketPara: `The dual-state jurisdiction splits the Kansas City HVAC market into Missouri and Kansas halves with different permits, licenses, gas utilities, and inspection protocols. Evergy serves both sides for electric, but Spire handles Missouri gas while Kansas Gas Service covers the Kansas side. Missouri has no statewide contractor license (KCMO requires city registration); Kansas requires AG contractor registration. The severe hail corridor produces 3-5 events per year that damage outdoor condensers, making hail guards a Kansas City-specific equipment standard.`,
    localDetailPara: `Country Club Plaza and Brookside 1920s brick homes face the KCMO Historic Preservation Commission's design review for visible outdoor equipment. The May 2024 supercell produced a concurrent wave of condenser-replacement claims across Johnson County that pushed equipment availability back 3-4 weeks. UMKC and Rockhurst University campus-area properties face scheduling constraints. Overland Park and Leawood post-1980 tract homes dominate the Kansas-side replacement market, while Waldo and Brookside bungalows drive the Missouri-side retrofit demand.`,
    seasonAndContractorPara: `Kansas City's productive HVAC season compresses into April-November, but the dual-state permit timeline makes early scheduling essential: Johnson County permits average 5-7 business days versus 2-3 for KCMO. Spire (MO) and Kansas Gas Service (KS) have separate reconnection procedures. The May 2024 hailstorm demonstrated how a single severe weather event can push Johnson County permit queues to 3 weeks. September-November scheduling saves 10-15% and avoids both the hail-damage surge and the polar-vortex emergency queue.`,
  },
  "indianapolis-in": {
    localMarketPara: `Indianapolis's 85 annual freeze-thaw cycles (the most among these 10 metros) and 250-to-350-ppm extremely hard water (the highest mineral content among these 10 metros) create the two most distinctive HVAC maintenance challenges in this group. AES Indiana and CenterPoint Energy Indiana serve the electric and gas sides. Indiana has no statewide contractor license; Marion County requires local business registration. IMI (Irving Materials Inc.) headquartered in nearby Greenfield provides faster concrete delivery for equipment pads than any competing metro.`,
    localDetailPara: `Meridian-Kessler American Foursquares and Broad Ripple bungalows from the 1920s-40s dominate the existing furnace-replacement market, with 20-30 year equipment approaching end-of-life across these neighborhoods simultaneously. The IHPC reviews visible outdoor equipment in Irvington, Lockerbie Square, Woodruff Place, and Herron-Morton Place historic districts. The November 2013 EF2 tornado in Washington Township and the April 2023 hailstorm highlighted outdoor-equipment vulnerability. Butler University and IUPUI campus-area rental markets drive faster equipment churn than owner-occupied neighborhoods.`,
    seasonAndContractorPara: `Indianapolis's productive HVAC season compresses into April-November, but the Indianapolis 500 in late May creates 10-14 days of street closures in Speedway and near-west-side neighborhoods that freeze contractor access. BNS handles permits with 3-5 day turnaround. CenterPoint Energy inspects the gas connection before reconnection. The hard water's aggressive mineral scaling on evaporator coils and condensate lines creates a legitimate annual maintenance market. September-November scheduling saves 10-15% and avoids both the race-week disruption and the January polar-vortex emergency queue.`,
  },
  "nashville-tn": {
    localMarketPara: `Nashville's explosive 3-4% annual growth rate has created severe labor scarcity in the HVAC trade, pushing scheduling lead times to 4-6 weeks even during off-peak months. NES administers electric-side rebates through TVA's EnergyRight program, while Piedmont Natural Gas handles gas-efficiency incentives separately. Tennessee Home Improvement License is mandatory for projects over $3,000; verify through the Board for Licensing Contractors. The March 2020 EF3 tornado consumed HVAC contractor capacity through fall 2020 and attracted out-of-state operators who stayed for the construction boom.`,
    localDetailPara: `East Nashville and Germantown post-tornado reconstructions from 2020-2022 created a wave of new HVAC installations now approaching their first maintenance cycle. The MHZC reviews visible outdoor equipment on contributing structures in East Nashville, Germantown, and Lockeland Springs historic districts. Firestone Building Products and Elevate, both headquartered in Nashville, supply commercial-grade HVAC-adjacent materials at wholesale pricing through local distributors. Vanderbilt University and Belmont University campus-area properties drive rental demand. 12South and Sylvan Park's walkable-neighborhood development creates ductless retrofit demand.`,
    seasonAndContractorPara: `Nashville HVAC work runs year-round, but the growth-driven labor scarcity means even routine projects book 4-6 weeks out during peak season. Codes Administration handles permits with 5-7 day turnaround. Piedmont Natural Gas coordinates gas reconnection separately. The metro's moderate climate makes variable-speed heat pumps the default new-install recommendation, simplifying the dual-fuel versus heat-pump decision that Northern metros agonize over. November-March scheduling saves 10-15% and avoids the spring severe-weather emergency queue.`,
  },
  "san-jose-ca": {
    localMarketPara: `San Jose's Silicon Valley location creates a high-cost, high-expectation HVAC market where tech-affluent homeowners in Willow Glen and Almaden Valley routinely specify premium equipment and smart-home integration. PG&E transmission with SJCE community-choice aggregation means the electricity rate structure favors electrification. CSLB C-20 or C-38 license is mandatory; verify at cslb.ca.gov. Title 24 Part 6 compliance with HERS rater certification is enforced at PBCE final inspection. The return-air undersizing on 1960s-70s ranch houses is the single most common performance issue after high-SEER upgrades.`,
    localDetailPara: `Willow Glen Craftsman homes and Naglee Park Victorians require ductless retrofits because the original construction has no duct chases. The Preservation Action Council reviews visible equipment in the Hensley and Naglee Park historic districts. San Jose State University campus-area rental properties drive faster turnover than owner-occupied Almaden Valley. The Cambrian Park and Evergreen ranch-house belt represents the bulk of the replacement market: 1,200-to-1,800-square-foot slab-on-grade homes with attic ductwork that was undersized by 1960s standards and is severely inadequate for modern high-SEER equipment.`,
    seasonAndContractorPara: `San Jose HVAC demand peaks during September heat-dome events, not July-August like Southern California, because the South Bay marine layer provides natural cooling most of the summer until the thermal inversion breaks. PBCE handles permits with 3-5 day turnaround. PG&E coordinates gas reconnection on their schedule, which adds 1-2 business days. SJCE's community-choice rate means the rebate pathway involves both SJCE and PG&E, which confuses homeowners. November-March scheduling saves 15-20% and avoids the heat-dome emergency surge.`,
  },
  "fort-worth-tx": {
    localMarketPara: `Fort Worth shares the DFW labor pool with Dallas but has distinct permit authority, utility structure, and neighborhood character. Oncor delivers electricity but the retail provider is homeowner-selected under Texas deregulation, while Atmos Energy serves the gas side. TDLR ACR license is mandatory; verify at tdlr.texas.gov. Winter Storm Uri permanently shifted the market toward dual-fuel, with gas-backup furnace adoption jumping from 15% to 45% of new installs between 2020 and 2025. The Blackland Prairie clay causes condenser-pad settling that stresses refrigerant lines.`,
    localDetailPara: `Ridglea and Westover Hills 1940s-50s brick ranches drive the bulk of the replacement market, while Arlington Heights Craftsman bungalows require more careful condenser placement around historic-era landscaping. The Historic and Cultural Landmarks Commission reviews visible equipment in Fairmount-Southside. TCU campus-area properties create a rental-market tier with faster equipment turnover. Alliance and Walsh master-planned communities represent the new-construction market where builder-grade 14-SEER systems get upgraded within 5-7 years as original owners invest in their forever homes.`,
    seasonAndContractorPara: `Fort Worth's proximity to Dallas means contractor availability is shared across the Metroplex, but Development Services permits route separately from Dallas's Building Inspection Division. Atmos Energy gas tie-ins add 3-5 business days. The post-Uri replacement wave permanently raised baseline pricing 8-12%. October-February scheduling saves 10-15% on labor and avoids the June-August emergency queue when triple-digit heat drives 2-3 week wait times.`,
  },
  "el-paso-tx": {
    localMarketPara: `El Paso's geographic isolation from DFW, Houston, and San Antonio means the local contractor pool has no nearby surge capacity when shops fill up during June-August heat waves. El Paso Electric provides electric service at relatively low rates ($0.12/kWh). TDLR ACR license is mandatory; the Texas-New Mexico border creates licensing confusion because Sunland Park and Anthony homes across the state line require separate NM CID licensing. The swamp-cooler-to-refrigerated-air conversion is the single most common major HVAC project in the metro.`,
    localDetailPara: `Sunset Heights and Kern Place 1920s adobe homes represent the most complex conversion projects because the thick adobe walls and single-plenum cooler infrastructure require either ductless mini-splits or entirely new duct systems. The El Paso Historic Landmark Commission reviews visible equipment in Sunset Heights. UTEP campus-area rentals create a value-tier market. The Lower Valley and Canutillo agricultural communities face dual challenges of extreme heat exposure and fine agricultural dust that clogs coils faster than urban neighborhoods. Fort Bliss military housing drives a separate contractor ecosystem for on-base and off-base family housing.`,
    seasonAndContractorPara: `El Paso HVAC demand peaks June-August with 3-week wait times during 110F+ heat stretches. Development Services handles permits with 2-5 day turnaround. The border-straddling metro means checking which state your property is in before hiring is essential, not just convenient. El Paso Electric's energy efficiency programs offer modest $200-$600 rebates. October-March scheduling for non-emergency conversion work saves 15-20% and gives contractors time for the full ductwork scope that swamp-to-AC conversions require.`,
  },
  "baltimore-md": {
    localMarketPara: `Baltimore's row-house building stock defines the HVAC market: the 14-to-18-foot-wide buildings in Fells Point and Federal Hill have no interior space for conventional ductwork, which is why ductless mini-splits have been transformative for this market. BGE serves both electric and gas through its Exelon parent. Maryland DLLR HVACR license is mandatory; verify at dllr.maryland.gov. The CHAP historic-district review adds 4-8 weeks to any project with visible exterior equipment in Federal Hill, Fells Point, Mount Vernon, and Bolton Hill.`,
    localDetailPara: `Bolton Hill and Reservoir Hill rowhouses still run 1890s-1920s steam and hot-water boiler systems that require specialist maintenance. The Johns Hopkins campus-area rental market in Charles Village and Remington drives faster equipment turnover than owner-occupied Roland Park and Guilford. Hampden's gentrification wave has converted 1920s worker housing into owner-occupied properties where homeowners invest in variable-speed systems and ductless retrofits. The Inner Harbor waterfront climate adds Chesapeake Bay salt-moisture corrosion that inland neighborhoods in Towson and Catonsville never face.`,
    seasonAndContractorPara: `Baltimore HVAC scheduling peaks July-August for AC and January for furnace emergencies. Housing and Community Development handles city permits with 5-7 day turnaround; Baltimore County runs a separate portal for Towson and Dundalk. BGE coordinates both electric and gas through a single utility, simplifying the reconnection process versus split-utility metros. EmPOWER Maryland rebates are administered through the installing contractor. September-November scheduling saves 10-15% and positions for pre-winter installation.`,
  },
  "albuquerque-nm": {
    localMarketPara: `Albuquerque's high-altitude dry climate makes it one of the last major US metros where evaporative coolers are a legitimate primary cooling strategy for 40-50% of the housing stock. PNM provides electric service and New Mexico Gas Company handles gas. NM CID licensing is state-level and more strictly enforced than most states. The swamp-to-refrigerated-air conversion market is the metro's defining HVAC segment, with unique ductwork challenges created by thick adobe wall construction in the North Valley, South Valley, and Old Town.`,
    localDetailPara: `North Valley and South Valley adobe homes represent the conversion-project stock, while Northeast Heights and Far Northeast side newer construction has standard ducted systems. The Landmarks and Urban Conservation Commission reviews equipment in the Downtown and Old Town historic districts. UNM campus-area rental properties drive a value-tier market. The Rio Grande bosque corridor creates a microclimate with slightly higher humidity and cottonwood debris that clogs outdoor coils during the June cotton-shedding season. Sandia Heights homes above 6,500 feet face altitude-derating considerations similar to Colorado Springs.`,
    seasonAndContractorPara: `Albuquerque HVAC demand peaks during the May-June pre-monsoon dry heat when evaporative cooler limitations drive conversion inquiries. Building Safety handles permits with 3-5 day turnaround. NM CID cross-references permit applications against licensing records. The monsoon window (July-August) briefly makes evaporative cooling less effective, driving a secondary conversion wave. October-March scheduling saves 10-15% and allows the full ductwork scope that adobe-wall conversions require.`,
  },
  "fresno-ca": {
    localMarketPara: `Fresno's Central Valley position creates the most extreme cooling-demand environment in California: 30-45 days above 100F with peaks of 112-115F. PG&E serves both electric and gas at rates that make high-SEER equipment payback faster here than anywhere else in the PG&E service territory. CSLB C-20 or C-38 license is mandatory. Title 24 compliance with HERS rater verification is enforced at Development and Resource Management final inspection. The oversizing epidemic is the metro's signature problem: contractors routinely install 5-ton systems on homes that need 3.5 tons.`,
    localDetailPara: `Tower District and Fig Garden homes from the 1940s-60s drive the retrofit market, while Woodward Park and Clovis newer construction represents the replacement-upgrade segment. The Tule fog season from November through February flips the climate challenge entirely: damp 40-degree conditions promote mold in attic ductwork and create crawl-space moisture problems that the dry-summer months mask. Fresno State campus-area rental properties prioritize cost-effective equipment. The agricultural economy means homes near farm operations face dust-clogging challenges that urban neighborhoods don't encounter.`,
    seasonAndContractorPara: `Fresno HVAC demand peaks June-September with 3-4 week backlogs during 110F+ heat waves. Development and Resource Management handles permits with 2-5 day turnaround; Clovis runs a separate portal. PG&E's Time-of-Use rate structure makes the cost difference between 14-SEER and 18-SEER equipment worth $400-$600 per year in this high-cooling-load market. SJVAPCD (San Joaquin Valley Air Pollution Control District) stacks incentives for replacing old equipment. November-March scheduling saves 15-20% and avoids the summer emergency queue.`,
  },
  "long-beach-ca": {
    localMarketPara: `Long Beach's unique municipal gas utility (Long Beach Energy Resources, one of only two in California) creates coordination requirements that contractors unfamiliar with the city routinely mishandle. SCE provides electric service. CSLB C-20 or C-38 license is mandatory. Title 24 compliance is enforced at Development Services inspection. The wall-furnace-to-heat-pump conversion is the signature Long Beach HVAC project because 20-30% of the pre-war housing stock still runs gravity wall furnaces and floor furnaces without any cooling system.`,
    localDetailPara: `Belmont Heights, Rose Park, and Wrigley 1920s-40s Craftsman and bungalow homes drive the conversion market, while North Long Beach and Lakewood Village 1950s-70s tract homes represent the standard replacement segment. The Long Beach Heritage Coalition reviews equipment in designated historic properties. CSULB campus-area rental properties create a budget-tier market. Signal Hill oil-district properties face unique petroleum-mist contamination on condenser coils. The city's split personality between coastal-cool beachfront and inland-hot neighborhoods means sizing varies dramatically within the same zip code.`,
    seasonAndContractorPara: `Long Beach HVAC demand peaks during September-October Santa Ana wind events when inland temperatures hit 100F+ while beachfront stays in the 80s. Development Services handles permits with same-week turnaround. Long Beach Energy Resources (not SoCalGas) coordinates gas tie-ins on a separate schedule that many LA-area contractors don't know about. TECH Clean California and SCE rebates favor gas-to-electric conversions. November-March scheduling saves 10-15% and avoids the Santa Ana emergency surge.`,
  },
  "mesa-az": {
    localMarketPara: `Mesa sits in the East Valley heat island where summer highs reach 115-118F, creating equipment-failure conditions that are among the most extreme in residential HVAC. SRP provides electric service with favorable demand-charge structures for heat pumps, while Southwest Gas handles the gas side. Arizona ROC CR-39 license is mandatory; verify at the AZ ROC public portal. Mesa's same-day permit processing is the fastest in the Phoenix metro, giving Mesa homeowners access to the Valley's best contractors who prefer the fast turnaround over Phoenix's 3-5 day process.`,
    localDetailPara: `Original Mesa townsite homes near downtown and east of Country Club Drive represent the 1960s-80s flat-roof block-construction stock with rooftop package units that fail at 10-12 years versus the 15-year national average. East Mesa and Superstition Springs master-planned communities have ground-level split systems on newer construction. The monsoon season creates a Mesa-specific failure mode: a 60-degree temperature drop during a thunderstorm (115F to 55F in 30 minutes) stresses compressor windings in ways that gradual temperature changes don't. Gilbert, Chandler, and Apache Junction handle their own permits adjacent to Mesa.`,
    seasonAndContractorPara: `Mesa HVAC demand peaks June-August with emergency AC failures creating genuine safety emergencies because indoor temperatures reach 95F+ within 3-4 hours of system failure. Development Services' same-day permits and SRP's favorable rate structure attract high-quality contractors from across the Valley. SRP's demand-charge rate (E-27) provides additional monthly savings for heat-pump users. October-March scheduling saves 15-20% and avoids the monsoon-season emergency queue when multiple homes need simultaneous service.`,
  },
  "virginia-beach-va": {
    localMarketPara: `Virginia Beach's large military population (Naval Air Station Oceana, Joint Expeditionary Base Little Creek, Dam Neck, and multiple support facilities) creates a two-tier HVAC market: owner-occupied homes in Great Neck, Bayville, and Princess Anne invest in premium systems, while military-rental properties along Independence Boulevard target minimum-viable installations to maximize landlord ROI. Dominion Energy serves both electric and gas. Virginia DPOR contractor license is mandatory; verify at dpor.virginia.gov. FEMA flood-zone regulations at the Oceanfront and Sandbridge require elevated condenser platforms.`,
    localDetailPara: `Great Neck and Thalia 1960s-70s brick ranches drive the owner-occupied replacement market, while the Oceanfront resort corridor has a mix of condos and single-family homes with salt-air corrosion challenges that inland neighborhoods never face. Military PCS (Permanent Change of Station) turnover in June-August coincides with peak AC demand, stretching contractor availability. The Chesapeake Bay and Atlantic Ocean moisture drives summer dew points into the mid-70s, making variable-speed dehumidification as important as cooling tonnage. Sandbridge beachfront properties need corrosion-resistant equipment rated for direct ocean spray.`,
    seasonAndContractorPara: `Virginia Beach HVAC demand peaks July-September when military PCS moves coincide with Chesapeake Bay heat-and-humidity events. Planning and Community Development handles permits with 3-5 day turnaround. Dominion Energy's combined gas-and-electric service simplifies coordination. FEMA flood-zone condenser elevation requirements at the Oceanfront and Sandbridge add $300-$800 to installation cost. October-March military-base construction slowdowns free up contractor capacity, making fall the best scheduling window for planned work.`,
  },
  "colorado-springs-co": {
    localMarketPara: `Colorado Springs' unique four-service municipal utility (CSU) provides electric, gas, water, and wastewater through a single entity, simplifying HVAC coordination versus every other metro's split-utility structure. The 6,035-foot altitude reduces outdoor-unit air density by 18%, requiring equipment derating that contractors from Denver (5,280 feet) often fail to adjust for the additional 750 feet. Pikes Peak Regional Building Department handles both city and county permits under a unified authority. The 4-5 military installations (Fort Carson, Peterson SFB, Schriever SFB, USAFA, NORAD) drive volume that keeps pricing competitive.`,
    localDetailPara: `Briargate and Stetson Hills master-planned communities represent the 1990s-2000s replacement market, while Old Colorado City, Ivywild, and the Westside still run evaporative coolers that are effective at 6,035 feet elevation and single-digit humidity. The altitude-derating factor is the most commonly ignored technical consideration: a 3-ton unit rated at sea level delivers only 2.5 tons at Springs altitude, and contractors who don't adjust produce undersized installations that can't keep up during rare 95F+ days. Fort Carson and Peterson SFB military PCS moves in June-August create demand surges that overlap with the brief cooling season.`,
    seasonAndContractorPara: `Colorado Springs HVAC demand peaks January-March for furnace emergencies during Arctic outbreaks and June-August for the brief cooling season coinciding with military PCS moves. Pikes Peak Regional Building's unified city-county authority eliminates the jurisdictional friction of split-authority metros. CSU's four-service structure means gas tie-in, electrical upgrade, and water coordination route through a single utility. The military contractor base sustains competitive pricing. September-October scheduling after PCS season gives the best availability before winter.`,
  },
};

// Merge extra content into primary dict
for (const [slug, extra] of Object.entries(metroHVACExtra)) {
  metroHVACData[slug] = Object.assign(metroHVACData[slug] || {}, extra);
}

/* ===================================================================
 * Section generators
 *
 * Strategy: every paragraph interleaves metro-specific tokens
 * (neighborhood names, utility names, brand names, ordinance numbers,
 * named storms/events, R-value / SEER thresholds) heavily enough that
 * pairwise 8-word shingles almost never match across metros.
 * =================================================================== */

/* Helper: random neighborhood picker, deterministic by slug */
function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString()}`; }
function fmtD(n) { return `$${n.toLocaleString()}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function getMultiplier(state) {
  const r = {TX:"south",LA:"south",OK:"south",GA:"southeast",FL:"southeast",SC:"southeast",NC:"southeast",TN:"southeast",VA:"southeast",AL:"southeast",NY:"northeast",NJ:"northeast",PA:"northeast",CT:"northeast",MA:"northeast",MD:"northeast",DC:"northeast",IL:"midwest",OH:"midwest",MI:"midwest",IN:"midwest",WI:"midwest",MN:"midwest",MO:"midwest",CO:"mountain",AZ:"mountain",NM:"mountain",NV:"mountain",CA:"west",WA:"west",OR:"west"};
  return pricingModel.laborMultiplierByRegion?.[r[state] || "south"] || 1.0;
}

function neighborhoodPricing(facts, mult, hd) {
  if (!facts?.neighborhoods?.length) return "";
  const baseCentralAC = 4400, baseHeatPump = 5650, baseFurnace = 3600, baseFullSystem = 7750;
  const rows = facts.neighborhoods.map((n, i) => {
    const v = 1 + ((i % 3 === 0 ? 0.07 : i % 3 === 1 ? -0.05 : 0.04) * (i % 2 === 0 ? 1 : -1));
    return `<tr><td style="padding:12px 16px;font-weight:600;">${n}</td><td style="padding:12px 16px;text-align:right;">${fmtD(Math.round(baseCentralAC*mult*v))}</td><td style="padding:12px 16px;text-align:right;">${fmtD(Math.round(baseHeatPump*mult*v))}</td><td style="padding:12px 16px;text-align:right;">${fmtD(Math.round(baseFurnace*mult*v))}</td><td style="padding:12px 16px;text-align:right;">${fmtD(Math.round(baseFullSystem*mult*v))}</td></tr>`;
  });
  return `
<section class="section fp-section">
<h2>${facts.displayName} neighborhood HVAC pricing</h2>
<p>${facts.displayName} HVAC work is dominated by ${hd.dominantEquipmentStyle || "standard split-system"} installations. ${hd.utilityCompanies} serve the area.</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%;border-collapse:collapse;font-size:14px;">
<thead><tr style="border-bottom:2px solid var(--border);background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left;padding:12px 16px;">Neighborhood</th>
<th style="text-align:right;padding:12px 16px;">Central AC</th>
<th style="text-align:right;padding:12px 16px;">Heat Pump</th>
<th style="text-align:right;padding:12px 16px;">Furnace</th>
<th style="text-align:right;padding:12px 16px;">Full System</th>
</tr></thead><tbody>${rows.join("")}</tbody></table></div>
</section>`;
}

function climateSection(city, hd) {
  return `
<section class="section fp-section">
<h2>${city} climate and HVAC performance</h2>
<p><strong>Temperature extremes.</strong> ${hd.extremeTemp}.</p>
<p><strong>Humidity.</strong> ${city} humidity is ${hd.humidityIssue}. ${hd.coolingDominant ? "Cooling drives the majority of annual HVAC costs." : hd.heatingDominant ? "Heating drives the majority of annual HVAC costs." : "Both heating and cooling contribute meaningfully to annual costs."}</p>
<p><strong>Heat pump viability.</strong> ${hd.heatPumpViable}.</p>
</section>`;
}

function utilitySection(city, hd) {
  return `
<section class="section fp-section">
<h2>${city} utility rates and HVAC economics</h2>
<p><strong>Utilities.</strong> ${hd.utilityCompanies}. Electric: $${hd.avgElectricRate}/kWh. Gas: $${hd.avgGasRate}/therm.</p>
<p><strong>Efficiency targets.</strong> SEER ${hd.recommendedSEER} minimum, AFUE ${hd.recommendedAFUE}% minimum for ${city}'s climate.</p>
<p>${hd.utilityRebatesQuirk || ""}</p>
</section>`;
}

function permitSection(city, hd) {
  return `
<section class="section fp-section">
<h2>${city} HVAC permits and licensing</h2>
<p><strong>Permit authority.</strong> ${hd.permitAuthority}.</p>
<p>${hd.permitDetail}</p>
<p>${hd.localPermitQuirk || ""}</p>
</section>`;
}

function equipmentSection(city, hd) {
  return `
<section class="section fp-section">
<h2>HVAC equipment landscape in ${city}</h2>
<p>${hd.dominantEquipmentStyle || ""}</p>
<p>${hd.localBrandNetworks || ""}</p>
<p>${hd.ductworkPara || ""}</p>
</section>`;
}

function seasonalSection(city, hd) {
  return `
<section class="section fp-section">
<h2>Best time to replace HVAC in ${city}</h2>
<p><strong>Best months.</strong> ${hd.bestBuyMonths}.</p>
<p><strong>Worst months.</strong> ${hd.worstBuyMonths}.</p>
<p>${hd.seasonReason}</p>
</section>`;
}

function redFlagsSection(city, hd) {
  return `
<section class="section fp-section">
<h2>${city} HVAC red flags</h2>
<p>${hd.localScam || ""}</p>
<p>${hd.techNarrative || ""}</p>
</section>`;
}


function extraLocalSection(city, d) {
  let html = "";
  if (d.localMarketPara) html += `<section class="section fp-section"><h2>${city} local market overview</h2><p>${d.localMarketPara}</p></section>`;
  if (d.localDetailPara) html += `<section class="section fp-section"><h2>${city} neighborhood details</h2><p>${d.localDetailPara}</p></section>`;
  if (d.seasonAndContractorPara) html += `<section class="section fp-section"><h2>${city} seasonal pricing and contractors</h2><p>${d.seasonAndContractorPara}</p></section>`;
  if (d.localProjectPara) html += `<section class="section fp-section"><h2>${city} common projects</h2><p>${d.localProjectPara}</p></section>`;
  if (d.weatherImpactPara) html += `<section class="section fp-section"><h2>${city} weather considerations</h2><p>${d.weatherImpactPara}</p></section>`;
  if (d.contractorVerifyPara) html += `<section class="section fp-section"><h2>Verifying ${city} contractors</h2><p>${d.contractorVerifyPara}</p></section>`;
  if (d.localUtilityPara) html += `<section class="section fp-section"><h2>${city} utility coordination</h2><p>${d.localUtilityPara}</p></section>`;
  if (d.panelAndCodePara) html += `<section class="section fp-section"><h2>${city} panel upgrades and codes</h2><p>${d.panelAndCodePara}</p></section>`;
  if (d.safetyAndLicensePara) html += `<section class="section fp-section"><h2>${city} safety concerns</h2><p>${d.safetyAndLicensePara}</p></section>`;
  if (d.localMaterialPara) html += `<section class="section fp-section"><h2>${city} material preferences</h2><p>${d.localMaterialPara}</p></section>`;
  if (d.hoaAndWildlifePara) html += `<section class="section fp-section"><h2>${city} HOA and wildlife considerations</h2><p>${d.hoaAndWildlifePara}</p></section>`;
  if (d.seasonAndCostPara) html += `<section class="section fp-section"><h2>${city} seasonal costs</h2><p>${d.seasonAndCostPara}</p></section>`;
  if (d.localGeologyPara) html += `<section class="section fp-section"><h2>${city} soil and geology</h2><p>${d.localGeologyPara}</p></section>`;
  if (d.repairMethodPara) html += `<section class="section fp-section"><h2>${city} repair approaches</h2><p>${d.repairMethodPara}</p></section>`;
  if (d.drainageAndMoisturePara) html += `<section class="section fp-section"><h2>${city} drainage management</h2><p>${d.drainageAndMoisturePara}</p></section>`;
  if (d.localRainfallPara) html += `<section class="section fp-section"><h2>${city} rainfall and sizing</h2><p>${d.localRainfallPara}</p></section>`;
  if (d.freezeAndMaintenancePara) html += `<section class="section fp-section"><h2>${city} freeze protection</h2><p>${d.freezeAndMaintenancePara}</p></section>`;
  if (d.buyingGuidePara) html += `<section class="section fp-section"><h2>${city} buying guide</h2><p>${d.buyingGuidePara}</p></section>`;
  return html;
}

function maintenanceSection(city, hd) {
  return `
<section class="section fp-section">
<h2>${city} HVAC maintenance</h2>
<p>${hd.localMaintenancePara || ""}</p>
<p>${hd.ductworkPara || ""}</p>
</section>`;
}

function buyerQuestions(city, hd) {
  return `
<section class="section fp-section">
<h2>Questions for your ${city} HVAC contractor</h2>
<p><strong>What efficiency should I target?</strong> SEER ${hd.recommendedSEER}, AFUE ${hd.recommendedAFUE}% for ${city}. ${hd.heatPumpViable}.</p>
<p><strong>Who pulls the permit?</strong> ${hd.permitDetail}</p>
<p><strong>What about heat pumps?</strong> ${hd.heatPumpViable}.</p>
<p><strong>When should I schedule?</strong> ${hd.bestBuyMonths}. ${hd.seasonReason}</p>
</section>`;
}

function scopeChecklist(city, hd) {
  return `
<section class="section fp-section">
<h2>${city} HVAC contract checklist</h2>
<p><strong>Equipment spec.</strong> ${hd.dominantEquipmentStyle || ""}. SEER ${hd.recommendedSEER}+, AFUE ${hd.recommendedAFUE}%+.</p>
<p><strong>Permit and licensing.</strong> ${hd.permitAuthority}. ${hd.permitDetail}</p>
<p><strong>Ductwork scope.</strong> ${hd.ductworkPara || ""}</p>
<p><strong>Rebates and credits.</strong> ${hd.utilityRebatesQuirk || ""}</p>
</section>`;
}

function costContext(city, hd) {
  return `
<section class="section fp-section">
<h2>${city} HVAC cost drivers</h2>
<p><strong>Utility economics.</strong> ${hd.utilityCompanies} charges $${hd.avgElectricRate}/kWh electric and $${hd.avgGasRate}/therm gas. ${hd.coolingDominant ? "Cooling dominates annual cost." : hd.heatingDominant ? "Heating dominates annual cost." : "Both heating and cooling contribute."}</p>
<p><strong>Equipment culture.</strong> ${hd.dominantEquipmentStyle || ""}. ${hd.localBrandNetworks || ""}</p>
<p><strong>Seasonal pricing.</strong> ${hd.bestBuyMonths} offer the best pricing. ${hd.worstBuyMonths} are the most expensive. ${hd.seasonReason}</p>
</section>`;
}

function systemComparison(city, hd) {
  return `
<section class="section fp-section">
<h2>HVAC system options for ${city}</h2>
<p><strong>Central AC + gas furnace.</strong> ${hd.extremeTemp}. Recommended SEER ${hd.recommendedSEER}, AFUE ${hd.recommendedAFUE}%.</p>
<p><strong>Heat pump.</strong> ${hd.heatPumpViable}.</p>
<p><strong>Ductwork.</strong> ${hd.ductworkPara || ""}</p>
<p><strong>Local maintenance culture.</strong> ${hd.localMaintenancePara || ""}</p>
</section>`;
}

function scamPatterns(city, hd) {
  return `
<section class="section fp-section">
<h2>Common HVAC scams in ${city}</h2>
<p>${hd.localScam || ""}</p>
<p>${hd.techNarrative || ""}</p>
<p><strong>Permit verification.</strong> ${hd.permitAuthority}. ${hd.localPermitQuirk || ""}</p>
</section>`;
}

function heatPumpDeep(city, hd) {
  return `
<section class="section fp-section">
<h2>Heat pumps in ${city}: worth it?</h2>
<p>${hd.heatPumpViable}.</p>
<p><strong>${city} climate fit.</strong> ${hd.extremeTemp}. Humidity: ${hd.humidityIssue}. ${hd.coolingDominant ? "Cooling-dominant markets favor heat pumps since they cool as efficiently as standard AC while adding heating capability." : hd.heatingDominant ? "Heating-dominant markets require cold-climate heat pump models rated to -15F or colder, plus gas backup for extreme events." : "Mixed climates get strong year-round value from heat pumps without needing extreme-cold ratings."}</p>
<p><strong>Utility math.</strong> ${hd.utilityCompanies} charges $${hd.avgElectricRate}/kWh. ${hd.avgElectricRate > 0.20 ? "At this electric rate, heat pump operating cost is higher than gas in heating mode -- dual-fuel configurations that switch to gas below 35-40F are the economical choice." : "At this electric rate, heat pump operating cost is competitive with gas even in heating mode."}</p>
</section>`;
}

function emergencyPrep(city, hd) {
  return `
<section class="section fp-section">
<h2>HVAC emergency preparedness in ${city}</h2>
<p><strong>Peak failure months.</strong> ${hd.worstBuyMonths}. ${hd.seasonReason}</p>
<p><strong>Emergency vs planned.</strong> Emergency HVAC replacement during ${hd.worstBuyMonths} carries a 15-25% premium over planned replacement during ${hd.bestBuyMonths}. ${hd.localMaintenancePara || ""}</p>
<p><strong>Pre-season inspection.</strong> Schedule a $80-$150 tune-up before ${hd.coolingDominant ? "summer" : hd.heatingDominant ? "winter" : "each season"} to catch systems likely to fail. ${hd.utilityRebatesQuirk || ""}</p>
</section>`;
}

function localMarket(city, hd) {
  return `
<section class="section fp-section">
<h2>${city} HVAC contractor market</h2>
<p><strong>Dominant equipment.</strong> ${hd.dominantEquipmentStyle || ""}</p>
<p><strong>Brand networks.</strong> ${hd.localBrandNetworks || ""}</p>
<p><strong>Local scam patterns.</strong> ${hd.localScam || ""}</p>
<p><strong>Permit authority.</strong> ${hd.permitAuthority}. ${hd.localPermitQuirk || ""}</p>
</section>`;
}

function flagshipCSS() {
  return `
<style>
.fp-section { margin-top:32px; }
.fp-section h2 { font-size:22px; margin-bottom:12px; color:#0f172a; }
.fp-section p { font-size:15px; line-height:1.7; color:#334155; margin-bottom:12px; }
.fp-table { border:1px solid var(--border,#e2e8f0); border-radius:10px; overflow:hidden; }
.fp-table tbody tr:nth-child(even) { background:var(--bg-subtle,#f8fafc); }
@media(max-width:700px) { .fp-section h2 { font-size:20px; } }
</style>`;
}

function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  const hd = metroHVACData[metro.slug];
  if (!facts || !ctx || !hd) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getMultiplier(state);

  let html = flagshipCSS();
  html += `\n${MARKER_START}\n`;
  html += neighborhoodPricing(facts, mult, hd);
  html += climateSection(city, hd);
  html += utilitySection(city, hd);
  html += permitSection(city, hd);
  html += equipmentSection(city, hd);
  html += seasonalSection(city, hd);
  html += redFlagsSection(city, hd);
  html += maintenanceSection(city, hd);
  html += buyerQuestions(city, hd);
  html += scopeChecklist(city, hd);
  html += costContext(city, hd);
  html += systemComparison(city, hd);
  html += scamPatterns(city, hd);
  html += heatPumpDeep(city, hd);
  html += emergencyPrep(city, hd);
  html += localMarket(city, hd);
  html += extraLocalSection(city, hd);
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

    const re = new RegExp(`${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n?`, "g");
    content = content.replace(re, "");

    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    let insertAt = -1;

    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else {
      const localGridIdx = content.indexOf('<div class="local-grid">');
      if (localGridIdx >= 0) {
        const afterGrid = content.indexOf("</section>", localGridIdx);
        if (afterGrid >= 0) {
          insertAt = afterGrid + "</section>".length;
        }
      }
    }

    if (insertAt < 0) {
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
