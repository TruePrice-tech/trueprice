// HVAC analyze audit harness, mirrors roofing.
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL = "https://woogoro.com/hvac-quote-analyzer.html";
const FIX_DEFAULT = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
const FIXTURE = process.env.AUDIT_FIXTURE ? path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", process.env.AUDIT_FIXTURE) : FIX_DEFAULT;
const FIX_AUTO = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "auto-equinox-quote.jpeg");
const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const OUT = path.resolve(__dirname, "..", "output", "audits", "hvac-2026-04-29", "analyze");
fs.mkdirSync(OUT, { recursive: true });

const STEP = process.argv[2] || "1";
function $w(s) { return new Promise(r => setTimeout(r, s)); }

async function describePage(page) {
  return await page.evaluate(() => {
    function rect(el) { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }
    function visible(el) { const r = el.getBoundingClientRect(); const s = window.getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.01; }
    const interactive = [];
    document.querySelectorAll("a, button, input, textarea, select, [role=button], [onclick]").forEach(el => {
      if (!visible(el)) return;
      interactive.push({
        tag: el.tagName, type: el.type || null, id: el.id || null,
        cls: typeof el.className === "string" ? el.className.slice(0, 80) : null,
        href: el.href || null,
        text: (el.innerText || el.value || "").slice(0, 100).trim(),
        rect: rect(el),
      });
    });
    return {
      url: location.href, title: document.title,
      bodyTextStart: document.body.innerText.slice(0, 600),
      interactive,
    };
  });
}

async function passCheckpoint(page) {
  for (let i = 0; i < 30; i++) {
    await $w(1000);
    try {
      const isCheckpoint = await page.evaluate(() => /Vercel Security Checkpoint|verifying your browser|Failed to verify/i.test(document.body && document.body.innerText || ""));
      if (!isCheckpoint) return true;
    } catch (e) { /* navigation in flight */ }
  }
  return false;
}

async function uploadAndWait(page, file) {
  await passCheckpoint(page);
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(file);
  for (let i = 0; i < 75; i++) {
    await $w(1000);
    const has = await page.evaluate(() => {
      const t = document.body.innerText.toLowerCase();
      return /quote total detected|verdict|notably above|notably below|fair price|expected range|this is not/i.test(t);
    });
    if (has) return true;
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
    // Wait through Vercel security checkpoint if present (it auto-passes
    // once it verifies the browser, typically 2-5 seconds).
    for (let i = 0; i < 30; i++) {
      await $w(1000);
      try {
        const isCheckpoint = await page.evaluate(() => /Vercel Security Checkpoint|verifying your browser|Failed to verify/i.test(document.body && document.body.innerText || ""));
        if (!isCheckpoint) break;
      } catch (e) { /* navigation in flight, keep polling */ }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "01-initial.png"), fullPage: true });
    fs.writeFileSync(path.join(OUT, "01-initial.json"), JSON.stringify(await describePage(page), null, 2));
    console.log("Step 1 done.");
  }

  if (STEP === "2") {
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await uploadAndWait(page, FIXTURE);
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "02-after-upload.png"), fullPage: true });
    const resultText = await page.evaluate(() => {
      const r = document.querySelector("#analysisOutput, #resultContainer, #resultsContent, .analyzer-result, main");
      return r ? r.innerText : "(none)";
    });
    fs.writeFileSync(path.join(OUT, "02-result-text.txt"), resultText);
    fs.writeFileSync(path.join(OUT, "02-after-upload.json"), JSON.stringify(await describePage(page), null, 2));
    console.log("Step 2 done. resultLen=", resultText.length);
  }

  if (STEP === "ctas") {
    // Click each navigation CTA on the result page, screenshot destination,
    // verify it lands somewhere sane.
    const dests = [
      { name: "subnav-estimate", text: "Want a free estimate first" },
      { name: "subnav-compare",  text: "Multiple quotes" },
      { name: "btn-get-estimate", text: "Get an HVAC estimate" },
      { name: "btn-compare",     text: "Compare 2-3 quotes" },
      { name: "btn-methodology", text: "How we calculate" },
      { name: "btn-back-hvac",   text: "Back to HVAC" },
      { name: "btn-home",        text: "Home" },
    ];
    const ctaResults = [];
    for (const d of dests) {
      await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
      await passCheckpoint(page);
      await page.waitForSelector('input[type=file]', { timeout: 30000 });
      await $w(1500);
      // Get to verdict page first
      const fileInput = await page.$('input[type=file]');
      await fileInput.uploadFile(FIXTURE);
      // Wait for confirm
      for (let i = 0; i < 75; i++) {
        await $w(1000);
        const has = await page.evaluate(() => /yes,?\s*analyze\s*this\s*price/i.test(document.body.innerText));
        if (has) break;
      }
      await $w(800);
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll("button, a")).find(b => /yes,?\s*analyze\s*this\s*price/i.test(b.innerText || ""));
        if (t) t.click();
      });
      // Wait for verdict
      for (let i = 0; i < 60; i++) {
        await $w(1000);
        const has = await page.evaluate(() => /next steps|woogoro hvac verdict/i.test(document.body.innerText));
        if (has) break;
      }
      await $w(2000);
      // Now click target CTA
      const before = page.url();
      const clicked = await page.evaluate((t) => {
        const els = Array.from(document.querySelectorAll("a, button"));
        const m = els.find(e => (e.innerText || "").toLowerCase().includes(t.toLowerCase()));
        if (m) { m.click(); return { ok: true, href: m.href || null, isButton: m.tagName === "BUTTON" }; }
        return { ok: false };
      }, d.text);
      await $w(4000);
      const after = page.url();
      const title = await page.evaluate(() => document.title);
      await page.screenshot({ path: path.join(OUT, "cta-" + d.name + ".png"), fullPage: false });
      ctaResults.push({ ...d, clicked, before, after, title });
    }
    fs.writeFileSync(path.join(OUT, "cta-results.json"), JSON.stringify(ctaResults, null, 2));
    console.log("CTAs tested:", ctaResults.length);
    ctaResults.forEach(r => console.log(r.name, "->", r.clicked.ok ? r.title.slice(0, 50) : "NOT FOUND", "(" + r.after + ")"));
  }

  if (STEP === "5") {
    // Upload + click "Yes, analyze this price" + read final verdict
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector('input[type=file]', { timeout: 30000 });
    await $w(1500);
    const fileInput = await page.$('input[type=file]');
    if (!fileInput) { console.log("No file input"); await browser.close(); return; }
    await fileInput.uploadFile(FIXTURE);
    // Wait for price-confirm to render
    let confirmReady = false;
    for (let i = 0; i < 75; i++) {
      await $w(1000);
      const has = await page.evaluate(() => /yes,?\s*analyze\s*this\s*price/i.test(document.body.innerText));
      if (has) { confirmReady = true; break; }
    }
    console.log("Price-confirm visible:", confirmReady);
    if (!confirmReady) { await browser.close(); return; }
    await $w(1000);
    // Click "Yes, analyze this price"
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a"));
      const t = btns.find(b => /yes,?\s*analyze\s*this\s*price/i.test(b.innerText || ""));
      if (t) { t.click(); return true; }
      return false;
    });
    console.log("Clicked confirm:", clicked);
    // Wait for final verdict
    let verdictReady = false;
    for (let i = 0; i < 60; i++) {
      await $w(1000);
      const has = await page.evaluate(() => /verdict|notably above|notably below|fair price|expected range|appears (above|below|fair|over)/i.test(document.body.innerText));
      if (has) { verdictReady = true; break; }
    }
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "05-final-verdict.png"), fullPage: true });
    const text = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    fs.writeFileSync(path.join(OUT, "05-final-verdict.txt"), text);
    console.log("Step 5 done. verdictReady=", verdictReady, " textLen=", text.length);
  }

  if (STEP === "3") {
    // Wrong-vertical: upload roofing fixture to HVAC analyzer
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const fileInput = await page.$('input[type=file]');
    await fileInput.uploadFile(FIX_ROOF);
    let rejectSeen = false;
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => {
        const t = document.body.innerText.toLowerCase();
        return /this is not a hvac|this is not an hvac|not a hvac|wrong vertical|looks like.*roof/i.test(t);
      });
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "03-roofing-on-hvac.png"), fullPage: true });
    console.log("Step 3 (roofing on HVAC) rejectSeen=", rejectSeen);
  }

  if (STEP === "4") {
    // Wrong-vertical: upload auto fixture
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const fileInput = await page.$('input[type=file]');
    await fileInput.uploadFile(FIX_AUTO);
    let rejectSeen = false;
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => {
        const t = document.body.innerText.toLowerCase();
        return /this is not a hvac|this is not an hvac|not a hvac|wrong vertical|looks like.*auto/i.test(t);
      });
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "04-auto-on-hvac.png"), fullPage: true });
    console.log("Step 4 (auto on HVAC) rejectSeen=", rejectSeen);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
