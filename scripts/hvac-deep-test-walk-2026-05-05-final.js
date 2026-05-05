// Final verification walk for round-3 close-out fixes:
// - F5-25C-COPY: f5 (central_ac Trane) should NOT mention 25C heat pump credit
// - F7-PARSER-1: f7 (low-conf table) should hide brand/warranty rows
// - W2: f1 (no-address service quote) should show "No address on the quote..." note
// - CMP-COPY-1: f3 vs f5 compare should render "Different tiers, similar overall value"
// - CMP-3: long contractor name should ellipse in column header (visual)
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = "https://woogoro.com";
const OUT = path.resolve(__dirname, "..", "output", "hvac-deep-test-2026-05-05-final");
fs.mkdirSync(OUT, { recursive: true });

const FX = {
  f1: path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-clean-invoice.jpeg"),
  f3: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "comparison-ac-01-low.png"),
  f5: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "comparison-ac-03-high.png"),
  f7: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "09-every-quote-10-total-ive-gotten-for-a-heat-pump-in.png"),
};

function $w(ms) { return new Promise(r => setTimeout(r, ms)); }
async function passCheckpoint(page) {
  for (let i = 0; i < 20; i++) {
    await $w(1000);
    try { if (!/Vercel Security Checkpoint|verifying your browser/i.test(await page.evaluate(() => document.body?.innerText || ""))) return true; } catch (e) {}
  }
  return false;
}
async function snapshot(page, label) {
  await $w(500);
  try { await page.screenshot({ path: path.join(OUT, label + ".png"), fullPage: true }); } catch (e) {}
  try {
    const data = await page.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(0, 7000) }));
    fs.writeFileSync(path.join(OUT, label + ".json"), JSON.stringify(data, null, 2));
  } catch (e) {}
}

async function analyze(browser, fxPath, label) {
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/hvac-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 60000 });
  await passCheckpoint(page);
  await $w(2000);
  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(fxPath);
  await page.waitForFunction(() => !!document.getElementById("tpConfirmPriceBtn") || !!document.querySelector(".verdict-price"), { timeout: 150000 }).catch(() => {});
  if (await page.$("#tpConfirmPriceBtn")) {
    await page.click("#tpConfirmPriceBtn").catch(() => {});
    await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => {});
    await $w(2500);
  }
  await snapshot(page, label);
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"], defaultViewport: { width: 1440, height: 900 } });

  console.log("== F1 service (W2 no-address note) ==");
  await analyze(browser, FX.f1, "ana-f1-w2");

  console.log("== F5 install (F5-25C-COPY central_ac no 25C) ==");
  await analyze(browser, FX.f5, "ana-f5-25c");

  console.log("== F7 low-conf (F7-PARSER-1 details suppressed) ==");
  await analyze(browser, FX.f7, "ana-f7-parser1");

  console.log("== Compare f3 vs f5 (CMP-COPY-1 different tiers) ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(300000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/compare-hvac-quotes.html", { waitUntil: "networkidle2" });
    await passCheckpoint(page);
    await $w(2000);
    const inputs = await page.$$('input[type="file"]');
    if (inputs[0]) await inputs[0].uploadFile(FX.f3);
    if (inputs[1]) await inputs[1].uploadFile(FX.f5);
    await page.waitForFunction(() => {
      const b = document.getElementById("compareBtn");
      return b && !/still parsing/i.test(b.innerText) && !b.disabled;
    }, { timeout: 240000 }).catch(() => {});
    const cbtn = await page.$("#compareBtn");
    if (cbtn) await cbtn.click().catch(() => {});
    await page.waitForFunction(() => /Different tiers|closely matched|best overall value/i.test(document.body.innerText), { timeout: 60000 }).catch(() => {});
    await $w(3000);
    await snapshot(page, "cmp-final");
    await page.close();
  }

  await browser.close();
  console.log("Done. Output:", OUT);
})();
