import { z } from "zod";
import { analyzeBill, ParsedBill } from "../bridge/woogoro-api.js";

export const parseBillToolName = "parse_bill";

export const parseBillToolDefinition = {
  name: parseBillToolName,
  description:
    "Analyze a medical bill, hospital bill, EOB (Explanation of Benefits), or healthcare invoice. " +
    "Identifies CPT codes, charges, insurance applications, potential errors (duplicate charges, " +
    "upcoding, unbundling, balance billing, No Surprises Act violations), and dispute opportunities. " +
    "Accepts the bill as either pasted text or one or more base64-encoded image data URLs " +
    "(format: 'data:image/png;base64,...'). Returns structured analysis including red flags and " +
    "specific dispute actions.",
  inputSchema: {
    type: "object" as const,
    properties: {
      bill_text: {
        type: "string",
        description:
          "The full text of the bill, pasted from a PDF or typed by the user. Optional if " +
          "bill_images is provided.",
      },
      bill_images: {
        type: "array",
        items: { type: "string" },
        description:
          "Up to 3 base64-encoded image data URLs of the bill. Format: " +
          "'data:image/png;base64,iVBORw0KG...' or similar for jpeg/webp. Optional if bill_text " +
          "is provided.",
      },
    },
  },
};

const parseBillInputSchema = z.object({
  bill_text: z.string().optional(),
  bill_images: z.array(z.string()).optional(),
});

export type ParseBillInput = z.infer<typeof parseBillInputSchema>;

export interface ParseBillSuccess {
  success: true;
  parsed: ParsedBill;
  summary_for_llm: string;
}

export interface ParseBillFailure {
  success: false;
  error: string;
}

export async function runParseBill(
  rawInput: unknown
): Promise<ParseBillSuccess | ParseBillFailure> {
  const parsed = parseBillInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: `Invalid input: ${parsed.error.message}`,
    };
  }

  const { bill_text, bill_images } = parsed.data;

  if (!bill_text && (!bill_images || bill_images.length === 0)) {
    return {
      success: false,
      error:
        "Provide either bill_text or bill_images (at least one). To audit a medical bill, " +
        "the user needs to share the bill content with the assistant.",
    };
  }

  if (bill_images) {
    for (const img of bill_images) {
      if (!img.startsWith("data:image/")) {
        return {
          success: false,
          error:
            "Each entry in bill_images must be a data URL (start with 'data:image/'). " +
            "If the user shared an image, the assistant should encode it as a data URL " +
            "before passing it here.",
        };
      }
    }
  }

  const result = await analyzeBill({
    text: bill_text,
    imageDataUrls: bill_images,
  });

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
    };
  }

  return {
    success: true,
    parsed: result.data,
    summary_for_llm: buildLlmSummary(result.data),
  };
}

function buildLlmSummary(bill: ParsedBill): string {
  const parts: string[] = [];

  if (bill.totalBilled != null) {
    parts.push(`Total billed: $${bill.totalBilled.toLocaleString()}.`);
  }
  if (bill.patientResponsibility != null) {
    parts.push(`Patient owes: $${bill.patientResponsibility.toLocaleString()}.`);
  }
  if (bill.insurancePaid != null) {
    parts.push(`Insurance paid: $${bill.insurancePaid.toLocaleString()}.`);
  }
  if (bill.facilityType) {
    parts.push(`Facility type: ${bill.facilityType.replace(/_/g, " ")}.`);
  }
  if (bill.lineItems && bill.lineItems.length > 0) {
    parts.push(`${bill.lineItems.length} line item(s) extracted.`);
  }
  if (bill.redFlags && bill.redFlags.length > 0) {
    parts.push(`${bill.redFlags.length} red flag(s) identified:`);
    bill.redFlags.slice(0, 5).forEach((flag) => {
      parts.push(`  - ${flag}`);
    });
  }
  if (bill.disputeActions && bill.disputeActions.length > 0) {
    parts.push(`Dispute actions:`);
    bill.disputeActions.slice(0, 5).forEach((action) => {
      parts.push(`  - ${action}`);
    });
  }
  if (bill.summary) {
    parts.push(`\nSummary: ${bill.summary}`);
  }

  return parts.join("\n");
}
