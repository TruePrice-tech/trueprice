import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

function computeContractorScore(data) {
  const hasReviews = data.reviewCount > 0;
  // If no reviews, redistribute that 15% weight across other categories
  const reviewWeight = hasReviews ? 15 : 0;
  const boost = hasReviews ? 1.0 : 100 / 85; // Scale up other categories

  let score = 0;
  const breakdown = {};

  // 1. Price fairness (25 pts)
  if (data.quoteCount > 0 && data.avgPriceRatio > 0) {
    const deviation = Math.abs(1 - data.avgPriceRatio);
    let pf;
    if (deviation <= 0.10) pf = 25;
    else if (deviation <= 0.20) pf = 20;
    else if (deviation <= 0.30) pf = 15;
    else pf = 5;
    // Bonus: slightly below market is better than above
    if (data.avgPriceRatio < 1.0 && deviation <= 0.15) pf = 25;
    breakdown.priceFairness = Math.round(pf * boost);
    score += breakdown.priceFairness;
  }

  // 2. Scope completeness (25 pts)
  if (data.quoteCount > 0) {
    const avgScope = data.totalScopeItems / data.quoteCount;
    let sc;
    if (avgScope >= 10) sc = 25;
    else if (avgScope >= 8) sc = 20;
    else if (avgScope >= 6) sc = 15;
    else sc = 5;
    breakdown.scopeCompleteness = Math.round(sc * boost);
    score += breakdown.scopeCompleteness;
  }

  // 3. Transparency (15 pts)
  if (data.quoteCount > 0) {
    let tp = 0;
    if (data.hasMaterial) tp += 3;
    if (data.hasWarranty) tp += 3;
    if (data.avgRedFlags <= 0) tp += 4;
    else if (data.avgRedFlags <= 1) tp += 2;
    if (data.hasRoofSize || data.quoteCount > 0) tp += 3;
    tp += 2; // Base credit for having a parseable quote
    breakdown.transparency = Math.round(Math.min(15, tp) * boost);
    score += breakdown.transparency;
  }

  // 4. Warranty (10 pts)
  if (data.quoteCount > 0) {
    const avgWarranty = data.totalWarrantyYears / data.quoteCount;
    let w;
    if (avgWarranty >= 10) w = 10;
    else if (avgWarranty >= 5) w = 7;
    else if (avgWarranty >= 1) w = 4;
    else w = 0;
    breakdown.warranty = Math.round(w * boost);
    score += breakdown.warranty;
  }

  // 5. Red flags (10 pts)
  if (data.quoteCount > 0) {
    const avgFlags = data.avgRedFlags;
    let rf;
    if (avgFlags === 0) rf = 10;
    else if (avgFlags <= 1) rf = 7;
    else if (avgFlags <= 2) rf = 4;
    else rf = 0;
    breakdown.redFlags = Math.round(rf * boost);
    score += breakdown.redFlags;
  }

  // 6. User rating (15 pts, only if reviews exist)
  if (hasReviews) {
    const avgRating = data.totalRating / data.reviewCount;
    let ur;
    if (avgRating >= 4.5) ur = 15;
    else if (avgRating >= 4.0) ur = 12;
    else if (avgRating >= 3.0) ur = 8;
    else ur = 3;
    breakdown.userRating = ur;
    score += ur;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    breakdown,
    label: score >= 90 ? "Excellent" : score >= 75 ? "Very Good" : score >= 60 ? "Good" : score >= 45 ? "Fair" : "Needs Improvement"
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://truepricehq.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // GET: Retrieve contractor score
  if (req.method === "GET") {
    const { contractor, city, state } = req.query;
    if (!contractor) return res.status(400).json({ error: "Missing contractor name" });

    const key = `ctr:${contractor.toLowerCase().replace(/[^a-z0-9]/g, "_")}:${(city || "").toLowerCase()}:${(state || "").toUpperCase()}`;
    const data = await redis.get(key);

    if (!data) return res.status(200).json({ found: false });

    const scored = computeContractorScore(data);
    return res.status(200).json({
      found: true,
      contractor: data.contractor,
      city: data.city,
      state: data.state,
      quoteCount: data.quoteCount,
      reviewCount: data.reviewCount,
      ...scored
    });
  }

  // POST: Submit quote data or user review
  if (req.method === "POST") {
    const body = req.body;
    if (!body) return res.status(400).json({ error: "Missing body" });

    const action = body.action; // "quote" or "review"
    const contractorName = (body.contractor || "").trim();
    if (!contractorName || contractorName.length < 2) {
      return res.status(400).json({ error: "Missing contractor name" });
    }

    const city = (body.city || "").trim();
    const stateCode = (body.stateCode || body.state || "").trim().toUpperCase();
    const key = `ctr:${contractorName.toLowerCase().replace(/[^a-z0-9]/g, "_")}:${city.toLowerCase()}:${stateCode}`;

    // Get or create contractor record
    const existing = await redis.get(key) || {
      contractor: contractorName,
      city: city,
      state: stateCode,
      quoteCount: 0,
      totalScopeItems: 0,
      totalWarrantyYears: 0,
      totalRedFlags: 0,
      avgRedFlags: 0,
      avgPriceRatio: 0,
      priceRatioSum: 0,
      hasMaterial: false,
      hasWarranty: false,
      hasRoofSize: false,
      reviewCount: 0,
      totalRating: 0,
      totalHonoredPrice: 0,
      totalOnTime: 0,
      totalQuality: 0,
      totalWouldRecommend: 0,
      reviews: [],
      lastUpdated: 0
    };

    if (action === "quote") {
      // Update from quote analysis data
      const scopeCount = Number(body.scopeCount) || 0;
      const warrantyYears = Number(body.warrantyYears) || 0;
      const redFlagCount = Number(body.redFlagCount) || 0;
      const priceRatio = Number(body.priceRatio) || 0; // quote price / model estimate

      existing.quoteCount += 1;
      existing.totalScopeItems += scopeCount;
      existing.totalWarrantyYears += warrantyYears;
      existing.totalRedFlags += redFlagCount;
      existing.avgRedFlags = existing.totalRedFlags / existing.quoteCount;
      if (priceRatio > 0) {
        existing.priceRatioSum += priceRatio;
        existing.avgPriceRatio = existing.priceRatioSum / existing.quoteCount;
      }
      if (body.material && body.material !== "unknown") existing.hasMaterial = true;
      if (warrantyYears > 0) existing.hasWarranty = true;
      if (body.roofSize > 0) existing.hasRoofSize = true;
      existing.lastUpdated = Date.now();

    } else if (action === "review") {
      // Rate limit reviews
      const ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown";
      const reviewRateKey = `ctr_review_rate:${ip}`;
      const reviewCount = await redis.get(reviewRateKey) || 0;
      if (reviewCount >= 5) {
        return res.status(429).json({ error: "Too many reviews. Try again tomorrow." });
      }

      const rating = Math.max(1, Math.min(5, Number(body.rating) || 3));
      const honoredPrice = body.honoredPrice === true || body.honoredPrice === "yes";
      const onTime = body.onTime === true || body.onTime === "yes";
      const qualityRating = Math.max(1, Math.min(5, Number(body.qualityRating) || 3));
      const wouldRecommend = body.wouldRecommend === true || body.wouldRecommend === "yes";
      const comment = (body.comment || "").trim().slice(0, 500);

      existing.reviewCount += 1;
      existing.totalRating += rating;
      existing.totalHonoredPrice += honoredPrice ? 1 : 0;
      existing.totalOnTime += onTime ? 1 : 0;
      existing.totalQuality += qualityRating;
      existing.totalWouldRecommend += wouldRecommend ? 1 : 0;

      // Store individual review (keep last 20)
      existing.reviews = existing.reviews || [];
      existing.reviews.unshift({
        rating,
        honoredPrice,
        onTime,
        qualityRating,
        wouldRecommend,
        comment,
        timestamp: Date.now()
      });
      if (existing.reviews.length > 20) existing.reviews = existing.reviews.slice(0, 20);
      existing.lastUpdated = Date.now();

      await redis.set(reviewRateKey, reviewCount + 1, { ex: 24 * 60 * 60 });
    } else {
      return res.status(400).json({ error: "action must be 'quote' or 'review'" });
    }

    await redis.set(key, JSON.stringify(existing));

    const scored = computeContractorScore(existing);
    return res.status(200).json({
      ok: true,
      contractor: contractorName,
      quoteCount: existing.quoteCount,
      reviewCount: existing.reviewCount,
      ...scored
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
