import { z } from "zod";
import { lookupHvacPrice } from "../bridge/pricing-data.js";

export const lookupAveragePriceSchema = {
  name: "lookup_average_price",
  description:
    "Look up typical installed price ranges for HVAC systems by system type, efficiency tier, and state. Useful for benchmarking specific contractor quotes. Covers central AC, heat pumps, gas furnaces, mini splits, full systems (AC+furnace), and geothermal at common SEER/AFUE tiers. Includes labor + equipment breakdown where available.",
  inputSchema: {
    type: "object",
    properties: {
      system_type: {
        type: "string",
        enum: ["central_ac", "heat_pump", "gas_furnace", "mini_split", "full_system", "geothermal"],
        description: "Type of HVAC system",
      },
      efficiency_tier: {
        type: "string",
        description: "Efficiency tier (e.g., '14_seer', '16_seer', '18_seer', '20_seer', '25_seer' for AC; varies by system_type). Omit to see available tiers.",
      },
      state_code: {
        type: "string",
        description: "Two-letter US state code (e.g., 'CA', 'TX'). Used for state cost-of-living adjustment.",
      },
      home_sqft: {
        type: "number",
        description: "Home square footage. Optional context for sizing checks.",
      },
    },
    required: ["system_type"],
  },
};

const args = z.object({
  system_type: z.enum(["central_ac", "heat_pump", "gas_furnace", "mini_split", "full_system", "geothermal"]),
  efficiency_tier: z.string().optional(),
  state_code: z.string().optional(),
  home_sqft: z.number().optional(),
});

export async function runLookupAveragePrice(rawArgs: unknown) {
  const parsed = args.parse(rawArgs);
  return lookupHvacPrice({
    systemType: parsed.system_type,
    efficiencyTier: parsed.efficiency_tier,
    stateCode: parsed.state_code,
    homeSqFt: parsed.home_sqft,
  });
}
