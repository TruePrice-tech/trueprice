// Contractor directory endpoint — self-signup and search
// In-memory storage (replace with Vercel KV for persistence)

import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

let redis = null;
try { redis = Redis.fromEnv(); } catch(e) { /* Redis unavailable */ }

// Services excluded from ranking (legal/medical risk)
const NO_RANK_SERVICES = new Set(["medical", "legal"]);

const contractors = [];
const rateLimits = {};

// Load seed contractors on first init
let seedLoaded = false;
function loadSeedData() {
  if (seedLoaded) return;
  seedLoaded = true;
  try {
    const seedPath = path.join(__dirname, "..", "data", "seed-contractors.json");
    const raw = fs.readFileSync(seedPath, "utf-8");
    const seedData = JSON.parse(raw);
    seedData.forEach((entry, i) => {
      contractors.push({
        id: "seed_" + i,
        companyName: entry.companyName,
        contactName: "",
        email: entry.email || "",
        phone: entry.phone || "",
        website: entry.website || "",
        services: entry.services,
        states: entry.states,
        cities: entry.cities || [],
        licenseNumber: entry.licenseNumber || "",
        yearsInBusiness: entry.yearsInBusiness || 0,
        claimed: false,
        submittedAt: new Date("2025-01-01").toISOString()
      });
    });
  } catch (e) {
    // Seed file not found or invalid — continue without seed data
  }
}

const VALID_SERVICES = new Set([
  "roof", "hvac", "plumbing", "electrical", "window", "siding",
  "painting", "solar", "garage-door", "fence", "concrete",
  "landscaping", "foundation", "kitchen-remodel", "insulation"
]);

const SERVICE_LABELS = {
  roof: "Roofing", hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical",
  window: "Windows", siding: "Siding", painting: "Painting", solar: "Solar",
  "garage-door": "Garage Doors", fence: "Fencing", concrete: "Concrete",
  landscaping: "Landscaping", foundation: "Foundation", "kitchen-remodel": "Kitchen",
  insulation: "Insulation"
};

function getClientIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
         req.headers["x-real-ip"] || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  if (!rateLimits[ip] || rateLimits[ip].resetTime < now) {
    rateLimits[ip] = { count: 0, resetTime: now + 3600000 };
  }
  rateLimits[ip].count++;
  return rateLimits[ip].count > 5;
}

function isDuplicate(companyName, email) {
  const name = companyName.toLowerCase().trim();
  const mail = email.toLowerCase().trim();
  return contractors.some(c => c.companyName.toLowerCase() === name && c.email.toLowerCase() === mail);
}

export default async function handler(req, res) {
  loadSeedData();
  const allowedOrigin = "https://truepricehq.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // POST: Contractor signup
  if (req.method === "POST") {
    try {
      const ip = getClientIP(req);
      if (isRateLimited(ip)) {
        return res.status(429).json({ error: "Too many signups. Try again later." });
      }

      const data = req.body;
      if (!data) return res.status(400).json({ error: "Missing request body" });

      const companyName = String(data.companyName || "").substring(0, 100).trim();
      const contactName = String(data.contactName || "").substring(0, 100).trim();
      const email = String(data.email || "").substring(0, 100).trim().toLowerCase();
      const phone = String(data.phone || "").substring(0, 20).trim();
      const website = String(data.website || "").substring(0, 200).trim();
      const licenseNumber = String(data.licenseNumber || "").substring(0, 50).trim();
      const yearsInBusiness = Math.max(0, Math.min(100, Number(data.yearsInBusiness) || 0));

      // Validate required fields
      if (!companyName || companyName.length < 2) {
        return res.status(400).json({ error: "Company name is required" });
      }
      if (!contactName || contactName.length < 2) {
        return res.status(400).json({ error: "Contact name is required" });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      if (!phone || phone.replace(/\D/g, "").length < 10) {
        return res.status(400).json({ error: "Valid phone number is required" });
      }

      // Validate services
      const services = Array.isArray(data.services) ? data.services.filter(s => VALID_SERVICES.has(s)) : [];
      if (services.length === 0) {
        return res.status(400).json({ error: "Select at least one service" });
      }

      // Validate service area
      const states = Array.isArray(data.states)
        ? data.states.filter(s => /^[A-Z]{2}$/.test(s)).slice(0, 52)
        : [];
      const cities = Array.isArray(data.cities)
        ? data.cities.map(c => String(c).substring(0, 60).trim().toLowerCase()).filter(Boolean).slice(0, 50)
        : [];

      if (states.length === 0 && cities.length === 0) {
        return res.status(400).json({ error: "Select at least one state or city for your service area" });
      }

      // Honeypot check (hidden field — bots fill it)
      if (data._hp && String(data._hp).trim() !== "") {
        return res.status(200).json({ ok: true, id: "ctr_" + Date.now() });
      }

      // Duplicate check
      if (isDuplicate(companyName, email)) {
        return res.status(200).json({ ok: true, duplicate: true, message: "This business is already listed." });
      }

      // If claiming a seed listing, remove the old unclaimed entry
      const claimName = companyName.toLowerCase();
      const seedIdx = contractors.findIndex(c => !c.claimed && c.companyName.toLowerCase() === claimName);
      if (seedIdx !== -1) {
        contractors.splice(seedIdx, 1);
      }

      const entry = {
        id: "ctr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        companyName,
        contactName,
        email,
        phone,
        website,
        services,
        states,
        cities,
        licenseNumber,
        yearsInBusiness,
        claimed: true,
        submittedAt: new Date().toISOString()
      };

      contractors.push(entry);
      if (contractors.length > 5000) contractors.shift();

      return res.status(200).json({ ok: true, id: entry.id });
    } catch (e) {
      return res.status(500).json({ error: "Signup failed" });
    }
  }

  // GET: Search directory
  if (req.method === "GET") {
    const city = (req.query.city || "").toLowerCase().trim();
    const state = (req.query.state || "").toUpperCase().trim();
    const service = (req.query.service || "").toLowerCase().trim();

    let filtered = [...contractors];

    // Filter by location
    if (city) {
      filtered = filtered.filter(c =>
        c.cities.includes(city) || c.states.includes(state)
      );
    } else if (state) {
      filtered = filtered.filter(c => c.states.includes(state));
    }

    // Filter by service
    if (service && VALID_SERVICES.has(service)) {
      filtered = filtered.filter(c => c.services.includes(service));
    }

    // Look up tier and score data from Redis for claimed contractors
    const tierMap = {};
    const scoreMap = {};
    if (redis) {
      try {
        // Batch lookup tiers from onboard records
        const claimedEmails = filtered.filter(c => c.claimed && c.email).map(c => c.email);
        for (const email of claimedEmails.slice(0, 50)) {
          const rec = await redis.get(`contractor:${email}`);
          if (rec) {
            const parsed = typeof rec === "string" ? JSON.parse(rec) : rec;
            tierMap[email] = parsed.tier || "basic";
          }
        }
        // Batch lookup scores
        for (const c of filtered.filter(c => c.claimed).slice(0, 50)) {
          const scoreKey = `ctr:${c.companyName.toLowerCase().replace(/[^a-z0-9]/g, "_")}:${(c.cities?.[0] || "").toLowerCase()}:${(c.states?.[0] || "").toUpperCase()}`;
          const scoreData = await redis.get(scoreKey);
          if (scoreData) {
            const parsed = typeof scoreData === "string" ? JSON.parse(scoreData) : scoreData;
            if (parsed.quoteCount > 0 || parsed.reviewCount > 0) {
              scoreMap[c.companyName] = parsed;
            }
          }
        }
      } catch(e) { /* Redis lookup failed, continue without tier/score data */ }
    }

    // Compute scores for sorting
    function computeScore(data) {
      if (!data || (data.quoteCount === 0 && data.reviewCount === 0)) return null;
      const hasReviews = data.reviewCount > 0;
      const boost = hasReviews ? 1.0 : 100 / 85;
      let score = 0;
      if (data.quoteCount > 0 && data.avgPriceRatio > 0) {
        const dev = Math.abs(1 - data.avgPriceRatio);
        let pf = dev <= 0.10 ? 25 : dev <= 0.20 ? 20 : dev <= 0.30 ? 15 : 5;
        if (data.avgPriceRatio < 1.0 && dev <= 0.15) pf = 25;
        score += Math.round(pf * boost);
      }
      if (data.quoteCount > 0) {
        const avgScope = data.totalScopeItems / data.quoteCount;
        score += Math.round((avgScope >= 10 ? 25 : avgScope >= 8 ? 20 : avgScope >= 6 ? 15 : 5) * boost);
        let tp = 0;
        if (data.hasMaterial) tp += 3; if (data.hasWarranty) tp += 3;
        if (data.avgRedFlags <= 0) tp += 4; else if (data.avgRedFlags <= 1) tp += 2;
        tp += 5;
        score += Math.round(Math.min(15, tp) * boost);
        const avgW = data.totalWarrantyYears / data.quoteCount;
        score += Math.round((avgW >= 10 ? 10 : avgW >= 5 ? 7 : avgW >= 1 ? 4 : 0) * boost);
        score += Math.round((data.avgRedFlags === 0 ? 10 : data.avgRedFlags <= 1 ? 7 : data.avgRedFlags <= 2 ? 4 : 0) * boost);
      }
      if (hasReviews) {
        const avg = data.totalRating / data.reviewCount;
        score += avg >= 4.5 ? 15 : avg >= 4.0 ? 12 : avg >= 3.0 ? 8 : 3;
      }
      return Math.max(0, Math.min(100, Math.round(score)));
    }

    // Tier priority: featured=3, verified=2, basic=1, unclaimed=0
    const TIER_PRIORITY = { featured: 3, verified: 2, basic: 1 };

    // Sort: featured > verified > basic > unclaimed, then by score, then by years
    filtered.sort((a, b) => {
      const aClaimed = a.claimed !== false;
      const bClaimed = b.claimed !== false;
      if (aClaimed && !bClaimed) return -1;
      if (!aClaimed && bClaimed) return 1;
      if (aClaimed && bClaimed) {
        const aTier = TIER_PRIORITY[tierMap[a.email] || "basic"] || 1;
        const bTier = TIER_PRIORITY[tierMap[b.email] || "basic"] || 1;
        if (aTier !== bTier) return bTier - aTier;
        const aScore = scoreMap[a.companyName] ? (computeScore(scoreMap[a.companyName]) || 0) : 0;
        const bScore = scoreMap[b.companyName] ? (computeScore(scoreMap[b.companyName]) || 0) : 0;
        if (aScore !== bScore) return bScore - aScore;
        return (b.yearsInBusiness || 0) - (a.yearsInBusiness || 0);
      }
      return 0;
    });

    // Return public fields with tier, score, badge (no email, no IP)
    const publicList = filtered.slice(0, 50).map(c => {
      const isClaimed = c.claimed !== false;
      const tier = isClaimed ? (tierMap[c.email] || "basic") : null;
      const rawScore = scoreMap[c.companyName] ? computeScore(scoreMap[c.companyName]) : null;
      const scoreLabel = rawScore >= 90 ? "Excellent" : rawScore >= 75 ? "Very Good" : rawScore >= 60 ? "Good" : rawScore >= 45 ? "Fair" : rawScore !== null ? "Needs Improvement" : null;
      return {
        id: c.id,
        companyName: c.companyName,
        phone: isClaimed ? c.phone : "",
        website: isClaimed ? c.website : "",
        services: c.services,
        serviceLabels: c.services.map(s => SERVICE_LABELS[s] || s),
        states: c.states,
        cities: c.cities,
        licenseNumber: isClaimed ? (c.licenseNumber || null) : null,
        yearsInBusiness: c.yearsInBusiness || null,
        claimed: isClaimed,
        tier: tier,
        score: rawScore,
        scoreLabel: scoreLabel,
        reviewCount: scoreMap[c.companyName]?.reviewCount || 0,
        quoteCount: scoreMap[c.companyName]?.quoteCount || 0,
        submittedAt: c.submittedAt
      };
    });

    return res.status(200).json({ contractors: publicList, count: publicList.length });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
