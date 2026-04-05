import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Quote Trust Score Algorithm
function computeTrustScore(quote, modelEstimate) {
  let score = 0;
  const reasons = [];

  // 1. Has price (10 pts)
  if (quote.price && quote.price > 0) {
    score += 10;
    reasons.push("has_price");
  }

  // 2. Has contractor (8 pts)
  if (quote.contractor && quote.contractor.length > 2 && !quote.contractor.match(/^contractor\s*\d/i)) {
    score += 8;
    reasons.push("has_contractor");
  }

  // 3. Has address (10 pts)
  if ((quote.city && quote.stateCode) || quote.address) {
    score += 10;
    reasons.push("has_address");
  }

  // 4. Has scope items (10 pts)
  const scopeCount = quote.scopeItems ? Object.values(quote.scopeItems).filter(v => v === "included").length : 0;
  if (scopeCount >= 3) {
    score += 10;
    reasons.push("has_scope_items");
  }

  // 5. Has material (5 pts)
  if (quote.material && quote.material !== "unknown" && quote.material !== "Unknown") {
    score += 5;
    reasons.push("has_material");
  }

  // 6. Has roof size (8 pts)
  if (quote.roofSize && quote.roofSize > 500 && quote.roofSize < 15000) {
    score += 8;
    reasons.push("has_roof_size");
  }

  // 7. Price in range (15 pts)
  if (modelEstimate && modelEstimate > 0 && quote.price > 0) {
    const ratio = quote.price / modelEstimate;
    if (ratio >= 0.5 && ratio <= 2.0) {
      score += 15;
      reasons.push("price_in_range");
    } else if (ratio < 0.3 || ratio > 3.0) {
      // Obvious outlier - penalize
      score -= 10;
      reasons.push("price_outlier_penalty");
    }
  }

  // 8. Uploaded document (10 pts)
  if (quote.source === "upload" || quote.hasDocument) {
    score += 10;
    reasons.push("uploaded_document");
  }

  // 9. Unique session (8 pts) - checked separately via Redis
  if (!quote._tooManySubmissions) {
    score += 8;
    reasons.push("unique_session");
  }

  // 10. Has warranty (5 pts)
  if (quote.warrantyYears && quote.warrantyYears > 0) {
    score += 5;
    reasons.push("has_warranty");
  }

  // 11. Consistent math (6 pts)
  if (quote.lineItemTotal && quote.price) {
    const mathRatio = quote.lineItemTotal / quote.price;
    if (mathRatio >= 0.9 && mathRatio <= 1.1) {
      score += 6;
      reasons.push("consistent_math");
    }
  }

  // 12. Realistic per sqft (5 pts)
  if (quote.price > 0 && quote.roofSize > 0) {
    const perSqFt = quote.price / quote.roofSize;
    if (perSqFt >= 2 && perSqFt <= 35) {
      score += 5;
      reasons.push("realistic_per_sqft");
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function getInfluenceWeight(trustScore) {
  if (trustScore >= 90) return 1.0;
  if (trustScore >= 70) return 0.7;
  if (trustScore >= 50) return 0.4;
  if (trustScore >= 40) return 0.2;
  return 0.0;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://truepricehq.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // GET: Retrieve calibration data for a city/service
  if (req.method === "GET") {
    const { city, state, service } = req.query;
    if (!state) return res.status(400).json({ error: "Missing state" });

    const key = `cal:${(city || "").toLowerCase()}:${state.toUpperCase()}:${service || "roofing"}`;
    const data = await redis.get(key);

    if (!data) return res.status(200).json({ hasCalibration: false });

    return res.status(200).json({
      hasCalibration: true,
      ...data
    });
  }

  // POST: Submit a quote for calibration
  if (req.method === "POST") {
    const body = req.body;
    if (!body || !body.price) {
      return res.status(400).json({ error: "Missing quote data" });
    }

    // Admin mode: bypass rate limiting, set high trust for verified seed data
    // TODO: Set CAL_ADMIN_KEY in Vercel env vars to a strong random value (32+ chars)
    const adminKey = process.env.CAL_ADMIN_KEY;
    const isAdmin = adminKey && body.adminKey === adminKey;

    const ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown";

    if (!isAdmin) {
      // Rate limit: max 3 submissions per IP per 24 hours
      const rateLimitKey = `cal_rate:${ip}`;
      const submissions = await redis.get(rateLimitKey) || 0;
      if (submissions >= 3) {
        return res.status(429).json({ error: "Too many submissions. Try again tomorrow." });
      }
      // Update rate limit
      await redis.set(rateLimitKey, submissions + 1, { ex: 24 * 60 * 60 });
    }

    // Reject suspicious quotes
    const submittedPrice = Number(body.price) || 0;
    if (submittedPrice <= 0) {
      return res.status(400).json({ error: "Price must be greater than zero" });
    }
    if (submittedPrice > 500000) {
      return res.status(400).json({ error: "Price exceeds realistic maximum for home services" });
    }

    // Duplicate check: same price + city + service within 5 minutes
    if (!isAdmin && body.city && body.service) {
      const dupKey = `cal_dup:${submittedPrice}:${(body.city || "").toLowerCase()}:${body.service || "roofing"}`;
      try {
        const existing = await redis.get(dupKey);
        if (existing) {
          return res.status(429).json({ error: "Duplicate submission detected. Please wait before resubmitting." });
        }
        await redis.set(dupKey, "1", { ex: 300 }); // 5 minute TTL
      } catch (e) {
        // If Redis fails on dup check, allow the request through
      }
    }

    // Build quote object
    const quote = {
      price: Number(body.price) || 0,
      contractor: body.contractor || "",
      city: body.city || "",
      stateCode: (body.stateCode || body.state || "").toUpperCase(),
      material: body.material || "",
      roofSize: Number(body.roofSize) || 0,
      warrantyYears: Number(body.warrantyYears) || 0,
      scopeItems: body.scopeItems || {},
      source: isAdmin ? "verified_seed" : (body.source || "manual"),
      hasDocument: !!body.hasDocument,
      lineItemTotal: Number(body.lineItemTotal) || 0,
      _tooManySubmissions: false,
      timestamp: Date.now(),
      ip: isAdmin ? "admin" : ip.split(",")[0].trim(),
      notes: body.notes || ""
    };

    // Compute trust score
    let score, reasons, weight;
    const source = quote.source;
    if (isAdmin) {
      score = 90;
      reasons = ["admin_verified_seed"];
      weight = 1.0;
    } else if (source === "user_confirmed_helpful") {
      // User clicked "Yes helpful" on a quote analysis - confirmed real quote
      score = 55;
      reasons = ["user_confirmed_analysis"];
      weight = 0.4;
    } else if (source === "photo_feedback_accurate") {
      // User said photo estimate "looks right" - confirms model pricing
      score = 45;
      reasons = ["photo_feedback_confirms_model"];
      weight = 0.2;
    } else if (source === "photo_feedback_high" || source === "photo_feedback_low") {
      // User said estimate seems high/low - directional nudge
      score = 40;
      reasons = ["photo_feedback_directional"];
      weight = 0.15;
    } else if (source === "compare_upload") {
      // Quote uploaded via compare tool - real quote, no document flag
      const modelEstimate = Number(body.modelEstimate) || 0;
      const result = computeTrustScore(quote, modelEstimate);
      score = result.score;
      reasons = result.reasons;
      weight = getInfluenceWeight(score);
    } else {
      const modelEstimate = Number(body.modelEstimate) || 0;
      const result = computeTrustScore(quote, modelEstimate);
      score = result.score;
      reasons = result.reasons;
      weight = getInfluenceWeight(score);
    }

    quote.trustScore = score;
    quote.trustReasons = reasons;
    quote.influenceWeight = weight;

    // Store the quote
    const service = body.service || "roofing";
    const quoteKey = `cal_quote:${quote.city.toLowerCase()}:${quote.stateCode}:${service}:${Date.now()}`;
    await redis.set(quoteKey, JSON.stringify(quote), { ex: 365 * 24 * 60 * 60 }); // 1 year TTL

    // Increment global quote counter (used by public counter endpoint)
    await redis.incr("tp:total_quotes").catch(() => {});

    // Update the city calibration aggregate (score >= 40 filters low-trust outliers)
    if (weight > 0 && score >= 40 && quote.city && quote.stateCode) {
      const calKey = `cal:${quote.city.toLowerCase()}:${quote.stateCode}:${service}`;
      const existing = await redis.get(calKey) || { quotes: 0, weightedSum: 0, totalWeight: 0, avgPrice: 0, lastUpdated: 0 };

      existing.quotes += 1;
      existing.weightedSum += quote.price * weight;
      existing.totalWeight += weight;
      existing.avgPrice = Math.round(existing.weightedSum / existing.totalWeight);
      existing.lastUpdated = Date.now();

      await redis.set(calKey, JSON.stringify(existing));
    }

    return res.status(200).json({
      ok: true,
      trustScore: score,
      trustReasons: reasons,
      influenceWeight: weight,
      accepted: weight > 0,
      source: quote.source
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
