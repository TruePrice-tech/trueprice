// Roofing compare audit harness, mirrors audit-roofing-analyze.js layout.
// Run: node scripts/audit-roofing-compare.js [step]

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL = "https://woogoro.com/compare-roofing-quotes.html";
const FIX_GAF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const FIX_MAL = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-scope-doc.png");
const FIX_AUTO = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "auto-equinox-quote.jpeg");
const OUT = path.resolve(__dirname, "..", "output", "audits", "roofing-2026-04-29", "compare");
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
        tag: el.tagName, type: el.type || null, id: el.id || null,
        cls: el.className && typeof el.className === "string" ? el.className.slice(0, 100) : null,
        href: el.href || null,
        text: (el.innerText || el.value || "").slice(0, 120).trim(),
        rect: rect(el),
      });
    });
    return {
      url: location.href, title: document.title, bodyClass: document.body.className,
      bodyTextLen: document.body.innerText.length,
      bodyTextStart: document.body.innerText.slice(0, 600),
      interactive,
    };
  });
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
    // Upload 2 fixtures (GAF + Malarkey) and click compare
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const inputs = await page.$$('input[type=file]');
    console.log("File inputs found:", inputs.length);
    if (inputs.length >= 2) {
      await inputs[0].uploadFile(FIX_GAF);
      await $w(1000);
      await inputs[1].uploadFile(FIX_MAL);
      console.log("Uploaded 2 fixtures, waiting...");
    } else {
      console.log("Not enough file inputs!");
    }
    // Wait for both quotes to be parsed ("2 of 2 ready" or button enabled)
    let parsedReady = false;
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      const ready = await page.evaluate(() => {
        const t = document.body.innerText.toLowerCase();
        return /\b2 of 2 (?:ready|parsed)\b/.test(t) || /both quotes ready/.test(t);
      });
      const btnEnabled = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const t = btns.find(b => /compare/i.test(b.innerText));
        return t && !t.disabled;
      });
      if (ready || btnEnabled) { parsedReady = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "02-after-uploads.png"), fullPage: true });
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /compare/i.test(b.innerText) && !b.disabled);
      if (t) { t.click(); return t.innerText; }
      return null;
    });
    console.log("ParsedReady=", parsedReady, " Clicked button:", clicked);
    // Wait for comparison
    let resultLen = 0;
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      const len = await page.evaluate(() => {
        const r = document.querySelector("#resultsContent, #resultsStep, .cmp-results, .comparison-result");
        return r ? r.innerText.length : 0;
      });
      if (len > 500) { resultLen = len; break; }
      if (i % 15 === 14) await page.screenshot({ path: path.join(OUT, `02-progress-${i+1}s.png`), fullPage: true });
    }
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "03-results.png"), fullPage: true });
    const resultText = await page.evaluate(() => {
      const r = document.querySelector("#resultsContent, #resultsStep, .cmp-results, .comparison-result, main");
      return r ? r.innerText : "(none)";
    });
    fs.writeFileSync(path.join(OUT, "03-results.txt"), resultText);
    console.log("Step 2 done. resultLen=", resultLen);
  }

  if (STEP === "6") {
    // Instrument TP_Engine on compare page same way as analyze, see materials returned
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await page.evaluate(() => {
      window.__captured = [];
      const wait = setInterval(() => {
        if (window.TP_Engine && window.TP_Engine.analyzeQuote) {
          const orig = window.TP_Engine.analyzeQuote.bind(window.TP_Engine);
          window.TP_Engine.analyzeQuote = function(file, opts) {
            return orig(file, opts).then(result => {
              window.__captured.push({
                opts, price: result.price,
                material: result.material, materialLabel: result.materialLabel,
                contractor: result.contractor, ocrLen: (result.ocrText || "").length
              });
              return result;
            });
          };
          clearInterval(wait);
        }
      }, 100);
    });
    await $w(1000);
    const inputs = await page.$$('input[type=file]');
    await inputs[0].uploadFile(FIX_GAF);
    await $w(1000);
    await inputs[1].uploadFile(FIX_MAL);
    await $w(70000);
    const captured = await page.evaluate(() => window.__captured);
    fs.writeFileSync(path.join(OUT, "07-engine-capture-compare.json"), JSON.stringify(captured, null, 2));
    console.log("Step 6: captured", captured.length, "engineResults from compare page");
    captured.forEach((c, i) => console.log("Result", i, ":", JSON.stringify({price: c.price, material: c.material, materialLabel: c.materialLabel})));
  }

  if (STEP === "5") {
    // Inspect quotes[] state after upload to see api.material values
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const inputs = await page.$$('input[type=file]');
    await inputs[0].uploadFile(FIX_GAF);
    await $w(1000);
    await inputs[1].uploadFile(FIX_MAL);
    await $w(70000);
    const state = await page.evaluate(() => {
      // Find local closure quotes via TP debug helpers
      const debug = window.__tpDebug || {};
      return {
        latestAnalysis: debug.getLatestAnalysis ? debug.getLatestAnalysis() : null,
        // Also try to grab tableRows via DOM
        materialCells: Array.from(document.querySelectorAll(".cmp-table td, .cmp-table th")).map(c => c.innerText).slice(0, 20),
      };
    });
    fs.writeFileSync(path.join(OUT, "06-state.json"), JSON.stringify(state, null, 2));
    console.log("Step 5: state captured", JSON.stringify(state).slice(0, 500));
  }

  if (STEP === "4") {
    // Diagnostic: instrument tpEnforceVerticalMatch to log what it sees
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2500);
    await page.evaluate(() => {
      window.__guardCalls = [];
      const orig = window.tpEnforceVerticalMatch;
      if (orig) {
        window.tpEnforceVerticalMatch = function(v, t, root) {
          const detected = window.detectVerticalFromText ? window.detectVerticalFromText(t) : null;
          const result = orig(v, t, root);
          window.__guardCalls.push({
            vertical: v, ocrLen: t ? t.length : 0,
            ocrSample: (t || "").slice(0, 200),
            detected: detected ? { top: detected.vertical, score: detected.score, all: detected.all } : null,
            returnValue: result,
            cardHtmlAfter: (root ? root.innerHTML : "").slice(0, 400),
          });
          return result;
        };
      }
    });
    const inputs = await page.$$('input[type=file]');
    await inputs[0].uploadFile(FIX_AUTO);
    await $w(1000);
    await inputs[1].uploadFile(FIX_GAF);
    await $w(70000);
    const calls = await page.evaluate(() => window.__guardCalls);
    fs.writeFileSync(path.join(OUT, "05-guard-calls.json"), JSON.stringify(calls, null, 2));
    console.log("Step 4: guard calls captured:", calls.length);
    if (calls.length) console.log(JSON.stringify(calls, null, 2));
  }

  if (STEP === "3") {
    // Unhappy path: upload AUTO fixture as quote 1, GAF as quote 2 — should reject or warn
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    const inputs = await page.$$('input[type=file]');
    if (inputs.length >= 2) {
      await inputs[0].uploadFile(FIX_AUTO);
      await $w(1000);
      await inputs[1].uploadFile(FIX_GAF);
    }
    await $w(5000);
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /compare/i.test(b.innerText) && !b.disabled);
      if (t) { t.click(); return true; }
      return false;
    });
    let rejectSeen = false;
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => {
        const t = document.body.innerText.toLowerCase();
        return /this is not a roof|not a roofing|wrong vertical|looks like.*auto/.test(t);
      });
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "04-mixed-vertical.png"), fullPage: true });
    const desc = await describePage(page);
    fs.writeFileSync(path.join(OUT, "04-mixed-vertical.json"), JSON.stringify(desc, null, 2));
    console.log("Step 3 (auto+gaf compare) clicked=", clicked, "rejectSeen=", rejectSeen);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
