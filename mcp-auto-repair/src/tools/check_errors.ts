import { z } from "zod";
import { analyzeAutoRepairQuote, ParsedAutoRepairQuote } from "../bridge/woogoro-api.js";
import { detectPriceVsBaseline } from "../bridge/price-baseline.js";

export const checkErrorsSchema = {
  name: "check_errors",
  description:
    "Audit an auto repair quote and return ranked findings: red flags from the analyzer, scope/transparency gaps, urgency-mismatch (critical-vs-can-wait), and possible upsells. Useful when the user wants the issue list without re-extracting structured data.",
  inputSchema: {
    type: "object",
    properties: {
      parsed_quote: { type: "object", description: "Previously-parsed auto repair quote object from parse_quote." },
      quote_text: { type: "string" },
      quote_images: { type: "array", items: { type: "string" } },
    },
  },
};

const args = z.object({
  parsed_quote: z.record(z.unknown()).optional(),
  quote_text: z.string().optional(),
  quote_images: z.array(z.string()).optional(),
});

export async function runCheckErrors(rawArgs: unknown) {
  const parsed = args.parse(rawArgs);

  let quote: ParsedAutoRepairQuote;
  if (parsed.parsed_quote) {
    quote = parsed.parsed_quote as ParsedAutoRepairQuote;
  } else {
    if (!parsed.quote_text && (!parsed.quote_images || parsed.quote_images.length === 0)) {
      return { success: false, error: "Must provide parsed_quote, quote_text, or quote_images" };
    }
    const result = await analyzeAutoRepairQuote({
      text: parsed.quote_text,
      imageDataUrls: parsed.quote_images,
    });
    if (!result.ok) return { success: false, error: result.error, status: result.status };
    quote = result.data;
  }

  const findings: Array<{ severity: "high" | "medium" | "low"; category: string; flag: string }> = [];

  // Price vs local baseline (calibration first, then static expectedRange)
  const priceFinding = detectPriceVsBaseline(quote);
  if (priceFinding) {
    findings.push({
      severity: priceFinding.severity,
      category: priceFinding.category,
      flag: priceFinding.flag,
    });
  }

  for (const rf of quote.redFlags || []) {
    let severity: "high" | "medium" | "low" = "medium";
    const lower = rf.toLowerCase();
    if (lower.includes("inflat") || lower.includes("excess") || lower.includes("triple") || lower.includes("double")) severity = "high";
    if (lower.includes("upsell") || lower.includes("not needed") || lower.includes("unnecess")) severity = "high";
    if (lower.includes("warranty") && (lower.includes("void") || lower.includes("missing"))) severity = "medium";
    findings.push({ severity, category: "analyzer_redflag", flag: rf });
  }

  // Inflated labor hours per repair
  for (const r of quote.repairs || []) {
    if (r.laborHoursFlag === "high") {
      findings.push({
        severity: "high",
        category: "labor_hours_inflated",
        flag: `${r.description}: quoted labor hours appear high vs Mitchell/AllData book time. Ask the shop to justify the hours or compare to a second quote.`,
      });
    }
  }

  // Scope transparency
  const scope = quote.scopeItems || {};
  const REQUIRED: Array<{ key: keyof typeof scope; label: string; severity: "high" | "medium" | "low" }> = [
    { key: "laborRateStated", label: "Hourly labor rate (so you can verify the rate vs market)", severity: "high" },
    { key: "laborHoursListed", label: "Labor hours per repair (so you can verify vs flat-rate book time)", severity: "high" },
    { key: "partsItemized", label: "Parts cost itemized per repair", severity: "medium" },
    { key: "partsType", label: "Parts type (OEM vs aftermarket vs remanufactured)", severity: "medium" },
    { key: "partsWarranty", label: "Parts warranty terms", severity: "medium" },
    { key: "laborWarranty", label: "Labor warranty terms (industry standard 12 months / 12,000 miles minimum)", severity: "medium" },
    { key: "diagnosticFee", label: "Diagnostic fee (if charged) and whether it credits toward repair", severity: "low" },
    { key: "shopSupplies", label: "Shop supplies fee (often a percentage padding charge)", severity: "low" },
  ];

  for (const req of REQUIRED) {
    const status = scope[req.key];
    if (status === "no") {
      findings.push({
        severity: req.severity,
        category: "scope_gap",
        flag: `${req.label}: NOT shown on quote.`,
      });
    } else if (status === "unclear" || status === undefined) {
      const downSev: "high" | "medium" | "low" = req.severity === "high" ? "medium" : "low";
      findings.push({
        severity: downSev,
        category: "scope_gap",
        flag: `${req.label}: not specified.`,
      });
    }
  }

  // Possible upsells from the analyzer
  const upsells = quote.possibleUpsells || [];
  for (const u of upsells) {
    findings.push({
      severity: "medium",
      category: "possible_upsell",
      flag: `Possible upsell flagged by analyzer: ${u}`,
    });
  }

  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");
  const low = findings.filter((f) => f.severity === "low");

  return {
    success: true,
    findings,
    counts: { high: high.length, medium: medium.length, low: low.length, total: findings.length },
    headline: high.length > 0
      ? `${high.length} HIGH-severity issue${high.length > 1 ? "s" : ""} — investigate before authorizing work`
      : medium.length > 0
      ? `${medium.length} medium-severity issue${medium.length > 1 ? "s" : ""}`
      : "No major issues flagged",
    questions_to_ask_shop: [
      "What's your hourly labor rate? Can I see it written?",
      "How many labor hours are billed for each repair line, and what flat-rate guide are you using (Mitchell, AllData, OEM)?",
      "Are parts OEM, aftermarket, or remanufactured? Brand name?",
      "What is the parts warranty (manufacturer's coverage) and what is your labor warranty separately?",
      "Is there a 'shop supplies' fee, and is it a flat amount or a percentage?",
      "If diagnostic fee was charged, does it credit toward the repair if I authorize?",
      "Which of these repairs are critical for safety vs which can wait?",
      "Has any of this work been required by the manufacturer (TSB, recall) so dealer might cover it?",
    ],
  };
}
