export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  const allowedOrigin = "https://truepricehq.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  try {
    const body = req.body;
    console.log("[photo-estimate] Request received. Has base64:", !!(body && body.base64), "mediaType:", body?.mediaType, "service:", body?.service);

    if (!body) return res.status(400).json({ error: "No request body" });

    // Support both formats: new (base64 + mediaType) and legacy (image data URL)
    let base64Data, mediaType;

    if (body.base64 && body.mediaType) {
      base64Data = body.base64;
      mediaType = body.mediaType;
    } else if (body.image) {
      const match = body.image.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (!match) return res.status(400).json({ error: "Invalid image format" });
      mediaType = match[1];
      base64Data = match[2];
    } else {
      console.log("[photo-estimate] No image data. Keys:", Object.keys(body));
      return res.status(400).json({ error: "No image provided" });
    }

    console.log("[photo-estimate] Image: mediaType=" + mediaType + " base64Length=" + base64Data.length);

    if (base64Data.length < 1000) {
      return res.status(400).json({ error: "Image too small or corrupt" });
    }

    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!supportedTypes.includes(mediaType)) {
      return res.status(400).json({ error: "Unsupported format. Use JPEG, PNG, or WebP." });
    }

    const serviceType = body.service || "roofing";

    const prompts = {
      roofing: `Analyze this photo of a house/building exterior. Extract roofing characteristics and return ONLY valid JSON (no markdown):

{
  "material": "architectural" | "asphalt" | "metal" | "tile" | "flat" | "cedar" | "unknown",
  "materialConfidence": "high" | "medium" | "low",
  "stories": 1 | 2 | 3,
  "roofStyle": "gable" | "hip" | "flat" | "gambrel" | "mansard" | "mixed",
  "complexity": "simple" | "moderate" | "complex",
  "complexityFactors": ["dormers", "valleys", "multiple sections", "skylights", "chimney"],
  "pitch": "flat" | "low" | "normal" | "steep",
  "estimatedFootprintSqFt": <number estimate of building footprint>,
  "estimatedRoofSqFt": <number estimate of total roof area including pitch>,
  "condition": "good" | "fair" | "poor" | "unknown",
  "conditionNotes": ["visible aging", "moss/algae", "missing shingles", "sagging", "storm damage"],
  "additionalNotes": <any relevant observations about the roof>
}

Rules:
- estimatedFootprintSqFt: Estimate the building footprint from visible dimensions. Average US home is 1,800-2,400 sq ft.
- estimatedRoofSqFt: Footprint * pitch factor (flat=1.0, low=1.05, normal=1.12, steep=1.25)
- complexity: "simple" = basic rectangle/L-shape, "moderate" = some dormers or valleys, "complex" = many angles
- Only include conditionNotes for issues you can actually see
- Return ONLY the JSON object`,

      hvac: `Analyze this photo of an HVAC system or equipment. Return ONLY valid JSON:

{
  "systemType": "central_ac" | "heat_pump" | "furnace" | "mini_split" | "window_unit" | "unknown",
  "estimatedAge": <number in years or null>,
  "brand": <brand name if visible or null>,
  "condition": "good" | "fair" | "poor" | "unknown",
  "conditionNotes": ["rust", "dirty coils", "damaged fins", "vegetation overgrowth", "outdated"],
  "estimatedTonnage": <number or null>,
  "additionalNotes": <any relevant observations>
}

Return ONLY the JSON object`,

      general: `Analyze this photo of a home exterior. Identify what home service might be needed. Return ONLY valid JSON:

{
  "suggestedService": "roofing" | "siding" | "painting" | "fencing" | "concrete" | "landscaping" | "windows" | "garage-doors" | "other",
  "condition": "good" | "fair" | "poor" | "unknown",
  "scope": <description of what work appears needed>,
  "estimatedSize": <number with unit description>,
  "additionalNotes": <any relevant observations>
}

Return ONLY the JSON object`
    };

    const prompt = prompts[serviceType] || prompts.general;

    const content = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data
        }
      },
      { type: "text", text: prompt }
    ];

    console.log("[photo-estimate] Calling Claude API...");

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
        messages: [{ role: "user", content }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[photo-estimate] Claude API error:", response.status, errText);
      return res.status(502).json({ error: "Photo analysis failed", status: response.status, detail: errText });
    }

    const data = await response.json();
    const aiText = data.content?.[0]?.text || "";
    console.log("[photo-estimate] Claude response length:", aiText.length);

    let parsed;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText);
    } catch (e) {
      console.error("[photo-estimate] JSON parse failed:", aiText.substring(0, 200));
      return res.status(502).json({ error: "Could not parse photo analysis", raw: aiText });
    }

    return res.status(200).json({
      success: true,
      source: "claude-haiku-vision",
      service: serviceType,
      data: parsed
    });

  } catch (error) {
    console.error("[photo-estimate] Unhandled error:", error.message, error.stack);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
