const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "solar-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "solar-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-solar.xml");

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
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-solar-cost.html`;
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
    const roundTo = pricingModel.roundTo || 100;
    const taxCredit = pricingModel.federalTaxCredit || 0.30;

    const filename = buildFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    const stdBase = pricingModel.pricePerWatt.standard.base;
    const premBase = pricingModel.pricePerWatt.premium.base;

    // Calculate prices for key system sizes
    const calc = (kw, ppw) => Math.round(kw * 1000 * ppw * laborMult * overheadMult / roundTo) * roundTo;

    const std5 = calc(5, stdBase);
    const std8 = calc(8, stdBase);
    const std10 = calc(10, stdBase);

    const avgLowRaw = String(Math.round(std5 * 0.85));
    const avgHighRaw = String(Math.round(calc(15, premBase) * 1.10));
    const avgLow = formatCurrency(std5 * 0.85);
    const avgHigh = formatCurrency(calc(15, premBase) * 1.10);
    const slugLC = slugifyCity(cityName) + "-" + stateCode.toLowerCase();

    const batteryPrice = Math.round(pricingModel.battery.base * laborMult * overheadMult / roundTo) * roundTo;

    // Build price rows by system size
    const priceRows = pricingModel.systemSizes.map(size => {
      const stdPrice = calc(size.kw, stdBase);
      const premPrice = calc(size.kw, premBase);
      const afterCredit = formatCurrency(Math.round(stdPrice * (1 - taxCredit) / roundTo) * roundTo);
      return `<tr><td>${size.label} (${size.monthlyBill}/mo bill)</td><td>${formatCurrency(stdPrice)}</td><td>${formatCurrency(premPrice)}</td><td>${afterCredit}</td></tr>`;
    }).join("\n");

    let html = template
      .replaceAll("{{CITY}}", cityName)
      .replaceAll("{{STATE_CODE}}", stateCode)
      .replaceAll("{{STATE_NAME}}", stateName)
      .replaceAll("{{CITY_STATE}}", cityState)
      .replaceAll("{{SLUG}}", filename)
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_5KW}}", formatCurrency(std5))
      .replaceAll("{{RATE_8KW}}", formatCurrency(std8))
      .replaceAll("{{RATE_10KW}}", formatCurrency(std10))
      .replaceAll("{{RATE_BATTERY}}", formatCurrency(batteryPrice))
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
  <url><loc>${SITE_BASE_URL}/solar-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} solar city pages`);
  console.log(`Generated sitemap-solar.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
