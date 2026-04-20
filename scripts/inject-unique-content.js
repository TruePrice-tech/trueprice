#!/usr/bin/env node
/**
 * Injects unique long-form paragraph + city-specific FAQs into city cost pages.
 * Uses city-context.json + city-local-facts.json for per-city data.
 * Idempotent: re-running replaces previously injected content.
 *
 * Usage:
 *   node scripts/inject-unique-content.js roof         # roofing pages only
 *   node scripts/inject-unique-content.js all          # all verticals
 *   node scripts/inject-unique-content.js roof --dry   # preview, no writes
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));

function cityHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
function pick(arr, seed) { return arr[seed % arr.length]; }

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const vertical = args.find((a) => a !== "--dry") || "roof";

const MARKER_START = "<!-- UNIQUE-LOCAL-GUIDE -->";
const MARKER_END = "<!-- /UNIQUE-LOCAL-GUIDE -->";
const FAQ_MARKER_START = "<!-- UNIQUE-FAQ -->";
const FAQ_MARKER_END = "<!-- /UNIQUE-FAQ -->";

function lookupCity(city, state) {
  const key1 = `${city}|${state}`;
  const ctx = cityContext[key1] || null;
  const factsKey = Object.keys(localFacts).find(
    (k) => k.toLowerCase() === `${city}|${state}`.toLowerCase()
  );
  const facts = factsKey ? localFacts[factsKey] : null;
  return { ctx, facts };
}

function parseCityFromFilename(filename, verticalSlug) {
  const base = path.basename(filename, ".html");
  const suffix = `-${verticalSlug}`;
  if (!base.endsWith(suffix)) return null;
  const slug = base.slice(0, -suffix.length);
  const parts = slug.split("-");
  if (parts.length < 2) return null;
  const stateCode = parts.pop().toUpperCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  const cityName = parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  if (!cityName) return null;
  return { city: cityName, state: stateCode };
}

// --- ROOFING TEMPLATES ---

function roofingParagraph(city, state, ctx, facts) {
  const lines = [];
  const seed = cityHash(city);

  // Opening by climate -- 4 variants per bucket, seeded pick so same-climate cities get different sentences.
  const climateMap = {
    hot_humid: [
      `Roofing in ${city} means contending with ${state === "TX" ? "Texas" : state}'s combination of intense UV exposure, high humidity, and sudden temperature swings. These conditions accelerate granule loss on standard asphalt shingles and can shorten roof lifespan by 3-5 years compared to milder climates.`,
      `${city} homeowners face a roofing climate shaped by UV intensity, persistent humidity, and the occasional severe storm. Standard 3-tab shingles often underperform their rated lifespan here; architectural shingles or metal typically return the 15-25% price premium through a longer service life.`,
      `The humid subtropical conditions in ${city} put roofing materials through more stress than most national averages suggest. Algae, fungal growth, and UV-driven granule loss are common, and selecting materials rated for these specific stressors materially extends replacement intervals.`,
      `Between heat, humidity, and the storm patterns typical of ${state}, a roof in ${city} faces year-round wear that is invisible until a leak appears. Ventilation quality, underlayment choice, and shingle algae-resistance matter as much as the brand on the wrapper here.`,
    ],
    hot_dry: [
      `The arid climate around ${city} creates a harsh environment for roofing materials. Sustained UV bombardment and extreme surface temperatures (roof surfaces regularly exceed 160F in summer) degrade standard materials faster than national averages suggest.`,
      `In ${city}'s dry heat, roofing performance is driven almost entirely by UV resistance and thermal cycling. Lighter-colored materials and radiant barriers are worth their cost premium here, since unshaded roof decks can stay above 140F for weeks at a time.`,
      `${city}'s intense sunshine and low humidity are kind to mold and fungi but brutal on asphalt shingles. Expect 20-25% shorter effective lifespans versus the manufacturer's rating, which makes metal, tile, and cool-roof-rated materials more compelling investments here.`,
      `Arid-climate roofing in ${city} is a heat-management problem. Poor ventilation and dark colors can push attic temperatures past 150F, accelerating shingle aging and driving up cooling costs simultaneously. Material and color choice should reflect that reality.`,
    ],
    cold: [
      `${city}'s cold winters bring unique roofing challenges: ice dams, freeze-thaw cycling, and heavy snow loads all factor into material selection and installation technique. A roof built for mild weather will fail early here.`,
      `Cold-climate roofing in ${city} means the installer matters as much as the material. Ice and water shield at eaves, valleys, and penetrations is non-negotiable, and proper attic ventilation determines whether snow melts evenly or forms damaging ice dams.`,
      `A roof in ${city} has to handle snow load, freeze-thaw cycling, and the thermal differentials that drive ice damming. Those forces pull at fasteners, stress sealant joints, and reward installers who follow the high-wind and cold-weather sections of the manufacturer specs.`,
      `${city} winters punish roofs that were specified or installed for milder climates. Snow buildup, ice dams, and the repeated freeze-thaw cycling of shoulder seasons all conspire to shorten expected lifespans unless insulation and ventilation are engineered together.`,
    ],
    temperate: [
      `${city}'s moderate four-season climate is relatively forgiving on roofing materials, giving homeowners more flexibility in material choice. That said, local factors like tree coverage, wind exposure, and occasional severe weather still matter.`,
      `Compared to harsher climates, roofing in ${city} benefits from milder conditions year-round. Material options are broad, but the local factors that drive lifespan here are tree-debris buildup, occasional wind events, and the quality of the underlayment.`,
      `${city}'s temperate climate lets homeowners pick from nearly any roofing material on the market. Where specificity matters is in details: flashing quality around plumbing stacks, ventilation that meets code, and proper underlayment under every slope.`,
      `Four-season weather in ${city} tests a roof gradually rather than dramatically. The result is that installation quality -- not the brand on the shingle wrapper -- is the primary driver of whether you get 15 years of service or 25.`,
    ],
    mixed_humid: [
      `${city} gets the full range of weather stress on a roof: summer heat and humidity, occasional severe storms, and enough cold-weather cycling to test flashing and sealant integrity over time.`,
      `Roofing in ${city} has to hold up against summer humidity, winter cold, and the occasional severe storm. That mix of stressors means flashing quality and sealant durability often matter more than the shingle grade itself.`,
      `The mixed-humid climate in ${city} means a roof is never really at rest. Summer thermal expansion, winter contraction, and springtime severe weather each wear at different components, which is why staged inspections pay off here.`,
      `${city}'s four-season mix is easier on roofs than pure hot-humid or pure cold climates, but the freeze-thaw shoulder seasons are where most leaks start. Flashing details at valleys and penetrations deserve extra attention.`,
    ],
    mixed_dry: [
      `The semi-arid conditions around ${city} mean UV degradation is the primary roofing concern. Materials that perform well in humid climates may underperform here due to sustained heat and minimal moisture.`,
      `In ${city}, the dry heat is what wears roofs down. Low humidity helps with mold resistance but sustained UV exposure breaks down standard shingles faster than rated, so higher-grade materials often pay back through longer service life.`,
      `${city}'s semi-arid climate flips the usual roofing priorities: moisture management matters less, UV resistance matters more. Cool-roof coatings and lighter colors are increasingly common here for both lifespan and cooling-cost reasons.`,
      `A roof in ${city} ages faster under UV than its nominal rating suggests. Pairing higher-reflectance materials with proper attic ventilation is the combination that actually moves the needle on both lifespan and energy cost.`,
    ],
  };
  const climateArr = climateMap[ctx?.climateZone] || climateMap.temperate;
  lines.push(pick(climateArr, seed));

  // Per-city weather/material/insight/permit notes from ctx -- HIGH-uniqueness since each is
  // genuinely city-specific prose (96% unique after normalization).
  if (ctx?.weatherNote) {
    lines.push(`${ctx.weatherNote}.`.replace(/\.\.$/, "."));
  }
  if (ctx?.materialTip) {
    lines.push(`${ctx.materialTip}.`.replace(/\.\.$/, "."));
  }
  if (ctx?.localInsight) {
    lines.push(`${ctx.localInsight}.`.replace(/\.\.$/, "."));
  }
  if (ctx?.permitNote) {
    lines.push(`${ctx.permitNote}.`.replace(/\.\.$/, "."));
  }

  // Hail
  if (ctx?.hailRisk === "high") {
    lines.push(
      `${city} sits in an active hail corridor. Homeowners here should seriously consider Class 4 impact-resistant shingles, which can reduce insurance premiums by 15-25% while providing meaningfully better protection against the severe spring storms this area regularly experiences.`
    );
  } else if (ctx?.hailRisk === "moderate") {
    lines.push(
      `Hail is an occasional but real risk in ${city}. While not as frequent as cities in the central plains, impact-resistant materials are still worth the 10-15% cost premium for homeowners planning to stay in their home for 10+ years.`
    );
  }

  // Hurricane
  if (ctx?.hurricaneZone) {
    lines.push(
      `As a hurricane-exposure area, ${city} has specific building code requirements for wind uplift resistance. Roofing contractors here must install to higher wind-rated standards, which adds roughly 5-10% to material and labor costs compared to inland cities.`
    );
  }

  // Home age
  if (ctx?.avgHomeAge) {
    const age = ctx.avgHomeAge;
    if (age > 40) {
      lines.push(
        `With an average home age of ${age} years, many ${city} roofs are on their second or third replacement. Older homes frequently need decking repairs, upgraded ventilation to current code, and sometimes structural reinforcement before new roofing goes on. Budget an additional 10-20% contingency for homes built before 1985.`
      );
    } else if (age > 25) {
      lines.push(
        `The average home in ${city} is about ${age} years old, meaning many original roofs are approaching or past their expected lifespan. First-time replacements on homes this age typically reveal minor decking issues and outdated ventilation that should be addressed during the reroof rather than deferred.`
      );
    } else {
      lines.push(
        `${city}'s housing stock is relatively new (average age ${age} years), so most roof replacements here are storm-damage-driven rather than age-related. The good news: newer construction typically has modern decking and ventilation already in place, which simplifies the replacement scope and keeps costs closer to the lower end of the range.`
      );
    }
  }

  // Local facts: soil / geography
  if (facts?.soil) {
    lines.push(
      `One factor often overlooked in ${city}: ${facts.soil}. This can affect not just foundation work but also how roof loads distribute and whether additional structural evaluation is warranted before a heavy material like tile or slate is installed.`
    );
  }

  // Permits
  if (facts?.permits) {
    lines.push(
      `On the permitting side, ${facts.permits}. Always confirm your contractor is pulling the permit themselves rather than asking you to do it, since the permit holder is legally responsible for code compliance.`
    );
  }

  // Growth rate / contractor market
  if (ctx?.growthRate === "high") {
    lines.push(
      `${city} is a high-growth market, which means contractor availability is tighter and labor costs run higher than similarly sized cities with slower growth. Getting 3 quotes is especially important here since pricing variance between contractors tends to be wider in competitive markets.`
    );
  }

  return lines.join("\n\n");
}

function roofingFAQs(city, state, ctx, facts) {
  const faqs = [];
  const seed = cityHash(city);

  // Climate-specific FAQ
  if (ctx?.hailRisk === "high") {
    faqs.push({
      q: `Do I need impact-resistant shingles in ${city}?`,
      a: pick([
        `They are strongly recommended. ${city} experiences frequent hail events that can damage standard shingles in a single storm. Class 4 impact-resistant shingles cost 10-20% more but qualify for insurance discounts of 15-25% in most ${state} policies, often paying for themselves within 3-5 years. If your current roof was damaged by hail, your insurance claim may cover the upgrade to IR-rated materials at no additional out-of-pocket cost.`,
        `Impact-resistant shingles should be high on your list for ${city}. This area sees enough hail activity that standard architectural shingles frequently sustain damage requiring premature replacement. The 10-20% price premium for Class 4 IR-rated shingles is offset by insurance premium reductions of 15-25% in most ${state} markets, making them the financially smarter choice over the life of the roof.`,
        `Given ${city}'s position in an active hail corridor, Class 4 impact-resistant shingles are a smart investment. Standard shingles here often fail early from repeated hail strikes. IR-rated materials handle the punishment significantly better, and most ${state} insurers offer 15-25% premium discounts that offset the 10-20% higher material cost within a few years.`,
        `Absolutely. Hail damage is one of the most frequent roof insurance claims in ${city}. Class 4 impact-resistant shingles absorb hail strikes that would crack or dislodge standard materials. While they cost 10-20% more upfront, the 15-25% insurance discount most ${state} carriers offer for IR-rated roofs typically pays back the difference in 3-5 years, not counting the avoided replacement costs.`,
      ], seed),
    });
  } else if (ctx?.hurricaneZone) {
    faqs.push({
      q: `What wind rating do I need for a roof in ${city}?`,
      a: pick([
        `${city} falls within a hurricane exposure zone, so building code requires roofing materials and installation methods rated for higher wind speeds than inland areas. Most contractors here install to 130+ mph wind ratings using enhanced nailing patterns and high-wind-rated underlayment. Verify your quote specifies the wind rating and ask whether the installation method matches the manufacturer's high-wind warranty requirements.`,
        `Building code in ${city}'s hurricane zone mandates wind-rated roofing materials and installation techniques. Standard installations from non-coastal areas will not meet code here. Expect contractors to use 130+ mph rated materials with six-nail patterns and peel-and-stick underlayment. When comparing quotes, confirm each specifies the wind speed rating and that the nailing schedule matches the manufacturer's high-wind warranty.`,
        `As a hurricane-exposure area, ${city} requires roofing systems rated for sustained high winds. Local code typically mandates 130+ mph wind-rated materials with enhanced fastening patterns. The key items to verify on any quote: wind speed rating of the shingles, whether high-wind underlayment is included, and that the installation method qualifies for the manufacturer's wind warranty rather than voiding it.`,
        `Hurricane-zone building codes in ${city} set the bar higher than standard installations. Roofing materials and methods must handle 130+ mph wind speeds using reinforced nailing schedules and high-wind-rated underlayment. Ask each contractor for the specific wind rating they install to, and verify the installation matches the manufacturer's requirements for their high-wind warranty coverage.`,
      ], seed),
    });
  } else if (ctx?.climateZone === "cold") {
    faqs.push({
      q: `How do I prevent ice dams on my ${city} roof?`,
      a: pick([
        `Ice dams form when heat escapes through the roof, melting snow that refreezes at the eaves. Prevention starts with proper attic insulation (R-49 or higher for ${city}'s climate zone) and continuous soffit-to-ridge ventilation. Your roofing quote should include ice and water shield membrane on the first 3-6 feet from all eaves. If your current roof has ice dam damage, address the insulation and ventilation before replacing the roof or the problem will recur.`,
        `The root cause of ice dams is heat leaking into the attic, not the roof material itself. In ${city}, you need R-49+ attic insulation and continuous ventilation from soffit to ridge to keep the roof deck cold. Any roofing quote here should include ice and water shield on at least the first 3-6 feet from every eave. Replacing the roof without fixing the thermal envelope underneath just delays the same problem.`,
        `Preventing ice dams in ${city} is primarily an insulation and ventilation issue, not a roofing one. Start with R-49 or better attic insulation and seal all air leaks from the living space into the attic. Ensure continuous soffit-to-ridge ventilation keeps the roof deck uniformly cold. Ice and water shield membrane on the first 3-6 feet from eaves provides backup protection. Fix the heat loss first or new roofing alone will not solve the problem.`,
        `${city}'s freeze-thaw cycling makes ice dams a real concern. They happen when heat from the living space warms the roof deck, melting snow that refreezes at the colder eaves. The fix is three-fold: adequate attic insulation (R-49 minimum here), continuous soffit-to-ridge airflow, and ice-and-water shield membrane on the lower 3-6 feet of every eave. A roofing quote that ignores attic conditions is missing the actual problem.`,
      ], seed),
    });
  } else {
    faqs.push({
      q: `How long does a roof last in ${city}?`,
      a: pick([
        `In ${city}'s climate, architectural asphalt shingles typically last 20-25 years, standard 3-tab shingles 15-20 years, metal roofing 40-60 years, and tile 50+ years. These estimates assume proper ventilation and no major storm damage. UV exposure is the primary degradation factor here, so lighter-colored materials and adequate attic ventilation both extend lifespan meaningfully.`,
        `Roof lifespan in ${city} depends on material and maintenance: architectural shingles run 20-25 years, 3-tab shingles 15-20, metal 40-60, and tile 50 or more. UV radiation breaks down materials faster than most homeowners expect, so lighter colors and proper attic ventilation both add years. These numbers assume no major storm damage and regular maintenance.`,
        `Expect architectural asphalt shingles to last 20-25 years in ${city}, with 3-tab shingles at 15-20 years, metal roofing at 40-60, and tile at 50+. The biggest lifespan variable here is UV exposure since it accelerates granule loss and material breakdown. Adequate attic ventilation and lighter-colored materials both help counteract this.`,
        `For ${city} homeowners, here are realistic roof lifespans: 3-tab asphalt shingles last 15-20 years, architectural shingles 20-25, standing seam metal 40-60, and clay or concrete tile 50+. UV degradation is the primary wear factor in this climate. Proper ventilation keeps the roof deck from overheating, and lighter material colors reflect more UV, both extending service life.`,
      ], seed),
    });
  }

  // Permit FAQ
  faqs.push({
    q: `Do I need a permit to replace my roof in ${city}?`,
    a: facts?.permits
      ? pick([
          `Yes. ${facts.permits} A reputable contractor handles the permit process as part of the job. If a contractor suggests skipping the permit or asks you to pull it yourself, that is a red flag. Unpermitted work can void your homeowners insurance, create problems when selling, and leave you liable if the installation does not meet code.`,
          `A permit is required. ${facts.permits} Your contractor should handle all permitting as part of the project. Be wary of any roofer who suggests going without a permit or shifting that responsibility to you. Unpermitted roofing creates insurance coverage gaps and complicates home sales.`,
          `Yes, permits are mandatory. ${facts.permits} The contractor should pull the permit before starting, not after. Skipping permits is a serious red flag since unpermitted work can void your homeowner's insurance and trigger disclosure problems when you sell the home.`,
          `Permit is required for roof replacement. ${facts.permits} Any professional contractor includes permitting in their scope of work. If someone suggests working without a permit to save money, walk away. The risks include voided insurance coverage, code violation liability, and complications at resale.`,
        ], seed + 1)
      : pick([
          `In most jurisdictions including ${city}, a building permit is required for a full roof replacement. Your contractor should pull the permit before work begins. Unpermitted roofing work can void your homeowners insurance coverage and create disclosure issues when selling the home.`,
          `A permit is typically required for roof replacement in ${city}. The contractor handles the permit process. Going without one risks voiding your homeowners insurance and creates legal complications at resale since you must disclose unpermitted work.`,
          `Yes, ${city} generally requires a building permit for full roof replacements. Your roofer should pull this as part of the job. Without a permit, your insurance coverage may be compromised and you face disclosure obligations if you sell the home.`,
          `Most ${city} jurisdictions require a permit for a complete roof replacement. This is the contractor's responsibility to obtain before work starts. Skipping permits creates real risks: insurance coverage gaps, code violation liability, and mandatory disclosure when selling.`,
        ], seed + 1),
  });

  // Timing FAQ
  const seasonMap = {
    hot_humid: { best: "late fall or early winter", why: "after hurricane season passes and before spring storm demand begins" },
    hot_dry: { best: "fall or early spring", why: "summer surface temperatures make installation difficult and can affect adhesive curing" },
    cold: { best: "late spring or early fall", why: "materials install best above 45F and before snow season pricing surcharges" },
    temperate: { best: "late summer or early fall", why: "stable weather allows proper curing and contractors are less backlogged than spring" },
    mixed_humid: { best: "early fall", why: "after summer storms subside and before winter weather complicates scheduling" },
    mixed_dry: { best: "spring or fall", why: "moderate temperatures allow proper material adhesion and curing" },
  };
  const season = seasonMap[ctx?.climateZone] || seasonMap.temperate;
  faqs.push({
    q: `When is the best time to replace a roof in ${city}?`,
    a: pick([
      `The optimal window for roof replacement in ${city} is ${season.best}, ${season.why}. Scheduling during off-peak periods can save 10-15% on labor costs since contractors have more availability and may offer competitive pricing to fill their calendar. Avoid scheduling immediately after a major storm event when contractor demand (and prices) spike.`,
      `For ${city}, aim for ${season.best} to schedule your roof replacement. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}, which means better contractor availability and potential savings of 10-15% on labor. Booking right after a major storm is the worst time since every roofer in the area will be booked and prices reflect the surge demand.`,
      `Schedule your ${city} roof replacement during ${season.best} if possible. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}, and off-peak timing often means lower installation costs since contractors compete harder for work. Expect to pay a 10-15% premium if you schedule during the post-storm rush when demand peaks.`,
      `${city} homeowners should target ${season.best} for roof replacement work. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}, giving you the best combination of weather conditions and contractor pricing. Off-season scheduling typically saves 10-15% compared to peak demand periods, especially the weeks immediately following severe weather events.`,
    ], seed + 2),
  });

  return faqs;
}

// --- PLUMBING TEMPLATES ---

function plumbingParagraph(city, state, ctx, facts) {
  const lines = [];

  const seed = cityHash(city);
  const climateMap = {
    cold: [
      `Plumbing in ${city} must be designed around freeze protection. Temperatures that drop below 20F put exposed and under-insulated pipes at serious risk of bursting, which is one of the most expensive plumbing emergencies homeowners face. Any plumbing quote here should account for pipe insulation, heat tape on vulnerable runs, and proper frost-proof hose bibs.`,
      `Cold winters make ${city} a city where plumbing layout details matter. Pipes routed through exterior walls, unheated crawl spaces, or attached garages all need insulation and in some cases heat cable; a single burst supply line in winter can cause damage that costs more than preventive winterization for a decade.`,
      `A plumbing system in ${city} is really two systems: the ordinary one that carries water year-round and the freeze-protection layer that keeps it alive through winter. Good installers pay as much attention to the second as the first -- insulation, sealed penetrations, accessible shutoffs, and heat-trace on vulnerable runs.`,
      `${city}'s winters flip the usual plumbing priorities. Hard water, corrosion, and fixture wear still matter, but nothing else rivals the cost of a mid-January burst pipe. Any quote that does not address freeze protection on exterior walls and unheated spaces is incomplete for this climate.`,
    ],
    very_cold: [
      `${city}'s severe winters make freeze protection the single most important factor in residential plumbing. Water supply lines in exterior walls, crawl spaces, and unheated garages need heat cable and insulation rated for extended sub-zero exposure. Burst pipe repairs after a hard freeze routinely cost $2,000-$8,000, making preventive winterization the best investment a homeowner can make.`,
      `Plumbing materials and methods in ${city} have to hold up against weeks of sub-zero temperatures. That means heat-traced supply lines, cold-rated insulation values, frost-free hose bibs as the default rather than the upgrade, and shutoffs located where they can actually be reached in an emergency.`,
      `${city}'s extreme cold turns routine plumbing problems into major ones if preparation is weak. The cost of engineered freeze protection -- heat cable, foam insulation, strategic shutoffs -- is small compared to the property damage a single long cold snap can cause without it.`,
      `In ${city}, the annual plumbing question is less "will something break" and more "will freeze protection hold." Homes that have been retrofitted with heat-traced supply lines and properly insulated crawlspaces routinely survive 40-below stretches; homes relying on older winterization do not.`,
    ],
    hot_humid: [
      `${city}'s warm, humid climate creates a different set of plumbing challenges than cold-weather cities face. High humidity accelerates corrosion on galvanized steel and copper fittings, and the consistently warm ground water temperatures can promote bacterial growth in water heaters set below 120F. On the plus side, freeze damage is rarely a concern here.`,
      `Plumbing longevity in ${city} comes down to managing corrosion and bacterial growth rather than freeze risk. Older copper and galvanized lines tend to fail at fittings first as humidity accelerates oxidation, and water heaters benefit from anode-rod inspections on a tighter cadence than drier climates.`,
      `In ${city}'s humid subtropical climate, plumbing failures usually track moisture: corroded fittings, leaking traps, and biofilm inside warm-water lines. A dehumidified mechanical room and a water heater temperature of at least 120F go a long way toward extending system life.`,
      `${city}'s heat and humidity wear plumbing differently than cold climates do. Fittings age faster, water heater sediment builds faster, and vented attics that house plumbing lines need particular attention. Freeze protection matters less, but corrosion protection matters more.`,
    ],
    hot_dry: [
      `The arid climate around ${city} brings plumbing considerations that homeowners from wetter regions may not expect. Hard water is extremely common, causing mineral scale buildup inside pipes, water heaters, and fixtures. Water softener installation ($1,500-$3,000) often pays for itself by extending water heater life and reducing fixture replacement frequency.`,
      `Hard water defines residential plumbing in ${city}. Mineral scale lines the inside of tanks, narrows hot-water supply runs, and shortens the lifespan of every valve and aerator in the home. Whole-house softeners, annual water-heater flushes, and scale-resistant fixtures all pay back on typical system replacement cycles.`,
      `${city}'s dry climate sidesteps freeze risk but introduces scale. The minerals in local water precipitate inside water heaters, dishwashers, and shower valves, reducing efficiency and shortening equipment life. Softening is often a better first investment than any fixture upgrade.`,
      `Plumbing in ${city} is really hard-water plumbing. Equipment choices, maintenance cadence, and even fixture finishes all get tilted by the mineral content. A plumber who does not mention water quality on a major install is skipping the variable that matters most here.`,
    ],
    mixed_humid: [
      `${city} sees enough winter cold to create occasional freeze risk and enough summer humidity to accelerate pipe corrosion over time. This combination means plumbing systems here face year-round stress that shortens component lifespans compared to milder climates. Annual inspections catch small issues before they become expensive emergencies.`,
      `A four-season climate like ${city}'s tests plumbing from both ends: winter cold stresses supply lines while summer humidity accelerates fitting corrosion. Neither is as severe as a single-climate extreme, but the combination means staged inspections and replacements of aging fittings pay back here.`,
      `Plumbing in ${city} has to hold up against both winter freeze-thaw and summer humidity. That mixed-stress profile means corrosion, fittings, and insulation all age in parallel rather than one dominating failure mode, which is a good argument for annual system-level inspections.`,
      `${city}'s mix of winter cold and summer humidity wears plumbing gradually rather than dramatically. Fittings, water heaters, and sealed traps all age under both stress regimes, so a staged replacement plan (water heater at year 10, fittings at year 20, supply lines at year 40) is a reasonable default here.`,
    ],
    mixed_dry: [
      `The semi-arid conditions around ${city} mean hard water and mineral buildup are the primary plumbing concerns. Tankless water heaters and fixtures require descaling more frequently here than in soft-water regions. Water conservation fixtures are increasingly popular and may qualify for local utility rebates.`,
      `In ${city}'s semi-arid climate, water quality drives most plumbing decisions. Scale buildup is the primary wear factor on water heaters, tankless units, and premium fixtures. A softener and an annual descale routine typically extend equipment life by several years.`,
      `${city}'s dry air and mineral-rich supply water push plumbing priorities toward descaling and conservation. Low-flow fixtures often qualify for utility rebates here, and softening extends the life of high-efficiency equipment that would otherwise scale out in a handful of years.`,
      `Plumbing lifespan in ${city} is largely a function of scale management. Water heaters, tankless units, and even shower cartridges wear faster in hard water than brand specs assume. Budgeting for annual flushes and a whole-house softener is often cheaper than accelerated replacement cycles.`,
    ],
    marine: [
      `${city}'s mild marine climate is relatively gentle on plumbing systems. Freeze events are rare, humidity is moderate, and water quality is generally good. The main concerns are aging infrastructure in older neighborhoods and root intrusion into sewer lines from the lush vegetation this climate supports.`,
      `Marine-climate plumbing in ${city} avoids the extremes. Freeze risk is limited and scale issues are modest, but the dense vegetation that thrives here drives sewer-line root intrusion that becomes the dominant plumbing failure mode for older homes.`,
      `${city}'s mild, wet climate is kind to supply-side plumbing but rough on buried sewer laterals. Root intrusion from mature trees is the single most common major plumbing issue, which is why camera inspections of the lateral are a smart addition to any home-purchase due diligence.`,
      `In ${city}, plumbing wear tilts toward the drain side rather than the supply side. Freeze damage is rare, corrosion is manageable, but sewer lines in older neighborhoods deal with persistent root pressure from the vegetation a marine climate supports.`,
    ],
    subarctic: [
      `${city}'s extreme cold requires plumbing systems engineered for prolonged sub-zero temperatures. All supply lines must be insulated and heat-traced, and main shutoff valves should be accessible for emergency winterization. Plumbing costs run 15-25% higher here than national averages due to the specialized materials and techniques required.`,
      `Plumbing in ${city} is a cold-weather engineering problem first and a household-water problem second. Heat-traced supply lines, Arctic-rated insulation, and shutoff accessibility all get specified tighter than in temperate climates, which drives the premium local labor rates reflect.`,
      `${city}'s subarctic climate means every exterior plumbing component has to be rated for prolonged deep cold. That includes hose bibs, buried supply lines, septic components, and even the insulation on interior lines routed through crawl spaces.`,
      `Installing and maintaining residential plumbing in ${city} costs more than most national benchmarks suggest because the climate demands specialized materials, buried depths, and heat-traced systems that simpler climates can skip entirely.`,
    ],
  };
  const pClimateArr = climateMap[ctx?.climateZone] || climateMap.mixed_humid;
  lines.push(pick(pClimateArr, seed));

  if (ctx?.avgHomeAge) {
    const age = ctx.avgHomeAge;
    if (age > 45) {
      lines.push(
        `With an average home age of ${age} years, many ${city} properties still have original galvanized steel or even cast iron drain lines. These materials have a 40-50 year lifespan, meaning widespread replacement is due across the city. A whole-house repipe to PEX or copper costs $4,000-$10,000 but eliminates the risk of catastrophic pipe failure and improves water pressure significantly.`
      );
    } else if (age > 30) {
      lines.push(
        `The average ${city} home is roughly ${age} years old, putting many original water heaters and supply line connections past their expected lifespan. Proactive replacement before failure avoids the 2-3x cost premium of emergency service and the water damage that often accompanies a burst pipe or failed water heater.`
      );
    } else {
      lines.push(
        `${city}'s relatively new housing stock (average ${age} years) means most homes have modern plumbing materials like PEX and PVC that should perform well for decades. The most common plumbing needs in newer homes are fixture upgrades, water heater replacement (at the 8-12 year mark), and drain cleaning from normal use.`
      );
    }
  }

  if (ctx?.snowLoad === "high" || ctx?.climateZone === "cold" || ctx?.climateZone === "very_cold") {
    lines.push(
      `Building codes in ${city} require water supply lines to be buried below the local frost line, which adds to both installation and repair costs for underground work. Sewer line repairs also require deeper excavation here than in warmer climates, making trenchless repair methods especially cost-effective when they are feasible.`
    );
  }

  if (facts?.soil) {
    lines.push(
      `Soil conditions in the ${city} area (${facts.soil.toLowerCase()}) directly affect sewer line longevity and repair costs. Certain soil types cause pipe settling and joint separation over time, while others can corrode specific pipe materials from the outside in. A sewer camera inspection ($150-$400) reveals the true condition of underground lines before problems surface inside the home.`
    );
  }

  if (ctx?.growthRate === "high") {
    lines.push(
      `${city}'s rapid growth has tightened the local plumber pool, which drives labor rates higher and extends wait times for non-emergency work. Scheduling routine maintenance and replacements during slower months (typically late fall and winter) helps both availability and pricing.`
    );
  }

  if (ctx?.hoaPrevalence === "high") {
    lines.push(
      `Many ${city} neighborhoods have HOA requirements that affect exterior plumbing work, particularly hose bib placement, water heater venting, and outdoor cleanout locations. Check your CC&Rs before scheduling work that involves any exterior-visible modifications.`
    );
  }

  return lines.join("\n\n");
}

function plumbingFAQs(city, state, ctx, facts) {
  const faqs = [];
  const seed = cityHash(city);

  if (ctx?.climateZone === "cold" || ctx?.climateZone === "very_cold") {
    faqs.push({
      q: `How do I prevent frozen pipes in ${city}?`,
      a: pick([
        `${city}'s cold winters put pipes in exterior walls, crawl spaces, and garages at risk. Insulate all exposed pipes with foam sleeves, install heat tape on vulnerable runs, keep cabinet doors open during extreme cold to let warm air reach under-sink pipes, and never set your thermostat below 55F even when away. If you are winterizing a vacant property, have a plumber drain the system and add antifreeze to traps.`,
        `Freeze prevention in ${city} starts with identifying vulnerable pipe locations: exterior walls, unheated crawl spaces, and attached garages. Foam pipe insulation and heat tape on exposed runs are the first line of defense. During cold snaps, open cabinet doors under sinks and keep the thermostat at 55F minimum, even when traveling. Vacant properties need a full winterization by a licensed plumber.`,
        `Frozen pipes are a major expense in ${city} and largely preventable. Wrap all exposed pipes in foam insulation, add heat tape to runs in unheated spaces, and maintain at least 55F indoor temperature through winter. Opening under-sink cabinets during extreme cold lets warm air circulate around supply lines. For properties that sit empty in winter, a professional drain-and-winterize service is essential.`,
        `In ${city}, burst pipes from freezing are among the costliest plumbing emergencies. Prevention measures: insulate exposed pipes with foam sleeves, install thermostat-controlled heat tape on vulnerable runs, keep cabinets under exterior-wall sinks open during cold snaps, and never let the thermostat drop below 55F. A plumber can winterize vacant properties by draining the system and protecting traps with antifreeze.`,
      ], seed),
    });
  } else if (ctx?.climateZone === "hot_dry" || ctx?.climateZone === "mixed_dry") {
    faqs.push({
      q: `Does ${city}'s hard water damage plumbing?`,
      a: pick([
        `Yes. Hard water in the ${city} area deposits mineral scale inside pipes, reduces water heater efficiency by 20-30%, and shortens fixture lifespan. A water softener ($1,500-$3,000 installed) or whole-house water conditioner addresses the problem at the source. Descaling your water heater annually adds 3-5 years to its lifespan. If you notice white buildup on faucets or reduced shower pressure, scale is the likely cause.`,
        `Hard water is one of the biggest plumbing issues in ${city}. Mineral deposits build up inside pipes and water heaters, cutting heater efficiency by 20-30% and shortening equipment life. A whole-house water softener ($1,500-$3,000) addresses it systemically. Annual water heater descaling extends tank life by 3-5 years. White residue on fixtures and declining water pressure are telltale signs.`,
        `${city}'s hard water absolutely affects plumbing systems. Scale accumulation reduces water heater efficiency by 20-30%, narrows pipe openings over time, and wears out fixtures faster than normal. Installing a water softener ($1,500-$3,000) eliminates the source problem. Between that and annual water heater flushing, you can add years of life to your entire plumbing system.`,
        `It does. The mineral content in ${city}'s water supply leaves calcium and magnesium deposits inside pipes, tanks, and fixtures. Water heaters lose 20-30% efficiency as scale builds on heating elements. Fixture aerators clog and valves stick. A whole-house softener ($1,500-$3,000 installed) prevents the buildup. Descale your water heater yearly to extend its life by 3-5 years.`,
      ], seed),
    });
  } else if (ctx?.hurricaneZone) {
    faqs.push({
      q: `How do I protect my plumbing during a hurricane in ${city}?`,
      a: pick([
        `Know your main water shutoff valve location and test it annually. During a hurricane warning, shut off the main if you evacuate. After the storm, do not use tap water until the boil-water advisory (if any) is lifted. Check for sewer backflow if flooding occurred. Consider installing a backflow preventer if your home does not already have one, which is increasingly required by code in ${city}.`,
        `Start by locating and testing your main water shutoff valve before hurricane season. If you evacuate, shut off the main to prevent contamination from line breaks. Post-storm, wait for the all-clear or boil-water advisory before using tap water. Sewer backflow is a real risk if flooding occurred; a backflow preventer valve ($300-$800 installed) provides protection and is increasingly mandated by ${city} code.`,
        `Hurricane prep for plumbing in ${city}: locate your main shutoff and test it works before storm season. Shut the main off if you leave during a hurricane warning. After the storm passes, avoid using tap water until authorities confirm safety. Check for sewer backflow damage if flooding reached your property. A backflow preventer is a worthwhile investment and becoming a code requirement locally.`,
        `Plumbing protection during ${city} hurricanes requires advance preparation. Test your main water shutoff valve annually so it works when needed. Close it before evacuating. After the storm, follow all boil-water advisories and inspect for sewer backflow if your area flooded. Installing a backflow preventer ($300-$800) is increasingly required by local code and protects against contaminated floodwater entering your home's pipes.`,
      ], seed),
    });
  } else {
    faqs.push({
      q: `How often should I have my plumbing inspected in ${city}?`,
      a: pick([
        `An annual plumbing inspection catches small issues before they become emergencies. In ${city}, pay special attention to water heater condition (they last 8-12 years), supply line connections under sinks (especially braided steel lines older than 10 years), and the main sewer line. A sewer camera inspection ($150-$400) every 3-5 years is worthwhile for homes older than 20 years.`,
        `Schedule a plumbing inspection at least once a year in ${city}. Focus areas: water heater condition (8-12 year typical life), flexible supply lines under sinks (replace braided steel lines after 10 years), and the main sewer line. For homes over 20 years old, a camera inspection of the sewer line ($150-$400) every 3-5 years catches problems before they surface inside.`,
        `Annual inspections are the standard recommendation for ${city} homes. Key things your plumber should check: water heater age and condition (failure typically comes at 8-12 years), supply line connections at every fixture, and drain performance. Homes older than 20 years benefit from a sewer camera inspection ($150-$400) every few years since underground lines deteriorate silently.`,
        `A yearly plumbing check in ${city} prevents the kind of surprises that cost thousands. The priority items: water heater (8-12 year lifespan, check anode rod and sediment), braided steel supply lines under sinks (replace after 10 years regardless of appearance), and main sewer line condition. Camera sewer inspections ($150-$400) every 3-5 years are standard practice for older homes.`,
      ], seed),
    });
  }

  faqs.push({
    q: `What should a plumbing quote include in ${city}?`,
    a: facts?.permits
      ? pick([
          `A complete ${city} plumbing quote should list: scope of work with specific fixtures and materials, labor hours, permit costs (${facts.permits.toLowerCase().includes("permit") ? "required for most work" : "check local requirements"}), cleanup and disposal, warranty terms, and the plumber's license number. Get three written quotes with matching scope before comparing prices.`,
          `Every ${city} plumbing quote should itemize scope of work, specific materials and brands, labor estimate, permit fees (${facts.permits.toLowerCase().includes("permit") ? "required for most work" : "check local requirements"}), disposal costs, and warranty coverage. Confirm the plumber's license number is listed. Compare three quotes with identical scope for an accurate price comparison.`,
          `In ${city}, a thorough plumbing quote includes: detailed work description, material specifications, labor hours, permitting costs (${facts.permits.toLowerCase().includes("permit") ? "required for most work" : "check local requirements"}), cleanup, warranty terms, and the contractor's license number. Always get three written quotes. The cheapest is not always the best value.`,
          `A ${city} plumbing quote worth considering will specify: exact scope, materials with brand names, hours of labor, permit fees (${facts.permits.toLowerCase().includes("permit") ? "required for most work" : "check local requirements"}), waste disposal, and warranty details. The plumber's license number should be on the document. Collect three quotes with matching scope to judge pricing fairly.`,
        ], seed + 1)
      : pick([
          `A professional plumbing quote in ${city} should itemize: labor hours, material costs and brands, permit fees if applicable, cleanup, and warranty terms. The quote should include the plumber's license number and proof of insurance. Get three written quotes for any job over $500 to ensure fair pricing.`,
          `Every ${city} plumbing quote should break down: labor, materials with brand names, permit fees where required, disposal, and warranty coverage. Verify the plumber's license number and insurance are documented. For any job over $500, three written quotes with identical scope give you a reliable pricing baseline.`,
          `In ${city}, a solid plumbing quote includes labor hours, specified materials and brands, any permit costs, cleanup and disposal fees, and warranty terms. The contractor's license and insurance should be listed. Get three quotes scoped identically to compare pricing fairly on jobs over $500.`,
          `A ${city} plumbing estimate should detail: scope of work, material specifications, labor costs, permit fees if needed, waste disposal, and warranty. Check that the plumber's license number and insurance are included. Compare three written quotes for any project over $500; make sure the scope matches across all three.`,
        ], seed + 1),
  });

  const seasonMap = {
    hot_humid: { best: "fall or winter", why: "demand drops after summer's peak water-heater season and before spring's outdoor plumbing projects" },
    hot_dry: { best: "fall or spring", why: "moderate temperatures make excavation work easier and contractor schedules are less congested" },
    cold: { best: "late spring or summer", why: "frozen ground complicates any excavation and emergency freeze calls dominate plumber schedules in winter" },
    very_cold: { best: "summer", why: "ground thaw allows sewer work and plumbers are not consumed by winter emergency freeze calls" },
    mixed_humid: { best: "early fall", why: "between summer water-heater demand and winter freeze calls" },
    mixed_dry: { best: "spring or fall", why: "moderate temperatures and lower demand than summer peak" },
    marine: { best: "late spring or early fall", why: "dry weather simplifies any excavation and contractor availability is better" },
    subarctic: { best: "mid-summer", why: "the brief window of thawed ground and accessible outdoor plumbing" },
  };
  const season = seasonMap[ctx?.climateZone] || seasonMap.mixed_humid;
  faqs.push({
    q: `When is the best time to schedule plumbing work in ${city}?`,
    a: pick([
      `For non-emergency plumbing in ${city}, schedule during ${season.best}, ${season.why}. Emergency calls cost 50-100% more than scheduled work, so replacing aging water heaters, supply lines, and fixtures proactively during off-peak months saves significantly versus waiting for a failure.`,
      `${city} homeowners should target ${season.best} for planned plumbing work. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}, which translates to better availability and pricing. Emergency service runs 50-100% more than scheduled jobs, so proactive replacement of aging equipment is the financially smarter path.`,
      `Plan your ${city} plumbing projects for ${season.best}. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}, and you avoid the emergency premium that adds 50-100% to the bill. Water heaters, supply lines, and fixtures nearing end-of-life are worth replacing on your schedule rather than theirs.`,
      `The sweet spot for scheduling plumbing in ${city} is ${season.best}. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}, meaning better contractor availability and fairer pricing. Since emergency plumbing runs 50-100% above scheduled rates, proactive maintenance during off-peak periods is a straightforward way to save.`,
    ], seed + 2),
  });

  return faqs;
}

// --- GARAGE DOOR TEMPLATES ---

function garageDoorParagraph(city, state, ctx, facts) {
  const lines = [];

  const climateMap = {
    cold: `Garage door performance in ${city} is heavily influenced by the cold winters. An insulated door (R-12 or higher) can keep an attached garage 20-30 degrees warmer than an uninsulated one, reducing heat loss to adjacent living spaces and preventing tools, paint, and stored items from freezing. Torsion springs also break more frequently in cold weather because metal becomes brittle below 20F.`,
    very_cold: `${city}'s extreme winter temperatures make garage door insulation and spring quality critical. An R-16 or R-18 door pays for the upgrade in energy savings within 3-5 years for attached garages. Spring breakage peaks during cold snaps because metal fatigue accelerates below 0F. Keep a spare spring on hand or consider a dual-spring system that remains functional if one spring fails.`,
    hot_humid: `In ${city}'s hot and humid climate, garage doors face accelerated weatherstrip deterioration, seal expansion, and potential corrosion on steel components. Choose galvanized or aluminum hardware for coastal or high-humidity areas. Proper ventilation or a vented bottom seal helps prevent mold and mildew buildup in the garage, which is a common complaint in this climate.`,
    hot_dry: `The intense UV exposure in ${city} is the primary enemy of garage doors. Painted surfaces fade faster, weatherstripping dries out and cracks, and plastic components degrade more quickly than in milder climates. UV-stabilized materials and light-colored finishes last significantly longer here. An insulated door (R-8 minimum) also reduces the solar heat gain that can push garage temperatures over 130F in summer.`,
    mixed_humid: `${city}'s four-season climate subjects garage doors to the full range of stresses: summer heat and humidity, winter cold, freeze-thaw cycling, and occasional severe storms. This means both insulation value and weatherseal quality matter more than in single-climate regions. Budget for weatherstrip replacement every 3-5 years.`,
    mixed_dry: `Garage doors in ${city} deal primarily with temperature swings and UV exposure. An insulated door moderates summer heat gain and winter heat loss. The dry climate means rust and corrosion are less of a concern than in humid regions, but UV damage to paint and weatherstripping requires attention.`,
    marine: `${city}'s mild marine climate is relatively easy on garage doors. The moderate temperatures mean insulation is less critical than in extreme climates. The main concern is moisture and salt air (in coastal areas), which can corrode steel hardware and tracks if not properly treated.`,
    subarctic: `Garage door selection in ${city} should prioritize maximum insulation (R-16 to R-18) and cold-rated spring systems. Standard extension springs fail at high rates in prolonged sub-zero conditions. Commercial-grade torsion springs and insulated polyurethane-core doors are the standard choice in this climate.`,
  };
  lines.push(climateMap[ctx?.climateZone] || climateMap.mixed_humid);

  if (ctx?.hurricaneZone) {
    lines.push(
      `${city} is in a hurricane exposure zone, which means building codes require wind-rated garage doors. A standard door will fail under hurricane-force winds, and the resulting pressure change can lift the entire roof structure. Wind-rated doors cost 20-40% more but are required by code and may lower your insurance premium. If your current door is not wind-rated, upgrading it is one of the most cost-effective storm protection investments you can make.`
    );
  }

  if (ctx?.avgHomeAge) {
    const age = ctx.avgHomeAge;
    if (age > 30) {
      lines.push(
        `Many ${city} homes (average age ${age} years) have garage doors and openers that predate modern safety standards. Openers installed before 1993 may lack auto-reverse sensors, which are now required by federal law. If your opener does not have photo-eye sensors at the base of the door, replace the opener regardless of whether it still functions since this is a serious safety and liability issue.`
      );
    } else if (age > 15) {
      lines.push(
        `With an average home age of ${age} years, many ${city} garage doors are approaching the midpoint of their expected lifespan. Springs typically need replacement at the 7-12 year mark, and openers at 10-15 years. Proactive replacement avoids the inconvenience of a door that will not open on a Monday morning.`
      );
    }
  }

  if (ctx?.hoaPrevalence === "high") {
    lines.push(
      `HOA restrictions in many ${city} neighborhoods dictate garage door style, color, and sometimes material. Before ordering a replacement door, get your HOA's architectural guidelines in writing and submit your selection for approval. Retroactive violations can result in fines and forced replacement at your expense.`
    );
  }

  if (ctx?.growthRate === "high") {
    lines.push(
      `${city}'s fast-growing market means garage door installers stay busy, particularly during spring and fall. Schedule your replacement 2-4 weeks in advance and request a firm installation date in writing to avoid delays.`
    );
  }

  return lines.join("\n\n");
}

function garageDoorFAQs(city, state, ctx, facts) {
  const faqs = [];
  const seed = cityHash(city);

  if (ctx?.climateZone === "cold" || ctx?.climateZone === "very_cold") {
    faqs.push({
      q: `What R-value garage door do I need in ${city}?`,
      a: pick([
        `For ${city}'s cold winters, an R-12 to R-16 insulated door is recommended for attached garages. If you heat your garage or use it as a workshop, step up to R-16 or R-18. The extra $200-$500 for higher insulation pays back in 3-5 years through reduced heating costs in adjacent rooms and prevents freezing issues with items stored in the garage.`,
        `${city}'s winters demand serious insulation. An R-12 to R-16 door is the baseline for attached garages, with R-16 to R-18 recommended if you use the space as a workshop or heat it. The $200-$500 upgrade cost pays back through lower heating bills in rooms adjacent to the garage within 3-5 years.`,
        `Insulation ratings of R-12 to R-16 are standard for ${city}'s climate on attached garages. Heated garages or workshops should use R-16 or R-18 doors for meaningful energy savings. The incremental cost of $200-$500 for better insulation typically returns through reduced heating costs in 3-5 years, plus you avoid frozen paint, liquids, and other garage-stored items.`,
        `In ${city}, the minimum practical insulation for an attached garage door is R-12, with R-16 being the better choice for most homeowners. Workshop or heated-garage applications should go R-16 to R-18. That extra $200-$500 investment recovers through energy savings in adjacent living spaces within a few years and keeps the garage itself above freezing through winter.`,
      ], seed),
    });
  } else if (ctx?.hurricaneZone) {
    faqs.push({
      q: `Do I need a wind-rated garage door in ${city}?`,
      a: pick([
        `Yes. ${city} building code requires wind-rated garage doors that can withstand hurricane-force pressures. A non-rated door is the most common point of structural failure during a hurricane since the garage opening is the largest unbraced span in most homes. Wind-rated doors cost $300-$800 more than standard doors and may qualify for insurance discounts. If your current door is not wind-rated, an upgrade is strongly recommended.`,
        `Absolutely. ${city}'s hurricane-zone building code mandates wind-rated garage doors. The garage opening is typically the weakest structural point in a home during high winds. When a non-rated door fails, the resulting pressure change can lift the roof. Wind-rated options cost $300-$800 more and often qualify for insurance premium reductions that offset the added cost.`,
        `Wind-rated doors are required by code in ${city}'s hurricane zone, not optional. The garage door is the largest opening in most homes and the most likely point of failure during a hurricane. A standard door failing under wind load can cause cascading structural damage. Rated doors add $300-$800 to the cost but meet code requirements and may reduce your insurance premium.`,
        `${city} building code requires it, and for good reason. A garage door is the biggest unbraced span in most homes, and a standard door failure during a hurricane creates internal pressure that can blow off the roof. Wind-rated doors handle 130+ mph loads and cost $300-$800 more than standard options. Many ${state} insurers offer discounts for wind-rated installations.`,
      ], seed),
    });
  } else if (ctx?.climateZone === "hot_humid" || ctx?.climateZone === "hot_dry") {
    faqs.push({
      q: `How do I keep my garage cool in ${city}?`,
      a: pick([
        `An insulated garage door (R-8 minimum) blocks radiant heat and can keep garage temperatures 10-20 degrees cooler than an uninsulated door. Light-colored doors reflect more heat than dark ones. Adding a radiant barrier to the ceiling and ensuring the weatherstrip seals tightly at the floor and sides also help. If you use the garage as a workspace, a ventilation fan or mini-split adds comfort without the cost of insulating the entire garage envelope.`,
        `Start with an insulated door rated R-8 or higher, which drops garage temperatures 10-20 degrees versus uninsulated panels. Choose a light color to reflect solar heat. A radiant barrier on the ceiling helps further. For workspace use, a small ventilation fan or ductless mini-split provides real comfort without the expense of fully insulating the garage structure.`,
        `Garage cooling in ${city} starts with the door: an R-8+ insulated model reduces interior temps by 10-20 degrees compared to uninsulated steel. Light-colored finishes reflect more heat. Beyond the door, a radiant barrier on the garage ceiling and tight weatherstrip seals make a noticeable difference. For regular workspace use, add a ventilation fan or mini-split rather than insulating the entire garage envelope.`,
        `The single biggest improvement is an insulated garage door, R-8 minimum. It cuts garage temperatures by 10-20 degrees versus bare steel. Light colors reflect heat better than dark ones. Tight weatherstripping keeps cool air in and hot air out. A ceiling radiant barrier adds another layer of protection. For workspace comfort, a ventilation fan or mini-split is more cost-effective than full garage insulation.`,
      ], seed),
    });
  } else {
    faqs.push({
      q: `How often should I maintain my garage door in ${city}?`,
      a: pick([
        `Lubricate all moving parts (hinges, rollers, springs, tracks) with silicone spray twice a year. Test the auto-reverse by placing a 2x4 under the door -- it should reverse within 2 seconds of contact. Check weatherstripping for gaps and cracks annually. Tighten all hardware since vibration loosens bolts over time. A professional tune-up ($100-$200) every 2-3 years catches worn parts before they fail.`,
        `Twice-yearly lubrication of springs, hinges, rollers, and tracks with silicone spray keeps the mechanism running smoothly. Test the safety auto-reverse with a 2x4 under the door at least annually. Inspect weatherstripping for wear, and tighten all mounting hardware since door vibration loosens bolts gradually. Budget $100-$200 for a professional tune-up every 2-3 years.`,
        `Basic maintenance twice a year keeps your ${city} garage door running safely. Apply silicone spray to all moving parts, test the auto-reverse safety feature with a board under the door, and inspect weatherstrip seals for damage. Vibration from daily use loosens hardware over time, so tighten bolts and brackets as part of the routine. Professional servicing every 2-3 years ($100-$200) catches spring fatigue and roller wear early.`,
        `A simple twice-yearly routine covers most garage door maintenance: silicone spray on hinges, rollers, springs, and tracks, plus a safety auto-reverse test using a 2x4 on the ground. Check weatherstripping annually and tighten any loose hardware. Every 2-3 years, a professional tune-up ($100-$200) identifies worn springs, fraying cables, or bearing problems before they cause a failure.`,
      ], seed),
    });
  }

  faqs.push({
    q: `Should I repair or replace my garage door in ${city}?`,
    a: ctx?.avgHomeAge > 25
      ? pick([
          `For ${city} homes averaging ${ctx.avgHomeAge} years old, replacement is often the better investment if the door is original. A new insulated door with a modern opener costs $1,200-$3,000 and recovers 90-100% of its cost at resale. Repair makes sense for newer doors with localized damage (single panel, one spring, or opener motor replacement) when the rest of the system is sound.`,
          `With ${city} homes averaging ${ctx.avgHomeAge} years, many still have original garage doors past their useful life. A full replacement ($1,200-$3,000 with a new opener) typically returns 90-100% at resale. Repair is worth it only for newer doors with isolated issues like a single broken spring, damaged panel, or failing opener motor. If the door is original to the house, replacement is the better investment.`,
          `Given that ${city} homes average ${ctx.avgHomeAge} years old, many original garage doors are due for replacement rather than repair. A new insulated door and modern opener runs $1,200-$3,000 and recoups 90-100% at resale. Repairs make financial sense for doors under 15 years old with specific damage, but throwing money at an aging system usually delays an inevitable replacement.`,
          `Most original garage doors in ${city}'s ${ctx.avgHomeAge}-year-average housing stock have exceeded their useful life. Replacing with a new insulated door and opener ($1,200-$3,000) is typically the smarter investment, recovering 90-100% of the cost at resale. Repair only makes sense for newer doors with isolated issues like a single panel or spring replacement.`,
        ], seed + 1)
      : pick([
          `Repair if the damage is limited to one or two panels, a single spring, or the opener mechanism. Replace when the door is over 15 years old, panels are discontinued, the door lacks insulation you want, or you are planning to sell. A garage door replacement recovers 90-100% of its cost at resale, making it one of the highest-ROI home improvements available.`,
          `The repair-vs-replace decision comes down to scope and age. One broken spring, a single damaged panel, or a failing opener motor are all cost-effective repairs. But if the door is 15+ years old, panels are discontinued, or you want features like insulation, replace the whole unit. Garage door replacement returns 90-100% at resale, one of the best ROI home improvements.`,
          `Repair makes financial sense for isolated damage: a broken spring, one or two panels, or an opener malfunction. Replace when the door exceeds 15 years, replacement panels are unavailable, you want insulation you do not currently have, or you are preparing to sell. Full replacement ($1,200-$3,000) recovers 90-100% at resale.`,
          `If the issue is a single spring, one panel, or the opener, repair is usually the right call. Replace when the door is past 15 years, parts are discontinued, or you want modern features like insulation or smart-home connectivity. Garage door replacement is among the highest-ROI home improvements at 90-100% cost recovery at sale.`,
        ], seed + 1),
  });

  const seasonMap = {
    hot_humid: { best: "fall or winter", why: "cooler weather makes the installation more comfortable and demand is lower" },
    hot_dry: { best: "fall or spring", why: "extreme summer heat makes installation challenging and slows down production" },
    cold: { best: "late spring or early fall", why: "moderate temperatures allow proper weatherstrip sealing and caulk curing" },
    very_cold: { best: "summer", why: "materials install best in moderate temperatures and you avoid the spring rush after winter spring breakages" },
    mixed_humid: { best: "early fall", why: "stable weather and lower demand than the spring home-improvement rush" },
    mixed_dry: { best: "spring or fall", why: "moderate temperatures and lower demand" },
    marine: { best: "spring or early fall", why: "dry conditions for proper weatherstrip adhesion" },
    subarctic: { best: "mid-summer", why: "the only window with consistently workable outdoor temperatures" },
  };
  const season = seasonMap[ctx?.climateZone] || seasonMap.mixed_humid;
  faqs.push({
    q: `When is the best time to replace a garage door in ${city}?`,
    a: pick([
      `Schedule your ${city} garage door replacement for ${season.best}, ${season.why}. Off-peak timing can save 5-10% on installation costs and gets you a wider selection of available styles and colors. Spring is the busiest season for garage door companies since broken springs peak after winter cold stress.`,
      `For ${city}, target ${season.best} for your garage door replacement. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}, and off-peak scheduling often means 5-10% savings on installation. Spring is the peak rush since cold weather causes spring failures that flood installers with emergency calls.`,
      `The ideal window for a ${city} garage door replacement is ${season.best}. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}, plus you get access to a wider range of styles and colors. Avoid spring if you can, since that is when winter-related spring breakages create peak demand and longer wait times.`,
      `${city} homeowners get the best pricing and selection by scheduling garage door replacement during ${season.best}. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}, and you can save 5-10% versus peak season pricing. Spring demand surges from cold-weather spring failures, so plan ahead to avoid the rush.`,
    ], seed + 2),
  });

  return faqs;
}

// --- FENCING TEMPLATES ---

function fenceParagraph(city, state, ctx, facts) {
  const lines = [];

  const climateMap = {
    cold: `Fence installation in ${city} requires cold-climate construction methods. Post holes must extend below the local frost line (typically 36-48 inches) to prevent heaving, and concrete footings need time to cure before freezing temperatures arrive. Wood species selection matters more here since pressure-treated southern pine handles freeze-thaw cycling well, while cedar provides natural rot resistance without the chemical treatment.`,
    very_cold: `${city}'s extreme winters are the defining factor in fence longevity. Posts must be set well below the frost line (often 48 inches or deeper), and the ground freezes too hard for installation during winter months. Plan your fence project for the brief construction season between ground thaw and first freeze. Metal fences handle the temperature extremes better than wood, though all materials need proper installation to survive the cyclical expansion and contraction.`,
    hot_humid: `Fencing in ${city}'s hot, humid climate faces two persistent enemies: moisture rot and termites. Untreated wood fences can begin rotting within 3-5 years if ground contact is not properly managed. Pressure-treated lumber, composite materials, or aluminum/vinyl avoid these problems entirely. If you choose wood, raising the bottom of the fence 2 inches above grade allows air circulation that dramatically slows rot.`,
    hot_dry: `The primary challenge for fences in ${city} is UV degradation and dry heat. Wood fences shrink, crack, and warp in low-humidity conditions, and stain or sealant breaks down faster than national averages suggest. Cedar and redwood handle the dry climate better than pine. Vinyl and composite materials resist UV fading but can become brittle over many years of intense sun exposure.`,
    mixed_humid: `${city}'s climate subjects fences to the full spectrum of weathering: summer heat and humidity promote rot and insect activity, while winter freeze-thaw cycling stresses post footings and joints. This combination means material quality and installation depth matter more than in single-climate regions. Budget for staining or sealing every 2-3 years to maximize the lifespan of any wood fence.`,
    mixed_dry: `Fences in ${city} deal primarily with UV exposure and temperature swings. Wood dries out and cracks without regular sealing. Metal fences perform well but need rust-resistant coatings. Vinyl is popular here because it handles the dry climate and UV exposure better than wood without any maintenance.`,
    marine: `${city}'s marine climate provides moderate conditions for fencing, though the moisture and occasional wind exposure can accelerate wear on untreated wood. Cedar performs exceptionally well in this climate due to its natural moisture resistance. Expect fences to last near the upper end of their projected lifespan in this relatively gentle environment.`,
    subarctic: `Fence construction in ${city} requires deep post holes (48+ inches) and a narrow installation window limited to summer months. Metal fences endure the extreme cold better than wood, which undergoes severe expansion-contraction cycling. Chain link is the most cost-effective option for this climate since it offers zero wind resistance and handles ground movement well.`,
  };
  lines.push(climateMap[ctx?.climateZone] || climateMap.mixed_humid);

  if (ctx?.hoaPrevalence === "high") {
    lines.push(
      `HOA restrictions are a major factor in ${city} fence decisions. Many associations limit fence height (often 4 feet in front, 6 feet in back), dictate acceptable materials (vinyl or wrought iron only, no chain link), specify color options, and require the "finished side" to face outward. Some HOAs require architectural review board approval before installation begins. Get the rules in writing and approval before ordering materials to avoid costly do-overs.`
    );
  } else if (ctx?.hoaPrevalence === "moderate") {
    lines.push(
      `Some ${city} neighborhoods have HOA fence restrictions. If your property is in a managed community, check the CC&Rs for height limits, material restrictions, and color requirements before committing to a design. Even without an HOA, most ${city} zoning codes restrict front-yard fence height to 3-4 feet.`
    );
  }

  if (facts?.soil) {
    lines.push(
      `The soil in the ${city} area (${facts.soil.toLowerCase()}) affects fence post installation and longevity. Clay soils heave during freeze-thaw and retain moisture that accelerates post rot. Sandy soils drain well but provide less post stability. Rocky soils increase post hole excavation costs significantly. Your installer should adjust footing depth and concrete volume based on the specific soil conditions on your property.`
    );
  }

  if (ctx?.hurricaneZone) {
    lines.push(
      `As a hurricane-exposure area, ${city} homeowners should consider wind resistance when choosing a fence style. Solid privacy fences act as sails in high winds and are more likely to fail. Shadow-box or spaced-picket designs allow wind to pass through while still providing partial privacy. Post spacing of 6 feet (instead of 8) with deeper footings adds meaningful wind resistance.`
    );
  }

  if (ctx?.avgHomeAge > 35) {
    lines.push(
      `Many ${city} properties (average home age ${ctx.avgHomeAge} years) have aging or deteriorated fences that predate current building codes. Replacement often requires updated post depth, property line verification, and sometimes a survey to confirm boundaries before new fence construction begins. Budget $300-$600 for a property survey if boundary markers are not clearly visible.`
    );
  }

  return lines.join("\n\n");
}

function fenceFAQs(city, state, ctx, facts) {
  const faqs = [];
  const seed = cityHash(city);

  if (ctx?.hoaPrevalence === "high") {
    faqs.push({
      q: `What fence types does my ${city} HOA allow?`,
      a: pick([
        `HOA restrictions in ${city} vary by community, but common rules include: maximum 6 feet in backyard and 4 feet in front yard, no chain link, "finished side" must face outward, approved colors only (usually earth tones or white), and architectural review board approval required before installation. Contact your HOA management company for the current architectural guidelines and submit your design for approval before ordering materials or signing a contract.`,
        `Every ${city} HOA has its own fence rules, but typical restrictions include height limits (6 feet backyard, 4 feet front), material restrictions (no chain link is common), color requirements (earth tones or white), and mandatory outward-facing finished sides. You will usually need architectural review board approval before installation begins. Get the current guidelines from your HOA management company and submit your design before committing to materials.`,
        `${city} HOAs commonly restrict fence height to 6 feet in rear yards and 4 feet in front, ban chain link, require the finished side to face neighbors, and limit color choices to earth tones or white. Most require pre-approval from an architectural review board. Request the current architectural guidelines from your HOA management before selecting materials or signing an installation contract.`,
        `Start by requesting your ${city} HOA's architectural guidelines before making any fence decisions. Common restrictions: 6-foot maximum in backyards, 4 feet in front, no chain link, finished side facing outward, and approved colors only. Many communities require formal architectural review board approval. Installing without approval can result in fines and forced removal at your expense.`,
      ], seed),
    });
  } else if (ctx?.climateZone === "hot_humid") {
    faqs.push({
      q: `What fence material lasts longest in ${city}'s climate?`,
      a: pick([
        `In ${city}'s hot, humid climate, vinyl and aluminum fences outlast wood by 10-15 years because they are immune to rot, termites, and moisture damage. If you prefer the look of wood, use pressure-treated pine or cedar and plan on staining or sealing every 2-3 years. Composite fencing offers a wood-like appearance with vinyl-like durability at a price point between the two.`,
        `Vinyl and aluminum are the longevity champions in ${city}'s humid conditions, outlasting wood by 10-15 years since they resist rot, termites, and moisture damage entirely. Wood fence lovers should choose pressure-treated pine or cedar and commit to staining or sealing every 2-3 years. Composite materials split the difference with wood aesthetics and near-vinyl durability.`,
        `${city}'s humidity and heat are hard on wood fences. Vinyl and aluminum fences last 10-15 years longer because they do not rot, attract termites, or absorb moisture. If wood is your preference, pressure-treated pine or cedar hold up best but require staining or sealing every 2-3 years. Composite fencing is a middle-ground option that looks like wood but handles the humidity like vinyl.`,
        `For maximum lifespan in ${city}'s climate, vinyl and aluminum fences are the clear winners, lasting 10-15 years longer than wood due to immunity from rot, termites, and moisture. Cedar and pressure-treated pine are the best wood options but need sealing every 2-3 years. Composite fencing offers wood-grain appearance with weather resistance closer to vinyl.`,
      ], seed),
    });
  } else if (ctx?.climateZone === "cold" || ctx?.climateZone === "very_cold") {
    faqs.push({
      q: `How deep should fence posts be in ${city}?`,
      a: pick([
        `In ${city}'s cold climate, fence posts should extend at least 6 inches below the frost line to prevent heaving. For most of ${city}, this means 36-48 inches deep with 8-10 inches of compacted gravel at the bottom for drainage and concrete from there to grade. Shallow posts in freeze-prone areas will lean within 2-3 winters regardless of how well the rest of the fence is built.`,
        `Frost heave is the main threat to fence posts in ${city}. Posts need to reach at least 6 inches below the local frost line, typically 36-48 inches total depth. Use 8-10 inches of compacted gravel at the bottom for drainage, then concrete to grade. Cutting depth to save cost is a false economy since shallow posts in ${city} start leaning within 2-3 winters.`,
        `${city}'s freeze-thaw cycling will push shallow fence posts out of the ground within a couple of winters. Set posts 36-48 inches deep, at least 6 inches past the frost line. Bottom the hole with 8-10 inches of compacted gravel for drainage, then fill with concrete to grade. There is no shortcut on depth in this climate; it is the single most important factor in long-term fence stability.`,
        `Post depth is the most critical installation detail in ${city}. The frost line here requires a minimum of 36-48 inches deep, extending at least 6 inches below frost depth. Proper technique: 8-10 inches of gravel base for drainage, concrete fill to grade. Posts set shallower than the frost line will heave and lean regardless of material quality or how well the fence itself is built.`,
      ], seed),
    });
  } else {
    faqs.push({
      q: `How long does a wood fence last in ${city}?`,
      a: pick([
        `In ${city}'s climate, a properly installed and maintained pressure-treated fence lasts 15-20 years. Cedar lasts 15-25 years. Untreated pine may only last 5-8 years. Staining or sealing every 2-3 years and keeping vegetation trimmed away from the base are the two most effective ways to extend your fence's lifespan.`,
        `Wood fence lifespan in ${city}: pressure-treated pine lasts 15-20 years with maintenance, cedar 15-25, and untreated pine just 5-8. The two things that extend life most are regular staining or sealing (every 2-3 years) and keeping plants and soil cleared from the bottom of the fence to promote air circulation and reduce moisture contact.`,
        `Expect 15-20 years from pressure-treated wood in ${city}, 15-25 from cedar, and only 5-8 from untreated pine. Consistent maintenance makes the difference between the low and high end of those ranges. Stain or seal every 2-3 years, and keep grass, vines, and mulch away from the base to slow ground-level rot.`,
        `A well-maintained pressure-treated fence lasts 15-20 years in ${city}. Cedar holds up even longer at 15-25 years thanks to natural rot resistance. Untreated pine deteriorates quickly, typically just 5-8 years. The two highest-impact maintenance habits: apply stain or sealant every 2-3 years, and trim vegetation away from the fence base to prevent moisture buildup.`,
      ], seed),
    });
  }

  faqs.push({
    q: `Do I need a permit to build a fence in ${city}?`,
    a: facts?.permits
      ? pick([
          `In ${city}, ${facts.permits.toLowerCase().includes("permit") ? "permits are generally required for fence installation" : "check with the local building department about fence permits"}. Most jurisdictions require permits for fences over 6 feet tall, and some require them for any fence. You must also call 811 for utility locates before digging post holes, and verify property lines before building on or near the boundary. Your fence contractor should handle the permit process.`,
          `${city} ${facts.permits.toLowerCase().includes("permit") ? "requires permits for fence installation in most cases" : "may require permits depending on fence height and location"}. Permits are standard for fences over 6 feet, and some areas require them for any fence. Before digging, call 811 for utility locates and confirm property lines. A professional fence contractor should manage the permitting as part of the job.`,
          `Fence permits in ${city}: ${facts.permits.toLowerCase().includes("permit") ? "generally required" : "check local requirements"}. Most areas mandate permits for fences above 6 feet, with some requiring them for any height. Two non-negotiable steps before digging: call 811 to mark utilities and verify property lines. Your contractor should handle all permit paperwork.`,
          `${facts.permits.toLowerCase().includes("permit") ? "Yes, fence permits are typically required in " + city : "Check with the " + city + " building department about fence permits"}. Fences over 6 feet almost always need one, and shorter fences may as well. Always call 811 for utility locates before any post hole digging, and verify your property lines to avoid building on a neighbor's land. The contractor should manage permitting.`,
        ], seed + 1)
      : pick([
          `Most ${city} jurisdictions require permits for fences, especially those over 6 feet. Check with your local building department before starting. You must call 811 for utility locates before digging, verify property lines (consider a survey if boundaries are unclear), and check any HOA rules. Your contractor should handle permitting as part of the project.`,
          `Fence permits are required in most ${city} jurisdictions, particularly for heights over 6 feet. Before breaking ground: call 811 for utility locates, verify property lines (a survey costs $300-$600 if boundaries are unclear), and check HOA requirements. A professional contractor handles the permit process as part of the project.`,
          `Check with ${city}'s building department, but permits are generally required for fences, especially those above 6 feet. Before digging post holes, you need utility locates (call 811) and confirmed property lines. If boundaries are uncertain, a survey ($300-$600) prevents expensive neighbor disputes. Your contractor should pull the permit.`,
          `In ${city}, fence permits are standard for installations over 6 feet and sometimes required for any fence. Three things to handle before installation: call 811 for utility marking, confirm property boundaries (budget $300-$600 for a survey if needed), and review any HOA rules. The fence contractor should manage the permitting as part of the project scope.`,
        ], seed + 1),
  });

  faqs.push({
    q: `How much does fence installation cost per foot in ${city}?`,
    a: ctx?.growthRate === "high"
      ? pick([
          `In ${city}'s growing market, fence installation runs $20-$35 per linear foot for wood privacy, $25-$45 for vinyl, $15-$25 for chain link, and $30-$60 for aluminum or wrought iron. Labor costs trend higher here due to strong contractor demand. Getting 3 quotes is essential since pricing variance tends to be wider in high-growth markets.`,
          `${city}'s rapid growth pushes fence installation costs higher than national averages: $20-$35/ft for wood privacy, $25-$45 for vinyl, $15-$25 for chain link, and $30-$60 for ornamental metal. Strong contractor demand drives labor rates up. Get at least 3 quotes since pricing spreads wider in fast-growing markets.`,
          `Fence costs in ${city}'s growing market run: wood privacy $20-$35 per linear foot, vinyl $25-$45, chain link $15-$25, and aluminum or wrought iron $30-$60. High contractor demand means labor costs trend above national averages. With wider pricing variance in growth markets, getting 3 quotes with identical scope is essential for a fair comparison.`,
          `Expect to pay $20-$35/ft for wood privacy fencing in ${city}, $25-$45 for vinyl, $15-$25 for chain link, and $30-$60 for aluminum or wrought iron. ${city}'s growth drives contractor demand and labor rates above average. The pricing spread between contractors tends to be wider here, so compare at least 3 quotes before choosing.`,
        ], seed + 2)
      : pick([
          `Fence installation in ${city} typically costs $15-$30 per linear foot for wood privacy, $20-$40 for vinyl, $10-$20 for chain link, and $25-$55 for aluminum or wrought iron. A 150 linear foot backyard fence runs $2,250-$6,000 depending on material. Getting 3 quotes with matching scope ensures fair pricing.`,
          `${city} fence installation rates: wood privacy $15-$30/ft, vinyl $20-$40, chain link $10-$20, and ornamental metal $25-$55. For a typical 150 linear foot backyard, that works out to $2,250-$6,000 depending on material choice. Three quotes with identical scope give you a reliable pricing range.`,
          `Per-foot costs for fence installation in ${city}: wood privacy $15-$30, vinyl $20-$40, chain link $10-$20, and aluminum or wrought iron $25-$55. A standard 150-foot backyard fence runs $2,250-$6,000 total. Always compare 3 quotes with the same scope and materials to ensure you are getting fair pricing.`,
          `In ${city}, budget $15-$30 per linear foot for wood privacy fencing, $20-$40 for vinyl, $10-$20 for chain link, and $25-$55 for aluminum or wrought iron. A 150 linear foot backyard project totals $2,250-$6,000 depending on material. Collect 3 written quotes scoped identically to compare apples to apples.`,
        ], seed + 2),
  });

  return faqs;
}

// --- SOLAR TEMPLATES ---

function solarParagraph(city, state, ctx, facts) {
  const lines = [];

  const climateMap = {
    hot_dry: `${city}'s abundant sunshine makes it one of the best locations in the country for residential solar. High daily insolation values mean panels here produce 15-25% more electricity per kilowatt than the national average. The dry climate also means minimal cloud-cover losses and less panel soiling from rain-carried debris. The main design consideration is managing panel temperature, since efficiency drops as panels heat above 77F.`,
    hot_humid: `Solar performs well in ${city} despite the humidity and occasional cloud cover. While not as productive per panel as desert climates, the high cooling loads and rising electricity rates in this region make solar financially attractive. Panels need cleaning 1-2 times per year since humidity promotes algae and pollen buildup that reduces output by 5-10% if neglected.`,
    cold: `Solar is viable and increasingly popular in ${city} despite the cold winters. Panels actually produce electricity more efficiently in cold temperatures, partially offsetting shorter winter days. Snow cover is a factor but panels are installed at an angle that sheds most snow within a day or two. Annual production is lower than sunbelt cities, but ${state}'s electricity rates and available incentives often make the economics work.`,
    very_cold: `While ${city}'s harsh winters and shorter days reduce annual solar production compared to southern cities, the economics can still work. Panels produce power more efficiently in cold air, net metering policies bank summer surplus for winter use, and electricity rates in cold-climate states tend to be higher. Snow shedding is a real concern -- steeper panel tilt angles and snow guards help minimize production losses.`,
    mixed_humid: `${city} gets enough sun for solar to be a solid investment, especially given rising electricity rates in the region. Cloud cover reduces production compared to desert locations, but the combination of reasonable insolation, available incentives, and moderate-to-high utility rates typically yields a 7-10 year payback. Panel orientation matters more here since even partial shading from clouds has an outsized impact on string inverter systems.`,
    mixed_dry: `${city}'s mix of ample sunshine and moderate electricity rates makes solar a strong value proposition. The dry climate means panels stay cleaner and produce closer to their rated output year-round. Semi-arid areas also tend to have less shading from dense tree canopy, giving more homes viable roof space for solar.`,
    marine: `${city}'s marine climate presents a mixed picture for solar. Cloud cover and rain are frequent, reducing annual production below sunbelt averages. However, the long summer days and relatively high electricity rates in this region often make the investment worthwhile. Microinverters are strongly recommended here since they handle the partial-cloud conditions better than string inverters, recovering 10-15% more energy in variable-shade conditions.`,
    subarctic: `Solar production in ${city} is concentrated heavily in the long summer days, with minimal winter output. The economics depend entirely on net metering policies and local electricity rates. If your utility offers full retail net metering, summer surplus can offset winter grid purchases, making the investment work despite the extreme seasonal variation.`,
  };
  lines.push(climateMap[ctx?.climateZone] || climateMap.mixed_humid);

  if (ctx?.hurricaneZone) {
    lines.push(
      `${city}'s hurricane exposure adds a design consideration: panel racking systems must be rated for high-wind loads, and some insurers require specific mounting certifications. Wind-rated racking adds $500-$1,500 to installation cost but is required by building code. Verify that your installer uses racking certified for the wind speed zone applicable to your location and that the installation is permitted and inspected.`
    );
  }

  if (ctx?.avgHomeAge) {
    const age = ctx.avgHomeAge;
    if (age > 25) {
      lines.push(
        `With an average home age of ${age} years in ${city}, roof condition assessment is critical before any solar installation. Panels last 25-30 years, so if your roof has less than 15 years of remaining life, replace it before installing solar. Removing panels for a roof replacement later costs $1,500-$3,000 in de-install and reinstall labor. Most reputable solar companies include a roof assessment in their site survey.`
      );
    } else {
      lines.push(
        `${city}'s relatively new housing stock (average ${age} years) means most roofs have enough remaining life to outlast the solar panel warranty. Newer construction also tends to have roof structures engineered for higher loads, making panel support less of a concern during the engineering review.`
      );
    }
  }

  if (ctx?.hoaPrevalence === "high") {
    lines.push(
      `While many states have solar access laws that prevent HOAs from outright banning panels, ${city} HOAs can still regulate placement, angle, and visibility from the street. Submit your solar plan to the architectural review board early in the process. Delays in HOA approval are the most common non-technical reason solar installations stall.`
    );
  }

  if (ctx?.snowLoad === "high") {
    lines.push(
      `Snow is a real production factor in ${city}. Panels installed at steeper tilt angles (35-45 degrees) shed snow faster, and snow guards prevent dangerous sheet slides. Most installers in this region account for snow load in their structural engineering, but confirm that your racking system is rated for ${city}'s ground snow load requirements.`
    );
  }

  if (ctx?.growthRate === "high") {
    lines.push(
      `${city}'s rapid growth often strains the local utility grid, which can strengthen the case for solar-plus-battery systems. Time-of-use rate structures are increasingly common in growing markets, and solar production aligns well with peak-rate afternoon hours, maximizing the bill offset.`
    );
  }

  return lines.join("\n\n");
}

function solarFAQs(city, state, ctx, facts) {
  const faqs = [];
  const seed = cityHash(city);

  if (ctx?.climateZone === "cold" || ctx?.climateZone === "very_cold") {
    faqs.push({
      q: `Does solar work in ${city}'s cold winters?`,
      a: pick([
        `Yes. Solar panels are actually more electrically efficient in cold temperatures. While shorter winter days reduce daily production, summer's long days generate surplus that net metering banks for winter credit. Snow typically slides off angled panels within 1-2 days. Annual production in ${city} is lower than sunbelt cities, but higher electricity rates and available incentives often make the financial case comparable.`,
        `Solar works well in ${city} despite the cold. Panels convert sunlight more efficiently at lower temperatures, partially offsetting shorter winter days. Net metering lets you bank summer overproduction as credits for winter months. Snow sheds from angled panels within a day or two in most cases. Higher local electricity rates and available incentives often make the payback comparable to warmer markets.`,
        `Cold weather actually improves solar panel efficiency since photovoltaic cells perform better at lower temperatures. ${city}'s shorter winter days reduce seasonal output, but net metering lets you bank summer surplus for winter use. Snow typically clears from tilted panels within 1-2 days. Between higher electricity rates and incentive programs, the financial return in ${city} often matches sunbelt installations.`,
        `${city} homeowners are sometimes surprised to learn that solar panels produce electricity more efficiently in cold temperatures. While winter days are shorter, net metering banks your summer surplus as credit. Snow slides off angled panels quickly, usually within a day. Annual production is lower than desert climates, but stronger incentives and higher electricity rates in cold-climate markets often deliver comparable payback periods.`,
      ], seed),
    });
  } else if (ctx?.climateZone === "hot_dry") {
    faqs.push({
      q: `How much solar energy can I produce in ${city}?`,
      a: pick([
        `${city}'s high insolation makes it one of the best solar markets in the country. A typical 8kW system produces 12,000-14,000 kWh annually here, compared to 9,000-11,000 kWh in average U.S. climates. Most homeowners can offset 80-100% of their electricity consumption. System sizing should account for future needs like EV charging or pool equipment.`,
        `Solar production in ${city} ranks among the highest in the nation thanks to abundant sunshine and low cloud cover. An 8kW system here generates 12,000-14,000 kWh per year, well above the 9,000-11,000 kWh national average. That is enough to offset 80-100% of typical household electricity use. Size your system with future loads in mind, including potential EV charging or pool equipment.`,
        `${city} is one of the best locations in the country for residential solar production. A standard 8kW system produces 12,000-14,000 kWh annually, 25-35% more than average U.S. markets. Most ${city} homeowners can cover 80-100% of their electricity needs with a properly sized system. Plan for future consumption increases from EVs or pool equipment when determining system size.`,
        `The sunshine in ${city} puts it among the top U.S. solar markets. An 8kW residential system generates 12,000-14,000 kWh per year here versus 9,000-11,000 kWh in average climates. That extra production means most homeowners offset 80-100% of their electricity consumption. When sizing your system, factor in future loads like electric vehicle charging or a pool pump.`,
      ], seed),
    });
  } else if (ctx?.hurricaneZone) {
    faqs.push({
      q: `Will solar panels survive a hurricane in ${city}?`,
      a: pick([
        `Properly installed solar panels on wind-rated racking systems are tested to withstand 130+ mph winds and often survive hurricanes better than the roof beneath them. Key requirements: use racking certified for ${city}'s wind speed zone, ensure every roof penetration is properly flashed and sealed, and keep your panels well-maintained. After any major storm, have your installer inspect the racking connections and wiring.`,
        `Solar panels on properly rated racking systems handle hurricanes well, often outlasting the roof itself during high-wind events. The critical factors: racking must be certified for ${city}'s wind speed zone (130+ mph), all roof penetrations need proper flashing and sealant, and ongoing maintenance keeps connections tight. Schedule a post-storm inspection with your installer after any significant hurricane event.`,
        `With the right installation, solar panels withstand 130+ mph winds and frequently survive hurricanes better than surrounding roofing materials. The keys are wind-rated racking certified for ${city}'s exposure zone, properly sealed roof penetrations, and regular maintenance to keep hardware tight. After any major storm, have your solar installer inspect racking attachments and electrical connections.`,
        `Wind-rated solar racking systems are tested to 130+ mph and have a strong track record through hurricanes in ${city}'s zone. Proper installation is everything: certified racking for the local wind speed rating, correct flashing on every roof penetration, and regular hardware inspections. Post-storm, have your installer check all connections since vibration can loosen mounting hardware even if the panels appear undamaged.`,
      ], seed),
    });
  } else {
    faqs.push({
      q: `Is solar worth it in ${city}?`,
      a: pick([
        `For most ${city} homeowners, solar pays back in 6-10 years and then generates free electricity for another 15-20 years. The 30% federal tax credit reduces net cost significantly. Actual payback depends on your roof orientation, shading, electricity usage, and utility rate structure. Get 3 quotes with production estimates specific to your roof to evaluate the investment for your situation.`,
        `Solar is a strong investment for most ${city} homes, with typical payback in 6-10 years followed by 15-20 years of free electricity. The 30% federal tax credit cuts the net cost substantially. Your specific return depends on roof orientation, shading, energy consumption, and local utility rates. Three quotes with site-specific production estimates give you the data to decide.`,
        `The numbers work well for most ${city} homeowners. Typical payback runs 6-10 years, after which the system generates essentially free electricity for another 15-20 years. The 30% federal tax credit applies to the full installation cost with no dollar cap. Roof orientation, shading, usage patterns, and utility rate structure all affect individual payback. Get 3 site-specific quotes to evaluate your situation.`,
        `In ${city}, residential solar typically pays for itself in 6-10 years and then produces free power for 15-20 more. The 30% federal Investment Tax Credit reduces your net cost significantly. Your actual payback timeline depends on roof angle, shade exposure, electricity consumption, and your utility's rate plan. Request 3 quotes with production modeling specific to your roof for an accurate comparison.`,
      ], seed),
    });
  }

  faqs.push({
    q: `What solar incentives are available in ${city}?`,
    a: pick([
      `All ${city} homeowners qualify for the 30% federal Investment Tax Credit (ITC), which has no dollar cap. Beyond that, check your state's solar incentive database (DSIRE) for state tax credits, utility rebates, Solar Renewable Energy Credits (SRECs), property tax exemptions, and net metering policies. These vary by state and utility and can reduce your net cost by an additional 10-30% beyond the federal credit.`,
      `The 30% federal ITC applies to every ${city} solar installation with no cap on the credit amount. Additional incentives vary: check the DSIRE database for ${state}-specific state tax credits, utility rebates, SREC programs, and property tax exemptions. Net metering policies differ by utility. Combined, state and local incentives can cut your net cost an additional 10-30% beyond the federal credit.`,
      `Every ${city} homeowner installing solar qualifies for the 30% federal Investment Tax Credit with no dollar limit. Beyond that, ${state} may offer state tax credits, utility-specific rebates, Solar Renewable Energy Credits, and property tax exemptions. The DSIRE database has the current list for your area. These stacked incentives typically reduce net cost by an additional 10-30%.`,
      `Start with the 30% federal ITC, which applies to all ${city} solar installations with no cap. Then check DSIRE for ${state}-level incentives: state tax credits, utility rebates, SREC markets, property tax exemptions, and net metering terms. Each utility has different programs and rates. The combined federal-plus-state incentive stack typically reduces net cost by 40-60% in markets with strong state programs.`,
    ], seed + 1),
  });

  const seasonMap = {
    hot_dry: { best: "fall or winter", why: "cooler temperatures make attic work comfortable and your system starts producing before peak summer rates" },
    hot_humid: { best: "fall or winter", why: "cooler weather makes roof work safer and the system is ready for the high-production spring and summer months" },
    cold: { best: "late spring or summer", why: "weather cooperates for roof work and you maximize first-year production before winter" },
    very_cold: { best: "summer", why: "the narrow window of favorable roof conditions and you get full summer production immediately" },
    mixed_humid: { best: "early spring or fall", why: "moderate weather conditions for installation and you avoid the peak-demand scheduling crunch" },
    mixed_dry: { best: "spring or fall", why: "comfortable working temperatures and strong solar production begins immediately" },
    marine: { best: "late spring or summer", why: "dry weather conditions for safe roof work and immediate high-production summer output" },
    subarctic: { best: "mid-summer", why: "the only window with safe roof conditions and maximum immediate production" },
  };
  const season = seasonMap[ctx?.climateZone] || seasonMap.mixed_humid;
  faqs.push({
    q: `When is the best time to install solar in ${city}?`,
    a: pick([
      `The best installation window in ${city} is ${season.best}, ${season.why}. Note that the process from quote to installation takes 6-12 weeks including permitting, utility approval, and scheduling. Start the process 2-3 months before your target installation date. The federal tax credit applies to the year of installation, so timing relative to tax year can matter.`,
      `For ${city}, schedule solar installation during ${season.best}. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}. Keep in mind the full process (quoting, permitting, utility approval, installation) takes 6-12 weeks. Start 2-3 months before your target date. If tax-year timing matters, plan around the installation completion date since that triggers the ITC.`,
      `Target ${season.best} for your ${city} solar installation. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}. The timeline from first quote to operating system runs 6-12 weeks with permitting and utility approval. Begin the process at least 2-3 months ahead. The federal tax credit applies in the year the system is installed, so tax-year planning may influence your timeline.`,
      `${city} homeowners should aim for ${season.best} to install solar. ${season.why.charAt(0).toUpperCase() + season.why.slice(1)}. Allow 6-12 weeks from signing a contract through permitting, utility interconnection approval, and installation. Start gathering quotes 2-3 months before your target window. Remember that the 30% ITC applies to the tax year in which installation is completed.`,
    ], seed + 2),
  });

  return faqs;
}

// --- VERTICAL CONFIG ---

const VERTICALS = {
  roof: {
    slugSuffix: "roof-cost",
    sectionTitle: "Local Roofing Guide",
    genParagraph: roofingParagraph,
    genFAQs: roofingFAQs,
  },
  plumbing: {
    slugSuffix: "plumbing-cost",
    sectionTitle: "Local Plumbing Guide",
    genParagraph: plumbingParagraph,
    genFAQs: plumbingFAQs,
  },
  "garage-door": {
    slugSuffix: "garage-door-cost",
    sectionTitle: "Local Garage Door Guide",
    genParagraph: garageDoorParagraph,
    genFAQs: garageDoorFAQs,
  },
  fence: {
    slugSuffix: "fence-cost",
    sectionTitle: "Local Fencing Guide",
    genParagraph: fenceParagraph,
    genFAQs: fenceFAQs,
  },
  solar: {
    slugSuffix: "solar-cost",
    sectionTitle: "Local Solar Guide",
    genParagraph: solarParagraph,
    genFAQs: solarFAQs,
  },
};

function buildHTML(title, paragraph, faqs, city) {
  let html = `\n${MARKER_START}\n`;
  html += `<section class="section">\n`;
  html += `<h2>${title} for ${city}</h2>\n`;
  html += paragraph
    .split("\n\n")
    .map((p) => `<p>${p}</p>`)
    .join("\n");
  html += `\n</section>\n`;
  html += `${MARKER_END}\n`;
  return html;
}

function buildFAQHTML(faqs) {
  let html = `${FAQ_MARKER_START}\n`;
  for (const { q, a } of faqs) {
    html += `<details class="faq-item">\n`;
    html += `<summary>${q}</summary>\n`;
    html += `<div class="faq-answer"><p>${a}</p></div>\n`;
    html += `</details>\n`;
  }
  html += `${FAQ_MARKER_END}\n`;
  return html;
}

function buildFAQSchema(faqs) {
  return faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  }));
}

function injectIntoFile(filepath, vertConfig) {
  const parsed = parseCityFromFilename(filepath, vertConfig.slugSuffix);
  if (!parsed) return null;
  const { city, state } = parsed;
  const { ctx, facts } = lookupCity(city, state);
  if (!ctx) return null;

  const paragraph = vertConfig.genParagraph(city, state, ctx, facts);
  const faqs = vertConfig.genFAQs(city, state, ctx, facts);

  let content = fs.readFileSync(filepath, "utf8");

  // Remove old injected content if present (idempotent)
  const markerRe = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, "g");
  content = content.replace(markerRe, "");
  const faqMarkerRe = new RegExp(`${FAQ_MARKER_START}[\\s\\S]*?${FAQ_MARKER_END}\\n?`, "g");
  content = content.replace(faqMarkerRe, "");

  // Inject unique paragraph section -- find the best insertion point
  const nl = content.includes("\r\n") ? "\r\n" : "\n";
  let paragraphInjected = false;

  // Strategy 1: Before "<!-- 6." comment (roofing pages)
  const section6Match = content.indexOf("<!-- 6.");
  if (section6Match >= 0) {
    const sectionEndBefore = content.lastIndexOf("</section>", section6Match);
    if (sectionEndBefore >= 0) {
      const insertAt = sectionEndBefore + "</section>".length;
      const newSection = buildHTML(vertConfig.sectionTitle, paragraph, faqs, `${city}, ${state}`).replace(/\n/g, nl);
      content = content.slice(0, insertAt) + nl + newSection + content.slice(insertAt);
      paragraphInjected = true;
    }
  }

  // Strategy 2: Before "<!-- TP-INTERNAL-TOOLS-BLOCK -->" (non-roofing pages)
  if (!paragraphInjected) {
    const toolsBlock = content.indexOf("<!-- TP-INTERNAL-TOOLS-BLOCK -->");
    if (toolsBlock >= 0) {
      const newSection = buildHTML(vertConfig.sectionTitle, paragraph, faqs, `${city}, ${state}`).replace(/\n/g, nl);
      content = content.slice(0, toolsBlock) + newSection + nl + content.slice(toolsBlock);
      paragraphInjected = true;
    }
  }

  // Strategy 3: Before "<!-- TP-LOCAL-INJECTED-V4 -->" (fallback)
  if (!paragraphInjected) {
    const v4Block = content.indexOf("<!-- TP-LOCAL-INJECTED-V4 -->");
    if (v4Block >= 0) {
      const newSection = buildHTML(vertConfig.sectionTitle, paragraph, faqs, `${city}, ${state}`).replace(/\n/g, nl);
      content = content.slice(0, v4Block) + newSection + nl + content.slice(v4Block);
      paragraphInjected = true;
    }
  }

  // Strategy 4: Before footer (last resort)
  if (!paragraphInjected) {
    const footerIdx = content.indexOf("<footer");
    if (footerIdx >= 0) {
      const newSection = buildHTML(vertConfig.sectionTitle, paragraph, faqs, `${city}, ${state}`).replace(/\n/g, nl);
      content = content.slice(0, footerIdx) + newSection + nl + content.slice(footerIdx);
      paragraphInjected = true;
    }
  }

  // Inject unique FAQs into FAQ section
  let faqInjected = false;

  // Strategy 1: After "<!-- 13. FAQ -->" comment (roofing pages)
  const faqSectionComment = "<!-- 13. FAQ -->";
  const faqSectionIdx = content.indexOf(faqSectionComment);
  if (faqSectionIdx >= 0) {
    const closingTag = "</div>\r\n</section>";
    const closingTagAlt = "</div>\n</section>";
    let faqEndIdx = content.indexOf(closingTag, faqSectionIdx);
    if (faqEndIdx < 0) faqEndIdx = content.indexOf(closingTagAlt, faqSectionIdx);
    if (faqEndIdx >= 0) {
      const faqHTML = buildFAQHTML(faqs).replace(/\n/g, nl);
      content = content.slice(0, faqEndIdx) + faqHTML + content.slice(faqEndIdx);
      faqInjected = true;
    }
  }

  // Strategy 2: Find faq-list div (non-roofing pages)
  if (!faqInjected) {
    const faqListRe = /(<div class="faq-list">[\s\S]*?)(<\/div>\s*<\/section>)/;
    const faqMatch = content.match(faqListRe);
    if (faqMatch) {
      const faqHTML = buildFAQHTML(faqs).replace(/\n/g, nl);
      const insertAt = content.indexOf(faqMatch[0]) + faqMatch[1].length;
      content = content.slice(0, insertAt) + nl + faqHTML + content.slice(insertAt);
      faqInjected = true;
    }
  }

  // Update FAQPage schema to include new questions
  const faqSchemaEntries = buildFAQSchema(faqs);
  const faqSchemaRe = /"@type":"FAQPage","mainEntity":\[/;
  if (faqSchemaRe.test(content)) {
    const newEntries = faqSchemaEntries.map((e) => JSON.stringify(e)).join(",");
    content = content.replace(faqSchemaRe, `"@type":"FAQPage","mainEntity":[${newEntries},`);
  }

  if (!DRY) {
    fs.writeFileSync(filepath, content, "utf8");
  }
  return { city, state, paragraphLen: paragraph.length, faqCount: faqs.length };
}

function main() {
  const vertConfig = VERTICALS[vertical];
  if (!vertConfig && vertical !== "all") {
    console.error(`Unknown vertical: ${vertical}. Available: ${Object.keys(VERTICALS).join(", ")}, all`);
    process.exit(1);
  }

  const verts = vertical === "all" ? Object.keys(VERTICALS) : [vertical];

  for (const v of verts) {
    const config = VERTICALS[v];
    const pattern = `*-${config.slugSuffix}.html`;
    const glob = require("path");
    const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(`-${config.slugSuffix}.html`));
    console.log(`\n${v}: found ${files.length} city pages`);

    let injected = 0;
    let skipped = 0;
    for (const f of files) {
      const result = injectIntoFile(path.join(ROOT, f), config);
      if (result) {
        injected++;
        if (injected <= 3) {
          console.log(`  ${result.city}, ${result.state}: ${result.paragraphLen} chars paragraph, ${result.faqCount} FAQs`);
        }
      } else {
        skipped++;
      }
    }
    console.log(`  ${injected} injected, ${skipped} skipped (no city data match)`);
    if (DRY) console.log("  [DRY RUN: no files written]");
  }
}

main();
