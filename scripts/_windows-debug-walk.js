// Debug: walk one windows fixture, dump every interesting state.
const puppeteer = require("puppeteer");
const path = require("path");

const FIXTURE = "C:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice/test-quotes/windows-images/comparison-windows-low.png";

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({ "x-woogoro-test": "1" });

  page.on("console", msg => console.log("[browser]", msg.type(), msg.text()));
  page.on("pageerror", err => console.log("[pageerror]", err.message));
  page.on("response", res => {
    const u = res.url();
    if (u.includes("/api/")) console.log("[net]", res.status(), u);
  });

  await page.goto("https://woogoro.com/window-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  console.log("→ uploading", path.basename(FIXTURE));
  const inp = await page.$("#fileInput");
  await inp.uploadFile(FIXTURE);

  // Poll page state every 2s for 60s
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const s = await page.evaluate(() => ({
      step: (window.state || {}).step,
      hasVerdict: !!document.querySelector(".win-verdict"),
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasWinReject: !!document.getElementById("winHardRejectStartOver"),
      hasTpReject: !!document.getElementById("tpHardRejectStartOver"),
      hasManualPriceBtn: !!document.getElementById("manualPriceBtn"),
      progText: (document.getElementById("progText") || {}).textContent,
      title: (document.querySelector("h1") || {}).textContent,
      bodySnip: document.body.innerText.slice(0, 300).replace(/\s+/g, " "),
    }));
    console.log(`t+${i*2}s`, JSON.stringify(s));
    if (s.hasVerdict) break;
  }

  // If we landed on confirm, click it and continue polling
  const hasConfirm = await page.evaluate(() => !!document.getElementById("tpConfirmPriceBtn"));
  if (hasConfirm) {
    console.log("→ clicking tpConfirmPriceBtn");
    await page.evaluate(() => document.getElementById("tpConfirmPriceBtn").click());
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const s = await page.evaluate(() => ({
        step: (window.state || {}).step,
        hasVerdict: !!document.querySelector(".win-verdict"),
        verdictPrice: (document.querySelector(".verdict-price") || {}).innerText,
        bodySnip: document.body.innerText.slice(0, 300).replace(/\s+/g, " "),
      }));
      console.log(`post-confirm t+${i}s`, JSON.stringify(s));
      if (s.hasVerdict) break;
    }
  }

  await page.screenshot({ path: "c:/tmp/windows-debug.png", fullPage: true });
  console.log("→ screenshot saved c:/tmp/windows-debug.png");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
