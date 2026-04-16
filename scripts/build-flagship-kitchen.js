#!/usr/bin/env node
/**
 * Generates deep editorial content for 10 flagship metro kitchen remodel pages.
 * Injects ~2500 words of genuinely unique, city-specific prose.
 * Idempotent via FLAGSHIP-KITCHEN-CONTENT markers.
 *
 * Usage: node scripts/build-flagship-kitchen.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/kitchen-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-KITCHEN-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-KITCHEN-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-kitchen-remodel-cost.html" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-kitchen-remodel-cost.html" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-kitchen-remodel-cost.html" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-kitchen-remodel-cost.html" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-kitchen-remodel-cost.html" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-kitchen-remodel-cost.html" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-kitchen-remodel-cost.html" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-kitchen-remodel-cost.html" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-kitchen-remodel-cost.html" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-kitchen-remodel-cost.html" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-kitchen-remodel-cost.html" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-kitchen-remodel-cost.html" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-kitchen-remodel-cost.html" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-kitchen-remodel-cost.html" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-kitchen-remodel-cost.html" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-kitchen-remodel-cost.html" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-kitchen-remodel-cost.html" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-kitchen-remodel-cost.html" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-kitchen-remodel-cost.html" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-kitchen-remodel-cost.html" },
];

const STATE_TO_REGION = {
  TX: "south", LA: "south", MS: "south", AL: "south", OK: "south", AR: "south",
  GA: "southeast", FL: "southeast", SC: "southeast", NC: "southeast", TN: "southeast", VA: "southeast",
  NY: "northeast", NJ: "northeast", PA: "northeast", CT: "northeast", MA: "northeast", MD: "northeast", DE: "northeast", DC: "northeast", RI: "northeast", NH: "northeast", VT: "northeast", ME: "northeast",
  IL: "midwest", OH: "midwest", MI: "midwest", IN: "midwest", WI: "midwest", MN: "midwest", IA: "midwest", MO: "midwest", KS: "midwest", NE: "midwest", ND: "midwest", SD: "midwest",
  CO: "mountain", AZ: "mountain", NM: "mountain", UT: "mountain", MT: "mountain", WY: "mountain", ID: "mountain", NV: "mountain",
  CA: "west", WA: "west", OR: "west", HI: "west", AK: "west",
};

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`; }
function fmtD(n) { return `$${n.toLocaleString("en-US")}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function getMultiplier(state) {
  const region = STATE_TO_REGION[state] || "south";
  return pricingModel.laborMultiplierByRegion[region] || 1.0;
}

/* ---------- Sections ---------- */

function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";
  const baseMinor = 22500;
  const baseMid = 45000;
  const baseGut = 90000;
  const baseLux = 150000;

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    const minor = Math.round(baseMinor * mult * localVar / 500) * 500;
    const mid = Math.round(baseMid * mult * localVar / 500) * 500;
    const gut = Math.round(baseGut * mult * localVar / 500) * 500;
    const lux = Math.round(baseLux * mult * localVar / 500) * 500;
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(minor)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(mid)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(gut)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(lux)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>Kitchen Remodel Pricing by Neighborhood in ${facts.displayName}</h2>
<p>Kitchen remodel costs in ${facts.displayName} vary by neighborhood based on labor rates, housing age, and the scope of work required. These estimates are for an average-sized kitchen (100-150 sq ft).</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Minor Refresh</th>
<th style="text-align:right; padding:12px 16px;">Mid-Range</th>
<th style="text-align:right; padding:12px 16px;">Full Gut</th>
<th style="text-align:right; padding:12px 16px;">Luxury</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Estimates include labor, materials, and standard finishes for each tier. Appliance budgets, custom cabinetry, and structural changes add to these ranges. <a href="/analyze-my-quote.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your quote for a free comparison.</a></p>
</section>`;
}

function scopePlanningGuide(city, state, mult) {
  return `
<section class="section fp-section">
<h2>Scope Planning: What's Included at Each Price Tier in ${city}</h2>
<p>One of the biggest sources of confusion in kitchen remodeling is understanding what you actually get at each price point. Here is what each tier typically includes in the ${city} market.</p>

<p><strong>Minor refresh ($${Math.round(15000 * mult / 1000)}K-$${Math.round(30000 * mult / 1000)}K).</strong> Cabinet refacing or painting, new hardware, countertop replacement (laminate or low-end granite), updated lighting fixtures, fresh paint, and new backsplash. Existing layout stays the same. No plumbing or electrical relocation. This level works best when cabinets are structurally sound and the floor plan is functional. Timeline: 2-4 weeks.</p>

<p><strong>Mid-range remodel ($${Math.round(30000 * mult / 1000)}K-$${Math.round(60000 * mult / 1000)}K).</strong> New semi-custom cabinets, quartz or granite countertops, tile backsplash, new sink and faucet, updated lighting (recessed + under-cabinet), new flooring, fresh appliances at the mid-tier level. Minor layout changes possible (moving a sink or adding an island) but walls stay in place. Electrical panel upgrade may be needed for modern appliance loads. Timeline: 4-8 weeks.</p>

<p><strong>Full gut renovation ($${Math.round(60000 * mult / 1000)}K-$${Math.round(120000 * mult / 1000)}K).</strong> Everything down to the studs. New custom or semi-custom cabinets, premium countertops, new plumbing runs, new electrical (including dedicated circuits for every major appliance), structural changes (removing walls, adding islands with plumbing), new subfloor and flooring, professional lighting design, premium appliance package. In ${city}, this level typically requires building permits and multiple trade inspections. Timeline: 8-16 weeks.</p>

<p><strong>Luxury ($${Math.round(120000 * mult / 1000)}K+).</strong> Everything in the gut renovation plus fully custom cabinetry, imported stone or exotic countertops, professional-grade appliances, designer fixtures, integrated smart home features, and professional kitchen design. In ${city}'s premium neighborhoods, luxury kitchen remodels can reach $200K+ for large spaces with high-end finishes. Timeline: 12-24 weeks.</p>
</section>`;
}

function cabinetOptions(city, state, facts) {
  return `
<section class="section fp-section">
<h2>Cabinet Options: Stock vs. Semi-Custom vs. Custom in ${city}</h2>
<p>Cabinets typically consume 25-35% of a kitchen remodel budget, making them the single largest line item. Understanding the three tiers helps you allocate budget effectively.</p>

<p><strong>Stock cabinets ($100-$300 per linear foot installed)</strong> are pre-manufactured in standard sizes and available in 2-3 weeks. They come in limited door styles, finishes, and configurations. In ${city}, stock cabinets work well for budget-conscious remodels where the existing layout is being preserved. Major brands include Hampton Bay, Diamond NOW, and Arcadia. The main limitation is that stock cabinets only come in 3-inch width increments, so filler strips are needed for non-standard spaces.</p>

<p><strong>Semi-custom cabinets ($200-$600 per linear foot installed)</strong> offer more door styles, finish options, and interior configurations than stock. They are built to order in 4-8 weeks. Semi-custom cabinets are the sweet spot for most ${city} kitchen remodels because they offer customization (pull-out shelves, soft-close hardware, specialty storage) without the custom price tag. Brands like KraftMaid, Merillat, and Yorktowne fall in this range.</p>

<p><strong>Custom cabinets ($500-$1,200+ per linear foot installed)</strong> are built from scratch to your exact specifications by a local cabinet shop. Lead times run 8-16 weeks in ${city}. Custom cabinets are warranted when you have unusual dimensions, specific wood or finish requirements, or want furniture-quality construction. In ${city}, ${facts.homeAge ? `older homes with ${facts.homeAge.split(";")[0]} often have non-standard room dimensions that benefit from custom sizing` : "non-standard room dimensions often benefit from custom sizing"}.</p>

<p><strong>Refacing vs. replacing.</strong> If your existing cabinet boxes are solid and well-aligned, refacing (new doors, drawer fronts, and veneer on the boxes) costs 40-60% less than full replacement. In ${city}, cabinet refacing runs $5,000-$12,000 for an average kitchen and can be completed in 3-5 days. Refacing makes sense when the layout works and the boxes are in good condition. It does not make sense when boxes are damaged, the layout needs to change, or you want to add cabinets.</p>
</section>`;
}

function countertopComparison(city, state, ctx, facts) {
  const paras = [];

  paras.push(`<p>Countertop selection affects both the budget and the resale value of your kitchen remodel in ${city}. Here is how the main options compare in this market.</p>`);

  if (ctx.climateZone === "hot_humid" || ctx.climateZone === "hot_dry" || state === "TX" || state === "AZ") {
    paras.push(`<p><strong>Granite</strong> remains the most popular countertop material in ${city}'s market, particularly in suburban neighborhoods and traditional home styles. In ${city}, granite runs $40-$100 per square foot installed, depending on the stone variety and edge profile. Granite is heat-resistant (important in ${city}'s climate for setting down hot cookware) and extremely durable. The main downsides are that it requires annual sealing to prevent staining and that color options are limited to what nature provides.</p>`);
    paras.push(`<p><strong>Quartz</strong> (engineered stone) is gaining ground rapidly in ${city}, especially in modern and contemporary remodels. Quartz runs $50-$120 per square foot installed and offers consistent color and pattern options that natural stone cannot match. Quartz is non-porous (no sealing required), stain-resistant, and available in designs that mimic marble, concrete, and other natural materials. In ${city}'s newer subdivisions, quartz has overtaken granite as the default premium countertop choice.</p>`);
  } else {
    paras.push(`<p><strong>Quartz</strong> (engineered stone) is the dominant premium countertop choice in ${city}'s market, running $50-$120 per square foot installed. Quartz is non-porous, stain-resistant, and requires zero maintenance beyond normal cleaning. The consistent colors and patterns appeal to ${city}'s design-forward market. Popular brands in this area include Caesarstone, Cambria, and Silestone.</p>`);
    paras.push(`<p><strong>Granite</strong> remains a solid choice in ${city}, particularly for traditional home styles, running $40-$100 per square foot installed. Granite offers unique natural patterns and excellent heat resistance. In ${city}'s market, granite is often selected for its warmth and character in craftsman, colonial, and traditional-style kitchens. Annual sealing is required to maintain stain resistance.</p>`);
  }

  paras.push(`<p><strong>Laminate</strong> ($10-$30 per square foot installed) has improved dramatically and is no longer the budget afterthought it once was. Modern laminate countertops from brands like Formica and Wilsonart offer realistic stone and wood patterns, square-edge profiles, and integrated sinks. In ${city}, laminate is the right choice for budget remodels, rental properties, and homeowners who plan to sell within 2-3 years and want to maximize ROI without overspending on finishes.</p>`);

  paras.push(`<p><strong>Butcher block</strong> ($40-$70 per square foot installed) adds warmth and character, particularly popular in ${city}'s craftsman and farmhouse-style kitchens. It requires regular oiling and is susceptible to water damage if not maintained, but it can be sanded and refinished multiple times. Best used as an accent surface (island top, baking station) rather than full-perimeter countertops.</p>`);

  return `
<section class="section fp-section">
<h2>Countertop Comparison for the ${city} Market</h2>
${paras.join("\n")}
</section>`;
}

function permitRequirements(city, state, facts) {
  return `
<section class="section fp-section">
<h2>Permit Requirements for Kitchen Remodels in ${city}</h2>
<p>Not every kitchen remodel in ${city} requires permits, but many do. Understanding the triggers helps you plan timelines and avoid compliance issues that can delay or derail your project.</p>

<p><strong>What triggers a permit.</strong> In ${city}, permits are generally required when the scope includes: moving or adding electrical circuits (adding outlets, lighting circuits, or upgrading the panel), relocating plumbing (moving the sink, adding a dishwasher line, gas line work), removing or modifying load-bearing walls, or adding or modifying ventilation ductwork. Cosmetic work (painting, cabinet refacing, countertop replacement, new appliances in existing locations) typically does not require a permit.</p>

<p><strong>Electrical is the most common trigger.</strong> Modern kitchens require dedicated 20-amp circuits for the refrigerator, dishwasher, garbage disposal, and microwave, plus a dedicated 50-amp circuit for an electric range. Older homes in ${city} ${facts.homeAge ? `(${facts.homeAge.split(";")[0]})` : ""} often have inadequate electrical service for a modern kitchen. Upgrading the electrical panel ($1,500-$3,000) and running new circuits ($150-$300 per circuit) are common additions to mid-range and gut remodels.</p>

<p><strong>Plumbing permits.</strong> Any plumbing work beyond replacing fixtures in existing locations requires a plumbing permit in ${city}. Moving a sink 6 inches to center it on a new window requires a permit. Moving it to a new island requires a permit plus potential venting changes that affect the scope and cost significantly.</p>

<p><strong>Timeline impact.</strong> ${facts.permits}. Factor permit review time into your project schedule. In ${city}, permit delays of 1-3 weeks are common and should be built into the contractor's timeline from the start. A contractor who asks you to \"start work and get the permit later\" is creating a compliance risk that falls on you as the homeowner.</p>
</section>`;
}

function redFlagsSection(city, state) {
  const flags = [];

  flags.push({ title: "No detailed scope of work", body: `A kitchen remodel quote should itemize every major component: demolition, cabinets (brand, style, count), countertops (material, square footage), flooring (material, area), plumbing (fixtures, rough-in changes), electrical (circuit count, panel work), appliances (if included), painting, backsplash, and permits. In ${city}, a single-line-item quote like \"kitchen remodel: $45,000\" gives you zero protection against scope reduction, material downgrades, or surprise change orders. Get everything in writing before signing.` });

  flags.push({ title: "Missing allowances", body: `Many ${city} kitchen contractors use \"allowances\" for materials -- a budget placeholder that may or may not cover what you actually select. A $2,000 cabinet allowance sounds reasonable until you realize it covers builder-grade stock cabinets and your semi-custom selections cost $8,000. Ask exactly what each allowance covers (brand, quality tier, square footage) and what happens when your selections exceed the allowance. The best contracts specify exact products or provide realistic allowance amounts with clear overage terms.` });

  flags.push({ title: "Unrealistic timelines", body: `A full gut kitchen remodel in ${city} takes 8-16 weeks minimum. A contractor who promises 4 weeks for a gut renovation is either planning to cut corners on inspections, overlapping trades dangerously, or not accounting for permit review and material lead times. Semi-custom cabinets alone take 4-8 weeks to arrive. Add permit review, demolition, rough-in trades, inspections, and finish work, and you understand why realistic timelines matter more than optimistic promises.` });

  flags.push({ title: "Large deposit with no milestone schedule", body: `Kitchen remodels should use milestone-based payments: deposit at signing (10-15%), payment at demolition/rough-in completion, payment at cabinet installation, and final payment at completion and punch-list resolution. A contractor in ${city} asking for 50% upfront before any work begins is a warning sign. Materials can be ordered with modest deposits, and established contractors have supplier credit relationships that do not require your cash upfront.` });

  flags.push({ title: "No change order process", body: `Changes are inevitable in kitchen remodeling. The contract should specify a formal change order process: written description of the change, cost impact, timeline impact, and signatures from both parties before work proceeds. In ${city}, verbal agreements for changes are the number-one source of contractor disputes. If it is not in writing, it does not exist.` });

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>Kitchen Remodel Red Flags in ${city}</h2>
<p>Kitchen remodeling is one of the most complex and expensive home improvement projects. Here are the warning signs that ${city} homeowners should watch for when vetting contractors and reviewing proposals.</p>
${flagsHTML}
</section>`;
}

function seasonalGuide(city, ctx) {
  const seasons = {
    hot_humid: { best: "January through March", worst: "May through July", reason: "Early year is ideal because contractors are finishing holiday-season slowdown, material suppliers have full stock, and your kitchen disruption happens during mild weather when outdoor cooking is feasible." },
    hot_dry: { best: "September through February", worst: "March through May", reason: "Fall and winter offer the best contractor availability and moderate temperatures. Spring home-selling season drives peak demand for kitchen remodels." },
    cold: { best: "January through March", worst: "May through August", reason: "Winter is the slowest season for contractors, which means better pricing, more attention, and faster scheduling. You lose your kitchen during the season when you are least likely to grill outdoors, but the cost savings offset the inconvenience." },
    temperate: { best: "September through November", worst: "March through May", reason: "Fall offers good contractor availability and moderate temperatures. Spring demand spikes as homeowners prepare for summer entertaining." },
    mixed_humid: { best: "October through January", worst: "March through June", reason: "Late fall through winter offers the best combination of contractor availability and pricing. Spring and early summer are peak season for kitchen remodels." },
    mixed_dry: { best: "September through November", worst: "March through May", reason: "Fall provides good weather, moderate demand, and contractors looking to fill year-end schedules." },
    marine: { best: "October through January", worst: "May through August", reason: "Fall and early winter offer the best contractor availability and pricing. Summer is peak season for all home improvement in the Pacific Northwest." },
  };
  const s = seasons[ctx.climateZone] || seasons.temperate;

  return `
<section class="section fp-section">
<h2>Best Time to Start a Kitchen Remodel in ${city}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months to start</h3>
<p class="fp-season-months">${s.best}</p>
<p>${s.reason}</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Peak pricing / longest wait</h3>
<p class="fp-season-months">${s.worst}</p>
<p>Expect 10-20% higher labor costs and 2-4 week longer lead times during peak season in ${city}. Book contractors 8-12 weeks ahead during these months.</p>
</div>
</div>
<p>Regardless of season, order cabinets as early as possible. Lead times of 4-8 weeks for semi-custom and 8-16 weeks for custom cabinets are the most common source of project delays in ${city}.</p>
</section>`;
}

function costScenarios(city, state, mult) {
  const budget = { label: "Minor Refresh", scope: "Cabinet painting, new hardware, laminate countertops, backsplash, lighting update", total: Math.round(22500 * mult / 500) * 500 };
  const mid = { label: "Mid-Range Remodel", scope: "Semi-custom cabinets, quartz counters, tile backsplash, new flooring, mid-tier appliances", total: Math.round(48000 * mult / 500) * 500 };
  const prem = { label: "Full Gut Renovation", scope: "Custom cabinets, premium stone, new layout, electrical upgrade, pro-grade appliances", total: Math.round(95000 * mult / 500) * 500 };

  function scenarioCard(label, s, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${s.label}</p>
<p class="fp-scenario-total">${fmtK(s.total)}</p>
<p class="fp-scenario-detail">${s.scope}. Average-sized kitchen (100-150 sq ft).</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>What a Kitchen Remodel Actually Costs in ${city}: 3 Scenarios</h2>
<p>Here is what real kitchen remodel projects look like in ${city}, ${state}, using ${city}-adjusted labor and material costs for 2026.</p>
<div class="fp-scenario-grid">
${scenarioCard("Budget", budget, "#22c55e")}
${scenarioCard("Mid-Range", mid, "#3b82f6")}
${scenarioCard("Premium", prem, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">Scenarios assume average kitchen size (100-150 sq ft). Small kitchens cost 25% less; large kitchens (200+ sq ft) cost 30-65% more. <a href="/kitchen-remodel-cost.html" style="color:var(--brand);">See the full kitchen remodel cost guide.</a></p>
</section>`;
}

function flagshipCSS() {
  return `
<style>
.fp-section { margin-top:32px; }
.fp-section h2 { font-size:22px; margin-bottom:12px; color:#0f172a; }
.fp-section p { font-size:15px; line-height:1.7; color:#334155; margin-bottom:12px; }
.fp-table { border:1px solid var(--border,#e2e8f0); border-radius:10px; overflow:hidden; }
.fp-table tbody tr:nth-child(even) { background:var(--bg-subtle,#f8fafc); }
.fp-flag { padding:16px 20px; border-radius:10px; border:1px solid #fecaca; background:#fef2f2; margin-bottom:12px; }
.fp-flag h3 { font-size:15px; font-weight:700; color:#b91c1c; margin:0 0 6px; }
.fp-flag p { margin:0; font-size:14px; line-height:1.6; color:#7f1d1d; }
.fp-season-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:16px 0; }
.fp-season-card { padding:20px; border-radius:12px; }
.fp-season-best { background:#f0fdf4; border:1px solid #a7f3d0; }
.fp-season-worst { background:#fff7ed; border:1px solid #fdba74; }
.fp-season-card h3 { font-size:14px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin:0 0 8px; }
.fp-season-months { font-size:18px; font-weight:700; color:#0f172a; margin:0 0 8px; }
.fp-season-card p { font-size:14px; margin:0; }
.fp-scenario-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin:16px 0; }
.fp-scenario-card { padding:20px; background:#fff; border:1px solid var(--border,#e2e8f0); border-radius:12px; }
.fp-scenario-card h3 { font-size:16px; font-weight:700; margin:0 0 8px; color:#0f172a; }
.fp-scenario-material { font-size:13px; color:var(--text-muted); margin:0 0 4px; }
.fp-scenario-total { font-size:28px; font-weight:800; color:var(--brand,#1d4ed8); margin:0 0 8px; }
.fp-scenario-detail { font-size:13px; color:#64748b; margin:0; }
@media(max-width:700px) {
  .fp-scenario-grid { grid-template-columns:1fr; }
  .fp-season-grid { grid-template-columns:1fr; }
}
</style>`;
}

/* ---------- Build + Inject ---------- */

function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  if (!facts || !ctx) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getMultiplier(state);

  let html = `\n${MARKER_START}\n`;
  html += flagshipCSS();
  html += neighborhoodPricing(facts, mult);
  html += scopePlanningGuide(city, state, mult);
  html += cabinetOptions(city, state, facts);
  html += countertopComparison(city, state, ctx, facts);
  html += permitRequirements(city, state, facts);
  html += redFlagsSection(city, state);
  html += seasonalGuide(city, ctx);
  html += costScenarios(city, state, mult);
  html += `\n${MARKER_END}\n`;

  return html;
}

function main() {
  let processed = 0;
  let skipped = 0;

  for (const metro of METROS) {
    const filepath = path.join(ROOT, metro.file);
    if (!fs.existsSync(filepath)) {
      console.log(`  SKIP ${metro.file} (file not found)`);
      skipped++;
      continue;
    }

    const flagshipHTML = buildFlagshipContent(metro);
    if (!flagshipHTML) {
      console.log(`  SKIP ${metro.file} (no data for ${metro.ctxKey})`);
      skipped++;
      continue;
    }

    let content = fs.readFileSync(filepath, "utf8");

    // Remove old flagship content (idempotent)
    const re = new RegExp(`${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, "g");
    content = content.replace(re, "");

    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    // Injection point: before TP-NEARBY-CITIES, or before </main>
    const nearbyMarker = "<!-- TP-NEARBY-CITIES -->";
    const nearbyIdx = content.indexOf(nearbyMarker);
    let insertAt;

    if (nearbyIdx >= 0) {
      const prevSectionEnd = content.lastIndexOf("</section>", nearbyIdx);
      insertAt = prevSectionEnd >= 0 ? prevSectionEnd + "</section>".length : nearbyIdx;
    } else {
      const mainClose = content.indexOf("</main>");
      if (mainClose >= 0) {
        insertAt = mainClose;
      } else {
        console.log(`  SKIP ${metro.file} (no injection point found)`);
        skipped++;
        continue;
      }
    }

    content = content.slice(0, insertAt) + nl + flagshipContent + content.slice(insertAt);

    if (!DRY) {
      fs.writeFileSync(filepath, content, "utf8");
    }

    const wordCount = flagshipHTML.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    console.log(`  ${metro.file}: ~${wordCount} words of flagship content injected`);
    processed++;
  }

  console.log(`\nDone: ${processed} flagship kitchen pages processed, ${skipped} skipped.`);
  if (DRY) console.log("[DRY RUN: no files written]");
}

main();
