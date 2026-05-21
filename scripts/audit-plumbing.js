// Plumbing thorough audit — same depth as roofing/HVAC
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL_ANALYZE = "https://woogoro.com/plumbing-quote-analyzer.html";
const URL_COMPARE = "https://woogoro.com/compare-plumbing-quotes.html";
const URL_ESTIMATE = "https://woogoro.com/plumbing-estimate.html";
const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const FIX_HVAC = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
const OUT = path.resolve(__dirname, "..", "output", "audits", "plumbing-2026-04-29");
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
    function rect(el) { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }
    function visible(el) { const r = el.getBoundingClientRect(); const s = window.getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.01; }
    const interactive = [];
    document.querySelectorAll("a, button, input, textarea, select, [role=button], [onclick]").forEach(el => {
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
    for (let i = 0; i < 75; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => /this is not a plumbing|looks like.*roof/i.test(document.body.innerText));
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "analyze/02-roof-on-plumbing.png"), fullPage: true });
    console.log("rejectSeen=", rejectSeen);
  }

  if (STEP === "compare-init") {
    await page.goto(URL_COMPARE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "compare/01-initial.png"), fullPage: true });
    fs.writeFileSync(path.join(OUT, "compare/01-initial.json"), JSON.stringify(await describePage(page), null, 2));
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
    for (let i = 0; i < 75; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => /this is not a plumbing|looks like.*roof/i.test(document.body.innerText));
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "compare/02-roof-on-compare.png"), fullPage: true });
    console.log("rejectSeen=", rejectSeen);
  }

  if (STEP === "estimate-wizard") {
    // Walk wizard to final estimate
    await page.goto(URL_ESTIMATE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    // Address step — fill ZIP + city + state (state required)
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input"));
      const zip = inputs.find(i => /zip/i.test((i.placeholder || "") + (i.name || "")));
      if (zip) { zip.value = "29710"; zip.dispatchEvent(new Event("input",{bubbles:true})); }
      const city = inputs.find(i => /city/i.test((i.placeholder || "") + (i.name || "")));
      if (city) { city.value = "Fort Mill"; city.dispatchEvent(new Event("input",{bubbles:true})); }
      const st = inputs.find(i => /^state$|stateCode/i.test((i.placeholder || "") + (i.name || "")) || (i.placeholder && /state/i.test(i.placeholder)));
      if (st) { st.value = "SC"; st.dispatchEvent(new Event("input",{bubbles:true})); }
    });
    await $w(500);
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll("button, input[type=submit]")).find(b => /get\s+plumbing\s+estimate/i.test(b.innerText || b.value || ""));
      if (t) t.click();
    });
    await $w(3000);
    // Walk wizard (similar pattern to HVAC: .hvac-option / .plumb-option)
    for (let i = 1; i <= 6; i++) {
      const advanced = await page.evaluate(() => {
        const sels = [".plumb-option", ".hvac-option", "[data-val]", ".option-card"];
        for (const sel of sels) {
          const els = document.querySelectorAll(sel);
          if (els && els.length > 0) {
            els[0].click();
            return { clicked: sel, text: (els[0].innerText || "").slice(0, 60) };
          }
        }
        return { clicked: null };
      });
      console.log("step", i, "->", JSON.stringify(advanced));
      await $w(2500);
      await page.evaluate(() => {
        const next = Array.from(document.querySelectorAll("button, .plumb-btn, .hvac-btn, [role=button]")).find(b => /^(next|continue|build|see my estimate|show my estimate|get estimate|looks right.{0,15}continue|confirm)$/i.test((b.innerText || "").trim()));
        if (next) next.click();
      });
      await $w(2500);
      const reached = await page.evaluate(() => /estimated cost|midpoint|expected range|your estimate/i.test(document.body.innerText));
      if (reached) { console.log("Final estimate reached at step", i); break; }
    }
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "estimate/02-final.png"), fullPage: true });
    const text = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    fs.writeFileSync(path.join(OUT, "estimate/02-final.txt"), text);
    console.log("estimate-wizard done. textLen=", text.length);
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
