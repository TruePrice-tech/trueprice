import { z } from "zod";
import { lookupLaborRate } from "../bridge/pricing-data.js";

export const lookupAveragePriceSchema = {
  name: "lookup_average_price",
  description:
    "Look up typical hourly labor rates for auto repair shops by shop type (dealer, independent, chain) and state. Useful for benchmarking the labor rate on a specific quote against the market. Dealerships are typically 30-50% more per hour than independents but may be required for warranty work.",
  inputSchema: {
    type: "object",
    properties: {
      shop_type: {
        type: "string",
        enum: ["dealer", "independent", "chain"],
        description: "Type of repair shop. 'independent' = mom-and-pop, 'chain' = Midas/Firestone/Pep Boys, 'dealer' = OEM dealership.",
      },
      state_code: {
        type: "string",
        description: "Two-letter US state code (e.g., 'CA', 'TX').",
      },
    },
    required: ["shop_type"],
  },
};

const args = z.object({
  shop_type: z.enum(["dealer", "independent", "chain"]),
  state_code: z.string().optional(),
});

export async function runLookupAveragePrice(rawArgs: unknown) {
  const parsed = args.parse(rawArgs);
  return lookupLaborRate({
    shopType: parsed.shop_type,
    stateCode: parsed.state_code,
  });
}
