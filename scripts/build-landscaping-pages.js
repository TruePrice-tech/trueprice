const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "landscaping-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "landscaping-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-landscaping.xml");

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
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-landscaping-cost.html`;
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

    const filename = buildPageFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    const paverMid = pricingModel.basePricing.paver_patio.mid;
    const retainingMid = pricingModel.basePricing.retaining_wall.mid;
    const sodMid = pricingModel.basePricing.sod_installation.mid;
    const designMid = pricingModel.basePricing.landscape_design_install.mid;
    const drainMid = pricingModel.basePricing.french_drain.mid;
    const gradingMid = pricingModel.basePricing.grading_leveling.mid;

    const paverRate = Math.round(paverMid * laborMult * overheadMult);
    const retainingRate = Math.round(retainingMid * laborMult * overheadMult);
    const sodRate = Math.round(sodMid * laborMult * overheadMult * 100) / 100;
    const designAvg = formatCurrency(Math.round(designMid * laborMult * overheadMult / 50) * 50);

    // Average based on 400 sqft paver patio
    const avgSqft = 400;
    const avgLow = formatCurrency(Math.round(paverMid * 0.67 * avgSqft * laborMult * overheadMult / 50) * 50);
    const avgHigh = formatCurrency(Math.round(paverMid * 1.33 * avgSqft * laborMult * overheadMult / 50) * 50);

    // Ranges for flat-rate services
    const designLow = formatCurrency(Math.round(pricingModel.basePricing.landscape_design_install.low * laborMult * overheadMult / 50) * 50);
    const designHigh = formatCurrency(Math.round(pricingModel.basePricing.landscape_design_install.high * laborMult * overheadMult / 50) * 50);
    const drainLow = formatCurrency(Math.round(pricingModel.basePricing.french_drain.low * 50 * laborMult * overheadMult / 50) * 50);
    const drainHigh = formatCurrency(Math.round(pricingModel.basePricing.french_drain.high * 50 * laborMult * overheadMult / 50) * 50);
    const gradingLow = formatCurrency(Math.round(pricingModel.basePricing.grading_leveling.low * laborMult * overheadMult / 50) * 50);
    const gradingHigh = formatCurrency(Math.round(pricingModel.basePricing.grading_leveling.high * laborMult * overheadMult / 50) * 50);

    // Build price rows
    const priceRows = pricingModel.projectSizes.map(size => {
      const sqft = size.sqft;
      const paver = formatCurrency(Math.round(paverMid * sqft * laborMult * overheadMult / 50) * 50);
      const retaining = formatCurrency(Math.round(retainingMid * sqft * laborMult * overheadMult / 50) * 50);
      const sod = formatCurrency(Math.round(sodMid * sqft * laborMult * overheadMult / 50) * 50);
      return `<tr><td>${size.label} sq ft</td><td>${paver}</td><td>${retaining}</td><td>${sod}</td></tr>`;
    }).join("\n");

    let html = template
      .replaceAll("{{CITY}}", cityName)
      .replaceAll("{{STATE_CODE}}", stateCode)
      .replaceAll("{{STATE_NAME}}", stateName)
      .replaceAll("{{CITY_STATE}}", cityState)
      .replaceAll("{{SLUG}}", filename)
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_PAVER}}", formatCurrency(paverRate))
      .replaceAll("{{RATE_RETAINING}}", formatCurrency(retainingRate))
      .replaceAll("{{RATE_SOD}}", formatCurrency(sodRate))
      .replaceAll("{{RATE_DESIGN}}", designAvg)
      .replaceAll("{{RANGE_DESIGN}}", `${designLow} - ${designHigh}`)
      .replaceAll("{{RANGE_DRAIN}}", `${drainLow} - ${drainHigh}`)
      .replaceAll("{{RANGE_GRADING}}", `${gradingLow} - ${gradingHigh}`)
      .replaceAll("{{PRICE_ROWS}}", priceRows);

    fs.writeFileSync(path.join(ROOT, filename), html, "utf8");
    sitemapUrls.push(`${SITE_BASE_URL}/${filename}`);
    generated++;
  });

  // Generate sitemap
  const today = new Date().toISOString().split("T")[0];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_BASE_URL}/landscaping-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} landscaping city pages`);
  console.log(`Generated sitemap-landscaping.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
