import { config } from "../config.js";

export interface BillLineItem {
  description: string;
  cptCode?: string | null;
  quantity?: number;
  chargedAmount?: number | null;
  allowedAmount?: number | null;
  insurancePaid?: number | null;
  patientOwes?: number | null;
  isFacilityFee?: boolean;
  category?: string;
  medicareRate?: number;
  commercialEstimate?: number;
  fairPriceRange?: [number, number];
  chargeToMedicareRatio?: number;
  overchargeFlag?: string;
}

export interface BillChecks {
  cptCodes?: "yes" | "no" | "partial";
  itemized?: "yes" | "no" | "partial";
  facility?: "yes" | "no" | "unclear";
  insuranceApplied?: "yes" | "no" | "unclear";
  inNetwork?: "yes" | "no" | "unclear";
  duplicates?: "none_found" | "possible" | "unclear";
  dateMatch?: "yes" | "no" | "unclear";
  unbundling?: "none_found" | "possible" | "unclear";
  upcoding?: "none_found" | "possible" | "unclear";
  patientResponsibility?: "yes" | "no" | "unclear";
  noSurprisesCompliant?: "yes" | "no" | "unclear" | "not_applicable";
}

export interface FacilityComparison {
  currentFacilityType?: string | null;
  estimatedSavingsAtASC?: number | null;
  estimatedSavingsAtImaging?: number | null;
  applicableProcedures?: string[];
}

export interface ParsedBill {
  totalBilled?: number | null;
  insurancePaid?: number | null;
  adjustments?: number | null;
  patientResponsibility?: number | null;
  facilityName?: string | null;
  facilityType?: string | null;
  serviceDate?: string | null;
  stateCode?: string | null;
  insuranceName?: string | null;
  isEmergency?: boolean;
  lineItems?: BillLineItem[];
  billChecks?: BillChecks;
  unbundlingDetails?: Array<{ codes: string[]; rule: string }>;
  facilityComparison?: FacilityComparison;
  noSurprisesFlags?: string[];
  redFlags?: string[];
  disputeActions?: string[];
  summary?: string;
}

export interface AnalyzeBillOptions {
  text?: string;
  imageDataUrls?: string[];
}

export interface AnalyzeBillResponse {
  ok: true;
  data: ParsedBill;
}

export interface AnalyzeBillError {
  ok: false;
  status: number;
  error: string;
}

export async function analyzeBill(
  opts: AnalyzeBillOptions
): Promise<AnalyzeBillResponse | AnalyzeBillError> {
  const { text, imageDataUrls } = opts;

  if (!text && (!imageDataUrls || imageDataUrls.length === 0)) {
    return {
      ok: false,
      status: 400,
      error: "Must provide bill text or at least one image data URL",
    };
  }

  const url = `${config.woogoroApiBase}${config.medicalBillEndpoint}`;
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

    const data = (await response.json()) as ParsedBill;
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
