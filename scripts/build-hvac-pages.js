const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "hvac-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "hvac-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-hvac.xml");

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

function buildHvacPageFilename(city, stateCode) {
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-hvac-cost.html`;
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
    const region = stateRegions[stateName] || stateRegions[stateCode] || "south";
    const laborMult = pricingModel.laborMultiplierByRegion[region] || 1.0;
    const overheadMult = pricingModel.overheadMultiplier || 1.15;

    const filename = buildHvacPageFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    // Calculate prices for each system type and home size
    const acBase = pricingModel.basePriceBySystem.central_ac.pricePerTon["16_seer"];
    const hpBase = pricingModel.basePriceBySystem.heat_pump.pricePerTon["16_seer"];
    const furnaceBase = pricingModel.basePriceBySystem.furnace.priceByEfficiency["90_afue"];
    const fullBase = pricingModel.basePriceBySystem.full_system.pricePerTon["16_seer_90_afue"];

    // Average home = 2.5 tons
    const avgTons = 2.5;
    const acAvg = Math.round(acBase * avgTons * laborMult * overheadMult / 50) * 50;
    const hpAvg = Math.round(hpBase * avgTons * laborMult * overheadMult / 50) * 50;
    const furnaceAvg = Math.round(furnaceBase * laborMult * overheadMult / 50) * 50;
    const fullAvg = Math.round(fullBase * avgTons * laborMult * overheadMult / 50) * 50;

    const avgLow = formatCurrency(acAvg * 0.85);
    const avgHigh = formatCurrency(fullAvg * 1.15);

    // Build price rows
    const priceRows = pricingModel.homeSizes.map(size => {
      const tons = size.tons;
      const ac = formatCurrency(Math.round(acBase * tons * laborMult * overheadMult / 50) * 50);
      const hp = formatCurrency(Math.round(hpBase * tons * laborMult * overheadMult / 50) * 50);
      const full = formatCurrency(Math.round(fullBase * tons * laborMult * overheadMult / 50) * 50);
      return `<tr><td>${size.label} sq ft (${tons} ton)</td><td>${ac}</td><td>${hp}</td><td>${full}</td></tr>`;
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
      .replaceAll("{{RATE_CENTRAL_AC}}", formatCurrency(acAvg))
      .replaceAll("{{RATE_HEAT_PUMP}}", formatCurrency(hpAvg))
      .replaceAll("{{RATE_FURNACE}}", formatCurrency(furnaceAvg))
      .replaceAll("{{RATE_FULL_SYSTEM}}", formatCurrency(fullAvg))
      .replaceAll("{{PRICE_ROWS}}", priceRows);

    fs.writeFileSync(path.join(ROOT, filename), html, "utf8");
    sitemapUrls.push(`${SITE_BASE_URL}/${filename}`);
    generated++;
  });

  // Generate HVAC sitemap
  const today = new Date().toISOString().split("T")[0];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_BASE_URL}/hvac-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} HVAC city pages`);
  console.log(`Generated sitemap-hvac.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
