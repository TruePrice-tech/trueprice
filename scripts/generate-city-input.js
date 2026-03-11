const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const SOURCE_CSV = path.join(ROOT, "data", "us-cities-source.csv");
const OUTPUT_CSV = path.join(ROOT, "inputs", "cities.csv");

const MIN_POPULATION = 75000;
const MAX_CITIES_PER_STATE = 20;
const MAX_TOTAL_CITIES = 350;

const FORCE_INCLUDE = new Set([
  "New York|NY",
  "Los Angeles|CA",
  "Chicago|IL",
  "Houston|TX",
  "Phoenix|AZ",
  "Philadelphia|PA",
  "San Antonio|TX",
  "San Diego|CA",
  "Dallas|TX",
  "Jacksonville|FL",
  "Austin|TX",
  "Fort Worth|TX",
  "San Jose|CA",
  "Columbus|OH",
  "Charlotte|NC",
  "Indianapolis|IN",
  "San Francisco|CA",
  "Seattle|WA",
  "Denver|CO",
  "Oklahoma City|OK",
  "Nashville|TN",
  "El Paso|TX",
  "Boston|MA",
  "Las Vegas|NV",
  "Detroit|MI",
  "Miami|FL",
  "Atlanta|GA",
  "Tampa|FL",
  "Orlando|FL",
  "Portland|OR",
  "Minneapolis|MN",
  "Raleigh|NC",
  "Kansas City|MO",
  "Cleveland|OH",
  "Pittsburgh|PA",
  "Cincinnati|OH",
  "St Louis|MO",
  "Sacramento|CA",
  "Baltimore|MD",
  "Milwaukee|WI",
  "New Orleans|LA",
  "Salt Lake City|UT",
  "Richmond|VA",
  "Birmingham|AL",
  "Buffalo|NY",
  "Hartford|CT",
  "Providence|RI"
]);

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
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

function toCsv(rows, headers) {
  const out = [headers.join(",")];
  for (const row of rows) {
    out.push(headers.map((h) => row[h] ?? "").join(","));
  }
  return out.join("\n") + "\n";
}

function normalizeCity(row) {
  return {
    city: row.city,
    state: row.state,
    state_code: row.state_code,
    population: String(Number(row.population || 0))
  };
}

function main() {
  if (!fs.existsSync(SOURCE_CSV)) {
    throw new Error(`Missing source city file: ${SOURCE_CSV}`);
  }

  const csvText = fs.readFileSync(SOURCE_CSV, "utf8");
  const sourceRows = parseCsv(csvText);

  const normalized = sourceRows
    .map(normalizeCity)
    .filter((row) => row.city && row.state && row.state_code && Number(row.population) > 0);

  const forced = [];
  const forcedKeys = new Set();

  for (const row of normalized) {
    const key = `${row.city}|${row.state_code}`;
    if (FORCE_INCLUDE.has(key)) {
      forced.push(row);
      forcedKeys.add(key);
    }
  }

  const filtered = normalized
    .filter((row) => Number(row.population) >= MIN_POPULATION)
    .filter((row) => !forcedKeys.has(`${row.city}|${row.state_code}`))
    .sort((a, b) => Number(b.population) - Number(a.population));

  const perStateCounts = {};
  const selected = [...forced];

  for (const row of forced) {
    perStateCounts[row.state_code] = (perStateCounts[row.state_code] || 0) + 1;
  }

  for (const row of filtered) {
    if (selected.length >= MAX_TOTAL_CITIES) break;

    const count = perStateCounts[row.state_code] || 0;
    if (count >= MAX_CITIES_PER_STATE) continue;

    selected.push(row);
    perStateCounts[row.state_code] = count + 1;
  }

  selected.sort((a, b) => {
    if (a.state === b.state) return a.city.localeCompare(b.city);
    return a.state.localeCompare(b.state);
  });

  console.log(`Source rows: ${sourceRows.length}`);
  console.log(`Normalized rows: ${normalized.length}`);
  console.log(`Forced rows: ${forced.length}`);
  console.log(`Filtered rows >= ${MIN_POPULATION}: ${filtered.length}`);
  console.log(`Selected rows before write: ${selected.length}`);

  const headers = ["city", "state", "state_code", "population"];
  const output = toCsv(selected, headers);

  fs.writeFileSync(OUTPUT_CSV, output, "utf8");

  console.log(`Generated ${OUTPUT_CSV}`);
  console.log(`Selected ${selected.length} cities`);
}

main();