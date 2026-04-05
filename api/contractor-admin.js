import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const ADMIN_KEY = process.env.ANALYTICS_ADMIN_KEY || "tp_admin_2026";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "https://truepricehq.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function unauthorized(res) {
  return res.status(401).json({ error: "Invalid admin key" });
}

async function getAllContractors() {
  const keys = await redis.keys("contractor:*");
  const contractorKeys = keys.filter(k => {
    const suffix = k.replace("contractor:", "");
    return suffix.includes("@");
  });

  const contractors = [];
  for (const key of contractorKeys) {
    try {
      const raw = await redis.get(key);
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (data && data.business) {
        data._email = key.replace("contractor:", "");
        contractors.push(data);
      }
    } catch (e) {
      console.error(`[contractor-admin] Failed to parse ${key}:`, e.message);
    }
  }

  contractors.sort((a, b) => {
    const da = a.submittedAt || "";
    const db = b.submittedAt || "";
    return db.localeCompare(da);
  });

  return contractors;
}

async function getStats(contractors) {
  const stats = {
    total: contractors.length,
    basic: 0,
    verified: 0,
    featured: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  };

  for (const c of contractors) {
    const tier = c.tier || "basic";
    const status = c.status || "pending";
    if (tier === "basic") stats.basic++;
    if (tier === "verified") stats.verified++;
    if (tier === "featured") stats.featured++;
    if (status === "pending") stats.pending++;
    if (status === "approved") stats.approved++;
    if (status === "rejected") stats.rejected++;
  }

  return stats;
}

async function updateStatus(email, status) {
  if (!email || !["approved", "rejected"].includes(status)) {
    throw new Error("Invalid email or status. Status must be approved or rejected.");
  }

  const key = `contractor:${email.toLowerCase().trim()}`;
  const raw = await redis.get(key);
  if (!raw) {
    throw new Error(`Contractor not found: ${email}`);
  }

  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  data.status = status;
  data.reviewedAt = new Date().toISOString();

  await redis.set(key, JSON.stringify(data));
  return { success: true, email, status };
}

async function deleteContractor(email) {
  if (!email) {
    throw new Error("Email is required");
  }

  const key = `contractor:${email.toLowerCase().trim()}`;
  const exists = await redis.exists(key);
  if (!exists) {
    throw new Error(`Contractor not found: ${email}`);
  }

  await redis.del(key);
  return { success: true, deleted: email };
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Auth check for both GET and POST
  const key = req.query?.key || req.body?.key;
  if (key !== ADMIN_KEY) {
    return unauthorized(res);
  }

  try {
    if (req.method === "GET") {
      const action = req.query.action;

      if (action === "list") {
        const contractors = await getAllContractors();
        return res.status(200).json({ success: true, contractors });
      }

      if (action === "stats") {
        const contractors = await getAllContractors();
        const stats = await getStats(contractors);
        return res.status(200).json({ success: true, stats });
      }

      return res.status(400).json({ error: "Unknown action. Expected: list or stats." });
    }

    if (req.method === "POST") {
      const { action } = req.body;

      if (action === "update_status") {
        const { email, status } = req.body;
        const result = await updateStatus(email, status);
        return res.status(200).json(result);
      }

      if (action === "delete") {
        const { email } = req.body;
        const result = await deleteContractor(email);
        return res.status(200).json(result);
      }

      return res.status(400).json({ error: "Unknown action. Expected: update_status or delete." });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    console.error("[contractor-admin] error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
