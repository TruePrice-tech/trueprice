import pricingJson from "../../data/hvac-pricing-model.json" with { type: "json" };

export interface EfficiencyTier {
  equipment?: [number, number];
  labor?: [number, number];
  total: [number, number];
}

export interface SystemTypeEntry {
  label: string;
  pricingByEfficiency: Record<string, EfficiencyTier>;
  notes?: string;
}

export interface PricingData {
  metadata: { sources: string; baseYear: number; inflationRate: number };
  stateMultipliers: Record<string, number>;
  systemTypes: Record<string, SystemTypeEntry>;
  tonnageByHomeSqFt?: Record<string, unknown>;
  brandTiers?: Record<string, unknown>;
  commonUpsells?: string[];
  oversizingRules?: Record<string, unknown>;
  scopeCheckItems?: string[];
}

export function loadPricingData(): PricingData {
  return pricingJson as unknown as PricingData;
}

export function lookupHvacPrice(opts: {
  systemType?: string;
  efficiencyTier?: string;
  stateCode?: string;
  homeSqFt?: number;
}) {
  const data = loadPricingData();
  const systemType = (opts.systemType || "central_ac").toLowerCase();
  const stateCode = (opts.stateCode || "").toUpperCase();

  const sys = data.systemTypes[systemType];
  if (!sys) {
    return {
      found: false,
      requested: opts,
      message: `System type '${systemType}' not in our pricing database.`,
      availableSystemTypes: Object.keys(data.systemTypes),
    };
  }

  const stateMult = stateCode ? data.stateMultipliers[stateCode] || 1.0 : 1.0;
  const tierKey = opts.efficiencyTier || Object.keys(sys.pricingByEfficiency)[0];
  const tier = sys.pricingByEfficiency[tierKey];

  if (!tier) {
    return {
      found: true,
      systemType,
      systemLabel: sys.label,
      stateCode: stateCode || null,
      stateMultiplier: stateMult,
      availableEfficiencyTiers: Object.keys(sys.pricingByEfficiency),
      notes: sys.notes,
      message: `Efficiency tier '${opts.efficiencyTier}' not found. See availableEfficiencyTiers.`,
    };
  }

  const total = tier.total;
  const adjustedTotal: [number, number] = [
    Math.round(total[0] * stateMult),
    Math.round(total[1] * stateMult),
  ];

  return {
    found: true,
    systemType,
    systemLabel: sys.label,
    efficiencyTier: tierKey,
    stateCode: stateCode || null,
    stateMultiplier: stateMult,
    baselineTotal: total,
    adjustedTotal,
    equipmentBaseline: tier.equipment,
    laborBaseline: tier.labor,
    notes: sys.notes,
    methodology: `Baseline total for ${sys.label} at ${tierKey} efficiency, adjusted by state multiplier ${stateMult}x.`,
  };
}
