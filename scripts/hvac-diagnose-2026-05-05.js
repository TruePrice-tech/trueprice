// Minimal diagnostic probe: capture network 4xx/console errors on
// /hvac-estimate and time the Tesseract parse on /compare-hvac-quotes.
const puppeteer = require("puppeteer");
const path = require("path");

const BASE = "https://woogoro.com";

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    defaultViewport: { width: 1440, height: 900 },
  });

  console.log("== EST-2: /hvac-estimate console + network ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    const errs = [];
    const requests4xx = [];
    page.on("console", msg => {
      if (msg.type() === "error" || msg.type() === "warning") errs.push({ type: msg.type(), text: msg.text() });
    });
    page.on("response", res => {
      const status = res.status();
      if (status >= 400) requests4xx.push({ url: res.url(), status });
    });
    page.on("pageerror", e => errs.push({ type: "pageerror", text: e.message }));
    await page.goto(BASE + "/hvac-estimate.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 5000));
    console.log("Console errors/warnings:");
    if (errs.length === 0) console.log("  (none)");
    errs.forEach(e => console.log("  [" + e.type + "]", e.text.slice(0, 220)));
    console.log("Network 4xx+:");
    if (requests4xx.length === 0) console.log("  (none)");
    requests4xx.forEach(r => console.log("  [" + r.status + "]", r.url));
    await page.close();
  }

  console.log("\n== COMPARE: time parse pipeline ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(300000);
    const F3 = path.resolve(__dirname, "..", "test-quotes/hvac-images/comparison-ac-01-low.png");
    const F5 = path.resolve(__dirname, "..", "test-quotes/hvac-images/comparison-ac-03-high.png");

    const tStart = Date.now();
    page.on("console", msg => {
      const text = msg.text();
      if (/parse|tesseract|ocr|worker/i.test(text)) {
        console.log("  [" + ((Date.now() - tStart)/1000).toFixed(1) + "s console " + msg.type() + "]", text.slice(0, 180));
      }
    });

    await page.goto(BASE + "/compare-hvac-quotes.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));

    const inputs = await page.$$('input[type="file"]');
    if (inputs[0]) await inputs[0].uploadFile(F3);
    if (inputs[1]) await inputs[1].uploadFile(F5);
    console.log("  [" + ((Date.now() - tStart)/1000).toFixed(1) + "s] uploaded both");

    let lastBtnText = null;
    let lastSnapshotAt = 0;
    while (Date.now() - tStart < 240000) {
      const btnText = await page.evaluate(() => {
        const b = document.getElementById("compareBtn");
        return b ? b.innerText : null;
      });
      if (btnText !== lastBtnText) {
        console.log("  [" + ((Date.now() - tStart)/1000).toFixed(1) + "s btn]", btnText);
        lastBtnText = btnText;
        lastSnapshotAt = Date.now() - tStart;
      }
      if (btnText && /^compare \d+ quotes$/i.test(btnText)) break;
      await new Promise(r => setTimeout(r, 1500));
    }
    console.log("  total parse time before clickable:", ((lastSnapshotAt)/1000).toFixed(1) + "s");
    await page.close();
  }

  await browser.close();
  console.log("\nDONE");
})();
