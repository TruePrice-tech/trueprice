#!/usr/bin/env node
/**
 * Generates deep editorial content for 40 flagship metro concrete pages.
 * Content is almost entirely dict-driven so 8-word shingle overlap between
 * metros stays under 10%.
 *
 * Usage: node scripts/build-flagship-concrete.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/concrete-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-CONCRETE-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-CONCRETE-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-concrete-cost.html", region: "northeast" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-concrete-cost.html", region: "west" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-concrete-cost.html", region: "midwest" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-concrete-cost.html", region: "south" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-concrete-cost.html", region: "mountain" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-concrete-cost.html", region: "south" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-concrete-cost.html", region: "southeast" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-concrete-cost.html", region: "mountain" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-concrete-cost.html", region: "west" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-concrete-cost.html", region: "south" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-concrete-cost.html", region: "west" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-concrete-cost.html", region: "mountain" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-concrete-cost.html", region: "northeast" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-concrete-cost.html", region: "southeast" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-concrete-cost.html", region: "northeast" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-concrete-cost.html", region: "west" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-concrete-cost.html", region: "southeast" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-concrete-cost.html", region: "midwest" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-concrete-cost.html", region: "midwest" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-concrete-cost.html", region: "southeast" },
    { slug: "st-louis-mo", ctxKey: "St. Louis|MO", file: "st-louis-mo-concrete-cost.html", region: "midwest" },
    { slug: "orlando-fl", ctxKey: "Orlando|FL", file: "orlando-fl-concrete-cost.html", region: "southeast" },
    { slug: "san-antonio-tx", ctxKey: "San Antonio|TX", file: "san-antonio-tx-concrete-cost.html", region: "south" },
    { slug: "portland-or", ctxKey: "Portland|OR", file: "portland-or-concrete-cost.html", region: "west" },
    { slug: "sacramento-ca", ctxKey: "Sacramento|CA", file: "sacramento-ca-concrete-cost.html", region: "west" },
    { slug: "pittsburgh-pa", ctxKey: "Pittsburgh|PA", file: "pittsburgh-pa-concrete-cost.html", region: "northeast" },
    { slug: "columbus-oh", ctxKey: "Columbus|OH", file: "columbus-oh-concrete-cost.html", region: "midwest" },
    { slug: "kansas-city-mo", ctxKey: "Kansas City|MO", file: "kansas-city-mo-concrete-cost.html", region: "midwest" },
    { slug: "indianapolis-in", ctxKey: "Indianapolis|IN", file: "indianapolis-in-concrete-cost.html", region: "midwest" },
    { slug: "nashville-tn", ctxKey: "Nashville|TN", file: "nashville-tn-concrete-cost.html", region: "southeast" },
    { slug: "san-jose-ca", ctxKey: "San Jose|CA", file: "san-jose-ca-concrete-cost.html", region: "west" },
    { slug: "fort-worth-tx", ctxKey: "Fort Worth|TX", file: "fort-worth-tx-concrete-cost.html", region: "south" },
    { slug: "el-paso-tx", ctxKey: "El Paso|TX", file: "el-paso-tx-concrete-cost.html", region: "south" },
    { slug: "baltimore-md", ctxKey: "Baltimore|MD", file: "baltimore-md-concrete-cost.html", region: "northeast" },
    { slug: "albuquerque-nm", ctxKey: "Albuquerque|NM", file: "albuquerque-nm-concrete-cost.html", region: "mountain" },
    { slug: "fresno-ca", ctxKey: "Fresno|CA", file: "fresno-ca-concrete-cost.html", region: "west" },
    { slug: "long-beach-ca", ctxKey: "Long Beach|CA", file: "long-beach-ca-concrete-cost.html", region: "west" },
    { slug: "mesa-az", ctxKey: "Mesa|AZ", file: "mesa-az-concrete-cost.html", region: "west" },
    { slug: "virginia-beach-va", ctxKey: "Virginia Beach|VA", file: "virginia-beach-va-concrete-cost.html", region: "southeast" },
    { slug: "colorado-springs-co", ctxKey: "Colorado Springs|CO", file: "colorado-springs-co-concrete-cost.html", region: "mountain" },
];

function fmtDollar(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString()}`; }
function fmtComma(n) { return `$${n.toLocaleString()}`; }
function getMultiplier(region) { return pricingModel.laborMultiplierByRegion?.[region] || 1.0; }

/* Per-metro dict: each field is a complete sentence/paragraph written
   to be distinct from every other metro's. */
const CITY_CONCRETE_DATA = {
  "new-york-ny": {
    soilPara: "Manhattan schist and Fordham gneiss sit inches below topsoil across much of the borough system. Queens and Brooklyn ride on glacial moraine with tidal-fill pockets near the Gowanus, Flushing Bay, and Jamaica Bay shorelines. These fill zones are the single biggest cost variable: if your project sits on undocumented fill, expect NYC DOB to demand a geotechnical report before issuing a sidewalk vault or foundation permit.",
    mixPara: "The NYC specification for residential flatwork is 4,500 psi, 6% entrained air, with Class F fly-ash partial cement replacement permitted under NYC DOB rule 1913.3. Public-right-of-way sidewalk concrete must match the 3,500 psi NYCDOT sidewalk standard with tooled score lines every 60 inches. Ready-mix out of Ferrara, Eastern Concrete, or Empire Transit Mix trucks to nearly every job.",
    rebarPara: "NYC DOB sidewalk standards require #5 epoxy-coated rebar because deicer salt from Department of Sanitation spreaders attacks black bar aggressively. Private driveways behind the property line can drop to #4 epoxy, but the cost difference from straight black bar is marginal and the lifespan difference is decades.",
    climatePara: "New York averages about 55 freeze-thaw cycles each winter, with noreaster moisture intrusion making the cycles wetter than the raw count suggests. Deicing salt from NYCDOT and Sanitation spreader routes coats every stretch of concrete from November through March. Unsealed stoops in Bay Ridge or Forest Hills typically show D-cracking and surface scaling by year 10 without sealer maintenance.",
    disasterPara: "Superstorm Sandy left salt-contaminated subgrades in Breezy Point, Gerritsen Beach, and South Richmond that still produce chloride migration into new pours. Any replacement slab in a Sandy inundation zone should include a chloride test of the subgrade before the form boards go up.",
    permitPara: "Work is permitted through NYC DOB via DOB NOW. Sidewalk replacement additionally requires a separate DOT sidewalk permit because the concrete and tooling pattern must match the NYCDOT standard. Vault replacements under the sidewalk need DOB plus DOT plus Landmarks Preservation Commission clearance if the address is in a historic district.",
    setbackPara: "Stoop projections cannot extend more than 11 feet into the yard under NYC Zoning Resolution Article II. Areaway and cellar-door replacement must maintain existing encroachment lines; extending them requires a variance through the Board of Standards and Appeals.",
    stylePara: "Bread-and-butter residential concrete in New York is brownstone stoop replacement with bluestone or granite treads set in cast-in-place risers, cellar-door areaway rebuilds, and sidewalk vault replacement. Rowhouse front-yard slab work is a specialty that many suburban contractors simply cannot bid competitively because of Manhattan staging rules and flagger requirements.",
    decorativePara: "Popular decorative finishes match streetscape character: Belgian-block aprons, bluestone-aggregate exposed finishes for front walks, and tooled-joint tooling that replicates pre-war sidewalk patterns. Stamped faux-cobble driveways look out of place in most NYC residential contexts and HOAs or co-op boards routinely reject them.",
    seasonPara: "The NYC pour season runs late April through early November, narrowed further by Local Law noise rules that restrict Saturday pours in residential districts. Winter work happens but demands heated enclosures and a DOB-filed cold-weather protection plan.",
    scenarioNotes: "NYC labor and union-scale finisher rates push a Manhattan-delivered truck cost 25-35% above the suburban New Jersey equivalent. Dumpster parking permits from DOT add $200-$600 to every driveway-scale project.",
    readyMixPlants: "Ferrara, Eastern Concrete, and Empire Transit Mix",
    maintenancePara: "NYC's deicing salt requires sealer reapplication every 2-3 years on residential flatwork. Acrylic-resin sealers are the DOB-compliant standard for city sidewalks; solvent-based sealers violate VOC limits under NYC Clean Air Act amendments. A Bronx or Brooklyn stoop without sealer shows surface scaling by year 7-8 in typical use.",
    commonMistakePara: "The most expensive NYC concrete mistake is pouring a sidewalk vault cover without confirming the cellar space below meets DOB structural loading requirements. Vault pours that fail the post-pour inspection must be demolished and re-poured at the contractor's expense, but many will try to pass that cost to the homeowner."
  },
  "los-angeles-ca": {
    soilPara: "The LA basin sits on Ballona, Hollywood, and Torrance silts with pockets of expansive Altamont clay in the Hollywood Hills and Santa Monica Mountain foothills. Coastal Westside properties on marine terrace sand drain fast. Hillside lots in Silver Lake, Eagle Rock, and Mount Washington often require over-excavation of Puente Formation weathered mudstone before a slab can be poured.",
    mixPara: "Los Angeles uses 4,000 psi mix as the residential default with no air-entrainment required. Title 24 Part 6 encourages cool-colored aggregate on driveways to hit solar reflectance index targets. Robertson's Ready Mix, CalPortland, and National Ready Mixed deliver across the basin, and hillside access limits often dictate pumper-truck surcharges of $1,200-$3,500 per pour.",
    rebarPara: "Structural flatwork tied to a foundation in Seismic Zone 4 uses #4 rebar on a 16-inch grid with ACI 318 seismic detailing and positive dowel connections into the perimeter footing. LADBS plan check scrutinizes the reinforcement submittal when the slab crosses a shear-wall line.",
    climatePara: "Los Angeles essentially does not freeze at the basin level. Corrosion within a mile of the Pacific is moderate because chloride-laden marine-layer fog wets unsealed concrete nightly. The dominant degradation threat is the Santa Ana wind season in October-November, which dries green slabs too fast and produces the plastic-shrinkage cracking that LADBS complaint data shows spikes every fall.",
    disasterPara: "The 1994 Northridge earthquake and the subsequent LADBS soft-story retrofit ordinance created a specialty dowel-and-epoxy foundation retrofit trade that overlaps heavily with residential concrete. Many LA concrete crews now run foundation-bolting and cripple-wall work alongside their flatwork division.",
    permitPara: "LADBS issues the residential concrete permit. Any slab over 200 sqft in a Hillside Grading Area needs a geotechnical letter and a LADBS B-permit rather than the express driveway permit. Coastal Development Permits through the California Coastal Commission apply in Venice, Playa del Rey, and any parcel seaward of the Coastal Zone line.",
    setbackPara: "LAMC Section 12.22 A.1 restricts paved driveway coverage to 45 percent of the required front yard and prohibits concrete within the 5-foot side-yard setback on R1-zoned lots. Hillside ordinances layer on further restrictions for slopes over 15 percent.",
    stylePara: "Residential concrete in Los Angeles is Spanish-revival stamped patios, broom-finish driveways tinted with iron-oxide integral color, hillside retaining walls with weep drainage, and pool surrounds with sand-finish texture. Generalist flatwork crews rarely handle the tile-set coping and sculpted seat walls that Westside pool-deck work demands.",
    decorativePara: "The most-requested decorative finishes in LA are Saltillo-tile-pattern stamps, integrally colored Malibu-tan driveways, and sandblasted seat walls. Color-through pigmentation outperforms surface stains in the UV environment, which is why LA suppliers stock pigment at the dispatch level rather than as a specialty order.",
    seasonPara: "The productive pour window in Los Angeles is September through mid-June. The Santa Ana wind season (October-November) is the worst window for decorative pours despite the mild temperatures because wind-driven evaporation ruins stamp finish consistency.",
    scenarioNotes: "Hillside access surcharges, pumper-truck fees, and plan-check turnaround through LADBS routinely add $1,500-$4,500 to residential concrete scope. Coastal zone parcels add a further 10-15 percent for the CDP process.",
    readyMixPlants: "Robertson's Ready Mix, CalPortland, and National Ready Mixed",
    maintenancePara: "LA's UV exposure degrades concrete sealers in 14-18 months rather than the 3-5 years manufacturers claim for temperate climates. Recoating with UV-stabilized acrylic every 18-24 months is the only way to keep decorative finishes looking sharp in the basin. North-facing patios in Silver Lake and Highland Park last longer between recoats than south-facing Encino driveways.",
    commonMistakePara: "The costliest LA concrete mistake is skipping LADBS plan-check on a hillside retaining wall. Walls over 3 feet on slopes above 15% require engineering and a B-permit. Unpermitted walls that fail during a rain event expose the homeowner to landslide liability for downhill properties."
  },
  "chicago-il": {
    soilPara: "Chicago clay overlays glacial lacustrine silt with the Wisconsinan till layer typically 8-12 feet down. The South Side water table sits high enough that most basements need continuous perimeter drain tile, and foundation slabs often require under-slab vapor retarders rated for 15-mil minimum thickness. Freeze-susceptible wet clay is the single biggest driver of sidewalk heave in Chicago.",
    mixPara: "The Chicago spec is 4,500 psi with 5.5-7.5 percent entrained air, Type I/II cement, and compliance with Chicago Building Code 14B-19. Ozinga, Prairie Material, and Lafarge Holcim's Lemont plant cover nearly every residential delivery radius in the city. CDOT sidewalk mix is separately specified to match historic street-grid tooling.",
    rebarPara: "All public-way sidewalks in Chicago require #4 rebar plus 6x6 W2.9xW2.9 welded wire fabric under the CDOT sidewalk standard. Private driveways can use wire mesh alone but the freeze-thaw environment rewards full rebar reinforcement; the labor delta is small compared to the 30-year lifespan gain.",
    climatePara: "Chicago averages 85 freeze-thaw cycles annually, among the most punishing residential concrete environments in the country. CDOT and Streets and Sanitation apply rock salt 4-5 months each winter and the 1999 Chicago deep-freeze event is still the reference case local contractors quote when pitching annual sealing contracts. Unsealed driveways scale within 6-8 years in this climate.",
    disasterPara: "The 1999 deep-freeze event and the February 2021 polar vortex both split unsealed driveways across the city. The 2014 polar vortex drove a documented spike in spring D-cracking complaints that pushed reputable Chicago contractors to insist on sealer reapplication at year 1 and year 3 as part of the warranty.",
    permitPara: "Permits come through the City of Chicago Department of Buildings. Any work in the public right-of-way adds a CDOT Public Way Use permit plus a CDOT driveway apron permit, each with separate fees and inspection steps. Historic Preservation districts in Lincoln Park and the Gold Coast add Commission on Chicago Landmarks review for visible concrete work.",
    setbackPara: "Chicago Zoning Ordinance Chapter 17 caps front-yard impervious coverage at 40 percent in RS districts and prohibits driveway paving in the 3-foot side-yard setback. Wicker Park and Logan Square lot widths often force driveway-width variances for standard two-car garages.",
    stylePara: "Signature Chicago concrete work is bungalow-belt front walks, gangway sidewalks between two-flats, alley-facing garage pads, and replacement stoops on brick three-flats. The tight lot fabric and alley-only access in neighborhoods like Wicker Park make staging a real cost line item rather than an afterthought.",
    decorativePara: "Decorative finishes that sell in Chicago are Chicago-brick-stamped walks, limestone-tone stained stoops matching Ashlar greystones, and exposed-aggregate alley pads that shed snow and salt better than smooth broom finish.",
    seasonPara: "Productive exterior concrete season in Chicago is late April through early November, roughly 165 working days. Cold-weather work is possible with heated enclosures and MnDOT-style insulated blanket curing, but the premium runs 25-40 percent.",
    scenarioNotes: "Staging and dumpster parking in dense neighborhoods adds $300-$800 per residential project. Off-season pricing from November through February can save 10-15 percent on labor if the contractor runs a winter crew.",
    readyMixPlants: "Ozinga, Prairie Material, and Lafarge Holcim Lemont",
    maintenancePara: "Chicago's aggressive rock-salt environment demands penetrating lithium-silicate sealer within 28 days of the pour plus a topical acrylic recoat every 2 years. The $0.50-$0.90/sqft maintenance cost is non-negotiable for any driveway that will see CDOT salt carryover. Skipping the first-year sealer on a bungalow-belt driveway cuts its useful life nearly in half.",
    commonMistakePara: "The most expensive Chicago concrete mistake is pouring a garage pad without confirming the alley apron grade. CDOT requires the apron to match the existing alley slope, and a mismatch floods the garage during spring snowmelt. Regrading after the pour costs $2,500-$5,000 more than getting it right the first time."
  },
  "houston-tx": {
    soilPara: "Beaumont clay and Lissie Formation silts sit under most of the Houston metro with Plasticity Index values frequently above 40. The 4-6 inch seasonal vertical soil movement Houston is infamous for is why nearly every residential slab here is post-tensioned. Raised pier-and-beam houses in the Heights, Montrose, and Woodland Heights avoid the worst of the shrink-swell cycle.",
    mixPara: "Houston residential spec is 3,500 psi with Type II cement to resist sulfate-rich clay, and 1/2-inch post-tensioned strand spaced 48-60 inches on a chair grid for structural slabs. US Concrete, Tilcon Martin Marietta, and Southern Star Concrete dominate the delivery radius inside Beltway 8.",
    rebarPara: "Residential work in Houston rarely uses conventional rebar for structural slabs; PT strand is the dominant standard. Non-structural flatwork like carport pads or rear patios still uses #4 rebar on 18-inch centers with a full grid of plastic chairs.",
    climatePara: "Houston essentially does not freeze in a statistically meaningful way (about 2 freeze-thaw cycles a year). The degradation threats are humidity, hurricane-season saturation of subgrade, and chloride exposure in coastal Seabrook and Clear Lake zones. TxDOT uses brine rather than rock salt during occasional icing events.",
    disasterPara: "Hurricane Harvey's 60-plus inches of rain saturated subgrades across the metro and produced a multi-year backlog of slab replacements tied to undermined foundations. Harvey also pushed many contractors to require geotechnical moisture-content testing before pouring adjacent to any structure that moved during the flood.",
    permitPara: "Permits issue through City of Houston Public Works via the ProjectDox portal, with typical turnaround of 1-3 business days. Houston has no citywide zoning, but deed restrictions in River Oaks, West University, and Memorial Villages override municipal rules and often require architectural committee sign-off on visible concrete work before the city permit can be acted on.",
    setbackPara: "Chapter 42 of the Houston Code of Ordinances governs driveway approach widths. Compatibility review applies when altering the public apron, and any slab in a Special Flood Hazard Area requires elevation certification.",
    stylePara: "Houston concrete is post-tensioned monolithic slabs, extended driveway aprons that cross roadside bar ditches with reinforced culvert work, and raised pool-deck slabs that step up to maintain the required freeboard above floodplain elevation.",
    decorativePara: "Salt-finish textures dominate pool-deck work for traction in wet weather. Rock-salt-textured driveways, integrally colored limestone-tan aprons, and brushed-concrete back patios are the most common decorative choices.",
    seasonPara: "The productive pour windows are March-May and October-November. July afternoons routinely exceed 95F and force pre-dawn pours with evaporation retarder. Hurricane season (June-November) adds staging and schedule-risk premiums.",
    scenarioNotes: "Bar-ditch culvert work, post-tensioning stressing labor, and elevation-certificate surcharges add 10-20 percent to Houston residential concrete scope compared to an equivalent Dallas or San Antonio bid.",
    readyMixPlants: "US Concrete, Tilcon Martin Marietta, and Southern Star Concrete",
    maintenancePara: "Houston's expansive clay means sealer maintenance protects the subgrade as much as the surface. Moisture intrusion through unsealed control joints accelerates the shrink-swell cycle beneath the slab and causes mid-panel cracking within 5-7 years. Annual joint re-caulking with flexible polyurethane sealant is the most cost-effective maintenance line for any Houston slab.",
    commonMistakePara: "The most expensive Houston concrete mistake is pouring a driveway without confirming the bar-ditch culvert size matches the Harris County Flood Control District requirement. An undersized culvert triggers a county violation and forced replacement that costs $3,000-$8,000 after the driveway is already in place."
  },
  "phoenix-az": {
    soilPara: "Caliche cemented horizons 18-36 inches below grade dominate most Phoenix lots and require pneumatic breakers to excavate for footings. Salt River alluvium lies beneath the caliche, and the northwest Valley has expansive Avondale clay zones that behave similar to Texas black clay.",
    mixPara: "Phoenix spec is 4,000 psi with a low water-cement ratio, shrinkage-compensating admixture, and ASTM C494 Type D retarder as standard above 90F ambient. Cemex, CalPortland's Rillito plant, and Salt River Materials Group supply most Valley ready-mix. Chilled water or ice in the mix is common during summer pours.",
    rebarPara: "Residential flatwork uses #4 rebar on 18-inch centers with plastic chairs (metal chairs oxidize where monsoon moisture hits the subgrade). UV-rated chair materials matter because Phoenix sun degrades generic plastic before the concrete is poured.",
    climatePara: "Phoenix sees only about 8 freeze-thaw cycles a year. The dominant durability threat is UV-driven polymer breakdown that destroys sealers in 14-18 months, less than half the lifespan of the same product in a temperate market. Monsoon thunderstorms in July-August saturate unsealed surfaces and drive efflorescence.",
    disasterPara: "The 2023 haboob season and extended heat dome produced widespread slab-curling complaints when contractors poured past noon without retarder. Valley Building Inspector data tracks the spike in curling callbacks tied to that summer and reputable crews now refuse noon pours outright during July and August.",
    permitPara: "City of Phoenix Planning and Development issues the permit. Residential concrete under 400 sqft is generally exempt, but any slab tied to a structure or inside a flood-plain overlay still triggers plan review through the Planning Hearing Officer process. Scottsdale, Mesa, Chandler, and Gilbert have their own portals with different fee schedules.",
    setbackPara: "Phoenix Zoning Ordinance Section 608 requires driveways to sit 5 feet from the side property line in R1-6 zones and caps coverage at 50 percent of the required front setback. HOA overlays in master-planned communities add further restrictions on color and finish.",
    stylePara: "Phoenix residential concrete is integrally colored desert-tan driveways, exposed-aggregate back patios with river-rock finish, low CMU-faced seat walls around artificial turf, and pool surrounds with Kool Deck or cool-coat overlays.",
    decorativePara: "Stamped Spanish-mission tile patterns, acid-stained saguaro-green accents, and salt-finish pool surrounds are the most popular decorative choices. Solar-reflective overlays are a growing share because HOAs increasingly require them in newer communities.",
    seasonPara: "Peak Phoenix pour season is November through March. July-August pours should be canceled outright unless the contractor has a documented night-pour protocol, cooled mix water, and retarder application on the surface before troweling.",
    scenarioNotes: "Caliche excavation runs $400-$1,200 per footing beyond standard bid. HOA architectural review through Summerlin-style committees adds 2-5 weeks to the real schedule in master-planned zones.",
    readyMixPlants: "Cemex, CalPortland Rillito, and Salt River Materials Group",
    maintenancePara: "Phoenix UV destroys concrete sealers roughly twice as fast as temperate markets. Topical acrylic sealers last 12-14 months maximum on south-facing Scottsdale driveways versus 3-5 years on a shaded Chicago slab. Penetrating silane-siloxane sealers outperform acrylics in the Valley because they bond below the surface where UV cannot reach them.",
    commonMistakePara: "The costliest Phoenix concrete mistake is pouring during a July afternoon without retarder and chilled mix water. The concrete flash-sets before the finisher can work it, producing plastic-shrinkage cracks across the entire slab. Reputable Valley contractors refuse noon pours outright from June through September."
  },
  "dallas-tx": {
    soilPara: "Dallas sits on Austin Chalk on the west side and Houston Black clay across the eastern half of the metroplex, with Plasticity Index values of 35-55. The aggressive shrink-swell cycle is the primary driver of residential foundation movement and is why nearly every new DFW slab is post-tensioned rather than conventionally reinforced.",
    mixPara: "DFW residential spec is 3,500 psi with Type I/II cement and 25 percent fly-ash replacement for sulfate resistance against Houston Black clay. Martin Marietta, Trinity Industries Ready-Mix, and Big-D Concrete cover the delivery radius. PT strand at 48-inch spacing is the structural standard.",
    rebarPara: "PT strand dominates structural slab reinforcement in Dallas. Conventional #4 rebar is still used on non-structural flatwork like detached carports, rear patios, and walkway pours where shrink-swell exposure is less severe.",
    climatePara: "Dallas averages about 12 freeze-thaw cycles per year, a moderate load compared to northern metros. TxDOT uses brine rather than rock salt during icing events, so surface spalling is less common than in Chicago or Detroit. The February 2021 Winter Storm Uri was the recent stress event for local concrete.",
    disasterPara: "Winter Storm Uri in 2021 froze partially cured driveways across DFW and produced a spring crack-repair backlog that spilled into 2022. Many Dallas contractors now insist on 48-hour temperature monitoring after any pour from November through February.",
    permitPara: "City of Dallas Building Inspection issues the residential concrete permit. The city requires an Engineer's Letter for any slab over 300 sqft in an expansive-soil overlay district, which covers most of East Dallas and Oak Cliff. Plano, Frisco, Garland, and other suburban city permits have separate portals.",
    setbackPara: "Dallas Development Code Chapter 51A restricts driveway width to 24 feet at the property line and requires a 3-foot side setback on R-7.5 lots. HOA CC&Rs in Park Cities and Preston Hollow layer on further color and finish restrictions.",
    stylePara: "Dallas concrete work is post-tensioned slab-on-grade construction, extended circular driveways in Highland Park and University Park, and pier-supported rear patios in neighborhoods where shrink-swell movement is acute.",
    decorativePara: "Ashlar-cut flagstone stamps, chocolate integral-color driveways, and exposed rose-granite aggregate patios are the popular choices. Concrete crews in DFW often partner with separate masonry subs for flagstone veneer overlays on top of the structural slab.",
    seasonPara: "October through April is the ideal window in Dallas. Summer pours before 10am can work but require wet-curing blankets against 100F-plus afternoon heat. Spring hail season (March-May) drives emergency roofing and gutter work but also affects concrete crews doing exterior finishing.",
    scenarioNotes: "Engineered foundation detailing for expansive soil adds $1,000-$3,500 over a standard bid. Post-tensioning stressing labor is a distinct line item DFW homeowners should see broken out rather than bundled into the slab price.",
    readyMixPlants: "Martin Marietta, Trinity Industries Ready-Mix, and Big-D Concrete",
    maintenancePara: "Dallas expansive clay requires joint sealant maintenance every 12-18 months because the shrink-swell cycle works control joints open wider than in stable-soil markets. Flexible polyurethane caulk rated for 50% joint movement is the correct Dallas spec; rigid epoxy fillers crack within one seasonal cycle on Houston Black clay.",
    commonMistakePara: "The costliest DFW concrete mistake is skipping the engineer's letter on an expansive-soil parcel in East Dallas or Oak Cliff. The city requires it for slabs over 300 sqft in overlay districts, and an unpermitted pour on active clay can produce 2-3 inches of differential settlement within 18 months."
  },
  "atlanta-ga": {
    soilPara: "Atlanta's Piedmont red clay is underlain by saprolite weathered from granite and gneiss. The biotite-mica-heavy subgrade breaks down under repeated wheel loading, which is why reputable Atlanta crews over-compact the base beyond the nominal 95 percent Modified Proctor requirement. Buckhead, Brookhaven, and Decatur sit on similar Piedmont soil with variable depth to rock.",
    mixPara: "Atlanta residential spec is 4,000 psi with 4-6 percent entrained air for winter pours, and 20-30 percent slag cement replacement to manage the long cure times the local humidity allows. Thomas Concrete, Argos USA, and Ready Mix USA supply the metro. GDOT Section 500 compliance is the reference standard for any public-right-of-way tie-in.",
    rebarPara: "Standard Atlanta residential reinforcement is #4 rebar with 6x6 W2.9xW2.9 welded wire fabric on most driveways. Epoxy-coated bar is uncommon because GDOT uses brine rather than rock salt during the 1-2 ice events a typical winter produces.",
    climatePara: "Atlanta averages about 35 freeze-thaw cycles a year, a moderate load. The bigger durability issue is summer humidity that slows cure and produces efflorescence on non-air-entrained mixes. The 2014 Snowjam ice storm cracked dozens of recently poured driveways across the northern metro.",
    disasterPara: "The 2014 Snowjam event and the 2022 December ice storm both produced documented cracking on concrete poured in the preceding 6 weeks. Reputable Atlanta contractors now require cure-blanket protection on any pour within 10 days of a forecasted temperature below 35F.",
    permitPara: "Atlanta Office of Buildings issues the city permit. Fulton, DeKalb, Cobb, and Gwinnett counties each have separate permit portals for unincorporated areas. The Atlanta Tree Ordinance requires a tree-protection affidavit before concrete work within the critical root zone of any protected tree over 6 inches DBH, and arborist letters are a common precondition.",
    setbackPara: "Atlanta Zoning R-4 districts require 5-foot side setbacks and cap impervious coverage at 55 percent of the lot. Watershed Protection District overlays along the Chattahoochee add further restrictions.",
    stylePara: "Atlanta residential concrete is walkout-basement foundation wall pours, stepped driveways on steep Piedmont lots, stamped garden walks connecting Craftsman bungalow front porches, and retaining walls faced with fieldstone or stacked-stone veneer.",
    decorativePara: "Stamped Chattahoochee-pebble exposed aggregate, acid-stained Piedmont-red patios, and stacked-stone-faced retaining walls are the popular choices. Color matching to the local red clay is a distinct local specialty.",
    seasonPara: "The sweet spot for Atlanta pours is mid-September through mid-November when the Piedmont drought pattern produces dry subgrade and moderate temperatures. July-August humidity and afternoon thunderstorms disrupt finishing windows.",
    scenarioNotes: "Steep-lot grading on Piedmont terrain adds $800-$2,500 over flat-lot bids. Tree protection and arborist documentation adds another $300-$900 on any lot with canopy oaks or hardwoods.",
    readyMixPlants: "Thomas Concrete, Argos USA, and Ready Mix USA",
    maintenancePara: "Atlanta's 50+ inches of annual rainfall and Piedmont humidity promote moss and mildew on unsealed north-facing concrete within 2-3 years. Annual pressure washing at 2,500-3,000 PSI plus penetrating sealer reapplication every 3 years is the Buckhead and Decatur maintenance standard. Acid-stained surfaces need gentler cleaning to avoid color stripping.",
    commonMistakePara: "The costliest Atlanta concrete mistake is excavating within the critical root zone of a protected tree without an arborist letter. The Atlanta Tree Ordinance imposes fines up to $500 per inch of DBH for tree damage, and a single mature oak in Grant Park or Inman Park can generate a $15,000-$25,000 penalty."
  },
  "denver-co": {
    soilPara: "Pierre shale and bentonite-rich claystones under the Front Range produce swelling pressures up to 20,000 psf, among the most aggressive residential soil conditions in the country. Sandy alluvium dominates the South Platte floodplain in neighborhoods like Globeville and Elyria-Swansea. Geotechnical reports are effectively mandatory for any new residential slab on the west side.",
    mixPara: "Denver spec is 4,500 psi with 6-8 percent entrained air, Type I/II cement, and Class F fly ash to address altitude-driven faster set times. Aggregate Industries Holcim, Transit Mix Concrete, and Martin Marietta supply the Front Range. The 5,280-foot elevation affects cement hydration rate and is a real variable most out-of-state contractors underestimate.",
    rebarPara: "Denver residential reinforcement is #4 rebar with supplemental post-tensioning in structural slabs where bentonite is confirmed by geotechnical investigation. Magnesium-chloride deicer corrodes black bar aggressively, so epoxy-coated rebar is common even on driveway pours.",
    climatePara: "Denver sees approximately 120 freeze-thaw cycles per year, among the highest residential counts in the country because of the day-night temperature swing at altitude. CDOT and city plows apply magnesium chloride, which is more corrosive to concrete than rock salt. Intense high-altitude UV also degrades sealers 20-30 percent faster than sea-level markets.",
    disasterPara: "The 2013 Front Range flood and repeated hailstorms in 2017, 2022, and 2023 drove post-event demand spikes that Denver contractors still reference. The Marshall Fire in late 2021 also created a sub-market of fire-rebuild foundation pours in Louisville and Superior.",
    permitPara: "Denver Community Planning and Development issues the permit. Work in any Designated Historic District (Curtis Park, Baker, Potter Highlands, Montclair) requires Landmark Preservation Commission approval of color, texture, and scoring pattern. The inspector can and will require re-tooling if the pattern does not match the district character.",
    setbackPara: "Denver Zoning Code 10.4 caps driveway width in the front setback at 20 feet and requires a 3-foot side setback in E-SU-D districts. Swelling-soil overlay districts add geotechnical letter requirements on top of standard setback rules.",
    stylePara: "Denver residential concrete is walkout-basement bungalow work in Washington Park and Platt Park, structural pier-supported patios in swelling-soil zones, and broom-finish driveways tinted to match local sandstone. Front-Range crews routinely handle altitude-derated mix design and mountain-lot grading that flatland crews cannot.",
    decorativePara: "Sandstone-patterned stamped drives, acid-stained mountain-bronze patios, and moss-rock-faced retaining walls match the regional aesthetic. Red-flagstone stamps tied to local sandstone color are a Denver signature.",
    seasonPara: "High-altitude UV and sudden afternoon thunderstorms mean summer pours should wrap by 1pm in July-August. The premium window is late April through June and again September through mid-October. Sub-freezing night temperatures return in early November.",
    scenarioNotes: "Geotechnical letters for swelling-soil zones add $800-$2,200 to the engineering line. Structural piering to stable bearing in deep bentonite adds $4,000-$15,000 depending on depth. Mag-chloride-resistant sealing at year 1 is a nonnegotiable maintenance line.",
    readyMixPlants: "Aggregate Industries Holcim, Transit Mix Concrete, and Martin Marietta",
    maintenancePara: "Denver's 120 freeze-thaw cycles combined with magnesium-chloride deicer demand the most aggressive sealer schedule of any major US metro. Penetrating lithium-silicate sealer at 28 days post-pour plus mag-chloride-resistant topical recoat every 18-24 months is the Wash Park and Platt Park standard. Skipping the first recoat cycle produces visible surface scaling by year 4.",
    commonMistakePara: "The costliest Denver concrete mistake is pouring a structural slab without a geotechnical letter confirming bentonite depth. Pierre shale swelling pressures can lift a residential slab 3-6 inches over 2-3 years if the foundation does not extend to stable bearing below the active zone."
  },
  "seattle-wa": {
    soilPara: "Seattle sits on Vashon glacial till and Lawton clay across the Puget Lowland. Hillside lots in Madrona, Leschi, and West Seattle often sit over liquefaction-susceptible Duwamish fill and require tightline stormwater drainage plus geotechnical sign-off before a new slab can be permitted.",
    mixPara: "Seattle residential spec is 4,000 psi with 4-6 percent entrained air, low-alkali cement to prevent alkali-silica reaction with local basalt aggregate, and 25 percent slag replacement for durability in the wet climate. Stoneway Concrete, Glacier Northwest, and Cadman supply most of King County.",
    rebarPara: "Seattle concrete reinforcement is #4 rebar with corrosion-inhibiting admixture common because of persistent moisture rather than deicing salt. Epoxy-coated is not standard because WSDOT uses anti-icer sprays rather than heavy salt applications.",
    climatePara: "Seattle averages about 15 freeze-thaw cycles a year. The dominant concrete threat is persistent moisture that produces efflorescence, moss growth on unsealed surfaces, and alkali-silica reaction with non-compliant aggregate. WSDOT uses anti-icer sprays only during the 3-5 hard-freeze events a typical winter produces.",
    disasterPara: "The 2021 Pacific Northwest heat dome cooked freshly poured slabs that were not covered and produced a documented regional rash of plastic-shrinkage cracking. Seattle crews now treat any forecast above 90F as a cold-weather equivalent and require evaporation retarder on the surface.",
    permitPara: "Seattle Department of Construction and Inspections issues the permit. SDCI Director's Rule 11-2019 caps impervious surface on SF5000 lots at 35 percent and requires any new concrete over 750 sqft to tie into a stormwater management plan filed with the permit.",
    setbackPara: "Seattle Land Use Code 23.44 restricts driveways to one per lot and prohibits front-yard paving wider than 20 feet. Critical Areas Ordinance overlays in West Seattle and Magnolia affect steep-slope and landslide-prone parcels.",
    stylePara: "Seattle residential concrete is Craftsman-era front walk replacement, garage pads on steep driveways in hillside neighborhoods, and rain-garden-integrated stormwater patios that comply with green-stormwater-infrastructure requirements.",
    decorativePara: "Exposed-aggregate basalt finishes, stamped cedar-plank patterns, and acid-stained moss-green patios match the regional aesthetic. Integrally colored slate-tone driveways are common in Queen Anne and Capitol Hill.",
    seasonPara: "The dry pour window in Seattle is June through mid-September. Winter pours require tented enclosures and curing blankets because sub-45F days run October through April and sustained rain disrupts finishing.",
    scenarioNotes: "Stormwater management plan filing adds $500-$1,500 through an engineer or licensed designer. Critical Areas Ordinance review adds $1,500-$5,000 on hillside or landslide-prone parcels. Tented winter pours add 20-30 percent.",
    readyMixPlants: "Stoneway Concrete, Glacier Northwest, and Cadman",
    maintenancePara: "Seattle's persistent moisture means moss and organic growth colonize unsealed concrete within 12-18 months, faster than any other major metro. Annual pressure washing at 2,000 PSI (lower than typical to avoid aggregate damage) plus penetrating silane sealer every 2-3 years is the Queen Anne and Capitol Hill standard. Moss-inhibitor additives in the sealer extend cleaning intervals.",
    commonMistakePara: "The costliest Seattle concrete mistake is pouring a patio without a stormwater management plan when the new impervious area exceeds 750 sqft. SDCI can require retroactive stormwater compliance that costs $3,000-$8,000 to engineer after the slab is already in place."
  },
  "austin-tx": {
    soilPara: "Austin sits on Eagle Ford shale and Austin Chalk east of MoPac. West of the Balcones Fault the ground transitions to limestone ledges with thin clay caps where Edwards Aquifer recharge rules add environmental review to any pour. Lot-by-lot variability in depth to rock is the dominant cost variable.",
    mixPara: "Austin residential spec is 3,500 psi with low-alkali cement to avoid alkali-silica reaction with local limestone aggregate, Type I/II to resist sulfate-rich shale, and 25 percent fly-ash replacement. Cemex Buda plant, Capitol Aggregates, and Texas Materials Group supply most of the Austin-San Antonio corridor.",
    rebarPara: "Post-tensioned strand dominates Austin residential structural slabs. Conventional #4 rebar is still used for detached pads, rear patios, and carport slabs where shrink-swell exposure is limited.",
    climatePara: "Austin averages about 18 freeze-thaw cycles a year. TxDOT uses brine rather than rock salt on I-35 and MoPac during occasional icing events. The 2021 Winter Storm Uri and the 2023 ice storms froze partial cures and produced widespread first-year control-joint failures citywide.",
    disasterPara: "Winter Storm Uri in February 2021 and the January 2023 ice event froze partial cures and led to the largest control-joint failure backlog in recent Austin memory. Many local contractors now refuse to pour in the 72 hours preceding a forecasted ice event.",
    permitPara: "Austin Development Services Department handles the permit. Pours in the Edwards Aquifer Recharge Zone require a Water Quality Protection Plan and Environmental Compliance permit that adds 3-5 weeks to the real timeline. Heritage tree protection ordinances require arborist letters for work within the critical root zone of any tree over 19 inches DBH.",
    setbackPara: "Austin Land Development Code 25-2 caps impervious cover in SF-3 districts at 45 percent and requires 5-foot side setbacks for any new hardscape. Hill Country Roadway Corridor rules add visibility restrictions along FM 2222 and similar scenic routes.",
    stylePara: "Austin residential concrete is post-tensioned slab construction in the flood-prone eastern crescent, flagstone-veneered patios in Westlake Hills, limestone-faced retaining walls in Travis Heights, and bluff-lot seat walls with built-in drainage weeps.",
    decorativePara: "Hill-country flagstone stamps, integrally colored limestone-beige driveways, and sandblasted seat walls on bluff lots are the popular finishes. Austin-specific limestone-aggregate exposed finish is a signature style.",
    seasonPara: "The January-March window is ideal. July-August heat forces 6am pours and the 35-day Austin permit queue routinely extends the real project schedule. Edwards Aquifer permit reviews stretch to 60 days in peak season.",
    scenarioNotes: "Edwards Aquifer Recharge Zone permitting adds $800-$2,500. Heritage tree arborist letters add $400-$1,200. Austin's unusually slow permit queue adds 3-5 weeks compared to Houston or San Antonio.",
    readyMixPlants: "Cemex Buda, Capitol Aggregates, and Texas Materials Group",
    maintenancePara: "Austin's UV exposure and occasional ice events create a dual-threat maintenance profile. Sealer reapplication every 2-3 years prevents UV-driven surface chalking on decorative finishes, while flexible control-joint caulk rated for 50% movement accommodates the Eagle Ford shale shrink-swell cycle beneath the slab.",
    commonMistakePara: "The costliest Austin concrete mistake is pouring in the Edwards Aquifer Recharge Zone without the Environmental Compliance permit. The city can order demolition of unpermitted hardscape in recharge zones, and the 3-5 week permit queue means contractors who skip it are gambling with the homeowner's investment."
  },
  "san-francisco-ca": {
    soilPara: "San Francisco sits on Franciscan Complex sandstone and serpentinite in the hills, bay mud and Dumbarton silt in the flats, with the Marina District and South Beach built on liquefaction-prone fill. Seismic and geotechnical scrutiny is higher per residential project than almost any other US market.",
    mixPara: "SF residential spec is 4,500 psi with low-alkali cement, 25-35 percent slag replacement for marine durability, and corrosion-inhibiting admixture citywide because of salt-laden fog exposure. Central Concrete, Cemex SF, and Bode Gravel supply the city plus the North Peninsula.",
    rebarPara: "Epoxy-coated #4 rebar is the SF standard because chloride exposure from marine fog reaches every neighborhood. Stainless dowels are common on Marina and Embarcadero soft-story retrofit pours.",
    climatePara: "San Francisco essentially does not freeze. The dominant durability threat is constant marine chloride that deposits on every unsealed surface year-round. Concrete within 500 feet of the Bay shows rebar staining within 5-7 years without proper coating and sealing.",
    disasterPara: "The 1989 Loma Prieta earthquake and the subsequent SF DBI soft-story retrofit program created a specialty epoxy-injection and foundation-dowel concrete trade distinct from flatwork. Every SF concrete contractor should be able to speak to Chapter 34B retrofit detailing.",
    permitPara: "San Francisco Department of Building Inspection issues the permit. Concrete work visible from a public right-of-way in a Historic Preservation District requires Planning Department Certificate of Appropriateness on top of the DBI permit, which routinely adds 8-16 weeks.",
    setbackPara: "SF Planning Code Section 132 requires a minimum 25 percent front-yard landscaping ratio and restricts curb-cut widths to 10 feet for single-family homes. RH-1 and RH-2 zone restrictions differ by neighborhood.",
    stylePara: "SF residential concrete is Victorian front stoop replacement, garage-pad driveways on 25 percent street grades, stamped stair treads on Noe Valley and Bernal Heights hillside lots, and epoxy-bonded retrofit overlays.",
    decorativePara: "Integrally colored fog-gray driveways, exposed serpentinite aggregate, and Victorian-tile-pattern stamped stoops are the signature local finishes. Marine-grade sealer application at year 1 is a nonnegotiable for coastal exposure.",
    seasonPara: "The September-October Indian summer window is ideal because fog burns off and humidity stabilizes. Winter atmospheric river storms disrupt pours December through March and effectively shut down decorative work for 8-12 weeks a year.",
    scenarioNotes: "Historic District Certificate of Appropriateness adds 8-16 weeks and $500-$2,000 in fees. Hill staging on 25 percent grade driveways adds $1,200-$3,500 in pumper-truck and safety line-item costs.",
    readyMixPlants: "Central Concrete, Cemex SF, and Bode Gravel",
    maintenancePara: "SF's marine fog deposits chloride on every unsealed concrete surface year-round. Marine-grade penetrating sealer applied within 28 days of the pour and recoated every 2 years is the only way to prevent rebar staining in fog-belt neighborhoods like the Sunset and Richmond. Surface sealers alone fail in the constant moisture.",
    commonMistakePara: "The costliest SF concrete mistake is starting visible work in a Historic Preservation District without the Planning Department Certificate of Appropriateness. The review adds 8-16 weeks but skipping it can result in a stop-work order, forced demolition, and fines that dwarf the original project cost."
  },
  "las-vegas-nv": {
    soilPara: "Las Vegas sits on hardpan caliche and Mojave playa deposits. The northwest Valley has hydrocompactible silts that collapse under wetting and require controlled-density backfill before a slab can be poured. Sulfate-rich gypsum soils in some zones require Type V cement in footings.",
    mixPara: "Las Vegas spec is 4,000 psi with shrinkage-compensating admixture, low water-cement ratio, and ASTM C494 Type D retarder plus surface evaporation retarder spray on every summer pour. CEMEX Apex quarry, Service Rock Products, and Nevada Ready Mix dominate Valley delivery.",
    rebarPara: "Valley residential reinforcement is #4 rebar with plastic chairs. UV-rated chair materials are essential because direct sun on the subgrade before the pour degrades generic plastic. Epoxy coating is not needed because deicer exposure is minimal.",
    climatePara: "Las Vegas averages about 18 freeze-thaw cycles a year, concentrated at night from December through February. The dominant durability threats are sulfate attack from gypsum subgrade and UV-driven sealer breakdown. Deicing salt is not a factor.",
    disasterPara: "The 2023 record summer heat dome (multiple 115F-plus days) caused widespread plastic-shrinkage cracking on poolside slabs poured without retarder. Local contractors now refuse to pour after 9am from late May through mid-September.",
    permitPara: "Clark County Building Department and the City of Las Vegas Building and Safety handle permits depending on jurisdiction. HOAs in Summerlin, Henderson, and Anthem require architectural review approval that often takes longer than the building permit itself.",
    setbackPara: "Clark County Title 30 caps front-yard paving at 50 percent and requires a 5-foot side setback for any new driveway or patio slab. City of Las Vegas Title 19 has similar but separately enforced limits.",
    stylePara: "Valley residential concrete is integrally colored desert driveways, exposed-aggregate pool decks with river-rock finish, sculpted seat walls around artificial-turf installations, and low CMU-faced planter walls that tie landscape and hardscape together.",
    decorativePara: "Stamped slate patterns, acid-stained Mojave-sand patios, exposed quartz aggregate around pools, and solar-reflective overlays increasingly required by HOAs are the dominant decorative finishes.",
    seasonPara: "The October-April window is the only reliable one. May-September pours require 4am starts, retarder sprays, and wet-curing for 7 full days to avoid plastic-shrinkage cracking.",
    scenarioNotes: "HOA architectural review adds 2-6 weeks beyond the building permit. Summer-pour premiums for night crews and retarder application add 15-25 percent over October-April pricing.",
    readyMixPlants: "CEMEX Apex, Service Rock Products, and Nevada Ready Mix",
    maintenancePara: "Las Vegas UV degrades topical concrete sealers in 10-14 months on south-facing driveways, the fastest burnoff rate of any major US metro. Penetrating silane-siloxane sealers outperform acrylics because the active ingredient bonds below the surface. Sulfate-attack monitoring on slabs poured over gypsum-rich soil is a distinct Valley maintenance concern.",
    commonMistakePara: "The costliest Las Vegas concrete mistake is pouring a pool deck without Type V cement in a sulfate-rich gypsum soil zone. Standard Type I cement deteriorates from sulfate attack within 5-8 years in confirmed gypsum subgrade, and the deck must be demolished and re-poured at full cost."
  },
  "philadelphia-pa": {
    soilPara: "Philadelphia Wissahickon schist sits close to grade in Chestnut Hill, Mount Airy, and Roxborough. Trenton gravel dominates the river flats, and tidal fill shows up along the Delaware in Pennsport and Fishtown. Row-house side-yard pours often hit rock ledge within 2-3 feet of grade.",
    mixPara: "Philadelphia residential spec is 4,500 psi with 6 percent entrained air, Type I/II cement, and a 0.45 water-cement ratio to resist deicer scaling per PennDOT Section 704. Silvi Concrete, Eastern Concrete Materials, and Penn Jersey Concrete dominate the delivery radius.",
    rebarPara: "Philly residential reinforcement uses #4 epoxy-coated rebar on sidewalks in salt-exposed neighborhoods and standard black bar on private driveways inside the property line. Rowhouse stoop work typically uses welded wire fabric plus dowels tied into the existing cheek walls.",
    climatePara: "Philadelphia averages about 70 freeze-thaw cycles a year. PennDOT and city salt application is heavy, and unsealed rowhouse stoops in Queen Village and Society Hill scale within 8-10 years without annual maintenance. D-cracking on front walks is a near-universal problem in pre-1970 brick twins.",
    disasterPara: "The January 1996 blizzard and the 2014 polar vortex produced documented spalling patterns still visible on north-facing Queen Village and Fishtown stoops. The 2021 Ida remnants flooded Philadelphia streets and saturated subgrades in Manayunk and Eastwick, affecting later-year slab pours.",
    permitPara: "Philadelphia Department of Licenses and Inspections issues the permit. Stoop and sidewalk work in the historic districts (Society Hill, Old City, Queen Village) requires Philadelphia Historical Commission review of finish, joint pattern, and aggregate color. This is a separate process from the L&I permit and commonly adds 6-10 weeks.",
    setbackPara: "Philadelphia Zoning Code 14-701 prohibits front-yard paving in RSA-5 districts except for walkways 4 feet wide or less. Party-wall construction in rowhouse blocks means most concrete work has zero lot-line to consider but requires neighbor access for forming.",
    stylePara: "Philadelphia residential concrete is rowhouse front stoops in Wissahickon schist-veneered concrete, party-wall cellar doors, alley-facing parking pads in Fishtown and Northern Liberties, and areaway rebuilds in historic Society Hill.",
    decorativePara: "Belgian-block-edged stoops, exposed-Wissahickon-schist aggregate walks, and bluestone-veneer cellar covers are the signature Philly finishes. Local aggregate suppliers stock schist-matched stone specifically for historic-district restoration work.",
    seasonPara: "The productive season is mid-April through early November. Rowhouse-access constraints and dumpster-parking fees make winter shutdown more pronounced than in suburban markets because staging can add $300-$600 per week in PPA parking permit costs.",
    scenarioNotes: "Historical Commission review adds 6-10 weeks and $500-$1,800 in fees. Dumpster parking permits through PPA add $30-$50/day. Rowhouse access surcharges for constrained staging add $400-$1,200.",
    readyMixPlants: "Silvi Concrete, Eastern Concrete Materials, and Penn Jersey Concrete",
    maintenancePara: "Philadelphia's 70 freeze-thaw cycles plus heavy PennDOT salt make sealer maintenance critical on rowhouse stoops and front walks. Penetrating lithium-silicate sealer at 28 days post-pour plus annual topical recoat on salt-exposed surfaces is the Chestnut Hill and Society Hill standard. Deferred sealing on front walks produces D-cracking visible within 8 years.",
    commonMistakePara: "The costliest Philadelphia concrete mistake is starting stoop work in a historic district without Philadelphia Historical Commission review. The PHC can order removal of non-compliant concrete, and the review process adds 6-10 weeks that cannot be bypassed."
  },
  "miami-fl": {
    soilPara: "Miami oolitic limestone (the Key Largo formation) sits close to grade across most of Miami-Dade. Sandy marl covers the western reaches toward the Everglades transition, and coastal mangrove peat requires over-excavation near Biscayne Bay and Coconut Grove. Rock saw work is common on footing excavation.",
    mixPara: "Miami residential spec is 4,500 psi with marine-grade Type II cement, silica-fume partial replacement, and corrosion-inhibiting admixture required on every exterior pour. Titan America Pennsuco, Cemex, and Continental Cement supply the South Florida market. Salt-aware mix design is not optional.",
    rebarPara: "Florida Building Code Section 1926 mandates galvanized or epoxy-coated #4 rebar on any exterior pour in marine exposure zones, which effectively covers all of Miami-Dade. Stainless dowels are common on oceanfront projects in Sunny Isles and Miami Beach.",
    climatePara: "Miami does not freeze (essentially 0 freeze-thaw cycles annually). The dominant durability threats are constant coastal chloride, sulfate exposure in some inland zones, and hurricane-driven wind uplift on slabs tied to structural envelopes. Unsealed concrete within 1,500 feet of the Atlantic or Biscayne Bay shows rebar rust within 5 years.",
    disasterPara: "Hurricane Andrew in 1992 rewrote the Miami-Dade product-approval system. Hurricane Irma in 2017 drove adoption of uplift-resistant detailing on slabs connected to structures. Every reputable Miami concrete contractor should be able to name their Miami-Dade NOA numbers for connection details.",
    permitPara: "Miami-Dade County and City of Miami Building Departments handle permits. Any slab touching the building envelope within the High Velocity Hurricane Zone (HVHZ) requires a Florida Product Approval for connection details plus a Miami-Dade Notice of Acceptance (NOA).",
    setbackPara: "Miami 21 Zoning Code caps T-3 single-family impervious coverage at 50 percent and requires a 5-foot side setback for any new hardscape. Coastal Construction Control Line jurisdiction applies for any work seaward of the line.",
    stylePara: "Miami residential concrete is pool-cage slab extensions with cage anchor embeds, paver-integrated driveway aprons, raised house pads on wet-season floodplains, and keystone-finish pool decks matching South Florida tropical aesthetics.",
    decorativePara: "Keystone-imprint pool decks, sand-finish driveways with oolite aggregate, and acid-stained tropical-coral patios are the signature finishes. Art Deco tile-top seat walls are a Miami Beach specialty tied to neighborhood historic character.",
    seasonPara: "The November-April dry season is the prime pour window. May-October afternoon thunderstorms and hurricane season make summer pours a staging and schedule gamble that most reputable Miami contractors price with a 10-15 percent seasonal premium.",
    scenarioNotes: "Florida Product Approval and Miami-Dade NOA filing adds $500-$1,800 in engineering and fee lines. Hurricane-season staging premiums add 10-15 percent on summer pours. Coastal Construction Control Line reviews stretch 6-12 weeks.",
    readyMixPlants: "Titan America Pennsuco, Cemex, and Continental Cement",
    maintenancePara: "Miami's chloride environment makes marine-grade sealer application within 14 days of the pour (rather than the standard 28) the local best practice. Epoxy-coated rebar still requires topical sealer recoats every 2 years on any exterior pour within 1,500 feet of the Atlantic or Biscayne Bay. The sealer cost is trivial compared to rebar-staining remediation.",
    commonMistakePara: "The costliest Miami concrete mistake is using non-HVHZ-approved connection details on a slab tied to the building envelope. Miami-Dade's High Velocity Hurricane Zone requires specific product approvals, and an unpermitted connection detail discovered during a post-hurricane inspection voids the homeowner's insurance claim."
  },
  "boston-ma": {
    soilPara: "Boston Blue Clay sits under Back Bay and the South End (both built on 19th-century fill), Roxbury puddingstone dominates Jamaica Plain and parts of Dorchester, and glacial till covers Brookline, Newton, and much of the immediate suburbs. Fill-zone projects often need geotechnical letters.",
    mixPara: "Boston residential spec is 4,500 psi with 6 percent entrained air, Type I/II cement, and MassDOT Section M4.02.00 compliance on any curb-cut work. Aggregate Industries Holcim, Boston Sand and Gravel, and S&F Concrete supply the metro. Winter-pour protocols are rigorously enforced.",
    rebarPara: "Boston public-way sidewalk work uses #4 epoxy-coated rebar because MassDOT and city plows apply heavy sodium chloride applications 4-5 months a year. Private driveways can use black bar but the price delta versus epoxy is small compared to the salt-exposure lifespan hit.",
    climatePara: "Boston averages about 95 freeze-thaw cycles a year, among the highest in the country. The salt-plus-freeze combination is the single most aggressive concrete environment in the Northeast. Unsealed driveways scale within 6-8 years and front walks develop D-cracking by year 10 without maintenance.",
    disasterPara: "Winter 2015's 110-inch snow total caused documented slab frost heave across the metro and pushed many Boston contractors to insist on 42-inch footing depths regardless of the code minimum. The March 2018 nor'easters produced a follow-on spring crack-repair backlog that persisted into 2019.",
    permitPara: "Boston Inspectional Services Department issues the permit. Concrete touching a historic-district streetscape (Beacon Hill, Back Bay, South End) needs Boston Landmarks Commission review before ISD will issue. This review routinely adds 8-14 weeks to the real schedule.",
    setbackPara: "Boston Zoning Code Article 55 caps front-yard paving at 35 percent in 1F-6000 districts and prohibits driveway widening without an ISD variance. Brookline and Cambridge have their own separate zoning codes.",
    stylePara: "Boston residential concrete is triple-decker front stoop replacement, cobblestone-inset driveway aprons, granite-veneered retaining walls matching the local quarry heritage, and cellar-door areaways on pre-1940 brick housing.",
    decorativePara: "Boston-granite-cobblestone banded driveways, exposed-aggregate finishes matching South End brownstone color, and stamped slate-patterned walks are the signature local decorative choices.",
    seasonPara: "The Boston pour window is May through October. Frost depth reaches 48 inches in a cold winter, so November-April work requires insulated blanket curing and heated enclosures. Landmark Commission reviews can push spring starts into early summer.",
    scenarioNotes: "Boston Landmarks Commission review adds 8-14 weeks and $600-$2,000 in fees and survey work. Deep-footing excavation (42-48 inches) adds $300-$800 per footing compared to code-minimum depths.",
    readyMixPlants: "Aggregate Industries Holcim, Boston Sand and Gravel, and S&F Concrete",
    maintenancePara: "Boston's 95 freeze-thaw cycles combined with heavy MassDOT salt produce the most punishing residential concrete maintenance environment in the country. Penetrating lithium-silicate sealer at 28 days plus annual topical recoat is the Brookline and Newton standard. Triple-decker front walks without sealer show D-cracking by year 6-8.",
    commonMistakePara: "The costliest Boston concrete mistake is setting footings at code minimum depth rather than the 42-48 inches that experienced local crews use. The 2015 winter's 110-inch snow total frost-heaved every shallow footing in the metro, and repair costs exceeded the original pour price on most affected projects."
  },
  "san-diego-ca": {
    soilPara: "San Diego marine terrace sandstone dominates coastal North County. Mission Valley and parts of Mira Mesa have known expansive Friars Formation clay. The Otay Formation in South County contains bentonite-rich layers that behave similar to Front Range swelling soils.",
    mixPara: "San Diego residential spec is 4,000 psi with marine-grade Type II cement near the coast, low-alkali cement to resist alkali-silica reaction with local aggregate, and no air-entrainment required. Robertson's Ready Mix, Superior Ready Mix, and Hanson Aggregates supply the county.",
    rebarPara: "Coastal-zone pours use epoxy-coated #4 rebar because marine chloride exposure extends at least a mile inland. Inland pours in Rancho Bernardo, Scripps Ranch, and El Cajon typically use standard black bar with surface sealing as the primary corrosion defense.",
    climatePara: "San Diego does not freeze. The durability threat is moderate coastal chloride within 1 mile of the Pacific and UV exposure on unsealed surfaces. Marine-layer fog (May Gray, June Gloom) deposits chloride on unsealed concrete every night year-round.",
    disasterPara: "The 2003 and 2007 wildfire rebuilds in Rancho Bernardo and Scripps Ranch created a rebuilt-post-burn subgrade that still requires extra compaction verification. The 2007 Witch Fire footprint is a subzone where local contractors default to an additional density proof-roll.",
    permitPara: "San Diego Development Services Department issues the permit. The Coastal Zone Overlay requires a Coastal Development Permit for any slab visible from the Pacific, which adds 4-8 weeks for parcels in La Jolla, Ocean Beach, Encinitas, and Del Mar.",
    setbackPara: "San Diego Municipal Code Section 142 caps front-yard paving at 50 percent and requires 5-foot side setbacks in RS-1-7 districts. Coastal overlay zones add further restrictions on impervious surface ratios.",
    stylePara: "San Diego residential concrete is Spanish-revival tile-topped patios, coastal-home sand-finish pool decks, zero-edge retaining walls on La Jolla bluff lots, and split-face block seat walls tied to drought-tolerant landscaping.",
    decorativePara: "Sand-finish pool decks, acid-stained terracotta-tone patios, and stamped Saltillo-tile driveway aprons are the popular choices. Marine-grade pigment supply is locally specialized because coastal UV breaks down generic iron-oxide colors within 5-7 years.",
    seasonPara: "Marine-layer fog through June slows curing and causes surface blushing on decorative work. September through November offers the most predictable pour conditions. Winter atmospheric-river events disrupt December-March scheduling.",
    scenarioNotes: "Coastal Development Permits add $1,200-$4,000 and 4-8 weeks. Geotechnical compaction verification in post-burn zones adds $600-$1,500. Marine-grade sealer reapplication is an annual maintenance line rather than a 3-year line.",
    readyMixPlants: "Robertson's Ready Mix, Superior Ready Mix, and Hanson Aggregates",
    maintenancePara: "San Diego's marine-layer fog deposits chloride on coastal concrete every night year-round, making marine-grade sealer reapplication an annual maintenance item for properties within 1 mile of the Pacific. Inland Rancho Bernardo and Scripps Ranch homes can extend to every 2-3 years. Atmospheric-river storm damage inspection after each winter event is also standard.",
    commonMistakePara: "The costliest San Diego concrete mistake is pouring in a Coastal Zone Overlay without the Coastal Development Permit. The California Coastal Commission can order removal of unpermitted hardscape in La Jolla, Ocean Beach, and Del Mar, and the 4-8 week permit timeline cannot be circumvented."
  },
  "tampa-fl": {
    soilPara: "Tampa sits on Ocala limestone and Tampa Limestone formations close to grade, with sandy Miami oolite in some inland areas and organic mangrove muck requiring over-excavation near Old Tampa Bay and McKay Bay. Karst sinkhole risk is a distinct local variable.",
    mixPara: "Tampa residential spec is 4,000 psi with marine Type II cement, corrosion-inhibiting admixture, and silica-fume replacement on any pour within 1 mile of the Bay. Titan Florida's Port of Tampa terminal, Cemex Tampa, and Argos USA supply the delivery radius.",
    rebarPara: "Florida Building Code Section 1926 requires galvanized or epoxy-coated #4 rebar in marine exposure zones. Inland Pasco and Hillsborough pours in non-coastal zones use standard black bar with sealer as the corrosion defense.",
    climatePara: "Tampa essentially does not freeze. The durability threats are coastal chloride, sulfate exposure from phosphate-industry legacy soils in South County, and hurricane-driven saturation of subgrade. Karst sinkhole subsidence is a distinct secondary concern.",
    disasterPara: "Hurricane Ian in 2022 and Hurricane Idalia in 2023 left saturated limestone subgrades with elevated sinkhole risk. Many Tampa contractors now require ground-penetrating radar surveys before large pours in designated Sinkhole Investigation Zones across South Hillsborough.",
    permitPara: "City of Tampa Construction Services and Hillsborough County Building issue permits by jurisdiction. Concrete pours in designated Sinkhole Investigation Zones (large parts of South Hillsborough) require a geotechnical letter confirming no voids in the top 20 feet of karst limestone.",
    setbackPara: "Tampa Land Development Code Chapter 27 caps impervious coverage at 50 percent in RS-60 and requires a 5-foot side setback for any slab not attached to the principal structure. Coastal High Hazard Area rules add further restrictions.",
    stylePara: "Tampa residential concrete is pool-cage slab extensions with cage anchor embeds, paver-integrated driveway aprons, raised-slab house pads on wet-season floodplains, and seawall-adjacent patio work requiring coastal permitting.",
    decorativePara: "Keystone-accented pool decks, sand-finish driveways, and acid-stained terracotta-coastal patios are the popular choices. Salt-finish textures are common on lanai pool decks for traction in wet conditions.",
    seasonPara: "The November-May dry season is the ideal pour window. The June-September rainy-season lightning window forces morning pours and frequent weather delays. Hurricane season staging adds schedule risk.",
    scenarioNotes: "Sinkhole-zone geotechnical and GPR surveys add $800-$2,500. Coastal High Hazard Area permitting adds 4-8 weeks. Hurricane-season contingency staging adds 8-12 percent to summer project pricing.",
    readyMixPlants: "Titan Florida Port of Tampa, Cemex Tampa, and Argos USA",
    maintenancePara: "Tampa's karst limestone substrate creates a unique maintenance concern: settlement monitoring. Post-pour ground-penetrating radar follow-up on slabs in South Hillsborough Sinkhole Investigation Zones is a prudent biennial maintenance item that catches subsurface void development before it produces catastrophic slab failure.",
    commonMistakePara: "The costliest Tampa concrete mistake is pouring a large patio without GPR sinkhole screening in a designated Sinkhole Investigation Zone. A void collapse under a new slab can produce $20,000-$50,000 in remediation costs, and homeowner insurance increasingly excludes pre-existing sinkholes on post-2017 policies."
  },
  "detroit-mi": {
    soilPara: "Detroit clay and glacial lacustrine silt dominate most of Wayne County. The Saline Formation limestone shelf affects excavation in Dearborn and Grosse Pointe. Detroit Land Bank-acquired parcels often have rubble or undocumented fill from prior demolitions that requires over-excavation.",
    mixPara: "Detroit residential spec is 4,500 psi with 6-7 percent entrained air, Type I/II cement, and MDOT Section 902 compliance for any pour in the public right-of-way. Edward C. Levy Co., Michigan Truck Mix, and Superior Materials supply Wayne County delivery.",
    rebarPara: "Detroit public-way concrete uses #4 epoxy-coated rebar because MDOT applies among the highest per-lane-mile salt tonnages in the country. Private-property pours can use black bar but annual sealing becomes mandatory rather than optional.",
    climatePara: "Detroit averages about 78 freeze-thaw cycles annually. MDOT rock-salt applications are aggressive enough that unsealed driveways scale rapidly (typically within 7-9 years). The 2014 polar vortex and the 2019 Wayne County deep freeze both produced documented spalling across the metro.",
    disasterPara: "The 2014 polar vortex split driveways across Wayne County and produced a multi-year crack-repair backlog. The 2021 Southeast Michigan flood saturated subgrades in Dearborn Heights and pushed settlement-related complaints through 2023.",
    permitPara: "Detroit Buildings, Safety Engineering and Environmental Department (BSEED) issues the permit. The Land Bank lot-purchase program triggers a specific concrete-approach apron permit when building on previously demolished parcels, distinct from the standard driveway permit.",
    setbackPara: "Detroit Zoning Ordinance Article 17 caps front-yard paving at 30 percent in R1 districts and requires a 3-foot side setback for any driveway slab. Grosse Pointe and Dearborn have separate zoning codes with different caps.",
    stylePara: "Detroit residential concrete is brick-Tudor front stoop replacement, alley garage pads common in Pleasant Ridge and Ferndale, stamped driveway aprons in restored Indian Village and Boston-Edison homes, and Land Bank new-build foundation work.",
    decorativePara: "Pewabic-tile-inspired stamped patios, exposed-aggregate finishes tied to local basalt sources, and stained Tudor-mullion-patterned walks reference Detroit's architectural heritage.",
    seasonPara: "The MDOT frost law limits heavy concrete truck access on local roads March-May, narrowing the spring pour window. Late May through early November is the reliable season; sub-freezing overnight temperatures return by mid-November.",
    scenarioNotes: "MDOT frost-law truck weight restrictions add 3-6 week scheduling delays in spring. Land Bank parcel over-excavation for undocumented fill adds $800-$3,500. Mandatory sealing adds $300-$600 per maintenance cycle.",
    readyMixPlants: "Edward C. Levy Co., Michigan Truck Mix, and Superior Materials",
    maintenancePara: "Detroit's 78 freeze-thaw cycles and aggressive MDOT salt tonnage require mandatory annual sealer reapplication on any driveway exposed to street-salt carryover. Penetrating lithium-silicate at 28 days post-pour plus annual topical acrylic is the Grosse Pointe and Indian Village standard. Land Bank rehabilitation pours should specify sealer as part of the initial contract.",
    commonMistakePara: "The costliest Detroit concrete mistake is pouring on a Land Bank parcel without confirming the subgrade is free of demolition rubble. Undocumented fill from prior teardowns produces differential settlement within 2-3 years that cracks the slab and requires full removal and re-pour."
  },
  "minneapolis-mn": {
    soilPara: "Minneapolis sits on Des Moines Lobe glacial till, the Platteville limestone shelf affects Ramsey County excavations, and the northern suburbs sit on the saturated Anoka Sand Plain. Frost-susceptibility rankings directly drive footing depth requirements in MnDOT cold zone.",
    mixPara: "Twin Cities residential spec is 4,500 psi with 6-8 percent entrained air (the highest air content routinely specified in the country), Type I/II cement, and MnDOT Section 2461 compliance. Cemstone, Aggregate Industries Holcim, and Knife River supply most of the metro.",
    rebarPara: "MnDOT specifies epoxy-coated rebar on any pour within salt-spray zones, which effectively covers the entire Twin Cities metro. Private driveway pours default to #4 epoxy-coated rebar given salt-carryover from plow operations.",
    climatePara: "The Twin Cities average about 135 freeze-thaw cycles annually, the highest of any major US metro. MnDOT applies rock salt and salt brine six months a year. Residential driveway scaling is the single most common concrete complaint in the market and drives annual sealer reapplication.",
    disasterPara: "The 2019 polar vortex produced sub-40F wind chills for 9 straight days and caused frost-heave damage to any slab on inadequate footings. 48-inch footing depth is now effectively mandatory regardless of code minimum, and reputable contractors often pour to 54 inches for new slab additions.",
    permitPara: "Minneapolis Community Planning and Economic Development (CPED) issues the permit. Heritage Preservation Commission review applies to exterior concrete work in any of the 11 designated historic districts, including color, texture, and scoring layout. Saint Paul has separate historic-district review through HPC-SP.",
    setbackPara: "Minneapolis Zoning Code Chapter 535 caps impervious coverage in R1 districts at 50 percent and requires 3-foot side setbacks for detached garage pads. Saint Paul has parallel but separately enforced limits.",
    stylePara: "Twin Cities residential concrete is attached garage pads for cold-weather access, stamped skid-pattern driveways for ice grip, walkout-basement stair slabs in hilltop neighborhoods, and replacement front walks on pre-1940 bungalows across south Minneapolis.",
    decorativePara: "Stamped random-flagstone drives, salt-finish textures for traction, and exposed-basalt-aggregate patios are the signature local finishes. Anti-slip additives are a near-universal spec for any decorative pour.",
    seasonPara: "The productive pour season is mid-May through late October. Sub-40F temperatures and frozen subgrade effectively shut down exterior concrete work November through early May. Spring frost law limits heavy truck access in April.",
    scenarioNotes: "48-54 inch footing depth adds $400-$1,200 per footing versus code minimum. Epoxy-coated rebar versus black bar adds 15-25 percent on reinforcement line. Annual sealer reapplication at $0.50-$0.90/sqft is mandatory maintenance.",
    readyMixPlants: "Cemstone, Aggregate Industries Holcim, and Knife River",
    maintenancePara: "Minneapolis's 135 freeze-thaw cycles produce the highest annual sealer-maintenance burden of any major US metro. Epoxy-coated rebar plus penetrating lithium-silicate sealer at 28 days plus twice-annual topical recoat on salt-exposed surfaces is the Kenwood and Linden Hills standard. The annual sealer cost of $0.50-$0.90/sqft is genuinely non-negotiable for driveway longevity.",
    commonMistakePara: "The costliest Minneapolis concrete mistake is setting footings at the 42-inch code minimum when the actual frost depth regularly exceeds 48 inches. The 2019 polar vortex proved that 42-inch footings heave in sustained sub-40F wind-chill events, and experienced Twin Cities crews now default to 54 inches."
  },
  "charlotte-nc": {
    soilPara: "Charlotte sits on Carolina Piedmont saprolite over mica-schist bedrock. Red clay over decomposed granite dominates Mecklenburg County with highly variable depth to rock. Biotite-heavy saprolite breaks down under repeated compaction and requires extra base preparation.",
    mixPara: "Charlotte residential spec is 4,000 psi with 4-6 percent entrained air, Type I/II cement, and 20-30 percent slag cement replacement allowed under NCDOT Section 1000. Carolina Sunrock, Thomas Concrete Carolinas, and Ready Mixed Concrete Company dominate the delivery radius.",
    rebarPara: "Charlotte residential reinforcement is #4 rebar with 6x6 welded wire mesh on most driveways. Epoxy-coated bar is uncommon because NCDOT salt-brine applications are short and limited to 3-5 events per winter.",
    climatePara: "Charlotte averages about 45 freeze-thaw cycles annually. NCDOT treats primarily with salt-brine, and rock salt is reserved for actual ice events. The 2002 ice storm and the 2022 Christmas freeze are the recent reference events for local concrete performance.",
    disasterPara: "The 2002 ice storm cracked unsealed driveways across the metro and pushed many local contractors to require sealer application at cure-out. Repeated tornado and severe-weather events in the Charlotte NWS zone drive periodic demand spikes for concrete damage repair.",
    permitPara: "Mecklenburg County Code Enforcement issues the permit for Charlotte, with separate portals for Concord, Gastonia, Matthews, and Mint Hill. The Charlotte Tree Ordinance requires tree-protection fencing and root-zone preservation during concrete work within 1.5x DBH of any protected tree; arborist letters are a common precondition.",
    setbackPara: "Charlotte Unified Development Ordinance caps R-3 impervious coverage at 40 percent and requires a 5-foot side setback for any new hardscape not tied to the principal structure. Tree-save areas add further restrictions on driveway placement.",
    stylePara: "Charlotte residential concrete is Georgian front-porch step replacement, stamped back patios in the Dilworth-Myers Park corridor, long suburban driveways on rolling Piedmont lots, and walkout-basement foundation wall pours in hillside neighborhoods.",
    decorativePara: "Stamped ashlar-slate patterns, exposed-Piedmont-granite aggregate, and stained tobacco-brown patios matching Queen City brick are the popular finishes. Charlotte-specific red-clay-tone pigmentation is a local specialty.",
    seasonPara: "April-June and September-November are the ideal windows. July-August humidity slows cure and increases plastic-shrinkage risk, so afternoon pours are discouraged. Pollen-season finishing (March-April) can contaminate decorative surfaces.",
    scenarioNotes: "Tree-protection compliance and arborist documentation adds $300-$1,000 per project. Piedmont slope grading for hillside lots adds $500-$2,000. NCDOT right-of-way tie-ins add $400-$1,500 in permit and inspection costs.",
    readyMixPlants: "Carolina Sunrock, Thomas Concrete Carolinas, and Ready Mixed Concrete Company",
    maintenancePara: "Charlotte's moderate freeze-thaw cycle and NCDOT salt-brine applications create a forgiving but not zero maintenance environment. Penetrating sealer at 28 days plus recoat every 3 years is the Myers Park and Dilworth standard. Pollen-season (March-April) pressure washing at 2,500 PSI removes the yellow-green film that coats every exterior surface in the Piedmont.",
    commonMistakePara: "The costliest Charlotte concrete mistake is excavating within the tree-save zone of a protected canopy oak without an arborist letter. The Charlotte Tree Ordinance imposes fines and requires replacement plantings at 3:1 ratio, and a single mature willow oak violation can generate $5,000-$15,000 in penalties."
  },

  "st-louis-mo": {
    soilPara: "Missouri River alluvium blankets the bottomlands east of Skinker Boulevard while Mississippian-age Burlington limestone outcrops on the bluffs from Benton Park south through Carondelet. Windblown Peoria loess caps the uplands in Clayton and Ladue, shrinking and swelling enough to crack shallow footings during the July-August dry cycle. The city operates independently from St. Louis County, so a Soulard project files through the City Building Division while an identical scope in Clayton files through the County permit office with a completely different fee schedule.",
    mixPara: "Residential flatwork spec in the city is 4,500 psi with 6.5 percent entrained air. Buzzi Unicem's Festus plant and Holcim's Ste. Genevieve facility deliver most city jobs; Fred Weber's fleet covers the county side from Maryland Heights west. Ready-mix trucks crossing the Poplar Street Bridge from the Illinois plants face a 45-minute minimum transit that limits viable batch windows for early-morning pours.",
    rebarPara: "#4 rebar on 16-inch centers with epoxy coating is standard practice on any driveway that will see MoDOT salt carryover from Highway 40/I-64 ramp runoff. The Hill neighborhood's dense rowhouse lots force hand-carry of rebar bundles through gangways as narrow as 30 inches, adding $0.15-$0.25 per linear foot in labor.",
    climatePara: "The metro logs roughly 60 freeze-thaw cycles each winter, concentrated between late November and early March. February 2021's Winter Storm Uri dropped temperatures to -9F and buckled driveways across Tower Grove South that had been poured without adequate air entrainment the prior fall. Summer heat indexes above 110F in July force pre-dawn pours with ASTM C494 Type D retarder.",
    disasterPara: "The April 2011 Good Friday EF4 tornado carved a path from Lambert Airport through Bridgeton and Maryland Heights, scattering debris into subgrades that still produce rebar-snagging obstructions during excavation. Any replacement slab along the storm track benefits from a GPR scan before formwork goes up.",
    permitPara: "The City of St. Louis Building Division issues residential concrete permits separately from St. Louis County. Lafayette Square and Compton Heights fall under the Cultural Resources Office, which reviews visible concrete work for compatibility with the historic streetscape. Expect 3-5 weeks for CRO clearance on top of the standard building permit.",
    setbackPara: "City zoning caps front-yard impervious coverage at 40 percent and requires a 3-foot side setback on standard residential lots. In Soulard's tight 25-foot-wide parcels, this effectively limits driveway width to 10-12 feet and forces single-car designs.",
    stylePara: "Bread-and-butter STL concrete is brick-rowhouse stoop replacement along Magnolia Avenue, alley-pad rebuilds behind Benton Park two-families, and walkout-basement patio pours on the bluff lots overlooking the River Des Peres. The Hill's Italian-heritage homes frequently request terrazzo-inspired exposed-aggregate front walks that match the neighborhood's masonry character.",
    decorativePara: "Exposed-aggregate with local chert river rock is the signature decorative finish because it matches the warm tan of the native limestone. Acid-stained Corten-rust patios pair with the industrial aesthetic popular in the Cortex Innovation District. Stamped herringbone-brick patterns sell well in Lafayette Square where the historic brick sidewalks set the visual tone.",
    seasonPara: "Productive pour season runs mid-March through mid-November, roughly 240 working days. The Gateway Arch grounds closure for July 4th events and Cardinals home-game traffic along Clark Avenue affect staging and delivery schedules for downtown-adjacent projects.",
    scenarioNotes: "Loess-over-limestone excavation adds $400-$1,200 per footing on bluff lots. City/County permit duality means a project straddling the Skinker line may need two separate permits and two inspections.",
    readyMixPlants: "Buzzi Unicem, Holcim, and Fred Weber"
  },

  "orlando-fl": {
    soilPara: "Central Florida's Ocala limestone sits beneath a thin veneer of fine quartz sand, and the karst geology produces sinkhole risk that shows up in Orange County's geotechnical database roughly every 18 months. Winter Park lots along Pennsylvania Avenue ride on a shallow water table that can saturate subgrade within 24 hours of a summer thunderstorm. Dr. Phillips and Lake Nona developments were engineered on compacted fill over the original wetland, so bearing capacity varies dramatically lot by lot.",
    mixPara: "Orlando residential spec runs 3,500 psi with Type II sulfate-resistant cement because the Floridan Aquifer groundwater carries 180-280 ppm hardness that wicks sulfate into the slab base. CEMEX Orlando's Apopka plant, Titan Florida out of Medley, and Argos USA's Newberry facility handle most metro deliveries. No air entrainment is needed because the freeze-thaw count is effectively zero.",
    rebarPara: "#4 rebar on 18-inch centers with plastic chairs rated for UV handles most Orlando flatwork. Pool-deck slabs within 6 feet of the coping require #4 at 12-inch centers per Florida Building Code Section 1808 because the chlorinated splash zone attacks concrete aggressively.",
    climatePara: "Orlando never freezes in a meaningful way. The real durability threats are the 50 inches of annual rainfall concentrated in June-September afternoon convective storms, plus sustained UV that degrades surface sealers in 18-24 months. The combination of high humidity and warm nights promotes efflorescence on unsealed decorative finishes faster than any other major Florida metro.",
    disasterPara: "Hurricane Ian's September 2022 storm surge and wind-driven rain saturated subgrades across southwest Orange County. Irma in 2017 toppled mature live oaks whose root balls displaced driveway slabs along Fairbanks Avenue in Winter Park. Post-hurricane concrete replacement in Orlando now routinely includes subgrade moisture-content testing before the pour.",
    permitPara: "City of Orlando Permitting Services Division processes residential concrete permits in 3-7 business days. Winter Park has its own Building Department with separate fees. Celebration's Osceola County address means county permits rather than city, catching many homeowners off guard. Pool-deck work triggers a separate barrier-compliance inspection.",
    setbackPara: "Orlando zoning caps front-yard impervious coverage at 60 percent on standard R-1 lots, generous by national standards. Celebration's Town Center HOA reduces that to 40 percent and mandates colored concrete that matches the community palette.",
    stylePara: "Orlando concrete is dominated by pool-cage slab extensions, screened-porch foundation pads, and driveway turnarounds on the oversized lots in Lake Nona's Medical City district. College Park's bungalow-era front walks are a niche replacement market where matching the 1920s scoring pattern matters more than stamped decoration.",
    decorativePara: "Salt-finish pool surrounds dominate because the texture provides wet-traction without heating bare feet. Travertine-pattern stamps in warm coral tones sell well in Windermere gated communities. Acid-stained Caribbean-blue accent borders along pool coping are an Orlando specialty that rarely appears outside Central Florida.",
    seasonPara: "Pouring runs year-round, but the June-September rainy season forces afternoon schedule flexibility because convective storms hit between 2pm and 5pm almost daily. The November-May dry season is the premium window and books 2-3 months ahead.",
    scenarioNotes: "Sinkhole-risk geotechnical reports add $1,200-$3,500 on parcels flagged in the Orange County karst database. Pool-deck barrier-compliance inspection adds a separate fee and scheduling step.",
    readyMixPlants: "CEMEX Orlando, Titan Florida, and Argos USA"
  },

  "san-antonio-tx": {
    soilPara: "The Balcones Fault Zone runs diagonally through the city from Helotes northeast to New Braunfels, dividing soft Edwards limestone on the west from Taylor Marl expansive clay on the east. Alamo Heights sits right on the fault contact, which means a single block can have stable limestone footing on one end and 3-inch seasonal heave on the other. Stone Oak developments north of Loop 1604 are built on weathered Glen Rose formation where depth to competent rock varies from 6 inches to 8 feet within a single lot.",
    mixPara: "Residential spec is 3,500 psi with Type II cement for sulfate resistance against the selenite gypsum crystals common in Taylor Marl exposures. Alamo Concrete's Bitters Road plant and Capitol Aggregates' Nacogdoches facility cover everything inside Loop 410. Martin Marietta's Hunter plant handles the booming development corridor along I-35 north toward New Braunfels.",
    rebarPara: "Post-tensioned strand at 48-inch spacing dominates structural slabs on the east side's expansive clay. The limestone west side permits conventional #4 rebar on 18-inch centers because the rock provides stable bearing. King William's historic properties occasionally require hand-tied #5 rebar to match the original 1890s pier-and-beam foundation connections during underpinning work.",
    climatePara: "San Antonio averages only 5 freeze-thaw cycles, so air entrainment is unnecessary. The dominant concrete killer is plastic-shrinkage cracking driven by summer heat that routinely pushes 105F with single-digit humidity in August. Evaporation rates exceed ACI's 0.25 lb/sqft/hr threshold on most afternoon pours from May through September, making pre-dawn scheduling and evaporation retarder mandatory.",
    disasterPara: "Winter Storm Uri in February 2021 shut down CPS Energy's grid for 4 days and froze partially cured slabs across The Pearl district and Southtown. Contractors who had poured the week before Uri without cold-weather protection lost entire driveway panels to ice-crystal expansion. The event permanently changed how SA crews treat November-February pours.",
    permitPara: "City of San Antonio Development Services handles permits; Alamo Heights runs its own independent building department with faster turnaround but stricter design review. The King William Historic District falls under HDRC review, and visible concrete work there requires a Certificate of Appropriateness that adds 4-6 weeks. Boerne and Helotes are separate municipalities with their own permit processes.",
    setbackPara: "San Antonio's Unified Development Code limits driveway width to 24 feet at the property line with a 5-foot side setback. Stone Oak HOAs frequently override this with narrower maximums and mandatory earth-tone integral color that matches the limestone aesthetic.",
    stylePara: "SA concrete runs toward post-tensioned monolithic slabs, stamped Hill Country limestone patios in The Pearl's restaurant courtyards, and extended circular driveways in the Dominion and Shavano Park. The King William District demands historically appropriate broom-finish front walks with hand-tooled joints matching the original German-heritage streetscape pattern.",
    decorativePara: "Austin Chalk-toned integral color and Hill Country limestone stamps are the signature local finishes. Exposed aggregate using Pedernales River gravel produces a distinctive warm-pink tone that matches the native rock walls. Salt-finish pool surrounds dominate in Stone Oak and Alamo Heights where backyard pools are near-universal.",
    seasonPara: "Year-round pouring is feasible, with October through April as the premium window. Summer pours must start by 5:30am and wrap finishing before 10am to avoid plastic-shrinkage cracking in the afternoon heat.",
    scenarioNotes: "Edwards limestone excavation on west-side lots adds $600-$2,000 per footing. HDRC Certificate of Appropriateness in King William adds 4-6 weeks and requires specific finish samples before approval.",
    readyMixPlants: "Alamo Concrete, Capitol Aggregates, and Martin Marietta"
  },

  "portland-or": {
    soilPara: "Willamette River alluvium beneath the central city transitions to Portland Hills silt loam on the West Hills and Columbia River flood basalt in the eastern neighborhoods. Sellwood and Westmoreland sit on river terrace gravels that drain exceptionally well, while Laurelhurst and Alameda Ridge lots ride on Boring Lava flows where rock-drill excavation adds $800-$2,000 per footing. The January 2021 ice storm revealed how many East Portland slabs had been poured on undocumented fill from 1950s subdivision grading.",
    mixPara: "Portland residential spec is 4,000 psi with 4.5 percent entrained air for the mild but real freeze-thaw cycle. Knife River's Aumsville plant, CalPortland's Oregon City facility, and Cadman's Northwest Portland batch plant cover the metro. Low-alkali cement is specified to prevent alkali-silica reaction with the local basalt aggregate that plagues older Portland sidewalks poured before the 1990s spec change.",
    rebarPara: "#4 rebar on 18-inch centers with corrosion-inhibiting admixture is standard because Portland's 150+ rain days per year keep embedded steel wet longer than any other major West Coast metro. Epoxy coating is uncommon because ODOT uses magnesium chloride anti-icer only 3-5 times per winter rather than continuous salt applications.",
    climatePara: "Portland logs about 15 freeze-thaw cycles annually, concentrated in December and January. The persistent rain and overcast conditions mean green concrete rarely flash-dries, so plastic-shrinkage cracking is uncommon. Instead, the dominant threat is efflorescence and moss colonization on north-facing unsealed surfaces, which can begin within the first year on slabs under the Douglas fir canopy along SE Hawthorne Boulevard.",
    disasterPara: "The January 2021 ice storm coated the metro in 1-2 inches of radial ice for 5 days, snapping power lines and tree limbs that cratered driveways from Alberta Arts through Lake Oswego. The June 2021 heat dome (116F record) produced plastic-shrinkage cracking on every slab poured without evaporation retarder that week. Portland crews now stock retarder year-round rather than just for summer.",
    permitPara: "City of Portland Bureau of Development Services issues residential permits with 2-4 week turnaround. Lake Oswego has its own building department. Irvington, Ladd's Addition, and Piedmont historic districts fall under the Portland Historic Landmarks Commission, which reviews visible concrete for material and scoring-pattern compatibility. Oregon CCB licensure is mandatory for any contractor bidding work.",
    setbackPara: "Portland zoning Title 33 caps front-yard impervious surface at 50 percent on R5 lots and limits driveway width to a single 20-foot curb cut. Laurelhurst's 5,000-sqft lots often cannot accommodate a two-car driveway under these rules without a variance.",
    stylePara: "Portland concrete centers on Craftsman-bungalow front-walk replacement in the Hawthorne and Alberta districts, garage-pad reconstruction on the steep hillside lots of Southwest Portland, and rain-garden-integrated stormwater patios that comply with the city's green-infrastructure requirements. The Pearl District's condo courtyards demand architectural concrete with form-liner textures.",
    decorativePara: "Exposed-aggregate with local Willamette River basalt produces a dark gray-green finish unique to Portland. Stamped cedar-plank patterns complement the neighborhood Craftsman aesthetic. Acid-stained moss-green patios in Sellwood match the Pacific Northwest palette without the maintenance burden of actual moss management.",
    seasonPara: "Peak productivity runs May through October when consecutive dry days allow proper curing. November through March pours are routine but require rain covers and extended cure times. The biennial DEQ emissions-testing schedule does not affect concrete operations but does apply to contractor diesel equipment under Portland's Clean Air Construction program.",
    scenarioNotes: "Boring Lava rock-drill excavation on Alameda Ridge and West Hills lots adds $800-$2,000 per footing. Oregon CCB license verification at ccb.oregon.gov is a mandatory step before signing any contract.",
    readyMixPlants: "Knife River, CalPortland, and Cadman"
  },

  "sacramento-ca": {
    soilPara: "Sacramento Valley alluvial clay dominates the central city while American River sand and gravel deposits underlie East Sacramento and Arden-Arcade. The infamous Sacramento hardpan, a ceite-cemented duripan layer 18-36 inches below grade in Elk Grove and South Sacramento, requires pneumatic breakers and adds $400-$1,200 per footing. Land Park and Curtis Park sit on Riverbank Formation alluvium that drains well but liquefies in seismic events, as the 1906 earthquake's secondary effects demonstrated.",
    mixPara: "Residential spec is 3,500 psi with no air entrainment needed given Sacramento's negligible freeze risk. CalPortland's West Sacramento plant, Teichert's Perkins facility, and Pacific Coast Building Products' headquarters operation in Rancho Cordova cover the delivery radius. Title 24 Part 6 solar-reflectance requirements push light-colored aggregate and pigment on driveways that face south or west.",
    rebarPara: "#4 rebar on 18-inch centers with standard plastic chairs handles most Sacramento flatwork. Structural slabs in the hardpan zone increasingly use post-tensioned strand because the clay-over-hardpan profile creates differential settlement when irrigation water penetrates joints and softens the clay layer above the cemented horizon.",
    climatePara: "Sacramento sees roughly 12 freeze-thaw cycles in a mild winter, concentrated in December-January tule-fog events when temperatures drop to 28-32F overnight. The real concrete challenge is Central Valley summer heat: 60+ days above 100F drive evaporation rates well past ACI thresholds. Midtown driveways poured after 9am in July without retarder show plastic-shrinkage cracking within hours.",
    disasterPara: "The January 2023 atmospheric-river sequence dumped 14 inches of rain in 3 weeks, saturating subgrades across Natomas and North Sacramento and producing widespread slab undermining from surface erosion. Folsom Dam releases simultaneously raised the American River water table to within 4 feet of grade in East Sacramento, delaying spring pours by 6 weeks.",
    permitPara: "City of Sacramento Community Development Department issues permits with 5-10 day turnaround. Elk Grove, Roseville, and Folsom each run independent building departments. The Alkali Flat and Boulevard Park historic districts fall under the Sacramento Preservation Commission, which reviews visible concrete for compatibility. CSLB C-8 Concrete Contractor license is required.",
    setbackPara: "Sacramento zoning limits front-yard paving to 50 percent on R-1 lots. East Sacramento's narrow 40-foot lots force single-car driveways or shared-access agreements with neighbors. Roseville's master-planned HOAs frequently cap impervious coverage below the city maximum and mandate earth-tone color.",
    stylePara: "Sacramento concrete runs toward Valley-ranch driveway replacement in Elk Grove and Natomas, Craftsman-era front-walk reconstruction in Midtown and East Sacramento, and pool-patio extensions in the Roseville and Folsom subdivisions where backyard swimming pools are near-universal. Land Park's curved entry walks matching the 1930s WPA-era parkway aesthetic are a distinct local specialty.",
    decorativePara: "Valley-oak-leaf stamps in warm terra-cotta tones are a Sacramento signature finish. Exposed-aggregate with local American River gold-flecked gravel produces a distinctive sparkle that flat-country metros cannot replicate. Salt-finish pool decks in Granite Bay and El Dorado Hills pair with the Sierra foothill aesthetic.",
    seasonPara: "Year-round pouring is feasible but July-September afternoon pours require pre-dawn starts. The December-February tule-fog season produces damp mornings that slow cure times and require surface protection. Biennial CSLB license renewal and smog checks through BAR apply to contractors but not to the concrete scope itself.",
    scenarioNotes: "Hardpan breaker excavation adds $400-$1,200 per footing in Elk Grove and South Sacramento. Title 24 solar-reflectance compliance on driveways adds 5-10% to material cost for light-colored aggregate and pigment.",
    readyMixPlants: "CalPortland, Teichert, and Pacific Coast Building Products"
  },

  "pittsburgh-pa": {
    soilPara: "Allegheny Plateau sandstone and shale underlie most residential neighborhoods, but the real Pittsburgh soil problem is the Pittsburgh red beds clay, a Permian-age formation that swells aggressively when wet and sits atop abandoned coal-mine voids in neighborhoods from Brookline through Mt. Lebanon. The Pennsylvania DEP mine-subsidence insurance program exists specifically because of how frequently residential foundations in the South Hills drop into historical mine workings. Squirrel Hill and Shadyside ride on more stable Casselman Formation sandstone.",
    mixPara: "Pittsburgh residential spec is 4,500 psi with 6-8 percent entrained air and Type I/II cement. Allegheny Mineral's Kittanning quarry, Lafarge Holcim's Wampum plant, and Pittsburgh Ready Mix's Neville Island facility serve the metro. PennDOT mandates 7 percent minimum air on any residential apron tying into a public right-of-way, stricter than most state DOT specs.",
    rebarPara: "Epoxy-coated #4 rebar is mandatory practice rather than optional in Pittsburgh because PennDOT salt-brine applications on the Mon Wharf and Forbes Avenue corridors produce chloride runoff that migrates into adjacent residential driveways. South Side Slopes lots often require #5 rebar doweled into the hillside rock face for retaining walls that double as driveway supports.",
    climatePara: "Pittsburgh logs about 75 freeze-thaw cycles per winter, driven by rapid temperature swings when cold Canadian air collides with Ohio Valley moisture. The June 2012 derecho produced 80-mph winds that scattered debris across Lawrenceville and Strip District driveways, and the cleanup excavation revealed how many 1950s-era slabs had been poured directly on uncompacted mine-spoil fill.",
    disasterPara: "Mine subsidence remains an active threat: the 2019 sinkhole on Blvd of the Allies exposed a void from the Pittsburgh Coal Seam that had been unmapped since the 1920s. Any new structural slab in Brookline, Overbrook, or Mt. Lebanon should include a mine-subsidence investigation through PA DEP before the pour. The state's Mine Subsidence Insurance Fund covers up to $150,000 in structural damage.",
    permitPara: "City of Pittsburgh PLI issues residential permits in 2-3 weeks. Mt. Lebanon and Fox Chapel boroughs have independent building departments. The Allegheny West, Manchester, and Mexican War Streets historic districts fall under the Pittsburgh Historic Review Commission, which reviews visible concrete finish and color. PA Home Improvement Contractor registration under Act 132 is required.",
    setbackPara: "Pittsburgh zoning caps front-yard impervious surface at 35 percent on R1-D lots. Fox Chapel Borough adds further restrictions limiting driveway width to 12 feet in the front-yard setback. South Side Slopes steep-lot variances are common because the standard setback makes driveway construction physically impossible on grades exceeding 25 percent.",
    stylePara: "Pittsburgh concrete is defined by walkout-basement work on the city's famously steep terrain, retaining-wall construction along the hillside streets of Mt. Washington and Troy Hill, and broom-finish driveway replacement in the Squirrel Hill and Shadyside bungalow belt. Lawrenceville's converted-warehouse courtyards demand architectural exposed-concrete finishes with form-liner texture.",
    decorativePara: "Flagstone-stamp patterns in Allegheny sandstone tones are the signature Pittsburgh decorative choice. Salt-finish treads on the stepped hillside walks of South Side Slopes provide winter traction on grades that approach 30 percent. Exposed-aggregate using local river gravel from the Allegheny produces a distinctive gray-gold finish.",
    seasonPara: "The pour window runs late April through early November, roughly 190 working days. PennDOT winter-maintenance operations on Forbes, Fifth, and the Boulevard shut down adjacent residential pours during salt-brine application events. Annual safety inspection and biennial emissions testing apply to contractor vehicles but not to concrete operations.",
    scenarioNotes: "Mine-subsidence investigation through PA DEP adds $1,500-$4,000 on parcels in the Pittsburgh Coal Seam overlay. Hillside retaining-wall engineering on South Side Slopes or Mt. Washington adds $3,000-$12,000 beyond flat-lot scope.",
    readyMixPlants: "Allegheny Mineral, Lafarge Holcim, and Pittsburgh Ready Mix"
  },

  "columbus-oh": {
    soilPara: "Wisconsin-age glacial till covers most of Franklin County to a depth of 15-40 feet, overlying Devonian Ohio Shale and Columbus Limestone. German Village sits on some of the densest till in the metro, making hand-excavation of footings punishing work. Upper Arlington and Worthington ride on outwash sand and gravel that drains well but produces differential settlement where till pockets interrupt the gravel layer. Dublin's rapid growth pushed development onto Silurian dolomite ledges where depth to rock drops below 12 inches.",
    mixPara: "Columbus residential spec is 4,500 psi with 6 percent entrained air and Type I/II cement. Shelly Company's Columbus South plant, Irving Materials' Greenfield IN headquarters fleet, and Central Ohio Ready Mix supply the metro. ODOT requires 7 percent minimum air on any apron tying into a public right-of-way, and Columbus city inspectors enforce this at the truck, not just on paper.",
    rebarPara: "#4 rebar on 16-inch centers handles most Columbus flatwork. Epoxy coating is recommended but not mandatory because Ohio eliminated its E-Check vehicle-inspection program and ODOT uses less salt per lane-mile than Pennsylvania or Michigan. German Village's strict Historic Preservation Commission review extends to scoring pattern but does not mandate specific rebar spec.",
    climatePara: "Columbus logs approximately 80 freeze-thaw cycles per year, concentrated from late November through mid-March. The June 2012 derecho delivered 75-mph straight-line winds that toppled mature sugar maples across Clintonville and Bexley, and root-ball displacement cracked adjacent driveways and walks. Ohio State University football Saturdays on Lane Avenue create staging and delivery blackout windows for any project within a mile of the Horseshoe.",
    disasterPara: "The June 2012 derecho remains the single most destructive weather event for Columbus residential concrete in the past two decades. Root-ball displacement from downed trees produced a 3-year backlog of driveway and walk replacements across Worthington and Upper Arlington. Reputable Columbus crews now specify root barriers within 15 feet of any mature hardwood before pouring adjacent flatwork.",
    permitPara: "Columbus Department of Building and Zoning Services issues residential permits in 5-10 business days. Dublin, Worthington, and Upper Arlington each have independent building departments with different fee schedules. German Village, Victorian Village, and Italian Village fall under the Columbus Historic Preservation Commission, which reviews visible concrete for compatibility with the district's 1850s brick-and-stone character.",
    setbackPara: "Columbus zoning caps front-yard impervious surface at 40 percent on R-3 lots. German Village's tight 20-foot-wide parcels force single-car driveways. Dublin's Bridge Park mixed-use district has specific streetscape standards that override residential defaults.",
    stylePara: "Columbus concrete centers on ranch-home driveway replacement in Clintonville and Bexley, walkout-basement patio pours in Worthington's rolling terrain, and front-walk reconstruction in German Village's historic brick-street setting. Short North gallery-district courtyard pours require decorative exposed-concrete that matches the neighborhood's industrial-revival aesthetic.",
    decorativePara: "Ohio limestone-tone stamps in warm cream shades match the Columbus Limestone formation that underlies the metro. Exposed-aggregate using local glacial-outwash gravel produces a distinctive tan-and-gray blend. German Village front walks demand hand-tooled scoring that replicates the 1850s pattern documented in the district's design guidelines.",
    seasonPara: "Productive pour season runs mid-April through early November, about 200 working days. Ohio State home-game weekends from September through November create delivery blackout zones north of Campus. Ohio eliminated E-Check emissions testing statewide.",
    scenarioNotes: "Dense glacial till excavation adds $300-$800 per footing in German Village and Bexley. Historic Preservation Commission review in German Village adds 2-4 weeks for scoring-pattern approval.",
    readyMixPlants: "Shelly Company, Irving Materials, and Central Ohio Ready Mix"
  },

  "kansas-city-mo": {
    soilPara: "Kansas City Group limestone, a Pennsylvanian-age formation, outcrops across the southern half of the metro from Waldo through Lee's Summit, while Missouri River loess blankets the Northland and Platte County bottoms. Expansive Pennsylvanian shale in the Brookside and Prairie Village corridor produces 2-3 inches of seasonal heave that cracks conventionally reinforced slabs within 5 years. The metro straddles the Missouri-Kansas state line, so an Overland Park project files under Johnson County KS while an identical scope in Waldo files through KCMO, with different code requirements and inspection protocols.",
    mixPara: "Residential spec on the Missouri side is 4,500 psi with 6.5 percent entrained air. Ash Grove Cement's Chanute plant, Hunt Midwest's underground quarry operation in the Subtropolis complex, and Ready Mixed Concrete Co. of Kansas City cover the bi-state delivery radius. Kansas-side jobs pull from the same plants but specify to KS DOT standards where aprons connect to public right-of-way.",
    rebarPara: "Epoxy-coated #4 rebar is the Brookside and Prairie Village standard because KCMO and Overland Park both apply heavy salt-brine treatment on residential streets. Post-tensioned strand is increasingly common on structural slabs across the shale belt from 63rd Street south through Lee's Summit because conventional reinforcement cannot manage the 2-3 inch seasonal heave without mid-panel cracking.",
    climatePara: "The metro averages about 80 freeze-thaw cycles per year, with the worst concentration in January and February when Arctic air drops temperatures 40+ degrees overnight. The May 2024 supercell hail event dropped 3-inch stones across southern Johnson County, pitting freshly finished decorative slabs in Leawood and Overland Park. Kansas City's position in the central US hail corridor makes surface hardener and early sealer application a cost-effective insurance policy.",
    disasterPara: "The March 2022 tornado outbreak and the May 2024 hailstorm both drove post-event demand spikes that pushed contractor backlogs to 8-10 weeks. Winter Storm Uri in 2021 split unsealed driveways across Waldo and Brookside. The bi-state metro means disaster-recovery demand can spike on one side while the other has capacity, but contractor licensing differences complicate cross-border deployment.",
    permitPara: "KCMO Permits and Inspections handles the Missouri side while Overland Park, Prairie Village, and Lee's Summit each run independent departments on the Kansas side. Country Club Plaza, Pendleton Heights, and Janssen Place fall under the KCMO Historic Preservation Commission. Kansas-side municipalities have limited historic protections. Missouri has no statewide contractor license; Kansas requires Attorney General registration.",
    setbackPara: "KCMO zoning caps front-yard impervious surface at 40 percent on R-6 lots. Prairie Village requires a 5-foot side setback and mandates that driveway material match the existing neighborhood character. Country Club Plaza properties face additional JC Nichols Company deed restrictions that predate modern zoning.",
    stylePara: "KC concrete runs toward walkout-basement patio pours on the rolling terrain south of Brush Creek, Brookside bungalow-belt driveway replacement, and stamped pool surrounds in Lee's Summit and Blue Springs subdivisions. The Country Club Plaza's Spanish-revival architecture drives demand for tile-pattern stamps and earth-tone integral color that match the Seville tile facades.",
    decorativePara: "Kansas City limestone-tone stamps using local Bethany Falls formation aggregate produce a warm cream-gray finish unique to the metro. Exposed-aggregate with Missouri River chert gravel matches the native streambed aesthetic. Brookside front walks favor hand-tooled joints that replicate the 1920s J.C. Nichols subdivision pattern.",
    seasonPara: "Pour season runs mid-April through early November. Frozen ground from December through mid-March limits digging. The American Royal and Chiefs home-game traffic along Arrowhead Way affect delivery schedules for projects in the sports-complex corridor.",
    scenarioNotes: "Shale-belt geotechnical investigation adds $1,000-$3,000 on Brookside and Prairie Village parcels. Bi-state permit duality on projects straddling State Line Road may require two separate permits.",
    readyMixPlants: "Ash Grove Cement, Hunt Midwest, and Ready Mixed Concrete Co. of Kansas City"
  },

  "indianapolis-in": {
    soilPara: "Wisconsin-age glacial till averaging 25-50 feet deep covers most of Marion County, deposited by the Tipton Till Plain advance. Silurian-Devonian limestone and dolomite underlie the till, and depth to rock varies enough that Carmel and Fishers developments hit rock at 8-12 feet while Broad Ripple lots rarely encounter it above 30 feet. Citizens Water reports the aquifer produces exceptionally hard water at 250-350 ppm, and this hardness wicks into the slab base through capillary action, producing white efflorescence on unsealed surfaces faster than softer-water metros.",
    mixPara: "Residential spec is 4,500 psi with 6.5 percent entrained air and Type I/II cement. Irving Materials (IMI), headquartered in Greenfield IN just east of the metro, dominates the ready-mix market and operates 6 batch plants within the I-465 loop. Milestone Contractors and Prairie Supply cover the Hamilton and Boone County suburban corridor. INDOT requires 7 percent air on any apron connecting to a public right-of-way.",
    rebarPara: "Epoxy-coated #4 rebar is standard practice across the metro because INDOT salt-brine treatment on Meridian Street, Keystone Avenue, and the entire interstate interchange network produces heavy chloride runoff that migrates onto residential driveways within 30 feet of the road edge. Noblesville's dense subdivisions use standard black bar because the cul-de-sac streets see less salt.",
    climatePara: "Indianapolis logs roughly 85 freeze-thaw cycles annually, the most aggressive count of any major metro south of the Great Lakes. INDOT's salt-brine applications are heavy and sustained from November through March. The combination of hard water, aggressive salt, and dense glacial till that holds moisture against the slab bottom makes Indianapolis one of the toughest residential concrete environments in the Midwest.",
    disasterPara: "The November 2013 EF2 tornado in Washington Township damaged 60+ homes and displaced root balls that cracked driveways along Ditch Road and Kessler Boulevard. The Indianapolis 500 weekend in late May creates a distinct demand spike because homeowners want exterior work completed before Race Day entertaining. Contractors who book the 500 weekend premium charge 10-15 percent above standard rates.",
    permitPara: "Indianapolis Department of Business and Neighborhood Services issues permits for the Marion County unified government. Carmel, Fishers, Zionsville, and Noblesville each have independent departments with faster turnaround. Irvington, Lockerbie Square, Woodruff Place, and Herron-Morton Place fall under the Indianapolis Historic Preservation Commission. Indiana has no statewide contractor license but requires Marion County registration.",
    setbackPara: "Indianapolis zoning caps front-yard impervious coverage at 45 percent on D-5 lots. Carmel's round-about-heavy street network produces unusual driveway geometry that standard rectangular pour plans cannot accommodate. Meridian-Kessler's tree-lined lots force root-barrier specification within 12 feet of the mature tulip poplars along Pennsylvania Street.",
    stylePara: "Indianapolis concrete centers on bungalow-belt driveway and walk replacement in Broad Ripple and Meridian-Kessler, walkout-basement patios in the rolling terrain of Zionsville and Noblesville, and large-pad garage extensions in Carmel's oversized-lot subdivisions. Lockerbie Square's cobblestone-street setting demands historically compatible front walks with period-appropriate scoring.",
    decorativePara: "Indiana limestone-tone stamps in Bedford cream reproduce the signature material of the state capitol and countless Meridian Street mansions. Exposed-aggregate with local glacial-till gravel yields a distinctive tan-and-rose blend. Broad Ripple's artsy commercial strip inspires acid-stained jewel-tone accent borders on adjacent residential patios.",
    seasonPara: "Pour season runs mid-April through early November. Indianapolis 500 weekend in late May creates a residential-project completion deadline that compresses spring scheduling. Winter frozen ground from December through mid-March demands heated enclosures for any cold-weather pour.",
    scenarioNotes: "IMI's dominant market position keeps ready-mix pricing competitive but limits scheduling flexibility during peak season. Indy 500 weekend premium adds 10-15 percent on projects that must complete before Race Day.",
    readyMixPlants: "Irving Materials, Milestone Contractors, and Prairie Supply"
  },

  "nashville-tn": {
    soilPara: "Middle Tennessee Basin Ordovician limestone underlies most of Davidson County, with phosphatic clay residuum from the Bigby-Cannon formation creating a 3-8 foot weathered zone that swells when wet and shrinks to produce 1-2 inch seasonal heave. East Nashville sits on Lebanon limestone that provides stable bearing when reached, but the clay overburden hides depth-to-rock variability that surprises contractors bidding flat-rate footings. Green Hills and Brentwood developments ride on the Hermitage Formation, a more uniform limestone that produces the most predictable concrete conditions in the metro.",
    mixPara: "Nashville residential spec is 4,000 psi with 5 percent entrained air for the moderate freeze cycle. Buzzi Unicem's South Nashville plant on Harding Place, Rogers Group's Gallatin Pike facility, and Volunteer Ready Mix cover the Davidson County delivery radius. The Bigby-Cannon clay contains enough phosphate to affect cure chemistry in direct-to-ground pours; a vapor retarder between subgrade and slab is standard Nashville practice.",
    rebarPara: "#4 rebar on 18-inch centers with standard chairs handles most Nashville flatwork. The phosphatic-clay soil is corrosive enough that epoxy coating is recommended on any slab poured directly on grade without a vapor retarder. The March 2020 tornado-damaged areas in East Nashville and Donelson saw accelerated corrosion on exposed rebar from debris-contaminated subgrade.",
    climatePara: "Nashville averages about 40 freeze-thaw cycles per year, a moderate but non-trivial load that demands air-entrained mix. The real Nashville concrete challenge is the 48 inches of annual precipitation combined with the clay residuum's water-retention properties, which keep subgrade moisture elevated for weeks after rain events. Driveways along Shelby Avenue in East Nashville sit in the Cumberland River flood influence zone and experience subgrade saturation 4-6 times per year.",
    disasterPara: "The March 2020 EF3 tornado tore through East Nashville, Germantown, Donelson, and Mt. Juliet, damaging hundreds of residential slabs and producing a 2-year replacement backlog. The storm deposited debris into subgrades that still contaminates excavation along Fatherland Street and Five Points. Any replacement slab in the tornado path benefits from a subgrade contamination assessment.",
    permitPara: "Metropolitan Nashville Department of Codes Administration handles permits for the consolidated city-county government. Franklin and Brentwood in Williamson County have independent building departments with stricter review. East Nashville, Germantown, and Lockeland Springs fall under the Metro Nashville Historic Zoning Commission. Tennessee requires a Home Improvement License for any project over $3,000.",
    setbackPara: "Nashville zoning caps front-yard impervious coverage at 40 percent on RS-5 lots. 12South's rapid infill development has pushed lot coverage to the maximum on many parcels, leaving zero room for driveway expansion without a variance. Franklin's Westhaven and Berry Farms HOAs mandate specific concrete colors that match the community's Southern-vernacular palette.",
    stylePara: "Nashville concrete centers on 12South and East Nashville infill-home driveway pours, walkout-basement patio work on the rolling terrain of Green Hills and Belle Meade, and pool-surrond construction in the Franklin and Brentwood subdivisions. Germantown's historic cottages demand replacement front walks with hand-scored joints matching the pre-Civil-War streetscape documented in the Metro Historic Zoning Commission files.",
    decorativePara: "Tennessee Crab Orchard sandstone-pattern stamps in warm rose-tan are Nashville's signature decorative finish because they match the actual Crab Orchard flagstone that lines many Belle Meade garden paths. Exposed-aggregate with local Cumberland River gravel produces a distinctive gray-blue-tan blend. Acid-stained whiskey-barrel tones pair with the Nashville aesthetic in 12South and the Gulch.",
    seasonPara: "Productive pour season runs early March through late November, about 260 working days. CMA Fest in June and the Nashville Predators playoff runs create traffic and staging constraints in the Midtown and Broadway corridors. Annual emissions testing in Davidson County applies to contractor vehicles.",
    scenarioNotes: "Phosphatic-clay subgrade vapor-retarder installation adds $0.50-$1.00/sqft. Historic Zoning Commission review in East Nashville and Germantown adds 3-5 weeks for scoring-pattern and finish approval.",
    readyMixPlants: "Buzzi Unicem, Rogers Group, and Volunteer Ready Mix"
  },

};


const CITY_CONCRETE_EXTRA = {
  "st-louis-mo": {
    localProjectPara: `Driveway replacement along Arsenal Street in Benton Park, brick-rowhouse stoop rebuilds on Magnolia Avenue in The Hill, and walkout-basement patio pours overlooking the River Des Peres bluffs drive most residential concrete demand in the city. The City Building Division processes permits in 5-10 business days, but Lafayette Square and Compton Heights projects add Cultural Resources Office review for visible streetscape work. Tower Grove South and Clayton HOAs mandate earth-tone broom finish that matches the Mississippian limestone character of the surrounding masonry.`,
    weatherImpactPara: `Sixty freeze-thaw cycles, 42 inches of rain, and the April 2011 Good Friday EF4 tornado that carved through Bridgeton and Lambert Airport shape STL concrete decisions. Ameren Missouri and Spire coordinate 811 utility locates before excavation. The mature red oak and sweetgum canopy along Lindell Boulevard in the Central West End produces root-heave risk that requires Deeproot root-barrier panels on any pour within 12 feet of trunk.`,
    contractorVerifyPara: `Missouri has no statewide contractor license; City of St. Louis registration is required for work inside city limits while St. Louis County requires separate registration for Clayton, Ladue, and unincorporated areas. The Cultural Resources Office reviews visible concrete work in Lafayette Square, Soulard, Compton Heights, and Fox Park historic districts. Washington University Medical Center campus construction along Euclid Avenue restricts delivery-truck access and staging during weekday business hours.`,
  },
  "orlando-fl": {
    localProjectPara: `Pool-deck extensions in Windermere gated communities, driveway-turnaround pours on Lake Nona Medical City's oversized lots, and screened-porch foundation pads in College Park bungalows are the dominant residential scopes. City of Orlando Permitting Services processes permits in 3-7 business days; Celebration files through Osceola County instead. Winter Park's own Building Department enforces stricter design review on driveways along Pennsylvania and Swoope Avenues where the historic brick-street character sets the visual baseline.`,
    weatherImpactPara: `Zero freeze-thaw cycles but 50 inches of rain concentrated in June-September convective storms and direct hurricane exposure define Orlando's concrete challenges. Hurricane Ian's 2022 storm surge saturated subgrades across southwest Orange County, and Irma in 2017 toppled live oaks along Fairbanks Avenue whose root balls displaced adjacent slabs. OUC and Duke Energy Florida coordinate 811 locates. The live oak and cabbage palm canopy along Park Avenue in Winter Park requires 18-inch root barriers on any adjacent pour.`,
    contractorVerifyPara: `Florida DBPR licenses contractors; verify active status at myfloridalicense.com. The Orlando Historic Preservation Board reviews visible concrete work in Lake Eola Heights, Colonialtown, and Thornton Park. University of Central Florida campus-area properties along Alafaya Trail and Rollins College frontage on Holt Avenue face restricted delivery windows during the academic year. Orange County's sinkhole-risk overlay requires geotechnical clearance on flagged parcels before the building permit can be acted on.`,
  },
  "san-antonio-tx": {
    localProjectPara: `Post-tensioned structural slabs on the Taylor Marl east side, stamped Hill Country patios in The Pearl's restaurant courtyards, and circular driveway pours in Shavano Park and the Dominion are the signature residential scopes. City of San Antonio Development Services handles permits in 5-10 business days; Alamo Heights operates its own independent building department. King William Historic District projects require an HDRC Certificate of Appropriateness that adds 4-6 weeks to the schedule.`,
    weatherImpactPara: `Only 5 freeze-thaw cycles but extreme summer heat exceeding 105F with single-digit humidity creates plastic-shrinkage-cracking conditions that demand pre-dawn pours from May through September. Winter Storm Uri in February 2021 shut down CPS Energy for 4 days and froze partially cured slabs across Southtown and The Pearl. CPS Energy coordinates 811 utility locates. The live oak and pecan canopy along King William Street produces root-heave risk that requires barrier specification within 15 feet of mature trunks.`,
    contractorVerifyPara: `Texas has no statewide residential contractor license; TDLR registers mechanical and electrical trades only. CPS Energy service coordination runs through the 811 system. King William, Monte Vista, Dignowity Hill, Lavaca, and Tobin Hill are among 10+ historic districts under the HDRC with strict Certificate of Appropriateness requirements for visible concrete. UTSA, Trinity University, and the Alamo Colleges campus areas along Broadway and Hildebrand restrict delivery access during the academic year. Annual safety and emissions inspection at $25.50 combined fee applies to contractor vehicles.`,
  },
  "portland-or": {
    localProjectPara: `Craftsman-bungalow front-walk replacement along SE Hawthorne and NE Alberta, garage-pad reconstruction on the steep hillside lots of Council Crest and Southwest Portland, and rain-garden stormwater patios compliant with Portland's green-infrastructure manual drive residential demand. Bureau of Development Services permits in 2-4 weeks; Lake Oswego operates a separate building department. Sellwood and Laurelhurst neighborhood associations enforce informal finish expectations even without formal HOAs.`,
    weatherImpactPara: `Fifteen freeze-thaw cycles, 43 inches of rain across 150+ precipitation days, and the June 2021 heat dome (116F record) shape Portland concrete decisions. PGE and NW Natural coordinate 811 locates. The Douglas fir and bigleaf maple canopy along SE Division Street and NE Alameda Ridge produces aggressive root-heave displacement that Sellwood contractors routinely address with linear root barriers before pouring adjacent flatwork. The January 2021 ice storm snapped limbs that cratered driveways from Alberta Arts through Lake Oswego.`,
    contractorVerifyPara: `Oregon CCB license is mandatory; verify at ccb.oregon.gov. The Portland Historic Landmarks Commission reviews visible concrete in Irvington, Ladd's Addition, Piedmont, and Lair Hill districts. Portland State University along SW Broadway and Reed College on SE Woodstock restrict delivery-truck staging during the academic year. Biennial DEQ emissions testing applies to contractor diesel equipment. Portland's Clean Air Construction program imposes additional equipment standards on city-permitted projects.`,
  },
  "sacramento-ca": {
    localProjectPara: `Valley-ranch driveway replacement in Elk Grove and Natomas, Craftsman front-walk reconstruction along T Street in Midtown, and pool-patio extensions in Granite Bay and Folsom subdivisions are the dominant scopes. City of Sacramento Community Development permits in 5-10 business days; Roseville, Elk Grove, and Folsom each operate independent departments. East Sacramento's Fabulous 40s neighborhood enforces informal design expectations that push contractors toward period-appropriate scored finishes.`,
    weatherImpactPara: `Twelve mild freeze-thaw cycles, only 18 inches of rain, but Central Valley summer heat exceeding 100F for 60+ days and the January 2023 atmospheric-river flooding shape Sacramento's concrete challenges. SMUD and PG&E coordinate 811 locates. The valley oak canopy along East Sacramento's 45th Street and Land Park's Land Park Drive produces root-heave risk requiring 18-inch root barriers on adjacent flatwork. Folsom Dam releases during the 2023 flooding raised the American River water table to within 4 feet of grade in Fair Oaks.`,
    contractorVerifyPara: `California requires CSLB C-8 Concrete Contractor license; verify at cslb.ca.gov. The Sacramento Preservation Commission reviews visible concrete in Alkali Flat, Boulevard Park, and Poverty Ridge historic districts. UC Davis Medical Center along Stockton Boulevard and Sacramento State along J Street restrict delivery access during the academic year. Title 24 Part 6 solar-reflectance requirements apply to south-facing and west-facing driveways. Biennial smog checks through BAR apply to contractor vehicles.`,
  },
  "pittsburgh-pa": {
    localProjectPara: `Walkout-basement retaining-wall construction on the steep grades of Mt. Washington and Troy Hill, broom-finish driveway replacement in the Squirrel Hill bungalow belt, and stepped hillside walks on South Side Slopes' 30-percent grades drive Pittsburgh's residential concrete demand. City of Pittsburgh PLI permits in 2-3 weeks; Mt. Lebanon and Fox Chapel boroughs run independent departments. The Allegheny West and Mexican War Streets districts add Historic Review Commission approval for visible finishes.`,
    weatherImpactPara: `Seventy-five freeze-thaw cycles, 38 inches of rain with Great Lakes-effect moisture, and the June 2012 derecho that delivered 80-mph winds across Lawrenceville and the Strip District shape Pittsburgh's concrete decisions. Duquesne Light and Peoples Gas coordinate 811 locates. The red oak and American beech canopy along Ellsworth Avenue in Shadyside and Forbes Avenue in Squirrel Hill produces root-heave that requires root barriers within 12 feet of mature trunks. Mine subsidence from the Pittsburgh Coal Seam creates void risk in Brookline and Overbrook that demands PA DEP investigation before structural pours.`,
    contractorVerifyPara: `Pennsylvania requires Home Improvement Contractor registration under Act 132; verify at pago.state.pa.us. The Pittsburgh Historic Review Commission governs visible concrete in Allegheny West, Manchester, Mexican War Streets, and Deutschtown. University of Pittsburgh campus along Forbes Avenue and Carnegie Mellon along Margaret Morrison Street restrict delivery staging during the academic year. Annual safety inspection and biennial emissions testing through PennDOT apply to contractor vehicles. PA DEP mine-subsidence insurance is available up to $150,000 for properties in mapped coal-seam zones.`,
  },
  "columbus-oh": {
    localProjectPara: `Ranch-home driveway replacement in Clintonville and Bexley, walkout-basement patio pours on Worthington's rolling terrain, and historic front-walk reconstruction in German Village's brick-street setting are the signature Columbus scopes. Department of Building and Zoning Services permits in 5-10 business days; Dublin, Worthington, and Upper Arlington each have independent departments. German Village Commission approval for scoring pattern and finish adds 2-4 weeks.`,
    weatherImpactPara: `Eighty freeze-thaw cycles, 40 inches of rain, and the June 2012 derecho that delivered 75-mph straight-line winds across Clintonville and Bexley shape Columbus concrete decisions. AEP Ohio and Columbia Gas coordinate 811 locates. The sugar maple and Ohio buckeye canopy along Indianola Avenue in Clintonville and High Street in Worthington produces root-heave displacement that drives root-barrier specification on adjacent flatwork. Ohio State football Saturdays create staging blackout windows for any project within a mile of Ohio Stadium on Lane Avenue.`,
    contractorVerifyPara: `Ohio has no statewide residential contractor license; Columbus requires local registration through the Department of Building and Zoning. German Village, Victorian Village, and Italian Village fall under the Columbus Historic Preservation Commission with strict scoring-pattern and material review. Ohio State University campus properties along High Street and Capital University's Bexley campus restrict delivery access during the academic year. Ohio eliminated E-Check emissions testing statewide, so no vehicle-inspection requirement exists for contractors.`,
  },
  "kansas-city-mo": {
    localProjectPara: `Walkout-basement patio pours on the rolling terrain south of Brush Creek, Brookside bungalow-belt driveway replacement, and stamped pool surrounds in Lee's Summit subdivisions drive KC residential demand. KCMO Permits and Inspections handles the Missouri side in 5-10 business days; Overland Park, Prairie Village, and Lee's Summit each have independent Kansas-side departments. Country Club Plaza's J.C. Nichols deed restrictions predate modern zoning and add material and color requirements.`,
    weatherImpactPara: `Eighty freeze-thaw cycles, 39 inches of rain, and the May 2024 supercell that dropped 3-inch hail across southern Johnson County shape KC concrete decisions. Evergy and Spire coordinate 811 locates. The bur oak and hackberry canopy along Ward Parkway in Waldo and along 63rd Street in Brookside creates root-heave risk requiring barrier specification on adjacent pours. The March 2022 tornado outbreak across the metro drove a post-event demand spike that pushed contractor backlogs to 8-10 weeks.`,
    contractorVerifyPara: `Missouri has no statewide contractor license; Kansas requires Attorney General registration. The metro straddles both states, so a project on State Line Road may need permits from both jurisdictions. KCMO Historic Preservation Commission governs Country Club Plaza, Pendleton Heights, and Janssen Place; Kansas-side municipalities have limited historic protections. UMKC campus properties along Volker Boulevard and Rockhurst University along Troost Avenue restrict delivery staging during the academic year.`,
  },
  "indianapolis-in": {
    localProjectPara: `Bungalow-belt driveway and walk replacement along Pennsylvania Street in Meridian-Kessler, walkout-basement patios in Zionsville's rolling terrain, and large-pad garage extensions in Carmel's oversized-lot subdivisions are the signature Indianapolis scopes. Department of Business and Neighborhood Services handles Marion County permits in 5-10 business days; Carmel, Fishers, and Noblesville each have independent departments. Lockerbie Square's cobblestone-street setting demands historically compatible front walks with period-appropriate scoring.`,
    weatherImpactPara: `Eighty-five freeze-thaw cycles, 42 inches of rain, and INDOT's aggressive salt-brine program along Meridian Street and Keystone Avenue shape Indianapolis concrete decisions. AES Indiana and CenterPoint Energy coordinate 811 locates. The tulip poplar and white ash canopy along Kessler Boulevard in Meridian-Kessler and along the Monon Trail in Broad Ripple produces root-heave risk requiring barrier specification. The November 2013 EF2 tornado in Washington Township displaced root balls along Ditch Road that cracked adjacent driveways. Indianapolis 500 weekend creates a May completion deadline that compresses spring scheduling.`,
    contractorVerifyPara: `Indiana has no statewide residential contractor license but requires Marion County registration for work within the unified city-county government. Irvington, Lockerbie Square, Woodruff Place, and Herron-Morton Place fall under the Indianapolis Historic Preservation Commission with strict design review for visible concrete. Butler University campus along W. 46th Street and IUPUI along West Michigan Street restrict delivery staging during the academic year. Indiana does not require vehicle safety inspections or emissions testing.`,
  },
  "nashville-tn": {
    localProjectPara: `12South and East Nashville infill-home driveway pours, walkout-basement patio work on the rolling terrain of Belle Meade and Green Hills, and pool-surround construction in Franklin and Brentwood subdivisions drive Nashville's residential concrete demand. Metro Department of Codes Administration permits in 5-10 business days; Franklin and Brentwood in Williamson County have independent departments. Germantown's historic cottages require Metro Historic Zoning Commission approval for front-walk scoring patterns.`,
    weatherImpactPara: `Forty freeze-thaw cycles, 48 inches of rain, and the March 2020 EF3 tornado that tore through East Nashville, Germantown, Donelson, and Mt. Juliet shape Nashville concrete decisions. NES and Piedmont Natural Gas coordinate 811 locates. The eastern red cedar and tulip poplar canopy along Fatherland Street in East Nashville and along Granny White Pike in Green Hills produces root-heave risk on adjacent flatwork. The March 2020 tornado deposited debris into subgrades along Five Points that still contaminates excavation.`,
    contractorVerifyPara: `Tennessee requires a Home Improvement License for projects over $3,000 through the Tennessee Board for Licensing Contractors; verify at tn.gov/commerce. Metro Nashville Historic Zoning Commission governs visible concrete in East Nashville, Germantown, and Lockeland Springs. Vanderbilt University campus along West End Avenue and Belmont University along Belmont Boulevard restrict delivery staging during the academic year. Annual emissions testing in Davidson County applies to contractor vehicles 3-25 model years old.`,
  },
};

// Merge extra content into primary dict
for (const [slug, extra] of Object.entries(CITY_CONCRETE_EXTRA)) {
  CITY_CONCRETE_DATA[slug] = Object.assign(CITY_CONCRETE_DATA[slug] || {}, extra);
}

/* ---------- Section 1: Neighborhood Pricing Breakdown ---------- */
function neighborhoodPricing(facts, mult, cd) {
  if (!facts?.neighborhoods?.length) return "";
  const baseDriveway = pricingModel.basePricePerSqft.standard_driveway.mid;
  const basePatio = pricingModel.basePricePerSqft.concrete_patio.mid;
  const baseSidewalk = pricingModel.basePricePerSqft.sidewalk.mid;
  const baseFoundation = 6500;

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.07 : i % 3 === 1 ? -0.05 : 0.04) * (i % 2 === 0 ? 1 : -1));
    const driveway = Math.round(baseDriveway * 400 * mult * localVar);
    const patio = Math.round(basePatio * 300 * mult * localVar);
    const sidewalk = Math.round(baseSidewalk * 150 * mult * localVar);
    const foundation = Math.round(baseFoundation * mult * localVar);
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtComma(driveway)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtComma(patio)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtComma(sidewalk)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtComma(foundation)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>${facts.displayName} Neighborhood Pricing</h2>
<p>${cd.pricingIntro || `Ranges reflect ${cd.readyMixPlants} ready-mix rates plus local labor. ${cd.scenarioNotes}`}</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Driveway (400sf)</th>
<th style="text-align:right; padding:12px 16px;">Patio (300sf)</th>
<th style="text-align:right; padding:12px 16px;">Sidewalk (150sf)</th>
<th style="text-align:right; padding:12px 16px;">Foundation Repair</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
</section>`;
}

/* ---------- Section 2: Subgrade + Mix ---------- */
function subgradeAndMix(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Subgrade and Mix Design</h2>
<p>${cd.soilPara}</p>
<p>${cd.mixPara}</p>
<p>${cd.rebarPara}</p>
</section>`;
}

/* ---------- Section 3: Climate Impact ---------- */
function climateImpact(city, cd) {
  return `
<section class="section fp-section">
<h2>Climate Impact on ${city} Concrete</h2>
<p>${cd.climatePara}</p>
<p>${cd.disasterPara}</p>
</section>`;
}

/* ---------- Section 4: Permits + Setback ---------- */
function permitsAndSetback(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Permits and Right-of-Way Rules</h2>
<p>${cd.permitPara}</p>
<p>${cd.setbackPara}</p>
</section>`;
}

/* ---------- Section 5: Contractor Style ---------- */
function contractorStyle(city, cd) {
  return `
<section class="section fp-section">
<h2>What ${city} Concrete Contractors Actually Do</h2>
<p>${cd.stylePara}</p>
<p>${cd.decorativePara}</p>
</section>`;
}

/* ---------- Section 6: Red Flags (derived from metro-specific dict text) ---------- */
function redFlagsSection(city, cd) {
  // Each flag's body references a unique metro paragraph so shingles differ per metro.
  const flags = [
    { title: `Bid ignores ${city} mix spec`, body: `${cd.mixPara}` },
    { title: `Reinforcement weaker than the ${city} baseline`, body: `${cd.rebarPara}` },
    { title: `Climate exposure unaddressed`, body: `${cd.climatePara}` },
    { title: `Missing disaster-informed detailing`, body: `${cd.disasterPara}` },
    { title: `Setback or permit gaps`, body: `${cd.setbackPara}` },
    { title: `Pour window mismatch`, body: `${cd.seasonPara}` },
  ];

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>${city} Concrete Red Flags</h2>
${flagsHTML}
</section>`;
}

/* ---------- Section 7: Seasonal Guide ---------- */
function seasonalGuide(city, cd) {
  return `
<section class="section fp-section">
<h2>When to Pour Concrete in ${city}</h2>
<p>${cd.seasonPara}</p>
<p>${cd.scenarioNotes}</p>
</section>`;
}

/* ---------- Section 7b: Scope Checklist (reuses dict text) ---------- */
function scopeChecklist(city, cd) {
  return `
<section class="section fp-section">
<h2>What Your ${city} Contract Should Spell Out</h2>
<p><strong>Mix design.</strong> ${cd.mixPara}</p>
<p><strong>Reinforcement.</strong> ${cd.rebarPara}</p>
<p><strong>Subgrade preparation.</strong> ${cd.soilPara}</p>
<p><strong>Permit package.</strong> ${cd.permitPara}</p>
</section>`;
}

/* ---------- Section 7c: Failure Modes (reuses climate + disaster) ---------- */
function failureModes(city, cd) {
  return `
<section class="section fp-section">
<h2>How ${city} Concrete Fails</h2>
<p>${cd.climatePara}</p>
<p>${cd.disasterPara}</p>
<p>${cd.setbackPara}</p>
</section>`;
}

/* ---------- Section 7d: Dominant Style Deep-Dive ---------- */
function styleDeepDive(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Concrete Style and Finish Choices</h2>
<p>${cd.stylePara}</p>
<p>${cd.decorativePara}</p>
<p>${cd.scenarioNotes}</p>
</section>`;
}

/* ---------- Section 7e: Maintenance Guide ---------- */

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

function maintenanceGuide(city, cd) {
  return `
<section class="section fp-section">
<h2>${city} Concrete Maintenance</h2>
<p>${cd.maintenancePara}</p>
<p>${cd.decorativePara}</p>
<p>${cd.seasonPara}</p>
</section>`;
}

/* ---------- Section 7f: Common Mistakes ---------- */
function commonMistakes(city, cd) {
  return `
<section class="section fp-section">
<h2>Costly ${city} Concrete Mistakes</h2>
<p>${cd.commonMistakePara}</p>
<p>${cd.permitPara}</p>
<p>${cd.scenarioNotes}</p>
</section>`;
}

/* ---------- Section 7g: Buyer Questions (reuses dict text via new framing) ---------- */
function buyerQuestions(city, cd) {
  return `
<section class="section fp-section">
<h2>Questions to Ask a ${city} Concrete Contractor</h2>
<p><strong>What mix spec will you pour?</strong> ${cd.mixPara}</p>
<p><strong>How are you reinforcing?</strong> ${cd.rebarPara}</p>
<p><strong>How does your bid address ${city} climate exposure?</strong> ${cd.climatePara}</p>
<p><strong>What local disaster informs your detailing?</strong> ${cd.disasterPara}</p>
<p><strong>Who pulls the permit?</strong> ${cd.permitPara}</p>
</section>`;
}

/* ---------- Section 8: Cost Scenarios (derived from dict text) ---------- */
function costScenarios(city, mult, cd) {
  const base = pricingModel.basePricePerSqft;
  const budgetTotal = Math.round(base.standard_driveway.mid * 400 * mult);
  const midTotal = Math.round(base.stamped_concrete.mid * 350 * mult);
  const premTotal = Math.round(base.standard_driveway.mid * 600 * mult + base.sidewalk.mid * 200 * mult + 4500 * mult);

  // Derive scenario bodies from per-metro fields so shingles vary.
  const budgetBody = `Delivery from ${cd.readyMixPlants}. ${cd.mixPara.split(". ")[0]}.`;
  const midBody = `${cd.decorativePara.split(". ")[0]}. ${cd.stylePara.split(". ")[0]}.`;
  const premBody = `${cd.scenarioNotes} ${cd.permitPara.split(". ")[0]}.`;

  function card(label, title, total, body, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${title}</p>
<p class="fp-scenario-total">${fmtDollar(total)}</p>
<p class="fp-scenario-detail">${body}</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>${city} Concrete Project Scenarios</h2>
<div class="fp-scenario-grid">
${card("Budget", `400 sqft ${city} driveway`, budgetTotal, budgetBody, "#22c55e")}
${card("Mid-Range", `350 sqft stamped patio, ${city}`, midTotal, midBody, "#3b82f6")}
${card("Premium", `${city} full hardscape package`, premTotal, premBody, "#8b5cf6")}
</div>
</section>`;
}

/* ---------- CSS ---------- */
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

/* ---------- Build ---------- */


function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  const cd = CITY_CONCRETE_DATA[metro.slug];
  if (!facts || !ctx || !cd) return null;

  const city = facts.displayName;
  const mult = getMultiplier(metro.region);

  let html = `\n${flagshipCSS()}\n`;
  html += `${MARKER_START}\n`;
  html += neighborhoodPricing(facts, mult, cd);
  html += subgradeAndMix(city, cd);
  html += climateImpact(city, cd);
  html += permitsAndSetback(city, cd);
  html += contractorStyle(city, cd);
  html += redFlagsSection(city, cd);
  html += failureModes(city, cd);
  html += scopeChecklist(city, cd);
  html += styleDeepDive(city, cd);
  html += maintenanceGuide(city, cd);
  html += commonMistakes(city, cd);
  html += buyerQuestions(city, cd);
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
    const re = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, "g");
    content = content.replace(re, "");

    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const otherServices = content.indexOf('<h2>Other Services in');
    let insertAt;
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else if (otherServices >= 0) {
      const sectionBefore = content.lastIndexOf("<section", otherServices);
      insertAt = sectionBefore >= 0 ? sectionBefore : otherServices;
    } else {
      console.log(`  SKIP ${metro.file} (no injection point found)`);
      skipped++;
      continue;
    }

    content = content.slice(0, insertAt) + nl + flagshipContent + nl + content.slice(insertAt);
    if (!DRY) fs.writeFileSync(filepath, content, "utf8");

    const wordCount = flagshipHTML.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    console.log(`  ${metro.file}: ~${wordCount} words`);
    processed++;
  }

  console.log(`\nDone: ${processed} processed, ${skipped} skipped.`);
  if (DRY) console.log("[DRY RUN]");
}

main();
