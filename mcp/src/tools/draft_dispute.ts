export const draftDisputeToolName = "draft_dispute";

export const draftDisputeToolDefinition = {
  name: draftDisputeToolName,
  description:
    "Draft a dispute letter for a medical bill error. Generates formal language for the patient " +
    "to send to the billing department or insurance company. Specific to the type of error " +
    "(unbundling, balance billing, upcoding, duplicate charges, No Surprises Act violation).",
  inputSchema: {
    type: "object" as const,
    properties: {
      error_type: {
        type: "string",
        enum: [
          "unbundling",
          "balance_billing",
          "upcoding",
          "duplicate_charge",
          "no_surprises_act",
          "facility_fee",
          "out_of_network",
          "preventive_care_violation",
          "general",
        ],
        description: "Type of billing error being disputed",
      },
      bill_summary: {
        type: "string",
        description: "Brief summary of the bill (provider, date, amount, what was disputed)",
      },
      patient_name: {
        type: "string",
        description: "Patient's name (for letter signature)",
      },
      account_number: {
        type: "string",
        description: "Account or invoice number on the bill",
      },
      specific_charges: {
        type: "string",
        description: "The specific charges or CPT codes being disputed",
      },
    },
    required: ["error_type", "bill_summary"],
  },
};

export interface DraftDisputeResult {
  success: boolean;
  letter_text?: string;
  send_to?: string;
  follow_up_steps?: string[];
  error?: string;
}

export async function runDraftDispute(rawInput: unknown): Promise<DraftDisputeResult> {
  // Phase 1: returns interface only. Phase 2 implementation will use
  // template-based letter generation. Templates per error type, with
  // CFR/USC citations where applicable (e.g., 42 USC 300gg-111 for
  // No Surprises Act). Decision pending: Lane's call on whether to
  // include LLM-generated personalization or stay strictly templated.
  return {
    success: false,
    error:
      "draft_dispute is not yet implemented in Phase 1. Will ship in Phase 2 with " +
      "templated letters per error type. The parse_bill tool already returns " +
      "specific disputeActions array with recommended steps.",
  };
}
