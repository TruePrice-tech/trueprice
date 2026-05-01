import type { ParsedRoofingQuote, ScopeItems } from "./woogoro-api.js";
import { loadPricingData } from "./pricing-data.js";

export interface AuditFinding {
  severity: "high" | "medium" | "low";
  category: "scope_gap" | "price_concern" | "warranty_gap" | "transparency" | "documentation";
  flag: string;
  detail: string;
  disputeAction?: string;
}

const REQUIRED_SCOPE_ITEMS: Array<{ key: keyof ScopeItems; label: string; severity: "high" | "medium" }> = [
  { key: "tearOff", label: "Tear-off of existing roof", severity: "high" },
  { key: "underlayment", label: "Underlayment (15lb/30lb felt or synthetic)", severity: "high" },
  { key: "flashing", label: "Flashing replacement (chimney, pipe boots, step, valley)", severity: "high" },
  { key: "iceShield", label: "Ice & water shield at eaves and valleys", severity: "high" },
  { key: "dripEdge", label: "Drip edge at eaves and rakes", severity: "medium" },
  { key: "ventilation", label: "Attic ventilation (ridge vent or box vents)", severity: "medium" },
  { key: "starterStrip", label: "Starter strip at eaves", severity: "medium" },
  { key: "ridgeCap", label: "Ridge cap shingles", severity: "medium" },
  { key: "disposal", label: "Disposal of old roofing material", severity: "medium" },
  { key: "permit", label: "Permit (who pulls + cost)", severity: "medium" },
];

export function auditRoofingQuote(parsed: ParsedRoofingQuote): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const scope = parsed.scopeItems || {};

  // Scope gaps — missing or excluded items
  for (const req of REQUIRED_SCOPE_ITEMS) {
    const status = scope[req.key];
    if (status === "excluded") {
      findings.push({
        severity: req.severity,
        category: "scope_gap",
        flag: `${req.label}: EXCLUDED`,
        detail: `Quote explicitly excludes ${req.label.toLowerCase()}. This is a standard scope item for a complete roof replacement and excluding it can cause leaks, void warranty, or trigger surprise change orders.`,
        disputeAction: `Ask the contractor: "Why is ${req.label.toLowerCase()} excluded? Either include it in this price or itemize the additional cost so I can compare to other bids."`,
      });
    } else if (status === "unclear" || status === undefined) {
      findings.push({
        severity: req.severity === "high" ? "medium" : "low",
        category: "scope_gap",
        flag: `${req.label}: not specified`,
        detail: `Quote does not clearly state whether ${req.label.toLowerCase()} is included. Ambiguous scope creates change-order risk.`,
        disputeAction: `Get clarification in writing: "Please confirm in writing whether ${req.label.toLowerCase()} is included in the quoted price."`,
      });
    }
  }

  // Price concerns — compare to per-square baseline
  if (parsed.price && parsed.roofSize && parsed.material) {
    const data = loadPricingData();
    const materialKey = mapMaterial(parsed.material);
    const tier = data.materialTiers[materialKey];
    if (tier) {
      const stateMult = data.stateMultipliers[(parsed.stateCode || "").toUpperCase()] || 1.0;
      const squares = parsed.roofSize / 100;
      const expectedLow = tier.perSquare.low * stateMult * squares;
      const expectedMid = tier.perSquare.mid * stateMult * squares;
      const expectedHigh = tier.perSquare.high * stateMult * squares * 1.4; // include 40% buffer for complexity/pitch

      if (parsed.price > expectedHigh) {
        const overpct = Math.round(((parsed.price - expectedMid) / expectedMid) * 100);
        findings.push({
          severity: "high",
          category: "price_concern",
          flag: `Price ${overpct}% above mid-range benchmark`,
          detail: `Quote is $${parsed.price.toLocaleString()} for ${squares} squares of ${tier.label} in ${parsed.stateCode || "this state"}. Mid-range expectation is around $${Math.round(expectedMid).toLocaleString()} (range $${Math.round(expectedLow).toLocaleString()}-$${Math.round(expectedHigh).toLocaleString()} including pitch/complexity buffer).`,
          disputeAction: "Get 2-3 additional quotes for direct comparison. If this stays the highest by >15%, ask the contractor to explain the gap (premium materials, complex pitch, deck replacement assumptions).",
        });
      } else if (parsed.price < expectedLow * 0.7) {
        findings.push({
          severity: "medium",
          category: "price_concern",
          flag: "Price is unusually low",
          detail: `Quote is $${parsed.price.toLocaleString()} for ${squares} squares of ${tier.label}. Expected low end is around $${Math.round(expectedLow).toLocaleString()}. Suspiciously low quotes often signal: (1) contractor will hit you with change orders, (2) cheap or counterfeit materials, (3) inadequate insurance/license.`,
          disputeAction: "Verify license + general liability + workers comp insurance. Ask for material spec sheets and product warranty paperwork before signing.",
        });
      }
    }
  }

  // Warranty gaps
  if (!parsed.warrantyYears && !parsed.warranty) {
    findings.push({
      severity: "medium",
      category: "warranty_gap",
      flag: "No warranty terms specified",
      detail: "Quote does not mention warranty length or terms. A complete roof replacement should include both a manufacturer material warranty AND a separate workmanship warranty from the contractor. Major architectural shingles (GAF Timberline, OC Duration, CertainTeed Landmark, Malarkey) carry 'limited lifetime' material warranties, but the meaningful number is the non-prorated period — typically 10 years standard, extendable to 50 years only via certified-contractor system warranties (e.g., GAF Golden Pledge). After the non-prorated window, coverage is pro-rated; transferability is limited; registration within 30-60 days is often required; labor is typically NOT covered unless an extended/system warranty is purchased.",
      disputeAction: "Request both warranties in writing: 'What manufacturer warranty applies (standard limited lifetime, or upgraded system/extended)? What is the non-prorated period, and is labor covered? What is your separate workmanship warranty?'",
    });
  } else if (parsed.warrantyYears && parsed.warrantyYears < 10) {
    findings.push({
      severity: "low",
      category: "warranty_gap",
      flag: `Workmanship warranty is short (${parsed.warrantyYears} years)`,
      detail: "Most reputable roofers offer at least a 10-year workmanship warranty on a full replacement. Anything shorter than 5 years is a red flag.",
      disputeAction: "Ask if they will extend the workmanship warranty to 10 years. If they refuse, get other quotes.",
    });
  }

  // Transparency — missing key data
  if (!parsed.contractor) {
    findings.push({
      severity: "low",
      category: "documentation",
      flag: "Contractor/company name not clearly identified",
      detail: "Quote does not clearly identify the contracting company. Make sure you have legal name, license number, and physical address before signing.",
    });
  }
  if (!parsed.material && !parsed.materialLabel) {
    findings.push({
      severity: "high",
      category: "transparency",
      flag: "Specific roofing material not identified",
      detail: "Quote does not specify the exact shingle/material brand and product line. Without this, you can't verify the manufacturer warranty or compare quotes accurately.",
      disputeAction: "Get the exact brand, product line, and color in writing (e.g., 'GAF Timberline HDZ - Charcoal').",
    });
  }
  if (!parsed.roofSize) {
    findings.push({
      severity: "medium",
      category: "transparency",
      flag: "Roof size not specified",
      detail: "Quote does not state the roof's square footage or number of squares. Without this, you can't calculate per-square pricing or verify against benchmarks.",
      disputeAction: "Request itemized size: 'How many squares (or sq ft) is the roof, broken down by main roof and any auxiliary structures?'",
    });
  }

  return findings;
}

function mapMaterial(material: string): string {
  const m = material.toLowerCase();
  if (m === "architectural" || m === "asphalt") return "architectural";
  if (m === "3-tab" || m === "three_tab" || m === "3tab") return "three_tab";
  if (m === "designer" || m === "luxury") return "designer";
  if (m === "metal" || m === "standing_seam") return "metal_standing_seam";
  if (m === "corrugated") return "metal_corrugated";
  return material;
}
