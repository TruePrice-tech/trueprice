import pricingJson from "../../data/roofing-pricing.json" with { type: "json" };

export interface MaterialTier {
  label: string;
  tag: string;
  perSquare: { low: number; mid: number; high: number };
  brands?: string;
}

export interface PricingData {
  metadata: { sources: string; baseYear: number; notes: string };
  stateMultipliers: Record<string, number>;
  materialTiers: Record<string, MaterialTier>;
  pitchMultipliers: Record<string, { label: string; mult: number }>;
  complexityMultipliers: Record<string, { label: string; mult: number }>;
  layerMultipliers: Record<string, { label: string; mult: number }>;
  commonJobs: Record<string, { label: string; squares: number; total: [number, number] }>;
  questionsToAskContractor: string[];
}

export function loadPricingData(): PricingData {
  return pricingJson as unknown as PricingData;
}

export function lookupRoofingPrice(opts: {
  material?: string;
  stateCode?: string;
  pitch?: "low" | "standard" | "steep" | "very_steep";
  complexity?: "simple" | "moderate" | "complex";
  layers?: "one" | "two" | "overlay";
  squares?: number;
}) {
  const data = loadPricingData();
  const material = (opts.material || "architectural").toLowerCase();
  const stateCode = (opts.stateCode || "").toUpperCase();
  const pitch = opts.pitch || "standard";
  const complexity = opts.complexity || "moderate";
  const layers = opts.layers || "one";

  // Map common synonyms to material keys
  const materialKey = ((): string => {
    if (material === "architectural" || material === "asphalt") return "architectural";
    if (material === "3-tab" || material === "three_tab" || material === "3tab") return "three_tab";
    if (material === "designer" || material === "luxury") return "designer";
    if (material === "metal" || material === "standing_seam") return "metal_standing_seam";
    if (material === "corrugated" || material === "exposed_fastener") return "metal_corrugated";
    return material;
  })();

  const tier = data.materialTiers[materialKey];
  if (!tier) {
    return {
      found: false,
      requested: { material, stateCode, pitch, complexity, layers, squares: opts.squares },
      message: `Material '${material}' not in our pricing database. Try: three_tab, architectural, designer, metal_standing_seam, metal_corrugated.`,
      availableMaterials: Object.keys(data.materialTiers),
    };
  }

  const stateMult = stateCode ? data.stateMultipliers[stateCode] || 1.0 : 1.0;
  const pitchMult = data.pitchMultipliers[pitch]?.mult || 1.0;
  const complexityMult = data.complexityMultipliers[complexity]?.mult || 1.0;
  const layerMult = data.layerMultipliers[layers]?.mult || 1.0;
  const totalMult = stateMult * pitchMult * complexityMult * layerMult;

  const adjustedPerSquare = {
    low: Math.round(tier.perSquare.low * totalMult),
    mid: Math.round(tier.perSquare.mid * totalMult),
    high: Math.round(tier.perSquare.high * totalMult),
  };

  const result: Record<string, unknown> = {
    found: true,
    material: materialKey,
    materialLabel: tier.label,
    materialTag: tier.tag,
    brands: tier.brands,
    stateCode: stateCode || null,
    pitch,
    complexity,
    layers,
    multipliers: {
      state: stateMult,
      pitch: pitchMult,
      complexity: complexityMult,
      layers: layerMult,
      total: Math.round(totalMult * 1000) / 1000,
    },
    perSquareBaseline: tier.perSquare,
    perSquareAdjusted: adjustedPerSquare,
    methodology: `Baseline per-square cost for ${tier.label} adjusted by state (${stateMult}x), pitch (${pitchMult}x), complexity (${complexityMult}x), and layers (${layerMult}x).`,
  };

  if (opts.squares && opts.squares > 0) {
    result.squares = opts.squares;
    result.totalAdjusted = {
      low: Math.round(adjustedPerSquare.low * opts.squares),
      mid: Math.round(adjustedPerSquare.mid * opts.squares),
      high: Math.round(adjustedPerSquare.high * opts.squares),
    };
  }

  return result;
}
