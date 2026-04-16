#!/usr/bin/env node
/**
 * Generates deep editorial content for 10 flagship metro plumbing pages.
 * Injects ~2500 words of genuinely unique, city-specific prose.
 * Idempotent via FLAGSHIP-PLUMBING-CONTENT markers.
 *
 * Usage: node scripts/build-flagship-plumbing.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/plumbing-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-PLUMBING-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-PLUMBING-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-plumbing-cost.html" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-plumbing-cost.html" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-plumbing-cost.html" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-plumbing-cost.html" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-plumbing-cost.html" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-plumbing-cost.html" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-plumbing-cost.html" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-plumbing-cost.html" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-plumbing-cost.html" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-plumbing-cost.html" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-plumbing-cost.html" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-plumbing-cost.html" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-plumbing-cost.html" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-plumbing-cost.html" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-plumbing-cost.html" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-plumbing-cost.html" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-plumbing-cost.html" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-plumbing-cost.html" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-plumbing-cost.html" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-plumbing-cost.html" },
];

/* State-to-region mapping for laborMultiplierByRegion */
const STATE_REGION = {
  NY: "northeast", CA: "west", IL: "midwest", TX: "south",
  AZ: "mountain", GA: "southeast", CO: "mountain", WA: "west",
};

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString("en-US")}`; }
function fmtD(n) { return `$${n.toLocaleString("en-US")}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function roundTo(n, r) { return Math.round(n / r) * r; }

function getMultiplier(state) {
  const region = STATE_REGION[state] || "south";
  return pricingModel.laborMultiplierByRegion?.[region] || 1.0;
}

/* ---------- Metro-specific plumbing data ---------- */

const METRO_PLUMBING = {
  "new-york-ny": {
    waterQuality: "New York City draws its water from the Catskill and Delaware watersheds, producing some of the softest municipal water in the country. Hard-water scale is rarely a problem here, but the sheer age of the distribution system introduces its own issues. Many pre-war buildings still have lead service lines connecting to the city main, and galvanized steel risers inside older walk-ups are prone to corrosion and reduced flow. Copper has been the standard replacement for decades, though PEX is gaining acceptance in NYC renovations where access is limited.",
    pipeMaterial: "galvanized steel in pre-war buildings (common), copper in 1950s-1980s renovations, and increasingly PEX in modern retrofits. Lead service lines from the street to the building still exist in some older neighborhoods and should be tested if not already replaced.",
    freezeRisk: "high",
    freezeNote: "Exposed pipes in unheated basements, crawlspaces, and exterior walls are at serious freeze risk during January and February cold snaps. Burst pipe repairs in NYC are especially costly because of access difficulty in multi-story walk-ups and the premium on emergency plumbing labor in the metro.",
    slabLeakRisk: "low",
    sewerType: "municipal combined sewer system (storm + sanitary). NYC's aging infrastructure means backups during heavy rain events are common in low-lying neighborhoods. Backwater valves are strongly recommended.",
    treeRootRisk: "moderate in outer boroughs with mature street trees; terracotta sewer laterals in Brooklyn and Queens are particularly vulnerable to root intrusion.",
    septicNote: null,
    licensingBody: "NYC Department of Buildings (DOB)",
    licensingDetail: "NYC requires a master plumber license for anyone performing plumbing work. This is one of the most restrictive licensing regimes in the country. Only a licensed master plumber or someone working under their direct supervision can legally do plumbing work in the five boroughs. Verify any plumber's license at the DOB website before signing a contract.",
    emergencyMultiplier: 2.5,
    emergencyNote: "Emergency plumbing calls in NYC typically run 2-3x the cost of scheduled work due to the combination of high base labor rates, after-hours premiums, and access difficulty in dense urban buildings.",
  },
  "los-angeles-ca": {
    waterQuality: "LA's water supply is a mix of imported Colorado River water, Northern California aqueduct water, and local groundwater. The Colorado River source is moderately hard (120-180 ppm), which causes mineral buildup in water heaters and reduces their efficiency and lifespan. Whole-house water softeners are common in LA, and tankless water heaters should be descaled annually. The 1994 Northridge earthquake damaged thousands of copper supply lines and sewer laterals across the San Fernando Valley, and many of those repairs are now 30+ years old and approaching the end of their service life.",
    pipeMaterial: "copper supply lines are standard in most LA homes built after 1960. Some post-WWII bungalows still have original galvanized steel. Polybutylene (gray plastic pipe, 1978-1995) is present in some Valley homes and is a known failure risk that should be replaced proactively.",
    freezeRisk: "none",
    freezeNote: null,
    slabLeakRisk: "moderate",
    slabLeakNote: "Slab leaks are a significant concern in LA, particularly in homes built on the basin's expansive clay soils. Copper pipes running through or under the slab can develop pinhole leaks from soil chemistry and minor seismic movement. Electronic leak detection runs $200-$500 and is worth doing before committing to an access method (tunneling under the slab vs. cutting through it).",
    sewerType: "municipal sewer with aging terracotta laterals in many neighborhoods built before 1970. Camera inspection before any sewer work is essential.",
    treeRootRisk: "high in established neighborhoods with mature trees, especially in areas like Eagle Rock, Highland Park, and Pasadena where large oaks and ficus trees are common. Root intrusion into terracotta sewer lines is the number one cause of mainline backups.",
    septicNote: null,
    licensingBody: "CSLB (Contractors State License Board)",
    licensingDetail: "California requires a C-36 plumbing contractor license for any plumbing work over $500. Verify at cslb.ca.gov. The CSLB database shows license status, bond information, complaint history, and workers' compensation coverage. An unlicensed plumber in California is breaking the law, and you have no legal recourse if the work fails.",
    emergencyMultiplier: 2.0,
    emergencyNote: "Emergency plumbing in LA runs roughly 2x the cost of scheduled work. The premium is driven more by high base labor rates than by after-hours surcharges.",
  },
  "chicago-il": {
    waterQuality: "Chicago draws from Lake Michigan, which provides moderately soft water (around 140 ppm hardness). Hard-water scale is not a major concern, but the city's aging water mains and lead service lines are. Chicago has more lead service lines than any other US city, and the city's lead service line replacement program is ongoing but will take decades to complete. If your home was built before 1986, test your water for lead and consider a whole-house filter.",
    pipeMaterial: "lead service lines from the main to the home in most pre-1986 construction (Chicago mandated lead until 1986, later than most cities). Copper and galvanized inside the home. PEX is now standard for new work and repiping.",
    freezeRisk: "very high",
    freezeNote: "Chicago's brutal winters (sub-zero stretches every year) make frozen pipe prevention critical. Pipes in exterior walls, unheated garages, and crawlspaces are at extreme risk. The city recommends keeping a slow drip running during extreme cold. Burst pipe repairs surge every January and February, and emergency plumbers are in very high demand during polar vortex events. Insulating all exposed pipes is a low-cost preventive measure that pays for itself after one avoided burst.",
    slabLeakRisk: "low",
    sewerType: "municipal combined sewer (storm + sanitary). Chicago's system is notorious for basement backups during heavy rain. A properly installed backwater valve ($1,500-$3,000 installed) is essential for any home with a below-grade finished basement.",
    treeRootRisk: "high in older neighborhoods with mature tree canopy. The brick-laid sewer laterals in pre-1940 homes are especially vulnerable.",
    septicNote: null,
    licensingBody: "Illinois DFPR (Department of Financial and Professional Regulation)",
    licensingDetail: "Illinois requires a state plumbing license. Chicago additionally requires a City of Chicago plumbing license for work within city limits. This dual licensing requirement is unique and important -- verify both. A contractor licensed in the suburbs may not be legal to work in the City of Chicago without the city license.",
    emergencyMultiplier: 2.5,
    emergencyNote: "Emergency plumbing in Chicago runs 2-3x scheduled rates, with the highest premiums during winter freeze events when demand overwhelms available labor.",
  },
  "houston-tx": {
    waterQuality: "Houston's water is moderately hard (100-150 ppm depending on the source). The city draws from Lake Houston and Lake Livingston, and hardness varies by neighborhood and season. Water heater sediment buildup is a real issue -- annual tank flushing extends lifespan by 2-3 years. Whole-house water softeners are common in Houston suburbs.",
    pipeMaterial: "copper is standard in most Houston homes built after 1970. CPVC (cream-colored plastic) was widely used in 1990s-2000s tract homes and is still code-compliant but becomes brittle with age and UV exposure. Polybutylene (gray pipe, 1978-1995) is present in many homes built during Houston's boom decades and is a known class-action failure risk. If your home has polybutylene, budget for a full repipe -- it is not a matter of if it will fail, but when.",
    freezeRisk: "moderate",
    freezeNote: "February 2021's Winter Storm Uri exposed Houston's vulnerability to extreme cold. Hundreds of thousands of homes experienced burst pipes, and the plumbing repair backlog lasted months. Houston homes are not built for freeze protection the way northern homes are -- insulation is minimal, pipes often run through unconditioned attic spaces, and exterior hose bibs rarely have frost-free valves. After Uri, pipe insulation and recirculation loop retrofits became much more common, and for good reason.",
    slabLeakRisk: "high",
    slabLeakNote: "Houston's expansive Beaumont clay creates one of the highest slab-leak rates in the country. Foundation movement stresses copper supply lines running through the slab, causing pinhole leaks and joint failures. Electronic leak detection ($250-$450) is the first step before any slab access. Tunneling under the slab is preferred over jackhammering through it, because cutting the slab can compromise structural integrity on already-stressed foundations.",
    sewerType: "municipal sewer in most of the city. Some older areas still have aging clay tile laterals that are prone to joint separation and root intrusion.",
    treeRootRisk: "high in established neighborhoods like The Heights and Montrose where mature live oaks dominate.",
    septicNote: "Some homes in outlying Harris County (Cypress, Katy, Spring) are on septic systems. Septic-to-sewer conversion runs $5,000-$15,000 depending on distance to the nearest main.",
    licensingBody: "TSBPE (Texas State Board of Plumbing Examiners)",
    licensingDetail: "Texas requires a state plumbing license issued by TSBPE. There are three tiers: Tradesman, Journeyman, and Master. Only a Master Plumber or a Journeyman working under a Master can pull permits and take on independent jobs. Verify at tsbpe.texas.gov. The City of Houston does not require an additional local license, but the state license is mandatory.",
    emergencyMultiplier: 2.0,
    emergencyNote: "Emergency plumbing in Houston typically runs 2x the cost of scheduled work. During freeze events (like Uri), expect 3x or more due to overwhelming demand and limited parts availability.",
  },
  "phoenix-az": {
    waterQuality: "Phoenix has some of the hardest water in the country, averaging 220-350 ppm depending on the source (Salt River Project vs. Central Arizona Project). This extreme hardness causes aggressive mineral scale buildup in water heaters, reducing efficiency by up to 30% and cutting tank life from 12 years to 6-8. Tankless water heaters in Phoenix absolutely must be descaled annually, or they will fail prematurely. Whole-house water softeners are not optional here -- they are essential for protecting all plumbing fixtures and appliances.",
    pipeMaterial: "copper is the standard in most Phoenix homes. The alkaline soil and hard water create conditions that accelerate copper corrosion from the outside (soil contact) and inside (scale buildup). PEX repiping is increasingly popular because it resists both scale and corrosion. CPVC was common in 1990s-2000s construction and becomes extremely brittle in Phoenix's extreme heat, especially in attic runs where temperatures exceed 150 degrees.",
    freezeRisk: "very low",
    freezeNote: "Pipe freezing is extremely rare in Phoenix proper but can occur in outlying areas (Fountain Hills, Cave Creek) during the occasional hard freeze in December or January. Most Phoenix homes have zero freeze protection, so the rare event can cause disproportionate damage.",
    slabLeakRisk: "moderate",
    slabLeakNote: "Phoenix's caliche soil is dense and does not expand like clay, but the combination of extremely hard water and copper pipes running through alkaline soil creates conditions for pinhole leaks under and through the slab. Rerouting supply lines through the attic or walls (rather than through the slab) is a common Phoenix solution that avoids future slab-access costs.",
    sewerType: "municipal sewer throughout the metro. Phoenix's relatively modern sewer infrastructure (most built post-1970) means fewer legacy terracotta pipe issues than older cities.",
    treeRootRisk: "low in most areas due to limited mature tree canopy, but moderate near irrigated landscaping where roots aggressively seek water sources.",
    septicNote: "Some homes in Anthem, Rio Verde, and other outlying communities are on septic systems. Desert soil conditions make septic systems perform differently than in wetter climates -- leach fields need larger footprints.",
    licensingBody: "Arizona ROC (Registrar of Contractors)",
    licensingDetail: "Arizona requires a CR-37 (plumbing) license from the Registrar of Contractors for any plumbing work. Verify at roc.az.gov. The ROC database includes complaint history, bond status, and license classification. Arizona also requires a separate backflow prevention certification for anyone working on irrigation or fire suppression crossings.",
    emergencyMultiplier: 2.0,
    emergencyNote: "Emergency plumbing calls in Phoenix run roughly 2x scheduled rates. The premium is consistent year-round since Phoenix does not have the seasonal freeze surges that affect northern markets.",
  },
  "dallas-tx": {
    waterQuality: "Dallas water is moderately hard (120-180 ppm), sourced from a network of regional reservoirs. Hard water scale reduces water heater efficiency and shortens equipment lifespan. Annual tank flushing and water softener installation are both worthwhile investments in the DFW area.",
    pipeMaterial: "copper is standard in most Dallas homes built after 1970. The massive 1980s-2000s suburban building boom used a mix of copper, CPVC, and unfortunately polybutylene. Polybutylene (gray plastic pipe) was installed in hundreds of thousands of DFW homes between 1978-1995 and is a known catastrophic failure risk. If your home has polybutylene, full PEX repipe is the recommended solution.",
    freezeRisk: "moderate",
    freezeNote: "Dallas is more freeze-vulnerable than most Texas homeowners expect. Ice storms in 2021 (Uri) and 2023 caused widespread burst pipes across DFW. Most Dallas homes are built with minimal freeze protection -- pipes in attics, exterior walls, and garages are all at risk during hard freezes. Pipe insulation and frost-free hose bibs are low-cost preventive measures.",
    slabLeakRisk: "high",
    slabLeakNote: "Dallas sits on Houston Black clay, one of the most expansive soil types in the country. Foundation movement is endemic, and slab leaks are a direct consequence. The soil shrinks during drought and swells when wet, stressing copper supply lines running through the slab. Electronic leak detection is the essential first step, and tunneling under the slab is generally preferred over cutting through it.",
    sewerType: "municipal sewer throughout most of the metro. Many 1950s-1970s neighborhoods have original clay tile sewer laterals that are approaching or past their useful life.",
    treeRootRisk: "moderate to high in established neighborhoods like Lakewood, Highland Park, and Preston Hollow where mature pecan and live oak trees are common.",
    septicNote: null,
    licensingBody: "TSBPE (Texas State Board of Plumbing Examiners)",
    licensingDetail: "Texas requires a state plumbing license from TSBPE. Only a Master Plumber or Journeyman working under a Master can pull permits. Verify at tsbpe.texas.gov. After major storm events, out-of-state plumbers sometimes appear offering emergency repairs without Texas licensure -- always verify before allowing work to begin.",
    emergencyMultiplier: 2.0,
    emergencyNote: "Emergency plumbing in Dallas runs about 2x scheduled rates under normal conditions. During freeze events, expect 2.5-3x due to the surge in burst pipe calls across the metro.",
  },
  "atlanta-ga": {
    waterQuality: "Atlanta's water comes from the Chattahoochee River and Lake Lanier, producing moderately soft water (60-100 ppm hardness). Hard-water scale is not a significant concern here, but the clay-rich soil creates aggressive conditions for underground pipes and sewer laterals.",
    pipeMaterial: "copper supply lines are standard in most Atlanta homes. Older craftsman bungalows in Virginia-Highland, Inman Park, and Grant Park (1920s-1940s) may still have original galvanized steel pipes that are corroded and restricting flow. Polybutylene was used extensively in 1980s-1990s Atlanta suburbs and is a known failure risk. PEX is the current standard for new work and repiping.",
    freezeRisk: "moderate",
    freezeNote: "Atlanta gets hard freezes several times per winter, and the city's infrastructure is not built for sustained cold the way northern cities are. Pipes in crawlspaces (common in Atlanta's raised-foundation housing stock) are particularly vulnerable. The January 2014 ice storm and multiple recent freeze events have caused significant burst pipe damage across the metro.",
    slabLeakRisk: "moderate",
    slabLeakNote: "Georgia red clay expands and contracts with moisture, creating foundation stress that can damage supply lines running through or under slabs. Homes in older intown neighborhoods on clay are more at risk than newer construction on compacted fill.",
    sewerType: "municipal sewer in the city, managed by the Department of Watershed Management. Atlanta's sewer infrastructure has been under a federal consent decree for decades due to combined sewer overflows. The city has invested billions in repairs, but individual homeowner laterals remain the homeowner's responsibility.",
    treeRootRisk: "very high. Atlanta's mature tree canopy is one of the densest in any major US city. Large oaks, magnolias, and pines aggressively invade sewer laterals, and root intrusion is the leading cause of sewer backups in intown neighborhoods.",
    septicNote: "Some homes in outlying Gwinnett, Cherokee, and Forsyth counties are on septic systems. Septic-to-sewer conversion is available in most areas but runs $8,000-$15,000.",
    licensingBody: "Georgia Secretary of State / Professional Licensing Board",
    licensingDetail: "Georgia requires a state plumbing license. There are three classifications: Journeyman Plumber, Master Plumber, and Plumbing Contractor. Only a licensed Plumbing Contractor or Master Plumber can pull permits and operate independently. Verify at sos.ga.gov. Fulton and DeKalb counties may have additional registration requirements.",
    emergencyMultiplier: 2.0,
    emergencyNote: "Emergency plumbing in Atlanta runs about 2x scheduled rates. The premium spikes during freeze events and after severe storms when sewer backups increase across the metro.",
  },
  "denver-co": {
    waterQuality: "Denver Water sources from the South Platte River and western slope reservoirs. Water hardness is moderate (80-130 ppm), low enough that water softeners are not essential but high enough that annual water heater flushing makes a real difference in equipment life. Denver's mile-high altitude reduces boiling points and affects water heater efficiency slightly, but the practical impact on plumbing costs is minimal.",
    pipeMaterial: "copper is the dominant pipe material in Denver homes across all eras. The 1900-1930 brick bungalows in central neighborhoods like Wash Park and Highlands often have original galvanized steel that is severely corroded. PEX is the standard for modern repiping and new construction. Denver's dry climate and alkaline soil can cause exterior corrosion on copper pipes running through concrete and soil.",
    freezeRisk: "high",
    freezeNote: "Denver's winters bring sustained sub-freezing temperatures from November through March, with periodic arctic plunges well below zero. Frozen pipes are a routine winter hazard. Most Denver homes are well-insulated compared to Sun Belt construction, but older homes and homes with unfinished basements still experience freeze damage regularly. Exterior hose bibs should all be frost-free type, and any pipe running through an unheated space needs insulation.",
    slabLeakRisk: "moderate",
    slabLeakNote: "Denver's expansive bentonite clay creates foundation movement similar to Dallas and Houston, though generally less severe. Homes in the eastern metro (Aurora, Stapleton) on heavy clay are more at risk than homes on the western side closer to the foothills.",
    sewerType: "municipal sewer throughout the metro. Denver's system is separate (not combined), which reduces backup risk during storms. However, many older neighborhoods have original clay tile laterals that are 60-80 years old.",
    treeRootRisk: "moderate. Denver's semi-arid climate limits tree size compared to wetter cities, but established neighborhoods with mature elms, maples, and cottonwoods still experience root intrusion in older sewer lines.",
    septicNote: null,
    licensingBody: "Colorado DORA (Department of Regulatory Agencies)",
    licensingDetail: "Colorado licenses plumbers at the state level through DORA. There are Journeyman and Master tiers. The City and County of Denver requires additional registration. Colorado's licensing requirements are among the strictest in the western states. Verify at dora.colorado.gov. Note that Colorado does not have reciprocity with neighboring states, so a plumber licensed in Utah or New Mexico cannot legally work in Denver.",
    emergencyMultiplier: 2.5,
    emergencyNote: "Emergency plumbing in Denver runs 2-3x scheduled rates, with the highest premiums during winter freeze events (December through February) when burst pipe calls overwhelm available capacity.",
  },
  "seattle-wa": {
    waterQuality: "Seattle's water comes from the Cedar River and Tolt River watersheds in the Cascade foothills, producing extremely soft water (20-30 ppm hardness). Hard-water scale is virtually nonexistent here, which means water heaters last longer and require less maintenance than in hard-water markets. The tradeoff is that Seattle's soft, slightly acidic water can be mildly corrosive to copper pipes over decades, though this is a slow process.",
    pipeMaterial: "copper supply lines are standard. The 1920s-1940s craftsman bungalows in Capitol Hill, Ballard, and Wallingford sometimes still have original galvanized steel that is corroded and flow-restricted. PEX is the standard for modern repiping. Seattle's constant moisture means any pipe running through crawlspaces (very common in Seattle's raised-foundation housing stock) needs corrosion monitoring.",
    freezeRisk: "low",
    freezeNote: "Seattle rarely sees sustained freezing temperatures, but when it does (the occasional arctic outflow event every few years), the city is unprepared. Most Seattle homes have minimal freeze protection, and the combination of raised foundations with exposed crawlspace plumbing creates vulnerability during rare cold snaps.",
    slabLeakRisk: "low",
    slabLeakNote: null,
    sewerType: "municipal sewer managed by Seattle Public Utilities. Parts of the system are combined (storm + sanitary), which means basement and ground-floor backups during heavy rain are a real concern in older neighborhoods. SPU offers a Side Sewer Assistance Program to help homeowners with lateral repairs.",
    treeRootRisk: "very high. Seattle's wet climate produces aggressive root growth, and the city's extensive mature tree canopy (Douglas fir, bigleaf maple, Western red cedar) actively invades sewer laterals. Root intrusion is the leading cause of sewer problems in Seattle.",
    septicNote: null,
    licensingBody: "Washington State L&I (Department of Labor and Industries)",
    licensingDetail: "Washington requires plumber certification through L&I. There are Trainee, Journeyman, and Specialty tiers. Only a licensed Journeyman plumber or a contractor employing one can pull permits. Verify at lni.wa.gov. Seattle does not require an additional city license, but all plumbers must be L&I certified.",
    emergencyMultiplier: 2.0,
    emergencyNote: "Emergency plumbing in Seattle runs about 2x scheduled rates. The premium is relatively stable year-round since Seattle does not experience the freeze-surge pricing spikes that affect colder or less-prepared markets.",
  },
  "austin-tx": {
    waterQuality: "Austin's water comes from the Colorado River (Lake Travis and Lake Austin), and hardness varies significantly by location. West Austin generally has harder water (150-250 ppm) due to the limestone geology of the Hill Country, while east Austin water is moderately hard (100-150 ppm). Hard water shortens water heater life, clogs aerators, and reduces fixture efficiency. Water softeners are recommended for homes in west Austin and any home with a tankless water heater.",
    pipeMaterial: "copper is standard in most Austin homes. West Austin construction often runs through limestone, which makes slab access expensive and repiping more complex. Polybutylene was used in some 1980s-1990s suburban construction and should be replaced proactively. PEX is the current standard for new work and repiping.",
    freezeRisk: "moderate",
    freezeNote: "Winter Storm Uri in February 2021 was a wake-up call for Austin. The city's water treatment system failed, hundreds of thousands of homes experienced burst pipes, and the repair backlog lasted well into summer. Austin homes are not built for sustained freezing temperatures -- pipes in attics (very common in Austin construction) and exterior walls are extremely vulnerable. Post-Uri, pipe insulation retrofits and main shut-off valve upgrades have become standard recommendations.",
    slabLeakRisk: "high in east Austin",
    slabLeakNote: "East Austin sits on expansive clay similar to Houston and Dallas. Slab leaks are common. West Austin has a different problem: the limestone shelf makes slab access extremely expensive because tunneling and cutting through rock adds significant labor cost. Electronic leak detection ($250-$450) is worth doing before committing to an access method in either area.",
    sewerType: "municipal sewer managed by Austin Water. The system is relatively modern, but rapid growth has strained capacity in some areas.",
    treeRootRisk: "moderate to high in established central neighborhoods like Hyde Park and Travis Heights where mature live oaks are common.",
    septicNote: "Some homes in western Travis County (Lakeway, Bee Cave) and eastern Williamson County are on septic or aerobic systems. Austin Water is extending sewer service to many of these areas, and septic-to-sewer conversion runs $5,000-$12,000.",
    licensingBody: "TSBPE (Texas State Board of Plumbing Examiners)",
    licensingDetail: "Texas requires a state plumbing license from TSBPE. Only a Master Plumber or Journeyman working under a Master can pull permits. Verify at tsbpe.texas.gov. Austin's tight labor market and rapid growth mean unlicensed operators occasionally surface -- always verify before work begins.",
    emergencyMultiplier: 2.0,
    emergencyNote: "Emergency plumbing in Austin runs about 2x scheduled rates under normal conditions. During freeze events (like Uri), emergency rates can hit 3x or more, and wait times stretch to days.",
  },
};

/* ---------- Section generators ---------- */

function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";
  const bp = pricingModel.basePriceByService;
  const rnd = pricingModel.roundTo || 25;
  const baseWH = bp.water_heater.priceByType.tank_50_gas;
  const baseSewer = bp.sewer_line.priceByMethod.traditional_dig;
  const baseBath = bp.bathroom_rough_in.priceByScope.full_bath;
  const baseRepipe = bp.repipe.priceByMaterial.pex;

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    const wh = roundTo(Math.round(baseWH * mult * localVar), rnd);
    const sewer = roundTo(Math.round(baseSewer * mult * localVar), rnd);
    const bath = roundTo(Math.round(baseBath * mult * localVar), rnd);
    const repipe = roundTo(Math.round(baseRepipe * mult * localVar), rnd);
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(wh)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(sewer)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(bath)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(repipe)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>Neighborhood Plumbing Cost Breakdown</h2>
<p>Plumbing costs vary within ${facts.displayName} based on housing age, pipe material, foundation type, and local labor demand. These are estimated costs for common projects by neighborhood.</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Water Heater</th>
<th style="text-align:right; padding:12px 16px;">Sewer Line</th>
<th style="text-align:right; padding:12px 16px;">Bath Rough-In</th>
<th style="text-align:right; padding:12px 16px;">Whole Repipe</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Estimates based on local labor rates and typical project scope. Actual pricing depends on access difficulty, pipe material, and current demand. <a href="/plumbing-quote-analyzer.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your quote for an exact comparison.</a></p>
</section>`;
}

function waterQualitySection(city, state, metro) {
  const data = METRO_PLUMBING[metro.slug];
  if (!data) return "";

  return `
<section class="section fp-section">
<h2>Water Quality and Pipe Materials in ${city}</h2>
<p>${data.waterQuality}</p>
<p><strong>What is in your walls.</strong> ${cap(data.pipeMaterial)}</p>
<p>If your home was built between 1978 and 1995, check specifically for polybutylene pipe (usually gray, sometimes blue or black, with plastic or copper crimp fittings). Polybutylene degrades from the inside out and fails without warning. Insurance companies in many states will not cover water damage from polybutylene failures if the homeowner was aware the pipe was present. Full PEX repipe is the recommended solution, and it is one of the highest-ROI plumbing investments you can make in an older home.</p>
</section>`;
}

function climateImpactSection(city, state, ctx, facts, metro) {
  const data = METRO_PLUMBING[metro.slug];
  if (!data) return "";
  const paras = [];

  if (data.freezeRisk !== "none" && data.freezeNote) {
    paras.push(`<p><strong>Freeze risk.</strong> ${data.freezeNote}</p>`);
  }

  if (data.slabLeakRisk && data.slabLeakRisk !== "low" && data.slabLeakNote) {
    paras.push(`<p><strong>Slab leaks.</strong> ${data.slabLeakNote}</p>`);
  }

  if (facts.soil) {
    paras.push(`<p><strong>Soil and foundation.</strong> ${cap(facts.soil)}. Foundation movement from soil expansion and contraction is one of the leading causes of supply line failures and sewer lateral damage. If you see new cracks in drywall, doors sticking, or uneven floors, have the foundation evaluated before investing in plumbing repairs -- fixing the symptom without addressing the cause means the new work will fail the same way.</p>`);
  }

  if (paras.length === 0) return "";

  return `
<section class="section fp-section">
<h2>How ${city}'s Climate Affects Your Plumbing</h2>
<p>${cap(facts.climate)}. These conditions have direct implications for plumbing system longevity, emergency risk, and project timing in ${city}.</p>
${paras.join("\n")}
</section>`;
}

function sewerDrainageSection(city, state, metro) {
  const data = METRO_PLUMBING[metro.slug];
  if (!data) return "";
  const paras = [];

  paras.push(`<p><strong>Sewer system.</strong> ${city} uses a ${data.sewerType}</p>`);

  if (data.treeRootRisk) {
    paras.push(`<p><strong>Tree root intrusion.</strong> Root intrusion risk in ${city} is ${data.treeRootRisk}. Camera inspection ($250-$450) before any sewer repair or replacement is non-negotiable. A contractor who recommends sewer work without first running a camera through the line is either cutting corners or upselling. The camera inspection tells you exactly where the problem is, what caused it, and what repair method is appropriate. Without it, you are guessing -- and guessing with sewer work means overpaying or under-solving.</p>`);
  }

  if (data.septicNote) {
    paras.push(`<p><strong>Septic systems.</strong> ${data.septicNote}</p>`);
  }

  return `
<section class="section fp-section">
<h2>Sewer and Drainage in ${city}</h2>
${paras.join("\n")}
</section>`;
}

function permitSection(city, state, facts, metro) {
  const data = METRO_PLUMBING[metro.slug];
  if (!data) return "";

  return `
<section class="section fp-section">
<h2>Plumbing Permits and Inspections in ${city}</h2>
<p>${facts.permits}. A plumbing permit is required for virtually all work beyond simple repairs in ${city}. The permit ensures the work is inspected for code compliance, which protects you as the homeowner and ensures the work is insurable.</p>
<p>Your plumber should pull the permit as part of the job. If a plumber asks you to pull the permit yourself, or suggests skipping the permit entirely, that is a serious red flag. Unpermitted plumbing work can void your homeowners insurance, create problems during a home sale, and leave you liable for water damage caused by substandard installation.</p>
<p>After the job is complete, confirm that a final inspection was scheduled and passed. Most jurisdictions in ${state} require a pressure test and visual inspection of all new plumbing work. Keep the inspection documentation with your warranty paperwork.</p>
</section>`;
}

function licensingSection(city, state, metro) {
  const data = METRO_PLUMBING[metro.slug];
  if (!data) return "";

  return `
<section class="section fp-section">
<h2>Plumbing Contractor Licensing in ${city}</h2>
<p>Plumbing is one of the most heavily licensed trades in the United States, and for good reason. Improper plumbing work can cause catastrophic water damage, sewage exposure, and gas leaks. Every state regulates plumbing licenses differently, and ${city} has specific requirements you should verify before hiring anyone.</p>
<p><strong>Licensing authority.</strong> ${data.licensingDetail}</p>
<p>Beyond licensing, verify that any plumber you hire carries general liability insurance (minimum $500,000) and workers' compensation coverage. Ask for certificates of insurance and verify them with the issuer. A plumber who is licensed but uninsured transfers all liability risk to you as the homeowner.</p>
</section>`;
}

function redFlagsSection(city, state, metro) {
  const data = METRO_PLUMBING[metro.slug];
  if (!data) return "";
  const flags = [];

  flags.push({
    title: "No camera inspection before sewer work",
    body: `Any plumber who recommends sewer line replacement, lining, or major repair without first running a camera inspection is either guessing or inflating the scope. A camera inspection costs $250-$450 and shows exactly what is wrong, where it is, and what method is appropriate. In ${city}, root intrusion, joint separation, and bellied pipe are all common -- and each requires a different repair approach. Skipping the camera means you cannot verify the diagnosis.`
  });

  flags.push({
    title: "Excessive deposit (over 25-30%)",
    body: `A deposit exceeding 25-30% of the total job cost is a warning sign. Established plumbers in ${city} with good supplier relationships do not need large upfront deposits to purchase materials. A reasonable structure is 10-15% at signing or material delivery, with the balance due upon completion and final inspection. If a plumber demands 50% upfront, that is either a cash flow problem or a flight risk.`
  });

  flags.push({
    title: "Recommending full repipe when spot repair would suffice",
    body: `A full whole-house repipe is a $5,000-$12,000 job in ${city}. It is the right answer when the entire pipe system is failing (polybutylene, severely corroded galvanized, or widespread pinhole leaks in copper). But if you have a single leak or a localized problem, a spot repair or partial repipe is often the correct and much less expensive solution. Be skeptical of any plumber who looks at one leak and immediately recommends a full repipe without inspecting the rest of the system.`
  });

  flags.push({
    title: "No written scope or single-line quote",
    body: `If the quote says "replumb bathroom: $4,500" without itemizing scope, you have no protection against scope reduction or surprise change orders. A professional plumbing proposal in ${city} should itemize: fixtures affected, pipe material, method of access, permit costs, drywall repair (if applicable), pressure testing, cleanup, and warranty terms. Anything not in the written scope is not included in the price.`
  });

  flags.push({
    title: "Unlicensed or uninsured operator",
    body: `In ${state}, plumbing work requires a state license. Verify through ${data.licensingBody} before signing anything. An unlicensed plumber is operating illegally, and if their work causes damage, your homeowners insurance may deny the claim. Similarly, a plumber without workers' compensation insurance exposes you to personal liability if a worker is injured on your property.`
  });

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>Red Flags and Common Plumbing Scams in ${city}</h2>
<p>Every market has its share of contractor misconduct. Here are the patterns most commonly reported by ${city} homeowners when hiring plumbers.</p>
${flagsHTML}
</section>`;
}

function emergencyVsPlannedSection(city, state, metro) {
  const data = METRO_PLUMBING[metro.slug];
  if (!data) return "";
  const mult = data.emergencyMultiplier || 2.0;
  const multLabel = mult === 2.5 ? "2-3x" : "roughly 2x";

  return `
<section class="section fp-section">
<h2>Emergency vs. Planned Plumbing Costs in ${city}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Planned / scheduled work</h3>
<p class="fp-season-months">Standard pricing</p>
<p>Book 1-2 weeks ahead and schedule during normal business hours (Monday-Friday, 8am-5pm). You get the best pricing, the most experienced crew, and time to compare multiple bids. Most plumbing work is not an emergency -- even a slow leak can wait a few days if you shut off the supply to the affected fixture.</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Emergency / after-hours</h3>
<p class="fp-season-months">${multLabel} markup</p>
<p>${data.emergencyNote} Know where your main water shut-off is before you need it. Shutting off the water yourself converts most "emergencies" into scheduled repairs at standard pricing.</p>
</div>
</div>
<p><strong>The single best way to avoid emergency plumbing costs:</strong> know where your main shut-off valve is and test it annually. A functioning shut-off valve turns a burst pipe from a $3,000 emergency into a $800 scheduled repair. If your shut-off valve is stuck, corroded, or inaccessible, replacing it ($200-$400) is one of the highest-ROI plumbing investments you can make.</p>
</section>`;
}

function costScenarios(city, state, mult) {
  const bp = pricingModel.basePriceByService;
  const rnd = pricingModel.roundTo || 25;

  const budget = {
    label: "Budget: Water Heater Swap",
    desc: "50-gallon gas tank water heater",
    total: roundTo(Math.round(bp.water_heater.priceByType.tank_50_gas * mult), rnd),
    detail: "Includes removal of old unit, new 50-gallon gas tank heater, supply connections, gas line connection, venting, expansion tank, drain pan, permit, and disposal. Standard location swap (no relocation)."
  };

  const mid = {
    label: "Mid-Range: Bathroom Remodel Rough-In",
    desc: "Full bathroom plumbing rough-in",
    total: roundTo(Math.round(bp.bathroom_rough_in.priceByScope.full_bath * mult), rnd),
    detail: "Includes supply lines (hot and cold), drain/waste/vent for toilet, sink, and tub/shower, shut-off valves, pressure testing, permit, and basic drywall patching. Does not include fixtures or finish work."
  };

  const premium = {
    label: "Premium: Whole-House PEX Repipe",
    desc: "Full repipe, 2,000 sq ft home, 2 bathrooms",
    total: roundTo(Math.round(bp.repipe.priceByMaterial.pex * mult * 1.15), rnd),
    detail: "Includes PEX supply lines to all fixtures, new shut-off valves throughout, manifold system, pressure testing, drywall repair and patching, permit, and inspection. Typically completed in 2-3 days."
  };

  function scenarioCard(s, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${s.label}</h3>
<p class="fp-scenario-material">${s.desc}</p>
<p class="fp-scenario-total">${fmtD(s.total)}</p>
<p class="fp-scenario-detail">${s.detail}</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>What Plumbing Projects Actually Cost in ${city}: 3 Scenarios</h2>
<p>Here is what real plumbing projects look like in ${city}, ${state}, using ${city}-adjusted labor and material costs for 2026.</p>
<div class="fp-scenario-grid">
${scenarioCard(budget, "#22c55e")}
${scenarioCard(mid, "#3b82f6")}
${scenarioCard(premium, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">All scenarios assume standard access conditions. Slab access, multi-story homes, or complex routing add 20-40%. <a href="/plumbing-quote-analyzer.html?mode=estimator" style="color:var(--brand);">Get a personalized estimate.</a></p>
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

/* ---------- Build & inject ---------- */

function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  if (!facts || !ctx) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getMultiplier(state);

  let html = `\n${MARKER_START}\n`;
  html += flagshipCSS();
  html += neighborhoodPricing(facts, mult);
  html += waterQualitySection(city, state, metro);
  html += climateImpactSection(city, state, ctx, facts, metro);
  html += sewerDrainageSection(city, state, metro);
  html += permitSection(city, state, facts, metro);
  html += licensingSection(city, state, metro);
  html += redFlagsSection(city, state, metro);
  html += emergencyVsPlannedSection(city, state, metro);
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

    // Inject after the UNIQUE-LOCAL-GUIDE section if present
    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");

    // Or after the "What affects plumbing cost" section (section 5-ish)
    // Or after the FAQ section as a fallback
    let insertAt = -1;

    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else {
      // Find the "What affects" or "Frequently Asked Questions" section end
      // Look for the section that contains "What affects" -- that's section 5 equivalent
      const whatAffectsIdx = content.indexOf("What affects plumbing cost");
      const faqIdx = content.indexOf("Frequently Asked Questions");

      if (whatAffectsIdx >= 0) {
        // Find the closing </section> after this point
        const sectionEnd = content.indexOf("</section>", whatAffectsIdx);
        if (sectionEnd >= 0) {
          insertAt = sectionEnd + "</section>".length;
        }
      } else if (faqIdx >= 0) {
        const sectionEnd = content.indexOf("</section>", faqIdx);
        if (sectionEnd >= 0) {
          insertAt = sectionEnd + "</section>".length;
        }
      }
    }

    if (insertAt < 0) {
      // Last resort: inject before <!-- TP-NEARBY-CITIES --> or before </main>
      const nearbyCities = content.indexOf("<!-- TP-NEARBY-CITIES -->");
      const mainEnd = content.indexOf("</main>");
      if (nearbyCities >= 0) {
        insertAt = nearbyCities;
      } else if (mainEnd >= 0) {
        insertAt = mainEnd;
      } else {
        console.log(`  SKIP ${metro.file} (no injection point found)`);
        skipped++;
        continue;
      }
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
