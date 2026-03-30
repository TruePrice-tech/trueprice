const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "plumbing-pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "plumbing-city-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-plumbing.xml");
const CONTEXT_PATH = path.join(ROOT, "data", "plumbing-city-context.json");
const CITY_MULTIPLIERS_PATH = path.join(ROOT, "data", "city-cost-multipliers.json");
const SITE_BASE_URL = "https://truepricehq.com";

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }

let _plumbContext = null;
function buildPlumbingLocalContext(city, stateCode) {
  if (!_plumbContext) {
    try { _plumbContext = readJson(CONTEXT_PATH); } catch(e) { _plumbContext = {}; }
  }
  const ctx = _plumbContext[`${city}|${stateCode}`];
  if (!ctx) return "";
  const cards = [];
  if (ctx.waterNote) cards.push(`<div class="local-card"><div class="local-card-icon">&#128167;</div><h3>Water quality</h3><p>${ctx.waterNote}</p></div>`);
  if (ctx.freezeRisk) cards.push(`<div class="local-card"><div class="local-card-icon">&#10052;</div><h3>Freeze risk</h3><p>${ctx.freezeRisk}</p></div>`);
  if (ctx.materialTip) cards.push(`<div class="local-card"><div class="local-card-icon">&#128295;</div><h3>Material recommendation</h3><p>${ctx.materialTip}</p></div>`);
  if (ctx.localInsight) cards.push(`<div class="local-card"><div class="local-card-icon">&#128161;</div><h3>Local tip</h3><p>${ctx.localInsight}</p></div>`);
  if (!cards.length) return "";
  return `<section class="section"><h2>Plumbing in ${city}: what locals should know</h2><div class="local-grid">${cards.join("\n")}</div></section>`;
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(",").map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

function slugify(text) { return text.toLowerCase().replace(/[^\w\s]/g, "").trim().replace(/\s+/g, "-"); }
function formatCurrency(v) { return "$" + Math.round(v).toLocaleString(); }

function main() {
  const pm = readJson(PRICING_MODEL_PATH);
  const sr = readJson(STATE_REGIONS_PATH);
  let cityMultipliers = {};
  try { cityMultipliers = readJson(CITY_MULTIPLIERS_PATH); } catch (e) { console.warn("city-cost-multipliers.json not found, using region fallback"); }
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const cities = parseCsv(fs.readFileSync(INPUT_CSV, "utf8"));

  const sitemapUrls = [];
  let count = 0;

  cities.forEach(city => {
    const name = city.city;
    const sc = city.state_code;
    const state = city.state;
    const region = sr[state] || sr[sc] || "south";
    const cityKey = name + "|" + sc;
    const cityMult = cityMultipliers[cityKey] ? cityMultipliers[cityKey].multiplier : null;
    const lm = cityMult || (pm.laborMultiplierByRegion[region] || 1.0);
    const om = pm.overheadMultiplier;
    const round = pm.roundTo;

    const filename = `${slugify(name)}-${sc.toLowerCase()}-plumbing-cost.html`;
    const cityState = `${name}, ${sc}`;

    const whPrice = Math.round(pm.basePriceByService.water_heater.priceByType.tank_50_gas * lm * om / round) * round;
    const repipePrice = Math.round(pm.basePriceByService.repipe.priceByMaterial.pex * lm * om / round) * round;
    const sewerPrice = Math.round(pm.basePriceByService.sewer_line.priceByMethod.traditional_dig * lm * om / round) * round;
    const drainPrice = Math.round(pm.basePriceByService.drain_cleaning.priceByType.main_line * lm * om / round) * round;

    const avgLowVal = drainPrice;
    const avgHighVal = Math.round(pm.basePriceByService.repipe.priceByMaterial.copper * lm * om / round) * round;
    const avgLowRaw = String(avgLowVal);
    const avgHighRaw = String(avgHighVal);
    const avgLow = formatCurrency(avgLowVal);
    const avgHigh = formatCurrency(avgHighVal);
    const slugLC = slugify(name) + "-" + sc.toLowerCase();

    const priceRows = [
      ["Water Heater (50 gal tank)", formatCurrency(whPrice * 0.85) + " &ndash; " + formatCurrency(whPrice * 1.15)],
      ["Tankless Water Heater", formatCurrency(Math.round(pm.basePriceByService.water_heater.priceByType.tankless_gas * lm * om / round) * round * 0.9) + " &ndash; " + formatCurrency(Math.round(pm.basePriceByService.water_heater.priceByType.tankless_gas * lm * om / round) * round * 1.1)],
      ["Whole House Repipe (PEX)", formatCurrency(repipePrice * 0.85) + " &ndash; " + formatCurrency(repipePrice * 1.15)],
      ["Whole House Repipe (Copper)", formatCurrency(Math.round(pm.basePriceByService.repipe.priceByMaterial.copper * lm * om / round) * round * 0.85) + " &ndash; " + formatCurrency(Math.round(pm.basePriceByService.repipe.priceByMaterial.copper * lm * om / round) * round * 1.15)],
      ["Sewer Line Replacement", formatCurrency(sewerPrice * 0.85) + " &ndash; " + formatCurrency(sewerPrice * 1.15)],
      ["Trenchless Sewer Repair", formatCurrency(Math.round(pm.basePriceByService.sewer_line.priceByMethod.trenchless * lm * om / round) * round * 0.9) + " &ndash; " + formatCurrency(Math.round(pm.basePriceByService.sewer_line.priceByMethod.trenchless * lm * om / round) * round * 1.1)],
      ["Drain Cleaning (main line)", formatCurrency(drainPrice * 0.8) + " &ndash; " + formatCurrency(drainPrice * 1.2)],
      ["Bathroom Rough-In", formatCurrency(Math.round(pm.basePriceByService.bathroom_rough_in.priceByScope.full_bath * lm * om / round) * round * 0.85) + " &ndash; " + formatCurrency(Math.round(pm.basePriceByService.bathroom_rough_in.priceByScope.full_bath * lm * om / round) * round * 1.15)],
      ["Gas Line Installation", formatCurrency(Math.round(pm.basePriceByService.gas_line.priceByLength.medium_20_50ft * lm * om / round) * round * 0.85) + " &ndash; " + formatCurrency(Math.round(pm.basePriceByService.gas_line.priceByLength.medium_20_50ft * lm * om / round) * round * 1.15)]
    ].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("\n");

    let html = template
      .replaceAll("{{CITY}}", name)
      .replaceAll("{{STATE_CODE}}", sc)
      .replaceAll("{{CITY_STATE}}", cityState)
      .replaceAll("{{SLUG}}", filename)
      .replaceAll("{{AVG_LOW}}", avgLow)
      .replaceAll("{{AVG_HIGH}}", avgHigh)
      .replaceAll("{{RATE_WATER_HEATER}}", formatCurrency(whPrice))
      .replaceAll("{{RATE_REPIPE}}", formatCurrency(repipePrice))
      .replaceAll("{{RATE_SEWER}}", formatCurrency(sewerPrice))
      .replaceAll("{{RATE_DRAIN}}", formatCurrency(drainPrice))
      .replaceAll("{{PRICE_ROWS}}", priceRows)
      .replaceAll("{{LOCAL_CONTEXT_SECTION}}", buildPlumbingLocalContext(name, sc))
      .replaceAll("{{SLUG_LC}}", slugLC)
      .replaceAll("{{AVG_LOW_RAW}}", avgLowRaw)
      .replaceAll("{{AVG_HIGH_RAW}}", avgHighRaw);

    fs.writeFileSync(path.join(ROOT, filename), html, "utf8");
    sitemapUrls.push(`${SITE_BASE_URL}/${filename}`);
    count++;
  });

  const today = new Date().toISOString().split("T")[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_BASE_URL}/plumbing-cost.html</loc><lastmod>${today}</lastmod></url>
${sitemapUrls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, xml, "utf8");
  console.log(`Generated ${count} plumbing city pages`);
  console.log(`Generated sitemap-plumbing.xml with ${sitemapUrls.length + 1} URLs`);
}

main();
