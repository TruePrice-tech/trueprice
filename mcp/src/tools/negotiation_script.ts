export const negotiationScriptToolName = "negotiation_script";

export const negotiationScriptToolDefinition = {
  name: negotiationScriptToolName,
  description:
    "Generate a phone negotiation script for the patient to call the billing department. " +
    "Includes opening framing, specific asks (cash discount, charity care, payment plan), and " +
    "responses to common pushback. Tailored to the bill amount and patient's ability to pay.",
  inputSchema: {
    type: "object" as const,
    properties: {
      bill_amount: {
        type: "number",
        description: "Total amount the patient owes",
      },
      ability_to_pay: {
        type: "string",
        enum: ["cannot_pay", "partial_payment", "full_payment_for_discount"],
        description: "Patient's financial position going into the call",
      },
      hardship_situation: {
        type: "string",
        description: "Brief description of any financial hardship to mention (optional)",
      },
      facility_type: {
        type: "string",
        description: "Hospital, physician office, etc. (affects available programs)",
      },
    },
    required: ["bill_amount", "ability_to_pay"],
  },
};

export interface NegotiationScriptResult {
  success: boolean;
  opening?: string;
  asks?: Array<{ ask: string; rationale: string; expected_response: string }>;
  pushback_responses?: Array<{ pushback: string; response: string }>;
  closing?: string;
  documents_to_request?: string[];
  error?: string;
}

export async function runNegotiationScript(
  rawInput: unknown
): Promise<NegotiationScriptResult> {
  // Phase 1: returns interface only. Phase 2 implementation will use
  // templated scripts per scenario (cannot_pay → charity care + financial
  // assistance application, partial_payment → cash discount negotiation,
  // full_payment_for_discount → prompt-pay discount ask).
  return {
    success: false,
    error:
      "negotiation_script is not yet implemented in Phase 1. Will ship in Phase 2 with " +
      "scenario-specific templates.",
  };
}
