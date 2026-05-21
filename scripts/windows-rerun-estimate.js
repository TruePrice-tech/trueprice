// Re-run only the estimate path to verify the tighter 0.88/1.15 band.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "windows-walk-real-2026-04-27");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else {
      req.continue();
    }
  });
  page.on("pageerror", (e) => console.log("  pageerror:", e.message));

  console.log("=== ESTIMATE re-walk (tighter band verification) ===");
  await page.goto("https://woogoro.com/window-estimate.html", { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#addrStreet", { timeout: 90000 });
  await sleep(1000);

  await page.evaluate(() => {
    document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
    document.getElementById("addrCity").value = "Fort Mill";
    document.getElementById("addrState").value = "SC";
    document.getElementById("addrZip").value = "29707";
  });
  await page.click("#btnEstimate");
  await sleep(3000);

  // Click through: 16+, vinyl, mid, double-hung, double-lowe, pocket
  const steps = [
    ["#optCount [data-val=\"16+\"]", "count=16+"],
    ["#optMaterial [data-val=\"vinyl\"]", "material=vinyl"],
    ["#optBrandTier [data-val=\"mid\"]", "tier=mid"],
    ["#optStyle [data-val=\"double-hung\"]", "style=double-hung"],
    ["#optGlass [data-val=\"double-lowe\"]", "glass=double-lowe"],
    ["#optInstall [data-val=\"pocket\"]", "install=pocket"]
  ];
  for (const [sel, label] of steps) {
    const ok = await page.evaluate((s) => { const o = document.querySelector(s); if (o) { o.click(); return true; } return false; }, sel);
    console.log("  step", label, ok ? "OK" : "FAIL");
    await sleep(700);
  }
  await sleep(2500);

  await page.screenshot({ path: path.join(OUT, "verify-estimate-result-top.png") });
  await page.screenshot({ path: path.join(OUT, "verify-estimate-result-full.png"), fullPage: true });

  const verdict = await page.evaluate(() => {
    const v = document.querySelector(".win-verdict");
    return v ? v.innerText : "MISSING";
  });
  console.log("  verdict:", verdict.replace(/\n+/g, " | "));

  await browser.close();
  console.log("DONE");
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
