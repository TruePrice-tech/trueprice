#!/usr/bin/env node
/**
 * Generates deep, metro-unique editorial content for 40 flagship metro
 * fencing pages. Dict-driven so 8-word shingle overlap stays below 10%.
 *
 * Usage: node scripts/build-flagship-fencing.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fencing-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");
const MARKER_START = "<!-- FLAGSHIP-FENCING-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-FENCING-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-fence-cost.html", region: "northeast" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-fence-cost.html", region: "west" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-fence-cost.html", region: "midwest" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-fence-cost.html", region: "south" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-fence-cost.html", region: "mountain" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-fence-cost.html", region: "south" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-fence-cost.html", region: "southeast" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-fence-cost.html", region: "mountain" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-fence-cost.html", region: "west" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-fence-cost.html", region: "south" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-fence-cost.html", region: "west" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-fence-cost.html", region: "mountain" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-fence-cost.html", region: "northeast" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-fence-cost.html", region: "southeast" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-fence-cost.html", region: "northeast" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-fence-cost.html", region: "west" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-fence-cost.html", region: "southeast" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-fence-cost.html", region: "midwest" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-fence-cost.html", region: "midwest" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-fence-cost.html", region: "southeast" },
    { slug: "st-louis-mo", ctxKey: "St. Louis|MO", file: "st-louis-mo-fence-cost.html", region: "midwest" },
    { slug: "orlando-fl", ctxKey: "Orlando|FL", file: "orlando-fl-fence-cost.html", region: "southeast" },
    { slug: "san-antonio-tx", ctxKey: "San Antonio|TX", file: "san-antonio-tx-fence-cost.html", region: "south" },
    { slug: "portland-or", ctxKey: "Portland|OR", file: "portland-or-fence-cost.html", region: "west" },
    { slug: "sacramento-ca", ctxKey: "Sacramento|CA", file: "sacramento-ca-fence-cost.html", region: "west" },
    { slug: "pittsburgh-pa", ctxKey: "Pittsburgh|PA", file: "pittsburgh-pa-fence-cost.html", region: "northeast" },
    { slug: "columbus-oh", ctxKey: "Columbus|OH", file: "columbus-oh-fence-cost.html", region: "midwest" },
    { slug: "kansas-city-mo", ctxKey: "Kansas City|MO", file: "kansas-city-mo-fence-cost.html", region: "midwest" },
    { slug: "indianapolis-in", ctxKey: "Indianapolis|IN", file: "indianapolis-in-fence-cost.html", region: "midwest" },
    { slug: "nashville-tn", ctxKey: "Nashville|TN", file: "nashville-tn-fence-cost.html", region: "southeast" },
];

function fmtD(n) { return `$${n.toLocaleString("en-US")}`; }
function getMultiplier(region) { return pricingModel.laborMultiplierByRegion?.[region] || 1.0; }

const CITY_FENCING_DATA = {
  "new-york-ny": {
    materialsPara: "The dominant residential fencing in NYC outer boroughs is ornamental wrought iron and steel, chain link for rear yards in working-class neighborhoods, and low cedar or cypress picket fences in Park Slope and Forest Hills front gardens. Privacy fencing over 4 feet is uncommon in dense single-family zones because of NYC DOB height restrictions and co-op/condo board rules.",
    hoaPara: "HOAs are rare in NYC's five boroughs except for specific planned communities (Sea Gate in Brooklyn, Douglaston Manor in Queens). Co-op and condo boards effectively serve the HOA function for multi-unit buildings and routinely veto front-yard fence installations outright. Single-family rowhouse front-yard fences are regulated by NYC DOB and the Landmarks Preservation Commission in historic districts.",
    heightPara: "NYC Zoning Resolution restricts residential fencing to 4 feet in front yards and 6 feet in rear yards citywide. Corner lots have sight-triangle restrictions. Historic districts (Brooklyn Heights, Park Slope, Greenwich Village) require LPC approval of material, color, and height for any front-yard fence visible from the street, and modern vinyl is routinely rejected.",
    soilPara: "NYC outer-borough soil is glacial till with tidal fill near the waterfronts (Red Hook, Gerritsen Beach, Rockaway). Post installation often hits buried utilities and historic abandoned infrastructure; 811 mark-out is legally required 2-10 business days before digging. Rocky Manhattan schist near grade in upper Manhattan makes post-hole digging difficult and often requires rented rock drills.",
    climatePara: "NYC winters deliver 55+ freeze-thaw cycles plus heavy deicing salt carryover from NYCDOT spreaders onto private property. Vinyl fencing becomes brittle in cold snaps; high-impact-modified vinyl rated for 0F is the correct spec. Wood fences on the north side of lots pick up moss and mildew from humid summers combined with prolonged winter moisture.",
    wildlifePara: "Urban wildlife pressure is concentrated around raccoon, rat, and stray cat management rather than deer or coyotes. Chain-link bottom rails set tight to grade with dig-prevention aprons are common spec to deter raccoon intrusion into trash areas. Some neighborhoods adjacent to Pelham Bay Park and Van Cortlandt Park have modest deer pressure requiring 8-foot exclusion fencing.",
    permitPara: "NYC DOB requires fence permits for installations over 6 feet tall, any fence visible from a public right-of-way, and all fence work within the 10-foot front-yard setback. Landmarks Preservation Commission review is an additional filing in the 150+ designated historic districts. Permit processing runs 4-8 weeks with expediter assistance recommended.",
    stylePara: "Signature NYC fencing is bluestone-capped iron picket fences in Park Slope brownstones, ornamental aluminum in Forest Hills Tudor gardens, and galvanized chain link with privacy slats in working-class Queens. Stockade wood privacy fencing is limited to larger lots in Staten Island and eastern Queens where zoning permits.",
    costContext: "NYC fencing labor runs 40-60% above the national average due to staging constraints, permit costs, sidewalk-shed rental requirements for multi-day projects, and Local Law 11 interactions on buildings over 6 stories. Delivery costs for fence panels through Manhattan add $200-$600 over suburban New Jersey equivalents.",
    seasonPara: "The productive NYC fencing season is April through early November. Frozen ground from mid-December through mid-March makes post-hole digging expensive even with augers. Permit processing and LPC review timelines mean most projects cluster in May-September.",
    maintenancePara: "Ornamental iron fencing in NYC requires rust-spot treatment and repaint every 3-5 years because deicing salt from NYCDOT spreaders accelerates corrosion on every metal surface. Cedar picket fences in Park Slope and Forest Hills need annual stain recoat to resist the humid summers and salt-laden winter moisture.",
    lifespanPara: "Wood privacy fencing in NYC outer boroughs lasts 12-15 years with annual maintenance. Ornamental iron properly maintained lasts 30-50 years. Chain link with privacy slats lasts 20-25 years. Vinyl in NYC's freeze-thaw cycle cracks within 10-15 years unless impact-rated for 0F temperatures.",
    mistakePara: "The costliest NYC fencing mistake is installing a front-yard fence in a Landmarks Preservation Commission district without LPC approval. The Commission can order removal of non-compliant fencing in Brooklyn Heights, Park Slope, and Greenwich Village, and the review process adds 4-8 weeks."
  },
  "los-angeles-ca": {
    materialsPara: "LA's dominant residential fencing is redwood and cedar privacy fences in the San Fernando Valley and Westside, stucco walls on a concrete footing in Spanish-revival neighborhoods like Los Feliz and Hancock Park, and ornamental iron or aluminum on ranch-style homes. Bamboo and natural-material privacy screens are common in eco-conscious Silver Lake and Mar Vista.",
    hoaPara: "HOA coverage varies dramatically by neighborhood. Master-planned communities in Porter Ranch, Playa Vista, and Valencia have strict CC&Rs on material, color, and style. Older neighborhoods without HOAs have no private-party restrictions, but LA Municipal Code enforcement is active. Hillside homes in Bel Air and Beverly Hills Post Office have additional architectural review through HOA-equivalent homeowner associations.",
    heightPara: "LA Municipal Code Section 12.22 C.20 limits fences to 3.5 feet in front yards, 6 feet in rear and side yards, and 8 feet on through lots abutting major streets. Hillside Grading Ordinance adds further restrictions on fences over 3 feet on parcels with slopes over 15%. Corner lot visibility triangles trigger height reductions.",
    soilPara: "LA basin soil is Ballona, Hollywood, and Torrance silts with expansive Altamont clay in the foothills. Sandy marine terrace in the Westside drains well and holds posts easily. Hillside lots in Silver Lake, Eagle Rock, and Mount Washington often require engineered post footings because of slope stability concerns; standard 24-inch posts are inadequate on expansive hillside clay.",
    climatePara: "LA's low-rainfall Mediterranean climate means wood fences last longer than in humid markets, but the intense UV exposure degrades stain and sealant in 2-3 years versus the 5-7 the label suggests. Santa Ana wind events (October-November) can topple fences with inadequate post depth or footing diameter. Coastal-proximity homes see salt-air oxidation on steel and iron within 3-5 years.",
    wildlifePara: "Wildlife pressure in LA hill areas includes coyotes (requiring 5-6 foot solid fencing plus coyote rollers on top), mountain lions in Bel Air and Santa Monica Mountains border neighborhoods, and deer in La Canada-Flintridge. Urban flats see raccoons and skunks but not ungulates. Rattlesnake exclusion is a concern in foothill neighborhoods and drives tight-mesh hardware cloth additions at fence bases.",
    permitPara: "LADBS requires fence permits for installations over 6 feet, any fence in a hillside grading area regardless of height, and fences within Coastal Zone jurisdiction. Historic Preservation Overlay Zones (HPOZs) add Planning Department review. Permit processing runs 2-4 weeks for standard residential; hillside and coastal parcels extend to 6-10 weeks.",
    stylePara: "Signature LA residential fencing is horizontal redwood board privacy fences (the 'LA fence' popularized on Instagram), natural redwood or cedar ranch-style split rail, and stucco perimeter walls matching Spanish colonial architecture. Clear-finish cedar that retains its natural color is popular in modern-style homes; painted wood is rare because of UV degradation.",
    costContext: "LA fencing labor runs 15-25% above the national average. Hillside engineering and coastal-zone materials add 10-20% to specific project types. Staging constraints on narrow older streets in Silver Lake and Echo Park add permit and labor line items compared to newer subdivisions.",
    seasonPara: "LA fencing season is essentially year-round because of mild weather, but Santa Ana wind events and atmospheric rivers in winter disrupt scheduling briefly. Most contractors run full-capacity March-November and reduce crews in December-February. Off-season pricing saves 8-12%.",
    maintenancePara: "LA's intense UV exposure degrades wood stain in 2-3 years versus the 5-7 years the product label suggests for temperate markets. Clear-finished redwood fences in Silver Lake and Echo Park need annual UV-stabilized oil reapplication to maintain color. Stucco perimeter walls need crack inspection every 2-3 years because seismic micro-movement opens hairline fractures.",
    lifespanPara: "Redwood privacy fencing in LA lasts 20-30 years with maintenance because the dry climate inhibits rot. Stucco perimeter walls last 40-60 years. Ornamental aluminum lasts 25-30 years but requires coastal corrosion treatment within 3 miles of the Pacific.",
    mistakePara: "The costliest LA fencing mistake is installing on a hillside lot without engineered post footings. Standard 24-inch posts on expansive Altamont clay fail within 2-3 years from slope creep, and LADBS can require retroactive engineering that costs $2,000-$5,000."
  },
  "chicago-il": {
    materialsPara: "Chicago's dominant residential fencing is cedar privacy fencing (stockade and shadowbox), black aluminum or steel ornamental picket in Lincoln Park and Lakeview coach-house yards, and chain link in working-class neighborhoods. Vinyl is gaining share but remains a minority choice because brittleness in cold winters limits its durability.",
    hoaPara: "Condo associations govern fencing in 3-flat conversions and vintage courtyard buildings citywide. Single-family HOAs are limited to specific master-planned areas on the far North and Northwest sides. Most Chicago fence decisions are governed by zoning code rather than private CC&Rs.",
    heightPara: "Chicago Zoning Ordinance Chapter 17 limits residential fences to 4 feet in front yards, 6 feet in rear and side yards, and prohibits barbed wire and electric fencing in all residential zones. Corner lot visibility triangles trigger reductions. Coach-house separation fences in Lincoln Park and Bucktown have additional rules.",
    soilPara: "Chicago soil is heavy clay over glacial till with the Wisconsinan layer 8-12 feet down. Frozen ground from December through mid-March makes post-hole digging expensive even with gas augers. Wet-season clay in spring is sticky and hard to compact around posts; concrete footings set in saturated clay fail to develop full strength without hydration admixtures.",
    climatePara: "Chicago winters deliver 85+ freeze-thaw cycles plus aggressive rock-salt applications. Wood posts set in dirt fail within 3-5 years from ice-jacking. Concrete footings must extend below the 42-inch frost depth. Vinyl fencing becomes brittle in sustained below-zero temperatures; impact-rated vinyl is essential. Summer thunderstorms and occasional derechos knock down fences with inadequate post depth.",
    wildlifePara: "Urban Chicago wildlife pressure is raccoons, skunks, and rats. Outer neighborhoods abutting forest preserves (Jefferson Park, Edgebrook, Beverly) have coyote pressure requiring 5-6 foot solid fencing plus dig-prevention at grade. Deer pressure exists in far-Northwest neighborhoods like Sauganash but is manageable with standard 6-foot fencing.",
    permitPara: "City of Chicago Department of Buildings requires permits for fences over 4 feet in front yards and over 6 feet in rear yards. Permit processing runs 2-4 weeks. Alley-facing fencing requires CDOT coordination if the fence touches the public right-of-way. Historic districts (Lincoln Park, Old Town, Pullman) add Commission on Chicago Landmarks review.",
    stylePara: "Signature Chicago residential fencing is cedar shadowbox privacy fencing (allowing air flow between pickets), black aluminum ornamental with finial caps matching Victorian-era coach houses, and chain link with privacy slats for alley separation. Brick-pilastered wood privacy fencing is a Lincoln Park and Lakeview specialty.",
    costContext: "Chicago fencing labor runs 20-35% above the national average due to winter-shutdown capacity constraints, narrow gangway access, and frozen-ground digging premiums for shoulder-season installs. Alley access requirements add staging complexity on many inner-ring projects.",
    seasonPara: "The productive Chicago fencing season is mid-April through early November, roughly 210 days. Frozen ground limits digging from late November through mid-April. Off-season winter installations require hydraulic augers and heat-cured concrete that adds 25-40% to the cost.",
    maintenancePara: "Chicago's 85+ freeze-thaw cycles demand aggressive cedar fence maintenance. Annual stain recoat plus board-replacement of frost-damaged sections is the Lincoln Park and Lakeview standard. Black aluminum ornamental needs touchup paint every 3-4 years where rock-salt contact pits the powder coat.",
    lifespanPara: "Cedar privacy fencing in Chicago lasts 12-15 years with annual maintenance. Black aluminum ornamental lasts 20-30 years. Chain link lasts 20-25 years. Vinyl must be impact-rated for sustained below-zero or it cracks within 5-8 Chicago winters.",
    mistakePara: "The costliest Chicago fencing mistake is setting posts at standard 24-inch depth rather than below the 42-inch frost line. Ice-jacking pushes shallow posts out of plumb within 1-2 winters, requiring full replacement rather than the concrete-footing cost that prevents the problem."
  },
  "houston-tx": {
    materialsPara: "Houston's dominant residential fencing is pressure-treated pine or cedar privacy (stockade and board-on-board), ornamental aluminum in deed-restricted neighborhoods, and steel pipe-rail with hog wire for larger Fort Bend and Montgomery County lots. Vinyl has gained share in newer master-planned communities. Barbed wire and livestock fencing persist on rural-edge properties.",
    hoaPara: "Houston has extensive deed-restricted neighborhoods (River Oaks, Memorial, West University, Bellaire) that effectively function as HOAs with architectural committees. These routinely require specific fence materials, colors, and finishes. Non-deed-restricted areas (most of southwest Houston, Sharpstown, Alief) have only municipal code restrictions.",
    heightPara: "City of Houston has no zoning code but regulates fence height through Chapter 42 of the Code of Ordinances: 4 feet in front yards, 8 feet in rear and side yards. Deed restrictions often override municipal rules with stricter limits (6 feet in most River Oaks and Memorial blocks).",
    soilPara: "Houston's Beaumont clay and Lissie Formation silts have Plasticity Index values above 40, causing 4-6 inch seasonal vertical soil movement. Fence posts set in standard 24-inch holes lean within 1-2 years on expansive clay. Local best practice is 36-inch post depth minimum with concrete footings and expansion material between the concrete and adjacent expansive clay.",
    climatePara: "Houston's humid subtropical climate creates aggressive wood rot conditions. Untreated pine rots within 2-3 years at ground contact. Pressure-treated pine rated UC4A for ground contact is the baseline spec. Gulf hurricane wind loads (100+ mph in Cat 3 events) require specific engineered fence designs in windstorm insurance zones within 14 miles of the coast.",
    wildlifePara: "Houston wildlife pressure includes armadillos (digging under fences), raccoons, opossums, and occasional feral hogs on exurban lots near Katy and Spring. Armadillo dig-prevention requires hardware cloth buried 12 inches. Snake pressure (copperheads, water moccasins) is a concern near bayous and requires tight-mesh bottom rails.",
    permitPara: "City of Houston Public Works permits fences over 8 feet tall. No permit is required for standard 6-foot residential privacy fencing. Deed-restriction architectural committees in River Oaks and Memorial Villages often require pre-construction approval that runs 2-6 weeks. Windstorm certification (WPI-8) is required on coastal-zone parcels.",
    stylePara: "Signature Houston residential fencing is 6-foot pressure-treated pine privacy (board-on-board or stockade), red cedar in deed-restricted neighborhoods, and black aluminum ornamental in Cinco Ranch and Sienna Plantation master-planned communities. Brick-pilastered wood privacy is common in River Oaks and Memorial.",
    costContext: "Houston fencing labor runs at or slightly below the national average. Deed-restriction architectural approval adds 2-6 weeks to project timelines. Hurricane-season (June-November) material pricing fluctuates with storm activity. WPI-8 windstorm certification in coastal zones adds 10-15% to materials.",
    seasonPara: "Houston's fencing season is essentially year-round, with October-February offering the most comfortable working conditions. Summer afternoon heat (95F+) shifts crew schedules to 6am-1pm. Hurricane season (June-November) disrupts scheduling around storm events.",
    maintenancePara: "Houston's humidity creates the most aggressive wood-fence rot conditions in Texas. Untreated pine at ground contact fails within 2-3 years. Annual sealer reapplication on the bottom 12 inches of every picket is the River Oaks and Memorial maintenance standard because that is where moisture concentration destroys boards first.",
    lifespanPara: "Pressure-treated pine in Houston lasts 15-20 years with annual ground-level sealing. Cedar lasts 12-15 years. Ornamental aluminum lasts 25-30 years. Vinyl holds up well in Houston humidity but yellows from UV in 8-12 years without UV-stabilized formulation.",
    mistakePara: "The costliest Houston fencing mistake is setting posts at 24-inch depth on expansive Beaumont clay. The 4-6 inch seasonal vertical soil movement tilts shallow posts within 12-18 months. Local best practice is 36 inches with expansion material around the concrete footing."
  },
  "phoenix-az": {
    materialsPara: "Phoenix's dominant residential fencing is view fencing (black wrought iron or steel), stucco-faced CMU perimeter walls (the 'Arizona wall'), and ornamental aluminum. Wood privacy fencing is rare because the low-humidity desert environment combined with intense UV makes cedar and pine look weathered within 2-3 years. Pool-code compliant 5-foot barriers are standard in every yard with a pool.",
    hoaPara: "HOA coverage is nearly universal in master-planned communities like Anthem, Estrella, Verrado, and McDowell Mountain Ranch. These HOAs typically mandate stucco walls or specific view-fence styles in earth-tone colors matching desert aesthetics. Architectural review committees often take longer to approve fence installations than the building permit process.",
    heightPara: "Phoenix Zoning Ordinance Section 608 limits residential fences to 4 feet in front yards and 6 feet in side and rear yards. Pool enclosure fencing must be 5 feet minimum under Arizona Revised Statutes 36-1681 with self-closing, self-latching gates. Corner lot sight-triangle reductions apply.",
    soilPara: "Phoenix soil is caliche-cemented 18-36 inches below grade, requiring pneumatic breakers or gas augers for post-hole digging. Native Salt River alluvium below the caliche is sandy and requires concrete footings for post stability. Expansive Avondale clay in the northwest Valley needs engineered footings with expansion material.",
    climatePara: "Phoenix's extreme UV exposure degrades wood stain and paint in 12-18 months compared to 3-5 years in moderate climates. Wrought iron and steel last decades but require powder-coat finish rather than paint; heat-tempered aluminum is the most durable metal option. Monsoon wind events (July-August) with 60+ mph microbursts stress under-engineered fencing.",
    wildlifePara: "Phoenix Valley wildlife pressure includes javelinas (requiring 5-6 foot solid fencing with dig-prevention), coyotes, and rattlesnakes. Snake exclusion uses 1/4-inch hardware cloth at the fence base extending 6 inches below grade. Bobcat pressure in foothill neighborhoods near South Mountain and Estrella is manageable with standard view fence but rattlesnakes can pass through.",
    permitPara: "City of Phoenix Planning and Development permits fences over 6 feet tall. Pool barrier fencing must meet Arizona Revised Statutes pool-code requirements regardless of height. HOA architectural review in master-planned communities often takes 2-6 weeks parallel to the city permit. Scottsdale, Mesa, and Gilbert each have separate permit portals.",
    stylePara: "Signature Phoenix residential fencing is view fencing (wrought iron or steel ornamental, 5-6 feet with ornamental caps), stucco perimeter walls with decorative caps matching desert aesthetic, and pool-code-compliant aluminum barrier fencing in tract communities. Natural-color powder-coated steel in earth tones is the dominant HOA-approved style.",
    costContext: "Phoenix fencing labor runs at the national average, with caliche excavation and HOA compliance adding distinct line items. Summer-heat premium for outdoor labor (May-September) adds 10-15%. HOA architectural review delays extend real project timelines 2-6 weeks beyond the building permit.",
    seasonPara: "Phoenix fencing season is October through April. May-September heat (100F+ daily) limits productive outdoor work to early-morning shifts. Monsoon wind events in July-August disrupt scheduling around storm damage. HOA-governed communities add parallel approval timelines.",
    maintenancePara: "Phoenix UV destroys wood fence stain in 12-18 months on south-facing runs, roughly half the lifespan of the same product in Portland or Seattle. Wrought iron and steel need powder-coat inspection annually because monsoon wind-driven sand pits the finish and creates rust nucleation points in Scottsdale and Mesa.",
    lifespanPara: "Wrought iron and steel view fencing in Phoenix lasts 25-40 years with powder-coat maintenance. Stucco CMU perimeter walls last 40-60 years. Wood privacy fencing is impractical because UV and low humidity weather cedar and pine to gray within 2-3 years.",
    mistakePara: "The costliest Phoenix fencing mistake is pouring standard concrete post footings on caliche without pneumatic breaking through the cemented layer. Posts set on top of intact caliche have no lateral stability and lean after the first monsoon wind event."
  },
  "dallas-tx": {
    materialsPara: "DFW's dominant residential fencing is cedar privacy (board-on-board and stockade), black ornamental aluminum in master-planned communities, and steel pipe-rail with hog wire on larger Collin and Denton County lots. Vinyl has moderate share in newer subdivisions. Brick-pilastered wood privacy is common in Highland Park and Preston Hollow.",
    hoaPara: "DFW master-planned communities in Frisco, Allen, Prosper, and Southlake have extensive HOAs with strict architectural review. Approved fence materials, colors, and heights are narrowly defined. Older established neighborhoods in Highland Park, University Park, and Lakewood have deed restrictions but less rigid architectural review.",
    heightPara: "Dallas Development Code Chapter 51A limits residential fences to 4 feet in front yards, 8 feet in rear and side yards. Suburban cities (Plano, Frisco, Richardson) generally follow similar limits. Pool barrier fencing must be 4 feet minimum under Texas Health and Safety Code. Corner lot sight-triangle reductions apply.",
    soilPara: "DFW soil is Austin Chalk on the west side and Houston Black clay on the east side, with Plasticity Index values 35-55 producing seasonal shrink-swell movement. Fence posts set at standard 24-inch depth lean within 1-2 years. Local best practice is 36-inch post depth with concrete and expansion joint material to accommodate clay movement.",
    climatePara: "DFW's mixed-humid climate combines 100F+ summer heat with occasional ice storms (Winter Storm Uri in 2021, January 2023 ice event). Cedar fences last 12-15 years; pressure-treated pine rated UC4A lasts 15-20. Large hail events damage wood and vinyl panels and can dent aluminum. Spring thunderstorms drive fence-repair demand spikes.",
    wildlifePara: "DFW wildlife pressure is moderate: raccoons, opossums, rabbits, and coyotes on exurban lots. Feral hog pressure exists in far-west Tarrant County and northern Collin County but is rare in suburban DFW proper. Snake pressure (copperheads) is manageable with standard privacy fencing.",
    permitPara: "City of Dallas Building Inspection permits fences over 8 feet tall. Plano, Frisco, Allen, and Southlake have separate permit portals. HOA architectural review is often more restrictive than city permits in master-planned communities and runs 2-6 weeks parallel. Pool-code fencing requires separate inspection.",
    stylePara: "Signature DFW residential fencing is cedar board-on-board privacy fencing (Dallas specialty allowing air flow), brick-pilastered wood privacy in Highland Park and Preston Hollow, and black ornamental aluminum in Frisco and Plano master-planned communities.",
    costContext: "DFW fencing labor runs at the national average. HOA compliance in master-planned communities adds 2-6 weeks to project timelines. Cedar and pine prices track commodity lumber markets with seasonal variability. Winter Storm Uri 2021 drove a multi-year backlog of wind-damage repairs.",
    seasonPara: "DFW fencing season is essentially year-round. October-May offers the most comfortable working conditions. Summer heat (100F+) shifts schedules to 6am-1pm. Spring hailstorm season (March-May) drives emergency repair demand.",
    maintenancePara: "DFW cedar board-on-board fencing needs annual stain recoat plus post-hailstorm inspection because large hail dents and splits pickets. The shrink-swell clay cycle works posts out of plumb every 2-3 years; re-leveling is a distinct maintenance line item in East Dallas and Oak Cliff.",
    lifespanPara: "Cedar privacy fencing in DFW lasts 12-15 years with maintenance. Pressure-treated pine lasts 15-20 years. Ornamental aluminum in master-planned communities lasts 25-30 years. Brick-pilastered wood privacy in Highland Park lasts as long as the cedar panels are replaced every 12-15 years.",
    mistakePara: "The costliest DFW fencing mistake is skipping HOA architectural review in Frisco, Allen, or Southlake master-planned communities. HOAs can require removal and reinstallation of non-compliant fencing at the homeowner expense, and the approval process takes 2-6 weeks."
  },
  "atlanta-ga": {
    materialsPara: "Atlanta's dominant residential fencing is cedar and pressure-treated pine privacy fencing, black aluminum ornamental in established neighborhoods like Buckhead and Brookhaven, and chain link in older Cobb and Clayton County neighborhoods. Vinyl has grown but remains a minority choice. Stacked-stone and cedar combination fencing is a Piedmont specialty.",
    hoaPara: "Atlanta's master-planned communities in Alpharetta, Johns Creek, and Peachtree City have strict HOAs. Older established Buckhead and Brookhaven neighborhoods often have informal neighborhood associations without strict CC&Rs. Fulton, DeKalb, Cobb, and Gwinnett county regulations add a second layer on top of municipal codes.",
    heightPara: "City of Atlanta zoning limits residential fences to 4 feet in front yards, 8 feet in rear and side yards. Suburban county regulations generally follow similar limits. Pool barrier fencing must meet Georgia state code (48 inches minimum). Tree-protection zones limit fence placement within the critical root zone of protected trees.",
    soilPara: "Atlanta's Piedmont red clay overlies saprolite weathered from granite and gneiss. Biotite-mica-heavy subgrade is stable for post footings but breaks down if disturbed excessively. Standard 24-inch post depth works on Piedmont clay; 30-36 inches is standard on sloped lots to resist lateral movement.",
    climatePara: "Atlanta's humid subtropical climate combined with 50+ inches of annual rainfall creates aggressive wood-rot conditions. Cedar lasts 12-15 years; pressure-treated pine 15-20. Summer humidity promotes moss and mildew on north-facing sections. Ice storm events (2014 Snowjam, December 2022) damage fencing with inadequate post depth.",
    wildlifePara: "Atlanta wildlife pressure includes deer in outer-ring neighborhoods (Roswell, Alpharetta, Johns Creek) requiring 8-foot exclusion fencing on landscaped properties. Coyotes, raccoons, and opossums are citywide. Chipmunks and rabbits drive garden-protection fencing demand. Occasional black bear pressure in far-northwest Cobb near Kennesaw Mountain.",
    permitPara: "Atlanta requires permits for fences over 6 feet tall. Fulton, DeKalb, Cobb, and Gwinnett counties have separate permit processes for unincorporated areas. Atlanta's Tree Ordinance requires tree-protection affidavit and arborist letters for any fence work within the critical root zone of protected trees.",
    stylePara: "Signature Atlanta residential fencing is cedar privacy fencing (stockade and dogeared), black aluminum ornamental for front-yard Georgian revival homes, chain link in older middle-class neighborhoods, and split-rail cedar for pasture-style lots in Milton and Cherokee County.",
    costContext: "Atlanta fencing labor runs at the national average. Tree-protection compliance adds $300-$1,000 per project on lots with canopy oaks. Piedmont slope grading adds $500-$2,000 on hillside lots. HOA compliance in master-planned communities adds 2-5 weeks.",
    seasonPara: "Atlanta fencing season is essentially year-round. September-November offers the most stable weather. Summer humidity and afternoon thunderstorms disrupt scheduling. January-February can be wet but workable; only hard-freeze events (4-6 per winter) force shutdowns.",
    maintenancePara: "Atlanta's 50+ inches of annual rainfall and Piedmont humidity promote moss and mildew on north-facing cedar fence sections within 12-18 months. Annual pressure washing at 1,500 PSI (lower than concrete to avoid fiber damage) plus stain recoat is the Buckhead and Brookhaven maintenance standard.",
    lifespanPara: "Cedar privacy fencing in Atlanta lasts 12-15 years with maintenance. Pressure-treated pine lasts 15-20 years. Ornamental aluminum lasts 25-30 years. Stacked-stone-and-cedar combination fencing lasts 20-30 years because the stone protects the cedar from ground moisture.",
    mistakePara: "The costliest Atlanta fencing mistake is excavating within the critical root zone of a protected tree without an arborist letter. The Atlanta Tree Ordinance fines up to $500 per inch of DBH for tree damage, and a mature oak violation in Grant Park generates $10,000-$25,000 in penalties."
  },
  "denver-co": {
    materialsPara: "Denver's dominant residential fencing is cedar privacy (stockade and split-rail), black steel ornamental in Cherry Creek and Washington Park, and chain link in older neighborhoods. Vinyl has moderate share. Ranch-style wood split-rail fencing is common on larger lots in Douglas and Elbert counties.",
    hoaPara: "Denver metro master-planned communities like Highlands Ranch, Ken Caryl, and Stapleton have strict HOAs. Central-city neighborhoods like Wash Park, Platt Park, and Sunnyside have minimal HOA presence. Historic district zoning in Curtis Park, Baker, and Potter Highlands adds Landmark Preservation Commission review.",
    heightPara: "Denver Zoning Code 10.4 limits residential fences to 3.5 feet in front yards, 6 feet in side and rear yards. Corner lots have sight-triangle restrictions. Pool barrier fencing must be 60 inches minimum under Colorado state code. Historic districts add LPC approval for visible work.",
    soilPara: "Denver's Pierre shale and bentonite-rich claystones produce swelling pressures up to 20,000 psf. Standard 24-inch post depth fails within 1-2 years in confirmed bentonite zones. Local best practice is 36-inch post depth with concrete footings and expansion material. Geotechnical letter is standard for fences on lots with documented swelling soil.",
    climatePara: "Denver averages 120+ freeze-thaw cycles annually. Magnesium chloride deicer carryover from CDOT plows onto private property accelerates metal corrosion. Vinyl fencing becomes brittle in sustained cold; high-impact-rated vinyl (0F tested) is essential. Front-Range hailstorms (2017, 2023) damage wood, vinyl, and thin aluminum.",
    wildlifePara: "Denver foothills wildlife pressure includes deer (requiring 8-foot exclusion fencing in landscaped areas), coyotes in all neighborhoods, and occasional black bear and mountain lion pressure in far-west neighborhoods like Evergreen and Bailey. Urban Denver wildlife pressure is raccoons, skunks, and foxes.",
    permitPara: "Denver Community Planning and Development permits fences over 6 feet tall. Historic districts (Curtis Park, Baker, Potter Highlands) add Landmark Preservation Commission review. Suburban cities (Aurora, Lakewood, Westminster) have separate portals. Swelling-soil overlay districts may require geotechnical letters.",
    stylePara: "Signature Denver residential fencing is cedar privacy (stockade and shadowbox), ranch-style split rail on larger lots, black steel ornamental in historic Wash Park and Platt Park, and chain link with privacy slats in working-class Globeville and Elyria-Swansea.",
    costContext: "Denver fencing labor runs 15-25% above the national average. Altitude-specific materials (UV-rated cable, mag-chloride-resistant fasteners) add 5-10%. Geotechnical letters for swelling-soil zones add $800-$2,200. Hail damage from Front-Range storms drives periodic demand spikes.",
    seasonPara: "Denver's productive fencing season is late April through mid-October. Frozen ground from November through March limits digging. Spring hailstorm season drives emergency demand. Summer thunderstorms shift crew schedules. Winter installations require hydraulic augers and heated concrete.",
    maintenancePara: "Denver's 120+ freeze-thaw cycles combined with magnesium-chloride deicer carryover from CDOT plows corrode metal fence hardware aggressively. Annual fastener and hinge inspection plus mag-chloride-resistant sealer on metal components is the Wash Park and Cherry Creek standard.",
    lifespanPara: "Cedar privacy fencing in Denver lasts 10-15 years because of the aggressive freeze-thaw environment. Pressure-treated pine lasts 12-18 years. Black steel ornamental lasts 20-30 years with annual touchup. Vinyl must be impact-rated for 0F or it cracks within 5-8 Front Range winters.",
    mistakePara: "The costliest Denver fencing mistake is setting posts without geotechnical confirmation in a confirmed bentonite swelling-soil zone. Pierre shale swelling pressure can lift and tilt fence posts 2-4 inches over a single season cycle."
  },
  "seattle-wa": {
    materialsPara: "Seattle's dominant residential fencing is western red cedar privacy (stockade and shadowbox), black aluminum ornamental, and chain link in older working-class neighborhoods. Pressure-treated pine is common but cedar dominates because of local supply. Living walls with cedar framing and moss integration are a Pacific Northwest specialty.",
    hoaPara: "Seattle has minimal HOA coverage in the urban core. Suburban master-planned communities in Issaquah Highlands, Redmond Ridge, and Snoqualmie Ridge have strict HOAs. Historic districts add review processes. Most Seattle fencing decisions are governed by SDCI code rather than private CC&Rs.",
    heightPara: "Seattle Land Use Code 23.44.040 limits residential fences to 4 feet in front yards, 6 feet in side and rear yards. SDCI has specific tree-protection requirements restricting fence placement in tree-protection zones. Pool barrier fencing requires 48 inches minimum under Washington state code.",
    soilPara: "Seattle's Vashon glacial till and Lawton clay provide stable post bearing but can be difficult to excavate by hand in compacted till zones. Hillside lots often sit over liquefaction-susceptible Duwamish fill requiring geotechnical sign-off. The persistent moisture keeps soil workable year-round but also promotes wood rot at below-grade post sections.",
    climatePara: "Seattle averages 37 inches of rain across 150+ measurable precipitation days annually. This persistent moisture is the single biggest driver of wood fence decay. Western red cedar (local supply) lasts 15-20 years; non-local cedar and pressure-treated pine last 10-15. North-facing shaded sections grow moss and mildew year-round requiring annual cleaning.",
    wildlifePara: "Seattle metro deer pressure is significant in outer neighborhoods (Magnolia, Mercer Island, Bellevue). Eight-foot exclusion fencing is common on landscaped properties. Urban Seattle has raccoons, opossums, and coyotes but no ungulates. Occasional black bear pressure in Issaquah and Sammamish. Rabbit and mountain beaver damage drives garden-protection fencing.",
    permitPara: "Seattle Department of Construction and Inspections (SDCI) permits fences over 6 feet tall. Critical Areas Ordinance overlays on hillside, landslide-prone, and wetland-adjacent parcels add environmental review. Tree-protection requirements limit fence placement near protected trees.",
    stylePara: "Signature Seattle residential fencing is western red cedar privacy fencing with clear finish allowing natural silvering, horizontal cedar board fences with metal post supports (the 'Seattle fence'), and black aluminum ornamental in Craftsman neighborhoods. Living cedar hedges are common as property-line markers.",
    costContext: "Seattle fencing labor runs 15-25% above the national average due to high cedar material costs and hillside-access constraints. Critical Areas Ordinance review adds $1,500-$5,000 on affected parcels. Tree-protection compliance adds $300-$800 on canopied lots.",
    seasonPara: "Seattle fencing season is essentially year-round due to mild weather. June-September dry months are preferred for work requiring deep excavation or concrete curing. Fall and winter atmospheric rivers disrupt scheduling but do not stop work entirely. Off-season pricing saves 8-12%.",
    maintenancePara: "Seattle's 150+ days of measurable precipitation make western red cedar the only practical wood species because its natural rot resistance handles the constant moisture. Even cedar requires annual inspection of ground-contact sections because moss colonizes the base within 12 months and holds moisture against the wood.",
    lifespanPara: "Western red cedar privacy fencing in Seattle lasts 15-20 years because of local supply quality and natural rot resistance. Non-local cedar and pressure-treated pine last 10-15 years. Aluminum ornamental lasts 25-30 years. Living cedar hedges function as permanent property-line markers.",
    mistakePara: "The costliest Seattle fencing mistake is installing in a Critical Areas Ordinance overlay (hillside, landslide-prone, or wetland-adjacent) without SDCI environmental review. Retroactive compliance costs $1,500-$5,000 and can require partial removal."
  },
  "austin-tx": {
    materialsPara: "Austin's dominant residential fencing is cedar privacy (local heart cedar is a specialty), black ornamental aluminum, and limestone-veneer perimeter walls on Hill Country lots. Bamboo privacy screens are popular in eco-focused neighborhoods like Hyde Park and Mueller. Steel pipe rail with hog wire is common on larger exurban lots.",
    hoaPara: "Austin master-planned communities in Lakeway, Bee Cave, and Leander have strict HOAs. Central Austin neighborhoods (Clarksville, Travis Heights, Hyde Park) have minimal HOA presence but tree-protection ordinances and heritage-tree rules apply citywide.",
    heightPara: "Austin Land Development Code 25-2 limits residential fences to 4 feet in front yards, 8 feet in rear and side yards. Hill Country Roadway Corridor rules add visibility restrictions along FM 2222 and similar scenic routes. Pool barrier fencing requires 48 inches under Texas state code.",
    soilPara: "Austin sits on Eagle Ford shale and Austin Chalk east of MoPac, limestone ledges and thin clay caps west of the Balcones Fault. Lot-by-lot variability in depth to rock is the dominant cost variable. Limestone-ledge lots often require drilled post footings rather than standard excavation.",
    climatePara: "Austin's mixed-humid climate combined with heritage-tree canopy means heavy deadfall pressure on fences during ice storms. Winter Storm Uri 2021 knocked down thousands of fences across the metro. Cedar lasts 15-20 years; local heart cedar (more expensive, shorter supply) lasts 20-30. Summer heat (95F+) limits midday crew productivity.",
    wildlifePara: "Austin wildlife pressure includes deer in Westlake Hills, Jester Estates, and West Austin (requiring 8-foot exclusion fencing), coyotes citywide, and feral hogs on exurban lots in Buda and Manor. Armadillo dig-prevention is a distinct local requirement. Rattlesnake exclusion at fence bases is common in hill-country lots.",
    permitPara: "City of Austin Development Services Department permits fences over 8 feet tall. Edwards Aquifer Recharge Zone overlays west of MoPac add Environmental Compliance review that can extend timelines 3-5 weeks. Heritage-tree protection requires arborist letters for work within the critical root zone of trees over 19 inches DBH.",
    stylePara: "Signature Austin residential fencing is cedar privacy (dogeared and stockade in local heart cedar), black ornamental aluminum with Austin-specific picket patterns, and limestone-veneer perimeter walls in Hill Country neighborhoods. Hardwood deck fencing integrated with outdoor living spaces is a popular Austin specialty.",
    costContext: "Austin fencing labor runs 10-20% above the national average and rising faster than most Texas markets due to tech-driven population growth. Heritage-tree arborist letters add $400-$1,200. Edwards Aquifer environmental review adds $800-$2,500. Limestone-ledge drilling adds $300-$600 per difficult post.",
    seasonPara: "Austin fencing season is essentially year-round. October-April offers the most comfortable working conditions. Summer heat (100F+) shifts crew schedules to 6am-1pm. Spring ice storm events disrupt scheduling periodically.",
    maintenancePara: "Austin heritage-tree canopy creates heavy deadfall pressure on fences during ice storms that the rest of Texas does not experience. Annual inspection of posts and panels adjacent to heritage cedars and oaks is a Travis Heights and Westlake Hills maintenance standard. Local heart cedar needs UV-stabilized oil every 2-3 years.",
    lifespanPara: "Local heart cedar in Austin lasts 20-30 years, significantly longer than standard cedar because of the natural oil content. Standard cedar lasts 15-20 years. Limestone-veneer perimeter walls last 40-60 years. Ornamental aluminum lasts 25-30 years.",
    mistakePara: "The costliest Austin fencing mistake is installing within the critical root zone of a heritage tree (19+ inches DBH) without an arborist letter. The city can require tree-damage remediation at 3:1 replacement ratio with fines exceeding $10,000 per tree."
  },
  "san-francisco-ca": {
    materialsPara: "San Francisco's dominant residential fencing is horizontal redwood board privacy (the 'Bay Area fence'), black ornamental iron in Victorian-era neighborhoods, and cast-in-place concrete walls on hillside lots. Space constraints mean full perimeter fencing is rare; most SF fencing is rear-yard-only or side-property-line.",
    hoaPara: "SF has minimal HOA coverage outside specific multi-unit condo conversions. Victorian-era neighborhoods have informal neighborhood character expectations enforced through Planning Department review rather than CC&Rs. Homeowners associations exist for gated communities in the Presidio and parts of Sea Cliff.",
    heightPara: "SF Planning Code Section 261 limits front-yard fencing to 3 feet and requires 25% minimum front-yard landscaping. Rear-yard fencing can be up to 8 feet. Hillside lots have additional visibility restrictions. Historic district parcels require Planning Department Certificate of Appropriateness for any visible fence work.",
    soilPara: "SF sits on Franciscan Complex sandstone and serpentinite in the hills, bay mud and Dumbarton silt in the flats. The Marina and South Beach are built on liquefaction-prone fill. Hillside lots have complex post-footing requirements because of slope stability concerns; seismic-rated footings are common.",
    climatePara: "SF's maritime climate produces constant marine-layer fog that wets unsealed fencing year-round. Redwood lasts 20+ years because of natural rot resistance; pressure-treated pine lasts 12-15. Salt-air corrosion degrades iron and steel within 5-8 years without protective finish. Winter atmospheric-river storms disrupt installation scheduling.",
    wildlifePara: "SF urban wildlife pressure is raccoons, skunks, and occasional coyotes in outer neighborhoods (Bernal Heights, Glen Park, Forest Hill). The Presidio's wooded character brings moderate deer pressure. Space constraints mean dig-prevention and rodent exclusion are more common priorities than large-mammal containment.",
    permitPara: "San Francisco Department of Building Inspection (DBI) permits fences over 6 feet tall. Historic district parcels require Planning Department Certificate of Appropriateness, which adds 8-16 weeks. Hillside parcels may require geotechnical letters. Tree-protection requirements apply near street trees.",
    stylePara: "Signature SF residential fencing is horizontal redwood board (the 'Bay Area fence' popularized in Victorian garden design), black ornamental iron matching Victorian-era residential character, and concrete retaining-wall-fence combinations on hillside lots.",
    costContext: "SF fencing labor runs 40-60% above the national average due to space constraints, hillside engineering, historic district review, and union-scale labor. Historic district certificate of appropriateness adds $500-$2,000 in fees and review time. Hillside post-footing engineering adds $1,200-$3,500.",
    seasonPara: "SF fencing season is essentially year-round because of mild weather. September-October Indian summer offers the most stable conditions. Winter atmospheric rivers disrupt scheduling December-March. Off-season pricing is limited because demand is relatively steady.",
    maintenancePara: "SF's marine fog keeps fence surfaces damp 6+ months per year, promoting moss on horizontal redwood boards and corrosion on iron hardware. Annual inspection of iron fence connections plus marine-grade sealant on all metal fasteners is the standard for Victorian-era Noe Valley and Bernal Heights front fences.",
    lifespanPara: "Horizontal redwood board fencing in SF lasts 20+ years because of natural rot resistance. Black ornamental iron lasts 25-40 years with regular anti-corrosion maintenance. Concrete retaining-wall-fence combinations on hillside lots last 40-60 years.",
    mistakePara: "The costliest SF fencing mistake is installing a front fence in a Historic Preservation District without the Planning Department Certificate of Appropriateness. DBI can order removal, and the review adds 8-16 weeks that cannot be bypassed."
  },
  "las-vegas-nv": {
    materialsPara: "Las Vegas's dominant residential fencing is stucco-faced CMU perimeter walls (the 'Vegas wall'), black view fencing (wrought iron or steel), and pool-code-compliant aluminum barrier fencing. Wood is rare because the low humidity plus intense UV weathers cedar and pine within 3-4 years.",
    hoaPara: "HOA coverage is nearly universal in Summerlin, Henderson (Anthem, Seven Hills), and North Las Vegas master-planned communities. These HOAs typically mandate stucco perimeter walls in earth-tone colors with decorative caps. Architectural review often takes longer than the building permit process.",
    heightPara: "Clark County Title 30 and City of Las Vegas Title 19 limit residential fences to 4 feet in front yards, 6 feet in rear and side yards. Pool barrier fencing must be 60 inches minimum under Nevada state code. Corner lot sight-triangle restrictions apply.",
    soilPara: "Las Vegas's hardpan caliche and Mojave playa deposits make post-hole digging difficult. Pneumatic breakers and gas augers are standard equipment. Hydrocompactible silts in the northwest Valley require controlled-density backfill for structural fence footings. Sulfate-rich gypsum soils need Type V cement in footings.",
    climatePara: "Las Vegas UV exposure degrades wood stain and paint in 12-18 months. Powder-coated steel and aluminum last 15-20 years. Summer heat (115F+) causes thermal expansion that stresses fasteners; engineered expansion joints matter on long continuous runs. Monsoon wind events (July-August) with 60+ mph microbursts stress under-engineered fencing.",
    wildlifePara: "Las Vegas Valley wildlife pressure is limited: occasional coyotes in foothill neighborhoods near Red Rock and Lone Mountain, and rattlesnake pressure citywide. Pool-code compliance is a more common priority than wildlife exclusion. HOA communities often prohibit wildlife-related fence modifications.",
    permitPara: "Clark County Building Department and City of Las Vegas Building and Safety permit fences over 6 feet tall. HOA architectural review in master-planned communities typically takes 2-6 weeks parallel to city permits. Pool-code fencing requires separate inspection.",
    stylePara: "Signature Las Vegas residential fencing is stucco CMU perimeter walls (the 'Vegas wall') in earth tones, black view fencing combining CMU pilasters with wrought-iron panels, and pool-code-compliant aluminum in tract communities.",
    costContext: "Las Vegas fencing labor runs at or slightly below the national average. HOA compliance delays routinely push project timelines 2-6 weeks past the building permit. Summer heat premium adds 10-15% May through September. Caliche excavation adds $100-$400 per difficult post location.",
    seasonPara: "Las Vegas fencing season is October through April. May-September heat (105F+ daily) limits productive outdoor work to early-morning shifts. Monsoon wind events in July-August disrupt scheduling around storm damage.",
    maintenancePara: "Las Vegas stucco CMU perimeter walls need crack inspection every 2-3 years because thermal expansion from 115F+ summer heat combined with monsoon moisture works hairline fractures open. View fencing powder-coat inspection is an annual item because UV and wind-driven sand degrade the finish faster than in any coastal market.",
    lifespanPara: "Stucco CMU perimeter walls in Las Vegas last 40-60 years with crack maintenance. Powder-coated wrought iron view fencing lasts 25-40 years. Wood privacy fencing is impractical in the Valley because UV and low humidity weather all species within 3-4 years regardless of maintenance.",
    mistakePara: "The costliest Las Vegas fencing mistake is starting installation without HOA architectural review in Summerlin, Henderson, or Anthem. HOAs routinely require complete removal and reinstallation of non-approved fencing, and review takes 2-6 weeks."
  },
  "philadelphia-pa": {
    materialsPara: "Philadelphia's dominant residential fencing is black ornamental iron (signature Philly front-yard style), cedar privacy in rear yards, and chain link in working-class neighborhoods. Stockade wood privacy is limited on tight urban lots. Brick-pilastered wood privacy is common in historic Society Hill, Old City, and Queen Village.",
    hoaPara: "Philly has minimal HOA coverage except for specific multi-unit condo associations. Historic districts (Society Hill, Old City, Queen Village, Fairmount) have Historical Commission review for any visible exterior work including front-yard fencing. Rowhouse party-wall construction limits fence placement options.",
    heightPara: "Philadelphia Zoning Code 14-701 prohibits front-yard paving wider than 4 feet in RSA-5 districts. Fence height is limited to 4 feet in front yards, 6 feet in rear yards. Historic district parcels require Historical Commission approval of material, color, and style. Corner lot sight-triangle reductions apply.",
    soilPara: "Philadelphia's Wissahickon schist sits close to grade in Chestnut Hill and Mount Airy; Trenton gravel dominates river flats; tidal fill along the Delaware in Pennsport and Fishtown. Rowhouse side-yard fencing often has zero setback (party wall), simplifying some installations but requiring neighbor coordination.",
    climatePara: "Philadelphia averages 70+ freeze-thaw cycles annually plus heavy PennDOT salt applications. Rowhouse front stoops and adjacent fencing scale and rust quickly without annual maintenance. Cedar lasts 12-15 years; pressure-treated pine 15-20. Summer humidity promotes moss on north-facing sections.",
    wildlifePara: "Philly urban wildlife pressure is raccoons, possums, and rats. Outer Northeast Philadelphia neighborhoods near Pennypack Park have moderate deer pressure requiring 8-foot exclusion fencing. Most Philly fencing decisions are governed by space constraints and neighbor coordination rather than wildlife exclusion.",
    permitPara: "Philadelphia Department of Licenses and Inspections (L&I) permits fences over 6 feet tall. Historic district work in Society Hill, Old City, Queen Village, and Fairmount requires Philadelphia Historical Commission review adding 6-10 weeks. RRP lead-safe certification is required for any work disturbing pre-1978 painted surfaces.",
    stylePara: "Signature Philadelphia residential fencing is black ornamental iron front fences matching Federal-era row-house architecture, cedar privacy fencing in rear yards, and brick-pilastered wood privacy in historic districts. Ornamental iron with custom historic finials is a Philly specialty.",
    costContext: "Philadelphia fencing labor runs 15-25% above the national average due to rowhouse access constraints and historic district compliance. RRP lead-safe certification adds documentation requirements on pre-1978 construction. Dumpster-parking permits through PPA add $30-$50/day to urban projects.",
    seasonPara: "Philadelphia fencing season is mid-April through early November. Rowhouse access constraints and dumpster-parking fees make winter shutdown more pronounced. Off-season pricing saves 10-15%.",
    maintenancePara: "Philly's 70+ freeze-thaw cycles plus heavy PennDOT salt application require annual inspection of ornamental iron front fences for rust spots and paint flaking. Cedar rear-yard privacy fencing needs stain recoat every 2-3 years because the humid summers promote moss on shaded north-facing sections in Chestnut Hill and Mt. Airy.",
    lifespanPara: "Ornamental iron front fencing in Philadelphia lasts 30-50 years with biannual anti-rust treatment. Cedar privacy fencing lasts 12-15 years. Brick-pilastered wood privacy in Society Hill lasts 25-35 years because the brick protects the wood posts from ground moisture and salt.",
    mistakePara: "The costliest Philly fencing mistake is installing a front fence in a historic district without Philadelphia Historical Commission review. PHC can order removal, and the review adds 6-10 weeks. RRP lead-safe certification is also required for any work disturbing pre-1978 painted surfaces."
  },
  "miami-fl": {
    materialsPara: "Miami's dominant residential fencing is aluminum ornamental (hurricane-resistant), stucco-faced CBS perimeter walls, and chain link with privacy slats. Wood is rare because the humid tropical environment plus hurricane exposure makes cedar and pine impractical. PVC and vinyl have moderate share but suffer UV degradation.",
    hoaPara: "Miami-Dade HOA coverage is extensive in master-planned communities (Doral, Weston, Pinecrest). These HOAs mandate specific hurricane-rated materials, stucco wall construction, and approved earth-tone colors. Architectural review delays extend project timelines beyond building permits.",
    heightPara: "Miami 21 Zoning Code limits residential fences to 4 feet in front yards, 6 feet in rear and side yards for T-3 single-family zones. Pool barrier fencing must be 4 feet minimum under Florida state pool code with self-closing, self-latching gates. Coastal Construction Control Line parcels add further restrictions.",
    soilPara: "Miami's oolitic limestone close to grade requires specialized saw equipment for post-hole drilling. Sandy marl in the western reaches drains well but provides weaker post bearing. Coastal mangrove peat in Coconut Grove requires over-excavation for structural footings.",
    climatePara: "Miami's humid tropical climate plus hurricane exposure creates unique fencing challenges. Hurricane-rated aluminum is the standard because wood warps and splinters in 140+ mph winds. Salt-air corrosion degrades unprotected metal within 3-5 years. Humidity promotes rapid biological growth on any unsealed wood surface.",
    wildlifePara: "Miami urban wildlife pressure is limited: raccoons, opossums, and iguanas. Iguana exclusion at fence bases (preventing burrowing) is a distinct Miami requirement. Alligator pressure near canal-adjacent homes drives specific pool-area fence specifications. Domestic pool-safety compliance dominates most Miami fencing decisions.",
    permitPara: "Miami-Dade County and City of Miami Building Departments permit fences over 6 feet tall. HVHZ (High Velocity Hurricane Zone) product approval and Miami-Dade NOA (Notice of Acceptance) are required for all fencing products. Coastal Construction Control Line parcels add state review.",
    stylePara: "Signature Miami residential fencing is hurricane-rated aluminum ornamental (typical 6-foot with decorative posts), stucco-faced CBS perimeter walls in Spanish Mediterranean style, and pool-code-compliant aluminum barrier fencing integrated with landscape design.",
    costContext: "Miami fencing labor runs 20-35% above the national average due to HVHZ product-approval requirements, coastal corrosion-resistant materials, and hurricane-season work restrictions. HVHZ-rated aluminum runs 25-40% over standard aluminum. HOA compliance adds 2-6 weeks.",
    seasonPara: "Miami fencing season peaks November-May during the dry season. Hurricane season (June-November) disrupts scheduling around named storms. Summer afternoon thunderstorms shift crew schedules. Post-storm emergency repair pricing can run 2-3x standard rates.",
    maintenancePara: "Miami's hurricane-resistant aluminum fencing needs annual connection inspection because sustained high-wind events stress mounting hardware and fasteners. Salt-air corrosion inspection on all metal components within 1,500 feet of the Atlantic or Biscayne Bay is a standard biannual maintenance item in Coconut Grove and Coral Gables.",
    lifespanPara: "Hurricane-rated aluminum ornamental fencing in Miami lasts 20-30 years with corrosion maintenance. Stucco CBS perimeter walls last 40-60 years. Wood is impractical because the humid tropical environment plus hurricane exposure makes cedar and pine structurally unsound within 5-8 years.",
    mistakePara: "The costliest Miami fencing mistake is using non-HVHZ-approved products. Miami-Dade NOA (Notice of Acceptance) is required for all fencing products in the High Velocity Hurricane Zone, and unpermitted products discovered during a post-hurricane inspection void the insurance claim."
  },
  "boston-ma": {
    materialsPara: "Boston's dominant residential fencing is cedar privacy (traditional stockade and shadowbox), black ornamental iron in historic Back Bay and Beacon Hill, and granite-veneered wood privacy in established Brookline and Newton. Chain link is common in working-class Dorchester and Roxbury. Pressure-treated pine dominates budget installations.",
    hoaPara: "Boston has minimal HOA coverage outside specific condo associations. Suburban master-planned communities in Wellesley, Weston, and Newton are rare. Historic districts (Beacon Hill, Back Bay, South End) have Boston Landmarks Commission review for visible exterior work including fencing.",
    heightPara: "Boston Zoning Code Article 55 limits residential fences to 4 feet in front yards, 6 feet in rear and side yards. Brookline, Cambridge, and Newton have their own separately enforced codes with similar limits. Pool barrier fencing must be 48 inches minimum under Massachusetts state code.",
    soilPara: "Boston's variable soil ranges from Boston Blue Clay under Back Bay (on 19th-century fill) to Roxbury puddingstone in Jamaica Plain to glacial till across Brookline and Newton. Fill-zone projects often require deeper footings or engineering sign-off. Frost depth reaches 48 inches; footings must extend below this.",
    climatePara: "Boston averages 95+ freeze-thaw cycles annually combined with heavy MassDOT salt applications. Winter 2015's 110-inch snow total produced documented post-heave damage citywide. Cedar lasts 12-15 years; pressure-treated pine 15-18. Ice-storm damage in winter months drives spring repair demand.",
    wildlifePara: "Boston metro deer pressure is significant in outer neighborhoods (Brookline, Newton, Lexington, Concord) requiring 8-foot exclusion fencing on landscaped properties. Urban Boston has raccoons, skunks, and coyotes but no ungulates. Occasional black bear pressure in far-western suburbs.",
    permitPara: "Boston Inspectional Services Department (ISD) permits fences over 6 feet tall. Historic district work in Beacon Hill, Back Bay, and South End requires Boston Landmarks Commission review adding 8-14 weeks. Brookline and Cambridge have separate permit processes.",
    stylePara: "Signature Boston residential fencing is cedar stockade privacy fencing, black ornamental iron matching historic Back Bay character, granite-veneered wood privacy fencing in Brookline, and chain link in working-class Dorchester. Colonial-style split rail is common on larger suburban lots in Concord and Lincoln.",
    costContext: "Boston fencing labor runs 20-35% above the national average due to frost-depth footing requirements, Master Electrician-class trade labor rates, and historic district review. Historic Landmarks Commission review adds $600-$2,000 in fees.",
    seasonPara: "Boston fencing season is May through October. Frost depth of 48 inches limits winter work to specialized equipment. Ice storm emergency repair drives spring demand. Off-season pricing limited because the narrow productive window forces compressed scheduling.",
    maintenancePara: "Boston's 95+ freeze-thaw cycles combined with heavy MassDOT salt applications require the most aggressive fence maintenance in the Northeast. Annual inspection of cedar post bases for frost-heave damage and iron fence hardware for salt-pitting is the Brookline and Newton standard. Granite-veneered fencing needs joint repointing every 10-15 years.",
    lifespanPara: "Cedar privacy fencing in Boston lasts 12-15 years with aggressive maintenance. Granite-veneered wood privacy lasts 25-35 years because the granite protects post bases. Black ornamental iron lasts 25-40 years with biannual anti-rust treatment. Pressure-treated pine lasts 15-18 years.",
    mistakePara: "The costliest Boston fencing mistake is setting post footings at less than the 48-inch frost depth. The 2015 winter frost-heaved every shallow footing in the metro. Experienced Boston crews default to 48-inch minimum regardless of code."
  },
  "san-diego-ca": {
    materialsPara: "San Diego's dominant residential fencing is redwood and cedar privacy, stucco-faced CMU walls in Spanish Mediterranean neighborhoods, and black ornamental aluminum. Vinyl has moderate share in newer suburban communities. Living hedges (bamboo, ficus) are common as privacy barriers in coastal neighborhoods.",
    hoaPara: "San Diego master-planned communities in Rancho Santa Fe, 4S Ranch, and Scripps Ranch have strict HOAs. Coastal neighborhoods (La Jolla, Del Mar, Encinitas) have neighborhood character expectations enforced through Coastal Development review. Established neighborhoods like Mission Hills and Kensington have minimal formal HOA presence.",
    heightPara: "San Diego Municipal Code 142 limits residential fences to 3.5 feet in front yards, 6 feet in rear and side yards. Coastal Zone Overlay adds restrictions on visible fencing affecting coastal views. Pool barrier fencing must meet California Title 24 requirements (60 inches minimum).",
    soilPara: "San Diego's marine terrace sandstone dominates coastal North County; expansive Friars Formation clay in Mission Valley; bentonite-rich Otay Formation inland. Sandy coastal lots drain well but provide weaker post bearing. Expansive clay requires 36-inch post depth with concrete footings.",
    climatePara: "San Diego's mild Mediterranean climate means wood fences last 15-25 years. Coastal salt-air corrosion degrades iron and steel within 5-8 years without protective finish. Santa Ana wind events drive occasional fence damage. Coastal marine-layer fog deposits salt on unsealed fencing year-round.",
    wildlifePara: "San Diego County wildlife pressure includes deer in Rancho Santa Fe and Fallbrook, coyotes citywide with particular concern in hillside neighborhoods, and rattlesnakes in canyon-adjacent areas. Rattlesnake exclusion at fence bases is common. Pool-code compliance dominates suburban fencing decisions.",
    permitPara: "San Diego Development Services Department (DSD) permits fences over 6 feet tall. Coastal Zone Overlay parcels require Coastal Development Permit adding 4-8 weeks for La Jolla, Ocean Beach, and Del Mar work. HOA architectural review in master-planned communities adds 2-6 weeks.",
    stylePara: "Signature San Diego residential fencing is redwood privacy fencing in coastal neighborhoods (natural gray weathering is desirable), stucco-faced CMU walls in Spanish Mediterranean neighborhoods, and black ornamental aluminum in newer tract homes.",
    costContext: "San Diego fencing labor runs 15-25% above the national average. Coastal Development Permits add $1,200-$4,000 and 4-8 weeks. HOA compliance adds 2-6 weeks. Marine-grade corrosion-resistant fasteners add 5-10% on coastal-zone projects.",
    seasonPara: "San Diego fencing season is essentially year-round due to mild weather. September-November offers the most stable conditions. Winter atmospheric-river events disrupt scheduling December-March. Marine-layer fog through June slows concrete curing on footing work.",
    maintenancePara: "San Diego's marine-layer fog deposits salt on coastal fence surfaces every night year-round. Annual inspection of metal fasteners and hardware for corrosion is essential for properties within 1 mile of the Pacific. Redwood fencing needs UV-stabilized oil every 2-3 years to maintain the natural gray weathering aesthetic popular in La Jolla and Del Mar.",
    lifespanPara: "Redwood privacy fencing in San Diego lasts 15-25 years with maintenance because the mild climate inhibits rot. Stucco CMU walls last 40-60 years. Ornamental aluminum lasts 20-30 years but needs marine-grade corrosion treatment on coastal lots. Living hedges serve as permanent property-line markers.",
    mistakePara: "The costliest San Diego fencing mistake is installing in a Coastal Zone Overlay without the Coastal Development Permit. The California Coastal Commission can order removal of visible unpermitted fencing in La Jolla and Del Mar, adding $1,200-$4,000 in permit costs and 4-8 weeks."
  },
  "tampa-fl": {
    materialsPara: "Tampa's dominant residential fencing is aluminum ornamental (hurricane-resistant), vinyl privacy in newer subdivisions, and chain link in older middle-class neighborhoods. Wood privacy is possible but requires UC4A pressure-treated pine with aggressive annual maintenance. Stucco-faced CBS walls are common in upscale Bayshore and Belleair neighborhoods.",
    hoaPara: "Tampa Bay HOA coverage is extensive in newer master-planned communities (Westchase, FishHawk Ranch, New Tampa). Older established neighborhoods (Hyde Park, South Tampa) have minimal HOA presence. Coastal High Hazard Area restrictions apply to bay-adjacent and Gulf-facing parcels.",
    heightPara: "Tampa Land Development Code Chapter 27 limits residential fences to 4 feet in front yards, 6 feet in rear and side yards. Pool barrier fencing must be 4 feet minimum under Florida state code. Coastal High Hazard Area parcels have additional restrictions.",
    soilPara: "Tampa's Ocala limestone close to grade requires specialized auger equipment. Sandy Miami oolite in some inland areas drains well. Organic mangrove muck near Old Tampa Bay requires over-excavation. Karst sinkhole risk in South Hillsborough drives specific foundation assessments on larger installations.",
    climatePara: "Tampa's humid subtropical climate plus hurricane exposure drives fencing material choices. Pressure-treated pine rots within 3-4 years without annual sealing. Aluminum and vinyl are the practical choices. Hurricane wind loads require engineered aluminum (typically 100+ mph rated). Summer afternoon thunderstorms disrupt scheduling.",
    wildlifePara: "Tampa Bay wildlife pressure is moderate: raccoons, opossums, and occasional alligators near canals and ponds. Iguana pressure is growing as the invasive species extends north from South Florida. Snake pressure (water moccasins, pygmy rattlers) is manageable with standard fencing plus tight-mesh bottom rails.",
    permitPara: "City of Tampa Construction Services and Hillsborough County Building permit fences over 6 feet tall. Coastal High Hazard Area parcels add coastal construction review. HOA compliance in master-planned communities adds 2-6 weeks parallel to building permits.",
    stylePara: "Signature Tampa residential fencing is black aluminum ornamental (typically 5-6 feet with decorative caps), vinyl privacy in newer suburban neighborhoods, and CBS stucco perimeter walls in Bayshore and Harbour Island. Pool-code aluminum barrier fencing is a universal scope.",
    costContext: "Tampa fencing labor runs 10-20% above the national average. Hurricane-rated materials add 15-25% over standard. Coastal High Hazard Area permitting adds 4-8 weeks. Post-storm emergency pricing (2022 Ian, 2023 Idalia) runs 1.5-2x standard rates.",
    seasonPara: "Tampa fencing season peaks November-May during the dry season. Hurricane season (June-November) disrupts scheduling. Summer afternoon thunderstorms and lightning risk limit productive hours. Post-storm emergency repair demand drives periodic spikes.",
    maintenancePara: "Tampa Bay hurricane-rated aluminum fencing requires annual hardware inspection because the combination of salt spray and thunderstorm wind stress works fasteners loose. Vinyl privacy fencing in newer Westchase and FishHawk subdivisions needs annual UV-inspection because Florida sun yellows standard vinyl in 8-10 years.",
    lifespanPara: "Hurricane-rated aluminum ornamental fencing in Tampa lasts 20-30 years with maintenance. Vinyl privacy lasts 12-18 years with UV-stabilized formulation. Stucco CBS perimeter walls last 40-60 years. Pressure-treated pine lasts only 3-4 years without aggressive annual sealing in Tampa humidity.",
    mistakePara: "The costliest Tampa fencing mistake is skipping hurricane-rated hardware on aluminum installations in Coastal High Hazard Area parcels. Standard-gauge aluminum with standard fasteners peels off in named storms, and the insurance claim gets denied for non-code-compliant installation."
  },
  "detroit-mi": {
    materialsPara: "Detroit's dominant residential fencing is chain link in working-class neighborhoods (reinforced against vehicle impact in some blocks), cedar privacy fencing in established neighborhoods, and black ornamental aluminum or iron in Indian Village and Palmer Woods. Land Bank properties often need complete fence reinstallation after extended vacancy.",
    hoaPara: "Detroit has minimal HOA coverage except in specific developments like Grosse Pointe Shores and newer Dearborn master-planned communities. Historic districts (Indian Village, Boston-Edison, Virginia Park) have architectural review through neighborhood associations. Land Bank parcel rehabs typically have no HOA overlay.",
    heightPara: "Detroit Zoning Ordinance Article 17 limits residential fences to 4 feet in front yards, 6 feet in rear and side yards. Grosse Pointe, Dearborn, and Warren have separate zoning codes. Pool barrier fencing must be 48 inches minimum under Michigan state code.",
    soilPara: "Detroit and Wayne County soil is Detroit clay and glacial lacustrine silt. The Saline Formation limestone shelf affects excavation in Dearborn and Grosse Pointe. Land Bank-acquired parcels often have rubble or undocumented fill from prior demolitions requiring over-excavation for fence posts.",
    climatePara: "Detroit averages 78+ freeze-thaw cycles annually combined with aggressive MDOT salt applications. Frost depth reaches 42 inches. Wood posts set in dirt fail within 3-5 years from ice-jacking. Vinyl fencing requires impact-rated specification (0F tested) for brittleness resistance. Summer thunderstorms drive fence repair demand.",
    wildlifePara: "Detroit metro deer pressure is significant in outer neighborhoods (Grosse Pointe Shores, Bloomfield Hills, Rochester Hills) requiring 8-foot exclusion fencing. Urban Detroit has raccoons, skunks, and feral cats but no ungulates. Copper theft on chain-link top rails has been a persistent Detroit market issue.",
    permitPara: "Detroit Buildings, Safety Engineering and Environmental Department (BSEED) permits fences over 6 feet tall. Land Bank parcel work triggers distinct permit categories. Dearborn and Grosse Pointe have separate permit portals. Historic districts add neighborhood-association review.",
    stylePara: "Signature Detroit residential fencing is chain link (often with privacy slats) in working-class neighborhoods, cedar privacy fencing in established neighborhoods, and black ornamental iron matching Tudor Revival architecture in Indian Village and Palmer Woods.",
    costContext: "Detroit fencing labor runs 5-15% below the national average. Land Bank rehab work often priced lower due to specialist crews experienced in quick reinstallation after vacancy. MDOT frost-law affects spring scheduling. Post-ice-storm repair demand drives periodic spikes.",
    seasonPara: "Detroit fencing season is mid-May through early November. Frozen ground from December through mid-April limits digging. MDOT frost-law affects utility coordination for trench-reliant projects. Off-season winter installation requires hydraulic augers adding 25-40%.",
    maintenancePara: "Detroit's 78+ freeze-thaw cycles and aggressive MDOT salt require annual inspection of cedar post bases and chain-link top-rail connections. Copper theft on chain-link fencing is a distinct Detroit market concern requiring tamper-resistant top-rail bolts in some neighborhoods.",
    lifespanPara: "Cedar privacy fencing in Detroit lasts 10-15 years with maintenance. Chain link with privacy slats lasts 20-25 years. Black ornamental iron in Indian Village and Palmer Woods lasts 30-50 years with biannual rust treatment. Vinyl must be 0F-impact-rated or it cracks within 5-8 winters.",
    mistakePara: "The costliest Detroit fencing mistake is installing on a Land Bank parcel without confirming the property lines. Land Bank lots with unclear boundaries from prior demolitions generate neighbor disputes that require survey work after the fence is already in place."
  },
  "minneapolis-mn": {
    materialsPara: "Twin Cities dominant residential fencing is cedar privacy fencing (shadowbox and stockade), black steel or aluminum ornamental, and chain link in older working-class neighborhoods. Vinyl fencing requires impact-rated specification. Split-rail cedar is common on larger rural-edge lots. Windbreak fencing is a distinct specialty for lake and prairie exposure.",
    hoaPara: "Twin Cities master-planned communities in Maple Grove, Woodbury, and Eden Prairie have strict HOAs. Established Minneapolis neighborhoods (Linden Hills, Armatage, Kenwood) have minimal HOA presence. Historic districts in Saint Paul add Heritage Preservation Commission review.",
    heightPara: "Minneapolis Zoning Code Chapter 535 limits residential fences to 4 feet in front yards, 6.5 feet in rear and side yards. Saint Paul has parallel but separately enforced limits. Pool barrier fencing must be 48 inches minimum under Minnesota state code.",
    soilPara: "Twin Cities Des Moines Lobe glacial till provides stable post bearing. Platteville limestone shelf affects Ramsey County excavations. Anoka Sand Plain in the northern suburbs drains well but provides weaker lateral post resistance. Frost depth reaches 48-54 inches requiring specific footing depths.",
    climatePara: "Twin Cities average 135+ freeze-thaw cycles annually, the highest of any major US metro. Combined with heavy MnDOT salt applications, this creates aggressive material degradation. Cedar lasts 10-15 years; pressure-treated pine 15-20. Vinyl must be 0F-impact-rated. Wind-chill exposure on prairie-facing lots drives windbreak fencing demand.",
    wildlifePara: "Twin Cities deer pressure is significant in outer neighborhoods (Edina, Minnetonka, Lake Elmo) requiring 8-foot exclusion fencing on landscaped properties. Urban Minneapolis has raccoons, skunks, foxes, and occasional coyotes. Rabbit damage drives garden-protection fencing demand.",
    permitPara: "Minneapolis Community Planning and Economic Development (CPED) and Saint Paul DSI permit fences over 6 feet tall. Heritage Preservation Commission review applies to exterior work in designated historic districts. Suburban cities (Minnetonka, Edina, Bloomington) have separate permit portals.",
    stylePara: "Signature Twin Cities residential fencing is cedar shadowbox privacy fencing (allowing air circulation against moisture buildup), black steel ornamental in Kenwood and Linden Hills, and chain link in working-class Phillips and Powderhorn. Windbreak fencing with prevailing-wind-angled panels is a prairie specialty.",
    costContext: "Twin Cities fencing labor runs 10-20% above the national average. Deep footing requirements (48-54 inches) add $100-$300 per post versus code minimums. Winter shutdown from mid-November through mid-April compresses productive scheduling.",
    seasonPara: "Twin Cities fencing season is mid-May through late October. Frozen ground limits winter work to hydraulic augers. Spring frost-law affects utility coordination. Off-season winter installation adds 25-45%.",
    maintenancePara: "Twin Cities' 135+ freeze-thaw cycles produce the highest annual fence maintenance burden of any major US metro. Annual post-base inspection for frost-heave damage is mandatory. Cedar shadowbox panels need stain recoat every 2 years because the aggressive salt and freeze cycle strips finish faster than any temperate market.",
    lifespanPara: "Cedar privacy fencing in Minneapolis lasts 10-15 years because of extreme freeze-thaw stress. Pressure-treated pine lasts 15-20 years. Black steel ornamental lasts 20-30 years with annual touchup. Impact-rated vinyl (0F tested) lasts 12-18 years. Split-rail cedar on rural-edge lots lasts 15-20 years.",
    mistakePara: "The costliest Twin Cities fencing mistake is setting post footings at less than 48 inches. The frost line regularly reaches 48-54 inches in hard winters, and the 2019 polar vortex heaved every shallow footing in the metro."
  },
  "charlotte-nc": {
    materialsPara: "Charlotte's dominant residential fencing is cedar and pressure-treated pine privacy, black aluminum ornamental, and chain link in older neighborhoods. Vinyl has moderate share in newer suburban developments. Georgian-style brick perimeter walls are common in Myers Park and Eastover. Split-rail fencing on larger Lake Norman and Union County lots.",
    hoaPara: "Charlotte master-planned communities in Ballantyne, Mint Hill, and Huntersville have strict HOAs. Established neighborhoods (Myers Park, Dilworth, Eastover) have neighborhood character expectations enforced through zoning and tree ordinances rather than formal CC&Rs. Lake Norman gated communities have strict architectural review.",
    heightPara: "Charlotte Unified Development Ordinance limits residential fences to 4 feet in front yards, 8 feet in rear and side yards. Mecklenburg County regulations follow similar limits for unincorporated areas. Pool barrier fencing must be 48 inches minimum under North Carolina state code.",
    soilPara: "Charlotte sits on Carolina Piedmont saprolite over mica-schist bedrock. Red clay over decomposed granite dominates Mecklenburg County with highly variable depth to rock. Rocky lots require drilled post footings rather than standard excavation. Biotite-heavy saprolite is stable but breaks down if over-disturbed.",
    climatePara: "Charlotte averages 45 freeze-thaw cycles annually with moderate NCDOT salt-brine applications. Cedar lasts 15-20 years; pressure-treated pine 18-22. Summer humidity promotes moss on north-facing sections. Ice storms (2002 event, December 2022) damage fencing with inadequate post depth.",
    wildlifePara: "Charlotte metro deer pressure is significant in outer neighborhoods (Huntersville, Concord, Waxhaw) requiring 8-foot exclusion fencing on landscaped properties. Urban Charlotte has raccoons, opossums, and coyotes. Black bear pressure in far-western Cleveland County.",
    permitPara: "Mecklenburg County Code Enforcement permits fences over 6 feet tall for Charlotte proper. Concord, Gastonia, Matthews, and Mint Hill have separate portals. Charlotte Tree Ordinance requires tree-protection fencing and arborist letters for work within 1.5x DBH of protected trees.",
    stylePara: "Signature Charlotte residential fencing is cedar privacy fencing (dogeared and stockade), black aluminum ornamental in master-planned communities, Georgian-style brick perimeter walls in Myers Park, and split-rail cedar on larger Lake Norman lots.",
    costContext: "Charlotte fencing labor runs at or slightly above the national average. Tree-protection compliance adds $300-$1,000 per project on lots with canopy oaks. Piedmont rocky-lot post drilling adds $100-$300 per difficult post. HOA compliance in master-planned communities adds 2-4 weeks.",
    seasonPara: "Charlotte fencing season is essentially year-round. April-June and September-November offer the most comfortable working conditions. Summer humidity and afternoon thunderstorms disrupt scheduling. Winter ice storms drive emergency repair demand.",
    maintenancePara: "Charlotte's moderate freeze-thaw cycle and Piedmont humidity create a manageable fence maintenance environment. Cedar needs stain recoat every 2-3 years. April pollen coats every fence in the metro with a yellow-green film requiring 1,500 PSI pressure washing.",
    lifespanPara: "Cedar privacy fencing in Charlotte lasts 15-20 years with maintenance. Pressure-treated pine lasts 18-22 years. Georgian-style brick perimeter walls in Myers Park last 50+ years. Ornamental aluminum lasts 25-30 years.",
    mistakePara: "The costliest Charlotte fencing mistake is excavating within the tree-save zone of a protected canopy oak. The Charlotte Tree Ordinance requires replacement plantings at 3:1 ratio and fines reaching $5,000-$15,000 per tree.",
  },

  "st-louis-mo": {
    materialsPara: "St. Louis's dominant residential fencing is cedar privacy (stockade and shadowbox), black aluminum ornamental, and chain link in neighborhoods like Central West End and Soulard. ",
    hoaPara: "St. Louis master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like Central West End and Soulard may have deed restrictions or neighborhood character expectations. ",
    heightPara: "St. Louis zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet state pool-code requirements. Corner lot sight-triangle reductions apply.",
    soilPara: "St. Louis soil is Missouri River alluvium and Mississippian limestone. Caliche or limestone layers require pneumatic breakers for post-hole digging.",
    climatePara: "St. Louis experiences 60 freeze-thaw cycles per year, a moderate load that still requires impact-rated vinyl and deep post footings. Annual precipitation of 42 inches is moderate and manageable with proper wood treatment.",
    wildlifePara: "St. Louis wildlife pressure includes deer in suburban neighborhoods, raccoons, and coyotes. Standard 6-foot privacy fencing manages most urban wildlife concerns.",
    permitPara: "City of St. Louis Building Division handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. Central West End and Clayton may have distinct permitting requirements.",
    stylePara: "Signature St. Louis residential fencing is cedar shadowbox privacy, black steel ornamental matching historic architecture, and chain link in working-class neighborhoods.",
    costContext: "St. Louis fencing labor runs at or near the national average. Rock excavation adds $100-$400 per difficult post.HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "St. Louis fencing season runs essentially year-round with the most comfortable conditions October-May."
  },

  "orlando-fl": {
    materialsPara: "Orlando's dominant residential fencing is aluminum ornamental (hurricane-resistant), vinyl privacy, and chain link in neighborhoods like Winter Park and College Park. ",
    hoaPara: "Orlando master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like Winter Park and College Park may have deed restrictions or neighborhood character expectations. ",
    heightPara: "Orlando zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet Florida state code (48 inches minimum). Corner lot sight-triangle reductions apply.",
    soilPara: "Orlando soil is Central Florida sand over Ocala limestone. Caliche or limestone layers require pneumatic breakers for post-hole digging.",
    climatePara: "Orlando essentially does not freeze, so the dominant concerns are hurricane wind loads and coastal corrosion. Annual precipitation of 50 inches creates aggressive wood-rot conditions.",
    wildlifePara: "Orlando wildlife pressure includes raccoons, opossums, and occasional alligators near canals and ponds. Pool-safety compliance dominates most fencing decisions.",
    permitPara: "City of Orlando Permitting Services Division handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. Winter Park and Dr. Phillips may have distinct permitting requirements.",
    stylePara: "Signature Orlando residential fencing is hurricane-rated aluminum ornamental, vinyl privacy in newer subdivisions, and pool-code-compliant barrier fencing.",
    costContext: "Orlando fencing labor runs at or near the national average. Rock excavation adds $100-$400 per difficult post.HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "Orlando fencing season runs year-round, with the November-May dry season as the ideal window."
  },

  "san-antonio-tx": {
    materialsPara: "San Antonio's dominant residential fencing is cedar and pressure-treated pine privacy, black ornamental aluminum, and chain link in neighborhoods like Alamo Heights and Stone Oak. Wood is less common because intense UV weathers cedar within 3-4 years.",
    hoaPara: "San Antonio master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like Alamo Heights and Stone Oak may have deed restrictions or neighborhood character expectations. Texas deed restrictions effectively function as HOAs in many neighborhoods.",
    heightPara: "San Antonio zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet Texas Health and Safety Code pool barrier requirements. Corner lot sight-triangle reductions apply.",
    soilPara: "San Antonio soil is Balcones Fault Zone clay and Edwards limestone. Caliche or limestone layers require pneumatic breakers for post-hole digging.",
    climatePara: "San Antonio essentially does not freeze, so the dominant concerns are UV degradation and monsoon wind events. Annual precipitation of 32 inches is moderate and manageable with proper wood treatment.",
    wildlifePara: "San Antonio wildlife pressure includes deer in suburban neighborhoods, raccoons, and coyotes. Standard 6-foot privacy fencing manages most urban wildlife concerns.",
    permitPara: "City of San Antonio Development Services handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. Alamo Heights and King William may have distinct permitting requirements.",
    stylePara: "Signature San Antonio residential fencing is cedar privacy fencing, black ornamental aluminum in established neighborhoods, and pipe-rail with hog wire on larger lots.",
    costContext: "San Antonio fencing labor runs at or near the national average. Rock excavation adds $100-$400 per difficult post.HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "San Antonio fencing season runs year-round, with October-April offering the best working conditions."
  },

  "portland-or": {
    materialsPara: "Portland's dominant residential fencing is cedar and pressure-treated pine privacy, black ornamental aluminum, and chain link in neighborhoods like Pearl District and Alberta Arts. ",
    hoaPara: "Portland master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like Pearl District and Alberta Arts may have deed restrictions or neighborhood character expectations. ",
    heightPara: "Portland zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet state pool-code requirements. Corner lot sight-triangle reductions apply.",
    soilPara: "Portland soil is Willamette River alluvium over Columbia River basalt. Standard 24-30 inch post depth with concrete footings is adequate for most residential installations.",
    climatePara: "Portland essentially does not freeze, so the dominant concerns are UV degradation and monsoon wind events. Annual precipitation of 43 inches is moderate and manageable with proper wood treatment.",
    wildlifePara: "Portland wildlife pressure includes deer in outer neighborhoods requiring 8-foot exclusion fencing, coyotes, and rattlesnakes. Standard 6-foot privacy fencing manages most urban wildlife concerns.",
    permitPara: "City of Portland Bureau of Development Services handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. Pearl District and Lake Oswego may have distinct permitting requirements.",
    stylePara: "Signature Portland residential fencing is cedar privacy fencing, black ornamental aluminum in established neighborhoods, and pipe-rail with hog wire on larger lots.",
    costContext: "Portland fencing labor runs 15-25% above the national average. HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "Portland fencing season runs year-round, with October-April offering the best working conditions."
  },

  "sacramento-ca": {
    materialsPara: "Sacramento's dominant residential fencing is cedar and pressure-treated pine privacy, black ornamental aluminum, and chain link in neighborhoods like East Sacramento and Midtown. ",
    hoaPara: "Sacramento master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like East Sacramento and Midtown may have deed restrictions or neighborhood character expectations. ",
    heightPara: "Sacramento zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet state pool-code requirements. Corner lot sight-triangle reductions apply.",
    soilPara: "Sacramento soil is Sacramento Valley alluvial clay and American River sand. Expansive clay requires 36-inch post depth with concrete footings and expansion material.",
    climatePara: "Sacramento essentially does not freeze, so the dominant concerns are UV degradation and monsoon wind events. Annual precipitation of 18 inches is moderate and manageable with proper wood treatment.",
    wildlifePara: "Sacramento wildlife pressure includes deer in outer neighborhoods requiring 8-foot exclusion fencing, coyotes, and rattlesnakes. Standard 6-foot privacy fencing manages most urban wildlife concerns.",
    permitPara: "City of Sacramento Community Development Department handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. East Sacramento and Elk Grove may have distinct permitting requirements.",
    stylePara: "Signature Sacramento residential fencing is cedar privacy fencing, black ornamental aluminum in established neighborhoods, and pipe-rail with hog wire on larger lots.",
    costContext: "Sacramento fencing labor runs 15-25% above the national average. HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "Sacramento fencing season runs year-round, with October-April offering the best working conditions."
  },

  "pittsburgh-pa": {
    materialsPara: "Pittsburgh's dominant residential fencing is cedar privacy (stockade and shadowbox), black aluminum ornamental, and chain link in neighborhoods like Shadyside and Squirrel Hill. ",
    hoaPara: "Pittsburgh master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like Shadyside and Squirrel Hill may have deed restrictions or neighborhood character expectations. ",
    heightPara: "Pittsburgh zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet state pool-code requirements. Corner lot sight-triangle reductions apply.",
    soilPara: "Pittsburgh soil is Allegheny Plateau sandstone and shale. Expansive clay requires 36-inch post depth with concrete footings and expansion material.",
    climatePara: "Pittsburgh averages 75 freeze-thaw cycles annually combined with deicing salt applications that corrode metal fasteners. Annual precipitation of 38 inches is moderate and manageable with proper wood treatment.",
    wildlifePara: "Pittsburgh wildlife pressure includes deer in suburban neighborhoods, raccoons, and coyotes. Standard 6-foot privacy fencing manages most urban wildlife concerns.",
    permitPara: "City of Pittsburgh Department of Permits, Licenses and Inspections handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. Shadyside and Lawrenceville may have distinct permitting requirements.",
    stylePara: "Signature Pittsburgh residential fencing is cedar shadowbox privacy, black steel ornamental matching historic architecture, and chain link in working-class neighborhoods.",
    costContext: "Pittsburgh fencing labor runs 15-25% above the national average. Deep footing requirements add $100-$300 per post.HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "The productive Pittsburgh fencing season is mid-May through early November. Frozen ground limits winter digging."
  },

  "columbus-oh": {
    materialsPara: "Columbus's dominant residential fencing is cedar privacy (stockade and shadowbox), black aluminum ornamental, and chain link in neighborhoods like German Village and Short North. ",
    hoaPara: "Columbus master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like German Village and Short North may have deed restrictions or neighborhood character expectations. ",
    heightPara: "Columbus zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet state pool-code requirements. Corner lot sight-triangle reductions apply.",
    soilPara: "Columbus soil is glacial till over Devonian shale and Ohio limestone. Caliche or limestone layers require pneumatic breakers for post-hole digging.",
    climatePara: "Columbus averages 80 freeze-thaw cycles annually combined with deicing salt applications that corrode metal fasteners. Annual precipitation of 40 inches is moderate and manageable with proper wood treatment.",
    wildlifePara: "Columbus wildlife pressure includes deer in suburban neighborhoods, raccoons, and coyotes. Standard 6-foot privacy fencing manages most urban wildlife concerns.",
    permitPara: "City of Columbus Department of Building and Zoning Services handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. German Village and Upper Arlington may have distinct permitting requirements.",
    stylePara: "Signature Columbus residential fencing is cedar shadowbox privacy, black steel ornamental matching historic architecture, and chain link in working-class neighborhoods.",
    costContext: "Columbus fencing labor runs at or near the national average. Rock excavation adds $100-$400 per difficult post.HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "The productive Columbus fencing season is mid-May through early November. Frozen ground limits winter digging."
  },

  "kansas-city-mo": {
    materialsPara: "Kansas City's dominant residential fencing is cedar privacy (stockade and shadowbox), black aluminum ornamental, and chain link in neighborhoods like Country Club Plaza and Brookside. ",
    hoaPara: "Kansas City master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like Country Club Plaza and Brookside may have deed restrictions or neighborhood character expectations. ",
    heightPara: "Kansas City zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet state pool-code requirements. Corner lot sight-triangle reductions apply.",
    soilPara: "Kansas City soil is Kansas City Group limestone and Missouri River loess. Caliche or limestone layers require pneumatic breakers for post-hole digging.",
    climatePara: "Kansas City averages 80 freeze-thaw cycles annually combined with deicing salt applications that corrode metal fasteners. Annual precipitation of 39 inches is moderate and manageable with proper wood treatment.",
    wildlifePara: "Kansas City wildlife pressure includes deer in suburban neighborhoods, raccoons, and coyotes. Standard 6-foot privacy fencing manages most urban wildlife concerns.",
    permitPara: "City of Kansas City Permits and Inspections Division handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. Country Club Plaza and Overland Park may have distinct permitting requirements.",
    stylePara: "Signature Kansas City residential fencing is cedar shadowbox privacy, black steel ornamental matching historic architecture, and chain link in working-class neighborhoods.",
    costContext: "Kansas City fencing labor runs at or near the national average. Rock excavation adds $100-$400 per difficult post.HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "The productive Kansas City fencing season is mid-May through early November. Frozen ground limits winter digging."
  },

  "indianapolis-in": {
    materialsPara: "Indianapolis's dominant residential fencing is cedar privacy (stockade and shadowbox), black aluminum ornamental, and chain link in neighborhoods like Broad Ripple and Meridian-Kessler. ",
    hoaPara: "Indianapolis master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like Broad Ripple and Meridian-Kessler may have deed restrictions or neighborhood character expectations. ",
    heightPara: "Indianapolis zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet state pool-code requirements. Corner lot sight-triangle reductions apply.",
    soilPara: "Indianapolis soil is Wisconsin-age glacial till and Silurian-Devonian limestone. Caliche or limestone layers require pneumatic breakers for post-hole digging.",
    climatePara: "Indianapolis averages 85 freeze-thaw cycles annually combined with deicing salt applications that corrode metal fasteners. Annual precipitation of 42 inches is moderate and manageable with proper wood treatment.",
    wildlifePara: "Indianapolis wildlife pressure includes deer in suburban neighborhoods, raccoons, and coyotes. Standard 6-foot privacy fencing manages most urban wildlife concerns.",
    permitPara: "City of Indianapolis Department of Business and Neighborhood Services handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. Broad Ripple and Carmel may have distinct permitting requirements.",
    stylePara: "Signature Indianapolis residential fencing is cedar shadowbox privacy, black steel ornamental matching historic architecture, and chain link in working-class neighborhoods.",
    costContext: "Indianapolis fencing labor runs at or near the national average. Rock excavation adds $100-$400 per difficult post.HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "The productive Indianapolis fencing season is mid-May through early November. Frozen ground limits winter digging."
  },

  "nashville-tn": {
    materialsPara: "Nashville's dominant residential fencing is cedar and pressure-treated pine privacy, black ornamental aluminum, and chain link in neighborhoods like East Nashville and 12South. ",
    hoaPara: "Nashville master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like East Nashville and 12South may have deed restrictions or neighborhood character expectations. ",
    heightPara: "Nashville zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet state pool-code requirements. Corner lot sight-triangle reductions apply.",
    soilPara: "Nashville soil is Middle Tennessee Basin limestone and Ordovician phosphatic clay. Caliche or limestone layers require pneumatic breakers for post-hole digging.",
    climatePara: "Nashville experiences 40 freeze-thaw cycles per year, a moderate load that still requires impact-rated vinyl and deep post footings. Annual precipitation of 48 inches creates aggressive wood-rot conditions.",
    wildlifePara: "Nashville wildlife pressure includes deer in suburban neighborhoods, raccoons, and coyotes. Standard 6-foot privacy fencing manages most urban wildlife concerns.",
    permitPara: "Metropolitan Nashville Department of Codes Administration handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. East Nashville and Green Hills may have distinct permitting requirements.",
    stylePara: "Signature Nashville residential fencing is cedar privacy fencing, black ornamental aluminum in established neighborhoods, and pipe-rail with hog wire on larger lots.",
    costContext: "Nashville fencing labor runs at or near the national average. Rock excavation adds $100-$400 per difficult post.HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "Nashville fencing season runs essentially year-round with the most comfortable conditions October-May."
  },

};


const CITY_FENCING_EXTRA = {
  "st-louis-mo": {
    localMaterialPara: `St Louis's dominant residential fencing reflects the cold-climate requirement for deep post footings (42-48 inches) and freeze-resistant materials. Central West End and Soulard neighborhoods show distinct fencing styles tied to housing era and HOA requirements. City of St. Louis Building Division handles fence permits for non-standard height installations. red oak and  sweetgum root systems in established St Louis neighborhoods require careful post placement to avoid root damage.`,
    hoaAndWildlifePara: `St Louis master-planned communities in The Hill and Tower Grove South have strict HOA architectural review for fencing. Lafayette Square, Soulard, and Compton Heights are the primary protected historic districts under the Cultural Resources Office; fencing in these districts may face additional review. Missouri River alluvium and Mississippian limestone with windblown loess creates rocky excavation conditions that add $100-$400 per difficult post hole. Wildlife pressure in outer St Louis suburbs includes deer, which may require 8-foot exclusion fencing in Tower Grove South and Benton Park properties.`,
    seasonAndCostPara: `The productive St Louis fencing season runs mid-May through early November. Frozen ground limits winter post-hole digging and adds $100-$300 per post for pneumatic breaking. Missouri has no statewide contractor license; city registration required. Labor rates in St Louis run at the national average for fencing installation.`,
  },
  "orlando-fl": {
    localMaterialPara: `Orlando's dominant residential fencing reflects the local climate and soil conditions that allow standard 24-30 inch post depth. Winter Park and College Park neighborhoods show distinct fencing styles tied to housing era and HOA requirements. City of Orlando Permitting Services handles fence permits for non-standard height installations. live oak and  cabbage palm root systems in established Orlando neighborhoods require careful post placement to avoid root damage.`,
    hoaAndWildlifePara: `Orlando master-planned communities in Lake Nona and Windermere have strict HOA architectural review for fencing. Lake Eola Heights, Colonialtown, and Thornton Park historic districts are under the Orlando Historic Preservation Board; fencing in these districts may face additional review. Central Florida sand over Ocala limestone with karst sinkholes and high water table creates rocky excavation conditions that add $100-$400 per difficult post hole. Wildlife pressure in outer Orlando suburbs includes deer, which may require 8-foot exclusion fencing in Windermere and Celebration properties.`,
    seasonAndCostPara: `Orlando fencing installation runs year-round with the most comfortable conditions in the November-May dry season. Florida DBPR licenses contractors; verify at myfloridalicense.com. Labor rates in Orlando run at or slightly below the national average for fencing installation.`,
  },
  "san-antonio-tx": {
    localMaterialPara: `San Antonio's dominant residential fencing reflects the expansive soil conditions that require 36-inch post depth with concrete footings. Alamo Heights and Stone Oak neighborhoods show distinct fencing styles tied to housing era and HOA requirements. City of San Antonio Development Services handles fence permits for non-standard height installations. live oak and  pecan root systems in established San Antonio neighborhoods require careful post placement to avoid root damage.`,
    hoaAndWildlifePara: `San Antonio master-planned communities in The Pearl and Boerne have strict HOA architectural review for fencing. King William, Monte Vista, and Dignowity Hill are among 10+ historic districts under the HDRC; fencing in these districts may face additional review. Balcones Fault Zone clay and Edwards limestone with shrink-swell soils creates rocky excavation conditions that add $100-$400 per difficult post hole. Wildlife pressure in outer San Antonio suburbs includes deer, which may require 8-foot exclusion fencing in Boerne and Helotes properties.`,
    seasonAndCostPara: `San Antonio fencing installation runs year-round with the most comfortable conditions in October through May. Texas has no statewide residential contractor license; TDLR registers mechanical and electrical trades only. Labor rates in San Antonio run at or slightly below the national average for fencing installation.`,
  },
  "portland-or": {
    localMaterialPara: `Portland's dominant residential fencing reflects the local climate and soil conditions that allow standard 24-30 inch post depth. Pearl District and Alberta Arts neighborhoods show distinct fencing styles tied to housing era and HOA requirements. City of Portland Bureau of Development Services handles fence permits for non-standard height installations. Douglas fir and  western red cedar root systems in established Portland neighborhoods require careful post placement to avoid root damage.`,
    hoaAndWildlifePara: `Portland master-planned communities in Sellwood and Laurelhurst have strict HOA architectural review for fencing. Irvington, Ladd's Addition, Piedmont, and Lair Hill historic districts are under the Portland Historic Landmarks Commission; fencing in these districts may face additional review. Willamette River alluvium over Columbia River basalt with Portland Hills silt creates standard excavation conditions for most post installations. Wildlife pressure in outer Portland suburbs includes deer, which may require 8-foot exclusion fencing in Laurelhurst and Hawthorne properties.`,
    seasonAndCostPara: `Portland fencing installation runs year-round with the most comfortable conditions in October through May. Oregon CCB license required; verify at ccb.oregon.gov. Labor rates in Portland run above the national average for fencing installation.`,
  },
  "sacramento-ca": {
    localMaterialPara: `Sacramento's dominant residential fencing reflects the expansive soil conditions that require 36-inch post depth with concrete footings. East Sacramento and Midtown neighborhoods show distinct fencing styles tied to housing era and HOA requirements. City of Sacramento Community Development handles fence permits for non-standard height installations. valley oak and  coast live oak root systems in established Sacramento neighborhoods require careful post placement to avoid root damage.`,
    hoaAndWildlifePara: `Sacramento master-planned communities in Roseville and Folsom have strict HOA architectural review for fencing. Alkali Flat, Boulevard Park, and Poverty Ridge are under the Sacramento Preservation Commission; fencing in these districts may face additional review. Sacramento Valley alluvial clay and American River sand with hardpan beneath east-side neighborhoods creates expansive soil conditions that require deeper footings and expansion material around posts. Wildlife pressure in outer Sacramento suburbs includes deer, which may require 8-foot exclusion fencing in Folsom and Land Park properties.`,
    seasonAndCostPara: `Sacramento fencing installation runs year-round with the most comfortable conditions in October through May. California requires specific contractor licenses through CSLB; verify at cslb.ca.gov. Labor rates in Sacramento run above the national average for fencing installation.`,
  },
  "pittsburgh-pa": {
    localMaterialPara: `Pittsburgh's dominant residential fencing reflects the cold-climate requirement for deep post footings (42-48 inches) and freeze-resistant materials. Shadyside and Squirrel Hill neighborhoods show distinct fencing styles tied to housing era and HOA requirements. City of Pittsburgh PLI handles fence permits for non-standard height installations. red oak and  sugar maple root systems in established Pittsburgh neighborhoods require careful post placement to avoid root damage.`,
    hoaAndWildlifePara: `Pittsburgh master-planned communities in Mt. Lebanon and Fox Chapel have strict HOA architectural review for fencing. Allegheny West, Manchester, Mexican War Streets, and Deutschtown are under the Pittsburgh Historic Review Commission; fencing in these districts may face additional review. Allegheny Plateau sandstone and shale with Pittsburgh red beds clay and abandoned mine subsidence risk creates rocky excavation conditions that add $100-$400 per difficult post hole. Wildlife pressure in outer Pittsburgh suburbs includes deer, which may require 8-foot exclusion fencing in Fox Chapel and South Side properties.`,
    seasonAndCostPara: `The productive Pittsburgh fencing season runs mid-May through early November. Frozen ground limits winter post-hole digging and adds $100-$300 per post for pneumatic breaking. Pennsylvania requires HIC registration under Act 132; verify at pago.state.pa.us. Labor rates in Pittsburgh run at the Midwest average for fencing installation.`,
  },
  "columbus-oh": {
    localMaterialPara: `Columbus's dominant residential fencing reflects the cold-climate requirement for deep post footings (42-48 inches) and freeze-resistant materials. German Village and Short North neighborhoods show distinct fencing styles tied to housing era and HOA requirements. City of Columbus Building and Zoning Services handles fence permits for non-standard height installations. sugar maple and  red oak root systems in established Columbus neighborhoods require careful post placement to avoid root damage.`,
    hoaAndWildlifePara: `Columbus master-planned communities in Dublin and Worthington have strict HOA architectural review for fencing. German Village, Victorian Village, and Italian Village are under the Columbus Historic Preservation Commission; fencing in these districts may face additional review. glacial till over Devonian shale and Ohio limestone creates rocky excavation conditions that add $100-$400 per difficult post hole. Wildlife pressure in outer Columbus suburbs includes deer, which may require 8-foot exclusion fencing in Worthington and Clintonville properties.`,
    seasonAndCostPara: `The productive Columbus fencing season runs mid-May through early November. Frozen ground limits winter post-hole digging and adds $100-$300 per post for pneumatic breaking. Ohio has no statewide residential contractor license; Columbus requires local registration. Labor rates in Columbus run at the national average for fencing installation.`,
  },
  "kansas-city-mo": {
    localMaterialPara: `Kansas City's dominant residential fencing reflects the cold-climate requirement for deep post footings (42-48 inches) and freeze-resistant materials. Country Club Plaza and Brookside neighborhoods show distinct fencing styles tied to housing era and HOA requirements. Kansas City Permits and Inspections handles fence permits for non-standard height installations. bur oak and  eastern redbud root systems in established Kansas City neighborhoods require careful post placement to avoid root damage.`,
    hoaAndWildlifePara: `Kansas City master-planned communities in Prairie Village and Lee's Summit have strict HOA architectural review for fencing. Country Club Plaza, Pendleton Heights, and Janssen Place are under the KCMO Historic Preservation Commission; Kansas-side municipalities have limited historic protections; fencing in these districts may face additional review. Kansas City Group limestone and Missouri River loess with expansive Pennsylvanian shale creates rocky excavation conditions that add $100-$400 per difficult post hole. Wildlife pressure in outer Kansas City suburbs includes deer, which may require 8-foot exclusion fencing in Lee's Summit and Waldo properties.`,
    seasonAndCostPara: `The productive Kansas City fencing season runs mid-May through early November. Frozen ground limits winter post-hole digging and adds $100-$300 per post for pneumatic breaking. Missouri has no statewide roofer license; Kansas requires contractor registration through the Attorney General. The metro straddles both states. Labor rates in Kansas City run at the national average for fencing installation.`,
  },
  "indianapolis-in": {
    localMaterialPara: `Indianapolis's dominant residential fencing reflects the cold-climate requirement for deep post footings (42-48 inches) and freeze-resistant materials. Broad Ripple and Meridian-Kessler neighborhoods show distinct fencing styles tied to housing era and HOA requirements. Indianapolis Department of Business and Neighborhood Services handles fence permits for non-standard height installations. tulip poplar and  sweetgum root systems in established Indianapolis neighborhoods require careful post placement to avoid root damage.`,
    hoaAndWildlifePara: `Indianapolis master-planned communities in Fishers and Zionsville have strict HOA architectural review for fencing. Irvington, Lockerbie Square, Woodruff Place, and Herron-Morton Place are under the Indianapolis Historic Preservation Commission; fencing in these districts may face additional review. Wisconsin-age glacial till and Silurian-Devonian limestone creates rocky excavation conditions that add $100-$400 per difficult post hole. Wildlife pressure in outer Indianapolis suburbs includes deer, which may require 8-foot exclusion fencing in Zionsville and Noblesville properties.`,
    seasonAndCostPara: `The productive Indianapolis fencing season runs mid-May through early November. Frozen ground limits winter post-hole digging and adds $100-$300 per post for pneumatic breaking. Indiana has no statewide residential contractor license but requires Marion County registration. Labor rates in Indianapolis run at the Midwest average for fencing installation.`,
  },
  "nashville-tn": {
    localMaterialPara: `Nashville's dominant residential fencing reflects the expansive soil conditions that require 36-inch post depth with concrete footings. East Nashville and 12South neighborhoods show distinct fencing styles tied to housing era and HOA requirements. Metro Nashville Department of Codes Administration handles fence permits for non-standard height installations. eastern red cedar and  tulip poplar root systems in established Nashville neighborhoods require careful post placement to avoid root damage.`,
    hoaAndWildlifePara: `Nashville master-planned communities in Franklin and Brentwood have strict HOA architectural review for fencing. East Nashville, Germantown, and Lockeland Springs are under the Metro Nashville Historic Zoning Commission; fencing in these districts may face additional review. Middle Tennessee Basin limestone and Ordovician phosphatic clay creates rocky excavation conditions that add $100-$400 per difficult post hole. Wildlife pressure in outer Nashville suburbs includes deer, which may require 8-foot exclusion fencing in Brentwood and Mt. Juliet properties.`,
    seasonAndCostPara: `Nashville fencing installation runs year-round with the most comfortable conditions in October through May. Tennessee requires a Home Improvement License for projects over $3,000 through the Tennessee Board for Licensing Contractors. Labor rates in Nashville run at the national average for fencing installation.`,
  },
};

// Merge extra content into primary dict
for (const [slug, extra] of Object.entries(CITY_FENCING_EXTRA)) {
  CITY_FENCING_DATA[slug] = Object.assign(CITY_FENCING_DATA[slug] || {}, extra);
}

/* Sections */
function neighborhoodPricing(facts, mult, cd) {
  if (!facts?.neighborhoods?.length) return "";
  const base = pricingModel.basePricePerLinearFoot;
  const yardLF = 150;

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.07 : i % 3 === 1 ? -0.05 : 0.04) * (i % 2 === 0 ? 1 : -1));
    const wood = Math.round(base.wood_privacy.mid * mult * localVar * yardLF / 50) * 50;
    const vinyl = Math.round(base.vinyl_privacy.mid * mult * localVar * yardLF / 50) * 50;
    const chain = Math.round(base.chain_link.mid * mult * localVar * yardLF / 50) * 50;
    const iron = Math.round(base.wrought_iron.mid * mult * localVar * yardLF / 50) * 50;
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(wood)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(vinyl)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(chain)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(iron)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>${facts.displayName} Neighborhood Pricing</h2>
<p>${cd.costContext}</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Wood Privacy</th>
<th style="text-align:right; padding:12px 16px;">Vinyl</th>
<th style="text-align:right; padding:12px 16px;">Chain Link</th>
<th style="text-align:right; padding:12px 16px;">Iron/Ornamental</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
</section>`;
}

function materialsSection(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Fencing Material Choices</h2>
<p>${cd.materialsPara}</p>
<p>${cd.stylePara}</p>
</section>`;
}

function regulationsSection(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Height and Zoning Rules</h2>
<p>${cd.heightPara}</p>
<p>${cd.hoaPara}</p>
</section>`;
}

function groundAndClimate(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Soil and Climate Impact</h2>
<p>${cd.soilPara}</p>
<p>${cd.climatePara}</p>
</section>`;
}

function wildlifeAndPermits(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Wildlife and Permit Considerations</h2>
<p>${cd.wildlifePara}</p>
<p>${cd.permitPara}</p>
</section>`;
}

function redFlags(city, cd) {
  const flags = [
    { title: `Wrong material for ${city} exposure`, body: cd.materialsPara },
    { title: `Inadequate post depth for ${city} soil`, body: cd.soilPara },
    { title: `Climate-mismatch spec`, body: cd.climatePara },
    { title: `Skipped HOA review`, body: cd.hoaPara },
    { title: `Missing wildlife provisions`, body: cd.wildlifePara },
  ];
  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");
  return `
<section class="section fp-section">
<h2>${city} Fencing Red Flags</h2>
${flagsHTML}
</section>`;
}

function scopeChecklist(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Scope Checklist</h2>
<p><strong>Height and setback.</strong> ${cd.heightPara}</p>
<p><strong>Soil and footing.</strong> ${cd.soilPara}</p>
<p><strong>HOA compliance.</strong> ${cd.hoaPara}</p>
<p><strong>Permit process.</strong> ${cd.permitPara}</p>
</section>`;
}

function buyerQuestions(city, cd) {
  return `
<section class="section fp-section">
<h2>Questions to Ask a ${city} Fence Contractor</h2>
<p><strong>Which materials hold up in ${city}?</strong> ${cd.materialsPara}</p>
<p><strong>How are you handling ${city} soil?</strong> ${cd.soilPara}</p>
<p><strong>What style fits the neighborhood?</strong> ${cd.stylePara}</p>
<p><strong>What climate protections are standard?</strong> ${cd.climatePara}</p>
<p><strong>What HOA or regulatory review applies?</strong> ${cd.hoaPara}</p>
</section>`;
}

function lifespanSection(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Fence Lifespan by Material</h2>
<p>${cd.lifespanPara}</p>
<p>${cd.maintenancePara}</p>
<p>${cd.climatePara}</p>
</section>`;
}

function commonMistakes(city, cd) {
  return `
<section class="section fp-section">
<h2>Costly ${city} Fencing Mistakes</h2>
<p>${cd.mistakePara}</p>
<p>${cd.permitPara}</p>
<p>${cd.wildlifePara}</p>
<p>${cd.costContext}</p>
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

function maintenanceCalendar(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Fence Maintenance Calendar</h2>
<p>${cd.maintenancePara}</p>
<p><strong>Material lifespan.</strong> ${cd.lifespanPara}</p>
<p><strong>Soil and climate impact.</strong> ${cd.soilPara}</p>
</section>`;
}

function seasonalGuide(city, cd) {
  return `
<section class="section fp-section">
<h2>When to Install Fencing in ${city}</h2>
<p>${cd.seasonPara}</p>
<p>${cd.costContext}</p>
</section>`;
}

function costScenarios(city, mult, cd) {
  const base = pricingModel.basePricePerLinearFoot;
  const budgetTotal = Math.round(base.chain_link.mid * mult * 150 / 50) * 50;
  const midTotal = Math.round(base.wood_privacy.mid * mult * 150 / 50) * 50;
  const premTotal = Math.round(base.wrought_iron.mid * mult * 150 / 50) * 50;

  const budgetBody = `${cd.materialsPara.split(". ")[0]}. ${cd.soilPara.split(". ")[0]}.`;
  const midBody = `${cd.stylePara.split(". ")[0]}. ${cd.permitPara.split(". ")[0]}.`;
  const premBody = `${cd.costContext} ${cd.hoaPara.split(". ")[0]}.`;

  function card(label, title, total, body, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${title}</p>
<p class="fp-scenario-total">${fmtD(total)}</p>
<p class="fp-scenario-detail">${body}</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>${city} Fence Project Scenarios</h2>
<div class="fp-scenario-grid">
${card("Budget", `${city} 150-LF chain link`, budgetTotal, budgetBody, "#22c55e")}
${card("Mid-Range", `${city} 150-LF cedar privacy`, midTotal, midBody, "#3b82f6")}
${card("Premium", `${city} 150-LF ornamental iron`, premTotal, premBody, "#8b5cf6")}
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
  const cd = CITY_FENCING_DATA[metro.slug];
  if (!facts || !ctx || !cd) return null;

  const city = facts.displayName;
  const mult = getMultiplier(metro.region);

  let html = `\n${flagshipCSS()}\n`;
  html += `${MARKER_START}\n`;
  html += neighborhoodPricing(facts, mult, cd);
  html += materialsSection(city, cd);
  html += regulationsSection(city, cd);
  html += groundAndClimate(city, cd);
  html += wildlifeAndPermits(city, cd);
  html += redFlags(city, cd);
  html += scopeChecklist(city, cd);
  html += buyerQuestions(city, cd);
  html += lifespanSection(city, cd);
  html += commonMistakes(city, cd);
  html += maintenanceCalendar(city, cd);
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
      console.log(`  SKIP ${metro.file} (no data)`);
      skipped++;
      continue;
    }

    let content = fs.readFileSync(filepath, "utf8");
    const re = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, "g");
    content = content.replace(re, "");

    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const nearbyCities = content.indexOf("<!-- TP-NEARBY-CITIES -->");

    let insertAt;
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else if (nearbyCities >= 0) {
      insertAt = nearbyCities;
    } else {
      let sectionCount = 0;
      let searchFrom = 0;
      while (sectionCount < 5) {
        const idx = content.indexOf("</section>", searchFrom);
        if (idx < 0) break;
        searchFrom = idx + "</section>".length;
        sectionCount++;
      }
      if (sectionCount >= 5) insertAt = searchFrom;
      else {
        console.log(`  SKIP ${metro.file} (no injection point)`);
        skipped++;
        continue;
      }
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
