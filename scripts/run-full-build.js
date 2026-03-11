const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const MANIFEST_PATH = path.join(ROOT, "data", "build-manifest.json");
const PRICING_JSON = path.join(ROOT, "data", "city-house-size-pricing.json");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");
const ALL_CITIES_PATH = path.join(ROOT, "all-cities.html");
const CONFIG_PATH = path.join(ROOT, "config", "city-selection.json");

function runStep(name, command) {
  console.log("\n===============================");
  console.log(name);
  console.log("===============================");
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
    throw new Error(`Missing city input file: ${INPUT_CSV}`);
  }

  const rows = parseCsv(fs.readFileSync(INPUT_CSV, "utf8"));

  if (!rows.length) {
    throw new Error("cities.csv has no city rows.");
  }

  const seen = new Set();

  for (const row of rows) {
    if (!row.city || !row.state || !row.state_code) {
      throw new Error("Found blank city/state/state_code in cities.csv");
    }

    const key = `${row.city}|${row.state_code}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate city found: ${key}`);
    }
    seen.add(key);
  }

  console.log(`Validated ${rows.length} selected cities.`);
  return rows;
}

function writeBuildManifest(rows) {
  const manifest = {
    build_timestamp: new Date().toISOString(),
    city_count: rows.length,
    state_count: new Set(rows.map((r) => r.state_code)).size,
    material_count: 4,
    material_city_pages: rows.length * 4,
    pricing_json_exists: fs.existsSync(PRICING_JSON),
    sitemap_exists: fs.existsSync(SITEMAP_PATH),
    all_cities_exists: fs.existsSync(ALL_CITIES_PATH),
    config: JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"))
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Wrote build manifest: ${MANIFEST_PATH}`);
}

function main() {
  try {
    runStep("1. Generate city input list", "node scripts/generate-city-input.js");

    const rows = validateInputs();

    runStep("2. Build entire site", "node scripts/build-site.js");

    writeBuildManifest(rows);

    console.log("\n✅ FULL BUILD COMPLETE\n");
  } catch (err) {
    console.error("\n❌ BUILD FAILED\n");
    console.error(err.message);
    process.exit(1);
  }
}

main();