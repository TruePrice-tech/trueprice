// PL-10 verification: upload f7-roto-rooter-redacted to plumbing analyzer
// and confirm the PRICING detail row no longer renders the hallucinated
// city ("Ustomer Nal Je") — should fall through to regional pricing.

const puppeteer = require("puppeteer");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/plumbing-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_DIR, "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg"));

  await page.waitForFunction(() => {
    return !!document.getElementById("confirmPriceBtn") ||
           !!document.getElementById("manualPriceBtn") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  if (await page.$("#confirmPriceBtn")) await page.click("#confirmPriceBtn");
  else if (await page.$("#manualPriceBtn")) {
    await page.type("#manualPrice", "500");
    await page.click("#manualPriceBtn");
  }
  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const pricing = await page.evaluate(() => {
    const rows = {};
    document.querySelectorAll(".plumb-detail").forEach(d => {
      const lbl = (d.querySelector(".label") || {}).innerText || "";
      const val = (d.querySelector(".value") || {}).innerText || "";
      if (lbl) rows[lbl.trim().toLowerCase()] = val.trim();
    });
    return rows.pricing || "";
  });

  console.log("PRICING row:", JSON.stringify(pricing));
  const ok = !/ustomer|customer|name|address/i.test(pricing) && /regional pricing|local pricing/i.test(pricing);
  console.log(ok ? "PASS — no form-fragment text in pricing label" : "FAIL — pricing label still leaks form fragments");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
