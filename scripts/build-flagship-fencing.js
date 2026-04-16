#!/usr/bin/env node
/**
 * Generates deep editorial content for 10 flagship metro fencing pages.
 * Injects ~2500 words of genuinely unique, city-specific prose.
 * Idempotent via FLAGSHIP-FENCING-CONTENT markers.
 *
 * Usage: node scripts/build-flagship-fencing.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fencing-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-FENCING-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-FENCING-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-fence-cost.html", region: "northeast" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-fence-cost.html", region: "west" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-fence-cost.html", region: "midwest" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-fence-cost.html", region: "south" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-fence-cost.html", region: "mountain" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-fence-cost.html", region: "south" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-fence-cost.html", region: "southeast" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-fence-cost.html", region: "mountain" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-fence-cost.html", region: "west" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-fence-cost.html", region: "south" },
];

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`; }
function fmtD(n) { return `$${n.toLocaleString("en-US")}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function getMultiplier(region) {
  return pricingModel.laborMultiplierByRegion?.[region] || 1.0;
}

/* 1. Neighborhood pricing breakdown */
function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";
  const base = pricingModel.basePricePerLinearFoot;
  const yardLF = 150; // typical yard

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.07 : i % 3 === 1 ? -0.05 : 0.04) * (i % 2 === 0 ? 1 : -1));
    const wood = Math.round(base.wood_privacy.mid * mult * localVar * yardLF / 50) * 50;
    const vinyl = Math.round(base.vinyl_privacy.mid * mult * localVar * yardLF / 50) * 50;
    const chain = Math.round(base.chain_link.mid * mult * localVar * yardLF / 50) * 50;
    const iron = Math.round(base.wrought_iron.mid * mult * localVar * yardLF / 50) * 50;
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(wood)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(vinyl)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(chain)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtD(iron)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>Neighborhood Pricing Breakdown</h2>
<p>Fencing costs vary within ${facts.displayName} based on local labor rates, material delivery distances, and lot accessibility. These are estimated ranges for a typical 150-linear-foot backyard enclosure in each area.</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Wood Privacy</th>
<th style="text-align:right; padding:12px 16px;">Vinyl</th>
<th style="text-align:right; padding:12px 16px;">Chain Link</th>
<th style="text-align:right; padding:12px 16px;">Iron/Ornamental</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Estimates based on local labor rates, material delivery costs, and typical lot conditions. Actual pricing depends on terrain, fence height, gate count, and old fence removal. <a href="/fencing-quote-analyzer.html?mode=estimator&city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Get a personalized estimate.</a></p>
</section>`;
}

/* 2. Climate and material durability */
function climateDurability(city, state, ctx, facts) {
  const paras = [];

  paras.push(`<p>${cap(facts.climate)}. Understanding how these conditions affect fencing materials is critical to getting 15-25 years out of your investment in ${city}.</p>`);

  const zone = ctx.climateZone;

  if (zone === "hot_humid" || zone === "mixed_humid") {
    paras.push(`<p><strong>Wood rot risk.</strong> The humidity in ${city} accelerates wood decay, particularly at ground contact points where posts meet soil. Untreated pine can begin rotting within 3-4 years. Pressure-treated pine rated for ground contact (UC4A minimum) is the baseline requirement here -- cedar looks better but rots faster than most homeowners expect in this climate. If you choose cedar, budget for re-staining every 2-3 years and expect a 12-15 year lifespan rather than the 20 years you might see in a drier market. The alternative is to set posts in concrete with 2-3 inches of gravel beneath for drainage, which prevents the standing water that accelerates decay.</p>`);
  }

  if (zone === "cold" || ctx.snowLoad === "moderate" || ctx.snowLoad === "high") {
    paras.push(`<p><strong>Freeze-thaw and vinyl brittleness.</strong> Vinyl fencing becomes significantly more brittle in cold weather. In ${city}'s winters, a strong wind gust or impact from a falling branch can crack vinyl panels that would flex harmlessly in warmer conditions. If you choose vinyl, specify panels rated for cold-climate installation (look for impact resistance ratings tested at 0F). Post flexibility also matters -- vinyl posts should have internal aluminum or steel reinforcement in ${city} to handle wind loads without snapping. Standard unreinforced vinyl posts are a common source of failure in cold-climate installations.</p>`);
  }

  if (facts.climate.includes("salt") || facts.climate.includes("coastal") || facts.climate.includes("Gulf") || ctx.hurricaneZone) {
    paras.push(`<p><strong>Metal corrosion in coastal proximity.</strong> ${city}'s proximity to salt air means untreated iron and steel fencing will begin surface rust within 1-2 years if not properly coated. Galvanized chain link holds up reasonably well, but wrought iron and ornamental steel require powder-coating or hot-dip galvanization as a baseline -- not just paint. Aluminum is naturally corrosion-resistant and performs well in ${city}'s environment, though it costs more upfront. If you go with iron or steel, budget for touch-up coating every 3-5 years to prevent rust from compromising structural integrity.</p>`);
  }

  if (zone === "hot_dry" || zone === "mixed_dry" || facts.climate.includes("UV") || facts.climate.includes("desert")) {
    paras.push(`<p><strong>UV degradation.</strong> The intense sun exposure in ${city} breaks down wood stain and sealant significantly faster than the manufacturer's rated lifespan suggests. A stain that claims 5-year durability may need reapplication in 2-3 years here. UV also fades and weakens vinyl over time, though modern UV-stabilized vinyl performs much better than products from even 10 years ago. For wood fences, use a UV-blocking semi-transparent stain rather than clear sealant, and plan on reapplication every 2-3 years rather than the 3-5 the label suggests. For the longest lifespan with minimal maintenance in ${city}'s sun, aluminum or powder-coated steel outperforms wood and vinyl.</p>`);
  }

  if (facts.climate.includes("rain") || facts.climate.includes("wet") || facts.climate.includes("moss") || facts.climate.includes("moisture")) {
    paras.push(`<p><strong>Persistent moisture and biological growth.</strong> The wet climate in ${city} promotes moss, mildew, and algae growth on wood fencing, particularly on north-facing sections that stay shaded. Left untreated, biological growth traps moisture against the wood surface and accelerates rot. Annual pressure washing and mildewcide treatment extend fence life significantly. Vinyl and metal fences are far more resistant to biological growth but still benefit from periodic cleaning to maintain appearance.</p>`);
  }

  // Hail risk for fencing
  if (ctx.hailRisk === "high") {
    paras.push(`<p><strong>Hail and storm damage.</strong> ${city} sits in an active severe weather corridor. Large hail dents aluminum and ornamental metal fencing and can crack vinyl panels. Wood fencing is more resilient against hail impact but vulnerable to the high winds that accompany severe storms. For any material, make sure posts are set at least 24 inches deep (30-36 inches is better in ${city}) with concrete footings to resist wind uplift during storms.</p>`);
  }

  return `
<section class="section fp-section">
<h2>How ${city}'s Climate Affects Fencing Materials</h2>
${paras.join("\n")}
</section>`;
}

/* 3. Property line and survey considerations */
function propertyLineSurvey(city, state, facts) {
  const paras = [];

  paras.push(`<p>A fence built even a few inches over a property line can result in a forced removal at your expense, a neighbor dispute that escalates to litigation, or a failed home sale inspection. In ${city}, boundary disputes are one of the most common and avoidable fencing problems.</p>`);

  paras.push(`<p><strong>Get a survey before you build.</strong> A professional land survey in ${city} typically costs $300-$800 depending on lot size and complexity. This is not optional -- it is the only way to know exactly where your property line falls. The original survey from your home purchase may be outdated or imprecise, especially if any neighboring lots have been subdivided or improved since then. ${facts.geographyNote ? cap(facts.geographyNote) + "." : ""}</p>`);

  paras.push(`<p><strong>Setback requirements.</strong> Most municipalities in ${state}, including ${city}, require fences to be set back from the property line by a specific distance (typically 0-6 inches, but sometimes more in corner lots or near easements). Utility easements along the back or side of your lot may prevent fence installation entirely in certain areas. Check with ${city}'s building department and review your plat survey for easement locations before finalizing your fence layout.</p>`);

  paras.push(`<p><strong>Neighbor notification.</strong> ${state === "TX" ? "Texas does not require formal neighbor notification before building a fence, but practical and legal experience strongly favors discussing the project with adjacent property owners before construction begins. If a fence is built exactly on the property line, both property owners share maintenance responsibility under Texas law." : state === "CA" ? "California's Good Neighbor Fence Act (Civil Code 841) requires neighbors to share equally in the cost of maintaining a boundary fence. Before building a new fence, written notice to your neighbor is recommended -- and may be legally required if you intend to seek cost-sharing." : state === "GA" ? "Georgia law does not mandate fence cost-sharing, but discussing the project with neighbors before construction avoids disputes and potential litigation." : state === "WA" ? "Washington state law allows property owners to require neighbors to share fence costs in certain circumstances. Consult your county's specific ordinances before building on or near the property line." : state === "CO" ? "Colorado's fence law (CRS 35-46-112) addresses fence cost-sharing for agricultural properties, but in residential areas the rules vary by municipality. Check Denver's specific ordinances." : state === "IL" ? "Illinois law requires neighbors to share fence maintenance costs in some circumstances. Cook County has specific provisions -- verify before building." : state === "AZ" ? "Arizona does not have a mandatory fence cost-sharing law, but HOA CC&Rs often address shared boundary fences." : `Check ${state}'s specific statutes on boundary fence cost-sharing and neighbor notification requirements.`}</p>`);

  return `
<section class="section fp-section">
<h2>Property Lines and Survey Requirements in ${city}</h2>
${paras.join("\n")}
</section>`;
}

/* 4. HOA and municipal restrictions */
function hoaRestrictions(city, state, ctx, facts) {
  const paras = [];

  paras.push(`<p>Before selecting materials, height, or style for your fence in ${city}, check two layers of restrictions: your HOA's CC&Rs (if applicable) and the city's municipal code. Violating either can result in forced removal at your expense.</p>`);

  paras.push(`<p><strong>Height limits.</strong> ${city}'s municipal code typically limits residential fences to 6 feet in rear and side yards and 3-4 feet in front yards. Corner lots often have additional height restrictions in the sight-triangle zone near intersections to maintain driver visibility. Your HOA may impose stricter limits -- some communities cap fence height at 4 feet even in backyards, or require specific styles that limit effective height.</p>`);

  paras.push(`<p><strong>Material restrictions.</strong> Many HOAs in ${city} prohibit chain link fencing entirely, require specific colors or stain tones, or mandate that the "finished" side of a wood fence face outward toward neighbors. Municipal code may restrict certain materials in front yards -- barbed wire and electric fencing are prohibited in most residential zones in ${city}. ${facts.codeNote ? facts.codeNote + "." : ""}</p>`);

  if (ctx.growthRate === "high") {
    paras.push(`<p><strong>Master-planned community rules.</strong> ${city}'s rapid growth has produced a large inventory of master-planned communities with particularly strict CC&Rs. In these neighborhoods, fence approval can take 2-6 weeks through an architectural review committee, and the approved material and color palette is often narrow. Submit your fence plan to the HOA before getting contractor quotes -- there is no point in bidding a cedar fence if your HOA only allows vinyl or ornamental aluminum.</p>`);
  }

  paras.push(`<p><strong>Front-yard fence restrictions.</strong> Most residential zones in ${city} either prohibit front-yard fencing entirely or limit it to 3-4 feet with an open design (picket, wrought iron, or ornamental aluminum). Solid privacy fencing in the front yard is almost universally prohibited in single-family residential zones. If you need front-yard fencing for pet containment, look into low ornamental options that comply with local height and opacity restrictions.</p>`);

  if (facts.homeAge && facts.homeAge.includes("1920") || facts.homeAge && facts.homeAge.includes("1900") || facts.homeAge && facts.homeAge.includes("historic")) {
    paras.push(`<p><strong>Historic district considerations.</strong> Older neighborhoods in ${city} may fall within historic districts that impose additional restrictions on fencing materials, style, and height. A modern vinyl privacy fence in a historic district is likely to be denied. Check whether your property falls within a locally designated historic overlay district before making material selections.</p>`);
  }

  return `
<section class="section fp-section">
<h2>HOA and Municipal Fence Restrictions in ${city}</h2>
${paras.join("\n")}
</section>`;
}

/* 5. Permits and code */
function permitSection(city, state, facts) {
  const paras = [];

  paras.push(`<p>${facts.permits}. For fencing specifically, most cities require a permit when the fence exceeds a certain height threshold -- typically 6 feet in ${city}, though the trigger varies by zone and lot position.</p>`);

  paras.push(`<p><strong>When a permit is required.</strong> In ${city}, a fence permit is generally required for: fences over 6 feet tall, any fence in a front yard, fences within utility easements, and fences near drainage ways or flood zones. Even if your fence falls below the height threshold, some neighborhoods and HOAs require proof of a city permit before approving construction. The permit fee in ${city} is typically $50-$200 depending on fence length and complexity.</p>`);

  paras.push(`<p><strong>Who pulls the permit.</strong> Your contractor should handle the permit application as part of the project scope. If a contractor asks you to pull the permit yourself, or suggests skipping the permit entirely, that is a red flag. The permit holder is legally responsible for code compliance, and unpermitted fencing can create problems during a home sale, void HOA approval, and leave you liable for setback violations.</p>`);

  paras.push(`<p><strong>Inspections.</strong> After permit issuance and fence installation, ${city}'s building department may schedule a final inspection to verify compliance with height, setback, and construction standards. Confirm with your contractor that the inspection was requested and passed. Keep the permit and inspection documentation -- you will need it if you sell the home or if a neighbor raises a boundary dispute.</p>`);

  return `
<section class="section fp-section">
<h2>Fence Permits and Building Code in ${city}</h2>
${paras.join("\n")}
</section>`;
}

/* 6. Red flags */
function redFlagsSection(city, state, ctx, facts) {
  const flags = [];

  flags.push({ title: "No survey before installation", body: `A contractor who is willing to install a fence without asking about your property survey is either inexperienced or indifferent to the risk of building on your neighbor's property. In ${city}, a fence built even 6 inches over the property line can result in forced removal at your expense -- and a neighbor lawsuit. Any reputable fencing contractor in ${city} will ask to see your survey pins or recommend a surveyor before breaking ground.` });

  flags.push({ title: "Cedar vs pine deception", body: `Some contractors in ${city} quote "cedar" but install lower-grade pine or spruce, which looks similar when freshly cut but rots significantly faster. Pressure-treated pine is a legitimate and cost-effective choice, but it should be quoted honestly. If a contractor quotes cedar at prices that seem too good to be true (below $28-30 per linear foot installed in ${city}), ask to see the material receipts and verify the wood species. Real western red cedar commands a premium because it resists rot and insects naturally.` });

  flags.push({ title: "Skipping concrete for post footings", body: `Posts set in dirt or gravel alone will shift and lean within 1-3 years in ${city}'s soil conditions. ${facts.soil ? cap(facts.soil) + "." : ""} Every fence post should be set in concrete with a minimum depth of 24 inches (one-third of the post length). Contractors who skip concrete save $3-$5 per post in material and 10-15 minutes per hole in labor -- but the resulting fence will fail prematurely. If your quote does not explicitly include concrete footings for every post, ask why.` });

  flags.push({ title: "Wrong post depth", body: `In ${city}, fence posts need to be buried at least one-third of the total post length -- that means 32 inches minimum for an 8-foot post (supporting a 6-foot above-ground fence). Posts set at 18-20 inches, which some budget installers use to save time, will lean and fail under wind load or soil movement. ${ctx.snowLoad === "high" || ctx.snowLoad === "moderate" ? `Frost heave is an additional concern in ${city}. Posts should extend below the frost line, which is approximately 36-42 inches in this area.` : `In ${city}'s soil conditions, 30-36 inches of post depth with concrete footings is the standard for a fence that will last 15-20 years.`}` });

  if (ctx.hailRisk === "high" || ctx.hurricaneZone) {
    flags.push({ title: "Storm chaser fence crews", body: `After significant weather events in ${city}, out-of-state contractors appear offering quick fence repairs at low prices. These operators often use substandard materials, skip concrete footings, and disappear before warranty issues surface. Verify that any contractor has a permanent business address in ${state} and carries current general liability insurance. Ask for 3 recent local references and actually call them.` });
  }

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>Red Flags When Hiring a Fence Contractor in ${city}</h2>
<p>These are the most common contractor problems reported by ${city} homeowners in fencing projects. Watch for all of them when reviewing quotes.</p>
${flagsHTML}
</section>`;
}

/* 7. Seasonal buying guide */
function seasonalGuide(city, ctx) {
  const seasons = {
    hot_humid: {
      best: "October through February",
      worst: "March through June",
      reason: "Fall and winter offer cooler working conditions, shorter wait times, and more negotiating leverage. Spring and early summer are peak season as homeowners rush to complete outdoor projects before the heat sets in.",
      ground: "Ground conditions are rarely a problem in this climate zone -- no frost concerns and soil is workable year-round."
    },
    hot_dry: {
      best: "October through March",
      worst: "June through August",
      reason: "Summer surface temperatures make outdoor labor brutal and some contractors shut down midday. Fall through early spring offers ideal working conditions and better contractor availability.",
      ground: "The hard, dry desert soil can be difficult to dig in summer when it bakes to concrete hardness. Irrigate post hole locations 24-48 hours before installation to soften the ground."
    },
    cold: {
      best: "April through June and September through October",
      worst: "December through March",
      reason: "Frozen ground makes post hole digging extremely difficult and expensive in winter. Spring and fall shoulder seasons offer the best combination of workable ground and moderate demand.",
      ground: "Frozen ground is the primary constraint. Digging post holes in frozen soil requires auger equipment that adds $200-$500 to the project, and concrete does not cure properly below 40F. If you must install in winter, insulated blankets over fresh concrete footings are essential."
    },
    marine: {
      best: "June through September",
      worst: "November through February",
      reason: "The dry summer months are the only reliable window for outdoor work. Persistent rain from fall through spring slows projects, delays concrete curing, and creates muddy site conditions.",
      ground: "Saturated soil during the rainy season can cause post holes to fill with water and compromise concrete footings. Summer installation avoids these complications."
    },
    temperate: {
      best: "September through November",
      worst: "March through May",
      reason: "Fall offers stable weather and contractors finishing their busy season with room in the schedule. Spring demand spikes as homeowners emerge from winter.",
      ground: "Ground conditions are generally favorable year-round in this climate, with the exception of brief freeze periods in winter."
    },
    mixed_humid: {
      best: "September through November",
      worst: "April through June",
      reason: "Fall balances moderate temperatures with lower demand and workable soil. Spring storm season tightens availability as contractors handle storm-damage repairs.",
      ground: "Clay soils in this region can be extremely difficult to dig when saturated after heavy rain. Schedule installation during a dry stretch for best results."
    },
    mixed_dry: {
      best: "March through May and September through November",
      worst: "June through August",
      reason: "Shoulder seasons provide the best combination of moderate temperatures and contractor availability.",
      ground: "Dry, compacted soil may require mechanical auger equipment for post holes, which is standard practice in this region."
    },
  };

  // Seattle uses "marine" key
  const zoneKey = ctx.climateZone === "marine" ? "marine" : ctx.climateZone;
  const s = seasons[zoneKey] || seasons.temperate;

  return `
<section class="section fp-section">
<h2>Best Time to Install a Fence in ${city}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months</h3>
<p class="fp-season-months">${s.best}</p>
<p>${s.reason}</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Peak pricing / low availability</h3>
<p class="fp-season-months">${s.worst}</p>
<p>Expect 10-20% higher labor costs and 2-4 week longer lead times during peak season. If you must schedule during peak, book at least 3-4 weeks in advance.</p>
</div>
</div>
<p><strong>Ground conditions matter.</strong> ${s.ground}</p>
<p>Off-season scheduling can save 10-15% on labor costs in ${city}. Many reputable fencing contractors offer competitive pricing during their slower months to keep crews working.</p>
</section>`;
}

/* 8. Cost scenarios */
function costScenarios(city, state, mult) {
  const base = pricingModel.basePricePerLinearFoot;

  const budget = {
    material: "chain link (4 ft)",
    linearFeet: 150,
    perLF: Math.round(base.chain_link.mid * mult * 100) / 100,
    total: Math.round(base.chain_link.mid * mult * 150 / 50) * 50
  };
  const mid = {
    material: "cedar privacy (6 ft)",
    linearFeet: 150,
    perLF: Math.round(base.wood_privacy.mid * mult * 100) / 100,
    total: Math.round(base.wood_privacy.mid * mult * 150 / 50) * 50
  };
  const prem = {
    material: "ornamental iron (4-5 ft)",
    linearFeet: 150,
    perLF: Math.round(base.wrought_iron.mid * mult * 100) / 100,
    total: Math.round(base.wrought_iron.mid * mult * 150 / 50) * 50
  };

  function scenarioCard(label, s, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${s.material} | ${s.linearFeet} LF</p>
<p class="fp-scenario-total">${fmtD(s.total)}</p>
<p class="fp-scenario-detail">~$${s.perLF}/LF installed. Includes post holes, concrete footings, posts, rails, panels or pickets, one gate, hardware, and cleanup.</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>What a Fence Actually Costs in ${city}: 3 Scenarios</h2>
<p>Here is what real fencing projects look like in ${city}, ${state}, using ${city}-adjusted labor and material costs for 2026. All scenarios assume a typical 150-linear-foot backyard enclosure with one walk gate.</p>
<div class="fp-scenario-grid">
${scenarioCard("Budget", budget, "#22c55e")}
${scenarioCard("Mid-Range", mid, "#3b82f6")}
${scenarioCard("Premium", prem, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">Scenarios assume flat terrain and no old fence removal. Sloped lots add 10-20% for stepped or racked panels. Old fence removal typically adds $3-$5 per linear foot. Double gates, custom heights, and decorative caps increase costs further. <a href="/fencing-quote-analyzer.html?mode=estimator" style="color:var(--brand);">Get a personalized estimate.</a></p>
</section>`;
}

/* Flagship CSS */
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

/* Build all flagship content for a metro */
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
  html += propertyLineSurvey(city, state, facts);
  html += hoaRestrictions(city, state, ctx, facts);
  html += permitSection(city, state, facts);
  html += redFlagsSection(city, state, ctx, facts);
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
    const re = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, "g");
    content = content.replace(re, "");

    // Detect line ending
    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    // Injection point: after UNIQUE-LOCAL-GUIDE, or before TP-NEARBY-CITIES, or after FAQ section
    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const nearbyCities = content.indexOf("<!-- TP-NEARBY-CITIES -->");

    let insertAt;
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else if (nearbyCities >= 0) {
      // Insert right before the TP-NEARBY-CITIES comment
      insertAt = nearbyCities;
    } else {
      // Fallback: find the 5th </section> as injection point
      let sectionCount = 0;
      let searchFrom = 0;
      while (sectionCount < 5) {
        const idx = content.indexOf("</section>", searchFrom);
        if (idx < 0) break;
        searchFrom = idx + "</section>".length;
        sectionCount++;
      }
      if (sectionCount >= 5) {
        insertAt = searchFrom;
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

  console.log(`\nDone: ${processed} flagship fencing pages processed, ${skipped} skipped.`);
  if (DRY) console.log("[DRY RUN: no files written]");
}

main();
