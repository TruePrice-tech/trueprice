export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://truepricehq.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Vision API key not configured" });

  try {
    const { base64, mediaType } = req.body;

    if (!base64) return res.status(400).json({ error: "No image data" });

    // Call Google Cloud Vision API for text detection
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [
              { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }
            ]
          }]
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ocr-vision] Google Vision API error:", response.status, errText);
      return res.status(502).json({ error: "OCR failed", status: response.status });
    }

    const data = await response.json();
    const annotation = data.responses?.[0]?.fullTextAnnotation;
    const text = annotation?.text || "";

    console.log("[ocr-vision] Extracted text length:", text.length);

    return res.status(200).json({
      success: true,
      text: text,
      confidence: annotation ? "high" : "none",
      source: "google_vision"
    });

  } catch (error) {
    console.error("[ocr-vision] Error:", error.message);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
