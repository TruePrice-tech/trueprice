/**
 * Geocode all 739 cities using Mapbox API.
 * Run with: MAPBOX_TOKEN=xxx node scripts/geocode-cities.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CITIES_CSV = path.join(ROOT, "inputs", "cities.csv");
const OUTPUT = path.join(ROOT, "data", "city-coordinates.json");

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
  console.error("Set MAPBOX_TOKEN env variable");
  process.exit(1);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ""; });
    return row;
  });
}

async function geocode(city, state) {
  const query = encodeURIComponent(city + ", " + state);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=us&types=place&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const feature = data.features?.[0];
  if (feature && feature.center) {
    return { lat: feature.center[1], lng: feature.center[0] };
  }
  return null;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const cities = parseCsv(fs.readFileSync(CITIES_CSV, "utf8"));

  // Load existing coords to avoid re-geocoding
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(OUTPUT, "utf8")); } catch(e) {}

  const result = { ...existing };
  let geocoded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < cities.length; i++) {
    const c = cities[i];
    const key = c.city + "|" + c.state_code;

    // Skip if we already have accurate coords (not state center approximation)
    if (result[key] && result[key].geocoded) {
      skipped++;
      continue;
    }

    const coords = await geocode(c.city, c.state_code);
    if (coords) {
      result[key] = { lat: coords.lat, lng: coords.lng, geocoded: true };
      geocoded++;
    } else {
      failed++;
    }

    // Rate limit: ~10 requests/second
    if ((geocoded + failed) % 10 === 0) {
      await sleep(1100);
      process.stdout.write("\r  Geocoded " + geocoded + " / " + cities.length + " (" + failed + " failed)");
    }

    // Save progress every 50 cities
    if ((geocoded + failed) % 50 === 0) {
      fs.writeFileSync(OUTPUT, JSON.stringify(result), "utf8");
    }
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(result), "utf8");
  console.log("\n\nDone. Geocoded: " + geocoded + ", Skipped: " + skipped + ", Failed: " + failed);
  console.log("Total cities with coordinates: " + Object.keys(result).length);
}

main().catch(console.error);
