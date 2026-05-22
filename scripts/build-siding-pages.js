const fs = require("fs");
const path = require("path");
require("./_handwritten-guard.js");
const { buildIndexes, renderWidget } = require("./lib/city-nav-widget");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "siding-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "siding-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-siding.xml");
const CITY_MULTIPLIERS_PATH = path.join(ROOT, "data", "city-cost-multipliers.json");

const SITE_BASE_URL = "https://woogoro.com";

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
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-siding-cost.html`;
}


const {
  getSharedCityContext,
  naturalCostFraming,
  climateZoneLeadIn,
  faqCostInCity,
  faqWhyCostDiffers,
  faqBestForCity,
  faqRedFlags,
} = require("./lib/faq-helpers");

const CITY_FAQ_CONTEXT_PATH = path.join(ROOT, "data/siding-city-context.json");
let _sidingFAQContext = null;
function getSidingFAQContext(city, stateCode) {
  if (!_sidingFAQContext) {
    try { _sidingFAQContext = JSON.parse(fs.readFileSync(CITY_FAQ_CONTEXT_PATH, "utf8")); }
    catch (e) { _sidingFAQContext = {}; }
  }
  return _sidingFAQContext[`${city}|${stateCode}`] || null;
}

// Phase 3 city-aware FAQ block. Replaces the 3 hardcoded <details> blocks
// that previously appeared identically across ~740 city pages with 4 FAQs
// that interpolate per-city slot data from data/siding-city-context.json.
// The seasonal FAQ from the Phase 1 gap-list is intentionally dropped:
// seasonNote slot has only 2-3 normalized templates across the corpus, so
// forcing the question would manufacture false per-city specificity.
function buildSidingFAQ({ city, stateCode, multiplier, priceRange }) {
  const ctx = getSidingFAQContext(city, stateCode) || {};
  const shared = getSharedCityContext(city, stateCode) || {};
  const framing = naturalCostFraming(multiplier);

  const q1 = faqCostInCity({
    workLabel: "siding replacement",
    productLabel: "Siding replacement",
    city,
    priceRange,
    framing,
    weatherNote: ctx.climateNote || ctx.waterNote,
    costDriverNote: ctx.costDriverNote,
  });

  const q2 = faqWhyCostDiffers({
    vertical: "siding",
    displayLabel: "Siding replacement",
    city,
    framing,
    costDriverNote: ctx.costDriverNote,
  });

  const q3 = faqBestForCity({
    city,
    productKindLabel: "siding material",
    materialOrSystemNote: ctx.materialTip,
    climateLeadIn: true ? climateZoneLeadIn((shared.climateZone || ""), city) : null,
    climateZone: shared.climateZone,
  });

  const q5 = faqRedFlags({
    city,
    contractorLabel: "siding contractor",
    redFlagNote: ctx.redFlagNote,
  hoaPrevalence: shared.hoaPrevalence,
  growthRate: shared.growthRate,
  });

  return [q1, q2, q3, q5].join("\n\n");
}

function main() {
  const pricingModel = readJson(PRICING_MODEL_PATH);
  const stateRegions = readJson(STATE_REGIONS_PATH);
  let cityMultipliers = {};
  try { cityMultipliers = readJson(CITY_MULTIPLIERS_PATH); } catch (e) { console.warn("city-cost-multipliers.json not found, using region fallback"); }
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const navIndexes = buildIndexes(ROOT);
  const csvText = fs.readFileSync(INPUT_CSV, "utf8");
  const cities = parseCsv(csvText);

  const sitemapUrls = [];
  let generated = 0;

  cities.forEach(city => {
    const cityName = city.city;
    const stateCode = city.state_code;
    const stateName = city.state;
    const region = stateRegions[stateCode] || "south";
    const cityKey = cityName + "|" + stateCode;
    const cityMult = cityMultipliers[cityKey] ? cityMultipliers[cityKey].multiplier : null;
    const laborMult = cityMult || (pricingModel.laborMultiplierByRegion[region] || 1.0);
    const overheadMult = pricingModel.overheadMultiplier || 1.15;

    const filename = buildPageFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    const types = pricingModel.basePriceByType;
    const mult = laborMult * overheadMult;

    // Per-sqft midpoint prices for hero
    const vinylMid = "$" + ((((types.vinyl.lowPerSqft + types.vinyl.highPerSqft) / 2) * mult).toFixed(2));
    const fiberCementMid = "$" + ((((types.fiber_cement.lowPerSqft + types.fiber_cement.highPerSqft) / 2) * mult).toFixed(2));
    const woodMid = "$" + ((((types.wood.lowPerSqft + types.wood.highPerSqft) / 2) * mult).toFixed(2));
    const engineeredMid = "$" + ((((types.engineered_wood.lowPerSqft + types.engineered_wood.highPerSqft) / 2) * mult).toFixed(2));

    // Avg range based on 1500 sqft vinyl (low) to 1500 sqft fiber cement (high)
    const avgLowVal = Math.round(types.vinyl.lowPerSqft * 1500 * mult / 50) * 50;
    const avgHighVal = Math.round(types.fiber_cement.highPerSqft * 1500 * mult / 50) * 50;
    const avgLowRaw = String(avgLowVal);
    const avgHighRaw = String(avgHighVal);
    const avgLow = formatCurrency(avgLowVal);
    const avgHigh = formatCurrency(avgHighVal);
    const slugLC = slugifyCity(cityName) + "-" + stateCode.toLowerCase();

    // Build price rows by home size
    const priceRows = pricingModel.homeSizes.map(size => {
      const sqft = size.sqft;
      const vinyl = formatCurrency(Math.round(((types.vinyl.lowPerSqft + types.vinyl.highPerSqft) / 2) * sqft * mult / 50) * 50);
      const fiberCement = formatCurrency(Math.round(((types.fiber_cement.lowPerSqft + types.fiber_cement.highPerSqft) / 2) * sqft * mult / 50) * 50);
      const engineered = formatCurrency(Math.round(((types.engineered_wood.lowPerSqft + types.engineered_wood.highPerSqft) / 2) * sqft * mult / 50) * 50);
      return `<tr><td>${size.label} sq ft</td><td>${vinyl}</td><td>${fiberCement}</td><td>${engineered}</td></tr>`;
    }).join("\n");
    const __faqServiceMult =
      cityMultipliers[cityKey] && cityMultipliers[cityKey].serviceMultipliers
        ? cityMultipliers[cityKey].serviceMultipliers["siding"]
        : cityMult;
    const __faqBlockHtml = buildSidingFAQ({
      city: cityName,
      stateCode,
      multiplier: __faqServiceMult,
      priceRange: `${avgLow} to ${avgHigh}`,
    });


    let html = template
      .replaceAll("{{CITY}}", cityName)
      .replaceAll("{{STATE_CODE}}", stateCode)
      .replaceAll("{{STATE_NAME}}", stateName)
      .replaceAll("{{CITY_STATE}}", cityState)
      .replaceAll("{{SLUG}}", filename)
      .replaceAll("{{STATE_PAGE_FILENAME}}", `siding-cost.html`)
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_VINYL}}", vinylMid)
      .replaceAll("{{RATE_FIBER_CEMENT}}", fiberCementMid)
      .replaceAll("{{RATE_WOOD}}", woodMid)
      .replaceAll("{{RATE_ENGINEERED}}", engineeredMid)
      .replaceAll("{{PRICE_ROWS}}", priceRows)
      .replaceAll("{{SLUG_LC}}", slugLC)
      .replaceAll("{{AVG_LOW_RAW}}", avgLowRaw)
      .replaceAll("{{AVG_HIGH_RAW}}", avgHighRaw)
      .replaceAll("{{SIDING_FAQ_BLOCK}}", __faqBlockHtml);

    const navWidget = renderWidget({ city: cityName, state: stateCode, vertical: "siding", filename, indexes: navIndexes });

    html = html.replaceAll("{{TP_CITY_NAV_WIDGET}}", navWidget);

    fs.writeFileSync(path.join(ROOT, filename), html, "utf8");
    sitemapUrls.push(`${SITE_BASE_URL}/${filename}`);
    generated++;
  });

  // Generate sitemap
  const today = new Date().toISOString().split("T")[0];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_BASE_URL}/siding-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} siding city pages`);
  console.log(`Generated sitemap-siding.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
