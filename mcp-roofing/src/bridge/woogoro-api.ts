import { config } from "../config.js";

export interface ScopeItems {
  tearOff?: "included" | "excluded" | "unclear";
  underlayment?: "included" | "excluded" | "unclear";
  flashing?: "included" | "excluded" | "unclear";
  iceShield?: "included" | "excluded" | "unclear";
  dripEdge?: "included" | "excluded" | "unclear";
  ventilation?: "included" | "excluded" | "unclear";
  ridgeVent?: "included" | "excluded" | "unclear";
  starterStrip?: "included" | "excluded" | "unclear";
  ridgeCap?: "included" | "excluded" | "unclear";
  decking?: "included" | "excluded" | "unclear";
  disposal?: "included" | "excluded" | "unclear";
  permit?: "included" | "excluded" | "unclear";
}

export interface PricingContext {
  city?: string;
  state?: string;
  multiplier?: number;
  laborMult?: number;
  materialsMult?: number;
  population?: number | null;
  source?: string;
  expectedRange?: { low?: number | null; high?: number | null } | null;
}

export interface CalibrationData {
  avgPrice?: number | null;
  quotes?: number | null;
  lastUpdated?: number | null;
  source?: string;
  confidence?: "high" | "medium" | "low" | "low_data" | "model_only";
}

export interface ParsedRoofingQuote {
  price?: number | null;
  material?: "architectural" | "asphalt" | "metal" | "tile" | null;
  materialLabel?: string | null;
  contractor?: string | null;
  city?: string | null;
  stateCode?: string | null;
  roofSize?: number | null;
  warrantyYears?: number | null;
  warranty?: string | null;
  scopeItems?: ScopeItems;
  pricingContext?: PricingContext;
  calibration?: CalibrationData | null;
}

export interface AnalyzeQuoteOptions {
  text?: string;
  imageDataUrls?: string[];
}

export interface AnalyzeQuoteResponse {
  ok: true;
  data: ParsedRoofingQuote;
}

export interface AnalyzeQuoteError {
  ok: false;
  status: number;
  error: string;
}

export async function analyzeRoofingQuote(
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

  const url = `${config.woogoroApiBase}${config.parseQuoteEndpoint}`;
  const body: Record<string, unknown> = { vertical: config.vertical };
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
      | { success?: boolean; source?: string; data?: ParsedRoofingQuote }
      | ParsedRoofingQuote;
    const data: ParsedRoofingQuote =
      envelope && typeof envelope === "object" && "data" in envelope && envelope.data
        ? (envelope.data as ParsedRoofingQuote)
        : (envelope as ParsedRoofingQuote);
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
