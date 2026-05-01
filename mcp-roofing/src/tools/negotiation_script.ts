import { z } from "zod";

export const negotiationScriptSchema = {
  name: "negotiation_script",
  description:
    "Generate a phone or in-person negotiation script for a roofing contractor conversation. Tailored to common scenarios: leveraging multiple quotes for a price match, negotiating after a higher quote came back lower elsewhere, asking for warranty extension, or negotiating decking change-order caps. Includes opening framing, specific asks, common pushback responses, and closing/follow-up steps.",
  inputSchema: {
    type: "object",
    properties: {
      scenario: {
        type: "string",
        enum: [
          "multi_quote_leverage",
          "price_match_request",
          "warranty_extension",
          "decking_cap_negotiation",
          "scope_addition_no_extra_charge",
        ],
        description: "Negotiation scenario type",
      },
      contractor_name: { type: "string", description: "Name of the contractor or company" },
      quote_amount: { type: "number", description: "The quote amount in dollars" },
      competing_quote_amount: { type: "number", description: "Lower competing quote amount in dollars (for price match scenarios)" },
      target_price: { type: "number", description: "Target price you want to negotiate down to" },
    },
    required: ["scenario"],
  },
};

const scriptArgs = z.object({
  scenario: z.enum([
    "multi_quote_leverage",
    "price_match_request",
    "warranty_extension",
    "decking_cap_negotiation",
    "scope_addition_no_extra_charge",
  ]),
  contractor_name: z.string().optional(),
  quote_amount: z.number().optional(),
  competing_quote_amount: z.number().optional(),
  target_price: z.number().optional(),
});

export async function runNegotiationScript(args: unknown) {
  const parsed = scriptArgs.parse(args);
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
      opening = `Hi ${contractor}, this is [your name] calling about the roofing quote you provided for [address]. I want to be upfront — I have three quotes in hand right now and yours is at ${amount}. Before I make a decision I'd like to understand a few things and see if there's room to work together.`;
      asks = [
        `"What's the latitude on this price? I'm comparing to a competing quote at ${competing} for the same scope and material."`,
        `"Can you walk me through what's included that the cheaper bid might be cutting corners on?"`,
        `"If we go with you, can you match the lower bid OR add value (longer workmanship warranty, better underlayment) to justify the gap?"`,
      ];
      pushbacks = [
        {
          pushback: "Our price reflects our quality / experience / insurance.",
          response: "I respect that, and that's exactly why I called you instead of just signing with the cheapest. I want to go with you. But I need to either match the competing bid OR see specific scope/warranty differences that justify the price gap. Can you give me one or the other?",
        },
        {
          pushback: "I can't match that price.",
          response: "Okay — what CAN you do? Even meeting them halfway, plus a warranty extension to 15 years, would make this work for me. Or alternative material substitution — what tier could I get at their price?",
        },
        {
          pushback: "Other guys are probably cutting corners on underlayment or flashing.",
          response: "That's a fair concern. I'm asking each of them to itemize. Can you send me your itemized scope so I can compare apples to apples? If the others ARE cutting corners, that becomes obvious in the comparison.",
        },
      ];
      closing = `"I'd really like to use you. I'll give you 48 hours to come back with either a price adjustment or a value-add. After that I'll need to sign with one of the others. Sound fair?"`;
      break;
    case "price_match_request":
      opening = `Hi ${contractor}, this is [your name] following up on the quote at ${amount} for [address]. I got another quote back at ${competing} for what appears to be the same scope. I'd rather work with you — can we talk about closing the gap?`;
      asks = [
        `"Can you match ${competing}? I'm ready to sign today if so."`,
        `"If you can't match, can you meet at ${target}? That would be the ceiling I can pay given the other bid."`,
        `"If price is firm, can you add a 15-year workmanship warranty (vs the standard 10) to justify the difference?"`,
      ];
      pushbacks = [
        {
          pushback: "I can't drop my price that much.",
          response: "What's the most you can come down? Even meeting halfway between your quote and theirs would let me sign with you today.",
        },
        {
          pushback: "If their price is that low, they're cutting corners.",
          response: "Possible. Can you send me your itemized scope so I can compare item-by-item? If you're including things they're not, that's a real argument.",
        },
      ];
      closing = `"Get back to me by [date] with what you can do. Otherwise I'll sign with the other bid. I'd much rather give you the work."`;
      break;
    case "warranty_extension":
      opening = `Hi ${contractor}, this is [your name] regarding the quote at ${amount}. The price is in the right range, but the workmanship warranty at [X] years is shorter than what I'm seeing on competing bids. Can we extend that?`;
      asks = [
        `"Can you extend the workmanship warranty to 10 years (or 15 if it's already 10)?"`,
        `"Is there a transferable workmanship warranty option if I sell the home in the next 5 years?"`,
        `"Can you also document the manufacturer warranty registration in writing as part of the contract?"`,
      ];
      pushbacks = [
        {
          pushback: "Our standard warranty is [X] years.",
          response: "I understand standard. I'm asking what extended option you offer. Most reputable roofers can extend to 10 years if asked. If not, can you tell me why?",
        },
        {
          pushback: "Longer warranty costs more.",
          response: "What's the upcharge? If it's reasonable, I'll factor it in. If it's substantial, I'll ask the other bidders the same question and choose based on total cost-of-ownership.",
        },
      ];
      closing = `"Get me the warranty extension cost (or confirmation of extension) in writing and we can move ahead."`;
      break;
    case "decking_cap_negotiation":
      opening = `Hi ${contractor}, this is [your name] about the quote for [address]. Before I sign I want to lock down the decking change-order terms. Decking surprises are the #1 complaint I hear from neighbors who've done roofs.`;
      asks = [
        `"What's your per-sheet rate for replacement decking? Industry typical I've seen is $80-$140 per sheet installed."`,
        `"Can we add a 'not to exceed' amount of $1,500 (or 5% of total) on decking change orders without my written approval?"`,
        `"Will you photograph any damaged decking and text/email me before replacement so I can verify?"`,
      ];
      pushbacks = [
        {
          pushback: "We can't promise photos for every sheet.",
          response: "I'm not asking for every sheet — I'm asking for verification before exceeding the cap. If decking turns out fine, no photos needed. If you find rot, I want to see it before approving the change order.",
        },
        {
          pushback: "Per-sheet rates depend on what we encounter.",
          response: "Give me a worst-case rate I can plan for. If actual conditions are better, great. But I need a number in writing — I'm not signing an open-ended change order clause.",
        },
      ];
      closing = `"Send me the contract addendum with the per-sheet rate and the cap, and I'll sign."`;
      break;
    case "scope_addition_no_extra_charge":
      opening = `Hi ${contractor}, this is [your name] regarding the quote. The scope looks mostly complete but [missing item] is unclear or excluded. I'd like to add it without changing the price.`;
      asks = [
        `"Can you include [missing item] as part of the existing quote? It's a standard scope item for a complete replacement."`,
        `"If not, what's the line-item cost? I want it itemized rather than absorbed into the total."`,
        `"Can you document this in a contract addendum so there's no ambiguity day-of?"`,
      ];
      pushbacks = [
        {
          pushback: "That's a separate scope item.",
          response: "It's standard scope for a complete roof replacement. Industry guidelines say [item] is part of any reputable installation. Can you include it for a same-day signing?",
        },
        {
          pushback: "I'd have to charge extra for that.",
          response: "How much? If it's reasonable I'll add it. If it's high I'll get other quotes that include it standard.",
        },
      ];
      closing = `"Email me the revised contract or the addendum within 48 hours and I'll sign."`;
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
      "Negotiate BEFORE signing — once you sign, leverage drops to zero",
      "Get every concession in writing as a contract addendum, not a verbal agreement",
      "If you're using multiple quotes for leverage, stay honest — don't make up competing numbers",
      "Be willing to actually walk away. The biggest leverage is the willingness to use it",
      "Be polite but firm. Reputable contractors expect this and respect it; the ones who get defensive are often the ones to avoid",
      "Take notes during the call: name of person, date/time, what was agreed",
    ],
  };
}
