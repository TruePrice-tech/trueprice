import type { ParsedHvacQuote } from "./woogoro-api.js";

export interface PriceBaselineFinding {
  severity: "high" | "medium";
  category: "price_concern";
  flag: string;
  detail: string;
  baseline: "calibration" | "expectedRange";
}

/**
 * Detects when the quoted total price is materially above the local baseline.
 *
 * Evaluates two baselines independently and emits the more severe finding:
 * (1) calibration.avgPrice when avgPrice exists, quotes >= 5, and confidence is
 *     not "low_data". "model_only" is the default label when the parser does not
 *     emit a static expectedRange and does not signal avgPrice unreliability.
 *     Thresholds: >25% medium, >50% high.
 * (2) pricingContext.expectedRange.high. Thresholds: >10% medium, >25% high.
 *
 * Both signals are evaluated so a borderline case (e.g. 24% above cal avg AND
 * 11% above expected-high) still surfaces a finding.
 *
 * Does not flag UNDER-pricing.
 */
export function detectPriceVsBaseline(parsed: ParsedHvacQuote): PriceBaselineFinding | null {
  const price = parsed.totalPrice;
  if (!price || price <= 0) return null;

  const candidates: PriceBaselineFinding[] = [];

  const cal = parsed.calibration;
  if (cal && cal.avgPrice && cal.avgPrice > 0 && (cal.quotes ?? 0) >= 5 && cal.confidence !== "low_data") {
    const delta = (price - cal.avgPrice) / cal.avgPrice;
    if (delta > 0.50) {
      const pct = Math.round(delta * 100);
      candidates.push({
        severity: "high",
        category: "price_concern",
        flag: `Quote is ${pct}% above local average ($${Math.round(cal.avgPrice).toLocaleString()})`,
        detail: `Quote of $${Math.round(price).toLocaleString()} is significantly higher than the local average of $${Math.round(cal.avgPrice).toLocaleString()} across ${cal.quotes} comparable quotes in this area. Get 2-3 additional bids before signing.`,
        baseline: "calibration",
      });
    } else if (delta > 0.25) {
      const pct = Math.round(delta * 100);
      candidates.push({
        severity: "medium",
        category: "price_concern",
        flag: `Quote is ${pct}% above local average ($${Math.round(cal.avgPrice).toLocaleString()})`,
        detail: `Quote of $${Math.round(price).toLocaleString()} is above the local average of $${Math.round(cal.avgPrice).toLocaleString()} across ${cal.quotes} comparable quotes in this area. Worth comparing to a second bid.`,
        baseline: "calibration",
      });
    }
  }

  const expectedRange = parsed.pricingContext?.expectedRange as { high?: number | null } | undefined;
  const expectedHigh = expectedRange?.high;
  if (expectedHigh && expectedHigh > 0) {
    if (price > expectedHigh * 1.25) {
      const pct = Math.round(((price - expectedHigh) / expectedHigh) * 100);
      candidates.push({
        severity: "high",
        category: "price_concern",
        flag: `Quote is ${pct}% above the top of the expected price range ($${Math.round(expectedHigh).toLocaleString()})`,
        detail: `Quote of $${Math.round(price).toLocaleString()} exceeds the high end of the expected range ($${Math.round(expectedHigh).toLocaleString()}) by ${pct}%. Get 2-3 additional bids before signing.`,
        baseline: "expectedRange",
      });
    } else if (price > expectedHigh * 1.10) {
      const pct = Math.round(((price - expectedHigh) / expectedHigh) * 100);
      candidates.push({
        severity: "medium",
        category: "price_concern",
        flag: `Quote is ${pct}% above the top of the expected price range ($${Math.round(expectedHigh).toLocaleString()})`,
        detail: `Quote of $${Math.round(price).toLocaleString()} is above the high end of the expected range ($${Math.round(expectedHigh).toLocaleString()}). Worth comparing to a second bid.`,
        baseline: "expectedRange",
      });
    }
  }

  if (candidates.length === 0) return null;
  // Prefer the more severe finding; tie-break on calibration (real quotes beat static range).
  const score = (f: PriceBaselineFinding) => (f.severity === "high" ? 2 : 1) * 10 + (f.baseline === "calibration" ? 1 : 0);
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0];
}
