// Exercise the email-capture widget end-to-end on auto-repair result page.
// Uploads the Jeep fixture, waits for result, types a test email,
// clicks Notify me, captures network response + final UI state.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const FIX = path.join(ROOT, "test-quotes", "auto-images", "07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg");
const OUT = path.join(ROOT, "output", "overnight-walks-2026-04-28", "auto-repair");
const TEST_EMAIL = `lane+overnight-walk-test-${Date.now()}@woogoro.com`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const networkLog = [];
  page.on("response", async (resp) => {
    const url = resp.url();
    if (url.includes("/api/email-signup")) {
      try {
        const body = await resp.json();
        networkLog.push({ url, status: resp.status(), body });
      } catch (e) {
        networkLog.push({ url, status: resp.status(), body: "<not json>" });
      }
    }
  });

  console.log("Navigating to auto-repair analyzer...");
  await page.goto("https://woogoro.com/auto-repair.html?path=quote", { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  const fileInput = await page.waitForSelector("#fileInput", { timeout: 15000, visible: false });
  await fileInput.uploadFile(FIX);
  console.log("Uploaded Jeep fixture, waiting for result...");
  await page.waitForFunction(() => !!document.getElementById("tpConfirmPriceBtn") || !!document.querySelector(".ar-verdict-card"), { timeout: 120000 });
  await sleep(2000);
  const confirmed = await page.evaluate(() => {
    const btn = document.getElementById("tpConfirmPriceBtn");
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (confirmed) {
    await page.waitForFunction(() => !!document.querySelector(".ar-verdict-card"), { timeout: 60000 }).catch(() => {});
    await sleep(3000);
  }

  console.log("Result rendered. Looking for email capture widget...");
  const widgetVisible = await page.evaluate(() => {
    const card = document.querySelector(".tp-em");
    if (!card) return { found: false };
    return {
      found: true,
      vertical: card.getAttribute("data-em-vertical"),
      btnText: (card.querySelector(".tp-em-btn") || {}).textContent || "",
      inputType: (card.querySelector(".tp-em-input") || {}).type || "",
    };
  });
  console.log("Widget:", JSON.stringify(widgetVisible));
  if (!widgetVisible.found) {
    console.log("FAIL: email capture widget not on page");
    fs.writeFileSync(path.join(OUT, "email-capture-test-result.json"), JSON.stringify({ error: "widget not found", networkLog }, null, 2));
    await browser.close();
    return;
  }

  // Scroll widget into view and screenshot pre-submit
  await page.evaluate(() => document.querySelector(".tp-em").scrollIntoView({ block: "center" }));
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, "email-capture-01-before-submit.png"), fullPage: false });

  console.log(`Submitting test email ${TEST_EMAIL}...`);
  await page.evaluate((email) => {
    const input = document.querySelector(".tp-em-input");
    input.value = email;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, TEST_EMAIL);
  await page.evaluate(() => document.querySelector(".tp-em-btn").click());
  await sleep(4000);

  // Capture post-submit state
  await page.screenshot({ path: path.join(OUT, "email-capture-02-after-submit.png"), fullPage: false });
  const after = await page.evaluate(() => {
    const card = document.querySelector(".tp-em");
    if (!card) return { state: "card removed" };
    const thanks = card.querySelector(".tp-em-thanks");
    const errEl = card.querySelector(".tp-em-err");
    const btn = card.querySelector(".tp-em-btn");
    return {
      hasThanks: !!thanks,
      thanksText: thanks ? thanks.innerText : null,
      hasError: errEl && !errEl.hidden,
      errorText: errEl && !errEl.hidden ? errEl.innerText : null,
      btnText: btn ? btn.textContent : null,
      btnDisabled: btn ? btn.disabled : null,
    };
  });
  console.log("After:", JSON.stringify(after, null, 2));
  console.log("Network log:", JSON.stringify(networkLog, null, 2));

  fs.writeFileSync(path.join(OUT, "email-capture-test-result.json"), JSON.stringify({ testEmail: TEST_EMAIL, widgetVisible, after, networkLog }, null, 2));

  await browser.close();
  console.log("DONE");
})();
