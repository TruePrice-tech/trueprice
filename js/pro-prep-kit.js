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
    plumbing: {
      label: "plumbing",
      questions: [
        "Is this a repair, a replacement, or a remodel of existing plumbing?",
        "What is the age and material of my current pipes? (Galvanized over 50 years and polybutylene should both be replaced — they fail.)",
        "For water heater work: tank or tankless? Gas, electric, or heat-pump hybrid? What is the BTU rating or first-hour gallons rating?",
        "Are you using PEX, copper, or CPVC for repipe work? Why is that the right choice for my situation?",
        "For sewer line work: trenchless (pipe bursting / cure-in-place liner) or open excavation? What is the warranty difference?",
        "Will the work require shutting off water? For how long? Will I have water during the day?",
        "Is a permit required? (Water heater install, repipe, sewer line, and gas line all require permits in most cities.)",
        "Is wall / ceiling repair (drywall + paint) included if you have to open walls for repipe?",
        "Are you charging hourly or flat-rate? If hourly, what is the rate and how is travel time billed?"
      ],
      redFlags: [
        { label: "\"We need to repipe your whole house\" without clear evidence", detail: "Unless your pipes are galvanized > 50 years or polybutylene (known failure material), a single leak does not justify a $5-15K whole-house repipe. Get a second opinion before signing." },
        { label: "Emergency markup more than 1.5x normal rate", detail: "After-hours / weekend rates can fairly run 1.5x — anything more (3-5x is common) is gouging. If possible, get a second emergency quote." },
        { label: "No expansion tank quoted with water heater install", detail: "Required by code in most jurisdictions when there is a backflow preventer (modern systems). A $50-150 part — leaving it off causes warranty failure and water hammer." },
        { label: "Refuses to itemize parts vs labor", detail: "Reputable plumbers separate parts and labor on the invoice. Lump-sum hides 2-3x markup on common parts (a $30 fill valve becomes a $120 line item)." }
      ],
      scopeChecklist: [
        "Written diagnostic + scope of work (not verbal)",
        "Parts (brand + model) in writing",
        "Labor (hourly rate + estimated hours, OR flat-rate per job)",
        "Permits if required (water heater, repipe, sewer, gas line)",
        "Code-required upgrades (expansion tank, pressure regulator, seismic strapping in CA, drip pan + drain on water heaters in finished spaces)",
        "Wall / ceiling repair (drywall + paint) if walls must be opened — included or explicitly separate",
        "Pressure test of new lines before closing walls",
        "Cleanup + haul-off of old fixtures, pipes, water heater",
        "Inspection by code authority (if permitted)",
        "Workmanship warranty 1-5 years on labor (in writing)",
        "Manufacturer warranty on parts (water heater tanks: 6 years base, 12 years premium)",
        "Itemized invoice, not lump-sum"
      ]
    },
    electrical: {
      label: "electrical",
      questions: [
        "Will this work require a permit? (Most cities require permits for any panel work, new circuits, service upgrade, EV charger, or generator install.)",
        "Is this code-compliant to the latest NEC adopted by my jurisdiction?",
        "For panel upgrades: what is the new amperage (100A / 200A / 400A)? Will you re-use the existing meter base, or is a meter swap with the utility required?",
        "For EV charger install: Level 2 (240V)? What amperage circuit (40A / 50A / 60A)? Is a dedicated subpanel needed?",
        "For generator install: is an automatic transfer switch included? What is the load-shed configuration (whole home, essential circuits only)?",
        "Are you using copper or aluminum wire? (Aluminum is acceptable for service entry and large feeders if properly terminated with anti-oxidant compound. Branch wiring should be copper.)",
        "Will you provide a load calculation for any service or panel upgrade?",
        "Are GFCI / AFCI breakers included where code requires (kitchen, bathroom, bedrooms, outdoor, garage)?",
        "Will you handle the inspection appointment and sign-off?",
        "What is the labor warranty? (1-2 years is standard.)"
      ],
      redFlags: [
        { label: "No permit pulled for permit-required work", detail: "Panel work, service upgrade, EV charger install, and generator install all require permits in most jurisdictions. Unpermitted electrical work is illegal AND voids your homeowner's insurance if a fire happens." },
        { label: "Aluminum branch wiring (vs service entry / feeders)", detail: "Aluminum is fine for service entry and large feeders. Aluminum branch wiring (15A / 20A circuits) is a documented fire hazard — should not be installed today, and existing aluminum branch wiring is grounds for remediation, not extension." },
        { label: "No load calculation for service / panel upgrade", detail: "Without one, you may end up with an undersized panel (limits future EV / heat pump adds) or oversized (wasted cost). A code-compliant load calc is included in any reputable quote." },
        { label: "Significantly cheaper than other quotes", detail: "Verify they are licensed, insured, AND pulling permits. Unlicensed electrical work is the #1 cause of residential electrical fires." }
      ],
      scopeChecklist: [
        "Permit + inspection (any panel, service, EV, generator, or new-circuit work)",
        "Materials (wire gauge, breaker type + amperage, panel brand + capacity)",
        "Labor itemized (hours or flat-rate per task)",
        "Code-required protection: GFCI (kitchen, bath, garage, outdoor), AFCI (bedrooms + most habitable rooms), tamper-resistant outlets (all new outlets)",
        "Grounding and bonding to current code (ground rod / Ufer / water bond)",
        "Box fill calculations (especially in remodels with multiple devices)",
        "Coordination with utility for service upgrades (meter base swap, temporary disconnect)",
        "Removal + disposal of old panel / wiring / fixtures",
        "Drywall opening + closing if walls opened (included or explicitly separate)",
        "Final inspection appointment + green tag / sign-off",
        "Workmanship warranty 1-2 years on labor (in writing)",
        "Manufacturer warranty on parts (breakers + devices)"
      ]
    },
    windows: {
      label: "windows",
      questions: [
        "What brand and product line? (Andersen 100/200/400 series, Pella Lifestyle / Reserve, Marvin Elevate / Signature, Milgard, Simonton, etc.)",
        "What frame material? (Vinyl = cheapest, fiberglass = best stability, wood = most expensive + needs maintenance, composite = hybrid)",
        "What glass package? (Double-pane Low-E + argon is the modern minimum; triple-pane + krypton for cold climates)",
        "Are these ENERGY STAR certified for my climate zone? (Required to claim the federal 25C credit — 30% up to $600/year.)",
        "Are these full-frame replacement or insert (retrofit) windows? (Full-frame is more thorough; insert is faster but keeps the existing frame.)",
        "Is removal + disposal of the old windows included?",
        "Is new interior trim / window stool included? Is exterior caulking + flashing included?",
        "Is lead-paint testing required? (Pre-1978 homes require RRP-certified contractor — adds cost but legally required.)",
        "What is the materials warranty (20+ years standard for premium brands) and labor warranty (5-10 years for reputable installers)?"
      ],
      redFlags: [
        { label: "Generic \"high-efficiency windows\" without brand + line", detail: "\"Premium vinyl windows\" is not a spec. Demand brand + product line + frame material + glass package in writing. Brand-name comparison is the only way to know what you are paying for." },
        { label: "Not ENERGY STAR certified for your climate zone", detail: "Climate zone matters — a window certified for the South may not qualify for the federal 25C credit in the North. Get the cert number for your zone in writing." },
        { label: "Insert (retrofit) install priced like full-frame", detail: "Insert windows are 30-50% faster to install than full-frame. If you are getting insert price but full-frame markup, push back. Insert install also means you keep any existing rot in the frame — verify the frames are sound first." },
        { label: "No mention of caulking + flashing", detail: "These are what make a window weather-tight. If they are not in the quote, you will get leaks and the warranty will not cover water damage." }
      ],
      scopeChecklist: [
        "Window brand + product line + frame material (vinyl, fiberglass, wood, composite)",
        "Glass package (double vs triple pane, Low-E coating, argon or krypton gas)",
        "ENERGY STAR certification for your climate zone (required for 25C credit)",
        "Full-frame vs insert (retrofit) install — specified",
        "Removal + disposal of old windows",
        "New flashing + caulking around all openings (weather sealing)",
        "Interior trim / window stool / casing",
        "Exterior trim / capping where applicable",
        "Lead-paint testing + RRP compliance if home built pre-1978",
        "Drywall touch-up / paint if interior was disturbed",
        "Materials warranty 20+ years (full transferable preferred)",
        "Labor / installation warranty 5-10 years",
        "Federal 25C credit documentation (manufacturer cert + invoice for Form 5695)"
      ]
    },
    siding: {
      label: "siding",
      questions: [
        "What siding material? (Vinyl, fiber cement / James Hardie, LP SmartSide engineered wood, real wood, stucco, brick veneer.)",
        "If vinyl: brand + line + thickness (mil rating)? Premium vinyl is 0.044\"+ thick; cheap is 0.040\" or less and shows seams more.",
        "If fiber cement: is it pre-painted by manufacturer (ColorPlus) or painted on-site? Manufacturer-painted lasts 15-25 years; on-site painting needs repainting every 7-10.",
        "Is house wrap / moisture barrier (Tyvek, Typar, or similar) included and replaced?",
        "Is rigid foam insulation behind the siding included? (Adds R-value + breaks thermal bridging — worth the upcharge.)",
        "Is all new trim, fascia, soffit included, or just the wall siding?",
        "Is removal + disposal of old siding included? Will you check for and address any rot or pest damage found behind it?",
        "Is caulking + flashing around windows, doors, and penetrations included?",
        "What is the materials warranty (20-50 years for fiber cement / vinyl)? Is the labor warranty separate (1-10 years standard)?"
      ],
      redFlags: [
        { label: "Vinyl thinner than 0.040 inches", detail: "Builder-grade vinyl (0.035-0.040) cups, warps, and fades within 5-10 years. Mid-grade is 0.042\"+ and premium is 0.046\"+. Get the mil thickness in writing." },
        { label: "Fiber cement painted on-site without prep work itemized", detail: "Fiber cement should be back-primed + edge-sealed + caulked before paint, then primed + 2 coats of paint. If the quote skips these steps the paint will peel in 3-5 years. Manufacturer-painted (James Hardie ColorPlus) is the safer + longer-warrantied path." },
        { label: "No mention of replacing house wrap", detail: "If house wrap is torn or missing behind old siding, water leaks behind your new siding will cause hidden rot. New wrap is a $300-800 add — non-negotiable." },
        { label: "Rot / pest damage repair charged at unspecified rate", detail: "Some contractors find \"surprise\" rot and bill at $200/sheet for plywood replacement. Negotiate a rate (e.g. $80-120/sheet for sheathing) or a cap upfront so you do not get held hostage mid-job." }
      ],
      scopeChecklist: [
        "Siding material + brand + product line (vinyl mil thickness, fiber cement type, etc.)",
        "House wrap / moisture barrier — replaced where torn or missing",
        "Rigid foam insulation behind siding (if quoted) — type + R-value",
        "All trim, fascia, soffit replaced or specifically noted as kept",
        "Caulking + flashing around all windows, doors, and penetrations",
        "Removal + disposal of old siding + nails",
        "Rot / pest damage repair scope + per-sheet rate or cap",
        "Painting (if fiber cement painted on-site) — primer + 2 coats specified",
        "Permits if your jurisdiction requires (some cities require for re-side jobs)",
        "Cleanup with magnetic sweep for nails",
        "Materials warranty 20-50 years (transferable for top brands like James Hardie)",
        "Workmanship / labor warranty 1-10 years (in writing)"
      ]
    },
    insulation: {
      label: "insulation",
      questions: [
        "What insulation type? (Fiberglass batts cheapest; blown cellulose mid-tier and best for attics; open-cell spray foam adds air sealing; closed-cell spray foam adds vapor barrier + most R-value per inch but costs 3-5x batt.)",
        "What R-value will be installed? (Code minimum varies by climate zone: R-30 to R-60 for attics, R-13 to R-21 for walls.)",
        "Is air sealing included BEFORE insulation? (Sealing penetrations, top plates, recessed lights — this is what makes insulation actually work.)",
        "Is a vapor barrier required for my climate zone? If so, is it included?",
        "If working in the attic: are baffles installed at the eaves to maintain ventilation?",
        "If spray foam: what is the off-gas time? Will you do a blower-door test before and after?",
        "Will you do a pre / post home energy assessment? (Required to claim the HOMES rebate of up to $8,000 for 35%+ energy reduction.)",
        "Is removal + disposal of old insulation included if needed?",
        "What is the labor warranty (1-2 years standard)?"
      ],
      redFlags: [
        { label: "R-value lower than code minimum for your zone", detail: "Climate zones 1-3 attic: R-30 min, zones 4-8: R-49 to R-60. Walls: R-13 to R-21. A quote below code minimum is non-compliant and will fail any future energy rebate claim." },
        { label: "Insulation installed over uncleaned / unsealed surfaces", detail: "Insulation over a leaky attic floor = warm humid air bypasses the insulation and condenses on the cold roof deck = rot. Air sealing first is non-negotiable." },
        { label: "No blower-door test mentioned (spray foam jobs)", detail: "A pre/post blower door test confirms the air-tightness gain. Without it, you cannot prove the work was done well — and you cannot claim the HOMES rebate." },
        { label: "Asbestos / vermiculite NOT tested in pre-1980 homes", detail: "If your existing attic insulation is loose-fill vermiculite (common 1940s-1980s), it may contain asbestos. Disturbing it without testing + abatement is hazardous and illegal in most jurisdictions." }
      ],
      scopeChecklist: [
        "Insulation type (fiberglass, cellulose, spray foam — open or closed cell)",
        "R-value to be installed (must meet local code for your climate zone)",
        "Air sealing of all penetrations + top plates + recessed lights before insulation",
        "Vapor barrier where required by climate zone",
        "Baffles at eaves to preserve attic ventilation",
        "Pre + post blower-door test (spray foam jobs especially)",
        "Pre + post home energy assessment (required for HOMES rebate)",
        "Asbestos / vermiculite testing if pre-1980 home with loose-fill insulation",
        "Removal + disposal of old insulation if replacing",
        "Permits if structural changes (rare for insulation but required for some retrofit work)",
        "Materials warranty (lifetime for most rigid + batt; manufacturer-spec for spray foam)",
        "Labor warranty 1-2 years (in writing)"
      ]
    },
    painting: {
      label: "painting",
      questions: [
        "What paint brand + line + sheen? (Sherwin-Williams Duration, Benjamin Moore Aura, Behr Marquee — top tier. Don't accept 'good paint' as a spec.)",
        "How many coats? (2 is standard; 1 coat is a quality compromise that shows touch-ups.)",
        "What prep work is included? (Wash, scrape, sand, prime as needed, caulk minor cracks, fill nail holes.)",
        "Will you spot-prime any bare wood, water stains, tannin bleed (cedar, redwood)?",
        "For exterior: is power-washing included? Do you allow drying time (24-48 hrs) before painting?",
        "Lead-paint testing if pre-1978 home? (Required by law — EPA RRP-certified contractor needed.)",
        "Are drop cloths + masking included? Furniture moved / covered?",
        "What about cleanup + disposal of leftover paint cans?",
        "What is the workmanship warranty? (Exterior: 2-7 years standard. Interior: 1-3 years.)"
      ],
      redFlags: [
        { label: "1-coat quote without explicit price comparison to 2-coat", detail: "1-coat is a quality compromise that almost always shows touch-ups, especially with color change. The honest move: get both 1-coat and 2-coat quotes; only choose 1-coat if you understand the tradeoff." },
        { label: "Vague paint brand (\"premium paint\")", detail: "Insist on Brand + Product Line + Sheen in writing (e.g. \"Sherwin-Williams Duration, satin\"). Without this, the contractor can substitute a $20/gal contractor-grade paint for a $70/gal premium and pocket the difference." },
        { label: "No prep work itemized", detail: "Skipped prep = paint failure in 1-3 years. A reputable quote itemizes: power-wash, scrape, sand, prime as needed, caulk, fill nail holes. \"Paint will adhere to existing surface\" is not prep — it is a disclaimer." },
        { label: "Pre-1978 home, no lead-paint disclosure", detail: "Federal law requires contractors to be EPA RRP-certified and follow lead-safe practices when disturbing paint in pre-1978 homes. If they do not mention it, they are likely uncertified — and you are exposed to lead liability." }
      ],
      scopeChecklist: [
        "Paint brand + product line + sheen (e.g. Sherwin-Williams Duration Satin) — IN WRITING",
        "Number of coats (2 is standard, 3 for dramatic color change or untinted primer + 2 finish coats)",
        "Prep work: wash, scrape, sand, prime bare areas + stains",
        "Caulking minor cracks + filling nail holes",
        "Spot-priming any bare wood, water stains, tannin-bleed wood (cedar, redwood)",
        "Power-washing (exterior) with 24-48 hr drying time before paint",
        "Drop cloths + masking + furniture moved/covered",
        "Lead-paint RRP compliance if pre-1978 home",
        "Touch-ups after final walk-through",
        "Cleanup + paint can disposal (EPA-compliant)",
        "Leftover paint left labeled for future touch-ups",
        "Exterior workmanship warranty 2-7 years (interior 1-3 years)"
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
    },
    foundation: {
      label: "foundation",
      questions: [
        "Do you have a structural engineer's written assessment of the cause? (Settlement vs heave vs hydrostatic pressure call for different fixes.)",
        "What repair method? (Helical piers, push piers, concrete piers, slabjacking / mudjacking, polyurethane foam injection.)",
        "How many piers + at what locations? (Showed on a foundation plan?)",
        "What is the pier depth + load rating? (Piers must reach load-bearing strata — 10-40 ft typical depending on soil.)",
        "Is the warranty LIFETIME and TRANSFERABLE to future owners? (This is the gold standard for foundation work.)",
        "Is excavation + restoration (landscaping, hardscape, concrete) included or charged separately?",
        "Is a permit + city inspection included?",
        "Will you provide before / after photos + elevation measurements documenting the fix?",
        "For waterproofing / drainage: is interior drain tile, exterior membrane, or sump pump in scope? What's the drainage flow path?"
      ],
      redFlags: [
        { label: "No engineer's assessment", detail: "Foundation work without a structural engineer's diagnosis is guesswork. The contractor may sell you the most profitable repair (often piers) when a simpler fix (drainage, waterproofing) would solve the problem. Get an INDEPENDENT engineer's report before signing." },
        { label: "Warranty not transferable", detail: "Lifetime warranty that DOES NOT transfer with the home loses most of its value at sale. Reputable foundation contractors offer lifetime transferable on structural fixes — this is THE marker of a real warranty." },
        { label: "\"Lifetime\" warranty on slabjacking / foam injection", detail: "Slabjacking and polyurethane foam injection are limited-life fixes (5-15 years) — calling them \"lifetime\" is misleading. Reserve lifetime warranties for pier-based structural repair." },
        { label: "Pier count without a foundation plan", detail: "A reputable quote shows pier locations on a foundation plan (sketch is fine). \"We will install 8 piers around the foundation\" without locations means you can not verify the work matches the bid." }
      ],
      scopeChecklist: [
        "Structural engineer's written assessment + repair plan",
        "Repair method specified (helical pier, push pier, concrete pier, slabjacking, foam)",
        "Number of piers + pier locations on a foundation plan",
        "Pier depth + load rating (must reach load-bearing strata)",
        "Excavation + restoration (landscaping, hardscape, concrete) — included or explicit separate",
        "Permit + city inspection",
        "Before / after photos + elevation measurements",
        "Drainage / waterproofing scope if water intrusion is part of root cause",
        "Sump pump install / replacement (if quoted) — brand + GPM rating + battery backup",
        "Lifetime transferable workmanship warranty on the structural fix",
        "Materials warranty on pier hardware (manufacturer)",
        "Cleanup + restoration of disturbed areas"
      ]
    },
    concrete: {
      label: "concrete",
      questions: [
        "What thickness? (4 inches minimum for driveways, 6 inches for heavy loads / RV pad, 4 inches for patios + walkways.)",
        "What sub-base prep? (Compacted gravel base 4-6 inches is the difference between concrete that lasts 30 years and concrete that cracks in 5.)",
        "Is rebar or wire mesh reinforcement included? (Rebar is stronger and the modern standard for driveways. Wire mesh is the minimum for patios.)",
        "Are expansion joints + control joints cut to spec? (Expansion every 8-10 ft, control joints every 8-12 ft to control cracking.)",
        "What concrete PSI? (3,000 PSI minimum for residential; 4,000+ for driveways / freeze-thaw climates.)",
        "Is curing + sealing included? (Concrete needs to cure 7-28 days; sealing extends life and prevents salt damage in cold climates.)",
        "Is form removal + site cleanup included?",
        "Are you scoring + finishing patterns (broom finish, exposed aggregate, stamped) as specified?",
        "What is the labor warranty? (1-5 years standard for concrete work.)"
      ],
      redFlags: [
        { label: "Sub-base prep not specified", detail: "\"Pour over existing base\" or \"prep as needed\" hides the most important variable in concrete longevity. Cheap contractors skip compacted gravel — your driveway will crack within 5 years over poorly prepared sub-base." },
        { label: "Concrete PSI under 3,000", detail: "3,000 PSI is the residential minimum. 4,000+ for driveways and any freeze-thaw climate. Lower PSI = faster surface scaling + cracking." },
        { label: "No control joints in the quote", detail: "Control joints force concrete to crack where YOU want it (in the joint) instead of randomly across the surface. Skipping them or spacing them too far apart guarantees ugly random cracks." },
        { label: "Hot weather / cold weather pours without admixtures or curing protection", detail: "Concrete poured in extreme temperatures without retarder (hot) or accelerator + blankets (cold) will crack or fail to reach design strength. If your pour falls in extreme weather, ask what protection is in the scope." }
      ],
      scopeChecklist: [
        "Concrete thickness (4\" min residential, 6\" heavy load)",
        "Sub-base prep: compacted gravel 4-6\" specified",
        "Concrete PSI (3,000 min residential, 4,000+ for driveways / freeze-thaw)",
        "Rebar or wire mesh reinforcement (rebar preferred for driveways)",
        "Expansion joints (every 8-10 ft)",
        "Control joints cut to spec (every 8-12 ft)",
        "Finish type specified (broom, exposed aggregate, stamped, etc.)",
        "Curing time + protection (7-28 days, weather protection if extreme temps)",
        "Sealing (initial seal + recommendation for re-seal every 2-3 years)",
        "Form removal + site cleanup",
        "Permit if required (driveways often need them; patios usually don't)",
        "Workmanship warranty 1-5 years"
      ]
    },
    garage_door: {
      label: "garage door",
      questions: [
        "What door brand + model? (Clopay + Wayne Dalton + Amarr cover most price points.)",
        "What insulation R-value? (R-6 entry-level, R-12 mid, R-18+ for heated garages or extreme climates.)",
        "What spring type? (Torsion springs above the door = standard modern; extension springs on the sides = older, more dangerous, replaceable with torsion.)",
        "Is the lifetime spring upgrade included? ($50-150 more upfront, but lifetime warranty on the failure-prone part.)",
        "What opener brand + horsepower + drive type? (LiftMaster + Chamberlain + Genie lead the market. 1/2 HP for single-car, 3/4 HP for double or insulated doors. Belt drive = quietest, chain = cheapest + loudest.)",
        "Smart opener / Wi-Fi connectivity if quoted — brand + app?",
        "Are new tracks + hardware included or are you reusing existing?",
        "Is removal + disposal of the old door included?",
        "What is the door warranty (5-10 years), spring warranty (lifetime on premium), and labor warranty (1-3 years)?"
      ],
      redFlags: [
        { label: "Extension springs not upgraded to torsion", detail: "Extension springs (on the sides) are dangerous + outdated. Torsion springs (above the door) are the modern safer standard. If your existing system has extension springs, a quality install upgrades them — not reuses them." },
        { label: "Generic opener brand or no model #", detail: "\"High-quality opener\" is not a spec. Demand brand + model in writing. Cheap off-brand openers fail within 3-5 years; LiftMaster / Chamberlain / Genie have 10-15 year service lives." },
        { label: "Standard springs labeled as \"lifetime\"", detail: "Standard 10,000-cycle springs typically last 7-10 years (about 1 cycle/day). The genuine \"lifetime\" springs are 20,000+ cycle premium springs — verify the cycle rating in writing." },
        { label: "Re-using old tracks + hardware", detail: "Worn tracks can damage a new door + opener. If the existing hardware is more than 15 years old or shows visible wear, replacement should be in scope — not cleanup + lubricate." }
      ],
      scopeChecklist: [
        "Door brand + model + style + color",
        "Insulation R-value (R-6 entry, R-12 mid, R-18+ heated garages)",
        "Spring type (torsion preferred; lifetime / 20,000-cycle spring upgrade)",
        "Opener brand + model + horsepower (1/2 HP single, 3/4 HP double/insulated)",
        "Drive type (belt = quietest, chain = cheapest)",
        "New tracks + hardware (or explicitly documented if reusing)",
        "Smart / Wi-Fi connectivity if quoted",
        "Backup battery for opener (some jurisdictions require)",
        "Removal + disposal of old door + opener",
        "Weather stripping (bottom seal, side seals, top seal)",
        "Door warranty 5-10 years",
        "Spring warranty (lifetime on premium 20K-cycle)",
        "Labor warranty 1-3 years"
      ]
    },
    fencing: {
      label: "fencing",
      questions: [
        "What fence material? (Pressure-treated pine cheapest, cedar premium wood, vinyl maintenance-free, aluminum decorative, chain-link cheapest non-wood, composite (Trex) most expensive.)",
        "What height + length (linear feet) + number of gates?",
        "What post material + setting? (4x4 wood, metal, or vinyl posts; concrete-set is standard, dirt-set fails fast.)",
        "What is the post depth? (Must be BELOW frost line in cold climates — 30-48 inches typical; 6-12 inches in deep south.)",
        "Was a property line survey done or confirmed? (Critical: fences built on neighbor's land are demolition risk.)",
        "Is there a shared-fence agreement with neighbors if the line is shared?",
        "Permit required? (Most cities require for fences over 6-7 ft; HOA approval often required for any new fence.)",
        "Is removal + disposal of old fence included?",
        "What is the labor warranty (1-5 years standard)?"
      ],
      redFlags: [
        { label: "Post depth less than frost line", detail: "In freeze zones, posts set above frost line heave up + cause the whole fence to lean within 1-2 winters. Frost line varies — Minnesota is 48\", Atlanta is 6\". Verify your depth meets local code." },
        { label: "No property survey + neighbor agreement", detail: "Building a fence on neighbor's property (even 6 inches over) opens you to a demolition order. Cost of a survey ($300-600) is cheap insurance against $5K-10K demolition + rebuild." },
        { label: "Dirt-set posts on wood / vinyl fence", detail: "Posts not set in concrete (or with a proper concrete sleeve) loosen + lean within 5 years. Concrete setting is standard for any fence intended to last 15+ years." },
        { label: "No HOA disclosure if HOA exists", detail: "Most HOAs require pre-approval for new fences (style + color + height). Skipping this gets you a takedown notice + fines after install. Confirm HOA review is part of the contractor's process." }
      ],
      scopeChecklist: [
        "Fence material + style + height + linear footage",
        "Number of gates + gate hardware (heavy-duty hinges, latch, drop rod for double gates)",
        "Post material (4x4 wood, vinyl, metal) + post setting (concrete is standard)",
        "Post depth below local frost line",
        "Property line survey OR written acknowledgment of existing line markers",
        "Neighbor agreement if shared fence line (in writing)",
        "Permit if jurisdiction requires (height > 6-7 ft typical trigger)",
        "HOA approval if applicable",
        "Removal + disposal of old fence + concrete",
        "Cleanup with magnetic sweep for nails",
        "Materials warranty (manufacturer-spec, often 20-50 yr on vinyl/aluminum)",
        "Labor warranty 1-5 years"
      ]
    },
    gutters: {
      label: "gutters",
      questions: [
        "What gutter material + gauge? (.027\" aluminum cheapest, .032\" mid, copper premium. Thicker = longer life + less dent risk.)",
        "What size? (5\" K-style is the residential standard; 6\" is for high-volume roofs, large trees, heavy rain regions.)",
        "How many downspouts + what diameter? (3\"x4\" rectangular = standard; 4\" round = high-volume. Spacing 35-40 ft typical.)",
        "What hanger type + spacing? (Hidden hangers preferred over spike-and-ferrule; spacing 18-24\" max.)",
        "If gutter guards are quoted: what brand + type? (Reverse-curve like Gutter Helmet, micro-mesh like LeafFilter, screen guards, foam inserts.)",
        "Is removal + disposal of old gutters included?",
        "Is downspout extension / splash block included to direct water away from the foundation?",
        "Is fascia repair scope handled if rot is found behind old gutters?",
        "What is the materials warranty (20-50 years typical) and labor warranty (1-5 years)?"
      ],
      redFlags: [
        { label: "Thin aluminum (.025\" or less)", detail: "Cheap builder-grade aluminum (.025\") dents easily and fails within 10-15 years. .032\" is the residential standard for longer life. Get gauge in writing." },
        { label: "Downspouts spaced more than 40 ft apart", detail: "Under-spec downspouts cause overflow during heavy rain. Industry rule: 1 downspout per 30-40 linear feet of gutter — fewer = overflow + foundation water." },
        { label: "Generic gutter guard brand", detail: "Gutter guards range from $4/ft (DIY screens) to $20-40/ft (premium installed). Quoted at premium price but with generic brand = markup on builder-grade product. Demand brand + warranty in writing." },
        { label: "No fascia / soffit repair clause", detail: "Old gutters often hide rotted fascia behind them. If a quote does not address what happens when rot is found, you get hit with surprise charges mid-job. Negotiate a per-foot fascia repair rate upfront." }
      ],
      scopeChecklist: [
        "Gutter material + gauge (.032\" aluminum residential standard)",
        "Gutter size (5\" K-style standard, 6\" for high-volume)",
        "Downspout count + diameter (3\"x4\" rect or 4\" round) + spacing (30-40 ft max)",
        "Hanger type (hidden preferred) + spacing (18-24\" max)",
        "Downspout extensions / splash blocks / underground drainage if quoted",
        "Gutter guards if quoted — brand + product + warranty",
        "Removal + disposal of old gutters",
        "Fascia / soffit repair scope + per-foot rate if rot found",
        "Sealing of all joints + end caps",
        "Cleanup",
        "Materials warranty 20-50 years",
        "Labor warranty 1-5 years"
      ]
    },
    auto_repair: {
      label: "auto repair",
      questions: [
        "Can I get a written estimate BEFORE work begins? (Required by law in many states — CA, FL, NY among them.)",
        "Is the diagnostic fee applied to the repair cost if I proceed, or charged separately?",
        "What parts tier are you using — OEM (manufacturer), aftermarket (third-party, varies in quality), dealer-genuine (same as OEM, 30-60% markup), or remanufactured (factory rebuilt, often as-good-as-new)?",
        "For safety-critical work (brakes, airbags, suspension, steering): are you using OEM or OEM-equivalent? (Aftermarket is fine for non-safety items.)",
        "Are you billing by book hours (industry-standard time per task) or actual hours? (Book hours protect you from slow work.)",
        "What is the shop type — dealership (highest labor rate), independent (lower rate), or marque-specialist (Subaru-only, BMW-only, etc.)?",
        "What is the warranty? (Industry standard is 12 months / 12,000 miles on parts + labor for most repairs.)",
        "Will I get a final itemized invoice (not just \"misc parts\" lump sum)?",
        "If a sensor or part is intermittent, will you guarantee the repair fixes the symptom, or just charge for the part?"
      ],
      redFlags: [
        { label: "Verbal estimate only", detail: "Many states (CA, FL, NY, MA, others) require written estimates by law for any repair over a threshold (typically $100-200). Verbal-only means the shop can bill you whatever they want at pickup." },
        { label: "Diagnostic fee NOT applied to the repair", detail: "Standard practice: if you authorize the repair, the diagnostic fee gets applied to the bill. Shops that charge it separately are double-dipping." },
        { label: "Pushing OEM / dealer-genuine for non-safety items", detail: "OEM is critical for brakes, airbags, sensors, emissions parts. For other items (filters, belts, hoses), quality aftermarket is functionally identical at 40-60% less cost. Watch for OEM-pushing on items where aftermarket is fine." },
        { label: "Estimated hours instead of book hours", detail: "Reputable shops bill by book hours (the industry-standard time published per task). \"It might take longer\" = open-ended bill. If they refuse book hours, get another quote." }
      ],
      scopeChecklist: [
        "Written diagnostic findings (specific failure, not generic \"needs replacement\")",
        "Written estimate before work begins (often required by state law)",
        "Diagnostic fee applied to repair if you proceed",
        "Parts tier specified (OEM / OEM-equivalent / aftermarket / reman) + brand",
        "Labor billed by book hours (or flat-rate per job)",
        "Shop supplies + hazmat / disposal fees disclosed",
        "Sales tax (separate line)",
        "Final itemized invoice (parts + labor + supplies separate, not lump-sum)",
        "Warranty: 12 months / 12,000 miles on parts + labor (industry standard for most repairs)",
        "Return of any replaced parts on request (your right in most states)",
        "Diagnostic re-check at no charge if the symptom returns within warranty"
      ]
    },
    moving: {
      label: "moving",
      questions: [
        "Will you do an in-home or video estimate? (Phone-only estimates are notoriously low + lead to bait-and-switch.)",
        "Is this a BINDING or non-binding estimate? (Binding = price locked, can't go up. Non-binding = price can go up 10-25% on pickup day.)",
        "What is your USDOT number? (Required for interstate moves; verify on safer.fmcsa.dot.gov before signing.)",
        "What valuation coverage is included? (Default \"released value\" = $0.60/lb. Full-value protection is the upgrade — covers actual repair/replacement cost.)",
        "Is packing material included or extra? Is packing labor included or extra?",
        "Is storage available if needed? Daily rate vs monthly?",
        "What is the pickup window + delivery window? (Interstate moves usually have a 1-10 day delivery window — not a fixed date.)",
        "What is your deposit policy? (Industry standard for interstate moves is NO deposit — you pay on delivery.)",
        "What payment methods do you accept on delivery? (Cash-only on delivery is a major red flag.)"
      ],
      redFlags: [
        { label: "Phone-only estimate (no in-home or video)", detail: "Movers who give phone-only estimates are setting up bait-and-switch. The price quoted will be 30-100% higher on pickup day when \"the load is heavier than expected.\" Insist on in-home or video estimate." },
        { label: "Deposit requested for interstate move", detail: "Industry standard + FMCSA guidance: NO deposit on interstate moves. You pay on delivery. A deposit request is a strong scam signal — many movers disappear with deposits." },
        { label: "Cash-only on delivery", detail: "Reputable interstate movers accept credit card or certified check on delivery. Cash-only on delivery means you have no chargeback recourse if items are damaged or missing." },
        { label: "No USDOT number or unverifiable on FMCSA", detail: "All interstate movers MUST have a USDOT number. Verify it on safer.fmcsa.dot.gov — confirms they are licensed + carrying insurance. If their USDOT does not check out, they are not a legitimate mover." }
      ],
      scopeChecklist: [
        "In-home or video estimate (NOT phone-only)",
        "BINDING estimate type (locked price) — not non-binding (can increase)",
        "USDOT number on contract + verified on safer.fmcsa.dot.gov",
        "MC number (Motor Carrier authority) on contract for interstate",
        "Itemized inventory list (every box + furniture piece numbered)",
        "Valuation coverage tier specified (released $0.60/lb baseline OR full-value)",
        "Packing labor + materials — included or explicitly separate (with rates)",
        "Storage rates (if needed) — daily + monthly",
        "Pickup window + delivery window (interstate: 1-10 days delivery typical)",
        "NO DEPOSIT for interstate (industry standard + FMCSA guidance)",
        "Payment method on delivery (credit card or certified check, NOT cash-only)",
        "Claim process + timeline if items damaged / missing"
      ]
    },
    medical: {
      label: "medical billing",
      questions: [
        "Can I get a fully itemized bill with CPT codes + ICD diagnosis codes? (Federal law requires the provider to give you this on request — but they often will not unless you ask.)",
        "Can I get the Explanation of Benefits (EOB) from my insurance? (Shows what insurance paid vs what is your responsibility.)",
        "Have you confirmed the charges are correct for my insurance plan? (Billing errors are common — 30-80% of medical bills contain errors per industry studies.)",
        "Is there a cash-pay discount if I am uninsured or paying in full? (Often 30-60% off the chargemaster rate.)",
        "What is your financial hardship policy? (Most hospitals have one — many will reduce bills 25-90% based on income.)",
        "What is your interest-free payment plan policy?",
        "If this is an out-of-network charge that should be in-network: does the No Surprises Act protect me? (Emergency care + most ER physicians, anesthesia, radiology at in-network hospitals.)",
        "Will you hold off sending to collections while a dispute is open?",
        "Is this charge subject to my deductible / out-of-pocket max?"
      ],
      redFlags: [
        { label: "Lump-sum bill with no CPT / ICD breakdown", detail: "Federal law (and most state laws) require providers to give you itemized bills on request. Without CPT + ICD codes you cannot verify what you are being billed for. Common scam: $5,000 \"facility fee\" with no detail." },
        { label: "Out-of-network charges from an in-network facility", detail: "Under the No Surprises Act (effective 2022), you cannot be balance-billed for: emergency care, AND non-emergency care from out-of-network providers at in-network facilities (anesthesia, radiology, ER physicians, etc.). Push back hard if you see this." },
        { label: "Sent to collections during an active dispute", detail: "Sending an account to collections while you have an open dispute may violate FDCPA + state consumer-protection laws. Reputable providers will hold collections while a dispute is open. Get this in writing." },
        { label: "Surprise charges for services you did not knowingly consent to", detail: "If you were not given a separate consent + cost estimate for a service (e.g. an in-room TV, a separate physician consult), you may not legally owe for it. Demand documentation of consent." }
      ],
      scopeChecklist: [
        "Fully itemized bill with CPT (procedure) + ICD (diagnosis) codes",
        "Explanation of Benefits (EOB) from your insurance for reconciliation",
        "Verification of network status (in vs out) for every provider involved",
        "No Surprises Act protection check (emergency + ancillary providers at in-network facility)",
        "Cash-pay / prompt-pay discount offer if uninsured or paying in full (often 30-60% off)",
        "Financial hardship policy + application form (most hospitals have one — many waive 25-90%)",
        "Interest-free payment plan terms",
        "Collections hold while dispute is open",
        "Charity care policy review (federally required for nonprofit hospitals)",
        "Application of correct deductible + out-of-pocket maximum"
      ]
    },
    legal: {
      label: "legal fees",
      questions: [
        "Will I get a written engagement letter that specifies scope + fee structure before any work begins? (This is required by professional rules in every state.)",
        "Hourly rate + minimum billing increment? (0.1 hr / 6 min is the industry standard. 0.25 hr / 15 min is rounding up and costs you 30%+ more.)",
        "Is the retainer 'evergreen' (replenished as drawn down) or a one-time deposit? What is the replenishment threshold + notice?",
        "Will I get monthly itemized invoices showing task + time + attorney rate per entry?",
        "Will you use block billing (\"researched and drafted motion, 4.0 hrs\") or task-by-task billing (\"researched case law on X, 1.5 hrs; drafted motion section 1, 2.5 hrs\")? (Block billing is a red flag.)",
        "Is there a cap or budget estimate on total project cost? Will you notify me before exceeding it?",
        "What out-of-pocket costs (filing fees, deposition costs, expert witnesses) will be billed and at what markup?",
        "Have you run a conflict-of-interest check? Will you disclose if a conflict arises mid-case?",
        "What is the policy if I want to terminate representation — am I liable for the full retainer or only work done?"
      ],
      redFlags: [
        { label: "No written engagement letter", detail: "Required by professional rules of conduct in every state. Without one, fees are disputable AND the attorney has no enforceable agreement either. If they will not provide one, walk away." },
        { label: "0.25 hr (15 min) minimum billing increments", detail: "Industry standard is 0.1 hr (6 min). A 2-minute phone call billed at 0.25 hr costs you 7.5x what it should. Over a complex case this adds up to thousands." },
        { label: "Block billing (lumping multiple tasks together)", detail: "Block billing (\"researched, drafted, revised brief — 8.0 hrs\") hides padding. Task-by-task billing (\"researched case X for 1.5 hrs; drafted section A for 2.0 hrs\") is the professional standard + audit-friendly." },
        { label: "Evergreen retainer with no notice or threshold", detail: "An evergreen retainer that gets auto-replenished from your bank without notice is a recipe for runaway fees. Demand: written notice X days before each replenishment + a hard threshold (e.g. notify me when retainer drops below $2K)." }
      ],
      scopeChecklist: [
        "Written engagement letter / fee agreement (required by state professional rules)",
        "Hourly rate + minimum billing increment (0.1 hr / 6 min industry standard)",
        "Retainer amount + replenishment policy + notice threshold",
        "Monthly itemized invoices (task + time + attorney rate per entry)",
        "Task-by-task billing format (NOT block billing)",
        "Out-of-pocket cost estimate (filing fees, depositions, expert witnesses) + markup policy",
        "Budget cap or estimate on total project cost + notification before exceeding",
        "Conflict-of-interest check + ongoing disclosure obligation",
        "Termination policy (refund of unused retainer)",
        "Communication policy (response time, who handles questions)",
        "File ownership / transfer policy if you change attorneys"
      ]
    }
  };

  // Slug normalization — result-footer passes "garage-door" / "auto-repair"
  // but content keys use underscores. Mirror pro-tier.js detectVertical().
  function normalizeVerticalSlug(v) {
    if (!v) return "generic";
    return String(v).toLowerCase().replace(/-/g, "_");
  }

  function getVerticalContent(vertical) {
    var key = normalizeVerticalSlug(vertical);
    return VERTICAL[key] || {
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
      windows:  'Andersen + Pella + Marvin lead the premium tier (wood, fiberglass, composite). Vinyl: Simonton, Milgard, Alside cover the value tier — adequate for most homes, lighter on the warranty. Frame material matters more than brand: fiberglass > composite > vinyl > wood (for stability). Triple-pane + Low-E + argon = standard high-efficiency package. Energy Star cert unlocks the 30% / $600 federal 25C credit.',
      kitchen:  'Stock cabinets (IKEA, builder-grade) cheapest. Semi-custom (Kraftmaid, Diamond) is the value sweet spot. Full custom = 2-3× the price. Quartz countertops (Caesarstone, Cambria) are more durable than granite for less maintenance.',
      siding:   'Vinyl is cheapest (CertainTeed, Mastic). Fiber cement (James Hardie) is the upgrade — fire-resistant, 30-50 year warranty. LP SmartSide is the modern engineered-wood option.',
      flooring: 'LVP (luxury vinyl plank — Coretec, Shaw) is the modern durable choice. Engineered hardwood for higher-end. Solid hardwood requires controlled humidity. Tile (Daltile, MSI) for wet rooms.',
      landscaping: 'Native plants are cheaper to maintain + better for local wildlife. Hardscape (pavers, stone) returns 60-80% at sale. Irrigation systems are vertical-licensed in most states — verify separately.',
      plumbing:    'Water heaters: Rheem + Bradford White are workhorse mid-tier; A.O. Smith is solid premium. Spend the extra $100 for the 12-year warranty over the 6-year — same tank, longer cover. Pipes: PEX (cheap, flexible, freeze-resistant) is modern standard; copper for short runs and existing copper systems. AVOID polybutylene (known failure material — should be replaced, not extended). Faucets: Moen + Delta own the value-to-premium range with serviceable cartridges. Toilets: Toto + Kohler lead on flush; American Standard solid mid-tier. Sewer line: trenchless (pipe bursting / cure-in-place liner) costs 30-50% more but avoids tearing up driveways and landscape.',
      electrical:  'Panels: Square D (QO premium, Homeline value) and Eaton are the workhorses; Siemens is solid. AVOID Federal Pacific (FPE), Zinsco, and Pushmatic — known failure brands that insurance companies flag and that should be replaced rather than added to. EV chargers: Wallbox, ChargePoint, Tesla Wall Connector cover most needs; do not pay for smart features you will not use. Generators: Generac dominates whole-home (largest service network); Kohler is premium with longer warranties; Briggs & Stratton budget tier. Wire: copper for branch circuits (15A / 20A), aluminum acceptable for service entry and large feeders if properly terminated with anti-oxidant compound.',
      foundation:  'Pier methods: helical piers (screwed into load-bearing strata, fastest install, best for lighter loads) vs push piers (hydraulically driven, best for heavier loads + deep soils) vs concrete piers (cheapest, slowest, may not reach load-bearing strata). Slabjacking + polyurethane foam injection are limited-life cosmetic fixes (5-15 years), NOT structural — do not accept them with a "lifetime" warranty label. The contractors with real engineering depth (Olshan, Ram Jack, Foundation Repair of CA) carry lifetime transferable warranties on pier work. Local independents can match this — verify the warranty is in writing + transferable.',
      concrete:    'Mix design: 3,000 PSI minimum residential, 4,000+ for driveways + freeze-thaw climates, 4,500-5,000 for heavy-load (RV pad, commercial). Fiber-reinforced concrete adds crack resistance at minimal cost. Decorative options: broom finish (cheapest, best traction), exposed aggregate (mid-tier, durable), stamped (highest cost, requires resealing every 2-3 years). Sealing: penetrating sealers (silane, siloxane) last 5-10 years and are invisible; topical sealers wear off + can yellow in 1-3 years. In cold climates, sealing is critical to prevent salt + freeze-thaw scaling.',
      garage_door: 'Door brands: Clopay + Wayne Dalton + Amarr cover most price points (Clopay is the value leader, Amarr the premium). Insulation: R-6 entry (single steel pan), R-12 mid (foam-injected double-steel), R-18+ for heated garages or extreme climates. Springs: torsion (modern standard, above the door, safer + longer-lived) vs extension (older, dangerous, replaceable). Cycle ratings: 10,000-cycle springs last ~7-10 years (1 cycle/day); 20,000+ cycle "lifetime" springs cost $50-150 more upfront. Openers: LiftMaster + Chamberlain + Genie lead. Belt drive = quietest (worth it for attached garages under bedrooms); chain = cheapest; screw = mostly obsolete.',
      fencing:     'Wood: pressure-treated pine cheapest but warps + needs staining every 2-3 years. Cedar premium wood — naturally rot-resistant, ages to silver-gray if unstained, lasts 15-30 years. Vinyl: CertainTeed (Bufftech) + Veranda are the established brands — maintenance-free + 20-30 year warranty + 2-3× wood cost upfront. Aluminum decorative: best for pool/yard borders, won\'t rust like wrought iron. Chain link: cheapest non-wood but offers no privacy. Composite (Trex Seclusions): most expensive, longest warranty (25-yr), best for those who hate maintenance.',
      gutters:     'Aluminum is the workhorse (95% of residential): .032\" gauge is the residential standard (.027\" is builder-grade and dents easily). Steel: stronger but rusts at the seams, mostly commercial. Copper: 50-100 year life but 3-5× aluminum cost. Sizes: 5\" K-style for typical residential, 6\" for high-volume roofs or heavy-rain regions (Pacific NW, FL). Gutter guards: micro-mesh (LeafFilter, Gutter Guard, HomeCraft) is the modern standard — keeps everything out but lets water through. Reverse-curve (Gutter Helmet) works in low-debris areas. Foam inserts + plain screens are cheap but clog over time.',
      auto_repair: 'Parts tiers: OEM (manufacturer-original, plain or branded box) > OEM-equivalent (made by same factory, sold to multiple buyers — e.g. Bosch, Denso, ACDelco) > quality aftermarket (Moog, Cardone, AC Delco Professional) > generic aftermarket (varies). DEALER parts = same OEM with 30-60% markup for the dealer name. Remanufactured: factory-rebuilt with new wear parts, often as-good-as-new with 1-year warranty, 30-50% cheaper than OEM. Shop type pricing: dealership labor rate is roughly 1.4× independent. Marque-specialist shops (Subaru-only, BMW-only) match dealer expertise at independent prices and are often the best value for higher-end vehicles.',
      moving:      'Mover types: BINDING ESTIMATE (price locked) is the safer choice — non-binding can go up 10-25% on pickup day. Brokers vs carriers: brokers (Allied, North American, Mayflower) subcontract the actual move to carriers; small local movers do their own work. For interstate moves, ALWAYS verify USDOT number on safer.fmcsa.dot.gov. Valuation coverage: released $0.60/lb is the no-cost baseline (a $1,000 TV gets $30 if destroyed); full-value protection is the upgrade (~1-2% of inventory value) and covers actual replacement cost. For high-value items (jewelry, art, electronics) you may need third-party insurance — moving company valuation has low caps per item.',
      medical:     'Common bill reducers: (1) Itemize then audit (30-80% error rate per industry studies). (2) Negotiate cash-pay discount if uninsured (often 30-60% off chargemaster). (3) Apply for charity care (nonprofit hospitals are federally required to have a program — many waive 25-90% by income). (4) Push back on out-of-network charges at in-network facilities (No Surprises Act, 2022). Third-party bill negotiators (Resolve, Goodbill) charge 15-25% of savings — fine for $10K+ bills, overkill for smaller ones. State Attorney General can intervene in collection disputes.',
      legal:       'Fee structures: hourly (most common, 0.1 hr / 6 min increments are standard), flat-fee (preferred for predictable work like wills, simple contracts), contingency (typical for plaintiff-side personal injury / employment, 33-40% of recovery), hybrid (reduced hourly + contingency). State bar associations have public records of disciplinary actions — search before retaining. For complex matters, request a fee committee review if you suspect over-billing. AmLaw 100 firms charge $700-1,500/hr in major markets; boutique + solo can match expertise at $250-500/hr.'
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
      windows:    'Federal 25C: 30% up to $600/year for ENERGY STAR windows in your climate zone. Save invoice + manufacturer certification. State + utility rebates often $20-50 per window — stack them. ' + (state ? 'Check dsireusa.org for ' + escHtml(state) + '.' : ''),
      insulation: 'Federal 25C: 30% up to $1,200/year on insulation + air sealing materials. HOMES rebates (IRA-funded, rolling state-by-state): up to $8,000 for a 35%+ energy reduction in your home (requires pre/post home energy assessment by a certified rater). HEEHRA: up to $1,600 for insulation + air sealing for low-to-moderate income households. ' + (state ? 'Check ' + escHtml(state) + ' specifics on dsireusa.org.' : ''),
      siding:     'Siding is generally NOT eligible for federal energy credits (unlike windows / insulation / heat pumps). Limited utility rebates exist for adding rigid foam insulation behind siding in some service areas — ask your installer to itemize the insulation upgrade separately if quoted, so you can claim any 25C credit (30% up to $1,200/yr) on that portion. ' + (state ? 'Check ' + escHtml(state) + ' utility rebates on dsireusa.org.' : ''),
      painting:   'Painting is not directly tax-credit eligible. However, if a lead-paint abatement is required (pre-1978 homes with kids under 6 or pregnant women), HUD lead-hazard reduction grants may cover up to $20,000 per unit in qualifying areas. ' + (state ? 'Check ' + escHtml(state) + ' lead-hazard programs.' : ''),
      foundation: 'Foundation repair is not directly tax-credit eligible, but: (1) if the work is needed because of a federally-declared natural disaster, FEMA may reimburse; (2) some states offer property-tax abatement for documented major repair (check ' + (state || 'your state') + ' assessor); (3) the repair cost adds to your home cost basis, reducing capital-gains tax at future sale.',
      concrete:   'Concrete work is generally not eligible for federal energy credits. Some utility rebates exist for "cool pavement" (reflective concrete) in heat-island cities like Phoenix and LA — niche. Cost basis adjustment at sale is the main tax benefit. ' + (state ? '' : ''),
      garage_door: 'Garage doors are NOT eligible for the federal 25C energy efficient home improvement credit (excluded by statute). However, an insulated garage door can qualify for some utility rebates ($50-200 typical) in cold-climate utility service areas — check before installing. ' + (state ? 'Look up ' + escHtml(state) + ' rebates on dsireusa.org.' : ''),
      fencing:     'Fencing has no federal tax credits. Some HOAs offer rebates for "preferred" fence materials (vinyl, certain wood) to maintain neighborhood standards — ask your HOA. Cost basis adjustment at sale captures the value if you ever sell.',
      gutters:     'Gutters do not have federal tax credits. Some utilities in flood-prone areas (parts of TX, LA, FL) offer rebates for downspout extensions / rain barrels that reduce runoff. ' + (state ? 'Check ' + escHtml(state) + ' utility rebates on dsireusa.org.' : ''),
      auto_repair: 'No federal tax credits for routine auto repair. Some states offer credits for emissions-related repairs that bring older vehicles into compliance (CA Bureau of Automotive Repair Consumer Assistance Program covers $500-1,200 for low-income owners). Many state programs exist — search your state DMV + "vehicle emissions repair assistance."',
      moving:      'Moving expenses are NOT tax-deductible for most people (changed in 2018 Tax Cuts and Jobs Act). EXCEPTIONS: active-duty military moving on orders can still deduct expenses on Form 3903. Some employers offer relocation reimbursement — ask HR before you pay out of pocket.',
      medical:     'IRS medical expense deduction: any medical expenses over 7.5% of AGI are deductible IF you itemize. HSA / FSA: pre-tax money for qualifying medical bills. State-level patient-protection laws: NY, CA, MD, MA, CO have stronger surprise-billing protection than federal — check your state. Hospital financial assistance applications: legally required for nonprofit hospitals — request the form.',
      legal:       'Legal fees are deductible only for SPECIFIC purposes: (1) employment discrimination cases (whistleblower, civil rights), (2) tax advice for your business, (3) trade or business activity. Personal legal fees (divorce, will preparation, civil disputes) are NOT deductible. Confirm with a CPA before relying on this.',
      plumbing:   'Heat pump water heaters qualify for the federal 25C credit (30% up to $2,000 cap shared with HVAC heat pump credit). HEEHRA / HOMES rebates: up to $1,750 for a heat pump water heater for low-to-moderate income households. Many utilities offer $300-700 rebates for heat pump water heaters and high-efficiency tankless gas units — check before installing. ' + (state ? 'Look up rebates for ' + escHtml(state) + ' on dsireusa.org.' : ''),
      electrical: 'Federal 25C electrical panel upgrade credit: 30% up to $600 when the upgrade enables a qualifying improvement (heat pump, induction range, EV charger). Federal 30C EV charger credit: 30% up to $1,000 for residential installs in qualifying census tracts (low-income or non-urban). HEEHRA: up to $4,000 toward an electrical panel upgrade for low-to-moderate income households. ' + (state ? 'Check ' + escHtml(state) + ' rebates on dsireusa.org.' : '')
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
    var vertical = normalizeVerticalSlug(opts.vertical || "generic");
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
