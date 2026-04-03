const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "gutters-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "gutters-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-gutters.xml");
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

function buildPageFilename(city, stateCode) {
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-gutter-cost.html`;
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

    const filename = buildPageFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    const aluMid = pricingModel.basePricePerLinearFoot.aluminum_seamless.mid;
    const vinylMid = pricingModel.basePricePerLinearFoot.vinyl.mid;
    const steelMid = pricingModel.basePricePerLinearFoot.steel.mid;
    const aluminumMid = pricingModel.basePricePerLinearFoot.copper.mid;
    const alu6Mid = pricingModel.basePricePerLinearFoot.aluminum_6inch.mid;

    const aluRate = Math.round(aluMid * laborMult * overheadMult);
    const vinylRate = Math.round(vinylMid * laborMult * overheadMult);
    const steelRate = Math.round(steelMid * laborMult * overheadMult);
    const alu6Rate = Math.round(alu6Mid * laborMult * overheadMult);

    // Average based on 150 LF (typical home)
    const avgLF = 150;
    const avgLowVal = Math.round(vinylMid * avgLF * laborMult * overheadMult / 50) * 50;
    const avgHighVal = Math.round(aluMid * avgLF * laborMult * overheadMult / 50) * 50;
    const avgLowRaw = String(avgLowVal);
    const avgHighRaw = String(avgHighVal);
    const avgLow = formatCurrency(avgLowVal);
    const avgHigh = formatCurrency(avgHighVal);
    const slugLC = slugifyCity(cityName) + "-" + stateCode.toLowerCase();

    // Build price rows
    const priceRows = pricingModel.homeSizes.map(size => {
      const lf = size.linearFeet;
      const aluPrice = formatCurrency(Math.round(aluMid * lf * laborMult * overheadMult / 50) * 50);
      const vinylPrice = formatCurrency(Math.round(vinylMid * lf * laborMult * overheadMult / 50) * 50);
      const steelPrice = formatCurrency(Math.round(steelMid * lf * laborMult * overheadMult / 50) * 50);
      return `<tr><td>${size.label} LF</td><td>${aluPrice}</td><td>${vinylPrice}</td><td>${steelPrice}</td></tr>`;
    }).join("\n");

    let html = template
      .replaceAll("{{CITY}}", cityName)
      .replaceAll("{{STATE_CODE}}", stateCode)
      .replaceAll("{{STATE_NAME}}", stateName)
      .replaceAll("{{CITY_STATE}}", cityState)
      .replaceAll("{{SLUG}}", filename)
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_ALU5}}", formatCurrency(aluRate))
      .replaceAll("{{RATE_VINYL}}", formatCurrency(vinylRate))
      .replaceAll("{{RATE_STEEL}}", formatCurrency(steelRate))
      .replaceAll("{{RATE_ALU6}}", formatCurrency(alu6Rate))
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
  <url><loc>${SITE_BASE_URL}/gutters-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} gutters city pages`);
  console.log(`Generated sitemap-gutters.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
