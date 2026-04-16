#!/usr/bin/env node
/**
 * Generates deep, metro-unique editorial content for 20 flagship metro
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
    seasonPara: "NYC electrical demand peaks in spring before summer AC season (April-June) and in fall before heating season (September-November). Winter schedules are softer and most reputable firms offer 8-12% off-season discounts on non-emergency work."
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
    seasonPara: "LA electrical demand peaks in summer (June-September) when AC load discoveries drive panel upgrade demand. Fall-winter scheduling is easier and typically 8-12% cheaper. Santa Ana wind events in October create brief emergency demand spikes for storm-damage work."
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
    seasonPara: "Chicago electrical demand follows home-sale cycles with spring-summer peaks. Winter months are 10-15% cheaper and reputable contractors use winter for interior work. The March frost-law period affects utility trenching schedules for service upgrades."
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
    seasonPara: "Houston electrical demand peaks March-May (pre-summer panel upgrade push) and October-November (post-hurricane repair season). Summer heat makes attic work dangerous and slows residential rewire productivity; reputable contractors run 7am-1pm shifts to avoid afternoon heat."
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
    seasonPara: "Phoenix electrical demand peaks October-April when crew productivity is highest. May-September attic work is limited to early-morning shifts. Post-monsoon emergency repairs (July-September) drive 25-40% premium pricing on after-hours service calls."
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
    seasonPara: "DFW electrical demand peaks February-May (post-winter panel upgrade push) and September-November. Summer heat and winter ice events both drive emergency service calls. Off-peak scheduling saves 8-15% on labor."
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
    seasonPara: "Atlanta electrical demand peaks February-April (pre-summer AC push) and September-October. Summer thunderstorms drive emergency service demand. Winter tornado outbreaks (January-March) produce periodic emergency-repair spikes."
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
    seasonPara: "Denver electrical demand peaks April-June and September-October. Summer thunderstorm damage and winter ice storms both drive emergency repair demand. Winter exterior work on meter bases and service masts requires heated enclosures that add 10-15% to labor."
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
    seasonPara: "Seattle electrical demand is steadier year-round than most markets because temperate weather allows continuous exterior work. June-September dry months are best for any work requiring roof or exterior wall access. Fall-winter rainfall can delay exterior service-mast work."
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
    seasonPara: "Austin electrical demand peaks March-May and September-November. Summer heat makes attic work hazardous; productive attic shifts are 6am-10am only. Winter ice events produce periodic emergency-repair spikes."
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
    seasonPara: "SF electrical demand is relatively steady year-round because of mild weather. PSPS events in September-November create emergency generator and transfer-switch demand spikes. Winter atmospheric-river storms drive moisture-intrusion service calls."
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
    seasonPara: "Las Vegas electrical demand peaks October-April. Summer attic work is limited to early-morning shifts (6am-10am). Monsoon storm damage in July-September drives emergency service calls with significant after-hours premiums."
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
    seasonPara: "Philadelphia electrical demand peaks March-May and September-November. Rowhouse access constraints make winter interior work the preferred scheduling window. Summer humidity limits attic productivity."
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
    seasonPara: "Miami electrical demand peaks February-May and October-December (hurricane season prep and recovery). Summer heat and hurricane-season staging constraints limit productive outdoor work. Post-storm emergency pricing can run 2-3x standard rates."
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
    seasonPara: "Boston electrical demand peaks April-June and September-October. Winter ice-storm emergency repairs and summer AC-load panel upgrades are the two demand spikes. Winter exterior work requires heated enclosures that add 10-15%."
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
    seasonPara: "San Diego electrical demand is steady year-round because of mild weather. PSPS events in September-October drive generator and transfer-switch demand spikes. Coastal atmospheric-river events in winter produce localized storm-damage work."
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
    seasonPara: "Tampa electrical demand peaks February-May (pre-hurricane-season generator installs) and October-December (post-storm repairs). Summer heat and hurricane-season staging limits outdoor work productivity. Winter (December-February) is the slack-demand window."
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
    seasonPara: "Detroit electrical demand peaks April-June and September-October. Winter ice storms drive emergency service-mast repairs. MDOT frost law affecting utility trenching schedules narrows the spring window for service-upgrade trench work."
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
    seasonPara: "Twin Cities electrical demand peaks May-July (post-winter service-upgrade push) and September-October. November-March is constrained by frozen-ground policy. Emergency winter service-mast repairs after ice storms drive periodic demand spikes."
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
    seasonPara: "Charlotte electrical demand peaks March-May and September-October. Summer thunderstorms drive emergency service-mast work. Winter ice-storm emergencies (January-February) produce periodic demand spikes."
  }
};

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
  html += seasonalGuide(city, cd);
  html += costScenarios(city, mult, cd);
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
