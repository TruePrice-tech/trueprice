#!/usr/bin/env node
/**
 * Replace template-generated CITY_ROOF_EXTRA2 and CITY_ROOF_MAINT entries
 * for 10 new metros with unique hand-written content.
 */
const fs = require("fs");
const path = require("path");
const FILE = path.resolve(__dirname, "..", "scripts/build-flagship-roofing.js");
let src = fs.readFileSync(FILE, "utf8");

const SLUGS = ["st-louis-mo","orlando-fl","san-antonio-tx","portland-or","sacramento-ca","pittsburgh-pa","columbus-oh","kansas-city-mo","indianapolis-in","nashville-tn"];

const EXTRA2 = {
  "st-louis-mo": {
    tearOffDisposalPara: `St. Louis tear-off debris routes to Republic Services facilities in Bridgeton and South County, with tipping fees at $55-$80 per ton reflecting the city-county jurisdictional patchwork. A typical Central West End or Soulard rowhouse tear-off generates 2-4 tons because flat-roof modified bitumen strips lighter than pitched composition. Fred Weber Inc. accepts shingle recyclate for hot-mix asphalt at their I-270 plant, cutting disposal cost 25-30%.`,
    installerScarcityPara: `The St. Louis installer pool splits across the city-county line: city-registered crews rarely cross into county jurisdiction because each requires separate business registration and insurance naming. Approximately 180-280 active crews serve the combined metro. GAF Master Elite and Owens Corning Platinum Preferred certifications concentrate in the county suburbs while city-side installers more commonly hold CertainTeed credentialing.`,
    energyCreditsPara: `Ameren Missouri offers weatherization rebates of $400-$800 when attic insulation is upgraded during reroof scope. Spire gas rebates stack for qualifying envelope improvements on the Missouri side. The federal 25C energy efficiency credit covers 30% of insulation cost up to $1,200 annually. The Illinois Metro East side operates under Illinois Shines with separate and often more generous incentive structures.`,
  },
  "orlando-fl": {
    tearOffDisposalPara: `Orlando tear-off routes to Waste Management facilities in Orange and Osceola counties at $45-$65 per ton. Concrete tile tear-off generates 8-12 tons per home versus 3-5 for composition, and the weight difference materially affects disposal cost and dumpster sizing. CEMEX Orlando accepts crushed concrete tile for aggregate recycling at their Davenport processing plant. Composition shingle recycling is limited in Central Florida compared to northern markets.`,
    installerScarcityPara: `Orlando's installer pool competes for labor with the massive Disney-area commercial construction market and new-home builders in Lake Nona and Horizon West. Approximately 250-400 active residential crews serve the four-county metro but FPA compliance verification adds 1-2 days to every job compared to non-Florida markets. Hurricane-season scheduling disruptions from June through November compress the productive install calendar to roughly 7 months.`,
    energyCreditsPara: `OUC and Duke Energy Florida offer modest efficiency rebates when attic insulation is bundled with reroof scope, typically $200-$500. Florida has no state-level roofing energy credit beyond the federal 25C at 30% up to $1,200 annually. Florida's solar-ready roof provisions under FBC may trigger additional electrical-conduit rough-in requirements on certain reroof scopes in OUC territory.`,
  },
  "san-antonio-tx": {
    tearOffDisposalPara: `San Antonio tear-off debris routes to BFI and Republic Services facilities along I-35 and Loop 1604 corridors at $40-$60 per ton, among the lowest in major Texas metros. Hail-damaged Class 4 impact-rated shingles contain SBS-modified asphalt that commands a recycling premium because of its superior binder properties. Capitol Aggregates accepts recyclate at their Bexar County operations for road-base aggregate.`,
    installerScarcityPara: `San Antonio's installer pool swells 30-40% after major hail events as storm-chase crews arrive from Oklahoma, Arkansas, and Alabama. The baseline metro has approximately 200-350 active residential crews, but post-storm capacity can double temporarily. CPS Energy's municipal-utility structure means no retail-provider coordination delays on service-entrance work unlike deregulated ERCOT markets. JBSA military PCS relocations create a secondary demand driver from May through August.`,
    energyCreditsPara: `CPS Energy's SAVE program covers attic insulation upgrades at $0.30-$0.50 per sqft when bundled with reroof scope. The federal 25C credit stacks at 30% up to $1,200 annually on qualifying insulation. Texas has no state-level energy efficiency credit. CPS Energy's SolarHost program provides additional incentives when solar is installed within 12 months of a qualifying reroof on an eligible CPS-served property.`,
  },
  "portland-or": {
    tearOffDisposalPara: `Portland tear-off debris routes to Metro South or Metro Central transfer stations at $65-$95 per ton, Oregon's highest among major metros. Cedar shake tear-off contains creosote-treated material that some facilities reject outright, requiring specialty hauling to Coffin Butte Landfill in Corvallis. Knife River Materials accepts composition shingle recyclate for hot-mix asphalt at their Wilsonville plant. Oregon DEQ tracks construction debris diversion rates by contractor license number.`,
    installerScarcityPara: `Portland's installer pool benefits uniquely from Malarkey Roofing Products' local headquarters: more Portland crews hold Malarkey certification than in any other US metro, giving homeowners the broadest Malarkey product selection anywhere. Approximately 160-250 active residential crews serve the four-county metro. The June-September dry-season install window compresses demand into 4 months, pushing peak-season lead times to 10-16 weeks. Oregon CCB license verification at ccb.oregon.gov is the mandatory first vetting step.`,
    energyCreditsPara: `Energy Trust of Oregon provides $0.50-$1.25 per sqft rebates on attic insulation upgrades bundled with reroof scope, among the most generous utility-funded programs in the country. Portland Clean Energy Fund may provide additional funding for qualifying low-income properties in specific census tracts. The federal 25C credit stacks at 30% up to $1,200 annually. PGE and Pacific Power net-metering programs coordinate with solar installations paired with reroof scope through the Energy Trust solar pathway.`,
  },
  "sacramento-ca": {
    tearOffDisposalPara: `Sacramento tear-off debris routes to Kiefer Landfill or L&D Landfill in Sacramento County. CalRecycle mandates 65% diversion of construction debris from landfill; keep disposal receipts because the Sacramento CDD inspector will request them at final sign-off. Teichert's Sacramento aggregate operations accept composition shingle recyclate for road-base applications. Concrete tile tear-off at Elk Grove and Roseville subdivisions generates 8-12 tons per home and qualifies for higher recycling credits than composition.`,
    installerScarcityPara: `Sacramento's installer pool operates year-round because the Central Valley climate allows installation in every month except during atmospheric-river rain events from December through March. Approximately 200-320 active residential crews serve the four-county metro. CSLB C-39 license verification at cslb.ca.gov is mandatory before any work begins. SMUD territory crews have an advantage over PG&E-territory crews because SMUD's streamlined interconnection process makes solar-bundle upsells significantly easier to close and schedule.`,
    energyCreditsPara: `SMUD offers among the best municipal-utility efficiency rebates in the country: $0.75-$1.50 per sqft for attic insulation during reroof scope. Title 24 Part 6 cool-roof reflectance requirements may trigger mandatory coating upgrades during low-slope reroof. The federal 25C credit stacks at 30% up to $1,200 annually. SMUD's net-metering framework operates independently from NEM 3.0 (which applies only to IOU territories like PG&E), making Sacramento one of the most favorable solar-bundle markets in California.`,
  },
  "pittsburgh-pa": {
    tearOffDisposalPara: `Pittsburgh tear-off disposal faces unique challenges from hillside access: South Side Slopes and Mt. Washington properties may require crane-assisted debris removal at $1,500-$4,000 premium over standard dumpster service. Tipping fees at Arden Landfill and Imperial Land Company run $50-$75 per ton. Pennsylvania slate tear-off from Allegheny West and Manchester landmarked homes generates 12-18 tons of heavy debris requiring flatbed hauling. Allegheny Mineral in Kittanning accepts composition recyclate for aggregate processing.`,
    installerScarcityPara: `Pittsburgh's installer pool includes a significant union presence in the city proper through Roofers Local 37, which adds 10-15% to labor costs versus non-union suburban crews in Mt. Lebanon, Fox Chapel, and Cranberry Township. Approximately 140-220 active residential crews serve the six-county metro. The combination of extreme hillside topography requiring specialty equipment and 75 freeze-thaw cycles demanding precise ice-and-water-shield installation makes Pittsburgh among the most technically demanding roofing markets east of the Rockies.`,
    energyCreditsPara: `Duquesne Light and Peoples Gas offer envelope-improvement rebates of $300-$800 for attic insulation bundled with reroof scope in qualifying Allegheny County homes. Pennsylvania SRECs sell at $20-$45 per MWh in the PA compliance market, making solar-bundle projects more attractive than in neighboring Ohio or West Virginia markets. The federal 25C credit stacks at 30% up to $1,200 annually. The PA Weatherization Assistance Program provides additional funding for qualifying low-income properties in the Pittsburgh metro.`,
  },
  "columbus-oh": {
    tearOffDisposalPara: `Columbus tear-off debris routes to Franklin County Sanitary Landfill or Rumpke facilities along I-71 south at $40-$55 per ton, among the lowest tipping fees in the Midwest. German Village flat-roof modified bitumen tear-off generates lighter debris at 1.5-3 tons compared to pitched-roof composition at 3-5 tons per home. Shelly Company's Franklin County operations accept composition recyclate for road-base aggregate processing. The city's uniformly flat topography keeps debris-chute setup and dumpster-placement costs minimal on every jobsite.`,
    installerScarcityPara: `Columbus is the fastest-growing metro in Ohio, and residential construction demand in Delaware and Union counties competes directly with reroof labor across the metro. Approximately 150-250 active residential crews serve the seven-county area. Owens Corning's Toledo headquarters means Columbus has the broadest OC Platinum Preferred dealer network in the Midwest, with 15+ certified firms. Ohio State University campus-area demand creates scheduling pressure in August-September as rental properties turn over between academic years.`,
    energyCreditsPara: `AEP Ohio offers envelope-improvement rebates of $200-$600 when attic insulation is upgraded during reroof scope in qualifying Franklin County homes. Ohio SRECs sell at $10-$30 per MWh, providing modest but meaningful solar-bundle incentive through the Ohio RPS compliance market. The federal 25C credit stacks at 30% up to $1,200 annually for insulation. Columbia Gas rebates stack for qualifying natural-gas-heated homes upgrading from R-19 to R-49 attic insulation during the reroof window.`,
  },
  "kansas-city-mo": {
    tearOffDisposalPara: `Kansas City tear-off disposal straddles the MO/KS state line: Missouri-side debris routes to Smithville or Sugar Creek landfills at $45-$65 per ton, while Kansas-side routes to Johnson County Landfill at $55-$75. Hail-damaged tear-off volume spikes 300-500% after major supercell events and overwhelms disposal capacity for 2-4 weeks. Hunt Midwest's SubTropolis underground business complex provides unusual covered staging for large commercial tear-off projects. Ash Grove Cement accepts recyclate for road-base at their Kansas City operations.`,
    installerScarcityPara: `Kansas City's installer pool faces the dual-state licensing challenge: Missouri-side crews need KCMO contractor registration while Kansas-side crews need Kansas AG registration, and few firms maintain both active credentials. Approximately 200-320 active residential crews serve the metro across both states. Johnson County KS building inspectors enforce stricter nailing-pattern verification than KCMO inspectors, adding 1-2 days to project completion on the Kansas side. Post-hail storm-chase crews inflate the apparent labor pool by 40-60% for 3-6 months after major events.`,
    energyCreditsPara: `Evergy offers efficiency rebates on both sides of the state line but program details and qualifying thresholds differ by state tariff. Missouri-side rebates run $300-$700 for attic insulation during reroof through the Evergy Missouri program. Kansas-side rebates through Evergy Kansas run $250-$600 with different documentation requirements. Spire gas rebates on the Missouri side add another $150-$400 for qualifying envelope improvements. The federal 25C credit applies at 30% up to $1,200 annually regardless of which side of State Line Road the property sits.`,
  },
  "indianapolis-in": {
    tearOffDisposalPara: `Indianapolis tear-off debris routes to Southside Landfill or Citizens Transfer Station at $35-$55 per ton, among the lowest disposal costs of any major US metro reflecting Indiana's competitive waste-hauling market. The White River floodplain's flat terrain makes dumpster placement and debris-chute setup straightforward on every jobsite without the access premiums common in Pittsburgh or Cincinnati. Ray's Trash Service handles most residential tear-off hauling in Marion County. IMI's six batch plants along I-465 accept aggregate recyclate but not asphalt shingle material.`,
    installerScarcityPara: `Indianapolis's installer market benefits from central geographic positioning: regional crews from Louisville, Cincinnati, and Dayton regularly work the Indy metro, expanding the effective labor pool beyond the 130-220 locally based residential crews. The 85 freeze-thaw cycles per year, the highest among major Midwest metros, demand technically proficient ice-and-water-shield installation that separates qualified crews from volume-production operators. Indianapolis 500 race week in late May creates a 7-10 day scheduling blackout in Speedway-adjacent neighborhoods where street closures and security perimeters block truck access.`,
    energyCreditsPara: `AES Indiana's residential efficiency program provides $200-$500 rebates for attic insulation upgraded during reroof scope on qualifying Marion County homes. CenterPoint Energy Indiana gas rebates stack for qualifying homes at $150-$350 for R-value improvements. Indiana's Excess Distributed Generation tariff replaced traditional net metering in 2022, reducing solar-bundle ROI compared to neighboring Ohio and Illinois markets where net metering remains intact. The federal 25C credit applies at 30% up to $1,200 annually for insulation installed during qualifying reroof projects.`,
  },
  "nashville-tn": {
    tearOffDisposalPara: `Nashville tear-off debris routes to Middle Point Landfill in Murfreesboro or Republic Services facilities along I-24 at $45-$65 per ton. The March 2020 EF3 tornado generated an estimated 200,000 tons of construction debris across Davidson County, overwhelming disposal capacity for six months and establishing temporary staging areas in Donelson and Hermitage that remained active into 2021. Rogers Group's Nashville-area aggregate operations accept composition shingle recyclate for road-base applications through their Dickson County processing facility.`,
    installerScarcityPara: `Nashville's explosive 3-4% annual population growth has created persistent installer scarcity that pushes baseline lead times 2-4 weeks beyond comparably sized metros like Columbus or Indianapolis. Approximately 180-300 active residential crews serve the six-county metro, but new-construction demand from Williamson County (Franklin, Brentwood) and Wilson County (Mt. Juliet, Lebanon) absorbs 30-40% of available labor. The March 2020 tornado aftermath demonstrated that Nashville lacks the storm-surge labor response capacity of Dallas or Houston hail markets. Firestone Building Products, now Elevate and headquartered in Nashville, provides direct manufacturer support for flat-roof membrane projects.`,
    energyCreditsPara: `NES distributes TVA-generated power and offers EnergyRight rebates of $300-$700 for attic insulation upgrades bundled with reroof scope on qualifying Davidson County homes. Piedmont Natural Gas rebates stack for gas-heated homes at $150-$350 for qualifying envelope improvements. Tennessee has no state-level energy efficiency credit or SREC market, making the federal 25C credit at 30% up to $1,200 the primary insulation incentive. TVA's Valley Solar program provides additional solar-bundle incentives when installed within 12 months of a qualifying reroof on a NES-served property.`,
  },
};

const MAINT = {
  "st-louis-mo": `St. Louis post-install maintenance follows the Mississippi Valley cadence: inspect after every spring supercell season in June and again before first freeze in November. Clear Soulard and Central West End tree debris from valleys and gutters. Check Lafayette Square slate flashing at copper-to-slate transitions annually. Treat north-facing slopes in University City and Maplewood for moss if non-AR composition. Ameren Missouri storm-damage documentation within 72 hours supports insurance claims after spring events.`,
  "orlando-fl": `Orlando post-install maintenance centers on pre-hurricane-season preparation with a May inspection and post-storm damage documentation within 72 hours of any tropical system. Check FPA-rated fastener patterns on tile roofs in Dr. Phillips and Windermere annually. Assess algae growth on north-facing composition in College Park and Winter Park tree-canopy areas where live oak shade promotes biological colonization. OUC territory homes should coordinate any roof-mounted equipment maintenance with the annual solar-system check if applicable.`,
  "san-antonio-tx": `San Antonio post-install maintenance tracks the hail calendar: photograph the entire roof surface after every spring supercell event from March through June with dated exterior photos for insurance documentation. Check Class 4 impact surface for granule displacement in Stone Oak and Alamo Heights where hail frequency is highest. Assess UV degradation on south-facing slopes annually because San Antonio UV intensity shortens non-Class-4 composition life by 3-5 years versus northern markets. CPS Energy coordinates any roof-mounted solar equipment maintenance through their SolarHost program.`,
  "portland-or": `Portland maintenance is dominated by moss management: treat north-facing slopes with zinc-sulfate solution every February before spring growth season in Laurelhurst, Eastmoreland, and Alameda Ridge neighborhoods. Clear Douglas fir needle debris from valleys and gutters quarterly during the October-May wet season. Inspect cedar shake homes in Dunthorpe and Lake Oswego for split shakes and failed stain every 3-5 years. Malarkey AR-granule products installed by local crews resist moss colonization 3-5 years longer than non-AR composition on equivalent north-facing exposures.`,
  "sacramento-ca": `Sacramento maintenance follows the Central Valley UV calendar: inspect annually in October before atmospheric-river season begins in November. Assess south-facing and west-facing granule loss because Sacramento UV exposure accelerates degradation 20-30% faster than coastal California markets. Clear valley oak leaf accumulation in East Sacramento and Land Park gutters before the November rains arrive. Title 24 cool-roof coatings require reflectivity testing at year 3 and re-coating by year 8-10 to maintain code compliance on qualifying low-slope sections.`,
  "pittsburgh-pa": `Pittsburgh maintenance addresses Three Rivers humidity and extreme hillside drainage: inspect twice annually in May after freeze-thaw season concludes and again in October before winter onset. Check Allegheny West and Manchester slate installations for cracked or displaced tiles after every winter because 75 freeze-thaw cycles stress every fastener. Assess moss on north-facing slopes in Squirrel Hill and Shadyside where the valley microclimate traps moisture. South Side Slopes properties require gutter and downspout verification after heavy rain because hillside drainage concentrates runoff onto lower-elevation roofs.`,
  "columbus-oh": `Columbus maintenance follows the Scioto Valley freeze-thaw calendar: inspect in late April after the last hard freeze and again in October before winter onset. German Village flat-roof homes require specific membrane inspection for ponding water and internal-drain flow verification after heavy spring rains. Clintonville and Worthington tree-canopy areas need annual moss treatment on non-AR composition where sugar maple and red oak shade promotes biological growth. Owens Corning warranty maintenance requirements are strictly enforced by local OC Platinum Preferred dealers who perform annual inspections as part of the extended warranty compliance program.`,
  "indianapolis-in": `Indianapolis maintenance must account for the metro's 85 freeze-thaw cycles, the highest count among major Midwest cities, which accelerates sealant aging at every flashing and boot penetration. Inspect in late April after final freeze and in October before winter onset. Check ice-and-water-shield integrity at eaves after any ice-dam event in Meridian-Kessler and Broad Ripple where the mature tulip poplar canopy creates shading that promotes ice formation. The 250-350 ppm hard water from Citizens Water causes white efflorescence staining on metal fascia and drip-edge that requires annual cleaning with dilute muriatic acid solution.`,
  "nashville-tn": `Nashville maintenance balances the moderate 40 freeze-thaw cycle with heavy 48-inch annual rainfall concentrated across all seasons: inspect in March after winter and before spring storm season and again in September before fall leaf drop. East Nashville and Germantown homes rebuilt after the March 2020 EF3 tornado should verify that new fastener patterns meet the enhanced Metro Codes Administration wind-uplift standards adopted post-tornado. Clear eastern red cedar year-round debris from gutters and valleys in Green Hills and Belle Meade where the cedar canopy sheds continuously rather than seasonally.`,
  "kansas-city-mo": `Kansas City maintenance tracks the severe hail calendar: photograph the entire roof surface after every spring supercell event from March through June for insurance documentation with dated and geotagged images. Johnson County KS inspectors may re-inspect post-hail repairs on homes within 5 years of original permit close-out. Check Country Club Plaza clay tile installations for displaced or cracked tiles after hail events because the S-tile profile catches stones. Brookside and Waldo bur oak acorn-cap debris requires gutter clearing in October-November before the first freeze locks organic matter in place.`,
};

// Replace EXTRA2 entries
for (const slug of SLUGS) {
  if (!EXTRA2[slug]) continue;
  const dictName = "CITY_ROOF_EXTRA2";
  const dictStart = src.indexOf(dictName + " = {");
  const slugStr = `"${slug}"`;
  const slugStart = src.indexOf(slugStr, dictStart);
  if (slugStart < 0) { console.log(`  SKIP EXTRA2 ${slug} (not found)`); continue; }

  // Find the entry: from the slug to the closing },
  const entryObjStart = src.indexOf("{", slugStart + slugStr.length);
  let depth = 0, i = entryObjStart;
  while (i < src.length) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") { depth--; if (depth === 0) break; }
    i++;
  }
  // i is at closing }. Find the comma after
  let end = i + 1;
  while (end < src.length && src[end] !== "," && src[end] !== "\n") end++;
  if (src[end] === ",") end++;

  const oldEntry = src.substring(slugStart, end);

  let newEntry = `"${slug}": {\n`;
  for (const [k, v] of Object.entries(EXTRA2[slug])) {
    newEntry += `    ${k}: \`${v}\`,\n`;
  }
  newEntry += `  },`;

  src = src.replace(oldEntry, newEntry);
  console.log(`  Replaced EXTRA2 ${slug}`);
}

// Replace MAINT entries
for (const slug of SLUGS) {
  if (!MAINT[slug]) continue;
  const dictName = "CITY_ROOF_MAINT";
  const dictStart = src.indexOf(dictName + " = {");
  const slugStr = `"${slug}"`;
  const slugStart = src.indexOf(slugStr, dictStart);
  if (slugStart < 0) { console.log(`  SKIP MAINT ${slug} (not found)`); continue; }

  // MAINT entries: "slug": `text`,
  const backtickStart = src.indexOf("`", slugStart + slugStr.length);
  const backtickEnd = src.indexOf("`", backtickStart + 1);

  const oldText = src.substring(backtickStart + 1, backtickEnd);
  src = src.replace(oldText, MAINT[slug]);
  console.log(`  Replaced MAINT ${slug}`);
}

fs.writeFileSync(FILE, src, "utf8");
console.log("\nDone. Now rebuild roofing.");
