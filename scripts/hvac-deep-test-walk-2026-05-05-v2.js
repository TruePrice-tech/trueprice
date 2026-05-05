// HVAC deep test 2026-05-05 v2 walk: under-walked surfaces from round 1.
// - f2/f6/f7 analyze paths (round 1 only walked f1 + f5)
// - Full /hvac-estimate wizard end-to-end
// - Compare with 240s wait
// - Click every CTA on the f5 result page
// - Mobile viewport for analyze
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = "https://woogoro.com";
const OUT = path.resolve(__dirname, "..", "output", "hvac-deep-test-2026-05-05-v2");
fs.mkdirSync(OUT, { recursive: true });

const FX = {
  f1: path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-clean-invoice.jpeg"),
  f2: path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg"),
  f3: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "comparison-ac-01-low.png"),
  f4: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "comparison-ac-02-mid.png"),
  f5: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "comparison-ac-03-high.png"),
  f6: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "10-8k-for-mitsubishi-mini-split-leak-detection-just-t.png"),
  f7: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "09-every-quote-10-total-ive-gotten-for-a-heat-pump-in.png"),
  messy3: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "messy-comparison-ac-01-low.jpg"),
};

function $w(ms) { return new Promise(r => setTimeout(r, ms)); }

async function passCheckpoint(page) {
  for (let i = 0; i < 20; i++) {
    await $w(1000);
    try {
      const isCheck = await page.evaluate(() => /Vercel Security Checkpoint|verifying your browser/i.test(document.body?.innerText || ""));
      if (!isCheck) return true;
    } catch (e) {}
  }
  return false;
}

async function snapshot(page, label) {
  await $w(800);
  await page.screenshot({ path: path.join(OUT, label + ".png"), fullPage: true });
  const data = await page.evaluate(() => {
    const interactive = [];
    document.querySelectorAll("a, button, input, textarea, select, [role=button]").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      interactive.push({
        tag: el.tagName, type: el.type || null, id: el.id || null,
        text: (el.innerText || el.value || "").slice(0, 80).trim(),
        href: el.href || null,
      });
    });
    return {
      url: location.href, title: document.title,
      bodyText: document.body.innerText.slice(0, 5000),
      interactive: interactive.slice(0, 80),
    };
  });
  fs.writeFileSync(path.join(OUT, label + ".json"), JSON.stringify(data, null, 2));
  return data;
}

async function analyzeFixture(browser, fxKey, fxPath, label) {
  const page = await browser.newPage();
  page.setDefaultTimeout(150000);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/hvac-quote-analyzer.html", { waitUntil: "networkidle2" });
  await passCheckpoint(page);
  await $w(2000);
  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(fxPath);
  await page.waitForFunction(
    () => !!document.getElementById("tpConfirmPriceBtn") || !!document.getElementById("tpManualPriceBtn") || !!document.querySelector(".verdict-price") || !!document.getElementById("tpHardRejectStartOver"),
    { timeout: 120000 }
  ).catch(() => {});
  await $w(1500);
  await snapshot(page, label + "-step1-confirm-or-result");
  if (await page.$("#tpConfirmPriceBtn")) {
    await page.click("#tpConfirmPriceBtn");
    await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => {});
    await $w(2000);
  }
  await snapshot(page, label + "-step2-result");
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    defaultViewport: { width: 1440, height: 900 },
  });

  // ============ ANALYZE f2 (coil quote) ============
  console.log("\n== ANALYZE f2 (coil) ==");
  await analyzeFixture(browser, "f2", FX.f2, "ana-f2");

  // ============ ANALYZE f6 (mini-split leak) ============
  console.log("\n== ANALYZE f6 (mini-split leak) ==");
  await analyzeFixture(browser, "f6", FX.f6, "ana-f6");

  // ============ ANALYZE f7 (heat-pump comparison table) ============
  console.log("\n== ANALYZE f7 (table) ==");
  await analyzeFixture(browser, "f7", FX.f7, "ana-f7");

  // ============ ANALYZE messy-01 (skewed/rotated f3 OCR-degraded) ============
  console.log("\n== ANALYZE messy-comparison-01 ==");
  await analyzeFixture(browser, "messy3", FX.messy3, "ana-messy3");

  // ============ FULL ESTIMATE WIZARD ============
  console.log("\n== ESTIMATE WIZARD ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/hvac-estimate.html", { waitUntil: "networkidle2" });
    await passCheckpoint(page);
    await $w(2000);
    await snapshot(page, "est-w1-initial");

    // Fill 29710 and submit to advance
    await page.evaluate(() => {
      const z = document.querySelector('input[id*="zip" i], input[name*="zip" i], input[placeholder*="ZIP" i]');
      if (z) { z.value = "29710"; z.dispatchEvent(new Event("input", { bubbles: true })); z.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    const btnInit = await page.$("button");
    const allBtns = await page.$$("button");
    for (const b of allBtns) {
      const text = await page.evaluate(el => el.innerText || "", b);
      if (/get free estimate|estimate|continue|next/i.test(text)) {
        await b.click().catch(() => {});
        break;
      }
    }
    await $w(2000);
    await snapshot(page, "est-w2-after-zip");

    // Wizard step: select system type "Full System"
    await page.evaluate(() => {
      const opts = document.querySelectorAll(".hvac-option");
      for (const o of opts) {
        if (/full system|central ac/i.test(o.innerText)) { o.click(); break; }
      }
    });
    await $w(800);
    const advance = async () => {
      const btns = await page.$$("button");
      for (const b of btns) {
        const text = await page.evaluate(el => el.innerText || "", b);
        if (/next|continue|see (?:estimate|results)|done/i.test(text)) {
          await b.click().catch(() => {});
          return true;
        }
      }
      return false;
    };
    await advance();
    await $w(1200);
    await snapshot(page, "est-w3-step-system");

    // SEER tier
    await page.evaluate(() => {
      const opts = document.querySelectorAll(".hvac-option");
      for (const o of opts) {
        if (/16 SEER|mid/i.test(o.innerText)) { o.click(); break; }
      }
    });
    await $w(600);
    await advance();
    await $w(1200);
    await snapshot(page, "est-w4-step-seer");

    // Home size
    await page.evaluate(() => {
      const opts = document.querySelectorAll(".hvac-option");
      for (const o of opts) {
        if (/2000|2,000|2.5/i.test(o.innerText)) { o.click(); break; }
      }
    });
    await $w(600);
    await advance();
    await $w(1500);
    await snapshot(page, "est-w5-step-size");

    // Ductwork
    await page.evaluate(() => {
      const opts = document.querySelectorAll(".hvac-option");
      for (const o of opts) {
        if (/good|existing/i.test(o.innerText)) { o.click(); break; }
      }
    });
    await $w(600);
    await advance();
    await $w(2500);
    await snapshot(page, "est-w6-step-duct");

    // If still on a step, try one more advance
    await advance();
    await $w(3000);
    await snapshot(page, "est-w7-final");

    await page.close();
  }

  // ============ COMPARE with 240s wait ============
  console.log("\n== COMPARE (240s wait) ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(240000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/compare-hvac-quotes.html", { waitUntil: "networkidle2" });
    await passCheckpoint(page);
    await $w(2000);
    await snapshot(page, "cmp-01-initial");

    const inputs = await page.$$('input[type="file"]');
    if (inputs[0]) await inputs[0].uploadFile(FX.f3);
    if (inputs[1]) await inputs[1].uploadFile(FX.f5);
    await $w(3000);
    await snapshot(page, "cmp-02-uploaded");

    // Wait for compareBtn to NOT show "Still parsing" — i.e. parse completed
    await page.waitForFunction(
      () => {
        const b = document.getElementById("compareBtn");
        if (!b) return false;
        return !/still parsing/i.test(b.innerText) && !b.disabled;
      },
      { timeout: 240000 }
    ).catch(() => {});
    await snapshot(page, "cmp-03-parse-complete-or-timeout");

    const btn = await page.$("#compareBtn");
    if (btn) await btn.click().catch(() => {});
    await page.waitForFunction(
      () => /verdict|winner|cheaper|saves|best value|recommend/i.test(document.body.innerText),
      { timeout: 60000 }
    ).catch(() => {});
    await $w(3000);
    await snapshot(page, "cmp-04-result");

    await page.close();
  }

  // ============ MOBILE ANALYZE ============
  console.log("\n== MOBILE ANALYZE (390x844) ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(BASE + "/hvac-quote-analyzer.html", { waitUntil: "networkidle2" });
    await passCheckpoint(page);
    await $w(2000);
    await snapshot(page, "mobile-ana-01-initial");

    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(FX.f5);
    await page.waitForFunction(
      () => !!document.getElementById("tpConfirmPriceBtn") || !!document.querySelector(".verdict-price"),
      { timeout: 90000 }
    ).catch(() => {});
    await $w(1500);
    await snapshot(page, "mobile-ana-02-confirm");
    if (await page.$("#tpConfirmPriceBtn")) {
      await page.click("#tpConfirmPriceBtn");
      await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => {});
      await $w(2000);
    }
    await snapshot(page, "mobile-ana-03-result");
    await page.close();
  }

  // ============ MOBILE ESTIMATE ============
  console.log("\n== MOBILE ESTIMATE (390x844) ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(BASE + "/hvac-estimate.html", { waitUntil: "networkidle2" });
    await passCheckpoint(page);
    await $w(2000);
    await snapshot(page, "mobile-est-01-initial");
    await page.close();
  }

  await browser.close();
  console.log("\nDone. Output:", OUT);
})();
