/**
 * generate-vertical-city-context.js
 *
 * Generates per-vertical city-context JSON files for all verticals that don't
 * already have one (hvac and plumbing already exist). Each file has 739 city
 * entries with 4 genuinely-varied prose fields:
 *   - climateNote: how the local climate affects this trade
 *   - materialTip: material/product recommendation for this city
 *   - seasonNote: best/worst times to schedule work
 *   - localInsight: local market + demand patterns
 *
 * Prose varies across 3+ dimensions (climate zone, home age bracket, population
 * tier, growth rate) with multiple sentence templates per combination, selected
 * deterministically by hashing (city + vertical) so output is stable across runs.
 *
 * Run:
 *   node scripts/generate-vertical-city-context.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const CTX = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const MULT = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-cost-multipliers.json"), "utf8"));

function hash(str) {
  return parseInt(crypto.createHash("md5").update(str).digest("hex").slice(0, 8), 16);
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function ageBracket(age) {
  if (!age || age < 15) return "new";
  if (age < 25) return "recent";
  if (age < 40) return "mid";
  if (age < 55) return "mature";
  return "old";
}

function popTier(pop) {
  if (!pop || pop < 30000) return "small";
  if (pop < 100000) return "mid";
  if (pop < 300000) return "large";
  return "metro";
}

// ─── VERTICAL DEFINITIONS ───────────────────────────────────────────────
// Each vertical has: climateNotes, materialTips, seasonNotes, localInsights
// keyed by climate zone (or "all") with arrays of template functions.
// Templates receive: { city, zone, age, ageBrk, pop, popT, growth, hail, snow, hurricane, hoa, mult }

const VERTICALS = {
  "electrical": {
    climateNotes: {
      hot_humid: [
        d => `${d.city} summers push AC systems hard, which stresses electrical panels. Homes over ${d.age || 30} years old often have undersized 100-amp panels that trip breakers under modern cooling loads. Panel upgrades to 200 amps are among the most common electrical jobs here.`,
        d => `High humidity in ${d.city} accelerates corrosion on outdoor electrical connections and weatherheads. Outdoor GFCI outlets and panel enclosures degrade faster here than in dry climates, adding maintenance costs that contractors factor into their quotes.`,
        d => `Lightning activity in the ${d.city} area drives surge damage claims higher than the national average. Whole-home surge protection at the panel ($300-500 installed) prevents the $2,000-5,000 appliance replacement bills that follow a direct or nearby strike.`,
      ],
      hot_dry: [
        d => `${d.city}'s intense UV degrades outdoor wiring insulation faster than humid climates. Conduit runs exposed to direct sun need UV-rated jacketing. Electricians here routinely replace cracked outdoor wiring that would last decades in milder regions.`,
        d => `Solar-ready electrical infrastructure is increasingly standard in ${d.city}. Even if you're not installing panels now, a 200-amp panel with provisions for backfeed saves $800-1,200 later. Most electricians here quote this as an option automatically.`,
      ],
      cold: [
        d => `${d.city} winters mean space heater loads that overwhelm older 100-amp panels. Circuit overloads and tripped breakers spike every December through February. Panel upgrades and dedicated circuits for space heaters are among the most requested jobs.`,
        d => `Whole-home generator demand in ${d.city} has climbed steadily as winter storms knock out power for days at a time. A 14-22kW natural gas or propane unit runs $5,000-8,000 installed, and most electricians carry a 3-6 week backlog during fall installation season.`,
      ],
      very_cold: [
        d => `In ${d.city}, electrical reliability is a safety issue — a power outage in deep winter can freeze pipes within hours. Standby generators, transfer switches, and redundant heating circuits are standard upgrade requests, not luxuries.`,
        d => `${d.city}'s extreme cold makes underground conduit runs more expensive — frost-line depths of 48-72 inches add trenching costs for any new outdoor electrical work. Budget 20-30% more than national averages for exterior runs.`,
      ],
      mixed_humid: [
        d => `${d.city} sees both summer AC demand and winter heating loads, which means electrical panels work year-round without a rest season. Homes built before ${2026 - (d.age || 35)} often have panels that were adequate for their era but can't handle modern appliance loads, EV chargers, and upgraded HVAC systems.`,
        d => `Moderate storm activity in ${d.city} makes whole-home surge protection a smart add-on to any panel work. At $300-500 installed, it protects against the voltage spikes that damage electronics and appliance control boards during thunderstorm season.`,
      ],
      marine: [
        d => `${d.city}'s mild climate means electrical panels rarely face extreme load stress, but the constant moisture promotes corrosion on outdoor connections. Salt air in coastal areas accelerates this — expect outdoor panels and disconnects to need service 20-30% sooner than inland installations.`,
      ],
      mixed_dry: [
        d => `${d.city}'s dry climate is relatively gentle on electrical infrastructure. The main driver of electrical work here is home age — properties built before ${2026 - (d.age || 40)} typically need panel upgrades and circuit additions to handle modern loads.`,
      ],
      subarctic: [
        d => `In ${d.city}, electrical systems must handle extreme cold and prolonged outages. Generator installation is nearly universal for homes without access to redundant grid feeds, and all outdoor electrical work requires arctic-rated materials.`,
      ],
    },
    materialTips: {
      all: [
        d => d.ageBrk === "old" ? `Homes averaging ${d.age} years in ${d.city} frequently have aluminum branch wiring or early Romex that doesn't meet current code. Full rewiring costs $8,000-15,000 for a typical home but eliminates the fire risk that insurance companies increasingly flag during underwriting.` :
             d.ageBrk === "mature" ? `Many ${d.city} homes from the ${2026 - d.age}s have adequate copper wiring but undersized panels (100-150 amps). A panel upgrade to 200 amps runs $1,500-3,000 and is typically the highest-ROI electrical improvement for homes of this vintage.` :
             d.ageBrk === "mid" ? `${d.city} homes built around ${2026 - d.age} generally have adequate wiring for standard loads. The most common upgrade request is adding dedicated circuits for EV chargers, home offices, or kitchen appliance upgrades.` :
             `Newer homes in ${d.city} (average ${d.age} years old) rarely need panel work. Electrical projects here skew toward additions — EV charger installations, smart home wiring, outdoor lighting circuits, and generator hookups.`,
        d => d.hoa === "high" ? `In HOA-governed communities in ${d.city}, exterior electrical work (panels, conduit runs, generator placement) often requires architectural review approval before permits. Factor in 2-4 weeks for HOA turnaround.` :
             `${d.city} permit requirements for electrical work vary by scope — panel swaps and new circuits typically require permits and inspection, while fixture replacements and outlet additions often don't. Confirm with your electrician before work begins.`,
      ],
    },
    seasonNotes: {
      all: [
        d => d.zone === "cold" || d.zone === "very_cold" ?
          `In ${d.city}, schedule non-emergency electrical work for spring or early fall. Winter is peak emergency season (panel trips, heater circuits), and summer is booked with AC-related work. Shoulder seasons offer the best availability and pricing.` :
          d.zone === "hot_humid" || d.zone === "hot_dry" ?
          `${d.city} electricians are busiest May through September when AC-driven panel loads cause the most failures. Schedule panel upgrades and rewiring for the cooler months (October through March) when contractors offer better availability and occasionally lower rates.` :
          `Electrical work in ${d.city} isn't as seasonal as outdoor trades, but spring and fall still offer the best contractor availability. Avoid scheduling during peak HVAC season (summer/winter) when electricians are pulled into emergency AC and heating jobs.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" ? `${d.city}'s large contractor pool (${d.pop?.toLocaleString()} residents) means competitive pricing on standard electrical work. For specialized jobs (commercial-grade panels, EV infrastructure, solar interconnects), verify the contractor holds the specific license endorsements required.` :
             d.popT === "large" ? `With ${d.pop?.toLocaleString()} residents, ${d.city} has enough licensed electricians to keep pricing competitive. Get 3 quotes minimum — pricing can vary 40-60% between contractors for the same panel upgrade scope.` :
             d.popT === "mid" ? `${d.city}'s mid-size market (${d.pop?.toLocaleString()} residents) supports 4-8 active residential electricians. Availability is decent but books fill quickly during peak seasons. Request quotes 2-3 weeks before your target start date.` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), the electrician pool is limited. You may need to source contractors from the nearest larger metro for competitive pricing. Check that any out-of-town contractor holds proper local licensing.`,
        d => d.growth === "high" ? `Rapid growth in ${d.city} has tightened electrician availability — new construction pulls licensed tradespeople away from residential service calls. Expect 2-4 week wait times for non-emergency work during busy seasons.` :
             d.growth === "moderate" ? `${d.city}'s steady growth keeps the electrical trade busy without the extreme backlogs seen in boom markets. Contractors are generally available within 1-2 weeks for planned work.` :
             `${d.city}'s stable market means electricians compete actively for residential work. This is an advantage for homeowners — you'll see more competitive bids and faster scheduling than in fast-growing metros.`,
      ],
    },
  },

  "solar": {
    climateNotes: {
      hot_humid: [
        d => `${d.city} averages 4.8-5.4 peak sun hours per day — strong enough for solar payback in 6-9 years at current electricity rates. Afternoon cloud buildup and summer thunderstorms reduce peak output by 10-15% compared to clear-sky estimates, so size systems for realistic production, not theoretical maximum.`,
        d => `High electricity costs from year-round AC use make ${d.city} one of the better solar markets in the region. A properly sized system offsets 70-90% of a typical home's annual bill. Panel degradation from heat and humidity runs about 0.5% per year — factor that into 25-year production estimates.`,
      ],
      hot_dry: [
        d => `${d.city} is among the strongest solar markets in the country: 5.5-6.5 peak sun hours per day with minimal cloud cover. System payback runs 5-7 years before incentives. The main challenge is panel temperature — output drops 0.3-0.5% per degree above 77°F, so ventilation gaps and micro-inverters help maintain production on 110°F+ afternoons.`,
        d => `Desert-intensity UV in ${d.city} means panels produce more energy per watt than almost anywhere else in the US. But it also accelerates degradation on lower-tier panels. Invest in Tier 1 manufacturers with strong temperature coefficients — the 3-5% production premium over budget panels compounds over 25 years.`,
      ],
      cold: [
        d => `${d.city} gets 3.8-4.5 peak sun hours per day — modest but viable for solar, especially with net metering. Snow shedding is a real factor: panels at 30°+ tilt shed snow naturally, but low-pitch arrays may need manual clearing after heavy storms. Annual production is 15-20% lower than sunbelt states.`,
        d => `Solar economics in ${d.city} depend heavily on net metering rules and electricity rates. With ${d.city}'s cold winters driving high heating bills, solar offsets less of the total energy cost than in cooling-dominant climates. Run the numbers for your specific utility before committing.`,
      ],
      very_cold: [
        d => `${d.city}'s short days and heavy snow cover make solar viable but not exceptional — 3.5-4.2 peak sun hours per day with significant seasonal variation. Snow shedding angle (35°+) and heated panel options matter here. Payback runs 10-14 years without strong local incentives.`,
      ],
      mixed_humid: [
        d => `${d.city} averages 4.5-5.0 peak sun hours per day — solidly mid-range for solar. Payback runs 8-12 years depending on your utility's net metering policy and electricity rate structure. The balanced heating and cooling loads mean solar offsets meaningful portions of both summer and winter bills.`,
      ],
      marine: [
        d => `${d.city}'s cloud cover limits solar to 3.5-4.0 peak sun hours per day — among the lowest in the lower 48. Solar can still pencil out if electricity rates are high and net metering is favorable, but payback runs 12-16 years. Evaluate your specific utility economics carefully before committing.`,
      ],
      mixed_dry: [
        d => `${d.city} averages 5.0-5.5 peak sun hours per day — above the national average and strong enough for 7-10 year solar payback. The dry climate keeps panels cleaner than humid regions, reducing maintenance washes to once or twice per year.`,
      ],
      subarctic: [
        d => `Solar in ${d.city} faces extreme seasonal variation — long summer days produce well but winter output drops to near zero. Without strong incentives, payback exceeds 14 years. Consider solar as a supplemental source rather than a primary energy strategy.`,
      ],
    },
    materialTips: {
      all: [
        d => d.ageBrk === "old" || d.ageBrk === "mature" ?
          `${d.city} homes averaging ${d.age} years old often need structural evaluation before solar installation. Older trusses and decking may need reinforcement to support the 3-4 lb/sqft load of modern panels. Budget $500-2,000 for structural assessment and any necessary upgrades.` :
          `Newer homes in ${d.city} (averaging ${d.age} years old) typically have adequate structure for solar without reinforcement. The installer should still verify truss spacing and decking condition, but surprise costs are rare on homes built to modern code.`,
        d => `For ${d.city}, monocrystalline panels (400W+) offer the best production per square foot. If your south-facing area is limited, higher-efficiency panels justify their 10-15% price premium through lifetime production gains that compound over 25 years.`,
      ],
    },
    seasonNotes: {
      all: [
        d => `In ${d.city}, solar installers are busiest March through June — homeowners want systems running before peak summer production. Book during the off-season (November through February) for faster scheduling, occasionally lower rates, and a system that's producing by spring.`,
        d => `Permitting and utility interconnection in ${d.city} typically add 4-8 weeks after installation before your system goes live. Factor this lag into your timeline — a system installed in March may not start producing credits until May.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market (${d.pop?.toLocaleString()} residents) supports multiple solar installers competing for business. Get at least 3 quotes — pricing varies 20-40% between installers for identical equipment. Check each installer's track record on the interconnection timeline, not just the install date.` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), solar installer options may be limited to 2-3 companies. Consider regional installers from nearby metros who service your area — they often offer competitive pricing and carry the same manufacturer warranties.`,
        d => d.growth === "high" ? `Rapid growth in ${d.city} has attracted multiple solar installers to the market, which benefits homeowners through competitive pricing. However, verify installer longevity — the warranty is only as good as the company behind it. Prefer installers with 5+ years in the local market.` :
             `${d.city}'s stable market means solar installer competition is moderate. Established local companies often provide better post-install service than national chains that cycle through markets based on incentive availability.`,
      ],
    },
  },

  "painting": {
    climateNotes: {
      hot_humid: [
        d => `${d.city}'s heat and humidity are the dominant factors in paint failure. Exterior paint in this climate faces UV degradation, mildew growth, and moisture penetration simultaneously. Oil-based paints fail within 2-3 years on south and west exposures. Budget for repainting every 5-7 years on sun-exposed surfaces.`,
        d => `Mildew and algae staining are the #1 paint complaint in ${d.city}. Any exterior paint job here must use 100% acrylic latex with mildewcide additive — skipping the mildewcide saves $50-100 per gallon but guarantees black streaking within 18 months.`,
      ],
      hot_dry: [
        d => `UV intensity in ${d.city} fades standard exterior paint colors within 3-4 years on south and west exposures. Specify elastomeric or 100% acrylic with UV-resistant pigments — the 15-20% cost premium over standard paint extends the repaint cycle by 3-5 years.`,
        d => `${d.city}'s dry heat causes paint to crack and peel differently than humid climates — the wood substrate dries out and contracts, pulling paint films apart at joints and edges. Proper caulking and flexible primers matter more here than in temperate regions.`,
      ],
      cold: [
        d => `In ${d.city}, the paint season is compressed to May through September. Paint applied below 50°F cures improperly and fails within 1-2 seasons. This compressed window drives peak-season pricing 10-20% above annual averages. Early spring booking is essential for the best rates.`,
        d => `Freeze-thaw cycles in ${d.city} are the primary driver of exterior paint failure. Water penetrates hairline cracks, freezes, expands, and peels paint from the substrate. Annual touch-up of cracks and gaps extends full repaint intervals by 2-3 years.`,
      ],
      very_cold: [
        d => `${d.city}'s brief paint season (June through August) limits contractors to 10-12 weeks of reliable exterior work per year. This scarcity drives prices 15-25% above national averages. Book 4-6 weeks in advance for summer scheduling.`,
      ],
      mixed_humid: [
        d => `${d.city}'s mix of humidity, moderate UV, and seasonal temperature swings means exterior paint faces all three major degradation pathways. 100% acrylic latex with mildew-resistant primer is the standard — expect 7-10 year repaint cycles with proper prep.`,
      ],
      marine: [
        d => `Constant moisture in ${d.city} makes mildew the dominant paint failure mode. Specify 100% acrylic with mildewcide; oil-based paints fail within 3-4 years. Salt air in coastal areas adds corrosion on metal trim and flashing that requires marine-grade primers.`,
      ],
      mixed_dry: [
        d => `${d.city}'s moderate climate is relatively gentle on exterior paint. UV is the primary degradation factor — repaint cycles run 8-12 years with proper prep and quality acrylic latex. South and west exposures fade first.`,
      ],
      subarctic: [
        d => `Paint in ${d.city} must withstand extreme cold and rapid temperature swings. Use 100% acrylic rated for temperatures below -40°F. The paint season is extremely short (June-August) — plan multi-year projects accordingly.`,
      ],
    },
    materialTips: {
      all: [
        d => d.ageBrk === "old" ? `Homes in ${d.city} averaging ${d.age} years often have lead paint underneath existing coats. Lead testing before scraping is both a safety requirement and a cost factor — lead abatement adds $2,000-8,000 to a whole-house exterior paint job. Never dry-scrape pre-1978 paint without testing.` :
             d.ageBrk === "mature" ? `${d.city} homes from the ${2026 - d.age}s era commonly have multiple paint layers that need proper scraping and priming before recoating. Shortcuts on prep show within 2 years. A quality prep job is 60% of a good paint job.` :
             `${d.city} homes averaging ${d.age} years old typically have 1-3 paint layers in good condition. Prep is simpler — power wash, spot-prime bare spots, and apply 2 coats of finish. This keeps the overall project cost lower than older homes with heavy prep requirements.`,
      ],
    },
    seasonNotes: {
      all: [
        d => d.zone === "cold" || d.zone === "very_cold" ?
          `The painting window in ${d.city} runs May through September when temperatures stay reliably above 50°F and humidity is manageable. Book early spring to lock in summer scheduling — contractors fill their calendars by April.` :
          d.zone === "hot_humid" || d.zone === "hot_dry" ?
          `In ${d.city}, the best painting conditions are October through March — cooler temperatures and lower humidity allow proper curing. Summer painting is possible but requires early-morning starts and careful attention to direct sun exposure during application.` :
          `${d.city} offers a longer painting season than cold-climate cities but still has optimal windows. Spring (March-May) and fall (September-November) provide the ideal combination of temperature and humidity for proper paint adhesion and curing.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market supports both premium and budget painting contractors. Prices vary 30-50% for the same scope — the difference is usually prep quality, not paint brand. Ask every bidder to detail their prep process in writing.` :
             d.popT === "mid" ? `In ${d.city} (${d.pop?.toLocaleString()} residents), 3-6 painting contractors handle most residential work. Competition keeps pricing fair, but peak-season availability fills 2-3 weeks out. Book early for spring and fall projects.` :
             `${d.city}'s smaller market (${d.pop?.toLocaleString()} residents) has limited painting contractor options. Consider crews from the nearest larger city for competitive bids — painting is one of the trades where travel distance matters less since crews work on-site for days.`,
      ],
    },
  },

  "kitchen-remodel": {
    climateNotes: {
      hot_humid: [
        d => `Kitchen ventilation matters more in ${d.city}'s humid climate. Range hoods must vent outside, not recirculate, to prevent moisture buildup that warps cabinets and feeds mold behind walls. Budget $300-800 for proper duct routing if your current setup recirculates.`,
        d => `${d.city}'s humidity affects material choices: solid wood cabinets need proper finishing on all six sides to prevent warping, engineered quartz resists moisture better than natural stone, and tile backsplash grout should include mildew inhibitor.`,
      ],
      hot_dry: [
        d => `${d.city}'s dry heat is relatively gentle on kitchen materials. The main climate-driven consideration is sun exposure — south and west-facing windows create hot spots that fade cabinet finishes and stress countertop seams. UV-filtering window film ($150-400) protects your investment.`,
      ],
      cold: [
        d => `In ${d.city}, kitchen remodel planning should account for the exterior wall insulation that the project may disturb. Moving plumbing to exterior walls in cold climates adds freeze protection costs. Interior-wall plumbing relocations avoid this issue entirely.`,
        d => `${d.city} homeowners spend more time in the kitchen during long winters, making layout efficiency and natural lighting upgrades higher-ROI investments here than in mild climates. Consider adding under-cabinet lighting and enlarging windows where wall structure allows.`,
      ],
      very_cold: [
        d => `Kitchen plumbing on exterior walls in ${d.city} needs freeze protection — heat tape and extra insulation add $200-500 but prevent the $3,000-8,000 water damage bill from a frozen supply line. Never move a sink to an exterior wall without addressing this.`,
      ],
      mixed_humid: [
        d => `${d.city}'s moderate climate doesn't impose extreme demands on kitchen materials. Standard mid-range finishes (soft-close cabinets, quartz counters, ceramic tile) perform well for 15-20 years without climate-driven degradation. Focus your budget on layout improvements and appliance upgrades rather than premium weather-resistant materials.`,
      ],
      marine: [
        d => `Moisture control is the key kitchen consideration in ${d.city}. Exhaust fans should be sized for at least 300 CFM, vented directly outside. Recirculating hoods are inadequate in this climate — the moisture they fail to exhaust promotes mold behind cabinets and under counters.`,
      ],
      mixed_dry: [
        d => `${d.city}'s dry climate is easy on kitchen materials. Standard finishes hold up well for 15-20 years. The main concern is sun bleaching on cabinets near windows — UV-filtering glass or blinds protect stained finishes from fading.`,
      ],
      subarctic: [
        d => `Kitchen renovations in ${d.city} should prioritize energy efficiency — triple-pane windows over the sink, insulated exterior walls, and sealed air gaps around plumbing penetrations. Heating costs dominate the budget, and a poorly insulated kitchen wall can add $200-400/year in energy costs.`,
      ],
    },
    materialTips: {
      all: [
        d => d.ageBrk === "old" ? `${d.city} homes averaging ${d.age} years old often require significant behind-the-wall work during kitchen remodels — outdated wiring, undersized plumbing, asbestos abatement, and structural modifications. Budget 15-25% above your finish-materials estimate for this hidden scope.` :
             d.ageBrk === "mature" ? `Homes in ${d.city} from the ${2026 - d.age}s typically have functional but dated infrastructure. Expect some electrical and plumbing upgrades during a kitchen remodel — dedicated 20-amp circuits for countertop appliances and updated drain/supply lines are common add-ons.` :
             d.ageBrk === "mid" ? `${d.city} homes built around ${2026 - d.age} usually have adequate infrastructure for kitchen remodels without major behind-the-wall surprises. Most of the budget goes to finishes: cabinets (35-40%), countertops (10-15%), appliances (15-20%), and labor (20-25%).` :
             `Newer homes in ${d.city} (averaging ${d.age} years old) offer the simplest kitchen remodel scope — existing infrastructure meets current code, layouts are already open-concept, and behind-the-wall surprises are rare. Most projects focus on finish upgrades.`,
      ],
    },
    seasonNotes: {
      all: [
        d => `Kitchen remodels in ${d.city} run 6-12 weeks depending on scope. The best booking window is summer (June-September) when contractors finishing outdoor projects shift to interior work. January-March is the busiest period as post-holiday renovation demand spikes, adding 2-4 weeks to typical timelines.`,
        d => `Lead times for custom cabinets in ${d.city} run 6-10 weeks from order to delivery. Factor this into your timeline — the construction phase can't start until cabinets arrive. Stock and semi-custom options ship in 2-4 weeks and cut the total project timeline significantly.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market (${d.pop?.toLocaleString()} residents) supports both general contractors and kitchen-specific specialists. Specialists typically quote 10-15% lower than GCs for the same scope because they have established cabinet and countertop supplier relationships with volume pricing.` :
             d.popT === "mid" ? `In ${d.city} (${d.pop?.toLocaleString()} residents), 3-5 general contractors handle most kitchen remodels. Kitchen-specific specialists may be available from nearby larger metros — they often offer better pricing and specialized experience.` :
             `${d.city}'s smaller market (${d.pop?.toLocaleString()} residents) means kitchen remodel contractors may need to be sourced from the nearest larger metro. Get at least 3 quotes and verify each contractor has kitchen-specific experience, not just general carpentry.`,
      ],
    },
  },

  "fence": {
    climateNotes: {
      hot_humid: [
        d => `Wood fences in ${d.city} face a double threat: UV degradation and moisture rot. Pressure-treated pine rated for ground contact (UC4A) is the minimum standard — cedar, which performs well in dry climates, rots in 5-7 years here without aggressive sealing. Budget for annual sealing or staining to reach a 15-year lifespan.`,
      ],
      hot_dry: [
        d => `${d.city}'s intense sun bleaches and dries wood fencing faster than humid climates. UV-resistant stains extend appearance by 2-3 years. Block walls and metal fencing outlast wood by decades here — budget 20-30% more upfront for 3x the lifespan.`,
      ],
      cold: [
        d => `Freeze-thaw cycles in ${d.city} are the #1 killer of fence posts. Posts set above the frost line (36-48 inches in this area) heave within 1-3 winters. Proper depth, gravel drainage, and concrete footings are non-negotiable for a fence that lasts.`,
      ],
      very_cold: [
        d => `${d.city}'s deep frost line (48-60 inches) means fence post holes are essentially foundation work. Equipment rental for post-hole augers adds $100-300 to the project. Vinyl and metal fences handle the freeze-thaw cycles better than wood — cedar and pine crack and split in deep cold.`,
      ],
      mixed_humid: [
        d => `${d.city}'s moderate climate is relatively forgiving on fencing materials. Cedar and pressure-treated pine both perform well with annual sealing, yielding 15-20 year lifespans. Vinyl is maintenance-free but costs 30-50% more upfront. The choice is usually aesthetic, not climate-driven.`,
      ],
      marine: [
        d => `Constant moisture in ${d.city} rots untreated wood fencing within 5-8 years. Cedar is the local favorite for its natural rot resistance, but it still needs sealing every 2-3 years. Vinyl and composite alternatives are gaining market share for their zero-maintenance appeal.`,
      ],
      mixed_dry: [
        d => `${d.city}'s dry climate is easy on fencing materials. Cedar, vinyl, and metal all perform well with minimal maintenance. UV fading is the primary concern — stains and paints last 3-5 years before needing refresh.`,
      ],
      subarctic: [
        d => `Fence installation in ${d.city} is limited to the brief thaw season. Posts must be set 60+ inches deep below frost line — freeze heave destroys shallow installations within one winter. Metal and vinyl handle the extreme cold better than wood.`,
      ],
    },
    materialTips: {
      all: [
        d => `In ${d.city}, material choice drives the total fence cost more than labor. A 150-linear-foot privacy fence ranges from $3,000-4,500 in pressure-treated pine to $5,500-8,500 in cedar to $6,000-10,000 in vinyl. The cost-per-year calculation often favors vinyl or composite despite the higher upfront price.`,
        d => d.hoa === "high" ? `HOA-governed communities in ${d.city} frequently dictate fence height, style, and material. Get written pre-approval before purchasing materials — replacing a $5,000 fence because it's 6 inches too tall or the wrong shade is an expensive mistake.` :
             `Most municipalities in ${d.city} allow 6-foot privacy fences in rear yards and 3-4 feet in front yards without variance. Check your specific zoning before buying materials — height, setback, and material restrictions vary by neighborhood.`,
      ],
    },
    seasonNotes: {
      all: [
        d => d.zone === "cold" || d.zone === "very_cold" ?
          `Fence installation in ${d.city} requires workable ground — frozen soil makes post-hole digging impossible without equipment. The window runs April through November, with September-October offering the best combination of availability and weather.` :
          `In ${d.city}, fence contractors are busiest March through June when homeowners want fencing before summer. Fall (September-November) offers better availability and occasionally lower prices as outdoor project demand fades.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market supports both dedicated fence companies and general contractors who do fencing. Dedicated fence installers typically quote 15-25% less because they buy materials in bulk and run crews that do nothing but fence work.` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), fence work is often handled by general contractors or handymen rather than dedicated fence companies. Check that your contractor has experience with the specific material and style you're requesting.`,
      ],
    },
  },

  "concrete": {
    climateNotes: {
      hot_humid: [
        d => `Concrete in ${d.city} cures differently than in dry climates — high humidity slows evaporation, which actually improves curing strength but extends the timeline. The bigger concern is expansive clay soils common in this region, which cause heave and cracking. Proper sub-base preparation (4-6 inches of compacted gravel) is non-negotiable.`,
      ],
      hot_dry: [
        d => `Hot-weather concrete placement in ${d.city} requires retarders and curing compounds — pours after 10am in summer months fail without them. Early morning pours (before 8am) are standard practice. The dry heat also requires aggressive curing: keep concrete moist for 7 days minimum to prevent surface cracking.`,
      ],
      cold: [
        d => `Air-entrained concrete mix (5-7% air content) is mandatory in ${d.city} for freeze-thaw resistance. Standard mixes without air entrainment scale and spall within 2-3 winters. Road salt tracking from driveways accelerates surface degradation — apply concrete sealer annually to driveways and walkways exposed to de-icing chemicals.`,
      ],
      very_cold: [
        d => `${d.city}'s extreme freeze-thaw cycles demand premium concrete work. Air-entrained mix, curing blankets, and frost-protected sub-bases are all mandatory. Plan concrete pours for May through September when overnight temperatures stay above 40°F. Cold-weather pours require heated enclosures that add 20-30% to labor costs.`,
      ],
      mixed_humid: [
        d => `${d.city}'s freeze-thaw cycles and moderate rainfall both affect concrete performance. Air-entrained mix is standard for outdoor flatwork, and expansion joints every 10-12 feet prevent the cracking that temperature swings cause. Proper drainage away from slabs prevents the water infiltration that freeze-thaw cycles exploit.`,
      ],
      marine: [
        d => `${d.city}'s constant moisture promotes moss and algae growth on concrete surfaces. Annual pressure washing and sealer application maintain appearance and prevent the biological growth that makes walkways slippery. Standard mixes work well — freeze-thaw additives are unnecessary in this mild climate.`,
      ],
      mixed_dry: [
        d => `${d.city}'s dry climate requires proper curing attention — concrete that dries too fast develops surface cracks. Keep newly poured concrete wet for 7 days using curing compound or plastic sheeting. Air-entrained mix is recommended for any surfaces exposed to winter freezes.`,
      ],
      subarctic: [
        d => `Concrete work in ${d.city} is limited to the warm months. Air-entrained mix, curing blankets, and heated enclosures are all standard. Sub-base must extend below the frost line (48-72 inches) for any structural concrete — footings, foundations, and retaining walls all require deep excavation.`,
      ],
    },
    materialTips: {
      all: [
        d => `Standard concrete in ${d.city} runs $6-10 per square foot for basic flatwork (driveways, walkways). Decorative options (stamped, colored, exposed aggregate) add $4-8 per square foot. The biggest hidden cost is demolition and removal of existing concrete — budget $2-4 per square foot for tearout of old slabs.`,
        d => d.ageBrk === "old" || d.ageBrk === "mature" ? `Older properties in ${d.city} (averaging ${d.age} years) often have settling concrete that affects drainage. Re-pouring may require sub-grade correction (compaction, drainage tile) that new construction doesn't need. Budget 10-20% extra for site preparation on established properties.` :
             `Homes in ${d.city} averaging ${d.age} years old typically have stable sub-grades that simplify concrete work. New pours integrate cleanly with existing slabs and foundations without the settling corrections older properties need.`,
      ],
    },
    seasonNotes: {
      all: [
        d => d.zone === "cold" || d.zone === "very_cold" ?
          `The concrete season in ${d.city} runs May through October when overnight temps stay above 40°F consistently. Spring is peak demand as homeowners address winter frost damage. Fall pours (September-October) offer better contractor availability and fewer weather delays.` :
          `${d.city} allows year-round concrete work, but the ideal window is spring and fall when temperatures support proper curing without the heat-related challenges of summer. Avoid scheduling large pours during the hottest months — early morning pours are the only reliable option.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market has concrete contractors ranging from 1-person decorative specialists to large commercial outfits that also do residential. For standard flatwork (driveways, patios), mid-size companies with dedicated residential crews typically offer the best combination of pricing and quality.` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), concrete work is often done by small local companies or general contractors. For decorative work (stamped, colored), verify the contractor has a portfolio of completed projects in your specific pattern and color — decorative concrete expertise varies widely.`,
      ],
    },
  },

  "landscaping": {
    climateNotes: {
      hot_humid: [
        d => `${d.city}'s heat and humidity create both opportunities and challenges for landscaping. Native and drought-tolerant species (yaupon holly, muhly grass, lantana) thrive with minimal irrigation and cut water bills 40-60% compared to traditional lawns. Invasive species and aggressive growth mean maintenance budgets run 15-20% higher than dry-climate markets.`,
      ],
      hot_dry: [
        d => `Xeriscaping is the dominant landscaping strategy in ${d.city}. Native desert plants, gravel mulch, and drip irrigation systems cut water usage 50-70% compared to traditional lawns. Many local utilities offer turf removal rebates ($1-3 per square foot) that offset initial installation costs.`,
      ],
      cold: [
        d => `${d.city}'s short growing season (May-September) compresses landscaping work into 4-5 months. Spring planting after the last frost date is critical for plant establishment before winter. Fall planting of trees and shrubs (September-October) allows root establishment before dormancy — a strategy experienced ${d.city} landscapers recommend for better spring survival rates.`,
      ],
      very_cold: [
        d => `Landscaping in ${d.city} is constrained by USDA hardiness zones that limit plant selection to cold-hardy natives. The growing season is short — stick to zone-appropriate perennials and spring planting after the last frost to ensure survival through the first winter.`,
      ],
      mixed_humid: [
        d => `${d.city}'s moderate climate supports a wide range of landscaping options. The mix of native perennials and structured plantings performs well with standard irrigation. Avoid high-water exotic species that struggle with summer humidity and winter dormancy transitions.`,
      ],
      marine: [
        d => `${d.city}'s mild, wet climate makes it one of the easiest landscaping environments in the country. Native rhododendrons, ferns, and conifers thrive with minimal intervention. The challenge is managing overgrowth — maintenance budgets should include seasonal pruning and weed control.`,
      ],
      mixed_dry: [
        d => `${d.city}'s dry climate favors drought-tolerant natives and efficient irrigation. Many utilities offer turf-removal rebates that make xeriscaping conversions cost-neutral in the first year. Standard landscaping maintenance budgets run 10-15% below national averages due to lower water costs.`,
      ],
      subarctic: [
        d => `Landscaping in ${d.city} is limited to extremely cold-hardy natives and a short growing season. Focus on hardscape elements (stone, gravel, timber) that provide year-round visual interest and require no seasonal maintenance.`,
      ],
    },
    materialTips: {
      all: [
        d => `A complete landscaping project in ${d.city} typically breaks down as: plant material (30-40%), hardscape/materials (20-30%), labor (25-35%), and design (5-10%). For budget-conscious homeowners, phasing the project over 2-3 seasons lets plants establish naturally and reduces upfront costs.`,
        d => d.ageBrk === "old" || d.ageBrk === "mature" ? `Established properties in ${d.city} (averaging ${d.age} years) often have mature trees and existing landscape elements that a redesign should work around. Removing mature trees costs $500-2,000 each and eliminates decades of shade value. Design with existing assets, not against them.` :
             `Newer developments in ${d.city} typically start with minimal landscaping — builder-grade sod and a few foundation shrubs. A comprehensive landscape plan costs $3,500-12,000 and typically adds 5-15% to home value, making it one of the highest-ROI exterior investments.`,
      ],
    },
    seasonNotes: {
      all: [
        d => d.zone === "cold" || d.zone === "very_cold" ?
          `The landscaping season in ${d.city} runs April through October. Spring planting (April-May) is the busiest period as homeowners and contractors rush to install before summer heat. Fall planting (September-October) is the insider move — plants establish roots before dormancy and emerge stronger the following spring.` :
          `${d.city} offers a longer landscaping season than cold-climate markets. The busiest period is March through June when spring planting demand peaks. Fall (October-December) is an excellent time for plantings, hardscape projects, and irrigation system installation at lower competition and often better pricing.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market supports full-service landscape design firms, installation-only crews, and maintenance companies. For projects over $8,000, a dedicated design firm with installation capability typically provides better results than splitting design and installation across separate companies.` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), landscaping is often handled by small local crews who do both installation and maintenance. For larger design-build projects, consider firms from the nearest larger metro that service your area.`,
      ],
    },
  },

  "foundation": {
    climateNotes: {
      hot_humid: [
        d => `Foundation problems in ${d.city} are primarily driven by soil moisture cycling — expansive clay soils swell when wet and shrink when dry, creating the settlement and heave patterns that crack foundations. Consistent moisture management (proper grading, foundation watering during droughts, functional gutters) is the #1 preventive measure.`,
      ],
      hot_dry: [
        d => `Expansive clay soils in ${d.city} cause more foundation damage than any other factor. During droughts, soil shrinks and pulls away from foundations, causing settlement. During rain events, it swells back and pushes against walls. Regular foundation watering during dry months prevents the worst movement — a soaker hose on a timer costs $50 and prevents $10,000+ in repairs.`,
      ],
      cold: [
        d => `${d.city}'s freeze-thaw cycles affect foundations differently than warm climates. Frost heave pushes shallow foundations upward, and ice lens formation in clay soils creates lateral pressure on basement walls. Proper drainage (perimeter drains, sump pumps) and insulation below grade are the standard preventive measures.`,
      ],
      very_cold: [
        d => `Frost-protected shallow foundations or full basements (8+ feet deep) are the only viable options in ${d.city}. The frost line extends 48-72 inches, and any foundation element above this depth is at risk of heave. Below-grade insulation is standard, not optional.`,
      ],
      mixed_humid: [
        d => `Foundation repair in ${d.city} most commonly addresses basement water intrusion and minor settlement. Perimeter drainage systems ($3,000-6,000), crack injection ($300-800 per crack), and sump pump installation ($1,500-3,500) handle the majority of issues. Major structural piering ($10,000-25,000) is needed only for significant settlement.`,
      ],
      marine: [
        d => `${d.city}'s wet climate makes crawlspace moisture the #1 foundation concern. Vapor barriers, crawlspace encapsulation ($3,000-8,000), and proper drainage prevent the moisture damage that leads to wood rot, mold, and structural degradation.`,
      ],
      mixed_dry: [
        d => `Variable soils in ${d.city} make geotechnical evaluation essential before any major foundation work. Soil conditions can change significantly across a single property — a $300-500 soil report prevents the $5,000-15,000 surprises that uninformed foundation work creates.`,
      ],
      subarctic: [
        d => `Foundation work in ${d.city} must account for permafrost in some areas and deep frost lines everywhere. Consult a local structural engineer for any foundation project — standard warm-climate approaches fail here.`,
      ],
    },
    materialTips: {
      all: [
        d => `Foundation repair methods in ${d.city} fall into three tiers: cosmetic ($500-2,000 for crack sealing and waterproofing), structural ($5,000-15,000 for piering, wall anchors, and drainage), and major ($15,000-40,000+ for underpinning and total reconstruction). Get a structural engineer's assessment ($300-600) before committing to any contractor's recommended scope.`,
        d => d.ageBrk === "old" ? `${d.city} homes averaging ${d.age} years have foundations built to codes that predate modern understanding of soil mechanics. Stone, brick, and unreinforced concrete foundations were common — repairs on these materials often cost 20-40% more than on modern poured concrete.` :
             d.ageBrk === "mature" ? `Homes in ${d.city} from the ${2026 - d.age}s typically have poured concrete foundations that are now entering the age range where settlement cracks and water intrusion become common. These are usually repairable without major structural intervention.` :
             `Newer homes in ${d.city} (averaging ${d.age} years) rarely need foundation repair. When issues do occur, they're usually the result of poor drainage or improper grading — corrections to surface water management ($500-2,000) resolve most problems.`,
      ],
    },
    seasonNotes: {
      all: [
        d => d.zone === "cold" || d.zone === "very_cold" ?
          `Foundation work in ${d.city} requires stable ground conditions — frozen or waterlogged soil makes excavation difficult and compromises repair quality. The ideal window is June through September. Avoid late fall and winter unless the repair is an emergency.` :
          `Foundation repair in ${d.city} can happen year-round, but dry weather conditions produce the best results. Schedule during dry seasons when soil moisture is stable — this gives the best conditions for piering, drainage work, and concrete repairs.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market has both national foundation repair chains and independent structural contractors. National chains offer warranty programs and financing but typically quote 20-40% higher than independents. Get quotes from both types and compare scope-for-scope, not just total price.` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), foundation repair contractors may be limited. Structural engineers from nearby metros can assess your situation and recommend appropriate repair methods — then you can source the contractor independently.`,
      ],
    },
  },

  "garage-door": {
    climateNotes: {
      hot_humid: [
        d => `Garage doors in ${d.city} face UV degradation on the exterior and humidity corrosion on hardware and springs. Wind-rated doors (DASMA 110 minimum, 130+ in coastal counties) are increasingly required by insurance carriers. Salt air in coastal areas doubles the maintenance frequency on springs and tracks.`,
      ],
      hot_dry: [
        d => `UV intensity in ${d.city} fades standard painted steel garage doors within 5 years on south and west exposures. UV-resistant finishes or pre-finished composite overlays extend appearance. Heat warping is rare on steel doors but affects wood and some vinyl styles.`,
      ],
      cold: [
        d => `Insulated garage doors (R-12 minimum, R-18+ preferred) make a measurable difference in ${d.city}'s winters, especially for attached garages with living space above. Uninsulated doors allow cold air infiltration that increases heating costs and can freeze exposed plumbing in the garage.`,
      ],
      very_cold: [
        d => `In ${d.city}'s extreme cold, garage door insulation (R-18+) and deep weather seals are essential. Uninsulated doors cause garage freeze damage every winter — frozen pipes, dead car batteries, and ice formation on the garage floor. Heated garages need R-18+ doors to make heating economical.`,
      ],
      mixed_humid: [
        d => `Insulated garage doors (R-12+) cut heating loss in attached garages with living space above in ${d.city}. Most carriers offer energy rebates that offset the $200-400 insulation premium. For detached garages, insulation matters less unless you use the space as a workshop.`,
      ],
      marine: [
        d => `Corrosion-resistant hardware matters more than insulation for garage doors in ${d.city}. Salt air on coastal homes accelerates spring and track wear — stainless steel hardware adds $100-200 but extends component life by 5-8 years.`,
      ],
      mixed_dry: [
        d => `Insulation matters for attached garages with living space above in ${d.city}; R-13 minimum is the regional norm. For detached garages, a standard uninsulated door is adequate unless you heat the space.`,
      ],
      subarctic: [
        d => `Heavily insulated doors (R-20+) with deep weather seals are standard in ${d.city}. Spring tension adjustments are needed more frequently due to the extreme temperature swings that affect spring elasticity.`,
      ],
    },
    materialTips: {
      all: [
        d => `A standard 2-car garage door in ${d.city} costs $800-2,500 for the door and $300-600 for professional installation. Opener replacement adds $250-500. The biggest pricing lever is material: stamped steel ($800-1,200), insulated steel ($1,200-1,800), wood composite ($1,800-3,000), and real wood ($2,500-5,000+).`,
        d => d.ageBrk === "old" || d.ageBrk === "mature" ? `Older garages in ${d.city} (homes averaging ${d.age} years) may have non-standard opening dimensions from an era before current door sizes were standardized. Custom-sized doors add 20-40% to material costs. Measure carefully — reframing the opening to standard dimensions is sometimes cheaper than a custom door.` :
             `Homes in ${d.city} averaging ${d.age} years old typically have standard-dimension garage openings. Door replacement is straightforward — a same-day install for a standard 2-car door is typical.`,
      ],
    },
    seasonNotes: {
      all: [
        d => `Garage door replacement in ${d.city} isn't highly seasonal — it's a 4-6 hour indoor/outdoor job that works year-round. However, spring (March-May) is the busiest period as homeowners address winter damage and start curb-appeal projects. Off-peak months (July-September, November-January) offer faster scheduling.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market has dedicated garage door companies, big-box retailer installation services, and independent contractors. Dedicated garage door companies typically offer the widest selection and fastest service but price 10-20% above big-box options for equivalent products.` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), garage door work is often handled by regional companies that service multiple cities. Same-day emergency service (broken springs, off-track doors) may require a service call fee of $75-150 in smaller markets.`,
      ],
    },
  },

  "siding": {
    climateNotes: {
      hot_humid: [
        d => `Siding in ${d.city} faces constant moisture assault — humidity drives mold growth behind panels, and the combination of rain and heat accelerates deterioration on organic materials. Fiber cement and engineered wood handle this climate better than vinyl, which warps under direct south-facing sun, or natural wood, which rots within 8-12 years without aggressive maintenance.`,
      ],
      hot_dry: [
        d => `UV is the dominant siding concern in ${d.city}. Standard vinyl fades and becomes brittle within 8-10 years under intense sun. Stucco and fiber cement are the local standards for good reason — they handle UV and heat without the color shift and cracking that plague vinyl on south and west exposures.`,
      ],
      cold: [
        d => `Freeze-thaw cycles in ${d.city} test siding at every seam and penetration. Water infiltrates behind panels, freezes, expands, and forces siding away from sheathing. Fiber cement and insulated vinyl handle this cycle best — standard vinyl can crack in deep cold, and wood expands and contracts enough to pop nails.`,
      ],
      very_cold: [
        d => `${d.city}'s extreme temperatures demand siding that handles both deep freeze and summer heat. Fiber cement and insulated vinyl are the proven choices — standard vinyl cracks below -20°F, and wood maintenance requirements multiply in this climate.`,
      ],
      mixed_humid: [
        d => `${d.city}'s moderate climate is relatively forgiving on siding materials. Fiber cement, vinyl, and engineered wood all perform well with standard maintenance. Material choice here is driven more by aesthetics and budget than by climate requirements.`,
      ],
      marine: [
        d => `Moisture is the constant challenge for siding in ${d.city}. Fiber cement and pre-finished cedar are the regional standards — standard vinyl absorbs moisture at seams and warps. Salt air in coastal areas adds corrosion on metal fasteners — use stainless steel or hot-dipped galvanized.`,
      ],
      mixed_dry: [
        d => `${d.city}'s dry climate is easy on most siding materials. UV fading is the primary concern — fiber cement and vinyl both handle it well with proper color selection. Wood siding needs sealing every 3-5 years to prevent moisture loss and checking.`,
      ],
      subarctic: [
        d => `Pre-finished metal or fiber cement are the only siding materials that reliably withstand ${d.city}'s extreme conditions. Standard vinyl becomes brittle and cracks, and wood maintenance requirements make it impractical in this climate.`,
      ],
    },
    materialTips: {
      all: [
        d => `Siding costs in ${d.city} vary dramatically by material: vinyl ($4-8/sqft installed), fiber cement ($8-14/sqft), engineered wood ($9-15/sqft), cedar ($10-18/sqft), and stone veneer ($15-30/sqft). For a 2,000 sqft exterior, that's $8,000-60,000 — material choice is the single biggest pricing decision.`,
        d => d.ageBrk === "old" || d.ageBrk === "mature" ? `Older homes in ${d.city} (averaging ${d.age} years) may have original siding over deteriorated sheathing. Budget for sheathing repair or replacement — discovering rot after old siding removal adds $2,000-6,000 to a typical project. A good contractor includes contingency for this in their estimate.` :
             `Homes in ${d.city} averaging ${d.age} years old typically have intact sheathing under existing siding. Re-siding is a straightforward overlay or strip-and-replace project without the hidden sheathing costs that older homes encounter.`,
      ],
    },
    seasonNotes: {
      all: [
        d => d.zone === "cold" || d.zone === "very_cold" ?
          `Siding installation in ${d.city} works best April through October when temperatures support caulk and sealant curing. Some materials (vinyl, fiber cement) can be installed in cool weather, but adhesives and caulks used at seams and trim fail below 40°F.` :
          `${d.city} allows year-round siding installation, but spring and fall offer the ideal combination of moderate temperatures and lower humidity for sealant curing. Summer pours heat against fresh caulk and can cause it to skin over before bonding properly.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market supports material-specific siding contractors (vinyl specialists, fiber cement crews, cedar craftsmen). Material-specific crews work 20-30% faster than general contractors and often carry better pricing through volume supplier relationships.` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), siding work is typically done by general contractors who handle multiple exterior trades. For fiber cement specifically, verify the crew has James Hardie or equivalent manufacturer training — improper installation voids the 30-year warranty.`,
      ],
    },
  },

  "window": {
    climateNotes: {
      hot_humid: [
        d => `Window performance in ${d.city} is dominated by solar heat gain. Spec Low-E coatings tuned for low SHGC (under 0.30) — this matters more than U-factor in cooling-dominant climates. Impact-rated glass adds 25-40% to cost but is increasingly required by insurance carriers in storm-prone areas.`,
      ],
      hot_dry: [
        d => `South and west-facing windows in ${d.city} are the primary source of cooling load. Triple-pane with the lowest available SHGC (0.20-0.25) on those exposures is worth the premium — the cooling cost savings pay back the upgrade in 5-8 years. North and east exposures can use standard double-pane Low-E.`,
      ],
      cold: [
        d => `Window U-factor is the critical spec in ${d.city}. Values under 0.27 are worth the upgrade — argon-filled triple-pane windows pay back in 7-10 years given local winter heating costs. The difference between U-0.30 and U-0.22 saves $200-400 per year in a typical ${d.city} home.`,
      ],
      very_cold: [
        d => `Triple-pane windows with U-factor under 0.22 and thermally broken frames are standard in ${d.city}, not upgrades. The extreme temperature differential between indoor and outdoor air (80-100°F in winter) makes thermal performance the dominant factor in window selection.`,
      ],
      mixed_humid: [
        d => `${d.city} needs balanced window performance — U-factor under 0.30 for winter heating and SHGC around 0.30 for summer cooling. This dual requirement eliminates the cheapest options but most mid-range windows from major manufacturers hit both targets.`,
      ],
      marine: [
        d => `Standard double-pane Low-E windows perform well in ${d.city}'s mild climate — triple-pane is rarely justified by the modest heating loads. The main concern is moisture at window frames — proper flashing and drainage at sills prevents the rot that ${d.city}'s constant moisture causes.`,
      ],
      mixed_dry: [
        d => `${d.city}'s dry climate is moderate on windows. Triple-pane on north and west exposures provides measurable energy savings; standard double-pane Low-E is adequate elsewhere. UV-resistant coatings on interior surfaces prevent fading of floors and furniture.`,
      ],
      subarctic: [
        d => `Quad-pane windows exist for climates like ${d.city}'s but are rarely cost-effective. Triple-pane with U-factor under 0.20 and thermally broken frames is the practical standard — focus your budget on proper installation and air-sealing rather than exotic glass configurations.`,
      ],
    },
    materialTips: {
      all: [
        d => `Full-house window replacement (8-12 windows) in ${d.city} runs $4,500-12,000 for vinyl frames and $8,000-20,000 for fiberglass or wood-clad. Frame material drives the price more than glass specs — vinyl is the most cost-effective for most homeowners, with fiberglass offering a 10-15% energy improvement at 40-60% higher cost.`,
        d => d.ageBrk === "old" ? `Homes in ${d.city} averaging ${d.age} years may have non-standard window openings. Custom-sized windows add 15-30% to material costs. Retrofit (insert) windows that fit inside existing frames save $100-200 per opening and avoid disturbing interior and exterior trim.` :
             `${d.city} homes averaging ${d.age} years old typically have standard window openings. Full-frame replacement and retrofit both work — retrofit is faster and cheaper if the existing frames are structurally sound.`,
      ],
    },
    seasonNotes: {
      all: [
        d => d.zone === "cold" || d.zone === "very_cold" ?
          `Window replacement in ${d.city} is best scheduled April through October. Each opening is exposed to weather for 30-60 minutes during swap-out — winter installations let cold air in and risk moisture damage to wall cavities. Spring booking secures summer installation slots.` :
          `${d.city} allows year-round window installation, but spring and fall are optimal — moderate temperatures mean less thermal stress during the swap and more comfortable working conditions for installers. Summer heat can cause sealants to cure too fast.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market has both national window companies (Renewal by Andersen, Pella) and independent installers using manufacturer-direct windows. National brands quote 40-60% higher than independents for comparable products — the difference is marketing overhead, not glass quality.` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), window replacement is handled by a mix of local contractors and regional installers. Compare at least 3 quotes — pricing on identical window specs can vary 30-50% between installers.`,
      ],
    },
  },

  "insulation": {
    climateNotes: {
      hot_humid: [
        d => `Insulation strategy in ${d.city} is as much about moisture management as thermal performance. Attic radiant barriers cut cooling load 8-12%, and spray foam in vented attics can trap moisture if the vapor barrier is on the wrong side. Proper installation matters more than R-value alone in humid climates.`,
      ],
      hot_dry: [
        d => `Radiant barriers and reflective roof coatings outperform added attic insulation in ${d.city}'s cooling-dominant climate. The intense solar radiation on the roof surface is the primary heat source — reflecting it before it enters the attic is more effective than trying to insulate against it.`,
      ],
      cold: [
        d => `Attic insulation to R-49 minimum is the standard in ${d.city}, but air sealing the attic floor matters more than added insulation depth. A well-air-sealed attic at R-38 outperforms a leaky attic at R-60 because convective heat loss through gaps overwhelms the insulation's conductive resistance.`,
      ],
      very_cold: [
        d => `${d.city} demands R-60+ in attics and R-21+ in walls for modern energy codes. Spray foam crawlspaces prevent the frozen pipe disasters that fiberglass batts can't stop. Every penetration (wires, pipes, ducts) through the building envelope needs individual air sealing — the cumulative effect of small gaps equals a window left open.`,
      ],
      mixed_humid: [
        d => `${d.city}'s balanced heating and cooling loads mean both attic and wall insulation matter equally. Attic R-49 minimum; wall cavity insulation depends on age — most homes built before ${2026 - 30} have inadequate wall insulation that dense-pack cellulose or injection foam can remedy without removing drywall.`,
      ],
      marine: [
        d => `Vapor barriers and proper ventilation matter more than R-value alone in ${d.city}'s damp climate. Trapped moisture is the dominant insulation failure mode — wet insulation performs worse than no insulation and promotes mold growth. Ensure any insulation project includes a ventilation assessment.`,
      ],
      mixed_dry: [
        d => `Attic R-49+ and wall R-21+ are increasingly standard for new builds in ${d.city}. Air sealing matters as much as insulation depth — combine both for the best results. The dry climate simplifies vapor barrier decisions compared to humid regions.`,
      ],
      subarctic: [
        d => `R-60+ everywhere is the standard in ${d.city}. Spray foam is the dominant insulation material for its combined air-sealing and insulation properties. Every building envelope penetration needs attention — cold air infiltration at -40°F creates frost deposits inside walls that cause structural damage when they thaw.`,
      ],
    },
    materialTips: {
      all: [
        d => `Insulation costs in ${d.city} vary by material: blown fiberglass ($1-1.50/sqft at R-38), blown cellulose ($1.25-2/sqft at R-38), spray foam open-cell ($1.50-2.50/sqft at R-19), and spray foam closed-cell ($2.50-4/sqft at R-21). For attic retrofits, blown-in materials offer the best cost-per-R-value.`,
        d => d.ageBrk === "old" || d.ageBrk === "mature" ? `${d.city} homes averaging ${d.age} years often have minimal or degraded original insulation. Attic upgrades are the highest-ROI improvement — adding blown insulation to R-49 over existing batts costs $1,500-3,000 and typically pays back in 2-4 years through energy savings.` :
             `Homes in ${d.city} averaging ${d.age} years old were built to more recent energy codes and typically have adequate attic and wall insulation. Air sealing ($300-600) delivers better ROI than adding insulation depth in these homes.`,
      ],
    },
    seasonNotes: {
      all: [
        d => d.zone === "cold" || d.zone === "very_cold" ?
          `Schedule insulation upgrades in ${d.city} for late summer or early fall — before heating season starts but while attic temperatures allow comfortable work. Mid-winter attic work is possible but slower and more expensive due to cold conditions and the urgency premium on contractors who are already booked with emergency heating calls.` :
          `Insulation work in ${d.city} happens year-round, but spring and fall are ideal — moderate attic temperatures (below 100°F) allow safe and efficient work. Summer attic temperatures of 140°F+ make spray foam application difficult and dangerous for crews.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market has dedicated insulation contractors who do nothing but insulation work — they're faster, cheaper, and more knowledgeable about building science than general contractors. For spray foam specifically, verify the contractor is manufacturer-certified (Icynene, Demilec, etc.).` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), insulation work is often done by general contractors or small specialty firms. For blown-in work, the equipment and technique are straightforward. For spray foam, certification matters — improper mixing ratios or application thickness cause performance failures that are expensive to remedy.`,
      ],
    },
  },

  "gutter": {
    climateNotes: {
      hot_humid: [
        d => `Gutters in ${d.city} must handle heavy summer downpours and constant debris from vigorous plant growth. Oversize to 6-inch K-style minimum and add kickout flashing where gutters meet siding — undersized 5-inch gutters overflow during the intense rain events common here. Leaf guards are essential with the year-round vegetation.`,
      ],
      hot_dry: [
        d => `Many homes in ${d.city} skip gutters entirely or use them only over entry doors — the dry climate limits their value compared to humid regions. Where gutters are installed, debris buildup from seasonal winds (rather than vegetation) is the primary maintenance concern.`,
      ],
      cold: [
        d => `Ice dams are the primary gutter concern in ${d.city}. Heated gutter cables ($400-800 installed per 50 feet) prevent the ice backup that tears gutters off eaves and drives water behind siding. Ice-and-water shield membrane on the eave edge (6+ feet up from the gutter line) provides the secondary defense.`,
      ],
      very_cold: [
        d => `${d.city}'s heavy snow loads require commercial-grade gutter hangers on 18-inch centers (standard is 24-36 inches). Ice dam cables ($600-1,200 installed per 50 feet) are essential on north-facing eaves. Some homeowners skip gutters entirely due to ice load damage — this creates foundation drainage problems that are more expensive than the gutter damage they avoid.`,
      ],
      mixed_humid: [
        d => `Standard 5-inch K-style gutters handle most rain events in ${d.city}. Add gutter guards ($5-12 per linear foot) where overhanging trees drop heavy seasonal debris. Leaf debris in gutters promotes standing water and mosquito breeding — seasonal cleaning or guards are important for both function and health.`,
      ],
      marine: [
        d => `${d.city}'s constant rain makes gutters essential, and the heavy tree debris overwhelms standard 5-inch gutters. Oversize to 6-inch with leaf guards — the combination handles both high-volume rain and the fern, needle, and moss debris that marine climates produce.`,
      ],
      mixed_dry: [
        d => `Standard 5-inch gutters handle most precipitation in ${d.city}. Ice-and-water shield at the eave matters more than gutter capacity here — the occasional heavy rain event is less concerning than the freeze-thaw cycles that damage gutter-to-fascia connections.`,
      ],
      subarctic: [
        d => `Many homes in ${d.city} skip gutters because ice loads tear them off the eaves every winter. Where gutters are installed, commercial-grade hangers and heated cables are mandatory. Budget $15-25 per linear foot installed versus $8-12 in temperate climates.`,
      ],
    },
    materialTips: {
      all: [
        d => `Seamless aluminum gutters are the ${d.city} standard: $6-12 per linear foot installed. Copper ($20-40/ft) and zinc ($15-25/ft) offer 50+ year lifespans but at 3-4x the cost. For most homeowners, aluminum with a quality finish provides the best value at 20-30 years before replacement.`,
        d => `Gutter guard systems in ${d.city} range from $5-8 per linear foot for mesh screens to $15-25 for micro-mesh or reverse-curve systems. The payoff depends on tree cover — homes with heavy canopy cover recoup the investment in 3-5 years through eliminated cleaning costs ($150-300 per cleaning, 2-4 times per year).`,
      ],
    },
    seasonNotes: {
      all: [
        d => d.zone === "cold" || d.zone === "very_cold" ?
          `Gutter installation in ${d.city} works best June through October. Spring is peak demand as homeowners replace winter ice damage. Pre-winter installation (September-October) with ice dam cables provides protection for the coming season.` :
          `Gutter work in ${d.city} happens year-round. The busiest period is fall (September-November) as homeowners prepare for rain season. Spring is also busy with post-winter inspections and replacements. Summer offers the best availability for planned installations.`,
      ],
    },
    localInsights: {
      all: [
        d => d.popT === "metro" || d.popT === "large" ? `${d.city}'s large market has dedicated gutter companies with seamless gutter machines on-site — they fabricate gutters to exact length at your home, eliminating seam leaks. General contractors who sub-contract gutter work add a markup without adding value.` :
             `In ${d.city} (${d.pop?.toLocaleString()} residents), gutter installation is often done by small local companies or as part of a larger exterior project (siding, trim). Verify the installer uses seamless fabrication — sectional gutters with seams leak within 3-5 years at every joint.`,
      ],
    },
  },
};

// ─── GENERATOR ──────────────────────────────────────────────────────────

function generateEntry(city, stateCode, vertical, vdef, cityCtx, cityMult) {
  const zone = (cityCtx.climateZone || "mixed_humid").toLowerCase();
  const age = cityCtx.avgHomeAge || 30;
  const ageBrk = ageBracket(age);
  const pop = cityMult?.population;
  const popT = popTier(pop);
  const growth = (cityCtx.growthRate || "moderate").toLowerCase();
  const hail = (cityCtx.hailRisk || "").toLowerCase();
  const snow = (cityCtx.snowLoad || "").toLowerCase();
  const hurricane = !!cityCtx.hurricaneZone;
  const hoa = (cityCtx.hoaPrevalence || "low").toLowerCase();
  const mult = cityMult?.multiplier || 1.0;

  const d = { city, zone, age, ageBrk, pop, popT, growth, hail, snow, hurricane, hoa, mult };
  const seed = hash(`${city}|${stateCode}|${vertical}`);

  function pickField(fieldDefs) {
    const templates = fieldDefs[zone] || fieldDefs["all"] || [];
    const allTemplates = [...templates, ...(fieldDefs["all"] || [])];
    if (!allTemplates.length) return "";
    const fn = pick(allTemplates, seed);
    try { return fn(d); } catch(e) { return ""; }
  }

  return {
    climateNote: pickField(vdef.climateNotes),
    materialTip: pickField(vdef.materialTips),
    seasonNote: pickField(vdef.seasonNotes),
    localInsight: pickField(vdef.localInsights),
  };
}

function main() {
  const cities = Object.keys(CTX);
  console.log(`Loaded ${cities.length} cities from city-context.json`);

  for (const [vslug, vdef] of Object.entries(VERTICALS)) {
    const outPath = path.join(ROOT, "data", `${vslug}-city-context.json`);

    // Don't overwrite existing files (hvac and plumbing)
    if (fs.existsSync(outPath)) {
      console.log(`${vslug}: ${outPath} already exists, skipping`);
      continue;
    }

    const result = {};
    let generated = 0;

    for (const ck of cities) {
      if (!ck.includes("|")) continue;
      const [cityName, sc] = ck.split("|");
      const ctx = CTX[ck];
      const mult = MULT[ck];

      const entry = generateEntry(cityName, sc, vslug, vdef, ctx, mult);
      if (entry.climateNote || entry.materialTip || entry.seasonNote || entry.localInsight) {
        result[ck] = entry;
        generated++;
      }
    }

    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
    console.log(`${vslug}: generated ${generated} entries -> ${outPath}`);
  }

  console.log("\nDone. Run inject-city-content-v2.py to apply.");
}

main();
