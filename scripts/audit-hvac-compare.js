// HVAC compare audit
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL = "https://woogoro.com/compare-hvac-quotes.html";
const FIX_HVAC1 = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-clean-invoice.jpeg");
const FIX_HVAC2 = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const OUT = path.resolve(__dirname, "..", "output", "audits", "hvac-2026-04-29", "compare");
fs.mkdirSync(OUT, { recursive: true });

const STEP = process.argv[2] || "1";
function $w(s) { return new Promise(r => setTimeout(r, s)); }

async function passCheckpoint(page) {
  for (let i = 0; i < 30; i++) {
    await $w(1000);
    try {
      const isCheckpoint = await page.evaluate(() => /Vercel Security Checkpoint|verifying your browser|Failed to verify/i.test(document.body && document.body.innerText || ""));
      if (!isCheckpoint) return true;
    } catch (e) {}
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1280, height: 900 });

  if (STEP === "1") {
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "01-initial.png"), fullPage: true });
    const desc = await page.evaluate(() => ({
      title: document.title,
      bodyTextStart: document.body.innerText.slice(0, 800),
    }));
    fs.writeFileSync(path.join(OUT, "01-initial.json"), JSON.stringify(desc, null, 2));
    console.log("Step 1 done.");
  }

  if (STEP === "2") {
    // Both HVAC fixtures
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector('input[type=file]', { timeout: 30000 });
    await $w(1500);
    const inputs = await page.$$('input[type=file]');
    await inputs[0].uploadFile(FIX_HVAC1);
    await $w(1000);
    await inputs[1].uploadFile(FIX_HVAC2);
    let ready = false;
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      const r = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.some(b => /compare/i.test(b.innerText) && !b.disabled);
      });
      if (r) { ready = true; break; }
    }
    await $w(2000);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /compare/i.test(b.innerText) && !b.disabled);
      if (t) t.click();
    });
    await $w(20000);
    await page.screenshot({ path: path.join(OUT, "03-results.png"), fullPage: true });
    const resultText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    fs.writeFileSync(path.join(OUT, "03-results.txt"), resultText);
    console.log("Step 2 done. ready=", ready, " resultLen=", resultText.length);
  }

  if (STEP === "ctas") {
    // After valid comparison, click each result-page CTA
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector('input[type=file]', { timeout: 30000 });
    await $w(1500);
    const ins = await page.$$('input[type=file]');
    await ins[0].uploadFile(FIX_HVAC1);
    await $w(1000);
    await ins[1].uploadFile(FIX_HVAC2);
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      const r = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.some(b => /compare/i.test(b.innerText) && !b.disabled);
      });
      if (r) break;
    }
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll("button")).find(b => /compare/i.test(b.innerText) && !b.disabled);
      if (t) t.click();
    });
    // Wait for results
    for (let i = 0; i < 60; i++) {
      await $w(1000);
      const has = await page.evaluate(() => /WOOGORO QUOTE ANALYSIS|Total Price/i.test(document.body.innerText));
      if (has) break;
    }
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "05-results-page-state.png"), fullPage: true });
    // Test each CTA
    const ctaTests = [
      { name: "upload-different", text: "Upload different quotes" },
      { name: "back-to-hvac",     text: "Back to HVAC" },
      { name: "home",             text: "Home" },
      { name: "see-pro-example",  text: "See an example Pro report" },
    ];
    const results = [];
    for (const c of ctaTests) {
      // Re-navigate and re-build to result for each click
      await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
      await passCheckpoint(page);
      await page.waitForSelector('input[type=file]', { timeout: 30000 });
      await $w(1500);
      const ins2 = await page.$$('input[type=file]');
      await ins2[0].uploadFile(FIX_HVAC1);
      await $w(1000);
      await ins2[1].uploadFile(FIX_HVAC2);
      for (let i = 0; i < 90; i++) {
        await $w(1000);
        const r = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          return btns.some(b => /compare/i.test(b.innerText) && !b.disabled);
        });
        if (r) break;
      }
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll("button")).find(b => /compare/i.test(b.innerText) && !b.disabled);
        if (t) t.click();
      });
      for (let i = 0; i < 60; i++) {
        await $w(1000);
        const has = await page.evaluate(() => /WOOGORO QUOTE ANALYSIS|Total Price/i.test(document.body.innerText));
        if (has) break;
      }
      await $w(2000);
      const before = page.url();
      const clicked = await page.evaluate((t) => {
        const els = Array.from(document.querySelectorAll("a, button"));
        const m = els.find(e => (e.innerText || "").toLowerCase().includes(t.toLowerCase()));
        if (m) { m.click(); return { ok: true, href: m.href || null }; }
        return { ok: false };
      }, c.text);
      await $w(4000);
      const after = page.url();
      const title = await page.evaluate(() => document.title);
      results.push({ ...c, before, after, title, clicked });
    }
    fs.writeFileSync(path.join(OUT, "06-cta-results.json"), JSON.stringify(results, null, 2));
    console.log("CTA results:");
    results.forEach(r => console.log(r.name, "->", r.clicked.ok ? r.title.slice(0, 60) : "NOT FOUND", "(" + r.after + ")"));
  }

  if (STEP === "3") {
    // Mixed: roofing + HVAC — should reject
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector('input[type=file]', { timeout: 30000 });
    await $w(1500);
    const inputs = await page.$$('input[type=file]');
    await inputs[0].uploadFile(FIX_ROOF);
    await $w(1000);
    await inputs[1].uploadFile(FIX_HVAC1);
    let rejectSeen = false;
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => /this is not an? hvac|looks like.*roof/i.test(document.body.innerText));
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "04-mixed-vertical.png"), fullPage: true });
    console.log("Step 3 (roofing + hvac) rejectSeen=", rejectSeen);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
