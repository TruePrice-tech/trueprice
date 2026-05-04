// Debug-capture OCR text + parser output for the f4 messy fixture.
// We need to see what tesseract actually returned for the skewed JPG to know
// whether the green-envelope letterhead survived OCR. Output is written to
// stdout — no commits, no live-site mutation.
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1440, height: 900 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/insulation-estimate") || res.url().includes("/api/parse-quote")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto("https://woogoro.com/insulation-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));
  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.resolve(__dirname, "..", "test-quotes/insulation-images/messy-comparison-insul-high.jpg"));
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));
  // Pull state.extractedText from the page
  const ocrText = await page.evaluate(() => {
    try {
      // Heavy hammer — walk the closure variable via window if exposed,
      // else grab the element text we render. Insulation analyzer doesn't
      // expose state on window. Fall back to scanning DOM.
      return {
        ocr: (window.__TP_LAST_OCR_TEXT || "").slice(0, 4000),
        ai: window.__TP_LAST_AI_DATA || null,
      };
    } catch (e) { return null; }
  });
  console.log("OCR text (first 4000 chars):");
  console.log(ocrText && ocrText.ocr);
  console.log("\nAI data (engineResult.aiData):");
  console.log(JSON.stringify(ocrText && ocrText.ai, null, 2));
  console.log("\nAPI responses:", apiResponses.length);
  for (const r of apiResponses) {
    console.log("\n  URL:", r.url, "status:", r.status);
    try {
      const j = JSON.parse(r.body);
      console.log("  contractor:", JSON.stringify(j?.data?.contractor));
      console.log("  insulationType:", JSON.stringify(j?.data?.insulationType));
      console.log("  rValue:", JSON.stringify(j?.data?.rValue));
      console.log("  ocr text length:", j?.data?.ocrText ? j.data.ocrText.length : "n/a");
      // Show first 500 chars of any "rawText" / "ocr" / "extractedText" field
      const blob = JSON.stringify(j).slice(0, 3000);
      console.log("  body slice:", blob);
    } catch (e) { console.log("  body slice (raw):", r.body.slice(0, 1000)); }
  }
  await browser.close();
})();
