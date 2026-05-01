import { z } from "zod";
import { analyzeHvacQuote } from "../bridge/woogoro-api.js";

export const parseQuoteSchema = {
  name: "parse_quote",
  description:
    "Analyze an HVAC contractor quote (full system install, replacement, repair, or service). Extracts contractor, total price, labor/equipment breakdown, system type (central AC, heat pump, gas furnace, mini split, full system, geothermal), brand, model, SEER/AFUE efficiency, tonnage, refrigerant type, scope items, and warranty terms. Detects oversizing (tonnage vs home sqft), R-410A compliance issues for 2026+ installs (EPA AIM Act), low-efficiency equipment below federal minimum, and common upsells. Accepts text or one or more base64-encoded image data URLs (format: 'data:image/png;base64,...').",
  inputSchema: {
    type: "object",
    properties: {
      quote_text: {
        type: "string",
        description: "The full text of the HVAC quote, pasted by the user. Optional if quote_images is provided.",
      },
      quote_images: {
        type: "array",
        items: { type: "string" },
        description: "Up to 3 base64-encoded image data URLs of the quote.",
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

  const result = await analyzeHvacQuote({
    text: parsed.quote_text,
    imageDataUrls: parsed.quote_images,
  });

  if (!result.ok) {
    return { success: false, error: result.error, status: result.status };
  }

  const data = result.data;
  const redFlags = data.redFlags || [];

  return {
    success: true,
    parsed: data,
    summary_for_llm: buildSummary(data, redFlags),
  };
}

function buildSummary(data: ReturnType<typeof analyzeHvacQuote> extends Promise<infer T> ? (T extends { data: infer D } ? D : never) : never, redFlags: string[]): string {
  const lines: string[] = [];
  lines.push(`Total: ${data.totalPrice ? "$" + data.totalPrice.toLocaleString() : "not specified"}.`);
  if (data.systemType) lines.push(`System: ${data.systemType}.`);
  if (data.brand) lines.push(`Brand: ${data.brand}.`);
  if (data.seer) lines.push(`SEER: ${data.seer}.`);
  if (data.afue) lines.push(`AFUE: ${data.afue}%.`);
  if (data.tonnage) lines.push(`Tonnage: ${data.tonnage} tons.`);
  if (data.refrigerantType) lines.push(`Refrigerant: ${data.refrigerantType}.`);
  if (data.warrantyParts) lines.push(`Parts warranty: ${data.warrantyParts}.`);
  if (data.warrantyLabor) lines.push(`Labor warranty: ${data.warrantyLabor}.`);

  if (data.oversizingFlag) {
    lines.push(`\n⚠ Oversizing flag: tonnage may be too large for home size — short cycling and humidity issues likely.`);
  }
  if (redFlags.length > 0) {
    lines.push(`\n${redFlags.length} red flag(s):`);
    redFlags.forEach((f) => lines.push(`  - ${f}`));
  } else {
    lines.push(`\nNo red flags detected by automated audit.`);
  }
  if (data.summary) {
    lines.push(`\nSummary: ${data.summary}`);
  }
  return lines.join("\n");
}
