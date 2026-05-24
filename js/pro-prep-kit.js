/*
 * Woogoro — Quote-Prep Kit content + renderer
 * --------------------------------------------
 * Companion to /js/pro-tier.js. Same $19 Pro SKU, different deliverable:
 *
 *   pro-tier.js     -> renders POST-quote content (negotiation script vs
 *                      a real uploaded quote, scope-gap analysis)
 *   pro-prep-kit.js -> renders PRE-quote content (questions to ask before
 *                      contractors arrive, red flags to watch for, scope
 *                      checklist to insist on, generic negotiation tactics)
 *
 * Lives on /pro-prep-kit.html and is reached from the estimator-result CTA.
 * URL params drive personalization:
 *   ?vertical=hvac&city=Charlotte&state=NC&estimate=12000&label=HVAC
 *
 * Free users see a teaser (headlines + locked content + "$19" upsell).
 * Pro users (via WoogoroPro.getStatus()) see the full content.
 *
 * Self-contained ES5 + DOM. No external deps beyond WoogoroPro (loaded
 * from /js/pro-tier.min.js on the same page) for Stripe checkout + isPro.
 */
(function () {
  if (window.WoogoroPrepKit) return;

  // ── Generic content (shared across all verticals) ──────────────────────

  var GENERIC_QUESTIONS = [
    "What is your full payment schedule? Is more than 25% required upfront?",
    "What is your warranty on labor specifically, separate from manufacturer warranties on materials?",
    "Who actually does the work — your employees, or subcontractors?",
    "What is your written change-order policy? Can I see a copy before signing?",
    "What are the estimated start and end dates? What happens if the job runs over?",
    "Do you carry workers' comp and general liability insurance? Can I see proof?",
    "Are permits and inspections included in your price? Who pulls them?",
    "Do you include cleanup and haul-off, or is that extra?",
    "Will I get a written contract with a detailed scope before any work begins?",
    "Can you provide 3 references from jobs completed in the last 12 months in my area?"
  ];

  var GENERIC_RED_FLAGS = [
    { label: "Deposit greater than 25-30%", detail: "Legitimate contractors finance their own material until inspection. A 50%+ deposit transfers the risk of contractor failure entirely to you." },
    { label: "Pressure to sign today", detail: '"This price is only good if you sign now" is a sales tactic, not a real constraint. Material costs do not move that fast.' },
    { label: "Verbal-only warranty", detail: "If it is not in writing — labor terms, materials terms, transferability, what voids it — it does not exist when something goes wrong." },
    { label: "No written change-order policy", detail: "Without one, the contractor can add charges mid-job that you are obligated to pay. Demand: any added work needs your written approval first." },
    { label: "Cash-only or no business address", detail: "Real contractors have a business entity, an address, license/insurance you can verify with the state, and accept normal payment methods." }
  ];

  var GENERIC_TACTICS = [
    {
      headline: "Get at least 3 written quotes",
      detail: "Pricing variance of 30-50% on the same scope is normal. You cannot tell which quote is fair without comparison anchors. Tell each contractor up front: \"I'm collecting 3 quotes — when can you have yours ready?\"",
      script: "\"I'm getting quotes from three companies. I'd like all bids to cover the same scope so I can compare apples to apples. Can you itemize labor and materials separately?\""
    },
    {
      headline: "Use a competing quote as leverage — once",
      detail: "Hold your favorite contractor's quote until you have a competitor's number to push back with. Don't bluff: only use this if you have a real lower quote in hand.",
      script: "\"I want to go with you, but I have another quote from a licensed company at $X for the same scope. Is there any flexibility to get closer to that number, or is there something material I'm missing in their bid?\""
    },
    {
      headline: "Lock in a 25/50/25 payment schedule",
      detail: "25% on start, 50% on substantial completion (most of the work done), 25% on final acceptance. This is industry standard and protects you from contractors who walk after the deposit.",
      script: "\"Standard around here is 25% deposit, 50% on substantial completion, 25% on final walkthrough. Can we structure the payment schedule that way?\""
    },
    {
      headline: "Demand the lowest-tier brand price for comparison",
      detail: "Ask the contractor what their price would be if you went one tier down on materials. This forces them to show real material vs labor breakdown — most won't do that voluntarily.",
      script: "\"What would this quote look like if I used the entry-tier brand instead of the premium one? I want to understand what I'm paying for the brand upgrade.\""
    },
    {
      headline: "Verify license + insurance before you sign",
      detail: "Search your state contractor licensing board's website (every state has one). Confirm: license is active, no major complaints, insurance is current. Takes 5 minutes and is the cheapest insurance you'll buy.",
      script: "\"Before I sign, I'd like to verify your license and insurance with the state board. Can you give me your license number and your insurance carrier name?\""
    }
  ];

  // ── Vertical-specific content ──────────────────────────────────────────
  //
  // Each vertical has:
  //   questions[]:    5-10 vertical-specific questions (in addition to generic)
  //   redFlags[]:     3-5 vertical-specific red flags (in addition to generic)
  //   scopeChecklist[]: 10-15 line items the quote MUST include
  //
  // Brand + rebate + warranty content is reused from /js/pro-tier.js via
  // window.WoogoroPro.renderBrandSection() etc. — same single source of
  // truth, no duplication.

  var VERTICAL = {
    hvac: {
      label: "HVAC",
      questions: [
        "Will you do a Manual J load calculation to properly size the system?",
        "What is the SEER2 / HSPF2 rating? (Min 14.3 SEER2 in the South, 13.4 in the North as of 2023.)",
        "Are the refrigerant lines being replaced, or reused from the old system?",
        "Is a new outdoor unit pad included?",
        "Is the line-set flush and pressure test included before charging refrigerant?",
        "Is a new thermostat included? Is it smart / programmable?",
        "Is ductwork inspection and (if needed) sealing included?",
        "What is the parts warranty (10 years standard) and labor warranty (1-2 years standard)?",
        "Am I eligible for the federal 25C heat pump tax credit (30% up to $2,000) or any utility rebates?"
      ],
      redFlags: [
        { label: "No Manual J load calc", detail: "Without one, the contractor is guessing system size. Oversized = short cycling, undersized = constant running. Both kill efficiency and lifespan." },
        { label: "Reused refrigerant lines without flush", detail: "Old lines can contain residual oil incompatible with R-410A or the new R-32/R-454B. Insist on flush + pressure test or new lines." },
        { label: "Pre-2023 SEER ratings shown", detail: "DOE raised efficiency floors in 2023. SEER1 ratings on the quote may indicate old inventory the installer is trying to clear." },
        { label: "Labor warranty under 1 year", detail: "Industry standard is 1-2 years labor. Less than 1 year means the contractor doesn't stand behind their install." }
      ],
      scopeChecklist: [
        "Manual J load calculation",
        "New equipment (outdoor unit + indoor coil + furnace/air handler)",
        "New refrigerant line set OR documented flush + pressure test of existing",
        "New refrigerant charge (R-410A, R-32, or R-454B per system spec)",
        "Outdoor unit pad (concrete or composite)",
        "New thermostat",
        "Electrical disconnect at outdoor unit",
        "Ductwork inspection + sealing if needed",
        "Permits + inspections",
        "Removal + disposal of old equipment",
        "10-year parts warranty (manufacturer)",
        "Minimum 1-year labor warranty (contractor)",
        "Startup + commissioning + airflow verification",
        "Owner's manuals + warranty registration"
      ]
    },
    roofing: {
      label: "roofing",
      questions: [
        "Will this be a full tear-off, or a layover (new shingles on top of old)?",
        "What underlayment do you use — synthetic (modern standard) or felt (cheaper, shorter-lived)?",
        "Is ice + water shield included in valleys, eaves, and around penetrations?",
        "Is new drip edge included on all eaves and rakes?",
        "Is new flashing (step flashing at walls, vent pipe boots, chimney) included?",
        "Are ridge vents and starter strip included?",
        "What shingle brand and product specifically? (e.g. GAF Timberline HDZ vs Builder's Choice)",
        "Is decking replacement included, or charged per sheet if rotten plywood is found?",
        "What is your workmanship warranty (5-25 years), and is it written separately from the manufacturer warranty?"
      ],
      redFlags: [
        { label: "Door-to-door sales after a storm", detail: "Storm chasers move into hail-damaged areas, often unlicensed in your state. Verify license + 12-month local references before signing." },
        { label: "Felt underlayment without a price reduction", detail: "Felt costs ~half what synthetic does. If the quote uses felt and isn't significantly cheaper, push back or upgrade to synthetic." },
        { label: "No mention of ice + water shield", detail: "In freeze zones (most of US except Deep South / TX / FL), ice + water shield in valleys + eaves is non-negotiable for warranty coverage." },
        { label: "Per-sheet decking replacement clause with no cap", detail: "Some contractors over-bill rotten plywood replacement at $80-150/sheet. Negotiate a cap (e.g. \"first 2 sheets free\") or audit the bill at completion." }
      ],
      scopeChecklist: [
        "Full tear-off of existing roofing material (not layover)",
        "Synthetic underlayment (industry standard)",
        "Ice + water shield in valleys, eaves, around penetrations",
        "New drip edge on all eaves and rakes",
        "New step flashing at walls + chimneys",
        "New pipe boots and roof penetration flashing",
        "Starter strip along eaves",
        "Ridge vent or appropriate ventilation",
        "Architectural shingles (named brand + line: e.g. GAF Timberline HDZ)",
        "Decking replacement scope and per-sheet pricing if rot found",
        "Cleanup with magnetic sweep for nails",
        "Permit + inspections",
        "Manufacturer materials warranty (registered to you)",
        "Workmanship warranty 5+ years on labor"
      ]
    },
    solar: {
      label: "solar",
      questions: [
        "What panel brand, wattage, and tier (Tier 1 is preferred)?",
        "What inverter brand — microinverters (Enphase) or string inverter (SolarEdge, SMA)?",
        "What is the production guarantee in kWh / year?",
        "Will you handle the utility interconnection paperwork and the building permit?",
        "Is a critter guard around the array included?",
        "What is the panel warranty (25 years standard for Tier 1), inverter warranty (10-25 years), and labor / workmanship warranty (10 years for premium installers)?",
        "Am I eligible for the federal 30% ITC? Are there state / utility rebates? Are there SREC markets in my state?",
        "What is your monitoring portal — and what happens if production drops below the guarantee?",
        "Are you a NABCEP-certified installer?"
      ],
      redFlags: [
        { label: "No production guarantee", detail: "Reputable installers guarantee a minimum annual kWh output for the first 10+ years. No guarantee = no skin in the game on actual performance." },
        { label: "Vague panel + inverter brands", detail: "\"High-quality panels\" is not a spec. Insist on brand + model + wattage in writing." },
        { label: "Lease / PPA pushed over purchase", detail: "Leases / PPAs strip you of the 30% ITC + reduce home value at sale. Ownership is almost always the better deal if you can afford the upfront cost or finance it." },
        { label: "No NABCEP certification", detail: "NABCEP is the gold-standard solar installer credential. Not having it isn't a deal-breaker, but it's a quality signal." }
      ],
      scopeChecklist: [
        "Panel brand + model + wattage + count",
        "Inverter brand + type (micro vs string)",
        "Racking + mounting hardware",
        "Critter guard around array",
        "All electrical work to interconnection point",
        "Utility interconnection application + paperwork",
        "Building permit + inspection",
        "Monitoring portal access (for life of system)",
        "Production guarantee (kWh/year)",
        "Panel warranty 25 years",
        "Inverter warranty 10-25 years",
        "Workmanship warranty 10+ years",
        "Federal ITC documentation (Form 5695)",
        "Roof penetration warranty (separate from panel/inverter)"
      ]
    },
    landscaping: {
      label: "landscaping",
      questions: [
        "Is design / layout included, or charged separately?",
        "What is the plant warranty (typically 90 days to 1 year for installed plant material)?",
        "Is irrigation system installation included or separate?",
        "Is mulch / decorative rock included for planting beds?",
        "Is hardscape edging (paver edge restraint, concrete curbing) included?",
        "Is drainage solution included if water pools or runs off?",
        "Is cleanup + haul-off of debris included?",
        "Do you provide a written maintenance plan after install?",
        "Are you licensed for irrigation work in this state? (Most states require a separate license.)"
      ],
      redFlags: [
        { label: "No plant warranty", detail: "Plants can die from improper installation (root ball depth, soil drainage). 90-day to 1-year warranty is industry standard for installed plant material." },
        { label: "Mulch + edging extra", detail: "These are usually included in the per-sqft installed price. If they're listed separately at markup, you're paying twice." },
        { label: "Vague plant counts / sizes", detail: "Quote should say \"24 1-gallon shrubs, 6 5-gallon trees\" — not \"plant material as needed.\" Vague specs mean the contractor can downgrade later." }
      ],
      scopeChecklist: [
        "Design / layout plan",
        "Soil amendment (compost, topsoil) where needed",
        "Plant material by species + size + count (e.g. \"24 1-gallon shrubs\")",
        "Mulch (hardwood or pine bark) for all planting beds",
        "Hardscape edging where applicable",
        "Irrigation system (if quoted) — zone count + head type",
        "Drainage solution (French drain, swale) if grading requires",
        "Sod or seed for any lawn areas",
        "Cleanup + haul-off of debris",
        "Permits if hardscape > certain sqft (varies by city)",
        "Plant warranty 90 days to 1 year",
        "Hardscape labor warranty 1 year minimum",
        "Maintenance instructions (watering, fertilization schedule)"
      ]
    },
    kitchen: {
      label: "kitchen remodel",
      questions: [
        "Is design + layout included or charged separately?",
        "What cabinet brand + line? (Semi-custom vs full custom vs stock.)",
        "What countertop material + grade? (Quartz brand, granite grade.)",
        "Is plumbing rough-in included (move sink / fridge water line)?",
        "Is electrical rough-in included (new outlets, under-cabinet lighting circuit)?",
        "Is demo + disposal of existing cabinets / counters / appliances included?",
        "Are permits + inspections included?",
        "Are appliances included in this quote or separate?",
        "What is your labor warranty (1 year standard)?",
        "What is your timeline + how do you handle weather / supply delays?"
      ],
      redFlags: [
        { label: "Vague cabinet specs", detail: "\"Mid-range cabinets\" is not a spec. Insist on brand + line + door style + wood species + finish in writing." },
        { label: "No allowance for hidden issues", detail: "Behind-cabinet plumbing / electrical / water damage is normal. Quote should have a contingency line or a documented hourly + materials rate for unexpected finds." },
        { label: "Tile sub-flooring not included", detail: "If you're tiling and the subfloor isn't rated for tile (deflection), you'll get cracked grout in a year. Confirm subfloor work is in scope." }
      ],
      scopeChecklist: [
        "Design + layout plan",
        "Demo + disposal of existing kitchen",
        "Cabinet brand + line + door style + finish (in writing)",
        "Countertop material + brand / grade (in writing)",
        "Backsplash material + installation",
        "Sink + faucet (specify or note customer-provided)",
        "Plumbing rough-in (sink, dishwasher, fridge line if moved)",
        "Electrical rough-in (outlets, lighting circuits, under-cabinet)",
        "Lighting fixtures (or note customer-provided)",
        "Flooring (or note customer-provided) including subfloor prep",
        "Painting after install",
        "Appliance installation (note if appliances are in quote or separate)",
        "Permits + inspections",
        "Cleanup + final walkthrough",
        "Labor warranty 1 year minimum"
      ]
    }
  };

  // Minimal baseline for verticals without deep curation yet. Each gets
  // the generic questions/red flags/tactics + a short scope checklist.
  // Better than no content; can be deepened later based on user demand.
  var VERTICAL_BASELINE = {
    plumbing:    { label: "plumbing",    scopeChecklist: ["Diagnostic + scope walkthrough", "Parts (brand + model)", "Labor (itemized hours or flat rate)", "Permits if pulling new fixtures or rough-in", "Cleanup + disposal of old fixtures", "Workmanship warranty 1-5 years", "Manufacturer warranty on parts"] },
    electrical:  { label: "electrical",  scopeChecklist: ["Permit + inspection (required for most jobs)", "Materials (brand + amperage)", "Labor (itemized)", "Disposal of old fixtures / panels", "Code compliance verification", "Workmanship warranty 1-2 years", "Manufacturer warranty on parts"] },
    windows:     { label: "windows",     scopeChecklist: ["Window brand + line + frame material (vinyl, fiberglass, wood)", "Glass package (Low-E, argon, triple-pane)", "Energy Star certification", "Removal + disposal of old windows", "New trim / interior finishing", "Caulk + flashing around new install", "Materials warranty 20+ years", "Labor warranty 5-10 years"] },
    siding:      { label: "siding",      scopeChecklist: ["Siding brand + material (vinyl, fiber cement, wood)", "House wrap / moisture barrier", "Insulation behind siding (if upgrading)", "All trim, fascia, soffit", "Caulk + flashing around windows / doors", "Removal + disposal of old siding", "Materials warranty 20-50 years", "Labor warranty 1-10 years"] },
    insulation:  { label: "insulation",  scopeChecklist: ["Insulation type (cellulose, fiberglass batt, spray foam)", "R-value to be installed (must meet local code)", "Air sealing of penetrations + gaps before insulation", "Vapor barrier if required by climate zone", "Attic ventilation verification", "Pre + post home energy assessment (for HOMES rebate)", "Materials warranty lifetime", "Labor warranty 1-2 years"] },
    painting:    { label: "painting",    scopeChecklist: ["Paint brand + line + sheen (e.g. Sherwin-Williams Duration Satin)", "Number of coats (2 is standard)", "Prep work: wash, scrape, sand, prime as needed", "Caulking + minor repair", "Drop cloths + masking included", "Cleanup + paint can disposal", "Exterior workmanship warranty 2-7 years", "Interior workmanship warranty 1-3 years"] },
    fencing:     { label: "fencing",     scopeChecklist: ["Fence material + height + length", "Post material (4x4 wood, metal, concrete-set)", "Post depth (must be below frost line in cold climates)", "Gate(s) with hardware", "Property line survey verification", "Permit if over a certain height (varies by city)", "Labor warranty 1-5 years"] },
    concrete:    { label: "concrete",    scopeChecklist: ["Concrete thickness (4\" minimum for driveways, 6\" for heavy loads)", "Sub-base prep (compacted gravel, 4-6\")", "Rebar or wire mesh reinforcement", "Expansion + control joints", "Curing + sealing", "Form removal + cleanup", "Workmanship warranty 1-5 years"] },
    foundation:  { label: "foundation",  scopeChecklist: ["Engineer's assessment + repair plan", "Repair method (helical pier, push pier, concrete pier, slabjacking)", "Number of piers / locations", "Excavation + restoration", "Permit + inspection", "Lifetime transferable warranty (gold standard for structural fixes)"] },
    gutters:     { label: "gutters",     scopeChecklist: ["Gutter material (aluminum, copper, steel) + gauge", "Gutter size (5\" standard, 6\" for high-volume)", "Downspout count + sizing", "Hangers (hidden vs strap, spacing)", "Gutter guards (if quoted) — brand + type", "Removal of old gutters", "Materials warranty 20-50 years", "Labor warranty 1-5 years"] },
    garage_door: { label: "garage door", scopeChecklist: ["Door brand + model + insulation R-value", "Spring type (torsion vs extension) + lifetime spring upgrade", "Opener brand + horsepower + drive type (belt, chain, screw)", "New tracks + hardware", "Removal + disposal of old door", "Smart opener / Wi-Fi connectivity if quoted", "Door warranty 5-10 years", "Labor warranty 1-3 years", "Lifetime warranty on premium-tier springs"] },
    auto_repair: { label: "auto repair", scopeChecklist: ["Diagnostic findings in writing", "Parts type (aftermarket / OEM / dealer / remanufactured)", "Labor hours per job (book hours, not estimated)", "Shop supplies + disposal / hazmat fees", "Sales tax", "Warranty: parts + labor (12 mo / 12K miles industry standard)", "Itemized invoice not lump-sum"] },
    moving:      { label: "moving",      scopeChecklist: ["In-home / video estimate (not phone-only)", "Binding or non-binding estimate type (binding is safer)", "Itemized inventory list", "Valuation coverage (released $0.60/lb default OR full-value)", "Packing materials if needed", "Storage if needed (rates per month)", "Pickup + delivery window", "USDOT number visible on contract", "No deposit required (industry standard for interstate)"] },
    medical:     { label: "medical billing", scopeChecklist: ["Itemized bill with CPT/ICD codes (request from provider — they must give it)", "Explanation of Benefits (EOB) from insurance", "Verification you were billed correctly per your plan", "Negotiated cash-pay discount if uninsured", "Payment plan options without interest"] },
    legal:       { label: "legal fees",  scopeChecklist: ["Written engagement letter / fee agreement", "Hourly rate + minimum increment (often 0.1 hr / 6 min)", "Retainer amount + replenishment policy", "Detailed monthly invoices with task descriptions", "Out-of-pocket costs estimate (filing fees, expert witnesses, depositions)", "Cap or estimate on total project cost", "Conflict-of-interest disclosure"] }
  };

  function getVerticalContent(vertical) {
    return VERTICAL[vertical] || VERTICAL_BASELINE[vertical] || {
      label: "this work",
      scopeChecklist: ["Scope of work in writing", "Materials brand + grade in writing", "Labor itemized (hours or flat-rate)", "Permits + inspections", "Cleanup + disposal", "Warranty terms in writing"]
    };
  }

  // ── Renderer ───────────────────────────────────────────────────────────

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtMoney(n) {
    var v = Number(n);
    return isNaN(v) ? "" : "$" + Math.round(v).toLocaleString();
  }

  function ensureStyles() {
    if (document.getElementById("tp-prep-styles")) return;
    var s = document.createElement("style");
    s.id = "tp-prep-styles";
    s.textContent = ''
      + '.prep-page { max-width:880px; margin:0 auto; padding:32px 20px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#0f172a; }'
      + '.prep-hero { text-align:center; margin-bottom:32px; }'
      + '.prep-hero h1 { font-size:32px; font-weight:800; color:#1e3a5f; margin:0 0 8px; line-height:1.2; }'
      + '.prep-hero .sub { font-size:16px; color:#475569; margin:0; }'
      + '.prep-context { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin:18px 0 0; }'
      + '.prep-chip { background:#eff6ff; color:#1e3a5f; padding:6px 14px; border-radius:999px; font-size:13px; font-weight:600; border:1px solid #bfdbfe; }'

      + '.prep-section { background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:24px 28px; margin:18px 0; position:relative; }'
      + '.prep-section h2 { font-size:20px; font-weight:700; color:#0f172a; margin:0 0 14px; display:flex; align-items:center; gap:10px; }'
      + '.prep-section h2 .tag { font-size:11px; background:#1d4ed8; color:#fff; padding:3px 10px; border-radius:999px; letter-spacing:0.05em; }'
      + '.prep-section p { font-size:14px; line-height:1.6; color:#334155; margin:8px 0 12px; }'
      + '.prep-section ol, .prep-section ul { font-size:14px; line-height:1.7; color:#0f172a; padding-left:24px; margin:8px 0; }'
      + '.prep-section ol li, .prep-section ul li { margin:6px 0; }'

      + '.prep-flag { list-style:none; padding:12px 14px; margin:8px 0; border-radius:8px; border-left:4px solid #f59e0b; background:#fffbeb; }'
      + '.prep-flag strong { display:block; font-size:14px; color:#0f172a; margin-bottom:3px; }'
      + '.prep-flag .detail { font-size:13px; color:#475569; line-height:1.55; }'

      + '.prep-tactic { padding:14px 16px; margin:10px 0; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; }'
      + '.prep-tactic .head { font-size:14px; font-weight:700; color:#1e3a5f; margin-bottom:4px; }'
      + '.prep-tactic .detail { font-size:13px; color:#475569; line-height:1.55; margin:4px 0 8px; }'
      + '.prep-tactic .script { font-size:13px; font-style:italic; color:#0f172a; padding:10px 14px; background:#f0f9ff; border-left:3px solid #1d4ed8; border-radius:4px; line-height:1.6; }'

      // Locked state (free users) — teaser headlines visible, body blurred + overlay
      + '.prep-locked { position:relative; }'
      + '.prep-locked .prep-body { filter:blur(5px); pointer-events:none; user-select:none; min-height:140px; }'
      + '.prep-locked .prep-lock-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:10px; background:rgba(255,255,255,0.6); border-radius:14px; }'
      + '.prep-locked .prep-lock-overlay .lock-icon { font-size:22px; }'
      + '.prep-locked .prep-lock-overlay .lock-msg { font-size:14px; color:#1e3a5f; font-weight:600; }'

      // Top upsell card (always visible to free users at the top + bottom)
      + '.prep-upsell { background:linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%); color:#fff; border-radius:14px; padding:24px 28px; margin:24px 0; text-align:center; }'
      + '.prep-upsell h3 { font-size:22px; font-weight:800; margin:0 0 8px; }'
      + '.prep-upsell p { font-size:15px; opacity:0.95; margin:0 0 18px; line-height:1.55; }'
      + '.prep-upsell .cta { background:#fff; color:#1e3a5f; border:none; padding:14px 32px; border-radius:10px; font-size:16px; font-weight:700; cursor:pointer; font-family:inherit; transition:transform 0.15s; }'
      + '.prep-upsell .cta:hover { transform:translateY(-1px); }'
      + '.prep-upsell .price-note { font-size:13px; opacity:0.85; margin-top:10px; }'

      + '@media (max-width:600px) { .prep-section { padding:18px 20px; } .prep-hero h1 { font-size:24px; } .prep-upsell { padding:20px 22px; } .prep-upsell h3 { font-size:18px; } }';
    document.head.appendChild(s);
  }

  function renderUpsellCard(opts) {
    var price = opts.price || 19;
    var verticalLabel = opts.verticalLabel || "your project";
    return ''
      + '<div class="prep-upsell">'
      + '  <h3>Unlock your full ' + escHtml(verticalLabel) + ' Quote-Prep Kit</h3>'
      + '  <p>Everything below: 15+ tailored questions, scope checklist, red flags, negotiation playbook, brand cheat sheet, rebates worksheet. Walk into every contractor call prepared.</p>'
      + '  <button type="button" class="cta" data-prep-cta>Get my Prep Kit · $' + price + '</button>'
      + '  <div class="price-note">One-time. 30 days of Pro across all 20 verticals. 7-day refund if you haven\'t opened any locked section.</div>'
      + '</div>';
  }

  function renderQuestionsHtml(content, isPro) {
    var verticalQs = (content && content.questions) || [];
    var all = verticalQs.concat(GENERIC_QUESTIONS);
    var items = all.map(function (q) { return '<li>' + escHtml(q) + '</li>'; }).join("");
    return ''
      + '<section class="prep-section' + (isPro ? '' : ' prep-locked') + '">'
      + '  <h2>Questions to Ask Each Contractor <span class="tag">PRO</span></h2>'
      + '  <div class="prep-body">'
      + '    <p>Bring this list to every quote call. Tailored to your vertical + generic must-asks.</p>'
      + '    <ol>' + items + '</ol>'
      + '  </div>'
      + (isPro ? '' : '<div class="prep-lock-overlay"><div class="lock-icon">&#128274;</div><div class="lock-msg">' + all.length + ' tailored questions unlocked with Prep Kit</div></div>')
      + '</section>';
  }

  function renderRedFlagsHtml(content, isPro) {
    var vFlags = (content && content.redFlags) || [];
    var all = vFlags.concat(GENERIC_RED_FLAGS);
    var items = all.map(function (f) {
      return '<li class="prep-flag"><strong>' + escHtml(f.label) + '</strong>'
        + (f.detail ? '<div class="detail">' + escHtml(f.detail) + '</div>' : '')
        + '</li>';
    }).join("");
    return ''
      + '<section class="prep-section' + (isPro ? '' : ' prep-locked') + '">'
      + '  <h2>Red Flags to Watch For <span class="tag">PRO</span></h2>'
      + '  <div class="prep-body">'
      + '    <p>Walking into the call knowing what to spot is half the battle.</p>'
      + '    <ul style="list-style:none; padding:0;">' + items + '</ul>'
      + '  </div>'
      + (isPro ? '' : '<div class="prep-lock-overlay"><div class="lock-icon">&#128274;</div><div class="lock-msg">' + all.length + ' red flags unlocked with Prep Kit</div></div>')
      + '</section>';
  }

  function renderScopeChecklistHtml(content, isPro) {
    var items = (content && content.scopeChecklist) || [];
    var lis = items.map(function (s) { return '<li>' + escHtml(s) + '</li>'; }).join("");
    return ''
      + '<section class="prep-section' + (isPro ? '' : ' prep-locked') + '">'
      + '  <h2>Scope Checklist <span class="tag">PRO</span></h2>'
      + '  <div class="prep-body">'
      + '    <p>The line items every quote MUST include. If a contractor leaves one of these off, ask why — and get it in writing.</p>'
      + '    <ul>' + lis + '</ul>'
      + '  </div>'
      + (isPro ? '' : '<div class="prep-lock-overlay"><div class="lock-icon">&#128274;</div><div class="lock-msg">' + items.length + '-item scope checklist unlocked</div></div>')
      + '</section>';
  }

  function renderTacticsHtml(isPro) {
    var items = GENERIC_TACTICS.map(function (t) {
      return ''
        + '<div class="prep-tactic">'
        + '  <div class="head">' + escHtml(t.headline) + '</div>'
        + '  <div class="detail">' + escHtml(t.detail) + '</div>'
        + (t.script ? '<div class="script">' + escHtml(t.script) + '</div>' : '')
        + '</div>';
    }).join("");
    return ''
      + '<section class="prep-section' + (isPro ? '' : ' prep-locked') + '">'
      + '  <h2>Negotiation Playbook <span class="tag">PRO</span></h2>'
      + '  <div class="prep-body">'
      + '    <p>Five tactics with example wording you can use when quotes come in.</p>'
      + items
      + '  </div>'
      + (isPro ? '' : '<div class="prep-lock-overlay"><div class="lock-icon">&#128274;</div><div class="lock-msg">5-tactic playbook with scripts unlocked</div></div>')
      + '</section>';
  }

  // Brand + rebate + warranty content lives in pro-tier.js. Reuse via
  // WoogoroPro — same single source of truth.
  function renderBrandHtml(vertical, isPro) {
    var content = "";
    try {
      if (window.WoogoroPro && typeof window.WoogoroPro.renderProSections === "function") {
        // We only want the brand chunk — render with a minimal analysis stub.
        // brandContentForVertical is internal; instead, ask for the full
        // brand section and extract just the inner HTML if available.
        // Simpler: re-implement the same content here via a small dispatcher
        // that matches what pro-tier.js exposes through window.
      }
    } catch (e) {}
    // Inline minimal brand cheat-sheet (kept short — full content in pro-tier).
    var brand = {
      solar:    'Tier 1 panels (REC, Q Cells, SunPower, Hanwha) carry full 25-year warranties — worth the 5-10% premium. Microinverters (Enphase) isolate failures to one panel vs string inverters where one failure takes down the array.',
      roofing:  'Architectural shingles (GAF Timberline HDZ, CertainTeed Landmark, Owens Corning Duration, Malarkey Vista) are the modern standard. Synthetic underlayment + ice/water shield in valleys are non-negotiable.',
      hvac:     'Trane = American Standard (same factory, brand premium). Bryant = Carrier. Mid-tier (Carrier/Trane/Lennox) has the best parts availability. Mitsubishi / Daikin lead on heat pump efficiency in cold climates.',
      auto_repair: 'Aftermarket = cheapest, varies in quality. OEM = same part, plain box. Dealer = same part with 30-60% markup. Insist on OEM for safety-critical (brakes, airbags) and emissions parts.',
      windows:  'Vinyl is cheapest + most common. Fiberglass + composite cost more but expand/contract less. Triple-pane + Low-E + argon = standard high-efficiency package. Energy Star cert unlocks 30% / $600 federal credit.',
      kitchen:  'Stock cabinets (IKEA, builder-grade) cheapest. Semi-custom (Kraftmaid, Diamond) is the value sweet spot. Full custom = 2-3× the price. Quartz countertops (Caesarstone, Cambria) are more durable than granite for less maintenance.',
      siding:   'Vinyl is cheapest (CertainTeed, Mastic). Fiber cement (James Hardie) is the upgrade — fire-resistant, 30-50 year warranty. LP SmartSide is the modern engineered-wood option.',
      flooring: 'LVP (luxury vinyl plank — Coretec, Shaw) is the modern durable choice. Engineered hardwood for higher-end. Solid hardwood requires controlled humidity. Tile (Daltile, MSI) for wet rooms.',
      landscaping: 'Native plants are cheaper to maintain + better for local wildlife. Hardscape (pavers, stone) returns 60-80% at sale. Irrigation systems are vertical-licensed in most states — verify separately.'
    };
    var body = brand[vertical] || 'Ask for the brand + line + tier of every major material so you can comparison-shop. Generic descriptions like "premium quality" are a sign the contractor is being vague to lock in higher margin.';
    return ''
      + '<section class="prep-section' + (isPro ? '' : ' prep-locked') + '">'
      + '  <h2>Brand &amp; Tier Cheat Sheet <span class="tag">PRO</span></h2>'
      + '  <div class="prep-body">'
      + '    <p>' + escHtml(body) + '</p>'
      + '  </div>'
      + (isPro ? '' : '<div class="prep-lock-overlay"><div class="lock-icon">&#128274;</div><div class="lock-msg">Brand cheat sheet unlocked</div></div>')
      + '</section>';
  }

  function renderRebatesHtml(vertical, state, isPro) {
    var rebates = {
      solar:      'Federal 30% Investment Tax Credit (ITC) on system + battery + labor through 2032. State + utility rebates vary — check dsireusa.org for ' + (state || 'your state') + '. SREC markets (MD, NJ, MA, DC, OH, PA, DE) can add thousands over system life.',
      hvac:       'Federal 25C heat pump credit: 30% up to $2,000 for qualifying ENERGY STAR heat pumps. HEEHRA / HOMES rebates (IRA-funded): up to $8,000 for low-to-moderate income households. Utility rebates: $500-2,000 typical, itemized so it\'s not taxed.',
      windows:    'Federal 25C: 30% up to $600/year for ENERGY STAR windows. Save invoice + cert. State + utility rebates often $20-50 per window.',
      insulation: 'Federal 25C: 30% up to $1,200/year on insulation + air sealing. HOMES rebates: up to $8,000 for 35%+ energy reduction (requires pre/post energy assessment).'
    };
    var body = rebates[vertical] || 'Check dsireusa.org for any state + utility rebates that apply to your project. The federal energy efficient home improvement credit (25C) covers many home upgrades through 2032.';
    return ''
      + '<section class="prep-section' + (isPro ? '' : ' prep-locked') + '">'
      + '  <h2>Rebates &amp; Tax Credits Worksheet <span class="tag">PRO</span></h2>'
      + '  <div class="prep-body">'
      + '    <p>' + escHtml(body) + '</p>'
      + '  </div>'
      + (isPro ? '' : '<div class="prep-lock-overlay"><div class="lock-icon">&#128274;</div><div class="lock-msg">Rebates worksheet unlocked</div></div>')
      + '</section>';
  }

  // ── Main render ────────────────────────────────────────────────────────

  function renderPrepKit(opts) {
    opts = opts || {};
    ensureStyles();
    var vertical = opts.vertical || "generic";
    var content  = getVerticalContent(vertical);
    var label    = opts.verticalLabel || content.label || "project";
    var city     = opts.city || "";
    var state    = opts.state || "";
    var estimate = opts.estimate ? fmtMoney(opts.estimate) : "";
    var isPro    = !!opts.isPro;

    var chips = [];
    if (label)    chips.push('<span class="prep-chip">' + escHtml(label) + '</span>');
    if (city && state) chips.push('<span class="prep-chip">' + escHtml(city + ", " + state) + '</span>');
    else if (state)    chips.push('<span class="prep-chip">' + escHtml(state) + '</span>');
    if (estimate) chips.push('<span class="prep-chip">Est. ' + estimate + '</span>');

    var html = ''
      + '<div class="prep-page">'
      + '  <div class="prep-hero">'
      + '    <h1>Your ' + escHtml(label) + ' Quote-Prep Kit</h1>'
      + '    <p class="sub">Everything you need to know before contractors arrive.</p>'
      + (chips.length ? '    <div class="prep-context">' + chips.join("") + '</div>' : '')
      + '  </div>'
      + (isPro ? '' : renderUpsellCard({ verticalLabel: label, price: 19 }))
      + renderQuestionsHtml(content, isPro)
      + renderRedFlagsHtml(content, isPro)
      + renderScopeChecklistHtml(content, isPro)
      + renderTacticsHtml(isPro)
      + renderBrandHtml(vertical, isPro)
      + renderRebatesHtml(vertical, state, isPro)
      + (isPro ? '' : renderUpsellCard({ verticalLabel: label, price: 19 }))
      + '</div>';

    return html;
  }

  function wireCheckoutButtons(rootEl, prepUrl) {
    if (!rootEl) return;
    var btns = rootEl.querySelectorAll("[data-prep-cta]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        if (!window.WoogoroPro || typeof window.WoogoroPro.startCheckout !== "function") {
          alert("Checkout temporarily unavailable. Please refresh and try again.");
          return;
        }
        window.WoogoroPro.startCheckout({ successUrl: prepUrl }).catch(function (e) {
          alert("Checkout error: " + (e && e.message ? e.message : "unknown"));
        });
      });
    }
  }

  window.WoogoroPrepKit = {
    renderPrepKit: renderPrepKit,
    wireCheckoutButtons: wireCheckoutButtons,
    getVerticalContent: getVerticalContent
  };
})();
