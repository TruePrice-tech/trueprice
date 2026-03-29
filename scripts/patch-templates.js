/**
 * Patch non-roofing city page templates to add:
 * 1. "Other Services" cross-links section
 * 2. Service + AggregateOffer schema
 * Then patch build scripts to supply {{SLUG_LC}} and {{AVG_LOW_RAW}}/{{AVG_HIGH_RAW}}
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATES_DIR = path.join(ROOT, "templates");

const ALL_SERVICES = [
  { slug: "roof-cost", label: "Roofing" },
  { slug: "hvac-cost", label: "HVAC" },
  { slug: "plumbing-cost", label: "Plumbing" },
  { slug: "electrical-cost", label: "Electrical" },
  { slug: "window-cost", label: "Windows" },
  { slug: "siding-cost", label: "Siding" },
  { slug: "painting-cost", label: "Painting" },
  { slug: "solar-cost", label: "Solar" },
  { slug: "garage-door-cost", label: "Garage Doors" },
  { slug: "fence-cost", label: "Fencing" },
  { slug: "concrete-cost", label: "Concrete" },
  { slug: "landscaping-cost", label: "Landscaping" },
  { slug: "foundation-cost", label: "Foundation" },
  { slug: "kitchen-remodel-cost", label: "Kitchen" },
  { slug: "insulation-cost", label: "Insulation" },
];

// Map template filename to its service slug
const TEMPLATE_SERVICE_MAP = {
  "hvac-city-page-template.html": "hvac-cost",
  "plumbing-city-page-template.html": "plumbing-cost",
  "electrical-city-page-template.html": "electrical-cost",
  "window-city-page-template.html": "window-cost",
  "siding-city-page-template.html": "siding-cost",
  "painting-city-page-template.html": "painting-cost",
  "solar-city-page-template.html": "solar-cost",
  "garage-door-city-page-template.html": "garage-door-cost",
  "fencing-city-page-template.html": "fence-cost",
  "concrete-city-page-template.html": "concrete-cost",
  "landscaping-city-page-template.html": "landscaping-cost",
  "foundation-city-page-template.html": "foundation-cost",
  "kitchen-city-page-template.html": "kitchen-remodel-cost",
  "insulation-city-page-template.html": "insulation-cost",
};

// Map template filename to its service display name
const TEMPLATE_SERVICE_NAME = {
  "hvac-city-page-template.html": "HVAC Replacement",
  "plumbing-city-page-template.html": "Plumbing Service",
  "electrical-city-page-template.html": "Electrical Service",
  "window-city-page-template.html": "Window Replacement",
  "siding-city-page-template.html": "Siding Installation",
  "painting-city-page-template.html": "House Painting",
  "solar-city-page-template.html": "Solar Installation",
  "garage-door-city-page-template.html": "Garage Door Installation",
  "fencing-city-page-template.html": "Fence Installation",
  "concrete-city-page-template.html": "Concrete Work",
  "landscaping-city-page-template.html": "Landscaping",
  "foundation-city-page-template.html": "Foundation Repair",
  "kitchen-city-page-template.html": "Kitchen Remodel",
  "insulation-city-page-template.html": "Insulation",
};

const PILL_STYLE = 'style="padding:8px 14px; border:1px solid var(--border); border-radius:999px; font-size:13px; color:var(--brand); text-decoration:none;"';

function buildCrossLinksSection(currentSlug) {
  const links = ALL_SERVICES
    .filter(s => s.slug !== currentSlug)
    .map(s => `<a href="/{{SLUG_LC}}-${s.slug}.html" ${PILL_STYLE}>${s.label}</a>`)
    .join("\n");

  return `
<section class="section">
<h2>Other Services in {{CITY}}</h2>
<p>Compare contractor costs for other home services in {{CITY_STATE}}.</p>
<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
${links}
</div>
</section>
`;
}

function buildServiceSchema(serviceName) {
  return `
<script type="application/ld+json">
{
"@context":"https://schema.org",
"@type":"Service",
"name":"${serviceName} in {{CITY_STATE}}",
"provider":{"@type":"Organization","name":"TruePrice","url":"https://truepricehq.com"},
"areaServed":{"@type":"City","name":"{{CITY_STATE}}"},
"offers":{
"@type":"AggregateOffer",
"priceCurrency":"USD",
"lowPrice":"{{AVG_LOW_RAW}}",
"highPrice":"{{AVG_HIGH_RAW}}"
}
}
</script>
`;
}

function buildBreadcrumbSchema(serviceLabel, serviceHubPage) {
  return `
<script type="application/ld+json">
{
"@context":"https://schema.org",
"@type":"BreadcrumbList",
"itemListElement":[
{"@type":"ListItem","position":1,"name":"Home","item":"https://truepricehq.com/"},
{"@type":"ListItem","position":2,"name":"${serviceLabel}","item":"https://truepricehq.com/${serviceHubPage}"},
{"@type":"ListItem","position":3,"name":"{{CITY}}"}
]
}
</script>
`;
}

// Hub pages for breadcrumbs
const SERVICE_HUB_PAGES = {
  "hvac-cost": "hvac-cost.html",
  "plumbing-cost": "plumbing-cost.html",
  "electrical-cost": "electrical-cost.html",
  "window-cost": "window-replacement-cost.html",
  "siding-cost": "siding-cost.html",
  "painting-cost": "painting-cost.html",
  "solar-cost": "solar-cost.html",
  "garage-door-cost": "garage-door-cost.html",
  "fence-cost": "fence-cost.html",
  "concrete-cost": "concrete-cost.html",
  "landscaping-cost": "landscaping-cost.html",
  "foundation-cost": "foundation-repair-cost.html",
  "kitchen-remodel-cost": "kitchen-remodel-cost.html",
  "insulation-cost": "insulation-cost.html",
};

let patchedCount = 0;

for (const [templateFile, serviceSlug] of Object.entries(TEMPLATE_SERVICE_MAP)) {
  const templatePath = path.join(TEMPLATES_DIR, templateFile);
  if (!fs.existsSync(templatePath)) {
    console.warn(`Template not found: ${templateFile}`);
    continue;
  }

  let html = fs.readFileSync(templatePath, "utf8");
  const serviceName = TEMPLATE_SERVICE_NAME[templateFile];
  const serviceLabel = ALL_SERVICES.find(s => s.slug === serviceSlug).label;
  const hubPage = SERVICE_HUB_PAGES[serviceSlug];

  // 1. Add cross-links section before </main>
  if (!html.includes("Other Services")) {
    const crossLinks = buildCrossLinksSection(serviceSlug);
    html = html.replace("</main>", crossLinks + "\n</main>");
  }

  // 2. Add Service schema before </head>
  if (!html.includes('"@type":"Service"')) {
    const schema = buildServiceSchema(serviceName);
    html = html.replace("</head>", schema + "\n</head>");
  }

  // 3. Add BreadcrumbList schema if not present
  if (!html.includes("BreadcrumbList")) {
    const breadcrumb = buildBreadcrumbSchema(serviceLabel, hubPage);
    html = html.replace("</head>", breadcrumb + "\n</head>");
  }

  fs.writeFileSync(templatePath, html, "utf8");
  patchedCount++;
  console.log(`Patched: ${templateFile}`);
}

// Also add Service schema to roofing template
const roofingTemplate = path.join(TEMPLATES_DIR, "city-page-template.html");
if (fs.existsSync(roofingTemplate)) {
  let html = fs.readFileSync(roofingTemplate, "utf8");
  if (!html.includes('"@type":"Service"')) {
    const schema = `
<script type="application/ld+json">
{
"@context":"https://schema.org",
"@type":"Service",
"name":"Roof Replacement in {{CITY_STATE}}",
"provider":{"@type":"Organization","name":"TruePrice","url":"https://truepricehq.com"},
"areaServed":{"@type":"City","name":"{{CITY_STATE}}"},
"offers":{
"@type":"AggregateOffer",
"priceCurrency":"USD",
"lowPrice":"{{AVG_LOW_RAW}}",
"highPrice":"{{AVG_HIGH_RAW}}"
}
}
</script>
`;
    html = html.replace("</head>", schema + "\n</head>");
    fs.writeFileSync(roofingTemplate, html, "utf8");
    console.log("Patched: city-page-template.html (roofing - schema only)");
    patchedCount++;
  }
}

console.log(`\nDone. Patched ${patchedCount} templates.`);
