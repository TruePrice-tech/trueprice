// Contractor directory endpoint — self-signup and search
// In-memory storage (replace with Vercel KV for persistence)

const contractors = [];
const rateLimits = {};

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
  res.setHeader("Access-Control-Allow-Origin", "*");
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

    // Return public fields only (no email, no IP)
    const publicList = filtered.slice(0, 50).map(c => ({
      id: c.id,
      companyName: c.companyName,
      phone: c.phone,
      website: c.website,
      services: c.services,
      serviceLabels: c.services.map(s => SERVICE_LABELS[s] || s),
      states: c.states,
      cities: c.cities,
      licenseNumber: c.licenseNumber || null,
      yearsInBusiness: c.yearsInBusiness || null,
      submittedAt: c.submittedAt
    }));

    return res.status(200).json({ contractors: publicList, count: publicList.length });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
