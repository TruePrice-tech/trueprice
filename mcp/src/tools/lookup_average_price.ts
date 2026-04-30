export const lookupAveragePriceToolName = "lookup_average_price";

export const lookupAveragePriceToolDefinition = {
  name: lookupAveragePriceToolName,
  description:
    "Look up the typical Medicare and commercial price for a CPT/HCPCS code, optionally adjusted " +
    "for state. Useful for benchmarking specific charges against fair-price ranges.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cpt_code: {
        type: "string",
        description: "CPT or HCPCS code (e.g., '99213', '70450', 'G0438')",
      },
      state_code: {
        type: "string",
        description: "Two-letter US state code for geographic adjustment (optional)",
      },
      facility_type: {
        type: "string",
        enum: [
          "hospital_outpatient",
          "hospital_inpatient",
          "emergency_room",
          "physician_office",
          "ambulatory_surgery_center",
          "lab",
          "imaging_center",
          "urgent_care",
        ],
        description: "Type of facility for facility-multiplier adjustment (optional)",
      },
    },
    required: ["cpt_code"],
  },
};

export interface LookupResult {
  success: boolean;
  cpt_code: string;
  description?: string;
  medicare_rate?: number;
  commercial_estimate?: number;
  fair_price_range?: [number, number];
  state_applied?: string;
  facility_applied?: string;
  notes?: string;
  error?: string;
}

export async function runLookupAveragePrice(
  rawInput: unknown
): Promise<LookupResult> {
  // Phase 1: returns interface only. Phase 2 will load
  // data/medical-cpt-pricing.json directly (mounted from Woogoro repo or
  // exposed via a small read-only endpoint at /api/medical-cpt-lookup).
  // Decision pending: Lane's call on whether to expose the pricing JSON
  // via API or bundle it into the MCP server.
  const input = rawInput as { cpt_code?: string };
  return {
    success: false,
    cpt_code: input?.cpt_code || "",
    error:
      "lookup_average_price is not yet implemented in Phase 1. " +
      "Pending Lane's decision on data delivery: API endpoint vs bundled JSON. " +
      "For now, use parse_bill which returns Medicare rates per line item.",
  };
}
