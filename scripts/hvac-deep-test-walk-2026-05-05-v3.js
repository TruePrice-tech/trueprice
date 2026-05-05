// HVAC v3 walk — wraps each section in try/catch so one OOM/crash doesn't
// kill the whole run. Focused on surfaces v1 + v2 missed.
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = "https://woogoro.com";
const OUT = path.resolve(__dirname, "..", "output", "hvac-deep-test-2026-05-05-v2");
fs.mkdirSync(OUT, { recursive: true });

const FX = {
  f6: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "10-8k-for-mitsubishi-mini-split-leak-detection-just-t.png"),
  f7: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "09-every-quote-10-total-ive-gotten-for-a-heat-pump-in.png"),
  f3: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "comparison-ac-01-low.png"),
  f5: path.resolve(__dirname, "..", "test-quotes", "hvac-images", "comparison-ac-03-high.png"),
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
  await $w(500);
  try { await page.screenshot({ path: path.join(OUT, label + ".png"), fullPage: true }); } catch (e) { console.log("screenshot fail", label, e.message); }
  try {
    const data = await page.evaluate(() => {
      const interactive = [];
      document.querySelectorAll("a, button, input, textarea, select").forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        interactive.push({ tag: el.tagName, type: el.type || null, id: el.id || null, text: (el.innerText || el.value || "").slice(0, 80).trim(), href: el.href || null });
      });
      return { url: location.href, title: document.title, bodyText: document.body.innerText.slice(0, 6000), interactive: interactive.slice(0, 80) };
    });
    fs.writeFileSync(path.join(OUT, label + ".json"), JSON.stringify(data, null, 2));
  } catch (e) { console.log("json fail", label, e.message); }
}
async function safeAnalyze(browser, fxKey, fxPath, prefix) {
  let page;
  try {
    page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/hvac-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(fxPath);
    await page.waitForFunction(
      () => !!document.getElementById("tpConfirmPriceBtn") || !!document.getElementById("tpManualPriceBtn") || !!document.querySelector(".verdict-price") || !!document.getElementById("tpHardRejectStartOver"),
      { timeout: 150000 }
    ).catch(() => {});
    await $w(1500);
    await snapshot(page, prefix + "-confirm");
    if (await page.$("#tpConfirmPriceBtn")) {
      await page.click("#tpConfirmPriceBtn").catch(() => {});
      await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => {});
      await $w(2500);
    } else if (await page.$("#tpManualPriceBtn")) {
      // for fixtures the analyzer can't extract price from
      await page.type("#tpManualPrice", "8000").catch(() => {});
      await page.click("#tpManualPriceBtn").catch(() => {});
      await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => {});
      await $w(2500);
    }
    await snapshot(page, prefix + "-result");
  } catch (e) {
    console.log("safeAnalyze " + prefix + " ERROR:", e.message);
    try { fs.writeFileSync(path.join(OUT, prefix + "-error.txt"), e.message + "\n" + e.stack); } catch (e2) {}
  } finally {
    try { if (page) await page.close(); } catch (e) {}
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--max-old-space-size=4096"],
    defaultViewport: { width: 1440, height: 900 },
  });

  console.log("== ANALYZE f7 (table) ==");
  await safeAnalyze(browser, "f7", FX.f7, "ana-f7");

  console.log("== ANALYZE f6 retry ==");
  await safeAnalyze(browser, "f6", FX.f6, "ana-f6-v3");

  // ESTIMATE WIZARD — patient, click-by-click
  console.log("== ESTIMATE WIZARD ==");
  let page;
  try {
    page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/hvac-estimate.html", { waitUntil: "networkidle2", timeout: 60000 });
    await passCheckpoint(page);
    await $w(2000);
    await snapshot(page, "est-w1");

    await page.evaluate(() => {
      const z = document.querySelector('input[id*="zip" i], input[name*="zip" i], input[placeholder*="ZIP" i], input[placeholder*="ddress" i]');
      if (z) { z.value = "29710"; z.dispatchEvent(new Event("input", { bubbles: true })); z.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    await $w(500);
    // Click any button that looks like submit
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find(b => /get free estimate|get estimate|continue|start/i.test(b.innerText));
      if (target) target.click();
    });
    await $w(2500);
    await snapshot(page, "est-w2-after-zip");

    // wizard step 1: System type
    await page.evaluate(() => {
      const opts = document.querySelectorAll(".hvac-option");
      for (const o of opts) {
        if (/full system|central ac/i.test(o.innerText)) { o.click(); return; }
      }
    });
    await $w(700);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /next|continue|see (?:estimate|results)|done/i.test(b.innerText));
      if (t) t.click();
    });
    await $w(1200);
    await snapshot(page, "est-w3-system");

    // SEER tier
    await page.evaluate(() => {
      const opts = document.querySelectorAll(".hvac-option");
      for (const o of opts) {
        if (/16 SEER|mid/i.test(o.innerText)) { o.click(); return; }
      }
    });
    await $w(700);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /next|continue/i.test(b.innerText));
      if (t) t.click();
    });
    await $w(1200);
    await snapshot(page, "est-w4-seer");

    // Home size
    await page.evaluate(() => {
      const opts = document.querySelectorAll(".hvac-option");
      for (const o of opts) {
        if (/2,000|2000/i.test(o.innerText)) { o.click(); return; }
      }
    });
    await $w(700);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /next|continue/i.test(b.innerText));
      if (t) t.click();
    });
    await $w(1500);
    await snapshot(page, "est-w5-size");

    // Ductwork
    await page.evaluate(() => {
      const opts = document.querySelectorAll(".hvac-option");
      for (const o of opts) {
        if (/good|existing/i.test(o.innerText)) { o.click(); return; }
      }
    });
    await $w(700);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const t = btns.find(b => /see (?:estimate|results)|done|finish|estimate/i.test(b.innerText));
      if (t) t.click();
    });
    await $w(3500);
    await snapshot(page, "est-w6-final-result");
  } catch (e) {
    console.log("est wizard ERROR:", e.message);
  } finally {
    try { if (page) await page.close(); } catch (e) {}
  }

  // COMPARE — 240s wait
  console.log("== COMPARE ==");
  let cpage;
  try {
    cpage = await browser.newPage();
    cpage.setDefaultTimeout(300000);
    await cpage.setViewport({ width: 1440, height: 900 });
    await cpage.goto(BASE + "/compare-hvac-quotes.html", { waitUntil: "networkidle2" });
    await passCheckpoint(cpage);
    await $w(2000);
    await snapshot(cpage, "cmp-01-initial");
    const inputs = await cpage.$$('input[type="file"]');
    if (inputs[0]) await inputs[0].uploadFile(FX.f3);
    if (inputs[1]) await inputs[1].uploadFile(FX.f5);
    await $w(3000);
    await snapshot(cpage, "cmp-02-uploaded");
    await cpage.waitForFunction(
      () => {
        const b = document.getElementById("compareBtn");
        if (!b) return false;
        return !/still parsing/i.test(b.innerText) && !b.disabled;
      },
      { timeout: 270000 }
    ).catch(() => {});
    await snapshot(cpage, "cmp-03-parse-state");
    const cbtn = await cpage.$("#compareBtn");
    if (cbtn) await cbtn.click().catch(() => {});
    await cpage.waitForFunction(
      () => /best value|cheaper|saves|recommend|winner|verdict/i.test(document.body.innerText),
      { timeout: 60000 }
    ).catch(() => {});
    await $w(3000);
    await snapshot(cpage, "cmp-04-result");
  } catch (e) {
    console.log("compare ERROR:", e.message);
  } finally {
    try { if (cpage) await cpage.close(); } catch (e) {}
  }

  // CTA CLICKS on f5 result page
  console.log("== F5 CTA CLICKS ==");
  let ctapage;
  try {
    ctapage = await browser.newPage();
    ctapage.setDefaultTimeout(120000);
    await ctapage.setViewport({ width: 1440, height: 900 });
    await ctapage.goto(BASE + "/hvac-quote-analyzer.html", { waitUntil: "networkidle2" });
    await passCheckpoint(ctapage);
    await $w(2000);
    const inp = await ctapage.$('input[type="file"]');
    await inp.uploadFile(FX.f5);
    await ctapage.waitForFunction(
      () => !!document.getElementById("tpConfirmPriceBtn") || !!document.querySelector(".verdict-price"),
      { timeout: 90000 }
    ).catch(() => {});
    if (await ctapage.$("#tpConfirmPriceBtn")) {
      await ctapage.click("#tpConfirmPriceBtn").catch(() => {});
      await ctapage.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => {});
      await $w(2500);
    }
    // Click "Save as PDF"
    let clicked = false;
    const btns = await ctapage.$$("button");
    for (const b of btns) {
      const text = await ctapage.evaluate(el => el.innerText || "", b);
      if (/save as pdf/i.test(text)) {
        await b.click().catch(() => {});
        await $w(2500);
        await snapshot(ctapage, "cta-save-pdf");
        clicked = true;
        break;
      }
    }
    if (!clicked) console.log("Save as PDF button not found");

    // Click "Share link"
    for (const b of btns) {
      const text = await ctapage.evaluate(el => el.innerText || "", b);
      if (/share link/i.test(text)) {
        await b.click().catch(() => {});
        await $w(2000);
        await snapshot(ctapage, "cta-share-link");
        break;
      }
    }
  } catch (e) {
    console.log("CTA ERROR:", e.message);
  } finally {
    try { if (ctapage) await ctapage.close(); } catch (e) {}
  }

  // Mobile
  console.log("== MOBILE ANALYZE ==");
  let mpage;
  try {
    mpage = await browser.newPage();
    mpage.setDefaultTimeout(120000);
    await mpage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mpage.goto(BASE + "/hvac-quote-analyzer.html", { waitUntil: "networkidle2" });
    await passCheckpoint(mpage);
    await $w(2000);
    await snapshot(mpage, "mobile-ana-01-initial");
    const inp = await mpage.$('input[type="file"]');
    await inp.uploadFile(FX.f5);
    await mpage.waitForFunction(
      () => !!document.getElementById("tpConfirmPriceBtn") || !!document.querySelector(".verdict-price"),
      { timeout: 90000 }
    ).catch(() => {});
    await $w(1500);
    if (await mpage.$("#tpConfirmPriceBtn")) {
      await mpage.click("#tpConfirmPriceBtn").catch(() => {});
      await mpage.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => {});
      await $w(2500);
    }
    await snapshot(mpage, "mobile-ana-02-result");
  } catch (e) {
    console.log("mobile ERROR:", e.message);
  } finally {
    try { if (mpage) await mpage.close(); } catch (e) {}
  }

  await browser.close();
  console.log("Done. Output:", OUT);
})();
