import { readFileSync, statSync } from "fs";
import { resolve, extname } from "path";
import { runParseBill } from "./tools/parse_bill.js";

async function main() {
  const fixture = process.argv[2] || "../test-quotes/real-world/medical-02.jpg";
  const fixturePath = resolve(fixture);

  console.log(`Reading fixture: ${fixturePath}`);
  const buf = readFileSync(fixturePath);
  const ext = extname(fixturePath).toLowerCase().replace(".", "");
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "png"
      ? "image/png"
      : ext === "webp"
      ? "image/webp"
      : "image/png";

  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  console.log(
    `Image size: ${(statSync(fixturePath).size / 1024).toFixed(1)} KB, mime: ${mime}`
  );

  console.log("\nCalling parse_bill against live Woogoro API...");
  const start = Date.now();
  const result = await runParseBill({
    bill_images: [dataUrl],
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Response received in ${elapsed}s\n`);

  if (!("success" in result) || !result.success) {
    console.error("PARSE FAILED:");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log("=== LLM SUMMARY ===");
  console.log(result.summary_for_llm);
  console.log("\n=== STRUCTURED RESULT ===");
  console.log(JSON.stringify(result.parsed, null, 2).slice(0, 4000));
  console.log(
    "\n(structured result truncated to 4000 chars; full payload available)"
  );
}

main().catch((err) => {
  console.error("E2E TEST FAILED:", err);
  process.exit(1);
});
