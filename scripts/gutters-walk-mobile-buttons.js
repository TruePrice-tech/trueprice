// Mobile + button-click pass for the gutters dive
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "gutters-walk-2026-04-27");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // Mobile estimate path
  console.log("\n=== MOBILE ESTIMATE ===");
  const m = await browser.newPage();
  await m.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  await m.setRequestInterception(true);
  m.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    else req.continue();
  });
  await m.goto(`${BASE}/gutters-estimate.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(800);
  await m.screenshot({ path: path.join(OUT, "mobile-est-landing.png"), fullPage: true });
  await m.evaluate(() => {
    const street = document.getElementById("addrStreet");
    const city = document.getElementById("addrCity");
    const state = document.getElementById("addrState");
    const zip = document.getElementById("addrZip");
    if (street) { street.value = "17064 Laurelmont Ct"; street.dispatchEvent(new Event("input", {bubbles: true})); }
    if (city) city.value = "Fort Mill";
    if (state) state.value = "SC";
    if (zip) zip.value = "29707";
    const b = document.getElementById("btnEstimate");
    if (b) b.click();
  });
  await sleep(800);
  await m.screenshot({ path: path.join(OUT, "mobile-est-step1.png"), fullPage: true });
  // Walk: aluminum_seamless / 150 / 1 / no
  for (const val of ["aluminum_seamless"]) {
    await m.evaluate((v) => {
      const opts = document.querySelectorAll(".gut-option");
      for (const o of opts) if ((o.getAttribute("data-val") || "").toLowerCase() === v.toLowerCase()) { o.click(); return; }
    }, val);
    await sleep(500);
  }
  // LF input
  await m.evaluate(() => {
    const lf = document.querySelector(".gut-lf-input, input[type='number']");
    if (lf) { lf.value = "150"; lf.dispatchEvent(new Event("input", {bubbles:true})); lf.dispatchEvent(new Event("change", {bubbles:true})); }
    const btns = Array.from(document.querySelectorAll("button"));
    const cont = btns.find(b => /continue|next/i.test(b.textContent));
    if (cont) cont.click();
  });
  await sleep(500);
  for (const v of ["1", "no"]) {
    await m.evaluate((val) => {
      const opts = document.querySelectorAll(".gut-option");
      for (const o of opts) if ((o.getAttribute("data-val") || "") === val) { o.click(); return; }
    }, v);
    await sleep(600);
  }
  await sleep(1500);
  await m.screenshot({ path: path.join(OUT, "mobile-est-result.png"), fullPage: true });

  // Click buttons on result page
  console.log("\n=== RESULT BUTTON CLICKS ===");
  const checkButtons = await m.evaluate(() => {
    const out = [];
    document.querySelectorAll("button, a").forEach((el) => {
      const t = (el.textContent || "").trim();
      if (/save as pdf|share link|back to gutters|home|start over/i.test(t)) {
        out.push({ tag: el.tagName, text: t.slice(0, 80), href: el.getAttribute("href") || "", id: el.id || "", onclick: !!el.onclick });
      }
    });
    return out;
  });
  fs.writeFileSync(path.join(OUT, "result-footer-buttons.json"), JSON.stringify(checkButtons, null, 2));
  console.log("  buttons present:", checkButtons.length, "→ wrote result-footer-buttons.json");

  // Click "Save as PDF" — should trigger window.print or a download
  console.log("\n=== CLICK Save as PDF ===");
  await m.evaluate(() => {
    let target = null;
    document.querySelectorAll("button, a").forEach((el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      if (t === "save as pdf" || /save.*pdf/i.test(t)) target = el;
    });
    if (target) target.click();
  });
  await sleep(1500);
  await m.screenshot({ path: path.join(OUT, "after-save-pdf-click.png"), fullPage: false });

  // Click Share Link
  console.log("\n=== CLICK Share link ===");
  // Stub navigator.share + clipboard before clicking
  await m.evaluateOnNewDocument(() => {
    window.__share_called = null;
    if (!navigator.share) navigator.share = (data) => { window.__share_called = data; return Promise.resolve(); };
    if (!navigator.clipboard) navigator.clipboard = { writeText: (s) => { window.__clip_written = s; return Promise.resolve(); } };
  });
  // Re-click
  await m.evaluate(() => {
    let target = null;
    document.querySelectorAll("button, a").forEach((el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      if (t === "share link" || /share.*link/i.test(t)) target = el;
    });
    if (target) target.click();
  });
  await sleep(1500);
  await m.screenshot({ path: path.join(OUT, "after-share-click.png"), fullPage: false });
  const shareState = await m.evaluate(() => ({ shareCalled: window.__share_called, clipWritten: window.__clip_written }));
  fs.writeFileSync(path.join(OUT, "share-state.json"), JSON.stringify(shareState, null, 2));

  await m.close();

  // Mobile compare path
  console.log("\n=== MOBILE COMPARE ===");
  const mc = await browser.newPage();
  await mc.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  await mc.goto(`${BASE}/compare-gutters-quotes.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(800);
  await mc.screenshot({ path: path.join(OUT, "mobile-cmp-landing.png"), fullPage: true });
  await mc.close();

  // Mobile analyze path
  console.log("\n=== MOBILE ANALYZE LANDING ===");
  const ma = await browser.newPage();
  await ma.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  await ma.goto(`${BASE}/gutters-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(800);
  await ma.screenshot({ path: path.join(OUT, "mobile-anl-landing.png"), fullPage: true });
  await ma.close();

  await browser.close();
  console.log("\nDONE");
})();
