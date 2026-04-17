#!/usr/bin/env node
/**
 * Expands all 16 flagship builders from 20 metros to 40 metros.
 * Adds 20 new metro entries + per-metro data dict entries to each builder.
 *
 * Usage: node scripts/expand-flagship-metros.js
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

// The 20 new metros to add
const NEW_METROS = [
  { slug: "san-antonio-tx", ctxKey: "San Antonio|TX", region: "south", state: "TX" },
  { slug: "jacksonville-fl", ctxKey: "Jacksonville|FL", region: "southeast", state: "FL" },
  { slug: "fort-worth-tx", ctxKey: "Fort Worth|TX", region: "south", state: "TX" },
  { slug: "columbus-oh", ctxKey: "Columbus|OH", region: "midwest", state: "OH" },
  { slug: "indianapolis-in", ctxKey: "Indianapolis|IN", region: "midwest", state: "IN" },
  { slug: "nashville-tn", ctxKey: "Nashville|TN", region: "southeast", state: "TN" },
  { slug: "portland-or", ctxKey: "Portland|OR", region: "west", state: "OR" },
  { slug: "memphis-tn", ctxKey: "Memphis|TN", region: "southeast", state: "TN" },
  { slug: "louisville-ky", ctxKey: "Louisville|KY", region: "southeast", state: "KY" },
  { slug: "baltimore-md", ctxKey: "Baltimore|MD", region: "northeast", state: "MD" },
  { slug: "milwaukee-wi", ctxKey: "Milwaukee|WI", region: "midwest", state: "WI" },
  { slug: "albuquerque-nm", ctxKey: "Albuquerque|NM", region: "mountain", state: "NM" },
  { slug: "tucson-az", ctxKey: "Tucson|AZ", region: "mountain", state: "AZ" },
  { slug: "sacramento-ca", ctxKey: "Sacramento|CA", region: "west", state: "CA" },
  { slug: "raleigh-nc", ctxKey: "Raleigh|NC", region: "southeast", state: "NC" },
  { slug: "kansas-city-mo", ctxKey: "Kansas City|MO", region: "midwest", state: "MO" },
  { slug: "orlando-fl", ctxKey: "Orlando|FL", region: "southeast", state: "FL" },
  { slug: "pittsburgh-pa", ctxKey: "Pittsburgh|PA", region: "northeast", state: "PA" },
  { slug: "cincinnati-oh", ctxKey: "Cincinnati|OH", region: "midwest", state: "OH" },
  { slug: "colorado-springs-co", ctxKey: "Colorado Springs|CO", region: "mountain", state: "CO" },
];

// Builder configurations
const BUILDERS = [
  {
    file: "scripts/build-flagship-concrete.js",
    dictName: "CITY_CONCRETE_DATA",
    fileSuffix: "concrete-cost.html",
    metroHasRegion: true,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-electrical.js",
    dictName: "CITY_ELECTRICAL_DATA",
    fileSuffix: "electrical-cost.html",
    metroHasRegion: true,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-fencing.js",
    dictName: "CITY_FENCING_DATA",
    fileSuffix: "fence-cost.html",
    metroHasRegion: true,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-foundation.js",
    dictName: "CITY_FOUNDATION_DATA",
    fileSuffix: "foundation-cost.html",
    metroHasRegion: true,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-garage-door.js",
    dictName: "CITY_GARAGE_DATA",
    fileSuffix: "garage-door-cost.html",
    metroHasRegion: false,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-gutters.js",
    dictName: "CITY_GUTTER_DATA",
    fileSuffix: "gutter-cost.html",
    metroHasRegion: false,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-hvac.js",
    dictName: "metroHVACData",
    fileSuffix: "hvac-cost.html",
    metroHasRegion: false,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-insulation.js",
    dictName: "CITY_INSULATION_DATA",
    fileSuffix: "insulation-cost.html",
    metroHasRegion: true,
    metroExtraFields: "insulation",
  },
  {
    file: "scripts/build-flagship-kitchen.js",
    dictName: "CITY_KITCHEN_DATA",
    fileSuffix: "kitchen-remodel-cost.html",
    metroHasRegion: true,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-landscaping.js",
    dictName: "CITY_LANDSCAPING_DATA",
    fileSuffix: "landscaping-cost.html",
    metroHasRegion: true,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-painting.js",
    dictName: "CITY_PAINTING_DATA",
    fileSuffix: "painting-cost.html",
    metroHasRegion: true,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-plumbing.js",
    dictName: "CITY_PLUMBING_DATA",
    fileSuffix: "plumbing-cost.html",
    metroHasRegion: true,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-roofing.js",
    dictName: "CITY_ROOF_DATA",
    fileSuffix: "roof-cost.html",
    metroHasRegion: false,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-siding.js",
    dictName: "CITY_SIDING_DATA",
    fileSuffix: "siding-cost.html",
    metroHasRegion: true,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-solar.js",
    dictName: "SOLAR_DATA",
    fileSuffix: "solar-cost.html",
    metroHasRegion: true,
    metroExtraFields: null,
  },
  {
    file: "scripts/build-flagship-windows.js",
    dictName: "CITY_WINDOW_DATA",
    fileSuffix: "window-cost.html",
    metroHasRegion: false,
    metroExtraFields: null,
  },
];

// Insulation extra fields for each new metro
const INSULATION_EXTRAS = {
  "san-antonio-tx": { ieccZone: "2A", doeAttic: "R-30 to R-60", doeWall: "R-13", codeAttic: "R-38", codeWall: "R-13" },
  "jacksonville-fl": { ieccZone: "2A", doeAttic: "R-30 to R-60", doeWall: "R-13", codeAttic: "R-38", codeWall: "R-13" },
  "fort-worth-tx": { ieccZone: "3A", doeAttic: "R-30 to R-60", doeWall: "R-13 to R-15", codeAttic: "R-38", codeWall: "R-13" },
  "columbus-oh": { ieccZone: "5A", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "indianapolis-in": { ieccZone: "5A", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "nashville-tn": { ieccZone: "4A", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "portland-or": { ieccZone: "4C", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "memphis-tn": { ieccZone: "3A", doeAttic: "R-30 to R-60", doeWall: "R-13 to R-15", codeAttic: "R-38", codeWall: "R-13" },
  "louisville-ky": { ieccZone: "4A", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "baltimore-md": { ieccZone: "4A", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "milwaukee-wi": { ieccZone: "6A", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "albuquerque-nm": { ieccZone: "4B", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "tucson-az": { ieccZone: "2B", doeAttic: "R-30 to R-60", doeWall: "R-13", codeAttic: "R-38", codeWall: "R-13" },
  "sacramento-ca": { ieccZone: "3B", doeAttic: "R-30 to R-60", doeWall: "R-13 to R-15", codeAttic: "R-30", codeWall: "R-13" },
  "raleigh-nc": { ieccZone: "4A", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "kansas-city-mo": { ieccZone: "4A", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "orlando-fl": { ieccZone: "2A", doeAttic: "R-30 to R-60", doeWall: "R-13", codeAttic: "R-38", codeWall: "R-13" },
  "pittsburgh-pa": { ieccZone: "5A", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "cincinnati-oh": { ieccZone: "4A", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
  "colorado-springs-co": { ieccZone: "5B", doeAttic: "R-49 to R-60", doeWall: "R-13 to R-21", codeAttic: "R-49", codeWall: "R-13+5ci" },
};

function buildMetroEntry(metro, builder) {
  const parts = [`    { slug: "${metro.slug}", ctxKey: "${metro.ctxKey}", file: "${metro.slug}-${builder.fileSuffix}"`];
  if (builder.metroHasRegion) {
    parts.push(`, region: "${metro.region}"`);
  }
  if (builder.metroExtraFields === "insulation") {
    const ex = INSULATION_EXTRAS[metro.slug];
    parts.push(`, ieccZone: "${ex.ieccZone}", doeAttic: "${ex.doeAttic}", doeWall: "${ex.doeWall}", codeAttic: "${ex.codeAttic}", codeWall: "${ex.codeWall}"`);
  }
  parts.push(` }`);
  return parts.join("");
}

function extractDictKeys(src, dictName) {
  // Find the first entry in the dict
  const dictIdx = src.indexOf(dictName + " = {");
  if (dictIdx < 0) return [];

  // Find first "slug": { pattern
  const firstEntryRe = /"[a-z]+-[a-z]+-[a-z]+"\s*:\s*\{/;
  const match = firstEntryRe.exec(src.substring(dictIdx));
  if (!match) return [];

  const entryStart = dictIdx + match.index + match[0].length - 1;

  // Find the closing brace of this first entry
  let depth = 0, pos = entryStart;
  while (pos < src.length) {
    if (src[pos] === '{') depth++;
    if (src[pos] === '}') { depth--; if (depth === 0) break; }
    pos++;
  }

  const entryStr = src.substring(entryStart, pos + 1);

  // Extract top-level keys (at brace depth 1)
  const keys = [];
  let bd = 0;
  for (let i = 0; i < entryStr.length; i++) {
    if (entryStr[i] === '{') bd++;
    if (entryStr[i] === '}') bd--;
    if (bd === 1 && entryStr[i] === ':') {
      // Look back for the key name
      let j = i - 1;
      while (j >= 0 && /\s/.test(entryStr[j])) j--;
      // Key might be quoted or unquoted
      let end = j + 1;
      if (entryStr[j] === '"' || entryStr[j] === "'") {
        const quote = entryStr[j];
        j--;
        while (j >= 0 && entryStr[j] !== quote) j--;
        const key = entryStr.substring(j + 1, end - 1);
        if (key.length > 2 && !/^[a-z]+-[a-z]/.test(key)) keys.push(key);
      } else {
        while (j >= 0 && /[a-zA-Z0-9_]/.test(entryStr[j])) j--;
        const key = entryStr.substring(j + 1, end);
        if (key.length > 2) keys.push(key);
      }
    }
  }
  return [...new Set(keys)];
}

// Process each builder (runs after all data/functions defined below)
function runExpansion() {
let totalPatched = 0;
for (const builder of BUILDERS) {
  const filePath = path.join(ROOT, builder.file);
  let src = fs.readFileSync(filePath, "utf8");

  // Check if already expanded
  if (src.includes('"san-antonio-tx"')) {
    console.log(`  SKIP ${builder.file} (already expanded)`);
    continue;
  }

  // 1. Add new METROS entries
  // Find the closing of the METROS array
  const metrosEnd = src.indexOf("];", src.indexOf("const METROS"));
  if (metrosEnd < 0) {
    console.log(`  ERROR ${builder.file}: cannot find METROS array end`);
    continue;
  }

  const newMetroLines = NEW_METROS.map(m => buildMetroEntry(m, builder) + ",").join("\n");

  // Insert before the ];
  // Find the last entry line before ];
  const beforeEnd = src.lastIndexOf(",", metrosEnd);
  const insertPoint = src.indexOf("\n", beforeEnd) + 1;

  src = src.substring(0, insertPoint) + newMetroLines + "\n" + src.substring(insertPoint);

  // 2. Add new data dict entries
  const keys = extractDictKeys(src, builder.dictName);
  if (keys.length === 0) {
    console.log(`  ERROR ${builder.file}: cannot extract dict keys`);
    continue;
  }

  // Find the closing of the data dict
  // We need to find the last entry's closing brace before the dict's closing
  const dictStart = src.indexOf(builder.dictName + " = {");
  // Find the dict's closing }; by counting braces
  let depth = 0, dictEnd = dictStart;
  let foundOpen = false;
  while (dictEnd < src.length) {
    if (src[dictEnd] === '{') { depth++; foundOpen = true; }
    if (src[dictEnd] === '}') {
      depth--;
      if (foundOpen && depth === 0) break;
    }
    dictEnd++;
  }

  // dictEnd is at the closing } of the dict
  // We need to insert before this closing }
  // Find the position just before the closing }
  let insertDictPoint = dictEnd;
  // Go back to find the last } of the last entry
  // We'll insert just before the dict's closing }

  // Generate data for all 20 new metros
  const dataEntries = generateAllData(builder, keys);

  src = src.substring(0, insertDictPoint) + dataEntries + "\n" + src.substring(insertDictPoint);

  // 3. Update the docstring comment from "20" to "40"
  src = src.replace(/for 20 flagship metro/g, "for 40 flagship metro");
  src = src.replace(/for 10 flagship metro/g, "for 40 flagship metro");

  fs.writeFileSync(filePath, src, "utf8");
  console.log(`  PATCHED ${builder.file} (+20 metros, ${keys.length} fields each)`);
  totalPatched++;
}

console.log(`\nDone: ${totalPatched} builders patched.`);
} // end runExpansion

// =========================================================================
// DATA GENERATION
// =========================================================================

function generateAllData(builder, keys) {
  const entries = [];
  for (const metro of NEW_METROS) {
    const data = generateMetroData(builder, metro, keys);
    entries.push(data);
  }
  return entries.join("\n");
}

function generateMetroData(builder, metro, keys) {
  const slug = metro.slug;
  const name = metro.ctxKey.split("|")[0];
  const state = metro.state;

  // Dispatch to the right generator
  switch (builder.dictName) {
    case "CITY_CONCRETE_DATA": return generateConcreteData(slug, name, state, metro);
    case "CITY_ELECTRICAL_DATA": return generateElectricalData(slug, name, state, metro);
    case "CITY_FENCING_DATA": return generateFencingData(slug, name, state, metro);
    case "CITY_FOUNDATION_DATA": return generateFoundationData(slug, name, state, metro);
    case "CITY_GARAGE_DATA": return generateGarageData(slug, name, state, metro);
    case "CITY_GUTTER_DATA": return generateGutterData(slug, name, state, metro);
    case "metroHVACData": return generateHVACData(slug, name, state, metro);
    case "CITY_INSULATION_DATA": return generateInsulationData(slug, name, state, metro);
    case "CITY_KITCHEN_DATA": return generateKitchenData(slug, name, state, metro);
    case "CITY_LANDSCAPING_DATA": return generateLandscapingData(slug, name, state, metro);
    case "CITY_PAINTING_DATA": return generatePaintingData(slug, name, state, metro);
    case "CITY_PLUMBING_DATA": return generatePlumbingData(slug, name, state, metro);
    case "CITY_ROOF_DATA": return generateRoofData(slug, name, state, metro);
    case "CITY_SIDING_DATA": return generateSidingData(slug, name, state, metro);
    case "SOLAR_DATA": return generateSolarData(slug, name, state, metro);
    case "CITY_WINDOW_DATA": return generateWindowData(slug, name, state, metro);
    default: return "";
  }
}

// ---- METRO DATA MAPS ----
const M = {
  "san-antonio-tx": { soil: "Balcones Fault Zone clay and Edwards limestone", frost: 5, rain: 32, utility: "CPS Energy", permit: "City of San Antonio Development Services", neighborhoods: ["Alamo Heights", "Stone Oak", "King William"], readyMix: "Alamo Concrete, Capitol Aggregates, and Martin Marietta", trees: "live oak, pecan, mountain laurel", waterUtil: "San Antonio Water System (SAWS)", hardness: "200-300 ppm (hard to very hard)" },
  "jacksonville-fl": { soil: "sandy coastal soils over Ocala limestone with marsh peat near the St. Johns River", frost: 0, rain: 52, utility: "JEA (Jacksonville Electric Authority)", permit: "City of Jacksonville Building Inspection Division", neighborhoods: ["Riverside", "San Marco", "Ponte Vedra Beach"], readyMix: "Rinker Materials, CEMEX Jacksonville, and Argos USA", trees: "live oak, bald cypress, southern magnolia", waterUtil: "JEA Water", hardness: "150-250 ppm (moderately hard)" },
  "fort-worth-tx": { soil: "Eagle Ford shale and Goodland limestone with expansive Benbrook clay", frost: 12, rain: 34, utility: "Oncor Electric Delivery", permit: "City of Fort Worth Development Services", neighborhoods: ["Southlake", "Westover Hills", "Fairmount"], readyMix: "Trinity Industries Ready-Mix, Martin Marietta, and TXI", trees: "post oak, cedar elm, Texas ash", waterUtil: "Fort Worth Water Department", hardness: "120-180 ppm (moderately hard)" },
  "columbus-oh": { soil: "glacial till over Devonian shale and Ohio limestone", frost: 80, rain: 40, utility: "AEP Ohio (American Electric Power)", permit: "City of Columbus Department of Building and Zoning Services", neighborhoods: ["German Village", "Short North", "Upper Arlington"], readyMix: "Shelly Company, Irving Materials, and Central Ohio Ready Mix", trees: "sugar maple, red oak, Ohio buckeye", waterUtil: "City of Columbus Division of Water", hardness: "150-200 ppm (hard)" },
  "indianapolis-in": { soil: "Wisconsin-age glacial till and Silurian-Devonian limestone", frost: 85, rain: 42, utility: "AES Indiana (formerly Indianapolis Power & Light)", permit: "City of Indianapolis Department of Business and Neighborhood Services", neighborhoods: ["Broad Ripple", "Meridian-Kessler", "Carmel"], readyMix: "Irving Materials, Milestone Contractors, and Prairie Supply", trees: "tulip poplar, sweetgum, white ash", waterUtil: "Citizens Water of Indianapolis", hardness: "250-350 ppm (very hard)" },
  "nashville-tn": { soil: "Middle Tennessee Basin limestone and Ordovician phosphatic clay", frost: 40, rain: 48, utility: "Nashville Electric Service (NES)", permit: "Metropolitan Nashville Department of Codes Administration", neighborhoods: ["East Nashville", "12South", "Green Hills"], readyMix: "Buzzi Unicem, Rogers Group, and Volunteer Ready Mix", trees: "eastern red cedar, tulip poplar, hackberry", waterUtil: "Nashville Metro Water Services", hardness: "100-160 ppm (moderately hard)" },
  "portland-or": { soil: "Willamette River alluvium over Columbia River basalt with Portland Hills silt", frost: 15, rain: 43, utility: "Portland General Electric (PGE)", permit: "City of Portland Bureau of Development Services", neighborhoods: ["Pearl District", "Alberta Arts", "Lake Oswego"], readyMix: "Knife River, CalPortland, and Cadman", trees: "Douglas fir, western red cedar, bigleaf maple", waterUtil: "Portland Water Bureau (Bull Run watershed)", hardness: "10-25 ppm (very soft)" },
  "memphis-tn": { soil: "Mississippi River alluvium and loess (windblown silt) over Cretaceous clay", frost: 30, rain: 54, utility: "Memphis Light, Gas and Water (MLGW)", permit: "City of Memphis Division of Planning and Development", neighborhoods: ["Midtown", "Cooper-Young", "Germantown"], readyMix: "Memphis Ready Mix, Lehigh Hanson, and Buzzi Unicem", trees: "water oak, sweetgum, bald cypress", waterUtil: "MLGW (Memphis Sand Aquifer)", hardness: "40-80 ppm (soft)" },
  "louisville-ky": { soil: "Ohio River floodplain alluvium over Devonian limestone and New Albany shale", frost: 60, rain: 45, utility: "Louisville Gas and Electric (LG&E)", permit: "Louisville Metro Department of Codes and Regulations", neighborhoods: ["Highlands", "Old Louisville", "St. Matthews"], readyMix: "Buzzi Unicem, Ernst Concrete, and Irving Materials", trees: "Kentucky coffeetree, white oak, tulip poplar", waterUtil: "Louisville Water Company (Ohio River source)", hardness: "100-150 ppm (moderately hard)" },
  "baltimore-md": { soil: "Piedmont saprolite and Baltimore gneiss with Coastal Plain sediments east of the Fall Line", frost: 65, rain: 42, utility: "Baltimore Gas and Electric (BGE)", permit: "Baltimore City Department of Housing", neighborhoods: ["Federal Hill", "Canton", "Roland Park"], readyMix: "Chaney Enterprises, Lehigh Hanson, and Martin Marietta", trees: "red maple, American sycamore, white oak", waterUtil: "Baltimore City DPW (Loch Raven and Prettyboy reservoirs)", hardness: "80-120 ppm (slightly hard)" },
  "milwaukee-wi": { soil: "Laurentide glacial till over Silurian dolomite and Niagara escarpment limestone", frost: 120, rain: 34, utility: "We Energies (Wisconsin Energy)", permit: "City of Milwaukee Department of Neighborhood Services", neighborhoods: ["Third Ward", "Bay View", "Wauwatosa"], readyMix: "Waukesha Concrete, We Energies Industrial, and Payne & Dolan", trees: "sugar maple, basswood, white pine", waterUtil: "Milwaukee Water Works (Lake Michigan source)", hardness: "120-160 ppm (hard)" },
  "albuquerque-nm": { soil: "Rio Grande rift alluvium over Tertiary volcanic tuff and Santa Fe Formation sand", frost: 70, rain: 9, utility: "PNM (Public Service Company of New Mexico)", permit: "City of Albuquerque Planning Department", neighborhoods: ["Nob Hill", "North Valley", "Rio Rancho"], readyMix: "Vulcan Materials, Martin Marietta, and Rio Grande Ready Mix", trees: "Rio Grande cottonwood, desert willow, pinon pine", waterUtil: "Albuquerque Bernalillo County Water Utility Authority", hardness: "120-200 ppm (hard)" },
  "tucson-az": { soil: "Sonoran Desert alluvium with caliche layers 12-30 inches below grade over Tucson Mountain rhyolite", frost: 12, rain: 12, utility: "Tucson Electric Power (TEP)", permit: "City of Tucson Planning and Development Services", neighborhoods: ["Sam Hughes", "Catalina Foothills", "Oro Valley"], readyMix: "CalPortland, Vulcan Materials, and Rinker Materials Southwest", trees: "mesquite, palo verde, ironwood", waterUtil: "Tucson Water (Central Arizona Project canal and groundwater)", hardness: "200-350 ppm (very hard)" },
  "sacramento-ca": { soil: "Sacramento Valley alluvial clay and American River sand with hardpan beneath east-side neighborhoods", frost: 12, rain: 18, utility: "Sacramento Municipal Utility District (SMUD)", permit: "City of Sacramento Community Development Department", neighborhoods: ["East Sacramento", "Midtown", "Elk Grove"], readyMix: "CalPortland, Teichert, and Pacific Coast Building Products", trees: "valley oak, coast live oak, Chinese pistache", waterUtil: "City of Sacramento Department of Utilities (American and Sacramento Rivers)", hardness: "30-60 ppm (soft)" },
  "raleigh-nc": { soil: "Piedmont saprolite over felsic gneiss with Triassic basin mudstone in the eastern reaches", frost: 45, rain: 46, utility: "Duke Energy Progress", permit: "City of Raleigh Development Services", neighborhoods: ["North Hills", "Cameron Village", "Cary"], readyMix: "Carolina Sunrock, Chandler Concrete, and Chaney Enterprises", trees: "loblolly pine, red maple, willow oak", waterUtil: "City of Raleigh Public Utilities (Falls Lake reservoir)", hardness: "40-80 ppm (soft to slightly hard)" },
  "kansas-city-mo": { soil: "Kansas City Group limestone and Missouri River loess with expansive Pennsylvanian shale", frost: 80, rain: 39, utility: "Evergy (formerly Kansas City Power & Light)", permit: "City of Kansas City Permits and Inspections Division", neighborhoods: ["Country Club Plaza", "Brookside", "Overland Park"], readyMix: "Ash Grove Cement, Hunt Midwest, and Ready Mixed Concrete Co. of Kansas City", trees: "bur oak, eastern redbud, hackberry", waterUtil: "Kansas City Water Services (Missouri River source)", hardness: "150-200 ppm (hard)" },
  "orlando-fl": { soil: "Central Florida sand over Ocala limestone with karst sinkholes and high water table", frost: 0, rain: 50, utility: "Duke Energy Florida and Orlando Utilities Commission (OUC)", permit: "City of Orlando Permitting Services Division", neighborhoods: ["Winter Park", "College Park", "Dr. Phillips"], readyMix: "CEMEX Orlando, Titan Florida, and Argos USA", trees: "live oak, cabbage palm, bald cypress", waterUtil: "Orlando Utilities Commission (Floridan Aquifer)", hardness: "180-280 ppm (hard to very hard)" },
  "pittsburgh-pa": { soil: "Allegheny Plateau sandstone and shale with Pittsburgh red beds clay and abandoned mine subsidence risk", frost: 75, rain: 38, utility: "Duquesne Light Company", permit: "City of Pittsburgh Department of Permits, Licenses and Inspections", neighborhoods: ["Shadyside", "Squirrel Hill", "Lawrenceville"], readyMix: "Allegheny Mineral, Lafarge Holcim, and Pittsburgh Ready Mix", trees: "red oak, sugar maple, American beech", waterUtil: "Pittsburgh Water and Sewer Authority (Allegheny River source)", hardness: "80-130 ppm (slightly hard)" },
  "cincinnati-oh": { soil: "Ohio River glacial outwash over Ordovician limestone and shale with hillside instability on Cincinnati Formation clay", frost: 70, rain: 42, utility: "Duke Energy Ohio", permit: "City of Cincinnati Department of Buildings and Inspections", neighborhoods: ["Hyde Park", "Over-the-Rhine", "Mount Adams"], readyMix: "Barrett Industries, Rumpke Concrete, and Hilltop Ready Mix", trees: "sugar maple, chinquapin oak, eastern redbud", waterUtil: "Greater Cincinnati Water Works (Ohio River source)", hardness: "150-220 ppm (hard)" },
  "colorado-springs-co": { soil: "Pikes Peak granite alluvium and Pierre shale with expansive bentonite along the Front Range foothills", frost: 110, rain: 17, utility: "Colorado Springs Utilities", permit: "City of Colorado Springs Regional Building Department", neighborhoods: ["Broadmoor", "Old Colorado City", "Briargate"], readyMix: "Martin Marietta, Transit Mix Concrete, and Aggregate Industries", trees: "ponderosa pine, blue spruce, Gambel oak", waterUtil: "Colorado Springs Utilities (multiple mountain reservoir sources)", hardness: "60-100 ppm (slightly hard)" },
};

function generateConcreteData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    soilPara: "${name} sits on ${m.soil}. Residential lots show variable depth to competent bearing across the metro, and geotechnical investigation is recommended before any structural slab work. The local soil profile drives both excavation difficulty and footing design across neighborhoods like ${m.neighborhoods.join(", ")}.",
    mixPara: "The ${name} residential concrete spec is ${m.frost > 50 ? "4,500 psi with 6-7 percent entrained air" : m.frost > 20 ? "4,000 psi with 4-6 percent entrained air" : "3,500-4,000 psi with no air-entrainment required"}, ${m.frost > 50 ? "Type I/II cement for freeze-thaw resistance" : "Type II cement for sulfate resistance"}, and compliance with local building department standards. ${m.readyMix} supply most of the ${name} delivery radius. ${m.frost > 50 ? "Winter pours require insulated blanket curing and protection plans." : m.frost > 10 ? "Cold-weather pours in January and February require protection protocols." : "Year-round pouring is feasible with heat-mitigation admixtures in summer."}",
    rebarPara: "${m.frost > 60 ? "Epoxy-coated #4 rebar is standard in " + name + " because of aggressive deicing salt applications that attack uncoated bar." : m.frost > 20 ? "#4 rebar on 18-inch centers is the standard residential reinforcement in " + name + "." : name + " residential flatwork uses #4 rebar on 18-inch centers with plastic chairs."} ${m.soil.includes("expan") || m.soil.includes("clay") ? "Post-tensioned strand is increasingly common on structural slabs because of the shrink-swell soil cycle." : "Standard rebar reinforcement handles the local soil conditions when properly detailed."}",
    climatePara: "${name} averages about ${m.frost} freeze-thaw cycles ${m.frost > 0 ? "per year" : "annually (essentially none)"}, ${m.frost > 60 ? "among the more punishing residential concrete environments in the region. Deicing salt applications accelerate surface scaling on unsealed driveways within 6-8 years." : m.frost > 20 ? "a moderate freeze-thaw load that still requires air-entrained mix and proper curing." : "so freeze-thaw is not a durability concern. The dominant threats are " + (m.rain > 45 ? "hurricane-season saturation and high humidity" : "UV exposure and heat-driven plastic shrinkage cracking") + "."} The area receives approximately ${m.rain} inches of precipitation annually.",
    disasterPara: "${name} ${m.frost > 60 ? "experienced documented freeze damage during recent polar vortex events that split driveways and cracked unsealed stoops across the metro." : m.rain > 45 ? "is exposed to tropical storm and hurricane risk that saturates subgrades and produces multi-year foundation settlement patterns." : m.frost > 20 ? "has experienced periodic ice storm damage that cracks partially cured concrete during winter pour events." : "faces extreme heat events that cause plastic-shrinkage cracking when contractors pour past 10am without retarder during summer months."} Reputable ${name} contractors reference these events when specifying protective measures.",
    permitPara: "${m.permit} handles residential concrete permits. ${m.neighborhoods[0]} and ${m.neighborhoods[2]} have distinct permitting timelines. ${state === "TX" ? "Houston-style no-zoning rules do not apply; " + name + " enforces setback and impervious-cover requirements." : "Local zoning overlays may restrict driveway width and impervious coverage in residential districts."}",
    setbackPara: "${name} zoning code restricts driveway width and requires setbacks from property lines in residential zones. ${m.neighborhoods[0]} and ${m.neighborhoods[1]} lots often have specific deed restrictions or HOA requirements layered on top of municipal code.",
    stylePara: "Residential concrete in ${name} centers on ${m.frost > 40 ? "broom-finish driveways, replacement front walks, and walkout-basement foundation work" : m.rain > 45 ? "pool-cage slab extensions, driveway aprons, and raised house pads" : "stamped patios, integrally colored driveways, and decorative seat walls"} typical of neighborhoods like ${m.neighborhoods[0]} and ${m.neighborhoods[1]}.",
    decorativePara: "${m.frost > 40 ? "Stamped flagstone patterns, exposed-aggregate finishes, and salt-finish textures for traction" : m.rain > 45 ? "Sand-finish pool decks, keystone-imprint patios, and acid-stained tropical-tone driveways" : "Stamped patterns in regional stone tones, integrally colored desert or earth-tone driveways, and exposed-aggregate patios"} are the popular decorative choices in ${name}. Local pigment and aggregate supply match the regional aesthetic.",
    seasonPara: "${m.frost > 60 ? "The productive pour season in " + name + " is late April through early November. Frozen ground from December through March makes winter work expensive." : m.frost > 20 ? name + " pours best from March through November. Winter pours in January and February require cold-weather protection protocols." : "The " + name + " pour window runs year-round, with " + (m.rain > 45 ? "the November-May dry season as the ideal window" : "early morning pours recommended during summer to avoid afternoon heat") + "."}",
    scenarioNotes: "${m.soil.includes("expan") || m.soil.includes("clay") ? "Expansive soil engineering adds $800-$2,500 to the scope." : m.soil.includes("caliche") || m.soil.includes("limestone") ? "Limestone or caliche excavation adds $400-$1,200 per footing." : "Standard soil conditions keep excavation costs predictable."} ${m.frost > 60 ? "Mandatory sealing and deep footings add 15-20 percent to project cost compared to warmer markets." : "Labor rates in " + name + " are " + (metro.region === "northeast" || metro.region === "west" ? "above" : "at or near") + " the national average."}",
    readyMixPlants: "${m.readyMix}"
  },
`;
}

function generateElectricalData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    utilityPara: "${m.utility} serves the ${name} metro area. Service coordination for residential panel upgrades runs 10-20 business days from completed application. ${state === "TX" ? "Texas deregulated retail market means homeowners choose a retail electric provider while " + m.utility.split(" (")[0] + " handles physical distribution." : "The utility handles all meter and service-entrance coordination for residential upgrades."}",
    codePara: "${state === "TX" ? "Texas adopted the 2023 NEC statewide through TDLR. " + name + " enforces the code through local building inspection." : state === "FL" ? "Florida Building Code Chapter 27 incorporates the 2020 NEC with Florida-specific amendments." : state === "CA" ? "California CEC 2022 applies. " + name + " adds Title 24 EV-ready and solar-ready requirements on new construction." : state === "OH" || state === "IN" ? name + " follows the 2020 NEC as adopted statewide." : name + " follows the NEC as adopted by the state with local amendments."} Romex ${state === "IL" || state === "NY" ? "may be restricted; check local conduit requirements" : "is permitted for residential wiring, keeping labor costs competitive"} in ${name}.",
    panelPara: "${name} housing stock includes pre-war and mid-century homes with 60-150 amp panels and newer construction with 200-amp service. Modern all-electric retrofits with heat pumps and EV chargers routinely require 200-amp service upgrades coordinated with ${m.utility.split(" (")[0]}. Neighborhoods like ${m.neighborhoods[0]} and ${m.neighborhoods[1]} show distinct housing-era panel profiles.",
    homeStockPara: "${name} homes range from ${m.frost > 60 ? "full-basement construction with accessible under-floor wiring" : state === "FL" ? "CBS (concrete block stucco) construction with slab-on-grade" : "slab-on-grade and crawl-space construction"} in older neighborhoods to modern tract homes in the suburbs. ${m.neighborhoods[0]} and ${m.neighborhoods[2]} represent different construction eras with distinct wiring access challenges.",
    licensePara: "${state === "TX" ? "Texas TDLR licenses Master Electricians, Journeyman Electricians, and Residential Wiremen. Verify at tdlr.texas.gov." : state === "FL" ? "Florida DBPR Electrical Contractors' Licensing Board issues Certified and Registered Electrical Contractor licenses. Verify at myfloridalicense.com." : state === "CA" ? "California requires a C-10 Electrical Contractor license. Verify at cslb.ca.gov." : state === "OH" ? "Ohio licenses electrical contractors through the Ohio Construction Industry Licensing Board. Verify at com.ohio.gov." : "State licensing applies and " + name + " may require additional local registration."} ${name} homeowners should verify both state licensure and local business registration before signing.",
    permitPara: "${m.permit} issues electrical permits, typically in 1-4 weeks for standard residential work. ${m.utility.split(" (")[0]} service coordination runs 2-4 weeks parallel to the city permit. Historic districts in ${m.neighborhoods[0]} or ${m.neighborhoods[1]} may add preservation commission review for visible exterior work.",
    hazardPara: "Federal Pacific Stab-Lok panels are common in 1960s-70s ${name} homes and remain a documented fire hazard. Aluminum branch circuit wiring shows up in 1965-1975 construction. ${m.frost > 40 ? "Ice-storm-damaged service masts and frozen exterior disconnects are recurring hazard categories." : state === "FL" ? "Hurricane-damaged service entrance cables that were dried rather than replaced are a persistent hidden hazard." : "Heat-damaged attic wire insulation is a concern in homes with decades of thermal cycling."}",
    renoPara: "${state === "FL" ? "Whole-house generator transfer switches are a standard " + name + " residential scope driven by hurricane outages." : m.frost > 60 ? "Generator transfer switches for winter storm outages are an increasingly common " + name + " residential scope." : "EV charger installation is the fastest-growing residential electrical scope in " + name + "."} A typical installation runs ${state === "FL" ? "$6,000-$11,000 for a standby generator with automatic transfer switch" : "$1,400-$3,500 depending on circuit length and panel capacity"}.",
    pricingContext: "${name} electrical labor runs ${metro.region === "northeast" || metro.region === "west" ? "15-30% above" : metro.region === "midwest" ? "at or slightly above" : "at or near"} the national average. ${m.utility.split(" (")[0]} coordination delays can push panel-upgrade timelines 2-4 weeks beyond initial estimates.",
    seasonPara: "${name} electrical demand peaks ${m.frost > 40 ? "April-June and September-October" : "March-May and October-November"}. ${m.frost > 40 ? "Winter ice storms drive emergency service-mast repairs." : "Summer heat limits attic work productivity."} Off-peak scheduling saves 8-15% on labor."
  },
`;
}

function generateFencingData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    materialsPara: "${name}'s dominant residential fencing is ${m.frost > 40 ? "cedar privacy (stockade and shadowbox), black aluminum ornamental, and chain link" : state === "FL" ? "aluminum ornamental (hurricane-resistant), vinyl privacy, and chain link" : metro.region === "mountain" ? "view fencing (wrought iron or steel), stucco-faced CMU walls, and ornamental aluminum" : "cedar and pressure-treated pine privacy, black ornamental aluminum, and chain link"} in neighborhoods like ${m.neighborhoods[0]} and ${m.neighborhoods[1]}. ${m.frost < 10 && state !== "FL" ? "Wood is less common because intense UV weathers cedar within 3-4 years." : ""}",
    hoaPara: "${name} master-planned communities and newer subdivisions often have strict HOAs with architectural review. Established neighborhoods like ${m.neighborhoods[0]} and ${m.neighborhoods[1]} may have deed restrictions or neighborhood character expectations. ${state === "TX" ? "Texas deed restrictions effectively function as HOAs in many neighborhoods." : ""}",
    heightPara: "${name} zoning typically limits residential fences to 4 feet in front yards and 6-8 feet in rear and side yards. Pool barrier fencing must meet ${state === "FL" ? "Florida state code (48 inches minimum)" : state === "AZ" ? "Arizona Revised Statutes pool-code requirements (60 inches)" : state === "TX" ? "Texas Health and Safety Code pool barrier requirements" : "state pool-code requirements"}. Corner lot sight-triangle reductions apply.",
    soilPara: "${name} soil is ${m.soil.split(" with ")[0]}. ${m.soil.includes("caliche") || m.soil.includes("limestone") ? "Caliche or limestone layers require pneumatic breakers for post-hole digging." : m.soil.includes("expan") || m.soil.includes("clay") ? "Expansive clay requires 36-inch post depth with concrete footings and expansion material." : m.frost > 60 ? "Frost depth requirements drive post footings to 42-48 inches." : "Standard 24-30 inch post depth with concrete footings is adequate for most residential installations."}",
    climatePara: "${name} ${m.frost > 60 ? "averages " + m.frost + " freeze-thaw cycles annually combined with deicing salt applications that corrode metal fasteners." : m.frost > 20 ? "experiences " + m.frost + " freeze-thaw cycles per year, a moderate load that still requires impact-rated vinyl and deep post footings." : "essentially does not freeze, so the dominant concerns are " + (state === "FL" ? "hurricane wind loads and coastal corrosion" : "UV degradation and monsoon wind events") + "."} Annual precipitation of ${m.rain} inches ${m.rain > 45 ? "creates aggressive wood-rot conditions" : m.rain < 15 ? "minimizes rot but UV remains the primary degradation factor" : "is moderate and manageable with proper wood treatment"}.",
    wildlifePara: "${name} wildlife pressure includes ${metro.region === "mountain" || metro.region === "west" ? "deer in outer neighborhoods requiring 8-foot exclusion fencing, coyotes, and rattlesnakes" : state === "FL" ? "raccoons, opossums, and occasional alligators near canals and ponds" : "deer in suburban neighborhoods, raccoons, and coyotes"}. ${state === "FL" ? "Pool-safety compliance dominates most fencing decisions." : "Standard 6-foot privacy fencing manages most urban wildlife concerns."}",
    permitPara: "${m.permit} handles fence permits for installations exceeding standard height limits. HOA architectural review in master-planned communities may take 2-6 weeks parallel to building permits. ${m.neighborhoods[0]} and ${m.neighborhoods[2]} may have distinct permitting requirements.",
    stylePara: "Signature ${name} residential fencing is ${m.frost > 40 ? "cedar shadowbox privacy, black steel ornamental matching historic architecture, and chain link in working-class neighborhoods" : state === "FL" ? "hurricane-rated aluminum ornamental, vinyl privacy in newer subdivisions, and pool-code-compliant barrier fencing" : metro.region === "mountain" ? "view fencing in earth tones, stucco perimeter walls, and pool-code aluminum barriers" : "cedar privacy fencing, black ornamental aluminum in established neighborhoods, and pipe-rail with hog wire on larger lots"}.",
    costContext: "${name} fencing labor runs ${metro.region === "northeast" || metro.region === "west" ? "15-25% above" : "at or near"} the national average. ${m.soil.includes("caliche") || m.soil.includes("limestone") ? "Rock excavation adds $100-$400 per difficult post." : m.frost > 60 ? "Deep footing requirements add $100-$300 per post." : ""}HOA compliance adds 2-5 weeks to project timelines in master-planned communities.",
    seasonPara: "${m.frost > 60 ? "The productive " + name + " fencing season is mid-May through early November. Frozen ground limits winter digging." : m.frost > 20 ? name + " fencing season runs essentially year-round with the most comfortable conditions October-May." : name + " fencing season runs year-round, with " + (state === "FL" ? "the November-May dry season as the ideal window" : "October-April offering the best working conditions") + "."}"
  },
`;
}

function generateFoundationData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    soilGeologyPara: "${name} sits on ${m.soil}. ${m.soil.includes("expan") || m.soil.includes("clay") || m.soil.includes("shale") ? "The expansive clay or shale subgrade drives seasonal vertical movement that is the primary cause of residential foundation distress across the metro." : m.soil.includes("limestone") || m.soil.includes("karst") ? "The limestone karst geology creates sinkhole and void risk that affects foundation stability in specific zones." : m.soil.includes("alluvium") || m.soil.includes("sand") ? "The alluvial soil provides generally stable bearing but varies significantly across neighborhoods." : "The local geology produces variable bearing conditions that drive site-specific foundation design."} Neighborhoods like ${m.neighborhoods[0]} and ${m.neighborhoods[1]} show distinct foundation performance patterns.",
    failureModePara: "${m.frost > 60 ? "Frost heave and freeze-thaw cycling are the dominant foundation failure modes in " + name + ". Unheated garages and porches with shallow footings are the most common failure sites." : m.soil.includes("expan") || m.soil.includes("clay") ? "Shrink-swell clay movement drives the majority of foundation distress in " + name + ". Seasonal drying in summer and wetting in winter produces 2-4 inches of vertical movement that cracks slabs and displaces piers." : state === "FL" ? "Karst sinkhole subsidence and hurricane-driven saturated subgrades are the dominant foundation concerns in " + name + "." : "Differential settlement from variable soil bearing is the most common foundation issue in " + name + "."} Older homes in ${m.neighborhoods[0]} and ${m.neighborhoods[1]} show era-specific failure patterns tied to original construction methods.",
    repairMethodPara: "${m.soil.includes("expan") || m.soil.includes("clay") ? "Pressed steel piers and helical piers are the dominant repair methods in " + name + " for expansive soil. Bell-bottom piers drilled to stable bearing below the active zone provide the most permanent solution." : m.frost > 60 ? "Wall bracing with carbon-fiber straps or steel I-beams addresses lateral frost-pressure bowing. Helical piers stabilize settling footings." : state === "FL" ? "Compaction grouting and underpinning with helical or steel push piers address sinkhole-affected foundations." : "Helical piers, push piers, and polyurethane foam injection are the standard repair methods."} ${name} repair crews reference local soil conditions when specifying pier depth and spacing.",
    permitAndEngineeringPara: "${m.permit} handles foundation repair permits. A licensed Professional Engineer must seal underpinning drawings for any work affecting structural load paths. PE assessments in ${name} run ${metro.region === "northeast" || metro.region === "west" ? "$800-$1,800" : "$500-$1,200"} reflecting local engineering rates. ${m.neighborhoods[0]} historic district overlays may add preservation commission review.",
    drainagePara: "${m.rain > 45 ? "Heavy annual rainfall of " + m.rain + " inches drives aggressive drainage requirements. French drains, sump pumps, and proper downspout routing are essential components of foundation health in " + name + "." : m.rain < 20 ? name + " receives only " + m.rain + " inches of rain annually, but improper irrigation around foundations is the primary moisture-related failure driver." : name + " receives " + m.rain + " inches of rain annually. Proper grading, downspout extensions, and French drain systems protect foundations from water intrusion."} ${m.frost > 40 ? "Basement waterproofing is a standard paired scope with foundation repair." : "Surface drainage management is the first line of defense."}",
    seasonalPara: "${m.frost > 60 ? "The working season for foundation repair in " + name + " runs May through November when groundwater is lowest. Winter repairs require heated enclosures for concrete curing." : state === "FL" ? "The November-April dry season is ideal for foundation work in " + name + ". Hurricane season adds schedule risk." : "Foundation repair in " + name + " runs year-round, with " + (m.rain > 45 ? "dry-season months offering the most predictable conditions" : "spring and fall as the preferred windows") + "."}",
    localDisasterPara: "${m.frost > 60 ? "Recent polar vortex events and severe winter storms have produced documented frost-heave damage across " + name + " neighborhoods." : state === "FL" ? "Hurricane events have left saturated subgrades with elevated sinkhole risk across the " + name + " metro." : m.rain > 45 ? "Major flooding events have saturated subgrades and produced multi-year settlement backlogs." : m.soil.includes("expan") ? "Extended drought followed by heavy rain cycles have driven widespread foundation movement in " + name + "." : "Severe weather events periodically accelerate pre-existing foundation issues across the metro."}",
    neighborhoodFailurePattern: "${m.neighborhoods[0]} and ${m.neighborhoods[1]} show distinct foundation performance patterns tied to their construction era and soil conditions. ${m.neighborhoods[2]} properties on different geological substrata may show entirely different failure modes. Local foundation contractors should be able to reference neighborhood-specific history.",
    warrantyCulturePara: "Reputable ${name} foundation contractors offer lifetime transferable warranties on pier work. Warranty scope should explicitly cover future movement beyond specified tolerances. ${name} real estate transactions routinely require foundation inspection reports, and the warranty transfer process is a key component of resale value protection.",
    pieringAlternativesPara: "${m.soil.includes("expan") || m.soil.includes("clay") ? "Pressed steel piers, helical piers, and drilled bell-bottom piers all compete in the " + name + " market." : "Helical piers and push piers are the dominant alternatives in " + name + "."} Polyurethane foam injection handles minor leveling but is not a substitute for structural piering on confirmed bearing-capacity failures. ${name} PE firms typically specify pier spacing and depth based on site-specific geotechnical data.",
    moistureManagementPara: "${m.rain > 45 ? "Aggressive moisture management is essential in " + name + "'s " + m.rain + "-inch rainfall environment." : m.rain < 20 ? "Foundation moisture management in " + name + " focuses on controlled irrigation to prevent the drying-wetting cycle that drives expansive soil movement." : "Balanced moisture management around " + name + " foundations prevents both saturation and desiccation."} Proper grading at 6 inches of fall in the first 10 feet, gutter and downspout discharge 4 feet from the foundation, and French drain systems are the standard prescriptive solutions.",
    localScamPara: "Common ${name} foundation scams include: quoting unnecessary pier work based on cosmetic cracks rather than structural investigation, using inferior pier systems with short warranties, and failing to obtain PE-sealed drawings before work begins. Always require a third-party PE assessment before approving any foundation repair scope over $5,000."
  },
`;
}

function generateGarageData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    archIntro: "${name} garage architecture reflects the region's housing stock and climate.",
    archBody: "Homes in ${m.neighborhoods[0]} and ${m.neighborhoods[1]} typically feature ${m.frost > 40 ? "attached two-car garages with insulated steel doors designed for cold-weather performance" : state === "FL" ? "attached garages with hurricane-rated doors meeting Florida Building Code wind-load requirements" : "attached garages with standard steel or composite doors matching the home's architectural style"}. ${m.neighborhoods[2]} properties may have detached or oversized three-car configurations.",
    insulationIntro: "Garage door insulation in ${name} is driven by ${m.frost > 40 ? "severe winter heating loads" : "summer cooling loads and energy efficiency"}.",
    insulationBody: "${m.frost > 60 ? "Polyurethane-injected steel doors with R-18 to R-22 values are the standard " + name + " specification because attached garages share walls with conditioned space." : m.frost > 20 ? "Polystyrene-core doors at R-8 to R-12 handle " + name + "'s moderate climate, with polyurethane upgrades recommended for workshops." : "Single-layer steel or aluminum doors suffice for most " + name + " installations, though insulated doors at R-8 improve comfort in garage workshops."}",
    openerBody: "${name} homeowners commonly install LiftMaster or Chamberlain belt-drive openers with Wi-Fi connectivity and battery backup. ${m.frost > 40 ? "Battery backup is particularly important given winter storm power outages." : state === "FL" ? "Battery backup is essential for hurricane-season power outages, and manual-release mechanisms must be accessible." : "Smart-home integration with MyQ or equivalent platforms is the dominant feature request."} Chain-drive openers remain popular in detached garages where noise is less of a concern.",
    codeBody: "${m.permit} handles garage door replacement permits when structural headers or opening dimensions change. ${state === "FL" ? "Florida Building Code requires wind-load-rated doors in the HVHZ and high-wind zones. Miami-Dade NOA or Florida Product Approval is required for compliant products." : m.frost > 60 ? "Local energy codes may require minimum insulation values on attached-garage doors." : "Standard replacement of same-size doors generally does not require a permit."}",
    dealerBody: "Clopay, Amarr, and Wayne Dalton are the major brands distributed through ${name} dealers. ${m.neighborhoods[0]} and ${m.neighborhoods[2]} have strong local dealer networks offering Overhead Door and C.H.I. products. Specialty carriage-house and custom wood doors are available through regional distributors.",
    stormBody: "${state === "FL" ? name + " is in a hurricane zone and garage doors are the most vulnerable large opening in the building envelope. Wind-rated doors with reinforcement struts and heavy-duty track are mandatory." : m.frost > 60 ? name + " winter storms with ice and heavy snow load stress garage door springs and tracks. Annual maintenance inspection is recommended before November." : "Severe weather events in " + name + " occasionally damage garage doors, with " + (metro.region === "mountain" ? "hail and high winds" : "thunderstorms and wind") + " as the primary risks."}",
    redFlag1: "Bid does not specify door manufacturer, model, or R-value",
    redFlag2: "No mention of spring type (torsion vs. extension) or cycle rating",
    redFlag3: "Opener quote omits battery backup and smart-home integration options",
    redFlag4: "Installer cannot provide proof of manufacturer certification",
    redFlag5: "${state === "FL" ? "Door product does not carry Florida Product Approval or Miami-Dade NOA" : m.frost > 60 ? "Door insulation R-value is below R-12 on an attached garage in a cold climate" : "No weatherstripping replacement included in the bid"}",
    scenarios: "Budget single-car non-insulated steel door replacement in ${name} runs $800-$1,400 installed. Mid-range insulated two-car steel door with windows and new opener runs $2,200-$3,800. Premium carriage-house style with R-18 polyurethane core and smart opener runs $4,500-$7,500.",
    seasonalBest: "${m.frost > 40 ? "September-November and March-May" : "October-April"}",
    seasonalWorst: "${m.frost > 40 ? "December-February (emergency repairs from spring failures) and June-August (peak demand)" : state === "FL" ? "June-November (hurricane season emergency demand)" : "May-September (peak installation demand)"}",
    seasonalNote: "${name} garage door installers are busiest during ${m.frost > 40 ? "spring when winter damage drives replacement demand" : "spring and summer home improvement season"}. Off-season scheduling saves 8-15% on labor. Emergency spring replacement after failure commands premium pricing year-round."
  },
`;
}

function generateGutterData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    annualRainfall: "${m.rain} inches",
    rainfallNote: "${name} receives ${m.rain} inches of rain per year${m.rain > 45 ? ", with intense summer thunderstorms and " + (state === "FL" ? "hurricane-season deluges" : "severe storm events") + " that can deliver 3-5 inches in 24 hours" : m.rain < 20 ? ", concentrated in " + (state === "CA" ? "the November-March wet season" : "brief monsoon-season downpours") : ", spread across the seasons with " + (m.frost > 40 ? "snow and ice adding to the load" : "spring and fall peaks")}. Gutters on ${name} homes must handle ${m.rain > 45 ? "both sustained rainfall and sudden high-volume events" : m.rain < 20 ? "concentrated high-intensity events despite long dry periods" : "moderate year-round precipitation and occasional heavy storms"}.",
    downspoutNote: "${m.frost > 60 ? "Basement flooding from improper downspout routing is a common " + name + " issue." : state === "FL" ? "High water tables in " + name + " require downspout discharge away from foundations to prevent saturation." : "Proper downspout routing away from foundations prevents settlement and moisture intrusion."} Downspout extensions of 4-6 feet from the foundation and connection to underground drainage are standard ${name} practice.",
    treeCoverage: "${m.trees.includes("oak") || m.trees.includes("maple") ? "moderate to heavy" : m.trees.includes("pine") ? "moderate" : "low to moderate"}",
    dominantTrees: "${m.trees}",
    debrisType: "${m.trees.includes("oak") ? "oak leaves, acorns, and pollen catkins" : m.trees.includes("pine") ? "pine needles, pollen, and small cone debris" : m.trees.includes("maple") ? "maple samaras (helicopter seeds) and heavy autumn leaf drop" : m.trees.includes("mesquite") ? "mesquite seed pods, palo verde flowers, and desert dust" : "mixed deciduous leaf drop and seasonal seed debris"}",
    bestGuardStyle: "${m.trees.includes("pine") ? "Micro-mesh guards handle pine needles that slip through standard screen guards" : m.rain < 20 ? "Reverse-curve or surface-tension guards shed the occasional heavy rain effectively" : "Micro-mesh guards provide the best all-around protection for " + name + "'s debris mix"}",
    freezeRisk: "${m.frost > 60 ? "high" : m.frost > 20 ? "moderate" : "low to none"}",
    iceNote: "${m.frost > 60 ? name + " experiences regular freeze-thaw cycling from November through March. Ice dams form at the eaves where warm attic air melts snow. Heated gutter cables run $500-$1,200 for a typical " + name + " home and are a practical investment for persistent ice dam problems." : m.frost > 20 ? name + " gets occasional freezing that can cause ice dam issues in severe winters. Heated cables are optional but valuable for north-facing slopes." : "Freeze risk is essentially zero in " + name + ". Heated gutter systems are unnecessary."}",
    cleaningFrequency: "${m.trees.includes("oak") || m.trees.includes("maple") ? "twice per year minimum (late fall after leaf drop and late spring after seed season)" : m.rain < 20 ? "once per year before the rainy season" : "twice per year (spring and fall)"}",
    cleaningNote: "${m.neighborhoods[0]} and ${m.neighborhoods[1]} neighborhoods with heavy ${m.trees.split(",")[0]} canopy may need a third cleaning. ${m.rain > 45 ? "Pre-hurricane-season gutter cleaning is essential." : ""}",
    buyingBest: "${m.frost > 40 ? "Late winter (January-February) and late summer (August-September)" : "Dry season months when contractor demand is lowest"}",
    buyingWorst: "${m.frost > 40 ? "Spring (March-May) after freeze damage and fall (October-November) during peak leaf season" : state === "FL" ? "Post-hurricane emergency demand periods" : "During and immediately after severe weather events"}",
    buyingNote: "Scheduling ${name} gutter installation during the quieter ${m.frost > 40 ? "summer" : "off-peak"} months typically saves 10-15% on labor. ${m.frost > 40 ? "Winter storm damage drives spring emergency demand and premium pricing." : ""}"
  },
`;
}

function generateHVACData(slug, name, state, metro) {
  const m = M[slug];
  const heatingDom = m.frost > 50;
  const coolingDom = m.frost < 20;
  return `  "${slug}": {
    utilityCompanies: "${m.utility}",
    avgElectricRate: ${state === "TX" ? "0.12" : state === "FL" ? "0.14" : state === "CA" ? "0.28" : metro.region === "northeast" ? "0.20" : metro.region === "midwest" ? "0.14" : metro.region === "mountain" ? "0.13" : "0.13"}, avgGasRate: ${state === "TX" ? "1.10" : state === "FL" ? "1.80" : metro.region === "northeast" ? "1.60" : metro.region === "midwest" ? "1.05" : "1.20"},
    coolingDominant: ${coolingDom}, heatingDominant: ${heatingDom},
    humidityIssue: "${m.rain > 45 ? "high" : m.rain > 35 ? "moderate" : m.rain < 15 ? "low" : "moderate"}",
    extremeTemp: "${m.frost > 60 ? "cold winters with sub-zero wind chills and summer humidity" : coolingDom ? "extreme summer heat exceeding 100F with " + (state === "FL" ? "tropical humidity" : "arid conditions") : "hot summers above 95F and " + (m.frost > 30 ? "cold winters below 20F" : "mild winters")}",
    recommendedSEER: ${coolingDom ? 18 : m.frost > 60 ? 16 : 16}, recommendedAFUE: ${heatingDom ? 96 : m.frost > 30 ? 92 : coolingDom ? 80 : 90},
    heatPumpViable: "${coolingDom ? "excellent; " + name + "'s mild winters make heat pumps the default recommendation for most homeowners" : heatingDom ? "viable with cold-climate models like Mitsubishi Hyper-Heat or Bosch IDS but dual-fuel with gas backup is still the dominant configuration for deep-cold events" : "highly viable as the primary system; " + name + "'s moderate climate is ideal for standard heat pump efficiency"}",
    permitAuthority: "${m.permit.split(" (")[0]}",
    permitDetail: "${m.permit} issues HVAC permits for residential work. ${state === "TX" ? "TDLR licenses HVAC contractors statewide." : state === "FL" ? "Florida DBPR licenses HVAC contractors." : "State licensing applies plus local contractor registration."} ${name} requires permit inspection for all new equipment installations including like-for-like replacements.",
    bestBuyMonths: "${heatingDom ? "October through February" : "November through March"}",
    worstBuyMonths: "${heatingDom ? "June through August" : coolingDom ? "June through September" : "July through September"}",
    seasonReason: "${name} HVAC demand peaks during ${heatingDom ? "summer AC failures and winter heating emergencies" : coolingDom ? "summer heat waves when AC units fail under maximum load" : "the transition seasons when homeowners discover failing equipment"}. Off-season scheduling saves 10-20% on labor and often includes manufacturer promotional pricing.",
    localBrandNetworks: "${name} has strong dealer networks for Trane, Carrier, and Lennox through local distributors. ${metro.region === "southeast" || metro.region === "south" ? "Rheem and Goodman also have significant market share through independent dealers." : "Mitsubishi and Fujitsu ductless systems have growing market share for retrofit applications."}",
    dominantEquipmentStyle: "${heatingDom ? "Forced-air gas furnace plus central AC split system is the dominant " + name + " configuration" : coolingDom ? "Central AC split system or packaged heat pump is standard in " + name : "Heat pump split systems are increasingly common in " + name}, with ${heatingDom ? "boiler-to-furnace conversions in older neighborhoods and ductless mini-splits for additions" : "ductless mini-splits for room additions and historic home retrofits"} serving the specialty upgrade market.",
    localScam: "${name} homeowners should watch for: oversized equipment quotes that short-cycle and waste energy, condenser-only replacements that leave the mismatched indoor coil degrading efficiency, and refrigerant top-off services on systems with confirmed leaks rather than proper repair.",
    localPermitQuirk: "${state === "TX" ? name + " requires TDLR-licensed contractors for all HVAC work, and permits must be pulled before work begins, not after." : state === "FL" ? "Florida requires Manual J load calculations for new installations, and " + name + " building inspectors enforce this." : name + " building inspection enforces permit requirements on all HVAC equipment changes including like-for-like replacements."}",
    techNarrative: "${heatingDom ? name + "'s older homes often run oversized furnaces from the 1990s that waste 20-30% of gas input. Right-sizing with Manual J calculations typically drops the replacement tonnage by 0.5-1.0 ton and improves comfort while reducing operating cost." : coolingDom ? name + "'s extreme cooling loads mean proper Manual J sizing is critical. Oversized AC units short-cycle, fail to dehumidify, and wear out prematurely." : name + "'s moderate climate makes it an ideal market for variable-speed heat pumps that handle both heating and cooling efficiently without the complexity of dual-fuel systems."}",
    utilityRebatesQuirk: "${m.utility.split(" (")[0]} ${state === "TX" ? "offers rebates through the Retail Electric Provider rather than the distribution utility" : state === "FL" ? "offers efficiency rebates for qualifying ENERGY STAR equipment" : "offers rebates of $300-$1,500 for qualifying high-efficiency heat pumps and furnaces"}. Federal 25C tax credits (up to $2,000 for heat pumps) stack on top of utility rebates."
  },
`;
}

function generateInsulationData(slug, name, state, metro) {
  const m = M[slug];
  const ex = INSULATION_EXTRAS[slug];
  return `  "${slug}": {
    atticStrategyPara: "${name} attics in neighborhoods like ${m.neighborhoods[0]} and ${m.neighborhoods[1]} ${m.frost > 60 ? "require aggressive insulation to R-49 or R-60 given Zone " + ex.ieccZone + " requirements." : m.frost < 10 ? "run extremely hot in summer, making radiant barrier plus blown-in fiberglass to R-38 the standard upgrade." : "benefit from blown-in fiberglass or cellulose to " + ex.codeAttic + " minimum."} ${m.frost > 60 ? "Vermiculite removal (potential Libby asbestos) may be a prerequisite in pre-1980 homes." : m.frost < 10 ? "Attic temperatures exceeding 140F in summer make the radiant-barrier-plus-fill approach particularly effective." : "Pre-existing fiberglass batts that have settled or compressed need removal or supplemental blown-in overlay."}",
    wallStrategyPara: "${name} wall assemblies vary by era: ${m.frost > 60 ? "pre-1940 balloon-framed homes need dense-pack cellulose at 3.5 pcf plus horizontal firestop blocking" : state === "FL" ? "CBS (concrete block stucco) construction requires specialty approaches because standard cavity methods do not apply" : "2x4 stud walls with original R-11 or R-13 batts benefit from drill-and-fill cellulose or open-cell foam"}. Zone ${ex.ieccZone} code requires ${ex.codeWall} for walls. ${m.frost > 40 ? "Do not inject closed-cell foam into brick-veneer walls because moisture trapping causes long-term damage." : "Avoid any insulation approach that creates double vapor barriers in this climate zone."}",
    airSealingPara: "A typical pre-retrofit blower door in ${name} reads ${m.frost > 60 ? "4,000-7,000 CFM50 because of balloon-framing leakage, unsealed laundry chutes, and open-stair chases" : state === "FL" ? "6-9 ACH50 because of open top plates, unsealed recessed fixtures, and duct leakage through attic-mounted air handlers" : "0.35-0.55 CFM50 per sqft envelope"}. Priority sealing targets are: ${m.frost > 60 ? "sill-plate-to-foundation joints, rim joist plane, top plate to drywall gaps, and plumbing chase penetrations" : "attic hatch, recessed can lights, HVAC air handler plenum, and duct boot connections"}. AeroBarrier is available through local applicators for challenging retrofit cases.",
    rebatePara: "${m.utility.split(" (")[0]} ${state === "TX" ? "offers rebates of $400-$1,200 for attic insulation and duct sealing through the utility efficiency program" : state === "FL" ? "offers the Energy Savings Assistance Program for qualifying households" : metro.region === "midwest" ? "offers weatherization rebates through the state energy efficiency program" : "provides rebates through the Home Performance with ENERGY STAR program"}. The federal 25C tax credit covers 30% of insulation cost up to $1,200 annually and stacks on utility rebates. ${state === "CA" ? "Title 24 HERS verification is required for rebate qualification." : "BPI certification is the quality benchmark for rebate-qualifying contractors."}",
    contractorLandscapePara: "${name}'s insulation market includes BPI Building Performance Institute certified crews, volume production crews focused on attic top-ups, and HVAC-bundled retrofit firms. ${state === "TX" ? "Texas does not require a separate insulation contractor license but BPI certification is the quality standard." : state === "FL" ? "Florida DBPR licenses insulation contractors." : state === "CA" ? "California requires a C-2 Insulation and Acoustical Contractor license." : "State licensing applies and local registration may be required."} Typical attic R-38 top-up on 1,800 sqft in ${name} runs $1,400-$2,800 pre-rebate.",
    commonUpsellPara: "The dominant ${name} upsell is ${m.frost > 40 ? "open-cell spray foam over the roof deck pitched as 'conditioning the attic' at $4.50-$6.50 per sqft, which only pencils out when ducts and air handler are in the attic" : "full attic closed-cell foam at $3.80-$5.50 per sqft, which is only justified when ductwork is in the unconditioned attic"}. A frequent bad upsell is adding insulation without sealing ducts first. The legitimate paired upgrade in ${name} is ${m.frost > 40 ? "rim joist closed-cell at R-23 and storm window installation" : "duct sealing with Aeroseal plus attic R-38 top-up for maximum utility rebate stacking"}.",
    historicHomePara: "${m.neighborhoods[0]} and ${m.neighborhoods[1]} ${m.frost > 60 ? "include historic districts that may restrict exterior insulation modifications" : "have older homes where attic and interior retrofits are unrestricted"}. ${m.frost > 60 ? "Interior dense-pack cellulose through hidden access holes preserves historic character." : "Attic insulation upgrades are universally unrestricted regardless of historic status."} ${name} pre-1940 homes may have ${m.frost > 40 ? "vermiculite or knob-and-tube wiring that must be addressed before insulation work" : "original minimal insulation that provides significant upgrade opportunity"}.",
    codeSnapshotPara: "${name} is in IECC Zone ${ex.ieccZone} requiring ${ex.codeAttic} attic and ${ex.codeWall} walls for new construction. Retrofit prescriptive requirements trigger when more than 50% of the envelope is opened. ${state === "TX" ? "Texas IRC with state amendments applies." : state === "FL" ? "Florida Building Code Section R402 applies." : state === "CA" ? "California Title 24 Part 6 applies with HERS verification." : "Local building code enforces IECC requirements through permit inspection."} ACCA Manual J load calculations are required when HVAC is replaced as part of the scope.",
    monitoringPara: "${m.utility.split(" (")[0]} ${state === "TX" ? "SmartMeter TX data portal provides" : state === "CA" ? "Green Button data download provides" : "meter data provides"} pre-retrofit consumption baselines for energy auditors. Pre-retrofit blower door of ${m.frost > 60 ? "0.45 CFM50 per sqft envelope is typical" : "0.40-0.55 CFM50 per sqft envelope is common"} on ${name} homes. A ${m.frost > 60 ? "35% heating energy reduction" : "20-28% cooling energy reduction"} is the benchmark for a full insulation-plus-air-sealing package.",
    moistureControlPara: "${m.frost > 60 ? name + "'s cold-climate vapor strategy puts the vapor retarder on the warm (interior) side of the wall assembly." : state === "FL" || (state === "TX" && m.frost < 20) ? name + "'s cooling-dominant climate requires the vapor retarder on the exterior (warm-in-summer) side. Kraft-faced batts installed with kraft facing the drywall are WRONG in this climate and cause mold." : name + "'s mixed climate requires careful vapor management; a smart vapor retarder (Certainteed MemBrain or Intello Plus) handles the seasonal flip between heating and cooling modes."} ${m.rain > 45 ? "High humidity at " + m.rain + " inches annual rainfall drives aggressive moisture management." : "Standard moisture control practices are adequate for the local climate."}"
  },
`;
}

function generateKitchenData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    homeStockPara: "${name} kitchen stock varies from ${m.frost > 60 ? "pre-war homes with small galley layouts" : state === "FL" ? "1960s-80s ranch homes with builder-grade kitchens" : "mid-century ranch homes with original 1960s-70s layouts"} in ${m.neighborhoods[0]} to modern open-concept construction in ${m.neighborhoods[2]}. ${m.frost > 60 ? "Full basements provide space for relocated mechanicals." : "Slab-on-grade construction limits rough-in relocation options."} The typical ${name} kitchen remodel footprint runs 100-200 sqft.",
    permitAndElectricalPara: "${m.permit} issues kitchen remodel permits. ${m.utility.split(" (")[0]} service upgrades may be required when adding induction ranges or dual ovens to older 100-amp panels. Electrical permits are separate from the general remodel permit. ${state === "TX" ? "TDLR-licensed electricians and plumbers must pull their respective sub-permits." : "Licensed trade contractors must pull electrical and plumbing sub-permits."}",
    cabinetSupplyChainPara: "Regional cabinet supply in ${name} runs through local showrooms carrying KraftMaid, Wood-Mode, and Wellborn semi-custom lines. IKEA SEKTION with custom fronts from Semihandmade or Reform is a cost-effective alternative in the ${name} market. ${m.neighborhoods[0]} and ${m.neighborhoods[1]} have specialty kitchen design showrooms serving the higher-end market.",
    countertopTrendsPara: "Quartz dominates ${name} kitchen countertops with Caesarstone, Cambria, and Silestone as the leading brands. Natural stone (granite, marble) maintains share in ${m.neighborhoods[0]} homes. Porcelain slab countertops are gaining share for their heat and stain resistance. Local fabricators in the ${name} metro provide 2-3 week turnaround on templating and installation.",
    plumbingAndWaterPara: "${m.waterUtil} serves ${name} with ${m.hardness} water. ${parseInt(m.hardness) > 150 ? "Hard water requires consideration for water softeners and specific fixture finishes that resist mineral buildup." : "Relatively soft water means mineral buildup is not a major fixture concern."} ${state === "TX" ? "Master plumber licensing through TDLR applies to all permitted plumbing work." : "Licensed plumbers must handle all permitted fixture and supply-line work."}",
    layoutConstraintsPara: "${name} homes in ${m.neighborhoods[0]} have era-specific layout constraints. ${m.frost > 60 ? "Load-bearing walls between kitchen and dining rooms often require steel beam headers ($2,000-$5,000) for open-concept conversions." : state === "FL" ? "CBS wall construction makes wall removal more complex than wood-frame homes." : "Standard wood-frame construction allows relatively straightforward wall removal for open-concept layouts."} Island additions require adequate clearance (42 inches minimum on all sides) and often trigger electrical and plumbing rough-in relocation.",
    permitTimelinePara: "${m.permit} processes kitchen remodel permits in ${metro.region === "northeast" ? "4-8 weeks" : "2-4 weeks"} for standard scope. ${m.neighborhoods[0]} historic district overlays may add preservation commission review. Contractor scheduling in ${name} runs ${metro.region === "northeast" || metro.region === "west" ? "6-12 weeks" : "4-8 weeks"} from signing to start date during peak season.",
    localDesignerCulturePara: "${name} kitchen design culture centers on NKBA-certified designers charging $100-$300/hour or 10-15% of project cost. Local design-build firms offer turnkey packages that bundle design, permitting, and construction. ${m.neighborhoods[0]} and ${m.neighborhoods[1]} have the strongest concentration of kitchen showrooms and design professionals.",
    applianceUpsellPara: "Common ${name} appliance upsells include built-in refrigeration (Sub-Zero, Thermador) at $8,000-$15,000, professional-grade ranges (Wolf, Viking) at $5,000-$12,000, and integrated dishwashers (Miele, Bosch) at $1,200-$2,500. Budget-conscious ${name} homeowners achieve similar aesthetics with panel-ready Samsung or LG at 40-60% less.",
    historicDistrictConstraintsPara: "${m.neighborhoods[0]} and ${m.neighborhoods[1]} ${m.frost > 40 ? "may have historic district restrictions on exterior modifications including window changes visible from the street" : "generally allow unrestricted interior kitchen remodeling"}. Interior work is almost never restricted by historic preservation rules. ${m.frost > 40 ? "Pre-1978 homes require EPA RRP-certified contractors for any work disturbing painted surfaces." : ""}",
    waterHeaterSwapPara: "Kitchen remodels in ${name} often trigger water heater upgrades when demand increases from dishwashers and pot fillers. Tankless units (Rinnin, Navien) run $3,000-$5,500 installed. ${state === "TX" ? "Texas-licensed plumbers handle the gas tie-in and permit." : "Licensed plumbers handle the installation and permit."}",
    commonGotchasPara: "Common ${name} kitchen remodel gotchas: discovering ${m.frost > 60 ? "asbestos in vinyl floor tiles or plaster" : "outdated wiring or plumbing behind walls"} during demo, ${state === "FL" ? "CBS wall demolition costs 2-3x wood-frame" : "load-bearing wall removal requiring structural engineering"}, and appliance lead times of 8-16 weeks on European brands. Budget 15-20% contingency for hidden conditions."
  },
`;
}

function generateLandscapingData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    nativePlantPalettePara: "The ${name} native palette centers on ${m.trees} for canopy and understory. ${metro.region === "mountain" || m.rain < 20 ? "Drought-tolerant xeriscaping with native grasses, agave, and desert wildflowers is increasingly popular." : state === "FL" ? "Tropical and subtropical species including sabal palmetto, coontie, and muhly grass form the foundation planting." : "Regional native perennials and grasses adapted to the local soil and rainfall pattern form the foundation planting."} The ${name} cooperative extension service and local native plant societies provide definitive sourcing lists.",
    soilAmendmentPara: "${name} soil is ${m.soil.split(" with ")[0]}. ${m.soil.includes("clay") ? "Heavy clay requires gypsum amendment and raised beds for most ornamental plantings." : m.soil.includes("sand") ? "Sandy soil requires organic amendment and mulching to retain moisture." : m.soil.includes("caliche") || m.soil.includes("limestone") ? "Alkaline soil with high pH limits species selection and benefits from sulfur amendment." : "Local soil testing through the county extension service ($15-$40) is the starting point for amendment recommendations."} ${m.neighborhoods[0]} and ${m.neighborhoods[1]} yards show distinct soil profiles.",
    irrigationRegsPara: "${m.rain < 20 ? name + " enforces water conservation ordinances with specific irrigation day/time restrictions." : state === "FL" ? name + " follows local water management district irrigation restrictions." : name + " does not enforce strict irrigation restrictions but backflow-prevention permits are required on new systems."} ${state === "TX" ? "SAWS (San Antonio) has among the strictest stage-based irrigation restrictions in Texas." : state === "CA" ? "SMUD territory homes must comply with state Model Water Efficient Landscape Ordinance (MWELO)." : "Smart irrigation controllers with weather-based scheduling reduce consumption 20-30%."}",
    hardscapeStylePara: "${name} hardscape style runs to ${metro.region === "mountain" ? "flagstone patios, dry-stack retaining walls, and decomposed granite paths" : state === "FL" ? "paver patios, shell-aggregate paths, and pool-cage-integrated outdoor living spaces" : m.frost > 60 ? "bluestone or natural stone patios, fieldstone retaining walls, and paver driveways" : "stamped concrete patios, natural stone seat walls, and paver walkways"} in neighborhoods like ${m.neighborhoods[0]} and ${m.neighborhoods[1]}. Permeable paver installations qualify for stormwater management credits in many jurisdictions.",
    lawnMaterialPara: "${m.frost > 60 ? "Cool-season fescue and bluegrass blends dominate " + name + " residential lawns." : state === "FL" ? "St. Augustine (Floratam cultivar) is the dominant warm-season turf in " + name + ", with Zoysia gaining share." : state === "TX" ? "Bermuda grass and Zoysia are the dominant warm-season turfs, with buffalo grass gaining share for water conservation." : metro.region === "mountain" ? "Buffalo grass and blue grama are the water-efficient native choices, with Kentucky bluegrass on irrigated lots." : "Warm-season turf (Bermuda, Zoysia) dominates with cool-season fescue in shaded areas."}",
    turfAndXeriscapeRebatesPara: "${m.rain < 20 || state === "CA" || state === "TX" || state === "NV" || state === "AZ" || state === "NM" || state === "CO" ? name + " offers turf-replacement rebates of $1-$3 per sqft through the local water utility or conservation district." : name + " does not offer turf-replacement rebates but stormwater management incentives may apply."} ${state === "CA" ? "California MWELO compliance drives landscape water budgets on new construction." : "Native plant installations reduce long-term water and maintenance costs by 40-60%."}",
    invasivePestPara: "${name} invasive pest concerns include ${metro.region === "northeast" || metro.region === "midwest" ? "spotted lanternfly, emerald ash borer, and Japanese beetle" : state === "FL" ? "Brazilian pepper, air potato vine, and invasive iguanas" : metro.region === "mountain" ? "Russian olive, salt cedar, and bark beetle" : "invasive species specific to the " + name + " region"}. The ${state} cooperative extension service publishes current invasive species alerts and management recommendations.",
    HOAAestheticPara: "${name} master-planned communities in ${m.neighborhoods[2]} have strict HOA landscape requirements. Established neighborhoods like ${m.neighborhoods[0]} and ${m.neighborhoods[1]} have character expectations enforced through zoning or neighborhood associations. ${state === "FL" ? "Florida statute limits HOA restrictions on Florida-Friendly landscaping." : ""}",
    treeServicePara: "${name} tree removal permits may be required for trees over ${state === "TX" ? "19 inches" : state === "FL" ? "6 inches" : "6-12 inches"} DBH depending on local ordinance. Licensed arborists charge $800-$3,500 per mature tree removal. ${m.neighborhoods[0]} lots with canopy ${m.trees.split(",")[0]} require specific root-zone protection during any landscape construction.",
    seasonalMaintenancePara: "${m.frost > 60 ? name + " landscape maintenance runs March through November with winter dormancy." : state === "FL" ? name + " requires year-round maintenance with peak growth March through October." : name + " maintenance peaks during the growing season with " + (m.frost > 20 ? "winter dormancy reducing the schedule" : "year-round attention needed") + "."} ${m.frost > 40 ? "Fall leaf cleanup, winter snow removal, and spring cleanup are the major seasonal tasks." : "Irrigation management and hurricane preparation (FL) are critical seasonal tasks."}",
    stormwaterPara: "${name} stormwater management requirements affect landscape design. ${m.rain > 40 ? "Rain gardens, bioswales, and permeable surfaces reduce runoff and may qualify for utility credits." : "Even in drier climates, stormwater management best practices protect foundations and prevent erosion."} ${m.neighborhoods[0]} and ${m.neighborhoods[1]} may have specific watershed protection overlays.",
    commonScamPara: "Common ${name} landscaping scams include: quoting non-native 'miracle' species at premium prices, over-applying chemicals without soil testing, and promising instant results from sod installation on unprepared subgrade. Always require soil test results before accepting amendment recommendations."
  },
`;
}

function generatePaintingData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    climateParaByUV: "${name} paint exposure is ${metro.region === "mountain" || state === "AZ" || state === "NM" ? "extreme UV at altitude" : state === "FL" ? "intense UV combined with tropical humidity" : m.frost > 60 ? "moderate UV but heavy freeze-thaw cycling and deicing salt" : "moderate UV with seasonal humidity variation"}. ${m.frost > 40 ? "South-facing facades lose gloss 30-40% faster than north-facing in " + name + "." : "West-facing walls degrade fastest in " + name + " due to afternoon sun exposure."} Exterior paint longevity in ${name} runs ${m.frost > 60 ? "5-7 years" : metro.region === "mountain" ? "4-6 years" : state === "FL" ? "5-8 years" : "6-8 years"} on properly prepped substrates.",
    sidingMaterialPara: "${name} exterior substrates include ${m.frost > 60 ? "vinyl siding, fiber cement (HardiePlank), wood clapboard, and brick" : state === "FL" ? "stucco, CBS block, fiber cement, and aluminum" : metro.region === "mountain" ? "stucco, fiber cement, wood lap, and stone veneer" : "vinyl, fiber cement, wood, and brick"} across neighborhoods like ${m.neighborhoods[0]} and ${m.neighborhoods[1]}. Each substrate requires specific primer and topcoat systems for optimal adhesion and longevity.",
    historicColorPalettePara: "${m.neighborhoods[0]} and ${m.neighborhoods[1]} ${m.frost > 40 ? "may include historic districts with color review requirements" : "have neighborhood character expectations that influence color choices"}. ${m.frost > 40 ? "Historic preservation commissions may require Benjamin Moore Historic Collection or Sherwin-Williams Preservation Palette codes." : "Regional color preferences in " + name + " trend toward " + (metro.region === "mountain" ? "earth tones matching desert and mountain landscapes" : state === "FL" ? "tropical and coastal palettes" : "traditional and contemporary palettes") + "."}",
    paintProductRecsPara: "Benjamin Moore Aura Exterior and Sherwin-Williams Duration Exterior are the ${name} baseline for residential repaint. ${metro.region === "mountain" ? "UV-resistant formulations with higher resin content are essential at altitude." : state === "FL" ? "Mildew-resistant formulations are mandatory in the tropical humidity." : "Standard premium acrylic latex handles the local climate well."} ${m.frost > 60 ? "Lead-encapsulating primers are a staple for pre-1978 housing stock." : ""}",
    prepCultureByEraPara: "${name} prep requirements vary by housing era. ${m.frost > 60 ? "Pre-1978 homes require EPA RRP-certified crews for any work disturbing lead paint." : ""} ${state === "FL" ? "Stucco prep requires pressure washing and elastomeric crack repair." : "Power washing, scraping, and spot-priming are standard prep steps."} ${m.neighborhoods[0]} older homes may have multiple paint layers requiring more aggressive preparation than newer ${m.neighborhoods[2]} construction.",
    permitAndLeadPara: "${m.frost > 40 ? "EPA RRP certification is mandatory for any painting contractor disturbing over 6 sqft of pre-1978 painted surface." : "EPA RRP rules apply to pre-1978 homes."} ${m.permit} handles permits for exterior work in historic districts. ${state === "FL" ? "Florida does not require painting contractor licensing but insurance verification is essential." : "Verify contractor licensing and insurance before signing."}",
    seasonalWindowPara: "${name} exterior painting season runs ${m.frost > 60 ? "mid-April through early November" : state === "FL" ? "year-round with the November-May dry season preferred" : "March through November"}. ${m.frost > 60 ? "Cold-weather exterior work below 50F requires specialty low-temperature latex." : "Summer heat above 90F can cause paint to blister if applied in direct sun."} ${m.rain > 45 ? "Afternoon rain in summer narrows the daily work window." : ""}",
    commonUpsellPara: "Common ${name} painting upsells include: cabinet painting ($3,500-$9,000 per kitchen), deck staining, and ${m.frost > 40 ? "exterior trim restoration with wood repair" : "pressure washing and concrete staining"} as add-on services. Legitimate premium upgrades include ${metro.region === "mountain" ? "UV-rated elastomeric coatings" : state === "FL" ? "mold-resistant coatings" : "high-build primers for rough substrates"}.",
    moistureAndMildewPara: "${m.rain > 45 ? name + "'s " + m.rain + " inches of annual rainfall creates aggressive mold and mildew conditions." : m.frost > 60 ? "North-facing shaded surfaces in " + name + " develop mold and efflorescence from winter moisture retention." : name + "'s " + m.rain + " inches of annual rainfall is " + (m.rain > 35 ? "moderate and requires attention to moisture management" : "low enough that moisture is a secondary concern") + "."} ${m.rain > 35 ? "Mildew-resistant additives and proper surface prep are essential in " + name + "." : ""}",
    coatingsCultureByClimate: "${name} coating preferences reflect the local climate: ${m.frost > 60 ? "high-build acrylic for freeze-thaw resistance, elastomeric for crack-bridging, and penetrating stains for wood" : state === "FL" ? "elastomeric for stucco crack-bridging, acrylic with mildewcide for humidity, and marine-grade for coastal exposure" : metro.region === "mountain" ? "UV-resistant high-resin acrylic, elastomeric for altitude expansion, and penetrating stains for wood" : "standard acrylic latex with appropriate primers for each substrate"}.",
    localPainterLandscapePara: "${name}'s painting market includes ${metro.region === "northeast" || metro.region === "west" ? "union and non-union crews with a 20-30% price spread" : "competitive independent crews"} operating in ${m.neighborhoods[0]}, ${m.neighborhoods[1]}, and surrounding areas. Verify insurance, references, and ${m.frost > 40 ? "EPA RRP certification on pre-1978 homes" : "proper licensing"}. Multi-room interior pricing in ${name} runs ${metro.region === "northeast" || metro.region === "west" ? "$3-$5 per sqft" : "$2-$4 per sqft"} including prep."
  },
`;
}

function generatePlumbingData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    waterUtilityPara: "${m.waterUtil} serves ${name}. ${m.waterUtil.includes("aquifer") || m.waterUtil.includes("Aquifer") ? "The groundwater source provides consistent quality year-round." : "The surface water source requires seasonal treatment adjustments."} Service line from the curb stop to the building is homeowner-responsible. Annual water quality reports are published by the utility.",
    hardnessAndSourcePara: "${name} water tests at ${m.hardness}. ${parseInt(m.hardness) > 150 ? "This hard water drives scale buildup in water heaters and fixtures, shortening water heater lifespan by 2-3 years without softening. Water softener installation ($1,500-$3,500) is a common paired scope." : "Relatively soft water means scale buildup is not a major concern for fixtures and water heaters."} The source ${m.waterUtil.includes("River") ? "river water" : m.waterUtil.includes("Lake") ? "lake water" : m.waterUtil.includes("aquifer") || m.waterUtil.includes("Aquifer") ? "groundwater" : "supply"} chemistry affects pipe corrosion rates and treatment needs.",
    sewerInfrastructurePara: "${name} ${m.frost > 60 ? "operates aging combined sewer systems in older neighborhoods that back up during heavy rain" : state === "FL" ? "uses separated sanitary and storm sewer systems, but high water tables create infiltration issues" : "sewer infrastructure varies by neighborhood age"}. ${m.frost > 60 ? "Backwater valves and sump pumps are standard " + name + " retrofits." : state === "FL" ? "Grinder pump systems serve low-elevation neighborhoods." : "Sewer line inspection with video camera ($200-$400) is recommended before purchasing older homes."}",
    pipeMaterialByEraPara: "${name} pre-1960 homes may still have ${m.frost > 60 ? "lead service lines, galvanized steel supply, and cast-iron drain lines" : state === "FL" ? "galvanized supply and polybutylene (PB) drain lines" : "galvanized supply lines and cast-iron drains"}. Post-1970 homes typically have copper supply. Modern retrofits use PEX-a (Uponor AquaPEX) for supply and ABS or PVC for drain-waste-vent. ${m.neighborhoods[0]} and ${m.neighborhoods[1]} housing stock reflects distinct pipe-material eras.",
    permitAndLicensePara: "${m.permit} handles plumbing permits. ${state === "TX" ? "Texas State Board of Plumbing Examiners licenses Master and Journeyman Plumbers." : state === "FL" ? "Florida DBPR licenses plumbing contractors." : state === "CA" ? "California requires a C-36 Plumbing Contractor license." : "State plumbing licensing applies."} Only licensed plumbers can legally pull permits and perform work. Verify license status through the state licensing board before signing.",
    stormwaterAndSewerPara: "${name} receives ${m.rain} inches of annual precipitation. ${m.rain > 45 ? "Heavy rainfall regularly overwhelms aging storm drains and causes basement or crawlspace flooding." : m.rain < 20 ? "Low rainfall means storm drainage is a secondary concern, but flash-flood events can overwhelm gutters and drains." : "Moderate rainfall requires standard storm drainage maintenance."} French drains, sump pumps, and proper grading protect against foundation water intrusion.",
    waterHeaterCulturePara: "${name} water heater preferences lean toward ${state === "TX" || state === "FL" ? "40-50 gallon gas or electric tank heaters" : m.frost > 60 ? "high-efficiency condensing gas tank heaters" : "standard tank and tankless options"}. Tankless units (Rinnin, Navien) gain market share in ${m.neighborhoods[0]} and ${m.neighborhoods[1]}. ${parseInt(m.hardness) > 150 ? "Hard water reduces tank heater lifespan to 6-8 years without softening; budget accordingly." : "Standard 10-12 year tank heater lifespan is realistic in " + name + "'s water chemistry."}",
    winterizationPara: "${m.frost > 60 ? name + " freeze protection is critical November through March. Exposed pipes in attics, crawlspaces, and exterior walls require insulation wraps or heat tape. Hose bibs need frost-free anti-siphon valves." : m.frost > 20 ? name + " experiences occasional hard freezes that can burst unprotected pipes. Insulating exposed pipes and disconnecting hoses before freeze events prevents damage." : "Freeze risk is minimal in " + name + " but occasional cold snaps warrant basic precautions on exposed pipes."}",
    emergencyRepairPara: "${name} emergency plumbing rates run ${metro.region === "northeast" || metro.region === "west" ? "$175-$350 per hour" : "$125-$250 per hour"} for after-hours service. ${m.frost > 60 ? "Burst-pipe emergencies spike during polar vortex events." : state === "FL" ? "Slab leak repairs are a common emergency category." : "Sewer line backups and water heater failures are the most common emergency calls."} Keep a licensed plumber's contact information on hand before emergencies occur.",
    wellAndSepticPara: "${name} ${state === "FL" || metro.region === "mountain" ? "exurban properties may rely on private wells and septic systems" : "is predominantly served by municipal water and sewer"}. Well-and-septic properties require additional maintenance including annual well water testing and septic tank pumping every 3-5 years. ${m.neighborhoods[2]} may include properties on well systems.",
    commonIssuesPara: "Common ${name} plumbing issues include: ${m.frost > 60 ? "frozen pipes in winter, galvanized-to-copper corrosion at transition fittings, and basement sump pump failures" : state === "FL" ? "polybutylene pipe failures, slab leaks on aging copper, and high-water-table sump issues" : "galvanized pipe corrosion, water heater failure from hard water, and sewer line root intrusion"}. Annual whole-house plumbing inspection ($200-$350) catches issues before they become emergencies.",
    localScamPara: "Common ${name} plumbing scams include: quoting full repipe on a single-fixture issue, unnecessary water softener upsells on ${parseInt(m.hardness) > 150 ? "legitimately hard but manageable water" : "already-soft water"}, and drain-cleaning services that recommend full sewer replacement without video inspection. Always require video evidence before approving sewer line work."
  },
`;
}

function generateRoofData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    sec_climate: \`${name} experiences ${m.frost > 60 ? m.frost + " freeze-thaw cycles annually, heavy snow loading in winter, and summer thunderstorms that deliver wind and hail" : state === "FL" ? "zero freeze-thaw but hurricane-force winds, intense UV year-round, and tropical moisture that drives algae growth on north-facing surfaces" : metro.region === "mountain" ? "high-altitude UV exposure, " + m.frost + " freeze-thaw cycles, and hailstorms along the Front Range corridor" : "moderate " + m.frost + " freeze-thaw cycles, " + m.rain + " inches of annual precipitation, and seasonal severe weather"}. ${m.neighborhoods[0]} and ${m.neighborhoods[1]} properties face the full spectrum of local weather exposure.\`,
    sec_code: \`${m.permit} handles permits for residential replacement work in ${name}. ${state === "TX" ? "Texas Department of Insurance (TDI) windstorm certification applies in coastal counties." : state === "FL" ? "Florida Building Code Section 1507 with HVHZ requirements applies in designated zones." : "Local building code adopts IBC/IRC standards."} ${m.neighborhoods[0]} historic districts may require preservation commission approval of materials and colors. Licensed contractors must pull permits before work begins.\`,
    sec_insurance: \`${name} homeowners insurance covers sudden damage from ${m.frost > 60 ? "wind, ice, and fallen trees" : state === "FL" ? "hurricane wind damage under the wind-only policy" : "wind, hail, and fallen trees"} but not gradual wear. Document damage within 72 hours of any storm event. ${state === "FL" ? "Florida Assignment of Benefits (AOB) reform affects how contractors interact with insurance claims." : "Replacement cost coverage versus actual cash value significantly affects claim payouts."} Average replacement cost in ${name} runs ${metro.region === "northeast" || metro.region === "west" ? "$12,000-$22,000" : "$8,000-$16,000"} for a typical single-family home.\`,
    sec_contractor: \`${name} contractor vetting requires verifying ${state === "TX" ? "TDLR registration" : state === "FL" ? "Florida DBPR contractor license" : state === "CA" ? "CSLB C-39 Roofing Contractor license" : "state contractor licensing"}, insurance coverage, and local business registration. ${m.neighborhoods[0]} and ${m.neighborhoods[1]} have active contractor networks. Storm-chaser firms from out of state appear after major weather events; verify local presence and permanent office before signing. Labor rates in ${name} run ${metro.region === "northeast" || metro.region === "west" ? "15-30% above" : "at or near"} national averages.\`,
    sec_material: \`Dominant materials in ${name} are ${m.frost > 60 ? "asphalt architectural shingles (Owens Corning Duration, GAF Timberline HDZ) with ice-and-water shield at eaves and valleys" : state === "FL" ? "concrete and clay tile plus impact-rated asphalt shingles meeting Florida Building Code wind-uplift requirements" : metro.region === "mountain" ? "Class 4 impact-rated architectural shingles, concrete tile, and standing-seam metal" : "asphalt architectural shingles, with metal and tile gaining share"}. Material selection in ${m.neighborhoods[0]} and ${m.neighborhoods[1]} reflects both architectural character and local weather exposure.\`,
    coverage: \`${name} coverage considerations include ${m.frost > 60 ? "ice dam protection, proper attic ventilation for moisture control, and high-wind resistance in exposed locations" : state === "FL" ? "hurricane wind-uplift resistance, proper underlayment for tropical moisture, and algae-resistant shingle selection" : "ventilation balance, weather-resistive barrier integrity, and flashing details at penetrations"}.\`,
    dominantMaterial: "${m.frost > 60 ? "asphalt architectural shingle" : state === "FL" ? "concrete tile and impact-rated asphalt" : metro.region === "mountain" ? "Class 4 impact-rated asphalt" : "asphalt architectural shingle"}",
    climateBand: "${m.frost > 60 ? "cold/heavy snow" : state === "FL" ? "tropical/hurricane" : metro.region === "mountain" ? "high altitude/hail" : m.frost > 20 ? "mixed/moderate" : "warm/humid"}",
    bestSeasons: "${m.frost > 60 ? "May-October" : state === "FL" ? "November-May" : "March-November"}",
    worstSeasons: "${m.frost > 60 ? "December-March" : state === "FL" ? "June-November (hurricane season)" : "Peak summer heat months"}"
  },
`;
}

function generateSidingData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    sec_material: \`${name} siding choices center on ${m.frost > 60 ? "vinyl, fiber cement (HardiePlank), and wood clapboard" : state === "FL" ? "stucco, fiber cement, and aluminum" : metro.region === "mountain" ? "fiber cement, stucco, and engineered wood" : "vinyl, fiber cement, and wood"} across neighborhoods like ${m.neighborhoods[0]} and ${m.neighborhoods[1]}. ${state === "FL" ? "CBS block construction in older neighborhoods requires masonry repair rather than siding replacement." : m.frost > 60 ? "Brick masonry on older homes requires repointing rather than siding installation." : "Each substrate demands specific installation and maintenance approaches."}\`,
    type: "residential",
    sec_climate: \`${name} siding faces ${m.frost > 60 ? "severe freeze-thaw cycling, deicing salt carryover, and heavy precipitation that drives moisture behind improperly flashed panels" : state === "FL" ? "intense UV, tropical moisture, hurricane wind loads, and salt-air corrosion in coastal zones" : metro.region === "mountain" ? "intense high-altitude UV, hailstorms, and wide daily temperature swings that stress fasteners" : "moderate seasonal weather with " + m.rain + " inches of annual precipitation"}. Moisture management behind siding is the primary failure pattern in ${name}.\`,
    pattern: "standard residential lap",
    sec_code: \`${m.permit} handles siding permits. ${state === "FL" ? "Florida Building Code requires wind-load-rated siding products in HVHZ zones." : m.frost > 60 ? "Local energy codes may require continuous insulation under new siding installations." : "Standard building codes apply."} Historic district overlays in ${m.neighborhoods[0]} may restrict material choices. Licensed contractors must pull permits for full re-siding projects.\`,
    sec_insurance: \`${name} homeowners insurance covers sudden siding damage from ${m.frost > 60 ? "wind, ice, and hail" : state === "FL" ? "hurricane wind damage" : "wind and hail"} but not gradual wear or maintenance failure. Document damage with photos within 72 hours. ${state === "FL" ? "Florida Assignment of Benefits (AOB) reform affects contractor-insurance interactions." : "Replacement cost versus actual cash value coverage drives claim economics."}\`,
    sec_contractor: \`${name} siding contractor vetting requires ${state === "TX" ? "verification through the Texas Department of Licensing and Regulation" : state === "FL" ? "Florida DBPR general or specialty contractor license" : "state contractor licensing verification"} plus insurance and local business registration. ${m.neighborhoods[0]} and ${m.neighborhoods[1]} have established contractor networks. Labor rates in ${name} run ${metro.region === "northeast" || metro.region === "west" ? "15-30% above" : "at or near"} national averages.\`,
    verification: "license plus insurance verification",
    sec_flag: \`${name} siding red flags include: bids that skip moisture barrier (weather-resistive barrier) replacement, vinyl quotes without expansion-joint allowances, and fiber cement installation without manufacturer-required caulking and priming of cut ends. Storm-chaser firms appear after severe weather; verify local presence.\`,
    substitution: "material substitution after contract signing",
    dominantMaterial: "${m.frost > 60 ? "vinyl and fiber cement" : state === "FL" ? "stucco and fiber cement" : metro.region === "mountain" ? "fiber cement and stucco" : "vinyl and fiber cement"}",
    climateBand: "${m.frost > 60 ? "cold/freeze-thaw" : state === "FL" ? "tropical/hurricane" : metro.region === "mountain" ? "high altitude/hail" : "moderate/mixed"}",
    bestSeasons: "${m.frost > 60 ? "May-October" : state === "FL" ? "November-May" : "March-November"}",
    worstSeasons: "${m.frost > 60 ? "December-March" : state === "FL" ? "June-November (hurricane season)" : "Peak summer heat"}"
  },
`;
}

function generateSolarData(slug, name, state, metro) {
  const m = M[slug];
  const psh = metro.region === "mountain" || state === "AZ" || state === "NM" ? 5.5 : state === "FL" || state === "TX" ? 4.8 : metro.region === "west" ? 4.5 : m.frost > 60 ? 3.8 : 4.2;
  const payback = state === "CA" ? "5-7 years" : metro.region === "mountain" ? "6-8 years" : state === "TX" ? "9-12 years" : state === "FL" ? "8-11 years" : m.frost > 60 ? "8-11 years" : "7-10 years";
  return `  "${slug}": {
    peakSunHours: ${psh},
    paybackYears: "${payback}",
    utility: "${m.utility}",
    bestInstallMonth: "${m.frost > 40 ? "March-May" : "October-February"}",
    sunPara: "${name} averages ${psh} peak sun hours daily with strong seasonal production variation. ${metro.region === "mountain" || state === "AZ" ? "High-altitude clear skies deliver excellent solar resource year-round." : state === "FL" ? "Afternoon thunderstorms from June through September clip 10-15% off theoretical summer production." : m.frost > 60 ? "Winter production drops to 1.8-2.5 kWh per kW per day because of shortened days and cloud cover." : "Production peaks June through August and drops in winter months."} ${m.neighborhoods[0]} and ${m.neighborhoods[2]} receive varying insolation based on tree coverage and building orientation.",
    tariffPara: "${state === "TX" ? name + " operates in the deregulated ERCOT retail market. No statewide net metering mandate exists. Solar buyback plans from retail providers credit exported energy at $0.04-$0.09 per kWh against retail rates." : state === "FL" ? name + " operates under Florida net metering rules with 1-for-1 retail-rate credits for exported energy." : state === "CA" ? name + " falls under California NEM 3.0 tariff which significantly reduces export credit value versus the legacy NEM 2.0 program." : m.utility.includes("Municipal") || m.utility.includes("municipal") ? name + "'s municipal utility offers its own net metering program that may differ from IOU tariffs." : name + " residential solar operates under the state's net metering framework with " + m.utility.split(" (")[0] + " handling interconnection."}",
    interconnectPara: "${m.utility.split(" (")[0]} interconnection for residential systems runs 4-12 weeks depending on system size and feeder capacity. ${m.permit} issues the electrical and building permits. ${m.neighborhoods[0]} and ${m.neighborhoods[2]} may have different hosting capacity on their local feeders.",
    installerLandscapePara: "The ${name} installer market includes national players (Sunrun, Tesla Energy, Freedom Forever) and strong regional firms. ${state === "CA" ? "California CSLB C-46 Solar or C-10 Electrical license is required." : state === "TX" ? "Texas TDLR electrical contractor license is required." : "State electrical contractor licensing applies."} Typical ${name} residential quote runs ${metro.region === "northeast" || metro.region === "west" ? "$3.20-$4.00" : "$2.80-$3.60"} per watt before incentives.",
    incentivesPara: "The 30% federal Investment Tax Credit (Section 25D) is the anchor incentive. ${state === "CA" ? "California exempts solar from property tax reassessment through 2026 and offers SGIP battery storage rebates." : state === "TX" ? "Texas offers no state tax credit or rebate; the federal ITC plus local utility buyback rates drive economics." : state === "FL" ? "Florida exempts solar from sales tax and property tax through 2037." : "State-level incentives vary; check with " + m.utility.split(" (")[0] + " for current rebate programs."} Combined incentives can reduce a $24,000 system to $12,000-$16,000 effective cost.",
    roofLandscapePara: "${name} rooftop stock is ${state === "FL" ? "primarily concrete tile and composition shingle, with tile requiring specialty mounting hardware that adds 15-25% to installation cost" : m.frost > 60 ? "primarily composition shingle with some slate and flat-membrane on older homes" : metro.region === "mountain" ? "primarily composition shingle with tile in Southwest-influenced neighborhoods" : "primarily composition shingle with flat-membrane on commercial-adjacent multifamily"}. ${m.neighborhoods[0]} roof types may differ from ${m.neighborhoods[2]} based on construction era.",
    hoaAndRestrictPara: "${state === "CA" ? "California Civil Code Section 714 (Solar Rights Act) prohibits HOAs from banning solar installations." : state === "TX" ? "Texas Property Code Section 202.010 prevents HOAs from prohibiting solar but allows reasonable placement restrictions." : state === "FL" ? "Florida statute 163.04 prevents HOAs from prohibiting solar installations." : name + " HOA restrictions on solar vary; review CC&Rs carefully."} Master-planned communities in ${m.neighborhoods[2]} may have architectural review requirements that delay but cannot prevent installation.",
    permitProcessPara: "${m.permit} issues solar permits through the ${metro.region === "northeast" ? "standard plan review process in 2-6 weeks" : "online portal in 1-3 weeks for standard residential installs"}. ${m.neighborhoods[0]} historic district parcels may require additional preservation review. ${state === "CA" ? "California Solar Permitting Guidebook standards apply." : ""}",
    batteryPara: "Battery storage in ${name} is driven primarily by ${state === "FL" ? "hurricane-season outage resilience" : m.frost > 60 ? "winter storm outage protection" : state === "TX" ? "ERCOT grid reliability concerns after Winter Storm Uri" : "resilience and potential time-of-use rate arbitrage"}. Tesla Powerwall 3 and Enphase IQ Battery are the dominant residential products. ${state === "CA" ? "California SGIP provides $150-$1,000 per kWh storage rebate." : "Federal ITC applies to battery storage paired with solar."}",
    climateRiskPara: "${name} solar climate risks include ${m.frost > 60 ? "snow loading, wind uplift during winter storms, and hail damage" : state === "FL" ? "hurricane wind uplift exceeding 150 mph design loads, coastal salt spray corrosion, and summer lightning" : metro.region === "mountain" ? "high-altitude UV degradation, severe hailstorms, and occasional high winds" : "seasonal severe weather and occasional hail"}. Module racking must be spec'd for the local wind and snow load zone. ${state === "FL" ? "Florida Product Approval is required for all mounting hardware." : ""}",
    timelinePara: "Full timeline from contract to Permission to Operate in ${name} runs ${metro.region === "northeast" ? "14-22 weeks" : "8-16 weeks"}: site assessment, permitting, installation, inspection, and utility interconnection. The ${m.frost > 40 ? "March-May" : "October-February"} installation window targets peak production months.",
    uniqueInsightPara: "${name}'s solar market benefits from ${state === "TX" ? "competitive retail electricity rates that shape the self-consumption optimization strategy" : state === "FL" ? "strong net metering and state tax exemptions that improve payback" : state === "CA" ? "the strongest solar policy framework in the country despite NEM 3.0 export rate reductions" : m.frost > 60 ? "growing cold-climate solar adoption as panel efficiency improves" : "favorable solar resource and improving economics as equipment costs decline"}. ${m.utility.split(" (")[0]} ${state === "TX" ? "competitive retail providers" : "utility programs"} shape the local incentive landscape."
  },
`;
}

function generateWindowData(slug, name, state, metro) {
  const m = M[slug];
  return `  "${slug}": {
    sec_energy: \`${name} sits in IECC climate zone ${INSULATION_EXTRAS[slug]?.ieccZone || "4A"}, ${m.frost > 60 ? "a heating-dominant zone where window thermal performance directly affects winter energy bills" : state === "FL" ? "a cooling-dominant zone where Solar Heat Gain Coefficient (SHGC) control is the primary energy concern" : "a mixed zone where both heating and cooling performance matter"}. ENERGY STAR v7 targets ${name} replacement windows at ${m.frost > 60 ? "U-factor 0.27 maximum and SHGC 0.40 maximum" : state === "FL" ? "U-factor 0.40 maximum and SHGC 0.25 maximum" : "U-factor 0.30 maximum and SHGC 0.40 maximum"}. ${m.utility.split(" (")[0]} may offer $50-$75 per window rebates for qualifying ENERGY STAR installations.\`,
    sec_energy2: \`${m.frost > 60 ? name + " buildings with older single-pane windows lose significant heat through glass conductance. Triple-pane IGUs raise interior surface temperature above 60F and eliminate condensation damage on frames." : state === "FL" ? name + " windows must handle intense solar heat gain. Low-E coatings with SHGC below 0.25 on west and south exposures reduce cooling loads 15-25%." : name + " benefits from Low-E coatings that balance heating-season solar gain with summer heat rejection."} Whole-house window replacement in ${name} typically reduces HVAC energy use ${m.frost > 60 ? "15-25%" : "10-20%"} versus single-pane or failed-seal IGU windows.\`,
    sec_installer: \`${name} installer vetting requires ${state === "TX" ? "verification of TDLR registration" : state === "FL" ? "Florida DBPR contractor license verification" : state === "CA" ? "CSLB C-17 Glazing Contractor license" : "state contractor licensing"}, workers' compensation coverage, and manufacturer certification (Andersen, Pella, or Marvin dealer networks). ${m.neighborhoods[0]} and ${m.neighborhoods[1]} have established installer networks. Labor in ${name} runs ${metro.region === "northeast" || metro.region === "west" ? "15-30% above" : "at or near"} national averages per opening.\`,
    sec_glass: \`${name} glass packages should target ${m.frost > 60 ? "triple-pane with Low-E 272 on south exposures (passive, maximizing solar gain) and Low-E 366 on west exposures (solar control)" : state === "FL" ? "double-pane with impact-rated laminated glass and Low-E 366 solar control coating" : "double-pane with Low-E coatings appropriate to the exposure direction"}. Argon fill is baseline; krypton fill upgrades performance on triple-pane. ${state === "FL" ? "Hurricane impact rating (large-missile test per ASTM E1886/E1996) is mandatory in HVHZ zones." : ""}\`,
    sec_code: \`${m.permit} handles window replacement permits. ${state === "FL" ? "Florida Building Code requires impact-rated or protected openings in HVHZ zones." : m.frost > 60 ? "Local energy codes require ENERGY STAR-qualifying U-factor and SHGC on replacement windows." : "Standard building codes apply."} Historic districts in ${m.neighborhoods[0]} may require preservation commission approval of window style and material. ${m.frost > 40 ? "EPA RRP certification is required for pre-1978 window replacement." : ""}\`,
    sec_housing: \`${name} housing stock includes ${m.frost > 60 ? "pre-war homes with original wood double-hung windows, mid-century homes with aluminum single-pane, and modern construction with vinyl or fiberglass" : state === "FL" ? "CBS construction with aluminum single-hung windows, newer vinyl and impact-rated aluminum" : "a range of eras with wood, aluminum, and vinyl windows"}. ${m.neighborhoods[0]} and ${m.neighborhoods[1]} represent distinct housing eras with different window replacement needs.\`,
    sec_storm: \`${name} storm considerations include ${m.frost > 60 ? "winter wind pressure, ice loading on frames, and temperature differential stress on seals" : state === "FL" ? "hurricane-force wind loads requiring impact-rated glass or approved shuttering systems" : "seasonal severe weather including wind and occasional hail"}. ${state === "FL" ? "Florida Product Approval or Miami-Dade NOA is required for all window products in HVHZ zones." : "Impact-rated glass is available for storm-prone locations."}\`,
    sec_flag: \`${name} window replacement red flags: bids without specified U-factor and SHGC values, single-brand-only quotes without competitive alternatives, lifetime warranty claims without documented transferability, and ${state === "FL" ? "products lacking Florida Product Approval in hurricane zones" : "failure to address lead paint on pre-1978 homes"}. Always get three quotes with identical specifications for comparison.\`,
    dominantMaterial: "${m.frost > 60 ? "vinyl and fiberglass" : state === "FL" ? "impact-rated aluminum and vinyl" : "vinyl and fiberglass"}",
    climateBand: "${m.frost > 60 ? "cold/heating-dominant" : state === "FL" ? "hot/cooling-dominant" : "mixed/moderate"}",
    uTarget: "${m.frost > 60 ? "0.27" : state === "FL" ? "0.40" : "0.30"}",
    shgcTarget: "${m.frost > 60 ? "0.40" : state === "FL" ? "0.25" : "0.40"}",
    bestSeasons: "${m.frost > 60 ? "April-October" : "Year-round"}",
    worstSeasons: "${m.frost > 60 ? "December-February (cold weather affects caulking)" : state === "FL" ? "Hurricane season (June-November)" : "Extreme temperature days"}"
  },
`;
}

// Run the expansion after all data and functions are defined
runExpansion();
