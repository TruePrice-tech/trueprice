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

  try {
    const { base64, mediaType } = req.body;
    if (!base64) return res.status(400).json({ error: "No image data" });

    // Try Google Cloud Vision first (best accuracy)
    const googleKey = process.env.GOOGLE_VISION_API_KEY;
    if (googleKey) {
      try {
        const gRes = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${googleKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [{
                image: { content: base64 },
                features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }]
              }]
            })
          }
        );
        if (gRes.ok) {
          const gData = await gRes.json();
          const text = gData.responses?.[0]?.fullTextAnnotation?.text || "";
          if (text.length > 30) {
            console.log("[ocr-vision] Google Vision:", text.length, "chars");
            return res.status(200).json({ success: true, text, confidence: "high", source: "google_vision" });
          }
        }
      } catch (e) {
        console.warn("[ocr-vision] Google Vision failed:", e.message);
      }
    }

    // Fallback: OCR.space (free, 80-85% accuracy)
    const ocrSpaceKey = process.env.OCR_SPACE_API_KEY || "K84200508188957";
    try {
      const mimeType = mediaType || "image/png";
      const formBody = new URLSearchParams();
      formBody.append("base64Image", `data:${mimeType};base64,${base64}`);
      formBody.append("language", "eng");
      formBody.append("isOverlayRequired", "false");
      formBody.append("OCREngine", "2"); // Engine 2 is better for documents
      formBody.append("isTable", "true"); // Better table detection
      formBody.append("scale", "true"); // Upscale for better accuracy

      const oRes = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        headers: { "apikey": ocrSpaceKey },
        body: formBody
      });

      if (oRes.ok) {
        const oData = await oRes.json();
        if (!oData.IsErroredOnProcessing && oData.ParsedResults && oData.ParsedResults.length > 0) {
          const text = oData.ParsedResults.map(r => r.ParsedText || "").join("\n");
          if (text.length > 30) {
            console.log("[ocr-vision] OCR.space:", text.length, "chars");
            return res.status(200).json({ success: true, text, confidence: "medium", source: "ocr_space" });
          }
        }
      }
    } catch (e) {
      console.warn("[ocr-vision] OCR.space failed:", e.message);
    }

    return res.status(200).json({ success: false, text: "", confidence: "none", source: "none" });

  } catch (error) {
    console.error("[ocr-vision] Error:", error.message);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
