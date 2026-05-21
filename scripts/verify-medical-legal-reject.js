// Quick puppeteer verification: medical + legal hard-reject
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "output", "verify-medical-legal", new Date().toISOString().replace(/[:.]/g, "-"));
const FIX_PATH = path.join(ROOT, "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");

async function testReject(browser, label, url) {
  console.log(`\n=== ${label} ===`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400 });
  page.on("pageerror", (e) => console.log(`[${label} pageerror]`, e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log(`[${label} err]`, m.text()); });

  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2500));
  const inputs = await page.$$('input[type="file"]');
  if (inputs.length === 0) { console.log("FAIL: no file input"); await page.close(); return false; }
  await inputs[0].uploadFile(FIX_PATH);
  console.log("uploaded roofing-gaf-quote.jpeg");

  // Wait up to 90s for terminal state (reject OR result)
  try {
    await page.waitForFunction(() => {
      const text = document.body.textContent || "";
      return /this is not a/i.test(text)
        || /quote analysis|looks (fair|low|high)/i.test(text.slice(0, 1500))
        || /we found your quote total/i.test(text);
    }, { timeout: 90000, polling: 1500 });
  } catch (e) { console.log("terminal-state timeout"); }

  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(OUT, label + ".png"), fullPage: true });

  const state = await page.evaluate(() => ({
    text: (document.body.textContent || "").slice(0, 4000),
    hasReject: /this is not a/i.test(document.body.textContent || ""),
    hasFakePrice: /\$16,7\d\d|\$16,8\d\d/.test(document.body.textContent || ""),
    hasGotoButton: !!Array.from(document.querySelectorAll("a")).find(a => /analyze as roofing/i.test(a.textContent || "")),
  }));
  await page.close();

  const ok = state.hasReject && !state.hasFakePrice;
  console.log(`hasReject=${state.hasReject} hasFakePrice=${state.hasFakePrice} hasGotoButton=${state.hasGotoButton} -> ${ok ? "PASS" : "FAIL"}`);
  return ok;
}

async function testHappyPath(browser, label, url, fixturePath) {
  console.log(`\n=== ${label} (HAPPY PATH — should NOT reject) ===`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400 });
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2500));
  const inputs = await page.$$('input[type="file"]');
  if (inputs.length === 0) { console.log("FAIL: no file input"); await page.close(); return false; }
  await inputs[0].uploadFile(fixturePath);
  console.log("uploaded", path.basename(fixturePath));
  // Wait 60s for analysis
  await new Promise((r) => setTimeout(r, 60000));
  await page.screenshot({ path: path.join(OUT, label + "-happy.png"), fullPage: true });
  const state = await page.evaluate(() => ({
    hasReject: /this is not a/i.test(document.body.textContent || ""),
  }));
  await page.close();
  const ok = !state.hasReject;
  console.log(`hasReject=${state.hasReject} -> ${ok ? "PASS (no false-positive reject)" : "FAIL (REJECTED OWN VERTICAL)"}`);
  return ok;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const m = await testReject(browser, "medical", "/medical-bill-analyzer.html");
  const l = await testReject(browser, "legal", "/legal-fee-analyzer.html");
  // Roofing: hvac fixture should reject; roofing fixture should NOT reject
  const hvacFix = path.join(ROOT, "test", "receipt", "ocr-cache", "fixtures", "hvac-clean-invoice.jpeg");
  const r_neg = await testReject(browser, "roofing-neg", "/roofing-quote-analyzer.html");
  // Override fixture to test happy path: roofing fixture into roofing
  const r_pos = await testHappyPath(browser, "roofing-pos", "/roofing-quote-analyzer.html", FIX_PATH);
  await browser.close();
  console.log(`\nmedical: ${m ? "PASS" : "FAIL"} | legal: ${l ? "PASS" : "FAIL"} | roofing-neg: ${r_neg ? "PASS" : "FAIL"} | roofing-pos: ${r_pos ? "PASS" : "FAIL"}`);
  console.log("Screenshots:", OUT);
  process.exit(m && l && r_neg && r_pos ? 0 : 1);
})();
