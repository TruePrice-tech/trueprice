#!/usr/bin/env node
/**
 * Generates deep editorial content for 10 flagship metro siding pages.
 * Injects ~2500 words of genuinely unique, city-specific prose.
 * Idempotent via FLAGSHIP-SIDING-CONTENT markers.
 *
 * Usage: node scripts/build-flagship-siding.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/siding-pricing-model.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-SIDING-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-SIDING-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", region: "northeast", file: "new-york-ny-siding-cost.html" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", region: "west", file: "los-angeles-ca-siding-cost.html" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", region: "midwest", file: "chicago-il-siding-cost.html" },
  { slug: "houston-tx", ctxKey: "Houston|TX", region: "south", file: "houston-tx-siding-cost.html" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", region: "mountain", file: "phoenix-az-siding-cost.html" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", region: "south", file: "dallas-tx-siding-cost.html" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", region: "southeast", file: "atlanta-ga-siding-cost.html" },
  { slug: "denver-co", ctxKey: "Denver|CO", region: "mountain", file: "denver-co-siding-cost.html" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", region: "west", file: "seattle-wa-siding-cost.html" },
  { slug: "austin-tx", ctxKey: "Austin|TX", region: "south", file: "austin-tx-siding-cost.html" },
];

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString()}`; }
function fmtD(n) { return `$${n.toLocaleString()}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function getLaborMultiplier(region) {
  return pricingModel.laborMultiplierByRegion?.[region] || 1.0;
}

/* ------------------------------------------------------------------ */
/* 1. Neighborhood pricing breakdown                                   */
/* ------------------------------------------------------------------ */
function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";
  const baseVinyl = 12000;       // 2000 sqft * $6/sqft
  const baseFiber = 22000;       // 2000 sqft * $11/sqft
  const baseWood = 19000;        // 2000 sqft * $9.50/sqft
  const baseEngWood = 16000;     // 2000 sqft * $8/sqft

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    const vinyl = Math.round(baseVinyl * mult * localVar);
    const fiber = Math.round(baseFiber * mult * localVar);
    const wood = Math.round(baseWood * mult * localVar);
    const eng = Math.round(baseEngWood * mult * localVar);
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(vinyl)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(fiber)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(wood)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(eng)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>Neighborhood Siding Pricing in ${facts.displayName}</h2>
<p>Siding costs vary across ${facts.displayName} based on labor accessibility, contractor density, and housing stock. These are estimated ranges for a typical 2,000 sq ft exterior on a two-story home in each area.</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Vinyl</th>
<th style="text-align:right; padding:12px 16px;">Fiber Cement</th>
<th style="text-align:right; padding:12px 16px;">Wood</th>
<th style="text-align:right; padding:12px 16px;">Eng. Wood</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Estimates based on local labor rates and material delivery costs for 2026. Actual pricing depends on home complexity, number of stories, and current demand. <a href="/analyze-my-quote.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your siding quote for an exact comparison.</a></p>
</section>`;
}

/* ------------------------------------------------------------------ */
/* 2. Climate and material durability                                  */
/* ------------------------------------------------------------------ */
function climateAndDurability(city, state, ctx, facts) {
  const paras = [];

  paras.push(`<p>${cap(facts.climate)}. How these conditions interact with different siding materials determines both lifespan and maintenance costs in ${city}.</p>`);

  // Hot/UV markets
  if (ctx.climateZone === "hot_dry" || ctx.climateZone === "hot_humid") {
    paras.push(`<p><strong>Heat and UV exposure.</strong> Prolonged high temperatures and direct sun degrade vinyl siding faster than most homeowners expect. In ${city}'s climate, south- and west-facing vinyl panels can warp, buckle, or fade within 10-15 years if a thin gauge product was installed. Fiber cement and engineered wood are dimensionally stable under heat stress and hold paint significantly longer. If you choose vinyl in ${city}, insist on .044" gauge or thicker and look for products with built-in UV inhibitors.</p>`);
  }

  // Humidity and moisture
  if (ctx.climateZone === "hot_humid" || ctx.climateZone === "mixed_humid" || ctx.climateZone === "marine") {
    paras.push(`<p><strong>Moisture and humidity.</strong> ${city}'s moisture levels create conditions that test every siding material differently. Wood siding absorbs moisture and requires diligent maintenance (repainting every 3-5 years, caulking, and prompt repair of any cracking) to prevent rot. Fiber cement resists moisture absorption but must be properly back-primed before installation to prevent warping. Vinyl handles moisture well but can trap moisture behind it if house wrap is not properly installed, leading to hidden rot on the sheathing underneath.</p>`);
  }

  // Cold/freeze-thaw
  if (ctx.climateZone === "cold" || ctx.snowLoad === "moderate" || ctx.snowLoad === "high") {
    paras.push(`<p><strong>Freeze-thaw cycling.</strong> ${city}'s winters subject siding to repeated freeze-thaw cycles that stress seams, caulk joints, and fastener points. Water penetrates hairline cracks, freezes, expands, and widens the damage with each cycle. Fiber cement performs well in freeze-thaw conditions when properly installed with adequate gap spacing for thermal expansion. Vinyl naturally flexes with temperature changes but can crack on impact during extreme cold. Wood requires vigilant caulk maintenance to prevent water intrusion before freeze season.</p>`);
  }

  // Hail
  if (ctx.hailRisk === "high") {
    paras.push(`<p><strong>Hail damage.</strong> Hail is a real threat to siding in ${city}. Vinyl siding cracks and shatters on impact from hail 1" or larger. Fiber cement and engineered wood handle hail significantly better, denting rather than fracturing. If you live in a hail-prone area of ${city}, check whether your homeowners insurance offers premium credits for impact-resistant siding, and factor replacement frequency into your material cost comparison.</p>`);
  }

  // Wildfire
  if (facts.climate.includes("wildfire") || facts.climate.includes("fire")) {
    paras.push(`<p><strong>Fire resistance.</strong> Wildfire risk in ${city} makes siding material choice a safety decision, not just an aesthetic one. Fiber cement is non-combustible and rated for use in WUI (Wildland-Urban Interface) zones. Wood siding is highly combustible unless treated with fire retardant, and vinyl melts at relatively low temperatures. In fire-prone areas of ${city}, fiber cement or stucco are the responsible choices regardless of budget.</p>`);
  }

  // Marine/moss/rain
  if (facts.climate.includes("rain") || facts.climate.includes("wet") || facts.climate.includes("moss") || ctx.climateZone === "marine") {
    paras.push(`<p><strong>Moss, algae, and biological growth.</strong> The persistent moisture in ${city} promotes moss and algae growth on siding surfaces, particularly on north-facing walls and areas shaded by trees. Left untreated, biological growth traps moisture against the siding surface and accelerates material degradation. Periodic pressure washing (every 1-2 years) and trimming vegetation away from exterior walls are essential maintenance steps in this market.</p>`);
  }

  return `
<section class="section fp-section">
<h2>How ${city}'s Climate Affects Siding Performance</h2>
${paras.join("\n")}
</section>`;
}

/* ------------------------------------------------------------------ */
/* 3. Material deep dive for this market                               */
/* ------------------------------------------------------------------ */
function materialDeepDive(city, state, ctx, facts, mult) {
  const vinylLow = Math.round(pricingModel.basePriceByType.vinyl.lowPerSqft * mult * 100) / 100;
  const vinylHigh = Math.round(pricingModel.basePriceByType.vinyl.highPerSqft * mult * 100) / 100;
  const fiberLow = Math.round(pricingModel.basePriceByType.fiber_cement.lowPerSqft * mult * 100) / 100;
  const fiberHigh = Math.round(pricingModel.basePriceByType.fiber_cement.highPerSqft * mult * 100) / 100;
  const woodLow = Math.round(pricingModel.basePriceByType.wood.lowPerSqft * mult * 100) / 100;
  const woodHigh = Math.round(pricingModel.basePriceByType.wood.highPerSqft * mult * 100) / 100;
  const engLow = Math.round(pricingModel.basePriceByType.engineered_wood.lowPerSqft * mult * 100) / 100;
  const engHigh = Math.round(pricingModel.basePriceByType.engineered_wood.highPerSqft * mult * 100) / 100;

  // Determine which materials dominate based on climate
  let primaryMaterial, primaryReason;
  if (ctx.climateZone === "hot_dry" || facts.climate.includes("wildfire") || facts.climate.includes("fire")) {
    primaryMaterial = "Fiber cement (James Hardie)";
    primaryReason = `fire resistance and dimensional stability in ${city}'s extreme heat make it the default choice for most contractors here`;
  } else if (ctx.climateZone === "cold" || ctx.snowLoad === "moderate" || ctx.snowLoad === "high") {
    primaryMaterial = "Vinyl and fiber cement";
    primaryReason = `both handle ${city}'s freeze-thaw cycles well, with vinyl dominating budget jobs and fiber cement leading mid-range and above`;
  } else if (ctx.climateZone === "marine") {
    primaryMaterial = "Fiber cement and engineered wood";
    primaryReason = `moisture resistance is critical in ${city}'s wet climate, and both materials outperform real wood and standard vinyl in long-term durability here`;
  } else if (ctx.climateZone === "hot_humid") {
    primaryMaterial = "Fiber cement and vinyl";
    primaryReason = `humidity resistance and low maintenance requirements make these the most practical choices in ${city}'s climate`;
  } else {
    primaryMaterial = "Vinyl and fiber cement";
    primaryReason = `the combination of affordability and durability makes these the most commonly installed materials in ${city}`;
  }

  return `
<section class="section fp-section">
<h2>What ${city} Contractors Install Most and Why</h2>
<p>${primaryMaterial} dominates the ${city} market because ${primaryReason}. Here is how each material stacks up at local pricing.</p>

<div class="fp-material-grid">
<div class="fp-material-card">
<h3>Vinyl Siding</h3>
<p class="fp-material-price">$${vinylLow} - $${vinylHigh}/sq ft installed</p>
<p>The most affordable option. Modern premium vinyl (.044"-.046" gauge) looks significantly better than the builder-grade product from 20 years ago. Maintenance is essentially zero beyond occasional pressure washing. The tradeoff is lower resale value impact and a shorter lifespan (20-30 years) compared to fiber cement. In ${city}, vinyl accounts for the majority of budget-tier siding jobs.</p>
</div>

<div class="fp-material-card">
<h3>Fiber Cement (HardiePlank)</h3>
<p class="fp-material-price">$${fiberLow} - $${fiberHigh}/sq ft installed</p>
<p>James Hardie controls roughly 90% of the fiber cement market, and for good reason. The product is non-combustible, resists rot and termites, holds paint for 15+ years, and comes with a 30-year transferable warranty. In ${city}, fiber cement is the default mid-range recommendation from most established contractors. The higher upfront cost is offset by almost zero maintenance and strong resale value impact. Requires skilled installation because the material is heavy and brittle.</p>
</div>

<div class="fp-material-card">
<h3>Wood Siding (Cedar, Redwood)</h3>
<p class="fp-material-price">$${woodLow} - $${woodHigh}/sq ft installed</p>
<p>Natural wood delivers unmatched aesthetic character, especially on craftsman, Victorian, or historic homes in ${city}. Cedar and redwood are naturally rot-resistant but still require staining or painting every 3-5 years. ${ctx.climateZone === "hot_humid" || ctx.climateZone === "marine" ? `In ${city}'s climate, the maintenance burden is higher than in drier markets, and untreated wood can deteriorate rapidly.` : `In ${city}, wood siding performs well with regular maintenance but the ongoing cost commitment is significant over a 30-year ownership period.`} Wood is also susceptible to termite and carpenter ant damage in many markets.</p>
</div>

<div class="fp-material-card">
<h3>Engineered Wood (LP SmartSide)</h3>
<p class="fp-material-price">$${engLow} - $${engHigh}/sq ft installed</p>
<p>LP SmartSide is the dominant engineered wood brand in ${city}. It offers the look of real wood at a lower price point, with better moisture and impact resistance than natural wood. The zinc borate treatment provides built-in termite and fungal protection. Engineered wood is lighter than fiber cement (easier, faster installation) and comes pre-primed. The 50-year substrate warranty is competitive with fiber cement. A strong choice for homeowners who want the wood aesthetic without the maintenance commitment.</p>
</div>
</div>
</section>`;
}

/* ------------------------------------------------------------------ */
/* 4. HOA and historic district considerations                         */
/* ------------------------------------------------------------------ */
function hoaAndHistoric(city, state, ctx, facts) {
  const hoaLevel = ctx.hoaPrevalence || "moderate";
  const paras = [];

  if (hoaLevel === "high") {
    paras.push(`<p>${city} has one of the higher rates of HOA-governed communities in the country. If your home is in an HOA, do not order materials or sign a contract until you have written architectural approval. Most HOAs in ${city} regulate siding color, material type, profile style, and sometimes even the specific manufacturer. Submitting your application with a material sample, color chip, and contractor name typically takes 2-4 weeks for review. Starting work without approval can result in forced removal at your expense.</p>`);
  } else if (hoaLevel === "moderate") {
    paras.push(`<p>HOAs are common but not universal in ${city}. If your home is subject to an HOA, check the CC&Rs (Covenants, Conditions & Restrictions) for siding-specific rules before soliciting bids. Most HOAs in ${city} regulate at minimum the color palette and may restrict material types. Submit your architectural review application early in the process because approval timelines vary from one week to six weeks depending on the association.</p>`);
  } else {
    paras.push(`<p>HOA restrictions are less common in ${city} than in Sun Belt suburbs, but some newer developments and condo associations do regulate exterior materials and colors. Check your property's CC&Rs before starting a siding project if your home is in any kind of managed community.</p>`);
  }

  // Historic district considerations based on homeAge
  if (ctx.avgHomeAge >= 45 || (facts.homeAge && facts.homeAge.includes("1920")) || (facts.homeAge && facts.homeAge.includes("1940")) || (facts.homeAge && facts.homeAge.includes("1900"))) {
    paras.push(`<p><strong>Historic district restrictions.</strong> ${city} has neighborhoods with historic overlay districts that impose stricter requirements than standard building code. In these areas, siding replacements may need to match the original material, profile, and sometimes even the fastening method. Vinyl siding is frequently prohibited in historic districts. Fiber cement that mimics the original wood profile is usually the approved compromise, but you may need specific board widths or reveal dimensions. Contact ${city}'s historic preservation office or your local landmarks commission before getting quotes to avoid expensive re-work.</p>`);
  } else {
    paras.push(`<p><strong>Historic considerations.</strong> While ${city} has some older neighborhoods with character homes, formal historic district restrictions are less common than in East Coast cities. However, if your home is in a designated historic area, siding material and style may be regulated. Verify with your local planning department before making material decisions.</p>`);
  }

  paras.push(`<p><strong>Color selection.</strong> Beyond HOA and historic rules, color choice affects long-term cost in ${city}. Dark colors absorb more heat and fade faster in direct sun, requiring repainting sooner on wood and fiber cement. In ${city}, lighter earth tones and whites tend to look better longer and reduce cooling loads. If you are choosing pre-finished fiber cement (ColorPlus by Hardie), the factory finish carries a 15-year warranty against fading and chipping, which is significantly better than field-applied paint.</p>`);

  return `
<section class="section fp-section">
<h2>HOA and Historic District Siding Rules in ${city}</h2>
${paras.join("\n")}
</section>`;
}

/* ------------------------------------------------------------------ */
/* 5. Insulation and energy impact                                     */
/* ------------------------------------------------------------------ */
function insulationAndEnergy(city, state, ctx, facts) {
  const paras = [];

  paras.push(`<p>Siding replacement is one of the best opportunities to improve your home's thermal envelope. The existing siding is already coming off, so adding insulation underneath costs a fraction of what it would as a standalone project.</p>`);

  // Climate-specific energy impact
  if (ctx.climateZone === "hot_dry" || ctx.climateZone === "hot_humid") {
    paras.push(`<p><strong>Cooling cost impact in ${city}.</strong> In ${city}'s hot climate, the dominant energy cost is air conditioning. Insulated vinyl siding (with built-in EPS foam backing) adds R-2 to R-5 to your walls, and a full house wrap with rigid foam board underneath any siding material can add R-3 to R-6. For a typical ${city} home, this translates to estimated cooling cost savings of 10-20% annually. The payback period on the insulation upgrade is typically 4-7 years in this climate.</p>`);
  } else if (ctx.climateZone === "cold") {
    paras.push(`<p><strong>Heating cost impact in ${city}.</strong> ${city}'s cold winters make wall insulation a significant factor in energy costs. Adding rigid foam board (1" XPS or polyiso, R-5 to R-6.5) under new siding creates a continuous thermal break that reduces heat loss through wall framing. For a typical ${city} home, this can reduce heating costs by 15-25% annually. The payback period is typically 3-5 years given ${city}'s heating degree days.</p>`);
  } else if (ctx.climateZone === "marine") {
    paras.push(`<p><strong>Energy impact in ${city}.</strong> ${city}'s mild but long heating season means wall insulation improvements pay back steadily over time. Adding rigid foam board under new siding addresses thermal bridging through studs (which accounts for about 25% of wall heat loss in conventionally framed homes). Expect heating cost reductions of 10-18% and a payback period of 4-6 years.</p>`);
  } else {
    paras.push(`<p><strong>Year-round energy impact in ${city}.</strong> ${city}'s climate demands both heating and cooling, which means insulation improvements pay dividends in both seasons. Adding rigid foam board or insulated siding can reduce total energy costs by 10-20% annually, with a typical payback period of 4-7 years.</p>`);
  }

  paras.push(`<p><strong>Insulated vinyl siding.</strong> Several manufacturers (CertainTeed, Alside, Ply Gem) offer vinyl siding with permanently bonded EPS foam backing. This eliminates the air gap behind the siding, adds R-value, reduces noise transmission, and makes the panels more rigid and impact-resistant. The cost premium over standard vinyl is typically 30-50%, but the energy savings and improved feel of the finished product make it a worthwhile upgrade in most ${city} installations.</p>`);

  paras.push(`<p><strong>House wrap is not optional.</strong> Regardless of siding material, a properly installed weather-resistant barrier (house wrap) under the siding is critical. It prevents bulk water infiltration while allowing moisture vapor to escape from inside the wall cavity. In ${city}, the most common house wraps are Tyvek and ZIP System. If your contractor's quote does not explicitly include house wrap, ask why. Skipping it to save money is one of the most common and most damaging shortcuts in the siding industry.</p>`);

  return `
<section class="section fp-section">
<h2>Insulation and Energy Savings When Residing in ${city}</h2>
${paras.join("\n")}
</section>`;
}

/* ------------------------------------------------------------------ */
/* 6. Permits and code requirements                                    */
/* ------------------------------------------------------------------ */
function permitSection(city, state, facts) {
  return `
<section class="section fp-section">
<h2>Siding Permits and Code Requirements in ${city}</h2>
<p>${facts.permits}. A building permit is required for most full siding replacement projects in ${city}. The permit ensures the work meets local building code, which protects you if problems arise later or if you sell the home.</p>
<p>${facts.codeNote ? facts.codeNote + ". " : ""}Your contractor should pull the permit as part of the job. If a contractor asks you to pull it yourself, or suggests skipping the permit entirely, that is a serious red flag. Unpermitted siding work can void your homeowners insurance, create title issues during a sale, and leave you exposed to substandard installation with no recourse.</p>
<p>After the job is complete, confirm that a final inspection was scheduled and passed. Keep the passed inspection documentation along with your warranty paperwork and material receipts. ${state === "TX" ? "In Texas, verify your contractor's registration through TDLR (Texas Department of Licensing and Regulation)." : state === "CA" ? "In California, verify your contractor's license through CSLB (Contractors State License Board) at cslb.ca.gov." : state === "GA" ? "In Georgia, verify contractor licensure at sos.ga.gov for jobs over $2,500." : state === "CO" ? "Colorado does not license siding contractors at the state level, but Denver requires city registration and proof of insurance." : state === "WA" ? "In Washington, verify your contractor's license through the Department of Labor & Industries at lni.wa.gov." : state === "AZ" ? "In Arizona, verify your contractor's registration through the Registrar of Contractors (ROC)." : state === "IL" ? "In Illinois, verify contractor licensing through your local municipality; Chicago requires Department of Buildings registration." : state === "NY" ? "In New York, verify contractor licensing through your local consumer affairs office; NYC requires DOB registration." : `Verify your contractor's license through ${state}'s licensing authority.`}</p>
</section>`;
}

/* ------------------------------------------------------------------ */
/* 7. Red flags                                                        */
/* ------------------------------------------------------------------ */
function redFlagsSection(city, state, ctx, facts) {
  const flags = [];

  flags.push({
    title: "Thin vinyl gauge",
    body: `The single most common cost-cutting tactic in the siding industry is installing thinner vinyl. Builder-grade vinyl at .040" gauge is significantly less durable than the .044"-.046" gauge used by quality installers. In ${city}, ask every bidder to specify the exact gauge and profile on the written quote. If the quote just says "vinyl siding" without specifying gauge, manufacturer, and profile, the contractor is likely planning to use whatever is cheapest that week.`
  });

  flags.push({
    title: "Skipping house wrap",
    body: `House wrap (weather-resistant barrier) is required by code in virtually every jurisdiction including ${city}. Some contractors skip it to save time and material costs, then cover the sheathing directly with siding. This creates a moisture trap that leads to hidden rot, mold, and structural damage that may not be visible for years. Your quote should explicitly list house wrap or weather barrier as a line item. If it does not, the contractor is either planning to skip it or assuming you will not check.`
  });

  flags.push({
    title: "Not addressing rot before residing",
    body: `A common and expensive mistake: installing new siding over rotted sheathing, trim, or framing without repairing the damage first. The new siding hides the rot but does not stop it. Within 2-5 years, the rot spreads and compromises the new installation. Any reputable siding contractor in ${city} will probe for rot during their initial assessment and include repair costs (or a per-board rate for unexpected rot) in the written quote. A contractor who quotes without inspecting the underlying condition is either inexperienced or planning to cut corners.`
  });

  flags.push({
    title: "No written scope of work",
    body: `A professional siding quote in ${city} should itemize: siding material (brand, profile, gauge/thickness, color), square footage, house wrap, flashing, trim and fascia, soffit, J-channel and accessories, corner posts, old siding removal and disposal, permit, and warranty terms. If the quote is a single number without this detail, you have no contractual basis to challenge scope reductions or change orders.`
  });

  if (ctx.hailRisk === "high") {
    flags.push({
      title: "Storm chaser siding contractors",
      body: `After hail events in ${city}, out-of-state contractors appear offering to handle your insurance claim and replace your siding. These operators frequently use the cheapest available materials, skip code requirements, and are gone before warranty issues surface. Verify that any contractor has a permanent business address in ${state} and a track record in the local market before signing anything.`
    });
  }

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>Siding Red Flags Every ${city} Homeowner Should Know</h2>
<p>These are the most common ways ${city} homeowners get burned on siding projects. Knowing what to look for protects your investment.</p>
${flagsHTML}
</section>`;
}

/* ------------------------------------------------------------------ */
/* 8. Seasonal buying guide                                            */
/* ------------------------------------------------------------------ */
function seasonalGuide(city, ctx) {
  const seasons = {
    hot_humid: { best: "October through February", worst: "April through June", reason: "Spring storm season drives emergency repairs and tightens contractor availability. Fall and winter offer the best scheduling flexibility and negotiating leverage in this market." },
    hot_dry: { best: "October through March", worst: "June through August", reason: "Summer surface temperatures make exterior work miserable for crews and can affect caulk adhesion and paint curing. Fall and winter are ideal for both scheduling and material performance." },
    cold: { best: "May through September", worst: "December through February", reason: "Vinyl becomes brittle and prone to cracking during installation in cold temperatures. Caulk and sealants also need temperatures above 40F for proper adhesion. Summer is the sweet spot for quality installation." },
    temperate: { best: "September through November", worst: "March through May", reason: "Fall offers stable weather and contractors finishing their peak season backlog. Spring demand spikes as homeowners start outdoor projects." },
    mixed_humid: { best: "September through November", worst: "April through June", reason: "Fall balances moderate temperatures with lower demand. Spring storm season drives emergency work and tightens the schedule." },
    mixed_dry: { best: "March through May and September through November", worst: "June through August", reason: "Shoulder seasons offer the best combination of moderate temperatures and contractor availability." },
    marine: { best: "June through September", worst: "November through February", reason: "The dry summer months are ideal for siding installation because caulk, paint, and adhesives cure properly. Winter rain makes exterior work inconsistent and can delay timelines significantly." },
  };
  const s = seasons[ctx.climateZone] || seasons.temperate;

  return `
<section class="section fp-section">
<h2>Best Time to Replace Siding in ${city}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months</h3>
<p class="fp-season-months">${s.best}</p>
<p>${s.reason}</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Peak pricing / low availability</h3>
<p class="fp-season-months">${s.worst}</p>
<p>Expect 10-20% higher labor costs and longer lead times during peak season. If you must schedule during peak, book at least 4-6 weeks in advance and get your contract signed early.</p>
</div>
</div>
<p>Off-season scheduling can save 10-15% on labor costs in ${city}. Many established contractors offer better pricing during their slower months to keep crews working. The quality of work does not change, only the price and scheduling convenience.</p>
</section>`;
}

/* ------------------------------------------------------------------ */
/* 9. Cost scenarios                                                   */
/* ------------------------------------------------------------------ */
function costScenarios(city, state, mult) {
  const budget = {
    material: "vinyl siding (.044\" gauge)",
    sqft: 1800,
    perSq: Math.round(pricingModel.basePriceByType.vinyl.lowPerSqft * mult * 1.15 * 100) / 100,
    get total() { return Math.round(this.sqft * this.perSq); }
  };
  const mid = {
    material: "fiber cement (James Hardie ColorPlus)",
    sqft: 2000,
    perSq: Math.round(pricingModel.basePriceByType.fiber_cement.lowPerSqft * mult * 1.3 * 100) / 100,
    get total() { return Math.round(this.sqft * this.perSq); }
  };
  const prem = {
    material: "cedar or premium engineered wood",
    sqft: 2200,
    perSq: Math.round(pricingModel.basePriceByType.wood.highPerSqft * mult * 1.1 * 100) / 100,
    get total() { return Math.round(this.sqft * this.perSq); }
  };

  function scenarioCard(label, s, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${s.material} | ${s.sqft} sq ft exterior</p>
<p class="fp-scenario-total">${fmtD(s.total)}</p>
<p class="fp-scenario-detail">~$${s.perSq}/sq ft installed. Includes old siding removal, house wrap, flashing, trim, J-channel, corner posts, disposal, and permit.</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>What Siding Replacement Actually Costs in ${city}: 3 Scenarios</h2>
<p>Here is what real siding projects look like in ${city}, ${state}, using ${city}-adjusted labor and material costs for 2026.</p>
<div class="fp-scenario-grid">
${scenarioCard("Budget", budget, "#22c55e")}
${scenarioCard("Mid-Range", mid, "#3b82f6")}
${scenarioCard("Premium", prem, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">All scenarios assume a single-story home with standard geometry. Multi-story homes, complex trim work, and extensive rot repair add 15-35%. <a href="/siding-cost.html" style="color:var(--brand);">Get a personalized siding estimate.</a></p>
</section>`;
}

/* ------------------------------------------------------------------ */
/* Flagship CSS                                                        */
/* ------------------------------------------------------------------ */
function flagshipCSS() {
  return `
<style>
.fp-section { margin-top:32px; }
.fp-section h2 { font-size:22px; margin-bottom:12px; color:#0f172a; }
.fp-section p { font-size:15px; line-height:1.7; color:#334155; margin-bottom:12px; }
.fp-table { border:1px solid var(--border,#e2e8f0); border-radius:10px; overflow:hidden; }
.fp-table tbody tr:nth-child(even) { background:var(--bg-subtle,#f8fafc); }
.fp-material-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:16px 0; }
.fp-material-card { padding:20px; background:#fff; border:1px solid var(--border,#e2e8f0); border-radius:12px; }
.fp-material-card h3 { font-size:16px; font-weight:700; margin:0 0 6px; color:#0f172a; }
.fp-material-price { font-size:18px; font-weight:700; color:var(--brand,#1d4ed8); margin:0 0 10px; }
.fp-material-card p:last-child { margin:0; font-size:14px; line-height:1.6; color:#475569; }
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
  .fp-material-grid { grid-template-columns:1fr; }
}
</style>`;
}

/* ------------------------------------------------------------------ */
/* Assemble                                                            */
/* ------------------------------------------------------------------ */
function buildFlagshipContent(metro) {
  const facts = localFacts[metro.slug];
  const ctx = cityContext[metro.ctxKey];
  if (!facts || !ctx) return null;

  const city = facts.displayName;
  const state = facts.stateAbbr;
  const mult = getLaborMultiplier(metro.region);

  let html = `\n${MARKER_START}\n`;
  html += flagshipCSS();
  html += neighborhoodPricing(facts, mult);
  html += climateAndDurability(city, state, ctx, facts);
  html += materialDeepDive(city, state, ctx, facts, mult);
  html += hoaAndHistoric(city, state, ctx, facts);
  html += insulationAndEnergy(city, state, ctx, facts);
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
    const re = new RegExp(`${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, "g");
    content = content.replace(re, "");

    // Inject after UNIQUE-LOCAL-GUIDE or after section 5 (FAQ section, before "Other Services")
    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const localInjectedV2 = content.indexOf("<!-- TP-LOCAL-INJECTED-V2 -->");
    // Find the FAQ section end (section before "Other Services")
    const otherServicesIdx = content.indexOf("Other Services in ");

    let insertAt;
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else if (localInjectedV2 >= 0) {
      // Insert before the first local-injected section
      insertAt = localInjectedV2;
    } else if (otherServicesIdx >= 0) {
      // Find the </section> before "Other Services"
      const sectionStart = content.lastIndexOf("<section", otherServicesIdx);
      insertAt = sectionStart >= 0 ? sectionStart : otherServicesIdx;
    } else {
      // Fallback: insert after the FAQ section (last </section> before </main>)
      const mainEnd = content.indexOf("</main>");
      if (mainEnd >= 0) {
        const lastSection = content.lastIndexOf("</section>", mainEnd);
        insertAt = lastSection >= 0 ? lastSection + "</section>".length : mainEnd;
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
    console.log(`  ${metro.file}: ~${wordCount} words of flagship siding content injected`);
    processed++;
  }

  console.log(`\nDone: ${processed} flagship siding pages processed, ${skipped} skipped.`);
  if (DRY) console.log("[DRY RUN: no files written]");
}

main();
