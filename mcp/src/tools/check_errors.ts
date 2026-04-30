import { z } from "zod";
import { analyzeBill, ParsedBill } from "../bridge/woogoro-api.js";

export const checkErrorsToolName = "check_errors";

export const checkErrorsToolDefinition = {
  name: checkErrorsToolName,
  description:
    "Check a previously-parsed medical bill (or fresh bill text/images) specifically for billing " +
    "errors: duplicate charges, upcoding, unbundling violations (NCCI rules), balance billing, " +
    "facility fees, No Surprises Act violations, and potential overcharges vs Medicare rates. " +
    "Returns only the errors and dispute opportunities, focused output for users who already " +
    "have the bill parsed.",
  inputSchema: {
    type: "object" as const,
    properties: {
      bill_text: {
        type: "string",
        description: "Bill text (if not already parsed)",
      },
      bill_images: {
        type: "array",
        items: { type: "string" },
        description: "Bill image data URLs (if not already parsed)",
      },
      parsed_bill: {
        type: "object",
        description:
          "Previously-parsed bill object from parse_bill. If provided, skips re-parsing.",
      },
    },
  },
};

const checkErrorsInputSchema = z.object({
  bill_text: z.string().optional(),
  bill_images: z.array(z.string()).optional(),
  parsed_bill: z.unknown().optional(),
});

export interface CheckErrorsResult {
  success: boolean;
  errors_found: Array<{
    type: string;
    description: string;
    severity: "high" | "medium" | "low";
    dispute_action?: string;
  }>;
  total_potential_savings?: number;
  summary: string;
}

export async function runCheckErrors(rawInput: unknown): Promise<CheckErrorsResult> {
  const parsed = checkErrorsInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      errors_found: [],
      summary: `Invalid input: ${parsed.error.message}`,
    };
  }

  let bill: ParsedBill;

  if (parsed.data.parsed_bill && typeof parsed.data.parsed_bill === "object") {
    bill = parsed.data.parsed_bill as ParsedBill;
  } else {
    const result = await analyzeBill({
      text: parsed.data.bill_text,
      imageDataUrls: parsed.data.bill_images,
    });
    if (!result.ok) {
      return {
        success: false,
        errors_found: [],
        summary: result.error,
      };
    }
    bill = result.data;
  }

  const errors = extractErrors(bill);
  const totalSavings = errors.reduce((sum, e) => {
    const match = e.description.match(/\$([0-9,]+)/);
    if (match) return sum + parseInt(match[1].replace(/,/g, ""), 10);
    return sum;
  }, 0);

  return {
    success: true,
    errors_found: errors,
    total_potential_savings: totalSavings || undefined,
    summary:
      errors.length === 0
        ? "No major errors detected on this bill."
        : `Found ${errors.length} potential issue(s) worth disputing.`,
  };
}

function extractErrors(bill: ParsedBill): CheckErrorsResult["errors_found"] {
  const errors: CheckErrorsResult["errors_found"] = [];

  if (bill.redFlags) {
    bill.redFlags.forEach((flag) => {
      errors.push({
        type: "red_flag",
        description: flag,
        severity: classifySeverity(flag),
      });
    });
  }

  if (bill.noSurprisesFlags) {
    bill.noSurprisesFlags.forEach((flag) => {
      errors.push({
        type: "no_surprises_act",
        description: flag,
        severity: "high",
        dispute_action:
          "Cite No Surprises Act in your dispute. You may not be liable for these charges.",
      });
    });
  }

  if (bill.unbundlingDetails) {
    bill.unbundlingDetails.forEach((detail) => {
      errors.push({
        type: "unbundling",
        description: `Unbundling violation: codes ${detail.codes.join(", ")} (${detail.rule})`,
        severity: "high",
        dispute_action:
          "Request these codes be corrected per NCCI bundling rules.",
      });
    });
  }

  if (bill.lineItems) {
    bill.lineItems.forEach((li) => {
      if (li.overchargeFlag) {
        errors.push({
          type: "overcharge",
          description: `${li.description}: ${li.overchargeFlag}`,
          severity: li.chargeToMedicareRatio && li.chargeToMedicareRatio > 5 ? "high" : "medium",
        });
      }
    });
  }

  return errors;
}

function classifySeverity(flag: string): "high" | "medium" | "low" {
  const lower = flag.toLowerCase();
  if (
    lower.includes("balance bill") ||
    lower.includes("upcoding") ||
    lower.includes("duplicate") ||
    lower.includes("violation")
  ) {
    return "high";
  }
  if (lower.includes("possible") || lower.includes("review")) {
    return "medium";
  }
  return "medium";
}
