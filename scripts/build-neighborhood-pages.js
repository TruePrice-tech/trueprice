const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const INPUT_CSV = path.join(ROOT, "inputs", "cities.csv");
const PRICING_MODEL_PATH = path.join(ROOT, "data", "pricing-model.json");
const STATE_REGIONS_PATH = path.join(ROOT, "data", "state-regions.json");
const TEMPLATE_PATH = path.join(ROOT, "templates", "neighborhood-page-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap-neighborhoods.xml");

const SITE_BASE_URL = "https://truepricehq.com";

// ---------------------------------------------------------------------------
// Neighborhood data for the top 10 US metros
// ---------------------------------------------------------------------------
const NEIGHBORHOODS = [
  // New York, NY
  { name: "Manhattan", parentCity: "New York", parentState: "New York", stateCode: "NY" },
  { name: "Brooklyn", parentCity: "New York", parentState: "New York", stateCode: "NY" },
  { name: "Queens", parentCity: "New York", parentState: "New York", stateCode: "NY" },
  { name: "Bronx", parentCity: "New York", parentState: "New York", stateCode: "NY" },
  { name: "Staten Island", parentCity: "New York", parentState: "New York", stateCode: "NY" },
  { name: "Harlem", parentCity: "New York", parentState: "New York", stateCode: "NY" },
  { name: "Upper West Side", parentCity: "New York", parentState: "New York", stateCode: "NY" },
  { name: "Astoria", parentCity: "New York", parentState: "New York", stateCode: "NY" },
  { name: "Williamsburg", parentCity: "New York", parentState: "New York", stateCode: "NY" },
  { name: "Park Slope", parentCity: "New York", parentState: "New York", stateCode: "NY" },

  // Los Angeles, CA
  { name: "Hollywood", parentCity: "Los Angeles", parentState: "California", stateCode: "CA" },
  { name: "Beverly Hills", parentCity: "Los Angeles", parentState: "California", stateCode: "CA" },
  { name: "Santa Monica", parentCity: "Los Angeles", parentState: "California", stateCode: "CA" },
  { name: "Pasadena", parentCity: "Los Angeles", parentState: "California", stateCode: "CA" },
  { name: "Glendale", parentCity: "Los Angeles", parentState: "California", stateCode: "CA" },
  { name: "Burbank", parentCity: "Los Angeles", parentState: "California", stateCode: "CA" },
  { name: "Long Beach", parentCity: "Los Angeles", parentState: "California", stateCode: "CA" },
  { name: "Torrance", parentCity: "Los Angeles", parentState: "California", stateCode: "CA" },
  { name: "Inglewood", parentCity: "Los Angeles", parentState: "California", stateCode: "CA" },
  { name: "Culver City", parentCity: "Los Angeles", parentState: "California", stateCode: "CA" },

  // Houston, TX
  { name: "The Woodlands", parentCity: "Houston", parentState: "Texas", stateCode: "TX" },
  { name: "Katy", parentCity: "Houston", parentState: "Texas", stateCode: "TX" },
  { name: "Sugar Land", parentCity: "Houston", parentState: "Texas", stateCode: "TX" },
  { name: "Pearland", parentCity: "Houston", parentState: "Texas", stateCode: "TX" },
  { name: "Spring", parentCity: "Houston", parentState: "Texas", stateCode: "TX" },
  { name: "Cypress", parentCity: "Houston", parentState: "Texas", stateCode: "TX" },
  { name: "Memorial", parentCity: "Houston", parentState: "Texas", stateCode: "TX" },
  { name: "Heights", parentCity: "Houston", parentState: "Texas", stateCode: "TX" },
  { name: "Montrose", parentCity: "Houston", parentState: "Texas", stateCode: "TX" },
  { name: "Clear Lake", parentCity: "Houston", parentState: "Texas", stateCode: "TX" },

  // Phoenix, AZ
  { name: "Scottsdale", parentCity: "Phoenix", parentState: "Arizona", stateCode: "AZ" },
  { name: "Tempe", parentCity: "Phoenix", parentState: "Arizona", stateCode: "AZ" },
  { name: "Mesa", parentCity: "Phoenix", parentState: "Arizona", stateCode: "AZ" },
  { name: "Chandler", parentCity: "Phoenix", parentState: "Arizona", stateCode: "AZ" },
  { name: "Gilbert", parentCity: "Phoenix", parentState: "Arizona", stateCode: "AZ" },
  { name: "Glendale", parentCity: "Phoenix", parentState: "Arizona", stateCode: "AZ" },
  { name: "Peoria", parentCity: "Phoenix", parentState: "Arizona", stateCode: "AZ" },
  { name: "Surprise", parentCity: "Phoenix", parentState: "Arizona", stateCode: "AZ" },
  { name: "Goodyear", parentCity: "Phoenix", parentState: "Arizona", stateCode: "AZ" },
  { name: "Cave Creek", parentCity: "Phoenix", parentState: "Arizona", stateCode: "AZ" },

  // Chicago, IL
  { name: "Lincoln Park", parentCity: "Chicago", parentState: "Illinois", stateCode: "IL" },
  { name: "Wicker Park", parentCity: "Chicago", parentState: "Illinois", stateCode: "IL" },
  { name: "Hyde Park", parentCity: "Chicago", parentState: "Illinois", stateCode: "IL" },
  { name: "Evanston", parentCity: "Chicago", parentState: "Illinois", stateCode: "IL" },
  { name: "Oak Park", parentCity: "Chicago", parentState: "Illinois", stateCode: "IL" },
  { name: "Naperville", parentCity: "Chicago", parentState: "Illinois", stateCode: "IL" },
  { name: "Schaumburg", parentCity: "Chicago", parentState: "Illinois", stateCode: "IL" },
  { name: "Arlington Heights", parentCity: "Chicago", parentState: "Illinois", stateCode: "IL" },
  { name: "Lakeview", parentCity: "Chicago", parentState: "Illinois", stateCode: "IL" },
  { name: "Logan Square", parentCity: "Chicago", parentState: "Illinois", stateCode: "IL" },

  // Dallas, TX
  { name: "Plano", parentCity: "Dallas", parentState: "Texas", stateCode: "TX" },
  { name: "Frisco", parentCity: "Dallas", parentState: "Texas", stateCode: "TX" },
  { name: "McKinney", parentCity: "Dallas", parentState: "Texas", stateCode: "TX" },
  { name: "Allen", parentCity: "Dallas", parentState: "Texas", stateCode: "TX" },
  { name: "Richardson", parentCity: "Dallas", parentState: "Texas", stateCode: "TX" },
  { name: "Garland", parentCity: "Dallas", parentState: "Texas", stateCode: "TX" },
  { name: "Irving", parentCity: "Dallas", parentState: "Texas", stateCode: "TX" },
  { name: "Arlington", parentCity: "Dallas", parentState: "Texas", stateCode: "TX" },
  { name: "Fort Worth", parentCity: "Dallas", parentState: "Texas", stateCode: "TX" },
  { name: "Southlake", parentCity: "Dallas", parentState: "Texas", stateCode: "TX" },

  // Charlotte, NC
  { name: "Ballantyne", parentCity: "Charlotte", parentState: "North Carolina", stateCode: "NC" },
  { name: "Dilworth", parentCity: "Charlotte", parentState: "North Carolina", stateCode: "NC" },
  { name: "NoDa", parentCity: "Charlotte", parentState: "North Carolina", stateCode: "NC" },
  { name: "South End", parentCity: "Charlotte", parentState: "North Carolina", stateCode: "NC" },
  { name: "Huntersville", parentCity: "Charlotte", parentState: "North Carolina", stateCode: "NC" },
  { name: "Cornelius", parentCity: "Charlotte", parentState: "North Carolina", stateCode: "NC" },
  { name: "Matthews", parentCity: "Charlotte", parentState: "North Carolina", stateCode: "NC" },
  { name: "Mint Hill", parentCity: "Charlotte", parentState: "North Carolina", stateCode: "NC" },
  { name: "Waxhaw", parentCity: "Charlotte", parentState: "North Carolina", stateCode: "NC" },
  { name: "Indian Trail", parentCity: "Charlotte", parentState: "North Carolina", stateCode: "NC" },

  // Atlanta, GA
  { name: "Buckhead", parentCity: "Atlanta", parentState: "Georgia", stateCode: "GA" },
  { name: "Midtown", parentCity: "Atlanta", parentState: "Georgia", stateCode: "GA" },
  { name: "Decatur", parentCity: "Atlanta", parentState: "Georgia", stateCode: "GA" },
  { name: "Marietta", parentCity: "Atlanta", parentState: "Georgia", stateCode: "GA" },
  { name: "Roswell", parentCity: "Atlanta", parentState: "Georgia", stateCode: "GA" },
  { name: "Alpharetta", parentCity: "Atlanta", parentState: "Georgia", stateCode: "GA" },
  { name: "Sandy Springs", parentCity: "Atlanta", parentState: "Georgia", stateCode: "GA" },
  { name: "Dunwoody", parentCity: "Atlanta", parentState: "Georgia", stateCode: "GA" },
  { name: "Kennesaw", parentCity: "Atlanta", parentState: "Georgia", stateCode: "GA" },
  { name: "Peachtree City", parentCity: "Atlanta", parentState: "Georgia", stateCode: "GA" },

  // Denver, CO
  { name: "Aurora", parentCity: "Denver", parentState: "Colorado", stateCode: "CO" },
  { name: "Lakewood", parentCity: "Denver", parentState: "Colorado", stateCode: "CO" },
  { name: "Arvada", parentCity: "Denver", parentState: "Colorado", stateCode: "CO" },
  { name: "Westminster", parentCity: "Denver", parentState: "Colorado", stateCode: "CO" },
  { name: "Centennial", parentCity: "Denver", parentState: "Colorado", stateCode: "CO" },
  { name: "Highlands Ranch", parentCity: "Denver", parentState: "Colorado", stateCode: "CO" },
  { name: "Littleton", parentCity: "Denver", parentState: "Colorado", stateCode: "CO" },
  { name: "Parker", parentCity: "Denver", parentState: "Colorado", stateCode: "CO" },
  { name: "Castle Rock", parentCity: "Denver", parentState: "Colorado", stateCode: "CO" },
  { name: "Golden", parentCity: "Denver", parentState: "Colorado", stateCode: "CO" },

  // Seattle, WA
  { name: "Bellevue", parentCity: "Seattle", parentState: "Washington", stateCode: "WA" },
  { name: "Redmond", parentCity: "Seattle", parentState: "Washington", stateCode: "WA" },
  { name: "Kirkland", parentCity: "Seattle", parentState: "Washington", stateCode: "WA" },
  { name: "Renton", parentCity: "Seattle", parentState: "Washington", stateCode: "WA" },
  { name: "Kent", parentCity: "Seattle", parentState: "Washington", stateCode: "WA" },
  { name: "Federal Way", parentCity: "Seattle", parentState: "Washington", stateCode: "WA" },
  { name: "Tacoma", parentCity: "Seattle", parentState: "Washington", stateCode: "WA" },
  { name: "Bothell", parentCity: "Seattle", parentState: "Washington", stateCode: "WA" },
  { name: "Issaquah", parentCity: "Seattle", parentState: "Washington", stateCode: "WA" },
  { name: "Sammamish", parentCity: "Seattle", parentState: "Washington", stateCode: "WA" },
];

// ---------------------------------------------------------------------------
// Utility functions (mirrored from build-site.js)
// ---------------------------------------------------------------------------

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || "";
      });
      return row;
    });
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function slugifyState(state) {
  return state
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function roundToNearest(value, step) {
  return Math.round(value / step) * step;
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("en-US");
}

function buildCityPageFilename(city, stateCode) {
  return `${slugify(city)}-${stateCode.toLowerCase()}-roof-cost.html`;
}

function buildStatePageFilename(stateName) {
  return `${slugifyState(stateName)}-roof-cost.html`;
}

// ---------------------------------------------------------------------------
// Pricing logic (same as build-site.js)
// ---------------------------------------------------------------------------

function calculatePriceTable(stateCode, pricingModel, stateRegions) {
  const region = stateRegions[stateCode] || "south";
  const laborMultiplier = pricingModel.laborMultiplierByRegion[region] || 1;

  const sizes = {};

  for (const size of pricingModel.houseSizes) {
    const squares = size.roofSquares * pricingModel.wasteFactor;
    sizes[size.label] = {};

    for (const [material, basePrice] of Object.entries(pricingModel.basePricePerSquare)) {
      const rawPrice =
        squares *
        basePrice *
        laborMultiplier *
        pricingModel.overheadMultiplier;

      sizes[size.label][material] = roundToNearest(rawPrice, pricingModel.roundTo);
    }
  }

  return { region, sizes };
}

function summarizePricing(sizes) {
  const allValues = [];
  for (const sizeData of Object.values(sizes)) {
    for (const materialPrice of Object.values(sizeData)) {
      allValues.push(Number(materialPrice));
    }
  }
  if (!allValues.length) return { low: "0", high: "0" };
  return {
    low: Math.min(...allValues).toLocaleString("en-US"),
    high: Math.max(...allValues).toLocaleString("en-US"),
  };
}

function summarizePerSqFt(sizes) {
  const perSqFtValues = [];
  for (const [sizeLabel, sizeData] of Object.entries(sizes)) {
    const numericSize = parseInt(sizeLabel.replace(/[^\d]/g, ""), 10);
    if (!numericSize) continue;
    for (const materialPrice of Object.values(sizeData)) {
      perSqFtValues.push(Number(materialPrice) / numericSize);
    }
  }
  if (!perSqFtValues.length) return { low: "0.00", high: "0.00" };
  return {
    low: Math.min(...perSqFtValues).toFixed(2),
    high: Math.max(...perSqFtValues).toFixed(2),
  };
}

function getMaterialRates(sizes) {
  const sizeKey =
    Object.keys(sizes).find((label) => label.includes("2000")) ||
    Object.keys(sizes)[0];
  const sizeData = sizes[sizeKey];
  return {
    asphalt: (sizeData.asphalt / 2000).toFixed(2),
    architectural: (sizeData.architectural / 2000).toFixed(2),
    metal: (sizeData.metal / 2000).toFixed(2),
    tile: (sizeData.tile / 2000).toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// Build existing city slug set from CSV
// ---------------------------------------------------------------------------

function buildExistingCitySlugs(csvRows) {
  const slugs = new Set();
  for (const row of csvRows) {
    // Match the slug format used in build-site.js: {city-slug}-{state-code}-roof-cost.html
    const slug = buildCityPageFilename(row.city, row.state_code);
    slugs.add(slug);
  }
  return slugs;
}

// ---------------------------------------------------------------------------
// Build neighborhood filename
// ---------------------------------------------------------------------------

function buildNeighborhoodFilename(neighborhood, parentCity) {
  return `${slugify(neighborhood)}-${slugify(parentCity)}-roof-cost.html`;
}

// ---------------------------------------------------------------------------
// Generate price grid items (house size cards)
// ---------------------------------------------------------------------------

function buildPriceGridItems(sizes) {
  const items = [];
  for (const size of Object.keys(sizes)) {
    const sizeData = sizes[size];
    const vals = Object.values(sizeData).map(Number);
    const low = Math.min(...vals).toLocaleString("en-US");
    const high = Math.max(...vals).toLocaleString("en-US");
    items.push(
      `<div class="price-grid-item">\n<h3>${Number(size).toLocaleString("en-US")} sq ft</h3>\n<p class="price">$${low} &ndash; $${high}</p>\n</div>`
    );
  }
  return items.join("\n");
}

// ---------------------------------------------------------------------------
// Generate price table rows
// ---------------------------------------------------------------------------

function buildPriceTableRows(sizes) {
  const rows = [];
  for (const size of Object.keys(sizes)) {
    const d = sizes[size];
    rows.push(
      `<tr><td>${Number(size).toLocaleString("en-US")} sq ft</td><td>$${formatNumber(d.asphalt)}</td><td>$${formatNumber(d.architectural)}</td><td>$${formatNumber(d.metal)}</td><td>$${formatNumber(d.tile)}</td></tr>`
    );
  }
  return rows.join("\n");
}

// ---------------------------------------------------------------------------
// Generate sibling neighborhood links
// ---------------------------------------------------------------------------

function buildSiblingLinks(currentNeighborhood, allNeighborhoods, existingCitySlugs) {
  const siblings = allNeighborhoods.filter(
    (n) =>
      n.parentCity === currentNeighborhood.parentCity &&
      n.stateCode === currentNeighborhood.stateCode &&
      n.name !== currentNeighborhood.name
  );

  return siblings
    .map((n) => {
      const wouldBeCity = buildCityPageFilename(n.name, n.stateCode);
      const isExistingCity = existingCitySlugs.has(wouldBeCity);

      // If existing city page, link to that instead
      const href = isExistingCity
        ? `/${wouldBeCity}`
        : `/${buildNeighborhoodFilename(n.name, n.parentCity)}`;
      const label = `${n.name}`;

      return `<a href="${href}" style="padding:8px 14px; border:1px solid var(--border); border-radius:999px; font-size:13px; color:var(--brand); text-decoration:none;">${label}</a>`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Main build
// ---------------------------------------------------------------------------

function main() {
  console.log("=== Building neighborhood pages ===\n");

  // Load data
  const pricingModel = readJson(PRICING_MODEL_PATH);
  const stateRegions = readJson(STATE_REGIONS_PATH);
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");

  // Load cities CSV and build slug set
  const csvText = fs.readFileSync(INPUT_CSV, "utf8");
  const csvRows = parseCsv(csvText);
  const existingCitySlugs = buildExistingCitySlugs(csvRows);

  // Filter out neighborhoods that already exist as city pages
  const neighborhoodsToGenerate = NEIGHBORHOODS.filter((n) => {
    const citySlug = buildCityPageFilename(n.name, n.stateCode);
    if (existingCitySlugs.has(citySlug)) {
      console.log(`  SKIP: ${n.name}, ${n.stateCode} (already a city page: ${citySlug})`);
      return false;
    }
    return true;
  });

  console.log(
    `\n${NEIGHBORHOODS.length} neighborhoods defined, ${NEIGHBORHOODS.length - neighborhoodsToGenerate.length} skipped (existing city pages), ${neighborhoodsToGenerate.length} to generate.\n`
  );

  // Cache price tables by state code (all neighborhoods in same state share pricing)
  const priceCache = {};
  const sitemapEntries = [];
  let generated = 0;

  for (const hood of neighborhoodsToGenerate) {
    // Calculate or retrieve cached prices
    if (!priceCache[hood.stateCode]) {
      priceCache[hood.stateCode] = calculatePriceTable(
        hood.stateCode,
        pricingModel,
        stateRegions
      );
    }
    const pricing = priceCache[hood.stateCode];
    const { sizes } = pricing;

    // Compute summary stats
    const summary = summarizePricing(sizes);
    const perSqFt = summarizePerSqFt(sizes);
    const rates = getMaterialRates(sizes);

    // Build filenames
    const filename = buildNeighborhoodFilename(hood.name, hood.parentCity);
    const parentCityFilename = buildCityPageFilename(hood.parentCity, hood.stateCode);
    const statePageFilename = buildStatePageFilename(hood.parentState);
    const canonicalUrl = `${SITE_BASE_URL}/${filename}`;

    // Build template replacements
    let html = template;

    const replacements = {
      "{{NEIGHBORHOOD}}": hood.name,
      "{{PARENT_CITY}}": hood.parentCity,
      "{{PARENT_CITY_STATE}}": `${hood.parentCity}, ${hood.stateCode}`,
      "{{STATE_NAME}}": hood.parentState,
      "{{STATE_CODE}}": hood.stateCode,
      "{{CANONICAL_URL}}": canonicalUrl,
      "{{STATE_PAGE_FILENAME}}": statePageFilename,
      "{{PARENT_CITY_PAGE_FILENAME}}": parentCityFilename,
      "{{AVG_LOW}}": summary.low,
      "{{AVG_HIGH}}": summary.high,
      "{{PRICE_SQFT_LOW}}": perSqFt.low,
      "{{PRICE_SQFT_HIGH}}": perSqFt.high,
      "{{CITY_RATE_ASPHALT}}": `$${rates.asphalt}`,
      "{{CITY_RATE_ARCHITECTURAL}}": `$${rates.architectural}`,
      "{{CITY_RATE_METAL}}": `$${rates.metal}`,
      "{{CITY_RATE_TILE}}": `$${rates.tile}`,
      "{{PRICE_GRID_ITEMS}}": buildPriceGridItems(sizes),
      "{{PRICE_TABLE_ROWS}}": buildPriceTableRows(sizes),
      "{{SIBLING_NEIGHBORHOOD_LINKS}}": buildSiblingLinks(
        hood,
        NEIGHBORHOODS,
        existingCitySlugs
      ),
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      // Replace all occurrences
      html = html.split(placeholder).join(value);
    }

    // Write file
    const outputPath = path.join(ROOT, filename);
    fs.writeFileSync(outputPath, html, "utf8");
    console.log(`  Generated: ${filename}`);

    sitemapEntries.push(canonicalUrl);
    generated++;
  }

  // ---------------------------------------------------------------------------
  // Generate sitemap-neighborhoods.xml
  // ---------------------------------------------------------------------------
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
    <lastmod>2026-03-24</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");
  console.log(`\nGenerated: sitemap-neighborhoods.xml (${sitemapEntries.length} URLs)`);

  console.log(`\n=== Done: ${generated} neighborhood pages generated ===`);
}

main();
