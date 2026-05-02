import type { ParsedAutoRepairQuote } from "./woogoro-api.js";

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
 * Note: auto-repair calibration is bucketed at city/state level across all repair
 * scopes, so the local "average" mixes a wide range of jobs. A 25%+ delta still
 * means "you are paying more than typical at this shop level for this city," which
 * is the consumer-facing signal we want, even if scope is not strictly comparable.
 *
 * Does not flag UNDER-pricing.
 */
export function detectPriceVsBaseline(parsed: ParsedAutoRepairQuote): PriceBaselineFinding | null {
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
        detail: `Quote of $${Math.round(price).toLocaleString()} is significantly higher than the local average of $${Math.round(cal.avgPrice).toLocaleString()} across ${cal.quotes} comparable quotes in this area. Note: local average mixes repair scopes, but a gap this large still warrants getting one or two competing estimates.`,
        baseline: "calibration",
      });
    } else if (delta > 0.25) {
      const pct = Math.round(delta * 100);
      candidates.push({
        severity: "medium",
        category: "price_concern",
        flag: `Quote is ${pct}% above local average ($${Math.round(cal.avgPrice).toLocaleString()})`,
        detail: `Quote of $${Math.round(price).toLocaleString()} is above the local average of $${Math.round(cal.avgPrice).toLocaleString()} across ${cal.quotes} comparable quotes. Worth getting a second estimate.`,
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
        detail: `Quote of $${Math.round(price).toLocaleString()} exceeds the high end of the expected range ($${Math.round(expectedHigh).toLocaleString()}) by ${pct}%. Get one or two competing estimates before authorizing the work.`,
        baseline: "expectedRange",
      });
    } else if (price > expectedHigh * 1.10) {
      const pct = Math.round(((price - expectedHigh) / expectedHigh) * 100);
      candidates.push({
        severity: "medium",
        category: "price_concern",
        flag: `Quote is ${pct}% above the top of the expected price range ($${Math.round(expectedHigh).toLocaleString()})`,
        detail: `Quote of $${Math.round(price).toLocaleString()} is above the high end of the expected range ($${Math.round(expectedHigh).toLocaleString()}). Worth comparing to a second estimate.`,
        baseline: "expectedRange",
      });
    }
  }

  if (candidates.length === 0) return null;
  const score = (f: PriceBaselineFinding) => (f.severity === "high" ? 2 : 1) * 10 + (f.baseline === "calibration" ? 1 : 0);
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0];
}
