/**
 * Build blended city cost multipliers combining:
 * - BLS trade-specific wages (labor component, ~55% of project cost)
 * - BEA Regional Price Parities (materials/overhead component, ~45%)
 *
 * Produces data/city-cost-multipliers.json (replaces the RPP-only version)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TRADE_WAGES = path.join(ROOT, "data", "trade-wages-by-metro.json");
const RPP_CSV = path.join(ROOT, "data", "bls", "marpp", "MARPP_MSA_2008_2024.csv");
const CITIES_CSV = path.join(ROOT, "inputs", "cities.csv");
const STATE_REGIONS = path.join(ROOT, "data", "state-regions.json");
const OUTPUT = path.join(ROOT, "data", "city-cost-multipliers.json");

const LABOR_WEIGHT = 0.55;
const MATERIALS_WEIGHT = 0.45;

// Service-specific trade mappings (which trades drive each service's labor cost)
const SERVICE_TRADE_WEIGHTS = {
  roofing: { roofers: 1.0, construction_laborers: 0.5, sheet_metal_workers: 0.3 },
  hvac: { hvac_mechanics: 1.0, sheet_metal_workers: 0.5, electricians: 0.3 },
  plumbing: { plumbers: 1.0, construction_laborers: 0.3 },
  electrical: { electricians: 1.0, construction_laborers: 0.2 },
  painting: { painters: 1.0, construction_laborers: 0.3 },
  concrete: { cement_masons: 1.0, construction_laborers: 0.5 },
  siding: { carpenters: 0.8, drywall_installers: 0.5, construction_laborers: 0.3 },
  insulation: { drywall_installers: 0.8, construction_laborers: 0.5 },
  fencing: { carpenters: 0.8, construction_laborers: 0.5 },
  landscaping: { construction_laborers: 1.0 },
  foundation: { cement_masons: 0.8, construction_laborers: 0.5 },
  windows: { carpenters: 0.8, construction_laborers: 0.3 },
  "garage-doors": { carpenters: 0.5, electricians: 0.3, construction_laborers: 0.3 },
  solar: { electricians: 1.0, construction_laborers: 0.5 },
  kitchen: { carpenters: 0.6, plumbers: 0.4, electricians: 0.4, painters: 0.3 },
};

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

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function extractMsaCities(msaName) {
  const match = msaName.match(/^(.+?),\s*([A-Z]{2}(?:-[A-Z]{2})*)/);
  if (!match) return { cities: [], states: [] };
  return {
    cities: match[1].split(/[-\/]/).map(c => c.trim().replace(/ Town$| City$/, "")),
    states: match[2].split("-")
  };
}

function main() {
  const tradeData = JSON.parse(fs.readFileSync(TRADE_WAGES, "utf8"));
  const stateRegions = JSON.parse(fs.readFileSync(STATE_REGIONS, "utf8"));
  const cities = parseCsv(fs.readFileSync(CITIES_CSV, "utf8"));

  // Parse RPP data
  const rppRows = parseCsv(fs.readFileSync(RPP_CSV, "utf8"));
  const msaRpp = {};
  for (const row of rppRows) {
    if (row.LineCode !== "1") continue;
    const geoName = row.GeoName || "";
    if (!geoName.includes("Metropolitan")) continue;
    let rpp = parseFloat(row["2024"]);
    if (isNaN(rpp)) rpp = parseFloat(row["2023"]);
    if (isNaN(rpp)) continue;
    const cleanName = geoName.replace(/\s*\(Metropolitan Statistical Area\)/, "").trim();
    msaRpp[cleanName] = rpp;
  }

  // Build city -> MSA mapping for trade wages
  const cityToTradesMsa = {};
  for (const msaName of Object.keys(tradeData.metros)) {
    const { cities: msaCities, states } = extractMsaCities(msaName);
    for (const c of msaCities) {
      for (const st of states) {
        cityToTradesMsa[normalize(c) + "|" + st] = msaName;
      }
    }
  }

  // Build city -> MSA mapping for RPP
  const cityToRppMsa = {};
  for (const msaName of Object.keys(msaRpp)) {
    const { cities: msaCities, states } = extractMsaCities(msaName);
    for (const c of msaCities) {
      for (const st of states) {
        cityToRppMsa[normalize(c) + "|" + st] = msaName;
      }
    }
  }

  // Compute state-level averages for fallback
  const stateAvgLabor = {};
  const stateAvgRpp = {};
  const stateLaborCounts = {};
  const stateRppCounts = {};

  for (const [msaName, metro] of Object.entries(tradeData.metros)) {
    const { states } = extractMsaCities(msaName);
    for (const st of states) {
      if (!stateAvgLabor[st]) { stateAvgLabor[st] = 0; stateLaborCounts[st] = 0; }
      stateAvgLabor[st] += metro.compositeMultiplier;
      stateLaborCounts[st]++;
    }
  }
  for (const st of Object.keys(stateAvgLabor)) {
    stateAvgLabor[st] = Math.round((stateAvgLabor[st] / stateLaborCounts[st]) * 1000) / 1000;
  }

  for (const [msaName, rpp] of Object.entries(msaRpp)) {
    const { states } = extractMsaCities(msaName);
    for (const st of states) {
      if (!stateAvgRpp[st]) { stateAvgRpp[st] = 0; stateRppCounts[st] = 0; }
      stateAvgRpp[st] += rpp;
      stateRppCounts[st]++;
    }
  }
  for (const st of Object.keys(stateAvgRpp)) {
    stateAvgRpp[st] = Math.round((stateAvgRpp[st] / stateRppCounts[st]) * 10) / 10;
  }

  // Process each of our 739 cities
  const result = {};
  let directBoth = 0, directOne = 0, stateLevel = 0;

  for (const city of cities) {
    const cityName = city.city;
    const stateCode = city.state_code;
    const key = normalize(cityName) + "|" + stateCode;

    // Find labor multiplier
    let laborMult = 1.0;
    let laborSource = "default";
    const tradeMsaName = cityToTradesMsa[key];
    if (tradeMsaName && tradeData.metros[tradeMsaName]) {
      laborMult = tradeData.metros[tradeMsaName].compositeMultiplier;
      laborSource = "msa_direct";
    } else if (stateAvgLabor[stateCode]) {
      laborMult = stateAvgLabor[stateCode];
      laborSource = "state_avg";
    }

    // Find RPP/materials multiplier
    let materialsMult = 1.0;
    let materialsSource = "default";
    const rppMsaName = cityToRppMsa[key];
    if (rppMsaName && msaRpp[rppMsaName]) {
      materialsMult = msaRpp[rppMsaName] / 100;
      materialsSource = "msa_direct";
    } else if (stateAvgRpp[stateCode]) {
      materialsMult = stateAvgRpp[stateCode] / 100;
      materialsSource = "state_avg";
    }

    // Blend: 55% labor + 45% materials
    const blendedMult = Math.round((laborMult * LABOR_WEIGHT + materialsMult * MATERIALS_WEIGHT) * 1000) / 1000;

    // Per-service multipliers using trade-specific wages
    const serviceMultipliers = {};
    if (tradeMsaName && tradeData.metros[tradeMsaName]) {
      const metro = tradeData.metros[tradeMsaName];
      for (const [service, tradeWeights] of Object.entries(SERVICE_TRADE_WEIGHTS)) {
        let wSum = 0, wTotal = 0;
        for (const [trade, weight] of Object.entries(tradeWeights)) {
          if (metro.multipliers[trade]) {
            wSum += metro.multipliers[trade] * weight;
            wTotal += weight;
          }
        }
        if (wTotal > 0) {
          const serviceLaborMult = wSum / wTotal;
          serviceMultipliers[service] = Math.round((serviceLaborMult * LABOR_WEIGHT + materialsMult * MATERIALS_WEIGHT) * 1000) / 1000;
        }
      }
    }

    if (laborSource === "msa_direct" && materialsSource === "msa_direct") directBoth++;
    else if (laborSource === "msa_direct" || materialsSource === "msa_direct") directOne++;
    else stateLevel++;

    result[`${cityName}|${stateCode}`] = {
      multiplier: blendedMult,
      laborMult: Math.round(laborMult * 1000) / 1000,
      materialsMult: Math.round(materialsMult * 1000) / 1000,
      serviceMultipliers: Object.keys(serviceMultipliers).length > 0 ? serviceMultipliers : undefined,
      source: laborSource === "msa_direct" ? "msa_direct" : "state_avg"
    };
  }

  console.log(`\nBlended multiplier results:`);
  console.log(`  Both MSA direct: ${directBoth}`);
  console.log(`  One MSA + one state: ${directOne}`);
  console.log(`  Both state-level: ${stateLevel}`);
  console.log(`  Total: ${cities.length}`);

  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), "utf8");
  console.log(`\nWrote ${OUTPUT}`);

  // Samples
  console.log("\nSample blended multipliers (labor | materials | blended):");
  const samples = ["New York|NY", "San Francisco|CA", "Dallas|TX", "Houston|TX", "Seattle|WA", "Miami|FL", "Jackson|MS", "Fort Mill|SC", "Birmingham|AL", "Denver|CO"];
  for (const k of samples) {
    const v = result[k];
    if (v) console.log(`  ${k}: labor=${v.laborMult} materials=${v.materialsMult} blended=${v.multiplier} (${v.source})`);
  }
}

main();
