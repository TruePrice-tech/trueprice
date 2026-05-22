const fs = require("fs");
const path = require("path");
require("./_handwritten-guard.js");
const { buildIndexes, renderWidget } = require("./lib/city-nav-widget");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "window-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "window-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-window.xml");
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
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-window-cost.html`;
}


const {
  naturalCostFraming,
  climateZoneLeadIn,
  faqCostInCity,
  faqWhyCostDiffers,
  faqBestForCity,
  faqRedFlags,
} = require("./lib/faq-helpers");

const CITY_FAQ_CONTEXT_PATH = path.join(ROOT, "data/window-city-context.json");
let _windowFAQContext = null;
function getWindowFAQContext(city, stateCode) {
  if (!_windowFAQContext) {
    try { _windowFAQContext = JSON.parse(fs.readFileSync(CITY_FAQ_CONTEXT_PATH, "utf8")); }
    catch (e) { _windowFAQContext = {}; }
  }
  return _windowFAQContext[`${city}|${stateCode}`] || null;
}

// Phase 3 city-aware FAQ block. Replaces the 3 hardcoded <details> blocks
// that previously appeared identically across ~740 city pages with 4 FAQs
// that interpolate per-city slot data from data/window-city-context.json.
// The seasonal FAQ from the Phase 1 gap-list is intentionally dropped:
// seasonNote slot has only 2-3 normalized templates across the corpus, so
// forcing the question would manufacture false per-city specificity.
function buildWindowFAQ({ city, stateCode, multiplier, priceRange }) {
  const ctx = getWindowFAQContext(city, stateCode) || {};
  const framing = naturalCostFraming(multiplier);

  const q1 = faqCostInCity({
    workLabel: "window replacement",
    productLabel: "Window replacement",
    city,
    priceRange,
    framing,
    weatherNote: ctx.climateNote || ctx.waterNote,
    costDriverNote: ctx.costDriverNote,
  });

  const q2 = faqWhyCostDiffers({
    vertical: "window",
    displayLabel: "Window replacement",
    city,
    framing,
    costDriverNote: ctx.costDriverNote,
  });

  const q3 = faqBestForCity({
    city,
    productKindLabel: "window type",
    materialOrSystemNote: ctx.climateNote,
    climateLeadIn: false ? climateZoneLeadIn((ctx.climateZone || ""), city) : null,
  });

  const q5 = faqRedFlags({
    city,
    contractorLabel: "window installer",
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
    const region = stateRegions[stateCode] || "south";
    const cityKey = cityName + "|" + stateCode;
    const cityMult = cityMultipliers[cityKey] ? cityMultipliers[cityKey].multiplier : null;
    const laborMult = cityMult || (pricingModel.laborMultiplierByRegion[region] || 1.0);
    const overheadMult = pricingModel.overheadMultiplier || 1.15;

    const filename = buildPageFilename(cityName, stateCode);
    const cityState = `${cityName}, ${stateCode}`;

    const types = pricingModel.basePriceByType;
    const mult = laborMult * overheadMult;

    // Per-window midpoint prices for hero
    const vinylMid = formatCurrency(Math.round(((types.vinyl.lowPerUnit + types.vinyl.highPerUnit) / 2) * mult / 50) * 50);
    const woodMid = formatCurrency(Math.round(((types.wood.lowPerUnit + types.wood.highPerUnit) / 2) * mult / 50) * 50);
    const fiberglassMid = formatCurrency(Math.round(((types.fiberglass.lowPerUnit + types.fiberglass.highPerUnit) / 2) * mult / 50) * 50);
    const entryDoorMid = formatCurrency(Math.round(((types.entry_door.lowPerUnit + types.entry_door.highPerUnit) / 2) * mult / 50) * 50);

    // Avg range based on 15 vinyl windows (low) to 15 wood windows (high)
    const avgLowVal = Math.round(types.vinyl.lowPerUnit * 15 * mult / 50) * 50;
    const avgHighVal = Math.round(types.wood.highPerUnit * 15 * mult / 50) * 50;
    const avgLowRaw = String(avgLowVal);
    const avgHighRaw = String(avgHighVal);
    const avgLow = formatCurrency(avgLowVal);
    const avgHigh = formatCurrency(avgHighVal);
    const slugLC = slugifyCity(cityName) + "-" + stateCode.toLowerCase();

    // Build price rows by home size (number of windows)
    const priceRows = pricingModel.homeSizes.map(size => {
      const w = size.windows;
      const vinyl = formatCurrency(Math.round(((types.vinyl.lowPerUnit + types.vinyl.highPerUnit) / 2) * w * mult / 50) * 50);
      const wood = formatCurrency(Math.round(((types.wood.lowPerUnit + types.wood.highPerUnit) / 2) * w * mult / 50) * 50);
      const fiberglass = formatCurrency(Math.round(((types.fiberglass.lowPerUnit + types.fiberglass.highPerUnit) / 2) * w * mult / 50) * 50);
      return `<tr><td>${size.label}</td><td>${vinyl}</td><td>${wood}</td><td>${fiberglass}</td></tr>`;
    }).join("\n");
    const __faqServiceMult =
      cityMultipliers[cityKey] && cityMultipliers[cityKey].serviceMultipliers
        ? cityMultipliers[cityKey].serviceMultipliers["window"]
        : cityMult;
    const __faqBlockHtml = buildWindowFAQ({
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
      .replaceAll("{{STATE_PAGE_FILENAME}}", `window-replacement-cost.html`)
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_VINYL}}", vinylMid)
      .replaceAll("{{RATE_WOOD}}", woodMid)
      .replaceAll("{{RATE_FIBERGLASS}}", fiberglassMid)
      .replaceAll("{{RATE_ENTRY_DOOR}}", entryDoorMid)
      .replaceAll("{{PRICE_ROWS}}", priceRows)
      .replaceAll("{{SLUG_LC}}", slugLC)
      .replaceAll("{{AVG_LOW_RAW}}", avgLowRaw)
      .replaceAll("{{AVG_HIGH_RAW}}", avgHighRaw)
      .replaceAll("{{WINDOW_FAQ_BLOCK}}", __faqBlockHtml);

    const navWidget = renderWidget({ city: cityName, state: stateCode, vertical: "window", filename, indexes: navIndexes });

    html = html.replaceAll("{{TP_CITY_NAV_WIDGET}}", navWidget);

    fs.writeFileSync(path.join(ROOT, filename), html, "utf8");
    sitemapUrls.push(`${SITE_BASE_URL}/${filename}`);
    generated++;
  });

  // Generate sitemap
  const today = new Date().toISOString().split("T")[0];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_BASE_URL}/window-replacement-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(url => `  <url><loc>${url}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

  console.log(`Generated ${generated} window city pages`);
  console.log(`Generated sitemap-window.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
