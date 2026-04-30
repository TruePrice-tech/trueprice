import { runLookupAveragePrice } from "./tools/lookup_average_price.js";
import { runDraftDispute } from "./tools/draft_dispute.js";
import { runNegotiationScript } from "./tools/negotiation_script.js";

async function main() {
  console.log("=== smoke test: lookup_average_price ===");

  const lookup1 = await runLookupAveragePrice({
    cpt_code: "99202",
    state_code: "CA",
    facility_type: "hospital_outpatient",
  });
  console.log(JSON.stringify(lookup1, null, 2));

  if (!("found" in lookup1) || !lookup1.found) {
    throw new Error("Expected 99202 to be found in pricing data");
  }

  const lookup2 = await runLookupAveragePrice({
    cpt_code: "ZZZZZ",
  });
  console.log(JSON.stringify(lookup2, null, 2));

  if ("found" in lookup2 && lookup2.found) {
    throw new Error("Expected ZZZZZ to not be found");
  }

  console.log("\n=== smoke test: draft_dispute (no_surprises_act) ===");
  const dispute = await runDraftDispute({
    error_type: "no_surprises_act",
    bill_summary: "ER visit at in-network hospital, billed by out-of-network ER physician group",
    patient_name: "Jane Doe",
    account_number: "AC-12345",
    service_date: "2026-04-15",
    specific_charges:
      "$3,400 from XYZ Emergency Physicians (out-of-network) at ABC Hospital (in-network)",
    provider_name: "XYZ Emergency Physicians",
  });
  console.log(JSON.stringify(dispute, null, 2));

  if (!("success" in dispute) || !dispute.success) {
    throw new Error("Expected dispute draft to succeed");
  }

  console.log("\n=== smoke test: negotiation_script (cannot_pay, hospital) ===");
  const script = await runNegotiationScript({
    bill_amount: 7400,
    ability_to_pay: "cannot_pay",
    facility_type: "hospital",
    hardship_situation: "Recently lost job, on COBRA",
  });
  console.log(JSON.stringify(script, null, 2));

  if (!("success" in script) || !script.success) {
    throw new Error("Expected negotiation script to succeed");
  }

  console.log("\nAll smoke tests passed.");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
