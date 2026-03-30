/**
 * Build per-city cost multipliers from BEA Regional Price Parities (RPP).
 *
 * Reads MARPP_MSA_2008_2024.csv and maps each of our 739 cities to the
 * nearest MSA. Produces data/city-cost-multipliers.json with a multiplier
 * per city (1.0 = national average).
 *
 * RPP "All Items" index: 100 = national average. A city with RPP 112 gets
 * multiplier 1.12, meaning costs are 12% above national average.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RPP_CSV = path.join(ROOT, "data", "bls", "marpp", "MARPP_MSA_2008_2024.csv");
const CITIES_CSV = path.join(ROOT, "inputs", "cities.csv");
const STATE_REGIONS = path.join(ROOT, "data", "state-regions.json");
const OUTPUT = path.join(ROOT, "data", "city-cost-multipliers.json");

// Parse CSV
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const vals = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (c === ',' && !inQuotes) { vals.push(current.trim()); current = ""; continue; }
      current += c;
    }
    vals.push(current.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  });
}

// Extract city name from MSA name like "Dallas-Fort Worth-Arlington, TX"
function extractMsaCities(msaName) {
  const match = msaName.match(/^(.+?),\s*([A-Z]{2}(?:-[A-Z]{2})*)/);
  if (!match) return { cities: [], states: [] };
  const cityPart = match[1];
  const statePart = match[2];
  const cities = cityPart.split(/[-\/]/).map(c => c.trim().replace(/ Town$| City$/, ""));
  const states = statePart.split("-");
  return { cities, states };
}

// Normalize city name for matching
function normalize(name) {
  return name.toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  // 1. Parse RPP data - get latest year (2024) "All items" RPP per MSA
  const rppRows = parseCsv(fs.readFileSync(RPP_CSV, "utf8"));
  const msaRpp = {};

  for (const row of rppRows) {
    // Only "All items" line (LineCode 1)
    if (row.LineCode !== "1") continue;
    const geoName = row.GeoName || "";
    if (!geoName.includes("Metropolitan")) continue;

    // Use 2024 data (latest), fall back to 2023
    let rpp = parseFloat(row["2024"]);
    if (isNaN(rpp)) rpp = parseFloat(row["2023"]);
    if (isNaN(rpp)) continue;

    // Clean MSA name
    const cleanName = geoName.replace(/\s*\(Metropolitan Statistical Area\)/, "").trim();
    msaRpp[cleanName] = rpp;
  }

  console.log(`Loaded ${Object.keys(msaRpp).length} MSA RPP values`);

  // 2. Build a lookup: for each city name + state, find matching MSA
  // Create index of city -> MSA mappings
  const cityToMsa = {};
  for (const [msaName, rpp] of Object.entries(msaRpp)) {
    const { cities, states } = extractMsaCities(msaName);
    for (const city of cities) {
      for (const st of states) {
        const key = normalize(city) + "|" + st;
        cityToMsa[key] = { msaName, rpp };
      }
    }
  }

  // 3. Parse our cities list
  const citiesCsv = fs.readFileSync(CITIES_CSV, "utf8");
  const cities = parseCsv(citiesCsv);
  const stateRegions = JSON.parse(fs.readFileSync(STATE_REGIONS, "utf8"));

  // Region-level fallback RPPs (computed from MSA averages)
  const regionRpps = {};
  const regionCounts = {};
  for (const [msaName, rpp] of Object.entries(msaRpp)) {
    const { states } = extractMsaCities(msaName);
    for (const st of states) {
      const region = stateRegions[st];
      if (region) {
        regionRpps[region] = (regionRpps[region] || 0) + rpp;
        regionCounts[region] = (regionCounts[region] || 0) + 1;
      }
    }
  }
  for (const region of Object.keys(regionRpps)) {
    regionRpps[region] = Math.round((regionRpps[region] / regionCounts[region]) * 100) / 100;
  }
  console.log("Region average RPPs:", regionRpps);

  // 4. Map each of our 739 cities to an RPP multiplier
  const result = {};
  let matched = 0;
  let stateMatched = 0;
  let regionFallback = 0;

  for (const city of cities) {
    const cityName = city.city;
    const stateCode = city.state_code;
    const key = normalize(cityName) + "|" + stateCode;

    let rpp;
    let source;

    if (cityToMsa[key]) {
      // Direct city match
      rpp = cityToMsa[key].rpp;
      source = "msa_direct";
      matched++;
    } else {
      // Try fuzzy: check if city name is contained in any MSA name for this state
      let found = false;
      const normCity = normalize(cityName);
      for (const [msaName, msaRppVal] of Object.entries(msaRpp)) {
        const { states } = extractMsaCities(msaName);
        if (!states.includes(stateCode)) continue;
        const normMsa = normalize(msaName);
        if (normMsa.includes(normCity) || normCity.includes(normalize(msaName.split(",")[0].split("-")[0]))) {
          rpp = msaRppVal;
          source = "msa_fuzzy";
          found = true;
          stateMatched++;
          break;
        }
      }

      if (!found) {
        // Fall back to state's average MSA RPP or region average
        // Find all MSAs in this state
        const stateMsas = [];
        for (const [msaName, msaRppVal] of Object.entries(msaRpp)) {
          const { states } = extractMsaCities(msaName);
          if (states.includes(stateCode)) {
            stateMsas.push(msaRppVal);
          }
        }
        if (stateMsas.length > 0) {
          rpp = stateMsas.reduce((a, b) => a + b, 0) / stateMsas.length;
          source = "state_avg";
          stateMatched++;
        } else {
          const region = stateRegions[stateCode] || "south";
          rpp = regionRpps[region] || 100;
          source = "region_avg";
          regionFallback++;
        }
      }
    }

    const multiplier = Math.round((rpp / 100) * 1000) / 1000;
    result[`${cityName}|${stateCode}`] = {
      multiplier,
      rpp: Math.round(rpp * 10) / 10,
      source
    };
  }

  console.log(`\nMatching results:`);
  console.log(`  Direct MSA match: ${matched}`);
  console.log(`  State-level match: ${stateMatched}`);
  console.log(`  Region fallback: ${regionFallback}`);
  console.log(`  Total cities: ${cities.length}`);

  // 5. Write output
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), "utf8");
  console.log(`\nWrote ${OUTPUT}`);

  // Show some examples
  console.log("\nSample multipliers:");
  const samples = ["New York|NY", "San Francisco|CA", "Dallas|TX", "Birmingham|AL", "Boise|ID", "Miami|FL", "Chicago|IL", "Denver|CO", "Seattle|WA", "Jackson|MS"];
  for (const key of samples) {
    const v = result[key];
    if (v) console.log(`  ${key}: ${v.multiplier} (RPP ${v.rpp}, ${v.source})`);
  }
}

main();
