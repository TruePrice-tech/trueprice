/**
 * Yelp Reviews Quote Seeder
 *
 * Searches Yelp for contractors, pulls reviews with price mentions,
 * and uses Claude Haiku to extract structured quote data.
 *
 * Uses Yelp Fusion API (free, 5000 calls/day).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx YELP_API_KEY=xxx CAL_ADMIN_KEY=1111 node scripts/yelp-seed.js
 *
 * Options:
 *   --service=roofing       (default: cycles through all)
 *   --max-cities=50         (default: 50)
 *   --dry-run               (parse but don't seed)
 *
 * Get a Yelp API key at: https://www.yelp.com/developers/v3/manage_app
 */

const CALIBRATION_URL = "https://truepricehq.com/api/calibration";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const YELP_URL = "https://api.yelp.com/v3";
const INFLATION_RATE = 0.03;

const SERVICES = [
  { category: "roofing", service: "roofing", term: "roofing" },
  { category: "heating", service: "hvac", term: "hvac" },
  { category: "plumbing", service: "plumbing", term: "plumber" },
  { category: "solarpanels", service: "solar", term: "solar installation" },
  { category: "electricians", service: "electrical", term: "electrician" },
  { category: "fences", service: "fencing", term: "fence contractor" },
  { category: "painters", service: "painting", term: "house painter" },
  { category: "masonry_concrete", service: "concrete", term: "concrete contractor" },
  { category: "windows_installation", service: "windows", term: "window replacement" },
  { category: "garagedoorservices", service: "garage-doors", term: "garage door" },
  { category: "landscaping", service: "landscaping", term: "landscaping" },
  { category: "insulation_installation", service: "insulation", term: "insulation" },
  { category: "siding", service: "siding", term: "siding contractor" },
  { category: "gutterservices", service: "gutters", term: "gutter installation" }
];

const CITIES = [
  "Dallas, TX", "Houston, TX", "Austin, TX", "San Antonio, TX", "Fort Worth, TX",
  "Charlotte, NC", "Raleigh, NC", "Durham, NC",
  "Atlanta, GA", "Nashville, TN",
  "Phoenix, AZ", "Scottsdale, AZ",
  "Denver, CO",
  "Chicago, IL", "Naperville, IL",
  "Columbus, OH", "Cleveland, OH",
  "Indianapolis, IN",
  "Minneapolis, MN",
  "Kansas City, MO",
  "Seattle, WA", "Portland, OR",
  "Los Angeles, CA", "San Diego, CA", "Sacramento, CA",
  "Las Vegas, NV",
  "Salt Lake City, UT",
  "Miami, FL", "Tampa, FL", "Orlando, FL",
  "Philadelphia, PA", "Pittsburgh, PA",
  "Boston, MA",
  "Detroit, MI",
  "Richmond, VA",
  "Charleston, SC",
  "New Orleans, LA",
  "Oklahoma City, OK",
  "Omaha, NE",
  "Albuquerque, NM",
  "Birmingham, AL",
  "Louisville, KY",
  "Fort Mill, SC", "Rock Hill, SC"
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

async function searchYelp(term, location, yelpKey) {
  const url = `${YELP_URL}/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}&limit=5&sort_by=review_count`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${yelpKey}` }
  });
  if (!res.ok) {
    if (res.status === 429) {
      console.log("    Yelp rate limited, waiting 30s...");
      await sleep(30000);
      return searchYelp(term, location, yelpKey);
    }
    throw new Error(`Yelp Search API ${res.status}`);
  }
  const data = await res.json();
  return data.businesses || [];
}

async function getYelpReviews(businessId, yelpKey) {
  // Try standard reviews endpoint first, fall back to review highlights
  for (const path of [`/businesses/${businessId}/reviews?limit=20&sort_by=newest`, `/businesses/${businessId}/reviews`]) {
    try {
      const res = await fetch(`${YELP_URL}${path}`, {
        headers: { "Authorization": `Bearer ${yelpKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        return (data.reviews || []).filter(r => r.text && /\$[\d,]+/.test(r.text));
      }
    } catch (e) {}
  }
  // Try review highlights as fallback
  try {
    const res = await fetch(`${YELP_URL}/businesses/${businessId}/review_highlights`, {
      headers: { "Authorization": `Bearer ${yelpKey}` }
    });
    if (res.ok) {
      const data = await res.json();
      const highlights = data.review_highlights || [];
      return highlights
        .filter(h => h.sentence && /\$[\d,]+/.test(h.sentence))
        .map(h => ({ text: h.sentence, time_created: null }));
    }
  } catch (e) {}
  return [];
}

async function parseWithHaiku(reviewText, businessName, city, stateCode, service, apiKey) {
  const prompt = `Extract contractor quote data from this Yelp review. Return ONLY valid JSON, no markdown.

Contractor: ${businessName}
Location: ${city}, ${stateCode}
Review: ${reviewText}

Extract ALL price mentions. For each, return:
- price (number, USD, total project price)
- city (string, "${city}")
- stateCode (string, "${stateCode}")
- material (string, material/equipment if mentioned)
- roofSize (number, sqft if mentioned, 0 if not)
- contractor (string, "${businessName}")
- service (string, one of: roofing, hvac, plumbing, solar, electrical, insulation, windows, painting, fencing, concrete, garage-doors, landscaping, kitchen, siding, gutters)
- isRepair (boolean)
- confidence (string, "high" if clear actual price paid, "medium" if vague, "low" if uncertain)
- notes (string, brief job description)

Rules:
- Only extract actual prices the reviewer paid or was quoted
- Skip jobs under $500
- Service is likely "${service}" but override if clearly different

Return: { "quotes": [...] } or { "quotes": [] }`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { quotes: [] };
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { quotes: [] };
  }
}

function inflationAdjust(price, dateStr) {
  if (!dateStr) return price;
  const ageMs = Date.now() - new Date(dateStr).getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 0 || ageYears > 5) return price;
  return Math.round(price * Math.pow(1 + INFLATION_RATE, ageYears));
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
  const yelpKey = process.env.YELP_API_KEY;
  const adminKey = process.env.CAL_ADMIN_KEY;
  const dryRun = args["dry-run"] || false;
  const maxCities = parseInt(args["max-cities"] || "50");
  const targetService = args["service"] || null;

  if (!anthropicKey) { console.log("Set ANTHROPIC_API_KEY"); process.exit(1); }
  if (!yelpKey) { console.log("Set YELP_API_KEY (get one at yelp.com/developers)"); process.exit(1); }
  if (!adminKey && !dryRun) { console.log("Set CAL_ADMIN_KEY (or --dry-run)"); process.exit(1); }

  const services = targetService
    ? SERVICES.filter(s => s.service === targetService)
    : SERVICES;

  const cities = CITIES.slice(0, maxCities);
  let totalReviews = 0;
  let totalQuotes = 0;
  let totalSeeded = 0;

  console.log("Yelp Reviews Quote Seeder");
  console.log(`  Services: ${services.map(s => s.service).join(", ")}`);
  console.log(`  Cities: ${cities.length}`);
  console.log(`  Dry run: ${dryRun}\n`);

  for (const svc of services) {
    console.log(`\n=== ${svc.service.toUpperCase()} ===`);

    for (const city of cities) {
      const [cityName, stateCode] = city.split(", ");
      console.log(`\n  ${city}:`);
      await sleep(300);

      let businesses;
      try {
        businesses = await searchYelp(svc.term, city, yelpKey);
      } catch (e) {
        console.log(`    Search error: ${e.message}`);
        continue;
      }

      if (businesses.length === 0) {
        console.log("    No businesses found.");
        continue;
      }

      console.log(`    Found ${businesses.length} businesses`);

      for (const biz of businesses) {
        await sleep(300);

        let reviews;
        try {
          reviews = await getYelpReviews(biz.id, yelpKey);
        } catch (e) {
          console.log(`    Reviews error: ${e.message}`);
          continue;
        }

        if (reviews.length === 0) continue;

        console.log(`    ${biz.name}: ${reviews.length} reviews with $ amounts`);

        for (const review of reviews) {
          totalReviews++;
          await sleep(1500);

          let parsed;
          try {
            parsed = await parseWithHaiku(review.text, biz.name, cityName, stateCode, svc.service, anthropicKey);
          } catch (e) {
            console.log(`      Haiku error: ${e.message}`);
            continue;
          }

          if (!parsed.quotes || parsed.quotes.length === 0) continue;

          for (const q of parsed.quotes) {
            if (!q.price || q.price < 500 || q.confidence === "low") continue;
            totalQuotes++;

            const adjusted = inflationAdjust(q.price, review.time_created);
            console.log(`      $${q.price} -> $${adjusted} (${q.service}) ${q.city}, ${q.stateCode} [${q.confidence}]`);

            if (!dryRun) {
              try {
                await seedQuote({
                  type: "community_quote",
                  service: q.service || svc.service,
                  city: q.city || cityName,
                  stateCode: q.stateCode || stateCode,
                  price: adjusted,
                  material: q.material || "",
                  roofSize: q.roofSize || 0,
                  contractor: q.contractor || biz.name,
                  isRepair: q.isRepair || false,
                  source: "yelp_reviews",
                  sourceUrl: biz.url || "",
                  notes: q.notes || "",
                  confidence: q.confidence || "medium"
                }, adminKey);
                totalSeeded++;
              } catch (e) {
                console.log(`      Seed error: ${e.message}`);
              }
            }
          }
        }
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`DONE: ${totalReviews} reviews -> ${totalQuotes} quotes -> ${totalSeeded} seeded`);
  console.log(`========================================`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
