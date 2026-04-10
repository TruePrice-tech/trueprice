const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "hvac-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "hvac-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-hvac.xml");
const CONTEXT_PATH = path.join(ROOT, "data", "hvac-city-context.json");
const CITY_MULTIPLIERS_PATH = path.join(ROOT, "data", "city-cost-multipliers.json");

const SITE_BASE_URL = "https://truepricehq.com";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

let _hvacContext = null;
function buildHvacLocalContext(city, stateCode) {
  if (!_hvacContext) {
    try { _hvacContext = readJson(CONTEXT_PATH); } catch(e) { _hvacContext = {}; }
  }
  const ctx = _hvacContext[`${city}|${stateCode}`];
  if (!ctx) return "";
  const cards = [];
  if (ctx.climateNote) cards.push(`<div class="local-card"><div class="local-card-icon">&#127777;</div><h3>Climate and your HVAC</h3><p>${ctx.climateNote}</p></div>`);
  if (ctx.systemTip) cards.push(`<div class="local-card"><div class="local-card-icon">&#9881;</div><h3>System recommendation</h3><p>${ctx.systemTip}</p></div>`);
  if (ctx.seasonNote) cards.push(`<div class="local-card"><div class="local-card-icon">&#128197;</div><h3>Best time to buy</h3><p>${ctx.seasonNote}</p></div>`);
  if (ctx.localInsight) cards.push(`<div class="local-card"><div class="local-card-icon">&#128161;</div><h3>Local tip</h3><p>${ctx.localInsight}</p></div>`);
  if (!cards.length) return "";
  return `<section class="section"><h2>HVAC in ${city}: what locals should know</h2><div class="local-grid">${cards.join("\n")}</div></section>`;
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
    const cityKey = cityName + "|" + stateCode;
    const cityMult = cityMultipliers[cityKey] ? cityMultipliers[cityKey].multiplier : null;
    const stateMult = pricingModel.stateMultipliers[stateCode] || 1.0;
    const mult = cityMult || stateMult;

    const filename = buildHvacPageFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    // Price ranges from systemTypes.[type].pricingByEfficiency.[tier].total = [low, high]
    const acRange = pricingModel.systemTypes.central_ac.pricingByEfficiency["16_seer"].total;
    const hpRange = pricingModel.systemTypes.heat_pump.pricingByEfficiency["16_seer"].total;
    const furnaceRange = pricingModel.systemTypes.gas_furnace.pricingByEfficiency["90_afue"].total;
    const fullRange = pricingModel.systemTypes.full_system.pricingByEfficiency["16_90"].total;

    function mid(range) { return Math.round((range[0] + range[1]) / 2); }
    const acAvg = Math.round(mid(acRange) * mult / 50) * 50;
    const hpAvg = Math.round(mid(hpRange) * mult / 50) * 50;
    const furnaceAvg = Math.round(mid(furnaceRange) * mult / 50) * 50;
    const fullAvg = Math.round(mid(fullRange) * mult / 50) * 50;

    const avgLowRaw = String(Math.round(acRange[0] * mult));
    const avgHighRaw = String(Math.round(fullRange[1] * mult));
    const avgLow = formatCurrency(acRange[0] * mult);
    const avgHigh = formatCurrency(fullRange[1] * mult);
    const slugLC = slugifyCity(cityName) + "-" + stateCode.toLowerCase();

    // Build price rows from tonnageByHomeSqFt
    const tonMap = pricingModel.tonnageByHomeSqFt;
    const homeSizes = [
      { label: "1,000", sqft: "1000" },
      { label: "1,500", sqft: "1500" },
      { label: "2,000", sqft: "2000" },
      { label: "2,500", sqft: "2500" },
      { label: "3,000", sqft: "3000" },
      { label: "3,500", sqft: "3500" }
    ];
    const priceRows = homeSizes.map(size => {
      const tons = tonMap[size.sqft] || 3;
      const scale = tons / 3; // normalize to 3-ton baseline
      const ac = formatCurrency(Math.round(mid(acRange) * scale * mult / 50) * 50);
      const hp = formatCurrency(Math.round(mid(hpRange) * scale * mult / 50) * 50);
      const full = formatCurrency(Math.round(mid(fullRange) * scale * mult / 50) * 50);
      return `<tr><td>${size.label} sq ft (${tons} ton)</td><td>${ac}</td><td>${hp}</td><td>${full}</td></tr>`;
    }).join("\n");

    let html = template
      .replaceAll("{{CITY}}", cityName)
      .replaceAll("{{STATE_CODE}}", stateCode)
      .replaceAll("{{STATE_NAME}}", stateName)
      .replaceAll("{{CITY_STATE}}", cityState)
      .replaceAll("{{SLUG}}", filename)
      .replaceAll("{{STATE_PAGE_FILENAME}}", `hvac-cost.html`)
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_CENTRAL_AC}}", formatCurrency(acAvg))
      .replaceAll("{{RATE_HEAT_PUMP}}", formatCurrency(hpAvg))
      .replaceAll("{{RATE_FURNACE}}", formatCurrency(furnaceAvg))
      .replaceAll("{{RATE_FULL_SYSTEM}}", formatCurrency(fullAvg))
      .replaceAll("{{PRICE_ROWS}}", priceRows)
      .replaceAll("{{LOCAL_CONTEXT_SECTION}}", buildHvacLocalContext(cityName, stateCode))
      .replaceAll("{{SLUG_LC}}", slugLC)
      .replaceAll("{{AVG_LOW_RAW}}", avgLowRaw)
      .replaceAll("{{AVG_HIGH_RAW}}", avgHighRaw);

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
