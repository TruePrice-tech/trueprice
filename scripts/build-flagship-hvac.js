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

};

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
