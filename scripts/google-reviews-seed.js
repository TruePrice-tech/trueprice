/**
 * Google Reviews Quote Seeder
 *
 * Searches for contractors via Google Places API, pulls reviews,
 * and uses Claude Haiku to extract price data from review text.
 *
 * Requires Google Places API key (free $200/mo credit covers ~6,000 calls).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx GOOGLE_PLACES_KEY=xxx CAL_ADMIN_KEY=1111 node scripts/google-reviews-seed.js
 *
 * Options:
 *   --service=roofing       (default: cycles through all)
 *   --max-cities=50         (default: 50)
 *   --dry-run               (parse but don't seed)
 */

const CALIBRATION_URL = "https://truepricehq.com/api/calibration";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const INFLATION_RATE = 0.03;

const SERVICES = [
  { query: "roofing contractor", service: "roofing" },
  { query: "hvac contractor", service: "hvac" },
  { query: "plumber", service: "plumbing" },
  { query: "solar installer", service: "solar" },
  { query: "electrician", service: "electrical" },
  { query: "fence contractor", service: "fencing" },
  { query: "house painter", service: "painting" },
  { query: "concrete contractor", service: "concrete" },
  { query: "window replacement", service: "windows" },
  { query: "garage door repair", service: "garage-doors" },
  { query: "landscaping contractor", service: "landscaping" },
  { query: "insulation contractor", service: "insulation" },
  { query: "kitchen remodel contractor", service: "kitchen" },
  { query: "siding contractor", service: "siding" },
  { query: "gutter installer", service: "gutters" }
];

// Top US metros for seeding
const CITIES = [
  "Dallas, TX", "Houston, TX", "Austin, TX", "San Antonio, TX",
  "Charlotte, NC", "Raleigh, NC",
  "Atlanta, GA", "Nashville, TN", "Memphis, TN",
  "Phoenix, AZ", "Tucson, AZ",
  "Denver, CO", "Colorado Springs, CO",
  "Chicago, IL",
  "Columbus, OH", "Cleveland, OH", "Cincinnati, OH",
  "Indianapolis, IN",
  "Minneapolis, MN",
  "Kansas City, MO", "St. Louis, MO",
  "Seattle, WA", "Portland, OR",
  "San Francisco, CA", "Los Angeles, CA", "San Diego, CA", "Sacramento, CA",
  "Las Vegas, NV",
  "Salt Lake City, UT",
  "Miami, FL", "Tampa, FL", "Orlando, FL", "Jacksonville, FL",
  "Philadelphia, PA", "Pittsburgh, PA",
  "Boston, MA",
  "Detroit, MI", "Grand Rapids, MI",
  "Milwaukee, WI",
  "Richmond, VA", "Virginia Beach, VA",
  "Charleston, SC", "Columbia, SC",
  "New Orleans, LA", "Baton Rouge, LA",
  "Oklahoma City, OK", "Tulsa, OK",
  "Omaha, NE",
  "Albuquerque, NM",
  "Birmingham, AL",
  "Louisville, KY"
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

async function searchPlaces(query, city, apiKey) {
  const searchQuery = `${query} in ${city}`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places API ${res.status}`);
  const data = await res.json();
  return (data.results || []).slice(0, 5); // Top 5 results per city
}

async function getPlaceReviews(placeId, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,reviews,formatted_address&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Place Details API ${res.status}`);
  const data = await res.json();
  const result = data.result || {};
  return {
    name: result.name || "",
    address: result.formatted_address || "",
    reviews: (result.reviews || []).filter(r => r.text && /\$[\d,]+/.test(r.text))
  };
}

async function parseWithHaiku(reviewText, contractorName, address, service, apiKey) {
  const prompt = `Extract contractor quote data from this Google review. Return ONLY valid JSON, no markdown.

Contractor: ${contractorName}
Address: ${address}
Review: ${reviewText}

Extract ALL price mentions. For each, return:
- price (number, USD, total project price)
- city (string, US city from contractor address)
- stateCode (string, 2-letter US state code)
- material (string, e.g. "architectural", "metal", or equipment model)
- roofSize (number, sqft if mentioned, 0 if not)
- contractor (string, contractor name)
- service (string, one of: roofing, hvac, plumbing, solar, electrical, insulation, windows, painting, fencing, concrete, garage-doors, landscaping, kitchen, siding, gutters)
- isRepair (boolean)
- confidence (string, "high"/"medium"/"low")
- notes (string, brief job description)

Rules:
- Only extract actual prices the reviewer paid or was quoted
- Skip non-US
- Skip jobs under $1,000
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

function inflationAdjust(price, reviewTimeSec) {
  const ageMs = Date.now() - (reviewTimeSec * 1000);
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
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
  const placesKey = process.env.GOOGLE_PLACES_KEY;
  const adminKey = process.env.CAL_ADMIN_KEY;
  const dryRun = args["dry-run"] || false;
  const maxCities = parseInt(args["max-cities"] || "50");
  const targetService = args["service"] || null;

  if (!anthropicKey) { console.log("Set ANTHROPIC_API_KEY"); process.exit(1); }
  if (!placesKey) { console.log("Set GOOGLE_PLACES_KEY"); process.exit(1); }
  if (!adminKey && !dryRun) { console.log("Set CAL_ADMIN_KEY (or --dry-run)"); process.exit(1); }

  const services = targetService
    ? SERVICES.filter(s => s.service === targetService)
    : SERVICES;

  const cities = CITIES.slice(0, maxCities);
  let totalReviews = 0;
  let totalQuotes = 0;
  let totalSeeded = 0;

  console.log("Google Reviews Quote Seeder");
  console.log(`  Services: ${services.map(s => s.service).join(", ")}`);
  console.log(`  Cities: ${cities.length}`);
  console.log(`  Dry run: ${dryRun}\n`);

  for (const svc of services) {
    console.log(`\n=== ${svc.service.toUpperCase()} ===`);

    for (const city of cities) {
      console.log(`\n  ${city}:`);
      await sleep(500); // Rate limit Places API

      let places;
      try {
        places = await searchPlaces(svc.query, city, placesKey);
      } catch (e) {
        console.log(`    Places search error: ${e.message}`);
        continue;
      }

      if (places.length === 0) {
        console.log("    No contractors found.");
        continue;
      }

      console.log(`    Found ${places.length} contractors`);

      for (const place of places) {
        await sleep(500);

        let details;
        try {
          details = await getPlaceReviews(place.place_id, placesKey);
        } catch (e) {
          console.log(`    Reviews error for ${place.name}: ${e.message}`);
          continue;
        }

        if (details.reviews.length === 0) continue;

        console.log(`    ${details.name}: ${details.reviews.length} reviews with $ amounts`);

        for (const review of details.reviews) {
          totalReviews++;
          await sleep(1500); // Rate limit Haiku

          let parsed;
          try {
            parsed = await parseWithHaiku(review.text, details.name, details.address, svc.service, anthropicKey);
          } catch (e) {
            console.log(`      Haiku error: ${e.message}`);
            continue;
          }

          if (!parsed.quotes || parsed.quotes.length === 0) continue;

          for (const q of parsed.quotes) {
            if (!q.price || q.price < 1000 || q.confidence === "low") continue;
            totalQuotes++;

            const adjusted = inflationAdjust(q.price, review.time || Date.now() / 1000);
            console.log(`      $${q.price} -> $${adjusted} (${q.service}) ${q.city}, ${q.stateCode} [${q.confidence}]`);

            if (!dryRun) {
              try {
                await seedQuote({
                  type: "community_quote",
                  service: q.service || svc.service,
                  city: q.city,
                  stateCode: q.stateCode,
                  price: adjusted,
                  material: q.material || "",
                  roofSize: q.roofSize || 0,
                  contractor: q.contractor || details.name,
                  isRepair: q.isRepair || false,
                  source: "google_reviews",
                  sourceUrl: `https://maps.google.com/?cid=${place.place_id}`,
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
