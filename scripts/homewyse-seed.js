/**
 * Homewyse Cost Data Seeder
 *
 * Scrapes structured cost data from Homewyse.com, which provides
 * detailed cost breakdowns by zip code for home services.
 * No API key needed -- public pages.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx CAL_ADMIN_KEY=1111 node scripts/homewyse-seed.js
 *
 * Options:
 *   --service=roofing       (default: cycles through all)
 *   --max-zips=100          (default: 100)
 *   --dry-run               (parse but don't seed)
 */

const CALIBRATION_URL = "https://truepricehq.com/api/calibration";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SERVICES = [
  { slug: "cost-to-install-asphalt-roof", service: "roofing", material: "architectural", unit: "sqft", defaultSize: 2000 },
  { slug: "cost-to-install-metal-roof", service: "roofing", material: "metal", unit: "sqft", defaultSize: 2000 },
  { slug: "cost-to-install-tile-roof", service: "roofing", material: "tile", unit: "sqft", defaultSize: 2000 },
  { slug: "cost-to-install-central-air-conditioning", service: "hvac", material: "central_ac", unit: "unit", defaultSize: 0 },
  { slug: "cost-to-install-a-heat-pump", service: "hvac", material: "heat_pump", unit: "unit", defaultSize: 0 },
  { slug: "cost-to-install-a-furnace", service: "hvac", material: "furnace", unit: "unit", defaultSize: 0 },
  { slug: "cost-to-repair-plumbing", service: "plumbing", material: "", unit: "job", defaultSize: 0 },
  { slug: "cost-to-install-solar-panels", service: "solar", material: "standard", unit: "kw", defaultSize: 0 },
  { slug: "cost-to-install-vinyl-siding", service: "siding", material: "vinyl", unit: "sqft", defaultSize: 1500 },
  { slug: "cost-to-paint-house-exterior", service: "painting", material: "exterior", unit: "sqft", defaultSize: 2000 },
  { slug: "cost-to-install-wood-fence", service: "fencing", material: "wood", unit: "lf", defaultSize: 150 },
  { slug: "cost-to-install-vinyl-fence", service: "fencing", material: "vinyl", unit: "lf", defaultSize: 150 },
  { slug: "cost-to-replace-windows", service: "windows", material: "vinyl", unit: "window", defaultSize: 10 },
  { slug: "cost-to-pour-concrete-slab", service: "concrete", material: "slab", unit: "sqft", defaultSize: 400 },
  { slug: "cost-to-install-gutters", service: "gutters", material: "aluminum", unit: "lf", defaultSize: 200 },
  { slug: "cost-to-install-insulation", service: "insulation", material: "blown", unit: "sqft", defaultSize: 1500 }
];

// Zip codes for major metros (one per city)
const ZIP_CITY_MAP = [
  { zip: "75201", city: "Dallas", state: "TX" },
  { zip: "77001", city: "Houston", state: "TX" },
  { zip: "78701", city: "Austin", state: "TX" },
  { zip: "28202", city: "Charlotte", state: "NC" },
  { zip: "27601", city: "Raleigh", state: "NC" },
  { zip: "30301", city: "Atlanta", state: "GA" },
  { zip: "37201", city: "Nashville", state: "TN" },
  { zip: "85001", city: "Phoenix", state: "AZ" },
  { zip: "80201", city: "Denver", state: "CO" },
  { zip: "60601", city: "Chicago", state: "IL" },
  { zip: "43201", city: "Columbus", state: "OH" },
  { zip: "46201", city: "Indianapolis", state: "IN" },
  { zip: "55401", city: "Minneapolis", state: "MN" },
  { zip: "64101", city: "Kansas City", state: "MO" },
  { zip: "98101", city: "Seattle", state: "WA" },
  { zip: "97201", city: "Portland", state: "OR" },
  { zip: "94101", city: "San Francisco", state: "CA" },
  { zip: "90001", city: "Los Angeles", state: "CA" },
  { zip: "92101", city: "San Diego", state: "CA" },
  { zip: "89101", city: "Las Vegas", state: "NV" },
  { zip: "84101", city: "Salt Lake City", state: "UT" },
  { zip: "33101", city: "Miami", state: "FL" },
  { zip: "33601", city: "Tampa", state: "FL" },
  { zip: "32801", city: "Orlando", state: "FL" },
  { zip: "19101", city: "Philadelphia", state: "PA" },
  { zip: "15201", city: "Pittsburgh", state: "PA" },
  { zip: "02101", city: "Boston", state: "MA" },
  { zip: "48201", city: "Detroit", state: "MI" },
  { zip: "23219", city: "Richmond", state: "VA" },
  { zip: "29401", city: "Charleston", state: "SC" },
  { zip: "29715", city: "Fort Mill", state: "SC" },
  { zip: "70112", city: "New Orleans", state: "LA" },
  { zip: "73101", city: "Oklahoma City", state: "OK" },
  { zip: "68101", city: "Omaha", state: "NE" },
  { zip: "87101", city: "Albuquerque", state: "NM" },
  { zip: "35201", city: "Birmingham", state: "AL" },
  { zip: "40201", city: "Louisville", state: "KY" },
  { zip: "63101", city: "St. Louis", state: "MO" },
  { zip: "53201", city: "Milwaukee", state: "WI" },
  { zip: "38101", city: "Memphis", state: "TN" },
  { zip: "29201", city: "Columbia", state: "SC" },
  { zip: "32099", city: "Jacksonville", state: "FL" },
  { zip: "78201", city: "San Antonio", state: "TX" },
  { zip: "80901", city: "Colorado Springs", state: "CO" },
  { zip: "44101", city: "Cleveland", state: "OH" },
  { zip: "45201", city: "Cincinnati", state: "OH" },
  { zip: "49501", city: "Grand Rapids", state: "MI" },
  { zip: "23451", city: "Virginia Beach", state: "VA" },
  { zip: "70801", city: "Baton Rouge", state: "LA" },
  { zip: "74101", city: "Tulsa", state: "OK" }
];

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith("--")) {
      const [key, val] = arg.slice(2).split("=");
      args[key] = val === undefined ? true : val;
    }
  });
  return args;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchHomewyse(slug, zip) {
  const url = `https://www.homewyse.com/${slug}.html?zip=${zip}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });
  if (!res.ok) throw new Error(`Homewyse HTTP ${res.status}`);
  return res.text();
}

async function parseWithHaiku(html, service, material, city, stateCode, apiKey) {
  // Truncate HTML to relevant cost section
  const costSection = html.substring(0, 15000);

  const prompt = `Extract cost data from this Homewyse.com page HTML. Return ONLY valid JSON, no markdown.

Service: ${service}
Material: ${material}
Location: ${city}, ${stateCode}

HTML (truncated):
${costSection}

Extract the total project cost range. Return:
{
  "lowCost": <number, low end of total cost>,
  "highCost": <number, high end of total cost>,
  "unit": "<what the cost covers, e.g. 'per 2,000 sq ft', 'per unit'>",
  "laborPercent": <number, labor as % of total if shown>,
  "materialPercent": <number, materials as % of total if shown>,
  "found": true
}

If no cost data found, return: { "found": false }`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { found: false };
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { found: false };
  }
}

async function seedQuote(quote, adminKey) {
  const res = await fetch(CALIBRATION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...quote, adminKey })
  });
  return res.json();
}

async function main() {
  const args = parseArgs();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const adminKey = process.env.CAL_ADMIN_KEY;
  const dryRun = args["dry-run"] || false;
  const maxZips = parseInt(args["max-zips"] || "100");
  const targetService = args["service"] || null;

  if (!anthropicKey) { console.log("Set ANTHROPIC_API_KEY"); process.exit(1); }
  if (!adminKey && !dryRun) { console.log("Set CAL_ADMIN_KEY (or --dry-run)"); process.exit(1); }

  const services = targetService
    ? SERVICES.filter(s => s.service === targetService)
    : SERVICES;

  const zips = ZIP_CITY_MAP.slice(0, maxZips);
  let totalFetched = 0;
  let totalSeeded = 0;

  console.log("Homewyse Cost Data Seeder");
  console.log(`  Services: ${services.map(s => s.service + "/" + s.material).join(", ")}`);
  console.log(`  Zip codes: ${zips.length}`);
  console.log(`  Dry run: ${dryRun}\n`);

  for (const svc of services) {
    console.log(`\n=== ${svc.service}/${svc.material} ===`);

    for (const loc of zips) {
      console.log(`  ${loc.city}, ${loc.state} (${loc.zip})...`);
      await sleep(2000); // Be respectful to Homewyse

      let html;
      try {
        html = await fetchHomewyse(svc.slug, loc.zip);
        totalFetched++;
      } catch (e) {
        console.log(`    Fetch error: ${e.message}`);
        continue;
      }

      await sleep(1500); // Rate limit Haiku

      let parsed;
      try {
        parsed = await parseWithHaiku(html, svc.service, svc.material, loc.city, loc.state, anthropicKey);
      } catch (e) {
        console.log(`    Parse error: ${e.message}`);
        continue;
      }

      if (!parsed.found || !parsed.lowCost || !parsed.highCost) {
        console.log("    No cost data found.");
        continue;
      }

      const midCost = Math.round((parsed.lowCost + parsed.highCost) / 2);
      console.log(`    $${parsed.lowCost} - $${parsed.highCost} (mid: $${midCost}) ${parsed.unit || ""}`);

      if (!dryRun) {
        // Seed low and high as separate data points
        for (const price of [parsed.lowCost, parsed.highCost]) {
          try {
            await seedQuote({
              type: "community_quote",
              service: svc.service,
              city: loc.city,
              stateCode: loc.state,
              price: price,
              material: svc.material,
              roofSize: svc.defaultSize,
              contractor: "Homewyse average",
              isRepair: false,
              source: "homewyse",
              sourceUrl: `https://www.homewyse.com/${svc.slug}.html?zip=${loc.zip}`,
              notes: `${parsed.unit || ""} (${svc.material})`,
              confidence: "high"
            }, adminKey);
            totalSeeded++;
          } catch (e) {
            console.log(`    Seed error: ${e.message}`);
          }
        }
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`DONE: ${totalFetched} pages fetched -> ${totalSeeded} data points seeded`);
  console.log(`========================================`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
