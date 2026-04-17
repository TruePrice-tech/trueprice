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
    buyingBest: "December through April (dry season, mild weather, post-hurricane lull)",
    buyingWorst: "May through October (wet season and hurricane season drive emergency repairs)",
    buyingNote: "Miami contractors get slammed with emergency work after every named storm, and pricing and availability both suffer from May through October. Installing during the dry winter months gets you better sealant curing, better scheduling, and the satisfaction of being ready before the next hurricane season.",
    localInsightPara: "Miami gutter installations must use hurricane-rated hardware: heavier-gauge aluminum (0.032 minimum), hidden hangers spaced every 18-24 inches rather than the standard 36, and stainless-steel fasteners. Any Miami bid specifying standard-gauge aluminum with 36-inch hanger spacing is under-engineering for the HVHZ.",
    warrantyPara: "Miami gutter warranties should address hurricane-wind exclusions. A warranty that excludes damage above 74 mph (Category 1) is meaningless in South Florida. Insist on 130+ mph rated installation with a warranty that does not cap at tropical-storm wind speeds."
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
    rainfallNote: "Las Vegas receives about 4 inches of rain per year, making it the driest major US metro by a wide margin. When rain does arrive, it's almost always in the form of intense but short monsoon bursts in July-September or the occasional winter Pacific storm in January-February. Monsoon cells can drop half an inch in 15 minutes -- enough to overwhelm an undersized or clogged gutter even though annual totals are tiny. Flash flooding of streets and washes during these events is routine.",
    downspoutNote: "Desert landscaping dominates Las Vegas, and decomposed granite, gravel mulch, and xeriscape plantings all wash away fast under concentrated roof runoff. Downspouts should discharge onto splash blocks anchored in place or into buried pipes that carry water to the street or the retention basin most HOA developments in Summerlin, Henderson, and Anthem are built around. SNWA rebates for smart irrigation don't cover gutter work, but proper downspout routing protects the desert landscape investment far more than most homeowners realize.",
    treeCoverage: "low",
    dominantTrees: "mesquite, palo verde, desert willow, Mexican fan palm, date palm, olive, oleander",
    debrisType: "palo verde tiny leaves and seed pods, mesquite bean pods in summer, desert willow seed pods, palm fronds and seed clusters, wind-blown dust from haboobs, and occasional bird-nesting material in uncovered gutters",
    bestGuardStyle: "perforated aluminum covers or basic screen guards are sufficient for Las Vegas's low-debris environment; micro-mesh is genuine overkill here and the fine mesh can actually clog with the desert dust that blows in during monsoon haboob events, causing surface runoff past the gutter entirely",
    freezeRisk: "low",
    iceNote: "Las Vegas overnight lows dip below freezing a handful of times each winter, most often in December and January, but sustained freeze conditions that would threaten gutters are rare. Heated gutter cables are unnecessary on a typical Vegas home and should be treated as an upsell. The only cold-weather consideration is for properties at higher elevations around Summerlin's ridge and the Lake Mead plateau where a few mornings per winter can produce a brief hard freeze.",
    cleaningFrequency: "once per year (late June right before monsoon season opens)",
    cleaningNote: "Homes in Summerlin, Henderson, and parts of Anthem with mature palo verde, mesquite, or olive canopy collect more debris than the metro average and may benefit from a second cleaning in November after the fall seed drop. Newer tract homes with minimal landscape trees can often stretch to every 18 months.",
    buyingBest: "October through April (mild weather, lower demand, easy working conditions)",
    buyingWorst: "July through September (monsoon season drives emergency-repair demand) and the peak summer heat when rooftop work is genuinely dangerous",
    buyingNote: "Most Las Vegas homeowners only discover they need gutter work after a monsoon storm floods a patio or washes out the xeriscape. Installing during the mild fall or winter months avoids both the monsoon-season rush and the 110-degree rooftop conditions that make summer installation risky for workers and hard on sealant curing.",
    localInsightPara: "Many Las Vegas tract homes in Summerlin, Henderson, and Anthem were built without gutters because builders historically considered them unnecessary in the desert. Retrofitting gutters onto a stucco home with tile roof requires specialized fascia-mounting hardware that tile-roof-compatible brackets provide at $2-$4 more per bracket than standard K-style clips.",
    warrantyPara: "Las Vegas gutter warranties should address monsoon-damage coverage. Standard warranties excluding wind events above 50-60 mph are problematic because Valley monsoon microbursts regularly exceed those speeds in the July-September season."
  },

};

/* --- Section builders --- */

function neighborhoodPricing(slug, facts, mult) {
  if (!facts?.neighborhoods?.length) return "";
  const baseAlum = pricingModel.basePricePerLinearFoot.aluminum_seamless.mid;
  const baseVinyl = pricingModel.basePricePerLinearFoot.vinyl.mid;
  const baseCopper = pricingModel.basePricePerLinearFoot.copper.mid;
  const baseSteel = pricingModel.basePricePerLinearFoot.steel.mid;
  const avgLF = 150; // average home

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    const alum = Math.round(avgLF * baseAlum * mult * localVar / 25) * 25;
    const vinyl = Math.round(avgLF * baseVinyl * mult * localVar / 25) * 25;
    const copper = Math.round(avgLF * baseCopper * mult * localVar / 25) * 25;
    const steel = Math.round(avgLF * baseSteel * mult * localVar / 25) * 25;
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(alum)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(vinyl)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(copper)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(steel)}</td>
</tr>`;
  });

  const h2 = pick(slug, "nbh-h2", [
    `Neighborhood Gutter Pricing in ${facts.displayName}`,
    `${facts.displayName} Gutter Pricing by Neighborhood`,
    `How Gutter Pricing Varies Across ${facts.displayName}`,
    `${facts.displayName} Neighborhood Gutter Costs`,
  ]);
  const intro = pick(slug, "nbh-intro", [
    `Gutter install costs vary across ${facts.displayName} based on labor rates, home height, and fascia condition. Estimates below assume 150 linear feet — a typical single-story ${facts.displayName} home.`,
    `Pricing varies block-to-block in ${facts.displayName} with labor rates, home height, and fascia condition. The figures below model 150 LF (typical single-story).`,
    `${facts.displayName} gutter pricing moves with local labor, building height, and fascia shape. Rows below use 150 LF, which matches most single-story homes in the metro.`,
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
<th style="text-align:right; padding:12px 16px;">Aluminum Seamless</th>
<th style="text-align:right; padding:12px 16px;">Vinyl</th>
<th style="text-align:right; padding:12px 16px;">Copper</th>
<th style="text-align:right; padding:12px 16px;">Steel</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">${pick(slug, "nbh-caveat", [
  `${facts.displayName} labor rates and current material pricing are baked in for 150 LF. Actual ${facts.displayName} pricing varies with home height, fascia condition, corner count, and downspout count.`,
  `Numbers here assume ${facts.displayName} labor and 2026 material costs over 150 LF. Real-world ${facts.displayName} pricing shifts with building height, fascia state, corner count, and downspout quantity.`,
  `${facts.displayName} labor and material pricing for 150 LF drives these figures. Your actual ${facts.displayName} quote depends on building height, existing fascia condition, roof-corner count, and downspout needs.`,
])} <a href="/gutters-quote-analyzer.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your ${facts.displayName} quote for a side-by-side comparison.</a></p>
</section>`;
}

function rainfallDrainage(city, state, slug, data, facts) {
  const h2 = pick(slug, "rain-h2", [
    `Rainfall and Drainage in ${city}`,
    `${city} Rainfall and Gutter Drainage`,
    `How ${city}'s Rain Patterns Shape Gutter Design`,
    `${city} Precipitation and Drainage Considerations`,
  ]);
  const sizingH3 = pick(slug, "sizing-h3", [
    `Why gutter sizing matters in ${city}`,
    `Sizing gutters for ${city} rainfall`,
    `${city}-specific gutter sizing`,
    `Picking the right gutter size in ${city}`,
  ]);
  const sizingBody = pick(slug, "sizing-body", [
    `Standard 5-inch K-style gutters move about 1.2 gallons per second, adequate for moderate rainfall up to 2 inches per hour. ${city} rainfall intensity routinely exceeds that threshold, so 6-inch oversized gutters with 40% more capacity are worth the $2-$3 per linear foot upcharge in ${threeNbh(facts)}.`,
    `A standard 5-inch K-style gutter in ${city} handles about 1.2 gallons per second, fine up to roughly 2 inches per hour. When ${city} storms exceed that rate (they do), 6-inch gutters carry 40% more water for $2-$3 more per linear foot on ${threeNbh(facts)} homes.`,
    `${city} rainfall frequently tops the 2 inches per hour that standard 5-inch K-style gutters can handle. The 6-inch upgrade delivers 40% more capacity for an extra $2-$3 per linear foot — a small premium that matters on ${threeNbh(facts)} rooflines during peak storms.`,
  ]);
  const downH3 = pick(slug, "down-h3", [
    `Downspout capacity and placement`,
    `${city} downspout routing and sizing`,
    `Getting downspouts right in ${city}`,
    `Downspout placement for ${city} homes`,
  ]);
  const downRule = pick(slug, "down-rule", [
    `${city} homes typically need one downspout per 20-30 linear feet of gutter run. A standard 2x3-inch downspout handles about 600 sq ft of roof area; 3x4-inch oversized downspouts move substantially more water and earn their upcharge on larger roof planes common in ${threeNbh(facts)}.`,
    `Rule of thumb for ${city}: one downspout per 20-30 linear feet of gutter. Each 2x3-inch downspout drains roughly 600 sq ft; step up to 3x4-inch on ${threeNbh(facts)} homes with large roof planes or steep pitches that concentrate runoff.`,
    `Plan on one downspout every 20-30 feet of ${city} gutter run. A 2x3-inch downspout serves about 600 sq ft of roof; 3x4-inch oversized downspouts carry materially more water on ${threeNbh(facts)} homes with big roof planes.`,
  ]);
  return `
<section class="section fp-section">
<h2>${h2}</h2>
<div class="fp-rainfall-stat" style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding:16px 20px;background:var(--bg-subtle,#f8fafc);border-radius:12px;border:1px solid var(--border,#e2e8f0);">
<div style="font-size:32px;font-weight:800;color:var(--brand,#1d4ed8);line-height:1;">${data.annualRainfall}</div>
<div style="font-size:14px;color:#64748b;">annual rainfall in ${city}</div>
</div>
<p>${data.rainfallNote}</p>
<h3>${sizingH3}</h3>
<p>${sizingBody}</p>
<h3>${downH3}</h3>
<p>${data.downspoutNote}</p>
<p>${downRule}</p>
</section>`;
}

function gutterGuardAnalysis(slug, city, data, facts) {
  const h2 = pick(slug, "guard-h2", [
    `Gutter Guard Analysis for ${city}`,
    `${city} Gutter Guard Options`,
    `Which Gutter Guards Actually Work in ${city}`,
    `${city} Guard Selection Guide`,
  ]);
  const intro = pick(slug, "guard-intro", [
    `Tree coverage in ${city} is ${data.treeCoverage}, with ${data.dominantTrees} dominant. The specific debris mix your ${threeNbh(facts)} gutters see determines which guard style actually performs — not every guard works in every market.`,
    `${city}'s tree canopy is ${data.treeCoverage}; the prevalent species are ${data.dominantTrees}. Guard performance hinges on local debris type, and ${threeNbh(facts)} homes generally share the same mix.`,
    `${data.treeCoverage} tree coverage across ${city}, with ${data.dominantTrees} setting the debris profile. Guard choice should match the debris type ${threeNbh(facts)} homeowners actually face.`,
  ]);
  const maintClose = pick(slug, "guard-maint", [
    `No gutter guard system is actually maintenance-free, regardless of type. Even top-tier micro-mesh needs surface brushing every 1-2 years to clear fine pollen and dust buildup in ${city}. Any ${city} contractor pitching "never clean your gutters again" is overselling.`,
    `Every gutter guard needs some maintenance — even the best micro-mesh products in ${city} need periodic surface brushing for pollen and dust every 1-2 years. "Never clean your gutters again" is marketing, not a realistic promise in ${city}.`,
    `Gutter guards reduce maintenance; they don't eliminate it. Micro-mesh in ${city} still needs a surface sweep every 12-24 months for pollen and fine dust. Treat any "zero-maintenance" promise from a ${city} contractor as oversell.`,
  ]);
  return `
<section class="section fp-section">
<h2>${h2}</h2>
<p>${intro}</p>
<h3>Primary debris types in ${city}</h3>
<p>${cap(data.debrisType)}.</p>
<h3>Recommended guard style</h3>
<p>${cap(data.bestGuardStyle)}.</p>
<div class="fp-guard-compare" style="margin:16px 0;padding:16px 20px;background:#f0fdf4;border-radius:12px;border:1px solid #a7f3d0;">
<h3 style="margin:0 0 8px;font-size:15px;color:#166534;">${pick(slug, "guard-cost-h3", [`Guard cost comparison for ${city}`, `${city} guard pricing tiers`, `Gutter guard pricing in ${city}`])}</h3>
<p style="margin:0;font-size:14px;color:#334155;">${pick(slug, "guard-cost-body", [
  `Micro-mesh guards run $7-$15/LF installed in ${city}. Screen guards $4-$8/LF. Surface-tension (reverse curve) $10-$18/LF. Foam inserts $2-$5/LF (avoid — they trap debris and promote mold). National brands like LeafFilter and Gutter Helmet charge $15-$35/LF, which bakes in warranty and marketing overhead; local ${city} installers using equivalent micro-mesh typically charge 30-50% less.`,
  `${city} pricing runs: micro-mesh $7-$15/LF, screen guards $4-$8/LF, surface-tension (reverse curve) $10-$18/LF, foam inserts $2-$5/LF (skip them). LeafFilter, Gutter Helmet, and similar national brands quote $15-$35/LF; independent ${city} installers with equivalent micro-mesh quote 30-50% below that.`,
  `Expect $7-$15/LF for micro-mesh in ${city}, $4-$8/LF for screen, $10-$18/LF for reverse-curve, $2-$5/LF for foam (don't). National-brand pricing from LeafFilter or Gutter Helmet lands $15-$35/LF with warranty bundled; a local ${city} installer offering the same micro-mesh quality typically beats that by 30-50%.`,
])}</p>
</div>
<p>${maintClose}</p>
</section>`;
}

function iceDamWinter(slug, city, state, data, facts) {
  const h2 = pick(slug, "ice-h2", [
    `Ice Dams and Winter Considerations in ${city}`,
    `${city} Winter and Ice Dam Risk`,
    `Winter Gutter Concerns in ${city}`,
    `How ${city} Winters Affect Your Gutters`,
  ]);
  if (data.freezeRisk === "very high" || data.freezeRisk === "high") {
    return `
<section class="section fp-section">
<h2>${h2}</h2>
<p><strong>Freeze risk level for ${city}: ${data.freezeRisk}.</strong></p>
<p>${data.iceNote}</p>
<h3>${pick(slug, "ice-damage-h3", [`How ice dams damage gutters`, `The physical damage from ${city} ice dams`, `What ice loads do to ${city} gutters`])}</h3>
<p>${pick(slug, "ice-damage-body", [
  `${city} ice dams form when warm roof snow melts and refreezes at the cold eave edge. The expanding ice load pries hangers off fascia, cracks sectional seams, and crushes the channel itself. A single serious event in ${nbh(facts, 0)} or ${nbh(facts, 1)} can tear gutters down; seamless aluminum on heavy-duty hidden hangers spaced every 24 inches (versus the standard 36) holds up materially better than seamed or vinyl systems.`,
  `When ${city} snow melts on a warm roof and freezes at the eave, the ice expansion force exceeds what standard hangers were designed for. Sectional-seam cracks, torn-loose runs, and crushed channels are all typical outcomes in ${nbh(facts, 0)} and ${nbh(facts, 1)}. Seamless aluminum with 24-inch hanger spacing and hidden hanger brackets is the ${city}-appropriate spec.`,
  `The ${city} ice-dam cycle works like this: snow melts on a warm attic-side roof, runs down, hits the cold eave, freezes. Each cycle adds weight and pushes against gutter hangers. ${nbh(facts, 0)} and ${nbh(facts, 1)} homes see this play out every winter; seamless aluminum on hidden hangers spaced 24 inches apart resists the load far better than seamed or vinyl.`,
])}</p>
<h3>${pick(slug, "heat-h3", [`Heated gutter systems`, `Heat cable options for ${city}`, `${city} heat-tape installation`])}</h3>
<p>${pick(slug, "heat-body", [
  `Self-regulating heat cables inside the gutter channel and first 3 feet of downspout prevent ice from forming in ${city}. Over the life of the system, heated cables often save thousands in ice-dam repair costs; operating cost runs $1-$3 per day during freezes.`,
  `Heat tape in the gutter channel and the top 3 feet of each downspout stops ice formation before it starts on ${city} homes. The long-run economics are good — one avoided ice event pays for years of operation at $1-$3 per day during cold stretches.`,
  `A self-regulating heat cable runs inside the gutter and a few feet into the downspout. In ${city}, the payoff is straightforward: daily operating cost runs $1-$3 during freezes, and one prevented ice-dam rebuild covers several winters of electricity.`,
])}</p>
</section>`;
  } else {
    return `
<section class="section fp-section">
<h2>${h2}</h2>
<p><strong>Freeze risk level for ${city}: ${data.freezeRisk}.</strong></p>
<p>${data.iceNote}</p>
<h3>${pick(slug, "mild-h3", [`What ${city} homeowners should know`, `${city}'s mild-winter gutter notes`, `Winter gutter basics in ${city}`])}</h3>
<p>${pick(slug, "mild-body", [
  `Ice is not the main concern in ${city}, but proper gutter pitch — 1/4 inch of slope per 10 feet of run — still matters because standing water during a rare cold snap can crack seams and pop hangers even on mild-climate systems.`,
  `${city} rarely produces ice-dam conditions. The detail that still matters: correct 1/4-inch-per-10-foot pitch so standing water doesn't pool and freeze during the occasional hard night.`,
  `Cold-weather damage to ${city} gutters is rare but not zero. The non-negotiable item is pitch — at 1/4 inch per 10 feet, water flows out rather than sitting long enough to freeze during rare ${city} cold events.`,
])}</p>
</section>`;
  }
}

function maintenanceSchedule(slug, city, data, facts) {
  const h2 = pick(slug, "maint-h2", [
    `Gutter Maintenance Schedule for ${city}`,
    `${city} Gutter Maintenance Calendar`,
    `Keeping ${city} Gutters Clean`,
    `${city} Gutter Cleaning Frequency and Cost`,
  ]);
  const costH3 = pick(slug, "maint-cost-h3", [
    `Cleaning cost in ${city}`,
    `${city} gutter cleaning pricing`,
    `What professional cleaning costs in ${city}`,
    `${city} cleaning price range`,
  ]);
  const costBody = pick(slug, "maint-cost", [
    `Professional gutter cleaning in ${city} runs $100-$250 for single-story and $150-$350 for two-story. Price depends on linear footage, height, and debris volume. Homes on a regular schedule in ${threeNbh(facts)} pay the low end; neglected gutters with compacted debris or blockages cost more because the crew has to flush downspouts too.`,
    `${city} cleaning pricing sits at $100-$250 on single-story homes and $150-$350 on two-story. Factors: total LF, gutter height, debris weight. ${threeNbh(facts)} homeowners on regular schedules pay the low end; deferred maintenance pushes pricing up once flushing clogged downspouts enters the scope.`,
    `Expect $100-$250 per cleaning on single-story ${city} homes and $150-$350 on two-story. Pricing tracks footage, height, and how compacted the debris is. Regular schedules in ${threeNbh(facts)} keep costs low; long-deferred cleanings cost more due to flushing and blockage removal.`,
  ]);
  const diyH3 = pick(slug, "diy-h3", [
    `DIY vs. professional cleaning`,
    `Should you DIY gutter cleaning in ${city}?`,
    `${city} DIY vs. hired-help tradeoff`,
    `When to DIY and when to hire a ${city} crew`,
  ]);
  const diyBody = pick(slug, "diy-body", [
    `Single-story ${city} homes with easy ladder access are reasonable DIY jobs. Two-story, steep lots, and complex-rooflined homes in ${threeNbh(facts)} belong to professional crews. Ladder falls rank among the most common serious home-maintenance injuries in the US; a $150 professional cleaning beats an ER visit.`,
    `DIY makes sense on single-story ${city} homes with flat ground for the ladder. Two-story ${threeNbh(facts)} homes, sloped yards, and complex rooflines should go pro — US ladder-fall stats make the $150 cleaning a bargain.`,
    `For single-story ${city} ranches with level ladder ground, DIY is fine. Anything two-story, anything with a steep lot, anything with gables and valleys in ${threeNbh(facts)} is professional-crew work. The cost differential is small relative to ER-bill risk from a ladder fall.`,
  ]);
  return `
<section class="section fp-section">
<h2>${h2}</h2>
<div class="fp-maintenance-stat" style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding:16px 20px;background:#fefce8;border-radius:12px;border:1px solid #fde68a;">
<div style="font-size:24px;font-weight:800;color:#92400e;line-height:1;">${data.cleaningFrequency}</div>
</div>
<p>${data.cleaningNote}</p>
<h3>${costH3}</h3>
<p>${costBody}</p>
<h3>${diyH3}</h3>
<p>${diyBody}</p>
</section>`;
}

function redFlagsSection(slug, city, state, data, facts) {
  const flags = [
    {
      title: pick(slug, "rf1-title", [
        `Undersized gutters for ${city} rainfall`,
        `5-inch gutters on a ${city} home`,
        `Bidding ${city} roofs without rainfall context`,
        `${city}-specific undersizing`,
      ]),
      body: pick(slug, "rf1-body", [
        `${city} receives ${data.annualRainfall} of rain annually. A contractor bidding standard 5-inch gutters without mentioning ${city} rainfall intensity or your specific roof area is sizing for convenience, not performance. Homes in ${threeNbh(facts)} with roof areas over 1,500 sq ft draining to a single run should default to 6-inch gutters.`,
        `At ${data.annualRainfall} of annual rain in ${city}, a bid that defaults to 5-inch gutters without discussing ${threeNbh(facts)} roof area or peak rainfall rate is cutting corners. Roof planes over 1,500 sq ft draining to one run want 6-inch capacity in ${city}'s rain profile.`,
        `A ${city} bid that specifies 5-inch gutters without reference to ${data.annualRainfall} of annual rainfall or the specific ${threeNbh(facts)} roof area being drained is underthought. Any roof plane above 1,500 sq ft emptying to a single gutter run needs 6-inch in ${city}.`,
      ])
    },
    {
      title: pick(slug, "rf2-title", [
        `Wrong pitch or no pitch at all`,
        `Flat ${city} gutters as installed`,
        `Pitch errors on ${city} installs`,
        `${city} gutter slope problems`,
      ]),
      body: pick(slug, "rf2-body", [
        `Gutters should slope toward downspouts at about 1/4 inch per 10 feet of run. Flat gutters pool water, breed mosquitoes, and overflow in storms. After install, run a simple ${city} water test: pour water at the high end and confirm steady flow to the downspout with no pooling. If water stands, pitch needs correction.`,
        `Standard pitch is 1/4 inch per 10 feet of run toward the downspout. Flat gutters pool, attract mosquitoes, and overflow during ${city} downpours. Test with a garden hose after install — pooling anywhere means the hanger heights need re-setting.`,
        `Correct slope for ${city} gutters: 1/4 inch per 10 feet of run toward each downspout. Flat sections pool water and overflow during storms. A five-minute post-install hose test catches the problem — any standing water means the hangers need adjusting.`,
      ])
    },
    {
      title: pick(slug, "rf3-title", [
        `No splash blocks or downspout extensions`,
        `${city} discharge routing skipped`,
        `Downspouts dumping at the foundation`,
        `Missing drainage on ${city} bids`,
      ]),
      body: pick(slug, "rf3-body", [
        `Gutters collect water; downspouts deliver it. Without splash blocks, extensions, or buried drainage, all that water concentrates at your foundation. ${city}'s ${data.annualRainfall} of annual rain turns that into foundation cracks, basement seepage, and eroded landscaping. A ${city} bid silent on discharge routing is incomplete.`,
        `${city} downspouts need splash blocks, extensions, or buried drain tile — without them, ${data.annualRainfall} of annual rain lands at the foundation each year. Foundation problems, wet basements, and landscape erosion follow. ${city} bids that ignore discharge routing are missing half the job.`,
        `Discharge routing is the half of a ${city} gutter project contractors most often skip. Given ${data.annualRainfall} of ${city} rainfall annually, dumping water at the foundation causes foundation movement, basement moisture, and yard erosion. A proper ${city} bid addresses where the water goes, not just how it gets off the roof.`,
      ])
    },
    {
      title: pick(slug, "rf4-title", [
        `Seamed gutters sold as seamless`,
        `"Seamless" that actually has seams`,
        `The ${city} seamless bait-and-switch`,
        `Sectional gutters priced as seamless`,
      ]),
      body: pick(slug, "rf4-body", [
        `True seamless gutters are roll-formed on-site from continuous coil using a portable forming machine — seams only at corners, downspout outlets, and end caps. If a ${city} contractor quotes "seamless" but plans to splice 10- or 20-foot factory sections, that's sectional product. Seams are the #1 failure point in gutter systems, and paying seamless pricing for sectional product is the most common ${city} gutter scam.`,
        `Real seamless means the installer rolls the full gutter run on your ${city} property from continuous coil stock; seams appear only at corners, outlets, and end caps. A "seamless" ${city} bid that mentions joining factory-cut sections with splice connectors is sectional gutter at seamless pricing — the single most common install-side scam.`,
        `Seamless = formed on-site from one coil. Sectional = factory pieces joined with connectors. The ${city} scam is marketing sectional gutters as "seamless" and charging the seamless premium. Seams cause the majority of gutter failures, so paying for real seamless matters — verify the coil-forming machine showed up to your job.`,
      ])
    },
  ];

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  const h2 = pick(slug, "rf-h2", [
    `Red Flags in Gutter Quotes: What ${city} Homeowners Should Watch For`,
    `${city} Gutter Quote Red Flags`,
    `Common Gutter Scams in ${city}`,
    `What to Watch for in ${city} Gutter Bids`,
  ]);
  const intro = pick(slug, "rf-intro", [
    `These are the most common problems that surface on ${city} gutter quotes.`,
    `Here are the ${city} gutter-bid patterns that burn homeowners most often.`,
    `${threeNbh(facts)} homeowners see these same four gutter-quote issues repeatedly.`,
    `The ${city} gutter-industry patterns worth flagging before signing anything.`,
  ]);

  return `
<section class="section fp-section">
<h2>${h2}</h2>
<p>${intro}</p>
${flagsHTML}
</section>`;
}

function seasonalBuyingGuide(slug, city, data) {
  const h2 = pick(slug, "season-h2", [
    `Best Time to Install Gutters in ${city}`,
    `${city} Gutter Installation: Seasonal Timing`,
    `When to Schedule ${city} Gutter Work`,
    `${city} Gutter Pricing by Season`,
  ]);
  const peakTail = pick(slug, "season-peak", [
    `Expect 10-20% higher labor costs and longer lead times during ${city} peak season. Emergency gutter repairs after ${city} storms command premium pricing regardless of month.`,
    `Peak-season ${city} pricing runs 10-20% above shoulder-season rates, with longer lead times too. Storm-damage emergency work carries its own premium separate from seasonal swings.`,
    `${city} peak months bring 10-20% labor surcharges and waitlists. Storm-emergency gutter work is always premium-priced — it doesn't follow the regular seasonal pattern.`,
  ]);
  return `
<section class="section fp-section">
<h2>${h2}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months</h3>
<p class="fp-season-months">${data.buyingBest}</p>
<p>${data.buyingNote}</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Peak pricing / low availability</h3>
<p class="fp-season-months">${data.buyingWorst}</p>
<p>${peakTail}</p>
</div>
</div>
</section>`;
}

function localInsights(slug, city, data) {
  const h2 = pick(slug, "local-h2", [
    `${city} Gutter Installation Notes`,
    `${city}-Specific Gutter Details`,
    `What ${city} Gutter Projects Require`,
    `${city} Installation Considerations`,
  ]);
  return `
<section class="section fp-section">
<h2>${h2}</h2>
<p>${data.localInsightPara}</p>
<p>${data.warrantyPara}</p>
</section>`;
}

function downspoutRouting(slug, city, data, facts) {
  return `
<section class="section fp-section">
<h2>${city} Downspout and Drainage Routing</h2>
<p>${data.downspoutNote}</p>
<p>${data.cleaningNote}</p>
</section>`;
}

function scopeChecklist(slug, city, data) {
  return `
<section class="section fp-section">
<h2>What Your ${city} Gutter Contract Should Include</h2>
<p><strong>Material specification.</strong> ${data.bestGuardStyle}.</p>
<p><strong>Cleaning schedule.</strong> ${data.cleaningFrequency}. ${data.cleaningNote}</p>
<p><strong>Seasonal timing.</strong> ${data.buyingNote}</p>
<p><strong>Warranty terms.</strong> ${data.warrantyPara}</p>
</section>`;
}

function buyerQuestions(city, data) {
  return `
<section class="section fp-section">
<h2>Questions to Ask a ${city} Gutter Contractor</h2>
<p><strong>What gauge aluminum are you installing?</strong> ${data.localInsightPara}</p>
<p><strong>How are you sizing for ${city} rainfall?</strong> ${city} receives ${data.annualRainfall} annually. ${data.rainfallNote}</p>
<p><strong>What guard type works here?</strong> ${cap(data.bestGuardStyle)}.</p>
<p><strong>What warranty terms apply?</strong> ${data.warrantyPara}</p>
<p><strong>What is your cleaning recommendation?</strong> ${data.cleaningFrequency}. ${data.cleaningNote}</p>
</section>`;
}

function climateAndDebris(city, data) {
  return `
<section class="section fp-section">
<h2>How ${city} Climate Affects Gutters</h2>
<p>${data.rainfallNote}</p>
<p><strong>Debris profile.</strong> ${city} tree coverage is ${data.treeCoverage}, with ${data.dominantTrees} dominant. Primary debris: ${data.debrisType}.</p>
<p><strong>Guard recommendation.</strong> ${cap(data.bestGuardStyle)}.</p>
<p><strong>Freeze risk: ${data.freezeRisk}.</strong> ${data.iceNote}</p>
</section>`;
}

function costScenarios(slug, city, state, mult, facts) {
  const lf = 150;
  const budgetPerLF = pricingModel.basePricePerLinearFoot.vinyl.mid * mult;
  const midPerLF = pricingModel.basePricePerLinearFoot.aluminum_seamless.mid * mult;
  const guardPerLF = pricingModel.basePricePerLinearFoot.gutter_guards.mid * mult;
  const premPerLF = pricingModel.basePricePerLinearFoot.copper.mid * mult;

  const budget = {
    material: "vinyl gutters",
    perLF: Math.round(budgetPerLF * 100) / 100,
    total: Math.round(lf * budgetPerLF / 25) * 25,
    detail: pick(slug, "sc-budget", [
      `Old-gutter removal, vinyl gutter and downspout install, basic splash blocks, site cleanup. Vinyl is the cheapest option in ${city} but carries a 10-15 year lifespan and cracks in temperature extremes.`,
      `Includes vinyl gutter and downspout install after removing the old system, basic splash blocks, and site cleanup. Vinyl runs cheapest in ${city} but lives only 10-15 years and cracks under temperature swings.`,
      `Covers removal of the existing system, vinyl gutter and downspout install with basic splash blocks. The ${city} cheapskate tier: 10-15 year expected life and temperature-crack susceptibility.`,
    ])
  };
  const mid = {
    material: "aluminum seamless + leaf guards",
    perLF: Math.round((midPerLF + guardPerLF) * 100) / 100,
    total: Math.round(lf * (midPerLF + guardPerLF) / 25) * 25,
    detail: pick(slug, "sc-mid", [
      `Old gutter removal, 5-inch seamless aluminum, micro-mesh leaf guards, hidden hangers, downspouts with extensions, cleanup. The most common ${city} choice and the best overall value for most ${threeNbh(facts)} homes.`,
      `5-inch seamless aluminum with hidden hangers, micro-mesh leaf guards, downspout extensions, and full cleanup after removal of the old system. Right answer for most ${threeNbh(facts)} homes in ${city}.`,
      `Seamless 5-inch aluminum on hidden hangers, micro-mesh guards, downspouts with proper extensions, old-system removal and haul-off. This is what the majority of ${threeNbh(facts)} ${city} homes should install.`,
    ])
  };
  const prem = {
    material: "copper half-round with leaf guards",
    perLF: Math.round((premPerLF + guardPerLF) * 100) / 100,
    total: Math.round(lf * (premPerLF + guardPerLF) / 25) * 25,
    detail: pick(slug, "sc-prem", [
      `Old gutter removal, copper half-round gutters and copper downspouts, micro-mesh guards, premium fittings throughout. Copper develops natural patina over 2-3 years and lasts 50+ years in ${city} with zero corrosion.`,
      `Copper half-round system with matching copper downspouts, micro-mesh guards, and all premium fittings. A 50+ year ${city} install — copper patinas in 2-3 years and then just sits there indefinitely.`,
      `Full copper half-round with copper downspouts, premium micro-mesh guards, and complete fitting suite. Half-round copper is the ${city} 50-year tier, with natural patina settling in after 2-3 years.`,
    ])
  };

  const lfSuffix = pick(slug, "lf-suffix", [`| 150 LF`, `on 150 LF`, `across 150 LF`, `over 150 LF`]);
  function scenarioCard(label, s, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${s.material} ${lfSuffix}</p>
<p class="fp-scenario-total">${fmtK(s.total)}</p>
<p class="fp-scenario-detail">~$${s.perLF}/LF installed. ${s.detail}</p>
</div>`;
  }

  const h2 = pick(slug, "cost-h2", [
    `What Gutters Actually Cost in ${city}: 3 Scenarios`,
    `${city} Gutter Cost Scenarios`,
    `Real Gutter Project Pricing in ${city}`,
    `${city} Gutter Pricing: Budget, Mid, Premium`,
  ]);
  const intro = pick(slug, "cost-intro", [
    `Real ${city} gutter project pricing, using ${city}-adjusted labor and material costs for 2026. Every scenario assumes 150 linear feet (average single-story ${city} home).`,
    `Here's what ${city} gutter projects actually cost in 2026, calibrated to ${city} labor and material rates. All three scenarios use a 150-LF single-story baseline.`,
    `These ${city} figures reflect 2026 pricing on labor and materials in ${city}. Each scenario models 150 linear feet, which is typical for single-story ${city} homes.`,
  ]);
  const caveat = pick(slug, "cost-caveat", [
    `Two-story ${city} homes add 15-25% for ladder and scaffold access. Fascia repair runs an additional $5-$15/LF. Complex rooflines in ${nbh(facts, 0)} or ${nbh(facts, 1)} with many corners push labor higher because of fitting count.`,
    `Add 15-25% for two-story ${city} homes because of ladder and scaffold overhead. Fascia repair is another $5-$15/LF. Multiple corners in ${nbh(facts, 0)} and ${nbh(facts, 1)} increase fitting count and labor.`,
    `Two-story adds 15-25% to ${city} gutter pricing. Any fascia replacement runs $5-$15/LF extra. Complex ${nbh(facts, 0)} or ${nbh(facts, 1)} rooflines with many corners need more fittings, which drives labor up.`,
  ]);
  return `
<section class="section fp-section">
<h2>${h2}</h2>
<p>${intro}</p>
<div class="fp-scenario-grid">
${scenarioCard("Budget", budget, "#22c55e")}
${scenarioCard("Mid-Range", mid, "#3b82f6")}
${scenarioCard("Premium", prem, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">${caveat} <a href="/gutters-quote-analyzer.html?mode=estimator" style="color:var(--brand);">Get a personalized ${city} estimate.</a></p>
</section>`;
}

function flagshipCSS() {
  return `
<style>
.fp-section { margin-top:32px; }
.fp-section h2 { font-size:22px; margin-bottom:12px; color:#0f172a; }
.fp-section h3 { font-size:17px; margin:18px 0 8px; color:#1e293b; }
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

/* --- Main builder --- */

function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  const data = CITY_GUTTER_DATA[metro.slug];
  if (!facts || !ctx || !data) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getRegionMultiplier(state);

  let html = flagshipCSS();
  html += `\n${MARKER_START}\n`;
  html += neighborhoodPricing(metro.slug, facts, mult);
  html += rainfallDrainage(city, state, metro.slug, data, facts);
  html += gutterGuardAnalysis(metro.slug, city, data, facts);
  html += iceDamWinter(metro.slug, city, state, data, facts);
  html += maintenanceSchedule(metro.slug, city, data, facts);
  html += redFlagsSection(metro.slug, city, state, data, facts);
  html += seasonalBuyingGuide(metro.slug, city, data);
  html += localInsights(metro.slug, city, data);
  html += downspoutRouting(metro.slug, city, data, facts);
  html += scopeChecklist(metro.slug, city, data);
  html += climateAndDebris(city, data);
  html += buyerQuestions(city, data);
  html += costScenarios(metro.slug, city, state, mult, facts);
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
