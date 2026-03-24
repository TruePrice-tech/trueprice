// Community quote data endpoint
// Stores anonymized quote data to improve pricing models
// Uses Vercel KV (or falls back to in-memory for now)

const quotes = []; // In-memory fallback; replace with Vercel KV or database

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // POST: Submit a quote
  if (req.method === "POST") {
    try {
      const data = req.body;

      if (!data || !data.price || !data.material) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Validate
      const price = Number(data.price);
      if (!isFinite(price) || price < 100 || price > 500000) {
        return res.status(400).json({ error: "Invalid price" });
      }

      const entry = {
        price,
        material: String(data.material || "").substring(0, 50),
        city: String(data.city || "").substring(0, 100),
        stateCode: String(data.stateCode || "").substring(0, 5),
        roofSize: Number(data.roofSize) || null,
        serviceType: String(data.serviceType || "roofing").substring(0, 30),
        scopeConfirmed: Number(data.scopeConfirmed) || 0,
        scopeTotal: Number(data.scopeTotal) || 0,
        verdict: String(data.verdict || "").substring(0, 50),
        timestamp: new Date().toISOString()
        // NO personal data: no name, no address, no contractor, no phone
      };

      quotes.push(entry);

      // Keep only last 10,000 in memory
      if (quotes.length > 10000) quotes.shift();

      return res.status(200).json({ ok: true, count: quotes.length });
    } catch (e) {
      return res.status(500).json({ error: "Failed to store quote" });
    }
  }

  // GET: Retrieve aggregate stats for a city/service
  if (req.method === "GET") {
    const city = (req.query.city || "").toLowerCase();
    const state = (req.query.state || "").toUpperCase();
    const service = (req.query.service || "roofing").toLowerCase();
    const material = (req.query.material || "").toLowerCase();

    let filtered = quotes.filter(q =>
      q.serviceType.toLowerCase() === service
    );

    if (city && state) {
      const cityFiltered = filtered.filter(q =>
        q.city.toLowerCase() === city && q.stateCode.toUpperCase() === state
      );
      if (cityFiltered.length >= 3) filtered = cityFiltered;
    }

    if (material) {
      const matFiltered = filtered.filter(q =>
        q.material.toLowerCase().includes(material)
      );
      if (matFiltered.length >= 3) filtered = matFiltered;
    }

    if (filtered.length === 0) {
      return res.status(200).json({
        count: 0,
        low: null,
        mid: null,
        high: null,
        avgScope: null
      });
    }

    const prices = filtered.map(q => q.price).sort((a, b) => a - b);
    const low = prices[Math.floor(prices.length * 0.2)];
    const mid = prices[Math.floor(prices.length * 0.5)];
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
