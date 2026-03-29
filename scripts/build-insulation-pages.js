const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "insulation-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "insulation-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-insulation.xml");

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
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-insulation-cost.html`;
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

    // Per-sqft midpoint prices for hero
    const blownInMid = "$" + ((((types.blown_in.lowPerSqft + types.blown_in.highPerSqft) / 2) * mult).toFixed(2));
    const openCellMid = "$" + ((((types.spray_foam_open.lowPerSqft + types.spray_foam_open.highPerSqft) / 2) * mult).toFixed(2));
    const closedCellMid = "$" + ((((types.spray_foam_closed.lowPerSqft + types.spray_foam_closed.highPerSqft) / 2) * mult).toFixed(2));
    const battsMid = "$" + ((((types.batts.lowPerSqft + types.batts.highPerSqft) / 2) * mult).toFixed(2));

    // Avg range based on 1500 sqft batts (low) to 1500 sqft closed cell (high)
    const avgLowVal = Math.round(types.batts.lowPerSqft * 1500 * mult / 50) * 50;
    const avgHighVal = Math.round(types.spray_foam_closed.highPerSqft * 1500 * mult / 50) * 50;
    const avgLowRaw = String(avgLowVal);
    const avgHighRaw = String(avgHighVal);
    const avgLow = formatCurrency(avgLowVal);
    const avgHigh = formatCurrency(avgHighVal);
    const slugLC = slugifyCity(cityName) + "-" + stateCode.toLowerCase();

    // Build price rows by attic size
    const priceRows = pricingModel.homeSizes.map(size => {
      const sqft = size.sqft;
      const blownIn = formatCurrency(Math.round(((types.blown_in.lowPerSqft + types.blown_in.highPerSqft) / 2) * sqft * mult / 50) * 50);
      const openCell = formatCurrency(Math.round(((types.spray_foam_open.lowPerSqft + types.spray_foam_open.highPerSqft) / 2) * sqft * mult / 50) * 50);
      const closedCell = formatCurrency(Math.round(((types.spray_foam_closed.lowPerSqft + types.spray_foam_closed.highPerSqft) / 2) * sqft * mult / 50) * 50);
      return `<tr><td>${size.label} sq ft</td><td>${blownIn}</td><td>${openCell}</td><td>${closedCell}</td></tr>`;
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
      .replaceAll("{{RATE_BLOWN_IN}}", blownInMid)
      .replaceAll("{{RATE_OPEN_CELL}}", openCellMid)
      .replaceAll("{{RATE_CLOSED_CELL}}", closedCellMid)
      .replaceAll("{{RATE_BATTS}}", battsMid)
      .replaceAll("{{PRICE_ROWS}}", priceRows)
      .replaceAll("{{SLUG_LC}}", slugLC)
      .replaceAll("{{AVG_LOW_RAW}}", avgLowRaw)
      .replaceAll("{{AVG_HIGH_RAW}}", avgHighRaw);

    fs.writeFileSync(path.join(ROOT, filename), html, "utf8");
    sitemapUrls.push(`${SITE_BASE_URL}/${filename}`);
    generated++;
  });

  // Generate sitemap
  const today = new Date().toISOString().split("T")[0];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_BASE_URL}/insulation-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} insulation city pages`);
  console.log(`Generated sitemap-insulation.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
