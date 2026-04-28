// Overnight 2026-04-28 auto-repair re-walk: items #9-#12, #14, #22.
// Walks live woogoro.com, screenshots every step, dumps text for human read.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "overnight-walks-2026-04-28", "auto-repair");
const FIX = path.join(ROOT, "test-quotes", "auto-images");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function newPage(browser, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36");
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|verdict|undefined|TP_Engine|400|500|warn/i.test(t)) console.log(`  [${label}]`, m.type(), t.substring(0, 280));
  });
  page.on("pageerror", (e) => console.log(`  [${label} PAGEERR]`, e.message.substring(0, 280)));
  return page;
}

async function dumpAll(page, name) {
  const txt = await page.evaluate(() => {
    const el = document.getElementById("quoteApp") || document.getElementById("estimateResult") || document.querySelector("main") || document.body;
    return el ? (el.innerText || "").slice(0, 12000) : "(no el)";
  });
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

async function snapshotOcrAndParsed(page, name) {
  const data = await page.evaluate(() => {
    const ocr = window.__TP_LAST_OCR_TEXT || "";
    const lastApi = window.__TP_LAST_API || null;
    const lastParsed = window.__TP_LAST_PARSED || null;
    return { ocrLen: ocr.length, ocr: ocr.substring(0, 4000), lastApi, lastParsed };
  });
  fs.writeFileSync(path.join(OUT, `${name}-debug.json`), JSON.stringify(data, null, 2));
}

async function runAnalyze(browser, label, fixturePath) {
  const page = await newPage(browser, label);
  console.log(`\n=== ANALYZE: ${label} (${path.basename(fixturePath)}) ===`);
  await page.goto(`${BASE}/auto-repair.html?path=quote`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2500);
  await shot(page, `${label}-01-upload-page`);

  const fileInput = await page.waitForSelector("#fileInput", { timeout: 15000, visible: false });
  await fileInput.uploadFile(fixturePath);
  console.log(`  uploaded ${path.basename(fixturePath)}`);

  try {
    await page.waitForFunction(() => {
      return !!document.getElementById("tpConfirmPriceBtn") ||
             !!document.querySelector(".ar-verdict-card") ||
             /couldn|enter the quote total|fallback/i.test(document.body.innerText);
    }, { timeout: 120000 });
  } catch (e) {
    console.log(`  [analyze] timeout: ${e.message}`);
  }
  await sleep(1500);
  await shot(page, `${label}-02-after-parse`, true);
  await dumpAll(page, `${label}-02-after-parse`);
  await snapshotOcrAndParsed(page, `${label}-02-after-parse`);

  const detected = await page.evaluate(() => {
    const ocr = window.__TP_LAST_OCR_TEXT || "";
    const priceEl = document.querySelector("#quoteApp [style*='font-size:36px']") || document.querySelector("#quoteApp div[style*='color:#166534']");
    const priceTxt = priceEl ? priceEl.innerText : "(no price element)";
    return { priceShown: priceTxt, ocrLen: ocr.length, ocrSample: ocr.substring(0, 2000) };
  });
  fs.writeFileSync(path.join(OUT, `${label}-03-detected.txt`), JSON.stringify(detected, null, 2));
  console.log(`  detected price: ${detected.priceShown}`);
  console.log(`  ocr ${detected.ocrLen} chars`);

  const confirmed = await page.evaluate(() => {
    const btn = document.getElementById("tpConfirmPriceBtn");
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (confirmed) {
    console.log(`  clicked confirm`);
    await page.waitForFunction(() => !!document.querySelector(".ar-verdict-card"), { timeout: 60000 }).catch(() => {});
    await sleep(2500);
  }
  await shot(page, `${label}-04-result`, true);
  await dumpAll(page, `${label}-04-result`);

  // Capture per-line breakdown if rendered
  const lineBreakdown = await page.evaluate(() => {
    const lines = [];
    document.querySelectorAll(".ar-line-item, .repair-line, [class*='line-item']").forEach((el) => {
      lines.push(el.innerText.replace(/\s+/g, " ").trim());
    });
    return lines;
  });
  fs.writeFileSync(path.join(OUT, `${label}-05-line-items.txt`), lineBreakdown.join("\n"));

  // Email-capture widget verification (item #22)
  const emailCapture = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="email"]'));
    const present = inputs.length > 0;
    const visible = inputs.some((i) => i.offsetParent !== null);
    const surrounding = inputs.length ? inputs[0].closest("div, section, form")?.innerText?.slice(0, 400) || "" : "";
    return { present, visible, count: inputs.length, surrounding };
  });
  fs.writeFileSync(path.join(OUT, `${label}-06-email-capture.json`), JSON.stringify(emailCapture, null, 2));

  await page.close();
}

async function runCompare(browser, label, fixtures) {
  const page = await newPage(browser, label);
  console.log(`\n=== COMPARE: ${label} ===`);
  await page.goto(`${BASE}/compare-auto-quotes.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  await shot(page, `${label}-01-upload-page`);

  for (let i = 0; i < fixtures.length; i++) {
    const fileInput = await page.$(`#file${i}`);
    if (!fileInput) { console.log(`  no file${i}`); break; }
    await fileInput.uploadFile(fixtures[i]);
    console.log(`  uploaded slot ${i}: ${path.basename(fixtures[i])}`);
    try {
      await page.waitForFunction((idx) => {
        const slot = document.getElementById("slot" + idx);
        return slot && (slot.classList.contains("uploaded") || slot.querySelector(".slot-error"));
      }, { timeout: 120000 }, i);
    } catch (e) { console.log(`  [cmp] slot ${i} timeout: ${e.message}`); }
    await sleep(1000);
  }
  await shot(page, `${label}-02-after-uploads`, true);

  const compareReady = await page.evaluate(() => {
    const btn = document.getElementById("compareBtn");
    return btn ? !btn.disabled : false;
  });
  console.log(`  compare button enabled: ${compareReady}`);
  if (compareReady) {
    await page.evaluate(() => document.getElementById("compareBtn").click());
    await sleep(4000);
  }
  await shot(page, `${label}-03-results`, true);
  await dumpAll(page, `${label}-03-results`);

  // Extract Best Value verdict + per-quote scores for item #14
  const verdict = await page.evaluate(() => {
    const bestVal = document.querySelector(".best-value-card, [class*='best-value'], [data-best-value]");
    const scores = Array.from(document.querySelectorAll("[class*='quote-score'], .quote-card-score, [data-score]")).map((el) => el.innerText.trim());
    return {
      bestValueText: bestVal ? bestVal.innerText.slice(0, 800) : null,
      scores,
    };
  });
  fs.writeFileSync(path.join(OUT, `${label}-04-verdict.json`), JSON.stringify(verdict, null, 2));

  await page.close();
}

async function runEstimate(browser, label, opts) {
  const page = await newPage(browser, label);
  console.log(`\n=== ESTIMATE: ${label} ===`);
  await page.goto(`${BASE}/auto-repair.html?path=estimate`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  await shot(page, `${label}-01-landing`);

  // Fill the estimate form via direct DOM (avoids autocomplete intercepts)
  await page.evaluate((o) => {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    setVal("zipInput", o.zip || "29707");
    setVal("makeSelect", o.make);
    setVal("modelSelect", o.model);
    setVal("yearInput", o.year || "2019");
    setVal("repairSelect", o.repair);
    setVal("shopTypeSelect", o.shop);
  }, opts);
  await sleep(800);
  await shot(page, `${label}-02-form-filled`, true);

  await page.evaluate(() => {
    const btn = document.getElementById("estimateBtn") || document.querySelector('button[type="submit"]');
    if (btn) btn.click();
  });
  await page.waitForFunction(() => /\$/.test(document.body.innerText) && /per hour|labor|estimate range/i.test(document.body.innerText), { timeout: 60000 }).catch(() => {});
  await sleep(2500);
  await shot(page, `${label}-03-result`, true);
  await dumpAll(page, `${label}-03-result`);
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    // ANALYZE PATH (items #9, #10, #11 — Jeep; item #12 — Audi)
    await runAnalyze(browser, "ana-jeep", path.join(FIX, "07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg"));
    await runAnalyze(browser, "ana-audi", path.join(FIX, "09-am-i-crazy-or-is-this-quote.jpg"));

    // COMPARE PATH (item #14 — Best Value scope detection)
    await runCompare(browser, "cmp-3way-brake", [
      path.join(FIX, "comparison-brake-01-shop-a-low.png"),
      path.join(FIX, "comparison-brake-02-shop-b-mid.png"),
      path.join(FIX, "comparison-brake-03-shop-c-high.png"),
    ]);
    await runCompare(browser, "cmp-2way-real-mix", [
      path.join(FIX, "07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg"),
      path.join(FIX, "09-am-i-crazy-or-is-this-quote.jpg"),
    ]);

    // ESTIMATE PATH — sanity, default state, Charlotte metro floor
    await runEstimate(browser, "est-jeep-charlotte", {
      zip: "29707", make: "Jeep", model: "Grand Cherokee", year: "2019", repair: "brake-pads-front", shop: "indie",
    });
    await runEstimate(browser, "est-audi-luxury", {
      zip: "29707", make: "Audi", model: "Q5", year: "2020", repair: "alignment", shop: "dealer",
    });
  } catch (e) {
    console.error("WALK ERROR:", e);
  } finally {
    await browser.close();
  }
  console.log("\nDONE auto-repair walk.");
})();
