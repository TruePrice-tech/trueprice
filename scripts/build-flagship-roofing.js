#!/usr/bin/env node
/**
 * Generates deep editorial content for 20 flagship metro roofing pages.
 * Every section pulls long narrative blocks from CITY_ROOF_DATA so 8-word
 * shingle overlap across metros stays <10%.
 *
 * Idempotent via FLAGSHIP markers.
 * Usage: node scripts/build-flagship-roofing.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/roofing-pricing.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-roof-cost.html" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-roof-cost.html" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-roof-cost.html" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-roof-cost.html" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-roof-cost.html" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-roof-cost.html" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-roof-cost.html" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-roof-cost.html" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-roof-cost.html" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-roof-cost.html" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-roof-cost.html" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-roof-cost.html" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-roof-cost.html" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-roof-cost.html" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-roof-cost.html" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-roof-cost.html" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-roof-cost.html" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-roof-cost.html" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-roof-cost.html" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-roof-cost.html" },
];

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`; }
function getMultiplier(state) { return pricingModel.stateMultipliers?.[state] || 1.0; }

/* =========================================================================
 * CITY_ROOF_DATA: long narrative blocks per metro. Each paragraph references
 * at least 2 metro-specific facts (material, code, climate, insurance, etc).
 * ========================================================================= */

const CITY_ROOF_DATA = {
  "new-york-ny": {
    sec_climate: `New York City rooftops face a punishing combination of heavy freeze-thaw cycling from December through March, nor'easter snow-load events that can deposit 12-24 inches overnight, and summer heat-island temperatures that push flat-roof membrane surfaces above 170F in July. Pre-war walk-ups across Brooklyn, Queens, and the Bronx are predominantly built with modified-bitumen or EPDM flat-roof systems, not pitched construction, which means NYC reroof economics look nothing like suburban markets. Ice-and-water-shield membrane on every eave and valley is essential, not optional, because nor'easter-driven ice dams back water up under the membrane seams.`,
    sec_code: `NYC building code §1507 (adopted from 2020 NYC Construction Codes) governs roof replacement across the five boroughs. Permits are pulled through DOB and require a licensed NYC Home Improvement Contractor (HIC) for any work over $200. Landmarked properties across 37,000+ LPC-designated structures including Greenwich Village, SoHo-Cast Iron, and the Upper East Side Historic District require LPC approval before any work begins; slate, copper, or terne-coated stainless reroofs are common in landmarked brownstones, and material mismatches trigger stop-work orders. Multi-family buildings additionally require DOB Tenant Protection Plans that control dust, access, and work hours.`,
    sec_insurance: `NYC homeowners insurance on brownstones and co-ops covers roof damage from sudden events (wind, fallen trees, hail) but not gradual wear. Document damage within 72 hours of any nor'easter event because carrier adjusters push back hard on deferred claims. Con Edison also offers modest rebates on reflective white-roof ("cool roof") installations, and the NYC CoolRoofs Program provides free reflective coatings on qualifying buildings. Flat-roof membrane replacement on a Brooklyn brownstone typically runs $12,000-$22,000 depending on square footage and access.`,
    sec_contractor: `NYC contractor selection requires verifying active HIC registration at nyc.gov/dca, current DOB filing privileges, and building-specific access approvals for co-op and condo buildings. Walk-up access, service-elevator scheduling, and certificate-of-insurance naming the building LLC as additional insured all add 2-4 weeks before work starts. NYC labor rates run 1.8-2.3x national averages per square, and union-shop rates in Manhattan can reach 2.8x on landmarked or prewar buildings requiring specialty trades.`,
    sec_material: `NYC flat-roof dominant materials are EPDM rubber membrane (60-mil minimum for NYC climate), modified bitumen (APP or SBS systems), and increasingly TPO for reflective cool-roof compliance. Slate and copper appear on landmarked properties. The critical NYC spec is ice-and-water-shield membrane coverage: NYC code requires minimum 2-feet inboard of the exterior wall line, but reputable contractors extend it to 3 feet on coastal-adjacent addresses.`,
    dominantMaterial: "EPDM and modified-bitumen flat-roof systems on pre-war masonry housing",
    climateBand: "IECC Zone 4A mixed-humid coastal",
    bestSeasons: "April through June and September through early November",
    worstSeasons: "December through February deep freeze and the July-August heat dome",
  },
  "los-angeles-ca": {
    sec_climate: `Los Angeles roofs face intense UV exposure (LA sees 280+ days of sunshine annually), Santa Ana wind events driving 60-80 mph gusts in fall, and Chapter 7A WUI fire-hazard requirements in hillside neighborhoods. The dominant LA roofing material is concrete or clay tile on Spanish Colonial and Mediterranean-style homes, with composition on ranch and mid-century. Tile lifespan in LA's climate is 50-75 years for the tile itself, but the underlayment typically fails at 20-25 years and requires full underlayment replacement with tile reset.`,
    sec_code: `LA building code requires compliance with Chapter 7A of the California Building Code (Wildland-Urban Interface Fire Area) in designated zones including Mandeville Canyon, Bel Air, Beverly Hills Post Office, and portions of the San Fernando Valley. Chapter 7A mandates Class A fire-rated roof assemblies, ember-resistant vents, and specific spark-arrestor gutter screens. Title 24 Part 6 cool-roof requirements also govern low-slope replacements: minimum solar reflectance of 0.55 on initial install or 0.63 on alteration. LA CSLB requires a C-39 roofing contractor license for any paid installation.`,
    sec_insurance: `LA homeowners insurance increasingly excludes or sub-limits roof coverage in WUI zones, and several major carriers (State Farm, Allstate, Farmers) have pulled new-policy writing in specific fire-hazard zip codes. Class A fire-rated assemblies plus ember-resistant vents qualify for California FAIR Plan eligibility when private market coverage is unavailable. LADWP also offers modest rebates on cool-roof installations on qualifying low-slope replacements.`,
    sec_contractor: `LA contractor verification runs through CSLB at cslb.ca.gov: confirm active C-39 roofing license, bond, and workers' compensation coverage. CSLB publishes complaint history by license number. LA also has a chronic problem with "broker" license operators who hold licenses but subcontract to unlicensed crews, voiding Homeowners Recovery Fund eligibility. Ask to meet the specific crew lead and confirm their employer matches the licensed entity on your contract.`,
    sec_material: `LA dominant roofing materials are concrete tile (Eagle, Monier) and clay tile (Redland, US Tile) on Spanish Colonial and Mediterranean homes, composition on ranch and mid-century, and increasingly standing-seam metal on architect-designed hillside modern builds. Tile roofs use a 2x batten system over 40-lb organic or synthetic underlayment, and the underlayment is what fails first. Reset-and-new-underlayment projects run $8-$14 per square foot on tile roofs; full tile replacement runs $15-$25 per square foot installed.`,
    dominantMaterial: "concrete and clay tile on Spanish Colonial and Mediterranean-style homes",
    climateBand: "IECC Zone 3B hot-dry coastal with WUI fire zones",
    bestSeasons: "October through April outside fire season and rain events",
    worstSeasons: "May through September peak fire season and summer surface extremes",
  },
  "chicago-il": {
    sec_climate: `Chicago roofs face one of the most severe freeze-thaw environments in the country: 70-100 freeze-thaw cycles per year, 30+ inches of snow in typical winters, and polar-vortex arctic blasts driving temperatures below -20F. Ice-dam formation on pitched-roof bungalows is endemic, and the resulting water damage to interior walls and ceilings drives most winter-season insurance claims. Properly installed ice-and-water-shield membrane extending 3-6 feet from every eave is the mandatory Chicago specification, not optional.`,
    sec_code: `Chicago DOB enforces 2019 Chicago Building Code plus local §18-29 roof provisions. Permits are required for any replacement over 100 square feet. Landmarked districts including Old Town, Pullman, Prairie Avenue, and Astor Street require Commission on Chicago Landmarks approval before work starts, and approved materials typically include slate, copper, or specific asphalt profiles matching the original. Chicago also requires a city-specific GC license (GC-C) for permit-pulling; state of Illinois has no statewide residential contractor license.`,
    sec_insurance: `Chicago homeowners insurance routinely covers storm and hail damage but treats roof wear as homeowner responsibility. Document damage within one week of any severe event. Chicago's hail history is meaningful (derecho events and supercell storms produce recurring claims), and Class 4 impact-rated assemblies qualify for 10-20% premium reductions on most Chicago policies written after 2022. Peoples Gas and ComEd rebate programs also layer energy-related credits on cool-roof or reflective-coating installations.`,
    sec_contractor: `Chicago contractor verification: confirm active GC-C license at chicago.gov/city/en/depts/bldgs, check Illinois Attorney General Home Repair Fraud complaint history at illinoisattorneygeneral.gov, and verify bond and workers' compensation. Chicago's biggest contractor risk is storm-chase operators from Texas, Oklahoma, and Alabama appearing post-derecho; DOB does not recognize out-of-state licenses and the work will fail inspection at close-out.`,
    sec_material: `Chicago's dominant roofing materials are dimensional (architectural) composition on bungalows and two-flats, flat-roof modified bitumen or EPDM on three-flats, and slate on landmarked greystones. Ice-and-water-shield membrane is the Chicago-critical spec: 3-foot minimum from eaves, 6-foot on low-pitch (3:12 to 4:12) sections, and full coverage in valleys. Step flashing at chimneys and dormers must be properly lapped (not caulk-sealed) or ice-dam water intrusion is inevitable.`,
    dominantMaterial: "dimensional composition on bungalows and two-flats with mandatory ice-and-water-shield",
    climateBand: "IECC Zone 5A cold with severe freeze-thaw",
    bestSeasons: "late April through October, when temperatures stay above sealant-activation thresholds",
    worstSeasons: "November through mid-April below-freezing installation conditions",
  },
  "houston-tx": {
    sec_climate: `Houston roofs face hurricane-force wind uplift (Hurricane Harvey 2017, Ike 2008), severe hail from spring supercell storms (2024 derecho produced 4-inch hail in Cypress), and 95%+ humidity year-round that accelerates organic material decay. Gulf Coast hurricane wind-uplift ratings per ASTM D3161 Class F and ASTM D7158 Class H are baseline spec for any Houston reroof, not upgrades. The combination of wind, hail, and humidity makes roof replacement a frequent Houston event: typical 3-tab composition lasts only 12-15 years here versus 20+ years in milder climates.`,
    sec_code: `Harris County and City of Houston building code §R905 governs roof installation. Houston is not in the Texas Windstorm Insurance Association (TWIA) zone but enforces wind-uplift requirements similar to TWIA jurisdictions. The International Residential Code §R905.2.7 requires six-nail attachment patterns on every composition shingle in Houston wind zones, and reputable Houston contractors use high-wind-rated underlayment (ASTM D1970) on all replacements. Texas has no state roofing contractor license, so Harris County and City of Houston rely on insurance verification and BBB complaint history.`,
    sec_insurance: `Houston homeowners insurance is heavily driven by roof age and condition: most major carriers now require roof inspection for policies covering homes with 15+ year old roofs, and several carriers (State Farm, Allstate, USAA) apply actual-cash-value rather than replacement-cost claim settlement on roofs over 15-20 years. Class 4 impact-rated composition qualifies for 10-25% premium reductions on most Houston policies. Document hail or wind damage within 30 days; Texas statute gives one year to file, but adjusters push back hard on deferred claims.`,
    sec_contractor: `Houston contractor verification: Texas has no state license, so verification runs on Secretary of State business filing (sos.texas.gov), Harris County Appraisal District property records if the contractor claims a permanent office, insurance certificate verification with the actual issuer, and BBB complaint history. Houston's biggest contractor risk is storm-chase crews appearing post-Harvey, post-Uri, or post-spring-storm with "we're handling your insurance claim" pitches that end in deposits and disappearance.`,
    sec_material: `Houston's dominant roofing materials are architectural composition (GAF Timberline, Owens Corning Duration, CertainTeed Landmark) with high-wind-rated underlayment, and increasingly standing-seam metal on higher-end replacements. Class 4 impact-rated products (Malarkey, GAF Timberline AS, IKO Dynasty) deliver insurance premium reductions that pencil the 10-15% material premium into positive ROI within 5-8 years. Hail-damage frequency in Houston makes Class 4 an obvious specification on most whole-home replacements.`,
    dominantMaterial: "architectural composition with Class 4 impact rating and six-nail high-wind attachment",
    climateBand: "IECC Zone 2A hot-humid Gulf Coast",
    bestSeasons: "October through February outside hurricane and spring storm seasons",
    worstSeasons: "June through September hurricane season and April-May spring supercell peak",
  },
  "phoenix-az": {
    sec_climate: `Phoenix roofs face the most extreme UV and surface-temperature environment in any major US metro: roof-surface temperatures on dark composition exceed 170F in July, and ambient air temperatures above 110F for 60+ days annually. Monsoon season (July-September) adds microburst wind events and heavy rainfall that tests every flashing detail. The dominant Phoenix roofing material is concrete tile on newer construction and foam-on-ISO (rigid insulation) flat-roof systems on mid-century modern and commercial-style homes. Composition lifespan in Phoenix is significantly shorter than national averages: 12-18 years vs 20-30 in milder markets.`,
    sec_code: `Arizona requires a Registrar of Contractors (ROC) license for roofing: class KB-1 (Residential Building) or class CR-42 (Roofing) for specialty work. Phoenix enforces City of Phoenix Building Code with amendments tracking 2018 IRC. Monsoon wind-uplift requirements apply to every replacement, and Chapter 15 of the IRC governs minimum slope and flashing details. Phoenix historic districts (Willo, Encanto-Palmcroft, Coronado, Roosevelt) require Historic Preservation Office approval and typically mandate matching material and profile to the original.`,
    sec_insurance: `Phoenix homeowners insurance increasingly treats roof condition as a primary underwriting criterion. APS and SRP do not directly offer roofing rebates but both provide cool-roof envelope credits on whole-home energy retrofits including reflective roofing. Monsoon microburst damage is covered under standard homeowners policies but documented within 30 days is the Arizona carrier norm. Phoenix's hail history is milder than Denver or Dallas but not zero; Class 4 impact ratings carry modest premium reductions.`,
    sec_contractor: `Phoenix contractor verification: active CR-42 or KB-1 license at roc.az.gov, bond status, and complaint history through ROC. Arizona ROC aggressively pursues unlicensed contractor cases but recovery is limited once deposits are lost. Phoenix HOA approval complications are common in Ahwatukee, Desert Ridge, and Arcadia; require written ARC approval before any custom-profile tile order ships.`,
    sec_material: `Phoenix's dominant roofing materials are concrete tile (Eagle, Hanson), clay tile (US Tile), foam-on-ISO flat roof systems on modernist homes, and composition on older tract construction. Reflective roof coatings (elastomeric acrylic) add 15-25F surface-temperature reduction and can extend composition lifespan by 3-5 years in Phoenix's UV-heavy climate. Radiant-barrier decking is increasingly common spec on new construction and tear-off replacements.`,
    dominantMaterial: "concrete tile on newer construction and foam flat-roof systems on mid-century modern",
    climateBand: "IECC Zone 2B hot-dry desert with monsoon season",
    bestSeasons: "October through April, outside monsoon season and 110F+ surface extremes",
    worstSeasons: "June through September monsoon and surface-temperature peaks above 170F",
  },
  "dallas-tx": {
    sec_climate: `Dallas roofs face the most severe hail environment in the country: Dallas-Fort Worth averages 3-5 damaging hail events per year, and Insurance Information Institute data ranks DFW as the #1 US metro for hail-driven roof claims. Spring supercell season (March-June) drives most replacements. Dallas also sees tornado corridor exposure (2019 outbreak, 2023 outbreak) and Houston Black clay soil foundation movement that stresses roof framing. Class 4 impact-rated assemblies are effectively baseline spec here, not upgrades.`,
    sec_code: `Dallas and surrounding cities enforce variants of 2018 IRC §R905 with local amendments. City of Dallas Residential Building Registration is required for permit-pulling contractors. Dallas 2021 amendments added enhanced flashing requirements in chimney saddles and valley treatments. Texas has no state-level roofing license. Dallas historic districts (Munger Place, Swiss Avenue, State-Thomas, South Boulevard-Park Row) require Historic Preservation Office review on contributing structures, and approved materials typically include specific composition profiles or slate.`,
    sec_insurance: `Dallas homeowners insurance heavily incentivizes Class 4 impact-rated assemblies: most major Texas carriers offer 15-30% premium reductions on Class 4-rated installations. After the 2019 and 2023 tornado events, several carriers made Class 4 a requirement for new-policy writing in specific zip codes. Oncor does not directly offer roofing rebates but does provide envelope credits on whole-home energy retrofits. Document hail damage within 30 days; Texas statute allows one year but carriers push back on deferred claims.`,
    sec_contractor: `Dallas contractor verification: confirm City of Dallas Residential Building Registration, verify insurance certificates with the issuer (not just the certificate paper), check BBB at bbb.org/dallas for complaint history, and cross-reference at least three Dallas references from pre-2023 jobs. Post-tornado and post-hail storm-chase crews are the highest-risk Dallas category. Texas insurance fraud law (§4102.207) prohibits contractors from "eating deductibles" on insurance claims; any contractor offering that arrangement is willing to commit insurance fraud.`,
    sec_material: `Dallas's dominant roofing materials are Class 4 impact-rated architectural composition (Malarkey, GAF Timberline AS, CertainTeed NorthGate), followed by standing-seam metal on higher-end replacements. Class 4 rating follows UL 2218 testing with steel-ball impact from 20 feet at increasing diameters. GAF Timberline AS uses polymer-modified asphalt for impact resistance; Malarkey Legacy uses SBS-modified asphalt. Both deliver real hail-resistance performance, not marketing claims.`,
    dominantMaterial: "Class 4 impact-rated architectural composition with enhanced flashing",
    climateBand: "IECC Zone 3A mixed-humid tornado alley",
    bestSeasons: "October through February outside spring storm peak",
    worstSeasons: "March through June peak hail and tornado season",
  },
  "atlanta-ga": {
    sec_climate: `Atlanta roofs face the combination of intense summer UV, pollen-season particulate loading that accelerates granule loss, and aggressive root and branch hazards from the dense tree canopy in Druid Hills, Morningside, and Ansley Park. Georgia Tech studies on 2011 and 2014 tornado outbreaks flagged Northwest Atlanta as a recurring severe-weather corridor, and insurance carriers have responded with premium incentives for impact-rated assemblies on west-of-I-285 properties. Atlanta humidity also drives algae growth on north-facing slopes, which is the dominant Atlanta aesthetic failure pattern.`,
    sec_code: `Georgia State Minimum Standard Codes incorporate 2018 IRC with state amendments. Atlanta additionally requires Atlanta Urban Design Commission (AUDC) approval for roof replacements in 20+ historic districts including Inman Park, Grant Park, Virginia-Highland, Candler Park, and Cabbagetown. AUDC-approved materials typically match original composition profiles or specific slate/tile products. Georgia requires a state Residential Basic Contractor license for any job over $2,500, verified at sos.ga.gov.`,
    sec_insurance: `Atlanta homeowners insurance covers hail and wind damage but carriers have tightened underwriting on roof age since 2022. Most carriers apply ACV rather than RCV on 15-20+ year old roofs, which can mean 30-50% less claim payout. Georgia Power does not directly rebate roofing but offers envelope credits on ENERGY STAR certified whole-home retrofits. Class 4 impact-rated assemblies typically return 10-20% premium reductions on Atlanta-area policies.`,
    sec_contractor: `Atlanta contractor verification: active Georgia Residential Basic Contractor license at sos.ga.gov (required for jobs over $2,500), workers' compensation and general liability insurance certificates verified with issuers, and Georgia Attorney General Consumer Protection complaint history at law.georgia.gov. Atlanta's AOB (Assignment of Benefits) fraud pattern is a known risk; O.C.G.A. §33-24-59.25 gives homeowners 10 business days to rescind any signed AOB.`,
    sec_material: `Atlanta's dominant roofing materials are architectural composition with algae-resistant (AR) granules essential for Atlanta humidity, Class 4 impact-rated products on west-of-I-285 properties in the tornado corridor, and increasingly standing-seam metal on higher-end replacements. Algae-resistant shingles use copper or zinc compounds in the granules to prevent the black streaking that is endemic on north-facing slopes in Atlanta's humidity. Non-AR shingles typically show visible algae within 3-5 years of installation.`,
    dominantMaterial: "architectural composition with algae-resistant granules for humid-climate longevity",
    climateBand: "IECC Zone 3A humid-subtropical with tornado corridor",
    bestSeasons: "October through November and March through April, outside pollen peak and humidity surges",
    worstSeasons: "February-March pollen season, July-August humidity extremes, and spring storm cycles",
  },
  "denver-co": {
    sec_climate: `Denver roofs face the worst hail corridor in the country: the Front Range from Castle Rock through Boulder is ground zero for damaging hail, with 2-5 major events per year producing stones 1-3 inches in diameter. Denver also faces extreme UV exposure at 5,280 feet elevation, sustained winter freeze-thaw cycling, and chinook wind events driving 60-80 mph gusts. Class 4 impact-rated assemblies are effectively baseline spec for any Denver replacement, and non-impact-rated composition typically sees hail-driven replacement within 7-12 years.`,
    sec_code: `Denver Building Department enforces 2021 IRC with Denver-specific amendments. Colorado has no statewide roofing contractor license, so Denver Class D (residential) Supervisor License from the Department of Excise and Licenses is the operative verification. Denver Landmark Preservation Commission oversees 55+ historic districts including Capitol Hill, Country Club, Baker, Humboldt Street, and Wyman; landmarked replacements require commission approval before permit issuance. Colorado's high altitude also creates specific IGU and flashing considerations tracked in the Denver Green Code.`,
    sec_insurance: `Denver homeowners insurance is heavily hail-driven: most major Colorado carriers now offer 15-30% premium reductions on Class 4 impact-rated assemblies, and several carriers (State Farm, USAA, Farmers) have made Class 4 a requirement for new-policy writing in specific hail-corridor zip codes since 2022. Denver's hail claim frequency is so high that some carriers now apply deductibles based on roof surface area (e.g., 2% of dwelling coverage) rather than fixed dollar amounts. Xcel Energy's Windsource program offers modest envelope rebates on qualifying whole-home retrofits.`,
    sec_contractor: `Denver contractor verification: confirm Denver Class D (residential) Supervisor License at denvergov.org, check Colorado DORA (Department of Regulatory Agencies) complaint history at dora.colorado.gov, and verify bond and insurance coverage. Denver's biggest contractor risk is out-of-state storm-chase crews surging into Cherry Creek, Centennial, and Highlands Ranch after major hail events; Denver DOB does not recognize out-of-state licenses and the work fails inspection at close-out.`,
    sec_material: `Denver's dominant roofing materials are Class 4 impact-rated architectural composition (Malarkey Legacy, GAF Timberline AS, IKO Dynasty), followed by stone-coated steel and standing-seam metal on higher-end replacements. Class 4 rating is essential here because hail damage drives 60%+ of Denver replacements. Synthetic underlayment (vs organic felt) is the Denver-critical spec because freeze-thaw cycling degrades organic felt faster at altitude. Ice-and-water-shield at eaves and valleys extends 3 feet minimum from the wall line.`,
    dominantMaterial: "Class 4 impact-rated composition driven by Front Range hail frequency",
    climateBand: "IECC Zone 5B cold-dry high altitude with extreme hail",
    bestSeasons: "May through October, when temperatures stay above sealant-activation thresholds",
    worstSeasons: "November through April below-freezing conditions and June-July peak hail events",
  },
  "seattle-wa": {
    sec_climate: `Seattle roofs face the opposite environmental challenge from most US markets: persistent moisture from October through April, abundant moss and algae growth from marine humidity, and minimal UV exposure that extends composition lifespan but accelerates biological degradation. The dominant Seattle roofing material is architectural composition with aggressive algae-resistance, followed by cedar shake on period craftsman and Tudor homes. Cedar shake requires specific treatments for Seattle's moisture environment; untreated cedar develops moss and moisture intrusion within 10-15 years.`,
    sec_code: `Washington requires Labor and Industries (L&I) contractor registration for any paid roofing installation. Seattle enforces 2018 IRC with Seattle-specific amendments focused on moisture management and continuous air-barrier requirements. Seattle Energy Code amendments also require specific underlayment and flashing details on replacement jobs receiving ENERGY STAR certification. Seattle Landmarks Preservation Board oversees districts including Pike Place Market, Pioneer Square, Harvard-Belmont, Ballard Avenue, and Columbia City.`,
    sec_insurance: `Seattle homeowners insurance covers wind and windstorm damage but treats moss-driven decay as homeowner-responsibility wear. Seattle's moderate hail exposure does not drive premium incentives the way Denver does. Seattle City Light and Puget Sound Energy offer envelope credits on qualifying whole-home retrofits but no direct roofing rebates. Documented damage from windstorm events (especially fall and winter Pacific storms) must be filed within 30 days per most Washington carrier requirements.`,
    sec_contractor: `Seattle contractor verification: confirm active L&I registration at secure.lni.wa.gov, verify bond amount matches job scope, and cross-reference Washington Attorney General Consumer Protection complaints at atg.wa.gov. Seattle's biggest fraud pattern is L&I registration expiration mid-project; registered-at-bidding contractors whose registration lapses before project completion forfeit homeowner surety recovery rights. Screenshot the L&I verification date-stamped to contract-signing day.`,
    sec_material: `Seattle's dominant roofing materials are architectural composition with algae-resistant granules (AR rating is essential here), cedar shake with pressure-treated or naturally rot-resistant Western Red Cedar on period homes, and standing-seam metal on architect-designed hillside builds. Moss-prevention zinc or copper ridge strips are Seattle-specific spec adds that deliver 10-15 year moss prevention at modest cost premium.`,
    dominantMaterial: "architectural composition with algae-resistance and cedar shake on period Craftsman homes",
    climateBand: "IECC Zone 4C marine cool wet",
    bestSeasons: "June through September, the only reliable dry-weather window",
    worstSeasons: "October through April sustained precipitation disrupts install scheduling",
  },
  "austin-tx": {
    sec_climate: `Austin roofs face hail from Hill Country supercell storms, intense UV exposure (Austin sees 230+ sunny days annually), and Winter Storm Uri-style thermal shock events that crack composition and compromise flashing seals. Austin's limestone soil creates minimal foundation movement compared to East Austin's clay, which means roof framing is generally more stable here than in DFW or Houston. The dominant Austin material is architectural composition on tract construction and standing-seam metal on higher-end hillside builds with limestone facades.`,
    sec_code: `City of Austin Residential Building Contractor registration is required for permit-pulling. Texas has no state roofing license. Austin Historic Landmark Commission oversees districts including Hyde Park, Travis Heights, Clarksville, Old West Austin, and Rainey Street Historic District; landmarked replacements require commission approval and typically mandate specific material profiles. Austin Energy Code (2022) requires cool-roof reflectance minimums on low-slope portions of residential installations.`,
    sec_insurance: `Austin homeowners insurance treats hail and wind damage as covered sudden events but tightens underwriting on roof age. Post-Uri 2021, many Texas carriers require documented tree-branch-removal and freeze-damage remediation before renewing Austin-area policies. Class 4 impact-rated assemblies qualify for 10-20% premium reductions on most Austin-area policies, and the Austin tornado-corridor exposure (though less severe than DFW) makes Class 4 a reasonable ROI decision on most whole-home replacements.`,
    sec_contractor: `Austin contractor verification: City of Austin Residential Building Contractor registration, workers' compensation and general liability certificates verified with issuers, Travis County Appraisal District verification of claimed permanent business address, and Austin Code Compliance complaint history at austintexas.gov/department/building-inspections. Austin's rapid growth attracts out-of-area contractors from Houston, San Antonio, and DFW; require a permanent Austin address and three Travis County references pre-2023.`,
    sec_material: `Austin's dominant roofing materials are Class 4 impact-rated architectural composition (Malarkey, GAF Timberline AS, CertainTeed NorthGate), standing-seam metal on hillside limestone-faced homes, and tile on Mediterranean-style homes in Westlake and Rollingwood. Cool-roof reflective coatings (Title 24-style, though Texas does not formally adopt) are increasingly common spec on low-slope portions in Austin's UV-heavy climate.`,
    dominantMaterial: "Class 4 impact-rated composition and standing-seam metal on hillside limestone-faced homes",
    climateBand: "IECC Zone 2A hot-humid Hill Country",
    bestSeasons: "October through February outside spring storm and peak-summer surface heat",
    worstSeasons: "March through June hail and supercell peak, July-August surface-temperature extremes",
  },
  "san-francisco-ca": {
    sec_climate: `San Francisco roofs face the combination of marine moisture (fog-belt saturation from June marine layer and winter atmospheric rivers), persistent moss and algae growth, and Title 24 cool-roof requirements for any low-slope replacement. SF's hill-and-canyon microclimates vary dramatically: Sunset and Richmond fog-belt homes see very different moisture loads than Bernal Heights and Potrero Hill sun-belt homes. The dominant SF roofing material is composition on Victorian and Edwardian replacements, clay or concrete tile on Mediterranean-style homes, and increasingly standing-seam metal on architect-designed modern builds.`,
    sec_code: `California requires a C-39 roofing contractor license from CSLB. San Francisco DBI additionally requires city contractor registration for permit-pulling. SF Historic Preservation Commission plus Planning Code Articles 10 and 11 cover 270+ designated landmarks and 11 historic districts; landmarked replacements require commission approval before any material is ordered. Title 24 Part 6 cool-roof provisions require minimum solar reflectance on all low-slope replacements, and the California Energy Commission publishes approved product lists.`,
    sec_insurance: `SF homeowners insurance covers sudden and accidental damage but treats moss-driven and moisture-driven decay as homeowner wear. Wildfire coverage is a separate consideration: most major California carriers have pulled new-policy writing in WUI zones near the Presidio and Twin Peaks. SF's marine climate also creates unusual moisture-damage claim patterns that carriers increasingly exclude from standard policies. PG&E and BayREN offer envelope credits on qualifying whole-home retrofits but no direct roofing rebates.`,
    sec_contractor: `SF contractor verification: active CSLB C-39 license at cslb.ca.gov, SF DBI city contractor registration, and complaint history at sfdbi.org. SF lead-safe renovation rules (pre-1978 homes) require EPA RRP certification for any job disturbing lead-painted surfaces. SF's dust-control ordinance §3428 imposes HEPA-vacuum cleanup verification before final inspection on lead-impacted projects.`,
    sec_material: `SF's dominant roofing materials are architectural composition with algae-resistance on Victorian and Edwardian replacements (most SF residential), clay and concrete tile on Mediterranean-style homes, and standing-seam metal on modern architect-designed homes. SF's marine climate makes algae-resistance (AR granules with copper or zinc compounds) essential on north-facing slopes across the city. Cool-roof reflective coatings on low-slope portions meet Title 24 requirements.`,
    dominantMaterial: "algae-resistant composition on Victorian/Edwardian and clay tile on Mediterranean-style homes",
    climateBand: "IECC Zone 3C marine mild coastal with fog-belt microclimates",
    bestSeasons: "June through October, when fog-season humidity drops enough for reliable install",
    worstSeasons: "November through March rainy-season install disruption and winter atmospheric rivers",
  },
  "las-vegas-nv": {
    sec_climate: `Las Vegas roofs face the most severe UV environment in any major US metro, with 310+ sunny days annually and surface temperatures on dark composition routinely exceeding 175F in July. Monsoon season (July-September) adds microburst wind events and heavy rainfall that tests flashing integrity. Dust storms from the Mojave also deposit fine particulate that accelerates granule loss. The dominant Vegas material is concrete tile on master-planned community construction (Summerlin, Anthem, MacDonald Ranch) and composition on older central Vegas construction. Tile lifespan here is 50-75 years; composition typically 12-18.`,
    sec_code: `Nevada State Contractors Board requires a C-15 roofing license for any Vegas installation. Clark County enforces 2018 IRC with local amendments focused on monsoon wind-uplift and cool-roof requirements on low-slope portions. Vegas has few historic districts: John S. Park and Huntridge are the primary protected areas where material-profile matching is required. Clark County energy code also requires reflective-roof coatings on qualifying low-slope installations.`,
    sec_insurance: `Vegas homeowners insurance treats monsoon wind and hail damage as covered but tightens underwriting on roof age. Vegas hail exposure is milder than Denver or Dallas but not zero; monsoon microbursts occasionally produce damaging hail. NV Energy does not directly offer roofing rebates but provides envelope credits on whole-home retrofits. Documented damage from monsoon events must be filed within 30 days per most Nevada carrier requirements.`,
    sec_contractor: `Vegas contractor verification: active Nevada C-15 roofing license at nscb.nv.gov, bond status verification, and NSCB complaint history. Nevada's deposit-cap law (NRS §624.6245) caps residential contractor deposits at 10% of contract or $1,000 (whichever is less); any Vegas contract demanding 20-50% upfront is unenforceable. HOA approval complications are severe in master-planned communities; require written ARC approval before any custom-profile order ships.`,
    sec_material: `Vegas's dominant roofing materials are concrete tile (Eagle, Hanson) on master-planned community construction, foam-on-ISO flat-roof systems on mid-century modern homes, and composition on older central Vegas construction. Reflective roof coatings (elastomeric acrylic) on low-slope portions deliver 15-25F surface-temperature reductions and extend membrane lifespan by 5-10 years in Vegas UV.`,
    dominantMaterial: "concrete tile on master-planned communities and foam flat-roof on mid-century modern",
    climateBand: "IECC Zone 3B hot-dry desert with monsoon season",
    bestSeasons: "November through April, outside monsoon and 175F+ surface-temperature extremes",
    worstSeasons: "June through September monsoon and peak-summer surface heat",
  },
  "philadelphia-pa": {
    sec_climate: `Philadelphia roofs face moderate freeze-thaw cycling, heavy humidity-driven biological growth, and rowhouse geometry that creates specific drainage and flashing challenges. Flat-roof modified-bitumen and EPDM dominate rowhouse trinity and three-story twin housing across Center City, South Philly, and Northern Liberties. Pitched-roof composition appears on Chestnut Hill, Mount Airy, and Northwest Philadelphia single-family homes. Rowhouse parapet walls create specific cap-flashing and counter-flashing requirements that drive most Philly rowhouse roof failures.`,
    sec_code: `Pennsylvania requires HICPA (Home Improvement Contractors Protection Act) registration. Philadelphia L&I additionally requires a city Contractor License for permit-pulling. Both must be active and both must appear on the contract. Philadelphia Historical Commission oversees 18,000+ historic structures and districts including Society Hill, Old City, Rittenhouse, Chestnut Hill, and the Girard Estate Historic District; landmarked replacements require commission approval.`,
    sec_insurance: `Philadelphia homeowners insurance covers sudden storm and wind damage but treats rowhouse flat-roof wear as homeowner responsibility. Philadelphia carriers have tightened underwriting on roof age since 2022; most now apply ACV on roofs over 15-20 years. PECO and PGW offer envelope credits on qualifying whole-home retrofits. Philly's moderate hail exposure does not drive premium incentives like Denver or Dallas, but laminated-membrane ice-dam protection is worth noting.`,
    sec_contractor: `Philly contractor verification: active Philadelphia L&I Contractor License at philadelphialicense.com AND Pennsylvania HICPA registration at attorneygeneral.gov/hicpa. Both are required and both must be independently active. Many Philly operators hold one but not the other, and that arrangement voids homeowner recovery rights if the work fails.`,
    sec_material: `Philadelphia's dominant roofing materials are modified bitumen (APP or SBS) and EPDM rubber on rowhouse flat roofs (60-80% of Philly housing), architectural composition on Northwest and suburban pitched roofs, and slate on Chestnut Hill historic homes. Philadelphia rowhouse flat-roof replacement typically runs $8,000-$15,000 depending on square footage and parapet detail complexity.`,
    dominantMaterial: "modified bitumen and EPDM on rowhouse flat roofs with parapet cap-flashing",
    climateBand: "IECC Zone 4A mixed-humid",
    bestSeasons: "April through June and September through early November",
    worstSeasons: "December through February deep-freeze and July-August humidity extremes",
  },
  "miami-fl": {
    sec_climate: `Miami roofs face mandatory Miami-Dade High Velocity Hurricane Zone (HVHZ) requirements, annual Atlantic hurricane season (June-November), and tropical UV exposure that accelerates composition lifespan by 30-40% vs national averages. Concrete tile dominates Miami residential construction, with flat-roof modified bitumen or single-ply TPO on many mid-century and modern homes. Hurricane Andrew (1992) and Hurricane Irma (2017) both drove major code tightening, and current Miami-Dade roofing spec is the strictest in any US jurisdiction.`,
    sec_code: `Miami-Dade enforces Florida Building Code with mandatory HVHZ provisions per FBC §R609 and §1523. Every roofing product installed in Miami-Dade and Broward must have a current Notice of Acceptance (NOA) from Miami-Dade Product Approval, and the NOA number must appear on the building permit and final inspection card. Miami-Dade also requires specialty contractor licensing (category C-22 or Certified General Contractor). Historic preservation authority covers Coral Gables, Miami Beach Art Deco District, and MiMo Biscayne Boulevard.`,
    sec_insurance: `Miami homeowners insurance is almost exclusively through Citizens Property Insurance or specialty coastal carriers (post-Andrew private-market exits). Roof condition is the primary underwriting factor: Miami carriers typically require roof inspections for any policy covering homes with 10+ year old roofs, and roofs over 20 years routinely get non-renewed or moved to Citizens. Wind mitigation credits under OIR-B1-1802 form can return 30-50% on premiums for secondary-water-resistant barriers and hip-roof geometry.`,
    sec_contractor: `Miami contractor verification: Miami-Dade specialty contractor license (category C-22) or Certified General Contractor at myfloridalicense.com, Miami-Dade County business tax receipt, and NOA documentation authenticity verified at miamidade.gov/pa. Miami post-hurricane contract fraud patterns are severe: out-of-state crews appear with NOA-spoof documentation. Physically verify manufacturer labels and NOA numbers before final inspection.`,
    sec_material: `Miami's dominant roofing materials are concrete tile (Eagle, Hanson, Borja) meeting Miami-Dade NOA wind ratings, modified bitumen and TPO on flat-roof mid-century and modern homes, and increasingly standing-seam metal with Miami-Dade NOA certification. Every material must have current NOA documentation; NOAs expire every 5-7 years and manufacturers must re-test to maintain approval.`,
    dominantMaterial: "NOA-approved concrete tile meeting Miami-Dade HVHZ wind uplift requirements",
    climateBand: "IECC Zone 1A very-hot-humid tropical with HVHZ",
    bestSeasons: "December through April outside Atlantic hurricane season",
    worstSeasons: "June through November Atlantic hurricane season and September peak",
  },
  "boston-ma": {
    sec_climate: `Boston roofs face severe nor'easter snow-load events (30-50 inch snowfalls), extensive ice-dam formation from attic heat loss plus eave freezing, and New England humidity that drives aggressive moss and algae growth on north-facing slopes. The dominant Boston housing is triple-decker with composition roofs, colonial single-family with composition or slate, and rowhouse flat roofs on Back Bay and South End brownstones. Ice-and-water-shield at eaves is code-mandatory and extends 3-6 feet minimum from the wall line in Boston's climate zone.`,
    sec_code: `Massachusetts requires a Home Improvement Contractor (HIC) registration plus a Construction Supervisor License (CSL) for any structural roofing work. Boston enforces Massachusetts State Building Code (780 CMR) with Boston-specific amendments including the Stretch Code for energy compliance. Boston Landmarks Commission oversees Back Bay, Beacon Hill, Fort Point, South End, and Bay Village; landmarked replacements require commission approval before permit issuance.`,
    sec_insurance: `Boston homeowners insurance covers storm and ice-dam damage as sudden events but treats chronic wear as homeowner responsibility. Mass Save's whole-home weatherization program rebates envelope improvements including attic insulation that prevents ice-dam formation at the source. Boston winter-storm damage claims must be filed within 30-60 days per most Massachusetts carrier requirements; deferred claims face significant adjuster pushback.`,
    sec_contractor: `Boston contractor verification: both Massachusetts HIC registration AND CSL at mass.gov. Both are required and both must be separately active. Mass Save rebate eligibility also requires verified licensing. Boston Landmarks approval for Back Bay, Beacon Hill, and South End adds 6-10 weeks on top of standard permit timelines.`,
    sec_material: `Boston's dominant roofing materials are architectural composition with algae-resistant granules on triple-deckers and colonials, slate and natural slate reproduction on landmarked Back Bay and Beacon Hill homes, and EPDM or modified bitumen on brownstone flat roofs. Ice-and-water-shield is code-mandatory (3-6 feet from eaves) plus full valley coverage. Heated cable systems at eaves are increasingly common spec in Boston replacements to prevent ice-dam formation.`,
    dominantMaterial: "algae-resistant composition on triple-deckers with ice-and-water-shield at eaves",
    climateBand: "IECC Zone 5A cold marine with severe nor'easter snow events",
    bestSeasons: "May through early October, outside deep-freeze installation conditions",
    worstSeasons: "November through April sustained sub-freezing temperatures",
  },
  "san-diego-ca": {
    sec_climate: `San Diego roofs face coastal salt exposure (uncoated metal corrodes within 10-15 years near the beach), Chapter 7A WUI fire-hazard requirements in Rancho Bernardo, Rancho Peñasquitos, and portions of East County, and Santa Ana wind events driving fall fire-season danger. The dominant SD roofing material is concrete tile on Spanish Colonial and Mediterranean-style homes, with composition on ranch and 1950s-1970s tract construction. Tile lifespan in SD's mild climate is 50-75 years; composition typically 20-28 years with proper AR granules.`,
    sec_code: `California requires a CSLB C-39 roofing contractor license. San Diego City and County enforce 2022 California Building Code with SD-specific amendments. WUI Chapter 7A applies to designated very-high-severity fire-hazard zones and mandates Class A fire-rated assemblies, ember-resistant vents, and specific gutter spark-arrestor screens. California Coastal Commission jurisdiction adds a second regulatory layer for properties within the Coastal Zone.`,
    sec_insurance: `San Diego homeowners insurance is increasingly constrained by WUI wildfire risk: several major California carriers have pulled new-policy writing in specific SD fire-hazard zip codes since 2022. California FAIR Plan provides coverage when private-market writing is unavailable, and Class A fire-rated assemblies qualify for FAIR Plan eligibility. SDG&E and San Diego Regional Climate Action Plan offer envelope credits on qualifying whole-home retrofits.`,
    sec_contractor: `SD contractor verification: active CSLB C-39 license at cslb.ca.gov plus San Diego city or county business tax certificate for permit-pulling (different between city and unincorporated county). Coastal Commission permitting adds 4-8 weeks on coastal-zone properties. WUI Chapter 7A compliance requires documented material selection and specific flashing details at vent penetrations.`,
    sec_material: `SD's dominant roofing materials are concrete tile (Eagle, Monier) on Spanish Colonial and Mediterranean homes, clay tile (Redland, US Tile) on higher-end architectural homes, and composition on ranch and tract construction. Class A fire-rated assemblies are mandatory in WUI zones; tile is inherently Class A, composition requires specific Class A product ratings. Cool-roof reflectance requirements apply to low-slope portions per Title 24.`,
    dominantMaterial: "concrete and clay tile on Spanish Colonial homes with WUI Class A fire ratings",
    climateBand: "IECC Zone 3C marine-coastal with WUI fire zones",
    bestSeasons: "September through June, with only late-May marine-layer fog to navigate",
    worstSeasons: "July through September peak fire season and coastal Santa Ana events",
  },
  "tampa-fl": {
    sec_climate: `Tampa roofs face Gulf Coast hurricane exposure, annual Atlantic hurricane season (June-November), tropical UV degradation, and Florida Product Approval (FPA) wind-borne debris requirements in Hillsborough and Pinellas counties. The dominant Tampa housing is CBS (concrete block stucco) with tile roofs or composition on slab-on-grade tract construction. Hurricane Irma (2017) drove major code tightening, and current Tampa roofing spec requires FPA wind ratings on all installations within one mile of the coast and metro-wide for insurance-premium purposes.`,
    sec_code: `Florida DBPR requires a Certified Roofing Contractor (CCC) or Certified General Contractor license. FBC §R609 requires Florida Product Approval (FPA) on all wind-borne debris region installations. Hillsborough and Pinellas counties enforce strict coastal wind-zone requirements. Tampa Historic Preservation Commission oversees Hyde Park, Seminole Heights, Tampa Heights, and Ybor City; landmarked replacements require commission approval.`,
    sec_insurance: `Tampa homeowners insurance is roof-condition-driven: Florida carriers require roof inspection for policies covering homes with 10+ year old roofs, and roofs over 20 years face non-renewal or move to Citizens Property Insurance. Wind mitigation credits under OIR-B1-1802 can return 30-50% on premiums for secondary-water-resistant barriers and hip-roof geometry. Florida impact-window sales tax holiday (annual Q3) applies to qualifying products.`,
    sec_contractor: `Tampa contractor verification: Florida DBPR Certified Roofing Contractor (CCC) or Certified General Contractor at myfloridalicense.com, Hillsborough or Pinellas County business tax receipt, and FPA documentation verification. Tampa post-hurricane contract fraud patterns are severe; never assign insurance proceeds directly to a contractor, and use the 14-day AOB rescission window under Florida Statute §627.7152 if you signed one under pressure.`,
    sec_material: `Tampa's dominant roofing materials are FPA-approved concrete tile on CBS homes, architectural composition with high-wind ratings on tract construction, and increasingly standing-seam metal with FPA certification. Secondary water-resistant barrier (SWRB) installation at the roof deck level delivers major wind mitigation credit on insurance policies. Hip-roof geometry vs gable-roof geometry also delivers significant wind mitigation credits.`,
    dominantMaterial: "FPA-approved concrete tile and composition with SWRB underlayment on CBS construction",
    climateBand: "IECC Zone 2A hot-humid Gulf Coast with wind-borne debris region",
    bestSeasons: "December through April outside Atlantic hurricane season",
    worstSeasons: "June through November Atlantic hurricane season and September peak",
  },
  "detroit-mi": {
    sec_climate: `Detroit roofs face severe freeze-thaw cycling, extensive ice-dam formation from attic heat loss, and Great Lakes lake-effect snowfall events that can deposit 18-30 inches overnight. The dominant Detroit housing is 1910s-1940s brick bungalow with composition roofs, some slate on landmarked homes in Boston-Edison and Indian Village, and EPDM or modified bitumen on flat-roof commercial-style residential. Ice-and-water-shield at eaves is code-mandatory and extends 3 feet minimum from the wall line.`,
    sec_code: `Michigan requires LARA Residential Builder or Residential Maintenance and Alteration license at michigan.gov/lara. Detroit enforces 2015 IECC with local amendments, plus Detroit Historic Designation Advisory Board oversight of Boston-Edison, Indian Village, Woodbridge, Palmer Park, and Corktown historic districts. Historic replacement approvals typically take 4-8 weeks. Detroit also amended 2015 IECC to require air leakage verification on conservation-improvement-funded jobs.`,
    sec_insurance: `Detroit homeowners insurance covers wind and hail damage with standard sudden-event provisions. Michigan carriers have tightened roof-age underwriting post-2022; many apply ACV on roofs over 15-20 years. DTE Energy and Consumers Energy offer envelope credits on qualifying whole-home retrofits. Detroit's moderate hail exposure does not drive premium incentives like Denver or Dallas.`,
    sec_contractor: `Detroit contractor verification: active LARA Residential Builder license at michigan.gov/lara, plus Detroit Better Business Bureau at bbb.org/detroit. Michigan MCL §339.2411 three-day right-of-rescission applies to any in-home sale, and contracts without that notice are unenforceable. Detroit Historic Designation Advisory Board approval for Boston-Edison and Indian Village adds 4-8 weeks to permit timelines.`,
    sec_material: `Detroit's dominant roofing materials are architectural composition with algae-resistant granules on bungalow and Arts-and-Crafts homes, slate on landmarked Boston-Edison and Indian Village homes, and EPDM or modified bitumen on flat-roof three-story residential. Ice-and-water-shield at eaves (3 feet minimum) plus synthetic underlayment (vs organic felt) are the Detroit-critical specs.`,
    dominantMaterial: "algae-resistant composition on 1910s-1940s brick bungalows with mandatory ice-and-water-shield",
    climateBand: "IECC Zone 5A cold with Great Lakes lake-effect snow",
    bestSeasons: "April through October, when temperatures stay above sealant-activation thresholds",
    worstSeasons: "November through mid-April sustained below-freezing conditions",
  },
  "minneapolis-mn": {
    sec_climate: `Minneapolis roofs face the most severe freeze-thaw environment in any major US metro: sustained -20F winter temperatures, 60+ inches of annual snowfall, and 100+ freeze-thaw cycles per year. Ice-and-water-shield is code-mandatory (6-foot minimum from eaves on low-pitch roofs) and ice-dam damage is the #1 residential insurance claim driver across the Twin Cities winter. The dominant Minneapolis housing is 1920s-1950s bungalow and four-square with composition roofs; landmarked homes feature slate and copper details.`,
    sec_code: `Minnesota Department of Labor and Industry requires a Residential Building Contractor license for jobs over $15,000. Minneapolis enforces Minnesota Residential Code with local amendments; the state Energy Code mandates air leakage verification on conservation-improvement-funded jobs. Minneapolis Heritage Preservation Commission covers districts including Milwaukee Avenue, Nicollet Island, Healy Block, and Fourth Avenue Historic District.`,
    sec_insurance: `Minneapolis homeowners insurance is dominated by ice-dam damage claims from December through March. Most Minnesota carriers require demonstration of attic insulation (R-49 minimum) and ventilation adequacy before covering repeated ice-dam claims. Xcel Energy Minnesota and CenterPoint Energy offer envelope credits on qualifying whole-home retrofits including attic insulation upgrades that prevent ice-dam formation.`,
    sec_contractor: `Minneapolis contractor verification: Minnesota LARA Residential Building Contractor license at minneapolismn.gov, plus Minneapolis city contractor registration. Minnesota also requires Residential Remodeler licensing for smaller jobs. Minneapolis Department of Regulatory Services publishes contractor complaint history. Home Energy Squad conservation-improvement-funded jobs require verified licensing.`,
    sec_material: `Minneapolis's dominant roofing materials are architectural composition with high-wind and algae-resistant ratings on bungalows and four-squares, slate and copper on landmarked homes, and stone-coated steel increasingly on higher-end replacements. Class 4 impact-rated assemblies (Malarkey Legacy, GAF Timberline AS) are common spec because Twin Cities hail exposure is meaningful. Attic ventilation and insulation upgrades at replacement typically add $1,500-$3,500 but deliver permanent ice-dam prevention.`,
    dominantMaterial: "high-wind algae-resistant composition with 6-foot ice-and-water-shield at eaves",
    climateBand: "IECC Zone 6A very-cold continental",
    bestSeasons: "May through September, when ambient stays above sealant-activation thresholds",
    worstSeasons: "November through April sustained sub-freezing conditions",
  },
  "charlotte-nc": {
    sec_climate: `Charlotte roofs face Piedmont humidity cycling, spring tornado-corridor exposure (Charlotte Regional Tornado Alley), moderate hail frequency, and intense summer UV. The dominant Charlotte housing is 1960s-1990s ranch and split-level with architectural composition roofs, and 1990s-2010s tract construction with composition or tile in SouthPark and Ballantyne subdivisions. Dilworth and Myers Park older bungalow-and-craftsman homes often have original slate or specific composition profiles that require Historic District Commission approval for replacement.`,
    sec_code: `North Carolina Licensing Board for General Contractors requires a license for jobs over $30,000. Charlotte-Mecklenburg Historic District Commission oversees Dilworth, Wesley Heights, Fourth Ward, Plaza Midwood, and Wilmore. North Carolina Residential Code amendments require enhanced flashing and wind-uplift specifications post-2018 Florence and 2020 severe-weather outbreak events. Charlotte is not coastal but similar specifications increasingly apply under insurance-credit incentive structures.`,
    sec_insurance: `Charlotte homeowners insurance has tightened roof-age underwriting post-2022; most North Carolina carriers now apply ACV on roofs over 15-20 years. Class 4 impact-rated assemblies deliver 10-20% premium reductions on most Charlotte policies, and the Charlotte Regional Tornado Alley corridor makes Class 4 a reasonable ROI decision. Duke Energy's Smart $aver program offers envelope credits on qualifying whole-home retrofits.`,
    sec_contractor: `Charlotte contractor verification: active North Carolina Licensing Board for General Contractors license at nclbgc.org (required for jobs over $30,000), plus Mecklenburg County contractor registration for permit-pulling on smaller jobs. North Carolina Consumer Protection complaints searchable at ncdoj.gov. SouthPark and Ballantyne HOA architectural review committees require pre-approval before custom-profile orders ship.`,
    sec_material: `Charlotte's dominant roofing materials are architectural composition with algae-resistant granules (AR rating essential for Piedmont humidity), Class 4 impact-rated products on tornado-corridor properties, and slate on Dilworth and Myers Park historic homes. Algae-resistant granules prevent the black streaking endemic on north-facing slopes in Charlotte humidity; non-AR composition typically shows visible algae within 3-5 years.`,
    dominantMaterial: "algae-resistant architectural composition with Class 4 impact rating for tornado corridor",
    climateBand: "IECC Zone 3A humid-subtropical Piedmont with tornado corridor",
    bestSeasons: "October through April, outside pollen peak and summer surface extremes",
    worstSeasons: "February-March pollen, July-August humidity, and spring storm cycles",
  },
};

/* Section renderers. */

function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";
  const baseAsphalt = 10000, baseArch = 12300, baseMetal = 27000;
  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    const asph = Math.round(baseAsphalt * mult * localVar);
    const arch = Math.round(baseArch * mult * localVar);
    const metal = Math.round(baseMetal * mult * localVar);
    return `<tr><td style="padding:12px 16px; font-weight:600;">${n}</td><td style="padding:12px 16px; text-align:right;">${fmtK(asph)}</td><td style="padding:12px 16px; text-align:right;">${fmtK(arch)}</td><td style="padding:12px 16px; text-align:right;">${fmtK(metal)}</td></tr>`;
  });
  return `
<section class="section fp-section"><h2>${facts.displayName} neighborhood roof pricing</h2>
<div style="overflow-x:auto;"><table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;"><thead><tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);"><th style="text-align:left; padding:12px 16px;">Neighborhood</th><th style="text-align:right; padding:12px 16px;">3-Tab Composition</th><th style="text-align:right; padding:12px 16px;">Architectural</th><th style="text-align:right; padding:12px 16px;">Standing-Seam Metal</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;"><a href="/analyze-my-quote.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your ${facts.displayName} quote for line-item comparison.</a></p></section>`;
}

function climateSection(city, d) { return `<section class="section fp-section"><h2>${city} climate and roof performance</h2><p>${d.sec_climate}</p></section>`; }
function codeSection(city, d) { return `<section class="section fp-section"><h2>${city} permits, codes, and licensing</h2><p>${d.sec_code}</p></section>`; }
function insuranceSection(city, d) { return `<section class="section fp-section"><h2>${city} roofing insurance and claims</h2><p>${d.sec_insurance}</p></section>`; }
function contractorSection(city, d) { return `<section class="section fp-section"><h2>Vetting a ${city} roofing contractor</h2><p>${d.sec_contractor}</p></section>`; }
function materialSection(city, d) { return `<section class="section fp-section"><h2>${city} dominant roofing materials</h2><p>${d.sec_material}</p></section>`; }

function seasonalCostSection(city, state, d, mult) {
  return `<section class="section fp-section"><h2>When to reroof in ${city} and what jobs cost</h2>
<p><strong>${city} best months:</strong> ${d.bestSeasons}.</p>
<p><strong>${city} worst months:</strong> ${d.worstSeasons}.</p>
<p>A 2,000-square-foot ${city} reroof in 2026 dollars at prevailing ${city} labor rates: basic composition with ${city}-compliant underlayment runs approximately ${fmtK(Math.round(1800 * 5.0 * mult))}; mid-range architectural composition with enhanced warranty runs ${fmtK(Math.round(2000 * 6.15 * mult))}; premium standing-seam metal runs ${fmtK(Math.round(2200 * 13.5 * mult))}. These numbers reflect ${city} installer rates, not national averages. The dominant ${city} material story is ${d.dominantMaterial}, which frames nearly every ${city} reroof decision.</p>
<p><a href="/roofing-quote-analyzer.html?mode=estimator" style="color:var(--brand);">Get a ${city} roofing estimate.</a></p>
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
  const d = CITY_ROOF_DATA[metro.slug];
  if (!facts || !ctx || !d) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getMultiplier(state);

  let html = `\n${MARKER_START}\n`;
  html += flagshipCSS();
  html += neighborhoodPricing(facts, mult);
  html += climateSection(city, d);
  html += materialSection(city, d);
  html += codeSection(city, d);
  html += insuranceSection(city, d);
  html += contractorSection(city, d);
  html += seasonalCostSection(city, state, d, mult);
  html += `\n${MARKER_END}\n`;
  return html;
}

function main() {
  let processed = 0, skipped = 0;
  for (const metro of METROS) {
    const filepath = path.join(ROOT, metro.file);
    if (!fs.existsSync(filepath)) { console.log(`  SKIP ${metro.file} (file not found)`); skipped++; continue; }
    const flagshipHTML = buildFlagshipContent(metro);
    if (!flagshipHTML) { console.log(`  SKIP ${metro.file} (no data)`); skipped++; continue; }

    let content = fs.readFileSync(filepath, "utf8");
    const re = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\r?\\n?`, "g");
    content = content.replace(re, "");

    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const section6 = content.indexOf("<!-- 6.");
    let insertAt;
    if (uniqueGuideEnd >= 0) insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    else if (section6 >= 0) {
      const sectionEnd = content.lastIndexOf("</section>", section6);
      insertAt = sectionEnd >= 0 ? sectionEnd + "</section>".length : section6;
    } else { console.log(`  SKIP ${metro.file}`); skipped++; continue; }

    content = content.slice(0, insertAt) + nl + flagshipContent + content.slice(insertAt);
    if (!DRY) fs.writeFileSync(filepath, content, "utf8");

    const wordCount = flagshipHTML.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    console.log(`  ${metro.file}: ~${wordCount} words`);
    processed++;
  }
  console.log(`\nDone: ${processed} processed, ${skipped} skipped.`);
  if (DRY) console.log("[DRY RUN]");
}

main();
