/**
 * Page templates for long-tail content generation. Four templates matched to
 * four intent/structure patterns detected by cluster-and-intent.js:
 *
 *   table-led      — cost queries ("how much does X cost"): lead with price
 *                    table, then breakdown, then FAQ
 *   decision       — should-I / when-to queries: lead with "it depends" frame
 *                    + decision factors + scenarios
 *   comparison     — X vs Y queries: lead with side-by-side table + winner
 *                    scenarios
 *   transactional  — analyzer/calculator/tool queries: direct CTA to the
 *                    existing Woogoro tool, minimal prose
 *
 * Each template returns a full HTML string. Input: { cluster, verticalCtx }.
 *
 * verticalCtx supplies per-vertical content (price ranges, related pages,
 * analyzer URL, common scope items) from data/ files.
 */

const VERTICAL_CONTEXT = {
  'hvac': {
    label: 'HVAC',
    nationalLow: 3700, nationalHigh: 11500,
    analyzer: '/hvac-quote-analyzer.html',
    guide: '/hvac-cost.html',
    scopeItems: ['equipment', 'labor', 'permits', 'disposal of old unit', 'start-up and calibration', 'basic duct adjustments'],
    commonVariants: ['central AC ($4,500-$8,500)', 'heat pump ($5,200-$10,000)', 'gas furnace ($3,500-$5,500)', 'full AC+furnace ($7,500-$15,000)'],
    pricingBasis: 'size of system (tonnage), efficiency (SEER2 rating), and whether ductwork already exists',
    redFlags: ['deposits over 30%', 'refrigerant or permit fees "TBD"', 'vague model numbers', 'missing manufacturer warranty details'],
  },
  'roof': {
    label: 'Roof replacement',
    nationalLow: 9000, nationalHigh: 30000,
    analyzer: '/roofing-quote-analyzer.html',
    guide: '/roof-cost-by-house-size.html',
    scopeItems: ['tear-off of old roofing', 'underlayment', 'flashing', 'ice/water shield', 'ridge vents', 'disposal'],
    commonVariants: ['asphalt shingles ($9,000-$16,000)', 'architectural shingles ($12,000-$22,000)', 'standing-seam metal ($15,000-$30,000)', 'tile ($20,000-$45,000)'],
    pricingBasis: 'square footage of roof (usually 1.2× house sq ft), material chosen, and complexity of the roofline',
    redFlags: ['no tear-off line item', 'flashing excluded', 'underlayment not specified', 'warranty from contractor under 5 years'],
  },
  'plumbing': {
    label: 'Plumbing',
    nationalLow: 450, nationalHigh: 8500,
    analyzer: '/plumbing-quote-analyzer.html',
    guide: '/plumbing-cost.html',
    scopeItems: ['labor time', 'materials (pipe, fittings, fixtures)', 'permits if applicable', 'disposal of old materials', 'pressure testing'],
    commonVariants: ['minor repairs ($150-$450)', 'water heater replacement ($1,200-$3,500)', 'whole-home PEX repipe ($4,500-$9,500)', 'whole-home copper repipe ($8,000-$18,000)'],
    pricingBasis: 'whether the job is a repair, a replacement, or a full repipe, plus material choice (PEX vs copper) and accessibility of existing pipes',
    redFlags: ['hourly rate without cap', 'no parts itemization', 'deposits over 30%', '"upon arrival" diagnostic fee without credit'],
  },
  'electrical': {
    label: 'Electrical work',
    nationalLow: 200, nationalHigh: 14800,
    analyzer: '/electrical-quote-analyzer.html',
    guide: '/electrical-cost.html',
    scopeItems: ['permits', 'inspection', 'materials (wire, breakers, panel)', 'drywall repair if opened', 'labor'],
    commonVariants: ['small repair ($200-$500)', 'panel upgrade ($2,500-$4,500)', 'full home rewiring ($5,000-$15,000)', 'EV charger install ($600-$2,500)'],
    pricingBasis: 'amp rating of any panel work, linear feet of wire run, number of circuits, and local permit requirements',
    redFlags: ['permits not included', 'no inspection line', '"handyman" labor rate for licensed electrical', 'drywall repair quoted separately without estimate'],
  },
  'solar': {
    label: 'Solar',
    nationalLow: 12500, nationalHigh: 30000,
    analyzer: '/solar-quote-analyzer.html',
    guide: '/solar-cost.html',
    scopeItems: ['panels', 'inverter', 'racking/mounting', 'electrical interconnect', 'permits', 'monitoring hardware'],
    commonVariants: ['6 kW rooftop ($15,000-$22,000)', '10 kW rooftop ($25,000-$35,000)', '10 kW ground-mount ($29,000-$42,000)', 'after 30% federal tax credit: 30% lower'],
    pricingBasis: 'system size in kW, panel efficiency tier, roof or ground mount, and any battery storage added',
    redFlags: ['inflated production estimates', 'panel warranty mismatch with workmanship warranty', 'dealer-fee add-ons hidden in financing', 'true cost vs financed cost buried'],
  },
  'concrete': {
    label: 'Concrete work',
    nationalLow: 1500, nationalHigh: 12000,
    analyzer: '/concrete-quote-analyzer.html',
    guide: '/concrete-cost.html',
    scopeItems: ['excavation/grading', 'forms', 'reinforcement (rebar/wire mesh)', 'concrete', 'finishing (broom/trowel/stamped)', 'curing and cleanup'],
    commonVariants: ['basic driveway ($4,500-$9,500)', 'stamped driveway ($7,000-$15,000)', 'patio ($2,500-$8,000)', 'per sq ft: $6-$12 poured, $12-$20 stamped'],
    pricingBasis: 'square footage, thickness, reinforcement, finish type, and site prep needed',
    redFlags: ['no rebar/mesh line item', 'thickness not specified', 'no expansion joints called out', 'curing/sealing excluded'],
  },
  'painting': {
    label: 'House painting',
    nationalLow: 2000, nationalHigh: 10500,
    analyzer: '/painting-quote-analyzer.html',
    guide: '/painting-cost.html',
    scopeItems: ['prep (wash, scrape, sand)', 'primer', 'two coats of paint', 'drop cloths/masking', 'cleanup'],
    commonVariants: ['interior ($2-$6 per sq ft of floor)', 'exterior ($3-$7 per sq ft of wall)', '2,000 sq ft exterior ($5,000-$10,200)', 'cabinets ($1,500-$4,500)'],
    pricingBasis: 'square footage of surface (not floor), number of coats, paint grade, and prep work required',
    redFlags: ['only one coat specified', 'no prep line item', 'paint brand/line not specified', 'touch-up warranty under 12 months'],
  },
  'fence': {
    label: 'Fence installation',
    nationalLow: 1500, nationalHigh: 11500,
    analyzer: '/fencing-quote-analyzer.html',
    guide: '/fence-cost.html',
    scopeItems: ['post holes', 'concrete for posts', 'posts', 'rails/panels', 'gates and hardware', 'haul-away of old fence'],
    commonVariants: ['chain-link ($8-$18 per linear ft)', 'wood ($15-$35 per linear ft)', 'vinyl ($25-$40 per linear ft)', 'aluminum/ornamental ($30-$50 per linear ft)'],
    pricingBasis: 'linear footage, material, height, number of gates, and slope of terrain',
    redFlags: ['post depth not specified', 'concrete not included', 'gate hardware quoted separately', 'survey/locate fees excluded'],
  },
  'foundation': {
    label: 'Foundation repair',
    nationalLow: 500, nationalHigh: 26000,
    analyzer: '/foundation-quote-analyzer.html',
    guide: '/foundation-repair-cost.html',
    scopeItems: ['engineering assessment', 'piers or underpinning', 'excavation', 'backfill', 'any required landscaping restoration'],
    commonVariants: ['minor crack repair ($500-$1,500)', 'single pier ($1,800-$3,000)', 'typical 6-12 pier project ($10,000-$30,000)', 'full underpinning ($15,000-$26,000)'],
    pricingBasis: 'type and severity of settlement, number and depth of piers required, and site access',
    redFlags: ['no engineering inspection', 'lifetime warranty without transferability', 'pier type unspecified (steel vs concrete)', 'no soil analysis'],
  },
  'siding': {
    label: 'Siding installation',
    nationalLow: 6000, nationalHigh: 21000,
    analyzer: '/siding-quote-analyzer.html',
    guide: '/siding-cost.html',
    scopeItems: ['removal of old siding', 'house wrap/moisture barrier', 'new siding panels', 'trim and flashing', 'caulking and sealing'],
    commonVariants: ['vinyl ($4-$9 per sq ft)', 'fiber cement/HardiePlank ($8-$16 per sq ft)', 'engineered wood ($6-$13 per sq ft)', 'cedar/natural wood ($7-$15 per sq ft)'],
    pricingBasis: 'square footage of wall, material chosen, trim complexity, and whether existing siding needs removal',
    redFlags: ['house wrap not specified', 'trim package unclear', 'painting/staining quoted separately', 'warranty on labor under 1 year'],
  },
  'window': {
    label: 'Window replacement',
    nationalLow: 6000, nationalHigh: 18000,
    analyzer: '/window-quote-analyzer.html',
    guide: '/window-replacement-cost.html',
    scopeItems: ['removal of old windows', 'new windows (frame + glass)', 'flashing and weatherproofing', 'interior/exterior trim', 'disposal'],
    commonVariants: ['vinyl ($400-$800 per window)', 'fiberglass ($600-$1,200 per window)', 'wood-clad ($900-$1,600 per window)', 'per home (10-15 windows): $6,000-$18,000'],
    pricingBasis: 'window material, frame type, glass package (double vs triple pane), and number of windows',
    redFlags: ['glass package unspecified', 'frame material vague', 'trim work quoted separately', 'labor warranty under 2 years'],
  },
  'insulation': {
    label: 'Insulation',
    nationalLow: 1200, nationalHigh: 5200,
    analyzer: '/insulation-quote-analyzer.html',
    guide: '/insulation-cost.html',
    scopeItems: ['existing insulation removal (if any)', 'air sealing', 'new insulation (R-value per spec)', 'vapor barrier', 'cleanup'],
    commonVariants: ['blown-in cellulose ($1-$2 per sq ft)', 'spray foam ($2-$5 per sq ft)', 'fiberglass batts ($0.70-$1.50 per sq ft)', 'attic job ($1,500-$3,500)'],
    pricingBasis: 'R-value target, area to cover, existing insulation condition, and accessibility',
    redFlags: ['R-value not specified', 'air sealing excluded', 'old insulation not removed from degraded jobs', 'no post-install verification'],
  },
  'gutter': {
    label: 'Gutter installation',
    nationalLow: 900, nationalHigh: 1400,
    analyzer: '/gutters-quote-analyzer.html',
    guide: '/gutters-cost.html',
    scopeItems: ['removal of old gutters', 'new gutters', 'downspouts', 'hangers and fasteners', 'sealant'],
    commonVariants: ['aluminum ($7-$14 per linear ft)', 'vinyl ($5-$9 per linear ft)', 'copper ($25-$45 per linear ft)', 'gutter guards (+$5-$10 per linear ft)'],
    pricingBasis: 'linear footage of roofline, material choice, downspout count, and any gutter guards added',
    redFlags: ['downspout count unspecified', 'hanger spacing not stated', 'disposal quoted separately', 'pitch not mentioned for drainage'],
  },
  'landscaping': {
    label: 'Landscaping',
    nationalLow: 2000, nationalHigh: 20000,
    analyzer: '/landscaping-quote-analyzer.html',
    guide: '/landscaping-cost.html',
    scopeItems: ['site prep and grading', 'soil amendment', 'plants/sod/mulch', 'hardscape materials if applicable', 'irrigation installation if applicable'],
    commonVariants: ['basic refresh ($2,000-$5,000)', 'full front yard design ($6,000-$12,000)', 'hardscape features like walkways ($15-$50 per sq ft)', 'full property redesign ($20,000+)'],
    pricingBasis: 'area treated, plant maturity, hardscape features included, and design complexity',
    redFlags: ['plant sizes not specified', 'warranty on plant survival absent', 'irrigation scoped vaguely', 'mulch volume (cubic yards) not stated'],
  },
  'kitchen-remodel': {
    label: 'Kitchen remodel',
    nationalLow: 19000, nationalHigh: 75000,
    analyzer: '/kitchen-quote-analyzer.html',
    guide: '/kitchen-remodel-cost.html',
    scopeItems: ['demolition', 'cabinets', 'countertops', 'appliances', 'plumbing rough-in', 'electrical rough-in', 'flooring', 'paint', 'permits'],
    commonVariants: ['minor refresh ($19,000-$30,000)', 'mid-range full remodel ($30,000-$60,000)', 'upscale with custom cabinets ($75,000+)', 'cabinet refacing alone ($4,000-$10,000)'],
    pricingBasis: 'cabinet grade (stock/semi-custom/custom), countertop material, appliance tier, and whether layout changes',
    redFlags: ['allowance amounts unrealistic', 'permits not included', 'appliance delivery/install quoted separately', 'demolition and haul-away vague'],
  },
  'garage-door': {
    label: 'Garage door',
    nationalLow: 700, nationalHigh: 4000,
    analyzer: '/garage-door-quote-analyzer.html',
    guide: '/garage-door-cost.html',
    scopeItems: ['removal of old door', 'new door panels', 'tracks and springs', 'opener (if included)', 'weather seal'],
    commonVariants: ['single-car basic ($950-$1,800)', 'double-car ($1,500-$3,500)', 'insulated ($2,000-$4,000)', 'opener install (+$250-$650)'],
    pricingBasis: 'door size (single vs double), material (steel/aluminum/wood), insulation, and opener type',
    redFlags: ['spring type not specified (torsion vs extension)', 'opener brand unspecified', 'tracks reused without inspection', 'weather seal excluded'],
  },
  'auto-repair': {
    label: 'Auto repair',
    nationalLow: 150, nationalHigh: 2500,
    analyzer: '/auto-repair-quote-analyzer.html',
    guide: '/auto-repair-cost-guide.html',
    scopeItems: ['diagnostic labor', 'parts', 'replacement labor', 'taxes/shop fees', 'warranty coverage'],
    commonVariants: ['brake job ($200-$800 per axle)', 'timing belt ($500-$1,200)', 'water pump ($400-$900)', 'alternator ($350-$800)', 'transmission rebuild ($2,500-$5,000)'],
    pricingBasis: 'specific repair type, whether OEM or aftermarket parts, shop labor rate, and diagnostic time',
    redFlags: ['diagnostic fee not credited against repair', 'parts markup not disclosed', 'labor hours vs book hours mismatch', 'no warranty on labor'],
  },
  'legal': {
    label: 'Legal fees',
    nationalLow: 225, nationalHigh: 500,
    analyzer: '/legal-fee-analyzer.html',
    guide: '/legal-cost-guide.html',
    scopeItems: ['hourly rate or flat fee', 'filing fees', 'paralegal time', 'expert witness fees if applicable', 'court appearance time'],
    commonVariants: ['simple will ($300-$800 flat)', 'uncontested divorce ($500-$3,000 flat)', 'estate planning package ($1,500-$5,000)', 'litigation retainers ($3,000-$15,000)'],
    pricingBasis: 'whether the matter is hourly or flat-fee, attorney experience level, local market rates, and case complexity',
    redFlags: ['retainer replenishment terms unclear', 'billing increment of 30+ min', 'hourly rate without expected total hours', 'expenses billed at cost vs marked up'],
  },
  'medical': {
    label: 'Medical bill',
    nationalLow: 150, nationalHigh: 5000,
    analyzer: '/medical-bill-analyzer.html',
    guide: '/medical-cost-guide.html',
    scopeItems: ['facility fee', 'professional (physician) fee', 'supplies/medications', 'imaging or lab work', 'anesthesia if applicable'],
    commonVariants: ['office visit ($150-$400)', 'ER visit ($600-$2,500 typical)', 'outpatient procedure ($1,000-$8,000)', 'inpatient surgery ($10,000-$50,000)'],
    pricingBasis: 'facility type (hospital vs outpatient), insurance network status, procedure CPT codes billed, and any complications',
    redFlags: ['CPT codes missing', 'out-of-network surprise billing', 'facility fee not itemized', 'duplicate charges for same code'],
  },
  'moving': {
    label: 'Moving',
    nationalLow: 600, nationalHigh: 7500,
    analyzer: '/moving-quote-analyzer.html',
    guide: '/moving-cost-guide.html',
    scopeItems: ['crew hours', 'truck and fuel', 'packing materials (if included)', 'stair/elevator fees', 'insurance/valuation'],
    commonVariants: ['local 1BR ($400-$900)', 'local 2BR ($600-$1,500)', 'long-distance 2BR ($3,500-$7,500)', 'full pack + move ($1,200-$5,000 extra)'],
    pricingBasis: 'distance (local vs long-distance), home size, stairs/elevators, and whether packing services are included',
    redFlags: ['no binding estimate', 'fuel surcharge vague', 'insurance at 60¢/lb default', 'stair/long-carry fees buried in fine print'],
  },
  'meta': {
    label: 'Contractor quotes',
    nationalLow: 0, nationalHigh: 0,
    analyzer: '/analyze-my-quote.html',
    guide: '/guides.html',
    scopeItems: ['scope of work', 'materials list', 'labor breakdown', 'timeline', 'payment schedule', 'warranty terms'],
    commonVariants: [],
    pricingBasis: 'project type, city, and specific scope',
    redFlags: ['deposits over 30%', 'vague scope of work', 'verbal promises not in writing', 'unusually low or high vs local market'],
  },
};

function escAttr(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function title(s) { return s.split(/\s+/).map(w => w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' '); }

function fmtUsd(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

// Derive a URL slug from the canonical query.
function slug(q) {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Capitalize the canonical query for use as a title/H1.
function titleCase(q) {
  // Preserve specific terms
  return q.split(' ').map(w => {
    if (w.length <= 2 && !['ac', 'hv', 'ev'].includes(w.toLowerCase())) return w.toLowerCase();
    if (['hvac', 'ac', 'ev', 'diy', 'seer', 'btu'].includes(w.toLowerCase())) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

// Build the FAQ JSON-LD entries from variant queries.
function buildFaqSchema(canonical, variants, ctx) {
  const faqs = [];
  // Q1: always the canonical
  const canonTitled = titleCase(canonical);
  faqs.push({
    q: canonTitled.endsWith('?') ? canonTitled : `${canonTitled}?`,
    a: `${ctx.label} ranges from ${fmtUsd(ctx.nationalLow)} to ${fmtUsd(ctx.nationalHigh)} in 2026 for a typical project. Actual cost varies by ${ctx.pricingBasis}.`,
  });
  // Q2: What factors drive price up or down
  faqs.push({
    q: `What drives ${ctx.label.toLowerCase()} cost up or down?`,
    a: `The biggest factors are ${ctx.pricingBasis}. High-cost metros (San Francisco, Seattle, Boston, New York, Chicago) typically run 20-30% above the national range. Mid-cost metros (Atlanta, Dallas, Denver, Phoenix) sit near the middle. Lower-cost markets (Memphis, Birmingham, Little Rock, Des Moines) run 10-15% below.`,
  });

  // Q3: What to watch for in a quote
  if (ctx.redFlags && ctx.redFlags.length) {
    faqs.push({
      q: `What should I watch for in a ${ctx.label.toLowerCase()} quote?`,
      a: `The most common red flags are ${ctx.redFlags.slice(0, 3).join(', ')}. Any of these warrants specific questions before signing. Missing line items are the top reason quotes come in artificially low — the cost shows up later as change orders.`,
    });
  }

  // Q4: Additional variant if available (gives long-tail phrase coverage)
  const seen = new Set([canonical.toLowerCase()]);
  for (const v of variants) {
    if (faqs.length >= 5) break;
    if (seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    const q = titleCase(v);
    faqs.push({
      q: q.endsWith('?') ? q : `${q}?`,
      a: `This is a common phrasing of the underlying ${ctx.label.toLowerCase()} cost question. The pricing fundamentals are the same: ${fmtUsd(ctx.nationalLow)} to ${fmtUsd(ctx.nationalHigh)} for standard scope. Specific sub-categories (${ctx.commonVariants.slice(0, 3).join(', ')}) each have their own typical range within that band.`,
    });
  }

  return faqs;
}

function renderSchema(obj) {
  return '<script type="application/ld+json">\n' + JSON.stringify(obj) + '\n</script>';
}

// --- Table-led template (for commercial cost queries) ---
function tableLedTemplate(cluster) {
  const ctx = VERTICAL_CONTEXT[cluster.vertical] || VERTICAL_CONTEXT.meta;
  const slugStr = slug(cluster.canonicalQuery);
  const title1 = titleCase(cluster.canonicalQuery);
  const url = 'https://woogoro.com/' + slugStr + '.html';
  const canonical = cluster.canonicalQuery;
  const variants = cluster.variants.slice(1);  // exclude the canonical itself

  // Build snippet answer
  const snippetAnswer = `${ctx.label} costs ${fmtUsd(ctx.nationalLow)} to ${fmtUsd(ctx.nationalHigh)} nationally in 2026 for a typical project. Pricing depends on ${ctx.pricingBasis}. Most homeowners pay toward the middle of that range for standard scope, with premium materials or custom work pushing prices higher.`;

  const faqs = buildFaqSchema(canonical, variants, ctx);
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: title1, description: snippetAnswer,
    datePublished: '2026-04-20', dateModified: '2026-04-20',
    publisher: { '@type': 'Organization', name: 'Woogoro', url: 'https://woogoro.com/' },
    mainEntityOfPage: url,
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://woogoro.com/' },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: 'https://woogoro.com/guides.html' },
      { '@type': 'ListItem', position: 3, name: title1 },
    ],
  };
  const faqSchema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const metaDesc = `${title1}: ${ctx.label} typically runs ${fmtUsd(ctx.nationalLow)} to ${fmtUsd(ctx.nationalHigh)} in 2026. Breakdown by scope, red flags to watch in quotes, and free analysis.`;

  // What's included section
  const scopeList = ctx.scopeItems.map(s => `<li>${s}</li>`).join('');
  const commonList = ctx.commonVariants.map(v => `<li>${v}</li>`).join('');
  const redFlagList = ctx.redFlags.map(r => `<li>${r}</li>`).join('');

  // Variant H3s REMOVED. Earlier versions added an H3 for each variant
  // phrasing and repeated near-identical prose — exactly the programmatic
  // pattern Google's helpful-content system penalizes. The variants are
  // still captured semantically via the FAQPage schema and the visible
  // FAQ section below; that's enough for long-tail phrase matching without
  // the boilerplate duplication.
  const variantH3s = '';

  // FAQ visible section
  const faqDetails = faqs.map(f => `
    <details class="faq-item">
      <summary>${escHtml(f.q)}</summary>
      <div class="faq-answer"><p>${escHtml(f.a)}</p></div>
    </details>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" href="/favicon-trudy.svg" type="image/svg+xml" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${escHtml(title1)} (2026) | Woogoro</title>
  <meta name="description" content="${escAttr(metaDesc)}" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en-US" href="${url}" />
  <link rel="alternate" hreflang="x-default" href="${url}" />
  <meta name="robots" content="index,follow" />

  <meta property="og:title" content="${escAttr(title1)} (2026) | Woogoro" />
  <meta property="og:description" content="${escAttr(metaDesc)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="https://woogoro.com/images/woogoro-social.png" />
  <meta property="og:image:alt" content="${escAttr(title1)} (2026) | Woogoro" />
  <meta property="og:site_name" content="Woogoro" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escAttr(title1)} (2026) | Woogoro" />
  <meta name="twitter:description" content="${escAttr(metaDesc)}" />
  <meta name="twitter:image" content="https://woogoro.com/images/woogoro-social.png" />

  <link rel="stylesheet" href="/css/trueprice.min.css" />

  ${renderSchema(articleSchema)}
  ${renderSchema(breadcrumbSchema)}
  ${renderSchema(faqSchema)}
</head>
<body>
  <a href="#main" class="skip-link">Skip to main content</a>
  <header class="site-header">
    <div class="container">
      <a class="logo" href="/">Woogoro</a>
      <nav>
        <a href="/guides.html">Guides</a>
        <a href="/methodology.html">Methodology</a>
      </nav>
    </div>
  </header>

  <div class="hero">
    <div class="container">
      <div class="breadcrumbs">
        <a href="/">Home</a> &rsaquo;
        <a href="/guides.html">Guides</a> &rsaquo;
        <span>${escHtml(title1)}</span>
      </div>
      <h1>${escHtml(title1)}</h1>
      <p class="tp-snippet" style="font-size:15px; line-height:1.6; color:#4b5563;">${escHtml(snippetAnswer)}</p>
    </div>
  </div>

  <main id="main" class="container" style="max-width:720px; padding-top:32px; padding-bottom:32px;">

    <h2>Typical Price Range</h2>
    <table class="price-table">
      <thead><tr><th>Project Scope</th><th>Typical Cost (2026)</th></tr></thead>
      <tbody>
        ${ctx.commonVariants.map(v => {
          const parts = v.split(' ($');
          const label = parts[0];
          const price = parts[1] ? '$' + parts[1].replace(')', '') : '-';
          return `<tr><td>${escHtml(label)}</td><td>${escHtml(price)}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
    <p>These ranges reflect national averages. Your actual cost depends on ${ctx.pricingBasis}. City-specific pricing varies up to 30% in higher-cost metros (San Francisco, Seattle, Boston, New York) and 10-15% lower in smaller markets (Memphis, Little Rock, Des Moines).</p>

    <h2>What Should Be Included</h2>
    <p>A complete ${ctx.label.toLowerCase()} quote should itemize:</p>
    <ul>${scopeList}</ul>
    <p>If any line is missing or lumped into a generic "labor" charge, ask the contractor to break it out. Scope omissions are the most common way quotes come in artificially low.</p>

    <h2>Red Flags to Watch in Quotes</h2>
    <p>Experienced homeowners watch for these specific patterns that signal a quote needs follow-up questions:</p>
    <ul>${redFlagList}</ul>

    <h2>Cost Breakdown by Project Type</h2>
    <ul>${commonList}</ul>

    <h2>How to Know If Your Quote Is Fair</h2>
    <p>The fastest way: upload the quote to <a href="${ctx.analyzer}">Woogoro's free ${ctx.label.toLowerCase()} analyzer</a>. It compares the price against local cost data (based on BLS wage and BEA cost-of-living indices across 739 U.S. cities), checks whether the scope covers standard items for the trade, and flags any concerning fine print.</p>
    <p>No email or phone required. Free, unlimited use.</p>

    <div class="cta-box">
      <h2>Check your ${ctx.label.toLowerCase()} quote in 30 seconds</h2>
      <p>Upload the quote, pick your city. Woogoro tells you if the price is fair, if scope is complete, and what to push back on. No signup.</p>
      <a class="btn" href="${ctx.analyzer}">Analyze my quote</a>
    </div>

    <section class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-list">
        ${faqDetails}
      </div>
    </section>

  </main>

  <footer class="site-footer">
    <div class="container">
      <p>Woogoro helps homeowners and car owners analyze contractor and mechanic quotes, compare bids, and estimate project costs. <a href="/privacy.html" style="color:inherit;">Privacy</a> | <a href="/methodology.html" style="color:inherit;">Methodology</a></p>
    </div>
  </footer>
  <script src="/js/tp-analytics.min.js" async></script>
</body>
</html>
`;
}

module.exports = {
  VERTICAL_CONTEXT,
  slug,
  titleCase,
  tableLedTemplate,
};
