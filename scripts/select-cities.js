const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ALL_CITIES_PATH = path.join(ROOT, "inputs", "all-cities.csv");
const OUTPUT_CITIES_PATH = path.join(ROOT, "inputs", "cities.csv");

const MAX_CITIES = 25;

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || "";
    });
    return row;
  });
}

function toCsv(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map(h => row[h]).join(","));
  }

  return lines.join("\n");
}

function main() {
  if (!fs.existsSync(ALL_CITIES_PATH)) {
    throw new Error("Missing inputs/all-cities.csv");
  }

  const csvText = fs.readFileSync(ALL_CITIES_PATH, "utf8");
  const rows = parseCsv(csvText);

  const selected = rows
    .map(row => ({
      ...row,
      population: Number(row.population || 0)
    }))
    .sort((a, b) => b.population - a.population)
    .slice(0, MAX_CITIES)
    .map(row => ({
      city: row.city,
      state: row.state,
      state_code: row.state_code,
      population: String(row.population)
    }));

  fs.writeFileSync(OUTPUT_CITIES_PATH, toCsv(selected), "utf8");

  console.log(`Selected ${selected.length} cities into inputs/cities.csv`);
}

main();