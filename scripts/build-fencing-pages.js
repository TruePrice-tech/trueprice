const fs = require("fs");
const path = require("path");
require("./_handwritten-guard.js");
const { buildIndexes, renderWidget } = require("./lib/city-nav-widget");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "fencing-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "fencing-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-fencing.xml");
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
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-fence-cost.html`;
}


const {
  naturalCostFraming,
  climateZoneLeadIn,
  faqCostInCity,
  faqWhyCostDiffers,
  faqBestForCity,
  faqRedFlags,
} = require("./lib/faq-helpers");

const CITY_FAQ_CONTEXT_PATH = path.join(ROOT, "data/fence-city-context.json");
let _fenceFAQContext = null;
function getFenceFAQContext(city, stateCode) {
  if (!_fenceFAQContext) {
    try { _fenceFAQContext = JSON.parse(fs.readFileSync(CITY_FAQ_CONTEXT_PATH, "utf8")); }
    catch (e) { _fenceFAQContext = {}; }
  }
  return _fenceFAQContext[`${city}|${stateCode}`] || null;
}

// Phase 3 city-aware FAQ block. Replaces the 3 hardcoded <details> blocks
// that previously appeared identically across ~740 city pages with 4 FAQs
// that interpolate per-city slot data from data/fence-city-context.json.
// The seasonal FAQ from the Phase 1 gap-list is intentionally dropped:
// seasonNote slot has only 2-3 normalized templates across the corpus, so
// forcing the question would manufacture false per-city specificity.
function buildFenceFAQ({ city, stateCode, multiplier, priceRange }) {
  const ctx = getFenceFAQContext(city, stateCode) || {};
  const framing = naturalCostFraming(multiplier);

  const q1 = faqCostInCity({
    workLabel: "fence installation",
    productLabel: "Fence installation",
    city,
    priceRange,
    framing,
    weatherNote: ctx.climateNote || ctx.waterNote,
    costDriverNote: ctx.costDriverNote,
  });

  const q2 = faqWhyCostDiffers({
    vertical: "fence",
    displayLabel: "Fence installation",
    city,
    framing,
    costDriverNote: ctx.costDriverNote,
  });

  const q3 = faqBestForCity({
    city,
    productKindLabel: "fence material",
    materialOrSystemNote: ctx.climateNote,
    climateLeadIn: false ? climateZoneLeadIn((ctx.climateZone || ""), city) : null,
  });

  const q5 = faqRedFlags({
    city,
    contractorLabel: "fence contractor",
    redFlagNote: ctx.redFlagNote,
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

    const woodMid = pricingModel.basePricePerLinearFoot.wood_privacy.mid;
    const vinylMid = pricingModel.basePricePerLinearFoot.vinyl_privacy.mid;
    const chainMid = pricingModel.basePricePerLinearFoot.chain_link.mid;
    const aluminumMid = pricingModel.basePricePerLinearFoot.aluminum.mid;
    const ironMid = pricingModel.basePricePerLinearFoot.wrought_iron.mid;

    const woodRate = Math.round(woodMid * laborMult * overheadMult);
    const vinylRate = Math.round(vinylMid * laborMult * overheadMult);
    const chainRate = Math.round(chainMid * laborMult * overheadMult);
    const ironRate = Math.round(ironMid * laborMult * overheadMult);

    // Average based on 200 LF yard
    const avgLF = 200;
    const avgLowVal = Math.round(chainMid * avgLF * laborMult * overheadMult / 50) * 50;
    const avgHighVal = Math.round(ironMid * avgLF * laborMult * overheadMult / 50) * 50;
    const avgLowRaw = String(avgLowVal);
    const avgHighRaw = String(avgHighVal);
    const avgLow = formatCurrency(avgLowVal);
    const avgHigh = formatCurrency(avgHighVal);
    const slugLC = slugifyCity(cityName) + "-" + stateCode.toLowerCase();

    // Build price rows
    const priceRows = pricingModel.yardSizes.map(size => {
      const lf = size.linearFeet;
      const woodPrice = formatCurrency(Math.round(woodMid * lf * laborMult * overheadMult / 50) * 50);
      const vinylPrice = formatCurrency(Math.round(vinylMid * lf * laborMult * overheadMult / 50) * 50);
      const chainPrice = formatCurrency(Math.round(chainMid * lf * laborMult * overheadMult / 50) * 50);
      return `<tr><td>${size.label} LF</td><td>${woodPrice}</td><td>${vinylPrice}</td><td>${chainPrice}</td></tr>`;
    }).join("\n");
    const __faqServiceMult =
      cityMultipliers[cityKey] && cityMultipliers[cityKey].serviceMultipliers
        ? cityMultipliers[cityKey].serviceMultipliers["fencing"]
        : cityMult;
    const __faqBlockHtml = buildFenceFAQ({
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
      .replaceAll("{{RATE_WOOD}}", formatCurrency(woodRate))
      .replaceAll("{{RATE_VINYL}}", formatCurrency(vinylRate))
      .replaceAll("{{RATE_CHAINLINK}}", formatCurrency(chainRate))
      .replaceAll("{{RATE_WROUGHTIRON}}", formatCurrency(ironRate))
      .replaceAll("{{PRICE_ROWS}}", priceRows)
      .replaceAll("{{SLUG_LC}}", slugLC)
      .replaceAll("{{AVG_LOW_RAW}}", avgLowRaw)
      .replaceAll("{{AVG_HIGH_RAW}}", avgHighRaw)
      .replaceAll("{{FENCE_FAQ_BLOCK}}", __faqBlockHtml);

    const navWidget = renderWidget({ city: cityName, state: stateCode, vertical: "fence", filename, indexes: navIndexes });

    html = html.replaceAll("{{TP_CITY_NAV_WIDGET}}", navWidget);

    fs.writeFileSync(path.join(ROOT, filename), html, "utf8");
    sitemapUrls.push(`${SITE_BASE_URL}/${filename}`);
    generated++;
  });

  // Generate sitemap
  const today = new Date().toISOString().split("T")[0];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_BASE_URL}/fence-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} fencing city pages`);
  console.log(`Generated sitemap-fencing.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
