const fs = require("fs");
const path = require("path");
require("./_handwritten-guard.js");
const { buildIndexes, renderWidget } = require("./lib/city-nav-widget");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "concrete-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "concrete-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-concrete.xml");
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

function formatCurrency(value) {
  return "$" + Math.round(value).toLocaleString();
}

function buildPageFilename(city, stateCode) {
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-concrete-cost.html`;
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

const CITY_FAQ_CONTEXT_PATH = path.join(ROOT, "data/concrete-city-context.json");
let _concreteFAQContext = null;
function getConcreteFAQContext(city, stateCode) {
  if (!_concreteFAQContext) {
    try { _concreteFAQContext = JSON.parse(fs.readFileSync(CITY_FAQ_CONTEXT_PATH, "utf8")); }
    catch (e) { _concreteFAQContext = {}; }
  }
  return _concreteFAQContext[`${city}|${stateCode}`] || null;
}

// Phase 3 city-aware FAQ block. Replaces the 3 hardcoded <details> blocks
// that previously appeared identically across ~740 city pages with 4 FAQs
// that interpolate per-city slot data from data/concrete-city-context.json.
// The seasonal FAQ from the Phase 1 gap-list is intentionally dropped:
// seasonNote slot has only 2-3 normalized templates across the corpus, so
// forcing the question would manufacture false per-city specificity.
function buildConcreteFAQ({ city, stateCode, multiplier, priceRange }) {
  const ctx = getConcreteFAQContext(city, stateCode) || {};
  const shared = getSharedCityContext(city, stateCode) || {};
  const framing = naturalCostFraming(multiplier);

  const q1 = faqCostInCity({
    workLabel: "concrete work",
    productLabel: "Concrete work",
    city,
    priceRange,
    framing,
    weatherNote: ctx.climateNote || ctx.waterNote,
    costDriverNote: ctx.costDriverNote,
  });

  const q2 = faqWhyCostDiffers({
    vertical: "concrete",
    displayLabel: "Concrete work",
    city,
    framing,
    costDriverNote: ctx.costDriverNote,
  });

  const q3 = faqBestForCity({
    city,
    productKindLabel: "concrete mix and prep",
    materialOrSystemNote: ctx.materialTip,
    climateLeadIn: true ? climateZoneLeadIn((shared.climateZone || ""), city) : null,
    climateZone: shared.climateZone,
  });

  const q5 = faqRedFlags({
    city,
    contractorLabel: "concrete contractor",
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
    const region = stateRegions[stateName] || stateRegions[stateCode] || "south";
    const cityKey = cityName + "|" + stateCode;
    const cityMult = cityMultipliers[cityKey] ? cityMultipliers[cityKey].multiplier : null;
    const laborMult = cityMult || (pricingModel.laborMultiplierByRegion[region] || 1.0);
    const overheadMult = pricingModel.overheadMultiplier || 1.15;

    const filename = buildPageFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    const drivewayMid = pricingModel.basePricePerSqft.standard_driveway.mid;
    const stampedMid = pricingModel.basePricePerSqft.stamped_concrete.mid;
    const patioMid = pricingModel.basePricePerSqft.concrete_patio.mid;
    const asphaltMid = pricingModel.basePricePerSqft.asphalt_driveway.mid;

    const drivewayRate = Math.round(drivewayMid * laborMult * overheadMult);
    const stampedRate = Math.round(stampedMid * laborMult * overheadMult);
    const patioRate = Math.round(patioMid * laborMult * overheadMult);
    const asphaltRate = Math.round(asphaltMid * laborMult * overheadMult);

    // Average based on 600 sqft project
    const avgSqft = 600;
    const avgLowVal = Math.round(asphaltMid * avgSqft * laborMult * overheadMult / 50) * 50;
    const avgHighVal = Math.round(stampedMid * avgSqft * laborMult * overheadMult / 50) * 50;
    const avgLowRaw = String(avgLowVal);
    const avgHighRaw = String(avgHighVal);
    const avgLow = formatCurrency(avgLowVal);
    const avgHigh = formatCurrency(avgHighVal);
    const slugLC = slugifyCity(cityName) + "-" + stateCode.toLowerCase();

    // Build price rows
    const priceRows = pricingModel.projectSizes.map(size => {
      const sqft = size.sqft;
      const driveway = formatCurrency(Math.round(drivewayMid * sqft * laborMult * overheadMult / 50) * 50);
      const stamped = formatCurrency(Math.round(stampedMid * sqft * laborMult * overheadMult / 50) * 50);
      const patio = formatCurrency(Math.round(patioMid * sqft * laborMult * overheadMult / 50) * 50);
      return `<tr><td>${size.label} sq ft</td><td>${driveway}</td><td>${stamped}</td><td>${patio}</td></tr>`;
    }).join("\n");
    const __faqServiceMult =
      cityMultipliers[cityKey] && cityMultipliers[cityKey].serviceMultipliers
        ? cityMultipliers[cityKey].serviceMultipliers["concrete"]
        : cityMult;
    const __faqBlockHtml = buildConcreteFAQ({
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
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_DRIVEWAY}}", formatCurrency(drivewayRate))
      .replaceAll("{{RATE_STAMPED}}", formatCurrency(stampedRate))
      .replaceAll("{{RATE_PATIO}}", formatCurrency(patioRate))
      .replaceAll("{{RATE_ASPHALT}}", formatCurrency(asphaltRate))
      .replaceAll("{{PRICE_ROWS}}", priceRows)
      .replaceAll("{{SLUG_LC}}", slugLC)
      .replaceAll("{{AVG_LOW_RAW}}", avgLowRaw)
      .replaceAll("{{AVG_HIGH_RAW}}", avgHighRaw)
      .replaceAll("{{CONCRETE_FAQ_BLOCK}}", __faqBlockHtml);

    const navWidget = renderWidget({ city: cityName, state: stateCode, vertical: "concrete", filename, indexes: navIndexes });

    html = html.replaceAll("{{TP_CITY_NAV_WIDGET}}", navWidget);

    fs.writeFileSync(path.join(ROOT, filename), html, "utf8");
    sitemapUrls.push(`${SITE_BASE_URL}/${filename}`);
    generated++;
  });

  // Generate sitemap
  const today = new Date().toISOString().split("T")[0];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_BASE_URL}/concrete-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} concrete city pages`);
  console.log(`Generated sitemap-concrete.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
