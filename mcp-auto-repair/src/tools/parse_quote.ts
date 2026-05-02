import { z } from "zod";
import { analyzeAutoRepairQuote, ParsedAutoRepairQuote } from "../bridge/woogoro-api.js";
import { detectPriceVsBaseline } from "../bridge/price-baseline.js";

export const parseQuoteSchema = {
  name: "parse_quote",
  description:
    "Analyze an auto repair / mechanic shop quote or invoice. Extracts shop name, shop type (dealer/independent/chain), total price, labor rate, labor hours, parts vs labor breakdown, vehicle (year/make/model + mileage), individual repair line items with urgency ranking (critical/soon/can_wait/maintenance), parts type (OEM/aftermarket/reman), and possible upsells. Detects red flags like inflated labor hours vs Mitchell/AllData book time, suspicious 'while you're here' add-ons, missing parts warranty disclosure, and dealer-only-required repairs that an independent can do.",
  inputSchema: {
    type: "object",
    properties: {
      quote_text: {
        type: "string",
        description: "The full text of the auto repair quote/invoice. Optional if quote_images is provided.",
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

  const result = await analyzeAutoRepairQuote({
    text: parsed.quote_text,
    imageDataUrls: parsed.quote_images,
  });

  if (!result.ok) {
    return { success: false, error: result.error, status: result.status };
  }

  const data = result.data;
  const priceFinding = detectPriceVsBaseline(data);
  if (priceFinding) {
    if (!Array.isArray(data.redFlags)) data.redFlags = [];
    data.redFlags.unshift(priceFinding.flag);
  }
  return {
    success: true,
    parsed: data,
    priceBaselineFinding: priceFinding,
    summary_for_llm: buildSummary(data),
  };
}

function buildSummary(data: ParsedAutoRepairQuote): string {
  const lines: string[] = [];
  lines.push(`Total: ${data.totalPrice ? "$" + data.totalPrice.toLocaleString() : "not specified"}.`);
  if (data.shopName) lines.push(`Shop: ${data.shopName}${data.shopType ? ` (${data.shopType})` : ""}.`);
  if (data.yearMakeModel) lines.push(`Vehicle: ${data.yearMakeModel}${data.mileage ? ` (${data.mileage.toLocaleString()} mi)` : ""}.`);
  if (data.laborRate) lines.push(`Labor rate: $${data.laborRate}/hr.`);
  if (data.laborHours) lines.push(`Labor hours: ${data.laborHours}.`);
  if (data.partsTotal) lines.push(`Parts total: $${data.partsTotal.toLocaleString()}.`);

  if (data.repairs && data.repairs.length > 0) {
    lines.push(`\n${data.repairs.length} repair item(s):`);
    data.repairs.forEach((r) => {
      const urgency = r.repairUrgency ? ` [${r.repairUrgency}]` : "";
      const flag = r.laborHoursFlag === "high" ? " ⚠ labor hours may be inflated" : "";
      lines.push(`  - ${r.description}${urgency}${flag}`);
    });
  }

  if (data.redFlags && data.redFlags.length > 0) {
    lines.push(`\n${data.redFlags.length} red flag(s):`);
    data.redFlags.forEach((f) => lines.push(`  - ${f}`));
  }

  if (data.possibleUpsells && data.possibleUpsells.length > 0) {
    lines.push(`\n${data.possibleUpsells.length} possible upsell(s) to question:`);
    data.possibleUpsells.forEach((u) => lines.push(`  - ${u}`));
  }

  if (data.summary) lines.push(`\nSummary: ${data.summary}`);
  return lines.join("\n");
}
