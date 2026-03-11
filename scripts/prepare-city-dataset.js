const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const INPUT = path.join(ROOT, "data", "us-cities-source-raw.csv");
const OUTPUT = path.join(ROOT, "data", "us-cities-source.csv");

const STATE_CODES = {
  "Alabama": "AL",
  "Alaska": "AK",
  "Arizona": "AZ",
  "Arkansas": "AR",
  "California": "CA",
  "Colorado": "CO",
  "Connecticut": "CT",
  "Delaware": "DE",
  "Florida": "FL",
  "Georgia": "GA",
  "Hawaii": "HI",
  "Idaho": "ID",
  "Illinois": "IL",
  "Indiana": "IN",
  "Iowa": "IA",
  "Kansas": "KS",
  "Kentucky": "KY",
  "Louisiana": "LA",
  "Maine": "ME",
  "Maryland": "MD",
  "Massachusetts": "MA",
  "Michigan": "MI",
  "Minnesota": "MN",
  "Mississippi": "MS",
  "Missouri": "MO",
  "Montana": "MT",
  "Nebraska": "NE",
  "Nevada": "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  "Ohio": "OH",
  "Oklahoma": "OK",
  "Oregon": "OR",
  "Pennsylvania": "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  "Tennessee": "TN",
  "Texas": "TX",
  "Utah": "UT",
  "Vermont": "VT",
  "Virginia": "VA",
  "Washington": "WA",
  "West Virginia": "WV",
  "Wisconsin": "WI",
  "Wyoming": "WY"
};

function main() {
  const raw = fs.readFileSync(INPUT, "utf8").split("\n").slice(1);

  const rows = [];

  for (const line of raw) {
    if (!line.trim()) continue;

    const [city, state, population] = line.split(",");

    const stateCode = STATE_CODES[state?.trim()];
    if (!stateCode) continue;

    rows.push({
      city: city.trim(),
      state: state.trim(),
      state_code: stateCode,
      population: population.trim()
    });
  }

  const header = "city,state,state_code,population\n";

  const csv =
    header +
    rows
      .map(
        (r) => `${r.city},${r.state},${r.state_code},${r.population}`
      )
      .join("\n");

  fs.writeFileSync(OUTPUT, csv);

  console.log("Generated data/us-cities-source.csv");
  console.log("Cities:", rows.length);
}

main();