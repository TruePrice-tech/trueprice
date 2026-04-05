import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SEC = 3600;

const memoryRateLimit = new Map();
function checkMemoryRateLimit(ip) {
  const now = Date.now();
  const entry = memoryRateLimit.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_SEC * 1000) {
    memoryRateLimit.set(ip, { count: 1, start: now });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

async function checkRateLimit(ip) {
  try {
    const key = `co_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[contractor-onboard] Redis rate limit error, falling back to in-memory:", e.message);
    return checkMemoryRateLimit(ip);
  }
}

const CHAT_SYSTEM_PROMPT = `You are Trudy, the TruePrice assistant helping contractors sign up for the TruePrice directory. Be helpful, concise, and professional.

TruePrice has three listing tiers:
- Basic (free): Any contractor can list. Business name, phone, services, area. Unverified.
- Verified (free, earned): Requires valid license, $1M+ liability insurance, 2+ years in business, 3.5+ Google stars (10+ reviews), no unresolved BBB complaints. Gets Verified badge and priority placement.
- Featured (paid, must be Verified first): Requires 4.0+ Google stars and signing the Transparency Pledge. Gets top placement, logo, website link, appears in quote analysis results. $99/month.

The Transparency Pledge requires: itemized quotes, stated labor rates, warranty terms, no same-day signing pressure, permit costs included, 5-day dispute response, allow anonymized quote data for benchmarking.

TruePrice does NOT sell leads. Homeowners contact contractors directly. We never share contractor info with third parties.

Auto repair shops need ASE certification and state motor vehicle repair license where required.

Answer the contractor's question concisely. If you don't know something, say to email hello@truepricehq.com.`;

const DOC_REVIEW_PROMPT = `Analyze this insurance certificate document. Extract:
1. Insurance company name
2. Policy holder / business name
3. Policy number
4. Coverage type (general liability, etc.)
5. Coverage amount
6. Effective date
7. Expiration date

Return ONLY valid JSON:
{
  "insurer": "company name or null",
  "businessName": "policy holder or null",
  "policyNumber": "number or null",
  "coverageType": "general liability / commercial auto / etc.",
  "coverageAmount": "e.g. $1,000,000 or null",
  "effectiveDate": "YYYY-MM-DD or null",
  "expirationDate": "YYYY-MM-DD or null",
  "meetsMinimum": true/false,
  "isExpired": true/false,
  "summary": "one-line summary of what was found"
}

For meetsMinimum: true if general liability coverage >= $1,000,000.
For isExpired: true if expiration date is in the past relative to today.`;

async function handleChat(message, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: CHAT_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: message.substring(0, 2000) }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Claude API error:", response.status, errText);
    throw new Error("AI chat failed");
  }

  const data = await response.json();
  const reply = data.content?.[0]?.text || "";
  return { success: true, reply };
}

async function handleReviewDoc(image, docType, apiKey) {
  const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image format. Expected base64 data URL.");
  }

  const content = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: match[1],
        data: match[2]
      }
    },
    {
      type: "text",
      text: DOC_REVIEW_PROMPT
    }
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        { role: "user", content }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Claude API error:", response.status, errText);
    throw new Error("AI document review failed");
  }

  const data = await response.json();
  const aiText = data.content?.[0]?.text || "";

  let parsed;
  try {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText);
  } catch (e) {
    console.error("Failed to parse Claude response:", aiText);
    throw new Error("Could not parse AI document review response");
  }

  return { success: true, data: parsed };
}

async function handleSubmit(tier, business, verification, pledge) {
  // Validate basic fields
  if (!business?.name || !business?.email || !business?.phone || !business?.state) {
    throw new Error("Missing required fields: business name, email, phone, and state are required.");
  }
  if (!business?.services || business.services.length === 0) {
    throw new Error("At least one service category is required.");
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(business.email)) {
    throw new Error("Invalid email address.");
  }

  // Validate tier-specific fields
  if (tier === "verified" || tier === "featured") {
    if (!verification?.licenseNumber || !verification?.licenseState || !verification?.googleProfileUrl) {
      throw new Error("Verified tier requires license number, license state, and Google Business Profile URL.");
    }
  }

  if (tier === "featured") {
    if (!pledge) {
      throw new Error("Featured tier requires signing the Transparency Pledge.");
    }
  }

  const email = business.email.toLowerCase().trim();
  const status = tier === "basic" ? "approved" : "pending";
  const submittedAt = new Date().toISOString();

  const application = {
    tier,
    business,
    verification: verification || {},
    pledge: !!pledge,
    status,
    submittedAt,
    reviewNotes: ""
  };

  try {
    await redis.set(`contractor:${email}`, JSON.stringify(application));
    await redis.lpush("contractor:notifications", JSON.stringify({
      email,
      business: business.name,
      tier,
      submittedAt
    }));
  } catch (e) {
    console.error("[contractor-onboard] Redis storage error:", e.message);
    throw new Error("Failed to save application. Please try again.");
  }

  const message = status === "approved"
    ? "Your Basic listing is live! You can upgrade to Verified at any time."
    : `Your ${tier} application has been submitted and is under review. Typical turnaround: 1-2 business days.`;

  return { success: true, status, message };
}

export default async function handler(req, res) {
  const allowedOrigin = "https://truepricehq.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || "unknown";
  if (!(await checkRateLimit(clientIp))) {
    return res.status(429).json({ error: "Rate limit exceeded. Maximum 20 requests per hour. Please try again later." });
  }

  const { action } = req.body;

  if (!action) {
    return res.status(400).json({ error: "Missing action field. Expected: chat, review_doc, or submit." });
  }

  try {
    if (action === "chat") {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Missing message field." });
      }
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "API key not configured" });
      }
      const result = await handleChat(message, apiKey);
      return res.status(200).json(result);
    }

    if (action === "review_doc") {
      const { image, docType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Missing image field. Expected base64 data URL." });
      }
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "API key not configured" });
      }
      const result = await handleReviewDoc(image, docType, apiKey);
      return res.status(200).json(result);
    }

    if (action === "submit") {
      const { tier, business, verification, pledge } = req.body;
      if (!tier || !["basic", "verified", "featured"].includes(tier)) {
        return res.status(400).json({ error: "Invalid tier. Expected: basic, verified, or featured." });
      }
      const result = await handleSubmit(tier, business, verification, pledge);
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: `Unknown action: ${action}. Expected: chat, review_doc, or submit.` });

  } catch (error) {
    console.error("[contractor-onboard] error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
