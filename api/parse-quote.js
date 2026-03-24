export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { text, images } = req.body;

    if (!text && (!images || images.length === 0)) {
      return res.status(400).json({ error: "No text or images provided" });
    }

    // Build the message content
    const content = [];

    // Add images first (Claude vision)
    if (images && images.length > 0) {
      for (const img of images.slice(0, 3)) { // Max 3 images
        // img should be a base64 data URL like "data:image/png;base64,..."
        const match = img.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (match) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: match[1],
              data: match[2]
            }
          });
        }
      }
    }

    // Add text
    content.push({
      type: "text",
      text: `Analyze this roofing contractor quote. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "price": <number or null — the total project price, not deposits or line items>,
  "material": <"architectural" | "asphalt" | "metal" | "tile" | null>,
  "materialLabel": <human readable material name or null>,
  "contractor": <contractor/company name or null>,
  "city": <city name or null>,
  "stateCode": <2-letter state code or null>,
  "roofSize": <number in sq ft or null>,
  "warrantyYears": <number or null>,
  "warranty": <warranty description or null>,
  "scopeItems": {
    "tearOff": <"included" | "excluded" | "unclear">,
    "underlayment": <"included" | "excluded" | "unclear">,
    "flashing": <"included" | "excluded" | "unclear">,
    "iceShield": <"included" | "excluded" | "unclear">,
    "dripEdge": <"included" | "excluded" | "unclear">,
    "ventilation": <"included" | "excluded" | "unclear">,
    "ridgeVent": <"included" | "excluded" | "unclear">,
    "starterStrip": <"included" | "excluded" | "unclear">,
    "ridgeCap": <"included" | "excluded" | "unclear">,
    "decking": <"included" | "excluded" | "unclear">,
    "disposal": <"included" | "excluded" | "unclear">,
    "permit": <"included" | "excluded" | "unclear">
  }
}

Rules:
- price: Use the TOTAL/grand total, not line items, deposits, or deductibles
- material: Choose the PRIMARY roofing material being installed, not materials being removed
- roofSize: Convert roofing squares to sq ft (1 square = 100 sq ft)
- scopeItems: Mark "included" only if clearly stated in the quote, "excluded" if explicitly excluded, "unclear" if not mentioned
- Return ONLY the JSON object, nothing else`
    });

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
      return res.status(502).json({ error: "AI parsing failed", status: response.status });
    }

    const data = await response.json();
    const aiText = data.content?.[0]?.text || "";

    // Parse the JSON from Claude's response
    let parsed;
    try {
      // Try to extract JSON from the response (Claude sometimes wraps in markdown)
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText);
    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("parse-quote error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
