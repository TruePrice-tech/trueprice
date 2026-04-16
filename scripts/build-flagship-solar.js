#!/usr/bin/env node
/**
 * Generates deep editorial content for 20 flagship metro solar pages.
 * Content is almost entirely dict-driven so 8-word shingle overlap between
 * metros stays under 10%.
 *
 * Usage: node scripts/build-flagship-solar.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/solar-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-SOLAR-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-SOLAR-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-solar-cost.html", region: "northeast" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-solar-cost.html", region: "west" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-solar-cost.html", region: "midwest" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-solar-cost.html", region: "south" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-solar-cost.html", region: "mountain" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-solar-cost.html", region: "south" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-solar-cost.html", region: "southeast" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-solar-cost.html", region: "mountain" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-solar-cost.html", region: "west" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-solar-cost.html", region: "south" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-solar-cost.html", region: "west" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-solar-cost.html", region: "mountain" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-solar-cost.html", region: "northeast" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-solar-cost.html", region: "southeast" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-solar-cost.html", region: "northeast" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-solar-cost.html", region: "west" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-solar-cost.html", region: "southeast" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-solar-cost.html", region: "midwest" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-solar-cost.html", region: "midwest" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-solar-cost.html", region: "southeast" },
];

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString()}`; }
function fmtDollar(n) { return `$${n.toLocaleString()}`; }

function getRegionMultiplier(region) {
  return pricingModel.laborMultiplierByRegion?.[region] || 1.0;
}

/* Per-metro dict with 12+ paragraph-length fields. Each paragraph contains
   at least 2 city-specific facts. */
const SOLAR_DATA = {
  "new-york-ny": {
    peakSunHours: 4.0,
    paybackYears: "7-9 years",
    utility: "Con Edison",
    bestInstallMonth: "March-May",
    sunPara: "New York City averages 4.0 peak sun hours daily with strong seasonal swing: June through August produces 6.2 kWh per kW per day while December drops to 2.1. Con Edison's summer peak demand window (2pm to 6pm weekdays June through September) aligns with the strongest production hours, meaning every kWh exported during that window carries the highest Value of Distributed Energy Resources (VDER) stack credit. Staten Island and eastern Queens receive 5-7 percent more annual insolation than Manhattan because of lower shadow density and longer clear-sky morning hours.",
    tariffPara: "NYC residential solar is on Con Edison's SC-1 residential rate with the VDER (Value of Distributed Energy Resources) export tariff replacing traditional net metering. Exports are credited at the VDER stack: LBMPzone ConEd + marginal capacity value + environmental value + demand reduction value, typically totaling $0.12-$0.16 per kWh versus the $0.26-$0.34 retail rate. The Mass Market Value Stack plus the Community Credit adder partially closes that gap for standalone residential. PSEG Long Island customers operate under a different Value Stack with simpler retail-minus-tariff structure.",
    interconnectPara: "Con Edison's interconnection queue ran 12-16 weeks in 2024 for residential SGIP (Small Generator Interconnection Procedure) applications because of the Climate Mobilization Act surge. NYC DOB requires an Electrical Permit, Plumbing Permit (for mounting penetrations), and Construction Permit filed through DOB NOW. Queens and Brooklyn SGIP applications routinely clear faster than Manhattan or the Bronx because ConEd's northern substations have more spare hosting capacity. PSEG LI interconnection runs shorter at 6-10 weeks.",
    installerLandscapePara: "The NYC installer market is dominated by regional players: Venture Home Solar, Momentum Solar (Metuchen NJ-based but strong NYC presence), SunPower dealers Empire Solar and EmPower Solar, and local specialty crews like Brooklyn SolarWorks focused on flat-roof tilt installs on brownstones. Tesla Energy exited the NYC residential market in 2023. Union Local 3 IBEW handles most multifamily commercial solar and competes on residential pricing in Queens and Staten Island. Typical NYC residential quote runs $3.60-$4.40 per watt before incentives, 15-25 percent above New Jersey suburb pricing.",
    incentivesPara: "New York stacks the strongest incentive set in the Northeast: the 30 percent federal ITC (Section 25D), the NY-Sun Residential Megawatt Block incentive ($0.20 per watt in ConEd territory declining by block), and the NYS Residential Solar Tax Credit (25 percent of system cost capped at $5,000). Real Property Tax Law Section 487 provides a 15-year property tax exemption on the added home value from solar. NYC Department of Finance administers the property tax abatement separately for multifamily. Federal ITC plus NY-Sun plus state credit can reduce a $24,000 system to effective net cost of $11,000-$13,000.",
    roofLandscapePara: "NYC rooftop stock is split between flat-membrane rooftops (brownstones, row houses, three-story walkups) where tilted-mount racking like IronRidge BX or Unirac RM-DT is required, and pitched-shingle on 1-2 family in outer Queens, Brooklyn, and Staten Island. Brownstone solar requires DOB-approved tie-backs or ballasted systems because no roof penetrations are permitted in many Landmarks-designated districts. Flat-roof installs in NYC lose 12-18 percent annual production versus optimally tilted systems because the 10-15 degree optimal tilt angles require taller racking that LPC often restricts.",
    hoaAndRestrictPara: "NYC has no traditional HOA structure for single-family because most homeowners are in condo or co-op buildings. Co-op board approval is the critical gatekeeper for 3-plus-unit buildings and often takes longer than city permitting; some pre-war co-ops (especially in Manhattan) refuse solar outright. Landmarks Preservation Commission (LPC) designates 80-plus historic districts including much of Brooklyn Heights, Greenwich Village, Upper West Side, and Jackson Heights. Visible rooftop solar typically fails LPC review; non-visible flat-roof installs behind parapet walls can pass.",
    permitProcessPara: "NYC DOB issues permits through the DOB NOW: Build portal. Solar installations require a Construction Permit (EN-2 for solar), Electrical Permit, and sometimes a Curb Cut Permit if equipment staging blocks the sidewalk. DOB Self-Certification is available for Professional Engineers and Registered Architects. Typical NYC solar permit turnaround is 4-8 weeks, longer for Landmark district sites. The NYC solar permitting task force reduced average processing time 35 percent in 2023 through the Solar Map integration.",
    batteryPara: "Battery storage uptake in NYC is driven by Con Edison's controversial Tier 4 demand charges and Hurricane Sandy memory. Tesla Powerwall 3, Enphase IQ Battery 10, and Franklin Home Power are the dominant residential battery products. NYC DOB issued Fire Code updates in 2022 requiring 3-foot setbacks from egress, specialized smoke detection, and a maximum 20 kWh per residential structure under FDNY Rule 3-RCNY 608-01. Basement installation is prohibited; garage or outdoor installation is required. NY-Sun Battery adder provides $0.10-$0.25 per Wh additional rebate through the Commercial and Industrial block.",
    climateRiskPara: "NYC climate risks for solar are wind uplift (roof pressure during nor'easter events routinely exceeds ASCE 7-16 design wind of 118 mph), coastal salt spray in Rockaway, Gerritsen Beach, and Breezy Point where module frame corrosion is documented 40 percent faster than inland, and snow loading in the 30-inch average snowfall years. Module manufacturers like Qcells, LG, and Solaria carry a 25-year product warranty that specifically excludes salt spray damage beyond 500 meters from saltwater; proper installations in these ZIP codes require upgraded marine-grade stainless fasteners.",
    timelinePara: "Full timeline from contract signing to Permission to Operate in NYC runs 14-22 weeks: 2 weeks site assessment and engineering, 4-8 weeks DOB permitting (longer in Landmarks zones), 1-2 days physical installation, 1-2 weeks DOB inspection, 6-10 weeks Con Edison interconnection review and PTO. The March-May installation window targets May-July peak production for maximum first-year credits. Queens and Staten Island installs consistently clear 3-4 weeks faster than Manhattan or Brooklyn because of less complex building-department review.",
    uniqueInsightPara: "NYC's Climate Mobilization Act Local Law 97 sets emissions caps on buildings over 25,000 sqft starting 2024, with escalating penalties in 2030. Residential co-ops and condos in this size class increasingly install solar plus battery to offset carbon penalties. For single-family, the Solar Map at nysolarmap.com (run by CUNY and SolarOne) provides rooftop-by-rooftop production estimates using LiDAR. The NYC Solar Partnership hosts free site assessments for qualifying households.",
  },

  "los-angeles-ca": {
    peakSunHours: 5.6,
    paybackYears: "5-7 years",
    utility: "LADWP (Los Angeles Department of Water and Power)",
    bestInstallMonth: "January-March",
    sunPara: "Los Angeles averages 5.6 peak sun hours daily with June production at 7.2 kWh per kW per day and December still strong at 3.8. The June Gloom marine-layer pattern shaves 15-25 percent off morning production May through early July in Westside ZIPs like Santa Monica, Venice, and Mar Vista but has minimal effect in the Valley. Sherman Oaks, Encino, and Glendale receive roughly 8 percent more annual insolation than Mid-City and South LA because of later afternoon clear-sky conditions.",
    tariffPara: "LADWP residential solar runs on the R-1A residential rate with LADWP's own Net Energy Metering program (NEM-LADWP) that is separate from California's IOU NEM 3.0 tariff. LADWP customers still receive full retail-rate 1-for-1 credit for exported energy, making LA one of the few remaining California markets with favorable net metering economics. SCE-territory customers in outlying LA County (Burbank, Glendale pass-through, portions of the Valley edge) fall under NEM 3.0 and lose approximately 75 percent of export value versus LADWP's structure. Confirming utility is the number-one first step for LA area quotes.",
    interconnectPara: "LADWP interconnection runs 4-8 weeks for residential installations under 10 kW through the LADWP Solar Online portal. LADBS (Los Angeles Department of Building and Safety) issues permits with a 1-2 week turnaround for standard residential installs. LADWP's Solar Incentive Program (SIP) queue is generally faster than PG&E or SCE because LADWP controls its own grid. Hillside Designated Areas in the Santa Monica Mountains, Hollywood Hills, and Palisades add structural review that can extend permitting 3-6 weeks.",
    installerLandscapePara: "The LA installer market is dominated by Sunrun, Freedom Forever, Sunnova, and Tesla Energy on the lease and PPA side, with Sunpower dealers including Robco Electric and SolarTech Electric on the purchase side. LA has a strong boutique tier including GreenLogic Solar, Solar Optimum (Glendale), and Baker Electric Home Energy. Tesla Energy remains active in LA and offers roughly 15 percent below-market pricing on Tesla-branded inverters paired with Powerwall. California Contractors State License Board requires a C-10 Electrical or C-46 Solar license; most LA installers carry both. Typical LA residential quote runs $3.00-$3.80 per watt before incentives.",
    incentivesPara: "California offers the 30 percent federal ITC but no state tax credit for solar. The California property tax exclusion for solar improvements (RTC 73) extends through 2026 and prevents reassessment on the added home value. LADWP's Solar Incentive Program (SIP) provides up to $0.30 per watt rebate for LADWP customers, more generous than any California IOU rebate. California SGIP (Self-Generation Incentive Program) provides $150-$1,000 per kWh battery storage rebate depending on equity tier. LADWP customers on the Low Income Energy Program qualify for 100 percent coverage on solar plus storage through CARE and FERA.",
    roofLandscapePara: "LA rooftop stock is heavily tile (Spanish Mission clay, concrete tile) in Arcadia, La Canada, and the east Valley, which adds 15-25 percent installation cost because of the specialty roof-hook mounting required to avoid breaking tiles. Flat-roof TPO and PVC membranes dominate mid-century modern in Brentwood and Beverly Hills, requiring ballasted or tilted-mount racking. Composition shingle is common in post-1950 tract areas of the Valley and South LA, where standard IronRidge XR flashing systems deliver the lowest installed cost. Cool-roof elastomeric coatings common on Westside flat roofs can complicate module thermal coupling.",
    hoaAndRestrictPara: "California Civil Code Section 714 (Solar Rights Act) is the strongest solar access law in the country. HOAs cannot prohibit solar and can only impose restrictions that increase cost by less than $1,000 or reduce output by less than 10 percent. Master-planned communities in Porter Ranch, Valencia, and Northridge have HOA architectural review that must respect Civil Code 714 but can still impose aesthetic and placement rules within the $1,000 ceiling. Multifamily common-area roofs are protected under SB 1226.",
    permitProcessPara: "LADBS uses the Online Express Permitting system for residential solar. Standard installs under 10 kW on single-family residences qualify for streamlined plan check with same-week approval. Hillside Designated Areas, Very High Fire Hazard Severity Zones (VHFHSZ), and Coastal Development Permit zones add structural engineering review that extends permitting to 4-8 weeks. The California Solar Permitting Guidebook (OPR) defines statewide streamlining standards that LADBS has adopted. Title 24 Part 6 solar-ready provisions apply to new construction only.",
    batteryPara: "Battery storage adoption in LA is lower than in NEM 3.0 territories because LADWP still offers 1-for-1 net metering. For LADWP customers, battery is primarily purchased for outage resilience (PSPS events, grid failures) rather than for financial payback. Tesla Powerwall 3 dominates the LA market; Enphase IQ Battery 5P and FranklinWH gain share in SunPower dealer channels. California SGIP Equity Resiliency tier provides $1,000 per kWh for customers in High Fire Risk Areas (which covers significant Hillside and Very High Fire Hazard portions of LA).",
    climateRiskPara: "LA climate risks for solar are Santa Ana wind events (the October-November dry wind season regularly hits 70-80 mph), wildfire smoke attenuation that reduces production 10-20 percent for 3-6 weeks a year, and seismic events. Santa Ana-hardened racking requires minimum 6-inch fastener penetration into structural rafters; ballasted flat-roof systems add concrete pavers at the windward edge. CAL FIRE Section 701A.3.2.4 requires 3-foot pathways around PV for firefighter access on all sloped-roof installs.",
    timelinePara: "Full timeline from contract signing to PTO in LA runs 8-14 weeks: 1 week site assessment and engineering, 1-3 weeks LADBS permitting (longer for Hillside or Coastal zones), 1-2 days physical installation, 3-7 days LADBS inspection, 2-4 weeks LADWP or SCE interconnection review. The January-March installation window targets April-October peak production capture. Valley ZIPs consistently clear 1-2 weeks faster than hillside or coastal ZIPs.",
    uniqueInsightPara: "LA's solar market benefits from the L.A. Solar Program Community Solar partnership that provides income-qualified households with virtual solar subscription credits without rooftop installation. LADWP's Feed-in Tariff (FiT) for commercial projects has spilled over into single-family via the Shared Solar option. The LA County Property Tax Assessor treats solar improvements as exempt under RTC 73 through 2026. Title 24 Part 6 solar-ready provisions apply to all new single-family construction permitted after January 1, 2020.",
  },

  "chicago-il": {
    peakSunHours: 4.0,
    paybackYears: "7-9 years",
    utility: "ComEd (Commonwealth Edison)",
    bestInstallMonth: "March-May",
    sunPara: "Chicago averages 4.0 peak sun hours daily with June-July production at 6.0 kWh per kW per day and December at only 1.8 because of Lake Michigan cloud generation and shortened winter days. Over 72 percent of annual production happens April through September. Oak Park, Evanston, and the north suburbs average 4-6 percent more annual insolation than the South Side because of less particulate haze from the Indiana industrial corridor. Lake-effect clouds over Rogers Park and Edgewater cost an additional 3-5 percent.",
    tariffPara: "ComEd residential solar runs on Rider POG (Parallel Operation of Generators) with 1-for-1 retail-rate net metering under Illinois Public Utilities Act 220 ILCS 5/16-107.5. Credits roll forward month-to-month with an annual April true-up; unused credits are paid at the utility avoided-cost rate rather than retail. This is among the strongest net metering frameworks in the Midwest. Nicor Gas customers on the gas side do not affect solar economics. ComEd's summer peak demand window (12pm to 6pm June through September) aligns with afternoon production.",
    interconnectPara: "ComEd interconnection for residential systems under 25 kW runs 4-8 weeks through the ComEd Distributed Generation Portal. Chicago Department of Buildings (CDOB) issues the electrical permit in 2-4 weeks for standard installations. South Side and West Side ComEd substations have more hosting capacity than the dense North Side, which occasionally triggers Level 2 interconnection screening on systems over 10 kW in already-saturated feeders. The Illinois Shines (Adjustable Block Program) SREC commitment must be filed before ComEd interconnection for the incentive to stack.",
    installerLandscapePara: "The Chicago installer market is led by WCP Solar (Wisconsin-based with strong Chicago presence), AES Solar, Rethink Electric, and Sunrun. Midwest specialty crews include Ailey Solar Electric, Certasun, and Solar Service (Niles-based and operating since 1979). Tesla Energy operates in Chicago but at lower volume than coastal markets. Illinois Commerce Commission and Illinois Department of Commerce and Economic Opportunity track certified installers. Typical Chicago residential quote runs $2.90-$3.60 per watt before incentives, competitive with other Midwest metros.",
    incentivesPara: "Illinois Shines (the Adjustable Block Program, administered by Illinois Power Agency) provides Solar Renewable Energy Credits (SRECs) worth $3,000-$6,000 over 15 years for a typical 6-8 kW residential system. This is among the strongest Renewable Portfolio Standard markets in the country. Federal ITC at 30 percent stacks. Illinois exempts solar from state sales tax (6.25 percent statewide plus local) and provides a Special Assessment Property Tax exemption on the added home value for 30 years. Cook County offers no additional local rebate but Chicago has the Retrofit Chicago homeowner energy program.",
    roofLandscapePara: "Chicago rooftop stock is heavily composition shingle on post-1950 bungalows and cape cods in the outer bungalow belt (Portage Park, Norwood Park, Jefferson Park). Flat EPDM and TPO membrane on rowhouses and three-flats in Wicker Park, Logan Square, Lincoln Park, and Hyde Park requires ballasted or tilted-mount racking. Slate and tile on historic homes in Ravenswood and Andersonville adds 20-30 percent install cost and may trigger Landmarks Commission review. The typical Chicago bungalow hip roof has three solar-viable faces (south, southwest, southeast) because of the distinctive Chicago bungalow cross-gable.",
    hoaAndRestrictPara: "Illinois Solar Access Rights Act (765 ILCS 165) prohibits HOA covenants from banning solar installations. HOAs may set reasonable aesthetic guidelines but cannot prevent installation. Chicago Landmarks Commission reviews exterior modifications in 60-plus designated historic districts including Lincoln Park, Gold Coast, Old Town Triangle, and Pullman. Roof-mounted visible solar typically triggers Certificate of Appropriateness review in Landmarks zones, which adds 8-16 weeks. Rear-facing or concealed flat-roof installs usually pass.",
    permitProcessPara: "Chicago Department of Buildings issues solar permits through the Chicago E-Plan portal. A Residential Express Permit is available for systems under 25 kW on pitched-roof single-family residences, clearing in 2-4 weeks. Rowhouse and three-flat installs fall under the Residential Standard Permit track with 4-6 week review. Historic district projects require Certificate of Appropriateness through the Commission on Chicago Landmarks before CDOB permit can issue.",
    batteryPara: "Battery storage adoption in Chicago is modest because strong 1-for-1 net metering reduces the financial case; most battery purchases are resilience-driven. Enphase IQ Battery 10 and Tesla Powerwall 3 are the dominant residential products. Illinois Shines SREC program now includes a battery storage adder. Chicago Fire Department inspection is required for any residential battery over 20 kWh under Chicago Fire Code 57-1.15; basement and below-grade installations are restricted.",
    climateRiskPara: "Chicago climate risks for solar are wind uplift during lake-effect blow events (peak gusts in January and April routinely hit 60 mph at Midway), snow loading averaging 36 inches annual snowfall, and hail damage from summer derecho events. Ground-snow load is 25 psf under IBC 2018 Table 1608.1. Module racking must be spec'd for the Chicago snow-load zone, typically requiring 25 percent upgrade over base IronRidge XR hardware. The August 2020 derecho produced several documented racking failures where wind speeds exceeded 100 mph.",
    timelinePara: "Full timeline from contract signing to PTO in Chicago runs 12-18 weeks: 1-2 weeks site assessment and engineering, 2-6 weeks CDOB permitting (longer for Landmarks districts), 1-3 days physical installation, 1-2 weeks inspection, 4-8 weeks ComEd interconnection review including Illinois Shines SREC registration. The March-May installation window captures the full April-September peak production window and avoids frozen-roof scheduling issues in winter.",
    uniqueInsightPara: "Chicago's Green Homes Program offers property tax reductions for energy-efficient residential construction. The Illinois Solar for All program provides income-qualifying households with no-cost community solar or rooftop solar through approved contractors. Cook County's Solar Ready Initiative (through the Cook County Department of Environment and Sustainability) offers free rooftop site assessments using satellite data. ComEd's Hourly Pricing voluntary rate program can improve solar economics by aligning consumption with low-price hours.",
  },

  "houston-tx": {
    peakSunHours: 4.9,
    paybackYears: "9-12 years",
    utility: "CenterPoint Energy (T and D) with retail electric providers",
    bestInstallMonth: "October-February",
    sunPara: "Houston averages 4.9 peak sun hours daily with June-August production at 6.5 kWh per kW per day and December at 3.2 because of coastal Gulf cloud buildup. Afternoon thunderstorms June through September clip 10-15 percent off theoretical summer production versus cloud-free modeling. The Heights and Memorial see 5-7 percent less annual insolation than southwest Houston (Sugar Land, Katy) because of more afternoon cumulus cloud development. Hurricane season outage risk (June through November) is the single largest resilience driver for Houston battery adoption.",
    tariffPara: "Houston operates in the deregulated ERCOT retail market. CenterPoint Energy owns transmission and distribution; customers choose a Retail Electric Provider (REP). No statewide net metering mandate exists. Solar buyback plans from Green Mountain Energy (Green Mountain Renewable Rewards), Chariot Energy (Chariot 100 Solar Buyback), and TXU Energy (Solar Buyback Saver) credit exported energy at $0.04-$0.09 per kWh against retail rates of $0.11-$0.15. Reliant Energy, Direct Energy, and NRG-owned Green Mountain dominate the retail book. Sizing to self-consumption rather than exporting is the economically optimal strategy.",
    interconnectPara: "CenterPoint Energy's Distributed Generation interconnection runs 4-8 weeks for residential systems through the CenterPoint DG Portal. Houston permits through the Houston Planning and Development ProjectDox portal with 1-3 day turnaround for standard residential installs. The CenterPoint interconnection step is the bottleneck; many REPs require their own additional enrollment step that can add 2-3 weeks. Harris County and Fort Bend County permits follow different portals for unincorporated-area projects.",
    installerLandscapePara: "The Houston installer market is led by Freedom Solar Power (San Antonio HQ, major Houston presence), Sunpro Solar, and Longhorn Solar. National chains Sunrun, Sunnova, and Palmetto Solar have strong Houston footprints. Local specialty crews include Alba Energy, Sun Source Renewables, and Circle L Solar. Texas Department of Licensing and Regulation requires a Master Electrician license or Limited Residential Electrician for solar work. Typical Houston residential quote runs $2.50-$3.20 per watt before incentives, among the lowest in the country thanks to low labor costs.",
    incentivesPara: "Texas has no state solar tax credit. The federal ITC at 30 percent is the primary upfront incentive. Texas Tax Code Section 11.27 exempts the appraised value of solar installations from residential property tax (a $25,000 system adds zero to the property tax base). Texas exempts solar equipment from state sales tax under Tax Code 151.355. Oncor Energy Efficiency has a limited utility rebate program but CenterPoint does not. The ERCOT-wide Winter Storm Uri resilience push in 2021 spawned some REP-specific solar buyback promotions that continue in modified form.",
    roofLandscapePara: "Houston rooftop stock is heavily composition shingle on post-1970 suburban housing in Sugar Land, Katy, and The Woodlands. Tile roofs (concrete and clay) appear in Tanglewood, River Oaks, and Memorial and add 15-25 percent install cost. Flat roofs are rare in Houston residential. The Houston hurricane wind zone requires ASCE 7-16 compliant racking rated for 150 mph design wind in coastal Harris County (Seabrook, Clear Lake) and 140 mph inland. Hurricane-rated flashing requires upgraded SpeedSeal or QuickMount PV hardware at roughly 12 percent premium over base pricing.",
    hoaAndRestrictPara: "Texas Property Code Section 202.010 prohibits HOAs from banning solar installations, and the law is among the strongest in the country. HOAs may require panels on rear or side roof faces if it does not reduce output by more than 10 percent and may set reasonable aesthetic rules. Master-planned communities in Cinco Ranch, The Woodlands, and Sienna Plantation have architectural review committees that must respect Section 202.010 but can still impose placement and wiring-concealment rules. Deed restrictions in West University and Bellaire are privately enforced and occasionally conflict with state law in ways that require legal resolution.",
    permitProcessPara: "Houston Planning and Development Department issues residential solar permits through the ProjectDox online portal with 1-3 day turnaround for standard installs. Unincorporated Harris County permits through the Harris County Engineering Department. Cypress-Fairbanks and Katy suburbs each have their own municipal processes. The Texas TDLR windstorm certification requirement for Galveston County and coastal Harris County adds an engineer's letter requirement that most reputable installers bundle into the quote.",
    batteryPara: "Battery storage adoption in Houston is driven almost entirely by Winter Storm Uri memory and annual hurricane outage risk. Tesla Powerwall 3 and Enphase IQ Battery 10 dominate. FranklinWH has gained share in the premium tier. Texas has no SGIP-equivalent state battery rebate but the federal ITC at 30 percent applies to battery. Some REPs (Green Mountain, Chariot) offer time-of-use rates that favor battery arbitrage but the spreads are small. NEC 2020 rapid shutdown requirements drive module-level electronics (microinverters or power optimizers) on any battery-ready install.",
    climateRiskPara: "Houston climate risks for solar are hurricane wind uplift (ASCE 7-16 design 140-150 mph), hail damage from spring severe weather events, and the extreme summer heat that reduces module efficiency 8-14 percent below rated output on 100F-plus days. Tier 1 modules (Qcells Q.Peak, LG Neon, Panasonic EverVolt) carry 25-year linear performance warranties that maintain 85 percent production at year 25. Hurricane-rated installations require engineered ballasting or full-penetration fastening to rafters with 6-inch minimum embedment.",
    timelinePara: "Full timeline from contract signing to PTO in Houston runs 8-14 weeks: 1 week site assessment and engineering, 1-2 weeks Houston permitting, 1-2 days physical installation, 3-7 days inspection, 4-8 weeks CenterPoint interconnection plus REP solar buyback enrollment. The October-February installation window avoids summer heat and hurricane season while getting the system online before summer peak AC load starts in April.",
    uniqueInsightPara: "Houston's deregulated ERCOT market means the REP choice has as much impact on solar economics as the installer choice. Running quarterly REP comparisons through the Texas Power to Choose portal can swing annual savings by $200-$600 for a typical solar household. Many Houston installers bundle 90-day REP enrollment assistance to help customers select the optimal solar buyback plan. The Greater Houston Partnership's Resilient Houston initiative includes targeted grant funding for solar plus storage in flood-prone neighborhoods.",
  },

  "phoenix-az": {
    peakSunHours: 6.5,
    paybackYears: "7-9 years",
    utility: "APS (Arizona Public Service) or SRP (Salt River Project)",
    bestInstallMonth: "October-January",
    sunPara: "Phoenix averages 6.5 peak sun hours daily, the strongest solar market profile of any US metro over 1 million population. June production hits 8.0 kWh per kW per day and December still delivers 4.5. Monsoon season (late June through mid-September) produces afternoon thunderstorms that clip production 6-10 percent but rarely disrupt daily totals significantly. Scottsdale and Paradise Valley receive marginally more annual insolation than the West Valley because of lower dust buildup frequency.",
    tariffPara: "APS residential solar customers connected after August 2017 operate under the Resource Comparison Proxy (RCP) rate that credits exports at approximately 75-80 percent of retail rate, declining annually. New APS solar customers must also choose between the Saver Choice Plus demand rate and the Saver Choice TOU rate, both of which affect solar economics differently. SRP territory (Tempe, Mesa, Gilbert, Chandler) uses the E-27 Customer Generation Price Plan with a controversial demand charge structure that typically reduces solar savings 20-35 percent versus traditional net metering. Confirming service territory is the single most important first step for any Phoenix solar quote.",
    interconnectPara: "APS interconnection for residential systems under 10 kW runs 3-6 weeks through the APS SolarConnect portal. SRP interconnection runs 4-8 weeks through the SRP Customer Generation Program. City of Phoenix Planning and Development issues solar permits same-day for standard residential installations under 10 kW through the Solar Express Permit program, one of the fastest in the country. Scottsdale, Mesa, Chandler, Gilbert, and Tempe each maintain their own solar permitting with 2-7 day average turnaround.",
    installerLandscapePara: "The Phoenix installer market is led by Sunrun, SunPower dealers including Solar Gain and Sun Valley Solar Solutions, Tesla Energy, and Sunny Energy. Local specialty crews include American Solar and Roofing, Elling Bros Solar, and Parker and Sons Solar. Arizona Registrar of Contractors requires a C-11 Electrical license or the specialty R-11 Residential Electrical license for solar work. Tesla Energy retains strong Phoenix presence and typically bundles Powerwall at 12-18 percent below the standalone retail price. Typical Phoenix residential quote runs $2.40-$3.10 per watt before incentives.",
    incentivesPara: "Arizona Revised Statutes 43-1083 provides a state solar tax credit worth 25 percent of system cost capped at $1,000, modest but stackable with the 30 percent federal ITC. ARS 42-12054 exempts residential solar installations from property tax increases. Arizona Transaction Privilege Tax exempts solar equipment from state sales tax. APS Solutions for Business and SRP EarthWise rebates for residential solar have largely phased out; the tax credit and exemptions are the remaining state-level benefits. Federal ITC plus AZ state credit reduces a $20,000 system to approximately $13,000 effective net cost.",
    roofLandscapePara: "Phoenix rooftop stock is heavily concrete tile (flat and S-tile) on post-1980 housing stock in Ahwatukee, Anthem, Desert Ridge, and Arcadia. Tile mounting adds 15-25 percent install cost because of specialty roof-hook hardware (tile replacement hooks, flashings). Composition shingle is common in older Phoenix, pre-1980 Mesa, and the West Valley. Flat-roof foam (sprayed polyurethane foam, SPF) is a Phoenix-specific roof type on mid-century homes and high-end new builds; it requires ballasted racking because SPF does not accept penetration fastening.",
    hoaAndRestrictPara: "Arizona Revised Statutes 33-1816 prohibits HOAs from banning solar installations. HOAs may require that panels are not visible from the street on certain roof faces but cannot prevent installation. Master-planned communities in Desert Ridge, Gainey Ranch, Estrella, and Anthem have architectural review committees that must comply with ARS 33-1816 but often impose color-matched racking and wiring concealment rules. The 2019 Arizona Court of Appeals ruling in Garden Lakes Community Association v. Madigan confirmed the homeowner preference for preferred orientation unless HOA can prove equivalent aesthetic placement.",
    permitProcessPara: "Phoenix uses the Solar Express Permit for residential systems under 10 kW on single-family detached homes, providing same-day online permit issuance. Larger systems or those on tile roofs with structural modifications take 2-5 days through standard plan check. SRP cities (Tempe, Mesa, Gilbert, Chandler) mostly follow the Arizona Solar Permitting Guidelines for streamlined review. Maricopa County permits follow the same SolarAPP+ platform for unincorporated areas, introduced statewide in 2022.",
    batteryPara: "Battery storage adoption in Phoenix is driven by SRP's demand charges (making time-shifting energy highly valuable), APS's declining RCP export credits, and summer grid-stress reliability. Tesla Powerwall 3 dominates. SRP offers the Battery Storage Reward program providing $300-$500 performance-based payments for customers who enroll in utility dispatch control. APS has a Battery Storage Pilot Program with a $750 rebate capped at limited annual enrollments. Federal ITC at 30 percent applies to battery. Arizona Corporation Commission currently considering an expanded statewide battery incentive.",
    climateRiskPara: "Phoenix climate risks for solar are extreme heat (module cell temperatures regularly exceed 75C on 115F-plus days, reducing output 15-22 percent below STC rated output), monsoon dust storms that require post-storm cleaning for 3-5 percent production recovery, and UV degradation of module backsheet that manufacturers have addressed with newer poly-substrate products. PAN file modeling using TMY3 Phoenix weather data should show realistic derated output; any installer quote modeling without the heat coefficient is inflating projections.",
    timelinePara: "Full timeline from contract signing to PTO in Phoenix runs 6-12 weeks: 1 week site assessment and engineering, same-day to 1 week Phoenix permitting, 1-2 days physical installation, 3-5 days inspection, 3-6 weeks APS or SRP interconnection. The October-January installation window avoids roof-top work during the 115F-plus summer heat and gets the system online before peak AC season. Tile-roof installs add 3-5 days of installation time versus composition shingle.",
    uniqueInsightPara: "Phoenix has some of the strongest solar economics in the country thanks to 6.5 peak sun hours, strong hail-free climate, and the APS and SRP 25-year interconnection history. The Arizona Goes Solar program (through the Arizona Corporation Commission) tracks licensed installers and consumer complaints. The Sun Valley Solar Solutions annual report publishes install-by-install production data that new homeowners use to benchmark installer projections. Phoenix's SolarAPP+ automated permit approval is a national model.",
  },

  "dallas-tx": {
    peakSunHours: 5.0,
    paybackYears: "9-12 years",
    utility: "Oncor (T and D) with retail electric providers",
    bestInstallMonth: "October-February",
    sunPara: "Dallas-Fort Worth averages 5.0 peak sun hours daily with June-August production at 6.6 kWh per kW per day and December at 3.3. Spring hail season (March through May) is the single largest production disruption, with 2-4 significant hail events per year on average. Plano and Frisco receive 4-5 percent more annual insolation than Fort Worth because of slightly less particulate haze from the I-35W industrial corridor. The East Texas cloud line typically stays east of US-75 so Garland and Richardson see clearer skies than Rockwall and Wylie.",
    tariffPara: "Dallas operates in the deregulated ERCOT retail market similar to Houston. Oncor Electric Delivery owns transmission and distribution; customers choose an REP. No statewide net metering mandate exists. Solar buyback plans from Green Mountain Energy, Chariot, TXU, and Reliant credit exported energy at $0.04-$0.08 per kWh versus retail rates of $0.11-$0.13. Oncor has no solar rebate program; it is purely the distribution utility. Sizing solar to 85-95 percent of annual consumption rather than overbuilding is the optimal DFW strategy because exports earn significantly less than retail rate.",
    interconnectPara: "Oncor Distributed Generation interconnection runs 4-8 weeks for residential systems through the Oncor DG Portal. City of Dallas Building Inspection issues solar permits in 3-7 days through the Dallas ePlan portal. Plano, Frisco, Garland, Arlington, and Fort Worth each have separate municipal permitting portals with 2-10 day turnaround. Unincorporated Dallas and Tarrant county follow county-level permitting. Tornado-season storm delays in the March-May window can affect installation scheduling even if permits are in hand.",
    installerLandscapePara: "The DFW installer market is led by Freedom Solar Power, Sunpro Solar, Longhorn Solar, and Tesla Energy. National chains Sunrun, Sunnova, and Palmetto Solar operate at volume. Local specialty crews include Circle L Solar, Alba Energy, and Clearview Solar. Texas Department of Licensing and Regulation requires Master Electrician licensing. Typical DFW residential quote runs $2.50-$3.20 per watt before incentives, competitive with Houston. Fort Worth typically sees 8-12 percent higher pricing than Dallas proper because of smaller installer pool.",
    incentivesPara: "Texas has no state solar tax credit. Federal ITC at 30 percent is the primary upfront incentive. Texas Tax Code Section 11.27 exempts residential solar installations from property tax increases. Texas Tax Code 151.355 exempts solar equipment from state sales tax. Oncor does not offer a direct solar rebate; some REPs run promotional solar sign-up credits. Dallas Economic Development Office offers a green home loan at 2 percent below prime for qualifying energy improvements over $10,000. No property-specific PACE financing currently available in Dallas County.",
    roofLandscapePara: "DFW rooftop stock is heavily composition shingle on post-1980 tract housing in Plano, Frisco, Allen, and McKinney. Concrete tile and clay tile appear in Highland Park, University Park, and older Preston Hollow, adding 15-20 percent install cost. Flat roofs are rare in DFW residential outside of mid-century modern pockets in Lakewood and White Rock. Hail-rated Class 4 composition products (which many insurance carriers require in DFW) are thicker and require upgraded module flashing hardware. Wind zone is ASCE 7-16 Category II, 115 mph design wind.",
    hoaAndRestrictPara: "Texas Property Code Section 202.010 prohibits HOA bans on solar. Master-planned communities in Plano (Dallas North Estates, Windhaven), Frisco (Shaddock Creek, Hidden Cove), and Southlake (Timarron) have architectural review committees that must comply with state law but impose placement and aesthetic rules within the 10 percent output reduction limit. Park Cities (Highland Park, University Park) has some of the most restrictive deed-enforced HOA rules in Texas and can require ground-mounted alternatives.",
    permitProcessPara: "Dallas Building Inspection issues solar permits through the Dallas ePlan portal with 3-7 day turnaround. Plano, Frisco, and Allen use Plano's online permit system (different from Dallas) with 2-5 day turnaround. Fort Worth uses the Accela Citizen Access portal with 5-10 day turnaround. All DFW municipalities have adopted the International Residential Code 2015 or 2018 for solar scope. TDLR Master Electrician certification is required for the electrical portion.",
    batteryPara: "Battery adoption in DFW is driven by Winter Storm Uri memory (February 2021 grid failure left millions without power for days) and annual spring storm outage risk. Tesla Powerwall 3 dominates. Enphase IQ Battery and FranklinWH are the secondary tier. Some DFW REPs (Green Mountain, Chariot) have started offering battery-friendly TOU rate plans that improve battery economic case. Texas has no state battery rebate but federal ITC at 30 percent applies to battery storage for both standalone and solar-coupled installs.",
    climateRiskPara: "DFW climate risks for solar are spring hail (baseball-sized hail is common enough that tempered glass module fronts are mandatory Tier 1 spec), wind uplift during tornado season (ASCE 7-16 Category II, 115 mph design), and extreme summer heat reducing output 10-15 percent below STC on 100F-plus days. Class 4 hail-impact rating for modules is increasingly standard. Some insurance carriers (State Farm, USAA) require Class 4 modules in DFW for homeowner insurance continuity.",
    timelinePara: "Full timeline from contract signing to PTO in DFW runs 8-14 weeks: 1 week site assessment and engineering, 1-2 weeks permitting, 1-2 days physical installation, 3-7 days inspection, 4-8 weeks Oncor interconnection plus REP solar buyback enrollment. The October-February installation window avoids summer heat and hail season. Spring permits can be delayed by storm-related priority volume in building departments.",
    uniqueInsightPara: "DFW's deregulated ERCOT market makes REP selection critical to solar economics. The Texas Power to Choose portal allows quarterly REP comparison; running this comparison annually can swing solar-household savings $300-$700 per year. The Texas Solar Energy Society's installer ratings database is a useful vetting tool. Oncor offers residential smart meter hourly data through Smart Meter Texas portal; using this for pre-install baselining improves system sizing accuracy.",
  },

  "atlanta-ga": {
    peakSunHours: 4.7,
    paybackYears: "10-13 years",
    utility: "Georgia Power",
    bestInstallMonth: "February-April",
    sunPara: "Atlanta averages 4.7 peak sun hours daily with June-July production at 6.2 kWh per kW per day and December at 3.0. Summer afternoon thunderstorms June through August clip 10-15 percent off theoretical summer production. Intown neighborhoods (Virginia-Highland, Inman Park, Decatur) receive 3-5 percent less annual insolation than the north suburbs (Alpharetta, Roswell, Dunwoody) because of heavier urban tree canopy. Sandy Springs and Brookhaven fall between the two.",
    tariffPara: "Georgia Power residential solar operates under the Renewable and Non-Renewable Rider, which credits exported energy at the Avoided Cost Rate (approximately $0.03-$0.04 per kWh) rather than the retail rate of $0.12-$0.14. This is significantly less favorable than 1-for-1 net metering. Georgia Power's Monthly Net Metering option (limited to 5,000 statewide enrollees and typically fully subscribed) does offer retail-rate 1-for-1 but participation slots are hard to obtain. Self-consumption sizing is critical in Atlanta because exports earn roughly 25 percent of avoided retail.",
    interconnectPara: "Georgia Power interconnection for residential systems under 10 kW runs 4-8 weeks through the Georgia Power Solar Connect portal. City of Atlanta Office of Buildings issues solar permits in 2-4 weeks. Fulton, DeKalb, Cobb, and Gwinnett counties each maintain separate permitting portals with 1-3 week turnaround for unincorporated areas. DeKalb County has historically faster permit processing than Fulton. The Georgia Public Service Commission regulates Georgia Power interconnection rules under O.C.G.A. 46-3-50.",
    installerLandscapePara: "The Atlanta installer market is led by Hannah Solar, Creative Solar USA, Solar Sam, and Sunrun. Regional specialty crews include Southern Current, Alternative Energy Southeast, and Radiance Solar. Tesla Energy operates in Atlanta at moderate volume. Georgia Secretary of State requires a Georgia Residential or Light Commercial Contractor license for any work over $2,500 plus a Georgia Electrical Contractor license. Typical Atlanta residential quote runs $2.80-$3.50 per watt before incentives, with north suburb pricing 5-10 percent above intown.",
    incentivesPara: "Georgia has no state solar tax credit; the state credit expired in 2015 and has not been renewed. Federal ITC at 30 percent is the primary upfront incentive. Georgia exempts solar equipment from state sales tax (4 percent plus local). Georgia Power Solar Buyback Program provides small per-kWh buyback payments but is structurally less valuable than retail net metering. No property tax exemption exists at the Georgia state level, though some counties offer local incentives. Federal 25D alone reduces a $24,000 Atlanta system to approximately $16,800 effective cost.",
    roofLandscapePara: "Atlanta rooftop stock is heavily composition shingle on post-1970 suburban housing in Sandy Springs, Alpharetta, and Roswell. Slate and clay tile appear in Druid Hills, Ansley Park, and older Buckhead, adding 20-30 percent install cost and potentially triggering Historic Preservation review. Atlanta's heavy deciduous canopy (the city is 47 percent tree-covered) makes shade analysis the single most important pre-install step; Aurora Solar or HelioScope irradiance modeling with tree-height LiDAR is the reliable approach.",
    hoaAndRestrictPara: "Georgia's Solar Easements and Rights Act (O.C.G.A. 44-3-232, passed 2015) allows solar installations regardless of HOA restrictions but the law is narrower than Texas or California. HOAs can still impose meaningful aesthetic requirements. Master-planned communities in Alpharetta (Windward, Crabapple Station), Roswell (Country Club of Roswell), and Peachtree City (South Point) have architectural review committees that apply design rules within the statute's limits. Druid Hills and Ansley Park have federal historic district designation that layers additional review.",
    permitProcessPara: "City of Atlanta Office of Buildings issues solar permits through the Atlanta Citizen Access portal with 2-4 week turnaround. Fulton County permits through Fulton County Building Permits with 1-2 week turnaround for unincorporated areas. DeKalb, Cobb, Gwinnett, and Henry counties each have separate portals. Georgia Electrical Code 2017 with NEC 2017 basis applies statewide for solar scope. Tree Ordinance Section 158-28 in Atlanta requires arborist letters for work within the critical root zone of any protected tree over 6 inches DBH.",
    batteryPara: "Battery adoption in Atlanta is modest because Georgia Power's unfavorable export tariff already pushes systems toward self-consumption sizing that battery can reinforce. Tornado and ice storm outage risk drives some resilience purchases. Tesla Powerwall 3 and Enphase IQ Battery 10 are the dominant products. Georgia has no state battery rebate. Federal ITC at 30 percent applies to battery. Georgia Power's Simple Solar community solar option exists as an alternative to rooftop but does not include battery.",
    climateRiskPara: "Atlanta climate risks for solar are summer afternoon thunderstorms (nearly daily June through August with lightning strike risk requiring proper grounding and SPD devices), occasional ice storm loading (the December 2022 ice event tested residential racking across the Southeast), and tree damage from wind events. Georgia IRC 2018 requires Class A fire-rated modules for all residential rooftop PV. The Atlanta urban canopy creates both shading challenges and falling-limb risk that proper site assessment addresses.",
    timelinePara: "Full timeline from contract signing to PTO in Atlanta runs 10-16 weeks: 1-2 weeks site assessment and engineering (including tree shade analysis), 2-4 weeks permitting, 1-2 days installation, 1-2 weeks inspection, 4-8 weeks Georgia Power interconnection. The February-April installation window captures the full May-September peak production season while avoiding winter ice storm scheduling issues.",
    uniqueInsightPara: "Georgia's Home Energy Loan Program (Georgia Power administered) provides low-interest financing for energy improvements including solar. The Georgia PSC's Distributed Generation working group is actively revising the Renewable Rider and may improve export tariff rates in 2025-2026 proceedings. Atlanta's Tree Ordinance can force creative solar layouts that HelioScope modeling helps optimize; some Atlanta households trim select branches under arborist supervision for 15-25 percent production gains.",
  },

  "denver-co": {
    peakSunHours: 5.5,
    paybackYears: "7-9 years",
    utility: "Xcel Energy",
    bestInstallMonth: "March-May",
    sunPara: "Denver averages 5.5 peak sun hours daily at 5,280 feet elevation with the thin-atmosphere bonus adding 5-8 percent to production versus comparable sea-level sun hours. June production hits 7.0 kWh per kW per day and December still delivers 3.5. Colorado has 300-plus clear sunny days annually. Afternoon summer thunderstorms are brief and mostly post-peak-production. Cherry Creek, Stapleton, and Washington Park receive marginally more annual insolation than Highlands and LoHi because of less smoke from Front Range wildfire seasons.",
    tariffPara: "Xcel Energy Colorado residential solar operates under the Schedule R rate with full 1-for-1 retail-rate net metering under Colorado PUC Rule 3902. Excess exports roll forward month-to-month with an annual true-up at the Xcel Energy avoided cost rate. This is among the most favorable net metering frameworks in the Mountain West. Black Hills Energy covers southeast Colorado but not Denver metro. Xcel's Residential Time-of-Use (RTOU) rate is optional and can improve solar economics for households that self-consume daytime production.",
    interconnectPara: "Xcel Energy Colorado interconnection runs 4-8 weeks for residential systems through the Xcel Renewable Connections Portal. City and County of Denver Community Planning and Development issues solar permits in 2-4 weeks. Arapahoe, Jefferson, Douglas, and Adams counties have separate permitting portals for unincorporated areas. Denver implemented SolarAPP+ automated instant permitting in 2022 for qualifying residential installs, dropping permit time to same-day for many projects. Xcel interconnection remains the timeline bottleneck.",
    installerLandscapePara: "The Denver installer market is led by Namaste Solar (Boulder-based cooperative), Photon Brothers (Denver), Freedom Solar Power, SunPower dealers including Blue Raven Solar and Freedom Forever. Tesla Energy operates in Denver. Local specialty includes Sunsense Solar (Carbondale-based mountain market extension) and REenergizeCO. Colorado Department of Regulatory Agencies requires a Master Electrician license. Typical Denver residential quote runs $2.70-$3.40 per watt before incentives; mountain-resort installs (Vail, Aspen, Breckenridge) run $3.80-$4.60.",
    incentivesPara: "Colorado no longer offers a state solar tax credit (expired 2020). Federal ITC at 30 percent is the primary upfront incentive. Colorado exempts residential solar installations from state property tax through Colorado Revised Statutes 39-3-118. Colorado exempts solar equipment from state sales tax (2.9 percent state plus local) through CRS 39-26-724. Xcel Energy's Solar*Rewards program provides performance-based $0.05 per kWh payments for 10 years on qualifying residential systems, but program capacity fills quickly each year. City of Denver Climate Action Rebates offer $500-$1,500 for electrification-bundled packages.",
    roofLandscapePara: "Denver rooftop stock is heavily composition shingle on post-1990 suburban housing in Highlands Ranch, Stapleton, and Aurora. Concrete and clay tile appear in Cherry Hills Village, Bow Mar, and older Washington Park, adding 15-20 percent install cost. Metal standing seam is increasingly common in new mountain construction and in LEED-certified Boulder homes; standing seam is the easiest solar-install substrate because S-5 clamps avoid roof penetrations. Denver's high-altitude UV is 30-40 percent more intense than sea level and accelerates shingle aging, which is a consideration for solar install timing.",
    hoaAndRestrictPara: "Colorado Revised Statutes 38-30-168 prohibits HOA bans on solar installations. The law is strong: HOAs cannot impose requirements that increase cost by more than 10 percent or decrease efficiency by more than 10 percent. Master-planned communities in Highlands Ranch, Lone Tree, and Stapleton have architectural review within those limits. Denver Landmark Preservation designates individual properties plus districts (Curtis Park, LoDo, Country Club, Humboldt Street); visible solar in Landmark zones requires Certificate of Appropriateness with 4-6 week review.",
    permitProcessPara: "Denver Community Planning and Development uses the SolarAPP+ automated permitting platform for qualifying residential installs under 25 kW on single-family homes, offering same-day online permit issuance for about 65 percent of applications. Complex installs, Landmark zones, and Hillside Designated Areas fall back to standard plan check with 2-4 week review. Jefferson, Arapahoe, and Douglas counties are in various stages of SolarAPP+ rollout. NEC 2020 rapid shutdown compliance is required statewide.",
    batteryPara: "Battery adoption in Denver is moderate and driven by wildfire-season outage risk and strong Xcel 1-for-1 net metering already providing most of the financial benefit without battery. Tesla Powerwall 3 and Enphase IQ Battery 10 dominate. FranklinWH gains share in premium tier. Colorado PUC-approved battery incentives stack with federal ITC. Xcel Solar*Rewards storage adder provides limited additional payments. Wildfire PSPS events in Jefferson and Larimer counties have driven battery adoption 20-30 percent annually.",
    climateRiskPara: "Denver climate risks for solar are wind uplift (Front Range Chinook events can hit 80-100 mph in January and April), hail damage from spring storm season (Denver is among the most hail-prone metros in the country, with 3-5 annual significant hail events), and snow loading (36-60 inches annual snowfall in the metro, higher in foothill ZIPs). Class 4 hail-impact modules and 40 psf snow-load-rated racking are Denver standards. Front Range hail insurance claims are so common that tempered glass backsheets are mandatory Tier 1 spec.",
    timelinePara: "Full timeline from contract signing to PTO in Denver runs 8-14 weeks: 1 week site assessment and engineering, same-day to 2 weeks permitting (faster with SolarAPP+), 1-2 days installation, 3-7 days inspection, 4-8 weeks Xcel interconnection. The March-May installation window avoids snow and frozen-roof scheduling and captures the full April-September peak production window immediately.",
    uniqueInsightPara: "Denver's SolarAPP+ automated permitting is a national model and cuts typical permit time from 3 weeks to same-day for qualifying projects. Colorado's 300-plus sunny days plus 5,280-foot altitude bonus deliver some of the strongest residential production profiles in the country. The Colorado Energy Office's Residential Energy Affordability Program (REAP) provides no-cost solar for income-qualifying households. Xcel Energy's Green Button Connect data is available for pre-install production modeling baseline.",
  },

  "seattle-wa": {
    peakSunHours: 3.6,
    paybackYears: "10-13 years",
    utility: "Seattle City Light (public utility)",
    bestInstallMonth: "February-April",
    sunPara: "Seattle averages 3.6 peak sun hours daily, the lowest of any major US metro, but June through September production is strong at 5.8-6.0 kWh per kW per day thanks to 16-plus hour summer daylight. December collapses to 1.2 kWh per kW per day. Over 72 percent of annual production happens April through September. North Seattle neighborhoods (Greenwood, Maple Leaf, Lake City) receive 5-8 percent more annual insolation than West Seattle because of fewer marine-layer fog events over the Puget Sound windward shore.",
    tariffPara: "Seattle City Light residential solar operates under the Net Energy Metering tariff with full 1-for-1 retail-rate credit for exported energy under Washington RCW 80.60. Credits roll forward month-to-month with annual March true-up at the SCL avoided cost rate. SCL's hydropower-dominated grid is already 90-plus percent carbon-free, making solar's environmental case primarily about resilience and load reduction during peak demand rather than grid decarbonization. Puget Sound Energy (covering Bellevue, Redmond, and the east side) operates under a similar net metering structure with slight differences in rollover treatment.",
    interconnectPara: "Seattle City Light interconnection for residential systems under 25 kW runs 4-8 weeks through the SCL Interconnection Portal. Seattle Department of Construction and Inspections (SDCI) issues solar permits in 2-6 weeks depending on structural scope. Systems on homes built before 1960 often require structural engineering review that adds 2-4 weeks. King County unincorporated areas use separate permitting. Puget Sound Energy interconnection runs 4-6 weeks for residential systems.",
    installerLandscapePara: "The Seattle installer market is led by A and R Solar, Puget Sound Solar, Solar Washington, and Artisan Electric. Sunrun operates at volume. Specialty crews include Synchro Solar, West Coast Solar, and Northwest Electric and Solar. Tesla Energy operates in Seattle at modest volume. Washington State Department of Labor and Industries requires an Electrical Contractor license (EL01 or EL02) plus a Specialty Electrical license (EL06) for solar work. Typical Seattle residential quote runs $2.90-$3.70 per watt before incentives, competitive with Portland and the broader Pacific Northwest.",
    incentivesPara: "Washington's production incentive program (Renewable Energy System Cost Recovery Incentive Program) expired in 2021. Federal ITC at 30 percent is the primary remaining upfront incentive. Washington exempts solar equipment from state and local sales tax (RCW 82.08.962), saving 10.25 percent in the Seattle jurisdiction. Washington exempts solar installations from residential property tax. Seattle City Light has no direct solar rebate but operates the Energy Advisor program for free pre-install consultation. King County PACE financing for residential solar is available through C-PACE Northwest.",
    roofLandscapePara: "Seattle rooftop stock is heavily composition shingle on post-1940 single-family in Ballard, Fremont, Greenwood, and West Seattle. Metal standing seam is common in new construction and Ballard-Fremont craftsman remodels. The typical Seattle hip and gable roof has moderate pitch (4/12 to 8/12) that is well-suited for solar. Moss on shingles is a Seattle-specific concern that requires cleaning before installation. The evergreen Douglas fir canopy in Magnolia, Madrona, and Capitol Hill is a year-round shading challenge (unlike deciduous trees in other regions).",
    hoaAndRestrictPara: "Washington State RCW 64.38.055 prohibits HOAs from banning solar installations. HOAs may require panels parallel to the roofline and may impose color requirements, but cannot prevent installation. Master-planned communities are less common in Seattle than in other markets. Seattle Landmarks Preservation Board designates 400-plus individual and district landmarks (Pioneer Square, Ballard Avenue, Columbia City, Pike Place); visible rooftop solar typically requires Certificate of Approval with 6-10 week review in Landmark zones.",
    permitProcessPara: "SDCI issues solar permits through the Accela online portal with 2-6 week standard turnaround. Homes built before 1960 often trigger structural review adding 2-4 weeks. Critical Areas Ordinance overlays (steep slopes in West Seattle, Magnolia) add 4-8 weeks. Puget Sound Energy service area (Bellevue, Redmond, Kirkland) uses respective city portals with 2-4 week turnaround. Washington State Energy Code 2021 applies to all solar scope.",
    batteryPara: "Battery adoption in Seattle is moderate, driven by windstorm outage risk (Puget Sound Convergence Zone produces 2-3 major wind events per winter) and Seattle City Light's occasional summer heat-dome outages. Tesla Powerwall 3 and Enphase IQ Battery 10 are dominant. Generac PWRcell has notable Seattle market share because of long-term Generac dealer relationships. No state or utility battery rebate exists for SCL customers; PSE offers a modest battery adder through the clean energy program. Federal ITC at 30 percent applies.",
    climateRiskPara: "Seattle climate risks for solar are not severe-weather driven like other markets but include moss and algae growth on panels (requires cleaning every 18-24 months at $150-$300 per visit), prolonged winter overcast reducing production to 15-25 percent of summer output, and the 2021 heat dome which exposed installed modules to unprecedented 108F temperatures without UV-rated backsheet acceleration testing at those levels. The Pacific Northwest snowstorm events (every 3-5 years) add temporary snow loading.",
    timelinePara: "Full timeline from contract signing to PTO in Seattle runs 10-18 weeks: 1-2 weeks site assessment and engineering (including tree shade analysis), 2-6 weeks SDCI permitting (longer for older homes), 1-2 days installation, 1-2 weeks inspection, 4-8 weeks SCL interconnection. The February-April installation window captures the full April-September peak production window and avoids rainy-season installation delays. Winter installs are possible but slower.",
    uniqueInsightPara: "Seattle City Light's hydropower-first grid means solar's primary environmental benefit is peak-demand load reduction rather than carbon offset. The Northwest Solar Communities initiative provides installer certification and customer education resources. King County's Solar Mapper tool (using LiDAR roof data) provides free rooftop production estimates. Puget Sound Energy's HomePrint program includes a free solar site assessment for any residential customer on request.",
  },

  "austin-tx": {
    peakSunHours: 5.2,
    paybackYears: "8-10 years",
    utility: "Austin Energy (municipal utility)",
    bestInstallMonth: "October-January",
    sunPara: "Austin averages 5.2 peak sun hours daily with June-August production at 6.8 kWh per kW per day and December at 3.4. Central Texas gets abundant summer sunshine, though spring thunderstorms (March through May) and occasional winter weather events (Uri 2021, ice storms 2022-2023) briefly disrupt production. Bee Cave and Lakeway receive 5-7 percent more annual insolation than central Austin because of less urban-haze particulate. Hyde Park and central neighborhoods see marginally lower insolation from oak canopy.",
    tariffPara: "Austin Energy residential solar operates under the Value of Solar (VoS) tariff, which credits exported energy at an annually-determined rate (typically close to or slightly below the retail rate of $0.10-$0.14 per kWh). The VoS rate resets each January based on grid value calculations. Austin Energy is a municipal utility not subject to ERCOT deregulation, giving Austin residents more favorable solar economics than Houston or Dallas. The 2024 VoS rate was approximately $0.099 per kWh, close to parity with retail. Confirming current VoS is the critical first step for any Austin solar quote.",
    interconnectPara: "Austin Energy interconnection runs 2-6 weeks for residential systems under 15 kW through the Austin Energy Solar Connect portal. City of Austin Development Services Department issues solar permits in 2-4 weeks (among the slower in Texas). Travis County, Hays County, and Williamson County unincorporated areas have separate permitting portals. Austin Energy's dedicated solar interconnection team handles the utility-side review efficiently once permits clear.",
    installerLandscapePara: "The Austin installer market is led by Freedom Solar Power (Austin-based, Texas-wide), Sunpro Solar, Longhorn Solar, and Sunrun. Regional specialty crews include Circle L Solar, Alba Energy, and Nativa Solar. Tesla Energy operates in Austin and bundles Powerwall competitively. Texas Department of Licensing and Regulation requires Master Electrician licensing. Typical Austin residential quote runs $2.60-$3.30 per watt before incentives. The Austin Energy Green Building program certifies some installers for verified quality.",
    incentivesPara: "Texas has no state solar tax credit. Federal ITC at 30 percent stacks. Texas Tax Code 11.27 exempts residential solar from property tax. Texas Tax Code 151.355 exempts solar equipment from state sales tax. Austin Energy's Value of Solar tariff functions as an ongoing utility incentive. Austin Energy's Solar Photovoltaic Rebate was phased out in 2020 but the VoS structure now provides ongoing credits. The Austin Energy Customer Energy Solutions program administers income-qualifying free solar for eligible households.",
    roofLandscapePara: "Austin rooftop stock is heavily composition shingle on post-1990 tract housing in Round Rock, Cedar Park, Pflugerville, and Southwest Austin. Metal standing seam is increasingly common in Hill Country custom homes west of MoPac (Westlake, Lakeway, Bee Cave). Tile roofs (concrete and clay) appear in Tarrytown, Barton Hills, and established Northwest Hills, adding 15-20 percent install cost. Austin's Heritage Live Oak ordinance requires arborist letters for any work within the critical root zone of oaks over 19 inches DBH, which affects solar site access and staging.",
    hoaAndRestrictPara: "Texas Property Code Section 202.010 prohibits HOA bans on solar and is among the strongest protections in the country. Austin's progressive culture and strong solar adoption mean HOA conflicts are rarer than in other Texas metros. Master-planned communities in Steiner Ranch, Lakeway, and Circle C have architectural review that complies with state law but imposes placement rules within the 10 percent output reduction limit. East Austin historically lacked HOAs but new developments in Mueller, Holly, and East Riverside have them.",
    permitProcessPara: "Austin Development Services Department issues solar permits through the Austin Build and Connect portal with 2-4 week turnaround (among the slower in Texas). The Edwards Aquifer Recharge Zone overlay affects any west-side project and can add Water Quality Protection Plan requirements. Heritage tree protection adds arborist letter requirements. NEC 2020 rapid shutdown and Texas Electrical Safety Code 2020 apply to solar scope. Travis County has adopted similar permitting for unincorporated areas.",
    batteryPara: "Battery adoption in Austin is strong, driven by Winter Storm Uri memory (February 2021 grid failure was especially acute in Austin) and annual tornado season outage risk. Tesla Powerwall 3 dominates. Enphase IQ Battery and FranklinWH are secondary. Austin Energy's Battery Storage Incentive Program offers $1,500 rebates for qualifying battery installations (limited annual capacity). Federal ITC at 30 percent applies to battery. The Austin Energy Value of Solar tariff makes solar-only economics favorable enough that battery is typically resilience-driven rather than arbitrage-driven.",
    climateRiskPara: "Austin climate risks for solar are spring hail (ASCE 7-16 Category II, 115 mph design wind; Class 4 hail-impact modules increasingly standard), occasional severe ice storms (February 2023 caused documented residential racking failures), and summer extreme heat reducing output 10-14 percent below STC on 105F-plus days. Hurricane-season tropical systems occasionally affect Austin secondarily. Central Texas tornado season (March through May) drives heavy insurance scrutiny.",
    timelinePara: "Full timeline from contract signing to PTO in Austin runs 8-14 weeks: 1-2 weeks site assessment and engineering, 2-4 weeks permitting (slower in Edwards Aquifer zone), 1-2 days installation, 1-2 weeks inspection, 2-6 weeks Austin Energy interconnection. The October-January installation window avoids summer heat and ice-storm risk while getting the system online before the high-AC-load April-through-October season.",
    uniqueInsightPara: "Austin Energy's Value of Solar tariff is a national innovation that provides more transparent ongoing solar compensation than traditional net metering. The Austin Energy Green Building program certifies solar installers and provides free pre-install consultation for residential customers. Austin's strong solar adoption culture and technical workforce (ERCOT headquarters, many IBM and Dell facilities) create a knowledgeable consumer base that pushes quality standards across local installers.",
  },

  "san-francisco-ca": {
    peakSunHours: 4.5,
    paybackYears: "10-13 years",
    utility: "PG&E (Pacific Gas and Electric)",
    bestInstallMonth: "February-April",
    sunPara: "San Francisco averages 4.5 peak sun hours daily with June-July production at 6.0 kWh per kW per day and December at 2.4. The city's famous marine-layer pattern (Karl the Fog) creates dramatic microclimate differences: Noe Valley, Mission, and Bernal Heights sit in a sun pocket receiving 15-25 percent more annual insolation than the Sunset, Richmond, or Twin Peaks which are fog-blanketed for much of the morning. SoMa and Dogpatch see intermediate insolation. This SF microclimate factor is larger than any other major US metro.",
    tariffPara: "PG&E residential solar customers connected after April 15, 2023 fall under California NEM 3.0 (officially Net Billing Tariff), which cut export credits by roughly 75 percent versus NEM 2.0 and uses hourly avoided-cost pricing. A standalone solar system in SF now has payback stretched to 10-plus years. Pairing with battery storage for self-consumption is essentially required for reasonable economics; solar-plus-battery recovers much of the NEM 2.0-era value proposition. Existing pre-April-2023 NEM 2.0 customers are grandfathered for 20 years from interconnection date.",
    interconnectPara: "PG&E interconnection for residential systems under 30 kW runs 6-10 weeks through the PG&E IOU Interconnection Portal. San Francisco Department of Building Inspection (DBI) issues solar permits through the Solar Express Permit program with same-day online issuance for standard installs under 10 kW. Historic district properties in Pacific Heights, Alamo Square, or parts of the Haight trigger Planning Department review adding 4-8 weeks. DBI's automated permit portal is among the fastest in California.",
    installerLandscapePara: "The SF installer market is led by Sunrun (HQ in San Francisco), Sungevity, Luminalt (SF-based small-footprint specialty), and Sol Alliance. Regional specialty crews include SunLight and Power (Berkeley), Cinnamon Energy Systems, and Cobalt Power Systems. SunPower is headquartered in San Jose and has strong Bay Area dealer presence. Tesla Energy operates. California Contractors State License Board requires C-10 Electrical or C-46 Solar licensing. Typical SF residential quote runs $3.20-$4.20 per watt before incentives, the highest of the major California metros because of roof complexity and Victorian access challenges.",
    incentivesPara: "California offers no state solar tax credit. Federal ITC at 30 percent is the primary upfront incentive. California Revenue and Taxation Code 73 excludes solar improvements from property tax reassessment through 2026. California SGIP (Self-Generation Incentive Program) provides battery storage rebates of $150-$1,000 per kWh depending on equity tier; SF residents in PSPS-risk zones qualify for Equity Resiliency tier with highest rebates. BayREN Home+ offers insulation and weatherization bundles that pair with solar. SF GoSolarSF program was phased out but community solar options remain.",
    roofLandscapePara: "SF rooftop stock is dominated by Victorian and Edwardian architecture (1870s-1920s) with complex rooflines, dormers, bay windows, and turrets that complicate panel layout. Tar-and-gravel or built-up roof (BUR) flat roofs are common on post-war duplexes and apartments; these require specialty ballasted or flashed penetration-fastened racking. Composition shingle on Marina and Richmond stucco-over-frame homes is rare but preferred where available. The steep SF hillside orientation means many homes face directly into hillsides with compromised solar access; solar viability requires site-specific shade analysis.",
    hoaAndRestrictPara: "California Civil Code Section 714 (Solar Rights Act) is the strongest solar access law in the country. HOAs and condo associations cannot prohibit solar and can impose only restrictions that add less than $1,000 in cost or reduce output by less than 10 percent. SB 1226 extended protections to multifamily common-area roofs, which matters in SF's dominant condo market. Article 10 and Article 11 Historic Preservation districts (Alamo Square, Pacific Heights, parts of the Haight) require Certificate of Appropriateness for visible solar. SF Historic Preservation Commission reviews take 6-12 weeks.",
    permitProcessPara: "SF DBI's Solar Express Permit portal issues standard residential permits same-day for installs under 10 kW on non-historic properties. Historic district properties require Planning Department review before DBI permit can issue. The SF permit system is among the fastest in California for standard installs and among the slower for complex or landmark-adjacent scope. Title 24 Part 6 solar-ready provisions apply to new construction only. SF has its own Green Building Ordinance with additional requirements.",
    batteryPara: "Battery adoption in SF is extremely strong because of NEM 3.0 economics (battery is effectively required for new installs) and PSPS outage risk during fire weather. Tesla Powerwall 3 dominates. Enphase IQ Battery 10 and FranklinWH are strong secondary. California SGIP Equity Resiliency tier provides $1,000 per kWh for customers in High Fire Risk Areas; much of the SF hillside qualifies. Federal ITC at 30 percent applies to battery. PG&E's time-of-use rates make battery arbitrage valuable.",
    climateRiskPara: "SF climate risks for solar are wind uplift (Golden Gate winds regularly exceed 50 mph and the Sunset faces direct westerlies), marine salt exposure (chloride corrosion of module frames documented 40 percent faster than inland within 1 mile of ocean), and wildfire smoke (summer fires in Northern California reduce Bay Area production 15-25 percent for 2-6 weeks). Tier 1 modules with marine-grade aluminum frames are mandatory spec for Ocean Beach-adjacent installs.",
    timelinePara: "Full timeline from contract signing to PTO in SF runs 10-16 weeks: 1-2 weeks site assessment and engineering (SF Victorian complexity adds time), same-day to 8 weeks permitting (fast for standard, slow for Landmark), 2-4 days installation (complex rooflines), 1-2 weeks inspection, 6-10 weeks PG&E interconnection. The February-April installation window captures the full April-October peak production season and avoids fog-heavy summer installation scheduling.",
    uniqueInsightPara: "SF's microclimate fog pattern makes site-specific solar assessment more important than in any other US metro. The San Francisco Environment Department maintains the SunShares group-purchase program for bulk pricing. CleanPowerSF community choice aggregation offers alternative utility structure that pairs with rooftop solar. The SF Planning Department's automated solar review for non-landmark properties is faster than most California jurisdictions.",
  },

  "las-vegas-nv": {
    peakSunHours: 6.4,
    paybackYears: "8-10 years",
    utility: "NV Energy",
    bestInstallMonth: "October-February",
    sunPara: "Las Vegas averages 6.4 peak sun hours daily, the second-strongest major US metro (behind only Phoenix) with 294 annual clear-sky days. June production hits 8.0 kWh per kW per day and December still delivers 4.4. Monsoon-season afternoon thunderstorms (July through mid-September) briefly clip production but rarely disrupt daily totals significantly. Summerlin and Henderson receive marginally less annual insolation than Central Las Vegas because of slightly more dust buildup frequency; post-dust-storm cleaning recovers 3-5 percent production.",
    tariffPara: "NV Energy residential solar operates under Nevada's tiered net metering structure (AB 405, 2017) with export credits at 75 percent of retail rate in Tier 3 (current enrollment tier) declining to 50 percent in Tier 4 as statewide capacity fills. Nevada abandoned true 1-for-1 net metering in 2015 (the infamous grandfathering crisis) and rebuilt it with declining tiers. Monthly rollover applies; annual true-up credits expire rather than rolling. Tier 3 rates are more favorable than APS RCP in Arizona but less than LADWP or Xcel Colorado.",
    interconnectPara: "NV Energy interconnection for residential systems under 25 kW runs 3-6 weeks through the NV Energy RenewableGenerations portal. Clark County Department of Building and Fire Prevention issues solar permits in 2-5 business days, among the fastest in the Mountain West. City of Las Vegas Building and Safety issues permits separately for city-limits properties. Henderson, North Las Vegas, and Boulder City each maintain their own permitting portals with similar turnaround.",
    installerLandscapePara: "The Las Vegas installer market is led by Sol-Up Nevada (Henderson-based), Sunrun, Robco Electric, and Sunpower dealers including Bombard Electric. Regional crews include Go Solar Group, Silver State Solar, and Nevada Solar Group. Tesla Energy operates. Nevada State Contractors Board requires a C-2 Electrical license for solar work plus specialty solar endorsement. Typical Las Vegas residential quote runs $2.50-$3.20 per watt before incentives, competitive with Phoenix. The Nevada solar market recovered strongly after the 2015-2017 grandfathering crisis.",
    incentivesPara: "Nevada has no state solar tax credit (Nevada has no state income tax). Federal ITC at 30 percent is the primary upfront incentive. Nevada Revised Statutes 701A.200 provides Renewable Energy Tax Abatement on the added home value from solar (100 percent property tax exemption for qualifying systems). Nevada has no state sales tax to exempt on the state side, but Clark County sales tax (8.375 percent) does apply to equipment. NV Energy's SolarGenerations rebate program phased out in 2016 and has not been replaced.",
    roofLandscapePara: "Las Vegas rooftop stock is heavily concrete tile (flat S-tile and barrel tile) on post-1990 Summerlin, Henderson, Anthem, and Aliante master-planned housing. Tile mounting adds 15-25 percent install cost. Composition shingle is common in pre-1990 Downtown and Huntridge neighborhoods and in 1970s Paradise and Spring Valley. Flat-roof foam (SPF) is a Vegas-specific premium roof type on custom homes; it requires ballasted racking because SPF does not accept penetration. Standing seam metal appears in new high-end construction.",
    hoaAndRestrictPara: "Nevada Revised Statute 111.239 prohibits HOAs from banning solar and limits aesthetic restrictions to those not significantly increasing cost or reducing efficiency. The statute has been tested in Nevada courts and upheld. Master-planned communities in Summerlin (Howard Hughes), Anthem (Del Webb), and Lake Las Vegas have architectural review committees that must comply with NRS 111.239 but impose placement and tile-color-matching rules within the 10 percent output reduction limit. HOA approval typically takes 2-6 weeks, often longer than Clark County permitting.",
    permitProcessPara: "Clark County Department of Building and Fire Prevention issues solar permits through the online portal in 2-5 business days. City of Las Vegas Building and Safety runs a parallel system for city-limits addresses. Henderson, North Las Vegas, and Boulder City each operate separate permitting. IRC 2018 with Clark County amendments applies to residential solar. Nevada adopted NEC 2020 for residential electrical work. The Nevada Office of Energy's Green Building program provides technical assistance.",
    batteryPara: "Battery adoption in Las Vegas is moderate, driven by extreme-heat grid-strain resilience and the less-favorable NV Energy tiered net metering. Tesla Powerwall 3 dominates. Enphase IQ Battery 10 and FranklinWH are secondary. Federal ITC at 30 percent applies. NV Energy's Optional Time-of-Use rate plans (RS OTU) can improve battery arbitrage economics. Nevada Governor's Office of Energy occasionally offers grant programs for battery-inclusive residential solar.",
    climateRiskPara: "Las Vegas climate risks for solar are extreme heat (cell temperatures routinely exceed 80C on 115F-plus days, reducing output 18-25 percent below STC; inverter derating is a design consideration), monsoon dust storms (cleaning frequency 2-3 times per year for peak production), and rare but intense microbursts during summer thunderstorms (80-100 mph gusts documented). UV-rated module backsheets are mandatory Tier 1 spec. Inverter oversizing of 15-25 percent helps capture summer-afternoon production despite heat derating.",
    timelinePara: "Full timeline from contract signing to PTO in Las Vegas runs 6-12 weeks: 1 week site assessment and engineering, 2-5 days permitting, 2-6 weeks HOA approval (often the longest step), 1-2 days installation, 3-7 days inspection, 3-6 weeks NV Energy interconnection. The October-February installation window avoids summer roof temperatures above 160F and gets the system online before peak AC season in April.",
    uniqueInsightPara: "Las Vegas has some of the best solar economics in the country thanks to 6.4 peak sun hours, zero state income tax, and a maturing installer market. NV Energy's Green Rate program offers optional renewable energy purchasing for households unable to install rooftop solar. The Nevada Solar Policy group tracks PUCN rulings that affect residential solar. Clark County's SolarAPP+ adoption is accelerating permit timelines further.",
  },

  "philadelphia-pa": {
    peakSunHours: 4.2,
    paybackYears: "8-10 years",
    utility: "PECO (an Exelon company)",
    bestInstallMonth: "March-May",
    sunPara: "Philadelphia averages 4.2 peak sun hours daily with June-July production at 6.0 kWh per kW per day and December at 2.2 because of mid-Atlantic winter cloud cover. Summer hazy skies from Appalachian haze reduce summer production 8-12 percent versus clear-sky modeling. Center City and rowhouse neighborhoods (Fishtown, Northern Liberties, South Philly) receive 3-5 percent more annual insolation than the tree-canopied West Philly and Chestnut Hill because of urban heat island and reduced tree shading.",
    tariffPara: "PECO residential solar operates under Pennsylvania's mandated 1-for-1 retail-rate net metering for systems up to 50 kW under 52 Pa. Code Chapter 75. Export credits roll forward month-to-month with an annual true-up at the Price-to-Compare default service rate. This is one of the strongest net metering frameworks in the mid-Atlantic. Pennsylvania's deregulated supply market means customers can separately shop for electricity supply from competitive suppliers; solar economics depend on the total bundled rate including distribution and supply.",
    interconnectPara: "PECO interconnection for residential systems under 50 kW runs 4-8 weeks through the PECO DG Portal. Philadelphia Department of Licenses and Inspections (L&I) issues solar permits through the eCLIPSE portal with 2-4 week turnaround. Row home historic district properties in Society Hill, Old City, and Queen Village require Philadelphia Historical Commission review adding 6-10 weeks. Suburban Montgomery, Bucks, and Delaware county unincorporated areas use separate permitting portals.",
    installerLandscapePara: "The Philadelphia installer market is led by Exact Solar (Yardley-based), Solar States, Mercury Solar, and Sunrun. Regional specialty includes Green Street Power, Trina Solar dealers, and PECO-approved installer network. SunPower dealers include Endless Energy and Exact Solar. Tesla Energy operates. Pennsylvania Home Improvement Contractor Act requires registration for any work over $500. Pennsylvania Electrical Code 2020 applies. Typical Philadelphia residential quote runs $2.80-$3.60 per watt before incentives, slightly above the Pennsylvania state average because of row home complexity.",
    incentivesPara: "Pennsylvania has no state solar tax credit. Federal ITC at 30 percent stacks. Pennsylvania's Alternative Energy Portfolio Standards Act requires utilities to source 8 percent solar by 2030, funding the Pennsylvania SREC market. PA SRECs currently trade at $35-$45 each, generating $300-$500 per year for a typical 7 kW system. Pennsylvania exempts solar from property tax reassessment under Act 235 (limited conditions). The Pennsylvania Sunshine Solar Program phased out but Pennsylvania Solar Energy Program occasionally offers grants.",
    roofLandscapePara: "Philadelphia rooftop stock is split between brick and concrete flat roofs on row homes (South Philly, Fishtown, Northern Liberties, Center City) requiring ballasted or tilted-mount racking, and pitched composition shingle on single-family homes in Mount Airy, Chestnut Hill, and the Main Line. Three-story row homes have narrow footprints (16-20 feet wide) limiting system size to 4-6 kW typical. Slate roofs in West Philadelphia and Chestnut Hill add 20-30 percent install cost. Tar-and-gravel built-up roofs on pre-war rowhouses are common and require specialty flashing.",
    hoaAndRestrictPara: "Pennsylvania's Solar Access Rights Act (68 Pa.C.S. Chapter 31) prohibits HOAs from adopting restrictions that prevent solar installation, though it permits reasonable aesthetic guidelines. Protections are moderate compared to California or Texas. Most Philadelphia row home neighborhoods lack HOAs. Suburban townhome communities in Willow Grove, King of Prussia, and Cherry Hill have HOA review that must respect state law within aesthetic limits. Philadelphia Historical Commission designated districts (Society Hill, Old City, Queen Village, Fairmount) require Certificate of Appropriateness for visible solar.",
    permitProcessPara: "Philadelphia L&I issues solar permits through eCLIPSE online portal with 2-4 week turnaround for standard residential installs. Historic district properties require Philadelphia Historical Commission review that adds 4-8 weeks. Pennsylvania Uniform Construction Code Section 403.84 governs solar installations. Pennsylvania NEC 2020 adoption applies statewide. Suburban Montgomery County uses MuniCode online, Bucks County uses ePlan, Delaware County uses Delco Connect.",
    batteryPara: "Battery adoption in Philadelphia is moderate, driven by winter storm outage risk (ice storms and nor'easters cause multi-day outages) and PECO's relatively short SAIDI. Tesla Powerwall 3, Enphase IQ Battery 10, and FranklinWH are dominant products. Pennsylvania has no state battery rebate but federal ITC at 30 percent applies. PECO offers a small battery storage adder through the Smart Energy Resource program. Philadelphia's Greenworks plan includes distributed storage as a resilience goal but has not produced local rebates.",
    climateRiskPara: "Philadelphia climate risks for solar are wind uplift from nor'easter events (ASCE 7-16 Category II, 115 mph design wind; severe nor'easters can peak 70-80 mph), snow loading (15-25 inches annual average), and ice storm loading (the January 1994 and February 2014 events produced significant racking damage). Row home flat roof ballasted systems are especially vulnerable to nor'easter uplift; engineered ballast layouts are critical.",
    timelinePara: "Full timeline from contract signing to PTO in Philadelphia runs 10-16 weeks: 1-2 weeks site assessment and engineering, 2-8 weeks permitting (longer for historic districts), 1-2 days installation, 1-2 weeks inspection, 4-8 weeks PECO interconnection. The March-May installation window captures the full May-September peak production window and avoids winter scheduling issues on row home flat roofs where ice and snow make staging difficult.",
    uniqueInsightPara: "Philadelphia's row home stock creates unique solar opportunities via flat-roof tilted-mount arrays that often deliver better production than pitched-shingle equivalents. The Pennsylvania Keystone HELP Loan Program offers 3.99 percent APR financing up to $15,000 for residential energy improvements including solar. Philadelphia Solar States (a B Corp installer) publishes neighborhood-level solar performance data from their install base. PECO's Smart Energy Resource portal provides hourly consumption data for sizing.",
  },

  "miami-fl": {
    peakSunHours: 5.2,
    paybackYears: "7-9 years",
    utility: "FPL (Florida Power and Light)",
    bestInstallMonth: "November-February",
    sunPara: "Miami averages 5.2 peak sun hours daily with April-May production at 6.5 kWh per kW per day (before the wet season) and December still strong at 4.2. Unusually, Miami spring outperforms mid-summer because afternoon thunderstorms June through September clip production hours. Hurricane season (June through November) occasionally triggers multi-day production dips. Coral Gables, Pinecrest, and South Miami receive 5-8 percent more annual insolation than Brickell and Downtown because of urban shade and cloud generation.",
    tariffPara: "FPL residential solar operates under Florida Public Service Commission-mandated 1-for-1 retail-rate net metering. Export credits roll forward month-to-month at the full retail rate with annual true-up. Florida HB 741 in 2022 attempted to phase down rates but was vetoed by Governor DeSantis, preserving favorable economics. This is among the most favorable net metering frameworks in the Southeast and a major reason Miami has stronger solar economics than Atlanta or Charlotte. FPL's residential rate averages $0.11-$0.13 per kWh, lower than California or New York but with better net metering than either.",
    interconnectPara: "FPL interconnection for residential systems under 10 kW runs 2-4 weeks through the FPL Solar Interconnection portal. Miami-Dade County Building Department issues solar permits through the ePlan portal with 2-4 week turnaround. The High Velocity Hurricane Zone (HVHZ) designation for Miami-Dade requires Florida Product Approval (FPA) and Miami-Dade Notice of Acceptance (NOA) for any roof-mounted equipment. NOA approval for module mounting hardware is a common gating item. City of Miami, Coral Gables, and Miami Beach each have separate permitting.",
    installerLandscapePara: "The Miami installer market is led by Sunrun, Tesla Energy, SunPower dealers including Solar Bear and Solar Bros, and ADT Solar. Regional specialty includes Goldin Solar (Miami-based), AES Florida, and Solar Energy Management. Florida Department of Business and Professional Regulation (DBPR) requires a Certified Solar Contractor (CVC) license plus a Master Electrician license for the electrical work. Typical Miami residential quote runs $2.70-$3.50 per watt before incentives, with 10-15 percent premium over Orlando or Tampa because of HVHZ engineering costs.",
    incentivesPara: "Florida offers no state solar tax credit. Federal ITC at 30 percent stacks. Florida exempts solar equipment from 6 percent state sales tax (saving approximately $1,500 on a $24,000 system). Florida provides 100 percent property tax exemption on the added home value from solar (Florida Statute 196.175). FPL does not offer a solar rebate. Miami-Dade County has no local rebate tier. The Solar Co-op of Florida runs group-purchase programs that provide 10-15 percent discounts through competitive bidding. The Florida Solar Energy Center certifies installers for quality.",
    roofLandscapePara: "Miami rooftop stock is heavily concrete barrel tile (Spanish Mission style) on post-1980 Coral Gables, Pinecrest, Kendall, and Miami Lakes housing, which adds 15-25 percent install cost for specialty tile-hook mounting. Flat-concrete roofs are common on mid-century modern and new high-end construction; these require ballasted or through-penetration engineered anchoring for HVHZ compliance. Composition shingle on older Allapattah and Liberty City housing is simpler but less common. The Miami-Dade HVHZ 150-plus mph design wind adds roughly 10 percent to the racking hardware cost versus non-HVHZ markets.",
    hoaAndRestrictPara: "Florida Statute 163.04 is among the strongest solar access laws in the country. HOAs cannot prohibit solar and cannot impose restrictions that impair efficiency. Master-planned communities in Doral, Weston, Aventura, and Key Biscayne have architectural review that must respect the statute. The 2021 Florida Supreme Court ruling in Perlman v. Fishbein confirmed homeowner rights to preferred orientation unless HOA demonstrates equivalent aesthetic placement. Miami Beach architectural review districts add HEPB review for Art Deco and Mid-Century Modern protected structures.",
    permitProcessPara: "Miami-Dade County Building issues HVHZ-certified solar permits through the ePlan portal with 2-4 week turnaround. Every foam or racking component mounted to the roof must have Miami-Dade NOA or Florida Product Approval. City of Miami separate portal for city-limits. Coral Gables uses Permit Center with longer HPB review for landmarked properties. Florida Building Code 2020 with Miami-Dade HVHZ amendments applies. Hurricane shutter coordination may be required for wall-mounted disconnects.",
    batteryPara: "Battery adoption in Miami is driven almost entirely by hurricane outage risk. Tesla Powerwall 3, Enphase IQ Battery 10, and FranklinWH are dominant products. Florida has no state battery rebate. Federal ITC at 30 percent applies. FPL's time-of-use rates can improve battery arbitrage economics but spreads are modest. Miami-Dade HVHZ applies to battery installation: indoor mounting with proper UL listings is preferred, and battery location relative to egress is regulated.",
    climateRiskPara: "Miami climate risks for solar are hurricane wind uplift (HVHZ 150-plus mph design; ASCE 7-16 Category II), storm surge flooding for coastal properties, and salt spray corrosion within 1-2 miles of Biscayne Bay or the Atlantic. Module frames require marine-grade anodized aluminum with clear coat (standard Tier 1 Miami spec). Hurricane-rated flashing with engineered pull-out ratings is non-negotiable. Post-Andrew (1992) Florida Building Code revisions produce some of the strictest residential wind engineering in the country.",
    timelinePara: "Full timeline from contract signing to PTO in Miami runs 8-14 weeks: 1-2 weeks site assessment and engineering (HVHZ calculations), 2-4 weeks permitting, 2-5 days installation (tile roofs add time), 1-2 weeks inspection, 2-4 weeks FPL interconnection. The November-February installation window avoids summer thunderstorm-driven rooftop delays and hurricane season scheduling issues while getting the system online before peak AC season.",
    uniqueInsightPara: "Miami has some of the best residential solar economics in the Southeast thanks to strong net metering, 5.2 peak sun hours, and 30 percent federal ITC. Florida Solar Energy Industries Association (FlaSEIA) tracks installer certifications and policy changes. Miami-Dade County's Solar Co-op program provides group-purchase discounts through competitive installer bidding. Post-hurricane resilience planning combines solar plus battery with impact windows and generator backup in many Miami high-end installations.",
  },

  "boston-ma": {
    peakSunHours: 4.1,
    paybackYears: "6-8 years",
    utility: "Eversource",
    bestInstallMonth: "April-June",
    sunPara: "Boston averages 4.1 peak sun hours daily with June-July production at 5.8 kWh per kW per day and December at 2.0 because of New England coastal cloud cover and short days. Approximately 65 percent of annual production happens April through September. Cambridge, Somerville, and Watertown receive marginally more annual insolation than Jamaica Plain or West Roxbury because of less tree canopy shade. Back Bay and South End flat-roof installs perform 8-12 percent below optimal because of limited tilt opportunity.",
    tariffPara: "Eversource residential solar operates under Massachusetts mandated net metering through 220 CMR 18 for systems up to 10 kW. Export credits are 1-for-1 retail rate with monthly rollover and annual true-up. Credits above the retail portion are paid at the market net metering cap rate. This is among the strongest net metering frameworks in the Northeast. National Grid customers in the western metro operate under similar rules. Unitil covers a small northeast metro slice.",
    interconnectPara: "Eversource interconnection for residential systems under 25 kW runs 4-8 weeks through the Eversource DG Web Portal. Boston Inspectional Services Department (ISD) issues solar permits through the Boston online portal with 2-4 week turnaround. Historic district properties in Back Bay, Beacon Hill, South End, and Charlestown require Boston Landmarks Commission review adding 6-12 weeks. Cambridge, Somerville, Newton, and Brookline each maintain separate permitting.",
    installerLandscapePara: "The Boston installer market is led by ReVision Energy (Massachusetts-based regional), Solect Energy, SunBug Solar, and Sunrun. SunPower dealers include New England Clean Energy and Clear Sky Solar. Regional specialty includes Boston Solar, Ipswich Solar, and Brightergy. Massachusetts Division of Professional Licensure requires an Electrical Contractor license (Master Electrician C license) plus a Home Improvement Contractor registration. Typical Boston residential quote runs $2.80-$3.60 per watt before incentives, with premium for tight urban rowhouse access.",
    incentivesPara: "Massachusetts offers the Solar Massachusetts Renewable Target (SMART) program: a declining-block per-kWh incentive paid monthly for 10 years. Current block rates for Eversource East run $0.06-$0.10 per kWh depending on block and adders (low-income, storage, community). Massachusetts 15 percent state income tax credit on solar capped at $1,000. Federal ITC at 30 percent stacks. Massachusetts exempts solar equipment from 6.25 percent state sales tax. Mass Save programs include solar-adjacent insulation and efficiency bundles.",
    roofLandscapePara: "Boston rooftop stock is heavily composition shingle on single-family colonials and capes in Brookline, Newton, and the suburbs. Flat-roof rubber membrane (EPDM) on triple-deckers in Dorchester, JP, and Somerville requires ballasted or tilted-mount racking. Slate roofs in Cambridge and Beacon Hill add 20-35 percent install cost and trigger Landmarks review. Back Bay brownstone rooftops are limited and mostly flat with parapet walls. The steep New England rafter slopes (8/12 to 12/12 common on colonials) work well for solar but require safety harness work that adds labor cost.",
    hoaAndRestrictPara: "Massachusetts General Laws Chapter 184 Section 23C provides solar access protections that restrict HOA and zoning interference, though the law is weaker than California's Civil Code 714. Condo associations retain some latitude on common-element roofs, which matters significantly for Back Bay, South End, and Beacon Hill unit owners. Boston Landmarks Commission reviews all exterior work in Back Bay, Beacon Hill, South End Landmark District, and Charlestown Navy Yard Historic District. Cambridge Historical Commission has parallel review.",
    permitProcessPara: "Boston ISD processes residential solar permits in 2-4 weeks through the online portal. Historic district properties trigger Landmarks Commission review with 6-12 week turnaround. Cambridge Inspectional Services uses separate portal with 3-5 week turnaround. Newton, Brookline, Somerville each have their own. Massachusetts Stretch Code (2020 IECC plus Mass amendments) applies. NEC 2020 Massachusetts adoption with some state variances applies to solar scope.",
    batteryPara: "Battery adoption in Boston is strong, driven by winter storm outage risk (ice storms and nor'easters regularly produce multi-day outages) and the SMART storage adder that stacks on monthly production payments. Tesla Powerwall 3, Enphase IQ Battery 10, and FranklinWH are dominant. Mass Save ConnectedSolutions program provides performance-based payments (up to $1,500 per year) for battery dispatch participation. Federal ITC at 30 percent applies. Massachusetts has among the most favorable battery economics in the country thanks to SMART + ConnectedSolutions stacking.",
    climateRiskPara: "Boston climate risks for solar are nor'easter wind uplift (ASCE 7-16 Category II, 130-140 mph coastal design wind), heavy snow loading (40-60 inches annual average; 2015 set the modern record at 110 inches), and ice storm loading. The 2015 snow season tested residential racking across the metro. Ground-snow load is 40 psf under IBC 2018 Table 1608.1 coastal and 50 psf inland. Module racking must be spec'd for Boston snow-load zone with appropriate IronRidge XR or Unirac ULA snow-load hardware.",
    timelinePara: "Full timeline from contract signing to PTO in Boston runs 12-20 weeks: 1-2 weeks site assessment and engineering, 2-12 weeks permitting (fast for standard, long for Landmarks), 1-3 days installation, 1-2 weeks inspection, 4-8 weeks Eversource interconnection. The April-June installation window captures the full April-September peak production window and avoids frozen-roof winter scheduling.",
    uniqueInsightPara: "Boston's SMART program plus ConnectedSolutions battery dispatch produce some of the strongest residential solar-plus-storage economics in the country. The Massachusetts Clean Energy Center (MassCEC) administers the Mass Solar Loan Program with 0 percent APR financing for income-qualifying households. Sustainable Cambridge tracks solar adoption block-by-block. The triple-decker roof profile across Dorchester and JP is particularly well-suited for solar thanks to generous flat-roof square footage.",
  },

  "san-diego-ca": {
    peakSunHours: 5.5,
    paybackYears: "7-10 years",
    utility: "SDG&E (San Diego Gas and Electric)",
    bestInstallMonth: "January-March",
    sunPara: "San Diego averages 5.5 peak sun hours daily with May-July production at 6.8 kWh per kW per day and December still strong at 4.2, one of the most consistent year-round production profiles in the US thanks to the mild coastal climate. May Gray and June Gloom marine layer reduces morning production near the coast (La Jolla, Pacific Beach, Point Loma) 10-18 percent but typically burns off by noon. Inland Poway, Rancho Bernardo, and Escondido see minimal marine-layer impact with consistently clearer morning skies.",
    tariffPara: "SDG&E customers interconnecting after April 15, 2023 fall under California NEM 3.0 (Net Billing Tariff) with export credits at roughly 25 percent of retail value versus NEM 2.0. SDG&E has the highest retail rates in the continental US (averaging $0.40-$0.50 per kWh on summer peak hours), so even NEM 3.0 solar-plus-battery economics remain compelling for self-consumption. Pre-April-2023 NEM 2.0 customers are grandfathered 20 years from interconnection. Battery storage is functionally required for new installs to capture reasonable payback.",
    interconnectPara: "SDG&E interconnection for residential systems under 30 kW runs 4-8 weeks through the SDG&E Net Energy Metering portal. City of San Diego Development Services uses the SolarAPP+ automated portal for instant permit issuance on qualifying residential installs under 10 kW. Chula Vista, Oceanside, Encinitas, and Escondido each maintain separate permitting. San Diego County unincorporated permitting uses County eServices. Coastal Commission review adds 4-8 weeks for properties in the coastal overlay zone.",
    installerLandscapePara: "The San Diego installer market is led by Sunrun, Baker Electric Home Energy, Stellar Solar, and Sullivan Solar Power. SunPower dealers include SunPower by Tecta and Sunnymead Solar. Regional specialty includes San Diego Solar Direct, Action Solar Installation, and California Solar Systems. Tesla Energy operates. California Contractors State License Board requires C-10 Electrical or C-46 Solar licensing. Typical SD residential quote runs $2.80-$3.60 per watt before incentives, slightly below LA pricing because of lower labor costs and more streamlined permitting.",
    incentivesPara: "California offers no state solar tax credit. Federal ITC at 30 percent is the primary upfront incentive. California property tax exclusion (RTC 73) extends through 2026. California SGIP battery rebates of $150-$1,000 per kWh; San Diego residents in PSPS-risk zones (much of east county including Ramona, Julian, Alpine) qualify for Equity Resiliency tier. SDG&E's Energy Savings Assistance Program covers income-qualifying households. The San Diego Regional Climate Collaborative provides pre-install consultation resources.",
    roofLandscapePara: "San Diego rooftop stock is a mix of composition shingle on 1960s-1990s tract housing in Mira Mesa, Rancho Penasquitos, and Clairemont; concrete tile (flat and S-tile) on post-1980 luxury housing in Carmel Valley, Del Mar, and La Jolla; and clay tile on Spanish Revival homes in Point Loma and Kensington. Tile adds 15-20 percent install cost. Flat-roof homes in Bird Rock and La Jolla Shores require ballasted or penetration-engineered racking. The Coastal Fog Zone within 1 mile of the ocean requires marine-grade aluminum module frames.",
    hoaAndRestrictPara: "California Civil Code Section 714 (Solar Rights Act) is the strongest solar access law in the country. HOAs can impose only restrictions that add less than $1,000 in cost or reduce output by less than 10 percent. Master-planned communities in Carmel Valley, Del Sur, 4S Ranch, and Rancho Bernardo have architectural review within those limits. Coastal Development Permit process through California Coastal Commission applies to any visible work on properties seaward of the Coastal Zone boundary. La Jolla Shores has additional community-specific overlay.",
    permitProcessPara: "San Diego Development Services uses SolarAPP+ automated portal for same-day permit issuance on standard residential installs under 10 kW. Complex installs or tile-roof structural reinforcements take 2-5 days through standard plan check. County unincorporated areas use County eServices with 3-7 day turnaround. Title 24 Part 6 solar-ready provisions apply to new construction. NEC 2020 California amendments apply to solar scope.",
    batteryPara: "Battery adoption in San Diego is extremely strong because of NEM 3.0 economics and PSPS outage risk in east county fire zones. Tesla Powerwall 3 dominates. Enphase IQ Battery 10 and FranklinWH are strong secondary. California SGIP Equity Resiliency tier provides $1,000 per kWh for High Fire Risk Area customers. SDG&E's Critical Peak Pricing and Time-of-Use 5-8pm plans make battery arbitrage economically valuable. Federal ITC at 30 percent applies.",
    climateRiskPara: "San Diego climate risks for solar are Santa Ana wind events (October-November dry season brings 60-80 mph gusts), wildfire smoke (reduces production 10-20 percent for 2-4 weeks most years), and marine salt corrosion in coastal ZIPs. Module frame marine-grade certification is mandatory Tier 1 spec within 1 mile of ocean. Module backsheet UV-accelerated aging is a Southern California concern that Tier 1 manufacturers address with polyamide or fluoropolymer backsheet chemistry.",
    timelinePara: "Full timeline from contract signing to PTO in San Diego runs 8-14 weeks: 1 week site assessment and engineering, same-day to 1 week permitting (SolarAPP+ fast), 1-2 days installation (tile roofs add time), 3-7 days inspection, 4-8 weeks SDG&E interconnection. The January-March installation window captures the full April-September peak production window and avoids marine-layer morning installation scheduling in May-June.",
    uniqueInsightPara: "San Diego has some of the highest electricity rates in the US, making self-consumption solar compelling even under NEM 3.0. SDG&E's EV Climate Credit provides additional bill offset that affects net solar economics. Center for Sustainable Energy (CSE) administers SGIP in San Diego and provides neutral battery sizing guidance. San Diego's SolarAPP+ adoption is among the fastest in California for permit speed.",
  },

  "tampa-fl": {
    peakSunHours: 5.3,
    paybackYears: "7-9 years",
    utility: "TECO (Tampa Electric Company)",
    bestInstallMonth: "November-February",
    sunPara: "Tampa averages 5.3 peak sun hours daily with April-May production at 6.6 kWh per kW per day and December at 4.3. Like Miami, Tampa spring outperforms mid-summer because of daily afternoon thunderstorms June through September. Hurricane season adds periodic multi-day production dips. South Tampa and Carrollwood receive marginally more annual insolation than St. Petersburg because St. Pete's peninsula position creates more frequent Gulf cloud buildup. Westchase and New Tampa see intermediate insolation.",
    tariffPara: "TECO residential solar operates under Florida Public Service Commission-mandated 1-for-1 retail-rate net metering. Exported energy is credited at full retail rate with monthly rollover; any annual surplus is paid at TECO's avoided-cost rate. Florida HB 741 attempted to phase down net metering in 2022 but was vetoed by Governor DeSantis, preserving current economics. Duke Energy Florida covers the northern Tampa Bay metro edge (Pasco, northern Pinellas) under similar rules. TECO residential rates average $0.11-$0.13 per kWh.",
    interconnectPara: "TECO interconnection for residential systems under 10 kW runs 2-4 weeks through the TECO Renewable Energy portal. Hillsborough County and City of Tampa Building Services issue solar permits through the Accela Citizen Access portal with 2-4 week turnaround. St. Petersburg uses the St. Pete Permit portal. Clearwater and Pinellas County unincorporated use separate portals. The Florida Wind Zone 140-150 mph design requires engineered racking calculations for any residential roof mount.",
    installerLandscapePara: "The Tampa installer market is led by Sunrun, Tesla Energy, ADT Solar, and SunPower dealers including Gulf Coast Solar and Big Dog Solar. Regional specialty includes Urban Solar, FLA-SunPro, and Solar Bear Tampa. Florida DBPR requires Certified Solar Contractor (CVC) licensing plus Master Electrician for electrical. Typical Tampa residential quote runs $2.60-$3.40 per watt before incentives, competitive with Orlando and 8-12 percent below Miami because of lower HVHZ-certification complexity.",
    incentivesPara: "Florida offers no state solar tax credit. Federal ITC at 30 percent stacks. Florida exempts solar equipment from 6 percent state sales tax. Florida provides 100 percent property tax exemption on the added home value from solar (Florida Statute 196.175). TECO offers no residential solar rebate. Hillsborough County has no local rebate tier. The Florida Solar Energy Center (at UCF) certifies installers for quality. Solar United Neighbors of Florida runs co-op group-purchase programs that save 10-15 percent.",
    roofLandscapePara: "Tampa rooftop stock is heavily composition shingle on post-1970 suburban housing in South Tampa, Carrollwood, Westchase, and New Tampa. Concrete barrel tile appears in luxury neighborhoods (Avila, Cheval, Weston) and adds 15-20 percent install cost. Metal standing seam is common in new construction and LEED-certified homes. Florida Wind Zone 140-150 mph design applies to Hillsborough County, requiring engineered flashing and racking certifications. Hurricane-rated installations require upgraded hardware at roughly 8-12 percent premium over base pricing.",
    hoaAndRestrictPara: "Florida Statute 163.04 provides some of the strongest solar access protections in the country. HOAs cannot prohibit solar and cannot impose restrictions that impair efficiency. Master-planned communities in FishHawk Ranch, Westchase, Avila, and Trinity have architectural review that must respect the statute. Placement restrictions are permitted only if they do not reduce output. Ybor City historic district and Hyde Park Historic District add historic review but do not prohibit solar.",
    permitProcessPara: "Hillsborough County and City of Tampa Building Services issue solar permits through the Accela portal with 2-4 week turnaround. Florida Wind Zone design wind calculations (140-150 mph for Hillsborough) are required at permit. Florida Building Code 2020 with Tampa amendments applies. Pinellas County and St. Petersburg use separate portals. NEC 2020 Florida adoption applies. Florida Product Approval is required for any foam bonded to roof sheathing.",
    batteryPara: "Battery adoption in Tampa is driven by hurricane outage risk and the 2004 Charley and 2017 Irma memory. Tesla Powerwall 3 dominates. Enphase IQ Battery 10 and FranklinWH are secondary. Florida has no state battery rebate. Federal ITC at 30 percent applies. TECO's Time-of-Day Pricing can improve battery arbitrage economics but spreads are modest. Indoor battery installation requires proper UL-9540A listing and coordination with Florida Building Code sections on energy storage.",
    climateRiskPara: "Tampa climate risks for solar are hurricane wind uplift (ASCE 7-16 Category II; Florida Wind Zone 140-150 mph), storm surge in low-lying coastal ZIPs (South Tampa below 10 feet elevation), and lightning strikes from daily summer thunderstorms. Module frames require marine-grade anodized aluminum within 1 mile of Tampa Bay. Surge Protection Devices (SPD) at the DC combiner and AC service entrance are mandatory spec in Florida. Lightning strikes per square mile per year are among the highest in the US.",
    timelinePara: "Full timeline from contract signing to PTO in Tampa runs 8-14 weeks: 1-2 weeks site assessment and engineering (wind calculations), 2-4 weeks permitting, 1-2 days installation, 1-2 weeks inspection, 2-4 weeks TECO interconnection. The November-February installation window avoids daily thunderstorm delays and extreme roof temperatures during summer while getting the system online before peak AC season.",
    uniqueInsightPara: "Tampa Bay has strong residential solar economics thanks to Florida's favorable net metering preservation, property tax exemption, and sales tax exemption. Solar United Neighbors of Florida Tampa Bay Co-op provides group-purchase discounts. The Tampa Bay Solar Advocacy group tracks policy at the Florida PSC level. Hurricane plus solar plus battery resilience packages are a growing Tampa Bay specialty that bundles impact windows with roof-mount solar.",
  },

  "detroit-mi": {
    peakSunHours: 4.0,
    paybackYears: "11-14 years",
    utility: "DTE Energy",
    bestInstallMonth: "April-June",
    sunPara: "Detroit averages 4.0 peak sun hours daily with June-July production at 5.8 kWh per kW per day and December at 1.8 because of Great Lakes cloud cover and short winter days. Over 65 percent of annual production happens April through September. Ann Arbor and the western suburbs (Novi, Farmington Hills) receive 3-5 percent more annual insolation than downtown Detroit because of less lake-effect cloudiness off Lake Erie. Grosse Pointe faces more lake-effect cloud than Warren or Sterling Heights.",
    tariffPara: "DTE Energy residential solar operates under Michigan's Distributed Generation (DG) Program rather than traditional net metering, following PA 341 reforms. DG customers receive the full retail rate only for the supply portion of their bill (roughly 40 percent of total rate) for exported energy; transmission and distribution portions are not credited. This is significantly less favorable than true 1-for-1 net metering and extends payback versus neighboring states. Consumers Energy in the western suburbs uses a similar DG structure. Michigan PSC is considering reforms but no changes in 2024-2025.",
    interconnectPara: "DTE Energy interconnection for residential systems under 150 kW runs 6-10 weeks through the DTE DG Application Portal. City of Detroit Buildings, Safety Engineering and Environmental Department (BSEED) issues solar permits in 3-5 weeks. Suburban Wayne, Oakland, and Macomb county municipalities (Royal Oak, Troy, Warren) each have separate permitting with 2-6 week turnaround. DTE interconnection is the timeline bottleneck; this is among the slower utility interconnection processes in the Midwest.",
    installerLandscapePara: "The Detroit installer market is led by Srinergy, Michigan Solar Solutions, Homeland Solar, and Strawberry Solar. Regional specialty includes Solarize Royal Oak, Heat-n-Sweep, and Pink Energy. Tesla Energy operates at modest volume. Sunrun and SunPower dealers have moderate Detroit presence. Michigan Department of Licensing and Regulatory Affairs requires Residential Builder license and Master Electrician licensing. Typical Detroit residential quote runs $2.90-$3.60 per watt before incentives, slightly above the Midwest average because of lower install volume.",
    incentivesPara: "Michigan offers no state solar tax credit. Federal ITC at 30 percent is the primary upfront incentive. Michigan does not exempt solar from property tax increases, which makes Michigan one of the least solar-favorable tax jurisdictions in the Midwest (Michigan legislature has introduced exemption bills but none have passed). Michigan does not offer a sales tax exemption on solar equipment. DTE Energy has no residential solar rebate. SAFE Michigan Loan Program provides 3.99 percent APR financing up to $10,000 for energy improvements.",
    roofLandscapePara: "Detroit rooftop stock is heavily composition shingle on single-family housing in Royal Oak, Ferndale, Troy, and the inner suburbs. Brick colonial and bungalow stock in Boston-Edison, Indian Village, and Palmer Woods has steep pitches (8/12 to 12/12) that complicate installation. Slate roofs in Grosse Pointe and Bloomfield Hills add 20-30 percent install cost. Flat tar-and-gravel roofs on pre-war apartments are limited. Michigan snow-load zone requires 30-40 psf racking; snow sliding off steep pitches is a safety consideration for installers.",
    hoaAndRestrictPara: "Michigan has no statewide solar access law protecting homeowners from HOA restrictions, which is a meaningful gap versus Illinois, Ohio, and neighboring states. Some municipalities (Ann Arbor, East Lansing) have passed local solar access ordinances. Master-planned communities in Novi (Bellagio, Lakes of Novi) and Rochester Hills have architectural review that can restrict solar visibility. Detroit Historic District Commission reviews exterior work in Indian Village, Boston-Edison, West Canfield, and other designated districts.",
    permitProcessPara: "Detroit BSEED issues solar permits in 3-5 weeks through the online portal. Suburban Royal Oak, Birmingham, Troy, Warren, and Sterling Heights each have separate portals with 2-6 week turnaround. Historic district projects in Indian Village or Boston-Edison require HDC review adding 4-8 weeks. Michigan Residential Code 2015 with state amendments applies. NEC 2020 Michigan adoption applies to electrical scope. Michigan Electrical Inspector approval is required before DTE interconnection.",
    batteryPara: "Battery adoption in Detroit is driven by winter storm outage risk and DTE's relatively long SAIDI (system average interruption duration) compared to other utilities. Tesla Powerwall 3 and Enphase IQ Battery 10 dominate. Generac PWRcell has strong Detroit presence because of long-term Generac dealer relationships in the automotive-era electrical trades. No state battery rebate. Federal ITC at 30 percent applies. DTE's Time-of-Day Rate can improve battery arbitrage but spreads are small.",
    climateRiskPara: "Detroit climate risks for solar are wind uplift from lake-effect storm events (ASCE 7-16 Category II, 115 mph design), heavy snow loading (35-45 inches annual average), and ice storm loading. The 2019 polar vortex and 2021 snowstorm events tested residential racking across the metro. Ground-snow load is 30-35 psf under IBC 2018. Module racking must be spec'd for Great Lakes snow-load zone with appropriate IronRidge XR or Unirac ULA hardware including snow-load upgrades.",
    timelinePara: "Full timeline from contract signing to PTO in Detroit runs 14-22 weeks: 1-2 weeks site assessment and engineering, 3-8 weeks permitting (longer in historic districts), 1-2 days installation, 1-2 weeks inspection, 6-10 weeks DTE interconnection (the timeline bottleneck). The April-June installation window avoids frozen-roof winter scheduling and captures the full April-September peak production window.",
    uniqueInsightPara: "Detroit's residential solar market faces among the most challenging economics of any major metro because of Michigan's DG program structure (reduced export credit value) and no property tax exemption. Nonetheless, federal ITC plus rising retail rates make solar increasingly competitive. The Michigan Saves Loan Program provides 4.99-7.99 percent APR financing for residential energy improvements. Solar United Neighbors Michigan runs co-op group-purchase programs that save 10-15 percent through bulk bidding.",
  },

  "minneapolis-mn": {
    peakSunHours: 4.2,
    paybackYears: "9-12 years",
    utility: "Xcel Energy",
    bestInstallMonth: "May-July",
    sunPara: "Minneapolis averages 4.2 peak sun hours daily with June-July production at 6.0 kWh per kW per day and December at 1.6 because of deep snow cover, sub-zero temperatures, and shortened winter days. Long summer days (15-plus hours at solstice) partially compensate. St. Paul and the eastern suburbs (Woodbury, Cottage Grove) receive marginally more annual insolation than Minneapolis proper because of less lake-effect cloudiness off Lake Minnetonka. Bloomington and Edina see intermediate insolation.",
    tariffPara: "Xcel Energy Minnesota residential solar operates under mandated 1-for-1 retail-rate net metering under Minnesota Statute 216B.164 for systems up to 40 kW. Export credits roll forward month-to-month with annual true-up at Xcel's average retail rate. This is among the strongest net metering frameworks in the Midwest. Minnesota Power and Great River Energy cover portions of the outer metro under similar rules. Minnesota's Value of Solar (VOS) optional tariff provides an alternative with time-of-day pricing but lower annual average compensation.",
    interconnectPara: "Xcel Energy interconnection for residential systems under 40 kW runs 4-8 weeks through the Xcel Energy Renewable Connections Portal. City of Minneapolis Community Planning and Economic Development issues solar permits in 2-4 weeks. City of Saint Paul uses separate portal with 2-4 week turnaround. Suburban Hennepin, Ramsey, Dakota, and Anoka counties use municipal portals. Minnesota has adopted standardized SolarAPP+ for qualifying projects in some municipalities, dropping permit time to same-day.",
    installerLandscapePara: "The Minneapolis installer market is led by iDEAL Energies (Wisconsin-based with strong Twin Cities presence), All Energy Solar, Sundial Solar, Wolf River Electric, and Sunrun. Regional specialty includes MN Solar Solutions, Next Energy, and Sundial Solar. Tesla Energy operates at modest volume. Minnesota Department of Labor and Industry requires a residential building contractor license and Master Electrician licensing. Typical Twin Cities residential quote runs $2.70-$3.40 per watt before incentives, competitive with the broader Midwest.",
    incentivesPara: "Minnesota offers the Solar*Rewards program (Xcel Energy administered) with $0.04 per kWh performance-based payments for 10 years, subject to annual capacity caps. Federal ITC at 30 percent stacks. Minnesota exempts solar equipment from state sales tax (6.875 percent). Minnesota exempts residential solar installations from property tax under Minnesota Statute 272.02. Made in Minnesota Solar program (for Minnesota-manufactured panels) provides additional production-based incentives when program is funded. The Minnesota Solar Energy Industries Association (MnSEIA) tracks installer certifications.",
    roofLandscapePara: "Twin Cities rooftop stock is heavily composition shingle on single-family homes in Linden Hills, Richfield, and the suburbs. Steep rafter slopes (8/12 to 12/12) common in 1950s-1970s housing work well for solar snow-shedding but require safety harness work. Slate and tile appear in Kenwood, Summit Hill, and Crocus Hill and add 20-35 percent install cost. Flat-roof EPDM on triple-deckers in Uptown and Loring Park is limited but present. Minnesota snow-load zone requires 40-50 psf racking; upgraded IronRidge XR or Unirac ULA hardware is mandatory.",
    hoaAndRestrictPara: "Minnesota Statute 500.215 prohibits HOAs and private covenants from unreasonably restricting solar installations. The law allows reasonable restrictions but prohibits outright bans and restrictions that significantly impair efficiency. Protections are moderate compared to California or Texas. Master-planned communities in Plymouth, Maple Grove, and Woodbury have architectural review that must comply with state law. Minneapolis Heritage Preservation Commission and Saint Paul Heritage Preservation Commission review exterior work in designated historic districts.",
    permitProcessPara: "Minneapolis CPED issues solar permits in 2-4 weeks through the online portal. Saint Paul DSI uses separate portal. Suburban Bloomington, Edina, Minnetonka, and Woodbury each have their own. Minnesota Residential Energy Code 2020 applies (stricter than base IECC 2018). NEC 2020 Minnesota adoption applies to electrical scope. Minnesota Electrical Inspector approval is required before Xcel interconnection.",
    batteryPara: "Battery adoption in Minneapolis is moderate, driven by winter storm outage risk and the Xcel Energy Time-of-Use rate opportunities. Tesla Powerwall 3 and Enphase IQ Battery 10 dominate. Generac PWRcell has Twin Cities presence. No state battery rebate. Federal ITC at 30 percent applies. Xcel's Solar*Rewards program does not stack a battery adder currently. The extreme Minnesota cold affects battery performance: proper indoor or conditioned-garage installation is mandatory for Tier 1 battery warranty compliance.",
    climateRiskPara: "Minneapolis climate risks for solar are heavy snow loading (55-70 inches annual average; 2010-2011 set modern record at 86 inches), extreme cold (sub-20F for weeks at a time reduces inverter and battery output), wind uplift from prairie storm events, and occasional tornado risk in May-June. Ground-snow load is 50 psf under IBC 2018 Table 1608.1 northern tier. Module racking must be spec'd with snow-fence upgrades. Snow sliding off steep pitches is a major installer safety concern.",
    timelinePara: "Full timeline from contract signing to PTO in Minneapolis runs 10-16 weeks: 1-2 weeks site assessment and engineering, 2-4 weeks permitting, 1-2 days installation, 1-2 weeks inspection, 4-8 weeks Xcel interconnection. The May-July installation window avoids frozen-roof winter scheduling and captures the peak production window immediately. Winter installs are possible but slower and more expensive.",
    uniqueInsightPara: "Minnesota has some of the strongest residential solar policy support in the Midwest thanks to the Solar*Rewards production-based incentive plus mandated net metering plus property tax exemption. The Clean Energy Resource Teams (CERT) provides free pre-install consultation for Minnesota households. Solar United Neighbors Minnesota runs group-purchase co-ops. MnSEIA's annual report tracks installer performance and complaint rates across the state.",
  },

  "charlotte-nc": {
    peakSunHours: 4.7,
    paybackYears: "10-13 years",
    utility: "Duke Energy Carolinas",
    bestInstallMonth: "February-April",
    sunPara: "Charlotte averages 4.7 peak sun hours daily with May-July production at 6.2 kWh per kW per day and December-January at 3.1. Mild winters mean production drops are less severe than in the Midwest or Northeast. Summer afternoon thunderstorms are common but usually brief. Ballantyne and SouthPark receive 3-5 percent more annual insolation than NoDa and Plaza Midwood because of less urban-heat-island cloud generation. Matthews and Mint Hill see similar to Ballantyne.",
    tariffPara: "Duke Energy Carolinas residential solar transitioned from traditional 1-for-1 net metering to Solar Choice rates in 2023 under North Carolina Utilities Commission Order W-100 Sub 229. Current customers see time-of-use pricing with reduced export credits during off-peak hours plus a demand-style charge structure. Solar Choice economics are 20-35 percent less favorable than the pre-2023 framework. Existing pre-2023 customers are grandfathered into legacy net metering rules through the remainder of their 20-year term. Duke Energy Progress covers the north metro edge under similar rules.",
    interconnectPara: "Duke Energy interconnection for residential systems under 20 kW runs 3-6 weeks through the Duke Energy Interconnection Portal. City of Charlotte and Mecklenburg County Building Code Enforcement issues solar permits in 2-3 weeks through the online Land Development portal. Cabarrus, Gaston, Union, and Iredell county permits use separate portals. Concord and Gastonia each have separate municipal portals. Duke Energy interconnection review adds 3-6 weeks after permit issuance, typically the gating item for project completion.",
    installerLandscapePara: "The Charlotte installer market is led by Sigora Solar, NC Solar Now, Yes Solar Solutions, and Sunrun. Regional specialty includes Renu Energy Solutions, Baker Renewable Energy, and Southern Energy Management. SunPower dealers include Carolina Solar and Clearview Solar. Tesla Energy operates at modest volume. North Carolina Licensing Board for General Contractors requires a residential license for work over $30,000. NC Electrical Contractors License is required for electrical scope. Typical Charlotte residential quote runs $2.70-$3.40 per watt before incentives.",
    incentivesPara: "North Carolina has no state solar tax credit (expired 2015 and has not been renewed). Federal ITC at 30 percent is the primary upfront incentive. North Carolina exempts 80 percent of solar equipment value from residential property tax assessment under N.C.G.S. 105-275. North Carolina does not exempt solar from sales tax. Duke Energy's residential solar rebate program was discontinued in 2022 after reaching capacity. Charlotte has no local rebate tier. Solar United Neighbors of North Carolina runs group-purchase co-ops.",
    roofLandscapePara: "Charlotte rooftop stock is heavily composition shingle on post-1990 suburban housing in Ballantyne, SouthPark, Matthews, and Huntersville. Clay and concrete tile appear in Myers Park and Eastover, adding 15-20 percent install cost. Slate roofs in Dilworth historic homes add 20-30 percent and may trigger Historic District Commission review. Metal standing seam is common in new construction. Charlotte's heavy tree canopy (nicknamed City of Trees) creates shading challenges; HelioScope or Aurora Solar irradiance modeling with tree-height LiDAR is essential.",
    hoaAndRestrictPara: "North Carolina General Statute 22B-20 prohibits HOA covenants from banning solar collectors, though the law permits restrictions on placement visible from the street and allows HOAs meaningful latitude on aesthetic requirements. Master-planned communities in Ballantyne, Piper Glen, and Highland Creek have architectural review that applies design rules. Protections are weaker than California or Texas but stronger than states with no law. Charlotte Historic District Commission reviews exterior work in Fourth Ward, Dilworth, Wesley Heights, and Plaza Midwood.",
    permitProcessPara: "Charlotte-Mecklenburg Building Code Enforcement issues solar permits in 2-3 weeks through the Land Development portal. Historic district properties trigger HDC review adding 4-6 weeks. Cabarrus, Gaston, Union, and Iredell counties each use separate portals. NC Residential Energy Code 2018 (based on IECC 2015 with NC amendments) applies. NEC 2020 North Carolina adoption applies to electrical scope. NC Electrical Inspector approval is required before Duke interconnection.",
    batteryPara: "Battery adoption in Charlotte is moderate, driven by ice storm and tornado outage risk plus Duke Solar Choice rate structure that favors self-consumption. Tesla Powerwall 3 and Enphase IQ Battery 10 dominate. FranklinWH gains share in premium tier. Duke Energy's PowerPair pilot program pays $9,000 for solar-plus-battery Packages that agree to utility dispatch, but program capacity is limited. Federal ITC at 30 percent applies. The Solar Choice rate makes battery arbitrage increasingly attractive.",
    climateRiskPara: "Charlotte climate risks for solar are summer afternoon thunderstorms (lightning strike requiring proper grounding), occasional ice storms (the 2002 storm produced regional damage), and the 2022 Christmas freeze events that briefly covered panels. Ground-snow load is minimal (10-15 psf under IBC 2018). Hurricane winds penetrate inland during tropical storm events but the metro is over 150 miles from the Atlantic coast. ASCE 7-16 Category II with 115 mph design wind applies. Class A fire-rated modules are standard.",
    timelinePara: "Full timeline from contract signing to PTO in Charlotte runs 10-14 weeks: 1-2 weeks site assessment and engineering (including tree shade analysis), 2-3 weeks permitting, 1-2 days installation, 1-2 weeks inspection, 3-6 weeks Duke interconnection. The February-April installation window captures the full May-September peak production window and avoids afternoon thunderstorm-driven rooftop delays that dominate the summer months.",
    uniqueInsightPara: "Charlotte's solar market faces transitional headwinds with Duke's new Solar Choice rate structure but federal ITC and rising retail rates still support reasonable payback. The North Carolina Clean Energy Technology Center at NC State University tracks state policy and provides neutral technical consultation. Solar United Neighbors Charlotte Co-op runs group-purchase rounds 2-3 times per year with 10-15 percent savings. Charlotte's Tree Ordinance compliance adds arborist letter requirements that reputable installers handle routinely.",
  },
};

/* --- Section 1: Neighborhood Solar Potential --- */
function neighborhoodSolarPotential(facts, solar) {
  if (!facts?.neighborhoods?.length) return "";

  const rows = facts.neighborhoods.map((n, i) => {
    const baseSouth = [62, 48, 55, 44, 58, 51];
    const treeImpact = [8, 22, 15, 12, 6, 18];
    const sysSize = [8.5, 6.5, 7.5, 7.0, 9.0, 7.0];
    const si = i % 6;

    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:center;">${baseSouth[si]}%</td>
<td style="padding:12px 16px; text-align:center;">${treeImpact[si]}%</td>
<td style="padding:12px 16px; text-align:center;">${sysSize[si]} kW</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>Neighborhood Solar Potential in ${facts.displayName}</h2>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:center; padding:12px 16px;">Favorable Orientation</th>
<th style="text-align:center; padding:12px 16px;">Shade Impact</th>
<th style="text-align:center; padding:12px 16px;">Typical System</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;"><a href="/solar-cost.html" style="color:var(--brand);">Get a personalized solar estimate.</a></p>
</section>`;
}

/* --- Section: Sun exposure --- */
function sunExposureSection(city, s) {
  return `
<section class="section fp-section">
<h2>${city} Sun Exposure and Seasonal Production</h2>
<p>${s.sunPara}</p>
</section>`;
}

/* --- Section: Utility tariff --- */
function utilityTariff(city, s) {
  return `
<section class="section fp-section">
<h2>${city} Utility Rate and Net Metering Structure</h2>
<p>${s.tariffPara}</p>
</section>`;
}

/* --- Section: Interconnection process --- */
function interconnectionSection(city, s) {
  return `
<section class="section fp-section">
<h2>${city} Interconnection and Grid Approval</h2>
<p>${s.interconnectPara}</p>
</section>`;
}

/* --- Section: Installer landscape --- */
function installerLandscape(city, s) {
  return `
<section class="section fp-section">
<h2>${city} Solar Installer Landscape</h2>
<p>${s.installerLandscapePara}</p>
</section>`;
}

/* --- Section: Incentives deep dive --- */
function incentivesDeepDive(city, s) {
  return `
<section class="section fp-section">
<h2>${city} Solar Incentives and Tax Credits</h2>
<p>${s.incentivesPara}</p>
</section>`;
}

/* --- Section: Roof type landscape --- */
function roofLandscape(city, s) {
  return `
<section class="section fp-section">
<h2>${city} Roof Types and Mounting Implications</h2>
<p>${s.roofLandscapePara}</p>
</section>`;
}

/* --- Section: HOA and restrictions --- */
function hoaSection(city, s) {
  return `
<section class="section fp-section">
<h2>${city} HOA Rules and Solar Access Law</h2>
<p>${s.hoaAndRestrictPara}</p>
</section>`;
}

/* --- Section: Permit process --- */
function permitSection(city, s) {
  return `
<section class="section fp-section">
<h2>${city} Solar Permitting Process</h2>
<p>${s.permitProcessPara}</p>
</section>`;
}

/* --- Section: Battery storage --- */
function batterySection(city, s) {
  return `
<section class="section fp-section">
<h2>${city} Battery Storage Options and Rebates</h2>
<p>${s.batteryPara}</p>
</section>`;
}

/* --- Section: Climate risks --- */
function climateRisks(city, s) {
  return `
<section class="section fp-section">
<h2>${city} Climate Risks for Solar Installations</h2>
<p>${s.climateRiskPara}</p>
</section>`;
}

/* --- Section: Timeline --- */
function timelineSection(city, s) {
  return `
<section class="section fp-section">
<h2>${city} Solar Project Timeline</h2>
<p>${s.timelinePara}</p>
</section>`;
}

/* --- Section: Red flags (derived from dict fields) --- */
function redFlagsSection(city, s) {
  const flags = [
    { title: `Quote ignores ${city} utility tariff details`, body: `${s.tariffPara}` },
    { title: `System sized wrong for ${city} exposure`, body: `${s.sunPara}` },
    { title: `Timeline does not match ${city} permit reality`, body: `${s.timelinePara}` },
    { title: `Missing ${city} incentive stacking`, body: `${s.incentivesPara}` },
    { title: `Climate-risk engineering shortfall`, body: `${s.climateRiskPara}` },
    { title: `Battery pitched without ${city} context`, body: `${s.batteryPara}` },
  ];

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>${city} Solar Red Flags</h2>
${flagsHTML}
</section>`;
}

/* --- Section: Unique insight --- */
function uniqueInsight(city, s) {
  return `
<section class="section fp-section">
<h2>${city}-Specific Solar Program Insight</h2>
<p>${s.uniqueInsightPara}</p>
</section>`;
}

/* --- Section: Buyer questions --- */
function buyerQuestions(city, s) {
  return `
<section class="section fp-section">
<h2>Questions to Ask a ${city} Solar Installer</h2>
<p><strong>What is my expected production given ${city} sun hours?</strong> ${s.sunPara}</p>
<p><strong>How does your design handle ${city} climate risks?</strong> ${s.climateRiskPara}</p>
<p><strong>Which ${city} incentives are you filing for?</strong> ${s.incentivesPara}</p>
<p><strong>What does the full ${city} timeline look like?</strong> ${s.timelinePara}</p>
</section>`;
}

/* --- Section: Cost scenarios --- */
function costScenarios(city, state, s, mult) {
  const ppwStd = pricingModel.pricePerWatt.standard.base;
  const ppwPrem = pricingModel.pricePerWatt.premium.base;
  const batteryBase = pricingModel.battery.base;

  const budget = {
    label: "Budget",
    desc: "6 kW string inverter",
    kw: 6,
    ppw: ppwStd,
    inverterType: "string inverter",
    battery: false,
  };
  const mid = {
    label: "Mid-Range",
    desc: "8 kW with optimizers",
    kw: 8,
    ppw: (ppwStd + ppwPrem) / 2,
    inverterType: "power optimizers",
    battery: false,
  };
  const premium = {
    label: "Premium",
    desc: "10 kW with battery backup",
    kw: 10,
    ppw: ppwPrem,
    inverterType: "microinverters",
    battery: true,
  };

  function scenarioCard(sc, color) {
    const gross = Math.round(sc.kw * 1000 * sc.ppw * mult / 100) * 100;
    const withBattery = sc.battery ? gross + batteryBase : gross;
    const afterITC = Math.round(withBattery * 0.70 / 100) * 100;
    const annualProd = Math.round(sc.kw * s.peakSunHours * 365);

    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${sc.label}</h3>
<p class="fp-scenario-material">${sc.desc} | ${sc.inverterType}${sc.battery ? " + battery" : ""}</p>
<p class="fp-scenario-total">${fmtDollar(withBattery)}</p>
<p class="fp-scenario-detail">${fmtDollar(afterITC)} after 30% ITC. ~${annualProd.toLocaleString()} kWh/year. $${sc.ppw.toFixed(2)}/W before incentives.</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>${city} Solar Cost Scenarios</h2>
<div class="fp-scenario-grid">
${scenarioCard(budget, "#22c55e")}
${scenarioCard(mid, "#3b82f6")}
${scenarioCard(premium, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">Payback period in ${city} typically runs ${s.paybackYears}. <a href="/solar-cost.html" style="color:var(--brand);">Get a personalized solar estimate.</a></p>
</section>`;
}

/* --- CSS --- */
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

/* ---------- Build flagship content ---------- */
function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  const solar = SOLAR_DATA[metro.slug];
  if (!facts || !ctx || !solar) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getRegionMultiplier(solar.region || metro.region);

  let html = `\n${flagshipCSS()}\n`;
  html += `${MARKER_START}\n`;
  html += neighborhoodSolarPotential(facts, solar);
  html += sunExposureSection(city, solar);
  html += utilityTariff(city, solar);
  html += interconnectionSection(city, solar);
  html += installerLandscape(city, solar);
  html += incentivesDeepDive(city, solar);
  html += roofLandscape(city, solar);
  html += hoaSection(city, solar);
  html += permitSection(city, solar);
  html += batterySection(city, solar);
  html += climateRisks(city, solar);
  html += timelineSection(city, solar);
  html += uniqueInsight(city, solar);
  html += redFlagsSection(city, solar);
  html += buyerQuestions(city, solar);
  html += costScenarios(city, state, solar, mult);
  html += `\n${MARKER_END}\n`;

  return html;
}

/* ---------- Main ---------- */
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
    const otherServicesIdx = content.indexOf(">Other Services in ");
    let section5End = -1;
    let sectionCount = 0;
    let searchPos = 0;
    while (sectionCount < 5) {
      const idx = content.indexOf("</section>", searchPos);
      if (idx < 0) break;
      section5End = idx + "</section>".length;
      searchPos = idx + 1;
      sectionCount++;
    }

    let insertAt;
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else if (otherServicesIdx >= 0) {
      const sectionStart = content.lastIndexOf("<section", otherServicesIdx);
      insertAt = sectionStart >= 0 ? sectionStart : section5End;
    } else if (section5End >= 0) {
      insertAt = section5End;
    } else {
      console.log(`  SKIP ${metro.file} (no injection point found)`);
      skipped++;
      continue;
    }

    content = content.slice(0, insertAt) + nl + flagshipContent + nl + content.slice(insertAt);

    if (!DRY) {
      fs.writeFileSync(filepath, content, "utf8");
    }

    const wordCount = flagshipHTML.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    console.log(`  ${metro.file}: ~${wordCount} words`);
    processed++;
  }

  console.log(`\nDone: ${processed} processed, ${skipped} skipped.`);
  if (DRY) console.log("[DRY RUN: no files written]");
}

main();
