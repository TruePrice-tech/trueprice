const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "window-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "window-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-window.xml");

const SITE_BASE_URL = "https://truepricehq.com";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = line.split(",").map(v => v.trim());
    const row = {};
    headers.forEach((header, i) => { row[header] = values[i] || ""; });
    return row;
  });
}

function slugifyCity(city) {
  return city.toLowerCase().replace(/[^\w\s]/g, "").trim().replace(/\s+/g, "-");
}

function slugifyState(state) {
  return state.toLowerCase().replace(/[^\w\s]/g, "").trim().replace(/\s+/g, "-");
}

function formatCurrency(value) {
  return "$" + Math.round(value).toLocaleString();
}

function buildPageFilename(city, stateCode) {
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-window-cost.html`;
}

function main() {
  const pricingModel = readJson(PRICING_MODEL_PATH);
  const stateRegions = readJson(STATE_REGIONS_PATH);
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const csvText = fs.readFileSync(INPUT_CSV, "utf8");
  const cities = parseCsv(csvText);

  const sitemapUrls = [];
  let generated = 0;

  cities.forEach(city => {
    const cityName = city.city;
    const stateCode = city.state_code;
    const stateName = city.state;
    const region = stateRegions[stateCode] || "south";
    const laborMult = pricingModel.laborMultiplierByRegion[region] || 1.0;
    const overheadMult = pricingModel.overheadMultiplier || 1.15;

    const filename = buildPageFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    const types = pricingModel.basePriceByType;
    const mult = laborMult * overheadMult;

    // Per-window midpoint prices for hero
    const vinylMid = formatCurrency(Math.round(((types.vinyl.lowPerUnit + types.vinyl.highPerUnit) / 2) * mult / 50) * 50);
    const woodMid = formatCurrency(Math.round(((types.wood.lowPerUnit + types.wood.highPerUnit) / 2) * mult / 50) * 50);
    const fiberglassMid = formatCurrency(Math.round(((types.fiberglass.lowPerUnit + types.fiberglass.highPerUnit) / 2) * mult / 50) * 50);
    const entryDoorMid = formatCurrency(Math.round(((types.entry_door.lowPerUnit + types.entry_door.highPerUnit) / 2) * mult / 50) * 50);

    // Avg range based on 15 vinyl windows (low) to 15 wood windows (high)
    const avgLow = formatCurrency(Math.round(types.vinyl.lowPerUnit * 15 * mult / 50) * 50);
    const avgHigh = formatCurrency(Math.round(types.wood.highPerUnit * 15 * mult / 50) * 50);

    // Build price rows by home size (number of windows)
    const priceRows = pricingModel.homeSizes.map(size => {
      const w = size.windows;
      const vinyl = formatCurrency(Math.round(((types.vinyl.lowPerUnit + types.vinyl.highPerUnit) / 2) * w * mult / 50) * 50);
      const wood = formatCurrency(Math.round(((types.wood.lowPerUnit + types.wood.highPerUnit) / 2) * w * mult / 50) * 50);
      const fiberglass = formatCurrency(Math.round(((types.fiberglass.lowPerUnit + types.fiberglass.highPerUnit) / 2) * w * mult / 50) * 50);
      return `<tr><td>${size.label}</td><td>${vinyl}</td><td>${wood}</td><td>${fiberglass}</td></tr>`;
    }).join("\n");

    let html = template
      .replaceAll("{{CITY}}", cityName)
      .replaceAll("{{STATE_CODE}}", stateCode)
      .replaceAll("{{STATE_NAME}}", stateName)
      .replaceAll("{{CITY_STATE}}", cityState)
      .replaceAll("{{SLUG}}", filename)
      .replaceAll("{{STATE_PAGE_FILENAME}}", `${slugifyState(stateName)}-roof-cost.html`)
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_VINYL}}", vinylMid)
      .replaceAll("{{RATE_WOOD}}", woodMid)
      .replaceAll("{{RATE_FIBERGLASS}}", fiberglassMid)
      .replaceAll("{{RATE_ENTRY_DOOR}}", entryDoorMid)
      .replaceAll("{{PRICE_ROWS}}", priceRows);

    fs.writeFileSync(path.join(ROOT, filename), html, "utf8");
    sitemapUrls.push(`${SITE_BASE_URL}/${filename}`);
    generated++;
  });

  // Generate sitemap
  const today = new Date().toISOString().split("T")[0];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_BASE_URL}/window-replacement-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} window city pages`);
  console.log(`Generated sitemap-window.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
