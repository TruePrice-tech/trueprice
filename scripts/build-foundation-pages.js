const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "foundation-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "foundation-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-foundation.xml");
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
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-foundation-cost.html`;
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
    const roundTo = pricingModel.roundTo || 100;

    const filename = buildFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    const base = pricingModel.basePriceByType;
    const pierPrice = Math.round(base.pier_installation.basePrice * laborMult * overheadMult / roundTo) * roundTo;
    const slabjackPrice = Math.round(base.slabjacking.basePrice * laborMult * overheadMult / roundTo) * roundTo;
    const wallPrice = Math.round(base.wall_stabilization.basePrice * laborMult * overheadMult / roundTo) * roundTo;
    const crackPrice = Math.round(base.crack_repair.basePrice * laborMult * overheadMult / roundTo) * roundTo;

    // Typical project: 8-12 piers
    const typicalLow = pierPrice * 8;
    const typicalHigh = pierPrice * 12 + wallPrice;
    const avgLowRaw = String(crackPrice);
    const avgHighRaw = String(typicalHigh);
    const avgLow = formatCurrency(crackPrice);
    const avgHigh = formatCurrency(typicalHigh);
    const slugLC = slugifyCity(cityName) + "-" + stateCode.toLowerCase();

    // Build price rows by project size
    const moderateBase = pierPrice * 10; // 10 piers as baseline
    const priceRows = pricingModel.projectSizes.map(size => {
      const cost = Math.round(moderateBase * size.multiplier / roundTo) * roundTo;
      return `<tr><td>${size.label}</td><td>${formatCurrency(cost)}</td></tr>`;
    }).join("\n");

    let html = template
      .replaceAll("{{CITY}}", cityName)
      .replaceAll("{{STATE_CODE}}", stateCode)
      .replaceAll("{{STATE_NAME}}", stateName)
      .replaceAll("{{CITY_STATE}}", cityState)
      .replaceAll("{{SLUG}}", filename)
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_PIER}}", formatCurrency(pierPrice))
      .replaceAll("{{RATE_SLABJACKING}}", formatCurrency(slabjackPrice))
      .replaceAll("{{RATE_WALL}}", formatCurrency(wallPrice))
      .replaceAll("{{RATE_CRACK}}", formatCurrency(crackPrice))
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
  <url><loc>${SITE_BASE_URL}/foundation-repair-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} foundation repair city pages`);
  console.log(`Generated sitemap-foundation.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
