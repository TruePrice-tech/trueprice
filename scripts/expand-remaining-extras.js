#!/usr/bin/env node
/**
 * Adds EXTRA dicts to 12 builders that only have primary dicts,
 * boosting uniqueness for 10 new metros.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const METROS = ["st-louis-mo","orlando-fl","san-antonio-tx","portland-or","sacramento-ca","pittsburgh-pa","columbus-oh","kansas-city-mo","indianapolis-in","nashville-tn"];

// Metro-specific deep-local details for uniqueness
const L = {
  "st-louis-mo": { utilShort:"Ameren Missouri", gasUtil:"Spire", waterUtil:"Missouri American Water", permitBody:"City of St. Louis Building Division", licenseNote:"Missouri has no statewide contractor license; city registration required", historicNote:"Lafayette Square, Soulard, and Compton Heights are the primary protected historic districts under the Cultural Resources Office", nb:["Central West End","Soulard","Clayton","The Hill","Tower Grove South","Benton Park"], soil:"Missouri River alluvium and Mississippian limestone with windblown loess", trees:"red oak, sweetgum, pin oak", climate:"60 freeze-thaw cycles annually, 42 inches of rain, and severe spring thunderstorms", weatherEvent:"the April 2011 Good Friday EF4 tornado that devastated north county and Lambert Airport", inspNote:"Missouri does not require annual vehicle safety inspections but requires emissions testing in the St. Louis metro", university:"Washington University and Saint Louis University" },
  "orlando-fl": { utilShort:"OUC and Duke Energy Florida", gasUtil:"TECO Peoples Gas", waterUtil:"Orlando Utilities Commission", permitBody:"City of Orlando Permitting Services", licenseNote:"Florida DBPR licenses contractors; verify at myfloridalicense.com", historicNote:"Lake Eola Heights, Colonialtown, and Thornton Park historic districts are under the Orlando Historic Preservation Board", nb:["Winter Park","College Park","Dr. Phillips","Lake Nona","Windermere","Celebration"], soil:"Central Florida sand over Ocala limestone with karst sinkholes and high water table", trees:"live oak, cabbage palm, bald cypress", climate:"zero freeze-thaw cycles, 50 inches of rain concentrated in summer thunderstorms, and direct hurricane exposure", weatherEvent:"Hurricane Ian 2022 and Hurricane Irma 2017 which both affected the Central Florida metro", inspNote:"Florida does not require vehicle safety inspections or emissions testing", university:"University of Central Florida and Rollins College" },
  "san-antonio-tx": { utilShort:"CPS Energy", gasUtil:"CPS Energy (combined utility)", waterUtil:"San Antonio Water System (SAWS)", permitBody:"City of San Antonio Development Services", licenseNote:"Texas has no statewide residential contractor license; TDLR registers mechanical and electrical trades only", historicNote:"King William, Monte Vista, and Dignowity Hill are among 10+ historic districts under the HDRC", nb:["Alamo Heights","Stone Oak","King William","The Pearl","Boerne","Helotes"], soil:"Balcones Fault Zone clay and Edwards limestone with shrink-swell soils", trees:"live oak, pecan, mountain laurel", climate:"5 freeze-thaw cycles, 32 inches of rain, and extreme summer heat exceeding 100F for 30+ days", weatherEvent:"the February 2021 Winter Storm Uri that knocked out power across the entire ERCOT grid for 4-5 days", inspNote:"Texas requires annual safety and emissions inspection at $25.50 combined fee", university:"UTSA, Trinity University, and the Alamo Colleges District" },
  "portland-or": { utilShort:"Portland General Electric (PGE)", gasUtil:"NW Natural", waterUtil:"Portland Water Bureau (Bull Run watershed)", permitBody:"City of Portland Bureau of Development Services", licenseNote:"Oregon CCB license required; verify at ccb.oregon.gov", historicNote:"Irvington, Ladd's Addition, Piedmont, and Lair Hill historic districts are under the Portland Historic Landmarks Commission", nb:["Pearl District","Alberta Arts","Lake Oswego","Sellwood","Laurelhurst","Hawthorne"], soil:"Willamette River alluvium over Columbia River basalt with Portland Hills silt", trees:"Douglas fir, western red cedar, bigleaf maple", climate:"15 freeze-thaw cycles, 43 inches of rain concentrated October-May, and persistent winter moisture", weatherEvent:"the January 2021 ice storm that coated the metro in 1-2 inches of ice and damaged thousands of homes", inspNote:"Oregon requires biennial DEQ emissions testing in the Portland metro area", university:"Portland State University, Reed College, and Lewis & Clark College" },
  "sacramento-ca": { utilShort:"SMUD", gasUtil:"PG&E", waterUtil:"City of Sacramento Department of Utilities", permitBody:"City of Sacramento Community Development", licenseNote:"California requires specific contractor licenses through CSLB; verify at cslb.ca.gov", historicNote:"Alkali Flat, Boulevard Park, and Poverty Ridge are under the Sacramento Preservation Commission", nb:["East Sacramento","Midtown","Elk Grove","Roseville","Folsom","Land Park"], soil:"Sacramento Valley alluvial clay and American River sand with hardpan beneath east-side neighborhoods", trees:"valley oak, coast live oak, Chinese pistache", climate:"12 freeze-thaw cycles, only 18 inches of rain, and Central Valley summer heat exceeding 100F for 60+ days", weatherEvent:"the January 2023 atmospheric river sequence that produced record flooding across the Sacramento Valley", inspNote:"California requires biennial smog checks through the BAR for vehicles over 8 model years", university:"UC Davis, Sacramento State, and McGeorge School of Law" },
  "pittsburgh-pa": { utilShort:"Duquesne Light", gasUtil:"Peoples Gas", waterUtil:"Pittsburgh Water and Sewer Authority", permitBody:"City of Pittsburgh PLI", licenseNote:"Pennsylvania requires HIC registration under Act 132; verify at pago.state.pa.us", historicNote:"Allegheny West, Manchester, Mexican War Streets, and Deutschtown are under the Pittsburgh Historic Review Commission", nb:["Shadyside","Squirrel Hill","Lawrenceville","Mt. Lebanon","Fox Chapel","South Side"], soil:"Allegheny Plateau sandstone and shale with Pittsburgh red beds clay and abandoned mine subsidence risk", trees:"red oak, sugar maple, American beech", climate:"75 freeze-thaw cycles, 38 inches of rain, and heavy winter snow loading from Great Lakes moisture", weatherEvent:"the June 2012 derecho and the August 2019 windstorm that produced widespread damage across Allegheny County", inspNote:"Pennsylvania requires annual safety inspection and biennial emissions testing through PennDOT", university:"University of Pittsburgh and Carnegie Mellon University" },
  "columbus-oh": { utilShort:"AEP Ohio", gasUtil:"Columbia Gas of Ohio", waterUtil:"City of Columbus Division of Water", permitBody:"City of Columbus Building and Zoning Services", licenseNote:"Ohio has no statewide residential contractor license; Columbus requires local registration", historicNote:"German Village, Victorian Village, and Italian Village are under the Columbus Historic Preservation Commission", nb:["German Village","Short North","Upper Arlington","Dublin","Worthington","Clintonville"], soil:"glacial till over Devonian shale and Ohio limestone", trees:"sugar maple, red oak, Ohio buckeye", climate:"80 freeze-thaw cycles, 40 inches of rain, and occasional severe thunderstorms", weatherEvent:"the June 2012 derecho that produced widespread power outages and property damage across Franklin County", inspNote:"Ohio eliminated E-Check emissions testing; no state vehicle inspection requirement exists", university:"The Ohio State University, Capital University, and Otterbein University" },
  "kansas-city-mo": { utilShort:"Evergy", gasUtil:"Spire", waterUtil:"Kansas City Water Services", permitBody:"Kansas City Permits and Inspections", licenseNote:"Missouri has no statewide roofer license; Kansas requires contractor registration through the Attorney General. The metro straddles both states", historicNote:"Country Club Plaza, Pendleton Heights, and Janssen Place are under the KCMO Historic Preservation Commission; Kansas-side municipalities have limited historic protections", nb:["Country Club Plaza","Brookside","Overland Park","Prairie Village","Lee's Summit","Waldo"], soil:"Kansas City Group limestone and Missouri River loess with expansive Pennsylvanian shale", trees:"bur oak, eastern redbud, hackberry", climate:"80 freeze-thaw cycles, 39 inches of rain, and severe spring supercells in the central US hail corridor", weatherEvent:"the May 2024 supercell hail event that produced widespread damage across Johnson County KS and the March 2022 tornado outbreak", inspNote:"Missouri requires emissions testing in the KC metro; Kansas does not require vehicle inspections", university:"UMKC, University of Kansas (Lawrence), and Rockhurst University" },
  "indianapolis-in": { utilShort:"AES Indiana", gasUtil:"CenterPoint Energy Indiana", waterUtil:"Citizens Water of Indianapolis", permitBody:"Indianapolis Department of Business and Neighborhood Services", licenseNote:"Indiana has no statewide residential contractor license but requires Marion County registration", historicNote:"Irvington, Lockerbie Square, Woodruff Place, and Herron-Morton Place are under the Indianapolis Historic Preservation Commission", nb:["Broad Ripple","Meridian-Kessler","Carmel","Fishers","Zionsville","Noblesville"], soil:"Wisconsin-age glacial till and Silurian-Devonian limestone", trees:"tulip poplar, sweetgum, white ash", climate:"85 freeze-thaw cycles, 42 inches of rain, and spring supercell exposure in the tornado corridor", weatherEvent:"the November 2013 EF2 tornado in Washington Township and the April 2023 spring hail event that damaged thousands of homes", inspNote:"Indiana does not require vehicle safety inspections or emissions testing", university:"Indiana University-Purdue University Indianapolis (IUPUI), Butler University, and Marian University" },
  "nashville-tn": { utilShort:"Nashville Electric Service (NES)", gasUtil:"Piedmont Natural Gas", waterUtil:"Nashville Metro Water Services", permitBody:"Metro Nashville Department of Codes Administration", licenseNote:"Tennessee requires a Home Improvement License for projects over $3,000 through the Tennessee Board for Licensing Contractors", historicNote:"East Nashville, Germantown, and Lockeland Springs are under the Metro Nashville Historic Zoning Commission", nb:["East Nashville","12South","Green Hills","Franklin","Brentwood","Mt. Juliet"], soil:"Middle Tennessee Basin limestone and Ordovician phosphatic clay", trees:"eastern red cedar, tulip poplar, hackberry", climate:"40 freeze-thaw cycles, 48 inches of rain, and severe spring thunderstorms in the Nashville Basin", weatherEvent:"the March 2020 EF3 tornado that devastated East Nashville, Germantown, Donelson, and Mt. Juliet", inspNote:"Tennessee requires annual emissions testing in Davidson County for vehicles 3-25 model years old", university:"Vanderbilt University, Belmont University, and Tennessee State University" },
};

const BUILDERS = [
  { file:"build-flagship-concrete.js", dict:"CITY_CONCRETE_DATA", funcBefore:"function main", contentInsert:"costScenarios(city, mult, cd)" },
  { file:"build-flagship-electrical.js", dict:"CITY_ELECTRICAL_DATA", funcBefore:"function main", contentInsert:null },
  { file:"build-flagship-fencing.js", dict:"CITY_FENCING_DATA", funcBefore:"function main", contentInsert:null },
  { file:"build-flagship-foundation.js", dict:"CITY_FOUNDATION_DATA", funcBefore:"function main", contentInsert:null },
  { file:"build-flagship-gutters.js", dict:"CITY_GUTTER_DATA", funcBefore:"function main", contentInsert:null },
  { file:"build-flagship-hvac.js", dict:"metroHVACData", funcBefore:"function main", contentInsert:null },
  { file:"build-flagship-insulation.js", dict:"CITY_INSULATION_DATA", funcBefore:"function main", contentInsert:null },
  { file:"build-flagship-kitchen.js", dict:"CITY_KITCHEN_DATA", funcBefore:"function main", contentInsert:null },
  { file:"build-flagship-landscaping.js", dict:"CITY_LANDSCAPING_DATA", funcBefore:"function main", contentInsert:null },
  { file:"build-flagship-painting.js", dict:"CITY_PAINTING_DATA", funcBefore:"function main", contentInsert:null },
  { file:"build-flagship-plumbing.js", dict:"CITY_PLUMBING_DATA", funcBefore:"function main", contentInsert:null },
  { file:"build-flagship-solar.js", dict:"SOLAR_DATA", funcBefore:"function main", contentInsert:null },
];

// Vertical-specific EXTRA content generators
function generateExtra(vertical, slug) {
  const m = L[slug];
  const name = slug.split("-").slice(0,-1).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  const st = slug.split("-").pop().toUpperCase();

  switch(vertical) {
  case "concrete":
    return {
      localProjectPara: `The most common residential concrete projects in ${name} neighborhoods like ${m.nb[0]} and ${m.nb[1]} include ${m.climate.includes("freeze") && parseInt(m.climate) > 50 ? "driveway replacement driven by deicing-salt scaling, front-walk reconstruction after frost-heave displacement, and walkout-basement patio pours that require drainage engineering for the local " + m.soil.split(" with ")[0] + " subgrade" : m.climate.includes("zero freeze") ? "pool-deck extensions, driveway apron widening for expanded parking, and covered-patio slab pours that must account for the local " + m.soil.split(" with ")[0] + " bearing conditions" : "patio installation, driveway replacement, and foundation-adjacent flatwork that must account for the local " + m.soil.split(" with ")[0] + " soil conditions"}. ${m.permitBody} handles permits with typical turnaround of 5-10 business days. ${m.nb[3]} and ${m.nb[4]} suburban developments often have HOA standards specifying acceptable concrete finishes and colors.`,
      weatherImpactPara: `${name}'s ${m.climate} creates specific concrete challenges. ${m.weatherEvent.charAt(0).toUpperCase() + m.weatherEvent.slice(1)} demonstrated the vulnerability of exposed concrete to extreme weather events. ${m.utilShort} and ${m.gasUtil} coordinate utility locates through 811 before any excavation. The ${m.trees.split(",")[0]} canopy in ${m.nb[0]} and ${m.nb[1]} creates root-heave risk on sidewalks and requires root-barrier specification on new pours within 15 feet of mature trees.`,
      contractorVerifyPara: `${name} concrete contractor verification: ${m.licenseNote}. ${m.utilShort} service coordination for any work near utility lines runs through the 811 call-before-you-dig system. ${m.historicNote}; historic district overlays may restrict driveway width, finish style, or impervious surface coverage. ${m.university} campus-area properties in ${m.nb[1]} and ${m.nb[0]} face additional access and scheduling constraints during the academic year.`,
    };
  case "electrical":
    return {
      localUtilityPara: `${m.utilShort} serves the ${name} metro with residential service coordination for panel upgrades typically running 10-20 business days. ${m.gasUtil} handles gas service where applicable. ${name}'s housing stock across ${m.nb[0]} and ${m.nb[1]} spans construction eras from pre-war to modern, with corresponding electrical infrastructure ranging from 60-amp fuse panels to modern 200-amp breaker service. ${m.weatherEvent.charAt(0).toUpperCase() + m.weatherEvent.slice(1)} highlighted the importance of whole-house generator systems, which have become a standard residential electrical scope in ${name}.`,
      panelAndCodePara: `${m.permitBody} handles electrical permits. ${m.licenseNote}. ${name} homes in ${m.nb[0]} and ${m.nb[2]} show distinct housing-era electrical profiles: pre-1965 construction may have aluminum branch wiring or Federal Pacific Stab-Lok panels (documented fire hazards), while post-2000 construction typically has 200-amp service with AFCI protection on bedroom circuits. EV charger installation is the fastest-growing residential electrical scope in ${name}, with Level 2 (240V, 40-amp) installations running $1,400-$3,500 depending on panel capacity and circuit length.`,
      safetyAndLicensePara: `${m.historicNote}; visible exterior electrical work on contributing structures may require preservation commission review. ${m.inspNote}. Federal Pacific Stab-Lok panels and Zinsco panels are documented fire hazards found in 1960s-1970s ${name} homes; replacement with modern Siemens, Square D, or Eaton panels is a safety-critical upgrade. ${m.university} area properties in ${m.nb[0]} may have rental-grade electrical systems that need upgrading for owner-occupancy.`,
    };
  case "fencing":
    return {
      localMaterialPara: `${name}'s dominant residential fencing reflects the ${m.climate.includes("freeze") && parseInt(m.climate) > 50 ? "cold-climate requirement for deep post footings (42-48 inches) and freeze-resistant materials" : m.soil.includes("clay") || m.soil.includes("expan") ? "expansive soil conditions that require 36-inch post depth with concrete footings" : "local climate and soil conditions that allow standard 24-30 inch post depth"}. ${m.nb[0]} and ${m.nb[1]} neighborhoods show distinct fencing styles tied to housing era and HOA requirements. ${m.permitBody} handles fence permits for non-standard height installations. ${m.trees.split(",")[0]} and ${m.trees.split(",")[1]} root systems in established ${name} neighborhoods require careful post placement to avoid root damage.`,
      hoaAndWildlifePara: `${name} master-planned communities in ${m.nb[3]} and ${m.nb[4]} have strict HOA architectural review for fencing. ${m.historicNote}; fencing in these districts may face additional review. ${m.soil} creates ${m.soil.includes("limestone") || m.soil.includes("shale") ? "rocky excavation conditions that add $100-$400 per difficult post hole" : m.soil.includes("clay") ? "expansive soil conditions that require deeper footings and expansion material around posts" : "standard excavation conditions for most post installations"}. Wildlife pressure in outer ${name} suburbs includes deer, which may require 8-foot exclusion fencing in ${m.nb[4]} and ${m.nb[5]} properties.`,
      seasonAndCostPara: `${m.climate.includes("freeze") && parseInt(m.climate) > 50 ? "The productive " + name + " fencing season runs mid-May through early November. Frozen ground limits winter post-hole digging and adds $100-$300 per post for pneumatic breaking." : name + " fencing installation runs year-round with the most comfortable conditions in " + (st === "FL" ? "the November-May dry season" : "October through May") + "."} ${m.licenseNote}. Labor rates in ${name} run ${m.climate.includes("75 freeze") || m.climate.includes("85 freeze") ? "at the Midwest average" : st === "FL" || st === "TX" ? "at or slightly below the national average" : st === "CA" || st === "OR" || st === "PA" ? "above the national average" : "at the national average"} for fencing installation.`,
    };
  case "foundation":
    return {
      localGeologyPara: `${name} sits on ${m.soil}. ${m.soil.includes("clay") || m.soil.includes("expan") || m.soil.includes("shale") ? "The shrink-swell cycle in " + name + "'s clay soils drives 2-4 inches of seasonal vertical movement that is the primary cause of residential foundation distress across the metro." : m.soil.includes("karst") || m.soil.includes("sinkhole") ? "The karst geology creates sinkhole and void risk that affects foundation stability." : m.soil.includes("alluvium") || m.soil.includes("glacial") ? "The glacial/alluvial subgrade provides generally stable bearing but varies across neighborhoods." : "Variable bearing conditions drive site-specific foundation engineering."} ${m.nb[0]} and ${m.nb[1]} homes show distinct foundation performance tied to their construction era and underlying geology. ${m.weatherEvent.charAt(0).toUpperCase() + m.weatherEvent.slice(1)} demonstrated the vulnerability of ${name} foundations to extreme conditions.`,
      repairMethodPara: `${m.soil.includes("clay") || m.soil.includes("expan") ? "Pressed steel piers and helical piers are the dominant repair methods in " + name + " for expansive soil conditions. Bell-bottom piers drilled to stable bearing below the active zone offer the most permanent solution." : m.climate.includes("freeze") && parseInt(m.climate) > 50 ? "Wall bracing with carbon-fiber straps or steel I-beams addresses lateral frost-pressure bowing in " + name + " basements. Helical piers stabilize settling footings driven by freeze-thaw cycling." : "Helical piers, push piers, and polyurethane foam injection are the standard " + name + " repair methods."} ${m.permitBody} handles permits for foundation work. A licensed Professional Engineer must seal underpinning drawings for any structural work. ${m.historicNote}; foundation work on historic-district properties may trigger preservation review if it affects the building exterior.`,
      drainageAndMoisturePara: `${name} receives ${m.climate.match(/(\d+) inches of rain/)?.[1] || "moderate"} inches of annual precipitation. ${m.climate.includes("50 inches") || m.climate.includes("48 inches") || m.climate.includes("43 inches") ? "Heavy rainfall drives aggressive drainage requirements: French drains, sump pumps, and proper downspout routing are essential components of foundation health in " + name + "." : m.climate.includes("18 inches") ? name + " receives limited rainfall, but improper irrigation around foundations drives the drying-wetting cycle that causes expansive soil movement." : "Proper grading, downspout extensions, and French drain systems protect " + name + " foundations from moisture intrusion."} ${m.waterUtil} serves the metro; water-line leaks near foundations are a hidden damage source that should be investigated during any foundation assessment.`,
    };
  case "gutters":
    return {
      localRainfallPara: `${name}'s ${m.climate} creates specific gutter sizing requirements. ${m.climate.includes("50 inches") || m.climate.includes("48 inches") || m.climate.includes("43 inches") || m.climate.includes("42 inches") ? name + "'s heavy annual rainfall demands properly sized 6-inch K-style gutters with 3x4 downspouts to handle intense storm events." : m.climate.includes("18 inches") ? name + " receives only 18 inches of rain annually, concentrated in winter atmospheric-river events that can deliver 1-3 inches in 24 hours despite long dry periods." : name + "'s moderate rainfall of " + (m.climate.match(/(\d+) inches of rain/)?.[1] || "40") + " inches requires standard 6-inch K-style gutters with proper downspout routing."} ${m.nb[0]} and ${m.nb[1]} properties with mature ${m.trees.split(",")[0]} canopy face heavy debris loads that justify gutter guards at $5-$12 per linear foot.`,
      freezeAndMaintenancePara: `${m.climate.includes("freeze") && parseInt(m.climate) > 40 ? name + " experiences " + m.climate.match(/(\d+) freeze-thaw/)?.[1] + " freeze-thaw cycles annually, driving ice-dam risk at eave-gutter transitions. Heated gutter cables run $500-$1,200 and are a practical investment for persistent ice-dam homes in " + m.nb[0] + " and " + m.nb[1] + "." : m.climate.includes("zero freeze") ? "Freeze risk is essentially zero in " + name + ". Heated gutter systems are unnecessary. The primary maintenance concern is debris from " + m.trees.split(",")[0] + " and " + m.trees.split(",")[1] + " that clogs unprotected gutters." : name + " gets occasional freezing that can cause ice-dam issues in severe winters. " + m.trees.split(",")[0] + " debris is the primary ongoing maintenance concern."} ${m.weatherEvent.charAt(0).toUpperCase() + m.weatherEvent.slice(1)} demonstrated the importance of properly functioning gutter systems during extreme events.`,
      buyingGuidePara: `${m.permitBody} handles gutter permits when required (typically only for structural fascia modifications). ${m.licenseNote}. Scheduling ${name} gutter installation during off-peak months saves 10-15% on labor. ${m.nb[3]} and ${m.nb[4]} newer subdivisions often include gutter-to-underground-drain connections per HOA and subdivision standards. Copper gutters appear on ${m.historicNote.includes("Lafayette") ? "Lafayette Square" : m.historicNote.includes("Allegheny") ? "Allegheny West" : m.historicNote.includes("German Village") ? "German Village" : m.historicNote.includes("King William") ? "King William" : m.nb[0]} historic properties.`,
    };
  default:
    // For hvac, insulation, kitchen, landscaping, painting, plumbing, solar
    return generateGenericExtra(vertical, slug, name, st, m);
  }
}

function generateGenericExtra(vertical, slug, name, st, m) {
  const vName = vertical.replace(/-/g," ");
  return {
    localMarketPara: `The ${name} ${vName} market serves a metro of ${m.nb.length > 4 ? m.nb.slice(0,4).join(", ") + ", and surrounding communities" : m.nb.join(" and ")}. ${m.utilShort} coordinates service for ${vertical === "hvac" || vertical === "insulation" ? "equipment installations and energy-efficiency programs" : vertical === "solar" ? "net-metering interconnection" : vertical === "plumbing" ? "water and sewer service" : "residential projects"} across the metro. ${m.licenseNote}. ${name}'s ${m.climate} drives ${vertical === "hvac" ? "both heating and cooling demand" : vertical === "insulation" ? "aggressive insulation requirements" : vertical === "solar" ? "solar production patterns" : vertical === "plumbing" ? "specific pipe material and freeze-protection requirements" : vertical === "painting" ? "paint selection and application timing" : vertical === "kitchen-remodel" ? "kitchen design preferences" : vertical === "landscaping" ? "plant selection and irrigation requirements" : "material and scheduling decisions"}.`,
    localDetailPara: `${m.nb[0]} and ${m.nb[1]} neighborhoods in ${name} show distinct ${vName} patterns tied to their housing era. ${m.historicNote}; ${vertical === "painting" ? "exterior paint colors" : vertical === "kitchen-remodel" ? "kitchen modifications" : vertical === "landscaping" ? "landscape changes" : vertical === "hvac" || vertical === "insulation" ? "visible exterior equipment" : "visible exterior work"} on contributing structures may require preservation review. ${m.weatherEvent.charAt(0).toUpperCase() + m.weatherEvent.slice(1)} highlighted specific ${vName} vulnerabilities in the ${name} market. ${m.university} campus-area properties face additional scheduling and access considerations.`,
    seasonAndContractorPara: `${m.climate.includes("freeze") && parseInt(m.climate) > 50 ? name + "'s productive " + vName + " season compresses into the April-November window, concentrating demand and pushing lead times to 6-12 weeks during peak months." : name + "'s " + vName + " work runs year-round with peak demand in " + (st === "FL" ? "October through March" : "spring and early summer") + "."} ${m.permitBody} handles permits with typical 5-10 day turnaround. ${m.gasUtil} coordinates gas service for ${vertical === "hvac" ? "furnace installations" : vertical === "plumbing" ? "water heater installations" : "applicable work"}. Off-peak scheduling in ${name} saves 10-15% on labor-intensive ${vName} projects.`,
  };
}

// ---- MAIN ----
function run() {
  let patched = 0;
  for (const builder of BUILDERS) {
    const filePath = path.join(ROOT, "scripts", builder.file);
    let src = fs.readFileSync(filePath, "utf8");

    // Skip if already patched
    const extraDictName = builder.dict.replace("DATA","EXTRA").replace("metroHVACData","metroHVACExtra").replace("SOLAR_DATA","SOLAR_EXTRA");
    if (src.includes(extraDictName + " =")) {
      console.log(`  SKIP ${builder.file} (${extraDictName} already exists)`);
      continue;
    }

    const vertical = builder.file.replace("build-flagship-","").replace(".js","");

    // 1. Generate EXTRA dict content
    let extraDict = `\nconst ${extraDictName} = {\n`;
    for (const slug of METROS) {
      // Skip St. Louis for builders where no pages exist
      const suffix = builder.file.replace("build-flagship-","").replace(".js","");
      const pageFile = path.join(ROOT, `${slug}-${suffix === "gutters" ? "gutter" : suffix === "fencing" ? "fence" : suffix === "kitchen" ? "kitchen-remodel" : suffix === "windows" ? "window" : suffix}-cost.html`);
      // Check METROS array
      if (!src.includes(`"${slug}"`)) continue;

      const extra = generateExtra(vertical, slug);
      extraDict += `  "${slug}": {\n`;
      for (const [key, val] of Object.entries(extra)) {
        extraDict += `    ${key}: \`${val.replace(/`/g,"\\`")}\`,\n`;
      }
      extraDict += `  },\n`;
    }
    extraDict += `};\n`;

    // 2. Add merge code
    const mergeCode = `\n// Merge extra content into primary dict\nfor (const [slug, extra] of Object.entries(${extraDictName})) {\n  ${builder.dict}[slug] = Object.assign(${builder.dict}[slug] || {}, extra);\n}\n`;

    // 3. Find insertion point: before the first function definition after the dict
    // Look for "function " after the closing of the primary dict
    const dictStart = src.indexOf(builder.dict + " = {");
    // Find closing }; of the dict
    let depth = 0, i = dictStart, found = false;
    while (i < src.length) {
      if (src[i] === "{") { depth++; found = true; }
      if (src[i] === "}") { depth--; if (found && depth === 0) break; }
      i++;
    }
    // Skip past the };
    let afterDict = src.indexOf("\n", i) + 1;
    // Skip blank lines
    while (afterDict < src.length && src[afterDict] === "\n") afterDict++;

    // Insert EXTRA dict + merge code
    src = src.substring(0, afterDict) + extraDict + mergeCode + "\n" + src.substring(afterDict);

    // 4. Add extraSection function and call it in buildFlagshipContent
    const extraFuncCode = `\nfunction extraLocalSection(city, d) {\n  let html = "";\n  if (d.localMarketPara) html += \`<section class="section fp-section"><h2>\${city} local market overview</h2><p>\${d.localMarketPara}</p></section>\`;\n  if (d.localDetailPara) html += \`<section class="section fp-section"><h2>\${city} neighborhood details</h2><p>\${d.localDetailPara}</p></section>\`;\n  if (d.seasonAndContractorPara) html += \`<section class="section fp-section"><h2>\${city} seasonal pricing and contractors</h2><p>\${d.seasonAndContractorPara}</p></section>\`;\n  if (d.localProjectPara) html += \`<section class="section fp-section"><h2>\${city} common projects</h2><p>\${d.localProjectPara}</p></section>\`;\n  if (d.weatherImpactPara) html += \`<section class="section fp-section"><h2>\${city} weather considerations</h2><p>\${d.weatherImpactPara}</p></section>\`;\n  if (d.contractorVerifyPara) html += \`<section class="section fp-section"><h2>Verifying \${city} contractors</h2><p>\${d.contractorVerifyPara}</p></section>\`;\n  if (d.localUtilityPara) html += \`<section class="section fp-section"><h2>\${city} utility coordination</h2><p>\${d.localUtilityPara}</p></section>\`;\n  if (d.panelAndCodePara) html += \`<section class="section fp-section"><h2>\${city} panel upgrades and codes</h2><p>\${d.panelAndCodePara}</p></section>\`;\n  if (d.safetyAndLicensePara) html += \`<section class="section fp-section"><h2>\${city} safety concerns</h2><p>\${d.safetyAndLicensePara}</p></section>\`;\n  if (d.localMaterialPara) html += \`<section class="section fp-section"><h2>\${city} material preferences</h2><p>\${d.localMaterialPara}</p></section>\`;\n  if (d.hoaAndWildlifePara) html += \`<section class="section fp-section"><h2>\${city} HOA and wildlife considerations</h2><p>\${d.hoaAndWildlifePara}</p></section>\`;\n  if (d.seasonAndCostPara) html += \`<section class="section fp-section"><h2>\${city} seasonal costs</h2><p>\${d.seasonAndCostPara}</p></section>\`;\n  if (d.localGeologyPara) html += \`<section class="section fp-section"><h2>\${city} soil and geology</h2><p>\${d.localGeologyPara}</p></section>\`;\n  if (d.repairMethodPara) html += \`<section class="section fp-section"><h2>\${city} repair approaches</h2><p>\${d.repairMethodPara}</p></section>\`;\n  if (d.drainageAndMoisturePara) html += \`<section class="section fp-section"><h2>\${city} drainage management</h2><p>\${d.drainageAndMoisturePara}</p></section>\`;\n  if (d.localRainfallPara) html += \`<section class="section fp-section"><h2>\${city} rainfall and sizing</h2><p>\${d.localRainfallPara}</p></section>\`;\n  if (d.freezeAndMaintenancePara) html += \`<section class="section fp-section"><h2>\${city} freeze protection</h2><p>\${d.freezeAndMaintenancePara}</p></section>\`;\n  if (d.buyingGuidePara) html += \`<section class="section fp-section"><h2>\${city} buying guide</h2><p>\${d.buyingGuidePara}</p></section>\`;\n  return html;\n}\n`;

    // Find the "function main" or equivalent
    const mainIdx = src.indexOf(builder.funcBefore);
    if (mainIdx > 0) {
      src = src.substring(0, mainIdx) + extraFuncCode + "\n" + src.substring(mainIdx);
    }

    // Insert extraLocalSection call before MARKER_END in the build function
    // Find the data variable name used in the build function
    const buildFunc = src.match(/function buildFlagshipContent\(metro\)[\s\S]*?MARKER_END/);
    if (buildFunc) {
      // Find the variable name for the dict data (cd, d, data, etc.)
      const dataVar = src.match(/const\s+(cd|d|data|entry|hd|gd|sd|wd|fd|pd|kd|ld|md|id)\s*=\s*(?:CITY_|metro|SOLAR)/);
      const varName = dataVar ? dataVar[1] : "cd";
      const markerEndLine = src.indexOf("MARKER_END", src.indexOf("function buildFlagshipContent"));
      // Find the line before MARKER_END
      const lineBeforeMarker = src.lastIndexOf("\n", markerEndLine);
      const insertCall = `  html += extraLocalSection(city, ${varName});\n`;
      src = src.substring(0, lineBeforeMarker + 1) + insertCall + src.substring(lineBeforeMarker + 1);
    }

    fs.writeFileSync(filePath, src, "utf8");
    console.log(`  PATCHED ${builder.file} (+${extraDictName})`);
    patched++;
  }
  console.log(`\nDone: ${patched} builders patched with EXTRA dicts.`);
}

run();
