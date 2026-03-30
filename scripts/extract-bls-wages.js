/**
 * Extract trade-specific median hourly wages by metro area from BLS OEWS data.
 * Produces data/trade-wages-by-metro.json
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "data", "bls", "oesm24", "oesm24ma", "MSA_M2024_dl.xlsx");
const OUTPUT = path.join(ROOT, "data", "trade-wages-by-metro.json");

// SOC codes for construction trades
const TARGET_SOC = {
  "47-2181": "roofers",
  "49-9021": "hvac_mechanics",
  "47-2152": "plumbers",
  "47-2111": "electricians",
  "47-2031": "carpenters",
  "47-2061": "construction_laborers",
  "47-2051": "cement_masons",      // concrete
  "47-2081": "drywall_installers",  // siding/insulation
  "47-2141": "painters",
  "47-2211": "sheet_metal_workers", // hvac/roofing
  "49-9071": "maintenance_workers", // general trades proxy
};

console.log("Reading BLS OEWS data (this may take a moment)...");
const workbook = XLSX.readFile(INPUT);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log(`Loaded ${rows.length} rows from sheet "${sheetName}"`);

// Find column names
const sampleRow = rows[0];
console.log("Columns:", Object.keys(sampleRow).join(", "));

// Extract relevant data
const result = {};
let matched = 0;

for (const row of rows) {
  const soc = row["OCC_CODE"] || row["occ_code"] || "";
  if (!TARGET_SOC[soc]) continue;

  const areaTitle = row["AREA_TITLE"] || row["area_title"] || "";
  const areaCode = row["AREA"] || row["area"] || "";
  const medianHourly = row["H_MEDIAN"] || row["h_median"];
  const meanHourly = row["H_MEAN"] || row["h_mean"];
  const annualMedian = row["A_MEDIAN"] || row["a_median"];

  // Skip national/state-level entries, keep only MSA
  if (!areaTitle || areaTitle === "U.S." || !areaTitle.includes(",")) continue;

  // Parse wage (could be "#" or "*" for unavailable)
  let wage = parseFloat(medianHourly);
  if (isNaN(wage)) wage = parseFloat(meanHourly);
  if (isNaN(wage)) {
    // Try annual and convert
    const annual = parseFloat(annualMedian);
    if (!isNaN(annual)) wage = Math.round((annual / 2080) * 100) / 100;
  }
  if (isNaN(wage) || wage <= 0) continue;

  const tradeName = TARGET_SOC[soc];

  if (!result[areaTitle]) {
    result[areaTitle] = { areaCode, trades: {} };
  }
  result[areaTitle].trades[tradeName] = wage;
  matched++;
}

console.log(`\nExtracted ${matched} wage entries across ${Object.keys(result).length} metro areas`);

// Compute national medians for each trade (for multiplier calculation)
const nationalWages = {};
for (const [soc, tradeName] of Object.entries(TARGET_SOC)) {
  const wages = [];
  for (const metro of Object.values(result)) {
    if (metro.trades[tradeName]) wages.push(metro.trades[tradeName]);
  }
  if (wages.length > 0) {
    wages.sort((a, b) => a - b);
    nationalWages[tradeName] = wages[Math.floor(wages.length / 2)]; // median
  }
}
console.log("\nNational median wages:");
for (const [trade, wage] of Object.entries(nationalWages)) {
  console.log(`  ${trade}: $${wage}/hr`);
}

// Build output with multipliers relative to national median
const output = {
  nationalMedians: nationalWages,
  metros: {}
};

for (const [areaTitle, data] of Object.entries(result)) {
  const multipliers = {};
  for (const [trade, wage] of Object.entries(data.trades)) {
    if (nationalWages[trade]) {
      multipliers[trade] = Math.round((wage / nationalWages[trade]) * 1000) / 1000;
    }
  }

  // Compute a composite construction labor multiplier (weighted average of available trades)
  const tradeWeights = {
    roofers: 1.0, hvac_mechanics: 1.0, plumbers: 1.0, electricians: 1.0,
    carpenters: 0.8, construction_laborers: 0.8, painters: 0.6,
    cement_masons: 0.5, drywall_installers: 0.5, sheet_metal_workers: 0.5,
    maintenance_workers: 0.3
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [trade, mult] of Object.entries(multipliers)) {
    const w = tradeWeights[trade] || 0.5;
    weightedSum += mult * w;
    totalWeight += w;
  }
  const compositeMult = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 1000) / 1000 : 1.0;

  output.metros[areaTitle] = {
    areaCode: data.areaCode,
    trades: data.trades,
    multipliers,
    compositeMultiplier: compositeMult
  };
}

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), "utf8");
console.log(`\nWrote ${OUTPUT}`);

// Show samples
console.log("\nSample composite multipliers:");
const samples = [
  "Dallas-Fort Worth-Arlington, TX",
  "New York-Newark-Jersey City, NY-NJ-PA",
  "San Francisco-Oakland-Berkeley, CA",
  "Houston-The Woodlands-Sugar Land, TX",
  "Chicago-Naperville-Elgin, IL-IN-WI",
  "Miami-Fort Lauderdale-Pompano Beach, FL",
  "Seattle-Tacoma-Bellevue, WA",
  "Phoenix-Mesa-Chandler, AZ"
];
for (const name of samples) {
  const m = output.metros[name];
  if (m) console.log(`  ${name}: ${m.compositeMultiplier} (${Object.keys(m.trades).length} trades)`);
}
