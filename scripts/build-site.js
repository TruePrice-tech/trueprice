const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const OUTPUT_PRICING_JSON = path.join(ROOT, "data", "city-house-size-pricing.json");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");
const INDEX_PATH = path.join(ROOT, "index.html");
const TEMPLATE_PATH = path.join(ROOT, "templates", "city-page-template.html");
const ALL_CITIES_TEMPLATE_PATH = path.join(ROOT, "templates", "all-cities-template.html");
const ALL_CITIES_PAGE_PATH = path.join(ROOT, "all-cities.html");

const SITE_BASE_URL = "https://trueprice-tech.github.io/trueprice";

function loadTemplate() {
  return fs.readFileSync(TEMPLATE_PATH, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || "";
    });
    return row;
  });
}

function slugifyCity(city) {
  return city
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function roundToNearest(value, step) {
  return Math.round(value / step) * step;
}

function buildCityPageFilename(city, stateCode) {
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-roof-cost.html`;
}

function calculatePriceTable(cityRow, pricingModel, stateRegions) {
  const region = stateRegions[cityRow.state_code] || "south";
  const laborMultiplier = pricingModel.laborMultiplierByRegion[region] || 1;

  const result = {
    city: cityRow.city,
    state: cityRow.state,
    state_code: cityRow.state_code,
    population: Number(cityRow.population || 0),
    region,
    sizes: {}
  };

  for (const size of pricingModel.houseSizes) {
    const squares = size.roofSquares * pricingModel.wasteFactor;
    result.sizes[size.label] = {};

    for (const [material, basePrice] of Object.entries(
      pricingModel.basePricePerSquare
    )) {
      const rawPrice =
        squares *
        basePrice *
        laborMultiplier *
        pricingModel.overheadMultiplier;

      const rounded = roundToNearest(rawPrice, pricingModel.roundTo);
      result.sizes[size.label][material] = rounded;
    }
  }

  return result;
}

function generateRelatedCityLinks(currentCityPricing, allCityRows) {
  const currentFile = buildCityPageFilename(
    currentCityPricing.city,
    currentCityPricing.state_code
  );

  const related = allCityRows
    .filter((city) => buildCityPageFilename(city.city, city.state_code) !== currentFile)
    .sort((a, b) => Number(b.population || 0) - Number(a.population || 0))
    .slice(0, 8);

  return related
    .map((city) => {
      const filename = buildCityPageFilename(city.city, city.state_code);
      return `<li><a href="/trueprice/${filename}">${city.city}, ${city.state_code}</a></li>`;
    })
    .join("\n");
}

function generateCityPageHtml(cityPricing, allCityRows) {
  let template = loadTemplate();

  const slug = buildCityPageFilename(
    cityPricing.city,
    cityPricing.state_code
  );

  const priceRows = Object.entries(cityPricing.sizes)
    .map(([size, materials]) => {
      return `
<tr>
<td>${size} sq ft</td>
<td>$${materials.asphalt.toLocaleString()}</td>
<td>$${materials.architectural.toLocaleString()}</td>
<td>$${materials.metal.toLocaleString()}</td>
<td>$${materials.tile.toLocaleString()}</td>
</tr>
`;
    })
    .join("");

  const relatedCityLinks = generateRelatedCityLinks(cityPricing, allCityRows);

  template = template.replaceAll("{{CITY}}", cityPricing.city);
  template = template.replaceAll("{{STATE_CODE}}", cityPricing.state_code);
  template = template.replaceAll("{{SLUG}}", slug);
  template = template.replace("{{PRICE_ROWS}}", priceRows);
  template = template.replace("{{RELATED_CITY_LINKS}}", relatedCityLinks);

  return template;
}

function generateHomepageCityLinks(cities) {
  const sorted = [...cities].sort(
    (a, b) => Number(b.population || 0) - Number(a.population || 0)
  );

  const topCities = sorted.slice(0, 24);

  const links = topCities
    .map((city) => {
      const filename = buildCityPageFilename(city.city, city.state_code);
      return `<li><a href="/trueprice/${filename}">${city.city}, ${city.state_code}</a></li>`;
    })
    .join("\n");

  return `
<section class="city-links-section">
  <h2>Roof Cost Guides by City</h2>
  <ul>
    ${links}
  </ul>
</section>
`.trim();
}

function updateHomepageCitySection(cities) {
  if (!fs.existsSync(INDEX_PATH)) {
    console.log("index.html not found. Skipping homepage update.");
    return;
  }

  const indexHtml = fs.readFileSync(INDEX_PATH, "utf8");
  const markerRegex =
    /<!--\s*CITY_LINKS_START\s*-->[\s\S]*?<!--\s*CITY_LINKS_END\s*-->/;

  if (!markerRegex.test(indexHtml)) {
    console.log("City link markers not found in index.html. Skipping homepage update.");
    return;
  }

  const newSection = generateHomepageCityLinks(cities);
  const replacement = `<!-- CITY_LINKS_START -->\n${newSection}\n<!-- CITY_LINKS_END -->`;
  const updated = indexHtml.replace(markerRegex, replacement);

  fs.writeFileSync(INDEX_PATH, updated, "utf8");
  console.log("Updated homepage city section.");
}

function generateSitemap(cityRows) {
  const urls = [
    `${SITE_BASE_URL}/`,
    ...cityRows.map(
      (city) =>
        `${SITE_BASE_URL}/${buildCityPageFilename(city.city, city.state_code)}`
    )
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, xml, "utf8");
  console.log("Generated sitemap.xml");
}

function main() {
  if (!fs.existsSync(INPUT_CSV)) {
    throw new Error("Missing inputs/cities.csv");
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error("Missing templates/city-page-template.html");
  }

  const pricingModel = readJson(PRICING_MODEL_PATH);
  const stateRegions = readJson(STATE_REGIONS_PATH);
  const csvText = fs.readFileSync(INPUT_CSV, "utf8");
  const cityRows = parseCsv(csvText);

  const cityPricingArray = cityRows.map((cityRow) =>
    calculatePriceTable(cityRow, pricingModel, stateRegions)
  );

  fs.writeFileSync(
    OUTPUT_PRICING_JSON,
    JSON.stringify(cityPricingArray, null, 2),
    "utf8"
  );
  console.log("Generated data/city-house-size-pricing.json");

  for (const cityPricing of cityPricingArray) {
    const filename = buildCityPageFilename(
      cityPricing.city,
      cityPricing.state_code
    );
    const filePath = path.join(ROOT, filename);
    const html = generateCityPageHtml(cityPricing, cityRows);

    fs.writeFileSync(filePath, html, "utf8");
    console.log(`Generated ${filename}`);
  }

  updateHomepageCitySection(cityRows);
  generateSitemap(cityRows);

  console.log("Build complete.");
}

main();
