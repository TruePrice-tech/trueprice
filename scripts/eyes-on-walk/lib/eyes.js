// Claude vision wrapper for eyes-on-walk. Reads a batch of screenshots from
// one walk path (estimate / analyze / compare) and returns a structured list
// of visual/qualitative issues. The point: catch what HTML diffs miss --
// oversized mascots, duplicate images, ranges too wide, missing buttons,
// copy that says "paver" on a sod job, undefined / NaN / $0, brand violations
// (rainbow appearing on a non-Iris mascot), inconsistencies across screenshots.

const fs = require("fs");
const path = require("path");

const ENDPOINT = "https://api.anthropic.com/v1/messages";
// Switched 2026-05-15 from claude-sonnet-4-6 to claude-haiku-4-5 -- the
// task here (flag $0/NaN/oversized-mascot/duplicate-image/copy-mismatch
// in screenshots against a rules list) is structured pattern-matching,
// not open-ended reasoning. Haiku handles it well at ~1/12 the per-token
// cost. EYES_MODEL env var still wins if a specific run needs sonnet.
// See project_api_spend_drivers_2026_05_15 in memory.
const DEFAULT_MODEL = process.env.EYES_MODEL || "claude-haiku-4-5-20251001";

// Hard rules baked into the system prompt. These match Lane's standing
// memories: feedback_always_look_at_images, feedback_rainbow_is_iris_only,
// feedback_catch_data_bugs, project_estimate_range_bands, etc.
const SYSTEM_PROMPT = `You are reviewing screenshots from a TruePrice/Woogoro walk-the-site test, the same way a human QA reviewer would. The site helps homeowners price-check contractor quotes across ~20 verticals (roofing, hvac, electrical, etc.). For each batch you receive, look at every screenshot in order and flag VISUAL or QUALITATIVE issues a code-level test would miss.

Always flag (high severity):
- "undefined", "NaN", "[object Object]", "$0", empty values, or visible JS errors
- Estimate ranges where high/low diverge by more than 2x (e.g. $1,000-$5,000) -- standard band is roughly 0.88x to 1.15x of midpoint
- Mascot brand violations: rainbow coloring on any vertical mascot (rainbow is reserved for Iris, the company-wide mascot, NEVER on vertical Woogoros)
- Mascot image oversized inside a verdict header / result card (should fit, not dominate)
- Duplicate images on the same page (same fixture appearing twice, same mascot appearing twice in the same card)
- Missing standard buttons on result pages: "Save PDF", "Share", "Get Quotes from Pre-Vetted Pros", "Start Over"
- Copy mismatch with the user's actual selections (e.g. paver-flavored language on a sod-installation estimate, "OPENER: Not included" on an opener-only garage-door quote, "Owner: Single member LLC" disclaimer absent on city pages)
- Numeric inconsistency across screenshots in the same path (e.g. estimate page shows $4,200 but the result-footer email-share copy shows $1,400)
- Cross-page pricing drift visible in the same walk (cost-guide says one number, estimate result says a different number for the same scenario)

Always flag (medium severity):
- Layout breakage: text overlapping, buttons clipped, mobile-unsafe widths
- Fixture confusion: the uploaded image is clearly the wrong vertical for this analyzer (and the page didn't deflect)
- Confidence labels that don't match the data (e.g. "High confidence" on an OCR result with garbled numbers)
- "Not stated" or "N/A" for fields the OCR clearly contains
- A scope checklist that ignores the user's explicit selection (user said "yes gutters guards" but the checklist shows guards as missing)

Always flag (low severity, polish only):
- Copy that's grammatically broken, awkward, or has placeholder text like "{{vertical}}" or "TODO"
- Off-season tips appearing in the wrong season
- Calendar / date references that look stale

Do NOT flag:
- Things that are merely stylistic preference unless they violate the rules above
- Numbers being slightly different from your guess (the site has its own pricing data; don't second-guess unless the number is clearly nonsensical like $0 or 1000x off)
- The presence of optional sections (FAQ, related guides, etc.)

Return JSON in this exact shape, nothing else:
{
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "screenshot": "<the screenshot label, e.g. 'estimate-cedar-08-result-top'>",
      "summary": "<one short sentence>",
      "detail": "<2-3 sentences if needed; cite specific text/numbers you saw>"
    }
  ]
}

If nothing is wrong, return {"issues": []}. Do not invent issues. Do not flag the same problem multiple times across screenshots -- pick the first occurrence and move on.`;

function loadImageBase64(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const media = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/png";
  return { mediaType: media, base64: buf.toString("base64") };
}

async function examinePath({ vertical, walkPath, fixture, contextNotes, screenshots }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for eyes-on-walk");
  if (!screenshots || screenshots.length === 0) return { issues: [] };

  const userText = [
    `Vertical: ${vertical}`,
    `Path: ${walkPath}`,
    fixture ? `Fixture: ${fixture}` : null,
    contextNotes ? `Context: ${contextNotes}` : null,
    "",
    `${screenshots.length} screenshots follow, in order. Each is preceded by its label.`,
    "Review them as a sequence -- a person walking through this path -- and return JSON per the system rules."
  ].filter(Boolean).join("\n");

  const content = [{ type: "text", text: userText }];
  for (const s of screenshots) {
    if (!fs.existsSync(s.file)) {
      content.push({ type: "text", text: `[label: ${s.label}] (FILE MISSING: ${s.file})` });
      continue;
    }
    content.push({ type: "text", text: `[label: ${s.label}]` });
    const img = loadImageBase64(s.file);
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 }
    });
  }

  const body = {
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }]
  };

  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Claude vision API ${resp.status}: ${errText.slice(0, 400)}`);
  }
  const data = await resp.json();
  const text = data.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  let parsed;
  try {
    parsed = match ? JSON.parse(match[0]) : { issues: [] };
  } catch (e) {
    return { issues: [{ severity: "low", screenshot: "(parse-error)", summary: "Could not parse vision response", detail: text.slice(0, 600) }] };
  }
  if (!Array.isArray(parsed.issues)) parsed.issues = [];
  return parsed;
}

module.exports = { examinePath };
