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

  // Opening by climate
  const climateMap = {
    hot_humid: `Roofing in ${city} means contending with ${state === "TX" ? "Texas" : state}'s combination of intense UV exposure, high humidity, and sudden temperature swings. These conditions accelerate granule loss on standard asphalt shingles and can shorten roof lifespan by 3-5 years compared to milder climates.`,
    hot_dry: `The arid climate around ${city} creates a harsh environment for roofing materials. Sustained UV bombardment and extreme surface temperatures (roof surfaces regularly exceed 160F in summer) degrade standard materials faster than national averages suggest.`,
    cold: `${city}'s cold winters bring unique roofing challenges: ice dams, freeze-thaw cycling, and heavy snow loads all factor into material selection and installation technique. A roof built for mild weather will fail early here.`,
    temperate: `${city}'s moderate four-season climate is relatively forgiving on roofing materials, giving homeowners more flexibility in material choice. That said, local factors like tree coverage, wind exposure, and occasional severe weather still matter.`,
    mixed_humid: `${city} gets the full range of weather stress on a roof: summer heat and humidity, occasional severe storms, and enough cold-weather cycling to test flashing and sealant integrity over time.`,
    mixed_dry: `The semi-arid conditions around ${city} mean UV degradation is the primary roofing concern. Materials that perform well in humid climates may underperform here due to sustained heat and minimal moisture.`,
  };
  lines.push(climateMap[ctx?.climateZone] || climateMap.temperate);

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

  // Climate-specific FAQ
  if (ctx?.hailRisk === "high") {
    faqs.push({
      q: `Do I need impact-resistant shingles in ${city}?`,
      a: `They are strongly recommended. ${city} experiences frequent hail events that can damage standard shingles in a single storm. Class 4 impact-resistant shingles cost 10-20% more but qualify for insurance discounts of 15-25% in most ${state} policies, often paying for themselves within 3-5 years. If your current roof was damaged by hail, your insurance claim may cover the upgrade to IR-rated materials at no additional out-of-pocket cost.`,
    });
  } else if (ctx?.hurricaneZone) {
    faqs.push({
      q: `What wind rating do I need for a roof in ${city}?`,
      a: `${city} falls within a hurricane exposure zone, so building code requires roofing materials and installation methods rated for higher wind speeds than inland areas. Most contractors here install to 130+ mph wind ratings using enhanced nailing patterns and high-wind-rated underlayment. Verify your quote specifies the wind rating and ask whether the installation method matches the manufacturer's high-wind warranty requirements.`,
    });
  } else if (ctx?.climateZone === "cold") {
    faqs.push({
      q: `How do I prevent ice dams on my ${city} roof?`,
      a: `Ice dams form when heat escapes through the roof, melting snow that refreezes at the eaves. Prevention starts with proper attic insulation (R-49 or higher for ${city}'s climate zone) and continuous soffit-to-ridge ventilation. Your roofing quote should include ice and water shield membrane on the first 3-6 feet from all eaves. If your current roof has ice dam damage, address the insulation and ventilation before replacing the roof or the problem will recur.`,
    });
  } else {
    faqs.push({
      q: `How long does a roof last in ${city}?`,
      a: `In ${city}'s climate, architectural asphalt shingles typically last 20-25 years, standard 3-tab shingles 15-20 years, metal roofing 40-60 years, and tile 50+ years. These estimates assume proper ventilation and no major storm damage. UV exposure is the primary degradation factor here, so lighter-colored materials and adequate attic ventilation both extend lifespan meaningfully.`,
    });
  }

  // Permit FAQ
  faqs.push({
    q: `Do I need a permit to replace my roof in ${city}?`,
    a: facts?.permits
      ? `Yes. ${facts.permits} A reputable contractor handles the permit process as part of the job. If a contractor suggests skipping the permit or asks you to pull it yourself, that is a red flag. Unpermitted work can void your homeowners insurance, create problems when selling, and leave you liable if the installation does not meet code.`
      : `In most jurisdictions including ${city}, a building permit is required for a full roof replacement. Your contractor should pull the permit before work begins. Unpermitted roofing work can void your homeowners insurance coverage and create disclosure issues when selling the home.`,
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
    a: `The optimal window for roof replacement in ${city} is ${season.best}, ${season.why}. Scheduling during off-peak periods can save 10-15% on labor costs since contractors have more availability and may offer competitive pricing to fill their calendar. Avoid scheduling immediately after a major storm event when contractor demand (and prices) spike.`,
  });

  return faqs;
}

// --- PLUMBING TEMPLATES ---

function plumbingParagraph(city, state, ctx, facts) {
  const lines = [];

  const climateMap = {
    cold: `Plumbing in ${city} must be designed around freeze protection. Temperatures that drop below 20F put exposed and under-insulated pipes at serious risk of bursting, which is one of the most expensive plumbing emergencies homeowners face. Any plumbing quote here should account for pipe insulation, heat tape on vulnerable runs, and proper frost-proof hose bibs.`,
    very_cold: `${city}'s severe winters make freeze protection the single most important factor in residential plumbing. Water supply lines in exterior walls, crawl spaces, and unheated garages need heat cable and insulation rated for extended sub-zero exposure. Burst pipe repairs after a hard freeze routinely cost $2,000-$8,000, making preventive winterization the best investment a homeowner can make.`,
    hot_humid: `${city}'s warm, humid climate creates a different set of plumbing challenges than cold-weather cities face. High humidity accelerates corrosion on galvanized steel and copper fittings, and the consistently warm ground water temperatures can promote bacterial growth in water heaters set below 120F. On the plus side, freeze damage is rarely a concern here.`,
    hot_dry: `The arid climate around ${city} brings plumbing considerations that homeowners from wetter regions may not expect. Hard water is extremely common, causing mineral scale buildup inside pipes, water heaters, and fixtures. Water softener installation ($1,500-$3,000) often pays for itself by extending water heater life and reducing fixture replacement frequency.`,
    mixed_humid: `${city} sees enough winter cold to create occasional freeze risk and enough summer humidity to accelerate pipe corrosion over time. This combination means plumbing systems here face year-round stress that shortens component lifespans compared to milder climates. Annual inspections catch small issues before they become expensive emergencies.`,
    mixed_dry: `The semi-arid conditions around ${city} mean hard water and mineral buildup are the primary plumbing concerns. Tankless water heaters and fixtures require descaling more frequently here than in soft-water regions. Water conservation fixtures are increasingly popular and may qualify for local utility rebates.`,
    marine: `${city}'s mild marine climate is relatively gentle on plumbing systems. Freeze events are rare, humidity is moderate, and water quality is generally good. The main concerns are aging infrastructure in older neighborhoods and root intrusion into sewer lines from the lush vegetation this climate supports.`,
    subarctic: `${city}'s extreme cold requires plumbing systems engineered for prolonged sub-zero temperatures. All supply lines must be insulated and heat-traced, and main shutoff valves should be accessible for emergency winterization. Plumbing costs run 15-25% higher here than national averages due to the specialized materials and techniques required.`,
  };
  lines.push(climateMap[ctx?.climateZone] || climateMap.mixed_humid);

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

  if (ctx?.climateZone === "cold" || ctx?.climateZone === "very_cold") {
    faqs.push({
      q: `How do I prevent frozen pipes in ${city}?`,
      a: `${city}'s cold winters put pipes in exterior walls, crawl spaces, and garages at risk. Insulate all exposed pipes with foam sleeves, install heat tape on vulnerable runs, keep cabinet doors open during extreme cold to let warm air reach under-sink pipes, and never set your thermostat below 55F even when away. If you are winterizing a vacant property, have a plumber drain the system and add antifreeze to traps.`,
    });
  } else if (ctx?.climateZone === "hot_dry" || ctx?.climateZone === "mixed_dry") {
    faqs.push({
      q: `Does ${city}'s hard water damage plumbing?`,
      a: `Yes. Hard water in the ${city} area deposits mineral scale inside pipes, reduces water heater efficiency by 20-30%, and shortens fixture lifespan. A water softener ($1,500-$3,000 installed) or whole-house water conditioner addresses the problem at the source. Descaling your water heater annually adds 3-5 years to its lifespan. If you notice white buildup on faucets or reduced shower pressure, scale is the likely cause.`,
    });
  } else if (ctx?.hurricaneZone) {
    faqs.push({
      q: `How do I protect my plumbing during a hurricane in ${city}?`,
      a: `Know your main water shutoff valve location and test it annually. During a hurricane warning, shut off the main if you evacuate. After the storm, do not use tap water until the boil-water advisory (if any) is lifted. Check for sewer backflow if flooding occurred. Consider installing a backflow preventer if your home does not already have one, which is increasingly required by code in ${city}.`,
    });
  } else {
    faqs.push({
      q: `How often should I have my plumbing inspected in ${city}?`,
      a: `An annual plumbing inspection catches small issues before they become emergencies. In ${city}, pay special attention to water heater condition (they last 8-12 years), supply line connections under sinks (especially braided steel lines older than 10 years), and the main sewer line. A sewer camera inspection ($150-$400) every 3-5 years is worthwhile for homes older than 20 years.`,
    });
  }

  faqs.push({
    q: `What should a plumbing quote include in ${city}?`,
    a: facts?.permits
      ? `A complete ${city} plumbing quote should list: scope of work with specific fixtures and materials, labor hours, permit costs (${facts.permits.toLowerCase().includes("permit") ? "required for most work" : "check local requirements"}), cleanup and disposal, warranty terms, and the plumber's license number. Get three written quotes with matching scope before comparing prices.`
      : `A professional plumbing quote in ${city} should itemize: labor hours, material costs and brands, permit fees if applicable, cleanup, and warranty terms. The quote should include the plumber's license number and proof of insurance. Get three written quotes for any job over $500 to ensure fair pricing.`,
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
    a: `For non-emergency plumbing in ${city}, schedule during ${season.best}, ${season.why}. Emergency calls cost 50-100% more than scheduled work, so replacing aging water heaters, supply lines, and fixtures proactively during off-peak months saves significantly versus waiting for a failure.`,
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

  if (ctx?.climateZone === "cold" || ctx?.climateZone === "very_cold") {
    faqs.push({
      q: `What R-value garage door do I need in ${city}?`,
      a: `For ${city}'s cold winters, an R-12 to R-16 insulated door is recommended for attached garages. If you heat your garage or use it as a workshop, step up to R-16 or R-18. The extra $200-$500 for higher insulation pays back in 3-5 years through reduced heating costs in adjacent rooms and prevents freezing issues with items stored in the garage.`,
    });
  } else if (ctx?.hurricaneZone) {
    faqs.push({
      q: `Do I need a wind-rated garage door in ${city}?`,
      a: `Yes. ${city} building code requires wind-rated garage doors that can withstand hurricane-force pressures. A non-rated door is the most common point of structural failure during a hurricane since the garage opening is the largest unbraced span in most homes. Wind-rated doors cost $300-$800 more than standard doors and may qualify for insurance discounts. If your current door is not wind-rated, an upgrade is strongly recommended.`,
    });
  } else if (ctx?.climateZone === "hot_humid" || ctx?.climateZone === "hot_dry") {
    faqs.push({
      q: `How do I keep my garage cool in ${city}?`,
      a: `An insulated garage door (R-8 minimum) blocks radiant heat and can keep garage temperatures 10-20 degrees cooler than an uninsulated door. Light-colored doors reflect more heat than dark ones. Adding a radiant barrier to the ceiling and ensuring the weatherstrip seals tightly at the floor and sides also help. If you use the garage as a workspace, a ventilation fan or mini-split adds comfort without the cost of insulating the entire garage envelope.`,
    });
  } else {
    faqs.push({
      q: `How often should I maintain my garage door in ${city}?`,
      a: `Lubricate all moving parts (hinges, rollers, springs, tracks) with silicone spray twice a year. Test the auto-reverse by placing a 2x4 under the door -- it should reverse within 2 seconds of contact. Check weatherstripping for gaps and cracks annually. Tighten all hardware since vibration loosens bolts over time. A professional tune-up ($100-$200) every 2-3 years catches worn parts before they fail.`,
    });
  }

  faqs.push({
    q: `Should I repair or replace my garage door in ${city}?`,
    a: ctx?.avgHomeAge > 25
      ? `For ${city} homes averaging ${ctx.avgHomeAge} years old, replacement is often the better investment if the door is original. A new insulated door with a modern opener costs $1,200-$3,000 and recovers 90-100% of its cost at resale. Repair makes sense for newer doors with localized damage (single panel, one spring, or opener motor replacement) when the rest of the system is sound.`
      : `Repair if the damage is limited to one or two panels, a single spring, or the opener mechanism. Replace when the door is over 15 years old, panels are discontinued, the door lacks insulation you want, or you are planning to sell. A garage door replacement recovers 90-100% of its cost at resale, making it one of the highest-ROI home improvements available.`,
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
    a: `Schedule your ${city} garage door replacement for ${season.best}, ${season.why}. Off-peak timing can save 5-10% on installation costs and gets you a wider selection of available styles and colors. Spring is the busiest season for garage door companies since broken springs peak after winter cold stress.`,
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

  if (ctx?.hoaPrevalence === "high") {
    faqs.push({
      q: `What fence types does my ${city} HOA allow?`,
      a: `HOA restrictions in ${city} vary by community, but common rules include: maximum 6 feet in backyard and 4 feet in front yard, no chain link, "finished side" must face outward, approved colors only (usually earth tones or white), and architectural review board approval required before installation. Contact your HOA management company for the current architectural guidelines and submit your design for approval before ordering materials or signing a contract.`,
    });
  } else if (ctx?.climateZone === "hot_humid") {
    faqs.push({
      q: `What fence material lasts longest in ${city}'s climate?`,
      a: `In ${city}'s hot, humid climate, vinyl and aluminum fences outlast wood by 10-15 years because they are immune to rot, termites, and moisture damage. If you prefer the look of wood, use pressure-treated pine or cedar and plan on staining or sealing every 2-3 years. Composite fencing offers a wood-like appearance with vinyl-like durability at a price point between the two.`,
    });
  } else if (ctx?.climateZone === "cold" || ctx?.climateZone === "very_cold") {
    faqs.push({
      q: `How deep should fence posts be in ${city}?`,
      a: `In ${city}'s cold climate, fence posts should extend at least 6 inches below the frost line to prevent heaving. For most of ${city}, this means 36-48 inches deep with 8-10 inches of compacted gravel at the bottom for drainage and concrete from there to grade. Shallow posts in freeze-prone areas will lean within 2-3 winters regardless of how well the rest of the fence is built.`,
    });
  } else {
    faqs.push({
      q: `How long does a wood fence last in ${city}?`,
      a: `In ${city}'s climate, a properly installed and maintained pressure-treated fence lasts 15-20 years. Cedar lasts 15-25 years. Untreated pine may only last 5-8 years. Staining or sealing every 2-3 years and keeping vegetation trimmed away from the base are the two most effective ways to extend your fence's lifespan.`,
    });
  }

  faqs.push({
    q: `Do I need a permit to build a fence in ${city}?`,
    a: facts?.permits
      ? `In ${city}, ${facts.permits.toLowerCase().includes("permit") ? "permits are generally required for fence installation" : "check with the local building department about fence permits"}. Most jurisdictions require permits for fences over 6 feet tall, and some require them for any fence. You must also call 811 for utility locates before digging post holes, and verify property lines before building on or near the boundary. Your fence contractor should handle the permit process.`
      : `Most ${city} jurisdictions require permits for fences, especially those over 6 feet. Check with your local building department before starting. You must call 811 for utility locates before digging, verify property lines (consider a survey if boundaries are unclear), and check any HOA rules. Your contractor should handle permitting as part of the project.`,
  });

  faqs.push({
    q: `How much does fence installation cost per foot in ${city}?`,
    a: ctx?.growthRate === "high"
      ? `In ${city}'s growing market, fence installation runs $20-$35 per linear foot for wood privacy, $25-$45 for vinyl, $15-$25 for chain link, and $30-$60 for aluminum or wrought iron. Labor costs trend higher here due to strong contractor demand. Getting 3 quotes is essential since pricing variance tends to be wider in high-growth markets.`
      : `Fence installation in ${city} typically costs $15-$30 per linear foot for wood privacy, $20-$40 for vinyl, $10-$20 for chain link, and $25-$55 for aluminum or wrought iron. A 150 linear foot backyard fence runs $2,250-$6,000 depending on material. Getting 3 quotes with matching scope ensures fair pricing.`,
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

  if (ctx?.climateZone === "cold" || ctx?.climateZone === "very_cold") {
    faqs.push({
      q: `Does solar work in ${city}'s cold winters?`,
      a: `Yes. Solar panels are actually more electrically efficient in cold temperatures. While shorter winter days reduce daily production, summer's long days generate surplus that net metering banks for winter credit. Snow typically slides off angled panels within 1-2 days. Annual production in ${city} is lower than sunbelt cities, but higher electricity rates and available incentives often make the financial case comparable.`,
    });
  } else if (ctx?.climateZone === "hot_dry") {
    faqs.push({
      q: `How much solar energy can I produce in ${city}?`,
      a: `${city}'s high insolation makes it one of the best solar markets in the country. A typical 8kW system produces 12,000-14,000 kWh annually here, compared to 9,000-11,000 kWh in average U.S. climates. Most homeowners can offset 80-100% of their electricity consumption. System sizing should account for future needs like EV charging or pool equipment.`,
    });
  } else if (ctx?.hurricaneZone) {
    faqs.push({
      q: `Will solar panels survive a hurricane in ${city}?`,
      a: `Properly installed solar panels on wind-rated racking systems are tested to withstand 130+ mph winds and often survive hurricanes better than the roof beneath them. Key requirements: use racking certified for ${city}'s wind speed zone, ensure every roof penetration is properly flashed and sealed, and keep your panels well-maintained. After any major storm, have your installer inspect the racking connections and wiring.`,
    });
  } else {
    faqs.push({
      q: `Is solar worth it in ${city}?`,
      a: `For most ${city} homeowners, solar pays back in 6-10 years and then generates free electricity for another 15-20 years. The 30% federal tax credit reduces net cost significantly. Actual payback depends on your roof orientation, shading, electricity usage, and utility rate structure. Get 3 quotes with production estimates specific to your roof to evaluate the investment for your situation.`,
    });
  }

  faqs.push({
    q: `What solar incentives are available in ${city}?`,
    a: `All ${city} homeowners qualify for the 30% federal Investment Tax Credit (ITC), which has no dollar cap. Beyond that, check your state's solar incentive database (DSIRE) for state tax credits, utility rebates, Solar Renewable Energy Credits (SRECs), property tax exemptions, and net metering policies. These vary by state and utility and can reduce your net cost by an additional 10-30% beyond the federal credit.`,
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
    a: `The best installation window in ${city} is ${season.best}, ${season.why}. Note that the process from quote to installation takes 6-12 weeks including permitting, utility approval, and scheduling. Start the process 2-3 months before your target installation date. The federal tax credit applies to the year of installation, so timing relative to tax year can matter.`,
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
