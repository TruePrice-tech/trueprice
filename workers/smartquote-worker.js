export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
      const body = await request.json();
      const quoteText = body.text || "";
      const images = Array.isArray(body.images) ? body.images : [];

      if (!quoteText && !images.length) {
        return jsonResponse({ error: "Missing quote text or images" }, 400);
      }

      const aiResult = await callModel(env, quoteText, images);
      return jsonResponse(aiResult);
    } catch (error) {
      return jsonResponse(
        {
          error: "SmartQuote worker failure",
          details: error instanceof Error ? error.message : String(error)
        },
        500
      );
    }
  }
};

async function callModel(env, quoteText, images) {
  const prompt = `Extract roofing quote information.

Return ONLY JSON with this structure:

{
  "total_price": number|null,
  "roof_size_sqft": number|null,
  "material": string|null,
  "warranty_years": number|null,
  "tear_off_included": boolean|null,
  "contractor_name": string|null,
  "city": string|null,
  "state": string|null,
  "scope_items": string[],
  "confidence": number
}

You will receive OCR text and possibly one or more page images from the quote.
Use the IMAGE as the primary source when table layout, totals, columns, or labels are visible.
Use OCR text as supporting context when image text is blurry.

Extraction rules:

For total_price:
If a row or section labeled "Total", "Total Estimated Cost", "Grand Total",
"Proposal Total", "Contract Total", or "Total Due" appears, strongly prefer
that value as the final quote price instead of individual line items.
If one value is explicitly labeled as Total Estimated Cost and other values are unlabeled line items,
always choose the Total Estimated Cost value.
If a table of line items exists, do not sum them unless no labeled total exists.

For roof_size_sqft:
Accept values written with commas such as 2,000 sq ft.
Accept formats like:
- 2000 sq ft
- 2,000 Sq. Ft.
- roof size: 2000
- roof area: 2000
- 24 squares
- 24.5 squares

Convert roofing squares to square feet using:
1 square = 100 square feet.

Examples:
24 squares = 2400 sq ft
24.5 squares = 2450 sq ft

Do not return 0. Return null if roof size is not found.

For material:
Return only the primary roofing material type, such as:
- Asphalt Shingles
- Architectural Shingles
- Metal Roofing
- Tile Roofing
- Slate Roofing
- Wood Shakes

If the quote lists "shingles" as the primary roofing material, return "Asphalt Shingles" unless the quote clearly says architectural, dimensional, laminate, metal, tile, slate, or wood.

Do not return a list of accessories or scope items in the material field.
Do not include underlayment, flashing, nails, vents, permits, cleanup, or labor in the material field.
If the primary roofing material is unclear, return null.

For warranty_years:
Accept formats like:
- 30 year
- 30-year
- 30 yr
- 30 yrs
- workmanship 10 year
- manufacturer warranty 30 year
- lifetime

Return 50 for lifetime warranty.
Do not return 0. Return null if warranty is not found.

For tear_off_included:
Return true only if tear off, remove existing roof, remove existing shingles,
or similar full removal language is clearly stated.
Return false only if overlay, layover, no tear off, or equivalent is clearly stated.
Otherwise return null.

For scope_items:
Only include actual roofing work items such as:
tear off, underlayment, flashing, ridge vent, drip edge,
decking replacement, ice and water shield, ventilation,
disposal, permit, cleanup, pipe boots, valley metal.

Do not include price, square footage, warranty, material,
contractor name, city, state, or totals in scope_items
unless they are explicitly written as work line items.

For confidence:
Return a number between 0 and 1.
Use higher confidence only when the quote image/text clearly supports the extracted values.

Do not use markdown fences.
Do not include explanation text.
Do not include prose before or after the JSON.

OCR text:
${quoteText || "(none)"}`;

  const content = [
    {
      type: "input_text",
      text: prompt
    }
  ];

  for (const image of images.slice(0, 2)) {
    if (typeof image === "string" && image.startsWith("data:image/")) {
      content.push({
        type: "input_image",
        image_url: image
      });
    }
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.SMARTQUOTE_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Model API error: ${response.status} ${text}`);
  }

  const data = await response.json();

  let text = data.output_text;

  if (!text && data.output) {
    text = data.output
      .flatMap((o) => o.content || [])
      .map((c) => c.text || "")
      .join("");
  }

  if (!text) {
    throw new Error("Model returned empty response");
  }

  text = stripCodeFences(text).trim();

  return JSON.parse(text);
}

function stripCodeFences(text) {
  return String(text)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders()
  });
}