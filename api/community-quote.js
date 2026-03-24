// Community quote data endpoint
// Stores anonymized quote data to improve pricing models
// Uses in-memory storage (replace with Vercel KV or database for persistence)

const quotes = [];
const rateLimits = {}; // IP -> { count, resetTime }

// Price sanity ranges by material ($/sqft)
const PRICE_RANGES = {
  asphalt:       { minPerSqft: 2.5,  maxPerSqft: 12 },
  architectural: { minPerSqft: 3.5,  maxPerSqft: 15 },
  metal:         { minPerSqft: 7,    maxPerSqft: 25 },
  tile:          { minPerSqft: 10,   maxPerSqft: 35 },
  // Non-roofing services: use generous ranges
  default:       { minPerSqft: 0,    maxPerSqft: 0 }  // skip sqft check for non-roofing
};

const VALID_MATERIALS = new Set([
  "asphalt", "architectural", "metal", "tile",
  "central_ac", "heat_pump", "furnace", "mini_split", "full_system",
  "water_heater", "repipe", "sewer_line", "drain_cleaning",
  "panel_upgrade", "rewire", "ev_charger",
  "vinyl", "fiberglass", "wood",
  "blown_in", "spray_foam", "batts",
  "standard", "premium",
  "wood_fence", "vinyl_fence", "chain_link", "aluminum_fence",
  "concrete", "stamped", "asphalt_driveway",
  "pavers", "sod", "retaining_wall",
  "single_car", "double_car",
  "solar_standard", "solar_premium",
  "pier", "slabjacking", "wall_stabilization",
  "minor_remodel", "mid_remodel", "major_remodel",
  "unknown"
]);

const VALID_VERDICTS = new Set([
  "Fair Price", "Higher Than Expected", "Overpriced",
  "Unusually Low", "Possible Scope Risk",
  "Possibly Overpriced", "May Be Overpriced",
  ""
]);

function getClientIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
         req.headers["x-real-ip"] ||
         "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  if (!rateLimits[ip] || rateLimits[ip].resetTime < now) {
    rateLimits[ip] = { count: 0, resetTime: now + 3600000 }; // 1 hour window
  }
  rateLimits[ip].count++;
  return rateLimits[ip].count > 20; // Max 20 submissions per hour per IP
}

function isDuplicate(entry) {
  // Reject if same price + city + material submitted in last 5 minutes
  const fiveMinAgo = new Date(Date.now() - 300000).toISOString();
  return quotes.some(q =>
    q.price === entry.price &&
    q.city === entry.city &&
    q.material === entry.material &&
    q.timestamp > fiveMinAgo
  );
}

function isPriceReasonable(price, material, roofSize, serviceType) {
  // For roofing: validate price per sqft against known ranges
  if (serviceType === "roofing" && roofSize > 0) {
    const pricePerSqft = price / roofSize;
    const range = PRICE_RANGES[material] || PRICE_RANGES.default;
    if (range.minPerSqft > 0 && pricePerSqft < range.minPerSqft * 0.5) return false;
    if (range.maxPerSqft > 0 && pricePerSqft > range.maxPerSqft * 2.0) return false;
  }

  // General: reject extreme outliers
  if (serviceType === "roofing" && (price < 1000 || price > 150000)) return false;
  if (serviceType === "hvac" && (price < 500 || price > 50000)) return false;
  if (serviceType === "plumbing" && (price < 100 || price > 30000)) return false;

  return true;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // POST: Submit a quote
  if (req.method === "POST") {
    try {
      // Rate limiting
      const ip = getClientIP(req);
      if (isRateLimited(ip)) {
        return res.status(429).json({ error: "Too many submissions. Try again later." });
      }

      const data = req.body;
      if (!data || !data.price || !data.material) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const price = Number(data.price);
      if (!isFinite(price) || price < 100 || price > 500000) {
        return res.status(400).json({ error: "Invalid price" });
      }

      const material = String(data.material || "unknown").toLowerCase().substring(0, 50);
      const serviceType = String(data.serviceType || "roofing").toLowerCase().substring(0, 30);
      const roofSize = Number(data.roofSize) || 0;
      const city = String(data.city || "").substring(0, 100).trim();
      const stateCode = String(data.stateCode || "").substring(0, 5).toUpperCase().trim();
      const scopeConfirmed = Math.max(0, Math.min(20, Number(data.scopeConfirmed) || 0));
      const scopeTotal = Math.max(0, Math.min(20, Number(data.scopeTotal) || 0));
      const verdict = String(data.verdict || "").substring(0, 50);

      // Validate material is known
      if (!VALID_MATERIALS.has(material) && material !== "unknown") {
        return res.status(400).json({ error: "Unknown material type", rejected: true });
      }

      // Validate verdict is legitimate
      if (verdict && !VALID_VERDICTS.has(verdict)) {
        return res.status(400).json({ error: "Unknown verdict", rejected: true });
      }

      // Price sanity check
      if (!isPriceReasonable(price, material, roofSize, serviceType)) {
        return res.status(200).json({ ok: true, accepted: false, reason: "Price outside expected range for this material and size" });
      }

      // Reject quotes with very low scope AND low confidence verdicts
      if (scopeConfirmed < 2 && scopeTotal > 5 && (verdict === "Possible Scope Risk" || verdict === "Unusually Low")) {
        return res.status(200).json({ ok: true, accepted: false, reason: "Low confidence data excluded from benchmarks" });
      }

      const entry = {
        price,
        material,
        city: city.toLowerCase(),
        stateCode,
        roofSize: roofSize > 0 ? roofSize : null,
        serviceType,
        scopeConfirmed,
        scopeTotal,
        verdict,
        timestamp: new Date().toISOString()
      };

      // Check for duplicates
      if (isDuplicate(entry)) {
        return res.status(200).json({ ok: true, accepted: false, reason: "Duplicate submission" });
      }

      quotes.push(entry);

      // Keep only last 10,000 in memory
      if (quotes.length > 10000) quotes.shift();

      return res.status(200).json({ ok: true, accepted: true, count: quotes.length });
    } catch (e) {
      return res.status(500).json({ error: "Failed to process quote" });
    }
  }

  // GET: Retrieve aggregate stats
  if (req.method === "GET") {
    const city = (req.query.city || "").toLowerCase().trim();
    const state = (req.query.state || "").toUpperCase().trim();
    const service = (req.query.service || "roofing").toLowerCase();
    const material = (req.query.material || "").toLowerCase();

    // Only use accepted (reasonable) quotes for stats
    let filtered = quotes.filter(q =>
      q.serviceType === service
    );

    if (city && state) {
      const cityFiltered = filtered.filter(q =>
        q.city === city && q.stateCode === state
      );
      if (cityFiltered.length >= 3) filtered = cityFiltered;
    }

    if (material) {
      const matFiltered = filtered.filter(q =>
        q.material.includes(material)
      );
      if (matFiltered.length >= 3) filtered = matFiltered;
    }

    if (filtered.length < 3) {
      return res.status(200).json({
        count: filtered.length,
        low: null, mid: null, high: null,
        avgScope: null,
        note: filtered.length > 0 ? "Not enough data yet for reliable stats" : null
      });
    }

    // Use trimmed mean (exclude top/bottom 10%) for outlier resistance
    const prices = filtered.map(q => q.price).sort((a, b) => a - b);
    const trimStart = Math.floor(prices.length * 0.1);
    const trimEnd = Math.ceil(prices.length * 0.9);
    const trimmedPrices = prices.slice(trimStart, trimEnd);

    const low = prices[Math.floor(prices.length * 0.2)];
    const mid = trimmedPrices.length > 0
      ? trimmedPrices.reduce((s, p) => s + p, 0) / trimmedPrices.length
      : prices[Math.floor(prices.length * 0.5)];
    const high = prices[Math.floor(prices.length * 0.8)];
    const avgScope = filtered.reduce((s, q) => s + (q.scopeConfirmed || 0), 0) / filtered.length;

    return res.status(200).json({
      count: filtered.length,
      low: Math.round(low),
      mid: Math.round(mid),
      high: Math.round(high),
      avgScope: Math.round(avgScope * 10) / 10
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
