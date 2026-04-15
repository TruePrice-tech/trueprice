"""inject-estimate-seo.py — add deep SEO content + city hub + FAQ schema
to remaining estimate pages (roof, hvac, painting, plumbing, electrical,
siding, window, foundation, garage-door, solar, moving).

Generates the same structure already shipped on fence/insulation/gutter/
concrete/kitchen/landscaping pages: comparison table, deep-dive sections,
cost factors grid, city links, FAQs with FAQPage JSON-LD.

Idempotent via <!-- TP-ESTIMATE-SEO-V1 --> marker.
"""

import re
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Per-vertical content config
VERTICALS = {
    "roof": {
        "page": "roof-replacement-cost-calculator.html",
        "label": "Roof",
        "table_title": "Roof replacement cost by material (2026)",
        "table_intro": "National average ranges, installed. Roof size, pitch, and tear-off scope all create regional variation.",
        "table_cols": ["Material", "Cost per sq ft", "Lifespan", "Best for"],
        "table_rows": [
            ("Asphalt 3-tab", "$3.50&ndash;$5.50", "15&ndash;20 yrs", "Lowest upfront cost"),
            ("Architectural shingles", "$4.50&ndash;$8.50", "25&ndash;30 yrs", "Most popular, good ROI"),
            ("Metal (standing seam)", "$10&ndash;$20", "40&ndash;70 yrs", "Long lifespan, energy efficient"),
            ("Metal (corrugated)", "$5&ndash;$12", "30&ndash;50 yrs", "Cheapest metal option"),
            ("Tile (clay/concrete)", "$10&ndash;$20", "50+ yrs", "SW US, premium aesthetic"),
            ("Slate", "$15&ndash;$45", "75&ndash;100 yrs", "Premium, very long-lived"),
            ("Wood shake", "$8&ndash;$14", "20&ndash;40 yrs", "Rustic look, fire risk in some areas"),
            ("EPDM/TPO (flat)", "$5&ndash;$12", "20&ndash;30 yrs", "Flat or low-slope roofs"),
        ],
        "deep_dives": [
            ("Cost of asphalt shingle roofing", [
                "Asphalt is on 70%+ of US homes for good reason: cheapest material, fastest install, decent lifespan. Architectural (laminated) shingles cost about 30% more than 3-tab but last 5&ndash;10 years longer and look noticeably nicer. For a typical 2,000 sq ft home with 22 squares of roof area, expect <strong>$8,500&ndash;$16,000</strong> for full architectural shingle replacement including tear-off, underlayment, and standard accessories."
            ]),
            ("Cost of metal roof replacement", [
                "Standing seam metal roofs run <strong>$15,000&ndash;$30,000</strong> for an average home &mdash; roughly 2&ndash;3x the cost of asphalt &mdash; but last 40&ndash;70 years and improve energy efficiency 10&ndash;25%. Corrugated metal is the cheapest metal option at $5&ndash;$12/sq ft, popular for barns, garages, and budget-conscious whole-home installs.",
                "Insurance discounts of 10&ndash;30% are common on metal roofs in hail-prone regions."
            ]),
            ("Roof replacement cost factors", [
                "Beyond material, the biggest cost drivers are: roof pitch (steep roofs add 15&ndash;30% labor for safety), tear-off layers (each existing layer adds $1&ndash;$2/sq ft to remove), decking replacement ($2&ndash;$5/sq ft for any rotted plywood), chimney/skylight flashing (each adds $300&ndash;$1,000), and upgraded underlayment or ice-and-water shield ($0.50&ndash;$1.50/sq ft)."
            ]),
        ],
        "cost_factors": [
            ("Roof size", "Measured in 'squares' (100 sq ft each). Average single-family home: 22 squares. Multiply per-sq-ft cost by total square feet to estimate."),
            ("Pitch / slope", "Steep roofs (8/12+) add 15&ndash;30% labor for safety equipment and slower work. Flat roofs need different membrane materials."),
            ("Tear-off layers", "Each existing roof layer to remove adds $1&ndash;$2/sq ft. Most cities allow only 2 total layers, so most roofs need full tear-off."),
            ("Decking repair", "Plywood damage uncovered during tear-off costs $2&ndash;$5/sq ft to replace. Budget 5&ndash;10% extra for surprises."),
            ("Flashing + accessories", "Chimney flashing $300&ndash;$1,000. Skylight reflashing $200&ndash;$500. Drip edge, ridge vent, starter strip add $1&ndash;$3/sq ft."),
            ("Permits + dump fees", "$200&ndash;$1,000 in permits depending on city. Disposal of old shingles $400&ndash;$1,000 in dumpster fees."),
        ],
        "city_slugs": ["new-york-ny","los-angeles-ca","chicago-il","houston-tx","phoenix-az","philadelphia-pa","san-antonio-tx","san-diego-ca","dallas-tx","austin-tx","jacksonville-fl","fort-worth-tx","columbus-oh","charlotte-nc","indianapolis-in","seattle-wa","denver-co","washington-dc","boston-ma","nashville-tn","detroit-mi","portland-or","las-vegas-nv","memphis-tn"],
        "faqs": [
            ("How much does a new roof cost?", "For a typical 2,000 sq ft home, full roof replacement runs $8,500&ndash;$16,000 for architectural asphalt shingles. Premium metal roofs run $15,000&ndash;$30,000. Tile or slate can hit $25,000&ndash;$60,000+. Tear-off, decking repairs, and pitch all impact final pricing."),
            ("How long does a roof last?", "Asphalt 3-tab: 15&ndash;20 years. Architectural shingles: 25&ndash;30 years. Metal: 40&ndash;70 years. Tile: 50+ years. Slate: 75&ndash;100 years. Manufacturer warranty is usually shorter than expected lifespan. Climate (hail, sun exposure, freeze-thaw) significantly impacts real-world life."),
            ("Should I do tear-off or roof-over?", "Roof-over (installing new shingles on top of old) saves $1,500&ndash;$3,500 in tear-off costs but reduces lifespan, voids most warranties, hides decking damage, and most cities only allow 2 total layers. Tear-off is almost always the right call for permanent fix."),
            ("Is metal roofing worth the premium?", "Metal costs 2&ndash;3x asphalt upfront but lasts 2&ndash;3x as long. Lifetime cost is similar; metal wins on energy efficiency (10&ndash;25% lower cooling bills), insurance discounts in hail country, and resale value. Best ROI in hot or hail-prone climates."),
            ("How long does roof installation take?", "A typical asphalt shingle replacement takes 1&ndash;3 days for a 2-person crew. Metal roofs take 3&ndash;7 days. Tile or slate: 1&ndash;3 weeks. Weather delays are common &mdash; budget extra time during rainy or hot seasons."),
        ],
    },
    "hvac": {
        "page": "hvac-estimate.html",
        "label": "HVAC",
        "table_title": "HVAC replacement cost by system type (2026)",
        "table_intro": "National average ranges, fully installed. System size, efficiency rating (SEER/AFUE), and ductwork all impact cost.",
        "table_cols": ["System type", "Total installed cost", "Lifespan", "Best for"],
        "table_rows": [
            ("Central AC (14&ndash;16 SEER)", "$3,500&ndash;$7,500", "12&ndash;17 yrs", "Standard cooling, paired with furnace"),
            ("Central AC (18+ SEER)", "$5,500&ndash;$11,000", "15&ndash;20 yrs", "Energy savings, hot climates"),
            ("Heat pump (15 SEER)", "$5,000&ndash;$10,000", "12&ndash;17 yrs", "Mild climates, heating + cooling combo"),
            ("Gas furnace (80% AFUE)", "$3,000&ndash;$5,500", "15&ndash;25 yrs", "Cold climates, lowest cost"),
            ("Gas furnace (96% AFUE)", "$4,500&ndash;$8,500", "15&ndash;25 yrs", "Cold climates, energy efficient"),
            ("Mini-split (single zone)", "$3,500&ndash;$8,000", "15&ndash;20 yrs", "No-duct homes, room additions"),
            ("Mini-split (multi-zone)", "$8,000&ndash;$18,000", "15&ndash;20 yrs", "Whole-house no-duct retrofit"),
            ("Geothermal", "$20,000&ndash;$40,000", "25+ yrs (loops 50+)", "Long-term energy savings, high upfront"),
        ],
        "deep_dives": [
            ("HVAC system replacement cost (whole house)", [
                "Most full HVAC replacements run <strong>$6,000&ndash;$14,000</strong> &mdash; that's a complete swap of AC + furnace (or heat pump) for a typical 2,000 sq ft home. The system size you need is dictated by home square footage and climate: 2.5&ndash;3 tons for an average home in moderate climate, 3.5&ndash;5 tons in hot climates or large homes.",
                "Central AC alone (replacing just the outdoor unit + indoor coil) runs $3,500&ndash;$8,500. Furnace alone runs $3,000&ndash;$8,500. Doing both at once usually saves 10&ndash;20% in labor vs separate visits."
            ]),
            ("AC unit cost vs heat pump cost", [
                "Heat pumps cost $1,000&ndash;$3,000 more upfront than central AC + furnace combos in most cases. The trade-off: heat pumps both cool AND heat with one system, eliminating gas furnace operating costs. In mild climates (Zone 3&ndash;4), heat pumps pay back in 6&ndash;9 years through lower utility bills.",
                "In cold climates (Zone 6&ndash;7), heat pumps need backup heat (electric resistance or gas) for the coldest days, which complicates the math. Cold-climate heat pumps (Mitsubishi Hyper-Heat, Bosch IDS) work efficiently down to &minus;15&deg;F but cost $2,500&ndash;$5,000 more than standard models."
            ]),
            ("Federal tax credits and rebates for HVAC (2026)", [
                "The Energy Efficient Home Improvement Credit gives you 30% back (up to $2,000/year) on qualifying heat pumps and central AC units that meet ENERGY STAR efficiency tiers. Heat pump water heaters get up to $2,000 separately.",
                "Many utilities offer additional rebates: $200&ndash;$1,500 for high-efficiency systems. Always ask your contractor to list every applicable incentive before signing."
            ]),
        ],
        "cost_factors": [
            ("Home size + tonnage", "Bigger homes need more tonnage. Rule of thumb: 1 ton per 600 sq ft (moderate climate), 500 sq ft (hot), 700 sq ft (mild). Oversizing wastes money + cycles too often."),
            ("SEER / AFUE rating", "Higher efficiency costs more upfront but pays back in utility savings. Each SEER point above 14 typically adds $400&ndash;$800 to cost; payback varies by climate."),
            ("Ductwork condition", "Existing ducts may need cleaning ($300&ndash;$600), repair ($500&ndash;$2,000), or full replacement ($3,000&ndash;$8,000). Leaky ducts can waste 20&ndash;30% of HVAC output."),
            ("System type", "Heat pump vs AC+furnace adds $1,000&ndash;$3,000 upfront but consolidates heating + cooling. Mini-splits avoid ductwork entirely &mdash; great for older homes."),
            ("Install complexity", "Tight crawlspace, attic install, or relocating units adds labor. Second-floor unit installs cost more due to refrigerant line runs."),
            ("Permits + inspection", "$150&ndash;$500 in most cities. Required for refrigerant changes, electrical mods, and gas line work."),
        ],
        "city_slugs": ["new-york-ny","los-angeles-ca","chicago-il","houston-tx","phoenix-az","san-antonio-tx","dallas-tx","austin-tx","jacksonville-fl","fort-worth-tx","columbus-oh","charlotte-nc","indianapolis-in","seattle-wa","denver-co","atlanta-ga","miami-fl","tampa-fl","philadelphia-pa","nashville-tn","memphis-tn","las-vegas-nv","orlando-fl","sacramento-ca"],
        "faqs": [
            ("How much does it cost to replace an HVAC system?", "Full HVAC replacement (AC + furnace, or heat pump) for a typical 2,000 sq ft home runs $6,000&ndash;$14,000 installed. Higher-efficiency systems and larger homes can hit $18,000+. Just AC: $3,500&ndash;$8,500. Just furnace: $3,000&ndash;$8,500."),
            ("How long does an HVAC system last?", "Central AC: 12&ndash;17 years. Heat pump: 12&ndash;17 years. Gas furnace: 15&ndash;25 years. Boilers: 20&ndash;30 years. Annual maintenance significantly extends life. Coastal/high-humidity climates shorten outdoor unit life by 3&ndash;5 years."),
            ("What size HVAC system do I need?", "Rule of thumb: 1 ton (12,000 BTU) per 500&ndash;700 sq ft of conditioned space. A 2,000 sq ft home typically needs 3&ndash;3.5 tons in moderate climates. Manual J load calculation (required by code in many states) gives a precise size based on insulation, windows, and orientation."),
            ("Should I replace AC and furnace at the same time?", "If both are 10+ years old: usually yes. Matched systems run more efficiently, contractors offer 10&ndash;20% bundle discounts, and it's only one install disruption. If one is much newer than the other, replacing only the failed unit is fine."),
            ("Are there HVAC tax credits in 2026?", "Yes &mdash; the federal Energy Efficient Home Improvement Credit gives 30% back up to $2,000/year on qualifying heat pumps and central AC. Many utilities offer additional $200&ndash;$1,500 rebates. Ask your contractor to itemize all applicable credits before signing."),
        ],
    },
    "painting": {
        "page": "painting-estimate.html",
        "label": "House painting",
        "table_title": "House painting cost by project type (2026)",
        "table_intro": "National average ranges, two-coat application with mid-grade paint. Premium paint and prep work add to cost.",
        "table_cols": ["Project", "Cost per sq ft", "Typical project total", "Notes"],
        "table_rows": [
            ("Interior painting (walls only)", "$2&ndash;$6", "$1,500&ndash;$4,500", "1,500 sq ft home, walls only"),
            ("Interior painting (full)", "$3&ndash;$8", "$3,000&ndash;$8,000", "Walls, ceilings, trim"),
            ("Single room (10x12)", "&mdash;", "$300&ndash;$900", "Walls only, mid-grade paint"),
            ("Single room (full)", "&mdash;", "$500&ndash;$1,500", "Walls, ceiling, trim, doors"),
            ("Exterior painting (siding only)", "$2&ndash;$5", "$3,000&ndash;$8,000", "1,500 sq ft of siding"),
            ("Exterior (full house)", "$3&ndash;$8", "$4,500&ndash;$13,000", "Includes trim, doors, prep"),
            ("Cabinet painting (10x10 kitchen)", "&mdash;", "$1,500&ndash;$4,500", "Professional spray finish"),
            ("Deck staining/painting", "$2&ndash;$6", "$500&ndash;$2,500", "300&ndash;500 sq ft typical deck"),
        ],
        "deep_dives": [
            ("Interior painting cost", [
                "Interior painting averages <strong>$3&ndash;$8 per square foot</strong> of floor area for full coverage (walls, ceilings, trim, doors). For an average 1,500 sq ft home, that's $4,500&ndash;$12,000 total. Walls-only painting (no ceilings or trim) cuts cost roughly in half.",
                "Per-room: a standard 12x12 bedroom runs $400&ndash;$1,000 painted top-to-bottom. Bathrooms: $300&ndash;$700. Kitchens (without cabinets): $500&ndash;$1,500. Living rooms/great rooms: $600&ndash;$1,800."
            ]),
            ("Exterior painting cost", [
                "Exterior house painting runs <strong>$3&ndash;$8 per square foot</strong> of siding area for a quality 2-coat job. A typical 1,500 sq ft single-story home runs $4,500&ndash;$12,000. Two-story homes cost 30&ndash;50% more due to ladder/scaffold work.",
                "Wood and stucco surfaces require more prep (sanding, caulking, primer) than vinyl or fiber cement. Expect $1&ndash;$3/sq ft additional for heavy prep on a peeling or weather-damaged exterior."
            ]),
            ("Cabinet painting cost (kitchen refresh)", [
                "Painting kitchen cabinets professionally costs <strong>$1,500&ndash;$4,500</strong> for a typical 10x10 kitchen (about 30 cabinet doors and 10 drawer fronts). This is the highest-ROI kitchen update under $5,000 &mdash; 70&ndash;90% of buyers respond positively to fresh-painted cabinets.",
                "DIY cabinet painting saves $1,000+ but takes 30&ndash;60 hours and requires careful prep (degreasing, sanding, primer, 2&ndash;3 finish coats). Brushed finish vs sprayed finish makes a noticeable quality difference."
            ]),
        ],
        "cost_factors": [
            ("Square footage", "Bigger projects have lower per-sq-ft cost (mobilization spread). Smallest jobs (single room) often have $300&ndash;$500 minimum."),
            ("Number of coats", "Most quotes assume 2 coats. 1 coat saves ~30% but rarely covers cleanly. 3 coats add 20&ndash;30% (often required for dramatic color changes)."),
            ("Prep work needed", "Heavy scraping, sanding, caulking, or repair adds $1&ndash;$3 per sq ft. Lead paint testing/abatement on pre-1978 homes adds significant cost."),
            ("Paint quality", "Builder-grade: $25&ndash;$45/gallon. Mid-grade (Sherwin-Williams ProClassic, Benjamin Moore Regal): $50&ndash;$70/gallon. Premium (Aura, Emerald): $80&ndash;$120/gallon. Better paint covers in fewer coats and lasts longer."),
            ("Trim, doors, windows", "Add $5&ndash;$15 per linear foot of trim. Doors $75&ndash;$200 each. Windows $50&ndash;$150 per frame."),
            ("Wall texture / repair", "Patching nail holes, drywall damage, or removing wallpaper adds $0.50&ndash;$3/sq ft."),
        ],
        "city_slugs": ["new-york-ny","los-angeles-ca","chicago-il","houston-tx","phoenix-az","philadelphia-pa","san-antonio-tx","dallas-tx","austin-tx","jacksonville-fl","columbus-oh","charlotte-nc","indianapolis-in","seattle-wa","denver-co","atlanta-ga","miami-fl","tampa-fl","nashville-tn","portland-or","minneapolis-mn","sacramento-ca","raleigh-nc","kansas-city-mo"],
        "faqs": [
            ("How much does it cost to paint a house interior?", "Full interior painting (walls, ceilings, trim) for a 1,500 sq ft home costs $4,500&ndash;$12,000. Walls-only is $1,500&ndash;$4,500. Per room: $400&ndash;$1,500 depending on size and scope."),
            ("How much does exterior house painting cost?", "Exterior painting for a typical 1,500 sq ft single-story home runs $4,500&ndash;$12,000 for a 2-coat job. Two-story homes add 30&ndash;50% due to ladder/scaffold work. Heavy prep (peeling, weathered surfaces) adds $1&ndash;$3/sq ft."),
            ("How much paint do I need?", "1 gallon covers ~350&ndash;400 sq ft per coat on smooth surfaces, ~300 sq ft on textured surfaces. For a 12x12 room, you'll need 1&ndash;1.5 gallons for 2 coats of walls only. Always buy 10% extra for touch-ups."),
            ("Should I paint cabinets or replace them?", "Painting kitchen cabinets ($1,500&ndash;$4,500) refreshes the look at 10&ndash;20% the cost of replacement ($8,000&ndash;$25,000). Painting works well if cabinet boxes are still solid. Replace if cabinet boxes are damaged, swollen, or particle board."),
            ("How long does interior painting take?", "A single room: 1&ndash;2 days for a 2-person crew. Whole-house interior: 4&ndash;10 days. Crews typically paint while you live in the home, prepping and finishing 1&ndash;2 rooms per day."),
        ],
    },
    "plumbing": {
        "page": "plumbing-estimate.html",
        "label": "Plumbing",
        "table_title": "Plumbing cost by service (2026)",
        "table_intro": "National average ranges. Most plumbers charge $75&ndash;$200 per hour plus parts; emergency calls add 50&ndash;100% premium.",
        "table_cols": ["Service", "Typical cost", "Notes", "Time"],
        "table_rows": [
            ("Service call (diagnostic)", "$75&ndash;$200", "Often credited toward repair", "30&ndash;60 min"),
            ("Leak repair (under sink)", "$150&ndash;$500", "Visible pipe, easy access", "1&ndash;2 hrs"),
            ("Leak repair (in-wall)", "$500&ndash;$2,500", "Drywall opening + repair adds cost", "4&ndash;8 hrs"),
            ("Drain cleaning (basic)", "$150&ndash;$400", "Snake or auger", "1&ndash;2 hrs"),
            ("Hydro-jetting", "$350&ndash;$800", "Heavy clogs, root removal", "2&ndash;3 hrs"),
            ("Toilet replacement", "$300&ndash;$800", "Mid-grade toilet, flange ok", "1&ndash;3 hrs"),
            ("Faucet replacement", "$150&ndash;$400", "Per fixture, not including faucet", "1&ndash;2 hrs"),
            ("Water heater (gas/electric)", "$1,200&ndash;$2,800", "40&ndash;50 gal tank, standard install", "3&ndash;5 hrs"),
            ("Water heater (tankless)", "$2,500&ndash;$5,500", "Gas line + venting often needed", "4&ndash;8 hrs"),
            ("Repipe (whole house)", "$4,000&ndash;$15,000", "PEX or copper, depends on size", "3&ndash;7 days"),
            ("Sewer line replacement", "$3,000&ndash;$25,000", "Trenched or trenchless", "2&ndash;5 days"),
        ],
        "deep_dives": [
            ("Cost of a plumber per hour", [
                "Most US plumbers charge <strong>$75&ndash;$200 per hour</strong> for service calls, with master plumbers and metro markets at the higher end. Many companies charge a flat-rate minimum service call ($75&ndash;$200) that often credits toward the repair.",
                "Emergency / after-hours calls (nights, weekends, holidays) add 50&ndash;100% premium. Many plumbers offer trip charge waivers for repeat customers or annual maintenance plans."
            ]),
            ("Water heater replacement cost", [
                "A standard 40&ndash;50 gallon gas or electric water heater installed runs <strong>$1,200&ndash;$2,800</strong>. Tankless water heaters cost more upfront ($2,500&ndash;$5,500) but last 20+ years (vs 10&ndash;12 for tank), use less energy, and provide unlimited hot water.",
                "Heat pump water heaters ($2,500&ndash;$4,500 installed) cut electric heating bills 50&ndash;70% and qualify for the federal Energy Efficient Home Improvement Credit (up to $2,000 back)."
            ]),
            ("Sewer line replacement cost", [
                "Sewer line replacement is one of the most expensive plumbing jobs at <strong>$3,000&ndash;$25,000</strong>. Traditional trenched replacement (digging up the lawn) runs $50&ndash;$200 per linear foot. Trenchless methods (pipe bursting or lining) cost $80&ndash;$250 per foot but avoid landscape destruction.",
                "Most insurance policies don't cover sewer line replacement unless you've added a sewer line endorsement. Average homeowner insurance with sewer line rider costs $40&ndash;$100/year extra."
            ]),
        ],
        "cost_factors": [
            ("Job complexity", "Visible pipe leaks: cheap. Behind-wall pipes, slab leaks, or pipe in finished ceiling: expensive (drywall + repaint costs)."),
            ("Plumber rate", "Master plumbers $150&ndash;$200/hr. Journeymen $75&ndash;$130/hr. Apprentices $50&ndash;$80/hr (always supervised by master)."),
            ("Parts vs labor", "Most jobs are 60&ndash;70% labor, 20&ndash;30% parts. Specialty fixtures (luxury faucets, premium toilets) shift ratio toward parts."),
            ("Permit requirements", "Required for: water heater replacement, sewer/water main work, rough-in plumbing, gas line work. Permits run $50&ndash;$300."),
            ("Emergency calls", "After-hours, weekends, holidays: 50&ndash;100% premium. Always ask if the issue can wait until business hours."),
            ("Access difficulty", "Crawlspace, attic, behind-cabinet plumbing all add labor time. Easy under-sink work is cheapest."),
        ],
        "city_slugs": ["new-york-ny","los-angeles-ca","chicago-il","houston-tx","phoenix-az","philadelphia-pa","san-antonio-tx","san-diego-ca","dallas-tx","austin-tx","jacksonville-fl","columbus-oh","charlotte-nc","indianapolis-in","seattle-wa","denver-co","atlanta-ga","miami-fl","nashville-tn","portland-or","memphis-tn","baltimore-md","milwaukee-wi","albuquerque-nm"],
        "faqs": [
            ("How much does a plumber charge per hour?", "Most US plumbers charge $75&ndash;$200 per hour. Master plumbers and metro markets are at the higher end. Many companies charge a flat-rate minimum service call ($75&ndash;$200) that credits toward the repair. After-hours/emergency calls add 50&ndash;100%."),
            ("How much does it cost to replace a water heater?", "Standard 40&ndash;50 gallon tank water heater (gas or electric) installed: $1,200&ndash;$2,800. Tankless: $2,500&ndash;$5,500 (lasts 2x longer). Heat pump water heater: $2,500&ndash;$4,500 with up to $2,000 federal tax credit."),
            ("How much does it cost to fix a leak?", "Under-sink visible leak: $150&ndash;$500. Behind-wall leak: $500&ndash;$2,500 (includes drywall opening + repair). Slab leak: $1,000&ndash;$4,000. Pipe burst from freezing: often covered by insurance after deductible."),
            ("How much does sewer line replacement cost?", "Trenched replacement: $50&ndash;$200 per linear foot ($3,000&ndash;$15,000 typical). Trenchless (pipe bursting/lining): $80&ndash;$250 per foot ($5,000&ndash;$25,000) but no landscape damage. Most homeowner policies don't cover unless you have a sewer line endorsement."),
            ("Should I get a tankless water heater?", "Tankless water heaters cost 1.5&ndash;2x more upfront but last 20+ years (vs 10&ndash;12 for tank), provide unlimited hot water, and use 20&ndash;30% less energy. Best ROI for households of 3+ people in cold/moderate climates. Smaller households often don't break even."),
        ],
    },
    "electrical": {
        "page": "electrical-estimate.html",
        "label": "Electrical",
        "table_title": "Electrical work cost by service (2026)",
        "table_intro": "National average ranges. Electricians charge $50&ndash;$130 per hour plus parts. Permits and inspection required for most service work.",
        "table_cols": ["Service", "Typical cost", "Notes", "Time"],
        "table_rows": [
            ("Service call (diagnostic)", "$75&ndash;$200", "Often credited toward repair", "30&ndash;60 min"),
            ("Outlet installation", "$120&ndash;$300", "Per outlet, includes basic wiring", "1&ndash;2 hrs"),
            ("Light fixture install", "$100&ndash;$400", "Per fixture, more for chandeliers", "1&ndash;3 hrs"),
            ("Ceiling fan install", "$200&ndash;$500", "Per fan, includes box if needed", "2&ndash;4 hrs"),
            ("EV charger (Level 2) install", "$800&ndash;$2,500", "240V outlet + dedicated circuit", "3&ndash;6 hrs"),
            ("Panel upgrade (100&rarr;200A)", "$1,800&ndash;$4,500", "Most common upgrade", "6&ndash;10 hrs"),
            ("Panel upgrade (200&rarr;400A)", "$3,500&ndash;$8,000", "Required for large homes/heavy load", "1&ndash;2 days"),
            ("Sub-panel install", "$1,000&ndash;$3,000", "For garages, additions, workshops", "4&ndash;8 hrs"),
            ("Whole-home rewire", "$8,000&ndash;$30,000", "Old/dangerous wiring replacement", "1&ndash;3 weeks"),
            ("Generator install (standby)", "$5,000&ndash;$15,000", "Includes transfer switch + gas line", "1&ndash;3 days"),
        ],
        "deep_dives": [
            ("Electrical panel upgrade cost", [
                "Upgrading from a 100A to 200A electrical panel is the most common service upgrade and runs <strong>$1,800&ndash;$4,500</strong> installed. Required if you're adding: EV charger, electric range/dryer, large HVAC, hot tub, workshop, or whole-home solar.",
                "Old fuse-box panels (typically pre-1965) almost always need replacement during home renovations. Knob-and-tube wiring or aluminum branch wiring may also require replacement, adding $5,000&ndash;$25,000 to whole-home rewiring jobs."
            ]),
            ("EV charger installation cost", [
                "Installing a Level 2 EV charger (240V outlet + dedicated 40&ndash;60 amp circuit) runs <strong>$800&ndash;$2,500</strong>. Cost varies based on distance from electrical panel, garage vs outdoor install, and whether your panel needs upgrading.",
                "Many states/utilities offer rebates of $300&ndash;$2,000 toward EV charger installation. Federal tax credit covers 30% of installation cost up to $1,000 (residential)."
            ]),
            ("Electrician hourly rates", [
                "Electricians charge <strong>$50&ndash;$130 per hour</strong> nationally, with master electricians and metro markets at the higher end. Many companies have flat-rate service call minimums ($100&ndash;$200) that credit toward the repair.",
                "Emergency/after-hours calls add 50&ndash;100% premium. For larger projects (panel upgrade, rewire), contractors typically bid the project rather than charge hourly."
            ]),
        ],
        "cost_factors": [
            ("Permits + inspection", "Required for: panel upgrades, new circuits, EV chargers, generator installs, any wiring inside walls. Permit costs $50&ndash;$400 + inspection fee."),
            ("Panel capacity", "Many older homes have 60A or 100A panels insufficient for modern loads. Upgrading to 200A typically required for major additions."),
            ("Wiring distance + access", "Long runs from panel to fixture, finished walls/ceilings, and basement/attic access all impact labor cost."),
            ("Aluminum / knob-and-tube", "Houses built 1965&ndash;1972 often have aluminum branch wiring (fire risk). Pre-1950: knob-and-tube. Both usually need replacement."),
            ("Code compliance updates", "Old work often requires bringing nearby outlets to current code (GFCI in wet areas, AFCI in living areas). Adds $50&ndash;$150 per outlet."),
            ("Generator backup", "Whole-home standby generator: $5,000&ndash;$15,000 installed. Portable generator (manual switch): $1,500&ndash;$4,500. Always include automatic transfer switch."),
        ],
        "city_slugs": ["new-york-ny","los-angeles-ca","chicago-il","houston-tx","phoenix-az","philadelphia-pa","san-antonio-tx","dallas-tx","austin-tx","jacksonville-fl","columbus-oh","charlotte-nc","indianapolis-in","seattle-wa","denver-co","atlanta-ga","miami-fl","nashville-tn","portland-or","minneapolis-mn","sacramento-ca","saint-louis-mo","cincinnati-oh","baltimore-md"],
        "faqs": [
            ("How much does an electrician charge per hour?", "US electricians charge $50&ndash;$130 per hour. Master electricians and metro markets are at the higher end. Many companies have flat-rate service minimums ($100&ndash;$200) that credit toward the repair. After-hours: add 50&ndash;100%."),
            ("How much does an electrical panel upgrade cost?", "100A to 200A panel upgrade: $1,800&ndash;$4,500 installed. 200A to 400A: $3,500&ndash;$8,000. Required if adding EV charger, electric range/dryer, large HVAC, or solar."),
            ("How much does it cost to install an EV charger?", "Level 2 EV charger installation: $800&ndash;$2,500. Cost depends on distance from panel and whether panel needs upgrading. Federal tax credit covers 30% up to $1,000."),
            ("Do I need a permit for electrical work?", "Yes, for: panel work, new circuits, EV chargers, generators, any wiring inside walls. No permit needed for: replacing same-type outlets/switches/fixtures. Permits cost $50&ndash;$400 + inspection."),
            ("How much does whole-home rewiring cost?", "Whole-home rewiring runs $8,000&ndash;$30,000 depending on home size and wiring type. Most expensive when finished walls require opening + drywall repair. Aluminum branch wiring or knob-and-tube replacement is common in pre-1972 homes."),
        ],
    },
    "siding": {
        "page": "siding-estimate.html",
        "label": "Siding",
        "table_title": "Siding cost by material (2026)",
        "table_intro": "National average ranges, fully installed including underlayment, trim, and tear-off of existing siding.",
        "table_cols": ["Material", "Cost per sq ft", "Lifespan", "Best for"],
        "table_rows": [
            ("Vinyl (standard)", "$3&ndash;$8", "20&ndash;40 yrs", "Lowest upfront, most popular"),
            ("Vinyl (insulated)", "$4&ndash;$12", "30&ndash;40 yrs", "Energy-efficient upgrade"),
            ("Engineered wood (LP SmartSide)", "$5&ndash;$10", "25&ndash;30 yrs", "Wood look, less maintenance"),
            ("Fiber cement (HardiePlank)", "$6&ndash;$13", "30&ndash;50 yrs", "Most popular premium choice"),
            ("Wood (cedar/redwood)", "$7&ndash;$15", "20&ndash;40 yrs", "Premium aesthetic, requires maintenance"),
            ("Stucco (traditional)", "$6&ndash;$12", "50+ yrs", "Hot/dry climates, very low maintenance"),
            ("Brick veneer", "$10&ndash;$25", "100+ yrs", "Premium look, very long-lived"),
            ("Stone veneer", "$15&ndash;$30", "100+ yrs", "Accent walls, premium aesthetic"),
            ("Metal (steel/aluminum)", "$5&ndash;$12", "40&ndash;60 yrs", "Modern look, fire-resistant"),
        ],
        "deep_dives": [
            ("Cost of vinyl siding", [
                "Vinyl is on roughly 30% of US homes for good reason: cheapest material, fast install, low maintenance. Standard vinyl runs <strong>$3&ndash;$8 per square foot</strong> installed. For a 2,000 sq ft home with 1,800 sq ft of siding area, expect <strong>$5,400&ndash;$14,400</strong> total.",
                "Insulated vinyl (foam-backed) costs 30&ndash;50% more but adds R-2 to R-3 of insulation and looks more substantial. Worth the upgrade in cold climates or homes with thin existing wall insulation."
            ]),
            ("Cost of fiber cement (Hardie) siding", [
                "Fiber cement (HardiePlank, James Hardie) costs <strong>$6&ndash;$13 per square foot</strong> installed &mdash; about 50&ndash;100% more than vinyl but lasts 30&ndash;50 years vs 20&ndash;40 for vinyl. Hardie is fire-resistant, doesn't fade like vinyl, and looks like real wood without rot/insect issues.",
                "ColorPlus pre-finished Hardie costs more but eliminates the need for paint touch-ups (wood-look paint lasts 10&ndash;15 years on Hardie vs 5&ndash;7 on traditional siding)."
            ]),
            ("Cost of stucco siding", [
                "Traditional 3-coat stucco runs <strong>$6&ndash;$12 per square foot</strong>. Stucco is very long-lived (50+ years with proper drainage) but cracking is common in temperature swings. Very popular in Southwest US (AZ, NM, TX, CA) where dry climate prevents moisture issues.",
                "EIFS (synthetic stucco) is cheaper at $5&ndash;$9/sq ft but has had moisture intrusion issues in humid climates &mdash; verify proper drainage system before signing."
            ]),
        ],
        "cost_factors": [
            ("Square footage", "Average 2,000 sq ft home has 1,500&ndash;2,000 sq ft of siding area. Multiply per-sq-ft cost by total exterior area."),
            ("Number of stories", "Two-story adds 15&ndash;25% labor (scaffolding/ladders). Three-story adds 30&ndash;50%."),
            ("Tear-off of existing", "$1&ndash;$3 per sq ft to remove old siding. Asbestos siding (pre-1980) requires special handling: $5&ndash;$10/sq ft."),
            ("Sheathing repair", "Rotten OSB/plywood under old siding runs $2&ndash;$5/sq ft to replace. Budget 5&ndash;15% of project for surprises."),
            ("Trim + accents", "Window/door trim, corner boards, soffit + fascia all add cost. Cedar/Hardie trim: $5&ndash;$15 per linear foot."),
            ("Permits + inspection", "$200&ndash;$1,000 in most cities. Some cities require contractors to be specifically licensed for fiber cement or stucco."),
        ],
        "city_slugs": ["new-york-ny","chicago-il","houston-tx","philadelphia-pa","columbus-oh","indianapolis-in","seattle-wa","denver-co","atlanta-ga","charlotte-nc","nashville-tn","minneapolis-mn","detroit-mi","cleveland-oh","cincinnati-oh","milwaukee-wi","kansas-city-mo","saint-louis-mo","portland-or","baltimore-md","boston-ma","raleigh-nc","memphis-tn","louisville-ky"],
        "faqs": [
            ("How much does siding installation cost?", "For a 2,000 sq ft home with 1,800 sq ft of siding area: vinyl $5,400&ndash;$14,400, fiber cement $10,800&ndash;$23,400, wood $12,600&ndash;$27,000. Tear-off, repair, and trim work add to base material + labor."),
            ("Is fiber cement siding worth the extra cost?", "Yes for most homes &mdash; fiber cement (HardiePlank) costs 50&ndash;100% more than vinyl upfront but lasts 30&ndash;50 years vs 20&ndash;40 for vinyl. Better fire resistance, less fading, looks more substantial. Best ROI for homes in storm-prone areas."),
            ("How long does new siding last?", "Vinyl: 20&ndash;40 years. Fiber cement: 30&ndash;50 years. Wood: 20&ndash;40 with regular staining. Stucco: 50+ years. Brick/stone veneer: 100+ years. Metal: 40&ndash;60 years."),
            ("Should I install siding myself?", "DIY vinyl siding is possible but tricky &mdash; requires scaffolding, careful measurement, and weather-tight installation around windows/doors. Save 30&ndash;50% on labor but expect 40+ hours and quality risks. Fiber cement and stucco are professional-only."),
            ("Do I need a permit for new siding?", "Most cities require a permit for full siding replacement. Repairs to less than ~25% of total siding usually don't need permits. Permits cost $200&ndash;$1,000."),
        ],
    },
    "window": {
        "page": "window-estimate.html",
        "label": "Window replacement",
        "table_title": "Window replacement cost by type (2026)",
        "table_intro": "National average ranges per window, installed including labor and standard trim. Whole-house projects (8&ndash;15 windows) typically run $4,000&ndash;$15,000.",
        "table_cols": ["Type", "Cost per window", "Energy efficiency", "Best for"],
        "table_rows": [
            ("Vinyl (standard)", "$300&ndash;$700", "Good", "Most popular, best value"),
            ("Vinyl (premium)", "$500&ndash;$1,200", "Excellent", "Triple-pane, foam-filled, energy-efficient"),
            ("Fiberglass", "$500&ndash;$1,500", "Excellent", "Strongest material, paintable"),
            ("Wood-clad (Andersen, Pella)", "$700&ndash;$2,000", "Excellent", "Premium aesthetic, traditional homes"),
            ("Aluminum", "$400&ndash;$1,000", "Fair", "Modern look, hot climates"),
            ("Composite", "$500&ndash;$1,200", "Excellent", "Wood look without maintenance"),
            ("Storm windows (over existing)", "$150&ndash;$450", "Adds R-1 to R-2", "Cheaper alternative to full replacement"),
            ("Bay/bow windows", "$1,200&ndash;$4,500", "Good", "Custom shape, high impact"),
            ("Skylights", "$800&ndash;$3,500", "Varies", "Per skylight, install includes flashing"),
        ],
        "deep_dives": [
            ("Cost to replace all windows in a house", [
                "For a typical home with 10 standard windows, full replacement runs <strong>$4,500&ndash;$12,000</strong> with mid-grade vinyl. Premium windows (Andersen, Pella, Marvin wood-clad) run $9,000&ndash;$20,000+ for the same 10 windows.",
                "Per-window pricing drops with quantity: bulk orders of 10+ windows typically save 10&ndash;20% per unit vs replacing 1&ndash;2 at a time."
            ]),
            ("Vinyl vs fiberglass vs wood windows", [
                "Vinyl windows ($300&ndash;$1,200) are the most popular choice &mdash; cheapest, low-maintenance, energy-efficient. Limitations: can't be painted, may sag in extreme heat, lifespan 20&ndash;40 years.",
                "Fiberglass windows ($500&ndash;$1,500) cost 30&ndash;100% more than vinyl but are stronger, can be painted, and last 50+ years. Best for tropical climates where vinyl warps.",
                "Wood-clad windows ($700&ndash;$2,000) are premium &mdash; best aesthetic, paintable inside, durable cladding outside. Required by some HOAs and historic districts."
            ]),
            ("Energy-efficient windows + tax credits", [
                "ENERGY STAR-certified windows qualify for the federal Energy Efficient Home Improvement Credit: 30% back, up to $600/year on windows. Many utilities add $50&ndash;$300 per window in additional rebates.",
                "Triple-pane windows cost 30&ndash;50% more than dual-pane but improve insulation 25&ndash;40% &mdash; payback in 7&ndash;15 years through energy savings in cold climates."
            ]),
        ],
        "cost_factors": [
            ("Number of windows", "Per-window cost drops with quantity. 10+ window orders save 10&ndash;20%. Single-window emergency replacements cost the most per unit."),
            ("Window size", "Standard sizes (24x36, 36x48) cost less than custom or oversized. Bay/bow windows cost 3&ndash;5x standard."),
            ("Frame material", "Vinyl cheapest, fiberglass mid, wood-clad most expensive. Lifecycle cost similar &mdash; vinyl wins on simplicity."),
            ("Glass package", "Dual-pane with low-E coating standard. Triple-pane adds 30&ndash;50% but improves R-value 25&ndash;40%. Argon/krypton gas fill standard on quality windows."),
            ("Install method", "Insert windows (replacing old in same opening) cheapest. Full-frame replacement (removing trim) costs more but allows checking for water damage."),
            ("Trim work", "Interior trim/casing replacement adds $50&ndash;$200 per window. Stucco/brick exterior trim adds more."),
        ],
        "city_slugs": ["new-york-ny","los-angeles-ca","chicago-il","houston-tx","phoenix-az","philadelphia-pa","san-antonio-tx","dallas-tx","austin-tx","columbus-oh","charlotte-nc","indianapolis-in","seattle-wa","denver-co","atlanta-ga","miami-fl","tampa-fl","nashville-tn","portland-or","minneapolis-mn","sacramento-ca","saint-louis-mo","cincinnati-oh","milwaukee-wi"],
        "faqs": [
            ("How much does it cost to replace windows in a house?", "For a typical 10-window home: $4,500&ndash;$12,000 with mid-grade vinyl. Premium wood-clad: $9,000&ndash;$20,000+. Single window replacement: $300&ndash;$2,000 each depending on type."),
            ("Are vinyl windows good?", "Yes for most homes &mdash; vinyl is the most popular choice (cheapest, low-maintenance, energy-efficient). Limitations: can't be painted, may sag in extreme heat. Quality vinyl from Andersen, Pella, Milgard lasts 30+ years."),
            ("Are triple-pane windows worth it?", "In cold climates (Zone 5+): yes, payback in 7&ndash;15 years through heating savings. In moderate climates: marginal benefit, not worth 30&ndash;50% premium. Always check current ENERGY STAR certification."),
            ("Are there tax credits for new windows?", "Yes &mdash; the federal Energy Efficient Home Improvement Credit gives 30% back, up to $600/year on ENERGY STAR-certified windows. Many utilities add $50&ndash;$300 per window in additional rebates."),
            ("How long does window replacement take?", "1&ndash;2 windows: a few hours. 5&ndash;10 windows: 1&ndash;2 days for a 2-person crew. 15+ windows: 3&ndash;5 days. Crews typically replace 6&ndash;10 windows per day."),
        ],
    },
    "foundation": {
        "page": "foundation-estimate.html",
        "label": "Foundation repair",
        "table_title": "Foundation repair cost by issue (2026)",
        "table_intro": "National average ranges. Foundation issues vary enormously by severity &mdash; always get a structural engineer evaluation ($300&ndash;$1,000) before scheduling repairs.",
        "table_cols": ["Repair type", "Typical cost", "When needed", "Time"],
        "table_rows": [
            ("Crack repair (cosmetic)", "$300&ndash;$800", "Hairline cracks, no movement", "1 day"),
            ("Crack injection (epoxy)", "$500&ndash;$1,500", "Active leaks, larger cracks", "1&ndash;2 days"),
            ("Carbon fiber wall reinforcement", "$3,000&ndash;$8,000", "Bowing/leaning walls, no major shift", "2&ndash;4 days"),
            ("Steel I-beam wall reinforcement", "$3,500&ndash;$10,000", "Significant bowing or moderate shift", "3&ndash;5 days"),
            ("Underpinning (push piers)", "$8,000&ndash;$25,000", "Settled foundation, vertical movement", "5&ndash;14 days"),
            ("Helical piers", "$10,000&ndash;$25,000", "Settled foundation, weaker soils", "5&ndash;14 days"),
            ("Slab jacking / mudjacking", "$1,000&ndash;$3,500", "Sunken concrete slab", "1&ndash;3 days"),
            ("Foam jacking / polyurethane", "$1,500&ndash;$5,000", "Sunken slab, faster than mudjacking", "1 day"),
            ("Waterproofing (interior)", "$2,000&ndash;$8,000", "Wet basement walls", "2&ndash;5 days"),
            ("Waterproofing (exterior)", "$5,000&ndash;$15,000", "Severe water issues, full perimeter", "5&ndash;10 days"),
            ("French drain install", "$2,500&ndash;$7,500", "Persistent yard/foundation drainage", "3&ndash;5 days"),
        ],
        "deep_dives": [
            ("Foundation crack repair cost", [
                "Hairline cracks (under 1/8&Prime;) often only need cosmetic patching: <strong>$300&ndash;$800</strong> per crack. These are usually settling cracks that don't indicate structural issues.",
                "Larger cracks or active leaks need epoxy or polyurethane injection: <strong>$500&ndash;$1,500</strong> per crack. If multiple cracks or signs of foundation movement (doors not closing, sloping floors), get a structural engineer assessment first ($300&ndash;$1,000)."
            ]),
            ("Foundation underpinning cost", [
                "Settled foundations (vertical drop, sticking doors, cracked drywall in regular patterns) often need underpinning with push piers or helical piers: <strong>$8,000&ndash;$25,000</strong> total. Per pier cost: $1,000&ndash;$3,000. Most projects need 5&ndash;15 piers depending on home size.",
                "Helical piers ($1,500&ndash;$3,000 each) work better in weak/sandy soils. Push piers ($1,000&ndash;$2,500 each) work better in stiff clay soils."
            ]),
            ("Basement waterproofing cost", [
                "Interior waterproofing (sump pump + interior drain tile + sealant) runs <strong>$2,000&ndash;$8,000</strong>. Cheaper but addresses water already in foundation rather than preventing it from getting in.",
                "Exterior waterproofing (excavating around foundation + membrane + drain tile) runs <strong>$5,000&ndash;$15,000</strong> &mdash; the most thorough fix but requires destroying landscaping. Best done preemptively during foundation install."
            ]),
        ],
        "cost_factors": [
            ("Severity of issue", "Cosmetic cracks: cheap. Active settling, bowing walls, or major shifts: expensive (often $10K+). Always get structural engineer assessment first ($300&ndash;$1,000)."),
            ("Foundation type", "Crawlspace foundations: easier access, cheaper repairs. Basement: medium. Slab-on-grade: hardest to repair (need to break concrete)."),
            ("Soil conditions", "Expansive clay (heaves with moisture) is hardest. Sandy soils need helical piers. Limestone/bedrock easier to underpin."),
            ("Number of piers / sections", "Most underpinning jobs need 5&ndash;15 piers. Each pier $1,000&ndash;$3,000. Engineer determines number based on weight + soil load."),
            ("Permits + engineering", "Engineer assessment $300&ndash;$1,000. Structural permits $400&ndash;$1,500. Required for all underpinning + most wall reinforcement."),
            ("Drainage solutions", "Often paired with foundation work. French drain $2,500&ndash;$7,500. Sump pump $800&ndash;$2,500. Yard regrading $500&ndash;$3,000."),
        ],
        "city_slugs": ["new-york-ny","chicago-il","houston-tx","dallas-tx","atlanta-ga","columbus-oh","indianapolis-in","cincinnati-oh","saint-louis-mo","kansas-city-mo","memphis-tn","nashville-tn","charlotte-nc","raleigh-nc","jacksonville-fl","tampa-fl","oklahoma-city-ok","minneapolis-mn","milwaukee-wi","detroit-mi","cleveland-oh","baltimore-md","louisville-ky","birmingham-al"],
        "faqs": [
            ("How much does foundation repair cost?", "Cosmetic crack repair: $300&ndash;$1,500. Carbon fiber wall reinforcement: $3,000&ndash;$8,000. Underpinning (settling foundation): $8,000&ndash;$25,000. Always get a structural engineer assessment first ($300&ndash;$1,000) to avoid unnecessary work."),
            ("How do I know if my foundation needs repair?", "Warning signs: doors that don't close, cracks wider than 1/4&Prime;, sloping floors, gaps between walls and ceiling, water in basement, brick stair-step cracks. Get a structural engineer evaluation if you see 2+ of these."),
            ("Will insurance cover foundation repair?", "Usually no &mdash; standard homeowners insurance excludes settling/cracking foundations. Exceptions: damage from a covered event (sudden plumbing leak, vehicle impact, earthquake with rider). Always read your policy."),
            ("How long do foundation repairs last?", "Quality underpinning is permanent (50+ years). Wall reinforcement (carbon fiber, steel I-beams) is permanent. Crack injection lasts 5&ndash;15 years before re-treating may be needed. Quality contractors offer 25-year+ warranties."),
            ("Is mudjacking the same as foam jacking?", "Both raise sunken concrete slabs, but use different fillers. Mudjacking ($1,000&ndash;$3,500) uses cement slurry &mdash; cheaper, heavier, larger drill holes. Foam jacking ($1,500&ndash;$5,000) uses polyurethane foam &mdash; faster cure, smaller holes, won't add weight to the soil."),
        ],
    },
    "garage-door": {
        "page": "garage-door-estimate.html",
        "label": "Garage door",
        "table_title": "Garage door cost by type (2026)",
        "table_intro": "National average ranges, fully installed including hardware and standard opener.",
        "table_cols": ["Type", "Cost installed", "Lifespan", "Best for"],
        "table_rows": [
            ("Steel (single-layer)", "$700&ndash;$1,500", "15&ndash;25 yrs", "Lowest cost, basic functionality"),
            ("Steel (insulated)", "$900&ndash;$2,500", "20&ndash;30 yrs", "Most popular, energy-efficient"),
            ("Aluminum + glass", "$1,500&ndash;$3,500", "20&ndash;30 yrs", "Modern look, contemporary homes"),
            ("Wood (composite)", "$1,500&ndash;$4,000", "20&ndash;30 yrs", "Wood look without maintenance"),
            ("Wood (real)", "$2,500&ndash;$8,000", "15&ndash;30 yrs", "Custom premium look"),
            ("Carriage house style", "$2,000&ndash;$6,000", "20&ndash;30 yrs", "Traditional aesthetic"),
            ("Custom/oversized", "$5,000&ndash;$15,000+", "Varies", "RV doors, multi-car wide"),
            ("Garage door opener (basic)", "$300&ndash;$600", "10&ndash;15 yrs", "Standard chain-drive"),
            ("Garage door opener (smart, belt)", "$500&ndash;$1,200", "15&ndash;20 yrs", "Quiet, app-controlled"),
        ],
        "deep_dives": [
            ("Cost of single-car vs double-car garage door", [
                "A standard 9x7 single-car steel garage door installed runs <strong>$700&ndash;$1,800</strong>. A standard 16x7 double-car door installed runs <strong>$1,200&ndash;$2,800</strong>. Insulated versions of either add 30&ndash;50%.",
                "Custom widths (8x7 narrow single, 18x8 oversized double) typically cost 20&ndash;40% more than standard sizes due to special-order pricing and adjusted hardware."
            ]),
            ("Cost of garage door opener", [
                "A new garage door opener installed runs <strong>$300&ndash;$1,200</strong>. Basic chain-drive openers ($300&ndash;$600) are loudest but most reliable. Belt-drive openers ($500&ndash;$1,200) are quieter, smarter (Wi-Fi/app controls common), and longer-lived.",
                "Replacing only the opener (keeping the door) is straightforward and usually $400&ndash;$700 installed. Most opener replacements take 2&ndash;4 hours."
            ]),
            ("Garage door spring repair cost", [
                "Garage door springs are the highest-failure component. Torsion spring replacement runs <strong>$200&ndash;$500</strong> for a single spring, $300&ndash;$700 for a pair. Always replace both springs at the same time even if only one breaks &mdash; the other is usually close to failure.",
                "DIY spring replacement is dangerous &mdash; springs are under high tension and can cause serious injury. Always hire a professional."
            ]),
        ],
        "cost_factors": [
            ("Door size", "Single (8&ndash;9 ft wide): cheapest. Double (16 ft): 50&ndash;80% more. Custom sizes (RV doors, oversized doubles): 100&ndash;200% more."),
            ("Material", "Steel cheapest. Aluminum/glass mid. Wood premium. Composite wood splits the difference."),
            ("Insulation", "R-9 to R-18 insulated doors cost 30&ndash;50% more but reduce heat loss + sound through door. Worth it if garage is attached or used as workspace."),
            ("Windows / glass", "Window panels add $50&ndash;$150 per window. Full-glass aluminum doors cost 2&ndash;3x solid steel."),
            ("Hardware + tracks", "Old tracks/hardware may need replacement during install. $200&ndash;$500 in additional parts."),
            ("Smart opener features", "Wi-Fi, app control, smart home integration add $100&ndash;$400 over basic openers."),
        ],
        "city_slugs": ["new-york-ny","los-angeles-ca","chicago-il","houston-tx","phoenix-az","dallas-tx","austin-tx","columbus-oh","indianapolis-in","charlotte-nc","atlanta-ga","tampa-fl","jacksonville-fl","denver-co","seattle-wa","minneapolis-mn","milwaukee-wi","kansas-city-mo","saint-louis-mo","cincinnati-oh","portland-or","detroit-mi","las-vegas-nv","sacramento-ca"],
        "faqs": [
            ("How much does a new garage door cost?", "Single-car door installed: $700&ndash;$1,800 (steel) to $2,500&ndash;$8,000 (premium wood). Double-car door: $1,200&ndash;$2,800 (steel) to $4,000&ndash;$15,000+ (custom). Insulated doors add 30&ndash;50%."),
            ("How much does a garage door opener cost?", "Basic chain-drive opener installed: $300&ndash;$600. Belt-drive (quieter, smarter): $500&ndash;$1,200. Replacement only (keeping existing door) typically $400&ndash;$700."),
            ("How much do garage door springs cost to replace?", "Single torsion spring: $200&ndash;$500. Pair: $300&ndash;$700. Always replace both springs at the same time. DIY is dangerous &mdash; high spring tension can cause serious injury."),
            ("How long does garage door installation take?", "New door + opener: 4&ndash;8 hours. Door only: 2&ndash;4 hours. Opener only: 2&ndash;4 hours. Custom or oversized doors may require additional framing work (1&ndash;2 days)."),
            ("Are insulated garage doors worth it?", "Yes if your garage is attached or you use it as workspace &mdash; insulated doors cut heat loss 50&ndash;70% vs single-layer steel. Pay back in 5&ndash;10 years through lower HVAC costs. For detached unconditioned garages, insulation is less valuable."),
        ],
    },
    "solar": {
        "page": "solar-estimate.html",
        "label": "Solar panel",
        "table_title": "Solar panel cost by system size (2026)",
        "table_intro": "National average ranges, fully installed before 30% federal tax credit. After credit, costs drop ~30%.",
        "table_cols": ["System size (kW)", "Cost before credit", "After 30% federal credit", "Best for"],
        "table_rows": [
            ("4 kW (small)", "$10,000&ndash;$16,000", "$7,000&ndash;$11,200", "Small home, partial offset"),
            ("6 kW (typical)", "$15,000&ndash;$24,000", "$10,500&ndash;$16,800", "Average US home"),
            ("8 kW (above-average)", "$20,000&ndash;$32,000", "$14,000&ndash;$22,400", "Larger home, EV charging"),
            ("10 kW (large home)", "$25,000&ndash;$40,000", "$17,500&ndash;$28,000", "Large home, full offset"),
            ("12 kW (premium)", "$30,000&ndash;$48,000", "$21,000&ndash;$33,600", "Pool, EV, electric heat"),
            ("15 kW+ (whole-home)", "$37,500&ndash;$60,000+", "$26,250&ndash;$42,000+", "Largest homes, max offset"),
            ("Solar battery (Tesla Powerwall 3)", "$10,000&ndash;$15,000", "$7,000&ndash;$10,500", "Backup power, time-of-use offset"),
            ("Battery + solar combo", "$25,000&ndash;$50,000+", "$17,500&ndash;$35,000+", "Full energy independence"),
        ],
        "deep_dives": [
            ("Cost of solar panels for a typical home", [
                "An average US home uses ~10,000 kWh of electricity per year and needs roughly a <strong>6&ndash;8 kW solar system</strong> to fully offset usage. Installed cost: <strong>$15,000&ndash;$32,000 before federal tax credit</strong>; <strong>$10,500&ndash;$22,400 after</strong>.",
                "Per-watt installed cost runs $2.50&ndash;$4.00 nationally, with regional variation of $2.00&ndash;$5.00. Larger systems benefit from economies of scale &mdash; per-watt cost drops 5&ndash;15% on systems over 10 kW."
            ]),
            ("Solar tax credits and rebates (2026)", [
                "The federal Residential Clean Energy Credit gives <strong>30% of total system cost back as a tax credit</strong> through 2032. No cap on the dollar amount &mdash; a $25,000 system gets you $7,500 back.",
                "Many states add their own credits (CA, NY, MA, NJ are most generous), and most utilities offer net metering (selling excess solar back to the grid). Some utilities offer additional rebates of $200&ndash;$3,000 per kW installed."
            ]),
            ("Solar payback period", [
                "Most US homeowners see <strong>solar payback in 7&ndash;12 years</strong> after the federal tax credit. After payback, you're producing free electricity for the remaining 15&ndash;20+ year warranty period of the panels.",
                "Highest ROI states: Hawaii (3&ndash;5 year payback), California (5&ndash;7 years), New York (6&ndash;9 years). Lowest ROI: WA, OR, KY (10&ndash;14 years) due to low electric rates and cloudier weather."
            ]),
        ],
        "cost_factors": [
            ("System size (kW)", "Sized to your annual usage. Average US home: 6&ndash;8 kW. Larger homes or EV households: 10&ndash;15 kW."),
            ("Panel quality / brand", "Tier-1 panels (Q Cells, REC, LG, SunPower) cost more but warranty 25 years vs 10&ndash;15 for budget panels. Worth the premium."),
            ("Inverter type", "String inverter cheapest. Microinverters (Enphase) add $1,500&ndash;$3,500 but maximize production from shaded/complex roofs."),
            ("Roof condition", "If your roof needs replacement in next 5&ndash;10 years, do it BEFORE solar (otherwise add $1,500&ndash;$3,000 to remove + reinstall)."),
            ("Battery storage", "Tesla Powerwall 3, Enphase IQ, Franklin Home Power: $10K&ndash;$15K each installed. Eligible for 30% federal credit."),
            ("Permits + interconnection", "Permits $200&ndash;$1,500. Utility interconnection $0&ndash;$500. Some HOAs require separate approval."),
        ],
        "city_slugs": ["los-angeles-ca","san-diego-ca","san-jose-ca","san-francisco-ca","sacramento-ca","phoenix-az","tucson-az","las-vegas-nv","houston-tx","dallas-tx","austin-tx","san-antonio-tx","jacksonville-fl","tampa-fl","miami-fl","orlando-fl","atlanta-ga","charlotte-nc","raleigh-nc","new-york-ny","boston-ma","philadelphia-pa","denver-co","seattle-wa"],
        "faqs": [
            ("How much do solar panels cost for a home?", "Average US home (6&ndash;8 kW system): $15,000&ndash;$32,000 installed before federal tax credit; $10,500&ndash;$22,400 after. Larger homes (10&ndash;12 kW) run $25,000&ndash;$48,000 before credit."),
            ("What's the federal solar tax credit?", "30% of total system cost as a tax credit through 2032. No dollar cap. A $25,000 system = $7,500 back. Applies to panels, inverters, batteries, and labor."),
            ("How long does it take solar to pay for itself?", "7&ndash;12 years for most US homes after the federal tax credit. After payback, free electricity for 15&ndash;20+ years (panel warranty period). High-rate states (CA, HI, NY) pay back fastest."),
            ("How long do solar panels last?", "Tier-1 panels (Q Cells, SunPower, REC, LG) carry 25-year power warranties &mdash; guaranteed to produce 80%+ of original output at year 25. Most actually last 30&ndash;40 years with gradual production decline."),
            ("Is a solar battery worth it?", "Yes if you have time-of-use electric rates, frequent power outages, or want energy independence. A Tesla Powerwall 3 ($10K&ndash;$15K installed) qualifies for the 30% federal credit. Payback varies enormously by state and utility rate structure."),
        ],
    },
    "moving": {
        "page": "moving-estimate.html",
        "label": "Moving",
        "table_title": "Moving cost by distance and home size (2026)",
        "table_intro": "National average ranges. Local moves (under 50 miles) are charged hourly; long-distance moves are charged by weight + distance.",
        "table_cols": ["Move type", "Studio / 1-BR", "2&ndash;3 BR home", "4+ BR home"],
        "table_rows": [
            ("Local (under 50 mi)", "$300&ndash;$900", "$700&ndash;$2,500", "$1,500&ndash;$4,500"),
            ("Same-state (50&ndash;250 mi)", "$700&ndash;$1,800", "$1,500&ndash;$4,500", "$3,000&ndash;$7,500"),
            ("Long-distance (250&ndash;1,000 mi)", "$1,500&ndash;$3,500", "$3,000&ndash;$7,000", "$5,500&ndash;$12,000"),
            ("Cross-country (1,000&ndash;2,500 mi)", "$2,500&ndash;$5,500", "$5,000&ndash;$11,000", "$8,500&ndash;$18,000"),
            ("DIY truck rental (local)", "$50&ndash;$300", "$100&ndash;$600", "$200&ndash;$900"),
            ("DIY truck rental (long-distance)", "$1,000&ndash;$2,500", "$1,500&ndash;$4,000", "$2,500&ndash;$6,000"),
            ("PODS / mobile container", "$500&ndash;$1,500", "$1,500&ndash;$5,000", "$3,000&ndash;$7,500"),
            ("Full-service (packing + moving)", "$1,200&ndash;$3,500", "$3,000&ndash;$8,500", "$6,000&ndash;$15,000+"),
        ],
        "deep_dives": [
            ("Local moving cost", [
                "Local moves (under 50 miles) are typically charged hourly: <strong>$25&ndash;$50 per mover per hour</strong>. A 2-person crew for a typical 2-bedroom apartment: $700&ndash;$2,500 total (4&ndash;8 hours of work plus drive time).",
                "Most movers have a 2&ndash;3 hour minimum. Tight access (3rd-floor walkup, narrow staircases, long carry from truck to door) adds 25&ndash;50% in time."
            ]),
            ("Long-distance moving cost", [
                "Long-distance moves are priced by <strong>weight (in pounds)</strong> times <strong>distance</strong>, plus fuel surcharges. Typical cost: $0.50&ndash;$0.80 per pound per 1,000 miles. A 7,500 lb 3-bedroom move from NY to FL (~1,200 miles) runs $4,500&ndash;$7,200.",
                "Ask for a binding estimate (price won't change unless scope changes) vs non-binding (price can rise based on actual weight at destination). Always get 3 binding quotes before committing."
            ]),
            ("Full-service vs DIY moving", [
                "Full-service movers (packing + loading + transport + unloading + unpacking): <strong>$3,000&ndash;$15,000+</strong> for a typical home. DIY truck rental + boxes + your own labor: $200&ndash;$1,500 for local, $2,500&ndash;$6,000 for cross-country.",
                "Hybrid: Pack yourself, hire movers for loading/transport. Saves 40&ndash;60% vs full-service. PODS / mobile containers split the difference &mdash; you load on your schedule, they transport."
            ]),
        ],
        "cost_factors": [
            ("Distance", "Local: hourly. Long-distance: per pound + per mile. Cross-country adds fuel surcharges."),
            ("Home size / volume", "Studio: ~3,000 lbs. 2-BR: ~5,000 lbs. 3-BR: ~7,500 lbs. 4-BR: ~10,000+ lbs. Each box ~30&ndash;40 lbs."),
            ("Time of year", "May&ndash;September is peak moving season &mdash; 20&ndash;30% more expensive. October&ndash;April is cheapest."),
            ("Day of week / month", "Weekends and end-of-month are most expensive. Weekday mid-month moves are 15&ndash;25% cheaper."),
            ("Packing services", "Full pack: $400&ndash;$2,500 extra. Partial pack (just kitchen, fragile): $200&ndash;$800. DIY packing saves the most."),
            ("Insurance / valuation", "Basic coverage (60 cents/lb) is free but minimal. Full-value protection: 1&ndash;3% of declared value of contents."),
        ],
        "city_slugs": ["new-york-ny","los-angeles-ca","chicago-il","houston-tx","phoenix-az","philadelphia-pa","san-antonio-tx","san-diego-ca","dallas-tx","austin-tx","jacksonville-fl","columbus-oh","charlotte-nc","seattle-wa","denver-co","atlanta-ga","miami-fl","tampa-fl","boston-ma","portland-or","nashville-tn","minneapolis-mn","san-francisco-ca","washington-dc"],
        "faqs": [
            ("How much do movers cost?", "Local move (under 50 miles): $700&ndash;$2,500 for 2-bedroom. Long-distance: $3,000&ndash;$7,000 for 2-3 BR. Cross-country: $5,000&ndash;$12,000. DIY truck rental cuts cost 50&ndash;70%."),
            ("How much does it cost to move a 3-bedroom house?", "Local: $1,500&ndash;$4,500. Same-state: $3,000&ndash;$7,500. Long-distance: $5,000&ndash;$11,000. Cross-country: $8,500&ndash;$18,000. Add $1,000&ndash;$3,000 for full packing service."),
            ("What's the cheapest way to move?", "DIY truck rental (U-Haul, Penske, Budget): $50&ndash;$300 local, $1,000&ndash;$2,500 long-distance. Save more by recruiting friends with pizza/beer. PODS/mobile containers cost more but eliminate the driving."),
            ("Should I hire packers?", "Yes if: you have less than a week, fragile/valuable items, or a long-distance move. No if: you're DIY-comfortable and have 2&ndash;3 weeks of evenings to pack. Packers save 20&ndash;40 hours but cost $400&ndash;$2,500."),
            ("When is the cheapest time to move?", "October&ndash;April is 20&ndash;30% cheaper than May&ndash;September peak season. Mid-month weekdays are cheapest within the month. Avoid end-of-month and weekends &mdash; demand is 50&ndash;100% higher."),
        ],
    },
}


def build_section(v):
    """Generate the full SEO HTML block for a vertical."""
    label = v["label"]

    # Comparison table
    cols_html = "".join(f'<th style="padding:14px 16px; text-align:left; font-size:14px;">{c}</th>' for c in v["table_cols"])
    rows_html = ""
    for i, row in enumerate(v["table_rows"]):
        bg = "background:#f8fafc;" if i % 2 == 1 else ""
        cells = "".join(f'<td style="padding:12px 16px; border-bottom:1px solid #e2e8f0;">{c}</td>' for c in row)
        rows_html += f'<tr style="{bg}">{cells}</tr>'

    table_html = f'''
      <h2 style="font-size:30px; margin:0 0 12px; text-align:center;">{v["table_title"]}</h2>
      <p style="text-align:center; color:var(--text-muted, #64748b); max-width:680px; margin:0 auto 32px; font-size:16px;">{v["table_intro"]}</p>
      <div style="overflow-x:auto; margin-bottom:32px;">
        <table style="width:100%; border-collapse:collapse; background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
          <thead><tr style="background:#1e293b; color:#fff;">{cols_html}</tr></thead>
          <tbody>{rows_html}</tbody>
        </table>
      </div>
'''

    # Deep dive sections
    deep_html = ""
    for h3, paras in v["deep_dives"]:
        paras_html = "".join(f'<p style="color:#475569; line-height:1.7; margin:0 0 16px;">{p}</p>' for p in paras)
        deep_html += f'''
      <h3 style="font-size:22px; margin:32px 0 12px;">{h3}</h3>
      {paras_html}
'''

    # Cost factors grid
    factors_html = ""
    for title, desc in v["cost_factors"]:
        factors_html += f'''
        <div style="padding:20px; background:#fff; border:1px solid #e2e8f0; border-radius:10px;">
          <div style="font-weight:700; font-size:15px; margin-bottom:6px;">{title}</div>
          <p style="font-size:14px; color:#475569; margin:0; line-height:1.6;">{desc}</p>
        </div>'''

    cost_factors_html = f'''
      <h2 style="font-size:30px; margin:48px 0 12px; text-align:center;">{label} cost factors</h2>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px; margin-top:20px;">{factors_html}
      </div>
'''

    # City links
    city_label_map = {
        "new-york-ny": "New York, NY", "los-angeles-ca": "Los Angeles, CA", "chicago-il": "Chicago, IL",
        "houston-tx": "Houston, TX", "phoenix-az": "Phoenix, AZ", "philadelphia-pa": "Philadelphia, PA",
        "san-antonio-tx": "San Antonio, TX", "san-diego-ca": "San Diego, CA", "dallas-tx": "Dallas, TX",
        "austin-tx": "Austin, TX", "jacksonville-fl": "Jacksonville, FL", "fort-worth-tx": "Fort Worth, TX",
        "columbus-oh": "Columbus, OH", "charlotte-nc": "Charlotte, NC", "indianapolis-in": "Indianapolis, IN",
        "seattle-wa": "Seattle, WA", "denver-co": "Denver, CO", "washington-dc": "Washington, DC",
        "boston-ma": "Boston, MA", "nashville-tn": "Nashville, TN", "detroit-mi": "Detroit, MI",
        "portland-or": "Portland, OR", "las-vegas-nv": "Las Vegas, NV", "memphis-tn": "Memphis, TN",
        "atlanta-ga": "Atlanta, GA", "miami-fl": "Miami, FL", "tampa-fl": "Tampa, FL",
        "minneapolis-mn": "Minneapolis, MN", "milwaukee-wi": "Milwaukee, WI", "saint-louis-mo": "St. Louis, MO",
        "kansas-city-mo": "Kansas City, MO", "raleigh-nc": "Raleigh, NC", "sacramento-ca": "Sacramento, CA",
        "cincinnati-oh": "Cincinnati, OH", "baltimore-md": "Baltimore, MD", "albuquerque-nm": "Albuquerque, NM",
        "orlando-fl": "Orlando, FL", "louisville-ky": "Louisville, KY", "cleveland-oh": "Cleveland, OH",
        "san-francisco-ca": "San Francisco, CA", "san-jose-ca": "San Jose, CA", "tucson-az": "Tucson, AZ",
        "oklahoma-city-ok": "Oklahoma City, OK", "birmingham-al": "Birmingham, AL",
    }
    vslug = v["page"].split("-")[0]  # roof, hvac, etc.
    # Special handling for kitchen-remodel + page slug
    page_slug = v["page"].replace("-estimate.html", "")
    # The cost-page slug uses the vertical name (different patterns per vertical)
    cost_slug_map = {
        "roofing": "roof", "fencing": "fence", "gutters": "gutter",
        "garage-door": "garage-door", "kitchen": "kitchen-remodel",
    }
    cost_slug = cost_slug_map.get(page_slug, page_slug)

    links_html = ""
    for slug in v["city_slugs"]:
        target = ROOT / f"{slug}-{cost_slug}-cost.html"
        if not target.exists():
            continue
        display = city_label_map.get(slug, slug.replace("-", " ").title())
        links_html += f'<a href="/{slug}-{cost_slug}-cost.html" style="padding:8px 14px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; color:var(--brand); text-decoration:none;">{display}</a>'

    city_html = f'''
      <h2 style="font-size:30px; margin:48px 0 16px; text-align:center;">{label} cost by city</h2>
      <p style="text-align:center; color:#64748b; max-width:680px; margin:0 auto 24px; font-size:15px;">Local pricing benchmarks across major US metros.</p>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px; font-size:14px;">{links_html}</div>
'''

    # FAQ HTML + schema
    faq_html_items = ""
    schema_questions = []
    for q, a in v["faqs"]:
        faq_html_items += f'''
        <details class="faq-item" style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:16px 20px; margin-bottom:8px;">
          <summary style="font-weight:700; cursor:pointer; font-size:16px;">{q}</summary>
          <div class="faq-answer" style="padding-top:10px; color:#475569; font-size:15px; line-height:1.7;">{a}</div>
        </details>'''
        # Schema needs plain text (strip tags/entities)
        a_plain = re.sub(r'<[^>]+>', '', a)
        a_plain = a_plain.replace("&ndash;", "-").replace("&mdash;", "-").replace("&Prime;", "''").replace("&deg;", " degrees").replace("&amp;", "&").replace("&rarr;", "to")
        q_plain = q.replace("&Prime;", "''").replace("&deg;", " degrees")
        schema_questions.append({"@type": "Question", "name": q_plain, "acceptedAnswer": {"@type": "Answer", "text": a_plain}})

    faq_html = f'''
      <h2 style="font-size:30px; margin:48px 0 16px; text-align:center;">Frequently asked questions about {label.lower()} cost</h2>
      <div class="faq-list" style="max-width:780px; margin:0 auto;">{faq_html_items}
      </div>
'''

    schema_json = json.dumps({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": schema_questions}, ensure_ascii=False)

    full_section = f'''
  <!-- TP-ESTIMATE-SEO-V1 -->
  <section style="padding:48px 0; border-top:1px solid var(--border, #e2e8f0); background:#f8fafc;">
    <div class="container" style="max-width:980px;">
{table_html}{deep_html}{cost_factors_html}{city_html}{faq_html}
    </div>
  </section>

  <script type="application/ld+json">
  {schema_json}
  </script>
'''
    return full_section


def main():
    for vslug, v in VERTICALS.items():
        page = ROOT / v["page"]
        if not page.exists():
            print(f"SKIP: {v['page']} not found")
            continue
        text = page.read_text(encoding="utf-8")
        if "TP-ESTIMATE-SEO-V1" in text:
            print(f"SKIP (already injected): {v['page']}")
            continue

        section = build_section(v)
        # Insert before </main>
        new_text, n = re.subn(r'(\s*</main>)', section + r'\1', text, count=1)
        if n == 0:
            print(f"FAIL (no </main>): {v['page']}")
            continue
        page.write_text(new_text, encoding="utf-8")
        word_count = len(re.sub(r'<[^>]+>', ' ', section).split())
        print(f"OK: {v['page']} (+{word_count} words)")


if __name__ == "__main__":
    main()
