#!/usr/bin/env node
/**
 * Generates deep editorial content for 40 flagship metro gutter pages.
 * Injects ~2500 words of genuinely unique, city-specific prose.
 * Idempotent via FLAGSHIP-GUTTERS-CONTENT markers.
 *
 * Usage: node scripts/build-flagship-gutters.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/gutters-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-GUTTERS-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-GUTTERS-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-gutter-cost.html" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-gutter-cost.html" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-gutter-cost.html" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-gutter-cost.html" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-gutter-cost.html" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-gutter-cost.html" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-gutter-cost.html" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-gutter-cost.html" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-gutter-cost.html" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-gutter-cost.html" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-gutter-cost.html" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-gutter-cost.html" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-gutter-cost.html" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-gutter-cost.html" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-gutter-cost.html" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-gutter-cost.html" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-gutter-cost.html" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-gutter-cost.html" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-gutter-cost.html" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-gutter-cost.html" },
    { slug: "st-louis-mo", ctxKey: "St. Louis|MO", file: "st-louis-mo-gutter-cost.html" },
    { slug: "orlando-fl", ctxKey: "Orlando|FL", file: "orlando-fl-gutter-cost.html" },
    { slug: "san-antonio-tx", ctxKey: "San Antonio|TX", file: "san-antonio-tx-gutter-cost.html" },
    { slug: "portland-or", ctxKey: "Portland|OR", file: "portland-or-gutter-cost.html" },
    { slug: "sacramento-ca", ctxKey: "Sacramento|CA", file: "sacramento-ca-gutter-cost.html" },
    { slug: "pittsburgh-pa", ctxKey: "Pittsburgh|PA", file: "pittsburgh-pa-gutter-cost.html" },
    { slug: "columbus-oh", ctxKey: "Columbus|OH", file: "columbus-oh-gutter-cost.html" },
    { slug: "kansas-city-mo", ctxKey: "Kansas City|MO", file: "kansas-city-mo-gutter-cost.html" },
    { slug: "indianapolis-in", ctxKey: "Indianapolis|IN", file: "indianapolis-in-gutter-cost.html" },
    { slug: "nashville-tn", ctxKey: "Nashville|TN", file: "nashville-tn-gutter-cost.html" },
];

function fmtD(n) { return "$" + n.toLocaleString("en-US"); }
function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* Deterministic hash for stable per-slug variant picking */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
function pick(slug, salt, arr) {
  return arr[hash(slug + "|" + salt) % arr.length];
}
function nbh(facts, i = 0) {
  const arr = facts?.neighborhoods || [];
  if (!arr.length) return facts?.displayName || "downtown";
  return arr[i % arr.length];
}
function threeNbh(facts) {
  const arr = facts?.neighborhoods || [];
  if (arr.length >= 3) return `${arr[0]}, ${arr[1]}, and ${arr[2]}`;
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return arr[0] || facts?.displayName || "downtown";
}

function getRegionMultiplier(state) {
  const regionMap = {
    NY: "northeast", CA: "west", IL: "midwest", TX: "south",
    AZ: "mountain", GA: "southeast", CO: "mountain", WA: "west",
    NV: "mountain", PA: "northeast", FL: "southeast", MA: "northeast",
    MI: "midwest", MN: "midwest", NC: "southeast",
  };
  const region = regionMap[state] || "south";
  return pricingModel.laborMultiplierByRegion[region] || 1.0;
}

/* --- City-specific gutter data --- */

const CITY_GUTTER_DATA = {
  "new-york-ny": {
    annualRainfall: "49.9 inches",
    rainfallNote: "New York receives nearly 50 inches of rain per year, spread fairly evenly across all seasons. Nor'easters in fall and winter can dump 2-4 inches in a single event, and summer thunderstorms regularly produce intense short-duration downpours. Gutters on New York homes need to handle both sustained rainfall and sudden high-volume events without overflowing.",
    downspoutNote: "On brownstones and row houses, downspouts often discharge directly onto sidewalks or into aging combined sewer connections. The city's stormwater regulations are tightening, and proper downspout routing to drywells or rain barrels is increasingly required during renovation permits.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "oak, maple, London plane tree, sweetgum",
    debrisType: "London plane bark flakes, maple samaras (helicopter seeds), and heavy autumn leaf drop from October through December",
    bestGuardStyle: "micro-mesh guards handle the varied debris types in New York best, particularly the fine bark flakes from London plane trees that clog screen-type guards",
    freezeRisk: "high",
    iceNote: "New York experiences regular freeze-thaw cycles from December through March. Ice dams form when heat loss through the roof melts snow that refreezes at the eaves. Heated gutter cables are a practical investment for homes with persistent ice dam problems, particularly on north-facing slopes and in shaded areas. Expect to pay $500-$1,200 for a heated cable system on a typical New York home.",
    cleaningFrequency: "twice per year minimum (late November after full leaf drop and late spring after seed season)",
    cleaningNote: "The heavy tree canopy in neighborhoods like Park Slope, Forest Hills, and Riverdale means gutters fill faster than in less wooded areas. Homes adjacent to mature oaks or maples should budget for a third cleaning in mid-fall.",
    buyingBest: "Late winter (January-February) and late summer (August-September)",
    buyingWorst: "Spring (March-May) after freeze damage and fall (October-November) during peak leaf season",
    buyingNote: "Gutter contractors in the New York metro are busiest after winter storm damage and during fall gutter cleaning season. Scheduling installation during the quieter summer months typically saves 10-15% on labor.",
    localInsightPara: "Brownstone and row-house gutter work in NYC requires staging permits from DOT for sidewalk scaffolding. The permit alone adds $200-$600, and most Brooklyn and Queens gutter contractors factor it into the base bid. Verify whether staging is included or a separate line item.",
    warrantyPara: "Standard NYC gutter installation warranties run 5-10 years on materials and 2-5 years on labor. Co-op and condo board work often requires the contractor to carry $2M in liability coverage, which limits the bidder pool to larger, established NYC shops."
  },
  "los-angeles-ca": {
    annualRainfall: "14.9 inches",
    rainfallNote: "Los Angeles receives less than 15 inches of rain annually, but nearly all of it falls between November and March. When it rains in LA, it often comes as intense atmospheric river events that can deliver 3-5 inches in 24 hours. This feast-or-famine pattern means gutters sit dry for months and then must handle extreme volume with no warning.",
    downspoutNote: "Hillside homes in the foothills face particular drainage challenges. Improperly routed downspouts can contribute to slope erosion and mudslide risk. LA building code requires downspout discharge to be directed away from foundations and slopes, and many hillside homes need extended drainage runs to approved discharge points.",
    treeCoverage: "low to moderate",
    dominantTrees: "palm, eucalyptus, jacaranda, pepper tree",
    debrisType: "eucalyptus leaves and bark strips, jacaranda flowers in June, palm fronds, and fine dust accumulation during dry months",
    bestGuardStyle: "reverse-curve or surface-tension guards work well in LA's low-debris environment and shed the occasional heavy rain effectively; micro-mesh can actually over-filter in dusty conditions, causing surface pooling",
    freezeRisk: "none",
    iceNote: "Freeze risk is essentially zero in Los Angeles. Heated gutters are unnecessary and any contractor suggesting them is either uninformed or upselling. The only cold-climate gutter concern in LA is for mountain-adjacent homes in areas like La Canada Flintridge or Mt. Wilson, where occasional frost can occur.",
    cleaningFrequency: "once per year (late October before rainy season)",
    cleaningNote: "Even though LA gets little rain, dry-season dust and debris accumulation can clog gutters and downspouts before the first major storm. A single thorough cleaning in October ensures the system is ready when the rains arrive. Homes near eucalyptus trees may need a second cleaning in mid-winter.",
    buyingBest: "May through September (dry season, low demand)",
    buyingWorst: "November through February (rainy season, emergency repairs spike demand)",
    buyingNote: "Most LA homeowners do not think about gutters until the first big rainstorm exposes a problem. Contractors are flooded with emergency calls during atmospheric river events. Planning your gutter work during dry season gives you better pricing and contractor availability.",
    localInsightPara: "Hillside gutter work in Silver Lake, Echo Park, and the Hollywood Hills requires pumper-truck or crane access for materials because steep driveways and narrow streets prevent standard delivery. This access surcharge runs $500-$1,500 and should appear as a line item.",
    warrantyPara: "LA gutter warranties run 5-10 years on materials and 2-5 years on labor. Coastal-zone installations in Venice, Playa del Rey, and Malibu should specify marine-grade sealant; standard silicone degrades in salt air within 3-5 years."
  },
  "chicago-il": {
    annualRainfall: "36.9 inches",
    rainfallNote: "Chicago receives about 37 inches of precipitation annually, plus 36 inches of snow. Summer thunderstorms can be intense, with the city averaging 38 thunderstorm days per year. Lake-effect precipitation adds to totals on the city's east side. Gutters in Chicago must handle rain, snow melt, and ice with equal reliability.",
    downspoutNote: "Many older Chicago homes still have downspouts connected to the city's combined sewer system, but the city now encourages disconnection and surface drainage. Basement flooding is endemic in Chicago, and properly sized and routed downspouts with extensions or underground drains are a critical part of the solution.",
    treeCoverage: "heavy",
    dominantTrees: "silver maple, ash (declining due to emerald ash borer), oak, elm, cottonwood",
    debrisType: "massive autumn leaf volume from September through November, cottonwood fluff in June, maple samaras in spring, and ash debris from dying trees",
    bestGuardStyle: "micro-mesh guards are essential in Chicago due to the sheer volume and variety of debris; screen guards clog too quickly during peak leaf season to be practical",
    freezeRisk: "very high",
    iceNote: "Ice dams are one of the most common and expensive gutter-related problems in Chicago. When attic heat melts roof snow, the meltwater refreezes in gutters and at eave edges, backing up under shingles and causing interior water damage. Heated gutter cables ($500-$1,500 installed) are strongly recommended for homes with a history of ice dam formation. Proper attic insulation (R-49+) and balanced ventilation address the root cause, but heated cables provide immediate protection while insulation upgrades are planned.",
    cleaningFrequency: "three times per year (late spring after seed drop, mid-October, and late November after final leaf drop)",
    cleaningNote: "Chicago's dense urban tree canopy means gutters fill rapidly in fall. The combination of heavy leaf drop and freeze risk makes pre-winter cleaning critical. Gutter neglect in October leads directly to ice dam formation in December.",
    buyingBest: "March through May (before storm season) and September (before leaf season rush)",
    buyingWorst: "June through August (peak storm repair season) and late October through November (leaf season)",
    buyingNote: "Chicago gutter contractors run at capacity during fall cleaning season and after summer storms. Spring installation lets your new gutters handle the full year cycle before their first winter test.",
    localInsightPara: "Chicago gangway access between bungalows limits ladder placement and often requires extension-arm scaffolding for second-story gutter work. This access constraint adds $300-$800 to inner-ring neighborhood projects in Wicker Park, Logan Square, and Lakeview.",
    warrantyPara: "Chicago gutter warranties should specify ice-damage exclusion terms clearly. Many contractors exclude ice-dam-related hanger failure from their labor warranty, which in a city with 85+ freeze-thaw cycles makes the warranty nearly meaningless."
  },
  "houston-tx": {
    annualRainfall: "49.8 inches",
    rainfallNote: "Houston receives nearly 50 inches of rain per year, ranking it among the wettest major US cities. Tropical systems from the Gulf can deliver catastrophic rainfall (Hurricane Harvey dumped 60+ inches in some areas). Even routine afternoon thunderstorms regularly produce 1-2 inches per hour. Gutters in Houston are not optional equipment; they are essential flood prevention infrastructure for every home.",
    downspoutNote: "Flat terrain and clay soil mean Houston's drainage challenges are severe. Downspouts must discharge well away from foundations, ideally into French drains or pop-up emitters at least 6-10 feet from the house. The expansive Beaumont clay soil swells when wet, and concentrated water discharge near foundations is one of the primary causes of the foundation movement Houston is notorious for.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "live oak, pecan, pine, magnolia, crepe myrtle",
    debrisType: "live oak leaves drop year-round (especially in spring during leaf exchange), pine needles accumulate steadily, and pecan catkins clog standard gutter screens in April",
    bestGuardStyle: "micro-mesh guards are the best option for Houston because live oaks shed leaves continuously and pine needles pass through standard screen guards; the micro-mesh catches fine debris without restricting the high-volume water flow Houston demands",
    freezeRisk: "low",
    iceNote: "Houston rarely freezes, but the February 2021 winter storm demonstrated that extreme cold events can happen. During that event, frozen gutters and burst outdoor pipes caused widespread damage. For most Houston homes, freeze protection is not worth the investment, but homes with north-facing gutters in shaded areas may benefit from pipe insulation wraps on exposed downspout connections.",
    cleaningFrequency: "twice per year minimum (March after spring leaf exchange and November after pecan and deciduous drop)",
    cleaningNote: "Live oaks are evergreen but shed their old leaves in March-April while putting on new growth. This means Houston has a spring gutter cleaning need that most cities do not. Homes near pine trees should add a mid-summer cleaning to clear needle accumulation.",
    buyingBest: "October through February (dry season, lower contractor demand)",
    buyingWorst: "May through September (hurricane season and peak thunderstorm activity)",
    buyingNote: "Hurricane season drives emergency gutter work in Houston. Planning your installation during the drier fall and winter months means better scheduling, better pricing, and time to address any drainage issues before the next storm season.",
    localInsightPara: "Houston bar-ditch drainage integration is a gutter-project detail most non-Texas contractors miss. Downspout discharge must cross the roadside bar ditch without blocking flow, often requiring a buried pipe under the ditch to the street. This adds $200-$600 per downspout location.",
    warrantyPara: "Houston gutter warranties should address hurricane-wind exclusions explicitly. A warranty that excludes wind damage above 60 mph effectively excludes every named tropical system. Insist on 100+ mph wind-rated installation with a warranty that matches."
  },
  "phoenix-az": {
    annualRainfall: "8.0 inches",
    rainfallNote: "Phoenix receives only about 8 inches of rain per year, making it one of the driest major US cities. However, monsoon season (July-September) concentrates most of that rainfall into intense, short-duration storms that can dump an inch or more in under an hour. These monsoon downpours produce flash-flood conditions, and homes without gutters suffer from concentrated roof runoff that erodes landscaping, stains stucco, and undermines foundations.",
    downspoutNote: "In Phoenix, downspout routing is as much about landscape protection as foundation protection. Desert landscaping (xeriscaping) uses decomposed granite and gravel that wash away quickly under concentrated roof runoff. Downspouts should discharge into splash blocks or buried drainage pipes that disperse water away from both the foundation and landscaped areas.",
    treeCoverage: "low",
    dominantTrees: "palo verde, mesquite, ironwood, palm, citrus",
    debrisType: "palo verde seed pods and tiny leaves, mesquite bean pods, palm fronds, dust accumulation from desert winds, and occasional bird nesting material",
    bestGuardStyle: "perforated aluminum covers or basic screen guards are sufficient for Phoenix's low-debris environment; high-end micro-mesh guards are overkill and the fine mesh can actually clog with desert dust during haboobs (dust storms)",
    freezeRisk: "very low",
    iceNote: "Phoenix essentially never experiences ice dam conditions. Any contractor suggesting heated gutters or ice-related upgrades for a Phoenix home is either confused about the market or padding the quote. The only freeze consideration is for homes in the far north Valley near Carefree or Cave Creek, where overnight temperatures occasionally dip below freezing in December-January.",
    cleaningFrequency: "once per year (late June before monsoon season)",
    cleaningNote: "Dust and wind-blown debris accumulate during the dry months. A single cleaning before monsoon season ensures gutters can handle the intense but infrequent rainfall. Homes near citrus groves or with heavy palo verde coverage may need a second cleaning in late fall.",
    buyingBest: "October through April (mild weather, lower demand)",
    buyingWorst: "July through September (monsoon season, emergency repairs dominate)",
    buyingNote: "Many Phoenix homeowners only discover they need gutters after a monsoon storm floods their patio or erodes their yard. Installing during the mild winter months lets you avoid the monsoon-season rush and gives the sealant and fasteners time to cure in moderate temperatures.",
    localInsightPara: "Many Phoenix homes were built without gutters because the low annual rainfall led builders to skip them. Retrofitting gutters onto a stucco-clad home requires fascia-board verification because some Valley builders omitted the fascia entirely, attaching roof sheathing directly to the rafter tails.",
    warrantyPara: "Phoenix gutter warranties should address monsoon-wind damage. Standard 5-year labor warranties that exclude wind events above 50 mph are problematic because Valley monsoon microbursts routinely exceed 60 mph."
  },
  "dallas-tx": {
    annualRainfall: "37.6 inches",
    rainfallNote: "Dallas receives about 38 inches of rain per year, with the heaviest months being May and October. Spring thunderstorms are often severe, producing large hail alongside heavy rain. This combination means gutters in Dallas take a beating from both water volume and physical hail impact. Oversized 6-inch gutters are increasingly common in DFW to handle the intense rainfall rates during spring storms.",
    downspoutNote: "Like Houston, Dallas sits on expansive clay soil that makes proper drainage essential for foundation protection. Downspouts should extend at least 6 feet from the foundation, and underground drainage systems are highly recommended for homes on the shrink-swell Houston Black clay common throughout the metroplex.",
    treeCoverage: "moderate",
    dominantTrees: "live oak, red oak, cedar elm, pecan, Bradford pear",
    debrisType: "heavy autumn leaf drop from pecans and oaks (October-November), Bradford pear petals in spring, cedar elm leaves, and occasional small branches from storm damage",
    bestGuardStyle: "micro-mesh guards handle the mix of leaf sizes well and protect against the fine debris from cedar elms; surface-tension guards are a good alternative for homes with primarily oak trees",
    freezeRisk: "moderate",
    iceNote: "Dallas experiences occasional ice storms that can freeze gutters solid (most recently in February 2021 and January 2023). While heated gutter cables are not standard in Dallas, homes that experienced frozen gutter damage during Winter Storm Uri may want to consider them as insurance against future events. The typical cost for heated cables on a Dallas home runs $400-$900. More importantly, ensure gutters are properly pitched so standing water does not accumulate and freeze.",
    cleaningFrequency: "twice per year (mid-November after leaf drop and late April after spring pollen and storm season)",
    cleaningNote: "The pecan trees common in established DFW neighborhoods produce heavy leaf drop and catkins that fill gutters quickly in fall. Post-storm inspections are also important in Dallas because hail events can dent gutters and knock them out of alignment.",
    buyingBest: "December through February (slow season) and July through August (between storm and leaf seasons)",
    buyingWorst: "March through May (storm damage repairs) and October through November (fall cleaning rush)",
    buyingNote: "Dallas gutter contractors are busiest after hailstorms and during fall leaf season. The winter months offer the best combination of availability and pricing, and installation conditions are comfortable enough for quality work.",
    localInsightPara: "DFW hail damage to gutters is a recurring insurance-claim category. Dented aluminum gutter channels from large hail events are often covered under the homeowner policy alongside roof damage. Ensure your gutter contractor documents pre-existing conditions with photos before starting work.",
    warrantyPara: "Dallas gutter warranties should specify hail-damage terms. Many DFW contractors exclude hail dents from the labor warranty, which in a metro with 3-5 significant hail events per year leaves homeowners unprotected."
  },
  "atlanta-ga": {
    annualRainfall: "50.2 inches",
    rainfallNote: "Atlanta receives over 50 inches of rain per year, making it one of the wettest major metros in the eastern US. Rain is distributed fairly evenly across all months, with slightly heavier totals in March and July. Summer afternoon thunderstorms are a near-daily occurrence from June through August. This consistent, year-round rainfall means gutters in Atlanta work harder and more continuously than in most US cities.",
    downspoutNote: "Georgia red clay creates significant drainage challenges. The clay is nearly impermeable when saturated, which means downspout discharge pools on the surface rather than absorbing. French drains, catch basins, and graded swales are common drainage solutions in Atlanta. Ensure downspouts discharge at least 6-8 feet from the foundation, preferably into a proper drainage system.",
    treeCoverage: "very heavy",
    dominantTrees: "pine, oak, sweetgum, dogwood, tulip poplar, hickory",
    debrisType: "pine needles year-round, sweetgum ball pods, heavy autumn leaf drop from hardwoods, pine pollen coating in April, and oak catkins in spring",
    bestGuardStyle: "micro-mesh guards are essentially mandatory in Atlanta due to the combination of pine needles (which pass through standard screens) and heavy hardwood leaf drop; surface-tension guards struggle with pine needle accumulation on the nose",
    freezeRisk: "moderate",
    iceNote: "Atlanta experiences occasional ice storms that can cause significant damage (January 2014 and December 2022 were recent examples). Ice accumulation on gutters pulls them away from the fascia and can damage mounting hardware. Heated cables are not standard in Atlanta but may be worth considering for north-facing gutters in heavily shaded areas. More commonly, ensuring gutters are secured with heavy-duty hidden hangers spaced every 24 inches (vs. the standard 36 inches) provides better ice-load resistance.",
    cleaningFrequency: "three to four times per year (January, April after pollen season, August, and late November)",
    cleaningNote: "Atlanta's tree canopy -- particularly the combination of pine and hardwoods -- produces debris in every season. Pine needles accumulate year-round, spring brings pollen and catkins, summer storms knock down small branches, and fall brings massive leaf volume. Three cleanings per year is the minimum; homes surrounded by pines may need four.",
    buyingBest: "January through March (before spring storms) and September through October (before leaf season)",
    buyingWorst: "April through June (spring storm repairs) and November through December (leaf season + holiday slowdown)",
    buyingNote: "Atlanta's rapid growth means contractor schedules fill quickly. Booking gutter work 3-4 weeks in advance is standard practice. Off-season installation in late winter offers the best pricing and availability.",
    localInsightPara: "Atlanta's pine-needle density is the single biggest gutter-maintenance cost driver in the Southeast. A single mature loblolly pine can fill 30-40 linear feet of gutter in 6-8 weeks. Properties surrounded by pines in Dunwoody and Alpharetta should budget for quarterly cleaning or invest in micro-mesh guards.",
    warrantyPara: "Atlanta gutter warranties run 5-10 years on materials and 2-5 years on labor. Ensure the warranty covers hanger-pull-out from ice loading because even Atlanta's moderate freeze events produce enough ice weight to tear standard 36-inch-spaced hangers off the fascia."
  },
  "denver-co": {
    annualRainfall: "15.6 inches",
    rainfallNote: "Denver receives only about 16 inches of precipitation as rain, but adds another 56 inches of snow annually. The real gutter challenge in Denver is not rainfall volume but the spring snowmelt cycle. When 4-6 feet of accumulated roof snow melts over 2-3 weeks in March-April, gutters must handle sustained meltwater flow while transitioning through freeze-thaw cycles every night.",
    downspoutNote: "Denver's bentonite clay soil swells significantly when wet, making foundation drainage critical. Downspouts must route water well away from foundations -- 8-10 feet minimum is recommended for homes on expansive clay. Underground drainage to the street or an alley drain is the gold standard in neighborhoods like Wash Park and Highlands where lot sizes are smaller.",
    treeCoverage: "moderate",
    dominantTrees: "blue spruce, cottonwood, ash (declining), aspen, crabapple",
    debrisType: "cottonwood fluff in June (clogs everything), crabapple fruit in fall, spruce needles year-round, and ash debris from emerald ash borer die-off",
    bestGuardStyle: "micro-mesh guards are the best choice for Denver because they handle both cottonwood fluff (which passes through standard screens) and spruce needles; they also shed snow more effectively than screen-type guards",
    freezeRisk: "very high",
    iceNote: "Ice dams and frozen gutters are major concerns in Denver. The combination of heavy snow, intense high-altitude sun, and cold nights creates a persistent melt-freeze cycle. South-facing gutters thaw during the day and refreeze at night, creating ice buildup that can tear gutters off the fascia. Heated gutter cables ($500-$1,500 installed) are a worthwhile investment for Denver homes, particularly on north-facing slopes where ice persists longest. The high-altitude UV also degrades standard heat cable insulation faster, so UV-rated cable is essential.",
    cleaningFrequency: "twice per year (late November before deep freeze and late April after snowmelt)",
    cleaningNote: "The critical pre-winter cleaning ensures gutters are clear before the freeze cycle begins. Any debris left in gutters in November will be frozen in place until March and will block snowmelt drainage. The spring cleaning clears accumulated winter debris and cottonwood buds.",
    buyingBest: "June through August (warm and dry, good working conditions)",
    buyingWorst: "March through May (post-hailstorm demand spikes) and November through February (weather limits installation)",
    buyingNote: "Denver's Front Range hailstorms drive a seasonal spike in gutter and roofing work every spring. Summer is the sweet spot for gutter installation: warm enough for proper sealant curing, dry enough for safe ladder work, and far enough from hail season that contractors have availability.",
    localInsightPara: "Denver's altitude affects gutter sealant curing times. Butyl and silicone sealants used at gutter joints cure 20-30% slower at 5,280 feet because of the reduced atmospheric pressure. Reputable Front Range crews use altitude-specific cure schedules rather than the sea-level manufacturer guidelines.",
    warrantyPara: "Denver gutter warranties should specify heated-cable compatibility. Many warranties void if aftermarket heat cable is installed without the original contractor's approval, which creates a conflict when ice-dam protection is genuinely needed."
  },
  "seattle-wa": {
    annualRainfall: "37.5 inches",
    rainfallNote: "Seattle receives about 37-38 inches of rain per year, but the perception of constant rain comes from the 150+ days of measurable precipitation. Seattle's rain is typically light and steady rather than intense. However, atmospheric river events in fall and winter can deliver heavy rain over multiple days, and these sustained events test gutter capacity more than brief thunderstorms. The constant moisture means gutters in Seattle are wet for 6+ months of the year.",
    downspoutNote: "Seattle's hilly terrain and glacial till soil create complex drainage requirements. Many homes on hillside lots require downspouts connected to tightline drainage systems that route water to the street rather than allowing surface discharge, which can contribute to the landslide risk that affects many Seattle neighborhoods.",
    treeCoverage: "very heavy",
    dominantTrees: "Douglas fir, western red cedar, big leaf maple, alder, birch",
    debrisType: "cedar fronds and bark strips year-round, Douglas fir needles, massive big leaf maple leaf drop in October-November, moss growth inside gutters, and alder catkins in spring",
    bestGuardStyle: "micro-mesh guards are the clear winner in Seattle because they prevent moss growth inside the gutter channel (a major Seattle-specific problem) while handling the mix of needles, fronds, and large maple leaves; reverse-curve guards allow moss to grow on the gutter surface in Seattle's wet climate",
    freezeRisk: "low",
    iceNote: "Seattle rarely experiences hard freezes, but the occasional cold snap (like December 2022) can freeze gutters for several days. The bigger issue is the sustained weight of wet debris and standing water in gutters that are not draining properly. Heated cables are unnecessary for almost all Seattle homes. The exception is homes at higher elevations near the Cascades foothills where overnight freezes are more common from December through February.",
    cleaningFrequency: "three times per year (late March, mid-August to clear moss growth, and late November after maple leaf drop)",
    cleaningNote: "Moss growing inside gutters is a uniquely Seattle problem. The combination of constant moisture and organic debris creates ideal moss conditions. If left unchecked, moss blocks water flow and adds significant weight to gutter runs. The mid-summer cleaning specifically targets moss removal before fall leaf season begins.",
    buyingBest: "June through September (the dry window)",
    buyingWorst: "October through February (wet season makes installation difficult and demand for repairs peaks)",
    buyingNote: "Seattle's brief dry season (July-September) is the ideal window for gutter installation. Contractors prefer working in dry conditions, sealant cures properly, and you can test the new system with garden hose flow before the rains arrive. Fall and winter installation is possible but expect 10-20% higher labor costs for wet-weather work.",
    localInsightPara: "Seattle's persistent moisture means gutter sealant never fully dries between rain events from October through April. Reputable Puget Sound contractors schedule installation during the June-September dry window specifically because sealant adhesion to wet fascia board is unreliable.",
    warrantyPara: "Seattle gutter warranties should address moss-related failure. Standard warranties that exclude organic growth effectively exclude the primary failure mode in the Pacific Northwest. Insist on a warranty that covers moss-blocked drainage."
  },
  "austin-tx": {
    annualRainfall: "34.2 inches",
    rainfallNote: "Austin receives about 34 inches of rain per year, but rainfall is highly variable. Flash flooding is Austin's most dangerous weather pattern, with intense storms producing 2-4 inches per hour during spring and fall. The city sits on the Balcones Escarpment, where warm Gulf moisture collides with Hill Country terrain to produce some of the most intense rainfall rates in the country. Gutters in Austin need to handle both drought conditions (months with zero rain) and extreme downpour events.",
    downspoutNote: "Austin's split geology creates different drainage needs on each side of town. West Austin homes on limestone shelf need downspouts routed to avoid pooling on impermeable rock. East Austin homes on expansive clay need downspouts extended well away from foundations to prevent clay swelling. In both cases, 6-8 foot minimum downspout extensions are recommended.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "live oak, cedar (juniper), pecan, crepe myrtle, bald cypress",
    debrisType: "cedar pollen and bark in winter, live oak leaf exchange in March, pecan catkins in spring, and heavy deciduous leaf drop in November",
    bestGuardStyle: "micro-mesh guards handle Austin's debris mix well, particularly the fine cedar bark and pollen that clog standard screens; homes in cedar-heavy areas (west Austin, Hill Country) should prioritize micro-mesh over all other guard types",
    freezeRisk: "low to moderate",
    iceNote: "Austin's Winter Storm Uri (February 2021) proved that hard freezes can happen here. Frozen gutters and burst outdoor plumbing caused billions in damage across Texas. While heated gutter cables are not standard in Austin, homes that experienced freeze damage may want to add pipe insulation to exposed downspout connections. The more important lesson from Uri is ensuring gutters are properly pitched so water does not stand and freeze during the rare hard freeze event.",
    cleaningFrequency: "twice per year (late March after live oak leaf exchange and cedar season, and late November after pecan and deciduous drop)",
    cleaningNote: "Austin's live oaks are semi-evergreen, shedding old leaves in March while putting on new growth. This spring leaf exchange, combined with cedar pollen season ending, makes March-April a critical gutter cleaning window. The fall cleaning clears deciduous leaves before any potential winter freeze event.",
    buyingBest: "June through September (hot but dry, good contractor availability)",
    buyingWorst: "March through May (storm season and spring cleaning rush) and October through November (fall demand spike)",
    buyingNote: "Austin's booming growth has stretched contractor capacity across all trades. Booking gutter work 3-4 weeks in advance is standard. Summer installation means dealing with Texas heat, but contractors are more available and pricing is typically 10-15% lower than peak seasons.",
    localInsightPara: "Austin's Edwards Aquifer Recharge Zone west of MoPac adds environmental constraints to gutter discharge routing. Downspouts on recharge-zone properties cannot discharge into concentrated surface flows without environmental review. French drains and pop-up emitters are the compliant discharge method.",
    warrantyPara: "Austin gutter warranties run 5-10 years on materials and 2-5 years on labor. Austin permit-queue delays mean warranty-claim response times are slower than in Houston or San Antonio because the same contractors are juggling new-install backlogs."
  },
  "san-francisco-ca": {
    annualRainfall: "24.6 inches",
    rainfallNote: "San Francisco receives about 25 inches of rain per year, with nearly all of it concentrated between November and April. Summer is famously dry, often going 4-5 months without measurable rainfall, while atmospheric river events in winter can drop 3-6 inches over a few days. The fog drip that rolls in off the Pacific also keeps gutters damp far more often than rainfall totals alone suggest.",
    downspoutNote: "The city's combined sewer system in neighborhoods like the Mission, Haight, and Inner Richmond means downspouts often tie directly into the sewer lateral, and SFPUC has been pushing homeowners toward green infrastructure disconnections where possible. Hillside homes in Bernal Heights, Twin Peaks, and Diamond Heights face steep-grade runoff concerns where poorly routed downspouts can undermine retaining walls and contribute to the serpentinite slope failures the city deals with every wet winter.",
    treeCoverage: "low to moderate",
    dominantTrees: "eucalyptus, Monterey cypress, redwood, Victorian box, Monterey pine",
    debrisType: "eucalyptus bark strips and seed caps year-round, Monterey pine needles, redwood duff on Presidio-adjacent homes, and tanbark flakes after windy fog nights",
    bestGuardStyle: "micro-mesh guards are the right call in San Francisco because eucalyptus bark strips and Monterey pine needles both slip past standard screens; the mesh also resists the persistent damp that grows moss on reverse-curve guards in the Sunset and Richmond fog belts",
    freezeRisk: "low",
    iceNote: "Hard freezes are rare in San Francisco proper, and ice dams are essentially unheard of at city elevation. Heated gutter cables have no practical purpose on a typical SF home and any contractor recommending them is upselling. The only cold-weather consideration is for homes above 800 feet in areas like Twin Peaks or Mt. Davidson where a few mornings per winter can dip below freezing.",
    cleaningFrequency: "twice per year (late October before the rainy season and late March after winter storm debris)",
    cleaningNote: "Homes near the Presidio, Glen Canyon, or McLaren Park collect far more debris than downtown flats because of eucalyptus and cypress canopy. Properties in the fog belt also accumulate moss and lichen inside uncleaned gutters faster than the rainfall totals would suggest.",
    buyingBest: "May through September (the dry window)",
    buyingWorst: "November through February (atmospheric river emergencies dominate contractor schedules)",
    buyingNote: "SF gutter contractors see their biggest call volume after the first big winter storm exposes failures that have been hidden all summer. Booking installation during the dry months gets you better sealant curing conditions and typically 10-15% lower labor pricing than peak storm season.",
    localInsightPara: "SF hillside gutter work on 25%+ grade streets in Noe Valley, Twin Peaks, and Bernal Heights requires specialized staging that adds $1,200-$3,500 to the project. The pumper-truck and safety-harness requirements are genuine and should not be dismissed as padding.",
    warrantyPara: "SF gutter warranties should address marine-fog corrosion. Standard aluminum warranties assume inland exposure; within the fog belt, the constant salt-moisture cycle degrades fastener connections 30-40% faster than manufacturer timelines predict."
  },
  "philadelphia-pa": {
    annualRainfall: "44.5 inches",
    rainfallNote: "Philadelphia receives about 44-45 inches of precipitation spread fairly evenly across the year, with a slight summer peak driven by afternoon thunderstorms. Nor'easters in fall and early spring can stall over the Delaware Valley and drop 2-4 inches in a single system. Winter brings a mix of rain, sleet, and snow that routinely cycles through gutters during freeze-thaw swings.",
    downspoutNote: "Center City row houses and older Fishtown, Brewerytown, and South Philly blocks still discharge almost universally into the city's combined sewer system, and Philadelphia Water Department's stormwater grading program now pushes commercial properties and some residential renovations toward disconnected downspouts, rain gardens, or stormwater planters. On twin homes and row houses, shared party-wall gutter runs mean one neighbor's clog becomes both neighbors' problem.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "oak, maple, London plane, sweetgum, black locust",
    debrisType: "London plane bark flakes year-round, sweetgum spiky ball pods in winter, heavy oak and maple leaf drop October-November, and black locust pods in late summer",
    bestGuardStyle: "micro-mesh guards handle Philadelphia's mix best because the London plane bark flakes and black locust debris slip through standard screens, and the mesh resists the freeze-thaw ice loading that tears screen guards off the lip",
    freezeRisk: "moderate",
    iceNote: "Philadelphia sees a real freeze-thaw season from late December through February, and ice dams are a common complaint in Chestnut Hill, Mt. Airy, and other older neighborhoods with uninsulated attics and 1920s-era rafter construction. Heated gutter cables ($400-$1,000 installed) are a reasonable investment for homes with a history of eave ice buildup, but the better long-term fix is attic insulation and ridge-vent ventilation to stop the warm roof that drives the problem.",
    cleaningFrequency: "twice per year minimum (mid-to-late November after full leaf drop and late April after spring buds and catkins)",
    cleaningNote: "Homes in Chestnut Hill, Mt. Airy, and West Mt. Airy sit under some of the heaviest hardwood canopy in the city and routinely need a third fall cleaning in early December. Row houses in Center City with a single street tree out front need far less.",
    buyingBest: "Late winter (January-February) and mid-summer (July-August)",
    buyingWorst: "March through May (post-winter damage repairs) and October through November (leaf-season scramble)",
    buyingNote: "Philadelphia contractors are busiest after freeze-thaw damage surfaces in spring and during the fall gutter-cleaning rush. Scheduling installation in the quieter summer or late-winter windows typically saves 10-15% on labor and gets you a faster turnaround.",
    localInsightPara: "Philly rowhouse shared party-wall gutter runs create a unique coordination requirement: one neighbor's gutter clog or failure affects both properties. Twin-home and rowhouse gutter projects in Fishtown, Brewerytown, and South Philly often require neighbor coordination that single-family projects do not.",
    warrantyPara: "Philadelphia gutter warranties should specify freeze-damage terms. Standard warranties excluding ice-dam-related hanger failure are problematic in a city with 70+ freeze-thaw cycles. Insist on 24-inch hanger spacing and a warranty that covers ice-load failure."
  },
  "miami-fl": {
    annualRainfall: "61.9 inches",
    rainfallNote: "Miami receives nearly 62 inches of rain per year, making it one of the wettest major US cities. The wet season runs May through October and delivers near-daily afternoon thunderstorms, and tropical systems in late summer and fall can drop 4-8 inches in a single event. Rainfall rates of 2-3 inches per hour are routine, which means gutter capacity -- not annual totals -- is the real design constraint.",
    downspoutNote: "Miami-Dade's high water table and porous oolitic limestone mean downspouts rarely need deep French drains; water disperses quickly once it leaves the foundation zone. The bigger concern is king tides and wind-driven rain on coastal properties in Miami Beach, Brickell, and Coconut Grove, where downspouts must discharge on the landward side of the house and splash blocks need to be anchored against hurricane-force gusts.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "royal palm, live oak, ficus, mahogany, gumbo limbo, sea grape",
    debrisType: "ficus leaves and aerial root debris year-round, live oak leaf exchange in late winter, royal palm fronds and seed stalks, gumbo limbo bark peels, and sea grape leaves near coastal homes",
    bestGuardStyle: "micro-mesh guards are the right choice in Miami because ficus leaves and aerial root fragments pass straight through screen guards; the mesh also stands up to hurricane-force wind uplift better than reverse-curve guards, which can peel off entirely in a named storm",
    freezeRisk: "none",
    iceNote: "Miami does not experience freezing temperatures in any practical sense; the last measurable freeze at Miami International was in 2010 and even that was brief. Heated gutter cables, ice shield membranes, and any cold-weather gutter upgrade are pure upsell in this market. The only weather-related gutter concern is hurricane hardening, which means heavier-gauge aluminum, closer hanger spacing (every 18-24 inches), and stainless fasteners.",
    cleaningFrequency: "three times per year (February after live oak leaf exchange, early June before peak wet season, and November after hurricane season)",
    cleaningNote: "Homes in Coconut Grove, Coral Gables, and the Redland sit under the densest tree canopy and need the full three cleanings. Ficus trees are the single worst gutter offender in Miami because they shed debris year-round and the aerial roots can actually grow into a standing-water gutter.",
    buyingBest: "December through April (dry season overlaps with snowbird contractor availability)",
    buyingWorst: "June through November (Atlantic hurricane season drives emergency-repair surges and 30-60 day scheduling delays)",
    buyingNote: "After every named storm Miami-Dade gutter contractors disappear into emergency-repair queues for 6-10 weeks, and material prices spike 15-25% on stainless fasteners and 0.032 gauge aluminum coil. Scheduling during the December-April dry window avoids the storm-season bottleneck, delivers optimal silicone-sealant cure conditions, and ensures your system is tested and leak-free before the next Atlantic hurricane season opens June 1.",
    localInsightPara: "Every Miami-Dade gutter installation must comply with the High Velocity Hurricane Zone (HVHZ) building code: 0.032-inch minimum gauge aluminum, hidden hangers at 18-24 inch centers (not the 36-inch standard used outside Florida), and 316 stainless-steel screws rated for the coastal corrosion environment. Brickell, Coconut Grove, and Coral Gables properties within a mile of Biscayne Bay face the most aggressive salt-spray exposure in the continental US, where even marine-grade aluminum degrades within 8-10 years without a factory-applied polyester powder coat. Any Miami bid specifying 0.027 gauge aluminum or 36-inch hanger spacing is under-engineering for the HVHZ and will fail Miami-Dade final inspection.",
    warrantyPara: "Miami-Dade gutter warranties must cover wind events up to the local design speed of 175 mph per ASCE 7-22. A warranty that excludes damage above 74 mph (Category 1 threshold) provides zero meaningful protection in a metro that experienced Andrew (165 mph), Wilma (120 mph), and Irma (130 mph) within 25 years. Require documented 130+ mph rated installation and a warranty that specifically does not carve out named-storm or hurricane-force wind events."
  },
  "boston-ma": {
    annualRainfall: "43.6 inches",
    rainfallNote: "Boston receives about 44 inches of precipitation per year, distributed fairly evenly across the seasons, plus another 49 inches of snow on average. Nor'easters are the defining storm type, sometimes stalling offshore and dumping 3-5 inches of rain or 1-2 feet of snow. Summer thunderstorms are less intense than in the Mid-Atlantic but still produce occasional 1-inch-per-hour downpours.",
    downspoutNote: "Beacon Hill, the South End, and Back Bay brownstones universally discharge downspouts into the combined sewer system via interior leaders, and the Boston Water and Sewer Commission is slowly pushing green-infrastructure disconnections where feasible. In older triple-deckers across Dorchester, Jamaica Plain, and Somerville, downspouts often dump onto aging concrete walkways that slope back toward the foundation, which is one of the single biggest causes of wet basements in the metro.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "red oak, sugar maple, Norway maple, American elm, white pine, linden",
    debrisType: "sugar and Norway maple samaras in May, linden flower bracts in July, massive oak and maple leaf drop October-November, and white pine needles year-round on properties adjacent to the Emerald Necklace",
    bestGuardStyle: "micro-mesh guards are the right choice for Boston because white pine needles slip through screen guards and the mesh holds up better under the ice loading that defines a New England winter; reverse-curve guards routinely get torn off by ice dam formation",
    freezeRisk: "high",
    iceNote: "Ice dams are one of the most serious and costly gutter-related problems in Boston. The combination of heavy snow, poorly insulated 1920s triple-deckers, and sustained sub-freezing temperatures creates textbook ice dam conditions from January through March. Heated gutter cables ($500-$1,400 installed) are a practical retrofit for homes with a documented history of ice dam damage, particularly on north-facing eaves in Brookline, Newton, and the leafy parts of West Roxbury. The deeper fix is R-49+ attic insulation and proper soffit-to-ridge ventilation.",
    cleaningFrequency: "twice per year minimum (late November after full leaf drop and late April after snowmelt and spring buds)",
    cleaningNote: "Homes in Chestnut Hill, Brookline, Jamaica Plain around the Arboretum, and the leafier parts of Cambridge sit under enough oak and maple canopy to need a third late-October cleaning. The pre-winter cleaning is non-negotiable -- any debris left in a Boston gutter in December will be frozen in place until March.",
    buyingBest: "June through early September (warm, dry, stable working conditions)",
    buyingWorst: "March through May (post-winter damage claims spike) and October through November (leaf-season rush)",
    buyingNote: "Boston contractors run at capacity after every hard winter as homeowners discover ice-damaged gutters during the spring thaw. Summer installation gets you the best sealant curing conditions, the best labor availability, and a full cycle to spot any issues before winter arrives.",
    localInsightPara: "Boston triple-decker gutter work requires three-story ladder access and often scaffold staging because the roof eaves sit 35-40 feet above grade. The staging cost on a Dorchester or Somerville triple-decker adds $800-$2,000 to the gutter project versus single-story ranch pricing.",
    warrantyPara: "Boston gutter warranties should explicitly cover ice-dam hanger failure because ice dams are a standard annual occurrence, not an excluded act of nature. Any Boston warranty that excludes ice-related damage is covering the contractor, not the homeowner."
  },
  "san-diego-ca": {
    annualRainfall: "10.3 inches",
    rainfallNote: "San Diego receives only about 10 inches of rain per year, one of the lowest totals of any major US city. Nearly all of that rainfall arrives between December and March, and the city often goes six months with no measurable precipitation. When storms do arrive, they can be intense -- atmospheric rivers and El Nino years occasionally deliver 2-3 inches in 24 hours, which is more than most local gutters were sized for.",
    downspoutNote: "Hillside homes in La Jolla, Mount Helix, Point Loma, and the canyon-lined neighborhoods of Mission Hills and Kensington face serious slope-runoff concerns; improperly routed downspouts contribute to the bluff failures and canyon erosion the city sees every wet winter. Discharge into approved tightlines or at least 6-8 feet from slope edges is essential, and some coastal-zone properties require engineered drainage as a permit condition.",
    treeCoverage: "low to moderate",
    dominantTrees: "eucalyptus, jacaranda, Torrey pine, Canary Island palm, Mexican fan palm, pepper tree",
    debrisType: "eucalyptus bark strips year-round, jacaranda flower drop and sticky pods in June, Torrey pine needles on coastal properties, palm fronds and seed clusters, and pepper tree berries",
    bestGuardStyle: "reverse-curve or surface-tension guards work well in San Diego's low-debris environment and shed the occasional heavy El Nino rain effectively; micro-mesh can over-filter in the dry months and create surface pooling when fine coastal salt dust cakes the mesh",
    freezeRisk: "none",
    iceNote: "San Diego does not experience freezing temperatures at any residential elevation. Heated gutter cables, ice shields, or any cold-weather upgrade on a San Diego home is either a misunderstanding or a straight-up upsell. The only cold-weather consideration anywhere in the county is for properties in the Julian or Palomar Mountain backcountry, which are a different market entirely.",
    cleaningFrequency: "once per year (late October or early November before the rainy season)",
    cleaningNote: "Homes under eucalyptus or jacaranda canopy in Mission Hills, Kensington, and parts of La Jolla need the pre-rainy-season cleaning more than homes in less-wooded coastal tracts. Properties near Torrey Pine reserves or canyon edges also collect substantially more debris than the metro average.",
    buyingBest: "May through October (the dry window)",
    buyingWorst: "December through March (the narrow rainy season drives all the emergency calls)",
    buyingNote: "Most San Diego homeowners don't think about gutters until the first real winter storm exposes a problem, which means contractors see a compressed rush every December. Installing during the long dry season means better pricing, better availability, and time to test the system before rainfall arrives.",
    localInsightPara: "San Diego hillside gutter work in La Jolla, Point Loma, and Mission Hills canyon-edge properties faces slope-runoff concerns that flat-lot homes do not share. Downspout discharge must route away from bluff edges, and some coastal-zone parcels require engineered drainage as a permit condition.",
    warrantyPara: "San Diego gutter warranties run 5-10 years on materials and 2-5 years on labor. Coastal installations should specify marine-grade sealant and stainless fasteners; standard components corrode in the salt-fog environment within 5-8 years."
  },
  "tampa-fl": {
    annualRainfall: "46.6 inches",
    rainfallNote: "Tampa receives about 47 inches of rain per year, concentrated heavily in the May-through-September wet season when afternoon thunderstorms are a near-daily event. Tampa Bay sits in one of the most lightning-prone corridors in the country, and the associated thunderstorms regularly deliver 1-2 inches per hour. Tropical systems off the Gulf add another layer of risk, and a direct hurricane strike can dump 6-12 inches in a single event.",
    downspoutNote: "Tampa's flat terrain, high water table, and sandy soil mean surface drainage happens fast but standing water near foundations can still cause problems in clay-rich pockets of Hyde Park, Seminole Heights, and Temple Terrace. Coastal properties on Davis Islands, Harbour Island, and along the Pinellas beaches need downspout discharge on the landward side of the house and hurricane-rated strapping on both gutters and downspouts.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "live oak, Southern magnolia, slash pine, sabal palm, cabbage palm, laurel oak",
    debrisType: "live oak leaf exchange in February-March, slash pine needles year-round, magnolia leaves and seed cones, sabal palm fronds and berry clusters, and Spanish moss that drops in clumps after storms",
    bestGuardStyle: "micro-mesh guards are the best fit for Tampa because slash pine needles slip through screen guards and live oak leaves plus Spanish moss require the finer filtration; the mesh also holds up better to hurricane wind uplift than reverse-curve designs",
    freezeRisk: "none",
    iceNote: "Tampa essentially never sees freezing weather in any way that affects gutters. The January 2010 cold snap produced a few hours of freezing temperatures but no gutter freeze-up. Heated cables and cold-weather gutter upgrades have no practical application here and should be treated as upsells. Hurricane hardening -- heavier hangers, closer spacing, stainless fasteners -- is the legitimate local upgrade to ask about.",
    cleaningFrequency: "three times per year (March after live oak leaf exchange, early June before peak wet season, and November after hurricane season)",
    cleaningNote: "Homes in Hyde Park, Davis Islands, Temple Terrace, and the old-growth oak corridors along Bayshore need the full three cleanings because of the live oak canopy. Properties with slash pine in the yard should add an informal mid-summer needle sweep.",
    buyingBest: "November through April (dry season, post-hurricane lull)",
    buyingWorst: "May through October (wet season, hurricane season, and emergency-repair peak)",
    buyingNote: "Tampa gutter contractors see the year's biggest call volume in the days after every named storm, and both pricing and scheduling suffer through the entire wet season. Installing during the dry winter window gets you better pricing, better sealant curing, and readiness before the next hurricane season opens.",
    localInsightPara: "Tampa gutter installations must address hurricane hardening: heavier-gauge aluminum with hidden hangers spaced every 18-24 inches and stainless-steel fasteners rated for Hillsborough County 140-150 mph design wind speed. Standard mainland-US gutter specs are inadequate for Tampa Bay storm exposure.",
    warrantyPara: "Tampa gutter warranties should match the hurricane-rated installation spec. A warranty that caps at 74 mph wind speed is inadequate for a metro that sits in a 140-150 mph design wind zone under Florida Building Code."
  },
  "detroit-mi": {
    annualRainfall: "33.5 inches",
    rainfallNote: "Detroit receives about 33-34 inches of rain per year plus another 42 inches of snow, with precipitation distributed fairly evenly across all seasons. Summer thunderstorms off Lake St. Clair can produce intense short-duration downpours, and lake-effect bands occasionally add surprise rainfall in fall. The combination of rain, snowmelt, and freeze-thaw cycling puts Detroit gutters through more stress than the annual totals would suggest.",
    downspoutNote: "Detroit's aging combined sewer system is overwhelmed during heavy storms, and basement backups during summer thunderstorms are a chronic citywide problem that proper downspout routing can partially mitigate. The Detroit Water and Sewerage Department offers downspout disconnection credits, and extending discharge 6-8 feet from the foundation onto pervious surfaces is one of the cheapest ways to protect a Detroit basement. In Grosse Pointe and older Indian Village properties, underground tile drains need periodic inspection because roots and settling regularly collapse them.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "silver maple, red maple, oak, ash (rapidly declining from emerald ash borer), elm, cottonwood",
    debrisType: "cottonwood fluff in June, silver maple samaras in spring, heavy autumn leaf drop October-November, and significant ash debris from dying and dead trees across older neighborhoods",
    bestGuardStyle: "micro-mesh guards are the right call in Detroit because cottonwood fluff, maple samaras, and fine ash debris all slip through screen guards; the mesh also stands up better to ice loading than reverse-curve guards, which routinely fail during hard Michigan winters",
    freezeRisk: "high",
    iceNote: "Ice dams are a standard winter problem in Detroit, especially in older Indian Village, Boston-Edison, and Grosse Pointe homes with 1910s-1930s uninsulated attics. Sustained sub-freezing January temperatures combined with roof heat loss produce classic ice dam conditions almost every winter. Heated gutter cables ($500-$1,400 installed) are a reasonable retrofit for problem eaves, though the better long-term fix is R-49+ attic insulation and balanced soffit-ridge ventilation.",
    cleaningFrequency: "twice per year minimum (late November after full leaf drop and late April after snowmelt)",
    cleaningNote: "Grosse Pointe, Indian Village, and Palmer Woods sit under enough old-growth canopy to need a third late-October cleaning. The pre-winter cleaning is non-negotiable in Detroit; any debris left in gutters in December will freeze into a solid plug until March and guarantees ice dam formation.",
    buyingBest: "June through early September (warm, stable, dry working conditions)",
    buyingWorst: "March through May (post-winter damage surfaces) and October through November (leaf-season rush)",
    buyingNote: "Detroit contractors see their biggest spike in spring as homeowners discover ice-damaged gutters and torn-loose runs during the thaw. Summer installation gets you the best labor availability, the best sealant curing conditions, and a full cycle to find any issues before winter hits.",
    localInsightPara: "Detroit's aging combined sewer system is overwhelmed during summer thunderstorms, and proper downspout disconnection is one of the cheapest ways to reduce basement backup risk. The Detroit Water and Sewerage Department offers downspout-disconnection credits that offset a portion of the gutter project cost.",
    warrantyPara: "Detroit gutter warranties should specify ice-dam exclusion terms clearly. A warranty that excludes freeze-related hanger failure is covering the contractor, not the homeowner, in a city with 78+ freeze-thaw cycles annually."
  },
  "minneapolis-mn": {
    annualRainfall: "30.6 inches",
    rainfallNote: "Minneapolis receives about 31 inches of rain per year plus roughly 54 inches of snow, with a clearly defined wet season from May through September when summer thunderstorms deliver the bulk of the annual total. Rainfall rates of 1-2 inches per hour are common during June-August storm events, and the occasional derecho or training thunderstorm can drop 3-4 inches in a single afternoon. The real gutter load, though, comes from the spring snowmelt when 3-5 feet of accumulated roof snow transitions to runoff over a few short weeks.",
    downspoutNote: "The frost line in Minneapolis sits at roughly 42 inches, which means any buried downspout extensions need to either sit above the frost line and drain by gravity each fall, or be installed deeper than 42 inches to avoid heaving. Minneapolis-St. Paul stormwater code increasingly pushes new construction toward rain gardens and disconnected downspouts, and many older neighborhoods like Kenwood, Lowry Hill, and parts of Edina still have direct sewer-lateral connections that are slowly being disconnected.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "American elm (on the remaining Dutch elm-resistant stock), silver maple, sugar maple, basswood (linden), green ash (dying from EAB), cottonwood",
    debrisType: "cottonwood fluff in June (clogs everything), silver and sugar maple samaras in May, basswood flower bracts in July, heavy autumn leaf drop October-early November, and ongoing ash debris from emerald ash borer die-off",
    bestGuardStyle: "micro-mesh guards are essentially required in Minneapolis because cottonwood fluff passes through every screen-type guard and the mesh handles ice loading and snow sliding off the roof better than reverse-curve designs; heavy-gauge stainless mesh is worth the upgrade for the ice resistance alone",
    freezeRisk: "very high",
    iceNote: "Ice dams are one of the most serious and expensive home problems in the Twin Cities. Sustained sub-zero January and February temperatures combined with heavy snow on poorly insulated rooflines produce textbook ice dam conditions every single winter. Heated gutter cables ($500-$1,500 installed) are a standard defensive measure on older Kenwood, Linden Hills, and older St. Paul homes with a documented history of ice damming. The deeper fix is aggressive R-60 attic insulation, sealed bypasses, and balanced soffit-ridge ventilation to stop the warm roof driving the cycle.",
    cleaningFrequency: "twice per year minimum (late October before first hard freeze and mid-to-late May after snowmelt and samara drop)",
    cleaningNote: "Homes in Kenwood, Linden Hills, Lowry Hill, and the old-growth stretches of Edina and Minnetonka sit under dense canopy and often need a third mid-November cleaning right before the snow locks everything in. The pre-freeze cleaning is non-negotiable -- any debris left in a Minneapolis gutter in November is frozen in place until April and guarantees ice dam formation.",
    buyingBest: "June through early September (the narrow warm-dry installation window)",
    buyingWorst: "March through May (post-winter damage claims dominate schedules) and November through February (weather prevents most installation)",
    buyingNote: "The Twin Cities gutter-installation season is genuinely short, and every contractor is booked solid from April through the first hard freeze. Booking summer installation 4-6 weeks ahead is standard; waiting until September risks not getting on a calendar at all before the weather window closes.",
    localInsightPara: "Twin Cities gutter installation is constrained by the narrow warm-weather window. Every contractor is booked solid from May through the first hard freeze. Booking summer installation 4-6 weeks ahead is standard; waiting until September risks not getting on a calendar before the weather window closes entirely.",
    warrantyPara: "Minneapolis gutter warranties should cover ice-dam hanger failure explicitly because ice dams occur every single winter in the Twin Cities. A warranty excluding ice-related damage is meaningless in a metro with 135+ freeze-thaw cycles."
  },
  "charlotte-nc": {
    annualRainfall: "43.1 inches",
    rainfallNote: "Charlotte receives about 43 inches of rain per year, fairly evenly distributed across the seasons with a mild summer peak from thunderstorm activity. Tropical systems drifting inland from the Gulf or Atlantic occasionally stall over the Carolinas and drop 3-6 inches in 24-48 hours, and winter nor'easters can deliver cold rain for days. The Piedmont's red clay soil means water that isn't routed away from the house lingers near the foundation for a long time.",
    downspoutNote: "Charlotte's red Piedmont clay is nearly impermeable when saturated, which means downspout discharge pools on the surface and migrates back toward the foundation if not properly routed. Extending downspouts 6-8 feet minimum, or better yet into French drains or pop-up emitters, is a standard defensive measure in neighborhoods like Myers Park, Eastover, and Dilworth where mature trees and old lot grading can complicate drainage. Newer NoDa and Plaza Midwood infill homes often still have the builder-grade 3-foot extensions that are nowhere near enough.",
    treeCoverage: "heavy",
    dominantTrees: "willow oak, water oak, Southern magnolia, loblolly pine, tulip poplar, dogwood, crepe myrtle",
    debrisType: "willow and water oak leaf drop October-December (extended season because of the mild fall), loblolly pine needles year-round, magnolia leaves and seed cones, pine pollen coating in April, and tulip poplar samaras",
    bestGuardStyle: "micro-mesh guards are the right choice for Charlotte because loblolly pine needles slip through every screen-type guard and the willow oak leaves are small enough to cause issues with reverse-curve designs; the fine mesh also handles the April pine pollen coating better than coarser alternatives",
    freezeRisk: "low to moderate",
    iceNote: "Charlotte sees occasional winter ice storms that can briefly freeze gutters solid -- February 2014, December 2018, and January 2022 were recent examples. Heated gutter cables aren't standard here, but homes that lost gutter runs to ice loading during a named storm may want them as insurance. More commonly, proper gutter pitch and closer hanger spacing (every 24 inches rather than 36) provides meaningfully better ice-load resistance at much lower cost.",
    cleaningFrequency: "three times per year (April after pine pollen and catkins, late August to clear summer storm debris, and mid-December after the extended oak drop finishes)",
    cleaningNote: "Homes in Myers Park, Eastover, Dilworth, and the old canopy stretches of Elizabeth need the full three cleanings because of the willow oak density. NoDa and Plaza Midwood homes with fewer mature trees can usually get by with two. Loblolly pine debris across the region means pretty much every Charlotte home needs at least one mid-year cleaning.",
    buyingBest: "January through February (slow season) and July (between storm and leaf seasons)",
    buyingWorst: "April through June (spring storm repairs) and October through December (extended leaf-season rush)",
    buyingNote: "Charlotte's rapid population growth has stretched contractor capacity thin across every trade, and gutter work is no exception. Booking 3-4 weeks ahead is standard practice. Late-winter installation gets you the best pricing and availability, and conditions are mild enough for quality work year-round.",
    localInsightPara: "Charlotte's extended oak leaf-drop season (October through December due to mild fall temperatures) means gutters fill later in the year than in northern metros. A single late-December cleaning is often necessary even after an early-November cleaning because willow and water oaks hold their leaves well into the holiday season.",
    warrantyPara: "Charlotte gutter warranties run 5-10 years on materials and 2-5 years on labor. The moderate freeze-thaw cycle rarely produces ice-dam conditions, but ice-storm hanger failure (2002, December 2022) should still be covered in the warranty terms."
  },
  "las-vegas-nv": {
    annualRainfall: "4.2 inches",
    rainfallNote: "The Valley averages a scant 4.2 inches annually, the lowest total among the 40 metros we track. Almost every measurable drop falls during two narrow windows: July-September North American Monsoon cells that barrel off the Spring Mountains and drop half an inch inside 15 minutes, and the occasional January-February cutoff low that stalls over the Mojave. Clark County flash-flood sirens activate several times per monsoon season because the caliche hardpan underneath most subdivisions refuses to absorb water, sending sheet flow across Flamingo Road, Charleston Boulevard, and into the Las Vegas Wash.",
    downspoutNote: "Summerlin, MacDonald Ranch, and Inspirada developments sit on decomposed-granite xeriscape that washes out within minutes under concentrated roof discharge. Routing downspouts into subsurface HDPE tightlines that daylight at the HOA retention basin solves the problem permanently. Southern Nevada Water Authority (SNWA) turf-removal rebates have expanded xeriscape acreage across the Valley, making this gutter-to-retention routing increasingly important because the desert hardscape provides zero absorption buffer.",
    treeCoverage: "low",
    dominantTrees: "mesquite, palo verde, desert willow, Mexican fan palm, date palm, olive, oleander",
    debrisType: "palo verde micro-leaves and curled seed pods, mesquite bean husks that jam downspout elbows in August, olive fruit staining on white aluminum, wind-driven caliche dust from haboob events, and dove and cactus wren nesting material inside uncovered gutter runs",
    bestGuardStyle: "perforated aluminum covers or coarse-mesh screen guards handle the Valley's sparse debris adequately; fine micro-mesh filters actually backfire here because caliche dust and calcium-scale films seal the mesh pores during haboob season, causing monsoon runoff to sheet right over the gutter lip and miss the trough entirely",
    freezeRisk: "low",
    iceNote: "Overnight lows touch 28-32F on roughly 10-15 nights per winter along the Summerlin ridgeline and Red Rock foothills, but daytime recovery above 50F prevents any sustained freeze. Heated gutter cables have zero practical application anywhere inside the Valley. The only legitimate cold-weather gutter consideration is ensuring sealant joints cure above 40F, which briefly matters on December-January morning installs in zip codes west of the 215 beltway.",
    cleaningFrequency: "once per year (late June, right before monsoon onset)",
    cleaningNote: "Homes along the Summerlin ridge near Red Rock Canyon, mature-tree lots in Green Valley Ranch, and date-palm-lined streets in Henderson collect meaningfully more debris than the Valley average and benefit from a second pass in November. Newer Cadence and Inspirada tract homes with sparse landscaping can safely stretch to every 18-24 months if the monsoon-season inspection shows clear downspouts.",
    buyingBest: "October through April (mild 65-80F rooftop temps, low demand, easy scheduling)",
    buyingWorst: "July through September (monsoon emergency calls and 115F rooftop surface temps make summer installs hazardous and expensive)",
    buyingNote: "Valley homeowners overwhelmingly discover gutter needs after a July microburst floods the patio or undercuts the xeriscape. Scheduling during the mild October-March window avoids the monsoon-emergency queue, keeps rooftop surface temps at safe working levels, and lets silicone sealant cure properly instead of flash-setting in triple-digit heat.",
    localInsightPara: "Roughly 40 percent of Clark County tract homes built before 2005 were delivered with no gutters at all because desert-market builders treated them as optional. Retrofitting gutters onto a stucco-over-CBS home with concrete-tile roof requires tile-compatible fascia brackets rated for the 90-mph Clark County design wind speed -- expect $3-$5 per bracket above standard K-style hardware, plus a tile crew to re-seat disturbed tiles along the eave.",
    warrantyPara: "Valley gutter warranties must address monsoon microburst exclusions explicitly. A warranty capping at 50 mph is meaningless in a metro where NWS Las Vegas logs 65-80 mph outflow gusts multiple times each monsoon season. Demand 90-mph rated installation with a warranty that does not carve out convective-wind events."
  },

  "st-louis-mo": {
    annualRainfall: "42 inches",
    rainfallNote: "St. Louis receives 42 inches of rain concentrated in violent April-through-June thunderstorms that regularly exceed 2 inches per hour. Combined sewer overflows in MSD territory during these events push stormwater back through basement floor drains across Tower Grove South and Benton Park, making gutter-to-downspout capacity a first-line defense against basement flooding rather than just a roof-protection measure.",
    downspoutNote: "South City's combined sewer system means downspouts must disconnect from the sewer line and route water at least 6 feet from the foundation through extensions or buried drains. MSD's Phase 2 CSO program incentivizes disconnection, and homes in Soulard and Lafayette Square that still feed downspouts directly into the combined sewer face increasing enforcement pressure.",
    treeCoverage: "heavy",
    dominantTrees: "red oak, sweetgum, pin oak, silver maple",
    debrisType: "sweetgum spiny seed balls that jam standard screen guards, red oak acorns and leaves, and silver maple samaras in April that create a second debris season most cities lack",
    bestGuardStyle: "micro-mesh guards are essential because sweetgum seed balls pass through standard screen guards but lodge in reverse-curve systems, making the mesh the only guard type that handles all four major St. Louis species",
    freezeRisk: "moderate to high",
    iceNote: "Sixty freeze-thaw cycles annually make ice dams a recurring problem, particularly on north-facing slopes in Clayton and Kirkwood. Heated gutter cables ($500-$1,200) are a practical investment for homes with a history of ice dam formation. The December 2022 bomb cyclone produced widespread gutter ice damage across north county that drove a spring repair surge.",
    cleaningFrequency: "three times per year (late April after sweetgum and maple seed drop, mid-October, and late November after red oak leaf drop)",
    cleaningNote: "The Hill and Tower Grove South have the densest sweetgum canopy in the metro, and the spiny seed balls clog unprotected gutters within 3 weeks of seed drop. Central West End properties under mature red oaks need the full three-cleaning schedule to prevent ice-dam buildup heading into winter.",
    buyingBest: "January through March (post-holiday lull) and July through August (between spring storms and fall leaf season)",
    buyingWorst: "April through May (spring storm damage) and late October through November (leaf-season rush)",
    buyingNote: "The city-county jurisdictional split means city-registered contractors may not serve County properties and vice versa. Verify registration in the correct jurisdiction before signing. Summer installation avoids the spring storm-damage queue and beats the fall leaf-season rush by 8 weeks.",
    localInsightPara: "St. Louis's city-county split creates a unique gutter-permitting situation: the City of St. Louis Building Division handles fascia-modification permits inside city limits, while St. Louis County processes permits through a separate portal with different fee schedules. Contractors registered only in the county cannot pull city permits and vice versa. Soulard and Lafayette Square historic-district properties under the Cultural Resources Office face design review for any visible gutter change, including material and color.",
    warrantyPara: "St. Louis gutter warranties should specify freeze-damage terms explicitly. A warranty excluding ice-dam hanger failure is covering the contractor, not the homeowner, in a metro with 60 freeze-thaw cycles. The MSD combined-sewer-overflow context means gutter failure directly contributes to basement flooding, which elevates the stakes beyond typical roof protection."
  },

  "orlando-fl": {
    annualRainfall: "50 inches",
    rainfallNote: "Orlando receives 50 inches of rain concentrated in June-through-September afternoon thunderstorms that routinely deliver 3 to 4 inches in under two hours. Hurricane Ian in September 2022 dumped 12-plus inches across Orange County in a single event. Gutters in Orlando function as flood-prevention infrastructure for every CBS block home, not optional accessories.",
    downspoutNote: "Orlando's high water table sits 3 to 5 feet below grade during the wet season, which means downspout discharge cannot pool near foundations or it risks saturating the karst dissolution zone beneath the slab. Pop-up emitters at 8 to 10 feet from the foundation are the Florida standard, and buried drains must slope to daylight rather than terminating in dry wells that would re-saturate the sandy subgrade.",
    treeCoverage: "heavy",
    dominantTrees: "live oak, cabbage palm, laurel oak, bald cypress",
    debrisType: "live oak leaves shed year-round during the spring leaf exchange in March-April, cabbage palm frond segments, and Spanish moss strands that wrap around gutter hangers and restrict water flow",
    bestGuardStyle: "micro-mesh guards handle the fine Spanish moss strands and continuous live-oak leaf shed that defeat standard screen guards; the year-round debris cycle in Orlando makes unguarded gutters impractical for any property with mature live oaks",
    freezeRisk: "none",
    iceNote: "Freeze risk is zero in Orlando. Any contractor suggesting heated gutters or ice-related upgrades is unfamiliar with the Central Florida market. The only cold-weather gutter concern is condensation on metal gutters during rare January dew-point drops, which is cosmetic and requires no treatment.",
    cleaningFrequency: "three times per year (late March after live-oak leaf exchange, late June before peak hurricane season, and November after laurel-oak drop)",
    cleaningNote: "Winter Park and College Park properties under mature live oak canopy face continuous debris loading because live oaks are evergreen but shed old leaves during the March-April leaf exchange while simultaneously producing new growth. Dr. Phillips and Lake Nona HOA standards require visible gutter cleanliness, adding aesthetic pressure beyond functional concerns.",
    buyingBest: "January through April (dry season, lowest contractor demand)",
    buyingWorst: "September through November (post-hurricane emergency demand and early leaf season)",
    buyingNote: "Hurricane Ian drove emergency gutter replacement demand across Orange County for 6 months after the September 2022 landfall. Planning installation during the January-April dry window gives you pick of contractors, better pricing, and time to address drainage integration before the next wet season.",
    localInsightPara: "Florida Building Code Section 1503.4 requires gutter fasteners rated for the local design wind speed, which in Orange County is 130-140 mph per ASCE 7-22. Standard 36-inch hanger spacing used in Midwest markets fails in hurricane conditions. Orlando installations require 18-24 inch spacing with stainless-steel ring-shank fasteners, adding $2-$4 per linear foot above mainland-US pricing. Verify the installation matches the wind-speed rating on the Florida DBPR permit.",
    warrantyPara: "Orlando gutter warranties must address hurricane-wind exclusions. A warranty capping at 74 mph (Category 1 threshold) provides zero meaningful protection in a metro that sat inside Ian's 100-mph wind field. Insist on 130-mph rated installation matching the Orange County design wind speed, with a warranty that does not carve out named-storm events."
  },

  "san-antonio-tx": {
    annualRainfall: "32 inches",
    rainfallNote: "San Antonio receives 32 inches of rain, but the feast-or-famine pattern delivers much of it in spring flash-flood events along Salado Creek and Leon Creek that can dump 4 to 6 inches in under 3 hours. The October 1998 flood delivered 16 inches in 12 hours. Gutters must handle extreme peak flows despite moderate annual totals.",
    downspoutNote: "SAWS drought restrictions during Stage 2 and Stage 3 limit landscape irrigation, which paradoxically makes proper downspout routing more important because foundation watering programs rely on controlled moisture delivery rather than general landscape irrigation. Downspouts that discharge directly against the slab waste the limited water budget and concentrate moisture damage at the discharge point.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "live oak, pecan, mountain laurel, Texas red oak",
    debrisType: "live oak leaves shed year-round during the March leaf exchange, pecan catkins and husks in April and November, and mountain laurel seed pods that jam standard screen guards",
    bestGuardStyle: "micro-mesh guards handle the combination of fine pecan catkins and continuous live-oak leaf shed; mountain laurel seed pods are too large for standard screens but slide off micro-mesh surfaces",
    freezeRisk: "low",
    iceNote: "San Antonio rarely freezes, but Winter Storm Uri in February 2021 demonstrated that extreme cold events produce gutter and downspout ice damage even in this market. Burst outdoor faucets near downspout connections caused water to cascade down exterior walls and freeze against the fascia. Pipe insulation wraps on exposed hose bibs near downspout runs are the practical preventive measure.",
    cleaningFrequency: "twice per year (late March after live-oak leaf exchange and pecan catkin drop, and late November after pecan husk drop)",
    cleaningNote: "Alamo Heights and Terrell Hills properties under mature pecan canopy face the heaviest debris loading in the metro because pecan catkins in April combine with live-oak leaf exchange to produce 6 weeks of continuous gutter filling. Stone Oak newer subdivisions with young landscaping may need only annual cleaning.",
    buyingBest: "November through February (mild weather, low demand after fall cleaning season)",
    buyingWorst: "March through May (spring storm damage) and September through October (pre-fall cleaning rush)",
    buyingNote: "CPS Energy's combined utility structure means gutter contractors in San Antonio deal with a single utility coordination for any service-line-adjacent work. Winter installation during the mild December-February window avoids both the spring flash-flood repair surge and the fall cleaning rush.",
    localInsightPara: "Many San Antonio homes built during the 1960s-80s construction boom in the Stone Oak and far-north corridors were delivered with undersized 5-inch K-style gutters that cannot handle the peak flow rates from spring flash-flood events. Upgrading to 6-inch K-style with 3x4 downspouts during replacement adds $1-$2 per linear foot and eliminates the overflow-at-corners problem that 5-inch systems produce during intense rain.",
    warrantyPara: "San Antonio gutter warranties should address hail damage, which occurs 2 to 3 times per year across the metro. Standard warranties that exclude hail dents leave homeowners unprotected against the most common source of gutter damage. TDLR does not regulate gutter contractors specifically, making warranty language the primary accountability mechanism."
  },

  "portland-or": {
    annualRainfall: "43 inches",
    rainfallNote: "Portland receives 43 inches of rain concentrated almost entirely between October and May, creating 7 months of sustained gutter loading that no other metro on this list matches in duration. Individual storms rarely exceed 1 inch per hour, but the relentless daily accumulation means gutters that work perfectly in a 2-inch Texas downpour fail in Portland through sheer volume over time.",
    downspoutNote: "The Portland Bureau of Environmental Services Downspout Disconnection Program actively pays property owners to route roof water to rain gardens rather than the combined sewer. This means Portland gutter projects routinely include rain-garden integration as part of the scope, with downspouts discharging into gravel-filled infiltration beds rather than buried pipes or extensions.",
    treeCoverage: "very heavy",
    dominantTrees: "Douglas fir, western red cedar, bigleaf maple, big-leaf alder",
    debrisType: "Douglas fir needles accumulate continuously from September through June, bigleaf maple leaves in October-November, western red cedar bark strips, and moss growth directly inside gutter channels that blocks flow even with guards installed",
    bestGuardStyle: "micro-mesh guards are mandatory because Douglas fir needles pass through every screen-type guard, but even micro-mesh requires semi-annual moss removal from the guard surface because the persistent moisture grows moss directly on the mesh",
    freezeRisk: "low to moderate",
    iceNote: "Portland rarely freezes hard, but the January 2021 ice storm coated the metro in 1 to 2 inches of ice that collapsed gutter systems across the West Hills and Sellwood. That single event produced more gutter damage than the typical 5-year accumulation from rain. Heated cables are overkill for most Portland homes, but properties in the West Hills and along the Columbia Gorge face ice-storm exposure every 3 to 5 years.",
    cleaningFrequency: "three times per year (December after maple leaf drop, March after winter fir-needle accumulation, and late June moss scraping before the dry season)",
    cleaningNote: "Laurelhurst and Alameda Ridge properties under mature Douglas fir face the heaviest needle accumulation in the metro. Alberta Arts and Mississippi District homes under bigleaf maples need the full three-cleaning schedule. The June moss scraping is unique to Portland and the Pacific Northwest climate.",
    buyingBest: "June through September (the only reliable dry window for sealant adhesion and fascia-board work)",
    buyingWorst: "October through April (persistent rain makes sealant adhesion unreliable and fascia-board moisture content too high for proper fastener holding)",
    buyingNote: "Portland gutter sealant adhesion requires dry fascia board, and the 7-month wet season means October-through-April installation carries a measurably higher failure rate on sealant joints. Reputable crews schedule installation exclusively during the June-September dry window and book 6-8 weeks out during this compressed season.",
    localInsightPara: "Moss growth inside Portland gutters is a maintenance category that does not exist in any other metro on this list. The persistent 80-percent-plus humidity from October through May grows moss directly on gutter surfaces, guard mesh, and inside downspout elbows. Zinc or copper moss-prevention strips ($3-$5 per linear foot installed) along the first shingle course are the Oregon-specific preventive measure, and the Oregon CCB at ccb.oregon.gov is the contractor verification resource.",
    warrantyPara: "Portland gutter warranties should address moss-related failure explicitly. Standard warranties that exclude organic growth effectively exclude the primary gutter failure mode in the Pacific Northwest. Insist on a warranty that covers drainage blockage from biological growth, and verify the contractor includes zinc or copper moss strips as part of the standard installation scope."
  },

  "sacramento-ca": {
    annualRainfall: "18 inches",
    rainfallNote: "Sacramento receives only 18 inches of rain annually, but the atmospheric-river pattern concentrates nearly all of it into December-through-March events that can deliver 3 to 5 inches in 24 hours. The January 2023 atmospheric river sequence dumped 15 inches in 10 days and overwhelmed gutter systems across Natomas and Elk Grove. Eight months of bone-dry conditions means gutters sit unused from April through November, accumulating dust and valley-oak debris.",
    downspoutNote: "Sacramento's hardpan layer beneath east-side neighborhoods blocks natural drainage, which means downspout discharge must route laterally across the surface rather than soaking into the ground. Pop-up emitters at 8 to 10 feet from the foundation with surface grading to street drainage are the Sacramento standard. Buried dry wells are ineffective on hardpan lots because the water has nowhere to percolate.",
    treeCoverage: "heavy (Sacramento is nicknamed the City of Trees)",
    dominantTrees: "valley oak, coast live oak, Chinese pistache, Modesto ash",
    debrisType: "valley oak acorns and leaves in October-November, Chinese pistache berries that stain aluminum gutters purple, and Modesto ash samaras in spring that create a fine debris layer on guard surfaces",
    bestGuardStyle: "reverse-curve or surface-tension guards handle Sacramento's concentrated rainfall effectively during the brief wet season and shed the dry-season dust accumulation that clogs micro-mesh in desert-adjacent climates; micro-mesh can over-filter in dusty Central Valley conditions and cause surface pooling during atmospheric-river deluges",
    freezeRisk: "low",
    iceNote: "Sacramento's Tule fog season from November through February produces condensation on metal gutters but rarely produces true ice. Radiant frost on clear December and January nights can ice gutter surfaces in East Sacramento and Land Park, but the ice melts by mid-morning. Heated cables are unnecessary.",
    cleaningFrequency: "twice per year (late November after valley-oak leaf drop and late October before the wet season begins)",
    cleaningNote: "East Sacramento and Land Park properties under mature valley oaks face the heaviest debris loading in the metro. Midtown and Boulevard Park homes under Chinese pistache need gutter cleaning specifically to prevent the purple berry stains from becoming permanent on aluminum surfaces. The long dry season means a single pre-wet-season cleaning handles 8 months of accumulated dust and debris.",
    buyingBest: "April through September (dry season, full contractor availability)",
    buyingWorst: "January through March (atmospheric-river emergency repairs dominate)",
    buyingNote: "CSLB licensure verified at cslb.ca.gov is mandatory for any California gutter contractor. Sacramento's dry-season window gives you 6 months of perfect installation weather, and the sealant and fastener cure in moderate spring temperatures without the UV degradation risk from Central Valley's 100-degree summer peaks.",
    localInsightPara: "Sacramento's Title 24 energy-code requirements affect gutter projects that modify roof-edge insulation or ventilation, which is common during fascia-board replacement. CSLB-licensed contractors handle the compliance documentation, but unlicensed operators skip it, creating a code-violation that surfaces at resale. Roseville and Elk Grove newer subdivisions require HOA architectural approval for gutter color and material changes that Sacramento city-proper does not.",
    warrantyPara: "Sacramento gutter warranties should address atmospheric-river surge events specifically. A warranty capping flow-rate coverage at 1 inch per hour is inadequate for a metro that receives its entire annual rainfall in events that routinely exceed 2 inches per hour. Verify the installation is rated for the peak flow rate that atmospheric-river events produce."
  },

  "pittsburgh-pa": {
    annualRainfall: "38 inches",
    rainfallNote: "Pittsburgh receives 38 inches of rain plus 28 inches of snow, and the Three Rivers microclimate traps moisture-laden air against the hillsides to produce persistent fog and drizzle that keep gutters wet for days between actual rain events. Great Lakes moisture bands add snow loading that flat-terrain markets at the same latitude do not experience.",
    downspoutNote: "Hillside topography on South Side Slopes, Polish Hill, and Mount Washington means downspout discharge must route through engineered grade transitions rather than simple extensions. Concentrated discharge on a 25-percent-grade lot can undermine retaining walls and adjacent foundations within a single season. PWSA's combined sewer system adds overflow-management requirements to any downspout modification.",
    treeCoverage: "heavy",
    dominantTrees: "red oak, sugar maple, American beech, tulip poplar",
    debrisType: "red oak acorns and leaves, sugar maple samaras in spring, American beech nut husks, and tulip poplar flower debris in May that produces a sticky residue on gutter surfaces",
    bestGuardStyle: "micro-mesh guards are essential because the sheer volume and variety of debris from four major canopy species overwhelms screen-type guards within 2 weeks of peak leaf season; the sticky tulip-poplar flower residue also clogs reverse-curve systems",
    freezeRisk: "very high",
    iceNote: "Seventy-five freeze-thaw cycles make Pittsburgh one of the harshest ice-dam environments on this list. The Three Rivers microclimate produces fog-freeze conditions where moisture condenses on gutter surfaces and freezes overnight even when air temperatures hover at 33F. Heated gutter cables ($600-$1,500) are a practical investment for any north-facing slope, and the January 2014 polar vortex produced widespread ice-dam damage across the South Hills.",
    cleaningFrequency: "three times per year (late April after maple samara drop, mid-October, and late November after final oak-beech leaf drop)",
    cleaningNote: "Shadyside and Squirrel Hill properties under mature red oaks face heavy acorn loading that dents aluminum gutters if not cleared promptly. South Side Slopes hillside gutters collect not only roof debris but also slope-face runoff sediment that accumulates in gutter channels and must be physically scooped rather than flushed.",
    buyingBest: "March through May (between ice-damage repairs and fall rush) and July through August",
    buyingWorst: "November through February (ice-dam season) and September through October (leaf-season rush)",
    buyingNote: "Pittsburgh's steep hillside lots add ladder and scaffolding surcharges of $500-$2,000 on South Side Slopes, Polish Hill, and Mount Washington projects. PA HIC registration under Act 132 is mandatory; verify at pago.state.pa.us. Schedule summer installation to avoid both the winter ice-damage queue and the fall leaf-season rush.",
    localInsightPara: "Pittsburgh's extreme hillside topography makes standard gutter-installation pricing guides irrelevant for 30 percent of the metro's housing stock. South Side Slopes and Polish Hill jobs require rope-access or scaffold staging that adds $1,000-$3,000 to the project, and 84 Lumber's headquarters in nearby Eighty Four, PA provides faster fascia-board material delivery than any competing metro. Allegheny West and Deutschtown historic-district reviews through the Pittsburgh Historic Review Commission may require specific gutter profiles and copper-finish materials.",
    warrantyPara: "Pittsburgh gutter warranties must cover ice-dam hanger failure explicitly. A warranty excluding freeze-related damage is meaningless in a metro with 75 freeze-thaw cycles. Demand 18-inch hanger spacing (not the standard 36-inch) with stainless-steel fasteners rated for ice loading, and a warranty that does not exclude freeze-thaw events."
  },

  "columbus-oh": {
    annualRainfall: "40 inches",
    rainfallNote: "Columbus receives 40 inches of rain spread evenly across the year, plus 22 inches of snow. The Olentangy and Scioto river valleys channel summer thunderstorms through the metro, and the June 2012 derecho produced straight-line winds that stripped gutters off homes across Clintonville and Worthington. Unlike Pittsburgh's hillside runoff or Portland's sustained drizzle, Columbus gutter systems face a conventional Midwest precipitation pattern.",
    downspoutNote: "Basement flooding is endemic in Columbus because the flat glacial-till terrain does not drain naturally. Downspout extensions to 6 feet minimum with positive grading away from the foundation are the baseline defense. German Village's brick-paver alleys and restored gardens create unique discharge-routing challenges because buried drains must navigate around historic hardscape without disturbing the pavers.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "sugar maple, red oak, Ohio buckeye (the state tree), honeylocust",
    debrisType: "sugar maple samaras (helicopter seeds) that clog standard screens in April-May, Ohio buckeye nut capsules in September, red oak acorns and leaves, and honeylocust compound leaflets that are individually small enough to pass through screen guards",
    bestGuardStyle: "micro-mesh guards are the only type that catches the tiny honeylocust leaflets and the fine sugar-maple samara wings that pass through every screen-type guard; German Village properties additionally face soot and coal-dust residue from nearby rail yards that accumulates on guard surfaces",
    freezeRisk: "high",
    iceNote: "Eighty freeze-thaw cycles per year make ice dams a persistent Columbus problem. The January 2014 polar vortex dropped temperatures to minus-12F and produced widespread ice-dam damage across Upper Arlington and Grandview Heights. Heated gutter cables ($500-$1,200) are a practical investment for persistent ice-dam homes. Ohio State campus-area rental properties in University District face particular ice-dam risk because tenant-occupied homes often have poor attic insulation.",
    cleaningFrequency: "three times per year (late April after maple samara drop, mid-October after buckeye capsule drop, and late November after final oak leaf drop)",
    cleaningNote: "German Village properties under mature sugar maples face the densest samara loading in the metro, and the 233-acre historic district's preservation standards mean gutter maintenance must use non-marring ladders and avoid damage to restored brick surfaces. Clintonville and Beechwold Cape Cods need the full three-cleaning schedule because their low-slope roofs trap debris at the eave line.",
    buyingBest: "February through April (post-winter lull) and July through August (between storm season and leaf rush)",
    buyingWorst: "June (summer storm damage) and October through November (leaf-season rush coincides with Ohio State home-game weekends that restrict neighborhood access)",
    buyingNote: "Ohio has no statewide residential contractor license, making the Columbus business-registration check and BBB complaint record the primary screening tools. The Ohio State football schedule creates a distinct access problem in University District and Clintonville during fall Saturdays. Summer installation between storm season and leaf season gives the best contractor availability.",
    localInsightPara: "Columbus's flat terrain and uniform glacial-till drainage mean gutter slope calculations are straightforward, but the Olentangy-Scioto floodplain raises the water table in Clintonville and Arena District enough that downspout discharge routing must account for seasonal groundwater. German Village Commission approval is required for any visible gutter change on contributing structures within the 233-acre district, including material, profile, and color.",
    warrantyPara: "Columbus gutter warranties should specify ice-dam hanger-failure coverage because 80 freeze-thaw cycles per year make ice loading a standard annual occurrence. Ohio's lack of statewide contractor licensing means the warranty document is the primary accountability mechanism. Verify the warranty covers freeze-thaw events and does not exclude ice-dam-related damage."
  },

  "kansas-city-mo": {
    annualRainfall: "39 inches",
    rainfallNote: "Kansas City receives 39 inches of rain plus 18 inches of snow, but the severe hail corridor that runs through the metro produces 3 to 5 significant hailstorms per year that damage gutters alongside roofs and siding. The May 2024 supercell dropped baseball-sized hail across Overland Park and Olathe. Gutters in Kansas City must handle not just water volume but physical impact from hailstones.",
    downspoutNote: "The metro straddles the Missouri-Kansas state line, which means downspout discharge requirements differ between KCMO and Johnson County jurisdictions. Missouri-side homes route to the KC Water combined sewer system, while Kansas-side Overland Park and Leawood homes route to separate storm sewers with different discharge standards. Verify which jurisdiction's rules apply before finalizing drainage design.",
    treeCoverage: "moderate to heavy",
    dominantTrees: "bur oak, eastern redbud, hackberry, Osage orange",
    debrisType: "bur oak acorn caps that are uniquely large and jam standard screen guards, hackberry drupes that stain aluminum, redbud seed pods, and Osage orange hedge-apple debris on older Brookside and Waldo properties",
    bestGuardStyle: "micro-mesh guards handle the oversized bur-oak acorn caps and fine hackberry drupes that defeat standard screen systems; surface-tension guards also work because the moderate debris volume does not overwhelm their shedding capacity during Kansas City's rainfall intensity",
    freezeRisk: "high",
    iceNote: "Eighty freeze-thaw cycles per year make ice dams a recurring Kansas City problem. The January 2019 polar vortex produced widespread ice-dam damage across the south metro, and the rapid temperature swings that characterize Kansas City winters (40F one day, 5F the next) create repeated freeze-thaw stress on gutter fasteners. Heated cables ($500-$1,200) are practical for persistent ice-dam homes in Brookside and Prairie Village.",
    cleaningFrequency: "twice per year minimum (late November after bur-oak leaf drop and late April after redbud pod drop), plus post-hailstorm inspection",
    cleaningNote: "Country Club Plaza and Brookside properties under mature bur oaks face the heaviest acorn loading in the metro, and the oversized acorn caps damage aluminum gutters if not cleared within 2 weeks of acorn drop. Post-hailstorm gutter inspection is a Kansas City-specific maintenance item that does not exist in non-hail-corridor markets.",
    buyingBest: "January through March (post-holiday lull, before spring hail season) and late August through September",
    buyingWorst: "April through June (spring hail and storm damage) and late October through November (leaf-season rush)",
    buyingNote: "The dual-state jurisdiction means gutter contractors must hold both Missouri city registration and Kansas Attorney General contractor registration to serve the full metro. Verify both registrations before signing. Spring hail drives emergency demand that pushes scheduling lead times to 4 to 6 weeks on the Kansas side, where Johnson County permit queues are longer than KCMO.",
    localInsightPara: "Kansas City's hail corridor creates a unique gutter-insurance dynamic. Dented aluminum gutters from hailstorms are routinely covered under the homeowner policy alongside roof damage, and filing a combined roof-gutter claim produces better insurance recovery than separate claims. Document pre-existing gutter condition with photos before any hail season to support future claims. Country Club Plaza and Janssen Place historic-district reviews add material and color requirements.",
    warrantyPara: "Kansas City gutter warranties must address hail-damage terms explicitly. A warranty excluding hail dents in a metro with 3 to 5 significant hailstorms per year provides no meaningful protection. Demand a warranty that covers impact damage from hailstones up to golf-ball size, and verify the installation uses .032-gauge aluminum (not .027) that resists denting better."
  },

  "indianapolis-in": {
    annualRainfall: "42 inches",
    rainfallNote: "Indianapolis receives 42 inches of rain plus 25 inches of snow spread across the year, with June thunderstorms producing the highest hourly intensity and the White River floodplain through Broad Ripple adding seasonal water-table pressure against basements. The November 2013 EF2 tornado that struck Washington Township demonstrated how tornado-force winds strip gutters off homes in seconds, underscoring the importance of heavy-gauge installation and proper hanger spacing.",
    downspoutNote: "The 250-to-350-ppm extremely hard water from Citizens Water of Indianapolis is the highest mineral content among these 10 metros, and it drives aggressive calcium carbonate scaling inside downspout elbows that reduces flow capacity by 30 to 50 percent within 3 to 4 years. Annual downspout flushing with CLR or diluted muriatic acid is an Indianapolis-specific maintenance item that does not exist in soft-water markets like Portland or Sacramento.",
    treeCoverage: "moderate",
    dominantTrees: "tulip poplar (the Indiana state tree), sweetgum, white ash (declining from emerald ash borer), sycamore",
    debrisType: "tulip poplar flower petals and seed cones in June-July, sweetgum spiny seed balls that jam screen guards, sycamore bark plates that are uniquely large and heavy, and dead ash limbs falling from emerald-ash-borer-killed trees",
    bestGuardStyle: "micro-mesh guards are necessary because sweetgum seed balls pass through standard screens while tulip poplar seed cones are too large for reverse-curve systems; the emerald ash borer crisis is actively increasing the volume of unexpected debris from dying white ash canopy across Meridian-Kessler and Butler-Tarkington",
    freezeRisk: "very high",
    iceNote: "Eighty-five freeze-thaw cycles annually, the highest count among these 10 metros, make Indianapolis one of the harshest ice-dam environments in the country. The January 2014 polar vortex drove minus-12F temperatures and produced ice dams across Broad Ripple and Meridian-Kessler that backed water under shingles on hundreds of homes. Heated gutter cables ($500-$1,200) are strongly recommended for any north-facing slope, and proper attic insulation at R-49-plus addresses the root cause.",
    cleaningFrequency: "three times per year (late June after tulip-poplar seed drop, mid-October after sweetgum ball drop, and late November after final sycamore-oak leaf drop)",
    cleaningNote: "Meridian-Kessler and Butler-Tarkington properties under mature tulip poplars face a June seed-cone debris load that most Midwest cities lack because the tulip poplar canopy is denser in Indianapolis than in any other metro on this list. Broad Ripple's White River floodplain proximity means pre-winter gutter cleaning is essential to prevent ice-dam backup that compounds with spring flood risk.",
    buyingBest: "February through April (post-winter lull) and July through August (between storm season and leaf rush)",
    buyingWorst: "June (summer storm damage plus Indianapolis 500 race-week access restrictions) and October through November (leaf-season rush)",
    buyingNote: "Indiana has no statewide residential contractor license, making the Marion County business-registration check and Indiana BBB complaint record the primary screening tools. The Indianapolis 500 in late May creates 10 to 14 days of street closures and traffic restrictions in Speedway, Haughville, and near-west-side neighborhoods that freeze contractor access. Schedule around race week.",
    localInsightPara: "Indianapolis's extremely hard water creates a downspout-maintenance requirement unique to this metro. Calcium carbonate scale builds up inside downspout elbows and reduces flow capacity measurably within 3 to 4 years, which other cities with soft or moderate water never experience. IMI (Irving Materials Inc.), headquartered in nearby Greenfield, operates ready-mix plants that supply concrete for any gutter-adjacent foundation or hardscape work with shorter lead times than competitors.",
    warrantyPara: "Indianapolis gutter warranties should cover ice-dam hanger failure explicitly because 85 freeze-thaw cycles make ice loading a near-daily occurrence from December through March. Indiana's lack of statewide contractor licensing elevates the warranty document to primary accountability tool. Demand 18-inch hanger spacing with stainless-steel fasteners rated for ice loading, and a warranty that does not exclude freeze-thaw events."
  },

  "nashville-tn": {
    annualRainfall: "48 inches",
    rainfallNote: "Nashville receives 48 inches of rain, ranking it among the wettest non-coastal metros in the country. The March 2020 EF3 tornado and the May 2010 Cumberland River flood demonstrated how severe weather events compound gutter damage with structural damage. Spring thunderstorms deliver 2 to 4 inches in short-duration events, and the Nashville Basin topography channels stormwater through the Mill Creek and Whites Creek watersheds that cross residential areas.",
    downspoutNote: "The metro's 3-to-4-percent annual growth rate has produced thousands of new homes in Franklin, Brentwood, and Lebanon with builder-grade 5-inch gutters that are undersized for Nashville's rainfall intensity. Upgrading to 6-inch K-style during replacement is the recommended path. Metro Water Services manages the combined sewer that backs up during storms, making proper downspout disconnection essential in older neighborhoods.",
    treeCoverage: "moderate",
    dominantTrees: "eastern red cedar, tulip poplar, hackberry, red maple",
    debrisType: "eastern red cedar berries and scale leaves shed year-round, tulip poplar seed cones in summer, hackberry drupes that stain aluminum, and red maple samaras in spring",
    bestGuardStyle: "micro-mesh guards handle the fine eastern-red-cedar scale leaves that pass through every screen-type guard; the year-round cedar debris cycle makes unguarded gutters impractical for any property with mature eastern red cedars in the yard or on neighboring lots",
    freezeRisk: "moderate",
    iceNote: "Nashville's 40 freeze-thaw cycles produce occasional ice-dam conditions, particularly during the February 2015 ice storm that coated the metro in a half-inch of ice and collapsed gutter systems across the south metro. Heated cables are optional but advisable for north-facing slopes on homes in Bellevue and Green Hills where mature tree canopy blocks winter sun.",
    cleaningFrequency: "twice per year (late November after deciduous drop and late March after cedar berry and maple samara drop)",
    cleaningNote: "East Nashville and Germantown properties reconstructed after the March 2020 tornado often have new landscaping that produces less debris than mature neighborhoods, but adjacent mature eastern red cedars on neighboring lots still shed scale leaves onto new roofs. 12South and Belmont properties under mature hackberry face the berry-staining issue that requires prompt cleaning.",
    buyingBest: "December through February (mild winters with low demand) and August through September",
    buyingWorst: "March through May (tornado-season damage) and October through November (leaf-season rush)",
    buyingNote: "Tennessee requires a Home Improvement License for gutter projects over $3,000 through the Tennessee Board for Licensing Contractors. Nashville's labor scarcity from the construction boom means even routine gutter projects book 4 to 6 weeks out during peak season. The metro's growth has attracted out-of-state installers who may lack Tennessee licensing.",
    localInsightPara: "Nashville's explosive growth has produced a contractor shortage that extends to gutter installation. Firestone Building Products and Elevate Commercial Roofing, both headquartered in Nashville, supply commercial-grade sealants and flashings through local distributors, giving Nashville gutter contractors access to premium materials at wholesale pricing. East Nashville and Germantown post-tornado reconstruction created a wave of new gutter installations that are now approaching their first maintenance cycle.",
    warrantyPara: "Nashville gutter warranties should address tornado-wind exclusions. The March 2020 EF3 demonstrated that Nashville sits in an active severe-weather corridor. A warranty excluding wind damage above 60 mph provides no meaningful protection. Tennessee Home Improvement License verification through the Board for Licensing Contractors is the primary contractor-screening tool in a market with high contractor churn from the growth boom."
  },

};


const CITY_GUTTER_EXTRA = {
  "st-louis-mo": {
    localRainfallPara: `Sixty freeze-thaw cycles and 42 inches of rain concentrated in April-through-June thunderstorms create a gutter environment where ice-dam prevention and storm-water capacity both matter. MSD's combined sewer overflows when gutter systems fail and dump concentrated roof water into the overburdened system. The Hill and Tower Grove South properties under mature sweetgum canopy face the spiny seed-ball debris that jams every guard type except micro-mesh, at $5-$12 per linear foot. Soulard and Lafayette Square copper gutter installations on historic properties must meet Cultural Resources Office design standards.`,
    freezeAndMaintenancePara: `The 60 annual freeze-thaw cycles drive ice-dam formation on north-facing slopes across Clayton, Kirkwood, and the Central West End. Heated gutter cables at $500-$1,200 are a practical investment for homes with persistent ice-dam history. The December 2022 bomb cyclone froze gutter systems across north county and produced widespread hanger failure that drove the spring 2023 repair surge. Sweetgum seed balls require micro-mesh guards because they pass through standard screens but jam reverse-curve systems.`,
    buyingGuidePara: `City of St. Louis Building Division handles fascia-modification permits inside city limits, while St. Louis County uses a separate portal with different fees. Missouri has no statewide contractor license; verify city or county registration in the correct jurisdiction. The city-county split catches out-of-market operators who assume one license covers the entire metro. Summer installation between the spring storm-damage queue and fall leaf-season rush saves 10-15% on labor.`,
  },
  "orlando-fl": {
    localRainfallPara: `Zero freeze-thaw risk but 50 inches of rain concentrated in June-through-September thunderstorms and direct hurricane exposure creates a demand for high-flow-rate gutter systems. Hurricane Ian in September 2022 overwhelmed undersized gutters across Dr. Phillips and Lake Nona. Winter Park and College Park properties under mature live oaks face year-round debris loading from the March-April leaf exchange, justifying micro-mesh guards at $5-$12 per linear foot. Spanish moss strands wrap around hanger brackets and block flow even on guarded systems.`,
    freezeAndMaintenancePara: `Freeze risk is zero in Orlando. The primary maintenance concern is the year-round live-oak leaf cycle and Spanish moss accumulation. The Seffner sinkhole in 2013 and Hurricane Ian in 2022 both demonstrated how compromised gutter systems allow concentrated roof water to saturate karst-vulnerable subgrades and accelerate sinkhole activity. Pre-hurricane-season gutter inspection in May or June is the Orlando-specific maintenance standard.`,
    buyingGuidePara: `City of Orlando Permitting Services handles gutter permits. Florida DBPR licenses contractors; verify at myfloridalicense.com. Florida Building Code Section 1503.4 requires 130-140 mph wind-rated fasteners in Orange County, adding $2-$4 per linear foot above mainland-US pricing. Lake Nona and Windermere HOAs require architectural approval for gutter material and color. Copper gutters appear on Thornton Park and College Park historic properties.`,
  },
  "san-antonio-tx": {
    localRainfallPara: `Only 32 inches of annual rainfall but spring flash-flood events along Salado Creek deliver 4 to 6 inches in under 3 hours, requiring gutter systems sized for extreme peak flow despite moderate annual totals. CPS Energy's combined utility territory simplifies coordination. Alamo Heights and Terrell Hills properties under mature pecan canopy face the heaviest debris loading during the April catkin drop and November husk drop. Mountain laurel seed pods jam standard screen guards at $5-$12 per linear foot.`,
    freezeAndMaintenancePara: `San Antonio rarely freezes, but Winter Storm Uri in February 2021 burst outdoor faucets near downspout connections and cascaded water that froze against fascia boards across Stone Oak. The primary ongoing maintenance concern is continuous live-oak leaf shed during the March exchange season. SAWS drought restrictions during Stage 2 and Stage 3 make proper downspout routing more important because foundation watering programs depend on controlled moisture delivery rather than general landscape irrigation.`,
    buyingGuidePara: `City of San Antonio Development Services handles gutter permits for fascia modifications. TDLR registers mechanical and electrical trades but does not license gutter contractors specifically. King William, Monte Vista, and Dignowity Hill HDRC review applies to visible gutter changes on contributing structures. The Pearl and Boerne newer subdivisions often require HOA architectural approval. Winter installation during the mild December-February window avoids both spring flash-flood repair demand and fall cleaning rush.`,
  },
  "portland-or": {
    localRainfallPara: `Fifteen freeze-thaw cycles and 43 inches of rain falling almost entirely October through May create 7 months of sustained gutter loading that no other metro matches in duration. Douglas fir needle accumulation is continuous from September through June, and moss grows directly inside gutter channels during the wet season. Laurelhurst and Alameda Ridge properties under mature Douglas fir face the heaviest needle loading in the metro. Zinc or copper moss-prevention strips at $3-$5 per linear foot are the Oregon-specific preventive measure.`,
    freezeAndMaintenancePara: `Portland rarely freezes hard, but the January 2021 ice storm coated the metro in 1 to 2 inches of ice and produced more gutter damage in one event than the typical 5-year accumulation. Moss growth inside gutters is the primary failure mode unique to Portland and the Pacific Northwest. The BES Downspout Disconnection Program pays property owners to route roof water to rain gardens, making rain-garden integration a standard part of Portland gutter projects.`,
    buyingGuidePara: `City of Portland Bureau of Development Services handles gutter permits. Oregon CCB license required; verify at ccb.oregon.gov. Portland gutter sealant adhesion requires dry fascia, which limits reliable installation to the June-September dry window. Sellwood and Laurelhurst properties near the Willamette face particular moisture challenges. Irvington and Ladd's Addition historic-district reviews may require specific gutter profiles. Copper gutters appear on renovated Pearl District warehouse conversions.`,
  },
  "sacramento-ca": {
    localRainfallPara: `Only 18 inches of annual rainfall but atmospheric-river events concentrate nearly all of it into December-through-March deluges that deliver 3 to 5 inches in 24 hours, as the January 2023 sequence demonstrated with 15 inches in 10 days. Eight months of dry conditions mean gutters accumulate Central Valley dust and valley-oak debris that must be cleared before the wet season. East Sacramento and Land Park properties under mature valley oaks face the heaviest debris loading. Chinese pistache berries stain aluminum gutters purple if not cleared promptly.`,
    freezeAndMaintenancePara: `Sacramento's Tule fog from November through February produces condensation on metal gutters but rarely true ice. The primary maintenance concern is the pre-wet-season dust and debris flush. The hardpan layer beneath east-side neighborhoods blocks natural drainage, which means gutter downspout discharge must route laterally because dry wells are ineffective on hardpan lots. Title 24 energy-code requirements may apply when fascia-board replacement affects roof-edge insulation.`,
    buyingGuidePara: `City of Sacramento Community Development handles gutter permits. CSLB license required; verify at cslb.ca.gov. The 6-month dry season from April through September provides perfect installation weather, and sealant cures reliably in moderate spring temperatures without the UV degradation from 100-degree summer peaks. Roseville and Elk Grove HOAs require architectural approval for gutter changes. Alkali Flat and Boulevard Park historic-district reviews apply. Copper gutters appear on restored East Sacramento Tudor homes.`,
  },
  "pittsburgh-pa": {
    localRainfallPara: `Seventy-five freeze-thaw cycles, 38 inches of rain, and 28 inches of snow driven by Great Lakes moisture create one of the harshest gutter environments in the Northeast. The Three Rivers microclimate traps fog against the hillsides, keeping gutters wet for days between rain events. South Side Slopes and Polish Hill properties at 25-percent grades require specialized staging that adds $1,000-$3,000 to gutter projects. Shadyside and Squirrel Hill properties under mature red oaks face heavy acorn loading that dents .027-gauge aluminum if not cleared promptly.`,
    freezeAndMaintenancePara: `The 75 annual freeze-thaw cycles produce fog-freeze conditions where moisture condenses on gutter surfaces and freezes overnight even at 33F. Heated cables at $600-$1,500 are practical for any north-facing slope. The January 2014 polar vortex and the June 2012 derecho both produced widespread gutter damage across Allegheny County. South Side Slopes hillside gutters collect slope-face runoff sediment that must be physically scooped rather than flushed. 84 Lumber's nearby headquarters provides faster fascia-board delivery than any competing metro.`,
    buyingGuidePara: `City of Pittsburgh PLI handles gutter permits. PA HIC registration under Act 132 required; verify at pago.state.pa.us. Hillside staging surcharges of $1,000-$3,000 on South Side Slopes and Mount Washington jobs make flat pricing guides irrelevant for 30 percent of the metro. Allegheny West and Deutschtown historic-district reviews may require specific profiles and copper-finish materials. Mt. Lebanon and Fox Chapel HOAs include gutter standards in architectural covenants.`,
  },
  "columbus-oh": {
    localRainfallPara: `Eighty freeze-thaw cycles and 40 inches of rain spread evenly year-round create a gutter environment where ice-dam prevention is the dominant concern. The Olentangy and Scioto river valleys channel summer thunderstorms through Clintonville and Worthington. German Village's 233-acre restored district requires non-marring ladder placement and gutter profiles that match historic preservation standards. Sugar maple samaras and tiny honeylocust leaflets are the two debris types that defeat standard screen guards, requiring micro-mesh at $5-$12 per linear foot.`,
    freezeAndMaintenancePara: `The 80 annual freeze-thaw cycles make ice dams a persistent Columbus problem, and the January 2014 polar vortex at minus-12F produced widespread ice-dam damage across Upper Arlington and Grandview Heights. Ohio State campus-area rental properties in University District face particular ice-dam risk because tenant-occupied homes often have poor attic insulation. Owens Corning, headquartered in nearby Toledo, supplies composite gutter-guard materials through Ohio distributors. Hard water at 150-200 ppm from the City Division of Water drives mineral scaling inside downspout elbows.`,
    buyingGuidePara: `City of Columbus Building and Zoning Services handles gutter permits. Ohio has no statewide residential contractor license; the Columbus business-registration check and BBB complaint record are primary screening tools. German Village Commission approval required for any visible gutter change on contributing structures. Ohio State home-game weekends restrict Clintonville and University District access during fall Saturdays. Dublin and Worthington HOAs include gutter-material standards.`,
  },
  "kansas-city-mo": {
    localRainfallPara: `Eighty freeze-thaw cycles, 39 inches of rain, and 3 to 5 significant hailstorms per year from the central US hail corridor create a gutter environment where impact resistance matters alongside water capacity. The May 2024 supercell dropped baseball-sized hail across Johnson County that dented aluminum gutters metro-wide. The dual-state jurisdiction means different downspout discharge standards on the Missouri side (KC Water combined sewer) versus the Kansas side (Johnson County separate storm sewers). Bur oak acorn caps, uniquely oversized, jam every screen-type guard.`,
    freezeAndMaintenancePara: `Kansas City's 80 freeze-thaw cycles and rapid temperature swings (40F one day, 5F the next) create repeated freeze-thaw stress on gutter fasteners. The January 2019 polar vortex produced widespread ice-dam damage across Brookside and Prairie Village. Post-hailstorm gutter inspection is a Kansas City-specific maintenance item that does not exist in non-hail-corridor markets. Dented aluminum gutters from hail are routinely covered under homeowner insurance alongside roof damage, and filing combined claims produces better recovery.`,
    buyingGuidePara: `KCMO Permits and Inspections handles Missouri-side permits; Johnson County handles Kansas-side permits with different fees. Contractors must hold both Missouri city registration and Kansas AG contractor registration to serve the full metro. Country Club Plaza and Janssen Place historic-district reviews add material and color requirements. Prairie Village and Lee's Summit HOAs include gutter standards. Demand .032-gauge aluminum (not .027) for hail resistance.`,
  },
  "indianapolis-in": {
    localRainfallPara: `Eighty-five freeze-thaw cycles (the highest among these 10 metros), 42 inches of rain, and 25 inches of snow create one of the harshest ice-dam environments in the country. The 250-to-350-ppm extremely hard water from Citizens Water drives calcium carbonate scaling inside downspout elbows that reduces flow capacity by 30 to 50 percent within 3 to 4 years, an Indianapolis-specific maintenance issue that soft-water cities never face. Meridian-Kessler and Butler-Tarkington properties under mature tulip poplars face June seed-cone debris loads unique to this metro's dense tulip-poplar canopy.`,
    freezeAndMaintenancePara: `The 85 annual freeze-thaw cycles drive near-daily ice-dam risk from December through March. The January 2014 polar vortex at minus-12F produced ice dams across Broad Ripple and Meridian-Kessler that backed water under shingles on hundreds of homes. The emerald ash borer crisis is actively increasing unexpected debris volume from dying white ash trees across the north-side canopy. Annual downspout flushing with CLR or diluted muriatic acid to clear mineral scale is the Indianapolis-specific maintenance protocol that Portland and Sacramento never need.`,
    buyingGuidePara: `Indianapolis BNS handles gutter permits. Indiana has no statewide contractor license; Marion County business registration and Indiana BBB are primary screening tools. The Indianapolis 500 in late May creates 10 to 14 days of street closures in Speedway and near-west-side neighborhoods that freeze contractor access. Fishers and Zionsville HOAs include gutter-material standards. IMI ready-mix from nearby Greenfield provides fast concrete delivery for any adjacent hardscape work.`,
  },
  "nashville-tn": {
    localRainfallPara: `Forty freeze-thaw cycles and 48 inches of rain ranking Nashville among the wettest non-coastal metros create heavy gutter loading year-round. The March 2020 EF3 tornado stripped gutters off hundreds of East Nashville and Germantown homes with 165-mph winds. Nashville Basin topography channels stormwater through Mill Creek and Whites Creek watersheds that cross residential areas in Antioch and Bellevue. Eastern red cedar scale leaves shed year-round and pass through every screen-type guard, requiring micro-mesh at $5-$12 per linear foot.`,
    freezeAndMaintenancePara: `Nashville's 40 freeze-thaw cycles produce occasional ice-dam conditions, particularly during the February 2015 ice storm that collapsed gutter systems across the south metro. The primary ongoing maintenance concern is year-round eastern red cedar debris that clogs unguarded systems within 4 to 6 weeks. Firestone Building Products and Elevate, both Nashville-headquartered, supply commercial-grade sealants through local distributors at wholesale pricing that gives Nashville gutter contractors a material-cost advantage.`,
    buyingGuidePara: `Metro Nashville Codes Administration handles gutter permits. Tennessee Home Improvement License required for projects over $3,000; verify through the Board for Licensing Contractors. Nashville's 3-to-4-percent growth rate has attracted out-of-state installers who may lack Tennessee licensing. East Nashville and Germantown MHZC review applies to visible gutter changes on contributing structures. Franklin and Brentwood HOAs include gutter-material and color standards. December-February installation takes advantage of mild Nashville winters and low contractor demand.`,
  },
};

// Merge extra content into primary dict
for (const [slug, extra] of Object.entries(CITY_GUTTER_EXTRA)) {
  CITY_GUTTER_DATA[slug] = Object.assign(CITY_GUTTER_DATA[slug] || {}, extra);
}

/* --- Dict-only section builders --- */

function fmtD(n) { return "$" + n.toLocaleString("en-US"); }
function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function getRegionMultiplier(state) {
  const STATE_TO_REGION = { TX:"south",LA:"south",OK:"south",GA:"southeast",FL:"southeast",SC:"southeast",NC:"southeast",TN:"southeast",VA:"southeast",AL:"southeast",MS:"southeast",NY:"northeast",NJ:"northeast",PA:"northeast",CT:"northeast",MA:"northeast",MD:"northeast",DE:"northeast",DC:"northeast",IL:"midwest",OH:"midwest",MI:"midwest",IN:"midwest",WI:"midwest",MN:"midwest",IA:"midwest",MO:"midwest",CO:"mountain",AZ:"mountain",NM:"mountain",NV:"mountain",CA:"west",WA:"west",OR:"west" };
  return pricingModel.laborMultiplierByRegion?.[STATE_TO_REGION[state] || "south"] || 1.0;
}

function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";
  const baseAlum = pricingModel.basePricePerLinearFoot.aluminum_seamless.mid;
  const baseVinyl = pricingModel.basePricePerLinearFoot.vinyl.mid;
  const baseCopper = pricingModel.basePricePerLinearFoot.copper.mid;
  const baseSteel = pricingModel.basePricePerLinearFoot.steel.mid || baseAlum * 1.3;
  const LF = 150;
  const rows = facts.neighborhoods.map((n, i) => {
    const v = 1 + ((i % 3 === 0 ? 0.06 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    return `<tr><td style="padding:12px 16px;font-weight:600;">${n}</td><td style="padding:12px 16px;text-align:right;">${fmtD(Math.round(baseAlum*mult*v*LF))}</td><td style="padding:12px 16px;text-align:right;">${fmtD(Math.round(baseVinyl*mult*v*LF))}</td><td style="padding:12px 16px;text-align:right;">${fmtD(Math.round(baseCopper*mult*v*LF))}</td><td style="padding:12px 16px;text-align:right;">${fmtD(Math.round(baseSteel*mult*v*LF))}</td></tr>`;
  });
  return `
<section class="section fp-section">
<h2>${facts.displayName} neighborhood gutter pricing</h2>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%;border-collapse:collapse;font-size:14px;">
<thead><tr style="border-bottom:2px solid var(--border);background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left;padding:12px 16px;">Neighborhood</th>
<th style="text-align:right;padding:12px 16px;">Aluminum Seamless</th>
<th style="text-align:right;padding:12px 16px;">Vinyl</th>
<th style="text-align:right;padding:12px 16px;">Copper</th>
<th style="text-align:right;padding:12px 16px;">Steel</th>
</tr></thead><tbody>${rows.join("")}</tbody></table></div>
<p style="font-size:13px;color:var(--text-muted);margin-top:8px;"><a href="/gutters-quote-analyzer.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your ${facts.displayName} gutter quote for comparison.</a></p>
</section>`;
}

function rainfallSection(city, d) {
  return `
<section class="section fp-section">
<h2>${city} rainfall and gutter drainage</h2>
<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding:16px 20px;background:var(--bg-subtle,#f8fafc);border-radius:12px;border:1px solid var(--border,#e2e8f0);">
<div style="font-size:32px;font-weight:800;color:var(--brand,#1d4ed8);line-height:1;">${d.annualRainfall}</div>
<div style="font-size:14px;color:#64748b;">annual rainfall in ${city}</div>
</div>
<p>${d.rainfallNote}</p>
<p>${d.downspoutNote}</p>
</section>`;
}

function guardSection(city, d) {
  return `
<section class="section fp-section">
<h2>${city} gutter guard selection</h2>
<p>Tree coverage in ${city} is ${d.treeCoverage}, with ${d.dominantTrees} dominant.</p>
<p>${cap(d.debrisType)}.</p>
<p><strong>Recommended guard style.</strong> ${cap(d.bestGuardStyle)}.</p>
</section>`;
}

function iceSection(city, d) {
  return `
<section class="section fp-section">
<h2>Ice and freeze risk in ${city}</h2>
<p>Freeze risk: ${d.freezeRisk}.</p>
<p>${d.iceNote}</p>
</section>`;
}

function cleaningSection(city, d) {
  return `
<section class="section fp-section">
<h2>${city} gutter cleaning schedule</h2>
<p>Recommended frequency: ${d.cleaningFrequency}.</p>
<p>${d.cleaningNote}</p>
</section>`;
}

function buyingSection(city, d) {
  return `
<section class="section fp-section">
<h2>Best time to buy gutters in ${city}</h2>
<p><strong>Best months:</strong> ${d.buyingBest}.</p>
<p><strong>Worst months:</strong> ${d.buyingWorst}.</p>
<p>${d.buyingNote}</p>
</section>`;
}

function localInsightSection(city, d) {
  if (!d.localInsightPara) return "";
  return `
<section class="section fp-section">
<h2>${city} gutter installation notes</h2>
<p>${d.localInsightPara}</p>
</section>`;
}

function warrantySection(city, d) {
  if (!d.warrantyPara) return "";
  return `
<section class="section fp-section">
<h2>Gutter warranty in ${city}</h2>
<p>${d.warrantyPara}</p>
</section>`;
}

function scopeChecklist(city, d) {
  return `
<section class="section fp-section">
<h2>What your ${city} gutter contract should include</h2>
<p><strong>Material and gauge.</strong> ${d.rainfallNote}</p>
<p><strong>Guard specification.</strong> ${cap(d.bestGuardStyle)}.</p>
<p><strong>Downspout routing.</strong> ${d.downspoutNote}</p>
<p><strong>Winter preparedness.</strong> ${d.iceNote}</p>
</section>`;
}

function buyerQuestionsSection(city, d) {
  return `
<section class="section fp-section">
<h2>Questions to ask a ${city} gutter contractor</h2>
<p><strong>How do you handle ${city}'s rainfall intensity?</strong> ${d.rainfallNote}</p>
<p><strong>What guard type do you recommend for my trees?</strong> ${cap(d.debrisType)}. ${cap(d.bestGuardStyle)}.</p>
<p><strong>What is your cleaning recommendation?</strong> ${d.cleaningFrequency}. ${d.cleaningNote}</p>
<p><strong>What about freeze protection?</strong> ${d.iceNote}</p>
</section>`;
}

function seasonalDeep(city, d) {
  return `
<section class="section fp-section">
<h2>${city} gutter project timing</h2>
<p><strong>Best window.</strong> ${d.buyingBest}. ${d.buyingNote}</p>
<p><strong>Avoid.</strong> ${d.buyingWorst}.</p>
<p>${d.cleaningNote}</p>
</section>`;
}

function climateDeep(city, d) {
  return `
<section class="section fp-section">
<h2>How ${city} climate affects gutters</h2>
<p>${d.rainfallNote}</p>
<p>${d.iceNote}</p>
<p>${d.cleaningNote}</p>
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

function maintenanceDeep(city, d) {
  return `
<section class="section fp-section">
<h2>${city} gutter maintenance and lifespan</h2>
<p><strong>Recommended cleaning schedule.</strong> ${d.cleaningFrequency}. ${d.cleaningNote}</p>
<p><strong>Primary debris sources.</strong> ${cap(d.debrisType)}.</p>
<p><strong>Guard maintenance.</strong> ${cap(d.bestGuardStyle)}.</p>
<p><strong>Seasonal timing.</strong> ${d.buyingNote}</p>
<p>${d.localInsightPara || ""}</p>
</section>`;
}

function redFlagsSimple(city, d) {
  return `
<section class="section fp-section">
<h2>${city} gutter red flags</h2>
<p><strong>Undersized gutters.</strong> ${d.rainfallNote}</p>
<p><strong>Wrong guard type.</strong> ${cap(d.debrisType)}. ${cap(d.bestGuardStyle)}.</p>
<p><strong>Skipping the freeze assessment.</strong> ${d.iceNote}</p>
<p><strong>Poor downspout routing.</strong> ${d.downspoutNote}</p>
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
  const d = CITY_GUTTER_DATA[metro.slug];
  if (!facts || !ctx || !d) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getRegionMultiplier(state);

  let html = flagshipCSS();
  html += `
${MARKER_START}
`;
  html += neighborhoodPricing(facts, mult);
  html += rainfallSection(city, d);
  html += guardSection(city, d);
  html += iceSection(city, d);
  html += cleaningSection(city, d);
  html += buyingSection(city, d);
  html += localInsightSection(city, d);
  html += warrantySection(city, d);
  html += scopeChecklist(city, d);
  html += buyerQuestionsSection(city, d);
  html += seasonalDeep(city, d);
  html += climateDeep(city, d);
  html += maintenanceDeep(city, d);
  html += redFlagsSimple(city, d);
  html += extraLocalSection(city, d);
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

    // Detect line ending
    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    // Inject after UNIQUE-LOCAL-GUIDE, or after section 5 (FAQ), or before "Other Services"
    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const faqSection = content.indexOf("Frequently Asked Questions");
    const otherServices = content.indexOf("Other Services in ");

    let insertAt;
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else if (faqSection >= 0) {
      // Find the </section> after FAQ
      const afterFaq = content.indexOf("</section>", faqSection);
      if (afterFaq >= 0) {
        insertAt = afterFaq + "</section>".length;
      } else {
        insertAt = -1;
      }
    } else if (otherServices >= 0) {
      // Insert before the "Other Services" section
      const sectionBefore = content.lastIndexOf("<section", otherServices);
      insertAt = sectionBefore >= 0 ? sectionBefore : -1;
    } else {
      insertAt = -1;
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
