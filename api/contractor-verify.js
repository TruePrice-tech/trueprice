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

  const { googleUrl } = req.body;

  if (!googleUrl) {
    return res.status(400).json({ error: "Google Business Profile URL required" });
  }

  if (!googleUrl.includes("google.com/maps") && !googleUrl.includes("goo.gl") && !googleUrl.includes("business.google.com")) {
    return res.status(400).json({ error: "Please provide a Google Maps or Google Business Profile URL" });
  }

  // For now, return a placeholder that tells the frontend to show "manual verification"
  // When Places API is approved, this will be replaced with a real lookup
  try {
    var nameMatch = googleUrl.match(/place\/([^\/]+)/);
    var businessName = nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, " ")) : null;

    return res.status(200).json({
      success: true,
      source: "manual_pending",
      businessName: businessName,
      rating: null,
      reviewCount: null,
      meetsThreshold: null,
      message: "Google Reviews will be verified during review. Typical turnaround: 1-2 business days."
    });
  } catch (err) {
    return res.status(200).json({
      success: true,
      source: "manual_pending",
      businessName: null,
      rating: null,
      reviewCount: null,
      meetsThreshold: null,
      message: "We'll verify your Google Reviews during review."
    });
  }
}
