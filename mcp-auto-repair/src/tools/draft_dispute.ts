import { z } from "zod";

export const draftDisputeSchema = {
  name: "draft_dispute",
  description:
    "Draft a written dispute letter to an auto repair shop or dealer. Tailored to common auto repair disputes: inflated labor hours, unauthorized work, diagnostic fee not credited, parts type mismatch (OEM billed but aftermarket installed), Magnuson-Moss warranty issues (manufacturer voiding warranty over aftermarket parts), recall/TSB work charged when it should be free, and general shop billing concerns.",
  inputSchema: {
    type: "object",
    properties: {
      issue_type: {
        type: "string",
        enum: [
          "labor_hours_inflated",
          "unauthorized_work",
          "diagnostic_fee_not_credited",
          "parts_type_mismatch",
          "warranty_void_threat",
          "recall_or_tsb",
          "shop_supplies_fee",
          "general",
        ],
      },
      shop_name: { type: "string" },
      customer_name: { type: "string" },
      vehicle: { type: "string", description: "Year/make/model and VIN if known" },
      quote_amount: { type: "number" },
      issue_detail: { type: "string", description: "Brief description of the specific issue" },
    },
    required: ["issue_type", "issue_detail"],
  },
};

const args = z.object({
  issue_type: z.enum([
    "labor_hours_inflated",
    "unauthorized_work",
    "diagnostic_fee_not_credited",
    "parts_type_mismatch",
    "warranty_void_threat",
    "recall_or_tsb",
    "shop_supplies_fee",
    "general",
  ]),
  shop_name: z.string().optional(),
  customer_name: z.string().optional(),
  vehicle: z.string().optional(),
  quote_amount: z.number().optional(),
  issue_detail: z.string(),
});

export async function runDraftDispute(rawArgs: unknown) {
  const parsed = args.parse(rawArgs);
  const shop = parsed.shop_name || "[Shop Name]";
  const customer = parsed.customer_name || "[Your Name]";
  const vehicle = parsed.vehicle || "[Year/Make/Model and VIN]";
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  let subject = "";
  let body = "";

  switch (parsed.issue_type) {
    case "labor_hours_inflated":
      subject = "Labor Hours Verification Request";
      body = `I am writing regarding the repair quote/invoice for ${vehicle}.\n\n${parsed.issue_detail}\n\nThe labor hours billed appear higher than the published flat-rate book time for this repair. Most repair shops use a flat-rate guide such as Mitchell ProDemand, AllData, or the manufacturer's published service times. Customers can verify these book times against industry references.\n\nPlease provide in writing:\n- The flat-rate guide you used (Mitchell, AllData, OEM, Chilton, other) and the specific book time per repair\n- The actual labor hours you billed per repair line\n- Any justification for hours billed beyond book time (rust, broken bolts, model-specific complications)\n- Photos or documentation of any conditions that justified extended labor\n\nIf the billed hours materially exceed book time without documented justification, I am asking for a corrected invoice reflecting book time labor.`;
      break;
    case "unauthorized_work":
      subject = "Dispute — Unauthorized Repair Work";
      body = `Regarding the work performed on ${vehicle}: ${parsed.issue_detail}\n\nMost states require auto repair shops to obtain written or recorded verbal authorization from the customer before performing repairs beyond an initial estimate. Repairs done without authorization may be disputed and, in many states, the shop is barred from charging for unauthorized work above a small threshold.\n\nPlease provide:\n- A copy of any written or recorded authorization I gave for the disputed work\n- Documentation of when authorization was requested and the response\n- An itemized invoice separating authorized vs disputed line items\n\nI dispute the charges for the unauthorized work and request a corrected invoice reflecting only the work I authorized. If we cannot resolve this, I will file a complaint with the [State] Bureau of Automotive Repair / Attorney General's consumer protection division.`;
      break;
    case "diagnostic_fee_not_credited":
      subject = "Diagnostic Fee Credit Request";
      body = `Regarding the invoice for ${vehicle}: ${parsed.issue_detail}\n\nA diagnostic fee was charged when the vehicle was brought in. Industry common practice — and many shops' own posted policies — is to credit the diagnostic fee toward the cost of any repair the customer authorizes following the diagnosis.\n\nPlease confirm in writing:\n- Whether your shop's posted policy credits the diagnostic fee toward authorized repairs\n- If so, why this credit was not applied to my invoice\n- A corrected invoice reflecting the credit\n\nIf the diagnostic fee is non-creditable per posted policy, I'd like to see that policy in writing.`;
      break;
    case "parts_type_mismatch":
      subject = "Parts Type Verification Request";
      body = `Regarding the repair of ${vehicle}: ${parsed.issue_detail}\n\nThe invoice charges OEM-grade parts pricing, but I want to verify the actual parts installed match what was billed. There is a meaningful price difference between OEM, aftermarket, and remanufactured parts, and they have different warranty coverage.\n\nPlease provide:\n- The exact part number(s) used per repair\n- The brand and source (OEM dealer, aftermarket supplier, remanufacturer)\n- Receipts/invoices showing the parts cost the shop paid (if you bill OEM, you should be installing OEM)\n- The warranty terms attached to those specific parts\n\nIf aftermarket or remanufactured parts were installed but billed at OEM pricing, I am requesting a corrected invoice or a refund of the difference.`;
      break;
    case "warranty_void_threat":
      subject = "Magnuson-Moss Warranty Act — Aftermarket Parts and Warranty Coverage";
      body = `Regarding ${vehicle}: ${parsed.issue_detail}\n\nUnder the Magnuson-Moss Warranty Act (15 USC §§ 2301-2312), a manufacturer or dealer cannot void a vehicle's warranty solely because aftermarket parts were used or because service was performed at an independent shop, UNLESS the manufacturer can demonstrate that the specific aftermarket part or independent service was the cause of the failure. The Act includes a tie-in sales prohibition: warranty coverage cannot be conditioned on using brand-name parts unless those parts are provided free of charge.\n\nIf my warranty claim is being denied or the warranty is being threatened over aftermarket parts or independent service, please provide in writing:\n- The specific provision of the warranty that supports the denial\n- Evidence that the aftermarket part or independent service caused the failure being claimed\n- Confirmation that you are aware of the Magnuson-Moss tie-in sales restrictions\n\nI am requesting a written explanation within 10 business days. If the issue is not resolved, I will file complaints with the Federal Trade Commission, the [state] attorney general, and the manufacturer's consumer affairs office.`;
      break;
    case "recall_or_tsb":
      subject = "Recall / Technical Service Bulletin Coverage Inquiry";
      body = `Regarding ${vehicle}: ${parsed.issue_detail}\n\nUnder 49 USC § 30120(g)(1), NHTSA-administered safety recalls are repaired free of charge by an authorized dealer for vehicles within 15 calendar years of their original sale date (5 years for tires). Current ownership does not affect eligibility — only the vehicle's age from first sale. Manufacturer Technical Service Bulletins (TSBs) are advisory and not legally required to be performed free, but are sometimes covered as goodwill, customer-satisfaction programs, or under extended warranty.\n\nPlease confirm:\n- Whether the work being performed corresponds to any open NHTSA recall for this VIN — and if so, why it was not handled at the dealer at no cost (assuming the vehicle is within 15 years of original sale)\n- Whether the work corresponds to any manufacturer TSB or extended warranty / customer satisfaction program for this model/year\n- If this is recall or covered TSB work, a corrected invoice removing the customer charge\n\nI can verify the recall status via nhtsa.gov/recalls. If this work corresponds to an open recall and the vehicle is within the 15-year window, I am requesting it be redirected to the dealer at no cost or refunded if already paid.`;
      break;
    case "shop_supplies_fee":
      subject = "Shop Supplies Fee — Itemization Request";
      body = `Regarding the invoice for ${vehicle}: ${parsed.issue_detail}\n\nA "shop supplies" or "miscellaneous" fee was charged on the invoice. Many states require this charge be itemized rather than a flat percentage padding, and customers have the right to know what specific supplies are being billed.\n\nPlease provide:\n- An itemized list of the supplies covered by this charge (rags, fluids, fasteners, etc.)\n- Whether this is a flat fee or a percentage of labor — and the exact percentage if applicable\n- Whether the shop's posted price disclosures (which most states require) include this charge\n\nIf the fee is a non-itemized percentage padding without specific supplies attributable, I am asking it be removed from the invoice.`;
      break;
    case "general":
    default:
      subject = `Auto Repair Concern — ${vehicle}`;
      body = `Regarding the repair of ${vehicle}:\n\n${parsed.issue_detail}\n\nPlease respond within 5 business days with a written explanation and any corrections to the invoice. If we cannot resolve this directly, I may file a complaint with my state's consumer protection division and/or the Better Business Bureau.`;
      break;
  }

  const letter = `${date}\n\nTo: ${shop}\nFrom: ${customer}\nRe: ${subject}\nVehicle: ${vehicle}\n\n${body}\n\nThank you for your prompt attention.\n\n${customer}`;

  return {
    success: true,
    issue_type: parsed.issue_type,
    subject,
    letter,
    delivery_method: "Send via email AND certified mail (return receipt requested) so you have a paper trail. If the shop has not refunded or credited charges within 10 business days, escalate to your state's consumer protection division.",
    legal_disclaimer: "This is a template for informational purposes. Auto repair consumer protections vary significantly by state. For complex disputes (especially involving safety, warranty denial, or substantial dollar amounts), consult a local consumer attorney or your state's attorney general consumer protection division.",
  };
}
