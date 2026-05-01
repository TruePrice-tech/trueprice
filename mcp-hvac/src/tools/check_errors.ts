import { z } from "zod";
import { analyzeHvacQuote, ParsedHvacQuote } from "../bridge/woogoro-api.js";

export const checkErrorsSchema = {
  name: "check_errors",
  description:
    "Audit an HVAC quote and return a ranked list of red flags, scope gaps, and dispute opportunities. Includes oversizing detection, R-410A compliance check (illegal in new 2026+ installs per EPA AIM Act), low-efficiency flags (SEER<15 below federal minimum), missing scope items (line set, electrical, pad, drain, permit, load calc), warranty inadequacy, and possible upsells. Accepts a previously-parsed quote OR raw text/images.",
  inputSchema: {
    type: "object",
    properties: {
      parsed_quote: {
        type: "object",
        description: "Previously-parsed HVAC quote object from parse_quote. If provided, skips re-parsing.",
      },
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

  let quote: ParsedHvacQuote;
  if (parsed.parsed_quote) {
    quote = parsed.parsed_quote as ParsedHvacQuote;
  } else {
    if (!parsed.quote_text && (!parsed.quote_images || parsed.quote_images.length === 0)) {
      return { success: false, error: "Must provide parsed_quote, quote_text, or quote_images" };
    }
    const result = await analyzeHvacQuote({
      text: parsed.quote_text,
      imageDataUrls: parsed.quote_images,
    });
    if (!result.ok) return { success: false, error: result.error, status: result.status };
    quote = result.data;
  }

  // Build findings — combine API-detected redFlags with locally-detected scope gaps
  const findings: Array<{ severity: "high" | "medium" | "low"; category: string; flag: string }> = [];

  // API-side red flags get severity inferred from content
  for (const rf of quote.redFlags || []) {
    let severity: "high" | "medium" | "low" = "medium";
    const lower = rf.toLowerCase();
    if (lower.includes("r-410a") || lower.includes("r410a") || lower.includes("illegal") || lower.includes("epa")) severity = "high";
    if (lower.includes("oversiz") || lower.includes("seer") && lower.includes("below")) severity = "high";
    if (lower.includes("r-22") || lower.includes("r22") || lower.includes("phased out")) severity = "high";
    findings.push({ severity, category: "regulatory_or_efficiency", flag: rf });
  }

  if (quote.oversizingFlag) {
    findings.push({
      severity: "high",
      category: "system_design",
      flag: `Tonnage may be oversized for ${quote.homeSqFt ? quote.homeSqFt + " sqft" : "this home size"}. Oversized systems short-cycle, fail to dehumidify, and shorten equipment life.`,
    });
  }

  // Local scope gap audit
  const scope = quote.scopeItems || {};
  const REQUIRED_SCOPE: Array<{ key: keyof typeof scope; label: string; severity: "high" | "medium" | "low" }> = [
    { key: "loadCalc", label: "Manual J load calculation (verifies correct sizing)", severity: "high" },
    { key: "permit", label: "Permits and inspections", severity: "medium" },
    { key: "lineSet", label: "Refrigerant line set replacement", severity: "medium" },
    { key: "electrical", label: "Electrical disconnect and wiring", severity: "medium" },
    { key: "pad", label: "Equipment pad for condenser", severity: "low" },
    { key: "drainLine", label: "Condensate drain line", severity: "medium" },
    { key: "disposal", label: "Old equipment removal/disposal", severity: "low" },
  ];

  for (const req of REQUIRED_SCOPE) {
    const status = scope[req.key];
    if (status === "no") {
      findings.push({
        severity: req.severity,
        category: "scope_gap",
        flag: `${req.label}: NOT INCLUDED in quote.`,
      });
    } else if (status === "unclear" || status === undefined) {
      findings.push({
        severity: req.severity === "high" ? "medium" : "low",
        category: "scope_gap",
        flag: `${req.label}: not specified in quote.`,
      });
    }
  }

  // Warranty checks
  if (!quote.warrantyPartsYears && !quote.warrantyParts) {
    findings.push({
      severity: "medium",
      category: "warranty_gap",
      flag: "No parts warranty specified. Most major-brand HVAC equipment carries a 10-year limited parts warranty if registered within 60 days of install.",
    });
  } else if (quote.warrantyPartsYears && quote.warrantyPartsYears < 5) {
    findings.push({
      severity: "low",
      category: "warranty_gap",
      flag: `Parts warranty is short (${quote.warrantyPartsYears} years). Most reputable installs include 10-year parts.`,
    });
  }
  if (!quote.warrantyLaborYears && !quote.warrantyLabor) {
    findings.push({
      severity: "medium",
      category: "warranty_gap",
      flag: "No labor warranty specified. Reputable HVAC contractors offer 1-2 years of labor warranty as standard.",
    });
  }

  // Possible upsells flagged by API
  const upsells = quote.possibleUpsells || [];

  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");
  const low = findings.filter((f) => f.severity === "low");

  return {
    success: true,
    findings,
    counts: { high: high.length, medium: medium.length, low: low.length, total: findings.length },
    headline: high.length > 0
      ? `${high.length} HIGH-severity issue${high.length > 1 ? "s" : ""} — investigate before signing`
      : medium.length > 0
      ? `${medium.length} medium-severity issue${medium.length > 1 ? "s" : ""}`
      : "No major issues flagged",
    possible_upsells: upsells,
    questions_to_ask_contractor: [
      "Did you perform a Manual J load calculation? Can I see it?",
      "What refrigerant does the new equipment use? (must be R-454B or R-32 for installs in 2026+)",
      "What is the SEER2 / AFUE rating, and what is the warranty if I register it on time?",
      "Is the line set new or are you re-using the old one?",
      "Who pulls the permit and what is included in the price?",
      "What is your labor warranty separately from manufacturer parts warranty?",
      "What brand and model exactly — and is it a current production unit, not pre-ban inventory?",
    ],
  };
}
