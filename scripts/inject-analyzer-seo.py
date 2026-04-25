"""inject-analyzer-seo.py — add analyzer-focused SEO content to all 20
analyzer pages. Different from estimate pages: focuses on reading quotes,
red flags, line items to verify, and warranty/scope checklists.

Idempotent via <!-- TP-ANALYZER-SEO-V1 --> marker.
"""

import re
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Per-vertical analyzer content. Each vertical gets:
# - line_items: key fields every quote should include
# - red_flags: vertical-specific overcharge / lowball / omission patterns
# - hidden_costs: items often missing from quotes that become change orders
# - warranty: what warranty terms to expect
# - faqs: analyzer-focused (not cost-focused) FAQs
VERTICALS = {
    "roofing": {
        "page": "roofing-quote-analyzer.html",
        "label": "Roofing",
        "noun": "roofing quote",
        "intro": "A roofing quote should tell you exactly what's coming off, what's going on, and what's getting replaced in between. The biggest pricing gaps between contractors usually come down to tear-off scope, underlayment type, and flashing work &mdash; not the shingle brand.",
        "line_items": [
            ("Total installed cost", "Labor + materials + tear-off + disposal + permit, all-in. If a quote breaks these out separately, make sure nothing is marked 'TBD'."),
            ("Roof size in squares", "1 square = 100 sq ft. Most 2,000 sq ft homes have 22&ndash;28 squares of actual roof area after pitch factor."),
            ("Shingle brand and product line", "GAF Timberline HDZ, Owens Corning Duration, CertainTeed Landmark. Knowing the exact product lets you verify manufacturer warranty and compare quotes apples-to-apples."),
            ("Underlayment type", "Synthetic (e.g., GAF FeltBuster) vs 15-lb felt. Synthetic is lighter, more durable, and standard on quality jobs."),
            ("Ice and water shield", "Required in most cold climates at eaves and valleys. Should be listed by brand (e.g., GAF WeatherWatch)."),
            ("Drip edge + starter strip", "Drip edge is code-required in most states. Starter strip prevents wind uplift on first course."),
            ("Flashing replacement", "Step flashing, counter flashing, valley metal, pipe boots. Reusing old flashing is the #1 cause of leaks on a new roof."),
            ("Ridge vent and ventilation", "Proper ventilation preserves shingle warranty. Look for linear feet of ridge vent + intake soffit venting."),
            ("Decking repair allowance", "Quote should specify rate ($2&ndash;$5/sq ft typical) for replacing any rotted plywood found during tear-off."),
            ("Permit + inspection", "$200&ndash;$1,000 depending on jurisdiction. If not listed, ask who is pulling it &mdash; homeowner or contractor."),
            ("Warranty terms", "Manufacturer (25-yr to lifetime shingle warranty) + workmanship (usually 2&ndash;10 years from contractor)."),
        ],
        "red_flags": [
            ("\"Lifetime\" warranty without details", "Manufacturer lifetime warranties have fine print &mdash; they require all-same-brand components (shingles, underlayment, starter, ridge cap, ventilation). If the quote mixes brands, you don't actually get the lifetime warranty."),
            ("Roof-over (installing over existing layer)", "Saves $1,500&ndash;$3,500 now but hides rotted decking, voids most manufacturer warranties, reduces lifespan 20&ndash;40%. Most jurisdictions only allow 2 total layers."),
            ("No starter strip or drip edge listed", "These add $1&ndash;$2/sq ft. If missing from scope, either the crew is skipping them (common cause of early leaks) or it's a lowball quote that will come with change orders."),
            ("Missing underlayment brand", "If the quote just says \"underlayment\" without a product name, it's probably 15-lb felt &mdash; the cheapest option and not what you want for a 30-year shingle roof."),
            ("No decking repair rate", "Tear-off always finds some rotten plywood. If the quote has no rate for decking replacement, expect an on-the-spot upcharge mid-job."),
            ("Vague \"workmanship warranty\"", "Should specify years (2, 5, 10, lifetime) and what's covered (leaks only? materials + labor?). \"Standard warranty\" means nothing legally."),
            ("No tear-off of flashing or pipe boots", "New shingles over old flashing is how roofs leak. Quote should call out replacement of all flashing and pipe boots."),
        ],
        "hidden_costs": [
            "Decking replacement beyond allowance ($2&ndash;$5/sq ft)",
            "Chimney re-flashing if not in base scope ($300&ndash;$1,000)",
            "Skylight reflashing or replacement ($200&ndash;$1,500)",
            "Satellite dish removal / reinstall ($100&ndash;$300)",
            "Premium shingle upgrade (architectural &rarr; designer)",
            "Second-story / steep-pitch labor surcharge (10&ndash;30%)",
        ],
        "faqs": [
            ("What should be on a legitimate roofing quote?", "Total installed cost, roof size in squares, shingle brand + product line, underlayment type, ice and water shield coverage, flashing replacement scope, drip edge and starter strip, ridge vent specs, decking repair allowance, permit details, and warranty terms (manufacturer + workmanship)."),
            ("How do I know if my roofing quote is a fair price?", "Compare the per-square or per-square-foot price against local benchmarks for the same shingle tier and scope. A typical architectural shingle job runs $4.50-$8.50/sq ft installed. Lower than that usually means skipped tear-off, cheap underlayment, or reused flashing. Higher than $10/sq ft should include premium shingles or complex pitch/access."),
            ("What are red flags in a roofing quote?", "Roof-over instead of tear-off, missing underlayment brand, no drip edge or starter strip listed, no decking repair rate, mixed-brand materials claiming a \"lifetime\" warranty, vague \"standard\" workmanship warranty, and missing permit details."),
            ("What's the difference between workmanship and manufacturer warranty?", "Manufacturer warranty covers defective shingles (25 years to lifetime from GAF, Owens Corning, etc.) but often excludes labor to replace them. Workmanship warranty (2&ndash;10 years from contractor) covers install errors, leaks, and labor. Both matter &mdash; a cheap contractor with a 1-year workmanship warranty is a risk."),
            ("Should I accept a verbal quote or emailed number?", "No. Every legitimate roofing contract should be itemized in writing with scope, materials, warranty terms, timeline, payment schedule, and license/insurance details. Verbal agreements are effectively unenforceable when problems arise."),
        ],
    },
    "hvac": {
        "page": "hvac-quote-analyzer.html",
        "label": "HVAC",
        "noun": "HVAC quote",
        "intro": "HVAC quotes vary dramatically in quality. Two quotes for the \"same\" system can differ by $3,000&ndash;$6,000 based on SEER rating, Manual J load calc, ductwork modifications, and refrigerant type &mdash; details that often get buried. A good analyzer quote line-items all of this.",
        "line_items": [
            ("System type and tonnage", "Central AC + furnace, heat pump, mini-split. Tonnage (2, 2.5, 3, 3.5, 4, 5) should be justified by Manual J load calculation, not square footage alone."),
            ("Brand and model numbers", "Carrier, Trane, Lennox, Rheem, Goodman, etc. Exact model number lets you verify SEER, AFUE, and warranty registration."),
            ("SEER / SEER2 rating", "Minimum 14 SEER (15 SEER2) required by 2023+ DOE rules. Higher efficiency (18-20 SEER2) costs more upfront but qualifies for tax credits."),
            ("AFUE rating (furnace)", "80% AFUE = standard; 96% AFUE = high-efficiency condensing furnace. High-efficiency qualifies for rebates in cold climates."),
            ("Refrigerant type", "R-410A being phased out under EPA AIM Act. New installs from 2025+ should use R-454B or R-32. Reject R-22 outright &mdash; it's been banned since 2020."),
            ("Manual J load calculation", "Required by IRC M1401.3 in most states. A contractor who sizes by square footage alone is guessing &mdash; often oversizing by 30&ndash;50%."),
            ("Ductwork modifications", "Return and supply duct additions, sealing, replacement. Leaky ducts waste 20&ndash;30% of system output."),
            ("Condensate line and drain pan", "Float switch on secondary drain pan should be included on attic installs."),
            ("Thermostat", "Smart thermostat (ecobee, Nest) should be itemized if included, not bundled vaguely."),
            ("Haul-off and disposal", "Old equipment removal should be included with itemized refrigerant reclaim."),
            ("Permit and Manual D/S", "Local permit + Manual D (duct sizing) + Manual S (equipment selection) if code requires."),
            ("Warranty terms", "Parts (5&ndash;10 yrs registered), compressor (10&ndash;12 yrs), labor (usually 1&ndash;2 yrs; 10-yr available on premium)."),
        ],
        "red_flags": [
            ("Oversizing \"just to be safe\"", "Bigger isn't better. An oversized AC cycles on/off rapidly, fails to dehumidify, and wears out faster. If a contractor quotes 4 tons for a 2,000 sq ft home without Manual J, they're padding."),
            ("R-22 or ambiguous refrigerant", "R-22 has been banned in new installs since 2020. Any quote with R-22 means used or gray-market equipment. R-410A is acceptable today but phasing out &mdash; new installs in 2026+ should use R-454B."),
            ("No Manual J load calculation", "Sizing by square footage alone is how contractors over-sell tonnage. Required by code in most states; ask to see the calculation."),
            ("\"Ductwork is fine as-is\"", "Ducts 15+ years old or with visible damage waste 20&ndash;30% of output. A legitimate quote inspects and prices repairs or replacements separately."),
            ("Parts warranty without labor", "Parts are often covered 10 years by manufacturer. Labor to install them usually only 1&ndash;2 years. Getting a 10-year labor warranty is a real perk; a 1-year labor warranty on a $10,000 install isn't."),
            ("No manufacturer registration", "Most Carrier/Trane/Lennox warranties require registration within 60&ndash;90 days. If the installer doesn't handle it, your warranty drops from 10 years to 5."),
            ("Federal tax credit not itemized", "The Energy Efficient Home Improvement Credit (up to $2,000 on heat pumps) is real money. If a high-efficiency system isn't itemized as tax-credit-eligible, either it doesn't qualify or the contractor doesn't know."),
        ],
        "hidden_costs": [
            "Pad replacement / new slab for outdoor unit ($150&ndash;$500)",
            "Electrical disconnect or new breaker ($200&ndash;$800)",
            "New line set if existing is undersized or damaged ($400&ndash;$1,200)",
            "Refrigerant charge beyond factory ($100&ndash;$400)",
            "Duct modifications to match new equipment ($500&ndash;$3,000)",
            "Gas line upsize for high-efficiency furnace ($300&ndash;$800)",
            "Condensate pump on basement installs ($200&ndash;$500)",
        ],
        "faqs": [
            ("What should be on a legitimate HVAC quote?", "System type and tonnage, brand and exact model numbers, SEER/AFUE ratings, refrigerant type, Manual J load calculation, ductwork scope, thermostat, condensate setup, permit, and full warranty terms (parts + compressor + labor years)."),
            ("How do I know if my HVAC quote is fair?", "Compare price against local benchmarks for the same tonnage and efficiency tier. A 3-ton 15-SEER2 system typically runs $6,000&ndash;$10,000 installed. Below $5,000 usually means cheap equipment or skipped permits. Above $14,000 should include premium efficiency (18+ SEER2), major duct work, or complex install."),
            ("What are red flags in an HVAC quote?", "No Manual J, R-22 refrigerant, oversized tonnage without justification, \"ductwork is fine\" without inspection, parts warranty without matching labor warranty, no federal tax credit itemization on qualifying systems, and missing manufacturer registration."),
            ("Should I replace AC and furnace together?", "If both are 10+ years old: yes, usually. Matched systems are more efficient, most contractors offer 10&ndash;20% bundle discount, and you only take one install disruption. A good quote will itemize both components separately so you can see the bundle savings."),
            ("What's the difference between SEER and SEER2?", "SEER2 is the new 2023+ testing standard and runs about 4&ndash;5% lower than old SEER for the same equipment. A 14 SEER unit under old rules is roughly 13.4 SEER2 under new rules. Minimum legal SEER2 is 14.3 in northern states, 15.2 in southern states."),
        ],
    },
    "plumbing": {
        "page": "plumbing-quote-analyzer.html",
        "label": "Plumbing",
        "noun": "plumbing quote",
        "intro": "Plumbing quotes are notoriously vague. Flat-rate pricing (which most residential plumbers use) can hide huge markups on parts. A good quote breaks out the diagnosis, the specific fix, parts pricing, and warranty &mdash; not just a single number.",
        "line_items": [
            ("Diagnosis and scope", "What's actually wrong and what will be fixed. \"Repair leak\" is too vague &mdash; should specify location, cause, and resolution (replace pipe, solder joint, swap valve, etc.)."),
            ("Parts pricing (itemized)", "Each fixture, valve, fitting with part number. Flat-rate pricing hides 300&ndash;500% markups on $10 parts billed as $50."),
            ("Labor rate and hours", "$100&ndash;$200/hour typical. If flat-rate, should still note estimated hours so you can compare."),
            ("Trip / service call fee", "Usually $75&ndash;$150 and should be credited toward the job if you proceed."),
            ("Permit", "Required for: water heater install, sewer line work, gas line, major re-piping. $50&ndash;$500 depending on city."),
            ("Warranty terms", "Parts (manufacturer, typically 1&ndash;10 years) + labor (contractor, typically 30 days to 2 years)."),
            ("Material specs", "For re-pipes: PEX vs copper vs CPVC. For water heaters: tank vs tankless, brand, gallons, recovery rate."),
            ("Code compliance notes", "Backflow preventer, expansion tank on water heater, PRV on incoming main, proper venting."),
            ("Cleanup and disposal", "Old water heater haul-off, debris removal, and wall/floor restoration if applicable."),
        ],
        "red_flags": [
            ("Flat-rate quote without itemization", "Most residential plumbers use flat-rate pricing books that include 300&ndash;500% parts markup. Without itemization, you can't tell if a $500 faucet swap is labor-heavy or just inflated."),
            ("\"Emergency\" premium during business hours", "After-hours emergency rates (1.5x&ndash;2x) are legitimate. Charging emergency rates on a Tuesday afternoon is not."),
            ("No permit on water heater or sewer work", "Water heater and sewer line work almost always require a permit. Skipping saves time but voids insurance claims and fails home inspections."),
            ("No expansion tank on new water heater", "Required by code in most jurisdictions when a check valve or PRV exists. $40 part, $100 to install &mdash; if missing, ask why."),
            ("No warranty on labor", "A 1-year parts warranty is standard (manufacturer). Labor warranty under 30 days is a red flag. Good plumbers offer 1&ndash;2 years on labor."),
            ("Quote without a diagnosis", "Pricing a repair without investigating the cause leads to recurring leaks. If a plumber quotes \"replace water heater\" without checking the T&P valve, anode rod, or supply line, they're guessing."),
            ("Push for full re-pipe on minor leaks", "Galvanized pipe does fail eventually, but a single joint leak doesn't mean a whole-house re-pipe is urgent. Get a second opinion on any quote over $5,000."),
        ],
        "hidden_costs": [
            "Drywall repair after access ($100&ndash;$500)",
            "Tile or flooring replacement after access",
            "New shutoff valves during fixture replacement ($50&ndash;$150 each)",
            "Gas line upsize for tankless water heater ($300&ndash;$800)",
            "Venting modifications for new water heater ($100&ndash;$500)",
            "Soft-copper to PEX transitions during re-pipe",
        ],
        "faqs": [
            ("Why is my plumbing quote so expensive?", "Flat-rate pricing books mark up parts 300&ndash;500% and bundle labor tight. A $10 valve becomes a $50 line item; 30 minutes of labor becomes a 1-hour minimum. Plus trip fee ($75&ndash;$150), emergency surcharge, and permit. Always ask for itemization."),
            ("What should a plumber's quote include?", "Diagnosis, scope of fix, itemized parts with manufacturer/model, labor rate and estimated hours, trip fee, permit status, warranty terms (parts + labor), and cleanup/disposal. Vague flat-rate \"$500 to fix the leak\" tells you nothing."),
            ("What are red flags in a plumbing quote?", "Flat-rate without itemization, no permit on water heater or sewer, no expansion tank, labor warranty under 30 days, quote without diagnosis, and pressure to do a full re-pipe for a single-joint leak."),
            ("Should I get a second opinion on a plumbing quote?", "Yes, especially for any job over $2,000. Plumbing is high-variance &mdash; a $4,000 sewer scope/replacement from one plumber might be $1,500 from another for the same scope. Most plumbers will give free estimates for defined work."),
            ("Is a permit required for plumbing work?", "Yes for: water heater replacement (most states), any sewer line work, gas line modifications, re-piping, and new fixture groups in remodels. Permits cost $50&ndash;$500 but protect your insurance and resale."),
        ],
    },
    "electrical": {
        "page": "electrical-quote-analyzer.html",
        "label": "Electrical",
        "noun": "electrical quote",
        "intro": "Electrical work is heavily code-regulated and dangerous if done wrong. A quality quote specifies wire gauge, breaker amperage, circuit count, box counts, grounding method, and permit &mdash; not just a lump sum. Unpermitted electrical work can void your insurance.",
        "line_items": [
            ("Scope and outlet/fixture counts", "Specific count of receptacles, switches, fixtures, and dedicated circuits added or modified."),
            ("Wire gauge (AWG)", "12 AWG for 20-amp circuits, 14 AWG for 15-amp. Aluminum vs copper matters for code compliance on older homes."),
            ("Breaker size and type", "Standard, AFCI (arc fault), GFCI (ground fault), or dual-function (code requires these in bedrooms, kitchens, bathrooms)."),
            ("Panel specs (for upgrades)", "Amp rating (100, 200, 400 amp), brand (Square D, Eaton, Siemens), and slot count."),
            ("Service entrance work", "Meter socket, service drop, grounding rods, ground wire to water pipe and rebar (UFER ground)."),
            ("Permit and inspection", "Required for: panel upgrades, service changes, new circuits, major additions. $100&ndash;$500 typical, sometimes higher."),
            ("Warranty terms", "Labor (typically 1&ndash;2 years) + parts (manufacturer warranty, often 10+ years on breakers)."),
            ("Drywall access and repair", "New circuit runs require drywall cuts. Should specify repair scope (patch + paint or just patch)."),
            ("Licensed electrician", "Work should be performed by or under supervision of licensed journeyman or master. License number should appear on quote."),
        ],
        "red_flags": [
            ("No permit on panel upgrade or service change", "Panel swaps and service upgrades always require permit + inspection. Unpermitted work voids homeowner's insurance and fails home inspections at resale."),
            ("Federal Pacific / Zinsco / Challenger panels", "If your existing panel is Federal Pacific, Zinsco, or Challenger, a conscientious electrician will flag it &mdash; these are fire hazards and are often refused by insurance companies. A quote that ignores this is cutting corners."),
            ("Aluminum wiring without AlumiConn/COPALUM", "Homes with 1960s&ndash;1970s aluminum branch circuits need special connectors (AlumiConn or COPALUM) or complete re-wire. Just using copper pigtails is not code-compliant."),
            ("Missing AFCI/GFCI protection", "Code requires AFCI in most living areas and GFCI in kitchens, bathrooms, garages, exteriors, basements. Quote should specify which circuits get which protection."),
            ("\"We'll use the old wire\"", "Re-using wire of unknown age/condition on a new panel is a fire risk. Quote should specify new wire for new runs and inspection of existing circuits."),
            ("No grounding upgrade on old homes", "Pre-1960s homes often have 2-prong outlets with no ground. A panel upgrade quote should include bringing grounding up to code (rods + water pipe + rebar)."),
            ("Unlicensed \"handyman\" electrical", "Electrical work performed without a license is illegal in most jurisdictions and voids insurance. Check state license lookup before hiring."),
        ],
        "hidden_costs": [
            "Drywall and paint repair after access ($200&ndash;$1,500)",
            "Code-required AFCI/GFCI breakers on upgrade ($30&ndash;$75 each)",
            "Service upgrade from utility (meter + drop)",
            "Grounding electrode system upgrade ($200&ndash;$600)",
            "Smoke/CO detector upgrades if wired system is opened",
            "Permit + inspection fees beyond quote estimate",
            "Replacing ungrounded outlets flagged during work",
        ],
        "faqs": [
            ("What should be on a legitimate electrical quote?", "Scope with outlet/fixture/circuit counts, wire gauge, breaker sizes and types (AFCI/GFCI), panel specs for upgrades, service entrance work, permit status, warranty (labor + parts), drywall repair scope, and licensed electrician info with license number."),
            ("Why does a panel upgrade cost so much?", "A 200-amp panel upgrade typically runs $2,500&ndash;$5,000 installed. That includes the panel ($400&ndash;$800), breakers ($200&ndash;$600), service entrance work, grounding upgrade, permit ($150&ndash;$500), and 6&ndash;10 hours of licensed labor. Add $500&ndash;$1,500 if utility has to replace the service drop."),
            ("What are red flags in an electrical quote?", "No permit on panel or service work, Federal Pacific/Zinsco/Challenger panels ignored, aluminum wiring without proper connectors, missing AFCI/GFCI protection, re-using old wire, unlicensed labor, and no grounding upgrade on older homes."),
            ("Do I need a permit for electrical work?", "Yes for: panel upgrades, service changes, new circuits, major additions, and any work involving the main disconnect. No (usually) for: outlet/switch replacement, fixture swaps, minor repairs. When in doubt, pull the permit &mdash; it protects your insurance."),
            ("Can a handyman do electrical work?", "In most states, no. Electrical work must be performed by a licensed electrician (or homeowner on their own property under specific permit conditions). Unlicensed work is illegal, dangerous, and voids insurance coverage."),
        ],
    },
    "solar": {
        "page": "solar-quote-analyzer.html",
        "label": "Solar",
        "noun": "solar quote",
        "intro": "Solar quotes are dense with numbers that often confuse more than clarify. The metric that matters is <strong>dollars per watt</strong> &mdash; everything else (panels, inverter, tax credit estimates) should map back to that. Quotes ranging from $2.50/W to $5.00/W for similar systems are common.",
        "line_items": [
            ("System size in kilowatts (kW)", "DC watts of panel capacity. A typical residential system is 6&ndash;10 kW."),
            ("Dollars per watt (before incentives)", "Gross cost / system size. Fair market: $2.50&ndash;$3.50/W in 2026. Above $4/W is a premium or padded quote; below $2.25/W warrants scrutiny."),
            ("Panel brand, wattage, and count", "e.g., 24 x REC Alpha Pure 400W = 9.6 kW. Premium: REC, SunPower, Q Cells. Mid: LG, Panasonic, Hanwha. Budget: ZNSHINE, Trina."),
            ("Inverter type and brand", "Microinverters (Enphase IQ8): more expensive but panel-level optimization. String inverter + optimizers (SolarEdge): mid-tier. String only: cheapest but shade-sensitive."),
            ("Mounting system", "Flush-mount (asphalt/shingle), tile hooks, ground-mount. Brand matters: IronRidge, Unirac are quality."),
            ("Production estimate (annual kWh)", "Based on roof orientation, pitch, shading, and local solar irradiance. Should be tied to a shading analysis tool (Helioscope, Aurora)."),
            ("Offset percentage", "How much of your current electric usage the system will cover. 100% offset is the common target; above 110% is wasted for net-metered customers."),
            ("Federal tax credit", "30% of gross system cost through 2032. Should be clearly shown as a separate line, not bundled into net price."),
            ("State / utility rebates", "Vary by state. Should be itemized if applicable."),
            ("Monitoring system", "Enphase Enlighten, SolarEdge monitoring, etc. Should be included free or itemized."),
            ("Warranty terms", "Panels: 25-year production + 25-year product (premium) vs 12-year product (budget). Inverter: 12&ndash;25 yrs. Workmanship: 10&ndash;25 yrs. Roof penetration: 10 yrs minimum."),
        ],
        "red_flags": [
            ("Price quoted only as monthly payment", "A $199/month solar lease or loan can mean $80,000 total cost over 25 years. Always ask for the <strong>gross cash price</strong> and <strong>$/watt</strong> first."),
            ("Tax credit misrepresented as \"discount\"", "Some sales tactics bundle the 30% federal tax credit into the price as if the contractor is giving a discount. The credit is YOUR credit (requires filing IRS Form 5695) &mdash; you get it whether you buy from this contractor or another."),
            ("Leases and PPAs pushed over purchase", "Leases transfer the tax credit to the leasing company, tie up your roof for 20&ndash;25 years, and often make homes harder to sell. Cash purchase or loan almost always wins financially."),
            ("Production estimate without shading analysis", "A real quote includes a shading report (pylon/trees/other roofs). If the production estimate is \"based on your roof size\" with no site analysis, it's guess-work &mdash; expect 15&ndash;30% lower actual production."),
            ("Undersized inverter or no optimization", "In partial-shade sites, a string inverter without optimizers can lose 20&ndash;40% of production when one panel is shaded. Enphase microinverters or SolarEdge DC optimizers are worth the premium on shaded roofs."),
            ("Oversized system \"for future EV\"", "Net-metering rules in most states don't credit for over-production. Any system sized above 110% of current usage is wasted money unless you have a specific near-term EV/pool/HVAC addition."),
            ("Vague roof warranty / no roof inspection", "Solar installers drill into your roof. A legitimate quote inspects roof age and structure, offers a 10-year minimum roof penetration warranty, and flags re-roofing if the existing roof is 15+ years old."),
            ("Pressure to sign today", "Solar incentives don't disappear overnight. Federal tax credit is in place through 2032. Any \"price good today only\" tactic is sales pressure, not market reality."),
        ],
        "hidden_costs": [
            "Electrical panel upgrade if main panel is undersized ($2,000&ndash;$5,000)",
            "Main service upgrade (meter / drop) for larger systems ($1,500&ndash;$3,000)",
            "Tree trimming / removal for shade ($500&ndash;$3,000)",
            "Roof replacement before install if roof is old ($8,000&ndash;$20,000)",
            "Battery storage (Tesla Powerwall, Enphase IQ Battery): $12,000&ndash;$25,000 per battery",
            "HOA application and permits in some neighborhoods",
            "Interconnection and meter swap fees from utility",
        ],
        "faqs": [
            ("How do I know if my solar quote is fair?", "Calculate dollars-per-watt: gross price / system size in watts. Fair market in 2026 is $2.50&ndash;$3.50/W for residential. Below $2.25/W warrants scrutiny (low-quality panels or cut corners); above $4/W is premium pricing or markup. Everything else (brand, warranty, production) should support whatever $/W you're paying."),
            ("What should be on a legitimate solar quote?", "System size in kW, panel brand/wattage/count, inverter type and brand, mounting system, production estimate with shading analysis, offset percentage, dollars per watt before incentives, federal tax credit itemized separately, state/utility rebates, monitoring, and warranty terms (panel + inverter + workmanship + roof penetration)."),
            ("Should I lease or buy solar?", "Buy (cash or loan) in almost every case. Leasing/PPA transfers the 30% federal tax credit to the leasing company, ties up your roof for 20&ndash;25 years, often makes homes harder to sell, and builds zero equity. Buying earns the tax credit, builds equity, and is cheaper long-term."),
            ("What are red flags in a solar quote?", "Monthly payment without gross price, tax credit bundled as a \"discount\", push toward lease/PPA, production estimate without shading analysis, undersized inverter on shaded roofs, oversized system \"for future EV,\" vague roof warranty, and pressure to sign today."),
            ("Is the 30% federal tax credit real?", "Yes. The Residential Clean Energy Credit gives 30% of gross system cost as a federal income tax credit through 2032. You must have enough tax liability to use it (it's non-refundable). Claimed on IRS Form 5695. State rebates and utility incentives are separate."),
        ],
    },
    "window": {
        "page": "window-quote-analyzer.html",
        "label": "Window",
        "noun": "window quote",
        "intro": "Window quotes are often priced per window without clear spec breakdown &mdash; which hides the huge price differences between vinyl and fiberglass, double vs triple-pane, and true replacement vs new-construction. A good quote line-items the window specs, installation method, and warranty terms.",
        "line_items": [
            ("Window count and size", "Exact count, with sizes. Standard double-hung vs picture vs casement all price differently."),
            ("Window brand and product line", "Andersen 400 Series, Pella Reserve, Marvin Elevate, Milgard Trinsic. Brand + product line lets you verify glass package, frame material, and warranty."),
            ("Frame material", "Vinyl (cheapest, $300&ndash;$600/window installed), wood-clad (premium, $700&ndash;$1,400), fiberglass ($500&ndash;$900), or aluminum (commercial)."),
            ("Glass package", "Double-pane + Low-E + argon is standard. Triple-pane adds $150&ndash;$300/window; worth it in Zone 5+ climates."),
            ("U-factor and SHGC", "Energy Star rating. U-factor measures insulation (lower = better); SHGC measures heat gain (higher = warmer in winter, higher = hotter in summer)."),
            ("Installation method", "True replacement (remove existing + install new insert in existing frame) vs full-frame (remove everything including frame). Full-frame is better for rotted or leaking windows; costs $200&ndash;$500 more per window."),
            ("Trim and finish", "Interior trim stain/paint match, exterior cladding color, flashing/wrap around frame."),
            ("Permit", "Required in some jurisdictions for structural openings or egress changes."),
            ("Warranty terms", "Frame: 10&ndash;20 yrs (vinyl/fiberglass) to 25+ (premium). Glass seal: 20 yrs typical. Workmanship: 1&ndash;10 yrs."),
        ],
        "red_flags": [
            ("Bait-and-switch window brand", "Quote says \"lifetime warranty windows\" without naming the brand. Could be anything from premium Pella to discount Jeld-Wen &mdash; both can claim lifetime warranty in fine print."),
            ("Vinyl quoted as \"replacement\" without insert method spec", "True replacement (insert over existing frame) vs full-frame removal matters. If your existing frame is rotten, insert replacement traps the rot and shortens window life."),
            ("No U-factor or Energy Star info", "If the quote doesn't specify U-factor and SHGC, you can't verify energy savings claims. Quality quotes come with NFRC performance labels."),
            ("\"Lifetime\" warranty with non-transferable fine print", "Many lifetime warranties are non-transferable at resale, which reduces home value. Check transferability and what \"lifetime\" actually covers (just the frame? the glass? labor?)."),
            ("$99/window teaser pricing", "Radio and TV \"$199 installed\" offers are almost always 3-tab vinyl windows with minimum glass packages and no capping. Full cost for quality windows is $600&ndash;$1,200 installed."),
            ("No flashing or wrap specified", "Proper window installation requires flashing tape and exterior wrap to prevent water intrusion. If missing from scope, expect water damage in 3&ndash;5 years."),
            ("Pressure sales (one-day-only price)", "Large window companies (Renewal by Andersen, Pella, etc.) often use in-home presentations with \"today only\" pricing to prevent comparison shopping. Legitimate pricing holds for 30 days."),
        ],
        "hidden_costs": [
            "Lead paint testing / abatement on pre-1978 homes ($200&ndash;$1,500)",
            "Rot repair around window openings ($200&ndash;$800 per window)",
            "Interior trim replacement if not included ($50&ndash;$150/window)",
            "Exterior stucco or siding patching ($100&ndash;$500/window)",
            "Egress code compliance on bedrooms (size upgrades)",
            "Permit + inspection in some jurisdictions",
            "Screen replacement if not specified",
        ],
        "faqs": [
            ("How much does a typical window cost installed?", "Vinyl double-hung: $300&ndash;$600 installed. Fiberglass: $500&ndash;$900. Wood-clad premium: $700&ndash;$1,400. Picture or custom shapes: add 30&ndash;50%. Multiply by window count &mdash; most 20-window home window replacements run $8,000&ndash;$20,000."),
            ("What should be on a legitimate window quote?", "Window count and sizes, brand and product line, frame material, glass package (double/triple pane, Low-E, argon), U-factor and SHGC ratings, installation method (insert vs full-frame), trim scope, permit status, and warranty terms (frame + glass seal + workmanship)."),
            ("What are red flags in a window quote?", "Bait-and-switch brand, vinyl replacement without insert-vs-full-frame spec, no U-factor or Energy Star info, non-transferable lifetime warranty, $99/window teaser pricing, no flashing spec, and one-day-only pressure sales."),
            ("Insert replacement or full-frame replacement?", "Insert (fit new window into existing frame) is cheaper and faster but only works if existing frame is solid and sealed. Full-frame removes and replaces everything including frame and trim &mdash; required if frame is rotted, leaky, or being resized. Full-frame adds $200&ndash;$500 per window."),
            ("Are triple-pane windows worth it?", "In Zone 5+ (northern tier) climates, yes &mdash; triple-pane saves meaningful heating costs. In Zone 1&ndash;4 (most of the US), no &mdash; double-pane with quality Low-E and argon performs nearly as well at much lower cost. Triple-pane adds $150&ndash;$300/window."),
        ],
    },
    "siding": {
        "page": "siding-quote-analyzer.html",
        "label": "Siding",
        "noun": "siding quote",
        "intro": "Siding quotes vary 2x or more for the \"same\" project because material choice (vinyl vs fiber cement vs wood), existing siding removal, insulation upgrades, and house wrap all dramatically change cost. A quality quote itemizes each of these.",
        "line_items": [
            ("Total square footage of siding", "House perimeter x height, minus window and door openings. A typical 2,000 sq ft two-story home has ~1,800&ndash;2,400 sq ft of siding area."),
            ("Material type and brand", "Vinyl (CertainTeed, Mastic), fiber cement (James Hardie), engineered wood (LP SmartSide), real wood (cedar), or metal."),
            ("Siding profile", "Lap, Dutch lap, shake, board-and-batten, panel. Each has different installation labor."),
            ("Removal of existing siding", "Tear-off + disposal adds $1&ndash;$3/sq ft. Some siding (asbestos, pre-1978 lead) adds hazmat fees."),
            ("House wrap / WRB", "Tyvek HomeWrap, Typar, or similar. Code-required under new siding; $0.25&ndash;$0.75/sq ft installed."),
            ("Insulation board", "1\" foam or fanfold insulation behind siding adds R-value; $0.50&ndash;$1.50/sq ft."),
            ("Trim and accessories", "Starter strip, J-channel, soffit/fascia, corner posts, window/door trim. Often 15&ndash;25% of total material cost."),
            ("Caulking and sealants", "All joints and penetrations should be sealed. Specification of caulk type (acrylic vs polyurethane) matters for lifespan."),
            ("Painting (if needed)", "Fiber cement and engineered wood need paint. Should specify primer + 2 topcoats, or factory pre-finished."),
            ("Permit", "Required in most jurisdictions for full re-siding."),
            ("Warranty terms", "Material (20&ndash;50 yrs depending on type) + workmanship (typically 2&ndash;10 yrs)."),
        ],
        "red_flags": [
            ("Siding over existing without tear-off", "Cheaper in the short run ($1,500&ndash;$3,500 savings) but hides rot, moisture damage, and pests. Also adds weight to the wall structure, and may push windows out of alignment."),
            ("Missing house wrap / WRB", "Code requires water-resistive barrier under new siding. If missing, expect moisture damage within 5 years."),
            ("No insulation board on old homes", "Older homes with 2x4 walls benefit significantly from 1\" foam under siding (adds R-4 to R-5). If not discussed, you're missing a cheap efficiency upgrade."),
            ("Vinyl quoted for wall wind zones 130+ mph", "Standard vinyl is rated for 110 mph wind. Coastal or tornado-alley installs need high-wind vinyl (rated 150+ mph) or alternative material &mdash; quote should specify wind rating."),
            ("Fiber cement without painter", "James Hardie siding comes primed but needs painting for warranty. If quote includes install only, add $2,000&ndash;$5,000 for paint."),
            ("Vague warranty coverage", "Fiber cement warranties (e.g., James Hardie 30-yr) have specific requirements: proper clearance, painting, flashing, and install techniques. A quote that doesn't specify these may void warranty."),
            ("No lead paint testing on pre-1978 home", "EPA Renovation, Repair and Painting (RRP) rule requires certified contractor + containment + disposal for lead-based paint work. Skipping this is an EPA violation."),
        ],
        "hidden_costs": [
            "Rot repair around windows / doors ($200&ndash;$1,500)",
            "Insect or moisture damage repair behind existing siding",
            "Painting fiber cement or engineered wood ($2,000&ndash;$5,000)",
            "Lead paint abatement on pre-1978 homes ($500&ndash;$5,000)",
            "Soffit and fascia replacement ($500&ndash;$3,000)",
            "Gutter removal and reinstallation ($300&ndash;$1,000)",
            "Electrical fixture / outlet extensions through thicker siding",
        ],
        "faqs": [
            ("How much does siding cost installed?", "Vinyl: $4&ndash;$8/sq ft. Fiber cement (James Hardie): $8&ndash;$15/sq ft. Engineered wood (LP SmartSide): $6&ndash;$11/sq ft. Real wood: $8&ndash;$20/sq ft. Metal: $10&ndash;$16/sq ft. For a typical 2,000 sq ft of siding area: vinyl $8K&ndash;$16K, fiber cement $16K&ndash;$30K."),
            ("What should be on a legitimate siding quote?", "Total square footage, material and brand, profile, removal of existing siding, house wrap, insulation board (if applicable), trim and accessories, caulking, painting (if needed), permit, and warranty terms."),
            ("What are red flags in a siding quote?", "Install over existing without tear-off, missing house wrap, no insulation board on old homes, vinyl in high-wind zones, fiber cement install without painter, vague warranty, and no lead paint testing on pre-1978 homes."),
            ("Is fiber cement worth the premium over vinyl?", "In most climates, yes. Fiber cement (James Hardie) lasts 30&ndash;50 years, resists fire/pests/rot, and boosts home value 75&ndash;80% of cost at resale (highest ROI of any siding). Vinyl costs 40&ndash;50% less but needs replacement in 20&ndash;40 years."),
            ("How long does siding last?", "Vinyl: 20&ndash;40 yrs. Fiber cement: 30&ndash;50 yrs. Engineered wood: 25&ndash;40 yrs. Real wood: 20&ndash;40 yrs (depends on maintenance). Metal: 40&ndash;70 yrs. Quality of install matters as much as material for actual lifespan."),
        ],
    },
    "fencing": {
        "page": "fencing-quote-analyzer.html",
        "label": "Fence",
        "noun": "fence quote",
        "intro": "Fence quotes are usually priced per linear foot, but that number hides huge differences between pressure-treated pine, cedar, vinyl, and aluminum. A good quote breaks down material, post spacing, hardware, and gate specs so you can compare apples-to-apples.",
        "line_items": [
            ("Linear footage", "Total perimeter in linear feet. Property lines and survey stakes should be noted."),
            ("Fence height", "4 ft (front yard, HOA-allowed), 6 ft (most common privacy), 8 ft (premium privacy or noise reduction)."),
            ("Material and grade", "Pressure-treated pine (cheapest), cedar (premium wood), vinyl, aluminum, chain-link, composite, steel. Grade matters for wood (select vs #1 vs #2)."),
            ("Post spec", "Post size (4x4, 6x6), depth (2&ndash;3 ft), concrete footing (50&ndash;60 lb bag per post standard). Shorter/shallower posts fail in wind."),
            ("Post spacing", "6 ft centers is standard. 8 ft adds stress to rails and pickets; 6 ft is worth the extra posts."),
            ("Hardware", "Galvanized or stainless steel nails/screws on wood; brand-matched hardware on vinyl/aluminum. Stainless lasts longer near coast."),
            ("Gates", "Single (3&ndash;4 ft) and double (8&ndash;10 ft) gates with specific hardware. Gate hardware is where fences fail first."),
            ("Finishing", "Stain or paint on wood (optional; adds lifespan 5&ndash;10 yrs). Typically $1&ndash;$3/linear ft."),
            ("Permit", "Required in most jurisdictions for fences over 6 ft or in front yards."),
            ("Warranty terms", "Material (manufacturer; vinyl 10&ndash;25 yrs, aluminum 10&ndash;20 yrs) + workmanship (2&ndash;5 yrs typical)."),
            ("Existing fence removal", "Tear-out + disposal of old fence, usually $2&ndash;$5/linear foot."),
        ],
        "red_flags": [
            ("Posts set without concrete", "Wood posts set in dirt last 5&ndash;8 years. Concrete footings (50&ndash;60 lb bag per post) are standard for 15+ year life."),
            ("Post spacing beyond 8 ft", "Wider spacing means stressed rails, sagging pickets, and early wind failure. 6 ft is standard."),
            ("Non-galvanized fasteners on wood", "Regular nails rust within 2&ndash;3 years; galvanized or stainless is required. Staples instead of screws is amateur work."),
            ("Pressure-treated pine marketed as \"premium\"", "Pressure-treated pine is the cheapest wood fence material. Cedar, redwood, or composite are actual premium options."),
            ("No mention of post size", "4x4 posts are minimum for 6 ft fence, 6x6 posts for 8 ft fence. Undersized posts (undersized, 3x3, or pipe) fail in wind."),
            ("HOA-approved not verified", "Some HOAs require specific height, color, and material. A quote that hasn't confirmed HOA approval may require rebuilding."),
            ("\"Builder grade\" vinyl or aluminum", "Cheap imported vinyl/aluminum looks ok year one but fades, cracks, and loses structural rigidity in 5&ndash;10 years. Name-brand (CertainTeed, Jerith, Ameristar) lasts 20+ years."),
        ],
        "hidden_costs": [
            "Underground utility marking (free from 811 but extra hassle)",
            "Old fence removal / disposal ($2&ndash;$5/linear ft)",
            "Grading for uneven terrain ($100&ndash;$500)",
            "Extra posts for terrain changes or corners",
            "Deck / patio interface work",
            "Survey to verify property lines if boundary disputed",
            "Stain or paint on wood ($1&ndash;$3/linear ft)",
        ],
        "faqs": [
            ("How much does fencing cost per linear foot?", "Pressure-treated pine: $20&ndash;$40/lft. Cedar: $30&ndash;$60/lft. Vinyl: $30&ndash;$60/lft. Aluminum: $30&ndash;$60/lft. Chain-link: $8&ndash;$25/lft. Composite: $40&ndash;$80/lft. 200 lft of cedar privacy fence runs $6,000&ndash;$12,000 installed."),
            ("What should be on a legitimate fence quote?", "Linear footage, height, material and grade, post size and spacing, post depth and concrete footing, hardware type, gate count and specs, finishing (stain/paint), permit, warranty, and existing fence removal if applicable."),
            ("What are red flags in a fence quote?", "Posts without concrete, post spacing beyond 8 ft, non-galvanized fasteners, pressure-treated pine marketed as premium, no post size spec, unverified HOA approval, and cheap imported vinyl/aluminum."),
            ("How long does a wood fence last?", "Pressure-treated pine: 10&ndash;15 years. Cedar: 15&ndash;25 years. Redwood: 20&ndash;30 years. Posts typically fail first &mdash; replacing posts extends life. Stain every 3&ndash;5 years to maximize lifespan."),
            ("Do I need a permit for a fence?", "Most jurisdictions require permit for fences over 6 ft, in front yards, or on corner lots. Under 6 ft in back yard usually doesn't require permit, but always check HOA rules &mdash; violations can require removal."),
        ],
    },
    "concrete": {
        "page": "concrete-quote-analyzer.html",
        "label": "Concrete",
        "noun": "concrete quote",
        "intro": "Concrete quotes are priced per square foot, but the price swings 2x based on thickness, reinforcement, finish, and preparation. A quality quote specifies PSI strength, slab depth, rebar or mesh, control joints, and cure method &mdash; not just a square-footage number.",
        "line_items": [
            ("Square footage and thickness", "Driveways typically 4\" thick; heavy vehicles or commercial 5&ndash;6\". Patios 4\" standard. Slabs under houses 4&ndash;6\"."),
            ("Concrete PSI (strength)", "3,000 PSI standard for residential. 4,000 PSI for driveways with heavier vehicles. 5,000 PSI for commercial."),
            ("Reinforcement", "Wire mesh is budget; #4 rebar on 16\" grid is standard for driveways; fiber-reinforced mix is newer alternative."),
            ("Base preparation", "4\" compacted gravel base under slab. Expansive soils need more; sandy soils less."),
            ("Forms and joints", "Control joints every 8&ndash;10 ft prevent random cracking. Expansion joints where slab meets other structures."),
            ("Finish type", "Broom finish (standard, slip-resistant), smooth trowel, stamped, exposed aggregate, or stained/colored."),
            ("Cure method", "Water cure, curing compound, or plastic sheet. Proper cure is critical first 7 days."),
            ("Drainage slope", "1/8\"&ndash;1/4\" per foot away from house. Should be called out on quote."),
            ("Saw cuts", "Control joints cut with concrete saw within 24 hours of pour."),
            ("Permit", "Required in most jurisdictions for driveways, large patios, and any structural slab."),
            ("Warranty terms", "Cracking (usually 1-year limited), settlement (1&ndash;5 yrs), workmanship (1&ndash;2 yrs)."),
        ],
        "red_flags": [
            ("3\" thickness instead of 4\"", "A 3\" slab saves $1&ndash;$2/sq ft but fails 5&ndash;10 years earlier. 4\" is minimum for driveways; some inspectors won't pass 3\"."),
            ("No rebar or mesh reinforcement", "Unreinforced concrete cracks badly within 2&ndash;5 years. Mesh is bare minimum; rebar is standard for driveways."),
            ("\"Fast cure\" additives as standard", "Calcium chloride speeds cure but weakens final concrete. Acceptable for indoor or small work, not for driveways or structural."),
            ("No base prep specified", "Concrete poured directly on soil settles unevenly. 4\" compacted gravel base is standard; skipping this causes cracking and settlement."),
            ("No control joints mentioned", "All concrete cracks eventually. Control joints force cracks into straight lines where you want them. Without joints, random cracks ruin appearance and structure."),
            ("Below-market pricing", "Concrete has thin margins. $3/sq ft quote for driveway concrete is usually a lowball with thin slab, no reinforcement, or skipped prep. Fair market is $6&ndash;$12/sq ft installed."),
            ("No warranty on cracks or settlement", "Quality concrete contractors offer at least 1-year workmanship warranty covering excess cracking and settlement. No warranty = bargain crew."),
        ],
        "hidden_costs": [
            "Removal of existing concrete ($2&ndash;$6/sq ft)",
            "Subsoil excavation / regrading for drainage",
            "Thickened edges for driveway apron or structural loads",
            "Decorative finish upcharges (stamped, colored, exposed)",
            "Sealer application ($0.50&ndash;$1.50/sq ft)",
            "Expansion joints against existing structures",
            "Steel reinforcement upgrade (rebar vs mesh)",
        ],
        "faqs": [
            ("How much does concrete cost per square foot?", "Plain 4\" driveway or patio: $6&ndash;$12/sq ft installed. Stamped or decorative: $10&ndash;$20/sq ft. Exposed aggregate: $8&ndash;$15/sq ft. Colored: $9&ndash;$16/sq ft. For a 600 sq ft driveway, plain concrete runs $4,000&ndash;$7,000."),
            ("What should be on a legitimate concrete quote?", "Square footage and slab thickness, concrete PSI, reinforcement type (mesh or rebar), base preparation, forms and control joints, finish type, cure method, drainage slope, saw cut spec, permit, and warranty terms."),
            ("What are red flags in a concrete quote?", "3\" instead of 4\" thickness, no rebar or mesh, fast-cure additives as standard, no base prep, no control joints, below-market pricing, and no warranty on cracks or settlement."),
            ("How long does concrete last?", "Properly installed concrete driveway: 30&ndash;50 years. Patio: 25&ndash;40 years. Poor install (thin, unreinforced, no base) fails in 5&ndash;15 years. Sealing every 3&ndash;5 years extends life significantly."),
            ("Should concrete be sealed?", "Yes, for driveways and exposed aggregate. Sealers reduce freeze-thaw damage, stain resistance, and surface wear. Sealer cost: $0.50&ndash;$1.50/sq ft, reapplication every 3&ndash;5 years."),
        ],
    },
    "painting": {
        "page": "painting-quote-analyzer.html",
        "label": "Painting",
        "noun": "painting quote",
        "intro": "Painting quotes are frequently vague about prep work, which is where quality lives or dies. A $3/sq ft quote and a $7/sq ft quote can both be \"paint the house\" &mdash; the difference is sanding, caulking, priming, and number of coats.",
        "line_items": [
            ("Square footage or room count", "Interior: total wall area by room. Exterior: siding area minus windows and doors."),
            ("Number of coats", "2 coats is standard. 3 coats for dramatic color changes or poor prior coverage. 1 coat is a lowball."),
            ("Paint brand and grade", "Sherwin-Williams ProClassic, Duration; Benjamin Moore Regal, Aura; Behr Premium, Marquee. Brand and line matters for coverage, lifespan, and washability."),
            ("Primer", "Primer coat included (yes/no). New drywall, dramatic color changes, and stained areas need primer."),
            ("Prep work scope", "Sanding, scraping, caulking, filling holes, washing. Prep is 40&ndash;60% of labor on most jobs &mdash; critical for finish quality."),
            ("Surfaces covered", "Walls, ceilings, trim, doors, windows, closets. Each should be called out separately."),
            ("Trim and doors", "Trim paint is a different product (semi-gloss or gloss). Doors painted on or off hinges."),
            ("Caulking and hole filling", "Should be specified by scope &mdash; light touch-up vs comprehensive."),
            ("Lead paint testing", "Required on pre-1978 homes. EPA RRP certified crew + containment for any disturbance."),
            ("Drop cloths and masking", "Floor covering, furniture covering, window masking. Professional crews bring this; budget crews charge extra."),
            ("Cleanup and touch-up", "Haul-away of paint cans, daily cleanup, punch-list walkthrough at end."),
            ("Warranty terms", "Labor (1&ndash;5 yrs on exterior, 1&ndash;3 yrs on interior) + paint manufacturer warranty."),
        ],
        "red_flags": [
            ("1 coat quoted for normal colors", "2 coats is standard for even coverage. 1-coat paint (labeled as such, like Behr Marquee) works for same-color refreshes but not color changes."),
            ("No prep work specified", "Paint only sticks to clean, sanded, caulked surfaces. A quote that skips prep either expects you to do it or gets bad finish quality."),
            ("Cheap paint at premium price", "Builder-grade paint ($25&ndash;$45/gallon) at $50&ndash;$70/gallon \"premium\" labor pricing is overpriced. Ask what specific product they're using."),
            ("No lead paint mention on pre-1978 home", "EPA RRP rule requires certified contractor + testing + containment. Non-compliant work risks lead poisoning for your family and exposes contractor to $37,500/day EPA fines &mdash; legitimate painters discuss this."),
            ("Spray application \"because it's faster\"", "Spraying is faster and cheaper for the contractor but creates overspray and needs more masking/prep. Brush + roller is higher quality on most residential work."),
            ("Short warranty on exterior", "Quality exterior paint should last 8&ndash;12 years; contractor warranty under 3 years is weak. Premium contractors warranty exterior paint for 5&ndash;10 years."),
            ("Vague \"professional grade paint\"", "If the quote doesn't name the specific paint product (Sherwin-Williams Duration, Benjamin Moore Aura, etc.), assume cheapest contractor-grade paint."),
        ],
        "hidden_costs": [
            "Wallpaper removal ($1&ndash;$3/sq ft)",
            "Drywall repair beyond caulk ($200&ndash;$2,000 per project)",
            "Cabinet painting if not in original scope ($1,500&ndash;$4,500)",
            "Ceiling repairs or spot priming",
            "Exterior carpentry repairs before paint ($500&ndash;$3,000)",
            "Multiple paint samples to decide color ($50&ndash;$200)",
            "Lead paint abatement on pre-1978 ($500&ndash;$5,000)",
            "Rental of ladder / scaffold for 2nd+ story exterior",
        ],
        "faqs": [
            ("What should be on a legitimate painting quote?", "Square footage or room count, number of coats, paint brand and grade, primer inclusion, prep work scope, surfaces covered (walls/ceiling/trim/doors), caulking and hole filling, lead paint testing (pre-1978), drop cloths, cleanup, and warranty terms."),
            ("How much does interior painting cost?", "Full interior (walls + ceilings + trim) for 1,500 sq ft home: $4,500&ndash;$12,000. Walls only: $1,500&ndash;$4,500. Per room: $400&ndash;$1,500 depending on size and scope."),
            ("What are red flags in a painting quote?", "1 coat for color changes, no prep specified, cheap paint at premium pricing, no lead paint mention on pre-1978 home, spray-only application, warranty under 3 years on exterior, and vague \"professional grade\" paint description."),
            ("How long should an exterior paint job last?", "Quality exterior paint (premium product, proper prep, 2 coats): 8&ndash;12 years on wood, 10&ndash;15 years on fiber cement or stucco. Budget paint or poor prep: 3&ndash;5 years. Sun exposure and climate significantly affect lifespan."),
            ("Is painting cabinets worth it vs replacing?", "Usually yes. Painting cabinets ($1,500&ndash;$4,500) refreshes kitchen at 10&ndash;20% the cost of replacement ($8,000&ndash;$25,000). Works well if boxes are solid; doesn't help if boxes are damaged or particle board."),
        ],
    },
    "gutters": {
        "page": "gutters-quote-analyzer.html",
        "label": "Gutter",
        "noun": "gutter quote",
        "intro": "Gutter quotes are priced per linear foot, but the real variables are seamless vs sectional, gutter material, gutter size, downspout count, and whether leaf guards are included. A complete quote itemizes all of these.",
        "line_items": [
            ("Linear footage", "Total linear feet of gutter + downspouts, separately. Most 2,000 sq ft homes have 150&ndash;200 lft of gutter."),
            ("Gutter size", "5\" K-style is standard. 6\" for large roofs or heavy rain areas. 7\" for commercial or very large homes."),
            ("Material", "Aluminum (standard, $5&ndash;$10/lft), copper ($25&ndash;$40/lft), galvanized steel ($6&ndash;$12/lft), zinc ($20&ndash;$35/lft)."),
            ("Seamless vs sectional", "Seamless (custom-rolled on site) reduces leaks; sectional (10-ft pieces joined) is cheaper but leaks at every joint over time."),
            ("Downspouts", "Count and size. 2\"x3\" standard for 5\" gutter; 3\"x4\" for 6\" gutter. Most homes need 4&ndash;6 downspouts."),
            ("Hangers and fasteners", "Hidden hangers (every 24\" max) are stronger than spike-and-ferrule. Stainless or aluminum screws resist corrosion."),
            ("Leaf guards (if included)", "Micromesh, reverse curve, or foam insert. Material and brand matters; LeafGuard / Gutter Helmet / LeafFilter are premium brands."),
            ("Removal of existing gutters", "Tear-off and haul-away usually $1&ndash;$3/lft."),
            ("Fascia repair", "Rotted fascia should be replaced before new gutters hang. $5&ndash;$15/lft for fascia replacement."),
            ("Warranty terms", "Material (20 yrs aluminum, lifetime copper) + seams (no-leak warranty on seamless) + workmanship (1&ndash;5 yrs)."),
        ],
        "red_flags": [
            ("Sectional at \"seamless\" price", "Sectional gutters cost $4&ndash;$6/lft; seamless $7&ndash;$10/lft. Getting charged seamless pricing for sectional product is overcharge."),
            ("Undersized 5\" gutter on big roof", "Large roofs (2,500+ sq ft) need 6\" gutter. 5\" overflows in heavy rain, causing foundation and siding damage."),
            ("Few downspouts", "1 downspout per 30&ndash;40 lft of gutter is standard. Fewer = overflowing gutters, even if the gutter size is adequate."),
            ("Spike-and-ferrule hangers", "Old-style fastener that rusts and pulls loose within 5&ndash;10 years. Hidden hangers are modern standard &mdash; stronger and invisible."),
            ("LeafFilter / Gutter Helmet pressure sales", "These in-home sales companies charge 3&ndash;5x what local gutter installers charge for equivalent leaf guard products. Get competing quotes before signing."),
            ("No drip edge integration", "Gutters need to catch water from drip edge on roof. Quote should specify that drip edge extends into gutter."),
            ("No slope spec", "Gutters need 1/4\" drop per 10 ft toward downspouts for proper drainage. If quote doesn't mention slope, budget crew may install flat."),
        ],
        "hidden_costs": [
            "Fascia replacement where rotted ($5&ndash;$15/lft)",
            "Soffit repair behind bad gutters",
            "Existing gutter removal and disposal ($1&ndash;$3/lft)",
            "Downspout extensions to drain away from foundation",
            "Splash blocks or underground drainage",
            "Second-story or steep-pitch labor surcharge",
            "Gutter cleaning/inspection on first service",
        ],
        "faqs": [
            ("How much do gutters cost installed?", "5\" seamless aluminum: $7&ndash;$12/lft. 6\" seamless aluminum: $9&ndash;$14/lft. Copper: $25&ndash;$40/lft. Galvanized steel: $6&ndash;$12/lft. A 180-lft home with aluminum gutters runs $1,500&ndash;$2,500 installed."),
            ("What should be on a legitimate gutter quote?", "Linear footage, gutter size, material, seamless vs sectional, downspout count and size, hanger type, leaf guard specs if applicable, removal of existing, fascia repair, and warranty terms."),
            ("What are red flags in a gutter quote?", "Sectional at seamless pricing, undersized 5\" on big roof, few downspouts, spike-and-ferrule hangers, LeafFilter/Gutter Helmet pressure pricing, no drip edge integration, and no slope specification."),
            ("Are leaf guards worth it?", "If you have overhanging trees: yes. Quality micromesh guards (LeafFilter, GutterGuard Pro) keep debris out and reduce maintenance from 2x/yr cleaning to every 5&ndash;10 yrs. Expect $10&ndash;$25/lft installed &mdash; often 2x gutter cost. Shop local installers, not TV brands, to save 50&ndash;70%."),
            ("How long do aluminum gutters last?", "20&ndash;30 years for quality seamless aluminum with proper install. Sectional aluminum: 15&ndash;20 years (joints leak first). Copper: 50+ years. Galvanized steel: 20&ndash;30 years (rusts at joints)."),
        ],
    },
    "insulation": {
        "page": "insulation-quote-analyzer.html",
        "label": "Insulation",
        "noun": "insulation quote",
        "intro": "Insulation quotes should specify R-value, material type, square footage, and air sealing scope &mdash; not just a total price. The same dollar amount can deliver very different energy performance depending on these details.",
        "line_items": [
            ("Square footage", "Area covered: attic, walls, crawlspace, basement, or rim joists."),
            ("R-value target", "Attic: R-49 to R-60 in most climates. Walls: R-13 to R-23. Crawlspace: R-19 to R-30. Follow IRC 2021 or current climate zone code."),
            ("Insulation type", "Fiberglass batts, fiberglass blown-in, cellulose blown-in, spray foam (open-cell or closed-cell), mineral wool, rigid foam."),
            ("Air sealing", "Caulking, foam gun, rigid foam, or tape on penetrations, joist ends, top plates. Typically 20&ndash;40% of energy performance comes from air sealing, not just insulation."),
            ("Removal of existing insulation", "Often needed on attic re-insulations with rodent contamination, moisture damage, or inadequate old material. $1&ndash;$3/sq ft."),
            ("Attic ventilation", "Soffit intake + ridge exhaust. Required to prevent moisture and ice damming in cold climates."),
            ("Baffles and rafter vents", "Maintains airflow from soffit to ridge. Required under blown insulation in attics."),
            ("Vapor barrier or retarder", "Required in cold climates (Zone 5+) on warm-side of wall/ceiling."),
            ("Permit", "Sometimes required; usually not for like-for-like attic top-ups."),
            ("Warranty terms", "Material (manufacturer; R-value rated for life of product) + workmanship (5&ndash;lifetime)."),
        ],
        "red_flags": [
            ("R-value below current code", "Attic R-value below R-49 in most US climates is below code. A quote for \"R-30 attic\" in Zone 4+ is below-code work."),
            ("No air sealing mentioned", "Insulation without air sealing loses 20&ndash;40% of its rated R-value. Comprehensive quotes include air sealing as a separate line."),
            ("Fiberglass blown-in at premium price", "Fiberglass blown-in is the cheapest material. If priced like cellulose or spray foam, you're overpaying. Expect $1&ndash;$2/sq ft for fiberglass blown-in vs $1.50&ndash;$3 for cellulose."),
            ("Open-cell foam in exterior walls", "Open-cell spray foam absorbs water; closed-cell is the right choice for exterior walls and crawlspaces. A quote for open-cell in exterior should be scrutinized."),
            ("No baffle or rafter vent installation", "Baffles prevent blown insulation from blocking soffit airflow. Without them, attic ventilation fails and ice damming occurs."),
            ("Removing old insulation without disposal detail", "Old fiberglass with rodent urine, mold, or asbestos (pre-1970s) needs proper containment and disposal. Skipping contamination handling is a health risk."),
            ("Spray foam without testing air barrier", "Spray foam is also an air barrier, but quality depends on application. Quote should include blower door test post-install to verify air sealing."),
        ],
        "hidden_costs": [
            "Removal of old contaminated insulation ($1&ndash;$3/sq ft)",
            "Rodent exclusion / sealing before insulation ($200&ndash;$2,000)",
            "Knee wall insulation on story-and-a-half homes",
            "Attic stairs insulated hatch ($200&ndash;$500)",
            "Recessed light covers (airtight, IC-rated)",
            "Rigid foam on basement walls before fiberglass",
            "Structural attic flooring after insulation install",
        ],
        "faqs": [
            ("How much does insulation cost?", "Blown fiberglass attic: $1&ndash;$2/sq ft. Blown cellulose: $1.50&ndash;$3/sq ft. Closed-cell spray foam: $1.50&ndash;$3/board foot. Open-cell spray foam: $0.75&ndash;$1.50/board foot. A typical 1,500 sq ft attic upgrade to R-60 runs $1,800&ndash;$4,500."),
            ("What should be on a legitimate insulation quote?", "Square footage, R-value target, insulation type, air sealing scope, removal of existing insulation if needed, attic ventilation, baffles/rafter vents, vapor barrier (if climate requires), permit, and warranty terms."),
            ("What are red flags in an insulation quote?", "R-value below current code, no air sealing mentioned, fiberglass at premium price, open-cell foam in exterior walls, no baffle installation, no contamination handling on old insulation, and spray foam without blower door verification."),
            ("Is spray foam worth the cost?", "Depends. Closed-cell spray foam is the best performer for crawl spaces, rim joists, and conditioned spaces &mdash; worth the premium. For attic insulation, blown cellulose with air sealing performs nearly as well at 40&ndash;60% lower cost."),
            ("How much can insulation save on energy bills?", "Adding attic insulation from R-20 to R-60 saves 10&ndash;20% on heating/cooling bills in most homes. Combined with air sealing, 20&ndash;40% savings. Payback typically 5&ndash;10 years on $2,000&ndash;$5,000 investment."),
        ],
    },
    "foundation": {
        "page": "foundation-quote-analyzer.html",
        "label": "Foundation",
        "noun": "foundation quote",
        "intro": "Foundation repair is high-stakes work. Costs range from $500 (minor crack repair) to $40,000+ (complete underpinning). Quality quotes include a structural engineer's report, specific repair method, pier counts, warranty terms, and transferability to future owners &mdash; all critical for resale.",
        "line_items": [
            ("Structural engineer report", "For significant repairs, a licensed PE should evaluate and spec the repair. Independent engineers (not employed by the repair company) give unbiased assessment."),
            ("Specific repair method", "Steel push piers, helical piers, hydraulic piers, polyurethane foam injection, wall anchors, carbon fiber straps, slab jacking. Each is appropriate for different problems."),
            ("Pier count and depth", "Specific number of piers needed and target depth (typically to bedrock or load-bearing stratum)."),
            ("Materials used", "Pier type and specifications. Brand matters: ECP, Supportworks, Earth Contact Products are quality."),
            ("Excavation scope", "Depth of excavation per pier, backfill method."),
            ("Lifting or stabilizing only", "Some repairs stabilize (prevent further movement) without lifting. Lifting attempts can cause drywall damage and is riskier."),
            ("Waterproofing or drainage", "If foundation issue is water-driven, exterior or interior drainage may be part of complete fix."),
            ("Warranty terms", "Lifetime transferable warranty is premium and expected. Non-transferable warranty is lower-value at resale."),
            ("Permit", "Required for most structural foundation work."),
            ("Post-repair monitoring", "Quality contractors include follow-up inspection 6&ndash;12 months post-repair."),
        ],
        "red_flags": [
            ("Repair without engineer consultation", "Any significant foundation work ($5,000+) should include independent structural engineer assessment. Contractors that skip this often oversell scope."),
            ("Non-transferable warranty", "Foundation warranty transferability affects resale value significantly. Non-transferable warranty means buyer's insurance/mortgage may require new inspection."),
            ("One-size-fits-all repair method", "Different foundation problems need different solutions. A quote that pushes steel piers for every issue &mdash; including problems better solved by drainage or polyurethane &mdash; is sales, not engineering."),
            ("No pier depth specification", "Piers need to reach bedrock or load-bearing soil. Without depth spec, contractor may stop at shallow depth that fails within years."),
            ("Pressure sales based on \"emergency\"", "Most foundation issues are slow-moving. A contractor who insists on immediate repair without allowing time for engineer review or competitive quotes is sales-driven."),
            ("Minor crack pushed to major repair", "Minor vertical cracks (under 1/4\") in poured concrete often cosmetic. Epoxy injection is $300&ndash;$800 fix. If pushed to $15,000+ underpinning for minor cracks, get second opinion."),
            ("Interior piers only without exterior", "Some issues require exterior pier placement for proper support. Interior-only piers can be insufficient."),
        ],
        "hidden_costs": [
            "Independent structural engineer consultation ($500&ndash;$1,500)",
            "Permit and inspection fees",
            "Interior drywall repair after wall movement ($500&ndash;$3,000)",
            "Exterior landscaping restoration after excavation",
            "Plumbing repairs if pipes moved during lifting",
            "Door and window re-alignment after foundation movement",
            "Future drainage or waterproofing if not included",
        ],
        "faqs": [
            ("How much does foundation repair cost?", "Minor crack repair: $300&ndash;$1,500. Bowing wall stabilization: $3,000&ndash;$10,000. Pier installation: $1,500&ndash;$3,500 per pier (most jobs need 6&ndash;20 piers). Major underpinning: $15,000&ndash;$40,000+. Polyurethane slab jacking: $500&ndash;$2,500 per area."),
            ("What should be on a legitimate foundation quote?", "Structural engineer report for significant repairs, specific repair method, pier count and depth, materials and brand, excavation scope, lifting vs stabilizing intent, waterproofing if applicable, transferable warranty terms, permit, and post-repair monitoring."),
            ("What are red flags in a foundation quote?", "Repair without engineer consultation, non-transferable warranty, one-size-fits-all method, no pier depth spec, pressure sales based on emergency, minor crack upsold to major repair, and interior piers only when exterior needed."),
            ("Should I get a structural engineer opinion?", "For any repair over $5,000: yes, always. An independent structural engineer ($500&ndash;$1,500) gives unbiased assessment, specs appropriate repair, and provides documentation for resale. Many foundation companies include their own in-house engineer who may favor their preferred solutions."),
            ("Is a transferable warranty important?", "Very. Foundation repairs affect home value and future sale. Transferable lifetime warranty adds $5,000&ndash;$15,000 of home value at resale. Non-transferable or short warranty may require buyer's lender to get new foundation inspection."),
        ],
    },
    "garage-door": {
        "page": "garage-door-quote-analyzer.html",
        "label": "Garage door",
        "noun": "garage door quote",
        "intro": "Garage door quotes should specify material, insulation R-value, spring type, opener specs, and warranty &mdash; not just a price per door. Steel, insulated, and quality brand doors from quality installers run $1,500&ndash;$4,000; single-pane uninsulated doors run $600&ndash;$1,200. Both called \"garage door\".",
        "line_items": [
            ("Door size and type", "Standard single 8x7, single 9x7, double 16x7, or custom. Sectional (most common), roll-up, or swing-up."),
            ("Material", "Steel (most common), wood (premium), aluminum (modern look), fiberglass (corrosion-resistant), composite."),
            ("Insulation R-value", "Uninsulated: R-0. Budget insulated: R-6. Mid-grade: R-9 to R-12. Premium: R-18 to R-20."),
            ("Panel style and brand", "Ribbed, raised panel, flush, carriage house. Brand: Clopay, Amarr, CHI, Wayne Dalton, Overhead Door."),
            ("Windows", "Number and glass type (single-pane, insulated, impact-resistant)."),
            ("Springs", "Torsion springs (above door, standard, quieter, longer life) or extension springs (on sides, cheaper, shorter life)."),
            ("Opener brand and specs", "LiftMaster, Chamberlain, Genie, Craftsman. Horsepower (1/2, 3/4, 1 HP), drive type (belt, chain, screw), Wi-Fi compatibility."),
            ("Tracks and hardware", "All new hardware vs reusing old tracks. Galvanized or stainless for coastal areas."),
            ("Weatherstripping and bottom seal", "Fresh gaskets and threshold seal included."),
            ("Removal of old door", "Tear-off and haul-away of existing door and opener."),
            ("Warranty terms", "Panels (5&ndash;lifetime), springs (3&ndash;10 yrs or X cycle count), opener (2&ndash;10 yrs), install (1&ndash;2 yrs)."),
        ],
        "red_flags": [
            ("Extension springs instead of torsion", "Extension springs are cheaper but more dangerous and shorter-lived (5&ndash;7 yr vs 10&ndash;15 yr for torsion). Most quality installs today use torsion."),
            ("Uninsulated door on attached garage", "R-0 door on attached garage lets heat in/out significantly. For attached garages, R-9 minimum is standard; R-12+ for comfort."),
            ("No opener included", "Door alone vs door + opener. Garage door opener is $300&ndash;$800 installed separately, so quote should clearly include or exclude."),
            ("Cheapest cycle-count spring", "Spring lifespan rated by cycles: 10,000 (budget) to 25,000+ (premium). A 10,000-cycle spring lasts 7&ndash;10 years at daily use. A 20,000-cycle lasts 15&ndash;20 years &mdash; worth $50&ndash;$100 upgrade."),
            ("Reusing old tracks and hardware", "Old tracks wear and corrode. A new door on old tracks is noisy and prone to derailment. Quality install replaces all hardware."),
            ("No insulation spec (just \"insulated\")", "\"Insulated\" without R-value could be polystyrene R-3 (bottom tier) or polyurethane R-18 (premium). Ask for specific rating."),
            ("No warranty on labor/install", "Manufacturer warranty covers panel defects but not install errors. Installer warranty (1&ndash;2 yrs minimum) covers their work."),
        ],
        "hidden_costs": [
            "Track repair or replacement where rusted / bent",
            "New weather stripping around frame ($50&ndash;$150)",
            "Wall disconnect for attached garage interior access ($50&ndash;$100)",
            "Remote-control keypads and extra remotes",
            "Wi-Fi add-on if not in base opener ($100&ndash;$200)",
            "Battery backup required in California",
            "Electrical outlet relocation if needed for opener",
        ],
        "faqs": [
            ("How much does a new garage door cost installed?", "Uninsulated single: $800&ndash;$1,500. Insulated single: $1,200&ndash;$2,500. Insulated double: $1,800&ndash;$3,500. Premium (custom, wood, high-R): $3,000&ndash;$7,000. Opener separately: $300&ndash;$800 installed."),
            ("What should be on a legitimate garage door quote?", "Door size and type, material, insulation R-value, panel style and brand, windows, spring type (torsion vs extension), opener specs, tracks and hardware, weatherstripping, removal of old door, and warranty terms (panels + springs + opener + install)."),
            ("What are red flags in a garage door quote?", "Extension springs instead of torsion, uninsulated door on attached garage, opener included/excluded unclear, cheapest 10,000-cycle springs, reused old tracks, vague \"insulated\" without R-value, and no install/labor warranty."),
            ("Torsion vs extension springs?", "Torsion (mounted above door) is quieter, safer, longer-lived (15&ndash;20 yr), and standard on quality installs. Extension (on sides of tracks) is cheaper ($50&ndash;$150 savings) but shorter-lived (5&ndash;7 yr) and more dangerous if it fails."),
            ("Should my garage door match home siding?", "Functional question more than aesthetic. Match finish quality (painted steel, stained wood) to nearby trim. Strong visual accent (contrasting carriage-house style) adds curb appeal. Neutral steel in matching siding color is safest for resale."),
        ],
    },
    "kitchen": {
        "page": "kitchen-quote-analyzer.html",
        "label": "Kitchen",
        "noun": "kitchen remodel quote",
        "intro": "Kitchen remodel quotes vary massively &mdash; $15,000 to $75,000 for a \"kitchen remodel\" &mdash; because scope is so variable. A complete quote itemizes cabinets, countertops, appliances, plumbing, electrical, flooring, and labor separately so you can see where the budget actually goes.",
        "line_items": [
            ("Cabinets", "Box construction (plywood vs particleboard vs MDF), door material, brand, number of cabinet boxes. Stock, semi-custom, or custom."),
            ("Countertops", "Material (laminate, quartz, granite, butcher block, solid surface), square footage, edge profile, and installation."),
            ("Appliances", "Specific models: range, oven, refrigerator, dishwasher, microwave. Appliance budget is 10&ndash;30% of total kitchen cost."),
            ("Flooring", "Material (LVP, tile, hardwood), square footage, demo of existing floor."),
            ("Backsplash", "Tile type, square footage, and installation."),
            ("Plumbing rough-in and fixtures", "Sink, faucet, disposal, dishwasher connection. Any relocation adds $500&ndash;$2,000 per fixture."),
            ("Electrical", "Outlet additions (code requires GFCI on kitchen circuits), lighting (recessed, pendant, under-cabinet), fan, appliance circuits."),
            ("HVAC adjustments", "Vent hood work, any duct modifications. Some jurisdictions require code upgrades during remodel."),
            ("Drywall and paint", "Repair and paint after other work, ceiling work if changed."),
            ("Demolition and disposal", "Tear-out of existing kitchen, haul-away, containment."),
            ("Permit", "Required for most kitchen remodels involving plumbing, electrical, or structural changes."),
            ("Design and management fees", "Designer fees (5&ndash;20% of project), general contractor markup (10&ndash;25%)."),
            ("Warranty terms", "Labor (1&ndash;2 yrs typical), cabinets (mfr 5&ndash;lifetime), countertops (mfr 10&ndash;25 yrs), appliances (mfr 1&ndash;5 yrs)."),
        ],
        "red_flags": [
            ("Cabinet \"allowance\" without specific product", "A $15,000 cabinet allowance could be stock vs semi-custom vs custom &mdash; very different quality. Quotes should specify product line and brand for apples-to-apples comparison."),
            ("Appliances not itemized with model numbers", "\"Stainless appliance package\" without model numbers could be bottom-tier or mid-range. Each appliance should list brand, model, and price."),
            ("No permit on plumbing or electrical changes", "Kitchen remodels always trigger permit requirements when plumbing or electrical changes. Unpermitted work voids insurance and fails home inspection at resale."),
            ("Single lump-sum bid", "A quote with one number for \"kitchen remodel\" hides all the scope variables. Professional quotes itemize every category."),
            ("Countertop overlay vs replacement", "\"Countertop overlay\" (1/8\" thin layer over existing) is a weaker, cheaper alternative to full replacement. Budget pricing should match."),
            ("Minimal plumbing allowance on sink relocation", "Moving a sink more than a few inches requires drain and supply line rerouting &mdash; $500&ndash;$2,000 of plumbing work. Low allowances mean change orders."),
            ("DIY-grade cabinet install", "Cabinet installation requires precise leveling, shimming, and anchoring. Handyman install at $500&ndash;$1,500 is risk; pro install at $2,000&ndash;$5,000 for typical kitchen is quality."),
        ],
        "hidden_costs": [
            "Unexpected mold or water damage behind cabinets",
            "Outdated wiring that must be brought to code",
            "Structural reinforcement for kitchen island or open plan",
            "Gas line relocation for range move ($500&ndash;$2,000)",
            "Drywall repair from wall removal or electrical runs",
            "Floor transitions to adjacent rooms",
            "Code upgrades triggered by permit (GFCI, AFCI, vent hood)",
            "Appliance delivery and install fees",
        ],
        "faqs": [
            ("How much does a kitchen remodel cost?", "Cosmetic (paint + fixtures + countertops, keeping cabinets): $8,000&ndash;$20,000. Mid-range (new cabinets, countertops, appliances, flooring): $25,000&ndash;$55,000. High-end (custom cabinets, premium finishes): $60,000&ndash;$125,000+. IKD industry average is ~$27,000 for full remodel."),
            ("What should be on a legitimate kitchen remodel quote?", "Itemized scope: cabinets (with brand/line), countertops, appliances (with models), flooring, backsplash, plumbing, electrical, HVAC, drywall/paint, demolition, permit, design/management fees, and warranty terms. Lump-sum quotes hide scope."),
            ("What are red flags in a kitchen remodel quote?", "Cabinet \"allowance\" without specific product, appliances not itemized with models, no permit on plumbing/electrical, single lump-sum bid, countertop overlay substituting for replacement, minimal plumbing allowance on sink relocation, and DIY-grade cabinet install."),
            ("Should I hire a designer or do it myself?", "Designer cost: 5&ndash;20% of project ($2,000&ndash;$10,000). Saves money if: project over $40K, complex layout changes, or first remodel. Skip if: small cosmetic update, strong design confidence, or DIY research. IKD or NKBA certification matters; unlicensed \"designers\" vary wildly in value."),
            ("Cabinet refacing vs new cabinets?", "Refacing ($4,000&ndash;$9,000) works if: existing boxes are plywood and solid, layout works, and goal is appearance refresh. New cabinets ($10,000&ndash;$30,000) needed if: boxes are particle board, layout changes, or water damage. Painting existing cabinets ($1,500&ndash;$4,500) is lowest cost refresh."),
        ],
    },
    "landscaping": {
        "page": "landscaping-quote-analyzer.html",
        "label": "Landscaping",
        "noun": "landscaping quote",
        "intro": "Landscaping quotes are often the vaguest in home services because scope is so flexible. A complete quote breaks out design, hardscape, softscape, lighting, irrigation, and maintenance separately &mdash; and specifies plant sizes, material types, and warranties for each.",
        "line_items": [
            ("Design fee", "Designer time, plans, revisions. 5&ndash;15% of total project typical."),
            ("Hardscape scope", "Patios, walkways, walls, steps with specific materials and square footage. Stone type and pattern matter."),
            ("Softscape plants", "Specific species, sizes (1-gallon, 5-gallon, 15-gallon, container size), and counts. Mature size matters for plant spacing."),
            ("Sod or seed", "Square footage, grass type, soil prep, watering plan."),
            ("Irrigation system", "Zones, heads (rotor, spray, drip), smart controller, backflow preventer."),
            ("Landscape lighting", "Fixture count, style, wire gauge, transformer, smart control."),
            ("Mulch, stone, and edging", "Type (hardwood, cedar, pine straw, rubber, stone), depth (2&ndash;4\" typical), edging material."),
            ("Drainage", "French drains, swales, downspout extensions, dry wells. Critical if water issues."),
            ("Soil and amendments", "Topsoil delivery, compost, fertilizer, soil testing if needed."),
            ("Tree planting and removal", "Specific trees (species, size), removal of existing trees including stump grinding."),
            ("Permit", "Required for retaining walls over 4 ft, some drainage work, and tree removal in some jurisdictions."),
            ("Warranty terms", "Plants (typically 1 yr replacement if dead), hardscape (1&ndash;5 yrs workmanship), irrigation (1&ndash;3 yrs)."),
        ],
        "red_flags": [
            ("Plant \"allowance\" without species or sizes", "\"$2,000 in plants\" could be 20 1-gallon shrubs (wholesale cost $400) or 8 15-gallon trees (cost $800). Itemized species and sizes prevent this hidden markup."),
            ("Hardscape pricing without material spec", "\"Paver patio\" could be $3/sq ft concrete paver or $15/sq ft natural stone. Brand and product line matter."),
            ("No irrigation provision on new plantings", "New plantings need regular water first 1&ndash;2 seasons. Quote should include hose-bib extensions or irrigation zone; otherwise expect plant failure."),
            ("Retaining wall over 4 ft without engineering", "Walls over 4 ft tall require engineering and permit in most jurisdictions. Quotes that skip this are code violations."),
            ("Sod installed on poor soil", "Sod on compacted construction clay without amendments fails within months. Quote should include soil prep (2\"+ of topsoil/compost)."),
            ("No drainage plan on wet areas", "Water management before planting is critical on wet lots. Quote without drainage on wet lots means plant failure and erosion."),
            ("1-year plant warranty excludes replanting labor", "Read fine print &mdash; some warranties cover dead plant replacement but not digging out and replanting labor ($50&ndash;$150/plant)."),
        ],
        "hidden_costs": [
            "Soil testing and amendments ($300&ndash;$1,500)",
            "Tree removal and stump grinding ($500&ndash;$3,000 per tree)",
            "Existing irrigation repair or expansion",
            "Utility marking and underground coordination",
            "Soil disposal from excavation",
            "Extra topsoil to fix grading",
            "Maintenance or first-year watering service",
            "Permit fees beyond basic quote",
        ],
        "faqs": [
            ("How much does landscaping cost?", "Basic landscape refresh (mulch, plants, sod): $3,000&ndash;$10,000. Mid-range (hardscape patio, softscape, lighting): $15,000&ndash;$40,000. Full design-build (pool, hardscape, irrigation, lighting): $50,000&ndash;$200,000+. Industry standard: 10&ndash;20% of home value for comprehensive landscape."),
            ("What should be on a legitimate landscaping quote?", "Design fee, itemized hardscape (materials, sq ft), softscape plants (species, sizes, counts), sod or seed, irrigation zones and heads, lighting, mulch/stone/edging, drainage, soil amendments, tree work, permit, and warranty terms."),
            ("What are red flags in a landscaping quote?", "Plant allowance without species/sizes, hardscape without material spec, no irrigation on new plantings, retaining wall over 4 ft without engineering, sod on poor soil, no drainage on wet areas, and 1-year warranty excluding replanting labor."),
            ("Is a landscape designer worth it?", "On projects over $20K: usually yes. Designers ($1,000&ndash;$10,000) ensure plant selection fits climate/sun/soil, create cohesive design, and coordinate hardscape + softscape + irrigation. Saves plant failure and rework. DIY works on under-$10K refresh projects."),
            ("What's the difference between hardscape and softscape?", "Hardscape = non-living (patios, walls, paths, decking, fountains). Softscape = living (plants, trees, sod, mulch). Quality landscape integrates both. Hardscape typically 50&ndash;70% of project cost but longest-lasting."),
        ],
    },
    "moving": {
        "page": "moving-quote-analyzer.html",
        "label": "Moving",
        "noun": "moving quote",
        "intro": "Moving quotes come in two flavors: binding (price locked regardless of actual weight) and non-binding (price adjusts based on actual weight at destination). Non-binding quotes can double or triple at delivery if movers claim extra weight. A quality quote clearly states binding/non-binding, weight estimate method, and what's included.",
        "line_items": [
            ("Move type", "Local (under 50 mi, hourly billing), same-state (50&ndash;250 mi), long-distance (250&ndash;1,000 mi), cross-country (1,000+ mi)."),
            ("Binding or non-binding quote", "Binding = price locked regardless of actual weight. Non-binding = price can rise based on actual delivery weight. Binding is safer for consumers."),
            ("Weight estimate method", "In-home survey (most accurate) vs phone/video vs customer-provided inventory. Companies that quote without seeing your stuff will adjust upward at delivery."),
            ("Hourly rate (local moves)", "$25&ndash;$50 per mover per hour typical. 2-person team standard for 1-BR, 3-person for larger."),
            ("Per pound / per mile (long distance)", "$0.50&ndash;$0.80/lb per 1,000 miles. Cross-country can be higher."),
            ("Packing services", "Full pack, partial pack, or no pack. Each level has separate cost and timeline."),
            ("Packing materials", "Boxes, tape, padding, mattress bags, wardrobe boxes. Should be itemized or explicitly included."),
            ("Loading and unloading", "Time and crew size. Stairs, long carry, narrow doors, or elevator fees should be identified up-front."),
            ("Transit time", "How many days between pickup and delivery. Long-distance is usually 3&ndash;14 days; storage-in-transit adds cost."),
            ("Valuation / insurance", "Basic (60 cents/lb) is free but minimal. Full-value protection (1&ndash;3% of declared value) replaces damaged items at current value."),
            ("Storage in transit", "If move-out and move-in dates don't align. Typically $100&ndash;$400/month plus access fees."),
            ("Trip fee / fuel surcharge", "Diesel surcharge varies with fuel prices. Should be itemized."),
        ],
        "red_flags": [
            ("Quote without seeing your stuff", "Phone or online quotes always adjust upward on move day. Legitimate companies do in-home or video survey to weigh accurately."),
            ("Large deposit required up front (over 20%)", "Reputable movers require small deposit or none. Large upfront deposits ($500+) before the move is a common scam pattern."),
            ("Non-binding \"estimate\" that's really a low-ball", "Some rogue carriers give very low non-binding quotes, then load your items and demand 2&ndash;3x the quote for delivery. Always require binding or \"not to exceed\" quotes for long-distance."),
            ("No USDOT or MC number for interstate", "Interstate movers must be registered with FMCSA. Check at fmcsa.dot.gov/protect-your-move before signing. No USDOT = unregulated mover (likely scam)."),
            ("\"Full value protection\" with deductible per item", "Read the valuation fine print. Some \"full value\" coverage has per-item deductibles that exclude common damages. True full-value replacement is rare; most protection has limits."),
            ("Cash-only payment on delivery", "Requesting cash at delivery (instead of credit card) prevents dispute. Scam movers often demand cash to lock in the hostage pricing."),
            ("Add-on fees on move day", "Quotes should include likely add-ons (stairs, long carry, packing materials). Surprise fees on move day are standard scam practice."),
            ("No written inventory at pickup", "Every piece should be inventoried and labeled at pickup so you can verify what's delivered. No inventory = no proof when items are damaged or missing."),
        ],
        "hidden_costs": [
            "Stairs or elevator fees ($50&ndash;$300)",
            "Long carry (over 75 ft) ($50&ndash;$200)",
            "Shuttle service when truck can't reach home ($300&ndash;$1,500)",
            "Storage in transit if delivery window missed",
            "Additional packing materials beyond estimate",
            "Valuation coverage upgrade",
            "Piano, safe, or special-handling items",
            "Disassembly/reassembly of furniture ($50&ndash;$200 per item)",
        ],
        "faqs": [
            ("What should be on a legitimate moving quote?", "Move type (local vs long-distance), binding or non-binding status, weight estimate method, hourly rate or per-pound/per-mile, packing services if any, packing materials, loading/unloading, transit time, valuation/insurance level, storage-in-transit if needed, and any trip fees or fuel surcharges."),
            ("Binding vs non-binding moving quote?", "Binding: price is locked regardless of actual weight or extra services. Safest for consumer. Non-binding: price adjusts based on actual delivery weight &mdash; can rise 20&ndash;100%+ if mover under-estimates. \"Not to exceed\" or \"binding\" is best."),
            ("What are red flags in a moving quote?", "Quote without in-home survey, large upfront deposit (over 20%), very low non-binding quote, no USDOT/MC number for interstate, cash-only on delivery, add-on fees on move day, and no written inventory at pickup."),
            ("How do I avoid moving scams?", "Verify USDOT number at fmcsa.dot.gov. Require binding or not-to-exceed quote. Never pay large deposit up front. Require written inventory at pickup. Keep valuables and important documents with you. Get 3 written quotes from different companies."),
            ("When is the cheapest time to move?", "October&ndash;April is 20&ndash;30% cheaper than May&ndash;September peak season. Mid-month weekdays are cheapest. Avoid end-of-month and weekends. Booking 4&ndash;8 weeks ahead ensures available crews and best rates."),
        ],
    },
    "auto-repair": {
        "page": "auto-repair.html",
        "label": "Auto repair",
        "noun": "auto repair quote",
        "intro": "Auto repair quotes are notoriously vague. \"Brake job\" could be $150 pad replacement or $1,500 full brake system overhaul. A quality quote itemizes parts vs labor, OEM vs aftermarket, diagnostic scope, and warranty &mdash; and distinguishes necessary work from \"recommended\" upsells.",
        "line_items": [
            ("Diagnostic scope", "What was inspected, what codes were pulled, what caused the symptom."),
            ("Parts itemized by line", "Each part with OEM or aftermarket specification, part number, and price."),
            ("Labor hours and rate", "Flat-rate labor per procedure (based on manufacturer or MOTOR labor guide) vs actual hours. Rate: $100&ndash;$200/hour dealer, $75&ndash;$150 independent."),
            ("OEM vs aftermarket parts", "OEM (manufacturer-made): highest quality, highest price. Quality aftermarket (Bosch, Denso, Duralast Gold): 80&ndash;95% of OEM quality at 50&ndash;80% the cost. Cheap aftermarket: avoid for safety items."),
            ("Shop supplies / environmental fees", "3&ndash;10% of labor typical. Should be a small line item, not hidden in parts markup."),
            ("Taxes", "State sales tax on parts (not labor in most states)."),
            ("Warranty terms", "Parts warranty (mfr: typically 12 mo/12K mi) + labor warranty (shop: typically 12 mo/12K mi minimum; NAPA/BG 24/24; dealer full warranty on OEM)."),
            ("Diagnostic charge", "$75&ndash;$200 typical. Should be waived or credited toward repair if you proceed."),
            ("Recommended vs required", "Quote should separate necessary repairs (for safe operation) from recommended maintenance (preventive)."),
        ],
        "red_flags": [
            ("Parts markup over 40%", "Shops typically mark up parts 25&ndash;40% over wholesale. Over 50% is excessive &mdash; ask for itemization."),
            ("\"Full brake job\" without inspection", "A real brake quote specifies what was worn: pads, rotors, calipers, hoses, fluid. \"Full brake job\" without specifics is selling everything regardless of need."),
            ("Shotgun repair (replace everything)", "Good diagnostics identify the specific failed component. If a shop can't isolate the problem, they'll replace every related part &mdash; expensive and unnecessary."),
            ("Up-selling during simple service", "Oil changes and tire rotations often surface \"urgent\" recommendations. Healthy skepticism: some are real, many are profit-driven."),
            ("No diagnostic before quote", "A quote without diagnosis is a guess. For any check-engine or unusual-behavior issue, a proper diagnostic ($75&ndash;$200) saves thousands in wrong repairs."),
            ("\"We can't show you the old part\"", "Legitimate shops save old parts (or at least let you inspect them) as proof of repair. Can't-show-it is a red flag."),
            ("Labor time grossly exceeding flat-rate book", "Flat-rate labor guides (MOTOR, AllData, manufacturer) set standard hours for each procedure. If quoted labor is 2&ndash;3x flat-rate, either shop is slow or padding hours."),
            ("No warranty on labor", "Quality shops offer 12-month/12,000-mile labor warranty minimum. Shorter or no warranty suggests they know issues will recur."),
        ],
        "hidden_costs": [
            "Environmental / disposal fees ($3&ndash;$25)",
            "Shop supplies ($3&ndash;$25)",
            "State inspection after repair ($20&ndash;$80)",
            "Alignment after brake/suspension work ($80&ndash;$150)",
            "Fluid top-offs or flushes",
            "Additional labor when part-fit requires shop extras",
            "Emissions work triggered by repair",
            "Tow fees if car is inoperable",
        ],
        "faqs": [
            ("What should be on a legitimate auto repair quote?", "Diagnostic scope and findings, itemized parts (with OEM/aftermarket spec and part numbers), labor hours and rate, shop supplies, taxes, warranty terms (parts + labor), diagnostic charge if applicable, and recommended vs required work clearly separated."),
            ("How do I know if auto repair pricing is fair?", "Check RepairPal (repairpal.com) or Kelley Blue Book for your make/model repair estimates. Get 2&ndash;3 quotes from different shops (dealer, independent, chain). Parts markup should be 25&ndash;40%, not 60&ndash;100%. Labor rate should match local averages."),
            ("What are red flags in an auto repair quote?", "Parts markup over 40%, \"full brake job\" without inspection, shotgun repair replacing everything, aggressive upselling during simple service, no diagnostic before quote, shop refusing to show old parts, and no labor warranty."),
            ("OEM vs aftermarket parts?", "OEM is best for: engine internals, transmission components, safety systems, sensors, under-warranty cars. Quality aftermarket (Bosch, Denso, Duralast Gold) is fine for: brakes, belts, filters, batteries, wipers, hoses. Cheap aftermarket: avoid for safety items."),
            ("Should I get a second opinion on auto repairs?", "For any repair over $1,000: yes. Most reputable shops will do inspection/diagnostic for $75&ndash;$200, credited toward repair. Brand dealers are often 2&ndash;3x independent shop prices for same work. YouTube + forums can reveal if a repair is common or unusual for your make/model."),
        ],
    },
    "medical": {
        "page": "medical-bill-analyzer.html",
        "label": "Medical bill",
        "noun": "medical bill",
        "intro": "Medical bills are designed to be opaque. Billing codes, \"charges\" vs \"allowed amounts\" vs \"patient responsibility,\" and balance billing make it nearly impossible to tell if a bill is fair. A proper analysis breaks down the chargemaster price, insurance-negotiated rate, and your actual obligation &mdash; because the three are very different numbers.",
        "line_items": [
            ("CPT/HCPCS procedure codes", "5-digit codes (e.g., 99213, 45378) that identify each service. Each code has a standard fee schedule. Unbundled codes for services that should be bundled is a common error."),
            ("DRG (hospital diagnosis code)", "Inpatient admissions paid by DRG (diagnosis-related group), not itemized charges. Verify DRG matches discharge paperwork."),
            ("Charged amount", "The \"chargemaster\" price, usually 2&ndash;10x what insurance pays. Rarely what anyone actually owes if insured."),
            ("Allowed amount (insurance-negotiated)", "The contractually negotiated rate between insurance and provider. This is the actual price of the service."),
            ("Insurance paid", "What insurance contributed. Depends on deductible, copay, coinsurance, and plan benefits."),
            ("Patient responsibility", "What you actually owe &mdash; should equal allowed amount minus insurance paid (after deductible/coinsurance math). Commonly wrong."),
            ("EOB (Explanation of Benefits)", "Sent by insurance, not provider. The authoritative version of what insurance covered &mdash; always cross-reference against the bill."),
            ("Diagnosis codes (ICD-10)", "Why you were seen. Wrong diagnosis can cause denied claims. E-codes for accidents may trigger subrogation."),
            ("Modifiers", "Codes that adjust base CPT pricing. Modifier 22 (unusual procedure), 26 (professional component), 59 (distinct service), and others. Fraudulent modifier use inflates bills."),
            ("Provider NPI", "National Provider Identifier. Cross-reference with insurance network status &mdash; out-of-network triggers balance billing."),
            ("Place of service code", "Where service was performed (11 = office, 21 = inpatient, 22 = outpatient hospital, 23 = ER). Higher codes allow higher billing."),
        ],
        "red_flags": [
            ("Balance billing from in-network hospital", "The No Surprises Act (2022+) protects against balance billing from ancillary providers at in-network hospitals. If balance-billed, dispute with insurance."),
            ("Duplicate charges", "Same CPT code billed twice (same date, same provider) without separate documentation. Common in ER and surgical billing."),
            ("Unbundling", "Billing separate codes for services that should be bundled under one CPT. E.g., billing separately for \"surgical incision\" + \"procedure\" + \"wound closure\" instead of one procedure code."),
            ("Upcoding", "Billing a higher-complexity code than the service justified. E.g., 99214 (moderate complexity office visit) when service was 99213 (low complexity). 15&ndash;30% higher payment."),
            ("Phantom charges", "Items on bill for services not rendered. Common: supplies, lab tests, or equipment patient didn't receive."),
            ("Facility fee + professional fee duplication", "Some procedures legitimately bill both facility (hospital) + professional (doctor) fees. But check that they're not double-billing for the same component."),
            ("Out-of-network without disclosure", "Was a specialist who saw you at an in-network hospital actually in-network? If not, the hospital should have disclosed in writing. No Surprises Act provides protections."),
            ("No itemized bill provided", "You have the right to an itemized bill under HIPAA. If only summary is provided, request itemized in writing."),
        ],
        "hidden_costs": [
            "Facility fees in hospital-owned clinics ($100&ndash;$500)",
            "Radiology read fees (separate from X-ray itself)",
            "Anesthesia billed separately from surgery",
            "Pathology fees for biopsy or surgical specimen",
            "Out-of-network ambulance transport",
            "Observation status vs inpatient admission (huge cost difference)",
            "Drugs dispensed during visit (pharmacy vs clinic billing)",
            "Consultations added by specialists during hospitalization",
        ],
        "faqs": [
            ("What should be on a legitimate medical bill?", "Itemized services with CPT/HCPCS codes, diagnosis codes (ICD-10), modifiers, place of service code, provider NPI, chargemaster amount, insurance allowed amount, insurance paid, your responsibility, and date of service. You're entitled to itemized billing under HIPAA."),
            ("How do I know if a medical bill is accurate?", "Request itemized bill. Cross-reference against EOB from your insurance. Check for duplicate charges, unbundling, and upcoding. Verify procedure codes match your treatment records. Compare \"allowed amount\" to FAIR Health or Healthcare Bluebook benchmarks for your area."),
            ("What are red flags in a medical bill?", "Balance billing from in-network hospital (No Surprises Act violation), duplicate charges, unbundled codes, upcoded visits, phantom charges, facility + professional fee duplication for same service, out-of-network services not disclosed, and no itemized bill provided."),
            ("How do I dispute a medical bill?", "Step 1: Request itemized bill in writing. Step 2: Compare to EOB. Step 3: Request medical records for date of service. Step 4: Call provider billing (ask for supervisor). Step 5: Dispute with insurance if coverage issue. Step 6: File complaint with state insurance commissioner or CFPB for persistent errors."),
            ("Can I negotiate a medical bill?", "Yes, often. Hospitals write off 20&ndash;60% of self-pay bills regularly. Charity care applies for under 400% of FPL in many hospitals. Payment plans are nearly always available interest-free. Never ignore the bill &mdash; it hurts credit after 120 days."),
        ],
    },
    "legal": {
        "page": "legal-fee-analyzer.html",
        "label": "Legal fee",
        "noun": "legal fee quote",
        "intro": "Legal fees are opaque and vary wildly. A simple will could be $150 online or $1,500 from an attorney. A quality legal quote or engagement letter specifies: fee structure (hourly/flat/contingency), scope, expenses separate from fees, and what's NOT included &mdash; because \"miscellaneous\" charges at billing time are where surprises happen.",
        "line_items": [
            ("Fee structure", "Hourly (most common), flat fee (wills, uncontested divorce, some criminal), contingency (injury, class action, some employment), hybrid (reduced hourly + bonus)."),
            ("Hourly rate", "$150&ndash;$500+/hour for general practice. $400&ndash;$1,500+/hour for specialists, patent, M&A, or big firms. Region and firm size matter."),
            ("Retainer amount", "Up-front deposit against future billing. Should be held in IOLTA trust account until earned."),
            ("Scope of engagement", "Specifically what will be done: discovery, motions, trial, appeal, negotiations. Each phase may have separate fees."),
            ("Expenses vs fees", "Expenses (filing fees, expert witnesses, deposition transcripts, travel, research databases) billed separately from lawyer time. Should be itemized at invoice."),
            ("Paralegal / associate rate", "Lower than partner rate. Should specify who performs what work (partner, associate, paralegal)."),
            ("Billing increments", "0.1 hour (6 min) or 0.25 hour (15 min). 0.1 is more accurate for consumer; 0.25 rounds up most calls to 15 min minimum."),
            ("Contingency fee percentage", "25&ndash;40% of recovery (if contingency case). Higher for trial vs settlement."),
            ("Flat fee scope boundaries", "What's included in flat fee and what triggers hourly billing above it. Should be explicit."),
            ("Trust account details", "Retainer goes into IOLTA trust account, drawn down as work is performed. You're entitled to regular accounting."),
        ],
        "red_flags": [
            ("Vague scope of engagement", "Engagement letter should specify exactly what work will be done. \"Representation in divorce matter\" is too broad &mdash; is that through settlement, trial, appeal?"),
            ("No written engagement letter", "All legal work should have signed written engagement letter under most state bar rules. Verbal-only agreements are unenforceable and unethical."),
            ("Retainer that's not in trust account", "Retainer funds must sit in IOLTA trust account until earned. Mixing with operating account is serious ethics violation."),
            ("Block billing", "Unclear entries like \"5.0 hrs: case work\" without specific tasks. Proper billing shows each task and time."),
            ("Markup on expenses", "Filing fees, transcripts, etc. should be passed through at cost. Markup on expenses (\"admin fee\") is sometimes legitimate but should be disclosed."),
            ("Contingency for non-contingency work", "Routine estate planning, wills, or uncontested matters shouldn't be contingency. Contingency is for matters with uncertain outcomes where fee comes from recovery."),
            ("\"Guaranteed\" outcomes", "No reputable lawyer guarantees case outcomes. \"We'll definitely win your case\" is ethically prohibited and a sales tactic."),
            ("Hourly billing without monthly invoices", "Should receive detailed monthly invoices showing tasks, time, and running total. Bills only at case end prevent oversight and dispute."),
        ],
        "hidden_costs": [
            "Expert witness fees ($1,000&ndash;$10,000+)",
            "Deposition transcripts ($500&ndash;$5,000)",
            "Court filing fees ($100&ndash;$1,000)",
            "Travel time billed at partial rate",
            "Legal research database fees",
            "Mediator or arbitrator fees",
            "Process server and subpoena fees",
            "Copy costs and courier",
        ],
        "faqs": [
            ("What should be on a legitimate legal fee quote?", "Fee structure (hourly/flat/contingency), hourly rates by role (partner/associate/paralegal), retainer amount, scope of engagement, expenses separately itemized, billing increments, contingency percentage if applicable, flat fee scope boundaries, and trust account details for retainer."),
            ("Hourly vs flat fee vs contingency?", "Hourly: best when scope uncertain. Flat: predictable for defined matters (wills, uncontested divorce, closing). Contingency: when outcome uncertain and recovery-dependent (injury, employment). Don't pay contingency on sure things; don't pay hourly on simple defined work."),
            ("What are red flags in a legal engagement?", "Vague scope, no written engagement letter, retainer not in IOLTA trust, block billing, markup on expenses without disclosure, contingency for non-contingency work, \"guaranteed\" outcomes, and hourly billing without monthly invoices."),
            ("Can I negotiate legal fees?", "Yes, for: non-emergency matters, flat fee projects, and hourly work with defined scope. Not for: emergency representation, highly specialized work, or low-ball retainers. Most lawyers will discuss rate structure, billing increments, and scope caps. Shop 2&ndash;3 attorneys for important matters."),
            ("How do I dispute a legal bill?", "Step 1: Request detailed itemization. Step 2: Compare to engagement letter scope. Step 3: Identify overbilling (duplicate time, block billing, excessive research). Step 4: Discuss with billing attorney. Step 5: If unresolved, file fee arbitration complaint with state bar (most states have free fee arbitration). Step 6: Lawsuit or malpractice claim as last resort."),
        ],
    },
}


def build_section(v):
    """Generate analyzer-focused SEO HTML block for a vertical."""
    label = v["label"]
    noun = v["noun"]
    # Pick "a" or "an" based on spoken pronunciation.  HVAC is pronounced
    # "aitch-vac" so it takes "an"; electrical/insulation/auto start with
    # vowels; others start with consonants.
    first = noun.lstrip().lower()
    article = "an" if first[0] in "aeiou" or first.startswith("hvac") else "a"

    # Line items list
    items_html = ""
    for title, desc in v["line_items"]:
        items_html += f'''
        <div style="padding:18px; background:#fff; border:1px solid #e2e8f0; border-radius:10px;">
          <div style="font-weight:700; font-size:15px; margin-bottom:6px;">{title}</div>
          <p style="font-size:14px; color:#475569; margin:0; line-height:1.6;">{desc}</p>
        </div>'''

    line_items_html = f'''
      <h2 style="font-size:28px; margin:0 0 10px;">What to look for on {article} {noun}</h2>
      <p style="color:#475569; line-height:1.7; margin:0 0 20px;">{v["intro"]}</p>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; margin-bottom:32px;">{items_html}
      </div>
'''

    # Red flags list
    flags_html = ""
    for title, desc in v["red_flags"]:
        flags_html += f'''
        <div style="padding:16px 18px; background:#fef2f2; border:1px solid #fecaca; border-left:4px solid #ef4444; border-radius:8px; margin-bottom:10px;">
          <div style="font-weight:700; font-size:15px; color:#991b1b; margin-bottom:4px;">{title}</div>
          <p style="font-size:14px; color:#7f1d1d; margin:0; line-height:1.6;">{desc}</p>
        </div>'''

    red_flags_html = f'''
      <h2 style="font-size:28px; margin:40px 0 16px;">Red flags in {article} {noun}</h2>
      <div>{flags_html}
      </div>
'''

    # Hidden costs
    hidden_html = "".join(f'<li style="margin-bottom:8px;">{h}</li>' for h in v["hidden_costs"])
    hidden_costs_html = f'''
      <h2 style="font-size:28px; margin:40px 0 12px;">Common hidden costs and change orders</h2>
      <p style="color:#475569; line-height:1.7; margin:0 0 12px;">These items are often missing from the initial {noun} and show up later as change orders or surprise fees. Ask about each before signing.</p>
      <ul style="color:#475569; line-height:1.8; margin:0 0 24px; padding-left:20px;">{hidden_html}
      </ul>
'''

    # FAQs
    faq_html_items = ""
    schema_questions = []
    for q, a in v["faqs"]:
        faq_html_items += f'''
        <details class="faq-item" style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:16px 20px; margin-bottom:8px;">
          <summary style="font-weight:700; cursor:pointer; font-size:16px;">{q}</summary>
          <div class="faq-answer" style="padding-top:10px; color:#475569; font-size:15px; line-height:1.7;">{a}</div>
        </details>'''
        a_plain = re.sub(r'<[^>]+>', '', a)
        a_plain = a_plain.replace("&ndash;", "-").replace("&mdash;", "-").replace("&Prime;", "''").replace("&deg;", " degrees").replace("&amp;", "&").replace("&rarr;", "to")
        q_plain = q.replace("&Prime;", "''").replace("&deg;", " degrees")
        schema_questions.append({"@type": "Question", "name": q_plain, "acceptedAnswer": {"@type": "Answer", "text": a_plain}})

    faq_html = f'''
      <h2 style="font-size:28px; margin:40px 0 16px;">Frequently asked questions about {noun}s</h2>
      <div class="faq-list">{faq_html_items}
      </div>
'''

    schema_json = json.dumps({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": schema_questions}, ensure_ascii=False)

    full_section = f'''
  <!-- TP-ANALYZER-SEO-V1 -->
  <section style="padding:48px 0; border-top:1px solid var(--border, #e2e8f0); background:#f8fafc;">
    <div class="container" style="max-width:960px;">
{line_items_html}{red_flags_html}{hidden_costs_html}{faq_html}
    </div>
  </section>

  <script type="application/ld+json">
  {schema_json}
  </script>
'''
    return full_section


def main():
    count_ok = 0
    count_skip = 0
    count_fail = 0
    for vslug, v in VERTICALS.items():
        page = ROOT / v["page"]
        if not page.exists():
            print(f"SKIP: {v['page']} not found")
            count_skip += 1
            continue
        text = page.read_text(encoding="utf-8")
        if "TP-ANALYZER-SEO-V1" in text:
            print(f"SKIP (already injected): {v['page']}")
            count_skip += 1
            continue

        section = build_section(v)
        new_text, n = re.subn(r'(\s*</main>)', section + r'\1', text, count=1)
        if n == 0:
            print(f"FAIL (no </main>): {v['page']}")
            count_fail += 1
            continue
        page.write_text(new_text, encoding="utf-8")
        word_count = len(re.sub(r'<[^>]+>', ' ', section).split())
        print(f"OK: {v['page']} (+{word_count} words)")
        count_ok += 1

    print(f"\n{count_ok} injected, {count_skip} skipped, {count_fail} failed")


if __name__ == "__main__":
    main()
