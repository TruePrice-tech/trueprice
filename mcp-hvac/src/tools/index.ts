import { parseQuoteSchema, runParseQuote } from "./parse_quote.js";
import { checkErrorsSchema, runCheckErrors } from "./check_errors.js";
import { lookupAveragePriceSchema, runLookupAveragePrice } from "./lookup_average_price.js";
import { draftDisputeSchema, runDraftDispute } from "./draft_dispute.js";
import { negotiationScriptSchema, runNegotiationScript } from "./negotiation_script.js";

export const toolDefinitions = [
  parseQuoteSchema,
  checkErrorsSchema,
  lookupAveragePriceSchema,
  draftDisputeSchema,
  negotiationScriptSchema,
];

export async function runTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "parse_quote":
      return runParseQuote(args);
    case "check_errors":
      return runCheckErrors(args);
    case "lookup_average_price":
      return runLookupAveragePrice(args);
    case "draft_dispute":
      return runDraftDispute(args);
    case "negotiation_script":
      return runNegotiationScript(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
