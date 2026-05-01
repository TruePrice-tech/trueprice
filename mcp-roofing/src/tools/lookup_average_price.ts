import { z } from "zod";
import { lookupRoofingPrice } from "../bridge/pricing-data.js";

export const lookupAveragePriceSchema = {
  name: "lookup_average_price",
  description:
    "Look up the typical per-square ($/100 sqft installed) and total price for a roofing job, adjusted by state, pitch, complexity, and tear-off layers. Useful for benchmarking specific contractor quotes against market rates. Covers the most common materials: 3-tab asphalt, architectural shingles, designer/luxury shingles, standing-seam metal, and corrugated/exposed-fastener metal. Includes brand recommendations and product tier guidance.",
  inputSchema: {
    type: "object",
    properties: {
      material: {
        type: "string",
        enum: ["three_tab", "architectural", "asphalt", "designer", "metal_standing_seam", "metal", "metal_corrugated", "corrugated"],
        description: "Roofing material. 'architectural' = standard 30-year asphalt (most popular). Use 'asphalt' as alias for architectural.",
      },
      state_code: {
        type: "string",
        description: "Two-letter US state code (e.g., 'CA', 'TX'). Used for state cost-of-living adjustment.",
      },
      pitch: {
        type: "string",
        enum: ["low", "standard", "steep", "very_steep"],
        description: "Roof pitch (slope). 'standard' = 6/12 to 8/12 (most homes).",
      },
      complexity: {
        type: "string",
        enum: ["simple", "moderate", "complex"],
        description: "Roof complexity. 'moderate' = hips, valleys, 1-2 dormers (most homes).",
      },
      layers: {
        type: "string",
        enum: ["one", "two", "overlay"],
        description: "Tear-off layers. 'one' = single layer tear-off (most common). 'overlay' = no tear-off (cheaper but reduces lifespan).",
      },
      squares: {
        type: "number",
        description: "Roof size in squares (1 square = 100 sq ft). If provided, returns total project price estimate too.",
      },
    },
    required: ["material"],
  },
};

const lookupArgs = z.object({
  material: z.string(),
  state_code: z.string().optional(),
  pitch: z.enum(["low", "standard", "steep", "very_steep"]).optional(),
  complexity: z.enum(["simple", "moderate", "complex"]).optional(),
  layers: z.enum(["one", "two", "overlay"]).optional(),
  squares: z.number().optional(),
});

export async function runLookupAveragePrice(args: unknown) {
  const parsed = lookupArgs.parse(args);
  const result = lookupRoofingPrice({
    material: parsed.material,
    stateCode: parsed.state_code,
    pitch: parsed.pitch,
    complexity: parsed.complexity,
    layers: parsed.layers,
    squares: parsed.squares,
  });
  return result;
}
