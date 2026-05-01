import { config } from "../config.js";

export interface RepairLine {
  description?: string;
  laborHours?: number | null;
  laborCost?: number | null;
  partsCost?: number | null;
  partsType?: "oem" | "aftermarket" | "reman" | "unknown";
  lineTotal?: number | null;
  repairUrgency?: "critical" | "soon" | "can_wait" | "maintenance";
  laborHoursFlag?: "high" | "normal" | "low";
}

export interface ScopeItems {
  partsItemized?: "yes" | "no" | "unclear";
  laborRateStated?: "yes" | "no" | "unclear";
  laborHoursListed?: "yes" | "no" | "unclear";
  partsType?: "yes" | "no" | "unclear";
  shopSupplies?: "yes" | "no" | "unclear";
  taxIncluded?: "yes" | "no" | "unclear";
  partsWarranty?: "yes" | "no" | "unclear";
  laborWarranty?: "yes" | "no" | "unclear";
  diagnosticFee?: "yes" | "no" | "unclear";
  fluidDisposal?: "yes" | "no" | "unclear";
}

export interface ParsedAutoRepairQuote {
  totalPrice?: number | null;
  laborRate?: number | null;
  laborHours?: number | null;
  laborTotal?: number | null;
  partsTotal?: number | null;
  shopName?: string | null;
  shopType?: "dealer" | "independent" | "chain" | null;
  city?: string | null;
  stateCode?: string | null;
  yearMakeModel?: string | null;
  mileage?: number | null;
  vehicleCategory?: "economy" | "standard" | "truck_suv" | "luxury" | "performance" | "ev_hybrid" | null;
  possibleUpsells?: string[];
  repairs?: RepairLine[];
  scopeItems?: ScopeItems;
  redFlags?: string[];
  summary?: string;
  pricingContext?: Record<string, unknown>;
}

export interface AnalyzeQuoteOptions {
  text?: string;
  imageDataUrls?: string[];
}

export interface AnalyzeQuoteResponse {
  ok: true;
  data: ParsedAutoRepairQuote;
}

export interface AnalyzeQuoteError {
  ok: false;
  status: number;
  error: string;
}

export async function analyzeAutoRepairQuote(
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

  const url = `${config.woogoroApiBase}${config.autoRepairEndpoint}`;
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
      | { success?: boolean; source?: string; data?: ParsedAutoRepairQuote }
      | ParsedAutoRepairQuote;
    const data: ParsedAutoRepairQuote =
      envelope && typeof envelope === "object" && "data" in envelope && envelope.data
        ? (envelope.data as ParsedAutoRepairQuote)
        : (envelope as ParsedAutoRepairQuote);
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
