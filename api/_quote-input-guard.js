// api/_quote-input-guard.js
//
// Shared validation for any endpoint that bumps cal:* aggregates
// without going through calibration.js (which has its own checks).
// Born from 2026-05-25 drift incident: community-quote, beta-quote-submit
// and capture-quote were accepting malformed city values like
// "sample street\ncharlotte" and unknown verticals like "other" /
// "general" / "flooring", silently polluting cal:* aggregates and
// triggering false drift alerts.
//
// Returns { ok: boolean, reasons: string[] }. Reasons are short slugs
// suitable for logging (no PII).

const KNOWN_VERTICALS = new Set([
  "hvac", "plumbing", "roofing", "electrical", "solar", "windows",
  "siding", "painting", "garage-doors", "garage-door", "fencing",
  "concrete", "landscaping", "foundation", "insulation", "gutters",
  "kitchen", "kitchen-remodel", "moving", "auto-repair", "medical",
  "legal"
]);

// Street/road suffixes that signal we captured an address line, not a city.
// Word-boundary matched, case-insensitive.
const STREET_SUFFIX_RE = /\b(street|st|avenue|ave|drive|dr|road|rd|boulevard|blvd|lane|ln|court|ct|place|pl|way|highway|hwy|parkway|pkwy|circle|cir|trail|trl)\b/i;

export function validateQuoteInput({ city, state, vertical, price }) {
  const reasons = [];

  if (city != null && city !== "") {
    const c = String(city);
    if (/[\n\r\t]/.test(c)) reasons.push("city_control_chars");
    if (STREET_SUFFIX_RE.test(c)) reasons.push("city_street_suffix");
    if (/^\d/.test(c.trim())) reasons.push("city_starts_with_digit");
    if (c.length > 80) reasons.push("city_too_long");
  }

  if (state != null && state !== "" && !/^[A-Z]{2}$/.test(String(state))) {
    reasons.push("state_not_2letter_upper");
  }

  if (vertical != null && vertical !== "") {
    const v = String(vertical).toLowerCase();
    if (!KNOWN_VERTICALS.has(v)) reasons.push("unknown_vertical");
  }

  if (price != null) {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0 || p > 1_000_000) {
      reasons.push("price_out_of_envelope");
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export { KNOWN_VERTICALS };
