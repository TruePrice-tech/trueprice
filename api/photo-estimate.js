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
    console.log("[photo-estimate] Request received. Body type:", typeof body, "Has image:", !!(body && body.image), "Service:", body?.service);

    if (!body || typeof body !== "object") {
      console.log("[photo-estimate] Body is not an object. Raw body length:", JSON.stringify(req.body || "").length);
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { image, service } = body;

    if (!image) {
      console.log("[photo-estimate] No image in body. Keys:", Object.keys(body));
      return res.status(400).json({ error: "No image provided" });
    }

    console.log("[photo-estimate] Image length:", image.length, "First 50 chars:", image.substring(0, 50));

    const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) {
      console.log("[photo-estimate] Image format doesn't match base64 data URL pattern");
      return res.status(400).json({ error: "Invalid image format" });
    }

    console.log("[photo-estimate] Image parsed. Media type:", match[1], "Base64 length:", match[2].length);

    const serviceType = service || "roofing";

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
- estimatedFootprintSqFt: Estimate the building footprint from visible dimensions. Average US home is 1,800-2,400 sq ft. Use visual cues like car/person scale if available.
- estimatedRoofSqFt: Footprint * pitch factor (flat=1.0, low=1.05, normal=1.12, steep=1.25)
- complexity: "simple" = basic rectangle/L-shape, "moderate" = some dormers or valleys, "complex" = many angles, dormers, or sections
- Only include conditionNotes for issues you can actually see
- Return ONLY the JSON object`,

      hvac: `Analyze this photo of an HVAC system, condenser unit, or heating/cooling equipment. Return ONLY valid JSON:

{
  "systemType": "central_ac" | "heat_pump" | "furnace" | "mini_split" | "window_unit" | "unknown",
  "estimatedAge": <number in years or null>,
  "brand": <brand name if visible or null>,
  "model": <model number if visible or null>,
  "condition": "good" | "fair" | "poor" | "unknown",
  "conditionNotes": ["rust", "dirty coils", "damaged fins", "vegetation overgrowth", "outdated"],
  "estimatedTonnage": <number or null>,
  "additionalNotes": <any relevant observations>
}

Return ONLY the JSON object`,

      general: `Analyze this photo of a home exterior or project area. Identify what home service might be needed and estimate the scope. Return ONLY valid JSON:

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
          media_type: match[1],
          data: match[2]
        }
      },
      { type: "text", text: prompt }
    ];

    console.log("[photo-estimate] Sending to Claude API. Service:", serviceType, "Payload size:", JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1024, messages: [{ role: "user", content }] }).length);

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
      console.error("Claude Vision API error:", response.status, errText);
      return res.status(502).json({ error: "Photo analysis failed", status: response.status });
    }

    const data = await response.json();
    const aiText = data.content?.[0]?.text || "";

    let parsed;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText);
    } catch (e) {
      console.error("Failed to parse vision response:", aiText);
      return res.status(502).json({ error: "Could not parse photo analysis", raw: aiText });
    }

    return res.status(200).json({
      success: true,
      source: "claude-haiku-vision",
      service: serviceType,
      data: parsed
    });

  } catch (error) {
    console.error("photo-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
