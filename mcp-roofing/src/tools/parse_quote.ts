import { z } from "zod";
import { analyzeRoofingQuote, ParsedRoofingQuote } from "../bridge/woogoro-api.js";
import { auditRoofingQuote } from "../bridge/audit-rules.js";

export const parseQuoteSchema = {
  name: "parse_quote",
  description:
    "Analyze a roofing contractor quote (full replacement or repair). Extracts price, material, roof size, contractor, scope of work (tear-off, underlayment, flashing, ice shield, drip edge, ventilation, decking, disposal, permit, warranty), and runs an audit against industry standards. Flags scope gaps, price concerns vs Medicare-style state-adjusted benchmarks, and warranty issues. Accepts text or one or more base64-encoded image data URLs (format: 'data:image/png;base64,...'). Returns parsed structured data plus a list of audit findings the user can dispute.",
  inputSchema: {
    type: "object",
    properties: {
      quote_text: {
        type: "string",
        description: "The full text of the roofing quote, pasted by the user. Optional if quote_images is provided.",
      },
      quote_images: {
        type: "array",
        items: { type: "string" },
        description: "Up to 3 base64-encoded image data URLs of the quote. Format: 'data:image/png;base64,iVBORw0KGgo...' or similar for jpeg/webp. Optional if quote_text is provided.",
      },
    },
  },
};

const parseQuoteArgs = z.object({
  quote_text: z.string().optional(),
  quote_images: z.array(z.string()).optional(),
});

export async function runParseQuote(args: unknown) {
  const parsed = parseQuoteArgs.parse(args);

  const result = await analyzeRoofingQuote({
    text: parsed.quote_text,
    imageDataUrls: parsed.quote_images,
  });

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }

  const findings = auditRoofingQuote(result.data);
  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");
  const low = findings.filter((f) => f.severity === "low");

  return {
    success: true,
    parsed: result.data,
    findings,
    findings_summary: {
      high_count: high.length,
      medium_count: medium.length,
      low_count: low.length,
      headline: high.length > 0
        ? `${high.length} high-severity issue${high.length > 1 ? "s" : ""} found — investigate before signing`
        : medium.length > 0
        ? `${medium.length} medium-severity issue${medium.length > 1 ? "s" : ""} found — worth asking about`
        : "No major scope, price, or warranty issues flagged",
    },
    summary_for_llm: buildLlmSummary(result.data, findings),
  };
}

function buildLlmSummary(
  parsed: ParsedRoofingQuote,
  findings: ReturnType<typeof auditRoofingQuote>
): string {
  const lines: string[] = [];
  lines.push(
    `Quote total: ${parsed.price ? "$" + parsed.price.toLocaleString() : "not specified"}.`
  );
  lines.push(
    `Material: ${parsed.materialLabel || parsed.material || "not specified"}.`
  );
  if (parsed.roofSize) {
    lines.push(`Roof size: ${parsed.roofSize.toLocaleString()} sq ft (${(parsed.roofSize / 100).toFixed(1)} squares).`);
  }
  if (parsed.contractor) lines.push(`Contractor: ${parsed.contractor}.`);
  if (parsed.warrantyYears) lines.push(`Warranty: ${parsed.warrantyYears} years.`);

  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");

  if (high.length > 0) {
    lines.push(`\n${high.length} HIGH-severity issue(s):`);
    high.forEach((f) => lines.push(`  - ${f.flag}`));
  }
  if (medium.length > 0) {
    lines.push(`\n${medium.length} MEDIUM-severity issue(s):`);
    medium.forEach((f) => lines.push(`  - ${f.flag}`));
  }
  if (high.length === 0 && medium.length === 0) {
    lines.push(`\nNo major issues flagged. Quote scope appears reasonably complete.`);
  }

  return lines.join("\n");
}
