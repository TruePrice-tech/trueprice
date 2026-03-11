const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "config", "city-selection.json");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_JSON = path.join(ROOT, "data", "city-house-size-pricing.json");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");
const ALL_CITIES_PATH = path.join(ROOT, "all-cities.html");

function runStep(label, command) {
  console.log(`\n=== ${label} ===`);
  execSync(command, { stdio: "inherit", cwd: ROOT });
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || "";
    });
    return row;
  });
}

function validateInputs() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing config file: ${CONFIG_PATH}`);
  }

  if (!fs.existsSync(INPUT_CSV)) {
    throw new Error(`Missing generated input file: ${INPUT_CSV}`);
  }

  const csvText = fs.readFileSync(INPUT_CSV, "utf8");
  const rows = parseCsv(csvText);

  if (!rows.length) {
    throw new Error("cities.csv contains no rows.");
  }

  const seen = new Set();

  for (const row of rows) {
    if (!row.city || !row.state || !row.state_code) {
      throw new Error("Found blank city/state/state_code in cities.csv");
    }

    const key = `${row.city}|${row.state_code}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate city found in cities.csv: ${key}`);
    }
    seen.add(key);
  }

  console.log(`Validated ${rows.length} selected cities.`);
  return rows;
}

function buildSummary(rows) {
  const cityCount = rows.length;
  const stateCount = new Set(rows.map((r) => r.state_code)).size;
  const materialCount = 4;
  const materialCityCount = cityCount * materialCount;

  let pricingCount = 0;
  if (fs.existsSync(PRICING_JSON)) {
    const pricingRows = JSON.parse(fs.readFileSync(PRICING_JSON, "utf8"));
    pricingCount = pricingRows.length;
  }

  console.log("\n=== BUILD SUMMARY ===");
  console.log(`Selected cities: ${cityCount}`);
  console.log(`States covered: ${stateCount}`);
  console.log(`City pages: ${cityCount}`);
  console.log(`Material pages: ${materialCount}`);
  console.log(`Material-city pages: ${materialCityCount}`);
  console.log(`Pricing rows generated: ${pricingCount}`);
  console.log(`Sitemap exists: ${fs.existsSync(SITEMAP_PATH) ? "yes" : "no"}`);
  console.log(`All cities page exists: ${fs.existsSync(ALL_CITIES_PATH) ? "yes" : "no"}`);
}

function main() {
  runStep("Generate city input", "node scripts/generate-city-input.js");

  const rows = validateInputs();

  runStep("Build site", "node scripts/build-site.js");

  buildSummary(rows);
}

main();