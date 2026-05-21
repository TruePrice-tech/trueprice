// Gutters thorough audit
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL_ANALYZE = "https://woogoro.com/legal-fee-analyzer.html";
const URL_COMPARE = "https://woogoro.com/compare-legal-quotes.html";
const URL_ESTIMATE = "https://woogoro.com/legal-estimate.html";
const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const OUT = path.resolve(__dirname, "..", "output", "audits", "legal-2026-04-30");
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
    protocolTimeout: 120000,
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  // setCacheEnabled(false) was breaking Tesseract.js WASM worker loading on
  // production. Removed 2026-04-29.
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
      const seen = await page.evaluate(() => /this is not.*legal|looks like.*roof/i.test(document.body.innerText)).catch(() => false);
      if (seen) { rejectSeen = true; break; }
    }
    await $w(5000);
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
      const seen = await page.evaluate(() => /this is not.*legal|looks like.*roof/i.test(document.body.innerText)).catch(() => false);
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "compare/02-roof-on-compare.png"), fullPage: true });
    console.log("rejectSeen=", rejectSeen);
  }

  if (STEP === "reject-ctas") {
    // Step 4 of HUMAN_AUDIT_PROMPT: click each CTA on reject screen
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("input[type=file]", { timeout: 30000 });
    await $w(1500);
    const fileInput = await page.$("input[type=file]");
    await fileInput.uploadFile(FIX_ROOF);
    for (let i = 0; i < 75; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => /this is not.*legal|looks like.*roof/i.test(document.body.innerText)).catch(() => false);
      if (seen) break;
    }
    await $w(2000);
    // Capture both CTAs hrefs
    const ctas = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("a, button"));
      const a = items.find(x => /analyze as roofing instead/i.test(x.innerText));
      const b = items.find(x => /upload a different file/i.test(x.innerText));
      return {
        analyzeAs: a ? { tag: a.tagName, href: a.href || null, text: a.innerText.trim() } : null,
        uploadDifferent: b ? { tag: b.tagName, href: b.href || null, text: b.innerText.trim() } : null,
      };
    });
    console.log("CTAs found:", JSON.stringify(ctas, null, 2));
    fs.writeFileSync(path.join(OUT, "analyze/04-reject-ctas.json"), JSON.stringify(ctas, null, 2));
  }

  if (STEP === "unhappy-reload") {
    // Step 5: trigger reject, then click "Upload a different file", verify clean state
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("input[type=file]", { timeout: 30000 });
    await $w(1500);
    const fileInput = await page.$("input[type=file]");
    await fileInput.uploadFile(FIX_ROOF);
    for (let i = 0; i < 75; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => /this is not.*legal|looks like.*roof/i.test(document.body.innerText)).catch(() => false);
      if (seen) break;
    }
    await $w(2000);
    // Click "Upload a different file"
    await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a, button")).find(x => /upload a different file/i.test(x.innerText));
      if (a) a.click();
    });
    await $w(5000);
    await passCheckpoint(page);
    await $w(1500);
    await page.screenshot({ path: path.join(OUT, "analyze/05-after-upload-different.png"), fullPage: true });
    const stateAfter = await page.evaluate(() => ({
      isInitial: /Is your legal fee fair/i.test(document.body.innerText),
      isReject: /this is not/i.test(document.body.innerText),
      hasFileInput: !!document.querySelector("input[type=file]"),
    }));
    console.log("After 'Upload a different file' click:", JSON.stringify(stateAfter, null, 2));
  }

  if (STEP === "estimate-empty-submit") {
    // Step 5 unhappy path: empty submit
    await page.goto(URL_ESTIMATE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll("button, input[type=submit]")).find(b => /get\s+(gutter|gutters)?\s*estimate/i.test(b.innerText || b.value || ""));
      if (t) t.click();
    });
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "estimate/02-empty-submit.png"), fullPage: false });
    const has = await page.evaluate(() => ({
      hasError: /enter a valid|please enter|required/i.test(document.body.innerText),
      headline: (document.querySelector("h1")?.innerText || ""),
      stepMarker: (document.body.innerText.match(/Step \d of \d/) || [])[0] || "",
    }));
    console.log("After empty submit:", JSON.stringify(has, null, 2));
  }

  if (STEP === "estimate-wizard") {
    // Step 2-3: fill ZIP/state, walk wizard, capture final estimate
    await page.goto(URL_ESTIMATE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input"));
      const addr = inputs.find(i => /address|street/i.test((i.placeholder || "") + (i.id || "") + (i.name || "")));
      if (addr) { addr.value = "123 Maple St"; addr.dispatchEvent(new Event("input",{bubbles:true})); }
      const city = inputs.find(i => /city/i.test((i.placeholder || "") + (i.name || "")));
      if (city) { city.value = "Fort Mill"; city.dispatchEvent(new Event("input",{bubbles:true})); }
      const st = inputs.find(i => i.placeholder && /state/i.test(i.placeholder));
      if (st) { st.value = "SC"; st.dispatchEvent(new Event("input",{bubbles:true})); }
      const zip = inputs.find(i => /zip/i.test((i.placeholder || "") + (i.name || "")));
      if (zip) { zip.value = "29710"; zip.dispatchEvent(new Event("input",{bubbles:true})); }
    });
    await $w(500);
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll("button, input[type=submit]")).find(b => /get\s+(gutter|gutters)?\s*estimate/i.test(b.innerText || b.value || ""));
      if (t) t.click();
    });
    await $w(3000);
    // Walk options for up to 8 steps
    for (let i = 1; i <= 8; i++) {
      const advanced = await page.evaluate(() => {
        const sels = [".leg-option", ".gutters-option", ".ins-option", ".kit-option", ".found-option", ".gd-option", ".plumb-option", ".hvac-option", "[data-val]", "button.option"];
        for (const sel of sels) {
          const els = document.querySelectorAll(sel);
          if (els && els.length > 0) {
            els[0].click();
            return { clicked: sel, text: (els[0].innerText || "").slice(0, 50) };
          }
        }
        return { clicked: null };
      });
      console.log("step", i, "->", JSON.stringify(advanced));
      await $w(2500);
      await page.evaluate(() => {
        const next = Array.from(document.querySelectorAll("button, [role=button]")).find(b => /^(next|continue|build|see my estimate|get estimate|looks right.{0,15}continue|confirm)$/i.test((b.innerText || "").trim()));
        if (next) next.click();
      });
      await $w(2500);
      const reached = await page.evaluate(() => /estimated cost|midpoint|expected range|your estimate/i.test(document.body.innerText));
      if (reached) { console.log("Final estimate at step", i); break; }
    }
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "estimate/03-final.png"), fullPage: true });
    const finalText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    fs.writeFileSync(path.join(OUT, "estimate/03-final.txt"), finalText);
    console.log("textLen=", finalText.length);
  }

  if (STEP === "analyze-reject-hvac") {
    const FIX_HVAC = require("path").resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("input[type=file]", { timeout: 30000 });
    await $w(1500);
    const fileInput = await page.$("input[type=file]");
    await fileInput.uploadFile(FIX_HVAC);
    let rejectSeen = false, lastBody = "";
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      try { lastBody = await page.evaluate(() => document.body.innerText.slice(0, 600)); } catch (e) {}
      const seen = /this is not.*legal|looks like.*hvac/i.test(lastBody);
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "analyze/02b-hvac-on-gd.png"), fullPage: true });
    const matched = await page.evaluate(() => {
      const m = document.body.innerText.match(/looks like.{0,3}<strong>([^<]+)<|looks like an? ([^.]+)\./i);
      return { sample: document.body.innerText.slice(0, 400), match: m ? (m[1] || m[2] || "").slice(0, 60) : null };
    });
    console.log("rejectSeen=", rejectSeen);
    console.log("matched body:", JSON.stringify(matched, null, 2));
  }

  if (STEP === "analyze-reject-auto") {
    const FIX_AUTO = require("path").resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "auto-equinox-quote.jpeg");
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("input[type=file]", { timeout: 30000 });
    await $w(1500);
    const fileInput = await page.$("input[type=file]");
    await fileInput.uploadFile(FIX_AUTO);
    let rejectSeen = false;
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => /this is not.*legal|looks like.*auto/i.test(document.body.innerText)).catch(() => false);
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "analyze/02c-auto-on-gd.png"), fullPage: true });
    console.log("rejectSeen=", rejectSeen);
  }

  if (STEP === "step4-all-ctas") {
    // HUMAN_AUDIT_PROMPT Step 4: click EVERY CTA on reject screens and verify routing.
    const FIX_HVAC = require("path").resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
    const FIX_AUTO = require("path").resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "auto-equinox-quote.jpeg");
    const cases = [
      { name: "roof", file: FIX_ROOF, ctaText: /analyze as roofing instead/i, expectedUrl: /roofing-quote-analyzer\.html\?path=quote/, expectedHeader: /(roofing|roof)/i },
      { name: "hvac", file: FIX_HVAC, ctaText: /analyze as hvac instead/i, expectedUrl: /hvac-quote-analyzer\.html\?path=quote/, expectedHeader: /hvac/i },
      { name: "auto", file: FIX_AUTO, ctaText: /analyze as auto repair instead/i, expectedUrl: /auto-repair\.html\?path=quote/, expectedHeader: /auto/i },
    ];
    const results = [];
    for (const c of cases) {
      console.log("=== Testing CTA:", c.name);
      await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
      await passCheckpoint(page);
      await page.waitForSelector("input[type=file]", { timeout: 30000 });
      await $w(1500);
      const fi = await page.$("input[type=file]");
      await fi.uploadFile(c.file);
      let rejectSeen = false;
      for (let i = 0; i < 200; i++) {
        await $w(1000);
        const seen = await page.evaluate(() => /this is not.*legal/i.test(document.body.innerText)).catch(() => false);
        if (seen) { rejectSeen = true; break; }
      }
      // Final screenshot of pre-click state regardless (proves Step 2 of HUMAN_AUDIT_PROMPT)
      await $w(3000);
      await page.screenshot({ path: path.join(OUT, "analyze/04-precta-" + c.name + "-rejected.png"), fullPage: true });
      const ctaInfo = await page.evaluate((re) => {
        const rx = new RegExp(re, "i");
        const a = Array.from(document.querySelectorAll("a, button")).find(x => rx.test(x.innerText));
        return a ? { found: true, href: a.href || null, text: a.innerText.trim() } : { found: false };
      }, c.ctaText.source);
      // Click the CTA and wait for navigation
      let landedUrl = null, landedHeader = null;
      if (ctaInfo.found) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null),
          page.evaluate((re) => {
            const rx = new RegExp(re, "i");
            const a = Array.from(document.querySelectorAll("a, button")).find(x => rx.test(x.innerText));
            if (a) a.click();
          }, c.ctaText.source),
        ]);
        await passCheckpoint(page);
        await $w(1500);
        landedUrl = await page.evaluate(() => location.href);
        landedHeader = await page.evaluate(() => (document.querySelector("h1")?.innerText || "").slice(0, 100));
        await page.screenshot({ path: path.join(OUT, "analyze/04-cta-" + c.name + "-landed.png"), fullPage: true });
      }
      const r = {
        case: c.name, rejectSeen, ctaFound: ctaInfo.found, ctaText: ctaInfo.text || null,
        ctaHref: ctaInfo.href || null, landedUrl, landedHeader,
        urlMatch: landedUrl ? c.expectedUrl.test(landedUrl) : false,
        headerMatch: landedHeader ? c.expectedHeader.test(landedHeader) : false,
      };
      results.push(r);
      console.log(JSON.stringify(r, null, 2));
    }
    // Now test "Upload a different file" CTA
    console.log("=== Testing CTA: Upload a different file");
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("input[type=file]", { timeout: 30000 });
    await $w(1500);
    const fi2 = await page.$("input[type=file]");
    await fi2.uploadFile(FIX_ROOF);
    for (let i = 0; i < 200; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => /this is not.*legal/i.test(document.body.innerText)).catch(() => false);
      if (seen) break;
    }
    await $w(2000);
    await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a, button")).find(x => /upload a different file/i.test(x.innerText));
      if (a) a.click();
    });
    await $w(6000);
    await passCheckpoint(page);
    await $w(1500);
    await page.screenshot({ path: path.join(OUT, "analyze/04-cta-upload-different.png"), fullPage: true });
    const after = await page.evaluate(() => ({
      url: location.href,
      isInitial: /Is your legal fee fair/i.test(document.body.innerText),
      isReject: /this is not.*legal/i.test(document.body.innerText),
      hasFileInput: !!document.querySelector("input[type=file]"),
      header: (document.querySelector("h1")?.innerText || "").slice(0, 100),
    }));
    results.push({ case: "upload-different", after });
    console.log("After 'Upload a different file':", JSON.stringify(after, null, 2));
    fs.writeFileSync(path.join(OUT, "analyze/04-cta-results.json"), JSON.stringify(results, null, 2));
  }

  if (STEP === "diag-ocr-progress") {
    // Diagnostic: upload roof fixture, screenshot every 30s up to 6 min, log full innerText
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("input[type=file]", { timeout: 30000 });
    await $w(1500);
    const fi = await page.$("input[type=file]");
    await fi.uploadFile(FIX_ROOF);
    const log = [];
    for (let t = 0; t < 12; t++) {
      await $w(30000);
      const stamp = (t + 1) * 30;
      const sample = await page.evaluate(() => ({
        title: document.title,
        body: document.body.innerText.slice(0, 600),
        h1: (document.querySelector("h1") || {}).innerText || "",
        hasReject: /this is not.*legal/i.test(document.body.innerText),
        hasResult: /typical|notable|notably|range|estimated cost|expected/i.test(document.body.innerText),
        hasSpinner: /analyzing|reading from|processing|loading/i.test(document.body.innerText),
      })).catch(e => ({ err: String(e) }));
      log.push({ tSec: stamp, sample });
      console.log("t=" + stamp + "s:", JSON.stringify(sample, null, 2));
      await page.screenshot({ path: path.join(OUT, "analyze/diag-ocr-t" + stamp + ".png"), fullPage: true });
      if (sample.hasReject || sample.hasResult) break;
    }
    fs.writeFileSync(path.join(OUT, "analyze/diag-ocr-log.json"), JSON.stringify(log, null, 2));
  }

  if (STEP === "step5-unhappy") {
    // Step 5 of HUMAN_AUDIT_PROMPT: unhappy path variations.
    // Test A: refresh during analysis. Test B: rapid second upload.
    const log = {};

    // Test A: refresh during analysis
    console.log("--- Test A: refresh during analysis");
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("input[type=file]", { timeout: 30000 });
    await $w(1500);
    const fiA = await page.$("input[type=file]");
    await fiA.uploadFile(FIX_ROOF);
    await $w(5000); // mid-analysis
    await page.screenshot({ path: path.join(OUT, "analyze/05-during-analysis.png"), fullPage: true });
    await page.reload({ waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2500);
    await page.screenshot({ path: path.join(OUT, "analyze/05-after-refresh.png"), fullPage: true });
    log.refreshDuring = await page.evaluate(() => ({
      url: location.href,
      h1: (document.querySelector("h1") || {}).innerText || "",
      hasFileInput: !!document.querySelector("input[type=file]"),
      isInitial: /Is your legal fee fair/i.test(document.body.innerText),
      isStuckOnAnalyzing: /analyzing your gutters|reading text from image/i.test((document.querySelector("h1") || {}).innerText || ""),
    }));
    console.log("Test A:", JSON.stringify(log.refreshDuring, null, 2));

    // Test B: rapid second upload before first completes
    console.log("--- Test B: rapid second upload (queue test)");
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("input[type=file]", { timeout: 30000 });
    await $w(1500);
    const fiB1 = await page.$("input[type=file]");
    await fiB1.uploadFile(FIX_ROOF);
    await $w(2000);
    // Try to find the file input again and upload a second time
    const fiB2 = await page.$("input[type=file]");
    if (fiB2) {
      try { await fiB2.uploadFile(FIX_ROOF); } catch (e) { log.secondUploadErr = String(e); }
    }
    // Wait for either reject or result
    let outcome = "timeout";
    for (let i = 0; i < 60; i++) {
      await $w(1000);
      const s = await page.evaluate(() => /this is not.*legal/i.test(document.body.innerText) || /typical|notable|range|estimated cost/i.test(document.body.innerText)).catch(() => false);
      if (s) { outcome = "rendered"; break; }
    }
    await page.screenshot({ path: path.join(OUT, "analyze/05-after-double-upload.png"), fullPage: true });
    log.doubleUpload = {
      outcome,
      bodyHead: await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => "(eval err)"),
    };
    console.log("Test B:", JSON.stringify(log.doubleUpload, null, 2));

    fs.writeFileSync(path.join(OUT, "analyze/05-unhappy-results.json"), JSON.stringify(log, null, 2));
  }

  if (STEP === "compare-reject-2way") {
    // Upload 2 wrong-vertical quotes (roof + roof) to compare, click Compare,
    // verify wrong-vertical reject fires.
    const FIX_HVAC = require("path").resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
    await page.goto(URL_COMPARE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("#file0", { timeout: 30000 });
    await $w(1500);
    const f0 = await page.$("#file0");
    await f0.uploadFile(FIX_ROOF);
    await $w(1500);
    const f1 = await page.$("#file1");
    await f1.uploadFile(FIX_HVAC);
    await $w(1500);
    await page.screenshot({ path: path.join(OUT, "compare/02-after-uploads.png"), fullPage: true });
    // Wait for compare button to be enabled
    await page.evaluate(() => {
      const b = document.getElementById("compareBtn");
      if (b && !b.disabled) b.click();
      else if (b) { b.disabled = false; b.click(); }
    });
    let rejectSeen = false, lastBody = "";
    for (let i = 0; i < 90; i++) {
      await $w(1000);
      try { lastBody = await page.evaluate(() => document.body.innerText.slice(0, 600)); } catch (e) {}
      const seen = /this is not.*legal|looks like.*roof|looks like.*hvac/i.test(lastBody);
      if (seen) { rejectSeen = true; break; }
    }
    await $w(5000);
    await page.screenshot({ path: path.join(OUT, "compare/03-results.png"), fullPage: true });
    fs.writeFileSync(path.join(OUT, "compare/03-results.txt"), lastBody);
    console.log("rejectSeen=", rejectSeen);
    console.log("lastBody (first 400):", lastBody.slice(0, 400));
  }

  if (STEP === "estimate-step5") {
    // Step 5 of estimate: refresh mid-wizard, verify clean reset.
    await page.goto(URL_ESTIMATE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll("button, input[type=submit]")).find(b => /get\s+(gutter|gutters)?\s*estimate/i.test(b.innerText || b.value || ""));
      if (t) t.click();
    });
    await $w(3000);
    // Click first option to advance to step 2
    await page.evaluate(() => {
      const els = document.querySelectorAll(".leg-option");
      if (els && els.length > 0) els[0].click();
    });
    await $w(1500);
    await page.screenshot({ path: path.join(OUT, "estimate/05-mid-wizard.png"), fullPage: true });
    // Reload mid-wizard
    await page.reload({ waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2500);
    await page.screenshot({ path: path.join(OUT, "estimate/05-after-refresh.png"), fullPage: true });
    const after = await page.evaluate(() => ({
      url: location.href,
      h1: (document.querySelector("h1") || {}).innerText || "",
      isInitial: /How much (will|does) (a |the )?gutters|gutters cost|gutters install/i.test(document.body.innerText),
      isWizard: /step \d of \d/i.test(document.body.innerText),
    }));
    console.log("After refresh:", JSON.stringify(after, null, 2));
    fs.writeFileSync(path.join(OUT, "estimate/05-unhappy-results.json"), JSON.stringify({ refreshDuringWizard: after }, null, 2));
  }

  if (STEP === "estimate-step4") {
    // Step 4 of estimate: walk to final estimate, click result-page CTAs.
    const log = {};

    await page.goto(URL_ESTIMATE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    // Skip address, click CTA, walk wizard
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll("button, input[type=submit]")).find(b => /get\s+(gutter|gutters)?\s*estimate/i.test(b.innerText || b.value || ""));
      if (t) t.click();
    });
    await $w(3000);
    for (let i = 1; i <= 8; i++) {
      await page.evaluate(() => {
        const els = document.querySelectorAll(".leg-option");
        if (els && els.length > 0) els[0].click();
      });
      await $w(1500);
      await page.evaluate(() => {
        const next = Array.from(document.querySelectorAll("button, [role=button]")).find(b => /^(next|continue|build|see my estimate|get estimate|looks right.{0,15}continue|confirm)$/i.test((b.innerText || "").trim()));
        if (next) next.click();
      });
      await $w(1500);
      const reached = await page.evaluate(() => /your kitchen remodel estimate|estimated cost|expected range/i.test(document.body.innerText));
      if (reached) break;
    }
    await $w(3000);
    await page.screenshot({ path: path.join(OUT, "estimate/04-result-state.png"), fullPage: true });

    // Read the displayed Service Type label to verify 9x7 fix landed
    log.displayedServiceType = await page.evaluate(() => {
      // The "Project Details" section shows SERVICE TYPE: <value>
      const text = document.body.innerText;
      const m = text.match(/SERVICE TYPE\s*([^\n]+)/);
      return m ? m[1].trim() : null;
    });

    // Inventory result-page CTAs
    log.ctas = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, a"))
        .map(el => ({ tag: el.tagName, text: (el.innerText || "").trim().slice(0, 60), href: el.href || null }))
        .filter(o => o.text && o.text.length > 1);
      return buttons.slice(0, 40);
    });

    // Click "Yes, accurate" feedback CTA (low-risk, no navigation)
    log.yesAccurate = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button, a")).find(x => /yes,?\s*accurate/i.test(x.innerText));
      if (b) { b.click(); return { clicked: true, text: b.innerText.trim() }; }
      return { clicked: false };
    });
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "estimate/04-after-yes-accurate.png"), fullPage: true });
    log.afterYesAccurate = await page.evaluate(() => ({
      bodyHead: document.body.innerText.slice(0, 400),
      thanks: /thank|saved|recorded/i.test(document.body.innerText),
    }));

    fs.writeFileSync(path.join(OUT, "estimate/04-step4-results.json"), JSON.stringify(log, null, 2));
    console.log(JSON.stringify(log, null, 2));
  }

  if (STEP === "compare-step5") {
    // Step 5 of compare: unhappy paths.
    const FIX_HVAC = require("path").resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
    const log = {};

    // Test A: Compare button stays disabled with only 1 quote uploaded
    console.log("--- Compare Test A: button disabled with only 1 quote");
    await page.goto(URL_COMPARE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("#file0", { timeout: 30000 });
    await $w(1500);
    const a0 = await page.$("#file0");
    await a0.uploadFile(FIX_ROOF);
    await $w(20000); // give parser time to settle
    await page.screenshot({ path: path.join(OUT, "compare/05-single-quote-state.png"), fullPage: true });
    log.singleQuote = await page.evaluate(() => {
      const b = document.getElementById("compareBtn");
      return {
        btnText: b ? b.innerText : null,
        btnDisabled: b ? b.disabled : null,
        h1: (document.querySelector("h1") || {}).innerText || "",
      };
    });
    console.log("Single-quote state:", JSON.stringify(log.singleQuote, null, 2));

    // Test B: refresh during compare parsing
    console.log("--- Compare Test B: refresh during parse");
    await page.goto(URL_COMPARE, { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await page.waitForSelector("#file0", { timeout: 30000 });
    await $w(1500);
    const b0 = await page.$("#file0");
    await b0.uploadFile(FIX_ROOF);
    await $w(1500);
    const b1 = await page.$("#file1");
    await b1.uploadFile(FIX_HVAC);
    await $w(3000); // mid-parse
    await page.reload({ waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2500);
    await page.screenshot({ path: path.join(OUT, "compare/05-after-refresh.png"), fullPage: true });
    log.refreshDuringParse = await page.evaluate(() => ({
      url: location.href,
      h1: (document.querySelector("h1") || {}).innerText || "",
      slot0Empty: !document.querySelector("#file0").files || document.querySelector("#file0").files.length === 0,
      isInitial: /Compare your legal|Compare 2.{0,2}3 gutters/i.test(document.body.innerText),
    }));
    console.log("Refresh state:", JSON.stringify(log.refreshDuringParse, null, 2));

    fs.writeFileSync(path.join(OUT, "compare/05-unhappy-results.json"), JSON.stringify(log, null, 2));
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
