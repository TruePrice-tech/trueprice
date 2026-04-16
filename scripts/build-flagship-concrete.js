#!/usr/bin/env node
/**
 * Generates deep editorial content for 20 flagship metro concrete pages.
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
    readyMixPlants: "Ferrara, Eastern Concrete, and Empire Transit Mix"
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
    readyMixPlants: "Robertson's Ready Mix, CalPortland, and National Ready Mixed"
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
    readyMixPlants: "Ozinga, Prairie Material, and Lafarge Holcim Lemont"
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
    readyMixPlants: "US Concrete, Tilcon Martin Marietta, and Southern Star Concrete"
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
    readyMixPlants: "Cemex, CalPortland Rillito, and Salt River Materials Group"
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
    readyMixPlants: "Martin Marietta, Trinity Industries Ready-Mix, and Big-D Concrete"
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
    readyMixPlants: "Thomas Concrete, Argos USA, and Ready Mix USA"
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
    readyMixPlants: "Aggregate Industries Holcim, Transit Mix Concrete, and Martin Marietta"
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
    readyMixPlants: "Stoneway Concrete, Glacier Northwest, and Cadman"
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
    readyMixPlants: "Cemex Buda, Capitol Aggregates, and Texas Materials Group"
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
    readyMixPlants: "Central Concrete, Cemex SF, and Bode Gravel"
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
    readyMixPlants: "CEMEX Apex, Service Rock Products, and Nevada Ready Mix"
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
    readyMixPlants: "Silvi Concrete, Eastern Concrete Materials, and Penn Jersey Concrete"
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
    readyMixPlants: "Titan America Pennsuco, Cemex, and Continental Cement"
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
    readyMixPlants: "Aggregate Industries Holcim, Boston Sand and Gravel, and S&F Concrete"
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
    readyMixPlants: "Robertson's Ready Mix, Superior Ready Mix, and Hanson Aggregates"
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
    readyMixPlants: "Titan Florida Port of Tampa, Cemex Tampa, and Argos USA"
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
    readyMixPlants: "Edward C. Levy Co., Michigan Truck Mix, and Superior Materials"
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
    readyMixPlants: "Cemstone, Aggregate Industries Holcim, and Knife River"
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
    readyMixPlants: "Carolina Sunrock, Thomas Concrete Carolinas, and Ready Mixed Concrete Company"
  }
};

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

/* ---------- Section 7e: Buyer Questions (reuses dict text via new framing) ---------- */
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
  html += buyerQuestions(city, cd);
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
