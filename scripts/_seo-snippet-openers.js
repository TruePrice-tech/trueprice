#!/usr/bin/env node
/**
 * Inject hand-crafted featured-snippet openers into 16 home-services vertical
 * guide pages. Each opener is a 40-55 word paragraph that directly answers
 * the primary query for that vertical ("how much does X cost"), includes
 * specific price ranges consistent with the page's own cost tables, and is
 * structured for Google featured-snippet extraction.
 *
 * Placement: inside the hero, immediately after the existing intro <p>,
 * before the </div></div> that closes the hero. This keeps it above the
 * fold and ahead of the chart that comes later.
 *
 * NOT applied to medical/legal/moving/auto-repair guides — those verticals
 * require more careful framing with disclaimers that these plain-prose
 * openers don't include.
 *
 * Idempotent — skips pages that already have class="tp-snippet".
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const OPENERS = [
  {
    file: 'hvac-cost.html',
    opener: 'HVAC replacement costs $3,700 to $11,500 for a typical 2,000 sq ft home in 2026. Central AC runs $4,500 to $8,500, heat pumps run $5,200 to $10,000, and a full AC + gas furnace system averages $7,500 to $15,000. Prices include equipment, labor, permits, and standard scope.',
  },
  {
    file: 'roof-cost-by-house-size.html',
    opener: 'Roof replacement costs $7,000 to $35,000 depending on house size and material. A 1,700 to 2,200 sq ft home runs $9,000 to $16,000 with asphalt shingles, or $15,000 to $30,000 with standing-seam metal. Prices include tear-off, underlayment, flashing, and disposal.',
  },
  {
    file: 'plumbing-cost.html',
    opener: 'Plumbing work costs $450 to $8,500 depending on scope. Minor repairs run $150 to $450, water heater replacement averages $1,200 to $3,500, and a whole-home repipe costs $4,500 to $9,500 for PEX or $8,000 to $18,000 for copper. Plumber hourly rates average $85 to $185 in 2026.',
  },
  {
    file: 'electrical-cost.html',
    opener: 'Electrical work costs $200 to $14,800 depending on scope. Small repairs run $200 to $500, panel upgrades average $2,500 to $4,500, and full home rewiring costs $5,000 to $15,000. Licensed electricians charge $75 to $150 per hour plus permits in 2026.',
  },
  {
    file: 'solar-cost.html',
    opener: 'Residential solar costs $12,500 to $30,000 before incentives for a 10 kW system. After the 30% federal tax credit, net cost runs $8,750 to $21,000. Per-watt pricing averages $2.50 to $3.50 for rooftop and $2.90 to $4.20 for ground-mount arrays. 2026 prices.',
  },
  {
    file: 'concrete-cost.html',
    opener: 'Concrete work costs $4,500 to $9,500 for a typical driveway. Poured concrete averages $6 to $12 per square foot, and stamped concrete runs $12 to $20 per square foot. Patios and sidewalks follow similar per-square-foot pricing, with labor making up 45% to 60% of the total.',
  },
  {
    file: 'painting-cost.html',
    opener: 'House painting costs $2,000 to $10,500. Interior painting averages $2 to $6 per square foot of floor area. Exterior painting runs $3 to $7 per square foot of wall area, or $5,000 to $10,200 for a typical 2,000 sq ft home in 2026. Labor is 70% to 85% of the total.',
  },
  {
    file: 'fence-cost.html',
    opener: 'Fence installation costs $4,000 to $11,500 for a typical backyard. Wood fencing averages $15 to $35 per linear foot, vinyl runs $25 to $40 per linear foot, and chain-link costs $8 to $18 per linear foot. Prices include posts, panels, gates, and standard installation in 2026.',
  },
  {
    file: 'foundation-repair-cost.html',
    opener: 'Foundation repair costs $500 to $26,000 depending on damage severity. Minor crack repair runs $500 to $1,500. Pier installation averages $1,800 to $3,000 per pier, with 6 to 12 piers typical per project. Full underpinning ranges $15,000 to $26,000. Most homeowners spend $5,000 to $10,000.',
  },
  {
    file: 'siding-cost.html',
    opener: 'Siding installation costs $6,000 to $21,000 for a typical home. Vinyl siding runs $4 to $9 per square foot, fiber cement (HardiePlank) runs $8 to $16 per square foot, and engineered wood runs $6 to $13 per square foot. Prices include removal, underlayment, trim, and disposal.',
  },
  {
    file: 'window-replacement-cost.html',
    opener: 'Window replacement costs $6,000 to $18,000 for a typical home. Vinyl windows average $400 to $800 installed per window, fiberglass runs $600 to $1,200, and wood-clad runs $900 to $1,600. Most homes need 10 to 15 windows replaced, with installation labor averaging $100 to $250 per window.',
  },
  {
    file: 'insulation-cost.html',
    opener: 'Insulation costs $1,200 to $5,200 for a typical home. Blown-in cellulose averages $1 to $2 per square foot of attic, spray foam runs $2 to $5 per square foot, and fiberglass batts run $0.70 to $1.50 per square foot. Most homeowners see $100 to $350 in annual energy savings.',
  },
  {
    file: 'gutters-cost.html',
    opener: 'Gutter installation costs $900 to $1,400 for a typical home. Aluminum gutters average $7 to $14 per linear foot installed, vinyl runs $5 to $9 per linear foot, and copper runs $25 to $45 per linear foot. Gutter guards add $5 to $10 per linear foot. Most homes need 150 to 250 linear feet.',
  },
  {
    file: 'landscaping-cost.html',
    opener: 'Landscaping costs $6,000 to $12,000 for basic design and installation. New sod runs $0.35 to $0.85 per square foot, mulch and plants add $3,000 to $8,000, and hardscape features like walkways and retaining walls add $15 to $50 per square foot. Full property design projects often exceed $20,000.',
  },
  {
    file: 'kitchen-remodel-cost.html',
    opener: 'Kitchen remodel costs $19,000 to $75,000+ for most projects. Minor remodels (cabinet refacing, countertops, backsplash) average $19,000 to $30,000. Mid-range full remodels run $30,000 to $60,000. Upscale remodels with custom cabinets exceed $75,000. Labor is 30% to 40% of the budget.',
  },
  {
    file: 'garage-door-cost.html',
    opener: 'Garage door costs $950 to $4,000 installed. Single-car doors average $950 to $1,800, double-car doors run $1,500 to $3,500, and custom wood or high-end insulated doors exceed $4,000. Opener installation adds $250 to $650. Labor averages $200 to $400 per door in 2026.',
  },
];

let injected = 0;
let skippedHas = 0;
let skippedMissing = 0;
let skippedNoHero = 0;

for (const { file, opener } of OPENERS) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) { skippedMissing++; console.log('  missing:', file); continue; }

  const html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('class="tp-snippet"')) { skippedHas++; continue; }

  // Find the hero closure. Pattern: closing </h1>, optional whitespace, an
  // existing intro <p>...</p>, then the hero container closes with </div></div>.
  // We inject right after the existing intro <p>, before the </div></div>.
  const heroCloseRe = /(<h1[^>]*>[\s\S]*?<\/h1>\s*<p[^>]*>[\s\S]*?<\/p>)(\s*<\/div>\s*<\/div>)/;
  const m = html.match(heroCloseRe);
  if (!m) { skippedNoHero++; console.log('  no hero match:', file); continue; }

  const snippetP = `\n<p class="tp-snippet" style="margin-top:16px; font-size:15px; line-height:1.6; color:var(--text-secondary);">${opener}</p>`;
  // Use function replacement — string replacement would interpret "$10,000"
  // or "$11,500" in the opener as backreferences ($1 → capture group 1).
  const updated = html.replace(heroCloseRe, (_, g1, g2) => g1 + snippetP + g2);
  fs.writeFileSync(filePath, updated, 'utf8');
  injected++;
}

console.log('Snippet openers injected:', injected);
console.log('Skipped (already had):', skippedHas);
console.log('Skipped (missing file):', skippedMissing);
console.log('Skipped (no hero structure):', skippedNoHero);
