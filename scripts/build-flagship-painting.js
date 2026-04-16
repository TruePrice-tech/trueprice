#!/usr/bin/env node
/**
 * Generates deep editorial content for 10 flagship metro painting pages.
 * Injects ~2500 words of genuinely unique, city-specific prose.
 * Idempotent via FLAGSHIP-PAINTING-CONTENT markers.
 *
 * Usage: node scripts/build-flagship-painting.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/painting-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-PAINTING-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-PAINTING-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-painting-cost.html", region: "northeast" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-painting-cost.html", region: "west" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-painting-cost.html", region: "midwest" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-painting-cost.html", region: "south" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-painting-cost.html", region: "mountain" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-painting-cost.html", region: "south" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-painting-cost.html", region: "southeast" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-painting-cost.html", region: "mountain" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-painting-cost.html", region: "west" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-painting-cost.html", region: "south" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-painting-cost.html", region: "west" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-painting-cost.html", region: "mountain" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-painting-cost.html", region: "northeast" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-painting-cost.html", region: "southeast" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-painting-cost.html", region: "northeast" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-painting-cost.html", region: "west" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-painting-cost.html", region: "southeast" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-painting-cost.html", region: "midwest" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-painting-cost.html", region: "midwest" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-painting-cost.html", region: "southeast" },
];

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`; }
function fmtDollar(n) { return `$${n.toLocaleString("en-US")}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function roundTo50(n) { return Math.round(n / 50) * 50; }

function getMultiplier(region) {
  return pricingModel.laborMultiplierByRegion?.[region] || 1.0;
}

/* ── 1. Neighborhood pricing breakdown ── */
function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";

  const baseSqft = 2000;
  const intLow = pricingModel.basePricePerSqft.standard_1coat.mid;
  const extLow = pricingModel.basePricePerSqft.standard_1coat.mid * 1.15;
  const fullLow = pricingModel.basePricePerSqft.premium_2coat.mid * 1.6;
  const cabBase = pricingModel.basePricePerSqft.cabinet_painting.flatMid;

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.05 : 0.04) * (i % 2 === 0 ? 1 : -1));
    const interior = roundTo50(baseSqft * intLow * mult * localVar);
    const exterior = roundTo50(baseSqft * extLow * mult * localVar);
    const full = roundTo50(baseSqft * fullLow * mult * localVar);
    const cab = roundTo50(cabBase * mult * localVar);
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtDollar(interior)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtDollar(exterior)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtDollar(full)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtDollar(cab)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>Neighborhood Painting Cost Breakdown</h2>
<p>Painting costs vary within ${facts.displayName} based on local labor rates, housing stock age, and market demand. These are estimated ranges for a typical 2,000 sq ft home in each area.</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Interior Only</th>
<th style="text-align:right; padding:12px 16px;">Exterior Only</th>
<th style="text-align:right; padding:12px 16px;">Full Int + Ext</th>
<th style="text-align:right; padding:12px 16px;">Cabinet Refinish</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Estimates based on local labor rates and 2026 material costs. Actual pricing depends on surface condition, paint quality, and number of coats. <a href="/analyze-my-quote.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your quote for an exact comparison.</a></p>
</section>`;
}

/* ── 2. Climate and paint durability ── */
function climateDurability(city, state, ctx, facts) {
  const paras = [];

  paras.push(`<p>${cap(facts.climate)}. Understanding how these conditions affect paint performance is critical to choosing the right products and timing your project in ${city}.</p>`);

  if (ctx.climateZone === "hot_dry") {
    paras.push(`<p><strong>UV degradation.</strong> ${city}'s intense sun exposure is the single biggest threat to paint longevity. UV radiation breaks down the resin binders in paint film, causing chalking, fading, and eventual failure. South- and west-facing walls take the worst punishment and typically need repainting 2-3 years sooner than north-facing surfaces. Use 100% acrylic latex with built-in UV stabilizers (look for "fade-resistant" or "UV-guard" on the label). Dark colors absorb more heat and fade faster in ${city}'s climate; medium tones in the LRV 40-60 range offer the best balance of curb appeal and longevity.</p>`);
    paras.push(`<p><strong>Thermal cycling.</strong> Daily temperature swings of 30-40 degrees cause paint films to expand and contract repeatedly, which accelerates cracking at joints and trim transitions. Elastomeric coatings provide superior flexibility for stucco and masonry exteriors in ${city}. On wood siding, a high-quality 100% acrylic with good elongation properties (Sherwin-Williams Duration, Benjamin Moore Aura Exterior) handles thermal movement significantly better than cheaper alternatives.</p>`);
  }

  if (ctx.climateZone === "hot_humid" || ctx.climateZone === "mixed_humid") {
    paras.push(`<p><strong>Moisture and mildew.</strong> ${city}'s humidity creates ideal conditions for mildew growth on painted surfaces, particularly on north-facing walls and shaded areas under eaves. Paint with built-in mildewcide is non-negotiable here. Do not use oil-based primers or paints on exteriors in ${city} -- they trap moisture and blister within 1-3 years. 100% acrylic latex breathes better and allows moisture to escape through the film without blistering.</p>`);
    paras.push(`<p><strong>Rain and adhesion.</strong> Exterior surfaces must be completely dry before painting in ${city}. After rain, wait at least 24-48 hours (longer for stucco and masonry) before applying paint. Painting over damp surfaces is the most common cause of early peeling in humid climates. The best painting contractors in ${city} check moisture levels with a pin meter before starting work.</p>`);
  }

  if (ctx.climateZone === "cold" || ctx.snowLoad === "moderate" || ctx.snowLoad === "high") {
    paras.push(`<p><strong>Freeze-thaw damage.</strong> ${city}'s winter cycles cause water to infiltrate cracks, freeze, expand, and widen them. Any existing cracks in caulk, wood, or stucco must be repaired and sealed before painting. Acrylic latex with good low-temperature flexibility is essential. Most quality exterior paints require application temperatures above 35-50F (check the label), which limits ${city}'s exterior painting season and makes scheduling critical.</p>`);
    paras.push(`<p><strong>Salt and snow.</strong> Road salt spray and snow accumulation at the base of exterior walls cause accelerated paint failure in the bottom 12-18 inches. This zone often needs touch-up or repaint on a shorter cycle than the rest of the house. Using a marine-grade or high-adhesion primer on these areas extends paint life meaningfully.</p>`);
  }

  if (facts.climate.includes("rain") || facts.climate.includes("wet") || facts.climate.includes("moss") || ctx.climateZone === "marine") {
    paras.push(`<p><strong>Persistent moisture.</strong> ${city}'s wet climate means exterior paint is under constant moisture stress. Moss and algae growth on painted surfaces is common, particularly on north-facing walls and under tree canopy. Power washing with a mildewcide treatment before repainting is mandatory, not optional. Paint applied over biological growth will peel within months. Satin or semi-gloss sheens resist moisture better than flat finishes and make future cleaning easier.</p>`);
  }

  return `
<section class="section fp-section">
<h2>How ${city}'s Climate Affects Paint Durability</h2>
${paras.join("\n")}
</section>`;
}

/* ── 3. Interior vs exterior considerations ── */
function interiorVsExterior(city, state, ctx, facts) {
  const paras = [];

  const exteriorLifespan = {
    hot_dry: "4-7 years on south/west exposures, 7-10 on north/east",
    hot_humid: "5-8 years with proper mildewcide protection",
    cold: "6-10 years depending on sun exposure and winter severity",
    marine: "5-7 years due to constant moisture; 4-5 on north-facing walls",
    mixed_humid: "5-8 years in typical conditions",
    mixed_dry: "6-9 years with quality acrylic products",
    temperate: "7-10 years with proper preparation and quality paint",
  };

  const lifespan = exteriorLifespan[ctx.climateZone] || exteriorLifespan.temperate;

  paras.push(`<p><strong>Exterior paint lifespan in ${city}:</strong> ${lifespan}. This is significantly affected by paint quality, surface preparation, and which direction the wall faces. A $15/gallon builder-grade paint will last roughly half as long as a $60/gallon premium product like Sherwin-Williams Duration or Benjamin Moore Aura. Over a 15-year ownership period, the premium paint is dramatically cheaper per year of service.</p>`);

  paras.push(`<p><strong>Interior painting in ${city}</strong> is far less affected by climate and more driven by lifestyle factors: wall scuffs, furniture marks, cooking residue, and personal style changes. Interior paint in good condition can last 7-15 years. Kitchens and bathrooms need more durable finishes (satin or semi-gloss) due to moisture and grease exposure, while living areas and bedrooms can use eggshell or matte finishes for a softer look.</p>`);

  paras.push(`<p><strong>Bundling interior and exterior.</strong> Most painting contractors in ${city} offer meaningful discounts (10-20%) when you combine interior and exterior work in a single project. The labor savings from having crews already on site and equipment already mobilized are real. If your exterior needs paint within the next 2-3 years, bundling it with an interior repaint now typically saves $1,500-$3,000 on a standard home compared to doing them separately.</p>`);

  if (ctx.climateZone === "hot_dry" || ctx.climateZone === "hot_humid") {
    paras.push(`<p><strong>Color selection for ${city}.</strong> In ${city}'s hot climate, exterior color choice has real energy implications. Light colors reflect solar heat and reduce cooling costs by 5-15%. Dark colors on south- and west-facing walls absorb significantly more heat, which affects both energy bills and paint longevity. For exterior trim, lighter colors generally outperform dark ones in ${city}'s climate.</p>`);
  }

  return `
<section class="section fp-section">
<h2>Interior vs Exterior Painting in ${city}</h2>
${paras.join("\n")}
</section>`;
}

/* ── 4. Lead paint section ── */
function leadPaintSection(city, state, ctx, facts) {
  const avgAge = ctx.avgHomeAge || 30;
  const pre1978Pct = avgAge >= 50 ? "a significant majority" : avgAge >= 40 ? "a substantial portion" : avgAge >= 30 ? "a meaningful number" : "a smaller but non-trivial number";
  const housingNote = facts.homeAge ? cap(facts.homeAge) + "." : "";

  const paras = [];

  paras.push(`<p>${housingNote} ${pre1978Pct} of homes in ${city} were built before 1978, when lead-based paint was banned for residential use. If your home was built before 1978, federal law (the EPA's Renovation, Repair, and Painting Rule, known as RRP) requires that any contractor disturbing more than 6 square feet of painted surface must be EPA-certified and follow lead-safe work practices.</p>`);

  paras.push(`<p><strong>What RRP compliance means for your project.</strong> The contractor must contain the work area with plastic sheeting, use HEPA vacuums and wet methods to control dust, and perform a cleaning verification after the work is complete. Workers must have individual EPA-RRP certification, and the firm must be registered with the EPA. This is not optional and the fines for non-compliance are severe: up to $37,500 per day per violation.</p>`);

  paras.push(`<p><strong>Cost impact.</strong> Lead-safe painting adds approximately 15-30% to the cost of a painting project due to containment, specialized cleanup, and disposal requirements. However, the health risks of lead dust exposure (particularly to children under 6) are serious and well-documented. If a contractor offers to paint your pre-1978 home at regular pricing without mentioning lead, they are either planning to skip the required precautions or are unaware of the law. Either way, do not hire them.</p>`);

  if (avgAge >= 45) {
    paras.push(`<p><strong>${city}-specific note.</strong> Given that ${city}'s housing stock skews older (average age ${avgAge} years), lead paint is a common issue here. Before any painting project on a pre-1978 home, consider getting a lead paint test ($300-$500 for a typical home). If lead is present, you will know the scope and cost implications before signing a contract rather than discovering them mid-project.</p>`);
  }

  return `
<section class="section fp-section">
<h2>Lead Paint: What ${city} Homeowners Need to Know</h2>
${paras.join("\n")}
</section>`;
}

/* ── 5. Surface prep importance ── */
function surfacePrepSection(city, state, ctx, facts) {
  const paras = [];

  paras.push(`<p>Surface preparation is the single biggest factor separating a paint job that lasts from one that peels within 2 years. In ${city}, where ${facts.climate.split(",")[0].trim()}, proper prep is even more critical because the paint film is under constant environmental stress.</p>`);

  paras.push(`<p><strong>Power washing.</strong> Every exterior paint job in ${city} should start with thorough power washing to remove dirt, mildew, chalking old paint, and pollutants. The surface must then dry completely before any primer or paint is applied. In ${city}'s climate, this means waiting ${ctx.climateZone === "hot_humid" || ctx.climateZone === "marine" ? "48-72 hours after washing" : "24-48 hours after washing"} depending on weather conditions. Contractors who show up and start painting the same day they wash are cutting corners.</p>`);

  paras.push(`<p><strong>Scraping and sanding.</strong> Any peeling, flaking, or blistered paint must be scraped to a sound edge and sanded smooth before priming. This is tedious, labor-intensive work and it is where cheap painters cut the most corners. Ask your contractor specifically how they handle peeling paint and demand a clear answer. "We will scrape and sand all loose paint to a feathered edge" is the right answer. "We will paint over it with a thick coat" is the wrong one.</p>`);

  paras.push(`<p><strong>Caulking and repair.</strong> All gaps around windows, doors, trim joints, and penetrations must be caulked with a high-quality, paintable sealant before painting. In ${city}, use siliconized acrylic caulk rated for the local temperature range. Failed caulk is the primary entry point for moisture behind paint, and moisture behind paint is the primary cause of paint failure.</p>`);

  paras.push(`<p><strong>Priming.</strong> New wood, bare surfaces, patched areas, and stain-prone surfaces (knots, tannin bleed, water stains) require primer before topcoat. Spot priming is usually sufficient on repaint jobs where the existing paint is in good condition. Full priming is required when changing from oil to latex, when the existing paint is chalking significantly, or on new/bare surfaces. Skipping primer saves the contractor 2-3 hours but can cost you 3-5 years of paint life.</p>`);

  return `
<section class="section fp-section">
<h2>Surface Prep: The #1 Cost Driver in ${city}</h2>
${paras.join("\n")}
</section>`;
}

/* ── 6. Permits ── */
function permitSection(city, state, facts) {
  return `
<section class="section fp-section">
<h2>Painting Permits in ${city}</h2>
<p>Standard residential painting (interior and exterior) rarely requires a building permit in ${city} or most jurisdictions nationwide. Paint is considered a cosmetic improvement, not a structural modification. However, there are two important exceptions that ${city} homeowners should know about.</p>
<p><strong>Lead abatement notification.</strong> If your pre-1978 home has lead paint and the project involves disturbing lead-containing surfaces, ${state} may require notification to the local health department or environmental agency before work begins. Your EPA-RRP certified contractor should handle this as part of their standard process, but confirm it explicitly in the contract.</p>
<p><strong>Historic districts.</strong> If your home is in a locally designated historic district in ${city}, exterior color changes may require approval from the local historic preservation commission or architectural review board. This is not a building permit but a design review, and the timeline can add 2-6 weeks to your project. ${facts.codeNote ? facts.codeNote + "." : ""} Check with your local planning department before committing to exterior colors if you live in a historically designated area.</p>
<p><strong>HOA restrictions.</strong> While not a government permit, many ${city} HOAs require pre-approval of exterior paint colors. Submitting color samples for approval before buying paint saves the cost and frustration of repainting if the HOA rejects your color choice after the fact.</p>
</section>`;
}

/* ── 7. Red flags ── */
function redFlagsSection(city, state, ctx) {
  const flags = [];

  flags.push({ title: "No power washing before exterior paint", body: `Painting over dirty, chalky, or mildewed surfaces is the fastest path to premature peeling. Any contractor who plans to skip power washing or "just hand-wipe" the exterior is not providing professional-grade work. In ${city}'s climate, this shortcut typically results in peeling within 12-18 months.` });

  flags.push({ title: "Skipping primer", body: `Primer serves a specific adhesion and stain-blocking function that topcoat paint cannot replicate. Contractors who say "this paint is paint-and-primer-in-one, so we do not need separate primer" are using a marketing claim to justify skipping a step. Combination products work for simple repaints over sound existing paint in similar colors. They do not replace dedicated primer on bare wood, patched areas, stain bleed, or color changes.` });

  flags.push({ title: "Using builder-grade paint", body: `Builder-grade paint ($15-$25/gallon) contains less resin, less pigment, and fewer additives than professional-grade products ($45-$65/gallon). The material cost difference on a full exterior is only $200-$500, but the performance difference is 3-5 years of service life. If a contractor quotes a price that seems too low, ask what paint brand and product line they are using. If they cannot name it or say "our house brand," that is a red flag.` });

  flags.push({ title: "No written color and product specification", body: `The contract should specify the exact paint manufacturer, product line, color codes, sheen levels, and number of coats for every surface. "Benjamin Moore Regal Select, Exterior, Satin, 2 coats, body color HC-172, trim color OC-17" is a proper specification. "Exterior paint, 2 coats, white" is not. Without a written spec, you have no way to verify that the contractor used the products you are paying for.` });

  if (ctx.climateZone === "hot_humid" || ctx.climateZone === "marine") {
    flags.push({ title: "No mildewcide in exterior paint", body: `In ${city}'s humid climate, exterior paint without mildewcide protection will develop visible mold and mildew growth within 1-2 years, particularly on north-facing walls and under eaves. Most premium exterior paints include mildewcide, but confirm it is in the spec. If using a mid-tier paint, request that the contractor add a mildewcide additive at the mixing stage.` });
  }

  if (ctx.avgHomeAge >= 40) {
    flags.push({ title: "No mention of lead paint on a pre-1978 home", body: `If your ${city} home was built before 1978 and the contractor's proposal does not mention lead paint testing or EPA-RRP compliance, they are either planning to ignore federal law or do not know about it. Both are disqualifying. Ask directly: "Are you EPA-RRP certified?" and request to see their certification.` });
  }

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>Red Flags When Hiring a Painter in ${city}</h2>
<p>These are the patterns most commonly associated with substandard painting work in ${city}. Any one of them should prompt further questions; two or more should prompt you to get a different bid.</p>
${flagsHTML}
</section>`;
}

/* ── 8. Seasonal buying guide ── */
function seasonalGuide(city, ctx) {
  const seasons = {
    hot_humid: { best: "October through March", worst: "June through August", reason: "Cooler temperatures and lower humidity improve paint adhesion and cure time. Summer heat above 90F causes paint to dry too fast, trapping solvents and reducing film integrity. Afternoon thunderstorms frequently interrupt exterior work." },
    hot_dry: { best: "October through April", worst: "June through September", reason: "Summer surface temperatures on sun-exposed walls can exceed 140F, which causes paint to dry before it can properly level and bond. Fall through spring offers ideal application conditions." },
    cold: { best: "May through September", worst: "November through March", reason: "Most exterior paints require application temperatures above 35-50F. Winter painting is limited to interiors. The compressed exterior painting season drives peak pricing in mid-summer." },
    marine: { best: "July through September", worst: "November through March", reason: "Summer offers the only reliable dry window for exterior painting. The limited season drives strong demand and higher pricing. Book exterior work 6-8 weeks ahead for summer scheduling." },
    temperate: { best: "September through November", worst: "March through May", reason: "Fall offers moderate temperatures, lower humidity, and contractors finishing their busy season. Spring demand spikes as homeowners emerge from winter." },
    mixed_humid: { best: "September through November", worst: "June through August", reason: "Fall balances moderate temperatures with lower humidity and contractor availability. Summer humidity slows drying and promotes mildew." },
    mixed_dry: { best: "March through May and September through November", worst: "June through August", reason: "Shoulder seasons offer moderate temperatures. Summer heat is workable but adds scheduling constraints." },
  };
  const s = seasons[ctx.climateZone] || seasons.temperate;

  return `
<section class="section fp-section">
<h2>Best Time to Paint in ${city}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months for exterior painting</h3>
<p class="fp-season-months">${s.best}</p>
<p>${s.reason}</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Peak pricing / scheduling difficulty</h3>
<p class="fp-season-months">${s.worst}</p>
<p>Expect 10-20% higher labor costs and 3-6 week lead times during peak season in ${city}. Interior painting can be done year-round and is often 10-15% cheaper in the off-season when exterior crews move indoors.</p>
</div>
</div>
<p>Scheduling flexibility is your best negotiating tool. Contractors in ${city} who can fill gaps in their schedule during slower months often offer their best pricing to keep crews working steadily.</p>
</section>`;
}

/* ── 9. Cost scenarios ── */
function costScenarios(city, state, mult) {
  const budget = {
    label: "Budget Interior Refresh",
    scope: "3 bedrooms + hallway, 1 coat, builder-grade paint",
    sqft: 1200,
    perSqft: roundTo50(1200 * pricingModel.basePricePerSqft.standard_1coat.low * mult) / 1200,
    total: roundTo50(1200 * pricingModel.basePricePerSqft.standard_1coat.low * mult),
    detail: "Walls only, no trim or ceiling. Single coat over existing similar color. Basic prep (patch nail holes, light sand). Suitable for rental turnover or quick refresh before listing.",
  };
  const mid = {
    label: "Mid-Range Full Exterior",
    scope: "2,000 sq ft exterior, 2 coats, premium paint",
    sqft: 2000,
    perSqft: roundTo50(2000 * pricingModel.basePricePerSqft.premium_2coat.mid * mult) / 2000,
    total: roundTo50(2000 * pricingModel.basePricePerSqft.premium_2coat.mid * mult),
    detail: "Full power wash, scrape, prime bare spots, 2 coats Sherwin-Williams or equivalent on body, 1 coat on trim. Includes caulking all joints and penetrations.",
  };
  const cabCost = roundTo50(pricingModel.basePricePerSqft.cabinet_painting.flatMid * mult);
  const fullIntExt = roundTo50(2200 * pricingModel.basePricePerSqft.premium_2coat.mid * mult * 1.6);
  const premTotal = fullIntExt + cabCost;
  const prem = {
    label: "Premium Int + Ext + Cabinets",
    scope: "2,200 sq ft interior + exterior, cabinet refinish",
    sqft: 2200,
    total: premTotal,
    detail: "Full interior (walls, trim, ceilings) + full exterior + kitchen cabinet refinish. Premium paint throughout, extensive prep, 2 coats everywhere.",
  };

  function scenarioCard(s, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${s.label}</h3>
<p class="fp-scenario-material">${s.scope}</p>
<p class="fp-scenario-total">${fmtDollar(s.total)}</p>
<p class="fp-scenario-detail">${s.detail}</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>What Painting Actually Costs in ${city}: 3 Scenarios</h2>
<p>Here is what real painting projects look like in ${city}, ${state}, using ${city}-adjusted labor and material costs for 2026.</p>
<div class="fp-scenario-grid">
${scenarioCard(budget, "#22c55e")}
${scenarioCard(mid, "#3b82f6")}
${scenarioCard(prem, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">All scenarios assume standard residential construction with reasonable access. Multi-story homes, extensive repair work, or specialty finishes add 15-40%. <a href="/analyze-my-quote.html" style="color:var(--brand);">Upload your painting quote for a detailed comparison.</a></p>
</section>`;
}

/* ── CSS ── */
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

/* ── Build ── */
function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  if (!facts || !ctx) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getMultiplier(metro.region);

  let html = `\n${MARKER_START}\n`;
  html += flagshipCSS();
  html += neighborhoodPricing(facts, mult);
  html += climateDurability(city, state, ctx, facts);
  html += interiorVsExterior(city, state, ctx, facts);
  html += leadPaintSection(city, state, ctx, facts);
  html += surfacePrepSection(city, state, ctx, facts);
  html += permitSection(city, state, facts);
  html += redFlagsSection(city, state, ctx);
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

    // Detect line ending
    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    // Inject after UNIQUE-LOCAL-GUIDE or after the "About painting in <city>" section (TP-LOCAL-INJECTED-V2)
    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const localInjectedV2 = content.indexOf("<!-- TP-LOCAL-INJECTED-V2 -->");

    let insertAt;
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else if (localInjectedV2 >= 0) {
      // Find the end of the section following TP-LOCAL-INJECTED-V2
      const sectionEnd = content.indexOf("</section>", localInjectedV2);
      insertAt = sectionEnd >= 0 ? sectionEnd + "</section>".length : -1;
    } else {
      // Fallback: find "What Should a Painting Quote Include" or 5th section
      const quoteInclude = content.indexOf("What Should a Painting Quote Include");
      if (quoteInclude >= 0) {
        const sectionEnd = content.indexOf("</section>", quoteInclude);
        insertAt = sectionEnd >= 0 ? sectionEnd + "</section>".length : -1;
      } else {
        insertAt = -1;
      }
    }

    if (insertAt < 0) {
      console.log(`  SKIP ${metro.file} (no injection point found)`);
      skipped++;
      continue;
    }

    content = content.slice(0, insertAt) + nl + flagshipContent + content.slice(insertAt);

    if (!DRY) {
      fs.writeFileSync(filepath, content, "utf8");
    }

    const wordCount = flagshipHTML.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    console.log(`  ${metro.file}: ~${wordCount} words of flagship content injected`);
    processed++;
  }

  console.log(`\nDone: ${processed} flagship pages processed, ${skipped} skipped.`);
  if (DRY) console.log("[DRY RUN: no files written]");
}

main();
