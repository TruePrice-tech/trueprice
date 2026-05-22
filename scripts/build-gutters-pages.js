const fs = require("fs");
const path = require("path");
require("./_handwritten-guard.js");
const { buildIndexes, renderWidget } = require("./lib/city-nav-widget");
const {
  getSharedCityContext,
  naturalCostFraming,
  faqBlock,
  faqCostInCity,
  faqWhyCostDiffers,
  faqBestForCity,
  faqRedFlags,
} = require("./lib/faq-helpers");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "gutters-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "gutters-city-page-template.html");
const CITY_CONTEXT_PATH = path.join(ROOT, "data", "gutter-city-context.json");
const SITEMAP_PATH = path.join(ROOT, "sitemap-gutters.xml");
const CITY_MULTIPLIERS_PATH = path.join(ROOT, "data", "city-cost-multipliers.json");

let _gutterContext = null;
function getGutterContext(city, stateCode) {
  if (!_gutterContext) {
    try { _gutterContext = JSON.parse(fs.readFileSync(CITY_CONTEXT_PATH, "utf8")); }
    catch (e) { _gutterContext = {}; }
  }
  return _gutterContext[`${city}|${stateCode}`] || null;
}

// Phase 3 city-aware FAQ block for gutter pages. Replaces the 3 hardcoded
// FAQs that previously appeared identically across 740 cities, including
// the "How long does a wood gutter last?" bug (wood gutters aren't a
// residential product — the previous answer was the fence FAQ pasted in).
//
// 5 city-aware FAQs (no Q for time-of-year — seasonNote slot has only
// 2 distinct templates after city-name normalization; honest call per the
// Phase 1 gap-list). No Q for permits — gutters rarely require them.
function buildGutterFAQ({ city, stateCode, multiplier, priceRange }) {
  const ctx = getGutterContext(city, stateCode) || {};
  const shared = getSharedCityContext(city, stateCode) || {};
  const framing = naturalCostFraming(multiplier);

  const q1 = faqCostInCity({
    workLabel: "gutter installation",
    productLabel: "Gutter installation",
    city,
    priceRange,
    framing,
    weatherNote: ctx.climateNote,
    costDriverNote: ctx.costDriverNote,
  });

  const q2 = faqWhyCostDiffers({
    vertical: "gutter",
    displayLabel: "Gutter installation",
    city,
    framing,
    costDriverNote: ctx.costDriverNote,
  });

  // Q3 — climate-driven sizing/material/skip-vs-install advice. For gutter
  // this signal lives in climateNote (8 distinct templates after city-norm:
  // ice-dam markets, debris markets, dry markets, etc.).
  const q3 = faqBestForCity({
    city,
    productKindLabel: "gutter setup",
    materialOrSystemNote: ctx.climateNote,
    climateLeadIn: null,
    climateZone: shared.climateZone,
  });

  // Q4 — material/pricing tiers from materialTip (2 distinct templates
  // after city-norm: aluminum-standard markets vs gutter-guard-focused
  // markets). 2 templates is enough to clear the >=50% boilerplate
  // threshold on a 60-city sample.
  const q4 = faqBlock(
    `What gutter material is the best value in ${city}?`,
    ctx.materialTip || `Aluminum seamless gutters are the most common choice in ${city} for cost and lifespan. Copper and zinc offer 50+ year service life at 3-4× the price — worth it on architectural homes, overkill on most.`
  );

  const q5 = faqRedFlags({
    city,
    contractorLabel: "gutter installer",
    redFlagNote: ctx.redFlagNote,
    hoaPrevalence: shared.hoaPrevalence,
    growthRate: shared.growthRate,
  });

  return [q1, q2, q3, q4, q5].join("\n\n");
}

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
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-gutter-cost.html`;
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

    const gutterServiceMult =
      cityMultipliers[cityKey] && cityMultipliers[cityKey].serviceMultipliers
        ? cityMultipliers[cityKey].serviceMultipliers.gutter
        : cityMult;
    const faqBlockHtml = buildGutterFAQ({
      city: cityName,
      stateCode,
      multiplier: gutterServiceMult,
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
      .replaceAll("{{RATE_ALU5}}", formatCurrency(aluRate))
      .replaceAll("{{RATE_VINYL}}", formatCurrency(vinylRate))
      .replaceAll("{{RATE_STEEL}}", formatCurrency(steelRate))
      .replaceAll("{{RATE_ALU6}}", formatCurrency(alu6Rate))
      .replaceAll("{{PRICE_ROWS}}", priceRows)
      .replaceAll("{{SLUG_LC}}", slugLC)
      .replaceAll("{{AVG_LOW_RAW}}", avgLowRaw)
      .replaceAll("{{AVG_HIGH_RAW}}", avgHighRaw)
      .replaceAll("{{GUTTER_FAQ_BLOCK}}", faqBlockHtml);

    const navWidget = renderWidget({ city: cityName, state: stateCode, vertical: "gutter", filename, indexes: navIndexes });

    html = html.replaceAll("{{TP_CITY_NAV_WIDGET}}", navWidget);

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
