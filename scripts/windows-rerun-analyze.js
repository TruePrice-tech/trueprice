// Re-run analyze path only with extended timeout for messy handwritten quote.
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
  page.on("console", (m) => {
    const t = m.text();
    // log everything to see exactly where the OCR hangs
    console.log("  [" + m.type() + "]:", t.substring(0, 280));
  });
  page.on("pageerror", (e) => console.log("  pageerror:", e.message));
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log("  frame nav:", f.url()); });
  page.on("close", () => console.log("  PAGE CLOSED"));
  page.on("requestfailed", (r) => console.log("  reqfail:", r.url().substring(0, 120), r.failure() && r.failure().errorText));

  console.log("=== ANALYZE only (extended 5min timeout) ===");
  await page.goto("https://woogoro.com/window-quote-analyzer.html", {
    waitUntil: "networkidle2",
    timeout: 60000
  });
  // Wait for the upload-zone form input to render — Vercel security checkpoint
  // can intercept and we need to wait through it.
  console.log("  waiting for #fileInput to render (clearing Vercel challenge)...");
  await page.waitForSelector('input[type="file"]', { timeout: 90000 });
  await sleep(1500);

  const fixturePath = path.join(ROOT, "test-quotes/windows-images/real/reddit-img-1-fair-quote.jpg");
  await (await page.$('input[type="file"]')).uploadFile(fixturePath);
  console.log("  uploaded EcoView fixture at", new Date().toISOString());

  const start = Date.now();
  let confirmReady = false;
  while (Date.now() - start < 300000) {
    await sleep(3000);
    try {
      confirmReady = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find((b) => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
        return !!(target && !target.disabled && target.offsetParent !== null);
      });
    } catch (evalErr) {
      console.log("  eval err at", Math.round((Date.now() - start) / 1000) + "s:", evalErr.message.substring(0, 120));
      // Try to capture body text via fresh evaluate after a moment
      try {
        const head = await page.evaluate(() => document.body && document.body.innerText.substring(0, 200));
        console.log("  body head:", head);
      } catch (e) { console.log("  cannot eval body either"); }
      break;
    }
    if (confirmReady) break;
  }
  const elapsed = Math.round((Date.now() - start) / 1000);
  console.log("  confirm ready:", confirmReady, "after", elapsed + "s");
  await page.screenshot({ path: path.join(OUT, "rerun-21-confirm.png") });

  const ocr = await page.evaluate(() => (window.__TP_LAST_OCR_TEXT || "").substring(0, 4000));
  if (ocr) fs.writeFileSync(path.join(OUT, "rerun-ocr.txt"), ocr);
  console.log("  OCR length:", ocr.length, "chars");
  if (ocr.length) console.log("  OCR head:", ocr.substring(0, 280).replace(/\n+/g, " | "));

  // Capture confirm-step body text so we can see what's on screen
  const confirmText = await page.evaluate(() => document.body.innerText.substring(0, 1500));
  fs.writeFileSync(path.join(OUT, "rerun-confirm-text.txt"), confirmText);

  if (confirmReady) {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find((b) => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
      if (target) target.click();
    });
    await sleep(5000);
    await page.screenshot({ path: path.join(OUT, "rerun-22-result-top.png") });
    await page.screenshot({ path: path.join(OUT, "rerun-23-result-full.png"), fullPage: true });
    const verdict = await page.evaluate(() => {
      const v = document.querySelector(".win-verdict");
      return v ? v.innerText : "MISSING";
    });
    console.log("  verdict:", verdict.replace(/\n+/g, " | "));
  }
  await browser.close();
  console.log("DONE");
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
