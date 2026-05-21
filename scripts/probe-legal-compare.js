// Probe why compare-legal didn't reject roofing fixture.
const puppeteer = require("puppeteer");
const path = require("path");

const URL = "https://woogoro.com/compare-legal-quotes.html";
const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");

function $w(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  page.on("console", msg => console.log("[browser]", msg.text()));

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await $w(4000);

  // Inject a probe BEFORE upload that records what tpEnforceVerticalMatch does
  await page.evaluate(() => {
    const origMatch = window.tpEnforceVerticalMatch;
    window.__tpProbeCalls = [];
    window.tpEnforceVerticalMatch = function (currentVertical, ocrText, appRootEl) {
      const detected = window.detectVerticalFromText ? window.detectVerticalFromText(ocrText || "") : null;
      const result = origMatch.apply(this, arguments);
      window.__tpProbeCalls.push({
        currentVertical,
        ocrTextLen: (ocrText || "").length,
        ocrTextSample: (ocrText || "").slice(0, 200),
        detected: detected ? { vertical: detected.vertical, all: detected.all } : null,
        rejectFired: result === true,
      });
      console.log("PROBE: vertical=" + currentVertical + " ocrLen=" + (ocrText || "").length + " result=" + result);
      console.log("PROBE detected: " + JSON.stringify(detected && detected.all));
      return result;
    };
  });

  const inps = await page.$$('input[type=file]');
  console.log("Input count:", inps.length);
  await inps[0].uploadFile(FIX_ROOF);

  // Wait up to 2 minutes for either reject or parsed state
  for (let i = 0; i < 60; i++) {
    await $w(2000);
    const state = await page.evaluate(() => ({
      probeCalls: window.__tpProbeCalls || [],
      h1: (Array.from(document.querySelectorAll("h1")).find(h => /This is not/i.test(h.innerText)) || {}).innerText,
      slot0Text: (document.getElementById("slot0") || {}).innerText,
    }));
    if (state.probeCalls.length > 0 || state.h1) {
      console.log("STATE", JSON.stringify(state, null, 2));
      break;
    }
  }
  await $w(2000);
  const final = await page.evaluate(() => ({
    probeCalls: window.__tpProbeCalls || [],
    h1: (Array.from(document.querySelectorAll("h1")).find(h => /This is not/i.test(h.innerText)) || {}).innerText,
  }));
  console.log("FINAL", JSON.stringify(final, null, 2));

  await browser.close();
})();
