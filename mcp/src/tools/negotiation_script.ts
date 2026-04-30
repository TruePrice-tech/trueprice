import { z } from "zod";

export const negotiationScriptToolName = "negotiation_script";

export const negotiationScriptToolDefinition = {
  name: negotiationScriptToolName,
  description:
    "Generate a phone negotiation script for the patient to call the billing department. " +
    "Includes opening framing, specific asks (cash discount, charity care, payment plan), " +
    "responses to common pushback, and follow-up steps. Tailored to the bill amount, ability " +
    "to pay, and facility type.",
  inputSchema: {
    type: "object" as const,
    properties: {
      bill_amount: {
        type: "number",
        description: "Total amount the patient owes",
      },
      ability_to_pay: {
        type: "string",
        enum: ["cannot_pay", "partial_payment", "full_payment_for_discount"],
        description: "Patient's financial position going into the call",
      },
      hardship_situation: {
        type: "string",
        description: "Brief description of any financial hardship to mention (optional)",
      },
      facility_type: {
        type: "string",
        description:
          "Hospital, physician office, etc. (affects what programs may be available)",
      },
      provider_name: {
        type: "string",
        description: "Name of the billing provider/facility (optional)",
      },
    },
    required: ["bill_amount", "ability_to_pay"],
  },
};

const inputSchema = z.object({
  bill_amount: z.number(),
  ability_to_pay: z.enum(["cannot_pay", "partial_payment", "full_payment_for_discount"]),
  hardship_situation: z.string().optional(),
  facility_type: z.string().optional(),
  provider_name: z.string().optional(),
});

interface ScriptScenario {
  opening: string;
  asks: Array<{ ask: string; rationale: string; expected_response: string }>;
  pushback_responses: Array<{ pushback: string; response: string }>;
  closing: string;
  documents_to_request: string[];
}

function buildCannotPayScript(amount: number, hardship?: string, facility?: string): ScriptScenario {
  const isHospital = (facility || "").toLowerCase().includes("hospital");
  const hardshipText = hardship ? ` My situation: ${hardship}.` : "";

  return {
    opening:
      `Hi, my name is [Your Name]. I'm calling about account [Account Number]. I received a bill for $${amount.toLocaleString()} ` +
      `that I'm not able to pay in full.${hardshipText} I'd like to discuss what options are available, including financial assistance ` +
      `or charity care programs.`,
    asks: [
      {
        ask:
          isHospital
            ? "Can you send me your Financial Assistance Policy and the application form? I'd like to apply for charity care."
            : "Do you offer any financial assistance, hardship discount, or charity care programs? If yes, please send me the application.",
        rationale:
          isHospital
            ? "Nonprofit hospitals are required by IRS Section 501(r) to have a written Financial Assistance Policy and to publicize it."
            : "Many providers have hardship programs that aren't widely advertised.",
        expected_response:
          isHospital
            ? "Most nonprofit hospitals will send the form. If they refuse, that itself is a violation of 501(r)."
            : "Smaller offices may not have a formal program but often offer discretionary discounts.",
      },
      {
        ask:
          "While I apply for assistance, can you place this account on hold so it doesn't go to collections?",
        rationale:
          "Once an account is in collections, your leverage drops and your credit score takes a hit.",
        expected_response:
          "Most billing departments will pause collections during an active financial assistance application.",
      },
      {
        ask:
          "If I don't qualify for full charity care, what's the maximum hardship discount you can offer based on my income?",
        rationale:
          "Many hospitals offer sliding-scale discounts (50-100% off) based on income relative to federal poverty level.",
        expected_response:
          "Get this in writing. Ask for the specific income thresholds and discount percentages.",
      },
      {
        ask:
          "Can you also tell me the cash/self-pay discount rate? Sometimes this is significantly less than the billed amount.",
        rationale:
          "Cash discounts are often 30-60% off the billed rate. This is separate from charity care.",
        expected_response: "Some providers will offer this even alongside other discounts.",
      },
    ],
    pushback_responses: [
      {
        pushback: "We don't offer financial assistance / We don't have a charity care program.",
        response:
          isHospital
            ? "Under IRS Section 501(r), nonprofit hospitals are required to have a Financial Assistance Policy. Could you connect me to your patient financial services manager? I'd also like the policy in writing."
            : "I understand. Could I speak with a billing supervisor about a hardship discount or extended payment plan?",
      },
      {
        pushback: "You need to pay something today.",
        response:
          "I want to resolve this, but I cannot pay in full today. Can we set up a payment plan AFTER I've completed the financial assistance application? I don't want to make a payment that locks me out of charity care eligibility.",
      },
      {
        pushback: "We can offer a 10% discount if you pay in full today.",
        response:
          "I appreciate that, but I cannot pay $" + (amount * 0.9).toLocaleString() + " either. Let's start with the financial assistance application before discussing any payment.",
      },
      {
        pushback: "If you don't pay, this will go to collections.",
        response:
          "I understand. I'm requesting that the account be placed on hold while I complete the financial assistance application. If I don't qualify, we can discuss other options. Can you note this on the account?",
      },
    ],
    closing:
      "Thank you. To confirm, you're sending me the Financial Assistance Policy and application form, and the account is on hold while I complete it. " +
      "Can you give me your name and a reference number for this call? I'll send the application within 30 days.",
    documents_to_request: [
      "Financial Assistance Policy (FAP) and application form",
      "Itemized bill with CPT/HCPCS codes for every line item",
      "Insurance Explanation of Benefits (EOB) for this service",
      "Copy of any consent forms you signed at registration",
    ],
  };
}

function buildPartialPaymentScript(amount: number, hardship?: string): ScriptScenario {
  const targetDiscount = 0.5;
  const targetAmount = Math.round(amount * (1 - targetDiscount));
  const hardshipText = hardship ? ` Some context on my situation: ${hardship}.` : "";

  return {
    opening:
      `Hi, my name is [Your Name]. I'm calling about account [Account Number] for $${amount.toLocaleString()}. ` +
      `I'd like to settle this account but I'm not able to pay the full amount.${hardshipText} I'd like to discuss a discounted ` +
      `cash settlement.`,
    asks: [
      {
        ask:
          `I can pay $${targetAmount.toLocaleString()} today as a one-time settlement to close this account. Would you accept that?`,
        rationale:
          `Open with 50% off the billed amount. Hospitals often accept 40-70% off for immediate cash settlement, especially before collections.`,
        expected_response:
          "First offer is rarely accepted. They'll typically counter. Stay calm and willing to negotiate up.",
      },
      {
        ask:
          "If you can't go that low, what's the lowest amount you can accept for full settlement, and what payment options do I have?",
        rationale:
          "Once they have your number, they'll counter. Get their floor.",
        expected_response:
          "They may counter at 25-40% off. Aim to meet in the middle.",
      },
      {
        ask:
          "If we agree on a settlement amount, can you send me written confirmation BEFORE I make the payment? I need it in writing that this amount fully resolves the account and the rest is forgiven.",
        rationale:
          "Critical: never pay until you have written confirmation. Otherwise the 'forgiven' amount can be re-billed or sold to collections.",
        expected_response:
          "Most billing departments will email or mail this confirmation within 1-2 business days.",
      },
    ],
    pushback_responses: [
      {
        pushback: "We can only offer a 10% discount.",
        response:
          "I understand 10% is your standard offer. Given my financial situation, I really need to settle for closer to 50% off. Can you escalate this to a supervisor or your patient financial services manager?",
      },
      {
        pushback: "You'll need to pay the full amount.",
        response:
          `I understand the full amount is owed, but I'm not in a position to pay $${amount.toLocaleString()}. ` +
          "If we can't agree on a discount, I'll need to apply for financial assistance, which may take 60-90 days. " +
          "It's better for both of us to settle this today at a discounted amount.",
      },
      {
        pushback: "We don't negotiate bills.",
        response:
          "I understand. Can you put me through to your patient financial services manager or billing supervisor? I'd like to discuss a hardship settlement.",
      },
    ],
    closing:
      `Great. So we've agreed on $[settlement amount] for full settlement of this account. You'll send written confirmation to my email at ` +
      `[your email] within [X] business days. Once I receive that confirmation, I'll process payment. Can I get your name and a reference number?`,
    documents_to_request: [
      "Written settlement agreement specifying the amount and that it fully resolves the account",
      "Itemized bill",
      "Insurance EOB if applicable",
    ],
  };
}

function buildFullPaymentDiscountScript(amount: number): ScriptScenario {
  const discountAsk = Math.round(amount * 0.7);
  return {
    opening:
      `Hi, my name is [Your Name]. I'm calling about account [Account Number] for $${amount.toLocaleString()}. ` +
      `I'm prepared to pay the bill in full today, but I'd like to ask about a prompt-pay or self-pay discount in exchange for immediate full payment.`,
    asks: [
      {
        ask:
          "What's your standard prompt-pay or cash discount for paying in full today?",
        rationale:
          "Many providers offer 10-30% off for immediate payment. They lose money to collections agencies and slow-pay accounts, so they often discount for fast payment.",
        expected_response:
          "Standard prompt-pay discount is typically 10-20%. Some providers go up to 30%.",
      },
      {
        ask:
          `I'd like to pay $${discountAsk.toLocaleString()} (a 30% discount) in full today to close this account. Would you accept that?`,
        rationale:
          "Open higher than their typical offer. Some will accept; others will counter at 20%.",
        expected_response:
          "Likely a counter-offer at 15-25% off if you're at a hospital, less at a physician office.",
      },
      {
        ask:
          "Can you also apply this as a self-pay rate? Self-pay rates are sometimes 30-50% lower than the billed insurance rate even before any discount.",
        rationale:
          "If you're paying without going through insurance, the 'cash price' may be much lower than the billed amount.",
        expected_response:
          "Worth asking. Some providers have separate cash-price schedules.",
      },
      {
        ask:
          "Whatever we agree on, please email me written confirmation BEFORE I make the payment. I want it in writing that this resolves the account in full.",
        rationale:
          "Always get the discount in writing before paying.",
        expected_response: "Routine request; most billing departments will accommodate.",
      },
    ],
    pushback_responses: [
      {
        pushback: "We don't offer prompt-pay discounts.",
        response:
          "I understand that's not standard. Given that I'm prepared to pay in full today and avoid all the collections work, can you check with a supervisor whether any discount is available?",
      },
      {
        pushback: "Our standard discount is 10%.",
        response:
          "I appreciate that. Can you check whether 20% is possible for immediate full payment? I'd like to settle this today.",
      },
    ],
    closing:
      `Excellent. So we've agreed on $[final amount]. You'll email me written confirmation within [X] business days. ` +
      `Once I receive it, I'll process payment immediately. Could I have your name and a reference number for this call?`,
    documents_to_request: [
      "Written confirmation of the discounted amount and that it fully resolves the account",
      "Receipt after payment",
    ],
  };
}

export async function runNegotiationScript(rawInput: unknown) {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: `Invalid input: ${parsed.error.message}`,
    };
  }

  let scenario: ScriptScenario;
  switch (parsed.data.ability_to_pay) {
    case "cannot_pay":
      scenario = buildCannotPayScript(
        parsed.data.bill_amount,
        parsed.data.hardship_situation,
        parsed.data.facility_type
      );
      break;
    case "partial_payment":
      scenario = buildPartialPaymentScript(
        parsed.data.bill_amount,
        parsed.data.hardship_situation
      );
      break;
    case "full_payment_for_discount":
      scenario = buildFullPaymentDiscountScript(parsed.data.bill_amount);
      break;
  }

  return {
    success: true,
    scenario: parsed.data.ability_to_pay,
    ...scenario,
    general_tips: [
      "Take notes during the call: name of person, date/time, what was agreed",
      "Ask for everything in writing before paying anything",
      "If you reach voicemail, call back and ask for a billing supervisor or patient financial services",
      "Be polite but firm. The person on the phone usually has more discretion than they initially admit",
      "If you're getting nowhere, ask to escalate to the patient financial services manager",
    ],
  };
}
