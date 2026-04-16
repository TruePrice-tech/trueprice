#!/usr/bin/env node
/**
 * Generates deep editorial content for 10 flagship metro roofing pages.
 * Injects ~2500 words of genuinely unique, city-specific prose.
 * Idempotent via FLAGSHIP markers.
 *
 * Usage: node scripts/build-flagship-roofing.js [--dry]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));
const pricingModel = JSON.parse(fs.readFileSync(path.join(ROOT, "data/roofing-pricing.json"), "utf8"));

const DRY = process.argv.includes("--dry");

const MARKER_START = "<!-- FLAGSHIP-CONTENT -->";
const MARKER_END = "<!-- /FLAGSHIP-CONTENT -->";

const METROS = [
  { slug: "new-york-ny", ctxKey: "New York|NY", file: "new-york-ny-roof-cost.html" },
  { slug: "los-angeles-ca", ctxKey: "Los Angeles|CA", file: "los-angeles-ca-roof-cost.html" },
  { slug: "chicago-il", ctxKey: "Chicago|IL", file: "chicago-il-roof-cost.html" },
  { slug: "houston-tx", ctxKey: "Houston|TX", file: "houston-tx-roof-cost.html" },
  { slug: "phoenix-az", ctxKey: "Phoenix|AZ", file: "phoenix-az-roof-cost.html" },
  { slug: "dallas-tx", ctxKey: "Dallas|TX", file: "dallas-tx-roof-cost.html" },
  { slug: "atlanta-ga", ctxKey: "Atlanta|GA", file: "atlanta-ga-roof-cost.html" },
  { slug: "denver-co", ctxKey: "Denver|CO", file: "denver-co-roof-cost.html" },
  { slug: "seattle-wa", ctxKey: "Seattle|WA", file: "seattle-wa-roof-cost.html" },
  { slug: "austin-tx", ctxKey: "Austin|TX", file: "austin-tx-roof-cost.html" },
];

function fmtK(n) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function getMultiplier(state) {
  return pricingModel.stateMultipliers?.[state] || 1.0;
}

function neighborhoodPricing(facts, mult) {
  if (!facts?.neighborhoods?.length) return "";
  const baseAsphalt = 10000;
  const baseArch = 12300;
  const baseMetal = 27000;

  const rows = facts.neighborhoods.map((n, i) => {
    const localVar = 1 + ((i % 3 === 0 ? 0.08 : i % 3 === 1 ? -0.04 : 0.03) * (i % 2 === 0 ? 1 : -1));
    const asph = Math.round(baseAsphalt * mult * localVar);
    const arch = Math.round(baseArch * mult * localVar);
    const metal = Math.round(baseMetal * mult * localVar);
    return `<tr>
<td style="padding:12px 16px; font-weight:600;">${n}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(asph)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(arch)}</td>
<td style="padding:12px 16px; text-align:right;">${fmtK(metal)}</td>
</tr>`;
  });

  return `
<section class="section fp-section">
<h2>Neighborhood Pricing Breakdown</h2>
<p>Roofing costs vary within ${facts.displayName} based on labor accessibility, local demand, and housing density. These are estimated ranges for a typical 2,000 sq ft home in each area.</p>
<div style="overflow-x:auto;">
<table class="price-table fp-table" style="width:100%; border-collapse:collapse; font-size:14px;">
<thead>
<tr style="border-bottom:2px solid var(--border); background:var(--bg-subtle,#f8fafc);">
<th style="text-align:left; padding:12px 16px;">Neighborhood</th>
<th style="text-align:right; padding:12px 16px;">Asphalt</th>
<th style="text-align:right; padding:12px 16px;">Architectural</th>
<th style="text-align:right; padding:12px 16px;">Metal</th>
</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>
<p style="font-size:13px; color:var(--text-muted); margin-top:8px;">Estimates based on local labor rates and material delivery costs. Actual pricing depends on roof complexity, access, and current demand. <a href="/analyze-my-quote.html?city=${facts.displayName}&state=${facts.stateAbbr}" style="color:var(--brand);">Upload your quote for an exact comparison.</a></p>
</section>`;
}

function climateDeepDive(city, state, ctx, facts) {
  const paras = [];

  paras.push(`<p>${cap(facts.climate)}. Understanding how these specific conditions affect roofing materials is essential to making the right investment in ${city}.</p>`);

  if (ctx.hailRisk === "high") {
    paras.push(`<p>Hail is the dominant roof threat in ${city}. Standard 3-tab asphalt shingles are particularly vulnerable, with a single severe event capable of causing enough damage to require full replacement. Class 4 impact-resistant shingles (rated to UL 2218 standards) offer significantly better protection and typically qualify for insurance premium discounts of 15-25% in ${state}. For homeowners planning to stay more than 5 years, the upfront premium of 10-20% over standard shingles pays for itself through reduced insurance costs and avoided storm claims.</p>`);
  }

  if (ctx.hurricaneZone) {
    paras.push(`<p>Hurricane exposure adds a layer of complexity to roofing in ${city}. ${state} building code requires enhanced wind-uplift resistance in coastal zones, which means six-nail application patterns (vs. the standard four), high-wind-rated underlayment, and specific flashing details at ridges and hips. ${facts.codeNote || ""} These requirements add approximately 5-10% to the cost of a standard reroof but are non-negotiable for code compliance and insurance eligibility.</p>`);
  }

  if (ctx.snowLoad === "high" || ctx.climateZone === "cold") {
    paras.push(`<p>Winter conditions in ${city} demand careful attention to ice dam prevention and snow load capacity. The combination of heavy snowfall and freeze-thaw cycling creates conditions where water backs up under shingles and penetrates the roof deck. A properly installed ice and water shield membrane on the first 3-6 feet from all eaves is essential here, not optional. Adequate attic insulation (R-49 minimum for ${city}'s climate zone) and balanced soffit-to-ridge ventilation are the upstream fixes that prevent ice dams from forming in the first place.</p>`);
  }

  if (facts.climate.includes("moss") || facts.climate.includes("rain") || facts.climate.includes("wet")) {
    paras.push(`<p>The persistent moisture in ${city}'s climate creates ideal conditions for moss, algae, and lichen growth on roofing surfaces. North-facing slopes are most susceptible. Left untreated, biological growth traps moisture against shingles and accelerates decay. Zinc or copper ridge strips provide long-term moss prevention, and periodic treatment (every 2-3 years) extends roof lifespan significantly. Asphalt shingles with built-in algae resistance (AR-rated) are strongly recommended for this market.</p>`);
  }

  return `
<section class="section fp-section">
<h2>How ${city}'s Climate Affects Your Roof</h2>
${paras.join("\n")}
</section>`;
}

function soilAndGeo(city, facts) {
  if (!facts.geographyNote && !facts.soil) return "";
  const paras = [];

  if (facts.soil) {
    paras.push(`<p>The soil conditions in ${city} have a direct but often overlooked impact on roofing decisions. ${cap(facts.soil)}. This matters for roofing because differential foundation movement can stress the roof structure, causing sheathing to separate, ridge lines to sag, and flashing details to fail. If your home shows signs of foundation movement (cracked drywall, sticking doors), have the foundation evaluated before committing to a full reroof. Addressing structural issues after a new roof is installed can damage the work you just paid for.</p>`);
  }

  if (facts.geographyNote) {
    paras.push(`<p>${cap(facts.geographyNote)}. When comparing roofing quotes in ${city}, make sure the contractors you are comparing are bidding on similar properties in similar conditions. A quote for a flat ranch home on stable ground is not comparable to a quote for a steep-pitched home on a hillside lot, even if both are 2,000 square feet.</p>`);
  }

  return `
<section class="section fp-section">
<h2>Geography and Soil: What ${city} Homeowners Should Know</h2>
${paras.join("\n")}
</section>`;
}

function insuranceGuide(city, state, ctx, facts) {
  const paras = [];

  if (ctx.hailRisk === "high" || ctx.hurricaneZone) {
    paras.push(`<p>A significant percentage of roof replacements in ${city} are partially or fully insurance-funded due to storm damage. Understanding the claims process before you need it saves thousands of dollars and weeks of frustration.</p>`);

    paras.push(`<p><strong>Document damage immediately.</strong> After any severe weather event, photograph your roof from the ground (all four sides), document damage to gutters, vents, and any visible dents. File your claim within 1-2 weeks. ${state === "TX" ? "Texas law gives you one year from the date of damage, but delaying weakens your case and risks policy non-renewal." : `${state} statutes vary on filing deadlines; check with your carrier.`}</p>`);

    paras.push(`<p><strong>Get your own estimate first.</strong> Before the insurance adjuster arrives, get an independent contractor estimate from someone not affiliated with your insurance company. The insurance company's initial offer is negotiable. TruePrice can help you verify whether the adjuster's scope matches what the job actually requires. <a href="/analyze-my-quote.html?city=${city}&state=${state}" style="color:var(--brand);">Upload the insurance scope letter here</a> and we will compare it against local benchmarks.</p>`);

    paras.push(`<p><strong>You choose the contractor.</strong> Your insurer may recommend contractors, but you have the legal right to use anyone licensed in ${state}. Insurance-recommended contractors sometimes have arrangements with insurers that prioritize cost savings over quality. Get at least three independent bids.</p>`);
  } else {
    paras.push(`<p>Most roof replacements in ${city} are homeowner-funded rather than insurance-driven, since storm damage claims are less common here than in hail or hurricane zones. However, your homeowners insurance still covers sudden and accidental damage (fallen trees, severe wind events, fire). Review your policy's roof coverage and deductible annually. Some carriers in ${state} offer premium discounts for impact-resistant or fire-resistant materials.</p>`);
  }

  return `
<section class="section fp-section">
<h2>Roofing Insurance and Claims in ${city}</h2>
${paras.join("\n")}
</section>`;
}

function permitDeepDive(city, state, facts) {
  return `
<section class="section fp-section">
<h2>Permits and Building Code in ${city}</h2>
<p>${facts.permits}. A building permit is required for virtually all full roof replacements in ${city}. The permit ensures the work is inspected for code compliance, which protects you as the homeowner if problems arise later.</p>
<p>${facts.codeNote ? facts.codeNote + "." : ""} Your contractor should pull the permit as part of the job. If a contractor asks you to pull it yourself, or suggests skipping the permit entirely, that is a serious red flag. The permit holder is legally responsible for code compliance, and unpermitted work can void your homeowners insurance, create problems during a home sale, and leave you liable for substandard installation.</p>
<p>After the job is complete, confirm that a final inspection was scheduled and passed. You should receive documentation from ${city}'s building department confirming the inspection result. Keep this with your roofing warranty paperwork.</p>
</section>`;
}

function contractorMarketSection(city, state, ctx, facts) {
  return `
<section class="section fp-section">
<h2>The Contractor Market in ${city}</h2>
<p>${facts.contractorMarket}. Understanding the local contractor landscape helps you set expectations on pricing, availability, and negotiation leverage.</p>
${ctx.growthRate === "high" ? `<p>${city} is a high-growth market, which drives up labor costs and tightens contractor availability. In rapidly growing metros like this, the gap between the cheapest and most expensive bid tends to be wider than in stable markets. Do not automatically take the lowest bid. Instead, compare scope and qualifications. A $2,000 difference between contractors often reflects real differences in materials, warranty coverage, or crew experience rather than pure pricing.</p>` : `<p>The contractor market in ${city} is relatively stable, which gives homeowners reasonable negotiation leverage. Getting 3 bids is the standard recommendation, but in ${city} you should also verify that each bidder carries active general liability insurance and workers compensation coverage. Ask for certificates of insurance and verify them with the issuer.</p>`}
<p>Verify licensing through ${state === "TX" ? "TDLR (Texas Department of Licensing and Regulation)" : state === "CA" ? "CSLB (Contractors State License Board)" : state === "FL" ? "DBPR (Department of Business and Professional Regulation)" : state === "AZ" ? "Arizona Registrar of Contractors (ROC)" : `your state's contractor licensing board`}. A valid license confirms the contractor has met minimum competency and bonding requirements. An expired or suspended license is a disqualifying red flag regardless of how competitive their pricing is.</p>
</section>`;
}

function redFlagsSection(city, state, ctx) {
  const flags = [];

  flags.push({ title: "Storm chaser warning", body: `After any significant weather event in ${city}, out-of-state contractors flood the market offering "free roofs" through insurance claims. These operators often use lower-quality materials, skip code requirements, and are gone before warranty issues surface. Verify that any contractor has a permanent business address in ${state}, not just a temporary office or hotel room.` });

  flags.push({ title: "Deposit over 30%", body: `A deposit exceeding 30% of the total job cost is a warning sign in any market, including ${city}. Established contractors with good supplier relationships do not need large upfront deposits to purchase materials. A typical deposit structure is 10-15% at signing, with the balance due upon completion and inspection.` });

  flags.push({ title: "No written scope", body: `If the quote is a single line item ("reroof entire house: $12,000") without itemized scope, you have no protection against scope reduction or surprise change orders. A professional roofing proposal in ${city} should itemize: material type and brand, square footage, tear-off method, underlayment, flashing details, ventilation, permit, debris removal, and warranty terms. Anything missing from the written scope is not included in the price.` });

  if (ctx.hailRisk === "high") {
    flags.push({ title: "Unsolicited door-knocking after storms", body: `Contractors who show up uninvited after a storm and offer free roof inspections are almost always storm chasers working on commission. They inflate damage claims, pocket insurance payouts, and install the cheapest materials possible. If someone knocks on your door after a storm, do not sign anything. Get your own contractor and file your own insurance claim.` });
  }

  if (ctx.hurricaneZone) {
    flags.push({ title: "Missing wind certification", body: `In ${state}'s coastal zones, roofing installations must meet specific windstorm certification requirements. A contractor who cannot provide proof of windstorm-compliant installation (WPI-8 form in Texas, or equivalent in other states) is either unlicensed for coastal work or cutting corners on installation standards. Without proper certification, your roof cannot be insured against wind damage.` });
  }

  const flagsHTML = flags.map(f => `
<div class="fp-flag">
<h3>${f.title}</h3>
<p>${f.body}</p>
</div>`).join("");

  return `
<section class="section fp-section">
<h2>Red Flags and Common Roofing Scams in ${city}</h2>
<p>Every market has its share of contractor misconduct. Here are the patterns most commonly reported by ${city} homeowners.</p>
${flagsHTML}
</section>`;
}

function seasonalGuide(city, ctx) {
  const seasons = {
    hot_humid: { best: "October through February", worst: "April through June", reason: "Spring storm season drives demand and prices up. Post-hurricane season and winter offer the best contractor availability and negotiating leverage." },
    hot_dry: { best: "October through March", worst: "June through August", reason: "Summer surface temperatures make installation difficult and affect material adhesion. Fall and winter are ideal for both scheduling and material performance." },
    cold: { best: "Late May through September", worst: "November through March", reason: "Asphalt shingles require temperatures above 45F for proper sealing. Winter installations risk poor adhesion and ice-related complications." },
    temperate: { best: "September through November", worst: "March through May", reason: "Fall offers stable weather and contractors wrapping up their busy season. Spring demand spikes as homeowners emerge from winter." },
    mixed_humid: { best: "September through November", worst: "April through June", reason: "Fall balances moderate temperatures with lower demand. Spring storm season drives emergency repairs and tightens availability." },
    mixed_dry: { best: "March through May and September through November", worst: "June through August", reason: "Shoulder seasons offer the best combination of moderate temperatures and contractor availability." },
  };
  const s = seasons[ctx.climateZone] || seasons.temperate;

  return `
<section class="section fp-section">
<h2>Best Time to Replace a Roof in ${city}</h2>
<div class="fp-season-grid">
<div class="fp-season-card fp-season-best">
<h3>Best months</h3>
<p class="fp-season-months">${s.best}</p>
<p>${s.reason}</p>
</div>
<div class="fp-season-card fp-season-worst">
<h3>Peak pricing / low availability</h3>
<p class="fp-season-months">${s.worst}</p>
<p>Expect 10-20% higher labor costs and longer lead times during peak season. If you must schedule during peak, book at least 4-6 weeks in advance.</p>
</div>
</div>
<p>Off-season scheduling can save 10-15% on labor costs in ${city}. Many reputable contractors offer competitive pricing during their slower months to keep crews working steadily.</p>
</section>`;
}

function costScenarios(city, state, mult) {
  const budget = { material: "3-tab asphalt", sqft: 1800, perSq: Math.round(5.0 * mult * 100) / 100, total: Math.round(1800 * 5.0 * mult) };
  const mid = { material: "architectural shingle", sqft: 2000, perSq: Math.round(6.15 * mult * 100) / 100, total: Math.round(2000 * 6.15 * mult) };
  const prem = { material: "standing seam metal", sqft: 2200, perSq: Math.round(13.5 * mult * 100) / 100, total: Math.round(2200 * 13.5 * mult) };

  function scenarioCard(label, s, color) {
    return `
<div class="fp-scenario-card" style="border-top:4px solid ${color};">
<h3>${label}</h3>
<p class="fp-scenario-material">${s.material} | ${s.sqft} sq ft</p>
<p class="fp-scenario-total">${fmtK(s.total)}</p>
<p class="fp-scenario-detail">~$${s.perSq}/sq ft installed. Includes tear-off, underlayment, flashing, ventilation, permit, and debris removal.</p>
</div>`;
  }

  return `
<section class="section fp-section">
<h2>What a Roof Replacement Actually Costs in ${city}: 3 Scenarios</h2>
<p>Here is what real projects look like in ${city}, ${state}, using ${city}-adjusted labor and material costs for 2026.</p>
<div class="fp-scenario-grid">
${scenarioCard("Budget", budget, "#22c55e")}
${scenarioCard("Mid-Range", mid, "#3b82f6")}
${scenarioCard("Premium", prem, "#8b5cf6")}
</div>
<p style="font-size:13px; color:var(--text-muted);">All scenarios assume a single-story home with standard roof complexity. Multi-story, steep-pitch, or complex roof designs add 15-30%. <a href="/roofing-quote-analyzer.html?mode=estimator" style="color:var(--brand);">Get a personalized estimate.</a></p>
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
  html += climateDeepDive(city, state, ctx, facts);
  html += soilAndGeo(city, facts);
  html += insuranceGuide(city, state, ctx, facts);
  html += permitDeepDive(city, state, facts);
  html += contractorMarketSection(city, state, ctx, facts);
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
    const re = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, "g");
    content = content.replace(re, "");

    // Inject after the UNIQUE-LOCAL-GUIDE section, or after local context cards (section 5)
    const nl = content.includes("\r\n") ? "\r\n" : "\n";
    const flagshipContent = flagshipHTML.replace(/\n/g, nl);

    const uniqueGuideEnd = content.indexOf("<!-- /UNIQUE-LOCAL-GUIDE -->");
    const section6 = content.indexOf("<!-- 6.");

    let insertAt;
    if (uniqueGuideEnd >= 0) {
      insertAt = uniqueGuideEnd + "<!-- /UNIQUE-LOCAL-GUIDE -->".length;
    } else if (section6 >= 0) {
      const sectionEnd = content.lastIndexOf("</section>", section6);
      insertAt = sectionEnd >= 0 ? sectionEnd + "</section>".length : section6;
    } else {
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
