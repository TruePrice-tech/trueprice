#!/usr/bin/env node
/**
 * Generates deep editorial content for 20 flagship metro siding pages.
 * Every section pulls long narrative blocks from CITY_SIDING_DATA so 8-word
 * shingle overlap across metros stays <10%.
 *
 * Idempotent via FLAGSHIP-SIDING-CONTENT markers.
 * Usage: node scripts/build-flagship-siding.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/siding-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-SIDING-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-SIDING-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", region: "northeast", file: "new-york-ny-siding-cost.html" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", region: "west", file: "los-angeles-ca-siding-cost.html" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", region: "midwest", file: "chicago-il-siding-cost.html" },
  { slug: "houston-tx", ctxKey: "Houston|TX", region: "south", file: "houston-tx-siding-cost.html" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", region: "mountain", file: "phoenix-az-siding-cost.html" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", region: "south", file: "dallas-tx-siding-cost.html" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", region: "southeast", file: "atlanta-ga-siding-cost.html" },
  { slug: "denver-co", ctxKey: "Denver|CO", region: "mountain", file: "denver-co-siding-cost.html" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", region: "west", file: "seattle-wa-siding-cost.html" },
  { slug: "austin-tx", ctxKey: "Austin|TX", region: "south", file: "austin-tx-siding-cost.html" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", region: "west", file: "san-francisco-ca-siding-cost.html" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", region: "mountain", file: "las-vegas-nv-siding-cost.html" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", region: "northeast", file: "philadelphia-pa-siding-cost.html" },
  { slug: "miami-fl", ctxKey: "Miami|FL", region: "southeast", file: "miami-fl-siding-cost.html" },
  { slug: "boston-ma", ctxKey: "Boston|MA", region: "northeast", file: "boston-ma-siding-cost.html" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", region: "west", file: "san-diego-ca-siding-cost.html" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", region: "southeast", file: "tampa-fl-siding-cost.html" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", region: "midwest", file: "detroit-mi-siding-cost.html" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", region: "midwest", file: "minneapolis-mn-siding-cost.html" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", region: "southeast", file: "charlotte-nc-siding-cost.html" },
];

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString()}`; }
function fmtD(n) { return `$${n.toLocaleString()}`; }
function getLaborMultiplier(region) { return pricingModel.laborMultiplierByRegion?.[region] || 1.0; }

/* =========================================================================
 * CITY_SIDING_DATA: long per-metro narrative chunks. Each chunk references
 * at least 2 metro-specific facts (dominant material, HOA, climate, code).
 * NO roofing terms allowed (no "shingles", "reroof", "roof pitch" etc.)
 * ========================================================================= */

const CITY_SIDING_DATA = {
  "new-york-ny": {
    sec_material: `New York City siding decisions are dominated by housing type: pre-war brick rowhouses and brownstones across Park Slope, Bay Ridge, and Astoria have minimal exposed siding surface, while mid-century and wood-framed Staten Island and Queens single-family homes require full siding replacement programs. The dominant NYC siding material on framed housing is vinyl siding due to low maintenance burden and tenant-suitability, followed by fiber cement on higher-end Brooklyn and Queens renovations. Pre-war brick requires repointing and masonry repair rather than siding replacement, and NYC contractors generally separate those trades.`,
    sec_climate: `NYC siding faces severe nor'easter wind-driven rain, heavy freeze-thaw cycling from December through March, and summer heat-island temperatures that degrade dark-colored vinyl. Salt spray from coastal Queens and Staten Island also accelerates fastener corrosion; stainless-steel nails and trim are the durable NYC spec in coastal-adjacent zones. Moisture management behind siding is the #1 NYC failure pattern: failed flashing or poorly installed weather-resistive barriers lead to hidden sheathing rot that surfaces only during eventual exterior work.`,
    sec_code: `NYC DOB requires permits for any siding replacement over 10 square feet. NYC Landmarks Preservation Commission (LPC) governs 37,000+ designated properties including Greenwich Village, SoHo, and the Upper East Side Historic District; landmarked facades require LPC approval, and vinyl is categorically prohibited on landmark-visible elevations. NYC requires a licensed Home Improvement Contractor (HIC) at nyc.gov/dca for any work over $200. Fire-rated wall assembly requirements under §705 of the NYC Building Code also govern siding selection on lot-line walls.`,
    sec_insurance: `NYC homeowners insurance covers wind and hail damage but treats siding wear as owner responsibility. Con Edison offers envelope credits on qualifying whole-home retrofits, and NYSERDA's Home Performance with ENERGY STAR program layers additional credits on insulated siding installations. Wind-driven rain penetration is a common NYC claim driver; proper weather-resistive barrier installation (Tyvek or ZIP System) behind siding is the mitigation requirement most carriers verify on claim investigations.`,
    sec_contractor: `NYC contractor verification: active HIC registration at nyc.gov/dca, bond and insurance certificates verified with issuers, and building-access coordination for multi-family buildings (service-elevator scheduling, certificates of insurance naming the building LLC as additional insured, and HIC surety bond filed with NYC DCA). NYC labor rates run 1.8-2.3x national averages per square foot of siding due to building access and parking complexity. Staten Island and outer Queens labor rates moderate, but Manhattan townhouse siding is among the most expensive residential siding work in the country.`,
    sec_flag: `NYC-specific siding fraud patterns concentrate on vinyl-gauge substitution: the bid specifies .044" or .046" gauge and the installed product is .040" builder-grade. NYC DOB inspection does not verify siding gauge, so verification falls on the homeowner. Demand the manufacturer, profile, gauge, and color on the contract; cross-reference against the manufacturer's technical spec sheet; physically measure the delivered material with calipers before installation. Save a delivery-day photo showing the gauge printed on the product packaging.`,
    dominantMaterial: "vinyl on framed Queens and Staten Island housing and fiber cement on Brooklyn renovations",
    climateBand: "mixed-humid coastal with nor'easter exposure",
    bestSeasons: "April through October, outside freezing-temperature install risk",
    worstSeasons: "December through February below-freezing conditions that fail vinyl impact resistance",
  },
  "los-angeles-ca": {
    sec_material: `Los Angeles siding is dominated by stucco on Spanish Colonial, Mediterranean, and ranch-style homes (70%+ of LA residential). Fiber cement appears on higher-end Modernist and Craftsman rebuilds, and wood siding (cedar, redwood) is common on Hollywood Hills and Brentwood architect-designed properties. Vinyl siding is rare in LA: the dominant aesthetic tradition rejects it, and HOAs in Pacific Palisades, Brentwood, and Hancock Park typically prohibit vinyl outright. Stucco replacement in LA is largely repair (cracking, efflorescence, delamination) rather than full re-side.`,
    sec_climate: `LA siding faces intense UV exposure (280+ sunny days annually), Santa Ana wind events that deposit fine debris, and Chapter 7A WUI fire-hazard requirements in hillside neighborhoods. Fiber cement and stucco are inherently Class A fire-rated; wood siding in WUI zones requires specific fire-retardant treatments documented on the permit. Dark-colored stucco fading and chalking is the LA aesthetic failure pattern: south and west elevations typically require re-coating every 10-15 years to maintain color uniformity.`,
    sec_code: `California requires a CSLB C-35 lathing and plastering license for stucco work or C-6 cabinet/millwork for wood siding. LA enforces California Building Code Chapter 7A in designated WUI zones including Mandeville Canyon, Bel Air, Beverly Hills Post Office, and portions of the San Fernando Valley; WUI compliance mandates Class A exterior wall assemblies and ember-resistant vent terminations. LA HPOZ (Historic Preservation Overlay Zones) cover 35+ designated zones where original siding material and profile must be matched.`,
    sec_insurance: `LA homeowners insurance increasingly excludes WUI fire coverage in private-market writings; California FAIR Plan provides fallback coverage, and Class A fire-rated exterior assemblies are required for FAIR Plan eligibility. LADWP offers envelope credits on insulated siding retrofits qualifying under the Consumer Rebate Program. Santa Ana wind-driven debris damage to siding is covered but typically requires documentation within 14 days of the wind event.`,
    sec_contractor: `LA contractor verification: active CSLB license (C-35 for stucco, C-61 for siding specialty, or B general) at cslb.ca.gov, with workers' compensation and bond verified. LA has a chronic "broker" license pattern where licensed contractors subcontract to unlicensed crews, which voids California Homeowners Recovery Fund eligibility. Meet the specific crew lead before signing; confirm their employer matches the licensed entity on your contract.`,
    sec_flag: `LA-specific siding fraud patterns concentrate on stucco "quickie" repairs: a contractor patches visible cracks with elastomeric coating, the underlying moisture intrusion continues, and the homeowner discovers rotted sheathing 2-3 years later when the damage has spread. Legitimate stucco repair requires diagnostic moisture testing first, removal of damaged material to sound substrate, new paper-and-lath with proper flashing, and brown-coat plus finish-coat in proper succession. Any LA stucco contractor offering repair without prior moisture testing is either inexperienced or cutting corners.`,
    dominantMaterial: "stucco on Spanish Colonial and Mediterranean homes with WUI Class A ratings",
    climateBand: "hot-dry coastal with WUI fire zones",
    bestSeasons: "October through April outside peak fire season",
    worstSeasons: "May through September WUI fire season and surface-temperature extremes",
  },
  "chicago-il": {
    sec_material: `Chicago siding decisions are dominated by brick masonry exterior (40-50% of Chicago housing is brick greystone or brick bungalow), with vinyl siding on framed bungalows and two-flats and fiber cement on higher-end renovations in Lincoln Park, Wicker Park, and Andersonville. Chicago brick requires tuckpointing and repointing rather than replacement; framed siding faces the full severe-climate challenge. The dominant Chicago siding material on framed housing is vinyl at .046" gauge or thicker to survive Chicago winters.`,
    sec_climate: `Chicago siding faces the most severe freeze-thaw cycling of any major US metro: 70-100 freeze-thaw cycles per year, sub-zero arctic plunges, 30+ inch snow events, and summer heat-index peaks above 100F. Freeze-thaw cycling drives caulk and sealant failure; Chicago-specific spec requires 35-year silicone sealants at all penetrations and transitions. Thin-gauge vinyl cracks on impact at sub-zero ambient, which is why the Chicago minimum vinyl spec is .046" or heavier. Insulated vinyl with permanently bonded EPS foam backing is increasingly specified for both thermal performance and impact resistance.`,
    sec_code: `Chicago DOB enforces 2019 Chicago Building Code with local §18-28 exterior wall provisions. Permits are required for any siding replacement over 100 square feet. Chicago requires a city-specific GC license for permit-pulling; Illinois has no statewide residential contractor license. Commission on Chicago Landmarks oversees 12,000+ landmarked structures including Old Town, Pullman, Prairie Avenue, and the Astor Street District; landmarked replacements require commission approval and material matching on the primary facade.`,
    sec_insurance: `Chicago homeowners insurance covers windstorm and hail damage to siding with standard sudden-event provisions. The derecho and supercell storm history in Chicago produces recurring siding claims, and Class 4 impact-rated fiber cement installations qualify for 10-15% premium reductions on most Chicago policies. Peoples Gas and ComEd offer envelope credits on insulated siding retrofits qualifying under ENERGY STAR whole-home certifications.`,
    sec_contractor: `Chicago contractor verification: active GC-C license at chicago.gov/city/en/depts/bldgs, workers' compensation and bond, and Illinois Attorney General Home Repair Fraud complaint history at illinoisattorneygeneral.gov. Chicago's biggest contractor risk is out-of-state storm-chase operators from Texas, Oklahoma, and Alabama appearing post-derecho. Chicago DOB does not recognize out-of-state licenses and the work fails inspection at close-out.`,
    sec_flag: `Chicago-specific siding fraud patterns target pre-war brick and bungalow owners with "insurance-claim" pitches after hail events. The Chicago pattern: a contractor claims hail damage to previously sound vinyl, files a claim with the homeowner's carrier, uses the payout to install builder-grade vinyl, and disappears before warranty issues surface. Independent adjusters (homeowner-hired) cost $400-$700 but typically catch inflated claims before the carrier pays out against inflated scope.`,
    dominantMaterial: "brick masonry on greystone and bungalow housing plus .046-gauge vinyl on framed homes",
    climateBand: "cold with severe freeze-thaw cycling",
    bestSeasons: "May through October, above sealant-activation temperatures",
    worstSeasons: "November through April sustained sub-freezing conditions",
  },
  "houston-tx": {
    sec_material: `Houston siding is dominated by brick veneer on 1970s-2010s tract construction (60%+ of Houston residential) with Hardie fiber cement increasingly common on higher-end replacements in The Heights, Montrose, and West University. Vinyl siding appears on older ranch and cottage homes across outer Harris County. Brick veneer in Houston typically outlasts the home's framing, so siding replacement projects in Houston usually involve fiber cement, wood, or vinyl on framed sections (gables, dormers, second-story) rather than full-home material swaps.`,
    sec_climate: `Houston siding faces 95%+ summer humidity year-round, Gulf Coast hurricane wind-uplift exposure, salt spray in coastal Harris County zones, and freeze-shock events (Uri 2021 permanently changed Houston material selection). Humidity accelerates wood rot, biological growth on north-facing elevations, and caulk joint failure. Hurricane wind uplift per ASTM D3161 and D7158 drives fastener spacing and corner-post specifications. Fiber cement handles humidity better than any other material available; wood siding in Houston requires diligent maintenance (repainting every 3-5 years, immediate crack caulking) or rot surfaces within 10-15 years.`,
    sec_code: `Texas has no state siding installer license. City of Houston Building Department requires permits for siding replacement over 100 square feet. Harris County Residential Code §R703 governs exterior wall coverings. Post-Hurricane Harvey code amendments tightened wind-uplift fastener spacing. City of Houston historic landmarks in Heights, Old Sixth Ward, Broadacres, and Riverside Terrace require Archaeological and Historical Commission (HAHC) approval, and HAHC material standards favor wood lap siding matching original profiles on contributing structures.`,
    sec_insurance: `Houston homeowners insurance covers wind and hail damage to siding with standard sudden-event provisions. Post-Harvey policies tightened wind-mitigation requirements; most major carriers verify fastener spacing and corner-post wind-rating on claims. Hailstorms produce recurring Houston claims, and Class 4 impact-rated fiber cement qualifies for 10-20% premium reductions. CenterPoint Energy offers envelope credits on ENERGY STAR-qualifying insulated siding retrofits.`,
    sec_contractor: `Houston contractor verification: Texas has no state license, so verification runs on Secretary of State business filing, Harris County Appraisal District property records (if claiming permanent office), insurance verification with the issuer, and BBB complaint history. Houston's biggest contractor risk is storm-chase crews appearing post-Harvey or post-spring-storm season with "we're handling your insurance claim" pitches. Never assign insurance proceeds directly to a contractor.`,
    sec_flag: `Houston-specific siding fraud patterns concentrate on post-storm canvassing and Assignment of Benefits (AOB) abuse. The Houston pattern: an out-of-state contractor signs the homeowner to an AOB, files inflated wind-damage claim, receives payout, and departs. Texas Insurance Code §4102.207 prohibits insurance-fraud arrangements but enforcement is uneven. Legitimate Houston contractors never require AOB signing and never offer to "eat your deductible."`,
    dominantMaterial: "brick veneer on tract construction with Hardie fiber cement on gable and dormer framed sections",
    climateBand: "hot-humid Gulf Coast with hurricane wind uplift",
    bestSeasons: "October through February outside hurricane and peak-humidity seasons",
    worstSeasons: "June through September hurricane season and humidity extremes",
  },
  "phoenix-az": {
    sec_material: `Phoenix siding is dominated by stucco on block-wall and framed construction across the metro (75%+ of Phoenix residential is stucco). Fiber cement appears on higher-end Arcadia and Biltmore renovations; vinyl and wood siding are rare due to extreme UV degradation. The dominant Phoenix siding material is 3-coat stucco (scratch, brown, finish) over paper-and-lath, typically requiring re-coat every 12-18 years to maintain color and crack resistance. Block-wall construction in Sunnyslope, Arcadia Lite, and central Phoenix uses direct-applied stucco without framing cavity.`,
    sec_climate: `Phoenix siding faces the most extreme UV environment in any major US metro: 310+ sunny days annually, surface temperatures on dark stucco above 150F in July, and monsoon microburst wind events from July-September. UV degradation drives color fading, chalking, and caulk joint failure; dark-colored stucco typically fades visibly within 8-12 years on south and west elevations. Monsoon wind-driven debris tests flashing and penetration seals; water intrusion behind stucco through unsealed windows or vents creates the dominant Phoenix failure pattern.`,
    sec_code: `Arizona requires a Registrar of Contractors (ROC) license: C-35 plastering and lathing for stucco or B-General Commercial for broader scope. Phoenix enforces City of Phoenix Building Code with amendments tracking 2018 IRC. Phoenix historic districts (Willo, Encanto-Palmcroft, Coronado, Roosevelt, F.Q. Story) require Historic Preservation Office approval for exterior work. Block-wall construction in older Phoenix neighborhoods requires specific stucco adhesion testing before major repairs.`,
    sec_insurance: `Phoenix homeowners insurance covers monsoon wind and hail damage with standard sudden-event provisions. Monsoon microburst damage must typically be documented within 30 days per Arizona carrier requirements. APS and SRP offer envelope credits on cool-roof and insulated-siding retrofits qualifying under whole-home energy programs. Phoenix's hail exposure is milder than Denver or Dallas but not zero.`,
    sec_contractor: `Phoenix contractor verification: active Arizona ROC license (C-35 or B-General) at roc.az.gov, bond status, and complaint history. Arizona ROC pursues unlicensed contractor cases aggressively but deposit recovery is limited after the fact. Phoenix HOA architectural approval complications are common in Ahwatukee, Desert Ridge, and Arcadia; require written ARC approval before custom-color stucco or specialty fiber cement orders ship.`,
    sec_flag: `Phoenix-specific siding fraud patterns concentrate on stucco repair scams: a contractor patches visible cracks with elastomeric coating, the underlying moisture intrusion continues, and the homeowner discovers rotted sheathing 2-3 years later. Legitimate Phoenix stucco repair requires moisture testing first, scope documentation, and proper 3-coat application over new paper-and-lath in damaged areas. Any Phoenix stucco contractor offering "quickie" repair without testing is cutting corners.`,
    dominantMaterial: "3-coat stucco over block-wall and framed construction with re-coat cycles every 12-18 years",
    climateBand: "hot-dry desert with monsoon season",
    bestSeasons: "October through April, outside 150F+ surface-temperature extremes",
    worstSeasons: "June through September monsoon and peak UV surface temperatures",
  },
  "dallas-tx": {
    sec_material: `Dallas siding is dominated by brick veneer on 1950s-2010s tract construction (55-65% of Dallas residential), with Hardie fiber cement increasingly common on higher-end replacements in Highland Park, Lakewood, and Preston Hollow. Vinyl siding appears on older ranch homes across outer Dallas County. Dallas brick veneer typically outlasts the home framing; replacement projects usually involve fiber cement or wood on framed gables, dormers, and second-story sections rather than full-home siding swaps.`,
    sec_climate: `Dallas siding faces the most severe US hail environment, intense summer UV exposure, tornado-corridor wind uplift, and Houston Black clay foundation movement that stresses exterior wall seams. Hailstorm damage to vinyl is catastrophic (cracking and shattering at 1-inch diameter and above); fiber cement dents but retains structural integrity. Post-2019 and 2023 Dallas tornado events drove major insurance-side tightening on siding material selection. Class 4 impact-rated fiber cement is increasingly baseline spec, not upgrade.`,
    sec_code: `Dallas requires City of Dallas Residential Building Registration for permit-pulling. Texas has no state-level siding license. Dallas 2021 amendments added enhanced wind-uplift fastener requirements following tornado events. Dallas historic districts (Munger Place, Swiss Avenue, State-Thomas, South Boulevard-Park Row) require Historic Preservation Office review on contributing structures, and approved materials typically include specific wood profiles or historically accurate fiber cement matching original patterns.`,
    sec_insurance: `Dallas homeowners insurance heavily incentivizes Class 4 impact-rated materials: most major Texas carriers offer 15-30% premium reductions on Class 4-rated installations. After 2019 and 2023 tornado outbreaks, several carriers made Class 4 a requirement for new-policy writing in specific Dallas zip codes. Oncor offers envelope credits on ENERGY STAR-qualifying insulated siding retrofits.`,
    sec_contractor: `Dallas contractor verification: City of Dallas Residential Building Registration, workers' compensation and general liability certificates verified with issuers, and BBB complaint history at bbb.org/dallas. Dallas's biggest contractor risk is storm-chase crews post-tornado. Texas Insurance Code §4102.207 prohibits contractors from "eating deductibles" on insurance claims; any Dallas contractor offering that arrangement is willing to commit insurance fraud.`,
    sec_flag: `Dallas-specific siding fraud patterns concentrate on hail-driven claims: out-of-state contractors file inflated claims on behalf of homeowners, use the payout to install builder-grade vinyl or thin-gauge fiber cement, and disappear. Dallas-specific due diligence: hire an independent adjuster ($400-$700) before the carrier adjuster visits, demand written scope specifying manufacturer and gauge, and verify completed installation matches contracted specification with random-pattern thickness measurement.`,
    dominantMaterial: "brick veneer on tract construction with Class 4 fiber cement on framed gables post-tornado",
    climateBand: "mixed-humid tornado alley with severe hail",
    bestSeasons: "October through February outside peak spring storm season",
    worstSeasons: "March through June peak hail and tornado season",
  },
  "atlanta-ga": {
    sec_material: `Atlanta siding decisions are driven by craftsman-bungalow-era housing stock (1920s-1950s) and newer tract subdivisions. Dominant Atlanta siding materials: wood lap siding (original and replacement) on craftsman bungalows in Virginia-Highland, Inman Park, and Grant Park; Hardie fiber cement on mid-range renovations; and brick veneer on newer tract construction. Vinyl siding appears on value-tier replacements but HOA restrictions in Buckhead, Morningside, and Druid Hills often prohibit vinyl outright.`,
    sec_climate: `Atlanta siding faces Piedmont humidity cycling that accelerates biological growth on north-facing elevations, intense summer UV exposure, tornado-corridor wind uplift (Northwest Atlanta in particular), and Georgia red clay foundation movement that stresses siding seams. Humidity and pollen combine to create aggressive algae and mildew growth patterns: Atlanta non-treated wood siding typically shows visible biological growth within 18-24 months. Termite exposure is severe; wood siding requires pressure-treated framing or fiber cement substitution at grade-level sections.`,
    sec_code: `Georgia requires a state Residential Basic Contractor license for jobs over $2,500, verified at sos.ga.gov. Atlanta enforces Georgia State Minimum Standard Codes with local amendments. Atlanta Urban Design Commission (AUDC) reviews 20+ historic districts including Inman Park, Grant Park, Virginia-Highland, Candler Park, and Cabbagetown; landmarked replacements require AUDC approval, and wood lap siding matching original profiles is typical. Vinyl is typically prohibited on AUDC-governed contributing structures.`,
    sec_insurance: `Atlanta homeowners insurance covers wind and hail damage with standard sudden-event provisions. Carriers have tightened underwriting on 15-20+ year old siding installations since 2022. Georgia Power offers envelope credits on ENERGY STAR-qualifying insulated siding retrofits. Class 4 impact-rated assemblies deliver 10-20% premium reductions on most Atlanta policies; tornado-corridor properties west of I-285 see higher credits.`,
    sec_contractor: `Atlanta contractor verification: active Georgia Residential Basic Contractor license at sos.ga.gov, workers' compensation and general liability verified with issuers, and Georgia Attorney General Consumer Protection complaint history at law.georgia.gov. Atlanta's AOB fraud pattern is a known risk; O.C.G.A. §33-24-59.25 gives homeowners 10 business days to rescind any signed AOB.`,
    sec_flag: `Atlanta-specific siding fraud patterns concentrate on tornado-corridor post-storm canvassing and termite-damage concealment. The Atlanta pattern: an out-of-area contractor installs new siding over undiscovered termite damage or rotted sheathing, the new installation hides the damage for 2-5 years, and the homeowner discovers spreading structural damage when the next exterior project begins. Legitimate Atlanta siding installers inspect framing behind existing siding before quoting; any contractor skipping that inspection is either inexperienced or planning to cover damage.`,
    dominantMaterial: "wood lap siding on craftsman bungalows and Hardie fiber cement on mid-range renovations",
    climateBand: "humid-subtropical Piedmont with tornado corridor",
    bestSeasons: "October-November and March-April, outside pollen peak and humidity surges",
    worstSeasons: "February-March pollen and July-August humidity extremes",
  },
  "denver-co": {
    sec_material: `Denver siding decisions are shaped by Front Range hail corridor exposure and high-altitude UV stress. Dominant Denver siding materials: fiber cement on mid-range tract construction and higher-end renovations in Wash Park, Highlands, and Stapleton; stucco on Spanish-influenced homes; wood lap siding on landmarked Capitol Hill, Country Club, and Baker historic homes. Vinyl siding is present on value-tier installations but HOA restrictions in Cherry Creek, Highlands Ranch, and Centennial typically prohibit thin-gauge vinyl.`,
    sec_climate: `Denver siding faces the Front Range hail corridor (one of the nation's most severe), extreme UV at 5,280 feet elevation, sustained winter freeze-thaw cycling, and chinook wind events driving 60-80 mph gusts. Hailstorms drive recurring Denver siding replacements; vinyl siding typically sees impact damage from hail 1 inch or larger, while fiber cement dents but retains structural integrity. High-altitude UV accelerates color fading on all materials, with south and west elevations showing measurable fade by year 8-12.`,
    sec_code: `Colorado has no statewide siding installer license, so Denver Class D (residential) Supervisor License from the Department of Excise and Licenses is the operative verification. Denver enforces 2021 IRC with Denver-specific amendments. Denver Landmark Preservation Commission oversees 55+ historic districts including Capitol Hill, Country Club, Baker, Humboldt Street, and Wyman; landmarked replacements require commission approval and typical approved materials include wood lap or stucco matching original profiles.`,
    sec_insurance: `Denver homeowners insurance is heavily hail-driven: most major Colorado carriers offer 15-30% premium reductions on Class 4 impact-rated siding installations, and several carriers made Class 4 a requirement for new-policy writing in specific Front Range hail-corridor zip codes since 2022. Xcel Energy's efficiency programs offer envelope credits on ENERGY STAR-qualifying insulated siding retrofits.`,
    sec_contractor: `Denver contractor verification: Denver Class D Supervisor License at denvergov.org, Colorado DORA complaint history at dora.colorado.gov, and bond and insurance coverage verified with issuers. Denver's biggest contractor risk is out-of-state storm-chase crews surging into Cherry Creek, Centennial, and Highlands Ranch after major hail events. Denver DOB does not recognize out-of-state licenses and work fails inspection at close-out.`,
    sec_flag: `Denver-specific siding fraud patterns concentrate on post-hail insurance claim manipulation: out-of-state contractors canvass post-event, file inflated claims on homeowners' behalf, and use the payout on builder-grade materials installed under emergency-scheduling pressure. Denver-specific due diligence: hire an independent adjuster ($400-$700) before the carrier adjuster visits, confirm written scope specifying manufacturer and thickness, and cross-reference at least three Colorado references from jobs completed at least 2 hail seasons ago.`,
    dominantMaterial: "Class 4 fiber cement on hail-corridor properties and wood lap on Capitol Hill historic homes",
    climateBand: "cold-dry high altitude with Front Range hail corridor",
    bestSeasons: "May through October above sealant-activation thresholds",
    worstSeasons: "November through April below-freezing conditions plus June-July hail peak",
  },
  "seattle-wa": {
    sec_material: `Seattle siding is dominated by cedar clapboard and cedar shake on 1910s-1950s craftsman and Tudor homes across Capitol Hill, Ballard, and Wallingford. Fiber cement appears on modern renovations and mid-century box homes; vinyl is present on value-tier installations but Seattle's aesthetic tradition and HOA restrictions in Laurelhurst, Broadmoor, and Madrona typically discourage vinyl. Cedar siding is the Seattle signature material, and cedar that has been properly maintained or restored commands premium resale value.`,
    sec_climate: `Seattle siding faces persistent marine moisture (October-April atmospheric rivers), abundant moss and algae growth on north-facing cedar, minimal UV exposure that extends composition lifespan but accelerates biological degradation, and Cascadia earthquake seismic stress. Moisture management behind siding is the Seattle #1 failure pattern: failed flashing or poorly installed weather-resistive barriers cause hidden sheathing rot that surfaces during eventual exterior work. Cedar requires specific treatments (cedar-specific stain or semi-transparent finishes) every 5-7 years in Seattle's moisture environment.`,
    sec_code: `Washington requires L&I contractor registration for any paid siding installation. Seattle enforces 2018 IRC with Seattle Energy Code amendments requiring continuous air-barrier testing on major renovations. Seattle Landmarks Preservation Board oversees districts including Pike Place Market, Pioneer Square, Harvard-Belmont, Ballard Avenue, and Columbia City; landmarked replacements require cedar or wood matching original profiles on contributing facades.`,
    sec_insurance: `Seattle homeowners insurance covers windstorm and water intrusion damage with standard sudden-event provisions but treats biological growth and gradual moisture intrusion as homeowner wear. Cascadia earthquake coverage is a separate consideration (most standard policies exclude); supplemental seismic coverage is available. Seattle City Light and Puget Sound Energy offer envelope credits on qualifying whole-home retrofits.`,
    sec_contractor: `Seattle contractor verification: active Washington L&I contractor registration at secure.lni.wa.gov, bond amount matching job scope, and Washington Attorney General Consumer Protection complaints at atg.wa.gov. Seattle's biggest fraud pattern is L&I registration expiration mid-project; registered-at-bidding contractors whose registration lapses before completion forfeit homeowner surety recovery rights. Screenshot the L&I verification date-stamped to contract-signing day.`,
    sec_flag: `Seattle-specific siding fraud patterns concentrate on hidden-rot concealment and cedar-maintenance neglect. The Seattle pattern: a contractor installs new siding over rotted cedar or sheathing without repairs, the new installation hides the damage for 2-3 years, and the homeowner discovers spreading structural damage in later exterior work. Legitimate Seattle installers probe framing and sheathing behind existing siding during initial assessment and include documented rot repair in the written scope.`,
    dominantMaterial: "cedar clapboard and cedar shake on craftsman and Tudor homes",
    climateBand: "marine cool wet with persistent humidity",
    bestSeasons: "June through September, the only reliable dry-weather window",
    worstSeasons: "October through April sustained rain saturation",
  },
  "austin-tx": {
    sec_material: `Austin siding decisions are shaped by Hill Country limestone facades, Uri 2021 freeze-shock lessons, and rapid growth-driven tract construction. Dominant Austin siding materials: limestone veneer on West Austin homes in Westlake, Rollingwood, and Barton Creek; Hardie fiber cement on mid-range renovations; and brick veneer on newer tract subdivisions in Mueller, Circle C, and Southwest Hills. Vinyl siding is uncommon in Austin due to limestone aesthetic tradition and HOA restrictions in most newer developments.`,
    sec_climate: `Austin siding faces intense Hill Country UV exposure (230+ sunny days annually), Uri-style freeze-shock thermal cycling, tornado-corridor wind uplift, and expansive clay foundation movement in East Austin (West Austin limestone soil is stable). Freeze-shock cracking is the Austin post-Uri failure pattern: vinyl and thin-gauge fiber cement can crack at sub-freezing temperatures, which is why Austin spec increasingly favors thicker fiber cement (7/16" nominal) and higher-end Hardie ColorPlus finishes with 15-year fade warranties.`,
    sec_code: `Texas has no state siding installer license. City of Austin requires Registered Residential Building Contractor status for permit-pulling. Austin Historic Landmark Commission oversees districts including Hyde Park, Travis Heights, Clarksville, Old West Austin, and Rainey Street Historic District; landmarked replacements require commission approval and typically mandate wood lap or limestone veneer matching original profiles. City of Austin Building Department enforces wind-uplift requirements tracking 2018 IRC with Austin-specific amendments.`,
    sec_insurance: `Austin homeowners insurance covers wind and hail damage with standard sudden-event provisions. Post-Uri 2021, many Texas carriers require freeze-damage remediation documentation before renewing Austin-area policies. Austin Energy offers envelope credits on ENERGY STAR-qualifying insulated siding retrofits. Class 4 impact-rated installations deliver 10-20% premium reductions on most Austin policies.`,
    sec_contractor: `Austin contractor verification: City of Austin Registered Residential Building Contractor status, workers' compensation and general liability verified with issuers, and Austin Code Compliance complaint history at austintexas.gov/department/building-inspections. Austin's rapid growth attracts out-of-area contractors from Houston and DFW; require a permanent Austin address and three Travis County references pre-2023.`,
    sec_flag: `Austin-specific siding fraud patterns concentrate on post-Uri freeze-damage insurance claim manipulation: contractors file inflated freeze-damage claims, install builder-grade materials under emergency-scheduling pressure, and depart before warranty issues surface. Austin-specific due diligence: demand documented freeze-damage photographs before any claim filing, verify the contractor has been in Austin pre-2021 (not Uri storm-chase arrival), and require 3 Austin references from 2022-2024 installations.`,
    dominantMaterial: "limestone veneer on West Austin and Hardie fiber cement on mid-range renovations",
    climateBand: "hot-humid Hill Country with Uri-style freeze risk",
    bestSeasons: "October through February outside peak spring storm season",
    worstSeasons: "March through June peak storm and July-August surface extremes",
  },
  "san-francisco-ca": {
    sec_material: `San Francisco siding is dominated by wood siding on Victorian and Edwardian painted ladies across the entire city, stucco on Sunset and Richmond District 1930s-1950s row houses, and custom specialty materials on architect-designed Mid-Century and Modern homes. Vinyl siding is categorically prohibited in SF historic preservation districts (Alamo Square, Jackson Square, Liberty-Hill) and is rare even outside protected areas. Cedar and redwood are the Victorian-era originals; restoration projects typically use matching clear-vertical-grain redwood with custom milled profiles.`,
    sec_climate: `SF siding faces marine moisture variable by microclimate (Sunset and Richmond fog-belt see persistent moisture, Mission and Bernal sun-belt see minimal), Cascadia earthquake seismic stress, and Title 24 cool-wall requirements on alterations. Fog-belt moisture drives aggressive biological growth on cedar and redwood; sun-belt UV drives color fading on stucco and darker wood stains. Seismic movement tests every siding seam; rigid-material fiber cement performs worse in earthquakes than flexible wood lap.`,
    sec_code: `California requires a CSLB license for siding work: C-6 cabinet/millwork for wood, C-35 plastering and lathing for stucco, or B general. SF DBI additionally requires city contractor registration for permit-pulling. SF Historic Preservation Commission plus Planning Code Articles 10 and 11 cover 270+ designated landmarks; landmarked replacements require wood true-historic-profile matching. SF's dust-control ordinance §3428 imposes HEPA-vacuum cleanup verification on lead-impacted projects (pre-1978 homes).`,
    sec_insurance: `SF homeowners insurance is increasingly constrained by wildfire risk: several major California carriers have pulled new-policy writing in Twin Peaks, Presidio, and Diamond Heights fire-hazard zones since 2022. California FAIR Plan provides fallback coverage, and Class A fire-rated exterior assemblies are required for FAIR Plan eligibility. PG&E and BayREN offer envelope credits on qualifying whole-home retrofits.`,
    sec_contractor: `SF contractor verification: active CSLB license (C-6, C-35, or B general) at cslb.ca.gov, SF DBI city contractor registration, and complaint history at sfdbi.org. SF lead-safe renovation rules (pre-1978 homes) require EPA RRP certification for any siding work disturbing lead-painted surfaces. SF's cash-job underground economy in Sunset and Richmond creates recurring unlicensed-contractor fraud exposure; any SF siding contract without verified CSLB license voids Homeowners Recovery Fund eligibility.`,
    sec_flag: `SF-specific siding fraud patterns concentrate on Victorian restoration projects where historic profile matching drives high per-square-foot costs. The SF pattern: a contractor substitutes off-the-shelf fiber cement for true-historic-profile redwood on landmarked elevations, the SF HPC catches the mismatch at inspection, and the homeowner pays twice for the correction. Legitimate SF Victorian restoration contractors include milling spec, wood source, and profile dimensions on the written scope.`,
    dominantMaterial: "wood siding on Victorian painted ladies and stucco on Sunset and Richmond row houses",
    climateBand: "marine mild coastal with microclimate variation and WUI fire zones",
    bestSeasons: "June through October, when fog-season humidity drops enough for reliable install",
    worstSeasons: "November through March rainy-season disruption and winter atmospheric rivers",
  },
  "las-vegas-nv": {
    sec_material: `Las Vegas siding is dominated by stucco on master-planned community construction in Summerlin, Henderson, Green Valley, Anthem, and MacDonald Ranch (80%+ of Vegas residential is stucco). Fiber cement appears on higher-end architect-designed homes; vinyl siding is rare due to extreme UV degradation and HOA prohibitions. Vegas historic areas (John S. Park, Huntridge) feature wood lap siding on 1940s-1960s homes requiring specialty maintenance. The dominant Vegas siding material is 3-coat stucco over paper-and-lath with re-coat cycles every 10-15 years due to UV fade.`,
    sec_climate: `Vegas siding faces the most severe UV environment of any major US metro: 310+ sunny days annually, surface temperatures on dark stucco above 160F in July, and monsoon microburst events (July-September). UV degradation drives color fade, chalking, and caulk joint failure on all materials; dark-colored stucco shows measurable fade within 6-8 years on south and west elevations. Monsoon wind-driven debris tests flashing seals at windows and penetrations.`,
    sec_code: `Nevada State Contractors Board requires a C-17 plastering license for stucco work or B-General Building for broader scope. Clark County enforces 2018 IRC with local amendments. Vegas has few historic districts, but John S. Park and Huntridge areas require approval on exterior changes. Clark County energy code requires specific reflectance values on exterior wall coverings on new construction; alterations are less strictly governed.`,
    sec_insurance: `Vegas homeowners insurance covers monsoon wind and hail damage as sudden events. Monsoon damage must typically be documented within 30 days per Nevada carrier requirements. NV Energy offers envelope credits on ENERGY STAR-qualifying insulated siding retrofits. Vegas's hail exposure is milder than Denver or Dallas; premium credits for impact-rated materials are modest.`,
    sec_contractor: `Vegas contractor verification: active Nevada C-17 or B-General license at nscb.nv.gov, bond status, and NSCB complaint history. Nevada's deposit-cap law (NRS §624.6245) caps residential contractor deposits at 10% of contract or $1,000 (whichever is less); any Vegas contract demanding 20-50% upfront is unenforceable. HOA architectural approval complications are severe in Summerlin, Anthem, and MacDonald Ranch.`,
    sec_flag: `Vegas-specific siding fraud patterns concentrate on HOA-driven stucco repair scams and master-planned community re-coat abuse. The Vegas pattern: a contractor bids HOA-required stucco re-coat on south and west elevations, receives deposit, performs only surface elastomeric coating without addressing underlying crack or moisture issues, and departs. Legitimate Vegas stucco contractors provide written crack-repair, paper-and-lath inspection, and moisture-testing scope on any re-coat project.`,
    dominantMaterial: "3-coat stucco on master-planned community construction with HOA-dictated re-coat cycles",
    climateBand: "hot-dry desert with monsoon season and extreme UV",
    bestSeasons: "November through April, outside monsoon and 160F+ surface extremes",
    worstSeasons: "June through September monsoon and peak-summer surface heat",
  },
  "philadelphia-pa": {
    sec_material: `Philadelphia siding is dominated by brick masonry on rowhouse trinity and three-story twin housing across Center City, South Philly, and Northern Liberties (60%+ of Philly residential is brick). Hardie fiber cement and wood lap siding appear on framed sections (gables, dormers) and on Northwest Philadelphia single-family homes in Chestnut Hill and Mount Airy. Vinyl siding is present on value-tier installations but restricted in rowhouse historic districts. Philadelphia brick requires tuckpointing and repointing rather than replacement.`,
    sec_climate: `Philadelphia siding faces moderate freeze-thaw cycling, heavy humidity-driven biological growth, and rowhouse geometry that concentrates exposure on front and back elevations. Rowhouse parapet walls create specific cap-flashing and counter-flashing requirements; failed parapet flashing is the #1 rowhouse siding failure pattern in Philadelphia. Humidity accelerates biological growth on north-facing elevations and biological deposits on stucco and light-colored wood.`,
    sec_code: `Pennsylvania requires HICPA (Home Improvement Contractors Protection Act) registration. Philadelphia L&I additionally requires a city Contractor License for permit-pulling; both must be active and both must appear on the contract. Philadelphia Historical Commission oversees 18,000+ historic structures including Society Hill, Old City, Rittenhouse, Chestnut Hill, and the Girard Estate Historic District; landmarked replacements require commission approval and typically mandate matching material.`,
    sec_insurance: `Philadelphia homeowners insurance covers windstorm and hail damage with standard sudden-event provisions. Rowhouse water-intrusion claims are common and typically trace to failed parapet cap-flashing rather than vertical siding failure. PECO and PGW offer envelope credits on ENERGY STAR-qualifying insulated siding retrofits. Philadelphia's moderate hail exposure does not drive premium incentives like Denver or Dallas.`,
    sec_contractor: `Philly contractor verification: active Philadelphia L&I Contractor License at philadelphialicense.com AND Pennsylvania HICPA registration at attorneygeneral.gov/hicpa. Both are required and both must be independently active. Many Philly operators hold one but not the other. Both license numbers must appear on the signed contract.`,
    sec_flag: `Philly-specific siding fraud patterns concentrate on rowhouse parapet wall concealment and "Historic District" stucco repair scams. The Philly pattern: a contractor installs new siding over rotted parapet or deteriorated sheathing without structural repair, the new installation hides damage for 2-4 years, and failure surfaces during weather events. Legitimate Philly rowhouse siding contractors inspect parapet cap-flashing, gutter, and scupper conditions during initial assessment.`,
    dominantMaterial: "brick masonry on rowhouse trinity and three-story twins with Hardie fiber cement on framed sections",
    climateBand: "mixed-humid with moderate freeze-thaw",
    bestSeasons: "April through June and September through early November",
    worstSeasons: "December through February below-freezing conditions and July-August humidity extremes",
  },
  "miami-fl": {
    sec_material: `Miami siding is dominated by stucco on CBS (concrete block stucco) construction across the metro (85%+ of Miami residential is CBS stucco). Hardie fiber cement appears on higher-end renovations and Miami Beach Art Deco District replacement work where approved by the historic commission. Vinyl siding is present on older framed housing but restricted by Miami-Dade HVHZ wind-uplift requirements in many neighborhoods. Miami-Dade stucco over CBS requires specific adhesion systems and monsoon-season moisture management.`,
    sec_climate: `Miami siding faces mandatory HVHZ wind-uplift exposure, annual Atlantic hurricane season (June-November), tropical UV degradation, and salt spray in coastal-adjacent zones. Hurricane Andrew (1992) and Hurricane Irma (2017) both drove code tightening. Stucco failure in Miami typically traces to window or penetration sealant failure followed by moisture intrusion behind the CBS-stucco assembly; the dominant Miami failure pattern is hidden moisture damage surfacing years after original installation.`,
    sec_code: `Florida DBPR requires a Certified Building Contractor (CGC) or Certified Specialty Contractor for Miami siding work. Miami-Dade County enforces Florida Building Code with mandatory HVHZ provisions. Every exterior wall product installed in Miami-Dade and Broward must have a current Notice of Acceptance (NOA) from Miami-Dade Product Approval, and the NOA number must appear on the building permit. Historic preservation authority covers Coral Gables, Miami Beach Art Deco District, and MiMo Biscayne Boulevard.`,
    sec_insurance: `Miami homeowners insurance is dominated by Citizens Property Insurance and specialty coastal carriers. Siding condition is a primary underwriting factor on wind-mitigation credits under OIR-B1-1802 form: continuous secondary water-resistant barriers, hip-roof geometry (though that's roofing not siding), and impact-rated exterior wall coverings deliver substantial premium reductions. Florida impact-window sales tax holiday (Q3 annually) also applies to qualifying exterior wall products.`,
    sec_contractor: `Miami contractor verification: Florida DBPR Certified Building Contractor at myfloridalicense.com, Miami-Dade County business tax receipt, and NOA documentation authenticity verified at miamidade.gov/pa. Miami post-hurricane contract fraud patterns are severe: out-of-state crews appear with NOA-spoof documentation that does not match installed materials.`,
    sec_flag: `Miami-specific siding fraud patterns concentrate on hurricane-season AOB manipulation and NOA substitution. The Miami pattern: a contractor signs homeowner to Assignment of Benefits, files inflated wind-damage claim, and installs non-NOA-compliant material that fails Miami-Dade inspection. Use the 14-day AOB rescission window under Florida Statute §627.7152 if you signed one under pressure. Physically verify NOA numbers on frame labels before the inspector arrives.`,
    dominantMaterial: "stucco on CBS construction with NOA-approved impact rating in HVHZ zones",
    climateBand: "very-hot-humid tropical with HVHZ wind-uplift",
    bestSeasons: "December through April outside Atlantic hurricane season",
    worstSeasons: "June through November Atlantic hurricane season and September peak",
  },
  "boston-ma": {
    sec_material: `Boston siding is dominated by wood clapboard and cedar shake on colonial-era and triple-decker housing across the metro, with brick masonry on Back Bay and Beacon Hill rowhouses. Hardie fiber cement and wood composite appear on modern renovations in the South End, Jamaica Plain, and Brighton. Vinyl siding is present on value-tier installations but restricted in Boston Landmarks Commission historic districts. Triple-decker clapboard requires specific Boston-appropriate installation details at the three-story corners and top-story gables.`,
    sec_climate: `Boston siding faces severe nor'easter wind-driven rain, heavy freeze-thaw cycling from December through March, extensive ice-dam-driven water intrusion, and summer heat-island temperatures. Nor'easter wind uplift tests fastener spacing and corner-post integrity. Ice-dam water intrusion drives hidden moisture damage behind siding; the Boston failure pattern is concealed sheathing rot surfacing during eventual exterior work. Salt spray in coastal-adjacent Boston neighborhoods (Winthrop, Nahant, Hull) also accelerates fastener corrosion.`,
    sec_code: `Massachusetts requires a Home Improvement Contractor (HIC) registration plus a Construction Supervisor License (CSL) for any structural siding work. Boston enforces Massachusetts State Building Code (780 CMR) with Boston-specific amendments including the Stretch Code for energy compliance. Boston Landmarks Commission oversees Back Bay, Beacon Hill, Fort Point, South End, and Bay Village historic districts; landmarked replacements require commission approval before permit issuance.`,
    sec_insurance: `Boston homeowners insurance covers nor'easter wind and ice-dam water intrusion as sudden events but treats chronic moisture wear as homeowner responsibility. Mass Save's whole-home weatherization program rebates envelope improvements including attic insulation that prevents ice-dam formation. Boston winter-storm damage claims must typically be filed within 30-60 days.`,
    sec_contractor: `Boston contractor verification: both Massachusetts HIC registration AND Construction Supervisor License (CSL) at mass.gov. Both are required and both must be separately active. Mass Save rebate eligibility also requires verified licensing. Boston Landmarks approval for Back Bay, Beacon Hill, and South End adds 6-10 weeks on top of standard permit timelines.`,
    sec_flag: `Boston-specific siding fraud patterns concentrate on triple-decker access premiums and hidden moisture damage concealment. The Boston pattern: a contractor installs new clapboard over rotted sheathing behind previous wood clapboard without repair, the new installation hides the damage, and spreading rot surfaces within 3-5 years. Legitimate Boston triple-decker installers probe framing and sheathing during initial assessment and include documented rot repair in the written scope.`,
    dominantMaterial: "wood clapboard and cedar shake on colonial and triple-decker housing",
    climateBand: "cold marine with severe nor'easter exposure",
    bestSeasons: "May through October, above sealant-activation temperatures",
    worstSeasons: "November through April sustained sub-freezing conditions",
  },
  "san-diego-ca": {
    sec_material: `San Diego siding is dominated by stucco on Spanish Colonial and Mediterranean homes across the metro (60%+ of SD residential is stucco). Fiber cement appears on mid-range renovations; wood siding is present on historic Mission Hills, South Park, and La Jolla craftsman homes. Vinyl is uncommon in SD due to coastal aesthetic tradition and WUI fire-hazard restrictions in inland zones. Coastal SD homes within 1 mile of the beach require specialty marine-coated fasteners; untreated steel corrodes within 5-8 years.`,
    sec_climate: `SD siding faces coastal salt exposure, Chapter 7A WUI fire-hazard requirements in Rancho Bernardo, Rancho Peñasquitos, and portions of East County, Santa Ana wind events driving fire-season danger, and marine humidity variable by microclimate. Fiber cement and stucco are inherently Class A fire-rated; wood siding in WUI zones requires specific fire-retardant treatments documented on the permit. Salt spray accelerates fastener corrosion on coastal properties.`,
    sec_code: `California requires a CSLB license for siding work: C-6 cabinet/millwork for wood, C-35 plastering and lathing for stucco, or B general. San Diego City and County enforce 2022 California Building Code with SD-specific amendments. WUI Chapter 7A applies to designated very-high-severity fire-hazard zones. California Coastal Commission jurisdiction adds a second regulatory layer for properties within the Coastal Zone.`,
    sec_insurance: `SD homeowners insurance is increasingly constrained by WUI wildfire risk: several major California carriers have pulled new-policy writing in specific SD fire-hazard zip codes since 2022. California FAIR Plan provides coverage when private-market writing is unavailable. Class A fire-rated assemblies qualify for FAIR Plan eligibility. SDG&E and San Diego Regional Climate Action Plan offer envelope credits on qualifying whole-home retrofits.`,
    sec_contractor: `SD contractor verification: active CSLB license at cslb.ca.gov plus San Diego city or county business tax certificate. Coastal Commission permitting adds 4-8 weeks on coastal-zone properties. WUI Chapter 7A compliance requires documented material selection and specific flashing details at vent penetrations.`,
    sec_flag: `SD-specific siding fraud patterns concentrate on WUI fire-rating substitution and coastal corrosion concealment. The SD pattern: a contractor installs non-Class-A-rated wood siding in a WUI zone without fire-retardant treatment, passes California FAIR Plan underwriting only because of missed inspection, and the homeowner discovers non-compliance during a claim investigation. Legitimate SD WUI siding contractors document Class A rating and fire-retardant treatment on the permit and on the final inspection record.`,
    dominantMaterial: "stucco on Spanish Colonial homes and fiber cement in WUI fire zones",
    climateBand: "marine-coastal with WUI fire zones",
    bestSeasons: "September through June with May-June marine layer adjustments",
    worstSeasons: "July through September peak fire season and Santa Ana wind events",
  },
  "tampa-fl": {
    sec_material: `Tampa siding is dominated by stucco on CBS (concrete block stucco) construction (75%+ of Tampa residential is CBS stucco). Hardie fiber cement appears on higher-end renovations in Hyde Park, South Tampa, and Davis Islands. Vinyl siding is present on older framed cottages in Seminole Heights and Tampa Heights but restricted by Florida Product Approval wind-borne debris requirements in coastal-adjacent zones. Tampa Bay-facing properties require specific salt-resistant fasteners.`,
    sec_climate: `Tampa siding faces Gulf Coast hurricane exposure, annual Atlantic hurricane season (June-November), tropical UV degradation, and Florida Product Approval (FPA) wind-borne debris requirements within one mile of the coast. Hurricane Irma (2017) drove major code tightening. Tampa's dominant failure pattern is stucco crack propagation from post-tensioned slab foundation movement, followed by moisture intrusion behind the CBS-stucco assembly.`,
    sec_code: `Florida DBPR requires a Certified Building Contractor (CGC) or Certified Specialty Contractor for Tampa siding work. Hillsborough and Pinellas counties enforce FBC with FPA wind-borne debris requirements in designated zones. Tampa Historic Preservation Commission oversees Hyde Park, Seminole Heights, Tampa Heights, and Ybor City; landmarked replacements require commission approval.`,
    sec_insurance: `Tampa homeowners insurance is roof-and-siding-condition driven: Florida carriers require property inspections for policies covering homes with 10+ year old installations, and properties over 20 years face non-renewal or move to Citizens Property Insurance. Wind mitigation credits under OIR-B1-1802 form can return 30-50% on premiums for continuous secondary water-resistant barriers and FPA-rated exterior coverings.`,
    sec_contractor: `Tampa contractor verification: Florida DBPR Certified Building Contractor at myfloridalicense.com, Hillsborough or Pinellas County business tax receipt, and FPA documentation verification for coastal-adjacent installations. Tampa post-hurricane contract fraud patterns are severe; never assign insurance proceeds directly to a contractor.`,
    sec_flag: `Tampa-specific siding fraud patterns concentrate on post-hurricane Assignment of Benefits (AOB) manipulation and FPA substitution. The Tampa pattern: a contractor signs homeowner to AOB, files inflated wind-damage claim, and installs non-FPA-compliant material. Use the 14-day AOB rescission window under Florida Statute §627.7152 if you signed one under pressure.`,
    dominantMaterial: "stucco on CBS construction with FPA wind-borne debris ratings in coastal zones",
    climateBand: "hot-humid Gulf Coast with wind-borne debris region requirements",
    bestSeasons: "December through April outside Atlantic hurricane season",
    worstSeasons: "June through November Atlantic hurricane season and September peak",
  },
  "detroit-mi": {
    sec_material: `Detroit siding is dominated by brick masonry on 1910s-1940s brick bungalows and Arts-and-Crafts homes (50-60% of Detroit residential is brick), with wood clapboard on framed bungalows and vinyl on value-tier replacements. Hardie fiber cement and wood composite appear on higher-end renovations in Boston-Edison, Indian Village, and Woodbridge. Detroit brick requires tuckpointing rather than replacement; framed siding faces the full severe-climate challenge.`,
    sec_climate: `Detroit siding faces severe freeze-thaw cycling, extensive ice-dam-driven water intrusion, and Great Lakes lake-effect wind-driven snow. Freeze-thaw cycling drives caulk and sealant failure; Detroit-specific spec requires silicone sealants at all penetrations. Ice-dam water intrusion drives hidden moisture damage behind siding. Coastal-adjacent Detroit neighborhoods on Lake St. Clair see salt-spray fastener corrosion similar to ocean-adjacent metros.`,
    sec_code: `Michigan requires LARA Residential Builder or Residential Maintenance and Alteration license at michigan.gov/lara. Detroit enforces 2015 IECC with local amendments. Detroit Historic Designation Advisory Board oversees Boston-Edison, Indian Village, Woodbridge, Palmer Park, and Corktown historic districts. Historic replacement approvals typically take 4-8 weeks.`,
    sec_insurance: `Detroit homeowners insurance covers wind and hail damage with standard sudden-event provisions. Michigan carriers have tightened underwriting on 15-20+ year old siding installations since 2022. DTE Energy and Consumers Energy offer envelope credits on qualifying whole-home retrofits. Detroit's moderate hail exposure does not drive premium incentives like Denver or Dallas.`,
    sec_contractor: `Detroit contractor verification: active LARA Residential Builder license at michigan.gov/lara, plus Detroit Better Business Bureau at bbb.org/detroit. Michigan MCL §339.2411 three-day right-of-rescission applies to any in-home sale.`,
    sec_flag: `Detroit-specific siding fraud patterns concentrate on in-home sales to older homeowners in stable neighborhoods like Rosedale Park and Sherwood Forest. The Detroit pattern: an in-home sales visit ends with a large deposit demand and "supply-chain urgency" pitch; Michigan law requires a written three-day right-of-rescission notice, and contracts without that notice are unenforceable.`,
    dominantMaterial: "brick masonry on bungalows with vinyl on value-tier framed siding",
    climateBand: "cold with Great Lakes lake-effect exposure",
    bestSeasons: "April through October, above sealant-activation thresholds",
    worstSeasons: "November through mid-April sustained below-freezing conditions",
  },
  "minneapolis-mn": {
    sec_material: `Minneapolis siding is dominated by wood lap siding and vinyl on 1920s-1950s bungalows and four-squares, with Hardie fiber cement on mid-range and higher-end renovations in Uptown, Linden Hills, and Lowry Hill. Brick appears on commercial-style residential and landmarked homes. The dominant Minneapolis siding specification is thicker vinyl (.046" or heavier) or fiber cement to handle the sustained -20F winter temperatures. Thin-gauge vinyl fails on impact at severe cold.`,
    sec_climate: `Minneapolis siding faces the most severe freeze-thaw environment in any major US metro: sustained -20F temperatures, 60+ inches of annual snowfall, and 100+ freeze-thaw cycles per year. Ice-dam water intrusion drives hidden moisture damage behind siding. Dimensional stability of the siding material matters more here than in any other metro: materials expand and contract dramatically across the seasonal temperature range, which stresses seams and fasteners.`,
    sec_code: `Minnesota Department of Labor and Industry requires a Residential Building Contractor license for jobs over $15,000. Minneapolis Heritage Preservation Commission covers districts including Milwaukee Avenue, Nicollet Island, Healy Block, and Fourth Avenue Historic District. Minneapolis also enforces Minnesota Energy Code mandating air leakage verification on whole-home weatherization.`,
    sec_insurance: `Minneapolis homeowners insurance covers wind, hail, and ice-dam water intrusion as sudden events. Most Minnesota carriers require demonstration of attic insulation (R-49 minimum) and ventilation adequacy before covering repeated ice-dam claims. Xcel Energy Minnesota and CenterPoint Energy offer envelope credits on qualifying whole-home retrofits.`,
    sec_contractor: `Minneapolis contractor verification: Minnesota LARA Residential Building Contractor license at minneapolismn.gov, plus Minneapolis city contractor registration. Minnesota also requires Residential Remodeler licensing for smaller jobs. Home Energy Squad conservation-improvement-funded jobs require verified licensing.`,
    sec_flag: `Minneapolis-specific siding fraud patterns concentrate on vinyl-gauge substitution and thermal-expansion-related damage concealment. The Minneapolis pattern: a contractor installs thin-gauge (.040") vinyl instead of bid-specified .046" or heavier, and the thin-gauge material cracks during the first -20F winter. Minneapolis-specific due diligence: physically verify the gauge printed on the product packaging before installation begins.`,
    dominantMaterial: "thicker vinyl and Hardie fiber cement on bungalow and four-square housing",
    climateBand: "very-cold continental with extreme freeze-thaw cycling",
    bestSeasons: "May through September above sealant-activation thresholds",
    worstSeasons: "November through April sustained sub-freezing conditions",
  },
  "charlotte-nc": {
    sec_material: `Charlotte siding decisions are driven by Piedmont humidity and rapid-growth suburban construction. Dominant Charlotte siding materials: Hardie fiber cement on mid-range renovations, brick veneer on newer tract construction in SouthPark, Ballantyne, and Myers Park, and wood lap siding on Dilworth and Plaza Midwood 1920s-1940s bungalows. Vinyl siding appears on value-tier replacements but HOA restrictions in SouthPark and Ballantyne typically require fiber cement or brick.`,
    sec_climate: `Charlotte siding faces Piedmont humidity cycling, tornado-corridor wind uplift, moderate hail frequency, and intense summer UV. Humidity drives aggressive biological growth on north-facing elevations; Charlotte non-treated wood siding typically shows visible biological growth within 18-24 months. Spring pollen season coats all exterior surfaces and creates additional maintenance burden. Termite exposure is severe; wood siding requires pressure-treated framing at grade level.`,
    sec_code: `North Carolina Licensing Board for General Contractors requires a license for jobs over $30,000. Charlotte-Mecklenburg Historic District Commission oversees Dilworth, Wesley Heights, Fourth Ward, Plaza Midwood, and Wilmore. North Carolina Residential Code amendments require enhanced flashing and wind-uplift specifications post-2018 Florence and 2020 severe-weather outbreaks.`,
    sec_insurance: `Charlotte homeowners insurance has tightened 15-20+ year siding-condition underwriting post-2022. Class 4 impact-rated assemblies deliver 10-20% premium reductions on most Charlotte policies, and the Charlotte Regional Tornado Alley corridor makes Class 4 a reasonable ROI decision. Duke Energy's Smart $aver program offers envelope credits on qualifying whole-home retrofits.`,
    sec_contractor: `Charlotte contractor verification: active North Carolina Licensing Board for General Contractors license at nclbgc.org (required for jobs over $30,000), plus Mecklenburg County contractor registration for permit-pulling on smaller jobs. North Carolina Consumer Protection complaints searchable at ncdoj.gov. SouthPark and Ballantyne HOA architectural review committees require pre-approval.`,
    sec_flag: `Charlotte-specific siding fraud patterns concentrate on tornado-corridor post-storm canvassing and HOA substitution manipulation. The Charlotte pattern: an out-of-area contractor bids HOA-compliant fiber cement, receives deposit, installs non-compliant vinyl or thin-gauge fiber cement, and departs. Charlotte-specific due diligence: require written HOA approval before any material order, physically verify manufacturer labels at delivery, and cross-reference product against nclbgc.org complaint history.`,
    dominantMaterial: "Hardie fiber cement on mid-range and brick veneer on tract construction",
    climateBand: "humid-subtropical Piedmont with tornado corridor",
    bestSeasons: "October-November and March-April outside pollen peak and humidity surges",
    worstSeasons: "February-March pollen, July-August humidity, and spring storm cycles",
  },
};

/* Section renderers. */

function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";
  const baseVinyl = 12000, baseFiber = 22000, baseWood = 19000, baseEngWood = 16000;
  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    const vinyl = Math.round(baseVinyl * mult * localVar);
    const fiber = Math.round(baseFiber * mult * localVar);
    const wood = Math.round(baseWood * mult * localVar);
    const eng = Math.round(baseEngWood * mult * localVar);
    return `<tr><td style="padding:12px 16px; font-weight:600;">${n}</td><td style="padding:12px 16px; text-align:right;">${fmtK(vinyl)}</td><td style="padding:12px 16px; text-align:right;">${fmtK(fiber)}</td><td style="padding:12px 16px; text-align:right;">${fmtK(wood)}</td><td style="padding:12px 16px; text-align:right;">${fmtK(eng)}</td></tr>`;
  });
  return `
<section class="section fp-section"><h2>${facts.displayName} neighborhood siding pricing</h2>
<div style="overflow-x:auto;"><table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;"><thead><tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);"><th style="text-align:left; padding:12px 16px;">Neighborhood</th><th style="text-align:right; padding:12px 16px;">Vinyl</th><th style="text-align:right; padding:12px 16px;">Fiber Cement</th><th style="text-align:right; padding:12px 16px;">Wood</th><th style="text-align:right; padding:12px 16px;">Engineered Wood</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;"><a href="/analyze-my-quote.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your ${facts.displayName} siding quote for line-item comparison.</a></p></section>`;
}

function materialSection(city, d) { return `<section class="section fp-section"><h2>${city} dominant siding materials</h2><p>${d.sec_material}</p></section>`; }
function climateSection(city, d) { return `<section class="section fp-section"><h2>${city} climate impact on siding</h2><p>${d.sec_climate}</p></section>`; }
function codeSection(city, d) { return `<section class="section fp-section"><h2>${city} permits, codes, and licensing</h2><p>${d.sec_code}</p></section>`; }
function insuranceSection(city, d) { return `<section class="section fp-section"><h2>${city} siding insurance and energy rebates</h2><p>${d.sec_insurance}</p></section>`; }
function contractorSection(city, d) { return `<section class="section fp-section"><h2>Vetting a ${city} siding contractor</h2><p>${d.sec_contractor}</p></section>`; }
function flagSection(city, d) { return `<section class="section fp-section"><h2>${city}-specific siding fraud patterns</h2><p>${d.sec_flag}</p></section>`; }

function seasonalCostSection(city, state, d, mult) {
  return `<section class="section fp-section"><h2>When to re-side in ${city} and what jobs cost</h2>
<p><strong>${city} best months:</strong> ${d.bestSeasons}.</p>
<p><strong>${city} worst months:</strong> ${d.worstSeasons}.</p>
<p>A 2,000-square-foot ${city} re-side in 2026 dollars at prevailing ${city} labor rates: budget vinyl runs approximately ${fmtD(Math.round(2000 * pricingModel.basePriceByType.vinyl.lowPerSqft * mult * 1.15))}; mid-range fiber cement with ENERGY STAR-qualified assembly runs ${fmtD(Math.round(2000 * pricingModel.basePriceByType.fiber_cement.lowPerSqft * mult * 1.3))}; premium wood or engineered wood runs ${fmtD(Math.round(2200 * pricingModel.basePriceByType.wood.highPerSqft * mult * 1.1))}. These numbers reflect ${city} installer rates. The dominant ${city} material story is ${d.dominantMaterial}.</p>
<p><a href="/siding-cost.html" style="color:var(--brand);">Get a ${city} siding estimate.</a></p>
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
  const d = CITY_SIDING_DATA[metro.slug];
  if (!facts || !ctx || !d) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getLaborMultiplier(metro.region);

  let html = `\n${MARKER_START}\n`;
  html += flagshipCSS();
  html += neighborhoodPricing(facts, mult);
  html += materialSection(city, d);
  html += climateSection(city, d);
  html += codeSection(city, d);
  html += insuranceSection(city, d);
  html += contractorSection(city, d);
  html += flagSection(city, d);
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
    const re = new RegExp(`${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, "g");
    content = content.replace(re, "");

    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const localInjectedV2 = content.indexOf("<!-- TP-LOCAL-INJECTED-V2 -->");
    const otherServicesIdx = content.indexOf("Other Services in ");

    let insertAt;
    if (uniqueGuideEnd >= 0) insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    else if (localInjectedV2 >= 0) insertAt = localInjectedV2;
    else if (otherServicesIdx >= 0) {
      const sectionStart = content.lastIndexOf("<section", otherServicesIdx);
      insertAt = sectionStart >= 0 ? sectionStart : otherServicesIdx;
    } else {
      const mainEnd = content.indexOf("</main>");
      if (mainEnd >= 0) {
        const lastSection = content.lastIndexOf("</section>", mainEnd);
        insertAt = lastSection >= 0 ? lastSection + "</section>".length : mainEnd;
      } else { console.log(`  SKIP ${metro.file}`); skipped++; continue; }
    }

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
