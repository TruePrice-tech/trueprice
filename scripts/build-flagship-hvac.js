#!/usr/bin/env node
/**
 * Generates deep editorial content for 20 flagship metro HVAC pages.
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
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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
    techNarrative: "Dallas hail in the North Texas storm corridor (stretching from Plano through Prosper to McKinney) justifies hail guards on condenser coils for roughly $250-$500; they demonstrably reduce coil-fin damage during the April-to-June storm season",
    utilityRebatesQuirk: "Oncor's Take A Load Off Texas program pays $325-$1,200 for qualifying heat pumps and SEER2-compliant AC; CoServ and other north-suburb co-ops run parallel but separate rebate programs",
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
  },
  "detroit-mi": {
    utilityCompanies: "DTE Energy (electric and gas) and Consumers Energy",
    avgElectricRate: 0.18, avgGasRate: 0.95,
    coolingDominant: false, heatingDominant: true,
    humidityIssue: "moderate",
    extremeTemp: "Great Lakes winters with -5F Arctic air masses and persistent November-through-March cloud cover; summers humid and routinely in the 90s",
    recommendedSEER: 15, recommendedAFUE: 96,
    heatPumpViable: "cold-climate heat pumps are improving but Detroit's cheap DTE gas still favors high-AFUE gas furnaces; dual-fuel is the practical Grosse Pointe, Royal Oak, and Ferndale sweet spot",
    permitAuthority: "Detroit Buildings, Safety Engineering and Environmental Department (BSEED)",
    permitDetail: "Michigan requires a state mechanical contractor license (M-code) and Detroit additionally requires a separate city contractor registration. BSEED's eLAPS online portal handles applications; inspections often schedule 7-10 business days out during peak heating-season bookings, which creates lag issues for emergency January replacements",
    bestBuyMonths: "September through November",
    worstBuyMonths: "January (furnace emergencies) and July through August",
    seasonReason: "Cheap DTE gas means Palmer Woods, Indian Village, and Boston-Edison homeowners delay furnace replacement until failure; January emergency pricing in the Detroit metro spikes 20-25% over fall shoulder-season rates",
    localBrandNetworks: "Rheem and Ruud have strong Detroit coverage through a Romulus distribution hub near DTW; Lennox is well-represented across Oakland County through homebuilder relationships; Carrier's Indianapolis plant keeps Bryant widely stocked for the older-city replacement market",
    dominantEquipmentStyle: "high-AFUE condensing gas furnaces paired with basic 14-15 SEER central AC on the 1910s-1930s Palmer Woods and Indian Village homes; cast-iron gravity boilers still exist in older Boston-Edison stock and replace out to condensing boilers with sealed combustion",
    localScam: "Door-to-door crews sweep Royal Oak and Ferndale after every Arctic outbreak claiming heat exchangers are cracked based on a cursory inspection; demand a formal combustion analysis with CO readings before authorizing any heat exchanger replacement",
    localPermitQuirk: "Michigan's mechanical code requires a separate licensed gasfitter for any gas tie-in work in most jurisdictions; single-contractor shops without a licensed gasfitter subcontract this and mark the cost up meaningfully",
    techNarrative: "Detroit's older bungalow and brick colonial stock often has undersized gas service lines that can't support a high-BTU furnace plus an instantaneous water heater; DTE Gas will sometimes require a service upgrade at the meter that adds $2,500-$5,000 to the furnace project cost",
    utilityRebatesQuirk: "DTE Energy Efficiency Assistance pays $300-$1,200 for qualifying high-AFUE furnaces and high-SEER AC; Consumers Energy runs a parallel but slightly different program in the western suburbs",
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
  },
  "charlotte-nc": {
    utilityCompanies: "Duke Energy (electric) and Piedmont Natural Gas",
    avgElectricRate: 0.13, avgGasRate: 1.25,
    coolingDominant: true, heatingDominant: false,
    humidityIssue: "high",
    extremeTemp: "long humid 90F+ Piedmont summers; occasional winter ice storms dropping temps into the teens with sustained power outages",
    recommendedSEER: 17, recommendedAFUE: 90,
    heatPumpViable: "textbook heat-pump climate; mild Piedmont winters and long cooling seasons mean heat pumps outperform gas furnaces on lifetime cost across Ballantyne, Matthews, and Huntersville",
    permitAuthority: "Charlotte-Mecklenburg Code Enforcement",
    permitDetail: "Charlotte's LAMA (Land, Use, and Environmental Services) Accela portal issues mechanical permits to holders of a North Carolina Class II (or Class I) HVAC contractor license in 2-3 business days. Mecklenburg County covers both the city and unincorporated areas, which simplifies the process compared to other growing metros",
    bestBuyMonths: "October through February",
    worstBuyMonths: "June through August",
    seasonReason: "Charlotte's continuing growth boom keeps Ballantyne, SouthPark, and Myers Park contractors tied up with new-construction HVAC installs through summer; fall and winter replacement pricing runs 12-18% below June peak",
    localBrandNetworks: "Carrier has strong Carolinas presence through a Charlotte distribution hub near CLT airport; Lennox is heavily represented in the newer Ballantyne, Steele Creek, and Huntersville tract builds; Trane's proximity to Tyler TX keeps American Standard widely stocked; Rheem has unusually strong Dilworth and Plaza-Midwood coverage through older plumbing-contractor relationships",
    dominantEquipmentStyle: "split-system heat pumps on concrete pads beside the explosive suburban tract stock in Ballantyne, Matthews, and the north-Charlotte Huntersville-Cornelius corridor; attic-mounted gas furnaces paired with pad-mounted condensers in the older Myers Park and Eastover bungalows",
    localScam: "Post-ice-storm crews sweep Charlotte pitching full replacements on iced-over heat pumps; a heat pump can absolutely lock up in an ice storm but recovers fully once thawed and defrost cycle resumes",
    localPermitQuirk: "Mecklenburg County's LAMA portal is unified across the city and unincorporated county, which is unusual compared to other Carolinas metros; a contractor familiar with Raleigh permits may not have current credentials for Mecklenburg, which creates delays",
    techNarrative: "Charlotte's Piedmont red clay soil creates foundation movement on the shrink-swell cycle that stresses refrigerant line sets, especially on newer Ballantyne and Waxhaw tract homes where clay depth exceeds 10 feet; flexible line-set isolation loops are the regional best practice",
    utilityRebatesQuirk: "Duke Energy Smart $aver pays $300-$800 for qualifying high-SEER heat pumps and smart thermostats; Piedmont Natural Gas offers smaller stackable rebates for the rare dual-fuel configurations in Charlotte",
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
function nbh(facts, idx = 0) {
  const arr = facts?.neighborhoods || [];
  if (!arr.length) return facts?.displayName || "downtown";
  return arr[idx % arr.length];
}

function threeNbh(facts) {
  const arr = facts?.neighborhoods || [];
  if (arr.length >= 3) return `${arr[0]}, ${arr[1]}, and ${arr[2]}`;
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  if (arr.length === 1) return arr[0];
  return facts?.displayName || "downtown";
}

/* 1. Neighborhood pricing breakdown */
function neighborhoodPricing(slug, facts, mult, hvacData) {
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

  const h2 = pick(slug, "nbh-h2", [
    `Neighborhood HVAC Pricing Across ${facts.displayName}`,
    `${facts.displayName} HVAC Pricing by Neighborhood`,
    `How HVAC Pricing Varies Inside ${facts.displayName}`,
    `${facts.displayName} Neighborhood-Level HVAC Cost`,
  ]);
  const intro = pick(slug, "nbh-intro", [
    `${facts.displayName}'s pricing spread reflects the mix of ${hvacData.dominantEquipmentStyle}. The numbers below assume a 2,000 sq ft home with serviceable ductwork, pulled against ${hvacData.utilityCompanies.split(" and ")[0]} interconnection requirements.`,
    `Pricing varies block-to-block in ${facts.displayName} because ${hvacData.dominantEquipmentStyle}. Figures below use a 2,000 sq ft home with existing ducts, running against ${hvacData.utilityCompanies.split(" and ")[0]}'s interconnection rules.`,
    `${facts.displayName} HVAC pricing is shaped by ${hvacData.dominantEquipmentStyle}. Rows below model a 2,000 sq ft home with ductwork in serviceable condition, priced against ${hvacData.utilityCompanies.split(" and ")[0]}'s paperwork.`,
  ]);

  const caveat = pick(slug, "nbh-caveat", [
    `Pricing reflects ${facts.displayName}-specific labor, ${hvacData.permitAuthority.split("(")[0].trim()} permit fees, and ${hvacData.utilityCompanies.split(" and ")[0]} interconnection overhead.`,
    `Numbers here bake in ${facts.displayName} labor rates, ${hvacData.permitAuthority.split("(")[0].trim()} fees, and ${hvacData.utilityCompanies.split(" and ")[0]} paperwork time.`,
    `${facts.displayName} labor, ${hvacData.permitAuthority.split("(")[0].trim()} permit costs, and ${hvacData.utilityCompanies.split(" and ")[0]} interconnection overhead are all priced in.`,
  ]);

  return `
<section class="section fp-section">
<h2>${h2}</h2>
<p>${intro}</p>
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
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">${caveat} <a href="/hvac-quote-analyzer.html" style="color:var(--brand);">Upload your ${facts.displayName} quote for a side-by-side comparison.</a></p>
</section>`;
}

/* 2. Climate deep dive - heavily metro-conditional */
function climateDeepDive(city, state, ctx, facts, hvacData) {
  const paras = [];
  const seer = hvacData.recommendedSEER;
  const afue = hvacData.recommendedAFUE;

  paras.push(`<p>${cap(facts.climate)}. ${hvacData.techNarrative}.</p>`);

  if (hvacData.coolingDominant) {
    paras.push(`<p><strong>Cooling dominates the ${city} HVAC budget.</strong> ${hvacData.extremeTemp} keeps AC or heat-pump compressors running six to eight months a year across ${threeNbh(facts)}. At ${hvacData.utilityCompanies.split(" and ")[0]}'s ${hvacData.avgElectricRate >= 0.20 ? "painful" : hvacData.avgElectricRate >= 0.15 ? "moderate" : "low"} $${hvacData.avgElectricRate.toFixed(2)}/kWh residential rate, every SEER point above code minimum matters: stepping from 14 SEER to ${seer} SEER cuts cooling bills roughly ${Math.round((seer - 14) / 14 * 100)}% in ${city}, which works out to $${Math.round((seer - 14) * 80)}-$${Math.round((seer - 14) * 140)} per year on a typical home. Over a 15-year system life, that's meaningful money on ${hvacData.utilityCompanies.split(" and ")[0]} bills alone.</p>`);
  } else if (hvacData.heatingDominant) {
    paras.push(`<p><strong>Heating dominates the ${city} HVAC budget.</strong> ${hvacData.extremeTemp} pushes furnace or heat-pump run time to 2,500-3,500 hours per year across ${threeNbh(facts)}. At ${hvacData.utilityCompanies.split(" and ")[0]}'s $${hvacData.avgGasRate.toFixed(2)}/therm residential rate, the jump from 80% AFUE to ${afue}% AFUE cuts gas burn roughly ${Math.round((afue - 80) / 80 * 16)}%, which saves $${Math.round((afue - 80) * 15)}-$${Math.round((afue - 80) * 28)} per year in ${city}'s long heating season. Over a 20-year furnace life, that's $${Math.round((afue - 80) * 250)}-$${Math.round((afue - 80) * 520)} in cumulative gas savings, which dwarfs the upfront premium for condensing equipment.</p>`);
  } else {
    paras.push(`<p><strong>Balanced heating and cooling profile.</strong> ${city}'s ${hvacData.extremeTemp.replace(/^./, c => c.toLowerCase())} means you pay for both furnace and AC performance roughly equally. At ${hvacData.utilityCompanies.split(" and ")[0]}'s $${hvacData.avgElectricRate.toFixed(2)}/kWh electric rate and $${hvacData.avgGasRate.toFixed(2)}/therm gas rate, a single heat pump serving both loads usually wins the lifetime-cost comparison for homeowners in ${threeNbh(facts)}, especially when paired with a smart thermostat that shifts run time away from ${hvacData.utilityCompanies.split(" and ")[0]}'s peak pricing windows.</p>`);
  }

  if (hvacData.humidityIssue === "extreme" || hvacData.humidityIssue === "high") {
    paras.push(`<p><strong>Humidity control is the ${city} sizing issue.</strong> ${city}'s ${hvacData.humidityIssue} humidity turns AC oversizing from a minor annoyance into a real mold and mildew problem. An oversized system short-cycles, satisfying the thermostat before pulling moisture out of the air, and leaves ${nbh(facts, 0)} and ${nbh(facts, 1)} homeowners with a cold, clammy interior. A credible Manual J load calculation done against the ${hvacData.utilityCompanies.split(" and ")[0]} climate station data is mandatory in ${city}, not optional. Variable-speed or two-stage systems run longer at lower output, which is what actually dehumidifies air under ${city}'s dew-point profile.</p>`);
  } else if (hvacData.humidityIssue === "very low" || hvacData.humidityIssue === "low") {
    paras.push(`<p><strong>${cap(city)}'s dry air simplifies equipment selection.</strong> Low humidity means your AC does less dehumidification work, so single-stage equipment actually performs fine in ${threeNbh(facts)} without the upcharge for variable-speed. The real ${city} comfort problem is the opposite: winter indoor humidity can drop below 25%, which damages hardwood floors and dries out sinuses. A whole-house humidifier running off the forced-air duct ($400-$800 installed in ${city}) is worth the small upcharge on any ${hvacData.utilityCompanies.split(" and ")[0]}-fed system.</p>`);
  }

  paras.push(`<p><strong>Heat pumps in ${city}.</strong> ${cap(hvacData.heatPumpViable)}. ${hvacData.utilityRebatesQuirk}.</p>`);

  return `
<section class="section fp-section">
<h2>How ${city}'s Climate Drives Your HVAC Decision</h2>
${paras.join("\n")}
</section>`;
}

/* 3. Energy efficiency section - per-slug variants */
function energyEfficiencySection(slug, city, state, hvacData) {
  const seer = hvacData.recommendedSEER;
  const afue = hvacData.recommendedAFUE;
  const elec = hvacData.avgElectricRate;
  const gas = hvacData.avgGasRate;

  let seerAdvice = "";
  if (seer >= 20) {
    seerAdvice = `${city}'s relentless cooling load and ${elec >= 0.15 ? "high" : "moderate"} ${hvacData.utilityCompanies.split(" and ")[0]} rates make 20+ SEER variable-speed the fastest-payback tier in the country. The $2,000-$4,000 premium over a 16 SEER recovers in 5-7 years in ${city}; beyond that it's free ${hvacData.utilityCompanies.split(" and ")[0]} savings, plus superior humidity control and quieter operation, both of which matter when rooftop units sit at ${hvacData.extremeTemp.split(",")[0].toLowerCase()}.`;
  } else if (seer >= 18) {
    seerAdvice = `${city}'s long cooling season at ${hvacData.utilityCompanies.split(" and ")[0]}'s $${elec.toFixed(2)}/kWh rate makes 18 SEER the efficiency sweet spot. Going higher adds diminishing returns unless your ${nbh(hvacData, 0) || "target"} neighborhood has unusual run-time profiles. The 18 SEER tier typically pays its premium over a 16 SEER in 4-6 years of reduced ${hvacData.utilityCompanies.split(" and ")[0]} cooling bills.`;
  } else if (seer >= 17) {
    seerAdvice = `17 SEER is the right balance for ${city}'s mixed heating-cooling profile on ${hvacData.utilityCompanies.split(" and ")[0]}'s rate structure. Premiums for 20+ SEER don't pay back well when your AC runs only 4-5 months per year; the ${seer} SEER tier captures most of the cooling savings without the variable-speed upcharge.`;
  } else {
    seerAdvice = `${seer} SEER is the sensible ${city} minimum because heating, not cooling, dominates your ${hvacData.utilityCompanies.split(" and ")[0]} bill. The 14-to-16 SEER jump delivers modest savings here; the 16-to-20 jump delivers almost none. Put the efficiency budget toward the furnace or a cold-climate heat pump instead.`;
  }

  let afueAdvice = "";
  if (afue >= 95) {
    afueAdvice = `${city}'s ${hvacData.heatingDominant ? "heavy heating load" : "real heating demand"} makes 95-96% AFUE the ${city} minimum on any new gas furnace. At ${hvacData.utilityCompanies.split(" and ")[0]}'s $${gas.toFixed(2)}/therm rate, the 80-to-96% AFUE jump saves $${Math.round((afue - 80) * 15)}-$${Math.round((afue - 80) * 28)} annually in a typical ${city} home. Condensing furnaces vent through 2-3 inch PVC rather than the old metal flue, which is a plus if your ${nbh({neighborhoods:["intown"]}, 0)} home already has a compromised brick chimney but adds cost on a first-time conversion.`;
  } else if (afue >= 90) {
    afueAdvice = `${city}'s heating season is meaningful but not extreme, so 90-92% AFUE is the sensible sweet spot. If you're replacing an 80% AFUE unit in an older ${nbh({neighborhoods:["neighborhood"]}, 0)} home, the jump to 92% saves $200-$400 per year at ${hvacData.utilityCompanies.split(" and ")[0]}'s current gas rate; the marginal step to 96% takes meaningfully longer to pay back.`;
  } else {
    afueAdvice = `${city}'s minimal heating load means an 80% AFUE furnace is fine if you even keep gas. Most ${city} homeowners are better served by going all-electric with a high-SEER heat pump and skipping the gas furnace, water heater, and PGW-equivalent bill altogether. Do the math on ${hvacData.utilityCompanies.split(" and ")[0]}'s electric rate before locking in dual-fuel.`;
  }

  const h2 = pick(slug, "eff-h2", [
    `SEER and AFUE Targets for ${city} Homeowners`,
    `${city} Efficiency Targets: SEER and AFUE`,
    `What SEER and AFUE to Aim For in ${city}`,
    `Efficiency Numbers That Matter in ${city}`,
  ]);
  const floorLead = pick(slug, "floor-lead", [
    `2026 rating floor in ${city}.`,
    `${city}'s 2026 minimum efficiency rules.`,
    `What's the SEER2 floor in ${city}?`,
    `${city} 2026 efficiency minimums.`,
  ]);
  const floorBody = ["CA","TX","FL","GA","NV","AZ","NC","TN"].includes(state)
    ? `Federal floor for ${state} is 15 SEER2 (roughly 15.2 legacy SEER) under the DOE southern-region rule — any ${city} bid under that is illegal for new residential install`
    : `Federal floor for ${state} is 14 SEER2 under the DOE northern-region rule, but most ${city} homeowners should aim well above that because the incremental cost of higher SEER2 is modest`;

  const rebateLead = pick(slug, "rebate-lead", [
    `${state}-specific rebate stacking.`,
    `How to stack ${state} rebates in ${city}.`,
    `${city} rebate math and ${state} incentives.`,
    `Rebates available to ${city} homeowners.`,
  ]);

  return `
<section class="section fp-section">
<h2>${h2}</h2>
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
<p><strong>${floorLead}</strong> ${floorBody}. ${pick(slug, "floor-tail", [
  `A ${city} bid showing "14 SEER" in 2026 is either clearing pre-2025 inventory or mixing up SEER2 with legacy SEER — cross-check the AHRI reference at ahridirectory.org.`,
  `Any "14 SEER" number on a ${city} 2026 bid is either left-over old inventory or a labeling mix-up between SEER2 and legacy SEER; the AHRI listing at ahridirectory.org is the authoritative source.`,
  `A "14 SEER" quote in ${city} for 2026 installs is a red flag — either stale inventory or a SEER2-versus-SEER labeling confusion; verify the AHRI reference online before signing.`,
])}</p>
<p><strong>${rebateLead}</strong> ${hvacData.utilityRebatesQuirk}. ${pick(slug, "25c-sunset", [
  `The 25C heat-pump credit sunset December 31, 2025 and does not apply to 2026 ${city} projects.`,
  `Section 25C expired end of 2025 — it cannot be claimed on any 2026 ${city} install.`,
  `25C heat-pump credits ended with 2025 and have no effect on 2026 ${city} project taxes.`,
])} ${pick(slug, "hear-homes", [
  `IRA HEAR (up to $8,000 for income-qualified ${state} households) and IRA HOMES (up to $4,000-$8,000 performance-based) continue — administered through ${state}'s designated energy office, applied by the installer, not via the homeowner's tax return.`,
  `HEAR and HOMES IRA rebates remain live: HEAR delivers up to $8,000 for income-qualified ${state} residents; HOMES delivers $4,000-$8,000 based on measured performance. Both flow through ${state}'s energy office and the installer, not through your 1040.`,
  `Two IRA programs still apply in ${state}: HEAR (up to $8,000 for income-qualified households) and HOMES ($4,000-$8,000 performance-based). ${state}'s energy office runs the programs; the installer captures the incentive on the invoice rather than you on your return.`,
])} ${pick(slug, "geo-tail", [
  `Geothermal heat pumps separately qualify for the 30% Section 25D credit through 2034 — relevant for ${city} homes with lot space for a ground loop.`,
  `For ${city} homes with lot space, geothermal heat pumps carry the uncapped 30% Section 25D credit through 2034.`,
  `Ground-loop geothermal is a separate path in ${city}: 30% Section 25D credit, uncapped, runs through 2034.`,
])}</p>
</section>`;
}

/* 4. Utility rate impact - per-slug variants */
function utilityRateSection(slug, city, state, hvacData, facts) {
  const elec = hvacData.avgElectricRate;
  const gas = hvacData.avgGasRate;
  const util = hvacData.utilityCompanies;

  const elecFraming = elec >= 0.25
    ? `${city}'s ${util.split(" and ")[0]} residential rate of $${elec.toFixed(2)}/kWh runs roughly ${Math.round((elec / 0.16 - 1) * 100)}% above the US average; every efficiency point saves more real dollars in ${nbh(facts, 0)} than in a comparable home in Houston or Atlanta`
    : elec >= 0.18
    ? `${city}'s ${util.split(" and ")[0]} residential rate of $${elec.toFixed(2)}/kWh is meaningfully above the US average, so efficiency upgrades pay back faster for ${nbh(facts, 0)} and ${nbh(facts, 1)} homeowners than they would in cheap-electricity markets`
    : elec >= 0.14
    ? `${city}'s ${util.split(" and ")[0]} residential rate of $${elec.toFixed(2)}/kWh sits right at the US average, which means standard payback math applies without regional adjustments`
    : `${city}'s ${util.split(" and ")[0]} residential rate of $${elec.toFixed(2)}/kWh runs roughly ${Math.round((1 - elec / 0.16) * 100)}% below the US average, which makes heat pumps financially attractive because every BTU delivered by electricity costs less than in almost any other US metro`;

  const gasFraming = gas >= 1.75
    ? `${city}'s $${gas.toFixed(2)}/therm gas rate through ${util.includes("(gas)") ? util.split("(gas)")[0].trim() : util.split(" and ").slice(-1)[0]} runs well above the US average, which narrows the gas-vs-heat-pump cost gap. In this rate environment, an all-electric heat pump is worth serious consideration even where gas service exists`
    : gas >= 1.20
    ? `${city}'s $${gas.toFixed(2)}/therm gas rate is moderately above the US average. The gas-vs-heat-pump math tilts toward heat pumps if you're already upgrading the electric service, but dual-fuel remains the conservative choice for ${nbh(facts, 2)} and similar ${city} neighborhoods`
    : gas >= 0.95
    ? `${city}'s $${gas.toFixed(2)}/therm gas rate is near the US average. The gas-vs-heat-pump choice here really does come down to your specific heat-loss profile and how cold it actually gets; run the numbers against ${util.split(" and ")[0]}'s actual tariff sheet, not averages`
    : `${city}'s $${gas.toFixed(2)}/therm gas rate is exceptionally cheap, which is why high-AFUE gas furnaces still win on lifetime cost in ${nbh(facts, 0)} and the surrounding ${city} metro even at today's heat-pump efficiencies. Cheap gas is a real structural advantage here`;

  const h2 = pick(slug, "util-h2", [
    `How ${city} Utility Rates Shape Your HVAC ROI`,
    `${city} Utility Rates and Equipment Decisions`,
    `What ${util.split(" and ")[0]} Rates Mean for ${city} HVAC`,
    `${city} Energy Prices and Payback Math`,
  ]);
  const intro = pick(slug, "util-intro", [
    `${util} set most of the ongoing cost of whatever system goes into your ${city} home. Here's how those rates push the equipment decision.`,
    `Ongoing ${city} HVAC cost depends mostly on ${util}'s rates. Here's how the numbers drive the sizing and brand decision.`,
    `${util} charge-per-unit rates dominate ${city} system operating cost. Below is how those rates bend the equipment choice.`,
  ]);

  return `
<section class="section fp-section">
<h2>${h2}</h2>
<p>${intro}</p>
<div class="fp-season-grid">
<div class="fp-scenario-card" style="border-top:4px solid #f59e0b; padding:20px;">
<h3>Electricity</h3>
<p class="fp-scenario-total" style="font-size:22px;">$${elec.toFixed(2)}/kWh</p>
<p style="font-size:13px; color:#64748b;">${util}</p>
</div>
<div class="fp-scenario-card" style="border-top:4px solid #3b82f6; padding:20px;">
<h3>Natural gas</h3>
<p class="fp-scenario-total" style="font-size:22px;">$${gas.toFixed(2)}/therm</p>
<p style="font-size:13px; color:#64748b;">${util.includes("and") ? util.split(" and ").slice(-1)[0] : "Local provider"} residential</p>
</div>
</div>
<p>${elecFraming}. ${gasFraming}.</p>
<p><strong>${state} rate structure.</strong> ${state === "TX" ? `Texas's deregulated ERCOT market means your ${city} rate depends on whichever retail provider you picked; compare your actual bill, not the plan's marketing rate, before running payback math. Locked-in plans from Reliant, TXU, Green Mountain, and Direct Energy vary by 20-30% on the fixed component` : state === "CA" ? `California's tiered rate structure through ${util.split(" (")[0]} means your marginal rate climbs sharply as usage grows; high-SEER equipment that keeps you in lower tiers amplifies savings beyond what a flat-rate calculation would predict` : state === "IL" ? `ComEd's seasonal time-of-use and supply-charge separation mean your nominal rate is only part of the story; the delivery and capacity charges add meaningful fixed cost that efficiency can't touch` : state === "NV" ? `NV Energy offers optional time-of-use rates through its TOU-D and TOU-D-EV schedules that reward running AC during off-peak hours; a smart thermostat with a TOU-aware schedule is genuinely worth the upcharge here` : `Check your actual ${util.split(" and ")[0]} bill rate, not the advertised rate, before running payback math. The summer delivery charges and demand components can meaningfully shift the effective per-kWh cost in ${city}`}.</p>
</section>`;
}

/* 5. Permits and code - uses pick() for per-slug variant selection */
function permitSection(slug, city, state, facts, hvacData) {
  const auth = hvacData.permitAuthority.split("(")[0].trim();
  const dominantStyle = hvacData.dominantEquipmentStyle.split(";")[0];
  const brandTop = hvacData.localBrandNetworks.split(",")[0].split(" ")[0];
  const util0 = hvacData.utilityCompanies.split(" and ")[0];

  const inspectFocus = hvacData.humidityIssue === "extreme" || hvacData.humidityIssue === "high"
    ? `condensate overflow switches and secondary drain pans pull extra ${auth} scrutiny in ${city} because clogged primary drain lines trigger ceiling collapse faster in humid air than anywhere drier`
    : hvacData.humidityIssue === "very low" || hvacData.humidityIssue === "low"
    ? `${auth} inspectors lean into combustion-air verification and refrigerant-line insulation on ${city} jobs rather than condensate, which rarely fails in this dry climate`
    : `${auth} reviews condensate routing, combustion-air make-up, and line-set insulation as standard ${state} checklist items`;

  // pick variant for the "skipping permit" paragraph
  const skipLead = pick(slug, "permit-skip-lead", [
    `Skipping the ${city} permit costs more than pulling it.`,
    `That ${city} permit fee is cheap insurance compared to what skipping it costs.`,
    `Pulling the ${auth} permit is always the right call in ${city}.`,
    `${city} permits aren't optional red tape — they're leverage against bad installs.`,
    `The ${auth} permit in ${city} is worth every dollar it costs.`,
  ]);

  const skipConsequence = hvacData.heatingDominant
    ? `a botched ${city} furnace install can vent CO through a cracked heat exchanger or undersized flue, and ${auth} is the last real check before that goes live in your living room`
    : hvacData.coolingDominant
    ? `a botched ${city} AC install leaks refrigerant into the attic, drips condensate into the ${util0}-side electrical panel, or fails its first pressure test during July; ${auth} catches those upstream of drywall closing back up`
    : `${auth} inspection catches install errors that otherwise surface during ${city}'s first real extreme-weather event — which is the worst possible time to find them`;

  const a2lLead = pick(slug, "a2l-lead", [
    `A2L refrigerant arrives in ${city}.`,
    `${city}'s A2L transition is already under way.`,
    `The A2L rollout is reshaping ${city} installs.`,
    `A2L changes how ${city} shops handle refrigerant.`,
  ]);

  const a2lBody = pick(slug, "a2l-body", [
    `Every 2026 residential AC or heat pump going into a ${city} home runs R-454B (Honeywell's Solstice N41) or R-32 (the Daikin and Mitsubishi preference) under the AIM Act phase-down. ${brandTop} distribution in ${state} still moves residual pre-2025 R-410A stock, but that pipeline is closing fast.`,
    `R-454B and R-32 are the A2L refrigerants replacing R-410A in new ${city} residential installs. ${brandTop} distributors across ${state} still have some pre-2025 R-410A inventory for service and carry-over installs, but new manufacturing stopped at the 2025 cutoff.`,
    `${city} homeowners getting 2026 installs will see either R-454B (Honeywell) or R-32 (Daikin/Mitsubishi) on the nameplate, full stop. Pre-2025 R-410A stock in ${state} still exists but is on its way out through ${brandTop} and similar distributor channels.`,
  ]);

  return `
<section class="section fp-section">
<h2>${pick(slug, "permit-title", [`HVAC Permits and Code in ${city}`, `${city} HVAC Permitting and Inspections`, `Permits, Codes, and Inspections for ${city} HVAC`, `What the ${auth} Permit Covers in ${city}`])}</h2>
<p><strong>Permit authority:</strong> ${hvacData.permitAuthority}. ${hvacData.permitDetail}.</p>
<p><strong>${pick(slug, "cov-lead", [
  `${city}-specific coverage.`,
  `What the ${auth} permit actually covers.`,
  `Scope of the ${city} mechanical permit.`,
  `${city} permit review checklist.`,
])}</strong> ${hvacData.localPermitQuirk}. ${pick(slug, "cov-body", [
  `A ${auth} mechanical permit in ${city} covers Manual J sizing, service-side electrical, gas-piping sizing for any gas work, refrigerant line-set routing, condensate routing, and duct leakage testing where ${state} code requires it.`,
  `The ${auth} mechanical permit review covers Manual J sizing, electrical tie-in, gas line sizing if applicable, line-set routing, the condensate path, and whatever duct-leakage testing ${state} specifies.`,
  `A ${city} mechanical permit formally signs off on Manual J load calc, service electrical, gas pipe sizing if gas is involved, refrigerant line routing, condensate discharge, and ${state}'s required duct-leakage testing.`,
  `The permit paperwork covers Manual J calculation, electrical service work, gas-piping size where applicable, refrigerant line-set path, condensate handling, and the duct-leakage testing ${state} code specifies.`,
])} On top of that baseline, ${inspectFocus}. ${pick(slug, "cov-tail", [
  `${auth} also checks ${dominantStyle}-specific details a generic Sun Belt tract-home inspector wouldn't recognize.`,
  `${auth} inspectors additionally verify ${dominantStyle}-specific items that differ from tract-home norms elsewhere.`,
  `${auth} reviews ${dominantStyle}-specific installation details unique to ${city}.`,
  `${auth} verifies ${dominantStyle}-specific items that generic national HVAC templates miss.`,
])}</p>
<p><strong>${skipLead}</strong> ${pick(slug, "skip-body", [
  `Unpermitted ${city} work voids ${brandTop} and every manufacturer warranty, appears as an MLS flag at resale, and leaves you holding the liability when things fail: ${skipConsequence}.`,
  `Skipping the permit in ${city} voids ${brandTop}'s warranty and any other manufacturer coverage, creates an MLS-listed defect at sale time, and sticks you with liability: ${skipConsequence}.`,
  `Working without the ${auth} permit nulls ${brandTop} warranty rights, produces a resale-inspection flag, and transfers install liability from the contractor to the homeowner: ${skipConsequence}.`,
])} ${pick(slug, "skip-motive", [
  `When a ${city} contractor offers to save you the permit fee, the savings really accrue to them by dodging ${auth} review.`,
  `A ${city} contractor's "we'll skip the permit" pitch mostly saves them from ${auth} scrutiny, not you anything meaningful.`,
  `The "no-permit discount" a ${city} shop offers is really insurance against ${auth} inspection, paid by you.`,
])} ${pick(slug, "liability-close", [
  `Permit-holder liability belongs to the installer under ${state} law; don't let them transfer it via an owner-builder filing.`,
  `Under ${state} law, permit liability stays with the contractor — avoid any pitch to pull the permit yourself as an owner-builder.`,
  `${state} law puts permit liability on the installer, not the homeowner; refuse any owner-builder permit suggestion.`,
])}</p>
<p><strong>${a2lLead}</strong> ${a2lBody} ${pick(slug, "a2l-class", [
  `A2L sits in flammability class 2L versus class 1 for R-410A, so installation practice tightens under UL 60335-2-40.`,
  `Because A2L is class 2L (mildly flammable) and R-410A was class 1 (non-flammable), UL 60335-2-40 adds install requirements.`,
  `The 2L flammability class on A2L — versus class 1 on R-410A — triggers tighter UL 60335-2-40 install protocols.`,
])} ${pick(slug, "a2l-reqs", [
  `Expect minimum charge-per-room-volume thresholds, mandatory leak sensors on larger indoor units, and brazing-joint protocols different from R-410A.`,
  `The new requirements: charge-to-room-volume minimums, leak-detection sensors on heads above certain tonnages, and A2L-specific brazing procedures.`,
  `Requirements include volume-to-charge ratios, leak sensors on indoor equipment over specified tonnages, and brazing-joint protocols that depart from R-410A practice.`,
])} ${pick(slug, "a2l-verify", [
  `${state === "TX" ? "TDLR" : state === "CA" ? "CSLB" : state === "FL" ? "DBPR" : state === "NY" ? "NYC DOB" : state + " licensing"} licensing does not automatically confirm A2L training; verify it separately on the ${city} contractor you hire.`,
  `A ${state === "TX" ? "TDLR" : state === "CA" ? "CSLB" : state === "FL" ? "DBPR" : state === "NY" ? "NYC DOB" : state + " state"} license alone does not prove A2L competency — pull the A2L training credential separately before signing with a ${city} shop.`,
  `${state === "TX" ? "TDLR" : state === "CA" ? "CSLB" : state === "FL" ? "DBPR" : state === "NY" ? "NYC DOB" : state + " licensing"} does not equate to A2L certification; the ${city} shop you hire should produce A2L training documentation independently.`,
])}</p>
${facts.codeNote ? `<p><strong>${city} code note.</strong> ${facts.codeNote}.</p>` : ""}
</section>`;
}

/* 6. Contractor market analysis - per-slug variant phrasing */
function contractorMarketSection(slug, city, state, ctx, facts, hvacData) {
  let licensingBoard = "";
  if (state === "TX") licensingBoard = "TDLR (Texas Department of Licensing and Regulation)";
  else if (state === "CA") licensingBoard = "CSLB (Contractors State License Board), with specific C-20 HVAC classification";
  else if (state === "AZ") licensingBoard = "Arizona Registrar of Contractors (ROC), with K-39 or C-39 HVAC classification";
  else if (state === "GA") licensingBoard = "Georgia Secretary of State, Conditioned Air license Class I or Class II";
  else if (state === "WA") licensingBoard = "Washington L&I, HVAC/R specialty contractor license 06A";
  else if (state === "CO") licensingBoard = "Denver mechanical license (city-specific), in addition to Colorado state registration";
  else if (state === "IL") licensingBoard = "Illinois DFPR (mechanical contractor license), plus Chicago contractor registration";
  else if (state === "NY") licensingBoard = "NYC DOB Home Improvement Contractor license, plus relevant trade licenses";
  else if (state === "FL") licensingBoard = "Florida DBPR Class A or Class B mechanical contractor license";
  else if (state === "MA") licensingBoard = "Massachusetts sheet metal worker license plus gasfitter license";
  else if (state === "PA") licensingBoard = "PA HICPA registration plus local Philadelphia contractor license";
  else if (state === "MI") licensingBoard = "Michigan mechanical contractor license (M-code), plus Detroit city registration";
  else if (state === "MN") licensingBoard = "Minnesota mechanical contractor bonding plus Minneapolis city registration";
  else if (state === "NC") licensingBoard = "North Carolina Class I or Class II HVAC contractor license";
  else if (state === "NV") licensingBoard = "Nevada State Contractors Board C-21 (refrigeration and air conditioning) license";
  else licensingBoard = `${state}'s HVAC contractor licensing board`;

  const brandTop = hvacData.localBrandNetworks.split(",")[0].split(" ")[0];
  const util0 = hvacData.utilityCompanies.split(" and ")[0];
  const liabThresh = state === "FL" || state === "TX" || state === "NY" || state === "CA" ? `$1M per occurrence is the ${city} floor` : `$500K-$1M per occurrence is standard in ${state}`;

  const marketLead = ctx.growthRate === "high"
    ? pick(slug, "contractor-growth", [
      `${city} sits in the high-growth bracket. New-construction HVAC work in ${threeNbh(facts)} competes with replacement bids for the same ${licensingBoard.split(",")[0]}-credentialed crews, which pushes contractor demand up and negotiating leverage down.`,
      `${city}'s growth is real and it shows up in contractor scheduling. New builds absorb ${licensingBoard.split(",")[0]}-licensed crews out of ${threeNbh(facts)}, so replacement bidders face scarcer labor and less price flexibility.`,
      `Rapid ${city} growth means replacement work competes against new construction for the same ${licensingBoard.split(",")[0]}-licensed ${threeNbh(facts)} crews. That imbalance is a persistent headwind on negotiating leverage.`,
    ]) + ` Bid spreads of 40-60% between the cheapest and most expensive ${city} HVAC quote are normal and usually reflect genuine differences in ${brandTop}-vs-value-tier equipment, warranty terms, and install craft — not just markup. Don't default to lowest bid.`
    : pick(slug, "contractor-stable", [
      `${city}'s HVAC contractor market is comparatively stable, which gives ${threeNbh(facts)} homeowners real negotiating room.`,
      `Contractor supply in ${city} is healthy relative to demand, so ${threeNbh(facts)} bidders compete meaningfully on price.`,
      `${city}'s HVAC labor pool is steady enough that ${threeNbh(facts)} buyers can collect competitive bids without scheduling friction.`,
    ]) + ` Three bids is the baseline, but on HVAC specifically verify you're comparing equivalent systems: same ${brandTop}-vs-value-tier brand class, same SEER2/HSPF on the AHRI certificate, same warranty terms, same duct-testing scope. A $3,000 gap between ${city} bids usually means different equipment rather than different margin.`;

  const verifyLead = pick(slug, "verify-lead", [
    `${city} verification essentials.`,
    `What to verify on any ${city} bid.`,
    `${city}-specific vetting checklist.`,
    `How to vet a ${city} HVAC contractor.`,
  ]);

  const installLead = pick(slug, "install-lead", [
    `Install craft beats brand badge in ${city}.`,
    `${city} install quality matters more than the nameplate.`,
    `Why ${city} install technique trumps brand choice.`,
    `${city} install details that actually matter.`,
  ]);

  const airflowSpec = hvacData.coolingDominant
    ? `${city}'s long cooling run hours call for 375-400 CFM per ton`
    : hvacData.heatingDominant
    ? `${city}'s heating-dominant load profile calls for 400 CFM per ton, adjusted for long heat-call duty cycles`
    : `400 CFM per ton balanced for ${city}'s dual-season operation`;

  return `
<section class="section fp-section">
<h2>${pick(slug, "contractor-title", [`The ${city} HVAC Contractor Market`, `${city} HVAC Contractors: How the Market Works`, `Hiring an HVAC Contractor in ${city}`, `How ${city}'s HVAC Labor Market Shapes Your Bid`])}</h2>
<p>${cap(facts.contractorMarket)}. ${hvacData.localBrandNetworks}. ${pick(slug, "brand-gap", [
  `The bid gap between a ${brandTop} dealer and an independent shop in ${city} usually reflects real differences in equipment supply chain, not pure markup.`,
  `A ${brandTop} dealer quote versus an independent ${city} shop quote usually differs because of actual supply-chain differences, not margin inflation.`,
  `${brandTop}-dealer pricing and independent-shop pricing in ${city} diverge mostly because the equipment pipelines differ, not because one is overcharging.`,
])}</p>
<p>${marketLead}</p>
<p><strong>${verifyLead}</strong> ${pick(slug, "verify-license", [
  `Start with ${licensingBoard} — check the ${state} license number against the state board's public lookup, not whatever the website claims.`,
  `First step is ${licensingBoard}; verify the ${state} number directly on the state board's public lookup rather than trusting the contractor's site.`,
  `${licensingBoard} is the starting point — pull the ${state} license number from the state's own lookup portal, not the company marketing page.`,
  `Confirm ${licensingBoard} through the official ${state} registry, not whatever badges appear on the contractor's brochure.`,
])} ${pick(slug, "verify-insurance", [
  `${liabThresh} on general liability; workers' comp confirmed via the ${state} comp database.`,
  `On the insurance side: ${liabThresh}, with workers' comp verified in the ${state} comp system.`,
  `Insurance check: ${liabThresh} for general liability, plus active workers' comp confirmed through ${state}'s comp database.`,
])} ${pick(slug, "verify-ahri", [
  `Demand the AHRI reference number for the exact condenser-coil-air-handler combo quoted in ${city}: the SEER2/HSPF printed on the spec sheet only applies to the certified combination, not to whatever substitute coil the installer pulls off a ${util0}-area truck.`,
  `Insist on the AHRI reference for the specific condenser/coil/air-handler combo in your ${city} quote. The listed SEER2/HSPF applies only to that AHRI-certified trio, not to random coil substitutions from ${util0}-area distribution.`,
  `Ask for the AHRI reference number for the specific combo quoted: SEER2 and HSPF ratings only apply to the AHRI-certified condenser/coil/air-handler trio, never to whatever parts substitute on a ${util0}-area truck.`,
])}</p>
<p><strong>${installLead}</strong> ${pick(slug, "craft-lead", [
  `A premium ${brandTop} unit installed sloppily loses to a mid-tier unit installed right in any ${city} home.`,
  `Top-shelf ${brandTop} equipment with weak install will underperform mid-tier equipment installed well in ${city}.`,
  `Install craft matters more than brand tier — a poorly commissioned ${brandTop} unit can be beaten by a mid-tier unit done right in ${city}.`,
])} ${pick(slug, "craft-items", [
  `The craft specifics that matter in ${city}: Manual J against ${util0}'s actual climate station, refrigerant charge verified by live superheat and subcooling at commissioning, plenum-to-duct joints sealed with mastic paste (tape fails in ${hvacData.humidityIssue} humidity within three years), ${airflowSpec}, and a written commissioning report handed over before final payment.`,
  `Five craft items to insist on in ${city}: a Manual J tied to ${util0}'s climate data, refrigerant charge dialed by live superheat/subcooling readings rather than weight, mastic-paste duct sealing (not tape — it fails in ${hvacData.humidityIssue} conditions within three years), ${airflowSpec}, and a signed commissioning sheet before you release final payment.`,
  `Non-negotiable craft details on a ${city} install: Manual J against ${util0}'s weather station, charge set by active superheat and subcooling readings during commissioning, mastic-sealed duct joints (tape degrades in ${hvacData.humidityIssue} air inside three years), ${airflowSpec}, and a written commissioning record delivered pre-payment.`,
])} ${pick(slug, "craft-tail", [
  `Every ${city} bidder should walk you through all five; anyone who dismisses the question is telling you something.`,
  `Ask each ${city} contractor about all five specifics — a contractor who can't or won't answer is showing you their install quality.`,
  `A serious ${city} bidder handles all five items without pushback; anyone who deflects is revealing a process problem.`,
])}</p>
</section>`;
}

/* 7. Red flags and scams - per-slug variant phrasing */
function redFlagsSection(slug, city, state, ctx, hvacData, facts) {
  const flags = [];
  const util0 = hvacData.utilityCompanies.split(" and ")[0];
  const brand0 = hvacData.localBrandNetworks.split(",")[0].split(" ")[0];
  const brand1 = hvacData.localBrandNetworks.split(",").length > 1
    ? hvacData.localBrandNetworks.split(",")[1].trim().split(" ")[0]
    : "Rheem";

  // Different lead phrasing per humidity level to break boilerplate
  const sizeLead = hvacData.humidityIssue === "extreme"
    ? `In ${city}'s brutal dew-point climate, oversizing your ${hvacData.heatingDominant ? "heating-dominant" : "cooling-dominant"} system is a mold trigger as much as a comfort complaint. Manual J done against ${util0}'s climate station is mandatory — square-footage rules of thumb will put you one size too big every time.`
    : hvacData.humidityIssue === "high"
    ? `${nbh(facts, 0)} and ${nbh(facts, 1)} bids regularly show oversized equipment because contractors default to square-foot rules; ${util0}'s climate data plus a genuine Manual J worksheet catch this. Oversized AC in ${city}'s humid ${hvacData.heatingDominant ? "summers" : "climate"} short-cycles before pulling moisture out of the air.`
    : hvacData.humidityIssue === "very low" || hvacData.humidityIssue === "low"
    ? `${city}'s dry climate hides the oversizing problem because dehumidification isn't the main job, but oversized ${hvacData.heatingDominant ? "furnaces" : "AC"} still short-cycle and wear out sooner. Ask for the Manual J worksheet keyed to ${util0}'s climate bin data, not the "your house is 2,000 sq ft so you need 4 tons" shorthand.`
    : `Moderate ${city} humidity still punishes oversizing: short-cycling wears out compressors and blower motors before the 15-year national-average lifespan. ${util0} climate-station data plus a proper Manual J catches the common one-size-too-big bid.`;

  const sizeTitle = pick(slug, "size-title", [
    `Oversizing: ${city}'s most expensive miss`,
    `${city} oversizing is the costliest install error`,
    `The ${city} oversize trap`,
    `Why oversizing hurts worst in ${city}`,
  ]);
  const sizeQ = pick(slug, "size-q", [
    `"What cooling load did your Manual J return for this house, and what output tonnage are you specifying?"`,
    `"What's the Manual J cooling load in BTU/hr, and why that specific tonnage?"`,
    `"Show me the Manual J result and explain why this tonnage instead of the next size down."`,
    `"Walk me through the Manual J numbers that led to this tonnage choice."`,
  ]);
  flags.push({
    title: sizeTitle,
    body: `${sizeLead} ` + pick(slug, "size-mid", [
      `On a ${city} replacement, the disqualifying question for each bidder is ${sizeQ}`,
      `The question that separates serious ${city} contractors from guessers: ${sizeQ}`,
      `Every ${city} homeowner should ask each bidder ${sizeQ}`,
    ]) + ` ` + pick(slug, "size-end", [
      `An answer that skips the load calc or the tonnage justification is a hard pass.`,
      `Any response missing the Manual J load number or the tonnage rationale is disqualifying.`,
      `A contractor who dodges either the BTU load or the tonnage explanation is not worth a second visit.`,
    ])
  });

  // Upsell text varies per climate
  const upsellLead = hvacData.humidityIssue === "extreme" || hvacData.humidityIssue === "high"
    ? pick(slug, "upsell-humid", [
      `${city}'s humidity occasionally justifies the whole-home dehumidifier upsell ($1,500-$3,000). UV lights, ionizers, and duct sanitization remain upsell theater for ${threeNbh(facts)} homes with healthy ductwork; a MERV 13 pleated filter swapped twice a year handles the air quality.`,
      `In ${city}'s humid climate, a whole-home dehumidifier ($1,500-$3,000) can genuinely pencil out; UV lights, ionizers, and "duct sanitization" on ${threeNbh(facts)} homes with clean ducts usually do not. Twice-yearly MERV 13 filter swaps cover the air-quality basics.`,
      `${city}'s dew points occasionally justify a whole-home dehumidifier ($1,500-$3,000). The other add-ons — UV lights, ionizers, duct sanitizers — rarely deliver measurable benefit on ${threeNbh(facts)} homes with sound ductwork. MERV 13 filters, changed semiannually, do the real air-quality work.`,
    ])
    : pick(slug, "upsell-dry", [
      `For ${threeNbh(facts)} homes on ${util0}'s grid, UV lights, ionizers, and "duct sanitization" add no measurable benefit over a MERV 11-13 pleated filter changed quarterly. These are pure margin boosters on bids already loaded with ${brand0} or ${brand1} equipment.`,
      `UV lights, ionizers, and "duct sanitization" on ${threeNbh(facts)} homes served by ${util0} deliver nothing a quarterly MERV 11-13 filter doesn't already do. They're tacked-on margin items on bids that already include ${brand0} or ${brand1} equipment.`,
      `${threeNbh(facts)} homeowners on ${util0} rarely need UV lights, ionizers, or "duct sanitization" when a MERV 11-13 filter changed every 90 days covers the same ground. These add-ons exist to pad margin on ${brand0}- or ${brand1}-equipped bids.`,
    ]);

  flags.push({
    title: pick(slug, "upsell-title", [
      `${brand0}-dealer upsell bundles`,
      `IAQ upsell creep in ${city}`,
      `${city} indoor-air-quality add-on theater`,
      `Upsell bundles to decline in ${city}`,
    ]),
    body: `${upsellLead} ` + pick(slug, "upsell-tail", [
      `If your ${city} bid leads with air-quality add-ons before discussing Manual J sizing or ${util0} rebate stacking via ${hvacData.utilityRebatesQuirk.split(";")[0].split(" pays ")[0]}, the sales priority is add-on margin rather than your utility bill.`,
      `A ${city} bid that foregrounds IAQ add-ons before covering Manual J sizing or ${util0} rebate stacking through ${hvacData.utilityRebatesQuirk.split(";")[0].split(" pays ")[0]} is telling you the margin is in the accessories.`,
      `When a ${city} bid opens with air-quality accessories before talking Manual J or ${util0} rebates via ${hvacData.utilityRebatesQuirk.split(";")[0].split(" pays ")[0]}, the real profit line is the add-ons — not the heating and cooling.`,
    ])
  });

  // Refrigerant scam - per-slug variant
  flags.push({
    title: pick(slug, "r410-title", [
      `${city} R-410A "obsolete" scam`,
      `"You can't service R-410A anymore" pitch`,
      `${city} refrigerant replacement scam`,
      `R-410A scarcity fear-selling in ${city}`,
    ]),
    body: pick(slug, "r410-body", [
      `${brand0} and ${brand1} wholesalers across the ${util0} territory still stock R-410A for servicing existing ${nbh(facts, 0)} and ${nbh(facts, 1)} systems. What stopped at end of 2024 was new-equipment manufacturing, not refrigerant supply.`,
      `R-410A refrigerant remains available through ${brand0} and ${brand1} distribution in ${state} for servicing installed ${city} systems — manufacturing of new R-410A units is what wound down in 2024.`,
      `${brand0} and ${brand1} distributors in the ${util0} area still fill R-410A service orders for existing ${city} customers. The 2024 cutoff ended new equipment production, not refrigerant availability.`,
    ]) + ` ` + pick(slug, "r410-tail", [
      `Any ${city} tech insisting your working R-410A unit "can't be serviced" is either confused or running a replacement pitch. Refrigerant recharges cost $${state === "CA" || state === "NY" || state === "MA" ? "300-550" : "200-450"} per pound, and most "low refrigerant" symptom calls are actually repairable leak locations.`,
      `A ${city} technician claiming R-410A service is impossible is wrong or selling replacement. Recharge rates sit at $${state === "CA" || state === "NY" || state === "MA" ? "300-550" : "200-450"} per pound; a "low refrigerant" fault is almost always a leak to find and repair.`,
      `When a ${city} tech tells you R-410A servicing ended, push back: recharges run $${state === "CA" || state === "NY" || state === "MA" ? "300-550" : "200-450"} per pound and most "low charge" findings are leak-and-repair, not replace-the-system.`,
    ]) + ` ` + pick(slug, "r22-tail", [
      `R-22 imports were banned from the US in 2020, so R-22 on a ${city} invoice is either mislabeled or smuggled.`,
      `Separately: any R-22 mention on a ${city} quote is a red flag — R-22 left the legal US supply chain with the 2020 import ban.`,
      `R-22 was banned from US import in 2020; a ${city} bid that lists R-22 is working with smuggled or mislabeled refrigerant.`,
    ])
  });

  flags.push({
    title: pick(slug, "local-title", [
      `${city} local pattern`,
      `${city}-specific scam`,
      `Regional ${city} HVAC trap`,
      `${city} market-specific pitch`,
    ]),
    body: `${hvacData.localScam}. ` + pick(slug, "local-tail", [
      `The ${city} tell is time pressure: the close wants you to commit inside one visit without a comparison bid.`,
      `In ${city}, the consistent giveaway is single-visit pressure — the pitch doesn't want you gathering second opinions.`,
      `The ${city} pattern always involves urgency: same-day decision, no competing quote, no time to research.`,
    ]) + ` A second opinion from a ${licensingBoardShort(state)}-credentialed ${nbh(facts, 2)} or ${nbh(facts, 3) || nbh(facts, 0)} shop costs 48 hours and routinely shaves $${state === "CA" || state === "NY" || state === "MA" ? "6,000-18,000" : state === "TX" || state === "FL" || state === "AZ" || state === "NV" ? "4,000-12,000" : "3,000-10,000"} off the first pitch.`
  });

  flags.push({
    title: pick(slug, "sameday-title", [
      `${city} same-day "discount" gimmick`,
      `"Sign tonight or lose it" in ${city}`,
      `Vanishing-price close on ${city} bids`,
      `${city} one-visit-only pricing trick`,
    ]),
    body: pick(slug, "sameday-body", [
      `${brand0}-authorized dealers and independent ${city} shops alike run this close. A real ${city} quote stays valid 30-90 days; anything "expiring tonight" was base-inflated so the fake discount lands at market price.`,
      `The sign-today play crosses every ${city} bidder tier from ${brand0} authorized dealers to value shops. Honest quotes in ${city} hold for 30-90 days — "today only" pricing is a flag, not a deal.`,
      `${city} contractors across every tier try this one. An authentic ${city} quote stays good for weeks; a quote that evaporates at the end of the visit was priced for panic, not for you.`,
    ]) + ` ` + pick(slug, "sameday-close", [
      `Walk away, gather bids from ${threeNbh(facts)} competitors, and notice ${util0} rebate deadlines run on quarterly or annual timelines, not end-of-visit.`,
      `Leave, get bids from ${threeNbh(facts)} alternatives, and remember ${util0} rebate windows span months — not the minutes left in the sales call.`,
      `Decline, collect competing bids in ${threeNbh(facts)}, and check the actual ${util0} rebate deadlines: they're quarterly or annual, not same-day.`,
    ])
  });

  if (ctx.hailRisk === "high") {
    flags.push({
      title: `${city} storm-claim bundling`,
      body: `After a hail event in ${nbh(facts, 0)} or ${nbh(facts, 1)}, some roofing crews offer to "bundle" HVAC replacement into the insurance claim on the theory that your outdoor condenser was "totaled by hail." Bent condenser fins are almost always field-repairable for $200-$500 via fin-combing and a coil cleaning; true compressor or coil failure from hail impact is genuinely rare. Ask for an independent ${licensingBoardShort(state)}-licensed HVAC technician to assess condenser damage separately from the roofing claim.`
    });
  }

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  const redH2 = pick(slug, "red-h2", [
    `HVAC Red Flags and Scams in ${city}`,
    `${city} HVAC Scam Patterns to Watch For`,
    `Red Flags on ${city} HVAC Bids`,
    `What to Watch Out for in ${city} HVAC Quotes`,
  ]);
  const redIntro = pick(slug, "red-intro", [
    `${city}'s HVAC market has its own recurring scam patterns. These are the ones that surface in ${threeNbh(facts)} most often.`,
    `Scammy ${city} HVAC pitches follow patterns. Here are the ones that keep showing up across ${threeNbh(facts)}.`,
    `${threeNbh(facts)} homeowners see the same handful of deceptive HVAC practices over and over; the list below catches the most common ones.`,
    `These are the HVAC sales patterns that burn ${city} homeowners most consistently across ${threeNbh(facts)}.`,
  ]);

  return `
<section class="section fp-section">
<h2>${redH2}</h2>
<p>${redIntro}</p>
${flagsHTML}
</section>`;
}

function licensingBoardShort(state) {
  return {
    TX: "TDLR", CA: "CSLB", AZ: "ROC", GA: "GA Secretary of State",
    WA: "L&I", CO: "Denver mechanical board", IL: "Illinois DFPR",
    NY: "NYC DOB", FL: "DBPR", MA: "MA sheet metal board",
    PA: "HICPA", MI: "Michigan licensing", MN: "MN contractor board",
    NC: "NC HVAC board", NV: "Nevada NSCB",
  }[state] || "state licensing";
}

/* 8. Seasonal buying guide - per-slug variants */
function seasonalGuide(slug, city, hvacData, facts) {
  const util0 = hvacData.utilityCompanies.split(" and ")[0];
  const brand0 = hvacData.localBrandNetworks.split(",")[0].split(" ")[0];

  const h2 = pick(slug, "season-h2", [
    `Best Time to Replace Your HVAC System in ${city}`,
    `When to Buy HVAC in ${city}: Seasonal Timing`,
    `${city} HVAC Buying Calendar`,
    `Seasonal Pricing for ${city} HVAC Replacements`,
  ]);

  const peakExplain = pick(slug, "peak-explain", [
    `Emergency ${city} replacements during these months carry a 10-20% premium because ${util0}-approved contractors book two to four weeks out.`,
    `${city} emergency pricing spikes 10-20% through these months since ${util0}-area shops run booked two to four weeks deep.`,
    `Expect a 10-20% ${city} premium during peak months: ${util0}-approved contractors carry a two-to-four-week backlog.`,
  ]);

  const proTip = pick(slug, "protip", [
    `Schedule a pre-season tune-up ($80-$150) through a ${brand0}-authorized ${city} shop in early spring or early fall.`,
    `Book a ${brand0}-authorized ${city} tune-up ($80-$150) before either shoulder season.`,
    `A spring or fall tune-up from a ${brand0}-authorized ${city} contractor runs $80-$150.`,
  ]);

  return `
<section class="section fp-section">
<h2>${h2}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months</h3>
<p class="fp-season-months">${hvacData.bestBuyMonths}</p>
<p>${hvacData.seasonReason}.</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Peak pricing / low availability</h3>
<p class="fp-season-months">${hvacData.worstBuyMonths}</p>
<p>${peakExplain} ${pick(slug, "peak-negotiate", [
  `Shops in ${threeNbh(facts)} have no incentive to discount when the next emergency call is already queued.`,
  `${threeNbh(facts)} contractors can afford to pass on negotiating; the emergency-call backlog keeps them busy.`,
  `Negotiating room disappears in ${threeNbh(facts)} whenever the emergency queue is full, which it always is during these weeks.`,
])} ${pick(slug, "peak-proactive", [
  `If your unit is 12+ years old, a planned replacement during ${hvacData.bestBuyMonths.toLowerCase()} is reliably cheaper than waiting for a ${hvacData.extremeTemp.split(",")[0].toLowerCase()}-driven failure.`,
  `Past the 12-year mark, scheduling replacement during ${hvacData.bestBuyMonths.toLowerCase()} beats hoping the unit survives the next ${hvacData.extremeTemp.split(",")[0].toLowerCase()}.`,
  `For any system over 12 years, proactive ${hvacData.bestBuyMonths.toLowerCase()} replacement saves real money versus the emergency-call alternative during ${hvacData.extremeTemp.split(",")[0].toLowerCase()}.`,
])}</p>
</div>
</div>
<p><strong>${pick(slug, "protip-lead", [`${city} pro tip.`, `One more ${city}-specific move.`, `A ${city} timing trick worth knowing.`, `${city} homeowner move.`])}</strong> ${proTip} ${pick(slug, "tune-catch", [
  `A tune-up tech catches early-failure indicators (elevated superheat, climbing high-side pressures, blower-motor bearing noise) that separate a controlled replacement from a ${hvacData.worstBuyMonths.split(" ")[0]}-weekend emergency in ${nbh(facts, 0)}.`,
  `The technician looks for early-stage failure signals — superheat drift, high-side pressure creep, noisy blower motor bearings — that flag a controlled replacement window before a ${hvacData.worstBuyMonths.split(" ")[0]} breakdown in ${nbh(facts, 0)}.`,
  `Pre-season diagnostics pick up superheat drift, pressure-side anomalies, and blower-motor bearing noise; those readings separate a planned replacement from a panicked ${hvacData.worstBuyMonths.split(" ")[0]}-weekend call in ${nbh(facts, 0)}.`,
])} ${pick(slug, "tune-plan", [
  `Most ${city} shops fold this into a yearly maintenance contract at $180-$280, which pencils out for multi-unit homes.`,
  `Annual maintenance plans in ${city} run $180-$280 and bundle the tune-up; worth it if you have more than one system.`,
  `${city} contractors typically package the tune-up into a $180-$280 annual service agreement — reasonable for multi-unit homes.`,
])}</p>
</section>`;
}

/* 9. Cost scenarios - per-slug variants */
function costScenarios(slug, city, state, mult, hvacData, facts) {
  const budgetTotal = Math.round(4400 * mult);
  const midTotal = Math.round(8000 * mult);
  const premTotal = Math.round(13500 * mult);

  const brandTop = hvacData.localBrandNetworks.split(",")[0].split(" ")[0];
  const brandMid = hvacData.localBrandNetworks.split(",").length > 1
    ? hvacData.localBrandNetworks.split(",")[1].trim().split(" ")[0]
    : "Rheem";
  const brandValue = "Goodman";

  function scenarioCard(label, desc, total, detail, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${desc}</p>
<p class="fp-scenario-total">${fmtK(total)}</p>
<p class="fp-scenario-detail">${detail}</p>
</div>`;
  }

  const auth = hvacData.permitAuthority.split("(")[0].trim();
  const util0 = hvacData.utilityCompanies.split(" and ")[0];
  const rebateName = hvacData.utilityRebatesQuirk.split(";")[0].split(" pays ")[0];
  const domPrimary = hvacData.dominantEquipmentStyle.split(";")[0];

  // Metro-specific budget/mid/prem descriptions
  const budgetDesc = hvacData.coolingDominant
    ? `15 SEER2 single-stage AC + ${hvacData.recommendedAFUE >= 90 ? "90% AFUE" : "80% AFUE"} furnace`
    : hvacData.heatingDominant
    ? `${hvacData.recommendedAFUE >= 95 ? "96% AFUE" : "92% AFUE"} furnace + 15 SEER2 AC`
    : `15 SEER2 AC + 90% AFUE furnace`;
  const midDesc = hvacData.heatPumpViable.includes("default") || hvacData.heatPumpViable.includes("excellent")
    ? `${Math.max(16, hvacData.recommendedSEER - 2)} SEER2 two-stage heat pump`
    : `${Math.max(16, hvacData.recommendedSEER - 1)} SEER2 heat pump + ${hvacData.recommendedAFUE}% AFUE dual-fuel backup`;
  const premDesc = hvacData.heatPumpViable.includes("default")
    ? `${hvacData.recommendedSEER}+ SEER2 variable-speed inverter heat pump`
    : `${hvacData.recommendedSEER}+ SEER2 variable-speed system with ${hvacData.recommendedAFUE}% AFUE backup`;

  // Budget body varies by cooling vs heating dominance
  const budgetBody = hvacData.coolingDominant
    ? `Single-stage ${brandValue} or Amana equipment, 10-year parts warranty from ${brandValue}'s factory-authorized network. Covers ${auth} permit, basic 7-day programmable thermostat, ${util0} interconnection paperwork, and haul-off of the old unit. A sensible budget pick for a ${nbh(facts, 2)} rental or a ${city} seller prepping a flip; not ideal for an owner planning 10+ year occupancy because the cooling run-hour count in ${city} wears single-stage compressors hard.`
    : hvacData.heatingDominant
    ? `Single-stage ${brandValue} or Amana furnace paired with a baseline AC condenser, 10-year parts coverage. Includes ${auth} permit, programmable thermostat, ${util0} gas line sign-off, and removal of the existing unit. Reasonable for a ${nbh(facts, 2)} starter home or a short-term ${city} hold; heating-hour counts in ${city} mean a 92-96% AFUE upgrade pays back fast enough that this tier usually isn't the right long-term pick.`
    : `Single-stage ${brandValue} or Amana equipment with a 10-year parts-only warranty. Covers ${auth} permit, programmable thermostat, ${util0} interconnection, and old-unit disposal. Fits ${nbh(facts, 2)} rentals or budget-bound ${city} owners with a short planned hold; duct sealing and HERS verification (where ${state} requires it) are not included.`;

  const midBody = hvacData.heatPumpViable.includes("default") || hvacData.heatPumpViable.includes("excellent")
    ? `Two-stage ${brandMid} heat pump, fresh refrigerant line set with A2L-rated fittings, ${auth} permit, ${util0} time-of-use-aware Wi-Fi thermostat (${brandMid === "Ecobee" || brandMid === "Nest" ? "Ecobee or Nest" : "Honeywell T10 or Ecobee Premium"}), duct leakage test, basic written commissioning report. 10-year parts plus 2-year labor warranty. Eligible for ${rebateName} rebate stacking. The sensible ${city} choice for most ${threeNbh(facts)} single-family homes.`
    : `Two-stage ${brandMid} heat pump with dual-fuel gas backup, new A2L line set, ${auth} permit, smart thermostat with ${util0} time-of-use scheduling, duct leakage measurement, and a written commissioning report. 10-year parts, 2-year labor warranty. The insurance-minded pick for ${threeNbh(facts)} homeowners who remember the last grid-stressing cold event.`;

  const premBody = pick(slug, "prem-body", [
    `Inverter-driven variable-speed ${brandTop} equipment with communicating controls. Full mastic-paste duct re-seal, flared-fitting A2L line set, ${auth} permit, smart thermostat with occupancy sensing, whole-home surge protection (genuinely relevant in ${city} given ${util0}'s grid profile), and HERS-verified written commissioning report. 12-year parts / 10-year labor warranty through ${brandTop}'s factory-authorized dealer program. Stacks maximum ${rebateName} rebate plus any ${state}-level incentives. The ROI pencils in ${city} only for a 10+ year hold.`,
    `Variable-speed ${brandTop} inverter equipment, full duct system re-sealed with mastic paste, A2L line set with flared fittings, ${auth} permit, smart thermostat tracking ${util0} time-of-use, whole-home surge suppression, and a HERS-verified commissioning document. ${brandTop} factory warranty of 12-year parts and 10-year labor. Eligible for the full ${rebateName} rebate plus ${state}-level stacking. Works financially in ${city} on a 10+ year ownership horizon.`,
    `Top-tier ${brandTop} inverter-driven heat pump with communicating controls and full-home duct re-sealing in mastic (not tape). A2L-ready line set, ${auth} mechanical permit, smart thermostat aware of ${util0} peak windows, whole-home surge protection, and HERS-verified commissioning. 12/10 warranty through ${brandTop}'s dealer program. Qualifies for full ${rebateName} stacking with ${state} incentives. ROI math only works in ${city} if you're staying 10+ years.`,
  ]);

  const h2 = pick(slug, "cost-h2", [
    `Real HVAC Project Scenarios in ${city}`,
    `${city} HVAC Cost Scenarios: Budget, Mid, Premium`,
    `What an HVAC Project Really Costs in ${city}`,
    `${city} HVAC Pricing: Three Worked Examples`,
  ]);
  const intro = pick(slug, "cost-intro", [
    `Actual ${city} pricing, adjusted for ${state} labor and the ${util0}-area equipment supply chain in 2026. All three scenarios run a 3-ton system on a 2,000 sq ft ${city} home with existing ductwork (${domPrimary} is the ${city} norm).`,
    `Here's what real ${city} HVAC projects cost in 2026, using ${state}-calibrated labor and ${util0}-area parts availability. Every scenario assumes a 3-ton, 2,000 sq ft ${city} home with serviceable ductwork and ${domPrimary}.`,
    `These ${city} numbers reflect 2026 ${state} labor rates and the current ${util0}-territory equipment supply chain. Each scenario targets a 3-ton system on a 2,000 sq ft home where ${domPrimary} already exists.`,
  ]);

  return `
<section class="section fp-section">
<h2>${h2}</h2>
<p>${intro}</p>
<div class="fp-scenario-grid">
${scenarioCard("Budget", budgetDesc, budgetTotal, budgetBody, "#22c55e")}
${scenarioCard("Mid-Range", midDesc, midTotal, midBody, "#3b82f6")}
${scenarioCard("Premium", premDesc, premTotal, premBody, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">${pick(slug, "cost-caveat", [
  `Full duct replacement adds $3,000-$7,000 in ${city}; multi-story ${nbh(facts, 0)} or ${nbh(facts, 1)} homes, or any ${facts.landmarks?.[0] ? facts.landmarks[0] + "-adjacent" : "historic-district"} install, add 10-20% on top.`,
  `Add $3,000-$7,000 for full duct replacement in ${city}. Multi-story homes in ${nbh(facts, 0)} or ${nbh(facts, 1)} and ${facts.landmarks?.[0] ? facts.landmarks[0] + "-adjacent" : "historic-district"} installs run 10-20% above these numbers.`,
  `Budget another $3,000-$7,000 if full ductwork replacement is needed. A second story, or a ${facts.landmarks?.[0] ? facts.landmarks[0] + "-adjacent" : "historic-district"} ${city} property, typically adds 10-20%.`,
])} <a href="/hvac-quote-analyzer.html" style="color:var(--brand);">Upload your ${city} quote for a side-by-side comparison.</a></p>
</section>`;
}

/* CSS */
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

  let html = flagshipCSS();
  html += `\n${MARKER_START}\n`;
  html += neighborhoodPricing(metro.slug, facts, mult, hvacData);
  html += climateDeepDive(city, state, ctx, facts, hvacData);
  html += energyEfficiencySection(metro.slug, city, state, hvacData);
  html += utilityRateSection(metro.slug, city, state, hvacData, facts);
  html += permitSection(metro.slug, city, state, facts, hvacData);
  html += contractorMarketSection(metro.slug, city, state, ctx, facts, hvacData);
  html += redFlagsSection(metro.slug, city, state, ctx, hvacData, facts);
  html += seasonalGuide(metro.slug, city, hvacData, facts);
  html += costScenarios(metro.slug, city, state, mult, hvacData, facts);
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
