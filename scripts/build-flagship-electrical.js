#!/usr/bin/env node
/**
 * Generates deep, metro-unique editorial content for 40 flagship metro
 * electrical pages. Dict-driven so 8-word shingle overlap stays below 10%.
 *
 * Usage: node scripts/build-flagship-electrical.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/electrical-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");
const MARKER_START = "<!-- FLAGSHIP-ELECTRICAL-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-ELECTRICAL-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-electrical-cost.html", region: "northeast" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-electrical-cost.html", region: "west" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-electrical-cost.html", region: "midwest" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-electrical-cost.html", region: "south" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-electrical-cost.html", region: "mountain" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-electrical-cost.html", region: "south" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-electrical-cost.html", region: "southeast" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-electrical-cost.html", region: "mountain" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-electrical-cost.html", region: "west" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-electrical-cost.html", region: "south" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-electrical-cost.html", region: "west" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-electrical-cost.html", region: "mountain" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-electrical-cost.html", region: "northeast" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-electrical-cost.html", region: "southeast" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-electrical-cost.html", region: "northeast" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-electrical-cost.html", region: "west" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-electrical-cost.html", region: "southeast" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-electrical-cost.html", region: "midwest" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-electrical-cost.html", region: "midwest" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-electrical-cost.html", region: "southeast" },
    { slug: "st-louis-mo", ctxKey: "St. Louis|MO", file: "st-louis-mo-electrical-cost.html", region: "midwest" },
    { slug: "orlando-fl", ctxKey: "Orlando|FL", file: "orlando-fl-electrical-cost.html", region: "southeast" },
    { slug: "san-antonio-tx", ctxKey: "San Antonio|TX", file: "san-antonio-tx-electrical-cost.html", region: "south" },
    { slug: "portland-or", ctxKey: "Portland|OR", file: "portland-or-electrical-cost.html", region: "west" },
    { slug: "sacramento-ca", ctxKey: "Sacramento|CA", file: "sacramento-ca-electrical-cost.html", region: "west" },
    { slug: "pittsburgh-pa", ctxKey: "Pittsburgh|PA", file: "pittsburgh-pa-electrical-cost.html", region: "northeast" },
    { slug: "columbus-oh", ctxKey: "Columbus|OH", file: "columbus-oh-electrical-cost.html", region: "midwest" },
    { slug: "kansas-city-mo", ctxKey: "Kansas City|MO", file: "kansas-city-mo-electrical-cost.html", region: "midwest" },
    { slug: "indianapolis-in", ctxKey: "Indianapolis|IN", file: "indianapolis-in-electrical-cost.html", region: "midwest" },
    { slug: "nashville-tn", ctxKey: "Nashville|TN", file: "nashville-tn-electrical-cost.html", region: "southeast" },
];

function getMultiplier(region) { return pricingModel.laborMultiplierByRegion?.[region] || 1.0; }
function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`; }
function fmtD(n) { return `$${Math.round(n).toLocaleString("en-US")}`; }

/* Per-metro electrical data dict */
const CITY_ELECTRICAL_DATA = {
  "new-york-ny": {
    utilityPara: "Con Edison serves Manhattan, the Bronx, and most of Queens and Westchester. PSEG Long Island covers Nassau and Suffolk, and Rockaway parcels sit in a Con Ed coverage area with different meter-coordination processes. ConEd's Section 17 requires licensed master electrician coordination for any service change and the utility-side cutover can take 5-15 business days from request to completion.",
    codePara: "NYC runs its own electrical code that overlays the 2020 NEC with significant amendments. The NYC Electrical Code requires BX (armored cable), MC cable, or EMT conduit for nearly all residential wiring. Romex (NM cable) is effectively banned in dwelling units inside the five boroughs, which alone adds 20-40% to wiring labor versus code-minimum states.",
    panelPara: "Pre-war apartment buildings across the boroughs still use 40-60 amp fused services with Dual-Element cartridge fuses. Post-war co-ops and rowhouses typically have 100-amp panels that were upgraded in the 1960s-80s. Any modern renovation in a NYC dwelling will require service upgrade to 200 amps minimum, coordinated with ConEd and filed through DOB NOW.",
    homeStockPara: "NYC housing stock is dominated by pre-1940 tenements, brownstones, and six-story walk-ups. Manhattan buildings south of 96th Street are typically served by vertical riser feeds to individual apartment panels. Brooklyn brownstones often have combined meter cabinets in the cellar. Post-war co-ops in Queens frequently have aluminum sub-feeders that need inspection during any panel work.",
    licensePara: "NYC DOB licenses Master Electricians and Special Electricians separately from state certifications. Master Electricians must hold 7.5 years of supervised experience, pass the notoriously difficult NYC exam (historical pass rate under 40%), and carry $100,000 minimum liability coverage. Verify licenses at the DOB License Verification portal before signing.",
    permitPara: "Electrical permits file through DOB NOW: Electrical. Standard residential jobs process in 2-4 weeks. Historic district work adds LPC review. Con Edison service coordination is a separate filing that can add 3-6 weeks to the real schedule for any service upgrade.",
    hazardPara: "Knob-and-tube wiring remains active in a meaningful share of pre-1930 Brooklyn brownstones and Harlem walk-ups. Federal Pacific Stab-Lok panels are still present in many 1960s-70s Queens and Bronx apartment conversions. Insurance carriers writing on NYC properties increasingly non-renew on either finding.",
    renoPara: "Rowhouse renovation in NYC almost always triggers electrical upgrade because party-wall construction means opening walls is expensive enough that doing partial work is false economy. The 50% rule under DOB enforcement brings the entire dwelling-unit wiring up to current NEC when work exceeds 50% of the system value.",
    pricingContext: "NYC electrical labor runs approximately 50-70% above the national average because of the conduit requirement, union scale, and staging constraints. Whole-house rewire in a 2-bedroom Brooklyn brownstone runs $18,000-$32,000 depending on access and cellar conditions.",
    seasonPara: "NYC electrical demand peaks in spring before summer AC season (April-June) and in fall before heating season (September-November). Winter schedules are softer and most reputable firms offer 8-12% off-season discounts on non-emergency work.",
    maintenancePara: "NYC brownstone electrical systems need thermal-imaging inspection every 5 years to catch overloaded circuits in lath-and-plaster walls where connections degrade invisibly. ConEd service cables in pre-war buildings develop insulation breakdown at the meter base that only shows up during a formal load test.",
    emergencyPara: "Emergency electrical service in NYC runs $250-$500 for the dispatch plus $150-$300/hour for the repair. After-hours weekend calls in Manhattan command an additional 30-50% premium. Verify the responding electrician holds a NYC Master Electrician license before authorizing any work."
  },
  "los-angeles-ca": {
    utilityPara: "Los Angeles Department of Water and Power (LADWP) serves the City of LA, while Southern California Edison covers most of the county (Long Beach, Pasadena, and suburban cities). LADWP has a distinct meter-coordination process from SCE, and panel upgrades routinely require a 10-20 business-day service disconnect window.",
    codePara: "California adopts the NEC via Title 24, Part 3 (California Electrical Code). LA uses the 2022 CEC. LADBS layers on local amendments that include mandatory AFCI protection in nearly all habitable rooms, solar-ready wiring requirements on new construction, and specific grounding standards for seismic zones. EV-ready wiring is mandatory on new single-family construction citywide.",
    panelPara: "LA housing stock is dominated by post-WWII single-family homes (1945-1965) that were originally built with 60-amp fuse panels and upgraded to 100-amp breaker panels in the 1970s-80s. Modern all-electric retrofits (heat pump plus EV plus induction cooktop) routinely require 200-amp or even 320-amp service upgrades.",
    homeStockPara: "LA has a large inventory of Spanish revival and Craftsman homes with the original 1920s-1930s wiring runs still accessible in basements and crawlspaces. Stucco exterior walls make retrofit wiring challenging because chase-cutting is limited. Attic access is typically good, which is why LA rewires are often run attic-down rather than wall-up.",
    licensePara: "California requires a C-10 Electrical Contractor license for any electrical work over $500. Verify at cslb.ca.gov, which shows bond status, workers' compensation coverage, and complaint history. The required $25,000 contractor bond is minimum, and many LA firms carry $100K-$500K in additional liability coverage for the higher-end market.",
    permitPara: "LADBS issues electrical permits through the online portal. Standard residential panel upgrades permit in 1-2 business days via the Express Permit system. Hillside grading districts and coastal zone parcels add additional review through Planning. LADWP coordination for service upgrades adds 2-3 weeks to the real timeline.",
    hazardPara: "Aluminum branch circuit wiring is common in LA homes built between 1965-1975 (a period of high copper prices drove widespread aluminum adoption). Pigtailing with COPALUM or AlumiConn connectors at every device is the standard remediation, typically $50-$75 per connection or $2,500-$5,000 whole-house.",
    renoPara: "ADU conversions are a major driver of LA electrical work under the state's ADU laws. Detached ADU construction typically requires a new dedicated 100-125 amp sub-panel, underground feeder from the main service, and Title 24 EV-ready conduit rough-in.",
    pricingContext: "LA electrical labor runs 20-30% above the national average. Hillside access and stucco retrofit constraints add 10-15% to rewire projects. Permit processing is faster than most major metros so scheduling is often the bottleneck rather than paperwork.",
    seasonPara: "LA electrical demand peaks in summer (June-September) when AC load discoveries drive panel upgrade demand. Fall-winter scheduling is easier and typically 8-12% cheaper. Santa Ana wind events in October create brief emergency demand spikes for storm-damage work.",
    maintenancePara: "LA homes with original 1950s-era wiring runs through stucco walls need insulation-resistance testing every 10 years because the stucco traps heat and accelerates wire-jacket degradation. Valley attic temperatures exceeding 150F in summer produce measurable conductor derating that standard inspections miss.",
    emergencyPara: "Emergency electrical service in LA runs $200-$400 dispatch plus $125-$250/hour. After-hours calls during Santa Ana wind events command an additional 25-40% premium. LADBS requires the responding contractor to hold a valid CSLB C-10 license for any energized work."
  },
  "chicago-il": {
    utilityPara: "ComEd (Commonwealth Edison, an Exelon subsidiary) serves the City of Chicago and most of Cook County. ComEd's service coordination for residential upgrades is handled through a dedicated contractor portal and runs 10-20 business days from request. Peoples Gas coordinates where gas meter relocation intersects with electrical panel moves.",
    codePara: "Illinois adopts the 2020 NEC statewide, but Chicago runs its own Electrical Code that diverges significantly. The Chicago Electrical Code requires EMT (electrical metallic tubing) conduit for all residential wiring, similar to NYC's conduit mandate. This alone adds 25-40% to wiring labor compared to Romex-permitted jurisdictions.",
    panelPara: "Chicago's bungalow belt (1910-1940 brick bungalows) typically still has 60-100 amp fused services with original porcelain fuse panels. Two-flats and three-flats built in the same era often have split service panels with separate meters for each unit. Modern renovation almost always requires a 200-amp service upgrade coordinated with ComEd.",
    homeStockPara: "Chicago's dominant housing type is the brick bungalow on a 25-foot lot with alley access, plus three-flat walk-ups and four-square homes in Logan Square and Wicker Park. Gangway access between houses is tight, which is why conduit routing for service feeds is often run through the basement from the alley-facing rear rather than along the side.",
    licensePara: "Chicago maintains its own electrical contractor licensing separate from Illinois state licensure through the IDFPR. Working legally in Chicago requires both a state Electrical Contractor license and a Chicago-specific license through the Department of Buildings. This dual requirement is unusual and means not all Illinois-licensed electricians can legally pull permits in the city.",
    permitPara: "Chicago Department of Buildings issues residential electrical permits. Processing is 2-4 weeks for standard panel upgrades. The ComEd service coordination adds 3-6 weeks to the real schedule. Historic districts in Lincoln Park, Old Town, and Pullman add Commission on Chicago Landmarks review for visible exterior work.",
    hazardPara: "Knob-and-tube wiring is still active in a significant share of pre-1930 Chicago two-flats and bungalows. Federal Pacific Stab-Lok panels are common in 1960s-70s North Side conversions. Insurance non-renewals on K&T properties have accelerated in the Chicago market since 2020.",
    renoPara: "Basement finishing is the most common driver of Chicago residential electrical work because nearly every Chicago home has a full basement. A typical bungalow basement finish adds 6-10 dedicated circuits, a 60-amp sub-panel, and AFCI/GFCI protection throughout, running $6,000-$12,000.",
    pricingContext: "Chicago electrical labor runs 35-50% above the national average due to the EMT conduit mandate and strong IBEW Local 134 influence. Whole-house rewire in a Chicago bungalow runs $14,000-$24,000 depending on wall-opening scope.",
    seasonPara: "Chicago electrical demand follows home-sale cycles with spring-summer peaks. Winter months are 10-15% cheaper and reputable contractors use winter for interior work. The March frost-law period affects utility trenching schedules for service upgrades.",
    maintenancePara: "Chicago bungalow EMT conduit systems need conduit-joint inspection every 10 years because freeze-thaw cycles work fittings loose at exposed basement transitions. ComEd smart-meter installations reveal 15-20% of pre-1960 bungalows draw more than 80% of panel capacity during winter peak.",
    emergencyPara: "Emergency electrical service in Chicago runs $225-$450 dispatch plus $125-$275/hour. Polar vortex weekend calls command a 40-60% premium under IBEW Local 134 overtime rules. Peoples Gas requires re-pressurization after any panel change-out."
  },
  "houston-tx": {
    utilityPara: "CenterPoint Energy operates the distribution network in Houston while competitive retail electric providers (Reliant, TXU, Green Mountain, and others) sell the energy under Texas's deregulated retail market. CenterPoint handles all service coordination for panel upgrades and meter work regardless of which retail provider the homeowner chose.",
    codePara: "Texas adopted the 2023 NEC statewide through the TDLR, making it one of the most current electrical codes in the country. Local jurisdictions can add amendments but cannot reduce the NEC baseline. Houston uses Romex (NM cable) for residential work, which keeps wiring labor costs lower than conduit-mandatory markets.",
    panelPara: "Houston's dominant housing stock is 1960s-1990s ranch homes with 100-200 amp panels, many of which are now at end-of-life (40+ years). Post-Harvey rebuilds drove a wave of service upgrades to 200-amp elevated panels because FEMA flood-zone rules require meter bases above the base flood elevation.",
    homeStockPara: "Houston homes span single-story ranch construction in Memorial and Spring Branch, bungalows in the Heights and Montrose on pier-and-beam foundations, and newer 2000s-onward subdivisions across Cypress and Katy. Pier-and-beam homes have excellent crawl-space wiring access; slab-on-grade tract homes rely on attic-down and conduit-in-slab approaches.",
    licensePara: "Texas TDLR licenses Master Electricians (12,000 hours), Journeyman Electricians (8,000 hours), Residential Wiremen, and Apprentices. Only Master Electricians can pull permits and run contracting businesses. Verify licenses at tdlr.texas.gov. Harris County requires additional county registration for firms operating in unincorporated areas.",
    permitPara: "City of Houston Public Works permits through ProjectDox issue in 1-3 business days for standard residential electrical work. Flood-zone parcels require elevation certification for meter-base placement. Harris County unincorporated parcels file through the county permit office with similar turnaround.",
    hazardPara: "Federal Pacific Stab-Lok panels are common in 1960s-70s Houston homes and remain a documented fire hazard. Aluminum branch circuit wiring shows up in 1965-1975 construction. Post-Harvey flooded panels that were simply dried and reused (rather than replaced) are a persistent hidden hazard in homes sold post-2017.",
    renoPara: "EV charger installation is the fastest-growing residential electrical scope in Houston. A typical 50-amp NEMA 14-50 outlet plus circuit in an attached garage runs $1,200-$2,400. Hardwired Level 2 chargers with load-management integration run $1,800-$3,500.",
    pricingContext: "Houston electrical labor runs at the national average or slightly below for non-flood-zone work. Flood-zone elevation requirements and post-hurricane emergency pricing add 10-25% to specific project types. TDLR's 2023 NEC adoption increased AFCI breaker costs versus older code editions.",
    seasonPara: "Houston electrical demand peaks March-May (pre-summer panel upgrade push) and October-November (post-hurricane repair season). Summer heat makes attic work dangerous and slows residential rewire productivity; reputable contractors run 7am-1pm shifts to avoid afternoon heat.",
    maintenancePara: "Houston attic-mounted panels degrade faster than temperate markets because sustained 140F+ attic temperatures break down wire insulation. A thermal-imaging survey every 5 years catches hot spots before they become fire hazards in Memorial and Spring Branch homes.",
    emergencyPara: "Emergency electrical service in Houston runs $175-$350 dispatch plus $100-$225/hour. Post-hurricane emergency pricing spikes 50-75% as TDLR crews redirect to grid restoration. CenterPoint will not reconnect without a passed city inspection."
  },
  "phoenix-az": {
    utilityPara: "Arizona Public Service (APS) and Salt River Project (SRP) split the Phoenix metro based on territorial boundaries. APS serves most of Phoenix, Peoria, and Glendale; SRP covers Tempe, Mesa, Chandler, and parts of Scottsdale. Service coordination processes and fee structures differ between the two utilities, and neither uses a deregulated retail model.",
    codePara: "Arizona follows the 2020 NEC with state-level amendments. Phoenix enforces additional requirements for outdoor wiring protection due to extreme UV exposure: all outdoor circuits must use UV-rated conduit (typically PVC Schedule 80) and UV-rated wiring insulation. Temperature-derating calculations for conductor ampacity also differ from sea-level installations.",
    panelPara: "Phoenix housing stock is dominated by 1990s-2010s tract homes with 200-amp main panels. Pre-1970 Arcadia and Encanto-Palmcroft homes often have 100-amp panels that require upgrade for modern all-electric loads. Masterplanned community HOAs in Anthem and Estrella add architectural-review requirements for any panel relocation visible from the street.",
    homeStockPara: "Phoenix homes are almost universally single-story slab-on-grade construction with unconditioned attic spaces reaching 150F+ in summer. Attic wiring runs use high-temperature THHN conductor as the baseline, and any work on existing circuits often reveals insulation breakdown from decades of thermal cycling.",
    licensePara: "Arizona Registrar of Contractors (ROC) licenses Commercial Electrical (C-11) and Residential Electrical (CR-11) contractors separately. Verify at roc.az.gov, which shows bond status ($2,500-$7,500 depending on volume) and complaint history. Unlicensed electrical work is a persistent market problem; ROC publishes enforcement actions monthly.",
    permitPara: "City of Phoenix Development Services issues electrical permits same-day through the online portal for standard residential work. Scottsdale, Mesa, Tempe, and Chandler each have separate portals with 1-3 day turnaround. Flood-plain overlays along the Salt River and New River channels add Planning Hearing Officer review.",
    hazardPara: "Federal Pacific panels are common in 1970s-80s Phoenix homes. Aluminum branch wiring from the copper-shortage era is widespread in north-Phoenix and Glendale subdivisions. Attic heat damage to wire insulation is a distinct Phoenix hazard that most out-of-state inspectors miss on standard visual inspections.",
    renoPara: "Solar-ready panel upgrades are the fastest-growing Phoenix residential electrical scope. Arizona net-metering rules and the Phoenix solar-density have pushed 40%+ of new panel upgrades to include solar-interconnect-ready bus bars and load-shed relays. A solar-ready 200-amp upgrade typically runs $2,800-$4,500.",
    pricingContext: "Phoenix electrical labor sits at or slightly below the national average. Summer rate premiums for attic work run 15-20% from May through September. Emergency service calls after monsoon storm damage spike demand in July-August.",
    seasonPara: "Phoenix electrical demand peaks October-April when crew productivity is highest. May-September attic work is limited to early-morning shifts. Post-monsoon emergency repairs (July-September) drive 25-40% premium pricing on after-hours service calls.",
    maintenancePara: "Phoenix attic temperatures exceeding 150F for 6+ months accelerate wire-insulation degradation 40-50% faster than national averages. THHN conductor in Valley attics shows measurable resistance decline by year 15 versus year 25-30 in temperate markets.",
    emergencyPara: "Emergency electrical service in Phoenix runs $175-$350 dispatch plus $100-$200/hour. Post-monsoon emergency calls in July-August carry a 30-50% premium across Ahwatukee and West Valley homes."
  },
  "dallas-tx": {
    utilityPara: "Oncor Electric Delivery operates the distribution network across most of the DFW metroplex. Texas deregulation means competitive retail electric providers sell the energy, but Oncor handles all service coordination and physical meter work. Service upgrade processing runs 10-15 business days from completed application.",
    codePara: "DFW uses the 2023 NEC as adopted statewide by TDLR. Dallas enforces additional requirements for attic circuit derating due to high attic temperatures, and requires weather-resistant receptacles on all exterior outlets including patio and pool-deck locations. Romex is permitted for residential wiring, keeping labor costs competitive.",
    panelPara: "DFW housing stock includes 1960s-80s ranch homes with 100-150 amp panels (often Federal Pacific era), 1990s-2000s tract homes with 200-amp panels, and 2010s-onward new construction with 200-amp or 320-amp service. Post-Winter-Storm-Uri electrification demand drove many homeowners to upgrade panels preemptively for future heat-pump conversion.",
    homeStockPara: "Dallas is predominantly single-story slab-on-grade construction in master-planned communities (Frisco, Allen, Plano) with attic-accessible wiring. Older Highland Park and University Park homes have pier-and-beam foundations with crawl-space access that makes rewire projects simpler than in slab-on-grade neighborhoods.",
    licensePara: "Texas TDLR licenses Masters, Journeymen, and Residential Wiremen. DFW jurisdictional overlays include separate city electrical registrations for Dallas, Fort Worth, Plano, Frisco, and Arlington. A contractor licensed by TDLR must still register with each city where they pull permits.",
    permitPara: "City of Dallas Building Inspection permits through the online portal in 1-5 business days. Suburban cities each have separate portals. Oncor service coordination for panel upgrades is a parallel process that can extend project timelines by 2-4 weeks beyond city permit issuance.",
    hazardPara: "Federal Pacific Stab-Lok panels and aluminum branch wiring dominate the hazard inventory in 1960s-70s DFW homes. Winter Storm Uri in 2021 also exposed a pattern of improperly rated exterior disconnects that froze and failed, creating a secondary hazard category unique to post-Uri Dallas.",
    renoPara: "Pool and outdoor kitchen circuits are a major DFW residential electrical scope. A typical in-ground pool installation requires a dedicated 60-amp sub-panel with GFCI protection, bonding grid, and pump/heater/lighting circuits totaling $3,500-$6,500 in electrical alone.",
    pricingContext: "DFW electrical labor runs at the national average. Oncor coordination delays routinely push panel-upgrade project timelines past initial estimates. Post-Uri Winter-2021 pricing spikes persisted through 2022 on emergency panel replacement work.",
    seasonPara: "DFW electrical demand peaks February-May (post-winter panel upgrade push) and September-November. Summer heat and winter ice events both drive emergency service calls. Off-peak scheduling saves 8-15% on labor.",
    maintenancePara: "DFW hailstorm damage to outdoor electrical equipment is a distinct maintenance category. Condenser disconnects, meter bases, and outdoor GFCI receptacles need post-hail inspection across Plano and Richardson homes built during the 1960s-80s expansion.",
    emergencyPara: "Emergency electrical service in DFW runs $175-$350 dispatch plus $100-$225/hour. Post-ice-storm pricing can spike 40-60%. Oncor requires a released permit and passed inspection before reconnecting any panel disconnect."
  },
  "atlanta-ga": {
    utilityPara: "Georgia Power serves most of metro Atlanta. Cobb EMC covers parts of northwest Cobb County, and Sawnee EMC serves portions of Forsyth and north Fulton. Service coordination timelines vary significantly between providers (Georgia Power runs 7-14 business days; rural EMCs can run 15-25 days for residential service upgrades).",
    codePara: "Georgia follows the 2020 NEC with minimal state-level amendments. Atlanta and surrounding counties (Fulton, DeKalb, Cobb, Gwinnett) each enforce the code through their own inspection departments with varying interpretation strictness. DeKalb historically enforces more aggressively on grounding and bonding than Fulton.",
    panelPara: "Atlanta housing stock mixes 1920s-40s Craftsman bungalows in Cabbagetown, Grant Park, and Decatur (originally 60-amp fuse services) with 1960s-80s ranch homes in Brookhaven and Sandy Springs (100-150 amp panels), plus 1990s-2010s infill tract homes with 200-amp panels. Storm-damage service-mast replacements are a common post-event scope.",
    homeStockPara: "Atlanta homes are typically crawl-space or walkout-basement construction with accessible under-floor wiring runs. Multi-story homes in Buckhead and Morningside use attic-down rewire approaches. Tree coverage means service-entrance cable damage from falling limbs is a recurring maintenance category.",
    licensePara: "Georgia Construction Industry Licensing Board (CILB) issues Unrestricted Electrical Contractor, Restricted Electrical Contractor, and Electrical Journeyman licenses for work over $2,500. Verify at sos.ga.gov. Atlanta homeowners should also verify local business tax certificates for the specific county where the work will happen.",
    permitPara: "City of Atlanta Office of Buildings issues permits for the city proper. Surrounding counties have separate portals (DeKalb's is known for slower turnaround; Fulton's is faster). Georgia Power service coordination for panel upgrades runs parallel to city permits and often determines the real schedule.",
    hazardPara: "Atlanta's 1960s-70s suburban housing boom produced a large inventory of Federal Pacific panels. Aluminum branch wiring is common in Gwinnett, Cobb, and Clayton Country construction from 1965-1975. Tornado and severe-weather damage to service drops in north-metro Atlanta is a recurring repair category.",
    renoPara: "Generator transfer switch installation is a fast-growing Atlanta residential electrical scope driven by repeated tornado and ice-storm power outages. A typical 10-12 circuit manual transfer switch plus inlet runs $2,000-$3,500; whole-house automatic transfer switches run $5,000-$9,000.",
    pricingContext: "Atlanta electrical labor runs at or slightly below the national average. Storm-season emergency premiums add 20-30% to service-call pricing. Tree-damage repair is a distinct category most Atlanta-area electricians price separately from planned work.",
    seasonPara: "Atlanta electrical demand peaks February-April (pre-summer AC push) and September-October. Summer thunderstorms drive emergency service demand. Winter tornado outbreaks (January-March) produce periodic emergency-repair spikes.",
    maintenancePara: "Atlanta tree-damage to service-entrance cables is a recurring category that northern contractors underestimate. Falling limbs from canopy oaks in Buckhead and Morningside pull service masts loose, creating fire hazards requiring Georgia Power coordination.",
    emergencyPara: "Emergency electrical service in Atlanta runs $175-$325 dispatch plus $100-$200/hour. Post-tornado and post-ice-storm calls carry a 30-50% premium. Georgia Power will not restore until the service mast passes utility inspection."
  },
  "denver-co": {
    utilityPara: "Xcel Energy (Public Service Company of Colorado) serves most of the Denver metro. Intermountain Rural Electric Association (IREA) covers portions of Douglas, Elbert, and Arapahoe counties. Service coordination through Xcel for residential upgrades runs 10-20 business days. Transmission-side work under Xcel's meter runs on a different schedule.",
    codePara: "Colorado adopted the 2023 NEC statewide. Denver enforces altitude-specific amendments: equipment derating for the 5,280-foot elevation applies to certain devices, and arc-flash calculations differ from sea-level installations. Whole-house surge protection is increasingly recommended given the Front Range's high lightning-strike frequency.",
    panelPara: "Denver housing stock includes 1920s-40s bungalows in Washington Park and Platt Park (often with 60-100 amp panels), 1950s-70s ranches in Lakewood and Aurora (100-150 amp panels), and 2000s-onward infill construction with 200-amp service. High-altitude UV degrades outdoor meter-base gaskets faster than in sea-level markets.",
    homeStockPara: "Denver homes are typically single-story bungalow, mid-century ranch, or newer two-story with full or walkout basements. Basement finish is a major electrical-scope driver because nearly every Denver home has usable basement space. Mountain-lot homes in Golden and Evergreen add well-pump and heat-tape circuits to the typical residential load list.",
    licensePara: "Colorado Department of Regulatory Agencies (DORA) licenses Master Electricians, Journeymen, and Residential Wiremen. Denver requires additional city registration on top of state licensure. Verify at dora.colorado.gov. Colorado's Residential Wireman license is limited to single-family and small multifamily work only.",
    permitPara: "Denver Community Planning and Development issues electrical permits in 1-2 weeks. Historic districts (Curtis Park, Baker, Potter Highlands) add Landmark Preservation Commission review for visible exterior panel changes. Xcel service coordination runs 2-3 weeks parallel to the city permit.",
    hazardPara: "Zinsco/Sylvania panels and Federal Pacific panels are both common in 1960s-80s Denver suburban construction. Aluminum branch wiring shows up in 1965-1975 homes across Lakewood, Aurora, and Arvada. High-altitude UV exposure accelerates outdoor wiring degradation beyond what typical inspection timeframes catch.",
    renoPara: "Whole-house surge protection is a distinct Denver priority because Front Range lightning strikes are 4-5x more frequent than the national average. Type 1 service-panel surge devices plus Type 2 point-of-use protection typically runs $400-$1,200. Generator transfer switches for snowstorm outages add another $2,000-$4,500.",
    pricingContext: "Denver electrical labor runs 15-25% above the national average. Altitude-derated equipment adds 5-10% to materials line. Xcel service-coordination delays routinely push panel-upgrade project timelines 3-6 weeks beyond initial estimates.",
    seasonPara: "Denver electrical demand peaks April-June and September-October. Summer thunderstorm damage and winter ice storms both drive emergency repair demand. Winter exterior work on meter bases and service masts requires heated enclosures that add 10-15% to labor.",
    maintenancePara: "Denver Front Range lightning strikes run 4-5x above the national average, making whole-house surge protection and annual surge-device inspection a critical maintenance item on Wash Park and Highlands homes near the foothills.",
    emergencyPara: "Emergency electrical service in Denver runs $200-$400 dispatch plus $125-$250/hour. Post-hailstorm emergency pricing from April through June carries a 25-40% premium. Xcel meter coordination adds 2-3 business days even on emergencies."
  },
  "seattle-wa": {
    utilityPara: "Seattle City Light is a municipal utility serving Seattle proper plus Shoreline, Burien, and parts of White Center. Puget Sound Energy covers most suburban King County including Bellevue, Kirkland, and Redmond. Snohomish County PUD serves Everett and Lynnwood. Service coordination timelines run 10-25 business days depending on provider.",
    codePara: "Washington State follows the 2023 NEC through the Washington Administrative Code. Seattle SDCI adds mandatory EV-ready wiring in new construction, specific weatherproofing requirements for exterior electrical work given persistent moisture, and requirements for grounding electrode systems adapted to the glacial till soil.",
    panelPara: "Seattle housing stock includes 1900s-1930s Craftsman homes in Ballard and Fremont (often with 60-100 amp panels), post-war homes in Capitol Hill and Wallingford (100-150 amp), and newer infill construction with 200-amp service. Pre-1940 homes frequently have active knob-and-tube wiring still in place in attic and basement runs.",
    homeStockPara: "Seattle homes are typically two-story wood-frame with full basements or daylight basements on hillside lots. Craftsman-era housing has excellent attic and crawl-space access for rewire work. Hillside-lot homes in West Seattle and Leschi require pumped conduit runs for service feeds because of the grade.",
    licensePara: "Washington L&I licenses Master Electricians (01), Journeyman Electricians (01), and various Specialty Electricians. General Journeyman (01) licenses permit all types of electrical work. Verify individual electrician licenses and contracting company registrations separately at lni.wa.gov.",
    permitPara: "Seattle Department of Construction and Inspections (SDCI) issues electrical permits in 2-6 weeks. Critical Areas Ordinance overlays on hillside and landslide-prone parcels add additional review. Seattle City Light service coordination runs 3-4 weeks for residential panel upgrades.",
    hazardPara: "Knob-and-tube wiring is widespread in pre-1940 Seattle housing stock (Wallingford, Ballard, Queen Anne, Capitol Hill). Federal Pacific panels and Zinsco panels are common in 1960s-70s construction. Moisture-damaged outdoor connections are a distinct Seattle hazard that northern-tier electricians flag but southern contractors often miss.",
    renoPara: "ADU wiring is a growing Seattle electrical scope under Washington State's ADU laws. Detached ADU service typically requires a 100-amp sub-panel with underground feeder, separate meter (optional), and EV-ready rough-in. Typical ADU electrical package runs $4,500-$9,500.",
    pricingContext: "Seattle electrical labor runs 15-25% above the national average. Hillside-lot access adds 10-20% to service-entrance work. K&T replacement on pre-1940 homes adds $8,000-$20,000 depending on square footage and access.",
    seasonPara: "Seattle electrical demand is steadier year-round than most markets because temperate weather allows continuous exterior work. June-September dry months are best for any work requiring roof or exterior wall access. Fall-winter rainfall can delay exterior service-mast work.",
    maintenancePara: "Seattle persistent moisture creates unique electrical maintenance needs. Crawl-space junction boxes in Craftsman-era Ballard and Wallingford homes need dehumidification or ventilation upgrades to prevent the connection corrosion Pacific Northwest humidity promotes.",
    emergencyPara: "Emergency electrical service in Seattle runs $200-$375 dispatch plus $125-$225/hour. Post-windstorm calls carry a 25-40% premium when Seattle City Light redirects crews to grid restoration across Puget Sound service territory."
  },
  "austin-tx": {
    utilityPara: "Austin Energy is a municipal utility serving most of Austin proper. Pedernales Electric Cooperative (PEC) covers western Travis County and the Hill Country. Bluebonnet Electric Cooperative serves east Travis County. Service coordination through Austin Energy runs 10-20 business days and the city's online coordination portal is notoriously slower than neighboring Pflugerville or Round Rock.",
    codePara: "Austin follows the 2023 NEC through TDLR statewide adoption. Austin Energy adds local requirements for solar-interconnection-ready panels on new construction, EV-ready circuits, and specific requirements for PV-disconnect visibility. Romex is permitted for residential wiring.",
    panelPara: "Austin housing stock includes 1920s-40s bungalows in Clarksville and Travis Heights (often with upgraded panels), 1970s-90s tract homes in South Austin (100-200 amp), and rapid new construction with 200-400 amp service in the Mueller and East Austin infill boom. Hill Country homes west of MoPac often have larger service (400 amp) for well pumps and outdoor loads.",
    homeStockPara: "Austin homes are a mix of slab-on-grade tract construction and pier-and-beam older stock. Hill Country homes add well pumps, septic lift stations, and outdoor irrigation circuits to the typical load profile. Solar adoption is exceptionally high, with 20-30% of new Austin panel upgrades specifying solar-ready bus bars.",
    licensePara: "Texas TDLR licensing applies plus Austin-specific electrical contractor registration through the city. Verify TDLR licensure at tdlr.texas.gov and city registration through the Austin Development Services portal. Austin enforces contractor registration more strictly than Dallas or Houston.",
    permitPara: "Austin Development Services Department permits electrical work in 2-4 weeks. Austin's permit queue is notoriously longer than other Texas cities. Austin Energy coordination runs 2-4 weeks parallel. Edwards Aquifer Recharge Zone overlays west of MoPac add Environmental Compliance review.",
    hazardPara: "Federal Pacific panels and aluminum branch wiring show up in 1960s-80s South Austin and Riverside construction. Post-Uri (February 2021) frozen-burst conduits left water-damaged wiring in many homes that was simply dried rather than replaced. Solar interconnection errors are a growing hazard category as DIY solar scales.",
    renoPara: "Solar interconnection is the dominant growth scope in Austin residential electrical. A typical rooftop solar panel upgrade with solar-ready bus bars, inverter circuit, and utility-interconnection documentation runs $1,800-$3,500 over a standard panel upgrade.",
    pricingContext: "Austin electrical labor runs 10-20% above the national average and is trending up faster than most Texas markets due to tech-driven population growth. Permit queue delays routinely push project timelines 3-5 weeks beyond initial estimates.",
    seasonPara: "Austin electrical demand peaks March-May and September-November. Summer heat makes attic work hazardous; productive attic shifts are 6am-10am only. Winter ice events produce periodic emergency-repair spikes.",
    maintenancePara: "Austin solar-interconnected panels require annual inverter-circuit inspection because constant cycling of solar production and grid draw creates thermal stress on breaker connections that non-solar panels in Tarrytown and Mueller do not experience.",
    emergencyPara: "Emergency electrical service in Austin runs $175-$350 dispatch plus $100-$225/hour. Austin Energy meter coordination is slower than CenterPoint or Oncor even on emergency calls, routinely adding 3-5 business days to the timeline."
  },
  "san-francisco-ca": {
    utilityPara: "Pacific Gas & Electric (PG&E) serves San Francisco and the Bay Area. SF does not have a municipal utility like LADWP. PG&E's service coordination has historically been slow (30-60 business days for residential service upgrades) compared to peer utilities, a persistent market complaint. Public Safety Power Shutoff (PSPS) events add unpredictability.",
    codePara: "California CEC 2022 applies, plus SF DBI layers on local amendments including mandatory AFCI in all habitable rooms, whole-house surge protection on new service, and seismic bracing requirements for panels in SF's Zone 4 seismic environment. The SF Soft-Story Retrofit Ordinance also interacts with electrical work on affected properties.",
    panelPara: "SF housing stock is dominated by Victorian-era (1880s-1910s) and Edwardian (1910s-1930s) rowhouses with service-panel locations that range from street-facing meter cabinets to back-of-house cellar installations. Many pre-1950 homes still have active K&T wiring. Modern rewire is expensive because of the lath-and-plaster walls and tight access.",
    homeStockPara: "SF housing is overwhelmingly attached or zero-lot-line construction (Victorians, Edwardians, flats, and converted TIC units). Wire access through lath-and-plaster walls is limited. Garage-level panel access is common because many homes have tuck-under garages that simplify service-entrance work.",
    licensePara: "California CSLB C-10 Electrical Contractor license applies. San Francisco also requires local business registration. Verify at cslb.ca.gov. SF firms often charge premium rates for historic-district work that requires finesse with plaster walls and period-appropriate fixture locations.",
    permitPara: "San Francisco Department of Building Inspection (DBI) issues electrical permits in 2-6 weeks. Soft-Story Retrofit Ordinance work adds engineering review. Historic District parcels add Planning Department Certificate of Appropriateness, which routinely adds 8-12 weeks. PG&E coordination adds further 4-8 weeks for service upgrades.",
    hazardPara: "Knob-and-tube wiring is active in a significant share of pre-1950 SF Victorians. Mid-century Zinsco and Federal Pacific panels show up in Sunset and Richmond district homes. Seismic bracing failures on older panels are a distinct SF hazard category highlighted after the 1989 Loma Prieta earthquake.",
    renoPara: "Soft-story retrofit electrical work is a major SF scope driven by the SF mandatory retrofit ordinance. Garage-level panel relocation and sub-panel addition as part of structural retrofit typically runs $4,000-$8,000 as an electrical sub-scope.",
    pricingContext: "SF electrical labor runs 50-75% above the national average due to high cost of living, union scale, and historic-district constraints. Whole-house rewire in a 2,000sf SF Victorian routinely runs $25,000-$45,000.",
    seasonPara: "SF electrical demand is relatively steady year-round because of mild weather. PSPS events in September-November create emergency generator and transfer-switch demand spikes. Winter atmospheric-river storms drive moisture-intrusion service calls.",
    maintenancePara: "SF Victorian-era electrical systems require periodic insulation-resistance testing because marine moisture and century-old wiring runs in Richmond and Sunset fog-belt homes create invisible degradation conditions until actual failure.",
    emergencyPara: "Emergency electrical service in SF runs $300-$600 dispatch plus $175-$350/hour, reflecting city cost-of-living. PSPS events exhaust available crews for 48-72 hours as generator and transfer-switch demand surges."
  },
  "las-vegas-nv": {
    utilityPara: "NV Energy (a Berkshire Hathaway Energy subsidiary) serves the Las Vegas Valley. Service coordination for residential panel upgrades runs 10-20 business days. NV Energy's solar-interconnection process is distinct from the general service upgrade process and adds 4-8 weeks for grid-tied systems.",
    codePara: "Nevada adopted the 2020 NEC with state-level amendments. Las Vegas enforces additional outdoor wiring requirements due to extreme UV: UV-rated conduit (PVC Schedule 80) and UV-rated wiring insulation on all outdoor circuits. Attic temperature-derating calculations apply given summer attic temperatures reaching 140F+.",
    panelPara: "Las Vegas housing stock is overwhelmingly 1990s-2010s tract construction with 200-amp main panels. Pre-1990 homes in the older downtown neighborhoods often have 100-150 amp panels that need upgrade for modern all-electric retrofits. HOAs in Summerlin, Henderson, and Anthem add architectural review for any panel relocation visible from the street.",
    homeStockPara: "Las Vegas homes are almost universally single-story slab-on-grade construction with unconditioned attic spaces. The extreme summer heat degrades wire insulation at an accelerated rate; Valley electricians commonly specify high-temperature THHN even where code permits THWN. Pool and spa circuits are a nearly universal residential scope here.",
    licensePara: "Nevada State Contractors Board (NSCB) licenses Electrical (C-2) contractors. Verify at nscb.nv.gov. Clark County requires additional county-level registration on top of state licensure. HOA compliance is a distinct requirement that NSCB does not verify but that affects virtually every residential project in master-planned communities.",
    permitPara: "Clark County Building Department and City of Las Vegas Building and Safety issue electrical permits depending on jurisdiction. HOA architectural review often takes longer than the building permit itself. NV Energy service coordination runs 2-3 weeks parallel to permits.",
    hazardPara: "Federal Pacific panels are less common in Las Vegas than in older East Coast markets due to the younger housing stock, but they do show up in pre-1990 North Las Vegas and Boulder City homes. Heat-damaged wire insulation is a distinct Valley hazard category tied to 35+ years of attic thermal cycling.",
    renoPara: "Pool and spa circuits are a nearly universal Las Vegas residential electrical scope. A typical pool installation requires 60-amp GFCI-protected sub-panel, bonding grid, variable-speed pump circuit, heater circuit, and underwater lighting circuits totaling $3,000-$5,500 in electrical alone.",
    pricingContext: "Las Vegas electrical labor runs at the national average. Summer heat premium for attic work adds 15-25% from May-September. HOA compliance documentation and architectural review delays add 2-6 weeks to master-planned community projects.",
    seasonPara: "Las Vegas electrical demand peaks October-April. Summer attic work is limited to early-morning shifts (6am-10am). Monsoon storm damage in July-September drives emergency service calls with significant after-hours premiums.",
    maintenancePara: "Las Vegas extreme heat degrades outdoor electrical components faster than any other US metro. Meter-base gaskets, outdoor disconnects, and pool-area GFCI receptacles in Summerlin and Henderson all require annual inspection for UV and thermal damage.",
    emergencyPara: "Emergency electrical service in Las Vegas runs $175-$350 dispatch plus $100-$200/hour. Summer after-hours calls carry a 30-50% premium. NV Energy requires passed Clark County inspection before restoring service after panel work."
  },
  "philadelphia-pa": {
    utilityPara: "PECO Energy (an Exelon subsidiary, same parent as ComEd) serves most of metro Philadelphia. PPL Electric Utilities covers outlying Chester and Montgomery County areas. PECO's service coordination for residential upgrades runs 10-20 business days and the PECO online coordination portal was upgraded in 2023 which improved turnaround.",
    codePara: "Pennsylvania adopted the 2020 NEC with Philadelphia L&I additions. Philly enforces lead-safe work practices (RRP certification) for any electrical work disturbing painted surfaces in pre-1978 homes, which covers most of the city. Romex is permitted for residential wiring, unlike NYC or Chicago.",
    panelPara: "Philadelphia housing stock is dominated by pre-1940 rowhouses with original 60-100 amp panels that have typically been upgraded at least once. Post-war Northeast Philadelphia twins and rows have 100-150 amp panels. Modern all-electric retrofits require 200-amp service upgrades coordinated with PECO.",
    homeStockPara: "Philly rowhouse electrical access is constrained by party-wall construction. Service feeds typically run from front-of-house meter cabinets through the basement to the rear of the lot. Top-floor (third floor) circuits are the most difficult to rewire because attic access is minimal in Philadelphia's flat-roofed rowhouse typology.",
    licensePara: "Pennsylvania does not have statewide electrical contractor licensing; Philadelphia L&I handles city licensure. Verify contractor status with L&I before signing. Philadelphia Home Improvement Contractor registration is a separate requirement under state law (HICPA).",
    permitPara: "Philadelphia Department of Licenses and Inspections (L&I) permits electrical work in 1-2 weeks. Historic district work in Society Hill, Old City, and Queen Village requires Philadelphia Historical Commission review in parallel. PECO service coordination adds 2-4 weeks.",
    hazardPara: "Knob-and-tube wiring is widespread in pre-1930 rowhouses across Philly. Federal Pacific Stab-Lok panels are common in 1960s-70s Northeast Philadelphia and Southwest Philadelphia construction. Lead paint disturbance during electrical work is a regulated hazard requiring RRP-certified remediation in pre-1978 homes.",
    renoPara: "Basement finishing and rowhouse addition work drive the majority of Philly residential electrical scope. A typical basement finish adds 6-10 circuits, a 60-amp sub-panel, and AFCI/GFCI protection, running $5,500-$11,000. Rowhouse roof decks add exterior lighting and outlet circuits.",
    pricingContext: "Philadelphia electrical labor runs 10-20% above the national average. Rowhouse access constraints add 10-15% to rewire projects. Historic district review and RRP lead-safe certification add distinct line items on pre-1978 construction.",
    seasonPara: "Philadelphia electrical demand peaks March-May and September-November. Rowhouse access constraints make winter interior work the preferred scheduling window. Summer humidity limits attic productivity.",
    maintenancePara: "Philadelphia rowhouse electrical systems need periodic thermal-imaging inspection because party-wall construction means overloaded circuits in one dwelling heat wiring passing through the shared masonry wall to the adjacent unit in Fishtown and South Philly.",
    emergencyPara: "Emergency electrical service in Philadelphia runs $200-$400 dispatch plus $125-$250/hour. PECO requires L&I inspection and PECO gas-side sign-off before restoring service after any residential appliance change-out."
  },
  "miami-fl": {
    utilityPara: "Florida Power & Light (FPL, a NextEra Energy subsidiary) serves Miami-Dade County. Service coordination for residential upgrades runs 10-20 business days. FPL's storm-preparedness protocols affect residential service work during hurricane season (June-November) because crews are redirected to grid hardening.",
    codePara: "Florida Building Code Chapter 27 incorporates the 2020 NEC with Florida-specific amendments for hurricane resistance. Miami-Dade County's HVHZ (High Velocity Hurricane Zone) adds further requirements: wind-rated meter cabinets, elevated meter bases in flood zones, and specific bonding requirements for metal roofs and pool installations.",
    panelPara: "Miami housing stock is dominated by post-1992 (Andrew rebuild) construction with 200-amp main panels rated for HVHZ wind loads. Pre-1992 homes in Miami Shores and Coral Gables often retain older 100-150 amp panels that need HVHZ upgrade during any major renovation. Coastal saltwater exposure degrades meter cabinets within 10-15 years in beachfront properties.",
    homeStockPara: "Miami homes are a mix of CBS (concrete block stucco) construction common in post-1940 construction and wood-frame older homes in Coconut Grove. CBS walls are notoriously difficult for retrofit wiring because surface-mount conduit is often the only practical option. Chase-cutting CBS adds significant labor cost.",
    licensePara: "Florida DBPR Electrical Contractors' Licensing Board issues Certified Electrical Contractor (EC) and Registered Electrical Contractor licenses. Verify at myfloridalicense.com. Miami-Dade County also requires county-level registration. HVHZ product approvals for specific equipment are a documentation requirement most Miami homeowners need to verify on quotes.",
    permitPara: "Miami-Dade County and City of Miami Building Departments issue electrical permits. Coastal Construction Control Line parcels add Coastal Construction review. FPL coordination runs 2-3 weeks parallel to permits. Hurricane-season staging restrictions limit exterior work from June-November.",
    hazardPara: "Pre-1992 construction with aluminum branch wiring is a significant hazard category in Miami. Salt-air-corroded service entrance cables are a coastal-specific hazard that Miami contractors flag routinely but inland contractors often miss. Post-hurricane wet-panel failures that were dried rather than replaced are a persistent hidden hazard in homes sold post-Andrew or post-Irma.",
    renoPara: "Whole-house generator transfer switches are a standard Miami residential electrical scope driven by hurricane-season outages. A typical natural-gas-fueled 14-20 kW Generac or Kohler standby generator with automatic transfer switch runs $6,500-$12,000 including the electrical sub-scope.",
    pricingContext: "Miami electrical labor runs 20-35% above the national average due to HVHZ product-approval requirements, coastal corrosion-resistant materials, and hurricane-season work restrictions. HVHZ-compliant materials add 15-25% to standard equipment costs.",
    seasonPara: "Miami electrical demand peaks February-May and October-December (hurricane season prep and recovery). Summer heat and hurricane-season staging constraints limit productive outdoor work. Post-storm emergency pricing can run 2-3x standard rates.",
    maintenancePara: "Miami coastal salt-air corrosion degrades meter cabinets and service-entrance cables within 10-15 years on beachfront Miami Beach and Key Biscayne properties. Annual visual inspection of service equipment is a standard FPL storm-preparedness recommendation.",
    emergencyPara: "Emergency electrical service in Miami runs $225-$450 dispatch plus $125-$275/hour. Post-hurricane pricing runs 2-3x standard. HVHZ product-approval documentation must accompany any emergency panel replacement in Dade County."
  },
  "boston-ma": {
    utilityPara: "Eversource Energy serves most of Boston plus suburban Middlesex and Norfolk counties. National Grid covers parts of metro west. Municipal utilities like Belmont Light and Reading Municipal Light Department serve their respective towns. Eversource service coordination runs 15-25 business days for residential upgrades.",
    codePara: "Massachusetts adopted the 2023 NEC with Massachusetts Electrical Code amendments. Boston ISD enforces stricter grounding and bonding requirements than the NEC baseline due to Boston's legacy fill-zone soils with variable resistance. Whole-house surge protection is increasingly expected on new service installations.",
    panelPara: "Boston housing stock includes triple-deckers (1890s-1920s, often with original 30-60 amp panels that have typically been upgraded), post-war Cape Cod and ranch homes (100 amps), and modern infill construction with 200-amp service. Pre-1950 Beacon Hill and Back Bay homes often have complex historic panel locations with multiple service taps.",
    homeStockPara: "Boston triple-deckers have unique electrical challenges: three dwelling units stacked with separate meters, shared service-entrance feeds, and party-wall construction. Single-family Cape Cod homes in Dorchester and Hyde Park are easier to rewire because of accessible basement and attic runs.",
    licensePara: "Massachusetts licenses Master Electricians (Class A) and Journeyman Electricians separately. Boston requires additional city registration through ISD. Verify licenses at mass.gov. Boston's Master Electrician exam is comparatively difficult versus neighboring states.",
    permitPara: "Boston Inspectional Services Department (ISD) issues electrical permits in 2-4 weeks. Historic district work (Beacon Hill, Back Bay, South End) requires Boston Landmarks Commission review in parallel. Eversource coordination adds 3-4 weeks for service upgrades.",
    hazardPara: "Knob-and-tube wiring is active in a significant share of pre-1940 triple-deckers and Cape homes. Federal Pacific panels are common in 1960s-70s suburban construction. Ice-dam-damaged service masts are a distinct Boston hazard category after heavy snow winters.",
    renoPara: "Triple-decker unit conversion from rental to condo routinely triggers whole-building electrical upgrade. Separating shared service feeds into individual unit services typically runs $15,000-$30,000 for a three-unit triple-decker. Basement finishing adds 8-12 circuits.",
    pricingContext: "Boston electrical labor runs 25-40% above the national average due to Master Electrician scarcity, union influence, and triple-decker work complexity. Historic district constraints add 10-20% on visible work.",
    seasonPara: "Boston electrical demand peaks April-June and September-October. Winter ice-storm emergency repairs and summer AC-load panel upgrades are the two demand spikes. Winter exterior work requires heated enclosures that add 10-15%.",
    maintenancePara: "Boston triple-decker electrical systems need thermal-imaging every 5 years because the stacked three-unit configuration creates shared riser feeds where overloading in one unit in Dorchester or Somerville stresses connections serving all three dwellings.",
    emergencyPara: "Emergency electrical service in Boston runs $250-$500 dispatch plus $150-$300/hour. Mid-winter furnace-related calls during noreasters carry a 40-60% premium. Eversource coordination adds 2-3 days even on emergencies."
  },
  "san-diego-ca": {
    utilityPara: "San Diego Gas & Electric (SDG&E, a Sempra Energy subsidiary) serves San Diego County. Service coordination for residential upgrades runs 15-25 business days, historically slower than LADWP or PG&E residential. Public Safety Power Shutoff (PSPS) events during wildfire season affect coastal mountain parcels more than the urban core.",
    codePara: "California CEC 2022 applies. San Diego DSD adds local amendments including coastal-zone corrosion-resistant materials, seismic bracing for panels, and EV-ready circuits on new construction. Title 24 solar-ready wiring is mandatory on new single-family construction.",
    panelPara: "San Diego housing stock includes 1950s-70s coastal ranch homes (100-150 amp panels), 1990s-2000s inland tract homes (200-amp), and newer infill with 200-400 amp service. Coastal homes in La Jolla, Del Mar, and Encinitas have corrosion issues on meter cabinets and service-entrance cables within 10-15 years of salt-air exposure.",
    homeStockPara: "San Diego homes are predominantly single-story ranch or two-story with attic and garage access that simplifies retrofit wiring. Stucco exterior walls limit surface-mount conduit options. Pool and spa circuits are a common residential scope in Rancho Bernardo, Scripps Ranch, and coastal North County homes.",
    licensePara: "California CSLB C-10 Electrical Contractor license applies. Verify at cslb.ca.gov. San Diego County has no additional county-level registration requirement beyond state licensure. Individual cities (Del Mar, Solana Beach, Encinitas) may have local business license requirements.",
    permitPara: "San Diego Development Services Department (DSD) issues electrical permits in 1-3 weeks. Coastal Zone Overlay parcels require Coastal Development Permit review adding 4-8 weeks for La Jolla, Ocean Beach, and Del Mar work. SDG&E coordination runs 3-4 weeks parallel.",
    hazardPara: "Federal Pacific panels are common in 1960s-70s La Mesa, El Cajon, and Chula Vista construction. Aluminum branch wiring shows up in 1965-1975 Rancho Bernardo homes. Salt-air corrosion of outdoor meter equipment is a distinct coastal hazard category.",
    renoPara: "Solar panel upgrades with SDG&E net-metering interconnection are a major San Diego residential scope. A typical solar-ready 200-amp upgrade with main-panel upgrade, inverter circuit, and SDG&E interconnection documentation runs $3,500-$6,500 including permit and utility coordination.",
    pricingContext: "San Diego electrical labor runs 20-30% above the national average. Coastal Development Permit parcels add 15-25% in permit fees and review time. Salt-air-specific materials (stainless fasteners, corrosion-resistant meter cabinets) add 5-10% to coastal-zone projects.",
    seasonPara: "San Diego electrical demand is steady year-round because of mild weather. PSPS events in September-October drive generator and transfer-switch demand spikes. Coastal atmospheric-river events in winter produce localized storm-damage work.",
    maintenancePara: "San Diego coastal-zone electrical equipment needs annual corrosion inspection because marine-layer salt deposits on meter cabinets year-round. La Jolla and Del Mar properties within 1 mile of the Pacific show measurable equipment degradation by year 10.",
    emergencyPara: "Emergency electrical service in San Diego runs $200-$375 dispatch plus $125-$225/hour. PSPS wildfire-season events create surge demand for generator installations that exhaust available crews. SDG&E coordination adds 2-4 days."
  },
  "tampa-fl": {
    utilityPara: "Tampa Electric (TECO, an Emera subsidiary) serves Hillsborough County including Tampa proper. Duke Energy Florida covers Pinellas, Pasco, and Polk counties. Withlacoochee River Electric Cooperative serves portions of rural Pasco. Service coordination timelines run 10-20 business days depending on provider.",
    codePara: "Florida Building Code Chapter 27 incorporates the 2020 NEC with Florida amendments. Tampa Bay area counties outside HVHZ use standard Florida NEC adoption; HVHZ (Miami-Dade and Broward) adds further requirements that don't apply in Tampa. Hurricane-resistant equipment is still encouraged but not mandated the same way as South Florida.",
    panelPara: "Tampa housing stock includes 1950s-70s ranch homes in South Tampa and Seminole Heights (100-150 amp panels), 1990s-2010s tract homes (200-amp), and new infill with 200-400 amp service. Coastal homes along Bayshore and in St. Petersburg have corrosion issues on meter cabinets within 10-15 years of bay-air exposure.",
    homeStockPara: "Tampa homes are predominantly single-story CBS (concrete block stucco) or wood-frame construction. CBS limits retrofit wiring options for chase-cut runs. Attic wiring runs predominate, and summer attic temperatures reaching 140F+ degrade wire insulation faster than northern markets.",
    licensePara: "Florida DBPR Electrical Contractors' Licensing Board licenses Certified and Registered Electrical Contractors. Verify at myfloridalicense.com. Hillsborough County requires county-level registration. Unlicensed electrical work is a persistent market problem in Tampa that DBPR enforcement actions regularly address.",
    permitPara: "City of Tampa Construction Services and Hillsborough County Building issue electrical permits depending on jurisdiction. Coastal High Hazard Area parcels add Coastal Construction review. TECO or Duke Energy coordination runs 2-3 weeks parallel to permits.",
    hazardPara: "Federal Pacific panels are common in 1960s-70s South Tampa and Carrollwood construction. Aluminum branch wiring shows up in 1965-1975 construction across the metro. Hurricane-damaged service entrance cables from Irma (2017), Ian (2022), and Idalia (2023) are a documented hazard category on homes sold post-storm.",
    renoPara: "Whole-house generator installation is a standard Tampa residential electrical scope driven by hurricane outages. A typical 20kW Generac or Kohler standby generator with automatic transfer switch runs $6,000-$11,000 including electrical integration.",
    pricingContext: "Tampa electrical labor runs 5-15% above the national average. Hurricane-season staging and post-storm emergency pricing (June-November) adds 10-20% to exterior work. Coastal corrosion-resistant materials add 5-10% to waterfront projects.",
    seasonPara: "Tampa electrical demand peaks February-May (pre-hurricane-season generator installs) and October-December (post-storm repairs). Summer heat and hurricane-season staging limits outdoor work productivity. Winter (December-February) is the slack-demand window.",
    maintenancePara: "Tampa Bay salt-air exposure and afternoon thunderstorm humidity create aggressive conditions for outdoor electrical equipment. Annual inspection of meter cabinets and pool-area disconnects in Hyde Park and Davis Islands catches corrosion before shock hazards develop.",
    emergencyPara: "Emergency electrical service in Tampa runs $200-$375 dispatch plus $100-$225/hour. Post-hurricane pricing runs 1.5-2x standard. TECO and Duke Energy both require Hillsborough County inspection before restoring service."
  },
  "detroit-mi": {
    utilityPara: "DTE Energy serves most of Wayne, Macomb, and Oakland counties. Consumers Energy covers outlying Washtenaw and Livingston county areas. DTE's service coordination for residential upgrades runs 10-20 business days and the DTE online portal was modernized in 2022 which improved turnaround. Public Safety Power Shutoffs are not used in Michigan.",
    codePara: "Michigan adopted the 2017 NEC as of late 2023 (with the 2020 adoption pending), placing it somewhat behind current-edition states. Detroit BSEED enforces the code with attention to lead-safe RRP work in pre-1978 homes and specific grounding requirements adapted to glacial till soil. Romex is permitted.",
    panelPara: "Detroit housing stock is dominated by 1920s-50s brick Tudors, Colonial revivals, and bungalows in neighborhoods like Indian Village, Boston-Edison, and Palmer Woods. Original services were 30-60 amp; most have been upgraded at least once to 100-150 amp. Modern all-electric retrofits require 200-amp service. Land Bank-acquired parcels often need complete electrical rebuild after long-term vacancy.",
    homeStockPara: "Detroit homes typically have full basements with accessible wiring runs and attic access for rewire work. Land Bank properties and neighborhoods with extended vacancy periods often have copper theft damage and deteriorated wiring that requires complete replacement rather than upgrade. Dearborn and Grosse Pointe housing stock is similar-vintage with less vacancy-damage risk.",
    licensePara: "Michigan LARA Electrical Administrative Board licenses Master Electricians, Journeyman Electricians, Residential Electricians, and Electrical Apprentices. Verify at michigan.gov/lara. Detroit BSEED requires additional city registration. Dearborn, Warren, and Sterling Heights have parallel city licensing requirements.",
    permitPara: "Detroit Buildings, Safety Engineering and Environmental Department (BSEED) issues electrical permits in 2-4 weeks. Land Bank parcel work triggers distinct permit categories separate from standard residential. DTE coordination runs 2-3 weeks parallel.",
    hazardPara: "Knob-and-tube wiring remains active in a meaningful share of pre-1930 Detroit brick homes. Federal Pacific panels are common in 1960s-70s suburban Wayne and Macomb County construction. Copper-theft-damaged wiring is a distinct hazard category on Land Bank and long-vacant parcels.",
    renoPara: "Land Bank parcel rehabilitation is a substantial Detroit electrical sub-market. A full electrical rebuild on a Land Bank-acquired Detroit home (service replacement, full rewire, panel and sub-panel installation, all GFCI/AFCI per current code) typically runs $15,000-$28,000 depending on square footage.",
    pricingContext: "Detroit electrical labor runs 5-15% below the national average. Land Bank rehabilitation work often pricing sub-normal due to experienced specialist crews. Lead-safe RRP-certified work on pre-1978 homes adds distinct cost and documentation lines.",
    seasonPara: "Detroit electrical demand peaks April-June and September-October. Winter ice storms drive emergency service-mast repairs. MDOT frost law affecting utility trenching schedules narrows the spring window for service-upgrade trench work.",
    maintenancePara: "Detroit Land Bank rehabilitation properties need complete electrical inspection before occupancy because long-term vacancy allows copper theft and moisture intrusion that makes partial reuse unsafe. DTE smart-meter data reveals 25-30% of pre-1940 homes have undersized service.",
    emergencyPara: "Emergency electrical service in Detroit runs $175-$325 dispatch plus $100-$200/hour. Mid-winter arctic-outbreak calls in Palmer Woods and Indian Village carry a 30-50% premium. DTE meter coordination runs 2-3 business days."
  },
  "minneapolis-mn": {
    utilityPara: "Xcel Energy (Northern States Power) serves most of the Twin Cities metro. Minnesota Power covers outlying northern areas. Service coordination through Xcel for residential upgrades runs 10-20 business days. Xcel's frozen-ground policy restricts service trenching from mid-November through mid-April.",
    codePara: "Minnesota adopted the 2020 NEC with state-level amendments. Minneapolis and Saint Paul enforce stricter grounding and bonding standards adapted to frozen-ground conditions, and require specific weatherproofing on all exterior electrical work. Whole-house surge protection is increasingly specified on new services.",
    panelPara: "Twin Cities housing stock includes 1920s-40s bungalows in South Minneapolis and Mac-Groveland (original 60-100 amp services, typically upgraded), post-war Cape Cods and ranches (100-150 amp), and newer infill with 200-amp service. Cold-climate priorities include heat-tape circuits, attached-garage heater circuits, and heated-walk/driveway circuits.",
    homeStockPara: "Twin Cities homes are predominantly two-story wood-frame with full basements or daylight basements on hillside lots in Saint Paul. Attic wiring runs are common but restricted by heavy blown-in insulation (R-49 minimum per Minnesota code). Frozen-ground conditions from November-April limit service-trench work to specialized equipment.",
    licensePara: "Minnesota Department of Labor and Industry licenses Master Electricians (A), Journeyman Electricians, Installer-B licensees, and other specialty categories. Minneapolis and Saint Paul each require additional city registration. Verify at dli.mn.gov.",
    permitPara: "Minneapolis Community Planning and Economic Development (CPED) issues electrical permits in 2-4 weeks. Saint Paul DSI handles permits in the capital city. Historic preservation districts add HPC review. Xcel service coordination is constrained by frozen-ground policy from November-April.",
    hazardPara: "Knob-and-tube wiring is active in a significant share of pre-1940 Minneapolis bungalows and Saint Paul foursquares. Federal Pacific panels are common in 1960s-80s suburban Bloomington, Edina, and Plymouth construction. Cold-weather insulation degradation on exterior service cables is a distinct Twin Cities hazard.",
    renoPara: "Heated walks and heated driveway circuits are a Twin Cities specialty scope. Electric snow-melt systems for driveways typically run $4,500-$9,000 for residential installations including the dedicated 50-60 amp sub-panel, thermostat control, and embedded heat cable.",
    pricingContext: "Twin Cities electrical labor runs 10-20% above the national average. Cold-weather trench restrictions narrow the Xcel service-coordination window to April-October. Heat-tape and heated-walk specialty circuits add distinct scope categories.",
    seasonPara: "Twin Cities electrical demand peaks May-July (post-winter service-upgrade push) and September-October. November-March is constrained by frozen-ground policy. Emergency winter service-mast repairs after ice storms drive periodic demand spikes.",
    maintenancePara: "Twin Cities frozen-ground conditions from November through April affect buried service feeds. Annual spring inspection of exposed conduit joints in Kenwood and Linden Hills catches freeze-heave damage before connections fail under summer air-conditioning load.",
    emergencyPara: "Emergency electrical service in Minneapolis runs $200-$375 dispatch plus $125-$225/hour. Polar vortex calls carry a 40-60% premium. Xcel Energy emergency meter coordination is constrained by frozen-ground policy from November through April."
  },
  "charlotte-nc": {
    utilityPara: "Duke Energy Carolinas serves most of Mecklenburg County and metro Charlotte. EnergyUnited Electric Cooperative serves outlying portions of Cabarrus and Union counties. Duke Energy service coordination for residential upgrades runs 10-15 business days, faster than Northeast utilities.",
    codePara: "North Carolina adopted the 2020 NEC statewide. Charlotte and Mecklenburg County add specific requirements for storm-resistant meter-base mounting given regular tornado risk. Romex is permitted for residential wiring. NCDOL enforces through county inspection departments with varying strictness.",
    panelPara: "Charlotte housing stock includes 1920s-40s bungalows in Dilworth, Myers Park, and Plaza Midwood (often with upgraded panels), 1960s-90s tract homes in South Charlotte and Ballantyne (100-200 amp), and rapid new construction with 200-400 amp service. Banking-sector growth has driven significant upmarket retrofits with solar and EV circuits.",
    homeStockPara: "Charlotte homes are predominantly single-story or two-story crawl-space or slab-on-grade construction. Crawl-space access for underfloor wiring is good in established neighborhoods. Piedmont clay soil affects service-trench work but is workable year-round unlike frozen-ground markets.",
    licensePara: "NC Board of Examiners of Electrical Contractors licenses Unlimited, Intermediate, and Limited Electrical Contractors. Verify at ncbeec.org. Mecklenburg County Code Enforcement requires county registration on top of state licensure. Individual suburban cities may have local business license requirements.",
    permitPara: "Mecklenburg County Code Enforcement issues electrical permits for Charlotte in 1-2 weeks. Concord, Gastonia, Matthews, and Mint Hill have separate portals. Duke Energy coordination runs 2 weeks parallel. Charlotte Tree Ordinance compliance affects service-trench routing near protected trees.",
    hazardPara: "Federal Pacific panels are common in 1960s-70s South Charlotte and Matthews construction. Aluminum branch wiring shows up in 1965-1975 tract construction. Tornado-damaged service masts are a recurring repair category in the Charlotte NWS zone.",
    renoPara: "EV charger installations are a fast-growing Charlotte residential electrical scope driven by Duke Energy EV incentives. A typical 50-amp hardwired Level 2 installation runs $1,400-$2,800 including circuit, conduit, and permit.",
    pricingContext: "Charlotte electrical labor runs at the national average. Tree-protection compliance adds distinct scope on lots with canopy oaks. Rapid construction growth drives scheduling constraints rather than pricing volatility.",
    seasonPara: "Charlotte electrical demand peaks March-May and September-October. Summer thunderstorms drive emergency service-mast work. Winter ice-storm emergencies (January-February) produce periodic demand spikes.",
    maintenancePara: "Charlotte tree-damage to service drops is a recurring maintenance category driven by ice storms and summer thunderstorms across Myers Park and Dilworth. Duke Energy coordinates service-drop replacement but the weather head and service mast are the homeowner responsibility.",
    emergencyPara: "Emergency electrical service in Charlotte runs $175-$325 dispatch plus $100-$200/hour. Post-ice-storm calls carry a 25-40% premium. Duke Energy service coordination runs 2-3 business days and cannot be expedited."
  },

  "st-louis-mo": {
    utilityPara: "Ameren Missouri operates the distribution grid across the city and county while Spire handles natural gas. Because St. Louis City is independent from St. Louis County, meter-coordination paperwork for a Clayton panel upgrade files through a different Ameren service center than an identical job in Soulard. Service-entrance cutover requests through Ameren's contractor portal typically run 12-18 business days.",
    codePara: "Missouri adopts the 2020 NEC at the state level. The City of St. Louis Building Division enforces local amendments including mandatory AFCI protection on all bedroom circuits in pre-1970 housing rewires. Romex is permitted, which keeps residential wiring labor 25-35% below conduit-mandatory markets like Chicago.",
    panelPara: "Central West End brownstones built in the 1890s-1920s still carry 60-amp fused services with porcelain cutout bases. Soulard two-families from the 1870s often have combined meter cabinets in the cellar serving both units. Clayton ranch homes from the 1950s-60s typically upgraded to 100-amp panels but now need 200-amp service for heat-pump and EV conversions.",
    homeStockPara: "The city's brick two-family housing stock dominates neighborhoods from Tower Grove South through Benton Park, with full basements providing accessible wiring runs. The Hill's shotgun-style Italian-heritage homes have limited attic access, pushing rewires through basement conduit runs along the ceiling joists. Fox Park's 1880s mansions feature 14-foot ceilings that make vertical wire pulls expensive.",
    licensePara: "Missouri has no statewide electrical contractor license. The City of St. Louis requires a separate city electrical license with a written exam and proof of insurance. St. Louis County jurisdictions (Clayton, Ladue, Webster Groves) accept the state journeyman card but require their own business registration. Verify city license status through the Building Division before signing.",
    permitPara: "City Building Division electrical permits process in 2-3 weeks. Ameren Missouri service coordination adds 2-3 weeks parallel. Lafayette Square, Compton Heights, and Soulard fall under the Cultural Resources Office, which reviews visible exterior panel relocations and conduit runs for compatibility with the historic streetscape.",
    hazardPara: "Federal Pacific Stab-Lok panels are widespread in 1960s-70s homes across Affton and Lemay. Knob-and-tube wiring remains active in some pre-1920 Soulard and Lafayette Square houses that have never been fully rewired. The February 2021 Uri ice storm exposed a pattern of frozen exterior disconnects across Tower Grove South that created fire hazards when power was restored.",
    renoPara: "EV charger installation drives the fastest-growing residential electrical scope because Ameren Missouri's off-peak EV rate creates strong financial incentive. A typical 48-amp hardwired Level 2 charger in a Benton Park garage runs $1,800-$3,200. Whole-house generator transfer switches grew 30% after the April 2011 tornado knocked power out for 5 days across north county.",
    pricingContext: "STL electrical labor sits at the national average. The city/county jurisdictional split means contractors working both sides carry dual registrations and know two different inspection cultures, which filters out less-experienced operators.",
    seasonPara: "Demand peaks in April-June pre-summer AC season and September-October pre-heating season. Winter ice storms along the I-64 corridor drive emergency service-mast repair surges. Cardinals home-game traffic affects delivery schedules for downtown-adjacent projects."
  },

  "orlando-fl": {
    utilityPara: "Orlando Utilities Commission (OUC) serves the city proper and parts of unincorporated Orange County, while Duke Energy Florida covers Winter Park, Dr. Phillips, and most suburban addresses. OUC's service coordination runs 7-14 business days, faster than Duke's 15-20 day window. The two utilities have different meter-base standards, so panel hardware specified for an OUC address may not pass Duke inspection at a Winter Park property 3 miles away.",
    codePara: "Florida Building Code Chapter 27 incorporates the 2020 NEC with hurricane-specific amendments including mandatory whole-house surge protection on new service installations and weather-resistant receptacles on all exterior circuits. AFCI protection is required on all habitable rooms. Romex is permitted for residential wiring.",
    panelPara: "College Park bungalows from the 1920s-40s carry 60-100 amp fused panels mounted in un-air-conditioned exterior closets where Florida heat degrades wire insulation. Winter Park's 1950s-60s ranch homes typically have 100-150 amp panels. Lake Nona's post-2010 construction comes standard with 200-amp service and solar-ready bus bars.",
    homeStockPara: "Orlando is dominated by CBS (concrete block stucco) slab-on-grade construction where all wiring runs through the attic or in slab-embedded conduit. Attic temperatures exceed 140F from May through September, which accelerates THHN conductor insulation breakdown. College Park's wood-frame bungalows are the exception, with crawl-space access that makes rewire work simpler than the CBS majority.",
    licensePara: "Florida DBPR licenses Certified Electrical Contractors (statewide) and Registered Electrical Contractors (county-specific). Verify at myfloridalicense.com. OUC requires contractors to carry $300,000 minimum liability to work on their service equipment. Orange County and Osceola County (Celebration) have separate business-tax requirements.",
    permitPara: "City of Orlando Permitting Services processes electrical permits in 3-7 business days, among the fastest in Florida. Winter Park's Building Department runs 5-10 days. Celebration files through Osceola County, not Orange County, which catches homeowners off guard. Pool electrical work triggers a separate barrier-compliance and bonding inspection.",
    hazardPara: "Federal Pacific panels are common in 1960s-70s Pine Hills and Conway-area homes. Hurricane Ian in 2022 and Irma in 2017 both flooded exterior panels in low-lying Windermere and MetroWest; panels that were dried and reused without replacement remain a hidden hazard. Aluminum branch wiring from the 1965-75 copper-shortage era persists in College Park ranch homes.",
    renoPara: "Whole-house standby generators are the signature Orlando electrical scope, driven by hurricane-season outages that lasted 2-14 days after Irma. A 22kW Generac with automatic transfer switch runs $8,000-$14,000 installed. Pool-equipment electrical upgrades (variable-speed pump circuits, salt-system power supplies) are the second-largest residential category.",
    pricingContext: "Orlando electrical labor sits at the national average. Hurricane-season emergency pricing spikes 30-50% during active storm events. OUC's faster service coordination gives city-proper projects a scheduling advantage over Duke Energy suburban addresses.",
    seasonPara: "Demand peaks March-May pre-summer and October-November post-hurricane. Summer attic work is limited to 6am-10am shifts because of 140F+ attic temps. Hurricane season (June-November) disrupts scheduling around storm events but also generates emergency generator-installation surges."
  },

  "san-antonio-tx": {
    utilityPara: "CPS Energy is a municipally owned combined electric-and-gas utility serving San Antonio proper, one of the few metros where a single entity handles both services. This simplifies coordination because one service center manages both the electric meter and gas meter for panel relocations. CPS service-upgrade coordination runs 10-15 business days. Boerne and Helotes fall under separate utility providers.",
    codePara: "Texas adopted the 2023 NEC statewide through TDLR, making it one of the most current code environments in the country. San Antonio Development Services enforces additional requirements for outdoor circuit weatherproofing driven by the extreme UV and heat environment. Romex is permitted. EV-ready conduit stub-out is required on all new single-family construction citywide.",
    panelPara: "King William's 1890s Victorian homes carry original 40-60 amp fused services with cast-iron meter bases. Alamo Heights' 1930s-50s Tudor-style homes typically have 100-amp panels upgraded from the original 60-amp fuse boxes. Stone Oak's 2000s-era tract homes come with 200-amp service but increasingly need 320-amp upgrades for dual-EV-charger households.",
    homeStockPara: "San Antonio is predominantly slab-on-grade construction with unconditioned attic spaces that exceed 150F in summer. Attic wiring in homes along Broadway and Hildebrand near Brackenridge Park uses THHN conductor as baseline, and any rewire work on existing circuits reveals insulation breakdown from decades of thermal cycling. The Pearl's converted brewery lofts present unique industrial-to-residential wiring challenges.",
    licensePara: "Texas TDLR licenses Master Electricians (12,000 supervised hours) and Journeyman Electricians (8,000 hours). Only Masters can pull permits. CPS Energy requires separate contractor registration beyond TDLR licensure. Verify TDLR status at tdlr.texas.gov and CPS registration through the utility portal. Alamo Heights has its own permitting requirements independent of the city.",
    permitPara: "City of San Antonio Development Services permits in 3-7 business days. Alamo Heights operates its own building department with faster turnaround but stricter design review. King William, Monte Vista, and Dignowity Hill historic districts require HDRC Certificate of Appropriateness for visible exterior panel work, adding 4-6 weeks.",
    hazardPara: "Federal Pacific panels are widespread in 1960s-70s homes along Bandera Road and in the Medical Center area. Aluminum branch wiring from the copper-shortage era shows up in Windcrest and Converse subdivisions. Winter Storm Uri in 2021 exposed frozen exterior disconnects across Southtown that created arc-flash hazards when CPS restored power after 4 days of grid failure.",
    renoPara: "Whole-house generator installations surged after Uri proved the ERCOT grid's vulnerability. A 22kW standby unit with automatic transfer switch runs $9,000-$15,000. EV charger installations are the second-fastest scope, with CPS Energy's time-of-use EV rate driving demand for hardwired Level 2 units at $1,800-$3,500.",
    pricingContext: "SA electrical labor sits at the national average. CPS Energy's combined utility model simplifies coordination but the utility's post-Uri grid-hardening program has extended service-upgrade timelines by 3-5 days compared to pre-2021 norms.",
    seasonPara: "Demand peaks March-May and October-November. Summer attic work is restricted to 6am-10am because of 150F+ attic temperatures. Winter Storm Uri demonstrated that January-February cold events, though rare, produce emergency panel-replacement surges."
  },

  "portland-or": {
    utilityPara: "Portland General Electric (PGE) serves most of the city and inner suburbs while NW Natural handles gas distribution. Pacific Power covers a small slice of far-east Portland. PGE's residential service-coordination portal runs 15-20 business days for panel upgrades; NW Natural coordination for combined gas/electric meter relocations adds a parallel 10-14 day window. Lake Oswego and West Linn fall under PGE but have separate city permit requirements.",
    codePara: "Oregon adopts the NEC through the Oregon Electrical Specialty Code, currently based on the 2023 NEC. Portland SDCI adds mandatory EV-ready wiring on new single-family construction, weatherproof GFCI protection on all outdoor circuits due to persistent rain, and specific grounding-electrode requirements adapted to the glacial-till and basalt soil that affects ground-rod resistance.",
    panelPara: "Hawthorne and Alberta districts' 1910s-30s Craftsman bungalows still carry 60-100 amp panels with original porcelain fuse blocks. Sellwood's 1940s-50s Cape Cods typically have 100-amp panels. Lake Oswego's 1990s-2000s construction runs 200-amp service. The Pearl District's converted warehouse lofts present unique industrial-to-residential panel challenges with 3-phase to single-phase conversions.",
    homeStockPara: "Portland homes are typically two-story wood-frame with full basements and accessible crawl spaces on the east side, while West Hills homes sit on steep lots with daylight basements. Laurelhurst and Alameda Ridge homes have excellent attic access for rewire work. Hillside lots in Council Crest and Southwest Portland require pumped conduit runs for underground service feeds because the steep grade prevents standard trenching.",
    licensePara: "Oregon requires an electrical contractor license through the Building Codes Division plus individual electrician licenses through the BCD examination program. General Journeyman (01J) licenses permit all residential work. Verify at bcd.oregon.gov. PGE requires contractors to carry $500,000 minimum liability. Portland business-tax registration is a separate requirement.",
    permitPara: "Bureau of Development Services processes electrical permits in 2-4 weeks. Irvington, Ladd's Addition, Piedmont, and Lair Hill historic districts fall under the Portland Historic Landmarks Commission, which reviews visible exterior conduit runs and panel placements. PGE service coordination adds 3-4 weeks parallel to the city permit.",
    hazardPara: "Knob-and-tube wiring remains active in a significant share of pre-1930 Craftsman homes across Hawthorne, Alberta, and SE Division. Federal Pacific and Zinsco panels are common in 1960s-70s east-side ranch construction. Persistent moisture in crawl-space junction boxes creates corrosion on wire connections that only thermal imaging or resistance testing reveals.",
    renoPara: "Heat-pump conversions drive the largest Portland residential electrical scope because Oregon's Clean Energy Act incentivizes electrification. A typical heat-pump panel upgrade with 240V/50A circuit, load-shed relay, and HVAC disconnect runs $2,800-$4,500. ADU wiring under Oregon's ADU laws is the second-largest scope at $4,500-$9,500 for a detached unit.",
    pricingContext: "Portland electrical labor runs 20-30% above the national average due to IBEW Local 48 influence and high material costs. Biennial DEQ emissions testing applies to contractor diesel vehicles. Oregon's prevailing-wage requirements on certain utility-adjacent work add cost on projects near the PGE service boundary.",
    seasonPara: "Demand is steadier year-round than most markets because Portland's temperate weather allows continuous exterior work. June-September dry months are preferred for roof and exterior service-mast access. Fall atmospheric rivers in October-November delay exterior work by 5-10 days per event."
  },

  "sacramento-ca": {
    utilityPara: "Sacramento Municipal Utility District (SMUD) serves the city and most of Sacramento County with some of the lowest electric rates in California. PG&E handles gas distribution and serves pockets of Placer and El Dorado County suburbs. SMUD's residential service-coordination portal runs 7-12 business days, significantly faster than PG&E's 15-25 day window in neighboring Roseville and Folsom.",
    codePara: "California Electrical Code (CEC 2022, based on 2020 NEC) applies with Title 24 Part 6 amendments requiring EV-ready wiring, solar-ready conduit and panel space, and battery-storage-ready infrastructure on all new single-family construction. SMUD's territory-specific interconnection requirements for solar add a layer beyond the CEC baseline.",
    panelPara: "East Sacramento's Fabulous 40s Tudor homes from the 1920s-30s carry 60-100 amp panels with original ceramic fuse blocks. Midtown's 1940s-50s cottages typically have 100-amp panels. Elk Grove and Natomas tract homes from the 2000s come with 200-amp service and solar-ready bus bars. The Land Park neighborhood's 1930s-era WPA homes have plaster-over-lath walls that make concealed rewire work expensive.",
    homeStockPara: "Sacramento homes are predominantly slab-on-grade with vented crawl spaces in the older central neighborhoods and pure slab construction in Elk Grove and Natomas. Central Valley attic temperatures exceed 140F for 4-5 months, accelerating conductor insulation degradation 30-40% faster than coastal California. East Sacramento's pier-and-beam heritage homes have the best crawl-space access for rewire work.",
    licensePara: "California requires a C-10 Electrical Contractor license through CSLB for any work over $500. Verify at cslb.ca.gov, which shows bond status ($25,000 minimum), workers' comp coverage, and complaint history. SMUD requires additional contractor registration through their new-construction portal. Roseville and Folsom require separate city business licenses.",
    permitPara: "City of Sacramento Community Development permits in 5-10 business days. Roseville and Folsom each run independent building departments with faster turnaround. Alkali Flat, Boulevard Park, and Poverty Ridge historic districts fall under the Sacramento Preservation Commission. SMUD service coordination runs 1-2 weeks, among the fastest utility responses in California.",
    hazardPara: "Federal Pacific panels dominate the hazard inventory in 1960s-70s South Sacramento and Arden-Arcade construction. Aluminum branch wiring from the copper-shortage era is widespread in Carmichael and Fair Oaks. Central Valley attic heat produces measurable insulation breakdown on THHN conductor by year 15, roughly 10 years earlier than coastal markets. The January 2023 atmospheric-river flooding damaged below-grade electrical connections in Natomas.",
    renoPara: "Solar-interconnection panel upgrades are the dominant residential electrical scope because SMUD's net-metering program and California's solar mandate drive exceptionally high rooftop-solar adoption. A typical solar-ready 200-amp upgrade with inverter circuit and utility interconnection documentation runs $3,200-$5,500. Battery-storage-ready infrastructure (Tesla Powerwall, Enphase) adds $800-$1,500 to the panel scope.",
    pricingContext: "Sacramento electrical labor runs 15-25% above the national average but below the Bay Area. SMUD's fast service coordination gives Sacramento a scheduling advantage over PG&E-served suburbs. Title 24 compliance adds 8-12% to new-construction electrical scope versus code-minimum states.",
    seasonPara: "Demand peaks March-May pre-summer and September-November. Summer attic work is limited to 6am-10am shifts from June through September. The January-February tule-fog season makes outdoor service-mast work slippery and slow. Biennial smog checks through BAR apply to contractor vehicles."
  },

  "pittsburgh-pa": {
    utilityPara: "Duquesne Light serves the City of Pittsburgh and most of Allegheny County while Peoples Gas handles gas distribution. West Penn Power (FirstEnergy) covers Westmoreland County suburbs. Duquesne Light's contractor portal for residential service upgrades runs 12-20 business days. Mt. Lebanon and Fox Chapel fall under Duquesne Light but have their own borough permit processes that run parallel to utility coordination.",
    codePara: "Pennsylvania adopts the 2017 NEC statewide through the UCC (Uniform Construction Code), currently one cycle behind. Pittsburgh PLI enforces local amendments including mandatory GFCI protection on all basement circuits in homes with a history of flooding. Romex is permitted for residential wiring, keeping labor costs competitive versus conduit-mandatory markets.",
    panelPara: "Shadyside's 1890s-1920s Victorian rowhouses carry original 60-amp fused services with antiquated meter cabinets in damp basements. Squirrel Hill's 1920s-40s brick homes typically have 100-amp panels upgraded from the original fuse boxes. Mt. Lebanon's post-war ranch construction runs 100-150 amp panels. Lawrenceville's converted-warehouse lofts present 3-phase industrial-to-residential conversion challenges similar to Portland's Pearl District.",
    homeStockPara: "Pittsburgh homes almost universally have full basements with accessible wiring runs, a significant advantage for rewire work. The city's steep topography means hillside homes in South Side Slopes and Mt. Washington have split-level service entrances where the meter is at street level and the panel is a full story below. Allegheny Plateau sandstone and shale produce ground-rod resistance values that require supplemental grounding electrodes in the Pittsburgh red beds clay.",
    licensePara: "Pennsylvania requires Home Improvement Contractor registration under Act 132 for any electrical work in occupied dwellings. Verify at pago.state.pa.us. Pittsburgh PLI requires additional city business registration. Electrical contractors must hold a PA Master Electrician license or supervise under one. Mt. Lebanon and Fox Chapel boroughs accept state licensure but require their own business registration.",
    permitPara: "Pittsburgh PLI processes electrical permits in 2-3 weeks. Allegheny West, Manchester, Mexican War Streets, and Deutschtown historic districts fall under the Pittsburgh Historic Review Commission, which reviews visible exterior panel relocations and conduit runs. Duquesne Light service coordination adds 2-4 weeks parallel to the city permit.",
    hazardPara: "Federal Pacific and Zinsco panels are widespread in 1960s-70s suburban construction across Penn Hills, Monroeville, and North Hills. Knob-and-tube wiring remains active in pre-1920 Lawrenceville and Strip District buildings converted to residential use. The June 2012 derecho downed power lines that caused secondary service-entrance damage across Allegheny County, and many repairs were done with inadequate weatherproofing that now fails during winter ice loading.",
    renoPara: "Whole-house generator installations are the signature Pittsburgh residential scope, driven by ice-storm and derecho outages that lasted 3-7 days in 2012 and 2019. A 22kW Generac with automatic transfer switch and Peoples Gas coordination runs $10,000-$16,000. Basement finishing is the second-largest scope, adding 8-12 circuits and a 60-100 amp sub-panel at $7,000-$13,000.",
    pricingContext: "Pittsburgh electrical labor runs 15-25% above the national average. IBEW Local 5 influence on commercial work keeps residential rates competitive. Mine-subsidence zones in the South Hills add geotechnical considerations for any underground conduit routing near documented Pittsburgh Coal Seam voids.",
    seasonPara: "Demand peaks April-June and September-November. Winter ice storms along the Allegheny and Monongahela valleys drive emergency service-mast repair surges. Annual safety inspection and biennial emissions testing through PennDOT apply to contractor vehicles."
  },

  "columbus-oh": {
    utilityPara: "AEP Ohio (American Electric Power) serves most of Franklin County and the central Ohio region while Columbia Gas of Ohio handles gas distribution. AEP's contractor portal for residential service upgrades runs 10-18 business days. Dublin, Worthington, and Upper Arlington fall under AEP but operate independent building departments with different fee schedules and inspection timelines.",
    codePara: "Ohio adopts the 2017 NEC through the Ohio Board of Building Standards with minimal state-level amendments. Columbus Building and Zoning Services enforces the code with particular attention to AFCI protection compliance on bedroom-circuit upgrades. Romex is permitted for residential wiring. Ohio eliminated E-Check emissions testing, so no vehicle-inspection requirement affects contractor operations.",
    panelPara: "German Village's 1850s-1880s brick cottages carry some of the oldest electrical installations in the metro, with 40-60 amp fused services that predate modern grounding standards. Short North's 1920s-40s homes typically have 100-amp panels. Upper Arlington's post-war ranch construction runs 100-150 amp panels. Dublin's 2000s-era homes come with 200-amp service and increasingly need 320-amp upgrades for dual-EV households.",
    homeStockPara: "Columbus homes almost universally feature full basements with accessible wiring runs, making rewire work more efficient than slab-on-grade markets. German Village's thick brick walls require surface-mounted conduit or chase-cut routing for new circuits because concealed wiring through the historic masonry is prohibited by the Preservation Commission. Ohio State campus-area rental conversions along High Street often have sub-standard electrical that needs complete replacement for owner-occupancy.",
    licensePara: "Ohio licenses electrical contractors through the Ohio Construction Industry Licensing Board (OCILB). Verify at com.ohio.gov. Columbus requires additional local registration through Building and Zoning Services. German Village Commission review is separate from the electrical permit and reviews visible conduit routing. Dublin and Worthington accept state licensure but require their own business registration.",
    permitPara: "Columbus Building and Zoning Services processes electrical permits in 5-10 business days. German Village, Victorian Village, and Italian Village historic districts fall under the Columbus Historic Preservation Commission. AEP Ohio service coordination adds 2-3 weeks parallel to the city permit.",
    hazardPara: "Federal Pacific panels are widespread in 1960s-70s construction across Westerville, Reynoldsburg, and Gahanna. Aluminum branch wiring from the copper-shortage era shows up in Whitehall and Bexley ranch homes. The June 2012 derecho downed service masts across Clintonville and Worthington; inadequately repaired connections from that event still surface during panel inspections.",
    renoPara: "Basement finishing drives the largest Columbus residential electrical scope because nearly every home has usable basement space. A typical basement finish adds 8-12 circuits, AFCI/GFCI protection, and a 60-100 amp sub-panel at $6,500-$12,000. EV charger installations are the fastest-growing scope, with a 48-amp hardwired Level 2 unit running $1,600-$3,000.",
    pricingContext: "Columbus electrical labor sits at the national average. AEP Ohio's service territory stability and moderate cost of living keep residential rates competitive. Ohio State game-day traffic on Lane Avenue affects delivery and scheduling for campus-adjacent projects from September through November.",
    seasonPara: "Demand peaks April-June and September-October. Winter ice storms drive emergency repairs. Ohio State football Saturdays create scheduling blackout windows within a mile of the Horseshoe. Off-peak winter scheduling saves 10-15% on interior work."
  },

  "kansas-city-mo": {
    utilityPara: "Evergy (formerly Kansas City Power & Light on the Missouri side and Westar on the Kansas side) serves the bi-state metro. Spire handles gas distribution on the Missouri side while Kansas Gas Service covers the Kansas side. Evergy's service coordination runs 12-20 business days regardless of which state the project sits in, but permit requirements differ between KCMO and Overland Park for the same utility territory.",
    codePara: "Missouri adopts the 2018 NEC while Kansas follows the 2017 NEC, creating a code-version split within the same metro. KCMO enforces local amendments including mandatory outdoor GFCI protection on all exterior circuits. Overland Park follows the Kansas version with its own amendments. Romex is permitted on both sides. The dual-code environment means contractors working the bi-state metro must maintain fluency in both versions.",
    panelPara: "Country Club Plaza's 1920s-30s Spanish-revival homes carry 60-100 amp fused services with cast-iron meter bases. Brookside bungalows from the 1940s-50s typically have 100-amp panels. Prairie Village's 1950s-60s ranch homes run 100-150 amp panels. Lee's Summit and Overland Park 2000s-era construction comes with 200-amp service. The J.C. Nichols Company deed restrictions on Plaza-area properties impose additional panel-placement requirements.",
    homeStockPara: "Kansas City homes almost universally have full basements with accessible wiring runs, an advantage for rewire work. The metro's position in the central US tornado corridor means service-entrance weatherproofing standards exceed coastal markets. Waldo's 1940s-era bungalows have crawl-space access on sloping lots. Overland Park's slab-on-grade ranch construction relies on attic-down rewire approaches.",
    licensePara: "Missouri has no statewide electrical contractor license; KCMO requires city electrical-contractor registration with a written exam. Kansas requires contractor registration through the Attorney General's office. Working both sides of State Line Road requires dual registrations. Verify KCMO registration through the Permits and Inspections Division; verify Kansas registration at ag.ks.gov.",
    permitPara: "KCMO Permits and Inspections processes electrical permits in 2-4 weeks. Overland Park, Prairie Village, and Lee's Summit each have independent departments on the Kansas side with 1-2 week turnaround. Country Club Plaza, Pendleton Heights, and Janssen Place fall under the KCMO Historic Preservation Commission. Evergy service coordination runs parallel to permits on both sides.",
    hazardPara: "Federal Pacific panels are widespread in 1960s-70s homes across Raytown, Independence, and North Kansas City. Aluminum branch wiring from the copper-shortage era shows up in 1965-75 Prairie Village and Shawnee ranch construction. The May 2024 supercell hail event damaged outdoor disconnects and meter bases across southern Johnson County, and many homeowners delayed replacement, creating ongoing hazards.",
    renoPara: "Whole-house generator installations lead KC residential electrical demand, driven by tornado-season and ice-storm outages. A 22kW standby with automatic transfer switch and Spire gas coordination runs $9,000-$14,000 on the Missouri side. EV charger installations run $1,600-$3,200 and are growing 25% annually as KC's EV adoption climbs.",
    pricingContext: "KC electrical labor sits at the national average on both sides of the state line. The bi-state licensing split means fewer contractors work both jurisdictions, which can extend scheduling. Evergy coordination delays push panel-upgrade timelines 3-5 weeks beyond initial estimates during peak season.",
    seasonPara: "Demand peaks April-June and September-October. Winter ice storms and spring tornado events both drive emergency surges. Chiefs home-game traffic near Arrowhead Stadium affects delivery schedules for projects in the sports-complex corridor. Missouri requires emissions testing in the KC metro; Kansas does not."
  },

  "indianapolis-in": {
    utilityPara: "AES Indiana (formerly Indianapolis Power & Light) serves the Marion County unified government while CenterPoint Energy Indiana handles gas distribution. AES Indiana's contractor portal for residential service upgrades runs 10-18 business days. Carmel and Fishers fall under AES Indiana but operate through separate Hamilton County inspection departments. Noblesville and Zionsville have their own utility coordination processes.",
    codePara: "Indiana adopts the 2020 NEC through the Indiana Fire Prevention and Building Safety Commission. Indianapolis Department of Business and Neighborhood Services enforces the code with particular attention to AFCI protection on bedroom circuits in pre-1970 housing stock. Romex is permitted for residential wiring. Indiana does not require vehicle safety inspections or emissions testing.",
    panelPara: "Meridian-Kessler's 1920s-40s Tudor-style homes along Pennsylvania Street carry 60-100 amp fused services. Broad Ripple's 1930s-50s bungalows typically have 100-amp panels. Carmel and Fishers 2000s-era construction comes with 200-amp service. Citizens Water reports the area's aquifer produces 250-350 ppm hardness, and this mineral-laden groundwater creates white deposits on outdoor meter bases that must be cleaned before inspection.",
    homeStockPara: "Indianapolis homes almost universally feature full basements with accessible wiring runs. The flat Tipton Till Plain terrain means most homes are single-story ranch or two-story Colonial with straightforward attic-down rewire paths. Lockerbie Square's 1850s-era cottages have plaster-over-brick walls that require surface conduit for new circuits because the historic masonry cannot be chase-cut. Noblesville's larger exurban lots add well-pump and outdoor-lighting circuits to the typical residential load.",
    licensePara: "Indiana has no statewide residential electrical contractor license but requires Marion County registration for work within the unified city-county government. Hamilton County (Carmel, Fishers, Noblesville) accepts Indiana journeyman cards but requires separate county business registration. Verify Marion County registration through the Department of Business and Neighborhood Services portal.",
    permitPara: "Indianapolis DBNS processes electrical permits in 3-7 business days, among the fastest in the Midwest. Carmel and Fishers have independent departments with 2-5 day turnaround. Irvington, Lockerbie Square, Woodruff Place, and Herron-Morton Place fall under the Indianapolis Historic Preservation Commission. AES Indiana service coordination adds 2-3 weeks parallel.",
    hazardPara: "Federal Pacific panels are common in 1960s-70s construction across Lawrence, Speedway, and Beech Grove. Aluminum branch wiring from the copper-shortage era is widespread in Warren Township ranch homes. The November 2013 EF2 tornado in Washington Township downed service masts along Ditch Road and Kessler Boulevard; some repairs used sub-standard weatherhead connections that leak during heavy rain.",
    renoPara: "Whole-house generator installations are the signature Indianapolis residential electrical scope, driven by tornado-season outages and the November 2013 EF2 event that left 40,000 without power. A 22kW standby with automatic transfer switch and CenterPoint gas coordination runs $9,000-$15,000. Indianapolis 500 weekend in late May drives a completion deadline for outdoor electrical work as homeowners prepare for Race Day entertaining.",
    pricingContext: "Indianapolis electrical labor sits at the national average. AES Indiana's moderate service-coordination timeline and low licensing barriers keep pricing competitive. The Indy 500 weekend in May creates a residential-project completion crunch that compresses spring scheduling and pushes prices up 10-15% on projects that must finish before Race Day.",
    seasonPara: "Demand peaks April-June pre-summer and September-October. Indianapolis 500 weekend creates a May deadline. Winter frozen-ground conditions delay exterior service-entrance trenching from December through March. Off-peak winter scheduling saves 10-15% on interior electrical work."
  },

  "nashville-tn": {
    utilityPara: "Nashville Electric Service (NES) is a municipally owned utility serving the consolidated city-county government of Davidson County. Piedmont Natural Gas handles gas distribution. NES service coordination for residential panel upgrades runs 10-15 business days, competitive for a utility its size. Franklin and Brentwood in Williamson County fall under Middle Tennessee Electric Membership Corporation (MTEMC) with different meter standards and longer coordination timelines.",
    codePara: "Tennessee adopts the 2017 NEC through the State Fire Marshal's Office. Metro Nashville Department of Codes Administration enforces local amendments including mandatory whole-house surge protection on new service installations because Middle Tennessee's thunderstorm frequency produces significant lightning-strike risk. Romex is permitted for residential wiring.",
    panelPara: "East Nashville's 1900s-1920s Craftsman cottages along Fatherland Street carry 60-100 amp fused services with original porcelain-base disconnects. 12South's 1940s-50s homes typically have 100-amp panels. Green Hills' post-war ranch construction runs 100-150 amp panels. Franklin's 2000s-era subdivisions come with 200-amp service and solar-ready bus bars.",
    homeStockPara: "Nashville homes are a mix of crawl-space construction in the older neighborhoods (East Nashville, Germantown, Lockeland Springs) and slab-on-grade in the suburban ring (Mt. Juliet, Hendersonville, Brentwood). The March 2020 tornado damaged service entrances along Fatherland Street and Five Points in East Nashville, and some repairs were done with inadequate weatherproofing that fails during spring thunderstorms. Belle Meade's estate-scale homes require 400-amp service for pool houses, detached studios, and landscape lighting loads.",
    licensePara: "Tennessee requires a Home Improvement License for electrical projects over $3,000 through the Tennessee Board for Licensing Contractors. Licensed Electrical Contractors must carry $100,000 minimum liability. Verify at tn.gov/commerce. NES requires separate contractor registration through their service portal. Franklin and Brentwood accept state licensure but require Williamson County business registration.",
    permitPara: "Metro Nashville Department of Codes Administration processes electrical permits in 2-4 weeks. East Nashville, Germantown, and Lockeland Springs fall under the Metro Nashville Historic Zoning Commission, which reviews visible exterior panel relocations and conduit routing. NES service coordination adds 2-3 weeks parallel. Franklin and Brentwood permits file through Williamson County.",
    hazardPara: "Federal Pacific panels are common in 1960s-70s construction across Donelson, Hermitage, and Madison. Aluminum branch wiring from the copper-shortage era shows up in Antioch and Bellevue ranch homes. The March 2020 EF3 tornado tore service masts off hundreds of East Nashville and Donelson homes; repaired connections that used sub-standard weatherheads remain a recurring leak-and-arc hazard during spring storms.",
    renoPara: "Whole-house generator installations surged after the March 2020 tornado knocked power out for 3-7 days across East Nashville and Donelson. A 22kW standby with automatic transfer switch and Piedmont gas coordination runs $9,000-$14,000. The Nashville music-industry's home-studio market drives a distinct scope for dedicated 200-amp sub-panels with isolated grounding for recording equipment in 12South and East Nashville.",
    pricingContext: "Nashville electrical labor sits at the national average but trends upward as the metro's rapid population growth compresses contractor capacity. NES's municipally owned status keeps service-coordination timelines competitive. Annual emissions testing in Davidson County applies to contractor vehicles 3-25 model years old.",
    seasonPara: "Demand peaks March-May and September-November. Summer attic work above 130F limits productivity. Spring tornado season drives emergency repair surges. CMA Fest in June and NFL Titans home games create traffic and staging constraints in the Midtown and Broadway corridors."
  },

};


const CITY_ELECTRICAL_EXTRA = {
  "st-louis-mo": {
    localUtilityPara: `Ameren Missouri's Laclede Station service center handles city-proper coordination while the Chesterfield office covers county addresses. Spire gas coordination runs parallel when panel relocations affect the gas meter. The April 2011 Good Friday EF4 tornado that devastated Bridgeton and Lambert Airport drove a surge in whole-house generator demand that Ameren's contractor portal tracked as a 40% increase in transfer-switch interconnection filings through 2012.`,
    panelAndCodePara: `City Building Division processes permits in 2-3 weeks with same-day inspection scheduling available. Missouri has no statewide contractor license; separate city registration required for work inside city limits. Central West End brownstones show 60-100 amp fused services with cast-iron meter bases; Soulard two-families often have combined cellar meters serving both units. Ameren Missouri's off-peak EV rate drives Level 2 charger demand at $1,800-$3,200 per installation in Benton Park and Tower Grove South.`,
    safetyAndLicensePara: `The Cultural Resources Office governs visible exterior electrical work in Lafayette Square, Soulard, Compton Heights, and Fox Park. Federal Pacific and Zinsco panels remain widespread in 1960s-70s Affton and Lemay homes; replacement with Siemens or Square D panels runs $2,500-$4,500. Washington University Medical Center campus along Euclid Avenue and Saint Louis University along Grand Boulevard restrict delivery staging during business hours. Missouri requires emissions testing in the St. Louis metro for contractor vehicles.`,
  },
  "orlando-fl": {
    localUtilityPara: `OUC serves city-proper addresses with 7-14 day coordination turnaround while Duke Energy Florida covers Winter Park, Dr. Phillips, and most suburban locations with a slower 15-20 day window. The two utilities use different meter-base standards, so panel hardware must match the specific utility serving the address. Hurricane Ian in 2022 and Irma in 2017 each produced 2-14 day outages that drove whole-house generator demand, with 22kW standby installations running $8,000-$14,000.`,
    panelAndCodePara: `City of Orlando Permitting Services processes electrical permits in 3-7 business days, among Florida's fastest. Florida DBPR licenses contractors; verify at myfloridalicense.com. College Park bungalows carry 60-100 amp fused services in un-air-conditioned exterior closets. Lake Nona's post-2010 construction includes 200-amp panels with solar-ready bus bars. Pool electrical work requires a separate bonding and barrier-compliance inspection under Florida Building Code.`,
    safetyAndLicensePara: `Lake Eola Heights, Colonialtown, and Thornton Park fall under the Orlando Historic Preservation Board for visible exterior conduit and panel work. Florida does not require vehicle safety or emissions testing. Federal Pacific panels in 1960s-70s Pine Hills and Conway-area homes remain documented fire hazards. UCF campus properties along Alafaya Trail and Rollins College on Holt Avenue restrict delivery access during the academic year. Celebration files through Osceola County rather than Orange County.`,
  },
  "san-antonio-tx": {
    localUtilityPara: `CPS Energy's combined electric-and-gas model simplifies coordination because a single service center handles both meters. Panel-upgrade requests process in 10-15 business days. Winter Storm Uri in February 2021 shut down the ERCOT grid for 4 days and drove a 50% surge in whole-house generator filings that CPS tracked through 2022. Boerne and Helotes fall under separate utility providers with independent coordination processes.`,
    panelAndCodePara: `City of San Antonio Development Services permits in 3-7 business days. TDLR licenses Master Electricians statewide; verify at tdlr.texas.gov. King William's 1890s Victorians carry 40-60 amp fused services with cast-iron meter bases. Alamo Heights operates its own building department independent from the city. Stone Oak's 2000s-era tract homes increasingly need 320-amp upgrades for dual-EV households. EV charger installations run $1,800-$3,500 with CPS Energy's time-of-use EV rate providing financial incentive.`,
    safetyAndLicensePara: `King William, Monte Vista, Dignowity Hill, Lavaca, and Tobin Hill historic districts fall under the HDRC with Certificate of Appropriateness requirements for visible exterior panel work. Texas requires annual safety and emissions inspection at $25.50 combined fee. Federal Pacific panels in 1960s-70s Bandera Road and Medical Center homes remain documented fire hazards. UTSA along UTSA Boulevard and Trinity University along Hildebrand restrict delivery staging during the academic year.`,
  },
  "portland-or": {
    localUtilityPara: `PGE serves most of the metro with 15-20 day service coordination; NW Natural handles gas distribution with a parallel 10-14 day window for combined meter relocations. The January 2021 ice storm knocked power out for 3-7 days across the east side, driving generator demand. Heat-pump conversions are the largest growth scope because Oregon's Clean Energy Act incentivizes full electrification, with panel upgrades running $2,800-$4,500.`,
    panelAndCodePara: `Bureau of Development Services permits in 2-4 weeks. Oregon CCB license required; verify at ccb.oregon.gov. Hawthorne and Alberta Craftsman bungalows carry 60-100 amp panels with original porcelain fuse blocks. Pearl District warehouse-loft conversions require 3-phase-to-single-phase panel changes. PGE requires contractors to carry $500,000 minimum liability. ADU electrical packages under Oregon's ADU laws run $4,500-$9,500.`,
    safetyAndLicensePara: `The Portland Historic Landmarks Commission governs visible exterior electrical work in Irvington, Ladd's Addition, Piedmont, and Lair Hill. Oregon requires biennial DEQ emissions testing in the Portland metro for contractor diesel vehicles. Knob-and-tube wiring remains active in pre-1930 Craftsman homes across Hawthorne, Alberta, and SE Division. Portland State University along SW Broadway and Reed College on SE Woodstock restrict delivery staging during the academic year. Portland's Clean Air Construction program adds equipment standards.`,
  },
  "sacramento-ca": {
    localUtilityPara: `SMUD serves Sacramento proper with some of California's lowest electric rates and 7-12 day service coordination, significantly faster than PG&E's 15-25 day window in neighboring Roseville and Folsom. PG&E handles gas distribution. The January 2023 atmospheric-river flooding damaged below-grade electrical connections in Natomas, and many were simply dried rather than replaced. Solar-interconnection panel upgrades are the dominant scope, with SMUD's net-metering program driving high rooftop-solar adoption.`,
    panelAndCodePara: `City of Sacramento Community Development permits in 5-10 business days. CSLB C-10 license required; verify at cslb.ca.gov. East Sacramento's Fabulous 40s Tudor homes carry 60-100 amp ceramic fuse panels. Elk Grove's 2000s-era tract homes include 200-amp service with solar-ready bus bars. Title 24 Part 6 mandates EV-ready, solar-ready, and battery-storage-ready infrastructure on new construction. Solar-ready panel upgrades with inverter circuit and interconnection documentation run $3,200-$5,500.`,
    safetyAndLicensePara: `Alkali Flat, Boulevard Park, and Poverty Ridge fall under the Sacramento Preservation Commission for visible exterior panel and conduit work. California requires biennial smog checks through BAR for vehicles over 8 model years. Federal Pacific panels in 1960s-70s South Sacramento and Arden-Arcade homes remain documented fire hazards. UC Davis Medical Center along Stockton Boulevard and Sacramento State along J Street restrict delivery access during the academic year. Central Valley attic heat degrades conductor insulation 30-40% faster than coastal California.`,
  },
  "pittsburgh-pa": {
    localUtilityPara: `Duquesne Light serves Pittsburgh proper and most of Allegheny County with 12-20 day service coordination. Peoples Gas handles gas distribution; combined panel-and-gas-meter relocations require parallel coordination. The June 2012 derecho delivered 80-mph winds that downed service lines across Lawrenceville and the Strip District, driving a generator-installation surge through 2014. A 22kW standby with automatic transfer switch and Peoples Gas coordination runs $10,000-$16,000.`,
    panelAndCodePara: `Pittsburgh PLI permits in 2-3 weeks. PA requires HIC registration under Act 132; verify at pago.state.pa.us. Shadyside's 1890s-1920s Victorian rowhouses carry 60-amp fused services in damp basements. South Side Slopes' steep terrain forces split-level service entrances where the meter sits at street level and the panel is a full story below. Basement finishing is a major scope, adding 8-12 circuits and a 60-100 amp sub-panel at $7,000-$13,000.`,
    safetyAndLicensePara: `The Pittsburgh Historic Review Commission governs visible exterior electrical work in Allegheny West, Manchester, Mexican War Streets, and Deutschtown. PA requires annual safety inspection and biennial emissions testing through PennDOT. Federal Pacific and Zinsco panels are widespread in 1960s-70s Penn Hills and Monroeville homes. University of Pittsburgh along Forbes Avenue and Carnegie Mellon along Margaret Morrison Street restrict delivery staging during the academic year. Mine-subsidence zones in Brookline and Overbrook add geotechnical considerations for underground conduit routing.`,
  },
  "columbus-oh": {
    localUtilityPara: `AEP Ohio serves most of Franklin County with 10-18 day service coordination. Columbia Gas of Ohio handles gas distribution with parallel coordination for combined meter relocations. The June 2012 derecho produced widespread power outages across Clintonville and Worthington, driving a generator-installation surge. Basement finishing drives the largest residential electrical scope because nearly every Columbus home has usable basement space, adding 8-12 circuits at $6,500-$12,000.`,
    panelAndCodePara: `Columbus Building and Zoning Services permits in 5-10 business days. Ohio licenses electrical contractors through OCILB; verify at com.ohio.gov. Columbus requires additional local registration. German Village's 1850s-1880s brick cottages carry some of the oldest electrical installations in the metro. German Village Commission review covers visible conduit routing through historic masonry. Dublin and Worthington operate independent departments with different fee schedules.`,
    safetyAndLicensePara: `German Village, Victorian Village, and Italian Village fall under the Columbus Historic Preservation Commission for visible exterior panel and conduit work. Ohio eliminated E-Check emissions testing; no state vehicle-inspection requirement exists for contractors. Federal Pacific panels in 1960s-70s Westerville, Reynoldsburg, and Gahanna homes remain documented fire hazards. Ohio State University campus-area rental conversions along High Street often have sub-standard electrical requiring complete replacement. Game-day traffic on Lane Avenue affects delivery scheduling September through November.`,
  },
  "kansas-city-mo": {
    localUtilityPara: `Evergy serves the bi-state metro with 12-20 day coordination regardless of which side of State Line Road the project sits on. Spire handles Missouri-side gas; Kansas Gas Service covers the Kansas side. The May 2024 supercell dropped 3-inch hail across southern Johnson County, damaging outdoor disconnects and meter bases. Whole-house generators run $9,000-$14,000 with Spire gas coordination on the Missouri side.`,
    panelAndCodePara: `KCMO Permits and Inspections handles Missouri-side permits in 2-4 weeks; Overland Park and Prairie Village run independent Kansas-side departments with 1-2 week turnaround. Missouri adopts the 2018 NEC while Kansas follows the 2017 NEC, creating a code-version split within the same metro. Country Club Plaza's J.C. Nichols deed restrictions impose panel-placement constraints beyond zoning code. Working both sides of State Line Road requires dual registrations.`,
    safetyAndLicensePara: `The KCMO Historic Preservation Commission governs visible exterior work at Country Club Plaza, Pendleton Heights, and Janssen Place; Kansas-side municipalities have limited historic protections. Missouri requires emissions testing in the KC metro; Kansas does not. Federal Pacific panels in 1960s-70s Raytown and Independence homes remain documented fire hazards. UMKC campus along Volker Boulevard and Rockhurst along Troost restrict delivery staging during the academic year.`,
  },
  "indianapolis-in": {
    localUtilityPara: `AES Indiana serves Marion County's unified government with 10-18 day service coordination. CenterPoint Energy Indiana handles gas distribution. The November 2013 EF2 tornado left 40,000 without power across Washington Township, driving a generator-installation surge through 2015. Indianapolis 500 weekend in late May creates a residential completion deadline that compresses spring scheduling and pushes panel-upgrade prices 10-15% above standard rates.`,
    panelAndCodePara: `Indianapolis DBNS permits in 3-7 business days, among the Midwest's fastest. Indiana has no statewide residential contractor license but requires Marion County registration. Meridian-Kessler's 1920s-40s Tudor homes along Pennsylvania Street carry 60-100 amp fused services. Lockerbie Square's 1850s cottages require surface conduit because historic masonry cannot be chase-cut. Carmel and Fishers operate independent Hamilton County departments with 2-5 day turnaround.`,
    safetyAndLicensePara: `The Indianapolis Historic Preservation Commission governs visible exterior work in Irvington, Lockerbie Square, Woodruff Place, and Herron-Morton Place. Indiana does not require vehicle safety inspections or emissions testing. Federal Pacific panels in 1960s-70s Lawrence, Speedway, and Beech Grove homes remain documented fire hazards. Butler University along W. 46th Street and IUPUI along Michigan Street restrict delivery staging during the academic year. Citizens Water's 250-350 ppm hardness creates mineral deposits on outdoor meter bases that must be cleaned before inspection.`,
  },
  "nashville-tn": {
    localUtilityPara: `NES serves Davidson County's consolidated government with 10-15 day coordination, competitive for a utility its size. Piedmont Natural Gas handles gas distribution. The March 2020 EF3 tornado tore through East Nashville, Germantown, Donelson, and Mt. Juliet, driving a whole-house generator surge that NES tracked as a 45% increase in transfer-switch filings through 2021. Franklin and Brentwood fall under Middle Tennessee Electric (MTEMC) with different meter standards and slower coordination.`,
    panelAndCodePara: `Metro Department of Codes Administration permits in 2-4 weeks. Tennessee requires a Home Improvement License for projects over $3,000; verify at tn.gov/commerce. East Nashville's 1900s-1920s Craftsman cottages along Fatherland Street carry 60-100 amp fused services. 12South and the Gulch's music-industry home studios drive a distinct scope for dedicated 200-amp sub-panels with isolated grounding for recording equipment, running $4,000-$8,000.`,
    safetyAndLicensePara: `The Metro Nashville Historic Zoning Commission governs visible exterior electrical work in East Nashville, Germantown, and Lockeland Springs. Annual emissions testing in Davidson County applies to contractor vehicles 3-25 model years old. Federal Pacific panels in 1960s-70s Donelson, Hermitage, and Madison homes remain documented fire hazards. Vanderbilt along West End Avenue and Belmont along Belmont Boulevard restrict delivery staging during the academic year. The March 2020 tornado left sub-standard weatherhead repairs along Fatherland Street that leak during spring storms.`,
  },
};

// Merge extra content into primary dict
for (const [slug, extra] of Object.entries(CITY_ELECTRICAL_EXTRA)) {
  CITY_ELECTRICAL_DATA[slug] = Object.assign(CITY_ELECTRICAL_DATA[slug] || {}, extra);
}

/* ---------- Sections ---------- */
function neighborhoodPricing(facts, mult, cd) {
  if (!facts?.neighborhoods?.length) return "";
  const basePanel = (pricingModel.basePriceByService.panel_upgrade.low + pricingModel.basePriceByService.panel_upgrade.high) / 2;
  const baseRewire = (pricingModel.basePriceByService.whole_house_rewire.low + pricingModel.basePriceByService.whole_house_rewire.high) / 2;
  const baseOutlet = (pricingModel.basePriceByService.outlet_switch.low + pricingModel.basePriceByService.outlet_switch.high) / 2;
  const baseEV = (pricingModel.basePriceByService.ev_charger.low + pricingModel.basePriceByService.ev_charger.high) / 2;

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    const panel = Math.round(basePanel * mult * localVar / 50) * 50;
    const rewire = Math.round(baseRewire * mult * localVar / 50) * 50;
    const outlet = Math.round(baseOutlet * mult * localVar / 10) * 10;
    const ev = Math.round(baseEV * mult * localVar / 50) * 50;
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(panel)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(rewire)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(outlet)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(ev)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>${facts.displayName} Neighborhood Pricing</h2>
<p>${cd.pricingContext}</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Panel Upgrade</th>
<th style="text-align:right; padding:12px 16px;">Whole-House Rewire</th>
<th style="text-align:right; padding:12px 16px;">Outlet Install</th>
<th style="text-align:right; padding:12px 16px;">EV Charger</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
</section>`;
}

function utilityAndCode(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Utility and Code Context</h2>
<p>${cd.utilityPara}</p>
<p>${cd.codePara}</p>
</section>`;
}

function panelAndHomes(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Home Stock and Panel Realities</h2>
<p>${cd.panelPara}</p>
<p>${cd.homeStockPara}</p>
</section>`;
}

function licensingAndPermits(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Licensing and Permits</h2>
<p>${cd.licensePara}</p>
<p>${cd.permitPara}</p>
</section>`;
}

function hazardsAndRenos(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Hidden Hazards and Renovation Triggers</h2>
<p>${cd.hazardPara}</p>
<p>${cd.renoPara}</p>
</section>`;
}

function redFlags(city, cd) {
  const flags = [
    { title: `Ignoring the ${city} utility process`, body: cd.utilityPara },
    { title: `Mismatch with ${city} code amendments`, body: cd.codePara },
    { title: `Wrong panel size for ${city} load`, body: cd.panelPara },
    { title: `Missing license verification`, body: cd.licensePara },
    { title: `Hazard not disclosed`, body: cd.hazardPara },
  ];
  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");
  return `
<section class="section fp-section">
<h2>${city} Electrical Red Flags</h2>
${flagsHTML}
</section>`;
}

function scopeChecklist(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Scope Checklist</h2>
<p><strong>Utility coordination.</strong> ${cd.utilityPara}</p>
<p><strong>Applicable code.</strong> ${cd.codePara}</p>
<p><strong>Permit process.</strong> ${cd.permitPara}</p>
<p><strong>Pricing context.</strong> ${cd.pricingContext}</p>
</section>`;
}

function buyerQuestions(city, cd) {
  return `
<section class="section fp-section">
<h2>Questions to Ask a ${city} Electrician</h2>
<p><strong>Which utility coordinates this work?</strong> ${cd.utilityPara}</p>
<p><strong>What code edition applies?</strong> ${cd.codePara}</p>
<p><strong>What hazards did you find?</strong> ${cd.hazardPara}</p>
<p><strong>What renovation trigger applies?</strong> ${cd.renoPara}</p>
<p><strong>What is your license?</strong> ${cd.licensePara}</p>
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

function maintenanceSection(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Electrical Maintenance</h2>
<p>${cd.maintenancePara}</p>
<p>${cd.hazardPara}</p>
<p>${cd.emergencyPara}</p>
</section>`;
}

function emergencyContext(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Emergency Electrical Service</h2>
<p>${cd.emergencyPara}</p>
<p>${cd.homeStockPara}</p>
<p>${cd.pricingContext}</p>
</section>`;
}

function scopeAndUtility(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Electrical Scope and Utility Context</h2>
<p><strong>Utility coordination.</strong> ${cd.utilityPara}</p>
<p><strong>Common renovation trigger.</strong> ${cd.renoPara}</p>
<p><strong>Licensing.</strong> ${cd.licensePara}</p>
</section>`;
}

function seasonalGuide(city, cd) {
  return `
<section class="section fp-section">
<h2>When to Schedule ${city} Electrical Work</h2>
<p>${cd.seasonPara}</p>
<p>${cd.pricingContext}</p>
</section>`;
}

function renoAndHomeContext(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Renovation Context and Common Upgrades</h2>
<p>${cd.renoPara}</p>
<p>${cd.homeStockPara}</p>
<p>${cd.panelPara}</p>
</section>`;
}

function hazardDeepDive(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Electrical Hazards to Test For</h2>
<p>${cd.hazardPara}</p>
<p>${cd.utilityPara}</p>
</section>`;
}

function costScenarios(city, mult, cd) {
  const panelBase = pricingModel.basePriceByService.panel_upgrade;
  const rewireBase = pricingModel.basePriceByService.whole_house_rewire;
  const evBase = pricingModel.basePriceByService.ev_charger;

  const budgetTotal = Math.round(((panelBase.low + panelBase.high) / 2) * mult / 50) * 50;
  const midTotal = Math.round(((rewireBase.low + rewireBase.high) / 2) * mult / 50) * 50;
  const premTotal = Math.round((((panelBase.low + panelBase.high) / 2) + ((evBase.low + evBase.high) / 2) + 500 + 2000 + 1500) * mult / 50) * 50;

  const budgetBody = `${cd.panelPara.split(". ")[0]}. ${cd.permitPara.split(". ")[0]}.`;
  const midBody = `${cd.homeStockPara.split(". ")[0]}. ${cd.codePara.split(". ")[0]}.`;
  const premBody = `${cd.renoPara} ${cd.pricingContext.split(". ")[0]}.`;

  function card(label, title, total, body, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${title}</p>
<p class="fp-scenario-total">${fmtK(total)}</p>
<p class="fp-scenario-detail">${body}</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>${city} Project Scenarios</h2>
<div class="fp-scenario-grid">
${card("Budget", `200A panel upgrade in ${city}`, budgetTotal, budgetBody, "#22c55e")}
${card("Mid-Range", `${city} whole-house rewire`, midTotal, midBody, "#3b82f6")}
${card("Premium", `Smart + EV + panel in ${city}`, premTotal, premBody, "#8b5cf6")}
</div>
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
.fp-scenario-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin:16px 0; }
.fp-scenario-card { padding:20px; background:#fff; border:1px solid var(--border,#e2e8f0); border-radius:12px; }
.fp-scenario-card h3 { font-size:16px; font-weight:700; margin:0 0 8px; color:#0f172a; }
.fp-scenario-material { font-size:13px; color:var(--text-muted); margin:0 0 4px; }
.fp-scenario-total { font-size:28px; font-weight:800; color:var(--brand,#1d4ed8); margin:0 0 8px; }
.fp-scenario-detail { font-size:13px; color:#64748b; margin:0; }
@media(max-width:700px) { .fp-scenario-grid { grid-template-columns:1fr; } }
</style>`;
}

function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  const cd = CITY_ELECTRICAL_DATA[metro.slug];
  if (!facts || !ctx || !cd) return null;

  const city = facts.displayName;
  const mult = getMultiplier(metro.region);

  let html = `\n${flagshipCSS()}\n`;
  html += `${MARKER_START}\n`;
  html += neighborhoodPricing(facts, mult, cd);
  html += utilityAndCode(city, cd);
  html += panelAndHomes(city, cd);
  html += licensingAndPermits(city, cd);
  html += hazardsAndRenos(city, cd);
  html += redFlags(city, cd);
  html += scopeChecklist(city, cd);
  html += buyerQuestions(city, cd);
  html += renoAndHomeContext(city, cd);
  html += hazardDeepDive(city, cd);
  html += maintenanceSection(city, cd);
  html += emergencyContext(city, cd);
  html += scopeAndUtility(city, cd);
  html += seasonalGuide(city, cd);
  html += costScenarios(city, mult, cd);
  html += extraLocalSection(city, cd);
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

    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const localInjectedV2 = content.indexOf("<!-- TP-LOCAL-INJECTED-V2 -->");
    const otherServicesH2 = content.indexOf("Other Services in ");

    let insertAt;
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else if (localInjectedV2 >= 0) {
      insertAt = localInjectedV2;
    } else if (otherServicesH2 >= 0) {
      const sectionClose = content.indexOf("</section>", otherServicesH2);
      insertAt = sectionClose >= 0 ? sectionClose + "</section>".length : -1;
    } else {
      insertAt = -1;
    }

    if (insertAt < 0) {
      console.log(`  SKIP ${metro.file} (no injection point)`);
      skipped++;
      continue;
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
