import laborRatesJson from "../../data/auto-repair-labor-rates.json" with { type: "json" };
import pricingJson from "../../data/auto-repair-pricing.json" with { type: "json" };

export interface LaborRatesData {
  laborRatesByShopType: Record<string, { low: number; mid: number; high: number }>;
  laborMultiplierByRegion: Record<string, number>;
  shopTypeLabels: Record<string, string>;
  stateRegions?: Record<string, string>;
}

export interface PricingData {
  metadata: { sources: string; baseYear: number; nationalMedianLaborRate: number; inflationRate: number };
  stateMultipliers: Record<string, number>;
}

export function loadLaborRates(): LaborRatesData {
  return laborRatesJson as unknown as LaborRatesData;
}

export function loadPricingData(): PricingData {
  return pricingJson as unknown as PricingData;
}

export function lookupLaborRate(opts: {
  shopType?: "dealer" | "independent" | "chain";
  stateCode?: string;
}) {
  const data = loadLaborRates();
  const pricing = loadPricingData();
  const shopType = opts.shopType || "independent";
  const stateCode = (opts.stateCode || "").toUpperCase();

  const rates = data.laborRatesByShopType[shopType];
  if (!rates) {
    return {
      found: false,
      message: `Shop type '${shopType}' not in our pricing database. Try: dealer, independent, chain.`,
      availableShopTypes: Object.keys(data.laborRatesByShopType),
    };
  }

  const stateMult = stateCode ? pricing.stateMultipliers[stateCode] || 1.0 : 1.0;
  const adjusted = {
    low: Math.round(rates.low * stateMult),
    mid: Math.round(rates.mid * stateMult),
    high: Math.round(rates.high * stateMult),
  };

  return {
    found: true,
    shopType,
    shopTypeLabel: data.shopTypeLabels[shopType],
    stateCode: stateCode || null,
    stateMultiplier: stateMult,
    nationalMedianLaborRate: pricing.metadata.nationalMedianLaborRate,
    laborRatePerHour: {
      baseline: rates,
      adjusted,
    },
    methodology: `Hourly labor rate range for ${data.shopTypeLabels[shopType]}, adjusted by state cost multiplier (${stateMult}x).`,
    notes: [
      "Dealerships are typically 30-50% more expensive per hour than independents but may be required for warranty work or complex models.",
      "Chains (Midas, Firestone, Pep Boys) sit between dealer and independent on labor rate but often charge for unnecessary upsells.",
      "Always ask for the hourly labor rate AND the labor hours billed — both should be on the invoice.",
    ],
  };
}
