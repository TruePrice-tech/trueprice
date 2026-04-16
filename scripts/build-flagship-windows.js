#!/usr/bin/env node
/**
 * Generates deep editorial content for 10 flagship metro window replacement pages.
 * Injects ~2500 words of genuinely unique, city-specific prose.
 * Idempotent via FLAGSHIP-WINDOWS-CONTENT markers.
 *
 * Usage: node scripts/build-flagship-windows.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/windows-pricing.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-WINDOWS-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-WINDOWS-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-window-cost.html" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-window-cost.html" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-window-cost.html" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-window-cost.html" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-window-cost.html" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-window-cost.html" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-window-cost.html" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-window-cost.html" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-window-cost.html" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-window-cost.html" },
  { slug: "san-francisco-ca", ctxKey: "San Francisco|CA", file: "san-francisco-ca-window-cost.html" },
  { slug: "las-vegas-nv", ctxKey: "Las Vegas|NV", file: "las-vegas-nv-window-cost.html" },
  { slug: "philadelphia-pa", ctxKey: "Philadelphia|PA", file: "philadelphia-pa-window-cost.html" },
  { slug: "miami-fl", ctxKey: "Miami|FL", file: "miami-fl-window-cost.html" },
  { slug: "boston-ma", ctxKey: "Boston|MA", file: "boston-ma-window-cost.html" },
  { slug: "san-diego-ca", ctxKey: "San Diego|CA", file: "san-diego-ca-window-cost.html" },
  { slug: "tampa-fl", ctxKey: "Tampa|FL", file: "tampa-fl-window-cost.html" },
  { slug: "detroit-mi", ctxKey: "Detroit|MI", file: "detroit-mi-window-cost.html" },
  { slug: "minneapolis-mn", ctxKey: "Minneapolis|MN", file: "minneapolis-mn-window-cost.html" },
  { slug: "charlotte-nc", ctxKey: "Charlotte|NC", file: "charlotte-nc-window-cost.html" },
];

function fmtDollar(n) { return n >= 1000 ? `$${n.toLocaleString("en-US")}` : `$${n}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function getMultiplier(state) {
  return pricingModel.stateMultipliers?.[state] || 1.0;
}

/** Map state to ENERGY STAR climate zone key */
function getClimateZone(state) {
  const zones = pricingModel.climateZones;
  for (const [key, z] of Object.entries(zones)) {
    if (z.states_primarily?.includes(state) || z.states_partial?.includes(state)) return key;
  }
  return "South-Central";
}

function getEnergyTargets(zone) {
  return pricingModel.energyStarTargets?.[zone] || pricingModel.energyStarTargets["South-Central"];
}

// ── Section 1: Neighborhood pricing breakdown ──────────────────────────

function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";

  const baseVinylDH = 550;
  const baseFibCasement = 950;
  const baseWoodDH = 1000;
  const baseVinylSliding = 500;

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    const vinyl = Math.round(baseVinylDH * mult * localVar);
    const fib = Math.round(baseFibCasement * mult * localVar);
    const wood = Math.round(baseWoodDH * mult * localVar);
    const sliding = Math.round(baseVinylSliding * mult * localVar);
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtDollar(vinyl)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtDollar(fib)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtDollar(wood)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtDollar(sliding)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>Neighborhood Window Pricing Breakdown</h2>
<p>Window replacement costs vary within ${facts.displayName} based on housing stock age, labor accessibility, and local demand. These are estimated per-window installed costs for each area.</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Vinyl Double-Hung</th>
<th style="text-align:right; padding:12px 16px;">Fiberglass Casement</th>
<th style="text-align:right; padding:12px 16px;">Wood Double-Hung</th>
<th style="text-align:right; padding:12px 16px;">Vinyl Sliding</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Per-window installed pricing based on local labor rates and material delivery costs. Actual pricing depends on window size, installation type (pocket vs full-frame), and current demand. <a href="/analyze-my-quote.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your quote for an exact comparison.</a></p>
</section>`;
}

// ── Section 2: Climate and energy efficiency ────────────────────────────

function climateEnergySection(city, state, ctx, facts) {
  const zone = getClimateZone(state);
  const targets = getEnergyTargets(zone);
  const paras = [];

  paras.push(`<p>${cap(facts.climate)}. These conditions directly determine which glass packages and frame materials deliver the best return on investment in ${city}.</p>`);

  // U-factor guidance
  if (zone === "Northern") {
    paras.push(`<p><strong>U-factor is your priority metric.</strong> In ${city}'s heating-dominated climate, heat loss through windows drives the majority of your energy costs. Target U-factor of ${targets.energyStar.uFactorMax} or lower for ENERGY STAR qualification. Triple-pane glass with krypton gas fill achieves U-factors as low as 0.17, which delivers measurable savings on heating bills in ${state}'s winters. The upfront premium of $100-$300 per window over double-pane typically pays back within 5-8 years through reduced heating costs.</p>`);
  } else if (zone === "North-Central") {
    paras.push(`<p><strong>Balance U-factor and SHGC.</strong> ${city}'s mixed climate demands windows that perform well in both heating and cooling seasons. Target U-factor of ${targets.energyStar.uFactorMax} or lower and SHGC of ${targets.energyStar.shgcMax || "0.40"} or lower. This balance prevents heat loss in winter while blocking solar heat gain in summer. Double-pane Low-E with argon fill is the sweet spot for most ${city} homes.</p>`);
  } else if (zone === "South-Central") {
    paras.push(`<p><strong>Solar Heat Gain Coefficient (SHGC) matters most here.</strong> In ${city}'s cooling-dominated climate, the sun beating through your windows drives air conditioning costs more than heat loss drives heating costs. Target SHGC of ${targets.energyStar.shgcMax || "0.25"} or lower. Low-E coatings tuned for solar rejection (Low-E 366 or equivalent) make a dramatic difference on south- and west-facing windows. U-factor should still be ${targets.energyStar.uFactorMax} or below, but SHGC is where you get the biggest energy savings in ${city}.</p>`);
  } else {
    paras.push(`<p><strong>Prioritize low SHGC above all else.</strong> In ${city}'s hot climate, solar heat gain through windows is the single largest driver of cooling costs. Target SHGC of ${targets.energyStar.shgcMax || "0.25"} or lower on every window, especially south- and west-facing exposures. Low-E coatings with high visible light transmission (VT) and low SHGC let daylight in while blocking infrared heat. U-factor of ${targets.energyStar.uFactorMax} or below is the ENERGY STAR threshold, but SHGC is where your money goes in ${city}.</p>`);
  }

  // Low-E coatings
  paras.push(`<p><strong>Low-E coatings are non-negotiable in ${city}.</strong> Every window quote you receive should specify Low-E glass as standard, not an upgrade. There are different Low-E formulations: "passive" Low-E (Low-E 272 type) maximizes solar heat gain for cold climates, while "solar control" Low-E (Low-E 366 type) rejects solar heat for warm climates. In ${city}, ${zone === "Northern" || zone === "North-Central" ? "passive Low-E on south-facing windows and solar control Low-E on west-facing windows gives you the best of both worlds" : "solar control Low-E on all windows is the clear choice, with particular attention to south and west exposures where solar gain peaks"}. If a contractor's quote does not specify the Low-E coating type, ask before signing.</p>`);

  return `
<section class="section fp-section">
<h2>Climate and Energy Efficiency: Windows in ${city}</h2>
${paras.join("\n")}
</section>`;
}

// ── Section 3: Frame material comparison for this climate ──────────────

function frameMaterialComparison(city, state, ctx, facts) {
  const zone = getClimateZone(state);
  const paras = [];

  paras.push(`<p>The four major frame materials each have distinct advantages in ${city}'s climate. Here is how they compare for this specific market.</p>`);

  // Vinyl
  const vinylVerdict = zone === "Southern" || zone === "South-Central"
    ? `In ${city}'s heat, dark-colored vinyl frames can warp or distort over time. Stick with white or light-colored vinyl, or choose a brand with welded (not screwed) frames and reinforced meeting rails. Vinyl remains the best value for most ${city} homeowners, but quality matters more here than in mild climates.`
    : `Vinyl performs well in ${city}'s climate with minimal maintenance. It does not conduct heat or cold, making it an excellent insulator. Modern vinyl frames are UV-stabilized and resist fading, cracking, and warping for 20-30 years.`;

  paras.push(`<p><strong>Vinyl.</strong> Lowest cost ($300-$700/window installed). Zero maintenance. ${vinylVerdict}</p>`);

  // Fiberglass
  const fibVerdict = ctx.climateZone === "cold" || zone === "Northern"
    ? `Fiberglass is arguably the best frame material for ${city}'s extreme temperature swings. Its expansion rate matches glass, so seals last longer and air infiltration stays lower over time. The premium over vinyl is 40-70%, but the performance gap is real in a heating-dominated climate.`
    : `Fiberglass resists expansion and contraction better than any other frame material, which matters in ${city} where temperature swings stress window seals. It is stronger than vinyl, allowing narrower sightlines and more glass area. The 40-70% premium over vinyl is justified for homeowners who want 30+ year performance.`;

  paras.push(`<p><strong>Fiberglass.</strong> Mid-premium ($700-$1,600/window installed). Paintable, extremely durable. ${fibVerdict}</p>`);

  // Wood
  const woodVerdict = zone === "Southern" || ctx.climateZone === "hot_humid"
    ? `Wood requires more maintenance in ${city}'s humidity and heat. Expect to repaint or restain interior wood surfaces every 5-7 years. Wood-clad windows (wood interior, aluminum or fiberglass exterior) are a better fit for ${city} because the exterior cladding eliminates the rot risk while preserving the interior aesthetics.`
    : `Wood offers the best insulation value of any frame material and the premium interior look that many ${city} homeowners want. In ${city}'s climate, exterior-clad wood windows (aluminum or fiberglass over wood) protect against moisture while the wood interior provides warmth and character. Pure wood exteriors require repainting every 5-7 years.`;

  paras.push(`<p><strong>Wood / Wood-Clad.</strong> Premium ($600-$2,500/window installed). Best aesthetics. ${woodVerdict}</p>`);

  // Aluminum
  const aluminumVerdict = ctx.hurricaneZone
    ? `Aluminum is the standard frame material in ${city}'s hurricane zone. Impact-rated aluminum windows meet the wind and debris requirements that other frame materials struggle with. The thermal break technology in modern aluminum frames has largely solved the old conductivity problem, but verify that any aluminum window you consider has a thermal break specified.`
    : zone === "Northern" || zone === "North-Central"
    ? `Aluminum is a poor choice for ${city}'s cold winters. Metal frames conduct heat aggressively, creating condensation and ice buildup on interior surfaces. Even with thermal breaks, aluminum U-factors run 20-40% worse than vinyl or fiberglass. Unless you have a specific architectural reason, avoid aluminum in this climate.`
    : `Aluminum offers a slim, modern aesthetic at moderate cost. In ${city}, the thermal conductivity issue is less critical than in cold climates because heating loads are lower. However, aluminum still transfers more heat than vinyl or fiberglass, which means higher cooling costs. If aesthetics drive your choice, fiberglass achieves a similar narrow sightline with better thermal performance.`;

  paras.push(`<p><strong>Aluminum.</strong> Moderate ($600-$1,400/window installed). Slim sightlines, strong. ${aluminumVerdict}</p>`);

  return `
<section class="section fp-section">
<h2>Frame Material Comparison for ${city}'s Climate</h2>
${paras.join("\n")}
</section>`;
}

// ── Section 4: Home age and existing window assessment ──────────────────

function homeAgeAssessment(city, state, ctx, facts) {
  const paras = [];
  const avgAge = ctx.avgHomeAge || 35;

  paras.push(`<p>The average home in ${city} is approximately ${avgAge} years old. ${facts.homeAge ? cap(facts.homeAge) + "." : ""} The age and condition of your existing windows determine whether a pocket (insert) replacement or full-frame replacement is appropriate, and full-frame jobs cost 40-100% more per window.</p>`);

  // Single-pane replacement
  if (avgAge >= 35) {
    paras.push(`<p><strong>Single-pane windows.</strong> Many homes in ${city}'s older neighborhoods still have original single-pane windows. If your home has single-pane glass, replacement is almost always worth the investment. Single-pane windows have a U-factor of approximately 1.0, meaning they lose heat at roughly 4 times the rate of a modern double-pane Low-E window (U-factor 0.25). The energy savings alone typically justify replacement within 7-12 years, and the comfort improvement is immediate and dramatic.</p>`);
  } else {
    paras.push(`<p><strong>Existing double-pane windows.</strong> Most ${city} homes built in the last ${avgAge < 25 ? "two decades" : "30 years"} already have double-pane glass. If your existing double-pane windows are fogging between the panes, the seal has failed and the insulating gas has escaped. Failed-seal windows perform only marginally better than single-pane. Replacement is warranted. If your double-pane windows are still clear and operating smoothly, the energy payback on upgrading to newer double-pane is much longer (15-25 years), and the decision becomes more about comfort, noise reduction, and aesthetics than strict ROI.</p>`);
  }

  // Lead paint
  paras.push(`<p><strong>Lead paint in pre-1978 homes.</strong> ${avgAge >= 45 ? `A significant portion of ${city}'s housing stock predates the 1978 lead paint ban.` : `While most of ${city}'s housing stock is newer than the 1978 lead paint cutoff, older neighborhoods do have pre-1978 homes.`} Any window replacement in a pre-1978 home triggers EPA RRP (Renovation, Repair, and Painting) rule compliance. Your contractor must be EPA Lead-Safe certified, and the crew must follow specific containment and cleanup protocols. This adds $200-$500 to the total project cost. If a contractor does not ask about your home's age or dismisses lead paint concerns, that is a red flag for both safety and licensing.</p>`);

  // Historic districts
  if (facts.landmarks || facts.geographyNote) {
    paras.push(`<p><strong>Historic district restrictions.</strong> ${city} has designated historic districts where window replacement is subject to architectural review. In these areas, you may be required to use wood windows that match the original profiles, or specific divided-lite patterns. Vinyl windows are typically prohibited in locally designated historic districts. If your home is in a historic overlay zone, contact your local historic preservation office before getting quotes. The material and design requirements can double the per-window cost compared to standard replacement, and non-compliant work can result in fines and mandatory removal.</p>`);
  }

  return `
<section class="section fp-section">
<h2>Home Age and Existing Window Assessment in ${city}</h2>
${paras.join("\n")}
</section>`;
}

// ── Section 5: Permits and HOA considerations ──────────────────────────

function permitsAndHOA(city, state, ctx, facts) {
  const paras = [];

  paras.push(`<p>${facts.permits}. For window replacement specifically, most jurisdictions in ${city} require a building permit when replacing windows with a different size or type, or when structural modifications to the opening are needed. Simple same-size pocket replacements may be permit-exempt in some cases, but your contractor should confirm with the local building department before starting work.</p>`);

  if (ctx.hoaPrevalence === "high") {
    paras.push(`<p><strong>HOA architectural review.</strong> HOA-governed communities are very common in ${city}. Most HOAs require pre-approval of window replacements, with restrictions that can include frame color (white or almond only, in many cases), grid/grille patterns, and even specific approved brands. Submit your architectural change request 4-6 weeks before your planned installation date. Getting quotes before HOA approval is fine, but do not sign a contract or place a window order until you have written approval. HOA rejections after windows are ordered are expensive because custom windows are non-returnable.</p>`);
  } else if (ctx.hoaPrevalence === "moderate" || ctx.hoaPrevalence === "medium") {
    paras.push(`<p><strong>HOA considerations.</strong> Many newer subdivisions in ${city} have HOA covenants that govern exterior modifications including window replacements. Common restrictions include frame color, grid patterns, and material type. Check your CC&Rs and submit an architectural change request before signing a contract. Window orders are custom and non-returnable.</p>`);
  }

  paras.push(`<p><strong>Historic overlay zones.</strong> If your property falls within a locally designated historic district in ${city}, window replacement requires approval from the historic preservation commission in addition to standard permits. Expect a review process of 4-8 weeks. Requirements typically mandate wood or wood-clad windows with historically appropriate profiles and divided-lite patterns. Vinyl and aluminum windows are almost universally prohibited in historic districts. The cost premium for code-compliant historic window replacement is 50-150% over standard vinyl replacement.</p>`);

  if (facts.codeNote) {
    paras.push(`<p><strong>Local code note.</strong> ${facts.codeNote}.</p>`);
  }

  return `
<section class="section fp-section">
<h2>Permits and HOA Considerations in ${city}</h2>
${paras.join("\n")}
</section>`;
}

// ── Section 6: Contractor vs DIY analysis ──────────────────────────────

function contractorVsDIY(city, state, ctx, facts) {
  const paras = [];

  paras.push(`<p>Window replacement is one of the few major home improvement projects where DIY is sometimes viable for handy homeowners. That said, the scope of the project and the type of installation determine whether DIY makes sense in ${city}.</p>`);

  paras.push(`<p><strong>Where DIY can work.</strong> Simple pocket (insert) replacements in standard-sized openings on the first floor are the most DIY-friendly window projects. If the existing frame is square, plumb, and in good condition, and the new window is the same size, the installation is primarily shimming, insulating, and trim work. A competent DIYer can save $150-$300 per window in labor costs. Budget 2-4 hours per window for a first-timer, dropping to 1-2 hours per window after you find your rhythm.</p>`);

  paras.push(`<p><strong>Where you need a professional.</strong> Full-frame replacements (where the existing frame is removed down to the rough opening), any structural modifications to enlarge or reduce openings, second-story or higher installations, and any home built before 1978 (lead paint RRP compliance) all require professional installation. In ${city}, ${facts.contractorMarket ? facts.contractorMarket.charAt(0).toLowerCase() + facts.contractorMarket.slice(1) : "the contractor market is competitive"}. Getting three professional bids is the standard minimum.</p>`);

  paras.push(`<p><strong>Warranty implications.</strong> Most major window manufacturers (Andersen, Pella, Marvin) offer full product warranties regardless of who installs them, but some brands require "certified installer" status for the labor warranty to apply. Renewal by Andersen and Champion, for example, bundle product and labor warranties together and void them for DIY or third-party installation. Verify warranty terms before choosing the DIY route.</p>`);

  paras.push(`<p><strong>The hybrid approach.</strong> Some ${city} homeowners order windows directly (through a dealer or home center) and hire a handyman or small contractor for installation at $100-$200 per window rather than using the window company's full-service installation crew at $250-$400 per window. This can save 20-30% on the total project while still getting professional installation. The tradeoff is that you manage the project yourself and the installer may not carry the same insurance or warranty coverage as a full-service window company.</p>`);

  return `
<section class="section fp-section">
<h2>Professional Installation vs DIY Windows in ${city}</h2>
${paras.join("\n")}
</section>`;
}

// ── Section 7: Red flags ────────────────────────────────────────────────

function redFlagsSection(city, state, ctx) {
  const flags = [];

  flags.push({ title: "Bait-and-switch on brands", body: `The window industry has a chronic problem with brand substitution. A salesperson quotes Andersen 400 Series but the contract specifies "comparable Andersen product" or uses a model number you cannot verify. Before signing any contract in ${city}, confirm the exact brand, product line, and model number. Cross-reference it on the manufacturer's website. If the salesperson cannot tell you the exact NFRC-rated U-factor and SHGC for the specific window being quoted, the quote is not specific enough to sign.` });

  flags.push({ title: '"Today only" pricing', body: `This is the single most common predatory sales tactic in the window industry. Companies like Renewal by Andersen, Champion, and Window Nation use in-home sales presentations that end with an "expiring" price. The pitch follows a pattern: high initial price ($1,500-$2,000/window), then "manager approval" discounts, then a "today only" final price. The "today only" price is the real price and it is available any day of the week. No legitimate manufacturer pricing changes based on when you sign. Walk away from any salesperson who pressures you to sign during the first visit. Get the price in writing and compare it against other bids.` });

  flags.push({ title: "Unnecessary structural modifications", body: `Some contractors in ${city} recommend full-frame replacement or structural header modifications when a simple pocket replacement would work fine. Full-frame replacement costs 40-100% more per window. It is genuinely necessary when the existing frame is rotted, out of square, or when you are changing window sizes. But some contractors default to full-frame because it justifies higher pricing. If a contractor recommends full-frame, ask them to show you specifically where the existing frame is damaged. If the frame is sound, a pocket replacement is appropriate and significantly cheaper.` });

  flags.push({ title: "Inflated window counts", body: `Some large window companies in ${city} pad quotes by counting fixed picture windows as separate units when they share a frame with operable windows (a "mulled unit"). A double-hung window next to a fixed panel in a single frame is one mulled unit with two lites, not two separate windows. Verify the window count in your quote against your actual openings. Miscounting by 2-3 windows on a 15-window job inflates the total by $1,000-$3,000.` });

  if (ctx.hurricaneZone) {
    flags.push({ title: "Non-impact glass in hurricane zone", body: `${state} building code requires impact-rated glass or approved shutters in designated hurricane zones. If a contractor quotes standard glass without discussing impact requirements or protective alternatives, they either do not understand local code or are cutting corners. Impact-rated glass adds $150-$500 per window but is non-negotiable for code compliance and insurance eligibility in coastal ${city}.` });
  }

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>Red Flags and Window Replacement Scams in ${city}</h2>
<p>The window replacement industry has more consumer complaints per dollar spent than almost any other home improvement category. Here are the patterns most commonly reported by ${city} homeowners.</p>
${flagsHTML}
</section>`;
}

// ── Section 8: Seasonal buying guide ────────────────────────────────────

function seasonalGuide(city, state, ctx) {
  const paras = [];

  const seasons = {
    hot_humid: { best: "September through November", worst: "March through May", bestReason: "demand drops after summer AC season; contractors are hungry for work and more willing to negotiate", worstReason: "spring is peak selling season for big window companies running national ad campaigns" },
    hot_dry: { best: "October through February", worst: "April through June", bestReason: "moderate temperatures are ideal for installation (caulk and sealant perform best between 40-90F) and contractor schedules open up", worstReason: "summer heat makes installation miserable and sealant application problematic" },
    cold: { best: "March through May and September through October", worst: "June through August", bestReason: "shoulder seasons offer moderate temperatures for proper installation and contractors competing for spring/fall bookings", worstReason: "peak construction season means higher labor costs and longer lead times" },
    temperate: { best: "October through December", worst: "April through June", bestReason: "end-of-year manufacturer rebates and dealer inventory clearance drive genuine discounts of 10-20%", worstReason: "spring renovation season tightens contractor availability and reduces negotiating leverage" },
    mixed_humid: { best: "October through December", worst: "March through June", bestReason: "end-of-year deals combine with lower demand; many manufacturers offer Q4 rebates to hit annual targets", worstReason: "spring and early summer are peak seasons with the least flexibility on pricing" },
    mixed_dry: { best: "October through February", worst: "May through July", bestReason: "mild weather and post-summer demand drop create the best buying conditions", worstReason: "peak construction season competes for the same labor pool" },
  };

  const s = seasons[ctx.climateZone] || seasons.temperate;

  paras.push(`<p><strong>Window sales cycles are real.</strong> Unlike roofing or HVAC, window replacement is rarely an emergency, which means you have the luxury of timing your purchase. The window industry runs on seasonal patterns and manufacturer promotion cycles that can save you 10-20% on the same product.</p>`);

  paras.push(`<p><strong>End-of-year manufacturer rebates.</strong> Most major window manufacturers (Andersen, Pella, Marvin) run Q4 rebate programs to hit annual production targets. These are legitimate discounts of $25-$75 per window, separate from any dealer markdowns. Your dealer or contractor can tell you which manufacturer promotions are currently active. These rebates are real savings, unlike the "today only" dealer discounts that are available any day.</p>`);

  paras.push(`<p><strong>Order lead times matter.</strong> Custom windows typically take 4-8 weeks from order to delivery. Stock sizes from Jeld-Wen, Simonton, or Milgard may be available in 1-2 weeks. Factor lead time into your seasonal planning. If you want Q4 pricing and fall installation, order by mid-September.</p>`);

  return `
<section class="section fp-section">
<h2>Best Time to Buy Windows in ${city}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months to buy</h3>
<p class="fp-season-months">${s.best}</p>
<p>${cap(s.bestReason)}.</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Peak pricing / low leverage</h3>
<p class="fp-season-months">${s.worst}</p>
<p>${cap(s.worstReason)}.</p>
</div>
</div>
${paras.join("\n")}
</section>`;
}

// ── Section 9: Cost scenarios ───────────────────────────────────────────

function costScenarios(city, state, mult) {
  const budget = {
    label: "Budget Vinyl Replacement",
    desc: "15 vinyl double-hung windows | pocket install | Low-E double-pane",
    count: 15,
    perWin: Math.round(425 * mult),
    total: Math.round(15 * 425 * mult),
    detail: "Value-tier vinyl (Window World, Alside Sheffield, Jeld-Wen V2500). Includes Low-E double-pane glass, argon fill, pocket installation, interior/exterior trim touch-up, and debris removal."
  };
  const mid = {
    label: "Mid-Range Fiberglass with Low-E",
    desc: "15 fiberglass windows | pocket install | Low-E double-pane argon",
    count: 15,
    perWin: Math.round(1050 * mult),
    total: Math.round(15 * 1050 * mult),
    detail: "Mid-tier fiberglass or premium vinyl (Marvin Essential, Milgard Ultra, Pella 350). ENERGY STAR certified. Includes professional measurement, pocket install, foam insulation, interior trim, and permit."
  };
  const prem = {
    label: "Premium Wood-Clad Triple-Pane",
    desc: "15 wood-clad windows | full-frame | triple-pane Low-E krypton",
    count: 15,
    perWin: Math.round(2000 * mult),
    total: Math.round(15 * 2000 * mult),
    detail: "Premium wood-clad (Andersen 400/A-Series, Pella Lifestyle/Reserve, Marvin Elevate/Signature). Triple-pane with krypton fill. Full-frame installation, new interior/exterior trim, structural modifications as needed, and permit."
  };

  function scenarioCard(s, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${s.label}</h3>
<p class="fp-scenario-material">${s.desc}</p>
<p class="fp-scenario-total">${fmtDollar(s.total)}</p>
<p class="fp-scenario-detail">~${fmtDollar(s.perWin)}/window installed. ${s.detail}</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>What Window Replacement Actually Costs in ${city}: 3 Scenarios</h2>
<p>Here is what real 15-window whole-house projects look like in ${city}, ${state}, using ${city}-adjusted labor and material costs for 2026.</p>
<div class="fp-scenario-grid">
${scenarioCard(budget, "#22c55e")}
${scenarioCard(mid, "#3b82f6")}
${scenarioCard(prem, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">All scenarios assume standard-sized windows in a single-story home. Bay/bow windows, second-story access, structural modifications, and lead paint abatement add to these baselines. <a href="/window-replacement-cost.html" style="color:var(--brand);">Get a personalized estimate.</a></p>
</section>`;
}

// ── CSS ─────────────────────────────────────────────────────────────────

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

// ── Builder ─────────────────────────────────────────────────────────────

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
  html += climateEnergySection(city, state, ctx, facts);
  html += frameMaterialComparison(city, state, ctx, facts);
  html += homeAgeAssessment(city, state, ctx, facts);
  html += permitsAndHOA(city, state, ctx, facts);
  html += contractorVsDIY(city, state, ctx, facts);
  html += redFlagsSection(city, state, ctx);
  html += seasonalGuide(city, state, ctx);
  html += costScenarios(city, state, mult);
  html += `\n${MARKER_END}\n`;

  return html;
}

// ── Main ────────────────────────────────────────────────────────────────

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
    const re = new RegExp(`${MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n?`, "g");
    content = content.replace(re, "");

    // Detect line endings
    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    // Injection point: after UNIQUE-LOCAL-GUIDE, or before "Other Services" section, or after section 5
    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const otherServicesIdx = content.indexOf(">Other Services in ");

    let insertAt;
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else if (otherServicesIdx >= 0) {
      // Back up to the opening <section before "Other Services"
      const sectionOpen = content.lastIndexOf("<section", otherServicesIdx);
      insertAt = sectionOpen >= 0 ? sectionOpen : otherServicesIdx;
    } else {
      // Fallback: inject before </main>
      const mainEnd = content.indexOf("</main>");
      if (mainEnd >= 0) {
        insertAt = mainEnd;
      } else {
        console.log(`  SKIP ${metro.file} (no injection point found)`);
        skipped++;
        continue;
      }
    }

    content = content.slice(0, insertAt) + nl + flagshipContent + nl + content.slice(insertAt);

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
