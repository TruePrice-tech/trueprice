const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "garage-door-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "garage-door-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-garage-door.xml");
const CITY_MULTIPLIERS_PATH = path.join(ROOT, "data", "city-cost-multipliers.json");

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

function formatCurrency(value) {
  return "$" + Math.round(value).toLocaleString();
}

function buildFilename(city, stateCode) {
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-garage-door-cost.html`;
}

function main() {
  const pricingModel = readJson(PRICING_MODEL_PATH);
  const stateRegions = readJson(STATE_REGIONS_PATH);
  let cityMultipliers = {};
  try { cityMultipliers = readJson(CITY_MULTIPLIERS_PATH); } catch (e) { console.warn("city-cost-multipliers.json not found, using region fallback"); }
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
    const cityKey = cityName + "|" + stateCode;
    const cityMult = cityMultipliers[cityKey] ? cityMultipliers[cityKey].multiplier : null;
    const laborMult = cityMult || (pricingModel.laborMultiplierByRegion[region] || 1.0);
    const overheadMult = pricingModel.overheadMultiplier || 1.15;
    const roundTo = pricingModel.roundTo || 25;

    const filename = buildFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    const base = pricingModel.basePriceByType;
    const singlePrice = Math.round(base.single_car.basePrice * laborMult * overheadMult / roundTo) * roundTo;
    const doublePrice = Math.round(base.double_car.basePrice * laborMult * overheadMult / roundTo) * roundTo;
    const customPrice = Math.round(base.custom_carriage.basePrice * laborMult * overheadMult / roundTo) * roundTo;
    const openerPrice = Math.round(base.opener_only.basePrice * laborMult * overheadMult / roundTo) * roundTo;

    const avgLowRaw = String(Math.round(singlePrice * 0.85));
    const avgHighRaw = String(Math.round(customPrice * 1.15));
    const avgLow = formatCurrency(singlePrice * 0.85);
    const avgHigh = formatCurrency(customPrice * 1.15);
    const slugLC = slugifyCity(cityName) + "-" + stateCode.toLowerCase();

    // Build price rows by material
    const materials = pricingModel.materialUpgrades;
    const priceRows = Object.keys(materials).map(key => {
      const mat = materials[key];
      const singleMat = formatCurrency(Math.round(singlePrice * mat.multiplier / roundTo) * roundTo);
      const doubleMat = formatCurrency(Math.round(doublePrice * mat.multiplier / roundTo) * roundTo);
      return `<tr><td>${mat.label}</td><td>${singleMat}</td><td>${doubleMat}</td></tr>`;
    }).join("\n");

    let html = template
      .replaceAll("{{CITY}}", cityName)
      .replaceAll("{{STATE_CODE}}", stateCode)
      .replaceAll("{{STATE_NAME}}", stateName)
      .replaceAll("{{CITY_STATE}}", cityState)
      .replaceAll("{{SLUG}}", filename)
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_SINGLE}}", formatCurrency(singlePrice))
      .replaceAll("{{RATE_DOUBLE}}", formatCurrency(doublePrice))
      .replaceAll("{{RATE_CUSTOM}}", formatCurrency(customPrice))
      .replaceAll("{{RATE_OPENER}}", formatCurrency(openerPrice))
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
  <url><loc>${SITE_BASE_URL}/garage-door-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} garage door city pages`);
  console.log(`Generated sitemap-garage-door.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
