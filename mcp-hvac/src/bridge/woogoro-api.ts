import { config } from "../config.js";

export interface ScopeItems {
  equipment?: "yes" | "no" | "unclear";
  lineSet?: "yes" | "no" | "unclear";
  thermostat?: "yes" | "no" | "unclear";
  ductwork?: "yes" | "no" | "unclear";
  electrical?: "yes" | "no" | "unclear";
  pad?: "yes" | "no" | "unclear";
  drainLine?: "yes" | "no" | "unclear";
  filterRack?: "yes" | "no" | "unclear";
  permit?: "yes" | "no" | "unclear";
  disposal?: "yes" | "no" | "unclear";
  warranty?: "yes" | "no" | "unclear";
  loadCalc?: "yes" | "no" | "unclear";
}

export interface LineItem {
  description?: string;
  laborCost?: number | null;
  equipmentCost?: number | null;
  lineTotal?: number | null;
}

export interface ParsedHvacQuote {
  contractor?: string | null;
  totalPrice?: number | null;
  jobType?: "install" | "replacement" | "repair" | "service" | "maintenance" | null;
  laborTotal?: number | null;
  laborCost?: number | null;
  equipmentTotal?: number | null;
  equipmentCost?: number | null;
  systemType?: "central_ac" | "heat_pump" | "gas_furnace" | "mini_split" | "full_system" | "geothermal" | null;
  brand?: string | null;
  modelNumber?: string | null;
  seer?: number | null;
  afue?: number | null;
  tonnage?: number | null;
  btu?: number | null;
  zones?: number | null;
  refrigerantType?: string | null;
  city?: string | null;
  stateCode?: string | null;
  homeSqFt?: number | null;
  warrantyPartsYears?: number | null;
  warrantyLaborYears?: number | null;
  lineItems?: LineItem[];
  scopeItems?: ScopeItems;
  warrantyParts?: string | null;
  warrantyLabor?: string | null;
  possibleUpsells?: string[];
  oversizingFlag?: boolean;
  redFlags?: string[];
  summary?: string;
  confidence?: "high" | "medium" | "low";
  pricingContext?: HvacPricingContext;
  calibration?: CalibrationData | null;
}

export interface HvacPricingContext {
  state?: string;
  stateMultiplier?: number;
  systemType?: string;
  systemLabel?: string;
  jobType?: string;
  isServiceJob?: boolean;
  expectedRange?: { low?: number | null; high?: number | null } | Record<string, unknown> | null;
  brandTier?: Record<string, unknown> | null;
  taxCredit?: unknown;
  seasonalMultiplier?: number;
  source?: string;
  modelRange?: { low?: number | null; high?: number | null } | null;
  calibrationApplied?: boolean;
  [k: string]: unknown;
}

export interface CalibrationData {
  avgPrice?: number | null;
  quotes?: number | null;
  lastUpdated?: number | null;
  source?: string;
  confidence?: "high" | "medium" | "low" | "low_data" | "model_only";
}

export interface AnalyzeQuoteOptions {
  text?: string;
  imageDataUrls?: string[];
}

export interface AnalyzeQuoteResponse {
  ok: true;
  data: ParsedHvacQuote;
}

export interface AnalyzeQuoteError {
  ok: false;
  status: number;
  error: string;
}

export async function analyzeHvacQuote(
  opts: AnalyzeQuoteOptions
): Promise<AnalyzeQuoteResponse | AnalyzeQuoteError> {
  const { text, imageDataUrls } = opts;

  if (!text && (!imageDataUrls || imageDataUrls.length === 0)) {
    return {
      ok: false,
      status: 400,
      error: "Must provide quote text or at least one image data URL",
    };
  }

  const url = `${config.woogoroApiBase}${config.hvacEndpoint}`;
  const body: Record<string, unknown> = {};
  if (text) body.text = text;
  if (imageDataUrls && imageDataUrls.length > 0) body.images = imageDataUrls;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.woogoroMcpKey) {
      headers["x-woogoro-mcp-key"] = config.woogoroMcpKey;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      let errBody: string;
      try {
        errBody = await response.text();
      } catch {
        errBody = response.statusText;
      }
      return {
        ok: false,
        status: response.status,
        error: `Woogoro API returned ${response.status}: ${errBody.slice(0, 500)}`,
      };
    }

    const envelope = (await response.json()) as
      | { success?: boolean; source?: string; data?: ParsedHvacQuote }
      | ParsedHvacQuote;
    const data: ParsedHvacQuote =
      envelope && typeof envelope === "object" && "data" in envelope && envelope.data
        ? (envelope.data as ParsedHvacQuote)
        : (envelope as ParsedHvacQuote);
    return { ok: true, data };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      error: `Request to Woogoro failed: ${msg}`,
    };
  }
}
