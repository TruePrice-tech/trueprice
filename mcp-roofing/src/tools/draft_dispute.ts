import { z } from "zod";

export const draftDisputeSchema = {
  name: "draft_dispute",
  description:
    "Draft a written dispute or scope-clarification letter to a roofing contractor. Use this when the customer wants to formally request changes, demand missing scope items, dispute pricing, or push back on a specific issue identified by check_errors. The letter is firm but professional and references industry standards.",
  inputSchema: {
    type: "object",
    properties: {
      issue_type: {
        type: "string",
        enum: [
          "missing_scope_item",
          "price_disputed",
          "warranty_inadequate",
          "material_mismatch",
          "permit_responsibility",
          "decking_change_order",
          "lien_waiver_required",
          "general",
        ],
        description: "Type of issue being disputed",
      },
      contractor_name: { type: "string", description: "Name of the contractor or company" },
      customer_name: { type: "string", description: "Customer's full name" },
      project_address: { type: "string", description: "Address of the property" },
      quote_amount: { type: "number", description: "The quote amount in dollars" },
      issue_detail: { type: "string", description: "Brief description of the specific issue" },
    },
    required: ["issue_type", "issue_detail"],
  },
};

const draftArgs = z.object({
  issue_type: z.enum([
    "missing_scope_item",
    "price_disputed",
    "warranty_inadequate",
    "material_mismatch",
    "permit_responsibility",
    "decking_change_order",
    "lien_waiver_required",
    "general",
  ]),
  contractor_name: z.string().optional(),
  customer_name: z.string().optional(),
  project_address: z.string().optional(),
  quote_amount: z.number().optional(),
  issue_detail: z.string(),
});

export async function runDraftDispute(args: unknown) {
  const parsed = draftArgs.parse(args);
  const contractor = parsed.contractor_name || "[Contractor Name]";
  const customer = parsed.customer_name || "[Your Name]";
  const address = parsed.project_address || "[Property Address]";
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  let body = "";
  let subject = "";

  switch (parsed.issue_type) {
    case "missing_scope_item":
      subject = `Quote Clarification — Missing or Excluded Scope Items`;
      body = `I am writing regarding the roofing quote you provided for the property at ${address}.\n\nThe quote does not clearly include or explicitly excludes the following: ${parsed.issue_detail}\n\nFor a complete roof replacement, this is a standard scope item. Excluding it raises two concerns: (1) it can void the manufacturer warranty if not installed to spec, and (2) it creates change-order risk during the project.\n\nBefore I can sign this contract, I need one of the following in writing:\n- Confirmation that this item IS included in the quoted price, OR\n- An itemized line showing the additional cost so I can compare to other bids.\n\nPlease respond within 5 business days with a revised quote or written confirmation. I want to move forward but need transparency on the full scope first.`;
      break;
    case "price_disputed":
      subject = `Quote Pricing Concern — Request for Itemization`;
      body = `I appreciate the time you took to provide a quote for the roofing project at ${address}.\n\nThe quoted total of ${parsed.quote_amount ? "$" + parsed.quote_amount.toLocaleString() : "[amount]"} appears materially above benchmarks for comparable jobs in this region: ${parsed.issue_detail}\n\nI'm not asking for a discount sight-unseen — I'm asking for transparency. To move forward, I need an itemized breakdown that separates:\n1. Materials cost (with brand and product line specified)\n2. Labor cost\n3. Tear-off and disposal\n4. Decking replacement (if any) — per-sheet rate\n5. Permit and inspection fees\n6. Any premium charges (steep pitch, complex valleys, etc.)\n\nWith that breakdown I can fairly evaluate this quote against the 2-3 other bids I am collecting.`;
      break;
    case "warranty_inadequate":
      subject = `Warranty Terms — Request for Written Specification`;
      body = `Regarding the roofing project quote for ${address}: ${parsed.issue_detail}\n\nA reputable roof replacement should include two separate warranties:\n1. **Manufacturer warranty** on the materials — typically 25 to lifetime depending on shingle tier\n2. **Workmanship warranty** from the contractor — industry standard is 10 years for full replacement\n\nI need both warranty documents in writing before signing the contract. Specifically:\n- The manufacturer's product warranty registration paperwork\n- The contractor's workmanship warranty terms (length, what's covered, transferability if I sell the home)\n\nIf the workmanship warranty offered is shorter than 10 years, please indicate why, or extend it as a condition of the contract.`;
      break;
    case "material_mismatch":
      subject = `Material Specification Required`;
      body = `Regarding the quote for ${address}: ${parsed.issue_detail}\n\nThe quote does not specify the exact shingle brand, product line, and color. Without this, I cannot:\n- Verify the manufacturer warranty terms\n- Confirm the product tier matches the price (architectural vs. designer pricing)\n- Compare against competing quotes accurately\n\nPlease provide in writing:\n- Brand (e.g., GAF, Owens Corning, CertainTeed, Malarkey)\n- Product line (e.g., Timberline HDZ, Duration, Landmark)\n- Color\n- The manufacturer warranty length for that specific product\n\nOnce I have this I can evaluate the quote on equivalent terms with other bids.`;
      break;
    case "permit_responsibility":
      subject = `Permit Responsibility — Written Confirmation Required`;
      body = `Regarding the roofing project at ${address}: ${parsed.issue_detail}\n\nMost municipalities require a building permit for roof replacement. Permits are typically the contractor's responsibility because: (1) they're the licensed party signing the work, (2) they need to coordinate inspections, and (3) homeowner-pulled permits can void contractor warranties.\n\nPlease confirm in writing:\n- Who pulls the permit (contractor vs. homeowner)\n- The permit cost (whether included in quote or separate)\n- Whether municipal inspection is required, and who schedules it\n- What happens if a re-inspection is required at the contractor's fault\n\nI want this clear before signing.`;
      break;
    case "decking_change_order":
      subject = `Decking Repair — Per-Sheet Rate Required Before Signing`;
      body = `Regarding the roofing quote for ${address}: ${parsed.issue_detail}\n\nDecking (roof sheathing) replacement is the most common surprise change order in roofing. Once the old roof is off, the contractor may discover rotten or damaged plywood/OSB. This is reasonable — but the rate should be agreed BEFORE work starts, not negotiated under pressure mid-project.\n\nPlease provide in writing:\n- Per-sheet rate for replacement decking (industry typical: $80-$140 per 4'x8' sheet installed)\n- Whether you will photograph any damage and notify me before replacing\n- A cap or "not to exceed" amount on decking change orders without my written approval\n\nI'm happy to pay for genuinely needed repairs but won't sign without these terms.`;
      break;
    case "lien_waiver_required":
      subject = `Lien Waiver Required Prior to Final Payment`;
      body = `Regarding the project at ${address}: ${parsed.issue_detail}\n\nFor my protection as the homeowner, I require an unconditional lien waiver from the contractor (and any sub-contractors or material suppliers) before releasing final payment. Without this, suppliers or subs that you fail to pay could later place a mechanic's lien on my property even though I paid in full.\n\nPlease confirm:\n- You will provide an unconditional lien waiver upon final payment\n- You will obtain lien waivers from any sub-contractors and material suppliers used\n- These will be provided to me before I release the final check\n\nThis is standard practice and not negotiable. Please confirm in writing.`;
      break;
    case "general":
    default:
      subject = `Roofing Project Concern — ${address}`;
      body = `I am writing regarding the roofing project at ${address}.\n\n${parsed.issue_detail}\n\nPlease respond within 5 business days with a written explanation and any necessary corrections to the contract. I want to move forward with this project but need this resolved first.`;
      break;
  }

  const letter = `${date}\n\nTo: ${contractor}\nFrom: ${customer}\nRe: ${subject}\nProject Address: ${address}\n\n${body}\n\nThank you for your prompt attention.\n\n${customer}`;

  return {
    success: true,
    issue_type: parsed.issue_type,
    subject,
    letter,
    delivery_method: "Send via email AND certified mail (return receipt requested) so you have a paper trail. If the contractor doesn't respond within 5 business days, that response itself is information.",
    legal_disclaimer: "This is a template for informational purposes. For complex disputes (especially after work has begun, has been paid, or where damage has occurred), consult a local construction attorney.",
  };
}
