const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const OUTPUT_PRICING_JSON = path.join(ROOT, "data", "city-house-size-pricing.json");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");
const INDEX_PATH = path.join(ROOT, "index.html");

const SITE_BASE_URL = "https://trueprice-tech.github.io/trueprice";
function loadTemplate() {
  return fs.readFileSync("templates/city-page-template.html", "utf8");
}
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
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

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
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

    for (const [material, basePrice] of Object.entries(pricingModel.basePricePerSquare)) {
      const rawPrice = squares * basePrice * laborMultiplier * pricingModel.overheadMultiplier;
      const rounded = roundToNearest(rawPrice, pricingModel.roundTo);
      result.sizes[size.label][material] = rounded;
    }
  }

  return result;
}

function generateCityPageHtml(cityPricing) {

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

  template = template.replaceAll("{{CITY}}", cityPricing.city);
  template = template.replaceAll("{{STATE_CODE}}", cityPricing.state_code);
  template = template.replaceAll("{{SLUG}}", slug);
  template = template.replace("{{PRICE_ROWS}}", priceRows);

  return template;
}

  const pricingScript = JSON.stringify(cityPricing);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />

  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonical}" />

  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #1f2937;
      background: #ffffff;
      line-height: 1.6;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 20px 60px;
    }
    h1, h2 {
      color: #111827;
    }
    .lead {
      font-size: 1.1rem;
      margin-bottom: 24px;
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      background: #f9fafb;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 12px;
      text-align: left;
    }
    th {
      background: #f3f4f6;
    }
    .small {
      color: #6b7280;
      font-size: 0.95rem;
    }
    a {
      color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Roof Replacement Cost in ${city} ${stateCode}</h1>
    <p class="lead">
      Use this local pricing guide to estimate a fair roof replacement cost in ${city}, ${state}.
    </p>

    <div class="card">
      <h2>Average Roofing Prices by House Size</h2>
      <table>
        <thead>
          <tr>
            <th>House Size</th>
            <th>Asphalt</th>
            <th>Architectural</th>
            <th>Metal</th>
            <th>Tile</th>
          </tr>
        </thead>
        <tbody>
          ${sizeRows}
        </tbody>
      </table>
      <p class="small">
        Estimates are modeled using regional labor assumptions and generalized roof size conversion factors.
      </p>
    </div>

    <div class="card">
      <h2>How to use this page</h2>
      <p>
        Compare your quote to the ranges above. If your contractor pricing is far above modeled fair value, it may be worth requesting a detailed scope breakdown and a second quote.
      </p>
    </div>

    <div class="card">
      <h2>Get more value from TruePrice</h2>
      <p>
        Go back to the <a href="${SITE_BASE_URL}/">homepage</a> to use the calculator, quote analyzer, and comparison tools.
      </p>
    </div>
  </div>

  <script>
    window.TRUEPRICE_CITY_PRICING = ${pricingScript};
  </script>
</body>
</html>`;
}

function generateHomepageCityLinks(cities) {
  const sorted = [...cities].sort((a, b) => Number(b.population) - Number(a.population));
  const topCities = sorted.slice(0, 24);

  const links = topCities.map(city => {
    const filename = buildCityPageFilename(city.city, city.state_code);
    return `<li><a href="/trueprice/${filename}">${city.city}, ${city.state_code}</a></li>`;
  }).join("\n");

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
  const startMarker = "<!-- CITY_LINKS_START -->";
  const endMarker = "<!-- CITY_LINKS_END -->";

  if (!indexHtml.includes(startMarker) || !indexHtml.includes(endMarker)) {
    console.log("City link markers not found in index.html. Skipping homepage update.");
    return;
  }

  const newSection = generateHomepageCityLinks(cities);
  const updated = indexHtml.replace(
    new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`),
    `${startMarker}\n${newSection}\n${endMarker}`
  );

  fs.writeFileSync(INDEX_PATH, updated, "utf8");
  console.log("Updated homepage city section.");
}

function generateSitemap(cityRows) {
  const urls = [
    `${SITE_BASE_URL}/`,
    ...cityRows.map(city => `${SITE_BASE_URL}/${buildCityPageFilename(city.city, city.state_code)}`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH, xml, "utf8");
  console.log("Generated sitemap.xml");
}

function main() {
  if (!fs.existsSync(INPUT_CSV)) {
    throw new Error("Missing inputs/cities.csv");
  }

  const pricingModel = readJson(PRICING_MODEL_PATH);
  const stateRegions = readJson(STATE_REGIONS_PATH);
  const csvText = fs.readFileSync(INPUT_CSV, "utf8");
  const cityRows = parseCsv(csvText);

  const cityPricingArray = cityRows.map(cityRow =>
    calculatePriceTable(cityRow, pricingModel, stateRegions)
  );

  fs.writeFileSync(
    OUTPUT_PRICING_JSON,
    JSON.stringify(cityPricingArray, null, 2),
    "utf8"
  );
  console.log("Generated data/city-house-size-pricing.json");

  for (const cityPricing of cityPricingArray) {
    const filename = buildCityPageFilename(cityPricing.city, cityPricing.state_code);
    const filePath = path.join(ROOT, filename);
    const html = generateCityPageHtml(cityPricing);
    fs.writeFileSync(filePath, html, "utf8");
    console.log(`Generated ${filename}`);
  }

  updateHomepageCitySection(cityRows);
  generateSitemap(cityRows);

  console.log("Build complete.");
}

main();
