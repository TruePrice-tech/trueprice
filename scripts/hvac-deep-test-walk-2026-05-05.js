// HVAC deep test 2026-05-05 walk: estimate / analyze / compare
// Captures fullPage screenshots + interactive snapshot at each step.
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = "https://woogoro.com";
const OUT = path.resolve(__dirname, "..", "output", "hvac-deep-test-2026-05-05");
fs.mkdirSync(OUT, { recursive: true });

const F3 = path.resolve(__dirname, "..", "test-quotes", "hvac-images", "comparison-ac-01-low.png");
const F4 = path.resolve(__dirname, "..", "test-quotes", "hvac-images", "comparison-ac-02-mid.png");
const F5 = path.resolve(__dirname, "..", "test-quotes", "hvac-images", "comparison-ac-03-high.png");
const F1 = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-clean-invoice.jpeg");

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
        tag: el.tagName,
        type: el.type || null,
        id: el.id || null,
        text: (el.innerText || el.value || "").slice(0, 80).trim(),
        href: el.href || null,
      });
    });
    return {
      url: location.href,
      title: document.title,
      bodyText: document.body.innerText.slice(0, 4000),
      interactive: interactive.slice(0, 80),
    };
  });
  fs.writeFileSync(path.join(OUT, label + ".json"), JSON.stringify(data, null, 2));
  return data;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    defaultViewport: { width: 1440, height: 900 },
  });

  // ============ ESTIMATE PATH ============
  console.log("\n== ESTIMATE PATH ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE + "/hvac-estimate.html", { waitUntil: "networkidle2" });
    await passCheckpoint(page);
    await $w(2000);
    await snapshot(page, "est-01-initial");

    // Fill ZIP + try submit empty/wrong (unhappy path)
    await page.evaluate(() => {
      const z = document.querySelector('input[id*="zip" i], input[name*="zip" i], input[placeholder*="ZIP" i]');
      if (z) { z.value = ""; z.dispatchEvent(new Event("input", { bubbles: true })); z.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    const btnEmpty = await page.$("#btnEstimate, button[type='submit'], button:not([type='button'])");
    if (btnEmpty) await btnEmpty.click().catch(() => {});
    await $w(1500);
    await snapshot(page, "est-02-empty-submit");

    // Fill in plausible inputs: 29710 (Fort Mill SC), full system, 4-ton, 16 SEER
    await page.evaluate(() => {
      const z = document.querySelector('input[id*="zip" i], input[name*="zip" i], input[placeholder*="ZIP" i]');
      if (z) { z.value = "29710"; z.dispatchEvent(new Event("input", { bubbles: true })); z.dispatchEvent(new Event("change", { bubbles: true })); }
      // System type select
      const sysSel = document.querySelector('select[id*="system" i], select[name*="system" i]');
      if (sysSel) {
        const opts = Array.from(sysSel.options || []);
        const target = opts.find(o => /full[\s_-]?system|central[\s_-]?ac/i.test(o.text || o.value));
        if (target) { sysSel.value = target.value; sysSel.dispatchEvent(new Event("change", { bubbles: true })); }
      }
      // SEER
      const seer = document.querySelector('input[id*="seer" i], select[id*="seer" i]');
      if (seer) {
        if (seer.tagName === "SELECT") {
          const o = Array.from(seer.options).find(o => /\b16\b/.test(o.text || o.value));
          if (o) { seer.value = o.value; seer.dispatchEvent(new Event("change", { bubbles: true })); }
        } else {
          seer.value = "16"; seer.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      // Tons
      const tons = document.querySelector('input[id*="ton" i], select[id*="ton" i]');
      if (tons) {
        if (tons.tagName === "SELECT") {
          const o = Array.from(tons.options).find(o => /\b4\b/.test(o.text || o.value));
          if (o) { tons.value = o.value; tons.dispatchEvent(new Event("change", { bubbles: true })); }
        } else {
          tons.value = "4"; tons.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    });
    await $w(800);
    await snapshot(page, "est-03-filled");

    // Submit
    const btn = await page.$("#btnEstimate, button[type='submit'], button:not([type='button'])");
    if (btn) await btn.click().catch(() => {});
    await $w(4000);
    await snapshot(page, "est-04-result");

    // Mobile viewport check
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(BASE + "/hvac-estimate.html", { waitUntil: "networkidle2" });
    await passCheckpoint(page);
    await $w(2000);
    await snapshot(page, "est-05-mobile-initial");

    await page.close();
  }

  // ============ ANALYZE PATH ============
  console.log("\n== ANALYZE PATH ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/hvac-quote-analyzer.html", { waitUntil: "networkidle2" });
    await passCheckpoint(page);
    await $w(2000);
    await snapshot(page, "ana-01-initial");

    // Upload f5 (high — Elite Comfort Trane $13,457)
    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(F5);
    await page.waitForFunction(() => !!document.getElementById("tpConfirmPriceBtn") || !!document.getElementById("tpManualPriceBtn") || !!document.querySelector(".verdict-price"), { timeout: 90000 }).catch(() => {});
    await $w(1000);
    await snapshot(page, "ana-02-f5-confirm");
    if (await page.$("#tpConfirmPriceBtn")) {
      await page.click("#tpConfirmPriceBtn");
      await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => {});
      await $w(1500);
    }
    await snapshot(page, "ana-03-f5-result");

    await page.close();
  }

  // ============ ANALYZE — service fixture (f1) ============
  console.log("\n== ANALYZE PATH (f1 service) ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/hvac-quote-analyzer.html", { waitUntil: "networkidle2" });
    await passCheckpoint(page);
    await $w(2000);

    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(F1);
    await page.waitForFunction(() => !!document.getElementById("tpConfirmPriceBtn") || !!document.getElementById("tpManualPriceBtn") || !!document.querySelector(".verdict-price"), { timeout: 90000 }).catch(() => {});
    await $w(1000);
    if (await page.$("#tpConfirmPriceBtn")) {
      await page.click("#tpConfirmPriceBtn");
      await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => {});
      await $w(1500);
    }
    await snapshot(page, "ana-04-f1-service-result");

    await page.close();
  }

  // ============ COMPARE PATH ============
  console.log("\n== COMPARE PATH ==");
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1440, height: 900 });
    const cmpUrls = [
      BASE + "/compare-hvac-quotes.html",
      BASE + "/compare-hvac.html",
    ];
    let cmpUrl = null;
    for (const u of cmpUrls) {
      try {
        const resp = await page.goto(u, { waitUntil: "networkidle2", timeout: 30000 });
        if (resp && resp.status() < 400) { cmpUrl = u; break; }
      } catch (e) {}
    }
    if (!cmpUrl) {
      console.log("compare URL not found");
    } else {
      console.log("compare URL:", cmpUrl);
      await passCheckpoint(page);
      await $w(2000);
      await snapshot(page, "cmp-01-initial");

      // upload f3 + f5
      const inputs = await page.$$('input[type="file"]');
      console.log("file inputs:", inputs.length);
      if (inputs[0]) await inputs[0].uploadFile(F3);
      if (inputs[1]) await inputs[1].uploadFile(F5);
      else if (inputs[0]) await inputs[0].uploadFile(F5);
      await $w(2000);
      await snapshot(page, "cmp-02-uploaded");

      // Click compare button
      const btn = await page.evaluateHandle(() => {
        const all = Array.from(document.querySelectorAll("button"));
        return all.find(b => /compare/i.test(b.innerText)) || null;
      });
      if (btn) {
        try { await btn.click(); } catch (e) {}
      }
      // Wait for some result UI
      await page.waitForFunction(() => /verdict|winner|cheaper|saves|low|high|best|most/i.test(document.body.innerText), { timeout: 120000 }).catch(() => {});
      await $w(3000);
      await snapshot(page, "cmp-03-result");
    }

    await page.close();
  }

  await browser.close();
  console.log("\nDone. Output:", OUT);
})();
