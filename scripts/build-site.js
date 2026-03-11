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
const STATE_TEMPLATE_PATH = path.join(ROOT, "templates", "state-page-template.html");
const MATERIAL_TEMPLATE_PATH = path.join(ROOT, "templates", "material-page-template.html");
const MATERIAL_CITY_TEMPLATE_PATH = path.join(
  ROOT,
  "templates",
  "material-city-page-template.html"
);
const ALL_CITIES_TEMPLATE_PATH = path.join(ROOT, "templates", "all-cities-template.html");

const ALL_CITIES_PAGE_PATH = path.join(ROOT, "all-cities.html");

const SITE_BASE_URL = "https://trueprice-tech.github.io/trueprice";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadTemplate() {
  return fs.readFileSync(TEMPLATE_PATH, "utf8");
}

function loadStateTemplate() {
  return fs.readFileSync(STATE_TEMPLATE_PATH, "utf8");
}

function loadMaterialTemplate() {
  return fs.readFileSync(MATERIAL_TEMPLATE_PATH, "utf8");
}

function loadMaterialCityTemplate() {
  return fs.readFileSync(MATERIAL_CITY_TEMPLATE_PATH, "utf8");
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

function slugifyCity(city) {
  return city
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

function formatCurrency(value) {
  return `$${Math.round(value).toLocaleString()}`;
}

function buildCityPageFilename(city, stateCode) {
  return `${slugifyCity(city)}-${stateCode.toLowerCase()}-roof-cost.html`;
}

function buildStatePageFilename(stateName) {
  return `${slugifyState(stateName)}-roof-cost.html`;
}

function buildMaterialPageFilename(material) {
  return `${material.toLowerCase()}-roof-cost.html`;
}

function buildMaterialCityPageFilename(material, city, stateCode) {
  return `${material.toLowerCase()}-roof-cost-${slugifyCity(city)}-${stateCode.toLowerCase()}.html`;
}

function formatMaterialName(material) {
  if (material === "architectural") return "Architectural Shingle";
  if (material === "asphalt") return "Asphalt Shingle";
  if (material === "metal") return "Metal";
  if (material === "tile") return "Tile";
  return material.charAt(0).toUpperCase() + material.slice(1);
}

function groupCitiesByState(cityRows) {
  const grouped = {};
  for (const city of cityRows) {
    if (!grouped[city.state]) grouped[city.state] = [];
    grouped[city.state].push(city);
  }
  return grouped;
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

  const currentState = currentCityPricing.state_code;
  const currentRegion = currentCityPricing.region;

  const otherCities = allCityRows.filter(
    (city) => buildCityPageFilename(city.city, city.state_code) !== currentFile
  );

  const sameState = otherCities
    .filter((city) => city.state_code === currentState)
    .sort((a, b) => Number(b.population || 0) - Number(a.population || 0));

  const sameRegion = otherCities
    .filter(
      (city) =>
        city.state_code !== currentState && city.region === currentRegion
    )
    .sort((a, b) => Number(b.population || 0) - Number(a.population || 0));

  const fallback = otherCities
    .filter(
      (city) =>
        city.state_code !== currentState && city.region !== currentRegion
    )
    .sort((a, b) => Number(b.population || 0) - Number(a.population || 0));

  const related = [...sameState, ...sameRegion, ...fallback].slice(0, 8);

  return related
    .map((city) => {
      const filename = buildCityPageFilename(city.city, city.state_code);
      return `<li><a href="/trueprice/${filename}">${city.city}, ${city.state_code}</a></li>`;
    })
    .join("\n");
}

function getStatePageLink(cityPricing) {
  const stateFilename = buildStatePageFilename(cityPricing.state);
  return `<a href="/trueprice/${stateFilename}">${cityPricing.state}</a>`;
}

function generateCityMaterialLinks(cityPricing) {
  const city = cityPricing.city;
  const stateCode = cityPricing.state_code;

  const links = [
    {
      material: "asphalt",
      label: `Asphalt Roof Cost in ${city}`,
    },
    {
      material: "architectural",
      label: `Architectural Shingle Cost in ${city}`,
    },
    {
      material: "metal",
      label: `Metal Roof Cost in ${city}`,
    },
    {
      material: "tile",
      label: `Tile Roof Cost in ${city}`,
    },
  ];

  return links
    .map(({ material, label }) => {
      const filename = buildMaterialCityPageFilename(material, city, stateCode);
      return `<li><a href="/trueprice/${filename}">${label}</a></li>`;
    })
    .join("\n");
}

function getCityMaterialRates(cityPricing) {
  const sizeKey =
    Object.keys(cityPricing.sizes).find((label) => label.includes("2000")) ||
    Object.keys(cityPricing.sizes)[0];

  const sizeData = cityPricing.sizes[sizeKey];

  return {
    asphalt: (sizeData.asphalt / 2000).toFixed(2),
    architectural: (sizeData.architectural / 2000).toFixed(2),
    metal: (sizeData.metal / 2000).toFixed(2),
    tile: (sizeData.tile / 2000).toFixed(2)
  };
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
  const cityMaterialLinks = generateCityMaterialLinks(cityPricing);
  const statePageLink = getStatePageLink(cityPricing);
  const cityRates = getCityMaterialRates(cityPricing);

  template = template.replaceAll("{{CITY}}", cityPricing.city);
  template = template.replaceAll("{{STATE_CODE}}", cityPricing.state_code);
  template = template.replaceAll("{{STATE_NAME}}", cityPricing.state);
  template = template.replaceAll("{{SLUG}}", slug);
  template = template.replace("{{PRICE_ROWS}}", priceRows);
  template = template.replace("{{RELATED_CITY_LINKS}}", relatedCityLinks);
  template = template.replace("{{CITY_MATERIAL_LINKS}}", cityMaterialLinks);
  template = template.replaceAll("{{STATE_PAGE_LINK}}", statePageLink);
  template = template.replaceAll("{{CITY_RATE_ASPHALT}}", cityRates.asphalt);
  template = template.replaceAll("{{CITY_RATE_ARCHITECTURAL}}", cityRates.architectural);
  template = template.replaceAll("{{CITY_RATE_METAL}}", cityRates.metal);
  template = template.replaceAll("{{CITY_RATE_TILE}}", cityRates.tile);

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

function generateHomepageStateLinks(cities) {
  const grouped = groupCitiesByState(cities);

  const states = Object.keys(grouped)
    .map((stateName) => {
      const totalPopulation = grouped[stateName].reduce(
        (sum, city) => sum + Number(city.population || 0),
        0
      );
      return { stateName, totalPopulation };
    })
    .sort((a, b) => b.totalPopulation - a.totalPopulation);

  const links = states
    .map(({ stateName }) => {
      const filename = buildStatePageFilename(stateName);
      return `<li><a href="/trueprice/${filename}">${stateName}</a></li>`;
    })
    .join("\n");

  return `
<section class="state-links-section">
  <h2>Roof Cost Guides by State</h2>
  <ul>
    ${links}
  </ul>
</section>
`.trim();
}

function generateHomepageMaterialLinks(pricingModel) {
  const materials = Object.keys(pricingModel.basePricePerSquare);

  const links = materials
    .map((material) => {
      const filename = buildMaterialPageFilename(material);
      return `<li><a href="/trueprice/${filename}">${formatMaterialName(material)} Roof Cost</a></li>`;
    })
    .join("\n");

  return `
<section class="material-links-section">
  <h2>Roof Cost Guides by Material</h2>
  <ul>
    ${links}
  </ul>
</section>
`.trim();
}

function updateHomepageCitySection(cities, pricingModel) {
  if (!fs.existsSync(INDEX_PATH)) {
    console.log("index.html not found. Skipping homepage update.");
    return;
  }

  let indexHtml = fs.readFileSync(INDEX_PATH, "utf8");

  const cityMarkerRegex =
    /<!--\s*CITY_LINKS_START\s*-->[\s\S]*?<!--\s*CITY_LINKS_END\s*-->/;

  if (cityMarkerRegex.test(indexHtml)) {
    const newCitySection = generateHomepageCityLinks(cities);
    const cityReplacement = `<!-- CITY_LINKS_START -->\n${newCitySection}\n<!-- CITY_LINKS_END -->`;
    indexHtml = indexHtml.replace(cityMarkerRegex, cityReplacement);
    console.log("Updated homepage city section.");
  }

  const stateMarkerRegex =
    /<!--\s*STATE_LINKS_START\s*-->[\s\S]*?<!--\s*STATE_LINKS_END\s*-->/;

  if (stateMarkerRegex.test(indexHtml)) {
    const newStateSection = generateHomepageStateLinks(cities);
    const stateReplacement = `<!-- STATE_LINKS_START -->\n${newStateSection}\n<!-- STATE_LINKS_END -->`;
    indexHtml = indexHtml.replace(stateMarkerRegex, stateReplacement);
    console.log("Updated homepage state section.");
  }

  const materialMarkerRegex =
    /<!--\s*MATERIAL_LINKS_START\s*-->[\s\S]*?<!--\s*MATERIAL_LINKS_END\s*-->/;

  if (materialMarkerRegex.test(indexHtml)) {
    const newMaterialSection = generateHomepageMaterialLinks(pricingModel);
    const materialReplacement = `<!-- MATERIAL_LINKS_START -->\n${newMaterialSection}\n<!-- MATERIAL_LINKS_END -->`;
    indexHtml = indexHtml.replace(materialMarkerRegex, materialReplacement);
    console.log("Updated homepage material section.");
  }

  fs.writeFileSync(INDEX_PATH, indexHtml, "utf8");
}

function summarizeStatePricing(stateCities, cityPricingArray) {
  const pricingLookup = new Map(
    cityPricingArray.map((item) => [`${item.city}|${item.state_code}`, item])
  );

  const allValues = [];

  for (const city of stateCities) {
    const cityPricing = pricingLookup.get(`${city.city}|${city.state_code}`);
    if (!cityPricing) continue;

    for (const sizeData of Object.values(cityPricing.sizes)) {
      for (const materialPrice of Object.values(sizeData)) {
        allValues.push(Number(materialPrice));
      }
    }
  }

  if (!allValues.length) {
    return { low: "$0", high: "$0" };
  }

  return {
    low: formatCurrency(Math.min(...allValues)),
    high: formatCurrency(Math.max(...allValues))
  };
}

function summarizeStateSquareRange(stateCities, pricingModel, stateRegions) {
  const regionValues = stateCities.map((city) => {
    const region = stateRegions[city.state_code] || "south";
    const laborMultiplier = pricingModel.laborMultiplierByRegion[region] || 1;

    const materialValues = Object.values(pricingModel.basePricePerSquare).map(
      (basePrice) =>
        basePrice * laborMultiplier * pricingModel.overheadMultiplier
    );

    return {
      min: Math.min(...materialValues),
      max: Math.max(...materialValues)
    };
  });

  if (!regionValues.length) {
    return "$0 to $0";
  }

  const min = Math.min(...regionValues.map((v) => v.min));
  const max = Math.max(...regionValues.map((v) => v.max));

  return `${formatCurrency(min)} to ${formatCurrency(max)}`;
}

function generateRelatedStateLinks(currentStateName, groupedStates) {
  return Object.keys(groupedStates)
    .filter((stateName) => stateName !== currentStateName)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 12)
    .map((stateName) => {
      const filename = buildStatePageFilename(stateName);
      return `<li><a href="/trueprice/${filename}">${stateName}</a></li>`;
    })
    .join("\n");
}

function generateStateCityLinks(stateCities) {
  return [...stateCities]
    .sort((a, b) => Number(b.population || 0) - Number(a.population || 0))
    .map((city) => {
      const filename = buildCityPageFilename(city.city, city.state_code);
      return `
<div class="city-link-card">
  <a href="/trueprice/${filename}">${city.city}, ${city.state_code}</a>
  <p>Compare local roof replacement pricing in ${city.city}.</p>
</div>
`.trim();
    })
    .join("\n");
}

function generateStatePageHtml(
  stateName,
  stateCities,
  groupedStates,
  cityPricingArray,
  pricingModel,
  stateRegions
) {
  let template = loadStateTemplate();

  const filename = buildStatePageFilename(stateName);
  const canonicalUrl = `${SITE_BASE_URL}/${filename}`;
  const cityCount = stateCities.length;
  const priceRange = summarizeStatePricing(stateCities, cityPricingArray);
  const avgSquareRange = summarizeStateSquareRange(
    stateCities,
    pricingModel,
    stateRegions
  );
  const cityLinks = generateStateCityLinks(stateCities);
  const relatedStateLinks = generateRelatedStateLinks(stateName, groupedStates);

  const intro = `Average roof replacement costs in ${stateName} vary by city, roof size, roofing material, labor rates, and local market conditions. Use the guides below to compare roofing prices across ${stateName}.`;

  template = template.replaceAll(
    "{{STATE_PAGE_TITLE}}",
    `Roof Replacement Cost in ${stateName} (2026) | TruePrice`
  );
  template = template.replaceAll(
    "{{STATE_META_DESCRIPTION}}",
    `Average roof replacement cost in ${stateName}. Compare roofing prices across cities in ${stateName} and check what homeowners are paying in 2026.`
  );
  template = template.replaceAll("{{STATE_CANONICAL_URL}}", canonicalUrl);
  template = template.replaceAll(
    "{{STATE_H1}}",
    `Roof Replacement Cost in ${stateName} (2026)`
  );
  template = template.replaceAll("{{STATE_NAME}}", stateName);
  template = template.replaceAll("{{STATE_INTRO}}", intro);
  template = template.replaceAll("{{STATE_CITY_COUNT}}", String(cityCount));
  template = template.replaceAll(
    "{{STATE_PRICE_RANGE}}",
    `${priceRange.low} to ${priceRange.high}`
  );
  template = template.replaceAll("{{STATE_AVG_SQUARE_RANGE}}", avgSquareRange);
  template = template.replace("{{STATE_CITY_LINKS}}", cityLinks);
  template = template.replace("{{RELATED_STATE_LINKS}}", relatedStateLinks);

  return {
    filename,
    html: template
  };
}

function generateStatePages(
  cityRows,
  cityPricingArray,
  pricingModel,
  stateRegions
) {
  if (!fs.existsSync(STATE_TEMPLATE_PATH)) {
    console.log("State page template missing. Skipping state page generation.");
    return;
  }

  const groupedStates = groupCitiesByState(cityRows);

  for (const [stateName, stateCities] of Object.entries(groupedStates)) {
    const { filename, html } = generateStatePageHtml(
      stateName,
      stateCities,
      groupedStates,
      cityPricingArray,
      pricingModel,
      stateRegions
    );

    const filePath = path.join(ROOT, filename);
    fs.writeFileSync(filePath, html, "utf8");
    console.log(`Generated ${filename}`);
  }
}

function summarizeMaterialPricing(material, cityPricingArray) {
  const values = [];

  for (const cityPricing of cityPricingArray) {
    for (const sizeData of Object.values(cityPricing.sizes)) {
      if (sizeData[material] !== undefined) {
        values.push(Number(sizeData[material]));
      }
    }
  }

  if (!values.length) {
    return { low: "$0", high: "$0" };
  }

  return {
    low: formatCurrency(Math.min(...values)),
    high: formatCurrency(Math.max(...values))
  };
}

function generateMaterialCityLinks(material, cityPricingArray) {
  return cityPricingArray
    .slice()
    .sort((a, b) => Number(b.population || 0) - Number(a.population || 0))
    .slice(0, 48)
    .map((cityPricing) => {
      const filename = buildCityPageFilename(
        cityPricing.city,
        cityPricing.state_code
      );

      const prices = Object.values(cityPricing.sizes)
        .map((sizeData) => Number(sizeData[material]))
        .filter((v) => !Number.isNaN(v));

      const min = prices.length ? Math.min(...prices) : null;
      const max = prices.length ? Math.max(...prices) : null;

      const rangeText =
        min !== null && max !== null
          ? `${formatCurrency(min)} to ${formatCurrency(max)}`
          : "See local pricing";

      return `
<div class="city-link-card">
  <a href="/trueprice/${filename}">${cityPricing.city}, ${cityPricing.state_code}</a>
  <p>${formatMaterialName(material)} roof pricing: ${rangeText}</p>
</div>
`.trim();
    })
    .join("\n");
}

function generateRelatedMaterialLinks(currentMaterial, pricingModel) {
  return Object.keys(pricingModel.basePricePerSquare)
    .filter((material) => material !== currentMaterial)
    .map((material) => {
      const filename = buildMaterialPageFilename(material);
      return `<li><a href="/trueprice/${filename}">${formatMaterialName(material)} Roof Cost</a></li>`;
    })
    .join("\n");
}

function generateMaterialPageHtml(material, cityPricingArray, pricingModel) {
  let template = loadMaterialTemplate();

  const filename = buildMaterialPageFilename(material);
  const canonicalUrl = `${SITE_BASE_URL}/${filename}`;
  const materialDisplayName = formatMaterialName(material);
  const priceRange = summarizeMaterialPricing(material, cityPricingArray);
  const cityLinks = generateMaterialCityLinks(material, cityPricingArray);
  const relatedMaterialLinks = generateRelatedMaterialLinks(
    material,
    pricingModel
  );

  template = template.replaceAll(
    "{{MATERIAL_PAGE_TITLE}}",
    `${materialDisplayName} Roof Replacement Cost (2026) | TruePrice`
  );
  template = template.replaceAll(
    "{{MATERIAL_META_DESCRIPTION}}",
    `Average ${materialDisplayName.toLowerCase()} roof replacement cost. Compare ${materialDisplayName.toLowerCase()} roofing prices across cities in 2026.`
  );
  template = template.replaceAll("{{MATERIAL_CANONICAL_URL}}", canonicalUrl);
  template = template.replaceAll(
    "{{MATERIAL_H1}}",
    `${materialDisplayName} Roof Replacement Cost (2026)`
  );
  template = template.replaceAll(
    "{{MATERIAL_NAME}}",
    materialDisplayName.toLowerCase()
  );
  template = template.replaceAll(
    "{{MATERIAL_DISPLAY_NAME}}",
    materialDisplayName
  );
  template = template.replaceAll(
    "{{MATERIAL_INTRO}}",
    `Use this guide to compare ${materialDisplayName.toLowerCase()} roof replacement costs across city markets. Prices vary based on roof size, labor rates, tear off complexity, underlayment, flashing, and local demand.`
  );
  template = template.replaceAll(
    "{{MATERIAL_CITY_COUNT}}",
    String(cityPricingArray.length)
  );
  template = template.replaceAll(
    "{{MATERIAL_PRICE_RANGE}}",
    `${priceRange.low} to ${priceRange.high}`
  );
  template = template.replace("{{MATERIAL_CITY_LINKS}}", cityLinks);
  template = template.replace(
    "{{RELATED_MATERIAL_LINKS}}",
    relatedMaterialLinks
  );

  return {
    filename,
    html: template
  };
}

function generateMaterialPages(cityPricingArray, pricingModel) {
  if (!fs.existsSync(MATERIAL_TEMPLATE_PATH)) {
    console.log("Material page template missing. Skipping material page generation.");
    return;
  }

  const materials = Object.keys(pricingModel.basePricePerSquare);

  for (const material of materials) {
    const { filename, html } = generateMaterialPageHtml(
      material,
      cityPricingArray,
      pricingModel
    );

    const filePath = path.join(ROOT, filename);
    fs.writeFileSync(filePath, html, "utf8");
    console.log(`Generated ${filename}`);
  }
}

function summarizeMaterialCityRange(material, cityPricing) {
  const values = Object.values(cityPricing.sizes)
    .map((sizeData) => Number(sizeData[material]))
    .filter((v) => !Number.isNaN(v));

  if (!values.length) {
    return "$0 to $0";
  }

  return `${formatCurrency(Math.min(...values))} to ${formatCurrency(
    Math.max(...values)
  )}`;
}

function generateMaterialCityPriceRows(material, cityPricing) {
  return Object.entries(cityPricing.sizes)
    .map(([sizeLabel, sizeData]) => {
      const value = sizeData[material];
      return `
<tr>
  <td>${sizeLabel} sq ft</td>
  <td>$${Number(value).toLocaleString()}</td>
</tr>
`.trim();
    })
    .join("\n");
}

function generateCityMaterialClusterLinks(currentMaterial, cityPricing, pricingModel) {
  return Object.keys(pricingModel.basePricePerSquare)
    .filter((material) => material !== currentMaterial)
    .map((material) => {
      const filename = buildMaterialCityPageFilename(
        material,
        cityPricing.city,
        cityPricing.state_code
      );

      return `<a href="/trueprice/${filename}">
${formatMaterialName(material)} Roof Cost in ${cityPricing.city}
</a>`;
    })
    .join("<br>");
}

function generateOtherMaterialLinksForCity(
  currentMaterial,
  cityPricing,
  pricingModel
) {
  return Object.keys(pricingModel.basePricePerSquare)
    .filter((material) => material !== currentMaterial)
    .map((material) => {
      const filename = buildMaterialCityPageFilename(
        material,
        cityPricing.city,
        cityPricing.state_code
      );

      const range = summarizeMaterialCityRange(material, cityPricing);

      return `
<div class="link-card">
  <a href="/trueprice/${filename}">${formatMaterialName(material)} in ${cityPricing.city}</a>
  <p>${range}</p>
</div>
`.trim();
    })
    .join("\n");
}

function generateRelatedMaterialCityLinks(
  currentMaterial,
  currentCityPricing,
  cityPricingArray
) {
  return cityPricingArray
    .filter(
      (item) =>
        !(
          item.city === currentCityPricing.city &&
          item.state_code === currentCityPricing.state_code
        )
    )
    .sort((a, b) => Number(b.population || 0) - Number(a.population || 0))
    .slice(0, 12)
    .map((item) => {
      const filename = buildMaterialCityPageFilename(
        currentMaterial,
        item.city,
        item.state_code
      );

      const range = summarizeMaterialCityRange(currentMaterial, item);

      return `
<div class="link-card">
  <a href="/trueprice/${filename}">${formatMaterialName(currentMaterial)} in ${item.city}, ${item.state_code}</a>
  <p>${range}</p>
</div>
`.trim();
    })
    .join("\n");
}

function generateMaterialCityPageHtml(
  material,
  cityPricing,
  cityPricingArray,
  pricingModel
) {
  let template = loadMaterialCityTemplate();

  const materialDisplayName = formatMaterialName(material);
  const filename = buildMaterialCityPageFilename(
    material,
    cityPricing.city,
    cityPricing.state_code
  );
  const canonicalUrl = `${SITE_BASE_URL}/${filename}`;
  const cityPageFilename = buildCityPageFilename(
    cityPricing.city,
    cityPricing.state_code
  );
  const statePageFilename = buildStatePageFilename(cityPricing.state);
  const materialPageFilename = buildMaterialPageFilename(material);
  const priceRange = summarizeMaterialCityRange(material, cityPricing);
  const priceRows = generateMaterialCityPriceRows(material, cityPricing);
  const otherMaterialLinks = generateOtherMaterialLinksForCity(
    material,
    cityPricing,
    pricingModel
  );
  const cityMaterialClusterLinks = generateCityMaterialClusterLinks(
    material,
    cityPricing,
    pricingModel
  );
  const relatedCityLinks = generateRelatedMaterialCityLinks(
    material,
    cityPricing,
    cityPricingArray
  );

  template = template.replaceAll(
    "{{PAGE_TITLE}}",
    `${materialDisplayName} Roof Cost in ${cityPricing.city}, ${cityPricing.state_code} (2026) | TruePrice`
  );
  template = template.replaceAll(
    "{{META_DESCRIPTION}}",
    `Average ${materialDisplayName.toLowerCase()} roof replacement cost in ${cityPricing.city}, ${cityPricing.state_code}. Compare pricing by house size in 2026.`
  );
  template = template.replaceAll("{{CANONICAL_URL}}", canonicalUrl);
  template = template.replaceAll(
    "{{H1}}",
    `${materialDisplayName} Roof Cost in ${cityPricing.city}, ${cityPricing.state_code} (2026)`
  );
  template = template.replaceAll(
    "{{INTRO_PARAGRAPH}}",
    `Use this guide to compare ${materialDisplayName.toLowerCase()} roof replacement pricing in ${cityPricing.city}, ${cityPricing.state_code}. Costs vary based on roof size, labor rates, tear off scope, and installation complexity.`
  );
  template = template.replaceAll("{{CITY}}", cityPricing.city);
  template = template.replaceAll("{{STATE_CODE}}", cityPricing.state_code);
  template = template.replaceAll("{{STATE_NAME}}", cityPricing.state);
  template = template.replaceAll(
    "{{MATERIAL_DISPLAY_NAME}}",
    materialDisplayName
  );
  template = template.replaceAll(
    "{{MATERIAL_NAME}}",
    materialDisplayName.toLowerCase()
  );
  template = template.replaceAll("{{PRICE_RANGE}}", priceRange);
  template = template.replace("{{PRICE_ROWS}}", priceRows);
  template = template.replace("{{OTHER_MATERIAL_LINKS}}", otherMaterialLinks);
  template = template.replace("{{CITY_MATERIAL_CLUSTER_LINKS}}", cityMaterialClusterLinks);
  template = template.replace("{{RELATED_CITY_LINKS}}", relatedCityLinks);
  template = template.replaceAll("{{CITY_PAGE_FILENAME}}", cityPageFilename);
  template = template.replaceAll("{{STATE_PAGE_FILENAME}}", statePageFilename);
  template = template.replaceAll(
    "{{MATERIAL_PAGE_FILENAME}}",
    materialPageFilename
  );

  return {
    filename,
    html: template
  };
}

function generateMaterialCityPages(cityPricingArray, pricingModel) {
  if (!fs.existsSync(MATERIAL_CITY_TEMPLATE_PATH)) {
    console.log("Material-city template missing. Skipping material-city page generation.");
    return;
  }

  const materials = Object.keys(pricingModel.basePricePerSquare);

  for (const cityPricing of cityPricingArray) {
    for (const material of materials) {
      const { filename, html } = generateMaterialCityPageHtml(
        material,
        cityPricing,
        cityPricingArray,
        pricingModel
      );

      fs.writeFileSync(path.join(ROOT, filename), html, "utf8");
      console.log(`Generated ${filename}`);
    }
  }
}

function generateSitemap(cityRows, pricingModel) {
  const groupedStates = groupCitiesByState(cityRows);

  const stateUrls = Object.keys(groupedStates).map(
    (stateName) => `${SITE_BASE_URL}/${buildStatePageFilename(stateName)}`
  );

  const materialUrls = Object.keys(pricingModel.basePricePerSquare).map(
    (material) => `${SITE_BASE_URL}/${buildMaterialPageFilename(material)}`
  );

  const materialCityUrls = [];
  for (const city of cityRows) {
    for (const material of Object.keys(pricingModel.basePricePerSquare)) {
      materialCityUrls.push(
        `${SITE_BASE_URL}/${buildMaterialCityPageFilename(
          material,
          city.city,
          city.state_code
        )}`
      );
    }
  }

  const urls = [
    `${SITE_BASE_URL}/`,
    `${SITE_BASE_URL}/all-cities.html`,
    ...stateUrls,
    ...materialUrls,
    ...materialCityUrls,
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

function generateAllCitiesPage(cityRows, pricingModel) {
  if (!fs.existsSync(ALL_CITIES_TEMPLATE_PATH)) {
    console.log("All cities template missing");
    return;
  }

  let template = fs.readFileSync(ALL_CITIES_TEMPLATE_PATH, "utf8");

  const cityLinks = cityRows
    .slice()
    .sort((a, b) => a.city.localeCompare(b.city))
    .map((city) => {
      const filename = buildCityPageFilename(city.city, city.state_code);
      return `<li><a href="/trueprice/${filename}">${city.city}, ${city.state_code}</a></li>`;
    })
    .join("\n");

  template = template.replace("{{CITY_LINKS}}", cityLinks);

  const groupedStates = groupCitiesByState(cityRows);
  const stateLinks = Object.keys(groupedStates)
    .sort((a, b) => a.localeCompare(b))
    .map((stateName) => {
      const filename = buildStatePageFilename(stateName);
      return `<li><a href="/trueprice/${filename}">${stateName}</a></li>`;
    })
    .join("\n");

  template = template.replace("{{STATE_LINKS}}", stateLinks);

  const materialLinks = Object.keys(pricingModel.basePricePerSquare)
    .map((material) => {
      const filename = buildMaterialPageFilename(material);
      return `<li><a href="/trueprice/${filename}">${formatMaterialName(material)} Roof Cost</a></li>`;
    })
    .join("\n");

  template = template.replace("{{MATERIAL_LINKS}}", materialLinks);

  fs.writeFileSync(ALL_CITIES_PAGE_PATH, template, "utf8");
  console.log("Generated all-cities.html");
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

  const seenKeys = new Set();
  const dedupedCityRows = cityRows.filter((row) => {
    const key = `${row.city}|${row.state_code}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const cityPricingArray = dedupedCityRows.map((cityRow) =>
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
    const html = generateCityPageHtml(cityPricing, cityPricingArray);

    fs.writeFileSync(filePath, html, "utf8");
    console.log(`Generated ${filename}`);
  }

  generateStatePages(
    dedupedCityRows,
    cityPricingArray,
    pricingModel,
    stateRegions
  );
  generateMaterialPages(cityPricingArray, pricingModel);
  generateMaterialCityPages(cityPricingArray, pricingModel);
  updateHomepageCitySection(dedupedCityRows, pricingModel);
  generateSitemap(dedupedCityRows, pricingModel);
  generateAllCitiesPage(dedupedCityRows, pricingModel);

  console.log("Build complete.");
}

main();