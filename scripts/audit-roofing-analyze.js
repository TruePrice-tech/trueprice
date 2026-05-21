// Step-by-step audit harness for roofing analyze.
// Each step writes a screenshot + a JSON of the DOM state I need to audit.
// Run: node scripts/audit-roofing-analyze.js [step]

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL = "https://woogoro.com/roofing-quote-analyzer.html";
const FIXTURE_DEFAULT = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const FIXTURE = process.env.AUDIT_FIXTURE ? path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", process.env.AUDIT_FIXTURE) : FIXTURE_DEFAULT;
const AUTO_FIXTURE = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "auto-equinox-quote.jpeg");
const OUT = path.resolve(__dirname, "..", "output", "audits", "roofing-2026-04-29", "analyze");
fs.mkdirSync(OUT, { recursive: true });

const STEP = process.argv[2] || "1";

function $w(s) { return new Promise(r => setTimeout(r, s)); }

async function describePage(page) {
  return await page.evaluate(() => {
    function rect(el) {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }
    function visible(el) {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.01;
    }
    const interactive = [];
    const sels = ["a", "button", "input", "textarea", "select", "[role=button]", "[onclick]"];
    document.querySelectorAll(sels.join(",")).forEach(el => {
      if (!visible(el)) return;
      interactive.push({
        tag: el.tagName,
        type: el.type || null,
        id: el.id || null,
        cls: el.className && typeof el.className === "string" ? el.className.slice(0, 100) : null,
        href: el.href || null,
        text: (el.innerText || el.value || "").slice(0, 120).trim(),
        rect: rect(el),
      });
    });
    return {
      url: location.href,
      title: document.title,
      bodyClass: document.body.className,
      bodyTextLen: document.body.innerText.length,
      bodyTextStart: document.body.innerText.slice(0, 600),
      interactive,
    };
  });
}

async function uploadAndWait(page) {
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(FIXTURE);
  for (let i = 0; i < 60; i++) {
    await $w(1000);
    const has = await page.evaluate(() => {
      const out = document.querySelector("#analysisOutput, #resultContainer, #resultsContent, .analyzer-result, .estimator-result");
      return out && out.innerText.length > 200;
    });
    if (has) return true;
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1280, height: 900 });

  if (STEP === "1") {
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "01-initial.png"), fullPage: true });
    const desc = await describePage(page);
    fs.writeFileSync(path.join(OUT, "01-initial.json"), JSON.stringify(desc, null, 2));
    console.log("Step 1 done. Page has", desc.interactive.length, "visible interactive elements.");
  }

  if (STEP === "2") {
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const ok = await uploadAndWait(page);
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "02-after-upload.png"), fullPage: true });
    const desc = await describePage(page);
    fs.writeFileSync(path.join(OUT, "02-after-upload.json"), JSON.stringify(desc, null, 2));
    const resultText = await page.evaluate(() => {
      const out = document.querySelector("#analysisOutput, #resultContainer, #resultsContent, .analyzer-result");
      return out ? out.innerText : "(no result container found)";
    });
    fs.writeFileSync(path.join(OUT, "02-result-text.txt"), resultText);
    console.log("Step 2 done. ok=", ok, " resultLen=", resultText.length);
  }

  if (STEP === "3") {
    // Click "View quote side-by-side" — see what overlay/panel appears
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await uploadAndWait(page);
    await $w(2000);
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /side-by-side/i.test(b.innerText));
      if (t) { t.click(); return true; }
      return false;
    });
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "03a-side-by-side.png"), fullPage: true });
    console.log("Step 3 (side-by-side) clicked=", clicked);
  }

  if (STEP === "4") {
    // Test the price-confirm "No thanks" path — should show fallback verdict?
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await uploadAndWait(page);
    await $w(2000);
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /^no thanks$/i.test(b.innerText.trim()));
      if (t) { t.click(); return true; }
      return false;
    });
    await $w(20000);
    await page.screenshot({ path: path.join(OUT, "04a-no-thanks.png"), fullPage: true });
    const resultText = await page.evaluate(() => {
      const out = document.querySelector("#analysisOutput, #resultContainer, #resultsContent, .analyzer-result");
      return out ? out.innerText : "(none)";
    });
    fs.writeFileSync(path.join(OUT, "04a-no-thanks.txt"), resultText);
    console.log("Step 4 (no thanks) clicked=", clicked, " resultLen=", resultText.length);
  }

  if (STEP === "5") {
    // Test happy path: enter roof size and click "Re-check my quote" — should produce final verdict
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await uploadAndWait(page);
    await $w(2000);
    // Find roof size input (number type) and enter 2000 sqft
    const filled = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input[type=number]"));
      if (!inputs.length) return false;
      const inp = inputs[0];
      inp.value = "2000";
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    });
    await $w(500);
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /re-check/i.test(b.innerText));
      if (t) { t.click(); return true; }
      return false;
    });
    await $w(20000);
    await page.screenshot({ path: path.join(OUT, "05a-recheck-2000sqft.png"), fullPage: true });
    const resultText = await page.evaluate(() => {
      const out = document.querySelector("#analysisOutput, #resultContainer, #resultsContent, .analyzer-result");
      return out ? out.innerText : "(none)";
    });
    fs.writeFileSync(path.join(OUT, "05a-recheck-2000sqft.txt"), resultText);
    console.log("Step 5 (re-check 2000sqft) filled=", filled, " clicked=", clicked, " resultLen=", resultText.length);
  }

  if (STEP === "6") {
    // Unhappy path: upload AUTO fixture and verify hard-reject fires
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const fileInput = await page.$('input[type=file]');
    await fileInput.uploadFile(AUTO_FIXTURE);
    let rejectSeen = false;
    for (let i = 0; i < 60; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => {
        const t = document.body.innerText.toLowerCase();
        return /this is not a roof|not a roofing|wrong vertical|looks like.*auto/.test(t);
      });
      if (seen) { rejectSeen = true; break; }
    }
    await $w(1500);
    await page.screenshot({ path: path.join(OUT, "06a-auto-fixture.png"), fullPage: true });
    const desc = await describePage(page);
    fs.writeFileSync(path.join(OUT, "06a-auto-fixture.json"), JSON.stringify(desc, null, 2));
    console.log("Step 6 (auto fixture upload) rejectSeen=", rejectSeen);
  }

  if (STEP === "7") {
    // Click sub-nav "Multiple quotes? Compare →" — verify it lands on correct compare page
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const link = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find(x => /compare/i.test(x.innerText) && /multiple/i.test(x.innerText));
      return a ? a.href : null;
    });
    if (link) {
      await page.goto(link, { waitUntil: "networkidle2", timeout: 60000 });
      await $w(2000);
      await page.screenshot({ path: path.join(OUT, "07a-compare-link-dest.png"), fullPage: true });
      console.log("Step 7 dest=", page.url());
    } else {
      console.log("Step 7: no compare link found");
    }
  }

  if (STEP === "8") {
    // Click sub-nav "Want a free estimate first?"
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const link = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find(x => /free estimate first/i.test(x.innerText));
      return a ? a.href : null;
    });
    if (link) {
      await page.goto(link, { waitUntil: "networkidle2", timeout: 60000 });
      await $w(2000);
      await page.screenshot({ path: path.join(OUT, "08a-estimate-link-dest.png"), fullPage: true });
      console.log("Step 8 dest=", page.url());
    } else {
      console.log("Step 8: no estimate link found");
    }
  }

  if (STEP === "9") {
    // Click "See an example Pro report"
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await uploadAndWait(page);
    await $w(15000);
    const link = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find(x => /example pro report/i.test(x.innerText));
      return a ? a.href : null;
    });
    if (link) {
      await page.goto(link, { waitUntil: "networkidle2", timeout: 60000 });
      await $w(2000);
      await page.screenshot({ path: path.join(OUT, "09a-pro-example.png"), fullPage: true });
      console.log("Step 9 dest=", page.url());
    } else {
      console.log("Step 9: no link found");
    }
  }

  if (STEP === "10") {
    // Click "Unlock Pro for $19" — should navigate to Stripe checkout
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await uploadAndWait(page);
    await $w(2000);
    let dest = null;
    page.on("framenavigated", f => { if (f === page.mainFrame()) dest = f.url(); });
    const clicked = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button, a")).find(x => /unlock pro/i.test(x.innerText));
      if (b) { b.click(); return true; }
      return false;
    });
    await $w(8000);
    await page.screenshot({ path: path.join(OUT, "10a-pro-unlock.png"), fullPage: true });
    console.log("Step 10 clicked=", clicked, " currentUrl=", page.url());
  }

  if (STEP === "15") {
    // Inspect engineResult / TP_Engine output directly via instrumented call
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    // Wire up a global to capture analyzeQuote output
    await page.evaluate(() => {
      window.__captured = [];
      // Wait for TP_Engine to load then wrap it
      const wait = setInterval(() => {
        if (window.TP_Engine && window.TP_Engine.analyzeQuote) {
          const orig = window.TP_Engine.analyzeQuote.bind(window.TP_Engine);
          window.TP_Engine.analyzeQuote = function(file, opts) {
            return orig(file, opts).then(result => {
              window.__captured.push({
                opts, price: result.price, ocrLen: (result.ocrText || "").length,
                ocrSample: (result.ocrText || "").slice(0, 300),
                priceSourceClues: { hasMaterial: !!result.material, hasContractor: !!result.contractor },
              material: result.material,
              materialLabel: result.materialLabel
              });
              return result;
            });
          };
          clearInterval(wait);
        }
      }, 100);
    });
    await $w(1000);
    const fileInput = await page.$('input[type=file]');
    await fileInput.uploadFile(FIXTURE);
    await $w(45000);
    const captured = await page.evaluate(() => window.__captured);
    fs.writeFileSync(path.join(OUT, "15-engine-capture.json"), JSON.stringify(captured, null, 2));
    console.log("Step 15 captured", captured.length, "engineResult(s)");
    if (captured.length) console.log("First:", JSON.stringify(captured[0]));
  }

  if (STEP === "14") {
    // Dump the OCR text after upload to inspect parser input
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const fileInput = await page.$('input[type=file]');
    await fileInput.uploadFile(FIXTURE);
    await $w(45000);
    const ocr = await page.evaluate(() => window.__TP_LAST_OCR_TEXT || "");
    fs.writeFileSync(path.join(OUT, "14-ocr-dump.txt"), ocr);
    console.log("Step 14 OCR dump len=", ocr.length);
    console.log("--- start ---\n" + ocr.slice(0, 2000) + "\n--- end ---");
  }

  if (STEP === "13") {
    // Auto-fixture upload + capture appRoot contents to see if reject was wiped
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const fileInput = await page.$('input[type=file]');
    await fileInput.uploadFile(AUTO_FIXTURE);
    await $w(50000);
    const state = await page.evaluate(() => {
      const root = document.getElementById("appRoot");
      const ocr = window.__TP_LAST_OCR_TEXT || "";
      // Check if reject screen text is present anywhere
      const fullBody = document.body.innerText;
      return {
        ocrLen: ocr.length,
        rootHtmlStart: root ? root.innerHTML.slice(0, 800) : "(no #appRoot)",
        rootTextStart: root ? root.innerText.slice(0, 600) : "(no)",
        bodyHasReject: /This is not a/i.test(fullBody),
        bodyHasPriceConfirm: /add your roof size|quote total detected/i.test(fullBody),
      };
    });
    fs.writeFileSync(path.join(OUT, "13-state-after-50s.json"), JSON.stringify(state, null, 2));
    console.log("Step 13:", { ocrLen: state.ocrLen, bodyHasReject: state.bodyHasReject, bodyHasPriceConfirm: state.bodyHasPriceConfirm });
    console.log("rootTextStart:", state.rootTextStart.slice(0, 200));
  }

  if (STEP === "12") {
    // Diagnostic: upload auto fixture, wait long, capture __TP_LAST_OCR_TEXT and call guard manually
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const fileInput = await page.$('input[type=file]');
    await fileInput.uploadFile(AUTO_FIXTURE);
    // Wait a long time
    await $w(45000);
    const diag = await page.evaluate(() => {
      const ocr = window.__TP_LAST_OCR_TEXT || "";
      const guardExists = typeof window.tpEnforceVerticalMatch === "function";
      let guardResult = null;
      if (guardExists && ocr.length > 50) {
        try {
          const appRoot = document.getElementById("appRoot");
          guardResult = window.tpEnforceVerticalMatch("roofing", ocr, appRoot);
        } catch (e) { guardResult = "ERR: " + e.message; }
      }
      return {
        ocrLen: ocr.length,
        ocrSample: ocr.slice(0, 800),
        guardExists,
        guardResult,
        bodyTextStart: document.body.innerText.slice(0, 600),
      };
    });
    fs.writeFileSync(path.join(OUT, "12-diagnostic.json"), JSON.stringify(diag, null, 2));
    console.log("Step 12 diag:", { ocrLen: diag.ocrLen, guardExists: diag.guardExists, guardResult: diag.guardResult });
  }

  if (STEP === "11") {
    // Read the heads-up banner — what data does the API return for roofing?
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const data = await page.evaluate(async () => {
      const r = await fetch("/api/pricing-events-active?minSeverity=2&limit=5&strict=1&vertical=roofing");
      return await r.json();
    });
    fs.writeFileSync(path.join(OUT, "11-banner-events.json"), JSON.stringify(data, null, 2));
    console.log("Step 11 banner events:", JSON.stringify(data));
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
