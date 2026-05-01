import { z } from "zod";
import { analyzeRoofingQuote, ParsedRoofingQuote } from "../bridge/woogoro-api.js";
import { auditRoofingQuote } from "../bridge/audit-rules.js";

export const checkErrorsSchema = {
  name: "check_errors",
  description:
    "Audit a roofing quote for scope gaps, price concerns, warranty issues, and documentation problems. Returns a list of findings ranked by severity (high/medium/low) with specific dispute actions. Accepts either a previously-parsed quote object (from parse_quote) OR raw quote text/images for a fresh parse. Use this when you've already run parse_quote and want to re-extract findings, OR when the user wants only the issue list without the structured parse.",
  inputSchema: {
    type: "object",
    properties: {
      parsed_quote: {
        type: "object",
        description: "Previously-parsed quote object from parse_quote. If provided, skips re-parsing.",
      },
      quote_text: {
        type: "string",
        description: "Raw quote text. Used if parsed_quote is not provided.",
      },
      quote_images: {
        type: "array",
        items: { type: "string" },
        description: "Up to 3 base64-encoded image data URLs of the quote. Used if parsed_quote is not provided.",
      },
    },
  },
};

const checkErrorsArgs = z.object({
  parsed_quote: z.record(z.unknown()).optional(),
  quote_text: z.string().optional(),
  quote_images: z.array(z.string()).optional(),
});

export async function runCheckErrors(args: unknown) {
  const parsed = checkErrorsArgs.parse(args);

  let quote: ParsedRoofingQuote;

  if (parsed.parsed_quote) {
    quote = parsed.parsed_quote as ParsedRoofingQuote;
  } else {
    if (!parsed.quote_text && (!parsed.quote_images || parsed.quote_images.length === 0)) {
      return {
        success: false,
        error: "Must provide either parsed_quote, quote_text, or quote_images",
      };
    }
    const result = await analyzeRoofingQuote({
      text: parsed.quote_text,
      imageDataUrls: parsed.quote_images,
    });
    if (!result.ok) {
      return { success: false, error: result.error, status: result.status };
    }
    quote = result.data;
  }

  const findings = auditRoofingQuote(quote);
  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");
  const low = findings.filter((f) => f.severity === "low");

  return {
    success: true,
    findings,
    counts: { high: high.length, medium: medium.length, low: low.length, total: findings.length },
    headline: high.length > 0
      ? `${high.length} high-severity issue${high.length > 1 ? "s" : ""} — investigate before signing`
      : medium.length > 0
      ? `${medium.length} medium-severity issue${medium.length > 1 ? "s" : ""} — worth asking about`
      : "Quote appears reasonably complete — no major issues flagged",
    questions_to_ask_contractor: [
      "What shingle brand, product line, and color are you proposing?",
      "Is this a full tear-off or an overlay? How many layers currently?",
      "What underlayment — 15lb felt, 30lb felt, or synthetic?",
      "Is ice and water shield included at eaves, valleys, and penetrations?",
      "Are all flashings being replaced (chimney, pipe boots, valleys, step)?",
      "What is the per-sheet price for decking repair if needed?",
      "Is the permit included? Who pulls it?",
      "What are the manufacturer warranty and workmanship warranty separately?",
    ],
  };
}
