import { z } from "zod";
import { lookupCPT } from "../bridge/pricing-data.js";

export const lookupAveragePriceToolName = "lookup_average_price";

export const lookupAveragePriceToolDefinition = {
  name: lookupAveragePriceToolName,
  description:
    "Look up the typical Medicare and commercial price for a CPT/HCPCS code, optionally adjusted " +
    "for state and facility type. Useful for benchmarking specific charges against fair-price " +
    "ranges. Covers ~146 of the most common medical codes (office visits, ER, imaging, lab, " +
    "common procedures). Returns base Medicare rate, state-adjusted rate, commercial estimate, " +
    "and a fair-price range.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cpt_code: {
        type: "string",
        description: "CPT or HCPCS code (e.g., '99213', '70450', 'G0438')",
      },
      state_code: {
        type: "string",
        description:
          "Two-letter US state code for GPCI geographic adjustment (e.g., 'CA', 'NY'). Optional.",
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
          "freestanding_imaging",
          "freestanding_lab",
          "urgent_care",
        ],
        description:
          "Facility type for facility-multiplier adjustment. ASC saves ~42% vs hospital outpatient. Optional.",
      },
    },
    required: ["cpt_code"],
  },
};

const lookupInputSchema = z.object({
  cpt_code: z.string().min(1),
  state_code: z.string().optional(),
  facility_type: z.string().optional(),
});

export async function runLookupAveragePrice(rawInput: unknown) {
  const parsed = lookupInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: `Invalid input: ${parsed.error.message}`,
    };
  }

  try {
    const result = lookupCPT(parsed.data.cpt_code.toUpperCase(), {
      stateCode: parsed.data.state_code,
      facilityType: parsed.data.facility_type,
    });

    return {
      success: true,
      ...result,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
