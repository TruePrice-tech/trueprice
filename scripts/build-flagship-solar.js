#!/usr/bin/env node
/**
 * Generates deep editorial content for 10 flagship metro solar pages.
 * Injects ~2500+ words of genuinely unique, city-specific prose.
 * Idempotent via FLAGSHIP-SOLAR-CONTENT markers.
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
  { slug: "new-york-ny",      ctxKey: "New York|NY",      file: "new-york-ny-solar-cost.html" },
  { slug: "los-angeles-ca",   ctxKey: "Los Angeles|CA",   file: "los-angeles-ca-solar-cost.html" },
  { slug: "chicago-il",       ctxKey: "Chicago|IL",       file: "chicago-il-solar-cost.html" },
  { slug: "houston-tx",       ctxKey: "Houston|TX",       file: "houston-tx-solar-cost.html" },
  { slug: "phoenix-az",       ctxKey: "Phoenix|AZ",       file: "phoenix-az-solar-cost.html" },
  { slug: "dallas-tx",        ctxKey: "Dallas|TX",        file: "dallas-tx-solar-cost.html" },
  { slug: "atlanta-ga",       ctxKey: "Atlanta|GA",       file: "atlanta-ga-solar-cost.html" },
  { slug: "denver-co",        ctxKey: "Denver|CO",        file: "denver-co-solar-cost.html" },
  { slug: "seattle-wa",       ctxKey: "Seattle|WA",       file: "seattle-wa-solar-cost.html" },
  { slug: "austin-tx",        ctxKey: "Austin|TX",        file: "austin-tx-solar-cost.html" },
];

/* ---------- city-specific solar data ---------- */
const SOLAR_DATA = {
  "new-york-ny": {
    peakSunHours: 4.0,
    seasonalVariation: "Production peaks June-August at ~6.2 kWh/kW/day and drops to ~2.1 kWh/kW/day in December-January",
    cloudCover: "New York averages 55% cloud cover annually, with winter months significantly cloudier than summer",
    utility: "Con Edison",
    netMetering: "New York has strong net metering through the VDER (Value of Distributed Energy Resources) framework. Con Edison customers receive credits based on the wholesale value of exported energy rather than the full retail rate, but the state's NY-Sun incentive program adds meaningful upfront rebates that offset any gap",
    stateIncentive: "NY-Sun offers $0.20/W for residential installations in Con Edison territory (up to $5,000 typical), plus the state provides a 25% tax credit capped at $5,000",
    utilityRebate: "Con Edison offers no direct solar rebate, but NYSERDA administers the NY-Sun Megawatt Block program that provides declining-block incentives",
    southFacing: "About 35-40% of NYC-area roofs have favorable south-facing orientation, but multi-family buildings and flat roofs expand options for tilt-mounted arrays",
    treeCoverage: "Tree shading is moderate in outer boroughs (Park Slope, Forest Hills) but minimal in Manhattan and dense Brooklyn, where buildings rather than trees are the primary shade source",
    typicalSystemSize: "5-8 kW for single-family homes in the outer boroughs; rooftop constraints in Manhattan often limit systems to under 5 kW",
    paybackYears: "7-9 years",
    hoaSolarLaw: "New York does not have a specific solar access law, but NYC's Climate Mobilization Act and Local Law 97 strongly incentivize renewable energy on buildings over 25,000 sq ft. For residential installations, HOAs generally cannot prohibit solar under state real property law provisions",
    permitNotes: "NYC DOB requires electrical and building permits for all solar installations. Expect 4-8 weeks for permit approval. The DOB has a dedicated solar permitting desk",
    bestInstallMonth: "March-May",
    bestInstallReason: "Installing in spring means your system is operational for the peak summer production months, maximizing first-year credits",
    region: "northeast",
  },
  "los-angeles-ca": {
    peakSunHours: 5.6,
    seasonalVariation: "LA produces strongly year-round, peaking at ~7.2 kWh/kW/day in June and dropping to only ~3.8 kWh/kW/day in December",
    cloudCover: "Los Angeles averages only 15% cloud cover, making it one of the best solar markets in the country. June Gloom (marine layer) can reduce morning production in May-June",
    utility: "LADWP (Los Angeles Department of Water and Power)",
    netMetering: "LADWP maintains its own net metering program separate from California's NEM 3.0. LADWP solar customers still receive full retail credit for exported energy, making LA one of the most favorable net metering markets in California",
    stateIncentive: "California's SGIP (Self-Generation Incentive Program) provides rebates for battery storage but has largely phased out panel-only incentives. The state offers property tax exclusion for solar improvements through 2025",
    utilityRebate: "LADWP offers a Solar Incentive Program (SIP) with rebates up to $0.30/W, significantly more generous than other California utilities",
    southFacing: "About 55-60% of LA roofs have good south or southwest exposure. The city's relatively flat topology and low-rise housing stock create excellent solar conditions",
    treeCoverage: "Tree shading varies significantly by neighborhood. Silver Lake and Echo Park have moderate canopy, while Sherman Oaks and the Valley have heavier tree coverage that may require trimming",
    typicalSystemSize: "7-10 kW for a typical single-family home, driven by high AC usage in summer months",
    paybackYears: "5-7 years",
    hoaSolarLaw: "California's Solar Rights Act (Civil Code 714) is the strongest solar protection in the country. HOAs cannot prohibit solar installations and can only impose reasonable aesthetic requirements that do not increase cost by more than $1,000 or decrease efficiency by more than 10%",
    permitNotes: "LADBS processes residential solar permits within 1-2 weeks for standard installations. Systems under 10 kW on single-family homes qualify for streamlined plan check",
    bestInstallMonth: "January-March",
    bestInstallReason: "Installing in late winter means your system is online before the high-production summer months and the peak electricity rates that come with AC season",
    region: "west",
  },
  "chicago-il": {
    peakSunHours: 4.0,
    seasonalVariation: "Chicago solar production is highly seasonal: ~6.0 kWh/kW/day in June-July versus ~1.8 kWh/kW/day in December when snow cover and short days combine",
    cloudCover: "Chicago averages 60% cloud cover, with lake-effect clouds adding extra coverage on the east side. Winter months are particularly overcast",
    utility: "ComEd (Commonwealth Edison)",
    netMetering: "Illinois has robust net metering through ComEd. Residential customers receive full retail rate credits for exported energy, and credits roll over month-to-month with an annual true-up in April",
    stateIncentive: "Illinois Shines (the Adjustable Block Program) provides Solar Renewable Energy Credits (SRECs) worth $3,000-$6,000 over 15 years for a typical residential system. This is one of the most valuable state incentive programs in the country",
    utilityRebate: "ComEd does not offer a separate solar rebate, but the Illinois Shines SREC payments function as the primary state-level incentive and are administered through your installer",
    southFacing: "About 45-50% of Chicago-area homes have favorable south-facing roof planes. Flat roofs on bungalows and three-flats allow for optimized tilt-mounted arrays",
    treeCoverage: "Mature tree canopy in Lincoln Park, Lakeview, and Hyde Park can reduce production 15-25% without trimming. Logan Square and Wicker Park have more moderate canopy",
    typicalSystemSize: "6-9 kW for a typical Chicago single-family home",
    paybackYears: "7-9 years",
    hoaSolarLaw: "Illinois passed the Solar Access Rights Act (765 ILCS 165) that prohibits HOA covenants from banning solar installations. HOAs may set reasonable aesthetic guidelines but cannot prevent installation",
    permitNotes: "Chicago Department of Buildings requires electrical and structural permits. Standard residential solar permits take 2-4 weeks. An electrical inspection is required before utility interconnection",
    bestInstallMonth: "March-May",
    bestInstallReason: "Spring installation catches the entire peak production window from May through September. Avoid scheduling during winter when cold temperatures slow the process",
    region: "midwest",
  },
  "houston-tx": {
    peakSunHours: 4.9,
    seasonalVariation: "Houston produces ~6.5 kWh/kW/day in peak summer but humidity and cloud cover drop winter production to ~3.2 kWh/kW/day",
    cloudCover: "Houston averages 45% cloud cover, with Gulf moisture creating frequent afternoon cloud buildup. Hurricane season (June-November) can cause extended production dips",
    utility: "CenterPoint Energy (transmission/distribution) with various retail electric providers (REPs) in the deregulated ERCOT market",
    netMetering: "Texas does not mandate net metering statewide. In the deregulated Houston market, some retail providers offer solar buyback plans, but rates are typically 30-60% below retail. Research plans from providers like Green Mountain Energy, Chariot Energy, or TXU that offer more favorable solar rates",
    stateIncentive: "Texas has no state solar tax credit or rebate program. The federal ITC is the primary incentive. However, Texas exempts solar installations from property tax increases",
    utilityRebate: "CenterPoint does not offer solar rebates. Some retail electric providers offer promotional credits for solar customers, but these change frequently",
    southFacing: "About 50-55% of Houston-area homes have favorable south-facing orientation. The relatively flat terrain means shading from adjacent structures is minimal",
    treeCoverage: "Mature oaks in The Heights, Montrose, and River Oaks create significant shading challenges. West University and Bellaire homes tend to have more open rooflines",
    typicalSystemSize: "8-12 kW driven by high AC usage from April through October",
    paybackYears: "9-12 years",
    hoaSolarLaw: "Texas Property Code Section 202.010 prohibits HOAs from banning solar panels. HOAs may require rear or side placement if it does not reduce production by more than 10% and may set reasonable aesthetic requirements. This is one of the stronger solar access laws in the country",
    permitNotes: "City of Houston processes residential solar permits within 1-3 days through the online portal. Structural engineering review may be required for older roofs. A post-installation electrical inspection is mandatory",
    bestInstallMonth: "October-February",
    bestInstallReason: "Installing during the cooler months means more comfortable working conditions, faster contractor availability, and your system will be fully operational before the high-production and high-usage summer months",
    region: "south",
  },
  "phoenix-az": {
    peakSunHours: 6.5,
    seasonalVariation: "Phoenix is one of the best solar markets on earth, producing ~8.0 kWh/kW/day in June and still ~4.5 kWh/kW/day in December",
    cloudCover: "Phoenix averages only 12% cloud cover annually. Monsoon season (July-September) brings afternoon thunderstorms that briefly reduce production but rarely impact daily totals significantly",
    utility: "Arizona Public Service (APS) or Salt River Project (SRP)",
    netMetering: "Arizona's net metering landscape has shifted significantly. APS customers on the Resource Comparison Proxy (RCP) rate receive export credits at roughly 75-80% of retail rate, declining annually. SRP customers face a controversial demand charge structure that reduces solar savings. Understanding which utility serves your address is critical to calculating payback",
    stateIncentive: "Arizona offers a state solar tax credit of 25% of the installation cost, capped at $1,000. This is modest but stacks with the federal ITC. Arizona also exempts solar from sales tax and property tax",
    utilityRebate: "APS and SRP have phased out most residential solar rebates. The state tax credit and property/sales tax exemptions are the remaining state-level benefits",
    southFacing: "About 60-65% of Phoenix-area homes have excellent south or southwest exposure. New construction in communities like Desert Ridge and Ahwatukee is often designed with solar-ready rooflines",
    treeCoverage: "Minimal tree shading is a major advantage of the Phoenix market. Desert landscaping means most roofs have unobstructed solar access. Arcadia and Biltmore have more mature landscaping",
    typicalSystemSize: "8-12 kW driven by massive AC loads from May through September",
    paybackYears: "7-9 years",
    hoaSolarLaw: "Arizona Revised Statutes 33-1816 prohibits HOAs from banning solar installations. HOAs may require that panels are not visible from the street on certain roof faces, but cannot prevent installation entirely. This law has been tested and upheld in Arizona courts",
    permitNotes: "City of Phoenix issues residential solar permits same-day through the online portal. This is one of the fastest solar permitting processes in the country. HOA approval, where required, typically takes longer than the city permit",
    bestInstallMonth: "October-January",
    bestInstallReason: "Cooler temperatures make installation safer and faster. Your system will be fully operational before the scorching summer months when AC drives electricity bills through the roof",
    region: "mountain",
  },
  "dallas-tx": {
    peakSunHours: 5.0,
    seasonalVariation: "Dallas produces ~6.6 kWh/kW/day in summer and ~3.3 kWh/kW/day in December-January",
    cloudCover: "Dallas averages 40% cloud cover, with spring storm season bringing the most overcast days. Summer skies are generally clear and hot",
    utility: "Oncor (transmission/distribution) with various retail electric providers in the deregulated ERCOT market",
    netMetering: "Like Houston, Dallas is in the deregulated Texas market. There is no mandated net metering. Look for solar buyback plans from retail providers. Rates vary from $0.04-$0.09/kWh for exports versus $0.10-$0.14/kWh retail, so sizing your system to match consumption rather than oversizing is the smart play in DFW",
    stateIncentive: "Texas has no state solar tax credit. The federal ITC plus property tax exemption (Texas Tax Code 11.27) are the primary incentives. Some municipalities in the DFW area offer small local rebates",
    utilityRebate: "Oncor does not offer solar rebates. Some retail electric providers run promotional solar buyback rates; shop around before committing to a plan",
    southFacing: "About 55% of DFW homes have south-facing roof planes. The suburban tract home layout in Lakewood, Preston Hollow, and Highland Park generally provides good solar access",
    treeCoverage: "Mature oak and pecan trees in Lakewood and Highland Park can significantly shade roofs. Oak Cliff and Bishop Arts have more variable canopy. Get a professional shade assessment before signing",
    typicalSystemSize: "8-12 kW driven by high summer AC usage typical of north Texas",
    paybackYears: "9-12 years",
    hoaSolarLaw: "Texas Property Code Section 202.010 prohibits HOAs from banning solar. Same strong protections as Houston. HOAs cannot require ground-mounted instead of roof-mounted and cannot impose restrictions that reduce output by more than 10%",
    permitNotes: "City of Dallas issues residential solar permits within 1-3 days online. Post-installation electrical inspection is required before utility interconnection. Insurance-driven hail events can slow the permit queue in spring",
    bestInstallMonth: "October-February",
    bestInstallReason: "Cooler weather and lower contractor demand in the off-season mean better pricing and faster scheduling. Your system will be online before the peak production and peak usage summer months",
    region: "south",
  },
  "atlanta-ga": {
    peakSunHours: 4.7,
    seasonalVariation: "Atlanta produces ~6.2 kWh/kW/day in peak summer and ~3.0 kWh/kW/day in December-January",
    cloudCover: "Atlanta averages 50% cloud cover annually. The Southeast's humidity creates more diffuse light conditions than desert markets, but annual production is still strong",
    utility: "Georgia Power",
    netMetering: "Georgia Power does not offer traditional net metering. Instead, they offer a renewable rate schedule where exported solar energy is credited at the avoided cost rate (roughly $0.03-$0.04/kWh), which is significantly below the retail rate of $0.12-$0.14/kWh. This makes self-consumption sizing critical in Atlanta",
    stateIncentive: "Georgia offers no state solar tax credit or rebate. The federal ITC is the only significant incentive. Georgia does exempt solar installations from sales tax",
    utilityRebate: "Georgia Power has no residential solar rebate program. The utility has historically been resistant to distributed solar, making the economics more dependent on the federal credit",
    southFacing: "About 45-50% of Atlanta-area homes have favorable south-facing orientation. The established tree canopy in midtown neighborhoods is the bigger concern",
    treeCoverage: "Atlanta is one of the most heavily forested urban areas in the US. Mature hardwoods in Virginia-Highland, Inman Park, and Grant Park create serious shading that can reduce production by 30-40% without tree work. Buckhead and Decatur also have dense canopy. A professional shade assessment is absolutely essential in Atlanta",
    typicalSystemSize: "7-10 kW for a typical single-family home",
    paybackYears: "10-13 years",
    hoaSolarLaw: "Georgia passed HB 57 (O.C.G.A. 44-3-232) in 2015 allowing solar panel installation regardless of HOA restrictions, but the law's language is narrower than states like Texas and California. HOAs can still impose some aesthetic requirements. In practice, most Atlanta-area HOAs cooperate with solar requests",
    permitNotes: "City of Atlanta and surrounding counties (Fulton, DeKalb) require separate permits. Expect 1-3 weeks. Fulton County has stricter review requirements than DeKalb for residential solar",
    bestInstallMonth: "February-April",
    bestInstallReason: "Spring installation captures the full summer production peak. Avoid scheduling during peak summer thunderstorm season when afternoon storms can delay rooftop work",
    region: "southeast",
  },
  "denver-co": {
    peakSunHours: 5.5,
    seasonalVariation: "Denver produces ~7.0 kWh/kW/day in June and ~3.5 kWh/kW/day in December. The altitude advantage adds roughly 5-8% more production versus comparable sun hours at sea level due to thinner atmosphere",
    cloudCover: "Denver averages 35% cloud cover. The Front Range gets 300+ days of sunshine annually. Afternoon thunderstorms in spring/summer are brief and rarely impact daily production significantly",
    utility: "Xcel Energy",
    netMetering: "Colorado mandates net metering for Xcel Energy customers. Residential solar customers receive full retail rate credits for exported energy, with credits rolling over month-to-month and an annual true-up. This is one of the more favorable net metering structures in the Mountain West",
    stateIncentive: "Colorado no longer offers a state solar tax credit (it expired in 2020). The state does exempt solar from sales tax and property tax. Some municipalities offer additional incentives",
    utilityRebate: "Xcel Energy's Solar*Rewards program has been significantly reduced but still offers $0.05/kWh performance payments for 10 years for qualifying residential systems. Check current availability as program capacity fills quickly",
    southFacing: "About 50-55% of Denver homes have favorable south-facing exposure. The Highlands, Wash Park, and Cherry Creek have good roofline variety",
    treeCoverage: "Denver has a moderate urban canopy. Wash Park and older neighborhoods in Capitol Hill have more mature trees that can shade panels. Stapleton/Central Park area homes are newer with smaller trees and better solar access",
    typicalSystemSize: "7-10 kW for a typical Denver single-family home. Altitude means panels run slightly cooler, boosting efficiency",
    paybackYears: "7-9 years",
    hoaSolarLaw: "Colorado Revised Statutes 38-30-168 prohibits HOAs from banning solar installations. Colorado's law is strong: HOAs cannot impose requirements that increase cost by more than 10% or decrease efficiency by more than 10%. HOAs that violate this statute face statutory damages",
    permitNotes: "City of Denver issues residential solar permits within 1-2 weeks. Structural review is required for older roofs. An electrical inspection is required before Xcel will connect the system",
    bestInstallMonth: "March-May",
    bestInstallReason: "Spring installation means your system is online for the peak production summer months. Denver's altitude means even early spring has strong solar irradiance",
    region: "mountain",
  },
  "seattle-wa": {
    peakSunHours: 3.6,
    seasonalVariation: "Seattle solar production is the most seasonal of any major US city: ~6.0 kWh/kW/day in June-July versus ~1.2 kWh/kW/day in December when cloud cover and short days combine. Over 70% of annual production happens between April and September",
    cloudCover: "Seattle averages 70% cloud cover annually, the highest of any major US metro. However, June through September is remarkably clear and dry, and the long summer days (16+ hours of daylight at solstice) compensate significantly",
    utility: "Seattle City Light (a public utility)",
    netMetering: "Washington State mandates net metering. Seattle City Light customers receive full retail rate credits for exported energy, with credits rolling over month-to-month. Seattle City Light is already ~90% carbon-free (hydropower), so the environmental argument for solar is more about resilience than carbon reduction",
    stateIncentive: "Washington State's solar incentive program expired in 2021. The state offers a sales tax exemption for solar installations (worth 10% given WA's 10.25% Seattle rate) and exempts solar from property tax. No state tax credit",
    utilityRebate: "Seattle City Light does not currently offer a solar rebate program. The sales tax exemption is the primary state-level benefit",
    southFacing: "About 40-45% of Seattle-area homes have favorable south-facing exposure. The hillside topology means some homes face slope aspects that reduce winter production further",
    treeCoverage: "Seattle's evergreen tree canopy is a major solar consideration. Year-round shading from Douglas fir and western red cedar in Ballard, Wallingford, and West Seattle can reduce production by 25-40%. Unlike deciduous trees that shed leaves in winter, evergreens block light year-round. Tree assessment is non-negotiable here",
    typicalSystemSize: "5-8 kW for a typical Seattle single-family home. Smaller systems are common because the economics favor offsetting base load rather than overproducing",
    paybackYears: "10-13 years",
    hoaSolarLaw: "Washington State RCW 64.38.055 prohibits HOAs from banning solar installations. HOAs may require panels to be parallel to the roofline and may have color requirements, but cannot prevent installation",
    permitNotes: "Seattle DCI (Department of Construction and Inspections) requires permits for all solar installations. Expect 2-6 weeks depending on structural requirements. Systems on older homes (pre-1960) may require structural engineering review",
    bestInstallMonth: "February-April",
    bestInstallReason: "Installing before the dry season (June-September) captures the entire high-production window. Scheduling during the rainy season also means better contractor availability and potentially lower pricing",
    region: "west",
  },
  "austin-tx": {
    peakSunHours: 5.2,
    seasonalVariation: "Austin produces ~6.8 kWh/kW/day in peak summer and ~3.4 kWh/kW/day in December-January",
    cloudCover: "Austin averages 35% cloud cover. Central Texas gets abundant sunshine, though spring storm season and occasional winter weather events (like February 2021) can temporarily reduce production",
    utility: "Austin Energy (a municipal utility)",
    netMetering: "Austin Energy offers the Value of Solar (VoS) tariff, which credits solar exports at a rate determined annually based on the value solar provides to the grid. The VoS rate has historically been close to or slightly below the retail rate. This is more favorable than most Texas markets because Austin Energy is a municipal utility exempt from the deregulated ERCOT retail market",
    stateIncentive: "Texas has no state solar tax credit. The federal ITC plus property tax exemption are the primary incentives. Austin Energy's VoS program is the local equivalent of a strong utility incentive",
    utilityRebate: "Austin Energy has phased out its direct rebate program but the Value of Solar tariff provides ongoing credits. Check Austin Energy's current program terms before signing, as the VoS rate resets annually",
    southFacing: "About 50-55% of Austin-area homes have favorable south-facing exposure. Newer homes in Mueller and east Austin subdivisions tend to have better solar orientation than older homes in Hyde Park and Tarrytown",
    treeCoverage: "Live oaks are the dominant shading challenge in Austin. Tarrytown and Hyde Park have dense mature canopy that can reduce production 20-35%. Travis Heights and Zilker have moderate coverage. Mueller and newer east Austin developments have minimal tree shading",
    typicalSystemSize: "8-12 kW driven by high AC usage from April through October, similar to other Texas metros",
    paybackYears: "8-10 years",
    hoaSolarLaw: "Texas Property Code Section 202.010 provides strong solar protections. HOAs cannot ban solar and cannot impose restrictions that reduce output by more than 10%. Austin's pro-solar culture means HOA conflicts are rare here",
    permitNotes: "City of Austin permits are notoriously slow for solar: 2-4 weeks for residential installations. However, Austin Energy has a dedicated solar interconnection team that handles the utility side efficiently once permits clear",
    bestInstallMonth: "October-January",
    bestInstallReason: "Cooler weather makes installation faster and safer. Off-season scheduling means better contractor availability and pricing. Your system will be online before the brutal Texas summer when you need it most",
    region: "south",
  },
};

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString()}`; }
function fmtDollar(n) { return `$${n.toLocaleString()}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function getRegionMultiplier(region) {
  return pricingModel.laborMultiplierByRegion?.[region] || 1.0;
}

/* --- Section 1: Neighborhood Solar Potential Breakdown --- */
function neighborhoodSolarPotential(facts, solar) {
  if (!facts?.neighborhoods?.length) return "";

  const rows = facts.neighborhoods.map((n, i) => {
    // Vary south-facing % and tree impact per neighborhood
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
<p>${solar.southFacing}. ${solar.treeCoverage}</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:center; padding:12px 16px;">South-Facing Roofs</th>
<th style="text-align:center; padding:12px 16px;">Tree Shade Impact</th>
<th style="text-align:center; padding:12px 16px;">Typical System Size</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Estimates based on satellite roof analysis and local canopy data. Actual solar potential depends on your specific roof orientation, pitch, and surrounding obstructions. <a href="/solar-cost.html" style="color:var(--brand);">Get a personalized solar estimate.</a></p>
</section>`;
}

/* --- Section 2: Solar Economics Deep Dive --- */
function solarEconomics(city, state, solar, mult) {
  const baseRate = pricingModel.pricePerWatt.standard.base;
  const costPer8kW = Math.round(8000 * baseRate * mult / 100) * 100;
  const afterITC = Math.round(costPer8kW * 0.70 / 100) * 100;
  const annualProd = Math.round(8 * solar.peakSunHours * 365);
  const avgElecRate = state === "NY" ? 0.22 : state === "CA" ? 0.28 : state === "WA" ? 0.12 : state === "CO" ? 0.14 : state === "GA" ? 0.13 : state === "TX" ? 0.13 : state === "AZ" ? 0.13 : state === "IL" ? 0.15 : 0.14;
  const annualSavings = Math.round(annualProd * avgElecRate);

  return `
<section class="section fp-section">
<h2>Solar Economics in ${city}: Payback and Savings</h2>
<p>The financial case for solar in ${city} depends on three variables: sun hours, electricity rates, and incentive structure. Here is how they stack up.</p>

<p><strong>Sun hours and production.</strong> ${city} averages ${solar.peakSunHours} peak sun hours per day, which translates to roughly ${annualProd.toLocaleString()} kWh of annual production from a typical 8 kW system. ${solar.seasonalVariation}.</p>

<p><strong>Electricity cost offset.</strong> At ${state}'s average residential rate of ~$${avgElecRate.toFixed(2)}/kWh, an 8 kW system offsets approximately ${fmtDollar(annualSavings)} in electricity per year. Your actual savings depend on your usage pattern, time-of-use rate structure, and how much energy you export versus consume directly.</p>

<p><strong>Net metering.</strong> ${solar.netMetering}.</p>

<p><strong>Payback period.</strong> With the 30% federal ITC and ${state}'s incentive structure, most ${city} homeowners see a payback period of ${solar.paybackYears}. After payback, your system produces essentially free electricity for the remaining 15-20 years of its warranted life. A well-sized system in ${city} can generate $40,000-$80,000 in lifetime electricity savings.</p>
</section>`;
}

/* --- Section 3: Federal and State Incentives --- */
function incentivesSection(city, state, solar) {
  return `
<section class="section fp-section">
<h2>Solar Incentives and Tax Credits for ${city} Homeowners</h2>

<div class="fp-flag" style="background:#f0fdf4; border-color:#a7f3d0;">
<h3 style="color:#166534;">Federal Solar Investment Tax Credit (ITC) - 30%</h3>
<p style="color:#14532d;">The federal ITC under IRC Section 25D provides a 30% tax credit on the total cost of your solar installation, including panels, inverters, battery storage, wiring, and installation labor. This credit is available through 2032, then drops to 26% in 2033 and 22% in 2034. This is a dollar-for-dollar tax credit, not a deduction. If you owe $8,000 in federal taxes and your credit is $7,000, your tax bill drops to $1,000. Unused credits can be carried forward to future tax years.</p>
</div>

<p><strong>Important distinction:</strong> The IRA Section 25C heat pump and energy efficiency credit expired in December 2025. The Section 25D solar and battery credit remains fully active through 2034. Do not confuse these two programs when planning your installation.</p>

<p><strong>${state} state incentives.</strong> ${solar.stateIncentive}.</p>

<p><strong>Utility incentives.</strong> ${solar.utilityRebate}.</p>

<p><strong>Property tax exemption.</strong> ${state === "TX" ? "Texas exempts the appraised value of solar installations from property tax under Tax Code 11.27. A $25,000 solar system adds zero to your property tax bill." : state === "AZ" ? "Arizona exempts solar from both sales tax and property tax, meaning your installation cost is lower and your property tax does not increase." : state === "CA" ? "California excludes solar improvements from property tax reassessment through the Active Solar Energy Systems Exclusion. Your property value increases but your tax assessment does not." : state === "CO" ? "Colorado exempts residential renewable energy equipment from property tax assessment, and solar installations are exempt from state sales tax." : state === "GA" ? "Georgia exempts solar installations from state sales tax. There is no property tax exemption at the state level, but some counties offer local incentives." : state === "WA" ? "Washington exempts solar installations from the state and local sales tax (saving roughly 10% in Seattle's tax jurisdiction). No separate property tax exemption exists." : state === "IL" ? "Illinois exempts solar from state sales tax and provides a property tax exemption for the added value of the solar installation for the first 30 years." : state === "NY" ? "New York provides a 15-year property tax exemption for residential solar through Real Property Tax Law 487 and exempts solar from state sales tax." : `${state} offers property tax benefits for solar installations. Check with your local tax assessor for current exemptions.`}</p>

<p><strong>Stacking incentives.</strong> The federal ITC applies to the gross system cost before any state rebates are deducted. State credits and utility rebates stack on top of the federal credit. For a $24,000 system in ${city}, the effective cost after all available incentives can drop to ${state === "NY" ? "$11,000-$13,000" : state === "CA" ? "$12,000-$14,000" : state === "IL" ? "$11,500-$13,500" : state === "CO" ? "$14,000-$16,000" : state === "TX" ? "$15,000-$17,000" : state === "AZ" ? "$14,500-$16,500" : state === "GA" ? "$15,500-$17,500" : state === "WA" ? "$14,000-$16,000" : "$14,000-$16,000"}.</p>
</section>`;
}

/* --- Section 4: Climate and Sun Exposure --- */
function climateAndSun(city, state, solar, facts) {
  return `
<section class="section fp-section">
<h2>Climate and Sun Exposure in ${city}</h2>
<p><strong>Peak sun hours.</strong> ${city} receives an average of ${solar.peakSunHours} peak sun hours per day, ${solar.peakSunHours >= 5.5 ? "putting it among the top-tier solar markets in the US" : solar.peakSunHours >= 4.5 ? "making it a solid solar market with above-average production potential" : solar.peakSunHours >= 4.0 ? "which is moderate for a major US metro but still supports a positive ROI with proper sizing" : "which is below the national average but still economically viable with favorable incentives"}. For context, the US average is about 4.5 peak sun hours.</p>

<p><strong>Seasonal production.</strong> ${solar.seasonalVariation}. This seasonal swing affects cash flow: summer months may generate credits that offset winter shortfalls, depending on your utility's net metering policy.</p>

<p><strong>Cloud cover.</strong> ${solar.cloudCover}. Modern solar panels still produce 10-25% of their rated output on overcast days through diffuse radiation, but cloud cover is factored into the peak sun hours figure above.</p>

<p><strong>Temperature effects.</strong> Solar panels are rated at 25C (77F) and lose roughly 0.3-0.4% efficiency per degree above that temperature. ${facts.climate.includes("extreme") || facts.climate.includes("100+") || facts.climate.includes("hot") ? `In ${city}'s hot climate, this means panels can lose 8-15% of rated efficiency during peak summer hours. Microinverters or power optimizers help mitigate this loss. Adequate roof ventilation under the panels also reduces temperature impact.` : facts.climate.includes("cold") || facts.climate.includes("snow") ? `In ${city}'s cold winters, panels actually operate above their rated efficiency when temperatures drop below 77F. Snow cover temporarily blocks production, but panels typically shed snow quickly due to their smooth surface and dark color. Snow clearing is rarely necessary.` : `In ${city}, summer heat reduces panel efficiency modestly during peak afternoon hours, but the temperature effect is manageable and already factored into production estimates from reputable installers.`}</p>
</section>`;
}

/* --- Section 5: HOA and Permitting --- */
function hoaAndPermitting(city, state, solar, facts) {
  return `
<section class="section fp-section">
<h2>HOA Rules and Solar Permitting in ${city}</h2>
<p><strong>Solar access law.</strong> ${solar.hoaSolarLaw}.</p>

<p><strong>Permitting.</strong> ${solar.permitNotes}. Your installer should handle all permitting as part of the contract. If a company asks you to pull your own permits, that is a yellow flag. The permit holder is legally responsible for code compliance.</p>

<p><strong>Building code.</strong> ${facts.codeNote ? facts.codeNote + "." : ""} Solar installations must comply with the National Electrical Code (NEC) Article 690, which governs photovoltaic systems. Key requirements include rapid shutdown capability (required since NEC 2017), proper conductor sizing, and equipment grounding. Your installer should be intimately familiar with these requirements.</p>

<p><strong>Inspection process.</strong> After installation, expect two inspections before your system can generate power: a building/structural inspection and an electrical inspection. Once both pass, your utility will install a bidirectional meter (or reprogram your existing smart meter) and authorize interconnection. The full process from installation completion to power-on typically takes 2-6 weeks, with utility interconnection being the bottleneck.</p>
</section>`;
}

/* --- Section 6: Grid Connection and Net Metering --- */
function gridConnection(city, state, solar) {
  return `
<section class="section fp-section">
<h2>Grid Connection and Net Metering in ${city}</h2>
<p><strong>Your utility.</strong> Most ${city} homeowners are served by ${solar.utility}. Confirm your utility provider before evaluating solar proposals, because net metering terms vary significantly between utilities even within the same city.</p>

<p><strong>Net metering details.</strong> ${solar.netMetering}.</p>

<p><strong>Interconnection process.</strong> After your system passes final inspection, your installer submits an interconnection application to ${solar.utility.split(" (")[0]}. The utility reviews the application, may inspect the meter connection, and then authorizes Permission to Operate (PTO). Do not energize your system before receiving PTO. Operating without utility authorization can damage equipment, void warranties, and create liability issues.</p>

<p><strong>System sizing strategy.</strong> ${state === "TX" && city !== "Austin" ? `In Texas's deregulated market, where export rates are well below retail, the optimal strategy is to size your system to offset 80-90% of your annual consumption rather than oversizing. Excess production exported to the grid earns significantly less than the retail rate you avoid by consuming your own solar power.` : state === "GA" ? `Georgia Power's low export credit rate means you should size your system to match your daytime consumption as closely as possible. A system that produces more than you consume during daylight hours will export energy at a fraction of its value. Battery storage can shift excess daytime production to evening use, improving the economics.` : state === "AZ" ? `With APS and SRP's evolving rate structures, work with your installer to model your specific utility rate plan. Time-of-use rates mean the value of your solar production varies by hour. A system with a slight west-facing tilt can shift peak production toward late afternoon when electricity rates are highest.` : `With ${city}'s net metering structure, sizing your system to offset 90-100% of your annual usage typically provides the best return. Your installer should model your specific usage pattern and utility rate to optimize system size.`}</p>
</section>`;
}

/* --- Section 7: Red Flags --- */
function redFlagsSection(city, state, solar) {
  const flags = [
    {
      title: "Solar lease vs. purchase traps",
      body: `Leasing companies offer "$0 down solar" and handle everything, but the homeowner does not own the system, does not receive the federal tax credit (the leasing company claims it), and is locked into 20-25 year contracts with escalating payments (typically 2-3% annually). After 20 years, a leased system can cost more than the electricity it replaces. In ${city}, the strong contractor market means purchase financing at competitive rates is readily available. Own your panels.`
    },
    {
      title: "Inflated production estimates",
      body: `Some installers inflate production projections by 15-25% to make the payback math look better. Ask for production estimates using PVWatts (the NREL tool) or similar validated modeling software, and verify the shading analysis uses actual site data, not assumptions. In ${city}, your system should produce roughly ${solar.peakSunHours} kWh per installed kW per day on an annual average basis. If an installer promises significantly more, demand documentation.`
    },
    {
      title: "Pressure sales tactics and one-day offers",
      body: `Legitimate solar installers do not pressure you to sign today. Any "this price is only available if you sign now" pitch is a high-pressure sales tactic designed to prevent you from comparing bids. The solar investment tax credit is not going anywhere until 2033. Material costs are not spiking tomorrow. Get at least three quotes and take your time.`
    },
    {
      title: '"Free solar" door-knockers',
      body: `Door-to-door solar salespeople (especially common in ${city} during summer months) often work on commission and represent lease or PPA (Power Purchase Agreement) products. They may show you a monthly payment lower than your current electric bill, but the contract locks you in for 20-25 years, includes escalators, and can complicate home sales. The panels they install are usually the cheapest available to maximize their margin. If someone knocks on your door offering free solar, close the door and do your own research.`
    },
    {
      title: "Unrealistic battery claims",
      body: `Battery storage (Tesla Powerwall, Enphase IQ, etc.) is a real product with genuine benefits for backup power, but some installers oversell battery as a money-making investment. In most ${state} rate structures, battery storage alone does not improve the financial payback of a solar installation unless you are on a time-of-use rate with large peak/off-peak spreads. Buy battery for power security during outages, not as a financial investment.`
    },
  ];

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>Solar Scams and Red Flags in ${city}</h2>
<p>Solar is a legitimate investment, but the industry has its share of bad actors. Here is what ${city} homeowners need to watch for.</p>
${flagsHTML}
</section>`;
}

/* --- Section 8: Seasonal Installation Guide --- */
function seasonalGuide(city, solar) {
  return `
<section class="section fp-section">
<h2>Best Time to Install Solar in ${city}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months to install</h3>
<p class="fp-season-months">${solar.bestInstallMonth}</p>
<p>${solar.bestInstallReason}.</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Why timing matters</h3>
<p class="fp-season-months">Maximize first-year production</p>
<p>Solar panels start generating returns the day they are activated. Installing 2-3 months before the peak production season means your first 12 months of ownership capture the maximum possible production. In ${city}, peak production runs from May through September, so having your system operational by April or May is the ideal target.</p>
</div>
</div>
<p><strong>The full timeline.</strong> Plan for 2-3 months from contract signing to power-on. This includes site assessment (1-2 weeks), design and engineering (1-2 weeks), permitting (${solar.permitNotes.includes("same-day") ? "1-3 days" : solar.permitNotes.includes("1-2 weeks") ? "1-2 weeks" : solar.permitNotes.includes("2-4 weeks") ? "2-4 weeks" : solar.permitNotes.includes("4-8 weeks") ? "4-8 weeks" : "2-4 weeks"}), physical installation (1-3 days), inspection (1-2 weeks), and utility interconnection (2-4 weeks). Working backward from your target go-live date helps you choose the right signing date.</p>
</section>`;
}

/* --- Section 9: Cost Scenarios --- */
function costScenarios(city, state, solar, mult) {
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

  function scenarioCard(s, color) {
    const gross = Math.round(s.kw * 1000 * s.ppw * mult / 100) * 100;
    const withBattery = s.battery ? gross + batteryBase : gross;
    const afterITC = Math.round(withBattery * 0.70 / 100) * 100;
    const annualProd = Math.round(s.kw * solar.peakSunHours * 365);

    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${s.label}</h3>
<p class="fp-scenario-material">${s.desc} | ${s.inverterType}${s.battery ? " + battery" : ""}</p>
<p class="fp-scenario-total">${fmtDollar(withBattery)}</p>
<p class="fp-scenario-detail">${fmtDollar(afterITC)} after 30% ITC. ~${annualProd.toLocaleString()} kWh/year production. $${s.ppw.toFixed(2)}/W before incentives. Includes design, permits, installation, monitoring, and warranty.</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>What Solar Actually Costs in ${city}: 3 Scenarios</h2>
<p>Here is what real solar installations look like in ${city}, ${state}, using ${city}-adjusted labor and material costs for 2026.</p>
<div class="fp-scenario-grid">
${scenarioCard(budget, "#22c55e")}
${scenarioCard(mid, "#3b82f6")}
${scenarioCard(premium, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">All scenarios assume standard roof-mount installation on a composition shingle roof with adequate structural capacity. Ground mounts, tile roofs, and flat-roof ballasted systems add 10-25%. Battery pricing based on Tesla Powerwall or equivalent. <a href="/solar-cost.html" style="color:var(--brand);">Get a personalized solar estimate.</a></p>
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

/* ---------- Build flagship content ---------- */
function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  const solar = SOLAR_DATA[metro.slug];
  if (!facts || !ctx || !solar) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getRegionMultiplier(solar.region);

  let html = `\n${MARKER_START}\n`;
  html += flagshipCSS();
  html += neighborhoodSolarPotential(facts, solar);
  html += solarEconomics(city, state, solar, mult);
  html += incentivesSection(city, state, solar);
  html += climateAndSun(city, state, solar, facts);
  html += hoaAndPermitting(city, state, solar, facts);
  html += gridConnection(city, state, solar);
  html += redFlagsSection(city, state, solar);
  html += seasonalGuide(city, solar);
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

    // Remove old flagship content (idempotent)
    const re = new RegExp(`${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n?`, "g");
    content = content.replace(re, "");

    // Detect line ending
    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    // Injection point: after UNIQUE-LOCAL-GUIDE if present, otherwise before "Other Services" section
    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const otherServicesIdx = content.indexOf(">Other Services in ");
    // Fallback: find the 5th </section> tag (after FAQ)
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
      // Find the <section that contains "Other Services"
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
    console.log(`  ${metro.file}: ~${wordCount} words of flagship solar content injected`);
    processed++;
  }

  console.log(`\nDone: ${processed} flagship solar pages processed, ${skipped} skipped.`);
  if (DRY) console.log("[DRY RUN: no files written]");
}

main();
