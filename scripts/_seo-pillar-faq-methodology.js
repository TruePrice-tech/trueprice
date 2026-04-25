#!/usr/bin/env node
/**
 * Inject PAA-style FAQ + How-We-Calculate methodology section into vertical
 * pillar pages (concrete-cost.html, insulation-cost.html, etc.). Adds:
 *
 *   - <section> with 6-8 PAA-mirror questions, each as <details>
 *   - FAQPage schema in <head> (idempotent — checks for existing FAQPage)
 *   - "How We Calculate X Costs" methodology block with visible BLS + BEA
 *     hyperlinks (E-E-A-T + AI citation signal)
 *
 * Scope: pillar pages ONLY. NEVER touches city pages (-CITY-VERTICAL-cost.html
 * pattern) — those are protected by the uniqueness audit.
 *
 * Idempotent: re-running is safe. Skips pages that already have the
 * TP-FAQ-METHODOLOGY-V1 marker.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKER = '<!-- TP-FAQ-METHODOLOGY-V1 -->';

const PILLARS = [
  {
    file: 'concrete-cost.html',
    label: 'Concrete Work',
    workerLabel: 'cement masons and concrete finishers',
    blsUrl: 'https://www.bls.gov/oes/current/oes472051.htm',
    faqs: [
      ['How much does a concrete driveway cost in 2026?', 'A standard concrete driveway costs $4,500 to $9,500 in 2026, or $8 to $15 per square foot installed. A typical 2-car driveway (~600 sqft) runs $4,800 to $9,000. Stamped concrete adds 50% to the base cost; exposed aggregate adds 20%-30%. Local labor rates and concrete material costs are the two biggest variables.'],
      ['What is the cheapest type of concrete?', 'Plain broom-finished concrete is the cheapest at $6 to $12 per square foot installed. Asphalt is cheaper still ($5 to $10/sqft) but is not technically concrete. Among decorative concrete, basic acid stain on existing slabs runs $4 to $7 per square foot, the lowest-cost way to upgrade an unattractive slab.'],
      ['How long does concrete take to cure?', 'Concrete reaches 70% strength in 7 days, 90% strength in 14 days, and full cure in 28 days. You can walk on it after 24-48 hours. Drive on it after 7 days. Avoid heavy vehicles for 14 days. Sealers should be applied 28 days after pour, never sooner.'],
      ['Is stamped concrete cheaper than pavers?', 'Yes. Stamped concrete costs $8-$18 per square foot installed; concrete pavers cost $13-$25 per square foot installed; natural stone pavers cost $20-$40 per square foot. Pavers handle settling and frost heave better than stamped concrete and are easier to repair, but the upfront cost is 30%-50% higher.'],
      ['How thick should a concrete driveway be?', 'Residential driveways should be 4 inches thick for cars and 5-6 inches for heavy vehicles like RVs or work trucks. Patios and walkways are typically 4 inches. A 4-inch compacted gravel base underneath is standard. Thickened edges (6 inches at the perimeter) prevent edge cracking.'],
      ['Do I need a permit to pour concrete?', 'Most cities require a permit for concrete slabs over a certain size threshold (often 30-100 square feet) or any pour that adds to the home footprint. Driveways and large patios almost always require permits; small repair patches usually do not. Permit fees run $25 to $200 depending on the city.'],
      ['How much is concrete per yard in 2026?', 'Ready-mix concrete delivered to a residential job site costs $140 to $200 per cubic yard in 2026, with a typical $100-$150 short-load fee for orders under 10 cubic yards. A standard 4-inch-thick 600-square-foot driveway uses about 7.5 cubic yards.'],
    ],
  },
  {
    file: 'insulation-cost.html',
    label: 'Insulation',
    workerLabel: 'insulation workers',
    blsUrl: 'https://www.bls.gov/oes/current/oes472131.htm',
    faqs: [
      ['How much does insulation cost in 2026?', 'Whole-home insulation costs $1,200 to $5,200 in 2026 depending on home size and insulation type. Blown-in cellulose averages $1 to $2 per square foot of attic, spray foam runs $2 to $5 per square foot, and fiberglass batts run $0.70 to $1.50 per square foot. Most homeowners see $100 to $350 in annual energy savings.'],
      ['Is spray foam insulation worth the cost?', 'Spray foam costs 2-3x more than fiberglass batts but provides the highest R-value per inch and acts as an air barrier. For attics in cold climates, spray foam typically pays back in 6-10 years through energy savings. Closed-cell foam is best for moisture-prone areas. Open-cell or blown-in is more cost-effective for general attic coverage.'],
      ['How much insulation do I need in my attic?', 'The DOE recommends R-38 to R-60 for attics in most U.S. climate zones. That equals 13-22 inches of fiberglass batts, 11-19 inches of blown-in cellulose, or 5-9 inches of closed-cell spray foam. A professional energy audit can determine the exact R-value target for your specific home and climate zone.'],
      ['How long does insulation last?', 'Fiberglass batts last 80-100 years if kept dry. Blown-in cellulose lasts 20-30 years before settling reduces R-value (top-up is cheap). Spray foam lasts the lifetime of the home if installed correctly. Insulation rarely needs replacement; it usually just needs supplementation as energy codes tighten.'],
      ['Can I install insulation myself?', 'Fiberglass batts and rigid foam board are DIY-friendly and save 50%-70% on labor. Blown-in cellulose can be DIY with a rented blower for around $300-$500 in materials per typical attic. Spray foam should always be hired out — improper application creates moisture and off-gassing risks. Always wear N95 respirator and full-coverage clothing.'],
      ['Are there rebates for adding insulation?', 'Yes. The federal Inflation Reduction Act provides a 30% tax credit (up to $1,200/year) for qualifying insulation installations through 2032. Many utilities offer additional rebates of $0.10-$0.50 per square foot of attic insulation. Check your state energy office and utility for current programs.'],
      ['How much can insulation save on energy bills?', 'Properly insulating an under-insulated home typically reduces heating and cooling costs 15%-30%. For a typical $2,000/year home energy bill, that is $300-$600 annually. Payback periods on attic insulation are usually 3-7 years; payback on whole-home retrofits can be 7-15 years.'],
    ],
  },
  {
    file: 'plumbing-cost.html',
    label: 'Plumbing Service',
    workerLabel: 'plumbers and pipefitters',
    blsUrl: 'https://www.bls.gov/oes/current/oes472152.htm',
    faqs: [
      ['How much does a plumber cost per hour in 2026?', 'Licensed plumbers charge $85 to $185 per hour in 2026, with a typical $75-$150 service-call minimum. Master plumbers and emergency calls (nights, weekends, holidays) command 1.5x-2x the base rate. Apprentice work is often $55-$85 per hour. Hourly rates vary 30%-50% between metros based on local labor markets.'],
      ['How much is a water heater replacement?', 'Standard 40-50 gallon tank water heater replacement costs $1,200 to $3,500 installed in 2026. Tankless water heater replacement runs $2,500 to $6,500. Heat pump water heaters cost $2,000 to $4,500 (eligible for federal tax credits). Labor is typically $400-$800 of the total; gas conversions add $500-$1,500 for venting and gas line work.'],
      ['How much does it cost to repipe a house?', 'Whole-home repipe costs $4,500 to $9,500 for PEX or $8,000 to $18,000 for copper in 2026. PEX is the dominant choice for residential repipes (faster install, fewer fittings, freeze-tolerant). Average 2,000-square-foot home takes 3-5 days to repipe. Most repipes are triggered by polybutylene removal or galvanized pipe failure.'],
      ['Why is my water bill so high?', 'The most common cause of a sudden high water bill is a running toilet (can waste 200 gallons/day), a slab leak (often invisible but adds 30%-100%), or an irrigation system stuck on. Check meter with all water off; if it spins, you have a leak. Whole-home water leak detection costs $200-$500 and pinpoints the source in 1-2 hours.'],
      ['How much does drain cleaning cost?', 'Standard drain cleaning costs $150 to $450 in 2026. Snake-only service runs $150-$300. Hydro-jetting (high-pressure water) costs $400-$900 and is required for serious clogs or root infiltration. Sewer line cleaning with camera inspection runs $300-$700. Most plumbers offer a 90-day warranty on the cleared line.'],
      ['When should I call a plumber vs DIY?', 'DIY for: clogged toilet, faucet replacement, P-trap clearing, washer hose replacement. Call a plumber for: anything inside walls, gas lines, water heater, sewer lines, code-required permits, slab leaks, persistent low pressure. Most cities require a licensed plumber to pull permits on any work other than fixture replacement.'],
      ['How much does sewer line replacement cost?', 'Sewer line replacement costs $3,000 to $25,000 depending on length, depth, and access. Trenchless pipe-bursting averages $80-$200 per linear foot; traditional excavation averages $50-$200 per linear foot but adds $1,000-$5,000 in landscaping repair. Most residential lateral sewer lines are 50-100 feet from house to main.'],
    ],
  },
  {
    file: 'hvac-cost.html',
    label: 'HVAC Replacement',
    workerLabel: 'heating, air conditioning, and refrigeration mechanics',
    blsUrl: 'https://www.bls.gov/oes/current/oes499021.htm',
    faqs: [
      ['How much does HVAC replacement cost in 2026?', 'HVAC replacement costs $3,700 to $11,500 for a typical 2,000-square-foot home in 2026. Central AC alone runs $4,500 to $8,500. Heat pumps run $5,200 to $10,000. AC + gas furnace combo systems average $7,500 to $15,000. SEER rating, tonnage, ductwork condition, and local labor are the biggest cost drivers.'],
      ['Should I replace AC and furnace at the same time?', 'Yes if either is over 12 years old. HVAC systems are sized as a matched pair; mismatched ages and SEER ratings reduce efficiency 10-20%. Replacing together also saves $1,500-$3,000 in labor (one truck roll, one permit, shared refrigerant lines). Most installers will pro-rate parts of the working unit toward the new bid.'],
      ['How long does an HVAC system last?', 'Central AC: 12-15 years (Northern climates) or 8-12 years (humid Southern climates). Furnaces: 15-20 years for gas, 20-30 years for electric. Heat pumps: 10-15 years. Mini-splits: 15-20 years. Annual maintenance ($150-$300) typically extends lifespan 30%-50%.'],
      ['Is a heat pump cheaper than gas furnace?', 'Heat pumps cost $1,500-$3,000 more upfront than gas furnaces but cost 30%-50% less to operate in mild and moderate climates. Federal tax credits ($2,000-$8,000) and utility rebates often offset the upfront premium. In cold climates (below zone 4), pair a heat pump with a small gas backup ("dual fuel") for full-winter coverage.'],
      ['What SEER rating should I buy?', 'SEER 15-16 is the minimum federal standard in 2026 (varies by region). SEER 18-20 is the sweet spot for most homes — about $1,000-$2,000 more than minimum, with energy savings paying back in 4-7 years. SEER 22+ ultra-high-efficiency units only make sense in hot climates or homes with very high cooling loads.'],
      ['Why is HVAC so expensive in 2026?', 'HVAC pricing is up 25%-40% since 2022 due to refrigerant transition (R-410A to R-454B/R-32), supply chain costs, and continued labor shortage in skilled HVAC trades. Federal SEER minimums rose in 2023, forcing equipment redesigns. The labor shortage alone has pushed installer hourly rates up 15%-30%.'],
      ['Can I install HVAC myself?', 'No, not legally. HVAC installation requires EPA Section 608 certification to handle refrigerant, plus state HVAC contractor licensing in most states. DIY mini-split installs without refrigerant work (line-set vacuum-pumping done by a pro) are common, but full system DIY voids manufacturer warranty and risks refrigerant fines of $25,000+ from EPA.'],
    ],
  },
  {
    file: 'electrical-cost.html',
    label: 'Electrical Work',
    workerLabel: 'electricians',
    blsUrl: 'https://www.bls.gov/oes/current/oes472111.htm',
    faqs: [
      ['How much does an electrician cost per hour?', 'Licensed electricians charge $75 to $150 per hour in 2026, with a typical $75-$150 service-call minimum. Master electricians and emergency calls run 1.5x-2x base. Apprentice work bills at $50-$80 per hour but always under licensed supervision for code-compliant work.'],
      ['How much does a panel upgrade cost?', '200-amp electrical panel upgrade costs $2,500 to $4,500 in 2026. 100A-to-200A upgrade with new mast and meter base runs $3,000 to $6,000. 400-amp service for large homes or EV charging runs $4,500 to $8,000. Most panel upgrades require a permit and inspection; the contractor handles both.'],
      ['How much does whole-house rewiring cost?', 'Full home rewire costs $5,000 to $15,000 for a typical 2,000-square-foot home in 2026, or $4-$10 per square foot. Knob-and-tube replacement averages $8,000-$20,000 due to demolition. Most rewires are triggered by aluminum wiring, fire damage, or insurance requirements. Expect 1-2 weeks of work.'],
      ['How much does an EV charger installation cost?', 'Level 2 EV charger installation costs $800 to $2,500 in 2026, plus $400-$800 for the charger unit itself. Cost depends on panel distance, panel capacity, and whether the panel needs upgrading. Federal tax credits cover 30% (up to $1,000) through 2032; many utilities add $200-$500 rebates.'],
      ['Do I need a permit to do electrical work?', 'Yes for almost all wiring work. Most cities allow homeowners to pull permits for their own home electrical work, but resale and insurance often require licensed-electrician work. Code-required permits include: panel work, circuit additions, kitchen/bathroom rewires, EV chargers, generators, hot tubs. Lamp and outlet replacement usually does not require a permit.'],
      ['How much does a generator installation cost?', 'Whole-house standby generator (Generac, Kohler) installation costs $7,500 to $18,000 in 2026 for a 14kW-22kW unit. Portable generator with transfer switch runs $1,500-$3,500. Cost includes generator ($3,000-$8,000), transfer switch ($600-$1,500), gas line ($500-$2,000), pad ($300-$600), and installation labor ($1,500-$4,000).'],
      ['Why is my electrical bill so high?', 'Top causes: HVAC sized too large for the home (cycles inefficiently), water heater on heavy use, old refrigerator, electric resistance heat, pool pump running 12+ hours, EV charging during peak hours. A licensed electrician can do an energy audit for $200-$400 and identify the top 3 loads.'],
    ],
  },
  {
    file: 'siding-cost.html',
    label: 'Siding Replacement',
    workerLabel: 'carpenters and exterior installers',
    blsUrl: 'https://www.bls.gov/oes/current/oes472031.htm',
    faqs: [
      ['How much does siding installation cost in 2026?', 'Siding installation costs $6,000 to $21,000 for a typical home in 2026. Vinyl runs $4 to $9 per square foot, fiber cement (HardiePlank) runs $8 to $16 per square foot, engineered wood runs $6 to $13 per square foot. Total cost depends on home square footage, material grade, removal scope, and trim complexity.'],
      ['Is fiber cement siding worth the extra cost?', 'Fiber cement (HardiePlank, James Hardie) costs about 60%-100% more than vinyl but lasts 50+ years with paint refresh every 15-20 years. It is fire-resistant, insect-proof, and rot-proof. For homes where you plan to stay 10+ years or in high-fire-risk regions, fiber cement is usually the better lifetime-cost choice.'],
      ['How long does siding installation take?', 'Standard 2,000-2,500 square foot home takes 5-10 days for vinyl, 7-14 days for fiber cement, 10-21 days for engineered wood or stucco. Removal of existing siding adds 1-3 days. Custom trim, multiple stories, and complex rooflines extend the timeline. Permits and HOA approval add 2-6 weeks before work starts.'],
      ['Should I replace or repair my siding?', 'Repair when: damage is localized (under 25% of one wall), siding is under 15 years old, and matching material is available. Replace when: damage is widespread, siding is over 20 years old, you are repainting anyway, or the underlying sheathing has moisture damage. Mixed-age siding hurts resale.'],
      ['Do I need a permit to replace siding?', 'Most cities require a permit for full siding replacement; partial repairs usually do not. Permit fees run $100-$500. The contractor should pull the permit. HOA approval is often required even when no permit is needed — submit material samples and color options 4-6 weeks before scheduled work.'],
      ['How much does it cost to remove old siding?', 'Old siding removal costs $1 to $3 per square foot. Asbestos siding removal costs $8-$15 per square foot due to certified abatement requirements. Stucco removal runs $3-$8 per square foot. Most installers include removal in the install quote at a small discount.'],
      ['Can I install siding myself?', 'Vinyl siding is the most DIY-friendly and saves 40%-60% on labor. Fiber cement requires specialized cutting tools (silica dust hazard) and is not recommended for DIY. Engineered wood and steel are also DIY-feasible but slower. Most warranties require professional installation; check before going DIY.'],
    ],
  },
  {
    file: 'painting-cost.html',
    label: 'House Painting',
    workerLabel: 'painters of buildings and structures',
    blsUrl: 'https://www.bls.gov/oes/current/oes472141.htm',
    faqs: [
      ['How much does it cost to paint a house in 2026?', 'House painting costs $2,000 to $10,500 in 2026. Interior painting averages $2 to $6 per square foot of floor area. Exterior painting runs $3 to $7 per square foot of wall area, or $5,000 to $10,200 for a typical 2,000-square-foot home. Labor is 70%-85% of the total cost.'],
      ['How much does it cost to paint one room?', 'A standard bedroom (12x12 ft, 8 ft ceilings) costs $400 to $900 to paint professionally in 2026. A living room (16x20 ft) runs $700 to $1,500. Bathrooms and kitchens are slightly higher per square foot due to detail work and fixture taping. DIY costs $50-$150 in materials per room.'],
      ['How long does paint last?', 'Exterior paint: 7-10 years for premium acrylic latex, 5-7 years for mid-grade, 3-5 years for low-grade. Interior paint: 7-10 years with normal wear. South-facing walls fade faster (3-5 years). Trim and doors need refresh every 4-7 years due to handling. Bathrooms and kitchens (humidity) need refresh every 5-7 years.'],
      ['Should I paint my house myself?', 'DIY exterior painting saves $3,000-$6,000 on a typical home but takes 7-14 weekends. Most DIY painters underestimate prep work (scraping, caulking, priming) which is 40%-60% of the labor. Two-story homes require ladder work and fall protection — pay a pro for the second-story exterior.'],
      ['How many coats of paint do I need?', 'Two coats minimum on most repaints. Three coats are needed for: drastic color changes, painting over stain, painting raw drywall, primer-and-paint-in-one over dark colors. Premium paints cover better and may achieve "two-coat finish" with fewer passes, but never trust a single coat on exteriors.'],
      ['What time of year should I paint outside?', 'Best window is spring (April-June) and fall (September-October) when temperatures stay 50-85°F day and night for at least 3 days post-application. Avoid: rain within 12 hours, direct hot sun on application surface, temperatures below 50°F at night. Most coastal humid regions limit summer painting to mornings only.'],
      ['How much does pressure washing add to painting cost?', 'Pressure washing costs $0.20 to $0.50 per square foot, or $200-$500 for a typical home. Most painters include light pressure washing in the base quote. Heavy mildew removal, lead-paint stabilization, and stain removal are usually quoted separately at $1-$3 per square foot.'],
    ],
  },
  {
    file: 'solar-cost.html',
    label: 'Solar Panel Installation',
    workerLabel: 'solar photovoltaic installers',
    blsUrl: 'https://www.bls.gov/oes/current/oes472231.htm',
    faqs: [
      ['How much does a solar panel system cost in 2026?', 'Residential solar costs $12,500 to $30,000 before incentives for a typical 10 kW system in 2026. After the 30% federal tax credit, net cost runs $8,750 to $21,000. Per-watt pricing averages $2.50-$3.50 for rooftop and $2.90-$4.20 for ground-mount arrays. State and utility rebates can reduce net cost another 10%-30%.'],
      ['How long does it take for solar to pay back?', 'Most U.S. homes see solar payback in 7-12 years after the federal tax credit. Sunny states with high electricity rates (CA, AZ, NV, FL, MA) hit 5-8 year payback. Cloudy or low-rate states (WA, KY, ID) hit 12-18 year payback. After payback, panels generate free electricity for the remaining 15-25 years of warranty.'],
      ['Can I install solar panels myself?', 'DIY solar saves $5,000-$10,000 on a typical install but is rarely worth it. You lose the manufacturer warranty, lose access to most state rebates, may void homeowner insurance, and the federal tax credit requires NABCEP-certified installers in most states. Most DIYers buy permitting, electrical, and roof penetration done by a pro and DIY only the panel mounting.'],
      ['Will solar increase my home value?', 'Yes. Owned (not leased) solar systems add an average $4-$6 per installed watt to home value, or $20,000-$30,000 for a typical 10 kW system. Solar-equipped homes sell 20% faster on average. Leased solar (PPA) does NOT add value and can actively hurt resale by complicating mortgage transfers.'],
      ['How much electricity will my solar system produce?', 'A 10 kW solar system in a sunny U.S. location produces 12,000-15,000 kWh per year — enough to cover the average U.S. home electric use (~10,500 kWh). Cloudy regions produce 8,000-11,000 kWh. Production drops 0.5%-0.8% per year as panels age. Most homeowners size systems to offset 90%-100% of annual electric use.'],
      ['Should I get a battery with my solar?', 'Batteries (Tesla Powerwall, Enphase) cost $10,000-$20,000 installed but add 30% to the federal tax credit and provide outage backup. Worth it if: your area has frequent outages, your utility has time-of-use rates, or your utility eliminated net metering (CA NEM 3.0). Otherwise, grid-tied solar without batteries usually has better economics.'],
      ['What happens to solar panels in winter or clouds?', 'Solar panels still produce power in cloudy weather and winter, just less. Cloudy days produce 10%-25% of sunny-day output; light snow on panels reduces output 50%-80% until cleared. Most panels self-clear within 1-3 days in temperate climates. Annual production is averaged across seasons in payback calculations.'],
    ],
  },
  {
    file: 'garage-door-cost.html',
    label: 'Garage Door',
    workerLabel: 'garage door installers',
    blsUrl: 'https://www.bls.gov/oes/current/oes472031.htm',
    faqs: [
      ['How much does a garage door cost installed in 2026?', 'Garage doors cost $950 to $4,000 installed in 2026. Single-car doors (8-9 ft wide) average $950-$1,800. Double-car doors (16 ft wide) run $1,500-$3,500. Custom carriage-style or insulated doors exceed $4,000. Opener installation adds $250-$650. Labor averages $200-$400 per door, more for non-standard openings.'],
      ['What is the difference between insulated and non-insulated doors?', 'Insulated doors cost $200-$700 more upfront but cut garage temperature swings 10-20°F, which matters most for attached garages. Polystyrene-insulated doors run $50-$200 above non-insulated; polyurethane-insulated (higher R-value) runs $200-$700 above. For attached garages over a living space, insulation is almost always worth it.'],
      ['How long does garage door installation take?', 'A standard residential garage door installation takes 4-6 hours for door only, or 6-10 hours including opener. Same-day install is the norm. Carriage-style doors and custom-cut openings can take a full day. Removal of existing door is usually included; concrete or framing repair adds 1-2 days.'],
      ['How much does a garage door opener cost?', 'Garage door openers cost $250-$650 installed in 2026 for chain-drive, belt-drive, or screw-drive units. Smart Wi-Fi openers (LiftMaster, Genie, Chamberlain) run $400-$800 and add 10%-20% to home value. Battery-backup openers add $100-$200 and are now required by code in California and Texas.'],
      ['Should I repair or replace my garage door?', 'Repair when: damage is localized to one panel, springs or rollers are broken, opener is malfunctioning. Replace when: door is over 15 years old, multiple panels are damaged, the door is non-insulated and you have an attached garage, or you are upgrading curb appeal for resale. Garage doors typically deliver 80%-95% ROI on resale.'],
      ['Why is my garage door so loud?', 'Top causes: worn rollers (replace for $50-$150), worn hinges (replace for $30-$100), unbalanced springs (professional repair $150-$400), loose hardware (DIY tighten with socket wrench), missing lubrication (DIY with garage-door-specific lithium grease, $10-$15). Loud doors are usually fixable for under $200.'],
      ['Are garage door springs covered by insurance?', 'Standard homeowners insurance covers garage door damage from covered perils (storm, fire, vandalism, theft) but does NOT cover normal wear-and-tear including spring failure. Spring replacement is $150-$400 professional, or $40-$80 DIY with proper safety precautions (springs are under high tension and can cause serious injury).'],
    ],
  },
  {
    file: 'landscaping-cost.html',
    label: 'Landscaping',
    workerLabel: 'landscapers and grounds maintenance workers',
    blsUrl: 'https://www.bls.gov/oes/current/oes373011.htm',
    faqs: [
      ['How much does landscaping cost in 2026?', 'Basic landscaping costs $6,000 to $12,000 for a typical residential property in 2026. New sod runs $0.35 to $0.85 per square foot installed, mulch and plants add $3,000 to $8,000, hardscape features (walkways, retaining walls, paver patios) add $15-$50 per square foot. Full property design projects often exceed $20,000.'],
      ['How much does sod installation cost?', 'Sod installation costs $1.50 to $4 per square foot in 2026 (sod $0.35-$0.85/sqft + labor and prep). For a typical 5,000 square foot lawn, expect $7,500-$20,000 installed. Hydroseeding is cheaper at $0.20-$0.50 per square foot but takes 6-12 weeks to fully establish vs same-day for sod.'],
      ['How much does a paver patio cost?', 'Paver patios cost $13 to $25 per square foot installed in 2026. A standard 200-square-foot paver patio runs $2,600-$5,000. Brick pavers run $15-$30 per square foot, natural stone (flagstone) runs $20-$40 per square foot, travertine pavers run $25-$45 per square foot. Add 10%-20% for complex patterns.'],
      ['How much does a retaining wall cost?', 'Retaining walls cost $25 to $80 per face square foot installed in 2026. Concrete block walls run $25-$50/sqft, stone veneer walls run $40-$70/sqft, natural stone walls run $50-$100/sqft. Walls over 4 feet tall require an engineer-stamped design and permit, adding $1,500-$5,000 to the project.'],
      ['Can I landscape my own yard?', 'Yes for: sod, mulch, plants, low retaining walls (under 3 ft), garden beds. Hire a pro for: irrigation, drainage, walls over 4 ft, paver patios with proper base prep, anything requiring permits. DIY savings on a $10,000 landscape project typically run $3,000-$5,000 but take 5-10 weekends of work.'],
      ['How much does professional landscape design cost?', 'Landscape design plans cost $1,500-$5,000 for a residential property in 2026. Most designers credit the design fee toward installation if you hire them to build it. Design-build firms charge 10%-20% above install-only firms but provide cohesive plans. For complex projects (major hardscape, drainage, lighting), the design fee pays back in avoided rework.'],
      ['When is the best time to landscape?', 'Spring (March-May) and fall (September-October) are best for plants and sod in most climates. Hardscape (paver patios, walls, irrigation) can be done year-round in non-freezing climates, or April-November in cold climates. Many landscapers offer 10%-20% off-season discounts in winter months.'],
    ],
  },
  {
    file: 'kitchen-remodel-cost.html',
    label: 'Kitchen Remodel',
    workerLabel: 'kitchen remodeling contractors',
    blsUrl: 'https://www.bls.gov/oes/current/oes472031.htm',
    faqs: [
      ['How much does a kitchen remodel cost in 2026?', 'Kitchen remodels cost $19,000 to $75,000+ in 2026 depending on scope. Minor remodels (cabinet refacing, countertops, backsplash, paint) average $19,000 to $30,000. Mid-range full remodels run $30,000 to $60,000. Upscale remodels with custom cabinets, premium appliances, and structural changes exceed $75,000. Labor is 30%-40% of the budget.'],
      ['Is a kitchen remodel worth it for resale?', 'Mid-range kitchen remodels return 70%-85% on resale, the highest ROI of any major home improvement. Minor remodels (refacing, paint, countertops) return 80%-100%. Major upscale remodels return 50%-65% — over-building for the neighborhood hurts ROI. Most experts recommend keeping kitchen costs under 10% of home value for ROI.'],
      ['How long does a kitchen remodel take?', 'Minor cosmetic remodel: 2-3 weeks. Full mid-range remodel without layout changes: 6-10 weeks. Major remodel with layout changes, electrical/plumbing relocation: 10-16 weeks. Custom cabinet lead times alone are 6-12 weeks; ordering early is critical to timeline. Permit and inspection delays add 2-6 weeks.'],
      ['How much do kitchen cabinets cost?', 'Kitchen cabinets cost $5,000 to $30,000 installed for a typical kitchen in 2026. Stock cabinets (Home Depot, Lowes) run $80-$150 per linear foot. Semi-custom run $150-$400 per linear foot. Custom cabinets run $400-$1,200 per linear foot. A typical 25-foot kitchen run with stock cabinets is $4,000-$8,000; with semi-custom $6,000-$15,000.'],
      ['Should I move walls during a kitchen remodel?', 'Moving walls adds $2,000-$15,000+ depending on whether the wall is load-bearing. Non-load-bearing walls: $500-$2,000 to remove. Load-bearing walls: $2,500-$10,000 with new beam, plus $1,500-$5,000 for engineering and permits. Open-concept conversions usually add $5,000-$15,000 but increase resale value 5%-10%.'],
      ['Can I live in my house during a kitchen remodel?', 'Yes for minor remodels. For major remodels (1+ months), most homeowners set up a temporary kitchen in another room with a microwave, mini-fridge, and toaster oven, plus eat out 2-3x per week. Hotel costs ($150-$300/night) for a 6-week remodel exceed most full-meal-out budgets, so most stay in.'],
      ['What is the most expensive part of a kitchen remodel?', 'Cabinets are the largest single line item, usually 25%-35% of the budget. Labor is the next largest, 30%-40%. Countertops 10%-15%. Appliances 10%-15%. Flooring, lighting, plumbing fixtures, paint, and backsplash combined make up the remaining 10%-20%.'],
    ],
  },
];

function buildFaqHtmlAndSchema(faqs) {
  const html = faqs.map(([q, a]) => (
    `<details class="faq-item"><summary>${q}</summary><div class="faq-answer"><p>${a}</p></div></details>`
  )).join('\n\n');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return { html, schema };
}

function buildMethodologyBlock(label, workerLabel, blsUrl) {
  return `<section class="section" id="how-we-calculate">
<h2>How We Calculate ${label} Costs</h2>
<p>Every dollar range on this page is built from three public datasets, refreshed annually:</p>
<ul class="factor-list">
<li><strong><a href="${blsUrl}" rel="nofollow">Bureau of Labor Statistics OEWS</a></strong> wage data for ${workerLabel}, broken out by metropolitan statistical area</li>
<li><strong><a href="https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area" rel="nofollow">Bureau of Economic Analysis</a></strong> Regional Price Parities for material and overhead adjustments by metro</li>
<li><strong>2026 retail material pricing</strong> from major U.S. distributors (Home Depot Pro, Ferguson, Builders FirstSource, Carter Lumber)</li>
</ul>
<p>Ranges represent the middle 60-70% of typical residential quotes, not extremes. Read the full <a href="/methodology.html">Woogoro methodology</a> for series IDs and adjustment formulas, or see <a href="/about.html">about Woogoro</a> for who builds and verifies this pricing data.</p>
</section>`;
}

function injectIntoPillar(p) {
  const filePath = path.join(ROOT, p.file);
  let html;
  try { html = fs.readFileSync(filePath, 'utf8'); }
  catch { console.log(`SKIP (missing): ${p.file}`); return; }

  if (html.includes(MARKER)) { console.log(`SKIP (already injected): ${p.file}`); return; }

  const { html: faqHtml, schema: faqSchema } = buildFaqHtmlAndSchema(p.faqs);
  const methodologyBlock = buildMethodologyBlock(p.label, p.workerLabel, p.blsUrl);

  const faqSection = `\n${MARKER}\n<section class="section">\n<h2>${p.label} FAQ</h2>\n<div class="faq-list">\n\n${faqHtml}\n\n</div>\n</section>\n\n${methodologyBlock}\n`;

  const closingMain = '</main>';
  const idx = html.lastIndexOf(closingMain);
  if (idx === -1) { console.log(`SKIP (no </main>): ${p.file}`); return; }
  html = html.slice(0, idx) + faqSection + html.slice(idx);

  const faqSchemaScript = `<script type="application/ld+json">\n${JSON.stringify(faqSchema)}\n</script>\n`;
  const closingHead = '</head>';
  const headIdx = html.lastIndexOf(closingHead);
  if (headIdx !== -1) {
    html = html.slice(0, headIdx) + faqSchemaScript + html.slice(headIdx);
  }

  fs.writeFileSync(filePath, html);
  console.log(`OK: ${p.file} (+${p.faqs.length} FAQ + methodology)`);
}

console.log(`Injecting FAQ + methodology into ${PILLARS.length} pillar pages...`);
for (const p of PILLARS) injectIntoPillar(p);
console.log('Done.');
