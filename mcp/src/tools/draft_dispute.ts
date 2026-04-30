import { z } from "zod";

export const draftDisputeToolName = "draft_dispute";

export const draftDisputeToolDefinition = {
  name: draftDisputeToolName,
  description:
    "Draft a dispute letter for a medical bill error. Generates formal language with relevant " +
    "statute citations (No Surprises Act, ACA preventive care, NCCI bundling rules) for the patient " +
    "to send to the billing department or insurance company. Returns letter text, recipient guidance, " +
    "and follow-up steps.",
  inputSchema: {
    type: "object" as const,
    properties: {
      error_type: {
        type: "string",
        enum: [
          "unbundling",
          "balance_billing",
          "upcoding",
          "duplicate_charge",
          "no_surprises_act",
          "facility_fee",
          "out_of_network",
          "preventive_care_violation",
          "general",
        ],
        description: "Type of billing error being disputed",
      },
      bill_summary: {
        type: "string",
        description:
          "Brief summary of the bill (provider, service date, total amount, what's disputed)",
      },
      patient_name: { type: "string", description: "Patient's full name" },
      account_number: {
        type: "string",
        description: "Account or invoice number on the bill",
      },
      service_date: {
        type: "string",
        description: "Date of service (YYYY-MM-DD or readable format)",
      },
      specific_charges: {
        type: "string",
        description: "Specific charges, CPT codes, or amounts being disputed",
      },
      provider_name: {
        type: "string",
        description: "Name of the provider, hospital, or facility",
      },
    },
    required: ["error_type", "bill_summary"],
  },
};

const draftDisputeInputSchema = z.object({
  error_type: z.enum([
    "unbundling",
    "balance_billing",
    "upcoding",
    "duplicate_charge",
    "no_surprises_act",
    "facility_fee",
    "out_of_network",
    "preventive_care_violation",
    "general",
  ]),
  bill_summary: z.string(),
  patient_name: z.string().optional(),
  account_number: z.string().optional(),
  service_date: z.string().optional(),
  specific_charges: z.string().optional(),
  provider_name: z.string().optional(),
});

interface Template {
  body: (ctx: TemplateContext) => string;
  send_to: string;
  follow_up_steps: string[];
}

interface TemplateContext {
  patient_name: string;
  account_number: string;
  service_date: string;
  specific_charges: string;
  provider_name: string;
  bill_summary: string;
}

const templates: Record<string, Template> = {
  unbundling: {
    body: (ctx) =>
      `I am writing to formally dispute charges on the bill referenced above for date of service ${ctx.service_date}.

Upon review, I have identified what appears to be an unbundling violation under the National Correct Coding Initiative (NCCI) edits maintained by the Centers for Medicare & Medicaid Services. The following charges should not have been billed separately:

${ctx.specific_charges}

NCCI Procedure-to-Procedure (PTP) edits prohibit billing these codes together when they are part of a single service. CMS publishes these edits at https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits.

Please review and rebill in accordance with NCCI bundling rules, or provide written justification (modifier code 59 or other valid override) for billing these codes separately.

I request a corrected bill within 30 days of receipt of this letter.`,
    send_to: "Billing Department of the provider AND a copy to your insurance company",
    follow_up_steps: [
      "Send via certified mail with return receipt to create a paper trail",
      "Keep a copy for your records",
      "If no response in 30 days, escalate to state insurance commissioner or CMS",
      "If insurance already paid, you may be entitled to a refund of any amount you paid out of pocket",
    ],
  },
  balance_billing: {
    body: (ctx) =>
      `I am writing to formally dispute charges on the bill referenced above for date of service ${ctx.service_date}.

The bill includes balance billing in violation of the federal No Surprises Act (Public Law 116-260, 42 USC 300gg-111). Specifically:

${ctx.specific_charges}

Under the No Surprises Act, patients receiving emergency services or services from out-of-network providers at in-network facilities are protected from balance billing. The patient's cost-sharing is limited to what would apply for in-network care.

I request that:
1. The balance billing portion be removed from my account
2. My cost-sharing be recalculated based on in-network rates
3. Any amounts I have already paid above the in-network responsibility be refunded

If I do not receive a corrected bill within 30 days, I will file a complaint with the federal No Surprises Help Desk (1-800-985-3059) and my state insurance commissioner.`,
    send_to: "Billing Department AND a copy to your insurance company",
    follow_up_steps: [
      "Send via certified mail with return receipt",
      "File a federal complaint at cms.gov/nosurprises if no response in 30 days",
      "Contact your state insurance commissioner for state-level enforcement",
      "Do not pay the disputed amount while dispute is in progress",
    ],
  },
  upcoding: {
    body: (ctx) =>
      `I am writing to dispute charges on the bill referenced above for date of service ${ctx.service_date}.

The following charges appear to reflect upcoding, where a higher-level service was billed than was actually rendered:

${ctx.specific_charges}

I request:
1. The provider's documentation supporting the level of service billed
2. Review by your coding/compliance team to confirm the correct CPT/HCPCS code
3. A corrected bill if the level of service is downcoded

Upcoding is prohibited under the False Claims Act when billed to federal payers (Medicare/Medicaid) and is a violation of payer contracts for commercial insurance.

Please respond within 30 days with the supporting documentation or a corrected bill.`,
    send_to: "Billing Department of the provider, with copy to your insurance company",
    follow_up_steps: [
      "Request your medical records for the date of service to compare against the billed level",
      "If insurance is involved, ask them to audit the documentation",
      "Report suspected fraud to OIG hotline (Medicare/Medicaid) or your state attorney general",
    ],
  },
  duplicate_charge: {
    body: (ctx) =>
      `I am disputing duplicate charges on the bill referenced above for date of service ${ctx.service_date}.

I have identified the following charges that appear to be billed more than once for the same service:

${ctx.specific_charges}

Please review the line items, remove the duplicate charges, and issue a corrected bill within 30 days. If you believe the charges are not duplicates, please provide documentation explaining the distinct services rendered.`,
    send_to: "Billing Department of the provider",
    follow_up_steps: [
      "Compare your itemized bill line by line against your medical records",
      "If insurance already paid for both, request that they reprocess",
      "Keep all correspondence for your records",
    ],
  },
  no_surprises_act: {
    body: (ctx) =>
      `I am formally disputing charges on the bill referenced above for date of service ${ctx.service_date} under the federal No Surprises Act (42 USC 300gg-111 et seq.).

The bill includes the following charges that violate No Surprises Act protections:

${ctx.specific_charges}

The No Surprises Act protects patients from surprise medical bills in three primary scenarios: (1) emergency services from out-of-network providers, (2) non-emergency services from out-of-network providers at in-network facilities, and (3) air ambulance services from out-of-network providers.

I request:
1. Removal of any balance billing in excess of in-network cost-sharing
2. Recalculation of my responsibility using my in-network deductible/copay/coinsurance
3. Refund of any amounts paid above the correct in-network amount

The federal complaint process is available at https://www.cms.gov/nosurprises and via the No Surprises Help Desk at 1-800-985-3059. I will pursue this complaint if I do not receive a corrected bill within 30 days.`,
    send_to: "Billing Department, your insurance company, AND CMS No Surprises Help Desk",
    follow_up_steps: [
      "File a federal complaint at cms.gov/nosurprises",
      "Contact your state insurance commissioner",
      "Do not pay the disputed amount while dispute is open",
      "If your state has additional balance-billing protections, cite those as well",
    ],
  },
  facility_fee: {
    body: (ctx) =>
      `I am writing to dispute or request review of facility fees on the bill referenced above for date of service ${ctx.service_date}.

Facility fee charged: ${ctx.specific_charges}

I request:
1. A clear explanation of what the facility fee represents and why it was charged in addition to professional fees
2. Disclosure of whether this facility fee was disclosed to me prior to the service (as required in some states)
3. Information on whether the same service could have been provided at a lower-cost setting (ambulatory surgery center, freestanding imaging center, physician office)

Facility fees at hospital outpatient departments are typically 2-3x higher than ambulatory surgery centers for the same procedure. If this service could have been performed at a lower-cost setting and was not disclosed, I request a reduction.`,
    send_to: "Billing Department of the provider, with copy to your insurance company",
    follow_up_steps: [
      "Check your state's hospital price transparency rules",
      "Request a self-pay or cash discount if you have not yet paid",
      "For future care, ask your provider in advance whether services can be rendered at a lower-cost facility",
    ],
  },
  out_of_network: {
    body: (ctx) =>
      `I am disputing out-of-network charges on the bill referenced above for date of service ${ctx.service_date}.

${ctx.specific_charges}

If this care was provided at an in-network facility by an out-of-network provider, the No Surprises Act limits my cost-sharing to in-network rates. If this care was emergency or scheduled non-emergency at an in-network facility without my prior consent to receive out-of-network services, I am protected.

I request:
1. Confirmation of the in-network/out-of-network status of the facility AND the provider
2. If the provider was out-of-network at an in-network facility, recalculation per No Surprises Act
3. Itemized record of any consent forms I signed acknowledging out-of-network care

Please respond within 30 days.`,
    send_to: "Billing Department, with copy to your insurance company",
    follow_up_steps: [
      "Request the consent forms you signed at registration",
      "Review your insurance EOB for the in/out of network determination",
      "If denied, escalate via No Surprises Act complaint or state insurance commissioner",
    ],
  },
  preventive_care_violation: {
    body: (ctx) =>
      `I am disputing charges that appear to violate the Affordable Care Act preventive care provisions (42 USC 300gg-13).

${ctx.specific_charges}

Under the ACA, certain preventive services must be covered at 100% with no cost-sharing when provided by an in-network provider. This includes preventive screenings such as screening colonoscopies, mammograms, well-woman visits, and other services on the USPSTF A and B recommendation lists.

If a screening colonoscopy was billed as diagnostic because polyps were removed during the procedure, this is generally not allowable cost-sharing under HHS guidance for screening services that become diagnostic in the same encounter.

I request:
1. Reprocessing of these charges as preventive (no cost-sharing)
2. Refund of any amounts I have paid

Please respond within 30 days.`,
    send_to: "Insurance company primarily, with copy to billing provider",
    follow_up_steps: [
      "File appeal with insurance company citing ACA preventive care rules",
      "Reference HHS FAQs on screening colonoscopy and preventive care",
      "If denied, escalate to state insurance commissioner",
    ],
  },
  general: {
    body: (ctx) =>
      `I am writing to formally dispute charges on the bill referenced above for date of service ${ctx.service_date}.

${ctx.bill_summary}

Specific charges in dispute: ${ctx.specific_charges}

I request:
1. A fully itemized bill with CPT/HCPCS codes for every line item
2. Documentation supporting each charge
3. Review and correction of any errors
4. A corrected bill within 30 days

Please consider this a formal request for the audit and correction of any billing errors. I am prepared to escalate to my insurance company, state insurance commissioner, or appropriate federal agency if necessary.`,
    send_to: "Billing Department of the provider",
    follow_up_steps: [
      "Send via certified mail with return receipt",
      "Keep a copy and document all phone calls (date, time, who you spoke with)",
      "Review your insurance EOB to compare against the bill",
      "If unresolved in 30 days, escalate",
    ],
  },
};

export async function runDraftDispute(rawInput: unknown) {
  const parsed = draftDisputeInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: `Invalid input: ${parsed.error.message}`,
    };
  }

  const ctx: TemplateContext = {
    patient_name: parsed.data.patient_name || "[Your Name]",
    account_number: parsed.data.account_number || "[Account Number]",
    service_date: parsed.data.service_date || "[Date of Service]",
    specific_charges: parsed.data.specific_charges || "[Charges in dispute]",
    provider_name: parsed.data.provider_name || "[Provider Name]",
    bill_summary: parsed.data.bill_summary,
  };

  const template = templates[parsed.data.error_type] ?? templates.general;

  const today = new Date().toISOString().slice(0, 10);
  const header = [
    today,
    "",
    "Billing Department",
    ctx.provider_name,
    "[Provider Address]",
    "",
    `Re: Account ${ctx.account_number}, Patient: ${ctx.patient_name}, Service Date: ${ctx.service_date}`,
    "",
    "To Whom It May Concern,",
    "",
  ].join("\n");

  const closing = [
    "",
    "Please respond in writing to the address below.",
    "",
    "Sincerely,",
    "",
    ctx.patient_name,
    "[Your Address]",
    "[Your Phone Number]",
    "[Your Email]",
  ].join("\n");

  const letter = header + template.body(ctx) + closing;

  return {
    success: true,
    letter_text: letter,
    send_to: template.send_to,
    follow_up_steps: template.follow_up_steps,
    notes:
      "This is a template letter. Replace any [bracketed] placeholders with your information " +
      "before sending. Consider consulting a patient advocate or attorney for high-dollar disputes " +
      "or those involving potential fraud.",
  };
}
