// Solar thorough audit
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL_ANALYZE = "https://woogoro.com/concrete-quote-analyzer.html";
const URL_COMPARE = "https://woogoro.com/compare-concrete-quotes.html";
const URL_ESTIMATE = "https://woogoro.com/concrete-estimate.html";
const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const OUT = path.resolve(__dirname, "..", "output", "audits", "concrete-2026-04-29");
fs.mkdirSync(OUT + "/analyze", { recursive: true });
fs.mkdirSync(OUT + "/compare", { recursive: true });
fs.mkdirSync(OUT + "/estimate", { recursive: true });

const STEP = process.argv[2] || "1";
function $w(s) { return new Promise(r => setTimeout(r, s)); }

async function passCheckpoint(page) {
  for (let i = 0; i < 30; i++) {
    await $w(1000);
    try {
      const isCheck = await page.evaluate(() => /Vercel Security Checkpoint|verifying your browser|Failed to verify/i.test(document.body && document.body.innerText || ""));
      if (!isCheck) return true;
    } catch (e) {}
  }
  return false;
}

async function describePage(page) {
  return await page.evaluate(() => {
    function visible(el) { const r = el.getBoundingClientRect(); const s = window.getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.01; }
    const interactive = [];
    document.querySelectorAll("a, button, input, textarea, select").forEach(el => {
      if (!visible(el)) return;
      interactive.push({
        tag: el.tagName, type: el.type || null,
        cls: typeof el.className === "string" ? el.className.slice(0, 80) : null,
        href: el.href || null,
        text: (el.innerText || el.value || "").slice(0, 100).trim(),
        placeholder: el.placeholder || null,
      });
    });
    return {
      url: location.href, title: document.title,
      bodyTextStart: document.body.innerText.slice(0, 1000),
      interactive,
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  if (STEP === "analyze-init") {
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "analyze/01-initial.png"), fullPage: true });
    fs.writeFileSync(path.join(OUT, "analyze/01-initial.json"), JSON.stringify(await describePage(page), null, 2));
    console.log("Done.");
  }

  if (STEP === "analyze-reject-roof") {
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector('input[type=file]', { timeout: 30000 });
    await $w(1500);
    const fileInput = await page.$('input[type=file]');
    await fileInput.uploadFile(FIX_ROOF);
    let rejectSeen = false;
    let lastState = "(no state captured)";
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      lastState = await page.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => "(eval err)");
      const seen = await page.evaluate(() => /this is not an? concrete|looks like.*roof/i.test(document.body.innerText)).catch(() => false);
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "analyze/02-roof-on-solar.png"), fullPage: true });
    console.log("rejectSeen=", rejectSeen);
    console.log("lastState (first 200):", lastState);
  }

  if (STEP === "compare-init") {
    await page.goto(URL_COMPARE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "compare/01-initial.png"), fullPage: true });
    console.log("Done.");
  }

  if (STEP === "compare-reject-roof") {
    await page.goto(URL_COMPARE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector('input[type=file]', { timeout: 30000 });
    await $w(1500);
    const inputs = await page.$$('input[type=file]');
    if (inputs.length >= 1) await inputs[0].uploadFile(FIX_ROOF);
    let rejectSeen = false;
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => /this is not an? concrete|looks like.*roof/i.test(document.body.innerText)).catch(() => false);
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "compare/02-roof-on-compare.png"), fullPage: true });
    console.log("rejectSeen=", rejectSeen);
  }

  if (STEP === "estimate-init") {
    await page.goto(URL_ESTIMATE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "estimate/01-initial.png"), fullPage: true });
    fs.writeFileSync(path.join(OUT, "estimate/01-initial.json"), JSON.stringify(await describePage(page), null, 2));
    console.log("Done.");
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
