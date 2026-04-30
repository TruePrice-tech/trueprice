import {
  parseBillToolName,
  parseBillToolDefinition,
  runParseBill,
} from "./parse_bill.js";
import {
  checkErrorsToolName,
  checkErrorsToolDefinition,
  runCheckErrors,
} from "./check_errors.js";
import {
  lookupAveragePriceToolName,
  lookupAveragePriceToolDefinition,
  runLookupAveragePrice,
} from "./lookup_average_price.js";
import {
  draftDisputeToolName,
  draftDisputeToolDefinition,
  runDraftDispute,
} from "./draft_dispute.js";
import {
  negotiationScriptToolName,
  negotiationScriptToolDefinition,
  runNegotiationScript,
} from "./negotiation_script.js";

export const toolDefinitions = [
  parseBillToolDefinition,
  checkErrorsToolDefinition,
  lookupAveragePriceToolDefinition,
  draftDisputeToolDefinition,
  negotiationScriptToolDefinition,
];

export async function runTool(name: string, args: unknown): Promise<unknown> {
  switch (name) {
    case parseBillToolName:
      return runParseBill(args);
    case checkErrorsToolName:
      return runCheckErrors(args);
    case lookupAveragePriceToolName:
      return runLookupAveragePrice(args);
    case draftDisputeToolName:
      return runDraftDispute(args);
    case negotiationScriptToolName:
      return runNegotiationScript(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
