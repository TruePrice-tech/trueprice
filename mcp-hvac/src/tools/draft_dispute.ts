import { z } from "zod";

export const draftDisputeSchema = {
  name: "draft_dispute",
  description:
    "Draft a written dispute or scope-clarification letter to an HVAC contractor. Tailored to common HVAC issues: oversizing/load-calc, R-410A/refrigerant compliance (EPA AIM Act 2026+), efficiency below code minimum, missing scope items, warranty inadequacy, oversold capacity, permit responsibility, brand/model verification.",
  inputSchema: {
    type: "object",
    properties: {
      issue_type: {
        type: "string",
        enum: [
          "no_load_calc",
          "refrigerant_compliance",
          "efficiency_below_code",
          "missing_scope_item",
          "warranty_inadequate",
          "oversized_system",
          "permit_responsibility",
          "brand_model_unspecified",
          "general",
        ],
      },
      contractor_name: { type: "string" },
      customer_name: { type: "string" },
      project_address: { type: "string" },
      quote_amount: { type: "number" },
      issue_detail: { type: "string", description: "Brief description of the specific issue" },
    },
    required: ["issue_type", "issue_detail"],
  },
};

const args = z.object({
  issue_type: z.enum([
    "no_load_calc",
    "refrigerant_compliance",
    "efficiency_below_code",
    "missing_scope_item",
    "warranty_inadequate",
    "oversized_system",
    "permit_responsibility",
    "brand_model_unspecified",
    "general",
  ]),
  contractor_name: z.string().optional(),
  customer_name: z.string().optional(),
  project_address: z.string().optional(),
  quote_amount: z.number().optional(),
  issue_detail: z.string(),
});

export async function runDraftDispute(rawArgs: unknown) {
  const parsed = args.parse(rawArgs);
  const contractor = parsed.contractor_name || "[Contractor Name]";
  const customer = parsed.customer_name || "[Your Name]";
  const address = parsed.project_address || "[Property Address]";
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  let subject = "";
  let body = "";

  switch (parsed.issue_type) {
    case "no_load_calc":
      subject = "Manual J Load Calculation Required Before HVAC Install";
      body = `I am writing regarding the HVAC quote you provided for ${address}.\n\n${parsed.issue_detail}\n\nProper HVAC sizing requires a Manual J load calculation per ACCA (Air Conditioning Contractors of America) standards. Sizing based on rules-of-thumb, square footage alone, or matching existing equipment is one of the most common causes of:\n- Short cycling (turning on and off too frequently)\n- Failure to dehumidify\n- Premature compressor failure\n- Higher utility bills\n\nBefore I sign this contract, I need:\n- A documented Manual J load calculation specific to my home\n- The proposed system tonnage and how it matches the calculated load\n- Confirmation that ductwork has been evaluated for the new system's airflow requirements (Manual D)\n\nIf you do not perform Manual J calculations, please indicate that in writing so I can seek a contractor who does.`;
      break;
    case "refrigerant_compliance":
      subject = "Refrigerant Type Verification — EPA AIM Act Compliance";
      body = `Regarding the HVAC equipment quoted for ${address}: ${parsed.issue_detail}\n\nUnder the EPA's AIM Act, R-410A refrigerant is no longer permitted in newly manufactured residential HVAC equipment as of January 1, 2026. New systems must use lower-GWP refrigerants such as R-454B or R-32.\n\nPlease confirm in writing:\n- The exact refrigerant in the proposed equipment (R-454B, R-32, or other)\n- The equipment's manufacture date — if R-410A, it must be pre-ban inventory disclosed as such\n- Whether the equipment is current production or end-of-life inventory\n- Manufacturer's parts/warranty terms in light of any inventory status\n\nInstalling out-of-compliance equipment can result in voided warranties and complications when the system needs service or replacement.`;
      break;
    case "efficiency_below_code":
      subject = "Equipment Efficiency Below Federal Minimum";
      body = `Regarding the HVAC system quoted for ${address}: ${parsed.issue_detail}\n\nThe U.S. Department of Energy raised the minimum SEER2 efficiency standard for new residential AC and heat pump installs to 15 SEER (14.3 SEER2) in 2023. Equipment below that threshold cannot legally be installed for new systems.\n\nPlease provide:\n- The exact SEER2 (and SEER if different) rating of the proposed equipment\n- Confirmation the equipment meets or exceeds federal minimum standards for my region\n- Documentation that this equipment qualifies for any applicable IRA (Inflation Reduction Act) tax credits if you marketed those\n\nIf the proposed unit does not meet code, please re-quote with compliant equipment.`;
      break;
    case "missing_scope_item":
      subject = "Quote Clarification — Missing or Excluded Scope";
      body = `Regarding the HVAC quote for ${address}: ${parsed.issue_detail}\n\nA complete HVAC install typically includes: equipment, refrigerant line set, electrical disconnect/whip, condensate drain line, equipment pad, thermostat (or confirmation existing one is reused), filter rack, permit and inspections, disposal of old equipment, and a Manual J load calculation. Excluding any of these creates change-order risk or causes the work to fail inspection.\n\nBefore I sign:\n- Please itemize whether the missing item(s) are included or what they cost as an add-on\n- Provide a revised quote with all required scope clearly listed\n\nI'm happy to pay for legitimate scope, but I need transparency to compare apples-to-apples with other bids.`;
      break;
    case "warranty_inadequate":
      subject = "Warranty Terms — Documentation Required";
      body = `Regarding the HVAC quote for ${address}: ${parsed.issue_detail}\n\nReputable HVAC installs typically include:\n- 10-year manufacturer parts warranty (when registered within 60 days of install)\n- 1-2 year contractor labor warranty\n\nPlease provide in writing:\n- Manufacturer warranty length, registration requirements, and any limitations (e.g., coverage transferability, evaporator coil exclusions)\n- Contractor labor warranty length and what it covers\n- Whether you offer extended labor warranty (5 or 10 years) and at what price\n- Maintenance requirements that, if not met, would void the warranty\n\nI need this in writing before signing.`;
      break;
    case "oversized_system":
      subject = "System Sizing Concern — Possible Oversizing";
      body = `Regarding the HVAC quote for ${address}: ${parsed.issue_detail}\n\nOversized HVAC systems are one of the most common installation mistakes. Symptoms include short cycling, poor humidity control, energy waste, and premature equipment failure. Industry guidelines suggest roughly 1 ton per 500-1,000 sqft of conditioned space depending on climate and home efficiency.\n\nPlease provide:\n- A documented Manual J load calculation matching the proposed tonnage to my home's actual cooling/heating load\n- An alternative quote with a smaller, properly-sized system if Manual J supports it\n- Justification for any deviation from Manual J output\n\nI'd rather pay for the right size than the bigger size.`;
      break;
    case "permit_responsibility":
      subject = "Permit Responsibility — Confirmation Required";
      body = `Regarding the HVAC quote for ${address}: ${parsed.issue_detail}\n\nMost municipalities require a mechanical/HVAC permit and final inspection for new equipment install. The contractor is typically responsible because they're the licensed party signing for the work, and homeowner-pulled permits can void contractor warranties.\n\nPlease confirm in writing:\n- Who pulls the permit\n- Whether the permit cost is included in the quoted price\n- Whether final inspection is included and who schedules it\n- What happens if a re-inspection is needed at the contractor's fault`;
      break;
    case "brand_model_unspecified":
      subject = "Equipment Brand and Model — Specification Required";
      body = `Regarding the HVAC quote for ${address}: ${parsed.issue_detail}\n\nThe quote does not specify the exact equipment brand and model number. Without this I cannot:\n- Verify the SEER2 / AFUE rating against published specs\n- Compare to competing quotes on equivalent terms\n- Register the manufacturer warranty\n- Confirm refrigerant compliance\n\nPlease provide in writing:\n- Brand (e.g., Carrier, Trane, Lennox, Goodman, Rheem, York, Mitsubishi, Daikin)\n- Specific model number for each piece of equipment\n- Manufacture date or inventory status\n- Refrigerant type\n\nOnce I have this I can finalize my decision.`;
      break;
    case "general":
    default:
      subject = `HVAC Project Concern — ${address}`;
      body = `I am writing regarding the HVAC project quoted for ${address}.\n\n${parsed.issue_detail}\n\nPlease respond within 5 business days with a written explanation and any necessary corrections to the contract.`;
      break;
  }

  const letter = `${date}\n\nTo: ${contractor}\nFrom: ${customer}\nRe: ${subject}\nProject Address: ${address}\n\n${body}\n\nThank you for your prompt attention.\n\n${customer}`;

  return {
    success: true,
    issue_type: parsed.issue_type,
    subject,
    letter,
    delivery_method: "Send via email AND certified mail (return receipt requested) so you have a paper trail.",
    legal_disclaimer: "This is a template for informational purposes. For complex disputes, consult a local construction attorney.",
  };
}
