/**
 * Seed the calibration database with known real quotes.
 * Run with: node scripts/seed-calibration.js
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 */

const seedQuotes = [
  {
    price: 18260,
    contractor: "Crosby Roofing",
    city: "Evans",
    stateCode: "GA",
    material: "architectural",
    roofSize: 4200,
    warrantyYears: 0,
    scopeItems: {
      tearOff: "included", underlayment: "included", flashing: "included",
      iceShield: "included", dripEdge: "included", ventilation: "included",
      ridgeVent: "included", decking: "included", disposal: "included",
      permit: "included"
    },
    source: "verified_real_quote",
    hasDocument: true,
    trustScore: 95,
    influenceWeight: 1.0,
    timestamp: Date.now(),
    notes: "Real quote uploaded and analyzed. Evans GA, 42 squares architectural."
  }
];

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log("Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
    console.log("These are in your Vercel environment variables.");
    console.log("");
    console.log("Run like: UPSTASH_REDIS_REST_URL=xxx UPSTASH_REDIS_REST_TOKEN=yyy node scripts/seed-calibration.js");
    process.exit(1);
  }

  for (const quote of seedQuotes) {
    const service = "roofing";

    // Store individual quote
    const quoteKey = `cal_quote:${quote.city.toLowerCase()}:${quote.stateCode}:${service}:${quote.timestamp}`;
    await redisSet(url, token, quoteKey, JSON.stringify(quote), 365 * 24 * 60 * 60);
    console.log("Stored quote:", quoteKey);

    // Update aggregate
    const calKey = `cal:${quote.city.toLowerCase()}:${quote.stateCode}:${service}`;
    const existing = await redisGet(url, token, calKey);
    const cal = existing ? JSON.parse(existing) : { quotes: 0, weightedSum: 0, totalWeight: 0, avgPrice: 0, lastUpdated: 0 };

    cal.quotes += 1;
    cal.weightedSum += quote.price * quote.influenceWeight;
    cal.totalWeight += quote.influenceWeight;
    cal.avgPrice = Math.round(cal.weightedSum / cal.totalWeight);
    cal.lastUpdated = Date.now();

    await redisSet(url, token, calKey, JSON.stringify(cal));
    console.log("Updated calibration:", calKey, "->", cal);
  }

  console.log("\nDone. Seeded", seedQuotes.length, "quotes.");
}

async function redisSet(url, token, key, value, ex) {
  const body = ex
    ? ["SET", key, value, "EX", String(ex)]
    : ["SET", key, value];
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function redisGet(url, token, key) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(["GET", key])
  });
  const data = await res.json();
  return data.result;
}

main().catch(console.error);
