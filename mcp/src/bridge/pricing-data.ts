import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

export interface CPTEntry {
  description: string;
  category: string;
  medicareRate: number;
  commercialRange: [number, number];
  notes?: string;
}

export interface PricingData {
  metadata: {
    source: string;
    baseYear: number;
    conversionFactor: number;
    inflationRate: number;
    commercialMultipliers: {
      professional: number;
      outpatient_facility: number;
      inpatient_facility: number;
      overall: number;
    };
    codeCount: number;
  };
  gpciLocalities: {
    stateMultipliers: Record<string, number>;
  };
  facilityMultipliers: Record<string, number | string>;
  commercialByState: Record<string, number | string>;
  ncciCommonBundles: Array<{ col1: string; col2: string; rule: string }>;
  commonCPTCodes: Record<string, CPTEntry>;
}

let cachedData: PricingData | null = null;

export function loadPricingData(): PricingData {
  if (cachedData) return cachedData;

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../../data/medical-cpt-pricing.json"),
    resolve(here, "../data/medical-cpt-pricing.json"),
    resolve(here, "../../../data/medical-cpt-pricing.json"),
  ];

  let lastErr: unknown = null;
  for (const path of candidates) {
    try {
      const raw = readFileSync(path, "utf-8");
      cachedData = JSON.parse(raw) as PricingData;
      return cachedData;
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(
    `Could not load pricing data from any candidate path. Last error: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`
  );
}

export function lookupCPT(
  cptCode: string,
  options: { stateCode?: string; facilityType?: string } = {}
) {
  const data = loadPricingData();
  const entry = data.commonCPTCodes[cptCode];
  if (!entry) {
    return {
      found: false,
      cpt_code: cptCode,
      message: `CPT code ${cptCode} not in our pricing database (we cover ${data.metadata.codeCount} of the most common codes). For full coverage, check the AMA CPT codebook or CMS Medicare Physician Fee Schedule.`,
    };
  }

  const stateCode = (options.stateCode || "").toUpperCase();
  const facilityType = options.facilityType || "hospital_outpatient";

  const stateMult = stateCode
    ? data.gpciLocalities.stateMultipliers[stateCode] ?? 1.0
    : 1.0;
  const commercialMultRaw = stateCode
    ? data.commercialByState[stateCode]
    : data.metadata.commercialMultipliers.overall;
  const commercialMult =
    typeof commercialMultRaw === "number"
      ? commercialMultRaw
      : data.metadata.commercialMultipliers.overall;
  const facilityMultRaw = data.facilityMultipliers[facilityType];
  const facilityMult = typeof facilityMultRaw === "number" ? facilityMultRaw : 1.0;

  const baseMedicare = entry.medicareRate;
  const adjustedMedicare = Math.round(baseMedicare * stateMult * facilityMult);
  const commercialEstimate = Math.round(
    baseMedicare * stateMult * commercialMult * facilityMult
  );
  const fairLow = Math.round(baseMedicare * stateMult * facilityMult);
  const fairHigh = Math.round(baseMedicare * stateMult * commercialMult * facilityMult * 1.1);

  return {
    found: true,
    cpt_code: cptCode,
    description: entry.description,
    category: entry.category,
    notes: entry.notes,
    base_medicare_rate: baseMedicare,
    adjusted_medicare_rate: adjustedMedicare,
    commercial_estimate: commercialEstimate,
    fair_price_range: [fairLow, fairHigh] as [number, number],
    state_applied: stateCode || null,
    state_multiplier: stateMult,
    facility_applied: facilityType,
    facility_multiplier: facilityMult,
    commercial_multiplier: commercialMult,
    methodology: `Medicare base rate ${baseMedicare} adjusted by state GPCI (${stateMult}x) and facility (${facilityMult}x). Commercial estimate uses ${commercialMult}x Medicare benchmark.`,
  };
}
