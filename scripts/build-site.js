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
  return city.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, "-");
}

function slugifyState(state) {
  return state.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, "-");
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


function formatMaterialName(material) {
  if (material === "architectural") return "Architectural Shingle";
  if (material === "asphalt") return "Asphalt Shingle";
  if (material === "metal") return "Metal";
  if (material === "tile") return "Tile";

  return material;
}

function formatCurrency(value) {
  return `$${Math.round(value).toLocaleString()}`;
}

function roundToNearest(value, step) {
  return Math.round(value / step) * step;
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

    for (const [material, basePrice] of Object.entries(pricingModel.basePricePerSquare)) {

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



function generateCityPageHtml(cityPricing, allCityRows) {

  let template = loadTemplate();

  const slug = buildCityPageFilename(cityPricing.city, cityPricing.state_code);

  const priceRows = Object.entries(cityPricing.sizes).map(([size, materials]) => {

    return `
<tr>
<td>${size} sq ft</td>
<td>$${materials.asphalt.toLocaleString()}</td>
<td>$${materials.architectural.toLocaleString()}</td>
<td>$${materials.metal.toLocaleString()}</td>
<td>$${materials.tile.toLocaleString()}</td>
</tr>
`;

  }).join("");

  template = template.replaceAll("{{CITY}}", cityPricing.city);
  template = template.replaceAll("{{STATE_CODE}}", cityPricing.state_code);
  template = template.replaceAll("{{STATE_NAME}}", cityPricing.state);
  template = template.replaceAll("{{SLUG}}", slug);
  template = template.replace("{{PRICE_ROWS}}", priceRows);

  return template;
}



function generateHomepageCityLinks(cities) {

  const sorted = [...cities].sort((a,b)=>b.population-a.population).slice(0,24);

  const links = sorted.map(city=>{
    const filename = buildCityPageFilename(city.city, city.state_code);
    return `<li><a href="/trueprice/${filename}">${city.city}, ${city.state_code}</a></li>`;
  }).join("\n");

  return `
<section class="city-links-section">
<h2>Roof Cost Guides by City</h2>
<ul>
${links}
</ul>
</section>`;
}



function generateHomepageStateLinks(cities){

  const grouped = groupCitiesByState(cities);

  const links = Object.keys(grouped).map(state=>{
    const filename = buildStatePageFilename(state);
    return `<li><a href="/trueprice/${filename}">${state}</a></li>`;
  }).join("\n");

  return `
<section class="state-links-section">
<h2>Roof Cost Guides by State</h2>
<ul>
${links}
</ul>
</section>`;
}



function generateHomepageMaterialLinks(pricingModel){

  const materials = Object.keys(pricingModel.basePricePerSquare);

  const links = materials.map(material=>{
    const filename = buildMaterialPageFilename(material);
    return `<li><a href="/trueprice/${filename}">${formatMaterialName(material)} Roof Cost</a></li>`;
  }).join("\n");

  return `
<section class="material-links-section">
<h2>Roof Cost Guides by Material</h2>
<ul>
${links}
</ul>
</section>`;
}



function updateHomepageCitySection(cities, pricingModel){

  if(!fs.existsSync(INDEX_PATH)) return;

  let indexHtml = fs.readFileSync(INDEX_PATH,"utf8");


  const cityRegex = /<!--\s*CITY_LINKS_START\s*-->[\s\S]*?<!--\s*CITY_LINKS_END\s*-->/;

  if(cityRegex.test(indexHtml)){
    const section = generateHomepageCityLinks(cities);
    indexHtml = indexHtml.replace(cityRegex,`<!-- CITY_LINKS_START -->\n${section}\n<!-- CITY_LINKS_END -->`);
    console.log("Updated homepage city section.");
  }


  const stateRegex = /<!--\s*STATE_LINKS_START\s*-->[\s\S]*?<!--\s*STATE_LINKS_END\s*-->/;

  if(stateRegex.test(indexHtml)){
    const section = generateHomepageStateLinks(cities);
    indexHtml = indexHtml.replace(stateRegex,`<!-- STATE_LINKS_START -->\n${section}\n<!-- STATE_LINKS_END -->`);
    console.log("Updated homepage state section.");
  }


  const materialRegex = /<!--\s*MATERIAL_LINKS_START\s*-->[\s\S]*?<!--\s*MATERIAL_LINKS_END\s*-->/;

  if(materialRegex.test(indexHtml)){
    const section = generateHomepageMaterialLinks(pricingModel);
    indexHtml = indexHtml.replace(materialRegex,`<!-- MATERIAL_LINKS_START -->\n${section}\n<!-- MATERIAL_LINKS_END -->`);
    console.log("Updated homepage material section.");
  }

  fs.writeFileSync(INDEX_PATH,indexHtml,"utf8");
}



function generateMaterialPages(cityPricingArray, pricingModel){

  const materials = Object.keys(pricingModel.basePricePerSquare);

  for(const material of materials){

    const template = loadMaterialTemplate();

    const filename = buildMaterialPageFilename(material);
    const canonicalUrl = `${SITE_BASE_URL}/${filename}`;

    let html = template;

    html = html.replaceAll("{{MATERIAL_PAGE_TITLE}}",`${formatMaterialName(material)} Roof Replacement Cost (2026) | TruePrice`);
    html = html.replaceAll("{{MATERIAL_META_DESCRIPTION}}",`Average ${material} roof replacement cost.`);
    html = html.replaceAll("{{MATERIAL_CANONICAL_URL}}",canonicalUrl);
    html = html.replaceAll("{{MATERIAL_DISPLAY_NAME}}",formatMaterialName(material));

    fs.writeFileSync(path.join(ROOT,filename),html,"utf8");

    console.log(`Generated ${filename}`);
  }

}



function generateSitemap(cityRows, pricingModel){

  const groupedStates = groupCitiesByState(cityRows);

  const stateUrls = Object.keys(groupedStates).map(
    s=>`${SITE_BASE_URL}/${buildStatePageFilename(s)}`
  );

  const materialUrls = Object.keys(pricingModel.basePricePerSquare).map(
    m=>`${SITE_BASE_URL}/${buildMaterialPageFilename(m)}`
  );

  const urls = [
    `${SITE_BASE_URL}/`,
    `${SITE_BASE_URL}/all-cities.html`,
    ...stateUrls,
    ...materialUrls,
    ...cityRows.map(city =>
      `${SITE_BASE_URL}/${buildCityPageFilename(city.city, city.state_code)}`
    )
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url=>`<url><loc>${url}</loc></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(SITEMAP_PATH,xml,"utf8");

  console.log("Generated sitemap.xml");
}



function generateAllCitiesPage(cityRows, pricingModel){

  let template = fs.readFileSync(ALL_CITIES_TEMPLATE_PATH,"utf8");

  const cityLinks = cityRows.map(city=>{
    const filename = buildCityPageFilename(city.city, city.state_code);
    return `<li><a href="/trueprice/${filename}">${city.city}, ${city.state_code}</a></li>`;
  }).join("\n");

  template = template.replace("{{CITY_LINKS}}",cityLinks);

  const stateLinks = Object.keys(groupCitiesByState(cityRows))
    .map(s=>`<li><a href="/trueprice/${buildStatePageFilename(s)}">${s}</a></li>`)
    .join("\n");

  template = template.replace("{{STATE_LINKS}}",stateLinks);

  const materialLinks = Object.keys(pricingModel.basePricePerSquare)
    .map(m=>`<li><a href="/trueprice/${buildMaterialPageFilename(m)}">${formatMaterialName(m)}</a></li>`)
    .join("\n");

  template = template.replace("{{MATERIAL_LINKS}}",materialLinks);

  fs.writeFileSync(ALL_CITIES_PAGE_PATH,template,"utf8");

  console.log("Generated all-cities.html");
}



function main(){

  const pricingModel = readJson(PRICING_MODEL_PATH);
  const stateRegions = readJson(STATE_REGIONS_PATH);

  const csvText = fs.readFileSync(INPUT_CSV,"utf8");

  const cityRows = parseCsv(csvText);

  const cityPricingArray = cityRows.map(cityRow =>
    calculatePriceTable(cityRow,pricingModel,stateRegions)
  );

  fs.writeFileSync(
    OUTPUT_PRICING_JSON,
    JSON.stringify(cityPricingArray,null,2),
    "utf8"
  );

  console.log("Generated data/city-house-size-pricing.json");


  for(const cityPricing of cityPricingArray){

    const filename = buildCityPageFilename(cityPricing.city,cityPricing.state_code);

    const html = generateCityPageHtml(cityPricing,cityPricingArray);

    fs.writeFileSync(path.join(ROOT,filename),html,"utf8");

    console.log(`Generated ${filename}`);
  }


  generateMaterialPages(cityPricingArray,pricingModel);

  updateHomepageCitySection(cityRows,pricingModel);

  generateSitemap(cityRows,pricingModel);

  generateAllCitiesPage(cityRows,pricingModel);

  console.log("Build complete.");
}

main();