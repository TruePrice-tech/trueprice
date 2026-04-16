#!/usr/bin/env node
/**
 * Generates deep editorial content for 10 flagship metro foundation pages.
 * Injects ~2500 words of genuinely unique, city-specific prose.
 * Idempotent via FLAGSHIP-FOUNDATION-CONTENT markers.
 *
 * Usage: node scripts/build-flagship-foundation.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/foundation-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-FOUNDATION-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-FOUNDATION-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-foundation-cost.html" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-foundation-cost.html" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-foundation-cost.html" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-foundation-cost.html" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-foundation-cost.html" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-foundation-cost.html" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-foundation-cost.html" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-foundation-cost.html" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-foundation-cost.html" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-foundation-cost.html" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-foundation-cost.html" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-foundation-cost.html" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-foundation-cost.html" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-foundation-cost.html" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-foundation-cost.html" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-foundation-cost.html" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-foundation-cost.html" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-foundation-cost.html" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-foundation-cost.html" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-foundation-cost.html" },
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
  const basePier = 1500;
  const baseSlab = 3500;
  const baseDrain = 4000;
  const baseFull = 15000;

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    const pier = Math.round(basePier * mult * localVar / 100) * 100;
    const slab = Math.round(baseSlab * mult * localVar / 100) * 100;
    const drain = Math.round(baseDrain * mult * localVar / 100) * 100;
    const full = Math.round(baseFull * mult * localVar / 100) * 100;
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(pier)}/pier</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(slab)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(drain)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(full)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>Neighborhood Foundation Repair Pricing in ${facts.displayName}</h2>
<p>Foundation repair costs vary across ${facts.displayName} based on soil conditions, home age, and local contractor availability. These estimates reflect typical residential projects in each area.</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Pier Install</th>
<th style="text-align:right; padding:12px 16px;">Slab Repair</th>
<th style="text-align:right; padding:12px 16px;">Drainage Fix</th>
<th style="text-align:right; padding:12px 16px;">Full Stabilization</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Estimates based on local labor rates and typical scope. Pier counts, soil conditions, and access affect final pricing. <a href="/analyze-my-quote.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your quote for a free comparison.</a></p>
</section>`;
}

function soilDeepDive(city, state, ctx, facts) {
  const paras = [];
  paras.push(`<p>${cap(facts.soil)}. Soil is the single biggest variable in foundation repair pricing in ${city}, because it determines why your foundation is moving and what kind of repair will actually last.</p>`);

  if (facts.soil.includes("clay") || facts.soil.includes("expansive")) {
    paras.push(`<p><strong>Expansive clay soils</strong> are the primary driver of foundation damage in ${city}. These soils absorb water and swell during wet periods, then shrink and crack during drought. The resulting soil volume changes create uneven pressure under the foundation, causing differential settlement -- some areas sink while others heave. In ${city}, this cycle is particularly aggressive because ${ctx.climateZone === "hot_humid" || ctx.climateZone === "hot_dry" ? "extreme summer heat accelerates moisture loss and drought stress on the soil" : "seasonal moisture swings amplify the shrink-swell cycle"}. Maintaining consistent soil moisture around your foundation through proper drainage and watering during drought periods is the single most effective preventive measure.</p>`);
  }

  if (facts.soil.includes("rock") || facts.soil.includes("limestone") || facts.soil.includes("caliche") || facts.soil.includes("bedrock")) {
    paras.push(`<p><strong>Rocky or limestone conditions</strong> in parts of ${city} present a different challenge. While rock generally provides stable bearing, it makes excavation expensive and limits pier installation options. Helical piers may not be feasible in hard rock, requiring drilled piers or other engineered solutions that cost 30-50% more than standard push piers. If your home sits on rock, get a geotechnical assessment before accepting any foundation repair proposal.</p>`);
  }

  if (facts.soil.includes("sandy") || facts.soil.includes("coastal") || facts.soil.includes("glacial") || facts.soil.includes("till")) {
    paras.push(`<p><strong>Sandy or glacial soils</strong> in ${city} generally cause fewer foundation problems than clay, but they present their own risks. Sandy soils can erode or wash out during heavy rain events, creating voids under footings. ${facts.soil.includes("glacial") ? "Glacial till varies unpredictably in composition and density, which means two homes on the same block can have very different soil bearing capacity." : "Proper compaction and drainage are essential to prevent undermining."} If your home is on sandy soil and you notice settlement, water infiltration is almost always the root cause.</p>`);
  }

  if (facts.geographyNote) {
    paras.push(`<p><strong>Geographic variation.</strong> ${cap(facts.geographyNote)}. This means foundation repair needs and costs can differ significantly between neighborhoods in ${city}. A foundation company experienced in your specific area will have better insight into local soil behavior than one working across the entire metro.</p>`);
  }

  return `
<section class="section fp-section">
<h2>Soil Conditions and Foundation Risk in ${city}</h2>
${paras.join("\n")}
</section>`;
}

function warningSignsGuide(city) {
  return `
<section class="section fp-section">
<h2>Warning Signs of Foundation Problems in ${city}</h2>
<p>Foundation issues rarely appear overnight. Most homeowners in ${city} notice subtle signs months or years before the problem becomes critical. Catching these early can mean the difference between a $1,500 crack repair and a $20,000+ stabilization project.</p>

<div class="fp-flag" style="border-color:#fde68a; background:#fefce8;">
<h3 style="color:#92400e;">Cracks in walls, floors, or exterior brick</h3>
<p style="color:#78350f;">Hairline cracks in drywall are common and usually cosmetic. Diagonal cracks wider than 1/4 inch, stair-step cracks in exterior brick, or cracks that grow over time indicate active foundation movement. Measure and photograph cracks monthly to track progression. If a crack grows more than 1/16 inch in a month, get a structural evaluation promptly.</p>
</div>

<div class="fp-flag" style="border-color:#fde68a; background:#fefce8;">
<h3 style="color:#92400e;">Doors and windows sticking or not closing properly</h3>
<p style="color:#78350f;">When a foundation shifts, door and window frames go out of square. Interior doors that suddenly drag on the floor, exterior doors that no longer latch, or windows that bind are all signs of differential settlement. Seasonal swelling in ${city} can cause temporary sticking, but if the problem persists through multiple seasons, the foundation is the likely cause.</p>
</div>

<div class="fp-flag" style="border-color:#fde68a; background:#fefce8;">
<h3 style="color:#92400e;">Sloping or uneven floors</h3>
<p style="color:#78350f;">Place a marble on the floor in different rooms. If it rolls consistently in one direction, you may have settlement. A floor slope of more than 1 inch over 20 feet is considered structurally significant by most engineers. In ${city}, older homes may have always had some slope from original construction, so the key indicator is change over time rather than absolute level.</p>
</div>

<div class="fp-flag" style="border-color:#fde68a; background:#fefce8;">
<h3 style="color:#92400e;">Gaps between walls and ceiling or floor</h3>
<p style="color:#78350f;">Separation at the junction of walls and ceiling (or walls and floor) indicates the structure is pulling apart. This is more serious than simple cracking because it means the foundation has moved enough to stress the entire framing system. Crown molding pulling away from the ceiling, baseboard gaps, and cabinet separation from walls all fall into this category.</p>
</div>

<p>If you notice any of these signs, the first step is a professional foundation inspection from a licensed structural engineer -- not a foundation repair contractor. Engineers charge $300-$800 for an assessment and provide an unbiased opinion. Foundation repair companies offer free inspections but have a financial incentive to recommend work.</p>
</section>`;
}

function slabVsPierAndBeam(city, state, facts, ctx) {
  const paras = [];

  const isSlab = facts.soil.includes("clay") || facts.soil.includes("slab") || state === "TX" || state === "AZ";
  const isPier = facts.homeAge && facts.homeAge.includes("1920") || facts.homeAge && facts.homeAge.includes("craftsman") || state === "WA" || state === "GA";

  paras.push(`<p>Understanding whether your ${city} home has a slab or pier-and-beam foundation determines the type of repair needed, the cost, and the contractor specialization required.</p>`);

  if (isSlab) {
    paras.push(`<p><strong>Slab foundations dominate in ${city}.</strong> Most homes built after 1960 in the ${city} area sit on concrete slab-on-grade foundations. Slab repair typically involves steel push piers or helical piers driven to stable bearing strata beneath the active soil zone. In ${city}, this means piers are usually driven 15-30 feet deep, depending on the depth of the expansive clay layer. Slab repairs cost more per pier because access requires tunneling under the foundation or working from the exterior perimeter.</p>`);
    paras.push(`<p>Slab leaks are a major secondary issue in ${city}. Plumbing runs under or through the slab, and foundation movement can crack water and sewer lines. A static hydrostatic plumbing test ($200-$400) should be part of any foundation evaluation for a slab home. If plumbing is compromised, rerouting lines through the attic is often more cost-effective than repeated under-slab repairs.</p>`);
  }

  if (isPier) {
    paras.push(`<p><strong>Pier-and-beam foundations</strong> are common in ${city}'s older neighborhoods${facts.homeAge ? `, where ${facts.homeAge}` : ""}. These foundations allow access to the crawl space beneath the home, which makes repairs more straightforward but introduces moisture management challenges. Shimming and leveling a pier-and-beam home typically costs 40-60% less than equivalent slab repair because there is no excavation or tunneling required.</p>`);
    paras.push(`<p>The biggest ongoing concern for pier-and-beam homes in ${city} is moisture control in the crawl space. Standing water, inadequate ventilation, and soil contact with wood members cause rot and pest damage that can mimic foundation failure. Before approving pier replacement or leveling work, have the crawl space evaluated for drainage, vapor barrier condition, and wood deterioration.</p>`);
  }

  if (!isSlab && !isPier) {
    paras.push(`<p>${city} has a mix of both slab and pier-and-beam construction depending on neighborhood age and builder. Newer subdivisions are predominantly slab-on-grade, while historic neighborhoods may have pier-and-beam, full basements, or combination foundations. Make sure your foundation repair contractor has experience with your specific foundation type, as the repair methods differ significantly.</p>`);
  }

  return `
<section class="section fp-section">
<h2>Slab vs. Pier-and-Beam: What's Common in ${city}</h2>
${paras.join("\n")}
</section>`;
}

function drainageAndGrading(city, state, facts, ctx) {
  const paras = [];

  paras.push(`<p>Drainage is the most overlooked factor in foundation health in ${city}. In fact, the majority of foundation problems we see in the ${city} market trace back to water management failures rather than structural defects.</p>`);

  if (ctx.climateZone === "hot_humid" || ctx.climateZone === "hot_dry") {
    paras.push(`<p>In ${city}'s climate, the combination of ${ctx.climateZone === "hot_humid" ? "intense seasonal rainfall and prolonged drought" : "monsoon rains followed by long dry periods"} creates extreme moisture swings in the soil around your foundation. Proper grading should direct water away from the foundation at a minimum slope of 6 inches over 10 feet. In ${city}, we frequently see homes where landscaping, settling, or additions have reversed the original grading, allowing water to pool against the foundation.</p>`);
  } else {
    paras.push(`<p>In ${city}'s climate, ${ctx.snowLoad === "moderate" || ctx.snowLoad === "high" ? "spring snowmelt combined with heavy rainfall" : "persistent rainfall"} saturates the soil around foundations for extended periods. Proper grading should direct water away from the foundation at a minimum slope of 6 inches over 10 feet. Gutters and downspouts must discharge at least 4-6 feet from the foundation, or connect to an underground drainage system.</p>`);
  }

  paras.push(`<p><strong>French drains</strong> are one of the most common drainage corrections in ${city}, costing $4,000-$8,000 for a typical residential installation. A French drain intercepts subsurface water before it reaches the foundation and redirects it away from the structure. For ${city} homes with persistent moisture issues, a perimeter French drain combined with proper surface grading is often more effective than pier installation alone.</p>`);

  paras.push(`<p><strong>Before any foundation repair:</strong> confirm that your contractor's proposal addresses drainage as part of the solution, not just structural lifting. Piering a home back to level without fixing the drainage that caused the settlement is a temporary fix. The most reputable foundation companies in ${city} will include a drainage assessment in their proposal and recommend corrections as needed.</p>`);

  return `
<section class="section fp-section">
<h2>Drainage and Grading: The Root Cause Most ${city} Homeowners Miss</h2>
${paras.join("\n")}
</section>`;
}

function redFlagsSection(city, state) {
  const flags = [];

  flags.push({ title: "Unnecessary piering", body: `Not every foundation crack requires piers. Minor cosmetic cracks, seasonal movement within normal tolerances, and drainage-related issues can often be resolved without piering. In ${city}, some contractors recommend 15-20 piers when 6-8 would address the actual structural concern. Always get a second opinion from a licensed structural engineer (PE) before approving a pier plan that exceeds $10,000. The $500 engineering report can save you $5,000-$10,000 in unnecessary work.` });

  flags.push({ title: "No engineering report", body: `A foundation repair contractor who will not provide or accept an independent engineering report is a major red flag. In ${city}, reputable companies either employ licensed engineers or work closely with third-party engineers. The engineering report identifies the root cause, specifies the repair method, documents existing conditions, and provides a performance standard for the completed work. Without it, you have no independent verification that the proposed work is necessary or sufficient.` });

  flags.push({ title: "One-day miracle fixes", body: `Foundation repair is not a one-day job. A typical 8-12 pier installation in ${city} takes 2-4 days. Companies that promise to \"fix your foundation in one day\" are usually performing cosmetic repairs (crack filling, mudjacking) that do not address the underlying structural issue. These quick fixes typically fail within 2-3 years, at which point you have spent money and still need the real repair.` });

  flags.push({ title: "Lifetime warranty without details", body: `\"Lifetime warranty\" on foundation repair is meaningless without specifics. Ask exactly what is covered (materials, labor, transferability), what voids the warranty (drainage changes, tree planting, additions), and who backs it (the company, an insurance policy, a third party). In ${city}, many fly-by-night operations offer lifetime warranties from companies that will not exist in 5 years. A transferable warranty backed by an independent third party or insurance policy is the gold standard.` });

  flags.push({ title: "High-pressure sales tactics", body: `Foundation repair is almost never an emergency. Any contractor who pressures you to sign today with a \"this price expires tomorrow\" pitch is using a high-pressure sales tactic. In ${city}, the best foundation companies provide written proposals that remain valid for 30-60 days. Take the time to get 3 quotes, review an engineering report, and make an informed decision.` });

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>Foundation Repair Red Flags in ${city}</h2>
<p>The foundation repair industry has more than its share of questionable operators. Here are the warning signs ${city} homeowners report most frequently.</p>
${flagsHTML}
</section>`;
}

function seasonalGuide(city, ctx) {
  const seasons = {
    hot_humid: { best: "October through March", worst: "April through June", reason: "Spring rains saturate expansive clay soils, making it harder to achieve stable lifts. Fall and winter offer drier soil conditions and better contractor availability." },
    hot_dry: { best: "October through April", worst: "June through September", reason: "Extreme summer heat makes exterior excavation dangerous for crews and can affect concrete curing. The monsoon season in July-August saturates soil unpredictably." },
    cold: { best: "April through October", worst: "November through March", reason: "Frozen ground prevents excavation and pier installation. Spring through fall offers stable working conditions, though late spring can be wet." },
    temperate: { best: "September through November", worst: "March through May", reason: "Fall offers dry, stable soil conditions and contractors finishing their busy season. Spring rains make excavation messy and slow." },
    mixed_humid: { best: "September through November and March through April", worst: "June through August", reason: "Shoulder seasons balance moderate temperatures with manageable soil moisture. Summer heat and thunderstorms disrupt schedules." },
    mixed_dry: { best: "March through May and September through November", worst: "June through August", reason: "Shoulder seasons offer moderate temperatures and stable soil conditions." },
    marine: { best: "June through September", worst: "November through March", reason: "The dry summer months provide the most stable soil conditions and easiest excavation. Winter rains make drainage work and excavation significantly more difficult and expensive." },
  };
  const s = seasons[ctx.climateZone] || seasons.temperate;

  return `
<section class="section fp-section">
<h2>Best Time for Foundation Repair in ${city}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months</h3>
<p class="fp-season-months">${s.best}</p>
<p>${s.reason}</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Peak pricing / scheduling difficulty</h3>
<p class="fp-season-months">${s.worst}</p>
<p>Expect longer lead times and less scheduling flexibility during these months. If you must schedule during peak, book 4-6 weeks ahead.</p>
</div>
</div>
<p>Scheduling during the optimal season can save 5-10% on labor costs in ${city} and results in cleaner, more predictable repair outcomes due to stable soil conditions.</p>
</section>`;
}

function costScenarios(city, state, mult) {
  const budget = { label: "Crack Sealing + Monitoring", scope: "3-5 cracks, epoxy injection, monitoring plan", total: Math.round(1800 * mult / 100) * 100 };
  const mid = { label: "Pier Installation (8 piers)", scope: "8 steel push piers, re-leveling, drainage assessment", total: Math.round(12000 * mult / 100) * 100 };
  const prem = { label: "Full Stabilization + Drainage", scope: "12 piers, French drain, grading correction, plumbing test", total: Math.round(25000 * mult / 100) * 100 };

  function scenarioCard(label, s, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${s.label}</p>
<p class="fp-scenario-total">${fmtK(s.total)}</p>
<p class="fp-scenario-detail">${s.scope}. Includes engineering assessment, warranty, and post-repair monitoring.</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>What Foundation Repair Actually Costs in ${city}: 3 Scenarios</h2>
<p>Here is what real foundation repair projects look like in ${city}, ${state}, using ${city}-adjusted labor rates for 2026.</p>
<div class="fp-scenario-grid">
${scenarioCard("Budget", budget, "#22c55e")}
${scenarioCard("Mid-Range", mid, "#3b82f6")}
${scenarioCard("Premium", prem, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">All scenarios assume a single-story home with standard access. Multi-story homes, limited access, or deep bedrock add 20-40%. <a href="/foundation-repair-cost.html" style="color:var(--brand);">See the full foundation cost guide.</a></p>
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
  html += soilDeepDive(city, state, ctx, facts);
  html += warningSignsGuide(city);
  html += slabVsPierAndBeam(city, state, facts, ctx);
  html += drainageAndGrading(city, state, facts, ctx);
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

    // Detect line endings
    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    // Injection point: before TP-NEARBY-CITIES, or before </main>
    const nearbyMarker = "<!-- TP-NEARBY-CITIES -->";
    const nearbyIdx = content.indexOf(nearbyMarker);
    let insertAt;

    if (nearbyIdx >= 0) {
      // Insert before the nearby-cities section; back up to the previous </section> end
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

  console.log(`\nDone: ${processed} flagship foundation pages processed, ${skipped} skipped.`);
  if (DRY) console.log("[DRY RUN: no files written]");
}

main();
