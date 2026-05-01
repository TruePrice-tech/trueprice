import { z } from "zod";

export const negotiationScriptSchema = {
  name: "negotiation_script",
  description:
    "Generate a phone or in-person negotiation script for an auto repair conversation. Tailored to common scenarios: leveraging a second-opinion quote, negotiating after the diagnostic, requesting independent shop alternative to dealer-only quote, asking for OEM part coverage, and disputing inflated labor hours. Includes opening, asks, common pushbacks, closing.",
  inputSchema: {
    type: "object",
    properties: {
      scenario: {
        type: "string",
        enum: [
          "second_opinion_leverage",
          "labor_hours_pushback",
          "independent_vs_dealer",
          "diagnostic_credit_request",
          "warranty_extension",
        ],
      },
      shop_name: { type: "string" },
      quote_amount: { type: "number" },
      competing_quote_amount: { type: "number" },
      target_price: { type: "number" },
    },
    required: ["scenario"],
  },
};

const args = z.object({
  scenario: z.enum([
    "second_opinion_leverage",
    "labor_hours_pushback",
    "independent_vs_dealer",
    "diagnostic_credit_request",
    "warranty_extension",
  ]),
  shop_name: z.string().optional(),
  quote_amount: z.number().optional(),
  competing_quote_amount: z.number().optional(),
  target_price: z.number().optional(),
});

export async function runNegotiationScript(rawArgs: unknown) {
  const parsed = args.parse(rawArgs);
  const shop = parsed.shop_name || "[Shop]";
  const amount = parsed.quote_amount ? `$${parsed.quote_amount.toLocaleString()}` : "[your quoted amount]";
  const competing = parsed.competing_quote_amount ? `$${parsed.competing_quote_amount.toLocaleString()}` : "[competing amount]";
  const target = parsed.target_price ? `$${parsed.target_price.toLocaleString()}` : "[target amount]";

  let opening = "";
  let asks: string[] = [];
  let pushbacks: Array<{ pushback: string; response: string }> = [];
  let closing = "";

  switch (parsed.scenario) {
    case "second_opinion_leverage":
      opening = `Hi ${shop}, this is [your name]. I have your quote at ${amount} for [vehicle]. I got a second opinion at ${competing} for what looks like the same scope. I'd rather have you do the work — can we talk through the gap?`;
      asks = [
        `"Can you walk me through what's in your quote that the cheaper bid might be cutting?"`,
        `"What's the most you can come down — to ${target}, or somewhere between yours and theirs?"`,
        `"If you can't drop the price, can you add value: longer parts/labor warranty, OEM upgrade, free follow-up inspection?"`,
      ];
      pushbacks = [
        { pushback: "Their price is too low — they're cutting corners.", response: "Possible. Can you send me your itemized scope so I can compare it line by line to theirs? If they're skipping things, that becomes obvious." },
        { pushback: "Our hourly rate is higher because we're more experienced.", response: "I respect that — but I need to either match the competing price or see specific labor hours / parts type / warranty differences that justify the gap. Help me understand." },
      ];
      closing = `"Get back to me by [date] with what you can do. Otherwise I'll go with the other shop."`;
      break;
    case "labor_hours_pushback":
      opening = `Hi ${shop}, I want to talk through the labor hours on the quote. Some of the line items look high vs flat-rate book time.`;
      asks = [
        `"What flat-rate guide are you using — Mitchell, AllData, or OEM published?"`,
        `"Can you list the book time per repair vs the labor hours you're charging?"`,
        `"For any line that exceeds book time, can you document the reason (rust, broken bolts, model-specific complexity)?"`,
      ];
      pushbacks = [
        { pushback: "We don't do book time, we charge actual time.", response: "I understand. But you must have an estimate against book time. Can you share what you used to set the quote? If actual goes over, I want photo documentation of why." },
        { pushback: "Every job is different.", response: "Sure — but the variance should be explainable. I'm not asking you to discount, I'm asking you to itemize. If the hours are justified, I'll pay them." },
      ];
      closing = `"Send me a revised quote with book time + any documented overages, and I can move ahead."`;
      break;
    case "independent_vs_dealer":
      opening = `Hi ${shop}, I have a dealer quote at ${amount} for [vehicle]. I'm calling around to independent shops. Can you give me your price for the same scope?`;
      asks = [
        `"What's your rate per hour vs the dealer's, and your book time for this repair?"`,
        `"Will you use OEM parts, or is your standard aftermarket? And what's the parts warranty either way?"`,
        `"Will any of this work void my factory warranty? I know the Magnuson-Moss Warranty Act protects independent service, but I want to confirm you've handled this make/model before."`,
        `"What's your labor warranty on the work?"`,
      ];
      pushbacks = [
        { pushback: "Dealer-required for this work.", response: "What part specifically requires the dealer? Most repairs can be done by an independent under Magnuson-Moss. If this is a recall or active warranty work, that goes to the dealer free anyway." },
      ];
      closing = `"Email me the written quote and I'll compare. Thanks."`;
      break;
    case "diagnostic_credit_request":
      opening = `Hi ${shop}, I authorized the work on [vehicle] but the invoice doesn't credit the diagnostic fee I paid up front. I'd like to discuss applying that.`;
      asks = [
        `"Is your shop's policy to credit diagnostic fees toward authorized repairs? If so, why wasn't it applied here?"`,
        `"Can you adjust the invoice to reflect the diagnostic credit?"`,
      ];
      pushbacks = [
        { pushback: "Diagnostic is separate from repair.", response: "Many shops credit it toward authorized work. Can you show me your posted policy or written disclosure on this? Most states require posted price disclosures." },
      ];
      closing = `"Send me a corrected invoice or your written policy on diagnostic fees."`;
      break;
    case "warranty_extension":
      opening = `Hi ${shop}, the quote at ${amount} works for me but the labor warranty is short. Can we extend it as part of the deal?`;
      asks = [
        `"Can you extend the labor warranty to 12 months / 12,000 miles minimum?"`,
        `"What does an extended labor warranty cost separately?"`,
        `"Is the parts warranty manufacturer's coverage, and is registration required?"`,
      ];
      pushbacks = [
        { pushback: "Our standard is 90 days.", response: "I understand standard. Most independent shops offer at least 12 months / 12,000 miles, and many chains (NAPA AutoCare, AAA Approved Auto Repair shops) go 24 months / 24,000 miles. Can you match the 12/12 minimum? If not, what's the upcharge?" },
      ];
      closing = `"Document the extension in writing and we'll move ahead."`;
      break;
  }

  return {
    success: true,
    scenario: parsed.scenario,
    opening,
    asks,
    common_pushbacks: pushbacks,
    closing,
    general_tips: [
      "Get every concession in writing before authorizing the work",
      "If shop won't itemize parts/labor/hours, get a different shop",
      "For major repairs, always get 2-3 quotes — variance is often 30-50%",
      "Magnuson-Moss Warranty Act protects your right to use independent shops without voiding the factory warranty (unless the specific repair caused the failure)",
      "Check NHTSA recalls before paying for any safety-related repair (nhtsa.gov/recalls)",
      "Take notes during phone calls: name of person, date/time, what was agreed",
    ],
  };
}
