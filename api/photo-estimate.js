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

    // Extract GPS from EXIF data if present (JPEG only)
    let detectedCity = body.city || null;
    let detectedState = body.state || null;

    if (!detectedCity && mediaType === "image/jpeg") {
      try {
        const imgBuffer = Buffer.from(base64Data, "base64");
        const gps = extractExifGps(imgBuffer);
        if (gps) {
          console.log("[photo-estimate] EXIF GPS found:", gps.lat, gps.lng);
          const location = await reverseGeocode(gps.lat, gps.lng);
          if (location) {
            detectedCity = location.city;
            detectedState = location.state;
            console.log("[photo-estimate] Reverse geocoded:", detectedCity, detectedState);
          }
        } else {
          console.log("[photo-estimate] No EXIF GPS data in image");
        }
      } catch (e) {
        console.log("[photo-estimate] EXIF extraction failed:", e.message);
      }
    }

    // Fetch city multiplier if we have location
    let cityMultiplier = null;
    if (detectedCity && detectedState) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const multData = JSON.parse(fs.default.readFileSync(path.default.join(process.cwd(), "data", "city-cost-multipliers.json"), "utf-8"));
        const key = detectedCity + "|" + detectedState.toUpperCase();
        if (multData[key]) cityMultiplier = multData[key].multiplier;
      } catch (e) {}
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
- stories: Count rows of windows to determine stories. Two rows of windows = 2 stories. One row = 1 story.
- estimatedFootprintSqFt: Estimate the GROUND FLOOR footprint only (not total living area). For a 2-story home, this is roughly half the total living area. A typical 3,200 sqft 2-story home has a ~1,600-1,800 sqft footprint. Use cars, doors, and windows for scale.
- estimatedRoofSqFt: Ground floor footprint * pitch factor (flat=1.0, low=1.05, normal=1.12, steep=1.25). Add area for garage if attached.
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
      data: parsed,
      location: detectedCity ? { city: detectedCity, state: detectedState } : null,
      cityMultiplier: cityMultiplier
    });

  } catch (error) {
    console.error("[photo-estimate] Unhandled error:", error.message, error.stack);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}

// Minimal EXIF GPS extractor (no dependencies)
function extractExifGps(buffer) {
  // JPEG starts with FF D8, EXIF marker is FF E1
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return null;

  let offset = 2;
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xFF) break;
    const marker = buffer[offset + 1];
    if (marker === 0xE1) { // APP1 (EXIF)
      const length = buffer.readUInt16BE(offset + 2);
      const exifData = buffer.slice(offset + 4, offset + 2 + length);
      return parseExifGps(exifData);
    }
    // Skip other markers
    if (marker === 0xDA) break; // Start of scan = end of headers
    const segLen = buffer.readUInt16BE(offset + 2);
    offset += 2 + segLen;
  }
  return null;
}

function parseExifGps(data) {
  // Check for "Exif\0\0" header
  if (data.toString("ascii", 0, 4) !== "Exif") return null;

  const tiffOffset = 6;
  const isLE = data.readUInt16BE(tiffOffset) === 0x4949; // II = little endian
  const read16 = isLE ? (o) => data.readUInt16LE(o) : (o) => data.readUInt16BE(o);
  const read32 = isLE ? (o) => data.readUInt32LE(o) : (o) => data.readUInt32BE(o);

  function readRational(o) {
    const num = read32(o);
    const den = read32(o + 4);
    return den ? num / den : 0;
  }

  function findGpsIfd() {
    const ifd0Offset = read32(tiffOffset + 4) + tiffOffset;
    const entries = read16(ifd0Offset);
    for (let i = 0; i < entries; i++) {
      const entryOffset = ifd0Offset + 2 + i * 12;
      const tag = read16(entryOffset);
      if (tag === 0x8825) { // GPSInfo pointer
        return read32(entryOffset + 8) + tiffOffset;
      }
    }
    return null;
  }

  try {
    const gpsIfd = findGpsIfd();
    if (!gpsIfd) return null;

    const gpsEntries = read16(gpsIfd);
    let latRef = "", lngRef = "", lat = null, lng = null;

    for (let i = 0; i < gpsEntries; i++) {
      const entryOffset = gpsIfd + 2 + i * 12;
      const tag = read16(entryOffset);
      const valueOffset = read32(entryOffset + 8) + tiffOffset;

      if (tag === 1) { // GPSLatitudeRef
        latRef = String.fromCharCode(data[entryOffset + 8]);
      } else if (tag === 2) { // GPSLatitude
        const d = readRational(valueOffset);
        const m = readRational(valueOffset + 8);
        const s = readRational(valueOffset + 16);
        lat = d + m / 60 + s / 3600;
      } else if (tag === 3) { // GPSLongitudeRef
        lngRef = String.fromCharCode(data[entryOffset + 8]);
      } else if (tag === 4) { // GPSLongitude
        const d = readRational(valueOffset);
        const m = readRational(valueOffset + 8);
        const s = readRational(valueOffset + 16);
        lng = d + m / 60 + s / 3600;
      }
    }

    if (lat !== null && lng !== null) {
      if (latRef === "S") lat = -lat;
      if (lngRef === "W") lng = -lng;
      if (lat !== 0 || lng !== 0) return { lat, lng };
    }
  } catch (e) {}
  return null;
}

async function reverseGeocode(lat, lng) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=place,region&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const features = data.features || [];

    let city = null, state = null;
    for (const f of features) {
      if (f.place_type?.includes("place")) city = f.text;
      if (f.place_type?.includes("region")) {
        // Extract 2-letter state code from short_code (e.g. "US-SC")
        state = f.properties?.short_code?.replace("US-", "").toUpperCase() || null;
      }
    }
    // If city found but not state, check context
    if (!state && features[0]?.context) {
      for (const ctx of features[0].context) {
        if (ctx.id?.startsWith("region")) {
          state = ctx.short_code?.replace("US-", "").toUpperCase() || null;
        }
      }
    }
    if (!city && features[0]?.context) {
      for (const ctx of features[0].context) {
        if (ctx.id?.startsWith("place")) city = ctx.text;
      }
    }
    return city && state ? { city, state } : null;
  } catch (e) {
    return null;
  }
}
