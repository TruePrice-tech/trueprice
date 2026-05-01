import { z } from "zod";

export const negotiationScriptSchema = {
  name: "negotiation_script",
  description:
    "Generate a phone or in-person negotiation script for an HVAC contractor conversation. Tailored to common HVAC scenarios: leveraging multiple quotes, negotiating tonnage downsize after Manual J, requesting equipment upgrade for the same price, extending labor warranty, and negotiating service-call/repair pricing. Includes opening framing, specific asks, common pushback responses, and closing.",
  inputSchema: {
    type: "object",
    properties: {
      scenario: {
        type: "string",
        enum: [
          "multi_quote_leverage",
          "downsize_after_load_calc",
          "efficiency_upgrade_same_price",
          "extended_labor_warranty",
          "service_call_negotiation",
        ],
      },
      contractor_name: { type: "string" },
      quote_amount: { type: "number" },
      competing_quote_amount: { type: "number" },
      target_price: { type: "number" },
    },
    required: ["scenario"],
  },
};

const args = z.object({
  scenario: z.enum([
    "multi_quote_leverage",
    "downsize_after_load_calc",
    "efficiency_upgrade_same_price",
    "extended_labor_warranty",
    "service_call_negotiation",
  ]),
  contractor_name: z.string().optional(),
  quote_amount: z.number().optional(),
  competing_quote_amount: z.number().optional(),
  target_price: z.number().optional(),
});

export async function runNegotiationScript(rawArgs: unknown) {
  const parsed = args.parse(rawArgs);
  const contractor = parsed.contractor_name || "[Contractor]";
  const amount = parsed.quote_amount ? `$${parsed.quote_amount.toLocaleString()}` : "[your quoted amount]";
  const competing = parsed.competing_quote_amount ? `$${parsed.competing_quote_amount.toLocaleString()}` : "[competing amount]";
  const target = parsed.target_price ? `$${parsed.target_price.toLocaleString()}` : "[target amount]";

  let opening = "";
  let asks: string[] = [];
  let pushbacks: Array<{ pushback: string; response: string }> = [];
  let closing = "";

  switch (parsed.scenario) {
    case "multi_quote_leverage":
      opening = `Hi ${contractor}, this is [your name] calling about the HVAC quote for [address]. I want to be upfront — I have three quotes in hand. Yours is at ${amount}. Before I decide I'd like to talk through value and see if there's room to work together.`;
      asks = [
        `"What's the latitude on this price? A competing bid is at ${competing} for similar scope and equipment."`,
        `"Can you walk me through what's included in your quote that the cheaper bid might be skipping?"`,
        `"If we can't match on price, can you add value — extended labor warranty, free maintenance for 2 years, or upgraded equipment for the same price?"`,
      ];
      pushbacks = [
        { pushback: "Our price reflects experience and proper installation.", response: "I appreciate that — and that's why I called you instead of just signing the cheapest. But I need to either match the competing price OR see specific scope/quality differences that justify the gap. Help me out." },
        { pushback: "I can't match that.", response: "What CAN you do? Even meeting halfway — and adding a 2-year labor warranty — would close the deal today." },
      ];
      closing = `"Get back to me by [date] with what you can do. Otherwise I'll sign with one of the others. I'd rather use you."`;
      break;
    case "downsize_after_load_calc":
      opening = `Hi ${contractor}, this is [your name]. I had a Manual J load calculation done on my home and the result shows my actual cooling load is closer to [X] tons rather than the [Y] tons in your quote. I want to talk through right-sizing the equipment.`;
      asks = [
        `"Can you re-quote with a smaller, properly-sized system based on Manual J?"`,
        `"What would that change the price by?"`,
        `"What is the equipment swap cost — different model number?"`,
      ];
      pushbacks = [
        { pushback: "We always size up a bit for safety.", response: "Industry guidelines (Manual J, ACCA) explicitly warn against oversizing. Short cycling and humidity issues are real consequences. I'd rather have a properly-sized system than a 'safety margin' that costs me efficiency for 15+ years." },
        { pushback: "Smaller system might struggle on extreme days.", response: "Manual J accounts for design-day extremes. If you have data showing my home's load is actually higher, I'd like to see it. Otherwise I'd like the quote re-done at the calculated load." },
      ];
      closing = `"Send me the revised quote and the calculations behind any size change."`;
      break;
    case "efficiency_upgrade_same_price":
      opening = `Hi ${contractor}, this is [your name] regarding the quote at ${amount}. The price is in line with the market for [SEER] SEER equipment. I'm wondering if you can upgrade me to a higher-efficiency unit at the same price as a closing incentive.`;
      asks = [
        `"Can you swap to a 18 SEER (or 20 SEER) unit at the same price as a way to win my business?"`,
        `"If not at the same price, what's the upgrade cost? I'd factor it against expected utility savings."`,
        `"Are there any IRA tax credits available for higher-efficiency units that would offset the upgrade cost?"`,
      ];
      pushbacks = [
        { pushback: "Higher SEER costs more.", response: "I know — I'm asking you to absorb part of the upgrade as a closing incentive. Mid-sized HVAC contractors do this routinely. What's the most you can do?" },
        { pushback: "We don't typically discount.", response: "I'm not asking for a discount on the original quote. I'm asking for a free upgrade as the closing nudge. If you can't do that, what value can you add?" },
      ];
      closing = `"Get back to me with what you can do — either the equipment upgrade, a free maintenance plan, or extended labor warranty."`;
      break;
    case "extended_labor_warranty":
      opening = `Hi ${contractor}, this is [your name] about the HVAC quote. The price is in the right range, but the labor warranty at [X] year(s) is shorter than what other bids are offering. Can we extend that?`;
      asks = [
        `"Can you extend labor warranty to 2 years (or 5 years if 2 is already standard)?"`,
        `"What does an extended labor warranty cost as an upcharge?"`,
        `"Is the labor warranty transferable if I sell the home in the next 5 years?"`,
      ];
      pushbacks = [
        { pushback: "Our standard is [X] year.", response: "I understand standard. I'm asking what extended option you offer. Reputable HVAC installs from major contractors include 2-year labor as standard. Can you match that?" },
      ];
      closing = `"Document the extension in writing and we can move forward."`;
      break;
    case "service_call_negotiation":
      opening = `Hi ${contractor}, this is [your name]. I have an HVAC repair quote at ${amount} and the price feels high for the scope. Want to talk through it.`;
      asks = [
        `"Can you itemize the parts cost separately from labor? I want to see what each portion is."`,
        `"What's your hourly labor rate, and how many hours is this repair estimated at?"`,
        `"If the diagnostic fee was already paid, is it being credited toward the repair?"`,
        `"For ${target} can we make this work? That's what I budgeted given comparable rates."`,
      ];
      pushbacks = [
        { pushback: "This is our standard rate.", response: "Standard for what? I'd like to compare to other contractors for the same repair scope. If you can't itemize labor and parts I'll get a second opinion." },
        { pushback: "There's a minimum service charge.", response: "I understand — but the work itself is straightforward. I want to confirm I'm not being charged a 'minimum' that's significantly higher than the actual time and parts." },
      ];
      closing = `"Email me an itemized invoice. If it lines up I'll authorize the work."`;
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
      "Get every concession in writing as a contract addendum",
      "Be willing to walk — the leverage is in the willingness",
      "Compare bids on equivalent scope, not just total dollars",
      "Manual J load calc is your friend — request it, use it",
      "For service/repair: always ask for itemized parts vs labor breakdown",
    ],
  };
}
