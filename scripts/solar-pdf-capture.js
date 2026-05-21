// Render the solar analyze result to a PDF + a visual snapshot to read it like a human
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "solar-pdf-2026-04-27");
const BASE = "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else {
      req.continue();
    }
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|TP_Engine|verdict/i.test(t)) console.log("  [console]", m.type(), t.substring(0, 240));
  });

  console.log("Loading solar analyzer + uploading fixture 04 (8MSolar real install)...");
  await page.goto(`${BASE}/solar-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1500);

  const fixture = path.join(ROOT, "test-quotes/solar-images/04-how-does-my-solar-quote-look-thx-in-advance-nc-duk.jpg");
  await (await page.$('input[type="file"]')).uploadFile(fixture);

  // Wait for confirm
  const start1 = Date.now();
  let ready = false;
  while (Date.now() - start1 < 90000) {
    await sleep(2000);
    ready = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
      return !!(t && !t.disabled && t.offsetParent !== null);
    });
    if (ready) break;
  }
  console.log("  confirm ready:", ready);
  if (ready) {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
      if (t) t.click();
    });
    // Wait for verdict
    const start2 = Date.now();
    while (Date.now() - start2 < 60000) {
      await sleep(2500);
      const done = await page.evaluate(() => /(Fair Price|Above Average|Below Average|Overpriced|Unusually Low|Lease|Parts Only|Needs Review)/i.test(document.body.innerText));
      if (done) break;
    }
    await sleep(2000);
  }

  // Take a print-emulated full screenshot — this is how the PDF will look
  await page.emulateMediaType("print");
  await page.screenshot({ path: path.join(OUT, "result-print-view.png"), fullPage: true });
  console.log("  saved: result-print-view.png");

  // Generate the actual PDF
  await page.pdf({
    path: path.join(OUT, "result.pdf"),
    format: "Letter",
    printBackground: true,
    margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" }
  });
  console.log("  saved: result.pdf");

  // Also dump the print-mode body text so we can read what content is bundled
  await page.emulateMediaType("print");
  const bodyText = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, "result-print-body.txt"), bodyText);
  console.log("  saved: result-print-body.txt (", bodyText.length, "chars)");

  await browser.close();
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
