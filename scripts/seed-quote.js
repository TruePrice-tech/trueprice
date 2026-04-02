/**
 * Seed a real quote into the calibration system via the API.
 *
 * Usage:
 *   CAL_ADMIN_KEY=yourkey node scripts/seed-quote.js
 *
 * Or set CAL_ADMIN_KEY in your environment and run directly.
 * The admin key must match the CAL_ADMIN_KEY env var in Vercel.
 */

const API_URL = "https://truepricehq.com/api/calibration";

// Add quotes here as you find them (Reddit, forums, real data, etc.)
const quotes = [
  {
    price: 18000,
    contractor: "Reddit poster quote 1",
    city: "Kansas City",  // "central Midwest" - using KC as representative
    stateCode: "MO",
    material: "architectural",  // class 3 = architectural
    roofSize: 3400,
    warrantyYears: 0,
    service: "roofing",
    notes: "Reddit r/roofing - central Midwest, 3400sqft, class 3 shingles, lower of two quotes"
  },
  {
    price: 22000,
    contractor: "Reddit poster quote 2",
    city: "Kansas City",
    stateCode: "MO",
    material: "architectural",
    roofSize: 3400,
    warrantyYears: 0,
    service: "roofing",
    notes: "Reddit r/roofing - central Midwest, 3400sqft, class 3 shingles, higher of two quotes"
  }
];

async function main() {
  const adminKey = process.env.CAL_ADMIN_KEY;
  if (!adminKey) {
    console.log("Set CAL_ADMIN_KEY environment variable.");
    console.log("This must match the CAL_ADMIN_KEY in your Vercel env vars.");
    console.log("\nUsage: CAL_ADMIN_KEY=yourkey node scripts/seed-quote.js");
    process.exit(1);
  }

  for (const quote of quotes) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...quote, adminKey })
    });
    const data = await res.json();
    console.log(`${quote.city}, ${quote.stateCode} - $${quote.price.toLocaleString()}: ${data.ok ? "OK" : "FAILED"}`, data);
  }

  console.log("\nDone. Seeded", quotes.length, "quotes.");
}

main().catch(console.error);
